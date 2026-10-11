'use strict';
/* 컨설팅보고서 앱 — 서류 진행 기록(③서명본·④별첨·⑤제출) 순수 함수 (2026-10-10)
 * ★ 지키는 것: 줄 키 꼴 · 모양 틀린 줄은 읽기에서 버림 · «막힘 > 완료 > 진행 > 없음»(해당없음 뺌) ·
 *   칸마다 고를 수 있는 상태 · 날짜 꼴·메모 200자 · 저장 꼴은 저장 관문을 통과하는 .set 한 줄
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const Tr = require('../js/pu-gov-report-track.js');
const D = require('../js/pu-gov-report-docs.js');
const W = require('../js/pu-ontology-write.js');

const T0 = '2026-10-10';
const NORTH = D.planFor('인사노무컨설팅충남북부상의');
const TG = D.planFor('통합기술보호지원단');

test('상수 — 상태 다섯 · 칸마다 고를 수 있는 상태 · 방식 넷 · 한도', () => {
  assert.deepEqual(Tr.STATES, ['none', 'doing', 'done', 'blocked', 'na']);
  assert.deepEqual(Tr.ALLOWED, { sign: ['none', 'doing', 'done', 'blocked'], attach: ['none', 'doing', 'done', 'na'],
    submit: ['none', 'doing', 'done', 'blocked'] });
  assert.deepEqual(Tr.STEPS, ['sign', 'attach', 'submit']);
  assert.deepEqual(Object.keys(Tr.HOW), ['mail', 'platform', 'post', 'other']);
  assert.equal(Tr.NOTE_MAX, 200);
  assert.equal(Tr.BY_MAX, 40);
  assert.equal(Tr.WAIT_SIGN_DAYS, 7);
  assert.equal(Tr.SAVE_FAIL, '저장하지 못했습니다 — 규칙 게시 또는 권한 확인');
  assert.equal(Tr.LOAD_FAIL, '기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인');
  assert.equal(Tr.COL_KO.sign, '③ 업체 서명본');
});

test('keyOf · keysFor — 줄 id, 회차마다면 id:회차 · 월별 줄은 넣지 않는다', () => {
  assert.equal(Tr.keyOf({ id: 'sign' }, 0), 'sign');
  assert.equal(Tr.keyOf({ id: 'advice' }, 2), 'advice:2');
  const a = Tr.keysFor(TG, 'attach', 3);
  assert.deepEqual(a.map((k) => k.key), ['advice:1', 'advice:2', 'advice:3', 'pledge', 'travel', 'survey']);
  assert.equal(a[0].name, '법률 자문 일지 1회차');
  assert.equal(a[3].name, '보안서약서');
  assert.deepEqual(Tr.keysFor(TG, 'sign', 3), [], '기술보호에는 서명본 줄이 없다');
  assert.deepEqual(Tr.keysFor(NORTH, 'submit', 3).map((k) => k.key), ['submit']);
  assert.deepEqual(Tr.keysFor(D.planFor('산업일자리전환컨설팅충남'), 'report', 3).map((k) => k.key), ['result', 'after']);
  assert.deepEqual(Tr.keysFor(null, 'sign', 1), []);
});

test('normalize — 모양 틀린 줄·모르는 상태·나쁜 키는 버리고 items 를 걷어 낸다', () => {
  const raw = {
    c1: { t1_2026: { u: 9, items: {
      submit: { st: 'doing', at: 5, note: '  메모  ', how: 'mail', ack: true, sentAt: '2026/09/01', extra: 1 },
      'advice:2': { st: 'done', gotAt: '2026-09-02', by: '홍길동' },
      'BAD KEY': { st: 'done', at: 1 },
      abcdefghijklmnopqrstu: { st: 'done', at: 1 },
      pledge: { st: 'weird', at: 1 },
      survey: 'x',
      travel: { st: 'none', at: 1, how: 'constructor', ack: 'yes' },
    } } },
    c2: 'x',
    c3: { r: null },
  };
  assert.deepEqual(Tr.normalize(raw), { c1: { t1_2026: {
    submit: { st: 'doing', at: 5, note: '메모', how: 'mail', ack: true },
    'advice:2': { st: 'done', at: 0, gotAt: '2026-09-02', by: '홍길동' },
    travel: { st: 'none', at: 1 },
  } } });
  assert.deepEqual(Tr.normalize(null), {});
  assert.deepEqual(Tr.normalize([1, 2]), {});
  const long = Tr.normalize({ c: { r: { items: { k: { st: 'done', at: 1, note: '가'.repeat(250), by: '나'.repeat(50) } } } } }).c.r.k;
  assert.equal(long.note.length, 200);
  assert.equal(long.by.length, 40);
});

test('recOf · put — 없으면 빈 객체, put 은 원본을 바꾸지 않고 나쁜 키는 무시', () => {
  const a = Tr.normalize(null);
  const b = Tr.put(a, 'c1', 't1_2026', 'submit', { st: 'done', at: 3 });
  assert.deepEqual(a, {});
  assert.deepEqual(b, { c1: { t1_2026: { submit: { st: 'done', at: 3 } } } });
  assert.deepEqual(Tr.put(b, 'c1', 't1_2026', 'BAD KEY', { st: 'done', at: 1 }), b);
  assert.equal(Tr.recOf(b, 'c1', 't1_2026').submit.st, 'done');
  assert.deepEqual(Tr.recOf(b, 'cx', 'r'), {});
  assert.deepEqual(Tr.recOf(null, 'a', 'b'), {});
});

test('stateOf — 막힘 > 완료 > 진행 > 없음, 해당없음은 빼고 센다', () => {
  assert.equal(Tr.stateOf([]), 'none');
  assert.equal(Tr.stateOf(['na', 'na']), 'na');
  assert.equal(Tr.stateOf(['done', 'blocked']), 'blocked');
  assert.equal(Tr.stateOf(['done', 'na', 'done']), 'done');
  assert.equal(Tr.stateOf(['none', 'done']), 'doing');
  assert.equal(Tr.stateOf(['doing']), 'doing');
  assert.equal(Tr.stateOf(['none', 'none']), 'none');
  assert.equal(Tr.stateOf(['x']), 'none');
});

test('label — 칸마다 말이 다르다', () => {
  assert.equal(Tr.label('sign', 'doing'), '◐ 발송함');
  assert.equal(Tr.label('sign', 'done'), '● 회신 받음');
  assert.equal(Tr.label('submit', 'doing'), '◐ 제출 준비');
  assert.equal(Tr.label('submit', 'done'), '● 제출함');
  assert.equal(Tr.label('attach', 'done'), '● 완료');
  assert.equal(Tr.label('attach', 'na'), '— 해당없음');
  assert.equal(Tr.label('sign', 'blocked'), '✕ 막힘');
  assert.equal(Tr.label('attach', 'none'), '○ 없음');
});

test('cellFor · itemChip — 칸 상태·딱지 이름·회신 N일째·여러 서류는 완료/전체', () => {
  const rec = { sign: { st: 'doing', sentAt: '2026-09-20', at: 1 } };
  assert.deepEqual(Tr.cellFor(NORTH, rec, 'sign', 3, T0), { step: 'sign', st: 'doing', txt: '◐ 발송함 · 회신 20일째', key: 'draft',
    done: 0, total: 1, wait: 20, keys: ['sign'] });
  assert.equal(Tr.cellFor(NORTH, rec, 'sign', 3, '2026-09-25').txt, '◐ 발송함 · 회신 5일째');
  const tg = { 'advice:1': { st: 'done', at: 1 }, 'advice:2': { st: 'done', at: 1 }, 'advice:3': { st: 'doing', at: 1 },
    pledge: { st: 'na', at: 1 }, travel: { st: 'done', at: 1 }, survey: { st: 'done', at: 1 } };
  const c = Tr.cellFor(TG, tg, 'attach', 3, T0);
  assert.deepEqual([c.st, c.txt, c.key, c.done, c.total], ['doing', '◐ 진행 4/5', 'draft', 4, 5]);
  assert.equal(Tr.cellFor(TG, tg, 'sign', 3, T0), null, '기술보호에는 ③ 이 없다');
  const na = Tr.cellFor(NORTH, { attach: { st: 'na', at: 1 } }, 'attach', 3, T0);
  assert.deepEqual([na.st, na.txt, na.key, na.total], ['na', '— 해당없음', '', 0]);
  const none = Tr.cellFor(NORTH, {}, 'submit', 3, T0);
  assert.deepEqual([none.st, none.txt, none.key], ['none', '○ 없음', 'wait']);
  const got = Tr.cellFor(NORTH, { sign: { st: 'done', sentAt: '2026-09-01', gotAt: '2026-09-03', at: 1 } }, 'sign', 3, T0);
  assert.deepEqual([got.txt, got.key, got.wait], ['● 회신 받음', 'done', null]);
  const advice = TG.items.filter((x) => x.id === 'advice')[0];
  assert.deepEqual(Tr.itemChip(advice, { 'advice:1': { st: 'done', at: 1 }, 'advice:2': { st: 'done', at: 1 } }, 3, T0),
    { txt: '◐ 진행 2/3', key: 'draft' });
});

test('rowTrack · kpiHit · kpiExtra · alertsExtra — 서명은 진행·완료, 제출은 완료 · 회신 7일 «넘게» · 기한 지남', () => {
  const rows = [
    { coName: '가나상사', trk: Tr.rowTrack(TG, {}, 3, '2026-09-30T09:00:00', T0) },
    { coName: '다라정밀', trk: Tr.rowTrack(NORTH, { sign: { st: 'doing', sentAt: '2026-09-20', at: 1 } }, 3, '2026-12-31', T0) },
    { coName: '마바산업', trk: Tr.rowTrack(NORTH, { sign: { st: 'done', sentAt: '2026-05-20', gotAt: '2026-05-25', at: 1 },
      submit: { st: 'done', gotAt: '2026-05-28', at: 1 } }, 3, '2026-06-30', T0) },
    { coName: '사아테크', trk: Tr.rowTrack(NORTH, { sign: { st: 'doing', sentAt: '2026-10-03', at: 1 } }, 3, '', T0) },
    { coName: '없음', trk: null },
  ];
  assert.equal(rows[0].trk.due, '2026-09-30');
  assert.equal(rows[0].trk.sign, null);
  assert.deepEqual([rows[1].trk.waitDays, rows[1].trk.bar3, rows[1].trk.bar4], [20, false, false]);
  assert.deepEqual([rows[2].trk.bar3, rows[2].trk.bar4], [true, true]);
  assert.deepEqual([rows[3].trk.waitDays], [7], '딱 7일은 «넘은» 것이 아니다');
  const tgDone = Tr.rowTrack(TG, { submit: { st: 'done', at: 1 } }, 3, '', T0);
  assert.deepEqual([tgDone.bar3, tgDone.bar4], [true, true], '③ 이 없는 틀은 ⑤ 를 따른다');
  assert.deepEqual(Tr.kpiExtra(rows), { signed: 3, submitted: 1 });
  assert.equal(Tr.kpiHit({ trk: Tr.rowTrack(NORTH, { sign: { st: 'blocked', at: 1 } }, 3, '', T0) }, 'signed'), false, '막힘은 서명에 안 센다');
  assert.equal(Tr.kpiHit(rows[4], 'signed'), false);
  const a = Tr.alertsExtra(rows, T0);
  assert.deepEqual(a.waitSign.map((x) => x.row.coName + ':' + x.days), ['다라정밀:20']);
  assert.deepEqual(a.overdue.map((x) => x.row.coName + ':' + x.due), ['가나상사:2026-09-30']);
  assert.deepEqual(Tr.alertsExtra(null, T0), { waitSign: [], overdue: [] });
});

test('validate — 칸마다 고를 수 있는 상태 · 날짜 꼴 · 회신일 ≥ 발송일 · 방식 · 메모 200자', () => {
  assert.equal(Tr.validate({ st: 'done' }, 'sign'), '');
  assert.equal(Tr.validate({ st: 'na' }, 'sign'), '이 칸에서 고를 수 없는 상태입니다');
  assert.equal(Tr.validate({ st: 'blocked' }, 'attach'), '이 칸에서 고를 수 없는 상태입니다');
  assert.equal(Tr.validate({ st: 'done' }, 'report'), '이 칸에서 고를 수 없는 상태입니다');
  assert.equal(Tr.validate({ st: 'doing', sentAt: '2026/09/01' }, 'sign'), '날짜는 YYYY-MM-DD 꼴로 적어 주세요');
  assert.equal(Tr.validate({ st: 'done', sentAt: '2026-09-10', gotAt: '2026-09-01' }, 'sign'), '회신일이 발송일보다 앞섭니다');
  assert.equal(Tr.validate({ st: 'done', how: 'fax' }, 'submit'), '제출 방식을 다시 골라 주세요');
  assert.equal(Tr.validate({ st: 'done', note: '가'.repeat(201) }, 'attach'), '메모는 200자까지입니다');
  assert.equal(Tr.validate({ st: 'done', note: '가'.repeat(200) }, 'attach'), '');
  assert.equal(Tr.validate(null, 'sign'), '이 칸에서 고를 수 없는 상태입니다');
});

test('patchFor — 빈 값은 빼고 at·by 를 붙인다 · normalize 를 지나도 같다', () => {
  const p = Tr.patchFor({ st: 'done', sentAt: '2026-09-20', gotAt: '2026-09-25', how: '', ack: false, note: '  스캔 메일 받음 ' }, '홍길동', 1760000000000);
  assert.deepEqual(p, { st: 'done', at: 1760000000000, by: '홍길동', sentAt: '2026-09-20', gotAt: '2026-09-25', note: '스캔 메일 받음' });
  assert.deepEqual(Tr.patchFor({ st: 'done', gotAt: '2026-10-01', how: 'platform', ack: true }, '', 7),
    { st: 'done', at: 7, gotAt: '2026-10-01', how: 'platform', ack: true });
  assert.deepEqual(Tr.normalize({ c: { r: { items: { k: p } } } }).c.r.k, p);
});

test('저장 관문(강제 모드) — 줄 하나 .set 은 통과, 부분 update 는 막힌다(그래서 화면은 .set 을 쓴다)', () => {
  const p = Tr.patchFor({ st: 'doing', sentAt: '2026-09-20' }, '홍길동', 1);
  assert.equal(W.inspectWrite({ kind: 'set', path: 'scal_docs/c2/t3_2026/items/sign', value: p, mode: 'enforce' }).ok, true);
  assert.equal(W.inspectWrite({ kind: 'update', path: 'scal_docs/c2/t3_2026', value: { 'items/sign': p }, mode: 'enforce' }).ok, false);
});
