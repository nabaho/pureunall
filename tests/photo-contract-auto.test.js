'use strict';
/* 📸 신청서 캡처 → 계약 자동 등록 (대표 지시 2026-09-19 「가」)
   실행: node --test tests/photo-contract-auto.test.js
   목업 docs/mockups/photo-to-contract-auto.html

   ■ 무엇을 만들었나
   대표: 「사진첩에 … 정부사업과 관련된 내용이 화면캡쳐가 되면 자동으로 OCR 파싱 이후
         푸른이알피의 계약관리에 자동으로 올라가게 … 담당자가 누구인지 선택해서
         자동으로 계약관리에 등록되게」

   ■ ★★★ 못 박는 것 — 이 네 가지가 깨지면 «잘못된 계약»이 조용히 생긴다
   ① 사진첩은 계약(data/contracts)을 **직접 안 쓴다.** 요청만 남긴다.
      업체 연결·사업자번호 충돌·계약 중복·월 잠금 검사가 전부 계약관리에 있다 —
      흉내 내면 같은 규칙이 두 곳으로 갈려 한쪽만 고쳐지는 날이 온다.
   ② 검사 규칙은 **하나**다. 모달도 자동 등록도 같은 함수를 부른다.
      따로 세면 「화면은 묻는데 자동은 안 막는」 어긋남이 생긴다.
   ③ 목록이 **다 내려오기 전에는 안 돈다.** 업체 목록이 비어 보이면 전부 「연결 보류」가
      되고, 계약 목록이 비어 보이면 중복을 못 찾아 같은 계약을 또 만든다.
   ④ 걸리면 **안 만들고 까닭을 남긴다.** 자동이라 아무도 그 자리에서 안 보고 있다.

   ■ ★★★ 실제 자료로 재 보고 고친 것 둘 (2026-09-19, 대표 지시 「고치고 다시 검증」)
   실제 신청서 49장을 넣어 보니 처음 판에 구멍이 둘 있었다.
   ⑤ **유형을 못 고르면 첫 유형(현장클리닉)으로 찍었다** — 47장 중 25장이 그랬다.
      「인사노무 컨설팅 신청서」가 현장클리닉이 되었다. 모달은 사람이 드롭다운을
      «보고» 있어 첫 항목 기본값이 괜찮지만 자동 등록은 아무도 안 보고 있다.
      → 찍지 «않고» 사진첩에서 고르게 했다. 짐작되면 미리 골라 두고, 아니면 사람이.
   ⑥ **계약이 아닌 서류가 계약이 되었다** — 위촉장·등기사항전부증명서·「신청내용」.
      판독이 「서식」으로 묶는 범위가 계약보다 넓다.
      → **사업자번호**로 가른다. 실제 48장 중 진짜 신청서 44장은 모두 갖고 있었고,
        계약이 아닌 4장은 하나도 없었다. 칸 수보다 이 한 칸이 깨끗하게 가른다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments, stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const PHOTOS = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8');
const ONTO = fs.readFileSync(path.join(R, 'js/pu-ontology.js'), 'utf8');
const DOCFILE = fs.readFileSync(path.join(R, 'js/pu-doc-file.js'), 'utf8');
const RULES = fs.readFileSync(path.join(R, 'scripts/make-firebase-rules.js'), 'utf8');
const 사진몸통 = stripComments(PHOTOS);

/* ══════ ① 사진첩은 계약을 직접 만들지 않는다 ═══════════════════════ */

test('★★★ 사진첩이 계약(data/contracts)에 «직접 쓰지 않는다»', () => {
  const fn = stripJs(cutFn(DOCFILE, 'function requestContract(') || '');
  assert.ok(fn, 'PuDocFile.requestContract 가 없습니다');
  assert.ok(!/contracts['"\/]/.test(fn.replace(/contract_requests/g, '')),
    '★★★ 여기서 계약을 쓰면 업체 연결·중복·월 잠금 검사를 통째로 건너뜁니다');
  assert.match(fn, /CT_REQ/, '★★★ 남기는 것은 «요청 한 줄»입니다');
});

test('★★★ 사진첩 «화면»은 남의 앱 자리도 db 도 직접 안 만진다', () => {
  /* 2026-07 실데이터 사고 뒤에 세운 울타리다(tests/pu-photos-html.test.js).
     2026-09-19 에 이 기능을 화면에 먼저 짰다가 그 검사 셋에 걸렸다 —
     자리 이름을 아는 일은 PuDocFile 의 몫이다. 여기서 그 갈래를 다시 못 박는다. */
  const fn = stripJs(cutFn(PHOTOS, 'function sendContractRequest(') || '');
  assert.ok(fn, 'sendContractRequest 가 없습니다');
  assert.match(fn, /PuDocFile\.requestContract\(/,
    '★★★ 화면이 자리 이름을 알기 시작하면 그쪽이 바뀔 때 조용히 깨집니다');
  assert.ok(!/db\.ref\(/.test(fn), '★★★ 화면이 db.ref 를 직접 부르면 안 됩니다');
  const load = stripJs(cutFn(PHOTOS, 'function loadErpStaff(') || '');
  assert.match(load, /PuDocFile\.erpStaff\(\)/);
  assert.ok(!/db\.ref\(/.test(load));
});

test('★★★ 요청에는 «누가 맡는지»가 사번으로 들어간다', () => {
  const scr = stripJs(cutFn(PHOTOS, 'function sendContractRequest(') || '');
  assert.match(scr, /managerMain:\s*_ctMgr/, '★★★ 화면이 고른 사람을 안 실어 보냅니다');
  const fn = stripJs(cutFn(DOCFILE, 'function requestContract(') || '');
  assert.match(fn, /managerMain:\s*String\(o\.managerMain\)/);
  assert.match(fn, /state:\s*'pending'/,
    '★★ 처리할 것인지 아닌지를 표로 남겨야 계약관리가 고릅니다');
  assert.match(fn, /!o\.managerMain\)\s*return Promise\.reject/,
    '★★★ 담당자 없이 보내면 계약관리가 거절해 요청만 걸린 채 쌓입니다');
  assert.match(fn, /!o\.company \|\| !o\.company\.name\)\s*return Promise\.reject/,
    '★★★ 회사 이름 없는 요청도 영영 걸립니다');
});

test('★★★ 담당자·유형을 안 고르면 «만들 수 없다»', () => {
  const box = stripJs(cutFn(PHOTOS, 'function contractBox(') || '');
  assert.match(box, /_ctMgr && _ctType \? '' : ' disabled'/,
    '★★★ 둘 중 하나라도 없이 보내면 계약관리가 거절해 요청만 쌓입니다');
  const fn = stripJs(cutFn(PHOTOS, 'function sendContractRequest(') || '');
  assert.match(fn, /!_ctMgr \|\| !_ctType\) return/,
    '★★★ 단추만 막으면 안 됩니다 — 보내는 쪽에서도 막아야 합니다');
});

test('★★★ 보내고 난 뒤에도 고른 담당자·유형을 «잊는다»', () => {
  /* ⚠ 되돌림에서 이 자리가 안 걸렸다(2026-09-19) — 창을 닫는 쪽만 보고 있었다.
     한 서류를 보낸 뒤 창을 안 닫고 다음 서류로 넘어가면, 앞 서류의 담당자·유형이
     그대로 남아 **엉뚱한 사람·엉뚱한 유형으로 계약이 만들어진다.** */
  const fn = stripJs(cutFn(PHOTOS, 'function sendContractRequest(') || '');
  const i = fn.indexOf('.then(');
  assert.ok(i >= 0, '보낸 뒤를 못 찾았습니다');
  assert.match(fn.slice(i), /_ctMgr = ''; _ctType = ''/,
    '★★★ 보낸 뒤 안 지우면 다음 서류가 앞 서류의 담당자·유형으로 등록됩니다');
});

test('★★ 창을 닫으면 고른 담당자·유형을 «잊는다»', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function closeViewer(') || '');
  assert.match(fn, /_ctMgr = ''; _ctType = ''/,
    '★★ 안 지우면 다음 서류가 앞 서류의 담당자·유형으로 등록됩니다');
});

test('★★ 직원 명부는 «공개 명부»를 읽는다 — 관리자만 읽는 쪽이 아니다', () => {
  assert.match(DOCFILE, /STAFF_DIR = ERP_ROOT \+ '\/user_dir'/,
    '★★ user_accounts 는 관리자만 읽습니다 — 직원은 고르개가 빈 채로 뜹니다');
  const fn = stripJs(cutFn(DOCFILE, 'function erpStaff(') || '');
  assert.match(fn, /STAFF_DIR/);
  assert.match(fn, /status === 'active' \|\| !u\.status/,
    '★★ 그만둔 사람이 고르개에 남으면 그 앞으로 계약이 등록됩니다');
});

test('★★ 명부를 못 받았으면 «그렇다고 말한다» — 빈 고르개를 안 내민다', () => {
  const box = stripJs(cutFn(PHOTOS, 'function contractBox(') || '');
  assert.match(box, /직원 명부를 아직 못 받았습니다/,
    '★★ 빈 고르개 앞에서는 왜 못 고르는지 알 길이 없습니다');
});

/* ══════ ② 검사 규칙은 «하나»다 ═════════════════════════════════════ */

test('★★★ 사업자번호 충돌 판정이 «한 함수»다 — 모달과 자동 등록이 같이 본다', () => {
  assert.match(stripComments(ERP), /function erpBiznoClash\(/,
    '★★★ 판정이 둘이면 화면은 묻는데 자동은 안 막습니다');
  const modal = stripJs(cutFn(ERP, 'function ContractModal(') || '');
  assert.match(modal, /erpBiznoClash\(/, '★★★ 모달이 그 함수를 안 부릅니다');
  const why = stripJs(cutFn(ERP, 'function ctReqWhy(') || '');
  assert.match(why, /erpBiznoClash\(/, '★★★ 자동 등록이 그 함수를 안 부릅니다');
});

test('★★★ 계약 중복 판정도 «한 함수»다', () => {
  assert.match(stripComments(ERP), /function erpContractDupBlock\(/);
  const modal = stripJs(cutFn(ERP, 'function ContractModal(') || '');
  assert.match(modal, /erpContractDupBlock\(/,
    '★★★ 모달이 제 잣대로 따로 세면 자동 등록과 어긋납니다');
  const why = stripJs(cutFn(ERP, 'function ctReqWhy(') || '');
  assert.match(why, /erpContractDupBlock\(/);
});

test('★★★ 유형이 «겹칠 때만» 막는다 — 자문과 컨설팅은 함께 있을 수 있다', () => {
  const fn = cutFn(ERP, 'function erpContractDupBlock(') || '';
  const ctx = { };
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  const 계약 = [{ id:'c1', contractNo:'2026-1', companyName:'가나상사',
                  kinds:['consulting'], status:'consult' }];
  const 겹침 = ctx.erpContractDupBlock({ company:{ name:'가나상사' }, kinds:['consulting'] }, 계약);
  assert.equal(겹침.length, 1, '★★★ 같은 회사·같은 유형인데 안 걸렸습니다');
  const 안겹침 = ctx.erpContractDupBlock({ company:{ name:'가나상사' }, kinds:['case'] }, 계약);
  assert.equal(안겹침.length, 0, '★★★ 유형이 다른데 막으면 정상 계약이 안 만들어집니다');
});

test('★★★ 끝난 계약·지운 계약은 «중복이 아니다»', () => {
  const fn = cutFn(ERP, 'function erpContractDupBlock(') || '';
  const ctx = {}; vm.createContext(ctx); vm.runInContext(fn, ctx);
  const 폼 = { company:{ name:'가나상사' }, kinds:['consulting'] };
  ['closed', 'cancelled'].forEach(function (st) {
    assert.equal(ctx.erpContractDupBlock(폼,
      [{ id:'c1', companyName:'가나상사', kinds:['consulting'], status:st }]).length, 0,
      '★★★ 끝난 계약 때문에 새 계약을 영영 못 만듭니다 — ' + st);
  });
  assert.equal(ctx.erpContractDupBlock(폼,
    [{ id:'c1', companyName:'가나상사', kinds:['consulting'], status:'consult', _deleted:true }]).length, 0,
    '★★★ 휴지통에 넣은 계약이 새 계약을 막습니다');
});

test('★★ 사업자번호는 «열 자리»일 때만 견준다 — 토막으로 남을 엮지 않는다', () => {
  const fn = cutFn(ERP, 'function erpBiznoClash(') || '';
  const ctx = {}; vm.createContext(ctx); vm.runInContext(fn, ctx);
  assert.equal(ctx.erpBiznoClash({ company:{ bizNo:'123-45' } },
    [{ id:'x', name:'다른곳', bizNo:'123-45' }]), null,
    '★★ 짧은 번호로 엮으면 남의 업체에 걸립니다');
  assert.ok(ctx.erpBiznoClash({ company:{ name:'가나상사', bizNo:'123-45-67891' } },
    [{ id:'x', name:'다라상사', bizNo:'1234567891' }]),
    '★★ 줄표가 달라도 같은 번호는 같은 번호입니다');
});

/* ══════ ③ 목록이 내려오기 전에는 안 돈다 ═══════════════════════════ */

test('★★★ 업체·계약 목록이 «안 내려왔으면» 아무것도 안 만든다', () => {
  const fn = stripJs(cutFn(ERP, 'async function runContractRequests(') || '');
  assert.ok(fn, 'runContractRequests 가 없습니다');
  assert.match(fn, /Array\.isArray\(cos\)[\s\S]{0,60}Array\.isArray\(cts\)[\s\S]{0,40}return/,
    '★★★ 빈 목록으로 판단하면 전부 「연결 보류」가 되고 중복을 못 찾아 같은 계약을 또 만듭니다');
});

test('★★★ 두 번 겹쳐 돌지 않는다 — 겹치면 계약이 둘 생긴다', () => {
  assert.match(stripComments(ERP), /var _erpCtReqBusy = false;/);
  const fn = stripJs(cutFn(ERP, 'async function runContractRequests(') || '');
  assert.match(fn, /_erpCtReqBusy \|\|/, '★★★ 들어오는 문에서 막아야 합니다');
  assert.match(fn, /_erpCtReqBusy = false;/, '★★★ 안 풀면 다음에 영영 안 돕니다');
});

/* ══════ ④ 걸리면 안 만들고 까닭을 남긴다 ═══════════════════════════ */

test('★★★ 걸린 요청은 «만들지 않고» 까닭을 적어 남긴다', () => {
  const fn = stripJs(cutFn(ERP, 'async function runContractRequests(') || '');
  assert.match(fn, /state:'blocked'/,
    '★★★ 조용히 버리면 대표님은 등록된 줄 아십니다');
  assert.match(fn, /why:why/, '★★★ 무엇에 걸렸는지 안 적으면 고칠 수가 없습니다');
});

test('★★★ 만든 요청은 지우고, 걸린 것은 «남긴다»', () => {
  const fn = stripJs(cutFn(ERP, 'async function runContractRequests(') || '');
  const 지움 = fn.indexOf('.remove()');
  const 막힘 = fn.indexOf("state:'blocked'");
  assert.ok(지움 >= 0, '★★ 만든 요청을 안 지우면 계약관리를 열 때마다 또 만듭니다');
  assert.ok(막힘 >= 0 && 막힘 > 지움,
    '★★★ 걸린 것까지 지우면 사람이 볼 것이 사라집니다');
});

test('★★★ 사람이 누른 것과 «같은 문»으로 저장한다', () => {
  const fn = stripJs(cutFn(ERP, 'async function runContractRequests(') || '');
  assert.match(fn, /persistOne\(newOne\)/,
    '★★★ persistOne 을 거쳐야 월 잠금·업체 연결·관계 검증을 지납니다');
  assert.ok(!/dbUpsert\('contracts'/.test(fn),
    '★★★ 곧바로 쓰면 그 검사들을 건너뜁니다');
});

test('★★ 걸린 것이 있으면 «말해 준다» — 자동이라 아무도 기다리고 있지 않다', () => {
  const fn = stripJs(cutFn(ERP, 'async function runContractRequests(') || '');
  assert.match(fn, /if\(blocked\)[\s\S]{0,200}showToast/,
    '★★ 조용하면 안 된 것을 된 줄 압니다');
});

test('★★★ 기간·금액을 «지어내지 않는다»', () => {
  const fn = stripJs(cutFn(ERP, 'function ctReqForm(') || '');
  assert.ok(fn, 'ctReqForm 이 없습니다');
  assert.ok(!/startDate\s*=|endDate\s*=|successFee\s*=/.test(fn),
    '★★★ 신청서에 없는 숫자를 채우면 계약관리의 합계가 거짓이 됩니다');
});

test('★★ 빈 서식은 모달과 «같은 것»을 쓴다', () => {
  assert.match(stripComments(ERP), /function erpBlankContractForm\(/);
  const modal = stripJs(cutFn(ERP, 'function ContractModal(') || '');
  assert.match(modal, /erpBlankContractForm\(\)/,
    '★★ 따로 두면 자동으로 만든 계약에만 없는 칸이 생겨 화면이 조용히 깨집니다');
  const form = stripJs(cutFn(ERP, 'function ctReqForm(') || '');
  assert.match(form, /erpBlankContractForm\(\)/);
});

test('★★★ 유형을 «찍지 않는다» — 사진첩에서 고른 것만 쓴다', () => {
  /* ⚠⚠ 이 검사가 이번 일에서 가장 값진 자리다. 처음 판은 유형을 못 고르면
     types[0].code(현장클리닉)로 «찍었고», 실제 신청서 47장 중 25장이 그렇게 찍혔다.
     모달은 사람이 드롭다운을 보고 있어 괜찮지만 자동 등록은 아무도 안 보고 있다. */
  const fn = stripJs(cutFn(ERP, 'function ctReqForm(') || '');
  assert.ok(!/types\[0\]/.test(fn),
    '★★★ 첫 유형으로 찍으면 「인사노무 컨설팅 신청서」가 현장클리닉이 됩니다');
  assert.match(fn, /req\.consultingType/,
    '★★★ 사진첩에서 고른 유형을 써야 합니다');
  assert.match(fn, /t\.code === code/,
    '★★ 있는 유형인지 확인해야 합니다 — 없는 코드가 들어오면 유형 없는 계약이 됩니다');
});

test('★★★ 유형이 없으면 계약을 «안 만든다»', () => {
  const why = stripJs(cutFn(ERP, 'function ctReqWhy(') || '');
  assert.match(why, /typeCodes\.consulting[\s\S]{0,80}return/,
    '★★★ 유형 없는 계약은 업체관리·컨설팅의 어느 칸에도 안 나와 «사라진 것»이 됩니다');
  const req = stripJs(cutFn(DOCFILE, 'function requestContract(') || '');
  assert.match(req, /!o\.consultingType\)\s*return Promise\.reject/,
    '★★★ 보내는 쪽에서도 막아야 걸린 요청이 안 쌓입니다');
});

test('★★★ 사업자번호가 없으면 «계약 서류가 아니다»', () => {
  /* 실제 48장으로 갈라 봤다 — 진짜 신청서 44장은 모두 있었고,
     위촉장·등기사항전부증명서·「신청내용」 4장은 하나도 없었다. */
  const fn = stripJs(cutFn(PHOTOS, 'function canMakeContract(') || '');
  assert.match(fn, /f\.bizno/,
    '★★★ 없으면 위촉장·등기부에도 「계약 등록」 단추가 뜹니다');
  const why = stripJs(cutFn(ERP, 'function ctReqWhy(') || '');
  assert.match(why, /company\.bizNo[\s\S]{0,120}return/,
    '★★★ 화면만 막으면 안 됩니다 — 만드는 쪽에서도 봐야 합니다');
});

test('★★★ 짐작기는 «후보가 둘이면 안 고른다»', () => {
  const fn = cutFn(DOCFILE, 'function guessConsType(') || '';
  const 안 = cutFn(DOCFILE, 'function nameRun(') || '';
  const 정 = cutFn(DOCFILE, 'function typeNameTidy(') || '';
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext('var TYPE_RUN_MIN = 5;\n' + 정 + '\n' + 안 + '\n' + fn, ctx);
  /* 실제로 있는 짝이다 — 앞 일곱 글자가 같다. 하나를 찍으면 절반이 틀린다. */
  const 유형 = [{ code:'a', name:'인사노무컨설팅충남북부상의' },
                { code:'b', name:'인사노무컨설팅서산' },
                { code:'c', name:'통합기술보호지원단' }];
  assert.equal(ctx.guessConsType('2026년 충남북부상공회의소 인사노무 컨설팅 신청서', 유형), null,
    '★★★ 후보가 둘인데 하나를 찍으면 절반은 틀린 유형으로 계약이 만들어집니다');
  const t = ctx.guessConsType('통합 기술보호지원반 신청서', 유형);
  assert.ok(t && t.code === 'c', '★★ 하나뿐일 때는 골라야 합니다 — 안 그러면 늘 사람이 고릅니다');
});

test('★★ 짐작하는 잣대가 «사진첩과 계약관리에서 같다»', () => {
  /* 사진첩이 고른 유형이 계약관리가 아는 것과 달라지면, 화면에는 A 라고 적히고
     계약에는 B 가 들어간다. 그래서 짐작은 한 곳(PuDocFile)에서만 한다. */
  const box = stripJs(cutFn(PHOTOS, 'function ctGuessType(') || '');
  assert.match(box, /PuDocFile\.guessConsType\(/,
    '★★ 사진첩이 제 잣대를 따로 지으면 계약관리와 갈립니다');
});

/* ══════ ⑤ 자리와 권한 ═══════════════════════════════════════════ */

test('★★★ 새 자리의 권한이 «계약과 같다»', () => {
  assert.match(RULES, /contract_requests:\s*\{\s*'\.read':\s*LOGIN,\s*'\.write':\s*LOGIN\s*\}/,
    '★★★ 담기는 것이 계약에 들어갈 회사 정보입니다 — 계약보다 넓게 열면 구멍입니다');
});

test('★★ 온톨로지에 «계약이 아니라 할 일»로 등록한다', () => {
  assert.match(ONTO, /contract_requests:'Task'/,
    '★★ Contract 로 적으면 관계 색인이 «아직 없는 계약»을 셉니다');
  const seg = ONTO.slice(ONTO.indexOf("photos:{"), ONTO.indexOf("photos:{") + 700);
  assert.match(seg, /data\/contract_requests/, '★★ 사진첩이 쓰는 자리를 선언해야 합니다');
});
