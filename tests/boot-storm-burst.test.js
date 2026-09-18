'use strict';
/* 한 번의 일로 «몰려서» 켜진 것은 폭풍이 아니다 (대표 화면 2026-09-18)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     포털에 「이 기기에서 이 화면이 3분 안에 7번 다시 켜졌습니다 (매번 새 탭으로 열림)」이 떴다.
     그런데 서버 기록에는 되풀이 부팅이 없었다 — 또 거짓 경보였다.
   ■ 까닭
     대표님은 탭을 여러 개 띄워 두신다(이알피 셋·포털 둘 …). 로그아웃하면 pu-authsync 가
     그 탭들을 «한꺼번에» 포털로 보낸다. 탭마다 sessionStorage 는 새것이라 기기 눈에는
     몇 초 안에 포털 부팅이 대여섯 번 찍힌다. 정상 흐름인데 폭풍으로 보였다.
   ■ 가르는 법
     한 번의 일은 몇 초 안에 끝나고, 진짜 폭풍은 20초 간격으로 «끝없이» 이어진다.
     그래서 5초 안에 잇따라 켜진 것은 한 번으로 접어 센다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const ROOT = path.join(__dirname, '..');
const VER = fs.readFileSync(path.join(ROOT, 'js', 'pu-version.js'), 'utf8');

/* pu-version.js 를 가짜 창에 싣고, 시각을 손으로 돌려 부팅시킨다 */
function boot(opts) {
  const sess = opts.session || {};
  const local = opts.local;
  const body = { kids: [], appendChild(c) { this.kids.push(c); return c; } };
  const el = () => ({ style: {}, kids: [], attrs: {}, textContent: '', id: '', tabIndex: 0,
    appendChild(c) { this.kids.push(c); return c; }, setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener() {}, parentNode: null });
  const win = {
    document: { readyState: 'complete', body, referrer: '', createElement: el,
      getElementById: id => body.kids.find(k => k.id === id) || null,
      querySelector: () => null, scripts: [], addEventListener() {} },
    sessionStorage: { getItem: k => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: k => { delete sess[k]; } },
    localStorage: { getItem: k => (k in local ? local[k] : null), setItem: (k, v) => { local[k] = String(v); }, removeItem: k => { delete local[k]; } },
    location: { href: 'https://x.test/pureunall/enter.html', origin: 'https://x.test', pathname: '/pureunall/enter.html' },
    performance: { getEntriesByType: () => [{ type: 'navigate' }] },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, addEventListener() {},
    fetch: () => Promise.reject(new Error('no')),
    URL, JSON, Date: Object.assign(function () { return new Date(opts.now); }, { now: () => opts.now }),
    Math, Array, String, Number, Object, Promise, Error, RegExp, Infinity,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(VER, win);
  return { win, banner: body.kids.find(k => k.id === 'pu-boot-storm') || null };
}

test('①★★ 로그아웃이 탭 일곱 개를 한꺼번에 포털로 보내도 폭풍이 아니다', () => {
  const local = {};
  let last = null;
  /* 탭 일곱이 2초 안에 차례로 포털을 연다 — 탭마다 sessionStorage 는 새것이다 */
  for (let i = 0; i < 7; i++) last = boot({ session: {}, local, now: 1000000 + i * 300 });
  assert.equal(last.win.PU_BOOT.devCount, 1,
    '★★ 한 번의 일로 몰려 켜진 것을 일곱 번으로 세면, 로그아웃할 때마다 띠가 뜹니다');
  assert.equal(last.win.PU_BOOT.storm, false);
  assert.equal(last.banner, null, '★ 대표 화면에 실제로 뜬 그 띠입니다');
});

test('②★ 진짜 폭풍(20초 간격으로 이어지는 것)은 그대로 잡는다', () => {
  const local = {};
  let last = null;
  for (let i = 0; i < 5; i++) last = boot({ session: {}, local, now: 1000000 + i * 20000 });
  assert.equal(last.win.PU_BOOT.devCount, 5, '★ 접느라 진짜 폭풍까지 놓치면 고친 뜻이 없습니다');
  assert.equal(last.win.PU_BOOT.storm, true);
  assert.ok(last.banner, '★ 띠가 떠야 합니다');
});

test('③ 몰린 것과 이어지는 것이 섞여도 «이어지는 것»만 센다', () => {
  const local = {};
  let last = null;
  /* 20초마다 한 번씩, 그때마다 탭 셋이 동시에 열린다 → 세어야 할 것은 셋이 아니라 한 번 */
  [0, 20000, 40000, 60000, 80000].forEach(base => {
    [0, 200, 400].forEach(off => { last = boot({ session: {}, local, now: 1000000 + base + off }); });
  });
  assert.equal(last.win.PU_BOOT.devCount, 5, '★ 묶음마다 하나씩 = 다섯 번이어야 합니다');
  assert.equal(last.win.PU_BOOT.storm, true);
});

test('④ 접는 것은 «세는 법»뿐 — 기록은 그대로 남는다', () => {
  const local = {};
  for (let i = 0; i < 7; i++) boot({ session: {}, local, now: 1000000 + i * 300 });
  const saved = JSON.parse(local['pu_boot_dev_v1'])['/pureunall/enter.html'];
  assert.ok(saved.length >= 7, '★ 기록까지 접으면 사람이 콘솔에서 실제 횟수를 못 봅니다');
});

test('⑤ 5초는 «한 번의 일»과 «되풀이»를 가르는 자리다', () => {
  assert.match(VER, /var BOOT_BURST_MS = 5 \* 1000;/, '★ 가르는 자리가 없습니다');
  assert.match(cutFn(VER, 'function countSpread('), /BOOT_BURST_MS/, '★ 세는 곳이 그것을 안 봅니다');
});
