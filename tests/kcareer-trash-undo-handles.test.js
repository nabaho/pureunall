/* 경력관리 «지운 직후 되살리기» 손잡이 (2026-11-22) — PR #3122 기록 «안 고친 것»에서 이어서
   ① 「이 화면 전체 삭제」(careerDelAll)·「골라 삭제」(careerDelSelected) 알림의 «↩ 되살리기» 는 번호(tid)도 fn 도 없이 만들어져
      눌러도 kcTrashRestore(null) → «휴지통에서 찾지 못했습니다»만 떴다(가짜 환경에서 눌러 재현: 27건 지운 뒤 되살리기 → 0건 돌아옴)
   ② 사업 골라 삭제(bizSelDel)는 마지막 한 건의 번호만 쥐어 «사업 N건»이라 알리고 1건만 되살렸다
   → 담은 줄(es) «전부»를 되살리는 공용 길(kcTrashDoneMany → kcTrashRestoreEntries)을 증명서 표(_docTrashIds)와 함께 쓴다.
   화면 코드를 kcareer.html 에서 «함수 이름으로» 꺼내 가짜 환경에서 «진짜 함수»를 돌린다(주석 문구에 기대지 않는다). 합성 자료만 쓴다(저장소는 공개). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const Q = require('../js/kcareer-hrcert.js');
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
const code = (name) => fn(name).replace(/\/\*[\s\S]*?\*\//g, '');
const ids = (arr) => Array.from(arr, (x) => x.id);

/* ── 가짜 환경 — 저장은 «몇 번·어느 칸에» 했는지 세고, 다시 그리기는 «어디를 몇 번» 그렸는지 센다 ── */
function world(initial, o) {
  o = o || {};
  const store = Object.assign({ trash: [] }, JSON.parse(JSON.stringify(initial || {}))), writes = [];
  let seq = 0;
  const ctx = vm.createContext({
    TRASH_STORE: 'trash', TRASH_DAYS: 30, BIZ_STORE: 'biz',
    console: { warn: () => {}, log: () => {} }, Date, Array, String, Object, JSON, Number,
    Math: Object.assign(Object.create(Math), { random: () => { seq += 1; return (seq * 0.137911) % 1; } }),
    get: (k) => JSON.parse(JSON.stringify(store[k] || [])),
    set: (k, v) => { writes.push(k); store[k] = JSON.parse(JSON.stringify(v)); },
    toast: (m, ms) => ctx._toasts.push({ m: String(m), ms }),
    escapeHtml: (s) => String(s),
    kcTrashLabel: (r) => '이름 ' + r.id, kcTrashFileIds: (r) => [r.id],
    kcAskDelete: (btn, opt, go) => { ctx._ask = opt; ctx._go = go; },
    kcUndoBar: (msg, tid, f) => ctx._undo.push({ msg, tid, f }),
    KcareerHrCert: o.noHrCert ? undefined : Q,
    getFileAsync: async () => { if (o.onFile) o.onFile(ctx, store); return o.file || null; }, saveFileUnified: (id, f) => ctx._saved.push(id),   /* onFile: 첨부 원본을 «기다리는 사이»에 끼어드는 일을 흉내 낸다 · _saved: 첨부를 쓴 번호들 */
    kcTrashRedraw: (e) => ctx._redraws.push(e.page || e.store),
    renderCareer: () => {}, renderBizList: () => {},
    _toasts: [], _undo: [], _redraws: [], _saved: [],
  });
  vm.runInContext(fns('kcTrashList', '_kcTrashEntry', 'kcTrashPutMany', 'kcTrashDoneMany', 'kcTrashRestoreEntries', 'kcTrashRestore', 'kcFreeId'), ctx);
  return { ctx, store, writes, run: (src) => vm.runInContext(src, ctx), undoNow: () => ctx._undo[ctx._undo.length - 1] };
}
const rows = (p, n, extra) => Array.from({ length: n }, (_, i) => Object.assign({ id: p + (i + 1) }, extra));
const flush = () => new Promise((r) => setImmediate(r));

/* ═══════════════ ① 이 화면 전체 삭제 · 골라 삭제 ═══════════════ */
function careerWorld(fnName, 갈것수) {
  const w = world({ wiccok: rows('W', 갈것수, { type: '위촉장' }).concat([{ id: 'A1', type: '표창' }]) });
  w.ctx.CAREER_CFG = { wiccok: { store: 'wiccok', filter: (r) => r.type === '위촉장' } };
  w.ctx.careerSelIds = () => w.ctx._sel || [];
  w.run(fns(fnName));
  return w;
}
test('① 「이 화면 전체 삭제」 뒤 «되살리기»를 누르면 지운 «전부»가 돌아온다 — 번호도 fn 도 없이 눌러 봤자 «못 찾았습니다»만 뜨던 것', async () => {
  const w = careerWorld('careerDelAll', 6);
  w.run('careerDelAll("wiccok", null)'); w.run('_go()');
  assert.deepEqual(ids(w.store.wiccok), ['A1']); assert.equal(w.store.trash.length, 6);
  const u = w.undoNow();
  assert.ok(u && typeof u.f === 'function', '★★ 되살리기 손잡이가 «할 일»을 쥐고 있다(옛 모양: 번호도 함수도 없음)');
  assert.equal(u.tid, null);
  assert.match(u.msg, /6건/); assert.match(u.msg, /환경설정 › 휴지통/, '어디서 되살리는지 말하는 꼬리는 그대로');
  await u.f();
  assert.equal(w.store.trash.length, 0, '★★★ 되살렸는데 휴지통에 남아 있다');
  assert.deepEqual(ids(w.store.wiccok), ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'A1'], '지운 줄이 옛 순서대로 돌아온다(다른 화면 자료는 그대로)');
  assert.ok(!w.ctx._toasts.some((t) => /찾지 못했습니다/.test(t.m)), '«휴지통에서 찾지 못했습니다» 가 뜨지 않는다');
  assert.match(w.ctx._toasts.map((t) => t.m).join(' '), /6건을 되살렸습니다/);
});
test('① 「골라 삭제」도 같다 — 고른 것만 돌아오고 고르지 않은 줄은 그대로', async () => {
  const w = careerWorld('careerDelSelected', 6);
  w.ctx._sel = ['W2', 'W4', 'W5'];
  w.run('careerDelSelected("wiccok", null)'); w.run('_go()');
  assert.deepEqual(ids(w.store.wiccok), ['W1', 'W3', 'W6', 'A1']);
  await w.undoNow().f();
  assert.equal(w.store.trash.length, 0);
  assert.deepEqual(ids(w.store.wiccok).sort(), ['A1', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6']);
  assert.deepEqual(ids(w.store.wiccok).slice(0, 3), ['W2', 'W4', 'W5'], '되살린 줄은 맨 앞에, 지운 차례대로');
});
test('① 한 건만 지웠으면 그 건의 번호로 되살린다(함수를 따로 주지 않는다 — 한 건 길 그대로)', async () => {
  const w = careerWorld('careerDelSelected', 3);
  w.ctx._sel = ['W2'];
  w.run('careerDelSelected("wiccok", null)'); w.run('_go()');
  const u = w.undoNow();
  assert.equal(u.tid, w.store.trash[0].tid, '그 건의 번호');
  assert.equal(u.f, undefined);
});

/* ═══════════════ ② 사업 골라 삭제 ═══════════════ */
test('② 사업을 여러 건 골라 지운 뒤 «되살리기» — 마지막 한 건만이 아니라 «전부» 돌아온다', async () => {
  const w = world({ biz: rows('B', 5, { docs: [{ id: 'D' }] }) });
  w.ctx._bizChecked = () => ['B2', 'B4', 'B5'];
  w.run(fns('bizSelDel'));
  w.run('bizSelDel(null)'); w.run('_go()');
  assert.deepEqual(ids(w.store.biz), ['B1', 'B3']);
  const u = w.undoNow();
  assert.ok(u && typeof u.f === 'function' && u.tid === null, '★★ 여러 건이면 «전부» 되살리는 함수를 준다');
  assert.match(u.msg, /사업 3건/);
  await u.f();
  assert.equal(w.store.trash.length, 0, '★★★ 1건만 돌아오고 나머지는 휴지통에 남았다');
  assert.deepEqual(ids(w.store.biz).sort(), ['B1', 'B2', 'B3', 'B4', 'B5']);
  assert.ok(w.store.biz.every((b) => !b.docs || b.docs.length === 1), '딸린 서류도 줄과 함께 돌아온다');
});

/* ═══════════════ 공용 길(kcTrashDoneMany · kcTrashRestoreEntries) ═══════════════ */
const put = (w, recs) => w.run('kcTrashPutMany("certdoc","",' + JSON.stringify(recs) + ',"증명서")');
const hr = (id, no, logId) => ({ id, kind: '재직증명서', docSrc: 'hr', hrCertNo: no, hrCertLogId: logId, date: '2026-11-12' });
test('다시 그리기는 «끝에 한 번만» — 건마다 그리면 수백 건을 되살릴 때 표를 수백 번 다시 그린다', async () => {
  const w = world({ certdoc: [] });
  const es = put(w, rows('CD', 40, { kind: '재직증명서' }));
  w.run('kcTrashDoneMany(' + JSON.stringify(es) + ', "🗑 40건")');
  await w.undoNow().f();
  assert.equal(w.store.certdoc.length, 40);
  assert.equal(w.ctx._redraws.length, 1, '★★ 다시 그린 횟수 ' + w.ctx._redraws.length + ' — 한 번이어야 한다');
});
test('한 건씩 되살리는 길(kcTrashRestore)은 예전처럼 «바로» 다시 그린다 — noRedraw 는 부르는 쪽이 정할 때만', async () => {
  const w = world({ certdoc: [] });
  const es = put(w, rows('CD', 2, { kind: '재직증명서' }));
  await w.ctx.kcTrashRestore(es[0].tid, true);
  assert.equal(w.ctx._redraws.length, 1, '기본값은 그대로 그린다');
  await w.ctx.kcTrashRestore(es[1].tid, true, true);
  assert.equal(w.ctx._redraws.length, 1, 'noRedraw 이면 그리지 않는다');
  assert.equal(w.store.certdoc.length, 2);
});
test('같은 발급번호가 그새 보관함에 생긴 줄은 되살리지 않고 휴지통에 그대로 두며, 그 건수를 밝힌다 · 되살린 수에 넣지 않는다', async () => {
  const w = world({ certdoc: [] });
  const es = put(w, [hr('CD0001', 'PU-2026-0001', 'L1'), hr('CD0002', 'PU-2026-0002', 'L2'), hr('CD0003', 'PU-2026-0003', 'L3')]);
  w.store.certdoc = [hr('CD0099', 'PU-2026-0002', 'L2b')];             /* 그새 같은 발급번호(0002)가 들어옴 */
  w.run('kcTrashDoneMany(' + JSON.stringify(es) + ', "🗑 3건")');
  await w.undoNow().f();
  assert.deepEqual(w.store.trash.map((e) => e.rec.id), ['CD0002'], '건너뛴 줄은 휴지통에 그대로');
  assert.deepEqual(ids(w.store.certdoc).sort(), ['CD0001', 'CD0003', 'CD0099']);
  const t = w.ctx._toasts[w.ctx._toasts.length - 1];
  assert.match(t.m, /2건을 되살렸습니다/); assert.match(t.m, /1건은 같은 발급번호/);
  assert.ok(t.ms > 5000, '건너뛴 줄이 있으면 알림을 더 오래 띄운다');
});
test('번호가 이미 쓰이고 있어 새 번호로 들어간 줄이 있으면 몇 건인지 밝힌다', async () => {
  const w = world({ certdoc: [] });
  const es = put(w, [{ id: 'CD0001', kind: '재직증명서' }, { id: 'CD0002', kind: '재직증명서' }]);
  w.store.certdoc = [{ id: 'CD0002', kind: '경력증명서' }];            /* 같은 번호가 다른 줄로 쓰이고 있다 */
  w.run('kcTrashDoneMany(' + JSON.stringify(es) + ', "🗑 2건")');
  await w.undoNow().f();
  assert.equal(w.store.trash.length, 0);
  assert.equal(w.store.certdoc.length, 3, '겹쳐도 덮어쓰지 않는다');
  assert.match(w.ctx._toasts[w.ctx._toasts.length - 1].m, /1건은 번호가 이미 쓰이고 있어 새 번호로/);
});
test('번호가 겹쳐 첨부 원본을 «기다리는 사이» 휴지통에 새 줄이 담겨도 사라지지 않는다 — 맨 위에서 읽어 둔 옛 목록을 그대로 쓰지 않는다(자동 검증 2026-11-22)', async () => {
  let 끼움 = false;
  const w = world({ certdoc: [{ id: 'CD0001', kind: '경력증명서' }] }, { onFile: (ctx, store) => {
    if (끼움) return; 끼움 = true;                                      /* 기다리는 동안 다른 곳에서 한 건을 지워 휴지통에 담았다 */
    store.trash = [{ tid: 'Tnew', store: 'certdoc', page: '', what: '증명서', rec: { id: 'CD0077', kind: '재직증명서' }, delAt: Date.now(), label: 'x', files: [] }].concat(store.trash);
  } });
  const es = put(w, [{ id: 'CD0001', kind: '재직증명서' }]);               /* 같은 번호(CD0001)가 이미 쓰이고 있어 새 번호로 들어간다 */
  const r = await w.ctx.kcTrashRestore(es[0].tid, true);
  assert.ok(r && r.renamed, '새 번호로 되살아났다');
  assert.deepEqual(w.store.trash.map((e) => e.tid), ['Tnew'], '★★ 그새 담긴 줄(Tnew)이 사라졌다 — 옛 목록으로 휴지통을 덮어썼다');
  assert.equal(w.store.certdoc.length, 2);
});
test('기다리는 사이 그 줄이 이미 다른 곳에서 꺼내지거나 지워졌으면 되살리지 않는다 — 같은 증명서가 두 줄이 되지 않는다', async () => {
  const w = world({ certdoc: [{ id: 'CD0001', kind: '경력증명서' }] }, { onFile: (ctx, store) => { store.trash = []; } });   /* 기다리는 동안 휴지통이 비워졌다(완전삭제·다른 곳에서 되살림) */
  const es = put(w, [{ id: 'CD0001', kind: '재직증명서' }]);
  const r = await w.ctx.kcTrashRestore(es[0].tid);
  assert.equal(r, null, '되살리지 않고 null');
  assert.deepEqual(ids(w.store.certdoc), ['CD0001'], '★★ 보관함에 그 줄이 또 들어왔다');
  assert.match(w.ctx._toasts[w.ctx._toasts.length - 1].m, /이미 꺼냈거나 지워진/);
  /* 조용히(quiet) 부를 때는 알림을 띄우지 않는다 — 여러 건 되돌리기가 건수를 모아 알린다 */
  const q = world({ certdoc: [{ id: 'CD0001', kind: '경력증명서' }] }, { onFile: (ctx, store) => { store.trash = []; } });
  const es2 = put(q, [{ id: 'CD0001', kind: '재직증명서' }]);
  assert.equal(await q.ctx.kcTrashRestore(es2[0].tid, true), null); assert.equal(q.ctx._toasts.length, 0);
});
test('기다리는 사이 그 줄이 완전삭제됐으면 첨부 사본도 쓰지 않는다 — 지워진 줄의 첨부가 남지 않는다(자동 검증 2026-11-22)', async () => {
  const w = world({ certdoc: [{ id: 'CD0001', kind: '경력증명서' }] }, { file: { name: 'a.hwpx' }, onFile: (ctx, store) => { store.trash = []; } });
  const es = put(w, [{ id: 'CD0001', kind: '재직증명서' }]);
  assert.equal(await w.ctx.kcTrashRestore(es[0].tid, true), null);
  assert.deepEqual(w.ctx._saved, [], '★★ 되살리지 않았는데 첨부를 새 번호로 써 버렸다');
  /* 줄이 그대로 있으면 새 번호로 첨부를 옮긴다(전과 같음) */
  const ok = world({ certdoc: [{ id: 'CD0001', kind: '경력증명서' }] }, { file: { name: 'a.hwpx' } });
  const es2 = put(ok, [{ id: 'CD0001', kind: '재직증명서' }]);
  const r = await ok.ctx.kcTrashRestore(es2[0].tid, true);
  assert.deepEqual(ok.ctx._saved, [r.id]); assert.notEqual(r.id, 'CD0001');
});
test('기다리는 사이 다른 줄이 «새 번호»로 정해 둔 번호를 먼저 썼어도 번호가 겹치지 않는다 — 번호를 기다린 뒤에 다시 정한다(자동 검증 2026-11-22)', async () => {
  const w = world({ certdoc: [{ id: 'CD0001', kind: '경력증명서' }] }, { file: { name: 'a.hwpx' }, onFile: (ctx, store) => {
    store.certdoc = store.certdoc.concat([{ id: 'CD0002', kind: '비용' }]);        /* 기다리는 동안 다른 곳이 CD0002 를 썼다(되살리기 전에 정해 둔 새 번호) */
  } });
  const es = put(w, [{ id: 'CD0001', kind: '재직증명서' }]);
  const r = await w.ctx.kcTrashRestore(es[0].tid, true);
  const all = ids(w.store.certdoc);
  assert.equal(new Set(all).size, all.length, '★★ 번호가 겹쳤다: ' + all.join(','));
  assert.equal(r.id, 'CD0003', '그새 쓰인 번호를 피해 다시 정한다');
  assert.deepEqual(w.ctx._saved, ['CD0003'], '첨부도 «최종 번호»로 쓴다(덮어쓰지 않는다)');
  assert.equal(w.store.certdoc.length, 3, '아무 줄도 덮이지 않았다');
});
test('기다리는 사이 겹치던 번호가 비었으면(옛 줄이 지워짐) 번호를 바꾸지 않고 제 번호로 되살린다', async () => {
  const w = world({ certdoc: [{ id: 'CD0001', kind: '경력증명서' }] }, { file: { name: 'a.hwpx' }, onFile: (ctx, store) => { store.certdoc = []; } });
  const es = put(w, [{ id: 'CD0001', kind: '재직증명서' }]);
  const r = await w.ctx.kcTrashRestore(es[0].tid, true);
  assert.equal(r.id, 'CD0001'); assert.equal(r.renamed, false); assert.deepEqual(w.ctx._saved, [], '번호가 그대로면 첨부를 옮길 일이 없다');
  assert.deepEqual(ids(w.store.certdoc), ['CD0001']);
});
test('번호가 겹치지 않으면 기다림이 없다 — 예전처럼 곧바로 되살리고 목록도 다시 읽지 않는다', async () => {
  const w = world({ certdoc: [] });
  const es = put(w, [{ id: 'CD0001', kind: '재직증명서' }]);
  const r = await w.ctx.kcTrashRestore(es[0].tid, true);
  assert.ok(r && !r.renamed); assert.equal(w.store.trash.length, 0); assert.deepEqual(ids(w.store.certdoc), ['CD0001']);
});
test('한 건이 걸려도 나머지는 계속 되살린다 — 한 줄이 던져도 되돌리기가 멈추지 않는다', async () => {
  const w = world({ certdoc: [] });
  const es = put(w, rows('CD', 3, { kind: '재직증명서' }));
  const real = w.ctx.kcTrashRestore;
  w.ctx.kcTrashRestore = async (tid, q, nr) => { if (tid === es[1].tid) throw new Error('걸림'); return real(tid, q, nr); };
  w.run('kcTrashDoneMany(' + JSON.stringify(es) + ', "🗑 3건")');
  await w.undoNow().f();
  assert.deepEqual(ids(w.store.certdoc).sort(), ['CD1', 'CD3'], '걸린 한 건만 남고 나머지는 돌아온다');
  assert.deepEqual(w.store.trash.map((e) => e.rec.id), ['CD2'], '걸린 줄은 휴지통에 그대로');
  assert.match(w.ctx._toasts[w.ctx._toasts.length - 1].m, /2건을 되살렸습니다/);
});
test('담은 줄이 없으면(빈 목록·없는 줄뿐) 알림도 손잡이도 띄우지 않는다', () => {
  const w = world({});
  w.run('kcTrashDoneMany([], "🗑 0건")'); w.run('kcTrashDoneMany(null, "x")'); w.run('kcTrashDoneMany([null, undefined], "x")');
  assert.equal(w.ctx._undo.length, 0);
});

/* ═══════════════ 못 박기 — 번호도 함수도 없는 되살리기 알림이 돌아오지 않는다 ═══════════════ */
['careerDelAll', 'careerDelSelected', 'bizSelDel', '_docTrashIds'].forEach((name) => {
  test('「' + name + '」 는 지운 뒤 «전부 되살리는» 공용 길(kcTrashDoneMany)을 쓴다 — 번호 없는 kcUndoBar 를 직접 부르지 않는다', () => {
    const f = code(name);
    assert.equal((f.match(/kcTrashDoneMany\(/g) || []).length, 1, '공용 길을 한 번 부른다');
    assert.ok(!/kcUndoBar\(/.test(f), '되살리기 알림을 직접 만들지 않는다');
    assert.ok(!/kcTrashDone\(/.test(f), '마지막 한 건의 번호만 쥐는 옛 길(kcTrashDone)을 쓰지 않는다');
  });
});
