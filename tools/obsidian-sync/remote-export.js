#!/usr/bin/env node
/* 클라우드 방(☁) 기록 → 옵시디언용 노트 (보관함으로 가는 «전달함»을 채운다)

   클라우드 방의 대화는 서버에만 있어 PC 의 sync.js 가 못 읽는다. 클라우드 세션이 «세션 목록·사건 조회» 도구로
   읽어 와 도구 결과 파일로 남기면, 이 스크립트가 그 파일을 읽어 노트로 바꾼다(AI 가 글을 옮겨 적지 않는다 — 옮기다 틀리지 않게).

   ① 무엇을 읽을지 정하기:
      node tools/obsidian-sync/remote-export.js --out <전달함> --sessions <세션목록 파일> --plan [--limit 8] [--include-bridge]
      → 바뀐(또는 아직 안 옮긴) 방의 «번호 · 갱신시각 · 제목» 줄을 낸다. PC 에서 도는 방(bridge)은 PC 의 sync.js 가 읽으므로 뺀다.
   ② 한 방씩 노트로:
      node tools/obsidian-sync/remote-export.js --out <전달함> --sessions <세션목록 파일> --session <번호> --events <쪽1> --events <쪽2> …
      (--session 이 나올 때마다 새 방. 쪽은 사건 조회를 «이전 쪽 first_id 로 거슬러» 받은 파일들)
   쓰는 곳: <전달함>/raw/sessions/claude-cloud/날짜 제목 id.md  ·  <전달함>/.remote-state.json (방별 갱신시각)
   ⚠ 민감정보는 sync.js 와 같은 규칙으로 가린다(lib.renderNote). 도구 결과·생각·하위 에이전트 말은 안 옮긴다. */
const fs = require('fs');
const path = require('path');
const L = require('./lib.js');

const STATE = '.remote-state.json';

function parseArgs(argv) {
  const a = { groups: [], limit: 8 };
  let cur = null;
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--out') a.out = argv[++i];
    else if (k === '--sessions') a.sessions = argv[++i];
    else if (k === '--plan') a.plan = true;
    else if (k === '--include-bridge') a.includeBridge = true;
    else if (k === '--limit') a.limit = Number(argv[++i]) || 8;
    else if (k === '--session') { cur = { id: argv[++i], events: [] }; a.groups.push(cur); }
    else if (k === '--events') { if (!cur) throw new Error('--events 앞에 --session 이 있어야 합니다'); cur.events.push(argv[++i]); }
    else throw new Error('모르는 옵션: ' + k);
  }
  if (!a.out) throw new Error('--out <전달함 폴더> 가 필요합니다');
  if (!a.sessions) throw new Error('--sessions <세션 목록 파일> 이 필요합니다');
  return a;
}

function readJsonFile(p) {
  const j = L.extractJson(fs.readFileSync(p, 'utf8'));
  if (!j) throw new Error('JSON 을 못 읽었습니다: ' + p);
  return j.ccr || j;
}
function metaList(file) {
  const d = readJsonFile(file).data;
  return Array.isArray(d) ? d : [];
}
function readState(out) {
  try { return JSON.parse(fs.readFileSync(path.join(out, STATE), 'utf8')); } catch (e) { return { sessions: {} }; }
}

/* 아직 안 옮겼거나, 옮긴 뒤 갱신된 방 */
function plan(metas, state, opts) {
  opts = opts || {};
  return metas.filter((m) => m && m.id)
    .filter((m) => opts.includeBridge || String(m.environment_kind || '') !== 'bridge')
    .filter((m) => { const p = state.sessions[m.id]; return !p || p.updated_at !== m.updated_at; })
    .sort((x, y) => String(y.updated_at).localeCompare(String(x.updated_at)))
    .slice(0, opts.limit || 8);
}

function exportOne(out, state, meta, eventFiles) {
  let events = [];
  eventFiles.forEach((f) => { events = events.concat(readJsonFile(f).data || []); });
  const s = L.parseRemoteEvents(events, meta);
  const users = s.turns.filter((t) => t.role === 'user').length;
  if (!s.id || !s.start || users < 1) { state.sessions[meta.id] = { updated_at: meta.updated_at, file: '', skipped: '대화 없음' }; return null; }
  const prev = state.sessions[meta.id];
  const file = (prev && prev.file) || 'raw/sessions/claude-cloud/' + L.noteFileName(s);
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.writeFileSync(path.join(out, file), L.renderNote(s));
  state.sessions[meta.id] = { updated_at: meta.updated_at, file, turns: s.turns.length };
  return file;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const metas = metaList(a.sessions);
  const state = readState(a.out);
  if (a.plan) {
    plan(metas, state, { limit: a.limit, includeBridge: a.includeBridge })
      .forEach((m) => console.log([m.id, m.updated_at, m.title || ''].join('\t')));
    return;
  }
  if (!a.groups.length) throw new Error('--plan 이나 --session 이 필요합니다');
  fs.mkdirSync(a.out, { recursive: true });
  let done = 0;
  a.groups.forEach((g) => {
    const meta = metas.find((m) => m.id === g.id);
    if (!meta) throw new Error('세션 목록에 없는 방입니다: ' + g.id);
    const f = exportOne(a.out, state, meta, g.events);
    console.log((f ? '노트 ' : '건너뜀 ') + g.id + (f ? ' → ' + f : ' (대화 없음)'));
    if (f) done++;
  });
  fs.writeFileSync(path.join(a.out, STATE), JSON.stringify(state, null, 1));
  console.log('새로 쓴 노트 ' + done + '건');
}

module.exports = { parseArgs, plan, exportOne, metaList, readState };
if (require.main === module) {
  try { main(); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
