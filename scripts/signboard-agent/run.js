'use strict';
/* run.js — 심부름꾼의 «한 바퀴» (설계서 §6.3·§8)
   새 판이 있으면: 파일 받기 → (실전) 장비에 파일 올리기 → 프로그램 전체 교체 → 결과를 signboard/state 에 기록.
   ⚠ 시험 모드(dryRun)는 장비에 «한 번도» 연결하지 않는다 — 보낼 내용만 outbox 에 적는다.
   ⚠ 실전의 첫 전체 교체는 대표가 포털에서 «지워도 된다»를 누른 뒤에만(control.firstReplaceConfirmed) — 장비에 이미 있는 광고가 지워진다.
   ⚠ 광고가 0건인 판은 보내지 않는다 — 전광판을 통째로 비우는 사고를 막는다. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Core = require('../../js/pu-signboard-core.js');
const Program = require('./program.js');
const { analyzeClock, clockWarning } = require('./clock.js');
const { scrub } = require('./config.js');

const MAX_ATTEMPTS = 3;
const HEARTBEAT_MS = 5 * 60 * 1000;
const MAX_DOWNLOAD = 200 * 1024 * 1024;

function md5hex(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
function extOf(name) { const m = /\.[A-Za-z0-9]{1,5}$/.exec(String(name || '')); return m ? m[0] : ''; }
function deviceInfo(props) {
  return { name: props.name || '', width: Number(props['screen.width']) || 0, height: Number(props['screen.height']) || 0, time: props.time || '',
    timeZone: props['time.timeZone'] || '', luminance: props.luminance || '', fwVersion: props['version.app'] || '' };
}

/* 상태를 쓰는 «한 길» — 쓸 때마다 마지막 기록 시각을 갱신한다(5분 심장박동이 이것을 본다) */
async function put(ctx, state) {
  await ctx.store.writeState(state);
  ctx.local.heartbeatAt = ctx.now();
}

async function heartbeat(ctx, base, extra) {
  const t = ctx.now();
  if (t - ctx.local.heartbeatAt < HEARTBEAT_MS) return false;
  const st = Object.assign({}, base, extra);
  if (!ctx.dryRun) {
    try {
      const props = await ctx.makeDevice().getDeviceProperty();
      st.deviceReachable = true; st.deviceError = ''; st.device = deviceInfo(props);
      st.clock = analyzeClock(props, t); st.clockWarning = clockWarning(st.clock);
    } catch (e) { st.deviceReachable = false; st.deviceError = scrub(e.message, ctx.config); }
  }
  await put(ctx, st);
  return true;
}

async function runOnce(ctx) {
  const t = ctx.now(), local = ctx.local;
  const base = { agentSeenAt: t, mode: ctx.dryRun ? 'dry-run' : 'live' };
  const version = await ctx.store.readVersion();
  if (version == null) { await heartbeat(ctx, base, { message: '올린 판이 아직 없습니다' }); return { action: 'no-published' }; }
  ctx.stage.version = version;

  const done = ctx.dryRun ? local.lastDryVersion === version : local.lastSentVersion === version;
  if (done) { await heartbeat(ctx, base, {}); return { action: 'idle', version: version }; }
  if ((local.failures[version] || 0) >= MAX_ATTEMPTS) return { action: 'gave-up', version: version };

  /* 첫 전송 확인을 기다리는 중이면 «확인이 났는지»만 본다 — 장비를 매분 두드리지 않는다 */
  if (!ctx.dryRun && local.waitingVersion === version && (await ctx.store.readControl()).firstReplaceConfirmed !== true) {
    await heartbeat(ctx, base, { message: '첫 전송 확인을 기다립니다' });
    return { action: 'waiting', version: version };
  }

  const published = await ctx.store.readPublished();
  const ads = Core.toArr(published && published.ads).map(Core.snapshotAd);
  if (!ads.length) {
    await put(ctx, Object.assign({}, base, { result: 'skip', message: '올린 판(' + version + '번)에 광고가 0건이라 보내지 않았습니다 — 전광판을 비우지 않습니다', sentVersion: local.lastSentVersion || 0 }));
    if (ctx.dryRun) local.lastDryVersion = version; else local.lastSentVersion = version;
    return { action: 'skip-empty', version: version };
  }

  /* 사진·동영상 받기 — 우리 창고 주소만, 기록된 크기와 같아야 한다 */
  const files = {};
  for (const n of Program.mediaNeeds(ads)) {
    if (!Core.isMediaUrl(n.url)) throw new Error('허용되지 않은 파일 주소입니다 (' + n.adId + ')');
    if (!(n.size > 0) || n.size > MAX_DOWNLOAD) throw new Error('파일 크기가 올바르지 않습니다 (' + n.adId + ')');
    const buf = await ctx.download(n.url);
    if (buf.length !== n.size) throw new Error('받은 파일 크기가 기록과 다릅니다 (' + n.adId + ': 기록 ' + n.size + ' · 받음 ' + buf.length + ')');
    files[n.adId] = { buf: buf, md5: md5hex(buf), name: n.adId + '_' + n.size + extOf(n.name) };
  }

  if (ctx.dryRun) {
    const uploaded = {};
    Object.keys(files).forEach(function (id) { uploaded[id] = { file: '(장비에 올린 뒤 받는 이름)', md5: files[id].md5, size: files[id].buf.length }; });
    const body = Program.buildReplaceBody(ads, null, (ctx.config && ctx.config.deviceId) || 'DEVICE-ID', uploaded);
    const out = path.join(ctx.dir, 'outbox');
    fs.mkdirSync(out, { recursive: true });
    const file = path.join(out, 'v' + version + '.json');
    fs.writeFileSync(file, JSON.stringify(body, null, 2));
    local.lastDryVersion = version;
    await put(ctx, Object.assign({}, base, { result: 'dry-run', message: '시험 모드 — 보낼 내용을 outbox/v' + version + '.json 에 적었습니다 (장비에는 연결하지 않았습니다)', dryRunVersion: version, dryRunAt: t, screenAssumed: true }));
    return { action: 'dry-run', version: version, file: file };
  }

  const dev = ctx.makeDevice();
  const props = await dev.getDeviceProperty();
  const screen = { width: Number(props['screen.width']), height: Number(props['screen.height']) };
  if (!(screen.width > 0 && screen.height > 0)) throw new Error('장비 화면 크기를 읽지 못했습니다');
  const info = deviceInfo(props), clock = analyzeClock(props, t), warn = clockWarning(clock);

  if ((await ctx.store.readControl()).firstReplaceConfirmed !== true) {
    const existing = await dev.getAllPrograms();
    local.waitingVersion = version;
    await put(ctx, Object.assign({}, base, { result: 'wait-confirm', pendingVersion: version, existingPrograms: existing, device: info, clock: clock, clockWarning: warn, deviceReachable: true,
      message: '첫 전송 전 확인이 필요합니다 — 장비에 이미 있는 광고 ' + existing.length + '건이 지워집니다' }));
    return { action: 'wait-confirm', version: version, existing: existing };
  }

  const uploaded = {};
  for (const id of Object.keys(files)) {
    const r = await dev.uploadFile(files[id].buf, files[id].name);
    if (r.md5 && r.md5 !== files[id].md5) throw new Error('장비가 받은 파일이 보낸 것과 다릅니다 (' + id + ')');
    uploaded[id] = { file: r.file, md5: files[id].md5, size: r.size };
  }
  await dev.replace(Program.buildReplaceBody(ads, screen, ctx.config.deviceId, uploaded));
  local.lastSentVersion = version; local.waitingVersion = 0; delete local.failures[version];
  await put(ctx, Object.assign({}, base, { result: 'ok', message: '', sentVersion: version, sentAt: t, adCount: ads.length, device: info, clock: clock, clockWarning: warn, deviceReachable: true, deviceError: '', screenAssumed: false }));
  return { action: 'sent', version: version, count: ads.length };
}

/* 오류를 먹지 않는다 — 기록하고(열쇠는 지운 글로), 같은 판은 3번까지만 다시 해 본다 */
async function runRound(ctx) {
  ctx.stage = { version: null };
  try { return await runOnce(ctx); }
  catch (e) {
    const msg = scrub(String((e && e.message) || e), ctx.config);
    ctx.log('오류: ' + msg);
    const v = ctx.stage.version, local = ctx.local;
    if (v != null) local.failures[v] = (local.failures[v] || 0) + 1;
    try {
      await put(ctx, { agentSeenAt: ctx.now(), mode: ctx.dryRun ? 'dry-run' : 'live', result: 'fail', message: msg, failVersion: v == null ? 0 : v, attempts: v == null ? 0 : local.failures[v] });
    } catch (e2) { ctx.log('상태를 기록하지 못했습니다: ' + scrub(String((e2 && e2.message) || e2), ctx.config)); }
    return { action: 'error', message: msg, version: v };
  }
}

module.exports = { runOnce, runRound, MAX_ATTEMPTS, HEARTBEAT_MS, md5hex, deviceInfo };
