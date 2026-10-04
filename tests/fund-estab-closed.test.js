'use strict';
/* 탈퇴한 회사도 «설립 서류»에 남긴다 (대표 지시 2026-10-04 「탈퇴한 회사를 설립 서류에 남겨라」)
 * 사업장을 불러오는 길(_loadSites)이 원래 참여 중인 곳만 줘서, estabSites 를 고쳐도 서류에 닿지 않았다.
 * 설립 서류를 여는 길만 탈퇴한 곳까지 받고(뒤에), 그 밖의 서식은 입구에서 다시 거른다. 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '[') d++; else if (c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); } } };

const box = {};
new Function('DB', [
  "var NS='fund_erp'; var fbDb={ ref:function(p){ return { once:function(){ return Promise.resolve({ val:function(){ return DB; } }); } }; } };",
  varSrc('DOC_KINDS'), varSrc('DOC_REG'), varSrc('DOC_TAX'), fnSrc('_loadSites'), fnSrc('_estabKind'),
  'this.load=_loadSites; this.ek=_estabKind; this.lists=DOC_KINDS.concat(DOC_REG,DOC_TAX);',
].join(String.fromCharCode(10))).call(box, {
  s1: { name: '가나기계', seq_label: '1', status: 'active' },
  s2: { name: '다라전자', seq_label: '2', status: 'closed' },
  s3: { name: '마바산업', seq_label: '3' },
});

test('★ 설립 서류를 여는 길만 탈퇴한 곳까지 — 뒤에 붙인다(맨 앞은 대표 사업장)', async () => {
  assert.deepEqual((await box.load('X')).map((s) => s.name), ['가나기계', '마바산업'], '기본은 지금처럼 참여 중인 곳만');
  assert.deepEqual((await box.load('X', { withClosed: true })).map((s) => s.name), ['가나기계', '마바산업', '다라전자']);
});

test('설립 서류 종류 — 인가·합의서·정관·회의록·설립 출연확인서·별지·등기·세무는 예, 사업계획서·지원금·운영은 아니오', () => {
  ['inka', 'agreement', 'charter', 'minutes', 'contrib', 'inka_annex', 'charter_sane', 'reg_apply', 'tax_bizreg']
    .forEach((k) => assert.equal(box.ek(k), true, k));
  ['bizplan', 'sub_contrib', 'sub_checklist', 'ops_audit', '', undefined].forEach((k) => assert.equal(box.ek(k), false, String(k)));
});

test('_estabKind 규칙이 실제 서식 목록(DOC_KINDS·DOC_REG·DOC_TAX)과 어긋나지 않는다', () => {
  box.lists.forEach((d) => assert.equal(box.ek(d[0]), d[0] !== 'bizplan', d[0]));
});

test('★ 입구(docBody·hwpTplFill)에서 다시 거른다 — 같은 규칙, 설립 서류가 아니면 탈퇴한 곳을 뺀다', () => {
  const rule = /\/\^\(inka\|inka_annex\|agreement\|charter\|charter_sane\|minutes\|contrib\|reg_\[a-z\]\+\|tax_\[a-z\]\+\)\$\//;
  ['hwpTplFill', 'docBody', '_estabKind'].forEach((n) => assert.match(fnSrc(n), rule, n + ' 가 같은 규칙을 쓴다'));
  ['hwpTplFill', 'docBody'].forEach((n) => assert.match(fnSrc(n), /status\|\|'active'\)!=='closed'/, n));
});

test('서식을 여는 길이 «종류에 따라» 탈퇴한 곳을 받는다', () => {
  ['hwpOpenFilled', '_loadDocInto', 'hwpSidePreview'].forEach((n) =>
    assert.match(fnSrc(n), /_loadSites\([^)]*\{withClosed:_estabKind\(kind\)\}\)/, n));
  ['hwpAnnexDownload', 'estabBundle', 'estabBundleHwp'].forEach((n) =>
    assert.match(fnSrc(n), /_loadSites\(S\.formFund,\{withClosed:true\}\)/, n));
});
