/* 회생광고 — 「보낸 기록」 연결이 끊기지 않았는가 (2026-11-07 대표: 보낸 것들 언제 보냈는지 기록·확인).
   지키는 것: ① 예약 발송기가 «나간 뒤» 기록을 남기고, 실패도 남긴다 ② 기록 함수는 절대 던지지 않는다(발송 흐름을 깨면 안 된다)
   ③ 자동 메일(by:"rehab-auto")만 기록한다 ④ 화면이 기록 모아 보기를 열고 자동 보낸 기록을 읽는다
   실행: node --test tests/rehab-sent-log-wiring.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const server = strip(read('functions/index.js'));
const page = strip(read('rehab-ad.html'));

test('① 발송기: 나간 뒤(ref.remove 다음)에 기록을 남기고, 실패 두 갈래에서도 남긴다', () => {
  const at = server.indexOf('exports.sendScheduledMail');
  const body = server.slice(at, at + 6500);
  const rm = body.indexOf('await ref.remove()');
  const sentCall = body.indexOf('rehabAutoNote(db, id, row, "sent")');
  assert.ok(rm > 0 && sentCall > rm, '메일이 나간 «뒤에» 기록해야 한다(앞이면 안 나간 메일이 기록된다)');
  const failed = body.match(/rehabAutoNote\(db, id, row, "failed"/g) || [];
  assert.ok(failed.length >= 2, '실패 두 갈래(결과 실패·예외)에서 모두 남겨야 한다');
});

test('② 기록 함수는 통째로 try/catch — 던지지 않는다', () => {
  const at = server.indexOf('async function rehabAutoNote');
  assert.ok(at > 0);
  const fn = server.slice(at, at + 1400);
  assert.match(fn.slice(0, 60), /async function rehabAutoNote/);
  assert.match(fn, /try \{[\s\S]*\} catch \(e\) \{ console\.warn\(/);
});

test('③ 회생광고 자동 메일(by:"rehab-auto")만 기록한다', () => {
  const at = server.indexOf('async function rehabAutoNote');
  const fn = server.slice(at, at + 600);
  assert.match(fn, /row\.by !== "rehab-auto"\) return/);
});

test('④ 화면: 기록 모아 보기 — 단추·팝업·자동 보낸 기록 읽기·줄 눌러 상세로', () => {
  assert.match(page, /onclick="openLogs\(\)"/);
  assert.match(page, /id="logModal"/);
  assert.match(page, /ref\('rehab_ad\/auto\/sent'\)/);
  assert.match(page, /\$\('lgBody'\)\.addEventListener\('click'/);
});

test('⑤ 화면: 상세 패널의 발송 기록 줄에 시각(t)과 자동(auto) 표시가 나온다', () => {
  assert.match(page, /o\.x\.t\?/);
  assert.match(page, /o\.x\.auto\?/);
});
