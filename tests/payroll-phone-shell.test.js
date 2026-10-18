'use strict';
/* 급여관리 — 폰에서 3칸이 위아래로 쌓일 때 «지금 할 일»이 첫 화면에 오게 (폰화면관리 2026-10-18)

   무엇이 문제였나 (지어낸 30곳·한 곳 28명, 360·411px 크로미움):
     · 보기 띠가 178px 폭 — 3칸 치수(nav.viewbar)가 폰의 nav{width:100%} 를 이겨, 알약이 잘리고 오른쪽은 빈 흰 칸.
     · 회사를 열어도 보기 띠·회사 목록(42vh)이 위에 그대로라 탭·내용이 600px 아래에서 시작했다.
     · 회사 칸 지표 열 개가 네 줄, 탭 일곱 개가 두 줄.
     · 직원별 급여표·근태표의 성명이 「점/검/누/리」 한 글자씩 세로로 쌓였다.
     · 월 목록의 파일 이름이 달마다 네댓 줄로 접혀 열두 달이 1,400px.
     · 설정 카드의 ✎ 가 11×12px.

   지키는 규칙 (px 값을 박지 않는다):
     ① 폰 구간에서 보기 띠는 화면 폭을 다 쓴다
     ② ★ 회사를 열면 보기·목록을 접는다 — 단 «돌아갈 걸음»이 있을 때만(없으면 목록으로 갈 길이 사라진다). 실제로 돌려 본다
     ③ 지표·탭은 한 줄(옆으로 민다)
     ④ 급여표 칸은 한 줄, 성명은 왼쪽에 붙고, 다른 표들도 이름 칸은 한 줄이다
     ⑤ 월 목록의 파일 이름은 폰에서 접는다 — PC 에서는 그대로 보인다
     ⑥ ✎ 는 폰에서 손가락 크기
   실행: node --test tests/payroll-phone-shell.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'payroll-os.html'), 'utf8');

/* 폰 폭(max-width ≤ limit, min-width 없음) @media 안의 규칙들 */
function phoneRules(src, limit) {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(css))) {
    const q = m[1];
    const w = (q.match(/max-width\s*:\s*(\d+)px/) || [])[1];
    if (!w || Number(w) > limit || /min-width/.test(q)) continue;
    let i = m.index + m[0].length, d = 1;
    const s = i;
    while (i < css.length && d > 0) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
    const body = css.slice(s, i - 1);
    const r = /([^{}]+)\{([^{}]*)\}/g;
    let x;
    while ((x = r.exec(body))) out.push([x[1].trim(), x[2]]);
  }
  return out;
}
function decl(rules, re) {
  return rules.filter(([sel]) => sel.split(',').some((one) => re.test(one.trim()))).map(([, d]) => d).join(';');
}
/* <style> 안만 — 스크립트 속 글자(예: '…;width:100%;…')를 CSS 로 잘못 읽지 않게 */
const STYLE = [...SRC.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const P = phoneRules(STYLE, 760);

test('★① 폰에서 보기 띠는 화면 폭을 다 쓴다 — 3칸 치수가 폰까지 오면 알약이 잘린다', () => {
  assert.match(decl(P, /^nav\.viewbar$/), /width\s*:\s*100%/);
});

test('★② 회사를 열면 보기·목록을 접는다 — 돌아갈 걸음이 있을 때만 (실제로 돌려 본다)', () => {
  assert.match(decl(P, /^body\.co-open nav\.viewbar$/), /display\s*:\s*none/);
  assert.match(decl(P, /^body\.co-open #colist$/), /display\s*:\s*none/);
  assert.match(decl(P, /^body\.co-none #main$/), /display\s*:\s*none/, '아무 회사도 안 열었을 때 「왼쪽 목록에서 고르세요」 칸이 목록 아래 자리만 먹는다');
  assert.match(decl(P, /^body\.co-none #colist$/), /max-height\s*:\s*none/, '안 열었을 때는 목록을 다 펴야 한다');

  const fn = cutFn(SRC, 'function render(');
  function run(app, depth) {
    const els = {}, cls = new Set();
    const el = () => ({ style: {}, innerHTML: '', hidden: false });
    const box = {
      App: app, navDepth: depth, PuSiteStaff: {},
      document: {
        getElementById: (id) => (els[id] = els[id] || el()),
        body: { classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); } } },
      },
      ensureCo() {}, shellModel: () => ({}), viewbarHtml: () => 'v', colistHtml: () => 'c', shellMainHtml: () => 'm',
      coBarHtml: () => (app.coId ? 'bar' : ''), drawCardEdit() {}, addPayrollReportHwpxAction() {},
      screenCards: () => '', screenNames: () => '', screenPayroll: () => '', screenAttend: () => '', screenLeave: () => '',
      screenSever: () => '', screenSlip: () => '', screenReport: () => '', screenInbox: () => '',
    };
    vm.runInNewContext(fn + '\nrender();', box);
    return cls;
  }
  assert.ok(run({ screen: 'shell', coId: 'c001', tab: 'sum' }, 1).has('co-open'), '회사를 열었는데 목록이 그대로 위에 남는다');
  assert.ok(!run({ screen: 'shell', coId: 'c001', tab: 'sum' }, 0).has('co-open'), '돌아갈 걸음이 없는데 목록을 접으면 목록으로 갈 길이 사라진다');
  assert.ok(run({ screen: 'shell', loose: '지난자료', tab: 'sum' }, 2).has('co-open'), '지난·못 이은 자료를 열어도 같다');
  const none = run({ screen: 'shell', tab: 'sum' }, 0);
  assert.ok(none.has('co-none') && !none.has('co-open'), '아무것도 안 열었을 때는 목록을 편다');
  assert.ok(!run({ screen: 'cards', tab: 'sum' }, 1).has('co-none'), '도구 화면에는 3칸 가르기가 걸리면 안 된다');
});

test('★③ 지표·탭은 한 줄 — 옆으로 민다', () => {
  const k = decl(P, /^header \.cobar \.kpis$/);
  assert.match(k, /flex-wrap\s*:\s*nowrap/, '지표 열 개가 네 줄로 접힌다');
  assert.match(k, /overflow-x\s*:\s*auto/, '한 줄로 묶었으면 옆으로 밀 수 있어야 한다');
  const t = decl(P, /^\.tabs$/);
  assert.match(t, /flex-wrap\s*:\s*nowrap/, '탭이 두 줄로 접힌다');
  assert.match(t, /overflow-x\s*:\s*auto/);
});

test('★④ 급여표 칸은 한 줄·성명은 왼쪽에 붙는다 · 다른 표들도 이름 칸은 한 줄', () => {
  const sp = cutFn(SRC, 'function screenPayroll(');
  assert.match(sp, /<table class="emptbl"/, '직원별 급여표에 폰 이름표가 없다');
  assert.match(sp, /\['순번','성명'/, '성명이 둘째 칸이 아니면 왼쪽에 붙일 칸이 어긋난다');
  assert.match(decl(P, /^\.emptbl td$/), /white-space\s*:\s*nowrap/);
  assert.match(decl(P, /^\.emptbl td:nth-child\(2\)$/), /position\s*:\s*sticky/, '숫자를 옆으로 밀면 누구 줄인지 사라진다');
  assert.match(decl(P, /:nth-child\(-n\+2\)/), /white-space\s*:\s*nowrap/, '근태·연차·퇴직·신고 표의 성명이 「점검/누리」로 접힌다');
});

test('★⑤ 월 목록의 파일 이름은 폰에서 접는다 — PC 에서는 그대로', () => {
  const sp = cutFn(SRC, 'function screenPayroll(');
  assert.match(sp, /<span class="mfile">/, '파일 이름을 따로 접을 이름표가 없다');
  assert.match(decl(P, /^\.mfile$/), /display\s*:\s*none/);
  const base = STYLE.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.doesNotMatch(base, /\.mfile\s*\{[^}]*display\s*:\s*none/, 'PC 에서까지 파일 이름이 사라진다');
});

test('★⑥ ✎ 는 폰에서 손가락 크기', () => {
  const d = decl(P, /^\.pen$/);
  const w = Number((d.match(/min-width\s*:\s*(\d+)px/) || [])[1]);
  const h = Number((d.match(/min-height\s*:\s*(\d+)px/) || [])[1]);
  assert.ok(w >= 24 && h >= 24, '✎ 가 손가락보다 작다 (' + w + '×' + h + ')');
});
