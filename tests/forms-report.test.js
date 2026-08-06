'use strict';
// 검토 산출물 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const R = require('../tools/forms_report.js');

const FORMS = [{
  id: 'wa-abc1234567', title: '위임약정서', titleDetected: true, domain: 'wageArrears',
  track: ['수임·위임'], category: 'mandate', esign: true, signer: 'worker',
  jurisdiction: '천안',
  vars: [{ key: '이름' }, { key: '주민등록번호' }],
  body: '<p>위 임 약 정 서</p><p>본문</p>',
  source: { file: 'x/위임약정서.hwp', mtime: 1700000000000, hash: 'abc1234567',
            pickedBy: 'blank', cluster: ['x/위임약정서.hwp', 'y/사본.hwp'] },
  review: { status: 'pending', flags: ['구법용어'] },
}];

test('reviewRows: 헤더와 열 비율의 개수가 맞는다', () => {
  const t = R.reviewRows(FORMS);
  assert.strictEqual(t.headers.length, t.colRatios.length);
  assert.ok(t.headers.includes('승인'));
  assert.ok(t.headers.includes('서식명'));
  assert.ok(t.headers.includes('대표본 경로'));
});

test('reviewRows: 한 서식이 한 행', () => {
  const t = R.reviewRows(FORMS);
  assert.strictEqual(t.rows.length, 1);
  assert.strictEqual(t.rows[0].length, t.headers.length);
});

test('reviewRows: 변수·트랙·중복수가 문자열로 들어간다', () => {
  const row = R.reviewRows(FORMS).rows[0];
  const h = R.reviewRows(FORMS).headers;
  assert.strictEqual(row[h.indexOf('변수')], '이름, 주민등록번호');
  assert.strictEqual(row[h.indexOf('트랙')], '수임·위임');
  assert.strictEqual(row[h.indexOf('중복')], 2);
});

test('reviewRows: 육안확인 필요 건에 표시', () => {
  const forms = [{ ...FORMS[0], source: { ...FORMS[0].source, pickedBy: 'anonymized-latest' } }];
  const h = R.reviewRows(forms).headers;
  assert.strictEqual(R.reviewRows(forms).rows[0][h.indexOf('육안확인')], 'O');
  assert.strictEqual(R.reviewRows(FORMS).rows[0][h.indexOf('육안확인')], '');
});

test('reviewHtml: 서식 본문과 머리말이 들어간다', () => {
  const html = R.reviewHtml(FORMS);
  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('위임약정서'));
  assert.ok(html.includes('<p>본문</p>'));
  assert.ok(html.includes('구법용어'));
  assert.ok(html.includes('x/위임약정서.hwp'));
});

test('reviewHtml: 서식이 없어도 깨지지 않는다', () => {
  const html = R.reviewHtml([]);
  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('0종'));
});

// ── 추가 1: '주소포함' 플래그가 검토표 행에 그대로 드러나야 한다 ──
// 주소는 forms_lib.js의 scanPii가 kind:'review'로만 표시하고 자동 치환하지
// 않는다(법인 자기 주소가 위임장 전반에 있어 자동 치환이 위험). 그래서 이
// 플래그를 놓치면 사람이 확인해야 할 주소가 검토표에서 조용히 사라진다.
test('reviewRows: 주소포함 플래그가 플래그 열에 표시된다', () => {
  const forms = [{ ...FORMS[0], review: { status: 'pending', flags: ['주소포함'] } }];
  const h = R.reviewRows(forms).headers;
  const row = R.reviewRows(forms).rows[0];
  assert.ok(row[h.indexOf('플래그')].includes('주소포함'));
});

test('reviewRows: 여러 플래그가 함께 있어도 주소포함이 유지된다', () => {
  const forms = [{ ...FORMS[0], review: { status: 'pending', flags: ['구법용어', '주소포함'] } }];
  const h = R.reviewRows(forms).headers;
  const row = R.reviewRows(forms).rows[0];
  assert.strictEqual(row[h.indexOf('플래그')], '구법용어, 주소포함');
});

// ── 추가 2: 제목 미검출 표시 ──
// 세그먼트 분할이 표 안의 제목을 못 찾으면 buildForms가 titleDetected=false를
// 매기고, title은 본문 앞 24자로 채워 넣는다(빈 문자열이 아니다!). 예전 검사는
// title이 빈 문자열인지를 봤는데, buildForms가 항상 대체값을 채워 넣으므로
// title이 실제로 비는 일이 없어 그 조건은 결코 참이 될 수 없었다 — 통과하고
// 있었지만 옳은 이유로 통과한 게 아니었다. titleDetected를 직접 봐야 한다.
test('reviewRows: titleDetected가 false면 서식명 칸에 (제목 미검출)이 앞에 붙는다', () => {
  const forms = [{ ...FORMS[0], titleDetected: false }];
  const h = R.reviewRows(forms).headers;
  const row = R.reviewRows(forms).rows[0];
  const cell = row[h.indexOf('서식명')];
  assert.ok(cell.startsWith('(제목 미검출)'));
});

test('reviewRows: titleDetected가 true면 (제목 미검출) 표시가 붙지 않는다', () => {
  const h = R.reviewRows(FORMS).headers;
  const row = R.reviewRows(FORMS).rows[0];
  const cell = row[h.indexOf('서식명')];
  assert.strictEqual(cell, '위임약정서');
  assert.ok(!cell.includes('제목 미검출'));
});

test('reviewHtml: titleDetected가 false면 소제목에도 (제목 미검출) 표시가 보인다', () => {
  const forms = [{ ...FORMS[0], titleDetected: false }];
  const html = R.reviewHtml(forms);
  assert.ok(html.includes('(제목 미검출)'));
});

test('reviewHtml: titleDetected가 true면 (제목 미검출) 표시가 없다', () => {
  const html = R.reviewHtml(FORMS);
  assert.ok(!html.includes('제목 미검출'));
});
