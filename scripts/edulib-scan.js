#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   법정교육자료함 — 내 PC 의 강의자료를 훑어 «가져오기 목록(JSON)»을 만든다 (2026-11-19)

   쓰는 법:
     node scripts/edulib-scan.js                       # C·D·E·F·H 드라이브 전부
     node scripts/edulib-scan.js "C:\Users\me\Desktop"  # 이 폴더만
     node scripts/edulib-scan.js --out 목록.json  [폴더…]

   ★ 읽기만 한다 — 파일을 옮기거나 고치거나 지우지 않는다. 내용도 열지 않는다(이름·크기·수정일만).
   ★ 분류는 js/pu-edulib-classify.js (자료함 화면과 같은 규칙)로 한다 — 종류·날짜는 «추정»이다.
   ★ 결과 파일에는 PC 경로(고객 업체 이름이 섞일 수 있다)가 들어간다 → 저장소에 올리지 않는다.
     자료함 화면의 [📥 PC 목록 가져오기] 로 읽어 사람이 고른 것만 저장한다.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const C = require('../js/pu-edulib-classify.js');

const args = process.argv.slice(2);
let out = path.join(os.homedir(), 'Desktop', '법정교육자료함_PC목록_' + new Date().toISOString().slice(0, 10) + '.json');
const roots = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') { out = args[++i]; continue; }
  roots.push(args[i]);
}
if (!roots.length) for (const d of ['C', 'D', 'E', 'F', 'H']) if (fs.existsSync(d + ':\\')) roots.push(d + ':\\');

const HOME = os.homedir().toLowerCase();
const SKIP_NAMES = new Set(['windows', 'program files', 'program files (x86)', 'programdata', 'appdata', '$recycle.bin',
  'system volume information', 'recovery', 'perflogs', 'node_modules', '.git', 'msocache', 'windows.old',
  '$windows.~bt', '$windows.~ws', 'site-packages', '__pycache__', 'venv', '.venv']);
const SKIP_PREFIX = [
  path.join(HOME, 'onedrive', '바탕 화면'),          // 실제 바탕화면의 사본 — 중복으로 센다
  path.join(HOME, 'desktop', 'github')               // 저장소
].map(s => s.toLowerCase());
const EXT_OK = new Set(['ppt', 'pptx', 'pps', 'ppsx', 'pdf', 'hwp', 'hwpx', 'doc', 'docx', 'show', 'odp', 'key',
  'xls', 'xlsx', 'cell', 'mp4', 'wmv', 'avi', 'mov', 'mkv', 'm4v', 'mp3', 'm4a', 'zip', '7z', 'alz', 'egg']);

const found = [];
function walk(dir, depth) {
  if (depth > 14) return;
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      const lo = full.toLowerCase();
      if (SKIP_NAMES.has(e.name.toLowerCase()) || (e.name[0] === '.' && e.name.length > 1)) continue;
      if (SKIP_PREFIX.some(p => lo === p || lo.startsWith(p + path.sep))) continue;
      walk(full, depth + 1);
    } else if (e.isFile()) {
      const ext = C.extOf(e.name);
      if (!EXT_OK.has(ext)) continue;
      const r = C.classifyPath(full);
      if (!r.tier) continue;
      let st; try { st = fs.statSync(full); } catch (_) { continue; }
      found.push({ path: full, fileName: e.name, size: st.size, mtime: st.mtime.toISOString().slice(0, 10),
        tier: r.tier, cat: r.cat, catFrom: r.catFrom, lectureDate: r.date || '', dateFrom: r.dateFrom || '', pii: r.pii, kind: r.kind });
    }
  }
}
for (const r of roots) walk(r, 0);

/* 같은 파일(이름+크기)은 하나로 — 바탕화면 쪽을 대표로, 나머지 자리는 copies 에 */
const rank = p => p.toLowerCase().startsWith(path.join(HOME, 'desktop').toLowerCase()) ? 0 : /^c:/i.test(p) ? 1 : 2;
found.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
const byKey = new Map();
for (const f of found) {
  const k = f.fileName.toLowerCase() + '|' + f.size;
  const first = byKey.get(k);
  if (first) (first.copies || (first.copies = [])).push(f.path);
  else byKey.set(k, f);
}
const list = [...byKey.values()].map(f => Object.assign(f, {
  /* 화면에 보일 경로 — 내 PC 사용자 폴더는 «~» 로 줄인다 */
  path: f.path.toLowerCase().startsWith(HOME) ? '~' + f.path.slice(HOME.length) : f.path
}));
fs.writeFileSync(out, JSON.stringify({ kind: 'edulib-pc-list', version: 1, made: new Date().toISOString(),
  count: list.length, items: list }, null, 1));

const by = {};
for (const f of list) { const b = by[f.cat] || (by[f.cat] = { n: 0, bytes: 0 }); b.n++; b.bytes += f.size; }
console.log('강의자료', list.length, '건 (같은 파일 묶음 뒤) →', out);
for (const [k, v] of Object.entries(by).sort((a, b) => b[1].n - a[1].n)) {
  console.log('  ' + C.catByKey(k).label + '\t' + v.n + '건\t' + (v.bytes / 1048576).toFixed(0) + 'MB');
}
