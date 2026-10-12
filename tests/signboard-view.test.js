/* 전광판 화면 부품(pu-signboard-view.js) — 표·미리보기·편집 상자·상태 카드 (2026-10-12)
   ★ 한 칸은 한 줄 · 맨 왼쪽 ☐ + 번호 · 사람이 적은 글은 esc · «모름»을 0 으로 그리지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-signboard-core.js');
const V = require('../js/pu-signboard-view.js');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/signboard%2Fa.jpg?alt=media&token=t';
const NOW = Date.UTC(2026, 9, 15, 3, 0, 0);
function ad(id, order, over) { const a = C.newAd('text', { id, order }); a.title = '광고 ' + id; a.text.string = '문구'; return Object.assign(a, over || {}); }

test('광고 표 — 맨 왼쪽 ☐ + 번호, 머리줄 ☐, 한 줄에 table 태그와 data-all·번호가 함께 있다', () => {
  const h = V.adsTable([ad('ad_a', 1), ad('ad_b', 2)], { now: NOW });
  const line = h.split('\n').find((l) => l.indexOf('<table') >= 0);
  assert.match(line, /data-all="ads"/); assert.match(line, /번호/);
  assert.match(h, /data-ck="ad_a"/); assert.match(h, /data-ck="ad_b"/);
  const first = h.indexOf('<td class="c">'), num = h.indexOf('<td class="n">');
  assert.ok(first > 0 && num > first, '☐ 칸이 번호 칸보다 앞');
});

test('광고 표 — 번호는 «보이는 순서»로 1부터 매기고, 지운 광고는 안 그린다', () => {
  const h = V.adsTable([ad('ad_b', 2), ad('ad_a', 1), ad('ad_x', 3, { _deleted: true })], { now: NOW });
  assert.deepEqual([...h.matchAll(/<td class="n">(\d+)<\/td>/g)].map((m) => m[1]), ['1', '2']);
  assert.ok(h.indexOf('ad_a') < h.indexOf('ad_b'), 'order 순서');
  assert.equal(h.includes('ad_x'), false);
});

test('광고 표 — 칸 안에서 줄을 바꾸거나 쌓지 않는다(한 칸은 한 줄)', () => {
  const h = V.adsTable([ad('ad_a', 1)], { now: NOW });
  assert.doesNotMatch(h, /<br/); assert.doesNotMatch(h, /<td[^>]*>\s*<div/);
  assert.match(h, /class="nw"/);
});

test('광고 표 — 사람이 적은 제목의 태그는 글자로 나온다(XSS)', () => {
  const h = V.adsTable([ad('ad_a', 1, { title: '<img src=x onerror=alert(1)>' })], { now: NOW });
  assert.equal(h.includes('<img src=x'), false);
  assert.match(h, /&lt;img/);
});

test('광고 표 — 전광판에 올라간 상태를 말해 준다(올라감·고침·새 광고·내림)', () => {
  const a = ad('ad_a', 1), b = ad('ad_b', 2), c = ad('ad_c', 3);
  const pub = C.publishableAds([a, b]);
  const b2 = Object.assign({}, b, { title: '바뀐 제목' });
  const h = V.adsTable([a, b2, c], { now: NOW, publishedAds: pub });
  assert.match(h, /✓ 올라감/); assert.match(h, /✎ 고침\(미반영\)/); assert.match(h, /＋ 새 광고\(미반영\)/);
  const down = V.adsTable([Object.assign({}, a, { enabled: false })], { now: NOW, publishedAds: pub });
  assert.match(down, /− 내림\(미반영\)/);
});

test('광고 표 — 첫 줄은 ▲ 못 누르고 끝 줄은 ▼ 못 누른다. 고른 줄은 checked', () => {
  const h = V.adsTable([ad('ad_a', 1), ad('ad_b', 2)], { now: NOW, sel: { ad_a: 1 } });
  assert.match(h, /data-mv="up:ad_a" disabled/); assert.match(h, /data-mv="down:ad_b" disabled/);
  assert.match(h, /data-ck="ad_a" checked/);
  assert.doesNotMatch(h, /data-ck="ad_b" checked/);
});

test('광고가 없으면 안내를 보여 준다', () => { assert.match(V.adsTable([], {}), /아직 광고가 없습니다/); });

test('일괄 처리 띠 — 고른 건수가 0 이면 비운다', () => {
  assert.equal(V.bulkBar(0), '');
  assert.match(V.bulkBar(3), /3건 선택/);
});

test('미리보기 — 장비 비율을 따르고, 모르면 자리표시임을 밝힌다', () => {
  const a = ad('ad_a', 1); a.text.string = '무료상담';
  const h = V.previewBox(a, { width: 192, height: 96 });
  assert.match(h, /aspect-ratio:192 \/ 96/); assert.match(h, /무료상담/);
  assert.match(V.previewBox(a, { width: 128, height: 64, assumed: true }), /자리표시/);
  assert.match(V.previewBox(a, null), /128×64/);
});

test('미리보기 — 사진·동영상은 우리 창고 주소만 그린다', () => {
  const img = C.newAd('image', { id: 'i' }); img.media.url = URL_OK;
  assert.match(V.previewBox(img), /<img /);
  const bad = C.newAd('image', { id: 'i' }); bad.media.url = 'https://evil.example/x.jpg';
  assert.doesNotMatch(V.previewBox(bad), /<img /);
  const vid = C.newAd('video', { id: 'v' }); vid.media.url = URL_OK;
  assert.match(V.previewBox(vid), /<video /);
});

test('미리보기 — 문구의 태그는 글자로 나온다', () => {
  const a = ad('ad_a', 1); a.text.string = '<script>alert(1)</script>';
  assert.equal(V.previewBox(a).includes('<script>'), false);
});

test('편집 상자 — 새 광고는 종류를 고르고, 있던 광고는 종류를 못 바꾼다', () => {
  assert.match(V.editorForm(C.newAd('text', { id: 'n' }), [], true), /name="f_kind"/);
  const h = V.editorForm(ad('ad_a', 1), [], false);
  assert.doesNotMatch(h, /name="f_kind"/); assert.match(h, /종류는 바꿀 수 없습니다/);
});

test('편집 상자 — 사진에는 글자 전용 효과가 목록에 없다', () => {
  const img = C.newAd('image', { id: 'i' });
  const h = V.editorForm(img, [], false);
  const sel = h.slice(h.indexOf('id="f_meffect"'), h.indexOf('</select>', h.indexOf('id="f_meffect"')));
  assert.equal(sel.includes('value="26"'), false); assert.equal(sel.includes('value="30"'), false);
  const t = V.editorForm(ad('ad_a', 1), [], false);
  assert.ok(t.includes('value="26"'), '글자에는 있다');
});

test('편집 상자 — 검증 오류를 그 칸 밑에 보여 준다', () => {
  const a = ad('ad_a', 1, { title: '' });
  const r = C.validateAd(a);
  assert.match(V.editorForm(a, r.errors, false), /class="ferr">제목을 적어 주세요/);
});

test('adFromForm — 화면 값이 광고가 된다(요일·시간대 포함, 빈 시간대는 버린다)', () => {
  const base = ad('ad_a', 1);
  const out = V.adFromForm(base, { title: ' 새 제목 ', kind: 'text', enabled: true, text: '문구\n둘째', size: '30', color: '#ff0000', bold: true, effect: '1', speed: '3', hold: '8',
    pstart: '2026-10-13', pend: '2026-10-20', wd: ['Mon', 'Fri'], times: [['09:00', '18:00'], ['', ''], ['', '']] });
  assert.equal(out.title, '새 제목'); assert.equal(out.id, 'ad_a');
  assert.deepEqual(out.text, { string: '문구\n둘째', size: 30, color: '#ff0000', bold: true, effectType: 1, effectSpeed: 3, holdSec: 8 });
  assert.deepEqual(out.period, { start: '2026-10-13', end: '2026-10-20', weekdays: ['Mon', 'Fri'], times: [{ start: '09:00', end: '18:00' }] });
  assert.equal(C.validateAd(out).ok, true);
});

test('adFromForm — 사진은 «이미 올려 둔 파일 정보»를 지우지 않는다', () => {
  const base = C.newAd('image', { id: 'i' }); base.media = Object.assign(base.media, { url: URL_OK, size: 55, name: 'a.jpg', path: 'signboard/i_1.jpg' });
  const out = V.adFromForm(base, { title: '로고', kind: 'image', enabled: true, fit: 'center', meffect: '17', mspeed: '2', mhold: '9', pstart: '', pend: '', wd: [], times: [] });
  assert.equal(out.media.url, URL_OK); assert.equal(out.media.size, 55); assert.equal(out.media.fit, 'center'); assert.equal(out.media.holdSec, 9);
  assert.equal(C.validateAd(out).ok, true);
});

test('상태 카드 — 심부름꾼이 20분 넘게 조용하면 경고, 기록이 없으면 «기록 없음»(0분이 아니다)', () => {
  const none = V.stateCards({}, {}, NOW);
  assert.match(none, /기록 없음/); assert.match(none, /20분 넘게 응답이 없습니다/);
  const ok = V.stateCards({ agentSeenAt: NOW - 3 * 60000, mode: 'live', result: 'ok', sentVersion: 4, sentAt: NOW - 60000, device: { width: 192, height: 96, time: 't', timeZone: 'z', luminance: '80' } }, {}, NOW);
  assert.match(ok, /3분 전/); assert.doesNotMatch(ok, /20분 넘게/); assert.match(ok, /192×96/);
});

test('상태 카드 — 장비 시계 경고와 연결 실패 사유가 나온다', () => {
  const h = V.stateCards({ agentSeenAt: NOW, deviceReachable: false, deviceError: 'ECONNREFUSED', clockWarning: '시간대가 한국이 아닙니다' }, {}, NOW);
  assert.match(h, /ECONNREFUSED/); assert.match(h, /시간대가 한국이 아닙니다/);
});

test('첫 전송 확인 — 기다리는 중에만 단추가 나오고, 허락하면 누가 했는지 나온다', () => {
  const st = { agentSeenAt: NOW, result: 'wait-confirm', existingPrograms: [{ uuid: 'u1', name: '옛 광고' }] };
  const wait = V.stateCards(st, {}, NOW);
  assert.match(wait, /data-confirm-first/); assert.match(wait, /1건/); assert.match(wait, /옛 광고/);
  const done = V.stateCards(st, { firstReplaceConfirmed: true, confirmedBy: 'A-001', confirmedAt: NOW }, NOW);
  assert.doesNotMatch(done, /data-confirm-first/); assert.match(done, /A-001/);
});

test('올린 기록 — 보기 전용 표, 지금 판에는 되돌리기 단추가 없다, 최신이 위', () => {
  const rows = [{ version: 1, publishedBy: 'A-001', publishedAt: NOW, ads: [1], note: '' }, { version: 2, publishedBy: 'A-002', publishedAt: NOW, ads: [1, 2], note: '되돌림: 1번 판' }];
  const h = V.historyTable(rows, 2);
  assert.match(h, /data-viewonly/);
  assert.ok(h.indexOf('2번') < h.indexOf('1번'));
  assert.match(h, /data-rollback="1"/); assert.doesNotMatch(h, /data-rollback="2"/);
  assert.match(V.historyTable([], 0), /올린 기록이 없습니다/);
});

test('편집 상자 — 경고(이모지·끝난 기간)는 맨 위에 보여 주고, 없으면 빈 칸이다', () => {
  const a = ad('ad_a', 1); a.text.string = '😀';
  assert.match(V.editorForm(a, [], false, NOW), /id="fWarn"><div class="warn">⚠ 이모지/);
  assert.match(V.editorForm(ad('ad_b', 1), [], false, NOW), /id="fWarn"><[/]div>/);
  assert.equal(V.warnBox([]), '');
  assert.match(V.warnBox(['<b>x</b>']), /&lt;b&gt;/, '경고 글도 글자로 나온다');
});

function logs() {
  return [
    C.logRecord('create', { id: 'lg_1', now: NOW - 5000, actor: 'A-001', actorName: '홍길동', ad: ad('ad_a', 1) }),
    C.logRecord('publish', { id: 'lg_2', now: NOW, actor: 'A-001', version: 3, count: 2 }),
    C.logRecord('delete', { id: 'lg_3', now: NOW - 1000, actor: 'A-002', ad: ad('ad_b', 2, { title: '<b>위험</b>' }) })
  ];
}

test('보관 — 활동 기록 표: 보기 전용, 사람이 적은 글은 글자로, 광고 기록은 «그때 내용»·올림 기록은 «그 판 내용» 단추', () => {
  const h = V.logTable(C.filterLog(logs(), {}));
  assert.match(h, /data-viewonly/);
  assert.doesNotMatch(h, /<b>위험<[/]b>/); assert.match(h, /&lt;b&gt;위험/);
  assert.match(h, /data-log-view="lg_1"/); assert.match(h, /data-hist-view="3"/);
  assert.match(h, /홍길동/); assert.match(h, /2026-10-15 12:00/, '한국 시각으로');
  assert.ok(h.indexOf('3번 판') < h.indexOf('&lt;b&gt;위험') && h.indexOf('&lt;b&gt;위험') < h.indexOf('홍길동'), '넘겨 준 순서(최근이 위)를 그대로 그린다');
  assert.doesNotMatch(h, /<br/); assert.match(h, /class="nw"/);
  assert.doesNotMatch(h, /data-(delete|remove|edit)/, '기록에는 고치거나 지우는 길이 없다');
});

test('보관 — 기록이 없으면 안내', () => { assert.match(V.logTable([]), /기록이 없습니다/); });

test('보관 — 지운 광고 표: 되살리기·내용 단추, 최근에 지운 것이 위', () => {
  const d1 = ad('ad_1', 1, { _deleted: true, deletedAt: NOW - 9000, deletedBy: 'A-001' }), d2 = ad('ad_2', 2, { _deleted: true, deletedAt: NOW - 1000, deletedBy: 'A-002' });
  const h = V.deletedTable({ ad_1: d1, ad_2: d2, ad_3: ad('ad_3', 3) });
  assert.ok(h.indexOf('data-restore="ad_2"') < h.indexOf('data-restore="ad_1"'));
  assert.equal(h.includes('ad_3'), false, '지우지 않은 광고는 안 나온다');
  assert.match(h, /data-ad-view="ad_1"/); assert.match(h, /data-viewonly/);
  assert.match(V.deletedTable({}), /지운 광고가 없습니다/);
});

test('보관 — 걸러 보기 줄: 찾기 칸·행동 고르기·표 내려받기 단추', () => {
  const h = V.logFilterBar({ q: '상담', action: 'publish' });
  assert.match(h, /id="lgQ"/); assert.match(h, /id="lgAct"/); assert.match(h, /data-csv/);
  assert.match(h, /value="상담"/); assert.match(h, /value="publish" selected/);
});

test('보관 — 내용 전체 보기: 글자·사진 모두 이름·문구·기간·미리보기를 보여 준다', () => {
  const t = ad('ad_t', 1); t.text.string = '둘째\n줄'; t.period = { start: '2026-10-13', end: '2026-10-31', weekdays: ['Mon'], times: [] };
  const h = V.detailBox(t, { width: 128, height: 64 }, '홍길동 · 만듦');
  assert.match(h, /둘째 \/ 줄/); assert.match(h, /10\/13~10\/31/); assert.match(h, /class="pv"/); assert.match(h, /홍길동 · 만듦/);
  const img = C.newAd('image', { id: 'i' }); img.title = '로고'; img.media = Object.assign(img.media, { url: URL_OK, size: 1234, name: 'a.jpg' });
  assert.match(V.detailBox(img), /a\.jpg/); assert.match(V.detailBox(img), /1KB/);
});

test('보관 — 올린 한 판의 광고들 / 올린 기록 표의 «광고 내용» 단추', () => {
  const rec = { version: 2, ads: C.publishableAds([ad('ad_a', 1), ad('ad_b', 2)]) };
  const h = V.historyDetail(rec, null);
  assert.match(h, /1\. 광고 ad_a/); assert.match(h, /2\. 광고 ad_b/);
  assert.match(V.historyDetail({ ads: [] }), /광고가 없습니다/);
  assert.match(V.historyTable([{ version: 5, publishedBy: 'A-001', publishedAt: NOW, ads: [1], note: '' }], 4), /data-hist-view="5"/);
});

test('ago — 방금·분·시간·일', () => {
  assert.equal(V.ago(0, NOW), '기록 없음');
  assert.equal(V.ago(NOW - 10000, NOW), '방금');
  assert.equal(V.ago(NOW - 5 * 60000, NOW), '5분 전');
  assert.equal(V.ago(NOW - 3 * 3600000, NOW), '3시간 전');
  assert.equal(V.ago(NOW - 2 * 86400000, NOW), '2일 전');
});

test('편집 상자 — 올려 둔 파일 크기는 1MB 미만이면 KB 로 보여 준다', () => {
  const img = C.newAd('image', { id: 'i' }); img.media = Object.assign(img.media, { url: URL_OK, size: 1234, name: 'a.jpg' });
  assert.match(V.editorForm(img, [], false), /a\.jpg 1KB/);
  img.media.size = 3 * 1048576;
  assert.match(V.editorForm(img, [], false), /3\.0MB/);
});

test('광고 표 — 켜기 칸은 ☐ 하나이고, 켜진 광고는 checked', () => {
  const h = V.adsTable([ad('ad_a', 1), ad('ad_b', 2, { enabled: false })], { now: NOW });
  assert.match(h, /data-en="ad_a" checked/); assert.doesNotMatch(h, /data-en="ad_b" checked/);
});
