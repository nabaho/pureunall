#!/usr/bin/env node
'use strict';
/* 나스 자동 백업 — «명령 하나»로 올린다 (2026-09-18 대표 지시 「올려라」)
   ─────────────────────────────────────────────────────────────────────────
   ■ 왜 이것이 있나
     대표님이 「올려라」고 하셨는데, 클라우드에서 도는 방에는 파이어베이스 로그인이 없다.
     그래서 «로그인된 자리»에서 한 줄로 끝나게 만든다. 손으로 할 일이 셋이었다 —
     열쇠 만들기 · 서버에 넣기 · 함수 올리기. 셋 다 여기서 한다.
     (scripts/rules-deploy.js 와 같은 자리·같은 결이다)

   쓰는 법
     node scripts/nas-backup-deploy.js            ← 무엇을 할지 «보여만» 준다
     node scripts/nas-backup-deploy.js --deploy   ← 실제로 올린다

   ⚠★ 열쇠는 화면에 «한 번만» 찍는다. 파일로 남기지 않는다 —
     저장소나 로그에 남으면 그 순간 아무나 백업을 받아 갈 수 있다.
   ⚠ 이미 열쇠가 있으면 «다시 만들지 않는다». 새로 만들면 나스 스크립트의 옛 열쇠가
     조용히 죽고, 다음 주 새벽에야 안다.
   ⚠ 올린 뒤 실제로 한 번 받아 본다 — 「올렸다」와 「된다」는 다르다. */

const { execFileSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const https = require('https');

const 프로젝트 = 'pureun-erp';
const 함수 = 'nasBackupExport';
const 비밀이름 = 'NAS_BACKUP_KEY';
const 올린다 = process.argv.includes('--deploy');

function 말(s) { console.log(s); }
function 멈춤(s, code) { console.error('\n✗ ' + s); process.exit(code == null ? 1 : code); }

function fb(args, opts) {
  return execFileSync('npx', ['-y', 'firebase-tools'].concat(args), Object.assign({ encoding: 'utf8' }, opts || {}));
}

/* ── ① 로그인 확인 ────────────────────────────────────────────────────── */
function 로그인확인() {
  let out;
  try { out = fb(['login:list'], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { 멈춤('파이어베이스 CLI 를 못 불렀습니다 — 인터넷과 npx 를 확인하세요.\n  ' + ((e && e.message) || e)); }
  if (/No authorized accounts|로그인/.test(out) && !/\[.*@.*\]|Logged in as/.test(out)) {
    멈춤('파이어베이스에 로그인돼 있지 않습니다.\n  먼저: npx -y firebase-tools login');
  }
  말('① 로그인 ✓  ' + out.trim().split('\n').slice(-1)[0]);
}

/* ── ② 열쇠 — 있으면 그대로, 없으면 만들어 넣는다 ─────────────────────── */
function 열쇠준비() {
  let 있나 = false;
  try {
    const out = fb(['functions:secrets:access', 비밀이름, '--project', 프로젝트],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    있나 = !!(out && out.trim());
  } catch (_) { 있나 = false; }

  if (있나) {
    말('② 열쇠 ✓  이미 서버에 있습니다 — 다시 만들지 않습니다.');
    말('   (나스 스크립트의 열쇠를 잊으셨으면: npx -y firebase-tools functions:secrets:access ' + 비밀이름 + ' --project ' + 프로젝트 + ')');
    return null;
  }

  const 새열쇠 = crypto.randomBytes(32).toString('base64url');
  if (!올린다) { 말('② 열쇠 — 아직 없습니다. 올릴 때 새로 만들어 넣습니다.'); return '(올릴 때 만듭니다)'; }

  const r = spawnSync('npx', ['-y', 'firebase-tools', 'functions:secrets:set', 비밀이름,
    '--project', 프로젝트, '--data-file', '-'], { input: 새열쇠, encoding: 'utf8' });
  if (r.status !== 0) 멈춤('열쇠를 넣지 못했습니다.\n' + (r.stderr || r.stdout || ''));
  말('② 열쇠 ✓  새로 만들어 넣었습니다.');
  return 새열쇠;
}

/* ── ③ 함수 하나만 올린다 ────────────────────────────────────────────── */
function 올리기() {
  말('③ 함수를 올립니다 (' + 함수 + ' 하나만) …');
  const r = spawnSync('npx', ['-y', 'firebase-tools', 'deploy',
    '--only', 'functions:' + 함수, '--project', 프로젝트], { stdio: 'inherit' });
  if (r.status !== 0) 멈춤('올리지 못했습니다. 위 메시지를 보세요.');
  말('③ 올림 ✓');
}

/* ── ④ 「올렸다」와 「된다」는 다르다 — 실제로 한 번 받아 본다 ─────────── */
function 받아보기(열쇠, 주소) {
  if (!열쇠 || 열쇠 === '(올릴 때 만듭니다)') {
    말('④ 받아보기 — 열쇠를 이 자리에서 모르므로 건너뜁니다(이미 넣어 둔 열쇠로 직접 해 보세요).');
    return Promise.resolve();
  }
  return new Promise((res) => {
    https.get(주소, { headers: { 'X-Nas-Key': 열쇠 } }, (r) => {
      let n = 0;
      r.on('data', (c) => { n += c.length; });
      r.on('end', () => {
        if (r.statusCode === 200) 말('④ 받아보기 ✓  ' + Math.round(n / 1024) + 'KB 받았습니다.');
        else 말('④ 받아보기 ✗  응답 ' + r.statusCode + ' — 열쇠나 백업 유무를 확인하세요.');
        res();
      });
    }).on('error', (e) => { 말('④ 받아보기 ✗  ' + ((e && e.message) || e)); res(); });
  });
}

/* ── 달린다 ──────────────────────────────────────────────────────────── */
(async function () {
  말('\n═══ 나스 자동 백업 올리기 ' + (올린다 ? '(실제로 올립니다)' : '(보여만 줍니다 — 올리려면 --deploy)') + ' ═══\n');
  로그인확인();
  const 열쇠 = 열쇠준비();
  const 주소 = 'https://us-central1-' + 프로젝트 + '.cloudfunctions.net/' + 함수;
  if (!올린다) {
    말('\n올리면 이렇게 됩니다:');
    말('  · 함수 ' + 함수 + ' 하나만 올라갑니다(다른 함수는 안 건드립니다)');
    말('  · 주소: ' + 주소);
    말('\n실제로 올리려면:  node scripts/nas-backup-deploy.js --deploy\n');
    return;
  }
  올리기();
  await 받아보기(열쇠, 주소);

  말('\n═══ 나스에 넣을 것 ═══');
  말('  docs/나스-백업-스크립트.sh 를 DSM 작업 스케줄러에 붙여넣고, 맨 위 두 줄만 고치세요:\n');
  말('    URL="' + 주소 + '"');
  if (열쇠 && 열쇠 !== '(올릴 때 만듭니다)') {
    말('    NAS_KEY="' + 열쇠 + '"');
    말('\n  ⚠ 이 열쇠는 지금 이 화면에만 있습니다. 나스에 넣으신 뒤 이 창을 닫으세요.');
    말('  ⚠ 파일이나 채팅에 남기지 마세요 — 이것 하나로 백업 전부를 받아 갈 수 있습니다.');
  } else {
    말('    NAS_KEY="…"   ← npx -y firebase-tools functions:secrets:access ' + 비밀이름 + ' --project ' + 프로젝트);
  }
  말('');
})();
