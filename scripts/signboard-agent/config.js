'use strict';
/* config.js — 이 PC 의 심부름꾼 설정·기록 (설계서 §6.2)
   ⚠ 설정 파일은 «저장소 밖» %APPDATA%\pureun-signboard\config.json 이다. 灰度 열쇠(sdkKey·sdkSecret)는 여기에만 있다.
   ⚠ 열쇠는 로그·DB·화면·채팅 어디에도 찍지 않는다 — 찍을 글은 scrub() 을 거친다. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULTS = { deviceHost: '', deviceId: '', sdkKey: '', sdkSecret: '', liveEnabled: false, dateStyle: 'rfc1123', project: 'pureun-erp', pollSec: 60 };

function homeDir(env) {
  env = env || process.env;
  if (env.PUREUN_SIGNBOARD_HOME) return env.PUREUN_SIGNBOARD_HOME;
  return path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pureun-signboard');
}

function loadConfig(dir) {
  const file = path.join(dir, 'config.json');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { config: null, errors: ['설정 파일이 없거나 읽을 수 없습니다: ' + file] }; }
  const c = Object.assign({}, DEFAULTS, raw), errors = [];
  c.liveEnabled = c.liveEnabled === true;
  if (c.liveEnabled) ['deviceHost', 'deviceId', 'sdkKey', 'sdkSecret'].forEach(function (k) { if (!String(c[k] || '').trim()) errors.push('실전 모드(liveEnabled)에는 ' + k + ' 가 필요합니다'); });
  if (c.dateStyle !== 'rfc1123' && c.dateStyle !== 'java') errors.push('dateStyle 은 rfc1123 또는 java 입니다');
  const poll = Number(c.pollSec);
  c.pollSec = isFinite(poll) ? Math.min(600, Math.max(20, Math.round(poll))) : 60;
  return { config: c, errors: errors };
}

/* 로그에 찍을 글에서 열쇠 값을 지운다 */
function scrub(text, config) {
  let s = String(text == null ? '' : text);
  if (!config) return s;
  ['sdkKey', 'sdkSecret'].forEach(function (k) {
    const v = String(config[k] || '');
    if (v.length >= 3) s = s.split(v).join('***');
  });
  return s;
}
/* 화면·로그에 «설정을 보여 줄 때» */
function redactConfig(config) {
  const c = Object.assign({}, config);
  ['sdkKey', 'sdkSecret'].forEach(function (k) { if (c[k]) c[k] = '***'; });
  return c;
}

function readLocal(dir) {
  const base = { lastSentVersion: 0, lastDryVersion: 0, waitingVersion: 0, failures: {}, heartbeatAt: 0 };
  try { return Object.assign(base, JSON.parse(fs.readFileSync(path.join(dir, 'local.json'), 'utf8'))); } catch (e) { return base; }
}
function writeLocal(dir, local) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'local.json'), JSON.stringify(local, null, 2));
}

module.exports = { DEFAULTS, homeDir, loadConfig, scrub, redactConfig, readLocal, writeLocal };
