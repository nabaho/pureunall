/* 규정관리 «사업장 줄» — 내가 이어서 할 곳만 (대표 결정 2026-09-07)
   목업 docs/mockups/2026-09-07-사업장줄-검토안.html

   ■ 무엇이 문제였나
   대표 지시 「사업장이 여러 개가 계속 이렇게 나오면 너무 많이 개수가 발생해서 관리가 어렵다」.
   실측 — 1900px 화면에서 칩은 «12개까지만» 보인다(칩 평균 124px · 줄 폭 1583px).
   구조상 원인 셋:
     ㉠ 아무것도 안 빠진다 — 「신고완료」가 되어도 줄에 그대로 남는다
     ㉡ **남의 끝난 일이 앞자리를 먹는다** — 신고(filedAt)가 없으면 dashStage 가
        «검토완료»로 분류해 앞쪽에 섞인다. 34곳 중 12곳이 그것이었고 「검토 15」가 헛말이 됐다
     ㉢ 정렬은 이미 급한 순이라 뒤쪽 두 무리만 접어도 대부분 들어온다

   ■ 대표 결정
     ㉠ **남의 완료본은 줄에서 뺀다** — 「내 할 일만 보이게」
     ㉡ **핀은 안 만든다** — 「안 쓴다. 버리고 단순하게」

   ■ 지키는 규칙
     ① 줄에는 개정중·검토완료·작성중 «내 것»만
     ② 집계는 **전체 곳수를 그대로** 말한다 — 접었다고 개수까지 감추면 접기 전보다 나쁘다
     ③ 접은 것이 있으면 «반드시» 말한다 — 조용히 줄면 「내 사업장이 사라졌다」가 된다
     ④ 그 단추는 **구르는 줄 밖**이다 — 안에 두면 칩과 함께 밀려 사라진다(목업 ㉡)
     ⑤ 여는 길은 «이미 있는 전체 보기» 하나 — 새 창을 만들지 않는다
     ⑥ 핀은 «없다»
   실행: node --test tests/rules-site-line-todo.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
/* 줄끝은 «읽을 때 한 번» 고른다 — 이 저장소는 윈도우에서 CRLF 로 내려온다
   (STATUS.md 「CI 는 초록인데 내 컴퓨터는 빨갛다」). */
const RAW = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8').replace(/\r\n/g, '\n');

/* 잘라 낼 함수 — 중괄호를 세어 진짜 끝을 찾는다 */
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

/* ── 판정을 «실제로 돌려» 본다 ── */
function 판(myUid) {
  const ctx = { console: { warn() {}, log() {} }, myUid: () => myUid || 'me',
    myEmail: () => 'me@x', sameUser: (a, b) => a === b };
  vm.createContext(ctx);
  vm.runInContext(RAW.slice(RAW.indexOf('const isOwner='), RAW.indexOf('\n', RAW.indexOf('const isDone='))), ctx);
  vm.runInContext(RAW.match(/const DASH_TODO_K=\{[^}]*\};/)[0], ctx);
  vm.runInContext(cut('function dashTodo('), ctx);
  return ctx;
}
const 줄 = (k, over) => Object.assign({ stage: { k: k } }, over || {});

/* ── ① 줄에 남는 것 ── */
test('★ 이어서 할 것만 남는다 — 개정중·검토완료·작성중', () => {
  const c = 판();
  ['amending', 'reviewed', 'draft'].forEach(function (k) {
    assert.equal(c.dashTodo(줄(k)), true, k + ' 이 빠졌습니다 — 할 일이 안 보입니다');
  });
  ['filed', 'none'].forEach(function (k) {
    assert.equal(c.dashTodo(줄(k)), false,
      '★ ' + k + ' 가 줄에 남습니다 — 「아무것도 안 빠진다」가 그대로입니다');
  });
});

test('★★ 남의 완료본은 «검토완료로 보여도» 뺀다 — 34곳 중 12곳이 그것이었다', () => {
  const c = 판('me');
  /* 신고(filedAt)가 없어 dashStage 가 검토완료로 분류한 «남의» 기록 */
  const 남의것 = 줄('reviewed', { rec: { ownerUid: 'other', status: '완료' } });
  assert.equal(c.dashTodo(남의것), false,
    '★★ 남의 완료본이 앞자리를 먹습니다 — 집계 「검토 15」가 헛말이 됩니다');
  const 내것 = 줄('reviewed', { rec: { ownerUid: 'me' } });
  assert.equal(c.dashTodo(내것), true, '★ 내 것을 뺐습니다 — 할 일이 사라집니다');
});

test('초안만 있는 줄은 «내 것»이다 — 이 기기에 있는 것이라 주인이 없다', () => {
  const c = 판();
  assert.equal(c.dashTodo(줄('draft', { draft: { name: '가' } })), true,
    '초안이 빠지면 작성 중인 것을 못 이어갑니다');
});

test('빈 줄·모르는 갈래는 안 넣는다', () => {
  const c = 판();
  [null, undefined, {}, 줄('nosuch')].forEach(function (v) {
    assert.equal(c.dashTodo(v), false, '엉뚱한 것이 줄에 들어갑니다: ' + JSON.stringify(v));
  });
});

/* ── ② 집계는 전체를 그대로 ── */
test('★★ 집계가 «전체 곳수»를 그대로 말한다 — 접었다고 개수까지 감추면 더 나쁘다', () => {
  /* ⚠ 2026-09-13: 칩 띠를 걷고 단추 하나로 바꾸면서 «적는 자리»가 renderDash 에서
     dashBtnFace 로 옮겨 갔다(대표 결정 「줄을 아예 없애고 단추 하나」).
     지켜야 할 것은 그대로다 — 전체 곳수·할 일 수·갈래를 «다» 말한다. */
  const fn = cut('function dashBtnFace(');
  assert.match(fn, /전체\|\|0\)\+"곳"/, '★★ 전체 곳수를 안 말합니다');
  assert.match(fn, /할 일 "\+n/, '할 일이 «몇 곳»인지 안 말합니다');
  assert.match(fn, /할 일 없음/, '할 일이 없을 때 그렇다고 안 말합니다');
  /* 갈래 집계(개정·검토·작성)는 «할 일»만 센다 — 그래야 「검토 15」가 안 나온다 */
  assert.match(fn, /줄들\.forEach/, '★ 갈래를 할 일 밖에서 셉니다');
  const 부르는곳 = cut('function renderDash(');
  assert.match(부르는곳, /dashBtnFace\(all\.length,todo\)/,
    '★ 전체 곳수와 «할 일»을 갈라 넘기지 않습니다 — 남의 완료본이 「검토」에 섞입니다');
});

/* ── ③④⑤ 칩 띠와 「＋N곳 더」는 2026-09-13 에 통째로 걷었다 ──
   대표 결정 「줄을 아예 없애고 단추 하나」(목업 docs/mockups/2026-09-13-사업장줄-단추하나.html).
   ★ 왜 여기 검사를 지우지 않고 «한 건»으로 바꿨나 — 다시 칩 띠를 들이면
     같은 탈(가로로 밀려 못 찾음)이 되살아난다. 그 문을 이 한 줄이 막는다.
   새 모양을 지키는 검사는 tests/rules-site-row-one-button.test.js 에 열일곱 건 있다. */
test('★★ 칩 띠가 되살아나지 않는다 — 몇 곳이 되든 화면이 안 변해야 한다', () => {
  /* ⚠ 주석을 먼저 걷는다 — 「칩 띠는 걷었다」고 적어 둔 주석의 글자가
     「아직 있다」로 읽히면 멀쩡한 파일을 문다(저장소 규칙). */
  const 코드 = RAW.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
                  .replace(/^[ \t]*\/\/.*$/gm, '');
  ['dash-list', 'dstrip', 'dchip', 'dash-more', 'dmore'].forEach(function (x) {
    assert.ok(코드.indexOf(x) < 0,
      '「' + x + '」가 돌아왔습니다 — 20곳이 되면 8곳이 다시 화면 밖으로 나갑니다');
  });
});

test('★ 여는 길은 «이미 있는 전체 보기» 하나 — 새 창을 만들지 않는다', () => {
  assert.match(RAW, /id="dash-all"/, '전체 보기로 가는 단추가 사라졌습니다');
  assert.match(RAW, /\$\("dash-all"\)\.addEventListener\("click"/,
    '★ 여는 손잡이가 없습니다');
  assert.ok(!/id="ov-dash2"|id="ov-sites"/.test(RAW), '새 창을 만들었습니다');
});

test('★ 줄에 안 보이는 것이 «무엇인지» 말한다 — 숫자만 있으면 무엇인지 모른다', () => {
  /* 예전에는 「＋N곳 더」 단추의 설명이 그 일을 했다. 지금은 단추 설명이 한다. */
  const fn = cut('function dashBtnFace(');
  assert.match(fn, /전체 "\+/, '전체가 몇 곳인지 안 말합니다');
  assert.match(fn, /개정|검토|작성/, '갈래를 안 말합니다');
});

/* ── ⑥ 핀은 없다 ── */
test('★ 핀은 «안 만들었다» (대표 결정 「안 쓴다」)', () => {
  /* 설계에는 있었지만 쓰지 않기로 하셨다 — 쓰지 않는 기능은 화면만 어지럽힌다.
     ⚠ 「📌」는 다른 뜻으로도 쓰인다(증빙 표시 등) — 사업장 줄 자리에서만 본다. */
  const fn = cut('function renderDash(');
  assert.ok(!/pin|📌/i.test(fn), '★ 핀이 사업장 줄에 들어갔습니다 — 안 쓰기로 하셨습니다');
  const md = cut('function renderDashModal(');
  assert.ok(!/dashPin|togglePin|pinned/i.test(md),
    '★ 전체 보기에 핀이 들어갔습니다 — 안 쓰기로 하셨습니다');
});

/* ── 줄에 안 보이는 것도 «열 수는» 있어야 한다 ── */
test('★★ 접힌 사업장도 전체 보기에서는 그대로 보인다 — 가린 것이 아니다', () => {
  const md = cut('function renderDashModal(');
  assert.match(md, /dashRows\(\)/, '전체 보기가 전체를 안 읽습니다');
  assert.ok(!/dashTodo/.test(md),
    '★★ 전체 보기까지 걸렀습니다 — 접힌 사업장을 여는 길이 아예 없어집니다');
});

test('단추가 세는 것과 창이 보여 주는 것이 «같은 목록»을 본다', () => {
  /* 칩이 없어져 「고르는 것」은 전체 보기 창 하나뿐이다. 두 자리가 같은 dashRows 를
     봐야 「단추는 5라는데 창에는 3곳」 같은 어긋남이 안 생긴다. */
  assert.match(cut('function renderDash('), /dashSorted\(dashRows\(\)\)/);
  assert.match(cut('function renderDashModal('), /dashSorted\(dashRows\(\)\)/);
});
