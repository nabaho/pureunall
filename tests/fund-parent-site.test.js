'use strict';
/* 사내기금의 모회사 = 참여사업장 (대표 지시 2026-10-05)
   「기금관리에 모회사정리도 같이 연결해서 저장해야된다. 사내기금에 참여사업장을 연결시켜 넣어야 한다.」
   「복지기금과 회사는 별개의 회사이다 … 반드시 관련회사로 정리해야된다 … 항상체크해라」

   지키는 것
   ① 모회사 후보는 «기금 줄의 사업자번호» 와 «기금 이름 몫» 으로 찾되, 기금 줄 자체는 후보가 아니다
   ② 이미 있는 사업장의 짝은 «사업자번호가 같은» 회사뿐이다 — 이름만 비슷한 것은 아니다
   ③ 업체관리 회사 → 사업장 값: 업체 id(puerp_co_id)로 잇고, 월 자문료 같은 금액은 안 싣는다
   ④ 업체관리(data/companies)에는 «읽기만» 한다 — 쓰는 곳은 우리 사업장 줄뿐
   ⑤ 다 읽기 전에는 「모회사 없음」이라 말하지 않는다(모름 ≠ 없음)
   ⑥ 사내기금 참여사업장 탭이 비면 모회사 칸이 선다 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripJs } = require('./strip-comments.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

/* 함수 하나를 중괄호를 세어 통째로 떼어 낸다 */
function cut(name) {
  const at = SRC.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 함수가 없습니다');
  let depth = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (depth === 0) return SRC.slice(at, i + 1); }
  }
  throw new Error(name + ' 끝을 못 찾음');
}
function cutVar(name) {
  const at = SRC.indexOf('var ' + name + '=');
  assert.ok(at >= 0, name + ' 이 없습니다');
  return SRC.slice(at, SRC.indexOf(';', SRC.indexOf(']', at)) + 1);
}
function box(extra) {
  const ctx = Object.assign({ setTimeout() {}, S: {}, _allSites: null, loadAllSites() {},
    isPast: (f) => !!f.past, isTrashed: (f) => !!f.trashed }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([cutVar('ERP_CO_KEEP'), '_coDg', '_coKey', 'fundStem', 'isFundCo', '_erpCoLite', 'fundParentCands',
    'siteCoCands', 'erpCoToSite', 'erpPickMatch', 'fundLiveSiteN', 'fundNoParent', 'fundSiteChip']
    .map((n) => (n.indexOf('var ') === 0 ? n : cut(n))).join('\n'), ctx);
  return ctx;
}

/* 예시 회사 — 실제 고객사 이름을 쓰지 않는다 */
const COS = [
  { id: 'co-f1', name: '가나산업사내근로복지기금', bizNo: '123-45-67890', typeCode: '자문', status: 'closed' },   // 기금 줄(회사 번호가 잘못 들어감)
  { id: 'co-a', name: '주식회사 가나산업', bizNo: '123-45-67890', ceo: '홍길동', address: '충남 ○○시', phone: '041-000-0000',
    bizType: '제조업', bizCategory: '부품', monthlyAdvisoryFee: 550000, managerMain: 'P-001', puNo: '자문-1' },
  { id: 'co-b', name: '가나산업물류', bizNo: '222-81-00000' },
  { id: 'co-c', name: '다라상사', bizNo: '333-81-00000' },
];

test('기금 이름에서 회사 몫만 떼어 낸다', () => {
  const c = box();
  assert.equal(c.fundStem('가나산업사내근로복지기금'), '가나산업');
  assert.equal(c.fundStem('참살이 사내근로복지기금'), '참살이');
  assert.equal(c.fundStem('㈜다라공동근로복지기금2호'), '다라');
});

test('① 모회사 후보 — 기금 줄 번호가 같은 회사가 먼저, 기금 줄 자체는 빠진다', () => {
  const c = box();
  const out = c.fundParentCands({ name: '가나산업사내근로복지기금', puerp_co_id: 'co-f1' }, COS);
  const ids = out.map((x) => x.co.id).join(',');
  assert.equal(out[0].co.id, 'co-a', '사업자번호가 같은 회사가 맨 앞이어야 합니다');
  assert.ok(out[0].why.join('|').includes('사업자번호'), '왜 후보인지 적어야 합니다');
  assert.ok(!ids.includes('co-f1'), '기금 줄 자신을 모회사 후보로 내면 안 됩니다(기금은 회사가 아니다)');
  assert.ok(ids.includes('co-b'), '이름 몫이 들어 있는 회사도 «후보»로는 보여야 합니다');
  assert.ok(!ids.includes('co-c'), '관계없는 회사가 후보에 섞였습니다');
});

test('② 있는 사업장의 짝은 사업자번호가 같은 회사뿐이다', () => {
  const c = box();
  assert.equal(c.siteCoCands({ name: '가나산업', biz_no: '1234567890' }, COS).map((x) => x.id).join(','), 'co-a');
  assert.equal(c.siteCoCands({ name: '주식회사 가나산업', biz_no: '' }, COS).length, 0, '번호 없이 이름만으로 짝을 지으면 안 됩니다');
  assert.equal(c.siteCoCands({ name: '가나산업', biz_no: '999-99-99999' }, COS).length, 0);
});

test('③ 회사 → 사업장 값: 업체 id 로 잇고 금액은 싣지 않는다', () => {
  const c = box();
  const lite = c._erpCoLite(COS[1]);
  assert.ok(!('monthlyAdvisoryFee' in lite), '월 자문료가 기금관리로 넘어오면 안 됩니다(금액은 관리자만)');
  assert.ok(!('managerMain' in lite));
  const r = c.erpCoToSite(lite);
  assert.equal(r.puerp_co_id, 'co-a', '업체 id 로 이어야 합니다 — 이름은 열쇠가 아닙니다');
  assert.equal(r.name, '주식회사 가나산업');
  assert.equal(r.biz_no, '123-45-67890');
  assert.equal(r.company_tel, '041-000-0000');
  assert.ok(!('corp_no' in r), '빈 값은 싣지 않아야 합니다(빈칸으로 덮지 않게)');
  assert.ok(!JSON.stringify(r).includes('550000'));
});

test('찾기 — 숫자는 사업자번호로, 글자는 이름으로, 기금 줄은 빼고', () => {
  const c = box();
  assert.equal(c.erpPickMatch(COS, '4567').map((x) => x.id).join(','), 'co-a');
  assert.equal(c.erpPickMatch(COS, '가나').map((x) => x.id).join(','), 'co-a,co-b');
});

test('⑤ 다 읽기 전에는 「모회사 없음」이라 말하지 않는다', () => {
  const f = { _id: 'F1', fund_type: '사내', name: '가나산업사내근로복지기금' };
  const unknown = box({ _allSites: null });
  assert.equal(unknown.fundNoParent(f), false);
  assert.equal(unknown.fundSiteChip(f), '');
  const empty = box({ _allSites: { F1: { s1: { name: '옛 회사', status: 'closed' } } } });
  assert.equal(empty.fundNoParent(f), true, '탈퇴한 곳만 있으면 모회사가 없는 것입니다');
  assert.ok(empty.fundSiteChip(f).includes('모회사 없음'));
  const has = box({ _allSites: { F1: { s1: { name: '주식회사 가나산업', status: 'active' } } } });
  assert.equal(has.fundNoParent(f), false);
  const gong = box({ _allSites: {} });
  assert.equal(gong.fundNoParent({ _id: 'F2', fund_type: '공동' }), false, '공동기금은 «모회사»가 아닙니다');
  assert.ok(gong.fundSiteChip({ _id: 'F2', fund_type: '공동' }).includes('0곳'));
  assert.equal(gong.fundSiteChip({ _id: 'F2', fund_type: '사내', past: true }), '', '지난 기금에는 안 붙입니다');
});

test('④ 업체관리(data/companies)에는 읽기만 한다', () => {
  const block = stripJs(SRC.slice(SRC.indexOf('var _erpCos=null'), SRC.indexOf('function siteCoBarPaint(')));
  assert.ok(block.length > 2000, '사내기금 모회사 덩이를 찾지 못했습니다');
  assert.match(block, /ref\('data\/companies\/v'\)\.once\('value'\)/, '업체관리는 once 로 한 번만 읽어야 합니다');
  assert.ok(!/ref\('data\/[^)]*\)\s*\.\s*(set|update|remove|push|transaction)\(/.test(block), '업체관리에 쓰면 사무관리 원장이 깨집니다');
  const link = stripJs(cut('siteLinkCo'));
  assert.match(link, /ref\(NS\+'\/sites\/'\+fid\+'\/'\+sid\)\.update\(\{puerp_co_id:to\}\)/, '있는 사업장은 «잇는 칸 하나만» 저장해야 합니다');
});

test('⑥ 사내기금 참여사업장 탭이 비면 모회사 칸, 편집 창에는 잇는 줄', () => {
  const tab = stripJs(cut('sitesTab'));
  assert.match(tab, /fund_type==='사내'\)\?fundParentBox\(/, '빈 사내기금에 모회사 칸이 안 섭니다');
  assert.match(tab, /siteCoChip\(s\)/, '명부 상호 옆 🔗 딱지가 없습니다');
  const ed = stripJs(cut('editSite'));
  assert.match(ed, /id="siteCoBar"/, '편집 창에 업체관리 잇는 줄이 없습니다');
  assert.match(ed, /siteCoBarPaint\(\)/);
  /* 새 사업장은 창을 열 때의 값(_sitePrefill)을 바탕으로 저장해야 puerp_co_id 가 살아남는다 */
  assert.match(stripJs(cut('saveSite')), /Object\.assign\(\{status:'active'\}, _sitePrefill\|\|\{\}\)/,
    '새 사업장 저장이 _sitePrefill 을 버리면 업체관리 잇기가 사라집니다');
  assert.match(stripJs(cut('fundRow')), /fundSiteChip\(f\)/, '기금 목록에 「모회사 없음」 딱지가 없습니다');
});
