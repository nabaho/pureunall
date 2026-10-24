/* 푸른 캘린더 › «일정 후보함» 화면 (2026-10-24)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-24 「메일로 온 일정을 달력에 넣는 자동화」(추천대로 · 목업 승인).

   ★ 이 검사가 지키는 것
     ① 대표(관리자)만 보고, 한 번도 안 돈 기능은 단추도 없다 · 권한이 없으면 조용히 접는다
     ② 단추 분기 — 확인할 것이 없고 같은 날 비슷한 일정도 없을 때만 «✔ 이대로 넣기»,
        비슷한 일정이 있으면 «기존 일정 고치기» 먼저, 같은 날을 못 불러왔으면 «고쳐서 넣기»만
     ③ 마감([마감])은 시간·장소가 없는 것이 정상이다 — 그 때문에 막히지 않는다
     ④ 이 구역은 «상태 한 칸»만 쓴다(cal_inbox/cand/{id}/status) — 달력·우리 표·구글에 직접 안 쓴다
     ⑤ 넣는 길은 기존 새 일정 창(doSave)이고, «저장이 성공한 뒤에만» 후보가 «넣음»이 된다
     ⑥ 메일에서 온 글은 남이 적은 글 — HTML 이 그대로 그려지지 않는다
     ⑦ 칠 때(창이 열려 있을 때) 후보를 받아도 창을 다시 그리지 않는다(한글 조합) */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');
const CAP = require(path.join(ROOT, 'js', 'pu-cal-capture.js'));
const CARD = require(path.join(ROOT, 'js', 'pu-cal-card.js'));

const 시작 = 캘린더.indexOf('/* ══ 일정 후보함 시작');
const 끝 = 캘린더.indexOf('/* ══ 일정 후보함 끝');
const 구역 = (시작 >= 0 && 끝 > 시작) ? 캘린더.slice(시작, 끝) : '';

const 지금 = Date.now();
const 후보 = (id, 덮기, 최상위) => Object.assign({
  id, at: 지금 - 60000, status: 'new', base: '2026-10-19',
  mail: { slug: 'INBOX-abcd1234', u: 101, e: 'hong@example.com', f: '홍길동', s: '[다라진흥원] 컨설팅 중간보고회 개최 안내', d: 지금 - 3600000 },
  ev: Object.assign({ title: '1000-1400 다라진흥원 컨설팅 중간보고회', date: '2026-10-30', endDate: '', time: '10:00', endTime: '14:00', place: '다라진흥원 본원 2층 강의장', contact: '홍길동 · 010-1234-5678', note: '10/29에서 10/30으로 변경' }, 덮기 || {}),
  missing: [], warns: [],
}, 최상위 || {});

function 상자(옵션) {
  옵션 = 옵션 || {};
  const 기록 = { render: 0, toast: [], set: [], doSave: [], gedit: [], 명함: 0 };
  const b = {
    console, String, Object, Array, JSON, Math, Date, Number, RegExp, Promise, Error, Boolean,
    S: { modal: null },
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
    ME: 옵션.관리자 === false ? { sid: 'P-009', role: 'staff' } : { sid: 'P-001', role: 'admin', isAdmin: true },
    관리자인가() { return !!(b.ME && (b.ME.role === 'admin' || b.ME.isAdmin === true)); },
    fbDb: 옵션.fbDb === null ? null : {
      ref(p) {
        return {
          orderByChild() { return { limitToLast() { return { once: async () => { if (옵션.읽기오류) throw 옵션.읽기오류; return { val: () => 옵션.목록 || null }; } }; } }; },
          once: async () => ({ val: () => 옵션.상태 || null }),
          set(v) { 기록.set.push([p, v]); return 옵션.쓰기실패 ? Promise.reject(new Error('쓰기 거절')) : Promise.resolve(); },
        };
      },
    },
    render() { 기록.render++; },
    toast(t) { 기록.toast.push(t); },
    todayYMD: () => '2026-10-24',
    shiftDay(ymd, n) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    GCAL_CAL_ID: 'cal@example', GCAL_API_KEY: 'k',
    gcalToEvent: ev => ({ id: ev.id, date: ev.start.date || ev.start.dateTime.slice(0, 10), end: ev.end2 || ev.start.date || ev.start.dateTime.slice(0, 10), text: ev.summary, place: ev.location || '', time: '' }),
    fetch: async () => ({ json: async () => ({ items: [] }) }),
    document: { querySelector: () => null, addEventListener() {}, hidden: false },
    PuCalCapture: CAP, PuCalCard: CARD,
    명함받기() { 기록.명함++; },
    openNew(ymd) { b.S.modal = { mode: 'new', kind: 'sch', date: ymd, endDate: '', sid: 'P-001', title: '', note: '', timed: true, time: '10:00', endTime: '', place: '', contact: '', vis: 'shared' }; b.render(); },
    openGcalEdit(gid, 직접) { 기록.gedit.push([gid, 직접]); b.S.modal = { mode: 'edit', store: 'gcal', gid, kind: 'sch', date: 직접.date, endDate: 직접.end, title: 직접.text, time: 직접.time, endTime: '', place: 직접.place, contact: '', note: '', timed: !!직접.time }; b.render(); },
    doSave() { 기록.doSave.push({ modal: JSON.parse(JSON.stringify(b.S.modal)), render: 기록.render }); },
  };
  vm.createContext(b);
  vm.runInContext(구역, b);
  return { b, 기록, 실행: (코드) => vm.runInContext(코드, b) };
}

const 같은날 = (b, 날, 값) => { b.실행('후보.같은날[' + JSON.stringify(날) + '] = ' + JSON.stringify(값)); };

test('구역이 있다(시작·끝 표지)', () => { assert.ok(구역.length > 1000, '일정 후보함 구역을 못 찾았다'); });

/* ① 보이는 사람 */
test('① 대표(관리자)가 아니면 단추도 시트도 없다', () => {
  const t = 상자({ 관리자: false });
  t.실행('후보.list = [' + JSON.stringify(후보('a')) + '];');
  assert.strictEqual(t.실행('후보단추Html(false)'), '');
  assert.strictEqual(t.실행('후보단추Html(true)'), '');
});

test('① 한 번도 안 돈 기능(후보도 «마지막 돈 기록»도 없음)은 단추가 없다 · 돈 적이 있으면 보인다', () => {
  const t = 상자();
  assert.strictEqual(t.실행('후보단추Html(false)'), '');
  t.실행('후보.state = { at: ' + 지금 + ', tried: 0, made: 0 };');
  assert.ok(/data-cand="open"/.test(t.실행('후보단추Html(false)')));
  assert.ok(/data-cand="open"/.test(t.실행('후보단추Html(true)')));
});

test('① 새 후보 수가 단추에 숫자로 뜬다 · 넣음·일정 아님·30일 지난 것은 세지 않는다', () => {
  const t = 상자();
  t.b.__l = [후보('a'), 후보('b'), 후보('c', null, { status: 'added' }), 후보('d', null, { status: 'dismissed' }), 후보('e', null, { at: 지금 - 40 * 86400000 })];
  t.실행('후보.list = __l;');
  assert.strictEqual(t.실행('후보새것().length'), 2);
  assert.ok(/<b>2<\/b>/.test(t.실행('후보단추Html(false)')));
});

test('① 권한 없음(PERMISSION_DENIED)이면 조용히 접는다 — 오류 띠를 안 띄운다', async () => {
  const t = 상자({ 읽기오류: Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }) });
  await t.실행('후보받기()');
  assert.strictEqual(t.실행('후보.denied'), true);
  assert.strictEqual(t.실행('후보.err'), '');
  assert.strictEqual(t.실행('후보볼수있나()'), false);
});

test('① 받기는 cal_inbox 만 읽고 목록을 열쇠와 함께 모은다', async () => {
  const t = 상자({ 목록: { x1: { at: 1, status: 'new', ev: { title: 't' } }, x2: { at: 2, status: 'added' } }, 상태: { at: 5 } });
  await t.실행('후보받기()');
  assert.deepStrictEqual(t.실행('후보.list.map(function(c){ return c.id; }).sort()'), ['x1', 'x2']);
  assert.strictEqual(t.실행('후보.state.at'), 5);
});

/* ② 단추 분기 */
test('② 확인할 것이 없고 같은 날 비슷한 일정도 없으면 «✔ 이대로 넣기»', () => {
  const t = 상자(); t.b.__c = 후보('a');
  같은날(t, '2026-10-30', [{ id: 'g1', text: '0930 가나상사 방문', place: '' }]);
  const h = t.실행('후보카드Html(__c)');
  assert.ok(/data-cand="quick"/.test(h) && /data-cand="edit"/.test(h) && /data-cand="skip"/.test(h));
  assert.ok(!/cwarn/.test(h));
  assert.ok(/같은 날: 0930 가나상사 방문/.test(h), '같은 날 일정을 곁에 보여 준다');
});

test('② 확인할 것이 있으면(전화번호 없음 등) «고쳐서 넣기»만 — 이대로 넣기는 없다', () => {
  const t = 상자(); t.b.__c = 후보('a', { contact: '홍길동 · hong@example.com' });
  같은날(t, '2026-10-30', []);
  const h = t.실행('후보카드Html(__c)');
  assert.ok(!/data-cand="quick"/.test(h));
  assert.ok(/data-cand="edit"/.test(h));
  assert.ok(/전화번호가 없습니다/.test(h) && /cwarn/.test(h));
});

test('② 서버가 적은 경고(warns)도 확인할 것으로 보이고 이대로 넣기를 막는다', () => {
  const t = 상자(); t.b.__c = 후보('a', null, { warns: ['AI 가 확신 못 함: 날짜가 흐리게 보임'] });
  같은날(t, '2026-10-30', []);
  const h = t.실행('후보카드Html(__c)');
  assert.ok(/흐리게/.test(h) && !/data-cand="quick"/.test(h));
});

test('② 같은 날 비슷한 일정(같은 기관 낱말)이 있으면 «기존 일정 고치기»가 먼저 — 이대로 넣기는 없다', () => {
  const t = 상자(); t.b.__c = 후보('a');
  같은날(t, '2026-10-30', [{ id: 'g9', text: '1000 다라진흥원 보고회', place: '' }]);
  const h = t.실행('후보카드Html(__c)');
  assert.ok(/data-cand="dupedit"[^>]*data-gid="g9"/.test(h), '기존 일정 고치기에 일정 번호가 실려야 한다');
  assert.ok(/data-cand="edit"/.test(h) && !/data-cand="quick"/.test(h));
  assert.ok(/비슷한 일정이 이미 있습니다/.test(h));
});

test('② 기관 낱말이 안 겹치면 비슷하지 않다 · 흔한 낱말(방문·회의 …)만 겹쳐도 비슷하지 않다', () => {
  const t = 상자(); t.b.__c = 후보('a', { title: '1000 라마기업 방문', place: '' });
  assert.strictEqual(t.실행('후보비슷한(__c, [{ text: "0930 가나상사 방문", place: "" }])'), null);
  assert.strictEqual(t.실행('후보비슷한(__c, [{ text: "라마기업 점검", place: "" }]) && 1'), 1, '업체 이름이 겹치면 비슷하다');
});

test('② 같은 날을 못 불러왔거나 아직 받는 중이면 이대로 넣기를 막는다 — 비교 못 한 채 넣지 않는다', () => {
  const t = 상자(); t.b.__c = 후보('a');
  같은날(t, '2026-10-30', 'x');
  const 실패 = t.실행('후보카드Html(__c)');
  assert.ok(!/data-cand="quick"/.test(실패) && /비교하지 못했습니다/.test(실패));
  같은날(t, '2026-10-30', null);
  assert.ok(!/data-cand="quick"/.test(t.실행('후보카드Html(__c)')), '받는 중에는 막는다');
});

test('③ [마감] 후보는 시간·장소·전화번호가 없어도 «확인할 것»이 아니다 — 날짜·제목만 있으면 이대로 넣기', () => {
  const t = 상자(); t.b.__c = 후보('a', { title: '[마감] 추진현황 제출', date: '2026-10-26', time: '', endTime: '', place: '', contact: '홍길동 · hong@example.com' });
  같은날(t, '2026-10-26', []);
  const h = t.실행('후보카드Html(__c)');
  assert.ok(/data-cand="quick"/.test(h), '마감이 시간·장소 없음 때문에 막혔다');
  assert.ok(/종일/.test(h));
});

test('② 날짜를 못 찾은 후보는 이대로 넣기가 없다', () => {
  const t = 상자(); t.b.__c = 후보('a', { date: '' });
  const h = t.실행('후보카드Html(__c)');
  assert.ok(!/data-cand="quick"/.test(h) && /날짜를 못 찾았습니다/.test(h));
});

/* ⑥ 이스케이프 */
test('⑥ 메일에서 온 글의 HTML 이 그대로 그려지지 않는다', () => {
  const t = 상자(); t.b.__c = 후보('a', { title: '<img src=x onerror=alert(1)>', place: '"><script>x</script>', contact: '<b>홍</b>' }, { mail: { s: '<i>제목</i>', f: '<u>보낸이</u>', e: 'a@b', u: 1, slug: 's', d: 지금 } });
  t.실행('후보.list = [__c]; 후보.open = true;');
  const h = t.실행('후보창Html()');
  assert.ok(!/<img|<script|<b>홍|<i>제목|<u>보낸이/.test(h));
});

/* ④ 상태 한 칸만 */
test('④ 일정 아님 → 상태 한 칸(dismissed)만 쓴다 · 먼저 화면에 반영한다', async () => {
  const t = 상자(); t.b.__c = 후보('abc_1_0');
  t.실행('후보.list = [__c];');
  await t.실행('후보상태("abc_1_0", "dismissed")');
  assert.deepStrictEqual(t.기록.set, [['cal_inbox/cand/abc_1_0/status', 'dismissed']]);
  assert.strictEqual(t.실행('후보.list[0].status'), 'dismissed');
});

test('④ 상태를 못 적으면 되돌리고 알린다(눌렀는데 사라진 것처럼 보이면 안 된다)', async () => {
  const t = 상자({ 쓰기실패: true }); t.b.__c = 후보('abc_1_0');
  t.실행('후보.list = [__c];');
  await t.실행('후보상태("abc_1_0", "dismissed")');
  assert.strictEqual(t.실행('후보.list[0].status'), 'new');
  assert.ok(t.기록.toast.some((x) => /못 적었습니다/.test(x)));
});

test('④ 이 구역은 구글·우리 표에 직접 쓰지 않는다 — 쓰는 것은 상태 한 칸 하나뿐', () => {
  const 코드 = 구역.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\.update\(|ref\([^)]*\)\.push\(|\.remove\(|\.transaction\(|PuCalWrite|createEvent|구글에넣기\(|구글고치기\(|localStorage|sessionStorage/.test(코드), '직접 쓰는 길이 있다');
  const 쓰기 = 코드.match(/\.set\(/g) || [];
  assert.strictEqual(쓰기.length, 1, 'set 은 상태 한 칸에만');
  assert.ok(/cal_inbox\/cand\/" \+ id \+ "\/status"\)\.set\(status\)/.test(코드));
  assert.ok(!/fbDb\.ref\("(?!cal_inbox)/.test(코드), 'cal_inbox 밖을 읽거나 쓴다');
});

/* ⑤ 넣는 길 */
test('⑤ ✏ 고쳐서 넣기 — 새 일정 창이 채워진 채 열리고 후보 번호가 달린다(아직 «넣음» 아님)', () => {
  const t = 상자(); t.b.__c = 후보('c1');
  t.실행('후보.list = [__c]; 후보.open = true;');
  t.실행('후보열기("c1")');
  const m = t.b.S.modal;
  assert.strictEqual(m.mode, 'new');
  assert.strictEqual(m.date, '2026-10-30');
  assert.strictEqual(m.time, '10:00');
  assert.strictEqual(m.endTime, '14:00');
  assert.ok(/강의장/.test(m.place) && /010-1234-5678/.test(m.contact));
  assert.ok(/출처 메일/.test(m.note), '나중에 메일을 찾을 수 있게 출처를 남긴다');
  assert.strictEqual(m.candId, 'c1');
  assert.strictEqual(t.실행('후보.open'), false);
  assert.strictEqual(t.b.S.modal.mode === 'new' && t.실행('후보.list[0].status'), 'new', '저장 전에는 넣음이 아니다');
  assert.ok(t.기록.명함 >= 1, '담당자 칸의 기업정보함 찾기가 바로 되게 색인을 받아 둔다');
  assert.strictEqual(t.기록.doSave.length, 0, '고쳐서 넣기는 저장하지 않는다 — 사람이 «저장»을 눌러야 한다');
});

test('⑤ ✔ 이대로 넣기 — 창을 먼저 그리고 그 다음에 «기존 저장 길(doSave)»을 정확히 한 번 탄다', () => {
  const t = 상자(); t.b.__c = 후보('c1');
  t.실행('후보.list = [__c];');
  t.실행('후보바로넣기("c1")');
  assert.strictEqual(t.기록.doSave.length, 1);
  const 부름 = t.기록.doSave[0];
  assert.strictEqual(부름.modal.title, '1000-1400 다라진흥원 컨설팅 중간보고회');
  assert.strictEqual(부름.modal.candId, 'c1');
  assert.ok(부름.render >= 2, '채운 뒤 다시 그린 다음 저장해야 창의 칸 값과 같다(modalRead)');
});

test('⑤ 「넣음」은 저장이 «성공한 뒤»에만 — 후보처리됨(m)이 저장 성공 자리 네 곳에서만 불린다', () => {
  const 호출 = 캘린더.split('후보처리됨(m);');
  assert.strictEqual(호출.length - 1, 4, '구글 넣기·구글 고치기·우리 표 저장·나만 보기, 네 곳');
  [['후보처리됨(m); toast("✅ 구글 공용 달력에 넣었습니다', '구글에 넣기'],
    ['후보처리됨(m); toast("✅ 구글 공용 달력을 고쳤습니다"', '구글 일정 고치기'],
    ['후보처리됨(m); toast(고침 ? "✅ 고쳤습니다"', '우리 표 저장'],
    ['후보처리됨(m); toast((고침 ? "✅ 고쳤습니다 (🔒 나만 보기)"', '나만 보기']].forEach(([글, 이름]) => assert.ok(캘린더.includes(글), 이름 + ' 성공 자리에 없다'));
  const t = 상자(); t.b.__c = 후보('c1');
  t.실행('후보.list = [__c];');
  t.실행('후보처리됨({ candId: "c1" })');
  assert.deepStrictEqual(t.기록.set, [['cal_inbox/cand/c1/status', 'added']]);
  const 없음 = 상자();
  없음.실행('후보처리됨({})'); 없음.실행('후보처리됨(null)');
  assert.deepStrictEqual(없음.기록.set, [], '후보에서 온 창이 아니면 아무것도 안 쓴다');
});

test('⑤ 기존 일정 고치기 — 다른 달 일정도 열린다(일정 객체를 직접 넘김) · 메일 내용이 «있는 칸만» 덮인다', () => {
  const t = 상자(); t.b.__c = 후보('c1', { place: '', contact: '', note: '' });
  const 옛 = { id: 'g9', date: '2026-10-30', end: '2026-10-30', text: '1000 다라진흥원 보고회', place: '옛 장소', time: '10:00' };
  t.실행('후보.list = [__c];');
  같은날(t, '2026-10-30', [옛]);
  t.실행('후보고치기("c1", "g9")');
  assert.strictEqual(t.기록.gedit[0][0], 'g9');
  assert.strictEqual(t.기록.gedit[0][1].id, 'g9', '일정 객체를 그대로 넘겨야 한다(다른 달이라 달력 목록에 없다)');
  assert.strictEqual(t.기록.gedit[0][1].text, 옛.text);
  const m = t.b.S.modal;
  assert.strictEqual(m.title, '1000-1400 다라진흥원 컨설팅 중간보고회');
  assert.strictEqual(m.place, '옛 장소', '메일에 장소가 없으면 있던 장소를 지우지 않는다');
  assert.strictEqual(m.endTime, '14:00');
  assert.strictEqual(m.candId, 'c1');
  assert.strictEqual(t.기록.doSave.length, 0, '기존 일정 고치기도 저장하지 않는다 — 확인하고 저장');
});

test('⑤ 못 찾는 일정(gid)이면 창을 열지 않고 알린다', () => {
  const t = 상자(); t.b.__c = 후보('c1');
  t.실행('후보.list = [__c];');
  같은날(t, '2026-10-30', []);
  t.실행('후보고치기("c1", "없는번호")');
  assert.strictEqual(t.기록.gedit.length, 0);
  assert.ok(t.기록.toast.length >= 1);
});

/* ⑦ 한글 조합 */
test('⑦ 창에 적는 도중(S.modal)에는 후보를 받아도 다시 그리지 않는다', async () => {
  const t = 상자({ 목록: { x1: { at: 1, status: 'new' } } });
  t.b.S.modal = { mode: 'new' };
  const 전 = t.기록.render;
  await t.실행('후보받기()');
  assert.strictEqual(t.기록.render, 전, '창이 열려 있는데 전체를 다시 그렸다');
  t.b.S.modal = null;
  await t.실행('후보받기()');
  assert.ok(t.기록.render > 전);
});

/* 화면 끼움 */
test('화면: 칩 줄·폰 머리에 단추, render 에 시트, 클릭 위임에 data-cand, 부팅 때 받기', () => {
  assert.ok(/후보단추Html\(false\)/.test(캘린더) && /후보단추Html\(true\)/.test(캘린더));
  assert.ok(/html \+= 후보창Html\(\);/.test(캘린더));
  assert.ok(/\[data-cand\]/.test(캘린더) && /후보누름\(t\)/.test(캘린더));
  const 부팅 = 캘린더.indexOf('후보바인드(); 후보받기();');
  assert.ok(부팅 > 0 && 부팅 > 캘린더.indexOf('    개인받기();\n    모집받기();'), '부팅 때(내 정보가 정해진 뒤) 받아 둔다');
});

test('화면: 고치기 창은 일정 객체를 직접 받을 수 있다(기존 호출은 그대로)', () => {
  assert.ok(/function openGcalEdit\(gid, 직접\)\{/.test(캘린더));
  assert.ok(/if\(직접\) e = 직접;/.test(캘린더));
  assert.ok(/openGcalEdit\(t\.getAttribute|openGcalEdit\(S\.detail\.gid\)/.test(캘린더), '기존 호출(상세 창의 고치기)이 남아 있다');
});

test('시트: 시트를 열면 후보를 새로 받고 같은 날 일정을 받는다 · 닫으면 닫힌다', () => {
  const t = 상자();
  t.실행('후보.list = []; 후보.state = { at: ' + 지금 + ' };');
  assert.strictEqual(t.실행('후보창Html()'), '');
  t.실행('후보.open = true;');
  const h = t.실행('후보창Html()');
  assert.ok(/새 후보가 없습니다/.test(h) && /data-cand="close"/.test(h) && /data-cand="reload"/.test(h));
  t.실행('후보.state = { at: ' + 지금 + ', paused: "budget" };');
  assert.ok(/AI 한도를 넘어/.test(t.실행('후보창Html()')), '한도로 멈췄으면 시트에서 알린다');
  t.실행('후보.state = { at: ' + 지금 + ', paused: "day" };');
  assert.ok(/내일 다시/.test(t.실행('후보창Html()')));
});
