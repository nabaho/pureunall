'use strict';
/* 서류 이름으로 «컨설팅 유형»을 미리 고른다 (대표 지시 2026-09-18 「유형까지 미리 고르는 것도 해라」)
   실행: node --test tests/contract-type-guess.test.js

   ■ 왜 조심스러운가
   유형 코드는 뜻 없는 번호다(consulting-mp0wogrl). 짐작해서 찍으면 엉뚱한 사업으로 굳고,
   금액 칸까지 그 갈래에 딸려 붙는다. 그래서 **틀리게 고르는 것이 안 고르는 것보다 나쁘다.**

   ■ ★★ 이 검사의 급소 — «실제 이름»으로 전수 확인한다
   아래 유형 17가지와 서류 이름 14가지는 2026-09-18 에 운영 자료에서 그대로 뜬 것이다
   (data/biz_cons_types · pucards/coInfo 의 docs). 지어낸 이름으로 검사하면
   「우리가 만든 잣대가 우리가 만든 예를 맞힌다」밖에 안 된다.
   ⚠ 이 목록은 «지금 값»이 아니라 **이 잣대가 실제로 부딪히는 현실**이다.
     유형이 늘면 여기 함께 늘리고, 그때도 「틀리게 고름 0」인지 다시 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments, stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8');

/* 셈을 «그대로» 떠서 돌린다 — 컴포넌트 밖에 둔 까닭이 이것이다 */
const ctx = { String, Math, Object, Array };
vm.createContext(ctx);
['function erpTypeNameTidy(', 'function erpNameRun(', 'function erpConsTypeByDocName(']
  .forEach(function (n) {
    const src = cutFn(ERP, n);
    assert.ok(src, n + ' 를 못 찾았습니다');
    vm.runInContext(src, ctx);
  });

/* ── 2026-09-18 운영 자료: 컨설팅 유형 17가지 (data/biz_cons_types) ── */
const 유형 = [
  ['consulting-mp0w1084', '현장클리닉'],
  ['consulting-mozfisq7', '일터상생혁신컨설팅'],
  ['consulting-mp0wogrl', '통합기술보호지원단'],
  ['consulting-mp0w4m65', '산업일자리전환컨설팅충남'],
  ['consulting-mp0w7e0o', '산업일자리전환컨설팅능률'],
  ['consulting-mp0wphau', '일터혁신상생컨설팅'],
  ['consulting-mp1wueqm', '기초컨설팅푸른법인'],
  ['consulting-mp13gjt7', '인사노무컨설팅충남북부상의'],
  ['consulting-mp0w1rbm', '인사노무컨설팅서산'],
  ['consulting-mpf6wvvjgdq', '사회적기업컨설팅'],
  ['consulting-mp89a474', '사내,공동근로복지기금설립컨설팅'],
  ['consulting-mp3phoq3', '임단협노사교섭위원참석'],
  ['consulting-mp3ph465', '산업안전컨설팅'],
  ['consulting-mp89bai4', '혁신바우처컨설팅'],
  ['consulting-mp0zokdi', '출산육아휴직우수기업컨설팅'],
  ['consulting-ms86w3qs1zk', '삼성협력업체컨설팅'],
  ['consulting-msfevquzzpo', '통상변화대응기술경영혁신지원컨설팅']
].map(function (p) { return { code: p[0], name: p[1] }; });

const 고른다 = (docName) => ctx.erpConsTypeByDocName(docName, 유형);

/* ── 2026-09-18 운영 자료: 기업 상세에 실제로 들어온 서류 이름 14가지 ──
   두 번째 칸이 «사람이 본 정답»이다. 빈 글자면 「유형이 없는 서류」다. */
const 서류 = [
  ['통합 기술보호지원반 신청서', '통합기술보호지원단'],
  ['현장클리닉 상담신청 및 현황', '현장클리닉'],
  ['기술·경영 혁신 지원신청서', '통상변화대응기술경영혁신지원컨설팅'],
  ['사업자등록증', ''],
  ['사업자등록증명', ''],
  ['사업자등록증명원', ''],
  ['고유번호증', ''],
  ['중소기업확인서', ''],
  ['서식', ''],
  ['신청기업 정보', ''],
  ['업태 종목 내역', ''],
  ['컨설턴트 컨설팅신청 상세', ''],
  /* ⚠ 이 둘은 «일부러 안 고른다» — 아래 따로 본다 */
  ['2026년 충남북부상공회의소 인사노무 컨설팅 신청서', null],
  ['2021년 충남북부상공회의소 인사노무 컨설팅 신청서', null]
];

/* ══════ ① ★★★ 틀리게 고르는 것이 하나도 없어야 한다 ═══════════════ */

test('★★★ 서류 이름 14가지 전수 — «틀리게 고른 것»이 하나도 없다', () => {
  const 틀림 = [];
  서류.forEach(function (p) {
    const 답 = p[1];
    if (답 === null) return;                 /* 애매한 것은 아래에서 따로 */
    const got = 고른다(p[0]);
    const 이름 = got ? got.name : '';
    if (이름 !== 답) 틀림.push(p[0] + ' → 「' + 이름 + '」 (답: 「' + 답 + '」)');
  });
  assert.deepEqual(Array.from(틀림), [],
    '★★★ 유형을 틀리게 골라 두면 엉뚱한 사업으로 굳고 금액 칸도 그 갈래에 딸려 붙습니다.\n' +
    '  틀리게 고르는 것은 «안 고르는 것»보다 나쁩니다.');
});

test('★★★ 신청서 셋은 실제로 맞힌다 — 안 맞히면 이 기능을 만든 뜻이 없다', () => {
  assert.equal((고른다('통합 기술보호지원반 신청서') || {}).name, '통합기술보호지원단',
    '★★★ 「지원반」과 「지원단」이 한 글자 다릅니다 — 글자 그대로 맞추면 못 찾습니다');
  assert.equal((고른다('현장클리닉 상담신청 및 현황') || {}).name, '현장클리닉');
  assert.equal((고른다('기술·경영 혁신 지원신청서') || {}).name, '통상변화대응기술경영혁신지원컨설팅',
    '★★ 이름이 길어 겹침 비율이 낮습니다 — «짧은 쪽»을 기준으로 재야 걸립니다');
});

test('★★★ 등록증·확인서처럼 «유형이 없는» 서류는 안 고른다', () => {
  ['사업자등록증', '사업자등록증명', '사업자등록증명원', '고유번호증',
   '중소기업확인서', '서식', '신청기업 정보', '업태 종목 내역'].forEach(function (n) {
    assert.equal(고른다(n), null,
      '★★★ 「' + n + '」 에 유형이 붙었습니다 — 이 서류는 컨설팅 사업이 아닙니다');
  });
});

test('★★★ 이름이 비슷한 유형이 «둘»이면 안 고른다 — 찍으면 절반은 틀린다', () => {
  /* 「인사노무컨설팅충남북부상의」와 「인사노무컨설팅서산」이 똑같이 걸린다.
     맞는 것은 앞것이지만 기계가 가릴 근거가 없다 — 사람이 고르는 것이 맞다. */
  assert.equal(고른다('2026년 충남북부상공회의소 인사노무 컨설팅 신청서'), null,
    '★★★ 둘 다 맞는데 하나를 찍으면 절반은 틀립니다');
  assert.equal(고른다('2021년 충남북부상공회의소 인사노무 컨설팅 신청서'), null);
});

test('★★ 「컨설팅」 한 낱말만 겹치는 것에 안 걸린다 — 유형 이름이 죄다 컨설팅이다', () => {
  assert.equal(고른다('컨설턴트 컨설팅신청 상세'), null,
    '★★ 세 글자만 겹쳐도 고르면 아무 신청서나 첫 유형에 붙습니다');
});

/* ══════ ② 잣대 자체 ═══════════════════════════════════════════════ */

test('★★ 해 머리·괄호·가운뎃점을 떼고 본다 — 표기가 서류마다 다르다', () => {
  assert.equal(ctx.erpTypeNameTidy('2026년 통합 기술보호지원반 신청서'), '통합기술보호지원반');
  assert.equal(ctx.erpTypeNameTidy('기술·경영 혁신 지원신청서'), '기술경영혁신지원');
  /* 「상담신청 및 현황」 이 통째로 꼬리로 떨어진다 — 남는 것이 알맹이다 */
  assert.equal(ctx.erpTypeNameTidy('현장클리닉 상담신청 및 현황'), '현장클리닉상담');
});

test('★★ «이어진» 토막으로 잰다 — 글자 낱개를 세면 엉뚱한 것이 걸린다', () => {
  assert.equal(ctx.erpNameRun('사업자등록증', '산업일자리전환컨설팅충남'), 1,
    '★★ 「사업자등록증」과 「산업일자리…」는 낱개로는 여럿 겹치지만 이어진 토막은 한 글자입니다');
  assert.equal(ctx.erpNameRun('통합기술보호지원반', '통합기술보호지원단'), 8);
});

test('★ 이름이 너무 짧으면 아예 안 본다 — 「서식」 두 글자로는 가릴 수 없다', () => {
  assert.equal(고른다('서식'), null);
  assert.equal(고른다(''), null);
  assert.equal(고른다(null), null);
});

test('★ 유형 목록이 없으면 «안 고른다» — 짐작하지 않는다', () => {
  assert.equal(ctx.erpConsTypeByDocName('통합 기술보호지원반 신청서', []), null);
  assert.equal(ctx.erpConsTypeByDocName('통합 기술보호지원반 신청서', null), null);
});

test('★★ 줄임말로는 안 맞춘다 — 「기초컨설팅푸른법인」의 줄임이 「인사노무」다', () => {
  const 줄임있는 = 유형.map(function (t) {
    return Object.assign({}, t, { short: t.name === '기초컨설팅푸른법인' ? '인사노무' : '줄임' });
  });
  assert.equal(ctx.erpConsTypeByDocName('2026년 충남북부상공회의소 인사노무 컨설팅 신청서', 줄임있는), null,
    '★★ 줄임까지 보면 인사노무 신청서가 엉뚱한 유형에도 걸립니다');
});

/* ══════ ③ 화면에 실제로 붙었는가 ═══════════════════════════════════ */

const 몸통 = stripComments(ERP);

test('★★★ 셈이 컴포넌트 «밖»에 있다 — 안에 두면 검사를 붙일 수가 없다', () => {
  assert.match(몸통, /^function erpConsTypeByDocName\(/m,
    '★★★ 화면 안으로 들어가면 이 검사가 통째로 못 돕니다');
});

test('★★★ 유형 목록을 «받는다» — 안에서 저장소를 부르면 순수 함수가 아니다', () => {
  assert.match(몸통, /function erpContractPhotoApplyPatch\(fields, kindV, f, consTypes\)/,
    '★★★ 안에서 dbGet 을 부르면 이 셈을 떠서 돌리는 검사가 통째로 못 돕니다');
  const fn = stripJs(cutFn(ERP, 'function erpContractPhotoApplyPatch(') || '');
  assert.ok(!/dbGet\(/.test(fn), '★★★ 순수 함수 안에서 저장소를 부르고 있습니다');
  assert.match(몸통, /erpContractPhotoApplyPatch\(it\.fields, kindV, f, dbGet\('biz_cons_types'/,
    '★★ 부르는 쪽이 목록을 안 넘기면 유형을 영영 못 고릅니다');
});

test('★★ 사람이 골라 둔 유형을 «덮지 않는다»', () => {
  const fn = stripJs(cutFn(ERP, 'function erpContractPhotoApplyPatch(') || '');
  assert.match(fn, /kindV === 'consulting' && !\(\(f\.typeCodes \|\| \{\}\)\.consulting\)/,
    '★★ 고른 유형을 덮으면 고른 뜻이 없어집니다');
});

test('★★★ 갈래는 «유형이 함께 왔을 때만» 얹는다 — 근거 없이 찍지 않는다', () => {
  const fn = stripJs(cutFn(ERP, 'function ContractModal(') || '');
  assert.match(fn, /if\(props\.seed\.typeCodes && props\.seed\.typeCodes\.consulting\)\{\s*init\.kinds = \['consulting'\];/,
    '★★★ 유형 없이 갈래만 찍으면 엉뚱한 사업으로 굳고 금액 칸도 딸려 붙습니다');
});

test('★★★ 고른 유형을 «창에 넘긴다» — 골라 놓고 안 넘기면 아무것도 안 바뀐다', () => {
  /* ⚠ 되돌림 검사에서 실제로 못 잡았던 자리다(2026-09-18). 알림만 보고 있었는데,
     알림은 ty 를 보고 뜨므로 «넘기는 줄»을 지워도 그대로 떴다 — 화면은 안 바뀌는데
     「골라 뒀습니다」라고 말하는, 가장 나쁜 꼴이다. */
  const fn = 몸통;
  assert.match(fn, /if\(ty && ty\.code\) seed\.typeCodes = \{ consulting: ty\.code \};/,
    '★★★ 고른 유형을 씨앗에 안 얹으면 창은 옛날 그대로 뜹니다');
  assert.match(fn, /seed\.typeCodes = \{ consulting: ty\.code \};[\s\S]{0,80}openAdd\(seed\);/,
    '★★★ 창을 «연 뒤»에 얹으면 이미 그려진 창은 그것을 못 봅니다');
});

test('★★★ 무엇으로 골랐는지 «말한다» — 말없이 골라 두면 손수 고른 줄 안다', () => {
  assert.match(몸통, /으로 유형을 「[\s\S]{0,40}으로 골라 뒀습니다/,
    '★★★ 알리지 않으면 대표님이 그 유형을 손수 고르신 줄 알고 지나치십니다');
  assert.match(몸통, /유형·기간·금액을 골라 주세요/,
    '★★ 못 골랐을 때도 «무엇이 남았는지» 말해야 합니다');
});

test('★ 「계약서 찾기」 쪽도 유형을 미리보기에 적는다', () => {
  const fn = stripJs(cutFn(ERP, 'function erpContractPhotoApplyPatch(') || '');
  assert.match(fn, /lines\.push\('유형 '/,
    '★ 말없이 유형을 바꿔 놓으면 바뀐 줄도 모르고 저장됩니다');
});
