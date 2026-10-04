'use strict';
/* 기업별 계약서 — 🔗 이알피 업체와 맞추기·합치기 (설계 2026-09-27 사무관리서류 §8 후속, 대표 「진행」 2026-10-04) — 가짜 자료만
   ⓐ 사업자번호 짐작: «이름이 같을 때»만, 이알피 업체가 사업자등록증보다 먼저, 이미 있으면 그대로, 명함 줄은 안 씀
   ⓑ 같은 번호 묶음: 둘 이상만, 줄이 많은 회사가 앞(남는 쪽)
   ⓒ 합치기: 한 번에 쓰는 모양 — 옮긴 줄 by=지금 사람, 규칙 칸만, 옛 회사 셋 다 null, 수(n·r)는 다시 셈, 사업자번호 이어받기
   ⓓ 문서관리가 길을 넘긴다 — 읽기 once, 쓰기는 pu_docs 한 번 update / 사업자번호는 10자리만 */
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
const plain = (x) => JSON.parse(JSON.stringify(x));

test('ⓐ 사업자번호 짐작 — 이름이 같을 때만, 이알피 먼저', () => {
  const D = load();
  const cos = [
    { key: '가나상사', name: '(주)가나상사', bz: '', n: 1, r: 0 },
    { key: '다라산업', name: '다라산업', bz: '987-65-43210', n: 0, r: 2 },
    { key: '마바상회', name: '마바상회', bz: '', n: 1, r: 0 },
    { key: '사아물산', name: '사아물산', bz: '', n: 1, r: 0 }];
  const refs = [
    { k: 'biz', c: '가나상사', bz: '111-11-11111' },
    { k: 'erp', c: '가나상사 주식회사', bz: '123-45-67890' },
    { k: 'card', c: '마바상회', bz: '222-22-22222' },
    { k: 'erp', c: '사아물산', bz: '12345' }];
  const p = plain(D.linkPlan(cos, refs));
  assert.deepStrictEqual(p[0], { key: '가나상사', name: '(주)가나상사', bz: '1234567890', state: 'found', refName: '가나상사 주식회사', from: '이알피 업체' });
  assert.deepStrictEqual(p[1], { key: '다라산업', name: '다라산업', bz: '9876543210', state: 'have' });
  assert.strictEqual(p[2].state, 'none', '명함 줄의 번호는 쓰지 않는다');
  assert.strictEqual(p[3].state, 'none', '10자리가 아닌 번호는 쓰지 않는다');
  assert.strictEqual(D.fmtBz('1234567890'), '123-45-67890');
});
test('ⓑ 같은 번호 묶음 — 둘 이상, 이알피 이름과 같은 회사가 앞(남는 쪽), 그다음 줄 많은 회사', () => {
  const D = load();
  const cos = [
    { key: 'a', name: '(주)가나상사', bz: '1234567890', n: 1, r: 0 },
    { key: 'b', name: '가나상사(천안)', bz: '123-45-67890', n: 3, r: 2 },
    { key: 'c', name: '다라산업', bz: '9876543210', n: 1, r: 0 },
    { key: 'd', name: '번호없음', bz: '', n: 9, r: 9 }];
  assert.deepStrictEqual(plain(D.bzGroups(cos)).map(x => [x.bz, x.cos.map(c => c.key)]), [['1234567890', ['b', 'a']]], '이알피 이름을 모르면 줄 많은 쪽');
  const names = plain(D.refNames([{ k: 'biz', c: '가나(등록증)', bz: '1234567890' }, { k: 'erp', c: '가나상사 주식회사', bz: '123-45-67890' }, { k: 'card', c: '명함', bz: '9876543210' }]));
  assert.deepStrictEqual(names, { '1234567890': '가나상사 주식회사' });
  const g = plain(D.bzGroups(cos, names));
  assert.deepStrictEqual(g.map(x => [x.official, x.cos.map(c => c.key)]), [['가나상사 주식회사', ['a', 'b']]]);
});
test('ⓒ 합치기 모양 — 한 번에, by=지금 사람, 규칙 칸만, 수 다시 셈', () => {
  const D = load();
  const d = {
    from: { name: '가나상사(천안)', n: 2, r: 1, bz: '1234567890' },
    to: { name: '가나상사', n: 1, r: 0 },
    fromDocs: { dA: { fileId: 'Kf1', title: '자문계약서', date: '2026-01-02', src: 'folder', at: 5, by: 'old', byName: '김철수', secret: true, junk: 1 },
      dB: { fileId: 'Kf2', title: '위임장', src: 'upload', at: 6, by: 'old', secret: false }, dC: { title: '파일 없음' } },
    toDocs: { dT: { fileId: 'Kf9' } },
    fromRecs: { rA: { date: '2026-01-02', kind: '자문', amount: 330000, src: 'import', at: 7, by: 'old', docId: 'dA' } },
    toRecs: {} };
  const up = plain(D.mergePlan('가나상사(천안)', '가나상사', d, { uid: 'U1', name: '홍길동' }, 99));
  assert.deepStrictEqual(up['co_docs/가나상사/dA'], { fileId: 'Kf1', title: '자문계약서', date: '2026-01-02', src: 'folder', secret: true, at: 5, by: 'U1', byName: '홍길동' });
  assert.deepStrictEqual(up['co_docs/가나상사/dB'], { fileId: 'Kf2', title: '위임장', src: 'upload', at: 6, by: 'U1', byName: '홍길동' }, 'secret:false 는 싣지 않는다(규칙은 true 만)');
  assert.ok(!('co_docs/가나상사/dC' in up), '파일 없는 줄은 옮기지 않는다');
  assert.deepStrictEqual(up['co_recs/가나상사/rA'], { date: '2026-01-02', kind: '자문', amount: 330000, docId: 'dA', src: 'import', at: 7, by: 'U1', byName: '홍길동' });
  assert.strictEqual(up['co_docs/가나상사(천안)'], null);
  assert.strictEqual(up['co_recs/가나상사(천안)'], null);
  assert.strictEqual(up['co/가나상사(천안)'], null);
  assert.deepStrictEqual(up['co/가나상사'], { name: '가나상사', n: 3, r: 1, lastAt: 99, bz: '1234567890' });
  assert.throws(() => D.mergePlan('a', 'a', d, { uid: 'U1' }), /같습니다/);
  assert.throws(() => D.mergePlan('a', 'b', { fromDocs: {} }, { uid: 'U1' }), /남길 회사/);
  assert.throws(() => D.mergePlan('a', 'b', d, {}), /로그인/);
  /* 규칙 칸 이름과 맞나 — co_docs·co_recs·co 의 $other false 에 걸리지 않게 */
  const rules = read('scripts/make-firebase-rules.js');
  const block = (name) => rules.slice(rules.indexOf(name + ': { $k'), rules.indexOf('$other', rules.indexOf(name + ': { $k')));
  Object.keys(up).filter(k => up[k] && typeof up[k] === 'object').forEach(k => {
    const b = block(k.split('/')[0]);
    Object.keys(up[k]).forEach(f => assert.match(b, new RegExp('\\b' + f + ':'), k + ' 의 ' + f + ' 칸이 규칙에 없다'));
  });
});
test('ⓓ 문서관리 길 — 읽기 once, 쓰기는 pu_docs 한 번, 사업자번호는 10자리만', () => {
  const html = read('docs-esign.html');
  const m = html.slice(html.indexOf('async function formCoMerge('), html.indexOf('\n}\n', html.indexOf('async function formCoMerge(')));
  assert.match(m, /\.once\('value'\)/);
  assert.match(m, /PuOfficeDocs\.mergePlan\(/);
  assert.match(m, /trackedWrite\(db\.ref\('pu_docs'\)\.update\(plan\)\)/);
  assert.strictEqual((m.match(/\.update\(|\.set\(|\.push\(|\.remove\(/g) || []).length, 1, '쓰기는 한 번');
  const l = html.slice(html.indexOf('function formCoLink('), html.indexOf('\n}\n', html.indexOf('function formCoLink(')));
  assert.match(l, /d\.length !== 10/);
  assert.match(l, /db\.ref\('pu_docs\/co\/' \+ key \+ '\/bz'\)\.set\(d\)/);
  assert.match(html, /coLink: formCoLink, coMerge: formCoMerge/);
  const docs = read('js/pu-office-docs.js');
  assert.match(docs, /host\.coLink \? el\('button'[^\n]*onclick: openLink/);
  assert.match(docs, /host\.coMerge \? el\('button'[^\n]*onclick: openMerge/);
});
