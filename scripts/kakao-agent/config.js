'use strict';
/* config.js — 카톡 심부름꾼 설정·기록 (설계서 docs/superpowers/specs/2026-10-31-consult-settle-design.md §7)
   ⚠ 설정 파일은 «저장소 밖» %APPDATA%\pureun-kakao-agent\config.json 이다.
   ⚠ 실전(liveEnabled:true)이 아니면 PC 카톡을 «한 번도» 건드리지 않는다 — 보낼 글을 outbox/ 에 적기만 한다.
   ★ redirectRoom — 실전 첫 시험용. 비어 있지 않으면 모든 글을 그 방(예: 대표 «나와의 채팅» 방 이름)으로만 보낸다. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULTS = { liveEnabled: false, redirectRoom: '', project: 'pureun-erp', pollSec: 60, maxPerRound: 10 };

function homeDir(env) {
  env = env || process.env;
  if (env.PUREUN_KAKAO_HOME) return env.PUREUN_KAKAO_HOME;
  return path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pureun-kakao-agent');
}

function loadConfig(dir) {
  const file = path.join(dir, 'config.json');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { return { config: null, errors: ['설정 파일이 없거나 읽을 수 없습니다: ' + file] }; }
  const c = Object.assign({}, DEFAULTS, raw), errors = [];
  c.liveEnabled = c.liveEnabled === true;
  c.redirectRoom = String(c.redirectRoom || '').trim();
  const poll = Number(c.pollSec), per = Number(c.maxPerRound);
  c.pollSec = isFinite(poll) ? Math.min(600, Math.max(20, Math.round(poll))) : 60;
  c.maxPerRound = isFinite(per) ? Math.min(30, Math.max(1, Math.round(per))) : 10;
  if (!/^[a-z0-9-]+$/.test(String(c.project || ''))) errors.push('project 이름이 올바르지 않습니다');
  return { config: c, errors: errors };
}

function readLocal(dir) {
  const base = { heartbeatAt: 0, dryDone: {} };
  try { return Object.assign(base, JSON.parse(fs.readFileSync(path.join(dir, 'local.json'), 'utf8'))); } catch (e) { return base; }
}
function writeLocal(dir, local) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'local.json'), JSON.stringify(local, null, 2));
}

module.exports = { DEFAULTS, homeDir, loadConfig, readLocal, writeLocal };
