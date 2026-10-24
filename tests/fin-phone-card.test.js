// 재무관리 폰 — «목록 카드 한 가지» 1단계 (대표 「시안대로」 2026-10-24)
// 「숫자가 줄이 안 맞거나 튀어나가거나 셀이 넘어가거나 엉망이다 — 재무관리 폰 UI 전체 정리」
// 규칙: ① 입금·출금 카드가 «같은 칸 틀»을 쓴다 ② ☐ 와 번호는 한 덩어리 ③ 금액은 고정 폭·오른쪽·숫자 폭 같게
//       ④ 입금 확인 시트의 단추는 모양이 같다 ⑤ 폰에만 건다(넓은 화면은 안 바뀐다)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');
const SRC = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const at = CSS.indexOf('재무관리 폰 — «목록 카드 한 가지»');
assert.ok(at > 0, '폰 목록 카드 블록이 없습니다');
const open = CSS.indexOf('@media (max-width:640px){', at);
let depth = 0, end = -1;
for(let i = CSS.indexOf('{', open); i < CSS.length; i++){ if(CSS[i] === '{') depth++; else if(CSS[i] === '}'){ depth--; if(!depth){ end = i; break; } } }
const BLOCK = CSS.slice(open, end + 1).replace(/\/\*[\s\S]*?\*\//g, '');
/* 같은 선택자가 여러 번 나오면 «마지막»이 이긴다 — 마지막 것을 본다 */
const rule = (sel) => {
  const re = new RegExp('(?:^|[}\\s])' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  let m, last = '';
  while((m = re.exec(BLOCK))) last = m[1];
  return last;
};

test('① ★ 입금 카드와 출금 카드가 «같은 칸 틀»을 쓴다 — 화면마다 따로 만들면 한 곳만 고쳐진다', () => {
  const tr = rule('.ld-tb tbody tr, .ld-xt tbody tr');
  assert.match(tr, /display:grid !important/, '★ 카드가 격자가 아닙니다');
  assert.match(tr, /grid-template-columns:\s*\d+px minmax\(0,1fr\) minmax\(\d+px,max-content\)/, '★ 왼쪽(☐·번호) · 가운데(이름) · 오른쪽(금액) 세 칸이 아닙니다');
});

test('② ★ ☐ 와 번호는 한 덩어리 — 같은 칸(1열)에 위아래로', () => {
  const chk = rule('.ld-tb .ld-c-chk, .ld-xt .ld-x-chk'), no = rule('.ld-tb .ld-c-no, .ld-xt .ld-x-no');
  assert.match(chk, /grid-column:1 !important/); assert.match(no, /grid-column:1 !important/);
  assert.match(no, /display:block !important/, '★ 번호가 폰에서 접혀 있습니다(대표 지시 2026-10-05: ☐ 다음에 번호)');
  assert.match(no, /grid-row:2 !important/);
});

test('③ ★★ 금액은 고정 폭 · 오른쪽 끝 · 숫자 폭 같게 · 줄바꿈 없음 — 그래야 자릿수가 위아래로 맞는다', () => {
  const amt = rule('.ld-tb .ld-c-amt, .ld-xt .ld-x-amt');
  assert.match(amt, /text-align:right !important/, '★ 금액이 오른쪽에 안 맞습니다');
  assert.match(amt, /font-variant-numeric:tabular-nums/, '★ 숫자 폭이 달라 자릿수가 어긋납니다');
  assert.match(amt, /white-space:nowrap !important/, '★ 금액이 접힙니다');
  assert.match(amt, /min-width:\s*(9\d|[1-9]\d\d)px/, '★ 금액 칸 폭이 없습니다');
});

test('④ ★ 이름은 «자르지 않고 두 줄까지 접는다» — 한 줄 …로 자르던 것이 「천안서북구(푸른노무」의 까닭', () => {
  assert.match(BLOCK, /-webkit-line-clamp:\s*2/, '★ 두 줄까지 접지 않습니다');
  assert.match(BLOCK, /\.ld-xt \.ld-x-memo > div > span:first-child\{[^}]*white-space:normal !important/);
});

test('⑤ ★ 출금 고르개는 줄 폭 전체 — 반쪽만 쓰고 오른쪽이 휑하던 것', () => {
  assert.match(rule('.ld-xt .ld-x-cat'), /grid-column:2 \/ 4 !important/);
  assert.match(rule('.ld-xt .ld-x-cat select'), /width:100% !important/);
});

test('⑥ ★ 입금 확인 시트 — 바닥 시트 · 단추는 둘이면 반반, 셋이면 위 둘·아래 하나(넓게)', () => {
  assert.match(rule('.ld-hs-bg'), /align-items:flex-end !important/, '★ 시트가 바닥에 안 붙습니다');
  const acts = rule('.ld-hs-acts');
  assert.match(acts, /grid-template-columns:1fr 1fr !important/);
  assert.match(rule('.ld-hs-acts > button:last-child:nth-child(odd)'), /grid-column:1 \/ -1/, '★ 단추가 셋일 때 마지막이 넓지 않습니다');
  assert.match(rule('.ld-hs-desc'), /-webkit-line-clamp:\s*2/, '★ 설명을 «…» 한 줄로 자릅니다');
  ['ld-hs-bg', 'ld-hs-sheet', 'ld-hs-card', 'ld-hs-l1', 'ld-hs-desc', 'ld-hs-acts'].forEach((c) =>
    assert.ok(SRC.includes("'" + c + "'"), '★ 시트 마크업에 ' + c + ' 손잡이가 없습니다'));
});

test('⑦ ★★ 폰(≤640px)에만 건다 — 넓은 화면은 하나도 안 바뀐다', () => {
  assert.match(CSS.slice(open, open + 30), /@media \(max-width:640px\)/);
  const outside = CSS.slice(CSS.lastIndexOf('/*', at)).replace(CSS.slice(open, end + 1), '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(outside, /\.ld-(tb|xt|hs)/, '★ 폭 조건 밖에 카드 규칙이 있습니다 — 넓은 화면이 바뀝니다');
});

test('⑧ 폰 점검 도구가 거래내역(입금·출금)을 그린다 — 다음에 고칠 때 눈으로 볼 수 있게', () => {
  const seed = fs.readFileSync(path.join(__dirname, '..', 'tools', 'phone-audit', 'seeds', 'fin.js'), 'utf8');
  assert.match(seed, /fin\/ledger/); assert.match(seed, /ledger-exp/);
});
