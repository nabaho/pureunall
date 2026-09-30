/* 타임스탬프 창 — 시 칸에 숫자 두 개를 넣으면 분 칸으로 저절로 넘어간다
 * (대표 지시 2026-09-30 「시간 숫자 2개를 넣으면 다음 분 숫자로 자동으로 넘어가게 해라」)
 *
 * 못 박는 것은 규칙이다 — 실제 코드 조각을 돌려서
 *   두 자리면 «짝이 되는» 분 칸(mh0→mm0, mh2→mm2)으로 가고,
 *   한 자리면 그대로 있고, 분 칸에서는 아무 데도 안 간다.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');

function load() {
  const a = SRC.indexOf('/* 시 칸에 숫자 두 개를 넣으면');
  assert.ok(a >= 0, '시→분 넘어가기 조각을 못 찾았다');
  const b = SRC.indexOf('/* ═', a);
  const code = SRC.slice(a, b);
  const els = {};
  let handler = null;
  const doc = {
    addEventListener: (ev, fn) => { if (ev === 'input') handler = fn; },
    getElementById: (id) => els[id] || null,
  };
  vm.runInNewContext(code, { document: doc, String });
  assert.ok(handler, 'input 듣개가 걸리지 않았다');
  const mk = (id) => (els[id] = {
    id, value: '', focused: false,
    // 시 칸만 «시 칸 고르개»에 걸린다
    matches: (sel) => /\^="mh"/.test(sel) && id.startsWith('mh'),
    focus() { this.focused = true; }, select() {},
  });
  return { handler, mk };
}

test('시 칸에 두 자리 → 짝이 되는 분 칸으로', () => {
  const { handler, mk } = load();
  for (const n of ['0', '1', '2']) {
    const h = mk('mh' + n), m = mk('mm' + n);
    h.value = '14';
    handler({ target: h });
    assert.ok(m.focused, 'mh' + n + ' → mm' + n + ' 로 안 넘어갔다');
  }
});

test('한 자리면 그대로 · 분 칸에서는 안 넘어간다', () => {
  const { handler, mk } = load();
  const h = mk('mh0'), m = mk('mm0');
  h.value = '8';
  handler({ target: h });
  assert.ok(!m.focused, '한 자리인데 넘어갔다');
  const m1 = mk('mm1'), h1 = mk('mh1');
  m1.value = '48';
  handler({ target: m1 });
  assert.ok(!h1.focused && !m1.focused, '분 칸에서 움직였다');
});
