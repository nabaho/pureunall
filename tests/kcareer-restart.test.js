'use strict';
/* 🔄 처음부터 다시 채우기 (대표 지시 2026-09-28 「넣었던 서식 지우고 새롭게 다시 넣고 싶다.
   다시 정보 채우기 할 수 있게 기능 만들었으면 좋겠다」)
   ─────────────────────────────────────────────────────────────
   ■ 대표 화면: 이어서 연 자리가 «처음 올린 원본»이 없는 옛 자리 → 다시 채우면 값이 겹친다.
   ■ 원본이 있으면 — 친 값·도장·사진·뺀 쪽을 비우고 «빈 서식»에서 다시 채운다(칸 짝은 남긴다).
   ■ 원본이 없으면 — 빈 서식 파일을 한 번 다시 고르게 하고 같은 작성 자리를 그 서식으로 갈아 끼운다.
   ⚠ 묻고 한다. «아니오»·파일 안 고름이면 아무것도 안 바꾼다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function 세상(opt) {
  const 기록 = { 올림: [], 채움: 0, 담음: 0, 알림: [], 모드: [] };
  const 원본 = { name: '신청서.hwpx', ext: 'hwpx', bytes: new Uint8Array([1, 2, 3]) };
  const ctx = {
    console, Object, String, Uint8Array, Promise,
    confirm: () => opt.예 !== false,
    toast: (m) => 기록.알림.push(String(m)),
    _safe: (f) => { try { return f(); } catch (e) { return null; } },
    rhUndoBtn: () => {}, rhSplitReset: () => {},
    rhDraftSave: () => { 기록.담음++; },
    rhSetMode: (m) => { 기록.모드.push(m); },
    rhAutoFillDoc: async () => { 기록.채움++; 기록.채울때바탕 = ctx._rhBase; 기록.채울때값 = ctx._rhVals; },
    mountEditor: async (buf, name) => {
      기록.올림.push({ name, 지킴: ctx._rhKeepBase, 문서가비었나: !ctx._rhDoc });
      /* 진짜처럼 — 바탕을 지키지 않으면 새 서식이 바탕이 된다 */
      if (!ctx._rhKeepBase && !ctx._rhDoc) { ctx._rhBase = { name, bytes: new Uint8Array(buf) }; ctx._rhDoc = { name, bytes: new Uint8Array(buf) }; }
    },
    _rhPickOne: async () => (opt.파일 === null ? null : { name: '빈 신청서.hwpx', arrayBuffer: async () => new Uint8Array([9, 9]).buffer }),
    _기록: 기록
  };
  vm.createContext(ctx);
  vm.runInContext('var _rhBase=null,_rhDoc=null,_rhVals={},_rhPicks={},_rhUndo=null,_rhKeepBase=false,'
    + '_rhFilled=false,_rhColMap=null,_rhStampOn=false,_rhStampDone=false,_rhPhotoOn=false,_rhPhotoDone=false,'
    + '_rhDropped=null,_rhPages=null,_rhTidy={drop:{},ph:false,italic:false,rows:false};', ctx);
  vm.runInContext(cutFn(CODE, 'function rhTidyReset('), ctx);
  vm.runInContext(cutFn(CODE, 'async function rhRestart('), ctx);
  if (opt.원본 !== false) ctx._rhBase = 원본;
  ctx._rhDoc = { name: '신청서_채움_날인.hwpx', ext: 'hwpx', bytes: new Uint8Array([7, 7, 7, 7]) };
  ctx._rhVals = { t0r0c1: '권형하' }; ctx._rhPicks = { t0r0c1: 'name' };
  ctx._rhFilled = true; ctx._rhStampOn = true; ctx._rhPhotoOn = true; ctx._rhTidy.drop = { S: [0] };
  ctx._원본 = 원본;
  return ctx;
}

test('★★★ 원본이 있으면 — 값·도장·사진·뺀 쪽을 비우고 «빈 서식»에서 멈춘다', async () => {
  const ctx = 세상({});
  await vm.runInContext('rhRestart()', ctx);
  const g = ctx._기록;
  assert.equal(g.채움, 0, '★★★ 지운 직후 자동으로 다시 채웠습니다 — 새 값을 입력할 틈이 없습니다');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhVals)), {}, '★★★ 친 값을 비우지 않아 겹쳐 적힙니다');
  assert.equal(ctx._rhDoc.bytes, ctx._원본.bytes, '★★ 보이는 문서를 빈 서식으로 안 돌렸습니다');
  assert.deepEqual([ctx._rhStampOn, ctx._rhPhotoOn], [false, false], '★★ 도장·사진 표시가 남았습니다');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhTidy.drop)), {}, '★★ 뺀 쪽 표시가 남았습니다');
  assert.equal(ctx._rhPicks.t0r0c1, 'name', '★ 사람이 고른 칸 짝까지 지웠습니다 — 짝은 값이 아닙니다');
  assert.equal(g.올림[0].지킴, true, '★★ 다시 올릴 때 바탕을 안 지켰습니다(원본이 채운 것으로 갈립니다)');
  assert.equal(ctx._rhKeepBase, false, '★ 바탕 지킴을 안 풀었습니다 — 다음 양식이 바탕을 못 잡습니다');
  assert.ok(g.담음 >= 1, '같은 작성 자리에 안 담았습니다');
  assert.deepEqual(g.모드, ['in'], '빈 입력판으로 돌아가지 않았습니다');
});

test('★★★ 원본이 «없는» 옛 자리 — 빈 서식 파일을 다시 골라 그 서식으로 갈아 끼우고 멈춘다', async () => {
  const ctx = 세상({ 원본: false });
  await vm.runInContext('rhRestart()', ctx);
  const g = ctx._기록;
  assert.equal(g.올림[0].name, '빈 신청서.hwpx', '★★★ 고른 빈 서식을 안 올렸습니다');
  assert.equal(g.올림[0].지킴, false, '★★ 새 서식을 바탕으로 안 잡았습니다');
  assert.equal(g.올림[0].문서가비었나, true, '★★ 채워진 옛 문서가 남아 새 서식이 바탕이 못 됩니다');
  assert.equal(ctx._rhBase.name, '빈 신청서.hwpx', '★★★ 바탕이 여전히 없습니다 — 또 겹쳐 적힙니다');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhVals)), {}, '★★ 옛 값이 남았습니다');
  assert.equal(g.채움, 0, '빈 서식을 고르자마자 자동으로 다시 채웠습니다');
  assert.deepEqual(g.모드, ['in']);
});

test('★★ 「아니오」·파일을 안 고르면 «아무것도» 안 바꾼다', async () => {
  for (const opt of [{ 예: false }, { 원본: false, 예: false }, { 원본: false, 파일: null }]) {
    const ctx = 세상(opt);
    await vm.runInContext('rhRestart()', ctx);
    assert.equal(ctx._기록.채움, 0, '★★ 묻고 «아니오»인데 채웠습니다: ' + JSON.stringify(opt));
    assert.equal(ctx._rhVals.t0r0c1, '권형하', '★★ 멈췄는데 친 값을 지웠습니다');
    assert.equal(ctx._rhStampOn, true, '★★ 멈췄는데 도장 표시를 놓았습니다');
    assert.equal(ctx._기록.올림.length, 0);
  }
});

test('★ 화면 — 지우기 단추가 기둥에 있고(한글 편집 중엔 감춤), 옛 자리 경고가 이 단추를 알려 준다', () => {
  assert.match(CODE, /<button class="btn rh-noed" onclick="rhRestart\(\)"[^>]*>🧹 입력 내용 모두 지우기<\/button>/, '★ 단추가 없습니다');
  assert.match(CODE, /처음 올린 원본»이 없습니다\(옛 자리\)'[\s\S]{0,300}「🧹 입력 내용 모두 지우기」/,
    '★ 옛 자리 경고가 고칠 길을 안 알려 줍니다(막다른 길)');
});
