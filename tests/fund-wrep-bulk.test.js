'use strict';
/* 재직증명서 여러 장 한꺼번에 읽기 + 특수관계 화면의 사업장 열쇠 (2026-09-29). 이름·주소는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const gV = (n) => { const i = SRC.indexOf('var ' + n + '='); return SRC.slice(i, SRC.indexOf(';', i) + 1); };

const A = (() => {
  const box = {};
  new Function(['var S={sitesFor:"F1",sites:{s1:{name:"가나산업㈜",ceo:"홍길동",wrep_name:"박근로"},s2:{name:"다라식품 주식회사",ceo:"김대표",urep_same:true,wrep_addr:"충남 가상시 이미적음 1"}}}; var _allSites=null;',
    'function loadAllSites(){}', gF('_fundSites'), gF('_fundSitesId'), gF('_siteUrep'), gF('_siteWrep'), gF('_relNm'), gF('_coNorm'),
    gF('_flat'), gF('_loose'), gV('WREP_STOP'), gF('_wrepStopRe'), gF('_cleanBizWord'), gF('_cleanCoName'), gF('parseWrepDoc'),
    gF('_wrepBulkMatch'), gF('_wrepBulkPatch'),
    'this.ids=_fundSitesId; this.match=_wrepBulkMatch; this.patch=_wrepBulkPatch; this.parse=parseWrepDoc;'].join('\n')).call(box);
  return box;
})();

test('★★ _fundSitesId 는 사업장 열쇠를 붙인다 — 특수관계 화면이 이것으로 묶는다(없으면 모두 한 곳이 된다)', () => {
  const L = A.ids('F1');
  assert.deepEqual(L.map((s) => s._id).sort(), ['s1', 's2']);
  assert.match(gF('relatedPanel'), /arr=_fundSitesId\(fid\)/, '★ 특수관계 화면이 열쇠 없는 목록을 쓴다');
});

test('★ 표 꼴 재직증명서 — 쌍점이 없어도 읽고, 증명 문구 뒤의 «회사» 주소는 집 주소로 안 받는다', () => {
  const o = A.parse('재직증명서 성 명 이가상 주민등록번호 750101-1****** 직 위 대표이사 입사일 2007-07-10 주 소 대전시 가상구 가상로3번길 136 '
    + '위와 같이 재직중에 있음을 증명합니다. 2023년 4월 10일 주 소 : 충남 가상군 회사로 263 가나산업 주식회사 대표이사 김대표');
  assert.equal(o.wrep_name, '이가상'); assert.equal(o.wrep_title, '대표이사');
  assert.equal(o.wrep_addr, '대전시 가상구 가상로3번길 136');
});

test('★ 맞추기 — 근로자대표 이름 → 사용자대표·대표자 이름 → 회사 이름(직위에 「대표」면 사용자대표)', () => {
  const S = A.ids('F1');
  assert.deepEqual(A.match({ wrep_name: '박근로' }, S), { sid: 's1', side: 'w', why: '근로자대표 이름이 같음' });
  assert.equal(A.match({ wrep_name: '김대표' }, S).side, 'u');
  const c = A.match({ wrep_name: '처음봄', wrep_co: '다라식품', wrep_title: '대표이사' }, S);
  assert.equal(c.sid, 's2'); assert.equal(c.side, 'u');
  assert.equal(A.match({ wrep_name: '처음봄', wrep_co: '없는회사' }, S).sid, '');
});

test('★★ 넣는 것은 «빈 칸만» — 적어 둔 값은 안 덮고, 「대표자와 같음」이면 사용자대표 이름은 안 넣는다', () => {
  const S = A.ids('F1'), s2 = S.find((s) => s._id === 's2');
  const p = A.patch({ wrep_name: '김대표', wrep_title: '대표이사', wrep_addr: '충남 가상시 새주소 9' }, s2, 'u');
  assert.deepEqual(p, { urep_title: '대표이사', urep_addr: '충남 가상시 새주소 9' });
  const w = A.patch({ wrep_name: '누구', wrep_addr: '충남 가상시 새주소 9' }, s2, 'w');
  assert.equal(w.wrep_addr, undefined, '★ 이미 적어 둔 집 주소를 덮었다');
});

test('배선 — [👤 사람] 보기에 단추, 저장은 사업장 한 번에(update), 변경 이력, ⓘ 등록', () => {
  assert.match(SRC, /onclick="wrepBulkPick\(\)"/);
  assert.match(gF('wrepBulkApply'), /fbDb\.ref\(NS\+'\/sites\/'\+B\.fid\)\.update\(up\)/);
  assert.match(gF('wrepBulkApply'), /_audit\(B\.fid,'재직증명서 한꺼번에 읽기'/);
  assert.match(SRC, /'wrep\.bulk':\{t:'재직증명서 여러 장 읽기'/);
  assert.match(gF('_wrepBulkPages'), /ocrCanvases\(\[cv\]/, '스캔 쪽을 한 장씩 읽지 않는다');
});

test('★★ 집 주소 가리기 — 도로명·번지·숫자는 안 보인다(실제 스캔에서 「…로132번길7」까지 보였다)', () => {
  const box = {}; new Function(gF('_relAddrMask') + ';this.m=_relAddrMask;').call(box);
  assert.equal(box.m('충남 가상시 시민로132번길7'), '충남 가상시 · 이하 가림');
  assert.equal(box.m('서울시 가상구 도곡로 12, 3층'), '서울시 가상구 · 이하 가림');
  assert.equal(box.m('충청남도 가상군 가상면 가상리 12'), '충청남도 가상군 가상면 · 이하 가림');
});
