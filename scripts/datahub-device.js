#!/usr/bin/env node
/* 📊 데이터관리 채팅 기기 승인 — 대표 PC 터미널에서만 (계획서 5-1, 2026-11-21)

   쓰는 법
     node scripts/datahub-device.js                              보기 — 등록 요청(지문·기기 이름·요청 시각)과 지금 승인된 기기
     node scripts/datahub-device.js --approve <지문>              미리보기 — 무엇을 쓸지만 보여 준다
     node scripts/datahub-device.js --approve <지문> --apply      승인 — 요청을 datahub_device/{대표 uid} 로 옮기고 요청을 지운다(한 번에)
     node scripts/datahub-device.js --revoke                      미리보기
     node scripts/datahub-device.js --revoke --apply              해제 — 승인된 기기와 남은 일회용 문제를 지운다
     --backup-dir <폴더>   백업을 둘 곳(기본: 내 폴더\서버백업\datahub — 저장소 밖이어야 한다)

   ■ 왜 웹이 아니라 터미널인가
     웹 로그인 세션을 훔친 사람이 «승인»까지 할 수 없게, 승인은 firebase CLI 관리자 로그인(구글 계정)으로만 한다.
     화면에 뜬 지문과 여기 찍힌 지문이 «같을 때만» 승인한다. 요청은 10분이 지나면 받지 않는다.
   ■ 쓰기 순서(메모 «서버 DB를 firebase CLI로 읽고 쓰기»)
     ① 읽기만 해서 대상 확정 → ② 저장소 밖에 백업하고 디스크에서 다시 읽어 견줌 → ③ 쓰기 직전에 다시 읽어 백업과 같은지 대조
     (다르면 쓰지 않고 멈춤) → ④ 여러 경로를 한 번에(전부 또는 전무) → ⑤ 다시 읽어 확인.
   ■ 종료코드  0 끝 · 1 오류 · 2 안전장치가 멈춤(사람이 볼 것) · 3 쓰고 나서 확인이 맞지 않음
   ⚠ 공개 열쇠는 비밀이 아니지만 화면에는 지문만 찍는다. uid 는 가려 찍는다. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const DH = require('../functions/datahub.js');

const PROJECT = 'pureun-erp';
const INSTANCE = 'pureun-erp-default-rtdb';
const REPO = path.resolve(__dirname, '..');
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const FP_RE = /^[A-Za-z0-9_-]{16}$/;

/* ── 서버(firebase CLI) — datahub-owner.js 도 이것을 쓴다 ─────────────────── */
/* ⚠ 윈도우에서 firebase.cmd 는 셸을 거쳐야 돈다 — 셸로 넘기는 인자는 «안전한 글자»만 받는다(빈칸·따옴표·&|<>^% 등이 있으면 멈춤).
     자리·uid·지문은 위 모양 검사를 이미 지났고, 임시 파일은 아래 update 가 mkdtemp 로 만든 경로다(보안 검토 2026-11-21). */
const SAFE_ARG_RE = /^[A-Za-z0-9_\-\/.:\\]+$/;
function fb(args) {
  const isWin = process.platform === 'win32';
  const all = args.concat(['--project', PROJECT, '--instance', INSTANCE]);
  for (const a of all) if (!SAFE_ARG_RE.test(String(a))) throw new Error('셸로 넘길 수 없는 글자가 든 인자입니다 — 멈춥니다.');
  return execFileSync(isWin ? 'firebase.cmd' : 'firebase', all,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: isWin,
      env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) });
}
function get(p) {
  const t = String(fb(['database:get', p]) || '').trim();
  return t && t !== 'null' ? JSON.parse(t) : null;
}
function update(paths) {
  const keys = Object.keys(paths);
  if (!keys.length) return 0;
  /* 임시 파일 — 이 실행만의 새 폴더(mkdtemp)에 «없을 때만 만들기»(wx)로. 이름을 미리 알 수 없어 남이 끼워 넣지 못한다 */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datahub-cli-'));
  const tmp = path.join(dir, 'patch.json');
  try {
    fs.writeFileSync(tmp, JSON.stringify(paths), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fb(['database:update', '/', tmp, '-f']);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 임시 폴더 */ }
  }
  return keys.length;
}
/* 터미널에 찍는 글 — 제어 문자·방향 바꾸기 문자를 걷어 낸다(기기 이름은 화면에서 들어온 글이다) */
function plain(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ''); }
function defaultBackupDir() { return path.join(os.homedir(), '서버백업', 'datahub'); }
/* 저장소 자리 — 이 작업 폴더만이 아니라 원본 체크아웃과 «모든» 작업 폴더(git worktree)를 저장소로 본다.
   대표 uid·기기 백업이 어느 체크아웃에든 들어가면 커밋에 섞일 수 있다(보안 재검토 2026-11-21) */
function repoRoots() {
  const roots = [REPO];
  try {
    const out = execFileSync('git', ['-C', REPO, 'worktree', 'list', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    out.split(/\r?\n/).forEach((l) => { if (l.startsWith('worktree ')) roots.push(path.resolve(l.slice(9).trim())); });
  } catch (e) {
    return null;   /* 작업 폴더 목록을 못 읽으면 «모른다» — 백업을 멈춘다(보안 2차 재검증: 모르면 닫는다) */
  }
  return roots;
}
function insideAny(p, roots) {
  return roots.some((r) => { const rel = path.relative(r, p); return !rel || (!rel.startsWith('..') && !path.isAbsolute(rel)); });
}
function insideRepo(dir) {
  const roots = repoRoots();
  if (!roots) return true;   /* 모르면 저장소 안으로 본다 → writeBackup 이 멈춘다 */
  return insideAny(path.resolve(dir), roots);
}
/* 백업을 쓰고 디스크에서 다시 읽어 같은지 본다 — 다르면 던진다 */
function writeBackup(dir, name, value) {
  if (insideRepo(dir)) throw new Error('백업 폴더가 저장소 안입니다 — 저장소 밖 폴더를 --backup-dir 로 주세요.');
  fs.mkdirSync(dir, { recursive: true });
  /* 바로가기(심볼릭 링크)로 저장소 안을 가리키는 길도 막는다 — 실제 경로로 한 번 더 */
  const real = fs.realpathSync(dir);
  const roots = repoRoots();
  const realRoots = (roots || []).map((r) => { try { return fs.realpathSync(r); } catch (e) { return r; } });
  if (!roots || insideAny(real, realRoots)) {
    throw new Error('백업 폴더의 실제 자리가 저장소 안입니다 — 저장소 밖 폴더를 --backup-dir 로 주세요.');
  }
  const file = path.join(real, name + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + require('crypto').randomBytes(4).toString('hex') + '.json');
  const text = JSON.stringify(value, null, 2);
  fs.writeFileSync(file, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });   /* 있던 파일을 덮지 않는다 */
  if (fs.readFileSync(file, 'utf8') !== text) throw new Error('백업을 다시 읽으니 내용이 다릅니다.');
  return file;
}
function same(a, b) { return JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b); }
function mask(uid) { const s = String(uid || ''); return s.length > 8 ? s.slice(0, 4) + '…' + s.slice(-2) : (s ? '…' : '(없음)'); }
function kst(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '(모름)';
  return new Date(n + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' (서울)';
}

/* ── 판단(순수) — 검사가 그대로 돌린다 ─────────────────────────────────── */
/* state: {owner, req, cur} — 서버에서 읽은 그대로 */
function planApprove(state, fp, now) {
  const uid = state && state.owner;
  if (typeof uid !== 'string' || !UID_RE.test(uid)) return { ok: false, why: '대표 표지(app_owner/uid)가 없습니다 — 먼저 scripts/datahub-owner.js 로 넣어 주세요.' };
  if (typeof fp !== 'string' || !FP_RE.test(fp)) return { ok: false, why: '지문은 화면에 뜬 16자를 그대로 주세요.' };
  const req = state.req;
  if (!req || typeof req !== 'object') return { ok: false, why: '등록 요청이 없습니다 — 화면에서 «이 컴퓨터 등록 요청»을 먼저 눌러 주세요.' };
  const jwk = DH.normalizeJwk(req.pub);
  if (!jwk) return { ok: false, why: '요청의 공개 열쇠 모양이 맞지 않습니다.' };
  const realFp = DH.fingerprint(jwk);
  if (realFp !== req.fp) return { ok: false, why: '요청에 적힌 지문과 공개 열쇠가 맞지 않습니다.' };
  if (realFp !== fp) return { ok: false, why: '화면의 지문과 서버의 요청 지문이 다릅니다 — 아무것도 쓰지 않습니다.' };
  const at = Number(req.at);
  if (!Number.isFinite(at) || at <= 0 || at > now + DH.LIMITS.clockSkewMs) return { ok: false, why: '요청 시각이 이상합니다.' };
  if (now - at > DH.LIMITS.reqTtlMs) return { ok: false, why: '요청이 10분을 넘었습니다 — 화면에서 다시 요청해 주세요.' };
  const name = String(req.name || '').trim().slice(0, DH.LIMITS.nameMax) || '(이름 없음)';
  const patch = {};
  patch['datahub_device/' + uid] = { pub: jwk, fp: realFp, name: name, approvedAt: now };
  patch['datahub_device_req/' + uid] = null;
  patch['datahub_nonce/' + uid] = null;
  return { ok: true, uid: uid, fp: realFp, name: name, replaces: !!(state.cur && state.cur.fp), patch: patch };
}
function planRevoke(state) {
  const uid = state && state.owner;
  if (typeof uid !== 'string' || !UID_RE.test(uid)) return { ok: false, why: '대표 표지(app_owner/uid)가 없습니다.' };
  if (!state.cur) return { ok: true, nothing: true, uid: uid, patch: {} };
  const patch = {};
  patch['datahub_device/' + uid] = null;
  patch['datahub_nonce/' + uid] = null;
  return { ok: true, uid: uid, fp: state.cur.fp || '', patch: patch };
}
function argOf(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length && !String(argv[i + 1]).startsWith('--') ? String(argv[i + 1]) : null;
}

/* ── 실행 — io 를 갈아 끼우면 검사가 서버 없이 돌린다 ──────────────────── */
function readState(io) {
  const owner = io.get('/app_owner/uid');
  if (typeof owner !== 'string' || !UID_RE.test(owner)) return { owner: null, req: null, cur: null };
  return { owner: owner, req: io.get('/datahub_device_req/' + owner), cur: io.get('/datahub_device/' + owner) };
}
function show(io, st, now) {
  io.log('대표 표지: ' + mask(st.owner));
  if (st.req && typeof st.req === 'object') {
    const age = Math.round((now - Number(st.req.at)) / 60000);
    io.log('등록 요청: 지문 ' + plain(st.req.fp) + ' · 기기 «' + plain(st.req.name) + '» · ' + kst(st.req.at) +
      ' (' + age + '분 전' + (now - Number(st.req.at) > DH.LIMITS.reqTtlMs ? ' — 10분이 넘어 승인할 수 없음' : '') + ')');
  } else io.log('등록 요청: 없음');
  if (st.cur && typeof st.cur === 'object') {
    io.log('승인된 기기: 지문 ' + plain(st.cur.fp) + ' · 기기 «' + plain(st.cur.name) + '» · 승인 ' + kst(st.cur.approvedAt));
  } else io.log('승인된 기기: 없음');
}

const USAGE = '쓰는 법: node scripts/datahub-device.js [--approve <지문> | --revoke] [--apply] [--backup-dir <폴더>] — 자세히는 파일 머리말';
function main(argv, io) {
  /* 도움말은 서버를 읽지 않고 끝낸다 */
  if (argv.includes('--help') || argv.includes('-h')) { io.log(USAGE); return 0; }
  const now = io.now();
  const apply = argv.includes('--apply');
  const approveFp = argOf(argv, '--approve');
  const revoke = argv.includes('--revoke');
  if (argv.includes('--approve') && !approveFp) { io.log('✋ --approve 뒤에 화면의 지문 16자를 주세요.'); return 2; }
  if (approveFp && revoke) { io.log('✋ --approve 와 --revoke 는 함께 쓸 수 없습니다.'); return 2; }
  const backupDir = argOf(argv, '--backup-dir') || defaultBackupDir();

  const st = readState(io);
  show(io, st, now);
  if (!approveFp && !revoke) { io.log('\n보여만 줬습니다. 승인: --approve <지문> --apply · 해제: --revoke --apply'); return 0; }

  const plan = approveFp ? planApprove(st, approveFp, now) : planRevoke(st);
  if (!plan.ok) { io.log('\n✋ 멈춤 — ' + plan.why); return 2; }
  if (plan.nothing) { io.log('\n풀 기기가 없습니다 — 할 일 없음.'); return 0; }
  io.log('\n쓸 것(' + Object.keys(plan.patch).length + '경로, 한 번에): ' +
    (approveFp ? '기기 승인 지문 ' + plan.fp + ' «' + plan.name + '»' + (plan.replaces ? ' — 옛 기기는 풀림' : '') + ' · 요청·일회용 문제 지움'
      : '기기 해제 지문 ' + plan.fp + ' · 일회용 문제 지움'));
  if (!apply) { io.log('미리보기만 했습니다 — 쓰려면 --apply 를 붙이세요.'); return 0; }

  /* ② 백업 → 다시 읽어 견줌 */
  let file;
  try { file = io.writeBackup(backupDir, approveFp ? 'device-approve' : 'device-revoke', { at: now, owner: st.owner, req: st.req, cur: st.cur }); }
  catch (e) { io.log('✋ 멈춤 — 백업 실패: ' + (e && e.message ? e.message : e)); return 2; }
  io.log('백업: ' + file);
  /* ③ 쓰기 직전에 다시 읽어 백업과 같은가 */
  const again = readState(io);
  if (!same(again, st)) { io.log('✋ 멈춤 — 백업한 뒤 서버 값이 바뀌었습니다(다른 요청이 들어왔을 수 있음). 다시 보고 돌려 주세요.'); return 2; }
  /* ④ 한 번에 */
  io.update(plan.patch);
  /* ⑤ 다시 읽어 확인 */
  const after = readState(io);
  const good = approveFp
    ? (after.cur && after.cur.fp === plan.fp && !after.req)
    : !after.cur;
  io.log(good ? '✅ 끝 — 다시 읽어 확인했습니다.' : '⚠ 쓰고 나서 다시 읽은 값이 기대와 다릅니다 — 보기로 다시 확인해 주세요.');
  return good ? 0 : 3;
}

const cli = { fb, get, update, writeBackup, defaultBackupDir, insideRepo, same, mask, kst, UID_RE };

if (require.main === module) {
  try {
    const code = main(process.argv.slice(2), { get, update, writeBackup, now: Date.now, log: (m) => console.log(m) });
    process.exit(code);
  } catch (e) {
    console.error('오류:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

module.exports = { planApprove, planRevoke, main, readState, cli };
