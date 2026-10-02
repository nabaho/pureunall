/* 📦 사본(씨앗)을 «시간 다툼»으로 놓치지 않는다 (대표 크롬 실측 2026-10-02)
   사본이 있는데도 세 번 내리 「⏱ … 사본으로 먼저 그림 안 옴 · 명함 다 옴(통째로)」였다.
   사본 읽기는 25ms 인데 로그인 직후 화면이 바빠, 400ms 타이머가 먼저 울려 3MB 를 통째로 받았다.
   ★ 못 박는 것
     ① 저장소가 열렸다는 신호(onOpen)를 cardCacheGet 이 준다
     ② 열렸으면 3초까지 기다린다 · 안 열리면 400ms 뒤 그냥 시작한다(문이 잠기면 안 된다)
     ③ 통째로 받게 되면 «까닭»을 콘솔에 한 줄로 남긴다 — 다음에 또 지면 이름을 댄다
   node --test tests/cards-seed-no-race.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

test('★★★ ① cardCacheGet 이 «열렸다»를 알린다', () => {
  const f = cutFn(SRC, 'function cardCacheGet(');
  assert.match(f, /^function cardCacheGet\(cb, onOpen\)/);
  assert.match(f, /rq\.onsuccess = e=>\{\s*try\{ if\(onOpen\) onOpen\(\); \}/, '★ 열린 순간 알리지 않는다');
  const i = SRC.indexOf('            cardCacheGet(snap=>{');
  assert.ok(i > 0);
  assert.match(SRC.slice(i, i + 2600), /\}, \(\)=>\{ _cacheOpen = true; \}\);/, '★★ 부르는 쪽이 «열렸다»를 안 받는다');
});

test('★★★ ② 열렸으면 3초까지 · 안 열리면 400ms — 실제로 돌려 본다', () => {
  const i = SRC.indexOf('let _cacheOpen = false;');
  const body = SRC.slice(i, SRC.indexOf('_subT = setTimeout(_giveUp, 400);', i) + '_subT = setTimeout(_giveUp, 400);'.length);
  function run(open) {
    let now = 0; const q = []; const logs = []; let subbed = null;
    const ctx = { Date: { now: () => now }, console: { log: m => logs.push(m) },
      setTimeout: (fn, ms) => { q.push([now + ms, fn]); return q.length; },
      goSub: v => { subbed = now; ctx._subKicked = true; }, _subKicked: false, _subT: null };
    vm.createContext(ctx);
    vm.runInContext(body.replace('let _cacheOpen = false;', 'var _cacheOpen = ' + open + ';')
      .replace('const _subStart', 'var _subStart').replace('const _giveUp', 'var _giveUp')
      .replace(/_subKicked/g, 'this._subKicked'), ctx);
    for (let k = 0; k < 100 && subbed === null && q.length; k++) {
      q.sort((a, b) => a[0] - b[0]); const [t, fn] = q.shift(); now = t; fn();
    }
    return { subbed, logs };
  }
  const shut = run(false);
  assert.equal(shut.subbed, 400, '★ 저장소가 안 열리는데 400ms 보다 오래 기다린다 — 문이 잠긴다');
  assert.match(shut.logs[0], /저장소가 안 열림/);
  const open = run(true);
  assert.ok(open.subbed >= 3000 && open.subbed < 3400, '★★★ 열렸는데 400ms 에 포기했다 — 그것이 대표 크롬에서 진 자리다: ' + open.subbed);
  assert.match(open.logs[0], /사본을 \d+ms 안에 못 읽어 통째로/, '★ 까닭을 안 남긴다');
});

test('★★ ③ 통째로 받는 길마다 까닭을 남긴다', () => {
  assert.match(SRC, /console\.log\('\[명함\] 지운 자국을 800ms 안에 못 읽어 통째로 받습니다'\)/);
  assert.match(SRC, /console\.log\('\[명함\] 사흘에 한 번 통째로 받습니다\(스스로 낫기\)'\)/);
});
