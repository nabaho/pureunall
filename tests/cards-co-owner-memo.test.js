/* ══════ 👤 담당 · 📝 메모 — 사람이 «직접 적는» 두 칸 (대표 지시 2026-09-12) ═══════
   대표: 「추천대로 해라」 — 기능 검토 보고의 ③④

   ■ 무엇이 없었나
   기업정보 26칸은 모두 «서류에서 읽어온» 값이다. 사람이 적을 자리가 하나도 없었다.
     ③ 담당 — 업체관리(푸른이알피)가 담당을 아는 곳은 거래처 300곳 남짓이다. 나머지
        3,800여 곳은 담당 칸이 영영 빈칸이라 「이 사업장 누가 보나」를 말을 못 했다.
     ④ 메모 — 명함·사업자등록증에는 있는데 회사에는 없었다.

   ★ 못 박는 것
     ① 업체관리가 아는 담당이 «이긴다» — 그쪽이 계약의 임자다.
     ②⚠⚠ 그래서 업체관리에 담당이 있으면 **아예 못 적게 막는다.** 적게 두면 저장은
        되는데 화면에는 안 나와 「적었는데 왜 안 보이지」가 된다 — 보이지 않는 값을
        쌓게 하는 것이 가장 나쁘다.
     ③ 어느 쪽에서 온 담당인지 화면이 «말한다»(✎). 안 그러면 「업체관리를 고쳤는데
        왜 안 바뀌지」가 된다. 색만으로 가르지 않는다 — 흑백 인쇄·색약에서 사라진다.
     ④ 표·정렬·거르개가 «같은 잣대»(coMgrOf)를 본다. 여기서 따로 읽으면 「칸에는
        이름이 있는데 그 이름으로 거르면 안 나온다」가 된다.
     ⑤ 담당은 «비어 있어도» 적는다 — 안 보이면 없는 것인지 화면이 빠뜨린 것인지 모른다.
     ⑥ 저장은 coInfo 의 «한 칸»만 건드린다. 빈 글자는 null 로 쓴다.
     ⑦ 메모 카드는 비어 있어도 «있다» — 숨기면 적을 길이 안 보인다.

   node --test tests/cards-co-owner-memo.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

function load(over) {
  const ctx = Object.assign({ console, Object, Array, String, Number, JSON,
    esc: s => String(s == null ? '' : s)
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])),
    _coCardOpen: { memo:false } }, over || {});
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(SRC, 'function coVal('), cutFn(SRC, 'function coMgrOf('),
    cutFn(SRC, 'function coMgrIsOurs('), cutFn(SRC, 'function coMgrCellHtml('),
    cutFn(SRC, 'function coCardHtml('), cutFn(SRC, 'function coMemoHtml(')
  ].join('\n'), ctx);
  return ctx;
}
const 회사 = (o) => Object.assign({ key:'k1', name:'신성컨트롤', erp:null, extra:{} }, o || {});

/* ── ①③ 어느 담당이 이기나 ───────────────────────────────────────────── */

test('★★★ 업체관리가 아는 담당이 «이긴다»', () => {
  const c = load();
  const o = 회사({ erp:{ main:'이상훈' }, extra:{ owner:'박재원' } });
  assert.equal(c.coMgrOf(o), '이상훈',
    '★★★ 여기 적은 값이 업체관리를 이기면 두 앱이 담당을 다르게 말한다');
  assert.equal(c.coMgrIsOurs(o), false);
});

test('★★★ 업체관리에 없으면 «우리가 적은» 담당으로 선다', () => {
  const c = load();
  const o = 회사({ erp:null, extra:{ owner:'박재원' } });
  assert.equal(c.coMgrOf(o), '박재원',
    '★★★ 거래처가 아닌 3,800여 곳은 이것이 유일한 담당이다');
  assert.equal(c.coMgrIsOurs(o), true);
});

test('★★ 업체관리 담당이 «빈 글자»면 우리 것이 선다 — 있는 척하는 빈칸에 지면 안 된다', () => {
  const c = load();
  assert.equal(c.coMgrOf(회사({ erp:{ main:'   ' }, extra:{ owner:'박재원' } })), '박재원');
  assert.equal(c.coMgrOf(회사({ erp:{}, extra:{ owner:'박재원' } })), '박재원');
});

test('★ 둘 다 없으면 빈 글자다 — 「없음」을 지어내지 않는다', () => {
  const c = load();
  assert.equal(c.coMgrOf(회사()), '');
  assert.equal(c.coMgrIsOurs(회사()), false);
});

test('★★★ 어느 쪽에서 온 담당인지 «표»가 말한다 — 색이 아니라 글자로', () => {
  const c = load();
  const ours = c.coMgrCellHtml(회사({ extra:{ owner:'박재원' } }));
  const erp  = c.coMgrCellHtml(회사({ erp:{ main:'이상훈' } }));
  assert.match(ours, /박재원/); assert.match(ours, /✎/,
    '★★★ 우리가 적은 담당인데 표가 아무 말이 없다 — 「업체관리를 고쳤는데 왜 안 바뀌지」가 된다');
  assert.match(erp, /이상훈/);
  assert.ok(!/✎/.test(erp), '★★ 업체관리 담당에까지 ✎ 가 붙었다');
  assert.equal(c.coMgrCellHtml(회사()), '', '★ 아무도 없는데 빈 표가 그려진다');
});

/* ── ④ 잣대가 한 곳인가 ───────────────────────────────────────────────── */

test('★★★ 표·정렬·거르개가 모두 coMgrOf 를 본다', () => {
  const sort = SRC.slice(SRC.indexOf('const CO_SORT'), SRC.indexOf('function coSorted'));
  assert.match(sort, /mgr:\s*o => coMgrOf\(o\)/,
    '★★★ 정렬이 제 잣대를 따로 두면 「칸에는 이름이 있는데 정렬에서는 빈칸으로 묶인다」');
  const list = cutFn(SRC, 'function coListHtml(');
  assert.match(list, /<td class="mgr">\$\{coMgrCellHtml\(o\)\}<\/td>/,
    '★★★ 표가 제 잣대를 따로 두면 거르개와 어긋난다');
  assert.match(cutFn(SRC, 'function coMgrCellHtml('), /coMgrOf\(o\)/);
});

/* ── ②⑥ 적는 길 ──────────────────────────────────────────────────────── */

function 세우기(o, 답) {
  const calls = { asked:null, wrote:null, toast:[] };
  const ctx = { console, Object, Array, String,
    coList: () => [o],
    coVal: (x, f) => String(((x && x.extra) || {})[f] || ''),
    prompt: (msg, cur) => { calls.asked = { msg:msg, cur:cur }; return 답; },
    toast: (m) => calls.toast.push(String(m)),
    ErpMatch: { staffNames: () => ['이상훈','박재원'] },
    coSaveInfoField: (k, f, v, msg) => { calls.wrote = { key:k, field:f, value:v, msg:msg }; } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function coAskOwner(') + '\n' + cutFn(SRC, 'function coAskMemo('), ctx);
  return { ctx, calls };
}
/* «실제로 눌러» 본다 — 세워만 두고 안 부르면 아무것도 확인하지 못한다 */
function 적기(o, 답){ const r = 세우기(o, 답); r.ctx.coAskOwner(o.key); return r; }
function 메모적기(o, 답){ const r = 세우기(o, 답); r.ctx.coAskMemo(o.key); return r; }

test('★★★ 업체관리에 담당이 있으면 «아예 못 적게» 막는다', () => {
  const r = 적기(회사({ erp:{ main:'이상훈' } }), '박재원');
  assert.equal(r.calls.wrote, null,
    '★★★ 저장은 되는데 화면에는 안 나온다 — 보이지 않는 값을 쌓게 하는 것이 가장 나쁘다');
  assert.equal(r.calls.asked, null, '★★ 물어보고 나서 안 된다고 하면 헛수고를 시킨 것이다');
  assert.ok(r.calls.toast.some(t => /업체관리/.test(t) && /이상훈/.test(t)),
    '★★ 어디서 바꾸는지 안 알려 주면 사람은 갈 곳을 잃는다');
});

test('★★★ 업체관리에 없으면 적어서 저장한다 — coInfo 의 한 칸만', () => {
  const r = 적기(회사({ extra:{ owner:'' } }), ' 박재원 ');
  assert.deepEqual({ key:r.calls.wrote.key, field:r.calls.wrote.field, value:r.calls.wrote.value },
    { key:'k1', field:'owner', value:'박재원' },
    '★★★ 앞뒤 공백을 안 떼면 「박재원」과 「 박재원」이 다른 사람이 된다');
});

test('★★ 취소하면 «아무것도» 안 쓴다 · 그대로면 서버를 안 만진다', () => {
  assert.equal(적기(회사(), null).calls.wrote, null, '★★ 취소했는데 썼다');
  assert.equal(적기(회사({ extra:{ owner:'박재원' } }), '박재원').calls.wrote, null,
    '★ 값이 같은데 서버를 만지면 구독이 헛돌고 화면이 깜빡인다');
});

test('★★ 비우면 담당을 «뗀다»', () => {
  const w = 적기(회사({ extra:{ owner:'박재원' } }), '').calls.wrote;
  assert.equal(w.value, '', '★★ 뗄 길이 없으면 잘못 적은 것을 못 지운다');
});

test('★★★ 메모는 «전 직원이 본다»고 말하고 적는다', () => {
  const r = 메모적기(회사(), '대표가 까다롭다');
  const w = r.calls.wrote;
  assert.equal(w.field, 'memo');
  assert.equal(w.value, '대표가 까다롭다');
  assert.match(r.calls.asked.msg, /전 직원/,
    '★★★ 모르고 적었다가 나중에 알면 사고다 — 명함첩이 이미 겪은 자리다');
});

test('★★ 빈 글자는 «null» 로 쓴다 — 적었다 지운 것과 원래 없는 것을 가르면 안 된다', () => {
  const fn = cutFn(SRC, 'function coSaveInfoField(');
  assert.match(fn, /\]:\s*value \|\| null/,
    '★★ \'\' 를 남기면 나중에 세는 곳마다 둘을 따로 다뤄야 한다');
  assert.match(fn, /coInfo\/' \+ key \+ '\/' \+ field/,
    '★★★ 통째로 쓰면 늦게 온 값이 날아간다 — 한 칸만 건드린다(coErpPin 과 같은 길)');
  assert.match(fn, /Store\.mode !== 'firebase'/, '★ 연결 안 된 곳에서 조용히 실패한다');
});

/* ── ⑤⑦ 화면에 «늘» 있다 ─────────────────────────────────────────────── */

test('★★ 담당은 «비어 있어도» 상세에 적는다', () => {
  const panel = cutFn(SRC, 'function coDetailPanelHtml(');
  assert.match(panel, /담당 없음/,
    '★★ 안 보이면 담당이 없는 것인지 화면이 빠뜨린 것인지 알 수 없다(명함 상세와 같은 규칙)');
  assert.match(panel, /coAskOwner\('\$\{k\}'\)/, '★★★ 눌러서 적을 길이 없다');
});

test('★★★ 메모 카드는 «비어 있어도» 뜬다 — 숨기면 적을 길이 안 보인다', () => {
  const c = load();
  const 빈것 = c.coMemoHtml(회사());
  assert.match(빈것, /📝 메모/, '★★★ 메모가 없다고 카드를 숨기면 적을 자리를 못 찾는다');
  assert.match(빈것, /메모 적기/);
  assert.match(빈것, /coAskMemo\('k1'\)/);
  const 있는것 = c.coMemoHtml(회사({ extra:{ memo:'대표가 까다롭다' } }));
  assert.match(있는것, /대표가 까다롭다/);
  assert.match(있는것, /고치기/, '★ 이미 있는데 「메모 적기」면 새로 쓰는 줄 안다');
});

test('★★ 메모의 줄바꿈이 살아 있고, 꺾쇠는 글자로 보인다', () => {
  const c = load();
  const h = c.coMemoHtml(회사({ extra:{ memo:'첫 줄\n둘째 줄 <b>굵게</b>' } }));
  assert.match(h, /첫 줄<br>둘째 줄/, '★★ 줄바꿈이 사라지면 적어 둔 것이 한 덩어리가 된다');
  assert.ok(!/<b>굵게<\/b>/.test(h), '★★★ 적은 글이 태그로 새면 화면이 깨진다');
});

test('★ 접힌 줄에 «무엇이 적혀 있는지» 한 마디가 보인다', () => {
  const c = load();
  assert.match(c.coMemoHtml(회사({ extra:{ memo:'대표가 까다롭다\n둘째 줄' } })), /대표가 까다롭다/);
  assert.match(c.coMemoHtml(회사()), /없음/, '★ 펴 보기 전에는 있는지조차 모른다');
});

test('★★ 상세 패널이 메모 카드를 «실제로» 내보낸다', () => {
  assert.match(cutFn(SRC, 'function coDetailPanelHtml('), /coMemoHtml\(o\)/,
    '★★★ 만들어 놓고 안 붙이면 소용없다');
  assert.match(SRC.slice(SRC.indexOf('let _coCardOpen')), /^let _coCardOpen = \{[^}]*memo:/,
    '★ 접기 자리에 memo 가 없으면 펴도 안 펴진다');
});
