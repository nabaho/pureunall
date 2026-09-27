'use strict';
/* 📄 「한글 편집화면과 이 화면이 다르게 나온다 · 도장도 안 나온다」 (대표 제보 2026-09-27)
   ─────────────────────────────────────────────────────────────
   ■ 다른 것이 «맞다» — 고장이 아니라 설계다
     · 입력판 = «원본» + 그 위에 얹은 입력칸. 빈 칸이어야 입력칸이 생기므로
       `rhBuildInput` 은 `_rhBase || _rhDoc` 를 그린다.
     · 완성본 = 값이 들어가고 도장이 찍힌 문서. 한글 편집·한글로 보기가 이것을 그린다.
     그래서 «입력판에는 도장이 영영 안 보인다».
   ■ 그런데 화면이 그 말을 안 했다 → 대표는 「도장이 안 찍혔다」로 보셨다.
   ⚠ 조용히 두면 안 된다 — 어느 쪽이 진짜 서류인지 알 수 없다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const CODE = stripComments(fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8'));

function cutFn(src, decl) {
  const head = src.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = src.indexOf('{', head + decl.length), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(head, i + 1);
}

/* 가짜 화면 — 알림줄 하나만 있으면 된다 */
function 세상(opt) {
  const 붙은것 = [];
  const hint = { id: 'kfHintBar', appendChild: (el) => { 붙은것.push(el); } };
  const 있는것 = { kfHintBar: hint };
  const ctx = {
    console, String, Object, Boolean, RegExp,
    document: {
      getElementById: (id) => 있는것[id] || null,
      createElement: () => ({ id: '', style: { cssText: '' }, textContent: '',
        remove: function () { this._removed = true; } })
    },
    _safe: (f) => { try { return f(); } catch (e) { ctx._err = String(e); } },
    _rhBase: opt.base, _rhDoc: opt.doc,
    _붙은것: 붙은것, _있는것: 있는것
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(cutFn(CODE, 'function rhInputBaseNote('), ctx);
  return ctx;
}
const 바이트 = (n) => ({ length: n });

test('★★★ 채운 뒤에는 «여기는 원본»이라고 밝힌다 — 안 밝히면 고장으로 읽힌다', () => {
  const ctx = 세상({
    base: { name: '양식.hwpx', bytes: 바이트(10) },
    doc: { name: '양식_채움.hwpx', bytes: 바이트(20) }
  });
  vm.runInContext('rhInputBaseNote()', ctx);
  assert.equal(ctx._붙은것.length, 1, '★ 아무 말도 안 합니다');
  const t = ctx._붙은것[0].textContent;
  assert.match(t, /원본/, '★ 이 화면이 원본이라는 말이 없습니다');
  assert.match(t, /한글로 보기|한글 편집/, '★ 어디서 보면 되는지 «길»이 없습니다(막다른 길)');
});

test('★★★ 도장이 찍혔으면 «어디서 보이는지» 말한다', () => {
  const ctx = 세상({
    base: { name: '양식.hwpx', bytes: 바이트(10) },
    doc: { name: '양식_채움_날인.hwpx', bytes: 바이트(20) }
  });
  vm.runInContext('rhInputBaseNote()', ctx);
  const t = ctx._붙은것[0].textContent;
  assert.match(t, /도장/, '★ 도장 이야기가 없습니다');
  assert.ok(!/아직 안 찍혔습니다/.test(t), '★ 찍혔는데 안 찍혔다고 합니다');
});

test('★★ 도장이 «안» 찍혔으면 그렇다고 말한다 — 찍힌 줄 알고 내면 안 된다', () => {
  const ctx = 세상({
    base: { name: '양식.hwpx', bytes: 바이트(10) },
    doc: { name: '양식_채움.hwpx', bytes: 바이트(20) }
  });
  vm.runInContext('rhInputBaseNote()', ctx);
  assert.match(ctx._붙은것[0].textContent, /아직 안 찍혔습니다/,
    '★ 도장이 없는데 말해 주지 않습니다');
});

test('★ 아직 아무것도 안 채웠으면 «할 말이 없다» — 공연한 글을 안 붙인다', () => {
  const 같은바이트 = 바이트(10);
  const ctx = 세상({
    base: { name: '양식.hwpx', bytes: 같은바이트 },
    doc: { name: '양식.hwpx', bytes: 같은바이트 }
  });
  vm.runInContext('rhInputBaseNote()', ctx);
  assert.equal(ctx._붙은것.length, 0, '★ 채우지도 않았는데 안내가 뜹니다');
});

test('★ 원본이 없으면(옛 자리) 조용히 지나간다 — 터지면 입력판이 통째로 안 그려진다', () => {
  const ctx = 세상({ base: null, doc: { name: '양식_채움.hwpx', bytes: 바이트(20) } });
  assert.doesNotThrow(() => vm.runInContext('rhInputBaseNote()', ctx));
  assert.equal(ctx._붙은것.length, 0);
});

test('★ 두 번 그려도 안내가 «쌓이지» 않는다', () => {
  const ctx = 세상({
    base: { name: '양식.hwpx', bytes: 바이트(10) },
    doc: { name: '양식_채움.hwpx', bytes: 바이트(20) }
  });
  vm.runInContext('rhInputBaseNote()', ctx);
  ctx._있는것.kfBaseNote = ctx._붙은것[0];      /* 이제 화면에 있다 */
  vm.runInContext('rhInputBaseNote()', ctx);
  assert.ok(ctx._붙은것[0]._removed, '★ 앞 안내를 안 치웁니다 — 줄마다 쌓입니다');
});

/* ══════ 짜임 자체를 못박는다 ══════ */
test('★★★ 입력판은 «원본»을 그린다 — 채워진 문서를 그리면 입력칸이 안 생긴다', () => {
  const b = cutFn(CODE, 'async function rhBuildInput(');
  assert.match(b, /var _b=_rhBase\|\|_rhDoc;/,
    '★ 입력판이 채워진 문서를 그립니다 — 빈 칸이 아니라 입력칸이 안 생깁니다');
  assert.match(b, /rhInputBaseNote\(\)/,
    '★ 「여기는 원본」이라고 밝히지 않습니다 — 「도장이 안 나온다」로 읽힙니다');
});
