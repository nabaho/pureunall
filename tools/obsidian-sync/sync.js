#!/usr/bin/env node
/* 옵시디언 자동 정리 — AI 작업 기록을 «내 PC 의 옵시디언 보관함» 으로 옮긴다

   node tools/obsidian-sync/sync.js --vault "D:\푸른업무"                     # 클로드 코드(+코덱스)
   node tools/obsidian-sync/sync.js --vault ... --chatgpt "C:\...\conversations.json"   # 챗지피티 내보내기
   node tools/obsidian-sync/sync.js --vault ... --dry-run                      # 아무것도 안 쓰고 건수만

   읽는 곳(원본은 읽기만 한다)
     · 클로드 코드  ~/.claude/projects 아래 모든 .jsonl (--claude-dir 로 바꿈)
     · 코덱스 CLI   ~/.codex/sessions 아래 모든 .jsonl (--codex-dir)
     · 챗지피티     «설정 → 데이터 제어 → 내보내기» 로 받은 conversations.json 또는 zip (--chatgpt)
   쓰는 곳(보관함 안만)
     raw/sessions/<원본>/날짜 제목 id.md   원자료(민감정보 가림)
     raw/erp/…                            푸른이알피 업무요약(이알피 단추가 만든다 — 여기서는 읽기만)
     daily/날짜.md                        그날 작업 목록(표시 사이만 갱신, 손글씨는 보존)
     wiki/_pending.md                     아직 위키로 정리 안 된 원자료 목록
     CLAUDE.md · AGENTS.md · wiki/index.md · wiki/log.md   없을 때만 틀을 만든다(있으면 안 건드린다)
   다시 돌려도 안전하다 — 바뀐 세션만 다시 쓴다(.obsidian-sync-state.json). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib.js');

const REPO = path.resolve(__dirname, '..', '..');
const TEMPLATE = path.join(__dirname, 'vault-template');
const STATE_FILE = '.obsidian-sync-state.json';

function parseArgs(argv) {
  const a = { exclude: [], minTurns: 2 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dry-run') a.dryRun = true;
    else if (k === '--vault') a.vault = argv[++i];
    else if (k === '--claude-dir') a.claudeDir = argv[++i];
    else if (k === '--codex-dir') a.codexDir = argv[++i];
    else if (k === '--chatgpt') a.chatgpt = argv[++i];
    else if (k === '--since') a.since = argv[++i];
    else if (k === '--min-turns') a.minTurns = Number(argv[++i]) || 2;
    else if (k === '--exclude') a.exclude.push(argv[++i]);
    else throw new Error('모르는 옵션: ' + k);
  }
  a.vault = a.vault || process.env.OBSIDIAN_VAULT;
  a.claudeDir = a.claudeDir || path.join(os.homedir(), '.claude', 'projects');
  a.codexDir = a.codexDir || path.join(os.homedir(), '.codex', 'sessions');
  return a;
}

/* ⚠ 보관함이 이 저장소 안이면 멈춘다 — 이 저장소는 공개 사이트로 배포된다.
   고객 이름이 섞인 대화가 커밋되면 되돌릴 수 없다. */
function assertVaultSafe(vault) {
  if (!vault) throw new Error('보관함 위치가 없습니다. --vault "<폴더>" 또는 환경변수 OBSIDIAN_VAULT 를 주세요.');
  const v = path.resolve(vault).toLowerCase();
  const r = REPO.toLowerCase();
  if (v === r || v.startsWith(r + path.sep)) {
    throw new Error('보관함이 푸른 저장소 안입니다(' + vault + '). 저장소 밖 폴더를 고르세요 — 이 저장소는 인터넷에 배포됩니다.');
  }
}

function walk(dir, ext, out) {
  out = out || [];
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  ents.forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  });
  return out;
}

function readChatGPT(p) {
  if (/\.zip$/i.test(p)) {
    /* 윈도우 10+ 의 tar(bsdtar)·리눅스 unzip 어느 쪽이든 된다 */
    let buf;
    try { buf = execFileSync('tar', ['-xOf', p, 'conversations.json'], { maxBuffer: 1 << 30 }); }
    catch (e) { buf = execFileSync('unzip', ['-p', p, 'conversations.json'], { maxBuffer: 1 << 30 }); }
    return JSON.parse(buf.toString('utf8'));
  }
  const f = fs.statSync(p).isDirectory() ? path.join(p, 'conversations.json') : p;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/* 원본 → [{key, sig, session}] */
function collect(a) {
  const items = [];
  walk(a.claudeDir, '.jsonl').forEach((f) => {
    const st = fs.statSync(f);
    const id = path.basename(f, '.jsonl');
    items.push({ key: 'claude-code:' + id, sig: st.size + ':' + Math.floor(st.mtimeMs), load: () => L.parseClaudeSession(fs.readFileSync(f, 'utf8'), id) });
  });
  walk(a.codexDir, '.jsonl').forEach((f) => {
    const st = fs.statSync(f);
    const id = path.basename(f, '.jsonl').replace(/^rollout-/, '');
    items.push({ key: 'codex:' + id, sig: st.size + ':' + Math.floor(st.mtimeMs), load: () => L.parseCodexSession(fs.readFileSync(f, 'utf8'), id) });
  });
  if (a.chatgpt) {
    L.parseChatGPTExport(readChatGPT(a.chatgpt)).forEach((s) => {
      items.push({ key: 'chatgpt:' + s.id, sig: String(s.end) + ':' + s.turns.length, load: () => s });
    });
  }
  return items;
}

function skip(a, s) {
  if (!s.id || !s.start) return '식별 불가';
  if (s.turns.filter((t) => t.role === 'user').length < Math.max(1, a.minTurns - 1)) return '대화 짧음';
  if (a.since && L.dateOf(s.start) < a.since) return '기간 밖';
  const hay = [s.project, s.title].join(' ').toLowerCase();
  if (a.exclude.some((x) => x && hay.includes(String(x).toLowerCase()))) return '제외 목록';
  return '';
}

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readOr(p, d) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return d; } }

/* 틀은 «없을 때만» 만든다 — 대표가 고친 규칙·색인을 덮지 않는다 */
function scaffold(vault) {
  const made = [];
  [['CLAUDE.md', 'CLAUDE.md'], ['CLAUDE.md', 'AGENTS.md'], ['index.md', 'wiki/index.md'], ['log.md', 'wiki/log.md']].forEach((x) => {
    const dest = path.join(vault, x[1]);
    if (fs.existsSync(dest)) return;
    ensure(path.dirname(dest));
    fs.copyFileSync(path.join(TEMPLATE, x[0]), dest);
    made.push(x[1]);
  });
  ['raw/sessions', 'daily', 'wiki/projects', 'wiki/clients', 'wiki/concepts'].forEach((d) => ensure(path.join(vault, d)));
  return made;
}

/* 푸른이알피 업무요약(raw/erp) — 브라우저(js/pu-obsidian.js)가 obsidian:// 로 만든 노트.
   노트 머리말의 created: 날짜로 하루 목록에 건다. 읽기만 한다. */
function erpEntries(vault) {
  return walk(path.join(vault, 'raw', 'erp'), '.md').map((f) => {
    const m = /^created:\s*(\d{4}-\d{2}-\d{2})/m.exec(readOr(f, '').slice(0, 600));
    if (!m) return null;
    const rel = path.relative(vault, f).split(path.sep).join('/');
    return { source: 'erp', project: '', noTime: true, title: path.basename(f, '.md'), start: m[1] + 'T12:00:00+09:00', link: rel.replace(/\.md$/, '') };
  }).filter(Boolean);
}

function writePending(vault) {
  const log = readOr(path.join(vault, 'wiki', 'log.md'), '');
  const rawRoot = path.join(vault, 'raw');
  const pend = walk(rawRoot, '.md').map((f) => path.relative(vault, f).split(path.sep).join('/'))
    .filter((rel) => !log.includes(rel.replace(/\.md$/, '')) && !log.includes(rel))
    .sort().reverse();
  const body = '---\ntags: [wiki-system]\n---\n# 아직 위키로 정리 안 된 원자료 (' + pend.length + '건)\n\n' +
    '> 자동 생성 — 정리하면 `wiki/log.md` 에 `ingest | <경로>` 줄이 남고 이 목록에서 빠진다.\n\n' +
    pend.map((r) => '- [[' + r.replace(/\.md$/, '') + ']]').join('\n') + '\n';
  fs.writeFileSync(path.join(vault, 'wiki', '_pending.md'), body);
  return pend.length;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  assertVaultSafe(a.vault);
  const vault = path.resolve(a.vault);
  const stPath = path.join(vault, STATE_FILE);
  const state = JSON.parse(readOr(stPath, '{"sessions":{}}'));
  const items = collect(a);
  const stat = { 새로: 0, 갱신: 0, 그대로: 0, 건너뜀: 0, 오류: 0 };
  const skipWhy = {};
  const touched = new Set();

  items.forEach((it) => {
    const prev = state.sessions[it.key];
    if (prev && prev.sig === it.sig) { stat.그대로++; return; }
    let s;
    try { s = it.load(); } catch (e) { stat.오류++; console.error('읽기 실패', it.key, e.message); return; }
    const why = skip(a, s);
    if (why) { stat.건너뜀++; skipWhy[why] = (skipWhy[why] || 0) + 1; return; }
    const file = prev ? prev.file : 'raw/sessions/' + s.source + '/' + L.noteFileName(s);
    if (!a.dryRun) {
      ensure(path.dirname(path.join(vault, file)));
      fs.writeFileSync(path.join(vault, file), L.renderNote(s));
    }
    state.sessions[it.key] = { sig: it.sig, file, source: s.source, project: s.project, title: L.oneLine(L.maskSensitive(s.title), 80), start: s.start };
    touched.add(L.dateOf(s.start));
    prev ? stat.갱신++ : stat.새로++;
  });

  if (!a.dryRun) {
    const made = scaffold(vault);
    const erp = erpEntries(vault);
    erp.forEach((e) => touched.add(L.dateOf(e.start)));
    touched.forEach((date) => {
      const entries = Object.values(state.sessions).filter((e) => L.dateOf(e.start) === date)
        .map((e) => ({ source: e.source, project: e.project, title: e.title, start: e.start, link: e.file.replace(/\.md$/, '') }))
        .concat(erp.filter((e) => L.dateOf(e.start) === date));
      const dp = path.join(vault, 'daily', date + '.md');
      fs.writeFileSync(dp, L.upsertDaily(readOr(dp, ''), date, L.renderDailyBlock(date, entries)));
    });
    if (stat.새로 || stat.갱신) {
      fs.appendFileSync(path.join(vault, 'wiki', 'log.md'),
        '\n## [' + L.dateOf(new Date().toISOString()) + '] sync | 새 ' + stat.새로 + '건 · 갱신 ' + stat.갱신 + '건\n');
    }
    const pending = writePending(vault);
    fs.writeFileSync(stPath, JSON.stringify(state, null, 1));
    if (made.length) console.log('틀 생성:', made.join(', '));
    console.log('위키 대기 원자료:', pending + '건');
  }
  console.log((a.dryRun ? '[모의] ' : '') + '새로 ' + stat.새로 + ' · 갱신 ' + stat.갱신 + ' · 그대로 ' + stat.그대로 +
    ' · 건너뜀 ' + stat.건너뜀 + (Object.keys(skipWhy).length ? ' ' + JSON.stringify(skipWhy) : '') + ' · 오류 ' + stat.오류);
  if (!items.length) console.log('읽을 기록을 못 찾았습니다 — 경로: ' + a.claudeDir);
}

module.exports = { parseArgs, assertVaultSafe, skip, scaffold };
if (require.main === module) {
  try { main(); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
