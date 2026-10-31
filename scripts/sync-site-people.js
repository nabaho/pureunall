#!/usr/bin/env node
/* 새 사이트 구성원 쪽을 그리는 부품(js/pu-site-people.js)을 서버(functions/site-people/)로 «글자 그대로» 옮긴다 (2026-10-31)
   ⚠⚠ 서버 배포에는 js/ 가 안 올라간다(functions/ 만 올라간다). 그래서 사본을 둔다 — scripts/sync-gov-report-core.js 와 같은 방식이다.
     매달 1일 자동 연결이 새 사이트 구성원 쪽을 다시 만들 때 이 사본을 쓴다. 화면의 「새 사이트에 올리기」는 js/ 원본을 쓴다.
     둘이 갈라지면 미리보기와 자동으로 올라가는 쪽이 달라진다.
       · 고칠 곳은 늘 js/ 쪽이다. 고친 뒤 이것을 돌린다:  node scripts/sync-site-people.js
       · tests/site-people-in-sync.test.js 가 한 글자라도 다르면 걸린다.
   ⚠ 옮긴 뒤에는 서버 함수도 다시 올려야 반영된다 — monthlyHomepageAuto. */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
const 이름 = 'pu-site-people.js';
const 밖 = path.join(뿌리, 'functions', 'site-people');

if (require.main === module) {
  fs.mkdirSync(밖, { recursive: true });
  fs.copyFileSync(path.join(뿌리, 'js', 이름), path.join(밖, 이름));
  console.log('옮김: js/' + 이름 + ' → functions/site-people/' + 이름);
}

module.exports = { 이름, 밖 };
