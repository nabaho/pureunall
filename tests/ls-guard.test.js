'use strict';
/* 저장 공간 감시(js/pu-ls-guard.js) — localStorage 쓰기 실패를 «삼키지 않고» 알린다 (2026-10-07)
   대표 크롬이 5MB 한도까지 차 경력관리가 목록을 못 적었는데, 앱마다 try{}catch(e){} 로 실패를 조용히 삼키는 자리가 많았다.

   지키는 것
   ① 쓰기는 예전 그대로 — 실패하면 예전처럼 던진다(부르는 쪽 처리는 안 바뀐다)
   ② 삼켜도 알린다 — 끝내 못 적은 것이 남으면 한 줄
   ③ 앱이 스스로 수습하면(다시 적기·«없어도 되는» 것 비우기) 안 알린다 — 잔소리가 되면 아무도 안 읽는다
   ④ 10분에 한 번, 다른 앱 알림(window.__puQuotaToldAt)과도 한 번만
   ⑤ 알림에 열쇠 이름·크기만 — 값(자료)은 안 보인다
   ⑥ 통합 프로그램 앱이 이 감시를 싣는다(경력관리는 다른 방 몫이라 뺀다) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const G = require('../js/pu-ls-guard.js');

function fakeWin(cap) {
  class Storage {
    constructor() { this._m = {}; }
    get length() { return Object.keys(this._m).length; }
    key(i) { return Object.keys(this._m)[i] || null; }
    getItem(k) { return k in this._m ? this._m[k] : null; }
    setItem(k, v) {
      const old = k in this._m ? this._m[k] : null; this._m[k] = String(v);
      const size = Object.keys(this._m).reduce((a, x) => a + x.length + this._m[x].length, 0);
      if (size > cap) { if (old === null) delete this._m[k]; else this._m[k] = old; const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    }
    removeItem(k) { delete this._m[k]; }
  }
  const timers = [];
  const body = { kids: [], appendChild(n) { this.kids.push(n); n.parentNode = this; }, removeChild(n) { this.kids = this.kids.filter((x) => x !== n); n.parentNode = null; } };
  const document = {
    title: '푸른 기금관리', body,
    getElementById: (id) => body.kids.find((n) => n.id === id) || null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild(c) { this.child = c; }, textContent: '' }),
  };
  const w = { Storage, document, setTimeout: (f) => { timers.push(f); return timers.length; }, console: { warn() {} } };
  w.window = w;
  w.localStorage = new Storage();
  w.sessionStorage = new Storage();
  /* 지금 걸려 있는 시계만 돌린다 — 알림이 스스로 닫히는 15초 시계까지 돌리면 알림이 없는 것처럼 보인다 */
  w.run = () => { timers.splice(0).forEach((f) => f()); };
  return w;
}

test('① 쓰기는 예전 그대로 — 실패하면 던진다', () => {
  const w = fakeWin(100);
  G.install(w, { wait: 0 });
  w.localStorage.setItem('a', 'ok');
  assert.equal(w.localStorage.getItem('a'), 'ok');
  assert.throws(() => w.localStorage.setItem('big', 'x'.repeat(500)), /full/, '던지지 않으면 앱의 수습(메모리에 쥐기 등)이 안 돈다');
});

test('② 삼켜도 알린다 — 열쇠 이름·크기만 보이고 값은 안 보인다', () => {
  const w = fakeWin(300);
  G.install(w, { wait: 0 });
  w.localStorage.setItem('pureun_v6_contract_forms', '비밀자료'.repeat(40));
  try { w.localStorage.setItem('cm3_list', 'x'.repeat(500)); } catch (_) {}   // 앱이 조용히 삼켰다
  w.run();
  const box = w.document.getElementById('pu-ls-guard');
  assert.ok(box, '★★ 삼킨 실패를 아무도 모르면 목록이 사라진 줄도 모른다');
  assert.match(box.textContent, /저장하지 못했습니다/);
  assert.match(box.textContent, /이알피 contract_forms/, '무엇이 공간을 먹는지 보여야 사람이 할 일을 안다');
  assert.ok(!/비밀자료/.test(box.textContent), '★ 값(자료)을 화면에 찍으면 안 된다');
  assert.equal(w.PuLsGuard.shownCount(), 1);
});

test('③ 앱이 스스로 수습하면(다시 적기) 안 알린다', () => {
  const w = fakeWin(300);
  G.install(w, { wait: 0 });
  w.localStorage.setItem('p_autobackups', 'b'.repeat(200));
  try { w.localStorage.setItem('p_data', 'x'.repeat(200)); } catch (_) {
    w.localStorage.removeItem('p_autobackups');        // 정부컨설팅: 자동백업을 비우고
    w.localStorage.setItem('p_data', 'x'.repeat(200)); // 다시 적는다
  }
  w.run();
  assert.equal(w.document.getElementById('pu-ls-guard'), null, '수습된 것까지 알리면 잔소리가 된다');
});

test('③ «없어도 되는» 것을 비우고 그만두면 안 알린다', () => {
  const w = fakeWin(100);
  G.install(w, { wait: 0 });
  try { w.localStorage.setItem('p_autobackups', 'x'.repeat(500)); } catch (_) { w.localStorage.removeItem('p_autobackups'); }
  w.run();
  assert.equal(w.document.getElementById('pu-ls-guard'), null);
});

test('③ 공간 재기용 시험 쓰기(probe)는 알리지 않는다', () => {
  const w = fakeWin(100);
  G.install(w, { wait: 0 });
  try { w.localStorage.setItem('pu_storage_headroom_probe', 'x'.repeat(500)); } catch (_) {}
  w.run();
  assert.equal(w.document.getElementById('pu-ls-guard'), null);
});

test('④ 10분에 한 번 · 다른 앱이 막 알렸으면 조용히', () => {
  const w = fakeWin(100);
  G.install(w, { wait: 0 });
  for (let i = 0; i < 3; i++) { try { w.localStorage.setItem('k' + i, 'x'.repeat(500)); } catch (_) {} w.run(); }
  assert.equal(w.PuLsGuard.shownCount(), 1, '저장마다 띄우면 화면 아래가 깜빡이고 아무도 안 읽는다');
  const w2 = fakeWin(100);
  G.install(w2, { wait: 0 });
  w2.__puQuotaToldAt = Date.now();                  // 이알피 erpQuotaNotice 가 방금 알렸다
  try { w2.localStorage.setItem('k', 'x'.repeat(500)); } catch (_) {}
  w2.run();
  assert.equal(w2.PuLsGuard.shownCount(), 0, '같은 일을 두 번 알리면 안 된다');
});

test('sessionStorage 실패는 이 감시의 일이 아니다', () => {
  const w = fakeWin(100);
  G.install(w, { wait: 0 });
  try { w.sessionStorage.setItem('s', 'x'.repeat(500)); } catch (_) {}
  w.run();
  assert.equal(w.PuLsGuard.shownCount(), 0);
});

test('이알피 알림이 같은 시각을 적는다 — 두 번 알리지 않게', () => {
  const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
  const at = erp.indexOf('function erpQuotaNotice(');
  assert.ok(at > 0);
  assert.match(erp.slice(at, at + 900), /window\.__puQuotaToldAt = now/);
  const gov = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
  const g = gov.indexOf('function lsSet(');
  assert.match(gov.slice(g, g + 2500), /__puQuotaToldAt/);
});

test('⑥ 통합 프로그램 앱이 이 감시를 싣는다 (경력관리 제외)', () => {
  const root = path.join(__dirname, '..');
  const apps = fs.readdirSync(root).filter((f) => f.endsWith('.html'))
    .filter((f) => /js\/pu-ontology-write\.js/.test(fs.readFileSync(path.join(root, f), 'utf8')))
    .filter((f) => f !== 'kcareer.html');
  assert.ok(apps.length >= 10, '앱을 ' + apps.length + '개만 찾았습니다 — 찾는 규칙이 어긋났습니다');
  const missing = apps.filter((f) => !/<script src="js\/pu-ls-guard\.js\?v=\d+"><\/script>/.test(fs.readFileSync(path.join(root, f), 'utf8')));
  assert.deepEqual(missing, [], '이 앱들은 저장 실패를 삼키면 아무도 모릅니다 — js/pu-ls-guard.js 를 실으세요');
});

/* ── «지우지 말라» (대표 지시 2026-10-07 「지우지 말라 … 안지워도 되게」) ── */
test('★ 켤 때 크롬에 «이 사이트 자료는 지우지 말라»를 청한다 — 이미 허락됐으면 다시 안 청한다', async () => {
  const w = fakeWin(1000);
  let asked = 0;
  w.navigator = { storage: { persisted: async () => false, persist: async () => { asked++; return true; },
    estimate: async () => ({ usage: 5e8, quota: 1e10 }) } };
  const g = G.install(w, { wait: 0 });
  assert.equal(await g.persisting, true);
  assert.equal(asked, 1, '청하지 않으면 디스크가 모자랄 때 크롬이 이 사이트 자료를 스스로 비울 수 있습니다');
  const info = await g.storageInfo();
  assert.equal(info.quota, 1e10); assert.equal(info.usage, 5e8);
  assert.equal(typeof info.lsChars, 'number');

  const w2 = fakeWin(1000);
  let asked2 = 0;
  w2.navigator = { storage: { persisted: async () => true, persist: async () => { asked2++; return true; } } };
  const g2 = G.install(w2, { wait: 0 });
  assert.equal(await g2.persisting, true);
  assert.equal(asked2, 0);
});

test('«지우지 말라»를 모르는 브라우저에서도 멈추지 않는다', async () => {
  const w = fakeWin(1000);
  w.navigator = {};
  const g = G.install(w, { wait: 0 });
  assert.equal(await g.persisting, null);
  const info = await g.storageInfo();
  assert.equal(info.quota, null);
});
