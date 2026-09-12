'use strict';
/* 똑같은 서류는 «한 줄»로 접는다 (대표 지시 2026-09-12 「완전 동일서류는 중복 정리해라」)

   ■ 무엇이 있었나 — 운영 자료 그대로
     「사진첩에서 계약서 찾기」에 아이행복어린이집 자문계약서가 **세 줄** 있었다.
     세어 보니 서로 다른 셋이 아니었다:
       ① 2026-08-28 올린 1쪽짜리 — 이미 계약에 붙여 썼다
       ② 2026-09-11 다시 올린 같은 계약서의 1쪽
       ③ 그 계약서의 «2쪽»        ← 이것이 계약서로 한 줄을 통째로 차지했다

   ■ 규칙
     ⓐ 한 문서 묶음(doc.group)의 2쪽·3쪽은 1쪽에 접힌다.
     ⓑ 업체·문서명·계약일·기간·보수가 모두 같으면 같은 서류다 — 한 줄로 접는다.
     ⓒ 접기는 **두 번, 차례로**. 묶음부터 접지 않으면 ②③ 이 ① 과 못 만난다.
     ⓓ 대표는 「이미 쓴 것」 > 「앞쪽」 > 「최근 것」.
   ⚠ **지우지 않는다** — 스위치를 켜면 접힌 것이 그대로 다시 나온다.
   ⚠ 열쇠를 못 만들면 접지 않는다 — 억지로 묶으면 다른 서류가 조용히 사라진다. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

/* 접는 함수들을 «진짜 파일»에서 그대로 싣는다 — 베껴 적으면 견주는 뜻이 없다 */
const 접기 = (function () {
  const box = {};
  box.globalThis = box;
  vm.createContext(box);
  ['function erpPhotoDocKey(', 'function erpPhotoSameKey(', 'function erpPhotoHeadCmp(',
   'function erpPhotoFoldOnce(', 'function erpPhotoFold(']
    .forEach(function (d) { vm.runInContext(cutFn(ERP, d), box); });
  return box;
})();

/* ── 운영 자료 그대로의 세 장 (아이행복어린이집, 2026-09-12 읽음) ──
   ⚠ 사람 이름·주소는 뺐다. 접기가 보는 칸은 아래가 전부다. */
const 계약 = { company:'아이행복어린이집', docName:'자문계약서', signDate:'2026-08-28',
  startDate:'2026-09-01', endDate:'2027-08-31', fee:'월 200,000원' };
const 셋 = [
  { id:'A', at:Date.parse('2026-08-28T10:03:19Z'), fields:계약,
    doc:{ group:'g-0828', page:1, total:1 }, used:{ at:1787971390077, where:'푸른이알피 계약' } },
  /* ⚠ 2쪽이 1쪽보다 «3천분의 1초 늦다» — 운영 자료 그대로다(.438 / .441).
     그래서 「최근 것」만으로 대표를 고르면 **2쪽이 대표가 된다** — 쪽 차례가 먼저다. */
  { id:'B', at:Date.parse('2026-09-11T07:57:05.438Z'), fields:계약,
    doc:{ group:'g-0911', page:1, total:2 }, used:null },
  { id:'C', at:Date.parse('2026-09-11T07:57:05.441Z'), fields:계약,
    doc:{ group:'g-0911', page:2, total:2 }, used:null },
];

test('① ★★ 세 줄이 «한 줄»로 접힌다 — 대표님이 보신 그 화면이다', function () {
  const out = 접기.erpPhotoFold(셋);
  assert.equal(out.length, 1, '★★ 아직 ' + out.length + '줄입니다 — 겹친 것이 안 접혔습니다');
  assert.equal(out[0].folded.length, 2, '★ 접힌 장 수가 안 맞습니다');
});

test('② ★★ 문서 묶음부터 접는다 — 그 차례가 아니면 셋이 그대로 셋이다', function () {
  /* 묶음 접기를 «건너뛰면» 어떻게 되는지: 1쪽끼리만 남겨도 답은 같아야 한다 */
  const 쪽만 = 접기.erpPhotoFold([셋[1], 셋[2]]);
  assert.equal(쪽만.length, 1, '★★ 한 문서의 2쪽이 «다른 계약서»로 한 줄을 차지합니다');
  assert.equal(쪽만[0].id, 'B', '★ 2쪽이 대표가 됐습니다 — 앞쪽이 대표여야 합니다');
  assert.equal(쪽만[0].foldWhy, '쪽', '★ 접은 까닭이 «쪽»이 아닙니다');
});

test('③ ★★ 대표는 「이미 쓴 것」이 이긴다 — 계약의 근거가 목록에서 사라지면 안 된다', function () {
  const out = 접기.erpPhotoFold(셋);
  assert.equal(out[0].id, 'A', '★★ 이미 계약에 붙여 쓴 장이 접혀 버렸습니다');
  assert.equal(out[0].foldWhy, '벌', '★ 접은 까닭이 «벌»이 아닙니다');
  /* 차례를 바꿔 넣어도 답이 같아야 한다 — 들어온 순서가 대표를 정하면 안 된다 */
  assert.equal(접기.erpPhotoFold([셋[2], 셋[1], 셋[0]])[0].id, 'A',
    '★★ 목록에 들어온 «차례»가 대표를 바꿉니다');
});

test('④ ★ 이미 쓴 것이 없으면 «최근 것»이 대표다', function () {
  const 안쓴셋 = 셋.map(function (x) { return Object.assign({}, x, { used:null }); });
  const out = 접기.erpPhotoFold(안쓴셋);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'B', '★ 최근에 올린 1쪽이 대표여야 합니다');
});

test('⑤ ★★ «다른» 서류는 절대 안 접힌다', function () {
  const 다른회사 = { id:'D', at:1, fields:Object.assign({}, 계약, { company:'가나상사' }), doc:null, used:null };
  const 다른날 = { id:'E', at:2, fields:Object.assign({}, 계약, { signDate:'2025-08-28' }), doc:null, used:null };
  const 다른보수 = { id:'F', at:3, fields:Object.assign({}, 계약, { fee:'월 300,000원' }), doc:null, used:null };
  const out = 접기.erpPhotoFold(셋.concat([다른회사, 다른날, 다른보수]));
  assert.equal(out.length, 4, '★★ 서로 다른 계약서가 한 줄로 묶였습니다 — ' + out.length + '줄');
});

test('⑥ ★★ 열쇠를 못 만들면 «접지 않는다» — 빈 값끼리 묶이면 서류가 사라진다', function () {
  const 빈것 = [
    { id:'X', at:1, fields:{}, doc:null, used:null },
    { id:'Y', at:2, fields:{ company:'가나상사' }, doc:null, used:null },   /* 문서명 없음 */
    { id:'Z', at:3, fields:{ docName:'자문계약서' }, doc:null, used:null },  /* 업체명 없음 */
  ];
  assert.equal(접기.erpPhotoFold(빈것).length, 3,
    '★★ 판독이 비어 있는 서류끼리 한 줄로 묶였습니다 — 빈 값은 «같음»이 아닙니다');
  assert.equal(접기.erpPhotoSameKey({ fields:{} }), '', '★ 빈 판독에서 열쇠가 나옵니다');
});

test('⑦ ★ 띄어쓰기 차이는 «같은 서류»로 본다 — 판독이 늘 똑같이 떼어 쓰지 않는다', function () {
  const 띈것 = Object.assign({}, 셋[0], { id:'S', used:null, doc:null,
    fields:Object.assign({}, 계약, { company:'아이행복 어린이집', fee:'월200,000원' }) });
  assert.equal(접기.erpPhotoFold([셋[0], 띈것]).length, 1,
    '★ 띄어쓰기만 다른데 다른 서류로 봅니다');
});

test('⑧ ★★ 접기는 «맨 끝»이다 — 먼저 접으면 안 쓴 벌까지 함께 사라진다', function () {
  const fn = cutFn(stripComments(ERP), 'function erpPhotoPick(');
  const 쓴것거르기 = fn.indexOf('it.used && it.used.at');
  const 접기자리 = fn.indexOf('erpPhotoFold(');
  assert.ok(쓴것거르기 > 0 && 접기자리 > 0, '거르기·접기 자리를 못 찾았습니다');
  assert.ok(쓴것거르기 < 접기자리,
    '★★ 접은 뒤에 「이미 쓴 것」을 거릅니다 — 대표가 쓴 것이면 묶음이 통째로 사라집니다');
});

test('⑨ ★★ 목록은 «접기를 끌 수» 있다 — 지운 것이 아니라는 증거다', function () {
  const 창 = stripComments(ERP.slice(ERP.indexOf('function PhotoContractPickerModal('))).slice(0, 40000);
  /* ⚠ 글귀만 찾으면 안 된다 — 덧말(title)에도 같은 말이 있어 «헛도는 검사»가 된다.
     스위치가 «실제로 걸려 있는» 줄을 본다: 체크 상태와 누를 때의 동작 둘 다. */
  assert.match(창, /checked:\s*showDup/, '★★ 접기를 끄는 스위치가 걸려 있지 않습니다');
  assert.match(창, /setShowDup\(!showDup\)/, '★★ 스위치를 눌러도 아무 일이 없습니다');
  assert.match(창, /'겹친 것도 보기'/, '★ 스위치에 이름이 없습니다');
  /* 접힌 장이 몇 장인지도 적는다 — 「없다」와 「접었다」가 같아 보이면 안 된다 */
  assert.match(창, /장 접음/, '★ 몇 장을 접었는지 안 적습니다');
});

test('⑩ ★★ 지우는 코드가 «없다» — 접기는 보임만 바꾼다', function () {
  const fns = ['function erpPhotoFold(', 'function erpPhotoFoldOnce(',
    'function erpPhotoDocKey(', 'function erpPhotoSameKey('];
  fns.forEach(function (d) {
    const src = stripComments(cutFn(ERP, d));
    assert.ok(!/deletePhoto|\.remove\(|dbSet|= *null;? *\/\/ *지움/.test(src),
      '★★ ' + d + ' 이 사진을 지우려 합니다 — 접기는 보임만 바꿔야 합니다');
  });
});
