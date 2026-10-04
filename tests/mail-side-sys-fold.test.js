'use strict';
/* 📬 메일함 무리 통째로 접기 (대표 지시 2026-10-04 「이부분 전체 접었다 펴기 가능한가」)
   지키는 것
   ① 처음에는 펼쳐져 있다(예전과 같다) · 접은 것은 이 PC 에 기억한다
   ② 접으면 머리줄만 남고, 안 읽은 수는 머리줄에 남는다 — 새 메일을 놓치지 않게
   ③ 저장소가 막혀도 안 죽는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function box(ls) {
  const ctx = { state: {}, drew: 0, localStorage: ls };
  ctx.renderPCSide = () => { ctx.drew++; };
  vm.createContext(ctx);
  vm.runInContext("var MB_SYS_FOLD_LS = 'pucards_mb_sysfold';", ctx);
  ['mbSysFolded', 'mbToggleSys'].forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return ctx;
}
const mem = (init) => { const m = Object.assign({}, init); return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };

test('★★ 처음에는 펼쳐져 있다 · 접으면 이 PC 에 기억한다', () => {
  const ls = mem();
  const c = box(ls);
  assert.equal(c.mbSysFolded(), false, '★★ 처음부터 접혀 있습니다');
  c.mbToggleSys();
  assert.equal(c.mbSysFolded(), true);
  assert.equal(ls.m.pucards_mb_sysfold, '1', '★★ 접은 것을 기억 안 합니다 — 열 때마다 다시 펼쳐집니다');
  assert.equal(c.drew, 1);
  assert.equal(box(ls).mbSysFolded(), true, '★★ 다시 열면 펼쳐집니다');
});

test('★ 저장소가 막혀도 안 죽는다', () => {
  const c = box({ getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } });
  assert.equal(c.mbSysFolded(), false);
  c.mbToggleSys();
  assert.equal(c.mbSysFolded(), true);
});

test('★★★ 접으면 줄들을 걷고 머리줄만 — 안 읽은 수는 머리줄에 남는다', () => {
  const side = strip(sliceFn(app, 'function mailSideHtml('));
  assert.match(side, /const sysFrom = h\.length;\s*h \+= row\('\*all'/, '★★ 무리의 시작이 전체메일이 아닙니다');
  assert.match(side, /h = h\.slice\(0, sysFrom\) \+ head \+ \(folded \? '' : h\.slice\(sysFrom\)\)/, '★★★ 접어도 줄들이 남습니다');
  assert.match(side, /folded && sysUn \?/, '★★★ 접으면 안 읽은 수가 사라집니다 — 새 메일을 놓칩니다');
  assert.match(side, /sysUn \+= un;/);
  assert.ok(side.indexOf('const sysFrom') < side.indexOf('지난 메일') && side.indexOf('h = h.slice(0, sysFrom)') > side.indexOf('지난 메일'),
    '★★ 지난 메일이 무리 밖에 있습니다');
});
