#!/usr/bin/env node
/* 법 개정 감시 목록 만들개 — js/pu-rules-lawlink.js(연결표) + rules.html(검토 규칙) → functions/rules-lawwatch-laws.json

   왜 따로 옮기나: 서버 함수는 functions/ 폴더만 올라간다. 저장소 뿌리의 js/ 를 못 부른다.
   그렇다고 서버에 목록을 «손으로» 따로 적으면, 규칙이 새 조를 가리키게 됐을 때 서버만 모른다.
   그래서 목록의 원본은 연결표 하나로 두고 이 스크립트가 옮긴다.
   ⚠ JSON 을 손으로 고치지 말 것 — tests/rules-lawwatch-list.test.js 가 «옮긴 것과 같은가» 를 본다.

   쓰는 법:  node scripts/make-lawwatch-list.js          (파일을 새로 쓴다)
            node scripts/make-lawwatch-list.js --check  (다르면 종료코드 1) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'functions', 'rules-lawwatch-laws.json');

function rulesFromHtml() {
  const s = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8');
  const at = s.indexOf('const RULES = ');
  if (at < 0) throw new Error('rules.html 에서 검토 규칙(RULES)을 찾지 못했습니다');
  return JSON.parse(s.slice(at + 'const RULES = '.length, s.indexOf('\n', at)).replace(/;\s*$/, ''));
}

function make() {
  const K = require(path.join(ROOT, 'js', 'pu-rules-lawlink.js'));
  const laws = K.watchList(rulesFromHtml());
  return JSON.stringify({
    note: '만들개가 만든 파일 — 손으로 고치지 말 것 (scripts/make-lawwatch-list.js)',
    source: 'legalize-kr/legalize-kr',
    snapshotAt: K.SNAPSHOT_AT,
    laws: laws
  }, null, 1) + '\n';
}

module.exports = { make, OUT };

if (require.main === module) {
  const next = make();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (cur !== next) { console.error('✗ functions/rules-lawwatch-laws.json 이 낡았습니다 — node scripts/make-lawwatch-list.js'); process.exit(1); }
    console.log('✓ 감시 목록이 연결표와 같습니다');
  } else {
    fs.writeFileSync(OUT, next);
    const n = JSON.parse(next).laws.reduce((a, l) => a + l.arts.length, 0);
    console.log('✓ 감시 목록을 썼습니다 — 법 ' + JSON.parse(next).laws.length + '개 · 조 ' + n + '개');
  }
}
