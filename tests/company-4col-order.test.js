'use strict';
/* 업체 수정 — 네 칸 · 계약창과 같은 차례 (대표 지시 2026-09-19 「추천대로 진행」)

   「업체관리 어떻게 하는게 좋은가? 추천해라」 → 「수정 화면은 같이 바꾸고,
    보기 화면은 그대로 둔다」고 권했고 「추천대로 진행」으로 승인받았다.

   업체 수정 화면(CompanyEditModal)과 계약창(ContractModal)은 «같은 자료»를
   고치는 두 곳이다(사업자번호가 같으면 서로 반영된다). 그래서 tests/contract-4col-order.test.js
   와 같은 규칙을 이 창에도 그대로 적용한다.

   ★ 이 검사가 못 박는 것은 «규칙»이지 «지금 값»이 아니다:
     ① 네 칸 모양(pu-g4·fld4·sec4)을 계약창과 «공유»가 아니라 «따로» 두었다(이 파일의
        관행 — fld() 도 모달마다 따로다). 있는지만 본다.
     ② 칸 차례가 계약창·기업정보함과 같은 «덩어리 차례»를 따른다.
     ③ 부담당은 «사람마다 칸 하나»다.
     ④ 법인등록번호에 «사람이 고칠 칸»이 있고, 사업자등록증 가져오기에도 이어진다.
     ⑤ 계약정보는 날짜가 금액보다 앞에 온다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8');
const SRC = stripJs(RAW);
const MODAL_RAW = cutFn(RAW, 'function CompanyEditModal(props)');
const MODAL = stripJs(MODAL_RAW);

test('① 업체 수정 창이 네 칸 만들개(fld4·sec4)를 «제 것으로» 갖는다', () => {
  /* ⚠ 계약창의 fld4·sec4 를 그대로 끌어 쓰지 않는다 — 이 파일은 fld() 도
     모달마다 따로 있다. 그 결을 따랐는지 본다(공용화는 별도 판단이 필요하다). */
  assert.match(MODAL, /function fld4\(label, ctrl, span\)\{/,
    '업체 수정 창에 fld4 만들개가 없다');
  assert.match(MODAL, /function sec4\(title, hint\)\{/,
    '업체 수정 창에 sec4 만들개가 없다');
  assert.ok(MODAL.split("className:'pu-g4'").length - 1 >= 3,
    '네 칸 그리드가 거의 안 쓰였다 — 회사정보·세무사무실·계약정보·담당자정보 넷은 있어야 한다');
});

test('② 창이 계약창과 같은 너비다 (같은 자료를 고치는 두 화면)', () => {
  const m = /className:'modal', style:\{ width:'(\d+)px'/.exec(MODAL);
  assert.ok(m, '업체 수정 창의 너비를 못 찾았다');
  assert.ok(Number(m[1]) >= 900,
    '★ 네 칸을 담기엔 좁다 — 칸 하나가 210px 밑으로 내려가면 회사명·주소가 잘린다: ' + m[1]);
});

test('③★ 칸 차례가 계약창·기업정보함과 같은 «덩어리 차례»를 따른다', () => {
  const 자리 = s => { const i = MODAL.indexOf(s); assert.ok(i > 0, s + ' 못 찾음'); return i; };
  const 신원 = 자리("fld4('사업자번호'");
  const 주소 = 자리("'사업장 주소'") >= 0 ? MODAL.indexOf("'사업장 주소'")
             : (() => { const i = MODAL.indexOf("h('label', null, '주소')"); assert.ok(i > 0, '주소 칸 못 찾음'); return i; })();
  const 연락처 = 자리("fld4('대표 전화'");
  const 업종 = 자리("fld4('업태'");
  assert.ok(신원 < 주소, '사업자번호가 주소보다 뒤에 있다');
  assert.ok(주소 < 연락처, '주소가 연락처보다 뒤에 있다');
  assert.ok(연락처 < 업종, '★ 업태가 연락처보다 앞에 있다 — 기업정보함은 업태·종목을 연락처 뒤에 둔다');
});

test('④★ 연락처 넷(전화·팩스·대표자이메일·회사이메일)이 «한 묶음»으로 붙어 있다', () => {
  const a = MODAL.indexOf("fld4('대표 전화'");
  const b = MODAL.indexOf("fld4('회사 이메일'");
  assert.ok(a > 0 && b > a, '연락처 칸을 못 찾았다');
  const 사이 = MODAL.slice(a, b);
  assert.ok(!/sec4\(/.test(사이),
    '★ 전화와 회사 이메일 사이에 다른 묶음이 끼었다 — 연락처는 한 줄에 모아야 한다');
});

test('⑤★ 법인등록번호에 «사람이 고칠 칸»이 있다 (값은 들어오는데 자리가 없던 칸)', () => {
  assert.match(MODAL, /fld4\('법인등록번호'/,
    '법인등록번호 입력칸이 없다 — 판독·계약창이 corpRegNo 를 채우는데 고칠 자리가 없다');
  assert.match(MODAL, /value:f\.corpRegNo \|\| ''.*onChange:set\('corpRegNo'\)/,
    '법인등록번호 칸이 corpRegNo 에 이어져 있지 않다');
});

test('⑥★ 사업자등록증 가져오기가 법인등록번호도 함께 채운다', () => {
  const fn = stripJs(cutFn(RAW, 'function fillCompanyFromPcBiz(row)'));
  assert.match(fn, /k:'corpRegNo',\s*v:row\.corpNo/,
    '★ fillCompanyFromPcBiz 가 법인등록번호를 안 채운다 — 칸은 생겼는데 값 통로가 안 이어져 있다');
  assert.doesNotMatch(fn, /법인등록번호\(corpNo\)는 넣지 않는다/,
    '★ 「칸이 없어 안 채운다」던 옛 주석이 아직 남아 있다 — 칸이 생겼다는 사실과 어긋난다');
});

test('⑦★ 부담당은 «사람마다 칸 하나»다 — 한 칸에 몰아 쌓지 않는다', () => {
  assert.match(MODAL, /\(f\.managerSubs\|\|\[\]\)\.map\(function\(sid,\s*i\)/,
    '★ 부담당을 사람마다 그리지 않는다 — 한 칸에 몰아 쌓던 모양으로 돌아갔다');
  const at = MODAL.indexOf("'부담당 ' + (i+1)");
  assert.ok(at > 0, '자리마다 몇 번째인지(부담당 1·2·3) 알려 주지 않는다');
  const 둘레 = MODAL.slice(at, at + 700);
  assert.match(둘레, /h\('select'/,
    '★ 그 자리에서 «사람을 고를» 수 없다');
});

test('⑧★ 한 자리만 뺄 수 있고, 뺀 뒤에도 남은 자리 번호가 안 흔들린다', () => {
  /* ⚠ cutFn(RAW, ...) 을 쓰면 «파일에서 처음 만나는» setSubAt(=ContractModal 것)만
     본다. CompanyEditModal 은 같은 이름을 «따로» 갖고 있어(fld4 와 같은 결) 반드시
     MODAL_RAW(이 창 한 덩이) 안에서 잘라야 한다. */
  const fn = stripJs(cutFn(MODAL_RAW, 'function setSubAt(i, sid)'));
  assert.match(fn, /subs\.splice\(i,\s*1\)/, '★ 그 자리만 빼지 않는다');
  assert.match(fn, /subs\[i\]\s*=\s*sid/, '★ 자리를 지키며 바꾸지 않는다');
  assert.ok((RAW.match(/function setSubAt\(i, sid\)\{/g) || []).length >= 2,
    'setSubAt 이 계약창·업체창 둘 다에 있어야 한다');
});

test('⑨★ 계약정보는 날짜가 금액보다 앞에 온다', () => {
  const 자리 = s => { const i = MODAL.indexOf(s); assert.ok(i > 0, s + ' 못 찾음'); return i; };
  const 계약유형 = 자리("fld4('업체유형'");
  const 시작일 = 자리("fld4('계약 시작일'");
  const 부가세 = 자리("fld4('부가세'");
  const 자문료 = 자리("fld4('월 자문료'");
  assert.ok(계약유형 < 시작일, '계약유형이 시작일보다 뒤에 있다');
  assert.ok(시작일 < 부가세, '시작일이 부가세보다 뒤에 있다');
  assert.ok(부가세 < 자문료, '★ 부가세가 월 자문료보다 뒤에 있다 — 날짜 묶음이 돈보다 앞에 와야 한다');
});

test('⑩ 창이 좁아지면 css 가 두 칸으로 접는다 (계약창과 같은 규칙 재사용)', () => {
  assert.match(CSS, /@media[^{]*max-width[^{]*\{[\s\S]*?\.pu-g4 \{[^}]*grid-template-columns/,
    '좁은 화면에서 .pu-g4 를 다시 잡아 주는 규칙이 없다');
});
