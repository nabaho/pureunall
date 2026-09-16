/* 직원 색표 — «되돌아갈 색»을 서버에 올리지 않는다
   ─────────────────────────────────────────────────────────────────────────
   대표 제보 2026-09-16 「계속 문제가 발생한다」(콘솔 화면)

   ■ 무엇이 있었나
     법인 대시보드는 사람 색을 «구글 캘린더 색표»(gcalPalette)에서 가져온다.
     그 색표는 «늦게» 온다 — 오기 전까지는 STAFF_COLORS_FALLBACK(순번 색)을 쓴다.
     그런데 색을 서버에 올리는 자리가 그 사정을 몰라서, 켜자마자
       ① 되돌아갈 색으로 staff_colors 를 만들고
       ② 아직 서버 것을 못 받았는데도 dbSet 을 부른다
     dbSet 은 「초기 동기화 완료 전 — 서버 쓰기 보류」로 막아 두지만, 그 보류분은
     동기화가 끝난 뒤 _flushPendingLocalNewer 가 «그대로 서버로 민다».
     → 켤 때마다 콘솔에 세 줄이 찍히고, 쓸 일 없는 서버 쓰기가 한 번 더 나갔다.
     → 색표가 끝내 안 오면(구글 연결 안 됨·오프라인) «되돌아갈 색»이 서버에 남는다.
        data/staff_colors 는 사람 색을 «정하는 한 곳»이라 컨설팅일정의 색까지 함께 틀어진다.

   ★ 못 박는 것
     ① 서버 것을 받기 전에는 안 올린다
     ② 색표가 아직 안 왔으면 «이미 올라가 있는 것»을 덮지 않는다
     ③ 다만 아직 아무것도 없으면 되돌아갈 색이라도 올린다 (없는 것보다 낫다)
     ④ 색표가 왔고 달라졌으면 올린다 · 같으면 안 올린다
     ⑤ 관리자가 아니면 손대지 않는다 (서버 규칙이 어차피 거절한다) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* 색표를 올리는 useEffect 의 «속»만 꺼낸다 */
function bodyOfEffect() {
  const key = "var was = dbGet('staff_colors', {}) || {};";
  const ki = SRC.indexOf(key);
  assert.ok(ki > 0, '★ 색표를 올리는 자리를 못 찾았습니다');
  const head = 'useEffect(function(){';
  const start = SRC.lastIndexOf(head, ki);
  assert.ok(start > 0, '★ 그 자리를 감싼 useEffect 를 못 찾았습니다');
  const end = SRC.indexOf('}, [JSON.stringify(staffColorMap)]);', ki);
  assert.ok(end > start, '★ useEffect 의 끝을 못 찾았습니다');
  return SRC.slice(start + head.length, end);
}
const BODY = bodyOfEffect();

/* opts: {synced, palette, was, map, isAdmin} */
function run(opts) {
  const store = { staff_colors: opts.was === undefined ? {} : opts.was };
  const wrote = [];
  const ctx = {
    console, JSON, Object, Array, String, Number,
    CURRENT_USER: { sid: 'p001', name: '대표', isAdmin: opts.isAdmin !== false },
    _fbSynced: opts.synced !== false,
    gcalPalette: () => (opts.palette ? ['#a4bdfc', '#5484ed'] : null),
    staffColorMap: opts.map,
    dbGet: (k, d) => (k in store ? store[k] : d),
    dbSet: (k, v) => { wrote.push({ k, v }); store[k] = v; return true; },
    window: { _erpErrLog: null },
  };
  vm.createContext(ctx);
  vm.runInContext('var __run = function(){' + BODY + '\n};', ctx);
  ctx.__run();
  return wrote;
}

const 폴백 = { 'A-001': '#2563eb', 'A-002': '#16a34a' };
const 구글 = { 'A-001': '#a4bdfc', 'A-002': '#5484ed' };

/* ⚠ 여기서 색표는 «왔다»고 둔다(palette:true). 색표가 안 온 경우로 재면 아래 ② 검사가
   대신 막아 주어, _fbSynced 검사를 통째로 빼도 그냥 통과한다(이빨 확인에서 실제로 새어 나갔다).
   구글 색표는 빨리 오고 파이어베이스 첫 동기화는 늦는 일이 흔하므로, 이 상황이 진짜 상황이다. */
test('① 서버 것을 «받기 전»에는 안 올린다 — 보류분이 나중에 그대로 밀린다', () => {
  const w = run({ synced: false, palette: true, was: 구글, map: 폴백 });
  assert.equal(w.length, 0,
    '★★ 초기 동기화 전에 쓰면 dbSet 이 보류해 두었다가, 동기화가 끝난 뒤 그대로 서버로 밉니다.\n'
    + '   콘솔에 「초기 동기화 완료 전 — 보류」가 켤 때마다 찍히던 자리입니다.');
});

test('②★ 색표가 아직 «안 왔으면» 이미 올라가 있는 것을 덮지 않는다', () => {
  const w = run({ synced: true, palette: false, was: 구글, map: 폴백 });
  assert.equal(w.length, 0,
    '★★ 되돌아갈 색(순번 색)이 서버의 진짜 색을 덮습니다.\n'
    + '   data/staff_colors 는 사람 색을 «정하는 한 곳»이라 컨설팅일정의 색까지 같이 틀어집니다.');
});

test('③ 다만 «아직 아무것도 없으면» 되돌아갈 색이라도 올린다 — 없는 것보다 낫다', () => {
  const w = run({ synced: true, palette: false, was: {}, map: 폴백 });
  assert.equal(w.length, 1, '★ 빈 자리인데도 안 올리면 구글을 안 쓰는 관리자는 색을 영영 못 올립니다');
  assert.deepEqual(w[0].v, 폴백);
});

test('④ 색표가 왔고 달라졌으면 올린다', () => {
  const w = run({ synced: true, palette: true, was: 폴백, map: 구글 });
  assert.equal(w.length, 1, '★ 진짜 색이 왔는데 안 올립니다');
  assert.deepEqual(w[0].v, 구글);
});

test('④-2 같으면 안 올린다 — 그릴 때마다 부르는 자리라 그냥 쓰면 쓰기가 폭주한다', () => {
  const w = run({ synced: true, palette: true, was: 구글, map: 구글 });
  assert.equal(w.length, 0);
});

test('⑤ 관리자가 아니면 손대지 않는다', () => {
  const w = run({ synced: true, palette: true, was: 구글, map: 폴백, isAdmin: false });
  assert.equal(w.length, 0, '★ 서버 규칙이 거절합니다 — 조용히 실패하면 콘솔만 붉어집니다');
});

test('⑥ 사람이 하나도 없으면 아무 일도 안 한다', () => {
  const w = run({ synced: true, palette: true, was: 구글, map: {} });
  assert.equal(w.length, 0, '★ 빈 색표를 올리면 서버의 색이 통째로 날아갑니다');
});

/* ── 곁들여: 크롬이 켤 때마다 찍던 deprecated 경고 ── */
test('⑦ 화면들이 표준 meta 를 함께 달고 있다 — 크롬 deprecated 경고가 안 찍힌다', () => {
  ['pu-erp.html', 'pu-camera.html', 'pu-photos.html', 'work.html', 'kcareer.html'].forEach(f => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (s.indexOf('name="apple-mobile-web-app-capable"') < 0) return;   // 안 쓰는 화면은 넘어간다
    assert.ok(s.indexOf('name="mobile-web-app-capable"') >= 0,
      '★ ' + f + ' — apple- 쪽만 있으면 크롬이 켤 때마다 deprecated 경고를 찍습니다(둘 다 두면 됩니다)');
  });
});
