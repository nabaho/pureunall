'use strict';
// 복합 HWP → 서식 단위 분할 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../tools/forms_lib.js');

test('isTitleLine: 자간 벌린 중앙 제목을 잡는다', () => {
  assert.ok(L.isTitleLine('위   임   약   정   서'));
  assert.ok(L.isTitleLine('위        임        장'));
});

test('isTitleLine: 자간이 없어도 서식 어미면 잡는다', () => {
  assert.ok(L.isTitleLine('진정 취하서 및 반의사불벌고지확인서'));
  assert.ok(L.isTitleLine('개인정보 제공 동의서'));
  assert.ok(L.isTitleLine('소액체당금 지급청구서'));
});

test('isTitleLine: 본문 문장은 제목이 아니다', () => {
  assert.ok(!L.isTitleLine('본인은 귀하에게 상기 사건의 처리에 관한 일체의 사항을 위임하고'));
  assert.ok(!L.isTitleLine('제2조【보수】'));
  assert.ok(!L.isTitleLine(''));
  assert.ok(!L.isTitleLine('가'));
});

test('splitSegments: 서식 3종이 3조각으로 갈린다', () => {
  const html = [
    '<p>위   임   약   정   서</p>',
    '<p>제1조 사건위임 본인은 일체를 위임한다</p>',
    '<p>위        임        장</p>',
    '<p>상기인을 대리인으로 선임합니다</p>',
    '<p>개인정보 제공 동의서</p>',
    '<p>수집목적에 동의합니다</p>',
  ].join('\n');
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 3);
  assert.strictEqual(segs[0].title, '위임약정서');
  assert.strictEqual(segs[1].title, '위임장');
  assert.strictEqual(segs[2].title, '개인정보제공동의서');
  assert.ok(segs[0].html.includes('제1조'));
  assert.ok(!segs[0].html.includes('상기인을'));
  assert.deepStrictEqual(segs.map(s => s.index), [0, 1, 2]);
});

test('splitSegments: 제목이 하나면 통째로 한 조각', () => {
  const html = '<p>합   의   서</p><p>갑과 을은 다음과 같이 합의한다</p>';
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].title, '합의서');
});

test('splitSegments: 제목 앞 머리말은 첫 조각에 붙는다', () => {
  const html = '<p>붙임1</p><p>위   임   장</p><p>본문</p>';
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].title, '위임장');
  assert.ok(segs[0].html.includes('붙임1'));
});

test('splitSegments: 제목 뒤 표는 새 조각을 만들지 않는다', () => {
  const html = '<p>위   임   장</p><table><tr><td>동의서</td><td>내용</td></tr></table>';
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 1);
});

test('splitSegments: 표 셀의 중첩 <p>는 경계를 만든다 (알려진 한계)', () => {
  const html = '<p>위   임   장</p><table><tr><td><p>동의서</p></td><td>내용</td></tr></table>';
  const segs = L.splitSegments(html);
  // 현재 구현은 <td> 안의 <p>도 경계로 삼는다. hwp2html.py 출력이 이런 구조를 만들지 않아 문제없다.
  assert.strictEqual(segs.length, 2);
});

// ── Finding D 회귀: 자간을 벌린 '기입란 라벨'이 서식 제목으로 둔갑하던 문제 ──
// 실측 70건에서 144종이 나왔고 상위 제목이 년월일·첨부서류·-소재지: 였다.

test('isTitleLine: 콜론으로 끝나는 기입란 라벨은 제목이 아니다', () => {
  assert.ok(!L.isTitleLine('주   소 :'));
  assert.ok(!L.isTitleLine('성   명 :'));
  assert.ok(!L.isTitleLine('- 소 재 지 :'));
  assert.ok(!L.isTitleLine('대 표 자 :'));
  assert.ok(!L.isTitleLine('：로 끝나는 라벨 :'));
});

test('isTitleLine: 콜론이 줄 안에 있는 라벨도 제목이 아니다', () => {
  assert.ok(!L.isTitleLine('- 성 명 : 대표 (☎ )'));
  assert.ok(!L.isTitleLine('제 목 : 임금 및 퇴직금 체불 해결'));
});

test('isTitleLine: 서식마다 되풀이되는 상용구는 제목이 아니다', () => {
  assert.ok(!L.isTitleLine('년   월   일'));
  assert.ok(!L.isTitleLine('20 년   월   일'));
  assert.ok(!L.isTitleLine('첨 부 서 류'));
  assert.ok(!L.isTitleLine('신 청 취 지'));
  assert.ok(!L.isTitleLine('신 청 이 유'));
  assert.ok(!L.isTitleLine('-- 다 음 --'));
  assert.ok(!L.isTitleLine('□ 위 임 자'));
  assert.ok(!L.isTitleLine('당 사 자 표 시'));
});

test('isTitleLine: 변환 잔재 문자가 낀 줄은 제목이 아니다', () => {
  // HWP 제어문자가 글자로 새어 나온 모양(금 <U+00C8><U+0100> 원 송 달 료)
  assert.ok(!L.isTitleLine('금 ÈĀ 원 송 달 료'));
  // 기호는 잔재가 아니다 — 진짜 제목에 붙어 있다
  assert.ok(L.isTitleLine('☑ (노동부로부터) 체불금품확인원'));
});

test('splitSegments: 라벨 줄이 섞여도 진짜 서식 2종만 갈린다', () => {
  const html = [
    '<p>위   임   약   정   서</p>',
    '<p>제1조 사건위임 본인은 일체를 위임한다</p>',
    '<p>주   소 :</p>',
    '<p>성   명 :</p>',
    '<p>년   월   일</p>',
    '<p>개인정보 제공 동의서</p>',
    '<p>수집목적에 동의합니다</p>',
  ].join('');
  const segs = L.splitSegments(html);
  assert.deepStrictEqual(segs.map(s => s.title), ['위임약정서', '개인정보제공동의서']);
  // 라벨 줄은 버리지 않고 앞 조각에 남긴다
  assert.ok(segs[0].html.includes('주   소'));
  assert.ok(segs[0].html.includes('년   월   일'));
});

test('splitSegments: 본문이 없는 자간 제목은 앞 조각에 되돌려 붙는다', () => {
  const html = [
    '<p>위   임   장</p>',
    '<p>본인은 아래 사건의 처리 일체를 수임인에게 위임합니다</p>',
    '<p>위 임 사 항</p>',        // 상용구 사전엔 없지만 아래 본문이 짧다
    '<p>임금 체불 진정</p>',
  ].join('');
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].title, '위임장');
  assert.ok(segs[0].html.includes('임금 체불 진정'));
});

test('splitSegments: 자간 제목이라도 본문이 실하면 서식으로 남는다', () => {
  const long = '<p>' + '위 사건에 관하여 아래와 같이 지급명령을 신청합니다. '.repeat(6) + '</p>';
  const segs = L.splitSegments('<p>위   임   장</p><p>본문</p><p>지 급 명 령 신 청</p>' + long);
  assert.strictEqual(segs.length, 2);
  assert.strictEqual(segs[1].title, '지급명령신청');
});

// ── 과분할 회귀: 장/절/관/편 표제와 순번 글머리가 서식 제목으로 둔갑하던 문제 ──
// 실측 6,848건에서 "제1장총칙"(484회)·"제1절통칙"(325회)·"②임금계산기간및지급일등"
// (123회) 등 장절·목록 표지가 제목줄로 잡혀, 취업규칙 한 건이 장절 수만큼
// 조각났다. 조문(제N조) 배제 규칙과 같은 자리에 장/절/관/편·순번 배제 규칙을 둔다.

test('isTitleLine: 장/절/관/편 머리는 제목이 아니다', () => {
  assert.ok(!L.isTitleLine('제 1 장 총 칙'));
  assert.ok(!L.isTitleLine('제 1 절  통 칙'));
  assert.ok(!L.isTitleLine('제3장  복무'));
  assert.ok(!L.isTitleLine('제 2 장  채 용'));
  assert.ok(!L.isTitleLine('제 1 관 통 칙'));
  assert.ok(!L.isTitleLine('제 1 편  총 칙'));
});

test('isTitleLine: 동그라미 숫자·아라비아 숫자 순번 글머리는 제목이 아니다', () => {
  assert.ok(!L.isTitleLine('② 임 금 계 산 기 간 및 지 급 일 등'));
  assert.ok(!L.isTitleLine('①  목   적'));
  assert.ok(!L.isTitleLine('1.  목   적'));
  assert.ok(!L.isTitleLine('1)  목   적'));
});

test('isTitleLine: 순번 글머리라도 서식 어미(TITLE_TAIL)가 있으면 제목이다', () => {
  // 한 문서에 여러 서식을 번호로 나열한 경우 — 서식 어미가 순번 배제를 이긴다.
  assert.ok(L.isTitleLine('1. 위임장'));
  assert.ok(L.isTitleLine('2) 확인서'));
});

test('isTitleLine: 별지·호서식 이름은 여전히 제목이다', () => {
  assert.ok(L.isTitleLine('제 3 호 서 식'));
  assert.ok(L.isTitleLine('별지 제3호의2서식 간이대지급금 지급청구서'));
});

test('splitSegments: 취업규칙 장절 제목은 세그먼트를 나누지 않는다', () => {
  const body = '이 규칙은 취업에 관한 사항을 정함을 목적으로 한다. '.repeat(6);
  const html = [
    '<p>취   업   규   칙</p>',
    '<p>제 1 장  총 칙</p>',
    '<p>제1조 목적 ' + body + '</p>',
    '<p>제 2 장  채 용</p>',
    '<p>제2조 채용 ' + body + '</p>',
  ].join('');
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].title, '취업규칙');
  assert.ok(segs[0].html.includes('제 2 장'));
});
