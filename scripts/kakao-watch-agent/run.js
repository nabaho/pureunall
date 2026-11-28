'use strict';
/* run.js — PC 화면·하단알림 자동 캡처 수집기의 «한 바퀴»
   1) capture.ps1(읽기 전용 OS 캡처 + 오프라인 WinRT 한국어 OCR)로 화면 변화 영역의 텍스트를 얻는다.
   2) PuKakaoRoomCore.parseOcrChatLines로 등록된 법인 방 / 하단 알림만 구조화한다(미등록 개인방 즉시 차단).
   3) PuKakaoRoomCore.analyzeMessages(5중 안전판별: OTP 차단·잡담 제외·주민번호/카드/계좌/비번 3중 가림) 실행.
   4) 시험 모드(dryRun)면 outbox/<id>.json 에 기록, 실전 모드면 /kakao_room/items/{id}에 저장(_deleted 부활 차단). */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_JS = path.resolve(__dirname, '..', '..', 'js');
require(path.join(REPO_JS, 'pu-rrn-mask.js'));
const RM = (typeof globalThis !== 'undefined' && globalThis.PuRrnMask) || null;
const KW = require(path.join(REPO_JS, 'pu-kakao-work.js'));
const KE = require(path.join(REPO_JS, 'pu-kakao-export.js'));
const K = require(path.join(REPO_JS, 'pu-kakaoroom-core.js'));

const HEARTBEAT_MS = 60 * 1000;

function shaKey(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex').slice(0, 24);
}

function buildWorkList(workItemsMap) {
  return Object.keys(workItemsMap || {}).map((id) => {
    const it = workItemsMap[id];
    if (!it || it._deleted) return null;
    const stageNos = Array.isArray(it.stageNos) ? it.stageNos : [];
    const titleNos = KE && typeof KE.extractCaseNos === 'function' ? KE.extractCaseNos(it.title) : [];
    return {
      id,
      no: it.no || '',
      stageNos: stageNos.concat(titleNos),
      key: String(it.company || it.coName || '').replace(/\s+/g, '').toLowerCase(),
      open: it.state !== 'done' && it.status !== '종결' && it.status !== '완료' && it.status !== 'closed'
    };
  }).filter(Boolean);
}

function buildCompanyList(companiesMap) {
  const out = [];
  Object.keys(companiesMap || {}).forEach((cid) => {
    const c = companiesMap[cid];
    if (!c || c._deleted) return;
    const nm = String(c.name || c.companyName || '').trim();
    const key = nm.replace(/\s+/g, '').toLowerCase();
    if (key) out.push({ id: cid, name: nm, label: nm, key });
  });
  return out;
}

function resetDailyCountersIfNeeded(local, dayStr) {
  if (local.todayKey !== dayStr) {
    local.todayKey = dayStr;
    local.todayCount = 0;
    local.popupCount = 0;
    local.roomCount = 0;
  }
}

function makeOcrFingerprint(room, sender, day, dayInferred, kind, text) {
  const dayPart = dayInferred ? '' : String(day || '');
  return shaKey([room, sender, dayPart, kind, text].join('\u0001'));
}

function metaLookupKey(sender, at, text) {
  return [String(sender || '').trim(), String(Number(at) || 0), String(text || '')].join('\u0001');
}

function readScreenHashes(file) {
  try {
    const obj = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
  } catch (e) {
    return {};
  }
}

function writeScreenHashesAtomic(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj || {}), 'utf8');
  fs.renameSync(tmp, file);
}

async function processCapture(cap, ctx, refData) {
  const t = ctx.now();
  const parsed = K.parseOcrChatLines(cap.lines || [], {
    surface: cap.surface,
    room: cap.title || '',
    allowedRooms: refData.allowedRooms,
    imageWidth: cap.width,
    imageHeight: cap.height,
    nowMs: t
  });
  if (!parsed || !parsed.ok) {
    return { saved: 0, dry: 0, blocked: 0, skipped: 1, deferred: 0, records: [], reason: parsed && parsed.reason || 'empty' };
  }

  /* 시험 모드와 실전 모드의 지문 저장소를 분리해 시험 실행이 실전 수집을 가리지 않게 한다 */
  const seen = ctx.dryRun
    ? (ctx.local.drySeenHashes || (ctx.local.drySeenHashes = {}))
    : (ctx.local.seenHashes || (ctx.local.seenHashes = {}));
  const freshMsgs = [];
  const freshFiles = [];
  const metaQueue = {};
  const allFreshFps = [];

  function enqueueMeta(lk, fp, inferred) {
    if (!metaQueue[lk]) metaQueue[lk] = [];
    metaQueue[lk].push({ fp, inferred: !!inferred });
    allFreshFps.push(fp);
  }

  (parsed.messages || []).forEach((m) => {
    const fp = makeOcrFingerprint(parsed.room, m.sender, m.day || K.kstDay(t), !!m.dayInferred, 'msg', m.text);
    if (seen[fp]) return;
    freshMsgs.push(m);
    enqueueMeta(metaLookupKey(m.sender, m.sentAt, m.text), fp, !!m.dayInferred);
  });

  (parsed.files || []).forEach((f) => {
    const fp = makeOcrFingerprint(parsed.room, f.sender, f.day || K.kstDay(t), !!f.dayInferred, 'file', f.name);
    if (seen[fp]) return;
    freshFiles.push(f);
    enqueueMeta(metaLookupKey(f.sender, f.sentAt, '파일: ' + f.name), fp, !!f.dayInferred);
  });

  if (!freshMsgs.length && !freshFiles.length) {
    return { saved: 0, dry: 0, blocked: 0, skipped: 1, deferred: 0, records: [], reason: 'duplicate' };
  }

  const inputLines = (KE && typeof KE.fromLines === 'function')
    ? KE.fromLines(freshMsgs, freshFiles)
    : freshMsgs.map((m) => Object.assign({}, m, { at: Number(m.sentAt) || t }));

  inputLines.forEach((ln) => {
    const lk = metaLookupKey(ln.sender, ln.at, ln.text);
    const meta = metaQueue[lk] && metaQueue[lk].length ? metaQueue[lk].shift() : null;
    if (meta) {
      ln._fp = meta.fp;
      ln._inferred = meta.inferred;
    }
  });

  const analyzed = K.analyzeMessages(inputLines, {
    room: parsed.room,
    workItems: refData.workList,
    companies: refData.companyList,
    maskSensitive: KW ? KW.maskSensitive : null,
    maskRrn: RM ? RM.maskRrnInText : null,
    now: t
  });

  const workItemsMap = refData.workItemsMap || {};
  const companiesMap = refData.companiesMap || {};
  let saved = 0, dry = 0, skippedDeleted = 0;
  const records = [];

  const maxPerRound = ctx.config.maxPerRound || 20;
  const allRows = analyzed.rows || [];
  const rowsToSave = allRows.slice(0, maxPerRound);
  const deferredRows = allRows.slice(maxPerRound);
  const deferredFps = new Set();
  deferredRows.forEach((dr) => {
    ((dr.g && dr.g.msgs) || []).forEach((xm) => {
      if (xm && xm._fp) deferredFps.add(xm._fp);
    });
  });

  for (const r of rowsToSave) {
    const matchedWorkId = (r.m && r.m.basis === 'sure' && r.itemId && workItemsMap[r.itemId] && !workItemsMap[r.itemId]._deleted) ? r.itemId : '';
    const workObj = matchedWorkId ? workItemsMap[matchedWorkId] : null;
    const rawCoId = workObj && workObj.co_id ? String(workObj.co_id) : '';
    const companyId = (rawCoId && (!companiesMap[rawCoId] || !companiesMap[rawCoId]._deleted)) ? rawCoId : '';

    const groupMsgs = (r.g && r.g.msgs) || [];
    const allInferred = groupMsgs.length > 0 && groupMsgs.every((xm) => !!xm._inferred);
    const stableArchiveId = allInferred
      ? ('kr_' + K.hash32([parsed.room, 'ocr', (r.d && r.d.text) || '', ((r.g && r.g.files) || []).join(',')].join('\u0001')))
      : r.archiveId;

    const rec = K.buildArchiveRecord(Object.assign({}, r, {
      archiveId: stableArchiveId,
      itemId: matchedWorkId,
      note: 'PC 자동 캡처 (' + (cap.surface === 'popup' ? '하단 알림' : '열린 법인방') + ' · 오프라인 OCR)'
    }), {
      now: t,
      actor: (ctx.config && ctx.config.actorSid) || 'WATCH-PC',
      room: parsed.room,
      companyId,
      maskSensitive: KW ? KW.maskSensitive : null,
      maskRrn: RM ? RM.maskRrnInText : null
    });

    records.push(rec);
    if (ctx.dryRun) {
      const outDir = path.join(ctx.dir, 'outbox');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, rec.id + '.json'), JSON.stringify(rec, null, 2), 'utf8');
      dry++;
      continue;
    }

    const prev = await ctx.store.readArchiveItem(rec.id);
    if (prev) {
      if (prev._deleted) skippedDeleted++;
      continue;
    }
    await ctx.store.writeArchiveItem(rec.id, rec);
    saved++;
  }

  /* 저장 완료 후 maxPerRound 초과 이월분을 제외한 지문만 기록 */
  allFreshFps.forEach((fp) => {
    if (!deferredFps.has(fp)) seen[fp] = t;
  });

  return {
    saved,
    dry,
    blocked: (analyzed.blocked || []).length,
    skipped: skippedDeleted,
    deferred: deferredRows.length,
    records,
    reason: 'ok'
  };
}

async function runOnce(ctx) {
  const t = ctx.now();
  const todayStr = K.kstDay(t);
  resetDailyCountersIfNeeded(ctx.local, todayStr);
  const mode = ctx.dryRun ? 'dry-run' : 'live';

  let allowedRooms = Array.isArray(ctx.config.rooms) ? ctx.config.rooms.slice() : [];
  if (!ctx.dryRun && ctx.store && typeof ctx.store.readRooms === 'function') {
    try {
      const remoteRooms = await ctx.store.readRooms();
      if (remoteRooms && remoteRooms.length) allowedRooms = remoteRooms;
    } catch (e) {}
  }
  if (!allowedRooms.length) allowedRooms = ['푸른노무법인 업무채팅방'];

  const stateFile = path.join(ctx.dir, ctx.dryRun ? 'dry-screen-hashes.json' : 'screen-hashes.json');
  fs.mkdirSync(ctx.dir, { recursive: true });

  const scan = await ctx.capturer.scan({
    rooms: allowedRooms,
    stateFile,
    watchPopup: ctx.config.watchPopup !== false,
    watchOpenRoom: ctx.config.watchOpenRoom !== false
  });

  if (!scan || scan.locked || scan.ocrAvailable === false) {
    const errMsg = !scan ? '캡처 응답 없음' : (scan.locked ? '화면이 잠겨 있어 대기중' : (scan.error || '오프라인 OCR 사용 불가'));
    if (!ctx.dryRun && ctx.store && (!ctx.local.heartbeatAt || t - ctx.local.heartbeatAt >= HEARTBEAT_MS)) {
      await ctx.store.writeWatcher({
        mode,
        status: scan && scan.locked ? 'locked' : 'error',
        locked: !!(scan && scan.locked),
        ocrAvailable: !(scan && scan.ocrAvailable === false),
        lastSeenAt: t,
        todayCount: ctx.local.todayCount || 0,
        popupCount: ctx.local.popupCount || 0,
        roomCount: ctx.local.roomCount || 0,
        watchPopup: ctx.config.watchPopup !== false,
        watchOpenRoom: ctx.config.watchOpenRoom !== false,
        rooms: allowedRooms,
        message: errMsg
      });
      ctx.local.heartbeatAt = t;
    }
    return { action: 'wait', reason: scan && scan.locked ? 'locked' : 'no-ocr', message: errMsg };
  }

  const captures = Array.isArray(scan.captures) ? scan.captures : [];
  let refData = null;
  let totalSaved = 0, totalDry = 0, totalBlocked = 0;

  if (captures.length) {
    let workItemsMap = ctx.workItemsMap || {};
    let companiesMap = ctx.companiesMap || {};
    if (!ctx.dryRun && ctx.store) {
      try { workItemsMap = await ctx.store.readWorkItems(); } catch (e) {}
      try { companiesMap = await ctx.store.readCompanies(); } catch (e) {}
    }
    refData = {
      allowedRooms,
      workItemsMap,
      companiesMap,
      workList: buildWorkList(workItemsMap),
      companyList: buildCompanyList(companiesMap)
    };

    const screenHashes = readScreenHashes(stateFile);
    let screenHashDirty = false;
    for (const cap of captures) {
      const res = await processCapture(cap, ctx, refData);
      totalSaved += res.saved;
      totalDry += res.dry;
      totalBlocked += res.blocked;
      const added = res.saved + res.dry;
      if (added > 0) {
        ctx.local.todayCount = (ctx.local.todayCount || 0) + added;
        if (cap.surface === 'popup') ctx.local.popupCount = (ctx.local.popupCount || 0) + added;
        else ctx.local.roomCount = (ctx.local.roomCount || 0) + added;
        ctx.local.lastCaptureAt = t;
      }
      /* 이월 행이 없고 저장이 정상 완료된 화면만 screen-hashes.json 에 확정 기록한다 */
      if (cap.key && cap.hash) {
        if (res.deferred > 0) {
          if (screenHashes[cap.key]) { delete screenHashes[cap.key]; screenHashDirty = true; }
        } else {
          screenHashes[cap.key] = cap.hash;
          screenHashDirty = true;
        }
      }
    }
    if (screenHashDirty) writeScreenHashesAtomic(stateFile, screenHashes);
  }

  if (!ctx.dryRun && ctx.store && (totalSaved > 0 || !ctx.local.heartbeatAt || t - ctx.local.heartbeatAt >= HEARTBEAT_MS)) {
    await ctx.store.writeWatcher({
      mode,
      status: scan.kakaoRunning === false ? 'idle' : 'running',
      locked: false,
      ocrAvailable: true,
      kakaoRunning: !!scan.kakaoRunning,
      lastSeenAt: t,
      lastCaptureAt: ctx.local.lastCaptureAt || 0,
      todayCount: ctx.local.todayCount || 0,
      popupCount: ctx.local.popupCount || 0,
      roomCount: ctx.local.roomCount || 0,
      watchPopup: ctx.config.watchPopup !== false,
      watchOpenRoom: ctx.config.watchOpenRoom !== false,
      rooms: allowedRooms,
      message: scan.kakaoRunning === false ? 'PC 카톡 실행 대기중' : '하단 알림 + 열린 법인방 감시중'
    });
    ctx.local.heartbeatAt = t;
  }

  return {
    action: (totalSaved + totalDry) > 0 ? 'captured' : 'idle',
    captures: captures.length,
    saved: totalSaved,
    dry: totalDry,
    blocked: totalBlocked
  };
}

async function runImageDryTest(imagePath, opts) {
  opts = opts || {};
  const t = (opts.now || Date.now)();
  const allowedRooms = Array.isArray(opts.rooms) && opts.rooms.length ? opts.rooms : ['푸른노무법인 업무채팅방'];
  const capRes = opts.capturer.testImage(imagePath);
  const firstCap = capRes && capRes.captures && capRes.captures[0];
  if (!firstCap) return { ok: false, error: (capRes && capRes.error) || 'OCR 캡처 결과가 없습니다', records: [] };

  const capWithRoom = Object.assign({}, firstCap, { title: allowedRooms[0] });
  const parsed = K.parseOcrChatLines(capWithRoom.lines, {
    surface: 'room',
    room: allowedRooms[0],
    allowedRooms,
    imageWidth: capWithRoom.width,
    imageHeight: capWithRoom.height,
    nowMs: t
  });
  const inputLines = (KE && typeof KE.fromLines === 'function')
    ? KE.fromLines(parsed.messages || [], parsed.files || [])
    : (parsed.messages || []);
  const analyzed = K.analyzeMessages(inputLines, {
    room: parsed.room || allowedRooms[0],
    workItems: buildWorkList(opts.workItemsMap || {}),
    companies: buildCompanyList(opts.companiesMap || {}),
    maskSensitive: KW ? KW.maskSensitive : null,
    maskRrn: RM ? RM.maskRrnInText : null,
    now: t
  });
  const records = (analyzed.rows || []).map((r) => K.buildArchiveRecord(r, {
    now: t,
    actor: 'DRY-TEST',
    room: parsed.room || allowedRooms[0],
    maskSensitive: KW ? KW.maskSensitive : null,
    maskRrn: RM ? RM.maskRrnInText : null
  }));
  return {
    ok: true,
    room: parsed.room || allowedRooms[0],
    ocrLineCount: (firstCap.lines || []).length,
    keptCount: (analyzed.stats && analyzed.stats.keptMessages) || 0,
    blockedCount: (analyzed.stats && analyzed.stats.blockedCount) || 0,
    noiseCount: (analyzed.stats && analyzed.stats.noiseCount) || 0,
    records
  };
}

async function runRound(ctx) {
  try {
    return await runOnce(ctx);
  } catch (e) {
    ctx.log('감시 오류: ' + (e && e.message || e));
    return { action: 'error', error: String(e && e.message || e) };
  }
}

module.exports = { runOnce, runRound, processCapture, runImageDryTest, buildWorkList, buildCompanyList };
