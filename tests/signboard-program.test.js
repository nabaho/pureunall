/* 전광판 심부름꾼 — 광고 → 灰度 프로그램 JSON (2026-10-12)
   장비가 받는 키 이름·효과 번호·요일 철자는 «값 자체가 규칙»(灰度 공식 문서 3.2)이라 박는 것이 맞다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-signboard-core.js');
const P = require('../scripts/signboard-agent/program.js');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/signboard%2Fa.mp4?alt=media&token=t';
const SCREEN = { width: 192, height: 96 };
function text(over) { const a = C.newAd('text', { id: 'ad_t', order: 1 }); a.title = '상담'; a.text.string = '무료상담'; return Object.assign(a, over || {}); }
function media(kind, id) { const a = C.newAd(kind, { id: id, order: 2 }); a.title = '파일'; a.media = Object.assign(a.media, { url: URL_OK, size: 999, name: 'a.' + kind }); return a; }

test('글자 광고 — 화면 전체 한 칸, 효과·글꼴이 들어간다', () => {
  const a = text(); a.text.holdSec = 7; a.text.effectType = 1; a.text.color = '#ff0000'; a.text.bold = true; a.text.size = 32;
  const prog = P.adToProgram(C.snapshotAd(a), SCREEN, {});
  assert.equal(prog.uuid, 'ad_t'); assert.equal(prog.name, '상담'); assert.equal(prog.type, 'normal');
  const area = prog.area[0];
  assert.deepEqual([area.x, area.y, area.width, area.height], [0, 0, 192, 96]);
  const it = area.item[0];
  assert.equal(it.type, 'text'); assert.equal(it.string, '무료상담');
  assert.deepEqual(it.font, { size: 32, bold: true, color: '#ff0000' });
  assert.deepEqual(it.effect, { type: 1, speed: 5, hold: 7000 }, '머무는 시간은 초 → 밀리초');
  assert.equal(prog.playControl, undefined, '기간이 없으면 playControl 이 없다(늘)');
});

test('줄바꿈이 있는 문구는 multiLine 이다', () => {
  const a = text(); a.text.string = '첫 줄\n둘째 줄';
  assert.equal(P.adToProgram(C.snapshotAd(a), SCREEN, {}).area[0].item[0].multiLine, true);
});

test('사진·동영상 — 장비에 올린 파일 정보를 쓴다', () => {
  const up = { ad_i: { file: 'R-C.png', md5: 'a'.repeat(32), size: 21186 }, ad_v: { file: 'm.mp4', md5: 'b'.repeat(32), size: 777 } };
  const i = P.adToProgram(C.snapshotAd(media('image', 'ad_i')), SCREEN, up).area[0].item[0];
  assert.deepEqual([i.type, i.file, i.fileMd5, i.fileSize, i.fit], ['image', 'R-C.png', 'a'.repeat(32), 21186, 'fill']);
  assert.equal(i.effect.hold, 5000);
  const v = P.adToProgram(C.snapshotAd(media('video', 'ad_v')), SCREEN, up).area[0].item[0];
  assert.deepEqual([v.type, v.file, v.fileSize, v.aspectRatio], ['video', 'm.mp4', 777, true]);
});

test('올린 파일 정보가 없으면 «보내지 않고» 오류 — 빈 칸으로 보내지 않는다', () => {
  assert.throws(() => P.adToProgram(C.snapshotAd(media('image', 'ad_i')), SCREEN, {}), /파일 정보가 없습니다/);
});

test('기간 → playControl: 날짜·요일·시간대', () => {
  const a = text(); a.period = { start: '2026-10-13', end: '2026-10-20', weekdays: ['Mon', 'Thur'], times: [{ start: '09:00', end: '18:00' }, { start: '19:00', end: '21:30' }] };
  const pc = P.adToProgram(C.snapshotAd(a), SCREEN, {}).playControl;
  assert.deepEqual(pc.date, [{ start: '2026-10-13', end: '2026-10-20' }]);
  assert.deepEqual(pc.week, { enable: 'Mon,Thur' });
  assert.deepEqual(pc.time, [{ start: '09:00:00', end: '18:00:00' }, { start: '19:00:00', end: '21:30:00' }]);
});

test('요일을 7개 다 골랐으면 요일 제한을 걸지 않는다', () => {
  const a = text(); a.period = { start: '', end: '', weekdays: C.WEEKDAYS.slice(), times: [] };
  assert.equal(P.adToProgram(C.snapshotAd(a), SCREEN, {}).playControl, undefined);
});

test('한쪽만 적은 기간은 먼 날짜로 닫는다', () => {
  const a = text(); a.period = { start: '2026-11-01', end: '', weekdays: [], times: [] };
  assert.deepEqual(P.toPlayControl(a.period).date, [{ start: '2026-11-01', end: P.OPEN_END }]);
  const b = text(); b.period = { start: '', end: '2026-11-30', weekdays: [], times: [] };
  assert.deepEqual(P.toPlayControl(b.period).date, [{ start: P.OPEN_START, end: '2026-11-30' }]);
});

test('전체 교체 본문 — 순서가 그대로이고 장비 번호가 들어간다', () => {
  const ads = C.publishableAds([text({ id: 'ad_b', order: 2 }), text({ id: 'ad_a', order: 1 })]);
  const body = P.buildReplaceBody(ads, SCREEN, 'C16L-D00-A000F', {});
  assert.equal(body.method, 'replace'); assert.equal(body.id, 'C16L-D00-A000F');
  assert.deepEqual(body.data.map((p) => p.uuid), ['ad_a', 'ad_b']);
});

test('화면 크기를 모르면 자리표시 값을 쓰고, 그 사실을 밝힌다', () => {
  assert.equal(P.PLACEHOLDER_SCREEN.assumed, true);
  const body = P.buildReplaceBody(C.publishableAds([text()]), null, 'X', {});
  assert.equal(body.data[0].area[0].width, P.PLACEHOLDER_SCREEN.width);
});

test('mediaNeeds — 올려야 할 파일만 모은다', () => {
  const ads = C.publishableAds([text(), media('image', 'ad_i'), media('video', 'ad_v')]);
  const n = P.mediaNeeds(ads);
  assert.deepEqual(n.map((x) => x.adId).sort(), ['ad_i', 'ad_v']);
  assert.equal(n[0].url, URL_OK);
});
