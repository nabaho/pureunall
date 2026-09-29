'use strict';
/* 🪟 팝업은 Esc · 바깥 클릭으로 닫힌다 (대표 지시 2026-09-29 「팝업창 esc 나 다른 클릭 하면 사라지게 해라」)
   실측: 「📄 한글 서식 — 실제 A4 쪽 그대로」 창이 Esc 에도, 바깥을 눌러도 안 닫혔다.
   못 박는 것:
     ① Esc 는 가장 나중에 연 창을 닫는다 — 모든 .modal-ov 가 대상이다
     ② «그 창의 닫기»를 부른다(한글 서식 창은 closeHwpView — 숨은 편집기까지 거둔다)
     ③ 한글로 고치는 중이면 닫지 않는다 — 고친 것이 사라진다
     ④ 바깥 클릭은 «누름·뗌 둘 다 바깥»일 때만 — 끌어 고르다 밖에서 떼면 안 닫는다
     ⑤ 입력칸이 많은 창은 바깥 클릭으로 안 닫는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const cut = (sig) => { const a = html.indexOf(sig); assert.ok(a >= 0, sig); const b = html.indexOf('\n}', a); return html.slice(a, b + 2); };

function 세상(열린) {
  const 닫힘 = [];
  const mk = (id, t) => ({ id, _t: t, classList: { contains: (c) => c === 'open', remove: () => 닫힘.push(id + ':remove') },
    querySelectorAll: () => [] });
  const els = 열린.map(([id, t]) => mk(id, t));
  const ctx = {
    document: { querySelectorAll: () => els, getElementById: (id) => (id === 'hwpViewFootEdit' ? ctx._ed : null) },
    closeHwpView: () => 닫힘.push('closeHwpView'), closeForm: () => 닫힘.push('closeForm'),
    toast: (m) => 닫힘.push('toast:' + m), _ed: { style: { display: 'none' } }, 닫힘
  };
  vm.createContext(ctx);
  vm.runInContext('var KC_MODAL_NO_BACKDROP={}; var _kcModalOpenAt={};', ctx);
  ['function _kcModalCloser(', 'function _kcModalBusy(', 'function kcCloseTopModal('].forEach((s) => vm.runInContext(cut(s), ctx));
  els.forEach((e) => { ctx._kcModalOpenAt[e.id] = e._t; });
  return ctx;
}

test('①② Esc 는 가장 나중에 연 창을 «그 창의 닫기»로 닫는다', () => {
  const ctx = 세상([['modalHwpView', 2], ['modalForm', 1]]);
  assert.equal(vm.runInContext('kcCloseTopModal()', ctx), true);
  assert.deepEqual(ctx.닫힘, ['closeHwpView']);
  const c2 = 세상([['modalHwpView', 1], ['modalForm', 5]]);
  vm.runInContext('kcCloseTopModal()', c2);
  assert.deepEqual(c2.닫힘, ['closeForm']);
});

test('닫기 단추가 없는 창은 표시만 뗀다 · 열린 창이 없으면 아무것도 안 한다', () => {
  const ctx = 세상([['modalTidy', 1]]);
  vm.runInContext('kcCloseTopModal()', ctx);
  assert.deepEqual(ctx.닫힘, ['modalTidy:remove']);
  assert.equal(vm.runInContext('kcCloseTopModal()', 세상([])), false);
});

test('③ 한글로 고치는 중이면 닫지 않고 까닭을 말한다', () => {
  const ctx = 세상([['modalHwpView', 1]]);
  ctx._ed.style.display = '';
  vm.runInContext('kcCloseTopModal()', ctx);
  assert.ok(!ctx.닫힘.includes('closeHwpView'));
  assert.ok(ctx.닫힘.some((x) => /^toast:.*그만두기/.test(x)));
});

test('④⑤ 바깥 클릭 — 누름·뗌 둘 다 바깥 · 입력 창은 제외 · 모든 창에 붙는다', () => {
  const fn = cut('function kcModalWire(');
  assert.match(fn, /querySelectorAll\('\.modal-ov'\)/);
  assert.match(fn, /mousedown[\s\S]*e\.target===ov/);
  assert.match(fn, /e\.target!==ov \|\| !밖에서눌림/);
  assert.match(fn, /if\(KC_MODAL_NO_BACKDROP\[ov\.id\]\) return;/);
  assert.match(html, /var KC_MODAL_NO_BACKDROP=\{[^}]*modalBulk:1[^}]*modalPaste:1/);
  assert.match(html, /if\(kcCloseTopModal\(\)\)\{ e\.preventDefault\(\); return; \}/, '전체 Esc 처리에 이어져야 한다');
});
