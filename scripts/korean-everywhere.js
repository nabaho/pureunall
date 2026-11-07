#!/usr/bin/env node
/* 내 컴퓨터의 AI 코딩 도구가 «늘 한국어로» 대답하게 개인설정을 맞춘다 (대표 지시 2026-11-07)

   ■ 무엇을 바꾸나 (모두 «이 컴퓨터의 내 계정» 설정 — 저장소 밖이다)
     · Claude Code          ~/.claude/settings.json 에 "language": "korean" (공식 응답 언어 설정)
     · Gemini CLI·Antigravity ~/.gemini/GEMINI.md 에 「한국어로 대답」 단락 (두 도구가 같은 파일을 읽는다)
     · Codex CLI(챗지피티)   ~/.codex/AGENTS.md 에 같은 단락 — AGENTS.override.md 가 있으면 Codex 는
                             그것만 읽으므로 그쪽에 넣는다. CODEX_HOME 을 바꿔 두었으면 그 자리.

   ■ 쓰는 법
     node scripts/korean-everywhere.js           ← 보기: 무엇이 바뀌는지만 보여 주고 아무것도 안 쓴다
     node scripts/korean-everywhere.js --apply   ← 실제로 쓴다. 바뀌는 파일은 먼저 «.bak-날짜» 로 남긴다
     여러 번 돌려도 같다 — 이미 들어 있으면 건드리지 않는다.

   ■ 못 하는 것
     ChatGPT·Claude·Gemini «앱·웹» 은 파일이 아니라 계정 설정이라 여기서 못 바꾼다.
     손으로 넣는 자리와 붙여 넣을 글: docs/규칙/한국어로-대답.md

   ■ 안전장치
     settings.json 이 깨진 JSON 이면 고치지 않고 멈춘다(종료코드 2) — 덮어쓰면 다른 설정이 사라진다. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

/* 이 표시가 있으면 «이미 넣었다» 로 본다 */
const MARKER = '<!-- 푸른-한국어-대답 (scripts/korean-everywhere.js) -->';
const LANGUAGE = 'korean';
const BLOCK_LINES = [
  MARKER,
  '## 대답 언어',
  '- 대답은 늘 한국어로 한다 (Always respond in Korean). 영어로 묻거나 영어 자료를 읽어도 설명·보고·요약은 한국어로 쓴다.',
  '- 코드 식별자·명령어·파일 이름·기술 용어 원문은 그대로 둔다.',
];

function stamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

function readOrNull(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

/* Claude Code: settings.json 에 language 를 넣는다(다른 열쇠는 그대로) */
function planClaude(home) {
  const file = path.join(home, '.claude', 'settings.json');
  const before = readOrNull(file);
  if (before === null) {
    return { name: 'Claude Code', file, state: '새로 만듦', after: JSON.stringify({ language: LANGUAGE }, null, 2) + '\n' };
  }
  let cfg;
  try { cfg = JSON.parse(before.replace(/^﻿/, '')); } catch (e) {
    return { name: 'Claude Code', file, state: '멈춤', why: `JSON 이 깨져 있어 고치지 않았습니다(${e.message}). 파일을 바로잡은 뒤 다시 돌리십시오.` };
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return { name: 'Claude Code', file, state: '멈춤', why: '맨 바깥이 { } 가 아니라 고치지 않았습니다.' };
  }
  if (cfg.language === LANGUAGE) return { name: 'Claude Code', file, state: '그대로' };
  const old = cfg.language;
  const next = { ...cfg, language: LANGUAGE };
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  return {
    name: 'Claude Code', file, state: '바꿈', before,
    why: old === undefined ? 'language 를 넣습니다' : `language 를 "${old}" → "${LANGUAGE}" 로 바꿉니다`,
    after: JSON.stringify(next, null, 2).replace(/\n/g, eol) + eol,
  };
}

/* 마크다운 지침 파일 끝에 단락을 덧붙인다(원래 내용은 그대로) */
function planMarkdown(name, file) {
  const before = readOrNull(file);
  if (before === null) {
    return { name, file, state: '새로 만듦', after: BLOCK_LINES.join('\n') + '\n' };
  }
  if (before.includes(MARKER)) return { name, file, state: '그대로' };
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  const sep = before.length === 0 ? '' : (before.endsWith(eol) ? eol : eol + eol);
  return { name, file, state: '바꿈', before, why: '끝에 「대답 언어」 단락을 덧붙입니다', after: before + sep + BLOCK_LINES.join(eol) + eol };
}

function codexFile(home, env) {
  const dir = env.CODEX_HOME ? path.resolve(env.CODEX_HOME) : path.join(home, '.codex');
  const override = path.join(dir, 'AGENTS.override.md');
  return fs.existsSync(override) ? override : path.join(dir, 'AGENTS.md');
}

function plan({ home = os.homedir(), env = process.env } = {}) {
  return [
    planClaude(home),
    planMarkdown('Gemini CLI·Antigravity', path.join(home, '.gemini', 'GEMINI.md')),
    planMarkdown('Codex CLI', codexFile(home, env)),
  ];
}

function apply(steps, now = new Date()) {
  const tag = stamp(now);
  for (const s of steps) {
    if (s.state !== '바꿈' && s.state !== '새로 만듦') continue;
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    if (s.state === '바꿈') {
      s.backup = `${s.file}.bak-${tag}`;
      fs.copyFileSync(s.file, s.backup);
    }
    fs.writeFileSync(s.file, s.after, 'utf8');
  }
  return steps;
}

function main(argv) {
  const doApply = argv.includes('--apply');
  const hi = argv.indexOf('--home');
  const home = hi >= 0 && argv[hi + 1] ? path.resolve(argv[hi + 1]) : os.homedir();
  const steps = plan({ home });
  if (doApply) apply(steps);

  console.log(doApply ? '■ 한국어 대답 — 개인설정을 바꿨습니다' : '■ 한국어 대답 — 보기(아무것도 바꾸지 않았습니다)');
  const 보기말 = { '새로 만듦': '만들 것', '바꿈': '바꿀 것' };
  for (const s of steps) {
    console.log(`  [${doApply ? s.state : (보기말[s.state] || s.state)}] ${s.name}  ${s.file}`);
    if (s.why) console.log(`         ${s.why}`);
    if (s.backup) console.log(`         원본: ${s.backup}`);
  }
  const todo = steps.filter((s) => s.state === '바꿈' || s.state === '새로 만듦').length;
  if (!doApply && todo) console.log(`\n  바꿀 것 ${todo}곳 — 실제로 쓰려면: node scripts/korean-everywhere.js --apply`);
  if (doApply && todo) console.log('\n  열려 있는 Claude Code·Gemini·Antigravity·Codex 창은 다시 열어야 적용됩니다.');
  console.log('  ChatGPT·Claude·Gemini 앱(웹)은 계정 설정에서 손으로 — docs/규칙/한국어로-대답.md');
  return steps.some((s) => s.state === '멈춤') ? 2 : 0;
}

module.exports = { MARKER, LANGUAGE, plan, apply };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
