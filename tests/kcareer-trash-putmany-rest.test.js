/* 경력관리 휴지통 «일괄 반복문 넷»도 한 번에 담는다 (2026-11-16) — PR #3047 에서 증명서 표(_docTrashIds)만 kcTrashPutMany 로 바꾸고 남긴 자리
     ① 「이 화면 전체 삭제」 careerDelAll      ② 「골라 삭제」 careerDelSelected
     ③ 사업 골라 삭제 bizSelDel                ④ 작성 중 서류 골라 버리기 rhDraftTrashSel
   예전 모양: 건마다 `kcTrashPut` 을 불러 휴지통 «전체를 읽고 쓰기»를 N번 한다 → 수백 건이면 수백 번 저장하고,
   중간(이름표 짓기·저장)에 걸리면 «휴지통에는 있고 원 자료에도 남는» 반쪽 상태가 된다.
   화면 코드를 kcareer.html 에서 «함수 이름으로» 꺼내 가짜 환경에서 «진짜 함수»를 돌린다(주석 문구에 기대지 않는다). 합성 자료만 쓴다(저장소는 공개). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
/* 함수 하나를 «이름으로 통째» 꺼낸다 — 한 줄짜리는 그 줄, 여러 줄이면 맨 왼쪽 `}` 까지(이 파일의 함수는 모두 그렇게 닫힌다) */
const fn = (name) => {
  const m = new RegExp('(?:async )?function ' + name + '\\(').exec(html);
  assert.ok(m, '함수를 못 찾았다: ' + name);
  const rest = html.slice(m.index), firstLine = rest.slice(0, rest.search(/\r?\n/));
  const open = (firstLine.match(/\{/g) || []).length, close = (firstLine.match(/\}/g) || []).length;
  if (open > 0 && open === close) return firstLine;
  const end = /\r?\n\}/.exec(rest);
  assert.ok(end, '함수 끝을 못 찾았다: ' + name);
  return rest.slice(0, end.index + end[0].length);
};
const fns = (...names) => names.map(fn).join('\n');
const code = (name) => fn(name).replace(/\/\*[\s\S]*?\*\//g, '');            /* 주석 말고 코드만 */
const ids = (arr) => Array.from(arr, (x) => x.id);

/* ── 가짜 환경 — 휴지통 쓰기를 «몇 번 했나»·«어느 칸에 썼나»를 센다. 이름표 짓기가 걸리게 할 수 있다 ── */
function world(initial) {
  const store = Object.assign({ trash: [] }, JSON.parse(JSON.stringify(initial || {}))), writes = [];
  const st = { armed: false };                                               /* armed 이면 5번째 줄(…5)의 이름표 짓기에서 걸린다 */
  let seq = 0;
  const ctx = vm.createContext({
    TRASH_STORE: 'trash', TRASH_DAYS: 30, BIZ_STORE: 'biz', RH_DRAFTS: 'rh_drafts',
    console, Date, Array, String, Object, JSON,
    Math: Object.assign(Object.create(Math), { random: () => { seq += 1; return (seq * 0.137911) % 1; } }),
    get: (k) => JSON.parse(JSON.stringify(store[k] || [])),
    set: (k, v) => { writes.push(k); store[k] = JSON.parse(JSON.stringify(v)); },
    toast: (m) => ctx._toasts.push(String(m)),
    escapeHtml: (s) => String(s),
    kcTrashLabel: (r) => { if (st.armed && /5$/.test(String(r.id))) throw new Error('이름표 만들다 걸림'); return '이름 ' + r.id; },
    kcTrashFileIds: (r) => [r.id],
    kcAskDelete: (btn, opt, go) => { ctx._ask = opt; ctx._go = go; },
    kcUndoBar: (msg, tid, f) => ctx._undo.push({ msg, tid, f }),
    kcTrashDone: (e, msg) => { if (e) ctx._done.push({ tid: e.tid, msg }); },   /* 진짜 kcTrashDone 처럼 담은 줄이 없으면 아무 알림도 없다 */
    renderCareer: () => {}, renderBizList: () => {},
    _toasts: [], _undo: [], _done: [],
  });
  vm.runInContext(fns('kcTrashList', '_kcTrashEntry', 'kcTrashPutMany'), ctx);
  const trashWrites = () => writes.filter((k) => k === 'trash').length;
  return { ctx, store, writes, st, trashWrites, run: (src) => vm.runInContext(src, ctx) };
}
const rows = (p, n, extra) => Array.from({ length: n }, (_, i) => Object.assign({ id: p + (i + 1) }, extra));

/* ═══════════════ ① 이 화면 전체 삭제 ═══════════════ */
function careerWorld(fnName, 갈것수) {
  const w = world({ wiccok: rows('W', 갈것수, { type: '위촉장' }).concat([{ id: 'A1', type: '표창' }]) });
  w.ctx.CAREER_CFG = { wiccok: { store: 'wiccok', filter: (r) => r.type === '위촉장' } };
  w.ctx.careerSelIds = () => w.ctx._sel || [];
  w.run(fns(fnName));
  return w;
}
test('① 「이 화면 전체 삭제」 — 몇 건이든 휴지통은 «한 번» 쓴다(건마다 N번 쓰지 않는다)', () => {
  const w = careerWorld('careerDelAll', 6);
  w.run('careerDelAll("wiccok", null)'); w.run('_go()');
  assert.equal(w.trashWrites(), 1, '★ 휴지통에 ' + w.trashWrites() + '번 썼다 — 한 번이어야 한다');
  assert.deepEqual(ids(w.store.trash.map((e) => e.rec)), ['W6', 'W5', 'W4', 'W3', 'W2', 'W1'], '순서는 한 건씩 담던 때와 같다(마지막 건이 맨 위)');
  assert.deepEqual(ids(w.store.wiccok), ['A1'], '이 화면 것만 가고 같은 통의 다른 화면 자료(표창)는 남는다');
  assert.equal(new Set(w.store.trash.map((e) => e.tid)).size, 6, '번호(tid)가 겹치지 않는다');
  assert.ok(w.store.trash.every((e) => e.store === 'wiccok' && e.page === 'wiccok' && e.what === '전체 삭제'), '줄 모양(어느 보관함·어느 화면·무엇)은 그대로');
  assert.equal(w.ctx._undo.length, 1, '알림은 끝에 한 번');
  assert.match(w.ctx._undo[0].msg, /6건/);
});
test('① 담다가 걸리면 «아무것도» 바뀌지 않는다 — 휴지통에도 있고 원 자료에도 남는 반쪽이 안 생긴다', () => {
  const w = careerWorld('careerDelAll', 6);
  w.run('careerDelAll("wiccok", null)'); w.st.armed = true;
  assert.throws(() => w.run('_go()'), /걸림/);
  assert.equal(w.store.trash.length, 0, '★ 휴지통에 일부만 담겼다');
  assert.equal(w.store.wiccok.length, 7, '원 자료는 그대로');
  assert.equal(w.writes.length, 0, '아무 칸도 쓰지 않았다');
});

/* ═══════════════ ② 골라 삭제 ═══════════════ */
test('② 「골라 삭제」 — 고른 것만, 휴지통은 «한 번»', () => {
  const w = careerWorld('careerDelSelected', 6);
  w.ctx._sel = ['W2', 'W4', 'W5'];
  w.run('careerDelSelected("wiccok", null)'); w.run('_go()');
  assert.equal(w.trashWrites(), 1, '★ 휴지통에 ' + w.trashWrites() + '번 썼다');
  assert.deepEqual(ids(w.store.trash.map((e) => e.rec)), ['W5', 'W4', 'W2'], '마지막 건이 맨 위');
  assert.deepEqual(ids(w.store.wiccok), ['W1', 'W3', 'W6', 'A1'], '고르지 않은 줄은 그대로');
  assert.ok(w.store.trash.every((e) => e.what === '경력·실적' && e.page === 'wiccok'));
  assert.match(w.ctx._undo[0].msg, /3건/);
});
test('② 담다가 걸리면 «아무것도» 바뀌지 않는다', () => {
  const w = careerWorld('careerDelSelected', 6);
  w.ctx._sel = ['W2', 'W4', 'W5'];
  w.run('careerDelSelected("wiccok", null)'); w.st.armed = true;       /* 확인 쪽지에서 이름표를 읽은 «뒤에» 걸리게 한다 */
  assert.throws(() => w.run('_go()'), /걸림/);
  assert.equal(w.store.trash.length, 0);
  assert.equal(w.store.wiccok.length, 7);
  assert.equal(w.writes.length, 0);
});

/* ═══════════════ ③ 사업 골라 삭제 ═══════════════ */
function bizWorld(sel) {
  const w = world({ biz: rows('B', 5, { docs: [{ id: 'D' }] }) });
  w.ctx._bizChecked = () => sel;
  w.run(fns('bizSelDel'));
  return w;
}
test('③ 사업 골라 삭제 — 휴지통은 «한 번», 되살리기 손잡이는 예전과 같이 «마지막으로 담은 줄»', () => {
  const w = bizWorld(['B2', 'B4', 'B1']);
  w.run('bizSelDel(null)'); w.run('_go()');
  assert.equal(w.trashWrites(), 1, '★ 휴지통에 ' + w.trashWrites() + '번 썼다');
  assert.deepEqual(ids(w.store.trash.map((e) => e.rec)), ['B4', 'B2', 'B1'], '목록 순서대로 담고 마지막 건이 맨 위(B1·B2·B4 중 B4 가 마지막)');
  assert.deepEqual(ids(w.store.biz), ['B3', 'B5']);
  assert.equal(w.ctx._done.length, 1);
  assert.equal(w.ctx._done[0].tid, w.store.trash[0].tid, '손잡이는 맨 위(마지막으로 담은) 줄이다');
  assert.match(w.ctx._done[0].msg, /3건/);
  assert.ok(w.store.trash.every((e) => e.store === 'biz' && e.page === 'page-bizlist' && e.what === '사업'));
  assert.ok(w.store.trash.every((e) => e.rec.docs && e.rec.docs.length === 1), '딸린 서류도 줄과 함께 간다');
});
test('③ 담다가 걸리면 «아무것도» 바뀌지 않는다 — 사업도 서류도 그대로', () => {
  const w = bizWorld(['B1', 'B3', 'B5']);
  w.run('bizSelDel(null)'); w.st.armed = true;
  assert.throws(() => w.run('_go()'), /걸림/);
  assert.equal(w.store.trash.length, 0);
  assert.equal(w.store.biz.length, 5);
  assert.equal(w.writes.length, 0);
});
test('③ 고른 줄이 하나도 없으면(그새 지워짐) 휴지통을 쓰지 않는다', () => {
  const w = bizWorld(['B9']);
  w.run('bizSelDel(null)'); w.run('_go()');
  assert.equal(w.trashWrites(), 0, '담을 게 없으면 휴지통을 건드리지 않는다');
  assert.equal(w.ctx._done.length, 0, '담지 않았으니 되살리기 손잡이도 없다');
});

/* ═══════════════ ④ 작성 중 서류 골라 버리기 ═══════════════ */
function draftWorld(sel, 열어둔) {
  const w = world({ rh_drafts: rows('rh_draft_', 5, {}).map((d) => Object.assign(d, { name: '서식 ' + d.id })) });
  w.ctx._ids = sel; w.ctx._rhDraftId = 열어둔 || null;
  Object.assign(w.ctx, {
    rhDraftSelIds: () => w.ctx._ids, confirm: () => true,
    rhDraftAll: () => w.ctx.get('rh_drafts'), rhDraftPut: (a) => w.ctx.set('rh_drafts', a),
    rhDraftFind: (id) => w.ctx.get('rh_drafts').filter((d) => d.id === id)[0] || null,
    rhDraftDraw: () => {}, rhDraftCheck: () => {},
  });
  w.run(fns('rhDraftTrashSel'));
  return w;
}
const 남은 = (w) => ids(w.store.rh_drafts);
test('④ 작성 중 서류 — 휴지통은 «한 번», 그 자리를 열어 뒀으면 열린 표시도 지운다', () => {
  const w = draftWorld(['rh_draft_2', 'rh_draft_3'], 'rh_draft_3');
  w.run('rhDraftTrashSel(null)');
  assert.equal(w.trashWrites(), 1, '★ 휴지통에 ' + w.trashWrites() + '번 썼다');
  assert.deepEqual(ids(w.store.trash.map((e) => e.rec)), ['rh_draft_3', 'rh_draft_2'], '마지막 건이 맨 위');
  assert.deepEqual(남은(w), ['rh_draft_1', 'rh_draft_4', 'rh_draft_5']);
  assert.equal(w.ctx._rhDraftId, null, '버린 자리가 열려 있었으면 열린 표시를 비운다');
  assert.ok(w.store.trash.every((e) => e.store === 'rh_drafts' && e.page === 'page-resume-hub' && e.what === '작성 중 서류'));
  assert.match(w.ctx._toasts.join(' '), /2건을 휴지통으로 보냈습니다/, '건수는 «실제로 담은 건수»');
});
test('④ 버리지 않는 자리를 열어 뒀으면 열린 표시는 그대로', () => {
  const w = draftWorld(['rh_draft_2'], 'rh_draft_1');
  w.run('rhDraftTrashSel(null)');
  assert.equal(w.ctx._rhDraftId, 'rh_draft_1');
});
test('④ 목록에 없는 번호(그새 지워짐)는 건너뛰고, 건수는 «실제로 담은 만큼»', () => {
  const w = draftWorld(['rh_draft_2', 'rh_draft_9'], null);
  w.run('rhDraftTrashSel(null)');
  assert.deepEqual(ids(w.store.trash.map((e) => e.rec)), ['rh_draft_2']);
  assert.match(w.ctx._toasts.join(' '), /1건을 휴지통으로 보냈습니다/);
});
test('④ 담다가 걸리면 «아무것도» 바뀌지 않는다 — 목록도, 열어 둔 자리 표시도 그대로', () => {
  const w = draftWorld(['rh_draft_1', 'rh_draft_5'], 'rh_draft_1');
  w.st.armed = true;
  assert.throws(() => w.run('rhDraftTrashSel(null)'), /걸림/);
  assert.equal(w.store.trash.length, 0);
  assert.equal(남은(w).length, 5, '목록은 그대로');
  assert.equal(w.ctx._rhDraftId, 'rh_draft_1', '★ 담지도 못했는데 열어 둔 자리 표시만 지웠다');
  assert.equal(w.writes.length, 0);
});

/* ═══════════════ 못 박기 — 건마다 담는 옛 길이 돌아오지 않는다 ═══════════════ */
['careerDelAll', 'careerDelSelected', 'bizSelDel', 'rhDraftTrashSel'].forEach((name) => {
  test('「' + name + '」 는 휴지통에 «한 길»(kcTrashPutMany)로 담는다 — kcTrashPut 을 건마다 부르지 않는다', () => {
    const f = code(name);
    assert.equal((f.match(/kcTrashPutMany\(/g) || []).length, 1, '한 번에 담는 길을 한 번 부른다');
    assert.ok(!/kcTrashPut\(/.test(f), '건마다 담던 옛 길이 남아 있지 않다');
  });
});
