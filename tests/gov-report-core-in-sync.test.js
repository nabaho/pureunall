'use strict';
/* 📮 컨설팅보고서 «받은 메일 서류 자동 처리» — 서버가 쓰는 순수 모듈 사본이 화면 원본과 «한 글자까지» 같다 (2026-10-22, 계획 docs/superpowers/plans/2026-10-22-gov-report-auto.md Task 2)
   ★ 서버 배포에는 js/ 가 안 올라간다 — 사본(functions/gov-report-core/)은 scripts/sync-gov-report-core.js 가 만든다(손으로 고치지 않는다).
   ★ 사본 폴더 안에서 require('./…') 가 그대로 풀려야 한다 — 모듈들이 옆 파일을 같은 폴더에서 찾기 때문.
   ★ 옮길 것 목록은 «고정 목록»이 아니라 pu-gov-report-auto.js 에서 require 를 따라간 결과와 같아야 한다 — js/ 쪽에 새 require 가 생기면 여기서 걸린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { 옮길것, 따라가기, 시작 } = require('../scripts/sync-gov-report-core.js');

const 뿌리 = path.join(__dirname, '..');
const 사본폴더 = path.join(뿌리, 'functions', 'gov-report-core');
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('★ 옮길 것 = pu-gov-report-auto.js 에서 require 를 따라간 모든 파일(빠짐없이)', () => {
  assert.equal(시작, 'pu-gov-report-auto.js');
  assert.ok(옮길것.includes(시작));
  assert.deepEqual([...옮길것].sort(), 따라가기(path.join(뿌리, 'js'), 시작).sort(), '고정 목록이 따라간 결과와 다릅니다 — node scripts/sync-gov-report-core.js');
  /* 따라가기 자체가 제대로 걷는지 — 알려진 옆 모듈들이 들어 있다(inbox→build→pu-gov-report, docs→track, send, nav, pu-co-thread) */
  ['pu-gov-report.js', 'pu-gov-report-build.js', 'pu-gov-report-docs.js', 'pu-gov-report-track.js', 'pu-gov-report-inbox.js', 'pu-gov-report-send.js',
    'pu-gov-report-nav.js', 'pu-co-thread.js'].forEach((f) => assert.ok(옮길것.includes(f), f + ' 가 빠졌다'));
});

test('★ 서버 사본은 화면 원본과 한 글자까지 같다 — 다르면 화면과 서버가 서로 다른 업체 서류에 쓴다', () => {
  옮길것.forEach((이름) => {
    const 사본 = path.join(사본폴더, 이름);
    assert.ok(fs.existsSync(사본), 이름 + ' 사본이 없다 — node scripts/sync-gov-report-core.js 를 돌려 주세요');
    assert.ok(읽기(path.join(뿌리, 'js', 이름)) === 읽기(사본),
      '★ functions/gov-report-core/' + 이름 + ' 가 js/ 원본과 다릅니다 — 고칠 곳은 js/ 쪽, 고친 뒤 node scripts/sync-gov-report-core.js');
  });
});

test('사본 폴더에는 «옮길 것» 말고 다른 파일이 없다(낡은 사본이 남아 서버가 다른 판을 쓰는 것 방지)', () => {
  assert.deepEqual(fs.readdirSync(사본폴더).sort(), [...옮길것].sort());
});

test('사본 폴더 안에서 require 가 모두 풀린다 · 사본의 PuGovReportAuto 가 화면 원본과 같은 결과를 낸다', () => {
  /* 사본 쪽에서 따라가도 같은 집합 — 폴더 밖(js/)을 가리키는 require 가 없다 */
  assert.deepEqual(따라가기(사본폴더, 시작).sort(), [...옮길것].sort());
  const Auto = require(path.join(사본폴더, 'pu-gov-report-auto.js'));
  const Orig = require('../js/pu-gov-report-auto.js');
  ['plan', 'pickKey', 'stepOf', 'usable'].forEach((f) => assert.equal(typeof Auto[f], 'function', f));
  assert.equal(Auto.AUTO_BY, Orig.AUTO_BY);
  assert.equal(Auto.MAX_ACTIONS, Orig.MAX_ACTIONS);
  /* 같은 입력 → 같은 결과(오늘 날짜 꼴이 아니면 «날짜 오류» 로 멈춘다 — 두 벌이 같은 길을 탄다) */
  assert.deepEqual(Auto.plan({ today: 'x' }), Orig.plan({ today: 'x' }));
  /* 서버 실행기는 사본 폴더의 것을 부른다 — js/ 를 가리키지 않는다 */
  const run = 읽기(path.join(뿌리, 'functions', 'gov-report-auto.js'));
  assert.match(run, /require\("\.\/gov-report-core\/pu-gov-report-auto\.js"\)/);
  assert.match(run, /require\("\.\/gov-report-core\/pu-gov-report-track\.js"\)/);
  assert.doesNotMatch(run, /require\([^)]*\.\.\/js\//, '서버 코드가 ../js/ 를 부르면 배포 때 없다');
});

test('배포에 사본 폴더가 빠지지 않는다 — firebase.json functions 에 ignore 가 없고 package.json 에 files 목록이 없다 · git 이 무시하지 않는다', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(뿌리, 'firebase.json'), 'utf8'));
  assert.equal(fb.functions.source, 'functions');
  assert.equal(fb.functions.ignore, undefined, 'functions.ignore 가 있으면 사본 폴더가 빠지는지 다시 봐야 한다');
  const pk = JSON.parse(fs.readFileSync(path.join(뿌리, 'functions', 'package.json'), 'utf8'));
  assert.equal(pk.files, undefined, 'package.json files 목록이 있으면 사본 폴더를 넣어야 한다');
  const ig = ['.gitignore', path.join('functions', '.gitignore')].map((f) => path.join(뿌리, f)).filter(fs.existsSync).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(ig, /gov-report-core/, '사본 폴더를 git 이 무시하면 서버에 안 올라간다');
});

test('다른 사본 규칙과 부딪히지 않는다 — vendor 의 «바이트까지 같아야» 검사(gov-feed 3벌)는 vendor 폴더 파일만 본다 · 같은 낱말을 두 폴더에 두지 않는다', () => {
  const vendor = fs.readdirSync(path.join(뿌리, 'functions', 'vendor'));
  옮길것.forEach((f) => assert.ok(!vendor.includes(f), f + ' 가 vendor 에도 있다'));
  ['mail-fill-core', 'mgr-watch-core', 'news-lib', 'kakao-lib'].forEach((d) => {
    const 안 = fs.readdirSync(path.join(뿌리, 'functions', d));
    옮길것.forEach((f) => assert.ok(!안.includes(f), f + ' 가 ' + d + ' 에도 있다'));
  });
});
