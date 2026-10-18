'use strict';
/* 이알피·인사관리·재무관리 폰 «양옆 빈자리» (대표 지시 2026-10-18 「양옆 빈공백이 많다, 좌우 옆공간 모두 채워서 쓰게」)
   411px 폰에서 글이 화면 끝에서 37~81px 안쪽에서 시작했고 상자가 2~3겹이었다 — 본문 겉 여백(.main 24px) 위에
   흰 판(.page 둥근 상자 + 안 여백), 그 안에 칸·카드 상자가 겹겹이 쌓였다.
   (재는 도구: tools/phone-audit — 줄 끝 «양옆 L/R·겹»)

   ⚠ «지금 값»(px)을 박지 않는다 — 「폰 여백이 넓은 화면보다 작은가」「안쪽 상자를 걷었는가」 같은 «규칙»을 본다.
   실행: node --test tests/erp-phone-edge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = stripJs(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* 폰 구간(768px 이하) 블록과 그 밖(넓은 화면)을 가른다 — 인쇄(@media print) 블록은 넓은 화면 쪽에서 뺀다 */
function mediaBlocks(pred) {
  const out = [];
  const re = /@media[^{]*\{/g;
  let m;
  while ((m = re.exec(CSS))) {
    let i = m.index + m[0].length, d = 1;
    for (; i < CSS.length && d > 0; i++) { if (CSS[i] === '{') d++; else if (CSS[i] === '}') d--; }
    if (pred(m[0])) out.push(CSS.slice(m.index, i));
    re.lastIndex = i;
  }
  return out;
}
const PHONE = mediaBlocks(function (h) { const w = h.match(/max-width:\s*(\d+)px/); return !!w && +w[1] <= 768; }).join('\n');
const WIDE = mediaBlocks(function () { return true; }).reduce(function (w, b) { return w.replace(b, ''); }, CSS);

/* 선택자 하나의 선언을 모은다(나중 것이 이긴다) */
function decls(css, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[\\s,}])' + esc + '\\s*\\{([^}]*)\\}', 'g');
  const o = {}; let m;
  while ((m = re.exec(css))) {
    m[2].split(';').forEach(function (d) {
      const k = d.split(':')[0].trim(); if (!k) return;
      o[k] = d.slice(d.indexOf(':') + 1).replace(/!important/, '').trim();
    });
  }
  return o;
}
/* padding 줄임꼴에서 왼쪽·오른쪽 px */
function sidePad(v) {
  if (v == null || !String(v).trim()) return null;      // 규칙이 없으면 «0» 이 아니라 «없음»
  const p = String(v).trim().split(/\s+/).map(function (x) { return parseFloat(x) || 0; });
  const right = p.length === 1 ? p[0] : p[1];
  const left = p.length === 4 ? p[3] : right;
  return { left: left, right: right };
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

test('★★ 본문 겉 여백 — 폰에서는 넓은 화면보다 «작다»', () => {
  const pc = sidePad(decls(WIDE, '.main').padding), ph = sidePad(decls(PHONE, '.main').padding);
  assert.ok(pc && pc.left > 0, '이 검사의 전제(넓은 화면 본문 여백)가 바뀌었습니다');
  assert.ok(ph, '★★ 폰 구간에 .main 여백 규칙이 없습니다 — 넓은 화면 여백(24px)이 폰에서도 그대로 화면 양옆을 먹습니다');
  assert.ok(ph.left < pc.left && ph.right < pc.right, '★★ 폰 본문 겉 여백이 넓은 화면보다 작지 않습니다');
});

test('★★ 흰 판(.page) — 폰에서는 «상자»가 아니라 바닥: 둥근 모서리·흰 바탕을 걷고 안 여백도 넓은 화면보다 작다', () => {
  const pcP = sidePad(decls(WIDE, '.page').padding), ph = decls(PHONE, '.page');
  assert.ok(pcP && pcP.left > 0, '이 검사의 전제(넓은 화면 .page 안 여백)가 바뀌었습니다');
  assert.match(decls(WIDE, '.page').background || '', /#fff/, '이 검사의 전제(넓은 화면 흰 판)가 바뀌었습니다');
  const phP = sidePad(ph.padding);
  assert.ok(phP && phP.left < pcP.left && phP.right < pcP.right, '★★ 폰 .page 안 여백이 넓은 화면보다 작지 않습니다');
  assert.match(ph.background || '', /transparent|none/, '★★ 폰에서 흰 판이 남으면 그 안의 카드가 «상자 안 상자»(겹 2)가 됩니다');
  assert.match(ph['border-radius'] || '', /^0/, '폰에서 판 둥근 모서리가 남았습니다');
});

test('★ 창(모달)은 폰에서 화면 폭 그대로', () => {
  const md = decls(PHONE, '.modal');
  assert.match(md.width || '', /^100vw/, '★ 폰 창이 화면 폭보다 좁습니다(양옆이 빕니다)');
  assert.match(md['max-width'] || '', /^100vw/);
});

test('★ 판 여백을 줄였으면 «판 끝까지 펴던» 음수 여백도 같이 줄인다 — 안 그러면 본문이 옆으로 구른다', () => {
  const page = sidePad(decls(PHONE, '.page').padding);
  const tabs = decls(PHONE, '.env-tabs-wrap');
  const mg = sidePad(tabs.margin);
  assert.ok(mg, '★ 폰에 환경설정 탭띠 여백 규칙이 없습니다 — 넓은 화면 음수 여백(-16px)이 판 여백보다 커서 띠가 화면 밖으로 나갑니다');
  assert.ok(Math.abs(mg.left) <= page.left && Math.abs(mg.right) <= page.right,
    '★ 탭띠 음수 여백(' + tabs.margin + ')이 판 안 여백보다 큽니다 — 띠가 화면 밖으로 나갑니다');
});

test('★★ 폰 목록 카드는 한 벌(m-card)로 안 여백을 줄인다 — 업체·사건·컨설팅/기금/기타·종료', () => {
  const card = decls(PHONE, '.m-card');
  assert.ok(card['padding-left'] && card['padding-right'], '★★ 폰 카드 안 여백을 줄이는 규칙이 없습니다');
  ['function CompanyManagement()', 'function CaseManagement(props)', 'function ProjectManagementShared(props)', 'function ClosedManagement()'].forEach(function (f) {
    assert.match(fnBody(f), /className:'m-card'/, '★★ ' + f + ' 의 폰 카드에 m-card 가 없습니다 — 카드 안 여백이 그대로 남아 글이 화면 끝에서 멀어집니다');
  });
  /* m-card 는 «폰 갈래» 카드에만 — 넓은 화면 표에는 붙지 않는다(넓은 화면은 규칙이 없어 상관없지만, 뜻이 흐려진다) */
  assert.doesNotMatch(WIDE, /\.m-card\s*\{/, '★ m-card 규칙이 넓은 화면에도 있습니다');
});

test('★ 계약관리 칸반 — 폰에서는 칸 상자를 걷어 «상자 안 상자»를 없앤다', () => {
  const cm = fnBody('function ContractManagement(props)');
  const at = cm.indexOf("onDrop:onDrop(s.v),");
  assert.ok(at > 0, '칸반 칸을 못 찾았습니다');
  const st = cm.slice(at, at + 700);
  assert.match(st, /background:\s*isOver\s*\?\s*s\.bg\s*:\s*\(window\.innerWidth\s*<=\s*768\s*\?\s*'transparent'/,
    '★ 폰에서 칸(회색 상자)이 남아 카드가 상자 안 상자(겹 3)가 됩니다');
  assert.match(st, /border:\s*isOver[^,]*:\s*\(window\.innerWidth\s*<=\s*768\s*\?\s*'none'/, '★ 폰에서 칸 테두리가 남았습니다');
});

test('★ 월말 마감·휴가 표·거래내역 — 폰에서 바깥 상자의 «양옆» 테두리를 걷는다(줄 바탕이 이미 줄을 가른다)', () => {
  const mc = fnBody('function MonthClose(props)');
  assert.match(mc, /window\.innerWidth\s*<=\s*768\s*\n?\s*\?\s*\{\s*borderTop:[^}]*borderBottom:[^}]*\}/,
    '★ 월말 마감: 폰에서 바깥 상자의 옆 테두리가 남아 단계 줄이 상자 안 상자(겹 3)가 됩니다');
  const lv = fnBody('function LeaveManagement()');
  assert.match(lv, /style:_lvM\s*\?\s*\{\s*borderTop:[^}]*borderBottom:[^}]*\}\s*:/, '★ 휴가 표: 폰에서 옆 테두리가 남았습니다');
  assert.match(lv, /display:_lvM\?'table':undefined/, '★ 휴가 표가 폰에서 글자 폭으로 줄어 오른쪽이 비었습니다');
  const fl = fnBody('function FinanceLedger(props)');
  assert.match(fl, /var _ldBox=\{[\s\S]{0,300}?border:\s*window\.innerWidth\s*<=\s*768\s*\?\s*'0'/, '★ 거래내역: 폰에서 표 상자 테두리가 남았습니다');
});

test('★ .page 밖에 서는 화면 — 본문 겉 여백을 걷었으니 «제 여백»이 화면 끝 여백이다(폰에서 넓은 화면보다 작게)', () => {
  [['function FinanceAuto(props)', /return h\('div', \{ style:\{ padding: window\.innerWidth <= 768 \? '(\d+)px' : '(\d+)px' \} \}/],
   ['function PerfManagement(props)', /return h\('div',\{style:\{padding:window\.innerWidth<=768\?'(\d+)px':'(\d+)px'\}\}/],
   ['function FinanceLedger(props)', /return h\('div',\{style:\{padding: window\.innerWidth <= 768 \? '0 (\d+)px' : '0 (\d+)px'\}\}/]
  ].forEach(function (x) {
    const m = fnBody(x[0]).match(x[1]);
    assert.ok(m, '★ ' + x[0] + ' 뿌리에 폰 여백 갈래가 없습니다');
    assert.ok(+m[1] <= sidePad(decls(PHONE, '.page').padding).left + 1,
      '★ ' + x[0] + ' 폰 여백이 다른 화면(.page)보다 넓습니다');
  });
  assert.ok(decls(PHONE, '.fin-pnl').padding, '★ 손익계산서(.page 밖) 폰 여백 규칙이 없습니다');
});
