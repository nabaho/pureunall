'use strict';
/* AI 판독 이번 달 «돈» 한도 — 세 자리가 같은 답을 내는가 (대표 결정 2026-09-10)
   실행: node --test tests/ai-spend-cap.test.js

     「한도금액제한을 두게 할 수 있나 그리고 일정금액 얼만큼 사용되고 있는지
       여기 화면에 보이게 할 수 있나」 → 「3만원으로 하고 만약 25000원 넘으면 경고」

   ★ 이 기능의 급소는 «어긋남»이다 —
     화면이 「아직 남았습니다」라고 적는데 서버가 막으면, 누른 사람은 자기가 뭘
     잘못한 줄 안다. 반대로 화면만 막고 서버가 안 막으면 한도는 없는 것과 같다.
     그래서 셈은 **한 곳**(js/pu-billing.js 의 aiSummarize)에 두고, 서버
     (functions/doc-read.js)와 «나란히 세워» 같은 답인지 여기서 견준다.

   ⚠ 30,000 · 25,000 · 4 는 «값 자체가 규칙»이다 — 대표가 정한 금액이다
     (검사고정-허용). 바꾸려면 대표에게 다시 물어야 한다.
   ⚠ 0 은 «끔»이다. 한도 0 을 「0원까지만 쓴다」로 읽어 통째로 막으면 안 된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');
const { stripJs, stripComments } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const DR = require(path.join(R, 'functions', 'doc-read.js'));
const IDX = stripJs(fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8'));
const BILL_SRC = fs.readFileSync(path.join(R, 'js', 'pu-billing.js'), 'utf8');
const PHOTOS = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const PHOTOS_JS = stripComments(PHOTOS);
const ENTER = fs.readFileSync(path.join(R, 'enter.html'), 'utf8');
const ENTER_JS = stripComments(ENTER);
const RULES = stripJs(fs.readFileSync(path.join(R, 'scripts', 'make-firebase-rules.js'), 'utf8'));

/* 화면 쪽 셈을 진짜 파일에서 그대로 싣는다 — 베껴 적으면 견주는 뜻이 없다 */
function loadBilling() {
  const box = { window: undefined };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(BILL_SRC, box);
  return box.PuBilling;
}
const PB = loadBilling();

const 셈 = (n) => ({ _all: { n: n } });

/* 다른 realm(vm) 에서 온 객체는 deepStrictEqual 이 «모양이 같아도» 다르다고 한다 —
   이 저장소에서 여러 번 헛걸음한 자리라 칸을 하나씩 견준다. */
function 같은설정(a, b, msg) {
  ['limit', 'warn', 'wonPerRead'].forEach((k) => assert.equal(a[k], b[k], msg + ' (' + k + ')'));
}

/* readDoc 은 `exports.readDoc = functions…` 꼴이라 cutFn 의 「function 이름(」 으로는
   못 잡는다. 다음 exports 앞까지를 그 함수로 본다. */
function cutExport(src, name) {
  const at = src.indexOf('exports.' + name + ' =');
  assert.ok(at > 0, '★ ' + name + ' 을 찾지 못했습니다 — 이름이 바뀌었나요?');
  const next = src.indexOf('\nexports.', at + 5);
  return src.slice(at, next > 0 ? next : src.length);
}

/* ══════ ① 대표가 정한 숫자 ═════════════════════════════════════════════ */

test('한도 ₩30,000 · 경고 ₩25,000 (검사고정-허용 — 대표가 정한 금액)', () => {
  assert.deepEqual(DR.AI_BUDGET_DEFAULT, { limit: 30000, warn: 25000, wonPerRead: 4 });
  같은설정(PB.AI_BUDGET_DEFAULT, DR.AI_BUDGET_DEFAULT,
    '★ 서버와 화면의 기본 한도가 다릅니다 — 설정을 안 만든 회사에서 둘이 딴말을 합니다');
});

test('경고선이 한도보다 «낮다» — 넘기 전에 알려야 뜻이 있다', () => {
  assert.ok(DR.AI_BUDGET_DEFAULT.warn < DR.AI_BUDGET_DEFAULT.limit,
    '★ 경고선이 한도보다 높으면 경고가 영영 안 뜹니다(넘는 순간 이미 막힙니다)');
});

/* ══════ ② 서버와 화면이 같은 답을 내는가 — 이 검사의 핵심 ═══════════════ */

test('★ 서버·화면이 «같은 금액»을 낸다 (0장부터 한도 언저리까지)', () => {
  [0, 1, 310, 6249, 6250, 7499, 7500, 7501, 99999].forEach((n) => {
    const 서버 = DR.aiSpentWon(n, DR.aiBudgetOf(null).wonPerRead);
    const 화면 = PB.aiSummarize(null, 셈(n)).spent;
    assert.equal(화면, 서버, '★ 판독 ' + n + '번에서 화면 ₩' + 화면 + ' · 서버 ₩' + 서버
      + ' — 갈라졌습니다. 화면은 「남았다」는데 서버가 막습니다');
  });
});

test('★ 막는 «문턱»도 같다 — 같은 부등호(>=)를 써야 한 장 차이로 안 어긋난다', () => {
  const b = DR.aiBudgetOf(null);
  [6250, 7499, 7500, 7501].forEach((n) => {
    const 서버막나 = b.limit > 0 && DR.aiSpentWon(n, b.wonPerRead) >= b.limit;
    const 화면막나 = PB.aiSummarize(null, 셈(n)).over;
    assert.equal(화면막나, 서버막나,
      '★ 판독 ' + n + '번에서 막는 판단이 갈라집니다');
  });
  /* 딱 맞아떨어지는 자리(₩30,000)는 «막는 쪽»이다 — 넘어야 막으면 한도가 한 장씩 샌다 */
  assert.equal(PB.aiSummarize(null, 셈(7500)).over, true,
    '★ 딱 한도에 닿은 순간을 안 막고 있습니다');
});

test('세 갈래(평소·경고·중단)가 대표가 말한 자리에서 갈린다', () => {
  const 상태 = (n) => PB.aiSummarize(null, 셈(n)).tone;
  assert.equal(상태(6249), 'ok');       // ₩24,996
  assert.equal(상태(6250), 'warn');     // ₩25,000 — 경고
  assert.equal(상태(7499), 'warn');     // ₩29,996
  assert.equal(상태(7500), 'over');     // ₩30,000 — 중단
});

/* ══════ ③ 「모른다」와 「0원」을 가른다 ═════════════════════════════════ */

test('★ 셈을 못 읽었으면 ₩0 이 아니라 «모른다»다', () => {
  [null, undefined, {}, { _all: {} }].forEach((v) => {
    const s = PB.aiSummarize(null, v);
    assert.equal(s.has, false,
      '★ 못 읽은 것을 「0원」으로 적으면, 다 쓴 달이 「아직 안 썼다」로 보입니다');
    assert.equal(s.spent, null);
    assert.equal(s.over, false, '모를 때는 막지 않는다 — 막는 것은 서버가 한다');
  });
  assert.equal(PB.aiSummarize(null, 셈(0)).has, true, '진짜 0장은 «읽은 것»이다');
});

test('설정이 없거나 망가졌으면 기본 한도로 물러선다 (0 으로 채우지 않는다)', () => {
  [null, undefined, 'x', { limit: 'abc' }, { limit: -5 }].forEach((raw) => {
    같은설정(PB.aiBudgetOf(raw), PB.AI_BUDGET_DEFAULT,
      '★ 망가진 설정을 0 으로 읽으면 「한도 0원」이 되어 판독이 통째로 막힙니다');
    assert.deepEqual(DR.aiBudgetOf(raw), DR.AI_BUDGET_DEFAULT);
  });
});

test('★ 한도 0 은 «끔»이다 — 아무것도 막지 않는다', () => {
  const s = PB.aiSummarize({ limit: 0, warn: 0, wonPerRead: 4 }, 셈(100000));
  assert.equal(s.over, false, '★ 한도 0 을 「0원까지」로 읽어 통째로 막고 있습니다');
  assert.equal(s.near, false);
  assert.equal(s.spent, 400000, '막지 않아도 금액은 그대로 센다');
});

test('설정을 바꾸면 서버·화면이 «함께» 따라온다', () => {
  const 설정 = { limit: 5000, warn: 3000, wonPerRead: 10 };
  const s = PB.aiSummarize(설정, 셈(400));
  assert.equal(s.spent, DR.aiSpentWon(400, DR.aiBudgetOf(설정).wonPerRead));
  assert.equal(s.spent, 4000);
  assert.equal(s.near, true);
  assert.equal(s.over, false);
});

/* ══════ ④ 달은 «한국 날짜»로 — 서버와 같은 칸을 봐야 한다 ═══════════════ */

test('★ 포털이 보는 달 칸이 서버가 적는 달 칸과 같다', () => {
  [Date.parse('2026-09-08T20:00:00Z'), Date.parse('2026-09-30T20:00:00Z'),
   Date.parse('2026-01-01T03:00:00Z')].forEach((t) => {
    assert.equal(PB.aiYm(t), DR.ymKST(t),
      '★ 화면과 서버가 다른 달을 보고 있습니다 — 월초·월말에 숫자가 어긋납니다');
    assert.equal(DR.aiMonthPath(t), 'ai_read_tally/' + PB.aiYm(t) + '/_all/n');
  });
});

test('★ 서버가 판독할 때마다 «달 자리»에도 적는다 — 안 적으면 셀 숫자가 없다', () => {
  const 길 = DR.tallyPaths('photos', '2026-09-10', 'n');
  assert.ok(길.includes(DR.aiMonthPath(Date.parse('2026-09-10T03:00:00Z'))),
    '★ 달 자리를 안 올립니다 — 이번 달 얼마 썼는지 아무도 모르게 됩니다');
  /* 한도에 걸린 것(quota)은 안 센다 — 못 읽은 것에 요금을 매기면 안 된다 */
  assert.ok(!DR.tallyPaths('photos', '2026-09-10', 'quota')
    .some((p) => /\/_all\/quota$/.test(p) && p.length < 30),
    '실패 셈이 달 자리로 새면 안 된다');
  assert.ok(!DR.tallyPaths('photos', '2026-09-10', 'quota').includes(DR.aiMonthPath(Date.now())));
});

/* ══════ ⑤ 서버가 진짜로 막는가 ═════════════════════════════════════════ */

test('★ readDoc 은 한도를 넘으면 막는다 — 화면 말고 «서버»가 막아야 뜻이 있다', () => {
  assert.match(IDX, /aiMonthSpend/, '★ 서버에 한도 판단이 아예 없습니다');
  const fn = cutExport(IDX, 'readDoc');
  assert.match(fn, /over\b/, '★ readDoc 이 한도를 안 본다면 화면만 막는 시늉입니다');
  assert.match(fn, /429/, '★ 한도를 넘었을 때 돌려주는 값이 없습니다');
});

test('★ 사람이 누른 것(manual)은 «막지 않는다» — 급한 서류를 세울 수 없다', () => {
  const fn = cutExport(IDX, 'readDoc');
  assert.match(fn, /!\s*body\.manual/,
    '★ 사람이 눌러도 막고 있습니다 — 대표 결정은 「알려 주고 그대로 해 준다」였습니다');
  /* 「사람이 눌렀다」가 실제로 몸통에 실려야 서버가 가릴 수 있다 */
  const 물음 = cutFn(fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8'),
    'function askProxy(');
  assert.match(물음, /manual/,
    '★ 화면이 「사람이 눌렀다」를 안 보냅니다 — 서버는 전부 자동으로 봅니다');
});

test('★ 한도를 «못 읽었을 때»는 안 막는다 — Vision(무료 몫)과 일부러 반대다', () => {
  const fn = cutFn(IDX, 'async function aiMonthSpend(');
  assert.match(fn, /known/, '★ 「알아냈나」를 안 가리면 못 읽은 것이 곧 차단이 됩니다');
  const 부름 = cutExport(IDX, 'readDoc');
  assert.match(부름, /known\s*&&/,
    '★ 못 읽었는데 막으면, 규칙 한 줄이 빠진 날 판독이 통째로 멎습니다');
});

/* ══════ ⑥ 설정은 총괄 관리자만 고친다 ═══════════════════════════════════ */

test('★ 한도 설정은 «관리자만» 쓴다 — 아무나 한도를 올리면 한도가 아니다', () => {
  const at = RULES.indexOf('rules.ai_read_budget');
  assert.ok(at > 0, '★ 서버 규칙에 한도 자리가 없습니다 — 저장이 조용히 실패합니다');
  const 몸 = RULES.slice(at, at + 700);
  assert.match(몸, /'\.write'[^\n]*ADMIN|\$\{ADMIN\}/,
    '★ 쓰기를 관리자로 안 막았습니다');
  assert.match(몸, /'\.read'/, '★ 읽기를 안 열면 화면이 한도를 못 읽습니다');
  assert.match(몸, /\$other[\s\S]{0,80}'\.validate':\s*false/,
    '★ 모르는 칸을 막지 않으면 아무 값이나 쌓입니다');
});

test('설정 저장 길이 실제로 있다 (화면 → 저장소 → 서버 자리)', () => {
  const store = fs.readFileSync(path.join(R, 'js', 'pu-photo-store.js'), 'utf8');
  assert.match(store, /function setAiBudget/);
  assert.match(store, new RegExp("ref\\('" + 'ai_read_budget' + "'\\)"),
    '★ 저장 자리가 서버·규칙이 보는 자리와 달라 값이 영영 안 읽힙니다');
  assert.equal(DR.AI_BUDGET_PATH, 'ai_read_budget');
  assert.equal(PB.AI_BUDGET_ROOT, DR.AI_BUDGET_PATH,
    '★ 포털이 다른 자리를 보고 있습니다');
});

/* ══════ ⑦ 사진첩 화면 ═══════════════════════════════════════════════════ */

test('★ 사진첩이 계산식을 «다시 적지» 않는다 — 부르기만 한다', () => {
  const fn = cutFn(PHOTOS_JS, 'function aiSpend(');
  assert.match(fn, /PuBilling\.aiSummarize/,
    '★ 사진첩이 제 계산식을 갖고 있습니다 — 포털·서버와 갈라질 자리입니다');
  assert.ok(!/wonPerRead\s*\)?\s*[*]|[*]\s*b\.wonPerRead/.test(fn),
    '★ 곱셈이 사진첩에 또 있습니다 — 셈은 pu-billing 한 곳에만 둡니다');
});

test('사진첩이 셈 층을 «싣는다» — 안 실으면 금액이 영영 안 나온다', () => {
  assert.match(PHOTOS, /<script src="js\/pu-billing\.js\?v=\d+"/,
    '★ pu-billing.js 를 안 싣고 부르고 있습니다');
});

test('★ 한도를 넘으면 «사람이 누를 때» 얼마가 더 드는지 숫자로 묻는다', () => {
  const fn = cutFn(PHOTOS_JS, 'function okOverBudget(');
  assert.match(fn, /confirm\(/, '★ 묻지 않고 그냥 씁니다');
  assert.match(fn, /wonPerRead/, '★ 「요금이 듭니다」만으로는 누를지 정할 수가 없습니다');
  assert.match(fn, /if\s*\(!s\.over\)\s*return true/,
    '★ 넘지 않았는데도 묻고 있습니다 — 늘 뜨는 창은 곧 아무도 안 읽습니다');
});

test('★ 한도 고치는 칸은 총괄 관리자에게만 «보인다»', () => {
  const fn = cutFn(PHOTOS_JS, 'function renderAiBudget(');
  assert.match(fn, /amAdmin\(\)/, '★ 아무나 보면 눌러 보고 조용히 실패합니다');
  assert.match(fn, /aiBudgetBox[\s\S]*display\s*=\s*'none'|display\s*=\s*'none'/,
    '★ 감추는 줄이 없습니다');
  assert.match(fn, /aiLimit[\s\S]*aiWarn[\s\S]*aiWon/,
    '★ 지금 값을 안 채우면, 빈 칸으로 저장해 한도가 통째로 풀립니다');
});

test('★ 안 채운 칸은 «건드리지 않는다» — 셋 중 하나만 고쳐도 나머지가 안 바뀐다', () => {
  const fn = cutFn(PHOTOS_JS, 'function saveAiBudget(');
  assert.match(fn, /=== ''\s*\)\s*return null|value === ''/,
    '★ 빈 칸을 0 으로 밀어 넣으면 한도가 조용히 풀립니다');
  assert.match(fn, /!==\s*null/, '★ 없는 값을 걸러 내는 줄이 없습니다');
  assert.match(fn, /setAiBudget/);
});

test('설정 화면을 열면 한도 칸을 그린다', () => {
  assert.match(PHOTOS_JS, /renderFreeMeter\(\);\s*renderAiBudget\(\);/,
    '★ 설정을 열어도 안 그려지면 금액 칸이 「—」로 남습니다');
  assert.match(PHOTOS, /id="aiBudgetBox"[^>]*display:none/,
    '★ 처음부터 보이면, 관리자가 아닌 사람 화면에 한순간 스칩니다');
});

/* ══════ ⑧ 포털 딱지 ═════════════════════════════════════════════════════ */

test('★ 포털 딱지도 «같은 셈»을 부른다', () => {
  const fn = cutFn(ENTER_JS, 'function aiChipPaint(');
  assert.ok(!/[*]\s*\w*[Ww]onPerRead|wonPerRead\s*[*]/.test(fn),
    '★ 포털이 제 계산식을 갖고 있습니다');
  assert.match(ENTER_JS, /PuBilling\.watchAi/, '★ 포털이 셈 층을 안 부릅니다');
});

test('★ 셈을 못 읽으면 포털 딱지를 «감춘다» — ₩0 을 띄우지 않는다', () => {
  const fn = cutFn(ENTER_JS, 'function aiChipPaint(');
  assert.match(fn, /!s\.has[\s\S]{0,80}display\s*=\s*'none'/,
    '★ 못 읽은 것을 ₩0 으로 띄우면 「안 썼다」로 읽힙니다');
});

test('포털 딱지는 관리자에게만 (사용액 딱지와 같은 규칙)', () => {
  const fn = cutFn(ENTER_JS, 'function aiChipStart(');
  assert.match(fn, /billIsAdmin\(role\)/,
    '★ 금액을 전 직원에게 보이고 있습니다 — 대표 지시는 관리자만입니다');
  assert.match(fn, /_aiStop/, '★ 계정이 바뀌어도 안 끄면 남의 금액이 남습니다');
});

/* ⚠ «줄머리»에서 찾는다. 그냥 '#aiChip{' 로 찾으면 딸린 규칙
   (`#moneyBox[data-join="1"] #aiChip{` 같은 것)이 먼저 걸려, 창이 엉뚱한 데서 시작해
   정작 볼 색 규칙을 못 보고 헛돈다 — 2026-09-12 에 실제로 그렇게 됐다. */
const AI_CSS_AT = ENTER.indexOf('\n#aiChip{') + 1;

test('★ 진행 막대(작대기)를 안 쓴다 (대표 지시 「작대기 필요없다」)', () => {
  const css = ENTER.slice(AI_CSS_AT, AI_CSS_AT + 900);
  assert.ok(!/progress|<\/?meter|barfill|\.bar\b/i.test(css),
    '★ 막대가 돌아왔습니다 — 색(파랑→노랑→빨강)이 그 일을 대신합니다');
  assert.match(css, /data-tone="warn"[\s\S]*data-tone="over"/,
    '★ 색이 안 갈리면 넘긴 것을 눈으로 알 수 없습니다');
});

test('세 상태가 «다른 색»이다 — 같은 색이면 갈라 놓은 뜻이 없다', () => {
  const css = ENTER.slice(AI_CSS_AT, AI_CSS_AT + 1200);
  const 색 = (css.match(/background:(#[0-9a-f]{6})/gi) || []).map((s) => s.toLowerCase());
  assert.ok(new Set(색).size >= 3, '★ 평소·경고·중단이 같은 색으로 보입니다');
});
