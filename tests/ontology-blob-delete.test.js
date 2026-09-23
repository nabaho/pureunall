'use strict';
/* 사진·썸네일을 지우는 것은 «삭제 표식» 자리가 아니다 (2026-09-21)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 무엇이 있었나
     대표님이 명함 사진 421장을 창고로 옮기는 동안, 한 장 지울 때마다
     「물리적 삭제 대신 삭제 표식을 저장해야 합니다」가 떴다 — **421번.**
     그 잔소리가 **진짜 오류(창고 403·CORS)를 덮어** 콘솔을 보고도 못 찾으셨다.

   ■ 왜 잔소리인가 (고장이 아니라 «자리를 잘못 본 것»이다)
     ① 거기 사는 것은 레코드가 아니라 **글자 하나**(base64)다 — `_deleted` 를 붙일 데가 없다.
     ② 표식을 남기면 **비우려던 자리가 그대로 남는다.** 사진을 옮기는 까닭이 그 자리를
        비우는 것인데, 한 장마다 표식이 다시 들어앉는다.
     ③ 그 자리를 읽는 화면은 «글자»를 기대한다 — 표식(객체)이 들어가면 사진이 깨져 보인다.

   ■ 여기서 못 박는 것
     ① 덩어리 자리(사진·썸네일)를 지울 때는 «아무 말도 안 한다»
     ② 업무 자료를 지울 때는 **여전히 말한다** — 이 문이 느슨해지면 안 된다
     ③ 덩어리 «위» 자리(pucards 통째)는 봐주지 않는다
     ④ 개인 폴더 사진도 같은 자리다

   실행: node --test tests/ontology-blob-delete.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/pu-ontology-write.js');

function 지우기(path) { return W.inspectWrite({ kind: 'remove', path: path, mode: 'observe' }); }
function 말했나(r) {
  return (r.issues || []).some(function (x) { return x.code === 'physical_delete'; });
}

/* ══════ ① 덩어리 자리 — 조용히 지나간다 ══════ */

test('★★★ 명함 사진을 지울 때는 «아무 말도 안 한다» — 421번 떠서 진짜 오류를 덮었다', () => {
  assert.equal(말했나(지우기('pucards/photos/-Ozi123abc')), false,
    '★ 사진 한 장 지울 때마다 잔소리가 뜹니다. 421장이면 421번입니다 — ' +
    '그 사이에 낀 진짜 오류를 대표님이 못 보십니다.');
});

test('★★ 썸네일·개인 폴더 사진도 같은 자리다', () => {
  ['pucards/thumbs/-Ozi123abc',
    'pucards_private/uid-1/photos/-Ozi123abc',
    'pucards_private/uid-1/thumbs/-Ozi123abc',
    'puphotos/u/uid-1/blobs/2026/-Ozi1',
    'puphotos/u/uid-1/thumbs/2026/-Ozi1'
  ].forEach(function (p) {
    assert.equal(말했나(지우기(p)), false, '「' + p + '」 에서 잔소리가 뜹니다.');
  });
});

/* ══════ ② 업무 자료는 «여전히» 말한다 — 이 문이 느슨해지면 안 된다 ══════ */

test('★★★ 업무 자료를 지우면 여전히 말한다 — 봐주는 자리를 넓히지 않았다', () => {
  ['data/companies/co-1',
    'data/contracts/ct-1',
    'data/cases/cs-1',
    'pucards/coInfo/1234567890',
    'pucards/items/-Ozi1',
    'pucards/workerInfo/가나상사__홍길동'
  ].forEach(function (p) {
    assert.equal(말했나(지우기(p)), true,
      '★ 「' + p + '」 를 그냥 지우는데 아무도 말하지 않습니다 — 되돌릴 길이 사라집니다.');
  });
});

test('★★ 덩어리 «위» 자리를 통째로 지우는 것은 봐주지 않는다', () => {
  ['pucards', 'pucards_private/uid-1', 'puphotos/u/uid-1'].forEach(function (p) {
    assert.equal(말했나(지우기(p)), true,
      '★ 「' + p + '」 를 통째로 지우는데 아무도 말하지 않습니다.');
  });
});

/* ══════ ③ 자리 이름이 비슷한 남의 자리에 새지 않는다 ══════ */

test('★★ 이름이 비슷한 다른 자리에는 «안 번진다» — 셋 다 봐주지 않는다', () => {
  /* 자리 이름이 「사진 같아 보인다」고 봐주면, 앞에 아무 글자나 붙여
     이 문을 지나갈 수 있게 된다. 자리는 «토막 단위»로 맞아야 한다. */
  ['data/photos_backup/x', 'pucardsphotos/x', 'mypucards/photos/x'].forEach(function (p) {
    assert.equal(말했나(지우기(p)), true,
      '★ 「' + p + '」 를 덩어리 자리로 봤습니다 — 이름만 비슷한 남의 자리입니다.');
  });
});

/* ══════ ④ null 로 지우는 길도 같다 ══════ */

test('★ set(null) 로 지워도 같은 판단이다 — 길이 둘이면 한쪽만 고쳐진다', () => {
  assert.equal(말했나(W.inspectWrite({ kind: 'set', path: 'pucards/photos/-Ozi1', value: null, mode: 'observe' })), false,
    'remove 는 봐주는데 set(null) 은 안 봐줍니다 — 같은 일입니다.');
  assert.equal(말했나(W.inspectWrite({ kind: 'set', path: 'data/companies/co-1', value: null, mode: 'observe' })), true,
    '업무 자료를 null 로 지우는데 아무도 말하지 않습니다.');
});
