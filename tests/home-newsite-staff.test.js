'use strict';
/* 새 사이트 «직원 상자» 그리기 — 대표 승인 2026-11-01 직원 소개 1단계
   ★ 여기서 못 박는 것
     ① 지금 쪽에서 직원을 읽어 «다시 그리면 똑같다» — 노무사 카드와 같은 약속.
     ② 직원을 빼거나 고쳐도 «직원 줄만» 바뀐다 — 노무사 카드·머리·발은 그대로.
     ③ 꺾쇠·$ 가 든 글자를 넣어도 태그·치환 문법이 되지 않는다.
     ④ 갈래 판정이 화면(memberKind)과 부품(PuSitePeople.갈래)에서 «같다».
   ★ 직원 수·직급은 쪽에서 읽어서 쓴다(지금 값을 박지 않는다). 이름은 지어낸 것. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
    { key: 'c', name: '박보기', position1: '과장', order: 1 },
    { key: 'd', kind: 'staff', name: ' ', position1: '대리', order: 2 },
    { key: 'e', kind: 'staff', name: '한보기', position1: '대리' }
  ]);
  assert.deepEqual(줄.map((x) => x.이름), ['박보기', '최가상', '한보기']);
});

test('★ 올릴사람(노무사 카드)은 직원을 «못 감»으로 세지 않는다', () => {
  const r = P.올릴사람(원본, [{ kind: 'staff', name: '김예시', position1: '사무장' }]);
  assert.equal(r.못갈것.length, 0, '★ 직원이 「글 번호 없음」으로 걸렸다');
});

/* 화면의 memberKind 를 떼어 와 같은 표로 견준다 */
function fnSource(name, s) {
  const re = new RegExp('(?:^|\\n)function\\s+' + name + '\\s*\\(');
  const m = re.exec(s);
  assert.ok(m, name + ' 를 찾지 못했습니다');
  let depth = 0;
  for (let i = s.indexOf('{', m.index); i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (!depth) return s.slice(m.index, i + 1); }
  }
  assert.fail(name + ' 끝을 찾지 못했습니다');
}
test('★ 갈래 판정이 화면(memberKind)과 부품(갈래)에서 같다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fnSource('memberKind', html), ctx);
  const 표 = [
    {}, { kind: 'labor' }, { kind: 'staff', position2: '공인노무사' }, { kind: 'x', position1: '대표노무사' },
    { position2: '공인노무사' }, { position1: '사무장' }, { position1: '과장', position2: '' }, null
  ];
  표.forEach((m) => assert.equal(P.갈래(m), ctx.memberKind(m), JSON.stringify(m) + ' 의 갈래가 둘에서 다르다'));
});
