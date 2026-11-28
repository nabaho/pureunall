'use strict';
/* capture.js — 읽기 전용 OS 화면 캡처 + Windows 내장 한국어 OCR(capture.ps1) 래퍼 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PS1 = path.join(__dirname, 'capture.ps1');
const OCR_TMP_DIR = path.join(os.tmpdir(), 'pu-kakao-watch-ocr');

function makeRunId() {
  return process.pid + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function cleanupStaleOcrTemp(runId) {
  try {
    if (!fs.existsSync(OCR_TMP_DIR)) return;
    const runPrefix = runId ? ('pu_kw_ocr_' + runId + '_') : '';
    const cutoff = Date.now() - 2 * 60 * 1000;
    for (const name of fs.readdirSync(OCR_TMP_DIR)) {
      if (!/^pu_kw_ocr_.*\.(png|json)$/i.test(name)) continue;
      const full = path.join(OCR_TMP_DIR, name);
      if (runPrefix && name.startsWith(runPrefix)) {
        try { fs.unlinkSync(full); } catch (e) {}
        continue;
      }
      try {
        if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
      } catch (e) {}
    }
  } catch (e) {}
}

function runPsWithRunId(runId, args, execFn) {
  const exec = execFn || ((a) => execFileSync('powershell.exe', a, {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe']
  }));
  const fullArgs = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-RunId', runId].concat(args);
  return String(exec(fullArgs) || '').trim();
}

function createCapturer(o) {
  o = o || {};
  const exec = o.exec || null;

  return {
    probe() {
      const runId = makeRunId();
      fs.mkdirSync(OCR_TMP_DIR, { recursive: true });
      const tmpOut = path.join(OCR_TMP_DIR, 'pu_kw_ocr_' + runId + '_probe.json');
      try {
        runPsWithRunId(runId, ['-Mode', 'probe', '-OutFile', tmpOut], exec);
        return JSON.parse(fs.readFileSync(tmpOut, 'utf8').replace(/^\uFEFF/, ''));
      } finally {
        cleanupStaleOcrTemp(runId);
      }
    },

    scan(opts) {
      opts = opts || {};
      const runId = makeRunId();
      fs.mkdirSync(OCR_TMP_DIR, { recursive: true });
      const tmpRooms = path.join(OCR_TMP_DIR, 'pu_kw_ocr_' + runId + '_rooms.json');
      const tmpOut = path.join(OCR_TMP_DIR, 'pu_kw_ocr_' + runId + '_out.json');
      try {
        fs.writeFileSync(tmpRooms, JSON.stringify(opts.rooms || []), 'utf8');
        const args = [
          '-Mode', 'scan',
          '-RoomsFile', tmpRooms,
          '-OutFile', tmpOut,
          '-WatchPopup', opts.watchPopup === false ? '0' : '1',
          '-WatchOpenRoom', opts.watchOpenRoom === false ? '0' : '1'
        ];
        if (opts.stateFile) args.push('-StateFile', opts.stateFile);
        runPsWithRunId(runId, args, exec);
        return JSON.parse(fs.readFileSync(tmpOut, 'utf8').replace(/^\uFEFF/, ''));
      } finally {
        cleanupStaleOcrTemp(runId);
      }
    },

    testImage(imagePath) {
      const runId = makeRunId();
      fs.mkdirSync(OCR_TMP_DIR, { recursive: true });
      const tmpOut = path.join(OCR_TMP_DIR, 'pu_kw_ocr_' + runId + '_img.json');
      try {
        runPsWithRunId(runId, ['-Mode', 'testimage', '-ImagePath', String(imagePath || ''), '-OutFile', tmpOut], exec);
        return JSON.parse(fs.readFileSync(tmpOut, 'utf8').replace(/^\uFEFF/, ''));
      } finally {
        cleanupStaleOcrTemp(runId);
      }
    }
  };
}

module.exports = { createCapturer, PS1 };
