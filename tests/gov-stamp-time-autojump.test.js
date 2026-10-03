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
  const apply = { focused: false, focus() { this.focused = true; } };
  const mk = (id, hidden) => (els[id] = {
    id, value: '', focused: false, offsetParent: hidden ? null : {},
    // 고르개에 적힌 칸 종류(mh·mm)만 걸린다
    matches: (sel) => sel.includes('[id^="' + id.slice(0, 2) + '"]'),
    closest: () => ({ querySelector: () => apply }),
    focus() { this.focused = true; }, select() {},
  });
  return { handler, mk, apply };
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

test('한 자리면 그대로', () => {
  const { handler, mk } = load();
  const h = mk('mh0'), m = mk('mm0'), h1 = mk('mh1');
  h.value = '8'; handler({ target: h });
  m.value = '5'; handler({ target: m });
  assert.ok(!m.focused && !h1.focused, '한 자리인데 넘어갔다');
});

test('분 칸 두 자리 → 다음 줄 시 칸', () => {
  const { handler, mk, apply } = load();
  const m0 = mk('mm0'), h1 = mk('mh1');
  m0.value = '55'; handler({ target: m0 });
  assert.ok(h1.focused, 'mm0 → mh1 로 안 넘어갔다');
  assert.ok(!apply.focused);
});

test('다음 줄이 없거나 숨었으면 그 줄 「적용」 단추로', () => {
  let r = load();
  const m1 = r.mk('mm1');
  m1.value = '48'; r.handler({ target: m1 });
  assert.ok(r.apply.focused, '마지막 줄인데 적용 단추로 안 갔다');
  r = load();
  const m0 = r.mk('mm0'), h1 = r.mk('mh1', true);
  m0.value = '30'; r.handler({ target: m0 });
  assert.ok(!h1.focused && r.apply.focused, '숨은 줄로 갔다');
});
