'use strict';
/* 컨설팅보고서(gov-report.html) — 폰화면관리 (대표 지시 2026-10-18 「폰화면관리」)

   폰 폭(360px)에서 가짜 자료로 그려 보니 «전체 현황» 표(9칸)가 한 칸(.grid 1fr)을 1052px 로 늘려
   페이지 전체가 옆으로 밀렸다 — 숫자 칸·거르개·표의 오른쪽 절반이 화면 밖이었다. 지키는 규칙(px 값은 박지 않는다):
   ① 좁은 화면(900px 이하) 한 칸 격자는 minmax(0,1fr) — 그냥 1fr 은 가장 넓은 표만큼 늘어난다
   ② 폰(760px 이하) 머리 한 줄 · 사업 카드는 옆으로 미는 한 줄 · 숫자 칸은 한 줄 딱지
   ③ 현황판 표 → 두 줄 카드: 1줄 □·번호·업체 … 상태, 2줄 사업·담당·회차 … 단추 (☐ 번호는 그대로)
   ④ 찾기 칸 16px(아이폰 확대 막기) · 서류 체크표는 업체 칸이 왼쪽에 붙는다 · 창 머리 단추는 접히지 않는다
   ★ 폰 규칙은 모두 760px 이하 덩이 안 — PC 는 그대로. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-report.html'), 'utf8');
/* <style> 안만 — 머리 HTML 주석의 «mailbox/*» 같은 글자가 CSS 주석 걷기를 엉뚱하게 시작시키지 않게 */
const CSS = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');

function mediaBlocks(css) {
  const out = [];
  let at = 0;
  for (;;) {
    const m = css.indexOf('@media', at);
    if (m < 0) break;
    const open = css.indexOf('{', m);
    let d = 0, i = open;
    for (; i < css.length; i++) { if (css[i] === '{') d++; else if (css[i] === '}') { d--; if (!d) break; } }
    out.push({ q: css.slice(m + 6, open).trim(), body: css.slice(open + 1, i) });
    at = i + 1;
  }
  return out;
}
const BLOCKS = mediaBlocks(CSS);
const maxW = (q) => { const m = q.match(/max-width:\s*(\d+)px/); return m && !/min-width/.test(q) ? +m[1] : null; };
const rules = (body) => body.split('}').map((r) => r.split('{')).filter((x) => x.length === 2).map(([sel, decl]) => ({ sel: sel.trim(), decl }));
function inMedia(limit, selRe, declRe, why) {
  const hit = BLOCKS.filter((b) => maxW(b.q) !== null && maxW(b.q) <= limit).some((b) => rules(b.body).some((r) => selRe.test(r.sel) && declRe.test(r.decl)));
  assert.ok(hit, why);
}
const TOP = (() => { let s = CSS; BLOCKS.forEach((b) => { s = s.replace(b.body, ''); }); return s; })();
function topLacks(selRe, declRe, why) {
  assert.ok(!rules(TOP).some((r) => selRe.test(r.sel) && declRe.test(r.decl)), why);
}

test('① 좁은 화면의 한 칸 격자는 minmax(0,1fr) — 넓은 표가 페이지를 옆으로 밀지 않는다', () => {
  const grids = BLOCKS.filter((b) => maxW(b.q) !== null && maxW(b.q) <= 900)
    .flatMap((b) => rules(b.body)).filter((r) => r.sel === '.grid' && /grid-template-columns/.test(r.decl));
  assert.ok(grids.length, '좁은 화면 .grid 규칙이 없습니다');
  grids.forEach((r) => {
    const v = r.decl.match(/grid-template-columns:\s*([^;]+)/)[1].trim();
    assert.ok(!/(^|\s)1fr/.test(v.replace(/minmax\([^)]*\)/g, '')), '좁은 화면 .grid 에 맨 1fr 이 있습니다 — 표 폭만큼 늘어 페이지가 옆으로 밀립니다: ' + v);
  });
  /* 표 상자는 제 안에서 옆으로 민다 */
  assert.ok(rules(TOP).some((r) => r.sel === '.tbl' && /overflow:\s*auto/.test(r.decl)), '.tbl 이 제 안에서 밀지 않습니다');
});

test('② 머리 한 줄 · 사업 카드는 옆으로 미는 한 줄 · 숫자 칸은 한 줄 딱지', () => {
  inMedia(760, /^\.top$/, /flex-wrap:\s*nowrap/, '폰 머리가 두 줄로 접힙니다');
  inMedia(760, /^#who$/, /text-overflow:\s*ellipsis/, '폰 머리의 «나» 글이 줄어들지 않아 로그아웃을 밀어냅니다');
  inMedia(760, /\.bz-g\+div\.bz-g$/, /overflow-x:\s*auto/, '사업 카드가 옆으로 밀리지 않고 세로로 쌓입니다(첫 화면을 다 먹었다)');
  inMedia(760, /\.bz-g\+div\.bz-g$/, /display:\s*flex/, '사업 카드 묶음이 한 줄이 아닙니다');
  inMedia(760, /\.bz-hint$/, /display:\s*none/, '폰에서 안 되는 «끌어서 순서» 안내가 남아 있습니다');
  inMedia(760, /^\.kpi$/, /display:\s*flex/, '숫자 칸이 두 줄 상자 그대로입니다');
  inMedia(760, /^\.kpi b$/, /display:\s*inline/, '숫자 칸의 숫자가 따로 한 줄을 먹습니다');
  /* 사업 카드 묶음을 고르는 선택자가 기대는 차례 — 오늘 할 일 묶음 다음이 카드 묶음 */
  const biz = SRC.slice(SRC.indexOf('function grRenderBiz('), SRC.indexOf('function grToggleBizGrp('));
  assert.ok(biz.indexOf('td-home') >= 0 && biz.indexOf('td-home') < biz.indexOf("'<div class=\"bz-g\"><div class=\"bz-sum\""),
    '왼쪽 패널 차례가 바뀌었습니다(오늘 할 일 묶음 → 요약·카드 묶음) — 폰 선택자 div.bz-g+div.bz-g 를 함께 고치세요');
});

test('③ 현황판 표 → 두 줄 카드 — □·번호·업체 다음에 상태, 줄을 꺾고 사업·담당·회차·단추', () => {
  inMedia(760, /^#tbl thead$/, /display:\s*none/, '폰에서 표 머리줄이 남아 있습니다');
  inMedia(760, /^#rows tr$/, /display:\s*flex/, '줄이 카드가 아닙니다');
  inMedia(760, /^#rows tr$/, /flex-wrap:\s*wrap/, '카드가 두 줄로 꺾이지 않습니다');
  inMedia(760, /^#rows tr::after$/, /flex:\s*0 0 100%/, '1줄(업체·상태)과 2줄 사이에 줄 꺾기가 없습니다');
  inMedia(760, /^#rows td\.co$/, /text-overflow:\s*ellipsis/, '업체 이름이 넘치면 … 가 아닙니다(한 칸은 한 줄)');
  /* 차례 — 업체(1) · 상태(2) · 꺾기(3) · 사업(4~) */
  const ord = (re) => { const b = BLOCKS.filter((x) => maxW(x.q) === 760).flatMap((x) => rules(x.body)).find((r) => re.test(r.sel) && /order:/.test(r.decl)); return b ? +b.decl.match(/order:\s*(\d+)/)[1] : null; };
  const co = ord(/^#rows td\.co$/), st = ord(/^#rows td:nth-child\(6\)$/), br = ord(/^#rows tr::after$/), ty = ord(/^#rows td\.ty$/);
  assert.ok(co !== null && st !== null && br !== null && ty !== null, '카드 칸 차례(order)가 빠졌습니다');
  assert.ok(co < br && st < br && br < ty, '1줄에 업체·상태, 꺾은 뒤에 사업이 와야 합니다');
  /* 폰 카드는 칸 «차례»(nth-child)에 기댄다 — 표 칸 차례가 바뀌면 여기서 운다(폰 규칙을 함께 고칠 것) */
  const rr = SRC.slice(SRC.indexOf('function grRenderRows('), SRC.indexOf('function grRenderYearBar('));
  const cells = rr.slice(rr.indexOf("return '<tr")).split('<td').slice(1);
  assert.ok(cells.length >= 9, '현황판 칸 수가 바뀌었습니다');
  assert.match(cells[0], /^ class="co"/, '1번째 칸이 업체가 아닙니다');
  assert.match(cells[2], /r\.year/, '3번째 칸(폰에서 숨김)이 연도가 아닙니다');
  assert.match(cells[3], /attNames/, '4번째 칸이 담당이 아닙니다');
  assert.match(cells[5], /^>'\+badge/, '6번째 칸이 상태 딱지가 아닙니다');
  assert.match(cells[6], /steps/, '7번째 칸(폰에서 숨김)이 단계 막대가 아닙니다');
  assert.match(cells[7], /updatedBy/, '8번째 칸(폰에서 숨김)이 마지막 고침이 아닙니다');
  inMedia(760, /#rows td:nth-child\(3\),#rows td:nth-child\(7\),#rows td:nth-child\(8\)/, /display:\s*none/, '폰 카드에서 연도·단계 막대·마지막 고침을 빼지 않았습니다');
  /* ☐·번호는 폰에서도 — 업체 칸 앞 번호(카운터)를 숨기지 않는다 */
  assert.ok(!BLOCKS.flatMap((b) => rules(b.body)).some((r) => /td\.co::before/.test(r.sel) && /display:\s*none|content:\s*none/.test(r.decl)), '폰에서 □·번호를 숨겼습니다');
  topLacks(/^#rows tr$/, /display:\s*flex/, 'PC 표 줄까지 카드가 됐습니다');
});

test('④ 찾기 16px · 서류 체크표 업체 칸 붙박이 · 창 머리 단추는 접히지 않는다', () => {
  /* .filters input[type=search]{font:inherit} 가 «input{16px}» 보다 세서 폰에서도 14px 이었다 */
  inMedia(768, /\.filters input\[type=search\]/, /font-size:\s*(1[6-9]|[2-9]\d)px/, '폰 찾기 칸이 16px 이 아닙니다 — 아이폰이 누를 때 화면을 키웁니다');
  inMedia(760, /\.docs table td\.co/, /position:\s*sticky/, '서류 체크표를 옆으로 밀면 업체 칸이 사라집니다');
  inMedia(760, /^\.toc-top>button$/, /white-space:\s*nowrap/, '창 머리 단추(복사·닫기)가 «복/사» 두 줄로 접힙니다');
  inMedia(760, /^\.toc-top>button$/, /flex-shrink:\s*0/, '창 머리 단추가 긴 업체 이름에 눌립니다');
  inMedia(760, /^\.dsh-p$/, /overflow-x:\s*auto/, '사업 대시보드 단계 칸이 2열로 쌓여 업체 목록을 밀어냅니다');
});

/* ── 양옆 빈자리 (대표 지시 2026-10-18 「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서 쓰게」) ──
   폰에서 «겉 여백이 PC 보다 작은가» · «안쪽 상자를 걷었는가»를 본다(값을 박지 않는다 — PC 값과 견준다). */
function sidePad(decl) {
  const px = (v) => { v = v.trim(); const c = v.match(/^clamp\(\s*([\d.]+)px/); if (c) return +c[1]; const m = v.match(/^([\d.]+)(px)?$/); return m ? +m[1] : NaN; };
  let L = null, R = null;
  const sh = decl.match(/(?:^|;)\s*padding\s*:\s*([^;!]+)/);
  if (sh) { const v = sh[1].trim().split(/\s+(?![^(]*\))/).map(px); R = v.length === 1 ? v[0] : v[1]; L = v.length === 4 ? v[3] : R; }
  const pl = decl.match(/padding-left\s*:\s*([^;!]+)/); if (pl) L = px(pl[1]);
  const pr = decl.match(/padding-right\s*:\s*([^;!]+)/); if (pr) R = px(pr[1]);
  return L === null && R === null ? null : Math.max(L || 0, R || 0);
}
/* 폰 덩이 가운데 «마지막» 규칙(뒤가 이긴다) · PC(덩이 밖) 규칙 — 선택자가 쉼표 묶음 안에 있어도 찾는다 */
function lastPhone(sel, declRe) {
  let hit = null;
  BLOCKS.filter((b) => maxW(b.q) !== null && maxW(b.q) <= 768).forEach((b) => rules(b.body).forEach((r) => { if (r.sel.split(',').map((s) => s.trim()).includes(sel) && (!declRe || declRe.test(r.decl))) hit = r.decl; }));
  return hit;
}
function pcRule(sel, declRe) {
  let hit = null;
  rules(TOP).forEach((r) => { if (r.sel.split(',').map((s) => s.trim()).includes(sel) && (!declRe || declRe.test(r.decl))) hit = r.decl; });
  return hit;
}
function narrower(sel) {
  const pc = pcRule(sel, /padding/), ph = lastPhone(sel, /padding/);
  assert.ok(pc && sidePad(pc) !== null, sel + ' PC 여백 규칙을 못 찾았습니다');
  assert.ok(ph && sidePad(ph) !== null, sel + ' 폰에서 양옆 여백을 줄이지 않았습니다 — 글이 화면 끝에서 멀리 떨어져 시작합니다');
  assert.ok(sidePad(ph) < sidePad(pc), sel + ' 폰 양옆 여백(' + sidePad(ph) + ')이 PC(' + sidePad(pc) + ')보다 작지 않습니다');
}

test('⑨ 양옆 빈자리 — 겉 여백은 PC 보다 작고, 상자 안 상자(사업 대시보드 칸·서류 패널·대시보드)는 걷는다', () => {
  ['main', '.toc'].forEach(narrower);
  const sec = lastPhone('.bizp section', /border/) || '';
  assert.match(sec, /border:\s*0/, '왼쪽 사업 대시보드 칸이 폰에서도 상자입니다 — 사업 카드가 상자 안 상자가 됩니다');
  assert.match(sec, /background:\s*transparent/);
  const docs = lastPhone('.docs', /border/) || '';
  assert.match(docs, /border-left:\s*0/, '서류 패널 옆 테두리를 걷지 않았습니다');
  assert.match(docs, /border-right:\s*0/);
  const dsh = lastPhone('.dsh', /border/) || '';
  assert.match(dsh, /border:\s*0/, '서류 패널 안 사업 대시보드가 또 상자입니다(숫자 칸까지 세 겹)');
  assert.match(dsh, /background:\s*transparent/);
  /* 걷은 상자들은 PC 에서는 그대로 상자다 */
  assert.match(pcRule('.docs', /border/) || '', /border:\s*1px/, 'PC 서류 패널 테두리가 사라졌습니다');
  assert.match(pcRule('.dsh', /border/) || '', /border:\s*1px/, 'PC 사업 대시보드 테두리가 사라졌습니다');
});
