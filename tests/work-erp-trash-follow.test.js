'use strict';
// 업무관리가 푸른이알피 «휴지통»을 따라간다 — node --test tests/work-erp-trash-follow.test.js
//
// 2026-11-22 대표 보고: 「푸른이알피와 동기화가 제대로 안 됐다 — 상담인데 노동부 대리·의견서 제출로,
//   내부 컨설팅인데 현장클리닉으로 떠 있다」.
// 실측(읽기만): 살아 있는 계약은 값이 이알피와 전부 같았고, 틀려 보인 줄은 모두 이알피 «휴지통»에 든 계약이었다.
//   업무관리는 그 줄을 «진행중»에 둔 채 「원본 없음」 배지만 달았다.
//
// 이 검사가 지키는 것
//   ① 휴지통에 든 줄을 «따로 적는다» (peMaster 는 살아 있는 줄만 — 지워졌다/휴지통이다를 가르려고)
//   ② 이알피가 자동으로 만든 «빈» 업무만 취소로 닫는다 — 사람 기록·인수인계 노트·담당자 손댐이 있으면 안 닫는다
//   ③ 되돌릴 수 있게 닫는다 — 휴지통에서 되살아나면 도로 열고, 사람이 ↩ 재개한 건 다시 안 닫는다
//   ④ 이알피에는 안 민다(pe_nosync)
//   ⑤ 못 읽은 것을 「비었다」로 읽지 않는다
// 함수를 떠서 «실제로 돌린다» — 글자만 보는 검사는 초록인데 화면은 틀리는 일이 이 저장소의 되풀이된 실수다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');

function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = W.indexOf('{', i);
  for (; j < W.length; j++) { if (W[j] === '{') d++; else if (W[j] === '}' && --d === 0) { j++; break; } }
  return W.slice(i, j);
}
const END_TABLE = (() => {
  const i = W.indexOf('var END_WAYS=[');
  const j = W.indexOf('];', i) + 2;
  return W.slice(i, j) + '\nvar END_BY_KEY={}; END_WAYS.forEach(function(w){ END_BY_KEY[w[0]]=w; });';
})();

function box() {
  const ctx = { String, Array, Object, JSON };
  vm.createContext(ctx);
  vm.runInContext([
    grab('safeKey'), grab('peLinked'), grab('noteDone'), grab('_peArr'), grab('_peLive'),
    'var peTrash={};', 'function todayStr(){ return "2026-11-22"; }', END_TABLE,
    grab('_peTrashNote'), grab('peTrashPlan'),
  ].join('\n'), ctx);
  return ctx;
}
const NOW = '2026-11-22T08:00:00.000Z';
const TR = { at: '2026-11-16T13:35:00.000Z', by: '' };
/* 이알피가 자동으로 만든 빈 업무 */
const auto = (o) => Object.assign({ src: 'puerp', ref: { type: 'contract', id: 'c1' }, pe_auto: true }, o || {});

/* ══════════════ ① 휴지통을 따로 적는다 ══════════════ */
test('① _peTrashNote — 휴지통 줄만 적고 목록은 그대로 돌려준다', () => {
  const c = box();
  const arr = [{ id: 'a' }, { id: 'b', _deleted: true, deletedAt: TR.at }, { id: 'c.d', _deleted: true }];
  const out = c._peTrashNote('contract', arr);
  assert.equal(out, arr, '목록을 바꾸지 않는다 — 걸러내는 것은 _peLive 의 일');
  assert.deepEqual(Object.keys(c.peTrash.contract).sort(), ['b', 'c_d'], '열쇠는 safeKey 로 — 업무관리가 쓰는 열쇠와 같아야 맞춰진다');
  assert.equal(c.peTrash.contract.b.at, TR.at);
  assert.equal(c._peLive(out).length, 1, '살아 있는 줄 처리는 예전 그대로');
});

test('⑤ 읽기에 실패한 유형은 «휴지통이 비었다»로 적지 않는다', () => {
  const c = box();
  c._peTrashNote('case', [{ id: 'x', _deleted: true }]);
  assert.ok(c.peTrash.case.x);
  assert.equal(c._peTrashNote('case', null), null);
  assert.ok(c.peTrash.case && c.peTrash.case.x, '못 읽었다고 지난번 기록을 지우면 되살아난 것으로 읽혀 닫은 업무가 도로 열린다');
  assert.equal(c._peTrashNote('fund', undefined), undefined);
  assert.equal('fund' in c.peTrash, false);
});

test('① 서버로 읽는 길·캐시로 읽는 길 모두 휴지통을 적고 _peLive 를 지난다', () => {
  assert.match(W, /return \[d\[0\],_peLive\(_peTrashNote\(d\[0\],_peArr\(s\.val\(\)\)\)\)\];/);
  assert.match(W, /return \[d\[0\],_peLive\(_peTrashNote\(d\[0\],_ls\(PE_KEYS\[d\[0\]\]\)\)\)\];/);
});

/* ══════════════ ② 빈 자동 업무만 닫는다 ══════════════ */
test('② 휴지통에 든 «자동 생성 빈 업무»는 취소로 닫는다', () => {
  const c = box();
  const r = c.peTrashPlan(auto(), TR, false, NOW);
  assert.equal(r.kind, 'close');
  const p = r.patch;
  assert.equal(p.state, 'done');
  assert.equal(p.end_way, 'cancel', '「종료」가 아니라 「취소」 — 진행하지 않기로 한 것이다');
  assert.equal(p.status, '취소');
  assert.equal(p.done_date, '2026-11-16', '끝난 날은 휴지통에 보낸 날 — 오늘로 적으면 언제 끝났는지가 사라진다');
  assert.equal(p.state_at, NOW);
  assert.equal(p.pe_trash_closed, NOW, '되돌릴 때 «아무도 안 만졌나»를 가리는 표');
  assert.equal(p.pe_nosync, true, '④ 휴지통 계약에 종료를 써 넣지 않게');
});

test('② 사람이 쓴 기록(last)이 있으면 안 닫는다', () => {
  assert.equal(box().peTrashPlan(auto({ last: { d: '2026-11-10', t: '통화' } }), TR, false, NOW), null);
});
test('② 인수인계 노트가 적혀 있으면 안 닫는다', () => {
  assert.equal(box().peTrashPlan(auto({ ho_note: { sit: '진행 상황' } }), TR, false, NOW), null);
});
test('② 자동 생성이 아닌(사람이 가져온) 업무는 안 닫는다 — 🧹 치울 것 ③ 에서 사람이 정한다', () => {
  assert.equal(box().peTrashPlan(auto({ pe_auto: false }), TR, false, NOW), null);
  const it = auto(); delete it.pe_auto;
  assert.equal(box().peTrashPlan(it, TR, false, NOW), null);
});
test('② 지운 «뒤에» 사람이 손댄 업무는 안 닫는다', () => {
  assert.equal(box().peTrashPlan(auto({ state_at: '2026-11-20T00:00:00.000Z' }), TR, false, NOW), null);
  assert.equal(box().peTrashPlan(auto({ state_at: '2026-11-01T00:00:00.000Z' }), TR, false, NOW).kind, 'close',
    '지우기 «전»의 손댐은 막지 않는다');
});
test('② 이미 닫힌 업무·이알피와 연결 안 된 업무는 건드리지 않는다', () => {
  const c = box();
  assert.equal(c.peTrashPlan(auto({ state: 'done' }), TR, false, NOW), null);
  assert.equal(c.peTrashPlan({ src: 'excel', pe_auto: true }, TR, false, NOW), null);
  assert.equal(c.peTrashPlan(null, TR, false, NOW), null);
});
test('휴지통 시각이 비어 있으면 닫는 날은 오늘이다(지어내지 않는다)', () => {
  const r = box().peTrashPlan(auto(), { at: '' }, false, NOW);
  assert.equal(r.patch.done_date, '2026-11-22');
});

/* ══════════════ ③ 되돌릴 수 있다 ══════════════ */
test('③ 닫은 뒤 아무도 안 만졌고 휴지통에서 되살아나면 도로 연다', () => {
  const c = box();
  const closed = c.peTrashPlan(auto(), TR, false, NOW).patch;
  const it = auto(closed);                                     // 저장된 모습
  const r = c.peTrashPlan(it, null, true, '2026-11-23T01:00:00.000Z');
  assert.equal(r.kind, 'reopen');
  assert.equal(r.patch.state, null);
  assert.equal(r.patch.status, '진행중');
  assert.equal(r.patch.pe_nosync, null, '이알피와의 연결도 도로 켠다');
  assert.equal(r.patch.pe_trash_closed, null);
  assert.equal(r.patch.end_way, null, '자동으로 «취소»를 붙였던 것이므로 같이 걷는다');
});
test('③ 닫은 뒤 누가 손댔으면 표만 걷고 상태는 그대로 둔다', () => {
  const c = box();
  const it = auto(Object.assign({}, c.peTrashPlan(auto(), TR, false, NOW).patch, { state_at: '2026-11-22T09:00:00.000Z' }));
  const r = c.peTrashPlan(it, null, true, '2026-11-23T01:00:00.000Z');
  assert.equal(r.kind, 'reopen');
  assert.deepEqual(Object.keys(r.patch), ['pe_trash_closed'], '표 하나만 — 사람이 손댄 상태를 덮지 않는다');
});
test('③ 사람이 ↩ 재개한 업무는 휴지통에 그대로 있어도 다시 안 닫는다', () => {
  const c = box();
  const reopenedByHuman = auto({ pe_trash_closed: NOW, state: null, state_at: '2026-11-22T09:00:00.000Z' });
  assert.equal(c.peTrashPlan(reopenedByHuman, TR, false, NOW), null, '열 때마다 되닫히면 아무도 못 쓴다');
});
test('③ «한 번 닫은 표»만으로도 다시 안 닫는다 — 손댄 때(state_at)를 못 믿어도', () => {
  /* 위 시험은 state_at 이 지운 뒤라 «손댄 뒤 가드»가 먼저 막는다. 여기서는 그 가드를 비켜 표 자체만 본다. */
  const reopened = auto({ pe_trash_closed: NOW, state: null, state_at: '2026-11-01T00:00:00.000Z' });
  assert.equal(box().peTrashPlan(reopened, TR, false, NOW), null);
});
test('⑤ 원본이 살아 있는지 모르면(읽기 실패) 되열지 않는다', () => {
  const c = box();
  const it = auto(Object.assign({}, c.peTrashPlan(auto(), TR, false, NOW).patch));
  assert.equal(c.peTrashPlan(it, null, false, NOW), null, '휴지통에도 살아 있는 줄에도 없다 = 완전히 지워졌거나 못 읽음');
});
test('표가 없는 평범한 연동 업무는 아무 일도 안 일어난다', () => {
  assert.equal(box().peTrashPlan(auto(), null, true, NOW), null);
});

/* ══════════════ 연결 — peAutoSync 안에서 ══════════════ */
const AUTO = W.slice(W.indexOf('function peAutoSync('), W.indexOf('function puerpModal('));

test('peAutoSync 가 계획을 적용한다 — 위에서 이미 닫은 건은 그 방식을 덮지 않는다', () => {
  assert.match(AUTO, /if\(up\[P\+'state'\]!=='done'\)\{/);
  assert.match(AUTO, /peTrashPlan\(it,\(peTrash\[it\.ref\.type\]\|\|\{\}\)\[_tk\]\|\|null,/);
  assert.match(AUTO, /Object\.keys\(_tp\.patch\)\.forEach\(function\(f\)\{ up\[P\+f\]=_tp\.patch\[f\]; \}\);/);
});
test('「살아 있나」는 live 표로 — 읽어낸 유형만 본다', () => {
  assert.match(AUTO, /!!\(live\[it\.ref\.type\]&&live\[it\.ref\.type\]\[_tk\]\)/);
});
test('④ 몇 건이 왜 바뀌었는지 말해 준다 — 조용히 닫지 않는다', () => {
  assert.match(AUTO, /if\(trashClosed\) toast\(/);
  assert.match(AUTO, /if\(trashOpened\) toast\(/);
});
test('「휴지통」과 「지워짐」을 배지로 가른다 — pe_trash', () => {
  assert.match(AUTO, /var _inTr=gone&&!!\(peTrash\[it\.ref\.type\]&&peTrash\[it\.ref\.type\]\[safeKey\(it\.ref\.id\)\]\);/);
  assert.match(AUTO, /if\(_inTr&&!it\.pe_trash\) up\[P\+'pe_trash'\]=true;/);
  assert.match(AUTO, /if\(!_inTr&&it\.pe_trash\) up\[P\+'pe_trash'\]=null;/);
  const flag = grab('peFlag');
  assert.match(flag, /it\.pe_gone&&it\.pe_trash/);
  assert.match(flag, /원본 없음/, '완전히 지워진 것의 옛 표시는 그대로');
});
test('종료 화면에서 자동으로 닫은 이유가 보인다 (관리번호 칸 — 방식 칸은 좁아 한 줄이 깨진다)', () => {
  assert.match(W, /it\.pe_trash_closed&&endWay\(it\)==='cancel'\?' <span class="to" title="푸른이알피 휴지통/);
});

/* ══════════════ 이어 붙인 전체 흐름 — 대표 화면 그대로 ══════════════ */
test('★ 시나리오: 11건이 휴지통에 있고 3건은 사람이 맡았다 → 빈 자동 업무만 닫힌다', () => {
  const c = box();
  const rows = [
    auto({ ref: { type: 'contract', id: '1' } }),                                         // 자동 빈 업무 → 닫힘
    auto({ ref: { type: 'contract', id: '2' } }),                                         // 자동 빈 업무 → 닫힘
    auto({ ref: { type: 'contract', id: '3' }, pe_auto: false }),                          // 사람이 가져옴 → 그대로
    auto({ ref: { type: 'contract', id: '4' }, last: { d: '2026-11-01' } }),               // 사람 기록 있음 → 그대로
    auto({ ref: { type: 'contract', id: '5' }, ho_note: { todo: '서류 받기' } }),          // 노트 있음 → 그대로
  ];
  const res = rows.map((it) => c.peTrashPlan(it, TR, false, NOW));
  assert.deepEqual(res.map((r) => r && r.kind), ['close', 'close', null, null, null]);
});

/* ══════════════ 2026-11-22 외부 검토 반영 ══════════════ */
test('② 사람이 고친 적(up_at)이 있으면 안 닫는다 — patchItem 이 찍는 손댄 표', () => {
  assert.equal(box().peTrashPlan(auto({ up_at: '2026-11-10T00:00:00.000Z' }), TR, false, NOW), null);
});
test('② 다음 할 일(next)이 적혀 있으면 안 닫는다 — 글이든 날짜든', () => {
  const c = box();
  assert.equal(c.peTrashPlan(auto({ next: { text: '서류 받기' } }), TR, false, NOW), null);
  assert.equal(c.peTrashPlan(auto({ next: { date: '2026-12-01' } }), TR, false, NOW), null);
  assert.equal(c.peTrashPlan(auto({ next: {} }), TR, false, NOW).kind, 'close', '빈 껍데기는 손댄 것이 아니다');
});
test('② 같은 번호가 «살아 있는 줄»에도 있으면(중복 번호·낡은 사본) 닫지 않는다', () => {
  assert.equal(box().peTrashPlan(auto(), TR, true, NOW), null);
});
test('② 닫을 때 end_to·end_result 는 덮지 않는다 — 있다면 사람이 적은 것', () => {
  const p = box().peTrashPlan(auto(), TR, false, NOW).patch;
  assert.equal('end_to' in p, false);
  assert.equal('end_result' in p, false);
});
test('③ 사람이 ↩ 재개한 뒤 되살아나면 연동 제외 표(pe_nosync)를 걷는다 — 안 걷으면 영영 «연동 안 함»', () => {
  /* restoreItem 은 pe_nosync 가 있으면 확인 없이 열고 그 표를 그대로 둔다 — 우리가 건 표가 남는 길 */
  const it = auto({ pe_trash_closed: NOW, pe_nosync: true, state: null, state_at: '2026-11-23T00:00:00.000Z' });
  const r = box().peTrashPlan(it, null, true, '2026-11-24T00:00:00.000Z');
  assert.equal(r.kind, 'reopen');
  assert.deepEqual(Object.keys(r.patch).sort(), ['pe_nosync', 'pe_trash_closed'], '상태는 안 건드리고 표 둘만 걷는다');
  assert.equal(r.patch.pe_nosync, null);
});
test('③ 되살아난 원본이 이미 «종료» 상태면 열지 않고 연결만 도로 켠다 — 종료는 pesync 가 맞춘다', () => {
  const c = box();
  const closed = c.peTrashPlan(auto(), TR, false, NOW).patch;
  const r = c.peTrashPlan(auto(closed), null, true, '2026-11-24T00:00:00.000Z', true);
  assert.equal(r.kind, 'reopen');
  assert.equal('state' in r.patch, false, '끝난 원본을 보고 업무를 여는 것은 거짓이다');
  assert.equal(r.patch.pe_nosync, null);
  assert.equal(r.patch.pe_trash_closed, null);
});
test('③ 사람이 다시 닫아 둔 것(연동 제외 포함)은 표만 걷고 그 선택을 존중한다', () => {
  const it = auto({ pe_trash_closed: NOW, pe_nosync: true, state: 'done', state_at: '2026-11-23T00:00:00.000Z' });
  const r = box().peTrashPlan(it, null, true, '2026-11-24T00:00:00.000Z', false);
  assert.deepEqual(Object.keys(r.patch), ['pe_trash_closed']);
});

test('★ 자문(업체) 사본(coSrc)도 같은 길을 지난다 — 휴지통 업체가 «살아 있는 줄»로 읽히지 않게', () => {
  assert.match(W, /return Promise\.resolve\(\[d\[0\],_peLive\(_peTrashNote\(d\[0\],coSrc\)\)\]\);/);
  /* 실제로 돌려 본다: 사본은 그대로, 걸러진 목록·휴지통 표만 달라진다 */
  const c = box();
  const coSrc = [{ id: 'k1' }, { id: 'k2', _deleted: true, deletedAt: TR.at }];
  const live = c._peLive(c._peTrashNote('companies', coSrc));
  assert.equal(coSrc.length, 2, '업체 잇기용 사본을 건드리지 않는다');
  assert.equal(live.length, 1);
  assert.ok(c.peTrash.companies.k2);
});
test('peAutoSync 가 «원본이 이미 종료인가»를 계획에 넘긴다', () => {
  assert.match(AUTO, /_peClosed\(_rcT,it\.ref\.type\)/);
  assert.match(AUTO, /new Date\(\)\.toISOString\(\),!!\(_rcT&&_peClosed\(_rcT,it\.ref\.type\)\)\)/);
});
test('긴 안내는 오래 둔다 — toast 가 시간을 받고, 휴지통 안내 둘은 그것을 쓴다', () => {
  assert.match(grab('toast'), /function toast\(msg,type,ms\)/);
  assert.match(grab('toast'), /ms\|\|\(type==='err'\?3200:1600\)/, '안 주면 예전 그대로');
  assert.match(AUTO, /if\(trashClosed\) toast\('[^\n]*',undefined,\d+\);/);
  assert.match(AUTO, /if\(trashOpened\) toast\('[^\n]*',undefined,\d+\);/);
});
