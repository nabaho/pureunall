'use strict';
/* 사업계획서 원본 한글 틀의 값 — _hwpBizplanValues (2026-09-26)
 * 값은 HTML 사업계획서가 쓰던 «같은 셈»(bizplanRows·bizplanBS·planBudget)에서 온다 — 한글 파일과 화면이
 * 다른 숫자를 말하면 안 된다. 틀(.hwpx)은 저장소에 없다 — 여기서는 «이름 → 값»만 본다. 이름·금액은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const gV = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); } } };
const gS = (n) => { const m = SRC.match(new RegExp('var ' + n + '=[^\\n]*?;')); assert.ok(m, '없음 ' + n); return m[0]; };

const V = (() => {
  const box = {};
  new Function([
    'var S={year:2026, f15Close:null, fundId:"X"};',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    'var _BUDGET={}; function _hasBudget(fid,yr){ return !!_BUDGET[fid]; } function budgetOf(fid){ return _BUDGET[fid]; }',
    gV('_K'), gV('BIZ_SPLIT'), gS('BIZ_RATE_DEFAULT'), gV('BIZ_BS_ROWS'), gV('BIZ_TPL_ROWS'), gV('BIZ_TPL_BS'),
    gV('_KOR_D'), gV('_KOR_P'), gV('_KOR_U'), gF('korWon'),
    gF('useRate'), gF('bizRate'), gF('autoBudget'), gF('planBudget'), gF('isSetupFund'), gF('_bizFinZero'), gF('_bizFinOf'),
    gF('bizplanRows'), gF('bizplanBS'),
    gF('estabSites'), gF('siteContribOf'), gF('foundContribOf'), gF('foundContrib'),
    gF('_hwpBizplanValues'),
    'this.v=_hwpBizplanValues; this.setBudget=function(fid,b){ _BUDGET[fid]=b; }; this.S=S;',
  ].join('\n')).call(box);
  return box;
})();

const F = { _id: 'X', name: '가나다공동근로복지기금', fund_type: '공동', setup_stage: '설립준비', meeting_date: '2026-03-02' };
const SITES = [{ name: '가나기계', contrib: 100000000, status: 'active' }, { name: '다라전자', contrib: 120000000, status: 'active' }];
const n = (s) => { s = String(s || ''); const neg = s.charAt(0) === '△'; const x = Number(s.replace(/[△,]/g, '')) || 0; return neg ? -x : x; };

test('머리 — 사업연도·작성일(설립준비위 회의일)·기금명·신규 출연금(원·한글)·예치금액(천원)', () => {
  const v = V.v(F, SITES);
  assert.equal(v.사업연도, '2026');
  assert.equal(v.작성일, '2026년 03월 02일');
  assert.equal(v.기금명, F.name);
  assert.equal(v.신규출연금, '220,000,000');
  assert.equal(v.신규출연금한글, '이억이천만원');
  assert.equal(v.예치금액, '220,000', '예치 계획은 천원 단위');
  assert.equal(v.이자율표기, '연리2.0%', '원본 꼴 그대로');
});

test('★ 모르는 것은 비운다 — 예치 은행·날짜, 체육·문화 몫, 등기·회의·일반관리 나눔', () => {
  const v = V.v(F, SITES);
  assert.equal(v.예치은행, ''); assert.equal(v.예치일, ''); assert.equal(v.빈칸, '');
  assert.equal(V.v(Object.assign({}, F, { meeting_date: '' }), SITES).작성일, '', '회의일이 없으면 작성일도 비운다 — 오늘로 지어내지 않는다');
});

test('★★ 손익예산 — HTML 과 같은 bizplanRows: 천원 단위·음수는 △·3=1-2·5=3-4·10=0', () => {
  const v = V.v(F, SITES);
  assert.equal(v['손1가_기'], '440', '이자 = 기본재산 22,000천원 × 2.0%');
  assert.equal(v['손2_목'], '178,200');
  assert.equal(n(v['손3_계']), n(v['손1_계']) - n(v['손2_계']));
  assert.equal(n(v['손5_계']), n(v['손3_계']) - n(v['손4_계']));
  assert.match(v['손3_목'], /^△/, '음수는 △ — 서식의 관례');
  assert.equal(v['손10_계'], '0', '기금은 남는 이익을 준비금으로 돌려 당기순이익 0');
  /* 7.사업외비용의 두 갈래 — 기금관리 쪽 준비금 전입(=이자) + 목적사업 쪽 예비비 */
  assert.equal(n(v['손7가_계']) + n(v['손7나_계']), n(v['손7_계']));
});

test('★★ 추정대차대조표 — «계»만, 대차가 맞는다(자산 = 부채 + 자본)', () => {
  const v = V.v(F, SITES);
  assert.equal(n(v.대_자산계), n(v.대_부채계) + n(v.대_자본계));
  assert.equal(v.대_부채자본계, v.대_자산계);
  assert.equal(n(v.대_유동) + n(v.대_비유동), n(v.대_자산계));
  assert.equal(n(v.대_준비금1) + n(v.대_준비금2), n(v.대_비유동부채));
});

test('★ 요약표·수입·비용·기금운영 계획서가 손익예산과 같은 숫자를 말한다', () => {
  const v = V.v(F, SITES);
  assert.equal(v.출_사업, v['손2_목']);
  assert.equal(v.출_관리, v['손4_목']);
  assert.equal(n(v.출_계), n(v.출_사업) + n(v.출_관리) + n(v.출_예비));
  assert.equal(n(v.입_계), n(v.입_사업) + n(v.입_외));
  assert.equal(v.운_지출계, v.출_계);
  assert.equal(n(v.운_과부족), n(v.운_조달계) - n(v.운_지출계));
  assert.equal(v.요_순이익, v['손10_계']);
});

test('★ 협의회가 정한 예산이 «언제나» 이긴다 — 짐작(출연금 비율)이 덮지 않는다', () => {
  V.setBudget('X', { rev_contrib: 220000000, rev_interest: 1000000, exp_purpose: 150000000, exp_admin: 5000000, exp_etc: 3000000 });
  const v = V.v(F, SITES);
  assert.equal(v['손2_목'], '150,000');
  assert.equal(v['손1가_기'], '1,000');
  assert.equal(v.출_예비, '3,000');
  V.setBudget('X', null);
});

test('★ 출연금도 예산도 없으면 숫자 자리는 «비운다» — 0 을 지어내지 않는다', () => {
  const v = V.v(F, SITES.map((s) => Object.assign({}, s, { contrib: 0 })));
  assert.equal(v['손1_계'], ''); assert.equal(v.출_계, ''); assert.equal(v.대_자산계, '');
  assert.equal(v.신규출연금, ''); assert.equal(v.예치금액, '');
});

test('★ 이미 굴러가는 기금은 올해 결산(스냅샷)이 없으면 재무상태표를 비운다 — 「올해 재산 0」으로 적지 않는다', () => {
  const v = V.v(Object.assign({}, F, { setup_stage: '운영', inka_date: '2024-01-01' }), SITES);
  assert.equal(v.대_자산계, '');
  assert.notEqual(v['손1_계'], '', '손익예산은 예산만으로 나온다');
});
