/* ══════ 🏅 올해 «갱신할» 중소기업 확인서만 한자리에 (대표 지시 2026-09-12) ═════════
   대표: 「3번 중소기업확인서 진행」 — 점검 보고의 ③
   「지금은 회사를 열어야 보인다. 올해 갱신할 곳을 한 번에 보는 목록이 있으면
     매년 챙기기 쉽겠다」

   ■ 무엇이 없었나
   확인서 유효기간은 «회사 상세를 열어야» 보였다. 4,000곳 가운데 어디가 만료됐고
   어디가 곧인지 알려면 한 곳씩 열어 보는 수밖에 없었다 — 해마다 하는 일인데 그렇다.

   ★ 못 박는 것
     ① 잣대는 coSmeState «한 곳»이다 — 띠·창·거르개·상세 딱지가 모두 그것을 본다.
        여기서 다시 재면 「띠는 3곳인데 목록은 5곳」이 된다.
     ② «아직 먼 것»은 안 담는다 — 담으면 「전체 목록」이 되어 갱신할 곳이 묻힌다.
     ③ 날짜로 «못 읽은» 확인서도 안 담는다 — 모르는 것을 급하다 하면 늑대 소년이 된다.
     ④ 급한 순이다 — 지난 것이 먼저, 더 오래 지난 것이 더 앞.
     ⑤ 0곳이면 띠를 «아예 안 띄운다» — 늘 뜨는 띠는 눈이 배경으로 배운다.
     ⑥ 켤 수 있는 거르개는 이름표가 있어야 한다 — 없으면 목록이 좁혀진 까닭을 못 말한다.

   node --test tests/cards-co-sme-due.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

const 오늘 = new Date(2026, 8, 12, 15, 30).getTime();      /* 2026-09-12 오후 */

/* 잣대·목록·띠·창을 통째로 떠서 «돌린다» */
function load(list) {
  const ctx = { Object, Array, String, Number, Math, Date, JSON, isNaN, console,
    esc: s => String(s == null ? '' : s),
    coList: () => list || [],
    coVal: (o, f) => String(((o && o.extra) || {})[f] || ''),
    _closeBtn: () => '<x>',
    _panelShown: null,
    showPanel(h){ ctx._panelShown = h; } };
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(SRC, 'function coSmeDays('), cutFn(SRC, 'function coSmeState('),
    cutFn(SRC, 'function coSmeNeeds('), cutFn(SRC, 'function coSmeList('),
    cutFn(SRC, 'function coSmeCount('), cutFn(SRC, 'function coSmeBarHtml('),
    cutFn(SRC, 'function coSmeHtml(')
  ].join('\n'), ctx);
  return ctx;
}
const 회사 = (name, exp, extra) => ({ key:name, name:name,
  extra: Object.assign({ smeExpiry: exp }, extra || {}) });

/* ── ①②③ 무엇을 담는가 ────────────────────────────────────────────── */

test('★★★ 만료된 곳과 곧 만료될 곳만 담는다', () => {
  const c = load([ 회사('만료','2026-03-31'), 회사('임박','2026-10-01'),
                   회사('아직멀다','2027-03-31') ]);
  const got = c.coSmeList(오늘).map(x => x.name);
  assert.deepEqual(got, ['만료','임박'],
    '★★★ 유효한 확인서까지 담으면 「전체 목록」이 되어 갱신할 곳이 묻힌다');
});

test('★★★ 확인서가 «없는» 회사는 담지 않는다 — 애초에 갱신 대상이 아니다', () => {
  const c = load([ 회사('없음',''), { key:'칸자체없음', name:'칸자체없음', extra:{} } ]);
  assert.equal(c.coSmeList(오늘).length, 0,
    '★★★ 확인서를 받은 적 없는 회사까지 담으면 4,000곳이 통째로 올라온다');
});

test('★★ 날짜로 «못 읽은» 확인서는 담지 않는다 — 늑대 소년이 되면 안 된다', () => {
  const c = load([ 회사('통지시까지','별도 통지시까지') ]);
  assert.equal(c.coSmeList(오늘).length, 0,
    '★★ 모르는 것을 급하다고 하면, 진짜 급한 것도 안 믿게 된다');
});

/* ── ④ 급한 순 ─────────────────────────────────────────────────────── */

test('★★★ 급한 순으로 선다 — 지난 것이 먼저, 더 오래 지난 것이 더 앞', () => {
  const c = load([ 회사('임박15','2026-09-27'), 회사('오래지남','2025-01-31'),
                   회사('막지남','2026-09-01'), 회사('임박3','2026-09-15') ]);
  assert.deepEqual(c.coSmeList(오늘).map(x => x.name),
    ['오래지남','막지남','임박3','임박15'],
    '★★★ 차례가 급한 순이 아니면 맨 위부터 처리할 수가 없다');
});

test('★ 남은 날을 «함께» 들고 온다 — 화면이 그것으로 D-날짜를 적는다', () => {
  const c = load([ 회사('만료','2026-09-02'), 회사('임박','2026-09-20') ]);
  const [a, b] = c.coSmeList(오늘);
  assert.equal(a.days, -10, '★ 지난 날 수가 틀리다');
  assert.equal(b.days, 8);
  assert.equal(a.cls, 'gone'); assert.equal(b.cls, 'soon');
});

/* ── ⑤ 띠 ───────────────────────────────────────────────────────────── */

test('★★★ 갱신할 곳이 없으면 띠를 «아예 안 띄운다»', () => {
  const c = load([ 회사('멀다','2027-03-31'), 회사('없음','') ]);
  assert.equal(c.coSmeBarHtml(오늘), '',
    '★★★ 늘 뜨는 띠는 눈이 배경으로 배운다 — 정작 급할 때 안 읽힌다');
});

test('★★ 띠가 «만료 몇 곳 · 30일 안 몇 곳»을 갈라 말한다', () => {
  const c = load([ 회사('만료1','2026-03-31'), 회사('만료2','2026-08-01'),
                   회사('임박1','2026-10-01') ]);
  const h = c.coSmeBarHtml(오늘);
  assert.match(h, /만료 <b>2곳<\/b>/, '★★ 몇 곳이 이미 지났는지가 가장 급한 값이다');
  assert.match(h, /30일 안 <b>1곳<\/b>/);
  assert.match(h, /openCoSme\(\)/, '★ 눌러서 볼 길이 없다');
});

test('★ 한쪽이 0곳이면 그쪽은 «안 적는다» — 「만료 0곳」은 읽을 값이 없다', () => {
  const c = load([ 회사('임박','2026-10-01') ]);
  const h = c.coSmeBarHtml(오늘);
  assert.ok(!/만료 <b>/.test(h), '★ 「만료 0곳」이 적혀 있다');
  assert.match(h, /30일 안 <b>1곳<\/b>/);
});

/* ── 창 ─────────────────────────────────────────────────────────────── */

test('★★★ 창이 회사마다 «언제까지»와 «얼마나 급한지»를 말한다', () => {
  const c = load([ 회사('만료회사','2026-09-02'), 회사('임박회사','2026-09-20') ]);
  const h = c.coSmeHtml(오늘);
  assert.match(h, /갱신할 곳 2곳/, '★ 몇 곳인지 없다');
  assert.match(h, /만료 10일 지남/, '★★★ 얼마나 지났는지 없으면 급한 정도를 모른다');
  assert.match(h, /D-8/, '★★ 며칠 남았는지 없다');
  assert.match(h, /2026-09-02까지/, '★★ 언제까지인지 없으면 새로 받을 때 못 적는다');
});

test('★★ 회사를 누르면 «창을 닫고» 그 회사를 연다', () => {
  const c = load([ 회사('가나','2026-09-02') ]);
  const h = c.coSmeHtml(오늘);
  assert.match(h, /pickCo\('가나'\)/, '★★ 눌러도 그 회사로 못 간다');
  assert.match(h, /dedupBg\.classList\.remove\('open'\)/,
    '★★ 창을 안 닫으면 상세가 창 뒤에 열려 아무 일도 없는 것처럼 보인다');
});

test('★ 갱신할 곳이 없으면 창은 «없다»고 말한다 — 빈 목록은 고장으로 읽힌다', () => {
  const c = load([ 회사('멀다','2027-03-31') ]);
  assert.match(c.coSmeHtml(오늘), /없습니다/);
});

/* ── ① 잣대가 «한 곳»인가 · ⑥ 이름표 ──────────────────────────────── */

test('★★★ 띠·창·거르개가 모두 «같은 잣대»(coSmeNeeds)를 본다', () => {
  assert.match(cutFn(SRC, 'function coSmeList('), /coSmeNeeds\(o, now\)/,
    '★★ 목록이 제 잣대를 따로 두면 띠와 어긋난다');
  assert.match(cutFn(SRC, 'function coSmeNeeds('), /coSmeState\(/,
    '★★★ 잣대를 두 벌로 만들면 상세 딱지와 목록이 다른 말을 한다');
  const filt = cutFn(SRC, 'function coFilteredList(');
  assert.match(filt, /state\.coOnlySme && !skipTodo\) list = list\.filter\(o=>coSmeNeeds\(o\)\)/,
    '★★★ 거르개가 제 잣대를 따로 두면 「띠는 3곳인데 목록은 5곳」이 된다');
});

test('★★★ 거르개를 켜면 «무엇으로 걸렀는지» 딱지가 말한다', () => {
  /* 켤 수 있는데 이름표가 없으면, 목록이 좁혀진 까닭을 화면이 아무 말도 안 한다.
     ⚠ 이 자리를 처음에 빠뜨렸고 cards-co-todo-band 검사가 잡았다. */
  const lab = SRC.slice(SRC.indexOf('const CO_TODO_LABEL'), SRC.indexOf('function clearCoTodo'));
  assert.match(lab, /coOnlySme:/, '★★★ 걸어 놓고 아무 말이 없으면 되돌릴 길도 안 보인다');
  assert.match(cutFn(SRC, 'function coFilters('), /k: 'coOnlySme'/, '★★ 거르개 메뉴에 없다');
});

test('★★ 띠를 목록 위에 «실제로» 내보낸다 — 만들어 놓고 안 붙이면 소용없다', () => {
  assert.match(cutFn(SRC, 'function coListHtml('), /coSmeBarHtml\(\)/,
    '★★★ 띠를 그리는 자리가 없다');
});
