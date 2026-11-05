/* 종료 사업장 관리 개편 — 정부컨설팅 일정관리 (대표 지시 2026-11-02, 시안 승인 「추천대로」)

   대표 요청: 종료·삭제를 다르게 분리 · 검색 · 종료 시기 검토 · 종료 뒤 수정(재시도) · (사후컨설팅은 다음 PR)

   ■ 못 박는 규칙
     · 종료 / 시기 검토 / 삭제·정리를 «따로» 본다. 합치기로 숨은 곳은 삭제가 아니다 — 복귀·영구삭제를 막는다.
     · 시기 검토 여섯 규칙은 «글자가 아니라 계산»으로 판정한다(경계: 같은 날 3건 · 30일).
     · 종료 뒤 수정은 «수정 중» 으로 원래 종료일을 보관한다 — 이알피 따라 끝내기가 고치는 중에 도로 끝내면 안 된다.
     · 저장하는 모양에 undefined 를 남기지 않는다(실시간DB 가 통째로 거부한다).

   ★ 이 검사는 「글자가 있나」가 아니라 **실제로 함수를 돌려서** 본다. 예시는 전부 가짜 이름이다. */
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
const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const J = (x) => JSON.parse(JSON.stringify(x));
function hasUndefined(v) {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.some(hasUndefined);
  if (v && typeof v === 'object') return Object.values(v).some(hasUndefined);
  return false;
}
function load(names, over) {
  const ctx = vm.createContext(Object.assign({ Set, Array, Object, JSON, Math, String, Number, Date, escAttr: esc, console }, over || {}));
  vm.runInContext(names.map(grab).join('\n'), ctx);
  return ctx;
}

/* ══ ① 시기 검토 — 여섯 규칙 ═══════════════════════════════════ */

const FLAGS = ['endedRuleList', 'endedDays', 'endedMd', 'endedFlagsFor'];
const base = (o) => Object.assign({ endedDate: '2026-10-24', scheds: [{ date: '2026-10-10', isField: true }, { date: '2026-10-18', isField: true }, { date: '2026-10-20', isField: false }],
  maxR: 3, mandatory: 2, deadline: '2026-10-31', erp: 'none', sameDay: 1, checked: [] }, o || {});
const rules = (ctx, o) => ctx.endedFlagsFor(base(o)).map((f) => f.rule).join(',');

test('정상인 사업은 아무 것도 안 걸린다', () => {
  assert.strictEqual(rules(load(FLAGS)), '');
});

test('★ 이알피는 진행 중인데 일정관리만 종료 — «이알피 쪽이 진행 중일 때만» 걸린다', () => {
  const c = load(FLAGS);
  assert.strictEqual(rules(c, { erp: 'running' }), 'erp');
  assert.strictEqual(rules(c, { erp: 'none' }), '', '이알피와 안 이어졌다고 걸면 거짓 경보다');
  assert.strictEqual(rules(c, { erp: 'closed' }), '');
});

test('같은 날 묶음 종료 — 3건부터 (2건은 안 걸린다)', () => {
  const c = load(FLAGS);
  assert.strictEqual(rules(c, { sameDay: 3 }), 'bulk');
  assert.strictEqual(rules(c, { sameDay: 2 }), '');
  const f = c.endedFlagsFor(base({ sameDay: 8 }))[0];
  assert.ok(f.reason.includes('8건') && f.hint.includes('10-20'), '하루 몇 건인지와 «마지막 방문일로» 고치자는 제안이 보여야 한다');
  const none = c.endedFlagsFor(base({ sameDay: 4, scheds: [] })).find((x) => x.rule === 'bulk');
  assert.ok(none && /알 수 없/.test(none.hint), '일정이 없으면 제안할 날짜가 없다 — 지어내지 않는다');
});

test('마지막 방문 뒤 30일 넘어 종료 — 30일은 안 걸리고 31일부터', () => {
  const c = load(FLAGS);
  assert.strictEqual(rules(c, { endedDate: '2026-10-24', scheds: [{ date: '2026-09-24', isField: true }, { date: '2026-09-24', isField: true }, { date: '2026-09-24', isField: true }] }), '', '30일 뒤는 정상 범위');
  assert.strictEqual(rules(c, { endedDate: '2026-10-25', scheds: [{ date: '2026-09-24', isField: true }, { date: '2026-09-24', isField: true }, { date: '2026-09-24', isField: true }] }), 'late');
  const f = c.endedFlagsFor(base({ endedDate: '2026-10-25', scheds: [{ date: '2026-09-24', isField: true }, { date: '2026-09-24', isField: true }, { date: '2026-09-24', isField: true }] }))[0];
  assert.ok(f.acts.includes('fix') && f.hint.includes('09-24'), '종료일을 마지막 방문일로 고치자는 제안과 «고치기» 단추');
});

test('회차·방문 미달 — 일정이 0회인 사업은 «일정 0회» 로만 걸린다(두 번 안 걸린다)', () => {
  const c = load(FLAGS);
  assert.strictEqual(rules(c, { scheds: [{ date: '2026-10-18', isField: true }, { date: '2026-10-19', isField: true }] }), 'short', '2/3 회');
  assert.strictEqual(rules(c, { scheds: [{ date: '2026-10-10', isField: false }, { date: '2026-10-18', isField: false }, { date: '2026-10-20', isField: false }] }), 'short', '의무 방문 2회에 방문 0회');
  assert.strictEqual(rules(c, { scheds: [] }), 'zero', '★ 0회는 «일정 0회» 하나로');
  assert.strictEqual(rules(c, { maxR: 0, mandatory: 0, scheds: [{ date: '2026-10-18', isField: true }] }), '', '최대회차·의무가 없으면 미달이 없다');
});

test('계약만료일과 30일 넘게 차이 — 일찍도 늦게도 말해 준다', () => {
  const c = load(FLAGS);
  assert.strictEqual(rules(c, { deadline: '2026-09-23' }), 'dl');
  assert.strictEqual(rules(c, { deadline: '2026-09-24' }), '', '30일은 안 걸린다');
  assert.strictEqual(rules(c, { deadline: '2026-12-01' }), 'dl');
  assert.ok(c.endedFlagsFor(base({ deadline: '2026-09-01' }))[0].hint.includes('늦게'));
  assert.ok(c.endedFlagsFor(base({ deadline: '2026-12-31' }))[0].hint.includes('일찍'));
  assert.strictEqual(rules(c, { deadline: '' }), '', '계약만료일이 없으면 비교하지 않는다');
});

test('★ 「확인함」으로 넘긴 규칙은 다시 걸리지 않는다 — 나머지 규칙은 그대로', () => {
  const c = load(FLAGS);
  assert.strictEqual(rules(c, { erp: 'running', sameDay: 5, checked: ['erp'] }), 'bulk');
  assert.strictEqual(rules(c, { erp: 'running', sameDay: 5, checked: ['erp', 'bulk'] }), '');
});

test('규칙 목록은 여섯 가지이고 서로 이름이 겹치지 않는다', () => {
  const l = load(FLAGS).endedRuleList();
  assert.strictEqual(l.length, 6);
  assert.strictEqual(new Set(l.map((r) => r.key)).size, 6);
  assert.ok(l.every((r) => r.title && r.explain));
});

/* ══ ② 종료 뒤 수정 — 상태가 어떻게 옮겨 가나 ═══════════════════ */

const ST = ['endedDateOk', 'endedClearChk', 'endedLogAdd', 'endedFixDateOn', 'endedStartEditOn', 'endedFinishEditOn', 'endedRevertEditOn', 'endedCheckOn'];
const TODAY = '2026-11-02';
const mkCo = () => ({ id: 'c1', name: '가나상사', types: ['t1', 't2'], endedTypes: { t1: '2026-10-24', t2: '2026-07-15' }, endedChk: { t1: ['erp'] } });

test('★ 종료일만 고치기 — 값이 바뀌고, 근거가 바뀌었으니 «확인함»은 비우고, 기록이 남는다', () => {
  const c = load(ST); const co = mkCo();
  const r = c.endedFixDateOn(co, 't1', '2026-10-18', '홍길동', TODAY);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(co.endedTypes.t1, '2026-10-18');
  assert.strictEqual(co.endedTypes.t2, '2026-07-15', '다른 종류는 건드리지 않는다');
  assert.ok(!(co.endedChk && co.endedChk.t1), '확인함이 남으면 바뀐 날짜가 검토를 못 받는다');
  const log = co.endedLog.t1;
  assert.ok(log.length === 1 && log[0].by === '홍길동' && /10-24/.test(log[0].t) && /10-18/.test(log[0].t), '누가 무엇을 어떻게 바꿨는지');
  assert.ok(!hasUndefined(J(co)), '저장 모양에 undefined 가 있으면 클라우드가 통째로 거부한다');
});

test('종료일 고치기는 이런 때 거절한다 — 날짜 모양 · 미래 · 그대로 · 종료 아님', () => {
  const c = load(ST);
  assert.strictEqual(c.endedFixDateOn(mkCo(), 't1', '10/18', 'x', TODAY).ok, false);
  assert.strictEqual(c.endedFixDateOn(mkCo(), 't1', '2026-11-03', 'x', TODAY).ok, false, '내일 날짜');
  assert.strictEqual(c.endedFixDateOn(mkCo(), 't1', '2026-10-24', 'x', TODAY).ok, false, '그대로');
  assert.strictEqual(c.endedFixDateOn(mkCo(), 't9', '2026-10-18', 'x', TODAY).ok, false, '끝난 적 없는 사업');
  const co = mkCo(); c.endedFixDateOn(co, 't1', '10/18', 'x', TODAY);
  assert.strictEqual(co.endedTypes.t1, '2026-10-24', '거절했으면 아무 것도 안 바뀐다');
});

test('★ 수정 시작 — 종료는 «비우되» 원래 종료일을 보관한다', () => {
  const c = load(ST); const co = mkCo();
  const r = c.endedStartEditOn(co, 't1', '홍길동', TODAY);
  assert.strictEqual(r.ok, true);
  assert.ok(!('t1' in co.endedTypes), '수정 중에는 진행 사업처럼 일정을 고칠 수 있어야 한다');
  assert.deepStrictEqual(J(co.reopened.t1), { was: '2026-10-24', at: TODAY, by: '홍길동' });
  assert.strictEqual(co.endedTypes.t2, '2026-07-15', '다른 종류는 그대로 종료');
  assert.ok(!(co.endedChk && co.endedChk.t1));
  assert.strictEqual(c.endedStartEditOn(co, 't1', 'x', TODAY).ok, false, '이미 수정 중이면 한 번 더 시작할 수 없다');
});

test('★ 다시 종료 — 원래 종료일을 지키거나 새 날짜로, 수정 중 표시는 지운다', () => {
  const c = load(ST);
  let co = mkCo(); c.endedStartEditOn(co, 't1', '홍길동', TODAY);
  assert.strictEqual(c.endedFinishEditOn(co, 't1', '2026-10-24', '홍길동', TODAY).ok, true);
  assert.strictEqual(co.endedTypes.t1, '2026-10-24');
  assert.ok(!co.reopened, '표시가 남으면 영영 «수정 중» 으로 보인다');
  co = mkCo(); c.endedStartEditOn(co, 't1', '홍길동', TODAY);
  c.endedFinishEditOn(co, 't1', TODAY, '홍길동', TODAY);
  assert.strictEqual(co.endedTypes.t1, TODAY);
  assert.ok(co.endedLog.t1.some((l) => /원래 2026-10-24/.test(l.t)), '원래 종료일이 기록에 남는다');
  co = mkCo(); c.endedStartEditOn(co, 't1', 'x', TODAY);
  assert.strictEqual(c.endedFinishEditOn(co, 't1', '2026-11-30', 'x', TODAY).ok, false, '미래 종료일은 거절');
  assert.strictEqual(c.endedFinishEditOn(mkCo(), 't1', TODAY, 'x', TODAY).ok, false, '수정 중이 아닌 사업은 다시 종료할 수 없다');
  assert.ok(!hasUndefined(J(co)));
});

test('★ 원래대로 — 종료일을 되돌리고 수정 중 표시를 지운다', () => {
  const c = load(ST); const co = mkCo();
  c.endedStartEditOn(co, 't1', '홍길동', TODAY);
  const r = c.endedRevertEditOn(co, 't1', '홍길동', TODAY);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(co.endedTypes.t1, '2026-10-24');
  assert.ok(!co.reopened);
  assert.strictEqual(c.endedRevertEditOn(co, 't1', 'x', TODAY).ok, false);
});

test('확인함 — 같은 규칙을 두 번 넣어도 한 번만, 종류별로 따로', () => {
  const c = load(ST); const co = mkCo(); delete co.endedChk;
  c.endedCheckOn(co, 't1', 'late'); c.endedCheckOn(co, 't1', 'late'); c.endedCheckOn(co, 't2', 'erp');
  assert.deepStrictEqual(J(co.endedChk), { t1: ['late'], t2: ['erp'] });
});

test('수정 기록은 종류마다 최근 10줄만 남긴다', () => {
  const c = load(ST); const co = mkCo();
  for (let i = 0; i < 14; i++) c.endedLogAdd(co, 't1', '홍길동', '기록 ' + i, TODAY);
  assert.strictEqual(co.endedLog.t1.length, 10);
  assert.strictEqual(co.endedLog.t1[9].t, '기록 13', '가장 최근 것이 남아야 한다');
});

/* ══ ③ 모으기 · 찾기 ═══════════════════════════════════════════ */

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
    getCoMaxRounds: (coId, tid) => 3, getCoMandatory: (coId, tid) => (tid === 't1' ? 2 : 0),
    toast: (m) => st.toasts.push(String(m)), renderDash: () => {}, renderCal: () => {},
    erpSidName: () => '',
  }, over || {}));
  vm.runInContext(enLine + '\n' + S.slice(cc, ccEnd) + '\n' + S.slice(g, gEnd) + '\n' + S.slice(a, b) + '\n' +
    ['isPostSched', 'getMainScheds', 'postPhotoCount', 'getCoPostTarget', 'endedRuleList', 'endedDays', 'endedMd', 'endedFlagsFor', 'endedInfos', 'endedMatches'].map(grab).join('\n'), ctx);
  ctx._st = st;
  return ctx;
}
function board() {
  const ctx = engine(); const st = ctx._st;
  st.staff = [{ id: 'a1', name: '홍길동' }, { id: 'a2', name: '임꺽정' }];
  st.cos = [
    { id: 'c1', name: '가나상사', defAtt: 'a1', defCoAtts: ['a2'], types: ['t1'], endedTypes: { t1: '2026-10-24' }, deadlines: { t1: '2026-10-31' } },
    { id: 'c2', name: '라마바식품', defAtt: 'a2', defCoAtts: [], types: ['t1', 't2'], endedTypes: { t1: '2026-10-24' }, reopened: { t2: { was: '2026-07-15', at: '2026-11-01', by: '홍길동' } } },
    { id: 'c3', name: '사아정밀', defAtt: 'a1', defCoAtts: [], types: ['t1'], endedTypes: { t1: '2026-10-24' } },
    { id: 'c4', name: '자차산업', defAtt: 'a1', defCoAtts: [], types: ['t1'], endedTypes: { t1: '2026-10-24' } },
    { id: 'c5', name: '진행중상회', defAtt: 'a1', defCoAtts: [], types: ['t1'] },
    { id: 'c6', name: '삭제된곳', defAtt: 'a1', defCoAtts: [], types: ['t1'], endedTypes: { t1: '2026-01-01' }, deleted: true, deletedDate: '2026-09-14' },
  ];
  const day = (coId, tid, date, f) => ({ id: coId + tid + date, coId, typeId: tid, date, isField: f });
  st.scheds = [day('c1', 't1', '2026-10-10', true), day('c1', 't1', '2026-10-18', true), day('c1', 't1', '2026-10-20', false),
    day('c2', 't1', '2026-10-01', true), day('c2', 't2', '2026-06-20', true)];
  ctx.ERP.consultings = [{ id: 'E1', companyName: '가나상사', typeCode: 'k1', managerMain: 'S1', managerSubs: [], status: 'pending' }];
  return ctx;
}

test('★ 종료된 사업과 «수정 중» 인 사업만 모은다 — 진행 중·삭제된 사업장은 뺀다', () => {
  const c = board();
  const items = c.endedInfos();
  const ids = items.map((i) => i.co.id + ':' + i.tid + ':' + i.state).sort();
  assert.strictEqual(ids.join(','), 'c1:t1:ended,c2:t1:ended,c2:t2:editing,c3:t1:ended,c4:t1:ended');
  const ed = items.find((i) => i.state === 'editing');
  assert.strictEqual(ed.endedDate, '2026-07-15', '수정 중인 사업의 «원래 종료일»');
  assert.strictEqual(ed.flags.length, 0, '수정 중인 사업은 시기 검토에 올리지 않는다');
});

test('모은 값 — 시작일·회차·현장/사무실·계약만료·같은 날 건수·이알피 진행 여부', () => {
  const c = board(); const it = c.endedInfos().find((i) => i.co.id === 'c1');
  assert.strictEqual(it.start, '2026-10-10');
  assert.strictEqual(it.cnt, 3); assert.strictEqual(it.fieldCnt, 2); assert.strictEqual(it.officeCnt, 1);
  assert.strictEqual(it.deadline, '2026-10-31');
  assert.strictEqual(it.sameDay, 4, '10-24 하루에 종료된 «종료 상태» 4건(수정 중은 세지 않는다)');
  assert.strictEqual(it.erp, 'running', '이알피 건이 진행 중(pending)');
  const rules = Array.from(it.flags).map((f) => f.rule).sort().join(',');
  assert.ok(rules.includes('bulk') && rules.includes('erp'), '같은 날 묶음 + 이알피 진행 중: ' + rules);
});

test('이알피를 못 읽었으면 «이알피 진행 중» 으로 걸지 않는다 (모르는 것을 진행 중이라 하지 않는다)', () => {
  const c = board(); c.ERP.loaded = false;
  c.endedInfos().forEach((i) => assert.ok(!Array.from(i.flags).some((f) => f.rule === 'erp'), '이알피를 못 읽었는데 걸렸다'));
});

test('★ 확인함으로 넘긴 규칙은 모은 결과에서 빠진다', () => {
  const c = board(); c._st.cos[0].endedChk = { t1: ['erp', 'bulk'] };
  const it = c.endedInfos().find((i) => i.co.id === 'c1');
  assert.ok(!Array.from(it.flags).some((f) => f.rule === 'erp' || f.rule === 'bulk'));
});

test('★ 찾기 — 사업장 이름·담당자(주·부)·사업 이름·기관으로, 대소문자·띄어쓰기에 휘둘리지 않는다', () => {
  const c = board(); const items = c.endedInfos(); const ref = { staff: c._st.staff, types: c.getTypes() };
  const ids = (f) => Array.from(new Set(items.filter((i) => c.endedMatches(i, Object.assign({ q: '', who: '', typ: '' }, f), ref)).map((i) => i.co.id))).sort().join(',');
  assert.strictEqual(ids({ q: '라마' }), 'c2');
  assert.strictEqual(ids({ q: '임꺽정' }), 'c1,c2', '주담당(c2)과 부담당(c1) 모두');
  assert.strictEqual(ids({ q: '가나협력' }), 'c1,c2,c3,c4', '기관 이름도 찾는다');
  assert.strictEqual(ids({ q: '기술보호울타리' }), 'c1,c2,c3,c4', '사업 정식 이름');
  assert.strictEqual(ids({ q: '없는이름' }), '');
  assert.strictEqual(ids({ who: '홍길동' }), 'c1,c3,c4');
  assert.strictEqual(ids({ typ: '현장클리닉' }), 'c2');
  assert.strictEqual(ids({ q: '상사', who: '홍길동' }), 'c1', '조건은 모두 맞아야 한다');
  assert.strictEqual(ids({ q: '상사', who: '임꺽정' }), 'c1', '부담당도 담당으로 친다');
  assert.strictEqual(ids({ q: '라마', who: '홍길동' }), '', '이름은 맞아도 담당이 다르면 안 나온다');
});

/* ══ ④ 화면 글자 — 목록·검토·삭제 ═══════════════════════════════ */

const VIEW = ['endedHi', 'endedPeopleHtml', 'postCellHtml', 'postCountText', 'endedListHtml', 'endedReviewGroups', 'endedReviewHtml', 'endedDeleteInfos', 'endedDeleteHtml'];
function view() {
  const c = board();
  const w = load(['endedRuleList', 'endedDays', 'endedMd', 'endedFlagsFor', ...VIEW], { staffColor: (a) => '#ef6c35', getCoAtts: (o) => (o && o.defCoAtts) || [], todayStr: () => TODAY });
  return { c, w, items: c.endedInfos(), ref: { staff: c._st.staff, types: c.getTypes() } };
}

test('★ 종료 목록 — ☐ + 번호가 맨 왼쪽, 한 사업이 한 줄, 종료 단추와 수정 중 단추가 갈린다', () => {
  const { w, items, ref } = view();
  const h = w.endedListHtml(items, ref, '');
  assert.strictEqual((h.match(/class="ended-ck"/g) || []).length, items.length, '줄마다 ☐ 가 하나');
  assert.strictEqual((h.match(/class="eg ended-line2"/g) || []).length, items.length, '한 사업이 한 줄');
  assert.ok(/openEndEdit\('c1','t1'\)/.test(h) && /endedRestore\('c1','t1'\)/.test(h), '종료된 줄에는 「수정」「재개」');
  assert.ok(/endedRevert\('c2','t2'\)/.test(h) && /openEndEdit\('c2','t2'\)[^]*?다시 종료/.test(h), '수정 중인 줄에는 「다시 종료」「원래대로」');
  assert.ok(!/endedRestore\('c2','t2'\)/.test(h), '수정 중인 줄에는 재개가 없다(이미 열려 있다)');
  const nums = [...h.matchAll(/class="ended-no2">(\d+)</g)].map((m) => +m[1]);
  assert.deepStrictEqual(nums, nums.map((_, i) => i + 1), '번호는 보이는 순서대로 1부터');
  assert.ok(/수정 중/.test(h) && /원래 종료일 <b>2026-07-15<\/b>/.test(h), '수정 중 줄 밑에 원래 종료일 안내');
});

test('★ 같은 사업장의 둘째 줄은 이름·담당을 되풀이하지 않는다 (열은 그대로 맞춘다)', () => {
  const { w, c, ref } = view();
  c._st.cos[0].types = ['t1', 't2']; c._st.cos[0].endedTypes.t2 = '2026-07-15';
  const items = c.endedInfos().filter((i) => i.co.id === 'c1');
  const h = w.endedListHtml(items, ref, '');
  assert.strictEqual((h.match(/가나상사/g) || []).length, 1, '사업장 이름은 한 번만');
  assert.ok(/같은 사업장/.test(h));
});

test('★ 찾는 글자는 눈에 띄게 표시되고, 이름 속 HTML 글자는 무해하게 처리된다', () => {
  const { w } = view();
  assert.strictEqual(w.endedHi('라마바식품', '라마'), '<mark>라마</mark>바식품');
  assert.strictEqual(w.endedHi('라마바식품', ''), '라마바식품');
  assert.strictEqual(w.endedHi('<b>x</b>', 'x'), '&lt;b&gt;<mark>x</mark>&lt;/b&gt;', '★ 이름이 HTML 로 그대로 들어가면 안 된다');
});

test('★ 시기 검토 — 규칙별로 묶고, 건수는 «걸린 사업 수»이며, 근거와 제안이 보인다', () => {
  const { w, items } = view();
  const g = w.endedReviewGroups(items);
  const by = Object.fromEntries(g.map((x) => [x.rule, x.rows.length]));
  assert.strictEqual(by.bulk, 4, '10-24 하루 4건');
  assert.strictEqual(by.erp, 1);
  assert.ok(g.every((x) => x.rows.length > 0), '걸린 것이 없는 규칙 묶음은 안 보인다');
});

test('시기 검토 글자 — 「종료일 고치기」는 고칠 수 있는 규칙에만, 고치는 중인 줄은 날짜 입력으로 바뀐다', () => {
  const { w, items, ref } = view();
  const h = w.endedReviewHtml(items, ref, '', { fix: null, more: {} });
  assert.ok(/endedCheck\('c1','t1','erp'\)/.test(h), '확인함 단추');
  assert.ok(/endedFixOpen\('c1','t1'\)/.test(h), '같은 날 묶음에는 종료일 고치기');
  const h2 = w.endedReviewHtml(items, ref, '', { fix: { coId: 'c1', tid: 't1' }, more: {} });
  assert.ok(/id="endedFixDate"/.test(h2) && /endedFixSave\('c1','t1'\)/.test(h2), '날짜 입력과 저장');
});

test('★ 삭제·정리 — 직접 삭제와 «합치기로 숨은 곳»을 가른다. 합친 곳에는 복귀·영구삭제가 없다', () => {
  const { w, c, ref } = view();
  c._st.cos.push({ id: 'c7', name: '가나상사(옛)', defAtt: 'a1', defCoAtts: [], types: ['t1'], deleted: true, deletedDate: '2026-09-06', mergedInto: 'c1' });
  const d = w.endedDeleteInfos(c.getCos(), c.getScheds(), { q: '' }, ref);
  assert.strictEqual(d.direct.length, 1); assert.strictEqual(d.merged.length, 1);
  assert.strictEqual(d.merged[0].target, '가나상사');
  const h = w.endedDeleteHtml(d, ref, '');
  assert.ok(/restoreDeletedCo\('c6'\)/.test(h) && /purgeDeletedCo\('c6'\)/.test(h), '직접 삭제에는 복귀·영구삭제');
  assert.ok(!/restoreDeletedCo\('c7'\)|purgeDeletedCo\('c7'\)/.test(h), '★ 합쳐서 숨은 곳을 복귀하면 같은 회사가 두 줄이 된다');
  assert.ok(/endedGoDash\(/.test(h) && h.includes('가나상사'), '대신 «합쳐진 곳 보기»');
});

test('직접 삭제한 사업장에 일정이 남아 있으면 영구삭제 전에 경고한다', () => {
  const { w, c, ref } = view();
  c._st.scheds.push({ id: 'z', coId: 'c6', typeId: 't1', date: '2026-01-05', isField: true });
  const h = w.endedDeleteHtml(w.endedDeleteInfos(c.getCos(), c.getScheds(), { q: '' }, ref), ref, '');
  assert.ok(/일정 1개/.test(h) && /영구삭제하면/.test(h));
});

/* ══ ⑤ 막는 자리 · 이어지는 자리 ═══════════════════════════════ */

test('★ 합치기로 숨은 사업장은 «함수로도» 복귀·영구삭제가 안 된다 (화면 단추를 안 만든 것만으로는 부족)', async () => {
  const toasts = []; let saved = 0;
  const ctx = vm.createContext({ Set, Array, Object, JSON, Promise, setTimeout, clearTimeout,
    getCos: () => [{ id: 'c7', name: '옛', deleted: true, mergedInto: 'c1' }], setCos: () => { saved++; }, getScheds: () => [], setScheds: () => { saved++; },
    acquireCompanyEditLock: async () => true, verifyCompanyEditLock: async () => true, releaseCompanyEditLock: () => {},
    toast: (m) => toasts.push(m), renderEndedView: () => {}, renderSummaryBar: () => {}, renderDash: () => {}, renderCal: () => {},
    q: () => null, takeSnapshot: () => {}, showUndoToast: () => {}, _purgingIds: new Set(), _purgeTimers: {}, deletePhotoFromDB: () => {} });
  vm.runInContext(['restoreDeletedCo', 'purgeDeletedCo'].map(grab).join('\n'), ctx);
  await ctx.restoreDeletedCo('c7'); await ctx.purgeDeletedCo('c7');
  assert.strictEqual(saved, 0, '아무 것도 저장하면 안 된다');
  assert.ok(toasts.length === 2 && toasts.every((t) => /합치기/.test(t)), '왜 안 되는지 말해 준다');
});

test('★ 이알피 종료를 따라 끝내기는 «수정 중인 사업»을 다시 끝내지 않는다', () => {
  const c = board(); const st = c._st;
  st.cos = [{ id: 'c1', name: '가나상사', defAtt: 'a1', defCoAtts: [], types: ['t1'], reopened: { t1: { was: '2026-10-24', at: '2026-11-01', by: '홍길동' } } }];
  c.ERP.consultings = [{ id: 'E1', companyName: '가나상사', typeCode: 'k1', managerMain: 'S1', managerSubs: [], status: 'closed', closedDate: '2026-10-30' }];
  c.erpSyncClosedDown();
  assert.ok(!st.cos[0].endedTypes || !st.cos[0].endedTypes.t1, '★ 고치는 중에 저절로 도로 종료됩니다');
  /* 대조: 수정 중이 아니면 따라 끝낸다 */
  delete st.cos[0].reopened;
  c.erpSyncClosedDown();
  assert.ok(st.cos[0].endedTypes && st.cos[0].endedTypes.t1, '수정 중이 아닌 사업은 지금처럼 따라 끝낸다');
});

test('다시 「종료」 단추로 끝내면 수정 중 표시도 같이 지운다', async () => {
  const log = { cos: null };
  const ctx = vm.createContext({ Set, Array, Object, JSON, Promise, escAttr: esc,
    getTypes: () => [{ id: 't1', name: '기술보호' }], getCos: () => [{ id: 'c1', types: ['t1'], endedTypes: {}, reopened: { t1: { was: '2026-10-24', at: 'x', by: 'y' } } }],
    setCos: (v) => { log.cos = J(v); }, showConfirm: (m, cb) => { log.cb = cb; }, acquireCompanyEditLock: async () => true, verifyCompanyEditLock: async () => true,
    releaseCompanyEditLock: () => {}, renderSummaryBar: () => {}, renderDash: () => {}, renderCal: () => {}, renderEndedView: () => {}, q: () => null, toast: () => {}, todayStr: () => TODAY,
    erpAskCloseUp: () => false });   // endConsulting 이 실제로 부르는 함수 — 이알피 쪽은 gov-erp-close-up.test.js 가 돌린다
  vm.runInContext(['dashActiveTypeIds', 'endConsulting'].map(grab).join('\n'), ctx);
  ctx.endConsulting('c1', 't1'); await log.cb();
  assert.strictEqual(log.cos[0].endedTypes.t1, TODAY);
  assert.ok(!log.cos[0].reopened, '종료했는데 «수정 중» 이 남으면 이중으로 보인다');
});

test('진행 목록의 사업 줄에 «종료 수정 중» 알림이 뜬다 — 잊고 두지 않게', () => {
  const c = load(['dashReopenBadge']);
  assert.strictEqual(c.dashReopenBadge({ reopened: {} }, 't1'), '');
  const b = c.dashReopenBadge({ reopened: { t1: { was: '2026-10-24', at: TODAY, by: '홍길동' } } }, 't1');
  assert.ok(b.includes('수정 중') && b.includes('2026-10-24'), '원래 종료일이 보여야 한다');
  assert.strictEqual(c.dashReopenBadge({ reopened: { t1: { was: '2026-10-24' } } }, 't2'), '', '다른 종류에는 안 뜬다');
});

test('화면 뼈대 — 탭 셋 · 검색창 · 수정 창이 있고, 새 저장 칸 이름이 저장 허용 목록 때문에 막히지 않는다', () => {
  ['id="endedTabs"', 'id="endedQ"', 'id="endedWho"', 'id="endedTyp"', 'id="mbEndEdit"', 'id="endedList"'].forEach((x) => assert.ok(SRC.includes(x), x + ' 이(가) 없다'));
  const r = grab('renderEndedView');
  assert.ok(/endedInfos\(/.test(r) && /endedListHtml\(/.test(r) && /endedReviewHtml\(/.test(r) && /endedDeleteHtml\(/.test(r), '세 탭을 그리는 함수들을 모두 부른다');
});

/* ══ ⑥ 화면 연결 — 가짜 화면 요소를 끼워 «진짜 함수»를 태운다 ═══════════ */

function uiWorld(over) {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', value: '', style: {}, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } }, dataset: {} });
  const checks = [];
  const ctx = engine(Object.assign({
    S: { endedTab: 'end', endedQ: '', endedWho: '', endedTyp: '', endedYear: 'all', endedFix: null, endedMore: {} },
    q: (s) => el(s), qa: (s) => (/ended-ck:checked/.test(s) ? checks.filter((c) => c.checked) : /ended-tab/.test(s) ? [] : checks),
    staffColor: () => '#ef6c35', _purgingIds: new Set(), showConfirm: (m, cb) => { ctx._confirm = m; ctx._cb = cb; },
    acquireCompanyEditLock: async () => true, verifyCompanyEditLock: async () => true, releaseCompanyEditLock: () => {},
    renderSummaryBar: () => {}, restoreConsulting: async () => {}, restoreDeletedCo: async (id) => { ctx._undeleted = (ctx._undeleted || []).concat(id); },
    showTab: (t) => { ctx._tab = t; }, isAdmin: () => true, closeModal: (id) => { ctx._closed = id; },
  }, over));
  vm.runInContext(['endedFilterState', 'endedSetTab', 'endedSetQ', 'endedClearQ', 'endedSetWho', 'endedSetTyp', 'endedMore', 'endedFixOpen', 'endedFixCancel', 'endedGoDash', 'endedMyName', 'endedMutate',
    'endedDateOk', 'endedClearChk', 'endedLogAdd', 'endedFixDateOn', 'endedStartEditOn', 'endedFinishEditOn', 'endedRevertEditOn', 'endedCheckOn',
    'endedCheck', 'endedCheckGroup', 'endedFixSave', 'endedRestore', 'endedRevert', 'endedSelKeys', 'endedSelAll', 'endedSelChange', 'endedSelClear', 'endedBatch',
    'openEndEdit', 'endEditPick', 'renderEndEdit', 'endedRevertFromModal', 'saveEndEdit', 'renderEndedView',
    'endedHi', 'endedPeopleHtml', 'postCellHtml', 'postCountText', 'endedListHtml', 'endedReviewGroups', 'endedReviewHtml', 'endedDeleteInfos', 'endedDeleteHtml'].map(grab).join('\n') +
    '\nvar _endedCur={items:[],ref:null,groups:[]}; var _endEdit=null;', ctx);
  const st = ctx._st;
  st.staff = [{ id: 'a1', name: '홍길동' }, { id: 'a2', name: '임꺽정' }];
  st.cos = [
    { id: 'c1', name: '가나상사', defAtt: 'a1', defCoAtts: ['a2'], types: ['t1'], endedTypes: { t1: '2026-10-24' } },
    { id: 'c2', name: '라마바식품', defAtt: 'a2', defCoAtts: [], types: ['t1'], endedTypes: { t1: '2026-10-24' } },
    { id: 'c3', name: '사아정밀', defAtt: 'a1', defCoAtts: [], types: ['t1'], endedTypes: { t1: '2026-10-24' } },
    { id: 'c6', name: '삭제된곳', defAtt: 'a1', defCoAtts: [], types: ['t1'], deleted: true, deletedDate: '2026-09-14' },
    { id: 'c7', name: '가나상사(옛)', defAtt: 'a1', defCoAtts: [], types: ['t1'], deleted: true, deletedDate: '2026-09-06', mergedInto: 'c1' },
  ];
  st.scheds = [{ id: 'x', coId: 'c1', typeId: 't1', date: '2026-10-18', isField: true }];
  ctx._els = els; ctx._checks = checks;
  return ctx;
}

test('★ 화면을 그리면 탭마다 건수가 적히고, 선택한 탭의 목록이 그려진다 — 세 탭 모두 오류 없이', () => {
  const c = uiWorld();
  c.renderEndedView();
  assert.ok(/3건 · 3곳/.test(c._els['#endedNEnd'].textContent), '종료 건수: ' + c._els['#endedNEnd'].textContent);
  assert.ok(/건$/.test(c._els['#endedNRev'].textContent));
  assert.strictEqual(c._els['#endedNDel'].textContent, '2곳', '삭제·정리 = 직접 삭제 1 + 합치기로 숨김 1');
  assert.ok(/class="eg ended-line2"/.test(c._els['#endedList'].innerHTML));
  c.endedSetTab('rev'); assert.ok(/ended-rg/.test(c._els['#endedList'].innerHTML) && /이상해 보이는/.test(c._els['#endedList'].innerHTML), '검토 탭');
  c.endedSetTab('del'); assert.ok(/직접 삭제한 사업장/.test(c._els['#endedList'].innerHTML) && /합치기로 숨은/.test(c._els['#endedList'].innerHTML), '삭제 탭');
});

test('★ 검색어를 넣으면 모든 탭 건수가 함께 줄고, 안내 글이 «어디서 몇 건 찾았는지» 말한다', () => {
  const c = uiWorld();
  c.endedSetQ('상사');
  assert.ok(/1건 · 1곳/.test(c._els['#endedNEnd'].textContent));
  assert.strictEqual(c._els['#endedNDel'].textContent, '1곳', '삭제 쪽에서도 합친 곳 «가나상사(옛)» 하나만');
  assert.ok(/「상사」/.test(c._els['#endedQInfo'].textContent) && /종료 1건/.test(c._els['#endedQInfo'].textContent));
  assert.ok(/<mark>상사<\/mark>/.test(c._els['#endedList'].innerHTML), '찾은 글자 표시');
  assert.strictEqual(c._els['#endedQx'].style.display, 'block');
  c.endedClearQ();
  assert.strictEqual(c._els['#endedQx'].style.display, 'none');
  assert.ok(/3건 · 3곳/.test(c._els['#endedNEnd'].textContent), '지우면 되돌아온다');
});

test('★ 종료 뒤 수정 창 — 종료 모드를 그리고, 종료일만 고치기가 실제로 저장된다', async () => {
  const c = uiWorld();
  c.openEndEdit('c1', 't1');
  assert.ok(c._els['#endEditBody'].innerHTML.includes('종료일만 고치기') && c._els['#endEditBody'].innerHTML.includes('종료 취소'), '세 단계');
  assert.ok(/id="endEditDate"/.test(c._els['#endEditBody'].innerHTML), '날짜 입력');
  vm.runInContext("_endEdit.date='2026-10-18'", c);
  await c.saveEndEdit();
  assert.strictEqual(c._st.cos[0].endedTypes.t1, '2026-10-18');
  assert.ok(c._st.cos[0].endedLog.t1.length === 1, '기록이 남는다');
});

test('★ 수정 시작 → 수정 중 창 → 다시 종료(원래 종료일 그대로) 까지 한 바퀴', async () => {
  const c = uiWorld();
  c.openEndEdit('c1', 't1', 2);
  await c.saveEndEdit();
  assert.ok(!c._st.cos[0].endedTypes.t1 && c._st.cos[0].reopened.t1.was === '2026-10-24', '수정 시작: 종료는 비우고 원래 종료일 보관');
  c.openEndEdit('c1', 't1');
  assert.ok(/수정 중/.test(c._els['#endEditBody'].innerHTML) && /원래대로/.test(c._els['#endEditFoot'].innerHTML) && /다시 종료/.test(c._els['#endEditFoot'].innerHTML), '수정 중 모드');
  c.endEditPick('fin', 'pick');
  assert.ok(/id="endEditPickDate"/.test(c._els['#endEditBody'].innerHTML), '직접 고르기 날짜 칸');
  c.endEditPick('fin', 'keep');
  await c.saveEndEdit();
  assert.strictEqual(c._st.cos[0].endedTypes.t1, '2026-10-24', '원래 종료일로 다시 종료');
  assert.ok(!c._st.cos[0].reopened);
});

test('★ 원래대로 — 수정 중이던 사업이 원래 종료 상태로 돌아간다', async () => {
  const c = uiWorld();
  c.openEndEdit('c1', 't1', 2); await c.saveEndEdit();
  c.openEndEdit('c1', 't1'); await c.endedRevertFromModal();
  assert.strictEqual(c._st.cos[0].endedTypes.t1, '2026-10-24');
  assert.strictEqual(c._closed, 'mbEndEdit', '창을 닫는다');
});

test('종료가 아닌 사업의 수정 창은 열지 않는다 · 잠금을 못 잡으면 아무 것도 저장하지 않는다', async () => {
  const c = uiWorld();
  c.openEndEdit('c1', 'tZ');
  assert.ok(c._st.toasts.some((t) => /종료된 사업이 아닙니다/.test(t)));
  const d = uiWorld({ acquireCompanyEditLock: async () => false });
  const before = JSON.stringify(d._st.cos);
  const r = await d.endedCheck('c1', 't1', 'erp');
  assert.strictEqual(r, null);
  assert.strictEqual(JSON.stringify(d._st.cos), before, '잠금 실패 — 저장 금지');
});

test('★ 확인함 · 묶음 확인함 · 종료일 고치기(검토 탭)가 실제로 저장된다', async () => {
  const c = uiWorld();
  await c.endedCheck('c1', 't1', 'bulk');
  assert.deepStrictEqual(J(c._st.cos[0].endedChk), { t1: ['bulk'] });
  c.renderEndedView();
  c.endedCheckGroup('bulk');
  assert.ok(/모두 확인함/.test(c._confirm) && /건을/.test(c._confirm), '건수를 묻는다: ' + c._confirm);
  await c._cb();
  assert.strictEqual(c._st.cos.filter((x) => x.endedChk && x.endedChk.t1 && x.endedChk.t1.includes('bulk')).length, 3, '★ 묶음 «전체»가 넘어가야 한다(한 줄만 넘어가면 나머지가 다시 걸린다)');
  const d = uiWorld();
  d.endedFixOpen('c1', 't1'); assert.deepStrictEqual(J(d.S.endedFix), { coId: 'c1', tid: 't1' });
  d._els['#endedFixDate'] = { value: '2026-10-18' };
  await d.endedFixSave('c1', 't1');
  assert.strictEqual(d._st.cos[0].endedTypes.t1, '2026-10-18');
  assert.strictEqual(d.S.endedFix, null, '저장하면 입력 상태를 닫는다');
});

test('★ 일괄 처리 — 고른 줄만, 건수를 묻고, 한 번에 처리한다', async () => {
  const c = uiWorld();
  c._checks.push({ checked: true, dataset: { ek: 'c1|t1' } }, { checked: false, dataset: { ek: 'c2|t1' } }, { checked: true, dataset: { ek: 'c3|t1' } });
  assert.strictEqual(c.endedSelKeys().length, 2);
  c.endedSelChange();
  assert.ok(/2건 선택/.test(c._els['#endedBar'].innerHTML) && /재개/.test(c._els['#endedBar'].innerHTML));
  c.endedBatch('restore');
  assert.ok(/2건/.test(c._confirm), '건수를 먼저 묻는다');
  assert.ok(c._st.cos[0].endedTypes.t1 && c._st.cos[2].endedTypes.t1, '묻기만 했을 때는 아직 아무 것도 안 바뀐다');
  await c._cb();
  assert.ok(!c._st.cos[0].endedTypes.t1 && !c._st.cos[2].endedTypes.t1 && c._st.cos[1].endedTypes.t1, '고른 둘만 재개, 안 고른 하나는 그대로');
});

test('«합쳐진 곳 보기»는 진행 목록을 그 이름으로 찾아 준다', () => {
  const c = uiWorld();
  c.endedGoDash('가나상사');
  assert.strictEqual(c.S.dashSearch, '가나상사');
  assert.strictEqual(c._tab, 'main');
});
