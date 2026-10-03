'use strict';
/* 특수관계 점검 ① — 사람의 집 주소를 읽고 담는다 (대표 2026-09-29 「재직증명서상의 주소가 동일한 사람들이
 * 다른회사의 대표로 있거나 한 경우를 모두 검토」). 이름·주소는 전부 가짜. */
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
  new Function([gF('_flat'), gF('_loose'), gV('WREP_STOP'), gF('_wrepStopRe'), gF('_cleanBizWord'), gF('_cleanCoName'),
    gF('parseWrepDoc'), gF('parseUrepDoc'), 'this.w=parseWrepDoc; this.u=parseUrepDoc;'].join('\n')).call(box);
  return box;
})();
const DOC = '재 직 증 명 서\n성명: 홍길동\n생년월일: 1975년 3월 2일\n주소: 충청남도 가상시 가상동 12-3 가나아파트 101동 202호\n'
  + '직위: 부장\n재직기간: 2015. 1. 2. ~ 현재\n회사명: 가나산업 주식회사 대표이사 김대표\n위와 같이 재직하고 있음을 증명합니다.';

test('★ 재직증명서의 집 주소를 읽는다 — 다음 이름표(직위) 앞에서 끊는다', () => {
  const o = A.w(DOC);
  assert.equal(o.wrep_name, '홍길동');
  assert.equal(o.wrep_addr, '충청남도 가상시 가상동 12-3 가나아파트 101동 202호');
  assert.equal(o.wrep_title, '부장', '주소를 읽느라 직위가 망가졌다');
});

test('시·도·군·구가 없는 글은 주소로 받지 않는다 — 빈 칸이 틀린 주소보다 낫다', () => {
  assert.equal(A.w('성명: 홍길동\n주소: 본사와 같음\n직위: 대리').wrep_addr, undefined);
});

test('★ 사용자대표 재직증명서는 같은 법으로 읽고 칸 이름만 urep_ — 주민번호는 여전히 안 읽는다', () => {
  const o = A.u(DOC + '\n주민등록번호: 750302-1******');
  assert.equal(o.urep_name, '홍길동'); assert.ok(o.urep_addr); assert.equal(o.wrep_addr, undefined);
  assert.ok(!Object.keys(o).some((k) => /rrn|jumin/.test(k)));
  assert.match(gV('DOC_EXTRA_LBL'), /urep_co/, '확인용 발급 회사 이름표가 없다');
  assert.match(SRC, /urep:\{label:'사용자대표 재직증명서',fn:parseUrepDoc\}/);
});

test('★ 두 대표 칸 묶음에 집 주소가 «같은 자리»로 있다', () => {
  assert.match(gV('WREP_FIELDS'), /\['wrep_addr','집 주소\(점검용\)','text'\]\]/);
  assert.match(gV('UREP_FIELDS'), /\['urep_addr','집 주소\(점검용\)','text'\]\]/);
});

test('★★ 있던 사업장을 고쳐 저장할 때 사용자대표·중소기업·「대표자와 같은 사람」도 보낸다 (고친 버그)', () => {
  const fn = gF('saveSite');
  assert.match(fn, /SITE_FIELDS\.concat\(WREP_FIELDS,UREP_FIELDS,SME_FIELDS\)/, '★ 사용자대표 칸이 저장 목록에서 빠졌다');
  assert.match(fn, /patch\.urep_same=obj\.urep_same\?true:null/, '★ 「대표자와 같은 사람」 체크가 저장되지 않는다');
});

test('[👤 사람] 보기의 사용자대표 칸에도 [📎 재직] — 읽기만(원본 잇기는 근로자대표 하나)', () => {
  assert.match(gF('pplUrepDoc'), /_siteUrepScope\(\)/);
  assert.match(gF('pplUrepDoc'), /openAlbumPick\('dz-siterep','urep'\)/);
  assert.match(gF('_siteUrepScope'), /pre:'su-'/);
  assert.match(SRC, /pplUrepDoc\(\\''\+s\._id\+'\\'\)/, '[📎 재직] 단추가 사용자대표 칸에 없다');
});
