/* 📍 주소 검색은 «시·군 + 도로명 + 번호»로 미리 찾고, 다른 곳을 고르면 묻는다
   (대표 제보 2026-10-02 「기업정보함과 이알피에서 나오는 주소가 다르다」)
   ■ 실측: 사진 판독이 «있지 않은 구»로 틀린 주소를 통째로 넣으면 다음 주소검색이 다른 동네를
     맨 위에 올렸고, 누르자 그대로 들어갔다. 시 + 도로명 + 번호면 바른 한 곳만 나왔다.
   ★ 못 박는 것
     ① query 는 도·구·읍·동·괄호·층을 버리고 «시·군 + 도로명 + 번호»만 남긴다
     ② 「…로 123번길 16」처럼 떨어진 번길도 한 도로명으로 읽는다 · 지번만 있으면 판단하지 않는다
     ③ 이알피·기금 두 화면의 주소 검색이 이 잣대를 쓰고 · 도로명·번호가 다르면 바로 넣지 않는다
   ⚠ 주소는 모두 지어낸 것이다 — 저장소가 공개다(tests/no-real-client-data.test.js).
   node --test tests/addr-search-road.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require(path.join(__dirname, '..', 'js', 'pu-addr.js'));
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\r\n').join('\n');

test('★★★ ① 틀리기 쉬운 도·구·읍을 버리고 «시 + 도로명 + 번호»로 찾는다', () => {
  assert.equal(A.query('충청남도 가나시 서구 다라읍 마바1길 27'), '가나시 마바1길 27');
  assert.equal(A.query('서울특별시 강남구 사아로13길 31-1, 4층(역삼동, 자차빌딩)'), '서울특별시 사아로13길 31-1');
  assert.equal(A.query('31000 충남 가나군 다라면 마바로 7'), '가나군 마바로 7', '★ 앞의 우편번호를 검색어에 넣었다');
  assert.equal(A.query('가나시 다라동 14-13 3층'), '가나시 다라동 14-13', '★ 지번 주소는 예전처럼 층만 떼고 둔다');
});

test('★★★ ② 같은 곳인가 — 도로명+번호로 본다 · 지번만이면 «모름»', () => {
  assert.equal(A.same('충청남도 가나시 서구 마바1길 27', '충남 가나시 서북구 다라읍 마바1길 27 (사아리73-4번지)'), true,
    '★ 도·구 표기만 다른데 다른 곳이라 했다');
  assert.equal(A.same('충남 가나시 마바1길 27', '충남 가나시 동남구 자차1길 5'), false, '★★★ 다른 동네를 같다고 했다');
  assert.equal(A.same('충남 가나시 마바로 123번길 16-16', '충청남도 가나시 마바로123번길 16-16'), true, '★ 떨어진 번길을 못 읽었다');
  assert.equal(A.same('충남 가나시 마바로 123번길 16', '충남 가나시 마바로 123'), false);
  assert.equal(A.same('가나시 다라동 14-13', '가나시 마바로 7'), null, '★ 지번만 있는데 판단했다');
});

test('★★★ ③ 이알피·기금 주소 검색이 이 잣대를 쓰고, 다른 곳이면 바로 넣지 않는다', () => {
  for (const f of ['pu-erp.html', 'fund.html']) {
    const S = read(f);
    assert.match(S, /<script src="js\/pu-addr\.js\?v=\d+"><\/script>/, '★ ' + f + ' 가 js/pu-addr.js 를 안 싣는다');
    const fn = S.slice(S.indexOf('function openAddressSearch('), S.indexOf('function openAddressSearch(') + 6000);
    assert.match(fn, /PA\.query\(prefill\)/, '★ ' + f + ' 가 주소를 통째로 미리 찾는다');
    assert.match(fn, /PA\.key\(prefill\)/, '★ ' + f + ' 가 고른 주소를 적어 둔 것과 견주지 않는다');
    assert.match(fn, /openAddressSearch\(onComplete, ?prefill\)/, '★ ' + f + ' 「아니요」를 누르면 다시 고르게 해야 한다');
  }
});

test('★★★ ④ 있지 않은 구 이름을 잡는다 · 모르는 시는 판단하지 않는다', () => {
  assert.equal(A.badGu('충청남도 천안시 서구 다라읍 마바1길 27'), '천안시 서구');
  assert.equal(A.badGu('충남 천안시 서북구 다라읍 마바1길 27'), '', '★ 맞는 구를 틀렸다고 했다');
  assert.equal(A.badGu('경기도 수원시 영동구 사아로 3'), '수원시 영동구');
  assert.equal(A.badGu('가나시 서구 마바로 1'), '', '★ 모르는 시를 판단했다 — 틀린 경고보다 경고 없음이 낫다');
  assert.equal(A.badGu(''), '');
});
