'use strict';
/* 건의 «재요청»에도 화면 캡처를 붙일 수 있다 (대표 지적 2026-10-28 「캡쳐안된다 확인해라」)

   ■ 무슨 일이었나
     건의자가 처리 결과를 「🙅 아직 안 됐어요」로 회신하면 «재요청 건의»가 새로 접수된다(sgCheckResolved).
     그 양식에는 글 칸뿐이었고 접수 기록은 `images:[]` 로 «못 박혀» 있었다 — 건의자가 캡처를 붙일 방법이 없었다.
     그래서 CMS 건(엔타스시 「고른 업체가 없습니다」)의 두 번째 신고는 증상 글자만 말로 적혀 왔고,
     관리자 화면에도 캡처가 안 보였다. (처음 건의에는 캡처가 2장 있었다.)

   ■ 지킬 것
     ① 재요청 양식에 «캡처 붙이기»(고르기 · 글 칸에서 Ctrl+V)가 있다
     ② 최대 3장 — 처음 건의와 같은 한도, 같은 줄여 담기(sgCompress)
     ③ 붙인 것은 접수 기록의 images 로 간다 — 못 박은 빈 배열이 아니다
     ④ 그림이 아닌 것·못 읽는 것은 «말해 준다» — 조용히 삼키면 「안 된다」가 된다

   실행: node --test tests/suggestion-rerequest-capture.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').split('\r\n').join('\n');
const from = src.indexOf('function sgCheckResolved(');
assert.ok(from > 0, 'sgCheckResolved 를 찾지 못했습니다');
const to = src.indexOf("$('sgDoneOk').onclick", from);
const fn = src.slice(from, to);

/* ── ①②③ 글자 «규칙» — 값이 아니라 있는가 ── */
test('★★ ① 재요청 양식에 캡처 붙이기가 있다 — 고르기와 붙여넣기 둘 다', () => {
  assert.match(fn, /data-sgd-pick=/, '★★ 캡처를 고르는 단추가 없습니다');
  assert.match(fn, /<input type="file"[^>]*data-sgd-file=[^>]*accept="image\/\*"/, '★★ 그림 고르는 칸이 없습니다');
  assert.match(fn, /data-sgd-th=/, '붙인 그림을 보여 줄 자리가 없습니다');
  assert.match(fn, /tx\.addEventListener\('paste'/, '★★ 글 칸에서 Ctrl+V 로 붙이는 길이 없습니다');
});

test('★★ ③ 접수 기록의 images 는 붙인 캡처다 — 빈 배열로 못 박지 않는다', () => {
  const rec = fn.slice(fn.indexOf('var rec={'), fn.indexOf('var ref=db.ref(SG_PRIVATE_PATH)'));
  assert.ok(rec.length > 50, '접수 기록 만드는 자리를 못 찾았습니다');
  assert.ok(!/images\s*:\s*\[\s*\]/.test(rec), '★★ images 가 빈 배열로 박혀 있습니다 — 붙인 캡처가 버려집니다');
  assert.match(rec, /images\s*:\s*\(?it\._imgs/, '접수 기록이 붙인 캡처(it._imgs)를 안 담습니다');
});

/* ── ②④ 배선을 «실제로 돌려» 본다 ── */
function wiring() {
  const a = fn.indexOf('it._imgs = [];');
  const b = fn.indexOf("row.querySelector('[data-sgd-no=\"'+i+'\"]')", a);
  assert.ok(a > 0 && b > a, '캡처 배선 자리를 찾지 못했습니다');
  const code = fn.slice(a, b);

  const alerts = [];
  const mk = () => { const l = {}; return { l, addEventListener: (ev, cb) => { (l[ev] = l[ev] || []).push(cb); }, fire: (ev, e) => (l[ev] || []).forEach((cb) => cb(e || {})) }; };
  const pick = Object.assign(mk(), { }), file = Object.assign(mk(), { value: 'x', clicked: 0, click() { this.clicked++; } });
  const tx = mk();
  const th = Object.assign(mk(), { _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }, querySelectorAll: () => [] });
  const row = { querySelector: (q) => (/pick/.test(q) ? pick : /file/.test(q) ? file : /-th/.test(q) ? th : /txt/.test(q) ? tx : null) };
  const ctx = {
    Array, alert: (m) => alerts.push(String(m)), it: {}, i: 0, row,
    sgImgSrc: (u) => u,
    /* 줄여 담기 대역 — 이름이 bad 인 파일은 못 읽는 것 */
    sgCompress: (f, cb) => cb(f.name === 'bad.png' ? null : 'data:image/jpeg;base64,' + f.name),
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, pick, file, tx, th, alerts };
}
const img = (n) => ({ type: 'image/png', name: n });

test('② 고르기 단추는 파일 창을 연다 · 고른 그림은 담긴다 · 최대 3장', () => {
  const w = wiring();
  w.pick.fire('click');
  assert.equal(w.file.clicked, 1, '★ 단추를 눌러도 파일 창이 안 열립니다');
  w.file.fire('change', { target: { files: [img('a'), img('b'), img('c'), img('d'), img('e')] } });
  assert.equal(w.ctx.it._imgs.length, 3, '★ 3장 한도가 안 지켜집니다: ' + w.ctx.it._imgs.length);
  assert.equal(w.file.value, '', '같은 그림을 다시 고르면 안 담깁니다 — 고른 뒤 입력칸을 비워야 합니다');
  /* 이미 3장이면 더 안 담고 «말해 준다» */
  w.file.fire('change', { target: { files: [img('f')] } });
  assert.equal(w.ctx.it._imgs.length, 3);
  assert.ok(w.alerts.some((m) => m.indexOf('3장') >= 0), '4장째를 말없이 버립니다 — 「안 된다」로 보입니다');
});

test('★ ② 글 칸에서 Ctrl+V 로 캡처를 붙이면 담기고, 글자 붙여넣기는 건드리지 않는다', () => {
  const w = wiring();
  let prevented = 0;
  const f = { type: 'image/png', name: 'shot' };
  w.tx.fire('paste', { clipboardData: { items: [{ type: 'image/png', getAsFile: () => f }] }, preventDefault: () => prevented++ });
  assert.equal(w.ctx.it._imgs.length, 1, '★ 붙여넣은 캡처가 안 담깁니다');
  assert.equal(prevented, 1, '그림이 글 칸에 이상한 글자로 박힙니다 — 기본 동작을 막아야 합니다');
  /* 글자만 있는 붙여넣기는 그대로 둔다 */
  w.tx.fire('paste', { clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] }, preventDefault: () => prevented++ });
  assert.equal(prevented, 1, '글자 붙여넣기까지 막았습니다');
  assert.equal(w.ctx.it._imgs.length, 1);
});

test('★ ④ 그림이 아닌 파일 · 못 읽는 그림은 «말해 준다»', () => {
  const w = wiring();
  w.file.fire('change', { target: { files: [{ type: 'application/pdf', name: 'x.pdf' }] } });
  assert.equal(w.ctx.it._imgs.length, 0);
  assert.ok(w.alerts.length >= 1, '★ 그림이 아닌 파일을 말없이 버립니다');
  const w2 = wiring();
  w2.file.fire('change', { target: { files: [img('bad.png')] } });
  assert.equal(w2.ctx.it._imgs.length, 0);
  assert.ok(w2.alerts.some((m) => m.indexOf('읽지 못') >= 0), '★ 못 읽은 그림을 말없이 버립니다');
});

test('③ 접수 기록은 붙인 캡처를 «세 장까지만» images 로 가져간다', () => {
  const a = fn.indexOf('var rec={');
  const code = fn.slice(a, fn.indexOf('var ref=db.ref(SG_PRIVATE_PATH)'));
  const ctx = { SG: { name: 'N', email: 'e', uid: 'u' }, sgCatClass: (c) => c, it: { cat: 'erp', title: 'T', _id: 'I', _imgs: ['1', '2', '3', '4'] }, txt: '글', Date };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  assert.deepEqual(Array.from(ctx.rec.images), ['1', '2', '3'], '캡처가 접수 기록에 안 담기거나 3장을 넘습니다');
  assert.equal(ctx.rec.relatedId, 'I');
});
