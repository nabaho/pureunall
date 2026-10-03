/* 서고에 올릴 때 개인정보 가림 (js/pu-kordoc-text.js redactFile) — 2026-09-30 대표 「추천대로」 ②
   진짜 kordoc 묶음을 node 에서 실어 한글 파일을 가려 본다.
   지키는 것: ① 원래 번호가 결과(가린 파일·가린 글·보고) 어디에도 안 남는다
             ② 가린 파일을 다시 읽어 남은 것 0 ③ 사업자번호·이름은 기본으로 안 가린다(사업장 열쇠·헛잡기)
             ④ 한글이 아닌 파일은 글만 가리고 파일은 돌려주지 않는다(원본을 안 담는 근거) */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const T = require('../js/pu-kordoc-text.js');
const H = require('../hwpx_gen.js');

const RRN = '900101-1234567', PHONE = '010-9876-5432', ACCT = '123456-01-234567', MAIL = 'hong@example.com', BRN = '123-45-67890';
function piiHwpx() {
  let body = H.para('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.');
  body += H.para('담당자 홍길동 연락처 ' + PHONE + ', 주민등록번호 ' + RRN + ', 전자우편 ' + MAIL);
  body += H.tablePara([['구분', '내용'], ['급여 계좌', '국민은행 ' + ACCT], ['사업자등록번호', BRN]], H.cols([0.4, 0.6]));
  return H.build(body);
}
const K = import(pathToFileURL(path.join(__dirname, '..', 'vendor', 'kordoc', 'kordoc.browser.min.js')).href);
async function ready() { T._use(await K); return K; }
const bytesHave = (u8, s) => Buffer.from(u8).includes(Buffer.from(s));

test('한글 파일은 파일째 가리고, 다시 읽어 남은 것이 없다', async () => {
  const k = await ready();
  const src = piiHwpx();
  const text = (await T.read(src)).text;
  const r = await T.redactFile(src, text);
  assert.equal(r.fileOk, true);
  assert.ok(r.total >= 4, '주민·전화·계좌·전자우편을 찾아야 한다: ' + JSON.stringify(r.count));
  assert.equal(r.residual, 0, '★ 가린 뒤에도 개인정보가 남았다');
  assert.ok(r.data && r.data.length > 0, '가린 파일을 돌려줘야 한다');
  /* 가린 파일을 다시 열어 봐도 원래 번호가 없다 — 글자로 찾지 않고 kordoc 로 다시 읽어 본다 */
  const back = await k.parse(r.data, { ocr: false });
  [RRN, PHONE, ACCT, MAIL].forEach(s => {
    assert.ok(!back.markdown.includes(s), '★ 가린 파일에 원래 번호가 남았다: ' + s.replace(/\d/g, '#'));
    assert.ok(!r.text.includes(s), '★ 가린 글에 원래 번호가 남았다');
  });
  /* 보고에는 가린 모양만 — 원래 번호가 화면·기록으로 새면 안 된다 */
  const rep = JSON.stringify({ samples: r.samples, count: r.count });
  [RRN, PHONE, ACCT, MAIL].forEach(s => assert.ok(!rep.includes(s), '★ 보고에 원래 번호가 담겼다'));
  assert.ok(r.samples.every(x => /●/.test(x.masked)));
  /* 기본 규칙은 사업자번호를 안 가린다 — 서고가 사업장을 가르는 열쇠다 */
  assert.ok(back.markdown.includes(BRN), '★ 사업자번호까지 가렸다(기본 규칙 밖)');
  assert.ok(bytesHave(r.data, 'PK'), '가린 것도 한글(.hwpx) 파일이다');
});

test('찾은 것이 없으면 파일을 돌려주지 않는다 — 원본 그대로 담는다', async () => {
  await ready();
  const clean = H.build(H.para('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.'));
  const r = await T.redactFile(clean, '제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.');
  assert.equal(r.total, 0);
  assert.equal(r.data, null);
});

test('한글이 아닌 파일은 글만 가리고 파일은 안 돌려준다(원본을 안 담는 근거)', async () => {
  await ready();
  const pdfLike = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37, 0, 0, 0, 0]);
  const r = await T.redactFile(pdfLike, '신고인 연락처 ' + PHONE + ' 주민등록번호 ' + RRN);
  assert.equal(r.fileOk, false);
  assert.equal(r.data, null);
  assert.ok(r.total >= 2);
  assert.ok(!r.text.includes(RRN) && !r.text.includes(PHONE));
});

test('규칙 고르기 — 기본은 켜 둔 다섯 묶음, 사업자번호·이름주소는 꺼짐', () => {
  const on = T.PII_GROUPS.filter(g => g.on).map(g => g.key);
  assert.deepEqual(on, ['rrn', 'money', 'phone', 'email', 'id']);
  assert.ok(!T.rulesOf().includes('brn') && !T.rulesOf().includes('name'));
  assert.ok(T.rulesOf(['brn']).includes('brn'), '켜면 들어간다');
  assert.equal(T.countLabel({ rrn: 1, phone: 2 }), '주민 1 · 전화 2');
});
