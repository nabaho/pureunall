'use strict';
/* 집단체불 위임장 — 대표 근로자(진정인 대표·선정당사자) (대표 지시 2026-10-09) — 가짜 자료만
   ⓐ 서식 값 — 대표근로자·연락처·주소·진정인수·관할관서·생년월일(주민번호 앞 7자리로)
   ⓑ 사건 — 새 사건 칸·👤 대표 정하기(제출한 사람 가운데서)·채울 때 대표의 제출을 붙인다(저장하지 않음) */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const T = require('../js/esign-hwp-tpl.js');
const H = fs.readFileSync(path.join(__dirname, '..', 'docs-esign.html'), 'utf8').replace(/\r\n/g, '\n');

test('ⓐ 서식 값', () => {
  const V = T.valuesOf({ name: '가나', idNo: '900101-1000000' }, { company: '시험상사', repName: '다라', office: '천안지청', _rep: { phone: '010-1200-0001', addr: '천안시 가나로 1' }, _count: 7 }, {});
  assert.equal(V.대표근로자, '다라'); assert.equal(V.대표근로자연락처, '010-1200-0001'); assert.equal(V.대표근로자주소, '천안시 가나로 1');
  assert.equal(V.진정인수, '7'); assert.equal(V.관할관서, '천안지청'); assert.equal(V.생년월일, '1990.01.01');
  assert.equal(T.birthOf('050303-4000000'), '2005.03.03'); assert.equal(T.birthOf('123'), ''); assert.equal(T.birthOf('900101-9000000'), '');
  const blank = T.valuesOf({}, {}, {});
  assert.equal(blank.대표근로자, ''); assert.equal(blank.진정인수, '');
});

test('ⓑ 사건 화면', () => {
  assert.match(H, /<input id="ncRep"/);
  assert.match(H, /var rep = repRecord\(\$\('ncRep'\)\.value, \$\('ncOffice'\)\.value\);\n      if \(rep\) await trackedWrite\(ref\.child\('secret\/rep'\)\.set\(rep\)\);/);
  const p = H.slice(H.indexOf('function openRepPick('), H.indexOf('\n}\n', H.indexOf('function openRepPick(')));
  assert.match(p, /decrypted\.filter/); assert.match(p, /db\.ref\('esign\/cases\/' \+ curCaseId \+ '\/secret\/rep'\)\.set\(rep\)/);
  const f = H.slice(H.indexOf('async function _esignFillOne('), H.indexOf('\n}\n', H.indexOf('async function _esignFillOne(')));
  assert.match(f, /meta = _esignMetaForFill\(meta\);/);
  const m = H.slice(H.indexOf('function _esignMetaForFill('), H.indexOf('\n}\n', H.indexOf('function _esignMetaForFill(')));
  assert.doesNotMatch(m, /\.(set|update|push)\(/, '채울 때 붙이는 값은 저장하지 않는다');
});

/* ⓒ 대표 근로자 이름은 근로자도 읽는 meta 에 두지 않는다(검토 2026-10-09 대표 「추천대로」) — secret/rep(직원만), 파기 때 함께 지움 */
test('ⓒ 대표 근로자 — meta 밖, 파기 때 지움', () => {
  const a = H.indexOf("$('ncOk').onclick"), nc = H.slice(a, H.indexOf('bg.remove();', a));
  const meta = nc.slice(nc.indexOf('var meta = {'), nc.indexOf('};', nc.indexOf('var meta = {')));
  assert.doesNotMatch(meta, /repName|office/, '새 사건 meta 에 대표 근로자·관할관서가 없다');
  assert.doesNotMatch(H, /\/meta'\)\.update\(up\)/);
  const rules = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'make-firebase-rules.js'), 'utf8');
  assert.match(rules, /meta: +\{ '\.read': 'auth != null'/, 'meta 는 링크를 연 근로자도 읽는다(그래서 옮겼다)');
  assert.match(rules, /secret: +\{ '\.read': MAIL, '\.write': MAIL \}/, 'secret 은 직원만');
  const cut = (s) => H.slice(H.indexOf(s), H.indexOf('\n}\n', H.indexOf(s)));
  assert.match(cut('function moveRepOut('), /secret\/rep'\)\.set\(rep\)[\s\S]*\/meta'\)\.update\(\{ repName: null, office: null \}\)/, '예전 사건은 열 때 옮긴다');
  assert.match(H, /await moveRepOut\(caseId\);/);
  const pg = cut('function purgeCase(');
  assert.match(pg, /\/secret\/rep'\)\.remove\(\)/); assert.match(pg, /update\(\{ status: 'purged', repName: null, office: null \}\)/);
  assert.match(cut('function _esignMetaForFill('), /caseRep\(curCaseId\)/, '채울 때는 secret/rep 에서');
});
