'use strict';
/* 근로자 줄을 사진첩 «명함·근로계약서»에서 채운다 (대표 지시 2026-09-12)
   「근로자의 명함 또는 계약의 경우 계약서 작성사항이 있다.
     사진첩에 정리되면 내용을 읽어서 당겨오게 해달라」

   ■ 왜
     여태 근로자 줄을 채우는 길은 «파일을 새로 올려 판독»하는 것뿐이었다(📇 근로자 명함).
     이미 사진첩에 들어와 판독까지 끝난 서류가 있어도 다시 올려 다시 읽었다 —
     판독 몫을 한 번 더 태우고, 같은 사진이 사진첩에 두 벌 쌓였다.

   ■ 규칙
     ⓐ 받는 갈래는 **둘뿐** — 명함(card)·근로계약서(wcontract).
     ⓑ **빈 칸만** 채운다. 사람이 적어 둔 것은 그대로 둔다.
     ⓒ 무엇이 들어오는지 **고르기 전에** 보인다.
   ⚠⚠ 주민번호는 어디서도 안 온다 — 명함에 없고 근로계약서에서도 안 읽는다.
   ⚠ 회사 주소·회사 전화를 사람 칸에 넣지 않는다 — 그 사람 집이 회사가 된다.
   ⚠ 근로계약서의 endDate 는 «계약이 끝나는 날»이지 «퇴사한 날»이 아니다.
   ⚠ 임금은 적힌 그대로 — 숫자로 고치면 1만 배 틀린다. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

const 상자 = (function () {
  const box = { String, Object, Array, fmtDate: (t) => '2026.09.12' };
  box.globalThis = box;
  vm.createContext(box);
  ['function erpWorkerFromDoc(', 'function erpWorkerDocRowText(', 'function erpWorkerDocFilter(']
    .forEach(function (d) { vm.runInContext(cutFn(ERP, d), box); });
  return box;
})();
const 당기기 = 상자.erpWorkerFromDoc;

/* 명함 한 장 — 홍길동, 가나상사 (예시는 늘 가짜 이름으로) */
const 명함 = { name: '홍길동', company: '가나상사', dept: '총무팀', title: '과장',
  mobile: '010-1111-2222', tel: '031-000-0000', email: 'hong@gana.kr',
  address: '경기도 성남시 …', companyAddr: '서울시 강남구 …', companyTel: '02-000-0000' };

/* 근로계약서 한 장 */
const 근계 = { name: '임꺽정', company: '가나상사', position: '생산직',
  hireDate: '2025-03-02', endDate: '2027-03-01', termType: '있음',
  wageType: '월급', wage: '월 2,500,000원' };

test('① ★★ 명함에서 이름·직책·연락처·이메일·주소가 들어온다', function () {
  const r = 당기기('card', 명함, {});
  assert.deepEqual(r.patch, {
    name: '홍길동', position: '과장', phone: '010-1111-2222',
    email: 'hong@gana.kr', address: '경기도 성남시 …'
  }, '★★ 명함에서 당겨오는 칸이 달라졌습니다');
});

test('② ★★ 회사 주소·회사 전화는 «사람 칸에 안 넣는다»', function () {
  const 회사만 = { name: '홍길동', companyAddr: '서울시 강남구 …', companyTel: '02-000-0000' };
  const r = 당기기('card', 회사만, {});
  assert.equal(r.patch.address, undefined,
    '★★ 회사 주소가 근로자 주소로 들어갔습니다 — 그 사람 집이 회사가 됩니다');
  assert.equal(r.patch.phone, undefined, '★★ 회사 대표번호가 근로자 연락처로 들어갔습니다');
});

test('③ ★ 휴대폰이 직통전화보다 먼저다 — 그 사람에게 닿는 번호다', function () {
  assert.equal(당기기('card', 명함, {}).patch.phone, '010-1111-2222');
  const 휴대폰없음 = Object.assign({}, 명함, { mobile: '' });
  assert.equal(당기기('card', 휴대폰없음, {}).patch.phone, '031-000-0000',
    '★ 휴대폰이 없으면 직통전화라도 와야 합니다');
});

test('④ ★ 직책이 없으면 부서라도 — 빈칸보다 낫다', function () {
  const 직책없음 = Object.assign({}, 명함, { title: '' });
  assert.equal(당기기('card', 직책없음, {}).patch.position, '총무팀');
});

test('⑤ ★★ 이미 적힌 칸은 «안 덮는다»', function () {
  const 적어둠 = { name: '고쳐적은이름', phone: '010-9999-9999' };
  const r = 당기기('card', 명함, 적어둠);
  assert.equal(r.patch.name, undefined, '★★ 사람이 고쳐 둔 이름을 옛 명함이 되돌렸습니다');
  assert.equal(r.patch.phone, undefined, '★★ 사람이 넣은 연락처를 덮어썼습니다');
  assert.equal(r.patch.email, 'hong@gana.kr', '★ 빈 칸은 채워야 합니다');
  assert.ok(r.skipped.join(' ').indexOf('이름') >= 0, '★ 왜 안 채웠는지 안 말합니다');
});

test('⑥ ★★ 주민번호는 «어디서도» 안 온다', function () {
  /* 판독 결과에 어쩌다 들어 있어도 근로자 줄로는 안 간다 */
  const 섞임 = Object.assign({}, 명함, { rrn: '951212-1234567', 주민번호: '951212-1234567' });
  const r = 당기기('card', 섞임, {});
  assert.equal(r.patch.rrn, undefined, '★★ 주민번호가 근로자 줄로 들어갔습니다');
  assert.ok(JSON.stringify(r.patch).indexOf('951212') < 0, '★★ 주민번호가 어딘가에 섞여 들어갔습니다');
});

test('⑦ ★★ 근로계약서 — 이름·직위·입사일이 들어오고, 임금은 «적힌 그대로» 비고로', function () {
  const r = 당기기('wcontract', 근계, {});
  assert.equal(r.patch.name, '임꺽정');
  assert.equal(r.patch.position, '생산직');
  assert.equal(r.patch.hireDate, '2025-03-02');
  assert.match(r.patch.note, /월 2,500,000원/,
    '★★ 임금을 숫자로 고치면 「월 100만원」이 1만 배 틀립니다 — 적힌 그대로여야 합니다');
});

test('⑧ ★★ 근로계약서의 «종료일»을 퇴사일로 넣지 않는다', function () {
  const r = 당기기('wcontract', 근계, {});
  assert.equal(r.patch.leaveDate, undefined,
    '★★ 아직 다니는 사람이 나간 것으로 보입니다 — 계약이 끝나는 날이지 나간 날이 아닙니다');
  assert.match(r.patch.note, /종료 예정 2027-03-01/, '★ 그 날짜를 통째로 버리지도 말 것');
  assert.ok(r.skipped.join(' ').indexOf('퇴사일') >= 0, '★ 왜 안 넣었는지 안 말합니다');
});

test('⑨ ★★ 받는 갈래는 «둘뿐» — 신분증·통장은 근로자 줄을 못 채운다', function () {
  ['idcard', 'resident', 'bankbook', 'contract', 'bizreg', ''].forEach(function (k) {
    const r = 당기기(k, Object.assign({}, 명함, 근계), {});
    assert.deepEqual(r.patch, {},
      '★★ ' + k + ' 로도 근로자 줄이 채워집니다 — 통장 계좌가 사람에게 붙으면 남의 계좌로 보냅니다');
  });
});

test('⑩ ★ 화면이 쓰는 갈래 표도 둘뿐이다', function () {
  const src = stripComments(ERP);
  const m = /var ERP_WK_DOC_KINDS = \{([^}]*)\}/.exec(src);
  assert.ok(m, '갈래 표를 못 찾았습니다');
  const keys = (m[1].match(/(\w+)\s*:/g) || []).map((s) => s.replace(/\s*:/, '')).sort();
  assert.deepEqual(keys, ['card', 'wcontract'],
    '★★ 받는 갈래가 늘었습니다 — 통장·신분증이 들어오면 계좌·주민번호가 사람에게 붙습니다');
});

test('⑪ ★ 찾기 칸이 이름·회사·직책에 다 걸린다', function () {
  const 목록 = [
    { kind: 'card', fields: 명함 },
    { kind: 'wcontract', fields: 근계 }
  ];
  const 거르기 = 상자.erpWorkerDocFilter;
  assert.equal(거르기(목록, '홍길동').length, 1);
  assert.equal(거르기(목록, '가나상사').length, 2, '★ 회사로 찾으면 둘 다 나와야 합니다');
  assert.equal(거르기(목록, '생산직').length, 1, '★ 직위로도 찾을 수 있어야 합니다');
  assert.equal(거르기(목록, '').length, 2, '빈 말이면 다 보인다');
});

test('⑫-0 ★★ 이름이 «안 겹친다» — 한 파일이라 뒤엣것이 조용히 이긴다', function () {
  /* 2026-09-12 에 실제로 겪었다: 새 창을 WorkerDocPickerModal 로 지었는데,
     그 이름은 「근로자 정보함에서 가져오기」 창이 2026-09-02 부터 쓰고 있었다.
     pu-erp.html 은 한 파일이라 뒤에 선언된 것이 이기고, 검사도 다 통과한다. */
  const src = stripComments(ERP);
  ['WorkerPhotoPickerModal', 'WorkerDocPickerModal', 'erpWorkerFromDoc', 'erpScanPhotos',
   'erpLoadWorkerDocPhotos', 'erpWorkerDocFilter', 'erpWorkerDocRowText']
    .forEach(function (n) {
      const 수 = (src.match(new RegExp('function ' + n + '\\s*\\(', 'g')) || []).length;
      assert.equal(수, 1, '★★ 「' + n + '」 이 ' + 수 + '번 선언돼 있습니다 — 뒤엣것이 조용히 이깁니다');
    });
});

test('⑫ ★★ 고르기 «전»에 무엇이 들어오는지 보인다', function () {
  const 창 = stripComments(cutFn(ERP, 'function WorkerPhotoPickerModal('));
  assert.match(창, /erpWorkerFromDoc\(it\.kind, it\.fields, props\.hint/,
    '★★ 줄마다 「무엇이 들어오는지」를 안 그립니다 — 눌러 보고 알면 늦습니다');
  assert.match(창, /got\.lines/, '★ 들어올 값을 줄에 안 적습니다');
  /* 무엇이 «안» 오는지도 먼저 말한다 */
  assert.match(창, /주민번호는 안 들어옵니다/,
    '★★ 안 오는 것을 안 말하면 「왜 비었지」를 겪고 이 길을 안 믿게 됩니다');
});

test('⑬ ★★ 원본 사진은 «안 받는다» — 고를 때마다 1~2MB 가 나간다', function () {
  const 창 = stripComments(cutFn(ERP, 'function WorkerPhotoPickerModal('));
  assert.ok(!/loadFull/.test(창),
    '★★ 원본을 받고 있습니다 — 여기서 고르는 것은 「이 사람이 맞나」이고 미리보기면 충분합니다');
  assert.match(창, /loadThumb/, '★ 미리보기는 받아야 합니다 — 명함은 생김새로 알아봅니다');
});

test('⑭ ★ 어느 사진에서 왔는지 남긴다 — 나중에 「이건 뭐지」에 답해야 한다', function () {
  const src = stripComments(ERP);
  const at = src.indexOf('wkDocPick && h(WorkerPhotoPickerModal');
  assert.ok(at > 0, '창을 띄우는 자리를 못 찾았습니다');
  assert.match(src.slice(at, at + 1600), /docFrom: \{ id: it\.id, year: it\.year/,
    '★ 어느 사진에서 왔는지 안 남깁니다');
});
