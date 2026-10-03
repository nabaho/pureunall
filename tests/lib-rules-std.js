/* 검사 도우미 — 표준취업규칙(std_2026.js) 을 rules.html 과 «같은 칼»로 조 단위로 쪼갠다.
   판정(js/pu-rules-criteria.js)을 고정 자료와 견주려면 조 쪼개기도 화면과 같아야 한다.
   ⚠ parseArticles 는 판정이 아니라 원문 읽기라 rules.html 에 남는다 — 그래서 사본을 두지 않고
     rules.html 에서 글자로 오려 vm 으로 돌린다(사본을 두면 화면만 바뀌어도 검사가 모른다).
   오리는 범위: stripWs · 조 머리 괄호(BR_*) · RE_HEAD/RE_TITLE 등 · 목차 걷기(stripToc) · parseArticles. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8').replace(/\r\n/g, '\n');

function cut(from, to) {
  const a = src.indexOf(from);
  if (a < 0) throw new Error('rules.html 에서 「' + from + '」를 못 찾았습니다 — 이름이 바뀌었는지 보세요');
  const b = src.indexOf(to, a);
  if (b < 0) throw new Error('rules.html 에서 「' + from + '」 뒤 「' + to + '」를 못 찾았습니다');
  return src.slice(a, b);
}

const ctx = {};
vm.createContext(ctx);
new vm.Script([
  cut('const stripWs = ', 'function lineJoinMarks('),   // stripWs · BR_* · RE_* · stripToc
  cut('function parseArticles(', '\n/* '),               // parseArticles 한 덩이(다음 주석 앞까지)
  'this.__parseArticles = parseArticles;',
].join('\n'), { filename: 'rules.html(조 쪼개기)' }).runInContext(ctx);

const sctx = {};
vm.createContext(sctx);
new vm.Script(fs.readFileSync(path.join(ROOT, 'std_2026.js'), 'utf8') + '\n;this.__STD = STD_2026;',
  { filename: 'std_2026.js' }).runInContext(sctx);

module.exports = { parseArticles: ctx.__parseArticles, STD_TEXT: sctx.__STD.text };
