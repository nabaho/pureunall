'use strict';
// 🧹 치울 것 — 「진행중」이 왜 안 닫히는지로 가른다 — node --test tests/work-clean-up.test.js
//
// 대표 지시 2026-10-05 「업무가 다 지나갔는데도 여전히 있는데 이부분 어떻게 처리해야되나」
//
// ■ 실측 2026-10-04 (진행중 478건) — 최근 두 달 안에 사람이 기록을 쓴 것은 14건뿐이었다
//     자문·급여 217 · 이알피가 열어 둔 것 97 · 엑셀 161 · 원본 없음 3
//   「이알피는 끝났는데 업무관리만 열린」 것은 0건 — 동기화는 제대로 돈다.
//
// ■ 이 검사가 지키는 것 — «규칙»이지 지금 값이 아니다
//   ①★ 네 덩어리로 «왜 멈췄는지»를 가른다 (자문 · 엑셀 · 이알피 · 원본없음)
//   ②  자문·급여는 「마지막 기록이 오래됐다」로 판단하지 않는다 — 끝나는 일이 아니다
//   ③★ 이알피가 열어 둔 것(㉡)에는 종료 길이 «없다» — 두 곳이 서로를 되돌리며 싸운다
//   ④  미리 고르는 것은 «오래 멈춘 엑셀 건»뿐 — 기록 없는 것은 미리 안 고른다
//   ⑤★ 한꺼번에 종료는 «한 번에» 보낸다 · 그사이 남이 닫은 줄은 건너뛴다 · 이알피에 안 민다
//   ⑥  아무것도 안 골랐으면 아무것도 안 바뀐다
//   ⑦  목록 맨 왼쪽은 ☐ + 번호 (대표 지시 2026-10-05, 모든 프로그램)
//   ⑧  마스터를 못 읽었을 때 전건을 「원본 없음」으로 몰지 않는다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}
/* 주석을 걷는다 — 「없어야 한다」를 볼 때 주석에 적힌 말이 통과시켜 주면 안 된다 */
function bare(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

const DAY = 24 * 60 * 60 * 1000;
const ago = (months) => new Date(Date.now() - months * 30.4 * DAY).toISOString().slice(0, 10);

/* 업무 한 벌 — 네 덩어리가 모두 들어 있다. 예시 이름은 가나상사·홍길동. */
function seed() {
  return {
    A1: { company: '가나상사', cat: '자문', src: 'puerp', ref: { type: 'companies', id: 'co-1' },
          mgr_main: { sid: 'S1', name: '홍길동' } },                       // 자문 — 기록 없음
    E1: { company: '다라산업', cat: '컨설팅', src: 'excel',
          last: { d: ago(11), t: '보고서' }, mgr_main: { sid: 'S1', name: '홍길동' } },
    E2: { company: '마바테크', cat: '기타', src: 'excel',
          last: { d: ago(1), t: '방문' }, mgr_main: { sid: 'S1', name: '홍길동' } },
    E3: { company: '사아물산', cat: '컨설팅', src: 'excel',
          mgr_main: { sid: 'S1', name: '홍길동' } },                        // 엑셀인데 기록이 없다
    P1: { company: '자차상사', cat: '사건', src: 'puerp', ref: { type: 'cases', id: 'c-1' },
          mgr_main: { sid: 'S1', name: '홍길동' } },
    G1: { company: '카타공업', cat: '기타사업', src: 'puerp', ref: { type: 'other', id: 'o-1' },
          pe_gone: true, mgr_main: { sid: 'S1', name: '홍길동' } },
    D1: { company: '파하산업', cat: '사건', src: 'puerp', ref: { type: 'cases', id: 'c-9' },
          state: 'done', mgr_main: { sid: 'S1', name: '홍길동' } }          // 이미 끝난 것
  };
}

function box(opts) {
  const o = opts || {};
  const b = {
    console, String, Object, Array, Number, Boolean, Date, Math, JSON, Promise, isNaN,
    writes: [], toasts: [], routed: 0,
    NS: 'work_erp', S: { me: { sid: 'S1', name: '홍길동', title: o.title || '노무사' } },
    items: o.items || seed(),
    peMaster: o.peMaster === undefined ? { cases: [{ id: 'c-1' }], other: [] } : o.peMaster,
    END_BY_KEY: { done: ['done', '종료'] },
    fbDb: { ref: () => ({ update: (up) => { b.writes.push(up); return Promise.resolve(); } }) },
    $: () => null
  };
  vm.createContext(b);
  vm.runInContext(
    'var wsSel={}, wsPreOn=0;\n'
    + (W.match(/var WS_CLEAN_MONTHS\s*=\s*\d+;/) || ['var WS_CLEAN_MONTHS=6;'])[0] + '\n'
    + 'function toast(t,k){ toasts.push(t); }\nfunction route(){ routed++; }\n'
    + 'function renderClean(){ }\nfunction todayStr(){ return "2026-10-05"; }\n'
    + 'function wsCountPaint(){ }\n'
    + 'var _ok=true; function confirmM(m,o){ return Promise.resolve(_ok); }\n'
    + ['allItems', 'openItems', 'isOf', 'isAdmin', 'viewer', 'peLinked', 'peRec',
       'wsAdv', 'wsCleanGroup', 'wsStaleMon', 'wsAllOn', 'wsWho', 'wsCleanList',
       'wsCleanPre', 'wsCleanCount', 'wsSelKey', 'wsSelOf', 'wsPick', 'wsPickAll',
       'wsCloseSel'].map(grab).join('\n'), b);
  return b;
}
const run = (b, src) => vm.runInContext(src, b);

// ══════════════════════════════════════════════════════════════════
test('① ★ 네 덩어리로 «왜 멈췄는지»를 가른다', () => {
  const b = box();
  const g = (id) => run(b, 'wsCleanGroup(items["' + id + '"])');
  assert.equal(g('A1'), 'adv', '★ 자문·급여를 끝낼 수 있는 일로 보고 있습니다');
  assert.equal(g('E1'), 'excel', '★ 엑셀에서 온 것을 못 가려냅니다 — 아무도 못 닫는 쪽입니다');
  assert.equal(g('P1'), 'pe', '★ 이알피가 열어 둔 것을 못 가려냅니다');
  assert.equal(g('G1'), 'gone', '★ 원본이 없는 것을 못 가려냅니다');
  assert.equal(g('D1'), '', '이미 끝난 업무는 치울 것이 아닙니다');
});

test('②  자문·급여는 「마지막 기록이 오래됐다」로 판단하지 않는다 — 끝나는 일이 아니다', () => {
  const it = seed();
  it.A1.last = { d: ago(24), t: '옛 기록' };          // 두 해 전에 멈춰 보여도
  const b = box({ items: it });
  assert.equal(run(b, 'wsCleanGroup(items["A1"])'), 'adv',
    '★ 자문이 치울 것으로 들어갑니다 — 계약이 살아 있는 동안 계속 가는 일입니다');
  assert.ok(!run(b, 'wsCleanList("excel").concat(wsCleanList("pe"),wsCleanList("gone"))')
    .some((x) => x.company === '가나상사'), '★ 자문이 치울 것 목록에 섞여 있습니다');
});

test('③ ★ 이알피가 열어 둔 것에는 종료 길이 없다 — 두 곳이 서로를 되돌리며 싸운다', () => {
  const rc = bare(grab('renderClean'));
  const peSec = rc.slice(rc.indexOf("wsSecHTML('pe'"), rc.indexOf("wsSecHTML('gone'"));
  assert.ok(peSec.indexOf('wsCloseSel') < 0,
    '★ 이알피가 열어 둔 덩어리에 종료 단추가 붙었습니다 — 다음 동기화에 도로 열립니다');
  /* 줄 그리개 쪽에 이알피로 데려가는 길이 있어야 한다 — 못 닫는다고만 하고 끝나면 안 된다 */
  const row = bare(grab('wsRowHTML'));
  const peRow = row.slice(row.indexOf("g==='pe'"));
  assert.ok(peRow.indexOf('openPuerp') >= 0,
    '★ 이알피로 데려가는 길이 없습니다 — 못 닫는다고만 하고 끝납니다');
  assert.ok(row.indexOf('wsCloseSel') < 0, '★ 줄마다 종료 단추가 붙었습니다');
});

test('④  미리 고르는 것은 «오래 멈춘» 것뿐 — 기록 없는 것은 미리 안 고른다', () => {
  const b = box();
  const pre = (id) => run(b, 'wsCleanPre(items["' + id + '"])');
  assert.equal(pre('E1'), true, '★ 11개월 멈춘 것을 미리 안 골랐습니다');
  assert.equal(pre('E2'), false, '★ 한 달 전에 움직인 것을 미리 골랐습니다');
  assert.equal(pre('E3'), false,
    '★ 기록 없는 것을 미리 골랐습니다 — 방금 들어온 새 업무일 수 있습니다');
  /* 잣대는 «대표가 고른 값»이라 박는다 (검사고정-허용).
     2026-10-05 처음 반년으로 냈다가 「석달로」 바꾸셨다. 실측으로 미리 고르는 수가
     61건 → 112건이 된다 — 조용히 되돌아가면 51건이 눈에서 사라진다.
     바꾸려면 대표에게 다시 물어야 한다. */
  assert.equal(Number(run(b, 'WS_CLEAN_MONTHS')), 3,
    '★ 대표가 정한 잣대입니다 (2026-10-05 「석달로」) — 바꾸려면 대표 확인이 필요합니다');  // 검사고정-허용
});

test('⑤ ★ 한꺼번에 종료는 «한 번에» 보낸다 · 이알피에 안 민다', async () => {
  const b = box();
  run(b, 'wsPick("excel","E1",true); wsPick("excel","E3",true);');
  await run(b, 'wsCloseSel("excel")');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(b.writes.length, 1, '★ 건마다 따로 보내고 있습니다 — 반쯤 하다 멈춥니다');
  const up = b.writes[0];
  assert.equal(up['work_erp/items/E1/state'], 'done');
  assert.equal(up['work_erp/items/E3/state'], 'done');
  assert.ok(up['work_erp/items/E1/done_date'], '★ 종료일이 안 찍힙니다');
  assert.ok(!('work_erp/items/E2/state' in up), '★ 안 고른 줄까지 닫고 있습니다');
  /* 보내는 길에 푸른이알피 자리가 섞이면 안 된다 */
  assert.ok(!Object.keys(up).some((k) => k.indexOf('data/') === 0),
    '★ 푸른이알피를 건드리고 있습니다 — 여기서 닫는 것은 업무관리 쪽 정리입니다');
  assert.ok(!Object.keys(up).some((k) => /sync_ping/.test(k)),
    '★ 이알피 동기화를 깨우고 있습니다');
});

test('⑤-1 ★ 그사이 남이 닫은 줄은 건너뛴다 — 남의 종료를 덮지 않는다', async () => {
  const b = box();
  run(b, 'wsPick("gone","G1",true);');
  run(b, 'items.G1.state="done";');          // 다른 사람이 먼저 닫았다
  await run(b, 'wsCloseSel("gone")');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(b.writes.length, 0, '★ 이미 닫힌 줄을 다시 쓰고 있습니다');
  assert.ok(b.toasts.join(' ').indexOf('이미') >= 0, '★ 왜 아무 일도 안 일어났는지 말해야 합니다');
});

test('⑤-2 ★ 이알피와 이어진 줄을 닫을 땐 동기화를 끊는다 — 안 그러면 도로 열린다', async () => {
  const b = box();
  run(b, 'wsPick("gone","G1",true);');
  await run(b, 'wsCloseSel("gone")');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(b.writes[0]['work_erp/items/G1/pe_nosync'], true,
    '★ 이알피와 이어진 줄을 끊지 않고 닫으면 다음 동기화가 되살립니다');
  const b2 = box();
  run(b2, 'wsPick("excel","E1",true);');
  await run(b2, 'wsCloseSel("excel")');
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(!('work_erp/items/E1/pe_nosync' in b2.writes[0]),
    '이알피와 안 이어진 줄에는 끊을 것이 없습니다');
});

test('⑥  아무것도 안 골랐으면 아무것도 안 바뀐다', async () => {
  const b = box();
  await run(b, 'wsCloseSel("excel")');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(b.writes.length, 0, '★ 안 골랐는데 저장했습니다');
  assert.ok(b.toasts.join(' ').indexOf('골라') >= 0, '★ 왜 아무 일도 안 일어났는지 말해야 합니다');
});

test('⑦  목록 맨 왼쪽은 ☐ + 번호 (대표 지시 2026-10-05 · 모든 프로그램)', () => {
  const row = bare(grab('wsRowHTML'));
  const ck = row.indexOf('class="wsck"'), nm = row.indexOf('class="wscn"');
  assert.ok(ck >= 0, '★ 고르기 칸(☐)이 없습니다');
  assert.ok(nm >= 0, '★ 번호 칸이 없습니다');
  assert.ok(ck < nm, '★ 고르기 칸이 번호보다 뒤에 있습니다 — 맨 왼쪽이 ☐ 입니다');
  /* 칸 너비가 CSS 에 실제로 있어야 한다 — 이름만 붙여 두면 좁게 두라는 규칙이 비어 버린다 */
  assert.match(W, /th\.wsck,td\.wsck\{/, '★ 고르기 칸 모양이 CSS 에 없습니다');
  assert.match(W, /th\.wscn,td\.wscn\{/, '★ 번호 칸 모양이 CSS 에 없습니다');
  const sec = bare(grab('wsSecHTML'));
  assert.ok(/wsPickAll/.test(sec), '★ 머리줄 「모두」 고르기가 없습니다');
  assert.ok(/wsn-/.test(sec), '★ 고른 건수를 안 보여 줍니다');
  /* 번호를 저장하거나 열쇠로 쓰면 안 된다 — 고르기·종료는 _id 로만 */
  assert.ok(!/wsSelKey\([^)]*,\s*i\b/.test(row), '★ 번호를 열쇠로 쓰고 있습니다');
});

test('⑦-1 고른 것은 화면을 떠나면 비운다 — 돌아왔을 때 모르는 것이 골라져 있으면 안 된다', () => {
  const b = box();
  vm.runInContext(grab('wsLeave'), b);
  run(b, 'wsPick("excel","E1",true); wsPreOn=1;');
  run(b, 'wsLeave("clean")');
  assert.equal(run(b, 'Object.keys(wsSel).length'), 1, '치울 것 화면 안에서는 그대로 둔다');
  run(b, 'wsLeave("my")');
  assert.equal(run(b, 'Object.keys(wsSel).length'), 0, '★ 화면을 떠나도 고른 것이 남아 있습니다');
  assert.equal(run(b, 'wsPreOn'), 0, '★ 미리 고르기가 다시 돌지 않습니다');
  /* route 가 실제로 이 길을 탄다 — 조건 뒤에 묻혀 있으면 안 된다 */
  assert.ok(bare(grab('route')).split('\n').some((l) => /^\s*wsLeave\(/.test(l)),
    '★ route 가 고른 것을 안 비웁니다 (조건 뒤에 묻혀 있지 않은지도 봅니다)');
  const sc = bare(grab('wsScope'));
  assert.match(sc, /wsSel\s*=\s*\{\}/, '★ 보는 범위를 바꿔도 안 보이는 줄이 골라진 채 남습니다');
});

test('⑧  마스터를 못 읽었으면 전건을 「원본 없음」으로 몰지 않는다', () => {
  const b = box({ peMaster: {} });                     // 한 유형도 못 읽음
  assert.equal(run(b, 'wsCleanGroup(items["P1"])'), 'pe',
    '★ 읽기 실패를 「원본이 없다」로 읽고 있습니다 — 멀쩡한 업무가 통째로 넘어갑니다');
  assert.equal(run(b, 'wsCleanGroup(items["G1"])'), 'gone',
    'pe_gone 딱지가 붙은 것은 마스터가 없어도 원본 없음입니다');
});

test('⑨  대표는 전 직원, 나머지는 자기 것 — 멈춘 일은 열 사람에게 흩어져 있다', () => {
  const it = seed();
  it.X1 = { company: '타파상사', cat: '컨설팅', src: 'excel',
            last: { d: ago(9), t: '남의 일' }, mgr_main: { sid: 'S9', name: '김철수' } };
  const staff = box({ items: it, title: '노무사' });
  assert.ok(!run(staff, 'wsCleanList("excel")').some((x) => x.company === '타파상사'),
    '★ 남의 업무가 제 화면에 나옵니다');
  const ceo = box({ items: it, title: '대표노무사' });
  assert.ok(run(ceo, 'wsCleanList("excel")').some((x) => x.company === '타파상사'),
    '★ 대표 화면에 전 직원 것이 안 나옵니다 — 이 화면을 만든 뜻이 없습니다');
  assert.ok(run(ceo, 'wsCleanCount()') >= run(staff, 'wsCleanCount()'),
    '세는 범위도 보는 범위와 같아야 합니다');
});

test('⑩  오래 멈춘 것부터 — 기록 없는 것을 맨 앞에 둔다', () => {
  const b = box();
  const L = run(b, 'wsCleanList("excel").map(function(x){return x.company;})');
  assert.equal(L[0], '사아물산', '★ 기록이 아예 없는 것이 맨 앞이 아닙니다');
  assert.equal(L[L.length - 1], '마바테크', '★ 최근에 움직인 것이 맨 뒤가 아닙니다');
});
