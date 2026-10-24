/* 카톡 내보내기 — 가린 원문 30일 보관 서버 쪽 (2026-10-24)
   설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md (6장)
   ⚠ 예시 이름은 모두 가짜다(노무사A). 작은 가짜 RTDB 는 tests/kakao-work.test.js 의 것과 같은 꼴이다
     (그 파일은 건드리지 않는다). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const W = require('../functions/kakao-work-server.js');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const DAY = 86400000;
const ADMIN = { uid: 'admin1' };

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
  const reads = [];
  function ref(p) {
    const q = { start: null, end: null, first: null };
    const r = {
      once: async () => {
        reads.push(p);
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
  return { ref, data, reads };
}

const now = Date.UTC(2026, 9, 24, 3, 0, 0);
const allRows = (db) => Object.values(db.data.kakaoWork.notes || {}).flatMap((d) => Object.values(d));

test('목록 밖 방은 «아무것도» 안 남긴다 — 방 이름조차', async () => {
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', now);
  const out = await W.importExport(db, ADMIN, { room: '가족 단톡', items: [{ sender: '노무사A', text: '저녁', time: now - 1000 }] }, now);
  assert.strictEqual(out.ignored, true);
  assert.strictEqual(db.data.kakaoWork.notes, undefined);
  assert.ok(!JSON.stringify(db.data).includes('가족 단톡'), '목록 밖 방 이름이 서버에 남았다');
});

test('30일 밖 글·미래 글은 건너뛰고(시각을 «지금»으로 바꾸지 않는다), 안쪽 글은 제 시각으로 담는다', async () => {
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', now);
  const t29 = now - 29 * DAY;
  const out = await W.importExport(db, ADMIN, { room: '푸른 업무방', items: [
    { sender: '노무사A', text: '스물아홉 날 전', time: t29 },
    { sender: '노무사A', text: '서른한 날 전', time: now - 31 * DAY },
    { sender: '노무사A', text: '미래 글', time: now + 20 * 60000 },
  ] }, now);
  assert.strictEqual(out.saved, 1);
  assert.strictEqual(out.tooOld, 1);
  assert.strictEqual(out.future, 1);
  const rows = allRows(db);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].sentAt, t29, '시각이 바뀌었다 — 날짜 칸이 틀어진다');
  assert.ok(db.data.kakaoWork.notes[W.dayKey(t29)], '날짜 칸이 글의 날짜가 아니다');
});

test('주민번호는 서버가 한 번 더 가리고, 출처·올린 사람·개체 종류를 남긴다', async () => {
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', now);
  await W.importExport(db, ADMIN, { room: '푸른 업무방', items: [{ sender: '노무사A', text: '의뢰인 900101-1234567 연락', time: now - 60000 }] }, now);
  const [r] = allRows(db);
  assert.ok(!r.text.includes('900101-1234567'), '서버가 주민번호를 안 가렸다');
  assert.strictEqual(r.originSystem, 'kakaotalk-export');
  assert.strictEqual(r.importedBy, 'admin1');
  assert.strictEqual(r.entityType, 'Message');
  assert.strictEqual(r.room, '푸른 업무방');
});

test('같은 요청을 두 번 보내면 둘째는 새로 담기지 않는다', async () => {
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', now);
  const body = { room: '푸른 업무방', items: [1, 2, 3].map((i) => ({ sender: '노무사A', text: '글 ' + i, time: now - i * 60000 })) };
  const a = await W.importExport(db, ADMIN, body, now);
  const b = await W.importExport(db, ADMIN, body, now + 1000);
  assert.strictEqual(a.saved, 3);
  assert.deepStrictEqual({ s: b.saved, d: b.duplicate }, { s: 0, d: 3 });
  assert.strictEqual(allRows(db).length, 3);
});

test('한 번에 400건까지만 처리하고 넘친 만큼 알린다, 날짜 칸은 글마다가 아니라 하루에 한 번만 읽는다', async () => {
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', now);
  const items = Array.from({ length: 401 }, (_, i) => ({ sender: '노무사A', text: '글 ' + i, time: now - i * 1000 }));
  const out = await W.importExport(db, ADMIN, { room: '푸른 업무방', items }, now);
  assert.strictEqual(out.over, 1);
  assert.strictEqual(out.saved, W.IMPORT_ITEMS_MAX);
  assert.ok(W.IMPORT_ITEMS_MAX >= 100, '한 번에 보낼 수 있는 건수가 너무 작아 몇 주치를 못 올린다');
  const noteReads = db.reads.filter((p) => /^kakaoWork\/notes\/\d{8}$/.test(p));
  assert.ok(noteReads.length <= 3, '날짜 칸을 글마다 읽었다: ' + noteReads.length + '번');
});

test('보낼 글이 0건이어도 방 확인은 한다 — 목록 밖 방이면 무시, 안 방이면 ok(화면이 서버가 동작을 아는지 보는 데 쓴다)', async () => {
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', now);
  const ok = await W.importExport(db, ADMIN, { room: '푸른 업무방', items: [] }, now);
  assert.deepStrictEqual({ ok: ok.ok, saved: ok.saved, over: ok.over }, { ok: true, saved: 0, over: 0 });
  const no = await W.importExport(db, ADMIN, { room: '가족 단톡', items: [] }, now);
  assert.strictEqual(no.ignored, true);
  assert.strictEqual(db.data.kakaoWork.notes, undefined);
});

test('list 가 글의 출처(src)를 준다 — 내보내기는 export, 알림 길은 alert', async () => {
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', now);
  await W.importExport(db, ADMIN, { room: '푸른 업무방', items: [{ sender: '노무사A', text: '내보낸 글', time: now - 60000 }] }, now);
  await W.ingest(db, { device: {} }, { room: '푸른 업무방', items: [{ sender: '노무사A', text: '알림 글', time: now - 30000 }] }, now);
  const listed = await W.list(db, 1, now);
  const by = Object.fromEntries(listed.items.map((x) => [x.text, x.src]));
  assert.strictEqual(by['내보낸 글'], 'export');
  assert.strictEqual(by['알림 글'], 'alert');
});

test('서버 동작 kakaoImport 는 총괄관리자만이고, 폰 안부·재무 검사보다 앞에 있다', () => {
  const src = read('functions/index.js');
  const at = src.indexOf('if (action === "kakaoImport")');
  assert.ok(at > 0, 'kakaoImport 동작이 없다');
  assert.match(src.slice(at, at + 160), /requireTotalAdmin\(req\)/, '총괄관리자 검사가 없다');
  assert.ok(at < src.indexOf('const staff = await requireFinanceStaff(req);'), '재무 담당자 검사 뒤에 있다');
  assert.match(src.slice(at, at + 400), /KakaoWork\.importExport\(/);
});
