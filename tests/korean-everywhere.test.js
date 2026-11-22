/* 「대답은 늘 한국어로」 (대표 지시 2026-11-07) 를 지킨다.
   ① 저장소: CLAUDE.md(Claude)·AGENTS.md(Codex·Copilot)·GEMINI.md(Gemini CLI·Antigravity) 모두에 규칙이 있고,
      .claude/settings.json 에 응답 언어가 걸려 있다.
   ② 개인설정 스크립트(scripts/korean-everywhere.js): 보기는 아무것도 안 쓰고, --apply 는 원본을 남기고,
      다른 설정을 지우지 않고, 여러 번 돌려도 같고, 깨진 JSON 은 덮어쓰지 않는다.
   실행: node --test tests/korean-everywhere.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'korean-everywhere.js');
const { MARKER, LANGUAGE, BLOCK_LINES } = require(SCRIPT);

function tmpHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ko-home-')); }
function run(home, ...args) {
  const env = { ...process.env };
  delete env.CODEX_HOME;
  return spawnSync(process.execPath, [SCRIPT, '--home', home, ...args], { env, encoding: 'utf8' });
}
function files(dir) {
  const out = [];
  (function walk(d) {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) walk(p); else out.push(path.relative(dir, p));
    }
  })(dir);
  return out.sort();
}
const claudeSettings = (h) => path.join(h, '.claude', 'settings.json');
const claudeMd = (h) => path.join(h, '.claude', 'CLAUDE.md');
const geminiMd = (h) => path.join(h, '.gemini', 'GEMINI.md');
const codexMd = (h) => path.join(h, '.codex', 'AGENTS.md');

test('① 세 지침 파일 모두에 「한국어로 대답」 규칙이 있다', () => {
  for (const f of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) {
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(txt, /respond in Korean/i, `${f} 에 한국어 대답 규칙이 없습니다`);
  }
});

test('① 저장소 Claude Code 설정에 응답 언어가 걸려 있다', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  assert.equal(cfg.language, LANGUAGE);
});

test('② 보기는 아무것도 쓰지 않는다', () => {
  const h = tmpHome();
  const r = run(h);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(files(h), []);
});

test('② --apply: 빈 컴퓨터에 세 도구 설정을 만든다', () => {
  const h = tmpHome();
  const r = run(h, '--apply');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(fs.readFileSync(claudeSettings(h), 'utf8')).language, LANGUAGE);
  assert.ok(fs.readFileSync(claudeMd(h), 'utf8').includes(MARKER), 'Claude 전역 지침(~/.claude/CLAUDE.md)에도 넣어야 합니다');
  assert.ok(fs.readFileSync(geminiMd(h), 'utf8').includes(MARKER));
  assert.ok(fs.readFileSync(codexMd(h), 'utf8').includes(MARKER));
});

test('② Claude 전역 지침은 «맨 앞»에 넣고 원래 글은 뒤에 그대로 둔다 (2026-11-22 «가끔 영어로 나온다»)', () => {
  const h = tmpHome();
  fs.mkdirSync(path.dirname(claudeMd(h)), { recursive: true });
  const orig = '# 내 작업 흐름\r\n\r\n- 규칙 하나\r\n';
  fs.writeFileSync(claudeMd(h), orig);
  assert.equal(run(h, '--apply').status, 0);
  const t = fs.readFileSync(claudeMd(h), 'utf8');
  assert.ok(t.startsWith(MARKER), '단락이 맨 앞에 와야 합니다');
  assert.ok(t.endsWith('\r\n' + orig), '원래 글이 빈 줄 하나 뒤에 그대로 있어야 합니다');
  assert.ok(!/[^\r]\n/.test(t), 'CRLF 파일에 LF 줄이 섞였습니다');
  // 단락은 «어떤 상황에서도» 를 말한다 — 요약 뒤·영어 자료 뒤에도 영어 문장으로 답하지 않는다
  const block = BLOCK_LINES.join('\n');
  assert.match(block, /respond in Korean/i);
  assert.match(block, /요약/);
  assert.match(block, /영어 문장으로 답하지 않는다/);
});

test('② 예전 글의 단락은 «그 자리»에서 새 글로 바꾸고, 다른 글은 건드리지 않는다', () => {
  const h = tmpHome();
  fs.mkdirSync(path.dirname(geminiMd(h)), { recursive: true });
  // 2026-11-07 판이 넣은 단락(두 줄) 뒤에 사람이 쓴 글이 이어진다
  const old = ['# 내 규칙', '', MARKER, '## 대답 언어', '- 예전 줄 하나', '- 예전 줄 둘', '', '## 내 다른 절', '- 그대로 둘 것', ''].join('\n');
  fs.writeFileSync(geminiMd(h), old);
  assert.equal(run(h, '--apply').status, 0);
  const t = fs.readFileSync(geminiMd(h), 'utf8');
  assert.ok(!t.includes('예전 줄'), '예전 단락이 남았습니다');
  assert.equal(t.split(MARKER).length, 2, '단락이 두 번 들어갔습니다');
  assert.ok(t.startsWith('# 내 규칙\n\n' + BLOCK_LINES.join('\n') + '\n\n## 내 다른 절\n- 그대로 둘 것\n'), '자리·앞뒤 글이 바뀌었습니다');
  assert.ok(files(h).some((f) => /GEMINI\.md\.bak-/.test(f)), '원본을 남겨야 합니다');
  const snap = fs.readFileSync(geminiMd(h), 'utf8');
  run(h, '--apply');
  assert.equal(fs.readFileSync(geminiMd(h), 'utf8'), snap, '두 번째에는 그대로여야 합니다');
});

test('② 줄바꿈이 섞인 파일(단락은 LF, 다른 곳은 CRLF)도 예전 단락을 찾아 바꾸고, 줄마다 제 줄바꿈을 지킨다', () => {
  const h = tmpHome();
  fs.mkdirSync(path.dirname(codexMd(h)), { recursive: true });
  // 이 PC 의 ~/.codex/AGENTS.md 가 실제로 이런 모양이었다 (2026-11-22)
  const head = '﻿' + [MARKER, '## 대답 언어', '- 예전 줄 하나', '- 예전 줄 둘', ''].join('\n') + '\n';
  const tail = '## 다른 도구 절\r\n- 그대로 둘 것\r\n';
  fs.writeFileSync(codexMd(h), head + tail);
  assert.equal(run(h, '--apply').status, 0);
  const t = fs.readFileSync(codexMd(h), 'utf8');
  assert.equal(t, '﻿' + BLOCK_LINES.join('\n') + '\n\n' + tail);
});

test('② --apply: 다른 설정·원래 글은 그대로 두고, 원본을 .bak 으로 남긴다', () => {
  const h = tmpHome();
  fs.mkdirSync(path.dirname(claudeSettings(h)), { recursive: true });
  const orig = { hooks: { Stop: [] }, model: 'x' };
  fs.writeFileSync(claudeSettings(h), '﻿' + JSON.stringify(orig, null, 2));
  fs.mkdirSync(path.dirname(geminiMd(h)), { recursive: true });
  fs.writeFileSync(geminiMd(h), '# 내 규칙\r\n- 짧게\r\n');

  assert.equal(run(h, '--apply').status, 0);
  const cfg = JSON.parse(fs.readFileSync(claudeSettings(h), 'utf8'));
  assert.deepEqual({ ...cfg, language: undefined }, { ...orig, language: undefined }, '다른 열쇠가 바뀌었습니다');
  assert.equal(cfg.language, LANGUAGE);

  const g = fs.readFileSync(geminiMd(h), 'utf8');
  assert.ok(g.startsWith('# 내 규칙\r\n- 짧게\r\n'), '원래 글이 앞에 그대로 있어야 합니다');
  assert.ok(g.includes(MARKER));
  assert.ok(!/[^\r]\n/.test(g), 'CRLF 파일에 LF 줄이 섞였습니다');

  const baks = files(h).filter((f) => /\.bak-/.test(f));
  assert.ok(baks.length >= 2, '바꾼 파일마다 원본이 남아야 합니다');
});

test('② 두 번 돌려도 같다 — 이미 들어 있으면 건드리지 않는다', () => {
  const h = tmpHome();
  run(h, '--apply');
  const snap = files(h).map((f) => [f, fs.readFileSync(path.join(h, f), 'utf8')]);
  assert.equal(run(h, '--apply').status, 0);
  assert.deepEqual(files(h).map((f) => [f, fs.readFileSync(path.join(h, f), 'utf8')]), snap);
});

test('② 깨진 settings.json 은 덮어쓰지 않고 실패로 알린다', () => {
  const h = tmpHome();
  fs.mkdirSync(path.dirname(claudeSettings(h)), { recursive: true });
  fs.writeFileSync(claudeSettings(h), '{ "hooks": ');
  const r = run(h, '--apply');
  assert.notEqual(r.status, 0);
  assert.equal(fs.readFileSync(claudeSettings(h), 'utf8'), '{ "hooks": ');
});

test('② Codex 는 AGENTS.override.md 가 있으면 그쪽에 넣는다(그것만 읽으므로)', () => {
  const h = tmpHome();
  const ov = path.join(h, '.codex', 'AGENTS.override.md');
  fs.mkdirSync(path.dirname(ov), { recursive: true });
  fs.writeFileSync(ov, '# 덮어쓰기\n');
  run(h, '--apply');
  assert.ok(fs.readFileSync(ov, 'utf8').includes(MARKER));
  assert.ok(!fs.existsSync(codexMd(h)));
});
