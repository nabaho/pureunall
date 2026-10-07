#!/usr/bin/env node
/* 메일로 업체 담당자 채우기 셈(js/pu-mail-fill-core.js)을 서버(functions/mail-fill-core/)로 «글자 그대로» 옮긴다 (2026-10-07 점검 ③-A)
   ⚠⚠ 서버 배포에는 js/ 가 안 올라간다(functions/ 만 올라간다). 그래서 사본을 둔다 — 뉴스레터
     (scripts/sync-news-lib.js)와 같은 방식이다. 사본을 «손으로» 고치면 화면과 서버가 다르게 센다.
       · 고칠 곳은 늘 js/ 쪽이다. 고친 뒤 이것을 돌린다:  node scripts/sync-mail-fill-core.js
       · tests/mail-fill-core-in-sync.test.js 가 둘이 한 글자라도 다르면 걸린다.
   ⚠ 옮긴 뒤에는 서버 함수도 다시 올려야 반영된다 — mailSync(메일 동기화가 부른다). */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
/* ⚠ 업체 저장 관문(pu-company-write·pu-ontology-write·pu-ontology)은 «안» 옮긴다 — pu-ontology.js 는
   여러 방이 하루에도 몇 번씩 고쳐서, 사본을 두면 남의 PR 이 같음 검사에 걸린다. 서버(functions/mail-fill.js)는
   같은 도장을 스스로 찍고, tests/mail-fill-core-in-sync.test.js 가 «관문과 같은 결과인가»를 견준다. */
const 옮길것 = ['pu-mail-fill-core.js'];
const 밖 = path.join(뿌리, 'functions', 'mail-fill-core');

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
  console.log(바뀜.length ? '옮김: ' + 바뀜.join(', ') + ' → functions/mail-fill-core/' : '이미 같습니다');
}

module.exports = { 옮길것, 옮기기 };
