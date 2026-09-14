/* 「사업장을 클릭하면 날짜·요일과 방문 횟수를 크게 해서 한 번에」 (대표 지시 2026-09-14)
 *
 * ★ 알맹이는 «한 번에»다 — 한 회차를 두 줄로 쌓으면 열두 회차가 스물넷이 되어
 *   화면 한 장에 안 들어온다 (CLAUDE.md 「표의 한 칸은 한 줄」).
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
const CODE = bare(SRC);
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
    closeModal: () => { ctx.__closed = 1; },
    openEditModal: () => {},
    qa: () => [],
    q: (sel) => ({ set innerHTML(v) { out[sel] = v; }, classList: { add: () => { ctx.__opened = 1; } } }),
    Math, String, Array, Object, Number, isNaN, Date, JSON,
  }, over || {});
  ctx.__out = out;
  vm.createContext(ctx);
  vm.runInContext([grabArr('const TZ_DOW='), grab('tzDow'),
    'var _tzKey=null;', grab('openTlZoom'), grab('renderTlZoom')].join('\n'), ctx);
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

/* ══ 한 회차는 «한 줄» ═════════════════════════════════════════ */

test('★★★ 한 회차가 «한 줄»이다 — 두 줄로 쌓으면 한 번에 못 본다', () => {
  const w = world([SC('s1', '2026-07-02', 1, true), SC('s2', '2026-07-09', 2, false)]);
  w.openTlZoom('c1', 't1');
  const list = w.__out['#tzList'];
  const rows = (list.match(/class="tz-row/g) || []).length;
  assert.strictEqual(rows, 2, '회차 수와 줄 수가 다르다');
  /* 줄 안에 또 줄을 쌓지 않았는가 — 한 줄은 grid 칸으로만 갈린다.
     ⚠ 첫 판에 indexOf('tz-row', 10) 이 «같은 첫 것»을 다시 집어 자른 조각이 비었고,
       그래서 <br> 을 넣어도 검사가 통과했다. 첫 줄 «다음» 줄부터 찾는다. */
  const a0 = list.indexOf('tz-row');
  const a1 = list.indexOf('tz-row', a0 + 6);
  assert.ok(a1 > a0, '줄이 둘인데 하나로 읽힌다 — 자르는 자리가 틀렸다');
  const one = list.slice(a0, a1);
  assert.ok(one.length > 50, '첫 줄을 제대로 못 잘랐다');
  assert.ok(!/<br\s*\/?>/.test(one), '한 회차 안에서 줄을 바꾼다');
});

test('★★★ 날짜·요일·장소·담당이 «한 줄에 모두» 있다', () => {
  const w = world([SC('s1', '2026-07-02', 1, true)]);
  w.openTlZoom('c1', 't1');
  const list = w.__out['#tzList'];
  assert.ok(/07\. 02/.test(list), '날짜가 안 보인다');
  /* ⚠ 요일 «글자»를 박지 않는다 — 첫 판에 2026-07-02 를 수요일로 잘못 적어 놓고
       멀쩡한 코드를 의심했다(목요일이다). 어느 요일인지 맞는가는 위 tzDow 검사가
       이미 못 박았으니, 여기서는 «요일 칸이 채워졌는가»만 본다. */
  const wd = (list.replace(/\s+/g, ' ').match(/class="tz-w[^"]*">([^<]+)</) || [])[1] || '';
  assert.ok(/^[일월화수목금토]$/.test(wd), '요일이 안 보인다 (나온 것: ' + wd + ')');
  assert.ok(/방문/.test(list), '방문·사무실이 안 보인다');
  assert.ok(/홍길동/.test(list), '담당자가 안 보인다');
});

test('★★ 토·일은 달리 보인다 — 주말 방문은 눈에 걸려야 한다', () => {
  const w = world([SC('s1', '2026-09-19', 1, true)]);   // 토요일
  w.openTlZoom('c1', 't1');
  assert.ok(/tz-w we/.test(w.__out['#tzList']), '주말인데 평일과 똑같이 보인다');
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
  assert.ok(/openEditModal\(/.test(fn), '회차 줄을 눌러도 고치러 못 간다');
  /* ⚠ 글자만 찾으면 «맨 위»의 다른 closeModal(못 찾았을 때 닫는 줄)을 보고 통과한다 —
       «회차 줄을 누를 때» 닫고 여는지를 본다. */
  assert.ok(/onclick=\(\)=>\{closeModal\('mbTlZoom'\);openEditModal/.test(fn.replace(/\s+/g, '')),
    '창을 안 닫고 연다 — 창이 겹친다');
});

test('★★ 창 뼈대가 있다 — 셈이 맞아도 그릴 데가 없으면 안 뜬다', () => {
  ['mbTlZoom', 'tzHead', 'tzSum', 'tzList', 'tzFoot'].forEach((id) => {
    assert.ok(new RegExp('id="' + id + '"').test(HTML), id + ' 이(가) 없다');
  });
});

test('★★ 줄 모양(CSS)이 «그리드»다 — 글자 수가 달라도 자리가 안 흔들린다', () => {
  const i = STYLE.indexOf('.tz-row{');
  assert.ok(i >= 0, '.tz-row 가 없다');
  const box = STYLE.slice(i, i + 240).replace(/\s+/g, '');
  assert.ok(/display:grid/.test(box), '그리드가 아니다 — 이름 길이에 따라 날짜가 밀린다');
  assert.ok(/cursor:pointer/.test(box), '누를 수 있는 줄로 안 보인다');
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
    '같은 id 가 여러 번 나온다: ' + dup.join(', ') + '\n  — 넣개를 두 번 돌렸거나 다른 방과 이름이 겹친 자리다');
});
