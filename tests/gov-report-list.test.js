'use strict';
/* 컨설팅보고서 앱 — 현황판 순수 함수 (2026-10-10)
 * ★ 지키는 것: 줄 열쇠는 정부사업일정과 같다(rid=사업_첫회차해) · 간단형만 · 상태 차례 · 본문은 줄에 안 담는다
 * 공개 저장소다 — 합성 자료만(tests/helpers/gov-report-fixture.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/pu-gov-report-list.js');
const Rpt = require('../js/pu-gov-report.js');
const F = require('./helpers/gov-report-fixture.js');

const T = '2026-10-10';
const rowsAll = () => L.buildRows(F.input(T));
const key = (r) => r.coId + '/' + r.typeId;

test('reportKeys — 일정 있는 업체×사업 쌍을 모두(종류 이름으로 못 가려도), 열쇠는 사업_첫회차해(사전진단 뺌) · 겹침 없음', () => {
  const ks = L.reportKeys(F.input(T)).map((x) => x.coId + '/' + x.rid);
  assert.deepEqual(ks, ['c1/t1_2026', 'c1/t2_2026', 'c2/t3_2026', 'c3/t4_2026', 'c5/t1_2025']);
  assert.equal(new Set(ks).size, ks.length);
});

test('buildRows — 종류 이름으로 못 가려도 저장본에 formKey 가 있으면 줄이 생기고, 저장본이 없으면 줄이 없다', () => {
  const mk = (withSaved) => {
    const i = F.input(T);
    i.types = [{ id: 'tx', name: '미정사업', fullName: '', agency: '', rounds: 1 }];
    i.cos = [{ id: 'cx', name: '가상상사', types: ['tx'], defAtt: 'a1' }];
    i.scheds = [{ id: 'sx', coId: 'cx', typeId: 'tx', date: '2026-04-01', round: 1, isField: true }];
    i.reports = withSaved ? { cx: { tx_2026: { formKey: 'cci-seosan', state: '초안', ver: 0, updatedAt: Date.UTC(2026, 8, 20, 3) } } } : {};
    return i;
  };
  assert.equal(L.buildRows(mk(false)).length, 0, '못 가리고 저장본도 없으면 줄이 없다');
  assert.deepEqual(L.reportKeys(mk(false)).map((x) => x.rid), ['tx_2026'], '그래도 저장본은 읽으러 간다');
  const rows = L.buildRows(mk(true));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].formKey, 'cci-seosan');
  assert.equal(rows[0].st.key, 'draft');
});

test('buildRows — 대형 양식 사업은 저장본이 없으면 줄이 없다(키는 읽으러 가도)', () => {
  assert.ok(!rowsAll().some((r) => r.typeId === 't2'));
});

test('buildRows — 대형·지운 업체는 줄이 없고, 차례는 미작성 → 초안 → 작성 전 → 검토완료', () => {
  const rows = rowsAll();
  assert.deepEqual(rows.map(key), ['c3/t4', 'c1/t1', 'c2/t3', 'c5/t1']);
  assert.deepEqual(rows.map((r) => r.st.key), ['todo', 'draft', 'wait', 'done']);
});

test('buildRows — 줄에는 이름·상태만, 보고서 본문은 없다', () => {
  const all = JSON.stringify(rowsAll());
  assert.ok(!all.includes('본문은 목록에 나오면 안 된다'));
  const c1 = rowsAll().find((r) => r.coId === 'c1');
  assert.equal(c1.rid, 't1_2026');
  assert.equal(c1.formKey, 'techguard');
  assert.equal(c1.techguard, true);
  assert.deepEqual(c1.attNames, ['홍길동']);
  assert.equal(c1.rounds, 3);
  assert.equal(c1.ai, true);
});

test('buildRows — 담당은 주담당+부담당, 양식이 애매하면 askForm', () => {
  const rows = rowsAll();
  const c2 = rows.find((r) => r.coId === 'c2');
  assert.deepEqual(c2.attIds, ['a2', 'a1']);
  assert.deepEqual(c2.attNames, ['김가나', '홍길동']);
  assert.equal(c2.formKey, 'cci-north');
  const c3 = rows.find((r) => r.coId === 'c3');
  assert.equal(c3.formKey, '');
  assert.equal(c3.askForm, true);
});

test('statusOf — 넷 갈래와 단추', () => {
  const by = Object.fromEntries(rowsAll().map((r) => [r.coId, r.st]));
  assert.equal(by.c3.label, '미작성');
  assert.equal(by.c3.days, 151, '마지막 회차 2026-05-12 부터');
  assert.deepEqual(by.c3.action, { label: '📄 작성', enabled: true, why: '' });
  assert.equal(by.c1.label, '초안');
  assert.equal(by.c1.days, 20, '9/20 에 고침');
  assert.equal(by.c1.ai, true);
  assert.deepEqual(by.c1.steps, [true, false, false, false]);
  assert.equal(by.c1.action.label, '이어 쓰기');
  assert.equal(by.c2.label, '작성 전');
  assert.deepEqual(by.c2.action, { label: '📄 작성', enabled: false, why: '회차가 남았습니다' });
  assert.equal(by.c5.label, '검토완료 v2');
  assert.deepEqual(by.c5.steps, [true, true, false, false]);
  assert.equal(by.c5.action.label, '⬇ HWPX');
});

test('statusOf — 종료 표시가 있으면 회차 수와 상관없이 미작성, 날수는 종료일부터', () => {
  const st = L.statusOf({ state: '', ended: true, endDate: '2026-10-01' }, T);
  assert.equal(st.key, 'todo');
  assert.equal(st.days, 9);
  assert.equal(L.statusOf({ state: '검토완료', ver: 3 }, T).label, '검토완료 v3');
  assert.equal(L.statusOf({ state: '초안', updatedAt: 0 }, T).days, null, '고친 날을 모르면 세지 않는다');
});

test('kpis — 서명·제출은 이번에는 0', () => {
  assert.deepEqual(L.kpis(rowsAll()), { all: 4, todo: 1, wait: 1, draft: 1, done: 1, signed: 0, submitted: 0 });
  assert.deepEqual(L.kpis([]), { all: 0, todo: 0, wait: 0, draft: 0, done: 0, signed: 0, submitted: 0 });
});

test('filterRows — 연도·사업·담당·상태·업체·내 담당', () => {
  const rows = rowsAll();
  const ks = (f) => L.filterRows(rows, f).map(key);
  assert.deepEqual(ks({ year: '2026' }), ['c3/t4', 'c1/t1', 'c2/t3']);
  assert.deepEqual(ks({ year: '2025' }), ['c5/t1']);
  assert.deepEqual(ks({ year: '2026', mine: 'a1' }), ['c1/t1', 'c2/t3'], '부담당도 내 담당');
  assert.deepEqual(ks({ att: 'a2' }), ['c3/t4', 'c2/t3']);
  assert.deepEqual(ks({ status: 'todo' }), ['c3/t4']);
  assert.deepEqual(ks({ co: '다라' }), ['c2/t3']);
  assert.deepEqual(ks({ type: 't1' }), ['c1/t1', 'c5/t1']);
  assert.deepEqual(ks({}), rows.map(key));
});

test('alerts — 종료 14일 넘은 미작성 · 7일 넘은 초안 · 서명 기다림은 0', () => {
  const a = L.alerts(L.filterRows(rowsAll(), { year: '2026' }), T);
  assert.deepEqual(a.unwritten.map(key), ['c3/t4']);
  assert.deepEqual(a.staleDraft.map(key), ['c1/t1']);
  assert.deepEqual(a.waitSign, []);
  assert.equal(a.total, 2);
  /* 경계 — 「넘은」이므로 딱 14일·7일은 아니다 */
  const edge = [{ coId: 'x', typeId: 'y', coName: '가', state: '', ended: true, endDate: '2026-09-26' },
    { coId: 'x', typeId: 'z', coName: '가', state: '초안', updatedAt: Date.UTC(2026, 9, 3, 3) }];
  assert.equal(L.alerts(edge, T).total, 0);
});

test('formsStatus — 양식·파일·연도별 등록 상태(읽기)', () => {
  const s = F.seed();
  const fs = L.formsStatus(s.scal_rptFormsIndex, Rpt.FORMS);
  assert.deepEqual(fs.map((x) => x.formKey), Object.keys(Rpt.FORMS));
  const tg = fs.find((x) => x.formKey === 'techguard');
  assert.equal(tg.name, Rpt.FORMS.techguard.name);
  assert.deepEqual(tg.files.map((f) => [f.fileKey, f.label, f.years, f.latest]), [['main', '본문', ['2024'], '2024']]);
  assert.equal(tg.ready, true);
  const ss = fs.find((x) => x.formKey === 'cci-seosan');
  assert.equal(ss.ready, false, '결과보고서 양식이 없다');
  assert.ok(ss.files.some((f) => f.fileKey === 'visit' && f.latest === '2024'));
  assert.ok(L.formsStatus(null, Rpt.FORMS).every((x) => x.files.every((f) => f.years.length === 0)));
});

test('reportHref · FORMS_HREF — 정부사업일정 보고서 창으로', () => {
  assert.equal(L.reportHref('c1', 't1'), 'gov-consulting.html#rpt=c1|t1');
  assert.equal(L.reportHref('a b', 't/1'), 'gov-consulting.html#rpt=a%20b|t%2F1');
  assert.equal(L.FORMS_HREF, 'gov-consulting.html#forms');
});

test('staffIdFor — 로그인 메일 → 명부(사번) → 담당자 번호(정부사업일정과 같은 길)', () => {
  const s = F.seed();
  assert.equal(L.staffIdFor(s.scal_staff, s.data.user_dir, 'P009@pureun.kr'), 'a1');
  assert.equal(L.staffIdFor(s.scal_staff, { v: s.data.user_dir }, 'p009@pureun.kr'), 'a1', '명부가 {v:[…]} 꼴이어도');
  assert.equal(L.staffIdFor(s.scal_staff, s.data.user_dir, 'p010@pureun.kr'), '', '퇴직자는 아니다');
  assert.equal(L.staffIdFor(s.scal_staff, s.data.user_dir, 'nobody@example.com'), '');
  assert.equal(L.staffIdFor(s.scal_staff, null, ''), '');
});

test('yearsOf · staffNames · dayOf', () => {
  assert.deepEqual(L.yearsOf(rowsAll(), T), ['2026', '2025']);
  assert.deepEqual(L.yearsOf([], T), ['2026'], '줄이 없어도 올해는 있다');
  assert.deepEqual(L.staffNames(F.seed().scal_staff), { a1: '홍길동', a2: '김가나' });
  assert.equal(L.dayOf(Date.UTC(2026, 8, 19, 16)), '2026-09-20', '서울 날짜');
  assert.equal(L.dayOf(0), '');
});
