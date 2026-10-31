/* 「지난 메일」 옆줄 숫자 (2026-10-31, 대표 확인 «지난 메일 옆줄 숫자 맞추기»)
   ═══════════════════════════════════════════════════════════════════════════
   대표 화면 2026-10-10: 사이드바 「지난 메일」이 «열기 전 21,905 → 열면 23,155» 로 바뀌었다. 자료는 안 줄었다.
   열기 전 숫자가 `mailbox/old/state.got`(이 길로 받은 누적)였고, 실제 줄 수(23,155)보다 적었다.
   이제 서버가 «실제로 담긴 수»(held)를 적고, 화면은 열기 전에도 그것을 보인다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

function count(msgsOld, state) {
  const box = { Object, Number, MB_OLD_ID: '*old', _mbMsgs: msgsOld === undefined ? {} : { '*old': msgsOld }, _mbOldState: state === undefined ? null : state };
  vm.createContext(box);
  vm.runInContext(sliceFn(HTML, 'function mbOldCount(') + '\n;this.f = mbOldCount;', box);
  return box.f();
}

test('★★★ 칸을 열기 «전»에는 서버가 적은 실제 수(held)를 보인다 — got(누적)이 아니다', () => {
  assert.equal(count(undefined, { got: 21905, held: 23155 }), 23155, '열기 전에 got 을 보여 열면 숫자가 뛴다');
});

test('★★ 열어서 읽은 «뒤»에는 실제로 든 줄 수가 이긴다', () => {
  assert.equal(count({ a: 1, b: 2, c: 3 }, { got: 21905, held: 23155 }), 3);
});

test('★★ held 가 없는 옛 기록은 got 으로 물러선다 · 아무 기록도 없으면 0', () => {
  assert.equal(count(undefined, { got: 21905 }), 21905, '옛 기록에서 숫자가 사라졌다');
  assert.equal(count(undefined, {}), 0);
  assert.equal(count(undefined, null), 0, '아직 못 읽었는데 터졌다');
});

test('★ 옆줄은 숫자가 0 이면 칸을 안 그린다(그대로) — 숫자가 늦게 와도 칸이 깜빡이지 않게 held 를 먼저 본다', () => {
  const src = sliceFn(HTML, 'function mbOldCount(').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.ok(src.indexOf('st.held') > 0 && src.indexOf('st.held') < src.indexOf('st.got'), 'held 가 got 보다 «먼저» 읽히지 않는다');
});
