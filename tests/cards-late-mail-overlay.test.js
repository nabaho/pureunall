'use strict';
/* 늦게 끝난 메일 조회가 다른 화면을 덮지 않는다 · 「어느 칸」 셈은 그리는 동안 주소마다 한 번
   (2026-10-03 Codex 가 시작하고 멈춘 고침을 이어받음 — 대표 「다른 방에서 하던 것 계속」)

   못 박는 것(규칙):
   ① 메일 화면이 아니면 메일을 그리지 않는다 — 폰의 명함 목록(#list)을 메일함으로 덮지 않는다
   ② 단, 같은 칸을 빌려 쓰는 「📥 연락처 정리」(cnt)는 그대로 그린다
   ③ mbRuleBinOf 는 한 번 그리는 동안 같은 주소를 두 번 세지 않는다 — 그리기가 새로 시작되면 다시 센다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const B = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n'));
const fn = (n) => { const f = cutFn(B, 'function ' + n + '('); assert.ok(f, n + ' 를 못 찾았습니다'); return f; };

test('① ★★ 메일 화면이 아니면 그리지 않는다 — 명함 목록을 덮지 않는다', () => {
  const 한일 = [];
  const ctx = {
    state: { view: 'list' },
    mbMemoClear() {}, renderCntPage() { 한일.push('cnt'); },
    mbAutoFill() { 한일.push('메일 그리기'); }, mbSeenLoad() {}, mbBizSubsLoad() {},
    $: (id) => ({ id, set innerHTML(v) { 한일.push('#' + id + ' 덮음'); } })
  };
  vm.createContext(ctx);
  vm.runInContext(fn('renderMailPage') + '\n' + fn('renderMailMobile'), ctx);
  for (const v of ['list', 'co', 'mat', 'set']) {
    한일.length = 0; ctx.state.view = v;
    ctx.renderMailPage();
    ctx.renderMailMobile();
    assert.deepEqual(한일, [], '★★ 「' + v + '」 화면인데 메일을 그렸습니다 — 늦게 끝난 조회가 그 화면을 덮습니다');
  }
  한일.length = 0; ctx.state.view = 'cnt';
  ctx.renderMailPage();
  assert.deepEqual(한일, ['cnt'], '★★ 「연락처 정리」 화면이 안 그려집니다 — 같은 칸을 빌려 씁니다');
  한일.length = 0; ctx.state.view = 'mail';
  try { ctx.renderMailPage(); } catch (e) { /* 메일 그리기 본문은 이 상자에 없다 — 들어가기만 보면 된다 */ }
  assert.ok(한일.includes('메일 그리기'), '메일 화면인데 메일을 안 그립니다');
});

test('③ ★★ 「어느 칸」 셈은 그리는 동안 주소마다 한 번 — 새로 그리면 다시 센다', () => {
  let 센수 = 0;
  const ctx = {
    _mbMemo: null, _mbBinRule: { 'a@가나상사.kr': 'b1', '@임꺽정.kr': 'b2' },
    mbBinRuleMap() { return {}; },
    mbWhoKey(e) { 센수++; return e; },
    mbBinBy(id) { return id === 'b1' || id === 'b2' ? { id } : null; },
    mbDomOf(e) { return String(e).split('@')[1] || ''; },
    Map, String
  };
  vm.createContext(ctx);
  vm.runInContext('var _mbMemo = null;\n' + fn('mbMemoClear') + '\n' + fn('mbMemoOf') + '\n' + fn('mbRuleBinOf'), ctx);
  const 한통 = { e: 'A@가나상사.kr' };
  assert.equal(ctx.mbRuleBinOf(한통), 'b1');
  const 처음 = 센수;
  for (let i = 0; i < 30; i++) ctx.mbRuleBinOf({ e: 'a@가나상사.kr' });
  assert.equal(센수, 처음, '★★ 같은 주소를 통마다 다시 셉니다 — mbWhoKey 가 수만 번 불립니다');
  assert.equal(ctx.mbRuleBinOf({ e: 'x@임꺽정.kr' }), 'b2', '도메인으로 정한 칸을 못 찾습니다');
  assert.equal(ctx.mbRuleBinOf({ e: 'y@모름.kr' }), '', '정한 칸이 없으면 비어야 합니다');
  // 규칙을 바꾸고 새로 그리면(mbMemoClear) 바뀐 답이 나온다 — 낡은 기억을 안 쓴다
  vm.runInContext("_mbBinRule['a@가나상사.kr'] = 'b2'; mbMemoClear();", ctx);
  assert.equal(ctx.mbRuleBinOf(한통), 'b2', '★★ 규칙을 바꿨는데 낡은 칸이 나옵니다');
});
