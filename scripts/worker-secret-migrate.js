#!/usr/bin/env node
/* 사건·계약 근로자 주민번호·계좌·예금주를 담당자 칸(worker_secret)으로 옮긴다 — 대표 결정 2026-10-15
   설계: status/2026-10-15-rrn-owner-only.md · 화면 쪽: js/pu-worker-secret.js · 규칙: worker_secret

     node scripts/worker-secret-migrate.js            보여만 준다(무엇을 몇 칸 옮기고 비울지 — 값은 안 찍는다)
     node scripts/worker-secret-migrate.js --copy     담당자 칸에 «복사»한다. 공개 덩어리는 그대로 둔다
     node scripts/worker-secret-migrate.js --clear    담당자 칸과 «같은 값»인 것만 공개 덩어리에서 비우고 「있다」 표시를 남긴다

   ⚠ 순서: --copy → 화면 새 판 배포 → (한 번 더 --copy) → --clear.
     새 판은 저장할 때 셋을 공개 덩어리에서 «뗀다». 복사 전에 새 판이 돌면 담당이 아닌 직원의 저장이
     값을 떼어 버리고 담당자 칸에는 아무것도 없게 된다.
   ⚠ 안전장치 (2026-10-04 살아 있는 자료 쓰기 요령):
     · 쓰기 «직전»에 서버를 다시 읽어 계획을 다시 짠다 — 그 사이 바뀐 것이 있어도 그 판으로 쓴다
     · 담당자 칸에 «다른 값»이 이미 있으면 덮지 않고 멈춘다(종료코드 2)
     · 칸 하나씩만 쓴다(database:update 여러 경로) — 통째로 덮지 않는다
     · 쓴 뒤 다시 읽어 «남은 것 0»을 센다
     · 값은 화면에 찍지 않는다 — 개수만 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const W = require('../js/pu-worker-secret.js');
const KINDS = Object.keys(W.WORKER_PATH);
const PROJECT = 'pureun-erp';

/* ── 판단(순수) — 검사가 그대로 돌린다 ─────────────────────────────── */
function workerList(kind, rec) {
  const p = W.WORKER_PATH[kind];
  let o = rec;
  for (const k of p) o = o == null ? o : o[k];
  return { arr: o, base: p.join('/') };
}

/* data: {표: {id: 기록}} · secret: worker_secret 전체({표:{id:{wid:{칸:값}}}}) */
function plan(data, secret) {
  const copy = {}, clear = {}, conflicts = [], noId = [];
  const count = { workers: 0, values: 0, copy: 0, same: 0, clear: 0 };
  for (const kind of KINDS) {
    const recs = (data && data[kind]) || {};
    for (const id of Object.keys(recs)) {
      const rec = recs[id];
      if (!rec) continue;
      const { arr, base } = workerList(kind, rec);
      if (!arr || typeof arr !== 'object') continue;
      const keys = Object.keys(arr);           /* 배열이면 '0','1'… · 묶음이면 그 열쇠 */
      for (const ix of keys) {
        const w = arr[ix];
        if (!w || typeof w !== 'object') continue;
        const fields = W.FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(w, f));
        if (!fields.length) continue;
        count.workers++;
        if (!w.id) { noId.push(kind + '/' + id + '#' + ix); continue; }
        for (const f of fields) {
          const v = w[f] == null ? '' : String(w[f]).trim();
          const pub = 'data/' + kind + '/v/' + id + '/' + base + '/' + ix + '/' + f;
          const sp = W.ROOT + '/' + kind + '/' + id + '/' + w.id + '/' + f;
          const have = secret && secret[kind] && secret[kind][id] && secret[kind][id][w.id] && secret[kind][id][w.id][f];
          if (v) {
            count.values++;
            if (have == null || have === '') { copy[sp] = v; count.copy++; }
            else if (String(have) === v) {
              count.same++;
              clear[pub] = null; count.clear++;
              if (W.FLAG[f]) clear['data/' + kind + '/v/' + id + '/' + base + '/' + ix + '/' + W.FLAG[f]] = true;
            } else conflicts.push(sp);
          } else {
            /* 빈칸 — 옮길 것은 없고 공개 덩어리에서 칸만 걷는다(표시는 «없음») */
            clear[pub] = null; count.clear++;
            if (W.FLAG[f]) clear['data/' + kind + '/v/' + id + '/' + base + '/' + ix + '/' + W.FLAG[f]] = false;
          }
        }
      }
    }
  }
  return { copy, clear, conflicts, noId, count };
}

/* ── 서버(firebase CLI) ───────────────────────────────────────────── */
function fb(args, opts) {
  const isWin = process.platform === 'win32';
  return execFileSync(isWin ? 'firebase.cmd' : 'firebase', args.concat(['--project', PROJECT]),
    Object.assign({ encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: isWin, env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) }, opts || {}));
}
function get(p) {
  const out = fb(['database:get', p]);
  const t = out.trim();
  return t && t !== 'null' ? JSON.parse(t) : null;
}
function readAll() {
  const data = {};
  for (const k of KINDS) { const env = get('/data/' + k); data[k] = (env && env.v) || {}; }
  return { data, secret: get('/' + W.ROOT) || {} };
}
function update(paths) {
  const keys = Object.keys(paths);
  if (!keys.length) return 0;
  const tmp = path.join(os.tmpdir(), 'ws-migrate-' + Date.now() + '.json');
  fs.writeFileSync(tmp, JSON.stringify(paths), 'utf8');
  try { fb(['database:update', '/', tmp, '-f']); }
  finally { try { fs.unlinkSync(tmp); } catch (e) {} }
  return keys.length;
}

function say(p, label) {
  const c = p.count;
  console.log(label + ' — 셋 중 하나라도 든 근로자 ' + c.workers + '명 · 값 ' + c.values + '칸');
  console.log('   담당자 칸에 복사할 것 ' + c.copy + '칸 · 이미 같은 값 ' + c.same + '칸 · 공개 덩어리에서 비울 것 ' + c.clear + '칸');
  if (p.conflicts.length) console.log('   ⚠ 담당자 칸에 «다른 값»이 이미 있음 ' + p.conflicts.length + '칸 — 덮지 않는다');
  if (p.noId.length) console.log('   ⚠ 근로자 열쇠(id) 없음 ' + p.noId.length + '명 — 건너뜀: ' + p.noId.join(', '));
}

function main() {
  const mode = process.argv.includes('--copy') ? 'copy' : process.argv.includes('--clear') ? 'clear' : 'show';
  let p = plan(...Object.values(readAll()));
  say(p, '지금');
  if (mode === 'show') { console.log('\n보여만 줬습니다. 복사: --copy · 비우기(복사·새 판 배포 뒤): --clear'); return; }
  if (p.conflicts.length) { console.log('\n멈춤 — 다른 값이 있는 칸을 사람이 먼저 봐야 합니다.'); process.exit(2); }

  /* 쓰기 직전에 다시 읽어 그 판으로 짠다 */
  p = plan(...Object.values(readAll()));
  if (p.conflicts.length) { console.log('\n멈춤 — 다시 읽으니 다른 값이 생겼습니다.'); process.exit(2); }
  if (mode === 'copy') {
    const n = update(p.copy);
    console.log('\n복사함: ' + n + '칸');
  } else {
    if (p.count.copy) { console.log('\n멈춤 — 아직 복사 안 된 값이 ' + p.count.copy + '칸 있습니다. 먼저 --copy'); process.exit(2); }
    const n = update(p.clear);
    console.log('\n공개 덩어리에서 비움: ' + Object.keys(p.clear).filter((k) => !/\/has(Rrn|Account)$/.test(k)).length + '칸 (표시 포함 ' + n + '경로)');
  }
  const after = plan(...Object.values(readAll()));
  say(after, '다시 읽음');
  const left = mode === 'copy' ? after.count.copy : after.count.clear;
  console.log(left === 0 ? '✅ 남은 것 0' : '⚠ 남은 것 ' + left + '칸 — 다시 돌려 보세요');
  if (left) process.exit(3);
}

if (require.main === module) main();
module.exports = { plan };
