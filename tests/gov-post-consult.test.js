/* 사후컨설팅 — 정부컨설팅 일정관리 (대표 지시 2026-11-02 「사후컨설팅 방문 넣어라」 · 시안 승인 「추천대로」)

   사후컨설팅 = 사업이 «끝난 뒤» 이어지는 후속 방문. 일정 레코드에 phase:'post' 로 저장한다(사전진단 'pre'·본 'main' 과 같은 길).

   ■ 못 박는 규칙 (지금 값이 아니라 «규칙»)
     · 사후는 본 회차에 «안 들어간다» — 「사후 1회, 2회…」로 따로 센다. 본 일정이 늘고 줄어도 사후 번호는 안 흔들리고, 그 반대도 같다.
     · ★ 사후를 넣어도 본 회차 숫자(종료 목록·진행 목록·진척·타임라인·요약줄)는 «글자까지 똑같다».
     · 사업은 종료 상태 그대로 둔다 — 사후를 넣었다고 진행 목록에 다시 올라오지 않는다.
     · 달력에서 사후 칩은 잠기지 않는다(취소선·🔒 없음). 대신 끌어 옮기지 않고, 눌러도 본 일정 수정 창이 아니라 사후컨설팅 서랍이 열린다.
     · 사업(프로그램) 규칙(같은 담당 하루 1건 · 기관 하루 1사업장)에서는 빠지고, 물리적 충돌(담당 하루 한도 · 같은 사업장 같은 날)은 일반 일정과 같다.
     · 기관 보고서·방문 안내 문자·현장클리닉 회차 제안에는 «안 섞인다».
     · 저장하는 모양에 undefined 를 남기지 않는다 · 새 localStorage 키를 만들지 않는다.

   ★ 이 검사는 「글자가 있나」가 아니라 **실제로 함수를 돌려서** 본다(규칙 쓸어 담기만 글자로). 예시는 전부 가짜 이름이다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'gov-consulting.html'), 'utf8');
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const S = bare(SRC);

function has(n) { return S.search(new RegExp('(?:async\\s+)?function ' + n + '\\(')) >= 0; }
function grab(n) {
  const i = S.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다 — 아직 만들지 않았거나 이름이 바뀌었다');
  let d = 0, st = false;
  for (let j = i; j < S.length; j++) {
    if (S[j] === '{') { d++; st = true; }
    else if (S[j] === '}') { d--; if (st && !d) return S.slice(i, j + 1); }
  }
}
const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const J = (x) => JSON.parse(JSON.stringify(x));
function hasUndefined(v) {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.some(hasUndefined);
  if (v && typeof v === 'object') return Object.values(v).some(hasUndefined);
  return false;
}

const TODAY = '2026-11-02';
/* 가짜 세상 — 저장소(st)와 화면 요소를 끼운 vm. 이름은 전부 지어낸 것이다. */
function world(names, over) {
  const st = { cos: [], scheds: [], staff: [{ id: 'a1', name: '홍길동' }, { id: 'a2', name: '임꺽정' }], env: {}, toasts: [], els: {}, matrix: {} };
  const el = (id) => (st.els[id] = st.els[id] || {
    id, innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, onclick: null, disabled: false, checked: false,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    closest: () => null, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, focus() {}, scrollIntoView() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, addEventListener() {}, title: '',
  });
  const types = [
    { id: 't1', name: '일터혁신', fullName: '일터혁신컨설팅', agency: '가나협력재단', rounds: 4, color: '#2a9d8f' },
    { id: 't2', name: '현장클리닉', rounds: 3, color: '#ef6c35' },
    { id: 't3', name: '기술보호', rounds: 3, color: '#4c6ef5', agencyExclusiveDay: true },
  ];
  const ctx = vm.createContext(Object.assign({
    console, JSON, Object, Array, String, Number, Date, Set, Map, Math, Promise, RegExp, Boolean, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, escAttr: esc,
    getCos: () => J(st.cos), setCos: (v) => { st.cos = J(v); }, getScheds: () => J(st.scheds), setScheds: (v) => { st.scheds = J(v); },
    getStaff: () => J(st.staff), getTypes: () => J(types), getEnv: () => st.env, todayStr: () => TODAY, myId: () => 'a1',
    getCoMaxRounds: (coId, tid) => ((types.find((t) => t.id === tid) || {}).rounds || 0), getCoMandatory: () => 0,
    getConflictMatrix: () => st.matrix, p2: (n) => String(n).padStart(2, '0'),
    q: (s) => el(s), qa: () => [], toast: (m) => st.toasts.push(String(m)), staffColor: () => '#ef6c35', isAdmin: () => true,
    PHOTOS: {}, canEdit: () => true, coIsMine: () => true, myVisible: () => true,
  }, over || {}));
  vm.runInContext(names.filter((n) => has(n)).map(grab).join('\n'), ctx);
  ctx._st = st; ctx._types = types;
  return ctx;
}
const D = (coId, tid, date, o) => Object.assign({ id: coId + tid + date, coId, typeId: tid, date, attId: 'a1', coAttIds: [], isField: true, round: 0, phase: 'main' }, o || {});
const P = (coId, tid, date, o) => D(coId, tid, date, Object.assign({ phase: 'post', id: 'p' + coId + tid + date }, o || {}));
const CO = (id, name, o) => Object.assign({ id, name, defAtt: 'a1', defCoAtts: [], types: ['t1', 't2', 't3'], active: true }, o || {});

/* ══ ① 사후 판정 · 본 회차 거르기 ═══════════════════════════════════ */

const PH = ['isPrePhaseType', 'schedPhase', 'isPostSched', 'getMainScheds', 'mainPhaseScheds', 'curPhase', 'nextRound'];

test('★ 사후 판정 — phase:\'post\' 하나로만 갈린다 (없는 값·사전진단·본은 사후가 아니다)', () => {
  const c = world(PH);
  assert.strictEqual(c.isPostSched({ phase: 'post' }), true);
  ['main', 'pre', undefined, ''].forEach((p) => assert.strictEqual(c.isPostSched({ phase: p }), false, String(p)));
  assert.strictEqual(c.isPostSched(null), false);
  assert.strictEqual(c.isPostSched(undefined), false);
  assert.strictEqual(c.schedPhase({ phase: 'post' }), 'post', '사후는 본(main)으로 읽히면 안 된다');
  assert.strictEqual(c.schedPhase({ phase: 'pre' }), 'pre');
  assert.strictEqual(c.schedPhase({}), 'main', '옛 자료(값 없음)는 본컨설팅');
});

test('★ mainPhaseScheds — 일터혁신이 «아닌» 종류에서도 사후를 뺀다 (예전엔 목록을 그대로 돌려줬다)', () => {
  const c = world(PH);
  const list = [D('c1', 't2', '2026-09-01'), D('c1', 't2', '2026-09-08'), P('c1', 't2', '2026-11-05')];
  assert.strictEqual(c.mainPhaseScheds(list, 't2').length, 2, '현장클리닉(단계 없는 종류)');
  const l1 = [D('c1', 't1', '2026-09-01', { phase: 'pre' }), D('c1', 't1', '2026-09-08'), P('c1', 't1', '2026-11-05')];
  assert.strictEqual(c.mainPhaseScheds(l1, 't1').length, 1, '일터혁신: 사전진단도 사후도 아닌 본만');
});

test('getMainScheds — 저장된 일정에서 사후만 뺀 목록 (저장소 자체는 안 건드린다)', () => {
  const c = world(PH);
  c._st.scheds = [D('c1', 't2', '2026-09-01'), P('c1', 't2', '2026-11-05')];
  assert.deepStrictEqual(c.getMainScheds().map((s) => s.phase), ['main']);
  assert.strictEqual(c._st.scheds.length, 2, '거르기는 읽기만 한다 — 사후 줄이 사라지면 자료 손실');
});

test('★ 다음 회차 · 현재 단계 — 사후는 본 회차를 세지 않고, 사후만 있는 사업이 «본컨설팅»으로 오판되지 않는다', () => {
  const c = world(PH);
  c._st.cos = [CO('c1', '가나상사')];
  c._st.scheds = [D('c1', 't2', '2026-09-01'), D('c1', 't2', '2026-09-08'), P('c1', 't2', '2026-11-05'), P('c1', 't2', '2026-11-12')];
  assert.strictEqual(c.nextRound('c1', 't2', 'main'), 3, '본 2회 → 다음은 3회 (사후 2건이 섞이면 5)');
  assert.strictEqual(c.nextRound('c1', 't2', 'post'), 3, '사후는 사후끼리: 2건 → 다음 3');
  c._st.scheds = [P('c1', 't1', '2026-11-05')];
  assert.strictEqual(c.curPhase('c1', 't1'), 'pre', '일터혁신에 사후만 있으면 아직 «사전진단» 단계다 — 사후가 있다고 본컨설팅이 된 것이 아니다');
});

/* ══ ② 회차 다시 매기기 — 본과 사후는 따로 ═════════════════════════ */

const RO = ['isPrePhaseType', 'schedPhase', 'isPostSched', 'roundIsFixed', 'roundPeers', 'roundIssues', 'reorderRounds', 'unfixAllRounds'];
const roundsOf = (c, coId, tid, ph) => c._st.scheds.filter((s) => s.coId === coId && s.typeId === tid && (s.phase || 'main') === ph).sort((a, b) => (a.date < b.date ? -1 : 1)).map((s) => s.round);

test('★ 단계 없는 종류 — 본 3건 + 사후 2건을 매기면 본 1·2·3, 사후 1·2 (예전 코드는 5건을 한 줄로 1~5)', () => {
  const c = world(RO);
  c._st.scheds = [D('c1', 't2', '2026-09-01'), D('c1', 't2', '2026-09-08'), D('c1', 't2', '2026-09-15'), P('c1', 't2', '2026-11-05'), P('c1', 't2', '2026-11-12')];
  c.reorderRounds('c1', 't2');
  assert.deepStrictEqual(roundsOf(c, 'c1', 't2', 'main'), [1, 2, 3]);
  assert.deepStrictEqual(roundsOf(c, 'c1', 't2', 'post'), [1, 2]);
});

test('★ 본 일정이 늘거나 지워져도 사후 번호는 그대로, 사후가 늘어도 본 번호는 그대로', () => {
  const c = world(RO);
  c._st.scheds = [D('c1', 't2', '2026-09-08'), D('c1', 't2', '2026-09-15'), P('c1', 't2', '2026-11-05'), P('c1', 't2', '2026-11-12')];
  c.reorderRounds('c1', 't2');
  c._st.scheds.push(D('c1', 't2', '2026-09-01')); c.reorderRounds('c1', 't2');   // 더 이른 본 일정이 끼어든다
  assert.deepStrictEqual(roundsOf(c, 'c1', 't2', 'main'), [1, 2, 3]);
  assert.deepStrictEqual(roundsOf(c, 'c1', 't2', 'post'), [1, 2], '본이 늘었다고 사후가 3,4 가 되면 안 된다');
  c._st.scheds.push(P('c1', 't2', '2026-10-30')); c.reorderRounds('c1', 't2');   // 사후가 더 이르게 끼어든다
  assert.deepStrictEqual(roundsOf(c, 'c1', 't2', 'post'), [1, 2, 3]);
  assert.deepStrictEqual(roundsOf(c, 'c1', 't2', 'main'), [1, 2, 3], '사후가 늘었다고 본 번호가 밀리면 안 된다');
});

test('일터혁신 — 사전진단·본·사후가 각각 1부터 따로', () => {
  const c = world(RO);
  c._st.scheds = [D('c1', 't1', '2026-08-01', { phase: 'pre' }), D('c1', 't1', '2026-08-10', { phase: 'pre' }), D('c1', 't1', '2026-09-01'), D('c1', 't1', '2026-09-08'), P('c1', 't1', '2026-11-05')];
  c.reorderRounds('c1', 't1');
  assert.deepStrictEqual(roundsOf(c, 'c1', 't1', 'pre'), [1, 2]);
  assert.deepStrictEqual(roundsOf(c, 'c1', 't1', 'main'), [1, 2]);
  assert.deepStrictEqual(roundsOf(c, 'c1', 't1', 'post'), [1]);
});

test('다른 사업장·다른 종류의 일정은 건드리지 않는다', () => {
  const c = world(RO);
  c._st.scheds = [D('c1', 't2', '2026-09-01'), P('c1', 't2', '2026-11-05'), D('c2', 't2', '2026-09-01', { round: 7 }), P('c1', 't3', '2026-11-05', { round: 9 })];
  c.reorderRounds('c1', 't2');
  assert.strictEqual(c._st.scheds.find((s) => s.coId === 'c2').round, 7);
  assert.strictEqual(c._st.scheds.find((s) => s.typeId === 't3').round, 9);
});

test('회차 검사(겹침·빈 번호)와 손으로 정한 번호 풀기는 사후를 본으로 안 센다', () => {
  const c = world(RO);
  c._st.scheds = [D('c1', 't2', '2026-09-01', { round: 1 }), D('c1', 't2', '2026-09-08', { round: 2 }), P('c1', 't2', '2026-11-05', { round: 1 }), P('c1', 't2', '2026-11-12', { round: 2 })];
  const is = c.roundIssues('c1', 't2', 'main');
  assert.deepStrictEqual(J(is), { dups: [], gaps: [] }, '본 1·2 + 사후 1·2 가 섞이면 «1이 겹쳤다»고 거짓 경고가 난다');
  c._st.scheds[2].roundFixed = true;
  assert.strictEqual(c.unfixAllRounds('c1', 't2', 'main'), 0, '본 번호 풀기에 사후의 고정 표시가 딸려 나오면 안 된다');
  assert.strictEqual(c._st.scheds[2].roundFixed, true);
});

/* ══ ③ 라벨 — 「3회차」 대신 「사후 2회」 ═══════════════════════════ */

const LB = ['isPrePhaseType', 'schedPhase', 'isPostSched', 'roundText', 'usedRoundShort', 'usedDayTip', 'chipRound', 'scheduleHoverTitle', 'schedulePlaceLabel', 'schedulePlaceShort', 'endedDateForSchedule'];

test('★ 사후 일정은 이름표가 «사후 N» 이다 — 본 회차와 같은 숫자로 보이면 어느 것이 무엇인지 알 수 없다', () => {
  const c = world(LB); c._st.cos = [CO('c1', '가나상사')];
  const post = P('c1', 't2', '2026-11-05', { round: 2 }), main = D('c1', 't2', '2026-09-01', { round: 2 });
  assert.strictEqual(c.roundText(post, '회'), '사후 2회');
  assert.strictEqual(c.roundText(main, '회'), '2회');
  assert.ok(/사후/.test(c.chipRound(post)) && !/사후/.test(c.chipRound(main)));
  assert.ok(/후2/.test(c.usedRoundShort(post)) && !/후/.test(c.usedRoundShort(main)), '좁은 칸용 이름표는 「후2」 — 본은 「2회」');
  assert.ok(/사후 2회차/.test(c.usedDayTip(post, 10, 5)) && !/사후/.test(c.usedDayTip(main, 8, 1)));
  const co = c.getCos()[0], ty = c.getTypes()[1];
  assert.ok(/사후 2회차/.test(c.scheduleHoverTitle(post, co, ty, { name: '홍길동' }, [], false)));
});

/* ══ ④ 종료 잠금 — 사후는 잠기지 않는다 ═════════════════════════════ */

test('★ 종료된 사업이어도 사후 일정은 «종료»로 안 본다 — 본 일정은 그대로 종료', () => {
  const c = world(LB);
  c._st.cos = [CO('c1', '가나상사', { endedTypes: { t2: '2026-10-24' } })];
  assert.strictEqual(c.endedDateForSchedule(D('c1', 't2', '2026-10-01')), '2026-10-24');
  assert.strictEqual(c.endedDateForSchedule(P('c1', 't2', '2026-11-05')), '', '사후까지 잠기면 달력에서 취소선이 그어지고 서랍 밖에서는 못 연다');
});

const CH = ['isPrePhaseType', 'schedPhase', 'isPostSched', 'roundText', 'chipRound', 'endedDateForSchedule', 'isEndedSchedule', 'schedulePlaceShort', 'schedulePlaceLabel', 'scheduleHoverTitle', 'chipHtml'];
function chipWorld() {
  const c = world(CH, { coAttStaffList: () => [], schedHasPhoto: () => false, gcalTint: () => ({ bg: '#fee', fg: '#900' }), tzDow: () => '월' });
  c._st.cos = [CO('c1', '가나상사', { endedTypes: { t2: '2026-10-24' } })];
  return c;
}

test('★ 달력 칩 — 종료된 사업의 «본» 칩은 🔒·취소선·끌기 막기, «사후» 칩은 그 어느 것도 아니다', () => {
  const c = chipWorld();
  const main = c.chipHtml(D('c1', 't2', '2026-10-01', { round: 1 }));
  assert.ok(/is-ended/.test(main) && /🔒/.test(main) && /data-ended="1"/.test(main), '본 칩은 그대로 잠긴다');
  const post = c.chipHtml(P('c1', 't2', '2026-11-05', { round: 1 }));
  assert.ok(!/is-ended/.test(post) && !/🔒/.test(post) && /data-ended="0"/.test(post), '사후 칩은 잠기지 않는다: ' + post.slice(0, 160));
  assert.ok(/사후/.test(post), '칩에 «사후» 가 보인다');
  assert.ok(/draggable="false"/.test(post), '사후 칩은 끌어 옮기지 않는다(날짜는 서랍에서 고친다)');
});

test('★ 사후 칩을 눌러도 본 일정 수정 창이 아니라 «사후컨설팅 서랍»이 열린다 · 끌어 옮기기는 막힌다', async () => {
  const opened = []; const edits = [];
  const c = world(['isPostSched', 'isEndedSchedule', 'endedDateForSchedule', 'openEditModal', 'moveChip'], {
    openPostDrawer: (coId, tid, sid) => opened.push([coId, tid, sid]), openEndedViewModal: (sid) => edits.push('ended:' + sid),
    openViewModal: () => edits.push('view'), acquireCompanyEditLock: async () => { edits.push('lock'); return true; },
    isBlocked: () => '', checkExclusiveDay: () => null, checkConflictMatrix: () => null, checkAgencyExclusive: () => null, checkAttLimit: () => null,
  });
  c._st.cos = [CO('c1', '가나상사', { endedTypes: { t2: '2026-10-24' } })];
  c._st.scheds = [P('c1', 't2', '2026-11-05', { id: 'pX' }), D('c1', 't2', '2026-10-01', { id: 'mX' })];
  await c.openEditModal('pX');
  assert.deepStrictEqual(J(opened), [['c1', 't2', 'pX']], '서랍이 그 사업·그 사후로 열린다');
  assert.deepStrictEqual(edits, [], '본 일정 수정 창·잠금이 열리면 회차·단계를 건드릴 수 있다');
  await c.openEditModal('mX');
  assert.deepStrictEqual(edits, ['ended:mX'], '본 일정은 예전 그대로 «종료된 컨설팅»');
  const before = JSON.stringify(c._st.scheds);
  c.moveChip('pX', '2026-11-06');
  assert.strictEqual(JSON.stringify(c._st.scheds), before, '끌어 옮겨도 날짜가 안 바뀐다');
  assert.ok(c._st.toasts.some((t) => /사후/.test(t)), '왜 안 되는지 말해 준다: ' + c._st.toasts.join('|'));
});

/* ══ ⑤ 충돌 검사 — 사업 규칙에서는 빠지고, 물리적 충돌은 그대로 ════════ */

const CF = ['isPostSched', 'isConflictPair', 'conflictKey', 'coMainOf', 'checkConflictMatrix', 'checkAgencyExclusive', 'agencyOtherSiteOn', 'dayConflictMsg', 'checkAttLimit', 'coOtherTypeOn', 'getCoAtts'];
function cfWorld() {
  const c = world(CF, { coMainOf: (co) => co.defAtt });
  c._st.cos = [CO('c1', '가나상사'), CO('c2', '라마바식품')];
  c._st.matrix = { t2__t2: true };   // 「같은 담당 하루 1건」 켬
  return c;
}

test('★ 같은 담당 하루 1건 — 다른 사업장의 «사후»는 걸림돌이 아니다, «본»은 그대로 걸림돌이다', () => {
  const c = cfWorld();
  c._st.scheds = [P('c2', 't2', '2026-11-05')];
  assert.strictEqual(c.checkConflictMatrix('c1', 't2', '2026-11-05'), null, '사후는 사업(프로그램) 규칙에서 빠진다');
  c._st.scheds = [D('c2', 't2', '2026-11-05')];
  assert.ok(/같은 날 중복/.test(c.checkConflictMatrix('c1', 't2', '2026-11-05') || ''), '본 일정은 예전 그대로 막는다');
});

test('★ 기관 하루 1사업장 — 다른 사업장의 사후는 걸림돌이 아니고, 달력 칸 표시(agencyOtherSiteOn)도 같다', () => {
  const c = cfWorld();
  c._st.scheds = [P('c2', 't3', '2026-11-05', { typeId: 't3' })];
  assert.strictEqual(c.checkAgencyExclusive('c1', 't3', '2026-11-05'), null);
  assert.strictEqual(c.agencyOtherSiteOn('c1', 't3', '2026-11-05'), '');
  c._st.scheds = [D('c2', 't3', '2026-11-05')];
  assert.ok(c.checkAgencyExclusive('c1', 't3', '2026-11-05'), '본 일정은 막는다');
  assert.strictEqual(c.agencyOtherSiteOn('c1', 't3', '2026-11-05'), '라마바식품');
});

test('달력의 «같은 날 중복» 경고 배지에도 사후는 안 센다', () => {
  const c = cfWorld();
  c._st.scheds = [D('c1', 't2', '2026-11-05'), P('c2', 't2', '2026-11-05')];
  assert.strictEqual(c.dayConflictMsg('2026-11-05'), null);
  c._st.scheds = [D('c1', 't2', '2026-11-05'), D('c2', 't2', '2026-11-05')];
  assert.ok(c.dayConflictMsg('2026-11-05'), '본 둘이면 경고');
});

test('★ 담당 하루 한도 — 사후도 «센다» (사람이 실제로 가는 날이다)', () => {
  const c = cfWorld(); c._st.env = { maxDailyPerAtt: 1 };
  c._st.scheds = [P('c2', 't2', '2026-11-05')];
  assert.ok(/이미 1건/.test(c.checkAttLimit('a1', '2026-11-05') || ''), '사후 때문에 한도에 닿는다');
  assert.strictEqual(c.checkAttLimit('a1', '2026-11-06'), null);
});

test('★ 같은 사업장 같은 날 다른 사업 — 사후도 «센다» (사업장에 실제로 가는 날)', () => {
  const c = cfWorld();
  c._st.scheds = [P('c1', 't3', '2026-11-05', { typeId: 't3' })];
  assert.strictEqual(c.coOtherTypeOn('c1', 't2', '2026-11-05'), '기술보호');
  assert.strictEqual(c.coOtherTypeOn('c1', 't3', '2026-11-05'), '', '같은 사업끼리는 이 규칙이 아니다');
});

/* ══ ⑥ ★ 불변 — 사후를 넣어도 «본 회차 숫자»는 글자까지 똑같다 ═════════════════ */

const VIEWS = ['isPrePhaseType', 'schedPhase', 'isPostSched', 'getMainScheds', 'mainPhaseScheds', 'curPhase', 'nextRound', 'dashActiveTypeIds', 'dashEndOnRows',
  'progCalc', 'mpDate', 'dashReopenBadge', 'renderDashTypeRows', 'renderProg', 'renderSummaryBar', 'renderTimeline', 'renderTlZoom', 'tlZoomCopyText', 'tlZoomCopy', 'endedDateForSchedule',
  'roundText', 'chipRound', 'schedulePlaceLabel', 'schedulePlaceShort', 'scheduleHoverTitle'];
function scene(withPost) {
  const c = world(VIEWS, {
    PRE_ROUND_CAP: 2, S: { tlStatus: 'active' }, _mpMine: false, _mpOpen: '', _tzKey: { coId: 'c1', tid: 't2' },
    getFieldState: () => true, roundIssueBadge: () => '', deadlineBadge: () => '', dashRowBtns: () => '', deadlineBadgeCompact: () => '',
    bindCalNav: () => {}, renderNotifBadge: () => {}, tlMineOnlyOn: () => false, fillTimelineTypeFilter: () => {}, tlRowHasAtt: () => true,
    coMainOf: (co) => co.defAtt, getCoAtts: (o) => (o && o.defCoAtts) || [], coAttStaffList: () => [], schedHasPhoto: () => false,
    openEditModal: () => {}, openTlZoom: () => {}, closeModal: () => {}, dashHeadAtts: (co) => ({ main: co.defAtt, subs: [] }), tzDow: () => '월', getHoliday: () => '',
    grpPickCons: () => null, grpOpenReport: () => {}, mpPick: () => {}, document: { getElementById: () => null },
  });
  c._st.cos = [
    CO('c1', '가나상사', { types: ['t2'], deadlines: { t2: '2026-12-01' } }),
    CO('c2', '라마바식품', { types: ['t1'], phaseState: { t1: 'main' } }),
    CO('c3', '사아정밀', { types: ['t2'], endedTypes: { t2: '2026-10-24' } }),
    CO('c4', '자차산업', { types: ['t2', 't3'], reopened: { t2: { was: '2026-10-10', at: '2026-11-01', by: '홍길동' } } }),
    CO('c5', '아자전자', { types: ['t3'], endedTypes: { t3: '2026-10-20' } }),
  ];
  const mk = (coId, tid, dates, ph) => dates.map((d, i) => D(coId, tid, d, { round: i + 1, phase: ph || 'main', isField: i % 2 === 0, id: coId + tid + (ph || 'm') + d }));
  c._st.scheds = [].concat(
    mk('c1', 't2', ['2026-09-01', '2026-09-08', '2026-11-20']), mk('c2', 't1', ['2026-08-01'], 'pre'), mk('c2', 't1', ['2026-09-01', '2026-09-15']),
    mk('c3', 't2', ['2026-09-02', '2026-09-09', '2026-10-01']), mk('c4', 't2', ['2026-09-03', '2026-09-10']), mk('c5', 't3', ['2026-09-04']));
  if (withPost) {
    ['c1:t2', 'c2:t1', 'c3:t2', 'c4:t2', 'c5:t3'].forEach((k) => {
      const [coId, tid] = k.split(':');
      c._st.scheds.push(...mk(coId, tid, ['2026-10-28', '2026-11-30'], 'post'));   // 지난 것 하나 + 앞으로 잡힌 것 하나
    });
  }
  return c;
}
function paint(c) {
  const out = {};
  const types = c.getTypes();
  c._st.cos.forEach((co) => { out['rows:' + co.id + ':on'] = c.renderDashTypeRows(co, types, true); out['rows:' + co.id + ':off'] = c.renderDashTypeRows(co, types, false); });
  c.renderSummaryBar(); c.renderTimeline(); c.renderTlZoom();
  ['active', 'ended'].forEach((s) => { c._st.els['#mpStatus'] = Object.assign(c._st.els['#mpStatus'] || {}, { value: s }); c.renderProg(); out['prog:' + s] = c._st.els['#mpList'].innerHTML + '|' + c._st.els['#mpSum'].innerHTML; });
  Object.keys(c._st.els).forEach((k) => { if (!/^#mp(List|Sum)$/.test(k)) out['el:' + k] = String(c._st.els[k].innerHTML) + '|' + String(c._st.els[k].textContent); });
  return out;
}

test('★★ 사후를 넣어도 진행 목록·요약줄·진행 보기·타임라인·타임라인 확대의 글자가 «하나도» 안 바뀐다', () => {
  const before = paint(scene(false)), after = paint(scene(true));
  assert.ok(Object.keys(before).length >= 14, '비교할 화면이 충분히 그려졌다: ' + Object.keys(before).length);
  const diff = Object.keys(before).filter((k) => before[k] !== after[k]);
  assert.deepStrictEqual(diff, [], '사후 때문에 달라진 곳: ' + diff.join(', '));
});

test('불변 검사가 «이가 있는가» — 사후가 정말 자료에 들어갔고, 본 일정 하나를 더하면 같은 비교가 달라진다', () => {
  const w = scene(true);
  assert.strictEqual(w._st.scheds.filter((s) => s.phase === 'post').length, 10, '사후 10건이 들어 있다');
  const a = paint(scene(false)), c2 = scene(false);
  c2._st.scheds.push(D('c1', 't2', '2026-10-05', { round: 4, id: 'extra' }));
  const b = paint(c2);
  assert.ok(Object.keys(a).some((k) => a[k] !== b[k]), '본 일정이 늘어도 화면이 안 바뀌면 이 비교는 아무 것도 못 잡는다');
});

/* ── 종료 사업장 모으기(endedInfos)도 본만 센다 ── */
function engine(over) {
  const a = S.indexOf('const CO_CORP_RE'), b = S.indexOf('let _erpPlan');
  const enLine = S.split(/\r?\n/).find((x) => x.trim().startsWith('const _en=')) || '';
  const cc = S.indexOf('function erpConsCode('), ccEnd = S.indexOf('\nfunction ', cc + 10);
  const g = S.indexOf('function getCoAtts'), gEnd = S.indexOf('\nfunction coAttStaffList', g);
  const st = { cos: [], scheds: [], staff: [], toasts: [], today: TODAY };
  const ctx = vm.createContext(Object.assign({
    console, JSON, Object, Array, String, Number, Date, Set, Math, Promise, RegExp, escAttr: esc,
    ERP: { loaded: true, consultings: [], dir: [], types: [] }, ERP_LS_PREFIX: 'pureun_v6_', PHOTOS: {},
    localStorage: { getItem: () => null, setItem: () => {} }, FB_READY: false,
    getCos: () => J(st.cos), setCos: (v) => { st.cos = J(v); }, getScheds: () => J(st.scheds), setScheds: (v) => { st.scheds = J(v); },
    getStaff: () => J(st.staff), getTypes: () => [{ id: 't1', name: '기술보호', fullName: '기술보호울타리', agency: '가나협력재단', rounds: 3, mandatoryField: 2 }, { id: 't2', name: '현장클리닉', rounds: 3 }],
    getErpTypeMap: () => ({ k1: 't1', k2: 't2' }), todayStr: () => st.today, myId: () => 'a1',
    getCoMaxRounds: () => 3, getCoMandatory: (coId, tid) => (tid === 't1' ? 2 : 0),
    toast: (m) => st.toasts.push(String(m)), renderDash: () => {}, renderCal: () => {}, erpSidName: () => '',
  }, over || {}));
  vm.runInContext(enLine + '\n' + S.slice(cc, ccEnd) + '\n' + S.slice(g, gEnd) + '\n' + S.slice(a, b) + '\n' +
    ['isPostSched', 'getMainScheds', 'schedHasPhoto', 'postPhotoCount', 'endedRuleList', 'endedDays', 'endedMd', 'endedFlagsFor', 'endedInfos'].filter(has).map(grab).join('\n'), ctx);
  ctx._st = st;
  return ctx;
}
function endedBoard(withPost) {
  const c = engine(); const st = c._st;
  st.staff = [{ id: 'a1', name: '홍길동' }, { id: 'a2', name: '임꺽정' }];
  st.cos = [
    { id: 'c1', name: '가나상사', defAtt: 'a1', defCoAtts: [], types: ['t1'], endedTypes: { t1: '2026-10-24' }, deadlines: { t1: '2026-10-31' } },
    { id: 'c2', name: '라마바식품', defAtt: 'a2', defCoAtts: [], types: ['t1', 't2'], endedTypes: { t1: '2026-10-24' }, reopened: { t2: { was: '2026-07-15', at: '2026-11-01', by: '홍길동' } } },
    { id: 'c3', name: '사아정밀', defAtt: 'a1', defCoAtts: [], types: ['t1'], endedTypes: { t1: '2026-10-24' } },
  ];
  const day = (coId, tid, date, f) => ({ id: coId + tid + date, coId, typeId: tid, date, isField: f, phase: 'main' });
  st.scheds = [day('c1', 't1', '2026-10-10', true), day('c1', 't1', '2026-10-18', true), day('c1', 't1', '2026-10-20', false), day('c2', 't1', '2026-10-01', true), day('c2', 't2', '2026-06-20', true)];
  if (withPost) st.scheds.push({ id: 'pa', coId: 'c1', typeId: 't1', date: '2026-11-05', isField: true, phase: 'post', round: 1 }, { id: 'pb', coId: 'c1', typeId: 't1', date: '2026-11-12', isField: false, phase: 'post', round: 2 },
    { id: 'pc', coId: 'c2', typeId: 't2', date: '2026-11-03', isField: true, phase: 'post', round: 1 });
  c.ERP.consultings = [{ id: 'E1', companyName: '가나상사', typeCode: 'k1', managerMain: 'S1', managerSubs: [], status: 'pending' }];
  return c;
}
const project = (items) => items.map((i) => ({ k: i.co.id + ':' + i.tid, state: i.state, start: i.start, last: i.last, cnt: i.cnt, fieldCnt: i.fieldCnt, officeCnt: i.officeCnt, ids: i.scheds.map((s) => s.id),
  flags: Array.from(i.flags).filter((f) => f.rule !== 'erp').map((f) => f.rule + ':' + f.reason) }));

test('★ endedInfos — 사후는 본 일정 수·시작·마지막 방문·현장/사무실·시기 검토 규칙을 하나도 안 바꾼다', () => {
  const a = endedBoard(false).endedInfos(), b = endedBoard(true).endedInfos();
  assert.deepStrictEqual(J(project(b)), J(project(a)));   // vm 안에서 만든 배열은 JSON 으로 한 번 걸러야 같다고 나온다
  assert.ok(b.find((i) => i.co.id === 'c1').scheds.every((s) => s.phase !== 'post'), 'info.scheds(규칙 계산 재료)는 본 일정만');
});

test('endedInfos 는 사후를 «따로» 담는다 — 목록(날짜순)·건수·사진 수', () => {
  const c = endedBoard(true);
  vm.runInContext('PHOTOS = ' + JSON.stringify({ pa: { c0: 1, c1: 1 }, pb: { c0: 1 } }), c);
  const it = c.endedInfos().find((i) => i.co.id === 'c1');
  assert.deepStrictEqual(it.posts.map((s) => s.id), ['pa', 'pb'], '날짜순');
  assert.strictEqual(it.postCnt, 2);
  assert.strictEqual(it.postPhotoCnt, 3, '사진 3장(2칸 + 1칸)');
  const none = c.endedInfos().find((i) => i.co.id === 'c3');
  assert.strictEqual(none.postCnt, 0); assert.deepStrictEqual(Array.from(none.posts), []);
  const ed = c.endedInfos().find((i) => i.co.id === 'c2' && i.state === 'editing');
  assert.strictEqual(ed.postCnt, 1, '「수정 중」인 사업에도 사후가 있을 수 있다');
});

/* ══ ⑦ 쓸어 담기 규칙 — 새로 만드는 «세는 곳»이 사후를 빠뜨리면 그 자리에서 걸린다 ═══ */

/* 「사업+종류로 일정을 세는」 함수는 getMainScheds()(본만) 로 세야 한다. 아래는 «일부러 사후까지 센다» 고 까닭을 적은 곳이다. */
const COUNT_OK = {
  nextRound: '단계(schedPhase===phase)로 이미 갈린다',
  openSingleModal: '단계(schedPhase===phase)로 이미 갈린다 — 등록 창 회차 안내',
  calcMultiRounds: '단계(schedPhase===phase)로 이미 갈린다 — 여러 날 등록',
  postListFor: '일부러 «사후만» 모은다(isPostSched 로 거른다) — 서랍 목록',
  postProblem: '같은 날 같은 사업 중복 방지 — 사후 넣을 때도 사후·본 모두 센다',
  postRemove: '일부러 «사후만» 지운다(isPostSched 로 거른다) — 본 일정은 안 지운다',
  roundPeers: '본/사후를 isPostSched 로 갈라 돌려준다',
  reorderRounds: '본/사후를 따로 번호 매긴다',
  moveChip: '같은 날 같은 사업 중복 방지 — 사후도 센다(사람·사업장이 실제로 가는 날)',
  handleDrop: '같은 날 같은 사업 중복 방지 — 사후도 센다',
  renderSingleCal: '등록 달력에서 «이미 일정이 있는 날»을 막는 중복 방지 — 사후도 센다',
  saveSingle: '같은 날 같은 사업 중복 방지 — 사후도 센다',
  saveMultiSingle: '같은 날 같은 사업 중복 방지 — 사후도 센다',
  revertRoundChange: '되돌릴 날짜에 같은 일정이 있는지 보는 중복 방지',
  stepExtraPhotos: '추가 사진 칸을 같은 사업의 일정에 같이 적용 — 사진 설정이지 회차 셈이 아니다',
};
function allFns() {
  const out = []; const re = /^(?:async\s+)?function ([A-Za-z_$][\w$]*)\(/gm; let m;
  while ((m = re.exec(S))) out.push({ name: m[1], body: grab(m[1]) });
  return out;
}
const COUNT_RE = [
  /getScheds\(\)\s*\.(?:filter|some|find)\(\s*\(?(\w+)\)?\s*=>[^;\n]*\b\1\.coId\s*===[^;\n]*\b\1\.typeId\s*===/,
  /\bscheds\s*\.(?:filter|some|find)\(\s*\(?(\w+)\)?\s*=>[^;\n]*\b\1\.coId\s*===[^;\n]*\b\1\.typeId\s*===/,
];
test('★ 「사업+종류별로 일정을 세는」 곳은 전부 getMainScheds() 로 센다 — 빠뜨린 곳이 있으면 이름과 고치는 법을 알려 준다', () => {
  const bad = [];
  allFns().forEach((f) => {
    if (COUNT_OK[f.name]) return;
    const rawDirect = COUNT_RE[0].test(f.body);
    const rawLocal = COUNT_RE[1].test(f.body) && /\bscheds\s*=\s*getScheds\(\)/.test(f.body) && !/\bscheds\s*=\s*getMainScheds\(\)/.test(f.body);
    if (rawDirect || rawLocal) bad.push(f.name);
  });
  assert.deepStrictEqual(bad, [], '이 함수들이 getScheds() 로 «사업+종류» 일정을 센다 — 사후컨설팅이 본 회차에 섞인다.\n' +
    '  본 회차를 세는 자리면 getMainScheds() 로 바꾸고, 일부러 사후까지 세는 자리면 이 검사의 COUNT_OK 에 «까닭과 함께» 적는다: ' + bad.join(', '));
});

test('COUNT_OK 에 적힌 이름은 «실제로 있는 함수»여야 한다 — 없어진 함수의 면제가 남아 구멍이 되지 않게', () => {
  Object.keys(COUNT_OK).forEach((n) => assert.ok(has(n), n + ' 이(가) 없다 — COUNT_OK 에서 지운다'));
});

test('★ 종료 여부를 «일정 하나»에서 co.endedTypes 로 따로 읽는 곳은 사후를 알아야 한다 (한 곳만 고치면 달력이 계속 잠긴다)', () => {
  const direct = /endedTypes\??\.?\[\s*(?:s|sc|_sc|x)\??\.typeId\s*\]/;
  const bad = allFns().filter((f) => f.name !== 'endedDateForSchedule' && direct.test(f.body) && !/isPostSched|endedDateForSchedule/.test(f.body)).map((f) => f.name);
  assert.deepStrictEqual(bad, [], '일정의 종료 여부는 endedDateForSchedule(sc) 한 길로 본다: ' + bad.join(', '));
});

/* ══ ⑧ 시기 검토 — 「이알피는 진행 중인데 일정관리만 종료」 + 사후 ═══════════════════ */

const FLAGS = ['endedRuleList', 'endedDays', 'endedMd', 'endedFlagsFor'];
const fbase = (o) => Object.assign({ endedDate: '2026-10-24', scheds: [{ date: '2026-10-10', isField: true }, { date: '2026-10-18', isField: true }, { date: '2026-10-20', isField: false }],
  maxR: 3, mandatory: 2, deadline: '2026-10-31', erp: 'none', sameDay: 1, checked: [], postCnt: 0 }, o || {});

test('★ 이알피 진행 중 규칙 — 사후가 입력돼 있으면 「사후 진행 중」으로 보이고 근거에 「사후 N회」가 붙는다 (규칙은 그대로 걸어 둔다)', () => {
  const c = world(FLAGS);
  const none = c.endedFlagsFor(fbase({ erp: 'running' }))[0];
  assert.strictEqual(none.rule, 'erp'); assert.ok(/이알피 진행 중/.test(none.label) && !/사후/.test(none.reason), '사후가 없으면 예전 그대로');
  const post = c.endedFlagsFor(fbase({ erp: 'running', postCnt: 2 }));
  assert.strictEqual(post.length, 1, '사후가 있다고 규칙에서 빼면 이알피 종료 정리가 가려진다');
  assert.strictEqual(post[0].rule, 'erp');
  assert.ok(/사후 진행 중/.test(post[0].label), post[0].label);
  assert.ok(/사후 2회/.test(post[0].reason), post[0].reason);
});

test('사후는 «이알피가 진행 중일 때만» 의미가 있다 — 이알피와 안 이어졌거나 끝났으면 사후가 있어도 이 규칙은 안 걸린다', () => {
  const c = world(FLAGS);
  ['none', 'closed'].forEach((e) => assert.strictEqual(c.endedFlagsFor(fbase({ erp: e, postCnt: 3 })).map((f) => f.rule).join(','), ''));
});

test('사후가 있어도 나머지 시기 검토 규칙은 흔들리지 않는다 (postCnt 는 erp 규칙만 본다)', () => {
  const c = world(FLAGS);
  const r = (o) => c.endedFlagsFor(fbase(o)).map((f) => f.rule).join(',');
  [{ sameDay: 5 }, { deadline: '2026-09-01' }, { scheds: [] }, { scheds: [{ date: '2026-08-01', isField: true }, { date: '2026-08-02', isField: true }, { date: '2026-08-03', isField: true }] }].forEach((o) =>
    assert.strictEqual(r(Object.assign({ postCnt: 2 }, o)), r(Object.assign({ postCnt: 0 }, o))));
});

test('endedInfos → endedFlagsFor 로 사후 건수가 넘어간다 (이알피 진행 중 + 사후 2건 → 「사후 진행 중」)', () => {
  const c = endedBoard(true);
  const it = c.endedInfos().find((i) => i.co.id === 'c1');
  const f = Array.from(it.flags).find((x) => x.rule === 'erp');
  assert.ok(f && /사후 진행 중/.test(f.label) && /사후 2회/.test(f.reason), JSON.stringify(f));
});

/* ══ ⑨ 종료 목록의 「사후컨설팅」 열 ═══════════════════════════════════ */

const VIEW = ['endedHi', 'endedPeopleHtml', 'postCellHtml', 'endedListHtml'];
function viewWorld(withPost) {
  const c = endedBoard(withPost);
  vm.runInContext('PHOTOS = ' + JSON.stringify({ pa: { c0: 1, c1: 1 }, pb: { c0: 1 } }), c);
  const w = world(['isPostSched', ...VIEW], { staffColor: () => '#ef6c35', getCoAtts: (o) => (o && o.defCoAtts) || [], todayStr: () => TODAY });
  return { c, w, items: c.endedInfos(), ref: { staff: c._st.staff, types: c.getTypes() } };
}
/* 한 줄 HTML 에서 «바로 아래 자식» 수 — 안쪽 span 은 세지 않는다(열 맞춤 검사용) */
function topChildren(html) {
  let depth = 0, n = 0; const re = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>/g; let m;
  while ((m = re.exec(html))) {
    const [, close, tag, , self] = m; const voidTag = /^(input|br|img|hr)$/i.test(tag) || self;
    if (close) { depth--; continue; }
    if (depth === 0) n++;
    if (!voidTag) depth++;
  }
  return n;
}
function firstDiv(html, cls) {
  const i = html.indexOf('<div class="' + cls); if (i < 0) return '';
  let d = 0; const re = /<\/?div\b[^>]*>/g; re.lastIndex = i; let m;
  while ((m = re.exec(html))) { if (m[0][1] === '/') { d--; if (!d) return html.slice(i, m.index + m[0].length); } else d++; }
  return '';
}

test('★ 사후 칸 — 입력 전 「＋ 사후」, 입력 후 「사후 N회 · 📷M」, 둘 다 서랍을 연다', () => {
  const { w, c } = viewWorld(true);
  const items = c.endedInfos();
  const c1 = items.find((i) => i.co.id === 'c1'), c3 = items.find((i) => i.co.id === 'c3');
  const has2 = w.postCellHtml(c1), none = w.postCellHtml(c3);
  assert.ok(/＋ 사후/.test(none) && !/사후 \d+회/.test(none) && /openPostDrawer\('c3','t1'\)/.test(none), none);
  assert.ok(/사후 2회/.test(has2) && /📷3/.test(has2) && /openPostDrawer\('c1','t1'\)/.test(has2), has2);
  const noPhoto = w.postCellHtml(Object.assign({}, c1, { postPhotoCnt: 0 }));
  assert.ok(/사후 2회/.test(noPhoto) && !/📷/.test(noPhoto), '사진이 없으면 📷 를 안 붙인다');
});

test('★ 종료 목록 — 「사후컨설팅」 열이 머리에 있고, 머리와 줄의 칸 수·CSS 격자 칸 수가 같다 (열 맞춤)', () => {
  const { w, items, ref } = viewWorld(true);
  const h = w.endedListHtml(items, ref, '');
  const head = firstDiv(h, 'ecolhd eg'), row = firstDiv(h, 'eg ended-line2');
  assert.ok(/사후컨설팅/.test(head), '머리에 열 이름');
  assert.strictEqual(topChildren(head.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '')), topChildren(row.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '')), '머리 칸 수 == 줄 칸 수');
  const grid = (SRC.match(/\n\.eg\{[^}]*grid-template-columns:([^;}]+)[;}]/) || [])[1] || '';
  const cols = grid.replace(/minmax\([^)]*\)/g, 'X').trim().split(/\s+/).length;
  assert.strictEqual(cols, topChildren(head.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '')), 'CSS .eg 의 열 수와 머리 칸 수가 같아야 열이 안 어긋난다: ' + grid);
});

test('★ 종료 목록 — 사후 칸이 생겨도 ☐ + 번호는 맨 왼쪽 · 한 사업이 한 줄이다', () => {
  const { w, items, ref } = viewWorld(true);
  const h = w.endedListHtml(items, ref, '');
  const rows = h.split('<div class="eg ended-line2">').slice(1);
  assert.strictEqual(rows.length, items.length, '한 사업 = 한 줄');
  rows.forEach((r, i) => {
    assert.ok(/^<input type="checkbox" class="ended-ck"/.test(r), '맨 왼쪽은 ☐');
    assert.ok(new RegExp('^<input[^>]*><span class="ended-no2">' + (i + 1) + '<').test(r), '둘째는 번호 ' + (i + 1));
  });
  assert.strictEqual((h.match(/openPostDrawer\(/g) || []).length, items.length, '줄마다 사후 단추가 하나');
});

/* ══ ⑩ 사후컨설팅 서랍 — 보여 주는 것 ═══════════════════════════════ */

const DRAW = ['isPostSched', 'postDrawerHtml'];
const dview = (o) => Object.assign({
  co: { id: 'c1', name: '가나상사' }, ty: { id: 't2', name: '현장클리닉' }, state: 'ended', endedDate: '2026-10-24', focusId: '',
  posts: [{ id: 'pa', date: '2026-11-05', isField: true, memo: '임금 점검', round: 1, att: '홍길동' }, { id: 'pb', date: '2026-11-12', isField: false, memo: '', round: 2, att: '홍길동' }],
  thumbs: { pa: ['data:image/jpeg;base64,AA', 'data:image/jpeg;base64,BB'], pb: [] }, form: { editId: '', date: '', field: true, memo: '', err: '' },
}, o || {});

test('★ 서랍 — 입력한 사후 목록(날짜·방문/사무실·메모·사진)과 「＋ 사후컨설팅 추가」 입력칸, 규칙 안내 세 줄', () => {
  const h = world(DRAW).postDrawerHtml(dview());
  assert.ok(/가나상사/.test(h) && /현장클리닉/.test(h), '어느 사업인지');
  assert.strictEqual((h.match(/class="post-row/g) || []).length, 2, '입력한 사후 둘');
  assert.ok(/11-05/.test(h) && /방문/.test(h) && /사무실/.test(h) && /임금 점검/.test(h), '날짜·구분·메모');
  assert.strictEqual((h.match(/<img[^>]+data:image\/jpeg/g) || []).length, 2, '사진 썸네일');
  assert.ok(/postEdit\('pa'\)/.test(h) && /postDelete\('pa'\)/.test(h) && /postPhoto\('pa'\)/.test(h), '수정·삭제·사진 단추');
  assert.ok(/id="postDate"/.test(h) && /id="postMemo"/.test(h) && /postSetField\(1\)/.test(h) && /postSetField\(0\)/.test(h), '날짜·방문/사무실·메모 입력칸');
  assert.ok(/＋ 사후컨설팅 추가/.test(h) && /postSave\(false\)/.test(h) && /postSave\(true\)/.test(h), '추가 단추(사진 넣기와 함께 / 따로)');
  assert.strictEqual((h.match(/class="post-rule"/g) || []).length, 3, '규칙 안내 세 줄');
  assert.ok(/본 회차/.test(h) && /종료/.test(h) && /달력/.test(h), '안내 내용: 본 회차에 안 들어감 · 종료 그대로 · 달력 칩');
});

test('★ 서랍 목록도 ☐ + 번호가 맨 왼쪽 — 고르면 「N건 선택 · 삭제」를 띄우는 자리가 있다 (자료 목록 규칙)', () => {
  const h = world(DRAW).postDrawerHtml(dview());
  const rows = h.split('<div class="post-row').slice(1);
  rows.forEach((r, i) => {
    assert.ok(/^[^>]*>\s*<input type="checkbox" class="post-ck"/.test(r), '맨 왼쪽은 ☐');
    assert.ok(new RegExp('class="post-no"[^>]*>' + (i + 1) + '<').test(r), '번호 ' + (i + 1));
  });
  assert.ok(/class="post-ck-all"/.test(h) && /id="postBar"/.test(h), '머리 ☐ · 선택 막대');
});

test('서랍 — 입력한 사후가 없으면 «없다»고 말하고, 진행 중인 사업이면 입력칸 대신 까닭을 말한다', () => {
  const c = world(DRAW);
  assert.ok(/아직 입력한 사후컨설팅이 없습니다/.test(c.postDrawerHtml(dview({ posts: [], thumbs: {} }))));
  const act = c.postDrawerHtml(dview({ state: 'active', posts: [] }));
  assert.ok(!/id="postDate"/.test(act) && /종료된 사업/.test(act), '진행 중인 사업에는 사후를 넣을 수 없다');
  const edt = c.postDrawerHtml(dview({ state: 'editing' }));
  assert.ok(/id="postDate"/.test(edt), '「수정 중」인 사업에는 넣을 수 있다');
});

test('서랍 — 메모·이름 속 HTML 글자는 무해하게 처리된다 · 수정 중인 칸은 저장·취소로 바뀐다', () => {
  const c = world(DRAW);
  const h = c.postDrawerHtml(dview({ posts: [{ id: 'pa', date: '2026-11-05', isField: true, memo: '<img src=x onerror=alert(1)>', round: 1, att: '홍길동' }], thumbs: {} }));
  assert.ok(!/<img src=x/.test(h) && /&lt;img/.test(h), '★ 메모가 HTML 로 그대로 들어가면 안 된다');
  const ed = c.postDrawerHtml(dview({ form: { editId: 'pa', date: '2026-11-05', field: false, memo: '고침', err: '' } }));
  assert.ok(/postCancel\(\)/.test(ed) && !/＋ 사후컨설팅 추가/.test(ed) && /value="2026-11-05"/.test(ed) && /고침/.test(ed), '수정 모드: 값이 채워지고 「저장」「취소」');
  const er = c.postDrawerHtml(dview({ form: { editId: '', date: '2026-11-05', field: true, memo: '', err: '해당 날짜에 이미 일정이 있습니다' } }));
  assert.ok(/이미 일정이 있습니다/.test(er), '막힌 까닭을 입력칸 옆에 보여 준다');
});

/* ══ ⑪ 사후 넣기·고치기·지우기 — 실제로 저장된다 ═══════════════════════ */

const POSTFN = ['isPostSched', 'getMainScheds', 'schedPhase', 'isPrePhaseType', 'roundIsFixed', 'reorderRounds', 'postListFor', 'postPhotoCount', 'schedHasPhoto',
  'postProblem', 'postBuildSched', 'postDrawerView', 'postDrawerHtml', 'renderPostDrawer', 'openPostDrawer', 'closePostDrawer', 'postSetField', 'postEdit', 'postCancel',
  'postFormRead', 'postSave', 'postDelete', 'postRemove', 'postThumbs', 'postBatchDelete', 'postSelKeys', 'postSelChange', 'postSelAll', 'postPhoto', 'coOtherTypeOn', 'checkAttLimit', 'getCoAtts'];
function postWorld(over) {
  const calls = { locks: 0, released: 0, saves: 0, stamp: [], confirm: null, cb: null, delPhoto: [], rendered: [], closed: [] };
  let n = 0;
  const c = world(POSTFN, Object.assign({
    uid: () => 'new' + (++n), acquireCompanyEditLock: async () => { calls.locks++; return true; }, verifyCompanyEditLock: async () => true, releaseCompanyEditLock: () => { calls.released++; },
    showConfirm: (m, cb) => { calls.confirm = m; calls.cb = cb; }, openStampModal: (sid) => calls.stamp.push(sid), deletePhotoFromDB: (sid) => calls.delPhoto.push(sid),
    getPhotoFromDB: async () => null, logPhoto: () => {}, isBlocked: () => '', coMainOf: (co) => co.defAtt, myId: () => 'a1',
    renderCal: () => calls.rendered.push('cal'), renderDash: () => calls.rendered.push('dash'), renderEndedView: () => calls.rendered.push('ended'), renderSummaryBar: () => calls.rendered.push('sum'),
    closeModal: (id) => { calls.closed.push(id); c._st.els['#' + id].classList.remove('open'); },
  }, over || {}));
  vm.runInContext('var _post=null; var PHOTOS={};', c);
  const orig = c.setScheds; c.setScheds = (v) => { calls.saves++; orig(v); };
  c._st.cos = [CO('c1', '가나상사', { types: ['t2'], endedTypes: { t2: '2026-10-24' } }), CO('c2', '라마바식품', { types: ['t2'] })];
  c._st.scheds = [D('c1', 't2', '2026-09-01', { round: 1, id: 'm1' }), D('c1', 't2', '2026-09-08', { round: 2, id: 'm2' }), D('c2', 't2', '2026-09-01', { round: 1, id: 'o1' })];
  c._calls = calls;
  return c;
}
const form = (c, date, memo) => { c._st.els['#postDate'] = { value: date }; c._st.els['#postMemo'] = { value: memo || '' }; };
const mainOnly = (c) => JSON.stringify(c._st.scheds.filter((s) => s.phase !== 'post'));

test('★ 사후 넣기 — 일정 한 줄이 늘고, 본 일정·사업(종료 상태)은 하나도 안 바뀐다', async () => {
  const c = postWorld(); c.openPostDrawer('c1', 't2');
  const beforeMain = mainOnly(c), beforeCos = JSON.stringify(c._st.cos);
  form(c, '2026-11-05', '임금 점검'); await c.postSave(false);
  const posts = c._st.scheds.filter((s) => s.phase === 'post');
  assert.strictEqual(posts.length, 1);
  assert.deepStrictEqual({ phase: posts[0].phase, date: posts[0].date, coId: posts[0].coId, typeId: posts[0].typeId, round: posts[0].round, isField: posts[0].isField, memo: posts[0].memo, attId: posts[0].attId },
    { phase: 'post', date: '2026-11-05', coId: 'c1', typeId: 't2', round: 1, isField: true, memo: '임금 점검', attId: 'a1' });
  assert.strictEqual(mainOnly(c), beforeMain, '본 일정은 글자까지 그대로(회차 번호 포함)');
  assert.strictEqual(JSON.stringify(c._st.cos), beforeCos, '★ 사업은 종료 상태 그대로 — 진행 목록에 다시 올라오지 않는다');
  assert.ok(!hasUndefined(J(c._st.scheds)), '저장 모양에 undefined 가 있으면 클라우드가 통째로 거부한다');
  assert.ok(c._calls.locks === 1 && c._calls.released === 1, '잠그고 → 저장 → 푼다');
  assert.ok(c._calls.rendered.includes('cal') && c._calls.rendered.includes('ended'), '달력과 종료 목록이 다시 그려진다');
});

test('사후 둘째·이른 날짜 — 사후끼리 날짜순으로 1,2,3 을 다시 매긴다', async () => {
  const c = postWorld(); c.openPostDrawer('c1', 't2');
  form(c, '2026-11-12'); await c.postSave(false);
  form(c, '2026-11-05'); await c.postSave(false);
  const posts = c._st.scheds.filter((s) => s.phase === 'post').sort((a, b) => (a.date < b.date ? -1 : 1));
  assert.deepStrictEqual(posts.map((s) => s.date + ':' + s.round), ['2026-11-05:1', '2026-11-12:2']);
  assert.strictEqual(mainOnly(c), JSON.stringify([D('c1', 't2', '2026-09-01', { round: 1, id: 'm1' }), D('c1', 't2', '2026-09-08', { round: 2, id: 'm2' }), D('c2', 't2', '2026-09-01', { round: 1, id: 'o1' })]));
});

test('메모가 비면 메모 칸을 아예 두지 않는다(undefined 금지) · 방문/사무실 선택이 저장된다', async () => {
  const c = postWorld(); c.openPostDrawer('c1', 't2'); c.postSetField(0);
  form(c, '2026-11-05', '  '); await c.postSave(false);
  const p = c._st.scheds.find((s) => s.phase === 'post');
  assert.strictEqual(p.isField, false); assert.ok(!('memo' in p), '빈 메모는 칸을 두지 않는다');
});

test('★ 막는 것 — 날짜 모양 · 같은 날 같은 사업 중복 · 담당 하루 한도 · 같은 사업장 다른 사업 같은 날 · 불가 날짜 (저장 안 하고 까닭을 말한다)', async () => {
  const mk = () => { const c = postWorld(); c._st.cos[0].types = ['t2', 't3']; c.openPostDrawer('c1', 't2'); return c; };
  let c = mk(); form(c, '11/05'); await c.postSave(false);
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0); assert.ok(/날짜/.test(c._st.toasts.join('|') + JSON.stringify(c._st.els['#postBody'])));
  c = mk(); form(c, '2026-09-08'); await c.postSave(false);    // 본 m2 와 같은 날
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0, '같은 날 같은 사업은 한 줄만');
  c = mk(); c._st.env = { maxDailyPerAtt: 1 }; c._st.scheds.push(D('c2', 't2', '2026-11-05', { id: 'busy' })); form(c, '2026-11-05'); await c.postSave(false);
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0, '담당이 그날 이미 한도');
  c = mk(); c._st.scheds.push(D('c1', 't3', '2026-11-05', { id: 'other' })); form(c, '2026-11-05'); await c.postSave(false);
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0, '같은 사업장이 그날 다른 사업으로 가는 날');
  c = postWorld({ isBlocked: () => '불가 날짜입니다' }); c.openPostDrawer('c1', 't2'); form(c, '2026-11-05'); await c.postSave(false);
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0, '불가 날짜');
  assert.ok(c._calls.released === c._calls.locks, '막혀도 잠금은 푼다');
});

test('잠금을 못 잡으면 아무 것도 저장하지 않는다', async () => {
  const c = postWorld({ acquireCompanyEditLock: async () => false }); c.openPostDrawer('c1', 't2'); form(c, '2026-11-05');
  const before = JSON.stringify(c._st.scheds); await c.postSave(false);
  assert.strictEqual(JSON.stringify(c._st.scheds), before); assert.strictEqual(c._calls.saves, 0);
});

test('★ 「추가하고 사진 넣기」 — 저장한 뒤 방금 만든 사후로 사진 창이 열린다', async () => {
  const c = postWorld(); c.openPostDrawer('c1', 't2'); form(c, '2026-11-05'); await c.postSave(true);
  const p = c._st.scheds.find((s) => s.phase === 'post');
  assert.deepStrictEqual(c._calls.stamp, [p.id]);
  const d = postWorld(); d.openPostDrawer('c1', 't2'); form(d, '2026-11-05'); await d.postSave(false);
  assert.deepStrictEqual(d._calls.stamp, [], '사진 없이 추가는 사진 창을 안 연다');
});

test('★ 사후 고치기 — 날짜·구분·메모만 바뀌고 나머지(사진 설정 등 다른 칸)는 그대로, 번호는 날짜순으로 다시', async () => {
  const c = postWorld(); c.openPostDrawer('c1', 't2');
  c._st.scheds.push(P('c1', 't2', '2026-11-05', { id: 'pa', round: 1, extraPhotos: 2, memo: '옛' }), P('c1', 't2', '2026-11-12', { id: 'pb', round: 2 }));
  c.postEdit('pa');
  assert.strictEqual(c._st.els['#postBody'].innerHTML.includes('postCancel()'), true, '수정 모드');
  form(c, '2026-11-20', '새 메모'); await c.postSave(false);
  const pa = c._st.scheds.find((s) => s.id === 'pa'), pb = c._st.scheds.find((s) => s.id === 'pb');
  assert.strictEqual(pa.date, '2026-11-20'); assert.strictEqual(pa.memo, '새 메모'); assert.strictEqual(pa.extraPhotos, 2, '다른 칸은 그대로');
  assert.deepStrictEqual([pb.round, pa.round], [1, 2], '날짜순으로 다시 번호');
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 2, '고쳤는데 한 줄이 늘면 안 된다');
});

test('★ 사후 지우기 — 그 줄과 사진만 지우고 번호를 다시 매긴다 (본 일정은 그대로)', async () => {
  const c = postWorld(); c.openPostDrawer('c1', 't2');
  c._st.scheds.push(P('c1', 't2', '2026-11-05', { id: 'pa', round: 1 }), P('c1', 't2', '2026-11-12', { id: 'pb', round: 2 }));
  const beforeMain = mainOnly(c);
  c.postDelete('pa'); assert.ok(/지울까요/.test(c._calls.confirm), '먼저 묻는다'); assert.ok(c._st.scheds.some((s) => s.id === 'pa'), '묻기만 했을 때는 안 지워진다');
  await c._calls.cb();
  assert.deepStrictEqual(c._st.scheds.filter((s) => s.phase === 'post').map((s) => s.id + ':' + s.round), ['pb:1']);
  assert.deepStrictEqual(c._calls.delPhoto, ['pa'], '사진 저장소에서도 지운다');
  assert.strictEqual(mainOnly(c), beforeMain);
});

test('★ 일괄 삭제 — 고른 것만, 건수를 묻고, 저장은 «한 번에»', async () => {
  const checks = [{ checked: true, dataset: { sid: 'pa' } }, { checked: false, dataset: { sid: 'pb' } }, { checked: true, dataset: { sid: 'pc' } }];
  const c = postWorld({ qa: (s) => (/post-ck:checked/.test(s) ? checks.filter((x) => x.checked) : checks) }); c.openPostDrawer('c1', 't2');
  c._st.scheds.push(P('c1', 't2', '2026-11-05', { id: 'pa', round: 1 }), P('c1', 't2', '2026-11-12', { id: 'pb', round: 2 }), P('c1', 't2', '2026-11-19', { id: 'pc', round: 3 }));
  assert.strictEqual(c.postSelKeys().length, 2);
  c.postBatchDelete(); assert.ok(/2건/.test(c._calls.confirm), '건수를 묻는다');
  assert.strictEqual(c._calls.saves, 0, '묻기만 했을 때는 아무 것도 안 바뀐다');
  await c._calls.cb();
  assert.deepStrictEqual(c._st.scheds.filter((s) => s.phase === 'post').map((s) => s.id + ':' + s.round), ['pb:1'], '고른 둘만 지우고 번호는 다시');
  assert.strictEqual(c._calls.saves, 2, '지우기 1번 + 번호 매기기 1번 — 건마다 저장하지 않는다');
});

test('달력의 사후 칩에서 열면 그 사업 서랍이 열리고 그 줄이 표시된다 · 사진 단추는 사진 창을 연다', () => {
  const c = postWorld(); c._st.scheds.push(P('c1', 't2', '2026-11-05', { id: 'pa', round: 1 }));
  c.openPostDrawer('c1', 't2', 'pa');
  assert.ok(c._st.els['#mbPost'].classList.contains('open'), '서랍 열림');
  assert.ok(/가나상사/.test(c._st.els['#postTitle'].textContent), '제목에 사업장');
  assert.ok(/post-row[^"]*on/.test(c._st.els['#postBody'].innerHTML), '눌러서 연 그 줄이 표시된다');
  c.postPhoto('pa'); assert.deepStrictEqual(c._calls.stamp, ['pa']);
  c.postPhoto('없는줄'); assert.deepStrictEqual(c._calls.stamp, ['pa'], '없는 줄은 사진 창을 안 연다');
  c.closePostDrawer(); assert.ok(!c._st.els['#mbPost'].classList.contains('open'));
});

test('★ 사후 코드는 새 localStorage 키·클라우드 키를 만들지 않는다 (기존 일정 한 자리에 같이 저장)', () => {
  const names = ['postListFor', 'postPhotoCount', 'postProblem', 'postBuildSched', 'postDrawerView', 'postDrawerHtml', 'renderPostDrawer', 'openPostDrawer', 'closePostDrawer', 'postSetField',
    'postEdit', 'postCancel', 'postFormRead', 'postSave', 'postDelete', 'postRemove', 'postThumbs', 'postBatchDelete', 'postSelKeys', 'postSelChange', 'postSelAll', 'postPhoto', 'postCellHtml'];
  names.forEach((n) => { const b = grab(n); assert.ok(!/lsSet\(|localStorage|fbPush\(|_fbDB\.ref\(|\.ref\(['"`]/.test(b), n + ' 이(가) 따로 저장하려 한다 — 일정(setScheds) 한 자리에만 쓴다'); });
});

/* ══ ⑫ 다른 곳에 안 섞인다 — 보고서 · 방문 문자 · 클리닉 회차 제안 ═══════════════ */

test('★ 기관 보고서(buildReport) — 사후 일정이 있어도 회차·경고·출처 목록이 똑같다', () => {
  const B = require('../js/pu-gov-report-build.js');
  const mk = (withPost) => {
    const b = {
      co: { id: 'c1', name: '가나상사', defAtt: 's1', defCoAtts: [], erpId: 'k1' }, type: { id: 'bxeyzrxm', name: '인사충남', fullName: '인사노무컨설팅충남북부상의', agency: '충남북부상공회의소' },
      scheds: [{ id: 'a', date: '2025-10-02', round: 2, phase: '', isField: false, memo: '임금체계 검토', typeId: 'bxeyzrxm', coId: 'c1' }, { id: 'b', date: '2025-09-04', round: 1, phase: '', isField: true, memo: '취업규칙 개정 요청', typeId: 'bxeyzrxm', coId: 'c1' }],
      cons: { programName: '인사노무컨설팅충남북부상의', company: { name: '가나상사', bizNo: '123-45-67890', ceo: '김가나', address: '충남 천안시 가나로 1', bizType: '제조업', bizCategory: '금속', employmentInsuredCount: 9, contacts: [] } },
      mail: [], sent: [], staffName: '이푸른', today: '2025-11-20', saved: null,
    };
    if (withPost) b.scheds.push({ id: 'p1', date: '2025-12-01', round: 1, phase: 'post', isField: true, memo: '사후 방문', typeId: 'bxeyzrxm', coId: 'c1' }, { id: 'p2', date: '2025-11-10', round: 2, phase: 'post', isField: false, memo: '사후 상담', typeId: 'bxeyzrxm', coId: 'c1' });
    return B.buildReport(b);
  };
  const a = mk(false), b = mk(true);
  assert.deepStrictEqual(J(b.report.rounds), J(a.report.rounds), '보고서 회차');
  assert.deepStrictEqual(J(b.warnings), J(a.warnings), '경고');
  assert.deepStrictEqual(J(b.feed), J(a.feed), '출처 목록');
});

test('★ 보고서 현황판·서류 관리(buildRows·pairs) — 모든 일정을 «사후» 로 한 벌 더 얹어도 결과가 똑같다', () => {
  const L = require('../js/pu-gov-report-list.js'), D2 = require('../js/pu-gov-report-docs.js'), F = require('./helpers/gov-report-fixture.js');
  const a = F.input('2026-10-10'), b = F.input('2026-10-10');
  b.scheds = (b.scheds || []).concat((a.scheds || []).map((s) => Object.assign({}, s, { id: 'post-' + s.id, phase: 'post' })));
  assert.ok(b.scheds.length > a.scheds.length && a.scheds.length > 0, '시험 자료에 일정이 있어야 한다');
  assert.deepStrictEqual(J(L.buildRows(b)), J(L.buildRows(a)), '현황판');
  const X = F.docs(); const pairsOf = (i) => D2.visibleTypes(X.biz).map((t) => J(D2.pairs(i, t.id, '2026')));
  assert.deepStrictEqual(pairsOf(b), pairsOf(a), '서류 관리');
});

test('★ 방문 안내 문자 계획 — 사후 방문은 문자를 만들지 않는다 (본 방문은 그대로)', () => {
  const V = require('../functions/visit-sms.js');
  const src = (phase) => ({ date: '2026-11-05', config: { targetAttIds: ['a1'] }, staff: [{ id: 'a1', name: '홍길동' }], companies: [],
    cos: [{ id: 'c1', name: '가나상사' }], scheds: [{ id: 's1', date: '2026-11-05', attId: 'a1', coId: 'c1', typeId: 't2', isField: true, phase }] });
  assert.strictEqual(V.planToday(src('main')).length, 1, '대조: 본 방문은 문자 대상');
  assert.strictEqual(V.planToday(src('post')).length, 0, '사후 방문은 문자 대상이 아니다');
});

test('★ 현장클리닉 회차 제안(clinicGovHint) — 사후 날짜를 수행일로 모으지 않는다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const cut = (head) => { const i = html.indexOf(head); assert.ok(i >= 0, head); let j = html.indexOf('{', i), d = 0; for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && --d === 0) break; } return html.slice(i, j + 1); };
  const ctx = { console, Object, Array, String, JSON, Math, Date, parseInt, window: {} }; vm.createContext(ctx);
  vm.runInContext((html.match(/^var CONS_ROLE_SEED = .*$/m) || [''])[0], ctx);
  ['function consNameKey(', 'function consTypeRole(', 'function consRoleOf(', 'function clinicGovHint('].forEach((h) => vm.runInContext(cut(h), ctx));
  const scal = (extra) => ({ types: { t3: { id: 't3', name: '현장클리닉' } }, cos: { g1: { id: 'g1', name: '㈜가나상사', erpId: 'erp-1' } },
    scheds: [{ coId: 'g1', typeId: 't3', date: '2026-06-01' }, { coId: 'g1', typeId: 't3', date: '2026-06-05' }].concat(extra || []) });
  const norm = (s) => String(s || '').replace(/㈜|\s/g, '');
  const base = ctx.clinicGovHint({ id: 'erp-1', companyName: 'x' }, scal(), norm);
  const withPost = ctx.clinicGovHint({ id: 'erp-1', companyName: 'x' }, scal([{ coId: 'g1', typeId: 't3', date: '2026-11-05', phase: 'post' }]), norm);
  assert.deepStrictEqual(Array.from(base.dates), ['2026-06-01', '2026-06-05']);
  assert.deepStrictEqual(Array.from(withPost.dates), Array.from(base.dates), '사후 날짜가 수행일로 섞이면 종료일·수행 일수 제안이 틀어진다');
});

/* ══ ⑬ 쓸어 담기 — 「phase !== 'pre'」 로만 거르는 곳은 사후도 말해야 한다 ═══════════ */

test('★ 일정을 «사전진단만 빼고» 거르는 곳은 전부 사후도 함께 뺀다 — 새로 만드는 보고서·집계가 사후를 흘리면 여기서 걸린다', () => {
  const files = ['gov-consulting.html', 'gov-report.html', 'work.html', 'pu-erp.html'];
  ['js', 'functions', 'functions/gov-report-core'].forEach((d) => { fs.readdirSync(path.join(ROOT, d)).filter((f) => /\.js$/.test(f) && !/\.test\.js$/.test(f)).forEach((f) => files.push(d + '/' + f)); });
  const re = /phase\s*!==?\s*'pre'/;
  const bad = [];
  files.forEach((f) => {
    const p = path.join(ROOT, f); if (!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((ln, i) => { if (re.test(ln) && !/post/i.test(ln)) bad.push(f + ':' + (i + 1)); });
  });
  assert.deepStrictEqual(bad, [], '이 줄들은 사전진단만 빼고 사후는 남긴다 — «&& phase !== \'post\'» 를 함께 쓴다(또는 isPostSched): ' + bad.join(', '));
});
