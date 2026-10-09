'use strict';
/* 메일 첨부 「🏢 기업별 계약서에 담기」 ↔ 📬 서명본 대기 (대표 「추천대로」 2026-10-08) — 가짜 자료만
   ⓐ 대기 줄 찾기 — 문서관리와 같은 coKey, 회수한 줄은 빼고
   ⓑ 담기 — 대기 열쇠가 있으면 회수로(docId 함께), 없으면 안 건드림, 회수 실패해도 담은 것은 그대로
   ⓒ 창 — 대기 목록은 읽기만, 「이 파일이 그 서명본」 확인칸 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const C = read('pu-cards.html');
const cutFn = (start) => { const a = C.indexOf(start); assert.ok(a >= 0, start); return C.slice(a, C.indexOf('\n}\n', a) + 2); };

function box(store) {
  const b = { Promise, Object, String, Array, Error };
  b.window = b; vm.createContext(b);
  vm.runInContext(read('js/pu-office-store.js'), b);
  Object.assign(b.PuOfficeStore, store || {});
  b.MB_ARC_FROM_CO = 'co';
  b.mbOfficeStore = () => b.PuOfficeStore;
  b.mbAttFetch = () => Promise.resolve({ name: '서명본.pdf', mime: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) });
  vm.runInContext(cutFn('function mbAwaitFor(') + cutFn('function mbAttToCoSave('), b);
  return b;
}
function fakeStore(log, opt) {
  opt = opt || {};
  return {
    putOriginal: () => Promise.resolve({ fileId: 'f1' }),
    listCoDocs: () => Promise.resolve(opt.dup ? [{ id: 'd0', fileId: 'f1' }] : []),
    addCoDoc: (o) => { log.push(['addCoDoc', o.secret]); return Promise.resolve({ docId: 'd9' }); },
    importCoRecs: (rows) => { log.push(['rec', rows[0].docId]); return Promise.resolve({ added: 1 }); },
    listCoRecs: () => Promise.resolve(opt.recHas ? [{ id: 'r0', docId: 'd0' }] : []),
    gotAwait: (k, d) => { log.push(['got', k, d]); return opt.gotFail ? Promise.reject(new Error('x')) : Promise.resolve(); }
  };
}

test('ⓐ 대기 줄 찾기', () => {
  const b = box();
  const list = [{ key: '가나상사', at: 1 }, { key: '다라', at: 1, got: 5 }];
  assert.equal(b.mbAwaitFor(list, '(주) 가나 상사').key, '가나상사');
  assert.equal(b.mbAwaitFor(list, '다라'), null, '회수한 줄은 아니다');
  assert.equal(b.mbAwaitFor(list, '  '), null);
});

test('ⓑ 담기 → 회수', async () => {
  let log = [];
  let msg = await box(fakeStore(log)).mbAttToCoSave({}, 0, {}, { co: '가나상사', kind: '자문', date: '2026-10-08', secret: true, rec: true, got: '가나상사' });
  assert.deepStrictEqual(log, [['addCoDoc', true], ['got', '가나상사', 'd9'], ['rec', 'd9']]);
  assert.match(msg, /회수로 옮겼습니다/);

  log = [];
  msg = await box(fakeStore(log)).mbAttToCoSave({}, 0, {}, { co: '가나상사', kind: '자문', date: '2026-10-08', secret: true, rec: false, got: '' });
  assert.ok(!log.some((x) => x[0] === 'got'), '대기 열쇠가 없으면 안 건드린다');

  log = [];
  msg = await box(fakeStore(log, { gotFail: true })).mbAttToCoSave({}, 0, {}, { co: '가나상사', secret: true, rec: false, got: '가나상사' });
  assert.match(msg, /담았습니다/); assert.match(msg, /⚠ 서명본 대기는 못 옮김/);

  log = [];
  msg = await box(fakeStore(log, { dup: true, recHas: true })).mbAttToCoSave({}, 0, {}, { co: '가나상사', secret: true, rec: true, got: '가나상사' });
  assert.deepStrictEqual(log, [['got', '가나상사', 'd0']], '이미 담긴 파일이면 그 카드로 회수만');
  assert.match(msg, /이미 「가나상사」 기업별 계약서에 있는 파일입니다 · 📬/);

  /* 검토 2026-10-09 — 앞에서 기록만 실패했으면(파일엔 기록이 없다) 다시 담을 때 기록을 남긴다 */
  log = [];
  await box(fakeStore(log, { dup: true })).mbAttToCoSave({}, 0, {}, { co: '가나상사', kind: '자문', date: '2026-10-08', secret: true, rec: true, got: '가나상사' });
  assert.deepStrictEqual(log, [['got', '가나상사', 'd0'], ['rec', 'd0']]);

  /* 같은 파일이 일반 원본으로 이미 있으면(secret:false) 카드에 🔒 를 붙이지 않고 알린다 · full 이면 결과째 */
  log = [];
  const st = fakeStore(log); st.putOriginal = () => Promise.resolve({ fileId: 'f1', secret: false });
  const r = await box(st).mbAttToCoSave({}, 0, {}, { co: '가나상사', secret: true, rec: false, got: '가나상사' }, true);
  assert.deepStrictEqual(log[0], ['addCoDoc', false]);
  assert.equal(r.got, true); assert.equal(r.secret, false); assert.match(r.msg, /🔒 가 아닙니다/); assert.doesNotMatch(r.msg, /\(🔒 서명본\)/);
  log = [];
  const r2 = await box(fakeStore(log, { gotFail: true })).mbAttToCoSave({}, 0, {}, { co: '가나상사', secret: true, rec: false, got: '가나상사' }, true);
  assert.equal(r2.got, false, '회수 실패는 got:false — 묶어 담기가 성공으로 세지 않는다');
});

test('ⓒ 창 — 읽기만 · 확인칸', () => {
  const g = cutFn('function mbAttToCo(');
  assert.match(g, /st0\.listAwait\(\)/);
  assert.doesNotMatch(g, /\.(set|push|update)\(|db\.ref\(/, '창은 대기 목록을 읽기만');
  assert.match(g, /id="mbcoGot" type="checkbox" checked/);
  assert.match(g, /got: aw && \$q\('mbcoGot'\)\.checked \? aw\.key : ''/);
});
