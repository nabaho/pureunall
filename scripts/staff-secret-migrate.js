#!/usr/bin/env node
/* 직원 주민번호·계좌·예금주를 금고(staff_secret)로 옮긴다 — 대표 승인 2026-11-01 (개인정보 2단계)
   설계: status/2026-11-01-pii-stage2.md · 화면 쪽: js/pu-staff-secret.js · 규칙: staff_secret

     node scripts/staff-secret-migrate.js            보여만 준다(몇 명·몇 칸 — 값은 안 찍는다)
     node scripts/staff-secret-migrate.js --copy     잠가서 금고에 «복사»한다. 명부의 옛 칸은 그대로 둔다
     node scripts/staff-secret-migrate.js --verify   금고를 풀어 옛 칸과 한 칸씩 대조한다(쓰기 없음)
     node scripts/staff-secret-migrate.js --clear    금고와 «같은 값»인 것만 명부에서 비우고 「있다」 표시를 남긴다

   ⚠ 순서: --copy → --verify(전부 일치) → 화면 새 판 배포 → 며칠 사용 → --clear.
     새 판은 저장할 때 셋을 명부에서 «뗀다». 복사 전에 새 판이 돌면 금고에 아무것도 없는 채로 명부에서 값이 사라진다.
     그래서 --clear 는 금고 값과 «같다고 확인된 칸»만 비우고, 복사가 덜 됐으면 멈춘다(종료코드 2).
   ⚠ 안전장치 (살아 있는 자료 쓰기 요령):
     · 쓰기 «직전»에 서버를 다시 읽어 계획을 다시 짠다
     · 금고에 «다른 값»이 이미 있으면 덮지 않고 멈춘다(종료코드 2)
     · 칸 하나씩만 쓴다(database:update 여러 경로) — 통째로 덮지 않는다
     · 쓴 뒤 다시 읽어 «남은 것 0»을 센다
     · 값은 화면에 찍지 않는다 — 개수만. 금고 값은 백업과 같은 열쇠(backup_key/v1)로 잠가 넣는다 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

require('../js/pu-rrn-seal.js');
const S = require('../js/pu-staff-secret.js');
const Seal = globalThis.PuRrnSeal;
const PROJECT = 'pureun-erp';
const USER_BASE = 'data/user_accounts/v/';

/* ── 판단(순수) — 검사가 그대로 돌린다 ─────────────────────────────── */
/* users: {열쇠: 사람} · vault: staff_secret «풀어 놓은» 값({사번:{rrn,account,holder}}) */
function plan(users, vault) {
  const copy = {};          /* 금고에 넣을 {사번:{칸:값}} */
  const derive = {};        /* 명부에 더할 파생값·표시 {경로:값} (비민감 — 복사 때 함께) */
  const clear = {};         /* 명부에서 비울 {경로:null|표시} (금고와 같은 값일 때만) */
  const conflicts = [], noSid = [];
  const count = { users: 0, values: 0, copy: 0, same: 0, clear: 0, derive: 0 };
  Object.keys(users || {}).forEach((ix) => {
    const u = users[ix];
    if (!u || typeof u !== 'object') return;
    if (!S.USER_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(u, f))) return;
    if (!u.sid) { noSid.push(ix); return; }
    count.users++;
    const have = (vault && vault[u.sid]) || {};
    S.USER_FIELDS.forEach((f) => {
      if (!Object.prototype.hasOwnProperty.call(u, f)) return;
      const v = u[f] == null ? '' : String(u[f]).trim();
      const vf = S.MAP[f];
      const flag = S.FLAG[f] || (f === 'accountHolder' ? 'hasAccount' : '');
      const pub = USER_BASE + ix + '/' + f;
      if (v) {
        count.values++;
        const h = have[vf] == null ? '' : String(have[vf]);
        if (!h) { (copy[u.sid] = copy[u.sid] || {})[vf] = v; count.copy++; }
        else if (h === v) { count.same++; clear[pub] = null; count.clear++; }
        else conflicts.push(u.sid + '/' + vf);
        if (S.FLAG[f]) derive[USER_BASE + ix + '/' + S.FLAG[f]] = true;
      } else {
        /* 빈칸 — 옮길 것은 없다. 칸만 걷고 표시는 «없음» */
        clear[pub] = null; count.clear++;
        if (S.FLAG[f]) derive[USER_BASE + ix + '/' + S.FLAG[f]] = false;
      }
    });
    /* 파생값 — 비어 있을 때만 채운다(이미 적힌 생년월일·성별은 안 덮는다) */
    const rrn = u.rrn == null ? '' : String(u.rrn).trim();
    if (rrn) {
      if (!String(u.birthDate || '').trim()) { const b = S.birthFromRrn(rrn); if (b) { derive[USER_BASE + ix + '/birthDate'] = b; count.derive++; } }
      if (!String(u.gender || '').trim()) { const g = S.genderFromRrn(rrn); if (g) { derive[USER_BASE + ix + '/gender'] = g; count.derive++; } }
    }
  });
  return { copy, derive, clear, conflicts, noSid, count };
}

/* ── 서버(firebase CLI) ───────────────────────────────────────────── */
function fb(args, opts) {
  const isWin = process.platform === 'win32';
  return execFileSync(isWin ? 'firebase.cmd' : 'firebase', args.concat(['--project', PROJECT]),
    Object.assign({ encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: isWin, env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) }, opts || {}));
}
function get(p) {
  const t = fb(['database:get', p]).trim();
  return t && t !== 'null' ? JSON.parse(t) : null;
}
function update(paths) {
  const keys = Object.keys(paths);
  if (!keys.length) return 0;
  const tmp = path.join(os.tmpdir(), 'ss-migrate-' + Date.now() + '.json');
  fs.writeFileSync(tmp, JSON.stringify(paths), 'utf8');
  try { fb(['database:update', '/', tmp, '-f']); }
  finally { try { fs.unlinkSync(tmp); } catch (e) {} }
  return keys.length;
}
async function openVault(key) {
  const raw = get('/' + S.ROOT) || {};
  const out = {};
  for (const sid of Object.keys(raw)) {
    for (const f of S.VAULT_FIELDS) {
      const v = raw[sid] && raw[sid][f];
      if (typeof v !== 'string' || !v) continue;
      (out[sid] = out[sid] || {})[f] = Seal.isSealed(v) ? await Seal.unsealOne(v, key) : v;
    }
  }
  return out;
}
async function readAll(key) {
  const env = get('/data/user_accounts');
  let users = (env && env.v) || {};
  if (Array.isArray(users)) users = Object.assign({}, users);       /* 배열이면 '0','1'… */
  return { users, vault: await openVault(key) };
}

function say(p, label) {
  const c = p.count;
  console.log(label + ' — 셋 중 하나라도 든 직원 ' + c.users + '명 · 값 ' + c.values + '칸');
  console.log('   금고에 복사할 것 ' + c.copy + '칸 · 이미 같은 값 ' + c.same + '칸 · 명부에서 비울 것 ' + c.clear + '칸 · 파생값(생년월일·성별) 채울 것 ' + c.derive + '칸');
  if (p.conflicts.length) console.log('   ⚠ 금고에 «다른 값»이 이미 있음 ' + p.conflicts.length + '칸 — 덮지 않는다');
  if (p.noSid.length) console.log('   ⚠ 사번 없음 ' + p.noSid.length + '명 — 건너뜀');
}

async function main() {
  const mode = process.argv.includes('--copy') ? 'copy' : process.argv.includes('--verify') ? 'verify'
    : process.argv.includes('--clear') ? 'clear' : 'show';
  const keyB64 = get('/backup_key/v1');
  if (!keyB64) { console.log('멈춤 — 백업 열쇠(backup_key/v1)를 읽지 못했습니다.'); process.exit(2); }
  const key = await Seal.importKey(keyB64);

  let p = plan(...Object.values(await readAll(key)));
  say(p, '지금');
  if (mode === 'show') { console.log('\n보여만 줬습니다. 복사: --copy · 대조: --verify · 비우기(새 판 배포·며칠 뒤): --clear'); return; }
  if (mode === 'verify') {
    const ok = p.count.copy === 0 && p.conflicts.length === 0;
    console.log(ok ? '\n✅ 전부 일치 — 옛 칸 값이 금고와 한 칸도 다르지 않습니다.'
      : '\n⚠ 일치하지 않음 — 복사가 덜 됐거나(복사할 것 ' + p.count.copy + ') 다른 값이 있습니다(' + p.conflicts.length + ').');
    process.exit(ok ? 0 : 3);
  }
  if (p.conflicts.length) { console.log('\n멈춤 — 다른 값이 있는 칸을 사람이 먼저 봐야 합니다.'); process.exit(2); }

  /* 쓰기 직전에 다시 읽어 그 판으로 짠다 */
  p = plan(...Object.values(await readAll(key)));
  if (p.conflicts.length) { console.log('\n멈춤 — 다시 읽으니 다른 값이 생겼습니다.'); process.exit(2); }
  if (mode === 'copy') {
    const paths = {};
    const sids = Object.keys(p.copy);
    const at = Date.now();
    for (const sid of sids) {
      for (const f of Object.keys(p.copy[sid])) {
        paths[S.ROOT + '/' + sid + '/' + f] = await Seal.sealOne(p.copy[sid][f], key);
        paths[S.ROOT + '/' + sid + '/_log/m' + at.toString(36) + f] = { by: 'migration', byName: '이관', at, act: 'save', field: f };
      }
    }
    Object.assign(paths, p.derive);            /* 비민감 파생값·표시도 함께 */
    const n = update(paths);
    update({ 'data/user_accounts/u': Date.now() });
    console.log('\n복사함: 금고 ' + p.count.copy + '칸(잠금) · 명부 표시·파생값 ' + Object.keys(p.derive).length + '경로 (총 ' + n + '경로)');
  } else {
    if (p.count.copy) { console.log('\n멈춤 — 아직 복사 안 된 값이 ' + p.count.copy + '칸 있습니다. 먼저 --copy'); process.exit(2); }
    const paths = Object.assign({}, p.clear, p.derive);
    const n = update(paths);
    update({ 'data/user_accounts/u': Date.now() });
    console.log('\n명부에서 비움: ' + Object.keys(p.clear).length + '칸 (표시·파생값 포함 ' + n + '경로)');
  }
  const after = plan(...Object.values(await readAll(key)));
  say(after, '다시 읽음');
  const left = mode === 'copy' ? after.count.copy : after.count.clear;
  console.log(left === 0 ? '✅ 남은 것 0' : '⚠ 남은 것 ' + left + '칸 — 다시 돌려 보세요');
  if (left) process.exit(3);
}

if (require.main === module) main().catch((e) => { console.error('오류:', e && e.message ? e.message : e); process.exit(1); });
module.exports = { plan };
