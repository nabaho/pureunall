const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

test('fund management loads the shared HWP engine before its application code', () => {
  const engineAt = source.indexOf('js/pu-hwp-engine.js');
  const appAt = source.indexOf('<script>', engineAt);
  assert.ok(engineAt >= 0 && appAt > engineAt);
});

test('single and bulk HWP registration validate files before IndexedDB storage', () => {
  assert.match(source, /PureunHwp\.validate\(rd\.result,file\.name\)/);
  assert.match(source, /PureunHwp\.validate\(rd\.result,p\[1\]\.name\)/);
});

/* ★ 2026-09-21 「서류가 밖으로 안 나간다」 — PureunHwp.createEditor(esm.sh 의 @rhwp/editor)는
   studioUrl 을 안 주면 https://edwardkim.github.io/rhwp/ 로 문서를 통째로 보낸다(실측·고침은
   tests/fund-hwp-no-external-editor.test.js). 여기서는 그 자리에 무엇이 «남아 있어야» 하는지만
   본다 — «없어야 하는» 검사는 저 파일이 맡는다(코드가 바뀔 때마다 두 파일이 같이 깨지면
   다음 사람이 설명을 지우고 넘어가기 쉽다). */
test('editing has preview and original-download fallbacks', () => {
  assert.match(source, /PureunHwp\.renderPreview/);
  assert.match(source, /function hwpDownloadOriginal\(\)/);
});

test('the HWP modal has a narrow-screen layout', () => {
  assert.match(source, /@media\(max-width:700px\)/);
  assert.match(source, /hwpData\{display:none\}/);
  assert.match(source, /flex-wrap:wrap/);
});
