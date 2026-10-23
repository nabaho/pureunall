'use strict';
/* 푸른이알피 폰 화면 (대표 지시 2026-10-18 「폰화면관리」) — 세 앱(이알피·인사관리·재무관리)이 함께 쓰는 머리줄·옆줄과
   이알피 화면(계약·업체·종료관리)을 폰 폭(360·411px)에서 «로그인한 채» 그려 재고 고친 것을 못 박는다.
   (재는 도구: tools/phone-audit · 자료: tools/phone-audit/seeds/erp.js)

   ⚠ «지금 값»(px·글자)이 아니라 «규칙»을 본다 — 폭을 몇 px 로 주든, 문구를 어떻게 고치든 통과한다.
   실행: node --test tests/erp-phone-screen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = stripJs(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* 폰 구간(768px 이하) 규칙만 모은다 — 넓은 화면 규칙과 섞어 보면 «폰에서만»을 증명할 수 없다 */
function blocks(css) {
  const out = [];
  const re = /@media\s*\(max-width:\s*(\d+)px\)/g;
  let m;
  while ((m = re.exec(css))) {
    if (+m[1] > 768) continue;
    let i = css.indexOf('{', m.index) + 1, d = 1;
    for (; i < css.length && d > 0; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push(css.slice(m.index, i));
  }
  return out;
}
const PHONE_BLOCKS = blocks(CSS);
const PHONE = PHONE_BLOCKS.join('\n');
const WIDE = PHONE_BLOCKS.reduce(function (w, b) { return w.replace(b, ''); }, CSS);
/* 함수 몸 하나 — 이름으로 찾아 괄호 짝까지 */
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
/* 규칙 하나(선택자 → 선언)를 찾는다 */
function rule(css, selRe) {
  const re = new RegExp(selRe.source + '\\s*\\{([^}]*)\\}', 'g');
  const all = []; let m;
  while ((m = re.exec(css))) all.push(m[1]);
  return all.join(';');
}

test('★ 접힌 옆줄은 그림자를 드리우지 않는다 — 모든 화면 왼쪽의 회색 띠', () => {
  /* 옆줄은 폰에서 화면 밖으로 밀어(translateX) 접는다. 그런데 그림자는 오른쪽으로 삐져나와
     닫혀 있어도 화면 왼쪽 가장자리를 늘 회색으로 칠했다(대표 화면 갈무리의 「왼쪽 띠」). */
  const sb = rule(PHONE, /(?:^|[\s,}])\.sb/);
  assert.match(sb, /box-shadow\s*:\s*(?!none)/, '이 검사의 전제(폰 옆줄에 그림자가 있다)가 바뀌었습니다');
  assert.match(rule(PHONE, /\.sb\.collapsed/), /box-shadow\s*:\s*none/,
    '★ 접힌 옆줄(.sb.collapsed)에 그림자가 남아 화면 왼쪽에 회색 띠가 생깁니다');
  assert.match(rule(PHONE, /\.sb\.collapsed/), /transform\s*:\s*translateX\(-100%\)/,
    '이 검사의 전제(폰에서 옆줄은 화면 밖으로 밀어 접는다)가 바뀌었습니다');
});

test('★ 「◀ 뒤로」는 폰에서 그림만 — 글자가 제목을 밀어내지 않는다', () => {
  const hd = fnBody('function Header(props)');
  const at = hd.indexOf('props.onBack && h(');
  assert.ok(at > 0, '뒤로 단추를 못 찾았습니다');
  const btn = hd.slice(at, hd.indexOf("h('div', { className:'hd-title' }", at));
  assert.match(btn, /h\('span',\s*\{\s*className:'hd-lbl'\s*\},\s*'\s*뒤로'\)/,
    '★ 「뒤로」 글자가 .hd-lbl 로 싸이지 않았습니다 — 폰에서 68px 이 제목을 0px 로 밀었습니다');
  assert.match(PHONE, /\.hd-lbl\s*\{[^}]*display\s*:\s*none/, '폰에서 글자를 접는 규칙이 없습니다');
  assert.match(WIDE, /\.hd-lbl\s*\{[^}]*display\s*:\s*inline/, '★ 넓은 화면에서는 「◀ 뒤로」 글자가 그대로 보여야 합니다');
  assert.match(btn, /className:'hd-back'/, '폰에서 여백을 줄일 손잡이가 없습니다');
  assert.match(rule(PHONE, /\.hd-back/), /padding/, '폰에서 뒤로 단추 여백을 줄이는 규칙이 없습니다');
});

test('★ 머리줄의 연결 표시 — «멀쩡할 때»만 폰에서 접고, 끊김·인증중은 보인다', () => {
  const fb = fnBody('function FirebaseStatus()');
  /* 접는 표(.hd-fb)는 연결·인증이 «둘 다» 된 때에만 붙어야 한다 — 끊김을 숨기면 안 된다 */
  const m = fb.match(/className:\s*\(([^)]*)\)\s*\?\s*'hd-fb'\s*:\s*''/);
  assert.ok(m, '★ 🟢 연결됨 상태에 .hd-fb 가 안 붙어 폰 머리줄에 늘 떠 제목을 밉니다');
  assert.match(m[1], /connected/); assert.match(m[1], /authed/);
  assert.match(m[1], /&&/, '★ 연결·인증 «둘 다» 일 때만 접어야 합니다 — 🔴 끊김 은 폰에서도 보여야 합니다');
  assert.match(PHONE, /\.hd-fb\s*\{[^}]*display\s*:\s*none/);
});

test('★ 월 이동줄 — 「2026년 10월」은 한 줄, 오른쪽 단추 묶음은 그 줄 안에서 민다(본문이 옆으로 안 구른다)', () => {
  const mk = fnBody('function MonthKpiHeader(props)');
  assert.match(mk, /className:'mkh-label'/, '달 글자에 손잡이가 없습니다');
  assert.match(rule(PHONE, /\.mkh-label/), /white-space\s*:\s*nowrap/, '★ 폰에서 「2026년 10 / 월」 로 꺾입니다');
  assert.match(mk, /h\('div',\s*\{\s*className:'mkh-extra'\s*\},\s*props\.extra\)/,
    '★ 오른쪽 단추 묶음이 감싸이지 않아 계약관리에서 본문 전체가 옆으로 굴렀습니다(498px/360px)');
  assert.match(mk, /!props\.kpiOwnRow\)\s*\?\s*h\('div',\s*\{\s*className:'mkh-extra'/,
    '★ 출금관리(kpiOwnRow)는 도구줄이 제 줄을 쓰며 접히는 설계라 감싸면 안 됩니다');
  const ph = rule(PHONE, /\.mkh-extra/);
  assert.match(ph, /overflow-x\s*:\s*auto/); assert.match(ph, /min-width\s*:\s*0/);
  assert.match(WIDE, /\.mkh-extra\s*\{[^}]*display\s*:\s*contents/,
    '★ 넓은 화면에서는 이 겹이 «없는 것»(display:contents)이어야 PC 자리가 안 바뀝니다');
});

/* 업체관리 폰 화면 — 카드 목록과 도구줄 (함수 안의 «폰 갈래»만 떼어 본다) */
const CO = fnBody('function CompanyManagement()');
/* ⚠ 주석은 걷혀 있다 — 코드 조각으로 자리를 찾는다 */
const CO_SEARCH = CO.indexOf("className:'dt-search', placeholder:'🔍 업체명");
assert.ok(CO_SEARCH > 0, '업체 폰 검색칸을 못 찾았습니다');
const CO_TOOLS_AT = CO.lastIndexOf('window.innerWidth <= 768', CO_SEARCH);
const CO_CARDS_AT = CO.indexOf('pg.paged.map(function(co, idx){', CO_SEARCH);
assert.ok(CO_TOOLS_AT > 0 && CO_CARDS_AT > CO_SEARCH, '업체 폰 갈래를 못 찾았습니다');
const CO_TOOLS = CO.slice(CO_TOOLS_AT, CO_CARDS_AT);
const CO_CARDS = (function () {
  const from = CO.lastIndexOf('window.innerWidth <= 768', CO_CARDS_AT);
  return CO.slice(from, CO.indexOf("h('table', { className: 'dt co-table'", CO_CARDS_AT));
})();
const CO_ROW1 = CO.slice(CO_TOOLS_AT, CO_SEARCH);

test('★★ 업체 폰 카드 — 맨 왼쪽 ☐ 고르기 + 번호 (자료 목록 규칙, 폰에서도 빼지 않는다)', () => {
  const box = CO_CARDS.indexOf("type:'checkbox'"), no = CO_CARDS.search(/coPageSize\s*\+\s*idx\s*\+\s*1/);
  assert.ok(box > 0, '★★ 폰 카드에 ☐ 가 없습니다 — 표에는 있는 고르기가 폰에서만 빠졌습니다');
  assert.ok(no > 0, '번호를 못 찾았습니다');
  assert.ok(box < no, '★ ☐ 가 번호보다 «왼쪽»에 와야 합니다');
  assert.match(CO_CARDS, /onChange:function\(\)\{\s*toggleSel\(co\.id\);\s*\}/, '☐ 가 표와 «같은 고르기»(toggleSel)를 써야 합니다');
  assert.match(CO_CARDS, /onClick:function\(e\)\{\s*e\.stopPropagation\(\);\s*\}/, '★ ☐ 를 누르는 손짓이 카드 열기로 새면 안 됩니다');
  /* 머리 ☐ = «지금 보이는 것» 모두 */
  assert.match(CO_TOOLS, /checked:\s*pg\.paged\.length\s*>\s*0\s*&&\s*pg\.paged\.every/, '★ 폰에 «보이는 것 모두 고르기»가 없습니다');
  assert.match(CO_TOOLS, /e\.target\.checked\s*\?\s*selectAll\(\)\s*:\s*clearSel\(\)/);
});

test('★ 고른 뒤 — 목록 위에 「N건 선택」과 할 수 있는 일, 고른 것이 있을 때만', () => {
  const at = CO_TOOLS.indexOf("selIds.size > 0 && h('div'");
  assert.ok(at > 0, '★ 고른 것이 있을 때만 뜨는 줄이 없습니다 — 고른 뒤 할 일이 도구줄 끝에 숨어 옆으로 밀어야 보였습니다');
  const row = CO_TOOLS.slice(at, at + 2500);
  assert.match(row, /selIds\.size\s*\+\s*'건 선택'/, '「N건 선택」이 없습니다');
  assert.match(row, /setBulkMgrModal\(true\)/, '할 수 있는 일(주담당 배정)이 그 줄에 없습니다');
  assert.match(row, /onClick:clearSel/, '고른 것을 푸는 단추가 그 줄에 없습니다');
});

test('★ 업체 폰 카드 — 업체명은 «한 줄»(넘치면 … + title), 세로 상자는 접히지 않는다', () => {
  const nm = CO_CARDS.match(/h\('span',\s*\{\s*title:co\.name[^}]*\}[^}]*\}\s*,\s*co\.name\)/);
  assert.ok(nm, '★ 업체명에 title(전문)이 없습니다 — 「…」로 잘린 이름을 볼 길이 없습니다');
  assert.match(nm[0], /whiteSpace:'nowrap'/, '★ 긴 업체명이 두 줄로 꺾여 카드마다 높아집니다(한 칸은 한 줄)');
  assert.match(nm[0], /textOverflow:'ellipsis'/); assert.match(nm[0], /minWidth:0/);
  /* 폰 공통 규칙([style*="display: flex"][style*="gap"]{flex-wrap:wrap})이 세로 상자를 접으면
     줄 폭이 «가장 긴 카드»로 정해져 카드가 화면보다 넓어진다(실측 434px · 화면 360px) */
  assert.match(CO_CARDS, /flexDirection:'column',\s*gap:'[^']+',\s*flexWrap:'nowrap'/,
    '★ 카드 세로 상자에 flexWrap:nowrap 이 없으면 한 줄로 둔 업체명이 카드를 화면 밖으로 넓힙니다');
  assert.match(CSS, /\[style\*="display: flex"\]\[style\*="gap"\]\s*\{\s*flex-wrap:\s*wrap/,
    '이 검사의 전제(폰에서 gap 있는 flex 를 접는 공통 규칙)가 바뀌었습니다 — nowrap 이 아직 필요한지 다시 보세요');
});

test('★ 업체 폰 도구줄 — 검색칸이 줄을 차지하고, 정리 도구는 «고르기 상자 하나»', () => {
  /* 2026-10-18 에는 도구 다섯을 한 줄 안에서 옆으로 밀게 했다. 2026-10-23 대표 지시 「좌우로 말고 드롭다운」 —
     옆으로 미는 줄을 없애고 도구를 고르기 상자 하나(🛠 도구)에 담았다. 검색칸은 남는 폭을 다 쓴다. */
  assert.doesNotMatch(CO_TOOLS, /overflowX:'auto'/, '★ 폰 도구줄을 다시 옆으로 밀게 했습니다 — 드롭다운으로 둡니다');
  assert.match(CO_TOOLS, /'🛠 도구'/, '정리 도구 고르기 상자가 없습니다');
  ['setMergeOpen(true)', 'doRepairSub', 'setLinkOpen(true)', 'setMisOpen(true)', 'setAddrOpen(true)', 'doVatAll', 'exportExcel']
    .forEach((fn) => assert.ok(CO_TOOLS.indexOf(fn) > 0, '★ 도구 「' + fn + '」 로 갈 길이 폰에서 사라졌습니다'));
  assert.match(CO_ROW1, /flex:'1 1 auto',\s*minWidth:0/, '★ 검색칸이 남는 폭을 안 씁니다');
});

test('★ 종료관리 폰 카드 — 그려 둔 조각을 글자로 이어 붙이지 않는다(「+ [object Object]」), 해제는 담당 줄 끝', () => {
  const cl = fnBody('function ClosedManagement()');
  assert.doesNotMatch(cl, /'\+ '\s*\+\s*row\.sub/, '★ row.sub 는 조각(vnode)이라 글자로 이으면 「[object Object]」가 찍힙니다');
  const at = cl.indexOf("'👤 '+(row.manager||'-')");
  assert.ok(at > 0, '담당 줄을 못 찾았습니다');
  const line = cl.slice(at, at + 600);
  assert.match(line, /row\.action\s*&&\s*h\('span',\s*\{\s*style:\{\s*marginLeft:'auto'/,
    '★ 「해제」가 제 줄을 따로 써 카드마다 한 줄씩 늘어납니다 — 담당 줄 오른쪽 끝에 둡니다');
  /* 카드 세로 상자가 폰 공통 규칙에 접히면 카드가 상자보다 넓어져 오른쪽이 잘린다(실측 326/292) */
  const mapAt = cl.indexOf('P.paged.map(function(row, idx){');
  const box = cl.slice(cl.lastIndexOf('window.innerWidth <= 768', mapAt), mapAt);
  assert.match(box, /flexDirection:'column',[^}]*flexWrap:'nowrap'/, '★ 종료관리 폰 카드 상자에 flexWrap:nowrap 이 없습니다');
});

test('계약 창 탭 — 폰에서 탭 글자가 두 줄로 꺾이지 않는다', () => {
  const at = SRC.indexOf('function tabBtn(v, label, icon)');
  assert.ok(at > 0);
  const tb = SRC.slice(at, at + 1200);
  assert.match(tb, /window\.innerWidth\s*<=\s*768/, '폰 갈래가 없습니다');
  assert.match(tb, /whiteSpace:'nowrap'[^}]*textOverflow:'ellipsis'/, '★ 「👤 담당자 · 일 / 지」 처럼 탭이 두 줄이 됩니다');
});
