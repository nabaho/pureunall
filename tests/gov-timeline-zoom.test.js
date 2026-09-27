/* 「사업장을 클릭하면 날짜·요일과 방문 횟수를 크게 해서 한 번에」 (대표 지시 2026-09-14)
 *
 * ★ 알맹이는 «한 번에»다.
 *   ⓵ 처음엔 세로로 쌓았다 — 대표: 「세로로 길게 나오면 날짜가 넘어가면 못 찾는다」.
 *     같은 날 «가로»로 흘리도록 바꿨다. 열두 회차가 스크롤 없이 들어온다.
 *   ⓶ 한 회차는 «한 칸»이다 — 칸 안에서 또 쌓으면 가로로 흘려도 길어진다.
 *
 * ★ 「년월일요일을 복사할 수 있는 기능 — 다른 곳에 붙여넣게」
 *   붙여넣는 곳이 메일·보고서라 «글자»로 만든다. 표가 아니라 줄글이어야 안 깨진다.
 *
 * 못 박는 것은 «지금 값»이 아니라 규칙이다 (CLAUDE.md).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const bare = (s) => s
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');
const HTML = SRC.replace(/<!--[\s\S]*?-->/g, ' ');
const STYLE = [...SRC.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}
function grabArr(decl) {
  const i = SRC.indexOf(decl);
  assert.ok(i >= 0, decl + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let k = SRC.indexOf('[', i); k < SRC.length; k++) {
    if (SRC[k] === '[') { d++; st = true; }
    else if (SRC[k] === ']') { d--; if (st && !d) return SRC.slice(i, k + 1).replace(/^const /, 'var ') + ';'; }
  }
}

/* ── 셈을 실제로 돌린다 ── */
const TODAY = '2026-09-14';
const TYPES = [{ id: 't1', name: '기술보호', fullName: '기술보호울타리', agency: '대중소협력재단', color: '#2a9d8f', rounds: 6 }];
const STAFF = [{ id: 'a1', name: '홍길동', color: '#f97316' }, { id: 'a2', name: '김철수', color: '#ec4899' }];
const CO = { id: 'c1', name: '가나상사', types: ['t1'], endedTypes: {}, defAtt: 'a1', defCoAtts: ['a2'], deadlines: {}, customRounds: {} };

function world(scheds, over) {
  const out = {};
  const ctx = Object.assign({
    getCos: () => [CO], getScheds: () => scheds, getTypes: () => TYPES, getStaff: () => STAFF,
    getCoMaxRounds: () => TYPES[0].rounds,
    mainPhaseScheds: (list) => list,
    coAttStaffList: (o) => (o.defCoAtts || []).map((id) => STAFF.find((a) => a.id === id)).filter(Boolean),
    staffColor: (a) => (a && a.color) || '#94a3b8',
    schedHasPhoto: () => false,
    endedDateForSchedule: () => '',
    schedulePlaceLabel: (sc) => (sc.isField ? '📍 방문' : '🏢 사무실'),
    nextRound: () => scheds.length + 1,
    getHoliday: () => '',
    escAttr: (v) => String(v == null ? '' : v),
    todayStr: () => TODAY,
    closeModal: () => {},
    openEditModal: () => {},
    toast: (m, k) => { ctx.__toast = String(m); ctx.__toastKind = k || ''; },
    /* 클립보드·문서는 흉내 낸다 — 막혔을 때 어떻게 하는지를 «돌려서» 보려고 */
    navigator: { clipboard: { writeText: () => { ctx.__newWay = 1; return Promise.resolve(); } } },
    document: {
      createElement: () => ({ style: {}, select: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
      execCommand: () => { ctx.__oldWay = 1; return true; },
    },
    qa: () => [],
    q: (sel) => ({ set innerHTML(v) { out[sel] = v; }, classList: { add: () => {} }, onclick: null }),
    Math, String, Array, Object, Number, isNaN, Date, JSON, Promise,
  }, over || {});
  ctx.__out = out;
  vm.createContext(ctx);
  vm.runInContext([grabArr('const TZ_DOW='), grab('tzDow'), 'var _tzKey=null;',
    grab('tlZoomCopyText'), grab('tlZoomCopy'),
    grab('openTlZoom'), grab('renderTlZoom')].join('\n'), ctx);
  return ctx;
}
const SC = (id, date, round, isField) => ({ id, date, round, coId: 'c1', typeId: 't1', isField: !!isField, attId: 'a1' });

/* ══ 요일 ══════════════════════════════════════════════════════ */

test('★★★ 요일을 한글로 붙인다 — 「수요일마다 간다」는 결은 날짜만으로는 안 보인다', () => {
  const w = world([]);
  assert.strictEqual(w.tzDow('2026-09-14'), '월');
  assert.strictEqual(w.tzDow('2026-09-13'), '일');
  assert.strictEqual(w.tzDow('2026-09-19'), '토');
});

test('★★ 알아볼 수 없는 날짜에는 빈 글자 — 「NaN요일」이 찍히면 안 된다', () => {
  const w = world([]);
  assert.strictEqual(w.tzDow('어제'), '');
  assert.strictEqual(w.tzDow(''), '');
  assert.strictEqual(w.tzDow(null), '');
});

/* ══ 가로로 흐르는가 ═══════════════════════════════════════════ */

test('★★★ 회차가 «가로로» 흐른다 — 세로로 쌓으면 날짜가 스크롤에 묻힌다', () => {
  const w = world([SC('s1', '2026-07-02', 1, true), SC('s2', '2026-07-09', 2, false)]);
  w.openTlZoom('c1', 't1');
  const list = w.__out['#tzList'];
  assert.ok(/class="tz-grid"/.test(list), '가로로 흐르는 틀이 없다 — 세로로 쌓인다');
  /* ⚠ 「tzc」 만 세면 안쪽 칸(tzc-no·tzc-md…)까지 딸려 온다 —
       칸 자체는 «tzc 뒤에 공백이나 따옴표»가 오는 것뿐이다. */
  const n = (list.match(/class="tzc[ "]/g) || []).length;
  assert.strictEqual(n, 2, '회차 수와 칸 수가 다르다');
  /* 칸 안에서 또 쌓지 않았는가 — 가로로 흘려도 칸이 길면 같은 일이 된다 */
  const a0 = list.search(/class="tzc[ "]/);
  const a1 = list.slice(a0 + 11).search(/class="tzc[ "]/) + a0 + 11;
  assert.ok(a1 > a0, '칸이 둘인데 하나로 읽힌다 — 자르는 자리가 틀렸다');
  const one = list.slice(a0, a1);
  assert.ok(one.length > 50, '첫 칸을 제대로 못 잘랐다');
  assert.ok(!/<br\s*\/?>/.test(one), '한 회차 안에서 줄을 바꾼다');
});

test('★★★ 날짜·요일·장소가 «한 칸에 모두» 있다', () => {
  const w = world([SC('s1', '2026-07-02', 1, true)]);
  w.openTlZoom('c1', 't1');
  const list = w.__out['#tzList'];
  assert.ok(/07\.02/.test(list), '날짜가 안 보인다');
  /* ⚠ 요일 «글자»를 박지 않는다 — 첫 판에 2026-07-02 를 수요일로 잘못 적어 놓고
       멀쩡한 코드를 의심했다(목요일이다). 맞는가는 위 tzDow 검사가 못 박았다. */
  const wd = (list.replace(/\s+/g, ' ').match(/class="tzc-w[^"]*">([^<]+)</) || [])[1] || '';
  assert.ok(/^[일월화수목금토]$/.test(wd), '요일이 안 보인다 (나온 것: ' + wd + ')');
  assert.ok(/방문/.test(list), '방문·사무실이 안 보인다');
});

test('★★ 토·일은 달리 보인다 — 주말 방문은 눈에 걸려야 한다', () => {
  const w = world([SC('s1', '2026-09-19', 1, true)]);   // 토요일
  w.openTlZoom('c1', 't1');
  assert.ok(/tzc-w we/.test(w.__out['#tzList']), '주말인데 평일과 똑같이 보인다');
});

test('★★ 주담당과 «다른» 사람이 간 회차만 이름을 붙인다 — 좁은 칸이 이름으로 차면 안 된다', () => {
  const same = world([SC('s1', '2026-07-02', 1, true)]);
  same.openTlZoom('c1', 't1');
  assert.ok(!/tzc-a/.test(same.__out['#tzList']), '주담당과 같은데도 이름을 붙인다');

  const other = SC('s1', '2026-07-02', 1, true); other.attId = 'a2';
  const w2 = world([other]);
  w2.openTlZoom('c1', 't1');
  assert.ok(/tzc-a/.test(w2.__out['#tzList']), '다른 사람이 갔는데 표시가 없다');
  assert.ok(/김철수/.test(w2.__out['#tzList']), '누가 갔는지 안 보인다');
});

/* ══ 방문 횟수 ═════════════════════════════════════════════════ */

test('★★★ 방문·사무실 횟수를 «갈라» 센다 — 대표가 물은 「방문횟수」다', () => {
  const w = world([SC('s1', '2026-07-02', 1, true), SC('s2', '2026-07-09', 2, true), SC('s3', '2026-07-16', 3, false)]);
  w.openTlZoom('c1', 't1');
  const sum = w.__out['#tzSum'].replace(/\s+/g, ' ');
  assert.ok(/방문 <b>2<\/b>/.test(sum), '방문 횟수가 틀렸다');
  assert.ok(/사무실 <b>1<\/b>/.test(sum), '사무실 횟수가 틀렸다');
});

test('★★ 전체 회차와 최대 회차를 함께 보여 준다', () => {
  const w = world([SC('s1', '2026-07-02', 1, true), SC('s2', '2026-07-09', 2, false)]);
  w.openTlZoom('c1', 't1');
  const sum = w.__out['#tzSum'];
  assert.ok(/>2</.test(sum), '지금까지 몇 회인지 안 보인다');
  assert.ok(/6회/.test(sum), '최대 회차가 안 보인다');
});

test('★★ 일정이 하나도 없으면 그렇다고 말한다 — 빈 화면은 고장처럼 보인다', () => {
  const w = world([]);
  w.openTlZoom('c1', 't1');
  assert.ok(/없습니다/.test(w.__out['#tzList']), '빈 채로 둔다');
});

/* ══ 복사 ══════════════════════════════════════════════════════ */

test('★★★ 붙여넣을 글자에 «년·월·일·요일»이 다 있다 — 대표가 콕 집은 것이다', () => {
  const w = world([]);
  const done = [SC('s1', '2026-07-13', 1, true), SC('s2', '2026-07-21', 2, false)];
  const text = w.tlZoomCopyText(CO, TYPES[0], done);
  assert.ok(/2026-07-13 \(월\)/.test(text), '년월일 또는 요일이 빠졌다');
  assert.ok(/2026-07-21 \(화\)/.test(text), '두 번째 줄이 틀렸다');
});

test('★★★ 머리에 «무엇의» 날짜인지 적는다 — 날짜만 붙여넣으면 나중에 아무도 모른다', () => {
  const w = world([]);
  const text = w.tlZoomCopyText(CO, TYPES[0], [SC('s1', '2026-07-13', 1, true)]);
  const head = text.split('\n')[0];
  assert.ok(head.includes(CO.name), '사업장 이름이 없다');
  assert.ok(head.includes(TYPES[0].fullName), '무슨 사업인지 없다');
});

test('★★ 회차와 방문·사무실도 함께 — 날짜만으로는 보고서에 못 쓴다', () => {
  const w = world([]);
  const text = w.tlZoomCopyText(CO, TYPES[0],
    [SC('s1', '2026-07-13', 1, true), SC('s2', '2026-07-21', 2, false)]);
  assert.ok(/1회/.test(text) && /2회/.test(text), '회차가 없다');
  assert.ok(/현장방문/.test(text) && /사무실/.test(text), '방문·사무실이 안 갈린다');
});

test('★★ 한 회차가 «한 줄» — 붙여넣은 글이 뒤엉키면 못 쓴다', () => {
  const w = world([]);
  const done = [SC('s1', '2026-07-13', 1, true), SC('s2', '2026-07-21', 2, false), SC('s3', '2026-07-28', 3, true)];
  const lines = w.tlZoomCopyText(CO, TYPES[0], done).split('\n');
  assert.strictEqual(lines.length, 4, '머리 한 줄 + 회차 세 줄이어야 한다');
});

test('★★★ 복사 단추가 «화면에 있고 걸려» 있다', () => {
  assert.ok(/id="tzCopyBtn"/.test(HTML), '복사 단추가 없다');
  const fn = bare(grab('renderTlZoom')).replace(/\s+/g, '');
  assert.ok(/tzCopyBtn'\)/.test(fn), '단추를 안 건다 — 눌러도 아무 일이 없다');
  assert.ok(/onclick=tlZoomCopy/.test(fn), '복사 함수에 안 이어져 있다');
});

test('★★ 잘 되면 «되었다»고 말해 준다 — 아무 일도 안 일어난 것처럼 보이면 또 누른다', async () => {
  const w = world([SC('s1', '2026-07-13', 1, true)]);
  w.openTlZoom('c1', 't1');
  await w.tlZoomCopy();
  assert.ok(w.__newWay, '클립보드에 안 담았다');
  assert.ok(/복사/.test(w.__toast || ''), '되었는데 아무 말이 없다');
});

test('★★★ 클립보드가 막히면 «옛 방식»으로 한 번 더 — 조용히 실패하면 안 된다', async () => {
  /* navigator.clipboard 는 https 와 «사람이 누른 순간»에만 된다.
     ⚠ 글자로만 보면 안 된다 — 첫 판에 catch·execCommand 를 «찾기»만 했더니
       그 대목을 if(false) 로 막아도 검사가 통과했다. 실제로 돌려서 본다. */
  const w = world([SC('s1', '2026-07-13', 1, true)], {
    navigator: { clipboard: { writeText: () => Promise.reject(new Error('막힘')) } },
  });
  w.openTlZoom('c1', 't1');
  await w.tlZoomCopy();
  assert.ok(w.__oldWay, '클립보드가 막혔는데 옛 방식으로 다시 안 해 본다');
  assert.notStrictEqual(w.__toastKind, 'err', '옛 방식으로 됐는데 실패라고 말한다');
});

test('★★★ 둘 다 막히면 «말해 준다» — 안 그러면 붙여넣어 보고서야 안다', async () => {
  const w = world([SC('s1', '2026-07-13', 1, true)], {
    navigator: { clipboard: { writeText: () => Promise.reject(new Error('막힘')) } },
    document: {
      createElement: () => ({ style: {}, select: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
      execCommand: () => false,
    },
  });
  w.openTlZoom('c1', 't1');
  await w.tlZoomCopy();
  assert.strictEqual(w.__toastKind, 'err', '둘 다 막혔는데 아무 말이 없다');
});

test('★★ 복사할 것이 없으면 그렇다고 말한다', async () => {
  const w = world([]);
  w.openTlZoom('c1', 't1');
  await w.tlZoomCopy();
  assert.strictEqual(w.__toastKind, 'err', '빈 채로 복사해 빈 글을 붙여넣게 한다');
  assert.ok(!w.__newWay, '복사할 것이 없는데 클립보드를 건드린다');
});

/* ══ 붙어 있어야 뜻이 있다 ═════════════════════════════════════ */

test('★★★ 타임라인 왼쪽 «사업장 칸»에 누를 자리가 붙는다', () => {
  const fn = bare(grab('renderTimeline'));
  assert.ok(/data-zoomco="\$\{co\.id\}"/.test(fn), '사업장 아이디를 안 달아 둔다');
  assert.ok(/data-zoomtid="\$\{tid\}"/.test(fn), '어느 사업인지 안 달아 둔다 — 여러 사업이면 못 고른다');
  assert.ok(/openTlZoom\(/.test(fn), '누르기를 안 걸었다 — 달아만 두고 아무 일도 안 한다');
});

test('★★★ 회차 동그라미는 «그대로» 일정 고치기로 간다 — 두 길이 겹치면 안 된다', () => {
  const fn = bare(grab('renderTimeline'));
  assert.ok(/gantt-dot.*openEditModal/.test(fn.replace(/\s+/g, ' ')),
    '동그라미가 일정 고치기로 안 간다');
});

test('★★ 크게 보다가 «바로 고칠» 수 있다 — 보기만 되면 다시 찾아가야 한다', () => {
  const fn = bare(grab('renderTlZoom'));
  const flat = fn.replace(/\s+/g, '');
  assert.ok(/openEditModal\(/.test(fn), '칸을 눌러도 고치러 못 간다');
  /* ⚠ 글자만 찾으면 «맨 위»의 다른 closeModal(못 찾았을 때 닫는 줄)을 보고 통과한다 */
  assert.ok(/onclick=\(\)=>\{closeModal\('mbTlZoom'\);openEditModal/.test(flat),
    '창을 안 닫고 연다 — 창이 겹친다');
  assert.ok(/\.tzc'\)/.test(flat), '칸이 아니라 옛 «줄»을 찾는다 — 아무것도 안 걸린다');
});

test('★★ 창 뼈대가 있다 — 셈이 맞아도 그릴 데가 없으면 안 뜬다', () => {
  ['mbTlZoom', 'tzHead', 'tzSum', 'tzList', 'tzFoot'].forEach((id) => {
    assert.ok(new RegExp('id="' + id + '"').test(HTML), id + ' 이(가) 없다');
  });
});

test('★★★ 틀(CSS)이 «가로로 채우는 그리드»다 — 화면이 넓으면 더 많이 들어간다', () => {
  const i = STYLE.indexOf('.tz-grid{');
  assert.ok(i >= 0, '.tz-grid 가 없다');
  const box = STYLE.slice(i, i + 200).replace(/\s+/g, '');
  assert.ok(/display:grid/.test(box), '그리드가 아니다');
  /* auto-fill + minmax — 칸 수를 박지 않는다. 화면 폭에 따라 저절로 늘고 준다 */
  assert.ok(/auto-fill/.test(box), '칸 수를 못 박았다 — 좁은 화면에서 칸이 찌그러진다');
  assert.ok(/minmax\(/.test(box), '칸 너비에 바닥이 없다 — 날짜가 줄바꿈된다');
  const k = STYLE.indexOf('.tzc{');
  assert.ok(k >= 0, '.tzc 가 없다');
  assert.ok(/cursor:pointer/.test(STYLE.slice(k, k + 220).replace(/\s+/g, '')),
    '누를 수 있는 칸으로 안 보인다');
});

/* ══ 겹친 id — 2026-09-14 에 실제로 있었다 ═══════════════════ */

test('★★★ 화면에 «같은 id 가 두 번» 나오지 않는다', () => {
  /* 2026-09-06 에 넣개를 두 번 돌려 mbMerge 창이 글자 하나 안 다르게 둘이 됐다.
     id 가 겹치면 q('#…') 는 «첫 것»만 잡으므로 둘째는 죽은 채 붙어 있고,
     더 나쁘게는 첫 것이 빈 껍데기면 화면이 통째로 안 뜬다. */
  const ids = {};
  [...SRC.matchAll(/\sid="([^"]+)"/g)].forEach((m) => { ids[m[1]] = (ids[m[1]] || 0) + 1; });
  const dup = Object.entries(ids).filter(([, n]) => n > 1).map(([k, n]) => k + '(' + n + '번)');
  assert.deepStrictEqual(dup, [],
    '같은 id 가 여러 번 나온다: ' + dup.join(', ')
    + '\n  — 넣개를 두 번 돌렸거나 다른 방과 이름이 겹친 자리다');
});
