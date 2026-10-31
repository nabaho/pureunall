/* 푸른 리멤버 연결 — 자동 갱신 (대표 「자동갱신」 2026-10-31)
   PC 예약 작업이 30분마다 이것을 돌린다:  node C:\pu-remember-ext\sync-ext.js
   ① 저장소 main 의 tools/remember-ext 파일을 받아 ② 안전한지 보고 ③ 설치 폴더를 새 판으로 바꾼다.
   확장은 ver.js 가 달라진 것을 알아채 스스로 다시 시작한다(bg.js selfUpdate).

   ⚠ 안전장치 — 하나라도 걸리면 «아무것도 안 바꾸고» 멈춘다:
     · 받다가 하나라도 실패하면(반쪽 판 금지)  · 문법이 틀리면  · manifest 의 권한·적용 주소가 달라지면(사람이 본다)
   ⚠ ver.js 는 «맨 마지막에» 쓴다 — 확장이 새 판을 읽을 때 파일이 다 바뀐 뒤이게 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const REPO = 'nabaho/pureunall', REF = 'main', REMOTE = 'tools/remember-ext';
const FILES = ['bg.js', 'hook.js', 'intake-relay.js', 'rem-relay.js', 'manifest.json'];

function verOf(files) {
  const h = crypto.createHash('sha1');
  FILES.forEach((f) => { h.update(f + '\0'); h.update(files[f]); h.update('\0'); });
  return h.digest('hex').slice(0, 12);
}

/* 권한·적용 주소 «모양» — 이것이 달라지면 사람이 본다 */
function shape(manifestText) {
  const m = JSON.parse(manifestText);
  const set = (a) => (a || []).slice().sort();
  return JSON.stringify({ v: m.manifest_version, p: set(m.permissions), h: set(m.host_permissions),
    c: (m.content_scripts || []).map((c) => ({ m: set(c.matches), j: set(c.js), w: c.world || '' })), b: m.background });
}

/* files: {이름: Buffer} · oldManifestText: 지금 설치된 manifest(없으면 null) → {ok, why} */
function judge(files, oldManifestText) {
  for (const f of FILES) if (!Buffer.isBuffer(files[f]) || !files[f].length) return { ok: false, why: f + ' 을 못 받음' };
  for (const f of FILES.filter((x) => x.endsWith('.js'))) {
    try { new vm.Script(files[f].toString('utf8'), { filename: f }); } catch (e) { return { ok: false, why: f + ' 문법 오류: ' + e.message }; }
  }
  let next;
  try { next = shape(files['manifest.json'].toString('utf8')); } catch (e) { return { ok: false, why: 'manifest 를 못 읽음' }; }
  if (oldManifestText) {
    let prev = null;
    try { prev = shape(oldManifestText); } catch (e) { /* 옛 것이 깨졌으면 새 것이 이긴다 */ }
    if (prev && prev !== next) return { ok: false, why: 'manifest 권한·적용 주소가 달라짐 — 사람이 확인해야 합니다' };
  }
  return { ok: true, why: '' };
}

function fetchRemote(f) {
  return execFileSync('gh', ['api', 'repos/' + REPO + '/contents/' + REMOTE + '/' + f + '?ref=' + REF, '-H', 'Accept: application/vnd.github.raw'],
    { maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}

function log(msg) {
  const line = new Date().toISOString() + ' ' + msg + '\n';
  try { fs.appendFileSync(path.join(DIR, 'sync.log'), line); } catch (e) { /* 기록 못 해도 일은 한다 */ }
  console.log(msg);
}

function main() {
  const files = {};
  try { FILES.forEach((f) => { files[f] = fetchRemote(f); }); }
  catch (e) { log('멈춤 — 받기 실패: ' + String((e && e.stderr) || (e && e.message) || e).replace(/\s+/g, ' ').slice(0, 120)); process.exit(1); }

  const same = FILES.every((f) => { try { return fs.readFileSync(path.join(DIR, f)).equals(files[f]); } catch (e) { return false; } });
  if (same) { log('이미 최신'); return; }

  let oldManifest = null;
  try { oldManifest = fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'); } catch (e) { /* 처음 설치 */ }
  const j = judge(files, oldManifest);
  if (!j.ok) { log('멈춤 — ' + j.why); process.exit(2); }

  FILES.forEach((f) => {
    const tmp = path.join(DIR, f + '.new');
    fs.writeFileSync(tmp, files[f]);
    fs.renameSync(tmp, path.join(DIR, f));
  });
  const ver = verOf(files);
  fs.writeFileSync(path.join(DIR, 'ver.js'), "var DISK_VER = '" + ver + "';\n");      /* 맨 마지막 */
  log('새 판으로 바꿈 ' + ver);
}

module.exports = { FILES, verOf, shape, judge };
if (require.main === module) main();
