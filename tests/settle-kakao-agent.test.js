/* 카톡 심부름꾼(scripts/kakao-agent) — 한 바퀴(run.js)를 대역 store·kakao 로 돌려 본다 (설계서 2026-10-31-consult-settle-design.md §7·§9)
   ★ 시험 모드는 카톡을 안 부른다 · 방 이름이 다르면 안 보낸다 · 확정 안 된 정산표·관리자 아닌 사람의 줄은 안 보낸다 · 3번 뒤 멈춘다 · 카톡이 꺼져 있으면 기다린다.
   ★ 자료는 지어낸 것이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const R = require('../scripts/kakao-agent/run.js');
const Cfg = require('../scripts/kakao-agent/config.js');
const Store = require('../scripts/kakao-agent/store.js');
const K = require('../scripts/kakao-agent/kakao.js');

const DIR = path.join(__dirname, '..', 'scripts', 'kakao-agent');

function fake(o) {
  o = o || {};
  const queue = o.queue || { K1: { id: 'K1', runId: 'cons-a_2026-10', sid: 'T-A', room: '김가나 노무사', text: '정산 안내', status: 'pending', createdBy: 'T-BOSS', createdAt: 1 } };
  const updates = [], agent = [], sends = [];
  const store = {
    readQueue: async () => queue,
    readRooms: async () => o.rooms || { 'T-A': { id: 'T-A', room: '김가나 노무사' } },
    readRunStatus: async (id) => (o.runStatus || { 'cons-a_2026-10': 'confirmed' })[id] || '',
    readRoles: async () => o.roles || { u1: { sid: 'T-BOSS', isAdmin: true, status: 'active' }, u2: { sid: 'T-FIN', fin: true, status: 'active' } },
    updateItem: async (id, p) => { updates.push([id, p]); Object.assign(queue[id], p); },
    writeAgent: async (p) => { agent.push(p); }
  };
  const results = (o.results || [{ ok: true }]).slice();
  const kakao = { send: async (room, text) => { sends.push([room, text]); return results.length > 1 ? results.shift() : results[0]; } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kakao-agent-test-'));
  const ctx = { store, kakao, dir, dryRun: o.dryRun === true, now: () => 1000, log: () => {}, local: { heartbeatAt: 0, dryDone: {} },
    config: Object.assign({ redirectRoom: '', maxPerRound: 10 }, o.config || {}) };
  return { ctx, updates, agent, sends, queue };
}

test('시험 모드 — PC 카톡을 한 번도 부르지 않고 outbox 에 적고, 같은 줄은 다시 적지 않는다', async () => {
  const f = fake({ dryRun: true });
  const r = await R.runRound(f.ctx);
  assert.equal(r.dry, 1);
  assert.equal(f.sends.length, 0, '시험 모드가 카톡을 불렀다');
  assert.equal(f.queue.K1.status, 'pending');
  assert.ok(f.queue.K1.dryRunAt);
  assert.match(fs.readFileSync(path.join(f.ctx.dir, 'outbox', 'K1.txt'), 'utf8'), /정산 안내/);
  assert.equal((await R.runRound(f.ctx)).action, 'idle', '같은 줄을 또 적었다');
  assert.equal(f.agent[0].mode, 'dry-run');
});

test('실전 — 확인을 다 통과하면 보내고 sent, 방 이름의 특수 공백은 보통 공백으로 본다', async () => {
  const f = fake();
  const r = await R.runRound(f.ctx);
  assert.equal(r.sent, 1);
  assert.deepEqual(f.sends, [['김가나 노무사', '정산 안내']]);
  assert.equal(f.queue.K1.status, 'sent');
  assert.equal(f.queue.K1.redirect, '');
});

test('시험 방(redirectRoom) — 모든 글을 그 방으로만 보내고 기록에 남긴다', async () => {
  const f = fake({ config: { redirectRoom: '나의 채팅' } });
  await R.runRound(f.ctx);
  assert.deepEqual(f.sends.map((s) => s[0]), ['나의 채팅']);
  assert.equal(f.queue.K1.redirect, '나의 채팅');
});

test('보내기 전 확인 — 방 이름이 다르거나 · 관리자가 만든 줄이 아니거나 · 확정 안 된 정산표면 보내지 않고 실패', async () => {
  const a = fake({ rooms: { 'T-A': { room: '다른 방' } } });
  await R.runRound(a.ctx);
  assert.equal(a.sends.length, 0); assert.equal(a.queue.K1.status, 'failed'); assert.match(a.queue.K1.error, /방 이름/);
  const b = fake({ queue: { K1: { id: 'K1', runId: 'cons-a_2026-10', sid: 'T-A', room: '김가나 노무사', text: 'x', status: 'pending', createdBy: 'T-FIN' } } });
  await R.runRound(b.ctx);
  assert.equal(b.sends.length, 0); assert.match(b.queue.K1.error, /관리자/);
  const c = fake({ runStatus: { 'cons-a_2026-10': 'draft' } });
  await R.runRound(c.ctx);
  assert.equal(c.sends.length, 0); assert.match(c.queue.K1.error, /확정/);
  const d = fake({ rooms: {} });
  await R.runRound(d.ctx);
  assert.equal(d.sends.length, 0); assert.match(d.queue.K1.error, /등록/);
});

test('카톡이 꺼져 있거나 화면이 잠겼으면 실패로 치지 않고 기다린다(이번 바퀴 멈춤)', async () => {
  const f = fake({ results: [{ ok: false, code: 'not-running' }] });
  await R.runRound(f.ctx);
  assert.equal(f.queue.K1.status, 'pending');
  assert.equal(f.queue.K1.tries, undefined);
  assert.match(f.agent[0].message, /꺼져/);
  const g = fake({ results: [{ ok: false, code: 'not-set', locked: true }] });
  await R.runRound(g.ctx);
  assert.equal(g.queue.K1.status, 'pending');
  assert.match(g.agent[0].message, /잠겨/);
});

test('방을 못 찾거나 창 제목이 다르면 곧바로 실패, 그 밖의 실패는 3번째에 멈춘다', async () => {
  const f = fake({ results: [{ ok: false, code: 'title-mismatch', error: 'x' }] });
  await R.runRound(f.ctx);
  assert.equal(f.queue.K1.status, 'failed');
  const g = fake({ results: [{ ok: false, code: 'not-cleared', error: 'Enter' }] });
  await R.runRound(g.ctx); assert.equal(g.queue.K1.status, 'pending'); assert.equal(g.queue.K1.tries, 1);
  await R.runRound(g.ctx); assert.equal(g.queue.K1.tries, 2);
  await R.runRound(g.ctx); assert.equal(g.queue.K1.status, 'failed'); assert.equal(g.queue.K1.tries, R.MAX_TRIES);
  await R.runRound(g.ctx); assert.equal(g.sends.length, 3, '3번 뒤에도 또 보냈다');
});

test('할 일이 없으면 5분에 한 번만 응답을 적는다', async () => {
  const f = fake({ queue: {} });
  await R.runRound(f.ctx); assert.equal(f.agent.length, 1);
  await R.runRound(f.ctx); assert.equal(f.agent.length, 1);
});

test('설정 — 기본은 시험 모드, redirectRoom 은 다듬고, 읽을 수 없으면 오류', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kakao-cfg-'));
  assert.ok(Cfg.loadConfig(dir).errors.length);
  fs.writeFileSync(path.join(dir, 'config.json'), '﻿{"redirectRoom":"  나의 채팅 ","pollSec":5}');
  const c = Cfg.loadConfig(dir).config;
  assert.equal(c.liveEnabled, false);
  assert.equal(c.redirectRoom, '나의 채팅');
  assert.equal(c.pollSec, 20);
  assert.equal(JSON.parse(fs.readFileSync(path.join(DIR, 'config.example.json'), 'utf8')).liveEnabled, false);
});

test('store — 쓰는 곳은 대기열 «그 줄»과 settle/agent 둘뿐, 줄 번호는 검사한다', () => {
  const calls = [];
  const s = Store.createStore({ exec: (a) => { calls.push(a); return 'null'; } });
  s.updateItem('Kabc', { status: 'sent' });
  s.writeAgent({ mode: 'dry-run' });
  assert.throws(() => s.updateItem('../rules', {}));
  const writes = calls.filter((a) => a[0] !== 'database:get').map((a) => a[0] + ' ' + a[1]);
  assert.deepEqual(writes, ['database:update /settle/kakaoQueue/Kabc', 'database:update /settle/agent']);
  const src = fs.readFileSync(path.join(DIR, 'store.js'), 'utf8');
  assert.deepEqual([...new Set([...src.matchAll(/'database:(\w+)'/g)].map((m) => m[1]))].sort(), ['get', 'update']);
});

test('kakao — 결과 JSON 마지막 줄을 읽고, 방 이름·글은 명령줄이 아니라 작업 파일로 넘긴다', () => {
  const seen = [];
  const k = K.createKakao({ exec: (args) => { seen.push(args); const i = args.indexOf('-JobFile'); if (i >= 0) seen.job = JSON.parse(fs.readFileSync(args[i + 1], 'utf8')); return 'noise\n{"ok":true}\n'; } });
  assert.deepEqual(k.send('김가나 노무사', '안녕'), { ok: true });
  assert.deepEqual(seen.job, { room: '김가나 노무사', text: '안녕' });
  assert.ok(!seen[0].some((a) => /김가나|안녕/.test(a)), '명령줄에 한글이 들어갔다');
  assert.equal(K.lastJson('').code, 'no-output');
});

test('PowerShell 파일은 ASCII 만, 창 메시지만 쓰고 마우스·키보드·클립보드를 쓰지 않는다', () => {
  ['send.ps1', 'install-task.ps1'].forEach((f) => {
    const s = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.ok(/^[\x00-\x7F]*$/.test(s), f + ' 에 ASCII 아닌 글자가 있다');
  });
  const ps = fs.readFileSync(path.join(DIR, 'send.ps1'), 'utf8');
  assert.doesNotMatch(ps, /SendKeys|keybd_event|mouse_event|SendInput|Set-Clipboard|Clipboard\]/);
  assert.match(ps, /-ceq \$room/, '창 제목을 방 이름과 «똑같이» 견주지 않는다');
  assert.match(ps, /input-busy/, '쓰던 글이 있는 입력칸을 건드린다');
});
