'use strict';
/* 서식 완전 자동화 ①② (대표 「순서대로 모두」 2026-10-02) — 비어 있는 기금 칸을 이미 있는 자료로 메운다.
 * 소재지·전화 ← ★대표사업장, 관할 노동청·등기소·세무서 ← 소재지, 이사장 생년월일·주소·직책 ← 그 사람의 사업장 칸.
 * 이름·주소는 모두 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const gV = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); } } };

const A = (() => {
  const box = {};
  new Function([
    gV('REGISTRY_MAP'), gV('_SIDO_ABBR'), gV('TAX_MAP'), gV('LABOR_MAP'),
    gF('_addrParts'), gF('guessLabor'), gF('guessRegistry'), gF('guessTax'),
    gF('_officersOf'), gF('_siteUrep'), gF('_relNm'), gF('_leadSite'), gF('_fundFill'),
    'this.fill=_fundFill; this.labor=guessLabor;',
  ].join('\n')).call(box);
  return box;
})();

const ADDR = '충청남도 천안시 서북구 가상로 1';

test('관할 노동청·등기소·세무서는 소재지에서 — 이미 적힌 값은 그대로', () => {
  const r = A.fill({ address: ADDR }, []);
  assert.equal(r.f.labor_office, A.labor(ADDR));
  assert.ok(r.f.labor_office, '천안 주소면 노동청이 정해진다');
  assert.ok(r.f.registry_office); assert.ok(r.f.tax_office);
  assert.match(r.notes.join(','), /관할 노동청\(소재지로\)/);
  const keep = A.fill({ address: ADDR, labor_office: '직접 적은 노동청' }, []);
  assert.equal(keep.f.labor_office, '직접 적은 노동청');
  assert.equal(A.fill({}, []).notes.length, 0, '주소가 없으면 아무것도 짐작하지 않는다');
});

test('소재지·전화는 ★대표사업장에서 — 대표사업장이 없으면 안 메운다', () => {
  const sites = [{ _id: 's1', name: '가나', address: ADDR, contacts: [{ name: '담당', phone: '041-000-0000' }], lead: true }];
  const r = A.fill({}, sites);
  assert.equal(r.f.address, ADDR); assert.equal(r.f.phone, '041-000-0000');
  assert.ok(r.f.labor_office, '메운 소재지로 노동청도 정해진다');
  assert.equal(A.fill({}, [Object.assign({}, sites[0], { lead: false })]).f.address, undefined);
  assert.equal(A.fill({}, [Object.assign({}, sites[0], { status: 'closed' })]).f.address, undefined, '문 닫은 곳은 안 쓴다');
});

test('★ 이사장 생년월일·주소·직책은 그 사람의 사업장 칸에서 — 직책은 사업장 직책(작성방법 1)', () => {
  const sites = [
    { _id: 's1', name: '가나기계', ceo: '홍길동,김둘째', urep_same: true, urep_birth: '1961-02-27', urep_title: '대표이사', urep_addr: '충남 가상군 가상리 1' },
    { _id: 's2', name: '다라', ceo: '이대표' },
  ];
  const r = A.fill({ officers: [{ role: '이사장', name: '홍길동' }, { role: '이사', name: '김이사' }] }, sites);
  assert.deepEqual(r.f.officers[0], { role: '이사장', name: '홍길동', birth: '1961-02-27', addr: '충남 가상군 가상리 1', title: '대표이사' });
  assert.equal(r.f.officers[1].name, '김이사');
  assert.match(r.notes.join(','), /대표자 생년월일·주소·직책\(가나기계\)/);
  const c = A.fill({ chairman: '홍길동' }, sites);
  assert.equal(c.f.officers[0].birth, '1961-02-27', '명부가 비어도 대표자 칸 이름으로 찾는다');
  const own = A.fill({ officers: [{ role: '이사장', name: '홍길동', birth: '1900-01-01', title: '이사장' }] }, sites);
  assert.equal(own.f.officers[0].birth, '1900-01-01', '명부에 적힌 값은 덮지 않는다');
  assert.equal(own.f.officers[0].title, '이사장');
});

test('원본 기금은 건드리지 않는다(사본)', () => {
  const f = { address: ADDR, officers: [{ role: '이사장', name: '홍길동' }] };
  A.fill(f, [{ _id: 's1', ceo: '홍길동', urep_same: true, urep_birth: '1961-02-27' }]);
  assert.equal(f.labor_office, undefined); assert.equal(f.officers[0].birth, undefined);
});

test('배선 — 한글 틀 값은 모두 _fundFill 을 거친다 · 대표자 직책에 「이사장」을 지어 넣지 않는다', () => {
  assert.match(gF('_hwpValuesFor'), /_fundFill\(/);
  assert.doesNotMatch(gF('_hwpInkaValues'), /f\.chairman\?'이사장'/);
});

test('대표자 직책 — 명부 → 기금 정보 «대표자 직책»(rep_position) → 사업장 직위 차례', () => {
  const sites = [{ _id: 's1', ceo: '홍길동', urep_same: true, urep_title: '대표이사' }];
  assert.equal(A.fill({ chairman: '홍길동', rep_position: '회장' }, sites).f.officers[0].title, '회장');
  assert.equal(A.fill({ chairman: '홍길동' }, sites).f.officers[0].title, '대표이사');
  assert.equal(A.fill({ chairman: '홍길동', rep_position: '회장' }, []).f.officers[0].title, '회장', '사업장에 없어도 적어 둔 직책');
  assert.equal(A.fill({ chairman: '홍길동' }, []).f.officers, undefined, '바꿀 것이 없으면 명부를 만들지 않는다');
});
