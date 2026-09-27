'use strict';
/* 계약서 양식 — 왼쪽 트리 + A4 크게 보기 (설계 §3-1·§3-2·§5-1)
   ■ 지키는 것
     ⓐ 트리는 계약 종류 6종 순서, 사건계약만 groupName 으로 한 단계 더 묶는다.
     ⓑ 본문은 textContent 로만 넣는다 — 칸({{…}})만 딱지로 감싼다(본문은 사용자 입력이다).
     ⓒ 올린 파일은 보관함에 «먼저» 사본을 남기고, 보관함이 실패해도 1MB 이하는 양식에 담는다.
     ⓓ 1MB 초과는 보관함에만 — 보관함이 실패하면 그때만 거절한다.
     ⓔ 원본 연결(linkOriginal)도 저장 한 길(changeForms)로 — 한 건만, 두 번 넣지 않는다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const CF = fs.readFileSync(path.join(R, 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
function loadCF() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, setTimeout, clearTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(CF, box);
  return box.PuContractForms;
}
const out = (v) => JSON.parse(JSON.stringify(v));
function fakeDb(store) {
  return { store, ref(p) { return {
    once() { return Promise.resolve({ val: () => store[p] == null ? null : JSON.parse(JSON.stringify(store[p])) }); },
    transaction(fn, done) { const next = fn(store[p] == null ? null : JSON.parse(JSON.stringify(store[p]))); store[p] = JSON.parse(JSON.stringify(next)); done(null, true, { val: () => store[p] }); }
  }; } };
}

test('ⓐ 트리 — 6종 순서·개수·사건계약 묶음', () => {
  const P = loadCF();
  const forms = [
    { id: 'a', kind: 'company', name: '가' }, { id: 'b', kind: 'company', name: '나', enabled: false },
    { id: 'c', kind: 'case', name: '해고1', groupName: '해고' }, { id: 'd', kind: 'case', name: '체당1', groupName: '체당금' },
    { id: 'e', kind: 'case', name: '무그룹' }
  ];
  const t = out(P.treeModel(forms));
  assert.deepEqual(t.map((k) => k.kind), ['consult', 'company', 'case', 'consulting', 'fund', 'other']);
  const co = t[1];
  assert.equal(co.count, 2);
  assert.deepEqual(co.groups, [{ name: null, forms: [{ id: 'a', name: '가', enabled: true }, { id: 'b', name: '나', enabled: false }] }]);
  const cs = t[2];
  assert.deepEqual(cs.groups.map((g) => g.name), ['미지정', '체당금', '해고'].sort((x, y) => x.localeCompare(y)));
  assert.equal(t[0].count, 0);
  assert.deepEqual(t[0].groups, [{ name: null, forms: [] }]);
});

test('ⓑ splitVars — 칸만 가른다', () => {
  const P = loadCF();
  assert.deepEqual(out(P.splitVars('금 {{계약금액}}원 ({{회사명}})')), [
    { t: '금 ', v: false }, { t: '{{계약금액}}', v: true }, { t: '원 (', v: false }, { t: '{{회사명}}', v: true }, { t: ')', v: false }]);
  assert.deepEqual(out(P.splitVars('')), []);
  assert.deepEqual(out(P.splitVars('{{a\nb}}')), [{ t: '{{a\nb}}', v: false }], '줄을 넘는 것은 칸이 아니다');
});

test('ⓑ ★★ 본문을 innerHTML 로 넣지 않는다', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  const paper = cutFn(m, 'function paper(');
  assert.ok(!/innerHTML/.test(paper), '★★ 본문을 HTML 로 넣습니다 — 양식 본문에 <script> 가 있으면 그대로 돕니다');
  assert.match(paper, /splitVars\(/);
  assert.ok(!/max-height:500px/.test(CF), '★ 옛 500px 높이 제한이 남아 있습니다 — 크게 보기가 안 됩니다');
});

test('ⓐ 트리 칸은 host.tree 에 그린다 — 가로 탭·분할은 없다', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  assert.match(cutFn(m, 'function drawTree('), /host\.tree/);
  assert.ok(!/pcf-kinds/.test(m) && !/pcf-split/.test(m) && !/onmouseenter/.test(m), '★ 옛 가로 탭·분할·마우스 올림 미리보기가 남아 있습니다');
});

test('ⓒⓓ 올리기는 보관함을 거친다', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  const q = cutFn(m, 'function quickUpload(');
  assert.match(q, /archiveFile\(/, '★★ 올린 파일이 보관함에 안 남습니다');
  assert.match(q, /ATTACH_MAX/, '1MB 경계를 안 봅니다');
  assert.match(cutFn(stripJs(CF), 'function openModal('), /archiveFile/, '★ 수정 창에서 붙인 파일이 보관함에 안 남습니다');
});

test('★★ 저장은 «올리는 중»엔 막는다 — 보관함 응답을 기다리다 첨부 없이 저장되면 안 된다', () => {
  const openModal = cutFn(stripJs(CF), 'function openModal(');
  const save = cutFn(openModal, 'function save(');
  assert.match(save, /pending/, '★★ 저장이 올리는 중(pending)을 안 봅니다 — 첨부가 빠진 채 저장될 수 있습니다');
});

test('ⓔ linkOriginal — 서버 최신본 위에 한 건만, 두 번 넣지 않는다', async () => {
  const P = loadCF();
  const db = fakeDb({ 'data/contract_forms': { v: [{ id: 'fm-x', kind: 'company', name: '가나상사 자문', body: 'b' }, { id: 'fm-y', kind: 'fund', name: 'y', body: 'b' }], u: 5 } });
  await P.linkOriginal(db, 'fm-x', { fileId: 'F1', name: 'a.hwp', size: 3, attId: 'at-1' });
  await P.linkOriginal(db, 'fm-x', { fileId: 'F1', name: 'a.hwp', size: 3, attId: 'at-1' });
  const v = db.store['data/contract_forms'].v;
  const x = v.filter((f) => f.id === 'fm-x')[0];
  assert.deepEqual(x.originals, [{ fileId: 'F1', name: 'a.hwp', size: 3, attId: 'at-1' }]);
  assert.ok(v.some((f) => f.id === 'fm-y'), '★★ 다른 양식을 지웠습니다');
  assert.ok(db.store['data/contract_forms'].u > 5, 'u 를 안 올렸습니다');
});

test('loadForms — 기본 양식 병합, 지운 기본 양식은 빠진다', async () => {
  const P = loadCF();
  const db = fakeDb({ 'data/contract_forms': { v: [{ id: 'fm-mine', kind: 'other', name: 'm', body: 'b' }], u: 1 }, 'data/contract_forms_removed': { v: ['fm-1'], u: 1 } });
  const list = out(await P.loadForms(db));
  const ids = list.map((f) => f.id);
  assert.ok(ids.indexOf('fm-mine') >= 0);
  assert.ok(ids.indexOf('fm-1') < 0, '지운 기본 양식이 되살아났습니다');
  assert.ok(ids.indexOf('fm-2') >= 0, '기본 양식이 안 들어왔습니다');
});

test('attKey', () => {
  const P = loadCF();
  assert.equal(P.attKey({ id: 'at-1', name: 'a', size: 1 }), 'at-1');
  assert.equal(P.attKey({ name: 'a.hwp', size: 9 }), 'n:a.hwp|9');
  assert.equal(P.ATTACH_MAX, 1048576);
});
