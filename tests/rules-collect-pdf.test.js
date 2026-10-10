/* PDF 글 뽑기 (설계 §11-1) — 줄 다시 세우기는 순수 검사로 늘 돌고, 실제 PDF 검사는 pdf.js 가 있을 때만.
   ★ 못 박는 규칙: 같은 높이 조각은 한 줄 · 틈이 있으면 빈칸 · 위에서 아래 · 쪽은 빈 줄 · 「제N조」가 줄 머리 · 글 없으면 스캔 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const P = require('../functions/rules-collect-pdf.js');
const { makePdf } = require('./pdf-gen.js');
const HAS_PDFJS = (() => {
  try { require.resolve('pdfjs-dist/package.json', { paths: [path.join(__dirname, '../functions')] }); return true; }
  catch (_) { return false; }
})();
const it = (s, x, y, w, page) => ({ str: s, x, y, w: w == null ? s.length * 6 : w, h: 12, page: page || 1 });

test('linesOf — 같은 높이는 한 줄, 왼쪽부터, 틈이 있으면 빈칸', () => {
  const t = P.linesOf([it('목적)', 70, 800, 30), it('제1조(', 40, 801, 30), it('이 규칙은', 120, 800, 50)]);
  assert.equal(t, '제1조(목적) 이 규칙은');
});

test('linesOf — 위에서 아래, 「제N조」가 줄 머리에 온다', () => {
  const t = P.linesOf([it('제2조(정의)', 40, 760), it('제1조(목적)', 40, 800), it('사원이란 …', 40, 740)]);
  assert.deepEqual(t.split('\n'), ['제1조(목적)', '제2조(정의)', '사원이란 …']);
  assert.ok((t.match(/(^|\n)제\s*\d+\s*조/g) || []).length >= 2);
});

test('linesOf — 쪽은 빈 줄로 가른다, 빈 조각은 버린다', () => {
  const t = P.linesOf([it('둘째 쪽', 40, 800, null, 2), it('첫 쪽', 40, 800, null, 1), it('', 40, 700, 0, 1)]);
  assert.deepEqual(t.split('\n'), ['첫 쪽', '', '둘째 쪽']);
});

test('실제 PDF — 줄마다 뽑고 셈을 돌려준다', { skip: !HAS_PDFJS && 'pdfjs-dist 없음' }, async () => {
  const buf = makePdf([[{ x: 40, y: 800, s: 'Article 1 (Purpose)' }, { x: 40, y: 780, s: 'Article 2 (Definitions)' }],
    [{ x: 40, y: 800, s: 'Page two text 900101-1234567' }]]);
  const r = await P.pdfText(buf);
  assert.equal(r.pages, 2);
  assert.equal(r.truncated, false);
  const lines = r.text.split('\n');
  assert.ok(lines.indexOf('Article 1 (Purpose)') >= 0 && lines.indexOf('Article 2 (Definitions)') > lines.indexOf('Article 1 (Purpose)'));
  assert.ok(r.text.includes('900101-1234567'), '뽑기는 가리지 않는다 — 가리기는 redactOne 몫');
  assert.ok(r.chars >= P.SCAN_MIN);
});

test('실제 PDF — 글 없는 쪽은 셈이 스캔 한도 밑', { skip: !HAS_PDFJS && 'pdfjs-dist 없음' }, async () => {
  const r = await P.pdfText(makePdf([[]]));
  assert.ok(r.chars < P.SCAN_MIN);
});

test('pdf.js 자료 폴더(cmaps·standard_fonts)가 없으면 못 실음(PDFJS_MISSING) — 한글 PDF 가 「글 없음」으로 닫히면 안 된다', { skip: !HAS_PDFJS && 'pdfjs-dist 없음' }, async () => {
  const fs = require('node:fs');
  const real = fs.existsSync;
  for (const sub of ['cmaps', 'standard_fonts']) {
    fs.existsSync = (p) => (String(p).replace(/[\\/]+$/, '').endsWith(sub) ? false : real(p));
    try { await assert.rejects(() => P.load(), (e) => e.code === 'PDFJS_MISSING', sub); }
    finally { fs.existsSync = real; }
  }
  assert.ok(await P.load(), '자료가 있으면 싣는다');
});

test('실제 PDF — 깨진 파일은 던진다', { skip: !HAS_PDFJS && 'pdfjs-dist 없음' }, async () => {
  /* 깨진 문서는 pdf.js 의 문서 오류 이름(InvalidPDFException)으로 던진다 — redactOne 이 이 이름만 「열지 못함」으로 닫는다 */
  await assert.rejects(() => P.pdfText(Buffer.from('%PDF-1.7 not really')), (e) => e.name === 'InvalidPDFException');
});
