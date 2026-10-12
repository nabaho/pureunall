#!/usr/bin/env node
'use strict';
/* main.js — 전광판 심부름꾼 (이 PC 에서 늘 켜 둔다) (설계서 §6)
   쓰는 법
     node scripts/signboard-agent/main.js --once --dry-run   한 바퀴만, 시험 모드(장비에 연결하지 않음)
     node scripts/signboard-agent/main.js                    계속 돈다. config.json 의 liveEnabled 가 true 일 때만 실전
   ⚠ 실전은 «config.json 에 liveEnabled:true» 일 때만이다. --dry-run 은 그것을 «이긴다»(항상 시험).
   ⚠ 열쇠는 로그에 찍지 않는다. */
const fs = require('node:fs');
const path = require('node:path');
const { homeDir, loadConfig, readLocal, writeLocal, scrub } = require('./config.js');
const { createStore } = require('./store.js');
const { createDevice } = require('./device.js');
const { runRound } = require('./run.js');

const MAX_LOG_BYTES = 1024 * 1024;

function parseArgs(argv) {
  const i = argv.indexOf('--home');
  return { once: argv.includes('--once'), dry: argv.includes('--dry-run'), home: i >= 0 ? argv[i + 1] : '' };
}
function makeLogger(dir, config) {
  const file = path.join(dir, 'agent.log');
  return function (msg) {
    const line = new Date().toISOString() + ' ' + scrub(msg, config);
    console.log(line);
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_LOG_BYTES) fs.renameSync(file, file + '.old');
      fs.appendFileSync(file, line + '\n');
    } catch (e) { /* 로그를 못 쓴다고 일을 멈추지 않는다 */ }
  };
}
async function download(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('파일 내려받기 실패 (HTTP ' + r.status + ')');
  return Buffer.from(await r.arrayBuffer());
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.home || homeDir();
  const loaded = loadConfig(dir);
  if (!loaded.config || loaded.errors.length) { console.error(loaded.errors.join('\n')); process.exit(2); }
  const config = loaded.config;
  const dryRun = args.dry || config.liveEnabled !== true;
  const log = makeLogger(dir, config);
  const store = createStore({ project: config.project });
  const ctx = {
    store, dir, config, dryRun, log, download, now: Date.now, local: readLocal(dir),
    makeDevice: () => createDevice({ host: config.deviceHost, deviceId: config.deviceId, sdkKey: config.sdkKey, sdkSecret: config.sdkSecret, dateStyle: config.dateStyle })
  };
  log('심부름꾼 시작 — ' + (dryRun ? '시험 모드(장비에 연결하지 않음)' : '실전 모드'));
  do {
    const r = await runRound(ctx);
    writeLocal(dir, ctx.local);
    if (r.action !== 'idle') log('한 바퀴: ' + r.action + (r.version ? ' (판 ' + r.version + ')' : ''));
    if (args.once) break;
    await sleep(config.pollSec * 1000);
  } while (true); // eslint-disable-line no-constant-condition
}

if (require.main === module) main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
module.exports = { parseArgs };
