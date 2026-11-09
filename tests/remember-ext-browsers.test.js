/* 리멤버 연결 — «어느 브라우저에 깔렸나»를 갱신기(sync-ext.js)가 찾는다 (대표 지시 2026-11-09 「리멤버 확장버전 만들어서 연결시키자」 → 「에고라이트」)
   예전에는 크롬만 찾았다. 평소 쓰는 브라우저가 에고라이트(크롬 계열)면 «깨우기»가 확장을 못 찾아
   「깨우기 못 함」만 남기고, 멈추면 한 시간 뒤 장애 알림만 올렸다.
   ⚠ 시험은 가짜 폴더(LOCALAPPDATA·ProgramFiles 를 임시 폴더로)에서 돈다 — 이 PC 의 진짜 브라우저를 안 읽는다.
   ⚠ 에고라이트 폴더 모양(Citro Labs\ego lite\User Data\Profile N\Secure Preferences)은 이 PC 에서 읽어 확인한 것이다.
      진짜 에고라이트에서 «깨우기»가 도는지는 사람이 확장을 불러온 뒤에야 확인된다 — 시험이 대신하지 못한다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stripJs } = require('./strip-comments.js');

const DIR = path.join(__dirname, '..', 'tools', 'remember-ext');
const sync = require(path.join(DIR, 'sync-ext.js'));
const SYNC_CODE = stripJs(fs.readFileSync(path.join(DIR, 'sync-ext.js'), 'utf8'));

const ENV_KEYS = ['LOCALAPPDATA', 'ProgramFiles', 'ProgramFiles(x86)'];

/* 가짜 PC — 임시 폴더 아래에 «브라우저 데이터 폴더»와 «실행 파일»을 만든다 */
function fakePc(spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-browsers-'));
  const L = path.join(root, 'Local'), P = path.join(root, 'PF'), X = path.join(root, 'PF86');
  [L, P, X].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const egoUser = path.join(L, 'Citro Labs', 'ego lite', 'User Data');
  const chromeUser = path.join(L, 'Google', 'Chrome', 'User Data');
  const prefs = (extPath, id) => JSON.stringify({ extensions: { settings: { [id]: { path: extPath } } } });
  (spec.ego || []).forEach((e) => put(path.join(egoUser, e.profile, 'Secure Preferences'), prefs(e.path, e.id)));
  (spec.chrome || []).forEach((e) => put(path.join(chromeUser, e.profile, 'Secure Preferences'), prefs(e.path, e.id)));
  if (spec.egoExe !== false) put(path.join(P, 'Citro Labs', 'ego lite', 'Application', 'ego.exe'), 'x');
  if (spec.chromeExe !== false) put(path.join(P, 'Google', 'Chrome', 'Application', 'chrome.exe'), 'x');
  return { root, L, P, X, egoExe: path.join(P, 'Citro Labs', 'ego lite', 'Application', 'ego.exe'),
    chromeExe: path.join(P, 'Google', 'Chrome', 'Application', 'chrome.exe') };
}
function withPc(pc, fn) {
  const saved = {};
  ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; });
  process.env.LOCALAPPDATA = pc.L; process.env.ProgramFiles = pc.P; process.env['ProgramFiles(x86)'] = pc.X;
  try { return fn(); } finally {
    ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
    try { fs.rmSync(pc.root, { recursive: true, force: true }); } catch (e) { /* 임시 폴더 — 남아도 해 없다 */ }
  }
}

const EXT = path.resolve(DIR);   // 갱신기가 «자기 폴더»로 보는 곳 — 확장이 여기서 불러와진 것으로 가짜 설정을 만든다
const ID = 'abcdefghijklmnopabcdefghijklmnop';
/* ⚠ «그 PC 의 절대 경로» 글자를 시험 파일에 쓰지 않는다(tests/tests-no-local-path.test.js) — 임시 폴더 밑에서 만든다 */
const ELSEWHERE = path.join(os.tmpdir(), 'somewhere', 'else');
const FAKE_EGO = path.join(os.tmpdir(), 'fake-bin', 'ego.exe');

test('★★★ 에고라이트에 확장이 불러와져 있으면 찾는다 — 프로필·확장 번호는 설정 파일에서 읽는다', () => {
  const pc = fakePc({ ego: [{ profile: 'Profile 1', path: EXT, id: ID }, { profile: 'Profile 2', path: ELSEWHERE, id: 'zzzz' }] });
  const r = withPc(pc, () => sync.findExt());
  assert.ok(r, '★★★ 에고라이트에 깔렸는데 못 찾습니다 — 깨우기가 영영 못 합니다');
  assert.strictEqual(r.browser, '에고라이트');
  assert.strictEqual(r.profile, 'Profile 1');
  assert.strictEqual(r.id, ID);
  assert.strictEqual(r.exe, pc.egoExe, '★ 에고라이트 실행 파일을 못 찾았습니다');
});

test('★★ 크롬에만 있으면 크롬으로 찾는다 — 예전 동작이 그대로다', () => {
  const pc = fakePc({ chrome: [{ profile: 'Default', path: EXT, id: ID }] });
  const r = withPc(pc, () => sync.findExt());
  assert.ok(r, '★★ 크롬에 깔렸는데 못 찾습니다');
  assert.strictEqual(r.browser, '크롬');
  assert.strictEqual(r.profile, 'Default');
  assert.strictEqual(r.exe, pc.chromeExe);
});

test('★★ 둘 다 깔렸으면 에고라이트가 먼저다 — 평소 쓰는 쪽을 깨운다', () => {
  const pc = fakePc({ ego: [{ profile: 'Profile 1', path: EXT, id: ID }], chrome: [{ profile: 'Default', path: EXT, id: 'other' }] });
  const r = withPc(pc, () => sync.findExt());
  assert.strictEqual(r.browser, '에고라이트');
});

test('★★ 아무 데도 없으면 null — 다른 폴더에서 불러온 확장은 우리 것이 아니다', () => {
  const none = fakePc({});
  assert.strictEqual(withPc(none, () => sync.findExt()), null, '아무것도 안 깔렸는데 찾았다고 합니다');
  const other = fakePc({ ego: [{ profile: 'Profile 1', path: ELSEWHERE, id: ID }], chrome: [{ profile: 'Default', path: path.join(ELSEWHERE, 'x'), id: ID }] });
  assert.strictEqual(withPc(other, () => sync.findExt()), null, '★★ 다른 폴더에서 불러온 확장을 우리 확장으로 착각합니다 — 엉뚱한 것을 깨웁니다');
});

test('★ 폴더 글자가 대소문자·끝 슬래시가 달라도 같은 폴더로 본다(윈도)', () => {
  const pc = fakePc({ ego: [{ profile: 'Profile 1', path: EXT.toUpperCase() + path.sep, id: ID }] });
  const r = withPc(pc, () => sync.findExt());
  assert.ok(r, '★ 대소문자만 달라 못 찾습니다');
});

test('★★ 설정 파일이 깨졌거나 없는 프로필은 건너뛴다 — 하나 때문에 전부 못 찾으면 안 된다', () => {
  const pc = fakePc({ ego: [{ profile: 'Profile 2', path: EXT, id: ID }] });
  fs.mkdirSync(path.join(pc.L, 'Citro Labs', 'ego lite', 'User Data', 'Profile 1'), { recursive: true });
  fs.writeFileSync(path.join(pc.L, 'Citro Labs', 'ego lite', 'User Data', 'Profile 1', 'Secure Preferences'), '{ 깨진 json');
  fs.mkdirSync(path.join(pc.L, 'Citro Labs', 'ego lite', 'User Data', 'Crashpad'), { recursive: true });   // 프로필이 아닌 폴더
  const r = withPc(pc, () => sync.findExt());
  assert.ok(r && r.profile === 'Profile 2', '★★ 깨진 프로필 하나 때문에 멀쩡한 프로필을 못 찾습니다');
});

test('★★ 설정 파일이 JSON null 이거나 확장 경로가 글자가 아니어도 던지지 않는다 — 다른 프로필을 계속 본다', () => {
  const pc = fakePc({ ego: [{ profile: 'Profile 3', path: EXT, id: ID }] });
  const user = path.join(pc.L, 'Citro Labs', 'ego lite', 'User Data');
  fs.mkdirSync(path.join(user, 'Profile 1'), { recursive: true });
  fs.writeFileSync(path.join(user, 'Profile 1', 'Secure Preferences'), 'null');
  fs.mkdirSync(path.join(user, 'Profile 2'), { recursive: true });
  fs.writeFileSync(path.join(user, 'Profile 2', 'Secure Preferences'), JSON.stringify({ extensions: { settings: { a: { path: 123 }, b: { path: null }, c: null } } }));
  let r;
  assert.doesNotThrow(() => { r = withPc(pc, () => sync.findExt()); }, '★★ 설정 파일이 null·이상한 모양이면 갱신기가 죽습니다 — 깨우기도 알림도 못 합니다');
  assert.ok(r && r.profile === 'Profile 3', '★★ 이상한 프로필 때문에 멀쩡한 프로필을 못 찾습니다');
});

test('★★ 깨우기 계획 — 그 브라우저·그 프로필로, 확장 자기 화면(kick.html)을 연다', () => {
  const plan = sync.kickPlan({ browser: '에고라이트', exe: FAKE_EGO, profile: 'Profile 1', id: ID });
  assert.strictEqual(plan.exe, FAKE_EGO);
  assert.deepStrictEqual(plan.args, ['--profile-directory=Profile 1', 'chrome-extension://' + ID + '/kick.html']);
  assert.strictEqual(plan.browser, '에고라이트');
});

test('★★ 못 깨우는 까닭을 «말로» 남긴다 — 확장이 없을 때와 실행 파일이 없을 때가 다르다', () => {
  const none = sync.kickPlan(null);
  assert.ok(!none.exe && /못 찾음/.test(none.why) && /에고라이트/.test(none.why) && /크롬/.test(none.why), '★ 확장을 못 찾았다는 말에 어디를 찾았는지가 없습니다: ' + none.why);
  const noExe = sync.kickPlan({ browser: '에고라이트', exe: '', profile: 'Profile 1', id: ID });
  assert.ok(!noExe.exe && /에고라이트/.test(noExe.why) && /실행 파일/.test(noExe.why), '★ 실행 파일이 없다는 말이 없습니다: ' + noExe.why);
});

test('★★ 프로필 이름·번호·사람 이름을 코드에 박지 않는다 — 장애 알림 문구도 브라우저에 묶이지 않는다', () => {
  assert.ok(!/권형하|Profile \d/.test(SYNC_CODE), '★★ 코드에 프로필 이름·번호가 박혀 있습니다 — 다른 PC·다른 프로필에서 깨집니다');
  ['login', 'stuck'].forEach((reason) => {
    const m = sync.alertText(reason, { at: Date.now() });
    assert.ok(!/권형하/.test(m), '★ 알림 문구에 사람 이름이 박혀 있습니다: ' + m);
    assert.ok(/에고라이트/.test(m) && /크롬/.test(m), '★ 알림 문구가 두 브라우저를 다 말해야 합니다: ' + m);
  });
});

test('★★ 깨우기(kick)는 «찾은 브라우저»의 실행 파일로 켠다 — 크롬 경로를 따로 박지 않는다', () => {
  const body = SYNC_CODE.slice(SYNC_CODE.indexOf('function kick('), SYNC_CODE.indexOf('const STATE'));
  assert.match(body, /kickPlan\(findExt\(\)\)/, '★★ kick 이 찾은 확장으로 계획을 세우지 않습니다');
  assert.match(body, /spawn\(plan\.exe, plan\.args/, '★★ kick 이 계획의 실행 파일·인자로 켜지 않습니다 — 에고라이트에 깔려도 크롬을 켭니다');
  assert.ok(!/chrome\.exe|Google/.test(body), '★★ kick 안에 크롬 경로가 박혀 있습니다');
});

test('★ 찾는 브라우저 목록은 에고라이트가 앞이고 둘 다 «실행 파일 후보»를 갖는다', () => {
  const pc = fakePc({});
  const list = withPc(pc, () => sync.browsers());
  assert.deepStrictEqual(list.map((b) => b.name), ['에고라이트', '크롬']);
  list.forEach((b) => assert.ok(b.exes.length >= 2 && b.root, b.name + ' 의 데이터 폴더·실행 파일 후보가 없습니다'));
});
