#!/usr/bin/env node
/* 내 컴퓨터의 AI 코딩 도구가 «늘 한국어로» 대답하게 개인설정을 맞춘다 (대표 지시 2026-11-07)

   ■ 무엇을 바꾸나 (모두 «이 컴퓨터의 내 계정» 설정 — 저장소 밖이다)
     · Claude Code          ~/.claude/settings.json 에 "language": "korean" (공식 응답 언어 설정)
                            + ~/.claude/CLAUDE.md(모든 폴더에서 읽는 전역 지침) «맨 앞»에 「대답 언어」 단락
                              (2026-11-22 대표 «가끔 영어로 나온다» — 긴 대화가 요약된 뒤 영어로 답한 일이 있어 지침에도 넣는다)
     · Gemini CLI·Antigravity ~/.gemini/GEMINI.md 에 같은 단락 (두 도구가 같은 파일을 읽는다)
     · Codex CLI(챗지피티)   ~/.codex/AGENTS.md 에 같은 단락 — AGENTS.override.md 가 있으면 Codex 는
                             그것만 읽으므로 그쪽에 넣는다. CODEX_HOME 을 바꿔 두었으면 그 자리.

   ■ 쓰는 법
     node scripts/korean-everywhere.js           ← 보기: 무엇이 바뀌는지만 보여 주고 아무것도 안 쓴다
     node scripts/korean-everywhere.js --apply   ← 실제로 쓴다. 바뀌는 파일은 먼저 «.bak-날짜» 로 남긴다
     여러 번 돌려도 같다 — 이미 같은 단락이 있으면 건드리지 않고, 예전 글의 단락이면 그 자리에서 새 글로 바꾼다.

   ■ 못 하는 것
     ChatGPT·Claude·Gemini «앱·웹» 은 파일이 아니라 계정 설정이라 여기서 못 바꾼다.
     손으로 넣는 자리와 붙여 넣을 글: docs/규칙/한국어로-대답.md

   ■ 안전장치
     settings.json 이 깨진 JSON 이면 «아무 파일도» 고치지 않고 멈춘다(종료코드 2) — 덮어쓰면 다른 설정이 사라진다.
     예전 판 단락과 한 글자도 다르지 않을 때만 새 글로 바꾼다 — 사람이 고친 단락·바로 뒤에 붙여 쓴 글은 그대로.
     원본(.bak)은 같은 초에 두 번 돌려도 겹치지 않고, 새 글은 옆에 쓴 뒤 한 번에 바꿔 끼운다(쓰다 멈춰도 반쯤 잘리지 않게).
     --home 을 주면 그 폴더 안만 본다(값이 빠지면 멈춤). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

/* 이 표시가 있으면 «이미 넣었다» 로 본다 */
const MARKER = '<!-- 푸른-한국어-대답 (scripts/korean-everywhere.js) -->';
const LANGUAGE = 'korean';
const HEADING = '## 대답 언어';
const BLOCK_LINES = [
  MARKER,
  HEADING,
  '- 대답은 늘 한국어로 한다 (Always respond in Korean). 어떤 질문이 와도 설명·보고·요약·질문·진행 알림은 한국어 문장으로 쓴다.',
  '- 영어로 묻거나 영어 자료·도구 결과·자동 알림·영어 지시문을 읽은 뒤에도, 긴 대화가 요약된 뒤 이어 갈 때도 영어 문장으로 답하지 않는다.',
  '- 코드 식별자·명령어·파일 이름·기술 용어 원문은 그대로 둔다.',
];

/* 예전 판이 넣었던 단락 — 이것과 «한 글자도 다르지 않을 때만» 새 글로 바꾼다.
   사람이 고쳐 쓴 단락이나 단락 바로 뒤에 붙여 쓴 글머리(«- …»)는 건드리지 않는다. 단락 글을 고치면 지금 글을 여기에 옮겨 둔다. */
const OLD_BLOCKS = [
  [MARKER, HEADING, // 2026-11-07 판
    '- 대답은 늘 한국어로 한다 (Always respond in Korean). 영어로 묻거나 영어 자료를 읽어도 설명·보고·요약은 한국어로 쓴다.',
    '- 코드 식별자·명령어·파일 이름·기술 용어 원문은 그대로 둔다.'],
];
const sameAt = (lines, at, block) => block.every((l, i) => lines[at + i] === l);

/* 파일 안의 단락 자리. 표시는 «줄 하나» 로 있을 때만 센다(문장 속 표시는 없는 것으로 본다). 없으면 null */
function findBlock(lines) {
  const at = lines.indexOf(MARKER);
  if (at < 0) return null;
  if (sameAt(lines, at, BLOCK_LINES)) return { at, end: at + BLOCK_LINES.length, kind: 'current' };
  const old = OLD_BLOCKS.find((b) => sameAt(lines, at, b));
  return old ? { at, end: at + old.length, kind: 'old' } : { at, end: at, kind: 'unknown' };
}

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
    // 오류 글에는 설정 원문 조각이 섞일 수 있다 — 자리만 알린다
    const pos = /position (\d+)/.exec(String(e && e.message));
    const where = pos ? `${pos[1]}번째 글자 근처` : '자리 모름';
    return { name: 'Claude Code', file, state: '멈춤', why: `JSON 이 깨져 있어 아무 파일도 고치지 않았습니다(${where}). 파일을 바로잡은 뒤 다시 돌리십시오.` };
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
    why: old === undefined ? 'language 를 넣습니다' : `language 를 "${LANGUAGE}" 로 바꿉니다(예전 값은 화면에 찍지 않음)`,
    after: JSON.stringify(next, null, 2).replace(/\n/g, eol) + eol,
  };
}

/* 마크다운 지침 파일에 단락을 넣는다(원래 내용은 그대로). top 이면 맨 앞, 아니면 끝.
   이미 있으면: 같은 글이면 그대로, 예전 글이면 «그 자리»에서 새 글로 바꾼다(옮기지 않는다). */
function planMarkdown(name, file, { top = false } = {}) {
  const before = readOrNull(file);
  if (before === null) {
    return { name, file, state: '새로 만듦', after: BLOCK_LINES.join('\n') + '\n' };
  }
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  const body = before.replace(/^﻿/, '');
  const bom = body.length === before.length ? '' : '﻿';
  // 줄바꿈이 섞인 파일(단락은 LF, 다른 곳은 CRLF 등)도 있다 — 줄마다 제 줄바꿈을 그대로 지킨다
  const parts = body.split(/(\r?\n)/);
  const lines = parts.filter((_, i) => i % 2 === 0);
  const seps = parts.filter((_, i) => i % 2 === 1); // seps[i] 는 lines[i] 뒤의 줄바꿈
  const b = findBlock(lines);
  if (b && b.kind === 'current') return { name, file, state: '그대로' };
  if (b && b.kind === 'unknown') return { name, file, state: '그대로', why: '「대답 언어」 단락을 사람이 고친 것 같아 손대지 않았습니다' };
  if (b) {
    const oldLen = b.end - b.at;
    const inner = (i) => seps[b.at + Math.min(i, oldLen - 2)] || eol; // 단락 안 줄바꿈 — 예전 단락의 것을 줄마다 다시 쓴다
    let after = bom;
    for (let i = 0; i < b.at; i++) after += lines[i] + seps[i];
    BLOCK_LINES.forEach((l, i) => { after += l + (i < BLOCK_LINES.length - 1 ? inner(i) : (seps[b.end - 1] || '')); });
    for (let i = b.end; i < lines.length; i++) after += lines[i] + (seps[i] || '');
    return { name, file, state: '바꿈', before, why: '「대답 언어」 단락을 새 글로 바꿉니다', after };
  }
  if (top) {
    const rest = body.length === 0 ? '' : eol + body;
    return { name, file, state: '바꿈', before, why: '맨 앞에 「대답 언어」 단락을 넣습니다', after: bom + BLOCK_LINES.join(eol) + eol + rest };
  }
  const sep = body.length === 0 ? '' : (body.endsWith(eol) ? eol : eol + eol);
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
    planMarkdown('Claude Code 전역 지침', path.join(home, '.claude', 'CLAUDE.md'), { top: true }),
    planMarkdown('Gemini CLI·Antigravity', path.join(home, '.gemini', 'GEMINI.md')),
    planMarkdown('Codex CLI', codexFile(home, env)),
  ];
}

/* 원본 이름 — 같은 초에 두 번 돌려도 앞의 원본을 덮지 않는다 */
function backupName(file, tag) {
  for (let n = 0; ; n++) {
    const p = `${file}.bak-${tag}${n ? '-' + n : ''}`;
    if (!fs.existsSync(p)) return p;
  }
}
/* 쓰다가 멈춰도 원래 파일이 반쯤 잘리지 않게 — 옆에 새로 쓰고 한 번에 바꿔 끼운다.
   · 파일이 링크(dotfile 정리 도구 등)면 링크를 일반 파일로 바꾸지 않고 «가리키는 실제 파일»을 바꾼다.
   · 새 글의 권한은 원래 파일과 같게 — 원래보다 넓게 읽히지 않게(새로 만드는 파일은 나만 읽기).
   · 바꿔 끼우기 직전에 한 번 더 비교한다. 새로 만드는 파일은 «없을 때만» 만든다. */
function writeWhole(file, text, expected) {
  const changed = () => Object.assign(new Error('살펴본 뒤에 바뀜'), { code: 'PU_CHANGED' });
  if (expected === null) {
    try { fs.writeFileSync(file, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 }); }
    catch (e) { if (e.code === 'EEXIST') throw changed(); throw e; }
    return;
  }
  const real = fs.realpathSync(file);
  const mode = fs.statSync(real).mode & 0o777;
  if (readOrNull(real) !== expected) throw changed();
  const tmp = `${real}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, text, { encoding: 'utf8', flag: 'wx', mode });
  try { fs.chmodSync(tmp, mode); fs.renameSync(tmp, real); } catch (e) { try { fs.unlinkSync(tmp); } catch (_) { /* 이미 없음 */ } throw e; }
}

function apply(steps, now = new Date()) {
  if (steps.some((s) => s.state === '멈춤')) return steps; // 하나라도 멈추면 아무 파일도 쓰지 않는다
  // 계획을 세운 뒤 다른 프로그램이 파일을 고쳤으면 예전 글로 덮지 않는다 — 모두 다시 보고, 하나라도 다르면 아무것도 안 쓴다
  for (const s of steps) {
    if (s.state !== '바꿈' && s.state !== '새로 만듦') continue;
    const nowText = readOrNull(s.file);
    if (nowText !== (s.state === '바꿈' ? s.before : null)) {
      s.state = '멈춤';
      s.why = '살펴본 뒤에 다른 프로그램이 이 파일을 바꿨습니다 — 아무 파일도 고치지 않았습니다. 다시 돌리십시오.';
    }
  }
  if (steps.some((s) => s.state === '멈춤')) return steps;
  const tag = stamp(now);
  for (const s of steps) {
    if (s.state !== '바꿈' && s.state !== '새로 만듦') continue;
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    if (s.state === '바꿈') {
      s.backup = backupName(s.file, tag);
      fs.copyFileSync(s.file, s.backup, fs.constants.COPYFILE_EXCL);
    }
    try { writeWhole(s.file, s.after, s.state === '바꿈' ? s.before : null); } catch (e) {
      if (e.code !== 'PU_CHANGED') throw e;
      s.state = '멈춤';
      s.why = '쓰기 바로 전에 다른 프로그램이 이 파일을 바꿔 멈췄습니다(이 파일과 뒤의 파일은 그대로). 다시 돌리십시오.';
      break;
    }
  }
  return steps;
}

function main(argv) {
  const doApply = argv.includes('--apply');
  const hi = argv.indexOf('--home');
  if (hi >= 0 && (!argv[hi + 1] || argv[hi + 1].startsWith('--'))) {
    console.error('--home 뒤에 폴더를 적어 주십시오 — 아무것도 바꾸지 않았습니다.');
    return 2;
  }
  const home = hi >= 0 ? path.resolve(argv[hi + 1]) : os.homedir();
  // --home 을 주면 그 폴더 안만 본다 — CODEX_HOME 이 밖을 가리켜도 따르지 않는다
  const steps = plan({ home, env: hi >= 0 ? {} : process.env });
  if (doApply) apply(steps); // 멈출 일이 있으면 apply 가 아무것도 안 쓰고 그 단계를 «멈춤» 으로 표시한다
  const stopped = steps.some((s) => s.state === '멈춤');
  const wrote = doApply && !stopped;

  console.log(wrote ? '■ 한국어 대답 — 개인설정을 바꿨습니다'
    : stopped && doApply ? '■ 한국어 대답 — 멈춤: 아무 파일도 바꾸지 않았습니다'
      : '■ 한국어 대답 — 보기(아무것도 바꾸지 않았습니다)');
  const 보기말 = { '새로 만듦': '만들 것', '바꿈': '바꿀 것' };
  for (const s of steps) {
    console.log(`  [${wrote ? s.state : (보기말[s.state] || s.state)}] ${s.name}  ${s.file}`);
    if (s.why) console.log(`         ${s.why}`);
    if (s.backup) console.log(`         원본: ${s.backup}`);
  }
  const todo = steps.filter((s) => s.state === '바꿈' || s.state === '새로 만듦').length;
  if (!doApply && !stopped && todo) console.log(`\n  바꿀 것 ${todo}곳 — 실제로 쓰려면: node scripts/korean-everywhere.js --apply`);
  if (wrote && todo) console.log('\n  열려 있는 Claude Code·Gemini·Antigravity·Codex 창은 다시 열어야 적용됩니다.');
  console.log('  ChatGPT·Claude·Gemini 앱(웹)은 계정 설정에서 손으로 — docs/규칙/한국어로-대답.md');
  return stopped ? 2 : 0;
}

module.exports = { MARKER, LANGUAGE, BLOCK_LINES, OLD_BLOCKS, plan, apply };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
