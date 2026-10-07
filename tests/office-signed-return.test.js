'use strict';
/* 📬 서명본 회수 (대표 「추천대로」 2026-10-07, 목업 승인) — 가짜 자료만
   ⓐ 대기·회수 나누기 — 오래된 대기 위, 14일 넘으면 빨강, 회수는 30일 안만
   ⓑ 종류 짐작 — 보낸 서류 이름으로(사람이 고친다)
   ⓒ 저장 층 — 회사마다 한 줄(coKey), 받는 주소 칸 없음, 다시 보내면 got 이 지워진다, 없는 회사에 got 을 안 쓴다
   ⓓ 규칙 — pu_docs/await 칸 이름·길이를 묶고 $other false
   ⓔ 기록 길 — 계약서등관리에서 만든 계약서만 대기에 오르고(o.await), 받기는 받는 분 칸 「(받기)」
   ⓕ 채워서 받기도 기록 — 한 장·묶음 둘 다, 회사를 골랐을 때만
   ⓖ 화면 — 탭·서명본 올리기(🔒 서명본 + 회사 카드 + 계약 기록 docId + 회수), 다시 알림은 메일을 보내지 않는다 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
function box() { const b = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, Uint8Array }; b.window = b; vm.createContext(b); return b; }
function loadDocs() { const b = box(); vm.runInContext(read('js/pu-office-docs.js'), b); return b.PuOfficeDocs; }
function loadStore() { const b = box(); vm.runInContext(read('js/pu-office-store.js'), b); return b.PuOfficeStore; }
function fakeDb() {
  const store = {};
  const db = {
    store,
    ref(p) {
      return {
        once() { const v = store[p] === undefined ? null : JSON.parse(JSON.stringify(store[p])); return Promise.resolve({ val: () => v, exists: () => v != null }); },
        set(v) { store[p] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
        update(v) { store[p] = Object.assign({}, store[p] || {}, JSON.parse(JSON.stringify(v))); return Promise.resolve(); }
      };
    }
  };
  return db;
}
const cut = (s, start) => { const a = s.indexOf(start); assert.ok(a >= 0, start + ' 없음'); const b = s.indexOf('\n    }\n', a); return s.slice(a, b); };
const DAY = 864e5;

test('ⓐ 대기·회수 나누기', () => {
  const D = loadDocs();
  const now = new Date(2026, 9, 7, 10).getTime();
  const v = JSON.parse(JSON.stringify(D.awaitView([
    { key: 'a', name: '가나상사', at: now - 3 * DAY, how: '메일', names: ['자문계약서.hwp'] },
    { key: 'b', name: '다라테크', at: now - 20 * DAY, how: '받기', names: [] },
    { key: 'c', name: '마바', at: now - 40 * DAY, got: now - 2 * DAY },
    { key: 'd', name: '사아', at: now - 90 * DAY, got: now - 60 * DAY },
    { key: 'e', name: '날짜없음' }, null
  ], now)));
  assert.deepStrictEqual(v.wait.map((x) => x.key), ['b', 'a'], '오래 기다린 곳이 위');
  assert.equal(v.wait[0].days, 20); assert.equal(v.wait[0].late, true);
  assert.equal(v.wait[1].days, 3); assert.equal(v.wait[1].late, false);
  assert.deepStrictEqual(v.done.map((x) => x.key), ['c'], '30일 넘은 회수는 빠진다');
});

test('ⓑ 종류 짐작', () => {
  const D = loadDocs();
  assert.equal(D.awaitKindOf(['(주)가나_급여관리 위임계약서.hwp']), '급여관리');
  assert.equal(D.awaitKindOf(['노동조합 자문계약서.hwpx', 'CMS 신청서.hwp']), '자문');
  assert.equal(D.awaitKindOf(['공동근로복지기금 컨설팅 계약서.hwp']), '기금');
  assert.equal(D.awaitKindOf([]), '자문');
  const t = D.remindText({ name: '가나상사', at: new Date(2026, 8, 1).getTime(), names: ['자문계약서.hwp'] });
  assert.match(t.subject, /가나상사/); assert.match(t.body, /2026-09-01/); assert.match(t.body, /- 자문계약서\.hwp/);
});

test('ⓒ 저장 층 — 회사마다 한 줄, 받는 주소 없음, 다시 보내면 다시 대기', async () => {
  const S = loadStore(), db = fakeDb();
  S.init({ db, uid: 'u1', name: '시험' });
  const key = await S.markAwait({ coName: '(주) 가나 상사', bz: '123-45-67890', how: '받기', names: ['자문계약서.hwp'], to: 'x@example.com' });
  assert.equal(key, S.coKey('(주) 가나 상사'));
  const rec = db.store['pu_docs/await/' + key];
  assert.deepStrictEqual(Object.keys(rec).sort(), ['at', 'by', 'byName', 'bz', 'how', 'name', 'names']);
  assert.equal(rec.how, '받기'); assert.equal(rec.bz, '1234567890'); assert.equal(rec.by, 'u1');
  assert.equal(S.awaitRecord({ coName: 'x', how: '아무거나' }).how, '메일');
  await S.gotAwait(key, 'docABC');
  assert.ok(db.store['pu_docs/await/' + key].got > 0); assert.equal(db.store['pu_docs/await/' + key].gotDoc, 'docABC');
  await S.markAwait({ coName: '가나상사', how: '메일' });
  assert.ok(!('got' in db.store['pu_docs/await/' + key]), '다시 보내면 다시 대기');
  await S.gotAwait('없는회사', 'd1');
  assert.ok(!('pu_docs/await/없는회사' in db.store), '대기에 없던 회사에는 쓰지 않는다');
  await assert.rejects(S.markAwait({ coName: '  ' }));
});

test('ⓓ 규칙 — await 칸을 묶는다', () => {
  const src = read('scripts/make-firebase-rules.js');
  const a = src.indexOf('  await: { $k: {'), b = src.indexOf('  } },', a);
  const blk = src.slice(a, b);
  assert.match(blk, /'\.write': LOGIN/);
  assert.match(blk, /hasChildren\(\['name','at','how','by'\]\)/);
  assert.match(blk, /how: .*'메일'.*'받기'/);
  assert.match(blk, /by: .*auth\.uid/);
  assert.match(blk, /\$other: +\{ '\.validate': false \}/);
  assert.doesNotMatch(blk, /\b(to|email|mail):/, '받는 주소 칸이 없어야 한다');
});

test('ⓔ 기록 길 — 계약서등관리 계약서만 대기에, 받기는 「(받기)」', () => {
  const html = read('docs-esign.html');
  const a = html.indexOf('function formMailRecord('), f = html.slice(a, html.indexOf('\n}\n', a));
  assert.match(f, /o\.how === '받기' \? '\(받기\)' : o\.who/);
  assert.match(f, /if \(o\.await && o\.kind === '계약서' && coName\)/);
  assert.match(f, /PuOfficeStore\.markAwait\(/);
  assert.match(html, /contractList: formContractList,\s+\/\* 📎 서명본 올리기/);
  const cf = read('js/pu-contract-forms.js');
  assert.match(cf, /host\.mail\.record\(o\.row, V, \{ kind: kind, names: .*await: true \}\)/, '✉ 보내기도 대기에');
});

test('ⓕ 채워서 받기도 기록 — 한 장·묶음, 회사를 골랐을 때만', () => {
  const cf = read('js/pu-contract-forms.js');
  const dl = cut(cf, '    function doDownload() {');
  assert.equal((dl.match(/recordGet\(/g) || []).length, 2, '한 장·묶음 둘 다');
  const rg = cut(cf, '    function recordGet(');
  assert.match(rg, /if \(!st\.co \|\| !host\.mail \|\| !host\.mail\.record\) return;/);
  assert.match(rg, /how: '받기', await: true/);
  assert.doesNotMatch(rg, /@|to:/, '받는 주소를 넘기지 않는다');
});

test('ⓖ 화면 — 탭·서명본 올리기·다시 알림', () => {
  const s = read('js/pu-office-docs.js');
  const m = s.slice(s.indexOf('  function mountCompanies('));
  assert.match(m, /'📬 서명본 대기'/);
  assert.match(m, /if \(S\.tab === 'await'\) \{ wrap\.appendChild\(awaitPane\(\)\)/);
  const os = cut(m, '    function openSigned(');
  assert.match(os, /store\.putOriginal\([^;]*\{ secret: true \}\)/, '🔒 서명본 창고로');
  assert.match(os, /store\.addCoDoc\(\{[^}]*secret: true \}\)/);
  assert.match(os, /store\.importCoRecs\(\[\{[^}]*docId: r\.docId/, '계약 기록이 파일과 이어진다');
  assert.match(os, /store\.gotAwait\(a\.key, r\.docId\)/);
  assert.match(os, /addEventListener\('drop'/, '끌어다 놓기');
  const rm = cut(m, '    function remind(');
  assert.doesNotMatch(rm, /host\.mail|send\(/, '다시 알림은 메일을 보내지 않는다');
  assert.match(rm, /store\.remindAwait\(/);
  const la = cut(m, '    function loadAwait(');
  assert.match(la, /store\.listAwait\(\)/); assert.doesNotMatch(la, /sentDocs/, '보낸 서류를 통째로 읽지 않는다');
});
