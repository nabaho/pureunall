'use strict';
/* 공용 한글 엔진 — 편집기는 «저장소 안» 것만 (2026-10-03 발견·고침)
   ■ 무엇이었나
     PureunHwp.createEditor 의 기본값이 esm.sh 의 @rhwp/editor 였고 studioUrl 을 안 줘서,
     studio 기본 주소(https://edwardkim.github.io/rhwp/)로 문서가 통째로 갔다.
     이 길을 탄 곳: 문서관리 집단체불 「한글로 채워 보기」(근로자 주민번호·계좌가 든 문서),
     이알피 계약서 첨부 편집기. 기금관리(2026-09-21)·경력관리는 따로 고쳐 두었었다.
   ■ 지금
     createEditor 가 vendor/rhwp-editor 를 부르고 studioUrl 을 vendor/rhwp-studio 로 박는다.
     설정(localStorage·PUREUN_HWP_CONFIG·extra)으로도 주소를 바꾸지 못한다.
   node --test tests/hwp-engine-local-editor.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const ENG = fs.readFileSync(path.join(R, 'js/pu-hwp-engine.js'), 'utf8').replace(/\r\n/g, '\n');
const bare = ENG.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

test('★★★ 공용 엔진에 남의 편집기·studio 주소가 없다', () => {
  assert.ok(!/esm\.sh|edwardkim\.github\.io/.test(bare), '엔진 코드에 남의 주소가 있습니다 — 서류가 밖으로 나갑니다');
  assert.ok(!/editorUrl/.test(bare), '편집기 주소를 설정으로 바꿀 길이 남아 있습니다');
});
test('★★★ createEditor 는 저장소 안 편집기 + 우리 studio 를 부른다', () => {
  const f = cutFn(bare, 'function createEditor(');
  assert.match(f, /LOCAL_EDITOR/);
  assert.match(f, /studioUrl: LOCAL_STUDIO/);
  assert.match(bare, /var LOCAL_EDITOR = 'vendor\/rhwp-editor\/index\.js'/);
  assert.match(bare, /var LOCAL_STUDIO = 'vendor\/rhwp-studio\/index\.html'/);
  assert.ok(!/config\(/.test(f), 'createEditor 가 설정을 읽습니다 — 주소를 바꿀 수 있게 됩니다');
});
test('저장소 안 편집기 파일이 실제로 있다', () => {
  assert.ok(fs.existsSync(path.join(R, 'vendor/rhwp-editor/index.js')));
  assert.ok(fs.existsSync(path.join(R, 'vendor/rhwp-studio/index.html')));
});
test('화면들도 남의 편집기 주소를 직접 부르지 않는다', () => {
  fs.readdirSync(R).filter(n => /\.html$/.test(n)).forEach(n => {
    const h = fs.readFileSync(path.join(R, n), 'utf8').replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
    assert.ok(!/esm\.sh\/@rhwp\/editor|edwardkim\.github\.io\/rhwp/.test(h), n + ' 가 남의 편집기 주소를 부릅니다');
  });
});
