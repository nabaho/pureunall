'use strict';
/* 기업별 계약서 「✉ 보낸 서류」 (설계 2026-10-03-계약서류-표준-기록 §3 (라)) — 가짜 자료만
   ⓐ 열쇠(사업자번호·이름)마다 읽은 줄을 합친다 — 같은 at·종류·서류는 한 줄, 최근 위, 50줄까지, 받는 주소는 없다
   ⓑ 문서관리가 «쓸 때와 같은 열쇠»(PuFormCardFill.sentKeys)로 «읽기만» 한다(once) — 새로 쓰는 곳 없음
   ⓒ 화면: 보낸 서류를 못 읽어도 파일·계약 기록은 보인다 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-office-docs.js'), box);
  return box.PuOfficeDocs;
}

test('ⓐ 합치기 — 같은 보냄은 한 줄, 최근 위, 보낸 이는 @ 앞만', () => {
  const D = load();
  const a = { at: 200, kind: '제안서', names: ['제안서.pdf'], who: '박담당', by: 'hong@example.com', card: '' };
  const b = { at: 100, kind: '계약서', names: ['위임계약서.hwp', '견적서.xlsx'], who: '', by: 'kim@example.com' };
  const rows = JSON.parse(JSON.stringify(D.sentRows([[a, b], [Object.assign({}, a)], null, [{ at: 0, kind: 'x' }, null]])));
  assert.deepStrictEqual(rows, [
    { at: 200, kind: '제안서', names: ['제안서.pdf'], who: '박담당', by: 'hong' },
    { at: 100, kind: '계약서', names: ['위임계약서.hwp', '견적서.xlsx'], who: '', by: 'kim' }]);
  assert.ok(!('to' in rows[0]), '받는 주소는 없다');
  const many = []; for (let i = 1; i <= 60; i++) many.push({ at: i, kind: '제안서', names: [] });
  const cut = D.sentRows([many]);
  assert.strictEqual(cut.length, 50); assert.strictEqual(cut[0].at, 60);
});
test('ⓑ 문서관리는 같은 열쇠로 읽기만', () => {
  const html = read('docs-esign.html');
  const a = html.indexOf('function formSentFor('), b = html.indexOf('\n}\n', a);
  const f = html.slice(a, b);
  assert.match(f, /PuFormCardFill\.sentKeys\(/);
  assert.match(f, /db\.ref\('pucards\/sentDocs\/' \+ k\)\.once\('value'\)/);
  assert.doesNotMatch(f, /\.(set|push|update|remove)\(/);
  assert.match(html, /sentFor: formSentFor/);
});
test('ⓒ 화면 — 보낸 서류는 곁들이(실패해도 빈 목록), 표 머리', () => {
  const docs = read('js/pu-office-docs.js');
  assert.match(docs, /host\.sentFor\(co\.name \|\| '', co\.bz \|\| ''\)\.then\(sentRows, function \(\) \{ return \[\]; \}\)/);
  assert.match(docs, /'✉ 보낸 서류'/);
  assert.match(docs, /보낸 서류 ' \+ S\.sent\.length \+ '건/);
});
