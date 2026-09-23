const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');
const ai = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-ai-call.js'), 'utf8');
const dr = fs.readFileSync(path.join(__dirname, '..', 'functions', 'doc-read.js'), 'utf8');

test('뉴스레터가 공용 AI 호출기를 싣고 news 사용량으로 센다', () => {
  assert.match(html, /js\/pu-ai-call\.js\?v=\d+/);
  assert.match(html, /app:'news'/);
  assert.match(ai, /body\.app = String\(opts\.app\)/);
  assert.match(dr, /"news"/);
});

test('AI 결과는 초안에만 담겨 곧바로 발송되지 않는다', () => {
  assert.match(html, /것\[i\]\.AI초안=t/);
  assert.ok(!/것\[i\]\.우리말=t/.test(html));
  /* ⚠ 2026-09-20: 딱지 글귀가 「AI 초안 — 검토 필요」에서
       「AI 초안 — 옮기면 이 글이 나갑니다」로 바뀌었다(안 써도 원문이 나가게 되어,
       「검토 필요」가 「안 그러면 안 나간다」로 잘못 읽혔다).
     ★ 글귀가 아니라 «AI 것임을 밝히는가»를 본다 — 다음에 또 다듬어도 산다. */
  assert.match(html, /AI 초안 —/, 'AI 가 쓴 것임을 딱지가 안 밝힌다');
});

test('사람이 상세 창에서 저장해야 우리말로 승격된다', () => {
  assert.match(html, /x\.우리말\|\|x\.AI초안/);
  assert.match(html, /x\.우리말 = v; delete x\.AI초안/);
  assert.match(html, /각 기사를 눌러 사실을 확인하고 저장/);
});
