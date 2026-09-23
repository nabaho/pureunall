/* 끌어서 다른 날로 옮기기 — 푸른 캘린더 (5걸음)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-21 「둘다」. 4걸음에서 법인 대시보드와 함께 사라진 것을 되살린다.

   ★ 이 검사가 지키는 것
     ① 옮길 수 있는 것과 아닌 것이 «손끝에서» 갈린다 — 잡히지도 않는 것을
        한참 끌어 보고서야 아는 것이 제일 나쁘다
     ② 우리 것은 저장 문(pu-cal-write)을 지난다 — 질러가면 잠긴 달·번호 규칙이 샌다
     ③ «바뀐 칸만» 보낸다 — 통째로 보내면 남이 그사이 고친 것을 덮는다
     ④ 구글 것은 로그인이 없으면 «안 옮겼다»고 분명히 말한다
        (조용히 실패하면 안 옮겨졌는데 옮겨진 줄 알고, 그날 사람이 안 온다)
     ⑤ 제자리에 놓으면 아무 일도 안 한다 — 쓰기만 늘고 바뀌는 것이 없다
     ⑥ 저장 문이 거절하면 «그대로 말한다»(잠긴 달 등)

   ⚠ dragover 에서 preventDefault 를 «해야» 놓을 수 있다 — 헷갈리기 쉬운 반대다.
     안 하면 끌리기는 하는데 아무 데도 안 놓인다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

function 함수몸(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 캘린더.indexOf('{', i); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return 캘린더.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* ── ① 무엇이 잡히나 ── */

function 칩그리기(e) {
  const 상자 = {
    S: { theme: 'light' }, ME: { sid: 'P-001' },
    esc: (v) => String(v == null ? '' : v),
    todayYMD: () => '2026-09-15',
    mixHex: (a) => a, textOn: () => '#fff',
    칩_어둠_누름: .14, 칩_옅게: .84,
    out: null
  };
  vm.createContext(상자);
  vm.runInContext(함수몸('function chipHtml(e, ymd){')
    + '\nout = chipHtml(' + JSON.stringify(e) + ', "2026-09-16");', 상자);
  return 상자.out;
}

test('①★ 우리 일정·근태·구글은 «잡힌다»', () => {
  [['sch', 'my_schedules'], ['att', 'attendance_records'], ['eum', 'attendance_records'],
   ['gcal', 'gcal']].forEach(([kind, store]) => {
    const h = 칩그리기({ kind: kind, store: store, id: 'x1', text: '일', color: '#2563eb', tip: '' });
    assert.match(h, /draggable="true"/, '★ ' + kind + ' 이 안 잡힙니다');
    assert.match(h, new RegExp('data-drag="' + store + ':x1"'), kind + ' 의 손잡이가 잘못 달렸습니다');
  });
});

test('①-2★ 사건 기한·휴직·공휴일은 «안 잡힌다» — 옮기면 주인 화면과 어긋난다', () => {
  ['stage-due', 'case-due', 'loa'].forEach((kind) => {
    const h = 칩그리기({ kind: kind, store: '', id: kind + ':2026-09-16:P-001',
      text: '기한', color: '#991b1b', tip: '', movable: false });
    assert.ok(h.indexOf('draggable="true"') < 0, '★ ' + kind + ' 이 잡힙니다');
    assert.ok(h.indexOf('data-drag=') < 0, '★ ' + kind + ' 에 손잡이가 달렸습니다');
  });
});

test('①-3 잡히는 것은 «잡을 수 있다»고 말해 준다 — 안 알려 주면 아무도 안 끈다', () => {
  const h = 칩그리기({ kind: 'sch', store: 'my_schedules', id: 'x1', text: '일', color: '#2563eb', tip: '회의' });
  assert.match(h, /끌어서 다른 날로 옮길 수 있습니다/, '설명이 없습니다');
  const g = 칩그리기({ kind: 'loa', store: '', id: 'loa:1', text: '휴직', color: '#2563eb',
    tip: '휴직', movable: false });
  assert.ok(g.indexOf('끌어서') < 0, '못 옮기는 것에 「끌 수 있다」고 적었습니다');
});

/* ── ②③⑤⑥ 우리 것을 옮긴다 ── */

function 옮김상자(옵션) {
  const o = 옵션 || {};
  const 담김 = { 부름: [], 알림: [] };
  const 상자 = {
    S: { busy: false }, GCAL: { evs: o.구글 || [] },
    GCAL_CAL_ID: 'cal@x',
    D: {}, JSON, Object, Array, String, Promise, setTimeout, console,
    render: () => {}, toast: (t) => { 담김.알림.push(t); },
    refreshOne: (st) => { 담김.부름.push(['refreshOne', st]); },
    발행예약: () => { 담김.부름.push(['발행예약']); },
    recOf: (store, id) => (o.있는것 || {})[store + ':' + id] || null,
    PuCalWrite: {
      save: (store, item, prev) => {
        담김.부름.push(['save', store, JSON.parse(JSON.stringify(item)), prev ? prev.date : null]);
        return Promise.resolve(o.저장답 || { ok: true });
      }
    },
    PuGcalAuth: o.구글없음 ? undefined : {
      hasToken: () => !!o.로그인,
      moveEvent: (cal, id, 날) => {
        담김.부름.push(['gcalMove', cal, id, 날]);
        return o.구글답 === 'fail' ? Promise.reject(new Error('구글이 거절했습니다'))
          : Promise.resolve({ moved: true });
      }
    },
    gcalLoad: () => { 담김.부름.push(['gcalLoad']); }
  };
  vm.createContext(상자);
  vm.runInContext(함수몸('function 옮기기(끈것, 새날){'), 상자);
  상자.__담김 = 담김;
  return 상자;
}
const 잠깐 = () => new Promise((r) => setImmediate(() => setImmediate(r)));

test('②★ 우리 것은 «저장 문»을 지난다 — 질러가면 잠긴 달·번호 규칙이 샌다', async () => {
  const b = 옮김상자({ 있는것: { 'attendance_records:a1': { id: 'a1', date: '2026-09-10', sid: 'P-001', type: 'leave' } } });
  vm.runInContext('옮기기("attendance_records:a1", "2026-09-17")', b);
  await 잠깐();
  const 쓴것 = b.__담김.부름.find((x) => x[0] === 'save');
  assert.ok(쓴것, '★ 저장 문을 안 지나고 옮겼습니다');
  assert.strictEqual(쓴것[1], 'attendance_records');
});

test('③★ «바뀐 칸만» 보낸다 — 통째로 보내면 남이 그사이 고친 것을 덮는다', async () => {
  const b = 옮김상자({ 있는것: { 'my_schedules:s1': { id: 's1', date: '2026-09-10', sid: 'P-001', title: '회의', note: '메모' } } });
  vm.runInContext('옮기기("my_schedules:s1", "2026-09-17")', b);
  await 잠깐();
  const 쓴것 = b.__담김.부름.find((x) => x[0] === 'save');
  assert.deepStrictEqual(Object.keys(쓴것[2]).sort(), ['date', 'id'],
    '★ 날짜 말고 다른 칸까지 보냅니다: ' + Object.keys(쓴것[2]).join(','));
  assert.strictEqual(쓴것[2].date, '2026-09-17');
  assert.strictEqual(쓴것[3], '2026-09-10', '★ 보던 판(prev)을 안 넘깁니다 — 옛 달 잠금을 못 봅니다');
});

test('⑤ 제자리에 놓으면 아무 일도 안 한다 — 쓰기만 늘고 바뀌는 것이 없다', async () => {
  const b = 옮김상자({ 있는것: { 'my_schedules:s1': { id: 's1', date: '2026-09-10' } } });
  vm.runInContext('옮기기("my_schedules:s1", "2026-09-10")', b);
  await 잠깐();
  assert.deepStrictEqual(b.__담김.부름, [], '★ 같은 날인데 서버에 썼습니다');
});

test('⑥★ 저장 문이 거절하면 «그대로 말한다» — 잠긴 달이 조용히 넘어가면 안 된다', async () => {
  const b = 옮김상자({
    있는것: { 'attendance_records:a1': { id: 'a1', date: '2026-07-10' } },
    저장답: { ok: false, message: '2026-07 은 마감된 달입니다' }
  });
  vm.runInContext('옮기기("attendance_records:a1", "2026-09-17")', b);
  await 잠깐();
  assert.match(b.__담김.알림.join(' '), /마감된 달/, '★ 거절당했는데 아무 말도 안 합니다');
  assert.ok(!b.__담김.부름.some((x) => x[0] === 'refreshOne'),
    '실패했는데 «고쳐진 것처럼» 다시 받습니다');
});

test('⑥-2 이음 근무를 옮기면 «바깥 공유 뷰»도 따라간다 — 안 걸면 옛 날짜가 남는다', async () => {
  const b = 옮김상자({ 있는것: { 'attendance_records:a1': { id: 'a1', date: '2026-09-10', type: 'eum-work' } } });
  vm.runInContext('옮기기("attendance_records:a1", "2026-09-17")', b);
  await 잠깐();
  assert.ok(b.__담김.부름.some((x) => x[0] === '발행예약'), '★ 공유 뷰가 옛 날짜 그대로입니다');
});

/* ── ④ 구글 것 ── */

test('④★ 로그인 없이는 «안 옮겼다»고 분명히 말한다 — 조용히 실패하면 그날 사람이 안 온다', async () => {
  const b = 옮김상자({ 로그인: false, 구글: [{ id: 'g1', date: '2026-09-10' }] });
  vm.runInContext('옮기기("gcal:g1", "2026-09-17")', b);
  await 잠깐();
  assert.ok(!b.__담김.부름.some((x) => x[0] === 'gcalMove'), '로그인 전인데 구글을 불렀습니다');
  assert.match(b.__담김.알림.join(' '), /구글 로그인이 필요합니다/, '★ 아무 말 없이 실패했습니다');
  assert.match(b.__담김.알림.join(' '), /옮기지 못했습니다/, '★ «안 됐다»는 말이 없습니다');
});

test('④-2 로그인돼 있으면 구글에 옮기고, 다시 받아 맞춘다', async () => {
  const b = 옮김상자({ 로그인: true, 구글: [{ id: 'g1', date: '2026-09-10' }] });
  vm.runInContext('옮기기("gcal:g1", "2026-09-17")', b);
  await 잠깐();
  const m = b.__담김.부름.find((x) => x[0] === 'gcalMove');
  assert.deepStrictEqual(m, ['gcalMove', 'cal@x', 'g1', '2026-09-17']);
  assert.ok(b.__담김.부름.some((x) => x[0] === 'gcalLoad'),
    '★ 구글에 다시 안 물어봅니다 — 진짜로 그리 됐는지 모르고 화면만 고칩니다');
});

test('④-3★ 구글이 거절하면 화면을 «고치지 않는다» — 고치면 옮겨진 줄 안다', async () => {
  const 구글 = [{ id: 'g1', date: '2026-09-10' }];
  const b = 옮김상자({ 로그인: true, 구글: 구글, 구글답: 'fail' });
  vm.runInContext('옮기기("gcal:g1", "2026-09-17")', b);
  await 잠깐();
  assert.strictEqual(구글[0].date, '2026-09-10', '★ 구글은 거절했는데 화면은 옮겨 놓았습니다');
  assert.match(b.__담김.알림.join(' '), /옮기지 못했습니다/);
  assert.match(b.__담김.알림.join(' '), /구글이 거절했습니다/, '구글이 한 말을 그대로 전하지 않습니다');
});

/* ── 손잡이가 실제로 달리나 ── */

test('★★ dragover 에서 preventDefault 를 «한다» — 안 하면 아무 데도 안 놓인다', () => {
  const 몸 = 함수몸('function 끌기손잡이(){');
  const i = 몸.indexOf("'dragover'");
  assert.ok(i > 0, 'dragover 손잡이가 없습니다');
  const 덩이 = 몸.slice(i, 몸.indexOf("'drop'"));
  assert.match(덩이, /e\.preventDefault\(\)/,
    '★ dragover 에서 preventDefault 를 안 합니다 — 끌리기는 하는데 안 놓입니다');
});

test('★ 손잡이는 «판 한 곳»에 단다 — 칩마다 달면 다시 그릴 때 빠진다', () => {
  const 몸 = 함수몸('function 끌기손잡이(){');
  assert.match(몸, /_끌기달림/, '★ 여러 번 달릴 수 있습니다 — 한 번 놓기가 두 번 돕니다');
  assert.match(캘린더, /\$\('app'\)\.innerHTML = html;[\s\S]{0,120}끌기손잡이\(\)/,
    '★ 다시 그린 뒤 손잡이를 안 답니다');
});

test('★ 바깥에서 dragstart 를 막지 않는다 — 막으면 안쪽 끌기가 통째로 죽는다', () => {
  /* 컨설팅일정이 이 덫에 일주일 걸렸다(2026-09-09) — dragstart 는 거품처럼 올라온다 */
  const 몸 = 함수몸('function 끌기손잡이(){');
  const i = 몸.indexOf("'dragstart'");
  const 덩이 = 몸.slice(i, 몸.indexOf("'dragend'"));
  assert.ok(덩이.indexOf('preventDefault') < 0,
    '★ dragstart 에서 preventDefault 를 합니다 — 끌기가 시작도 못 합니다');
});

/* ── 구글 쪽 셈 ── */

test('★ 종일 일정을 옮길 때 끝날을 «하루 뒤»로 둔다 — 안 그러면 길이 0 이 되어 사라진다', async () => {
  const A = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));
  globalThis._gcalToken = 'tok'; globalThis._gcalExpiry = Date.now() + 600000;
  const 보낸것 = [];
  const f = (url, opt) => {
    보낸것.push({ url, opt });
    const 종일 = { status: 200, ok: true, json: () => Promise.resolve({ id: 'g1', start: { date: '2026-09-10' }, end: { date: '2026-09-11' } }) };
    const 답 = { status: 200, ok: true, json: () => Promise.resolve({ id: 'g1' }) };
    return Promise.resolve(opt.method === 'GET' ? 종일 : 답);
  };
  await A.moveEvent('cal@x', 'g1', '2026-09-17', { fetch: f });
  const patch = JSON.parse(보낸것[1].opt.body);
  assert.deepStrictEqual(patch, { start: { date: '2026-09-17' }, end: { date: '2026-09-18' } },
    '★ 종일 일정의 끝날이 틀렸습니다 — 길이 0 이면 화면에서 사라집니다');
  assert.match(보낸것[1].url, /sendUpdates=none/, '참석자에게 알림이 나갑니다');
});

test('★ 시각이 있는 일정은 «시각을 그대로» 두고 날짜만 바꾼다', async () => {
  const A = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));
  globalThis._gcalToken = 'tok'; globalThis._gcalExpiry = Date.now() + 600000;
  const 보낸것 = [];
  const f = (url, opt) => {
    보낸것.push({ url, opt });
    const ev = { status: 200, ok: true, json: () => Promise.resolve({ id: 'g1',
      start: { dateTime: '2026-09-10T14:30:00+09:00' }, end: { dateTime: '2026-09-10T16:00:00+09:00' } }) };
    return Promise.resolve(opt.method === 'GET' ? ev : { status: 200, ok: true, json: () => Promise.resolve({ id: 'g1' }) });
  };
  await A.moveEvent('cal@x', 'g1', '2026-09-17', { fetch: f });
  const patch = JSON.parse(보낸것[1].opt.body);
  assert.strictEqual(patch.start.dateTime, '2026-09-17T14:30:00', '★ 시각이 바뀌었습니다');
  assert.strictEqual(patch.end.dateTime, '2026-09-17T16:00:00', '★ 끝 시각이 바뀌었습니다');
  assert.strictEqual(patch.start.timeZone, 'Asia/Seoul', '시간대를 안 적으면 브라우저 시간대로 잡힌다');
});

test('★ 날짜 꼴이 이상하면 «부르지 않는다» — 엉뚱한 날로 옮겨 놓고 모른다', async () => {
  const A = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));
  globalThis._gcalToken = 'tok'; globalThis._gcalExpiry = Date.now() + 600000;
  let 불렀나 = false;
  const f = () => { 불렀나 = true; return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) }); };
  await assert.rejects(() => A.moveEvent('cal@x', 'g1', '2026-9-1', { fetch: f }), /올바르지 않습니다/);
  assert.strictEqual(불렀나, false, '★ 이상한 날짜로 구글을 불렀습니다');
});
