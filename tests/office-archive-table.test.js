'use strict';
/* 원본 보관함 — 틀 고정 · ☐·# · 걸러 보기 · 오른쪽 미리보기 (대표 2026-10-07 캡쳐) — 가짜 자료만 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const SRC = read('js/pu-office-docs.js');
function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(SRC, box);
  return box.PuOfficeDocs;
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('파일 형식 갈래', () => {
  const D = load();
  assert.deepStrictEqual(['a.PDF', 'b.hwp', 'c.hwpx', 'd.xlsx', 'e.csv', 'f.jpg', 'g.heic', 'h.docx', 'i.zip', ''].map(D.fileType),
    ['pdf', 'hwp', 'hwp', 'xlsx', 'xlsx', 'img', 'img', 'doc', 'etc', 'etc']);
});

test('보관함 줄 — 연결 종류·형식·🔒 를 단다, PC 폴더 연결 이름', () => {
  const D = load();
  const rows = plain(D.archiveRows([
    { id: 'a', name: '위임장.pdf', at: 2, from: { kind: 'folder', coName: '가나상사' }, secret: true },
    { id: 'b', name: '양식.hwp', at: 1, from: { kind: 'form', formId: 'f1' } }], [{ id: 'f1', name: '위임계약서' }]));
  assert.deepStrictEqual(rows.map(r => [r.id, r.kind, r.type, r.secret, r.link]),
    [['a', 'folder', 'pdf', true, '기업 · 가나상사 (PC 폴더)'], ['b', 'form', 'hwp', false, '위임계약서']]);
});

test('걸러 보기 — 연결·형식·올린 사람·검색이 함께 걸린다', () => {
  const D = load();
  const rows = [
    { id: '1', name: '효성CMS 신청서.pdf', link: '효성CMS', kind: 'form', type: 'pdf', byName: '홍길동' },
    { id: '2', name: '명단.xlsx', link: '기업 · 가나상사', kind: 'folder', type: 'xlsx', byName: '김철수' },
    { id: '3', name: '위임계약서.hwp', link: '기업 · 가나상사', kind: 'co', type: 'hwp', byName: '홍길동' }];
  const ids = (f) => plain(D.filterArchive(rows, f)).map(r => r.id);
  assert.deepStrictEqual(ids({}), ['1', '2', '3']);
  assert.deepStrictEqual(ids({ type: 'hwp' }), ['3']);
  assert.deepStrictEqual(ids({ by: '홍길동' }), ['1', '3']);
  assert.deepStrictEqual(ids({ kind: 'co', by: '홍길동' }), ['3']);
  assert.deepStrictEqual(ids({ q: '가나' }), ['2', '3'], '연결 이름으로도 찾는다');
  assert.deepStrictEqual(ids({ q: 'cms', type: 'pdf' }), ['1'], '대소문자 무시');
});

test('화면 — ☐·#·틀 고정(표만 스크롤·머리줄 고정)·오른쪽 미리보기·묶어 받기', () => {
  const a = SRC.indexOf('function mountArchive('), m = SRC.slice(a, SRC.indexOf('/* ══ 기업별 계약서 ══', a));
  assert.match(m, /'aria-label': '보이는 것 모두 고르기'/);
  assert.match(m, /el\('th', \{ style: 'width:42px', text: '#' \}\)/);
  assert.match(m, /String\(i \+ 1\)/);
  assert.match(SRC, /\.pod-arc-scroll\{max-height:calc\(100vh[^)]*\)[^}]*overflow:auto/, '표만 스크롤(높이 한도)');
  assert.match(SRC, /\.pod-arc-scroll thead th\{position:sticky;top:0/);
  assert.match(m, /filterArchive\(S\.rows, \{ q: S\.q, kind: S\.kind, type: S\.type, by: S\.by \}\)/);
  assert.match(m, /host\.fileBytes\(r\.id\)/, '미리보기는 같은 길(🔒 은 서버)로 파일을 받는다');
  assert.match(m, /host\.hwpShow\(/);
  assert.match(m, /host\.zip\(files\)/);
  assert.doesNotMatch(m.replace(/양식 삭제됨/g, ''), /삭제|지우기|\.remove\(\)|unlink/, '보관함에 지우는 길이 생기면 안 된다');
  const html = read('docs-esign.html');
  assert.match(html, /zip: formZip, hwpShow: formFileShow,/);
  assert.match(html, /function formFileShow\(host, bytes, name\)/);
});
