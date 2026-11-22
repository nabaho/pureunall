'use strict';
/* 정부사업신청 «매일 카톡 요약» 실행 파일 — 서버가 모은 공고·모집 글을 읽어 추리고(digest.js), 대표 «나와의 채팅»으로 보낸다.
   node scripts/gov-digest/main.js              미리보기 — 읽어서 오늘 보낼 글만 보여 준다(아무것도 보내지 않고 기록도 안 남긴다)
   node scripts/gov-digest/main.js --send       보낸다 — 설정이 «실전»이 아니면 시험 모드(outbox 에 글만 적고 카톡은 한 번도 안 건드린다)
   node scripts/gov-digest/main.js --probe      PC 카톡이 켜져 있고 창을 찾을 수 있는지만 본다(아무것도 보내거나 열지 않는다)
   옵션: --dir <폴더>  서버 대신 폴더의 gov_feed.json·gov_watch.json 을 읽는다(시험·점검용) · --all  «새 것만»이 아니라 오늘 걸린 것 전부(미리보기만)
   설정: %APPDATA%\pureun-gov-digest\config.json  { "liveEnabled": false, "selfChat": false, "room": "나와의 채팅 방 이름", "project": "pureun-erp" } — 저장소 밖
   ⚠ 서버(RTDB)는 «읽기만» 한다 — 공고 함 gov_feed/rows · 모집 글 gov_watch/hits 둘뿐. 쓰는 곳은 이 PC 의 기록 파일뿐이다.
   ⚠ 실전은 liveEnabled·room·selfChat 셋이 다 있을 때만 PC 카톡을 건드린다. selfChat:true 는 «그 방이 내 나와의 채팅이라고 내가 직접 확인했다»는 표시다 —
     PC 카톡 창 제목만으로는 같은 이름의 다른 방과 구분되지 않아서, 설정이 틀리면 남에게 갈 수 있다(2026-11-22 보안 검토).
   ⚠ 카톡 약관상 자동 조종 위험이 있다(대표 «알고 진행», 컨설팅정산 카톡 심부름꾼과 같은 길). */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const D = require('./digest.js');

const NL = String.fromCharCode(10);
const DEFAULTS = { liveEnabled: false, selfChat: false, room: '', project: 'pureun-erp', instance: '' };
const LOCK_STALE_MS = 30 * 60 * 1000;

function homeDir(env) {
  env = env || process.env;
  if (env.PUREUN_GOV_DIGEST_HOME) return env.PUREUN_GOV_DIGEST_HOME;
  return path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pureun-gov-digest');
}
/* 설정을 다듬고 검사한다 — 파일에서 읽은 것이든 부르는 쪽이 직접 넘긴 것이든 «같은 문»을 지난다(셸로 넘기는 project·instance 포함) */
function normalize(raw) {
  const c = Object.assign({}, DEFAULTS, raw || {}), errors = [];
  c.liveEnabled = c.liveEnabled === true;
  c.selfChat = c.selfChat === true;
  c.room = String(c.room || '').trim();
  if (!/^[a-z0-9-]+$/.test(String(c.project || ''))) errors.push('project 이름이 올바르지 않습니다');
  if (c.instance && !/^[a-z0-9-]+$/.test(String(c.instance))) errors.push('instance 이름이 올바르지 않습니다');
  if (/[\u0000-\u001f]/.test(c.room)) errors.push('room 에 줄바꿈·제어문자가 있습니다');
  return { config: c, errors };
}
/* 파일이 «없을 때만» 기본값(시험 모드) — 있는데 못 읽으면 조용히 넘기지 않고 알린다 */
function loadConfig(dir) {
  const file = path.join(dir, 'config.json');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { if (e && e.code === 'ENOENT') return normalize({}); return { config: null, errors: ['설정 파일을 읽을 수 없습니다: ' + file] }; }
  let raw;
  try { raw = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { return { config: null, errors: ['설정 파일이 깨졌습니다(JSON 문법): ' + file] }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { config: null, errors: ['설정 파일 모양이 올바르지 않습니다: ' + file] };
  return normalize(raw);
}
/* 'YYYY-MM-DD' 가 «있는 날»인지 — 2026-99-99 는 아니다 */
function realDay(v) { if (typeof v !== 'string') return false; const t = v; const d = new Date(t + 'T00:00:00Z'); return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t; }
/* 보낸 기록 — 없으면 빈 기록, «있는데 깨졌으면» null(그대로 보내면 지난 글이 전부 다시 나간다) */
function readState(dir) {
  let text;
  try { text = fs.readFileSync(path.join(dir, 'sent.json'), 'utf8'); } catch (e) { return (e && e.code === 'ENOENT') ? {} : null; }
  let v;
  try { v = JSON.parse(text); } catch (e) { return null; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  /* 문법은 맞아도 칸 모양이 틀린 기록(항목이 객체가 아니거나 날짜가 없음)은 «깨진 기록»으로 본다 */
  const bad = Object.keys(v).some((k) => { const e = v[k]; return !e || typeof e !== 'object' || Array.isArray(e) || !realDay(e.sent) || !(e.reminded === '' || e.reminded == null || realDay(e.reminded)); });
  return bad ? null : v;
}
/* 쓰다 멈춰도 반쪽 파일이 남지 않게 — 임시 파일에 쓴 뒤 바꿔 끼운다 */
function writeState(dir, st) {
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, 'sent.json.' + process.pid + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(st, null, 1));
  fs.renameSync(tmp, path.join(dir, 'sent.json'));
}
function log(dir, msg) {
  try { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(path.join(dir, 'digest.log'), new Date().toISOString() + ' ' + msg + NL); } catch (e) { /* 기록 실패는 무시 */ }
}
/* 같은 때 두 번 돌지 않게 — 잠금 파일(wx = 있으면 실패). 30분 넘은 잠금은 죽은 것으로 보고 치운다 */
function takeLock(dir, now) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'run.lock');
  for (let i = 0; i < 2; i++) {
    try { fs.writeFileSync(f, String(now), { flag: 'wx' }); return () => { try { fs.unlinkSync(f); } catch (e) { /* 이미 없음 */ } }; }
    catch (e) {
      if (!e || e.code !== 'EEXIST') throw e;
      let age = 0; try { age = now - fs.statSync(f).mtimeMs; } catch (e2) { continue; }
      if (age < LOCK_STALE_MS) return null;
      try { fs.unlinkSync(f); } catch (e3) { return null; }
    }
  }
  return null;
}

/* 서버 읽기 — firebase CLI(이 PC 에 로그인됨). 윈도에서 firebase 는 .cmd 라 shell:true, MSYS_NO_PATHCONV 는 «/gov_feed» 가 경로로 바뀌는 것을 막는다.
   ⚠ shell:true 라 인자가 셸을 지난다 — project·instance 는 normalize 가 [a-z0-9-] 만 허락한 것이다 */
function cliGet(p, c) {
  const args = ['database:get', p, '--project', c.project].concat(c.instance ? ['--instance', c.instance] : []);
  const out = String(execFileSync('firebase', args, { encoding: 'utf8', shell: true, timeout: 120000, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) }) || '').trim();
  return !out || out === 'null' ? null : JSON.parse(out);
}
/* --dir 은 «두 파일이 다 있고 읽힐 때만» — 없는 폴더·깨진 파일을 «0건»으로 삼키지 않는다 */
function readDump(dir, name, key) {
  const f = path.join(dir, name);
  let v;
  try { v = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(name + ' 을 읽을 수 없습니다(' + dir + ')'); }
  if (!v || typeof v !== 'object' || Array.isArray(v) || !v[key] || typeof v[key] !== 'object' || Array.isArray(v[key])) throw new Error(name + ' 에 «' + key + '» 가 없거나 모양이 올바르지 않습니다');
  return v[key];
}
function load(o) {
  if (o.dir) return { rows: readDump(o.dir, 'gov_feed.json', 'rows'), hits: readDump(o.dir, 'gov_watch.json', 'hits') };
  return { rows: cliGet('/gov_feed/rows', o.config) || {}, hits: cliGet('/gov_watch/hits', o.config) || {} };
}

/* 한 바퀴 — 부품(읽기·카톡·시계·기록 위치)을 받아 돌린다. 시험에서는 가짜 부품을 꽂는다 */
async function run(o) {
  o = o || {};
  const home = o.home || homeDir();
  const lc = o.config ? normalize(o.config) : loadConfig(home);   // 직접 넘긴 설정도 같은 검사를 지난다
  if (lc.errors.length) return { ok: false, error: lc.errors.join(' · ') };
  const config = lc.config;
  const now = o.now == null ? Date.now() : o.now, today = D.todayKst(now);
  const send = !!o.send, all = !!o.all && !send;   // --all 은 미리보기 전용 — 보낼 때 «새 것만»이 아니면 밀린 줄이 새 줄을 밀어낸다
  let release = null;
  if (send) {
    release = takeLock(home, now);
    if (!release) { log(home, today + ' 이미 돌고 있어 건너뜀'); return { ok: false, error: '이미 돌고 있습니다(run.lock) — 30분 넘게 남아 있으면 자동으로 치웁니다' }; }
  }
  try {
    let data;
    try { data = (o.load || load)({ dir: o.dir, config }); } catch (e) { const m = String((e && e.message) || e).slice(0, 200); log(home, '읽기 실패 ' + m); return { ok: false, error: '서버 자료를 읽지 못했습니다 — ' + m }; }
    const state0 = readState(home);
    if (state0 === null) { log(home, '보낸 기록(sent.json)이 깨져 멈춤'); return { ok: false, error: '보낸 기록 파일(sent.json)이 깨졌습니다 — 그대로 보내면 지난 글이 전부 다시 나갑니다. 파일을 확인하거나 지운 뒤 다시 하세요' }; }
    const digest = D.build({ rows: data.rows, hits: data.hits, today });
    const state = D.prune(state0, today);
    const df = D.diff(digest, state);
    const msgs = D.render(digest, all ? {} : { fresh: df.fresh, remind: df.remind });
    const res = { ok: true, today, counts: digest.counts, fresh: df.fresh.size, remind: df.remind.size, messages: msgs, mode: 'preview', sent: 0, failed: [] };
    if (!send) return res;

    /* 보내기 — 실전(liveEnabled·room·selfChat 셋 다)일 때만 카톡을 건드린다. 아니면 outbox 에 글만 적는다(기록도 안 남긴다 — 실전 첫 통에 전부 들어가게) */
    const live = config.liveEnabled && !!config.room && config.selfChat && !o.dryRun;
    res.mode = live ? 'live' : 'test';
    if (!msgs.length) { log(home, today + ' 새로 걸린 것 없음 (공고 ' + digest.counts.rows + '·모집 글 ' + digest.counts.hits + ')'); return res; }
    if (!live) {
      const out = path.join(home, 'outbox'); fs.mkdirSync(out, { recursive: true });
      msgs.forEach((m, i) => fs.writeFileSync(path.join(out, today + '-' + (i + 1) + '-' + m.section + '.txt'), m.text, 'utf8'));
      log(home, today + ' 시험 모드 — ' + msgs.length + '통을 outbox 에 적음');
      return res;
    }
    const kakao = o.kakao || require('../kakao-agent/kakao.js').createKakao();
    let cur = state;   // 보낸 기록 — 디스크를 다시 읽지 않고 메모리에서 이어 간다(잠금이 다른 실행을 막는다)
    for (let i = 0; i < msgs.length; i++) {
      const r = kakao.send(config.room, msgs[i].text);
      if (!r || !r.ok) { res.failed.push({ section: msgs[i].section, code: r && r.code, error: r && r.error }); log(home, today + ' 보내기 실패 ' + msgs[i].section + ' ' + (r && r.code)); break; }   // 한 통이 막히면 멈춘다 — 순서가 뒤섞이지 않게
      res.sent++;
      /* 통마다 바로 «보냄»을 적는다 — 중간에 멈춰도 이미 간 줄이 다시 나가지 않는다. 오래된 기록은 이때 함께 덜어 낸다.
         기록에 실패하면 멈춘다 — 방금 간 통이 다음에 다시 갈 수 있으니 사람이 알아야 한다 */
      try { const next = D.diff(digest, cur).mark(today, new Set(msgs[i].ids)); writeState(home, next); cur = next; }
      catch (e) { res.failed.push({ section: msgs[i].section, code: 'state-write', error: '방금 보낸 통의 기록에 실패했습니다 — 다음에 같은 통이 다시 갈 수 있습니다 (' + String((e && e.message) || e).slice(0, 100) + ')' }); log(home, today + ' 기록 실패 ' + msgs[i].section + ' — 방금 보낸 통이 다음에 다시 갈 수 있음 (' + String((e && e.message) || e).slice(0, 100) + ')'); break; }
    }
    if (res.sent) log(home, today + ' 카톡 ' + res.sent + '/' + msgs.length + '통 보냄');
    res.ok = res.failed.length === 0;
    return res;
  } finally { if (release) release(); }
}

async function main(argv) {
  const has = (f) => argv.includes(f);
  const di = argv.indexOf('--dir');
  if (di >= 0 && (!argv[di + 1] || argv[di + 1].startsWith('--'))) { console.log('✗ --dir 뒤에 폴더를 적어 주세요'); return 1; }
  const dir = di >= 0 ? argv[di + 1] : '';
  if (has('--probe')) { console.log(JSON.stringify(require('../kakao-agent/kakao.js').createKakao().probe())); return 0; }
  if (has('--all') && has('--send')) console.log('(참고) --all 은 미리보기 전용입니다 — 보낼 때는 새 것만 보냅니다)');
  const r = await run({ send: has('--send'), all: has('--all'), dryRun: has('--dry-run'), dir });
  if (!r.ok && !r.messages) { console.log('✗ ' + r.error); return 1; }
  console.log('[' + r.mode + '] ' + r.today + ' · 공고 ' + r.counts.rows + ' · 모집 글 ' + r.counts.hits + ' · 수의계약 뺌 ' + r.counts.soleOut + ' · 충청·노무사 모집 ' + r.counts.rgn + ' · 공고 ' + r.counts.main + ' · AI ' + r.counts.ai
    + ' → 새로 ' + r.fresh + '건 · 마감 임박 다시 ' + r.remind + '건 → ' + r.messages.length + '통' + (r.mode === 'preview' ? '' : ' · 보냄 ' + r.sent));
  if (r.mode === 'preview') r.messages.forEach((m, i) => console.log(NL + '── 통 ' + (i + 1) + ' (' + m.text.length + '자) ──' + NL + m.text));
  r.failed.forEach((f) => console.log('✗ 보내기 실패 ' + f.section + ' — ' + (f.code || '') + ' ' + (f.error || '')));
  return r.ok ? 0 : 2;
}

module.exports = { run, loadConfig, normalize, homeDir, readState, writeState, takeLock, load };
if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error('✗ ' + ((e && e.message) || e)); process.exit(1); });
