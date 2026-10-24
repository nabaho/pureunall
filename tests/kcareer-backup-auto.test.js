'use strict';
/* 백업 재촉 — 클라우드가 매일 저절로 백업하고 있으면 띠를 띄우지 않는다 (대표 지시 2026-10-24 「자동으로 백업하게 해라 · 폰에서도」)
   규칙: 클라우드 일일 사본이 3일 안이면 숨기고 «자동» 표시를 남긴다 · 못 읽거나 오래됐으면 «예전처럼 띄운다»(197건 사고를 막은 띠) · 로그인 전이면 기다렸다 다시. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 날 = (n) => { const d = new Date(Date.now() - n * 86400000); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };

function 세상(o) {
  o = o || {};
  const 기록 = { last_backup: o.lastBackup || null }; const 알림 = { 띠: 'none', 보임: 0, 설정: [] };
  const 지수 = o.index; /* undefined → 읽기 실패 */
  const ctx = {
    get: (k) => (k === 'last_backup' ? 기록.last_backup : (k === 'cert' ? Array.from({ length: 30 }, (_, i) => ({ id: i })) : [])),
    set: (k, v) => { 알림.설정.push([k, v]); if (k === 'last_backup') 기록.last_backup = v; return true; },
    _safe: (f) => { try { return f(); } catch (e) { return null; } },
    FB_COUNT_KEYS: ['cert'], fbUid: o.noUid ? null : 'U1',
    fbDb: { ref: () => ({ orderByKey: () => ({ limitToLast: () => ({ once: () => (지수 === undefined ? Promise.reject(new Error('denied')) : Promise.resolve({ val: () => 지수 })) }) }) }) },
    document: { getElementById: (id) => (id === 'bkNotice' ? { style: { get display() { return 알림.띠; }, set display(v) { 알림.띠 = v; if (v === 'block') 알림.보임++; } } } : (id === 'bkMsg' ? { textContent: '' } : null)) },
    setTimeout: (f) => { ctx._later = f; return 1; }, Date, Math, JSON, Object, Array, Promise, console
  };
  vm.createContext(ctx);
  vm.runInContext('var _bkWait=false;\n' + 떼기('function kcCloudBackupGate(') + '\n' + 떼기('function checkBackupReminder('), ctx);
  return { ctx, 알림, 기록 };
}
const 기다림 = () => new Promise((r) => setImmediate(r));

test('① 클라우드 일일 사본이 어제 것이면 띠를 안 띄우고 «자동» 표시를 남긴다', async () => {
  const w = 세상({ lastBackup: { d: new Date(Date.now() - 20 * 86400000).toISOString() }, index: { [날(1)]: { createdAt: 1 }, _dailyClaim: {} } });
  w.ctx.checkBackupReminder(); await 기다림(); await 기다림();
  assert.equal(w.알림.보임, 0, '띠가 뜨지 않는다');
  const [k, v] = w.알림.설정.find((x) => x[0] === 'last_backup');
  assert.equal(v.auto, 'cloud'); assert.equal(v.cloudDay, 날(1));
});

test('② 클라우드 사본이 오래됐거나 읽지 못하면 «예전처럼» 띄운다', async () => {
  const 오래 = 세상({ lastBackup: { d: new Date(Date.now() - 20 * 86400000).toISOString() }, index: { [날(9)]: {} } });
  오래.ctx.checkBackupReminder(); await 기다림(); await 기다림();
  assert.equal(오래.알림.보임, 1, '9일 된 사본이면 띠');
  const 못읽음 = 세상({ lastBackup: null, index: undefined });
  못읽음.ctx.checkBackupReminder(); await 기다림(); await 기다림();
  assert.equal(못읽음.알림.보임, 1, '읽기가 막히면 띠(예전 동작)');
});

test('③ 직접 백업이 14일 안이면 아무것도 안 한다 · 로그인 전이면 기다렸다 다시 본다', async () => {
  const 최근 = 세상({ lastBackup: { d: new Date().toISOString() }, index: {} });
  최근.ctx.checkBackupReminder(); await 기다림();
  assert.equal(최근.알림.보임, 0);
  const 전 = 세상({ lastBackup: null, noUid: true, index: { [날(1)]: {} } });
  전.ctx.checkBackupReminder(); await 기다림();
  assert.equal(전.알림.보임, 0, '로그인 전에는 바로 띄우지 않는다');
  assert.ok(typeof 전.ctx._later === 'function', '기다렸다 다시 본다');
  전.ctx.fbUid = 'U1'; 전.ctx._later(); await 기다림(); await 기다림();
  assert.equal(전.알림.보임, 0, '다시 보니 클라우드 사본이 신선해서 계속 숨김');
});

test('④ 옛 약속은 그대로 — 14일 잣대·갓 시작한 사람 빗장·직접 백업 단추', () => {
  const f = strip(떼기('function checkBackupReminder('));
  assert.match(f, /days!=null && days<14/); assert.match(f, /total<20/); assert.match(f, /FB_COUNT_KEYS/); assert.match(f, /days==null/);
  const g = strip(떼기('function kcCloudBackupGate('));
  assert.match(g, /systemBackupsIndex\/kcareer/); assert.match(g, /기준\(3\)/, '3일');
  assert.ok(/\},\s*function\(\)\{\s*보이기\(\);\s*\}\)/.test(g), '읽기 실패는 띠로');
  const skip = SRC.slice(SRC.indexOf('var FB_SKIP='), SRC.indexOf('];', SRC.indexOf('var FB_SKIP=')));
  assert.ok(!/last_backup/.test(skip), 'last_backup 은 기기끼리 오가야 폰에서도 멎는다');
});
