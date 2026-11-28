/* 정부사업 바로가기(gov-links.html · js/pu-gov-links.js) — 규칙을 못 박는다(값이 아니라)
 *
 * 대표 지시 2026-11-28 「정부 지원 사업 바로 가기 앱을 하나 만들어줘 … 지금 진행하고 있는 모든 사업들, 기업 연결 …
 *   나중에 더 늘 수도 있고 빠질 수도 있는데 … 그 사업 바로 사업 보고나 시스템 들어갈 수 있게」
 *
 * 지키는 것
 *   ① 주소는 http(s) 만 — 직원 누구나 고치는 목록이라 «누르면 스크립트가 도는 주소»가 남의 화면에서 눌리면 안 된다
 *   ② 이름이 비슷하다고 이알피 사업을 «저장하며» 잇지 않는다(온톨로지) — 제안만, 사람이 눌러야 잇는다
 *   ③ 이알피에서 진행 중인데 카드가 없는 사업은 저절로 보이고, 이어 둔 사업이 모두 종결이면 카드가 아래로 내려간다
 *   ④ 업체를 누르면 정부사업일정 보고서 창 — 컨설팅보고서와 «같은 주소 꼴», 같은 업체 수
 *   ⑤ 화면은 공용 관문(enforce)으로만 쓰고 지우기는 표식 — 규칙은 직원 읽기·쓰기, 빈 값 쓰기 막음
 * ⚠ 저장소는 공개다 — 아래 자료는 모두 지어낸 것이다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const L = require('../js/pu-gov-links.js');
const Docs = require('../js/pu-gov-report-docs.js');
const List = require('../js/pu-gov-report-list.js');
const HTML = fs.readFileSync(path.join(ROOT, 'gov-links.html'), 'utf8').replace(/\r\n/g, '\n');

/* 지어낸 이알피 사업 셋 · 정부사업일정 사업 셋 · 업체 넷 */
const YEAR = '2026';
const BIZ = { u: 1, v: [
  { code: 'c-a', name: '점검일터상생혁신컨설팅', agency: '점검재단', sortOrder: 1 },
  { code: 'c-b', name: '점검산업일자리전환', agency: '점검진흥원', sortOrder: 2 },
  { code: 'c-c', name: '점검진단컨설팅', agency: '', sortOrder: 3 },
] };
const TMAP = { 'c-a': 't1', 'c-b': 't2', 'c-c': 't3' };
const INPUT = {
  types: [{ id: 't1', name: '일터', rounds: 5 }, { id: 't2', name: '산일', rounds: 3 }, { id: 't3', name: '진단', rounds: 2 }],
  cos: [
    { id: 'k1', name: '(주)가나점검', types: ['t1'] },
    { id: 'k2', name: '(주)다라점검', types: ['t1', 't2'] },
    { id: 'k3', name: '(주)마바점검', types: ['t3'] },
    { id: 'k4', name: '(주)지운점검', types: ['t1'], deleted: true },
  ],
  scheds: [
    { id: 's1', typeId: 't1', coId: 'k1', date: YEAR + '-03-02' },
    { id: 's2', typeId: 't1', coId: 'k2', date: YEAR + '-04-02' },
    { id: 's3', typeId: 't2', coId: 'k2', date: YEAR + '-05-02' },
    { id: 's4', typeId: 't3', coId: 'k3', date: YEAR + '-06-02' },
    { id: 's5', typeId: 't1', coId: 'k4', date: YEAR + '-06-02' },
  ],
  staff: [],
};
function set(o) { return L.cleanSet(Object.assign({ id: 'gl-x', title: '점검 묶음', links: [], folders: [], bizCodes: [] }, o)).value; }

/* ── ① 주소 ── */
test('★ 주소는 http(s) 만 — 스크립트·자료·파일 주소는 «못 쓰는 주소»다', () => {
  ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'file:///C:/x', 'vbscript:x', 'ftp://a.b/c',
    'https://user:pw@a.b/', 'https://a.b/"onmouseover="x', ' ', ''].forEach((u) => {
    assert.equal(L.safeUrl(u), '', '받으면 안 되는 주소를 받았습니다: ' + u);
  });
  assert.match(L.safeUrl('https://www.kosmes.or.kr/3t/portal/Main'), /^https:\/\//);
  assert.match(L.safeUrl('http://a.or.kr/x'), /^http:\/\//);
  assert.match(L.safeUrl('www.점검.invalid/a'), /^https:\/\//, '앞에 이름만 적은 주소에는 https:// 를 붙여야 합니다');
});

test('★ 못 쓰는 주소가 섞이면 저장을 막고 «왜» 를 말한다 — 조용히 버리지 않는다', () => {
  const c = L.cleanSet({ id: 'gl-x', title: '점검', links: [{ name: '나쁜', url: 'javascript:alert(1)' }, { name: '좋은', url: 'https://a.invalid/' }] });
  assert.equal(c.ok, false);
  assert.ok(c.errors.some((e) => /주소/.test(e)), '주소 때문이라고 말해야 합니다');
  assert.ok(c.value.links.every((l) => L.safeUrl(l.url)), '다듬은 값에는 못 쓰는 주소가 남으면 안 됩니다');
});

test('★ 저장소에서 읽을 때도 다시 거른다 — 남이 콘솔로 넣은 나쁜 주소도 화면에 안 나온다', () => {
  const raw = { 'gl-x': { id: 'gl-x', title: '점검', links: [{ name: '나쁜', url: 'javascript:alert(1)' }, { name: '좋은', url: 'https://a.invalid/' }] } };
  const sets = L.liveSets(raw);
  assert.equal(sets.length, 1);
  assert.ok(sets[0].links.length >= 1);
  assert.ok(sets[0].links.every((l) => /^https?:\/\//.test(l.url)));
});

test('★ 최근 연 사이트는 «지금 목록에 있는 주소»만 — 이 기기 저장값을 믿지 않는다', () => {
  const sets = [set({ links: [{ name: '점검', url: 'https://a.invalid/' }] })];
  const raw = JSON.stringify(['javascript:alert(1)', 'https://a.invalid/', 'https://모르는.invalid/']);
  const r = L.recentList(raw, sets, 6);
  assert.deepEqual(r.map((x) => x.url), ['https://a.invalid/']);
  assert.deepEqual(L.recentList('깨진 값', sets, 6), [], '깨진 저장값이면 빈 목록이어야 합니다');
});

test('푸른 앱 열쇠는 정해 둔 것만 — 모르는 열쇠·주소는 버린다', () => {
  const v = set({ apps: ['ilteo', 'javascript:alert(1)', '__proto__', 'ilteo'] });
  assert.deepEqual(v.apps, ['ilteo']);
  L.innerApps(v).forEach((a) => assert.match(a.url, /^[a-z0-9-]+\.html$/, '푸른 앱은 같은 집 화면 주소여야 합니다'));
  /* 정해 둔 앱은 포털에 실제로 있는 화면이어야 한다 — 없는 앱을 가리키면 눌러도 갈 데가 없다 */
  const portal = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  L.INNER_KEYS.forEach((k) => assert.ok(portal.includes("url:'" + L.INNER[k].url + "'"), k + ' 앱이 포털에 없습니다'));
});

/* ── ② 기본 목록 · 연결 제안 ── */
test('★ 기본 목록은 «쓸 수 있는 주소»만 있고, 이알피 사업을 미리 잇지 않는다(사람이 골라야 잇는다)', () => {
  const defs = L.defaultSets();
  assert.ok(defs.length >= 2, '기본 목록이 비었습니다');
  const ids = new Set();
  defs.forEach((d) => {
    assert.ok(L.okId(d.id), '묶음 번호가 규칙 꼴이 아닙니다: ' + d.id);
    assert.ok(!ids.has(d.id), '기본 묶음 번호가 겹칩니다: ' + d.id); ids.add(d.id);
    assert.ok(L.cleanSet(d).ok, d.id + ' 기본 묶음이 저장 검사를 못 지납니다');
    assert.deepEqual(d.bizCodes, [], '기본 묶음이 이알피 사업을 미리 이었습니다 — 이름으로 짐작한 관계는 저장하지 않습니다');
    assert.ok(!('match' in d), '제안 낱말(match)이 저장값에 섞였습니다');
  });
  /* 아이디·비밀번호 칸이 생기지 않았는가 */
  const keys = new Set(defs.flatMap((d) => Object.keys(d).concat(d.links.flatMap((l) => Object.keys(l)))));
  ['id', 'password', 'pw', 'userId', 'loginId'].filter((k) => k !== 'id').forEach((k) => assert.ok(!keys.has(k), k + ' 칸이 생겼습니다'));
});

test('★ 연결 제안은 «보이기만» 한다 — 판을 만들어도 묶음의 bizCodes 는 그대로다', () => {
  const s = L.cleanSet(Object.assign({}, L.DEFAULTS.find((d) => d.match.indexOf('일터혁신') >= 0) || L.DEFAULTS[0], { order: 10 })).value;
  const before = JSON.stringify(s);
  const biz = { v: [{ code: 'c-a', name: '일터혁신 상생컨설팅', agency: '점검재단' }] };
  const b = L.board({ sets: [s], biz, tmap: {}, input: {}, state: {}, year: YEAR });
  assert.equal(JSON.stringify(s), before, '판 만들기가 묶음을 바꿨습니다');
  assert.ok(b.cards[0].suggest.indexOf('c-a') >= 0, '낱말이 맞는 사업을 제안하지 않았습니다');
  assert.deepEqual(b.cards[0].programs, [], '제안한 사업이 이어진 것처럼 업체가 붙었습니다');
  const closedBoard = L.board({ sets: [s], biz, tmap: {}, input: {}, state: { 'c-a': { closedFrom: '2000' } }, year: YEAR });
  assert.deepEqual(closedBoard.cards[0].suggest, [], '이미 종결된 사업은 연결 제안에 나오면 안 됩니다');
});

/* ── ③④ 판 ── */
test('★ 이알피에서 진행 중인데 카드가 없는 사업은 «바로가기 없는 진행 사업»으로 저절로 나온다 — 종결은 빼고', () => {
  const s = set({ bizCodes: ['c-a'] });
  const b = L.board({ sets: [s], biz: BIZ, tmap: TMAP, input: INPUT, state: { 'c-c': { closedFrom: '2000' } }, year: YEAR });
  const bare = b.bare.map((p) => p.code);
  assert.ok(bare.indexOf('c-b') >= 0, '카드 없는 진행 사업이 안 보입니다');
  assert.ok(bare.indexOf('c-a') < 0, '카드에 이은 사업이 «카드 없음»에 또 나왔습니다');
  assert.ok(bare.indexOf('c-c') < 0, '종결된 사업이 진행 사업에 나왔습니다');
});

test('★ 이어 둔 사업이 «모두» 종결이면 카드는 종결된 사업으로 내려간다 — 하나라도 진행이면 그대로', () => {
  const allClosed = set({ id: 'gl-a', bizCodes: ['c-c'] });
  const mixed = set({ id: 'gl-b', bizCodes: ['c-a', 'c-c'] });
  const plain = set({ id: 'gl-c', bizCodes: [] });
  const b = L.board({ sets: [allClosed, mixed, plain], biz: BIZ, tmap: TMAP, input: INPUT, state: { 'c-c': { closedFrom: '2000' } }, year: YEAR });
  assert.deepEqual(b.closed.map((c) => c.set.id), ['gl-a']);
  assert.deepEqual(b.cards.map((c) => c.set.id).sort(), ['gl-b', 'gl-c'], '이음이 없는 카드·진행이 섞인 카드는 위에 남아야 합니다');
  /* 되돌린 사업(9999)은 종결이 아니다 */
  const re = L.board({ sets: [allClosed], biz: BIZ, tmap: TMAP, input: INPUT, state: { 'c-c': { closedFrom: '9999' } }, year: YEAR });
  assert.equal(re.closed.length, 0, '되돌린 사업을 종결로 봤습니다');
});

test('★ 업체 수는 컨설팅보고서(PuGovReportDocs.pairs)와 같다 — 지운 업체는 빠진다', () => {
  const s = set({ bizCodes: ['c-a'] });
  const b = L.board({ sets: [s], biz: BIZ, tmap: TMAP, input: INPUT, state: {}, year: YEAR });
  const p = b.cards[0].programs[0];
  assert.equal(p.companies.length, Docs.pairs(INPUT, 't1', YEAR).length);
  assert.ok(p.companies.every((c) => c.coName.indexOf('지운') < 0), '지운 업체가 붙었습니다');
});

test('★ 업체를 누르면 정부사업일정 보고서 창 — 컨설팅보고서와 같은 주소 꼴', () => {
  ['k1', '업체 공백', 'a|b'].forEach((co) => {
    assert.equal(L.reportHref(co, 't1'), List.reportHref(co, 't1'), '컨설팅보고서와 다른 주소를 만들었습니다: ' + co);
  });
  const b = L.board({ sets: [set({ bizCodes: ['c-a'] })], biz: BIZ, tmap: TMAP, input: INPUT, state: {}, year: YEAR });
  b.cards[0].programs[0].companies.forEach((c) => assert.match(c.href, /^gov-consulting\.html#rpt=/));
});

test('이알피 자료를 못 읽어도(사업 목록 없음) 카드는 그대로 선다 — 업체 칸만 빈다', () => {
  const b = L.board({ sets: [set({ bizCodes: ['c-a'], links: [{ name: '점검', url: 'https://a.invalid/' }] })], biz: null, tmap: null, input: {}, state: {}, year: YEAR });
  assert.equal(b.cards.length, 1);
  assert.equal(b.cards[0].set.links.length, 1);
  assert.equal(b.bare.length, 0);
});

test('찾기 — 업체 이름으로 찾아도 그 사업 카드가 나온다', () => {
  const b = L.board({ sets: [set({ id: 'gl-a', bizCodes: ['c-a'] }), set({ id: 'gl-b', title: '다른 묶음' })], biz: BIZ, tmap: TMAP, input: INPUT, state: {}, year: YEAR });
  const hit = L.filterCards(b.cards, '가나점검');
  assert.deepEqual(hit.map((x) => x.card.set.id), ['gl-a']);
  assert.equal(L.filterCards(b.cards, '').length, 2, '빈 찾기는 모두 보여야 합니다');
});

test('순서 바꾸기는 바뀌는 묶음만 돌려준다 — 끝에서 더 못 가면 아무것도 안 바꾼다', () => {
  const sets = [set({ id: 'gl-a', order: 10 }), set({ id: 'gl-b', order: 20 }), set({ id: 'gl-c', order: 30 })];
  const ch = L.moveOrder(sets, 'gl-b', -1);
  assert.ok(ch.length >= 1);
  const ord = {}; sets.forEach((s) => { ord[s.id] = s.order; }); ch.forEach((c) => { ord[c.id] = c.order; });
  assert.ok(ord['gl-b'] < ord['gl-a'], '위로 올린 묶음이 위로 가지 않았습니다');
  assert.deepEqual(L.moveOrder(sets, 'gl-a', -1), []);
  assert.deepEqual(L.moveOrder(sets, 'gl-c', 1), []);
});

/* ── ⑤ 화면·규칙 ── */
test('★ 화면은 공용 관문(enforce)으로만 쓴다 — 직접 set·update·remove 를 하지 않는다', () => {
  const code = HTML.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /createGateway\(\{\s*mode:'enforce'/, '관문을 강제 모드로 만들지 않았습니다');
  assert.ok(!/\.ref\([^)]*\)\.(set|update|remove|push)\(/.test(code), '저장소에 직접 쓰는 자리가 있습니다 — gate.save·gate.remove 로만 씁니다');
  assert.match(code, /gate\.remove\(/, '지우기가 표식(gate.remove)이 아닙니다');
  assert.ok(!/ref\('govlinks/.test(code), '자리를 글자 그대로 부릅니다 — 이름 표(GL_NODES)로 부릅니다');
  assert.ok(!/ref\('scal_/.test(code), '빌려 읽는 자리를 글자 그대로 부릅니다 — 이름 표(GL_ERP)로 부릅니다');
  assert.ok(!/\sonclick=/.test(code), '인라인 onclick 이 있습니다 — data-act 한 곳에서 받습니다');
});

test('★ 고친 것은 «고치기 시작한 때»의 수정차수로 저장한다 — 그 사이 남이 고친 것을 새로 읽은 판으로 덮지 않는다', () => {
  const code = HTML.replace(/\/\*[\s\S]*?\*\//g, '');
  const fn = /async function saveSet\(value, base\)\{[\s\S]*?\n\}/.exec(code);
  assert.ok(fn, 'saveSet(value, base) 를 못 찾았습니다 — 저장이 «시작한 때의 차수»를 받아야 합니다');
  assert.ok(!/D\.raw/.test(fn[0]), '저장 직전에 새로 읽은 판(D.raw)의 차수를 쓰면 남의 수정을 조용히 덮습니다');
  assert.match(fn[0], /expectedRevision:exp/);
  /* 고치기 창 저장은 창을 연 때의 차수를 넘긴다 */
  assert.match(code, /saveSet\(s, base\)/);
});

test('★ 사이트 주소는 «다듬은 묶음»에서만 그린다 — 화면이 바깥 값을 href 에 바로 넣지 않는다', () => {
  /* 화면이 쓰는 묶음은 liveSets·defaultSets(→ cleanSet → safeUrl)를 지난 것뿐이어야 한다 */
  assert.match(HTML, /D\.sets=D\.empty\?L\.defaultSets\(\):L\.liveSets\(D\.raw\)/);
  assert.match(HTML, /href="'\+esc\(l\.url\)\+'"/, '사이트 주소를 esc 없이 그립니다');
  assert.match(HTML, /rel="noopener noreferrer"/, '바깥 사이트를 noopener 없이 엽니다');
});

test('★ 규칙 — 재직 직원 읽기·쓰기 · 빈 값 쓰기(지우기) 막음 · 열쇠와 id 같음 · 이름 한도는 화면과 같다', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const r = JSON.parse(out).rules.govlinks;
  assert.ok(r, 'govlinks 규칙이 없습니다');
  assert.match(r['.read'], /status'\)\.val\(\) === 'active'/, '읽기가 재직 직원이 아닙니다');
  assert.ok(!('.write' in r), '뿌리째 쓰기를 열었습니다 — 통째 덮어쓰기를 막아야 합니다');
  /* ★ 즐겨찾기 — 쓰기는 본인(사번)만. 읽기는 뿌리의 직원 읽기(뿌리 읽기를 걷으면 rules-deploy 가 «사라지는 규칙»으로 멈춘다) */
  const st = r.stars && r.stars.$sid;
  assert.ok(st, '★ 즐겨찾기 자리(stars/$sid) 규칙이 없습니다');
  assert.match(st['.write'], /child\('sid'\)\.val\(\) === \$sid/, '★ 쓰기가 «본인 사번»으로 막혀 있지 않습니다');
  assert.match(st['.write'], /newData\.exists\(\)/);
  assert.match(st['.validate'], /newData\.child\('id'\)\.val\(\) === \$sid/);
  const w = r.sets.$id['.write'], v = r.sets.$id['.validate'];
  assert.match(w, /newData\.exists\(\)/, '빈 값 쓰기(물리 삭제)를 막지 않습니다');
  assert.match(v, /newData\.child\('id'\)\.val\(\) === \$id/);
  const lim = /title'\)\.val\(\)\.length <= (\d+)/.exec(v);
  assert.ok(lim, '이름 한도가 규칙에 없습니다');
  assert.equal(Number(lim[1]), L.LIMIT.title, '규칙과 화면의 이름 한도가 다릅니다 — 한쪽만 바꾸면 화면이 만든 묶음을 규칙이 거절합니다');
});

test('포털·앱 막대·온톨로지에 같은 열쇠로 올라 있다', () => {
  const portal = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  assert.match(portal, /key:'govlinks'[^}]*url:'gov-links\.html'/);
  const O = require('../js/pu-ontology.js');
  const P = (O.PROGRAMS || (O.PuOntology && O.PuOntology.PROGRAMS)).govlinks;
  assert.ok(P, '온톨로지 PROGRAMS 에 govlinks 가 없습니다');
  assert.equal(P.file, 'gov-links.html');
  assert.ok(P.writeContracts.some((c) => c.path === 'govlinks/sets/{id}' && c.entityType === L.ENTITY));
  assert.ok(P.writeContracts.some((c) => c.path === 'govlinks/stars/{sid}' && c.entityType === L.STAR_ENTITY), '★ 즐겨찾기 쓰기 계약이 없습니다');
  assert.ok(O.TERMS && Object.keys(O.TERMS).some((k) => /GovLinkStar/.test(k) || (O.TERMS[k] && O.TERMS[k].GovLinkStar)), '온톨로지 낱말에 GovLinkStar 가 없습니다');
});

/* ── 대시보드 판(대표 지시 2026-11-28 「왼쪽에 대시보드 … 별표 표시해서 상단에 자주 하는 거」) ── */
test('★ 즐겨찾기는 사업·사이트 둘 다 — 누른 차례를 지키고, 못 쓰는 주소·모르는 열쇠는 버린다', () => {
  let s = L.setStar({}, 'items', 'gl-b', true);
  s = L.setStar(s, 'items', 'erp:c-a', true);
  s = L.setStar(s, 'items', 'gl-a', true);
  assert.deepEqual(s.items, ['gl-b', 'erp:c-a', 'gl-a'], '누른 차례가 아닙니다');
  assert.deepEqual(L.setStar(s, 'items', 'erp:c-a', false).items, ['gl-b', 'gl-a']);
  assert.deepEqual(L.setStar({}, 'links', 'javascript:alert(1)', true).links, [], '못 쓰는 주소를 ★ 로 받았습니다');
  assert.deepEqual(L.cleanStars({ items: ['__proto__', 'erp:../x', 'gl-a', 'gl-a'], links: ['https://a.invalid/', 'data:x'] }),
    { items: ['gl-a'], links: ['https://a.invalid/'] });
  const before = JSON.stringify(s);
  L.setStar(s, 'items', 'gl-z', true);
  assert.equal(JSON.stringify(s), before, '받은 ★ 값을 바꿨습니다');
});

test('★ 대시보드 — ★ 은 거르기(찾기·KPI)와 상관없이 늘 맨 위, 지금 목록에 없는 ★ 사이트는 안 보인다', () => {
  const sets = [set({ id: 'gl-a', title: '점검 가', bizCodes: ['c-a'], links: [{ name: '가 로그인', url: 'https://a.invalid/', login: true }] }),
    set({ id: 'gl-b', title: '점검 나', links: [{ name: '나 홈', url: 'https://b.invalid/' }] })];
  const b = L.board({ sets, biz: BIZ, tmap: TMAP, input: INPUT, state: {}, year: YEAR });
  const stars = { items: ['gl-b', 'erp:c-b'], links: ['https://b.invalid/', 'https://없어진.invalid/'] };
  const m = L.dashModel({ board: b, stars, q: '없는낱말', kf: 'login' });
  assert.deepEqual(m.fav.map((r) => r.key), ['gl-b', 'erp:c-b'], '찾기·거르기가 ★ 사업을 숨겼습니다');
  assert.deepEqual(m.favLinks.map((l) => l.url), ['https://b.invalid/'], '없어진 주소가 ★ 에 남았거나 있는 것이 빠졌습니다');
  assert.equal(m.sets.length, 0, '찾기 글에 안 맞는 사업이 남았습니다');
  const all = L.dashModel({ board: b, stars });
  assert.deepEqual(all.sets.map((r) => r.key), ['gl-a', 'gl-b']);
  assert.ok(all.bare.some((r) => r.key === 'erp:c-b' && r.title && r.org !== undefined), '바로가기 없는 이알피 사업이 대시보드에 없습니다');
  assert.equal(L.dashModel({ board: b, stars: {}, kf: 'login' }).sets.map((r) => r.key).join(), 'gl-a', '«로그인» 거르기가 안 걸렸습니다');
  const found = L.dashModel({ board: b, stars: {}, q: '로그인' }).found;
  assert.deepEqual(found.map((l) => l.url), ['https://a.invalid/'], '찾은 사이트가 맞지 않습니다');
});

test('처음 보일 사업 — 전에 보던 것 → ★ 첫 사업 → 첫 묶음', () => {
  const b = L.board({ sets: [set({ id: 'gl-a' }), set({ id: 'gl-b' })], biz: null, input: {}, state: {}, year: YEAR });
  assert.equal(L.pickDefault(L.dashModel({ board: b, stars: {} }), 'gl-b'), 'gl-b');
  assert.equal(L.pickDefault(L.dashModel({ board: b, stars: { items: ['gl-b'] } }), '없는것'), 'gl-b');
  assert.equal(L.pickDefault(L.dashModel({ board: b, stars: {} }), ''), 'gl-a');
});

test('할 일·순서는 줄바꿈을 살리고, 사이트마다 «여기서 하는 일» 한 줄을 둔다', () => {
  const v = set({ note: '① 로그인\r\n② 수행일지\u0007 올리기', links: [{ name: '가', url: 'https://a.invalid/', memo: '수행일지 올리는 곳' }, { name: '나', url: 'https://b.invalid/', memo: '   ' }] });
  assert.equal(v.note, '① 로그인\n② 수행일지  올리기', '줄바꿈은 살리고 다른 제어 글자는 빈칸으로 바꿔야 합니다');
  assert.equal(v.links[0].memo, '수행일지 올리는 곳');
  assert.ok(!('memo' in v.links[1]), '빈 메모를 칸째 남겼습니다');
});

test('★ 사이트는 «한 번 누르면 바로» — 팝업창은 opener 를 끊고 주소로 보낸다, 막히면 새 탭', () => {
  const code = HTML.replace(/\/\*[\s\S]*?\*\//g, '');
  const fn = /function openSite\(url, mode\)\{[\s\S]*?\n\}/.exec(code);
  assert.ok(fn, 'openSite 를 못 찾았습니다');
  assert.match(fn[0], /L\.safeUrl\(url\)/, '열기 직전에 주소를 다시 거르지 않습니다');
  assert.match(fn[0], /window\.open\('about:blank'/, '팝업창을 빈 창으로 먼저 열지 않습니다(opener 를 끊기 전에 사이트가 뜬다)');
  assert.match(fn[0], /win\.opener=null/);
  assert.match(fn[0], /noopener/, '새 탭(또는 막혔을 때)은 noopener 로 열어야 합니다');
  /* 사이트를 누르면 고른 방식으로 바로 연다 — Ctrl·가운데 단추는 브라우저 그대로 */
  assert.match(code, /openSite\(site\.getAttribute\('href'\), OPMODE\)/);
});
