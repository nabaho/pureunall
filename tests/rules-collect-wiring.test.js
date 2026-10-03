/* 배선 — 글자로 본다(네트워크를 못 돌리므로). 행동은 rules-collect-run 이 가짜로 돌려 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\'"])\/\/.*$/gm, '$1');
const IDX = strip(fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8'));
const fnOf = (name) => { const i = IDX.indexOf('exports.' + name); assert.ok(i >= 0, name + ' 없음');
  const j = IDX.indexOf('\nexports.', i + 10); return IDX.slice(i, j > i ? j : IDX.length); };

test('매일 새벽 5시(서울), 메일 비밀번호, 9분·1GB', () => {
  const f = fnOf('collectRulesMail');
  assert.match(f, /\.pubsub\.schedule\(["']every day 05:00["']\)/);
  assert.match(f, /\.timeZone\(["']Asia\/Seoul["']\)/);
  assert.match(f, /DAUM_MAIL_PASSWORD/);
  assert.match(f, /timeoutSeconds:\s*540/);
});

test('관리자 「지금 더 모으기」는 DB 신호 — 새 공개 HTTPS 함수가 아니다', () => {
  const f = fnOf('collectRulesMailAsk');
  assert.match(f, /\.database\s*\.ref\(["']\/rules_mgmt\/library\/ask\/\{id\}["']\)\s*\.onCreate/);
  assert.doesNotMatch(f, /onRequest/);
});

test('둘 다 한 몸통을 쓴다 — 창고는 hrphotos', () => {
  assert.match(fnOf('collectRulesMail'), /rulesCollectOnce\(/);
  assert.match(fnOf('collectRulesMailAsk'), /rulesCollectOnce\(/);
  const i = IDX.indexOf('async function rulesCollectOnce');
  assert.ok(i >= 0);
  assert.match(IDX.slice(i, i + 1500), /PHOTO_BUCKET/);
  assert.match(IDX.slice(i, i + 1500), /systemAlerts\//, '사흘 알림이 없다');
});

test('첨부 받기 — 쓰기 명령이 없다(DELE·지우기·옮기기)', () => {
  const M = strip(fs.readFileSync(path.join(__dirname, '../functions/rules-collect-mail.js'), 'utf8'));
  assert.doesNotMatch(M, /DELE|messageDelete|messageMove|messageFlagsAdd|write:\s*true/);
  assert.match(M, /RETR /);
  assert.match(M, /ATT_MAX/);
});
