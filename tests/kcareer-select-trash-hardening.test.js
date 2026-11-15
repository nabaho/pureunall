/* 경력관리 «공유 고르기·휴지통 길» 약점 네 가지 (2026-11-15) — PR #3029 검토에서 «전부터 있던 공유 길»로 남겨 둔 것
   ① 끌어 고르기(bindDragSel)가 «누름·뗌이 타이머보다 먼저 끝나면» 끌기가 남는다(터치 탭·자동 클릭)
   ② 인사관리에서 당겨온 줄을 휴지통에서 되살릴 때 같은 발급번호가 보관함에 이미 있으면 두 줄이 된다
   ③ 일괄 삭제가 휴지통에 «건마다» 전체를 읽고 쓴다(N번 저장 · 중간에 걸리면 반쪽 상태)
   ④ 태블릿·좁은 노트북 폭에서 증명서 표가 좌우로 스크롤되면 ☐ 칸이 화면 밖으로 나간다
   화면 코드를 kcareer.html 에서 «함수 이름으로» 꺼내 가짜 환경에서 돌린다(주석 문구에 기대지 않는다). 합성 자료만 쓴다(저장소는 공개). */
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

/* ═══════════════ ① 끌어 고르기 — 끌기가 «남지» 않는다 ═══════════════ */
function dragWorld() {
  const handlers = {}, timers = [];
  const box = { dataset: {}, addEventListener: (t, f) => { handlers[t] = f; } };
  const mk = (checked) => { const c = { checked, closest: (s) => (s === '.row-chk' ? c : null) }; return c; };
  const body = { style: { userSelect: '' } };
  const synced = [], docL = [];                                            /* docL: document 에 걸린 click 듣는이(캡처 여부 포함) */
  const document = { body, addEventListener: (t, f, cap) => docL.push({ t, f, cap }), removeEventListener: (t, f) => { const i = docL.findIndex((l) => l.t === t && l.f === f); if (i >= 0) docL.splice(i, 1); } };
  const ctx = vm.createContext({ document, setTimeout: (f) => { timers.push(f); return timers.length; }, console });
  vm.runInContext('var _dragSel=null;\n' + fns('_dragSelEnd', '_dragSelSwallowClick', 'bindDragSel'), ctx);
  ctx.bindDragSel(box, () => synced.push(1));
  const down = (c, button) => handlers.mousedown({ target: c, buttons: 1, button: button || 0 });
  const over = (c, buttons) => handlers.mouseover({ target: c, buttons });
  const up = () => vm.runInContext('_dragSelEnd()', ctx);                 /* document 의 mouseup 이 부르는 것 */
  const state = () => vm.runInContext('_dragSel', ctx);
  const flush = () => { while (timers.length) timers.shift()(); };         /* 타이머(0)를 돌린다 */
  const clicks = () => docL.filter((l) => l.t === 'click');
  return { ctx, box, body, mk, down, over, up, state, timers, synced, handlers, flush, clicks };
}
test('① 터치 탭·자동 클릭처럼 «누름→뗌»이 한 작업 안에 끝나도 끌기가 남지 않는다 — 타이머에 기대지 않고 누른 자리에서 세운다', () => {
  const w = dragWorld(), a = w.mk(false), b = w.mk(false);
  w.down(a);
  assert.ok(w.state(), '누른 «그 자리에서» 끌기가 서 있다(타이머가 아직 안 돌았어도)');
  assert.equal(w.body.style.userSelect, 'none');
  w.up();                                         /* 뗌 — 타이머는 한 번도 안 돌았다 */
  assert.equal(w.timers.length, 0, '타이머로 미루지 않는다(미루면 뗌이 «아직 없는 끌기»를 지우고 지나간 뒤에 서 버린다)');
  assert.equal(w.state(), null, '뗐으면 끌기는 없다');
  assert.equal(w.body.style.userSelect, '', '글자 잡힘 막기도 풀린다');
  w.over(b, 0);                                   /* 손을 안 댄 채 지나가기만 */
  assert.equal(b.checked, false, '누르지 않고 지나가기만 하면 켜지지 않는다');
});
test('① 안전장치 — 누른 채가 아닌데 끌기가 남아 있으면(창 밖에서 뗌) 칠하지 않고 끝낸다', () => {
  const w = dragWorld(), a = w.mk(true), b = w.mk(false);
  w.down(a);                                      /* 뗌을 놓쳤다: mouseup 이 안 왔다 */
  w.over(b, 0);                                   /* 눌린 단추 없음 */
  assert.equal(b.checked, false, '칠하지 않는다');
  assert.equal(w.state(), null, '끌기를 거기서 끝낸다');
  assert.equal(w.body.style.userSelect, '');
  assert.ok(w.synced.length >= 1, '끝내면서 고른 상태를 한 번 맞춘다');
});
test('① 꺼진 칸에서 누른 채 끌면 «켜며 끌면 켠다» — 지나간 칸과 시작 칸이 모두 켜진다(전에는 아무것도 안 켜졌다)', () => {
  const w = dragWorld(), a = w.mk(false), b = w.mk(false), c = w.mk(true), d = w.mk(false);
  w.down(a);
  w.over(b, 1); w.over(c, 1); w.over(d, 1);
  assert.equal(a.checked, true, '시작 칸도 켜진다 — 다른 칸에서 떼면 시작 칸에는 click 이 안 간다');
  assert.equal(b.checked, true); assert.equal(c.checked, true); assert.equal(d.checked, true);
  const before = w.synced.length;
  w.up();
  assert.equal(w.synced.length, before + 1, '뗄 때 한 번 더 고른 상태를 맞춘다');
  assert.equal(w.state(), null);
});
test('① 켜진 칸에서 누른 채 끌면 «끄며 끌면 끈다» — 지나간 칸과 시작 칸이 모두 꺼진다', () => {
  const w = dragWorld(), a = w.mk(true), b = w.mk(true), c = w.mk(false), d = w.mk(true);
  w.down(a);
  w.over(b, 1); w.over(c, 1); w.over(d, 1);
  assert.equal(a.checked, false); assert.equal(b.checked, false); assert.equal(c.checked, false); assert.equal(d.checked, false);
});
test('① 끌지 않고 제자리에서 누르면 끌기 쪽은 시작 칸을 건드리지 않는다(바꾸는 것은 뒤따르는 click) · 다른 단추로는 시작하지 않는다', () => {
  const w = dragWorld(), a = w.mk(false);
  w.down(a); w.up();
  assert.equal(a.checked, false, '제자리 누름은 click 이 바꾼다 — 끌기 쪽이 먼저 바꾸면 click 이 도로 뒤집는다');
  assert.equal(w.clicks().length, 0, '끌지 않았으면 click 을 삼키지 않는다');
  const r = dragWorld(), b = r.mk(false), c = r.mk(false);
  r.down(b, 2);                                   /* 오른쪽 단추 */
  assert.equal(r.state(), null, '오른쪽·가운데 단추는 끌어 고르기를 시작하지 않는다');
  r.over(c, 1); assert.equal(c.checked, false);
});
test('① 시작 칸으로 돌아와 떼도 시작 칸이 도로 뒤집히지 않는다 — 칠한 끌기 뒤 이어지는 click 은 «한 번만» 삼키고 곧 거둔다', () => {
  const w = dragWorld(), a = w.mk(false), b = w.mk(false);
  w.down(a); w.over(b, 1); w.over(a, 1);          /* 시작 칸을 다시 지나가도 시작 칸은 그대로(이미 칠함) */
  assert.equal(a.checked, true);
  w.up();
  const l = w.clicks();
  assert.equal(l.length, 1, 'click 을 삼킬 듣는이가 하나 걸린다'); assert.equal(l[0].cap, true, '캡처 단계 — 체크칸이 받기 전에 막는다');
  let prevented = 0, stopped = 0;
  l[0].f({ preventDefault: () => prevented++, stopPropagation: () => stopped++ });
  assert.equal(prevented, 1); assert.equal(stopped, 1);
  assert.equal(w.clicks().length, 0, '삼킨 뒤 스스로 거둔다 — 다음 클릭을 잡아먹지 않는다');
  /* click 이 안 왔어도(다른 곳에서 뗌) 타이머가 거둔다 */
  const x = dragWorld(), p = x.mk(false), q = x.mk(false);
  x.down(p); x.over(q, 1); x.up();
  assert.equal(x.clicks().length, 1); x.flush();
  assert.equal(x.clicks().length, 0, 'click 이 안 와도 곧 거둔다');
});
test('① 끌기 끝내기는 한 곳 — 뗌(mouseup)이 같은 함수를 부르고, 칸마다 따로 묶지 않는다', () => {
  assert.match(html, /document\.addEventListener\('mouseup', _dragSelEnd\);/, '뗌은 _dragSelEnd 하나가 맡는다');
  assert.equal((html.match(/document\.addEventListener\('mouseup'/g) || []).length >= 1, true);
  const b = fn('bindDragSel').replace(/\/\*[\s\S]*?\*\//g, '');   /* 주석에 옛 방식 이름이 적혀 있어도 코드만 본다 */
  assert.ok(!/setTimeout\(/.test(b), '끌기를 타이머로 미루지 않는다');
  assert.match(b, /dragBound/, '한 번만 묶는다');
});

/* ═══════════════ ③ 휴지통 — 여러 건은 «한 번 읽고 한 번 쓴다» ═══════════════ */
function trashWorld(o) {
  o = o || {};
  const store = { trash: o.trash || [] }, sets = [];
  let seq = 0;
  const ctx = vm.createContext({
    TRASH_STORE: 'trash', console, Date, Array, String, Object,
    Math: Object.assign(Object.create(Math), { random: o.random || (() => { seq += 1; return (seq * 0.123457) % 1; }) }),
    get: (k) => JSON.parse(JSON.stringify(store[k] || [])),
    set: (k, v) => { sets.push(k); store[k] = JSON.parse(JSON.stringify(v)); },
    kcTrashLabel: o.label || ((r) => '이름 ' + r.id), kcTrashFileIds: (r) => [r.id],
  });
  vm.runInContext(fns('kcTrashList', '_kcTrashEntry', 'kcTrashPut', 'kcTrashPutMany'), ctx);
  return { ctx, store, sets };
}
const rec = (i) => ({ id: 'CD000' + i, kind: '재직증명서' });
test('③ 여러 건을 담아도 휴지통은 «한 번» 쓴다 — 건마다 N번 쓰지 않는다', () => {
  const w = trashWorld();
  const es = w.ctx.kcTrashPutMany('certdoc', '', [rec(1), rec(2), rec(3), rec(4)], '증명서');
  assert.equal(w.sets.length, 1, '저장은 한 번');
  assert.equal(es.length, 4); assert.equal(w.store.trash.length, 4);
  assert.deepEqual(Array.from(es, (e) => e.rec.id), ['CD0001', 'CD0002', 'CD0003', 'CD0004'], '돌려주는 것은 지운 순서');
});
test('③ 순서·모양은 한 건씩 담던 때와 같다 — 마지막 건이 맨 위, 이미 있던 것은 그 아래로 그대로', () => {
  const old = { tid: 'Told', store: 'x', rec: { id: 'OLD' }, delAt: 1, label: 'x', files: [] };
  const one = trashWorld({ trash: [old] }), many = trashWorld({ trash: [old] });
  [rec(1), rec(2), rec(3)].forEach((r) => one.ctx.kcTrashPut('certdoc', '', r, '증명서'));
  many.ctx.kcTrashPutMany('certdoc', '', [rec(1), rec(2), rec(3)], '증명서');
  const ids = (w) => w.store.trash.map((e) => e.rec.id);
  assert.deepEqual(ids(many), ids(one), '한 건씩 담은 순서와 같다');
  assert.equal(many.store.trash[3].tid, 'Told', '이미 있던 줄은 그대로 맨 아래');
  const keys = (e) => Object.keys(e).sort().join(',');
  assert.equal(keys(many.store.trash[0]), keys(one.store.trash[0]), '한 건 담기와 줄 모양이 같다(필드가 갈라지지 않는다)');
  const e0 = many.store.trash[0];
  assert.equal(e0.store, 'certdoc'); assert.equal(e0.what, '증명서'); assert.ok(e0.delAt > 0); assert.ok(e0.label); assert.equal(e0.rec.id, 'CD0003', '마지막 건이 맨 위');
});
test('③ 짓다가 걸리면 아무것도 바뀌지 않는다 — 휴지통에만 있고 원 자료에도 남는 반쪽 상태가 안 생긴다', () => {
  const w = trashWorld({ label: (r) => { if (r.id === 'CD0003') throw new Error('이름표 만들다 걸림'); return r.id; } });
  assert.throws(() => w.ctx.kcTrashPutMany('certdoc', '', [rec(1), rec(2), rec(3), rec(4)], '증명서'), /걸림/);
  assert.equal(w.sets.length, 0, '한 건도 쓰지 않았다');
  assert.equal(w.store.trash.length, 0);
});
test('③ 번호(tid)는 같은 순간에 지은 줄끼리도 겹치지 않는다 — 겹치면 되살릴 때 두 줄이 한꺼번에 빠진다', () => {
  /* 같은 밀리초 + 난수가 처음엔 같게 나오는 가짜 — 겹치는 번호를 일부러 만들어, «겹치지 않을 때까지 다시 짓는지» 본다 */
  let n = 0; const seq = [0.5, 0.5, 0.5, 0.7, 0.5, 0.9];
  const w = trashWorld({ random: () => seq[Math.min(n++, seq.length - 1)] });
  const real = Date.now; Date.now = () => 1700000000000;
  try {
    const es = w.ctx.kcTrashPutMany('certdoc', '', [rec(1), rec(2), rec(3)], '증명서');
    assert.equal(new Set(es.map((e) => e.tid)).size, 3, '번호가 모두 다르다');
    assert.equal(new Set(w.store.trash.map((e) => e.tid)).size, 3, '저장된 줄도 마찬가지');
  } finally { Date.now = real; }
});
test('③ 빈 목록·없는 줄은 건너뛴다 — 아무것도 담을 게 없으면 휴지통을 쓰지 않는다', () => {
  const w = trashWorld();
  assert.equal(w.ctx.kcTrashPutMany('certdoc', '', [], 'x').length, 0);
  assert.equal(w.ctx.kcTrashPutMany('certdoc', '', [null, undefined], 'x').length, 0);
  assert.equal(w.ctx.kcTrashPutMany('certdoc', '', null, 'x').length, 0);
  assert.equal(w.sets.length, 0);
  const es = w.ctx.kcTrashPutMany('certdoc', '', [null, rec(1)], 'x');
  assert.equal(es.length, 1); assert.equal(w.sets.length, 1);
  assert.equal(w.ctx.kcTrashPut('certdoc', '', null, 'x'), null, '한 건 담기도 없는 줄은 건너뛴다');
});
test('③ 일괄 삭제(_docTrashIds)는 휴지통에 «한 길»로 담는다 — 건마다 kcTrashPut 을 부르지 않는다', () => {
  const f = fn('_docTrashIds').replace(/\/\*[\s\S]*?\*\//g, '');   /* 주석 말고 코드만 */
  assert.match(f, /kcTrashPutMany\(/, '여러 건은 한 번에');
  assert.ok(!/kcTrashPut\(/.test(f), '건마다 담던 옛 길이 남아 있지 않다');
  /* 원 자료에서 뺄 목록은 «휴지통을 쓰기 전에» 미리 계산한다 — 두 번의 저장 사이에서 할 일을 줄인다 */
  const put = f.indexOf('kcTrashPutMany('), reads = Array.from(f.matchAll(/get\(D\.store\)\.filter\(/g), (m) => m.index);
  /* 첫 읽기는 «지울 줄 고르기»(묻기 전) — 그 다음 «남길 목록» 읽기가 휴지통에 쓰기 전에 있어야 한다 */
  assert.ok(reads.length >= 2 && reads.slice(1).some((i) => i < put), '남길 목록을 휴지통에 쓰기 전에 먼저 계산한다');
});

/* ═══════════════ ② 되살리기 — 같은 발급번호가 이미 있으면 두 줄로 만들지 않는다 ═══════════════ */
const hrRec = (id, no, logId) => ({ id, kind: '재직증명서', docSrc: 'hr', hrCertNo: no, hrCertLogId: logId, date: '2026-11-12' });
function restoreWorld(live, trash, o) {
  o = o || {};
  const store = { certdoc: live, trash: trash }, toasts = [], redraws = [];
  const ctx = vm.createContext({
    TRASH_STORE: 'trash', console, Array, Object, String, Number,
    KcareerHrCert: o.noModule ? undefined : (o.oldModule ? Object.assign({}, Q, { sameIssued: undefined }) : Q),
    get: (k) => JSON.parse(JSON.stringify(store[k] || [])),
    set: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    toast: (m) => toasts.push(m), kcTrashRedraw: (e) => redraws.push(e.tid),
    getFileAsync: async () => null, saveFileUnified: () => {},
  });
  vm.runInContext(fns('kcTrashList', 'kcFreeId', 'kcTrashRestore'), ctx);
  return { ctx, store, toasts, redraws };
}
const tr = (tid, rec, store) => ({ tid, store: store || 'certdoc', page: '', what: '증명서', rec, delAt: Date.now(), label: 'x', files: [] });

test('② 같은 발급번호가 보관함에 이미 있으면 되살리지 않고 휴지통에 그대로 둔다 — 알린다(자동 병합·번호 바꿈 없음)', async () => {
  const live = [hrRec('CD0007', 'PU-2026-0006', 'L6b'), { id: 'CD0001', kind: '경력증명서' }];
  const w = restoreWorld(live, [tr('T1', hrRec('CD0006', 'PU-2026-0006', 'L6'))]);
  const r = await w.ctx.kcTrashRestore('T1');
  assert.ok(r && r.skipped, '건너뛴 줄이라고 알린다');
  assert.equal(r.existingId, 'CD0007'); assert.equal(r.hrCertNo, 'PU-2026-0006');
  assert.deepEqual(w.store.certdoc, live, '보관함은 그대로(같은 발급번호가 두 줄이 되지 않는다)');
  assert.deepEqual(w.store.trash.map((e) => e.tid), ['T1'], '휴지통에 그대로 있다(지우지도 합치지도 않는다)');
  assert.equal(w.store.trash[0].rec.hrCertNo, 'PU-2026-0006', '발급번호를 바꾸지 않는다');
  assert.equal(w.toasts.length, 1); assert.match(w.toasts[0], /PU-2026-0006/, '무엇 때문인지 밝힌다');
  assert.equal(w.redraws.length, 0, '다시 그릴 일도 없다');
});
test('② 조용히(quiet) 되살릴 때는 알림을 띄우지 않는다 — 건너뛴 줄 수는 부르는 쪽이 모아 밝힌다', async () => {
  const w = restoreWorld([hrRec('CD0007', 'PU-2026-0006', 'L6b')], [tr('T1', hrRec('CD0006', 'PU-2026-0006', 'L6'))]);
  const r = await w.ctx.kcTrashRestore('T1', true);
  assert.equal(r.skipped, 'sameIssued'); assert.equal(w.toasts.length, 0);
});
test('② 발급 이력 번호(hrCertLogId)가 같아도 같은 증명서다 — 발급번호가 비어 있어도 막는다', async () => {
  const w = restoreWorld([hrRec('CD0007', '', 'L9')], [tr('T1', hrRec('CD0006', 'PU-2026-0009', 'L9'))]);
  assert.ok((await w.ctx.kcTrashRestore('T1', true)).skipped);
});
test('② 발급번호가 비고 이력 번호로만 같을 때 알림이 «발급번호  는»처럼 비지 않는다(그 이력 번호를 밝힌다)', async () => {
  const w = restoreWorld([hrRec('CD0007', '', 'L9')], [tr('T1', hrRec('CD0006', '', 'L9'))]);
  assert.ok((await w.ctx.kcTrashRestore('T1')).skipped);
  assert.equal(w.toasts.length, 1);
  assert.match(w.toasts[0], /L9/, '무엇이 같은지(이력 번호)를 밝힌다');
  assert.ok(!/발급번호\s+는/.test(w.toasts[0]), '빈 발급번호 자리가 없다');
});
test('② 발급번호·이력 번호가 «상속 속성 이름»이어도 이미 있는 것으로 읽지 않는다 — 보관함이 비어도 되살리기가 막히지 않는다(검토 2026-11-15)', async () => {
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal(Q.sameIssued([], hrRec('X', name, name)), null, '빈 보관함: ' + name);
    assert.equal(Q.sameIssued([hrRec('CD1', 'PU-2026-0001', 'L1')], hrRec('X', name, name)), null, name);
    const w = restoreWorld([], [tr('T1', hrRec('CD0006', name, name))]);
    const r = await w.ctx.kcTrashRestore('T1', true);
    assert.ok(r && !r.skipped, name + ' 는 막히지 않고 되살아난다');
  }
  /* 같은 모양의 «진짜 같은 번호»는 여전히 막는다 */
  assert.ok(Q.sameIssued([hrRec('CD1', 'constructor', 'L1')], hrRec('X', 'constructor', 'LZ')), '실제로 같은 값이면 같은 줄');
  /* 계획·거름도 같은 색인을 쓴다 */
  assert.equal(Q.freshOnly([{ certNo: 'constructor', logId: 'toString', kind: 'employment' }], []).length, 1);
});
test('② 겹치는 발급번호가 없으면 예전처럼 되살린다 · 이름·종류가 비슷하다고 같은 줄로 «추정»하지 않는다', async () => {
  const w = restoreWorld([hrRec('CD0007', 'PU-2026-0007', 'L7'), { id: 'CD0001', kind: '재직증명서', date: '2026-11-12' }], [tr('T1', hrRec('CD0006', 'PU-2026-0006', 'L6'))]);
  const r = await w.ctx.kcTrashRestore('T1', true);
  assert.ok(r && !r.skipped && r.id === 'CD0006');
  assert.deepEqual(w.store.certdoc.map((x) => x.id).sort(), ['CD0001', 'CD0006', 'CD0007']);
  assert.equal(w.store.trash.length, 0, '되살렸으면 휴지통에서 빠진다');
  /* 인사관리 발급분이 아닌 줄(손으로 만든 줄)은 종류·날짜가 같아도 막지 않는다 */
  const w2 = restoreWorld([{ id: 'CD0001', kind: '재직증명서', date: '2026-11-12' }], [tr('T2', { id: 'CD0002', kind: '재직증명서', date: '2026-11-12' })]);
  assert.ok(!(await w2.ctx.kcTrashRestore('T2', true)).skipped);
});
test('② 증명서 보관함 밖의 줄(이력서 등)에는 이 가드가 걸리지 않는다 · 옛 캐시의 hrcert.js 에 sameIssued 가 없어도 되살리기는 멈추지 않는다', async () => {
  const w = restoreWorld([], [tr('T1', hrRec('CD0006', 'PU-2026-0006', 'L6'), 'resume')]);
  w.store.resume = [hrRec('R1', 'PU-2026-0006', 'L6')];
  assert.ok(!(await w.ctx.kcTrashRestore('T1', true)).skipped, '증명서 표(certdoc)의 일이다');
  const old = restoreWorld([hrRec('CD0007', 'PU-2026-0006', 'L6b')], [tr('T1', hrRec('CD0006', 'PU-2026-0006', 'L6'))], { oldModule: true });
  assert.ok(!(await old.ctx.kcTrashRestore('T1', true)).skipped, '도구가 옛 것이면 가드만 빠지고 되살리기는 그대로 돈다');
  const none = restoreWorld([hrRec('CD0007', 'PU-2026-0006', 'L6b')], [tr('T1', hrRec('CD0006', 'PU-2026-0006', 'L6'))], { noModule: true });
  assert.ok(!(await none.ctx.kcTrashRestore('T1', true)).skipped);
});
test('② sameIssued(KcareerHrCert) — 찾기만 한다: 입력을 바꾸지 않고, 발급번호·이력 번호로만 같다고 본다', () => {
  const have = [hrRec('CD1', 'PU-2026-0001', 'L1'), hrRec('CD2', 'PU-2026-0002', 'L2'), { id: 'CD3', kind: '재직증명서' }];
  const snap = JSON.stringify(have);
  assert.equal(Q.sameIssued(have, hrRec('X', 'PU-2026-0002', 'LZ')).id, 'CD2', '발급번호가 같다');
  assert.equal(Q.sameIssued(have, hrRec('X', 'PU-2026-0099', 'L1')).id, 'CD1', '발급 이력 번호가 같다');
  assert.equal(Q.sameIssued(have, hrRec('X', 'PU-2026-0099', 'L99')), null);
  assert.equal(Q.sameIssued(have, { id: 'X', kind: '재직증명서' }), null, '인사관리 발급분이 아니면 찾지 않는다(종류·이름으로 추정하지 않는다)');
  assert.equal(Q.sameIssued(have, null), null); assert.equal(Q.sameIssued(null, hrRec('X', 'PU-2026-0001', 'L1')), null);
  assert.equal(JSON.stringify(have), snap, '입력을 바꾸지 않는다');
});
test('② 되살리기를 여럿 한꺼번에 하는 두 길(휴지통 «선택 되살리기» · 방금 지운 «되돌리기»)은 건너뛴 줄을 세어 밝힌다 — 되살렸다고 세지 않는다', async () => {
  const toasts = [];
  const results = [{ id: 'A' }, { skipped: 'sameIssued' }, { id: 'C' }, { skipped: 'sameIssued' }];
  /* 휴지통 화면 «선택 되살리기» */
  let i = 0;
  const ctx = vm.createContext({ console, toast: (m) => toasts.push(m), trashSelIds: () => ['T1', 'T2', 'T3', 'T4'], kcTrashRestore: async () => results[i++], renderTrash: () => {} });
  vm.runInContext(fn('trashRestoreSel'), ctx);
  await ctx.trashRestoreSel(null);
  assert.match(toasts[0], /2건을 되살렸습니다/, '건너뛴 줄은 되살린 수에 넣지 않는다');
  assert.match(toasts[0], /2건은 같은 발급번호/, '몇 건이 왜 남았는지 밝힌다');
  /* 방금 지운 여러 건의 «되돌리기» */
  const undo = [], toasts2 = [];
  let j = 0;
  const ctx2 = vm.createContext({ console, TRASH_DAYS: 30, DOMAINS: { certdoc: { store: 'certdoc', label: '경력증명서' } }, escapeHtml: (s) => String(s),
    get: () => [{ id: 'A' }, { id: 'B' }, { id: 'C' }], set: () => {}, kcTrashLabel: (r) => r.id, kcTrashPutMany: (s, p, recs) => recs.map((r, k) => ({ tid: 'T' + k, rec: r })),
    kcAskDelete: (b, o, y) => y(), renderDocStore: () => {}, kcTrashDone: () => {}, kcUndoBar: (m, t, f) => undo.push(f), toast: (m) => toasts2.push(m),
    kcTrashRestore: async () => [{ id: 'A' }, { skipped: 'sameIssued' }, { id: 'C' }][j++] });
  vm.runInContext(fn('_docTrashIds'), ctx2);
  ctx2._docTrashIds('certdoc', ['A', 'B', 'C'], null, null, '');
  await undo[0]();
  assert.match(toasts2.join(' '), /2건을 되살렸습니다/); assert.match(toasts2.join(' '), /1건은 같은 발급번호/);
});

/* ═══════════════ ④ 태블릿 폭 — ☐ + № 칸을 왼쪽에 붙든다 ═══════════════ */
const MEDIA = /@media \(min-width:(\d+)px\) and \(max-width:(\d+)px\)\{\s*\r?\n\s*(#cdBody \.dt thead th:first-child[\s\S]*?)\r?\n\}/.exec(html);
test('④ 증명서 표의 첫 칸(☐ + №)을 «스크롤이 생기는 폭 띠»에서만 왼쪽에 붙든다 — 폰 카드·PC 폭은 그대로', () => {
  assert.ok(MEDIA, '태블릿 폭 띠 규칙을 못 찾았다');
  const lo = Number(MEDIA[1]), hi = Number(MEDIA[2]), css = MEDIA[3];
  /* 폰 카드가 시작하는 폭 — 줄을 카드로 접는 규칙(.dt{overflow-x:hidden!important…})을 품은 @media(max-width:N) 의 N */
  const card = /@media\s*\(max-width:(\d+)px\)\s*\{\s*\r?\n\s*\.dt\{overflow-x:hidden!important/.exec(html);
  assert.ok(card, '폰 카드 규칙을 못 찾았다');
  assert.ok(lo > Number(card[1]), '폰 카드 폭(' + card[1] + 'px 이하)은 건드리지 않는다: 시작 ' + lo);
  assert.ok(hi < 1366, '1366px PC 는 그대로: 끝 ' + hi);
  assert.ok(hi >= 1024, '태블릿 가로(1024px)는 덮는다: 끝 ' + hi);
  assert.match(css, /#cdBody \.dt thead th:first-child,#cdBody \.dt tbody td:first-child\{position:sticky;left:0\}/, '머리줄·줄마다 첫 칸을 왼쪽에 붙든다');
  assert.ok(!/#cdBody \.dt[^{]*first-child\{[^}]*position:sticky/.test(html.replace(MEDIA[0], '')), '이 띠 밖에서는 붙들지 않는다');
});
test('④ 붙든 칸은 «비치지 않게» 바탕이 있고, 머리줄 모서리 칸이 가장 위 · 지나가는 줄·고른 줄의 바탕을 따른다', () => {
  assert.ok(MEDIA);
  const css = MEDIA[3];
  const td = /\n\s*#cdBody \.dt tbody td:first-child\{([^}]*)\}/.exec('\n' + css);
  assert.ok(td, '줄마다 첫 칸 규칙');
  assert.match(td[1], /background:var\(--card\)/, '바탕이 비면 뒤로 지나가는 칸 글자가 비쳐 보인다 — 표 바탕과 같은 값(어두운 판도 따라간다)');
  const th = /\n\s*#cdBody \.dt thead th:first-child\{([^}]*)\}/.exec('\n' + css);
  assert.ok(th, '머리줄 첫 칸 규칙');
  const z = (s) => Number((/z-index:(\d+)/.exec(s) || [])[1]);
  const headZ = Number((/\.dt thead th\{[^}]*position:sticky;top:0;z-index:(\d+)/.exec(html) || [])[1]);
  assert.ok(z(th[1]) > headZ, '머리줄(' + headZ + ')보다 위: 위·왼쪽 두 방향으로 붙는 모서리 칸');
  assert.ok(z(td[1]) < headZ, '줄 칸은 머리줄 아래');
  assert.ok(z(td[1]) >= 1, '지나가는 다른 칸(z-index 없음) 위');
  assert.match(css, /tr:hover>td:first-child,#cdBody \.dt tbody tr\.sel-on>td:first-child\{background:inherit\}/, '지나가는 줄·고른 줄의 바탕을 그대로 따른다');
  assert.match(css, /html\.dark #cdBody \.dt tbody tr\.sel-on>td:first-child\{box-shadow:[^}]*var\(--blue\)/, '어두운 판의 고른 줄 왼쪽 띠가 칸 바탕에 덮이지 않는다');
});
test('④ 직원 «보기 전용»(첫 칸을 감춘다)과 충돌하지 않는다 — 감추는 규칙이 그대로 있다', () => {
  assert.match(html, /body\.kc-staff \.dt td:first-child/);
  assert.match(html, /body\.kc-staff \.dt th:first-child/);
});
