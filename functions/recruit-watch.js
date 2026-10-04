/* 컨설턴트 모집 감시(서버) — 기관 게시판에 «사람을 뽑는» 새 글이 올라오면 남긴다 (2026-10-04)

   대표 결정 2026-10-04: 「기관에 링크 연결해서 공고가 올라오면 캘린더에 올라오게」 →
   「기관 게시판 새 글 자동 감지 서버 — 지금 만든다」.

   ★ 왜 서버인가: 기관 누리집은 다른 화면(브라우저)이 읽어 가는 것을 막아 둔다(CORS).
     그래서 정부사업신청 화면이 직접 못 읽고, 서버가 하루 한 번 대신 읽는다.

   하루 한 번 이렇게 한다(게시판마다):
     ① 목록 첫 쪽만 받는다(한 기관에 한 번 — 기관 서버에 짐을 주지 않는다)
     ② 줄마다 «제목 + 날짜»를 뽑는다(parseRows — 표 <tr> 나 목록 <li> 한 줄)
     ③ 사람을 뽑는 글만 남긴다(isRecruit — 「컨설턴트·전문가·위원 + 모집」, 「결과」는 뺀다)
     ④ 처음 보는 글만 hits 에 더한다(열쇠 = 게시판 + 제목 + 날짜). 있던 글은 건드리지 않는다.

   ⚠ 게시판 주소는 2026-10-04 에 «실제로 줄이 뽑히는 것을 잰» 곳만 넣었다(11곳 → 15곳).
     더한 넷(semas·cepa·sinbo·keli)도 이 파일의 parseRows·isRecruit 로 직접 재어 보았다 —
     충남경제진흥원 「산업·일자리전환 지원센터 컨설턴트 추가 모집」·소진공 「비상임이사 모집」을 잡는다.
     나머지 기관은 첫 화면이 프로그램으로 그려져 이 방법으로 안 읽힌다 —
     화면은 그 기관을 「손으로 확인」으로 밝힌다. 주소를 지어 넣지 말 것.
   ⚠ 이 파일은 공개 저장소다. 대표님의 «지원 이력»은 여기 없다(기관 게시판 주소뿐).
   ⚠ 읽기만 한다 — 기관 누리집에 아무것도 보내지 않는다(로그인·신청 없음). */
'use strict';

const UA = 'Mozilla/5.0 (compatible; pureun-recruit-watch/1.0)';
const MAX_KEEP = 300;           // hits 에 남기는 글 상한 (오래된 것부터 뺀다)
const MAX_AGE_DAYS = 120;       // 이보다 오래된 글은 처음 봐도 안 남긴다(첫날 과거 글 쏟아짐 방지)

/* org 는 js/gov-recruit.js 의 기관 번호와 같다 — 화면이 그 줄에 「🆕」를 붙인다 */
const BOARDS = [
  { id: 'erc',     org: 'erc',     name: '지방공기업평가원 공지',     url: 'https://www.erc.re.kr/usr/com/prm/BBSList.do?bbsId=BBSMSTR_000000000251&menuNo=3000&upperMenuId=3' },
  { id: 'seosan',  org: 'seosan',  name: '서산시 공지사항',           url: 'https://www.seosan.go.kr/www/selectBbsNttList.do?bbsNo=97&key=1256' },
  { id: 'kordi',   org: 'kordi',   name: '한국노인인력개발원 알림',   url: 'https://www.kordi.or.kr/content.do?cmsId=91' },
  { id: 'agri6',   org: 'agri6',   name: '농촌융복합(6차산업) 공지',  url: 'https://xn--980b99s59h34f6tl.com/home/board/B0030.cs?m=24' },
  { id: 'lh',      org: 'lh',      name: 'LH 공지·공모',              url: 'https://www.lh.or.kr/menu.es?mid=a10601010000' },
  { id: 'tp',      org: 'tp',      name: '충남테크노파크 알림',       url: 'https://www.ctp.or.kr/community/notice.do' },
  { id: 'hrdk',    org: 'hrdk',    name: 'HRD 전문가 인력풀 신청공고', url: 'https://www.hrd4u.or.kr/expertpool/application/notice/list.do' },
  { id: 'family',  org: 'family',  name: '가족친화 지원사업 알림',    url: 'https://www.ffsb.kr/ffsbbod/bs/boardList.do?boardSeq=1&menuSeq=5190' },
  { id: 'kfcc',    org: 'kfcc',    name: '새마을금고 MG공지',         url: 'https://www.kfcc.co.kr/mgNotice/mgNoticeList.do' },
  { id: 'voucher', org: 'voucher', name: '데이터산업진흥원 알림',     url: 'https://kdata.or.kr/kr/board/notice_01/boardList.do' },
  { id: 'nrc',     org: 'nrc',     name: '경제·인문사회연구회 공지',  url: 'https://www.nrc.re.kr/board.es?mid=a12101000000&bid=0001' },
  { id: 'semas',   org: 'semas',   name: '소상공인시장진흥공단 공지', url: 'https://www.semas.or.kr/web/board/webBoardList.kmdc?bCd=1&pNm=BOA0101' },
  { id: 'cepa',    org: 'cepa',    name: '충남경제진흥원 공지',       url: 'https://www.cepa.or.kr/notice/notice.do?pm=6&ms=32' },
  /* 목록 머리에 오래된 «고정 공지»가 먼저 온다 — 새 글은 그 아래에 있다(그래도 첫 쪽 안이다) */
  { id: 'sinbo',   org: 'sinbo',   name: '충남신용보증재단 공지',     url: 'https://www.cnsinbo.co.kr/boardCnts/list.do?boardID=134&m=030101&s=cnsinbo' },
  { id: 'keli',    org: 'keli',    name: '한국고용노동교육원 공지',   url: 'https://www.keli.kr/home/cmmn/bbs/228/list.do' },
  /* 노사발전재단 — 사업공고/모집 목록은 화면 안 «틀(iframe)» 이 따로 불러온다. 서버는 그 틀 주소를 읽고,
     사람은 바깥 화면(page)으로 보낸다(틀 주소만 열면 머리·메뉴 없는 맨 목록이 뜬다). */
  { id: 'nosa',    org: 'nosa',    name: '노사발전재단 사업공고/모집', url: 'https://www.nosa.or.kr/board/bltnMngr?boardId=nosa05&',
    page: 'https://www.nosa.or.kr/portal/nosa/FoundNews/bizNotice' },
  /* ★ 공인노무사회 일반 공지 — 노사발전재단 컨설턴트 모집(일터혁신·공무직·공공부문 고용개선·고용구조개선·
     노동전환)은 재단 게시판이 아니라 «공문»으로 와서 여기 실린다(대표님 서류 폴더의 공문0157·0229 가 그것).
     실측 2026-10-04: 2015~2026 150건 중 사람 뽑는 글 37건. ⚠ 회원 공지(/bbs/news)는 로그인이 있어야 해 안 읽는다.
     ⚠ 여러 기관 글이 섞인 게시판이라 org 를 비우고 제목으로 정한다(ORG_HINTS). */
  { id: 'kcplaa',  org: '',        name: '공인노무사회 공지(기관 모집 공문)', url: 'https://www.kcplaa.or.kr/bbs/notice/list' }
];

/* 여러 기관 글이 섞인 게시판(org 가 빈 것)에서 제목으로 기관을 정한다.
   ⚠ 찾는 말은 js/gov-recruit.js 의 같은 기관과 «글자 하나까지» 같아야 한다 — 다르면 화면의 🆕 가 엉뚱한 줄에 붙는다.
     functions/recruit-watch.test.js 가 두 쪽 source 를 맞대 본다. 기관을 더할 때도 거기서 그대로 옮긴다. */
const ORG_HINTS = [
  ['nosa', /노사발전|고용구조개선|일터혁신|근무혁신|공무직\s*노사|공공부문\s*고용개선|노사협의회\s*구축|고용차별/],
  ['hrdk', /NCS|공정채용|산업인력공단|HRD\s*전문가/]
];
function orgHint(title) {
  const t = String(title || '');
  for (const [id, re] of ORG_HINTS) if (re.test(t)) return id;
  return '';
}

function clean(s) {
  return String(s == null ? '' : s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}
const DATE = /(20\d{2})\s?[.\-\/년]\s?(\d{1,2})\s?[.\-\/월]\s?(\d{1,2})/;
function pad(n) { return String(n).padStart(2, '0'); }
const FILE_NAME = /\.(pdf|hwpx?|xlsx?|docx?|pptx?|jpe?g|png|gif|zip)\s*$/i;
const FILE_LINK = /href\s*=\s*["'][^"']*(?:cmd=down|filedown|fileMngr|download)/i;
/* ⚠ 제목 앞뒤에 «잠깐 붙는 딱지»는 뗀다 — 「새글」(LH)·「[모집중]」(신보)·「NEW」는 며칠 뒤 사라지거나 바뀐다.
     제목이 글의 열쇠(keyOf)에 들어가므로, 떼지 않으면 딱지가 바뀔 때 같은 글이 «새 글»로 또 들어온다. */
function stripTag(t) {
  let x = String(t || ''), prev;
  do {
    prev = x;
    x = x.replace(/^(?:새\s*글|NEW|HOT|N)\s+/i, '')
      .replace(/^\[(?:모집\s*중|모집\s*마감|마감|접수\s*중|진행\s*중|종료|공지)\]\s*/, '')
      .replace(/\s+(?:NEW|N|새\s*글)$/i, '').trim();
  } while (x !== prev);
  return x;
}

/* 목록 한 쪽 → [{title, date:'YYYY-MM-DD', href}]
   ⚠ 줄 = 표 한 줄(<tr>) 또는 목록 한 칸(<li>). 날짜가 없는 줄(머리줄·메뉴)은 버린다.
   ⚠ 제목 = 그 줄 안 링크 글자 중 «가장 긴 것» — 번호·첨부 아이콘 링크를 피한다.
   ⚠ href 가 javascript: 이면 비운다(서버가 열 주소가 아니다 — 화면은 게시판 주소로 보낸다). */
function parseRows(html, base) {
  const out = [], seen = {};
  const blocks = String(html || '').match(/<tr[\s>][\s\S]*?<\/tr>|<li[\s>][\s\S]*?<\/li>/gi) || [];
  blocks.forEach((b) => {
    const d = DATE.exec(clean(b)); if (!d) return;
    const mo = +d[2], da = +d[3]; if (mo < 1 || mo > 12 || da < 1 || da > 31) return;
    /* ⚠ 첨부 파일 링크는 제목이 아니다 — 노사발전재단은 줄마다 첨부 목록이 붙고 그 이름이 제목보다 길다
       (실측: 제목 대신 「붙임. …명단.xlsx」를 잡았다). 파일이 아닌 링크가 «하나도 없을 때만» 파일 이름을 쓴다. */
    let best = null, bestFile = null;
    for (const m of b.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const t = stripTag(clean(m[2]).replace(/^제목\s+/, ''));
      if (t.length < 6 || t.length > 160) continue;
      const file = FILE_NAME.test(t) || FILE_LINK.test(m[1]);
      if (file) { if (!bestFile || t.length > bestFile.t.length) bestFile = { t, attrs: m[1] }; continue; }
      if (!best || t.length > best.t.length) best = { t, attrs: m[1] };
    }
    best = best || bestFile;
    if (!best) return;
    let href = '';
    const h = /href\s*=\s*["']([^"']*)["']/i.exec(best.attrs);
    if (h && h[1] && !/^\s*(javascript:|#)/i.test(h[1])) { try { href = new URL(h[1].replace(/&amp;/g, '&'), base).href; } catch (e) { href = ''; } }
    const date = d[1] + '-' + pad(mo) + '-' + pad(da);
    const k = best.t + '|' + date; if (seen[k]) return; seen[k] = 1;
    out.push({ title: best.t, date, href });
  });
  return out;
}

/* 사람을 뽑는 글인가 — «누구를»(컨설턴트·전문가·위원…) + «뽑는다»(모집·공모·위촉…) 둘 다 있어야 한다.
   ⚠ 「입주기업 모집」·「행복주택 모집」·「공모전」은 사람을 뽑는 글이 아니다(실측 잡음).
   ⚠ 「결과·명단·합격·개최」는 이미 끝난 글이다 — 「원장후보자심사위원회 개최결과」(실측)를 거른다. */
/* ⚠ 「이사」는 «위촉직·비상임·사외» 이사만 — 맨 「이사」는 「이사회」·「이사장」까지 걸린다.
     대표님은 진흥원·사회서비스원 이사에도 지원하셨다(실측: 「위촉직이사 모집 공고」를 놓쳤었다). */
const WHO = /컨설턴트|전문가|전문위원|자문위원|평가위원|심사위원|외부위원|운영위원|조정위원|인력\s*풀|인력풀|\bpool\b|강사|멘토|현장\s*코치|코칭|외부\s*연구진|연구진|자문단|지원단|상담위원|노무사|위촉직\s*이사|비상임\s*이사|사외\s*이사|임원/i;
const PICK = /모집|공모|선발|위촉|등록|구성|신청|추천|초빙/;
const DONE = /결과|명단|합격|발표|개최|선정\s*안내|최종\s*선정|공모전/;
/* ⚠ 배우러 오는 사람·자리 채우는 사람을 모으는 글 — 공인노무사회 공지에 많다(실측: 「고용노사관계 전문가과정
     교육생 모집」·「국제심포지엄 참가신청」·「위험성평가 컨설팅 전문가과정 강좌 신청 독려」). */
const LEARN = /교육생|수강생|참가\s*신청|참석자|심포지엄|세미나|강좌|양성\s*과정|전문가\s*과정|기본\s*과정|시상|자격증|서식/;
function isRecruit(title) {
  const t = String(title || '');
  return WHO.test(t) && PICK.test(t) && !DONE.test(t) && !LEARN.test(t);
}

function keyOf(board, row) {
  /* RTDB 열쇠에 못 쓰는 글자를 피한다 — 짧은 지문으로 */
  const s = board + '|' + row.title + '|' + row.date;
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return board + '_' + row.date.replace(/-/g, '') + '_' + h.toString(36);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
}

/* 한 번 돈다. fetchText(url) → Promise<string>. 네트워크는 부르는 쪽이 준다(검사에선 가짜) */
async function run(o) {
  const boards = o.boards || BOARDS, have = o.existing || {}, today = o.today, nowIso = o.nowIso || '';
  const hits = [], errors = [], counts = {};
  for (const b of boards) {
    try {
      const html = await o.fetchText(b.url);
      const rows = parseRows(html, b.url);
      counts[b.id] = rows.length;
      if (!rows.length) { errors.push({ board: b.id, why: '줄을 하나도 못 뽑았습니다(게시판 모양이 바뀌었을 수 있음)' }); continue; }
      rows.forEach((r) => {
        if (!isRecruit(r.title)) return;
        if (today && daysBetween(r.date, today) > MAX_AGE_DAYS) return;
        const key = keyOf(b.id, r);
        if (have[key]) return;
        hits.push({ key, board: b.id, org: b.org || orgHint(r.title), boardName: b.name, title: r.title, date: r.date,
          href: r.href || b.page || b.url, at: nowIso });
      });
    } catch (e) {
      errors.push({ board: b.id, why: String(e && e.message || e).slice(0, 120) });
    }
  }
  return { hits, errors, counts, checked: boards.length };
}

/* RTDB 에 쓸 것 — 새 글만 더하고, 넘치면 «오래된 것부터» 지운다(있던 글을 고치지 않는다) */
function updatesOf(result, existing, nowIso) {
  const upd = {};
  result.hits.forEach((h) => { upd['hits/' + h.key] = h; });
  const all = Object.keys(existing || {}).map((k) => ({ k, d: (existing[k] && existing[k].date) || '' }))
    .concat(result.hits.map((h) => ({ k: h.key, d: h.date })));
  if (all.length > MAX_KEEP) {
    all.sort((a, b) => a.d.localeCompare(b.d));
    all.slice(0, all.length - MAX_KEEP).forEach((x) => { upd['hits/' + x.k] = null; });
  }
  upd.last = { at: nowIso, checked: result.checked, added: result.hits.length,
    errors: result.errors, counts: result.counts };
  return upd;
}

/* 바이트 → 글자. 옛 게시판은 euc-kr 이다(meta 에 적혀 있다) */
function decode(buf, contentType) {
  const head = Buffer.from(buf).subarray(0, 4000).toString('latin1');
  const euc = /euc-kr|ks_c_5601/i.test(String(contentType || '')) || /charset\s*=\s*["']?(euc-kr|ks_c_5601)/i.test(head);
  return new TextDecoder(euc ? 'euc-kr' : 'utf-8').decode(buf);
}

module.exports = { UA, BOARDS, ORG_HINTS, orgHint, MAX_KEEP, MAX_AGE_DAYS, parseRows, isRecruit, keyOf, run, updatesOf, decode, clean };
