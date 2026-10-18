'use strict';
/* 인사관리(pu-erp.html?app=hr) 폰 화면 (대표 지시 2026-10-18 「폰화면관리」)
   360·411px 에서 «로그인한 채» 그려 보니 화면 세 곳에서 «본문 전체가 옆으로 굴렀다» —
   문서 폭은 멀쩡한데 본문 상자(main) 안이 넓어져, 손가락이 조금만 옆으로 가도 화면이 통째로 밀렸다.
     근태관리 380px · 급여관리 401px · 증명서 1,142px (화면 360px)
   그리고 인사관리기준 사용자표의 상태 고르개가 「재직」→「재즈」로 잘리고, 거르개 칩 글자가 두 줄로 꺾였다.
   (재는 도구: tools/phone-audit · 자료: tools/phone-audit/seeds/hr.js)

   ⚠ «지금 값»(px)이 아니라 «규칙»을 본다. 실행: node --test tests/hr-phone-screen.test.js */
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
/* 인라인 style 의 grid 칸 나눔이 폰에서 «한 칸이 줄어들 수 있게» 풀리는가 —
   선택자 [style*="grid-template-columns: <값>"] 를 찾아 그 선언을 돌려준다 */
function gridRule(cols) {
  const esc = cols.replace(/[()]/g, '\\$&');
  const m = PHONE.match(new RegExp('\\[style\\*="grid-template-columns: ' + esc + '"\\]\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

test('★ 증명서 — 「입력 · 문서」 두 칸은 폰에서 한 칸(문서는 아래) — 옆에 앉은 A4 가 본문을 밀지 않는다', () => {
  const ce = fnBody('function Certificate()');
  const m = ce.match(/gridTemplateColumns:'(\d+px) 1fr'/);
  assert.ok(m, '이 검사의 전제(입력칸 고정폭 + 문서 두 칸)가 바뀌었습니다');
  const r = gridRule(m[1] + ' 1fr');
  assert.ok(r, '★ 폰에서 「' + m[1] + ' 1fr」 두 칸을 한 칸으로 푸는 규칙이 없습니다 — A4(210mm)가 본문을 1,142px 로 밀었습니다');
  assert.match(r, /grid-template-columns:\s*(minmax\(0,\s*1fr\)|1fr)\s*!important/);
  /* 문서는 아래에 서니 «남은 높이»로 맞추면 늘 바닥까지 줄었다 — 폰은 폭에만 맞춘다 */
  assert.match(ce, /if\(window\.innerWidth\s*<=\s*768\)\s*roomH\s*=\s*Infinity/,
    '★ 폰에서 미리보기 배율이 높이(음수)에 묶여 늘 가장 작게 줄어듭니다');
});

test('★ 「칸 + 단추」 두 칸 줄 — 입력칸이 단추를 화면 밖으로 밀지 않는다 (근태관리 「+ 등록」)', () => {
  const at = fnBody('function AttendanceManagement()');
  assert.match(at, /gridTemplateColumns:'1fr auto'/, '이 검사의 전제(근태 비고+등록 두 칸 줄)가 바뀌었습니다');
  const r = gridRule('1fr auto');
  assert.ok(r, '★ 폰에서 「1fr auto」 줄의 칸이 줄어들지 못해 「+ 등록」이 화면 밖으로 나갑니다');
  assert.match(r, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.match(PHONE, /\[style\*="grid-template-columns: 1fr auto"\]\s*>\s*input\s*\{[^}]*min-width:\s*0/,
    '★ 입력칸이 제 글자 폭(min-width:auto)을 고집하면 칸을 풀어도 단추를 밉니다');
});

test('★ 급여관리 — 월 이동·퇴사자 제외·마감 잠금 덩어리가 폰에서 제 폭을 고집하지 않는다', () => {
  const pl = fnBody('function PayrollLedger(props)');
  const at = pl.indexOf("h(MonthNav, { onPrev:function(){changeMonth(-1);}");
  assert.ok(at > 0, '월 이동을 못 찾았습니다');
  const wrap = pl.slice(pl.lastIndexOf("h('div', {", at), at);
  /* 폰에서는 겹을 없애(contents) 바깥 줄의 낱개로 꺾이거나, 줄어들 수 있어야(flexShrink≠0) 한다 */
  assert.match(wrap, /display:\s*IS_M\s*\?\s*'contents'|flexShrink:\s*IS_M\s*\?\s*1/,
    '★ 폰에서 이 덩어리가 제 폭(367px)을 고집해 「🔓 마감 잠금」이 화면 밖으로 나가고 본문이 옆으로 굴렀습니다');
  assert.match(pl, /var IS_M = window\.innerWidth <= 768;/, '이 검사의 전제(폰 여부 변수)가 바뀌었습니다');
});

test('★ 인사관리기준 사용자표 — 상태 고르개는 글씨(16px)에 맞는 폭, 거르개 칩은 한 줄 글자', () => {
  /* 환경설정은 폰에서 고르개 글씨가 16px(2026-10-04 대표)이다 — 폭을 54px 에 묶어 두면 「재직」이 잘린다 */
  const sel = PHONE.match(/\.env-section \.user-tbl select\s*\{([^}]*)\}/);
  assert.ok(sel, '★ 사용자표 상태 고르개의 폭을 푸는 폰 규칙이 없습니다 — 「재직」이 「재즈」로 잘립니다');
  assert.match(sel[1], /max-width:\s*none\s*!important/);
  assert.match(sel[1], /min-width:\s*\d+px/);
  assert.match(PHONE, /\.env-section input, \.env-section select, \.env-section textarea\s*\{[^}]*font-size:\s*16px/,
    '이 검사의 전제(환경설정 고르개 16px)가 바뀌었습니다');
  const at = SRC.indexOf("{ v:'admin',  label:'👑 관리자', count: adminCount");
  assert.ok(at > 0, '사용자표 거르개 칩을 못 찾았습니다');
  const chips = SRC.slice(SRC.lastIndexOf("h('div', {", at), at + 1500);
  assert.match(chips, /flexWrap:'wrap'/, '모자라면 칩째 다음 줄로 가야 합니다');
  assert.match(chips, /whiteSpace:'nowrap'/, '★ 칩 «안»의 글자가 「관리/자 (1)」 처럼 두 줄로 꺾입니다');
});

test('성과관리 — 「↺ 복원」은 폰에서 한 줄, 넓은 화면은 그대로', () => {
  const pm = fnBody('function PerfManagement(props)');
  const at = [];
  for (let i = pm.indexOf("'↺ 복원'"); i >= 0; i = pm.indexOf("'↺ 복원'", i + 1)) at.push(i);
  assert.ok(at.length >= 1, '복원 단추를 못 찾았습니다');
  at.forEach(function (i) {
    const style = pm.slice(pm.lastIndexOf('style:', i), i);
    assert.match(style, /whiteSpace:\s*window\.innerWidth\s*<=\s*768\s*\?\s*'nowrap'/,
      '★ 폰에서 「↺ / 복원」 이 두 줄로 꺾여 그 줄만 높아집니다');
    /* 넓은 화면까지 한 줄로 묶으면 표가 넓어져 PC 에서 옆으로 구른다(실측 +35px) — 폰 갈래로만 */
    assert.doesNotMatch(style, /whiteSpace:'nowrap'/, '★ 넓은 화면까지 묶으면 PC 표가 옆으로 구릅니다');
  });
});
