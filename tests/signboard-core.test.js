/* 전광판 규칙 모듈(pu-signboard-core.js) — 광고 검증·기간·올릴 판·되돌리기 (2026-10-12)
   ★ «지금 값»이 아니라 «규칙»을 본다. 값 자체가 규칙인 곳(요일 표기 Thur 등)은 같은 줄에 이유를 적는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-signboard-core.js');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/signboard%2Fa.jpg?alt=media&token=t';
function textAd(over) {
  return Object.assign(C.newAd('text', { id: 'ad_t1', order: 1 }), { title: '무료상담', text: Object.assign(C.newAd('text').text, { string: '부당해고 무료상담' }) }, over || {});
}
function imageAd(over) {
  const a = C.newAd('image', { id: 'ad_i1', order: 2 });
  a.title = '로고'; a.media = Object.assign(a.media, { url: URL_OK, size: 1234, name: 'a.jpg', contentType: 'image/jpeg' });
  return Object.assign(a, over || {});
}

test('정상 광고는 통과하고, 빈 제목·문구는 막는다', () => {
  assert.equal(C.validateAd(textAd()).ok, true);
  const r = C.validateAd(textAd({ title: ' ' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.field === 'title'));
  const r2 = C.validateAd(Object.assign(textAd(), { text: Object.assign(textAd().text, { string: '' }) }));
  assert.ok(r2.errors.some((e) => e.field === 'text.string'));
});

test('범위 밖 값을 «조용히 깎지 않고» 오류로 말한다', () => {
  const t = textAd(); t.text.size = 500; t.text.effectSpeed = 9; t.text.holdSec = 0; t.text.color = 'red';
  const f = C.validateAd(t).errors.map((e) => e.field);
  ['text.size', 'text.effectSpeed', 'text.holdSec', 'text.color'].forEach((k) => assert.ok(f.includes(k), k));
  assert.equal(C.normalizeAd(t).text.size, 500, 'normalize 는 값을 바꾸지 않는다');
});

test('사진·동영상은 우리 창고 주소와 크기가 있어야 한다', () => {
  assert.equal(C.validateAd(imageAd()).ok, true);
  const noUrl = imageAd(); noUrl.media.url = 'http://evil.example/a.jpg';
  assert.ok(C.validateAd(noUrl).errors.some((e) => e.field === 'media.url'));
  const noSize = imageAd(); noSize.media.size = 0;
  assert.ok(C.validateAd(noSize).errors.some((e) => e.field === 'media.size'));
  const big = imageAd(); big.media.size = C.MAX_IMAGE_BYTES + 1;
  assert.ok(C.validateAd(big).errors.some((e) => e.field === 'media.size'));
});

test('사진에는 글자 전용 효과를 못 쓴다', () => {
  const a = imageAd(); a.media.effectType = 26;
  assert.ok(C.validateAd(a).errors.some((e) => e.field === 'media.effectType'));
});

test('기간 — 날짜·요일·시간대 규칙', () => {
  const a = textAd(); a.period = { start: '2026-10-20', end: '2026-10-13', weekdays: ['Mon'], times: [] };
  assert.ok(C.validateAd(a).errors.some((e) => e.field === 'period.end'), '끝이 시작보다 빠르면 막는다');
  const b = textAd(); b.period = { start: '2026-13-40', end: '', weekdays: [], times: [] };
  assert.ok(C.validateAd(b).errors.some((e) => e.field === 'period.start'), '없는 날짜');
  const c = textAd(); c.period = { start: '', end: '', weekdays: [], times: [{ start: '22:00', end: '06:00' }] };
  assert.ok(C.validateAd(c).errors.some((e) => e.field === 'period.times'), '자정을 넘기는 시간대는 둘로 나눠야 한다');
  const d = textAd(); d.period = { start: '2026-10-13', end: '2026-10-20', weekdays: ['Mon', 'Thur'], times: [{ start: '09:00', end: '18:00' }] };
  assert.equal(C.validateAd(d).ok, true);
});

test('요일 표기는 灰度 공식 문서의 철자(목요일 Thur)를 그대로 쓴다', () => {
  /* 검사고정-허용: 장비가 받는 값 자체가 규칙이다 — 灰度 공식 문서 3.2.1 playControl.week.enable 의 철자 */
  assert.deepEqual(C.WEEKDAYS, ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun']);
});

test('normalizeAd — 빈 배열·빈 칸이 사라진 «파이어베이스에서 읽은 모양»도 안전하다', () => {
  const n = C.normalizeAd({ id: 'a', kind: 'text', period: { weekdays: { 0: 'Fri', 1: 'Mon' }, times: { 0: { start: '09:00', end: '10:00' } } } });
  assert.deepEqual(n.period.weekdays, ['Mon', 'Fri'], '객체로 읽혀도 배열로, 월요일부터 정렬');
  assert.equal(n.period.times.length, 1);
  assert.equal(C.normalizeAd(null).period.weekdays.length, 0);
});

test('periodSummary — 비우면 «늘», 요일 7개 다 고르면 요일 말은 안 한다', () => {
  assert.equal(C.periodSummary(null), '늘');
  assert.equal(C.periodSummary({ weekdays: C.WEEKDAYS }), '늘');
  const s = C.periodSummary({ start: '2026-10-13', end: '2026-10-20', weekdays: ['Mon', 'Wed'], times: [{ start: '09:00', end: '18:00' }] });
  assert.match(s, /10\/13~10\/20/);
  assert.match(s, /월수/);
  assert.match(s, /09:00~18:00/);
});

test('adStatus — 꺼짐·시작 전·끝남·기간 안 (한국 날짜 기준)', () => {
  const noon = Date.UTC(2026, 9, 15, 3, 0, 0); // 한국 2026-10-15 12:00
  const mk = (p, en) => Object.assign(textAd(), { enabled: en !== false, period: Object.assign({ start: '', end: '', weekdays: [], times: [] }, p) });
  assert.equal(C.adStatus(mk({}, false), noon), 'off');
  assert.equal(C.adStatus(mk({ start: '2026-10-16' }), noon), 'wait');
  assert.equal(C.adStatus(mk({ end: '2026-10-14' }), noon), 'ended');
  assert.equal(C.adStatus(mk({ start: '2026-10-15', end: '2026-10-15' }), noon), 'on');
  const lateUtc = Date.UTC(2026, 9, 15, 16, 0, 0); // 한국은 10-16 01:00 — 날짜가 한국 기준으로 넘어간다
  assert.equal(C.adStatus(mk({ end: '2026-10-15' }), lateUtc), 'ended');
});

test('publishableAds — 지운 것·꺼진 것은 빼고 order 순서로, 한 가지 모양으로 만든다', () => {
  const a = textAd({ id: 'ad_a', order: 3 }), b = textAd({ id: 'ad_b', order: 1 }), c = textAd({ id: 'ad_c', order: 2, enabled: false }), d = textAd({ id: 'ad_d', order: 0, _deleted: true });
  const out = C.publishableAds({ ad_a: a, ad_b: b, ad_c: c, ad_d: d });
  assert.deepEqual(out.map((x) => x.id), ['ad_b', 'ad_a']);
  assert.ok(out[0].text && !out[0].media, '글자 광고는 text 만');
  const img = C.publishableAds([imageAd()])[0];
  assert.ok(img.media && !img.text, '사진 광고는 media 만');
});

test('diffPublished — 추가·삭제·내용 변경·순서 변경을 센다', () => {
  const a = textAd({ id: 'ad_a', order: 1 }), b = textAd({ id: 'ad_b', order: 2 });
  const pub = C.publishableAds([a, b]);
  assert.equal(C.diffPublished([a, b], pub).total, 0, '똑같으면 0');
  const a2 = textAd({ id: 'ad_a', order: 1 }); a2.text.string = '바뀐 문구';
  assert.equal(C.diffPublished([a2, b], pub).changed, 1);
  const cNew = textAd({ id: 'ad_c', order: 3 });
  assert.equal(C.diffPublished([a, b, cNew], pub).added, 1);
  assert.equal(C.diffPublished([a], pub).removed, 1);
  const swapped = [Object.assign({}, a, { order: 5 }), b];
  assert.equal(C.diffPublished(swapped, pub).reordered, 1);
  assert.equal(C.diffPublished([Object.assign({}, a, { enabled: false }), b], pub).removed, 1, '끄면 올린 판에서는 빠진 것');
});

test('찬 자리 거래(prev=null)에서도 id 를 가진 레코드를 돌려준다 — 접히지 않게', () => {
  const known = textAd({ id: 'ad_k' });
  const p = C.patchedAd(null, known, { title: '새 제목' });
  assert.equal(p.id, 'ad_k'); assert.equal(p.title, '새 제목');
  const del = C.softDeleted(null, known, 'A-001', 111);
  assert.equal(del.id, 'ad_k'); assert.equal(del._deleted, true); assert.equal(del.deletedBy, 'A-001');
  const pub = C.publishedRecord(null, [known], 'A-001', 5, '첫 판');
  assert.equal(pub.id, 'published'); assert.equal(pub.version, 1); assert.equal(pub.entityType, 'SignboardPublish');
});

test('올리기 — 판 번호가 1씩 늘고, 되돌리기도 «새 판 번호»로 올린다', () => {
  const a = textAd({ id: 'ad_a' });
  const v1 = C.publishedRecord(null, [a], 'A-001', 10, '');
  const v2 = C.publishedRecord(v1, [a, textAd({ id: 'ad_b', order: 2 })], 'A-001', 20, '');
  assert.equal(v2.version, 2); assert.equal(v2.ads.length, 2);
  const hist1 = C.historyRecord(Object.assign({}, v1, { revision: 9, createdAt: 1, updatedAt: 2 }));
  assert.equal(hist1.id, '1');
  ['revision', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'].forEach((k) => assert.equal(k in hist1, false, '옛 수정 정보를 물려받지 않는다: ' + k));
  const back = C.rollbackRecord(v2, hist1, 'A-002', 30);
  assert.equal(back.version, 3, '되돌려도 번호는 앞으로 간다');
  assert.equal(back.ads.length, 1);
  assert.match(back.note, /1번 판/);
});

test('newAd — 제목은 비어 있고(검증이 막는다), id 는 파이어베이스 금지 글자가 없다', () => {
  const a = C.newAd('video');
  assert.equal(a.entityType, 'SignboardAd');
  assert.equal(C.validateAd(a).ok, false);
  assert.doesNotMatch(a.id, /[.#$/\[\]]/);
});

test('창고 주소만 받는다', () => {
  assert.equal(C.isMediaUrl(URL_OK), true);
  assert.equal(C.isMediaUrl('https://pureun-erp.firebasestorage.app/v0/b/x/o/a'), true);
  assert.equal(C.isMediaUrl('https://evil.example/a.jpg'), false);
  assert.equal(C.isMediaUrl('http://firebasestorage.googleapis.com/x'), false, 'http 는 안 된다');
});

test('시간대가 서로 겹치면 막고, 맞닿는 것(12:00 끝 · 12:00 시작)은 순서가 뒤바뀌어도 허용한다', () => {
  const a = textAd(); a.period = { start: '', end: '', weekdays: [], times: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '14:00' }] };
  assert.ok(C.validateAd(a).errors.some((e) => e.field === 'period.times' && /겹칩니다/.test(e.message)));
  a.period.times = [{ start: '12:00', end: '14:00' }, { start: '09:00', end: '12:00' }];
  assert.equal(C.validateAd(a).ok, true);
});

test('warnAd — 이모지와 이미 끝난 기간은 «막지 않고» 알린다', () => {
  const now = Date.UTC(2026, 9, 15, 3, 0, 0);
  const a = textAd(); a.text.string = '상담 😀';
  assert.equal(C.validateAd(a).ok, true, '막지는 않는다');
  assert.ok(C.warnAd(a).some((m) => m.includes('이모지')));
  const b = textAd(); b.period = { start: '', end: '2026-10-01', weekdays: [], times: [] };
  assert.ok(C.warnAd(b, now).some((m) => m.includes('종료일이 이미 지났습니다')));
  assert.deepEqual(C.warnAd(textAd(), now), []);
  assert.deepEqual(C.warnAd(b), [], '지금 시각을 모르면 기간 경고는 하지 않는다');
});

test('보관 — 기록 한 줄은 «그때의 광고 내용 전체»를 담고, 비어 있는 칸(undefined)은 만들지 않는다', () => {
  const a = textAd({ id: 'ad_k1' });
  const r = C.logRecord('create', { now: 1000, actor: 'A-001', actorName: '홍길동', ad: a, rnd: 0.5 });
  assert.equal(r.entityType, 'SignboardLog'); assert.equal(r.action, 'create'); assert.equal(r.by, 'A-001'); assert.equal(r.byName, '홍길동');
  assert.equal(r.adId, 'ad_k1'); assert.equal(r.title, a.title); assert.equal(r.after.text.string, a.text.string);
  assert.equal(Object.values(r).some((v) => v === undefined), false, '파이어베이스는 undefined 를 못 담는다');
  const p = C.logRecord('publish', { now: 2000, actor: 'A-001', version: 3, count: 2 });
  assert.equal(p.version, 3); assert.equal(p.count, 2); assert.equal('after' in p, false); assert.equal('adId' in p, false);
  assert.equal(C.logRecord('confirm', { now: 1, actor: 'A-001' }).action, 'confirm');
});

test('보관 — 기록 키는 «키 순서 = 시간 순서»이고 파이어베이스 금지 글자가 없다', () => {
  const a = C.newLogId(Date.UTC(2026, 9, 12), 0.1), b = C.newLogId(Date.UTC(2026, 9, 13), 0.9), c = C.newLogId(Date.UTC(2027, 0, 1), 0.0);
  assert.ok(a < b && b < c, '나중 것이 키 순서에서도 뒤');
  [a, b, c].forEach((k) => assert.doesNotMatch(k, /[.#$/\[\]]/));
  assert.equal(a.length, b.length, '고정 길이');
});

test('보관 — 지운 광고를 되살린다(표식만 바꾸고 내용은 그대로). 찬 자리 null 에서도 id 를 돌려준다', () => {
  const known = textAd({ id: 'ad_d1', _deleted: true, deletedAt: 5, deletedBy: 'A-001' });
  const back = C.restoredAd(null, known, 'A-002', 99);
  assert.equal(back.id, 'ad_d1'); assert.equal(back._deleted, false); assert.equal(back.restoredBy, 'A-002'); assert.equal(back.title, known.title);
  assert.equal(C.publishableAds([back]).length, 1, '되살리면 다시 올릴 수 있는 광고다');
});

test('보관 — 지운 광고 목록은 최근에 지운 것이 위', () => {
  const d1 = textAd({ id: 'ad_1', _deleted: true, deletedAt: 10 }), d2 = textAd({ id: 'ad_2', _deleted: true, deletedAt: 20 }), live = textAd({ id: 'ad_3' });
  assert.deepEqual(C.deletedAds({ ad_1: d1, ad_2: d2, ad_3: live }).map((a) => a.id), ['ad_2', 'ad_1']);
});

test('보관 — 기록 걸러 보기: 최근 것이 위, 이름·문구·사람으로 찾고, 한 가지 행동만 볼 수 있다', () => {
  const L = [
    C.logRecord('create', { id: 'lg_1', now: 100, actor: 'A-001', ad: textAd({ id: 'ad_a', title: '무료상담' }) }),
    C.logRecord('edit', { id: 'lg_2', now: 300, actor: 'A-002', actorName: '김노무', ad: textAd({ id: 'ad_a', title: '무료상담' }) }),
    C.logRecord('publish', { id: 'lg_3', now: 200, actor: 'A-001', version: 2, count: 1 })
  ];
  assert.deepEqual(C.filterLog(L, {}).map((r) => r.id), ['lg_2', 'lg_3', 'lg_1']);
  assert.deepEqual(C.filterLog(L, { action: 'publish' }).map((r) => r.id), ['lg_3']);
  assert.deepEqual(C.filterLog(L, { q: '김노무' }).map((r) => r.id), ['lg_2']);
  assert.deepEqual(C.filterLog(L, { q: '부당해고' }).map((r) => r.id), ['lg_2', 'lg_1'], '문구에서도 찾는다');
  assert.deepEqual(C.filterLog(L, { q: '없는말' }), []);
});

test('보관 — 표(엑셀) 내려받기: BOM·머리줄·쉼표·따옴표·줄바꿈을 지킨다', () => {
  const a = textAd({ id: 'ad_c', title: '쉼표, 따옴표 "있음"' }); a.text.string = '첫 줄\n둘째 줄';
  const csv = C.logToCsv([C.logRecord('create', { id: 'lg_c', now: Date.UTC(2026, 9, 12, 3, 0, 0), actor: 'A-001', ad: a }), C.logRecord('publish', { id: 'lg_p', now: 5, actor: 'A-001', version: 4, count: 2 })]);
  assert.equal(csv.charCodeAt(0), 0xFEFF, '엑셀이 한글을 알아보도록 BOM');
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], '시각(한국),누가,무엇을,광고,종류,내용,기간');
  assert.ok(lines[1].startsWith('2026-10-12 12:00,A-001,만듦,"쉼표, 따옴표 ""있음""",글자,'), lines[1]);
  assert.ok(lines[1].includes('첫 줄 / 둘째 줄'), '문구의 줄바꿈은 « / » 로 한 칸에');
  assert.ok(lines[2].includes('4번 판 · 광고 2건'));
});

test('보관 — 한 줄 요약: 글자는 문구, 사진·동영상은 파일 이름', () => {
  assert.equal(C.adSummary(textAd({ id: 'a' })), '부당해고 무료상담');
  assert.equal(C.adSummary(imageAd()), '사진 a.jpg');
  const v = C.newAd('video', { id: 'v' }); v.media.name = 'm.mp4';
  assert.equal(C.adSummary(v), '동영상 m.mp4');
});

test('newAd — 종류에 맞는 덩어리만 만든다(글자 광고에 사진 칸을 저장해 두지 않는다)', () => {
  const t = C.newAd('text'), i = C.newAd('image'), v = C.newAd('video');
  assert.ok(t.text && !t.media);
  assert.ok(i.media && !i.text);
  assert.ok(v.media && !v.text);
});
