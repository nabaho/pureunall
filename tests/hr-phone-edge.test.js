'use strict';
/* 인사관리 폰 — 양옆 여백을 걷고 «한눈에» (대표 지시 2026-10-18)
   「인사관리 전체적으로 UI 다시 정리해달라. 양 끝에 화면 공백 안 둬도 되니까 좀 더 깔끔하고 한눈에 다 보이게
    모든 영역, 인사관리 전체의 모든 영역 UI 다시 검토해달라」
   재 보니 본문 상자(main) 24px + 흰 판(.page) 10px 이 겹쳐 폰 양옆이 34px 씩 비어 있었다(411px 의 1/6).
   급여 카드는 한 사람 95px(첫 화면에 넷), 근로자명부는 숫자 줄과 탭 줄이 같은 일을 두 줄에서 했다.
   (재는 도구: node tools/phone-audit/run.mjs hr · 기록: status/2026-10-18-hr-ui-cleanup.md)

   ⚠ «지금 값»(px)이 아니라 «규칙»을 본다. 실행: node --test tests/hr-phone-edge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const SRC = stripJs(RAW);
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');

/* 미디어 구간을 «폭 한도»와 함께 돌려준다 */
function mediaBlocks() {
  const out = [];
  const re = /@media\s*\(\s*max-width:\s*(\d+)px\s*\)/g;
  let m;
  while ((m = re.exec(CSS))) {
    let i = CSS.indexOf('{', m.index) + 1, d = 1;
    for (; i < CSS.length && d > 0; i++) { if (CSS[i] === '{') d++; else if (CSS[i] === '}') d--; }
    out.push({ max: +m[1], body: CSS.slice(m.index, i) });
  }
  return out;
}
const PHONE = mediaBlocks().filter(b => b.max <= 768).map(b => b.body).join('\n');
/* 미디어 구간 밖(= PC 에도 걸리는) 글 — 앱 표식 규칙이 여기 새면 PC 가 바뀐다 */
function outsideMedia() {
  let s = CSS;
  const re = /@media[^{]*\{/g;
  let m, out = '', last = 0;
  while ((m = re.exec(s))) {
    out += s.slice(last, m.index);
    let i = m.index + m[0].length, d = 1;
    for (; i < s.length && d > 0; i++) { if (s[i] === '{') d++; else if (s[i] === '}') d--; }
    last = i; re.lastIndex = i;
  }
  return out + s.slice(last);
}
function rule(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = PHONE.match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}
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
function px(v) { const m = String(v).match(/(\d+(?:\.\d+)?)px/); return m ? +m[1] : 0; }

test('★ 앱 표식 — <head> 첫 스크립트가 ?app= 앱을 html 에 단다 (그려지기 전에)', () => {
  const head = RAW.slice(0, RAW.indexOf('</head>'));
  assert.match(head, /document\.documentElement\.classList\.add\(\s*'pu-app-'\s*\+\s*a\s*\)/,
    '★ html 에 pu-app-<앱> 표식이 없으면 인사관리만 고른 폰 규칙이 안 걸립니다');
});

test('★ 인사관리 폰 — 바깥(main) 양옆 여백은 0, 흰 판 안쪽만 조금 · PC 에는 안 샌다', () => {
  const main = rule('html.pu-app-hr main.main');
  assert.ok(main, '★ 인사관리 폰에서 본문 상자(main) 여백을 걷는 규칙이 없습니다 — 양옆 24px 이 그대로 빕니다');
  const mp = main.match(/padding:\s*([^;!]+)/);
  assert.ok(mp, 'main 여백 선언을 못 찾았습니다');
  const parts = mp[1].trim().split(/\s+/);
  const side = parts.length >= 2 ? parts[1] : parts[0];
  assert.equal(px(side), 0, '★ 폰에서 main 양옆 여백이 남아 있습니다(«양 끝에 화면 공백 안 둬도 된다»)');

  const page = rule('html.pu-app-hr .page');
  assert.ok(page, '★ 인사관리 폰 흰 판(.page) 규칙이 없습니다');
  const pp = page.match(/padding:\s*([^;!]+)/)[1].trim().split(/\s+/);
  const pageSide = pp.length >= 2 ? pp[1] : pp[0];
  assert.ok(px(pageSide) > 0, '흰 판 안쪽 여백이 0 이면 글자가 화면 끝에 붙고 「즐겨찾기」 손잡이에 가립니다');
  assert.ok(px(pageSide) <= 16, '★ 흰 판 안쪽 여백이 예전(main 24 + 판 10)만큼 넓어지면 걷은 뜻이 없습니다');
  assert.match(page, /border-radius:\s*0/, '판을 화면 끝까지 펴면 둥근 모서리가 회색 틈을 남깁니다');

  assert.doesNotMatch(outsideMedia(), /pu-app-hr/, '★ 인사관리 표식 규칙이 폰 구간 밖에 있습니다 — PC 화면까지 바뀝니다');
});

test('★ 급여관리 폰 — 한 사람 «두 줄 카드»: 1줄 번호·이름·실지급 · 2줄 지급·공제·상태 (색 상자 셋 없음)', () => {
  const pl = fnBody('function PayrollLedger(props)');
  const at = pl.search(/IS_M\s*\n?\s*\?\s*h\('div', \{ style:\{ display:'flex', flexDirection:'column'/);
  assert.ok(at > 0, '이 검사의 전제(폰 카드 갈래)가 바뀌었습니다');
  const card = pl.slice(at, pl.indexOf(': h(\'div\', { ref:', at));
  assert.doesNotMatch(card, /flex:1, background:'#f0fdf4'[^]*?textAlign:'center'/,
    '★ 금액을 색 상자 셋(지급액·공제·실지급)에 다시 담았습니다 — 한 사람이 95px, 첫 화면에 넷이었습니다');
  const line1 = card.indexOf("'실지급 '"), line2 = card.indexOf("'지급 '");
  assert.ok(line1 > 0 && line2 > 0, '실지급·지급 글자를 못 찾았습니다');
  assert.ok(line1 < line2, '★ 실지급(핵심값)은 첫 줄에 — 둘째 줄 끝에 두면 천만 원대 셋이 360px 에 안 듭니다');
  assert.match(card, /idx\s*\+\s*1/, '★ 번호(보는 번호)가 빠졌습니다 — 목록 맨 왼쪽은 번호');
});

test('★ 급여관리 폰 — 숫자칸은 한 줄 칩, 지급 안내는 한 줄, 도구 묶음은 모자라면 다음 줄로', () => {
  const pl = fnBody('function PayrollLedger(props)');
  const k = pl.indexOf("label:'👥 대상', val:totals.count");
  assert.ok(k > 0, '폰 숫자칸을 못 찾았습니다');
  const chips = pl.slice(k, pl.indexOf(': h(\'div\', { style:{ display:\'grid\'', k));
  assert.doesNotMatch(chips, /h\('div', \{ style:\{ fontSize:'12px', color:k\.fg[^]*?h\('div'/,
    '★ 숫자칸이 다시 «이름 줄 + 값 줄» 두 줄 상자가 됐습니다');
  assert.match(chips, /whiteSpace:'nowrap'/, '칩 안 글자는 한 줄');

  /* 도구·확정 묶음 — 폰에서 flex 바탕이 0 이면 앞 줄 틈에 0px 로 끼어 앉아 「도구·확정」이 화면 밖으로 나간다 */
  const t = pl.indexOf('setToolsOpen(!toolsOpen)');
  assert.ok(t > 0, '도구 단추를 못 찾았습니다');
  const a = pl.lastIndexOf("h('div', { style:", t);
  const st = pl.slice(a, pl.indexOf('\n', a));
  assert.match(st, /flex:\s*IS_M\s*\?\s*'1 1 auto'/, '★ 폰에서 도구 묶음의 flex 바탕이 «제 내용 폭»이 아닙니다 — 화면 밖으로 밀립니다');

  const pm = fnBody('function PayrollManagement(props)');
  assert.match(pm, /flexWrap:\s*_pmM\s*\?\s*'nowrap'/, '★ 폰 지급 안내가 다시 두 줄로 꺾입니다');
  assert.match(pm, /title:\s*_pmM\s*\?\s*'화면의 월/, '폰에서 접은 설명은 title 로 남아야 합니다(말을 버리지 않는다)');
});

test('★ 근로자명부 폰 — 상태 탭에 숫자를 얹어 «한 줄» · 역할 칩은 다시 누르면 풀린다', () => {
  const sr = fnBody('function StaffRoster()');
  /* 폰 툴바 갈래 안에 옛 «재직/휴직/퇴직/전체» 숫자 없는 탭 묶음이 없어야 한다 */
  const tb = sr.indexOf("placeholder:'🔍 이름·사번·직책'");
  assert.ok(tb > 0, '폰 검색칸을 못 찾았습니다');
  const phone = sr.slice(tb, sr.indexOf("placeholder:'🔍 이름·사번·직책·연락처", tb));
  assert.doesNotMatch(phone, /\{v:'active',label:'재직'\},\{v:'leave'/, '★ 숫자 없는 상태 탭이 폰에 다시 생겼습니다 — 숫자 줄과 두 줄이 됩니다');
  ['activeCount', 'leaveCount', 'retiredCount', 'scheduledCount'].forEach(function (n) {
    assert.match(phone, new RegExp('n:' + n), '★ 폰 상태 칩에 ' + n + ' 숫자가 없습니다');
  });
  assert.match(phone, /setRoleTab\(on \? 'all' : t\.v\)/, '★ 역할 칩을 다시 눌러 풀 길이 없습니다(「전체」 칩을 뺐다)');
});

test('★ 휴가관리 폰 — 표는 폭을 채우고, 머리 오른쪽 묶음은 낱개로 꺾인다', () => {
  assert.match(SRC, /display:_lvM\?'table':undefined/,
    '★ 폰 공통 규칙(.page table → block)이 다섯 칸 표를 제 글자 폭으로 줄여 오른쪽이 빕니다');
  assert.match(SRC, /display:_lvM\?'contents':'flex'/,
    '★ 머리 오른쪽 묶음이 제 폭을 고집해 「재산정 미완료」가 판 밖에서 잘립니다');
});

test('성과관리 폰 — 확대 단추는 폰에서 접고(손가락으로 벌린다), 위 두 상자는 한 줄', () => {
  const pm = fnBody('function PerfManagement(props)');
  assert.match(pm, /!_pfM && h\('div',\{style:\{marginLeft:'auto'\}\}, zoomControl\(/, '★ 확대 단추가 폰에서 한 줄을 따로 먹습니다');
  assert.match(pm, /_pfM\?\{display:'flex',alignItems:'center',gap:'4px',overflowX:'auto'/, '★ 「퇴사자 제외」·「조회 전용」이 다시 세 줄이 됩니다');
  assert.match(pm, /:\{display:'contents'\}/, '넓은 화면은 겹을 없애 예전 그대로여야 합니다');
});

test('환경설정(인사관리 창) — 탭이 하나뿐이면 탭 줄을 접고, 「자동 저장」은 제목 줄에 띄운다', () => {
  assert.match(PHONE, /html\.pu-app-hr \.env-tabs-wrap:has\(\.env-tab:only-child\)\s*\{[^}]*display:\s*none/,
    '★ 탭 하나짜리 탭 줄이 바로 아래 제목과 같은 말을 한 줄 더 차지합니다');
  assert.match(SRC, /className:'env-save-row'/, '「자동 저장」 줄의 이름표(env-save-row)가 없습니다');
  const r = rule('html.pu-app-hr .env-save-row');
  assert.ok(r && /float:\s*right/.test(r), '★ 「자동 저장」이 한 줄을 따로 먹습니다');
});

test('증명서 폰 — 이름표+칸 «둘만» 든 줄은 이름표를 칸 왼쪽에 (한 칸 = 한 줄)', () => {
  /* 이름표가 «있는가»만 본다 — 다른 이름표와 함께 붙어도 된다(폰화면관리 양옆 정리의 m-box 와 같이 산다, 2026-10-18 합침) */
  assert.match(SRC, /className:'[^']*\bcert-form\b[^']*'/, '증명서 입력 상자 이름표(cert-form)가 없습니다');
  const m = PHONE.match(/html\.pu-app-hr \.cert-form div:has\(> label\[style\*="display: block"\]:first-child:nth-last-child\(2\)\)\s*\{([^}]*)\}/);
  assert.ok(m, '★ 이름표를 칸 왼쪽에 두는 규칙이 없습니다 — 입력 열 줄이 스무 줄이 됩니다');
  assert.match(m[1], /grid-template-columns:\s*\d+px\s+minmax\(0,\s*1fr\)/, '칸은 줄어들 수 있어야 합니다(minmax(0,1fr))');
  /* 이름표+칸 «둘만» — 고르기(체크) 줄·단추 줄까지 두 칸으로 가르면 깨진다 */
  assert.match(m[0], /:nth-last-child\(2\)/);
});
