'use strict';
/* 원본 보관함·기업별 계약서 화면 (설계 §3-3·§3-4·§5-2·§5-4)
   ■ 지키는 것
     ⓐ 보관함에는 «지우기» 단추가 없다 — 영구 보관이 목적이다.
     ⓑ 양식이 지워져도 보관함 줄은 남고 「양식 삭제됨 · 사본만 남음」으로 보인다.
     ⓒ 기존 첨부 중 보관함에 없는 것만 골라 담는다(두 번 눌러도 두 벌 안 생김은 저장 층 해시가 지킨다).
     ⓓ 사진첩에서는 «계약서»로 판독된 사진만, 이미 가져온 것은 표시한다.
     ⓔ 사용자 값(파일명·회사명)을 innerHTML 에 조립하지 않는다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'js/pu-office-docs.js'), 'utf8').replace(/\r\n/g, '\n');
function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(SRC, box);
  return box.PuOfficeDocs;
}
const out = (v) => JSON.parse(JSON.stringify(v));

test('ⓑ archiveRows — 최신순, 연결 이름, 지워진 양식 표시', () => {
  const D = load();
  const originals = [
    { id: 'o1', name: 'a.hwp', size: 1, at: 10, byName: '홍길동', from: { kind: 'form', formId: 'fm-1', formName: '옛 이름' } },
    { id: 'o2', name: 'b.pdf', size: 2, at: 30, from: { kind: 'co', coKey: 'k', coName: '가나상사' } },
    { id: 'o3', name: 'c.jpg', size: 3, at: 20, from: { kind: 'photo', coKey: 'k', coName: '가나상사', photoId: 'p1', year: '2026', owner: 'u1' } },
    { id: 'o4', name: 'd.hwp', size: 4, at: 5, from: { kind: 'form', formId: 'fm-gone', formName: '부당해고 위임' } }
  ];
  const rows = out(D.archiveRows(originals, [{ id: 'fm-1', name: '자문계약서' }]));
  assert.deepEqual(rows.map((r) => r.id), ['o2', 'o3', 'o1', 'o4']);
  assert.equal(rows[0].link, '기업 · 가나상사');
  assert.equal(rows[1].link, '기업 · 가나상사 (사진첩)');
  assert.equal(rows[2].link, '자문계약서', '양식 이름은 «지금» 이름으로');
  assert.equal(rows[3].gone, true);
  assert.equal(rows[3].link, '부당해고 위임 — 양식 삭제됨 · 사본만 남음');
});

test('ⓒ pendingBackfill — 보관함에 없는 첨부만', () => {
  const D = load();
  const attKey = (a) => a.id || ('n:' + a.name + '|' + a.size);
  const forms = [
    { id: 'f1', name: '가', kind: 'company', attachments: [{ id: 'at-1', name: 'x.hwp', size: 3, data: 'data:x;base64,AQID' }, { id: 'at-2', name: 'y.hwp', size: 3, data: 'data:x;base64,AQID' }],
      originals: [{ fileId: 'F', name: 'x.hwp', size: 3, attId: 'at-1' }] },
    { id: 'f2', name: '나', kind: 'case', attachments: [{ name: 'noid.pdf', size: 5, data: 'data:x;base64,AQID' }] },
    { id: 'f3', name: '다', kind: 'fund', attachments: [{ id: 'at-3', name: 'empty.hwp', size: 0 }] },
    { id: 'f4', name: '라', kind: 'other' }
  ];
  const p = out(D.pendingBackfill(forms, attKey));
  assert.deepEqual(p.map((x) => x.formId + ':' + attKey(x.att)), ['f1:at-2', 'f2:n:noid.pdf|5'], '자료 없는 첨부는 못 담는다');
  assert.equal(p[0].formKind, 'company');
});

test('ⓐ 보관함에 지우기 단추가 없다', () => {
  const m = cutFn(stripJs(SRC), 'function mountArchive(');
  assert.ok(!/삭제|지우기|\.remove\(\)|unlink/.test(m.replace(/양식 삭제됨/g, '')), '★★ 보관함 화면에 지우는 길이 있습니다');
});

test('ⓔ 사용자 값을 innerHTML 에 조립하지 않는다', () => {
  const s = stripJs(SRC);
  const bad = s.split('\n').filter((l) => /innerHTML\s*=\s*[^'"\s;]/.test(l) || /innerHTML\s*\+=/.test(l));
  assert.deepEqual(bad, [], '★★ innerHTML 에 값을 조립합니다: ' + bad.join(' | '));
});

test('backfill() — dataUrlToBytes 오류 처리 (모든 항목이 완료됨)', () => {
  const m = cutFn(stripJs(SRC), 'function backfill(');
  assert.ok(/Promise\.resolve\(\)\.then\(/.test(m), '★★ backfill 에서 Promise.resolve().then( 이 없습니다');
  assert.ok(/\.then\(finish, finish\)/.test(m), '★★ 마지막 then 에 두 핸들러(fulfil, reject)가 없습니다');
});

test('ⓓ photoCandidates — 계약서만, 최신순, 가져온 것 표시', () => {
  const D = load();
  const byYear = {
    '2026': {
      p1: { upAt: Date.UTC(2026, 2, 2), read: { kind: 'contract', fields: { company: '가나상사', docName: '자문계약서' } } },
      p2: { upAt: Date.UTC(2026, 4, 1), read: { kind: 'card', fields: { company: '다라' } } },
      p3: { upAt: Date.UTC(2026, 5, 9), company: '마바상사', loc: 'storage', read: { kind: 'contract', fields: {} } }
    },
    '2025': { p4: { takenAt: Date.UTC(2025, 0, 5), read: { kind: 'contract' } } }
  };
  const c = out(D.photoCandidates(byYear, { p1: true }));
  assert.deepEqual(c.map((x) => x.id), ['p3', 'p1', 'p4']);
  assert.equal(c[0].company, '마바상사', '사람이 붙인 회사명이 판독값보다 앞선다');
  assert.equal(c[0].title, '계약서');
  assert.equal(c[0].loc, 'storage');
  assert.equal(c[1].company, '가나상사'); assert.equal(c[1].title, '자문계약서'); assert.equal(c[1].imported, true);
  assert.equal(c[1].date, '2026-03-02');
  assert.equal(c[2].year, '2025'); assert.equal(c[2].company, '');
});

test('ⓓ 가져오기는 사진첩을 «읽기만» 한다', () => {
  const s = stripJs(SRC);
  const m = cutFn(s, 'function mountCompanies(');
  assert.match(m, /photos\.loadFull\(/);
  assert.ok(!/photos\.(save|delete|replace|setShare|addShare|saveRead|move)/i.test(m), '★★ 사진첩 원본을 고칩니다');
  assert.match(m, /kind: 'photo'/, '보관함 기록에 사진첩에서 왔다는 것을 안 남깁니다');
  assert.match(m, /String\(/, 'from.year 를 문자열로 안 바꿉니다 — 규칙(from.$f 문자열)에 막힙니다');
});

test('★ 「이 회사에서 빼기」는 연결만 끊는다', () => {
  const m = cutFn(stripJs(SRC), 'function mountCompanies(');
  assert.match(m, /unlinkCoDoc\(/);
  assert.ok(!/deleteOriginal|originals.*remove/.test(m), '★★ 회사에서 빼면서 보관함 원본을 지웁니다');
});

test('★ loadDocs — 늦게 도착한 응답이 다른 회사를 덮지 않는다', () => {
  const m = cutFn(stripJs(SRC), 'function loadDocs(');
  assert.match(m, /key !== S\.sel/, '★★ 회사를 빨리 두 번 바꾸면 늦게 온 listCoDocs 응답이 다른 회사 화면을 덮습니다');
});

test('★ openDoc — 「이 회사에서 빼기」가 연 시점의 회사(key)로 unlink 한다', () => {
  const m = cutFn(stripJs(SRC), 'function openDoc(');
  assert.match(m, /unlinkCoDoc\(key,/, '★★ S.sel 을 직접 써서, 열려 있는 동안 회사가 바뀌면 엉뚱한 회사에서 뺍니다');
});

test('★ urlFor — 실패는 캐시하지 않는다(한 번 어긋나도 다음에 다시 시도한다)', () => {
  const m = cutFn(stripJs(SRC), 'function urlFor(');
  assert.match(m, /delete urlCache\[/, '★★ 실패한 요청도 urlCache 에 박혀 마운트가 살아 있는 내내 썸네일이 죽습니다');
});

test('★ loadDocs — listCoDocs 가 거절되면 토스트만 띄우고 회사 목록은 잠그지 않는다', () => {
  const m = cutFn(stripJs(SRC), 'function loadDocs(');
  assert.ok(!/S\.err\s*=/.test(m), '★★ S.err 를 채우면 draw() 가 오류 화면만 그려서 다른 회사로 못 바꿉니다');
  assert.match(m, /toast\(/, '실패를 사용자에게 알려야 합니다');
});
