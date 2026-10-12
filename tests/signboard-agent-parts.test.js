/* 전광판 심부름꾼 — 설정·저장소 길·장비 시계 (2026-10-12) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Cfg = require('../scripts/signboard-agent/config.js');
const Store = require('../scripts/signboard-agent/store.js');
const Clock = require('../scripts/signboard-agent/clock.js');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sbcfg-')); }

test('설정 — 파일이 없으면 «이유와 함께» 알린다', () => {
  const r = Cfg.loadConfig(tmp());
  assert.equal(r.config, null);
  assert.match(r.errors[0], /설정 파일/);
});

test('설정 — 시험 모드는 열쇠가 없어도 되고, 실전 모드는 필요한 칸을 모두 요구한다', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ liveEnabled: false }));
  assert.deepEqual(Cfg.loadConfig(d).errors, []);
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ liveEnabled: true, deviceHost: '1.2.3.4:30080' }));
  const e = Cfg.loadConfig(d).errors.join('|');
  ['deviceId', 'sdkKey', 'sdkSecret'].forEach((k) => assert.ok(e.includes(k), k));
});

test('설정 — liveEnabled 는 정확히 true 일 때만 실전이다(글자 "true" 는 아니다)', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ liveEnabled: 'true' }));
  assert.equal(Cfg.loadConfig(d).config.liveEnabled, false);
});

test('설정 — 조사 간격은 20~600초 안으로 가둔다', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ pollSec: 1 }));
  assert.equal(Cfg.loadConfig(d).config.pollSec, 20);
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ pollSec: 99999 }));
  assert.equal(Cfg.loadConfig(d).config.pollSec, 600);
});

test('열쇠 값은 글에서 지우고, 설정을 보여 줄 때 가린다', () => {
  const c = { sdkKey: 'KEY-123', sdkSecret: 'SECRET-456' };
  assert.equal(Cfg.scrub('x KEY-123 y SECRET-456', c), 'x *** y ***');
  const r = Cfg.redactConfig(c);
  assert.equal(JSON.stringify(r).includes('SECRET-456'), false);
  assert.equal(JSON.stringify(r).includes('KEY-123'), false);
});

test('저장소 위치 — 환경변수로 바꿀 수 있고, 기본은 AppData 아래', () => {
  const mine = path.join('a', 'b');
  assert.equal(Cfg.homeDir({ PUREUN_SIGNBOARD_HOME: mine }), mine);
  assert.match(Cfg.homeDir({ APPDATA: path.join('x', 'AppData', 'Roaming') }), /pureun-signboard$/);
});

test('기록 파일 — 없으면 기본값, 쓰면 읽힌다', () => {
  const d = tmp();
  assert.equal(Cfg.readLocal(d).lastSentVersion, 0);
  Cfg.writeLocal(d, { lastSentVersion: 4, failures: { 5: 2 } });
  assert.equal(Cfg.readLocal(d).lastSentVersion, 4);
  assert.equal(Cfg.readLocal(d).failures[5], 2);
});

test('저장소 길 — 읽기는 database:get, null 은 null, 쓰기는 signboard/state 한 곳만', () => {
  const calls = [];
  const exec = (args) => {
    calls.push(args);
    if (args[1] === '/signboard/published/version') return '7\n';
    if (args[1] === '/signboard/published') return '{"version":7,"ads":[]}';
    if (args[1] === '/signboard/control') return 'null\n';
    return '';
  };
  const s = Store.createStore({ exec });
  assert.equal(s.readVersion(), 7);
  assert.equal(s.readPublished().version, 7);
  assert.deepEqual(s.readControl(), {});
  s.writeState({ a: 1 });
  const w = calls[calls.length - 1];
  assert.equal(w[0], 'database:update'); assert.equal(w[1], '/signboard/state');
  assert.ok(w.includes('--project') && w.includes('pureun-erp'));
  assert.ok(calls.every((c) => c[0] === 'database:get' || (c[0] === 'database:update' && c[1] === '/signboard/state')), '다른 자리에는 쓰지 않는다');
});

test('저장소 길 — 판이 아직 없으면 null', () => {
  const s = Store.createStore({ exec: () => 'null\n' });
  assert.equal(s.readVersion(), null);
});

test('장비 시계 — 한국 시간이고 맞으면 경고 없음', () => {
  const now = Date.UTC(2026, 9, 12, 3, 0, 0);
  const c = Clock.analyzeClock({ time: '2026-10-12 12:00:30', 'time.timeZone': 'Asia/Seoul;UTC+09:00;Seoul' }, now);
  assert.equal(c.known, true); assert.equal(c.tzIsKst, true); assert.equal(c.skewSec, 30);
  assert.equal(Clock.clockWarning(c), '');
});

test('장비 시계 — 중국 시간이면 «기간 예약이 어긋난다»고 알린다', () => {
  const now = Date.UTC(2026, 9, 12, 3, 0, 0);
  const c = Clock.analyzeClock({ time: '2026-10-12 11:00:00', 'time.timeZone': 'Asia/Shanghai;UTC+08:00;Beijing' }, now);
  assert.equal(c.tzIsKst, false); assert.equal(c.skewSec, 0);
  assert.match(Clock.clockWarning(c), /한국\(UTC\+9\)이 아닙니다/);
});

test('장비 시계 — 2분 넘게 틀리면 알리고, 읽지 못하면 «모름»이라 한다(0 으로 치지 않는다)', () => {
  const now = Date.UTC(2026, 9, 12, 3, 0, 0);
  const c = Clock.analyzeClock({ time: '2026-10-12 12:10:00', 'time.timeZone': 'Asia/Seoul;UTC+09:00;Seoul' }, now);
  assert.match(Clock.clockWarning(c), /10분 어긋/);
  const u = Clock.analyzeClock({}, now);
  assert.equal(u.known, false);
  assert.match(Clock.clockWarning(u), /읽지 못했습니다/);
});
