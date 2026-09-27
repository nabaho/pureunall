'use strict';
// 변수 추출·플래그 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../tools/forms_lib.js');

test('extractVars: {{변수}}를 그대로 수집', () => {
  const v = L.extractVars('<p>{{이름}} {{주민등록번호}}</p>');
  assert.deepStrictEqual(v.map(x => x.key).sort(), ['이름', '주민등록번호']);
});

test('extractVars: 빈 기입란 라벨을 변수로 승격', () => {
  const v = L.extractVars('<p>성 명 : ______</p><p>주    소 :        </p>');
  const keys = v.map(x => x.key);
  assert.ok(keys.includes('이름'));
  assert.ok(keys.includes('주소'));
});

test('extractVars: 중복 제거', () => {
  const v = L.extractVars('<p>{{이름}}</p><p>성명 : ____</p><p>{{이름}}</p>');
  assert.strictEqual(v.filter(x => x.key === '이름').length, 1);
});

test('extractVars: 주민등록번호는 required, 가족연락처는 아님', () => {
  const v = L.extractVars('<p>{{주민등록번호}} {{가족연락처}}</p>');
  assert.strictEqual(v.find(x => x.key === '주민등록번호').required, true);
  assert.strictEqual(v.find(x => x.key === '가족연락처').required, false);
});

test('extractVars: type이 붙는다', () => {
  const v = L.extractVars('<p>{{작성일}} {{착수금}} {{이름}}</p>');
  assert.strictEqual(v.find(x => x.key === '작성일').type, 'date');
  assert.strictEqual(v.find(x => x.key === '착수금').type, 'money');
  assert.strictEqual(v.find(x => x.key === '이름').type, 'text');
});

test('flagIssues: 구법 용어를 잡는다', () => {
  assert.ok(L.flagIssues('<p>소액체당금 지급청구서</p>').includes('구법용어'));
  assert.ok(L.flagIssues('<p>일반체당금</p>').includes('구법용어'));
  assert.ok(!L.flagIssues('<p>간이대지급금 지급청구서</p>').includes('구법용어'));
});

test('flagIssues: 노무사회 회원가입용 동의서를 잡는다', () => {
  const f = L.flagIssues('<p>개인정보 제공 동의서</p><p>회비산출의 근거자료</p>');
  assert.ok(f.includes('동의서용도불일치'));
});

test('flagIssues: PII 잔존을 잡는다', () => {
  assert.ok(L.flagIssues('<p>790101-1234567</p>').includes('PII잔존'));
});

test('flagIssues: 깨끗하면 빈 배열', () => {
  assert.deepStrictEqual(L.flagIssues('<p>위 임 장</p><p>{{이름}}</p>'), []);
});

// 추가 테스트: 주소가 있고 자동치환 대상 PII는 없을 때 '주소포함' 플래그를 확인
test('flagIssues: 법인 사무소 주소가 있으면 주소포함 플래그만 붙인다', () => {
  const html = '<p>위 임 장</p><p>사무소: 충남 천안시 서북구 원두정8길 6, 두정빌딩 3층</p>';
  const flags = L.flagIssues(html);
  assert.ok(flags.includes('주소포함'), '주소포함 플래그가 있어야 함');
  assert.ok(!flags.includes('PII잔존'), 'PII잔존 플래그가 없어야 함');
});

// Finding 1 회귀: 공백만으로 표시된 빈 기입란은 stripTags를 거치면 공백 뭉치가
// 한 칸으로 뭉개져 \s{3,} 대안이 죽은 코드가 된다. 뒤에 다른 문단이 이어 붙으면
// 문서 끝의 $도 못 살려낸다 — labelProbeView가 태그를 줄바꿈으로 바꿔 줄 단위로
// 봐야 라벨을 잡을 수 있다.
test('extractVars: 라벨 뒤 공백만 있고 뒤에 다른 문단이 이어져도 변수로 승격', () => {
  const v = L.extractVars('<p>성    명 :        </p><p>다음 문단</p>');
  assert.deepStrictEqual(v.map(x => x.key), ['이름']);
});

// Finding 2 회귀: 개인 주소 '주소'의 bare 조각이 '사업장 주소' 안에도 들어 있어,
// 회사 주소만 있는 서식에서 필수 항목 '주소'가 채워진 것처럼 잘못 보고됐다.
// Important 회귀: anonymize(PII_RULES)가 채워진 값을 지우며 박아 넣는 자리표시자
// ({{연락처}}·{{전화번호}}·{{계좌번호}})는 LABEL_MAP이 빈 기입란에서 쓰는 표준 키
// (근로자연락처·입금계좌)와 달랐다. 같은 개념이 원문 상태(빈 칸/채워진 값)에 따라
// 다른 키·다른 required로 잡히던 문제를 별칭 매핑으로 하나로 합친다.
test('extractVars: 익명화 자리표시자와 빈 기입란 라벨이 같은 표준 키로 모인다', () => {
  const blank = L.extractVars('<p>연락처 : ______</p>');
  const filled1 = L.extractVars('<p>{{연락처}}</p>');
  const filled2 = L.extractVars('<p>{{전화번호}}</p>');
  assert.deepStrictEqual(blank.map(v => v.key), ['근로자연락처']);
  assert.deepStrictEqual(filled1.map(v => v.key), ['근로자연락처']);
  assert.deepStrictEqual(filled2.map(v => v.key), ['근로자연락처']);
  assert.ok(blank[0].required && filled1[0].required && filled2[0].required);

  const acctBlank = L.extractVars('<p>계좌번호 : ______</p>');
  const acctFilled = L.extractVars('<p>{{계좌번호}}</p>');
  assert.deepStrictEqual(acctBlank.map(v => v.key), ['입금계좌']);
  assert.deepStrictEqual(acctFilled.map(v => v.key), ['입금계좌']);
  assert.strictEqual(acctBlank[0].required, acctFilled[0].required);
});

test('extractVars: 사업장 주소는 사업장소재지만 잡고 개인 주소로 새지 않는다', () => {
  const v = L.extractVars('<p>사업장 주소 :        </p>');
  assert.deepStrictEqual(v.map(x => x.key), ['사업장소재지']);
});

// Finding 2 회귀 보강: 위 수정이 평범한 개인 주소 필드까지 죽이지 않았는지 확인.
// 주소 예시는 실사건 데이터 대신 법인 사무소 주소(충남 천안시 서북구 원두정8길 6,
// 두정빌딩 3층)를 쓴다.
test('extractVars: 평범한 개인 주소 라벨은 여전히 주소로 잡힌다', () => {
  const v1 = L.extractVars('<p>현주소 :        </p>');
  assert.ok(v1.map(x => x.key).includes('주소'));
  const v2 = L.extractVars('<p>주    소 :        </p><p>충남 천안시 서북구 원두정8길 6, 두정빌딩 3층</p>');
  assert.ok(v2.map(x => x.key).includes('주소'));
});
