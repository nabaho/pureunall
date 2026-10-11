'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   안내문 발송 대장 짓개 (대표 지시 2026-10-11
   「다음메일함에서 비정기적으로 자문사에 안내문을 보낸적이 많이 있다. 이부분 모두 검토하고 참고해서 안내문 보낸것 정리해라
    파일이 언제 어떤내용으로 보냈는지 확인이 되어야 한다」 → 목업 A(안내문별)·B(파일별) → 「추천대로」)
   ══════════════════════════════════════════════════════════════════════════
   푸른 메일함 거울(mailbox/msgs/{폴더}/{번호} — 목록 줄 칸: s 제목 · d 날짜 · e·f 보낸이 · t 받는 사람(최대 8명)
   · an 첨부 이름(최대 5) · a 첨부 수 · p 앞 140자)에서 «우리가 여러 곳에 보낸 안내문» 줄을 모아
   같은 안내문끼리 묶고, 받는 «주소»는 같은 이메일의 업체 이름으로 바꿔 newsletter/noticeLog 에 적는다.

   ★ 읽기만 한다 — 메일함(IMAP)도, 거울도, 업체 원장도 건드리지 않는다. 쓰는 곳은 newsletter/noticeLog 하나다.
   ★ 받는 «주소»는 저장하지 않는다 — 업체 이름과 수만. (대장은 관리자만 읽지만, 주소를 또 한 벌 만들 까닭이 없다.)
   ★ «기록»이라서 사라지지 않는다 — 다음메일에서 메일을 지우거나 옮겨 거울에서 안 보여도 대장 줄은 남고
     `사라짐` 때만 붙는다(다시 보이면 걷는다). 규칙판이 바뀔 때만 통째로 새로 짓는다.
   ⚠ 한계(대표에게도 알렸다): 거울에는 한 통당 받는 사람이 8명까지만, 숨은참조는 기록이 없다 → 받은 곳은 실제보다 적을 수 있다.
     보낸편지함은 다음메일이 폴더당 400통까지만 보여 주므로 거울에 2026-08 이후만 있다(예약편지함·내게쓴편지함 등에서 옛것을 찾는다).

   판단(묶기·구분·업체 이름)은 모두 «순수 함수» — 여기서 DB 를 읽고 쓰는 것은 `돌리기` 하나뿐이다. */

/* ── 규칙 ── */
const 규칙판 = 1;                 /* 규칙(낱말·틈·문턱·구분)을 바꾸면 올린다 — 올리면 대장을 통째로 새로 짓는다 */
const 안내낱말 = /안내|공문|인사드립니다|달라지는|주의 요청|지원금|개정|시행|판결|알림|공지|변경|신고|점검|교육|설명회|사업/;
const 뺄제목 = /주간뉴스레터|^\[시험\]/;           /* 뉴스레터·시험 발송은 안내문이 아니다 */
const 개별서류 = /급여대장|일용근로내용|송부의 건/;   /* 업체 한 곳에 서류를 보낸 메일 — 안내문이 아니다 */
const 일괄최소주소 = 5;           /* 받는 «주소»가 이만큼 안 되면 일괄 안내문이 아니다(소수·개별 발송) */
const 묶음틈 = 21 * 24 * 3600e3;  /* 같은 제목이라도 이 틈이 벌어지면 다른 안내문 */
const 우리주소 = /370-6@(daum|hanmail)\.net/i;
const 우리이름 = /푸른노무법인/;
/* 안 보는 칸 — 받은메일함·휴지통·스팸·임시저장(보내지 않은 초안). 거울의 kind 값이다. */
const 안볼종류 = { inbox: 1, trash: 1, spam: 1, drafts: 1 };
const 보낸종류 = { sent: 1, sched: 1 };      /* 이 칸의 줄은 «우리가 보낸 것»이다 */
const 사본종류 = { tome: 1 };                /* 내게쓴편지함 — 숨은참조로 보낸 안내문의 사본(받는 사람 기록 없음) */
const 쓰는곳 = 'newsletter/noticeLog';

/* ── 작은 도구 ── */
function 서울날(ms) { return ms ? new Date(Number(ms) + 9 * 3600e3).toISOString().slice(0, 10) : ''; }
function 제목다듬기(s) {
  return String(s == null ? '' : s)
    .replace(/^\s*((re|fw|fwd|답장|전달)\s*:\s*)+/i, '')
    .replace(/\s*새창으로 읽기\s*$/i, '')
    .replace(/\s+/g, ' ').trim();
}
function 구분(제목) {
  const t = String(제목 || '');
  if (/공휴일/.test(t)) return '공휴일 안내';
  if (/인사드립니다|새해|설날|추석|한가위/.test(t)) return '명절·새해 인사';
  if (/판결|법리|달라지는 노동법|법 개정|개정/.test(t)) return '판결·법령 안내';
  if (/지원금|지원사업|비즈니스지원단|환급금|보수총액|장려금|사업 안내/.test(t)) return '지원사업·제도 안내';
  if (/교육|설명회|참석/.test(t)) return '교육·행사 안내';
  return '기타 안내';
}
/* 짧고 «실시간DB 열쇠로 안전한» 이름표 — 날짜 + 제목 해시(. $ # [ ] / 가 못 들어간다) */
function 해시(s) {
  let h = 5381; const t = String(s || '');
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function 이름표(날짜, 제목) { return 'n' + String(날짜 || '').replace(/-/g, '') + '_' + 해시(제목); }
const 주소들 = (v) => (String(v == null ? '' : v).match(/[^\s,;<>()"']+@[^\s,;<>()"']+\.[^\s,;<>()"']+/g) || []).map((x) => x.toLowerCase());
const 목록으로 = (x) => (Array.isArray(x) ? x : Object.keys(x && typeof x === 'object' ? x : {}).sort((a, b) => Number(a) - Number(b)).map((k) => x[k]));

/* ── 업체 이름 찾기: 같은 이메일 주소로 — 업체관리(원장) 먼저, 없으면 기업정보함 명함. 이름 짐작은 하지 않는다 ── */
function 지수만들기(업체들, 명함들) {
  const 업체 = new Map(), 명함 = new Map();
  const 담 = (지, 주소, 이름) => { if (!이름) return; 주소들(주소).forEach((e) => { if (!지.has(e)) 지.set(e, new Set()); 지.get(e).add(이름); }); };
  Object.keys(업체들 || {}).forEach((k) => {
    const c = (업체들 || {})[k] || {};
    const 이름 = String(c.name || '').replace(/\s+/g, ' ').trim();
    if (!이름) return;
    [c.email, c.primaryContactEmail, c.ceoEmail, c.taxEmail, c.taxInvoiceEmail].forEach((v) => 담(업체, v, 이름));
    목록으로(c.contacts).forEach((x) => 담(업체, x && x.email, 이름));
  });
  Object.keys(명함들 || {}).forEach((k) => {
    const x = (명함들 || {})[k] || {};
    const 이름 = String(x.c || '').replace(/\s+/g, ' ').trim();
    if (x.e && 이름) 담(명함, x.e, 이름);
  });
  return { 업체, 명함 };
}

/* ── 줄 하나가 «우리가 보낸 안내문 꼴» 인가 ── */
function 안내줄인가(줄, 칸) {
  const 제목 = 제목다듬기(줄.s);
  if (!제목 || 뺄제목.test(제목) || !안내낱말.test(제목)) return false;
  if (보낸종류[칸.종류]) return true;                         /* 보낸·예약 칸은 우리가 보낸 것 */
  if (사본종류[칸.종류]) return false;                        /* 사본은 «사본»으로만 붙인다 */
  return 우리주소.test(String(줄.e || '')) || 우리이름.test(String(줄.f || ''));   /* 그 밖의 칸(옮겨 둔 폴더)은 보낸이를 본다 */
}

/* ── 짓기(순수): 칸들 → 안내문들
   칸들 = [{ slug, 이름, 종류, 줄들:{번호:줄} }] · 업체들 = data/companies/v · 명함들 = pucards/idx
   돌려주는 것 = { 안내문들: { 이름표: 항목 }, 보았다: { 칸수, 줄수 } } ── */
function 짓기(입력) {
  const 칸들 = (입력 && 입력.칸들) || [];
  const { 업체: 업체지수, 명함: 명함지수 } = 지수만들기(입력 && 입력.업체들, 입력 && 입력.명함들);
  const 후보 = [], 사본 = [];
  let 줄수 = 0, 칸수 = 0;
  칸들.forEach((칸) => {
    if (!칸 || 안볼종류[칸.종류]) return;
    칸수++;
    Object.keys(칸.줄들 || {}).forEach((u) => {
      const 줄 = 칸.줄들[u]; if (!줄 || typeof 줄 !== 'object') return;
      줄수++;
      const 제목 = 제목다듬기(줄.s);
      if (사본종류[칸.종류]) { if (제목 && 안내낱말.test(제목) && !뺄제목.test(제목)) 사본.push(Object.assign({ _칸: 칸, _u: u }, 줄)); return; }
      if (안내줄인가(줄, 칸)) 후보.push(Object.assign({ _칸: 칸, _u: u }, 줄));
    });
  });

  /* 묶기 — 같은 제목 + 날짜 틈 */
  const 제목별 = {};
  후보.forEach((x) => { const k = 제목다듬기(x.s); (제목별[k] = 제목별[k] || []).push(x); });
  const 묶음들 = [];
  Object.keys(제목별).forEach((k) => {
    const 줄 = 제목별[k].slice().sort((a, b) => (Number(a.d) || 0) - (Number(b.d) || 0));
    let 지금 = null;
    줄.forEach((x) => {
      if (!지금 || (Number(x.d) || 0) - 지금.끝 > 묶음틈) { 지금 = { 제목: k, 줄들: [], 끝: Number(x.d) || 0 }; 묶음들.push(지금); }
      지금.줄들.push(x); 지금.끝 = Number(x.d) || 0;
    });
  });

  const 안내문들 = {};
  묶음들.forEach((g) => {
    if (개별서류.test(g.제목)) return;
    const 받는 = new Set();
    g.줄들.forEach((x) => String(x.t || '').split(',').filter(Boolean).forEach((e) => 받는.add(e.trim().toLowerCase())));
    if (받는.size < 일괄최소주소) return;

    const 시작 = Number(g.줄들[0].d) || 0;
    const 복사 = 사본.filter((x) => 제목다듬기(x.s) === g.제목 && (Number(x.d) || 0) >= 시작 - 묶음틈 && (Number(x.d) || 0) <= g.끝 + 묶음틈);
    const 모든줄 = g.줄들.concat(복사);
    const 날들 = Array.from(new Set(g.줄들.map((x) => 서울날(x.d)).filter(Boolean))).sort();
    const 날짜 = 날들[0] || '';

    const 업체 = new Set(), 명함업체 = new Set(); let 미확인 = 0;
    받는.forEach((e) => {
      if (업체지수.has(e)) 업체지수.get(e).forEach((n) => 업체.add(n));
      else if (명함지수.has(e)) 명함지수.get(e).forEach((n) => 명함업체.add(n));
      else 미확인++;
    });
    const 첨부 = []; const 본 = new Set(); let 이름없는 = 0;
    모든줄.forEach((x) => { 목록으로(x.an).forEach((n) => { n = String(n || '').slice(0, 160); if (n && !본.has(n)) { 본.add(n); 첨부.push(n); } }); });
    g.줄들.forEach((x) => { const 이름수 = 목록으로(x.an).length; if ((Number(x.a) || 0) > 이름수) 이름없는 = Math.max(이름없는, (Number(x.a) || 0) - 이름수); });
    const 미리 = 모든줄.map((x) => String(x.p || '')).sort((a, b) => b.length - a.length)[0] || '';
    const 폴더수 = {}; 모든줄.forEach((x) => { const n = String(x._칸.이름 || ''); 폴더수[n] = (폴더수[n] || 0) + 1; });
    const 한통최대 = Math.max.apply(null, g.줄들.map((x) => String(x.t || '').split(',').filter(Boolean).length));
    const id = 이름표(날짜, g.제목);
    안내문들[id] = {
      제목: g.제목.slice(0, 200), 날짜, 날짜들: 날들.slice(0, 24), 시각: 시작, 구분: 구분(g.제목),
      미리보기: 미리.replace(/\s+/g, ' ').trim().slice(0, 160),
      첨부: 첨부.slice(0, 16), 이름없는첨부: 이름없는,
      받는주소수: 받는.size, 한통최대,
      업체: Array.from(업체).sort().slice(0, 80), 명함업체: Array.from(명함업체).sort().slice(0, 80), 업체미확인: 미확인,
      /* ⚠ 폴더 이름에는 «.» 이 들어 있을 수 있다(「9. 자율점검…」) — 실시간DB 열쇠로 못 쓴다. 배열로 둔다. */
      폴더들: Object.keys(폴더수).sort().map((n) => ({ 이름: n.slice(0, 60), 수: 폴더수[n] })),
      메일줄수: g.줄들.length, 복사본수: 복사.length,
      참조: 모든줄.slice(0, 12).map((x) => ({ 칸: String(x._칸.slug || '').slice(0, 120), 번호: String(x._u) }))
    };
  });
  return { 안내문들, 보았다: { 칸수, 줄수 } };
}

/* 실시간DB 에 넣기 전 마지막 확인 — undefined 를 걷는다(던지지 않고 «고쳐서» 돌려준다) */
function 안전하게(v) { return JSON.parse(JSON.stringify(v)); }
/* «바뀌었나» 비교용 — 실시간DB 는 ① 열쇠를 정렬해서 돌려주고 ② 빈 배열·빈 객체·null 은 아예 저장하지 않는다.
   그대로 글자로 견주면 늘 «바뀜»으로 나와 매일 쓰게 된다 → 둘 다 같은 꼴로 맞춘 뒤 견준다. */
function 정규(v) {
  if (Array.isArray(v)) return v.map(정규);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).sort().forEach((k) => {
      const x = 정규(v[k]);
      const 빔 = x === undefined || x === null || x === '' || (Array.isArray(x) && !x.length)
        || (typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length);
      if (!빔) o[k] = x;
    });
    return o;
  }
  return v;
}
function 같은가(a, b) { return JSON.stringify(정규(a)) === JSON.stringify(정규(b)); }

/* ── 돌리기: 읽고(거울·업체·명함) → 짓고 → 바뀐 것만 쓴다 ──
   db = { ref(경로) → { once('value') → 스냅샷(.val()) · update(객체) } } (firebase-admin 의 것, 검사는 가짜) */
async function 돌리기(o) {
  const db = o.db, now = Number(o.now) || Date.now(), 로그 = o.로그 || (() => {});
  const 읽기 = async (경로) => (await db.ref(경로).once('value')).val();
  const 폴더들 = (await 읽기('mailbox/folders')) || {};
  const 칸들 = []; let 실패 = 0;
  for (const slug of Object.keys(폴더들)) {
    const f = 폴더들[slug] || {};
    if (안볼종류[f.kind] || !Number(f.total)) continue;
    try { 칸들.push({ slug, 이름: String(f.name || slug), 종류: String(f.kind || ''), 줄들: (await 읽기('mailbox/msgs/' + slug)) || {} }); }
    catch (e) { 실패++; 로그('[안내문 대장] 칸 읽기 실패 ' + slug + ' — ' + ((e && e.message) || e)); }
  }
  let 업체들 = {}, 명함들 = {};
  try { 업체들 = (await 읽기('data/companies/v')) || {}; } catch (e) { 실패++; 로그('[안내문 대장] 업체 원장 읽기 실패 — ' + ((e && e.message) || e)); }
  try { 명함들 = (await 읽기('pucards/idx')) || {}; } catch (e) { 실패++; 로그('[안내문 대장] 명함 색인 읽기 실패 — ' + ((e && e.message) || e)); }

  const 새것 = 짓기({ 칸들, 업체들, 명함들 });
  const 기존메타 = (await 읽기(쓰는곳 + '/meta')) || {};
  const 기존 = (await 읽기(쓰는곳 + '/items')) || {};
  const 판바뀜 = Number(기존메타.규칙판) !== 규칙판;       /* 규칙을 바꿨다 → 통째로 새로 짓는다(옛 이름표가 쌓이지 않게) */
  /* ⚠ 읽기가 믿을 만한 날만 «없어진 것»을 말한다 — 칸을 못 읽었거나, 읽은 칸이 0 이거나, 읽은 줄이 지난번의 절반도 안 되면
       (거울이 통째로 비었던 날) 「안 보인다」는 사실이 아니라 읽기가 실패한 것이다. 그날은 붙이지도 지우지도 않는다. */
  const 믿을만 = !실패 && 새것.보았다.칸수 > 0
    && (!Number(기존메타.읽은줄) || 새것.보았다.줄수 >= Number(기존메타.읽은줄) * 0.5);
  const 갈아엎음 = 판바뀜 && 믿을만;
  const 올림 = {};

  Object.keys(새것.안내문들).forEach((id) => {
    const 항목 = 안전하게(새것.안내문들[id]);
    const 옛 = 기존[id];
    const 옛몸 = 옛 ? Object.assign({}, 옛) : null; if (옛몸) delete 옛몸.사라짐;
    if (판바뀜 || !옛 || 옛.사라짐 || !같은가(옛몸, 항목)) 올림['items/' + id] = 항목;    /* 사라짐 이 붙었으면 통째로 덮어 걷는다 */
  });
  /* 이번에 안 보인 옛 줄 — 기록이라 «지우지 않는다»(규칙판이 바뀐 날만 예외). 「사라짐」 때만 붙인다. */
  Object.keys(기존).forEach((id) => {
    if (새것.안내문들[id]) return;
    if (갈아엎음) { 올림['items/' + id] = null; return; }
    if (믿을만 && !판바뀜 && !기존[id].사라짐) 올림['items/' + id + '/사라짐'] = now;
  });

  const 바뀜 = Object.keys(올림).length;
  const 전체 = Object.keys(갈아엎음 ? 새것.안내문들 : Object.assign({}, 기존, 새것.안내문들)).length;
  const 메타 = {
    /* 믿을 수 없는 날에 규칙판 도장을 새로 찍으면 다음 날 «갈아엎기»가 영영 안 온다 — 옛 도장을 그대로 둔다 */
    규칙판: (!판바뀜 || 갈아엎음) ? 규칙판 : (Number(기존메타.규칙판) || 0),
    확인한때: now, 만든때: 바뀜 ? now : (Number(기존메타.만든때) || now),
    안내문수: Object.keys(새것.안내문들).length, 전체, 읽은칸: 새것.보았다.칸수,
    /* 기준(읽은 줄)도 믿을 수 있는 날만 새로 — 거울이 비었던 날의 작은 수가 기준이 되면 다음 날 비교가 무뎌진다 */
    읽은줄: 믿을만 ? 새것.보았다.줄수 : (Number(기존메타.읽은줄) || 새것.보았다.줄수), 못읽은칸: 실패
  };
  올림.meta = 메타;
  await db.ref(쓰는곳).update(올림);
  로그('[안내문 대장] ' + JSON.stringify({ 안내문: 메타.안내문수, 전체: 메타.전체, 바뀐항목: 바뀜, 칸: 메타.읽은칸, 줄: 새것.보았다.줄수, 못읽은칸: 실패, 믿을만 }));
  return { 메타, 바뀜 };
}

module.exports = {
  규칙판, 안내낱말, 뺄제목, 개별서류, 일괄최소주소, 묶음틈, 쓰는곳, 우리주소,
  서울날, 제목다듬기, 구분, 해시, 이름표, 목록으로, 지수만들기, 안내줄인가, 짓기, 돌리기
};
