/* 「이미 다른 사업의 컨설팅 일정이 들어가 있을 경우 팝업캘린더에 동일 사업장
 * 컨설팅이 진행이 안 되게 날짜입력이 안 되게 표시해 달라」 (대표 지시 2026-09-21)
 *
 * 왜 필요한가 — 한 사업장에 서로 다른 컨설팅(예: 구조혁신 · 기술보호울타리)이
 * 같은 날짜로 섞여 들어가면, 나중에 사진·기록을 볼 때 그 날 «어느 사업» 방문이었는지
 * 헷갈린다. 그래서 개별 일정 등록 팝업 달력에서 그 사업장이 «다른 사업»으로 이미
 * 일정이 있는 날짜는 아예 고를 수 없게 막는다. 저장 함수에도 같은 막이를 한 번 더
 * 둔다 — 달력이 그린 뒤에 다른 탭에서 그 날짜를 먼저 채워 갈 수도 있기 때문이다.
 *
 * 못 박는 것은 «지금 값»이 아니라 규칙이다 (CLAUDE.md).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');

function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}

const TYPES = [
  { id: 't1', name: '구조혁신', fullName: '산업일자리전환컨설팅(구조혁신)' },
  { id: 't2', name: '기술보호', fullName: '기술보호울타리' },
];

/* 가짜 화면 — innerHTML/textContent 만 받아 적는다 */
function fakeDom() {
  const els = {};
  const mk = () => { const o = { _h: '', _t: '' };
    Object.defineProperty(o, 'innerHTML', { get: () => o._h, set: (v) => { o._h = v; } });
    Object.defineProperty(o, 'textContent', { get: () => o._t, set: (v) => { o._t = v; } });
    return o; };
  ['#mSingleMonth', '#mSingleCal'].forEach((k) => { els[k] = mk(); });
  return { q: (sel) => els[sel], els };
}

/* renderSingleCal 이 실제로 그린 칸 중 한 날짜의 class·title 을 뽑아낸다 */
function cellOf(html, ds) {
  const m = html.match(new RegExp('<div class="([^"]*)" data-ds="' + ds + '"([^>]*)>'));
  assert.ok(m, ds + ' 칸을 못 찾음(칸 자체가 안 그려짐)');
  return { cls: m[1], rest: m[2] };
}

function world(scheds) {
  const state = { scheds: scheds.slice() };
  const calls = { showBigAlert: [], toast: [], setScheds: 0 };
  const ctx = {
    console, Math, Number, String, Array, Object, Set, Date, RegExp,
    getScheds: () => state.scheds,
    setScheds: (v) => { state.scheds = v; calls.setScheds++; },
    getTypes: () => TYPES,
    getCos: () => [{ id: 'c1', defAtt: 'a1' }],
    getCoAtts: () => [],
    getCoMaxRounds: () => 0,
    checkExclusiveDay: () => null,
    checkConflictMatrix: () => null,
    checkAttLimit: () => null,
    curPhase: () => 'main',
    ensurePhaseState: () => {},
    reorderRounds: () => {},
    myId: () => 'a1',
    uid: (() => { let n = 0; return () => 'id' + (n++); })(),
    getEnv: () => ({ allowHoliday: true, allowWeekend: true, autoStampOnField: false }),
    getHoliday: () => '',
    verifyCompanyEditLock: async () => true,
    closeModal: () => {},
    renderSummaryBar: () => {}, renderCal: () => {}, renderDash: () => {},
    toast: (m) => calls.toast.push(m),
    showBigAlert: (m) => calls.showBigAlert.push(m),
  };
  vm.createContext(ctx);
  vm.runInContext([
    grab('p2'), grab('todayStr'), grab('escAttr'),
    grab('isBlocked'), grab('coOtherTypeOn'), grab('renderSingleCal'),
    grab('saveSingle'), grab('saveMultiSingle'),
  ].join('\n'), ctx);
  return { ctx, state, calls };
}

test('coOtherTypeOn — 같은 사업장·다른 사업이면 그 사업 이름을 낸다', () => {
  const { ctx } = world([
    { id: 's1', coId: 'c1', typeId: 't2', date: '2026-09-16' },
  ]);
  assert.strictEqual(ctx.coOtherTypeOn('c1', 't1', '2026-09-16'), '기술보호울타리');
});

test('coOtherTypeOn — 같은 사업이면 비운다(다른 사업이 아니다)', () => {
  const { ctx } = world([
    { id: 's1', coId: 'c1', typeId: 't1', date: '2026-09-16' },
  ]);
  assert.strictEqual(ctx.coOtherTypeOn('c1', 't1', '2026-09-16'), '');
});

test('coOtherTypeOn — 다른 사업장이면 비운다', () => {
  const { ctx } = world([
    { id: 's1', coId: 'c9', typeId: 't2', date: '2026-09-16' },
  ]);
  assert.strictEqual(ctx.coOtherTypeOn('c1', 't1', '2026-09-16'), '');
});

test('coOtherTypeOn — excludeId 로 자기 자신은 걸리지 않는다(수정 중 자기 칸)', () => {
  const { ctx } = world([
    { id: 's1', coId: 'c1', typeId: 't2', date: '2026-09-16' },
  ]);
  assert.strictEqual(ctx.coOtherTypeOn('c1', 't1', '2026-09-16', 's1'), '');
});

test('renderSingleCal — 다른 사업이 있는 날짜는 busy 로 막고 누를 길이 없다', () => {
  const { ctx } = world([
    { id: 's1', coId: 'c1', typeId: 't2', date: '2026-09-16' },
  ]);
  ctx.single = { coId: 'c1', typeId: 't1', isField: true, selDate: '', calY: 2026, calM: 8, multi: false, picks: [] };
  const dom = fakeDom();
  ctx.q = dom.q;
  ctx.renderSingleCal();
  const html = dom.els['#mSingleCal']._h;
  const busy = cellOf(html, '2026-09-16');
  assert.match(busy.cls, /\bdis\b/, 'busy 칸은 dis 도 함께 가져야 클릭이 막힌다');
  assert.match(busy.cls, /\bbusy\b/);
  assert.doesNotMatch(busy.rest, /onclick=/, 'busy 칸을 눌러 고를 수 있으면 안 된다');
  assert.match(busy.rest, /title="기술보호울타리/, '왜 막혔는지 말해 줘야 한다');
  const free = cellOf(html, '2026-09-17');
  assert.doesNotMatch(free.cls, /\bbusy\b/);
  assert.match(free.rest, /onclick=/, '아무 사업도 안 겹치면 눌러 고를 수 있어야 한다');
});

test('renderSingleCal — 여러 회차 모드에서도 busy 칸엔 끌어다 놓기(ondrop)가 안 붙는다', () => {
  const { ctx } = world([
    { id: 's1', coId: 'c1', typeId: 't2', date: '2026-09-16' },
  ]);
  ctx.single = { coId: 'c1', typeId: 't1', isField: true, selDate: '', calY: 2026, calM: 8, multi: true, picks: [] };
  const dom = fakeDom();
  ctx.q = dom.q;
  ctx.renderSingleCal();
  const busy = cellOf(dom.els['#mSingleCal']._h, '2026-09-16');
  assert.doesNotMatch(busy.rest, /ondrop=/);
});

test('saveSingle — 다른 사업 일정이 있는 날짜는 저장을 막는다', async () => {
  const { ctx, state, calls } = world([
    { id: 's1', coId: 'c1', typeId: 't2', date: '2026-09-16' },
  ]);
  ctx.single = { coId: 'c1', typeId: 't1', isField: false, selDate: '2026-09-16', calY: 2026, calM: 8, multi: false, picks: [] };
  await ctx.saveSingle();
  assert.strictEqual(state.scheds.length, 1, '새 일정이 들어가면 안 된다');
  assert.strictEqual(calls.showBigAlert.length, 1);
  assert.match(calls.showBigAlert[0], /기술보호울타리/);
});

test('saveSingle — 안 겹치는 날짜는 그대로 저장된다', async () => {
  const { ctx, state, calls } = world([
    { id: 's1', coId: 'c1', typeId: 't2', date: '2026-09-16' },
  ]);
  ctx.single = { coId: 'c1', typeId: 't1', isField: false, selDate: '2026-09-17', calY: 2026, calM: 8, multi: false, picks: [] };
  await ctx.saveSingle();
  assert.strictEqual(state.scheds.length, 2);
  assert.strictEqual(calls.showBigAlert.length, 0);
});

test('saveMultiSingle — 겹치는 날짜만 건너뛰고 나머지는 저장한다', async () => {
  const { ctx, state, calls } = world([
    { id: 's1', coId: 'c1', typeId: 't2', date: '2026-09-16' },
  ]);
  ctx.single = {
    coId: 'c1', typeId: 't1', isField: false, selDate: '', calY: 2026, calM: 8, multi: true,
    picks: [{ date: '2026-09-16', isField: false }, { date: '2026-09-18', isField: false }],
  };
  await ctx.saveMultiSingle();
  assert.strictEqual(state.scheds.length, 2, '겹치는 9-16 은 빼고 9-18 만 한 건 늘어야 한다');
  assert.ok(state.scheds.some((s) => s.date === '2026-09-18' && s.typeId === 't1'));
  assert.ok(!state.scheds.some((s) => s.date === '2026-09-16' && s.typeId === 't1'));
  assert.ok(calls.toast.some((m) => /기술보호울타리/.test(m)), '건너뛴 까닭을 알려 줘야 한다');
});
