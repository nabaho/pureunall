#!/usr/bin/env node
/* 취업규칙 «🤖 매일 정리» 셈(js/rules-v2/lib-daily.js 와 그 옆 모듈들)을 서버(functions/rules-daily-core/)로 «글자 그대로» 옮긴다 (2026-10-31, 설계 §14-5)
   ⚠⚠ 서버 배포에는 js/ 가 안 올라간다(functions/ 만 올라간다). 그래서 사본을 둔다 — 컨설팅보고서 자동 처리(scripts/sync-gov-report-core.js)와 같은 방식이다.
     사본을 «손으로» 고치면 화면의 🧹 정리하기와 서버의 자동 확정이 다른 회사를 고른다.
       · 고칠 곳은 늘 js/rules-v2/ 쪽이다. 고친 뒤 이것을 돌린다:  node scripts/sync-rules-daily-core.js
       · tests/rules-daily-core-in-sync.test.js 가 한 글자라도 다르면 걸린다 — 옮길 목록이 require 를 따라간 결과와 다른 것도 거기서 걸린다.
   ★ 옮길 목록은 손으로 적지 않는다 — lib-daily.js 에서 시작해 require('./…') 를 따라가 모은다(lib-daily → lib-tidy → lib-order·lib-topics).
   ⚠ 옮긴 뒤에는 서버 함수도 다시 올려야 반영된다 — collectRulesMail·collectRulesMailAsk(회차 끝에 매일 정리가 돈다). */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
const 원본폴더 = path.join(뿌리, 'js', 'rules-v2');
const 시작 = 'lib-daily.js';
const 밖 = path.join(뿌리, 'functions', 'rules-daily-core');

/* 시작 파일에서 require('./이름') 을 따라가 모은 파일 이름들(시작 포함). 폴더 밖·모듈 이름(./ 아닌 것)은 따라가지 않는다 */
function 따라가기(폴더, 처음) {
  const 본 = [];
  (function 걷기(이름) {
    if (본.indexOf(이름) >= 0) return;
    const 자리 = path.join(폴더, 이름);
    if (!fs.existsSync(자리)) throw new Error('require 를 따라갔는데 파일이 없습니다: ' + 이름 + ' (' + 폴더 + ')');
    본.push(이름);
    const 글 = fs.readFileSync(자리, 'utf8');
    const 식 = /require\(\s*['"]\.\/([^'"\/]+)['"]\s*\)/g;
    let m;
    while ((m = 식.exec(글))) 걷기(/\.js$/.test(m[1]) ? m[1] : m[1] + '.js');
  })(처음);
  return 본;
}

const 옮길것 = 따라가기(원본폴더, 시작);

function 옮기기() {
  fs.mkdirSync(밖, { recursive: true });
  const 바뀜 = [];
  옮길것.forEach(function (이름) {
    const 원본 = fs.readFileSync(path.join(원본폴더, 이름));
    const 사본자리 = path.join(밖, 이름);
    const 옛 = fs.existsSync(사본자리) ? fs.readFileSync(사본자리) : null;
    if (!옛 || !옛.equals(원본)) { fs.writeFileSync(사본자리, 원본); 바뀜.push(이름); }
  });
  /* 더는 필요 없는 옛 사본은 지운다(이 폴더는 이 스크립트만 만든다) */
  fs.readdirSync(밖).forEach(function (이름) {
    if (옮길것.indexOf(이름) < 0) { fs.unlinkSync(path.join(밖, 이름)); 바뀜.push('−' + 이름); }
  });
  return 바뀜;
}

if (require.main === module) {
  const 바뀜 = 옮기기();
  console.log(바뀜.length ? '옮김: ' + 바뀜.join(', ') + ' → functions/rules-daily-core/' : '이미 같습니다');
}

module.exports = { 옮길것, 시작, 원본폴더, 따라가기, 옮기기 };
