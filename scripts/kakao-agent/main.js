#!/usr/bin/env node
'use strict';
/* main.js — 카톡 심부름꾼 (대표 PC 에서 늘 켜 둔다) (설계서 §7)
   쓰는 법
     node scripts/kakao-agent/main.js --probe                 PC 카톡이 켜져 있고 창을 찾을 수 있는지만 본다(아무것도 보내거나 열지 않음)
     node scripts/kakao-agent/main.js --once --dry-run        한 바퀴만, 시험 모드(PC 카톡을 건드리지 않음)
     node scripts/kakao-agent/main.js                         계속 돈다. config.json 의 liveEnabled 가 true 일 때만 실전
   ⚠ 실전은 «config.json 에 liveEnabled:true» 일 때만이다. --dry-run 은 그것을 «이긴다»(항상 시험). */
const fs = require('node:fs');
const path = require('node:path');
const { homeDir, loadConfig, readLocal, writeLocal } = require('./config.js');
const { createStore } = require('./store.js');
const { createKakao } = require('./kakao.js');
const { runRound } = require('./run.js');

const MAX_LOG_BYTES = 1024 * 1024;

function parseArgs(argv) {
  const i = argv.indexOf('--home');
  return { once: argv.includes('--once'), dry: argv.includes('--dry-run'), probe: argv.includes('--probe'), home: i >= 0 ? argv[i + 1] : '' };
}
function makeLogger(dir) {
  const file = path.join(dir, 'agent.log');
  return function (msg) {
    const line = new Date().toISOString() + ' ' + String(msg);
    console.log(line);
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_LOG_BYTES) fs.renameSync(file, file + '.old');
      fs.appendFileSync(file, line + '\n');
    } catch (e) { /* 로그를 못 쓴다고 일을 멈추지 않는다 */ }
  };
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.probe) { console.log(JSON.stringify(createKakao().probe())); return; }
  const dir = args.home || homeDir();
  const loaded = loadConfig(dir);
  if (!loaded.config || loaded.errors.length) { console.error(loaded.errors.join('\n')); process.exit(2); }
  const config = loaded.config;
  const dryRun = args.dry || config.liveEnabled !== true;
  const log = makeLogger(dir);
  const ctx = { store: createStore({ project: config.project }), kakao: createKakao(), dir, config, dryRun, log, now: Date.now, local: readLocal(dir) };
  log('카톡 심부름꾼 시작 — ' + (dryRun ? '시험 모드(PC 카톡을 건드리지 않음)' : '실전 모드' + (config.redirectRoom ? ' · 모든 글을 시험 방으로만' : '')));
  do {
    const r = await runRound(ctx);
    writeLocal(dir, ctx.local);
    if (r.action !== 'idle') log('한 바퀴: ' + JSON.stringify(r));
    if (args.once) break;
    await sleep(config.pollSec * 1000);
  } while (true); // eslint-disable-line no-constant-condition
}

if (require.main === module) main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
module.exports = { parseArgs };
