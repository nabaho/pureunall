/* 카톡 업무방 알림 받기 (2026-10-09) — 폰·서버·화면이 «같은 잣대»를 쓰는지 본다.
   대표 지시 2026-10-09 「카톡에 내용 올린 담당자들의 업무도 모두 자동 정리하고 싶다」 → 「니가 진행해라」.
   ⚠ 예시 이름은 모두 가짜다(홍길동·임꺽정·가나상사). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const K = require('../js/pu-kakao-work.js');
const JAVA = 'android/hana-sms-bridge/app/src/main/java/kr/pureun/hanabridge/';

/* ── 가리개 ─────────────────────────────────────────────────────────── */
test('주민번호·카드·계좌는 가리고 전화번호는 남긴다', () => {
  const out = K.maskSensitive('홍길동 900101-1234567 / 카드 1111-2222-3333-4444 / 계좌 123-456789-01-234 / 연락 010-1111-2222 / 02-123-4567');
  assert.ok(!/900101-1234567/.test(out), '주민번호가 남았다');
  assert.ok(!/1111-2222-3333-4444/.test(out), '카드번호가 남았다');
  assert.ok(!/123-456789-01-234/.test(out), '계좌가 남았다');
  assert.ok(/010-1111-2222/.test(out), '휴대전화를 지웠다 — 업무 연락에 필요하다');
  assert.ok(/02-123-4567/.test(out), '유선번호를 지웠다');
});

test('짧은 숫자 묶음(날짜·사건번호 꼴)은 계좌로 보지 않는다', () => {
  assert.strictEqual(K.maskSensitive('2026-10-16 까지'), '2026-10-16 까지');
});

/* 폰(Java)과 화면·서버(JS)의 식이 «글자 그대로» 같아야 한다 — 한쪽만 고치면 폰이 흘린 것을
   서버가 못 막거나, 서버가 가린 것과 폰이 가린 것이 달라 중복 열쇠가 갈린다. */
test('폰 KakaoNotice.java 의 가리개 식이 js/pu-kakao-work.js 와 같다', () => {
  const java = read(JAVA + 'KakaoNotice.java');
  const pick = (name) => {
    const m = new RegExp('static final String ' + name + ' = "((?:[^"\\\\]|\\\\.)*)";').exec(java);
    assert.ok(m, name + ' 식을 못 찾았다');
    return m[1].replace(/\\\\/g, '\\');
  };
  assert.strictEqual(pick('RRN'), K.RRN_RE.source);
  assert.strictEqual(pick('CARD'), K.CARD_RE.source);
  assert.strictEqual(pick('ACCOUNT'), K.ACCOUNT_RE.source);
  assert.strictEqual(pick('PHONE'), K.PHONE_RE.source);
});

test('서버 사본(functions/kakao-lib)이 js/ 원본과 한 글자도 다르지 않다', () => {
  assert.strictEqual(read('functions/kakao-lib/pu-kakao-work.js'), read('js/pu-kakao-work.js'),
    '고친 뒤 node scripts/sync-kakao-lib.js 를 돌릴 것');
});

/* ── 방 이름 ───────────────────────────────────────────────────────── */
test('방은 «정확히» 같을 때만 — 비슷한 이름·빈 목록은 받지 않는다', () => {
  assert.strictEqual(K.roomAllowed(['가나상사 급여'], ' 가나상사  급여 '), true);
  assert.strictEqual(K.roomAllowed(['가나상사'], '가나상사 급여'), false);
  assert.strictEqual(K.roomAllowed([], '가나상사'), false);
  assert.strictEqual(K.roomAllowed(null, '가나상사'), false);
});

/* ── 갈래·묶기 ─────────────────────────────────────────────────────── */
test('갈래: [전달] 한 줄은 확실, 서명은 짐작, 사진은 사진', () => {
  assert.deepStrictEqual(K.classify('[전달] 가나상사 임꺽정 과장'), { kind: 'mark', origin: '가나상사 임꺽정 과장', sure: true });
  const g = K.classify('리플렛 검토 부탁드립니다.\n가나시 사무국장 홍길동 배상');
  assert.strictEqual(g.kind, 'guess');
  assert.strictEqual(g.sure, false);
  assert.ok(/홍길동 배상/.test(g.origin));
  assert.strictEqual(K.classify('사진을 보냈습니다.').kind, 'media');
  assert.strictEqual(K.classify('마바건설 급여대장 발송 완료').kind, 'own');
});

test('같은 직원이 2분 안에 올린 [전달]+글+사진은 한 건, 원래 보낸 곳은 [전달] 줄에서', () => {
  const t = Date.UTC(2026, 9, 9, 2, 0, 0);
  const notes = [
    { id: 'a', room: '업무방', sender: '김철수', sentAt: t, text: '[전달] 가나상사 임꺽정 과장' },
    { id: 'b', room: '업무방', sender: '김철수', sentAt: t + 20000, text: '입사자 2명 취득신고 부탁드립니다' },
    { id: 'c', room: '업무방', sender: '김철수', sentAt: t + 40000, text: '사진 2장을 보냈습니다.' },
    { id: 'd', room: '업무방', sender: '이영희', sentAt: t + 50000, text: '급여대장 발송 완료' },
    { id: 'e', room: '업무방', sender: '김철수', sentAt: t + 10 * 60000, text: '따로 쓴 글' },
  ];
  const g = K.groupBursts(notes);
  assert.strictEqual(g.length, 3, "묶음 수가 다르다 — 김철수 두 묶음 + 이영희 한 묶음");
  const first = g.find((x) => x.ids.includes('a'));
  assert.deepStrictEqual(first.ids, ['a', 'b', 'c']);
  assert.strictEqual(first.kind, 'mark');
  assert.strictEqual(first.sure, true);
  assert.strictEqual(first.origin, '가나상사 임꺽정 과장');
  assert.deepStrictEqual(first.texts, ['입사자 2명 취득신고 부탁드립니다'], '[전달] 줄이 내용으로 섞였다');
  assert.strictEqual(first.media, 2);
  assert.ok(g.find((x) => x.ids.includes('e') && x.ids.length === 1), '10분 뒤 글이 앞 묶음에 붙었다');
});

test('기한: 「10월 16일까지」「10/16까지」를 읽고, 없으면 지어내지 않는다', () => {
  const now = new Date(2026, 9, 9).getTime();
  assert.strictEqual(K.findDue('PPT 자료를 10월 16일까지 보내 주세요', now), '2026-10-16');
  assert.strictEqual(K.findDue('10/16까지 회신', now), '2026-10-16');
  assert.strictEqual(K.findDue('검토 부탁드립니다', now), '');
  /* 12월에 「1월 5일까지」는 다음 해다 */
  assert.strictEqual(K.findDue('1월 5일까지', new Date(2026, 11, 20).getTime()), '2027-01-05');
});

/* ── 폰 ────────────────────────────────────────────────────────────── */
test('폰: 카톡 알림은 하나 거래 그물보다 «먼저» 갈라 나가고, 방 목록을 거친다', () => {
  const l = read(JAVA + 'HanaNotificationListener.java');
  const onPosted = l.slice(l.indexOf('onNotificationPosted'));
  const k = onPosted.indexOf('BridgeConfig.KAKAO_PACKAGE.equals(packageName)');
  const h = onPosted.indexOf('HanaMessageFilter.isTransaction');
  assert.ok(k > 0 && h > 0 && k < h, '카톡 글이 하나 거래 그물로 흘러간다 — 단톡방의 「하나 … 입금 … 원」이 거래로 잡힌다');
  assert.match(l, /KakaoRooms\.allowed\(this,\s*parsed\.room\)/, '방 목록을 안 거치고 보낸다');
  assert.match(read(JAVA + 'BridgeConfig.java'), /KAKAO_PACKAGE = "com\.kakao\.talk"/);
});

test('폰: 방 목록은 서버 답에서만 받고, 답에 목록이 없으면 가진 것을 지우지 않는다', () => {
  const r = read(JAVA + 'KakaoRooms.java');
  assert.match(r, /if \(context == null \|\| response == null \|\| !response\.has\("kakaoRooms"\)\) return;/);
  assert.match(read(JAVA + 'HanaSweepWorker.java'), /KakaoRooms\.absorb\(context, HanaUploadWorker\.post\(ping, token\)\)/);
  assert.match(read(JAVA + 'MainActivity.java'), /KakaoRooms\.absorb\(this, HanaUploadWorker\.post\(ping/);
});

test('폰: 판 번호가 세 곳에서 같다(build.gradle · BridgeConfig) — 2.4.0 이상', () => {
  const g = /versionName = "(\d+)\.(\d+)\.(\d+)"/.exec(read('android/hana-sms-bridge/app/build.gradle.kts'));
  const c = /APP_VERSION = "([\d.]+)"/.exec(read(JAVA + 'BridgeConfig.java'));
  assert.ok(g && c);
  assert.strictEqual(c[1], g.slice(1).join('.'));
  assert.ok(Number(g[1]) * 100 + Number(g[2]) >= 204, '카톡 받기가 든 판이 아니다');
});

/* ── 서버 ──────────────────────────────────────────────────────────── */
/* ★ 2026-10-09 에 잡은 고장: sweepPing 이 requireFinanceStaff «뒤»에 있어 폰(Device 열쇠)의 인사가
   만든 날부터 한 번도 통과하지 못했다. 카톡 방 목록이 그 답으로 내려가니 다시 막히면 폰이 목록을 못 받는다. */
test('서버: sweepPing·kakaoIngest 는 재무 담당자 검사보다 앞에 있다(폰은 로그인 표가 없다)', () => {
  const src = read('functions/index.js');
  const fn = src.slice(src.indexOf('exports.hanaMessageBridge'));
  const staff = fn.indexOf('const staff = await requireFinanceStaff(req);');
  for (const a of ['sweepPing', 'kakaoIngest']) {
    const at = fn.indexOf(`if (action === "${a}")`);
    assert.ok(at > 0, a + ' 갈래가 없다');
    assert.ok(at < staff, a + ' 가 재무 담당자 검사 뒤에 있다 — 폰의 말이 401 로 튕긴다');
  }
  assert.match(fn, /hanaJson\(res, 200, \{ ok: true, pong: true, \.\.\.\(kakaoRooms \? \{ kakaoRooms \} : \{\}\) \}\)/);
});

test('서버: 화면용 카톡 갈래(kakaoList·kakaoRooms·kakaoRoomsSet)는 총괄관리자만', () => {
  const src = read('functions/index.js');
  for (const a of ['kakaoList', 'kakaoRooms', 'kakaoRoomsSet']) {
    const at = src.indexOf(`if (action === "${a}")`);
    assert.ok(at > 0, a + ' 가 없다');
    assert.match(src.slice(at, at + 160), /requireTotalAdmin\(req\)/, a + ' 에 총괄관리자 검사가 없다');
  }
});

/* 작은 가짜 RTDB — 서버 모듈이 쓰는 만큼만 */
function fakeDb(init) {
  const data = JSON.parse(JSON.stringify(init || {}));
  const parts = (p) => String(p).split('/').filter(Boolean);
  const get = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), data);
  const put = (p, v) => {
    const ks = parts(p); let o = data;
    ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  const snap = (key, v) => ({
    key, val: () => (v === undefined ? null : v), exists: () => v !== undefined && v !== null,
    forEach: (cb) => { Object.keys(v || {}).sort().forEach((k) => cb(snap(k, v[k]))); },
  });
  function ref(p) {
    const q = { start: null, end: null, first: null };
    const r = {
      once: async () => {
        let v = get(p);
        if (v && typeof v === 'object' && (q.start !== null || q.end !== null || q.first !== null)) {
          let ks = Object.keys(v).sort();
          if (q.start !== null) ks = ks.filter((k) => k >= q.start);
          if (q.end !== null) ks = ks.filter((k) => k <= q.end);
          if (q.first !== null) ks = ks.slice(0, q.first);
          const o = {}; ks.forEach((k) => { o[k] = v[k]; }); v = o;
        }
        return snap(parts(p).pop(), v);
      },
      orderByKey: () => r,
      startAt: (x) => { q.start = x; return r; },
      endAt: (x) => { q.end = x; return r; },
      limitToFirst: (n) => { q.first = n; return r; },
      set: async (v) => put(p, v),
      update: async (o) => { Object.keys(o).forEach((k) => put(p + '/' + k, o[k])); },
    };
    return r;
  }
  return { ref, data };
}

test('서버: 목록 밖 방은 «아무것도» 안 남긴다 — 방 이름조차', async () => {
  const W = require('../functions/kakao-work-server.js');
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', Date.now());
  const out = await W.ingest(db, { device: {} }, { room: '가족 단톡', items: [{ sender: '홍길동', text: '저녁 뭐 먹어', time: Date.now() }] }, Date.now());
  assert.strictEqual(out.ignored, true);
  assert.strictEqual(db.data.kakaoWork.notes, undefined, '목록 밖 방의 글이 저장됐다');
  assert.ok(!JSON.stringify(db.data).includes('가족 단톡'), '목록 밖 방 이름이 서버에 남았다');
});

test('서버: 목록 안 방은 가려서 담고, 같은 글은 한 번만, 30일 지난 날짜 칸은 지운다', async () => {
  const W = require('../functions/kakao-work-server.js');
  const now = Date.UTC(2026, 9, 9, 3, 0, 0);
  const old = W.dayKey(now - 40 * 86400000);
  const db = fakeDb({ kakaoWork: { notes: { [old]: { x: { id: 'x', text: '옛것' } } } } });
  await W.setRooms(db, ['푸른 업무방'], 'u1', now);
  const item = { sender: '김철수', text: '[전달] 가나상사 임꺽정 과장\n주민번호 900101-1234567', time: now - 60000 };
  const a = await W.ingest(db, { device: { deviceName: '권형하 휴대폰' } }, { room: '푸른 업무방', items: [item, item] }, now);
  assert.strictEqual(a.saved, 1);
  assert.strictEqual(a.duplicate, 1);
  const b = await W.ingest(db, { device: {} }, { room: '푸른 업무방', items: [item] }, now + 1000);
  assert.strictEqual(b.saved, 0, '카톡이 덧쌓아 다시 띄운 같은 글이 또 담겼다');
  const days = db.data.kakaoWork.notes;
  assert.strictEqual(days[old], undefined, '보관기한(30일)이 지난 날짜 칸이 남았다');
  const rows = Object.values(days[W.dayKey(now - 60000)]);
  assert.strictEqual(rows.length, 1);
  assert.ok(!rows[0].text.includes('900101-1234567'), '서버가 주민번호를 안 가렸다');
  assert.strictEqual(rows[0].entityType, 'Message');
  assert.strictEqual(rows[0].originSystem, 'kakaotalk');
  assert.deepStrictEqual(a.kakaoRooms, ['푸른 업무방'], '답에 방 목록이 없다 — 폰이 목록을 못 받는다');
  const listed = await W.list(db, 1, now);
  assert.strictEqual(listed.items.length, 1);
});

/* ── 화면 ──────────────────────────────────────────────────────────── */
test('화면: 💬 카톡정리 메뉴는 기본 숨김이고 총괄관리자 확인 뒤에만 보인다', () => {
  const w = read('work.html');
  assert.match(w, /id="nav-kakao" style="display:none"/);
  assert.match(w, /function kkNav\(\)\{[^}]*pcAmFin\(\)/);
  assert.match(w, /<script src="js\/pu-kakao-work\.js\?v=\d+"><\/script>/);
  /* 화면은 RTDB 를 직접 안 읽는다 — 규칙 없는 서버 전용 자리다 */
  assert.ok(!/ref\(['"]kakaoWork/.test(w), '화면이 kakaoWork 를 직접 읽는다');
});

test('화면: 「할 일로」는 창을 채워 열기만 하고, 업체 칸은 [전달] 표시(확실)일 때만 채운다', () => {
  const w = read('work.html');
  const f = w.slice(w.indexOf('function kkTask('), w.indexOf('function kkRoomsModal('));
  assert.match(f, /itemModal\(\);/);
  assert.ok(!/saveItem\(/.test(f), '할 일로가 사람 확인 없이 저장한다');
  assert.match(f, /if\(c&&g\.sure&&g\.origin\)/, '짐작한 이름으로 업체 칸을 채운다');
});
