'use strict';
/* 계약창 — 네 칸 · 칸 차례 · 탭 셋 (대표 지시 2026-09-18)

   「4칸으로 한다 단 순서를 다시 정리해라 사업자 번호등 어떻게 정리하는게
    기업정보함과 일치시켜서 쉽게 정리되고 안복잡하게」
   「계약정보 담당자 정보도 4칸 목업하고 담당자정보와 일지 합해라.
    그리고 계약정보도 4칸정리 … 순서로 문제가 없는지 정렬다시해라」
   「부담당이 2명 3명4명 될수 있으므로 셀로 사람 선택하게 해라」
   「법인등록번호는 넣어라」

   ★ 이 검사가 못 박는 것은 «규칙»이지 «지금 값»이 아니다:
     ① 칸 차례가 기업정보함(pu-cards.html 의 CO_FIELDS)의 «덩어리 차례»를 따른다
     ② 긴 값(회사명·주소)은 한 줄을 통째로 쓴다 — 좁은 칸에 우겨넣지 않는다
     ③ 부담당은 «사람마다 칸 하나»다 — 한 칸에 몰아 쌓지 않는다
     ④ 탭은 셋이고, 없어진 탭 이름으로 들어와도 저장 단추가 나온다
   그래서 px·글자 수·칸 «개수»는 재지 않는다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8');
const CARDS = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
const SRC = stripJs(RAW);

/* 계약창 «함수 한 덩이»만 떼어 본다 — 다른 화면의 같은 낱말에 안 걸리게.
   ⚠ PANES 만 떼면 탭 단추(tabBtn)가 밖에 있어 안 보인다 — 함수째 떼는 까닭이다. */
const MODAL = stripJs(cutFn(RAW, 'function ContractModal(props)'));

/* ══ ① 네 칸 모양이 실제로 있다 ══ */

test('① 네 칸 모양(.pu-g4/.pu-c4)이 css 에 있고, 칸이 «부풀지 않게» 막혀 있다', () => {
  assert.match(CSS, /\.pu-g4 \{[^}]*grid-template-columns:\s*repeat\(4,/,
    '.pu-g4 가 네 칸 그리드가 아니다');
  assert.match(CSS, /\.pu-c4 \{[^}]*min-width:\s*0/,
    '★ .pu-c4 에 min-width:0 이 없다 — 그리드 칸이 안쪽 입력 너비만큼 부풀어 창 밖으로 넘친다');
});

test('②★ 좁은 화면에서는 네 칸을 억지로 유지하지 않는다 (접는 규칙이 있다)', () => {
  const media = CSS.slice(CSS.indexOf('.pu-g4 {'));
  assert.match(media, /@media[^{]*max-width[^{]*\{[\s\S]*?\.pu-g4 \{[^}]*grid-template-columns/,
    '좁은 화면에서 .pu-g4 를 다시 잡아 주는 @media 가 없다 — 노트북 밖 화면에서 칸이 글자보다 좁아진다');
});

test('③ 계약창이 네 칸 만들개(fld4·sec4)를 쓴다', () => {
  assert.ok(/function fld4\(/.test(SRC), 'fld4 만들개가 없다');
  assert.ok(/function sec4\(/.test(SRC), 'sec4 묶음머리 만들개가 없다');
  assert.ok(MODAL.split("className:'pu-g4'").length - 1 >= 2,
    '계약창에 네 칸 그리드가 거의 안 쓰였다');
});

/* ══ ② 긴 값은 한 줄을 통째로 ══ */

test('④★ 긴 값(회사명·주소·본사주소·비고)은 한 줄을 통째로 쓴다', () => {
  /* 왜: 900px 창을 넷으로 나누면 칸 하나가 210px 남짓이다. 「농업회사법인…」 같은
     회사명이나 주소는 그 안에서 잘린다 — 커서를 넣어야 뒷부분이 보인다. */
  /* ⚠ 낱말만 찾으면 안내문(showToast 등)에 걸린다 — «칸을 그리는 자리»를 짚는다. */
  const 긴칸 = [
    ['의뢰인(회사명)', /className:'pu-c4 pu-c4-4'[^]{0,200}의뢰인/],
    ['사업장 주소',     /className:'pu-c4 pu-c4-4'[^]{0,80}'사업장 주소'/],
    ['본사주소',        /className:'pu-c4 pu-c4-4'[^]{0,80}'본사주소/],
    ['특이사항(비고)',  /fld4\('특이사항',[^]{0,220}, 4\)/],
  ];
  for (const [이름, 무늬] of 긴칸) {
    assert.match(MODAL, 무늬,
      '★ «' + 이름 + '» 이 한 줄을 통째로 쓰지 않는다 — 좁은 칸에서 글자가 잘린다');
  }
});

/* ══ ③ 차례가 기업정보함을 따른다 ══ */

test('⑤★ 칸 차례가 기업정보함의 «덩어리 차례»를 따른다 (신원 → 주소 → 연락처 → 업종)', () => {
  /* 기업정보함(pu-cards.html CO_FIELDS)은 사업자번호·대표자·법인등록번호 → 소재지 →
     대표번호·팩스 → … → 업태·종목·기업규모 차례다. 그 «덩어리» 차례를 따른다.
     ⚠ 개별 칸 하나하나의 자리를 재지 않는다 — 그건 「지금 값」이다. */
  const 자리 = s => { const i = MODAL.indexOf(s); assert.ok(i > 0, s + ' 못 찾음'); return i; };
  const 신원 = 자리("fld4('사업자번호'");
  const 주소 = 자리("'사업장 주소'");
  const 연락처 = 자리("fld4('대표 전화'");
  const 업종 = 자리("fld4('업태'");
  assert.ok(신원 < 주소, '사업자번호가 주소보다 뒤에 있다');
  assert.ok(주소 < 연락처, '주소가 연락처보다 뒤에 있다 (기업정보함은 소재지 → 대표번호 차례)');
  assert.ok(연락처 < 업종, '★ 업태가 연락처보다 앞에 있다 — 기업정보함은 업태·종목을 이메일 뒤에 둔다');
});

test('⑥ 기업정보함이 실제로 그 차례로 보여 준다 (견주는 기준이 살아 있는가)', () => {
  /* 기준이 바뀌면 위 ⑤ 도 다시 봐야 한다. 그걸 알려 주는 검사다. */
  const i = CARDS.indexOf('const CO_FIELDS = [');
  const 덩이 = CARDS.slice(i, CARDS.indexOf('];', i));
  const 차례 = k => 덩이.indexOf("'" + k + "'");
  assert.ok(차례('bizno') < 차례('address'), '기업정보함 기준이 바뀌었다 — 사업자번호/소재지');
  assert.ok(차례('address') < 차례('companyTel'), '기업정보함 기준이 바뀌었다 — 소재지/대표번호');
  assert.ok(차례('companyTel') < 차례('bizType'), '기업정보함 기준이 바뀌었다 — 대표번호/업태');
});

test('⑦★ 연락처 넷(전화·팩스·대표자전화·이메일)이 «한 묶음»으로 붙어 있다', () => {
  /* 네 칸이라 한 줄로 끝난다. 이메일만 떼어 놓으면 줄이 하나 더 생긴다. */
  const a = MODAL.indexOf("'대표 전화'");
  const b = MODAL.indexOf("'대표 이메일'");
  assert.ok(a > 0 && b > a, '연락처 칸을 못 찾았다');
  const 사이 = MODAL.slice(a, b);
  assert.ok(!/sec4\(/.test(사이),
    '★ 전화와 이메일 사이에 다른 묶음이 끼었다 — 연락처 넷은 한 줄에 모아야 한다');
});

/* ══ ④ 법인등록번호 ══ */

test('⑧★ 법인등록번호에 «사람이 고칠 칸»이 있다 (값은 들어오는데 자리가 없던 칸)', () => {
  assert.match(MODAL, /fld4\('법인등록번호'/,
    '법인등록번호 입력칸이 없다 — 판독·기업정보함이 corpRegNo 를 채우는데 고칠 자리가 없다');
  assert.match(MODAL, /setCompanyField\('corpRegNo'\)/,
    '법인등록번호 칸이 corpRegNo 에 이어져 있지 않다 — 적어도 저장이 안 된다');
});

test('⑨ 그 칸이 기업정보함·판독과 «같은 이름»을 쓴다 (이어져야 뜻이 있다)', () => {
  assert.match(SRC, /\['corpno',\s*'corpRegNo'\]/,
    '기업정보함 가져오기(COINFO_TO_CONTRACT)가 corpno → corpRegNo 로 잇지 않는다');
});

/* ══ ⑤ 부담당은 사람마다 칸 하나 ══ */

test('⑩★ 부담당은 «사람마다 칸 하나»다 — 한 칸에 몰아 쌓지 않는다', () => {
  assert.match(MODAL, /\(f\.managerSubs\|\|\[\]\)\.map\(function\(sid,\s*i\)/,
    '★ 부담당을 사람마다 그리지 않는다 — 한 칸에 몰아 쌓던 모양으로 돌아갔다');
  const at = MODAL.indexOf("'부담당 ' + (i+1)");
  assert.ok(at > 0, '자리마다 몇 번째인지(부담당 1·2·3) 알려 주지 않는다');
  const 둘레 = MODAL.slice(at, at + 900);
  assert.match(둘레, /h\('select'/,
    '★ 그 자리에서 «사람을 고를» 수 없다 — 대표 지시는 「셀로 사람 선택하게」였다');
});

test('⑪★ 한 자리만 뺄 수 있고, 뺀 뒤에도 남은 자리 번호가 안 흔들린다', () => {
  const fn = stripJs(cutFn(RAW, 'function setSubAt(i, sid)'));
  assert.match(fn, /subs\.splice\(i,\s*1\)/,
    '★ 그 자리만 빼지 않는다 — 한 사람을 빼려고 전부 지웠다 다시 골라야 한다');
  assert.match(fn, /subs\[i\]\s*=\s*sid/,
    '★ 자리를 지키며 바꾸지 않는다 — 바꾼 사람이 맨 뒤로 가 「부담당 1」이 「부담당 3」이 된다');
  assert.match(fn, /subs\.indexOf\(sid\)\s*>=\s*0/,
    '한 사람이 두 자리에 앉는 것을 막지 않는다');
});

/* ══ ⑥ 탭 셋 ══ */

test('⑫★ 탭은 셋이고 일지가 담당자와 «한 탭»이다', () => {
  /* ⚠ 첫 tabBtn( 은 «만들개 정의»다. 탭 바는 그것을 부르는 자리 — 따옴표가 뒤따른다. */
  const i0 = MODAL.search(/tabBtn\('/);
  assert.ok(i0 > 0, '탭 바를 못 찾았다');
  const bar = MODAL.slice(i0, i0 + 600);
  const n = (bar.match(/tabBtn\('/g) || []).length;
  assert.equal(n, 3, '탭 단추가 셋이 아니다 (일지를 담당자에 합쳤다): ' + n);
  assert.match(SRC, /PANES\.manager = h\('div', null, PANES\.manager, PANES\.journal\)/,
    '★ 일지를 담당자 장에 안 붙였다 — 탭만 없애면 일지를 아예 못 본다');
});

test('⑬★ 없어진 탭 이름으로 열려 있어도 «저장 단추»가 나온다', () => {
  /* 왜: 창이 열린 채 코드가 바뀌면 tab 이 'journal' 로 남는다. 그때 마지막 장으로
     치지 않으면 「다음」만 뜨고 저장을 못 한다 — 적어 둔 것이 갇힌다. */
  const at = SRC.indexOf('var isLast =');
  assert.ok(at > 0, 'isLast 판정을 못 찾았다');
  const band = SRC.slice(at, at + 200);
  assert.match(band, /journal/, "★ 옛 탭 이름('journal')을 마지막 장으로 안 친다 — 저장 단추가 안 나온다");
});

test('⑭ 창이 네 칸을 담을 만큼 넓어졌고, 작은 화면은 css 가 막는다', () => {
  const at = MODAL.length ? SRC.indexOf("className:'modal', style:{ width:") : -1;
  assert.ok(at > 0, '계약창 너비를 못 찾았다');
  const m = /width:\s*'(\d+)px'/.exec(SRC.slice(at, at + 80));
  assert.ok(m, '계약창 너비가 px 로 안 적혀 있다');
  assert.ok(Number(m[1]) >= 900,
    '★ 창이 네 칸을 담기엔 좁다 — 칸 하나가 210px 밑으로 내려가면 회사명·주소가 잘린다: ' + m[1]);
  assert.match(CSS, /\.modal \{[^}]*max-width:\s*\d+vw/,
    '.modal 에 max-width 가 없다 — 작은 화면에서 창이 밖으로 나간다');
});
