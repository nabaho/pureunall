/* fund.html — 서식을 「남의 주소」로 보내지 않는다 (2026-09-21 발견·고침)

   ■ 무엇이었나
     openHwpEditor() 가 PureunHwp.createEditor(esm.sh 의 @rhwp/editor)를 studioUrl 없이
     불렀다 — 기본값이 https://edwardkim.github.io/rhwp/ 라, 「📄 HWP 편집」을 열 때마다
     설립인가신청서·정관·등기 서류가 통째로 그 주소로 갔다. 2026-07-26(이 기능이 생긴 날)
     부터 오늘까지 그 상태였다.

   ■ 게다가 얻는 것이 없었다 (같은 날 kcareer.html 쪽에서 실측)
     그 편집기는 getSelectionContext 가 editable:false 를 준다 — 읽기 전용이다. 위험만
     있고 편집은 안 되는 길이었다.

   ■ 지금
     kcareer.html 이 먼저 잡은 것과 같은 길로 고쳤다 — 저장소 안 편집기
     (vendor/rhwp-editor/index.js + vendor/rhwp-studio, studioUrl 을 우리 것으로 줌)를
     직접 부른다. 실패하면 PureunHwp.renderPreview(읽기전용, 안전)로 물러난다.

   node --test tests/fund-hwp-no-external-editor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');

const source = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const bare = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

test('★★★ 서식을 남의 주소로 보내지 않는다 — 인가·등기 서류가 든 파일이다', () => {
  /* ⚠ 이 중 하나라도 되살아나면 서류가 다시 밖으로 나간다.
     ⚠ 주석이 아니라 «코드»를 본다(bare) — 설명이 검사를 깨뜨리면 다음 사람이
       설명을 지우고 넘어가기 쉽다. */
  assert.doesNotMatch(bare, /PureunHwp\.createEditor/,
    '★ 이 한 줄이 밖으로 나가는 «유일한» 길이었습니다 — 되살리지 마세요');
  assert.doesNotMatch(bare, /esm\.sh\/@rhwp\/editor/, '★ esm.sh 에서 편집기를 받아오면 안 됩니다');
  assert.doesNotMatch(bare, /RHWP_EDITOR_URL/, '★ 옛 손잡이(외부 주소 변수)가 되살아났습니다');
  assert.doesNotMatch(bare, /edwardkim/i, '★ 남의 주소로 iframe 을 띄우면 안 됩니다');
});

test('★★ 편집기는 저장소 안(vendor/rhwp-editor)에서 studioUrl 을 우리 것으로 준다', () => {
  const fn = cutFn(bare, 'function openHwpEditor(');
  assert.match(fn, /import\(\s*['"]\.\/vendor\/rhwp-editor\/index\.js['"]\s*\)/,
    '★ 저장소 안 편집기 모듈을 안 부릅니다.');
  assert.match(fn, /studioUrl\s*:\s*['"]vendor\/rhwp-studio\/index\.html['"]/,
    '★ studioUrl 을 우리 것으로 안 줍니다 — 빠지면 남의 서버 기본값으로 돌아갑니다.');
  assert.match(fn, /renderer\s*:\s*['"]canvas2d['"]/,
    '★ renderer 를 안 정합니다 — 없는 canvaskit 을 찾다가 실패합니다(저장소에 안 넣었습니다).');
  assert.match(fn, /editor\.loadFile\(/, '★ 편집기에 문서를 안 불러옵니다.');
  assert.match(fn, /PureunHwp\.renderPreview\(/, '★ 편집기가 안 열릴 때 물러날 자리(읽기전용 미리보기)가 없습니다.');
});

test('★★ 편집기·저장(exportFrom)·닫기는 그대로 이어진다 — RhwpEditor 가 같은 모양을 준다', () => {
  const open = cutFn(bare, 'function openHwpEditor(');
  assert.match(open, /_hwpEditor\s*=\s*editor/, '★ 연 편집기를 _hwpEditor 에 안 담습니다 — 저장·닫기가 못 찾습니다.');
  const exp = cutFn(bare, 'function hwpExport(');
  assert.match(exp, /PureunHwp\.exportFrom\(_hwpEditor,fmt\)/, '★ 저장 길이 바뀌었습니다.');
  const close = cutFn(bare, 'function closeHwp(');
  assert.match(close, /_hwpEditor\.destroy\(\)/, '★ 닫을 때 편집기를 안 치웁니다 — iframe 이 남습니다.');
});

test('★ 공용 모듈(js/pu-hwp-engine.js)은 건드리지 않았다 — 다른 앱이 함께 쓴다', () => {
  const eng = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-hwp-engine.js'), 'utf8');
  assert.match(eng, /editorUrl/, '★ 공용 모듈은 그대로 남아 있어야 합니다(fund.html 이 이제 그 길을 안 부를 뿐).');
});

test('★ vendor/rhwp-editor·vendor/rhwp-studio 가 실제로 저장소에 있다', () => {
  const R = path.join(__dirname, '..');
  assert.ok(fs.existsSync(path.join(R, 'vendor', 'rhwp-editor', 'index.js')), '★ 편집기 모듈 파일이 없습니다.');
  assert.ok(fs.existsSync(path.join(R, 'vendor', 'rhwp-studio', 'index.html')), '★ studio 파일이 없습니다.');
});
