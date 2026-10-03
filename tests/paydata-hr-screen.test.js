'use strict';
/* 급여데이터함 「📋 입퇴사 할 일」 화면 (대표 승인 2026-10-03 ㉠)
   실행: node --test tests/paydata-hr-screen.test.js

   셈은 js/pu-hr-intake.js (tests/hr-intake.test.js) — 여기는 «화면에 이어졌는가»를 본다.
   화면 함수를 HTML 에서 잘라 실제로 돌린다(paydata-two-pane.test.js 와 같은 방식).
   ⚠ 예시 이름은 가짜다. ⚠ 상자 안에서 만든 배열은 deepEqual 이 튕긴다 — join 으로 견준다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(R, 'pu-paydata.html'), 'utf8');
const STORE_SRC = fs.readFileSync(path.join(R, 'js', 'pu-paydata-store.js'), 'utf8');
const HR_SRC = fs.readFileSync(path.join(R, 'js', 'pu-hr-intake.js'), 'utf8');
const RULES_SRC = fs.readFileSync(path.join(R, 'scripts', 'make-firebase-rules.js'), 'utf8');

function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}
/* 주석을 걷은 소스 — 잘 쓴 주석이 검사를 통과시키지 않게 */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
}

const at = (y, m, d) => new Date(y, m - 1, d, 10, 0, 0).getTime();
const NOW = at(2026, 10, 3);

const COS = [   // 급여 명단
  { id: 'c1', name: '가나상사', managerMain: 'p-001', managerSubs: [], typeCode: '급여', status: 'active' },
  { id: 'c4', name: '라마식품', managerMain: 'p-002', managerSubs: [], typeCode: '급여', status: 'active' }
];
const ALL = COS.concat([   // 사무대행 — 급여 명단 밖이지만 입퇴사 신고는 우리 일이다
  { id: 's1', name: '나다물산', managerMain: 'p-001', managerSubs: [], typeCode: '자문', status: 'suboffice' }
]);
const LOG = {
  m1: { at: at(2026, 10, 2), companyId: 'c1', companyName: '가나상사', from: 'a@gana.example', subject: '9/30 퇴사자 홍길동 상실신고 요청', preview: '' },
  m2: { at: at(2026, 10, 1), companyId: 's1', companyName: '나다물산', from: 'b@nada.example', subject: '입사자 김철수 서류 송부', preview: '' },
  m3: { at: at(2026, 10, 2), companyId: 'c4', companyName: '라마식품', from: 'c@rama.example', subject: '문의', preview: '이번 달 한 명 그만둔다고 합니다' },
  m4: { at: at(2026, 10, 2), companyId: 'c1', companyName: '가나상사', from: 'a@gana.example', subject: '9월 근태내역', preview: '' },
  /* 남의 사업장에도 «확실한» 할 일이 하나 있어야 「내 것만 센다」를 검사가 지킨다 */
  m5: { at: at(2026, 10, 2), companyId: 'c4', companyName: '라마식품', from: 'c@rama.example', subject: '입사자 이몽룡 서류', preview: '' }
};

function load(isAdmin) {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script('Date.now = function(){ return ' + NOW + '; };', { filename: 'clock.js' }).runInContext(sandbox);
  new vm.Script(STORE_SRC, { filename: 'store.js' }).runInContext(sandbox);
  new vm.Script(HR_SRC.replace("typeof self !== 'undefined' ? self : this", 'window'), { filename: 'hr.js' }).runInContext(sandbox);
  const stubs = `
    const S = window.PuPaydataStore; S.init({ uid: 'U1', isAdmin: ${!!isAdmin} });
    const HR = window.PuHrIntake;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
    const jsq = s => esc(String(s == null ? '' : s).replace(/'/g, "\\\\'"));
    const thisMonth = () => '2026-10';
    const fmtWhen = at => String(at);
    var App = { month: '2026-10', me: { email: 'p001@pureun.kr', uid: 'U1' }, myName: '김대표',
      companies: ${JSON.stringify(COS)}, allCompanies: ${JSON.stringify(ALL)},
      hrLog: ${JSON.stringify(LOG)}, hrKind: {}, hrState: {}, hrRev: 1, hrShowDone: false, hrOpenMail: '', hrPick: null };
    let _hrMemo = { rev: -1, tasks: [], by: {} };
  `;
  const fns = ['companyDocCount', 'coArrivedAt', 'sideViewModel', 'sideListModel', 'hrModel', 'hrCompany', 'hrCan',
    'hrLeftText', 'hrMd', 'hrPillsHtml', 'hrCardHtml', 'hrMailPeekHtml'].map(cut).join('\n');
  new vm.Script(stubs + fns + `
    window.M = { sideViewModel, sideListModel, hrModel, hrPillsHtml, hrCardHtml, App };`,
    { filename: 'screen.js' }).runInContext(sandbox);
  return sandbox.window.M;
}
function ctx(M, isAdmin) {
  return { companies: COS, allCompanies: ALL, dir: [{ sid: 'p-001', name: '김대표' }, { sid: 'p-002', name: '박노무' }],
    owners: { U1: { name: '김대표', email: 'p001@pureun.kr' } }, arrivals: {}, shares: {},
    myEmail: 'p001@pureun.kr', myUid: 'U1', month: '2026-10', now: NOW, todayStart: NOW, isAdmin: !!isAdmin,
    hrBy: M.hrModel().by };
}

/* ── 왼쪽 보기 ── */
test('「📋 입퇴사 할 일」 숫자는 내 담당의 «안 끝난 사람 수»다 — 사무대행 사업장까지', () => {
  const M = load(false);
  const v = M.sideViewModel(ctx(M, false)).views.filter(x => x.key === 'hr')[0];
  assert.ok(v, '보기가 있어야 한다');
  assert.equal(v.n, 2, 'c1 퇴사 1 + s1(사무대행) 입사 1 — c4 는 남의 것이라 안 센다');
});

test('★ 「전체 입퇴사」는 관리자에게만', () => {
  const keys = M => M.sideViewModel(ctx(M, false)).views.map(x => x.key).join(',');
  assert.ok(!keys(load(false)).includes('allhr'));
  const A = load(true);
  assert.ok(A.sideViewModel(ctx(A, true)).views.map(x => x.key).includes('allhr'));
  /* 계산 층에서도 막는다 — 앞서 고른 보기가 상태에 남아 있어도 */
  const L = load(false).sideListModel('allhr', ctx(load(false), false), {});
  assert.notEqual(L.view, 'allhr');
});

test('입퇴사 보기 목록 — 할 일 있는 곳만, 기한 이른 곳부터, 급여 명단 밖 사무대행도', () => {
  const M = load(false);
  const L = M.sideListModel('hr', ctx(M, false), {});
  assert.equal(L.rows.map(r => r.id).join(','), 'c1,s1', '퇴사(기한 10/14)가 입사(10/14)보다 늦지 않다 — 이른 것부터');
  assert.ok(L.rows.every(r => r.hr && (r.hr.in + r.hr.out) > 0));
});

test('사업장 줄에는 할 일 수가 붙는다 — 다른 보기에서도', () => {
  const M = load(false);
  const L = M.sideListModel('mine', ctx(M, false), {});
  const c1 = L.rows.filter(r => r.id === 'c1')[0];
  assert.ok(c1.hr && c1.hr.out === 1);
});

/* ── 사업장 줄 꼬리 ── */
test('줄 꼬리 — 입사·퇴사 수, 기한은 일주일 안일 때만, 지나면 빨갛게', () => {
  const M = load(false);
  assert.equal(M.hrPillsHtml(null), '');
  const h = M.hrPillsHtml({ in: 1, out: 2, left: 2 });
  assert.match(h, /입사 1/);
  assert.match(h, /퇴사 2/);
  assert.match(h, /D-2/);
  assert.doesNotMatch(M.hrPillsHtml({ in: 1, out: 0, left: 20 }), /D-/, '멀면 안 그린다(줄만 먹는다)');
  assert.match(M.hrPillsHtml({ in: 0, out: 1, left: -3 }), /late[\s\S]*3일 지남/);
});

/* ── 서랍 카드 ── */
test('서랍 맨 위 — 할 일과 이번 달 메일, 담당이면 「처리 완료」', () => {
  const M = load(false);
  const h = M.hrCardHtml('c1');
  assert.match(h, /입퇴사 할 일/);
  assert.match(h, /상실신고/);
  assert.match(h, /처리 완료/);
  assert.match(h, /홍길동/);
  assert.match(h, /이번 달 들어온 메일/);
  assert.match(h, /급여자료/, '근태 메일에 꼬리표');
});

test('★ 남의 사업장은 보기만 — 단추가 없다', () => {
  const M = load(false);
  const h = M.hrCardHtml('c4');
  assert.doesNotMatch(h, /처리 완료/);
  assert.doesNotMatch(h, /hrAccept/, '짐작 「맞음」 도 못 누른다');
  assert.match(h, /짐작/, '짐작은 보인다');
});

test('관리자는 남의 사업장 짐작도 확정할 수 있다', () => {
  const A = load(true);
  assert.match(A.hrCardHtml('c4'), /hrAccept/);
});

test('★ 안 정한 짐작은 달이 바뀌어도 보인다 — 지난달 끝에 온 「그만둔다」가 묻히지 않는다', () => {
  const M = load(true);
  M.App.hrLog = Object.assign({}, M.App.hrLog, {
    m9: { at: at(2026, 9, 30), companyId: 'c4', companyName: '라마식품', from: 'c@rama.example', subject: '부탁', preview: '한 명 그만둔다고 합니다' },
    m8: { at: at(2026, 9, 29), companyId: 'c4', companyName: '라마식품', from: 'c@rama.example', subject: '9월 근태내역', preview: '' }
  });
  M.App.hrRev++;
  const h = M.hrCardHtml('c4');   // 지금 보는 달은 10월
  assert.match(h, /부탁/, '지난달 짐작 메일');
  assert.doesNotMatch(h, /9월 근태내역/, '지난달 «확실한» 메일은 그 달 화면에서 본다');
});

test('말할 것이 없으면 자리도 안 먹는다', () => {
  const M = load(false);
  assert.equal(M.hrCardHtml('없는곳'), '');
});

test('★ 처리한 것은 접히고 「끝난 것 n」 으로만 보인다', () => {
  const M = load(false);
  M.App.hrState = { [require(path.join(R, 'js', 'pu-hr-intake.js')).taskId('m1', 'out')]: { doneAt: NOW, doneBy: '김대표' } };
  M.App.hrRev++;
  const h = M.hrCardHtml('c1');
  assert.doesNotMatch(h, /처리 완료/);
  assert.match(h, /끝난 것 1/);
  assert.match(h, /남은 할 일이 없습니다/);
});

/* ── 이어진 자리 (주석을 걷고 본다) ── */
test('★ 서랍·사업장 줄·첫 화면에 이어져 있다', () => {
  const src = code(HTML);
  assert.match(cut('screenDrawer'), /hrCardHtml\(App\.companyId\)/);
  assert.match(code(cut('colListHtml')), /hrPillsHtml\(r\.hr\)/);
  assert.match(code(cut('loadSites')), /loadHr\(\)/);
  assert.match(src, /js\/pu-hr-intake\.js\?v=\d+/);
});

test('★ 메일 기록은 «최근 것만» 받는다 — 통째로 받지 않는다', () => {
  const s = code(cut('loadHr'));
  assert.match(s, /paydata\/maillog'\)\.orderByChild\('at'\)\.startAt\(/);
  assert.match(code(RULES_SRC), /maillog:\s*\{[^}]*'\.indexOn':\s*\['at'\]/, '색인이 없으면 통째로 내려받는다');
});

/* ── 실제로 적어 본다 — 가짜 서버 ──
   파이어베이스 거래의 진짜 차례를 흉내 낸다(memory: rtdb-transaction-cold-abort):
   ① 손안의 값 null 로 먼저 부른다 ② 거기서 접으면(undefined) 서버에 묻지도 않고 끝난다
   ③ 값을 돌려주면 «서버의 진짜 값»으로 한 번 더 부르고 그 답을 적는다.
   ⚠ 첫 부름부터 진짜 값을 주는 흉내는 «찬 자리에서 접히는» 고장을 하나도 못 잡는다. */
function writeWorld(server) {
  const store = Object.assign({}, server || {});
  const db = { ref(p) { return {
    transaction(fn) {
      const first = fn(null);
      if (first === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => store[p] } });
      const real = store[p] === undefined ? null : JSON.parse(JSON.stringify(store[p]));
      const next = real === null ? first : fn(real);
      if (next === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => store[p] } });
      store[p] = JSON.parse(JSON.stringify(next));
      return Promise.resolve({ committed: true, snapshot: { val: () => store[p] } });
    }
  }; } };
  return { db, store };
}
function loadWriters(isAdmin, world) {
  const sandbox = { window: {}, console, alert: () => {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script('Date.now = function(){ return ' + NOW + '; };').runInContext(sandbox);
  new vm.Script(STORE_SRC).runInContext(sandbox);
  new vm.Script(HR_SRC.replace("typeof self !== 'undefined' ? self : this", 'window')).runInContext(sandbox);
  sandbox.db = world.db;
  new vm.Script(`
    const S = window.PuPaydataStore; S.init({ uid: 'U1', isAdmin: ${!!isAdmin} });
    const HR = window.PuHrIntake;
    var App = { month: '2026-10', me: { email: 'p001@pureun.kr', uid: 'U1' }, myName: '김대표',
      companies: ${JSON.stringify(COS)}, allCompanies: ${JSON.stringify(ALL)},
      hrLog: ${JSON.stringify(LOG)}, hrKind: {}, hrState: {}, hrRev: 1, hrPick: null, render() {} };
    let _hrMemo = { rev: -1, tasks: [], by: {} };
    ${['hrModel', 'hrCompany', 'hrCan', 'hrWho', 'hrWrite', 'hrTask', 'hrDone', 'hrConfirm'].map(cut).join('\n')}
    window.W = { hrDone, hrConfirm, hrModel, App };`).runInContext(sandbox);
  return sandbox.window.W;
}
const settle = () => new Promise(r => setImmediate(r));

test('★ 꼬리표는 «글자»로 적힌다 — 「해당 없음」이 빈 배열로 버려지지 않는다', async () => {
  const w = writeWorld();
  const W = loadWriters(false, w);
  W.hrConfirm('m1', []);
  await settle();
  const saved = w.store['paydata/mailkind/m1'];
  assert.ok(saved, '적혀야 한다');
  assert.equal(typeof saved.kinds, 'string', '배열이면 파이어베이스가 빈 것을 버린다');
  assert.equal(saved.kinds, '');
  assert.equal(saved.sourceId, 'm1');
});

test('★ 찬 자리(null)로 먼저 불려도 «서버에 있던 값» 위에 적힌다', async () => {
  const H = require(path.join(R, 'js', 'pu-hr-intake.js'));
  const id = H.taskId('m1', 'out');
  /* 서버에는 누가 고쳐 둔 이름이 이미 있다 — 이 화면은 그걸 아직 모른다(찬 자리) */
  const w = writeWorld({ ['paydata/hrtask/' + id]: { id: id, entityType: 'Task', name: '홍길동', revision: 3, createdAt: 1 } });
  const W = loadWriters(false, w);
  W.hrDone(id);
  await settle();
  const saved = w.store['paydata/hrtask/' + id];
  assert.ok(saved.doneAt, '처리함이 적혀야 한다 — 찬 자리에서 접히면 서버에 묻지도 않고 끝난다');
  assert.equal(saved.name, '홍길동', '남이 고쳐 둔 이름을 덮지 않는다');
  assert.equal(saved.revision, 4, '판은 서버 판 위에 하나 올라간다');
  assert.equal(saved.createdAt, 1, '처음 만든 때는 그대로');
});

test('★ 남의 사업장 할 일은 담당이 아니면 안 적힌다', async () => {
  const H = require(path.join(R, 'js', 'pu-hr-intake.js'));
  const w = writeWorld();
  const W = loadWriters(false, w);
  W.hrDone(H.taskId('m5', 'in'));
  await settle();
  assert.equal(Object.keys(w.store).length, 0);
});

test('새로 만드는 할 일 상태는 온톨로지 꼴을 갖춘다', async () => {
  const H = require(path.join(R, 'js', 'pu-hr-intake.js'));
  const id = H.taskId('m1', 'out');
  const w = writeWorld();
  const W = loadWriters(false, w);
  W.hrDone(id);
  await settle();
  const s = w.store['paydata/hrtask/' + id];
  ['id', 'entityType', 'createdAt', 'updatedAt', 'revision', 'sourceKind', 'sourceId', 'companyId'].forEach(k =>
    assert.ok(s[k] !== undefined && s[k] !== '', k + ' 칸이 있어야 한다'));
  assert.equal(s.entityType, 'Task');
  assert.equal(s.sourceId, 'm1');
});

test('★ 화면을 여는 것만으로는 아무것도 안 쓴다 — 쓰는 곳은 사람이 누르는 셋뿐', () => {
  const writers = ['hrWrite', 'hrConfirm'];
  ['loadHr', 'hrModel', 'hrCardHtml', 'hrPillsHtml', 'sideViewModel', 'sideListModel'].forEach(n => {
    const s = code(cut(n));
    /* 배열의 push 는 쓰기가 아니다 — 서버에 적는 말(set·update·transaction·remove)만 본다 */
    assert.doesNotMatch(s, /\.(set|update|transaction|remove)\(/, n + ' 는 쓰면 안 된다');
    writers.forEach(w => assert.ok(s.indexOf(w + '(') < 0, n + ' 가 ' + w + ' 를 부르면 안 된다'));
  });
});

test('서버 규칙 — 할 일·꼬리표 칸은 메일 기록과 «같은 사람»(재직 직원)이 읽고 쓴다', () => {
  const s = code(RULES_SRC);
  assert.match(s, /hrtask:\s*\{\s*'\.read':\s*LOGIN,\s*'\.write':\s*LOGIN\s*\}/);
  assert.match(s, /mailkind:\s*\{\s*'\.read':\s*LOGIN,\s*'\.write':\s*LOGIN\s*\}/);
  assert.match(s, /maillog:\s*\{\s*'\.read':\s*LOGIN/);
});

test('관리자 메일 화면 — 공용 칸에 쌓인 까닭을 사람 이름으로', () => {
  const s = code(cut('screenMail'));
  assert.match(s, /S\.amAdmin\(\) && rows\.length/);
  assert.match(s, /ownerAway/);
});
