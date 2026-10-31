/* 리멤버 확장 자동 갱신 (대표 「자동갱신」 2026-10-31) — 안전장치가 «실제로» 막는지 본다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const EXT = path.join(__dirname, '..', 'tools', 'remember-ext');
const read = (f) => fs.readFileSync(path.join(EXT, f));
const sync = require(path.join(EXT, 'sync-ext.js'));

function good() {
  const o = {};
  sync.FILES.forEach((f) => { o[f] = read(f); });
  return o;
}
const manifestWith = (patch) => Buffer.from(JSON.stringify(Object.assign(JSON.parse(read('manifest.json').toString('utf8')), patch)));

test('저장소의 지금 확장 파일은 안전 검사를 통과한다', () => {
  assert.strictEqual(sync.judge(good(), read('manifest.json').toString('utf8')).ok, true);
});

test('하나라도 비었거나 못 받았으면 멈춘다(반쪽 판 금지)', () => {
  const f = good(); f['hook.js'] = Buffer.alloc(0);
  assert.strictEqual(sync.judge(f, null).ok, false);
  const g = good(); delete g['bg.js'];
  assert.strictEqual(sync.judge(g, null).ok, false);
});

test('문법이 틀린 코드는 멈춘다', () => {
  const f = good(); f['bg.js'] = Buffer.from('function ( {');
  const r = sync.judge(f, null);
  assert.strictEqual(r.ok, false);
  assert.match(r.why, /문법/);
});

test('권한이 늘거나 적용 주소가 달라지면 멈춘다 — 사람이 본다', () => {
  const old = read('manifest.json').toString('utf8');
  const more = good(); more['manifest.json'] = manifestWith({ permissions: ['alarms', 'tabs', 'cookies'] });
  assert.strictEqual(sync.judge(more, old).ok, false);
  const host = good(); host['manifest.json'] = manifestWith({ host_permissions: ['https://*/*'] });
  assert.strictEqual(sync.judge(host, old).ok, false);
});

test('권한이 같으면 코드만 바뀌어도 통과한다', () => {
  const f = good(); f['bg.js'] = Buffer.from(read('bg.js').toString('utf8') + '\n/* 고침 */\n');
  assert.strictEqual(sync.judge(f, read('manifest.json').toString('utf8')).ok, true);
});

test('판 표시는 내용이 바뀌면 바뀌고, 같으면 같다', () => {
  const a = sync.verOf(good());
  const f = good(); f['hook.js'] = Buffer.from(read('hook.js').toString('utf8') + ' ');
  assert.notStrictEqual(sync.verOf(f), a);
  assert.strictEqual(sync.verOf(good()), a);
});

test('bg.js 는 ver.js 를 읽고 돌기 전에 디스크 판과 견준다', () => {
  const bg = read('bg.js').toString('utf8');
  assert.match(bg, /importScripts\('ver\.js'\)/);
  assert.match(read('ver.js').toString('utf8'), /DISK_VER\s*=\s*'[^']*'/);
  const run = bg.slice(bg.indexOf('async function run()'));
  assert.ok(run.indexOf('selfUpdate()') > -1 && run.indexOf('selfUpdate()') < run.indexOf('findOrOpen('), '갱신 확인이 일보다 앞이어야 합니다');
});

test('갱신기는 ver.js 를 «맨 마지막에» 쓴다', () => {
  const src = read('sync-ext.js').toString('utf8');
  const other = src.search(/const tmp = path\.join\(DIR, f \+ '\.new'\)/);
  assert.ok(other > -1 && src.lastIndexOf("'ver.js'") > other, 'ver.js 쓰기가 다른 파일 쓰기보다 뒤여야 합니다');
});
