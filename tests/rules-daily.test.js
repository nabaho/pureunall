/* 취업규칙 「🤖 매일 정리」 셈 (설계 §14 · 2026-10-31 목업 「추천대로」). 회사·사람은 지어낸 것만.
   ★ 못 박는 것은 규칙이다:
     ① 저절로 확정하는 것 — 주소 일치·일괄 가능(단계 1) · 사람이 앞서 확정한 주소(단계 2)
     ② 저절로 확정하지 «않는» 것 — 도메인만 · 섞인 묶음 · 우리 쪽 주소 · 갈래 기타 · 끝난 업체 · 사람이 손댄 서류 · 되돌린 주소
        · 자동 확정만 있는 주소(자동이 다시 근거가 되어 번지면 안 된다)
     ③ 한도 — 최근 것부터, 넘친 수는 more 로
     ④ 처리 담당 — 메일함 담당 → 업체 주담당 → 못 정함
     ⑤ 하루 기록 — 오늘 담은 서류·메일 수 · 오늘 자동 확정 · 시범이면 «했을 것» · 확인 필요 · 담당별 · 주소·제목 없음
     ⑥ 스위치 — 안 정했거나 이상한 값이면 시범(dry) */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/rules-v2/lib-daily.js');

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 31, 3, 0, 0);   // 서울 2026-10-31 12:00
const CO = [
  { id: 'c1', name: '가나정밀', managerMain: 'P-002' },
  { id: 'c2', name: '다라물산', managerMain: 'P-003' },
  { id: 'c3', name: '마바건설', managerMain: '' },
  { id: 'c4', name: '사아상사', status: 'closed', managerMain: 'P-002' },
];
let n = 0;
/* 서류 하나 — 상대 주소(받음이면 from), 서버가 짚은 후보(cand) */
function doc(o) {
  n++;
  const id = o.id || 'rd_' + n;
  return [id, { name: o.name || '취업규칙_' + n + '.hwp', kind: o.kind || '규칙본문', status: '담김', dir: o.dir || '받음',
    mail: { src: 'imap', box: 'INBOX', key: o.mk || String(n), date: o.date || NOW - DAY, from: o.from || '', to: o.to || '', subject: o.subject || '개정 검토 요청' },
    companyCand: o.cand || [], createdAt: o.created || NOW - DAY, owner: o.owner }];
}
function data(list, human) {
  const docs = {};
  list.forEach(([id, d]) => { docs[id] = d; });
  return { docs, human: human || {} };
}
const ids = (p) => p.link.map((x) => x.docId).sort();

test('① 주소 일치·일괄 가능 — 묶음의 모든 서류가 등록된 주소로 그 한 회사를 가리키면 확정', () => {
  const d = data([doc({ id: 'a1', from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }] }),
    doc({ id: 'a2', from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }] })]);
  const p = D.plan(d, CO);
  assert.deepEqual(ids(p), ['a1', 'a2']);
  assert.ok(p.link.every((x) => x.companyId === 'c1' && /주소/.test(x.why)));
});

test('① 사람이 앞서 확정한 주소 — 같은 주소의 새 서류를 그 회사로', () => {
  const d = data([doc({ id: 'old', from: 'boss@dara.kr' }), doc({ id: 'new', from: 'boss@dara.kr' })],
    { old: { id: 'old', companyId: 'c2', companyLinkStatus: 'linked', linkedBy: 'P-002', linkedAt: NOW - 30 * DAY } });
  const p = D.plan(d, CO);
  assert.deepEqual(ids(p), ['new']);
  assert.equal(p.link[0].companyId, 'c2');
  assert.match(p.link[0].why, /앞서/);
});

test('② 자동 확정만 있는 주소는 근거가 아니다 — 자동이 스스로 번지지 않는다', () => {
  const d = data([doc({ id: 'old', from: 'boss@dara.kr' }), doc({ id: 'new', from: 'boss@dara.kr' })],
    { old: { id: 'old', companyId: 'c2', companyLinkStatus: 'linked', linkedBy: D.AUTO_BY, linkedAt: NOW - DAY } });
  assert.deepEqual(ids(D.plan(d, CO)), []);
});

test('② 도메인만 · 후보 둘 · 우리 쪽 주소 · 갈래 기타 는 사람에게 남긴다', () => {
  const d = data([
    doc({ id: 'dom', from: 'x@saa.kr', cand: [{ companyId: 'c3', why: '도메인' }] }),
    doc({ id: 'two', from: 'y@maba.kr', cand: [{ companyId: 'c1', why: '주소' }, { companyId: 'c3', why: '주소' }] }),
    doc({ id: 'ours', from: '370-6@daum.net', cand: [{ companyId: 'c1', why: '주소' }] }),
    doc({ id: 'etc', kind: '기타', from: 'z@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }] }),
  ]);
  const p = D.plan(d, CO);
  assert.deepEqual(ids(p), [], '약한 근거로 확정했다');
  assert.ok(p.skip.weak >= 3);
});

test('② 일괄 불가(묶음 안에 주소 근거 없는 서류가 섞임)면 확정하지 않는다', () => {
  const d = data([doc({ id: 'b1', from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }] }),
    doc({ id: 'b2', from: 'hr@gana.co.kr', cand: [] })]);
  assert.deepEqual(ids(D.plan(d, CO)), []);
});

test('② 끝난 업체는 확정하지 않는다', () => {
  const d = data([doc({ id: 'cl', from: 'a@saa.kr', cand: [{ companyId: 'c4', why: '주소' }] })]);
  const p = D.plan(d, CO);
  assert.deepEqual(ids(p), []);
  assert.equal(p.skip.left, 1);
});

test('② 사람이 손댄 서류(풀기·미확정으로 둠)는 덮지 않는다', () => {
  const d = data([doc({ id: 't1', from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }] }),
    doc({ id: 't2', from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }] })],
    { t1: { id: 't1', companyId: null, companyLinkStatus: 'pending', linkedBy: 'P-002', linkedAt: NOW - DAY } });
  const p = D.plan(d, CO);
  assert.deepEqual(ids(p), ['t2']);
  assert.equal(p.skip.touched, 1);
});

test('② 되돌린 주소 — 그 주소의 서류는 다시 자동 확정하지 않는다', () => {
  const d = data([doc({ id: 'u1', from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }] }),
    doc({ id: 'u2', from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }] }),
    doc({ id: 'u3', from: 'other@dara.kr', cand: [{ companyId: 'c2', why: '주소' }] })],
    { u1: { id: 'u1', companyId: null, companyLinkStatus: 'pending', linkedBy: 'P-001', linkedAt: NOW, noAuto: true } });
  const p = D.plan(d, CO);
  assert.deepEqual(ids(p), ['u3'], '되돌린 주소를 또 확정했다');
  assert.ok(p.skip.undone >= 1);
});

test('③ 한도 — 최근 것부터, 넘친 수는 more', () => {
  const list = [];
  for (let i = 0; i < 7; i++) list.push(doc({ id: 'm' + i, from: 'hr@gana.co.kr', date: NOW - i * DAY, cand: [{ companyId: 'c1', why: '주소' }] }));
  const p = D.plan(data(list), CO, { max: 3 });
  assert.deepEqual(p.link.map((x) => x.docId), ['m0', 'm1', 'm2']);
  assert.equal(p.more, 4);
});

test('④ 처리 담당 — 메일함 담당 → 업체 주담당 → 못 정함', () => {
  const coById = { c1: CO[0], c3: CO[2] };
  const nameOf = (sid) => ({ 'P-002': '점검노무' })[sid] || '';
  assert.equal(D.ownerOf({ owner: { who: '점검사무장', why: 'hand' } }, { companyLinkStatus: 'linked', companyId: 'c1' }, coById, nameOf).who, '점검사무장');
  const byCo = D.ownerOf({ owner: { who: '' } }, { companyLinkStatus: 'linked', companyId: 'c1' }, coById, nameOf);
  assert.equal(byCo.who, '점검노무');
  assert.equal(byCo.why, 'co');
  assert.equal(D.ownerOf({}, { companyLinkStatus: 'pending', companyId: 'c1' }, coById, nameOf).who, '', '미확정 사업장의 주담당을 붙였다');
  assert.equal(D.ownerOf({}, { companyLinkStatus: 'linked', companyId: 'c3' }, coById, nameOf).who, '');
});

test('⑤ 하루 기록 — 오늘 담은 것 · 오늘 자동 확정 · 시범이면 «했을 것» · 확인 필요 · 담당별 · 주소·제목 없음', () => {
  const d = data([
    doc({ id: 'd1', mk: 'm1', from: 'hr@gana.co.kr', created: NOW - 3600e3, cand: [{ companyId: 'c1', why: '주소' }], owner: { who: '점검노무' } }),
    doc({ id: 'd2', mk: 'm1', from: 'hr@gana.co.kr', created: NOW - 3600e3, cand: [{ companyId: 'c1', why: '주소' }] }),
    doc({ id: 'd3', mk: 'm2', from: 'x@saa.kr', created: NOW - 1800e3, cand: [{ companyId: 'c3', why: '도메인' }] }),
    doc({ id: 'd4', mk: 'm3', kind: '기타', from: 'x@saa.kr', created: NOW - 600e3 }),
    doc({ id: 'old', mk: 'm0', from: 'z@dara.kr', created: NOW - 5 * DAY }),
  ], { old: { id: 'old', companyId: 'c2', companyLinkStatus: 'linked', linkedBy: D.AUTO_BY, linkedAt: NOW - 600e3 } });
  const p = D.plan(d, CO);
  const s = D.summary(d, CO, { now: NOW, mode: 'dry', plan: p, nameOf: (sid) => ({ 'P-002': '점검노무' })[sid] || '' });
  assert.equal(s.date, '2026-10-31');
  assert.equal(s.docs, 4, '오늘 담은 서류');
  assert.equal(s.mails, 3, '오늘 메일(겹치지 않게)');
  assert.equal(s.linked, 1, '오늘 자동 확정(사람 칸)');
  assert.equal(s.would, p.link.length + p.more);
  assert.ok(s.would >= 2);
  assert.equal(s.need, 1, '자동 대상이 아닌 미확정(도메인만) — 기타는 세지 않는다');
  assert.equal(s.byOwner['점검노무'], 1);
  assert.ok(s.noOwner >= 2, '담당 못 정함(기타는 빼고)');
  assert.ok(!/@|개정 검토/.test(JSON.stringify(s)), '기록에 메일 주소·제목이 들어갔다');
  assert.equal(D.summary(d, CO, { now: NOW, mode: 'live', plan: p }).would, 0, '켜짐인데 «했을 것»을 셌다');
});

test('⑥ 스위치 — 안 정했거나 이상한 값이면 시범', () => {
  assert.equal(D.modeOf(null), 'dry');
  assert.equal(D.modeOf({ mode: 'yes' }), 'dry');
  assert.equal(D.modeOf({ mode: 'live' }), 'live');
  assert.equal(D.modeOf({ mode: 'off' }), 'off');
  assert.equal(D.dayKey(Date.UTC(2026, 9, 30, 15, 30)), '2026-10-31', '서울 날짜가 아니다');
});
