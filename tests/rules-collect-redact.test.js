/* 서버가 첨부 하나를 가린다 — 지키는 선(설계 §4-2):
   ① 원래 번호가 돌려주는 것(글·파일·셈) 어디에도 없다 ② 남거나 못 읽으면 담지 않는다
   ③ 한글만 파일째, 워드는 글만 ④ PDF 는 1판에서 보류 */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../hwpx_gen.js');
const X = require('../functions/rules-collect-redact.js');

const RRN = '900101-1234567', PHONE = '010-9876-5432';
const hwpx = (s) => H.build(H.para('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.') + H.para(s));
const has = (u8, s) => !!u8 && Buffer.from(u8).includes(Buffer.from(s));

test('한글 — 파일째 가리고 원래 번호가 어디에도 없다', async () => {
  const r = await X.redactOne(hwpx('담당 홍길동 ' + PHONE + ' 주민 ' + RRN), 'hwpx');
  assert.equal(r.ok, true);
  assert.ok(r.total >= 2);
  assert.ok(r.data && r.data.length > 0);
  [RRN, PHONE].forEach((s) => {
    assert.ok(!r.text.includes(s), '★ 가린 글에 남았다');
    assert.ok(!has(r.data, s), '★ 가린 파일 바이트에 남았다');
    assert.ok(!JSON.stringify(r.count).includes(s));
  });
});

test('찾은 것이 없으면 원본 그대로(가린 것과 같다)', async () => {
  const src = hwpx('개인정보 없음');
  const r = await X.redactOne(src, 'hwpx');
  assert.equal(r.ok, true);
  assert.equal(r.total, 0);
  assert.ok(Buffer.from(r.data).equals(Buffer.from(src)));
});

test('PDF 는 보류, 못 읽는 것도 보류 — 담을 것을 돌려주지 않는다', async () => {
  const p = await X.redactOne(Buffer.from('%PDF-1.7 ' + RRN), 'pdf');
  assert.equal(p.ok, false);
  assert.match(p.holdWhy, /PDF/);
  assert.equal(p.text, undefined);
  const junk = await X.redactOne(Buffer.from('PK\u0003\u0004 not a real zip'), 'hwpx');
  assert.equal(junk.ok, false);
  assert.match(junk.holdWhy, /읽지 못/);
});

test('마지막 그물 — 가린 글에 주민번호 꼴이 남으면 보류', async () => {
  assert.ok(X.RAW_RE.test('주민 ' + RRN));
  assert.ok(!X.RAW_RE.test('주민 900101-●●●●●●●'));
});
