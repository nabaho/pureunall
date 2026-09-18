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
  /* ⚠ 2026-09-18 — 「📊 컨설팅으로」가 붙으면서 글귀가 「아무것도 쓰지 않습니다」로 바뀌었다.
     그 단추는 «계약 창을 채워서 열 뿐» 한 글자도 안 쓴다. 약속을 «더 정확히» 적은 것이라
     글귀를 따라 옮긴다 — 지켜야 할 것은 위 두 줄(저장·입력칸이 없다)이다. */
  assert.match(modal, /아무것도 쓰지 않습니다/, '아무것도 안 쓴다고 화면에 적는다');
  assert.match(modal, /채워서 열 뿐/,
    '★★ 「컨설팅으로」가 계약을 «만드는» 줄 알면 무서워서 못 누르신다');
});

test('⑨★ 어디서 온 값인지 한 줄마다 적는다', () => {
  const modal = stripJs(cutFn(RAW, 'function CompanySheetModal('));
  ['사업자등록증', '기업정보함', '신청서', '확인서', '업체관리']
    .forEach(s => assert.ok(modal.indexOf("'" + s + "'") > 0, '「' + s + '」 출처가 없다'));
  assert.match(modal, /function line\(k, v, src\)/, '줄마다 출처를 받는다');
});

/* ══ 📥 기업정보함이 «읽어 온 서류» = 이 회사가 한 사업 (대표 지시 2026-09-18) ══════
   「푸른이알피에서 기업상세도 당겨서 내용을 확인할 수 있게 해라.
     기업상세의 컨설팅이나 사업을 한번에 당겨서 가지고 갈수 있게 하고 싶다.」

   ★ 여기 있는 것이 대표가 찾으시던 «컨설팅·사업»이다 — 사진첩이 읽은 신청서가
     coInfo/{회사}/docs 에 이름째 쌓여 있고, **서류 이름이 곧 사업 이름**이다.
     여태 이 창은 회사 칸 여덟 줄만 보여 주었고 이것은 통째로 안 보였다. */

const 서류 = (name, at, over) => Object.assign(
  { name, at, year:'2026', id:'p' + at, owner:'kim' }, over || {});

test('⑩-1★★★ 기업상세의 «서류(사업)»를 함께 당겨 온다 — 여태 통째로 안 보였다', () => {
  const g = gather({ companies: [{ name:'가나상사', bizNo:A }] }, A, {
    company:'가나상사',
    docs:{ d1: 서류('통합 기술보호지원 신청서', 300, { pairs:[1,2,3] }),
           d2: 서류('중소기업 확인서', 100) } });
  assert.deepEqual(Array.from(g.docs).map(x => x.name),
    ['통합 기술보호지원 신청서', '중소기업 확인서'],
    '★★★ 이것이 안 오면 대표가 보시려던 「컨설팅·사업」이 이 화면에 없다');
  assert.equal(g.docs[0].pairsN, 3, '★★ 적힌 것이 몇 개인지 세어 둔다');
  assert.equal(g.docs[1].pairsN, 0, '★ 없으면 0 이다 — 없는 것을 지어내지 않는다');
});

test('⑩-2★★ 최근 것이 «위»다 — 사업은 최근 것부터 챙긴다', () => {
  const g = gather({}, A, { docs:{ a: 서류('옛것', 100), b: 서류('새것', 900), c: 서류('가운데', 500) } });
  assert.deepEqual(Array.from(g.docs).map(x => x.name), ['새것','가운데','옛것']);
});

test('⑩-3★★ 기업상세가 «없어도» 안 터진다 — 서류 칸이 빈 채로 열린다', () => {
  assert.deepEqual(Array.from(gather({}, A, null).docs), []);
  assert.deepEqual(Array.from(gather({}, A, { company:'가나' }).docs), []);
});

test('⑩-3-2★★ 이름도 id 도 없는 «껍데기 줄»은 안 담는다', () => {
  const g = gather({}, A, { docs:{ x:{ at:1 }, y: 서류('진짜서류', 2) } });
  assert.deepEqual(Array.from(g.docs).map(x => x.name), ['진짜서류'],
    '★★ 빈 줄을 담으면 목록에 이름 없는 「서식」이 섞여 무엇을 가리키는지 알 수 없다');
});

test('⑩-4★★★ 「📊 컨설팅으로」는 «쪽지만 남기고» 계약 창으로 보낸다 — 계약을 만들지 않는다', () => {
  const ctx = { console, Object, String, Number, Date, JSON,
    showToast: () => {}, location: {},
    window: { navigateTo: (m) => { ctx._went = m; } } };
  ctx.sessionStorage = { setItem: (k, v) => { ctx._note = { k, v }; } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function erpCoSheetToConsulting('), ctx);
  const ok = ctx.erpCoSheetToConsulting(
    { name:'가나상사', bizNo:A, coInfo:{ ceo:'홍길동', address:'천안시', bizType:'제조업', bizItem:'금속' } },
    서류('통합 기술보호지원 신청서', 300));
  assert.equal(ok, true);
  assert.equal(ctx._note.k, 'pu_new_contract', '★★★ 받는 쪽(계약관리)이 아는 그 쪽지여야 한다');
  const seed = JSON.parse(ctx._note.v);
  assert.equal(seed.company.name, '가나상사');
  assert.equal(seed.company.bizNo, A);
  assert.equal(seed.company.ceo, '홍길동');
  assert.equal(seed.srcPhoto.name, '통합 기술보호지원 신청서',
    '★★★ 서류 이름이 없으면 받는 쪽이 컨설팅 «유형»을 고를 근거가 없다');
  assert.equal(ctx._went, 'biz/contract', '★★ 쪽지만 놓고 안 옮기면 아무 일도 안 일어난 것처럼 보인다');
});

test('★★★ 모르는 칸은 «빈 글자로 채워 보내지» 않는다 — 받는 쪽이 채워진 것으로 읽는다', () => {
  const ctx = { console, Object, String, Number, Date, JSON,
    showToast: () => {}, location: {}, window: { navigateTo: () => {} } };
  ctx.sessionStorage = { setItem: (k, v) => { ctx._note = v; } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function erpCoSheetToConsulting('), ctx);
  ctx.erpCoSheetToConsulting({ name:'가나상사', bizNo:A, coInfo:{ ceo:'홍길동' } }, 서류('신청서', 1));
  const co = JSON.parse(ctx._note).company;
  assert.deepEqual(Object.keys(co).sort(), ['bizNo','ceo','name'],
    '★★★ 계약 창은 「빈 칸에만 얹는다」 — 빈 글자를 보내면 그 칸이 영영 안 채워진다');
});

test('★★ 기업상세에 없으면 «업체관리» 값이라도 싣는다 — 두 곳을 다 보는 자리다', () => {
  const ctx = { console, Object, String, Number, Date, JSON,
    showToast: () => {}, location: {}, window: { navigateTo: () => {} } };
  ctx.sessionStorage = { setItem: (k, v) => { ctx._note = v; } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function erpCoSheetToConsulting('), ctx);
  ctx.erpCoSheetToConsulting(
    { name:'가나상사', bizNo:A, coInfo:{}, coMaster:{ ceo:'박영희', phone:'041-1-1' } }, 서류('신청서', 1));
  const co = JSON.parse(ctx._note).company;
  assert.equal(co.ceo, '박영희');
  assert.equal(co.phone, '041-1-1');
});

test('⑩-5★★ 화면이 서류마다 «원본»과 «컨설팅으로»를 준다', () => {
  const modal = cutFn(RAW, 'function CompanySheetModal(');   // ⚠ 주석을 지우지 «않는다» — 아래서 원문 그대로 잰다
  assert.match(modal, /d\.docs && d\.docs\.length/, '★★★ 서류 칸을 안 그리면 당겨 놓고 안 보여주는 것이다');
  /* ⚠⚠ 글자만 찾으면(「pu-photos.html? 이 있나」 「erpCoSheetToConsulting 이 있나」) 그
     단추를 false 로 걸어 잠가도 통과한다 — 실제로 이빨 확인에서 그렇게 샜다.
     «누가 그 줄을 그리는가»(x.id &&, 그 h('button' 바로 뒤)까지 붙여서 잰다. */
  assert.match(modal, /x\.id && h\('button', \{ onClick:function\(\)\{/,
    '★★★ 원본 보기 단추가 x.id 로 잠겨 있지 않다 — 단추가 죽었거나 늘 눌리거나다');
  assert.match(modal, /pu-photos\.html\?/, '★★ 원본을 볼 길이 없다 — 무슨 사업인지 확인이 안 된다');
  assert.match(modal, /'📷 원본'\),\s*\r?\n\s*h\('button', \{ onClick:function\(\)\{\s*\r?\n\s*if\(erpCoSheetToConsulting\(d, x\)\)\{/,
    '★★★ 「컨설팅으로」 단추가 실제로 erpCoSheetToConsulting 을 부르지 않는다');
  assert.ok(!/false && h\('button', \{ onClick:function\(\)\{\s*\r?\n\s*if\(erpCoSheetToConsulting/.test(modal),
    '★★★ 「컨설팅으로」 단추가 false 에 잠겨 있다 — 눌러도 아무 일도 안 일어난다');
  assert.match(modal, /서류 이름이 곧 사업 이름/,
    '★★ 왜 이것이 「사업」인지 안 적으면 서류 목록으로만 읽힌다');
});

test('★★★ 쪽지를 못 놓으면 «놓았다고 하지 않는다» — 옮기지 않은 채 끝난다', () => {
  const ctx = { console, Object, String, Number, Date, JSON,
    showToast: (m) => { ctx._toast = m; }, location: {},
    window: { navigateTo: () => { ctx._went = true; } } };
  ctx.sessionStorage = { setItem: () => { throw new Error('용량 초과'); } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function erpCoSheetToConsulting('), ctx);
  const ok = ctx.erpCoSheetToConsulting({ name:'가나상사', bizNo:A, coInfo:{} }, 서류('신청서', 1));
  assert.equal(ok, false, '★★★ 못 놓았는데 true 를 돌려주면 부르는 쪽이 「성공했다」고 안내한다');
  assert.equal(ctx._went, undefined, '★★ 놓지도 못했는데 계약 창으로 넘어가면 빈손으로 도착한다');
  assert.match(String(ctx._toast || ''), /넘기지 못했습니다/, '★★ 안 되면 왜 안 됐는지 말해야 한다');
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

/* ── 3걸음: 컨설팅관리·사건관리·업체관리에서도 열 수 있다 (2026-09-18 「3」) ── */

test('⑬★ 업체관리(CompanyDetailModal)에 단추가 있고 «검산 통과할 때만» 뜬다', () => {
  const modal = stripJs(cutFn(RAW, 'function CompanyDetailModal('));
  const at = modal.indexOf('회사 한 장');
  assert.ok(at > 0, '업체관리 상세창에 단추가 없다');
  const band = modal.slice(Math.max(0, at - 400), at + 40);
  assert.match(band, /window\.PuCoKey && window\.PuCoKey\.key\(co\.bizNo\)/,
    '검산을 통과 못 하면 단추를 아예 안 그려야 한다 — 못 믿을 번호로 열면 남의 회사가 뜬다');
  assert.match(band, /erpOpenCoSheet\(co\.bizNo\)/, '같은 공용 함수를 부른다(새로 안 만든다)');
});

test('⑭★ 사건관리·컨설팅·기금·기타사업이 함께 쓰는 UnifiedDetailModal 에도 있다', () => {
  const modal = stripJs(cutFn(RAW, 'function UnifiedDetailModal('));
  const at = modal.indexOf('회사 한 장');
  assert.ok(at > 0, '공유 상세창에 단추가 없다');
  const band = modal.slice(Math.max(0, at - 400), at + 40);
  assert.match(band, /window\.PuCoKey && window\.PuCoKey\.key\(c\.bizNo\)/,
    '여기도 검산을 통과할 때만 뜬다');
  assert.match(band, /erpOpenCoSheet\(c\.bizNo\)/, '같은 공용 함수를 부른다');
  /* 이 모달이 실제로 CaseDetailModal 과 ProjectDetailModal(컨설팅/기금/기타) 이
     함께 쓰는 자리인지 — 새 모달을 따로 만든 게 아니라 공유 모달 «하나만» 고쳤는지.
     ⚠ 거리로 자르지 않는다 — 함수 «전체»를 cutFn 으로 떼어 그 안에 있는지 본다. */
  assert.match(stripJs(cutFn(RAW, 'function CaseDetailModal(')), /h\(UnifiedDetailModal,/,
    '사건관리가 이 공유 모달을 쓴다');
  assert.match(stripJs(cutFn(RAW, 'function ProjectDetailModal(')), /h\(UnifiedDetailModal,/,
    '컨설팅·기금·기타사업이 이 공유 모달을 쓴다');
});

test('⑮ 세 자리 모두 «단추가 하나씩만» — 중복으로 안 늘어난다', () => {
  const modal1 = stripJs(cutFn(RAW, 'function CompanyDetailModal('));
  const modal2 = stripJs(cutFn(RAW, 'function UnifiedDetailModal('));
  const count = s => (s.match(/'\uD83D\uDCC4 회사 한 장'/g) || []).length;
  assert.equal(count(modal1), 1, '업체관리 상세창에 단추가 둘 이상이거나 없다');
  assert.equal(count(modal2), 1, '공유 상세창에 단추가 둘 이상이거나 없다');
});
