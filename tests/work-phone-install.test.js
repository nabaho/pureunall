/* 📲 업무관리 — 폰 바탕화면에 아이콘 만들기 (대표 「추천대로」 2026-10-09)
   대표: 「폰에서 로그인 후 화면으로 넘어가려면 많이 힘들다」 → 포털을 거치지 않는 아이콘. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const a = src.indexOf('window._wkInstall=null;');
const b = src.indexOf('/* ── 폰 홈화면 앱 등록');
const snippet = src.slice(a, b);

function box() {
  const listeners = {};
  const nav = { style: { display: 'none' } };
  const said = [];
  const w = {
    addEventListener: (k, fn) => { listeners[k] = fn; },
    document: { getElementById: (id) => (id === 'nav-install' ? nav : null) },
    toast: (m) => said.push(m),
  };
  w.window = w;
  vm.createContext(w);
  vm.runInContext(snippet, w);
  return { w, listeners, nav, said };
}

test('메뉴는 크롬이 «깔 수 있다»고 알려 줄 때만 보인다', () => {
  assert.match(src, /id="nav-install" onclick="wkInstall\(\)" style="'\+\(window\._wkInstall\?'':'display:none'\)\+'"/);
  const { listeners, nav } = box();
  assert.strictEqual(nav.style.display, 'none');
  listeners.beforeinstallprompt({ preventDefault() {}, prompt() {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  assert.strictEqual(nav.style.display, '');
});

test('누르면 크롬의 «설치» 창을 띄우고, 깔았으면 메뉴를 감춘다', async () => {
  const { w, listeners, nav, said } = box();
  let asked = 0;
  listeners.beforeinstallprompt({ preventDefault() {}, prompt() { asked++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  w.wkInstall();
  await new Promise((r) => setTimeout(r, 0));
  assert.strictEqual(asked, 1);
  assert.strictEqual(nav.style.display, 'none');
  assert.ok(said.some((m) => /아이콘을 만들었습니다/.test(m)));
});

test('신호가 없을 때 누르면 손으로 하는 길을 알려 준다(조용히 아무 일도 안 하지 않는다)', () => {
  const { w, said } = box();
  w.wkInstall();
  assert.ok(said.some((m) => /홈 화면에 추가/.test(m)));
});

test('업무관리는 따로 깔리는 앱이다 — 시작 화면이 work.html', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'work-manifest.json'), 'utf8'));
  assert.match(m.start_url, /work\.html$/);
  assert.strictEqual(m.display, 'standalone');
  assert.match(src, /<link rel="manifest" href="work-manifest\.json">/);
});
