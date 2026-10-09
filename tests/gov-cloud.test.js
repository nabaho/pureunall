'use strict';
/* 정부사업신청 — 클라우드 자리(gov/{uid}) 규칙 + 막혔을 때 «말하기» (2026-10-03)
   ⚠★ 앱이 생긴 날(09-05)부터 gov/ 에 보안규칙이 «없어» 저장·불러오기가 통째로 막혀 있었다.
      cloudPush/cloudPull 이 .catch(function(){}) 로 삼켜 아무도 몰랐고,
      한 브라우저에서 넣은 인증키가 다른 브라우저로 안 넘어왔다(실측 permission_denied). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'gov.html'), 'utf8');
const rulesSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'make-firebase-rules.js'), 'utf8');
const rules = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;

/* ───────── 규칙 ───────── */

test('★★ gov/{uid} 규칙이 «있다» — 없으면 저장·불러오기가 통째로 막힌다', () => {
  assert.ok(rules.gov && rules.gov.$uid, 'gov 규칙이 사라졌습니다 — 인증키가 기기 사이로 안 넘어갑니다');
  assert.match(rulesSrc, /rules\.gov\s*=/, '규칙은 «만들개»에서 고친다');
});

test('★★ gov/{uid} 는 «본인만» 읽고 쓴다 — 인증키가 들어 있다', () => {
  const r = rules.gov.$uid;
  assert.match(r['.read'], /auth\.uid === \$uid/);
  assert.match(r['.write'], /auth\.uid === \$uid/);
  // 관리자·직원에게 넓히면 인증키가 남에게 보인다
  assert.doesNotMatch(r['.read'], /isAdmin|\|\|/, '읽기를 넓히면 인증키가 남에게 보입니다');
  assert.doesNotMatch(r['.write'], /isAdmin|\|\|/);
});

test('★ 최상위 gov 에는 읽기·쓰기를 열지 않는다', () => {
  assert.equal(rules.gov['.read'], undefined, '최상위를 열면 모든 사람의 인증키가 보입니다');
  assert.equal(rules.gov['.write'], undefined);
});

/* ───────── 막혔을 때 말하기 — 앱 함수를 실제로 돌린다 ───────── */

function runApp() {
  const els = {};
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '',
      style: {}, classList: { add(){}, remove(){} } };
    return els[id];
  }
  const store = {};
  const timers = [];
  const ctx = {
    console, Math, JSON, Date, String, Number, Object, Array, RegExp, Promise,
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout: () => {},
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    document: { getElementById: el, createElement: () => ({ click(){}, style:{} }) },
    location: { protocol: 'https:' }, navigator: {},
    GovG2b: require('../js/gov-g2b.js'), GovPlan: require('../js/gov-plan.js'), GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'), GovCareer: require('../js/gov-career.js'), GovMatch: require('../js/gov-match.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'), GovSync: require('../js/gov-sync.js'),
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort=()=>{}; this.signal=null; },
    URL: { createObjectURL: () => 'blob:x' }, Blob: function(){}
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
  vm.runInNewContext(code + '\n;globalThis.__api={cloudPush,cloudPull,lsSet,'
    + 'setFb:function(db,uid){fbDb=db;fbUid=uid;}};', ctx);
  return { api: ctx.__api, el, timers, store };
}

/* 가짜 파이어베이스 — 'deny' 면 규칙이 막은 것처럼, 'ok' 면 받아 준다 */
function fakeDb(mode) {
  const err = Object.assign(new Error('permission_denied at /gov/U1'), { code: 'PERMISSION_DENIED' });
  return { writes: 0, sets: 0, ref() { const self = this; return {
    set() { self.sets++; return mode === 'deny' ? Promise.reject(err) : Promise.resolve(); },
    update() { self.writes++; return mode === 'deny' ? Promise.reject(err) : Promise.resolve(); },
    once() { return mode === 'deny' ? Promise.reject(err) : Promise.resolve({ val: () => null }); }
  }; } };
}
const tick = () => new Promise((r) => setImmediate(r));
/* 1.2초 기다림을 건너뛰며 «다 끝날 때까지» 돌린다(받기 → 보내기가 이어진다) */
async function drain(r) { for (let i = 0; i < 8; i++) { r.timers.splice(0).forEach((f) => f()); await tick(); await tick(); } }

test('★★ 저장이 막히면 «조용히» 넘기지 않는다 — 화면이 알린다', async () => {
  const r = runApp();
  r.api.setFb(fakeDb('deny'), 'U1');
  r.api.lsSet('kw', '["노무"]');                // 보낼 것이 생긴다
  await drain(r);
  assert.match(r.el('toast').textContent, /클라우드 (저장|불러오기) 실패/);
  assert.match(r.el('toast').textContent, /권한/, '무엇이 막혔는지 말해야 합니다');
  assert.match(r.el('toast').textContent, /이 기기에만/, '어디에 남았는지 말해야 합니다');
});

test('★ 알림은 «처음 한 번»만 — 1.2초마다 뜨면 일을 못 한다', async () => {
  const r = runApp();
  r.api.setFb(fakeDb('deny'), 'U1');
  for (let i = 0; i < 3; i++) { r.api.lsSet('kw', '["x' + i + '"]'); await drain(r); }
  r.el('toast').textContent = '';
  r.api.lsSet('kw', '["y"]'); await drain(r);
  assert.equal(r.el('toast').textContent, '', '같은 알림이 되풀이됩니다');
});

test('★ 다시 되면 표시를 놓는다 — 다음에 또 막히면 다시 알린다', async () => {
  const r = runApp();
  r.api.setFb(fakeDb('deny'), 'U1');
  r.api.lsSet('kw', '["a"]'); await drain(r);
  r.api.setFb(fakeDb('ok'), 'U1');
  r.api.lsSet('kw', '["b"]'); await drain(r);
  r.el('toast').textContent = '';
  r.api.setFb(fakeDb('deny'), 'U1');
  r.api.lsSet('kw', '["c"]'); await drain(r);
  assert.match(r.el('toast').textContent, /클라우드 저장 실패/, '한 번 되살아난 뒤엔 다시 알려야 합니다');
});

test('★★ 불러오기가 막혀도 알린다 — 다른 기기의 인증키가 안 오는 까닭이 이것이다', async () => {
  const r = runApp();
  r.api.setFb(fakeDb('deny'), 'U1');
  await r.api.cloudPull();
  assert.match(r.el('toast').textContent, /클라우드 불러오기 실패/);
});

test('잘 되면 아무 말도 하지 않는다', async () => {
  const r = runApp();
  const db = fakeDb('ok');
  r.api.setFb(db, 'U1');
  r.api.lsSet('kw', '["노무"]'); await drain(r);
  assert.equal(db.writes, 1, '고친 칸을 한 번 보낸다');
  assert.equal(db.sets, 0, '통째로 덮어쓰지 않는다');
  assert.equal(r.el('toast').textContent, '');
});

/* ═══ 2026-10-04 사고 — 옛 판 화면의 통째 set() 이 「컨설턴트 모집」 칸을 지웠다 ═══ */
test('★★★ 규칙이 sv ≥ 2 인 쓰기만 받는다 — 옛 판의 통째 set() 을 막는다', () => {
  const v = rules.gov.$uid['.validate'];
  assert.ok(v, 'gov/{uid} 에 .validate 가 없습니다 — 옛 판이 다시 통째로 지웁니다');
  assert.match(v, /newData\.child\('sv'\)\.val\(\) >= 2/);
  assert.match(v, /!newData\.exists\(\)/, '지우기는 받아야 합니다');
});
test('★★★ 화면은 gov/{uid} 를 «통째로» 쓰지 않는다 — update 에 sv 를 싣는다', () => {
  assert.doesNotMatch(src, /ref\('gov\/'\s*\+\s*fbUid\)\.set\(/, '통째 set() 이 되살아났습니다');
  assert.match(src, /upd=\{ sv:GovSync\.SV, at:Date\.now\(\) \}/);
  assert.match(src, /fbDb\.ref\(base\)\.update\(upd\)/);
  assert.ok(require('../js/gov-sync.js').SV >= 2);
});
test('★★ 받기가 한 번 성공하기 «전»에는 아무것도 안 올린다 — 빈 기기가 클라우드를 덮지 못하게', async () => {
  const r = runApp();
  const reads = [], writes = [];
  let deny = true;
  const db = { ref(p) { return {
    once() { reads.push(p); return deny ? Promise.reject(new Error('net')) : Promise.resolve({ val: () => null }); },
    update(u) { writes.push(u); return Promise.resolve(); } }; } };
  r.api.setFb(db, 'U1');
  r.api.lsSet('kw', '["노무"]'); await drain(r);
  assert.equal(writes.length, 0, '받기에 실패했는데 올렸습니다');
  deny = false;
  r.api.lsSet('kw', '["노무","인사"]'); await drain(r);
  assert.equal(writes.length, 1, '받기가 되면 그때 올린다');
});
