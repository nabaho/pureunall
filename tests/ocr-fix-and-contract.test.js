'use strict';
/* ✎ 판독 칸 고치기 · 📋 신청서로 계약 등록 (대표 결정 2026-09-18 「추천대로」)
   실행: node --test tests/ocr-fix-and-contract.test.js
   목업 docs/mockups/ocr-fix-and-contract.html

   ■ 무엇이 막혀 있었나
   대표: 「ocr 했는데 제대로 안 읽힌 부분 일부 단어를 수정하거나 변경하고 싶다.
         전체 ocr 을 다시 하는 것보다 그것이 효율적인데 … 그리고 기술보호컨설팅과
         현장클리닉과 같이 화면캡쳐되는 것들을 한번에 계약관리에 바로 등록될 수 있게」
   ① 고칠 수 있는 것이 «갈래»와 «이름·회사» 둘뿐이었다. 홈페이지 칸에 사업자번호가
      흘러들어도 길은 전체 재판독뿐 — 요금이 들고 같은 곳을 또 틀리게 읽는다.
   ② 신청서 캡처는 회사 정보를 다 읽어 두는데, 계약을 만들 때 그것을 손으로 다시 쳤다.

   ■ ★★ 못 박는 것
   ① 고친 값이 «이기고», 판독값은 그대로 남는다(둘 다 있어야 「어디서 나왔지」에 답한다).
   ② 고친 값은 이름 붙은 칸으로 옮겨져 기업 상세까지 간다 — 사전은 판독 층 «하나»다.
   ③ ⚠⚠ 계약은 여기서 «만들지 않는다». 창을 채워 열 뿐이다 —
      data/contracts 에 직접 쓰면 업체 연결 검증·중복 검사·월 잠금을 통째로 건너뛴다.
   ④ 금액·기간은 신청서에 «없다». 지어내면 계약관리의 숫자가 거짓이 된다. */
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
const READ = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8');

/* ── 사진첩의 고치기 셈을 «그대로» 떠서 돌린다 ── */
function 사진첩() {
  const ctx = {
    console, Object, String, Number, Array, JSON, Date, Boolean,
    window: {}, esc: s => String(s == null ? '' : s)
  };
  /* 판독 층의 이름표 사전을 진짜로 싣는다 — 대역으로 바꾸면 「홈페이지 → homepage」가
     틀려도 이 검사가 모른다. */
  const box = { window: undefined, console, Date, Math, JSON, Object, Array, String, Number, RegExp, isNaN, Promise };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(READ, box);
  ctx.window.PuDocRead = box.PuDocRead;
  ctx.PuDocRead = box.PuDocRead;
  vm.createContext(ctx);
  /* ⚠ 상수는 cutFn 이 못 뜬다 — 통째로 찾아 싣는다. READ_ROWS 는 pairs 가 없던
     옛 판독물의 차례표라, 이것 없이 readRows 를 돌리면 그 길에서 터진다. */
  const 상수 = {
    'const FIX_PAIR': /const FIX_PAIR = '[^']*';/,
    'const READ_ROWS': /const READ_ROWS = \[[\s\S]*?\n\];/
  };
  ['const READ_ROWS', 'const FIX_PAIR', 'function fixIsMeta(', 'function fixKeyOfLabel(',
   'function fixCleared(', 'function readFields(', 'function docPairs(',
   'function readRows(', 'function readRawOf(']
    .forEach(function (n) {
      const src = 상수[n] ? (PHOTOS.match(상수[n]) || [''])[0] : cutFn(PHOTOS, n);
      assert.ok(src, n + ' 를 못 찾았습니다');
      vm.runInContext(src.replace(/^const /, 'var '), ctx);
    });
  return ctx;
}
const P = 사진첩();

/* 오늘 실제로 틀린 그 서류 — 홈페이지 칸에 사업자번호가 흘러들었다 */
function 신청서(fix, clear) {
  return {
    kind: 'form',
    fields: {
      company: '농업회사법인주식회사충서', ceo: '박성달', bizno: '587-86-01913',
      homepage: '587-86-01913-0', companyTel: '041-667-1107',
      pairs: [
        { k: '기업명', v: '농업회사법인주식회사충서' },
        { k: '대표자명', v: '박성달' },
        { k: '사업자등록번호', v: '587-86-01913' },
        { k: '전화번호', v: '041-667-1107' },
        { k: '홈페이지', v: '587-86-01913-0' },
        { k: '혁신형 기업여부', v: '해당없음' }
      ]
    },
    fix: fix || undefined, fixClear: clear || undefined
  };
}
const 줄값 = (rows, 이름) => (rows.filter(r => r[0] === 이름)[0] || [])[1];

/* ══════ ① 고친 값이 이긴다 · 판독값은 남는다 ═══════════════════════ */

test('★★★ 이름표를 «이름 붙은 칸»으로 옮긴다 — 사전은 판독 층 하나다', () => {
  assert.equal(P.fixKeyOfLabel('홈페이지'), 'homepage');
  assert.equal(P.fixKeyOfLabel('대표자명'), 'ceo');
  assert.equal(P.fixKeyOfLabel('전화번호'), 'companyTel');
  assert.equal(P.fixKeyOfLabel('혁신형 기업여부'), 'pair:혁신형 기업여부',
    '★★ 이름이 없는 칸은 pair: 자리로 — 기업 상세에 없는 칸을 만들면 안 됩니다');
});

test('★★★ 고친 값이 표에 «바로» 보인다 — 안 보이면 고쳐졌는지 알 수 없다', () => {
  const rows = P.readRows(신청서({ ceo: '박성탈' }));
  assert.equal(줄값(rows, '대표자명'), '박성탈');
  assert.equal(줄값(rows, '기업명'), '농업회사법인주식회사충서', '★ 안 고친 줄은 그대로여야 합니다');
});

test('★★★ 판독값은 «그대로» 남는다 — 「이 값 어디서 나왔지」에 답해야 한다', () => {
  const r = 신청서({ ceo: '박성탈' });
  assert.equal(P.readRawOf(r, 'ceo', '대표자명'), '박성달',
    '★★★ 덮어쓰면 판독이 무엇을 틀렸는지 영영 알 수 없습니다');
  assert.equal(r.fields.ceo, '박성달', '★★★ 판독값 자체를 고치면 안 됩니다');
});

test('★★★ 「비우기」가 된다 — 헛것을 읽은 칸을 지우는 유일한 길이다', () => {
  const r = 신청서({ homepage: '' }, { homepage: true });
  const rows = P.readRows(r);
  assert.equal(줄값(rows, '홈페이지'), undefined,
    '★★★ 홈페이지에 사업자번호가 흘러들었는데 지울 길이 없으면 그대로 기업 상세로 갑니다');
  assert.equal(P.readFields(r).homepage, undefined, '★★★ 기업 상세로도 안 가야 합니다');
});

test('★★ 빈 글자만으로는 «안» 지운다 — 「아직 안 고침」과 구별이 안 된다', () => {
  const r = 신청서({ homepage: '' });          /* fixClear 가 없다 */
  assert.equal(줄값(P.readRows(r), '홈페이지'), '587-86-01913-0');
  assert.equal(P.readFields(r).homepage, '587-86-01913-0');
});

test('★★★ 고친 값이 기업 상세로 «간다» — 이름 붙은 칸으로 옮겨져야 한다', () => {
  const f = P.readFields(신청서({ ceo: '박성탈', companyTel: '041-000-0000' }));
  assert.equal(f.ceo, '박성탈');
  assert.equal(f.companyTel, '041-000-0000');
});

test('★★★ at·by 와 이름표뿐인 칸은 기업 상세로 «안» 간다', () => {
  const f = P.readFields(신청서({ at: 123, by: '권형하', 'pair:혁신형 기업여부': '해당있음' }));
  assert.equal(f.at, undefined, '★★★ 기업 상세에 at 이라는 칸이 생깁니다');
  assert.equal(f.by, undefined);
  assert.equal(f['pair:혁신형 기업여부'], undefined);
});

test('★ 이름표뿐인 칸도 «표에서는» 고쳐진다 — 고칠 수 있다고 해 놓고 안 되면 안 된다', () => {
  const rows = P.readRows(신청서({ 'pair:혁신형 기업여부': '해당있음' }));
  assert.equal(줄값(rows, '혁신형 기업여부'), '해당있음');
});

test('★ 줄마다 «담는 열쇠»를 함께 준다 — 없으면 어디에 담을지 모른다', () => {
  const rows = P.readRows(신청서());
  const 홈 = rows.filter(r => r[0] === '홈페이지')[0];
  assert.equal(홈[2], 'homepage');
});

test('★ 이름 붙은 칸만 있는 옛 판독물도 고칠 수 있다 (pairs 가 없던 때)', () => {
  const r = { kind: 'bizreg', fields: { company: '가나상사', ceo: '홍길동' }, fix: { ceo: '홍길순' } };
  const rows = P.readRows(r);
  assert.equal(줄값(rows, '대표자'), '홍길순');
  assert.equal(P.readFields(r).ceo, '홍길순');
});

/* ══════ ② 화면 — ✎ 가 실제로 붙는가 ═══════════════════════════════ */

const 사진첩몸통 = stripComments(PHOTOS);

test('★★★ 줄마다 ✎ 가 붙는다 — 없으면 고칠 길이 화면에 없다', () => {
  assert.match(사진첩몸통, /onclick="askRowFix\(/,
    '★★★ 고치는 셈을 만들어 놓고 누를 자리가 없으면 아무것도 안 바뀝니다');
  assert.match(사진첩몸통, /class="fxpen"/);
});

test('★★ 남의 사진은 «보기만» — 지우기·고치기와 같은 원칙이다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function renderReadPanel(') || '');
  assert.match(fn, /!viewingOther\(\)[^;]*&&[^;]*!read\.error/,
    '★★ 남의 사진에 ✎ 를 내주면 눌러도 안 담깁니다');
});

test('★★★ 다시 판독하지 «않는다» — 고치는 데 요금이 들면 안 된다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function saveRowFix(') || '');
  assert.ok(fn, 'saveRowFix 가 없습니다');
  assert.ok(!/readPhoto\(|startRead\(|PuDocRead\.read\(/.test(fn),
    '★★★ 한 칸 고치는데 전체 판독이 돌면 이 기능을 만든 뜻이 통째로 없어집니다');
  assert.match(fn, /PuPhotoStore\.saveRead\(/, '고친 값을 담지 않습니다');
});

test('★★★ 고치면 기업 상세로 «저절로» 간다 — 다만 «이미 보낸» 서류만', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function syncFixToCoInfo(') || '');
  assert.ok(fn, 'syncFixToCoInfo 가 없습니다');
  assert.match(fn, /read\.filedInfo[\s\S]{0,40}return Promise\.resolve\(\)/,
    '★★★ 아직 안 보낸 서류를 여기서 몰래 보내면 안 됩니다 — 보내기는 사람이 누르는 일입니다');
  assert.match(fn, /PuDocFile\.sendToCoInfo\(/);
  assert.match(fn, /readFields\(read\)/, '★★ 고친 값이 아니라 판독값을 보내면 아무것도 안 바뀝니다');
});

test('★★ 「취소」는 아무 일도 아니다 · 같은 값이면 한 글자도 안 쓴다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function askRowFix(') || '');
  assert.match(fn, /if \(v === null\) return;/);
  assert.match(fn, /새값 === String\(지금\)\.trim\(\)/);
});

/* ══════ ③ 신청서로 계약 등록 ═══════════════════════════════════════ */

test('★★★ 사진첩이 data/contracts 에 «직접 쓰지 않는다»', () => {
  assert.ok(!/data\/contracts/.test(사진첩몸통),
    '★★★ 계약을 여기서 만들면 업체 연결 검증·중복 검사·월 잠금을 통째로 건너뜁니다.\n' +
    '  계약은 계약관리의 저장 길이 만듭니다 — 여기서는 창을 채워 열 뿐입니다.');
  const fn = stripJs(cutFn(PHOTOS, 'function makeContractFromDoc(') || '');
  assert.ok(fn, 'makeContractFromDoc 이 없습니다');
  assert.match(fn, /sessionStorage\.setItem\('pu_new_contract'/,
    '★★ 넘기는 것은 쪽지 한 장입니다 — 주소에 실으면 주소창·기록에 회사 정보가 남습니다');
});

test('★★★ 금액·기간을 «지어내지 않는다» — 신청서에 안 적혀 있다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function makeContractFromDoc(') || '');
  assert.ok(!/contractAmount|amounts|startDate|endDate|signDate/.test(fn),
    '★★★ 신청서에 없는 금액·기간을 채우면 계약관리의 숫자가 거짓이 됩니다');
});

test('★★ 종목은 bizCategory 다 — 업태(bizType)와 바꿔 넣으면 157건과 어긋난다', () => {
  const m = 사진첩몸통.match(/const CONTRACT_CO_MAP = \[[\s\S]*?\];/);
  assert.ok(m, 'CONTRACT_CO_MAP 이 없습니다');
  assert.match(m[0], /\['bizType', 'bizType'\]/);
  assert.match(m[0], /\['bizItem', 'bizCategory'\]/);
  assert.ok(!/workers/.test(m[0]),
    '★★ 상시근로자수는 계약의 «고용보험 피보험자수»와 다른 숫자입니다 — 넣으면 조용히 틀립니다');
});

test('★★ 회사 이름조차 없으면 단추를 «안» 낸다 — 눌러도 채울 것이 없다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function canMakeContract(') || '');
  assert.ok(fn, 'canMakeContract 가 없습니다');
  assert.match(fn, /f\.company/);
  assert.match(fn, /viewingOther\(\)/, '★ 남의 사진에서 내 계약을 만들면 안 됩니다');
});

test('★ 어느 사진에서 왔는지 남긴다 — 「이 값 어디서 나왔지」에 답해야 한다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function makeContractFromDoc(') || '');
  assert.match(fn, /srcPhoto/);
});

/* ══════ ④ 계약관리 쪽 — 받아서 «채운 채로» 연다 ═══════════════════ */

const 이알피 = stripComments(ERP);

test('★★★ 계약관리가 신청서 캡처(form)도 찾는다 — 계약서만 찾으면 한 장도 안 뜬다', () => {
  const fn = stripJs(cutFn(ERP, 'function erpLoadMyContractPhotos(') || '');
  assert.match(fn, /erpScanPhotos\(\{ contract:1, form:1 \}/,
    '★★★ 기술보호지원반·현장클리닉 신청서는 갈래가 form 입니다');
});

test('★★★ 회사 칸을 «열 칸» 채운다 — 셋만 채우면 나머지를 손으로 친다', () => {
  const fn = stripJs(cutFn(ERP, 'function erpContractPhotoApplyPatch(') || '');
  [['company', 'name'], ['bizno', 'bizNo'], ['corpno', 'corpRegNo'],
   ['companyTel', 'phone'], ['bizType', 'bizType'], ['bizItem', 'bizCategory']]
    .forEach(function (p) {
      assert.ok(fn.indexOf("['" + p[0] + "','" + p[1] + "'") >= 0,
        '★★ ' + p[0] + ' → ' + p[1] + ' 가 빠졌습니다');
    });
  assert.ok(!/\['workers'/.test(fn),
    '★★ 상시근로자수는 고용보험 피보험자수와 다른 숫자입니다');
});

test('★★★ 채운 것을 «말한다» — 예전에는 열 칸을 채워 놓고 「가져올 값이 없습니다」가 떴다', () => {
  const fn = stripJs(cutFn(ERP, 'function erpContractPhotoApplyPatch(') || '');
  assert.match(fn, /lines\.push\('회사 '/,
    '★★★ 금액·기간이 없는 신청서에서는 이 줄이 없으면 미리보기가 텅 빕니다');
});

test('★★ 빈 칸만 채운다 — 사람이 적어 둔 것을 덮지 않는다', () => {
  const fn = stripJs(cutFn(ERP, 'function erpContractPhotoApplyPatch(') || '');
  assert.match(fn, /if\(!nextCompany\[dest\] && fields\[src\]\)/);
});

test('★★★ 쪽지를 «한 번 쓰고 지운다» — 안 지우면 열 때마다 등록 창이 뜬다', () => {
  assert.match(이알피, /sessionStorage\.removeItem\('pu_new_contract'\)/,
    '★★★ 지우지 않으면 계약관리를 열 때마다 새 계약 창이 다시 뜹니다');
  assert.match(이알피, /Date\.now\(\) - seed\.at > 10 \* 60 \* 1000/,
    '★★ 어제 눌러 둔 쪽지가 오늘 뜨면 무슨 일인지 알 수 없습니다');
});

test('★★★ 씨앗은 «빈 칸에만» 얹고, 고치는 계약에는 손대지 않는다', () => {
  const fn = stripJs(cutFn(ERP, 'function ContractModal(') || '');
  assert.match(fn, /if\(!props\.cur && props\.seed && props\.seed\.company\)/,
    '★★★ 고치는 중인 계약에 씨앗을 얹으면 사람이 적어 둔 값이 바뀝니다');
  assert.match(fn, /!init\.company\[k\]\) init\.company\[k\] = v/);
});

test('★★ 씨앗을 props.cur 로 넘기지 않는다 — 임시저장 열쇠가 undefined 가 된다', () => {
  assert.match(이알피, /function openAdd\(seed\)\{ setModal\(\{ mode:'add', cur:null, seed:seed \|\| null \}\); \}/,
    '★★ cur 는 「고치는 계약」이라는 뜻입니다 — 씨앗을 거기 넣으면 동시편집 가드가 헛돕니다');
  assert.match(이알피, /h\(ContractModal, \{ cur:modal\.cur, seed:modal\.seed/);
});

/* ══════ ⑤ 판독 층 — 사전은 한 벌이다 ═══════════════════════════════ */

test('★★★ 이름표 사전을 두 벌로 만들지 않는다', () => {
  assert.match(stripComments(READ), /pairFieldKey: pairFieldKey/,
    '★★★ 사진첩이 이 사전을 부릅니다 — 안 내주면 사진첩이 제 사전을 만들게 됩니다');
  const 몸통 = stripComments(PHOTOS);
  assert.ok(!/기업명: 'company'|사업자등록번호: 'bizno'/.test(몸통),
    '★★★ 사진첩에 이름표 사전이 베껴졌습니다 — 55가지라 어긋나도 한참 모릅니다');
});
