'use strict';
/* 계약관리 칸반은 서버 자료가 내려오면 «다시 읽는다» (대표 신고 2026-10-05
   「상담접수 없어진것 계약확정 사라진것 다시 살려라」).

   목록을 처음 열 때 한 번 dbGet 으로 받아 useState 에 얼려 두어, 그 순간 자료가 덜 와 있으면
   화면이 그 사진에 멈췄다 — 서버 167건인데 열린 탭은 36건만 들고 상담접수 0·계약확정 2(실제 2·6).

   못 박는 것(규칙):
   ① 계약관리 안에 «서버 자료 도착»(fb_initial_done)·«실시간 변경»(fb_data_changed)·«저장»(pureun-saved)을 듣는 자리가 있다
   ② 그 자리는 계약 목록을 다시 읽는다(refreshContracts) — 계약·묶음 변경엔 반응하고 남의 표 변경엔 안 한다
   ③ 화면을 떠나면 듣기를 푼다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raw = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
/* 주석을 걷고 본다 — 주석 속 글자로 통과하면 안 된다 */
function strip(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}
function body(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('괄호가 안 닫힘: ' + head);
}
const CM = strip(body(raw, 'function ContractManagement(props){'));

/* 계약관리 안에서 이 알림을 듣는 함수 이름들 */
function listeners(ev, verb) {
  const re = new RegExp(verb + "\\(\\s*'" + ev + "'\\s*,\\s*([A-Za-z_$][\\w$]*)\\s*\\)", 'g');
  const out = []; let m;
  while ((m = re.exec(CM))) out.push(m[1]);
  return out;
}
/* 그 이름의 함수가 «다시 읽기»를 부르는지 — 함수 몸을 꺼내 가짜로 돌려 본다 */
function runHandler(name, ev) {
  const fn = body(CM, 'function ' + name + '(');
  let n = 0;
  const ctx = { refreshContracts() { n++; } };
  vm.runInNewContext(fn + '\n;' + name + '(EV);', Object.assign(ctx, { EV: ev }));
  return n;
}

for (const ev of ['fb_initial_done', 'fb_data_changed', 'pureun-saved']) {
  test('① 계약관리가 「' + ev + '」 를 듣는다', () => {
    assert.ok(listeners(ev, 'addEventListener').length >= 1,
      '계약관리가 ' + ev + ' 를 안 듣는다 — 처음 연 순간의 목록에 얼어붙는다');
  });
  test('③ 화면을 떠나면 「' + ev + '」 듣기를 푼다', () => {
    const on = listeners(ev, 'addEventListener'), off = listeners(ev, 'removeEventListener');
    on.forEach(function (n) { assert.ok(off.indexOf(n) >= 0, n + ' 를 안 푼다 — 화면을 열 때마다 쌓인다'); });
  });
}

test('② 서버 자료가 다 내려오면(fb_initial_done) 목록을 다시 읽는다', () => {
  const n = listeners('fb_initial_done', 'addEventListener')[0];
  assert.equal(runHandler(n, { type: 'fb_initial_done', detail: 37 }), 1);
});
test('② 계약이 바뀌면(실시간) 다시 읽고, 묶음 변경도 다시 읽는다', () => {
  const n = listeners('fb_data_changed', 'addEventListener')[0];
  assert.equal(runHandler(n, { type: 'fb_data_changed', detail: 'contracts' }), 1);
  assert.equal(runHandler(n, { type: 'fb_data_changed', detail: 'batch' }), 1);
});
test('② 남의 표가 바뀔 때는 다시 그리지 않는다', () => {
  const n = listeners('fb_data_changed', 'addEventListener')[0];
  assert.equal(runHandler(n, { type: 'fb_data_changed', detail: 'finance_income' }), 0);
  const s = listeners('pureun-saved', 'addEventListener')[0];
  assert.equal(runHandler(s, { type: 'pureun-saved', detail: { key: 'companies' } }), 0);
});
test('② 계약을 저장하면(pureun-saved) 다시 읽는다', () => {
  const s = listeners('pureun-saved', 'addEventListener')[0];
  assert.equal(runHandler(s, { type: 'pureun-saved', detail: { key: 'contracts' } }), 1);
});
test('② 다시 읽기는 저장소에서 새로 받는다 — 화면이 들고 있던 배열을 다시 쓰지 않는다', () => {
  const rc = body(CM, 'function refreshContracts(');
  assert.match(rc, /dbGet\(\s*'contracts'/);
  assert.match(rc, /setContracts\(/);
});
