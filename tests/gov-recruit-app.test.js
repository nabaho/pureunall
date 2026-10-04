'use strict';
/* 정부사업신청 › 🧑‍💼 컨설턴트 모집 — 화면 함수를 vm 에 올려 «실제로» 돌린다 (2026-10-04) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
const T = (y, m) => new Date(y, m - 1, 15).getTime();

function runApp(seed, opt) {
  opt = opt || {};
  const els = {}, opened = [], toasts = [];
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '', className: '',
      style: {}, classList: { add(){}, remove(){} } };
    return els[id];
  }
  const store = {};
  Object.keys(seed || {}).forEach((k) => {
    store['gov3_' + k] = typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]); });
  const answers = (opt.prompts || []).slice();
  const ctx = {
    console, setTimeout, clearTimeout, Math, JSON, String, Number, Object, Array, RegExp, Promise,
    Date: opt.Date || Date,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { getElementById: el, createElement: () => ({ click(){}, style:{} }), addEventListener(){} },
    location: { protocol: 'https:' }, navigator: {},
    GovG2b: require('../js/gov-g2b.js'), GovCareer: require('../js/gov-career.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'), GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'), GovRecruit: require('../js/gov-recruit.js'),
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort = () => {}; this.signal = null; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} }, Blob: function(){},
    prompt: () => answers.shift(), confirm: () => (opt.confirm !== false),
    open: (u) => { opened.push(u); }
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
  vm.runInNewContext(code + '\n;globalThis.__api={recDraw,recSetSt,recSetUrl,recAddOrg,recDelOrg,recPrep,recToForm,'
    + 'recGroups,recObj,kwReset,kwIsDefault,drawKw,rejudge,setTab,draw,recCal,recCalDue,recSetDue,recDue,recWatchPull,recWatchHtml,recSeen,recWatchCal,recNewFor,'
    + 'toast:function(f){ toast=f; },setFb:function(db,uid){fbDb=db;fbUid=uid;}};', ctx);
  ctx.__api.toast((m) => toasts.push(m));
  return { api: ctx.__api, el, store, opened, toasts };
}
/* 오늘을 2026-12-05 로 못박는다 */
function FixedDate(today) {
  const Real = Date;
  function D(...a) { return a.length ? new Real(...a) : new Real(today); }
  D.now = () => new Real(today).getTime(); D.prototype = Real.prototype;
  return D;
}

const SCAN = [
  { y: '2024', yd: '2024년', name: '2024 공기업평가원 상시자문위원모집공고', dir: true, t: T(2024, 1) },
  { y: '2025', yd: '2025년', name: '2025_지방공기업평가원_자문위원_인사노무.zip', dir: false, t: T(2025, 1) },
  { y: '2026', yd: '2026년', name: '2026 지방공기업평가원 정책연구 외부연구진 풀 모집', dir: true, t: T(2026, 1) },
  { y: '2025', yd: '2025년', name: '2025 경영평가위원위촉 알리오', dir: true, t: T(2025, 12) },
  { y: '2024', yd: '2024년', name: '2024 경영평가위원모집', dir: true, t: T(2024, 12) },
  { y: '2017', yd: '2017년', name: '2017종합소득세신고', dir: true, t: T(2017, 5) }
];

test('★ 폴더를 아직 안 읽었으면 «무엇을 누르라»고 말한다 — 빈 표만 두지 않는다', () => {
  const r = runApp({});
  r.api.recDraw();
  assert.match(r.el('recBan').innerHTML, /서류 폴더에서 읽기/);
  assert.match(r.el('recBan').innerHTML, /옮기거나 고치지 않습니다/);
  assert.match(r.el('recTb').innerHTML, /아직 읽은 것이 없습니다/);
});

test('★★ 읽은 것을 기관별로 «모집 달 가까운 순»으로 그린다', () => {
  const r = runApp({ recruit_scan: SCAN, recruit_at: String(T(2026, 10)) }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.api.recDraw();
  const h = r.el('recTb').innerHTML;
  assert.ok(h.indexOf('공공기관 경영평가') < h.indexOf('지방공기업평가원'), '12월(이번 달)이 1월보다 위');
  assert.match(h, /이번 달/); assert.match(h, /다음 달/);
  assert.doesNotMatch(h, /종합소득세/, '모집과 무관한 것은 표에 없다');
  assert.match(r.el('recRest').innerHTML, /묶이지 않은 것 1건/);
  assert.match(r.el('recRest').innerHTML, /종합소득세/);
});

test('★ 이번 달·다음 달 띠 — 기관 이름을 짚는다', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.api.recDraw();
  const b = r.el('recBan').innerHTML;
  assert.match(b, /이번 달\(12월\)/); assert.match(b, /공공기관 경영평가/);
  assert.match(b, /다음 달/); assert.match(b, /지방공기업평가원/);
  assert.match(b, /파일 날짜/, '어림한 값이라고 밝힌다');
});

test('없으면 가장 가까운 달을 말한다', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.recDraw();
  assert.match(r.el('recBan').innerHTML, /가장 가까운 것은 <b>12월<\/b>/);
});

test('★ 올해 폴더에 있으면 「✓ 폴더에 있음」, 없으면 상태를 고를 수 있다', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.api.recDraw();
  const h = r.el('recTb').innerHTML;
  const erc = h.slice(h.indexOf('지방공기업평가원'));
  assert.match(erc.slice(0, erc.indexOf('</tr>')), /폴더에 있음/);
  const alio = h.slice(h.indexOf('공공기관 경영평가'));
  assert.match(alio.slice(0, alio.indexOf('</tr>')), /<select onchange="recSetSt\('alio'/);
});

test('★★ 올해 상태를 적으면 «그 해»에 남고 클라우드로 간다', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  let pushed = null;
  r.api.setFb({ ref: () => ({ set: (v) => { pushed = v; return Promise.resolve(); } }) }, 'U1');
  r.api.recSetSt('alio', '지원함');
  assert.equal(r.api.recObj('recruit_log').alio['2026'].st, '지원함');
  return new Promise((res) => setTimeout(() => {
    assert.ok(pushed, '클라우드에 올려야 다른 기기에서 보인다');
    assert.equal(pushed.recruit.log.alio['2026'].st, '지원함');
    assert.equal(pushed.recruit.scan.length, SCAN.length);
    assert.ok(Array.isArray(pushed.feed), '⚠ 통째로 덮으므로 공고도 함께 실어야 한다');
    r.api.recSetSt('alio', '');
    assert.equal(r.api.recObj('recruit_log').alio['2026'], undefined, '비우면 지운다');
    res();
  }, 1400));
});

test('★ 링크 고치기 — https 만 받고, 비우면 사전 주소로 되돌린다', () => {
  const r = runApp({ recruit_scan: SCAN }, { prompts: ['javascript:alert(1)', 'https://example.invalid/board', ''] });
  r.api.recSetUrl('erc');
  assert.equal(r.api.recObj('recruit_url').erc, undefined, 'http(s) 가 아니면 안 받는다');
  r.api.recSetUrl('erc');
  assert.equal(r.api.recGroups().orgs.find((o) => o.id === 'erc').url, 'https://example.invalid/board');
  r.api.recSetUrl('erc');
  assert.match(r.api.recGroups().orgs.find((o) => o.id === 'erc').url, /erc\.re\.kr/);
});

test('★ 링크가 없는 기관은 「링크 넣기」 — 막다른 길로 두지 않는다', () => {
  const r = runApp({ recruit_scan: [{ y: '2023', yd: '2023년', name: '2023충남사회서비스원 이사', dir: true, t: T(2023, 1) }] });
  r.api.recDraw();
  assert.match(r.el('recTb').innerHTML, /링크 넣기/);
});

test('★ 기관 더하기 — 그 낱말로 묶이고, 주소가 이상하면 비운다', () => {
  const r = runApp({ recruit_scan: SCAN.concat([{ y: '2025', yd: '2025년', name: '2025 대전지방법원 조정위원', dir: true, t: T(2025, 3) }]) },
    { prompts: ['대전지방법원', '대전지방법원', '조정위원', 'ftp://x'] });
  r.api.recAddOrg();
  const c = r.api.recGroups().orgs.find((o) => o.custom);
  assert.equal(c.name, '대전지방법원'); assert.equal(c.items.length, 1); assert.equal(c.url, '');
  r.api.recDraw();
  assert.match(r.el('recTb').innerHTML, /직접 더함/);
  r.api.recDelOrg(c.id);
  assert.equal(r.api.recGroups().orgs.filter((o) => o.custom).length, 0);
});

test('★ 서류 준비 — 작년 서류·공지·서식 채우기가 한 창에', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.api.recPrep('erc');
  assert.match(r.el('popTtl').textContent, /지방공기업평가원 — 지원 서류 준비/);
  const b = r.el('popBody').innerHTML;
  assert.match(b, /그동안 낸 서류 \(3건\)/);
  assert.match(b, /읽기만 합니다/);
  assert.match(b, /recToForm\('erc'\)/);
  assert.match(b, /erc\.re\.kr/);
  assert.match(r.el('pop').className, /\bon\b/);
});

test('★ 서식 채우기는 경력관리로 넘긴다(두 곳에 짓지 않는다) — 공고명만 싣는다', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.api.recToForm('erc');
  assert.equal(r.opened.length, 1);
  assert.match(r.opened[0], /^kcareer\.html\?go=form&t=/);
  assert.match(decodeURIComponent(r.opened[0]), /2026 지방공기업평가원/);
});

test('★★ 찾는 말 기본값으로 — 기계가 숨긴 것은 되살리고 사람이 숨긴 것은 둔다', () => {
  const feed = [
    { id: 'G1', no: '1', src: '나라장터', nm: '조직진단 용역', org: 'A', hidden: true, ruleOut: true, type: '새 공고' },
    { id: 'G2', no: '2', src: '나라장터', nm: '노무 자문', org: 'B', hidden: true, type: '새 공고' },
    { id: 'G3', no: '3', src: '나라장터', nm: '관용차 임차', org: 'C', hidden: true, ruleOut: true, type: '새 공고' }
  ];
  const r = runApp({ feed, kw: JSON.stringify(['일터혁신']) });
  assert.equal(r.api.kwIsDefault(['일터혁신']), false);
  r.api.kwReset();
  const out = JSON.parse(r.store.gov3_feed);
  assert.equal(out.find((x) => x.id === 'G1').hidden, false, '조직진단은 다시 맞는다 — 되살린다');
  assert.equal(out.find((x) => x.id === 'G2').hidden, true, '사람이 숨긴 것은 그대로');
  assert.equal(out.find((x) => x.id === 'G3').hidden, true, '여전히 안 맞는 것은 그대로');
  assert.equal(r.store.gov3_kw, '');
  assert.ok(r.toasts.some((t) => /되살렸습니다/.test(t)));
});

test('찾는 말이 기본값이면 「기본값으로」 단추를 안 그린다', () => {
  const r = runApp({});
  r.api.drawKw();
  assert.doesNotMatch(r.el('kwBox').innerHTML, /기본값으로/);
  const r2 = runApp({ kw: JSON.stringify(['일터혁신']) });
  r2.api.drawKw();
  assert.match(r2.el('kwBox').innerHTML, /kwReset\(\)/);
});

test('★ 탭 셋 — 컨설턴트 모집을 열면 그린다, 모르는 값은 공고로', () => {
  const r = runApp({ recruit_scan: SCAN });
  r.api.setTab('rec');
  assert.equal(r.el('pgRec').style.display, ''); assert.equal(r.el('pgFeed').style.display, 'none');
  assert.match(r.el('tbRec').className, /on/);
  assert.match(r.el('recTb').innerHTML, /지방공기업평가원/);
  r.api.setTab('이상한값');
  assert.equal(r.el('pgFeed').style.display, ''); assert.equal(r.el('pgRec').style.display, 'none');
});

test('★★ 서류 폴더는 «읽기»로만 연다 — 쓰기 권한·옮기기·지우기가 없다', () => {
  const body = src.slice(src.indexOf('═══ 🧑‍💼 컨설턴트 모집'), src.indexOf('async function recOpenFile'));
  assert.ok(body.length > 1000);
  assert.doesNotMatch(body, /readwrite'\s*\}\s*\)\s*;?\s*\}\s*catch|mode\s*:\s*'readwrite'/, '폴더를 쓰기로 열면 안 된다');
  assert.doesNotMatch(body, /removeEntry|createWritable|\.move\(/);
  assert.match(body, /showDirectoryPicker\(\{id:'gov-recruit',mode:'read'\}\)/);
  assert.match(body, /requestPermission\(\{mode:'read'\}\)/);
});

test('★ 경력관리 폴더 열쇠는 «빌리기만» 한다 — 그 자리에 쓰지 않는다', () => {
  assert.match(src, /_recHandle\('kcareer_fs','rootDir'\)/);
  assert.doesNotMatch(src, /_recIdb\('kcareer_fs'\)[^;]*readwrite/);
  assert.match(src, /_recIdb\('gov_fs'\)/);
});

test('★ 클라우드에서 받을 때 컨설턴트 모집 자료도 되살린다', () => {
  const f = src.slice(src.indexOf('async function cloudPull'), src.indexOf('/* ═══ 신청 재료'));
  ['recruit_scan', 'recruit_at', 'recruit_log', 'recruit_url', 'recruit_custom'].forEach((k) =>
    assert.ok(f.indexOf("lsSet('" + k + "'") >= 0, k + ' 를 안 받는다'));
});

/* ═══ 📅 구글 캘린더 (대표 결정 2026-10-04 「둘 다」) ═══ */
test('★★ 📅 — 해마다 도는 «모집 준비» 일정 창을 연다(앞 달 1일)', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.recCal('erc');
  assert.equal(r.opened.length, 1);
  const u = r.opened[0];
  assert.match(u, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  assert.match(u, /dates=20261201\/20261202/, '1월 모집이면 12월 1일');
  assert.match(u, /recur=RRULE%3AFREQ%3DYEARLY/);
  assert.match(decodeURIComponent(u), /\[모집 준비\] 지방공기업평가원/);
});
test('★ 목록 줄에 📅 단추가 있다 — 모집 달을 모르면 없다', () => {
  const r = runApp({ recruit_scan: SCAN.concat([{ y: '2023', yd: '2023년', name: '2023충남사회서비스원 이사', dir: true, t: 0 }]) },
    { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.recDraw();
  const h = r.el('recTb').innerHTML;
  assert.match(h, /recCal\('erc'\)/);
  assert.doesNotMatch(h, /recCal\('pass'\)/, '날짜를 모르면 알림 날을 지어내지 않는다');
});
test('★★ 마감일 — 적어 두고 그 날 일정 창을 연다, 상태를 바꿔도 마감일이 남는다', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.el('recDue').value = '2027-01-20';
  r.api.recCalDue('alio');
  assert.equal(r.api.recDue({ id: 'alio' }, '2026'), '2027-01-20');
  assert.match(r.opened[0], /dates=20270120\/20270121/);
  assert.match(decodeURIComponent(r.opened[0]), /\[마감\] 공공기관 경영평가/);
  r.api.recSetSt('alio', '지원함');
  assert.equal(r.api.recObj('recruit_log').alio['2026'].due, '2027-01-20', '상태를 적어도 마감일은 남는다');
  r.api.recSetSt('alio', '');
  assert.equal(r.api.recObj('recruit_log').alio['2026'].due, '2027-01-20', '상태를 비워도 마감일은 남는다');
  r.api.recSetDue('alio', '');
  assert.equal(r.api.recObj('recruit_log').alio['2026'], undefined, '둘 다 비면 칸을 지운다');
});
test('마감일을 안 골랐으면 열지 않고 말한다', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.el('recDue').value = '';
  r.api.recCalDue('alio');
  assert.equal(r.opened.length, 0);
  assert.ok(r.toasts.some((t) => /마감일을 먼저/.test(t)));
});
test('★ 서류 준비 창에 캘린더 칸이 있다', () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.api.recPrep('erc');
  const b = r.el('popBody').innerHTML;
  assert.match(b, /해마다 12월 1일 준비 알림/);
  assert.match(b, /id="recDue"/); assert.match(b, /recCalDue\('erc'\)/);
  assert.match(b, /저장은 대표님이 누르십니다/);
});

/* ═══ 🛰 기관 게시판 새 모집 글 — 서버 recruitWatch 결과 (2026-10-04) ═══ */
const WATCH = {
  last: { at: '2026-10-04T22:20:00Z', checked: 11, added: 2, errors: [{ board: 'lh', why: 'HTTP 503' }], counts: { erc: 11 } },
  hits: {
    k1: { key: 'k1', board: 'erc', org: 'erc', boardName: '지방공기업평가원 공지', title: '2027년 외부연구진 풀 공개 모집', date: '2026-12-01', href: 'https://www.erc.re.kr/v?1' },
    k2: { key: 'k2', board: 'agri6', org: 'agri6', boardName: '6차 공지', title: '현장코칭 전문위원 모집', date: '2026-11-20', href: 'javascript:alert(1)' }
  }
};
function fbWith(val, fail) {
  return { ref: (p) => ({ once: () => (fail ? Promise.reject(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }))
    : Promise.resolve({ val: () => (p === 'gov_watch' ? val : null) })), set: () => Promise.resolve() }) };
}
test('★★ 서버가 찾은 새 모집 글을 날짜 내림차순으로 보여 주고, 기관 줄에 🆕', async () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.api.setFb(fbWith(WATCH), 'U1');
  await r.api.recWatchPull();
  const w = r.el('recWatch').innerHTML;
  assert.ok(w.indexOf('외부연구진') < w.indexOf('현장코칭'), '최근 글이 위');
  assert.match(w, /새 글 <b>2건<\/b>/);
  assert.match(w, /11곳/); assert.match(w, /못 읽은 곳 1\(lh\)/, '고장 난 게시판을 숨기지 않는다');
  assert.match(r.el('recTb').innerHTML, /🆕 새 글/);
  assert.equal(r.api.recNewFor('erc'), true);
});
test('★ javascript: 주소는 링크로 안 그린다', async () => {
  const r = runApp({}, {});
  r.api.setFb(fbWith(WATCH), 'U1');
  await r.api.recWatchPull();
  const w = r.el('recWatch').innerHTML;
  assert.doesNotMatch(w, /javascript:alert/);
  assert.match(w, /href="https:\/\/www\.erc\.re\.kr\/v\?1"/);
});
test('★ 폴더를 안 읽었어도 새 모집 글은 보인다', async () => {
  const r = runApp({});
  r.api.setFb(fbWith(WATCH), 'U1');
  await r.api.recWatchPull();
  assert.match(r.el('recWatch').innerHTML, /외부연구진/);
  assert.match(r.el('recBan').innerHTML, /서류 폴더에서 읽기/);
});
test('★★ ✓ 봤음 — 대표 자리에만 적고 🆕 가 사라진다, 클라우드로 간다', async () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  let pushed = null;
  const db = fbWith(WATCH);
  db.ref = ((orig) => (p) => Object.assign(orig(p), { set: (v) => { pushed = v; return Promise.resolve(); } }))(db.ref);
  r.api.setFb(db, 'U1');
  await r.api.recWatchPull();
  r.api.recSeen('k1');
  assert.equal(r.api.recNewFor('erc'), false);
  assert.doesNotMatch(r.el('recTb').innerHTML, /🆕 새 글/);
  assert.match(r.el('recWatch').innerHTML, /새 글 <b>1건<\/b>/);
  await new Promise((res) => setTimeout(res, 1400));
  assert.ok(pushed && pushed.recruit.seen.k1, '다른 기기에서도 봤음이 보여야 한다');
});
test('★ 권한이 없으면 조용히 비우지 않고 까닭을 말한다', async () => {
  const r = runApp({});
  r.api.setFb(fbWith(null, true), 'U1');
  await r.api.recWatchPull();
  assert.match(r.el('recWatch').innerHTML, /읽을 권한이 없습니다/);
});
test('★ 서버가 아직 한 번도 안 돌았으면 그렇다고 말한다', async () => {
  const r = runApp({});
  r.api.setFb(fbWith({}), 'U1');
  await r.api.recWatchPull();
  assert.match(r.el('recWatch').innerHTML, /아직 한 번도 안 돌았습니다/);
  assert.match(r.el('recWatch').innerHTML, /아직 걸린 모집 글이 없습니다/);
});
test('★ 📅 마감일 — 날짜 꼴이 맞을 때만 구글 일정 창을 연다', async () => {
  const r = runApp({}, { prompts: ['다음주', '2027-01-20'] });
  r.api.setFb(fbWith(WATCH), 'U1');
  await r.api.recWatchPull();
  r.api.recWatchCal('k1');
  assert.equal(r.opened.length, 0);
  assert.ok(r.toasts.some((t) => /2027-01-20 꼴로/.test(t)), '무엇을 넣어야 하는지 말한다');
  r.api.recWatchCal('k1');
  assert.equal(r.opened.length, 1);
  assert.match(r.opened[0], /dates=20270120\/20270121/);
  assert.match(decodeURIComponent(r.opened[0]), /\[마감\] 2027년 외부연구진 풀 공개 모집/);
});
test('★★ 서버 결과(gov_watch)에 화면이 «쓰지» 않는다', () => {
  assert.doesNotMatch(src, /ref\('gov_watch[^)]*'\)\s*\.(set|update|push|remove)/);
});
test('★ 컨설턴트 모집 탭을 열면 서버 결과를 받아 온다', async () => {
  const r = runApp({});
  r.api.setFb(fbWith(WATCH), 'U1');
  r.api.setTab('rec');
  await new Promise((res) => setTimeout(res, 20));
  assert.match(r.el('recWatch').innerHTML, /외부연구진/);
});
