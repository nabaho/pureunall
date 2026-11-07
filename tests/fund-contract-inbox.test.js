'use strict';
/* 기금 설립 → 푸른이알피 계약관리 «대기함» — 기금관리 쪽 (대표 승인 2026-11-07, 목업 B안)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·회사·사람은 전부 지어낸 것이다.
 * node --test tests/fund-contract-inbox.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + name);
}
function grabVar(name) {
  const i = SRC.indexOf('\nvar ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 var 가 없다: ' + name);
  const j = SRC.indexOf(';\n', i);
  return SRC.slice(i + 1, j + 1);
}
const C = (() => {
  const box = {};
  new Function([grabVar('CI_STAGE'), grabFn('ciRec'), 'this.rec=ciRec; this.stage=CI_STAGE;'].join('\n')).call(box);
  return box;
})();

test('후보 내용 — 이름·유형·업무 요약·담당만, 금액·수수료는 없다', () => {
  const r = C.rec({ name: '예시전자 사내근로복지기금', short_name: '예시전자', fund_type: '사내', mgr_main: { sid: 'u1', name: '담당가' } }, 'consult', '대표');
  assert.deepEqual(Object.keys(r).sort(), ['brief', 'by', 'company', 'fundName', 'fundType', 'manager', 'shortName', 'stage']);
  assert.equal(r.company, '예시전자');                          // «사내근로복지기금»을 걷어 업체명으로
  assert.equal(r.brief, '예시전자 설립 인가 신청');
  assert.equal(r.manager, '담당가'); assert.equal(r.stage, 'consult');
  assert.ok(!/fee|amount|금액|수수료|contract/i.test(Object.keys(r).join(',')));
});

test('업무 요약은 40자를 넘지 않고, 업체명이 비면 기금 이름을 쓴다', () => {
  const long = '가'.repeat(60);
  assert.ok(C.rec({ name: long, short_name: long, fund_type: '공동' }, 'consult').brief.length <= 40);
  assert.equal(C.rec({ name: '㈜예시 공동근로복지기금' , fund_type: '공동' }, 'consult').company, '예시');
  assert.equal(C.rec({ name: '근로복지기금', fund_type: '공동' }, 'consult').company, '근로복지기금');
  assert.equal(C.rec({ name: '예시기금', fund_type: '공동', manager: '담당나' }, 'consult').manager, '담당나');   // 구형 담당 문자열
});

test('상태는 상담접수·계약확정 둘뿐 — 계약협의는 푸른이알피에서만', () => {
  assert.deepEqual(Object.keys(C.stage), ['consult', 'signed']);
});

test('★ 푸른이알피 장부에는 쓰지 않는다 — 쓰기는 contract_inbox 한 곳', () => {
  for (const fn of ['ciPost', 'ciStage', 'ciLoad', 'ciUp', 'ciDown']) {
    const t = grabFn(fn);
    assert.ok(!/NS\+'\/funds\/|'data\/|contracts|sourceKind/.test(t), fn + ' 이 다른 자리를 건드린다');
    (t.match(/fbDb\.ref\([^)]*\)/g) || []).forEach((r) => assert.match(r, /contract_inbox/, fn + ': ' + r));
  }
  // 무시·가져옴 표시는 푸른이알피가 적는다 — 여기서는 읽기만(erp·ignored 를 쓰는 곳이 없다)
  assert.ok(!/erp:|ignored:/.test(grabFn('ciPost') + grabFn('ciRec')), 'erp·ignored 는 푸른이알피 몫');
});

test('올리는 규칙 — 설립부터 만들 때, 단계 ① 체크가 바뀔 때(이미 있는 후보만), 무시된 후보는 안 건드린다', () => {
  const cf = grabFn('createFund');
  assert.match(cf, /if\(entry==='new'\) ciPost\(fid,'consult'\);/, '설립부터 만들 때만 올린다');
  assert.match(grabFn('sdToggle'), /if\(code==='EST-01'\) ciStage\(fid,on\);/);
  assert.match(grabFn('toggleSetup'), /if\(code==='EST-01'\) ciStage\(_fid,on\);/);
  assert.match(grabFn('ciStage'), /if\(sn\.val\(\)\) return ciPost\(/, '없는 후보를 몰래 올린다');
  assert.match(grabFn('ciPost'), /cur&&cur\.ignored\) return cur;/);
  assert.match(grabFn('ciPost'), /\(cur&&cur\.erp\)\?\{stage:stage\}/, '가져간 계약의 이름·담당을 다시 덮는다');
  assert.match(grabFn('ciDown'), /v\.erp\) return;/, '가져간 후보를 거둘 수 있다');
});

test('팝업 머리에 상태가 보이고, 올리기 실패가 설립 체크를 막지 않는다', () => {
  assert.match(grabFn('_sdBoard'), /ciChip\(fid\)/);
  assert.match(grabFn('sdPop'), /ciLoad\(SD\.sel\)/);
  assert.match(grabFn('ciPost'), /\.catch\(function\(e\)\{ toast\(/);
  for (const k of ['올리지 않음', '무시됨', '가져옴', '대기함에 올림']) assert.ok(grabFn('ciChip').includes(k), k);
});
