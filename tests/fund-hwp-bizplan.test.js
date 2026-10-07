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
    gF('estabSites'), gF('estabLiveSites'), gF('siteContribOf'), gF('foundContribOf'), gF('foundContrib'), gF('foundContribLive'),
    gV('BUD_GWAN'), gV('BUD_GWAN_KEY'), gF('_fnum'), gF('budItemAmt'), gF('budItemBasis'), gF('budItemsList'),
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

/* ★ 세부 항목 줄 (2026-10-07 — 실무매뉴얼 부록3식, 목업 ②). 틀: 비용예산 {{#행:목적|관리|예비}}·목적사업계획서 {{#행:목적사업}} */
const ITEMS = {
  a: { gwan: 'int', name: '예금이자', base: '10,000', rate: '2.0', months: '8', ord: 1 },
  b: { gwan: 'purpose', name: '명절 상품권', goal: '명절 격려', n: '40', n_unit: '인', price: '300', times: '2', t_unit: '회', ord: 2 },
  c: { gwan: 'purpose', name: '건강검진비', n: '40', n_unit: '인', price: '150', ord: 3 },
  d: { gwan: 'purpose', name: '경조사비', n: '10', n_unit: '건', price: '200', ord: 4 },
  e: { gwan: 'purpose', name: '선택적복지', n: '40', n_unit: '인', price: '1,200', ord: 5 },
  f: { gwan: 'admin', name: '등기소송비', memo: '임원변경등기', n: '2', n_unit: '회', price: '200', ord: 6 },
  g: { gwan: 'admin', name: '회의진행비', memo: '협의회·이사회', n: '4', n_unit: '회', price: '250', ord: 7 },
  h: { gwan: 'spare', name: '예비비', price: '4,000', ord: 8 },
};
test('★★ 세부 항목 — 비용예산 줄(목·금액·산출근거)·목적사업계획서 줄(대상인원·총금액)·계가 항목 합과 맞물린다', () => {
  const G = Object.assign({}, F, { _id: 'IT', years: { 2026: { budget_items: ITEMS } } });
  V.setBudget('IT', { rev_contrib: 50000000, rev_interest: 133000, exp_purpose: 80000000, exp_admin: 1400000, exp_etc: 4000000 });
  const v = V.v(G, SITES);
  assert.deepEqual(v.목적.map((x) => [x.목, x.금액, x.근거]), [
    ['명절 상품권', '24,000', '-40인×2회×300=24,000'], ['건강검진비', '6,000', '-40인×150=6,000'],
    ['경조사비', '2,000', '-10건×200=2,000'], ['선택적복지', '48,000', '-40인×1,200=48,000']]);
  assert.deepEqual(v.관리.map((x) => x.근거), ['-임원변경등기 2회×200=400', '-협의회·이사회 4회×250=1,000']);
  assert.deepEqual(v.예비.map((x) => x.근거), ['-예비비 4,000']);
  assert.equal(v.출_사업, '80,000'); assert.equal(v.목적계, '80,000'); assert.equal(v.운_목적, '80,000'); assert.equal(v['손2_계'], '80,000');
  assert.equal(n(v.출_관리), v.관리.reduce((s, x) => s + n(x.금액), 0), '관리비 줄의 합 = 관리비용');
  assert.equal(v.목적사업.length, 4);
  assert.equal(v.목적사업[0].단계, '1단계(설립시)'); assert.equal(v.목적사업[1].단계, ' ', '단계는 첫 줄만');
  assert.equal(v.목적사업[0].대상, '40명'); assert.equal(v.목적사업[2].대상, ' ', '«건»은 사람 수가 아니다');
  assert.equal(v.목적사업[0].목적, '명절 격려');
  assert.equal(v.입_이자근거, '-10,000×2.0%×(8/12)=133');
});
test('★ 세부 항목이 없으면 관마다 «총액 한 줄» — 빈 표가 나가지 않는다', () => {
  V.setBudget('X', null);
  const v = V.v(F, SITES);
  assert.equal(v.목적.length, 1); assert.equal(v.목적[0].목, '목적사업비'); assert.equal(v.목적[0].금액, v.출_사업);
  assert.equal(v.예비[0].금액, v.출_예비);
  assert.equal(v.목적사업[0].사업명, '목적사업'); assert.equal(v.목적사업[0].금액, v.목적계);
});

/* ★ 채운 줄 높이 맞추기 — 줄 정보가 없는 칸은 한글이 높이를 다 안 늘려 첫 줄이 테두리에 걸렸다(한글로 그려 봄) */
test('★ 줄 높이 — 꺾일 줄 수만큼 칸 높이를 늘린다 · 줄 정보가 있는 문단·여러 줄 병합 칸은 그대로', () => {
  const box = {}; new Function(gF('_hwpRowFit') + '\nthis.f=_hwpRowFit;').call(box);
  const hdr = '<hh:charPr id="70" height="1100" x="1"/><hh:paraPr id="5" x="1"><hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/></hh:paraPr>';
  const cell = (txt, h, extra) => '<hp:tc name="" borderFillIDRef="2"><hp:subList><hp:p id="0" paraPrIDRef="5"><hp:run charPrIDRef="70"><hp:t>' + txt + '</hp:t></hp:run>' + (extra || '') + '</hp:p></hp:subList>'
    + '<hp:cellAddr colAddr="0" rowAddr="1"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="7782" height="' + h + '"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>';
  const H = (x) => [...x.matchAll(/height="(\d+)"/g)].map((m) => +m[1]);
  const long = '<hp:tr>' + cell('해당사업으로부터 직접도급 받는 업체의 소속근로자 복리후생 증진', 2795) + cell('2,000', 2795) + '</hp:tr>';
  const out = box.f(long, hdr);
  assert.ok(H(out)[0] > 2795 * 2, '여러 줄이면 늘어난다: ' + H(out));
  assert.equal(H(out)[0], H(out)[1], '한 줄의 칸은 모두 같은 높이');
  assert.equal(box.f(out, hdr), out, '두 번 돌려도 같다');
  const short = '<hp:tr>' + cell('경조사비', 2795) + '</hp:tr>';
  assert.equal(box.f(short, hdr), short, '한 줄이면 그대로');
  const kept = '<hp:tr>' + cell('해당사업으로부터 직접도급 받는 업체의 소속근로자 복리후생 증진', 2795, '<hp:linesegarray><hp:lineseg textpos="0"/></hp:linesegarray>') + '</hp:tr>';
  assert.equal(box.f(kept, hdr), kept, '틀의 줄 정보는 믿는다');
  const span = long.replace(/rowSpan="1"/g, 'rowSpan="3"');
  assert.equal(box.f(span, hdr), span, '여러 줄 병합 칸은 건드리지 않는다');
  assert.match(gF('_hwpFillXml'), /if\(kind==='bizplan'\) r\.xml=_hwpRowFit\(r\.xml,hdr\);/, '사업계획서에만 건다');
});

test('★ 수지차액 한 줄 — 비용예산 표 아래(목업 A안): 사업수익 − 비용 = 차액 → 준비금2 환입으로 충당', () => {
  const G = Object.assign({}, F, { _id: 'IT', years: { 2026: { budget_items: ITEMS } } });
  V.setBudget('IT', { rev_contrib: 50000000, rev_interest: 133000, exp_purpose: 80000000, exp_admin: 1400000, exp_etc: 4000000 });
  const v = V.v(G, SITES);
  assert.equal(v.수지차액문, '※ 수지차액: 사업수익 133천원 − 비용 85,400천원 = △85,267천원 → 고유목적사업준비금2 환입(기본재산전입)으로 충당');
  assert.equal(n(v.입_외), 85267, '차액 = 수입예산의 준비금2 전입수입');
  assert.equal(V.v({}, []).수지차액문, '', '예산이 없으면 비운다');
});
