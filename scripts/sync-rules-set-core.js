#!/usr/bin/env node
/* 기업규정집 «분류» 셈(js/rules-v2/lib-set.js)을 서버(functions/rules-set-core/)로 «글자 그대로» 옮긴다 (2026-11-01)
   ⚠⚠ 서버 배포에는 js/ 가 안 올라간다(functions/ 만 올라간다). 그래서 사본을 둔다 — scripts/sync-rules-daily-core.js 와 같은 까닭이다.
     사본을 «손으로» 고치면 서버가 찍는 분류(doc.set)와 화면이 이름으로 짐작하는 분류가 어긋나 같은 서류가 두 분류에 보인다.
       · 고칠 곳은 늘 js/rules-v2/lib-set.js 쪽이다. 고친 뒤 이것을 돌린다:  node scripts/sync-rules-set-core.js
       · tests/rules-set-core-in-sync.test.js 가 한 글자라도 다르면 걸린다.
   ⚠ 옮긴 뒤에는 서버 함수도 다시 올려야 반영된다 — collectRulesMail·collectRulesMailAsk. */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
const 원본 = path.join(뿌리, 'js', 'rules-v2', 'lib-set.js');
const 밖 = path.join(뿌리, 'functions', 'rules-set-core');
const 사본 = path.join(밖, 'lib-set.js');

function 옮기기() {
  fs.mkdirSync(밖, { recursive: true });
  const 글 = fs.readFileSync(원본);
  const 옛 = fs.existsSync(사본) ? fs.readFileSync(사본) : null;
  if (옛 && 옛.equals(글)) return false;
  fs.writeFileSync(사본, 글);
  return true;
}

if (require.main === module) console.log(옮기기() ? '옮김: lib-set.js → functions/rules-set-core/' : '이미 같습니다');
module.exports = { 원본, 사본, 옮기기 };
