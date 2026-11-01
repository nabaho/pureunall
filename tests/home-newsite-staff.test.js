'use strict';
/* 새 사이트 «직원 상자» 그리기 — 대표 승인 2026-11-01 직원 소개 1단계
   ★ 여기서 못 박는 것
     ① 지금 쪽에서 직원을 읽어 «다시 그리면 똑같다» — 노무사 카드와 같은 약속.
     ② 직원을 빼거나 고쳐도 «직원 줄만» 바뀐다 — 노무사 카드·머리·발은 그대로.
     ③ 꺾쇠·$ 가 든 글자를 넣어도 태그·치환 문법이 되지 않는다.
     ④ 상자로 가는 사람은 구분을 «직원»으로 저장한 사람뿐이다 — 직책이 빈 옛 노무사 글을 직원으로 짐작하지 않는다.
   ★ 직원 수·직급은 쪽에서 읽어서 쓴다(지금 값을 박지 않는다). 이름은 지어낸 것. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require(path.join(__dirname, '..', 'js', 'pu-site-people.js'));
const P = globalThis.PuSitePeople;
const 원본 = fs.readFileSync(path.join(__dirname, '..', 'site', 'people', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const 직원 = P.직원읽기(원본);

test('검사 준비 — 본 쪽에 직원이 둘 이상 있다', () => {
  assert.ok(직원.length >= 2, '읽은 직원이 ' + 직원.length + '명뿐이다');
  assert.ok(직원.every((s) => s.이름 && s.직급), '이름이나 직급이 빈 직원이 있다 — 읽기가 틀렸다');
});

test('★ 지금 쪽에서 직원을 읽어 «다시 그리면 똑같다»', () => {
  assert.equal(P.직원그리기(원본, 직원), 원본, '★ 다시 그린 직원 줄이 지금 쪽과 다르다');
});

test('★ 직원을 빼고 고쳐도 «직원 줄만» 바뀐다', () => {
  const 새 = P.직원그리기(원본, [{ 이름: '김예시', 직급: '새직급' }]);
  assert.deepEqual(P.직원읽기(새), [{ 이름: '김예시', 직급: '새직급' }]);
  assert.equal(P.사람읽기(새).length, P.사람읽기(원본).length, '★ 노무사 카드 수가 바뀌었다');
  /* 앞뒤 글자가 그대로인지 — 첫 직원 칸 앞과 마지막 칸 뒤를 견준다(감싼 칸 여는 태그만큼 물러서서) */
  const 앞 = 원본.indexOf('<div class="people_box">');
  assert.equal(새.slice(0, 앞 - 80), 원본.slice(0, 앞 - 80), '★ 직원 줄 앞이 바뀌었다');
  const 뒤 = 원본.length - 원본.lastIndexOf('<div class="people_box">');
  assert.equal(새.slice(-(뒤 - 200)), 원본.slice(-(뒤 - 200)), '★ 직원 줄 뒤가 바뀌었다');
});

test('★ 꺾쇠·$ 가 든 글자는 글자로 들어간다', () => {
  const 새 = P.직원그리기(원본, [{ 이름: '<b>이샘플</b>', 직급: '$1 & $&' }]);
  assert.ok(새.indexOf('<b>이샘플</b>') < 0, '★ 꺾쇠가 태그로 들어갔다');
  assert.deepEqual(P.직원읽기(새), [{ 이름: '<b>이샘플</b>', 직급: '$1 & $&' }]);
});

test('빈 목록·직원 칸 없는 쪽은 그리지 않는다(던진다)', () => {
  assert.throws(() => P.직원그리기(원본, []), /한 명도/);
  assert.throws(() => P.직원그리기('<div>없음</div>', [{ 이름: '박보기', 직급: '과장' }]), /직원 칸/);
});

test('★ 올릴직원 — 직원만, 차례대로, 이름 빈 줄은 뺀다', () => {
  const 줄 = P.올릴직원([
    { key: 'a', kind: 'staff', name: '최가상', position1: '주임', order: 3 },
    { key: 'b', kind: 'labor', name: '정모형', position2: '공인노무사' },
    { key: 'c', kind: 'staff', name: '박보기', position1: '과장', order: 1 },
    { key: 'f', name: '서샘플', position1: '과장', order: 0 },
    { key: 'd', kind: 'staff', name: ' ', position1: '대리', order: 2 },
    { key: 'e', kind: 'staff', name: '한보기', position1: '대리' }
  ]);
  assert.deepEqual(줄.map((x) => x.이름), ['박보기', '최가상', '한보기']);
});

test('★ 올릴사람(노무사 카드)은 직원을 «못 감»으로 세지 않는다', () => {
  const r = P.올릴사람(원본, [{ kind: 'staff', name: '김예시', position1: '사무장' }]);
  assert.equal(r.못갈것.length, 0, '★ 직원이 「글 번호 없음」으로 걸렸다');
});

test('★ 직원인가 — 구분을 «직원»으로 저장한 사람만. 직책에서 짐작하지 않는다', () => {
  assert.equal(P.직원인가({ kind: 'staff' }), true);
  assert.equal(P.직원인가({ kind: 'labor' }), false);
  assert.equal(P.직원인가({ position1: '사무장' }), false, '★ 구분 없는 옛 글을 직원으로 짐작했다 — 노무사 카드에서 빠진다');
  assert.equal(P.직원인가({}), false);
  assert.equal(P.직원인가(null), false);
});

test('★ 화면도 같은 잣대로 노무사 목록에서 직원을 뺀다 — 짐작(memberKind)으로 빼지 않는다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8')
    .replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const i = html.indexOf('function memberRows(');
  assert.ok(i >= 0, 'memberRows 를 찾지 못했다');
  const 몸 = html.slice(i, html.indexOf('\n}', i));
  assert.match(몸, /PuSitePeople\.직원인가\(/, '★ 노무사 목록이 직원을 무엇으로 가르는지가 부품과 다르다');
  assert.doesNotMatch(몸, /memberKind\([^)]*\)\s*[!=]==\s*'staff'/);
});
