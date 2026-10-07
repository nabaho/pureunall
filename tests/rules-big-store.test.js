'use strict';
/* 규정관리의 작업본(WORK_KEY)·보관함 사본(ARCH_KEY)은 IndexedDB 에 둔다
   (2026-10-07 — 두 칸이 합쳐 1MB 로 localStorage 5MB 의 5분의 1을 먹어 경력관리가 목록을 못 적었다)

   지키는 것
   ① 두 칸은 bigGet·bigSet·bigDel 로만 만진다 — localStorage 로 바로 읽으면 옮긴 뒤 «빈 것»을 읽는다
   ② 창고의 열쇠 이름이 WORK_KEY·ARCH_KEY 와 같다(글자로 적었으므로 어긋날 수 있다)
   ③ 작업본 되살리기·옛 임시저장 이관·로그인 뒤 보관함 구독은 창고 켜짐을 기다린다
   ④ 켜지면 옛 자리 작업본이 새 자리로 옮겨지고, 그대로 읽힌다 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Big = require('../js/pu-big-store.js');
const { stripJs } = require('./strip-comments.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
const code = stripJs(html);

test('① 두 칸을 localStorage 로 바로 만지는 자리가 없다', () => {
  const bad = code.match(/localStorage\.(?:getItem|setItem|removeItem)\((?:WORK_KEY|ARCH_KEY)\b/g) || [];
  assert.deepEqual(bad, [], '옮긴 뒤에는 localStorage 에 없습니다 — bigGet·bigSet·bigDel 을 쓰세요');
  assert.ok((code.match(/bigGet\(WORK_KEY\)/g) || []).length >= 5, '작업본을 읽는 자리를 못 찾았습니다 — 찾는 규칙이 어긋났습니다');
});

test('② 창고 열쇠 이름이 WORK_KEY·ARCH_KEY 와 같다', () => {
  const work = html.match(/const WORK_KEY\s*=\s*"([^"]+)"/)[1];
  const arch = html.match(/const ARCH_KEY\s*=\s*"([^"]+)"/)[1];
  const keys = html.match(/PuBigStore\.mirror\(\{ keys: \[([^\]]+)\]/);
  assert.ok(keys, 'RULES_BIG 을 못 찾았습니다');
  const listed = keys[1].split(',').map((s) => s.trim().replace(/"/g, ''));
  assert.ok(listed.includes(work), '작업본이 창고 열쇠에 없으면 localStorage 에 그대로 남습니다');
  assert.ok(listed.includes(arch));
  assert.ok(html.indexOf('js/pu-big-store.js') > 0 && html.indexOf('js/pu-big-store.js') < html.indexOf('var RULES_BIG'),
    'pu-big-store.js 를 먼저 실어야 합니다');
  assert.match(html, /<script src="js\/pu-big-store\.js\?v=\d+"><\/script>/);
});

test('③ 되살리기·이관·로그인 뒤 구독은 창고 켜짐을 기다린다', () => {
  /* 맨바닥(들여쓰기 없는 줄)에서 바로 부르면 켜지기 전이다 */
  assert.ok(!/^migrateWip\(\);/m.test(code), '옛 임시저장 이관이 켜지기 전에 돌면 «작업본 없음»으로 읽습니다');
  assert.ok(!/^takeHandoff\(\);/m.test(code), '켜지기 전에 되살리면 빈 화면으로 시작하고, 그 위에 적으면 옮겨 둔 작업본을 덮습니다');
  const ready = [...code.matchAll(/^rulesBigReady\(\)\.then\(\(\)=>\{[\s\S]*?^\}\);/gm)].map((x) => x[0]);
  assert.ok(ready.length, '켜짐을 기다리는 자리(맨바닥)를 못 찾았습니다');
  assert.ok(ready.some((b) => /migrateWip\(\)[\s\S]*takeHandoff\(\)/.test(b)), '켜진 뒤 이관하고, 그 뒤에 되살린다');
  assert.match(code, /if\(u\)\{rulesBigReady\(\)\.then\(\(\)=>\{[^\n]*\n\s*subscribeArch\(\);/,
    '보관함 «덮어쓰기 전 사본»을 켜지기 전에 읽으면 브라우저에만 있던 기록을 못 올립니다');
});

test('④ 켜지면 옛 자리 작업본이 새 자리로 옮겨지고 그대로 읽힌다', async () => {
  const m = {};
  const ls = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
  const st = new Map();
  const store = { get: async (k) => (st.has(k) ? st.get(k) : null), put: async (k, v) => { st.set(k, v); }, del: async (k) => { st.delete(k); } };
  const ctx = { localStorage: ls, Promise, PuBigStore: { mirror: (o) => Big.mirror(Object.assign({}, o, { open: async () => store })) } };
  vm.createContext(ctx);
  const block = html.match(/var RULES_BIG = [\s\S]*?try \{ rulesBigReady\(\); \} catch\(e\)\{\}/);
  assert.ok(block, 'RULES_BIG 덩어리를 못 찾았습니다');
  m.pureun_rules_work_v1 = JSON.stringify({ orig: { name: '가나상사_취업규칙.hwp', b64: 'QUJD' }, savedAt: '2026-10-07T00:00:00Z' });
  vm.runInContext(block[0], ctx);
  await vm.runInContext('rulesBigReady()', ctx);
  assert.equal(m.pureun_rules_work_v1, undefined, '옮긴 뒤 옛 자리를 비워야 자리가 생깁니다');
  assert.equal(JSON.parse(ctx.bigGet('pureun_rules_work_v1')).orig.name, '가나상사_취업규칙.hwp');
  ctx.bigSet('pureun_rules_archive_v1', '[1]');
  assert.equal(ctx.bigGet('pureun_rules_archive_v1'), '[1]');
  assert.equal(m.pureun_rules_archive_v1, undefined);
  ctx.bigDel('pureun_rules_work_v1');
  assert.equal(ctx.bigGet('pureun_rules_work_v1'), null);
});
