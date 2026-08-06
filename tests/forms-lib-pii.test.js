'use strict';
// 익명화·PII 검사 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../tools/forms_lib.js');

test('anonymize: 주민등록번호를 변수로 치환', () => {
  const r = L.anonymize('<p>주민번호 790101-1234567</p>');
  assert.ok(r.html.includes('{{주민등록번호}}'));
  assert.ok(!/\d{6}-\d{7}/.test(r.html));
  assert.strictEqual(r.hits['주민등록번호'], 1);
});

test('anonymize: 사업자등록번호가 계좌번호로 오인되지 않는다', () => {
  const r = L.anonymize('<p>사업자 123-45-67890</p>');
  assert.ok(r.html.includes('{{사업자등록번호}}'));
  assert.ok(!r.html.includes('{{계좌번호}}'));
});

test('anonymize: 휴대폰·유선전화·계좌를 각각 치환', () => {
  const r = L.anonymize('<p>010-1234-5678 / 041-556-0035 / 352-1234-5678-12</p>');
  assert.ok(r.html.includes('{{연락처}}'));
  assert.ok(r.html.includes('{{전화번호}}'));
  assert.ok(r.html.includes('{{계좌번호}}'));
});

test('anonymize: 날짜를 계좌번호로 오인하지 않는다', () => {
  const r = L.anonymize('<p>작성일 2023-01-15</p>');
  assert.ok(!r.html.includes('{{계좌번호}}'));
  assert.ok(r.html.includes('2023-01-15'));
});

test('anonymize: 인명 사전으로 실명을 치환', () => {
  const r = L.anonymize('<p>위임인 홍길동 (인)</p>', ['홍길동']);
  assert.ok(r.html.includes('{{이름}}'));
  assert.ok(!r.html.includes('홍길동'));
  assert.strictEqual(r.hits['이름'], 1);
});

test('anonymize: 이미 치환된 변수는 건드리지 않는다', () => {
  const r = L.anonymize('<p>{{주민등록번호}}</p>');
  assert.strictEqual(r.html, '<p>{{주민등록번호}}</p>');
  assert.strictEqual(Object.keys(r.hits).length, 0);
});

test('scanPii: 남아 있는 개인정보를 라벨과 표본으로 보고', () => {
  const found = L.scanPii('<p>790101-1234567 그리고 010-9999-8888</p>');
  const labels = found.map(f => f.label).sort();
  assert.deepStrictEqual(labels, ['연락처', '주민등록번호']);
  assert.ok(found.find(f => f.label === '주민등록번호').sample.includes('790101'));
});

test('scanPii: 깨끗한 서식은 빈 배열', () => {
  assert.deepStrictEqual(L.scanPii('<p>위 임 장</p><p>{{이름}} {{주민등록번호}}</p>'), []);
});

// ─────────────────────────────────────────────────────────────
// 여기서부터는 유출 방어선의 음성 사례(negative case) 회귀 테스트.
// 모든 값은 합성 데이터다 — 실제 개인정보는 한 건도 쓰지 않는다.
// ─────────────────────────────────────────────────────────────

// 소스 파일에 널 바이트를 직접 쓰지 않는다 (file(1)이 바이너리로 오인한다).
const NUL = String.fromCharCode(0);
const redact = h => L.scanPii(h).filter(f => f.kind === 'redact');
const labels = h => redact(h).map(f => f.label).sort();

// ── Critical 1 — 표 레이아웃 ──

test('scanPii: 표 셀에 나뉜 개인정보를 놓치지 않는다 (태그를 공백으로 정규화)', () => {
  const html = '<tr><td>790101-1234567</td><td>010-1234-5678</td><td>352-1234-5678-12</td></tr>';
  assert.deepStrictEqual(labels(html), ['계좌번호', '연락처', '주민등록번호']);
  // 예전에는 셀 값이 달라붙어 "1234-5678-12" 같은 무의미한 표본만 나왔다.
  const rrn = redact(html).find(f => f.label === '주민등록번호');
  assert.strictEqual(rrn.sample, '790101-1234567');
});

test('scanPii와 anonymize는 표 레이아웃에서 같은 결론을 낸다', () => {
  const html = '<tr><td>790101-1234567</td><td>010-1234-5678</td><td>352-1234-5678-12</td></tr>';
  const r = L.anonymize(html);
  assert.strictEqual(r.html,
    '<tr><td>{{주민등록번호}}</td><td>{{연락처}}</td><td>{{계좌번호}}</td></tr>');
  assert.deepStrictEqual(redact(r.html), []);
});

// ── Critical 2 — 주민번호 구분자 변형 ──

const RRN_VARIANTS = [
  ['표로 쪼개진 셀',     '<td>790101</td><td>1234567</td>'],
  ['구분자 없음',        '<p>7901011234567</p>'],
  ['공백',               '<p>790101 1234567</p>'],
  ['전각 하이픈',        '<p>790101－1234567</p>'],
  ['엔대시',             '<p>790101–1234567</p>'],
  ['하이픈 U+2010',      '<p>790101‐1234567</p>'],
  ['엠대시',             '<p>790101—1234567</p>'],
  ['숫자 문자 참조',     '<p>790101&#45;1234567</p>'],
  ['16진 문자 참조',     '<p>790101&#x2D;1234567</p>'],
];

for (const [name, html] of RRN_VARIANTS) {
  test('주민번호 구분자 변형을 scanPii가 잡는다 — ' + name, () => {
    assert.deepStrictEqual(labels(html), ['주민등록번호'], html);
  });
  test('주민번호 구분자 변형을 anonymize가 지운다 — ' + name, () => {
    const r = L.anonymize(html);
    assert.ok(r.html.includes('{{주민등록번호}}'), r.html);
    assert.ok(!/1234567/.test(r.html), r.html);
    assert.strictEqual(r.hits['주민등록번호'], 1);
  });
}

test('표로 쪼개진 주민번호를 지우면서 셀 구조는 남긴다', () => {
  // Critical 1의 태그→공백 정규화 + 넓어진 구분자 클래스가 합쳐져 닫히는 사례.
  const r = L.anonymize('<td>790101</td><td>1234567</td>');
  assert.strictEqual(r.html, '<td>{{주민등록번호}}</td><td></td>');
});

test('13자리 맨숫자 규칙은 생년월일·성별자리를 검증한다', () => {
  // 34월은 없다 — 무관한 13자리 일련번호를 먹으면 안 된다.
  assert.deepStrictEqual(labels('<p>1234567890123</p>'), []);
  assert.strictEqual(L.anonymize('<p>1234567890123</p>').html, '<p>1234567890123</p>');
  // 32일도 없다.
  assert.deepStrictEqual(labels('<p>9903321234567</p>'), []);
  // 성별자리 9는 주민번호가 아니다.
  assert.deepStrictEqual(labels('<p>7901019234567</p>'), []);
  // 정상값은 잡는다.
  assert.deepStrictEqual(labels('<p>9912311234567</p>'), ['주민등록번호']);
});

// ── 추가 발견: 태그가 숫자 한가운데를 가른 주민번호 ──
// 태그→공백 정규화(Critical 1)만으로는 닫히지 않는 같은 계열의 미탐.
// 압축 뷰 보완 패스가 닫는다.

const TAG_SPLIT = [
  ['뒷자리 중간',  '<p>790101-1234<b>567</b></p>'],
  ['앞자리 중간',  '<p>79<b>0101</b>-1234567</p>'],
  ['구분자 없이',  '<p>790101<span>1234567</span></p>'],
];

for (const [name, html] of TAG_SPLIT) {
  test('태그가 숫자를 가른 주민번호도 잡는다 — ' + name, () => {
    assert.deepStrictEqual(labels(html), ['주민등록번호'], html);
    const r = L.anonymize(html);
    assert.ok(r.html.includes('{{주민등록번호}}'), r.html);
    assert.ok(!/\d/.test(r.html), r.html);
    assert.strictEqual(r.hits['주민등록번호'], 1, '두 번 세면 안 된다');
  });
}

test('압축 뷰 보완 패스는 검증을 통과한 것만 인정한다', () => {
  // 34월 — 태그로 갈라져 있어도 주민번호가 아니다.
  const html = '<p>1234567<b>890123</b></p>';
  assert.deepStrictEqual(labels(html), []);
  assert.strictEqual(L.anonymize(html).html, html);
});

// ── Important 3 — 상세주소는 보고만, 치환하지 않는다 ──

const OFFICE_ADDR = '<p>충남 천안시 서북구 원두정8길 6, 두정빌딩 3층</p>';

test('scanPii: 상세주소를 kind="review"로 보고한다', () => {
  const found = L.scanPii(OFFICE_ADDR);
  const addr = found.find(f => f.label === '상세주소');
  assert.ok(addr, JSON.stringify(found));
  assert.strictEqual(addr.kind, 'review');
  assert.ok(addr.sample.includes('천안시 서북구'), addr.sample);
});

test('anonymize: 상세주소는 절대 치환하지 않는다 (사무소 주소가 서식에 남아야 한다)', () => {
  const r = L.anonymize(OFFICE_ADDR);
  assert.strictEqual(r.html, OFFICE_ADDR);
  assert.strictEqual(r.hits['상세주소'], undefined);
});

test('상세주소는 redact 게이트를 막지 않는다 (kind로 분리된다)', () => {
  // "PII 잔존 0종" 판정은 kind==='redact'만 세야 한다.
  assert.deepStrictEqual(redact(OFFICE_ADDR), []);
  assert.strictEqual(L.scanPii(OFFICE_ADDR).length, 1);
});

test('scanPii: 근로자 자택 주소도 같은 규칙으로 보고된다', () => {
  const found = L.scanPii('<p>주소 경기도 성남시 분당구 판교로 123, 101동 202호</p>');
  const addr = found.find(f => f.label === '상세주소');
  assert.ok(addr, JSON.stringify(found));
  assert.strictEqual(addr.kind, 'review');
});

// ── Important 4 — 두 함수의 결론이 어긋나지 않는다 ──

const DISAGREEMENT = [
  '790101-<span>1234567</span>',
  '<p>790101&nbsp;-&nbsp;1234567</p>',
  '<p>{{ 790101-1234567 }}</p>',
  '<p>790101-1234<b>567</b></p>',
];

for (const html of DISAGREEMENT) {
  test('검출되면 반드시 지워진다 — ' + JSON.stringify(html), () => {
    assert.deepStrictEqual(labels(html), ['주민등록번호'], 'scan이 먼저 잡아야 한다');
    const r = L.anonymize(html);
    assert.ok(r.html.includes('{{주민등록번호}}'), r.html);
    assert.ok(!/1234567/.test(r.html.replace(/\{\{[^}]*\}\}/g, '')), r.html);
    // 왕복 불변식: 익명화한 결과에는 지워야 할 PII가 남지 않는다.
    assert.deepStrictEqual(redact(r.html), [], r.html);
  });
}

test('vault는 변수 이름처럼 생긴 것만 보호한다 — 껍데기가 개인정보를 삼키지 않는다', () => {
  // 예전 /\{\{[^}]+\}\}/ 는 {{ 790101-1234567 }} 전체를 보호해 진짜 주민번호를 삼켰다.
  const r = L.anonymize('<p>{{ 790101-1234567 }}</p>');
  assert.ok(!r.html.includes('790101'), r.html);
  assert.strictEqual(r.hits['주민등록번호'], 1);
  // 진짜 변수는 그대로 보호된다.
  assert.strictEqual(L.anonymize('<p>{{이름}} {{worker_rrn}} {{_x}}</p>').html,
    '<p>{{이름}} {{worker_rrn}} {{_x}}</p>');
});

// ── Important 5 — 인명 치환 경계 ──

test('anonymize: 인명은 한글 경계에서만 치환한다', () => {
  const r = L.anonymize('<p>정산금 정산서 정산 완료</p>', ['정산']);
  assert.strictEqual(r.html, '<p>정산금 정산서 {{이름}} 완료</p>');
  assert.strictEqual(r.hits['이름'], 1);
});

test('anonymize: 인명 치환이 방금 넣은 자리표시자를 다시 먹지 않는다', () => {
  const r = L.anonymize('<p>연락처 010-1234-5678</p>', ['연락처']);
  assert.strictEqual(r.html, '<p>{{이름}} {{연락처}}</p>');
  assert.ok(!/\{\{\{\{/.test(r.html), '자리표시자가 중첩되면 안 된다');
  assert.strictEqual(r.hits['이름'], 1);
});

test('anonymize: 인명이 다른 인명의 자리표시자를 먹지 않는다', () => {
  const r = L.anonymize('<p>홍길동 이름</p>', ['홍길동', '이름']);
  assert.strictEqual(r.html, '<p>{{이름}} {{이름}}</p>');
  assert.strictEqual(r.hits['이름'], 2);
});

// ── Minor ──

test('anonymize: 날짜+일련번호를 계좌번호로 오인하지 않는다', () => {
  const r = L.anonymize('<p>2023-01-15-001</p>');
  assert.strictEqual(r.html, '<p>2023-01-15-001</p>');
  assert.deepStrictEqual(labels('<p>2023-01-15-001</p>'), []);
  // 앞자리 연도 가드가 진짜 계좌번호를 막지는 않는다.
  assert.ok(L.anonymize('<p>352-1234-5678-12</p>').html.includes('{{계좌번호}}'));
});

test('anonymize: 카드번호 끝 네 자리가 남지 않는다', () => {
  const r = L.anonymize('<p>1234-5678-9012-3456</p>');
  assert.strictEqual(r.html, '<p>{{계좌번호}}</p>');
  assert.ok(!/3456/.test(r.html), r.html);
});

test('anonymize: 입력에 널 문자가 있어도 undefined를 뱉지 않는다', () => {
  const r = L.anonymize('<p>' + NUL + 'V0' + NUL + ' 790101-1234567</p>');
  assert.ok(!r.html.includes('undefined'), r.html);
  assert.strictEqual(r.html, '<p>' + NUL + 'V0' + NUL + ' {{주민등록번호}}</p>');
});

test('PII_RULES는 얼려서 내보낸다', () => {
  assert.ok(Object.isFrozen(L.PII_RULES));
  for (const rule of L.PII_RULES) assert.ok(Object.isFrozen(rule));
  assert.throws(() => { L.PII_RULES.push(['x', /x/g, null]); }, TypeError);
});

test('외부에서 정규식 lastIndex를 오염시켜도 검출이 흔들리지 않는다', () => {
  const re = L.PII_RULES[0][1];
  re.lastIndex = 999;                       // 소비자가 .test()를 돌린 뒤의 상태
  assert.deepStrictEqual(labels('<p>790101-1234567</p>'), ['주민등록번호']);
  re.lastIndex = 999;
  assert.ok(L.anonymize('<p>790101-1234567</p>').html.includes('{{주민등록번호}}'));
  re.lastIndex = 0;
});

// ── 왕복 불변식 ──

test('익명화 결과에는 지워야 할 PII가 남지 않는다 (전 사례 왕복 검증)', () => {
  const CASES = [
    '<tr><td>790101-1234567</td><td>010-1234-5678</td></tr>',
    '<td>790101</td><td>1234567</td>',
    '<p>7901011234567</p>',
    '<p>790101&#45;1234567</p>',
    '<p>790101－1234567</p>',
    '790101-<span>1234567</span>',
    '<p>790101&nbsp;-&nbsp;1234567</p>',
    '<p>{{ 790101-1234567 }}</p>',
    '<p>790101-1234<b>567</b></p>',
    '<p>79<b>0101</b>-1234567</p>',
    '<p>1234-5678-9012-3456</p>',
    '<p>041-556-0035 / 010-9999-8888 / 123-45-67890</p>',
  ];
  for (const c of CASES) {
    assert.deepStrictEqual(redact(L.anonymize(c).html), [], c);
  }
});
