/* 규정관리 «사업장 줄» — 줄을 없애고 단추 하나로 (대표 결정 2026-09-13)
   목업 docs/mockups/2026-09-13-사업장줄-단추하나.html

   ■ 무엇이 문제였나
   대표 지시 「이 부분 2줄로 줄일 수 없나 … 계속 추가되면 관리가 너무 어렵다」.
   ★ 먼저 잰 것 — 사업장 줄은 «몇 곳이든 높이가 한 줄»이었다(.dstrip 이 overflow-x:auto 고
     flex-wrap 이 없다). 그러니 실제 탈은 높이가 아니라 «가로로 밀려 못 찾는 것»이다 —
     1900px 화면에서 칩은 12개까지만 보이고, 할 일이 20곳이면 8곳이 화면 밖이다.
   ★ 그리다 찾은 겹침 — 상태 줄의 앞 세 칸(사업장·규모·기준일)은 도구줄 셀렉트 값
     그대로다. ① 넣기에서만 같은 말을 두 번 했다.

   ■ 대표 결정: 「줄을 아예 없애고 단추 하나」

   ■ 지키는 규칙
     ① 사업장 줄(칩 띠)이 «없다» — 몇 곳이 되든 화면이 안 변한다
     ② 단추는 «상태 줄»에 있다 — 도구줄은 ②비교로 가면 접힌다. 거기 뒀으면
        그때 「다른 사업장으로 옮겨가기」가 사라진다
     ③ 상태 줄은 «늘» 보인다 — 안 보이면 단추도 함께 사라진다
     ④ 할 일이 있으면 「이어서 할 곳 N」, 없으면 「사업장 N곳」 — 0을 감추면
        「사업장이 없다」로 읽힌다
     ⑤ 전체 곳수와 갈래는 «말한다»(단추 설명) — 접었다고 개수까지 감추면 더 나쁘다
     ⑥ 가장 급한 갈래의 점 하나를 남긴다 — 「한눈에 훑기」를 잃는 대신의 최소 신호
     ⑦ 여는 길은 «이미 있는 전체 보기» 하나 — 새 창을 만들지 않는다
     ⑧ 「할 일」을 세는 잣대(dashTodo)는 2026-09-07 결정 그대로다
   실행: node --test tests/rules-site-row-one-button.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
/* 줄끝은 «읽을 때 한 번» 고른다 — 이 저장소는 윈도우에서 CRLF 로 내려온다 */
const RAW = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8').replace(/\r\n/g, '\n');

/* 주석을 걷는다 — 주석에 남은 옛 이름이 「아직 있다」로 읽히면 안 된다 */
function 주석걷기(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^[ \t]*\/\/.*$/gm, '');
}
const CODE = 주석걷기(RAW);

/* 함수를 통째로 잘라 낸다 — 중괄호를 세어 진짜 끝을 찾는다.
   ⚠ 고정 폭으로 자르면 긴 함수의 끝에 못 닿는다(tests/test-cut-truncation 이 막는다). */
function cut(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = RAW.indexOf('{', at + decl.length), d = 0;
  for (; i < RAW.length; i++) {
    if (RAW[i] === '{') d++;
    else if (RAW[i] === '}') { d--; if (!d) return RAW.slice(at, i + 1); }
  }
  throw new Error(decl + ' 의 끝을 못 찾았습니다');
}

/* ── 단추 얼굴 판정을 «실제로 돌려» 본다 ── */
function 판() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(RAW.match(/const DASH_ORDER=\[[^\]]*\];/)[0], ctx);
  vm.runInContext(cut('function dashBtnFace('), ctx);
  return ctx;
}
const 줄 = (k) => ({ stage: { k: k } });

/* ══════ ① 줄이 사라졌다 ══════ */

test('★★ 사업장 칩 띠가 없다 — 이것이 「몇 곳이 되든 화면이 안 변한다」의 근거다', () => {
  ['dash-list', 'dstrip', 'dchip', 'dash-more', 'dmore'].forEach(function (x) {
    assert.ok(CODE.indexOf(x) < 0,
      '「' + x + '」가 남아 있습니다 — 칩 띠를 통째로 걷어야 사업장 수가 화면에 안 닿습니다');
  });
});

test('★ 접기·펴기도 함께 사라졌다 — 접을 줄이 없으면 접는 단추도 뜻이 없다', () => {
  ['dash-open-bar', 'dash-show', 'dash-hide', 'DASH_PREF', 'showDash'].forEach(function (x) {
    assert.ok(CODE.indexOf(x) < 0, '「' + x + '」가 남아 있습니다');
  });
});

test('★ 접기 기억(localStorage)도 안 남긴다 — 안 쓰는 값이 남으면 다음 사람이 찾아 헤맨다', () => {
  assert.ok(CODE.indexOf('pureun_rules_dash_open_v1') < 0,
    '접기 기억 열쇠가 남아 있습니다');
});

/* ══════ ② 단추는 상태 줄에 있고, 늘 보인다 ══════ */

test('★★ 단추가 «상태 줄» 안에 있다 — 도구줄은 ②비교로 가면 접힌다', () => {
  const m = /<div id="statusbar"[\s\S]{0,900}?<\/div>\s*\n/.exec(RAW);
  assert.ok(m, '상태 줄 마크업을 못 찾았습니다');
  assert.match(m[0], /id="dash-all"/,
    '「이어서 할 곳」 단추가 상태 줄 안에 없습니다 — 도구줄에 두면 ②에서 사라집니다');
  assert.match(m[0], /id="dash-new"/, '「＋ 신규」가 상태 줄 안에 없습니다');
});

test('★★ 상태 줄이 «늘» 보인다 — 숨으면 단추도 함께 사라진다', () => {
  const fn = cut('function renderStatusBar(');
  assert.ok(!/classList\.toggle\("on"/.test(fn),
    '상태 줄을 조건에 따라 숨기고 있습니다 — 그러면 단추가 같이 사라집니다');
  assert.match(fn, /classList\.add\("on"\)/,
    '상태 줄을 늘 켜 두어야 합니다');
});

test('★ 단추를 «다시 만들지» 않는다 — 다시 만들면 붙여 둔 손잡이가 죽는다', () => {
  const fn = cut('function renderStatusBar(');
  assert.ok(!/id="dash-all"/.test(fn),
    'renderStatusBar 가 단추를 새로 그리고 있습니다 — addEventListener 가 끊깁니다.'
    + ' 마크업에 붙박이로 두고 «글자만» 고치세요');
});

test('★ 단계가 바뀌어도 단추를 안 가린다', () => {
  const fn = cut('function stepShowsOf(');
  assert.ok(!/dash/.test(fn), 'stepShowsOf 가 아직 사업장 줄을 여닫고 있습니다');
});

/* ══════ ③ 단추에 적는 말 ══════ */

test('★★ 할 일이 있으면 「이어서 할 곳 N」', () => {
  const c = 판();
  const f = c.dashBtnFace(34, [줄('amending'), 줄('amending'), 줄('reviewed')]);
  assert.match(f.말, /이어서 할 곳/);
  assert.equal(f.셈, '3');
});

test('★★ 할 일이 0이면 «전체 곳수»를 적는다 — 0을 감추면 「사업장이 없다」로 읽힌다', () => {
  const c = 판();
  const f = c.dashBtnFace(34, []);
  assert.match(f.말, /사업장/);
  assert.match(f.셈, /34/, '전체 곳수가 안 보입니다: ' + f.셈);
  assert.ok(!/이어서/.test(f.말), '할 일이 없는데 「이어서 할 곳」이라 적습니다');
});

test('★★ 전체 곳수와 갈래를 «말한다» — 접었다고 개수까지 감추면 접기 전보다 나쁘다', () => {
  const c = 판();
  const f = c.dashBtnFace(34, [줄('amending'), 줄('amending'), 줄('reviewed'), 줄('draft')]);
  assert.match(f.자세히, /34/, '전체 곳수를 안 말합니다: ' + f.자세히);
  assert.match(f.자세히, /개정 2/, '갈래를 안 말합니다: ' + f.자세히);
  assert.match(f.자세히, /검토 1/);
  assert.match(f.자세히, /작성 1/);
});

test('★★ 가장 급한 갈래의 점 하나 — 「한눈에 훑기」를 잃는 대신의 최소 신호', () => {
  const c = 판();
  assert.equal(c.dashBtnFace(9, [줄('reviewed'), 줄('amending')]).점, 'amending',
    '개정중이 섞여 있으면 그것이 가장 급합니다');
  assert.equal(c.dashBtnFace(9, [줄('draft'), 줄('reviewed')]).점, 'reviewed');
  assert.equal(c.dashBtnFace(9, []).점, 'none');
});

test('빈 줄·모르는 갈래가 섞여도 안 터진다 — 한 줄이 이상하다고 화면이 비면 안 된다', () => {
  const c = 판();
  const f = c.dashBtnFace(5, [{}, { stage: {} }, 줄('amending'), null]);
  assert.equal(f.셈, '4', '센 것은 줄 수 그대로여야 합니다');
  assert.equal(f.점, 'amending');
});

/* ══════ ④ 여는 길 ══════ */

test('★ 누르면 «이미 있는 전체 보기»가 열린다 — 새 창을 만들지 않는다', () => {
  assert.match(CODE, /\$\("dash-all"\)\.addEventListener\("click"/,
    '단추에 여는 손잡이가 없습니다');
  const ovs = (CODE.match(/id="ov-[a-z-]+"/g) || []);
  assert.ok(ovs.indexOf('id="ov-dash"') >= 0, '전체 보기 창이 사라졌습니다');
  assert.ok(!/id="ov-dash2"|id="ov-sites"/.test(CODE), '새 창을 만들었습니다');
});

test('★ 접힌 사업장도 전체 보기에서는 그대로 보인다 — 가린 것이 아니다', () => {
  const fn = cut('function renderDashModal(');
  assert.match(fn, /dashSorted\(dashRows\(\)\)/,
    '전체 보기는 «거르지 않은» 전체를 봐야 합니다');
  assert.ok(!/dashTodo/.test(fn), '전체 보기까지 할 일로 거르면 나머지를 볼 길이 없어집니다');
});

/* ══════ ⑤ 안 바꾼 것 ══════ */

test('★★ 「할 일」을 세는 잣대는 2026-09-07 결정 그대로다', () => {
  const fn = cut('function dashTodo(');
  assert.match(fn, /DASH_TODO_K/, '갈래 잣대가 바뀌었습니다');
  assert.match(fn, /isOwner/, '남의 완료본을 빼는 잣대가 사라졌습니다');
});

test('★ 핀은 여전히 «없다» (대표 결정 2026-09-07 「안 쓴다」)', () => {
  /* ⚠ 「📌」를 파일 전체에서 찾으면 안 된다 — 조문 연결의 «교정 기억»(dt-mfix)이
     같은 그림을 쓴다. 창을 사업장 쪽으로 좁힌다(넓은 창은 엉뚱한 것을 문다). */
  [cut('function renderDash('), cut('function renderDashModal(')].forEach(function (fn) {
    assert.ok(!/📌/.test(fn), '사업장 쪽에 핀을 만들었습니다 — 대표가 안 쓴다고 하셨습니다');
  });
  assert.ok(!/dashPin|DASH_PIN/.test(CODE), '핀을 기억하는 자리를 만들었습니다');
});

test('★ ＋ 신규는 살아 있다 — 새 사업장으로 들어가는 문이다', () => {
  assert.match(CODE, /\$\("dash-new"\)\.addEventListener\("click"/);
});
