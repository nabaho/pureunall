/* ✨ AI 다듬기 — 되돌려 넣는 회사 이름은 «원문에 적혀 있던 꼴» 그대로 (rules-polish 가 남긴 일 · 대표 「다음」 2026-10-05). 이름은 가짜만.

   ■ 무엇이 있었나
     보낼 때 회사 이름을 {회사} 로 바꾸고, 받은 뒤 {회사} 를 «업체관리(ERP)의 표기»로 채웠다.
     원문이 「㈜가나상사」인데 ERP 가 「가나상사」면 넣은 뒤 ㈜ 가 빠졌다(반대면 생겼다). 사람이 눈으로 찾아 고쳐야 했다.
   ■ 지키는 규칙
     ① toSend 가 «바꾼 자리의 원래 글자»를 돌려준다 — 가장 많이 쓴 꼴(form)
     ② 되돌릴 때 그 꼴을 쓴다 — 조사도 그 꼴의 받침에 맞춘다
     ③ 원문에 이름이 없었으면(form 없음) 예전처럼 ERP 이름
   실행: node --test tests/rules-polish-coname.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/rules-v2/lib-polish.js');

test('① toSend 가 원래 꼴을 돌려준다 — 가장 많이 쓴 것', () => {
  const s = P.toSend('① ㈜가나상사는 사원에게 …\n② ㈜가나상사의 사원은 …\n③ 가나상사가 정한다.', '가나상사');
  assert.equal(s.coSwapped, 3);
  assert.equal(s.form, '㈜가나상사', '★ 원래 꼴(가장 많이 쓴 것)을 안 돌려준다');
  assert.equal(P.toSend('사원은 성실히 일한다.', '가나상사').form, '');
});

test('★★ 되돌릴 때 원래 꼴 그대로 — ERP 가 「가나상사」 여도 ㈜ 가 안 빠진다', () => {
  const s = P.toSend('① ㈜가나상사는 사원에게 휴가를 준다.', '가나상사');
  const back = P.restore('① {회사}는 사원에게 유급휴가를 준다.', s.form || '가나상사');
  assert.equal(back, '① ㈜가나상사는 사원에게 유급휴가를 준다.', '★★ ㈜ 가 빠졌다');
});

test('조사는 원래 꼴의 받침에 맞춘다', () => {
  assert.equal(P.restore('{회사}가 정한다.', '가나산업'), '가나산업이 정한다.');
  assert.equal(P.restore('{회사}가 정한다.', '가나상사'), '가나상사가 정한다.');
});

test('★★ 화면이 원래 꼴로 되돌린다 — 보낼 때 받은 form 을 넘긴다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
  const fn = html.slice(html.indexOf('async function polSend('), html.indexOf('function polUse('));
  assert.match(fn, /const sent=P\.toSend\(cur,co\)/, '보낸 글(toSend 결과)을 붙들어 두지 않는다');
  assert.match(fn, /P\.restore\([^)]*sent\.form\s*\|\|\s*co/, '★★ 되돌릴 때 ERP 이름만 쓴다 — ㈜ 가 빠진다');
});
