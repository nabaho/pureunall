/* 전광판 심부름꾼 — 한 바퀴(run.js)를 «가짜 장비·가짜 DB·가짜 내려받기»로 돌려 본다 (2026-10-12)
   ★ 가짜가 «현실의 불편한 동작»을 한다: 장비가 응답이 없고, 파일이 잘려 오고, 비밀이 오류 글에 섞인다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const C = require('../js/pu-signboard-core.js');
const R = require('../scripts/signboard-agent/run.js');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/signboard%2Fa.jpg?alt=media&token=t';
const NOW = Date.UTC(2026, 9, 12, 3, 0, 0);

function ad(id, over) { const a = C.newAd('text', { id, order: 1 }); a.title = id; a.text.string = '문구 ' + id; return Object.assign(a, over || {}); }
function imageAd(id, size) { const a = C.newAd('image', { id, order: 2 }); a.title = id; a.media = Object.assign(a.media, { url: URL_OK, size, name: 'a.jpg' }); return a; }

function make(opt) {
  opt = opt || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbtest-'));
  const calls = [], states = [];
  const world = { version: opt.version === undefined ? 1 : opt.version, ads: opt.ads || [ad('ad_a')], control: opt.control || {}, clock: NOW };
  const store = {
    readVersion: () => world.version,
    readPublished: () => (world.version == null ? null : { version: world.version, ads: C.publishableAds(world.ads) }),
    readControl: () => world.control,
    writeState: (o) => { states.push(o); }
  };
  const device = {
    getDeviceProperty: async () => { calls.push('prop'); if (opt.deviceDown) throw new Error('connect ECONNREFUSED 192.168.0.9:30080'); return { name: 'Box', 'screen.width': '192', 'screen.height': '96', time: '2026-10-12 12:00:00', 'time.timeZone': 'Asia/Seoul;UTC+09:00;Seoul', luminance: '80', 'version.app': '7.10' }; },
    getAllPrograms: async () => { calls.push('getAll'); return [{ uuid: 'U1', name: '옛 광고' }, { uuid: 'U2', name: '옛 광고2' }]; },
    uploadFile: async (buf, name) => { calls.push('upload:' + name); return { file: 'dev_' + name, md5: '', size: buf.length }; },
    replace: async (body) => { calls.push('replace:' + body.data.length); world.lastBody = body; return true; }
  };
  const local = { lastSentVersion: 0, lastDryVersion: 0, waitingVersion: 0, failures: {}, heartbeatAt: 0 };
  let downloads = 0;
  const ctx = {
    store, local, dir, dryRun: !!opt.dryRun, config: { deviceId: 'C16L-D00-A000F', sdkKey: 'KEY-123', sdkSecret: 'SECRET-456' },
    now: () => world.clock, log: () => { },
    makeDevice: () => { if (opt.noDevice) throw new Error('시험 모드에서 장비를 만들었다'); return device; },
    download: async () => { downloads++; return Buffer.alloc(opt.dlSize == null ? 1234 : opt.dlSize, 7); }
  };
  return { ctx, calls, states, world, local, dir, downloads: () => downloads };
}

test('올린 판이 없으면 아무것도 보내지 않고 «판 없음»만 알린다', async () => {
  const m = make({ version: null, noDevice: true, dryRun: true });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'no-published');
  assert.equal(m.calls.length, 0);
});

test('시험 모드 — 장비에 한 번도 연결하지 않고 outbox 에 보낼 내용을 적는다. 같은 판은 다시 하지 않는다', async () => {
  const m = make({ dryRun: true, noDevice: true, ads: [ad('ad_a'), imageAd('ad_i', 1234)] });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'dry-run');
  const body = JSON.parse(fs.readFileSync(r.file, 'utf8'));
  assert.equal(body.method, 'replace'); assert.equal(body.data.length, 2);
  assert.equal(m.states[m.states.length - 1].result, 'dry-run');
  assert.equal(m.states[m.states.length - 1].screenAssumed, true);
  const n = m.downloads();
  m.world.clock += 60000;
  const r2 = await R.runRound(m.ctx);
  assert.equal(r2.action, 'idle');
  assert.equal(m.downloads(), n, '같은 판이면 다시 내려받지 않는다');
});

test('실전 첫 전송 — 대표 확인 전에는 «기존 광고 목록만» 읽고 아무것도 지우지 않는다', async () => {
  const m = make({});
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'wait-confirm');
  assert.equal(m.calls.some((c) => c.startsWith('replace') || c.startsWith('upload')), false);
  const st = m.states[m.states.length - 1];
  assert.equal(st.result, 'wait-confirm'); assert.equal(st.existingPrograms.length, 2);
  m.world.clock += 60000;
  const r2 = await R.runRound(m.ctx);
  assert.equal(r2.action, 'waiting', '확인 전에는 장비를 다시 두드리지 않는다');
  assert.equal(m.calls.filter((c) => c === 'getAll').length, 1);
});

test('실전 — 확인이 나면 파일을 올리고 전체 교체를 보내며, 결과와 장비 정보를 기록한다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [ad('ad_a'), imageAd('ad_i', 1234)] });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'sent');
  const order = m.calls.filter((c) => c !== 'prop');
  assert.match(order[0], /^upload:ad_i_1234\.jpg$/, '파일 이름은 안전한 글자');
  assert.equal(order[1], 'replace:2');
  const img = m.world.lastBody.data.find((p) => p.uuid === 'ad_i').area[0].item[0];
  assert.equal(img.file, 'dev_ad_i_1234.jpg', '장비가 돌려준 이름을 쓴다');
  const st = m.states[m.states.length - 1];
  assert.equal(st.result, 'ok'); assert.equal(st.sentVersion, 1); assert.equal(st.device.width, 192); assert.equal(st.clock.tzIsKst, true);
  assert.equal(m.local.lastSentVersion, 1);
  assert.equal(JSON.stringify(st).includes('SECRET-456'), false);
});

test('같은 판은 다시 보내지 않고, 새 판이면 다시 보낸다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true } });
  await R.runRound(m.ctx);
  const sent = () => m.calls.filter((c) => c.startsWith('replace')).length;
  assert.equal(sent(), 1);
  m.world.clock += 10 * 60000;
  assert.equal((await R.runRound(m.ctx)).action, 'idle');
  assert.equal(sent(), 1);
  m.world.version = 2; m.world.ads = [ad('ad_a'), ad('ad_b')];
  assert.equal((await R.runRound(m.ctx)).action, 'sent');
  assert.equal(sent(), 2);
});

test('광고 0건인 판은 보내지 않는다 — 전광판을 통째로 비우지 않는다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [] });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'skip-empty');
  assert.equal(m.calls.some((c) => c.startsWith('replace')), false);
});

test('받은 파일이 기록과 크기가 다르면 전송을 중단한다 — 장비는 건드리지 않는다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [imageAd('ad_i', 1234)], dlSize: 999 });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'error');
  assert.match(r.message, /크기가 기록과 다릅니다/);
  assert.equal(m.calls.length, 0);
  assert.equal(m.states[m.states.length - 1].result, 'fail');
});

test('같은 판은 3번까지만 다시 해 보고 멈춘다 — 새 판이 오면 다시 시작한다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [imageAd('ad_i', 1234)], dlSize: 5 });
  for (let i = 0; i < 3; i++) { assert.equal((await R.runRound(m.ctx)).action, 'error'); }
  const n = m.downloads();
  assert.equal((await R.runRound(m.ctx)).action, 'gave-up');
  assert.equal(m.downloads(), n, '포기한 판은 더 받지 않는다');
  m.world.version = 2; m.world.ads = [ad('ad_ok')];
  assert.equal((await R.runRound(m.ctx)).action, 'sent');
});

test('파일 내려받기가 실패(창고 주소 만료·삭제)해도 장비는 건드리지 않고 «실패»로 알린다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [imageAd('ad_i', 1234)] });
  m.ctx.download = async () => { throw new Error('파일 내려받기 실패 (HTTP 403)'); };
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'error'); assert.match(r.message, /HTTP 403/);
  assert.equal(m.calls.some((c) => c.startsWith('replace') || c.startsWith('upload')), false);
  assert.equal(m.states[m.states.length - 1].result, 'fail');
});

test('포털을 못 읽어도(firebase CLI 로그인 풀림) 멈추지 않고 «오류로 알릴 뿐»이다 — 기록도 못 쓰면 로그만', async () => {
  const m = make({ control: { firstReplaceConfirmed: true } });
  const logs = [];
  m.ctx.log = (x) => logs.push(x);
  m.ctx.store.readVersion = () => { throw new Error('Error: Failed to authenticate, have you run firebase login?'); };
  m.ctx.store.writeState = () => { throw new Error('Error: Failed to authenticate, have you run firebase login?'); };
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'error');
  assert.equal(m.calls.length, 0, '장비는 건드리지 않는다');
  assert.ok(logs.some((x) => /상태를 기록하지 못했습니다/.test(x)), '기록 실패는 로그에 남는다');
  assert.equal(r.version, null, '판을 알기 전의 오류는 «판별 실패 횟수»에 세지 않는다');
  assert.deepEqual(m.local.failures, {});
});

test('오류 글에서 열쇠 값이 지워진다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true } });
  m.ctx.makeDevice = () => ({ getDeviceProperty: async () => { throw new Error('인증 실패 sdkKey=KEY-123 secret=SECRET-456'); } });
  const r = await R.runRound(m.ctx);
  assert.equal(r.message.includes('KEY-123'), false);
  assert.equal(r.message.includes('SECRET-456'), false);
  assert.equal(JSON.stringify(m.states).includes('SECRET-456'), false);
});

test('허용되지 않은 파일 주소는 내려받지 않는다', async () => {
  const bad = imageAd('ad_i', 1234); bad.media.url = 'https://evil.example/a.jpg';
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [] });
  m.world.version = 1;
  m.ctx.store.readPublished = () => ({ version: 1, ads: [C.snapshotAd(bad)] });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'error'); assert.match(r.message, /허용되지 않은 파일 주소/);
  assert.equal(m.downloads(), 0);
});

test('장비가 꺼져 있어도 «멈춤 없이» 알린다(실전 심장박동)', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, deviceDown: true });
  m.local.lastSentVersion = 1;
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'idle');
  const st = m.states[m.states.length - 1];
  assert.equal(st.deviceReachable, false);
  assert.match(st.deviceError, /ECONNREFUSED/);
});

test('심장박동은 5분에 한 번만 쓴다', async () => {
  const m = make({ dryRun: true, noDevice: true });
  await R.runRound(m.ctx);                      // dry-run 기록 1건
  const n = m.states.length;
  m.world.clock += 60000;  await R.runRound(m.ctx);
  assert.equal(m.states.length, n, '1분 뒤에는 쓰지 않는다');
  m.world.clock += 6 * 60000; await R.runRound(m.ctx);
  assert.equal(m.states.length, n + 1, '5분이 지나면 쓴다');
});
