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

// ═════════════════════════════════════════════════════════════
// 2차 적대적 검토(adversarial review) 회귀 테스트.
// 값은 전부 합성이다 — 실제 개인정보는 한 건도 쓰지 않는다.
// ═════════════════════════════════════════════════════════════

// 보이지 않는 문자는 소스에 그대로 박지 않는다 (NUL과 같은 이유).
const SHY  = String.fromCharCode(0x00AD);   // 소프트 하이픈
const ZWSP = String.fromCharCode(0x200B);   // 제로폭 공백
const BOM  = String.fromCharCode(0xFEFF);
const fullwidth = s => s.replace(/[0-9]/g, d => String.fromCharCode(0xFF10 + Number(d)));

const MARKUP = /<!--[\s\S]*?-->|<[^>]+>/g;
const tagCount = h => (h.match(MARKUP) || []).length;
const cells = h => [...h.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);

// ── Important 2 — 공백 주민번호 규칙이 무관한 셀을 삼켜 값을 삭제하던 문제 ──
// applyMatches는 매치 구간 전체를 자리표시자 하나로 바꾼다. 그래서 6자리·7자리
// 숫자가 나란한 표를 잘못 물면 두 번째 셀 값은 '라벨링'이 아니라 **삭제**된다.
// 체불금품확인서에서는 임금 액수가 소리 없이 사라진다는 뜻이다.

const NOT_RRN_ROWS = [
  ['단가·수량', '<tr><td>250000</td><td>1234567</td></tr>'],
  ['연월·금액', '<tr><td>202301</td><td>1500000</td></tr>'],
  ['사번·금액', '<tr><td>100234</td><td>2450000</td></tr>'],
];

for (const [name, html] of NOT_RRN_ROWS) {
  test('공백 주민번호 규칙이 무관한 두 셀을 삼키지 않는다 — ' + name, () => {
    assert.deepStrictEqual(labels(html), [], html);
    const r = L.anonymize(html);
    assert.strictEqual(r.html, html, '표가 통째로 보존돼야 한다');
    assert.deepStrictEqual(r.hits, {});
  });

  test('두 번째 셀의 값이 삭제되지 않는다 — ' + name, () => {
    // 회귀 이전에는 <td></td>가 되어 금액이 흔적 없이 사라졌다.
    const out = L.anonymize(html).html;
    assert.deepStrictEqual(cells(out), cells(html), out);
    for (const c of cells(html)) assert.ok(out.includes(c), c + ' 가 사라졌다: ' + out);
  });
}

test('공백 주민번호: 구조가 온전한 값은 구별할 수 없어 오탐으로 남는다 (감수)', () => {
  // 230115 1800000 → mm=01 dd=15 성별자리=1. 진짜 주민번호와 구조가 완전히
  // 같아서 원리상 구별이 불가능하다. 미탐보다 오탐이 안전하므로 이대로 둔다.
  // 이 테스트는 "고쳐야 할 버그"가 아니라 "알고 남긴 잔여 위험"의 기록이다.
  const html = '<tr><td>230115</td><td>1800000</td></tr>';
  assert.deepStrictEqual(labels(html), ['주민등록번호'], html);
});

const RRN_MUST_MATCH = [
  ['대시',           '790101-1234567'],
  ['공백 한 칸',     '790101 1234567'],
  ['공백 여러 칸',   '790101     1234567'],
  ['공백+대시+공백', '790101 - 1234567'],
  ['전각 하이픈',    '790101－1234567'],
  ['엔대시',         '790101–1234567'],
  ['깨진 달(대시)',  '991301-1234567'],
];

for (const [name, val] of RRN_MUST_MATCH) {
  test('주민번호는 계속 잡는다 — ' + name, () => {
    const html = '<p>' + val + '</p>';
    assert.deepStrictEqual(labels(html), ['주민등록번호'], html);
    const r = L.anonymize(html);
    assert.strictEqual(r.html, '<p>{{주민등록번호}}</p>');
    assert.strictEqual(r.hits['주민등록번호'], 1);
  });
}

test('대시 규칙은 검증 없이 남는다 — 깨진 달도 가린다', () => {
  // 991301은 13월이라 looksLikeRrn을 통과하지 못하지만, 대시가 실제로 찍혀
  // 있으므로 무관한 숫자 둘이 우연히 이 꼴이 될 위험이 거의 없다.
  assert.deepStrictEqual(labels('<p>991301-1234567</p>'), ['주민등록번호']);
  // 반면 공백 형태는 검증을 통과해야만 인정한다.
  assert.deepStrictEqual(labels('<p>991301 1234567</p>'), []);
});

// ── Critical 1 — 태그 속성·주석 안의 개인정보 ──
// 검출만 하고 치환하지는 않는다. 근거는 forms_lib.js의 scanPii 주석 참조
// (현재 입력원 hwp2html.py는 본문을 요소 내용으로만 내보내고 주석을 만들지 않는다).

const IN_MARKUP = [
  ['alt 속성',   '<img alt="790101-1234567">',           '주민등록번호'],
  ['title 속성', '<td title="010-1234-5678">x</td>',     '연락처'],
  ['HTML 주석',  '<p>x</p><!-- 790101-1234567 -->',      '주민등록번호'],
  ['tel: 링크',  '<a href="tel:010-1234-5678">연락</a>', '연락처'],
];

for (const [name, html, label] of IN_MARKUP) {
  test('마크업 안쪽 개인정보를 scanPii가 보고한다 — ' + name, () => {
    assert.deepStrictEqual(labels(html), [label], html);
    assert.strictEqual(redact(html)[0].kind, 'redact');
  });

  test('마크업 안쪽은 anonymize가 건드리지 않는다 (검출 전용) — ' + name, () => {
    const r = L.anonymize(html);
    assert.strictEqual(r.html, html, '마크업을 재작성하면 서식이 깨진다');
    assert.deepStrictEqual(r.hits, {});
  });
}

test('마크업 안쪽 검출은 "검출되면 지워진다" 불변식의 의도된 예외다', () => {
  // 게이트(kind==='redact')는 떨어뜨려서 사람이 보게 만들되, 자동 치환은 안 한다.
  const html = '<img alt="790101-1234567">';
  const r = L.anonymize(html);
  assert.notDeepStrictEqual(redact(r.html), [], '게이트는 계속 걸려 있어야 한다');
});

test('주석 안에 > 가 들어 있어도 통째로 인식한다', () => {
  const html = '<p>x</p><!-- a > b 790101-1234567 -->';
  assert.deepStrictEqual(labels(html), ['주민등록번호'], html);
});

test('hwp2html.py가 실제로 내보내는 속성은 오탐을 만들지 않는다', () => {
  const html = '<table><colgroup><col style="width:33.333%"></colgroup>' +
               '<tr><td colspan="2" rowspan="3">기본급</td></tr></table>';
  assert.deepStrictEqual(L.scanPii(html), []);
});

// ── Important 3 — 연락처 구분자 관용 ──

const PHONE_VARIANTS = [
  ['공백', '<p>010 1234 5678</p>', '<p>{{연락처}}</p>'],
  ['점',   '<p>010.1234.5678</p>', '<p>{{연락처}}</p>'],
  ['대시', '<p>010-1234-5678</p>', '<p>{{연락처}}</p>'],
  ['붙임', '<p>01012345678</p>',   '<p>{{연락처}}</p>'],
];

for (const [name, html, expect] of PHONE_VARIANTS) {
  test('연락처 구분자 변형 — ' + name, () => {
    assert.deepStrictEqual(labels(html), ['연락처'], html);
    const r = L.anonymize(html);
    assert.strictEqual(r.html, expect);
    assert.strictEqual(r.hits['연락처'], 1);
  });
}

test('표로 쪼개진 휴대폰을 압축 뷰 패스가 잡는다', () => {
  const html = '<tr><td>010</td><td>1234</td><td>5678</td></tr>';
  assert.deepStrictEqual(labels(html), ['연락처'], html);
  const r = L.anonymize(html);
  assert.strictEqual(r.html, '<tr><td>{{연락처}}</td><td></td><td></td></tr>');
  assert.strictEqual(r.hits['연락처'], 1);
});

test('압축 뷰 휴대폰 패스는 11자리 + 01[016789]만 인정한다', () => {
  // 12자리 — 셀이 융합돼도 검증에서 걸린다.
  const a = '<tr><td>0101</td><td>2345</td><td>6789</td></tr>';
  assert.deepStrictEqual(labels(a), [], a);
  assert.strictEqual(L.anonymize(a).html, a);
  // 010으로 시작하지 않는 세 셀도 인정하지 않는다.
  const b = '<tr><td>031</td><td>1234</td><td>5678</td></tr>';
  assert.deepStrictEqual(labels(b), [], b);
  assert.strictEqual(L.anonymize(b).html, b);
});

test('유선전화도 점·공백 구분자를 받는다', () => {
  for (const v of ['041-556-0035', '041.556.0035', '041 556 0035']) {
    const html = '<p>' + v + '</p>';
    assert.deepStrictEqual(labels(html), ['전화번호'], html);
  }
  // 구분자가 아예 없으면 인정하지 않는다 — 0으로 시작하는 숫자를 통째로 먹는다.
  assert.deepStrictEqual(labels('<p>0415560035</p>'), []);
});

// ── Important 4 — 인라인 태그로 갈린 인명 ──

test('인라인 태그가 가른 인명도 치환한다', () => {
  const r = L.anonymize('<p>위임인 홍<b>길동</b> (인)</p>', ['홍길동']);
  assert.ok(!r.html.includes('길동'), r.html);
  assert.ok(r.html.includes('{{이름}}'), r.html);
  assert.strictEqual(r.hits['이름'], 1, '두 번 세면 안 된다');
});

test('인명 압축 패스가 태그 개수를 보존한다', () => {
  const src = '<p>위임인 홍<b>길동</b> (인)</p>';
  const out = L.anonymize(src, ['홍길동']).html;
  assert.strictEqual(tagCount(out), tagCount(src), out);
});

test('표 셀로 갈린 인명도 치환한다', () => {
  const r = L.anonymize('<tr><td>홍</td><td>길동</td></tr>', ['홍길동']);
  assert.ok(!r.html.includes('길동'), r.html);
  assert.strictEqual(r.hits['이름'], 1);
});

test('인명 압축 패스가 한글 경계를 깨지 않는다', () => {
  // 공백 뷰에서 지켜지던 '정산금/정산서' 보호가 압축 뷰에서도 유지돼야 한다.
  const r = L.anonymize('<p>정산금 정산서 정산 완료</p>', ['정산']);
  assert.strictEqual(r.html, '<p>정산금 정산서 {{이름}} 완료</p>');
  assert.strictEqual(r.hits['이름'], 1);
  // 압축 뷰는 정산<b>금</b>을 '정산금'으로 읽으므로 스스로는 매치하지 않는다.
  const r2 = L.anonymize('<p>정산<b>금</b></p>', ['정산']);
  assert.strictEqual(r2.hits['이름'], 1, '공백 뷰가 잡는 한 번뿐이어야 한다');
  assert.ok(!/(\{\{이름\}\}){2}/.test(r2.html), '압축 패스가 겹쳐 잡으면 안 된다');
});

test('알려진 과다 마스킹: 인라인 태그로 갈린 낱말 (2차 검토 이전부터의 동작)', () => {
  // 공백 뷰는 <b>를 공백으로 바꾸므로 '정산<b>금</b>'을 사람이 읽는 '정산금'이
  // 아니라 '정산 금'으로 본다. 그래서 인명 '정산'이 낱말 경계에 선 것으로 보고
  // 치환한다. 압축 뷰 패스를 새로 붙여도 이 동작은 달라지지 않는다
  // (압축 뷰는 '정산금'으로 읽어 매치하지 않는다).
  // 결과는 과다 마스킹 — 서식이 조금 상할 뿐 유출이 아니므로 그대로 둔다.
  const r = L.anonymize('<p>정산<b>금</b></p>', ['정산']);
  assert.strictEqual(r.html, '<p>{{이름}}<b>금</b></p>');
  assert.strictEqual(r.hits['이름'], 1);
});

// ── Minor — vault는 변수 이름 '전체' 모양을 본다 ──

test('vault 껍데기가 개인정보를 삼키지 못한다', () => {
  for (const html of ['<p>{{주민 790101-1234567}}</p>', '<p>{{x790101-1234567}}</p>']) {
    assert.deepStrictEqual(labels(html), ['주민등록번호'], html);
    const r = L.anonymize(html);
    assert.ok(!r.html.includes('790101'), r.html);
    assert.ok(!r.html.includes('1234567'), r.html);
    assert.strictEqual(r.hits['주민등록번호'], 1);
    assert.deepStrictEqual(redact(r.html), [], r.html);
  }
});

test('진짜 변수는 계속 보호된다', () => {
  const html = '<p>{{이름}} {{worker_rrn}} {{_x}} {{주민등록번호2}}</p>';
  assert.strictEqual(L.anonymize(html).html, html);
  assert.deepStrictEqual(L.scanPii(html), []);
});

test('vault 이름 길이는 제한된다', () => {
  // 길이를 넘긴 것은 vault로 보호하지 않는다 (안에 개인정보가 숨을 수 있다).
  const long = '{{' + 'a'.repeat(200) + '}}';
  assert.strictEqual(L.anonymize('<p>' + long + '</p>').html, '<p>' + long + '</p>');
  const hidden = '{{' + 'a'.repeat(200) + '790101-1234567}}';
  assert.deepStrictEqual(labels('<p>' + hidden + '</p>'), ['주민등록번호']);
});

// ── Minor — 이색 인코딩 ──

const EXOTIC = [
  ['소프트 하이픈',  '<p>790101' + SHY + '-1234567</p>'],
  ['제로폭 공백',    '<p>790101-123' + ZWSP + '4567</p>'],
  ['BOM',            '<p>7901' + BOM + '01-1234567</p>'],
  ['전각 숫자',      '<p>' + fullwidth('790101') + '-' + fullwidth('1234567') + '</p>'],
  ['숫자 참조 선두', '<p>&#55;90101-1234567</p>'],
];

for (const [name, html] of EXOTIC) {
  test('이색 인코딩을 뚫고 잡는다 — ' + name, () => {
    assert.deepStrictEqual(labels(html), ['주민등록번호'], html);
    const r = L.anonymize(html);
    assert.ok(r.html.includes('{{주민등록번호}}'), r.html);
    assert.ok(!/1234567/.test(r.html), r.html);
    assert.strictEqual(r.hits['주민등록번호'], 1);
    assert.deepStrictEqual(redact(r.html), [], r.html);
  });
}

test('숫자 참조가 반토막으로 남지 않는다', () => {
  // 예전에는 "&#55{{주민등록번호}}"처럼 엔티티가 잘려 쓰레기가 남았다.
  const out = L.anonymize('<p>&#55;90101-1234567</p>').html;
  assert.strictEqual(out, '<p>{{주민등록번호}}</p>');
  assert.ok(!out.includes('&#'), '엔티티 반토막이 남았다: ' + out);
});

test('꼬리 숫자 참조도 여전히 잘 붙는다', () => {
  // 왼쪽 패딩이 오른쪽 패딩 사례를 깨뜨리면 안 된다 (790101-123456&#55; = …7).
  const html = '<p>790101-123456&#55;</p>';
  assert.deepStrictEqual(labels(html), ['주민등록번호'], html);
  assert.strictEqual(L.anonymize(html).html, '<p>{{주민등록번호}}</p>');
});

test('전각 숫자 휴대폰도 잡는다', () => {
  const html = '<p>' + fullwidth('010') + '-' + fullwidth('1234') + '-' + fullwidth('5678') + '</p>';
  assert.deepStrictEqual(labels(html), ['연락처'], html);
});

// ── Minor — entry는 label+kind로 잡는다 ──

test('scanPii 항목은 label과 kind 둘 다로 구분된다', () => {
  const found = L.scanPii('<p>790101-1234567</p><p>충남 천안시 서북구 원두정8길 6</p>');
  const keys = found.map(f => f.kind + ':' + f.label).sort();
  assert.deepStrictEqual(keys, ['redact:주민등록번호', 'review:상세주소']);
  // 같은 kind+label 조합은 하나로 합쳐진다.
  const dup = L.scanPii('<p>790101-1234567 그리고 8801011234567</p>');
  assert.strictEqual(dup.filter(f => f.label === '주민등록번호').length, 1);
});

// ── Minor — 이메일 ──

test('이메일을 redact로 잡는다', () => {
  const html = '<p>hong@example.com</p>';
  assert.deepStrictEqual(labels(html), ['이메일'], html);
  const r = L.anonymize(html);
  assert.strictEqual(r.html, '<p>{{이메일}}</p>');
  assert.strictEqual(r.hits['이메일'], 1);
  assert.deepStrictEqual(redact(r.html), [], r.html);
});

test('이메일 변형과 음성 사례', () => {
  for (const v of ['a.b+c@sub.example.co.kr', 'worker_01@naver.com', 'x-y@a-b.com']) {
    assert.deepStrictEqual(labels('<p>' + v + '</p>'), ['이메일'], v);
  }
  // 이메일이 아닌 것을 먹지 않는다.
  for (const v of ['제1조 @ 목적', 'a@b', '@example.com']) {
    assert.deepStrictEqual(labels('<p>' + v + '</p>'), [], v);
  }
});

// ── 불변식 ──

const INVARIANT_CASES = [
  '<tr><td>790101-1234567</td><td>010-1234-5678</td><td>352-1234-5678-12</td></tr>',
  '<td>790101</td><td>1234567</td>',
  '<tr><td>250000</td><td>1234567</td></tr>',
  '<tr><td>202301</td><td>1500000</td></tr>',
  '<tr><td>010</td><td>1234</td><td>5678</td></tr>',
  '<p>790101-1234<b>567</b></p>',
  '<p>79<b>0101</b>-1234567</p>',
  '<p>위임인 홍<b>길동</b> (인)</p>',
  '<p>{{ 790101-1234567 }}</p>',
  '<p>&#55;90101-1234567</p>',
  '<p>790101-123' + ZWSP + '4567</p>',
  '<img alt="790101-1234567">',
  '<p>x</p><!-- 790101-1234567 -->',
  '<table><colgroup><col style="width:50%"></colgroup>' +
    '<tr><td colspan="2">임금</td><td>1,800,000</td></tr></table>',
  '<p>hong@example.com / 041-556-0035</p>',
];

test('불변식: anonymize는 태그 개수를 보존한다', () => {
  for (const c of INVARIANT_CASES) {
    const out = L.anonymize(c, ['홍길동']).html;
    assert.strictEqual(tagCount(out), tagCount(c), c + '  ->  ' + out);
  }
});

test('불변식: 개인정보가 없는 표는 셀 값이 하나도 사라지지 않는다', () => {
  // Important 2가 실제로 낸 피해 — 임금 액수가 조용히 삭제되던 문제.
  const SAFE_TABLES = [
    '<tr><td>250000</td><td>1234567</td></tr>',
    '<tr><td>202301</td><td>1500000</td></tr>',
    '<tr><td>100234</td><td>2450000</td></tr>',
    '<tr><td>2023년 1월</td><td>1,800,000</td><td>1,650,000</td></tr>',
    '<tr><td>기본급</td><td>2090000</td><td>209</td><td>9620</td></tr>',
    '<tr><td>031</td><td>1234</td><td>5678</td></tr>',
    '<tr><td>0101</td><td>2345</td><td>6789</td></tr>',
  ];
  for (const t of SAFE_TABLES) {
    const out = L.anonymize(t).html;
    assert.strictEqual(out, t, t + '  ->  ' + out);
    assert.deepStrictEqual(cells(out), cells(t));
  }
});

test('불변식: 개인정보가 있는 셀은 삭제가 아니라 자리표시자로 바뀐다', () => {
  // 셀이 비워지는 경우가 있긴 하다(값이 여러 셀에 걸친 하나의 개인정보일 때).
  // 그때도 그 값을 대표하는 자리표시자가 반드시 남아 있어야 한다.
  const r = L.anonymize('<tr><td>790101</td><td>1234567</td><td>1,800,000</td></tr>');
  assert.strictEqual(r.html,
    '<tr><td>{{주민등록번호}}</td><td></td><td>1,800,000</td></tr>');
  assert.ok(r.html.includes('1,800,000'), '무관한 셀은 그대로');
});

test('불변식: 재익명화는 고정점이다', () => {
  for (const c of INVARIANT_CASES) {
    const once = L.anonymize(c, ['홍길동']).html;
    const twice = L.anonymize(once, ['홍길동']);
    assert.strictEqual(twice.html, once, c);
    assert.deepStrictEqual(twice.hits, {}, c);
  }
});
