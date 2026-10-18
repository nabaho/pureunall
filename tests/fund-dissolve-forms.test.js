'use strict';
/* 해산통지서(별지 14호)·탈퇴 보고서(별지 14호의2) 값 함수와 배선 (2026-10-18). 이름·숫자는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const box = {};
new Function(['var S={formFund:"F1",_dsLeave:null};',
  'function _boss(f){ return (f.officers||[]).filter(function(o){ return /이사장/.test(o.role||""); })[0]||{name:f.chairman||""}; }',
  fnSrc('_hwpKoDate'), fnSrc('_hwpDisValues'),
  'this.S=S; this.V=_hwpDisValues;'].join('\n')).call(box);

const F = { name: '가나다공동근로복지기금', fund_type: '공동', inka_no: '0000-2026-1', address: '충청남도 천안시 가상로 1',
  labor_office: '중부지방고용노동청 천안지청', chairman: '김철수', officers: [{ role: '이사장', name: '김철수', birth: '1970-01-01', title: '이사장' }],
  end_date: '2026-09-30', end_reason: '해산 — 근로복지기본법 제86조의11제1호' };

test('★ 해산통지서 — 해산일·사유는 기금 정보의 종료일·사유, 청산인은 대표 이사, 체크는 기금 유형', () => {
  const V = box.V(F, [], 'dis_notice');
  assert.equal(V.해산일, '2026년 9월 30일');
  assert.equal(V.해산사유, '근로복지기본법 제86조의11제1호', '앞의 «해산 —» 는 뗀다');
  assert.equal(V.청산인, '김철수'); assert.equal(V.청산인생년월일, '1970-01-01'); assert.equal(V.청산인직책, '이사장');
  assert.equal(V.공동V, '√'); assert.equal(V.사내V, '  ');
  assert.equal(V.관할관서, '중부지방고용노동청 천안지청');
  const S2 = box.V(Object.assign({}, F, { fund_type: '사내', labor_office: '', end_date: '', end_reason: '' }), [], 'dis_notice');
  assert.equal(S2.사내V, '√'); assert.equal(S2.공동V, '  ');
  assert.equal(S2.해산일, '', '종료일이 없으면 지어내지 않는다'); assert.equal(S2.해산사유, '');
  assert.equal(S2.관할관서, '○○지방고용노동청(○○○○지청)', '관할을 모르면 원본 꼴 그대로');
});

test('★ 탈퇴 보고서 — 미리 읽어 둔 «가장 최근 탈퇴한 사업장», 사유는 손으로, 다른 기금 것은 안 씀', () => {
  box.S._dsLeave = { fid: 'F1', n: 2, site: { name: '(주)예시전자', ceo: '홍길동', address: '충청남도 아산시 예시로 22', company_size: '37', leave_date: '2026-10-01' } };
  const V = box.V(F, [], 'dis_leave');
  assert.equal(V.탈퇴일, '2026년 10월 1일'); assert.equal(V.사업장명, '(주)예시전자'); assert.equal(V.사업장대표, '홍길동');
  assert.equal(V.근로자수, '37'); assert.equal(V.탈퇴사유, ''); assert.equal(V.대표자, '김철수');
  assert.match(V._note, /외 1곳/);
  box.S._dsLeave = { fid: 'OTHER', n: 1, site: { name: '(주)남의회사' } };
  const W = box.V(F, [], 'dis_leave');
  assert.equal(W.사업장명, '', '다른 기금에서 읽어 둔 것을 쓰면 안 된다'); assert.match(W._note, /탈퇴한 사업장이 없습니다/);
});

test('★ 배선 — 목록·단계·한글 틀·말 바꾸기 안 함·미리 읽기·HTML 미리보기', () => {
  assert.ok(SRC.includes("var DOC_DIS=[['dis_notice','해산통지서(별지 제14호)'],['dis_leave','공동기금 탈퇴 보고서(별지 제14호의2)','공동']];"));
  assert.ok(SRC.includes('DOC_SUB,DOC_DIS);') && SRC.includes("['dis',DOC_DIS]]"));
  assert.ok(/dis_notice:'공동', dis_leave:'공동'\}/.test(SRC), 'HWP_TPL_KINDS');
  assert.ok(SRC.includes('dis_notice:_hwpDisValues, dis_leave:_hwpDisValues}'), 'HWP_TPL_VALUES');
  assert.ok(SRC.includes('dis_notice:1,dis_leave:1};'), '«[ ] 사내 / [ ] 공동» 줄이 말 바꾸기로 깨지면 안 된다');
  assert.ok(fnSrc('_docExtra').includes("if(kind==='dis_leave') return _dsLeaveLoad(f);"));
  assert.ok(fnSrc('_dsLeaveLoad').includes('withClosed:true'), '탈퇴한 곳까지 읽어야 한다');
  assert.ok(fnSrc('docBody').includes("return _dsDocHTML(kind,f,sites);"));
  assert.ok(/'liq\+21d','dis_notice','별지 14호 해산통지서'/.test(SRC) && /'leaveDay\+21d','dis_leave','별지 14호의2 탈퇴 보고서'/.test(SRC), '단계에서 서식으로 바로 간다');
  assert.ok(SRC.includes("dsLibHTML(cur,fundMode,docsFor(DOC_DIS,cur.fund_type||'공동').map(formRow).join(''))"));
});
