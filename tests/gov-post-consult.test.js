/* 사후컨설팅 — 정부컨설팅 일정관리 (대표 지시 2026-11-02 「사후컨설팅 방문 넣어라」 · 시안 승인 「추천대로」)

   사후컨설팅 = 사업이 «끝난 뒤» 이어지는 후속 방문. 일정 레코드에 phase:'post' 로 저장한다(사전진단 'pre'·본 'main' 과 같은 길).

   ■ 못 박는 규칙 (지금 값이 아니라 «규칙»)
     · 사후는 본 회차에 «안 들어간다» — 「사후 1회, 2회…」로 따로 센다. 본 일정이 늘고 줄어도 사후 번호는 안 흔들리고, 그 반대도 같다.
     · ★ 사후를 넣어도 본 회차 숫자(종료 목록·진행 목록·진척·타임라인·요약줄)는 «글자까지 똑같다».
     · 사업은 종료 상태 그대로 둔다 — 사후를 넣었다고 진행 목록에 다시 올라오지 않는다.
     · 달력에서 사후 칩은 잠기지 않는다(취소선·🔒 없음). 대신 끌어 옮기지 않고, 눌러도 본 일정 수정 창이 아니라 사후컨설팅 서랍이 열린다.
     · 같은 정부사업의 하루 규칙(같은 담당 하루 1건 · 기관 하루 1사업장)과 물리적 충돌(담당 하루 한도 · 같은 사업장 같은 날)은 «일반 일정과 같다» —
       사후와 본 방문은 같은 날 겹칠 수 없다(대표 지시 2026-11-10 「동일 정부사업에서 사후컨설팅과 기존 사업장 방문일은 중복되면 안 되게」. 처음엔 사후를 이 두 규칙에서 뺐다).
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
/* 진짜 qa() 는 NodeList 를 돌려준다 — forEach·length·[i] 는 되지만 map·filter·some 은 없다.
   가짜를 «배열»로 만들면 .map 이 있는 것처럼 보여 진짜 화면에서만 터진다(2026-11-05 postSelKeys·endedSelKeys 가 그랬다 — 서랍을 열기만 해도 그리기 끝에서 오류). */
const nl = (a) => Object.assign(Object.create({ forEach(f, t) { a.forEach(f, t); }, item(i) { return a[i] || null; }, [Symbol.iterator]() { return a[Symbol.iterator](); } }), a, { length: a.length });
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
    q: (s) => el(s), qa: () => nl([]), toast: (m) => st.toasts.push(String(m)), staffColor: () => '#ef6c35', isAdmin: () => true,
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

test('★ 달력 칩 — 종료된 사업의 «본» 칩은 🔒·취소선·끌기 막기, «사후» 칩은 잠기지 않고 «끌어 옮길 수 있다»', () => {
  const c = chipWorld();
  const main = c.chipHtml(D('c1', 't2', '2026-10-01', { round: 1 }));
  assert.ok(/is-ended/.test(main) && /🔒/.test(main) && /data-ended="1"/.test(main), '본 칩은 그대로 잠긴다');
  const post = c.chipHtml(P('c1', 't2', '2026-11-05', { round: 1 }));
  assert.ok(!/is-ended/.test(post) && !/🔒/.test(post) && /data-ended="0"/.test(post), '사후 칩은 잠기지 않는다: ' + post.slice(0, 160));
  assert.ok(/사후/.test(post), '칩에 «사후» 가 보인다');
  assert.ok(/draggable="true"/.test(post) && /data-mine="1"/.test(post), '★ 사후 칩도 끌어 옮긴다(2026-11-10 대표 지시) — 끌 수 없으면 글자만 선택된다: ' + post.slice(0, 200));
  assert.ok(/끌어서 날짜 이동 가능/.test(post), '말풍선으로 알린다');
  const mainEnded = c.chipHtml(D('c1', 't2', '2026-10-01', { round: 1 }));
  assert.ok(/draggable="false"/.test(mainEnded), '종료된 본 칩은 여전히 못 끈다');
});

test('★ 사후 칩을 눌러도 본 일정 수정 창이 아니라 «사후컨설팅 서랍»이 열린다 · 본 칩은 예전 그대로', async () => {
  const opened = []; const edits = [];
  const c = world(['isPostSched', 'isEndedSchedule', 'endedDateForSchedule', 'openEditModal'], {
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
});

/* ══ ⑤ 충돌 검사 — 사업 규칙에서는 빠지고, 물리적 충돌은 그대로 ════════ */

const CF = ['isPostSched', 'isConflictPair', 'conflictKey', 'coMainOf', 'checkConflictMatrix', 'checkAgencyExclusive', 'agencyOtherSiteOn', 'dayConflictMsg', 'checkAttLimit', 'coOtherTypeOn', 'getCoAtts'];
function cfWorld() {
  const c = world(CF, { coMainOf: (co) => co.defAtt });
  c._st.cos = [CO('c1', '가나상사'), CO('c2', '라마바식품')];
  c._st.matrix = { t2__t2: true };   // 「같은 담당 하루 1건」 켬
  return c;
}

/* ★ 2026-11-10 대표 지시 「동일 정부사업에서 사후컨설팅과 기존 사업장 방문일은 중복되면 안 되게」 —
   처음엔 사후를 이 두 규칙에서 «뺐다». 이제는 «센다»: 그 규칙을 켜 둔 사업은 사후와 본 방문이 같은 날 겹칠 수 없다(다른 사업장끼리도). */
test('★ 같은 담당 하루 1건 — 다른 사업장의 «사후»도 «본»과 똑같이 걸림돌이다 (까닭에 «사후컨설팅» 이라고 적는다)', () => {
  const c = cfWorld();
  c._st.scheds = [P('c2', 't2', '2026-11-05')];
  const msg = c.checkConflictMatrix('c1', 't2', '2026-11-05') || '';
  assert.ok(/같은 날 중복/.test(msg) && /라마바식품/.test(msg) && /사후컨설팅/.test(msg), '사후도 막고, 사후라고 말해 준다: ' + msg);
  c._st.scheds = [D('c2', 't2', '2026-11-05')];
  const main = c.checkConflictMatrix('c1', 't2', '2026-11-05') || '';
  assert.ok(/같은 날 중복/.test(main) && /일정이 있습니다/.test(main) && !/사후/.test(main), '본 일정은 예전 글자 그대로: ' + main);
  c._st.scheds = [P('c2', 't2', '2026-11-06')];
  assert.strictEqual(c.checkConflictMatrix('c1', 't2', '2026-11-05'), null, '다른 날이면 통과');
  c._st.scheds = [P('c1', 't2', '2026-11-05')];
  assert.strictEqual(c.checkConflictMatrix('c1', 't2', '2026-11-05'), null, '같은 사업장끼리는 이 규칙이 아니다(같은 날 같은 사업 중복 방지가 따로 막는다)');
});

test('★ 기관 하루 1사업장 — 다른 사업장의 사후도 걸림돌이고, 달력 칸 표시(agencyOtherSiteOn)도 같다', () => {
  const c = cfWorld();
  c._st.scheds = [P('c2', 't3', '2026-11-05', { typeId: 't3' })];
  const msg = c.checkAgencyExclusive('c1', 't3', '2026-11-05') || '';
  assert.ok(/하루에 한 사업장만/.test(msg) && /라마바식품/.test(msg) && /사후컨설팅/.test(msg), msg);
  assert.strictEqual(c.agencyOtherSiteOn('c1', 't3', '2026-11-05'), '라마바식품', '등록 달력에서도 그 날이 막힌다');
  c._st.scheds = [D('c2', 't3', '2026-11-05')];
  const main = c.checkAgencyExclusive('c1', 't3', '2026-11-05') || '';
  assert.ok(main && /일정이 있습니다/.test(main) && !/사후/.test(main), '본 일정은 예전 글자 그대로: ' + main);
  assert.strictEqual(c.agencyOtherSiteOn('c1', 't3', '2026-11-05'), '라마바식품');
  c._st.scheds = [P('c2', 't2', '2026-11-05')];
  assert.strictEqual(c.checkAgencyExclusive('c1', 't2', '2026-11-05'), null, '이 규칙을 켜지 않은 사업(t2)은 예전처럼 안 막는다');
});

test('달력의 «같은 날 중복» 경고 배지에도 사후가 센다 (같은 담당 하루 1건 사업의 본 방문과 사후가 겹치면 경고)', () => {
  const c = cfWorld();
  c._st.scheds = [D('c1', 't2', '2026-11-05'), P('c2', 't2', '2026-11-05')];
  assert.ok(c.dayConflictMsg('2026-11-05'), '본 + 다른 사업장 사후 → 경고');
  c._st.scheds = [D('c1', 't2', '2026-11-05'), P('c1', 't2', '2026-11-05')];
  assert.strictEqual(c.dayConflictMsg('2026-11-05'), null, '같은 사업장의 본 + 사후는 이 배지가 아니다(단순 중복은 따로)');
  c._st.scheds = [D('c1', 't2', '2026-11-05'), D('c2', 't2', '2026-11-05')];
  assert.ok(c.dayConflictMsg('2026-11-05'), '본 둘이면 예전처럼 경고');
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
  'roundText', 'chipRound', 'schedulePlaceLabel', 'schedulePlaceShort', 'scheduleHoverTitle', 'postListFor', 'postPhotoCount', 'postTypeDone', 'dashPostItem', 'getCoPostTarget', 'postCountText', 'postCanAdd'];
function scene(withPost) {
  const c = world(VIEWS, {
    PRE_ROUND_CAP: 2, S: { tlStatus: 'active' }, _mpMine: false, _mpOpen: '', _tzKey: { coId: 'c1', tid: 't2' },
    getFieldState: () => true, getPostFieldState: () => true, roundIssueBadge: () => '',deadlineBadge: () => '', dashRowBtns: () => '', deadlineBadgeCompact: () => '',
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
  /* 진행 목록 줄의 「사후컨설팅」 항목(.post-item)은 «새로 얹은 칸»이다 — 본 회차 글자만 비교하려고 그 칸만 뺀다(⑰ 에서 따로 본다) */
  const noPost = (h) => String(h).replace(/<div class="round-badge post-item"[^>]*>[\s\S]*?<\/div>/g, '');
  c._st.cos.forEach((co) => { out['rows:' + co.id + ':on'] = noPost(c.renderDashTypeRows(co, types, true)); out['rows:' + co.id + ':off'] = noPost(c.renderDashTypeRows(co, types, false)); });
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
    ['isPostSched', 'getMainScheds', 'schedHasPhoto', 'postPhotoCount', 'getCoPostTarget', 'endedRuleList', 'endedDays', 'endedMd', 'endedFlagsFor', 'endedInfos'].filter(has).map(grab).join('\n'), ctx);
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
  movePost: '일부러 «사후만» 센다(isPostSched 로 거른다) — 옮긴 뒤 사후끼리 번호가 바뀌었는지 본다',
  moveDayProblem: '같은 날 같은 사업 중복 방지 — 사후도 센다(본 칩을 옮길 때 사후와 겹치면 안 된다)',
  mainDropProblem: '같은 날 같은 사업 중복 방지 — 사후도 센다(본 회차를 놓을 때 사후와 겹치면 안 된다)',
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

const VIEW = ['endedHi', 'endedPeopleHtml', 'postCellHtml', 'postCountText', 'endedListHtml'];
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
  assert.ok((h.match(/class="post-rule"/g) || []).length >= 3, '규칙 안내 줄');
  assert.ok(/본 회차/.test(h) && /종료/.test(h) && /달력/.test(h), '안내 내용: 본 회차에 안 들어감 · 종료 그대로 · 달력 칩');
  const rules = (h.match(/<div class="post-rule">[\s\S]*?<\/div>/g) || []).join(' ');
  assert.ok(/끌어 넣어도/.test(rules) && /방문·사무실은 항목 옆 단추/.test(rules), '안내: 진행 목록 항목을 끌어 넣고 방문/사무실은 항목 옆 단추로 고른다');
  assert.ok(/같은 사업장의 같은 사업 방문일에는 못 넣고/.test(rules) && /기관 하루 1건/.test(rules) && /다른 사업장의 방문일에도 못 넣습니다/.test(rules), '안내: 겹침 규칙(같은 사업장·켜 둔 사업은 다른 사업장도)');
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

const POSTFN = ['isPostSched', 'getMainScheds', 'mainPhaseScheds', 'postTypeDone', 'schedPhase', 'isPrePhaseType', 'roundIsFixed', 'reorderRounds', 'postListFor', 'postPhotoCount', 'schedHasPhoto',
  'postProblem', 'postBuildSched', 'postDrawerView', 'postDrawerHtml', 'renderPostDrawer', 'openPostDrawer', 'closePostDrawer', 'postSetField', 'postEdit', 'postCancel',
  'postFormRead', 'postSave', 'postDelete', 'postRemove', 'postThumbs', 'postBatchDelete', 'postSelKeys', 'postSelChange', 'postSelAll', 'postPhoto', 'coOtherTypeOn', 'checkAttLimit', 'getCoAtts',
  'getCoPostTarget', 'postCountText', 'postTargetOn', 'postSetTarget', 'endedMutate', 'postCanAdd', 'postAddedText', 'postDragStart', 'postDragEnd', 'handlePostDrop',
  /* 2026-11-10 — 사후도 «같은 정부사업 하루 규칙»(같은 담당 하루 1건 · 기관 하루 1사업장)을 따른다 · 끌 때 방문/사무실 */
  'checkConflictMatrix', 'checkAgencyExclusive', 'isConflictPair', 'conflictKey', 'getPostFieldState', 'setPostFieldState', 'postPickField',
  /* 2026-11-10 — 겹치면 팝업으로 알리고 다른 날짜로 옮겨 다시 한다 · 사후 칩 끌어 옮기기 */
  'postFail', 'dupWho', 'movePost', 'moveChip', 'moveDayProblem', 'isEndedSchedule', 'endedDateForSchedule', 'mainDropProblem', 'handleDrop'];
/* 가짜 localStorage — 방문/사무실 기억(p_fieldState)을 실제로 읽고 쓰게 한다. 새 키가 생기면 lsKeys 에 보인다. */
function fakeLs() {
  const m = {}; const writes = [];
  return { m, writes, ls: { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }, lsSet: (k, v) => { m[k] = String(v); writes.push(k); }, fbPush: (k, v) => writes.push('fb:' + k) };
}
function postWorld(over) {
  const calls = { locks: 0, released: 0, saves: 0, stamp: [], confirm: null, cb: null, delPhoto: [], rendered: [], closed: [], popups: [], logs: [] };
  let n = 0;
  const fl = fakeLs();
  const c = world(POSTFN, Object.assign({
    localStorage: fl.ls, lsSet: fl.lsSet, fbPush: fl.fbPush,
    dupPopupOpen: (o) => { calls.popups.push(o); c._st.toasts.push('[팝업] ' + String(o.msg).split(String.fromCharCode(10)).join(' ')); },
    checkExclusiveDay: () => null, canEdit: () => true, ensurePhaseState: () => {}, curPhase: () => 'main', logRoundChange: (...a) => calls.logs.push(a), showBigAlert: (m) => c._st.toasts.push('[큰알림] ' + m), showConfirm: (m, cb) => { calls.confirm = m; calls.cb = cb; },
    uid: () => 'new' + (++n), acquireCompanyEditLock: async () => { calls.locks++; return true; }, verifyCompanyEditLock: async () => true, releaseCompanyEditLock: () => { calls.released++; },
    showConfirm: (m, cb) => { calls.confirm = m; calls.cb = cb; }, openStampModal: (sid) => calls.stamp.push(sid), deletePhotoFromDB: (sid) => calls.delPhoto.push(sid),
    getPhotoFromDB: async () => null, logPhoto: () => {}, isBlocked: () => '', coMainOf: (co) => co.defAtt, myId: () => 'a1',
    renderCal: () => calls.rendered.push('cal'), renderDash: () => calls.rendered.push('dash'), renderEndedView: () => calls.rendered.push('ended'), renderSummaryBar: () => calls.rendered.push('sum'),
    closeModal: (id) => { calls.closed.push(id); c._st.els['#' + id].classList.remove('open'); },
  }, over || {}));
  vm.runInContext('var _post=null; var PHOTOS={};', c);
  calls.raw = [];
  const orig = c.setScheds; c.setScheds = (v) => { calls.saves++; calls.raw.push(v); orig(v); };   // v 는 «날것» — JSON 을 거치면 undefined 가 사라져 안 보인다
  c._st.cos = [CO('c1', '가나상사', { types: ['t2'], endedTypes: { t2: '2026-10-24' } }), CO('c2', '라마바식품', { types: ['t2'] })];
  c._st.scheds = [D('c1', 't2', '2026-09-01', { round: 1, id: 'm1' }), D('c1', 't2', '2026-09-08', { round: 2, id: 'm2' }), D('c2', 't2', '2026-09-01', { round: 1, id: 'o1' })];
  c._calls = calls; c._ls = fl;
  return c;
}
const form =(c, date, memo) => { c._st.els['#postDate'] = { value: date }; c._st.els['#postMemo'] = { value: memo || '' }; };
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
  assert.ok(c._calls.raw.length >= 1 && c._calls.raw.every((v) => !hasUndefined(v)), '★ 저장하려고 넘긴 «날것»에 undefined 가 있으면 클라우드가 통째로 거부한다');
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
  assert.ok(c._calls.raw.every((v) => !hasUndefined(v)), '★ 빈 메모를 undefined 로 넘기면 클라우드가 통째로 거부한다(JSON 을 거치면 가려지니 날것으로 본다)');
  assert.ok(c._calls.raw.every((v) => v.every((s) => !('memo' in s) || typeof s.memo === 'string')));
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
  const c = postWorld({ qa: (s) => nl(/post-ck:checked/.test(s) ? checks.filter((x) => x.checked) : checks) }); c.openPostDrawer('c1', 't2');
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
    'postEdit', 'postCancel', 'postFormRead', 'postSave', 'postDelete', 'postRemove', 'postThumbs', 'postBatchDelete', 'postSelKeys', 'postSelChange', 'postSelAll', 'postPhoto', 'postCellHtml', 'getCoPostTarget', 'postTargetOn', 'postTargetsClean', 'postCountText'];
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

/* ══ ⑭ 사진 흐름 연결 — 사후도 본 일정과 «같은 증빙 사진 흐름»을 탄다 ═══════════════ */

test('★ 사진 창 제목·파일 이름이 사후를 말하고, 사진을 저장하면 서랍과 종료 목록의 사진 수가 다시 그려진다', () => {
  assert.ok(/isPostSched\(sc\)/.test(grab('openStampModal')), '사진 창 제목에 「사후」 — 본 회차와 같은 숫자로 보이면 안 된다');
  const save = grab('saveStamp');
  assert.ok(/_post[\s\S]{0,80}renderPostDrawer\(\)/.test(save) && /renderEndedView\(\)/.test(save), '사진을 저장하면 열려 있는 서랍의 썸네일과 종료 목록의 📷 수를 다시 그린다');
  const bad = [];
  SRC.split(/\r?\n/).forEach((ln, i) => { if (/schedPhase\(sc\)==='pre'\?'사전진단'/.test(ln) && !/isPostSched/.test(ln)) bad.push(i + 1); });
  assert.deepStrictEqual(bad, [], '사진 파일 이름에 「사전진단」 을 붙이는 줄은 「사후」 도 붙인다(본 회차 사진과 이름이 같아지면 덮어쓴다): 줄 ' + bad.join(', '));
});

test('사후 칩 모양 — 서랍 CSS 와 칩 표시가 있고, 새 색을 만들지 않는다(기존 변수만)', () => {
  const css = (SRC.match(/\.ended-pbtn\{[\s\S]*?\n\.post-rule::before\{[^}]*\}/) || [''])[0];
  assert.ok(css.length > 500, '사후컨설팅 CSS 덩어리가 있다');
  assert.deepStrictEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) || [], [], '사후컨설팅 CSS 에 새 색(#rrggbb)을 쓰지 않는다 — 기존 변수(var(--accent) 등)만');
  assert.ok(/\.chip\.is-post\{/.test(SRC) && /id="mbPost"/.test(SRC) && /id="postBody"/.test(SRC), '칩 표시와 서랍 뼈대');
});

/* ══ ⑮ 서랍이 «사업 상태»를 알아본다 · 사진 썸네일 ═══════════════════════════ */

test('★ 서랍을 열면 사업 상태를 알아본다 — 종료: 입력칸 · 수정 중: 입력칸 + 원래 종료일 · 진행 중: 입력칸 없이 까닭', () => {
  const c = postWorld();
  c._st.cos.push(CO('c3', '사아정밀', { types: ['t2'], reopened: { t2: { was: '2026-10-10', at: '2026-11-01', by: '홍길동' } } }));
  const html = () => c._st.els['#postBody'].innerHTML;
  c.openPostDrawer('c1', 't2');
  assert.ok(/id="postDate"/.test(html()) && /종료 2026-10-24/.test(html()), '종료된 사업');
  c.openPostDrawer('c3', 't2');
  assert.ok(/id="postDate"/.test(html()) && /수정 중/.test(html()) && /2026-10-10/.test(html()), '수정 중인 사업');
  c.openPostDrawer('c2', 't2');
  assert.ok(!/id="postDate"/.test(html()) && /본 회차를 모두 마쳤거나 종료된/.test(html()), '진행 중인 사업에는 사후를 넣을 수 없다');
});

test('★ 진행 중인 사업에는 «함수로도» 사후를 못 넣는다 — 서랍의 입력칸을 안 그린 것만으로는 부족하다', async () => {
  const c = postWorld(); c.openPostDrawer('c2', 't2'); form(c, '2026-11-05');
  await c.postSave(false);
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0, '진행 중인 사업(c2)에 사후가 생겼다');
  assert.ok(c._st.toasts.some((t) => /종료된 사업/.test(t)), '왜 안 되는지 말해 준다');
});

test('사진 썸네일 — 저장된 사진 두 칸을 작게 줄여 서랍에 보여 준다 (사진이 없으면 «사진 없음»)', () => {
  const canvas = { width: 800, height: 600, toDataURL: () => 'data:image/jpeg;base64,BIG' };
  const small = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,SMALL' };
  const c = postWorld({ document: { createElement: () => Object.assign({}, small) } });
  c._st.scheds.push(P('c1', 't2', '2026-11-05', { id: 'pa', round: 1 }), P('c1', 't2', '2026-11-12', { id: 'pb', round: 2 }));
  c.PHOTOS.pa = { c0: canvas, c1: canvas, o0: canvas };
  c.openPostDrawer('c1', 't2');
  const h = c._st.els['#postBody'].innerHTML;
  assert.strictEqual((h.match(/<img src="data:image\/jpeg;base64,SMALL"/g) || []).length, 2, '사진 두 칸만 — 원본(o0)은 안 그린다 · 줄여서 글자로 바꾼다');
  assert.ok(/사진 없음/.test(h), '사진이 없는 줄');
});

/* ══ ⑯ 변이 검사가 찾아낸 빈틈을 메우는 검사 ═══════════════════════════════ */

test('★ 사후가 본 일정보다 «이른 날짜»여도 본 번호는 1부터 그대로다 — 단계 없는 종류·일터혁신 둘 다', () => {
  const c = world(RO);
  c._st.scheds = [P('c1', 't2', '2026-11-01'), D('c1', 't2', '2026-11-10'), D('c1', 't2', '2026-11-17')];
  c.reorderRounds('c1', 't2');
  assert.deepStrictEqual(roundsOf(c, 'c1', 't2', 'main'), [1, 2], '사후(11-01)가 먼저 와도 본은 1,2 — 사후가 번호를 하나 먹으면 2,3 이 된다');
  assert.deepStrictEqual(roundsOf(c, 'c1', 't2', 'post'), [1]);
  const d = world(RO);
  d._st.scheds = [P('c1', 't1', '2026-11-01'), D('c1', 't1', '2026-11-10'), D('c1', 't1', '2026-11-17')];
  d.reorderRounds('c1', 't1');
  assert.deepStrictEqual(roundsOf(d, 'c1', 't1', 'main'), [1, 2]);
  assert.deepStrictEqual(roundsOf(d, 'c1', 't1', 'post'), [1]);
});

test('★ 지우기는 «사후 줄만» 지운다 — 본 일정 번호가 섞여 들어와도(오래된 화면·잘못 만든 DOM) 본 일정은 남는다', async () => {
  const c = postWorld(); c.openPostDrawer('c1', 't2');
  c._st.scheds.push(P('c1', 't2', '2026-11-05', { id: 'pa', round: 1 }));
  await c.postRemove(['m1', 'pa', 'o1']);
  assert.deepStrictEqual(c._st.scheds.map((s) => s.id).sort(), ['m1', 'm2', 'o1'], '사후(pa)만 사라지고 본 일정 셋은 그대로');
});

/* ══ ⑰ 진행 목록 줄의 「사후컨설팅」 항목 (대표 지시 2026-11-03 — 사진 「✓ 완료 15/15회 · 방문 9/9회」 줄에 사후컨설팅 회수·사진 입력) ═════
   본 회차를 «다 마쳤지만 아직 종료 전»인 사업에서도 사후를 넣는다. 줄에는 「＋ 사후컨설팅」 / 「사후 N회 · 📷M」 가 달리고, 누르면 서랍이 열린다.
   ★ 이 항목은 «새로 얹은 칸»일 뿐 본 회차 숫자를 바꾸지 않는다 — 불변 검사는 이 칸만 빼고 비교한다. */

const postItems = (html) => (html.match(/<div class="round-badge post-item"[^>]*>[\s\S]*?<\/div>/g) || []);
function dashScene(withPost) {
  const c = scene(withPost);
  return c;
}
const rowOf = (c, coId, showEnded) => c.renderDashTypeRows(c._st.cos.find((x) => x.id === coId), c.getTypes(), showEnded !== false);

test('★ 본 회차를 «다 마친» 사업 판정 — 최대 회차가 있고 본 일정이 그만큼일 때만 (사후·사전진단은 안 센다)', () => {
  const c = world(['isPrePhaseType', 'schedPhase', 'isPostSched', 'getMainScheds', 'mainPhaseScheds', 'postTypeDone']);
  c._st.cos = [CO('c1', '가나상사', { types: ['t2'] })];
  const done3 = [1, 2, 3].map((i) => D('c1', 't2', '2026-09-0' + i, { round: i }));
  c._st.scheds = done3.slice(0, 2).concat(P('c1', 't2', '2026-11-01'), P('c1', 't2', '2026-11-02'), P('c1', 't2', '2026-11-03'));
  assert.strictEqual(c.postTypeDone(c.getCos()[0], 't2'), false, '본 2/3 — 사후가 셋 있어도 완료가 아니다');
  c._st.scheds = done3;
  assert.strictEqual(c.postTypeDone(c.getCos()[0], 't2'), true, '본 3/3');
  const c2 = world(['isPrePhaseType', 'schedPhase', 'isPostSched', 'getMainScheds', 'mainPhaseScheds', 'postTypeDone'], { getCoMaxRounds: () => 0 });
  c2._st.scheds = done3;
  assert.strictEqual(c2.postTypeDone({ id: 'c1' }, 't2'), false, '최대 회차가 없으면(0) «다 마쳤다»를 말할 수 없다');
  const c3 = world(['isPrePhaseType', 'schedPhase', 'isPostSched', 'getMainScheds', 'mainPhaseScheds', 'postTypeDone']);
  c3._st.scheds = [D('c1', 't1', '2026-08-01', { phase: 'pre' }), D('c1', 't1', '2026-08-02', { phase: 'pre' }), D('c1', 't1', '2026-09-01'), D('c1', 't1', '2026-09-02')];
  assert.strictEqual(c3.postTypeDone({ id: 'c1' }, 't1'), false, '일터혁신 본 2/4 — 사전진단 둘은 본이 아니다');
});

test('★ 진행 목록 줄 — 완료된 줄에 「＋ 사후컨설팅」, 아직 진행 중이고 사후도 없는 줄에는 없다', () => {
  const c = dashScene(false);
  const done = rowOf(c, 'c1');                     // 현장클리닉 3/3 — 완료 줄
  assert.ok(/✓ 완료/.test(done), '대조: 이 줄은 완료 줄이다');
  const it = postItems(done);
  assert.strictEqual(it.length, 1, '완료 줄에 사후 항목 하나');
  assert.ok(/＋ 사후컨설팅/.test(it[0]) && /openPostDrawer\('c1','t2'\)/.test(it[0]), it[0]);
  assert.strictEqual(postItems(rowOf(c, 'c4')).length, 0, '본 2/3 — 아직 진행 중이고 사후도 없다');
  assert.strictEqual(postItems(rowOf(c, 'c2')).length, 0, '일터혁신 본 2/4 — 진행 중');
});

test('★ 진행 목록 줄 — 사후가 있으면 「사후 N회 · 📷M」, 진행 중인 줄에도 보인다(이미 입력한 것을 잃지 않게)', () => {
  const c = dashScene(true);
  c.PHOTOS['c4t2post2026-10-28'] = { c0: 1, c1: 1 }; c.PHOTOS['c4t2post2026-11-30'] = { c0: 1 };
  const it = postItems(rowOf(c, 'c4'));
  assert.strictEqual(it.length, 1);
  assert.ok(/사후 2회/.test(it[0]) && /📷3/.test(it[0]) && /openPostDrawer\('c4','t2'\)/.test(it[0]), it[0]);
  const none = postItems(rowOf(dashScene(true), 'c2'));
  assert.ok(/사후 2회/.test(none[0]) && !/📷/.test(none[0]), '사진이 없으면 📷 를 안 붙인다');
});

test('종료된 사업의 줄(종료·전체 보기)에도 사후 항목이 있다 — 진행 중 보기에서는 그 줄이 아예 없다', () => {
  const c = dashScene(false);
  const it = postItems(rowOf(c, 'c3', true));
  assert.strictEqual(it.length, 1); assert.ok(/openPostDrawer\('c3','t2'\)/.test(it[0]));
  assert.strictEqual(rowOf(c, 'c3', false), '', '진행 중 보기에서는 종료된 줄이 숨는다(예전 그대로)');
});

test('항목 단추는 줄을 끌거나 누르는 동작과 섞이지 않는다 · 항목은 본 회차 글자를 하나도 안 바꾼다', () => {
  const c = dashScene(false);
  const html = rowOf(c, 'c1');
  assert.ok(/event\.stopPropagation\(\);openPostDrawer/.test(html), '줄 전체에 달린 동작(끌기·열기)과 겹치지 않게 막는다');
  const stripped = html.replace(/<div class="round-badge post-item"[^>]*>[\s\S]*?<\/div>/g, '');
  assert.ok(/✓ 완료 3\/3회/.test(stripped) && !/사후/.test(stripped), '항목을 빼면 예전 줄 그대로');
});

test('★ 서랍 — 본 회차를 다 마친 사업은 입력칸이 열린다(종료 전이어도) · 진행 중이면 까닭을 말한다', () => {
  const c = postWorld();
  c._st.cos.push(CO('c3', '사아정밀', { types: ['t2'] }));
  c._st.scheds.push(...[1, 2, 3].map((i) => D('c3', 't2', '2026-09-0' + i, { round: i, id: 'x' + i })));
  const html = () => c._st.els['#postBody'].innerHTML;
  c.openPostDrawer('c3', 't2');
  assert.ok(/id="postDate"/.test(html()) && /본 회차 완료/.test(html()), '완료(종료 전)');
  c.openPostDrawer('c2', 't2');
  assert.ok(!/id="postDate"/.test(html()) && /본 회차를 모두 마쳤거나 종료된/.test(html()), '진행 중: ' + html().slice(0, 120));
});

test('★ 본 회차를 다 마친 사업에는 «함수로도» 사후가 들어간다 — 사업은 그대로(종료되지 않는다)', async () => {
  const c = postWorld();
  c._st.cos.push(CO('c3', '사아정밀', { types: ['t2'] }));
  c._st.scheds.push(...[1, 2, 3].map((i) => D('c3', 't2', '2026-09-0' + i, { round: i, id: 'x' + i })));
  const beforeCos = JSON.stringify(c._st.cos);
  c.openPostDrawer('c3', 't2'); form(c, '2026-11-05', '사후 상담'); await c.postSave(false);
  const p = c._st.scheds.filter((s) => s.phase === 'post');
  assert.deepStrictEqual(p.map((s) => s.coId + ':' + s.round + ':' + s.date), ['c3:1:2026-11-05']);
  assert.strictEqual(JSON.stringify(c._st.cos), beforeCos, '★ 사업(종료 여부 포함)은 하나도 안 바뀐다');
  assert.deepStrictEqual(c._st.scheds.filter((s) => s.coId === 'c3' && s.phase !== 'post').map((s) => s.round), [1, 2, 3], '본 회차 번호 그대로');
});

/* ══ ⑱ 사후컨설팅 «목표 회수» (대표 지시 2026-11-05 「횟수넣는것도 넣어라」) ═════════════════════════════
   사업장×종류마다 «사후를 몇 번 하기로 했는지»를 넣는다 — 사업장 설정 customPost[종류] (최대회차·의무방문과 같은 자리).
   넣으면 진행 목록·종료 목록·서랍이 「사후 N/M회」로 보이고, 채우면 ✓. 비우면 예전처럼 입력한 만큼만 센다.
   ★ 목표는 «보는 숫자»일 뿐이다 — 본 회차 숫자·사후를 넣고 못 넣는 규칙은 바뀌지 않는다(목표를 넘겨도 막지 않는다). */

test('★ 목표 회수 고치기 — 1~20 정수는 저장, 비우거나 0 은 «칸을 지운다», 틀린 값은 까닭과 함께 거절한다 (undefined·빈 객체를 안 남긴다)', () => {
  const c = world(['postTargetOn']);
  const co = { id: 'c1', name: '가나상사' };
  assert.deepStrictEqual(J(c.postTargetOn(co, 't2', '3')), { ok: true, from: 0, to: 3 });
  assert.deepStrictEqual(J(co.customPost), { t2: 3 });
  c.postTargetOn(co, 't1', 5);
  assert.deepStrictEqual(J(co.customPost), { t2: 3, t1: 5 }, '다른 종류의 목표는 서로 안 건드린다');
  assert.strictEqual(c.postTargetOn(co, 't2', 3).ok, false, '같은 값이면 바뀐 것이 없다');
  assert.strictEqual(c.postTargetOn(co, 't2', '20').ok, true, '20 은 허용(경계)');
  ['21', '-1', '2.5', 'abc'].forEach((bad) => {
    const r = c.postTargetOn(co, 't2', bad);
    assert.strictEqual(r.ok, false, bad); assert.ok(/0~20/.test(r.msg), bad + ' → ' + r.msg);
    assert.strictEqual(co.customPost.t2, 20, '틀린 값은 저장돼 있던 값을 건드리지 않는다: ' + bad);
  });
  assert.strictEqual(c.postTargetOn(co, 't2', '').ok, true);
  assert.deepStrictEqual(J(co.customPost), { t1: 5 }, '빈 칸 = 그 종류 목표만 지운다');
  c.postTargetOn(co, 't1', 0);
  assert.ok(!('customPost' in co), '마지막 칸을 지우면 빈 객체도 남기지 않는다(실시간DB 가 거부한다)');
  assert.ok(!hasUndefined(co));
  assert.strictEqual(c.postTargetOn(co, 't1', '').ok, false, '지울 것이 없으면 아무 일도 안 한다');
});

test('★ 사업장 수정 창의 값 거르기(postTargetsClean) — 1~20 정수만 남고, 빈 칸·undefined·0·소수·20 초과는 «목표 없음»', () => {
  const c = world(['postTargetsClean']);
  const out = c.postTargetsClean({ a: 3, b: undefined, c: 0, d: 2.5, e: 21, f: '4', g: '', h: -1, i: 20, j: 1 });
  assert.deepStrictEqual(J(out), { a: 3, f: 4, i: 20, j: 1 });
  assert.ok(!hasUndefined(out));
  assert.deepStrictEqual(J(c.postTargetsClean(undefined)), {});
});

test('getCoPostTarget — 사업장×종류 값을 읽고, 없거나 이상한 값은 «목표 없음(0)»이다', () => {
  const c = world(['getCoPostTarget']);
  c._st.cos = [CO('c1', '가나상사', { customPost: { t2: 3, t3: 'x', t1: 0 } }), CO('c2', '라마바식품')];
  assert.strictEqual(c.getCoPostTarget('c1', 't2'), 3);
  ['t3', 't1', 't9'].forEach((t) => assert.strictEqual(c.getCoPostTarget('c1', t), 0, t));
  assert.strictEqual(c.getCoPostTarget('c2', 't2'), 0);
  assert.strictEqual(c.getCoPostTarget('없는곳', 't2'), 0);
});

test('사후 회수 글자 — 목표가 없으면 「사후 N회」, 있으면 「사후 N/M회」, 채우면 앞에 ✓', () => {
  const c = world(['postCountText']);
  assert.strictEqual(c.postCountText(2, 0), '사후 2회');
  assert.strictEqual(c.postCountText(0, 0), '사후 0회');
  assert.strictEqual(c.postCountText(0, 3), '사후 0/3회');
  assert.strictEqual(c.postCountText(1, 3), '사후 1/3회');
  assert.strictEqual(c.postCountText(3, 3), '✓ 사후 3/3회');
  assert.strictEqual(c.postCountText(4, 3), '✓ 사후 4/3회', '목표를 넘겨도 막지 않고 보여 준다');
});

test('★ 진행 목록 줄 — 목표가 있으면 「사후 N/M회」, 사후가 아직 없어도 「＋ 사후 0/M회」 (완료 줄)', () => {
  const c = dashScene(false);
  c._st.cos.find((x) => x.id === 'c1').customPost = { t2: 3 };      // c1 = 현장클리닉 3/3 완료 줄, 사후 없음
  const none = postItems(rowOf(c, 'c1'));
  assert.strictEqual(none.length, 1);
  assert.ok(/＋ 사후 0\/3회/.test(none[0]) && /목표 3회/.test(none[0]) && /openPostDrawer\('c1','t2'\)/.test(none[0]), none[0]);
  const d = dashScene(true);                                          // c4 = 사후 2건(진행 중 줄에도 보인다)
  d._st.cos.find((x) => x.id === 'c4').customPost = { t2: 3 };
  assert.ok(/사후 2\/3회/.test(postItems(rowOf(d, 'c4'))[0]) && !/✓/.test(postItems(rowOf(d, 'c4'))[0]), '목표 3 중 2 — 아직 ✓ 가 아니다');
  d._st.cos.find((x) => x.id === 'c4').customPost = { t2: 2 };
  assert.ok(/✓ 사후 2\/2회/.test(postItems(rowOf(d, 'c4'))[0]), '목표를 채우면 ✓');
});

test('★ 목표를 넣어도 진행 목록 줄의 «본 회차 글자»는 하나도 안 바뀐다 (사후 칸만 달라진다)', () => {
  const noItem = (h) => String(h).replace(/<div class="round-badge post-item"[^>]*>[\s\S]*?<\/div>/g, '');
  const a = dashScene(true), b = dashScene(true);
  b._st.cos.forEach((co) => { co.customPost = { t1: 4, t2: 3, t3: 2 }; });
  a._st.cos.forEach((co) => assert.strictEqual(noItem(rowOf(b, co.id)), noItem(rowOf(a, co.id)), co.id));
  assert.notStrictEqual(rowOf(b, 'c1'), rowOf(a, 'c1'), '대조: 사후 칸 글자는 달라졌다');
});

test('★ 서랍 — 목표 칸이 있고(상태와 상관없이), 입력한 회수와 견줘 «남은 회수 / 목표 달성»을 말한다', () => {
  const c = postWorld();
  c._st.cos[0].customPost = { t2: 2 };                       // c1: 종료된 사업
  const html = () => c._st.els['#postBody'].innerHTML;
  c.openPostDrawer('c1', 't2');
  assert.ok(/id="postTarget"/.test(html()) && /value="2"/.test(html()) && /max="20"/.test(html()) && /onchange="postSetTarget\(this\.value\)"/.test(html()), '목표 칸: ' + html().slice(0, 300));
  assert.ok(/입력 0회 · 남은 2회/.test(html()), html().slice(0, 400));
  c._st.scheds.push(P('c1', 't2', '2026-11-05', { id: 'pa', round: 1 }));
  c.openPostDrawer('c1', 't2');
  assert.ok(/입력 1회 · 남은 1회/.test(html()));
  c._st.scheds.push(P('c1', 't2', '2026-11-12', { id: 'pb', round: 2 }));
  c.openPostDrawer('c1', 't2');
  assert.ok(/✓ 목표 달성/.test(html()) && !/남은/.test(html()), html().slice(0, 400));
  c._st.scheds.push(P('c1', 't2', '2026-11-19', { id: 'pc', round: 3 }));
  c.openPostDrawer('c1', 't2');
  assert.ok(/목표 달성 \(\+1회\)/.test(html()), '목표를 넘겨도 막지 않고 «+1회»로 보여 준다');
  c.openPostDrawer('c2', 't2');                              // 진행 중인 사업도 설정은 할 수 있다(입력칸만 없다)
  assert.ok(/id="postTarget"/.test(html()) && /value=""/.test(html()) && /목표 없음/.test(html()) && !/id="postDate"/.test(html()));
});

test('★ 서랍에서 목표를 넣고 고치고 지운다 — 사업장 한 건만 잠그고 저장하며, 일정(본·사후)은 하나도 안 바뀐다', async () => {
  const c = postWorld(); c.openPostDrawer('c1', 't2');
  const schedsBefore = JSON.stringify(c._st.scheds);
  await c.postSetTarget('3');
  assert.deepStrictEqual(J(c._st.cos[0].customPost), { t2: 3 });
  assert.ok(c._calls.locks >= 1 && c._calls.locks === c._calls.released, '잠그고 → 풀었다(못 풀면 다른 사람이 못 고친다)');
  assert.ok(/입력 0회 · 남은 3회/.test(c._st.els['#postBody'].innerHTML), '서랍이 바로 다시 그려진다');
  assert.ok(c._st.toasts.some((t) => /3회로 정했습니다/.test(t)), c._st.toasts.join('|'));
  assert.deepStrictEqual(J(c._st.cos[1]), J(CO('c2', '라마바식품', { types: ['t2'] })), '다른 사업장은 안 건드린다');
  await c.postSetTarget('5');
  assert.strictEqual(c._st.cos[0].customPost.t2, 5);
  await c.postSetTarget('');
  assert.ok(!('customPost' in c._st.cos[0]) && !hasUndefined(c._st.cos[0]), '비우면 칸 자체가 사라진다');
  assert.strictEqual(JSON.stringify(c._st.scheds), schedsBefore, '일정은 그대로');
});

test('서랍에서 틀린 값을 넣으면 까닭을 말하고 아무것도 안 바뀐다 — 잠금은 풀린다', async () => {
  const c = postWorld(); c._st.cos[0].customPost = { t2: 2 }; c.openPostDrawer('c1', 't2');
  const before = JSON.stringify(c._st.cos);
  await c.postSetTarget('99');
  assert.strictEqual(JSON.stringify(c._st.cos), before);
  assert.ok(c._st.toasts.some((t) => /0~20/.test(t)), c._st.toasts.join('|'));
  assert.strictEqual(c._calls.locks, c._calls.released, '잠금이 남으면 그 사업장은 다른 사람이 못 고친다');
  assert.ok(/value="2"/.test(c._st.els['#postBody'].innerHTML), '칸은 저장돼 있던 값으로 돌아온다');
});

test('사후를 넣을 때 알림이 목표 진행을 말한다 — 「(1/2회)」 → 「(2/2회) · 목표 달성」', async () => {
  const c = postWorld(); c._st.cos[0].customPost = { t2: 2 }; c.openPostDrawer('c1', 't2');
  form(c, '2026-11-05'); await c.postSave(false);
  assert.ok(/\(1\/2회\)/.test(c._st.toasts[c._st.toasts.length - 1]) && !/목표 달성/.test(c._st.toasts[c._st.toasts.length - 1]), c._st.toasts.join('|'));
  form(c, '2026-11-12'); await c.postSave(false);
  assert.ok(/\(2\/2회\) · 목표 달성/.test(c._st.toasts[c._st.toasts.length - 1]), c._st.toasts.join('|'));
  const c2 = postWorld(); c2.openPostDrawer('c1', 't2'); form(c2, '2026-11-05'); await c2.postSave(false);
  assert.ok(!/\//.test(c2._st.toasts[c2._st.toasts.length - 1]), '목표가 없으면 예전 알림 그대로: ' + c2._st.toasts.join('|'));
});

test('★ 목표를 «넘겨도» 사후는 들어간다 — 목표는 보는 숫자일 뿐 막는 규칙이 아니다', async () => {
  const c = postWorld(); c._st.cos[0].customPost = { t2: 1 }; c.openPostDrawer('c1', 't2');
  form(c, '2026-11-05'); await c.postSave(false); form(c, '2026-11-12'); await c.postSave(false);
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 2);
});

test('★ 종료 목록 — 사후 칸이 「사후 N/M회」를 말하고, 목표를 채우면 이알피 규칙이 「사후 목표 달성」으로 바뀐다', () => {
  const { w, c } = viewWorld(true);
  c._st.cos.find((x) => x.id === 'c1').customPost = { t1: 3 };
  c._st.cos.find((x) => x.id === 'c3').customPost = { t1: 2 };
  const items = c.endedInfos();
  const c1 = items.find((i) => i.co.id === 'c1'), c3 = items.find((i) => i.co.id === 'c3');
  assert.strictEqual(c1.postTarget, 3);
  assert.ok(/사후 2\/3회/.test(w.postCellHtml(c1)) && /목표 3회/.test(w.postCellHtml(c1)), w.postCellHtml(c1));
  assert.ok(/＋ 사후 0\/2회/.test(w.postCellHtml(c3)), w.postCellHtml(c3));
  const f1 = Array.from(c1.flags).find((x) => x.rule === 'erp');
  assert.ok(f1 && /사후 진행 중/.test(f1.label) && /사후 2\/3회 입력됨/.test(f1.reason), JSON.stringify(f1));
  c._st.cos.find((x) => x.id === 'c1').customPost = { t1: 2 };
  const done = Array.from(c.endedInfos().find((i) => i.co.id === 'c1').flags).find((x) => x.rule === 'erp');
  assert.ok(done && /사후 목표 달성/.test(done.label) && /이알피에서 종료/.test(done.hint), JSON.stringify(done));
});

test('목표가 없으면 종료 목록·이알피 규칙은 예전 글자 그대로다', () => {
  const { w, c } = viewWorld(true);
  const c1 = c.endedInfos().find((i) => i.co.id === 'c1');
  assert.strictEqual(c1.postTarget, 0);
  assert.ok(/사후 2회/.test(w.postCellHtml(c1)) && !/\d\/\d/.test(w.postCellHtml(c1)));
  const f = Array.from(c1.flags).find((x) => x.rule === 'erp');
  assert.ok(/사후 진행 중/.test(f.label) && /사후 2회 입력됨/.test(f.reason));
});

test('★ 사업장 수정 창 — 사후 회수 칸이 있고, 저장하는 두 길(고치기·새로 만들기)과 사업장 합치기가 customPost 를 잃지 않는다', () => {
  const i = SRC.indexOf('function renderCoTypes()'); const body = SRC.slice(i, SRC.indexOf('\nfunction ', i + 20));
  assert.ok(/사후컨설팅 회수/.test(body) && /co_post\['\$\{tid\}'\]=/.test(body) && /max="20"/.test(body), '칸과 값 틀');
  const open = grab('openCoModal');
  assert.ok(/co_post=\{\}/.test(open) && /co\?\.customPost[\s\S]{0,40}co_post=\{\.\.\.co\.customPost\}/.test(open), '열 때 비우고 → 있던 값을 불러온다');
  const save = grab('saveCo');
  assert.ok(/postTargetsClean\(co_post\)/.test(save), '저장 전에 거른다(undefined·범위 밖 제거)');
  assert.ok(/next\.customPost=postTargets;\s*else delete next\.customPost/.test(save), '고칠 때: 있으면 쓰고, 비면 칸을 지운다');
  assert.ok(/customMandatory:\{\.\.\.co_mandatory\},\.\.\.\(Object\.keys\(postTargets\)\.length\?\{customPost:postTargets\}:\{\}\)/.test(save), '새로 만들 때도 넣는다');
  assert.ok(/\['deadlines','customRounds','customMandatory','customPost','phaseState'\]/.test(grab('mergeApplyOne')), '사업장 합칠 때 사라지는 쪽의 목표도 옮겨 담는다');
});

/* ══ ⑲ 진행 목록의 「사후컨설팅」을 끌어 달력 날짜에 넣는다 (대표 지시 2026-11-05 「사후컨설팅도 진행하면 드래그하고 날짜에 넣게」) ═════
   본 회차 끌기(.drow → handleDrop)와 «같은 몸짓»이지만 만드는 것은 사후 일정이다.
   ★ 가장 위험한 실수 — 사후 항목을 끌었는데 «본 회차»(handleDrop)로 들어가는 것. 갈림길(dispatchCalDrop)을 실제로 돌려 못 박는다. */

const dragAttr = (it) => /<div class="round-badge post-item"[^>]*\sdraggable="true"/.test(it);
const DROP = (coId, typeId) => ({ post: true, coId, typeId });
const lastToast = (c) => c._st.toasts[c._st.toasts.length - 1] || '';

test('★ 사후를 넣을 수 있는 사업 — 종료된 사업 · 수정 중 · 본 회차를 다 마친 사업만 (진행 중이면 아니다) · 서랍 저장과 «같은 기준»', () => {
  const c = postWorld();
  const co = (o) => Object.assign({ id: 'cx', types: ['t2'] }, o);
  c._st.scheds = [];
  assert.strictEqual(c.postCanAdd(co({ endedTypes: { t2: '2026-10-24' } }), 't2'), true, '종료');
  assert.strictEqual(c.postCanAdd(co({ reopened: { t2: { was: '2026-10-10' } } }), 't2'), true, '수정 중');
  assert.strictEqual(c.postCanAdd(co({}), 't2'), false, '진행 중(본 0/3)');
  assert.strictEqual(c.postCanAdd(co({ endedTypes: { t3: '2026-10-24' } }), 't2'), false, '다른 사업이 종료된 것은 이 사업과 상관없다');
  c._st.scheds = [1, 2, 3].map((i) => D('cx', 't2', '2026-09-0' + i, { round: i }));
  assert.strictEqual(c.postCanAdd(co({}), 't2'), true, '본 3/3 완료');
  const same = (o) => c.postCanAdd(co(o), 't2') === !/본 회차를 모두 마쳤거나/.test(c.postProblem(co(o), 't2', '2026-11-05'));
  c._st.scheds = [];
  assert.ok(same({}) && same({ endedTypes: { t2: '2026-10-24' } }) && same({ reopened: { t2: { was: 'x' } } }), '서랍 저장(postProblem)이 막는 것과 끌기가 허락하는 것이 어긋나면 안 된다');
});

test('★ 진행 목록 — 사후 항목은 «넣을 수 있는 사업»에서만 끌린다 (완료·종료·수정 중 줄 예, 진행 중 줄 아니오) · 어느 사업장·사업인지 달려 있다', () => {
  const c = dashScene(true);
  const done = postItems(rowOf(c, 'c1'))[0];
  assert.ok(dragAttr(done) && /data-post-coid="c1"/.test(done) && /data-post-tid="t2"/.test(done), '완료 줄: ' + done);
  const ended = postItems(rowOf(c, 'c3', true))[0];
  assert.ok(dragAttr(ended) && /data-post-coid="c3"/.test(ended) && /data-post-tid="t2"/.test(ended), '종료 줄: ' + ended);
  const reopened = postItems(rowOf(c, 'c4'))[0];
  assert.ok(dragAttr(reopened) && /data-post-coid="c4"/.test(reopened), '수정 중 줄: ' + reopened);
  const going = postItems(rowOf(c, 'c2'))[0];
  assert.ok(going && !dragAttr(going) && !/data-post-/.test(going), '진행 중(본 2/4)인 줄은 사후 항목이 있어도 끌리지 않는다 — 끌어 놓아도 서랍과 같은 까닭으로 막힐 일이다: ' + going);
  assert.ok(/끌어/.test(done) && !/끌어/.test(going), '끌 수 있을 때만 «끌어서 넣기»를 알린다');
});

test('★ 끌기 시작 — 사후 표시와 사업장·사업이 담기고, 줄·카드의 끌기로 새지 않는다(본 회차 끌기가 같이 시작되면 안 된다)', () => {
  const c = postWorld(); vm.runInContext('var dragItem=null;', c);
  const marks = [];
  const ev = { stopped: false, stopPropagation() { this.stopped = true; }, dataTransfer: { effectAllowed: '', data: {}, setData(k, v) { this.data[k] = v; } } };
  const el = { dataset: { postCoid: 'c1', postTid: 't2' }, classList: { add: (x) => marks.push('+' + x), remove: (x) => marks.push('-' + x) } };
  c.postDragStart(ev, el);
  assert.deepStrictEqual(J(vm.runInContext('dragItem', c)), { post: true, coId: 'c1', typeId: 't2', isField: true }, '단추를 안 눌렀으면 방문');
  assert.strictEqual(ev.stopped, true, '★ 안쪽 끌기가 바깥 줄(.drow = 본 회차 끌기)·카드(순서 바꾸기)로 새면 안 된다');
  assert.strictEqual(ev.dataTransfer.effectAllowed, 'copy'); assert.ok(ev.dataTransfer.data['text/plain'], 'setData 가 있어야 일부 브라우저에서 끌기가 시작된다');
  assert.deepStrictEqual(marks, ['+dragging']);
  c.postDragEnd(el); assert.strictEqual(vm.runInContext('dragItem', c), null, '끝나면 비운다'); assert.deepStrictEqual(marks, ['+dragging', '-dragging']);
});

test('★★ 달력에 놓았을 때의 갈림길 — 사후 항목은 «사후 넣기»로만 가고 본 회차 넣기(handleDrop)로는 절대 안 간다 · 일정 칩은 옮기기 · 본 회차 줄은 예전 그대로', () => {
  const calls = [];
  const c = world(['dispatchCalDrop'], { handleDrop: (d, i) => calls.push(['main', d, i.coId]), handlePostDrop: (d, i) => calls.push(['post', d, i.coId]), moveChip: (id, d) => calls.push(['move', id, d]) });
  c.dispatchCalDrop('2026-11-05', DROP('c1', 't2'));
  c.dispatchCalDrop('2026-11-06', { coId: 'c2', typeId: 't2', round: 3, isField: true });
  c.dispatchCalDrop('2026-11-07', { moveId: 's1', coId: 'c1', typeId: 't2' });
  assert.deepStrictEqual(calls, [['post', '2026-11-05', 'c1'], ['main', '2026-11-06', 'c2'], ['move', 's1', '2026-11-07']]);
  const drop = grab('initCalDrop');
  assert.ok(/dispatchCalDrop\(date,dragItem\)/.test(drop) && !/handleDrop\(/.test(drop), '달력 ondrop 은 갈림길 하나만 부른다 — 직접 handleDrop 을 부르면 사후가 본 회차로 샌다');
});

test('★ 사후를 날짜에 놓으면 — 사후 일정이 «한 줄» 생기고 본 일정·사업 상태는 글자까지 그대로다 (방문으로 들어간다)', async () => {
  const c = postWorld();
  const beforeMain = mainOnly(c), beforeCos = JSON.stringify(c._st.cos);
  await c.handlePostDrop('2026-11-05', DROP('c1', 't2'));
  const posts = c._st.scheds.filter((s) => s.phase === 'post');
  assert.strictEqual(posts.length, 1);
  assert.deepStrictEqual({ phase: posts[0].phase, date: posts[0].date, coId: posts[0].coId, typeId: posts[0].typeId, round: posts[0].round, isField: posts[0].isField, attId: posts[0].attId },
    { phase: 'post', date: '2026-11-05', coId: 'c1', typeId: 't2', round: 1, isField: true, attId: 'a1' });
  assert.ok(!('memo' in posts[0]), '메모 칸을 두지 않는다(undefined 금지)');
  assert.strictEqual(mainOnly(c), beforeMain, '본 일정은 글자까지 그대로');
  assert.strictEqual(JSON.stringify(c._st.cos), beforeCos, '★ 사업은 종료 상태 그대로 — 진행 목록에 다시 올라오지 않는다');
  assert.ok(c._calls.raw.length >= 1 && c._calls.raw.every((v) => !hasUndefined(v)), '저장하려고 넘긴 «날것»에 undefined 가 있으면 클라우드가 통째로 거부한다');
  assert.ok(c._calls.locks === 1 && c._calls.released === 1, '잠그고 → 저장 → 푼다');
  ['cal', 'dash', 'sum', 'ended'].forEach((k) => assert.ok(c._calls.rendered.includes(k), k + ' 을(를) 다시 그린다 — 진행 목록의 「사후 N회」·달력 칩·요약줄이 바로 바뀐다'));
  assert.ok(/사후 1회를 넣었습니다/.test(lastToast(c)) && /11-05|11\/5|11\/05/.test(lastToast(c)), '무엇을 어느 날에 넣었는지 알린다: ' + lastToast(c));
});

test('사후를 연달아 놓으면 — 이른 날짜를 나중에 놓아도 사후끼리 날짜순으로 1,2 를 다시 매기고 «목표 N/M회»를 알린다', async () => {
  const c = postWorld(); c._st.cos[0].customPost = { t2: 2 };
  await c.handlePostDrop('2026-11-12', DROP('c1', 't2'));
  assert.ok(/\(1\/2회\)/.test(lastToast(c)) && !/목표 달성/.test(lastToast(c)), lastToast(c));
  await c.handlePostDrop('2026-11-05', DROP('c1', 't2'));
  assert.ok(/\(2\/2회\) · 목표 달성/.test(lastToast(c)), lastToast(c));
  const posts = c._st.scheds.filter((s) => s.phase === 'post').sort((a, b) => (a.date < b.date ? -1 : 1));
  assert.deepStrictEqual(posts.map((s) => s.date + ':' + s.round), ['2026-11-05:1', '2026-11-12:2']);
});

test('★ 못 놓는 곳 — 진행 중 사업 · 불가 날짜 · 같은 날 같은 사업 · 담당 하루 한도 · 같은 사업장 다른 사업 같은 날 · 쉰 사업장 (저장 안 하고 까닭을 말한다, 잠그지도 않는다)', async () => {
  const refused = async (c, item, re, why) => {
    const before = JSON.stringify(c._st.scheds);
    await c.handlePostDrop('2026-11-05', item || DROP('c1', 't2'));
    assert.strictEqual(JSON.stringify(c._st.scheds), before, why + ' — 저장하면 안 된다');
    assert.strictEqual(c._calls.saves, 0, why); assert.strictEqual(c._calls.locks, 0, why + ' — 막힌 것은 잠그기 전에 끝난다');
    assert.ok(re.test(lastToast(c)), why + ' — 까닭: ' + lastToast(c));
  };
  await refused(postWorld(), DROP('c2', 't2'), /본 회차를 모두 마쳤거나/, '진행 중 사업(본 1/3)');
  await refused(postWorld({ isBlocked: () => '불가 날짜입니다' }), null, /불가 날짜/, '불가 날짜');
  let c = postWorld(); c._st.scheds.push(P('c1', 't2', '2026-11-05', { id: 'dup', round: 1 })); await refused(c, null, /이미 있습니다/, '같은 날 같은 사업');
  c = postWorld(); c._st.env = { maxDailyPerAtt: 1 }; c._st.scheds.push(D('c2', 't2', '2026-11-05', { id: 'busy' })); await refused(c, null, /이미 1건/, '담당 하루 한도');
  c = postWorld(); c._st.cos[0].types = ['t2', 't3']; c._st.scheds.push(D('c1', 't3', '2026-11-05', { id: 'other' })); await refused(c, null, /다른 사업/, '같은 사업장 다른 사업');
  c = postWorld(); c._st.cos[0].active = false; await refused(c, null, /비활성/, '쉬는 사업장');
  await refused(postWorld(), DROP('nobody', 't2'), /사업장/, '없는 사업장');
});

test('잠금을 못 잡으면 놓아도 아무 것도 저장하지 않는다', async () => {
  const c = postWorld({ acquireCompanyEditLock: async () => false });
  const before = JSON.stringify(c._st.scheds); await c.handlePostDrop('2026-11-05', DROP('c1', 't2'));
  assert.strictEqual(JSON.stringify(c._st.scheds), before); assert.strictEqual(c._calls.saves, 0);
});

test('★ 줄에서 끌기 시작이 달력 칸과 이어진다 — 진행 목록이 항목을 묶고, 끌 수 있다는 모양(손 커서)이 있고, 끌기 때 줄이 따라 흐려지지 않는다', () => {
  const dash = grab('renderDash');
  assert.ok(/\.post-item\[draggable="true"\]/.test(dash) && /postDragStart\(e,/.test(dash) && /postDragEnd\(/.test(dash), '진행 목록 그릴 때 사후 항목에 끌기를 묶는다');
  assert.ok(/\.post-item\[draggable="true"\]\{[^}]*cursor:grab/.test(SRC), '끌 수 있는 항목은 손 커서');
  assert.ok(/\.post-item\.dragging\{[^}]*opacity/.test(SRC), '끄는 동안 항목이 흐려진다');
});

test('★ qa() 는 NodeList 다 — 결과에 map·filter·some 같은 «배열 함수»를 바로 부르는 곳이 이 화면에 없다 (진짜 화면에서만 터진다)', () => {
  /* 2026-11-05 — postSelKeys·endedSelKeys 가 qa(...).map 을 불러, 사후 서랍을 열기만 해도·종료 목록을 그리기만 해도 «그리기 끝에서» 오류가 났다.
     검사의 가짜 qa 가 배열이라 몰랐다(위 nl). 같은 모양이 다시 생기면 이름과 함께 걸린다. 고치는 법: Array.from(qa(...)).map(...) */
  const re = /\bqa\((?:'[^']*'|"[^"]*"|`[^`]*`)\)\s*\.(map|filter|some|every|reduce|find|findIndex|slice|concat|includes|indexOf|sort|flatMap|join)\(/g;
  const hits = []; let m;
  while ((m = re.exec(S))) hits.push(S.slice(Math.max(0, m.index - 40), m.index).split('\n').pop().trim() + ' … ' + m[0]);
  assert.deepStrictEqual(hits, [], 'NodeList 에 배열 함수를 바로 부른 곳: ' + hits.join(' | '));
});

/* ══ ⑳ 사후컨설팅 «방문 | 사무실» 끌기 + 같은 정부사업 하루 겹침 금지 (대표 지시 2026-11-10) ═════════════════════
   ① 「사후컨설팅 회차 넣고 방문이나 사무실은 기존 컨설팅과 같이 드래그 앤 드롭으로」 — 본 회차 줄의 「방문 | 사무실」처럼 사후 항목 옆 단추로 고르고, 끌어 놓으면 그 구분으로 들어간다.
      본 회차의 방문/사무실(getFieldState)과는 «따로» 기억한다 — 한 줄에서 본 회차는 방문, 사후는 사무실로 끌 수 있어야 한다.
   ② 「동일 정부사업에서 사후컨설팅과 기존의 사업장 방문일은 중복되면 안 되게」 — 사후도 본 방문과 같은 날 겹칠 수 없다(같은 사업장 · 하루 규칙을 켜 둔 사업은 다른 사업장도). */

const lsMap = (c) => JSON.parse(c._ls.m.p_fieldState || '{}');
const divCount = (h) => (String(h).match(/<div\b/g) || []).length;

test('★ 진행 목록 사후 항목 — 끌 수 있을 때만 «방문 | 사무실» 단추와 「다음 사후 N회차」가 붙는다 · 항목 안에 div 가 없다', () => {
  const c = dashScene(true);
  const done = postItems(rowOf(c, 'c1'))[0];            // 완료 줄 — 사후 2회(방문 1 · 사무실 1), 목표 없음
  assert.ok(dragAttr(done), '대조: 끌 수 있는 항목이다');
  assert.ok(/<span class="post-fmtog" data-coid="c1" data-typeid="t2"/.test(done), '단추 묶음이 사업장·사업을 달고 있다: ' + done);
  assert.ok(/class="post-fmt-btn on" data-f="1"[^>]*>방문</.test(done) && /class="post-fmt-btn" data-f="0"[^>]*>사무실</.test(done), '처음엔 방문이 켜져 있다');
  assert.ok(/다음 사후 3회차/.test(done), '이미 2회 → 다음은 3회차: ' + done);
  assert.ok(/방문 1회/.test(done) && /사무실 1회/.test(done), '지금까지의 방문·사무실 횟수는 말풍선으로: ' + done);
  assert.ok(/event\.stopPropagation\(\);postPickField\('c1','t2',1\)/.test(done) && /event\.stopPropagation\(\);postPickField\('c1','t2',0\)/.test(done), '단추가 줄 전체의 「눌러 열기」로 새지 않는다');
  assert.strictEqual(divCount(done), 1, '항목 안에 div 를 또 두지 않는다 — 항목 하나를 한 덩어리로 떠 내는 검사가 있다');
  const going = postItems(rowOf(c, 'c2'))[0];           // 일터혁신 본 2/4 — 진행 중이라 끌 수 없다
  assert.ok(going && !dragAttr(going) && !/post-fmtog|다음 사후/.test(going), '끌 수 없는 줄에는 단추도 «다음 회차»도 얹지 않는다: ' + going);
});

test('사후 항목 — 목표를 채우면 「다음 사후 N회차」는 사라지고(단추는 남는다), 목표가 남아 있으면 다음 회차를 말한다 · 사무실이 켜져 있으면 사무실 쪽이 켜진다', () => {
  const c = dashScene(true);
  c._st.cos.find((x) => x.id === 'c1').customPost = { t2: 2 };
  let it = postItems(rowOf(c, 'c1'))[0];
  assert.ok(!/다음 사후/.test(it) && /post-fmtog/.test(it) && /✓ 사후 2\/2회/.test(it), '목표 달성: ' + it);
  c._st.cos.find((x) => x.id === 'c1').customPost = { t2: 5 };
  assert.ok(/다음 사후 3회차/.test(postItems(rowOf(c, 'c1'))[0]), '목표 5 → 아직 남음');
  c.getPostFieldState = () => false;
  it = postItems(rowOf(c, 'c1'))[0];
  assert.ok(/class="post-fmt-btn" data-f="1"/.test(it) && /class="post-fmt-btn on office" data-f="0"/.test(it), '사무실이 켜진다: ' + it);
});

test('★ 단추를 누르면 — 사후만의 값으로 기억하고(본 회차 값은 안 건드린다), 같은 사업장·사업의 단추 모양을 모두 맞춘다', () => {
  const btns = [{ dataset: { f: '1' }, className: 'post-fmt-btn on' }, { dataset: { f: '0' }, className: 'post-fmt-btn' }];
  const c = postWorld({ qa: () => nl(btns) });
  c._ls.m.p_fieldState = JSON.stringify({ c1_t2: false });            // 본 회차 줄은 사무실로 해 둔 상태
  assert.strictEqual(c.getPostFieldState('c1', 't2'), true, '사후 값이 없으면 방문');
  c.postPickField('c1', 't2', 0);
  assert.strictEqual(c.getPostFieldState('c1', 't2'), false);
  assert.deepStrictEqual(lsMap(c), { c1_t2: false, c1_t2_post: false }, '키만 더한다 — 본 회차 키(c1_t2)는 그대로, 새 localStorage 키 없음');
  assert.deepStrictEqual(Object.keys(c._ls.m), ['p_fieldState'], '새 localStorage 키를 만들지 않았다');
  assert.ok(c._ls.writes.includes('fb:p_fieldState') && c._ls.writes.includes('p_fieldState'), '본 회차 단추와 같은 길(로컬 + 클라우드 동기)로 저장');
  assert.deepStrictEqual(btns.map((b) => b.className), ['post-fmt-btn', 'post-fmt-btn on office'], '사무실이 켜진 모양');
  c.postPickField('c1', 't2', 1);
  assert.deepStrictEqual(btns.map((b) => b.className), ['post-fmt-btn on', 'post-fmt-btn']);
  assert.strictEqual(lsMap(c).c1_t2, false, '본 회차 값은 끝까지 그대로');
  assert.strictEqual(c.getPostFieldState('c2', 't2'), true, '다른 사업장은 영향 없다');
  const bad = postWorld(); bad._ls.m.p_fieldState = '{깨진 글자';
  assert.strictEqual(bad.getPostFieldState('c1', 't2'), true, '저장값이 깨져 있어도 던지지 않고 방문으로');
  bad.setPostFieldState('c1', 't2', false);
  assert.deepStrictEqual(lsMap(bad), { c1_t2_post: false }, '깨진 것은 버리고 새로 쓴다');
});

test('★ 끌기를 시작하면 — 그 순간의 «방문/사무실» 값이 담긴다', () => {
  const c = postWorld(); vm.runInContext('var dragItem=null;', c);
  const ev = () => ({ stopPropagation() {}, dataTransfer: { setData() {} } });
  const el = { dataset: { postCoid: 'c1', postTid: 't2' }, classList: { add() {}, remove() {} } };
  c.setPostFieldState('c1', 't2', false); c.postDragStart(ev(), el);
  assert.strictEqual(J(vm.runInContext('dragItem', c)).isField, false, '사무실로 해 두고 끌면 사무실');
  c.setPostFieldState('c1', 't2', true); c.postDragStart(ev(), el);
  assert.strictEqual(J(vm.runInContext('dragItem', c)).isField, true);
});

test('★ 놓으면 — 항목 옆 단추대로 방문(📍)·사무실(🏢)이 저장되고 알림에도 적힌다 · 단추 값이 없는 예전 끌기(DROP)는 방문', async () => {
  let c = postWorld(); await c.handlePostDrop('2026-11-05', { post: true, coId: 'c1', typeId: 't2', isField: false });
  let p = c._st.scheds.find((s) => s.phase === 'post');
  assert.strictEqual(p.isField, false, '사무실로 들어간다');
  assert.ok(/사무실/.test(lastToast(c)) && /사후 1회를 넣었습니다/.test(lastToast(c)), lastToast(c));
  c = postWorld(); await c.handlePostDrop('2026-11-05', { post: true, coId: 'c1', typeId: 't2', isField: true });
  assert.strictEqual(c._st.scheds.find((s) => s.phase === 'post').isField, true);
  assert.ok(/방문/.test(lastToast(c)), lastToast(c));
  c = postWorld(); await c.handlePostDrop('2026-11-05', DROP('c1', 't2'));
  assert.strictEqual(c._st.scheds.find((s) => s.phase === 'post').isField, true, '값이 없으면 방문(예전 그대로)');
  assert.ok(c._calls.raw.every((v) => !hasUndefined(v)), '저장하는 모양에 undefined 가 없다');
});

test('방문으로 놓으면 본 회차처럼 사진 창이 열린다(환경설정 «현장 등록 시 타임스탬프 자동 팝업»이 켜져 있을 때) · 사무실이거나 꺼져 있으면 안 열린다', async () => {
  const mk = (env) => { const c = postWorld({ setTimeout: (f) => f() }); c._st.env = env; return c; };
  let c = mk({ autoStampOnField: true }); await c.handlePostDrop('2026-11-05', { post: true, coId: 'c1', typeId: 't2', isField: true });
  const sid = c._st.scheds.find((s) => s.phase === 'post').id;
  assert.deepStrictEqual(c._calls.stamp, [sid], '방문 + 켜짐 → 방금 만든 사후로 사진 창');
  c = mk({ autoStampOnField: true }); await c.handlePostDrop('2026-11-05', { post: true, coId: 'c1', typeId: 't2', isField: false });
  assert.deepStrictEqual(c._calls.stamp, [], '사무실은 사진 창을 안 연다');
  c = mk({}); await c.handlePostDrop('2026-11-05', { post: true, coId: 'c1', typeId: 't2', isField: true });
  assert.deepStrictEqual(c._calls.stamp, [], '꺼져 있으면 안 연다');
  c = mk({ autoStampOnField: true }); await c.handlePostDrop('2026-11-05', { post: true, coId: 'c2', typeId: 't2', isField: true });
  assert.deepStrictEqual(c._calls.stamp, [], '못 놓은 날(진행 중 사업)은 사진 창도 없다');
});

/* ── ② 같은 정부사업 하루 겹침 금지 ── */
const t3World = (extra) => {                          // c1·c2 가 «기관 하루 1사업장»을 켠 사업(t3)을 한다 — c1 은 그 사업이 종료돼 사후를 넣는다
  const c = postWorld(extra);
  c._st.cos[0].types = ['t2', 't3']; c._st.cos[0].endedTypes = { t2: '2026-10-24', t3: '2026-10-24' }; c._st.cos[1].types = ['t2', 't3'];
  return c;
};

test('★ 같은 사업장의 같은 사업 본 방문일에는 사후를 못 넣는다 — 서랍·끌어 놓기 둘 다 (예전부터 막혀 있던 것을 못 박는다)', async () => {
  for (const how of ['drop', 'drawer']) {
    const c = postWorld(); const before = JSON.stringify(c._st.scheds);
    if (how === 'drop') await c.handlePostDrop('2026-09-08', DROP('c1', 't2'));
    else { c.openPostDrawer('c1', 't2'); form(c, '2026-09-08'); await c.postSave(false); }
    assert.strictEqual(JSON.stringify(c._st.scheds), before, how + ' — 저장하면 안 된다');
    assert.ok(/이 사업의 일정이 이미 있습니다/.test(lastToast(c)), how + ': ' + lastToast(c));
  }
});

test('★ 「기관 하루 1사업장」을 켠 사업 — 다른 사업장의 본 방문일에는 사후를 못 넣는다 (서랍 · 끌어 놓기), 다른 날은 넣는다', async () => {
  for (const how of ['drop', 'drawer']) {
    const c = t3World(); c._st.scheds.push(D('c2', 't3', '2026-11-05', { id: 'o3' })); const before = JSON.stringify(c._st.scheds);
    if (how === 'drop') await c.handlePostDrop('2026-11-05', DROP('c1', 't3'));
    else { c.openPostDrawer('c1', 't3'); form(c, '2026-11-05'); await c.postSave(false); }
    assert.strictEqual(JSON.stringify(c._st.scheds), before, how + ' — 저장하면 안 된다');
    assert.strictEqual(c._calls.locks, 0, how + ' — 막힌 것은 잠그기 전에 끝난다');
    const msg = lastToast(c);
    assert.ok(/하루에 한 사업장만/.test(msg) && /라마바식품/.test(msg) && !/\n/.test(msg), how + ' — 까닭(한 줄)에 어느 사업장 때문인지: ' + msg);
  }
  const c = t3World(); c._st.scheds.push(D('c2', 't3', '2026-11-05', { id: 'o3' }));
  await c.handlePostDrop('2026-11-06', DROP('c1', 't3'));
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 1, '다른 날이면 들어간다: ' + lastToast(c));
});

test('기관 하루 1사업장 — 다른 사업장의 «사후»와도 같은 날 못 넣는다 (그 날 기관이 두 곳에 갈 수는 없다)', async () => {
  const c = t3World(); c._st.scheds.push(P('c2', 't3', '2026-11-05', { id: 'op3' }));
  await c.handlePostDrop('2026-11-05', DROP('c1', 't3'));
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 1, '새로 들어가지 않았다(원래 있던 c2 의 사후 하나뿐)');
  assert.ok(/하루에 한 사업장만/.test(lastToast(c)) && /사후컨설팅/.test(lastToast(c)), lastToast(c));
});

test('이 규칙을 켜지 않은 사업(t2)은 다른 사업장의 방문일과 겹쳐도 사후가 들어간다 (본 방문끼리도 되는 것과 같다)', async () => {
  const c = postWorld(); c._st.scheds.push(D('c2', 't2', '2026-11-05', { id: 'o2', attId: 'a2' }));
  await c.handlePostDrop('2026-11-05', DROP('c1', 't2'));
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 1, lastToast(c));
});

test('★ 「같은 담당 하루 1건」을 켠 사업 — 같은 주담당의 다른 사업장 방문일에는 사후를 못 넣고, 담당이 다르면 넣는다', async () => {
  let c = postWorld(); c._st.matrix = { t2__t2: true };
  c._st.scheds.push(D('c2', 't2', '2026-11-05', { id: 'o2', attId: 'a1' }));
  await c.handlePostDrop('2026-11-05', DROP('c1', 't2'));
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0);
  assert.ok(/같은 날 중복/.test(lastToast(c)) && /라마바식품/.test(lastToast(c)) && !/\n/.test(lastToast(c)), lastToast(c));
  c = postWorld(); c._st.matrix = { t2__t2: true };
  c._st.scheds.push(D('c2', 't2', '2026-11-05', { id: 'o2', attId: 'a2' }));
  await c.handlePostDrop('2026-11-05', DROP('c1', 't2'));
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 1, '주담당이 다르면 이 규칙이 아니다: ' + lastToast(c));
});

test('★ 반대쪽 — 본 방문을 넣거나 옮길 때도 사후와 같은 날이면 막힌다 (본 방문을 넣는 모든 길이 같은 규칙 함수를 쓴다)', () => {
  ['mainDropProblem', 'moveDayProblem', 'saveSingle', 'saveMultiSingle', 'postProblem'].forEach((n) => {
    const b = grab(n);
    assert.ok(/checkConflictMatrix\(/.test(b) && /checkAgencyExclusive\(/.test(b), n + ' — 같은 담당 하루 1건·기관 하루 1사업장을 «둘 다» 묻는다');
  });
  assert.ok(/mainDropProblem\(/.test(grab('handleDrop')), '본 회차 놓기(handleDrop)는 판정을 mainDropProblem 한 곳에서 받는다');
  assert.ok(/moveDayProblem\(/.test(grab('moveChip')) && /movePost\(/.test(grab('moveChip')), '칩 옮기기(moveChip)는 본 칩은 moveDayProblem · 사후 칩은 movePost(postProblem)');
  ['checkConflictMatrix', 'checkAgencyExclusive', 'agencyOtherSiteOn', 'dayConflictMsg'].forEach((n) => {
    assert.ok(!/!\s*isPostSched\(/.test(grab(n)), n + ' — 사후를 걸러 내면(!isPostSched) 사후와 본 방문이 같은 날 겹쳐도 통과한다');
  });
});

test('★ 이미 겹쳐 있는 예전 사후는 «날짜를 안 바꾸면» 구분·메모를 고칠 수 있다 — 겹치는 날로 옮기려 하면 막힌다 (새 규칙이 예전 자료를 가두지 않는다)', async () => {
  const c = t3World();
  c._st.scheds.push(D('c2', 't3', '2026-11-05', { id: 'o3' }), P('c1', 't3', '2026-11-05', { id: 'old', round: 1, isField: true }));   // 규칙이 생기기 전에 넣은 겹침
  c.openPostDrawer('c1', 't3'); c.postEdit('old'); c.postSetField(0);
  form(c, '2026-11-05', '구분·메모만 고침');
  await c.postSave(false);
  const p = c._st.scheds.find((s) => s.id === 'old');
  assert.strictEqual(p.memo, '구분·메모만 고침', lastToast(c)); assert.strictEqual(p.isField, false, '날짜는 그대로, 구분·메모는 바뀐다');
  c._st.scheds.push(D('c2', 't3', '2026-11-12', { id: 'o3b' }));
  c.postEdit('old'); form(c, '2026-11-12', '');
  await c.postSave(false);
  assert.strictEqual(c._st.scheds.find((s) => s.id === 'old').date, '2026-11-05', '겹치는 새 날짜로는 못 옮긴다');
  assert.ok(/하루에 한 사업장만/.test(lastToast(c)), lastToast(c));
});

test('진행 목록 줄을 눌러 «본 회차 등록 창»이 열리는 길에서 사후 항목(단추·빈틈)은 빠진다', () => {
  assert.ok(/closest\('\.post-item'\)/.test(grab('renderDash')), '사후 항목을 눌러도 본 회차 등록 창이 열리지 않는다');
});

/* ══ ㉑ 사후 칩 끌어 옮기기 + 날짜 겹침 «팝업» (대표 지시 2026-11-10) ═════════════════════════════════════
   「동일 컨설팅 날짜일 경우 중복된다고 팝업으로 경고표시 만들고 날짜 옮길 수 있게」 + 「각 사업 마우스 드래그 앤드랍이 제대로 안 된다」
   ① 달력의 「사후」 칩이 끌리지 않아(draggable=false) 끌려 하면 글자만 선택되던 것 → 사후 칩도 끌어 옮긴다(movePost, 서랍에서 고치는 것과 같은 규칙).
   ② 날짜가 겹쳐 못 넣거나 못 옮기면 작은 알림이 아니라 팝업 — 왜 겹치는지, 가까운 빈 날짜, 다른 날짜를 골라 «같은 일»을 다시 한다. */

const POP = ['dupShift', 'dupNearest', 'dupDayLabel', 'dupWho', 'dupIsOverlap', 'dupPopupOpen', 'dupPick', 'dupClose', 'dupGo'];
function popWorld(over) {
  const c = world(POP, over);
  vm.runInContext('var _dup=null;', c);
  c._st.cos = [CO('c1', '가나상사')];
  return c;
}
const dupEl = (c, id) => c._st.els['#' + id];

test('날짜 도우미 — 하루씩 앞뒤로 가며 «되는 날»을 찾는다 (달·해 경계, 없으면 빈 글자)', () => {
  const c = popWorld();
  assert.strictEqual(c.dupShift('2026-11-30', 1), '2026-12-01'); assert.strictEqual(c.dupShift('2026-01-01', -1), '2025-12-31'); assert.strictEqual(c.dupShift('2028-02-28', 1), '2028-02-29', '윤년');
  assert.strictEqual(c.dupShift('', 1), '', '모양이 틀리면 빈 글자');
  const bad = new Set(['2026-11-12', '2026-11-13', '2026-11-14']);
  const probe = (d) => (bad.has(d) ? '겹침' : '');
  assert.strictEqual(c.dupNearest(probe, '2026-11-12', 1, 30), '2026-11-15', '뒤로 가장 가까운 되는 날');
  assert.strictEqual(c.dupNearest(probe, '2026-11-14', -1, 30), '2026-11-11', '앞으로 가장 가까운 되는 날');
  assert.strictEqual(c.dupNearest(() => '안 됨', '2026-11-12', 1, 5), '', '한도 안에 없으면 빈 글자');
  assert.strictEqual(c.dupDayLabel('2026-11-17'), '11-17(화)');
});

test('★ 겹침 팝업 — 까닭·누구 것인지·가까운 날짜가 뜨고, 날짜칸에는 «뒤로 가장 가까운 되는 날»이 미리 들어간다', () => {
  const c = popWorld(); const bad = new Set(['2026-11-12', '2026-11-13']);
  c.dupPopupOpen({ who: '가나상사 · 현장클리닉', msg: '2026-11-12에 이 사업의 일정이 이미 있습니다', date: '2026-11-12', probe: (d) => (bad.has(d) ? 'x' : ''), retry: () => {}, verb: '옮기기' });
  assert.ok(dupEl(c, 'mbDup').classList.contains('open'), '팝업이 열린다');
  assert.strictEqual(dupEl(c, 'dupTitle').textContent, '같은 날짜에 일정이 중복됩니다');
  assert.strictEqual(dupEl(c, 'dupWho').textContent, '가나상사 · 현장클리닉');
  assert.ok(/이미 있습니다/.test(dupEl(c, 'dupMsg').textContent), '까닭');
  assert.strictEqual(dupEl(c, 'dupDate').value, '2026-11-14', '12·13 은 안 되니 14 가 미리 들어간다');
  assert.ok(/dupPick\('2026-11-11'\)/.test(dupEl(c, 'dupNear').innerHTML) && /dupPick\('2026-11-14'\)/.test(dupEl(c, 'dupNear').innerHTML), '앞·뒤 가까운 날 단추');
  assert.strictEqual(dupEl(c, 'dupGo').textContent, '이 날짜로 옮기기', '단추 글자는 하려던 일(옮기기/넣기)을 따른다');
  c.dupPopupOpen({ msg: '불가 날짜입니다', date: '2026-11-12', probe: () => '', retry: () => {}, verb: '넣기' });
  assert.strictEqual(dupEl(c, 'dupTitle').textContent, '이 날짜에는 넣을 수 없습니다', '겹침이 아닌 까닭(불가 날짜·한도)은 제목이 다르다');
  assert.strictEqual(dupEl(c, 'dupGo').textContent, '이 날짜로 넣기');
});

test('★ 팝업에서 날짜를 고르면 — 먼저 그 날짜가 되는지 팝업 안에서 보고(안 되면 닫지 않고 까닭), 되면 닫고 «원래 하려던 일»을 그 날짜로 다시 한다', async () => {
  const c = popWorld(); const calls = []; const bad = new Set(['2026-11-12', '2026-11-13']);
  const open = () => c.dupPopupOpen({ msg: '겹침', date: '2026-11-12', probe: (d) => (bad.has(d) ? `${d}에는 이미 있습니다` : ''), retry: (d) => calls.push(d), verb: '넣기' });
  open();
  const go = async (v) => { dupEl(c, 'dupDate').value = v; await c.dupGo(); };
  await go(''); assert.ok(/날짜를 정해/.test(dupEl(c, 'dupErr').textContent) && dupEl(c, 'mbDup').classList.contains('open'), '빈 날짜');
  await go('2026-11-12'); assert.ok(/겹치는 그 날짜/.test(dupEl(c, 'dupErr').textContent), '같은 날짜를 또 고름');
  await go('2026-11-13'); assert.ok(/2026-11-13에는 이미 있습니다/.test(dupEl(c, 'dupErr').textContent) && dupEl(c, 'mbDup').classList.contains('open'), '되지 않는 날짜는 닫지 않고 까닭을 적는다');
  assert.deepStrictEqual(calls, [], '아직 아무것도 다시 하지 않았다');
  await go('2026-11-16');
  assert.deepStrictEqual(calls, ['2026-11-16'], '되는 날짜로 원래 일을 다시 한다');
  assert.ok(!dupEl(c, 'mbDup').classList.contains('open'), '닫힌다');
  c.dupPopupOpen({ msg: 'x', date: '2026-11-12', probe: () => '', retry: (d) => calls.push('b' + d), verb: '넣기' });
  c.dupClose(); await c.dupGo(); assert.deepStrictEqual(calls, ['2026-11-16'], '닫은 뒤에는 다시 하지 않는다');
  open(); c.dupPick('2026-11-20'); assert.strictEqual(dupEl(c, 'dupDate').value, '2026-11-20', '가까운 날 단추를 누르면 날짜칸이 바뀐다');
});

test('★ 사후를 «놓았는데» 겹치면 — 알림이 아니라 팝업, 다른 날짜로 옮기면 그 날짜로 들어간다 (본 방문과 같은 날 → 가까운 빈 날)', async () => {
  const c = t3World(); c._st.scheds.push(D('c2', 't3', '2026-11-05', { id: 'o3' }));
  await c.handlePostDrop('2026-11-05', { post: true, coId: 'c1', typeId: 't3', isField: false });
  assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0, '저장하지 않았다');
  assert.strictEqual(c._calls.popups.length, 1, '팝업이 한 번 열렸다: ' + c._st.toasts.join('|'));
  const p = c._calls.popups[0];
  assert.ok(/하루에 한 사업장만/.test(p.msg) && /라마바식품/.test(p.msg), p.msg);
  assert.ok(/사후컨설팅/.test(p.who) && /가나상사/.test(p.who), '누구 것인지: ' + p.who);
  assert.strictEqual(p.date, '2026-11-05'); assert.strictEqual(p.verb, '넣기');
  assert.ok(p.probe('2026-11-05') && !p.probe('2026-11-06'), '팝업의 날짜 판정은 놓기와 같다 — 겹치는 날 아니오 · 다른 날 예');
  await p.retry('2026-11-06');
  const post = c._st.scheds.find((s) => s.phase === 'post');
  assert.ok(post && post.date === '2026-11-06' && post.isField === false, '고른 날짜로, 처음 끌 때의 구분(사무실) 그대로 들어간다: ' + JSON.stringify(post));
});

test('날짜와 상관없이 안 되는 일(진행 중 사업)은 팝업이 아니라 알림이다 — 날짜를 옮겨도 소용없다', async () => {
  const c = postWorld(); await c.handlePostDrop('2026-11-05', DROP('c2', 't2'));
  assert.deepStrictEqual(c._calls.popups, [], '팝업이 열리면 안 된다');
  assert.ok(/본 회차를 모두 마쳤거나/.test(lastToast(c)), lastToast(c));
});

test('서랍에서 «저장»했는데 겹치면 — 팝업이 뜨고, 다른 날짜를 고르면 서랍의 날짜칸이 바뀌어 저장된다', async () => {
  const c = t3World(); c._st.scheds.push(D('c2', 't3', '2026-11-05', { id: 'o3' }));
  c.openPostDrawer('c1', 't3'); form(c, '2026-11-05', '메모'); await c.postSave(false);
  assert.strictEqual(c._calls.popups.length, 1); assert.strictEqual(c._st.scheds.filter((s) => s.phase === 'post').length, 0);
  assert.strictEqual(c._calls.popups[0].verb, '넣기');
  c._st.els['#postMemo'] = { value: '메모' };
  await c._calls.popups[0].retry('2026-11-09');
  const post = c._st.scheds.find((s) => s.phase === 'post');
  assert.ok(post && post.date === '2026-11-09' && post.memo === '메모', '고른 날짜로 저장: ' + JSON.stringify(post));
  assert.strictEqual(c._st.els['#postDate'].value, '2026-11-09', '서랍의 날짜칸도 고른 날짜로');
  const c2 = t3World(); c2.openPostDrawer('c1', 't3'); form(c2, '', ''); await c2.postSave(false);
  assert.deepStrictEqual(c2._calls.popups, [], '날짜가 비었으면 팝업이 아니라 입력 안내(알림·서랍 오류칸)');
  assert.ok(/날짜를 정해 주세요/.test(lastToast(c2)), lastToast(c2));
});

/* ── 사후 칩 끌어 옮기기 ── */
const moveWorld = (extra) => {
  const c = t3World(extra); c.openPostDrawer('c1', 't3');
  c._st.scheds.push(P('c1', 't3', '2026-11-05', { id: 'pa', round: 1, isField: false, memo: '임금 점검' }), P('c1', 't3', '2026-11-12', { id: 'pb', round: 2 }));
  return c;
};

test('★ 사후 칩을 다른 날짜로 끌어 옮기면 — 날짜만 바뀌고 구분·메모는 그대로, 본 일정·사업 상태는 글자까지 그대로, 사후끼리 번호를 다시 매긴다', async () => {
  const c = moveWorld(); const beforeMain = mainOnly(c), beforeCos = JSON.stringify(c._st.cos);
  c.moveChip('pa', '2026-11-19'); await new Promise((r) => setTimeout(r, 20));
  const posts = c._st.scheds.filter((s) => s.phase === 'post').sort((a, b) => (a.date < b.date ? -1 : 1));
  assert.deepStrictEqual(posts.map((s) => s.id + ':' + s.date + ':' + s.round), ['pb:2026-11-12:1', 'pa:2026-11-19:2'], '옮겨 간 사후가 뒤로 가면 사후끼리 번호가 날짜순으로 다시 매겨진다');
  const pa = posts.find((s) => s.id === 'pa'); assert.strictEqual(pa.isField, false); assert.strictEqual(pa.memo, '임금 점검');
  assert.strictEqual(mainOnly(c), beforeMain, '본 일정은 글자까지 그대로(번호 포함)');
  assert.strictEqual(JSON.stringify(c._st.cos), beforeCos, '사업 상태 그대로');
  assert.ok(c._calls.raw.every((v) => !hasUndefined(v)), '저장하는 모양에 undefined 가 없다');
  assert.ok(c._calls.locks === 1 && c._calls.released === 1, '잠그고 → 저장 → 푼다');
  ['cal', 'dash', 'sum', 'ended'].forEach((k) => assert.ok(c._calls.rendered.includes(k), k + ' 을(를) 다시 그린다'));
  assert.ok(/11-05 → 11-19/.test(lastToast(c)) && /사후 번호를 날짜순으로 다시/.test(lastToast(c)), lastToast(c));
  assert.deepStrictEqual(c._calls.logs, [], '본 회차 변경 이력은 안 남긴다');
  assert.deepStrictEqual(c._calls.popups, []);
});

test('사후 칩을 옮겨도 번호가 안 바뀌면 «다시 매겼다»는 말이 없다 · 같은 날짜로 놓으면 아무 일도 없다', async () => {
  const c = moveWorld(); c.moveChip('pb', '2026-11-13'); await new Promise((r) => setTimeout(r, 20));
  assert.ok(/11-12 → 11-13/.test(lastToast(c)) && !/다시 매겼/.test(lastToast(c)), lastToast(c));
  const before = JSON.stringify(c._st.scheds), n = c._st.toasts.length;
  c.moveChip('pb', '2026-11-13'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(JSON.stringify(c._st.scheds), before); assert.strictEqual(c._st.toasts.length, n, '같은 날짜면 조용히 끝');
});

test('★ 사후 칩을 겹치는 날로 끌면 — 팝업(저장 안 함), 팝업에서 다른 날을 고르면 그 날로 옮겨진다 · 같은 사업장 같은 사업 일정(본·사후)이 있는 날도 겹침이다', async () => {
  const c = moveWorld(); c._st.scheds.push(D('c2', 't3', '2026-11-18', { id: 'o3' }));
  const before = JSON.stringify(c._st.scheds);
  c.moveChip('pa', '2026-11-18'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(JSON.stringify(c._st.scheds), before, '옮기지 않았다'); assert.strictEqual(c._calls.locks, 0, '막힌 것은 잠그기 전에 끝난다');
  assert.strictEqual(c._calls.popups.length, 1); const p = c._calls.popups[0];
  assert.ok(/하루에 한 사업장만/.test(p.msg) && /라마바식품/.test(p.msg) && p.verb === '옮기기', p.msg + ' / ' + p.verb);
  assert.ok(p.probe('2026-11-18'), '겹치는 날은 안 된다');
  assert.ok(!p.probe('2026-11-20'), '다른 날은 된다');
  await p.retry('2026-11-20'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(c._st.scheds.find((s) => s.id === 'pa').date, '2026-11-20');
  const c2 = moveWorld(); c2.moveChip('pa', '2026-11-12'); await new Promise((r) => setTimeout(r, 20));    // 같은 사업장 같은 사업의 다른 «사후»가 있는 날
  assert.strictEqual(c2._calls.popups.length, 1); assert.ok(/이미 있습니다/.test(c2._calls.popups[0].msg), c2._calls.popups[0].msg);
  const c3 = moveWorld(); c3._st.scheds.push(D('c1', 't3', '2026-11-17', { id: 'mx', round: 1 })); c3.moveChip('pa', '2026-11-17'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(c3._calls.popups.length, 1, '같은 사업장 같은 사업의 «본» 방문일도 겹침'); assert.ok(/이 사업의 일정이 이미 있습니다/.test(c3._calls.popups[0].msg), c3._calls.popups[0].msg);
});

test('사후 칩을 못 옮기는 경우 — 남의 일정 · 이미 지워진 사후 · 없는 사업장은 알림이다', async () => {
  let c = moveWorld({ canEdit: () => false }); const before = JSON.stringify(c._st.scheds);
  c.moveChip('pa', '2026-11-19'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(JSON.stringify(c._st.scheds), before); assert.ok(/타인 일정/.test(lastToast(c)), lastToast(c));
  c = moveWorld(); c._st.cos = []; c.moveChip('pa', '2026-11-19'); await new Promise((r) => setTimeout(r, 20));
  assert.ok(/사업장을 찾을 수 없습니다/.test(lastToast(c)), lastToast(c));
  c = moveWorld({ acquireCompanyEditLock: async () => false }); const b2 = JSON.stringify(c._st.scheds);
  c.moveChip('pa', '2026-11-19'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(JSON.stringify(c._st.scheds), b2, '잠금을 못 잡으면 저장하지 않는다');
});

test('★ 본 일정 칩·본 회차 줄도 같은 팝업을 쓴다 — 사후가 있는 날로 옮기거나 놓으면 팝업(막힘), 다른 날은 예전처럼 된다', async () => {
  const c = t3World(); c._st.cos[0].endedTypes = {}; c._st.cos[0].types = ['t3'];
  c._st.scheds.push(D('c1', 't3', '2026-11-01', { id: 'mv1', round: 1 }), P('c2', 't3', '2026-11-18', { id: 'pz' }));
  c.moveChip('mv1', '2026-11-18'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(c._st.scheds.find((s) => s.id === 'mv1').date, '2026-11-01', '옮기지 않았다');
  assert.strictEqual(c._calls.popups.length, 1); assert.ok(/사후컨설팅이 있습니다/.test(c._calls.popups[0].msg), c._calls.popups[0].msg);
  assert.strictEqual(c._calls.popups[0].verb, '옮기기');
  assert.ok(c._calls.popups[0].probe('2026-11-18') && !c._calls.popups[0].probe('2026-11-20'));
  await c.handleDrop('2026-11-18', { coId: 'c1', typeId: 't3', round: 2, isField: true });
  assert.strictEqual(c._calls.popups.length, 2, '본 회차를 놓을 때도 팝업'); assert.strictEqual(c._calls.popups[1].verb, '넣기');
  assert.ok(c._calls.popups[1].probe('2026-11-18') && !c._calls.popups[1].probe('2026-11-20'));
  assert.strictEqual(c._st.scheds.filter((s) => s.coId === 'c1' && s.typeId === 't3' && s.phase !== 'post').length, 1, '본 일정이 늘지 않았다');
  c._st.scheds.push(D('c1', 't3', '2026-11-03', { id: 'dupday', round: 2 }));
  await c.handleDrop('2026-11-03', { coId: 'c1', typeId: 't3', round: 3, isField: true });
  assert.ok(/동일 일정이 이미 있습니다/.test(c._calls.popups[2].msg), '같은 날 같은 사업의 본 일정: ' + c._calls.popups[2].msg);
});

test('본 회차 줄을 놓는 «날짜와 상관없는» 거절(비활성 사업장 · 등록 안 된 사업 · 종료된 사업)은 알림 그대로다', async () => {
  const c = t3World(); c._st.cos[0].active = false; await c.handleDrop('2026-11-20', { coId: 'c1', typeId: 't3', round: 1, isField: true });
  assert.ok(/비활성/.test(lastToast(c)) && c._calls.popups.length === 0, lastToast(c));
  const d = t3World(); await d.handleDrop('2026-11-20', { coId: 'c1', typeId: 't3', round: 1, isField: true });
  assert.ok(/종료된 컨설팅/.test(lastToast(d)) && d._calls.popups.length === 0, lastToast(d));
});

test('팝업 뼈대 — 화면에 있고(z-index 가 서랍 위·알림창 아래), 서랍이 열린 채로도 보이며, 색은 기존 변수만 쓴다', () => {
  assert.ok(/id="mbDup"/.test(SRC) && /id="dupDate"/.test(SRC) && /id="dupMsg"/.test(SRC) && /id="dupNear"/.test(SRC) && /id="dupErr"/.test(SRC) && /onclick="dupGo\(\)"/.test(SRC), '팝업 뼈대');
  const z = Number((SRC.match(/id="mbDup" style="z-index:(\d+)/) || [])[1]);
  assert.ok(z > 490 && z < 600, '서랍(mbPost 490)보다 위, 알림창(mbAlert 600)보다 아래: ' + z);
  const css = (SRC.match(/\/\* 날짜 겹침 팝업\(#mbDup\)[\s\S]*?\.dup-foot\{[^}]*\}/) || [''])[0];
  assert.ok(css.length > 300, '팝업 CSS 덩어리'); assert.deepStrictEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) || [], [], '새 색(#rrggbb) 없음');
  assert.ok(/\.dup-pick input\{[^}]*font-size:16px/.test(css), '입력칸 16px 이상(폰에서 확대 방지)');
});

test('Esc·✕ 로 닫을 수 있다 — 팝업이 «.mb» 창이라 공용 Esc 처리(closeTopOverlay)가 열린 .mb 를 모두 모아 맨 위를 닫는다', () => {
  assert.ok(/<div class="mb" id="mbDup"/.test(SRC), '.mb 창');
  assert.ok(grab('openOverlayList').includes(".mb.open"), '열린 .mb 를 모은다');
  assert.ok(SRC.includes('onclick="dupClose()"'), '닫기 단추');
});

test('★ 옮기기 팝업은 «지금 그 일정이 있는 날짜»를 옮길 곳으로 권하지도 고르게 두지도 않는다 (제자리라 아무 일도 안 된다)', async () => {
  const c = popWorld(); const calls = [];
  c.dupPopupOpen({ msg: '겹침', date: '2026-11-12', probe: () => '', retry: (d) => calls.push(d), verb: '옮기기', skip: '2026-11-13' });
  assert.strictEqual(dupEl(c, 'dupDate').value, '2026-11-14', '12 가 겹친 날이고 13 은 지금 있는 날이니 14 가 미리 들어간다');
  assert.ok(!/dupPick\('2026-11-13'\)/.test(dupEl(c, 'dupNear').innerHTML), '지금 날짜는 가까운 날 단추에 없다');
  dupEl(c, 'dupDate').value = '2026-11-13'; await c.dupGo();
  assert.ok(/지금 이 일정이 있는 날짜/.test(dupEl(c, 'dupErr').textContent) && calls.length === 0, '고르려 해도 막고 까닭을 적는다');
  const w = moveWorld(); w._st.scheds.push(D('c2', 't3', '2026-11-18', { id: 'o3' }));
  w.moveChip('pa', '2026-11-18'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(w._calls.popups[0].skip, '2026-11-05', '사후 칩 옮기기: 원래 날짜를 넘긴다');
  const m = t3World(); m._st.cos[0].endedTypes = {}; m._st.cos[0].types = ['t3'];
  m._st.scheds.push(D('c1', 't3', '2026-11-01', { id: 'mv1', round: 1 }), P('c2', 't3', '2026-11-18', { id: 'pz' }));
  m.moveChip('mv1', '2026-11-18'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(m._calls.popups[0].skip, '2026-11-01', '본 칩 옮기기도 원래 날짜를 넘긴다');
  const n = t3World(); n._st.scheds.push(D('c2', 't3', '2026-11-05', { id: 'o3' }));
  await n.handlePostDrop('2026-11-05', { post: true, coId: 'c1', typeId: 't3', isField: true });
  assert.ok(!('skip' in n._calls.popups[0]) || n._calls.popups[0].skip === undefined, '넣기에는 «제자리»가 없다');
});

test('★ 같은 사업장·같은 사업의 «사후»가 있는 날로 본 칩을 옮기거나 본 회차를 놓아도 팝업이다 (사후도 같은 날 동일 일정)', async () => {
  const c = t3World(); c._st.cos[0].endedTypes = {}; c._st.cos[0].types = ['t3'];
  c._st.scheds.push(D('c1', 't3', '2026-11-01', { id: 'mv1', round: 1 }), P('c1', 't3', '2026-11-18', { id: 'pself' }));
  c.moveChip('mv1', '2026-11-18'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(c._st.scheds.find((s) => s.id === 'mv1').date, '2026-11-01', '옮기지 않았다');
  assert.strictEqual(c._calls.popups.length, 1, '팝업: ' + c._st.toasts.join('|')); assert.ok(/동일 일정이 이미 있습니다/.test(c._calls.popups[0].msg), c._calls.popups[0].msg);
  await c.handleDrop('2026-11-18', { coId: 'c1', typeId: 't3', round: 2, isField: true });
  assert.strictEqual(c._calls.popups.length, 2); assert.ok(/동일 일정이 이미 있습니다/.test(c._calls.popups[1].msg), c._calls.popups[1].msg);
});

test('★ 불가 날짜에 본 회차를 놓거나 본 칩을 옮겨도 팝업이다 — 겹침이 아닌 까닭이라 제목은 «넣을 수 없습니다», 다른 날을 고르면 된다', async () => {
  const isBlocked = (d) => (d === '2026-11-21' ? '불가 날짜입니다 (휴무)' : '');
  const c = t3World({ isBlocked }); c._st.cos[0].endedTypes = {}; c._st.cos[0].types = ['t3'];
  c._st.scheds.push(D('c1', 't3', '2026-11-01', { id: 'mv1', round: 1 }));
  await c.handleDrop('2026-11-21', { coId: 'c1', typeId: 't3', round: 2, isField: true });
  assert.strictEqual(c._calls.popups.length, 1); assert.ok(/불가 날짜/.test(c._calls.popups[0].msg));
  assert.ok(c._calls.popups[0].probe('2026-11-21') && !c._calls.popups[0].probe('2026-11-23'), '불가 날짜는 안 되고 다른 날은 된다');
  c.moveChip('mv1', '2026-11-21'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(c._calls.popups.length, 2); assert.ok(/불가 날짜/.test(c._calls.popups[1].msg));
  assert.strictEqual(c._st.scheds.find((s) => s.id === 'mv1').date, '2026-11-01');
  const p = popWorld(); p.dupPopupOpen({ msg: '불가 날짜입니다 (휴무)', date: '2026-11-21', probe: () => '', retry: () => {}, verb: '넣기' });
  assert.strictEqual(dupEl(p, 'dupTitle').textContent, '이 날짜에는 넣을 수 없습니다');
});

test('서랍에서 «이미 있는» 사후의 날짜를 고치다 겹치면 — 팝업 단추는 「옮기기」이고 지금 날짜는 권하지 않는다 (새로 넣을 때는 「넣기」)', async () => {
  const c = t3World(); c._st.scheds.push(D('c2', 't3', '2026-11-12', { id: 'o3' }), P('c1', 't3', '2026-11-05', { id: 'pold', round: 1 }));
  c.openPostDrawer('c1', 't3'); c.postEdit('pold'); form(c, '2026-11-12', '');
  await c.postSave(false);
  assert.strictEqual(c._calls.popups.length, 1); assert.strictEqual(c._calls.popups[0].verb, '옮기기'); assert.strictEqual(c._calls.popups[0].skip, '2026-11-05');
  const n = t3World(); n._st.scheds.push(D('c2', 't3', '2026-11-12', { id: 'o3' }));
  n.openPostDrawer('c1', 't3'); form(n, '2026-11-12', ''); await n.postSave(false);
  assert.strictEqual(n._calls.popups[0].verb, '넣기'); assert.ok(!n._calls.popups[0].skip, '새로 넣을 때는 제자리 날짜가 없다');
});

test('본 칩을 «제자리»에 놓으면 — 그 날짜가 불가 날짜여도 아무 일도 없다 (팝업·알림 없음)', async () => {
  const c = t3World({ isBlocked: (d) => (d === '2026-11-21' ? '불가 날짜입니다' : '') }); c._st.cos[0].endedTypes = {}; c._st.cos[0].types = ['t3'];
  c._st.scheds.push(D('c1', 't3', '2026-11-21', { id: 'onblocked', round: 1 }));
  const before = JSON.stringify(c._st.scheds), n = c._st.toasts.length;
  c.moveChip('onblocked', '2026-11-21'); await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(JSON.stringify(c._st.scheds), before); assert.strictEqual(c._st.toasts.length, n); assert.deepStrictEqual(c._calls.popups, []);
});

test('팝업 접근성 — 대화상자 역할·제목 연결, 가까운 날짜 단추는 손가락으로 누르기 쉬운 크기', () => {
  assert.ok(/id="mbDup"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="dupTitle"/.test(SRC), '대화상자 속성');
  assert.ok(/\.dup-chip\{[^}]*padding:8px 14px/.test(SRC), '칩 크기');
});
