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
const { MARKER, LANGUAGE } = require(SCRIPT);

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
  assert.ok(fs.readFileSync(geminiMd(h), 'utf8').includes(MARKER));
  assert.ok(fs.readFileSync(codexMd(h), 'utf8').includes(MARKER));
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
