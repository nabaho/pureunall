'use strict';
/* 📁 서류 폴더 — 단추를 «누른 그 자리에서» 잇는다 (대표 화면 2026-10-05)
   사업 고르기를 눌렀더니 「먼저 위촉장 › ⋯ 더보기 › 서류 폴더 연결」 안내만 뜨고 멈췄다.
   ① 이어 둔 폴더가 있으면 그것 · 없으면 곧장 고르기 창
   ② 이어 둔 폴더에 필요한 하위 폴더(7번·5번)가 없으면 다시 고르게 한다
   ③ 고른 폴더도 틀리면 멈추되, 다음에 누르면 묻지 않고 곧장 고르기 창(엉뚱한 폴더에 갇히지 않게) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 없음');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 폴더 = (name, subs) => ({ name, getDirectoryHandle: async (n) => { if ((subs || []).indexOf(n) < 0) throw new Error('없음'); return {}; } });
function 상자(이어둔, 고를것들) {
  const 기록 = { 고르기: 0, 알림: [] };
  const ctx = { console, KcareerCases: { CASE_ROOT: '7. 컨설턴트,위원신청등' },
    fsRoot: async () => 이어둔, fsConnectFolder: async () => { 기록.고르기++; return 고를것들.shift() || null; },
    toast: (m) => 기록.알림.push(m) };
  vm.createContext(ctx);
  vm.runInContext(['var _fsRepick=false;', 떼기('async function _fsHas('), 떼기('async function fsRootOrConnect(')].join('\n'), ctx);
  return { ctx, 기록 };
}
const 칠 = '7. 컨설턴트,위원신청등';

test('① 이어 둔 폴더가 맞으면 그것 — 고르기 창을 띄우지 않는다', async () => {
  const 맞음 = 폴더('개인 이력', [칠]);
  const { ctx, 기록 } = 상자(맞음, []);
  assert.equal(await ctx.fsRootOrConnect(칠), 맞음);
  assert.equal(기록.고르기, 0);
});

test('★ ① 이어 둔 폴더가 없으면 «곧장» 고르기 창 — 다른 화면으로 보내지 않는다', async () => {
  const 고른 = 폴더('개인 이력', [칠]);
  const { ctx, 기록 } = 상자(null, [고른]);
  assert.equal(await ctx.fsRootOrConnect(칠), 고른);
  assert.equal(기록.고르기, 1);
  assert.ok(기록.알림.some((m) => m.indexOf(칠) >= 0), '무엇을 골라야 하는지 고르기 전에 알린다');
});

test('★ ② 이어 둔 폴더에 7번이 없으면 다시 고른다', async () => {
  const 틀림 = 폴더('바탕 화면', []), 맞음 = 폴더('개인 이력', [칠]);
  const { ctx, 기록 } = 상자(틀림, [맞음]);
  assert.equal(await ctx.fsRootOrConnect(칠), 맞음);
  assert.equal(기록.고르기, 1);
});

test('★★ ③ 고른 폴더도 틀리면 멈추되, 다음엔 곧장 고르기 창 — 엉뚱한 폴더에 갇히지 않는다', async () => {
  const 틀림 = 폴더('바탕 화면', []), 맞음 = 폴더('개인 이력', [칠]);
  const 고를것 = [틀림, 맞음];
  const { ctx, 기록 } = 상자(null, 고를것);
  assert.equal(await ctx.fsRootOrConnect(칠), null);
  assert.equal(vm.runInContext('_fsRepick', ctx), true);
  let 물음 = 0;
  ctx.fsRoot = async () => { 물음++; return 틀림; };   /* 틀린 것이 이어진 채로 남아 있어도 */
  assert.equal(await ctx.fsRootOrConnect(칠), 맞음, '다시 누르면 이어 둔 틀린 폴더를 쓰지 않고 고르기 창');
  assert.equal(물음, 0, '★ 이어 둔 폴더의 허락부터 물으면 누른 힘이 거기 쓰여 고르기 창이 막힌다');
  assert.equal(기록.고르기, 2);
  assert.equal(await ctx.fsRootOrConnect(), 틀림, '고르기를 마치면 다시 이어 둔 폴더를 쓴다');
});

test('네 단추 모두 이 길을 쓴다 · 「먼저 위촉장 › 더보기」 막다른 안내는 남지 않는다', () => {
  [['async function caseCheck(', 'KcareerCases.CASE_ROOT'], ['async function caseImportPast(', 'KcareerCases.CASE_ROOT'],
   ['async function bizPickCase(', 'KcareerCases.CASE_ROOT'], ['async function docImportResumeFolder(', "fsFolderFor('resume')"]].forEach(([f, need]) => {
    assert.ok(떼기(f).indexOf('fsRootOrConnect(' + need + ')') >= 0, f + ' 가 누른 자리에서 폴더를 잇지 않습니다');
  });
  assert.ok(SRC.indexOf("먼저 위촉장 › ⋯ 더보기 › 📁 서류 폴더 연결을 눌러 폴더를 지정하세요') ; return") < 0);
  assert.ok(!/confirm\(/.test(떼기('async function fsRootOrConnect(')), '★ 묻는 창을 끼우면 브라우저가 고르기 창을 막는다(누른 직후에만 열린다)');
});
