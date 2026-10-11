'use strict';
/* 계약서 양식 목록에서 «첨부 사본» 빼기 — 원본은 원본 보관함에서 (2026-10-11 대표 「순서대로」)

   ■ 무엇이 있었나
     양식 목록(data/contract_forms) 3.4MB 중 3.27MB 가 첨부 사본(base64). 그 62개는 모두 원본 보관함
     (pu_docs/originals, 창고 — 지울 수 없음)에 같은 파일이 있었다. 사본 때문에 양식 한 장만 고쳐도 목록 통째가 오갔다.
   ■ 규칙
     ⓐ 사본은 «보관함 번호(originals[attId].fileId)가 확인된» 첨부에서만 뺀다 — 번호가 없으면 그것이 유일본이다.
     ⓑ 저장(changeForms)은 고친·새 양식만 뺀다 — 손대지 않은 양식은 그대로(옛 사본 걷어내기는 대표 확인 뒤 따로).
     ⓒ 읽을 때는 사본 → 없으면 보관함(attSrc·attBytes). 이알피 「계약서 출력」도 보관함에서 받는다(_erpFormAttBytes).
   가짜 자료만 쓴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-contract-forms.js'), 'utf8');
const ERP = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));

function load() {
  const win = {};
  const ctx = vm.createContext({ window: win, console, setTimeout, clearTimeout, Promise, JSON, Math, Date, atob: (s) => Buffer.from(s, 'base64').toString('binary') });
  vm.runInContext(SRC, ctx);
  return win.PuContractForms;
}
const C = load();
const plain = (x) => JSON.parse(JSON.stringify(x));
const DATA = 'data:application/octet-stream;base64,QUJD';   // "ABC"
const form = (id, withArc) => ({
  id, name: '가나상사 위임계약서 ' + id, kind: 'case',
  attachments: [{ id: 'at-' + id, name: id + '.hwpx', size: 3, data: DATA }],
  originals: withArc ? [{ attId: 'at-' + id, fileId: '-F' + id, name: id + '.hwpx', size: 3 }] : []
});

test('ⓐ 보관함 번호가 있는 첨부만 사본을 뺀다 — 번호는 첨부에 옮겨 적는다', () => {
  const f = form('a', true);
  const s = plain(C.slimForm(f));
  assert.equal(s.attachments[0].data, undefined);
  assert.equal(s.attachments[0].fileId, '-Fa');
  assert.equal(s.attachments[0].name, 'a.hwpx');
  assert.equal(f.attachments[0].data, DATA, '받은 양식을 고치면 안 된다(사본을 돌려준다)');
});

test('ⓐ★ 보관함 번호가 없으면 절대 안 뺀다 — 그 사본이 유일본이다', () => {
  const f = form('b', false);
  assert.equal(C.slimForm(f), f);
  const g = form('c', true); g.originals[0].fileId = '';            // 번호가 비어 있어도 안 뺀다
  assert.equal(plain(C.slimForm(g)).attachments[0].data, DATA);
  const h = form('d', true); h.originals[0].attId = 'at-other';       // 다른 첨부의 번호로 빼면 안 된다
  assert.equal(plain(C.slimForm(h)).attachments[0].data, DATA);
});

test('ⓒ 읽기 — 사본이 있으면 사본, 없으면 보관함 번호, 둘 다 없으면 없음', () => {
  const f = form('e', true);
  assert.deepEqual(plain(C.attSrc(f, f.attachments[0])), { name: 'e.hwpx', data: DATA });
  const s = C.slimForm(f);
  assert.deepEqual(plain(C.attSrc(s, s.attachments[0])), { name: 'e.hwpx', fileId: '-Fe' });
  const bare = { attachments: [{ id: 'x', name: 'x.hwpx' }], originals: [] };
  assert.equal(C.attSrc(bare, bare.attachments[0]), null);
  /* 첨부에 번호가 안 적혔어도 보관함 기록(originals[attId])으로 찾는다 — 다른 길로 사본만 빠진 양식 */
  const viaOrig = { attachments: [{ id: 'y', name: 'y.hwpx' }], originals: [{ attId: 'y', fileId: '-Fy', name: 'y.hwpx' }] };
  assert.deepEqual(plain(C.attSrc(viaOrig, viaOrig.attachments[0])), { name: 'y.hwpx', fileId: '-Fy' });
});

test('ⓒ attBytes — 사본은 바로, 보관함은 host.hwpBytes 로', async () => {
  const f = form('g', true), s = C.slimForm(f);
  const u8 = await C.attBytes(f, f.attachments[0], null);
  assert.equal(Buffer.from(u8).toString(), 'ABC');
  let asked = null;
  const host = { hwpBytes: (src) => { asked = plain(src); return Promise.resolve(new Uint8Array([1, 2])); } };
  const got = await C.attBytes(s, s.attachments[0], host);
  assert.deepEqual(asked, { name: 'g.hwpx', fileId: '-Fg' });
  assert.equal(got.length, 2);
  await assert.rejects(C.attBytes(s, s.attachments[0], null), /불러올 길/);
});

/* changeForms 를 가짜 DB 로 실제로 돌린다 */
function fakeDb(data) {
  return {
    data,
    ref(p) {
      return {
        once() { return Promise.resolve({ val: () => (data[p] == null ? null : plain(data[p])) }); },
        transaction(fn, cb) {
          const nv = fn(data[p] == null ? null : plain(data[p]));
          data[p] = plain(nv);
          setTimeout(() => cb(null, true, { val: () => plain(nv) }));
        }
      };
    }
  };
}

test('ⓑ 저장은 고친 양식만 사본을 뺀다 — 손대지 않은 양식은 그대로', async () => {
  const db = fakeDb({ 'data/contract_forms': { u: 1, v: [form('p', true), form('q', true), form('r', false)] } });
  await C.changeForms(db, [], (list) => list.map((x) => (x.id === 'p' ? Object.assign({}, x, { name: '고친 이름' }) : x)));
  const v = db.data['data/contract_forms'].v;
  const by = Object.fromEntries(v.map((f) => [f.id, f]));
  assert.equal(by.p.attachments[0].data, undefined, '고친 양식 p 는 사본을 뺀다');
  assert.equal(by.p.attachments[0].fileId, '-Fp');
  assert.equal(by.p.name, '고친 이름');
  assert.equal(by.q.attachments[0].data, DATA, '손대지 않은 q 는 그대로');
  assert.equal(by.r.attachments[0].data, DATA);
});

test('ⓑ 새로 넣은 양식도 보관함 번호가 있으면 사본 없이 저장된다', async () => {
  const db = fakeDb({ 'data/contract_forms': { u: 1, v: [] } });
  await C.changeForms(db, [], (list) => list.concat([form('n', true), form('m', false)]));
  const by = Object.fromEntries(db.data['data/contract_forms'].v.map((f) => [f.id, f]));
  assert.equal(by.n.attachments[0].data, undefined);
  assert.equal(by.m.attachments[0].data, DATA, '보관함에 못 올라간 새 양식은 사본을 지킨다');
});

/* 이알피 _erpFormAttBytes 를 가짜 DB·창고로 실제로 돌린다 */
function runErp(att, form2, opt) {
  const reads = [];
  const box = {
    window: {}, Promise, Uint8Array, JSON, Error,
    PuContractForms: C,
    _erpHwpBytes: (d) => new Uint8Array(Buffer.from(String(d).split(',')[1], 'base64')),
    fbDb: { ref(p) { reads.push(p); return { once: () => Promise.resolve({ val: () => (opt.rec === undefined ? null : opt.rec) }) }; } },
    erpImgStorage: () => Promise.resolve({ ref: (p) => ({ getDownloadURL: () => Promise.resolve('https://창고/' + p) }) }),
    fetchT: (url) => { reads.push(url); return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new Uint8Array([7, 8, 9]).buffer) }); }
  };
  box.window.PuContractForms = C;
  vm.createContext(box);
  vm.runInContext(cutFn(ERP, 'function _erpFormAttBytes('), box);
  return box._erpFormAttBytes(att, form2).then((u8) => ({ u8, reads }));
}

test('ⓒ 이알피 — 사본이 있으면 서버에 안 묻는다', async () => {
  const f = form('s', true);
  const r = await runErp(f.attachments[0], f, {});
  assert.equal(Buffer.from(r.u8).toString(), 'ABC');
  assert.deepEqual(r.reads, []);
});

test('ⓒ 이알피 — 사본이 없으면 보관함 기록 → 창고에서 받는다', async () => {
  const s = C.slimForm(form('t', true));
  const r = await runErp(s.attachments[0], s, { rec: { path: 'pu_docs/originals/-Ft/t.hwpx' } });
  assert.deepEqual(Array.from(r.u8), [7, 8, 9]);
  assert.deepEqual(r.reads, ['pu_docs/originals/-Ft', 'https://창고/pu_docs/originals/-Ft/t.hwpx']);
});

test('ⓒ 이알피 — 보관함에 없거나 🔒 서명본이면 알린다(멈추지 않는다)', async () => {
  const s = C.slimForm(form('u', true));
  await assert.rejects(runErp(s.attachments[0], s, { rec: null }), /보관함에 없는/);
  await assert.rejects(runErp(s.attachments[0], s, { rec: { path: 'pu_docs/secret/-Fu/u.hwpx', secret: true } }), /서명본/);
});

test('ⓒ 이알피 화면 — 한글 열기는 양식을 함께 넘기고, 사본 없는 첨부는 누를 때 받는다', () => {
  assert.match(ERP, /openContractHwpAttachment\(att, f\)/);
  const open = cutFn(ERP, 'function openContractHwpAttachment(');
  assert.match(open, /_erpFormAttBytes\(att, form\)/);
  assert.ok(!/att\.data\|\|att\.dataUrl\)\)\{ showToast/.test(open), '사본이 없다고 바로 「데이터 없음」을 띄우면 안 된다');
});

test('ⓒ 문서관리 화면 — 첨부를 사본에만 기대는 자리가 남지 않는다', () => {
  const code = stripComments(SRC);
  const prev = cutFn(code, 'function openHwpPreview(');
  assert.match(prev, /getBytes/);
  assert.ok(!/renderPreview\(body, bytesOfDataUrl\(/.test(prev), '미리보기가 사본만 읽으면 사본 없는 양식은 안 열린다');
  assert.match(code, /var hwpAtt = [^\n]*attSrc\(fm, a\)/, '「한글 원본 크게 보기」 메뉴가 사본 없는 양식에서 사라진다');
  assert.match(code, /o\.attBytes = function \(form, a\) \{ return attBytes\(form, a, host\); \}/, '편집 창 미리보기가 보관함 길을 못 받는다');
});
