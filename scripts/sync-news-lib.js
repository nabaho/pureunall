#!/usr/bin/env node
/* 뉴스레터 짓개를 서버(functions/news-lib/)로 «글자 그대로» 옮긴다 (2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-27 「매주 금요일 13시에 자동으로 기사와 내용을 정리해서 저장하고
   월요일에 자동으로 보낼수 있게」 — 금요일에는 아무도 화면을 안 연다. 그래서 편지를
   «서버가» 지어야 한다.

   ⚠⚠ 서버 배포에는 js/ 가 안 올라간다(functions/ 만 올라간다). 그래서 사본을 둔다.
     사본을 «손으로» 고치면 화면과 서버가 다른 편지를 짓는다 — 금요일에 만든 편지와
     대표님이 화면에서 보신 편지가 달라진다. 그래서:
       · 고칠 곳은 늘 js/ 쪽이다. 고친 뒤 이것을 돌린다:  node scripts/sync-news-lib.js
       · tests/news-lib-in-sync.test.js 가 둘이 한 글자라도 다르면 걸린다.
   ⚠ 옮긴 뒤에는 서버 함수도 다시 올려야 금요일 편지에 반영된다
       (weeklyNewsletterPrepare · weeklyNewsletterSend). */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
const 옮길것 = ['pu-news-core.js', 'pu-news-tpl.js', 'pu-news-show.js'];
const 밖 = path.join(뿌리, 'functions', 'news-lib');

function 옮기기() {
  fs.mkdirSync(밖, { recursive: true });
  const 바뀜 = [];
  옮길것.forEach(function (이름) {
    const 원본 = fs.readFileSync(path.join(뿌리, 'js', 이름));
    const 사본자리 = path.join(밖, 이름);
    const 옛 = fs.existsSync(사본자리) ? fs.readFileSync(사본자리) : null;
    if (!옛 || !옛.equals(원본)) { fs.writeFileSync(사본자리, 원본); 바뀜.push(이름); }
  });
  return 바뀜;
}

if (require.main === module) {
  const 바뀜 = 옮기기();
  console.log(바뀜.length ? '옮김: ' + 바뀜.join(', ') + ' → functions/news-lib/' : '이미 같습니다');
}

module.exports = { 옮길것, 옮기기 };
