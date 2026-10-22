'use strict';
/* 컨설팅보고서 앱 — 받은 메일 서류 «자동 연결·완료» 결정 순수 모듈 PuGovReportAuto (2026-10-22, 계획서 docs/superpowers/plans/2026-10-22-gov-report-auto.md Task 1)
 * ★ 지키는 것(Review Focus): 사람 손이 닿은 줄은 안 덮는다 · 한 첨부 한 줄·애매하면 없음(같은 점수·두 사업) · 개인 자료·기술보호·우리 주소·종결 사업 처리 0 ·
 *   100줄 상한(오래된 것부터) · 서명요청 꼬리표가 쌍을 못 박는다 · 회차 번호 · 줄 이름 점수·동점 없음 · 대형 틀·간단형 틀 줄 ·
 *   stepOf 표 · usable 표 · next 가 Track.normalize·validate 를 통과 · 입력 불변 · 결과가 입력과 객체를 나눠 쓰지 않음 · 합성 한 업체 전체 시나리오
 * 서류 틀 이름은 PuGovReportDocs 의 DOC_PLANS 에서 가져온다 — 충남북부 상의(간단형·서명 once) · 일터상생혁신(대형·회차 줄) · 농촌융복합(별첨 once 둘) · 기술보호.
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/pu-gov-report-auto.js');
const D = require('../js/pu-gov-report-docs.js');
const T = require('../js/pu-gov-report-track.js');
const I = require('../js/pu-gov-report-inbox.js');
const S = require('../js/pu-gov-report-send.js');

const TODAY = '2026-10-22';
const INBOX = 'INBOX-0a1b2c3d', ARCH = 'Archive-4e5f6a7b';
const clone = (v) => JSON.parse(JSON.stringify(v));
const ms = (day) => Date.parse(day + 'T01:00:00Z');   // 한국 시각 같은 날 10시
const mkey = (uid, slug) => 'i:' + (slug || INBOX) + ':' + uid;

/* 이알피 사업 → 일정 사업(틀 이름은 DOC_PLANS 의 낱말로 고른다) */
const BIZ = [
  { code: 'consulting-02', name: '일터상생혁신컨설팅', short: '', agency: '', sortOrder: 2 },          // t2 → workplace (대형)
  { code: 'consulting-03', name: '통합기술보호지원단', short: '', agency: '', sortOrder: 3 },          // t1 → techguard
  { code: 'consulting-04', name: '인사노무컨설팅충남북부상의', short: '', agency: '', sortOrder: 4 },  // t3 → cci-north (간단형 · 서명 once)
  { code: 'consulting-05', name: '인사노무컨설팅서산', short: '', agency: '', sortOrder: 5 },          // t4 → cci-seosan
  { code: 'consulting-09', name: '농촌융복합6차산업현장코칭', short: '', agency: '', sortOrder: 9 },  // t6 → rural (별첨 once 둘)
  { code: 'consulting-12', name: '예시없는사업', short: '', agency: '', sortOrder: 12 },              // t7 → 서류 틀 없음
];
const TMAP = { 'consulting-02': 't2', 'consulting-03': 't1', 'consulting-04': 't3', 'consulting-05': 't4', 'consulting-09': 't6', 'consulting-12': 't7' };
const TYPES = ['t1', 't2', 't3', 't4', 't6', 't7'].map((id) => ({ id, name: id, fullName: id, rounds: 3 }));
const DATES = ['2026-09-01', '2026-09-15'];
const PLAN_NORTH = D.planFor('인사노무컨설팅충남북부상의');
const PLAN_WP = D.planFor('일터상생혁신컨설팅');
const PLAN_TG = D.planFor('통합기술보호지원단');

/* 합성 세계 한 벌 — 화면 grLoad·grReadInbox 가 만드는 모양(원본 scal_*·거울 원본·Track.normalize 결과) */
function world(spec) {
  const cos = [], scheds = [], companies = [], rows = {}, rawDocs = {};
  spec.cos.forEach((c) => {
    cos.push({ id: c.id, name: c.name, types: c.types.slice() });
    c.types.forEach((t) => ((c.dates && c.dates[t]) || DATES).forEach((d, j) => scheds.push({ id: 's' + c.id + t + j, coId: c.id, typeId: t, date: d, round: j + 1 })));
    if (c.email) companies.push({ id: 'm' + c.id, name: c.name, email: c.email });
  });
  (spec.companiesExtra || []).forEach((c) => companies.push(c));
  (spec.mails || []).forEach((m) => {
    const slug = m.slug || INBOX;
    rows[slug] = rows[slug] || {};
    rows[slug][m.uid] = { u: m.uid, f: '담당', e: m.from, t: 'office@pureun.kr', s: m.s || '', d: ms(m.day), a: m.an.length, an: m.an.slice() };
  });
  Object.keys(spec.items || {}).forEach((co) => Object.keys(spec.items[co]).forEach((rid) => {
    rawDocs[co] = rawDocs[co] || {}; rawDocs[co][rid] = { items: spec.items[co][rid] };
  }));
  return {
    today: TODAY,
    input: { cos, types: TYPES.slice(), scheds, staff: [] },
    docs: { biz: BIZ, cons: spec.cons === undefined ? null : spec.cons, tmap: TMAP },
    companies: { u: 1, v: companies },
    state: spec.state === undefined ? {} : spec.state,
    track: T.normalize(rawDocs),
    folders: { [INBOX]: { path: 'INBOX', name: '받은메일함', kind: 'inbox' }, [ARCH]: { path: 'Archive', name: '보관', kind: 'archive' }, 'Sent-1b2c3d4e': { path: 'Sent', name: '보낸메일함', kind: 'sent' } },
    msgs: rows,
  };
}
const GANA = { id: 'c1', name: '가나상사', types: ['t3'], email: 'gana@example.com' };
const one = (mails, over) => world(Object.assign({ cos: [GANA], mails }, over || {}));
const mail = (uid, s, an, day, from, slug) => ({ uid, s, an, day: day || '2026-10-10', from: from || 'gana@example.com', slug });

/* 객체를 모두 모은다(입력과 결과가 객체를 나눠 쓰는지 볼 때) */
function objects(v, set) {
  set = set || new Set();
  if (v && typeof v === 'object' && !set.has(v)) { set.add(v); Object.keys(v).forEach((k) => objects(v[k], set)); }
  return set;
}

/* ---------- 상수 ---------- */
test('상수 — 45일 · 100줄 · 처리자 «자동»(40자 이내) · 꼬리표 식은 보내기 모듈 것 그대로', () => {
  assert.equal(A.WINDOW_DAYS, 45);
  assert.equal(A.MAX_ACTIONS, 100);
  assert.equal(A.AUTO_BY, '자동');
  assert.ok(A.AUTO_BY.length <= T.BY_MAX);
  assert.equal(A.WINDOW_DAYS, I.GLOBAL_DAYS, '화면 전역 «받은 서류 확인» 창과 같다');
  assert.equal(A.TAG_RE, S.TAG_RE, '꼬리표 식을 복제하지 않는다');
  assert.ok(A.SIGN_RE instanceof RegExp && A.ATTACH_RE instanceof RegExp);
});

/* ---------- stepOf 표 ---------- */
test('stepOf — 서명/날인/직인/인감/스캔/signed → sign · 사진/회의록/… → attach · 둘 다면 sign · 아무것도 아니면 null', () => {
  const rows = [
    ['서명본.pdf', '', 'sign'], ['날인본.pdf', '', 'sign'], ['직인 찍은 것.png', '', 'sign'], ['인감.pdf', '', 'sign'], ['스캔_0001.pdf', '', 'sign'],
    ['final_signed.pdf', '', 'sign'], ['SIGNED.PDF', '', 'sign'],
    ['사진1.jpg', '', 'attach'], ['회의록.hwp', '', 'attach'], ['결과물.zip', '', 'attach'], ['산출물.pdf', '', 'attach'], ['증빙자료.pdf', '', 'attach'],
    ['참여 명단.xlsx', '', 'attach'], ['참석자.xlsx', '', 'attach'], ['출석부.xlsx', '', 'attach'], ['결과보고서.hwp', '', 'attach'], ['활동일지.pdf', '', 'attach'],
    ['사진 서명.jpg', '', 'sign'], ['문서.pdf', '서명 부탁드립니다', 'sign'], ['문서.pdf', '현장 사진 송부', 'attach'], ['사진.jpg', '서명본 송부', 'sign'],
    ['문서.pdf', '[서명요청:t3_2026] 회신', 'sign'], ['사진.jpg', '[서명요청:t3_2026] 회신', 'sign'], ['사진.jpg', '[제출:t3_2026] 접수', 'attach'],
    ['IMG_0001.jpg', '안녕하세요', null], ['문서.pdf', '', null], ['', '', null],
  ];
  rows.forEach(([n, s, want]) => assert.equal(A.stepOf(n, s), want, JSON.stringify([n, s])));
  assert.equal(A.stepOf({ name: '서명본.pdf' }, ''), 'sign', '첨부 객체({name})도 받는다');
  assert.equal(A.stepOf(null, null), null);
});

/* ---------- usable 표 ---------- */
test('usable — 기록 없음 또는 «없음»이면서 사람 손(처리자·연결·메모·날짜·방식·확인·회차기록)이 없는 줄만', () => {
  const link = { src: 'mail', key: 'i:X:1', name: 'a.pdf' };
  const yes = [undefined, null, 0, '', { st: 'none', at: 0 }, { st: 'none', at: 5 }];
  const no = [{ st: 'none', by: '홍길동', at: 1 }, { st: 'none', link, at: 1 }, { st: 'none', note: '메모', at: 1 },
    { st: 'doing', at: 1 }, { st: 'done', at: 1 }, { st: 'done', by: '홍길동', at: 1 }, { st: 'blocked', at: 1 }, { st: 'na', at: 1 },
    { st: 'none', at: 1, sentAt: '2026-10-01' }, { st: 'none', at: 1, gotAt: '2026-10-01' }, { st: 'none', at: 1, how: 'mail' }, { st: 'none', at: 1, ack: true },
    { st: 'none', at: 1, rd: { mode: 'face' } }, 'x', 7, []];
  yes.forEach((r) => assert.equal(A.usable(r), true, JSON.stringify(r)));
  no.forEach((r) => assert.equal(A.usable(r), false, JSON.stringify(r)));
  assert.equal(A.usable({ st: 'done', by: '자동', at: 1 }), false, '자동이 쓴 줄도 두 번 쓰지 않는다');
});

/* ---------- pickKey ---------- */
test('pickKey — 간단형(충남북부 상의) 서명 once 줄: 쓸 수 있는 줄이 하나면 그 줄', () => {
  const r = A.pickKey({ plan: PLAN_NORTH, step: 'sign', n: 3, recs: {}, att: { name: '문서.pdf' }, subject: '', multi: false });
  assert.deepEqual(r, { key: 'sign', why: '쓸 수 있는 줄이 하나' });
  assert.deepEqual(A.pickKey({ plan: PLAN_NORTH, step: 'sign', n: 3, att: { name: '문서.pdf' } }), { key: 'sign', why: '쓸 수 있는 줄이 하나' }, 'recs 없어도');
  const named = A.pickKey({ plan: PLAN_NORTH, step: 'sign', n: 3, recs: {}, att: { name: '업체 서명본.pdf' }, subject: '', multi: false });
  assert.deepEqual(named, { key: 'sign', why: '줄 이름 일치' }, '줄 이름이 먼저 — 「업체 서명본」은 공백을 떼고 견준다');
});
test('pickKey — 사람 손이 닿은 줄은 대상이 아니다(null) · 자동이 쓴 줄도', () => {
  [{ st: 'doing', by: '홍길동', sentAt: '2026-10-01', at: 1 }, { st: 'none', by: '홍길동', at: 1 }, { st: 'none', note: 'x', at: 1 },
    { st: 'done', by: '자동', at: 1 }].forEach((rec) => {
    assert.equal(A.pickKey({ plan: PLAN_NORTH, step: 'sign', n: 3, recs: { sign: rec }, att: { name: '업체 서명본.pdf' }, subject: '', multi: false }), null, JSON.stringify(rec));
  });
  assert.ok(A.pickKey({ plan: PLAN_NORTH, step: 'sign', n: 3, recs: { sign: { st: 'none', at: 9 } }, att: { name: '서명본.pdf' }, subject: '', multi: false }), '흔적 없는 «없음» 줄은 쓴다');
});
test('pickKey — 단계 줄이 없는 틀·잘못된 입력은 null', () => {
  assert.equal(A.pickKey({ plan: PLAN_TG, step: 'sign', n: 3, recs: {}, att: { name: '서명본.pdf' }, subject: '', multi: false }), null, '기술보호에는 서명 줄이 없다');
  assert.equal(A.pickKey({ plan: D.NONE, step: 'sign', n: 3, att: { name: 'a' } }), null);
  assert.equal(A.pickKey(null), null);
  assert.equal(A.pickKey({}), null);
});
test('pickKey — 대형(일터상생혁신) 회차 줄: «N회차»·«N차» 가 id:N 줄을 고른다(1~60)', () => {
  const o = (name, subject, recs) => A.pickKey({ plan: PLAN_WP, step: 'plat', n: 8, recs: recs || {}, att: { name }, subject: subject || '', multi: false });
  assert.deepEqual(o('3회차 수행보고서.pdf'), { key: 'round:3', why: '3회차' });
  assert.equal(o('수행보고서 5차.pdf').key, 'round:5');
  assert.equal(o('서류_08회차.pdf').key, 'round:8', '앞 0 은 숫자로');
  assert.equal(o('보고서.pdf', '4회차 보고').key, 'round:4', '이름에 번호가 없으면 제목의 번호');
  assert.equal(o('2회차.pdf', '5회차 보고').key, 'round:2', '이름 번호가 먼저');
});
test('pickKey — 회차 번호가 있는데 그 줄을 못 쓰면 null(다른 회차로 새지 않는다) · 범위 밖·여러 번호도 null', () => {
  const o = (name, recs, subject) => A.pickKey({ plan: PLAN_WP, step: 'plat', n: 8, recs: recs || {}, att: { name }, subject: subject || '', multi: false });
  assert.equal(o('9회차.pdf'), null, '8회차까지');
  assert.equal(o('61회차.pdf'), null);
  assert.equal(o('0회차.pdf'), null);
  assert.equal(o('3회차.pdf', { 'round:3': { st: 'done', by: '홍길동', at: 1 } }), null, '3회차 줄이 이미 사람 손 — 4회차 등으로 안 샌다');
  assert.equal(o('1회차 2회차 합본.pdf'), null, '번호가 둘이면 정할 수 없다');
  const done3 = { 'round:3': { st: 'done', by: '홍길동', at: 1 } };
  assert.equal(o('3회차 서류.pdf', done3), null, '회차 줄이 아닌 단서도 없으면 안 쓴다(남은 줄이 여럿)');
  assert.equal(o('2차 수정 수행계획서.pdf', { 'round:2': { st: 'done', by: '홍길동', at: 1 } }).key, 'plan', '«차» 가 회차가 아닐 때 — 회차 없는 줄 이름이 딱 맞으면 그 줄');
  const tgo = (name, recs) => A.pickKey({ plan: PLAN_TG, step: 'attach', n: 3, recs, att: { name }, subject: '', multi: false });
  const adv = { 'advice:2': { st: 'done', by: '홍길동', at: 1 }, 'advice:3': { st: 'done', by: '홍길동', at: 1 } };
  assert.equal(tgo('법률 자문 일지 3회차.pdf', adv), null, '3회차 줄은 사람 손 — 남은 1회차 줄로 새지 않는다');
  assert.equal(tgo('법률 자문 일지.pdf', adv).key, 'advice:1', '번호가 없으면 줄 이름이 맞는 남은 한 줄');
  assert.equal(o('2026 보고.pdf'), null, '번호 없음 + 줄 이름 없음 + 줄이 여럿');
});
test('pickKey — 줄 이름 점수: 회차 꼬리표를 뗀 줄 이름이 첨부 이름·제목에 들어 있으면 그 줄(공백·괄호 제거) · 동점이면 없음', () => {
  const wp = (name, subject) => A.pickKey({ plan: PLAN_WP, step: 'plat', n: 8, recs: {}, att: { name }, subject: subject || '', multi: false });
  assert.deepEqual(wp('수행 계획서(최종).pdf'), { key: 'plan', why: '줄 이름 일치' });
  assert.equal(wp('자료.pdf', '이행관리 등록 건').key, 'follow', '제목에서도');
  /* 기술보호 별첨 — 같은 이름의 회차 줄(법률 자문 일지 1~3회차)은 번호가 없으면 동점 → 없음 */
  const tg = (name, subject, recs, n) => A.pickKey({ plan: PLAN_TG, step: 'attach', n: n || 3, recs: recs || {}, att: { name }, subject: subject || '', multi: false });
  assert.equal(tg('법률 자문 일지.pdf'), null, '세 회차 줄이 같은 점수');
  assert.equal(tg('법률 자문 일지 2회차.pdf').key, 'advice:2', '번호가 있으면 그 줄');
  assert.equal(tg('보안서약서 스캔.pdf').key, 'pledge');
  assert.equal(tg('별지8 여비지급신청서.pdf').key, 'travel', '「별지8 」 공백은 떼고 견준다');
  assert.equal(tg('만족도조사.pdf').key, 'survey');
});
test('pickKey — 쓸 수 있는 줄이 하나뿐일 때: once 줄은 그 줄, 남은 «회차 줄» 하나는 어느 회차인지 몰라 안 쓴다', () => {
  const h = (keys) => keys.reduce((m, k) => { m[k] = { st: 'done', by: '홍길동', at: 1 }; return m; }, {});
  const tg = (recs) => A.pickKey({ plan: PLAN_TG, step: 'attach', n: 3, recs, att: { name: '자료.pdf' }, subject: '', multi: false });
  assert.deepEqual(tg(h(['advice:1', 'advice:2', 'advice:3', 'pledge', 'travel'])), { key: 'survey', why: '쓸 수 있는 줄이 하나' }, '남은 줄이 once');
  assert.equal(tg(h(['advice:1', 'advice:2', 'pledge', 'travel', 'survey'])), null, '남은 줄이 advice:3 뿐 — 어느 회차인지 모른다');
});
test('pickKey — multi(한 업체가 두 사업에 후보): 줄 이름이 맞을 때만 · «하나뿐인 줄»·회차 번호만으로는 null', () => {
  const rural = D.planFor('농촌융복합6차산업현장코칭');
  const m = (plan, step, name, subject) => A.pickKey({ plan, step, n: 3, recs: {}, att: { name }, subject: subject || '', multi: true });
  assert.equal(m(PLAN_NORTH, 'sign', '문서.pdf'), null, '줄이 하나여도 multi 면 안 쓴다');
  assert.equal(m(PLAN_NORTH, 'sign', '업체 서명본.pdf').key, 'sign', '줄 이름이 맞으면 쓴다');
  assert.equal(m(rural, 'attach', '사진.pdf'), null);
  assert.equal(m(rural, 'attach', 'a.jpg', '현장 사진 송부').key, 'photo');
  assert.equal(m(PLAN_WP, 'plat', '3회차.pdf'), null, '번호만으로는 사업을 못 정한다');
});

/* ---------- plan — 합성 한 업체 전체 시나리오 ---------- */
test('plan — 한 업체: 주소 → 후보 → 서명본 줄 완료(act.next 는 Track 이 받아들이는 모양)', () => {
  const w = one([mail(11, '확인 부탁드립니다', ['가나상사 서명본.pdf'])]);
  const r = A.plan(w);
  assert.equal(r.actions.length, 1);
  const a = r.actions[0];
  assert.deepEqual([a.coId, a.rid, a.typeId, a.key, a.step, a.mailKey, a.name, a.day],
    ['c1', 't3_2026', 't3', 'sign', 'sign', mkey(11), '가나상사 서명본.pdf', '2026-10-10']);
  assert.equal(a.prev, null);
  assert.equal(a.why, '쓸 수 있는 줄이 하나', '이름 단서 없이 ③ 줄이 하나뿐이라서');
  assert.deepEqual(a.next, { st: 'done', at: 0, by: '자동', gotAt: '2026-10-10', how: 'mail', note: '자동 처리 — 메일 «가나상사 서명본.pdf»',
    link: { src: 'mail', key: mkey(11), name: '가나상사 서명본.pdf', date: '2026-10-10' } });
  assert.equal(a.next.sentAt, undefined, '보낸 날은 건드리지 않는다');
  assert.deepEqual([r.unmatched.length, r.scanned, r.more], [0, 1, false]);
  /* Track 이 그대로 받아들인다 — 읽을 때(normalize)·저장 꼴(put)·칸 창 검사(validate) */
  assert.equal(T.validate(a.next, a.step), '');
  assert.deepEqual(T.put({}, a.coId, a.rid, a.key, a.next)[a.coId][a.rid][a.key], a.next, 'normRec 를 거쳐도 그대로');
  assert.deepEqual(T.normalize({ c1: { t3_2026: { items: { sign: a.next } } } }).c1.t3_2026.sign, a.next);
  assert.deepEqual(T.patchFor(a.next, '자동', 0), a.next);
  /* 그 줄을 기록에 넣고 다시 돌리면 — 연결된 메일이라 더 안 한다 */
  const w2 = Object.assign({}, w, { track: T.put(w.track, a.coId, a.rid, a.key, a.next) });
  const r2 = A.plan(w2);
  assert.deepEqual([r2.actions.length, r2.skipped.linked], [0, 1]);
});
test('plan — now 를 주면 at 에 그 값(서버가 찍는다) · 결과에 제목·주소가 없다', () => {
  const w = one([mail(11, '고객 문의 제목입니다', ['서명본.pdf'])]);
  w.now = 1760000000000;
  const r = A.plan(w);
  assert.equal(r.actions[0].next.at, 1760000000000);
  const s = JSON.stringify(r);
  assert.ok(!/@|example\.com|pureun\.kr/.test(s), '주소가 없다');
  assert.ok(!s.includes('고객 문의 제목'), '제목이 없다');
  assert.ok(!Object.prototype.hasOwnProperty.call(r.actions[0], 'subject'));
  assert.deepEqual(Object.keys(r).sort(), ['actions', 'more', 'scanned', 'skipped', 'unmatched']);
  assert.deepEqual(Object.keys(r.actions[0]).sort(), ['coId', 'day', 'key', 'mailKey', 'name', 'next', 'prev', 'rid', 'step', 'typeId', 'why'].sort());
});

/* ---------- 사람 손 ---------- */
test('plan — 사람이 저장한 줄은 어떤 상태든 덮지 않는다(unmatched 로만) · 흔적 없는 «없음»은 쓰고 prev 를 남긴다', () => {
  const mails = [mail(11, '', ['업체 서명본.pdf'])];
  const cases = [{ st: 'doing', by: '홍길동', sentAt: '2026-10-01', at: 5 }, { st: 'done', by: '김가나', gotAt: '2026-10-02', at: 5 },
    { st: 'none', by: '홍길동', at: 5 }, { st: 'none', note: '메모', at: 5 }, { st: 'na', by: '홍길동', at: 5 },
    { st: 'none', at: 5, link: { src: 'mail', key: 'i:Z:1', name: 'b.pdf' } }];
  cases.forEach((rec) => {
    const r = A.plan(one(mails, { items: { c1: { t3_2026: { sign: rec } } } }));
    assert.deepEqual(r.actions, [], JSON.stringify(rec));
    assert.equal(r.unmatched.length, 1);
    assert.deepEqual([r.unmatched[0].coId, r.unmatched[0].rid, r.unmatched[0].mailKey, r.unmatched[0].name], ['c1', 't3_2026', mkey(11), '업체 서명본.pdf']);
  });
  const w = one(mails, { items: { c1: { t3_2026: { sign: { st: 'none', at: 5 } } } } });
  const r = A.plan(w);
  assert.equal(r.actions.length, 1);
  assert.deepEqual(r.actions[0].prev, { st: 'none', at: 5 });
  assert.notEqual(r.actions[0].prev, w.track.c1.t3_2026.sign, 'prev 는 복사본');
});

/* ---------- 한 첨부 한 줄 ---------- */
test('plan — 같은 줄은 두 번 쓰지 않는다: 먼저(오래된) 메일이 이기고 나중 것은 unmatched', () => {
  const r = A.plan(one([mail(11, '', ['서명본A.pdf'], '2026-10-05'), mail(12, '', ['서명본B.pdf'], '2026-10-12')]));
  assert.equal(r.actions.length, 1);
  assert.equal(r.actions[0].name, '서명본A.pdf');
  assert.deepEqual(r.unmatched.map((u) => u.name), ['서명본B.pdf']);
});
test('plan — 한 메일의 여러 첨부는 각각 따로: 서명본→③ · 사진→④ · 같은 단계 둘째는 줄이 없어 unmatched', () => {
  const r = A.plan(one([mail(11, '자료 송부', ['서명본.pdf', '사진.jpg', '서명본2.pdf'])]));
  assert.deepEqual(r.actions.map((a) => [a.key, a.name, a.mailKey]).sort(), [['attach', '사진.jpg', mkey(11)], ['sign', '서명본.pdf', mkey(11)]]);
  assert.deepEqual(r.unmatched.map((u) => u.name), ['서명본2.pdf']);
});
test('plan — 꼬리표만 보고 sign 이 된 첨부보다 이름에 «서명»이 있는 첨부가 줄을 먼저 차지한다', () => {
  const r = A.plan(one([mail(11, '[서명요청:t3_2026] 회신', ['사업자등록증 사본.pdf', '서명본.pdf'])]));
  assert.deepEqual(r.actions.map((a) => a.name), ['서명본.pdf']);
  assert.deepEqual(r.unmatched.map((u) => u.name), ['사업자등록증 사본.pdf']);
});
test('plan — 단계를 모르는 첨부(IMG_0001.jpg·문서.pdf)는 자동 처리 안 함(skipped.noStep)', () => {
  const r = A.plan(one([mail(11, '안녕하세요', ['IMG_0001.jpg', '문서.pdf'])]));
  assert.deepEqual([r.actions.length, r.unmatched.length, r.skipped.noStep, r.scanned], [0, 0, 2, 1]);
});

/* ---------- 개인 자료·기술보호·우리 주소·종결 ---------- */
test('plan — 개인 자료(첨부 이름·제목에 PRIV_RE)는 그 메일 전체를 안 본다', () => {
  const byName = A.plan(one([mail(11, '', ['9월 급여대장 서명본.pdf', '서명본.pdf'])]));
  assert.deepEqual([byName.actions.length, byName.unmatched.length, byName.skipped.priv], [0, 0, 1], '첨부 하나만 걸려도 메일 전체');
  const bySubject = A.plan(one([mail(12, '근태 자료 서명본', ['서명본.pdf'])]));
  assert.deepEqual([bySubject.actions.length, bySubject.skipped.priv], [0, 1]);
});
test('plan — 기술보호 사업: 쓰지 않는다(skipped.tech) · 기술보호가 있는 업체는 줄 이름이 맞을 때만', () => {
  const tg = { id: 'c2', name: '다라정밀', types: ['t1'], email: 'dara@example.com' };
  const onlyTg = A.plan(world({ cos: [tg], mails: [mail(11, '', ['보안서약서 서명본.pdf'], '2026-10-10', 'dara@example.com'), mail(12, '증빙', ['보안서약서.pdf'], '2026-10-11', 'dara@example.com')] }));
  assert.deepEqual([onlyTg.actions.length, onlyTg.unmatched.length, onlyTg.skipped.tech], [0, 0, 2]);
  const both = { id: 'c2', name: '다라정밀', types: ['t1', 't3'], email: 'dara@example.com' };
  const w = (an, s, day, uid) => mail(uid, s, an, day, 'dara@example.com');
  const r = A.plan(world({ cos: [both], mails: [w(['보안서약서 서명본.pdf'], '', '2026-10-10', 11), w(['업체 서명본.pdf'], '', '2026-10-11', 12), w(['보안서약서.pdf'], '증빙', '2026-10-12', 13)] }));
  assert.deepEqual(r.actions.map((a) => [a.mailKey, a.key, a.rid]), [[mkey(12), 'sign', 't3_2026']], '기술보호 사업이 있어 «하나뿐인 줄» 로는 안 쓴다 — 줄 이름이 맞는 것만');
  assert.deepEqual(r.unmatched.map((u) => u.mailKey), [mkey(11)], '서명본인데 어느 사업인지 모름');
  assert.equal(r.skipped.tech, 1, '기술보호 줄 이름에 맞는 첨부는 기술보호 자료');
});
test('plan — 우리 주소(@pureun.kr)만 있는 업체·주소가 없는 업체는 후보가 없다(skipped.noAddr) · 남의 주소는 안 쓴다', () => {
  const w = world({ cos: [{ id: 'c1', name: '가나상사', types: ['t3'], email: 'office@pureun.kr' }, { id: 'c2', name: '다라정밀', types: ['t3'] },
    { id: 'c3', name: '마바산업', types: ['t3'], email: 'ma@example.com' }],
    companiesExtra: [{ id: 'mx', name: '먼저상사', email: 'shared@example.com' }],
    mails: [mail(11, '', ['서명본.pdf'], '2026-10-10', 'office@pureun.kr'), mail(12, '', ['서명본.pdf'], '2026-10-10', 'shared@example.com')] });
  w.companies.v.push({ id: 'mm', name: '마바산업2', email: 'shared@example.com' });   // 먼저상사 뒤에 적힌 같은 주소 — 마바산업과 무관
  const r = A.plan(w);
  assert.deepEqual([r.actions.length, r.scanned], [0, 0]);
  assert.equal(r.skipped.noAddr, 2, '가나상사(우리 주소만)·다라정밀(주소 없음)');
});
test('plan — 같은 주소를 이알피 연락처에서 두 업체가 같이 쓰면(주인 없음) 그 메일은 안 쓴다(skipped.multiCo)', () => {
  const cons = [{ id: 'k1', companyName: '가나상사', typeCodes: { consulting: 'consulting-04' }, company: { name: '가나상사', contacts: [{ email: 'both@example.com' }] } },
    { id: 'k2', companyName: '다라정밀', typeCodes: { consulting: 'consulting-04' }, company: { name: '다라정밀', contacts: [{ email: 'both@example.com' }] } }];
  const w = world({ cos: [{ id: 'c1', name: '가나상사', types: ['t3'], erpId: 'k1' }, { id: 'c2', name: '다라정밀', types: ['t3'], erpId: 'k2' }], cons,
    mails: [mail(11, '', ['서명본.pdf'], '2026-10-10', 'both@example.com')] });
  w.input.cos[0].erpId = 'k1'; w.input.cos[1].erpId = 'k2';
  const r = A.plan(w);
  assert.deepEqual([r.actions.length, r.unmatched.length, r.skipped.multiCo, r.scanned], [0, 0, 1, 1]);
});
test('plan — 종결 사업(scal_bizState)은 안 본다 · 종결 시작 연도 전에는 본다 · 서류 틀 없는 사업·보낸 메일은 안 본다', () => {
  const m = [mail(11, '', ['서명본.pdf'])];
  const closed = A.plan(one(m, { state: { 'consulting-04': { closedFrom: '2026', at: 1 } } }));
  assert.deepEqual([closed.actions.length, closed.scanned], [0, 0]);
  const later = A.plan(one(m, { state: { 'consulting-04': { closedFrom: '2027', at: 1 } } }));
  assert.equal(later.actions.length, 1, '2027 부터 종결이면 2026 은 아직');
  const reopened = A.plan(one(m, { state: { 'consulting-04': { closedFrom: '9999', at: 1 } } }));
  assert.equal(reopened.actions.length, 1, '되돌림 표시(9999)는 종결이 아니다');
  const noPlan = A.plan(world({ cos: [{ id: 'c1', name: '가나상사', types: ['t7'], email: 'gana@example.com' }], mails: m }));
  assert.deepEqual([noPlan.actions.length, noPlan.scanned], [0, 0], '서류 틀 없음(NONE)');
  const sent = world({ cos: [GANA], mails: [mail(11, '', ['서명본.pdf'])] });
  sent.folders = { 'Sent-1b2c3d4e': { path: 'Sent', name: '보낸메일함', kind: 'sent' } };
  sent.msgs = { 'Sent-1b2c3d4e': { 21: { u: 21, f: '푸른', e: 'office@pureun.kr', t: 'gana@example.com', s: '서명본', d: ms('2026-10-10'), a: 1, an: ['서명본.pdf'] } } };
  assert.equal(A.plan(sent).scanned, 0, '우리가 보낸 메일은 후보가 아니다');
});

/* ---------- 입력이 모자랄 때(기록을 못 읽은 채 «기록 없음»으로 오해하지 않는다) ---------- */
test('plan — track 이 객체가 아니거나 state 를 안 주면(undefined) 아무것도 안 한다 · state null 은 빈 노드 · today 이상하면 안 한다', () => {
  const base = () => one([mail(11, '', ['서명본.pdf'])]);
  const noTrack = Object.assign(base(), { track: undefined });
  assert.deepEqual([A.plan(noTrack).actions.length, A.plan(noTrack).skipped.noTrack], [0, 1]);
  assert.equal(A.plan(Object.assign(base(), { track: null })).skipped.noTrack, 1);
  const noState = base(); delete noState.state;
  assert.deepEqual([A.plan(noState).actions.length, A.plan(noState).skipped.noState], [0, 1]);
  assert.equal(A.plan(Object.assign(base(), { state: 'x' })).skipped.noState, 1);
  assert.equal(A.plan(Object.assign(base(), { state: null })).actions.length, 1, '종결 표시가 하나도 없는 빈 노드');
  [undefined, '', '내일', '2026-10', null].forEach((t) => assert.equal(A.plan(Object.assign(base(), { today: t })).skipped.badToday, 1, String(t)));
  assert.doesNotThrow(() => A.plan());
  assert.doesNotThrow(() => A.plan({ today: TODAY, track: {}, state: {} }));
  assert.deepEqual(A.plan({ today: TODAY, track: {}, state: {} }).actions, []);
});

/* ---------- 기간·창 ---------- */
test('plan — 오늘 −45일 창(양끝 포함) 밖·미래 메일은 안 본다', () => {
  const r = A.plan(one([mail(11, '', ['서명본.pdf'], '2026-09-07'), mail(12, '', ['서명본2.pdf'], '2026-09-06'), mail(13, '', ['서명본3.pdf'], '2026-10-23'), mail(14, '', ['서명본4.pdf'], '2026-10-22')]));
  assert.deepEqual([r.scanned, r.actions.map((a) => a.mailKey)], [2, [mkey(11)]], '45일 전과 오늘만 · 같은 줄은 오래된 쪽이 이김');
  assert.deepEqual(r.unmatched.map((u) => u.mailKey), [mkey(14)]);
});
test('plan — 그 사업 기간(첫 회차 −30일 ~ 마지막 회차 +90일) 밖 메일은 그 사업 것으로 보지 않는다(skipped.noLine)', () => {
  const w = world({ cos: [{ id: 'c1', name: '가나상사', types: ['t3'], email: 'gana@example.com', dates: { t3: ['2026-03-01', '2026-03-15'] } }], mails: [mail(11, '', ['서명본.pdf'])] });
  const r = A.plan(w);
  assert.deepEqual([r.actions.length, r.unmatched.length, r.skipped.noLine], [0, 0, 1]);
});
test('plan — years: 기본은 [올해, 작년](작년에 시작해 올해까지 이어진 사업 포함) · 주면 그 해만', () => {
  const cos = [{ id: 'c1', name: '가나상사', types: ['t3'], email: 'gana@example.com', dates: { t3: ['2025-12-20', '2026-08-30'] } }];
  const w = world({ cos, mails: [mail(11, '', ['서명본.pdf'])] });
  const r = A.plan(w);
  assert.deepEqual(r.actions.map((a) => a.rid), ['t3_2025']);
  assert.equal(A.plan(Object.assign({}, w, { years: ['2026'] })).scanned, 0);
  assert.equal(A.plan(Object.assign({}, w, { years: ['2025'] })).actions.length, 1);
  assert.equal(A.plan(Object.assign({}, w, { years: [] })).actions.length, 0);
  assert.equal(A.plan(Object.assign({}, w, { years: ['xx', '2025', '2025'] })).actions.length, 1);
});

/* ---------- 연결된 메일·같은 메일 ---------- */
test('plan — 이미 어느 줄에든 연결된 메일은 안 본다(skipped.linked) · 폴더를 옮겨 열쇠만 바뀐 같은 메일도(skipped.dup)', () => {
  const m = mail(11, '', ['서명본.pdf']);
  const linkedElsewhere = one([m], { items: { c9: { t9_2026: { sign: { st: 'done', by: '홍길동', at: 1, link: { src: 'mail', key: mkey(11) } } } } } });
  assert.deepEqual([A.plan(linkedElsewhere).actions.length, A.plan(linkedElsewhere).skipped.linked], [0, 1]);
  /* 같은 메일이 받은함(11)과 보관함(5)에 둘 다 있다 — 한쪽이 이미 연결됐으면 다른 쪽은 같은 메일 */
  const moved = one([m, Object.assign(mail(5, '', ['서명본.pdf'], '2026-10-10', undefined, ARCH))],
    { items: { c1: { t3_2026: { attach: { st: 'done', by: '홍길동', at: 1, link: { src: 'mail', key: mkey(11) } } } } } });
  const r = A.plan(moved);
  assert.deepEqual([r.actions.length, r.skipped.linked, r.skipped.dup], [0, 1, 1]);
  /* 둘 다 아직이면 하나만(열쇠가 앞선 쪽) */
  const both = A.plan(one([m, mail(5, '', ['서명본.pdf'], '2026-10-10', undefined, ARCH)]));
  assert.deepEqual([both.actions.map((a) => a.mailKey), both.skipped.dup, both.unmatched.length], [[mkey(5, ARCH)], 1, 0]);
});

/* ---------- 두 사업(쌍)이 후보일 때 ---------- */
const DARA2 = { id: 'c2', name: '다라정밀', types: ['t3', 't4'], email: 'dara@example.com' };
const dm = (uid, s, an, day) => mail(uid, s, an, day || '2026-10-10', 'dara@example.com');
test('plan — 한 업체가 둘 이상의 사업에 후보면 줄 이름·꼬리표가 없을 때 안 쓴다(unmatched, rid 없음)', () => {
  const r = A.plan(world({ cos: [DARA2], mails: [dm(11, '', ['서명본.pdf'])] }));
  assert.deepEqual(r.actions, []);
  assert.equal(r.unmatched.length, 1);
  assert.deepEqual([r.unmatched[0].coId, r.unmatched[0].rid], ['c2', '']);
});
test('plan — 같은 점수의 두 사업(둘 다 «업체 서명본» 줄)이면 둘 다 안 쓴다', () => {
  const r = A.plan(world({ cos: [DARA2], mails: [dm(11, '', ['업체 서명본.pdf'])] }));
  assert.deepEqual(r.actions, []);
  assert.equal(r.unmatched.length, 1);
});
test('plan — 서명요청 꼬리표 [서명요청:rid] 가 그 쌍을 못 박는다 · 모르는 rid 는 안 쓴다 · [제출:…] 받은 메일은 안 본다', () => {
  const r = A.plan(world({ cos: [DARA2], mails: [dm(11, 'RE: [서명요청:t4_2026] 일정', ['문서.pdf'], '2026-10-10')] }));
  assert.deepEqual(r.actions.map((a) => [a.rid, a.key, a.step]), [['t4_2026', 'sign', 'sign']]);
  assert.match(r.actions[0].why, /꼬리표/);
  const unknown = A.plan(world({ cos: [DARA2], mails: [dm(12, 'RE: [서명요청:t9_2026] 일정', ['문서.pdf'])] }));
  assert.deepEqual([unknown.actions.length, unknown.unmatched.length], [0, 1]);
  const submit = A.plan(world({ cos: [DARA2], mails: [dm(13, 'RE: [제출:t4_2026] 접수', ['사진.jpg'])] }));
  assert.deepEqual([submit.actions.length, submit.unmatched.length, submit.skipped.submitTag], [0, 0, 1]);
  /* 꼬리표가 가리키는 쌍의 줄이 사람 손이면 다른 쌍으로 새지 않는다 */
  const touched = A.plan(world({ cos: [DARA2], mails: [dm(14, 'RE: [서명요청:t4_2026] 일정', ['문서.pdf'])],
    items: { c2: { t4_2026: { sign: { st: 'doing', by: '홍길동', sentAt: '2026-10-01', at: 1 } } } } }));
  assert.deepEqual([touched.actions.length, touched.unmatched.length], [0, 1]);
  assert.equal(touched.unmatched[0].rid, 't4_2026');
});
test('plan — 두 사업이어도 줄 이름이 한쪽에만 맞으면 그쪽(농촌융복합 «현장 사진» · 충남북부 «산출물 별첨»)', () => {
  const co = { id: 'c3', name: '마바산업', types: ['t3', 't6'], email: 'ma@example.com' };
  const mm = (uid, s, an) => mail(uid, s, an, '2026-10-10', 'ma@example.com');
  const r = A.plan(world({ cos: [co], mails: [mm(11, '현장 사진 보냅니다', ['IMG_01.jpg']), mm(12, '', ['산출물 별첨 자료.pdf']), mm(13, '', ['사진.jpg'])] }));
  assert.deepEqual(r.actions.map((a) => [a.mailKey, a.rid, a.key]), [[mkey(11), 't6_2026', 'photo'], [mkey(12), 't3_2026', 'attach']]);
  assert.deepEqual(r.unmatched.map((u) => u.mailKey), [mkey(13)], '이름 단서가 없는 사진은 안 쓴다');
});

/* ---------- 대형 틀 ---------- */
test('plan — 대형(일터상생혁신): 서명 줄(참여 안내서)은 서명본 첨부가 쓴다 · 플랫폼 입력·보고서 줄은 메일로 완료하지 않는다', () => {
  const co = { id: 'c4', name: '사아테크', types: ['t2'], email: 'saa@example.com' };
  const r = A.plan(world({ cos: [co], mails: [mail(11, '', ['참여 안내서 서명본.pdf'], '2026-10-10', 'saa@example.com'),
    mail(12, '', ['3회차 수행보고서.pdf'], '2026-10-11', 'saa@example.com'), mail(13, '', ['착수보고 사진.jpg'], '2026-10-12', 'saa@example.com')] }));
  assert.deepEqual(r.actions.map((a) => [a.rid, a.key, a.step]), [['t2_2026', 'guide', 'sign']]);
  assert.equal(r.skipped.noStep, 1, '3회차 수행보고서.pdf 는 단계 모름');
  assert.equal(r.skipped.noLine, 1, '대형 틀에는 별첨(attach) 줄이 없다');
  assert.equal(r.unmatched.length, 0);
});

/* ---------- 회차마다 줄이 있는 별첨(합성 틀 — 실제 틀 중 sign·attach 회차 줄은 기술보호뿐이라 자동이 안 쓴다) ---------- */
test('plan — 회차마다 줄이 있는 별첨 단계: 번호가 그 회차 줄을 고르고, 번호 없으면 안 쓴다(합성 틀을 잠깐 끼워 넣는다)', () => {
  const syn = { key: 'syn-round', words: ['합성회차틀'], kind: '간단', source: '', items: [
    { id: 'dj', name: '합성 일지', per: 'round', step: 'attach' }, { id: 'dc', name: '합성 확인서', per: 'once', step: 'attach' }] };
  D.DOC_PLANS.unshift(syn);
  const biz = BIZ.concat([{ code: 'consulting-90', name: '합성회차틀컨설팅', short: '', agency: '', sortOrder: 90 }]);
  try {
    const w = world({ cos: [{ id: 'c5', name: '차나공업', types: ['t8'], email: 'cha@example.com' }],
      mails: [mail(11, '', ['2회차 사진.jpg'], '2026-10-10', 'cha@example.com'), mail(12, '', ['5회차 사진.jpg'], '2026-10-11', 'cha@example.com'),
        mail(13, '', ['사진.jpg'], '2026-10-12', 'cha@example.com'), mail(14, '', ['합성 확인서 사진.jpg'], '2026-10-13', 'cha@example.com'),
        mail(15, '', ['3회차 사진.jpg'], '2026-10-14', 'cha@example.com')],
      items: { c5: { t8_2026: { 'dj:3': { st: 'done', by: '홍길동', at: 1 } } } } });
    w.docs.biz = biz; w.docs.tmap = Object.assign({}, TMAP, { 'consulting-90': 't8' }); w.input.types.push({ id: 't8', name: 't8', fullName: 't8', rounds: 3 });
    const r = A.plan(w);
    assert.deepEqual(r.actions.map((a) => [a.mailKey, a.key]), [[mkey(11), 'dj:2'], [mkey(14), 'dc']]);
    assert.deepEqual(r.unmatched.map((u) => u.mailKey), [mkey(12), mkey(13), mkey(15)], '5회차(없음)·번호 없음·3회차(사람 손)는 안 쓴다');
  } finally { D.DOC_PLANS.shift(); }
  assert.notEqual(D.DOC_PLANS[0].key, 'syn-round');
});

/* ---------- 상한 ---------- */
function crowd(n, mk) {
  const cos = [], mails = [];
  for (let i = 0; i < n; i++) {
    const id = 'c' + String(100 + i), em = 'co' + i + '@example.com';
    cos.push({ id, name: '합성상사' + String(100 + i), types: ['t3'], email: em });
    mails.push(mk(i, em));
  }
  return { cos, mails };
}
test('plan — 100줄 상한: 오래된 메일부터 100건 · more · 나머지는 다음 실행 몫', () => {
  const spec = crowd(120, (i, em) => mail(1000 + i, '', ['서명본.pdf'], '2026-09-' + String(10 + (i % 20)), em));
  const w = world(spec);
  const r = A.plan(w);
  assert.deepEqual([r.actions.length, r.more, r.scanned], [100, true, 120]);
  const all = spec.mails.map((m) => ({ k: mkey(m.uid), d: ms(m.day) })).sort((a, b) => (a.d - b.d) || (a.k < b.k ? -1 : 1)).slice(0, 100).map((x) => x.k);
  assert.deepEqual(r.actions.map((a) => a.mailKey), all, '오래된 것부터(같은 날은 열쇠 순)');
  const exact = A.plan(world(crowd(100, (i, em) => mail(2000 + i, '', ['서명본.pdf'], '2026-10-01', em))));
  assert.deepEqual([exact.actions.length, exact.more], [100, false], '딱 100 이면 more 아님');
});
test('plan — unmatched 도 최대 100(넘으면 skipped.unmatchedCut)', () => {
  const spec = crowd(120, (i, em) => mail(3000 + i, '', ['업체 서명본.pdf'], '2026-10-01', em));
  spec.items = {};
  spec.cos.forEach((c) => { spec.items[c.id] = { t3_2026: { sign: { st: 'doing', by: '홍길동', sentAt: '2026-09-30', at: 1 } } }; });
  const r = A.plan(world(spec));
  assert.deepEqual([r.actions.length, r.unmatched.length, r.skipped.unmatchedCut], [0, 100, 20]);
});

/* ---------- 긴 첨부 이름 ---------- */
test('plan — 긴 첨부 이름: 메모는 200자 이내(» 로 닫힘) · 연결 이름 100자 · 규칙 모양을 지킨다', () => {
  const name = '서명본' + '가'.repeat(220) + '.pdf';
  const r = A.plan(one([mail(11, '', [name])]));
  const a = r.actions[0];
  assert.ok(a.next.note.length <= T.NOTE_MAX);
  assert.ok(a.next.note.startsWith('자동 처리 — 메일 «') && a.next.note.endsWith('»'));
  assert.equal(a.next.link.name.length, T.LINK_NAME_MAX);
  assert.equal(T.validate(a.next, a.step), '');
  assert.deepEqual(T.put({}, a.coId, a.rid, a.key, a.next)[a.coId][a.rid][a.key], a.next);
  assert.ok(a.mailKey.length <= T.LINK_KEY_MAX);
});

/* ---------- 입력 불변·객체 비공유 ---------- */
test('plan — 입력을 바꾸지 않는다(JSON 비교) · 결과가 입력과 객체를 나눠 쓰지 않는다 · 같은 입력이면 같은 결과', () => {
  const spec = { cos: [GANA, DARA2, { id: 'c3', name: '마바산업', types: ['t3', 't6'], email: 'ma@example.com' }],
    mails: [mail(11, '', ['서명본.pdf', '사진.jpg']), dm(12, '', ['업체 서명본.pdf']), mail(13, '', ['서명본2.pdf'], '2026-10-12'),
      mail(14, '', ['9월 급여대장.pdf']), mail(15, '', ['IMG.jpg'], '2026-10-11', 'ma@example.com'), mail(16, '현장 사진', ['a.jpg'], '2026-10-11', 'ma@example.com')],
    items: { c1: { t3_2026: { attach: { st: 'none', at: 5 } } } } };
  const w = world(spec);
  w.years = ['2026', '2025'];
  const snap = clone(w);
  const inputObjs = objects(w);
  const r = A.plan(w);
  assert.ok(r.actions.length >= 2 && r.unmatched.length >= 1, '비어 있지 않은 결과로 견준다');
  assert.deepEqual(clone(w), snap, '입력 불변');
  objects(r).forEach((o) => assert.ok(!inputObjs.has(o), '결과 객체가 입력 객체와 같은 것을 가리킨다'));
  assert.deepEqual(clone(A.plan(w)), clone(r), '결정적');
  r.actions[0].next.st = 'x'; r.actions.forEach((a) => { if (a.prev) a.prev.st = 'x'; });
  assert.deepEqual(clone(w), snap, '결과를 고쳐도 입력은 그대로');
});
