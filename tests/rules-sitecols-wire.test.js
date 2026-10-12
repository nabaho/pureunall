/* rules-v2.html 꽂기 (설계 §12-4) — 손잡이 이름들 · 거르개·담당·검색어를 바꾸면 1쪽 · 쪽 누르면 표 맨 위 · 캐시 번호 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const HTML = stripComments(fs.readFileSync(path.join(__dirname, '../rules-v2.html'), 'utf8'));
const HSTART = HTML.indexOf('var H = {');
const H = HTML.slice(HSTART, HTML.indexOf('\n};', HSTART));
/* 손잡이 한 개의 몸통 — «이름: function» 에서 다음 손잡이(두 칸 들여쓴 «이름: function») 앞까지 */
const fn = (k) => {
  const i = H.indexOf('\n  ' + k + ': function');
  assert.ok(i >= 0, k + ' 손잡이');
  const rest = H.slice(i + 1);
  const m = /\n {2}[A-Za-z_$][\w$]*: function/.exec(rest.slice(1));
  return m ? rest.slice(0, m.index + 1) : rest;
};

test('새 스크립트는 캐시 번호를 달고 lib-sites 뒤·view-sites 앞에', () => {
  const re = /<script src="js\/rules-v2\/lib-sitecols\.js\?v=\d+"><\/script>/;
  assert.match(HTML, re);
  assert.ok(HTML.search(re) > HTML.indexOf('js/rules-v2/lib-sites.js'));
  assert.ok(HTML.search(re) < HTML.indexOf('js/rules-v2/view-sites.js'));
});

test('상태 — cols·sort·page·pop 이 ST.sites 에 있다', () => {
  const t0 = HTML.indexOf('var ST = {');
  assert.ok(t0 >= 0, 'ST 첫 값');
  const i = HTML.indexOf('sites: {', t0);
  assert.ok(i >= 0, 'ST.sites');
  const st = HTML.slice(i, HTML.indexOf('staff:', i));
  assert.ok(st.length > 10);
  ['cols', 'sort', 'page', 'pop'].forEach((k) => assert.match(st, new RegExp('\\b' + k + '\\b'), k));
});

test('손잡이 — 열기·순서·체크·풀기·쪽', () => {
  ['colOpen', 'colSort', 'colToggle', 'colClear', 'colsClear', 'colClose', 'colWho', 'colq', 'pageGo'].forEach(fn);
  assert.match(fn('colOpen'), /getBoundingClientRect\(/);
  assert.match(fn('pageGo'), /scrollTop\s*=\s*0/);
});

test('창 닫기는 늘 비우고 다시 그린다 — 그림이 «열려 있을 때만» 부른다', () => {
  const b = fn('colClose');
  assert.match(b, /\.pop\s*=\s*["']{2}/);
  assert.match(b, /\.popq\s*=\s*["']{2}/);
  assert.match(b, /draw\(\)/);
  assert.doesNotMatch(b, /\bif\b/, 'colClose 는 조건 없이 다시 그린다');
});

test('조건을 바꾸면 1쪽으로 — 칩·담당·검색·거르기·순서', () => {
  ['siteF', 'sq', 'sm', 'colToggle', 'colSort', 'colClear', 'colsClear', 'colWho'].forEach((k) => {
    assert.match(fn(k), /\.page\s*=\s*1/, k + ' 가 쪽을 1로 돌린다');
  });
});

test('고르기·새로고침은 쪽을 건드리지 않는다 (없는 쪽은 그리는 쪽이 당긴다)', () => {
  assert.doesNotMatch(fn('siteSel'), /\.page\s*=/);
  const m = HTML.match(/function reload\(\)[\s\S]*?\r?\n\}/);
  assert.ok(m, 'reload()');
  assert.doesNotMatch(m[0], /\.page\s*=/);
});

test('순서 단추를 같은 방향으로 다시 누르면 순서가 풀린다', () => {
  assert.match(fn('colSort'), /\.sort\s*=[^;]*\?\s*null\s*:/);
});

/* CSS 한 규칙의 몸통 — 선택자로 찾는다 */
const rule = (sel) => {
  const i = HTML.indexOf(sel + '{');
  assert.ok(i >= 0, sel + ' 규칙');
  return HTML.slice(i, HTML.indexOf('}', i));
};

test('쪽 막대는 좁은 폭에서 줄을 바꿔 흰 상자 안에 남는다', () => {
  assert.match(rule('#sites .pager'), /flex-wrap:\s*wrap/);
  const info = rule('#sites .pager .info');
  assert.match(info, /flex:\s*1 1 auto/);
  assert.doesNotMatch(info, /white-space:\s*nowrap/, '안내 글이 한 줄을 강요하지 않는다');
  assert.match(HTML, /@media \(max-width:\s*900px\)\{#sites \.pager \.info\{flex-basis:\s*100%/);
});

test('머리줄 창은 위쪽 띠·머리보다 위, 모달 베일보다 아래', () => {
  const z = (r) => Number(/z-index:\s*(\d+)/.exec(r)[1]);
  const pop = z(rule('.cpop'));
  assert.ok(pop > z(rule('.top')), '위쪽 띠보다 위');
  assert.ok(pop < z(rule('.veil')), '모달 베일보다 아래');
});

/* sq·colq 손잡이를 가짜 상태·가짜 타이머로 «실제로 돌린다» — 조합 중에는 그리지 않고, 값은 늘 상태에 */
function liveHandlers(pop) {
  const ST = { sites: { q: '', popq: '', page: 3, pop: pop || '' } };
  const input = { focus() {}, setSelectionRange() {}, value: '' };
  const $sites = { __pdComposing: false, querySelector: () => input };
  const log = { draws: 0 };
  let timers = [], seq = 0;
  const setT = (f) => { const id = ++seq; timers.push({ id, f }); return id; };
  const clrT = (id) => { timers = timers.filter((t) => t.id !== id); };
  const mk = (k) => new Function('ST', '$sites', 'draw', 'drawKeepList', 'setTimeout', 'clearTimeout', 'qTimer', 'cqTimer',
    'return {' + fn(k) + '};')(ST, $sites, () => { log.draws++; }, () => { log.draws++; }, setT, clrT, 0, 0)[k];
  return { ST, $sites, log, sq: mk('sq'), colq: mk('colq'), fire: () => { const t = timers; timers = []; t.forEach((x) => x.f()); }, pending: () => timers.length };
}

test('조합 중에는 값만 상태에 넣고 그리지 않는다 · 조합이 끝나면 마지막 값으로 한 번만 그린다 — 사업장 검색(sq)', () => {
  const h = liveHandlers();
  h.$sites.__pdComposing = true;
  h.sq('홍'); h.sq('홍길'); h.fire();
  assert.equal(h.ST.sites.q, '홍길', '조합 중에도 상태는 현재 값');
  assert.equal(h.ST.sites.page, 1);
  assert.equal(h.log.draws, 0, '조합 중에는 그리지 않는다');
  h.$sites.__pdComposing = false;        // compositionend — 뷰가 한 번 더 부른다
  h.sq('홍길동'); h.sq('홍길동'); h.fire();
  assert.equal(h.ST.sites.q, '홍길동');
  assert.equal(h.log.draws, 1, '디바운스로 한 번만');
});

test('조합 중에는 값만 상태에 넣고 그리지 않는다 · 조합이 끝나면 한 번만 그린다 — 업태 찾기(colq)', () => {
  const h = liveHandlers('biz');
  assert.equal(h.pending(), 0);
  h.$sites.__pdComposing = true;
  h.colq('도'); h.colq('도소'); h.fire();
  assert.equal(h.ST.sites.popq, '도소');
  assert.equal(h.log.draws, 0, '조합 중에는 칸을 새로 만들지 않는다');
  h.$sites.__pdComposing = false;
  h.colq('도소매'); h.colq('도소매');
  assert.equal(h.pending(), 1, '디바운스 — 타이머는 하나');
  h.fire();
  assert.equal(h.ST.sites.popq, '도소매');
  assert.equal(h.log.draws, 1);
  const h2 = liveHandlers('');   // 창이 닫힌 뒤에 도착한 타이머는 그릴 일이 없다
  h2.colq('x'); h2.fire();
  assert.equal(h2.log.draws, 0);
});

test('Esc — 문서 전체에서 한 번만 듣고, 사업장 갈래에서 창이 열려 있을 때만 colClose', () => {
  const m = /document\.addEventListener\('keydown',[\s\S]*?\}\);/.exec(HTML);
  assert.ok(m, '문서 keydown 귀');
  assert.match(m[0], /ev\.key === 'Escape'/);
  assert.match(m[0], /__rv2Mode === 'sites'/);
  assert.match(m[0], /ST\.sites\.pop/);
  assert.match(m[0], /H\.colClose\(\)/);
  const at = HTML.indexOf(m[0]);
  assert.match(HTML.slice(Math.max(0, at - 160), at), /if \(!window\.__rv2EscSites\)/, '겹쳐 달지 않는 깃발');
  assert.equal(HTML.split("document.addEventListener('keydown'").length - 1, 1, '한 개');
});

test('한 칸은 한 줄 —머리 단추·창 목록 글은 넘치면 … 로 줄인다', () => {
  assert.match(rule('#sites th.ch .h'), /overflow:\s*hidden/);
  ['#sites th.ch .h .lb', '.cpop label .t,.cpop .wo .t'].forEach((sel) => {
    const r = rule(sel);
    assert.match(r, /white-space:\s*nowrap/, sel);
    assert.match(r, /text-overflow:\s*ellipsis/, sel);
    assert.match(r, /overflow:\s*hidden/, sel);
    assert.match(r, /min-width:\s*0/, sel);
  });
});

test('순서 열쇠가 없는 칸을 누르면 아무 일도 안 한다', () => {
  assert.match(fn('colSort'), /if\s*\(\s*!sk\s*\)\s*return/);
});

test('창 목록은 체크·찾기로 다시 그려도 읽던 자리를 지킨다', () => {
  const d = HTML.match(/function drawKeepList\(\)[\s\S]*?\r?\n\}/);
  assert.ok(d, 'drawKeepList');
  assert.match(d[0], /scrollTop/);
  assert.match(fn('colToggle'), /drawKeepList\(\)/);
  assert.match(fn('colq'), /drawKeepList\(\)/);
});

test('창은 아래 화면 밖으로 밀려 나가지 않게 세로도 눌러 둔다', () => {
  assert.match(fn('colOpen'), /innerHeight/);
});
