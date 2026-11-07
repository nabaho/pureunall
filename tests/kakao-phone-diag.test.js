/* 카톡 업무방 «폰 알림 길» 점검 (2026-11-07) — 왜 0건인지 화면이 말하고, 폰은 «센 숫자»만 보낸다.
   대표 지시 2026-11-07 「카카오톡의 자료를 자동으로 가지고 올 수 있게, 가지고 왔을 경우 문제가 되지 않도록」
   → 위반 없는 자동 길(폰 알림)을 살린다. 실측(11/07): 받을 방 등록(10/9) 뒤 카톡 0건 · 폰 앱은 살아 있음.
   ⚠ 예시 이름은 모두 가짜다. 방 이름(개인 대화방 포함)은 서버로 보내지 않는다 — 그것을 이 검사가 지킨다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').split('\r\n').join('\n');
const K = require('../js/pu-kakao-work.js');
const JAVA = 'android/hana-sms-bridge/app/src/main/java/kr/pureun/hanabridge/';

const NOW = Date.UTC(2026, 10, 7, 5, 0, 0);
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const alive = (extra) => Object.assign({ deviceName: '점검 휴대폰', appVersion: '2.5.1', lastSweepAt: NOW - 5 * MIN, lastTalkAt: NOW - 5 * MIN }, extra || {});

/* ── 판단(순수) ─────────────────────────────────────────────────────── */
test('폰이 없으면 «연결 안 됨», 안부가 오래 끊겼으면 «앱이 멈춤»', () => {
  assert.strictEqual(K.phoneDiagnosis(null, NOW).level, 'none');
  const d = K.phoneDiagnosis(alive({ lastSweepAt: NOW - 3 * HOUR, lastTalkAt: NOW - 3 * HOUR }), NOW);
  assert.strictEqual(d.level, 'bad');
  assert.match(d.title, /멈춘/);
});

test('업무방 알림이 최근에 왔으면 «정상»', () => {
  const d = K.phoneDiagnosis(alive({ kakaoLastAt: NOW - 2 * HOUR }), NOW);
  assert.strictEqual(d.level, 'ok');
});

test('새 앱(센 숫자 있음): 카톡 알림이 하나도 안 떴으면 PC 카톡 설정을 짚는다', () => {
  const d = K.phoneDiagnosis(alive({ kakaoSeen: 0, kakaoListed: 0, kakaoNear: 0, kakaoNoRoom: 0 }), NOW);
  assert.strictEqual(d.level, 'warn');
  assert.match(d.title, /한 번도 안 떴/);
  assert.match(d.fix, /PC 카톡/);
});

test('새 앱: 업무방과 이름이 «비슷하지만 다른» 알림만 버렸으면 «프로그램이 고칠 일»로 말한다', () => {
  const d = K.phoneDiagnosis(alive({ kakaoSeen: 9, kakaoListed: 0, kakaoNear: 4, kakaoNearKind: 'extra' }), NOW);
  assert.strictEqual(d.level, 'bad');
  assert.match(d.title, /방 이름/);
  assert.match(d.fix, /프로그램/);
});

test('새 앱: 다른 방 알림만 왔으면 업무방 알림이 꺼졌는지 보게 한다', () => {
  const d = K.phoneDiagnosis(alive({ kakaoSeen: 7, kakaoListed: 0, kakaoNear: 0 }), NOW);
  assert.strictEqual(d.level, 'warn');
  assert.match(d.title, /다른 방/);
  assert.match(d.fix, /업무방 알림/);
});

test('새 앱: 업무방 알림을 봤는데 서버 기록이 없으면 «보내지 못함»', () => {
  const d = K.phoneDiagnosis(alive({ kakaoSeen: 3, kakaoListed: 3, kakaoNear: 0 }), NOW);
  assert.strictEqual(d.level, 'warn');
  assert.match(d.title, /보내지 못/);
});

test('옛 앱(센 숫자 없음): 한 번도 못 받았으면 PC 카톡 설정과 새 앱 깔기를 함께 권한다 — 오늘 대표님 폰이 이 경우', () => {
  const d = K.phoneDiagnosis(alive({ appVersion: '2.4.0' }), NOW);
  assert.strictEqual(d.level, 'warn');
  assert.match(d.title, /한 번도 못 받/);
  assert.match(d.fix, /PC 카톡/);
  assert.match(d.fix, /덮어/);
  const old = K.phoneDiagnosis(alive({ appVersion: '2.4.0', kakaoLastAt: NOW - 5 * DAY }), NOW);
  assert.strictEqual(old.level, 'warn');
  assert.match(old.title, /5일 전/);
});

test('폰 여럿이면 가장 최근에 말을 건 폰으로 판단하고, 꺼 둔 폰은 뺀다', () => {
  const list = [alive({ deviceName: '옛 폰', lastTalkAt: NOW - 2 * DAY, lastSweepAt: NOW - 2 * DAY }),
    alive({ deviceName: '새 폰', kakaoLastAt: NOW - HOUR }), alive({ deviceName: '꺼 둔 폰', disabled: true, lastTalkAt: NOW })];
  assert.strictEqual(K.pickPhone(list).deviceName, '새 폰');
  assert.strictEqual(K.pickPhone([]), null);
});

test('서버 사본(functions/kakao-lib)이 js/ 원본과 한 글자도 다르지 않다', () => {
  assert.strictEqual(read('functions/kakao-lib/pu-kakao-work.js'), read('js/pu-kakao-work.js'), '고친 뒤 node scripts/sync-kakao-lib.js');
});

/* ── 폰(Java) — 센 숫자만, 방 이름은 안 보낸다 ─────────────────────── */
test('폰: 카톡 알림을 «거르기 전에» 센다 — 버린 것도 셀 수 있어야 왜 0인지 안다', () => {
  const l = read(JAVA + 'HanaNotificationListener.java');
  const f = l.slice(l.indexOf('private void onKakao('));
  const tally = f.indexOf('KakaoTally.record(');
  const filter = f.indexOf('KakaoRooms.allowed(');
  assert.ok(tally > 0 && filter > 0 && tally < filter, '거른 뒤에 세면 버린 것이 안 셈에 든다');
});

test('폰: 15분 안부에 센 숫자를 싣고, 방 이름은 싣지 않는다(개인 대화방 이름이 서버로 가면 안 된다)', () => {
  const sweep = read(JAVA + 'HanaSweepWorker.java');
  assert.match(sweep, /KakaoTally\.put\(context,\s*ping\)/);
  const t = read(JAVA + 'KakaoTally.java');
  for (const k of ['kakaoSeen', 'kakaoListed', 'kakaoNear', 'kakaoNoRoom', 'kakaoSeenAt']) assert.match(t, new RegExp('"' + k + '"'));
  /* 안부에 싣는 것은 숫자들과 «어떻게 달랐나»(정해진 낱말 둘) 하나뿐이다 */
  const puts = t.match(/ping\.put\("[A-Za-z]+",[^;]*;/g) || [];
  assert.ok(puts.length >= 5, '센 숫자를 싣는 줄이 없다');
  /* 싣는 값은 «센 숫자 보관함»의 정해진 칸뿐이어야 한다 — 방 이름이 든 변수를 싣는 길이 없다 */
  for (const p of puts) {
    assert.match(p.replace(/^ping\.put\("[A-Za-z]+",/, ''), /^\s*p\.get(Int|Long|String)\("(seen|listed|near|noRoom|seenAt|nearKind)",/, '정해진 칸이 아닌 값을 싣는다: ' + p);
  }
  assert.ok(!/putString\("[^"]*room/i.test(t), '방 이름을 폰 안에도 적어 둔다');
  assert.match(t, /"extra"/);
  assert.match(t, /"spacing"/);
});

test('폰: 판 번호가 두 곳에서 같고 2.5.1 이상이다(센 숫자가 든 판)', () => {
  const g = /versionName = "(\d+)\.(\d+)\.(\d+)"/.exec(read('android/hana-sms-bridge/app/build.gradle.kts'));
  const c = /APP_VERSION = "([\d.]+)"/.exec(read(JAVA + 'BridgeConfig.java'));
  assert.ok(g && c);
  assert.strictEqual(c[1], g.slice(1).join('.'));
  assert.ok(Number(g[1]) * 10000 + Number(g[2]) * 100 + Number(g[3]) >= 20501, '센 숫자가 든 판(2.5.1) 아래다');
  assert.strictEqual(K.KAKAO_TALLY_SINCE, '2.5.1', '화면이 «새 앱»을 가르는 판 번호가 센 숫자가 처음 든 판과 어긋난다'); // 검사고정-허용: 센 숫자가 «처음» 든 판 — 뒤 판이 나와도 바뀌지 않는다
});

/* ── 서버 ──────────────────────────────────────────────────────────── */
test('서버: 안부(sweepPing)가 센 숫자를 «숫자일 때만» 기기 기록에 적는다(옛 판은 모름으로 둔다)', () => {
  const src = read('functions/index.js');
  const at = src.indexOf('if (action === "sweepPing")');
  const f = src.slice(at, src.indexOf('hanaJson(res, 200, { ok: true, pong: true', at));
  for (const k of ['kakaoSeen', 'kakaoListed', 'kakaoNear', 'kakaoNoRoom', 'kakaoSeenAt']) {
    assert.match(f, new RegExp('typeof body\\.' + k + ' === "number"'), k + ' 를 숫자인지 안 보고 적는다');
  }
  assert.match(f, /kakaoNearKind/);
  assert.ok(!/body\.room|kakaoRoom\b/.test(f), '안부에서 방 이름을 받아 적는다');
});

test('서버: 폰 상태(pairStatus)가 카톡 기록과 센 숫자를 돌려준다', () => {
  const src = read('functions/index.js');
  const at = src.indexOf('if (action === "pairStatus")');
  const f = src.slice(at, src.indexOf('if (action === "pairReset")', at));
  for (const k of ['kakaoLastAt', 'kakaoSeen', 'kakaoListed', 'kakaoNear', 'kakaoNoRoom', 'kakaoSeenAt', 'kakaoNearKind']) {
    assert.match(f, new RegExp(k + ':'), 'pairStatus 가 ' + k + ' 를 안 준다');
  }
});

/* ── 화면 ──────────────────────────────────────────────────────────── */
test('화면: 💬 대화 탭 맨 위에 폰 상태 한 줄 — 판단은 공용 함수 한 곳(phoneDiagnosis)', () => {
  const w = read('work.html');
  assert.match(w, /<script src="js\/pu-kakao-work\.js\?v=\d+"><\/script>/);
  const talk = w.slice(w.indexOf('function kkTalkHtml('));
  assert.match(talk.slice(0, 600), /kkPhoneHtml\(\)/, '대화 탭에 폰 상태 줄이 없다');
  const body = (name) => { const a = w.indexOf('function ' + name + '('); assert.ok(a > 0, name + ' 가 없다'); return w.slice(a, w.indexOf('\nfunction ', a + 10)); };
  const ph = body('kkPhoneHtml');
  assert.match(ph, /phoneDiagnosis\(/, '판단을 화면에서 다시 짓는다');
  assert.match(ph, /esc\(/, '서버에서 온 글을 그대로 넣는다');
  const load = body('kkPhoneLoad');
  assert.match(load, /kkCall\('pairStatus'\)/);
  assert.match(load, /catch/, '폰 상태를 못 읽으면 화면이 멈춘다');
});
