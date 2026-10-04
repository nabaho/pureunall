'use strict';
/* ↩ 계약관리로 복귀 — «되살린다», 새로 만들지 않는다   (2026-10-04)

   ■ 무슨 일이 있었나
   「노사발전재단 이음센터」가 계약관리에도 기타사업에도 두 벌씩 있었다.
   까닭은 복귀 단추였다. 계약을 이관해도 원래 계약은 지워지지 않고
   status='transferred' 로 «살아 있다». 그런데 복귀는 그 사실을 모르고
   계약을 «새로» 만들었다 — 같은 번호가 두 벌이 되고, 돈도 두 번 잡힌다.
   겹친 쪽은 조용해서 아무도 모른다.

   업체관리는 2026-09-07 에 이미 이 길을 고쳤다(undoCompanyTransfer).
   그쪽 주석에 「returnToContract 를 그대로 쓰면 안 된다」고 적어 두고도
   정작 returnToContract 는 그대로 두었다 — 한쪽만 안전했다.

   ■ 이 검사가 지키는 것 — «규칙»이지 지금 값이 아니다
     ① 원래 계약이 살아 있으면 «그것을 되살린다» (새로 만들지 않는다)
     ② 원래 계약을 못 찾을 때«만» 새로 만든다 (그 길을 없애면 옛 것이 못 돌아온다)
     ③ 휴지통에 간 계약은 «살아 있다»로 보지 않는다
     ④ 번호가 없고 ID 만 있어도 찾는다 (옛 기록은 꼴이 제각각이다)
     ⑤ 모듈에서 고쳐진 금액·유형은 «덮지 않고 알린다» (말없이 옛 금액으로 돌리면 돈이 틀린다)
     ⑥ 되살릴 때 이관 자국(status·closedAt·transferredTo)을 푼다
     ⑦ 돌려보낸 모듈 항목을 «통째로 지우지 않는다» — 휴지통에 둔다
     ⑧ 확인 창이 「다시 생성」이라고 말하지 않는다 (사람이 그 말을 되살리기로 읽었다)
     ⑨ 목록이 삭제표시 줄을 거른다 (안 거르면 휴지통에 보낸 것이 그대로 보인다) */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const APP = path.join(__dirname, '..', 'pu-erp.html');
const src = fs.readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');

/* 함수를 소스에서 그대로 떼어 «실제로 돌린다» — 글자만 보면 고장 난 채로 통과한다 */
function planCtx() {
  const ctx = { console: console, briefTrim: function (s) { return String(s || '').trim(); } };
  vm.createContext(ctx);
  ['function ctReturnPlan(', 'function ctReturnDiffs('].forEach(function (d) {
    vm.runInContext(cutFn(src, d), ctx);
  });
  return ctx;
}
function plan(item, contracts, kindV) {
  return vm.runInContext('ctReturnPlan(' + JSON.stringify(item) + ','
    + JSON.stringify(contracts || []) + ',' + JSON.stringify(kindV || 'other') + ')', planCtx());
}

/* 이관된 기타사업 한 건과, 이관 뒤 살아 있는 원래 계약.
   ⚠ 실제 이름을 쓰지 않는다 — 가나상사로 적는다. */
const ITEM = {
  id: 'op-1', no: '기타-2026-001', companyName: '가나상사', bizNo: '123-45-67890',
  typeCode: '기타', contractFee: 3000000, brief: '컨설팅 수행',
  sourceContractNo: '계약-2026-007', sourceContractId: 'ct-1',
  sourceKind: 'contract', sourceId: 'ct-1'
};
const LIVE = [{
  id: 'ct-1', contractNo: '계약-2026-007', status: 'transferred',
  closedAt: '2026-03-02T00:00:00.000Z', closedReason: '이관완료', transferredTo: 'other:기타-2026-001',
  companyName: '가나상사', kinds: ['other'],
  typeCodes: { other: '기타' }, amounts: { other: 3000000 }, briefs: { other: '컨설팅 수행' }
}];

// ══════════════════════════════════════════════════════════════════
test('① ★ 원래 계약이 살아 있으면 되살린다 — 새로 만들면 같은 번호가 두 벌이 된다', function () {
  const p = plan(ITEM, LIVE);
  assert.equal(p.mode, 'restore', '★ 또 새로 만들고 있습니다 — 계약이 두 벌이 됩니다');
  assert.ok(p.contract && p.contract.id === 'ct-1', '★ 원래 계약을 집어야 합니다');
  assert.equal(p.contractNo, '계약-2026-007');
});

test('② 원래 계약을 못 찾으면 새로 만든다 — 그 길이 없으면 옛 기록이 영영 못 돌아온다', function () {
  const p = plan(ITEM, []);
  assert.equal(p.mode, 'create', '★ 원본이 없는데 되살리려 합니다 — 복귀가 아예 막힙니다');
  assert.equal(p.contract, null);
  assert.equal(p.contractNo, '계약-2026-007', '번호는 모듈에 적힌 것을 쓴다');
  assert.equal(plan({ id: 'x' }, LIVE).mode, 'create', '출처가 없는 항목도 막히면 안 됩니다');
});

test('③ ★ 휴지통에 간 계약은 살아 있다고 보지 않는다', function () {
  const trashed = [Object.assign({}, LIVE[0], { _deleted: true })];
  assert.equal(plan(ITEM, trashed).mode, 'create', '★ 지워진 계약을 되살리고 있습니다');
});

test('④ 번호 없이 ID 만 있어도 찾는다 — 옛 기록은 꼴이 제각각이다', function () {
  const onlyId = { id: 'op-2', sourceKind: 'contract', sourceId: 'ct-1' };
  const p = plan(onlyId, LIVE);
  assert.equal(p.mode, 'restore', '★ sourceId 로도 찾아야 합니다');
  assert.equal(p.contractNo, '계약-2026-007', '번호는 찾은 계약에서 채운다');
  const onlyNo = { id: 'op-3', sourceContractNo: '계약-2026-007' };
  assert.equal(plan(onlyNo, LIVE).mode, 'restore', '★ 번호만 있어도 찾아야 합니다');
  assert.equal(plan({ id: 'c', sourceKind: 'photo', sourceId: 'ct-1' }, LIVE).mode, 'create',
    '★ 사진·명함에서 온 것까지 계약으로 읽으면 안 됩니다');
});

// ══════════════════════════════════════════════════════════════════
test('⑤ ★ 모듈에서 고쳐진 금액은 «덮지 않고 알린다» — 말없이 옛 금액으로 돌리면 돈이 틀린다', function () {
  const edited = Object.assign({}, ITEM, { contractFee: 5000000 });
  const d = plan(edited, LIVE).diffs;
  const money = d.filter(function (x) { return x.k === '금액'; });
  assert.equal(money.length, 1, '★ 금액이 달라졌는데 사람에게 말하지 않습니다');
  assert.equal(money[0].was, 3000000, '계약에 적혀 있던 옛 값');
  assert.equal(money[0].now, 5000000, '모듈에서 고쳐진 지금 값');
});

test('⑤-1 안 고쳐졌으면 아무 말도 안 한다 — 매번 뜨는 경고는 눈에서 지워진다', function () {
  assert.equal(plan(ITEM, LIVE).diffs.length, 0, '★ 같은 값인데 경고를 띄웁니다');
});

test('⑤-2 유형·요약이 달라져도 알린다', function () {
  const d = plan(Object.assign({}, ITEM, { typeCode: '자문', brief: '다른 일' }), LIVE).diffs;
  const kinds = d.map(function (x) { return x.k; });
  assert.ok(kinds.indexOf('유형') >= 0, '★ 유형이 달라진 것을 안 알립니다');
  assert.ok(kinds.indexOf('요약') >= 0, '★ 요약이 달라진 것을 안 알립니다');
});

test('⑤-3 빈 값에도 안 터진다 — 옛 기록에는 없는 칸이 많다', function () {
  const ctx = planCtx();
  assert.equal(vm.runInContext('ctReturnDiffs(null, null, null).length', ctx), 0);
  assert.equal(vm.runInContext("ctReturnDiffs({}, {}, 'other').length", ctx), 0,
    '빈 항목과 빈 계약 사이에는 견줄 것이 없습니다');
});

// ══════════════════════════════════════════════════════════════════
const RET = stripJs(cutFn(src, 'async function returnToContract('));
const RESTORE = RET.slice(RET.indexOf("plan.mode === 'restore'", RET.indexOf('okConfirm')));

test('⑥ ★ 되살릴 때 이관 자국을 푼다 — 안 풀면 칸반에 안 뜬다', function () {
  assert.match(RESTORE, /status:'signed'/, '★ 상태를 안 풀면 종료관리에 남습니다');
  assert.match(RESTORE, /closedAt:null/, '★ 종료 시각이 남습니다');
  assert.match(RESTORE, /closedReason:null/, '★ 종료 사유가 남습니다');
  assert.match(RESTORE, /transferredTo:null/, '★ 이관처가 남아 「이관완료」로 읽힙니다');
});

test('⑦ ★ 돌려보낸 모듈 항목은 휴지통에 사본을 남긴다 — 잘못 눌러도 되살릴 수 있어야 한다', function () {
  assert.ok(!/dbRemove\(storeKey/.test(RET),
    '★ 복귀가 휴지통을 거치지 않고 바로 지우고 있습니다');
  assert.ok(RET.indexOf('ctReturnPark(') >= 0, '★ 복귀가 휴지통 길을 안 탑니다');
  const park = stripJs(cutFn(src, 'function ctReturnPark('));
  assert.ok(!/'trash_bin'/.test(park),
    "★ 휴지통 이름을 글자로 박았습니다 — 일반 휴지통은 재직 직원 누구나 읽습니다");
  assert.match(park, /trashKeyFor\(storeKey\)/, '★ 돈이 든 표를 재무 전용 휴지통으로 안 보냅니다');
  /* 담아 두지 못하면 지우지도 않는가 — 돌려서 본다 */
  const ctx = { gone: null, saved: null,
    dbGet: function (k) { return k === 'other_projects' ? [{ id: 'op-1', no: '기타-2026-001' }] : []; },
    trashKeyFor: function () { return 'trash_bin'; },
    dbSet: function (k, v) { ctx.saved = v; return ctx.canSave; },
    dbRemove: function (k, id) { ctx.gone = id; return true; },
    canSave: false };
  vm.createContext(ctx);
  vm.runInContext(cutFn(src, 'function ctReturnPark(')
    + '; var r1 = ctReturnPark("other_projects","op-1","계약-2026-007");', ctx);
  assert.equal(ctx.gone, null, '★ 휴지통에 못 담았는데 지웠습니다 — 자료가 사라집니다');
  ctx.canSave = true;
  vm.runInContext('var r2 = ctReturnPark("other_projects","op-1","계약-2026-007");', ctx);
  assert.equal(ctx.gone, 'op-1', '담은 뒤에는 표에서 뺀다');
  assert.equal(ctx.saved.length, 1, '★ 휴지통에 사본이 안 들어갔습니다');
  assert.equal(ctx.saved[0].item.id, 'op-1', '★ 사본이 통째로 들어가야 되살릴 수 있습니다');
  assert.equal(vm.runInContext('ctReturnPark("other_projects","없는번호","")', ctx), false,
    '★ 없는 항목에도 참을 돌려주면 계약만 되살아나고 모듈에는 그대로 남습니다');
});

test('⑧ ★ 되살릴 때 확인 창이 「새로 만든다」고 말하지 않는다', function () {
  const msg = RET.slice(RET.indexOf('popConfirm('), RET.indexOf('if(!okConfirm)'));
  const restoreMsg = msg.slice(0, msg.indexOf('⚠ 원래 계약'));
  assert.ok(!/다시 생성/.test(restoreMsg), '★ 「다시 생성」은 사람이 되살리기로 읽습니다');
  assert.match(restoreMsg, /새로 만들지 않습니다/, '★ 무엇이 일어나는지 적어야 합니다');
  assert.match(restoreMsg, /휴지통/, '★ 모듈 항목이 어디로 가는지 적어야 합니다');
  assert.match(msg, /찾지 못했습니다/, '★ 새로 만드는 갈래에서는 왜 그런지 적어야 합니다');
});

test('⑨ ★ 목록이 삭제표시 줄을 거른다 — 안 거르면 휴지통에 보낸 것이 그대로 보인다', function () {
  const ref = stripJs(cutFn(src, 'function refreshItems('));
  assert.match(ref, /_deleted/, '★ 삭제표시 줄이 컨설팅·기금·기타사업 목록에 그대로 남습니다');
  /* 거른 결과를 쓰는지 «돌려» 본다 — 글자만 있고 안 쓰면 소용없다 */
  const ctx = { dbGet: function () { return [{ id: 'a' }, { id: 'b', _deleted: true }]; },
                arvSort: function (a, b, f) { return f(a, b); }, out: null,
                setItems: function (v) { ctx.out = v; }, props: { storageKey: 'other_projects' } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(src, 'function refreshItems(') + '; refreshItems();', ctx);
  assert.equal(ctx.out.length, 1, '★ 삭제표시 줄이 목록에 올라갑니다');
  assert.equal(ctx.out[0].id, 'a');
});
