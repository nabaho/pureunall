/* 취업규칙 🏢 사업장 — 현황 한 줄 셈 (설계 §15 · 2026-11-01 대표 「추천대로」)
   js/rules-v2/lib-status.js — 단계 · 날수 · 멈춤 · 마지막 신고 · 살펴볼 곳 · 단계 줄.
   ★ 값이 아니라 규칙을 본다 — 멈춤 기준·인원 기준은 모듈의 상수(STOP_DAYS·LOOK_SIZE)로 견준다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/rules-v2/lib-status.js');

const DAY = S.DAY;
const NOW = Date.UTC(2026, 10, 1, 3);
const ago = (d) => NOW - d * DAY;
const it = (kind, dir, d, extra) => Object.assign({ id: kind + d, kind, dir, date: ago(d), status: '담김' }, extra || {});
const grp = (items, extra) => Object.assign({ roundKey: 'r202606', items: items.slice().sort((a, b) => a.date - b.date),
  last: Math.max(...items.map((x) => x.date)) }, extra || {});
const dayStr = (ms) => new Date(ms + 9 * 36e5).toISOString().slice(0, 10);
const BIZ = '1234567890';
const row = (extra) => Object.assign({ id: 'c1', name: '점검가나상사', bizNo: '123-45-67890', size: 30, closed: false,
  linked: 2, cand: 0, groups: [] }, extra || {});
const idx = (recs) => ({ site_x: recs });

test('① 단계 차례 — 신고 > 동의 > 보냄 > 받음', () => {
  const got = [it('규칙본문', '받음', 40)];
  assert.equal(S.stageOf(grp(got), [], NOW).stage, 'got');
  const sent = got.concat(it('규칙본문', '보냄', 30));
  assert.equal(S.stageOf(grp(sent), [], NOW).stage, 'sent');
  const agree = sent.concat(it('동의서', '받음', 20));
  assert.equal(S.stageOf(grp(agree), [], NOW).stage, 'agree');
  assert.equal(S.stageOf(grp(sent.concat(it('의견청취', '받음', 20))), [], NOW).stage, 'agree', '의견청취도 동의 단계');
  const filed = agree.concat(it('신고서', '보냄', 10));
  assert.equal(S.stageOf(grp(filed), [], NOW).stage, 'filed');
  // 우리가 보낸 «기타» 서류만으로는 «개정안 보냄»이 아니다
  assert.equal(S.stageOf(grp(got.concat(it('기타', '보냄', 5))), [], NOW).stage, 'got');
});

test('② 날수는 그 회차 마지막 서류 뒤 — 멈춤은 STOP_DAYS «넘게»(경계 포함 안 함)', () => {
  const at = S.STOP_DAYS;
  const on = S.stageOf(grp([it('규칙본문', '보냄', at)]), [], NOW);
  assert.equal(on.days, at);
  assert.equal(on.stop, false, '딱 기준 날은 아직 멈춤이 아니다');
  const over = S.stageOf(grp([it('규칙본문', '보냄', at + 1)]), [], NOW);
  assert.equal(over.stop, true);
  // 신고 끝·중단은 날이 아무리 지나도 멈춤이 아니다
  assert.equal(S.stageOf(grp([it('신고서', '보냄', at + 300)]), [], NOW).stop, false);
  const halt = S.stageOf(grp([it('규칙본문', '보냄', at + 300)], { noFinal: true }), [], NOW);
  assert.equal(halt.stage, 'halt');
  assert.equal(halt.stop, false, '사람이 «최종본 없음»으로 멈춘 회차를 다시 울리면 안 된다');
});

test('③ 📮 는 그 회차가 시작된 뒤의 것만 그 회차의 신고로 본다', () => {
  const g = grp([it('규칙본문', '받음', 60), it('규칙본문', '보냄', 50)]);
  const old = { filedAt: ago(400), day: dayStr(ago(400)) };
  assert.equal(S.stageOf(g, [old], NOW).stage, 'sent', '지난 회차의 신고가 이번 회차를 «신고 끝»으로 만든다');
  const fresh = { filedAt: ago(5), day: dayStr(ago(5)) };
  assert.equal(S.stageOf(g, [fresh, old], NOW).stage, 'filed');
});

test('④ 마지막 신고 — 늦은 것 · 📮 와 ✉ 가 NEAR 안이면 📮', () => {
  const mail = grp([it('신고서', '보냄', 100)]);
  assert.deepEqual(S.lastFiled([mail], []), { src: 'mail', at: ago(100), markAt: 0, markDay: '' });
  const near = { filedAt: ago(100) - (S.NEAR / 2), day: 'd', office: '서울청' };
  const r1 = S.lastFiled([mail], [near]);
  assert.equal(r1.src, 'mark', '같은 신고면 사람이 적은 신고일(📮)이 먼저다');
  assert.equal(r1.mailAt, ago(100), 'title 에 ✉ 도 보이게 둘 다 넘긴다');
  const far = { filedAt: ago(100) - S.NEAR - DAY, day: 'd2', office: '' };
  const r2 = S.lastFiled([mail], [far]);
  assert.equal(r2.src, 'mail', '오래된 📮 가 더 늦은 ✉ 를 가리면 안 된다');
  assert.equal(r2.markAt, far.filedAt);
  const later = { filedAt: ago(10), day: 'd3', office: '' };
  assert.equal(S.lastFiled([mail], [later]).src, 'mark');
  assert.equal(S.lastFiled([], []), null);
});

test('⑤ 색인은 사업자번호로만 잇는다 — 번호 없는 📮 는 «잇지 못함»으로 센다', () => {
  const ix = { site_a: { r1: { bizno: '123-45-67890', filedAt: '2026-10-05', filedOffice: '서울청', doneAt: '2026-10-01 10:00' } },
    site_b: { r1: { bizno: '', site: '점검가나상사', filedAt: '2026-10-06' } },
    site_c: { r1: { bizno: '999', filedAt: '2026-10-07' } } };
  const by = S.indexByBiz(ix);
  assert.equal(by.by[BIZ].marks.length, 1);
  assert.equal(by.by[BIZ].marks[0].office, '서울청');
  assert.equal(by.unlinked, 2, '이름이 같아도 번호가 없으면 잇지 않는다');
  assert.equal(S.dayMs('2026-10-05'), Date.UTC(2026, 9, 5) - 9 * 36e5, '한국 날짜 0시');
  assert.equal(S.dayMs('없음'), 0);
});

test('⑥ 살펴볼 곳 — LOOK_SIZE 이상·폐업 아님·자료 없음·색인 없음 · 또는 멈춤', () => {
  const none = (extra) => S.statOf(row(Object.assign({ linked: 0, cand: 0 }, extra)), S.indexByBiz({}), NOW);
  assert.deepEqual(none({ size: S.LOOK_SIZE }).look, ['none10']);
  assert.deepEqual(none({ size: S.LOOK_SIZE - 1 }).look, [], '기준 미만은 살펴볼 곳이 아니다');
  assert.deepEqual(none({ size: 0 }).look, [], '인원을 모르면 단정하지 않는다');
  assert.deepEqual(none({ size: 50, closed: true }).look, [], '폐업한 곳');
  assert.deepEqual(none({ size: 50, cand: 1 }).look, [], '후보 자료가 있으면 기록이 «없는» 것이 아니다');
  assert.equal(none({ size: 50, cand: 1 }).candOnly, true);
  // 규정관리에서 검토한 회차(색인)가 있으면 기록이 있다
  const withIdx = S.statOf(row({ linked: 0, cand: 0, size: 50 }), S.indexByBiz(idx({ r1: { bizno: BIZ, doneAt: '2026-09-01 10:00' } })), NOW);
  assert.equal(withIdx.stage, 'review');
  assert.deepEqual(withIdx.look, []);
  const stop = S.statOf(row({ groups: [grp([it('규칙본문', '보냄', S.STOP_DAYS + 30)])] }), S.indexByBiz({}), NOW);
  assert.deepEqual(stop.look, ['stop']);
});

test('⑦ 가장 최근 회차 하나만 본다 · 단계 줄은 지난 것 on, 다음 하나만 next', () => {
  const oldG = grp([it('신고서', '보냄', 900)], { roundKey: 'r202301' });
  const newG = grp([it('규칙본문', '받음', 40), it('규칙본문', '보냄', 30)], { roundKey: 'r202609' });
  const st = S.statOf(row({ groups: [oldG, newG] }), S.indexByBiz({}), NOW);
  assert.equal(st.stage, 'sent', '옛 회차의 신고서가 지금 회차를 «신고 끝»으로 만든다');
  assert.equal(st.round, 'r202609');
  assert.equal(st.filed.src, 'mail', '마지막 신고는 모든 회차에서 찾는다');
  const on = st.steps.map((s) => s.on), next = st.steps.filter((s) => s.next).map((s) => s.k);
  assert.deepEqual(on, [true, true, false, false]);
  assert.deepEqual(next, ['agree']);
  const done = S.stepsOf(grp([it('규칙본문', '보냄', 30), it('신고서', '보냄', 10)]), null);
  assert.equal(done.filter((s) => s.next).length, 0, '신고까지 끝났으면 «다음»이 없다');
});

test('⑧ 보이는 말 — 한 줄 짧게, 긴 말은 title · 멈추면 ⏸', () => {
  const sent = S.label({ stage: 'sent', days: 12, stop: false });
  assert.match(sent.text, /12일/);
  assert.ok(sent.title.length > sent.text.length);
  const stop = S.label({ stage: 'sent', days: S.STOP_DAYS + 1, stop: true });
  assert.match(stop.text, /^⏸/);
  assert.equal(stop.cls, 'stop');
  assert.match(S.label({ stage: 'none10' }).title, /상시 근로자/, '«살펴볼 곳»은 판정이 아니라고 말해야 한다');
  assert.doesNotMatch(S.label({ stage: 'filed', days: 400 }).text, /일$/, '신고 끝에 날수를 붙이지 않는다');
  assert.match(S.label({ stage: 'none', candOnly: true }).title, /후보/);
  // 거르기 값 — 멈춘 줄은 제 단계와 «멈춤» 둘 다
  assert.deepEqual(S.stageTags({ stat: { stage: 'sent', stop: true } }), ['sent', 'stop']);
  S.STAGE_TAGS.forEach((k) => assert.ok(S.STAGE_LABEL[k], k + ' 의 이름이 없다'));
});

test('⑨ apply 는 줄에 stat·look 만 더하고 다른 칸은 그대로 둔다', () => {
  const r = row({ groups: [grp([it('규칙본문', '보냄', 3)])] });
  const before = JSON.stringify(Object.assign({}, r, { groups: undefined }));
  const out = S.apply([r], {}, NOW);
  assert.ok(r.stat && Array.isArray(r.look));
  assert.equal(JSON.stringify(Object.assign({}, r, { groups: undefined, stat: undefined, look: undefined })), before);
  assert.equal(out.unlinked, 0);
});
