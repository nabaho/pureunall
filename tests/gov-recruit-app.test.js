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
    GovSubmit: require('../js/gov-submit.js'), GovSync: require('../js/gov-sync.js'),
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort = () => {}; this.signal = null; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} }, Blob: function(){},
    prompt: () => answers.shift(), confirm: () => (opt.confirm !== false),
    open: (u) => { opened.push(u); },
    TextDecoder, Uint8Array, PuKordocText: opt.kordoc
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
  vm.runInNewContext(code + '\n;globalThis.__api={recDraw,recSetSt,recSetUrl,recAddOrg,recDelOrg,recPrep,recToForm,'
    + 'recGroups,recObj,kwReset,kwIsDefault,drawKw,rejudge,setTab,draw,recCal,recCalDue,recSetDue,recDue,recWatchPull,recWatchHtml,recSeen,recWatchCal,recNewFor,'
    + 'cloudPull,recMailScan,recMailHtml,recMailUndo,recMailResult,recMailPick,recMailSkip,recMailMark,recMailFolders,recNeedTog,recNeedOf,recCheckRun,recCheckDraw,'
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
  r.api.setFb({ ref: () => ({ once: () => Promise.resolve({ val: () => null }),
    update: (u) => { pushed = Object.assign(pushed || {}, u); return Promise.resolve(); } }) }, 'U1');
  r.api.recSetSt('alio', '지원함');
  assert.equal(r.api.recObj('recruit_log').alio['2026'].st, '지원함');
  return new Promise((res) => setTimeout(() => {
    assert.ok(pushed, '클라우드에 올려야 다른 기기에서 보인다');
    assert.equal(pushed['recruit/log'].alio['2026'].st, '지원함');
    assert.equal(pushed['recruit/scan'].length, SCAN.length);
    assert.equal(pushed.sv, 2, '보안규칙이 sv 없는 쓰기를 막는다');
    assert.equal(pushed.feed, undefined, '⚠ 통째로 덮지 않는다 — 안 고친 공고는 안 보낸다(2026-10-04 사고)');
    assert.ok(pushed['stamp/recruit_log'].alio > 0, '고친 줄에 시각을 찍는다 — 다른 기기와 합칠 잣대');
    r.api.recSetSt('alio', '');
    assert.equal((r.api.recObj('recruit_log').alio || {})['2026'], undefined, '비우면 지운다');
    res();
  }, 2800));
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

test('★★ 받기 — 클라우드의 컨설턴트 모집 자료를 빈 기기에 되살린다', async () => {
  const r = runApp({});
  const cloud = { sv: 2, recruit: { scan: SCAN, log: { erc: { 2026: { st: '선정', at: 5 } } }, url: { erc: 'https://x.example/' },
    custom: [{ id: 'Cabc', name: '가나', kw: '가나' }], seen: { k1: 1 }, mailmap: { 'Sent Messages|1': 'cepa' }, need: { erc: ['apply'] } } };
  r.api.setFb({ ref: (p) => ({ once: () => Promise.resolve({ val: () => (p === 'gov/U1' ? cloud : null) }), update: () => Promise.resolve() }) }, 'U1');
  await r.api.cloudPull();
  assert.equal(JSON.parse(r.store.gov3_recruit_scan).length, SCAN.length);
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '선정');
  assert.equal(r.api.recObj('recruit_url').erc, 'https://x.example/');
  assert.equal(JSON.parse(r.store.gov3_recruit_custom)[0].id, 'Cabc');
  assert.equal(r.api.recObj('recruit_mailmap')['Sent Messages|1'], 'cepa');
});
test('★★★ 낡은 기기가 새 자료를 덮지 못한다 — 2026-10-04 사고(옛 판·낡은 기기가 「컨설턴트 모집」을 지웠다)', async () => {
  /* 이 기기: 어제 적은 「지원함」(시각 100). 클라우드: 오늘 PC 가 적은 「선정」(시각 200) + 마감일 */
  const r = runApp({ recruit_log: { erc: { 2026: { st: '지원함' } } },
    _stamps: { recruit_log: { erc: 100 } } });
  const cloud = { sv: 2, recruit: { log: { erc: { 2026: { st: '선정', due: '2026-12-01' } } }, scan: SCAN },
    stamp: { recruit_log: { erc: 200 }, recruit_scan: { _: 150 } } };
  const writes = [];
  r.api.setFb({ ref: (p) => ({
    once: () => Promise.resolve({ val: () => (p === 'gov/U1' ? cloud : p === 'gov/U1/recruit/log' ? cloud.recruit.log
      : p === 'gov/U1/stamp/recruit_log' ? cloud.stamp.recruit_log : null) }),
    update: (u) => { writes.push(u); return Promise.resolve(); } }) }, 'U1');
  await r.api.cloudPull();
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '선정', '더 나중에 고친 클라우드 쪽이 이긴다');
  assert.equal(r.api.recObj('recruit_log').erc['2026'].due, '2026-12-01');
  assert.equal(JSON.parse(r.store.gov3_recruit_scan).length, SCAN.length, '이 기기에 없던 칸은 받아 온다');
  writes.forEach((u) => { assert.notEqual(u['recruit/log'] && u['recruit/log'].erc['2026'].st, '지원함', '낡은 것을 올리면 안 된다'); });
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
    : Promise.resolve({ val: () => (p === 'gov_watch' ? val : null) })), update: () => Promise.resolve() }) };
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
  db.ref = ((orig) => (p) => Object.assign(orig(p), { update: (u) => { pushed = Object.assign(pushed || {}, u); return Promise.resolve(); } }))(db.ref);
  r.api.setFb(db, 'U1');
  await r.api.recWatchPull();
  r.api.recSeen('k1');
  assert.equal(r.api.recNewFor('erc'), false);
  assert.doesNotMatch(r.el('recTb').innerHTML, /🆕 새 글/);
  assert.match(r.el('recWatch').innerHTML, /새 글 <b>1건<\/b>/);
  await new Promise((res) => setTimeout(res, 2800));
  assert.ok(pushed && pushed['recruit/seen'].k1, '다른 기기에서도 봤음이 보여야 한다');
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

/* ═══ 📬 메일에서 찾은 것 + 📤 내기 전에 점검 (2026-10-04) ═══ */
const DM = (y, m, d) => new Date(y, m - 1, d, 10).getTime();
const MFOLD = {
  'INBOX-1': { slug: 'INBOX-1', name: 'INBOX', kind: 'inbox' },
  'Sent-2': { slug: 'Sent-2', name: 'Sent Messages', kind: 'sent' },
  'c3-3': { slug: 'c3-3', name: '3.컨설팅(정부사업)', kind: 'custom' },
  'pay-4': { slug: 'pay-4', name: '2.급여+사무대행', kind: 'custom' },
  'shop-5': { slug: 'shop-5', name: '쇼핑', kind: 'custom' }
};
const MSGS = {
  'Sent-2': { 1: { u: 1, s: '[권형하노무사] 지원서 입니다.', d: DM(2026, 9, 29), a: 3 } },
  'c3-3': {
    7: { u: 7, s: 'Re: [푸른노무법인] 2026년 지방공기업평가원 자문위원_인사노무 부문 응모서류 제출의 건', d: DM(2026, 1, 24), a: 0 },
    8: { u: 8, s: '2026년 지방공기업 경영평가 평가위원 선정 안내', d: DM(2026, 2, 6), a: 0 },
    9: { u: 9, s: '[세종농촌융복합산업지원센터] 농촌융복합산업 전문상담 및 현장코칭 모집 공고(~26.02.25까지)', d: DM(2026, 2, 11), a: 1 } },
  'INBOX-1': {}
};
function mailDb(o) {
  o = o || {};
  const reads = [], writes = [];
  return { reads, writes, db: { ref: (p) => ({
    once: () => { reads.push(p);
      if (o.fail) return Promise.reject(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }));
      let v = null;
      if (p === 'mailbox/folders') v = MFOLD;
      else if (p.indexOf('mailbox/msgs/') === 0) v = MSGS[p.slice(13)] || {};
      return Promise.resolve({ val: () => v }); },
    update: () => { writes.push(p); return Promise.resolve(); } }) } };
}

test('★★ 메일함 폴더는 «관련된 것만» 읽는다 — 급여·쇼핑 폴더는 안 연다', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  const m = mailDb(); r.api.setFb(m.db, 'U1');
  await r.api.recMailScan(true);
  assert.ok(m.reads.indexOf('mailbox/msgs/Sent-2') >= 0 && m.reads.indexOf('mailbox/msgs/c3-3') >= 0);
  assert.equal(m.reads.indexOf('mailbox/msgs/pay-4'), -1, '급여 폴더는 열지 않는다');
  assert.equal(m.reads.indexOf('mailbox/msgs/shop-5'), -1);
});
test('★★ 지원 메일을 찾으면 「지원함」으로 저절로 — 무엇을 근거로 적었는지 남긴다', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  const m = mailDb(); r.api.setFb(m.db, 'U1');
  await r.api.recMailScan(true);
  const c = r.api.recObj('recruit_log').erc['2026'];
  assert.equal(c.st, '지원함'); assert.equal(c.via, 'mail'); assert.equal(c.mail.date, '2026-01-24');
  assert.ok(r.toasts.some((t) => /지원 1건을 찾아 「지원함」/.test(t)));
  assert.match(r.api.recMailMark('erc', '2026'), /📨/);
  const h = r.el('recMail').innerHTML;
  assert.match(h, /저절로 적은 것 1/); assert.match(h, /recMailUndo\('erc','2026'\)/);
});
test('★★ 결과는 저절로 안 적는다 — 묻고, 누르면 적는다(마감일은 남긴다)', async () => {
  const r = runApp({ recruit_log: { erc: { 2026: { due: '2026-02-01' } } } }, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  const h = r.el('recMail').innerHTML;
  assert.match(h, /🏅 결과 메일 1/); assert.match(h, /선정 같음/);
  const key = (h.match(/recMailResult\('([^']+)','erc','선정'\)/) || [])[1];
  assert.ok(key, '선정 단추가 있어야 한다');
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '지원함', '결과는 아직 안 적었다');
  r.api.recMailResult(key, 'erc', '선정');
  const c = r.api.recObj('recruit_log').erc['2026'];
  assert.equal(c.st, '선정'); assert.equal(c.due, '2026-02-01'); assert.equal(c.via, undefined);
  assert.doesNotMatch(r.el('recMail').innerHTML, /🏅 결과 메일/, '적고 나면 다시 안 묻는다');
});
test('★ 기관 모르는 지원 메일 — 고르면 기억하고 지원함으로 적는다', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  const h = r.el('recMail').innerHTML;
  assert.match(h, /기관을 모르는 지원·결과 메일 1/);
  const key = (h.match(/recMailPick\('([^']+)',this\.value\)/) || [])[1];
  r.api.recMailPick(key, 'cepa');
  assert.equal(r.api.recObj('recruit_mailmap')[key], 'cepa');
  assert.equal(r.api.recObj('recruit_log').cepa['2026'].st, '지원함');
});
test('★★ ↩ 되돌리기 — 지우고, 같은 메일로 다시 적지 않는다', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  r.api.recMailUndo('erc', '2026');
  assert.equal(r.api.recObj('recruit_log').erc, undefined);
  await r.api.recMailScan(true);
  assert.equal((r.api.recObj('recruit_log').erc || {})['2026'], undefined, '되돌린 메일을 또 적으면 되돌리기가 소용없다');
});
test('★ 되돌려도 사람이 넣은 마감일은 남긴다', async () => {
  const r = runApp({ recruit_log: { erc: { 2026: { due: '2026-01-20' } } } }, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '지원함');
  r.api.recMailUndo('erc', '2026');
  const c = r.api.recObj('recruit_log').erc['2026'];
  assert.equal(c.due, '2026-01-20'); assert.equal(c.st, undefined); assert.equal(c.via, undefined);
});
test('★ 사람이 적은 「탈락」은 메일이 덮지 않는다', async () => {
  const r = runApp({ recruit_log: { erc: { 2026: { st: '탈락' } } } }, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '탈락');
});
test('★ 하루 한 번만 저절로 읽는다 — 12시간 안에 탭을 다시 열면 안 읽는다', async () => {
  const r = runApp({ recruit_mail_at: String(new Date('2026-10-04T08:00:00').getTime()), recruit_mailitems: [] }, { Date: FixedDate('2026-10-04T09:00:00') });
  const m = mailDb(); r.api.setFb(m.db, 'U1');
  await r.api.recMailScan(false);
  assert.equal(m.reads.length, 0);
  await r.api.recMailScan(true);
  assert.ok(m.reads.length > 0, '「다시 찾기」는 언제든 읽는다');
});
test('★★ 메일함에는 아무것도 쓰지 않는다 — 쓰는 곳은 대표 자리(gov/)뿐', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  const m = mailDb(); r.api.setFb(m.db, 'U1');
  await r.api.recMailScan(true);
  await new Promise((res) => setTimeout(res, 2800));
  assert.ok(m.writes.length >= 1);
  m.writes.forEach((p) => assert.match(p, /^gov\/U1$/, p));
  assert.doesNotMatch(src, /ref\('mailbox[^)]*\)\s*\.(set|update|push|remove)/);
});
test('★ 권한이 없으면 까닭을 말한다', async () => {
  const r = runApp({});
  r.api.setFb(mailDb({ fail: true }).db, 'U1');
  await r.api.recMailScan(true);
  assert.match(r.el('recMail').innerHTML, /메일함을 읽을 권한이 없습니다/);
});
test('★ 메일로 온 모집 공고 — 접어 두고 보여 준다', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  assert.match(r.el('recMail').innerHTML, /메일로 온 모집 공고 1/);
});

function fakeFile(name, text, size) {
  const b = Buffer.from(text || '', 'utf8');
  return { name, size: size || b.length, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)) };
}
const kordocFake = { read: async (buf) => ({ text: Buffer.from(buf).toString('utf8') }) };
test('★★ 내기 전에 점검 — 브라우저 안에서 읽어 빠진 서류·주민번호·작년 파일을 짚는다', async () => {
  const r = runApp({ recruit_scan: SCAN, recruit_log: { erc: { 2026: { due: '2026-12-31' } } } }, { Date: FixedDate('2026-12-05T09:00:00'), kordoc: kordocFake });
  r.api.recPrep('erc');
  assert.match(r.el('popBody').innerHTML, /③ 내기 전에 점검한다/);
  assert.match(r.el('popBody').innerHTML, /어디에도 보내지 않습니다/);
  await r.api.recCheckRun('erc', [fakeFile('지원서.hwp', '지원서 주민등록번호 800101-1234567 (서명)'),
    fakeFile('2025_이력서.txt', '이력서'), fakeFile('자격증.jpg', '')]);
  const h = r.el('recChkOut').innerHTML;
  assert.match(h, /빠진 서류: 경력증명서, 개인정보 동의서/);
  assert.match(h, /주민번호 1곳/);
  assert.match(h, /2025년이 적혀 있습니다/);
  assert.match(h, /그림·기타 파일/, '그림은 못 읽었다고 밝힌다');
  assert.match(h, /pu-cards\.html\?view=mail/);
});
test('★ 요구 서류를 바꾸면 점검을 다시 그린다 — 기관마다 기억한다', async () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00'), kordoc: kordocFake });
  r.api.recPrep('erc');
  await r.api.recCheckRun('erc', [fakeFile('지원서.hwp', '지원서'), fakeFile('이력서.hwp', '이력서')]);
  assert.match(r.el('recChkOut').innerHTML, /빠진 서류/);
  ['career', 'consent', 'license'].forEach((k) => r.api.recNeedTog('erc', k));
  assert.deepEqual(r.api.recNeedOf('erc').slice().sort(), ['apply', 'resume']);
  assert.match(r.el('recChkOut').innerHTML, /✅ 빠진 서류·주민번호·작년 파일이 없습니다/);
  assert.deepEqual(r.api.recObj('recruit_need').erc.slice().sort(), ['apply', 'resume']);
});
test('★ 한글 읽개가 없으면 «못 읽었다»고 말한다 — 통과로 치지 않는다', async () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  r.api.recPrep('erc');
  await r.api.recCheckRun('erc', [fakeFile('지원서.hwp', '지원서')]);
  assert.match(r.el('recChkOut').innerHTML, /한글 읽개를 싣지 못했습니다/);
});
test('★★ 점검은 파일을 «아무 데도» 보내지 않는다 — fetch·업로드·AI 없음', () => {
  const body = src.slice(src.indexOf('═══ 📤 내기 전에 점검'), src.indexOf('function recSetSt('));
  assert.ok(body.length > 1000);
  assert.doesNotMatch(body, /fetch\(|XMLHttpRequest|\.ref\(|readDoc|PuAiCall|storage\(/);
});

test('★★ 메일이 적은 것을 손으로 「선정」으로 바꾸면 — ↩ 되돌리기가 «선정»을 지우지 않는다', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  r.el('recDue').value = '';
  /* 2026 년 기록을 손으로 — recSetSt 는 «올해»(2026)를 고친다 */
  r.api.recSetSt('erc', '선정');
  const c = r.api.recObj('recruit_log').erc['2026'];
  assert.equal(c.st, '선정'); assert.equal(c.via, undefined, '손으로 정하면 «메일이 적었다» 표시를 뗀다');
  r.api.recMailUndo('erc', '2026');
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '선정');
  assert.doesNotMatch(r.el('recMail').innerHTML, /저절로 적은 것/);
});
test('★★ 메일이 적은 것을 손으로 «비우면» — 탭을 다시 열어도 「지원함」으로 안 되살아난다', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  r.api.recSetSt('erc', '');
  await r.api.recMailScan(true);
  assert.equal((r.api.recObj('recruit_log').erc || {})['2026'], undefined);
});
test('★ 덮기 전이 「지원 예정」이면 되돌리기가 그 상태로 돌려놓는다', async () => {
  const r = runApp({ recruit_log: { erc: { 2026: { st: '지원 예정' } } } }, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '지원함');
  r.api.recMailUndo('erc', '2026');
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '지원 예정');
});
test('★★ 메일 열쇠에 «.» 이 없다 — 「3.컨설팅」 폴더 하나로 클라우드 저장이 통째로 멈췄다', async () => {
  const r = runApp({}, { Date: FixedDate('2026-10-04T09:00:00') });
  r.api.setFb(mailDb().db, 'U1');
  await r.api.recMailScan(true);
  const items = JSON.parse(r.store.gov3_recruit_mailitems);
  assert.ok(items.length);
  items.forEach((it) => assert.doesNotMatch(it.key, /[.#$\/\[\]]/, it.key));
  r.api.recMailSkip('3.컨설팅(정부사업)|9');
  Object.keys(r.api.recObj('recruit_mailskip')).forEach((k) => assert.doesNotMatch(k, /[.#$\/\[\]]/, k));
});
test('★ 직접 더한 기관 — 지운 기관의 번호를 다시 쓰지 않고, 지울 때 딸린 상태·링크도 지운다', () => {
  const r = runApp({ recruit_scan: SCAN }, { prompts: ['가나기관', '가나', '', '', '다라기관', '다라', '', ''] });
  r.api.recAddOrg();
  const id1 = JSON.parse(r.store.gov3_recruit_custom)[0].id;
  r.api.recSetSt(id1, '선정');
  r.api.recDelOrg(id1);
  assert.equal(r.api.recObj('recruit_log')[id1], undefined, '지운 기관의 상태가 남으면 새 기관이 물려받는다');
  r.api.recAddOrg();
  const id2 = JSON.parse(r.store.gov3_recruit_custom)[0].id;
  assert.notEqual(id2, id1);
});
test('★★★ 받은 «뒤»에 다른 기기가 고친 것도 지킨다 — 쓰기 직전에 클라우드와 다시 합친다', async () => {
  const r = runApp({ recruit_scan: SCAN }, { Date: FixedDate('2026-12-05T09:00:00') });
  const cloud = { log: {}, stamp: {} };
  let pushed = null;
  r.api.setFb({ ref: (p) => ({
    once: () => Promise.resolve({ val: () => (p === 'gov/U1' ? null
      : p === 'gov/U1/recruit/log' ? cloud.log : p === 'gov/U1/stamp/recruit_log' ? cloud.stamp : null) }),
    update: (u) => { pushed = Object.assign(pushed || {}, u); return Promise.resolve(); } }) }, 'U1');
  await r.api.cloudPull();                                   // 이 기기가 받았다(그땐 클라우드 비었다)
  cloud.log = { erc: { 2026: { st: '선정' } } };              // 그 뒤 PC 가 「선정」을 적었다
  cloud.stamp = { erc: Date.now() + 60000 };
  r.api.recSetSt('alio', '지원함');                          // 이 기기는 다른 기관을 고친다
  await new Promise((res) => setTimeout(res, 1500));
  assert.ok(pushed && pushed['recruit/log'], '보냈어야 한다');
  assert.equal(pushed['recruit/log'].erc && pushed['recruit/log'].erc['2026'].st, '선정', 'PC 가 적은 「선정」을 덮어 지웠다');
  assert.equal(pushed['recruit/log'].alio['2026'].st, '지원함');
  assert.equal(r.api.recObj('recruit_log').erc['2026'].st, '선정', '이 기기에도 들여온다');
});
