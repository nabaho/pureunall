#!/usr/bin/env node
'use strict';
/* main.js — PC 화면·하단알림 자동 캡처 수집기 (읽기 전용 · Windows 내장 오프라인 OCR)
   사용법:
     node scripts/kakao-watch-agent/main.js --probe
     node scripts/kakao-watch-agent/main.js --once --dry-run
     node scripts/kakao-watch-agent/main.js --test-image <png경로>
     node scripts/kakao-watch-agent/main.js                      (config.json의 liveEnabled:true 일 때만 실전 저장) */
const fs = require('node:fs');
const path = require('node:path');
const { homeDir, loadConfig, readLocal, writeLocal } = require('./config.js');
const { createStore } = require('./store.js');
const { createCapturer } = require('./capture.js');
const { runRound, runImageDryTest } = require('./run.js');

const MAX_LOG_BYTES = 1024 * 1024;

function parseArgs(argv) {
  const homeIdx = argv.indexOf('--home');
  const imgIdx = argv.indexOf('--test-image');
  return {
    once: argv.includes('--once'),
    dry: argv.includes('--dry-run'),
    probe: argv.includes('--probe'),
    home: homeIdx >= 0 ? (argv[homeIdx + 1] || '') : '',
    testImage: imgIdx >= 0 ? (argv[imgIdx + 1] || '') : ''
  };
}

function makeLogger(dir) {
  const file = path.join(dir, 'watcher.log');
  return function (msg) {
    const line = new Date().toISOString() + ' ' + String(msg);
    console.log(line);
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_LOG_BYTES) fs.renameSync(file, file + '.old');
      fs.appendFileSync(file, line + '\n', 'utf8');
    } catch (e) {}
  };
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const capturer = createCapturer();

  if (args.probe) {
    console.log(JSON.stringify(capturer.probe(), null, 2));
    return;
  }

  const dir = args.home || homeDir();
  const loaded = loadConfig(dir);
  if (!loaded.config || loaded.errors.length) {
    console.error(loaded.errors.join('\n'));
    process.exit(2);
  }
  const config = loaded.config;

  if (args.testImage) {
    const res = await runImageDryTest(args.testImage, { capturer, rooms: config.rooms });
    console.log(JSON.stringify(res, null, 2));
    if (!res.ok) process.exit(1);
    return;
  }

  const dryRun = args.dry || config.liveEnabled !== true;
  const log = makeLogger(dir);
  const ctx = {
    store: dryRun ? null : createStore({ project: config.project }),
    capturer,
    dir,
    config,
    dryRun,
    log,
    now: Date.now,
    local: readLocal(dir)
  };

  log('PC 카톡 화면·하단알림 자동 캡처 시작 — ' + (dryRun ? '시험 모드(outbox/*.json에만 저장)' : '실전 모드(/kakao_room/items 자동 반영)'));
  do {
    const r = await runRound(ctx);
    writeLocal(dir, ctx.local);
    if (r.action !== 'idle') log('감시 결과: ' + JSON.stringify(r));
    if (args.once) break;
    await sleep(config.pollSec * 1000);
  } while (true); // eslint-disable-line no-constant-condition
}

if (require.main === module) {
  main().catch((e) => {
    console.error(String((e && e.stack) || e));
    process.exit(1);
  });
}

module.exports = { parseArgs };
