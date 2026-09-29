'use strict';
/* 특수관계 점검 ② — 신호 찾기(relatedScan)와 화면 배선. 대표 지시 2026-09-29, 목업 승인.
 * 이름·주소는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const A = (() => {
  const box = {};
  new Function([gF('_officersOf'), gF('_siteUrep'), gF('_siteWrep'), gF('_relNm'), gF('_relAddrKey'), gF('_relAddrMask'),
    gF('_relIsPersonal'), gF('relatedPeople'), gF('relatedScan'),
    'this.scan=relatedScan; this.key=_relAddrKey; this.mask=_relAddrMask; this.per=_relIsPersonal; this.people=relatedPeople;'].join('\n')).call(box);
  return box;
})();
const S = (id, o) => Object.assign({ _id: id, status: 'active' }, o);

test('★ 같은 대표자 이름 — 공동대표도 한 사람씩 나눠 본다', () => {
  const g = A.scan({}, [S('a', { name: '가나산업', ceo: '홍길동' }), S('b', { name: '다라환경', ceo: '김철수, 홍길동' }), S('c', { name: '마바', ceo: '이영희' })]);
  const c = g.filter((x) => x.type === 'ceo');
  assert.equal(c.length, 1); assert.deepEqual(c[0].sids.sort(), ['a', 'b']); assert.equal(c[0].level, 'hi');
});

test('★★ 같은 집 주소인데 다른 회사 — 표기(띄어쓰기·괄호·「충청남도/충남」)가 달라도 한집, 성이 같으면 알린다', () => {
  const g = A.scan({}, [
    S('a', { name: '가나산업', ceo: '홍길동', urep_same: true, urep_addr: '충청남도 가상시 가상로 12, 101동 202호 (가상동)' }),
    S('b', { name: '다라식품', ceo: '박대표', wrep_name: '홍순자', wrep_addr: '충남 가상시 가상로12, 101동202호' }),
    S('c', { name: '마바', ceo: '최대표', wrep_name: '이이웃', wrep_addr: '충남 가상시 가상로 12, 101동 203호' })]);
  const h = g.filter((x) => x.type === 'home');
  assert.equal(h.length, 1, '★ 같은 집을 못 알아봤거나 옆집(203호)까지 한집으로 봤다');
  assert.deepEqual(h[0].sids.sort(), ['a', 'b']);
  assert.equal(h[0].sameSur, true);
  assert.ok(!/12|101|202/.test(h[0].mask), '★ 화면에 동 아래(번지·동·호수)까지 보인다: ' + h[0].mask);
});

test('★★ 한 사람이 두 회사에 — 생년월일이 같으면 강하게, 둘 다 알고 다르면 동명이인이라 짚지 않는다', () => {
  const same = A.scan({}, [S('a', { name: '라마테크', ceo: '갑대표', urep_name: '김철수', urep_birth: '1970-01-01' }),
    S('b', { name: '바사정밀', ceo: '김철수', urep_same: true, urep_birth: '1970-01-01' })]).filter((x) => x.type === 'cross');
  assert.equal(same.length, 1); assert.equal(same[0].level, 'hi');
  const diff = A.scan({}, [S('a', { name: '라마', ceo: '갑', wrep_name: '김철수', wrep_birth: '1970-01-01' }),
    S('b', { name: '바사', ceo: '을', wrep_name: '김철수', wrep_birth: '1985-05-05' })]).filter((x) => x.type === 'cross');
  assert.equal(diff.length, 0, '★ 생년월일이 다른 동명이인을 짚었다');
  const unk = A.scan({}, [S('a', { name: '라마', ceo: '갑', wrep_name: '김철수' }), S('b', { name: '바사', ceo: '김철수' })]).filter((x) => x.type === 'cross');
  assert.equal(unk.length, 1); assert.equal(unk[0].level, 'warn', '생년월일을 모르면 약하게');
});

test('같은 사무실 주소 — 쉼표 뒤 상세주소·층·호는 보지 않는다', () => {
  assert.equal(A.key('충남 가상시 산단로 22, 산학관 301호', false), A.key('충남 가상시 산단로 22 (가상동), 2층', false));
  const g = A.scan({}, [S('a', { name: '가', ceo: '1', address: '충남 가상시 산단로 22, 산학관 301호' }), S('b', { name: '나', ceo: '2', address: '충청남도 가상시 산단로 22, 2층' })]);
  assert.equal(g.filter((x) => x.type === 'office').length, 1);
});

test('같은 담당자 연락처 — 휴대폰·이메일, 같은 짝은 한 번만', () => {
  const ct = (m, e) => [{ name: '담', mobile: m, email: e, isPrimary: true }];
  const g = A.scan({}, [S('a', { name: '가', ceo: '1', contacts: ct('010-1111-2222', 'x@y.kr') }), S('b', { name: '나', ceo: '2', contacts: ct('01011112222', 'X@y.kr') })]);
  assert.equal(g.filter((x) => x.type === 'contact').length, 1);
});

test('탈퇴한 사업장·짧은 주소는 보지 않는다 — 억지 신호를 안 만든다', () => {
  const g = A.scan({}, [S('a', { name: '가', ceo: '홍길동' }), S('b', { name: '나', ceo: '홍길동', status: 'closed' }),
    S('c', { name: '다', ceo: '3', address: '충남' }), S('d', { name: '라', ceo: '4', address: '충남' })]);
  assert.equal(g.length, 0);
});

test('등기임원도 «소속 회사»가 참여회사면 사람으로 센다', () => {
  const P = A.people({ officers: [{ role: '근로자측 이사', name: '정위원', company: '가나산업', addr: '충남 가상시 가상로 5' }] }, [S('a', { name: '가나산업', ceo: '홍' })]);
  assert.ok(P.some((p) => p.name === '정위원' && p.sid === 'a'));
});

test('개인사업자 판별 — 사업자번호 가운데 두 자리 81~88 은 법인', () => {
  assert.equal(A.per({ biz_no: '123-81-45678' }), false);
  assert.equal(A.per({ biz_no: '123-45-67890' }), true);
  assert.equal(A.per({}), null);
});

test('★ 배선 — 근복지원금 맨 앞 칸, 결과는 fund_erp/related 에, ⓘ 등록, 주민번호 안 봄', () => {
  assert.match(SRC, /var SUB_TABS=\[\['related','🔎 특수관계 점검'\]/);
  assert.match(gF('subsidyTab'), /S\.subTab==='related' \? relatedPanel\(f\)/);
  assert.match(gF('relSigSave'), /NS\+'\/related\/'\+fid\+'\/sig\/'\+k/);
  assert.match(gF('relCoSave'), /NS\+'\/related\/'\+fid\+'\/co\/'\+sid\+'\/'\+col/);
  assert.match(SRC, /'related\.check':\{t:'특수관계 사전 점검'/);
  ['relatedScan', 'relatedPeople', 'relatedPanel'].forEach((n) => assert.ok(!/rrn|jumin|주민/.test(gF(n)), n + ' 이 주민번호를 본다'));
});
