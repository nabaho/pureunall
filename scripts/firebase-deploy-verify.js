#!/usr/bin/env node
/* «Firebase 배포» 작업이 서버 함수를 «정말» 올렸는지 함수마다 대조한다 (2026-11-16 대표 「남은거 모두해라」)

   ■ 왜 — 2026-11-15 실행(43715591212)이 함수 여덟 개 가운데 weeklyNewsletterPrepare·newsletterSundayRefill 을
     못 올리고도 «성공»으로 끝났다. 로그에는 「⚠ functions: failed to update function …」 경고만 있었고
     firebase-tools 는 종료코드 0 을 냈다. gcloud 갱신 시각을 보고서야 알았다(그 둘만 다시 올렸다).

   ■ 어떻게 — firebase deploy 로그에서 이름마다
       「✔ functions[이름(지역)] Successful update operation.」(새로 만들면 create)
     줄을 찾는다. 한 번 「failed to update」가 났어도 뒤에 Successful 이 있으면 올라간 것이다
     (같은 실행에서 newsFullPage 가 그랬다 — 경고 뒤에 Successful, gcloud 로도 올라가 있었다).
     「Skipped (No changes detected)」는 바뀐 것이 없어 안 올린 것 — 올라간 것으로 치되 따로 알린다.

       node scripts/firebase-deploy-verify.js "이름1,이름2" 로그파일
         → 표준출력: 안 올라간 이름들(쉼표로) — 모두 됐으면 빈 줄
         → 표준오류: 사람이 읽는 요약
         → 종료코드 0 모두 됨 · 2 안 올라간 것이 있음 · 1 잘못 불렀음

   ⚠ 이름은 firebase-deploy-check.js 와 같은 잣대(영문·숫자·_)로만 받는다 — 표준출력이 다음 배포의 이름이 된다.
   ⚠ 로그 글자를 셸로 돌리지 않는다. 읽기만 한다. */
'use strict';
const fs = require('fs');

/* 로그의 색 표지(ESC[32m …)를 걷는다 — 표지가 이름 사이에 끼어 있다 */
function plain(s) {
  return String(s == null ? '' : s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\^\[\[[0-9;]*m/g, '');
}
function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function verify(raw, log) {
  const names = String(raw == null ? '' : raw).split(',').map((s) => s.trim()).filter(Boolean)
    .filter((n, i, a) => a.indexOf(n) === i);
  if (!names.length) return { ok: false, why: '대조할 함수 이름이 없습니다' };
  const bad = names.filter((n) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(n));
  if (bad.length) return { ok: false, why: '이름에 쓸 수 없는 글자가 있습니다: ' + bad.join(', ') };
  const t = plain(log);
  const done = [], skipped = [], missing = [];
  names.forEach((n) => {
    /* ★ 이름 바로 뒤에 「(지역)」 — newsFull 이 newsFullPage 줄에 걸리지 않게 */
    const head = 'functions\\[' + esc(n) + '\\([^)\\]]*\\)\\]';
    if (new RegExp(head + '\\s+Successful (?:update|create) operation').test(t)) done.push(n);
    else if (new RegExp(head + '\\s+Skipped\\b').test(t)) skipped.push(n);
    else missing.push(n);
  });
  return { ok: true, done, skipped, missing };
}

function summary(r) {
  if (!r.ok) return '✋ ' + r.why;
  const lines = ['함수별 배포 대조 — 올라감 ' + r.done.length + ' · 바뀐 것 없어 건너뜀 ' + r.skipped.length
    + ' · 안 올라감 ' + r.missing.length];
  if (r.done.length) lines.push('  ✔ ' + r.done.join(', '));
  if (r.skipped.length) lines.push('  ↷ ' + r.skipped.join(', '));
  if (r.missing.length) lines.push('  ✖ ' + r.missing.join(', ') + '  ← 로그에 «Successful» 줄이 없습니다');
  return lines.join('\n');
}

if (require.main === module) {
  let log = '';
  try { log = fs.readFileSync(process.argv[3] || '', 'utf8'); }
  catch (e) { console.error('✋ 배포 로그를 못 읽었습니다: ' + (process.argv[3] || '(없음)')); process.exit(1); }
  const r = verify(process.argv[2], log);
  console.error(summary(r));
  if (!r.ok) process.exit(1);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + summary(r) + '\n```\n'); } catch (_) { /* 요약 칸은 덤이다 */ }
  }
  process.stdout.write(r.missing.join(','));
  process.exit(r.missing.length ? 2 : 0);
}

module.exports = { verify, summary, plain };
