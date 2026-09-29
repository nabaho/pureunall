'use strict';
/* 저장 이름 = «해 + 올린 신청서 이름 + 날짜» (대표 지시 2026-09-28)
   ─────────────────────────────────────────────────────────────
   「문서 저장시에 업로드했던 지원신청서의 이름을 가지고 와서 0000년 00000 신청서 0000. 00. —
    날짜 등으로 저장해라」
   ■ 무엇이 문제였나 — 한글 편집기 「저장」 창에 «양식» 두 글자만 떴다.
     편집기는 우리가 열 때 넘긴 이름(loadFile 의 두 번째 값)을 저장 이름으로 쓴다.
   ⚠ 앱의 진짜 rhSaveName 을 vm 에 올려 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}
const 줄 = SRC.match(/var RH_PLAIN_NAME=[^\n]*\n/);
const ctx = { Date, String, Math };
vm.createContext(ctx);
vm.runInContext((줄 ? 줄[0] : '') + 떼기('function rhSaveName(') + '\n' + 떼기('function rhUploadName(') + '\n' + 떼기('function rhOrgFrom(')
  + '\n' + SRC.match(/var RH_DOC_WORD=[^\n]*\n/)[0] + SRC.match(/var RH_DOC_SIDE=[^\n]*\n/)[0] + 떼기('function rhPickTitle('), ctx);
const 날 = new Date(2026, 8, 28);          /* 2026-09-28 */
const 이름 = (a, b) => { ctx.__a = [a, b, 날]; return vm.runInContext('rhSaveName(__a[0],__a[1],__a[2])', ctx); };

test('★★★ 올린 신청서 이름으로 «해 + 이름 + 날짜»가 된다', () => {
  assert.equal(이름('[한국기계연구원] 위원 신청서.hwp', ''), '2026년 [한국기계연구원] 위원 신청서 2026. 09. 28.hwpx');
});

test('★★ 「양식」처럼 뭉뚱그린 이름이면 서류에서 찾은 제목을 쓴다 — 대표 화면에 「양식」만 떴다', () => {
  assert.equal(이름('양식.hwpx', '위원 위촉 신청서'), '2026년 위원 위촉 신청서 2026. 09. 28.hwpx');
  assert.equal(이름('', '위원 위촉 신청서'), '2026년 위원 위촉 신청서 2026. 09. 28.hwpx');
  assert.equal(이름('양식', ''), '2026년 양식 2026. 09. 28.hwpx', '제목도 없으면 이름이라도 남긴다');
  /* ⚠ 2026-09-29 대표 승인으로 바뀌었다 — «실제로 남은 서류의 제목»이 올린 이름보다 먼저다.
     올린 이름이 「…공고문」이면 공고문을 뺀 신청서에도 「공고문」이 붙었다. */
  assert.equal(이름('모집 공고문.hwp', '위원 신청서'), '2026년 위원 신청서 2026. 09. 28.hwpx', '★ 남은 서류 제목이 먼저여야 합니다');
});

test('★★★ 다시 올려 저장해도 해·날짜가 «쌓이지» 않는다', () => {
  const 한번 = 이름('위원 신청서.hwp', '');
  assert.equal(이름(한번, ''), 한번, '★★★ 해나 날짜가 두 번 붙었습니다: ' + 이름(한번, ''));
  assert.equal(이름('위원 신청서_채움_날인.hwpx', ''), '2026년 위원 신청서 2026. 09. 28.hwpx', '꼬리를 안 걷습니다');
  assert.equal(이름('위원 신청서_작성.hwpx', ''), '2026년 위원 신청서 2026. 09. 28.hwpx');
});

test('★ 이름 앞에 해가 있으면 «그 해»를 쓴다 — 그 서류의 해다', () => {
  assert.equal(이름('2025 서산시 노동인권 강사 신청서.hwp', ''), '2025년 서산시 노동인권 강사 신청서 2026. 09. 28.hwpx');
  assert.equal(이름('2027년 위원 신청서.hwpx', ''), '2027년 위원 신청서 2026. 09. 28.hwpx');
});

test('★ 파일 이름에 못 쓰는 글자는 걸러 낸다', () => {
  const n = 이름('위원/신청서: 1차?.hwp', '');
  assert.ok(!/[\\/:*?"<>|]/.test(n.replace(/\.hwpx$/, '')), '못 쓰는 글자가 남았습니다: ' + n);
});

test('★★ 올린 이름은 «처음 올린 것»이 먼저다 — 한글에서 고쳐 온 파일 이름이 아니다', () => {
  ctx._rhOrig = { name: '처음 신청서.hwp' }; ctx._rhBase = { name: '고쳐 온 것.hwpx' }; ctx._rhDoc = { name: 'x.hwpx' };
  assert.equal(vm.runInContext('rhUploadName()', ctx), '처음 신청서.hwp');
  ctx._rhOrig = null;
  assert.equal(vm.runInContext('rhUploadName()', ctx), '고쳐 온 것.hwpx');
  ctx._rhBase = null;
  assert.equal(vm.runInContext('rhUploadName()', ctx), 'x.hwpx');
});

test('★★★ 세 저장 길이 모두 이 이름을 쓴다 — 편집기 저장창 · 내보내기 · 보관함 완성본', () => {
  assert.match(떼기('async function rhHwpEdOpen('), /새이름=await rhNiceName\(\)[\s\S]*_hwpEdCreate\(box, bytes, 새이름\)/,
    '★★★ 편집기에 옛 이름을 넘깁니다 — 저장 창에 「양식」이 뜹니다');
  assert.match(떼기('async function rhHwpOut('), /name=await rhNiceName\(\)/, '★★ 내보내기 이름이 다릅니다');
  assert.match(떼기('async function confirmResumeSave('), /genName=await rhNiceName\(\)/, '★ 보관함 완성본 이름이 다릅니다');
  assert.match(떼기('function hwpViewDownload('), /rhNiceName\(\)/, '★ 큰 창 「⬇ 파일로 저장」도 같은 이름이어야 합니다');
  assert.match(떼기('function rhDraftSave('), /rhDraftTitleLater\(_rhDraftId\)/, '★ 작성 중 목록에도 보일 이름을 담아야 합니다');
  assert.match(SRC, /escapeHtml\(d\.title\|\|d\.name\|\|'\(이름 없음\)'\)/, '★ 목록은 보일 이름을 먼저 보여야 합니다');
});

/* ══ 2026-09-29 대표 승인: «해년 기관 서류제목_이름 날짜» ══ */
const 이름더 = (a, b, 더) => { ctx.__a = [a, b, 날, 더]; return vm.runInContext('rhSaveName(__a[0],__a[1],__a[2],__a[3])', ctx); };

test('★★★ 기관·이름이 붙는다 — 「2027년 천안어린이꿈누리터 … 신청서_권형하 2026. 09. 28.」', () => {
  assert.equal(이름더('2027 천안어린이꿈누리터 제안서 평가위원 모집 공고문.hwp', '제안서 평가위원 후보자 등록 신청서',
    { 기관: '천안어린이꿈누리터', 사람: '권형하' }),
    '2027년 천안어린이꿈누리터 제안서 평가위원 후보자 등록 신청서_권형하 2026. 09. 28.hwpx');
});

test('★★ 제목에 기관이 이미 있으면 두 번 안 붙인다 · 다시 저장해도 이름이 쌓이지 않는다', () => {
  assert.equal(이름더('', '한국기계연구원 고문 노무사 신청서', { 기관: '한국기계연구원', 사람: '권형하' }),
    '2026년 한국기계연구원 고문 노무사 신청서_권형하 2026. 09. 28.hwpx');
  const 더 = { 기관: '서산시', 사람: '권형하' };
  const 한번 = 이름더('양식.hwpx', '위원 신청서', 더);
  assert.equal(이름더(한번, '', 더), 한번, '★★★ 다시 저장하면 쌓입니다: ' + 이름더(한번, '', 더));
});

test('★ 기관·이름을 모르면 옛 모양 그대로', () => {
  assert.equal(이름더('위원 신청서.hwp', '', {}), '2026년 위원 신청서 2026. 09. 28.hwpx');
});

test('★★ 「○○장 귀하」에서 기관을 뽑는다 — «장» 한 글자인지 두 글자인지는 다른 글로 가린다', () => {
  const 뽑 = (t, h) => { ctx.__b = [t, h]; return vm.runInContext('rhOrgFrom(__b[0],__b[1])', ctx); };
  assert.equal(뽑('2026년 한국기계연구원 고문 노무사 모집 … 한국기계연구원장 귀하', ''), '한국기계연구원');
  assert.equal(뽑('신청서 … 천안어린이꿈누리터관장 귀하', '2027 천안어린이꿈누리터 제안서 평가위원 모집 공고문'), '천안어린이꿈누리터');
  assert.equal(뽑('… 천안어린이꿈누리터관장 귀하', ''), '천안어린이꿈누리터관', '다른 단서가 없으면 «장»만 뗀다');
  assert.equal(뽑('귀하라는 말이 없는 서류', ''), '');
  assert.equal(뽑('홍길동 귀하', ''), '', '«장»으로 안 끝나면 기관이 아니다');
});

test('★★ 서류 제목 — 본 서류(신청서·지원서…)가 먼저 · 표 안의 「…」 신청서도 찾는다 · 동의서는 마지막', () => {
  const 고름 = (ts, t) => { ctx.__c = [ts, t]; return vm.runInContext('rhPickTitle(__c[0],__c[1])', ctx); };
  assert.equal(고름(['1-1. 일반현황', '개인정보 수집·이용 동의서'], '(신청인이 기재하지 않음)「2026년 한국기계연구원 고문 노무사 모집」 신청서 신청기관'),
    '2026년 한국기계연구원 고문 노무사 모집 신청서', '★★ 실측: 첫 쪽 제목이 표 안이라 「1-1. 일반현황」·「동의서」를 집었다');
  assert.equal(고름(['제안서 평가위원 후보자 등록 신청서', '서약서'], ''), '제안서 평가위원 후보자 등록 신청서');
  assert.equal(고름(['개인정보 수집·이용 동의서', '안내'], '아무 글'), '개인정보 수집·이용 동의서', '본 서류가 없으면 붙임 서류라도');
  assert.equal(고름([], ''), '');
});
