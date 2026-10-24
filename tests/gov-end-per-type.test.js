/* 사업마다 «자기 종료 단추» — 정부컨설팅 일정관리 (대표 지시 2026-10-24 「기술보호 컨설팅만 종료해야 되는데 왜 종료 버튼 없나」 → 시안 승인 「진행」)

   ■ 무엇이 어긋나 있었나
     사업장 한 곳에 사업이 둘 이상이면 종료 단추가 «머리에 하나» 뿐이었고, 그 단추는 «첫 번째 사업»만 끝냈다.
     어느 사업이 끝나는지 화면에 안 보이고(확인 창도 「이 컨설팅을…」), 사업 줄에는 「삭제」만 있었다.
     ★ 같은 자리의 오류: 「사업별로 묶어 보기」에서도 머리 종료가 «그 묶음의 사업» 이 아니라 첫 사업을 끝냈다
       (산일충남 묶음에서 누르면 기술보호가 끝났다).

   ■ 규칙(대표 승인 시안)
     · 진행 중인 사업이 «둘 이상 보이는 카드»는 사업 줄마다 자기 「종료」를 갖고, 머리 종료는 없다.
     · 사업이 하나뿐인 카드·사업별 묶음 안의 카드는 머리에 하나(지금과 같다) — 끝낼 사업은 «그 카드의 사업».
     · 확인 창에 사업 이름이 나온다.

   ★ 이 검사는 「글자가 있나」가 아니라 **실제로 함수를 돌려서** 본다. 여기서 못 박는 것은 «규칙» 이다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const S = bare(SRC);

function grab(n) {
  const i = S.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < S.length; j++) {
    if (S[j] === '{') { d++; st = true; }
    else if (S[j] === '}') { d--; if (st && !d) return S.slice(i, j + 1); }
  }
}
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ══ ① 어디에 단추를 둘지 — 순수한 판정 ══════════════════════════ */

function helpers() {
  const ctx = vm.createContext({ Set, Array, Object, JSON });
  vm.runInContext(['dashEndOnRows', 'dashHeaderEndTypeId'].map(grab).join('\n'), ctx);
  return ctx;
}

test('★ 진행 중인 사업이 둘 이상 보이는 카드만 «사업 줄»에 종료 단추를 둔다', () => {
  const h = helpers();
  assert.strictEqual(h.dashEndOnRows(['t4', 't2'], ''), true);
  assert.strictEqual(h.dashEndOnRows(['t4'], ''), false, '사업이 하나뿐이면 지금처럼 머리에 하나');
  assert.strictEqual(h.dashEndOnRows([], ''), false);
  assert.strictEqual(h.dashEndOnRows(['t4', 't2'], 't2'), false, '사업별 묶음 안에서는 카드에 사업 줄이 하나뿐이다');
});

test('★ 머리 종료 단추가 끝내는 사업 — 사업별 묶음 안에서는 «그 묶음의 사업», 사업이 둘 이상이면 머리에 없다', () => {
  const h = helpers();
  assert.strictEqual(h.dashHeaderEndTypeId(['t4'], ''), 't4');
  assert.strictEqual(h.dashHeaderEndTypeId(['t4', 't2'], ''), '', '★ 둘 이상인데 머리에 있으면 «첫 번째 사업»만 끝나서 어느 사업인지 헷갈린다');
  assert.strictEqual(h.dashHeaderEndTypeId(['t4', 't2'], 't2'), 't2',
    '★ 산일충남 묶음에서 머리 종료를 눌렀는데 기술보호가 끝납니다');
  assert.strictEqual(h.dashHeaderEndTypeId(['t4'], 't2'), '', '이 카드에서 이미 끝났거나 없는 사업이면 단추를 만들지 않는다');
  assert.strictEqual(h.dashHeaderEndTypeId([], ''), '');
});

/* ══ ② 사업 줄이 실제로 그려진 모습 ══════════════════════════════ */

const TYPES = [
  { id: 't4', name: '기술보호', fullName: '기술보호울타리', color: '#0e9f6e' },
  { id: 't2', name: '산일충남', fullName: '산업일자리전환컨설팅(충남경제)', color: '#7c3aed' },
  { id: 't1', name: '일터혁신', fullName: '일터혁신컨설팅', color: '#2563eb' },
];

function rowsWorld(over) {
  const ctx = vm.createContext(Object.assign({
    Set, Array, Object, JSON, Math, String, Number,
    getScheds: () => [], getTypes: () => TYPES,
    escAttr: esc,
    nextRound: (coId, tid) => (tid === 't4' ? 4 : 1),            // 기술보호는 3/3 을 채워 «완료» 줄이 된다
    getFieldState: () => true,
    getCoMaxRounds: (coId, tid) => (tid === 't4' ? 3 : 0),
    getCoMandatory: () => 0,
    isPrePhaseType: (tid) => tid === 't1',
    curPhase: () => 'main', schedPhase: () => 'main', PRE_ROUND_CAP: 2,
    roundIssueBadge: () => '', deadlineBadge: () => '',
  }, over || {}));
  vm.runInContext(['dashActiveTypeIds', 'dashEndOnRows', 'dashRowBtns', 'renderDashTypeRows'].map(grab).join('\n'), ctx);
  return ctx;
}
const endBtns = (html) => [...html.matchAll(/<button class="end-btn"[^>]*>/g)].map((m) => m[0]);

test('★ 사업이 둘 이상인 카드 — 사업 줄마다 자기 「종료」가 있고, 어느 사업 것인지 단추가 안다', () => {
  const w = rowsWorld();
  const co = { id: 'c1', types: ['t4', 't2'], endedTypes: {} };
  const html = w.renderDashTypeRows(co, TYPES, false, '');
  const btns = endBtns(html);
  assert.strictEqual(btns.length, 2, '★ 기술보호를 끝내려는데 사업 줄에 종료 단추가 없습니다');
  assert.ok(btns.some((b) => /data-typeid="t4"/.test(b)) && btns.some((b) => /data-typeid="t2"/.test(b)), '사업마다 자기 사업 번호를 들고 있어야 한다');
  assert.ok(btns.every((b) => /data-coid="c1"/.test(b)));
  assert.strictEqual((html.match(/dash-delete-btn/g) || []).length, 2, '삭제 단추는 그대로 있어야 한다');
});

test('사업 줄 세 가지 모양(완료·진행·사전진단 단계) 모두 종료 단추를 갖는다', () => {
  const w = rowsWorld();
  const co = { id: 'c1', types: ['t4', 't2', 't1'], endedTypes: {} };
  const html = w.renderDashTypeRows(co, TYPES, false, '');
  assert.ok(/완료 3\/3/.test(html), '시험 준비: 완료 줄이 그려져야 한다');
  assert.ok(/사전진단/.test(html), '시험 준비: 사전진단 단계 줄이 그려져야 한다');
  assert.strictEqual(endBtns(html).length, 3, '★ 줄 모양 하나라도 종료 단추를 빠뜨리면 그 사업은 못 끝낸다');
});

test('사업이 하나뿐이거나 사업별 묶음 안이면 사업 줄에 종료 단추를 안 둔다(머리에 하나)', () => {
  const w = rowsWorld();
  const one = { id: 'c1', types: ['t4'], endedTypes: {} };
  assert.strictEqual(endBtns(w.renderDashTypeRows(one, TYPES, false, '')).length, 0, '머리와 줄에 둘 다 있으면 헷갈린다');
  const two = { id: 'c1', types: ['t4', 't2'], endedTypes: {} };
  assert.strictEqual(endBtns(w.renderDashTypeRows(two, TYPES, false, 't2')).length, 0, '사업별 묶음 안에는 머리 단추가 끝낸다');
});

test('이미 끝난 사업은 단추가 없고, «아직 도는 사업이 하나뿐»이 되면 줄 단추 대신 머리로 돌아간다', () => {
  const w = rowsWorld();
  const co = { id: 'c1', types: ['t4', 't2'], endedTypes: { t4: '2026-10-01' } };
  const html = w.renderDashTypeRows(co, TYPES, true, '');
  assert.strictEqual(endBtns(html).length, 0, '끝난 사업 줄에 종료 단추가 있으면 두 번 끝낼 수 있다');
  assert.ok(/종료 \(/.test(html), '시험 준비: 끝난 줄이 그려져야 한다');
});

/* ══ ③ 머리 단추 · 확인 창 ═══════════════════════════════════════ */

test('카드 머리는 «끝낼 사업»을 도우미로 정한다 (사업별 묶음의 사업이 무시되지 않게)', () => {
  const m = S.search(/const cardHtml\s*=/);
  assert.ok(m > 0);
  const body = S.slice(m, m + 5200);
  assert.ok(/headerEndTypeId\s*=\s*dashHeaderEndTypeId\(\s*item\.activeIds\s*,\s*onlyTid/.test(body),
    '★ 머리 종료가 onlyTid 를 안 봅니다 — 사업별 묶음에서 엉뚱한 사업이 끝난다');
  assert.ok(!/headerEndTypeId\s*=\s*\(item\.activeIds\|\|\[\]\)\[0\]/.test(body), '「첫 번째 사업」으로 박는 옛 한 줄이 남아 있다');
});

function endWorld(co) {
  const log = { msg: '', cb: null, setCos: null, toasts: [] };
  const ctx = vm.createContext({
    Set, Array, Object, JSON, Promise, escAttr: esc,
    getTypes: () => TYPES, getCos: () => JSON.parse(JSON.stringify([co])),
    setCos: (v) => { log.setCos = v; },
    showConfirm: (msg, cb) => { log.msg = msg; log.cb = cb; },
    acquireCompanyEditLock: async () => true, verifyCompanyEditLock: async () => true, releaseCompanyEditLock: () => {},
    renderSummaryBar: () => {}, renderDash: () => {}, renderCal: () => {}, renderEndedView: () => {},
    q: () => null, toast: (m) => log.toasts.push(m), todayStr: () => '2026-10-24',
  });
  vm.runInContext(['dashActiveTypeIds', 'endConsulting'].map(grab).join('\n'), ctx);
  ctx._log = log;
  return ctx;
}

test('★ 확인 창이 «어느 사업을 끝내는지» 말하고, 확인하면 그 사업만 끝난다', async () => {
  const co = { id: 'c1', types: ['t4', 't2'], endedTypes: {} };
  const w = endWorld(co);
  w.endConsulting('c1', 't4');
  assert.ok(w._log.msg.includes('기술보호울타리'), '★ 「이 컨설팅을…」만 물으면 둘 중 무엇이 끝나는지 모른다');
  assert.ok(/다른 사업은 그대로/.test(w._log.msg), '사업이 둘 이상이면 «나머지는 그대로»라고 알려 준다');
  await w._log.cb();
  const ended = JSON.parse(JSON.stringify(w._log.setCos[0].endedTypes));
  assert.deepStrictEqual(Object.keys(ended), ['t4'], '★ 기술보호만 끝나야 한다');
});

test('사업이 하나뿐이면 «다른 사업은 그대로» 를 덧붙이지 않는다 · 이름 속 글자는 안전하게 처리한다', () => {
  const w = endWorld({ id: 'c1', types: ['t4'], endedTypes: {} });
  w.endConsulting('c1', 't4');
  assert.ok(!/다른 사업/.test(w._log.msg), '다른 사업이 없는데 있다는 말은 거짓이다');
  const w2 = endWorld({ id: 'c1', types: ['t9'], endedTypes: {} });
  const evil = vm.createContext({ Set, Array, Object, JSON, Promise, escAttr: esc, getTypes: () => [{ id: 't9', name: '<b>x</b>' }], getCos: () => [{ id: 'c1', types: ['t9'], endedTypes: {} }],
    showConfirm: (m) => { evil._m = m; }, acquireCompanyEditLock: async () => true, verifyCompanyEditLock: async () => true, q: () => null, toast: () => {}, todayStr: () => 'x' });
  vm.runInContext(['dashActiveTypeIds', 'endConsulting'].map(grab).join('\n'), evil);
  evil.endConsulting('c1', 't9');
  assert.ok(!/<b>x<\/b>/.test(evil._m), '★ 사업 이름이 글자 그대로 HTML 로 들어가면 안 된다');
  void w2;
});

test('종료 단추는 사업 줄 눌림(펼치기)에 묻히지 않는다 · 단추를 묶는 CSS 가 있다', () => {
  assert.ok(/\.drow-btns\s*\{/.test(SRC), '종료·삭제를 한 줄로 묶는 스타일이 없다');
  const click = S.indexOf("e.target.closest('.end-btn')");
  assert.ok(click > 0, '줄을 누를 때 종료 단추를 빼는 판정이 없다');
  assert.ok(/qa\('#dashList \.end-btn'\)/.test(S), '모든 종료 단추(머리·줄)를 묶어 연결해야 한다');
});
