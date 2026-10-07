'use strict';
/* 🏢 사업관리 다음 (대표 지시 2026-10-05 「선정·계약 사업 → 실적관리로 · 엑셀 견적서도 비교 · 7번 폴더 사업 20건 한꺼번에」)
   ① 엑셀(.xlsx) → 행마다 한 줄 — 공유 글자·바로 쓴 글자·숫자, 읽는 법(rPh)은 빼고, 시트 차례는 워크북대로
   ② 선정·계약 사업 → 실적 입력 창을 «채워서 열기»만 — 저장은 사람이(이알피 동기화와 겹치지 않게)
   ③ «사업 같음» 모두 고르기 — 아직 안 올린 것만, 올리기는 사람이 누른다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const B = require('../js/kcareer-biz.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 없음');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 엑셀 = (행들) => ({
  shared: '<sst><si><t>품목</t></si><si><t>금액</t></si><si><r><t>컨설팅</t></r><r><t>비</t></r><rPh><t>こん</t></rPh></si></sst>',
  workbook: '<workbook><sheets><sheet name="표지" sheetId="2" r:id="rId2"/><sheet name="견적" sheetId="1" r:id="rId1"/></sheets></workbook>',
  rels: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Target="worksheets/sheet2.xml" Id="rId2"/></Relationships>',
  sheets: { 'xl/worksheets/sheet1.xml': '<sheetData>' + 행들 + '</sheetData>', 'xl/worksheets/sheet2.xml': '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>가나공단 &amp; 다라</t></is></c></row></sheetData>' }
});

test('① 엑셀 → 행마다 한 줄 · 시트 차례는 워크북대로 · 빈 행은 뺀다', () => {
  const L = B.xlsxLines(엑셀('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>3000000</v></c></row><row r="3"><c r="A3"/></row>'));
  assert.deepEqual(L, ['[표지] 1행: 가나공단 & 다라', '[견적] 1행: 품목 · 금액', '[견적] 2행: 컨설팅비 · 3000000']);
});

test('① 견적서 두 판을 견주면 바뀐 행이 «고친 줄»로 잡힌다', () => {
  const 작년 = B.xlsxLines(엑셀('<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>3000000</v></c></row>')).join('\n');
  const 올해 = B.xlsxLines(엑셀('<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>3500000</v></c></row>')).join('\n');
  const r = B.lineDiff(작년, 올해);
  assert.equal(r.chg, 1); assert.equal(r.same, 1);
  const d = 떼기('async function _bizDocText(');
  assert.match(d, /f\.ext==='xlsx'/); assert.match(d, /KcareerBiz\.xlsxLines\(/, '엑셀 읽기는 판정 모듈 한 곳');
  assert.ok((SRC.match(/\/\^\(hwpx\?\|pdf\|xlsx\|txt\|md\|csv\)\$\//g) || []).length >= 2, '서랍·짝 고르기 둘 다 엑셀을 견줄 수 있어야 합니다');
});

test('② 실적 칸 짝 — 사업명·발주기관·연도·금액(숫자만)·유형', () => {
  const r = { id: 'BZ0003', title: '2026 일터혁신 상생컨설팅', org: '가나재단', year: '2026', amt: '48,000,000원', kind: '수행기관' };
  const c = B.perfFields('consult', r);
  assert.equal(c.type, '일터혁신'); assert.equal(c.project, r.title); assert.equal(c.agency, '가나재단'); assert.equal(c.amt, '48000000');
  assert.match(c.note, /BZ0003/, '어느 사업에서 왔는지 남긴다');
  assert.equal(B.perfFields('consult', { title: '비정규직 고용구조 개선' }).type, '기타');
  assert.equal(B.perfFields('etc', r).type, '수행기관');
  assert.equal(B.perfFields('fund', r).org, '가나재단');
  assert.equal(B.perfFields('case', r), null, '정한 셋 밖으로는 안 넘긴다');
  /* ★ 발주처와 직접 맺은 사업(입찰·용역)은 수행기관을 비운다 — 적으면 «외부기관 실적»으로만 간다(2026-10-07) */
  assert.equal(B.perfFields('consult', Object.assign({}, r, { kind: '입찰·용역' })).agency, '', '직접 맺은 사업이 외부기관 실적으로 새면 컨설팅실적에서 안 보인다');
});

test('★★ ② 실적 입력 창을 채워서 «열기만» — 실적을 몰래 저장하지 않는다', () => {
  const 칸 = {}, 열림 = [], 통 = { bizapp: [{ id: 'BZ0003', title: '가', stage: '선정' }] };
  const ctx = { console, JSON, Date, String, Number, KcareerBiz: B, FORM_DEFS: { consult: { title: '컨설팅실적', store: 'consult' } },
    get: (k) => 통[k] || [], set: (k, v) => { 통[k] = v; }, toast() {}, bizClose() {},
    openForm: (p) => { 열림.push(p); ['type', 'org', 'project', 'agency', 'year', 'status', 'amt', 'note'].forEach((k) => { 칸['ff-' + k] = { value: '' }; }); },
    document: { getElementById: (id) => 칸[id] || null } };
  vm.createContext(ctx);
  vm.runInContext([떼기('function _bizClean('), 떼기('function _bizPut('), 'var BIZ_STORE="bizapp";', 'function _bizReadForm(){}', 떼기('function bizToPerf(')].join('\n'), ctx);
  ctx._bizCur = { id: 'BZ0003', title: '2026 일터혁신 컨설팅', org: '가나재단', year: '2026', amt: '1,000', stage: '선정', docs: [] };
  ctx.bizToPerf('consult');
  assert.deepEqual(열림.slice(), ['consult']);
  assert.equal(칸['ff-project'].value, '2026 일터혁신 컨설팅'); assert.equal(칸['ff-amt'].value, '1000');
  assert.ok(!통.consult, '★ 실적 칸은 이알피 동기화도 받는다 — 여기서 저장하면 겹친다');
  assert.equal(통.bizapp[0].perfTo.length, 1, '넘긴 기록은 사업에 남긴다');
  assert.match(떼기('function bizDraw('), /KcareerBiz\.isWin\(r\.stage\)/, '선정·계약된 사업에만 단추');
});

test('③ «사업 같음» 모두 고르기 — 아직 안 올린 것만', () => {
  const 상자들 = [0, 1, 2].map((i) => ({ value: String(i), checked: false }));
  const ctx = { console, toast() {}, bizPickDraw() {},
    document: { querySelectorAll: (s) => (/:checked/.test(s) ? 상자들.filter((x) => x.checked) : 상자들) } };
  vm.createContext(ctx);
  vm.runInContext(떼기('function bizPickAllBiz('), ctx);
  ctx._bizPick = { all: false, q: '', list: [{ biz: true, used: '' }, { biz: true, used: '이미 올린 사업' }, { biz: false, used: '' }] };
  ctx.bizPickAllBiz();
  assert.deepEqual(상자들.map((x) => x.checked), [true, false, false], '★ 이미 올린 건을 또 고르면 같은 사업이 둘');
  assert.ok(!/bizPickGo\(/.test(떼기('function bizPickAllBiz(')), '고르기만 — 올리기는 사람이 누른다');
});
