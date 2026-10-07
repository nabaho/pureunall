/* 정부컨설팅 「저장 공간이 부족합니다」 경고 (2026-10-07)
   실측: nabaho.github.io 저장 공간 10MB 꽉 참 — 이 앱 몫은 0.2MB 뿐, 나머지는 다른 앱.
   ★ 규칙 — 이 PC 자동백업은 «없어도 되는 사본»이다.
     · 자동백업을 쓰다 자리가 없으면 «조용히» 실패한다(부른 쪽이 줄여 다시 시도).
     · 진짜 자료를 못 쓰면 자동백업을 먼저 비워 자리를 만든다.
     · 그래도 안 되면 알리되 한 번만. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const S = bare(SRC);

// 글자 수 한도가 있는 가짜 저장소
function fakeLS(limit, init) {
  const m = new Map(Object.entries(init || {}));
  const used = () => [...m].reduce((s, [k, v]) => s + k.length + v.length, 0);
  const ls = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const old = m.has(k) ? k.length + m.get(k).length : 0;
      if (used() - old + k.length + String(v).length > limit) {
        const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
      }
      m.set(k, String(v));
    },
    removeItem: (k) => { m.delete(k); },
  };
  return { ls, m };
}

function load(ls) {
  const a = SRC.indexOf('const LS_VALID_KEYS');
  const b = SRC.indexOf('function simpleHash');
  assert.ok(a > 0 && b > a, 'localStorage 래퍼 구간을 못 찾았다');
  const toasts = [];
  const ctx = { console: { warn() {}, log() {} }, toast: (m) => toasts.push(m) };
  ctx.localStorage = new Proxy(ls, { ownKeys: () => [], getOwnPropertyDescriptor: () => undefined });
  ctx.Object = { keys: (o) => (o === ctx.localStorage ? [] : Object.keys(o)) };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(a, b) + ';this.lsSet=lsSet;', ctx);
  return { lsSet: ctx.lsSet, toasts };
}

test('자동백업이 자리를 못 찾으면 조용히 실패한다 — 경고를 띄우지 않는다', () => {
  const { ls } = fakeLS(100, { other: 'x'.repeat(90) });
  const { lsSet, toasts } = load(ls);
  assert.strictEqual(lsSet('p_autobackups', 'y'.repeat(50), { quiet: true }), false);
  assert.strictEqual(toasts.length, 0);
});

test('진짜 자료가 막히면 이 PC 자동백업을 비워 자리를 만들고 저장한다', () => {
  const { ls, m } = fakeLS(100, { other: 'x'.repeat(40), p_autobackups: 'b'.repeat(40) });
  const { lsSet, toasts } = load(ls);
  assert.strictEqual(lsSet('p_scheds', 's'.repeat(30)), true);
  assert.ok(!m.has('p_autobackups'), '자동백업이 비워지지 않았다');
  assert.strictEqual(m.get('p_scheds').length, 30);
  assert.strictEqual(toasts.length, 0);
});

test('그래도 안 되면 경고는 한 번만 뜬다', () => {
  const { ls } = fakeLS(100, { other: 'x'.repeat(95) });
  const { lsSet, toasts } = load(ls);
  assert.strictEqual(lsSet('p_scheds', 's'.repeat(30)), false);
  assert.strictEqual(lsSet('p_cos', 'c'.repeat(30)), false);
  assert.strictEqual(toasts.length, 1);
});

test('자동백업 저장은 quiet 로 부른다', () => {
  assert.match(S, /lsSet\(AUTOBK_KEY,[^;]*\{quiet:true\}\)\)return true/);
});
