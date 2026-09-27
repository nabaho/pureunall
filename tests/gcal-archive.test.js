/* 구글 공용 달력 «보관함» — 서버가 매일 베끼고, 누가 지워도 남는다 (2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 「푸른캘린더에는 이모든 일정을 모두 가지고 와서 저장하고 … 별도로 보관」 → 「추천대로」.

   ★ 규칙
     ① 구글 일정 → 보관 기록: 서울 날짜·시각, 종일 끝날은 하루 당김, 온톨로지 뼈대(id·entityType·revision)
     ② 구글에서 지워짐(cancelled) → 있던 기록은 «그대로 두고» 표만 단다. 없던 것은 못 살린다(건너뜀)
     ③ 안 바뀐 것은 되쓰지 않는다(gUpdated 같음)
     ④ 서버만 쓴다(규칙 .write:false), 읽기는 로그인한 직원, date 색인
     ⑤ 화면: 스위치를 켜면 지워진 것만 점선·취소선, 구글을 못 받으면 보관본으로 채운다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const G = require(path.join(ROOT, 'functions', 'gcal-archive.js'));
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

const 종일 = { id: 'e1', status: 'confirmed', summary: '최기운 연차', start: { date: '2026-09-21' }, end: { date: '2026-09-24' },
  updated: '2026-09-01T00:00:00Z', creator: { email: 'a@x' } };
const 시각 = { id: 'e2', status: 'confirmed', summary: '가나상사 미팅', location: '천안',
  start: { dateTime: '2026-10-05T01:00:00Z' }, end: { dateTime: '2026-10-05T02:30:00Z' }, updated: 'u1' };

test('① 종일 일정 — 끝날은 구글 end.date 에서 하루 당긴다', () => {
  const r = G.toRecord(종일, null, 1000, 3, 1);
  assert.equal(r.date, '2026-09-21');
  assert.equal(r.end, '2026-09-23');
  assert.equal(r.allDay, true);
  assert.equal(r.entityType, 'ScheduleEvent');
  assert.equal(r.revision, 1);
  assert.equal(r.sourceKind, 'gcal');
  assert.equal(r.sourceId, 'e1');
});

test('① 시각 일정 — 어느 시간대로 와도 서울 시각으로(UTC 01:00 → 10:00)', () => {
  const r = G.toRecord(시각, null, 1000, 3, 1);
  assert.equal(r.date, '2026-10-05');
  assert.equal(r.time, '10:00');
  assert.equal(r.endTime, '11:30');
  assert.equal(r.location, '천안');
});

test('②★ 구글에서 지워져도 보관 기록은 «그대로» — 표만 단다', () => {
  const 있던 = G.toRecord(시각, null, 1000, 3, 1);
  const r = G.updatesOf([{ id: 'e2', status: 'cancelled' }], { e2: 있던 }, 2000, 3, 1);
  const 새 = r.updates.e2;
  assert.ok(새, '지워진 것에 표를 안 달았습니다');
  assert.equal(새.googleDeleted, true);
  assert.equal(새.summary, '가나상사 미팅', '지워졌다고 내용을 지웠습니다 — 보관의 뜻이 없어집니다');
  assert.equal(새.revision, 2);
  assert.equal(r.지워짐, 1);
});

test('② 처음 보는 지워진 일정은 건너뛴다 — 구글이 내용을 안 준다', () => {
  const r = G.updatesOf([{ id: 'zz', status: 'cancelled' }], {}, 1, 3, 1);
  assert.deepStrictEqual(Object.keys(r.updates), []);
});

test('③ 안 바뀐 것은 되쓰지 않는다 — 매일 같은 것을 다시 쓰면 요금만 는다', () => {
  const 있던 = G.toRecord(시각, null, 1000, 3, 1);
  assert.deepStrictEqual(Object.keys(G.updatesOf([시각], { e2: 있던 }, 2, 3, 1).updates), []);
  const 고친 = Object.assign({}, 시각, { summary: '가나상사 미팅(변경)', updated: 'u2' });
  const r = G.updatesOf([고친], { e2: 있던 }, 3000, 3, 1);
  assert.equal(r.updates.e2.summary, '가나상사 미팅(변경)');
  assert.equal(r.updates.e2.createdAt, 1000, '처음 들어온 때가 바뀌었습니다');
  assert.equal(r.updates.e2.revision, 2);
});

test('④ 서버만 쓰고, 로그인한 직원이 읽고, 날짜로 찾는다', () => {
  const R = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'rules-paste.json'), 'utf8')).rules;
  const a = R.data.gcal_archive;
  assert.ok(a, '보관함 규칙이 없습니다');
  assert.strictEqual(a['.write'], false, '화면이 보관본을 고칠 수 있습니다');
  assert.ok(Array.isArray(a['.indexOn']) && a['.indexOn'].indexOf('date') >= 0, 'date 색인이 없습니다 — 달마다 통째로 받게 됩니다');
  assert.strictEqual(R.data.gcal_archive_meta['.write'], false);
  const idx = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  assert.match(idx, /exports\.gcalArchiveDaily\s*=/, '매일 도는 서버 함수가 밖으로 안 나갑니다(배포가 안 된다)');
});

test('⑤ 화면 — 스위치를 켜면 지워진 것만, 구글을 못 받으면 보관본으로', () => {
  const i = 캘린더.indexOf('var 보관 = (typeof ARCH');
  assert.ok(i >= 0, '보관함을 달력에 안 섞습니다');
  const 몸 = 캘린더.slice(i, i + 900);
  assert.match(몸, /GCAL\.err \|\| S\.showGone/, '두 때(못 받음·스위치)를 안 가릅니다');
  assert.match(몸, /지워짐 && S\.showGone/, '스위치가 꺼져도 지워진 것을 보여 줍니다');
  assert.match(캘린더, /orderByChild\("date"\)\.startAt\(첫날\)\.endAt\(끝날\)/, '보는 달만 받지 않습니다(보관함 통째 받기)');
});
