/* Antigravity 가 푸른 규칙을 읽게 한다 — 대표 지시 2026-11-08
   Antigravity 는 CLAUDE.md 를 안 읽는다. GEMINI.md(·AGENTS.md)와 작업공간 규칙 폴더 `.agents/rules/` 를 싣는다.
   이 길이 끊기면 다른 AI 가 울타리를 «모르는 채로» 넘는다(main 직접 올리기·공개 저장소에 실명·비밀). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RULE = path.join(ROOT, '.agents', 'rules', 'pureun-rules.md');

test('작업공간 규칙 파일이 있고 «늘 켜짐»이다', () => {
  assert.ok(fs.existsSync(RULE), '.agents/rules/pureun-rules.md 가 없습니다 — Antigravity 가 규칙을 안 싣습니다');
  const txt = fs.readFileSync(RULE, 'utf8');
  assert.match(txt, /^---\s*\ntrigger:\s*always_on\s*\n---/, '늘 켜짐이 아니면 Antigravity 가 상황에 따라 빼먹습니다');
});

test('★ 규칙 파일이 AGENTS.md 로 이끌고, 꼭 지킬 것을 담는다', () => {
  const txt = fs.readFileSync(RULE, 'utf8');
  assert.match(txt, /AGENTS\.md/, '규칙 전부가 있는 AGENTS.md 를 가리키지 않습니다');
  assert.match(txt, /respond in Korean/i, '한국어 대답 규칙이 없습니다');
  assert.match(txt, /main/, 'main 직접 금지가 없습니다');
  assert.match(txt, /tests\/\*\.test\.js/, '검사를 돌리라는 말이 없습니다');
  assert.match(txt, /공개/, '공개 저장소(비밀·실명 금지) 안내가 없습니다');
});

test('GEMINI.md 도 AGENTS.md 와 규칙 파일을 가리킨다', () => {
  const g = fs.readFileSync(path.join(ROOT, 'GEMINI.md'), 'utf8');
  assert.match(g, /AGENTS\.md/);
  assert.match(g, /\.agents\/rules\//);
});

test('★ Gemini·Antigravity 도 ERP 새 주소를 안다 — 옛 주소를 새 코드에 박지 않게 (2026-11-15 이사)', () => {
  /* 이 둘은 CLAUDE.md 를 안 읽는다. 여기서 빠지면 Antigravity 가 옛 코드를 흉내 내 옛 주소를 또 박는다. */
  for (const f of ['GEMINI.md', path.join('.agents', 'rules', 'pureun-rules.md')]) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(t, /erp\.pureunlabor\.co\.kr/, f + ' 에 ERP 새 주소가 없다');
    assert.match(t, /erp-origins\.js/, f + ' 에 서버 주소 한 자리(functions/erp-origins.js) 안내가 없다');
    assert.match(t, /ERP-주소\.md/, f + ' 가 자세한 문서(docs/규칙/ERP-주소.md)를 안 가리킨다');
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'docs', '규칙', 'ERP-주소.md')), '가리키는 문서가 실제로 있어야 한다');
});

test('규칙 폴더는 배포본에서 지워진다 — 개발용이다', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
  assert.match(wf, /\s\.agents\s/, '배포에서 .agents 를 지우지 않으면 규칙 파일이 인터넷에 열립니다');
});
