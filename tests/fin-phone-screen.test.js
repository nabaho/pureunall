'use strict';
/* 재무관리(pu-erp.html?app=fin) 폰 화면 (대표 지시 2026-10-18 「폰화면관리」)
   360·411px 에서 «로그인한 채» 그려 보니 —
     · 입금관리 미입금 대기: 열셋 칸 표라 옆으로 밀어야 금액·입금확정이 보였고, 이름표 「금액:」「시작일:」이
       한 글자씩 세로로 쌓였다.
     · 손익계산서: 달 칸이 「1/월」 처럼 두 줄로 꺾여 줄마다 높이가 두 배.
     · 세금계산서: 「월/별」「분기/별」 네 탭이 다 두 줄.
     · 미수금관리: 「장기」 칸이 빨간 바탕에 빨간 글씨라 «빈 빨간 칸»(넓은 화면도 같았다).
   (재는 도구: tools/phone-audit · 자료: tools/phone-audit/seeds/fin.js)

   ⚠ «지금 값»(px·문구)이 아니라 «규칙»을 본다. 실행: node --test tests/fin-phone-screen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = stripJs(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function phoneCss() {
  const out = [];
  const re = /@media\s*\(max-width:\s*(\d+)px\)/g;
  let m;
  while ((m = re.exec(CSS))) {
    if (+m[1] > 768) continue;
    let i = CSS.indexOf('{', m.index) + 1, d = 1;
    for (; i < CSS.length && d > 0; i++) { if (CSS[i] === '{') d++; else if (CSS[i] === '}') d--; }
    out.push(CSS.slice(m.index, i));
  }
  return out.join('\n');
}
const PHONE = phoneCss();
function fnBody(head) {
  const i = SRC.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* 미입금 대기 — 폰 갈래(카드)와 넓은 화면 갈래(표) */
const PEND = fnBody('function IncomePendingTab(props)');
const TABLE_AT = PEND.search(/h\('div',\s*\{\s*ref:[A-Za-z_$][\w$]*\.ref,\s*style:[A-Za-z_$][\w$]*\s*\},\s*\n?\s*h\('table'/);
/* 폰 갈래가 없으면 '' — 검사마다 따로 운다(한 곳에서 멈추면 무엇이 빠졌는지 안 보인다) */
const CARDS = (function () {
  if (TABLE_AT < 0) return '';
  const at = PEND.lastIndexOf('window.innerWidth <= 768', TABLE_AT);
  return (at > 0 && TABLE_AT - at < 9000) ? PEND.slice(at, TABLE_AT) : '';
})();

test('★★ 미입금 대기 — 폰에서는 줄마다 «두 줄 카드», 넓은 화면은 표 그대로', () => {
  assert.ok(TABLE_AT > 0, '미입금 대기 표를 못 찾았습니다');
  assert.ok(CARDS, '★ 미입금 대기에 폰 갈래가 없습니다 — 열셋 칸 표를 옆으로 밀어야 금액이 보입니다');
  assert.match(CARDS, /pendPg\.paged\.map\(function\(p,\s*idx\)/, '카드가 표와 «같은 쪽»(pendPg)을 그려야 합니다');
  /* 1줄: 번호 · 종류 · 업체명 · 금액 */
  assert.match(CARDS, /idx\s*\+\s*1/, '번호가 없습니다');
  assert.match(CARDS, /p\.store\.label/, '종류가 없습니다');
  assert.match(CARDS, /p\.amount\.toLocaleString\(\)/, '★ 금액이 카드에 없습니다');
  const co = CARDS.match(/h\('span',\s*\{\s*title:coName[^}]*\}[^}]*\}\s*,\s*coName/);
  assert.ok(co, '★ 업체명에 title(전문)이 없습니다');
  assert.match(co[0], /whiteSpace:'nowrap'/, '★ 업체명은 한 줄(넘치면 …)');
  assert.match(co[0], /textOverflow:'ellipsis'/);
  /* 세로 상자는 접히지 않는다 — 폰 공통 규칙이 gap 있는 flex 를 접으면 카드가 화면보다 넓어진다 */
  assert.match(CARDS, /flexDirection:'column',[^}]*flexWrap:'nowrap'/);
});

test('★★ 미입금 대기 카드는 표와 «같은 함수»로 판단하고 같은 일을 한다 — 따로 셈하지 않는다', () => {
  ['hitOf(p)', 'itemClosedInfo(p)', 'openFromBank(p, hit)', 'erpConfirmInit(p,', 'deletePendingItem(p)', 'setFinModal(p)'].forEach(function (k) {
    assert.ok(CARDS.indexOf(k) >= 0, '★★ 카드에서 ' + k + ' 를 안 부릅니다 — 표와 다른 길로 가면 언젠가 한쪽만 고쳐집니다');
    assert.ok(PEND.slice(TABLE_AT).indexOf(k) >= 0, '이 검사의 전제(표도 ' + k + ' 를 부른다)가 바뀌었습니다');
  });
});

test('★ 말이 있는 값만 그린다 — 빈 칸·「-」로 줄을 채우지 않는다', () => {
  const m = CARDS.match(/var info = \[[\s\S]*?\]\.filter\(([^)]*\)[^)]*)\)/);
  assert.ok(m, '부가 정보를 «거른 뒤» 이어 붙여야 합니다');
  assert.match(m[1], /'-'|erpNoteWorth/, '★ 「-」(담당 없음)가 줄에 찍힙니다');
});

test('★ 거르개 줄의 이름표는 꺾이지 않는다 — 「금/액:」「시/작/일:」 세로 쌓임', () => {
  ["'금액:'", "'시작일:'"].forEach(function (lb) {
    const at = PEND.indexOf(lb);
    assert.ok(at > 0, lb + ' 를 못 찾았습니다');
    const st = PEND.slice(PEND.lastIndexOf('style:', at), at);
    assert.match(st, /whiteSpace:'nowrap'/, '★ ' + lb + ' 이 폰에서 한 글자씩 세로로 쌓입니다');
    assert.match(st, /flexShrink:0/);
  });
});

test('★ 손익계산서 — 표 칸은 한 줄 (이 화면은 .page 밖이라 따로 묶는다)', () => {
  const pl = fnBody('function FinancePnL()');
  const cls = pl.match(/return h\('div',\s*\{\s*className:'([\w-]+)'/);
  assert.ok(cls, '★ 손익계산서 뿌리에 폰 규칙이 잡을 손잡이(className)가 없습니다');
  const re = new RegExp('\\.' + cls[1] + ' table th, \\.' + cls[1] + ' table td\\s*\\{[^}]*white-space:\\s*nowrap');
  assert.match(PHONE, re, '★ 폰에서 달 칸이 「1/월」 처럼 두 줄로 꺾입니다');
  assert.doesNotMatch(pl, /return h\('div',\s*\{\s*className:'page'/, '이 검사의 전제(.page 밖)가 바뀌었습니다 — .page 한 줄 규칙으로 충분한지 보세요');
});

test('세금계산서 — 기간 탭(월별·분기별·연도별·전체)은 한 줄 글자', () => {
  const iv = fnBody('function FinanceInvoice()');
  const at = iv.indexOf('function modeBtn(m, label)');
  assert.ok(at > 0, '기간 탭을 못 찾았습니다');
  const mb = iv.slice(at, iv.indexOf('}, label);', at));
  assert.match(mb, /whiteSpace:'nowrap'/, '★ 폰에서 「월/별」「분기/별」 처럼 탭이 두 줄이 됩니다');
  assert.match(mb, /window\.innerWidth\s*<=\s*768\s*\?/, '폰에서 여백을 줄이는 갈래가 없습니다');
});

test('★ 미수금관리 — 짙은 바탕 칸(invertText)은 흰 글씨로 읽힌다', () => {
  const rv = fnBody('function FinanceReceivable(props)');
  assert.match(rv, /invertText:\s*true/, '이 검사의 전제(짙은 바탕 등급)가 바뀌었습니다');
  assert.match(rv, /g\.invertText\)\s*\?\s*'#fff'/, '★ invertText 를 안 쓰면 빨간 바탕에 빨간 글씨 — «빈 빨간 칸»이 됩니다');
});
