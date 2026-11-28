'use strict';
/* config.js — PC 화면·하단알림 자동 캡처 수집기 설정 및 로컬 상태 저장
   ⚠ 설정 파일은 저장소 밖 %APPDATA%\pureun-kakao-watch\config.json 에 둔다.
   ⚠ liveEnabled: true 로 바꾸기 전까지는 시험 모드(dry-run)로만 동작한다. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULTS = {
  liveEnabled: false,
  project: 'pureun-erp',
  pollSec: 3,
  watchPopup: true,
  watchOpenRoom: true,
  rooms: ['푸른노무법인 업무채팅방'],
  actorSid: 'WATCH-PC',
  maxPerRound: 20
};

function homeDir(env) {
  env = env || process.env;
  if (env.PUREUN_KAKAO_WATCH_HOME) return env.PUREUN_KAKAO_WATCH_HOME;
  return path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pureun-kakao-watch');
}

function loadConfig(dir) {
  const file = path.join(dir, 'config.json');
  let raw = {};
  if (fs.existsSync(file)) {
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
      return { config: null, errors: ['설정 파일을 읽을 수 없습니다: ' + file] };
    }
  }
  const c = Object.assign({}, DEFAULTS, raw);
  const errors = [];
  c.liveEnabled = c.liveEnabled === true;
  c.watchPopup = c.watchPopup !== false;
  c.watchOpenRoom = c.watchOpenRoom !== false;
  const poll = Number(c.pollSec);
  const per = Number(c.maxPerRound);
  c.pollSec = isFinite(poll) ? Math.min(60, Math.max(1, Math.round(poll))) : DEFAULTS.pollSec;
  c.maxPerRound = isFinite(per) ? Math.min(50, Math.max(1, Math.round(per))) : DEFAULTS.maxPerRound;
  const cleanRooms = Array.isArray(c.rooms)
    ? c.rooms.map((r) => String(r || '').trim()).filter(Boolean)
    : [];
  c.rooms = cleanRooms.length ? cleanRooms : DEFAULTS.rooms.slice();
  c.actorSid = String(c.actorSid || DEFAULTS.actorSid).trim().slice(0, 64) || DEFAULTS.actorSid;
  if (!/^[a-z0-9-]+$/.test(String(c.project || ''))) errors.push('project 이름이 올바르지 않습니다');
  return { config: c, errors };
}

function readLocal(dir) {
  const base = {
    heartbeatAt: 0,
    lastCaptureAt: 0,
    todayKey: '',
    todayCount: 0,
    popupCount: 0,
    roomCount: 0,
    seenHashes: {},
    drySeenHashes: {}
  };
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'local.json'), 'utf8').replace(/^\uFEFF/, ''));
    const rawSeen = parsed && parsed.seenHashes;
    const rawDrySeen = parsed && parsed.drySeenHashes;
    const seenHashes = (rawSeen && typeof rawSeen === 'object' && !Array.isArray(rawSeen)) ? rawSeen : {};
    const drySeenHashes = (rawDrySeen && typeof rawDrySeen === 'object' && !Array.isArray(rawDrySeen)) ? rawDrySeen : {};
    return Object.assign(base, parsed || {}, { seenHashes, drySeenHashes });
  } catch (e) {
    return base;
  }
}

function pruneSeenHashes(seen, maxKeys) {
  const keys = Object.keys(seen || {});
  if (keys.length <= (maxKeys || 2000)) return seen;
  keys.sort((a, b) => Number(seen[a] || 0) - Number(seen[b] || 0));
  const drop = keys.length - (maxKeys || 2000);
  for (let i = 0; i < drop; i++) delete seen[keys[i]];
  return seen;
}

function writeLocal(dir, local) {
  fs.mkdirSync(dir, { recursive: true });
  const copy = Object.assign({}, local);
  copy.seenHashes = pruneSeenHashes(Object.assign({}, copy.seenHashes), 2000);
  copy.drySeenHashes = pruneSeenHashes(Object.assign({}, copy.drySeenHashes), 2000);
  const target = path.join(dir, 'local.json');
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(copy, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

module.exports = { DEFAULTS, homeDir, loadConfig, readLocal, writeLocal, pruneSeenHashes };
