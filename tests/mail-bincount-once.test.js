'use strict';
/* 업무별 칸 통수를 «한 번에» 센다 (대표 화면 2026-10-02 「계속 나오는데 근본적인 해결 안되나」)
   「기업정보함이 처음 뜰 때 느린 까닭 · mbPutOf 756,685번 · mbBinCount 336번」

   예전에는 칸 하나마다 받아 둔 메일 전부를 처음부터 훑었다(칸 21개 × 2,250통 × 다시 그리기 16번).

   지키는 것
   ① 셈은 «예전과 똑같다» — 아무렇게나 만든 자료 수백 벌에서 옛 셈과 견준다
   ② 칸이 몇 개든 그리는 동안 메일은 «한 번만» 훑는다
   ③ 표는 그리는 동안만 산다 — 다시 그리면(표를 비우면) 새 메일이 셈에 든다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');

/* 옛 셈 — 2026-10-02 까지 쓰던 그대로(견줄 잣대) */
function oldCount(bin, msgs, put0, folderBy) {
  const put = put0 || {};
  let un = 0;
  Object.keys(msgs || {}).forEach((slug) => {
    const box = msgs[slug] || {};
    Object.keys(box).forEach((uid) => {
      const v = box[uid]; if (!v) return;
      const p = String(put[slug + ':' + uid] || '');
      const mine = p ? (p === bin.id) : (!!bin.link && slug === bin.link);
      if (!mine) return;
      if (!Number(v.r || 0)) un++;
    });
  });
  const f = bin.link ? folderBy(bin.link) : null;
  let out = 0, into = 0;
  Object.keys(put).forEach((k) => {
    const at = k.lastIndexOf(':'); if (at <= 0) return;
    const slug = k.slice(0, at);
    if (bin.link && slug === bin.link) { if (put[k] !== bin.id) out++; return; }
    if (put[k] === bin.id) into++;
  });
  const n = f ? Math.max(0, Number(f.total || 0) - out + into) : into;
  const untotal = (f && !msgs[bin.link]) ? Number(f.unseen || 0) : un;
  return { n, un: untotal };
}

function box(msgs, put, folders) {
  let keysOnBoxes = 0;
  const boxes = new Set(Object.values(msgs));
  const O = Object.assign(Object.create(null), Object, {
    keys: (o) => { if (boxes.has(o)) keysOnBoxes++; return Object.keys(o); },
  });
  const ctx = { String, Number, Object: O, _mbMsgs: msgs, _mbPut: put, _memo: {} };
  ctx.mbMemoOf = () => ctx._memo;
  ctx.mbFolderBy = (s) => folders[s] || null;
  vm.createContext(ctx);
  ['mbBinTally', 'mbBinCount'].forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  ctx.passes = () => keysOnBoxes;
  return ctx;
}

/* 아무렇게나 만든 자료 — 시드가 같으면 늘 같은 자료 */
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function world(seed) {
  const r = rnd(seed);
  const slugs = ['IN', 'A', 'B', 'C', 'D', 'E'];
  const folders = {};
  slugs.forEach((s) => { folders[s] = { total: Math.floor(r() * 300), unseen: Math.floor(r() * 20) }; });
  const msgs = {};
  slugs.forEach((s) => {
    if (r() < 0.2) return;                         /* 아직 안 읽어 온 폴더 */
    const b = msgs[s] = {};
    const n = Math.floor(r() * 60);
    for (let i = 0; i < n; i++) b['u' + i] = r() < 0.05 ? null : { r: r() < 0.3 ? 0 : 1 };
  });
  const bins = [];
  for (let i = 0; i < 8; i++) bins.push({ id: 'b' + i, link: r() < 0.7 ? slugs[Math.floor(r() * slugs.length)] : '' });
  /* 쪽지에 숫자 7 이 섞여 있어도 글자 '7' 칸으로 세지 않는다 — 옛 셈은 === 로 견줬다 */
  bins.push({ id: '7', link: r() < 0.5 ? 'IN' : '' });
  const put = {};
  for (let i = 0; i < 80; i++) {
    const s = r() < 0.1 ? 'ZZ' : slugs[Math.floor(r() * slugs.length)];
    const to = r() < 0.05 ? 7 : (r() < 0.05 ? '' : 'b' + Math.floor(r() * 9));
    put[s + ':u' + Math.floor(r() * 70)] = to;
  }
  if (r() < 0.3) put['nocolon'] = 'b1';
  return { msgs, put, folders, bins };
}

test('★★★ 셈이 옛 셈과 «똑같다» — 아무렇게나 만든 자료 300벌', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const w = world(seed);
    const c = box(w.msgs, w.put, w.folders);
    w.bins.forEach((b) => {
      const got = c.mbBinCount(b);
      const want = oldCount(b, w.msgs, w.put, (s) => w.folders[s] || null);
      assert.equal(got.n, want.n, '★★★ 통수가 달라졌습니다 (자료 ' + seed + ', 칸 ' + b.id + ')');
      assert.equal(got.un, want.un, '★★★ 안 읽은 수가 달라졌습니다 (자료 ' + seed + ', 칸 ' + b.id + ')');
    });
  }
});

test('★★★ 칸이 몇 개든 메일은 «한 번만» 훑는다', () => {
  const w = world(7);
  const c = box(w.msgs, w.put, w.folders);
  const bins = [];
  for (let i = 0; i < 21; i++) bins.push({ id: 'b' + (i % 9), link: i % 2 ? 'A' : '' });
  bins.forEach((b) => c.mbBinCount(b));
  const nBoxes = Object.keys(w.msgs).length;
  assert.ok(c.passes() <= nBoxes, '★★★ 칸 21개에 폴더를 ' + c.passes() + '번 훑었습니다(폴더 ' + nBoxes + '개) — 칸마다 다시 훑고 있습니다');
});

test('★★ 다시 그리면(표를 비우면) 새로 온 메일이 셈에 든다', () => {
  const msgs = { IN: { u1: { r: 0 } } };
  const c = box(msgs, {}, { IN: { total: 1, unseen: 9 } });
  assert.equal(c.mbBinCount({ id: 'x', link: 'IN' }).un, 1);
  msgs.IN.u2 = { r: 0 };
  c._memo = {};                                  /* 그리개가 그리기 전에 하는 일 */
  assert.equal(c.mbBinCount({ id: 'x', link: 'IN' }).un, 2, '★★ 다시 그려도 옛 셈을 붙들고 있습니다');
});

test('★★ 두 그리개가 «그리기 전에» 표를 비운다 — 그래서 표가 낡을 틈이 없다', () => {
  const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');
  /* 두 그리개는 길어서 머리만 본다 — 맨 첫 줄이어야 한다 */
  const head = (n) => { const i = app.indexOf(n); assert.ok(i >= 0, n); return strip(app.slice(i, i + 400)); };
  assert.match(head('function renderPCSide('), /^[^{]*\{\s*mbMemoClear\(\);/);
  assert.match(head('function renderMailPage('), /^[^{]*\{\s*mbMemoClear\(\);/);
});
