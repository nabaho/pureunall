/* 푸른 리멤버 연결 — 자동 갱신 + 지켜보기 (대표 「자동갱신」 2026-10-31 · 「앞으로 중단 안되게」 2026-11-07)
   PC 예약 작업이 30분마다 이것을 돌린다:  node C:\pu-remember-ext\sync-ext.js
   ① 저장소 main 의 tools/remember-ext 파일을 받아 ② 안전한지 보고 ③ 설치 폴더를 새 판으로 바꾼다.
      바꾸면 확장 «깨우기» 화면(kick.html)을 열어 새 판으로 다시 시작시킨다.
   ④ 지켜보기 — 서버의 마지막 확인 시각(pucards/remember/status)을 읽어 예정 회차가 늦었으면
      크롬을 깨우고(kick.html), 한 시간 넘게 그대로면 대표 「⚠ 장애 알림」에 «무엇을 하면 되는지»를 올린다.
      다시 돌기 시작하면 그 알림을 «해결»로 닫는다.

   ⚠ 안전장치 — 하나라도 걸리면 «아무것도 안 바꾸고» 멈춘다:
     · 받다가 하나라도 실패하면(반쪽 판 금지)  · 문법이 틀리면  · manifest 의 권한·적용 주소가 달라지면(사람이 본다)
   ⚠ ver.js 는 «맨 마지막에» 쓴다 — 확장이 새 판을 읽을 때 파일이 다 바뀐 뒤이게
   ⚠ 이 파일 자신은 스스로 바꾸지 않는다 — 갱신기가 깨지면 고칠 길이 사라진다. 사람이(클로드가) 설치 폴더에 복사한다. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');

const DIR = __dirname;
const REPO = 'nabaho/pureunall', REF = 'main', REMOTE = 'tools/remember-ext';
const FILES = ['bg.js', 'hook.js', 'intake-relay.js', 'rem-relay.js', 'manifest.json', 'kick.html', 'kick.js'];

function verOf(files) {
  const h = crypto.createHash('sha1');
  FILES.forEach((f) => { h.update(f + '\0'); h.update(files[f]); h.update('\0'); });
  return h.digest('hex').slice(0, 12);
}

/* 권한·적용 범위 «모양» — 이것이 달라지면 사람이 본다.
   ⚠ «허용 목록»이 아니라 «제외 목록» 방식이다: 글자만 바뀌는 칸(이름·설명·판 번호·툴바 문구)만 빼고 «나머지 전부»를 견준다.
     예전에는 permissions·host_permissions·content_scripts(matches·js·world)·background 만 봐서, optional_host_permissions 나
     content_scripts 의 all_frames·match_about_blank 같은 «범위를 넓히는 칸»이 늘어도 «같다»고 통과했다(2026-11-09 보안 검토).
     이제는 새 칸이 생겨도 저절로 «달라짐»으로 잡힌다. 배열은 순서가 달라도 같은 것으로 본다. */
const SHAPE_FREE = ['version', 'version_name', 'name', 'description'];
function canon(v) {
  if (Array.isArray(v)) return v.map((x) => JSON.stringify(canon(x))).sort();
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = canon(v[k]); }); return o; }
  return v;
}
function shape(manifestText) {
  const m = JSON.parse(manifestText);
  const c = {};
  Object.keys(m).filter((k) => SHAPE_FREE.indexOf(k) < 0).forEach((k) => {
    c[k] = k === 'action' && m[k] && typeof m[k] === 'object' ? canon(Object.assign({}, m[k], { default_title: undefined })) : canon(m[k]);
  });
  return JSON.stringify(canon(c));
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

/* ══ 지켜보기 ══════════════════════════════════════════════════════════════
   도는 때는 bg.js·remember-intake.html 과 «같아야» 한다(tests/remember-ext-watch.test.js 가 견준다):
   낮 09:00~18:00 은 30분마다, 그 밖에는 00:00 · 06:00. 예정 뒤 15분이 지나도 그 뒤 확인이 없으면 «늦음». */
const DAY_FROM = 9 * 60, DAY_TO = 18 * 60, EVERY_MIN = 30, NIGHT = [0, 6 * 60];
const GRACE_MS = 15 * 60000, KICK_GAP_MS = 25 * 60000, ALERT_AFTER_MS = 60 * 60000;
function slotsOfDay() {
  const s = NIGHT.slice();
  for (let m = DAY_FROM; m <= DAY_TO; m += EVERY_MIN) s.push(m);
  return s.sort((a, b) => a - b);
}
function prevSlot(nowMs) {
  const now = new Date(nowMs), s = slotsOfDay();
  let best = 0;
  for (let d = -1; d <= 0; d++) for (const m of s) {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 0, m, 0, 0).getTime();
    if (t <= nowMs && t > best) best = t;
  }
  return best;
}
function isLate(st, nowMs) {
  const p = prevSlot(nowMs);
  return !!(p && nowMs - p > GRACE_MS && !((Number(st && st.at) || 0) >= p));
}
const when = (ms) => { const d = new Date(Number(ms) || 0); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };

/* 할 일을 정한다(순수 함수 — 검사가 그대로 돌린다).
   st: 서버 status · state: 지난번 기억 {lateSince, lastKick, alerted} → {act: [...], state, why} */
function decide(st, nowMs, state) {
  const s = Object.assign({ lateSince: 0, lastKick: 0, alerted: '' }, state || {});
  if (!isLate(st, nowMs)) {
    const act = s.alerted ? ['resolve'] : [];
    return { act: act, state: { lateSince: 0, lastKick: 0, alerted: '' }, why: '제때 돌고 있음 (마지막 ' + when(st && st.at) + ')' };
  }
  const act = [];
  if (!s.lateSince) s.lateSince = nowMs;
  const loginLost = st && st.err === 'login' && (Number(st.errAt) || 0) >= (Number(st.at) || 0);
  if (!loginLost && nowMs - s.lastKick >= KICK_GAP_MS) { act.push('kick'); s.lastKick = nowMs; }
  const reason = loginLost ? 'login' : 'stuck';
  if (s.alerted !== reason && (loginLost || nowMs - s.lateSince >= ALERT_AFTER_MS)) { act.push('alert:' + reason); s.alerted = reason; }
  return { act: act, state: s, why: '늦음 — 마지막 ' + when(st && st.at) + ', 예정 ' + when(prevSlot(nowMs)) + (loginLost ? ' · 리멤버 로그인 풀림' : '') };
}

/* 대표 「⚠ 장애 알림」에 올릴 말 — «무엇을 하면 되는지»가 먼저다 */
function alertText(reason, st) {
  if (reason === 'login') {
    return '📇 리멤버 연결 — 리멤버 로그인이 풀렸습니다. 확장을 깐 브라우저(에고라이트·크롬)의 리멤버 탭(card.rememberapp.co.kr)에서 다시 로그인해 주세요. 로그인하면 30분 안에 저절로 이어집니다.';
  }
  return '📇 리멤버 연결이 ' + when(st && st.at) + ' 뒤로 멈췄습니다(PC 가 두 번 깨워 봄). ' +
    '① 확장을 깐 브라우저(에고라이트·크롬)가 켜져 있나 ② 「📇 리멤버 받기」 탭이 푸른에 로그인돼 있나 ③ 리멤버 탭이 로그인돼 있나 ' +
    '④ 브라우저 오른쪽 위 「푸른 리멤버 연결」 아이콘 한 번 — 그래도 안 되면 클로드에게 「리멤버 점검」.';
}

/* firebase CLI — node 가 .cmd 를 직접 못 띄우므로 CLI 의 진짜 JS 를 부른다 */
function fbCli(args) {
  const js = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  return execFileSync(process.execPath, [js].concat(args, ['--project', 'pureun-erp']), {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 90000,
    env: Object.assign({}, process.env, { NODE_OPTIONS: '--max-old-space-size=2048' })
  });
}
function readStatus() { return JSON.parse(fbCli(['database:get', '/pucards/remember/status']) || 'null') || {}; }
/* 알림은 «한 자리»(remember-stall)에 덮어쓴다 — 멈출 때마다 새 줄이 쌓이지 않고, 다시 돌면 그 자리를 닫는다 */
function writeAlert(uid, patch) {
  if (!/^[A-Za-z0-9]{20,40}$/.test(String(uid || ''))) throw new Error('알릴 사람을 모름');
  const tmp = path.join(DIR, 'alert.tmp.json');
  fs.writeFileSync(tmp, JSON.stringify(patch));
  try { fbCli(['database:update', '/systemAlerts/' + uid + '/remember-stall', tmp, '--force']); } finally { try { fs.unlinkSync(tmp); } catch (e) { /* 남아도 해 없다 */ } }
}

/* 확장을 깔 수 있는 «크롬 계열» 브라우저 — 앞에 있는 것이 먼저 찾힌다(대표 2026-11-09: 평소 쓰는 브라우저는 에고라이트).
   ⚠ 환경변수는 «부를 때» 읽는다(시험이 가짜 폴더로 돌릴 수 있게). 프로필 이름·번호·확장 번호는 박지 않는다 — 설정 파일에서 찾는다. */
function browsers() {
  const L = process.env.LOCALAPPDATA || '';
  const P = process.env.ProgramFiles || 'C:\\Program Files';
  const X = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  return [
    { name: '에고라이트', root: path.join(L, 'Citro Labs', 'ego lite', 'User Data'),
      exes: [path.join(P, 'Citro Labs', 'ego lite', 'Application', 'ego.exe'), path.join(X, 'Citro Labs', 'ego lite', 'Application', 'ego.exe'),
        path.join(L, 'Citro Labs', 'ego lite', 'Application', 'ego.exe')] },
    { name: '크롬', root: path.join(L, 'Google', 'Chrome', 'User Data'),
      exes: [path.join(P, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(X, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(L, 'Google', 'Chrome', 'Application', 'chrome.exe')] },
  ];
}
function firstFile(list) {
  return list.find((p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || '';
}
/* 확장이 깔린 브라우저·프로필과 확장 번호를 찾는다 — 못 찾으면 null.
   돌려주는 것: { browser, exe, profile, id }  (exe 는 못 찾으면 '') */
function findExt() {
  const want = path.resolve(DIR).toLowerCase();
  for (const b of browsers()) {
    let dirs = [];
    try { dirs = fs.readdirSync(b.root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch (e) { continue; }
    for (const d of dirs) {
      let j;
      try { j = JSON.parse(fs.readFileSync(path.join(b.root, d, 'Secure Preferences'), 'utf8')); } catch (e) { continue; }
      const set = (j && j.extensions && j.extensions.settings) || {};   // 설정 파일이 JSON null 이어도 던지지 않는다
      for (const id of Object.keys(set)) {
        if (set[id] && typeof set[id].path === 'string' && path.resolve(set[id].path).toLowerCase() === want) return { browser: b.name, exe: firstFile(b.exes), profile: d, id: id };
      }
    }
  }
  return null;
}
/* 깨우기 계획(순수) — 어느 브라우저를 어느 프로필로 어떤 화면과 함께 켤지. 못 하면 { why } */
function kickPlan(ext) {
  if (!ext) return { why: '확장이 깔린 프로필을 못 찾음(에고라이트·크롬)' };
  if (!ext.exe) return { why: ext.browser + ' 실행 파일을 못 찾음' };
  return { exe: ext.exe, args: ['--profile-directory=' + ext.profile, 'chrome-extension://' + ext.id + '/kick.html'], browser: ext.browser };
}
/* 깨우기 — 브라우저가 꺼져 있으면 그 프로필로 켜고, 켜져 있으면 탭 하나를 열었다 곧 닫는다 */
function kick(why) {
  const plan = kickPlan(findExt());
  if (!plan.exe) { log('깨우기 못 함 — ' + plan.why); return false; }
  spawn(plan.exe, plan.args, { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  log('깨움(' + why + ' · ' + plan.browser + ')');
  return true;
}

const STATE = path.join(DIR, 'watch.json');
function watch(dry) {
  let st;
  try { st = readStatus(); } catch (e) { log('지켜보기 못 함 — 서버를 못 읽음: ' + String((e && e.stderr) || (e && e.message) || e).replace(/\s+/g, ' ').slice(0, 100)); return; }
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { /* 처음 */ }
  const d = decide(st, Date.now(), prev);
  if (dry) { console.log(JSON.stringify(d)); return; }
  if (d.act.length || prev.alerted) log('지켜보기 — ' + d.why + (d.act.length ? ' → ' + d.act.join(', ') : ''));
  for (const a of d.act) {
    try {
      if (a === 'kick') kick('늦음');
      /* 칸은 장애 알림판(js/pu-health.js)과 같게 — 판은 status 'new' 만 센다 */
      else if (a.indexOf('alert:') === 0) writeAlert(st.by, { createdAt: Date.now(), kind: 'remember', status: 'new', page: '리멤버 연결', name: 'PC 자동 점검', message: alertText(a.slice(6), st) });
      else if (a === 'resolve') writeAlert(st.by, { status: 'resolved', resolvedAt: Date.now(), resolvedBy: 'remember-watch', message: '📇 리멤버 연결 — 다시 돌고 있습니다 (' + when(st.at) + ')' });
    } catch (e) { log(a + ' 실패 — ' + String((e && e.message) || e).slice(0, 100)); }
  }
  try { fs.writeFileSync(STATE, JSON.stringify(d.state)); } catch (e) { /* 다음에 다시 센다 */ }
}

function main() {
  const dry = process.argv.includes('--dry');
  const files = {};
  let fetched = true;
  try { FILES.forEach((f) => { files[f] = fetchRemote(f); }); }
  catch (e) { fetched = false; log('갱신 건너뜀 — 받기 실패: ' + String((e && e.stderr) || (e && e.message) || e).replace(/\s+/g, ' ').slice(0, 120)); }

  if (fetched && !dry) {
    const same = FILES.every((f) => { try { return fs.readFileSync(path.join(DIR, f)).equals(files[f]); } catch (e) { return false; } });
    if (same) log('이미 최신');
    else {
      let oldManifest = null;
      try { oldManifest = fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'); } catch (e) { /* 처음 설치 */ }
      const j = judge(files, oldManifest);
      if (!j.ok) log('갱신 멈춤 — ' + j.why);
      else {
        FILES.forEach((f) => {
          const tmp = path.join(DIR, f + '.new');
          fs.writeFileSync(tmp, files[f]);
          fs.renameSync(tmp, path.join(DIR, f));
        });
        const ver = verOf(files);
        fs.writeFileSync(path.join(DIR, 'ver.js'), "var DISK_VER = '" + ver + "';\n");      /* 맨 마지막 */
        log('새 판으로 바꿈 ' + ver);
        kick('새 판');
      }
    }
  }
  /* 갱신이 막혀도 지켜보기는 한다 — 갱신과 «도는 것»은 다른 일이다 */
  watch(dry);
}

module.exports = { FILES, verOf, shape, judge, slotsOfDay, prevSlot, isLate, decide, alertText, browsers, findExt, kickPlan };
if (require.main === module) main();
