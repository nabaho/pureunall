'use strict';
/* run.js — 카톡 심부름꾼의 «한 바퀴» (설계서 §7)
   settle/kakaoQueue 의 대기(pending) 줄을 오래된 것부터 가져와:
     ① 보내기 전 확인 — 방 이름이 settle/rooms 에 등록된 그 사람 방과 똑같고 · 줄을 만든 사람이 관리자(재직)이고 · 그 정산표가 확정(confirmed)일 것.
        하나라도 어긋나면 보내지 않고 failed(다시 해 보지 않는다).
     ② 시험 모드(dryRun) — PC 카톡을 «한 번도» 부르지 않는다. 보낼 글을 outbox/<줄>.txt 에 적고 그 줄에 «시험 모드» 표시만 남긴다(상태는 pending 그대로).
     ③ 실전 — PC 카톡에 넣는다(redirectRoom 이 있으면 그 방으로만). 성공하면 sent.
        카톡이 꺼짐·화면 잠김은 «기다림»(pending 그대로, 이번 바퀴 멈춤), 방을 못 찾음·제목 다름은 곧바로 failed, 그 밖의 실패는 3번까지 다시 해 본다.
   결과(마지막 응답·모드·건수)는 settle/agent 에 적는다 — 할 일이 없으면 5분에 한 번만. */
const fs = require('node:fs');
const path = require('node:path');

const MAX_TRIES = 3;
const HEARTBEAT_MS = 5 * 60 * 1000;
const FATAL = ['room-not-found', 'title-mismatch', 'no-input', 'bad-job'];
const WAIT = ['not-running', 'no-search'];

function norm(s) { return String(s == null ? '' : s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }

async function putAgent(ctx, obj) {
  await ctx.store.writeAgent(obj);
  ctx.local.heartbeatAt = ctx.now();
}

function adminSids(roles) {
  const out = {};
  Object.keys(roles || {}).forEach(function (k) {
    const r = roles[k];
    if (r && r.sid && r.isAdmin === true && r.status === 'active') out[String(r.sid)] = 1;
  });
  return out;
}

/* 보내기 전 확인 — 이유 글(빈 글이면 통과) */
async function whyNot(ctx, it, rooms, admins) {
  const reg = rooms[it.sid];
  if (!reg || !norm(reg.room)) return '받는 사람의 카톡 방 이름이 등록되어 있지 않습니다';
  if (norm(reg.room) !== norm(it.room)) return '방 이름이 등록된 것과 다릅니다';
  if (!admins[String(it.createdBy || '')]) return '대기열을 만든 사람이 관리자가 아닙니다';
  if (!norm(it.text)) return '보낼 글이 비었습니다';
  if ((await ctx.store.readRunStatus(it.runId)) !== 'confirmed') return '확정된 정산표가 아닙니다';
  return '';
}

async function runOnce(ctx) {
  const t = ctx.now(), mode = ctx.dryRun ? 'dry-run' : 'live', local = ctx.local;
  const base = { agentSeenAt: t, mode: mode, redirect: ctx.dryRun ? '' : (ctx.config.redirectRoom || '') };
  const q = await ctx.store.readQueue();
  const pending = Object.keys(q || {}).map(function (k) { return q[k]; })
    .filter(function (x) { return x && x.id && x.status === 'pending' && !x._deleted; })
    .sort(function (a, b) { return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0); });
  const todo = ctx.dryRun ? pending.filter(function (x) { return !local.dryDone[x.id]; }) : pending;
  if (!todo.length) {
    if (!local.heartbeatAt || t - local.heartbeatAt >= HEARTBEAT_MS) await putAgent(ctx, Object.assign({}, base, { result: 'idle', message: '보낼 것이 없습니다', pending: pending.length }));
    return { action: 'idle' };
  }
  const rooms = (await ctx.store.readRooms()) || {}, admins = adminSids(await ctx.store.readRoles());
  const n = { sent: 0, failed: 0, waiting: 0, dry: 0 };
  let stop = '';
  for (const it of todo.slice(0, ctx.config.maxPerRound)) {
    const why = await whyNot(ctx, it, rooms, admins);
    if (why) {
      await ctx.store.updateItem(it.id, { status: 'failed', error: why, failedAt: ctx.now() });
      n.failed++; ctx.log('보내지 않음(' + it.id + '): ' + why);
      continue;
    }
    if (ctx.dryRun) {
      const out = path.join(ctx.dir, 'outbox');
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, it.id + '.txt'), '방: ' + it.room + '\n\n' + it.text + '\n', 'utf8');
      local.dryDone[it.id] = t;
      await ctx.store.updateItem(it.id, { dryRunAt: t, note: '시험 모드 — PC 카톡에 넣지 않고 심부름꾼 PC 의 outbox 에만 적었습니다' });
      n.dry++;
      continue;
    }
    const target = ctx.config.redirectRoom || it.room;
    const r = (await ctx.kakao.send(target, it.text)) || {};
    if (r.ok) {
      await ctx.store.updateItem(it.id, { status: 'sent', sentAt: ctx.now(), tries: (Number(it.tries) || 0) + 1, error: '', redirect: ctx.config.redirectRoom ? target : '' });
      n.sent++; ctx.log('보냄(' + it.id + ')' + (ctx.config.redirectRoom ? ' — 시험 방으로' : ''));
      continue;
    }
    const msg = String(r.error || r.code || '알 수 없는 오류').slice(0, 300);
    if (WAIT.indexOf(r.code) >= 0 || r.locked) {
      stop = r.code === 'not-running' ? 'PC 카톡이 꺼져 있거나 로그인되지 않았습니다' : r.locked ? '화면이 잠겨 있습니다' : '카톡 메인 창을 찾지 못했습니다(로그인 확인)';
      await ctx.store.updateItem(it.id, { note: stop, checkedAt: ctx.now() });
      n.waiting++;
      break;
    }
    const tries = (Number(it.tries) || 0) + 1, last = FATAL.indexOf(r.code) >= 0 || tries >= MAX_TRIES;
    await ctx.store.updateItem(it.id, last ? { status: 'failed', tries: tries, error: msg, failedAt: ctx.now() } : { tries: tries, error: msg });
    if (last) n.failed++; else n.waiting++;
    ctx.log('보내지 못함(' + it.id + ', ' + (r.code || '') + '): ' + msg);
  }
  await putAgent(ctx, Object.assign({}, base, { result: stop ? 'waiting' : 'round', message: stop || ('보냄 ' + n.sent + ' · 실패 ' + n.failed + ' · 기다림 ' + n.waiting + ' · 시험 ' + n.dry),
    sent: n.sent, failed: n.failed, waiting: n.waiting, dry: n.dry, pending: pending.length }));
  return Object.assign({ action: 'round' }, n);
}

/* 오류를 먹지 않는다 — 기록하고 다음 바퀴에 다시 */
async function runRound(ctx) {
  try { return await runOnce(ctx); }
  catch (e) {
    const msg = String((e && e.message) || e).slice(0, 300);
    ctx.log('오류: ' + msg);
    try { await putAgent(ctx, { agentSeenAt: ctx.now(), mode: ctx.dryRun ? 'dry-run' : 'live', result: 'fail', message: msg }); }
    catch (e2) { ctx.log('상태를 기록하지 못했습니다: ' + String((e2 && e2.message) || e2)); }
    return { action: 'error', message: msg };
  }
}

module.exports = { runOnce, runRound, norm, adminSids, MAX_TRIES, HEARTBEAT_MS, FATAL, WAIT };
