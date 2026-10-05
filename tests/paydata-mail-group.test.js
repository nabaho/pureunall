'use strict';
/* 급여데이터함 — 메일로 온 것·확인 대기를 «묶어 보기» (대표 지시 2026-10-05)
   실행: node --test tests/paydata-mail-group.test.js

   ⚠ 왜 이 검사가 생겼나: 대표 「폰화면인데 불필요한것 너무 많다 · 화면이 너무 길어서 보기 힘들다」.
     실측 — 공용 칸 184건이 보낸 곳 39곳에서 왔고, 같은 대화(「RE: RE: …」)가 115건이었다.
     그런데 한 건에 다섯 줄씩 펼쳐 폰 한 화면에 두 건밖에 안 보였다.
     그래서 같은 곳끼리 한 줄로 묶고, 누르면 한 건에 한 줄로 편다.
     이 검사가 지키는 것: ① 묶어도 자료를 잃지 않는다(고르기·맡기는 한 건 단위)
     ② 길 때만 접는다 ③ 빼기로 한 군더더기가 돌아오지 않는다 ④ 「모두 고르기」가 실제로 고른다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(R, 'pu-paydata.html'), 'utf8');
const store = fs.readFileSync(path.join(R, 'js', 'pu-paydata-store.js'), 'utf8');
const MR = require(path.join(R, 'functions', 'mail-receive.js'));

function cut(name) {
  const m = html.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const PARTS = ['esc', 'jsq', 'canWrite', 'guessTag', 'mailRows', 'mailCtx', 'fmtBytes', 'fmtWhen',
  'pickOn', 'pickToggle', 'pickSetAll', 'pickList', 'pickAllOn', 'pickPrune', 'pickOf', 'pickPut',
  'pickBar', 'pickVisible', 'pickToggleAll', 'pickMany',
  'cleanMailTitle', 'isBodyRow', 'fileIcon', 'foldKeyOf', 'foldGroups', 'foldIsOpen', 'foldToggle',
  'lineToggle', 'monthShort', 'mailGroups', 'mailDetailHtml', 'fixBtnsHtml', 'screenMail',
  'pendTagOf', 'setPendTag', 'pendGroups', 'pendEditHtml', 'screenPending', 'pendGroupToDrawer'];

function load(app, opt) {
  opt = opt || {};
  const sb = { window: {}, console, Date, document: { getElementById: () => null } };
  sb.PuPaydataFiles = { fileKind: () => 'sheet' };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(store, { filename: 'store.js' }).runInContext(sb);
  new vm.Script([
    'const S = window.PuPaydataStore; S.init({uid:"U1", isAdmin:' + (opt.admin ? 'true' : 'false') + '});',
    'const App = ' + JSON.stringify(Object.assign({
      screen: 'mail', mail: {}, pending: {}, pendTag: {}, companies: [], allCompanies: [], dir: [], owners: {},
      pick: {}, viewingUid: '', viewingDeputy: false
    }, app)) + ';',
    'App.render = function(){ window.renders = (window.renders||0)+1; };',
    'function bannerHtml(){ return ""; } function mailScanHtml(){ return "<i id=scan></i>"; }',
    'function sumBarHtml(){ return ""; } function sumTagHtml(){ return ""; } function ownerNameOf(u){ return u; }',
    'window.bulkCalls = []; function bulkToDrawer(){ window.bulkCalls.push(Object.keys(App.pick.pending||{})); }',
    PARTS.map(cut).join('\n'),
    'window.App = App; window.S = S;',
    PARTS.map(p => 'window.' + p + ' = ' + p + ';').join('\n')
  ].join('\n'), { filename: 'app.js' }).runInContext(sb);
  return sb.window;
}

/* 서버가 만든 그 모양 그대로 */
const AT = Date.UTC(2026, 9, 3, 1);
function mailRec(o) {
  return MR.sharedPendingRecord(Object.assign(
    { filename: 'a.xlsx', file: 'x', mime: 'application/vnd.ms-excel', bytes: 94000, at: AT }, o));
}
const COS = [{ id: 'co_1', name: '가나상사', email: 'a@gana.example' }, { id: 'co_2', name: '다라식당', email: 'b@dara.example' }];

/* 보낸 곳 다섯(그중 둘은 모르는 주소) · 같은 대화 답장 셋 */
function bigMail() {
  const m = {};
  m.a1 = mailRec({ filename: '26.09월 _급여확정.xlsx', mailFrom: 'a@gana.example', companyId: 'co_1', companyName: '가나상사', kind: 'ledger', month: '2026-09' });
  m.a2 = mailRec({ filename: '9월 근태.xlsx', mailFrom: 'a@gana.example', companyId: 'co_1', companyName: '가나상사', at: AT + 1000 });
  m.b1 = mailRec({ filename: '근태.pdf', mailFrom: 'b@dara.example', companyId: 'co_2', companyName: '다라식당' });
  ['t1', 't2', 't3'].forEach((id, i) => {
    m[id] = mailRec({ filename: 'RE RE RE RE RE [푸른노무법인] 기초자료 요청.txt', mime: 'text/plain',
      mailFrom: 'hong@nowhere.example', mailSubject: 'RE: '.repeat(i + 2) + '[푸른노무법인] 기초자료 요청', at: AT + i });
  });
  m.u1 = mailRec({ filename: 'IMG_3070.jpeg', mime: 'image/jpeg', mailFrom: 'x@else.example' });
  m.c1 = mailRec({ filename: '8월 급여대장.xlsx', mailFrom: 'c@third.example', companyId: 'co_3', companyName: '마바물산' });
  return m;
}

/* ══════ 묶는 계산 ══════ */

test('★ 「RE RE RE …」 를 떼고 몇 번이었는지 센다', () => {
  const W = load();
  const t = W.cleanMailTitle('RE RE RE RE RE RE [푸른노무법인] 인사노무 기초자료 요청.txt', true);
  assert.equal(t.title, '[푸른노무법인] 인사노무 기초자료 요청');
  assert.equal(t.re, 6);
  assert.equal(W.cleanMailTitle('FW: RE: 9월 자료', false).re, 2);
});

test('「Report.xlsx」 의 Re 는 답장이 아니다 — 낱말 끝을 본다', () => {
  const W = load();
  const t = W.cleanMailTitle('Report.xlsx', false);
  assert.equal(t.title, 'Report.xlsx');
  assert.equal(t.re, 0);
});

test('★ 같은 곳은 한 묶음 · 묶음 안 같은 대화의 «본문»은 한 줄 · 파일은 따로', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS });
  const gs = W.mailGroups(W.mailRows(W.App.mail, W.mailCtx()));
  assert.equal(gs.length, 5, '보낸 곳이 다섯입니다');
  const gana = gs.filter(g => g.name === '가나상사')[0];
  assert.equal(gana.ids.length, 2);
  assert.equal(gana.lines.length, 2, '★ 서로 다른 파일을 한 줄로 합쳤습니다');
  const thread = gs.filter(g => g.unknown && g.ids.length === 3)[0];
  assert.ok(thread, '모르는 주소 묶음이 없습니다');
  assert.equal(thread.lines.length, 1, '★ 같은 대화 답장 셋이 세 줄로 남았습니다');
  assert.equal(thread.lines[0].ids.length, 3, '★ 합친 줄이 자료를 잃었습니다');
});

test('★ 묶어도 자료를 잃지 않는다 — 묶음 id 를 다 모으면 원래 건수', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS });
  const gs = W.mailGroups(W.mailRows(W.App.mail, W.mailCtx()));
  const ids = [].concat.apply([], gs.map(g => g.ids)).sort();
  assert.equal(JSON.stringify(ids), JSON.stringify(Object.keys(bigMail()).sort()));
});

test('가장 최근에 온 곳이 위로 — 새로 온 것이 묻히면 안 된다', () => {
  const W = load();
  const gs = W.foldGroups([
    { id: 'a', key: 'k1', name: '옛곳', at: 10, title: 'x' },
    { id: 'b', key: 'k2', name: '새곳', at: 99, title: 'y' }]);
  assert.equal(gs[0].name, '새곳');
});

test('★ 길 때만 접는다 — 셋 이하면 펼쳐 둔다 · 사람이 누른 것이 이긴다', () => {
  const W = load();
  assert.equal(W.foldIsOpen('mail', 'k', 3), true);
  assert.equal(W.foldIsOpen('mail', 'k', 4), false);
  W.foldToggle('mail', 'k', 4);
  assert.equal(W.foldIsOpen('mail', 'k', 4), true);
});

/* ══════ 메일 화면 ══════ */

test('★ 길면 묶음만 보인다 — 한 곳에 한 줄', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS }, { admin: true });
  const h = W.screenMail();
  assert.equal((h.match(/class="grp/g) || []).length, 5);
  assert.equal((h.match(/class="gl[" ]/g) || []).length, 0, '★ 접어 둔 줄이 그려집니다');
  assert.match(h, /5<\/b>곳 · <b>7<\/b>건/, '머리에 몇 곳·몇 건이 없습니다');
});

test('★ 빼기로 한 군더더기가 돌아오지 않는다', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS }, { admin: true });
  const h = W.screenMail();
  assert.equal(/오래된 것/.test(h), false, '★ 「오래된 것 N」 이 돌아왔습니다');
  assert.equal(/☐ 를 눌러/.test(h), false, '★ 고르기 안내문이 돌아왔습니다');
  assert.equal(/사업장을 모릅니다|월을 모릅니다/.test(h), false, '★ 「모릅니다」 칩이 돌아왔습니다');
  assert.equal(/94KB|92KB/.test(h), false, '★ 파일 크기가 목록에 다시 나옵니다');
  assert.equal(/id=scan/.test(h), false, '★ 긴 안내가 늘 펼쳐져 있습니다');
  assert.match(h, /ⓘ/);
  assert.equal(/🔁 다시 갈라 보내기/.test(h), false, '관리 단추는 ⋯ 안에 있어야 합니다');
});

test('관리 단추는 ⋯ 를 누르면 나온다 — 없어진 것이 아니다', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS, mailTools: true }, { admin: true });
  const h = W.screenMail();
  assert.match(h, /🔁 다시 갈라 보내기/);
  assert.match(h, /🧹 쌓인 것 정리/);
});

test('★ 묶음을 펴면 한 건에 한 줄 · 「답장 n」 · 아는 것만 칩', () => {
  const m = bigMail();
  const W = load({ mail: m, companies: COS, allCompanies: COS,
    foldOpen: { 'mail:co:co_1': true, 'mail:at:hong@nowhere.example': true } });
  const h = W.screenMail();
  assert.equal((h.match(/class="gl[" ]/g) || []).length, 3, '가나상사 둘 + 대화 한 줄');
  assert.match(h, /답장 \d/);
  assert.match(h, /급여대장 9월|급여대장 26\.9월/);
  assert.match(h, /종류 \?/);
  assert.equal(/RE RE RE/.test(h), false, '★ RE 가 줄에 그대로 남았습니다');
});

test('★ 줄을 누르면 예전 카드에 있던 것이 다 나온다 — 보낸이·제목·까닭·맡기', () => {
  const m = bigMail();
  const W = load({ mail: m, companies: COS, allCompanies: COS,
    foldOpen: { 'mail:co:co_1': true }, lineOpen: { a2: true } });
  const h = W.screenMail();
  assert.match(h, /a@gana\.example/);
  assert.match(h, /claimMail\('a2'\)|claimMailIds\(/);
  assert.match(h, /KB/, '자세히에는 크기도 있어야 합니다');
});

test('★ 모르는 주소 묶음에는 「✉ 잇기」 — 같은 주소 여러 건을 한 번에 잇는다', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS });
  const h = W.screenMail();
  assert.match(h, /openFixMail\('t\d'\)|openFixMail\('u1'\)/);
  assert.match(h, /✉ 잇기/);
});

test('★ 「모두 고르기」가 실제로 고른다 — 예전엔 메일 화면에서 아무것도 안 골랐다', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS });
  W.pickToggleAll('mail');
  assert.equal(Object.keys(W.App.pick.mail || {}).length, 7, '★ 모두 고르기가 빈손입니다');
});

test('「모르는 주소」 탭에서 모두 고르면 그 탭 것만', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS, mailTab: 'unk' });
  W.pickToggleAll('mail');
  assert.deepEqual(Object.keys(W.App.pick.mail).sort().join(','), 't1,t2,t3,u1');
});

test('묶음 ☐ 는 그 묶음의 자료를 한꺼번에 고르고 푼다', () => {
  const W = load({ mail: bigMail(), companies: COS, allCompanies: COS });
  W.pickMany('mail', ['a1', 'a2']);
  assert.equal(Object.keys(W.App.pick.mail).length, 2);
  W.pickMany('mail', ['a1', 'a2']);
  assert.equal(Object.keys(W.App.pick.mail).length, 0);
});

/* ══════ 확인 대기 ══════ */

function bigPend() {
  const p = {};
  const add = (id, o) => { p[id] = Object.assign({ filename: 'a.xlsx', file: 'f', at: AT, mime: 'application/vnd.ms-excel' }, o); };
  add('p1', { companyId: 'co_1', companyName: '가나상사', kind: 'ledger', month: '2026-09' });
  add('p2', { companyId: 'co_1', companyName: '가나상사' });
  add('p3', { companyId: 'co_2', companyName: '다라식당', kind: 'attend', month: '2026-09' });
  add('p4', { note: '메일 x@else.example · 사진' });
  add('p5', { note: '메일 y@other.example · 자료' });
  return p;
}

test('★ 확인 대기도 길면 묶음만 — 쓸 사람에게는 묶음 「모두 서랍으로」', () => {
  const W = load({ screen: 'pending', pending: bigPend(), companies: COS, allCompanies: COS });
  const h = W.screenPending();
  assert.equal((h.match(/class="grp/g) || []).length, 4);
  assert.match(h, /pendGroupToDrawer\(/);
  assert.equal(/id="co_p1"/.test(h), false, '★ 접어 둔 줄의 고치는 칸이 그려집니다');
});

test('★ 펼친 줄마다 「서랍으로」가 바로 있다 · 빈 것만 알린다', () => {
  const W = load({ screen: 'pending', pending: bigPend(), companies: COS, allCompanies: COS,
    foldOpen: { 'pend:co:co_1': true } });
  const h = W.screenPending();
  assert.match(h, /fileToDrawer\('p1'\)/);
  assert.match(h, /fileToDrawer\('p2'\)/);
  assert.match(h, /달·종류 \?|종류 \?/, '빈 이름표를 안 알립니다');
});

test('★ 줄을 누르면 고치는 칸이 열린다 — 칸 번호(co_·mo_·kd_)는 그대로', () => {
  const W = load({ screen: 'pending', pending: bigPend(), companies: COS, allCompanies: COS,
    foldOpen: { 'pend:co:co_1': true }, lineOpen: { p2: true } });
  const h = W.screenPending();
  ['co_p2', 'mo_p2', 'kd_p2'].forEach(k =>
    assert.match(h, new RegExp('id="' + k + '"'), '★ ' + k + ' 가 없으면 고른 값을 못 읽습니다'));
  assert.match(h, /openHand\('p2'\)/, '넘기기가 사라졌습니다');
});

test('★ 묶음 서랍으로는 「고른 것 서랍으로」 길을 그대로 탄다 — 덜 찬 것은 남기는 길', () => {
  const W = load({ screen: 'pending', pending: bigPend(), companies: COS, allCompanies: COS });
  W.pendGroupToDrawer(['p1', 'p2']);
  assert.equal(JSON.stringify(W.bulkCalls[0]), JSON.stringify(['p1', 'p2']));
});

test('남의 자리를 보는 중이면 서랍으로 단추가 없다', () => {
  const W = load({ screen: 'pending', pending: bigPend(), companies: COS, allCompanies: COS,
    viewingUid: 'U9', foldOpen: { 'pend:co:co_1': true } });
  const h = W.screenPending();
  assert.equal(/fileToDrawer\(|pendGroupToDrawer\(/.test(h), false);
});

/* ══════ 한 줄 꼴 ══════ */
test('★ 묶음 줄·펼친 줄은 한 줄이다 — 넘치면 자른다', () => {
  ['.grp{', '.gl{'].forEach(sel => {
    const i = html.indexOf(sel);
    assert.ok(i > 0, sel + ' 꼴이 없습니다');
    const rule = html.slice(i, html.indexOf('}', i));
    assert.match(rule, /white-space:nowrap/, '★ ' + sel + ' 가 두 줄로 접힐 수 있습니다');
  });
  assert.match(html, /\.gl \.gt\{[^}]*text-overflow:ellipsis/);
});

test('★ 맨 왼쪽은 ☐ + 번호 — 묶음에도, 펼친 줄에도 (대표 지시 10/5)', () => {
  const s = strip(cut('screenMail')) + strip(cut('screenPending'));
  assert.ok((s.match(/type="checkbox"/g) || []).length >= 4);
  assert.ok((s.match(/class="pkno"/g) || []).length >= 4);
});
