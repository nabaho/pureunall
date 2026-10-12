'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   안내문 원문 보관 (대표 지시 2026-10-12 「1」 — 본문·파일 보관)
   ══════════════════════════════════════════════════════════════════════════
   앞 단계(안내문 발송 대장, news-notice-log.js)는 거울의 «목록 줄»만 봤다 — 제목·날짜·첨부 «이름»·앞 140자.
   「파일이 언제 어떤 내용으로 보냈는지」를 정말 확인하려면 «본문 전체»와 «파일 자체»가 있어야 한다.
   그런데 다음메일 IMAP 은 폴더당 400통까지만 열어 준다 — 보낸편지함은 하루에 수십 통이 쌓여 «열흘쯤» 뒤면
   앱에서 못 연다(2026-10-12 실측: 가장 최근 안내문 3건이 이미 창 밖). 그래서 «열리는 동안» 한 통을 받아 지킨다.

   ★ 한 안내문마다 «메일 한 통»만 받는다 — 같은 안내문이 3통(받는 사람만 다름)으로 쪼개져 있어 글·첨부가 같다.
       ① IMAP (창 안)  — fetchOne source. 읽음 표시를 안 건드린다(messageFlagsAdd 를 아예 안 부른다).
       ② POP3 (창 밖)  — 날짜 이진 탐색 + 이웃 훑기로 찾아 RETR. 느리다(약 60KB/초) — 시간 예산을 재고 시작한다.
   ★ 보관하는 것
       · 본문 글(2만 자까지) — 실시간DB newsletter/noticeArchive/<id>. HTML 만 있는 메일은 «우리가» HTML 을 글로 바꾼다(아래 html글)
       · 첨부 파일 — 창고 newsletter_archive/files/<내용 해시>/<이름>. «내용 해시»로 두는 까닭: 같은 파일을 여러 번
         보내도 한 벌만 담고, «이름만 같고 내용이 다른 판»을 가른다(휴일대체합의서.hwp 처럼 해마다 고치는 서식).
       · 원본 .eml — 창고 newsletter_archive/eml/<id>.eml (그림·서식까지 그대로. 메일 프로그램에서 열린다)
       · 내려받기 주소 = 토큰 주소(firebaseStorageDownloadTokens). 저장소 표준 길이다 — 규칙은 잠근 채로 두고,
         «정보를 읽을 수 있는 사람(대표) = 파일도 볼 수 있는 사람». 서명 URL 은 만료돼서 쓰지 않는다.
   ★ 받은 곳 바로잡기(C-2) — 메일마다 envelope(창 밖이면 POP3 머리글)의 받는이(To·Cc·Bcc)를 모아
       같은 이메일의 업체 이름으로 바꾼다. 거울은 한 통 8명에서 잘렸다. 주소는 «저장하지 않는다» — 수와 업체 이름만.
   ⚠ 읽기만 한다 — 다음메일에는 DELE·플래그 변경·이동이 하나도 없다. 쓰는 곳은 실시간DB 두 자리와 창고 한 자리.
   ⚠ 대장 짓개(03:40)와 «따로» 도는 함수다 — 대장은 「IMAP 도 안 건드린다」는 약속이 있다. 대장 줄(items/<id>)은 짓개만 쓰고,
     이 모듈은 그것을 읽기만 한다(archiveIndex·noticeArchive 는 별도 자리라 짓개가 덮지 않는다).
   ⚠ 던지지 않고 값으로 알린다 — 한 안내문의 실패가 다음 안내문을 막지 않는다. 실패는 기록하고 하루 뒤 다시(최대 8번).

   판단(원문 풀기·받은 곳 셈·파일 자리·토큰 주소·찾기 규칙)은 순수 함수 — 메일함·창고·DB 는 «끼워 넣는다»(검사는 가짜). */

const crypto = require('crypto');
const NL = require('./news-notice-log.js');

/* ── 규칙 ── */
const 판 = 2;                                   /* 보관 모양을 바꾸면 올린다 — 올리면 다시 받는다(2: HTML 만 있는 메일의 본문을 글로 바꾸고, 받은 곳 «수»를 따로 적는다) */
const 표지자리 = 'newsletter/noticeLog/archiveIndex';   /* 가벼운 표지 — 대장과 함께 읽힌다 */
const 본자리 = 'newsletter/noticeArchive';              /* 무거운 본문·주소 — 상세를 열 때만 읽는다 */
const 창고자리 = 'newsletter_archive';          /* 기본 창고 안의 한 줄기 — 규칙이 없어 사람 손(클라이언트)은 못 닿고 토큰 주소로만 열린다 */
const 본문한도 = 20000;                         /* 글자 수 — 안내문은 길어야 몇 천 자다 */
const 첨부수한도 = 24;
const 첨부하나한도 = 40 * 1024 * 1024;
const 메일한도 = 64 * 1024 * 1024;              /* 이보다 큰 한 통은 받지 않는다(함수 메모리) */
const 다시해보기틈 = 6 * 3600e3;                /* 실패한 것을 다시 해 보기까지 */
const 포기횟수 = 8;
const POP속도 = 55 * 1024;                      /* 바이트/초 — 실측 약 60KB/초에서 여유를 둔다 */
const POP여유초 = 20;
const 날짜이웃 = 3 * 60e3;                      /* POP3 에서 «같은 메일»로 볼 날짜 오차 */
const 형제창 = 2 * 3600e3;                      /* 같은 안내문의 다른 통(받는 사람만 다른 것)을 찾는 시간 폭 */
const 늦은연속한도 = 40;                        /* POP3 번호는 «거의» 시간 차례라(실측 1%가 뒤바뀐다) 늦은 통을 한 번 봤다고 훑기를 끝내지 않는다 — 연달아 이만큼 늦어야 끝 */
const 이름한도 = 400;                           /* 받은 곳 업체 이름을 적는 수 — 수(업체수·명함수)는 따로 «진짜 수»를 적는다 */
const 하루 = 24 * 3600e3;
const 영구최소나이 = 7 * 하루;                  /* «영구»는 보낸 지 이만큼 지난 안내문만 — 새로 보낸 메일이 다음메일 열람 목록에 «아직 안 보이는» 날을 영구로 확정하지 않는다 */

/* ── 작은 도구 ── */
const 안전하게 = (v) => JSON.parse(JSON.stringify(v));
function 해시(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

/* 창고 이름으로 쓸 파일 이름 — 폴더가 생기는 « / », 제어문자, 윈도 금지 글자를 «_» 로. 한글은 그대로 둔다. */
function 파일이름다듬기(이름) {
  let s = String(이름 == null ? '' : 이름)
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
    .replace(/^\.+/, '');
  if (!s) s = '첨부';
  if (s.length > 120) {
    const m = /(\.[A-Za-z0-9]{1,8})$/.exec(s); const 꼬리 = m ? m[1] : '';
    s = s.slice(0, 120 - 꼬리.length) + 꼬리;
  }
  return s;
}
/* 내려받을 때 브라우저에 줄 이름 — 열어 보여 주지 않고 «받게» 한다(우리 주소 안에서 문서가 열리면 안 된다) */
function 내려받기머리(이름) {
  const 안전 = 파일이름다듬기(이름);
  const 대체 = 안전.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const 인코딩 = encodeURIComponent(안전).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return 'attachment; filename="' + 대체 + '"; filename*=UTF-8\'\'' + 인코딩;
}
function 토큰주소(통이름, 자리, 토큰) {
  return 'https://firebasestorage.googleapis.com/v0/b/' + 통이름 + '/o/' + encodeURIComponent(자리) + '?alt=media&token=' + 토큰;
}
function 파일자리(해시값, 이름) { return 창고자리 + '/files/' + String(해시값).slice(0, 32) + '/' + 파일이름다듬기(이름); }
function 원본자리(id) { return 창고자리 + '/eml/' + String(id).replace(/[^A-Za-z0-9_-]/g, '_') + '.eml'; }

/* ── HTML → 글 ─────────────────────────────────────────────────────────────────
   ⚠ 다음메일 편집기·아웃룩이 만든 안내문은 «HTML 만» 있는 때가 많다. 그런데 mailparser(3.9)는 그런 메일의 text 를
     — 첨부가 붙은 multipart/mixed 에서는 «빈 글»로, 그림이 박힌 단일 HTML 에서는 «[data:image/png;base64,…]» 수십만 자로 돌려준다
     (2026-10-12 운영 첫 실행: 보관 20건 중 14건이 본문 0자 · 4건이 그림 글자). 그래서 HTML 이 있으면 «우리가» 글로 바꾼다.
   보여 줄 글이지 HTML 로 되돌릴 글이 아니다 — 줄바꿈·목록 점·표 칸 나눔·링크 주소만 살리고, 그림은 «[그림]» 한 마디로 둔다.
   브라우저가 보여 주는 줄 모양을 따른다: <p> 와 <div> 는 «줄 끝»일 뿐 빈 줄이 아니고, <p><br></p> 가 «빈 줄 하나»다(다음메일 편집기의 꼴).
   의존 없는 순수 함수 — CI 에도 돈다. 그림 태그에 수 MB 가 들어도 한 번 훑어 끝난다(태그 토막 하나일 뿐). */
const 이름엔티티 = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', bull: '•', hellip: '…', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  ndash: '–', mdash: '—', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', times: '×', rarr: '→', larr: '←' };
function 엔티티풀기(글) {
  return String(글 == null ? '' : 글).replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (그대로, 키) => {
    if (키[0] === '#') {
      const n = (키[1] === 'x' || 키[1] === 'X') ? parseInt(키.slice(2), 16) : parseInt(키.slice(1), 10);
      return (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)) ? String.fromCodePoint(n) : '';
    }
    const 값 = 이름엔티티[키.toLowerCase()];
    return 값 === undefined ? 그대로 : 값;
  });
}
const 숨김태그 = new Set(['script', 'style', 'head', 'title', 'noscript', 'template', 'svg', 'iframe', 'object']);   /* 안의 글을 «안 보여 주는» 태그(닫는 태그가 있는 것만) */
const 줄태그 = new Set(['p', 'div', 'tr', 'table', 'thead', 'tbody', 'tfoot', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'section', 'article',
  'header', 'footer', 'dl', 'dt', 'dd', 'center', 'form', 'fieldset', 'address', 'figure', 'figcaption', 'main', 'nav', 'aside', 'hr', 'body', 'html']);
function html글(html) {
  let s = String(html == null ? '' : html);
  if (s.length > 8e6) s = s.slice(0, 8e6);                                    /* 안내문 글은 이보다 훨씬 앞에 있다 — 끝없는 입력을 막는 상한 */
  s = s.replace(/<!--[\s\S]*?-->/g, '');                                        /* 주석·조건부 주석(<!--[if mso]> …) */
  const 토막 = s.split(/(<\/?[A-Za-z][^>]*>)/);                                /* 홀수 칸 = 태그, 짝수 칸 = 글 */
  const 줄들 = []; let 지금 = '', 숨김 = '';
  const 끝 = (강제) => {
    const t = 지금.replace(/[ \t\u00a0]+$/g, '').replace(/^[ \t\u00a0]+/g, '').replace(/ {2,}/g, ' ');   /* 인라인 태그 사이에 낀 겹공백은 한 칸으로 */
    if ((t && t !== '•') || 강제 || (!t && /\u00a0/.test(지금))) 줄들.push(t);   /* &nbsp; 만 든 줄은 «빈 줄 하나»(브라우저도 한 줄 높이로 그린다) — 공백만 든 줄은 높이가 없다 */
    지금 = '';
  };
  const 링크들 = [];
  for (let i = 0; i < 토막.length; i++) {
    const 조각 = 토막[i];
    if (i % 2 === 0) { if (!숨김 && 조각) 지금 += 엔티티풀기(조각.replace(/[ \t\r\n\f]+/g, ' ')); continue; }
    const m = /^<(\/?)([A-Za-z][A-Za-z0-9]*)/.exec(조각.slice(0, 40));
    if (!m) continue;
    const 닫음 = m[1] === '/', 이름 = m[2].toLowerCase();
    if (숨김) { if (닫음 && 이름 === 숨김) 숨김 = ''; continue; }
    if (!닫음 && 숨김태그.has(이름)) {
      let 닫힘 = false;                                                          /* 닫는 태그가 «있을 때만» 숨긴다 — 안 닫힌 <script> 가 뒤 글을 통째로 삼키면 안 된다 */
      for (let j = i + 2; j < 토막.length; j += 2) { if (/^<\/[A-Za-z]/.test(토막[j].slice(0, 4)) && 토막[j].slice(2, 2 + 이름.length).toLowerCase() === 이름) { 닫힘 = true; break; } }
      if (닫힘) 숨김 = 이름;
      continue;
    }
    if (이름 === 'br') { 끝(true); continue; }                                    /* <br> 는 «빈 줄까지» 만든다 — 줄 끝의 <br> 는 앞 줄에 이미 닿아 있어 더 안 만든다 */
    if (이름 === 'img') {
      if (!닫음 && !/\b(?:width|height)\s*=\s*["']?1(?:px)?["']?(?=[\s/>"'])/i.test(조각.slice(0, 600))) 지금 += ' [그림] ';   /* 1×1 추적 점은 안 센다 */
      continue;
    }
    if (이름 === 'a') {
      if (!닫음) {
        const h = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(조각.slice(0, 700));
        링크들.push({ 주소: h ? 엔티티풀기(h[1] || h[2] || h[3] || '').trim() : '', 시작: 지금.length });
      } else {
        const L = 링크들.pop();                                                  /* 보이는 글에 주소가 없으면 «글 (주소)» — 안내문의 신청 링크가 사라지면 안 된다 */
        if (L && /^https?:\/\//i.test(L.주소) && L.주소.length <= 300 && L.시작 <= 지금.length) {
          const 보임 = 지금.slice(L.시작).trim(), 짧게 = L.주소.replace(/^https?:\/\//i, '').replace(/\/$/, '');
          if (보임 && !/^https?:\/\//i.test(보임) && 보임.indexOf(짧게) < 0) 지금 += ' (' + L.주소 + ')';
        }
      }
      continue;
    }
    if (이름 === 'li') { 끝(false); if (!닫음) 지금 = '• '; continue; }
    if (이름 === 'td' || 이름 === 'th') { if (닫음) 지금 += '\t'; continue; }          /* 표 칸은 탭으로 — 줄 끝의 탭은 위에서 걷힌다 */
    if (줄태그.has(이름)) 끝(false);
  }
  끝(false);
  return 줄들.join('\n').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
/* HTML 이 없을 때의 보루 — mailparser 가 그림을 «[data:image/png;base64,…]» 로 바꿔 준 글에서 그 덩어리를 «[그림]» 으로 */
function 평문글(글) {
  return String(글 == null ? '' : 글).replace(/\[?data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=\s]*\]?/gi, '[그림]');
}
/* 본문으로 쓸 글 고르기 — HTML 이 있으면 그것(받는 사람이 본 모양), 글이 안 나오면(그림뿐) 평문 */
function 본문고르기(p) {
  const html = p && typeof p.html === 'string' ? p.html : '';
  if (html.trim()) { const 글 = html글(html); if (글.trim()) return 글; }
  return 평문글(p && p.text);
}

/* 본문 글 다듬기 — 줄바꿈 하나로, 보이지 않는 글자 걷기, 빈 줄 둘까지, 한도에서 자르기 */
function 본문다듬기(글) {
  let s = String(글 == null ? '' : 글).replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200d\u2060\ufeff]/g, '');
  s = s.split('\n').map((x) => x.replace(/[ \t\u00a0]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > 본문한도) return { 글: s.slice(0, 본문한도) + '…', 잘림: true, 길이: s.length };
  return { 글: s, 잘림: false, 길이: s.length };
}

/* 받는 사람 목록 — mailparser({value:[…]}) 도 imapflow([…]) 도 받는다. 묶음 주소(group)는 펼친다. */
function 주소목록(값) {
  const 낸 = [];
  const 담 = (x) => {
    if (!x) return;
    if (Array.isArray(x)) { x.forEach(담); return; }                  /* 같은 머리글이 여럿이면 배열의 배열이다 */
    if (Array.isArray(x.value)) { x.value.forEach(담); return; }      /* mailparser 의 {value:[…]} */
    if (Array.isArray(x.group)) { x.group.forEach(담); return; }
    const a = String(x.address || '').trim().toLowerCase();
    if (a && a.indexOf('@') > 0) 낸.push(a);
  };
  담(값);
  return 낸;
}
/* 메일 한 통의 «받는 주소들» — 받는이·참조·숨은참조. 우리 주소(내게쓴편지함 사본의 받는이)는 뺀다. */
function 봉투주소들(env) {
  const e = env || {};
  const 모두 = [].concat(주소목록(e.to), 주소목록(e.cc), 주소목록(e.bcc));
  return Array.from(new Set(모두.filter((a) => !NL.우리주소.test(a))));
}

/* 받은 곳 셈 — 묶음들 = 메일마다의 주소 목록. 업체 이름은 «같은 이메일»로(업체관리 먼저, 없으면 명함). 주소는 안 남긴다. */
function 받은곳만들기(묶음들, 지수) {
  const 전체 = new Set(); let 한통최대 = 0;
  (묶음들 || []).forEach((b) => { const 고유 = new Set(b || []); 한통최대 = Math.max(한통최대, 고유.size); 고유.forEach((a) => 전체.add(a)); });
  const 업체 = new Set(), 명함 = new Set(); let 미확인 = 0;
  const 지 = 지수 || { 업체: new Map(), 명함: new Map() };
  전체.forEach((a) => {
    if (지.업체.has(a)) 지.업체.get(a).forEach((n) => 업체.add(n));
    else if (지.명함.has(a)) 지.명함.get(a).forEach((n) => 명함.add(n));
    else 미확인++;
  });
  return { 받는주소수: 전체.size, 한통최대, 메일수: (묶음들 || []).length, 업체수: 업체.size, 명함수: 명함.size,     /* 이름 목록은 한도에서 잘려도 «진짜 수»는 따로 */
    업체: Array.from(업체).sort().slice(0, 이름한도), 명함업체: Array.from(명함).sort().slice(0, 이름한도), 업체미확인: 미확인 };
}

/* ── 원문 풀기 — 메일 원본(Buffer) → 글·첨부·받는 주소 ── */
async function 원문풀기(원본, parse) {
  const p = await parse(원본);
  const 첨부 = [];
  (p.attachments || []).forEach((a) => {
    if (!a || !a.content || a.related) return;        /* 본문에 박힌 그림(cid)은 .eml 에 있다 — 따로 안 담는다 */
    첨부.push({ 이름: String(a.filename || '').trim() || '첨부', 형식: String(a.contentType || ''), 내용: a.content });
  });
  const t = p.date ? new Date(p.date).getTime() : 0;
  return { 제목: String(p.subject || ''), 날짜: Number.isFinite(t) ? t : 0, 본문: 본문다듬기(본문고르기(p)),
    첨부, 받는주소들: 봉투주소들(p) };
}

/* ── 창고에 올리기 — 이미 있으면 다시 안 올린다(내용 해시가 자리) ── */
async function 올리기(통, 자리, 내용, 이름, 토큰만들기) {
  const 파일 = 통.file(자리);
  let 있다 = false;
  try { 있다 = !!(await 파일.exists())[0]; } catch (_) { 있다 = false; }
  let 토큰 = '';
  if (있다) {
    try { const m = (await 파일.getMetadata())[0]; 토큰 = String((m && m.metadata && m.metadata.firebaseStorageDownloadTokens) || '').split(',')[0]; }
    catch (_) { 토큰 = ''; }
  }
  if (!있다) {
    토큰 = 토큰만들기();
    await 파일.save(내용, { resumable: false, metadata: { contentType: 'application/octet-stream', contentDisposition: 내려받기머리(이름),
      metadata: { firebaseStorageDownloadTokens: 토큰 } } });
  } else if (!토큰) {
    토큰 = 토큰만들기();
    await 파일.setMetadata({ metadata: { firebaseStorageDownloadTokens: 토큰 } });
  }
  return 토큰;
}

/* ── 보관하기 — 원본 한 통을 풀어 창고·표지·본으로 ──
   돌려주는 것 = { 본, 표지 } (실시간DB 에 넣을 값). 원본의 «받는 주소»는 어디에도 안 담는다. */
async function 보관하기(o) {
  const 풀림 = await 원문풀기(o.원본, o.parse);
  const 첨부기록 = [], 건너뜀 = [];
  for (const a of 풀림.첨부.slice(0, 첨부수한도)) {
    const 이름 = 파일이름다듬기(a.이름);
    if (a.내용.length > 첨부하나한도) { 건너뜀.push({ 이름, 크기: a.내용.length, 까닭: '너무 큼' }); continue; }
    const h = 해시(a.내용), 자리 = 파일자리(h, 이름);
    const 토큰 = await 올리기(o.통, 자리, a.내용, 이름, o.토큰만들기);
    첨부기록.push({ 이름, 형식: a.형식.slice(0, 100), 크기: a.내용.length, 해시: h.slice(0, 32), 주소: 토큰주소(o.통이름, 자리, 토큰) });
  }
  if (풀림.첨부.length > 첨부수한도) 건너뜀.push({ 이름: '(나머지 ' + (풀림.첨부.length - 첨부수한도) + '개)', 크기: 0, 까닭: '개수 한도' });
  let 원본기록 = null;
  if (o.원본.length <= 메일한도) {
    const 자리 = 원본자리(o.id), 이름 = '안내문_' + String(o.id) + '.eml';
    const 토큰 = await 올리기(o.통, 자리, o.원본, 이름, o.토큰만들기);
    원본기록 = { 크기: o.원본.length, 주소: 토큰주소(o.통이름, 자리, 토큰) };
  }
  const 받은곳 = o.받은곳 || null;
  const 본 = {
    판, 때: o.now, 방법: o.방법,
    메일: { 제목: 풀림.제목.slice(0, 300), 날짜: 풀림.날짜, 크기: o.원본.length, 칸: String(o.원본메일 && o.원본메일.칸 || '').slice(0, 80) },
    본문: 풀림.본문.글, 본문잘림: 풀림.본문.잘림, 본문길이: 풀림.본문.길이,
    첨부: 첨부기록, 건너뜀, 원본: 원본기록, 받은곳
  };
  const 표지 = {
    판, 때: o.now, 방법: o.방법, 본문: !!풀림.본문.글, 본문잘림: 풀림.본문.잘림,
    첨부수: 첨부기록.length, 해시들: 첨부기록.map((a) => ({ 이름: a.이름, 해시: a.해시, 크기: a.크기 })),
    원본: !!원본기록, 받은곳: !!받은곳, 메일수: 받은곳 ? 받은곳.메일수 : 0
  };
  return { 본: 안전하게(본), 표지: 안전하게(표지) };
}

/* ── POP3 에서 찾기 ──────────────────────────────────────────────────────────
   POP3 는 «번호»가 회차마다 흔들리고, 우리가 아는 것은 제목·날짜뿐이다. 번호는 도착 차례(옛것이 앞)라
   Date 머리글로 이진 탐색해 근처로 간 뒤 이웃을 훑는다. 머리글만 받는다(TOP n 0) — 한 통에 수 KB. */
function 머리날짜(raw) {
  const m = /^Date:[ \t]*([^\r\n]*(?:\r?\n[ \t]+[^\r\n]*)*)/im.exec(String(raw || ''));
  if (!m) return 0;
  const t = Date.parse(m[1].replace(/\r?\n[ \t]+/g, ' ').trim());
  return Number.isFinite(t) ? t : 0;
}
/* POP3 줄 맨 앞의 «..» 는 «.» 이 겹쳐 쓰인 것이다(RFC 1939 바이트 채움) — 풀어야 원본이 된다 */
function pop원본(raw) { return Buffer.from(String(raw || '').replace(/^\.\./gm, '.'), 'binary'); }

/* 목표 = { 제목(다듬은), 날짜(ms) } · 돌려주는 것 = { 첫통: {n, 날짜}, 형제들: [{n, 주소들}], 본것, N } | { 못찾음 }
   ⚠ 명령은 STAT·TOP 뿐이다. */
async function pop찾기(pop, 목표, 부품) {
  const parse = 부품.parse, 로그 = 부품.로그 || (() => {});
  const stat = await pop.cmd('STAT', false);
  const N = Number((String(stat.head).match(/\+OK\s+(\d+)/) || [])[1] || 0);
  if (!N) return { 못찾음: 'POP3 에 메일이 없습니다', N };
  const 머리 = async (n) => (await pop.cmd('TOP ' + n + ' 0', true)).body;
  let lo = 1, hi = N, 본 = 0; const 표본 = [];
  while (lo < hi && 본 < 48) {
    const mid = Math.floor((lo + hi) / 2);
    const d = 머리날짜(await 머리(mid)); 본++;
    표본.push([mid, d ? NL.서울날(d) : '']);
    if (!d) { lo = mid + 1; continue; }              /* 날짜를 못 읽은 통은 지나간다 */
    if (d < 목표.날짜 - 하루) lo = mid + 1; else hi = mid;
  }
  로그('NOTICE_ARCHIVE_POP', JSON.stringify({ N, 이진탐색: 본, 도착: lo, 표본: 표본.slice(0, 12) }));   /* 날짜·번호만 — 제목·주소는 안 남긴다 */
  const 한도 = Number(부품.훑기한도 || 700);
  let 첫통 = null; const 형제들 = [];
  const 통계 = { 훑음: 0, 처음날: 0, 끝날: 0, 우리가보낸: 0, 제목일치: 0 };
  for (let n = Math.max(1, lo - 40), 늦음 = 0; n <= N && 통계.훑음 < 한도; n++) {
    const raw = await 머리(n); 본++; 통계.훑음++;
    const d = 머리날짜(raw);
    if (d) { if (!통계.처음날) 통계.처음날 = d; 통계.끝날 = d; }
    if (NL.우리주소.test((/^From:[^\r\n]*/im.exec(raw) || [''])[0])) 통계.우리가보낸++;
    if (d && d > 목표.날짜 + 형제창) { if (++늦음 >= 늦은연속한도) break; continue; }     /* 한 통이 늦다고 끝내지 않는다 — 번호는 «거의» 시간 차례일 뿐이다 */
    늦음 = 0;
    if (!d || d < 목표.날짜 - 날짜이웃) continue;
    let p;
    try { p = await parse(Buffer.from(raw, 'binary')); } catch (_) { continue; }
    if (NL.제목다듬기(p.subject) !== 목표.제목) continue;
    통계.제목일치++;
    const 보낸 = ((p.from && p.from.value && p.from.value[0]) || {}).address || '';
    if (!NL.우리주소.test(String(보낸))) continue;
    if (!첫통 && Math.abs(d - 목표.날짜) <= 날짜이웃) 첫통 = { n, 날짜: d };
    형제들.push({ n, 주소들: 봉투주소들(p) });
  }
  /* 날짜·수만 남긴다(제목·주소는 안 남김) — 운영에서만 시험되는 길이라 «어디를 얼마나 봤나»가 유일한 단서다 */
  로그('NOTICE_ARCHIVE_POP_SCAN', JSON.stringify({ 훑음: 통계.훑음, 첫: 통계.처음날 ? NL.서울날(통계.처음날) : '', 끝: 통계.끝날 ? NL.서울날(통계.끝날) : '', 우리가보낸: 통계.우리가보낸, 제목일치: 통계.제목일치 }));
  if (!첫통) return { 못찾음: 'POP3 에서 그 메일을 찾지 못했습니다', N, 본것: 본 };
  return { 첫통, 형제들, 본것: 본, N };
}

/* ── 한 안내문 보관 ── */
const 칸순서 = (종류) => (종류 === 'sent' ? 0 : 종류 === 'sched' ? 1 : 종류 === 'tome' ? 3 : 2);

async function 하나보관(o, 항목) {
  const db = o.db, 로그 = o.로그;
  const refs = NL.목록으로(항목.참조).filter((r) => r && r.칸 && /^\d+$/.test(String(r.번호)));
  if (!refs.length) return { 실패: '대장에 참조 메일이 없습니다' };

  const 폴더 = {};
  const 폴더읽기 = async (slug) => { if (!(slug in 폴더)) 폴더[slug] = (await (await db.ref('mailbox/folders/' + slug).once('value')).val()) || {}; return 폴더[slug]; };
  for (const r of refs) await 폴더읽기(r.칸);
  const 정렬 = refs.slice().sort((a, b) => 칸순서((폴더[a.칸] || {}).kind) - 칸순서((폴더[b.칸] || {}).kind));
  const 모두보낸 = 정렬.length > 0 && 정렬.every((r) => (폴더[r.칸] || {}).kind === 'sent');   /* 보낸편지함에만 있는 안내문 — POP3 에는 보낸편지함이 없는 듯하다(실측: 6년치 목록에 «밖으로 나간» 우리 메일 2통) */

  /* ① IMAP — 창 안의 통을 차례로. 봉투(받는 사람)는 «열리는 모든 통»에서 모으고, 원본은 처음 열린 한 통만 받는다. */
  let 원본 = null, 원본메일 = null, 방법 = '', 연속오류 = 0, 오류수 = 0, 마지막오류 = '';
  const 봉투들 = []; let 창밖 = 0;
  for (const r of 정렬) {
    if (o.남은초() < 25) return { 미룸: '시간이 모자랍니다' };
    try {
      const got = await o.열기.imap(r.칸, async (client) => {
        const head = await client.fetchOne(r.번호, { uid: true, size: true, envelope: true }, { uid: true });
        if (!head) return { 없음: true };
        const 낸 = { 크기: Number(head.size) || 0, 주소들: 봉투주소들(head.envelope) };
        if (!원본 && 낸.크기 <= 메일한도) {
          const one = await client.fetchOne(r.번호, { uid: true, source: true }, { uid: true });
          if (one && one.source) 낸.원본 = one.source;
        }
        return 낸;
      });
      연속오류 = 0;
      if (got.없음) { 창밖++; continue; }
      if (got.주소들.length) 봉투들.push(got.주소들);               /* 받는 사람이 없는 통(내게쓴 사본)은 셈에 안 넣는다 */
      if (got.원본 && !원본) { 원본 = got.원본; 방법 = 'imap'; 원본메일 = { 칸: String((폴더[r.칸] || {}).name || r.칸), 번호: String(r.번호) }; }
    } catch (e) {
      마지막오류 = String((e && e.message) || e).slice(0, 160);
      로그('[안내문 보관] IMAP 실패 ' + r.칸 + '/' + r.번호 + ' — ' + 마지막오류);
      오류수++;
      if (++연속오류 >= 2) break;                    /* 연결이 안 되면 나머지도 안 된다 — 오늘은 접고 내일 다시 */
    }
  }

  /* ② POP3 — IMAP 으로 한 통도 못 받았을 때만(창 밖) */
  if (!원본) {
    /* IMAP 이 «열리지도 않았다»(오류뿐, 창 밖이라는 답이 한 번도 없다)면 POP3 로 넘어가지 않는다 — 메일 쪽이 죽은 것이다 */
    if (오류수 && !창밖) return { 실패: 'IMAP 연결 실패 — ' + 마지막오류 };
    const 목표 = { 제목: NL.제목다듬기(항목.제목), 날짜: Number(항목.시각) || 0 };
    if (!목표.날짜) return { 실패: '대장에 첫 메일 시각이 없습니다' };
    if (o.남은초() < 90) return { 미룸: '시간이 모자랍니다' };
    let 풀이;
    try {
      풀이 = await o.열기.pop(async (pop) => {
        const 찾음 = await pop찾기(pop, 목표, { parse: o.parse, 로그, 훑기한도: o.훑기한도 });
        if (찾음.못찾음) return { 못찾음: 찾음.못찾음 };
        let size = 0;
        try { const l = await pop.cmd('LIST ' + 찾음.첫통.n, false); size = Number((String(l.head).match(/\d+\s+(\d+)/) || [])[1] || 0); }
        catch (e) { if (!(e && e.pop)) throw e; }
        if (size > 메일한도) return { 실패: '메일이 너무 큽니다(' + Math.round(size / 1048576) + 'MB)' };
        const 필요 = Math.ceil(size / POP속도) + POP여유초;
        if (o.남은초() < 필요) return { 미룸: '이 메일을 받는 데 ' + 필요 + '초쯤 걸려 오늘은 시간이 모자랍니다' };
        const raw = (await pop.cmd('RETR ' + 찾음.첫통.n, true)).body;
        return { 원본: pop원본(raw), 형제들: 찾음.형제들, n: 찾음.첫통.n, 본것: 찾음.본것 };
      });
    } catch (e) {
      return { 실패: 'POP3 실패 — ' + String((e && e.message) || e).slice(0, 160) };
    }
    if (풀이.미룸) return { 미룸: 풀이.미룸 };
    if (풀이.실패) return { 실패: 풀이.실패 };
    if (풀이.못찾음) {
      /* 보낸편지함에만 있는 메일이 IMAP 창 밖이고 POP3 에도 없다 — 오늘 안 되는 것이 아니라 «앞으로도» 안 된다. 날마다 다시 해 봐야 헛수고라 «확정»한다(영구).
         ⚠ 모든 참조가 «없다»는 답을 받았을 때만(창밖 = 참조 수) — 연결이 흔들려 «답을 못 받은» 참조가 있는 날의 «못 찾음»을 확정하면 안 된다. */
      const 확정 = 모두보낸 && 창밖 === 정렬.length && (Number(o.now) - 목표.날짜) >= 영구최소나이;
      return 확정
        ? { 실패: '보낸편지함 메일이 다음메일의 열람 창(폴더당 400통) 밖으로 밀려났고 POP3 에서도 찾지 못했습니다 — POP3 는 보낸편지함을 주지 않는 것으로 보입니다', 영구: true }
        : { 실패: 풀이.못찾음 + (모두보낸 && 창밖 === 정렬.length ? ' — 보낸 지 며칠 안 돼 다음메일 열람 목록에 아직 안 보일 수 있습니다(내일 다시 해 봅니다)' : '') };
    }
    원본 = 풀이.원본; 방법 = 'pop3'; 원본메일 = { 칸: '다음메일(POP3)', 번호: String(풀이.n) };
    풀이.형제들.forEach((x) => 봉투들.push(x.주소들));
  }

  /* ③ 받은 곳 — 봉투를 하나라도 모았을 때만(못 모았으면 거울 값이 그대로 화면에 남는다) */
  const 받은곳 = 봉투들.length ? 받은곳만들기(봉투들, o.지수()) : null;
  return await 보관하기({ id: 항목.id, 원본, 방법, 원본메일, 받은곳, 통: o.통, 통이름: o.통이름, now: o.now, parse: o.parse, 토큰만들기: o.토큰만들기 });
}

/* ── 돌리기 — 읽고 → 대상을 고르고 → 새것부터 하나씩 → 쓴다 ──
   o = { db, 통, 통이름, 열기:{ imap(slug, fn), pop(fn) }, parse, now, 끝나는때, 로그, 토큰만들기, 훑기한도 } */
async function 돌리기(o) {
  const db = o.db, now = Number(o.now) || Date.now(), 로그 = o.로그 || (() => {});
  const parse = o.parse || require('mailparser').simpleParser;
  const 끝 = Number(o.끝나는때) || (now + 480 * 1000);
  const 남은초 = () => Math.floor((끝 - Date.now()) / 1000);
  const 토큰만들기 = o.토큰만들기 || (() => crypto.randomUUID());
  const 읽기 = async (경로) => (await db.ref(경로).once('value')).val();

  const 항목들 = (await 읽기(NL.쓰는곳 + '/items')) || {};
  const 표지들 = (await 읽기(표지자리)) || {};
  const 대상 = Object.keys(항목들).map((id) => Object.assign({ id }, 항목들[id]))
    .filter((x) => x && typeof x === 'object')
    .filter((x) => {
      const 표 = 표지들[x.id];
      if (!표 || !(Number(표.판) >= 판)) return true;                                /* 처음이거나 옛 판 — 새 규칙으로 «바로» 다시(옛 판의 실패도 기다리지 않는다) */
      if (!표.실패) return false;                                                    /* 이미 보관했다 */
      if (표.실패.영구) return false;                                                 /* 다시 해 봐야 소용없다고 «확인한» 것 */
      if (Number(표.실패.횟수) >= 포기횟수) return false;                            /* 포기한 것 */
      if (now - Number(표.실패.때 || 0) < 다시해보기틈) return false;                 /* 아직 이르다 */
      return true;
    })
    .sort((a, b) => (Number(b.시각) || 0) - (Number(a.시각) || 0));                  /* 새것이 먼저 — 창에서 먼저 밀려난다 */

  const 결과 = { 대상: 대상.length, 보관: 0, 실패: 0, 미룸: 0 };
  if (!대상.length) { 로그('[안내문 보관] ' + JSON.stringify(결과)); return 결과; }

  let 지수 = null;
  const 지수읽기 = async () => {
    if (지수) return 지수;
    let 업체들 = {}, 명함들 = {};
    try { 업체들 = (await 읽기('data/companies/v')) || {}; } catch (e) { 로그('[안내문 보관] 업체 원장 읽기 실패 — ' + ((e && e.message) || e)); }
    try { 명함들 = (await 읽기('pucards/idx')) || {}; } catch (e) { 로그('[안내문 보관] 명함 색인 읽기 실패 — ' + ((e && e.message) || e)); }
    지수 = NL.지수만들기(업체들, 명함들); return 지수;
  };
  await 지수읽기();

  for (const 항목 of 대상) {
    if (남은초() < 25) { 결과.미룸 += (대상.length - 결과.보관 - 결과.실패 - 결과.미룸); break; }
    let r;
    try {
      r = await 하나보관({ db, 통: o.통, 통이름: o.통이름, 열기: o.열기, parse, now, 로그, 토큰만들기, 훑기한도: o.훑기한도,
        남은초, 지수: () => 지수 }, 항목);
    } catch (e) { r = { 실패: '풀지 못했습니다 — ' + String((e && e.message) || e).slice(0, 160) }; }

    if (r.미룸) { 결과.미룸++; 로그('[안내문 보관] 미룸 ' + 항목.id + ' — ' + r.미룸); continue; }
    if (r.실패) {
      const 옛표 = 표지들[항목.id], 옛 = (옛표 && Number(옛표.판) >= 판 && 옛표.실패) || {};      /* 옛 판의 횟수는 이어 세지 않는다 */
      const 실패 = { 때: now, 까닭: String(r.실패).slice(0, 200), 횟수: (Number(옛.횟수) || 0) + 1 };
      if (r.영구) 실패.영구 = true;
      await db.ref(표지자리 + '/' + 항목.id).update({ 판, 실패 });
      결과.실패++; 로그('[안내문 보관] 실패 ' + 항목.id + ' — ' + 실패.까닭);
      continue;
    }
    const 올림 = {};
    올림['noticeLog/archiveIndex/' + 항목.id] = r.표지;
    올림['noticeArchive/' + 항목.id] = r.본;
    await db.ref('newsletter').update(올림);
    결과.보관++;
    로그('[안내문 보관] 보관 ' + 항목.id + ' ' + JSON.stringify({ 방법: r.표지.방법, 첨부: r.표지.첨부수, 글자: r.본.본문길이, 원본KB: Math.round(r.본.메일.크기 / 1024) }));
  }
  로그('[안내문 보관] ' + JSON.stringify(결과));
  return 결과;
}

module.exports = {
  판, 표지자리, 본자리, 창고자리, 본문한도, 메일한도, 첨부하나한도, 포기횟수, 다시해보기틈, POP속도,
  해시, 파일이름다듬기, 내려받기머리, 토큰주소, 파일자리, 원본자리, 본문다듬기, 주소목록, 봉투주소들, 받은곳만들기,
  원문풀기, 올리기, 보관하기, 머리날짜, pop원본, pop찾기, 하나보관, 돌리기,
  엔티티풀기, html글, 평문글, 본문고르기, 이름한도, 늦은연속한도, 영구최소나이
};
