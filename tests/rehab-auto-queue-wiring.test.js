/* 회생광고 — 새 공고 자동 «발송 예정» 연결이 끊기지 않았는가.
   지키는 것: ① 서버가 수집 결과의 새 공고(result.added)를 autoQueueMarks 로 marks 에 담는다
   ② 화면이 «기계가 올린 것»(autoQueued)을 표시하고, 사람이 다시 표시하면(setStatus·bulk) 그 표시가 풀린다
   ③ 서버 쓰기는 rehabWatch 안에서만 — 이메일·팩스 발송 경로와 섞이지 않는다
   실행: node --test tests/rehab-auto-queue-wiring.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const server = strip(read('functions/index.js'));
const page = strip(read('rehab-ad.html'));

test('① 서버: 이번 회차에 새로 담긴 공고(result.added)를 autoQueueMarks 로 marks 에 합친다', () => {
  assert.match(server, /RehabWatch\.autoQueueMarks\(\s*result\.added\s*,/);
  assert.match(server, /Object\.assign\(upd,\s*q\)/);
});

test('② 서버: 이미 있는 표시를 넘겨 «사람이 한 표시»를 덮지 않게 한다', () => {
  assert.match(server, /root\.child\("marks"\)\.once\("value"\)/);
});

test('③ 화면: autoQueued 를 읽어 표시하고, 상태를 사람이 바꾸면 autoQueued:false 로 풀린다', () => {
  assert.match(page, /MARKS\[n\.id\]\.autoQueued/);
  const setters = page.match(/autoQueued\s*:\s*false/g) || [];
  assert.ok(setters.length >= 2, '한 건 표시(setStatus)와 일괄 표시(bulk) 둘 다 풀어야 한다');
});

test('④ 자동 예정은 메일·팩스 발송 경로(rehabAutoRun)를 부르지 않는다', () => {
  const at = server.indexOf('RehabWatch.autoQueueMarks');
  const block = server.slice(at, at + 500);
  assert.ok(!/rehabAutoRun|scheduled\//.test(block), '자동 예정은 우편 라벨 표시일 뿐이다');
});
