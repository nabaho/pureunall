'use strict';
/* 해산통지서(별지 14호)·탈퇴 보고서(별지 14호의2) 값 함수와 배선 (2026-10-18). 이름·숫자는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0, k = SRC.indexOf('=', i) + 1;
  for (; k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') d--; else if (c === ';' && !d) return SRC.slice(i, k + 1); } };
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const box = {};
new Function(['var S={formFund:"F1",_dsLeave:null};',
  'function _boss(f){ return (f.officers||[]).filter(function(o){ return /이사장/.test(o.role||""); })[0]||{name:f.chairman||""}; }',
  'function _prepCommittee(f,side){ return (f.officers||[]).filter(function(o){ return (o.role||"").indexOf(side==="사용자측"?"사용자":"근로자")>=0; }).map(function(o){ return {name:o.name}; }); }',
  'function _hwpTodayIso(){ return "2026-10-18"; }',
  fnSrc('_hwpKoDate'), fnSrc('_hwpKoDate2'), fnSrc('_dotDate'), varSrc('DS_REASON'), fnSrc('_dsReasonOf'), fnSrc('_hwpDisValues'),
  'this.S=S; this.V=_hwpDisValues; this.R=_dsReasonOf;'].join('\n')).call(box);

const F = { name: '가나다공동근로복지기금', fund_type: '공동', inka_no: '0000-2026-1', address: '충청남도 천안시 가상로 1',
  labor_office: '중부지방고용노동청 천안지청', chairman: '김철수', officers: [{ role: '이사장', name: '김철수', birth: '1970-01-01', title: '이사장' }],
  end_date: '2026-09-30', end_reason: '해산 — 근로복지기본법 제86조의11제1호' };

test('★ 해산통지서 — 해산일·사유는 기금 정보의 종료일·사유, 청산인은 대표 이사, 체크는 기금 유형', () => {
  const V = box.V(F, [], 'dis_notice');
  assert.equal(V.해산일, '2026년 9월 30일');
  assert.equal(V.해산사유, '근로복지기본법 제86조의11제1호(참여 사업주 중 과반수 사업주의 사업 폐지나 탈퇴)', '조·호를 읽어 법 문구로');
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
  assert.ok(SRC.includes("['dis_notice','해산통지서(별지 제14호)'],['dis_plan','재산 처분계획서'],['dis_close_reg','청산종결 등기신청서'],['dis_leave','공동기금 탈퇴 보고서(별지 제14호의2)','공동']];"));
  assert.ok(SRC.includes('DOC_SUB,DOC_DIS);') && SRC.includes("['dis',DOC_DIS]]"));
  assert.ok(/dis_notice:'공동', dis_leave:'공동'/.test(SRC), 'HWP_TPL_KINDS');
  assert.ok(SRC.includes('dis_notice:_hwpDisValues, dis_leave:_hwpDisValues,'), 'HWP_TPL_VALUES');
  assert.ok(SRC.includes('dis_notice:1,dis_leave:1};'), '«[ ] 사내 / [ ] 공동» 줄이 말 바꾸기로 깨지면 안 된다');
  assert.ok(fnSrc('_docExtra').includes("if(kind==='dis_leave') return _dsLeaveLoad(f);"));
  assert.ok(fnSrc('_dsLeaveLoad').includes('withClosed:true'), '탈퇴한 곳까지 읽어야 한다');
  assert.ok(fnSrc('docBody').includes("if(/^dis_/.test(String(kind||''))) return _dsDocHTML(kind,f,sites);"));
  assert.ok(/'liq\+21d','dis_notice','별지 14호 해산통지서'/.test(SRC) && /'leaveDay\+21d','dis_leave','별지 14호의2 탈퇴 보고서'/.test(SRC), '단계에서 서식으로 바로 간다');
  assert.ok(SRC.includes("dsLibHTML(cur,fundMode,docsFor(DOC_DIS,cur.fund_type||'공동').map(formRow).join(''))"));
});

test('★ 해산 사유 읽기 — 조·호와 귀속처(마지막에 나온 공동기금 이름), 모르면 비움', () => {
  const r4 = box.R({ end_reason: '해산 — 근로복지기본법 제70조제4호(사업주 (주)예시의 공동근로복지기금 조성 참여). 재산은 가나다공동근로복지기금(FUND-0099)에 귀속' });
  assert.equal(r4.code, '4'); assert.equal(r4.basis, '근로복지기본법 제70조제4호'); assert.equal(r4.to, '가나다공동근로복지기금');
  assert.equal(box.R({ end_reason: '사업 폐지 — 법 제70조 제1호' }).code, '1');
  assert.equal(box.R({ end_reason: '과반수 탈퇴(제86조의11제1호)' }).code, 'g1');
  assert.deepEqual(box.R({ end_reason: '해산 결의' }), { code: '', basis: '', text: '', to: '' });
});

test('★ 처분계획서·회의록 — 사유에 따라 문장이 갈리고, 위원은 협의회 명단, 날짜를 모르면 손으로 적을 자리', () => {
  const G = Object.assign({}, F, { name: '가나다사내근로복지기금', fund_type: '사내',
    end_reason: '해산 — 근로복지기본법 제70조제4호. 재산은 가나다공동근로복지기금에 귀속',
    officers: F.officers.concat([{ role: '근로자위원', name: '홍길동' }, { role: '사용자위원', name: '박민수' }]) });
  const V = box.V(G, [], 'dis_plan');
  assert.match(V.처분방법, /가나다공동근로복지기금에 귀속함 — 기본재산은 기본재산으로/);
  assert.match(V.계획다1, /^가나다공동근로복지기금 설립을 위한 협의회 구성$/);
  assert.equal(V.결의일점, '2026. 09. 30.'); assert.equal(V.기준일, '2026. 9. 30.');
  assert.deepEqual(V.근위원, ['홍길동']); assert.deepEqual(V.사위원, ['박민수']);
  const V1 = box.V(Object.assign({}, G, { end_reason: '사업 폐지 — 제70조제1호' }), [], 'dis_plan');
  assert.match(V1.처분방법, /100분의 50 이내/); assert.match(V1.계획라1, /근로복지진흥기금/);
  const Vg = box.V(Object.assign({}, G, { end_reason: '제86조의11제1호' }), [], 'dis_plan');
  assert.match(Vg.처분방법, /출연한 비율/);
  const V0 = box.V(Object.assign({}, G, { end_date: '' }), [], 'dis_minutes');
  assert.equal(V0.결의일, '      년    월    일');
});

test('★ 배선 — 다섯 틀은 사내 작성본(공동이면 말 바꿈), 단계에서 바로 감', () => {
  assert.ok(SRC.includes("dis_minutes:'사내', dis_accept:'사내', dis_reg:'사내', dis_plan:'사내', dis_close_reg:'사내'};"));
  ['dis_minutes','dis_accept','dis_reg','dis_plan','dis_close_reg'].forEach((k) => assert.ok(new RegExp(k + ':_hwpDisValues').test(SRC), k));
  assert.equal((SRC.match(/'dis_accept','취임승낙서'/g) || []).length, 2, '사내 해산·공동 해산 둘 다');
  assert.equal((SRC.match(/'closeDay\+21d','dis_close_reg','청산종결 등기신청서'/g) || []).length, 2);
  assert.equal((SRC.match(/'dis_minutes','별지 13호 회의록'/g) || []).length, 2);
});
