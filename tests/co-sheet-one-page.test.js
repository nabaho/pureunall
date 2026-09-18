'use strict';
/* 📄 회사 한 장 (온톨로지 2걸음, 대표 결정 2026-09-18 「2」)

   「사업자번호 하나로 그 회사의 모든 것을 모아 본다」

   ★ 이 검사가 못 박는 것:
     ① 번호로만 모은다 — 이름으로 끌어오지 않는다
     ② «읽기만» 한다 — 고치는 단추를 두지 않는다
     ③ 어디서 온 값인지 한 줄마다 적는다
     ④ 번호로 «못 이은 것»(명함·정부사업일정)을 갈라서 적는다 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const SRC = stripJs(RAW);
const PuCoKey = require(path.join(ROOT, 'js', 'pu-cokey.js'));

/* 모으는 함수를 가짜 창에 올려 «실제로» 돌린다 */
function gather(stores, bizNo, coInfo, idx) {
  const ctx = {
    console, Object, String, Number, Array, JSON,
    window: { PuCoKey: PuCoKey, pucardsIdx: idx || null },
    dbGet: (k, d) => (stores[k] !== undefined ? stores[k] : d)
  };
  vm.createContext(ctx);
  /* ⚠ 이름 다듬기를 «흉내 내지» 않는다 — 흉내 내면 이 검사는 흉내를 보게 되고,
       진짜 규칙(「(주)」를 괄호째 떼기 등)이 갈라져도 초록으로 남는다. */
  vm.runInContext(
    /var PC_CORP_TOKENS = [^\n]*/.exec(RAW)[0] + '\n' +
    cutFn(RAW, 'function pcNormCo(') + '\n' +
    cutFn(RAW, 'function erpCoSheetGather('), ctx);
  return ctx.erpCoSheetGather(bizNo, coInfo || null);
}

const A = '123-86-20128';      // 2026-09-18 서버에 실제로 있는 번호
const B = '123-86-20389';

test('①★ 번호로만 모은다 — 이름이 같아도 번호가 다르면 «안» 끌어온다', () => {
  const g = gather({
    companies: [{ name: '가나상사', bizNo: A }],
    contracts: [
      { contractNo: '계약-2026-001', bizNo: A, companyName: '가나상사', startDate: '2026-03-01' },
      { contractNo: '계약-2026-002', bizNo: B, companyName: '가나상사', startDate: '2026-04-01' },
      { contractNo: '계약-2026-003', bizNo: '',  companyName: '가나상사', startDate: '2026-05-01' }
    ]
  }, A);
  assert.equal(g.rows.length, 1, '번호가 맞는 한 건만');
  assert.equal(g.rows[0].no, '계약-2026-001');
});

test('② 붙임표·열세 자리가 달라도 같은 회사로 본다', () => {
  const g = gather({ contracts: [{ contractNo: 'C1', bizNo: '1238620128' }] }, '123-86-20128');
  assert.equal(g.rows.length, 1, '같은 번호를 다르게 적어도 이어진다');
});

test('③ 검산 못 한 번호로는 아무것도 모으지 않는다', () => {
  const g = gather({ contracts: [{ contractNo: 'C1', bizNo: '123-45-67890' }] }, '123-45-67890');
  assert.equal(g.key, '', '열쇠가 없다');
  assert.equal(g.rows.length, 0, '못 믿을 번호로 모으면 남의 회사가 섞인다');
});

test('③-2★ 검산 못 한 번호면 «기업정보함이 준 이름»도 안 쓴다', () => {
  /* out.key 는 함수 맨 앞에서 이미 굳혀 두므로, 뒤에서 검산을 건너뛰어도
     g.key 자체는 안 바뀐다 — 그래서 ③ 만으로는 «가드를 없애도» 안 걸린다.
     진짜로 갈리는 자리는 «coInfo.company 를 이름에 쓰느냐» 다. 그 가드가
     없으면 검산 못 한 번호에도 기업정보함 이름이 슬쩍 앉는다. */
  const g = gather({}, '123-45-67890', { company: '엉뚱한회사' });
  assert.equal(g.name, '', '검산 못 한 번호로는 기업정보함 이름도 빌려 오면 안 된다');
});

test('④ 지운 것은 안 센다', () => {
  const g = gather({
    contracts: [{ contractNo: 'C1', bizNo: A }, { contractNo: 'C2', bizNo: A, _deleted: true }]
  }, A);
  assert.equal(g.rows.length, 1);
});

test('⑤ 다섯 갈래를 모두 본다 — 한 갈래만 빠져도 「없다」로 보인다', () => {
  const g = gather({
    contracts:      [{ contractNo: 'C1', bizNo: A }],
    consultings:    [{ no: '현클-2026-1', bizNo: A }],
    cases:          [{ no: '사건-1', bizNo: A }],
    funds:          [{ no: '기금-1', bizNo: A }],
    other_projects: [{ no: '기타-1', bizNo: A }]
  }, A);
  /* ⚠ 가짜 창에서 만든 배열은 «다른 세계»의 것이라 deepEqual 이 모양만 같다고 걸린다
       — Array.from 으로 이쪽 세계의 배열로 옮겨 견준다. */
  assert.deepEqual(Array.from(g.rows, r => r.label).sort(),
    ['계약', '기금', '기타', '사건', '컨설팅']);
});

test('⑥ 최근 것이 위로 온다', () => {
  const g = gather({
    contracts: [{ contractNo: 'C1', bizNo: A, startDate: '2026-01-01' },
                { contractNo: 'C2', bizNo: A, startDate: '2026-07-01' }]
  }, A);
  assert.equal(g.rows[0].no, 'C2');
});

test('⑦★ 명함은 «이름으로» 센다 — 그렇게 셌다는 것을 값으로 남긴다', () => {
  const g = gather(
    { companies: [{ name: '가나상사', bizNo: A }] }, A, null,
    { c1:{ k:'card', c:'가나상사' }, c2:{ k:'card', c:'(주)가나상사' },
      c3:{ k:'card', c:'다라물산' }, b1:{ k:'biz', c:'가나상사' } });
  assert.equal(g.cardN, 2, '이름이 같은 명함만 센다 (등록증은 명함이 아니다)');
  const g2 = gather({ companies: [{ name: '가나상사', bizNo: A }] }, A);   // 색인이 없다
  assert.equal(g2.cardN, null, '아직 안 셌으면 «모른다»(0 이 아니다) — 0 은 「없다」는 거짓말');
});

test('⑧★ 읽기만 한다 — 고치거나 저장하는 길이 없다', () => {
  const modal = stripJs(cutFn(RAW, 'function CompanySheetModal('));
  assert.ok(!/dbSet\(|dbPatch\(|dbUpsert\(|dbRemove\(|\.update\(|\.set\(/.test(modal),
    '이 창에서 저장하면 그 화면의 권한·동시편집 규칙을 건너뛴다');
  assert.ok(!/<input|h\('input'|h\('textarea'/.test(modal), '고쳐 넣는 칸이 없다');
  assert.match(modal, /보기만/, '보기만 한다고 화면에 적는다');
});

test('⑨★ 어디서 온 값인지 한 줄마다 적는다', () => {
  const modal = stripJs(cutFn(RAW, 'function CompanySheetModal('));
  ['사업자등록증', '기업정보함', '신청서', '확인서', '업체관리']
    .forEach(s => assert.ok(modal.indexOf("'" + s + "'") > 0, '「' + s + '」 출처가 없다'));
  assert.match(modal, /function line\(k, v, src\)/, '줄마다 출처를 받는다');
});

test('⑩★ 번호로 «못 이은 것»을 갈라서 적는다 — 뭉뚱그리면 거짓이 된다', () => {
  const modal = stripJs(cutFn(RAW, 'function CompanySheetModal('));
  assert.match(modal, /⚠ 번호로는 못 이은 것/, '갈라 적는 칸이 있다');
  assert.match(modal, /명함에는 사업자번호가 없어/, '명함을 왜 이름으로 셌는지 적는다');
  assert.match(modal, /정부사업일정[\s\S]{0,80}사업자번호가/, '정부사업일정이 왜 안 이어지는지 적는다');
  assert.match(modal, /사업자번호로 이어진 것/, '이어진 쪽도 무엇으로 이었는지 적는다');
});

test('⑪ 열 때 기업상세를 «한 번»만 읽는다 (구독하지 않는다)', () => {
  const host = stripJs(cutFn(RAW, 'function CompanySheetHost('));
  assert.match(host, /window\.PuCoKey\.coInfoPath\(bizNo\)/, '자리는 공용 파일이 만든다');
  assert.match(host, /\.once\('value'\)/);
  assert.ok(!/\.on\('value'/.test(host), '구독하면 창을 닫아도 계속 받는다');
  assert.match(host, /if\(!key\)\{ showToast/, '검산 못 한 번호면 열지 않고 말한다');
});

test('⑫ 어디서든 열 수 있고, 실제로 달려 있다', () => {
  assert.match(SRC, /window\.erpOpenCoSheet = erpOpenCoSheet;/, '어디서든 부를 수 있다');
  assert.match(SRC, /isLoggedIn && h\(CompanySheetHost\)/, '로그인 뒤에 «실제로» 달려 있다');
  assert.match(SRC, /onClick:function\(\)\{ erpOpenCoSheet\(f\.company\.bizNo\); \}/,
    '계약창 띠에서 열 수 있다');
});
