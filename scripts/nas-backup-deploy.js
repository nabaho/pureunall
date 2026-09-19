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
const fs = require('fs');
const path = require('path');

const 프로젝트 = 'pureun-erp';
const 함수 = 'nasBackupExport';
const 비밀이름 = 'NAS_BACKUP_KEY';
const 올린다 = process.argv.includes('--deploy');

function 말(s) { console.log(s); }
function 멈춤(s, code) { console.error('\n✗ ' + s); process.exit(code == null ? 1 : code); }

/* ⚠★ 윈도우에서 「spawnSync npx ENOENT」로 걸리던 자리 (2026-09-18 대표 화면)
   ── 무엇이 있었나
     npx 는 원래 있었다 — 대표님 PC 에서 이미 여러 번 npx 를 쓰셨다(firebase-tools 를
     그렇게 부르고 있었다). 그런데도 이 스크립트만 「ENOENT」로 못 찾았다.
   ── 까닭
     윈도우에서 npx 는 실제로 `npx.cmd` 라는 «배치 파일»이다. Node 의 spawnSync·
     execFileSync 는 shell:true 를 안 주면 그 .cmd 확장자를 붙여 찾지 않는다 —
     PATH 에 있어도 못 찾는다(node 자체의 잘 알려진 윈도우 한계다).
     맥·리눅스에서는 npx 가 진짜 실행 파일이라 이 문제가 안 생겨서 여기서는
     못 봤다. **남의 PC(더구나 다른 운영체제)에서 도는 것은 여기서 시험 못 한다** —
     그래서 셋 다 shell:true 를 준다(값은 전부 이 파일 안의 고정 글자뿐이라 안전하다). */
function fb(args, opts) {
  return execFileSync('npx', ['-y', 'firebase-tools'].concat(args),
    Object.assign({ encoding: 'utf8', shell: true }, opts || {}));
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
  /* ⚠★★ 「이미 있다」고 값을 «버리던» 자리 (2026-09-19 대표 화면 — 붙여넣을 것을 두 번째부터 못 줬다)
     ── 무엇이 있었나
       처음 --deploy 했을 때는 열쇠를 새로 만들어 클립보드에 완성 스크립트를 담아 줬다.
       나스 화면을 만지시다 클립보드가 다른 것으로 덮이자 「다시 올려달라」고 다시 --deploy 를
       돌리셨는데, 이번엔 «준비만 하고» 아무것도 안 담겼다.
     ── 까닭
       존재 확인을 위해 이미 `functions:secrets:access` 로 «진짜 값»을 받아 왔으면서,
       있는 줄 알면 그 값을 그대로 버리고 null 을 돌려줬다. 값을 이미 손에 쥐고도
       «몰라서 못 준다»고 말한 것이다. 아래 나스스크립트만들기·클립보드에 는 열쇠가
       있어야 도는데, null 을 받으면 조용히 건너뛴다.
     ── 그래서
       이미 있으면 «그 값 그대로» 돌려준다. 새로 만드는 것도 서버에 쓰는 것도 아니다 —
       존재를 확인하며 이미 읽은 값을 재사용할 뿐이라 위험이 없다. */
  let 기존값 = null;
  try {
    const out = fb(['functions:secrets:access', 비밀이름, '--project', 프로젝트],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    기존값 = (out && out.trim()) ? out.trim() : null;
  } catch (_) { 기존값 = null; }

  if (기존값) {
    말('② 열쇠 ✓  이미 서버에 있습니다 — 다시 만들지 않습니다.');
    return 기존값;
  }

  const 새열쇠 = crypto.randomBytes(32).toString('base64url');
  if (!올린다) { 말('② 열쇠 — 아직 없습니다. 올릴 때 새로 만들어 넣습니다.'); return '(올릴 때 만듭니다)'; }

  const r = spawnSync('npx', ['-y', 'firebase-tools', 'functions:secrets:set', 비밀이름,
    '--project', 프로젝트, '--data-file', '-'], { input: 새열쇠, encoding: 'utf8', shell: true });
  if (r.status !== 0) 멈춤('열쇠를 넣지 못했습니다.\n' + (r.stderr || r.stdout || ''));
  말('② 열쇠 ✓  새로 만들어 넣었습니다.');
  return 새열쇠;
}

/* ── ③ 함수 하나만 올린다 ────────────────────────────────────────────── */
function 올리기() {
  말('③ 함수를 올립니다 (' + 함수 + ' 하나만) …');
  const r = spawnSync('npx', ['-y', 'firebase-tools', 'deploy',
    '--only', 'functions:' + 함수, '--project', 프로젝트], { stdio: 'inherit', shell: true });
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

/* ── ⑤ 나스에 붙여넣을 것을 «완성해서» 손에 쥐어 준다 ────────────────────
   ⚠★ 파일로 안 남긴다. 클립보드는 잠깐 있다 사라지지만 파일은 남는다 —
     열쇠가 든 파일 하나면 백업 전부를 받아 갈 수 있다.
   ⚠ 대표님이 하실 일을 «Ctrl+V 한 번»으로 줄인다. 두 줄을 찾아 고치게 하지 않는다
     (2026-09-18 「제발 한번에 할 수 있게」). */
function 나스스크립트만들기(열쇠, 주소) {
  const 자리 = path.join(__dirname, '..', 'docs', '나스-백업-스크립트.sh');
  let 글 = fs.readFileSync(자리, 'utf8');
  글 = 글.replace(/^NAS_KEY=.*$/m, 'NAS_KEY="' + 열쇠 + '"');
  글 = 글.replace(/^URL=.*$/m, 'URL="' + 주소 + '"');
  if (글.indexOf(열쇠) < 0) 멈춤('나스 스크립트에 열쇠를 못 넣었습니다 — docs/나스-백업-스크립트.sh 의 NAS_KEY= 줄을 확인하세요');
  return 글;
}

/* 윈도우의 clip 으로 넣는다. 안 되면 화면에 통째로 찍어 «그래도 손에 쥐어» 준다. */
function 클립보드에(글) {
  if (process.platform !== 'win32') return false;
  const r = spawnSync('clip', [], { input: 글, encoding: 'utf8', shell: true });
  return r.status === 0;
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
  if (열쇠 && 열쇠 !== '(올릴 때 만듭니다)') {
    const 완성 = 나스스크립트만들기(열쇠, 주소);
    const 됐나 = 클립보드에(완성);
    if (됐나) {
      말('  ✓ 나스에 넣을 스크립트를 «복사해 두었습니다». 고칠 것이 없습니다.');
      말('');
      말('  나스에서: 제어판 → 작업 스케줄러 → 생성 → 예약된 작업 → 사용자 정의 스크립트');
      말('           → 「작업 설정」 탭의 «사용자 정의 스크립트» 칸에서  Ctrl+V');
      말('           → 일정: 매주 · 월요일 · 03:00');
      말('');
      말('  ⚠ 이 복사본에는 열쇠가 들어 있습니다. 나스에 넣으신 뒤 다른 곳에 붙여넣지 마세요.');
    } else {
      말('  아래를 통째로 복사해 나스 「사용자 정의 스크립트」 칸에 붙여넣으세요:\n');
      말('────────────────────────────────────────────────────────────');
      말(완성);
      말('────────────────────────────────────────────────────────────');
    }
  } else {
    말('  열쇠가 이미 서버에 있어 여기서는 모릅니다. 꺼내려면:');
    말('    npx -y firebase-tools functions:secrets:access ' + 비밀이름 + ' --project ' + 프로젝트);
    말('  그 값을 docs/나스-백업-스크립트.sh 의 NAS_KEY= 줄에 넣으세요.');
    말('    URL="' + 주소 + '"');
  }
  말('');
})();
