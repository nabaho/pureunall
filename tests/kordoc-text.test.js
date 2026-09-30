/* kordoc 로 원본 읽기 (js/pu-kordoc-text.js · vendor/kordoc) — 2026-09-30 대표 「순서대로 모두」 ①
   왜: 규정관리의 예전 읽개는 표를 모르고 글을 차례로 이어 붙여, 표준취업규칙(조문 칸 | 해설 칸)의 해설이
   조문에 섞였다. 글줄 모양으로 짐작해 떼던 것(stripCommentary)을 kordoc 의 «칸 그대로» 읽기로 바꾼다.
   이 검사는 «진짜 kordoc 묶음» 을 node 에서 실어 한글 파일을 읽힌다 — 묶음이 깨지면 여기서 운다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const T = require('../js/pu-kordoc-text.js');
const H = require('../hwpx_gen.js');
const BUNDLE = path.join(root, 'vendor', 'kordoc', 'kordoc.browser.min.js');

/* 표준취업규칙 꼴 한글 파일 — 문단 + 해설판 표 + 보통 표(별표) */
function stdLikeHwpx() {
  let body = H.para('제1장 총칙') + H.para('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.');
  body += H.tablePara([
    ['취업규칙(안)', '(작성시 착안사항)'],
    ['제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.\n② 휴게시간은 자유롭게 이용할 수 있다.', '[필수] 휴게는 근로시간 도중에 준다\n☞ (참고) 4시간이면 30분 이상'],
    ['제3조(연차) 회사는 15일의 연차유급휴가를 준다.', '[선택] 연차 사용촉진을 둘 수 있음']
  ], H.cols([0.6, 0.4]));
  body += H.para('[별표] 경조휴가') + H.tablePara([['구분', '일수'], ['본인 결혼', '5일']], H.cols([0.5, 0.5]));
  return H.build(body);
}
let K = null;
async function kordoc() { if (!K) K = await import(pathToFileURL(BUNDLE).href); return K; }

test('묶음이 있고, 판번호·라이선스가 곁에 있다', () => {
  assert.ok(fs.existsSync(BUNDLE), 'vendor/kordoc/kordoc.browser.min.js 가 없다 — scripts/kordoc-browser/build.js');
  const head = fs.readFileSync(BUNDLE, 'utf8').slice(0, 200);
  const ver = fs.readFileSync(path.join(root, 'vendor', 'kordoc', 'VERSION'), 'utf8').trim();
  assert.match(head, new RegExp('kordoc ' + ver.replace(/\./g, '\\.') + ' \\(MIT'), '묶음 머리의 판번호가 VERSION 과 다르다');
  assert.ok(fs.existsSync(path.join(root, 'vendor', 'kordoc', 'LICENSE')), 'MIT 라이선스 사본이 없다');
});

test('묶음은 브라우저가 못 푸는 부품 이름을 남기지 않는다', () => {
  const s = fs.readFileSync(BUNDLE, 'utf8');
  /* import … from "fs" / import("pdfjs-dist") 처럼 경로가 아닌 이름 — 브라우저는 이걸 못 찾아 통째로 안 실린다
     (2026-09-30 시험: pdfjs-dist 한 줄 때문에 묶음 전체가 안 실렸다) */
  const bare = [...s.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"'./][^"']*)["']/g)].map(m => m[1]);
  assert.deepEqual([...new Set(bare)], [], '★ 브라우저가 못 푸는 이름: ' + [...new Set(bare)].join(', '));
});

test('진짜 kordoc 로 읽는다 — 해설판 표는 조문 칸만, 보통 표는 칸 모두, 인터넷에는 한 번도 안 닿는다', async () => {
  const K = await kordoc();
  /* 읽는 동안 인터넷에 닿는지 지켜본다 — 문서는 브라우저 밖으로 나가면 안 된다 */
  const net = [];
  const saved = globalThis.fetch;
  globalThis.fetch = (...a) => { net.push(String(a[0])); return Promise.reject(new Error('검사: 인터넷 금지')); };
  let r;
  try { r = await K.parse(stdLikeHwpx(), { ocr: false }); } finally { globalThis.fetch = saved; }
  assert.deepEqual(net, [], '★ kordoc 가 읽는 동안 인터넷에 닿았다');
  assert.equal(r.success, true, 'kordoc 가 한글 파일을 못 읽었다');
  const o = T.toText(r.blocks);
  ['제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.', '제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.',
    '② 휴게시간은 자유롭게 이용할 수 있다.', '제3조(연차) 회사는 15일의 연차유급휴가를 준다.', '본인 결혼', '5일']
    .forEach(s => assert.ok(o.text.includes(s), '★ 조문·별표 글이 빠졌다: ' + s));
  ['[필수]', '☞', '[선택]', '착안사항'].forEach(s => assert.ok(!o.text.includes(s), '★ 해설 칸이 섞였다: ' + s));
  assert.equal(o.commentaryCells, 2, '뗀 해설 칸 수를 알린다(화면 머리에 뜬다)');
  /* 제2조 두 항 뒤가 곧 제3조 — 해설이 사이에 끼면 그 조 원문에 섞인다 */
  const i = o.text.indexOf('② 휴게시간은 자유롭게');
  assert.match(o.text.slice(i).split('\n').filter(Boolean)[1], /^제3조/);
});

test('해설판 표 가려내기 — 머리 「착안사항」 또는 둘째 칸 꼬리표가 절반 넘을 때만', () => {
  const t = (rows) => ({ cols: 2, cells: rows.map(r => r.map(x => ({ text: x }))) });
  assert.equal(T.commentaryCol(t([['취업규칙(안)', '(작성시 착안사항)'], ['제1조', '뭔가']])), 1);
  assert.equal(T.commentaryCol(t([['제1조(목적)', '[필수] a'], ['제2조(휴게)', '☞ b'], ['제3조', '[선택] c']])), 1);
  assert.equal(T.commentaryCol(t([['구분', '일수'], ['본인 결혼', '5일'], ['자녀 결혼', '1일']])), -1, '★ 보통 표(별표)의 둘째 칸을 해설로 뗀다');
  assert.equal(T.commentaryCol(t([['제1조', '[필수] a'], ['제2조', '보통 글'], ['제3조', '보통 글']])), -1, '꼬리표가 절반이 안 되면 해설판이 아니다');
});

test('읽을 수 있는 파일만 — 한글(OLE2)·ZIP 은 kordoc, 나머지는 예전 읽개', async () => {
  assert.equal(T.canRead(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0])), true);
  assert.equal(T.canRead(new Uint8Array([0x50, 0x4B, 3, 4, 0, 0, 0, 0, 0])), true);
  assert.equal(T.canRead(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37, 0])), false, 'PDF 는 이 묶음에 PDF 부품이 없다');
  assert.equal(await T.read(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37, 0])), null);
});

test('규정관리 — kordoc 가 먼저 읽고, 못 읽으면 예전 읽개, 끝에 해설 그물을 한 번 더', () => {
  const html = fs.readFileSync(path.join(root, 'rules.html'), 'utf8');
  assert.match(html, /<script src="js\/pu-kordoc-text\.js\?v=\d+"><\/script>/);
  const a = html.indexOf('async function readRulesText(buf){');
  const b = html.indexOf('\n}', a);
  const f = html.slice(a, b);
  assert.ok(a > 0, 'readRulesText 를 찾지 못했다');
  assert.match(f, /PuKordocText\.read\(buf\)/);
  assert.match(f, /catch\(e\)\{[^}]*예전 읽개/, '★ kordoc 가 터지면 원본을 못 읽는다 — 예전 읽개로 돌아가야 한다');
  assert.match(f, /if\(text==null\) text=await extractDocText\(buf\)/);
  assert.match(f, /stripCommentary\(text\)/, 'kordoc 가 표로 못 잡은 해설 줄의 그물');
  /* 묶음은 쓸 때 처음 한 번만 싣는다 — 1.4MB 를 화면 열 때마다 받지 않는다 */
  assert.doesNotMatch(html, /<script[^>]+kordoc\.browser\.min\.js/);
});
