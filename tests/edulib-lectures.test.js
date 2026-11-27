'use strict';
/* 🗓 강의자료 «강의 이력»(EduLecture — js/pu-edulib-lecture.js · edulib/lectures) (2026-11-27)
 *
 * ■ 왜 이 검사가 있나 — 대표 지시 「특정 일에 누가 강의를 했다, 어디서 강의를 한지 정확하게 확인을 하고 … 누가 언제 강의했는지만
 *   간략하게 어떤 강의 내용으로 체크하게 해달라. 그리고 어떤 강의인지 그 관련돼서는 캘린더에서도 찾아도 된다」 → 선택 «추정으로 두고 확인»
 *   ① 캘린더 일정 맞추기는 «드문 낱말(업체·기관 이름)이 겹치거나 파일 이름 날짜가 같을 때»만 — 같은 주제·가까운 날만으로는 잇지 않는다.
 *      점수가 같은 일정이 둘이면 «모름» · 우리가 «듣는» 교육(수강)·교육청·휴가는 강의가 아니다
 *   ② 강의자는 사번만 — 캘린더 만든이 메일 → 사번 표로만 저절로 채운다(이름으로 짐작해 잇지 않는다 · 일정 글의 이름은 «고르기 단추»로만)
 *   ③ 같은 강의는 한 기록 — 열쇠가 일정 id·메일 id 에서 정해진다(규칙의 열쇠 꼴과 맞는다)
 *   ④ 사람이 «확인»한 기록·지운 기록은 자료 잇기도 하지 않는다
 *   ⑤ 기록은 화면 저장 관문(prepareRecord)을 지나고, 그 칸은 모두 규칙의 칸 목록 안이다($other false)
 *   ⑥ 화면 — 맨 왼쪽 ☐·№, 고른 것은 화면을 떠나면 비운다, 강의자 고르기는 재직 직원만, 폰에서는 두 줄 카드
 * ⚠ 예시는 지어낸 것이다(가나상사·example 주소). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const L = require('../js/pu-edulib-lecture.js');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const RULES = () => require('../docs/rules-paste.json').rules.edulib.lectures.$id;

const EV = (id, date, summary, o) => Object.assign({ id, entityType: 'ScheduleEvent', date, time: '14:00', allDay: false, summary, location: '', creator: 'a@example.com' }, o || {});
const CTX = { date: '2026-11-20', exactDate: '', subject: '[푸른노무법인] 가나상사 괴롭힘 예방교육 자료 송부', fileName: '2026 괴롭힘 예방교육.pptx', cat: 'bullying' };

test('★★★ 일정 맞추기 — 업체 이름 같은 드문 낱말이 겹쳐야(또는 파일 이름 날짜가 같아야) 잇는다', () => {
  const gana = EV('e1', '2026-11-24', '가나상사 직장 내 괴롭힘 예방교육');
  const other = EV('e2', '2026-11-23', '다라전자 직장 내 괴롭힘 예방교육');
  const m = L.matchEvent([other, gana], CTX);
  assert.ok(m && m.ev.id === 'e1', '이름이 겹치는 일정');
  assert.ok(m.hits.indexOf('가나상사') >= 0);
  assert.equal(L.matchEvent([other], CTX), null, '주제(괴롭힘)·가까운 날만으로는 잇지 않는다');
  /* 파일 이름의 날짜와 일정 날짜가 같으면 이름이 안 겹쳐도 */
  const byDate = L.matchEvent([EV('e3', '2026-11-26', '오후 교육')], Object.assign({}, CTX, { subject: '자료', fileName: '2026.11.26 교안.pdf', exactDate: '2026-11-26' }));
  assert.ok(byDate && byDate.exact);
  /* 창 밖 일정(메일 −14일 … +45일 밖)은 보지 않는다 */
  assert.equal(L.matchEvent([EV('e4', '2027-03-01', '가나상사 교육')], CTX), null);
  assert.equal(L.matchEvent([EV('e5', '2026-10-01', '가나상사 교육')], CTX), null);
});

test('★★★ 우리가 «듣는» 교육·교육청·휴가·지운 일정은 강의가 아니다 · 점수가 같은 일정이 둘이면 «모름»', () => {
  ['가나상사 노무사 보수교육 수강', '교육청 방문', '연차 휴가', '교육지원청 회의'].forEach((s) => assert.equal(L.isLectureEvent(EV('x', '2026-11-24', s)), false, s));
  assert.equal(L.isLectureEvent(EV('x', '2026-11-24', '가나상사 교육', { googleDeleted: true })), false, '구글에서 지운 일정');
  assert.equal(L.isLectureEvent(EV('x', '2026-11-24', '가나상사 특강')), true);
  const a = EV('a', '2026-11-24', '가나상사 교육'), b = EV('b', '2026-11-25', '가나상사 교육');
  assert.equal(L.matchEvent([a, b], CTX), null, '같은 점수 둘 — 틀리게 잇는 것보다 사람이 고르는 편');
});

test('★★★ 강의자는 «캘린더 만든이 메일 → 사번» 표로만 — 이름으로 짐작하지 않는다', () => {
  const ev = EV('e1', '2026-11-24', '가나상사 교육 (점검노무 강사)', { creator: 'Lect.Kim@Example.com' });
  const r = L.fromEvent(ev, { mailMap: { 'lect,kim@example,com': 'P007' }, who: { uid: 'P001' }, now: 1 });
  assert.equal(r.lecturerSid, 'P007');
  assert.equal(r.guess.lecturer, 'cal-creator');
  const r2 = L.fromEvent(ev, { mailMap: {}, who: { uid: 'P001' }, now: 1 });
  assert.equal(r2.lecturerSid, '', '표에 없으면 비운다(일정 글의 이름으로 채우지 않는다)');
  assert.equal(L.sidOfCreator('x@example.com', { 'x@example,com': '<script>' }), '', '사번 꼴이 아니면 버린다');
  assert.ok(!JSON.stringify(r).includes('example.com'), '만든이 메일 주소는 기록에 담지 않는다');
  /* 일정 글의 이름은 화면이 «고르기 단추»로만 — 값을 저장하지 않는다 */
  assert.deepEqual(L.namesInText('가나상사 교육 (점검노무 강사)', [{ sid: 'P002', name: '점검노무' }, { sid: 'P003', name: '점검사무장' }]).map((p) => p.sid), ['P002']);
  const app = read('js/pu-edulib-app.js');
  const open = app.slice(app.indexOf('function openLect'), app.indexOf('function saveLect'));
  assert.match(open, /data-lwho=/, '이름은 고르기 단추로');
  assert.ok(!/lecturerSid\s*=\s*hints/.test(app), '단추를 누르기 전에 강의자를 넣지 않는다');
});

test('★★★ 같은 강의는 한 기록 — 열쇠는 일정 id·메일 id 에서 정해지고 규칙의 열쇠 꼴과 맞는다', () => {
  assert.equal(L.idOfCal('ev_abc'), L.idOfCal('ev_abc'));
  assert.notEqual(L.idOfCal('ev_abc'), L.idOfCal('ev_abd'));
  assert.notEqual(L.idOfCal('x'), L.idOfMail('x'), '일정 열쇠와 메일 열쇠는 섞이지 않는다');
  const rx = /^lec_[a-z][0-9a-z]{4,40}$/;
  [L.idOfCal('abc123_20261124T050000Z'), L.idOfMail('Sent-1/101'), L.newId()].forEach((id) => assert.match(id, rx, id));
  assert.ok(RULES()['.validate'].includes('$id.matches(/^lec_[a-z][0-9a-z]{4,40}$/)'), '규칙도 같은 꼴');
});

test('★★★ 사람이 «확인»한 기록·지운 기록에는 자료를 잇지 않는다 · 겹쳐 잇지 않는다', () => {
  const base = L.makeLecture({ id: L.idOfCal('e'), date: '2026-11-24', itemIds: ['edu_a'] }, { uid: 'AI-메일자동정리' }, 1);
  const nx = L.linkItem(base, 'edu_b', { uid: 'AI-메일자동정리' }, 2);
  assert.ok(nx.itemIds.edu_a && nx.itemIds.edu_b);
  assert.equal(nx.revision, base.revision + 1);
  assert.equal(L.linkItem(nx, 'edu_b', {}, 3), null, '이미 이은 자료');
  assert.equal(L.linkItem(Object.assign({}, base, { status: 'ok' }), 'edu_c', {}, 3), null, '확인한 기록');
  assert.equal(L.linkItem(Object.assign({}, base, { _deleted: true }), 'edu_c', {}, 3), null, '지운 기록');
  assert.equal(L.linkItem(base, 'edu/../x', {}, 3), null, '열쇠 꼴이 아닌 자료 id');
});

test('★★ 저장 관문 — 기록이 온톨로지 강제 관문(prepareRecord)을 지나고, 칸은 모두 규칙의 칸 목록 안', () => {
  global.self = global.self || {};
  const W = require(path.join(ROOT, 'js/pu-ontology-write.js'));
  const rec = L.fromEvent(EV('e1', '2026-11-24', '가나상사 교육', { location: '가나상사 본사' }), { itemIds: ['edu_a'], mail: { id: 'Sent-1/1', subject: '가나상사 교육 자료', date: '2026-11-20' }, who: { uid: 'P001' }, now: 1 });
  const r = W.prepareRecord(rec, { entityType: L.ENTITY, actor: 'P001', expectedRevision: -1 });
  assert.equal(r.ok, true, '관문 통과: ' + JSON.stringify(r.issues));
  const ru = RULES();
  assert.equal(ru.$other['.validate'], false, '정해 둔 칸 밖은 막는다');
  const all = Object.assign({}, r.value, { confirmedBy: 'P001', confirmedAt: 1, _deleted: true, deletedAt: 1, deletedBy: 'P001' });
  Object.keys(all).forEach((k) => assert.ok(ru[k], '규칙에 없는 칸이 저장된다: ' + k));
  ['cal', 'mail', 'guess'].forEach((k) => Object.keys(r.value[k] || {}).forEach((kk) => assert.ok(ru[k][kk], '규칙에 없는 칸: ' + k + '.' + kk)));
  assert.match(ru.lecturerSid['.validate'], /A-Za-z0-9_-/, '강의자는 사번 꼴만');
  assert.ok(!ru.lecturerName && !ru.creator, '이름·만든이 메일 칸이 없다');
  assert.match(ru.status['.validate'], /'auto'/);
  assert.ok(require('../docs/rules-paste.json').rules.edulib.lectures.$id['.write'].includes('newData.exists()'), '지우기(빈 값 쓰기) 금지');
  /* 칸 길이 상한 — 셈(L.MAX)이 규칙보다 길게 만들지 않는다 */
  [['title', L.MAX.title], ['venue', L.MAX.venue], ['note', L.MAX.note]].forEach(([k, n]) => {
    const m = ru[k]['.validate'].match(/length <= (\d+)/);
    assert.ok(m && +m[1] >= n, k + ' 길이 한도');
  });
  assert.ok(L.makeLecture({ title: '가'.repeat(900) }, {}, 1).title.length <= L.MAX.title);
});

test('★★ 온톨로지 — EduLecture 등록 · 쓰는 자리 · 캘린더를 읽는다고 밝힘', () => {
  const O = require(path.join(ROOT, 'js/pu-ontology.js'));
  assert.ok(O.TERMS.entityTypes.EduLecture, '개체 사전');
  const p = O.PROGRAMS.edulib;
  assert.ok(p.writeContracts.some((w) => w.path === 'edulib/lectures/{id}' && w.entityType === 'EduLecture'));
  assert.ok(p.entityTypes.indexOf('EduLecture') >= 0);
  ['data/gcal_archive', 'data/gcal_mail_sid'].forEach((r) => assert.ok(p.sharedRoots.indexOf(r) >= 0, r));
});

test('★★ 화면 — 강의 이력 탭 · 맨 왼쪽 ☐·№ · 떠나면 고른 것을 비움 · 강의자 고르기는 재직 직원만 · 폰은 두 줄 카드', () => {
  const html = read('pu-edulib.html');
  const app = read('js/pu-edulib-app.js');
  assert.match(html, /data-tab="lect"/);
  assert.match(html, /id="pane-lect"/);
  const iLec = html.indexOf('js/pu-edulib-lecture.js'), iApp = html.indexOf('js/pu-edulib-app.js');
  assert.ok(iLec > 0 && iLec < iApp, '셈 파일을 앱보다 먼저 싣는다');
  const draw = app.slice(app.indexOf('function drawLect'), app.indexOf('function lpicked'));
  assert.match(draw, /<th class="ck">.*<th class="no">№<\/th>/, '머리줄 ☐ 다음 №');
  assert.match(draw, /data-lpick=/);
  assert.match(draw, /<td class="no">' \+ \(i \+ 1\)/, '번호는 보이는 순서');
  assert.match(app, /LPICK = \{\}; if \(TAB === 'add'\)/, '화면을 떠나면 고른 것을 비운다');
  const people = app.slice(app.indexOf('function activePeople'), app.indexOf('function openLect'));
  assert.match(people, /status === 'active'/, '고르는 목록은 재직 직원');
  assert.match(html, /#lecList table\.lst td\.dt,#lecList table\.lst td\.who/, '폰에서는 넓은 칸을 숨기고 두 줄 카드');
  /* 확인은 사람이 — 일괄 확인은 건수를 묻는다 */
  assert.match(app, /function lbulk[\s\S]{0,200}window\.confirm\(ids\.length/);
  /* 캘린더 가져오기는 관리자만 · 이미 있는 기록은 새로 쓰지 않는다(expectedRevision -1) */
  const imp = app.slice(app.indexOf('function importCalendar'), app.indexOf('function wireLect'));
  assert.match(imp, /if \(!ME\.admin\) return;/);
  assert.match(imp, /expectedRevision: -1/);
  assert.match(imp, /orderByChild\('date'\)\.startAt/, '날짜 범위로 읽는다');
});
