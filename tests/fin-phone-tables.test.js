// 재무관리 폰 2단계 (대표 2026-10-25
// 「재무관리 대시보드 하나씩 클릭해서 폰화면에서 UI 이상한 거 모두 찾아라 — 메인 탭 모두 수정해라」)
// 규칙: ① 표는 «들어가면 줄이고(fit) · 안 들어가면 카드(card)» — 오른쪽 열이 상자 안에 숨지 않는다
//       ② 눌러 쓰는 달력표(matrix)는 카드로 접지 않는다 ③ 재무관리 폰에서만 돈다 ④ 줄·띠가 격자로 서서 «글자 크게»에도 안 흩어진다
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const JS = fs.readFileSync(path.join(ROOT, 'js', 'pu-fin-phone.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');
const HTML = stripComments(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const at = CSS.indexOf('재무관리 폰 2단계 — 표를 카드로');
assert.ok(at > 0, '2단계 블록이 없습니다');
const BLOCK = CSS.slice(at).replace(/\/\*[\s\S]*?\*\//g, '');

test('① ★ 표 처리 스크립트는 재무관리·폰에서만 돈다 — 넓은 화면·다른 앱은 하나도 안 바뀐다', () => {
  assert.match(JS, /max-width:640px/, '폰 폭 조건이 없습니다');
  assert.match(JS, /data-erp-group'\) === 'fin'/, '★★ 재무관리 한정이 아닙니다 — 다른 앱 표까지 카드가 됩니다');
  assert.match(JS, /closest\('\.ld-tb,\.ld-xt'\)/, '★ 자기 카드 배치가 있는 거래내역 표를 또 건드립니다');
  assert.match(HTML, /<script src="js\/pu-fin-phone\.js\?v=\d+"><\/script>/, '★ 이알피가 스크립트를 안 싣습니다');
});

test('② ★★ 표를 «지우거나 고치지 않는다» — 속성·클래스만 단다(원본 내용·클릭 그대로)', () => {
  const code = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // 주석은 뺀다(JS 파일이라 stripComments 가 아니다)
  assert.doesNotMatch(code, /innerHTML|textContent\s*=|removeChild|\.remove\(\)|appendChild|insertBefore/, '★★ 표 안의 내용을 건드립니다');
  assert.match(code, /setAttribute\('data-l'/); assert.match(code, /setAttribute\('data-pt'/);
});

test('③ ★ 순서는 fit → fit2 → card — 체크칸이 있는 «고르는 표»는 번호를 접지 않는다', () => {
  assert.match(JS, /'fit'[\s\S]{0,200}overflows\(table\)[\s\S]{0,300}input\[type=checkbox\][\s\S]{0,200}'fit2'[\s\S]{0,200}'card'/);
});

test('④ ★★ 달 열이 여섯 개 이상인 «눌러 쓰는 달력표»는 카드로 접지 않는다 — 접으면 칸이 흩어진다', () => {
  assert.match(JS, /\^\\d\{1,2\}월\$/);
  assert.match(JS, /months >= 6[\s\S]{0,400}'matrix'/);
  assert.match(BLOCK, /table\[data-pt="matrix"\] \.pt-key\{[^}]*position:sticky/, '이름 칸이 붙박이가 아닙니다');
});

test('⑤ ★ 카드 — 칸 이름을 값 위에 작게, 빈 칸을 지우지 않는다(눌러 쓰는 칸일 수 있다)', () => {
  assert.match(BLOCK, /table\[data-pt="card"\] td::before\{[^}]*content:attr\(data-l\)/);
  assert.doesNotMatch(BLOCK, /table\[data-pt="card"\] td:empty\{[^}]*display:none/, '★★ 빈 칸을 감춥니다 — 눌러 쓰는 칸이 사라질 수 있습니다');
  assert.match(BLOCK, /table\[data-pt="card"\] thead\{ display:none/);
});

test('⑥ ★ 모든 규칙은 폰(≤640px)·재무관리 안에서만', () => {
  const open = CSS.indexOf('@media (max-width:640px){', at);
  assert.ok(open > 0);
  const outside = CSS.slice(CSS.lastIndexOf('/*', at)).replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0, end = -1;
  for(let i = outside.indexOf('{', outside.indexOf('@media (max-width:640px)')); i < outside.length; i++){
    if(outside[i] === '{') depth++; else if(outside[i] === '}'){ depth--; if(!depth){ end = i; break; } }
  }
  assert.ok(end > 0 && outside.slice(end + 1).trim() === '', '★ 폭 조건 밖에 규칙이 있습니다');
  // 표 규칙은 재무관리 한정 선택자만
  (BLOCK.match(/[^{}]*main table\[data-pt[^{]*\{/g) || []).forEach((s) =>
    assert.match(s, /body\[data-erp-group="fin"\]/, '★ 재무 한정이 아닌 표 규칙: ' + s.trim().slice(0, 60)));
});

test('⑦ ★★ 출금관리 줄은 «격자» — 글자 크게(1.4배)에도 금액이 아래로 떨어지지 않는다', () => {
  const row = BLOCK.match(/\.fe-row\{([^}]*)\}/);
  assert.ok(row && /display:grid !important/.test(row[1]) && /grid-template-columns:18px minmax\(0,1fr\) auto/.test(row[1]), '★ flex 줄바꿈으로 돌아갔습니다');
  assert.match(BLOCK, /\.fe-row > \.fe-amt\{[^}]*grid-column:3;[^}]*grid-row:1/);
  ['fe-row', 'fe-mark', 'fe-date', 'fe-badge', 'fe-name', 'fe-amt', 'fe-btn'].forEach((c) =>
    assert.ok(HTML.includes("'" + c + "'"), '★ 출금 줄 마크업에 ' + c + ' 손잡이가 없습니다'));
});

test('⑧ ★ 출금관리 도구줄은 같은 폭 격자 · 월말 마감 단계는 번호·이름 / 상태·누가언제 / 보기·마감', () => {
  assert.match(BLOCK, /\.fx-tools\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(BLOCK, /\.fx-tools > input\{[^}]*grid-column:1 \/ -1/, '★ 검색이 줄 폭 전체가 아닙니다');
  assert.match(BLOCK, /\.mc-row\{[^}]*display:grid !important/);
  assert.match(BLOCK, /\.mc-row > \.mc-lock\{[^}]*width:auto !important/, '★ 마감 단추 폭이 74px 로 고정돼 보기와 어긋납니다');
  ['fx-tools', 'mc-row', 'mc-no', 'mc-name', 'mc-stat', 'mc-info', 'mc-view', 'mc-lock', 'mc-hint'].forEach((c) =>
    assert.ok(HTML.includes("'" + c + "'"), '★ 마크업에 ' + c + ' 손잡이가 없습니다'));
});

test('⑨ 🎤 단추가 목록 끝 줄을 덮지 않는다 — 작게·아래로 · 본문 맨 끝 여백', () => {
  assert.match(BLOCK, /body\[data-erp-group="fin"\] #erp-voice-btn\{[^}]*width:40px !important/);
  assert.match(BLOCK, /body\[data-erp-group="fin"\] main\{ padding-bottom:8\d?px; \}/);
});

test('⑩ 폰 점검 도구가 재무 화면·탭 스무 개를 그린다 — 다음에 고칠 때 눈으로 볼 수 있게', () => {
  const seed = fs.readFileSync(path.join(ROOT, 'tools', 'phone-audit', 'seeds', 'fin.js'), 'utf8');
  ['fin/ledger', 'ledger-exp', 'fin/income', 'income-list', 'income-case', 'income-co', 'expense-list', 'expense-add',
    'fin/pnl', 'pnl-cat', 'pnl-chart', 'fin/invoice', 'invoice-match', 'invoice-arc', 'fin/recv', 'fin/vat', 'fin/auto', 'auto-fail', 'auto-done', 'fin/close']
    .forEach((v) => assert.ok(seed.includes(v), '점검 도구에 ' + v + ' 화면이 없습니다'));
});
