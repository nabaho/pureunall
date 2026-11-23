'use strict';
/* 공용 모바일 통일 CSS(css/pu-phone.css) 계약 테스트 (2026-11-23)
   ① 모든 CSS 규칙은 @media (max-width <= 768px) 안에만 있어야 한다 (PC 1366px 무영향)
   ② 색은 저장소 공식 팔레트(PALETTE + #ffffff + #000000)만 쓴다
   ③ input/textarea 16px 미만 규칙 금지, #pu-version-fab 비간섭, overflow-x: clip 포함
   ④ 44개 대상 HTML 이 모두 <style> 및 pu-design.css 뒤에 같은 ?v= 로 싣는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PALETTE, colorsIn, norm } = require('./lib-palette');

const ROOT = path.join(__dirname, '..');
const CSS_PATH = path.join(ROOT, 'css', 'pu-phone.css');
const RAW_CSS = fs.readFileSync(CSS_PATH, 'utf8').replace(/\r\n/g, '\n');
const STRIPPED_CSS = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const ALLOWED_HEX = new Set(
  Object.values(PALETTE).flat().map(norm).concat(['#ffffff', '#000000'])
);

const TARGET_HTMLS = [
  'chwieop.html',
  'clinic-intake.html',
  'docs-esign.html',
  'enter.html',
  'fund.html',
  'gov.html',
  'gov-consulting.html',
  'gov-report.html',
  'hangul.html',
  'ieum-view.html',
  'ilteo.html',
  'install.html',
  'jobtrans.html',
  'kcareer.html',
  'payroll-os.html',
  'pu-alio-union.html',
  'pu-cal.html',
  'pu-camera.html',
  'pu-cards.html',
  'pu-datahub.html',
  'pu-deungi.html',
  'pu-edulib.html',
  'pu-erp.html',
  'pu-govaid.html',
  'pu-harass.html',
  'pu-home.html',
  'pu-news.html',
  'pu-orchestrator.html',
  'pu-paydata.html',
  'pu-pbox.html',
  'pu-photos.html',
  'pu-pubsearch.html',
  'pu-settle.html',
  'pu-signboard.html',
  'pu-viewer.html',
  'rehab-ad.html',
  'remember-intake.html',
  'rules.html',
  'rules-v2.html',
  'safety.html',
  'sign.html',
  'sign-contract.html',
  'sign-harass.html',
  'work.html',
];

function parseTopLevelAtBlocks(css) {
  const blocks = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;
    const brace = css.indexOf('{', i);
    assert.ok(brace > i, '여는 중괄호가 없는 최상위 구문: ' + css.slice(i, i + 60));
    const header = css.slice(i, brace).trim();
    let depth = 0;
    let j = brace;
    for (; j < n; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') {
        depth--;
        if (depth === 0) { j++; break; }
      }
    }
    assert.equal(depth, 0, '중괄호 짝이 맞지 않습니다: ' + header);
    blocks.push({ header, body: css.slice(brace + 1, j - 1) });
    i = j;
  }
  return blocks;
}

test('① css/pu-phone.css 의 모든 규칙은 @media (max-width <= 768px) 안에만 있다 (PC 무영향)', () => {
  const blocks = parseTopLevelAtBlocks(STRIPPED_CSS);
  assert.ok(blocks.length >= 1, '@media 블록이 최소 1개 있어야 합니다');
  for (const b of blocks) {
    assert.match(b.header, /^@media\b/, '최상위 규칙은 @media 여야 합니다: ' + b.header);
    const mw = b.header.match(/max-width\s*:\s*(\d+(?:\.\d+)?)px/i);
    assert.ok(mw, '@media 조건에 max-width(px) 가 없습니다: ' + b.header);
    assert.ok(Number(mw[1]) <= 768, 'max-width 가 768px 를 초과합니다: ' + b.header);
  }
});

test('② css/pu-phone.css 는 공식 27색 + #ffffff/#000000 팔레트만 사용한다', () => {
  const used = colorsIn(STRIPPED_CSS);
  const bad = used.filter(c => !ALLOWED_HEX.has(c));
  assert.deepEqual(bad, [], '팔레트 밖 색상 발견: ' + bad.join(', '));
});

test('③ iOS 확대 방지(input/textarea <16px 금지) · #pu-version-fab 비간섭 · overflow-x: clip 포함', () => {
  assert.doesNotMatch(STRIPPED_CSS, /#pu-version-fab\b/, '#pu-version-fab 스타일을 직접 건드리지 않습니다');
  assert.match(STRIPPED_CSS, /overflow-x\s*:\s*clip\b/, 'overflow-x: clip 규칙이 없습니다');

  // input / textarea 를 가리키는 선언 중 font-size < 16px 금지
  const innerRules = STRIPPED_CSS.match(/[^{}]+{[^{}]+}/g) || [];
  for (const r of innerRules) {
    const sel = r.slice(0, r.indexOf('{'));
    if (!/\b(input|textarea)\b/i.test(sel)) continue;
    const fsMatch = [...r.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)];
    for (const m of fsMatch) {
      assert.ok(Number(m[1]) >= 16, '모바일 input/textarea 글꼴 크기 16px 미만 금지: ' + r.trim());
    }
  }
});

test('④ 44개 대상 HTML 모두가 같은 ?v= 로 css/pu-phone.css 를 <style> 및 pu-design.css 뒤에 싣는다', () => {
  const vers = new Set();
  for (const rel of TARGET_HTMLS) {
    const full = path.join(ROOT, rel);
    assert.ok(fs.existsSync(full), '파일이 없습니다: ' + rel);
    const raw = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
    const headEnd = raw.indexOf('</head>');
    assert.ok(headEnd > 0, '</head> 를 찾지 못했습니다: ' + rel);
    const head = raw.slice(0, headEnd);

    const m = head.match(/<link\b[^>]*href=["']css\/pu-phone\.css\?v=(\d+)["'][^>]*>/);
    assert.ok(m, 'head 안에 css/pu-phone.css?v= 링크가 없습니다: ' + rel);
    vers.add(m[1]);
    const phoneAt = m.index;

    const lastStyleClose = head.lastIndexOf('</style>');
    if (lastStyleClose >= 0) {
      assert.ok(phoneAt > lastStyleClose, rel + ': </style> 뒤에 pu-phone.css 를 실어야 합니다');
    }
    const designIdx = head.indexOf('css/pu-design.css');
    if (designIdx >= 0) {
      assert.ok(phoneAt > designIdx, rel + ': css/pu-design.css 뒤에 pu-phone.css 를 실어야 합니다');
    }
  }
  assert.equal(vers.size, 1, 'HTML 마다 ?v= 버전이 다릅니다: ' + [...vers].join(', '));
});
