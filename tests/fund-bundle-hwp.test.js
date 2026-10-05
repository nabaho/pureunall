'use strict';
/* 묶음을 «원본 한글»로 받기 — estabBundleHwp (대표 2026-09-27 「계속」).
 * [🖨 전부 인쇄]는 HTML 서식이라, 한글 틀이 있는 서식은 번호 차례대로 원본 틀에 채워 ZIP 하나로 준다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const gV = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); } } };

const A = (() => {
  const box = {};
  new Function(['var S={_hwpTplHas:null};', gV('HWP_TPL_KINDS'), gV('HWP_TPL_STRICT'), gF('_dkKeyOf'), gF('_hwpTplKey'), gF('_hwpTplFits'), gF('docsFor'), gF('_bundleHwpPlan'),
    'this.plan=_bundleHwpPlan; this.S=S;'].join('\n')).call(box);
  return box;
})();
const PH = ['kinds', '① 노동부 설립인가', () => [['minutes', '회의록'], ['charter', '정관'], ['charter_sane', '정관(사내)', '사내'], ['estab_x', '틀 없는 서식'], ['inka', '인가신청서']]];

test('★ 틀이 올라가 있고 기금 유형에 맞는 서식만 — 나머지는 무엇을 뺐는지 번호와 함께', () => {
  A.S._hwpTplHas = { minutes: true, charter: true, inka: true };
  const p = A.plan(PH, { fund_type: '공동' });
  assert.deepEqual(p.use.map((u) => [u.i, u.d[0]]), [[0, 'minutes'], [1, 'charter'], [3, 'inka']], '번호는 묶음 안 차례 그대로');
  assert.deepEqual(p.skip, ['3. 틀 없는 서식']);
  const s = A.plan(PH, { fund_type: '사내' });
  assert.ok(!s.use.some((u) => u.d[0] === 'charter'), '사내 틀(charter_sane)이 없으면 공동 정관 틀을 사내 기금에 쓰지 않는다');
  assert.ok(s.skip.includes('2. 정관'));
});

test('★ 사내 기금의 정관 — 사내 틀(charter_sane)이 올라가 있으면 그 틀로 받는다(서식 이름은 「정관」 그대로)', () => {
  A.S._hwpTplHas = { minutes: true, charter_sane: true, inka: true };
  const s = A.plan(PH, { fund_type: '사내' });
  assert.ok(s.use.some((u) => u.i === 1 && u.d[0] === 'charter'), '사내 정관이 한글 원본 묶음에서 빠졌다');
  const g = A.plan(PH, { fund_type: '공동' });
  assert.ok(!g.use.some((u) => u.d[0] === 'charter'), '공동 기금이 사내 틀을 받으면 안 된다');
});

test('틀 목록을 아직 못 읽었으면 아무것도 안 고른다(단추도 안 뜬다)', () => {
  A.S._hwpTplHas = null;
  assert.equal(A.plan(PH, { fund_type: '공동' }).use.length, 0);
});

test('★ 배선 — 장부 서식은 먼저 읽고, 원본 틀로 채워, 번호 붙은 이름으로 ZIP 하나', () => {
  const fn = gF('_estabBundleHwpGo');   // 2026-10-05 서식 관문(estabBundleHwp)을 지난 뒤 실제로 묶는 곳
  assert.match(fn, /DOC_NEEDS_LEDGER\[u\.d\[0\]\]\?_docExtra\(u\.d\[0\],f\)/, '재산목록·출연확인서가 빈 채로 나간다');
  assert.match(fn, /hwpTplFill\(u\.d\[0\],f,sites\)/);
  assert.match(fn, /\('0'\+\(u\.i\+1\)\)\.slice\(-2\)\+'\. '/, '파일 이름이 묶음 차례를 안 따른다');
  assert.match(fn, /generateAsync\(\{type:'blob'\}\)/);
  assert.match(fn, /fail\.push/, '한 종이 실패해도 나머지는 받는다');
  assert.match(fn, /if\(!got\) throw/, '한 종도 못 채우면 빈 ZIP 을 주지 않는다');
  assert.match(fn, /btn\.disabled=false/, '끝나면 단추를 되살린다');
  const bu = gF('estabBundle');
  assert.match(bu, /estabBundleHwp\(\\''\+ph\[0\]\+'\\'\)/, '묶음 머리에 단추');
  assert.match(bu, /nHwp&&!f\._sample\?/, '틀이 없거나 견본이면 단추를 안 띄운다');
});
