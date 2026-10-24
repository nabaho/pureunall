#!/usr/bin/env node
/* 일정 후보 걸러내기 규칙을 서버(functions/cal-lib/)로 «글자 그대로» 옮긴다 (2026-10-24)
   ⚠ 서버 배포에는 js/ 가 안 올라간다 — 그래서 사본을 둔다(sync-kakao-lib.js 와 같은 까닭).
     고칠 곳은 늘 js/pu-cal-capture.js 다. 고친 뒤:  node scripts/sync-cal-lib.js
     tests/cal-inbox.test.js 가 둘이 한 글자라도 다르면 걸린다.
   ⚠ 옮긴 뒤에는 syncMailbox 를 다시 올려야 서버 규칙이 바뀐다(메일 일정 후보함이 쓴다). */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
const 원본자리 = path.join(뿌리, 'js', 'pu-cal-capture.js');
const 사본자리 = path.join(뿌리, 'functions', 'cal-lib', 'pu-cal-capture.js');

function 옮기기() {
  fs.mkdirSync(path.dirname(사본자리), { recursive: true });
  const 원본 = fs.readFileSync(원본자리);
  const 옛 = fs.existsSync(사본자리) ? fs.readFileSync(사본자리) : null;
  if (옛 && 옛.equals(원본)) return false;
  fs.writeFileSync(사본자리, 원본);
  return true;
}

if (require.main === module) {
  console.log(옮기기() ? '옮김: pu-cal-capture.js → functions/cal-lib/' : '이미 같습니다');
}

module.exports = { 원본자리, 사본자리, 옮기기 };
