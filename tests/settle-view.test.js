/* 컨설팅정산 표 그리기(js/pu-settle-view.js) — ☐·번호·한 줄 칸·글 막기·사번 감추기 (2026-10-31)
   ★ 자료는 지어낸 것이다. 화면 글자(>…< 사이)만 떠서 본다 — 속성(data-*)의 열쇠는 화면에 안 보인다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-settle-core.js');
const V = require('../js/pu-settle-view.js');

function visible(html) { return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' '); }

const NAMES = { 'T-LEAD': '홍길동', 'T-A': '<b>김가나</b>' };
function fakeRun(status, rate) {
  const notice = { months: [{ key: '2026-10', label: '10월' }], rows: [
    { name: '홍길동', company: '가나상사', totalPre: 5136364, amounts: { '2026-10': 2568182 } },
    { name: '<b>김가나</b>', company: '가나상사', totalPre: 1954545, amounts: { '2026-10': 977273 } }
  ] };
  const ctx = { companyLinks: {}, personLinks: {}, actuals: {}, adjusts: [], names: NAMES };
  ctx.companyLinks[C.linkKey('가나상사')] = { consultingId: 'C-1', companyId: 'CO-1' };
  ctx.personLinks[C.linkKey('홍길동')] = 'T-LEAD';
  ctx.personLinks[C.linkKey('<b>김가나</b>')] = 'T-A';
  const rule = { typeCode: 'cons-test', title: '테스트사업', leadSid: 'T-LEAD', rates: { 'T-A': rate || 25 }, siteRates: {} };
  const res = C.settleMonth(notice, '2026-10', rule, ctx);
  return { id: 'cons-test_2026-10', typeCode: 'cons-test', monthKey: '2026-10', label: '10월', status: status || 'draft', sites: res.sites,
    issues: res.issues, transfers: C.transfersOf(res.sites, 'T-LEAD').map((t) => Object.assign({ paid: false }, t)), changed: false };
}

test('열두 달 줄 — 달마다 단추(data-month), 할 일 점·고른 달 표시, 정산 없는 달은 흐리게', () => {
  const h = V.monthStrip('2026', { '2026-10': { state: 'todo', runs: 2, draft: 1, left: 0 }, '2026-07': { state: 'done', runs: 1 } }, '2026-10');
  assert.equal((h.match(/data-month="2026-[01][0-9]"/g) || []).length, 12);
  assert.match(h, /class="mo mo-todo on" data-month="2026-10" title="10월 — 정산표 2 · 임시저장 1 · 할 일 남음"/);
  assert.match(h, /class="mo mo-done" data-month="2026-07"/);
  assert.match(h, /class="mo mo-none" data-month="2026-01"/);
  assert.match(visible(h), /할 일 남음[\s\S]*끝\(확정·송금 다 함\)[\s\S]*정산 없음/);
});

test('입금 확인 상자 — ☐·번호, 같은 금액은 ✓ 맞음, 고른 입금이 다르면 △ 차이, 없으면 ✕, 넣은 실입금은 «넣음»(☐ 없음), 담당 통장 안내', () => {
  const rev = { rows: [
    { id: 'r1::C-1|T-LEAD', runId: 'r1', typeCode: 'cons-test', key: 'C-1|T-LEAD', company: '<b>가나</b>상사', round: 1, expected: 2483442, actual: null, kind: 'exact' },
    { id: 'r1::C-2|T-LEAD', runId: 'r1', typeCode: 'cons-test', key: 'C-2|T-LEAD', company: '다라산업', round: 2, expected: 1000000, actual: null, kind: 'near' },
    { id: 'r2::C-3|T-LEAD', runId: 'r2', typeCode: 'cons-b', key: 'C-3|T-LEAD', company: '마바상사', round: 1, expected: 500000, actual: null, kind: 'none' },
    { id: 'r2::C-4|T-LEAD', runId: 'r2', typeCode: 'cons-b', key: 'C-4|T-LEAD', company: '사아상사', round: 1, expected: 700000, actual: 700000, kind: 'saved' }] };
  const found = [{ id: 'x1', amount: 2483442, date: '2026-10-21 10:00', memo: '가나재단' }, { id: 'x2', amount: 999000, date: '2026-10-22', memo: '' }];
  const h = V.reviewBox(rev, { biz: { 'cons-test': '테스트사업', 'cons-b': '나다사업' }, found, sel: { 'r1::C-1|T-LEAD': 1 },
    pick: { 'r1::C-1|T-LEAD': 'x1', 'r1::C-2|T-LEAD': 'x2' }, leadName: '홍길동', win: { from: '2026-10-01', to: '2026-11-20' } });
  const t = h.slice(h.indexOf('data-name="auto"'));
  const ths = [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[0]);
  assert.match(ths[0], /data-all="auto"/);
  assert.match(ths[1], /번호/);
  const v = visible(h);
  assert.match(v, /✓ 맞음 1[\s\S]*△ 확인 1[\s\S]*✕ 못 찾음 1[\s\S]*넣음 1/);
  assert.match(v, /홍길동 통장\(재무관리\)/);
  assert.match(v, /기간 10-01 ~ 11-20 · 입금 2건/);
  assert.match(h, /data-ck="r1::C-1\|T-LEAD" checked/);
  assert.match(v, /△ −1,000원 다름/);
  assert.doesNotMatch(h, /data-ck="r2::C-4\|T-LEAD"/, '넣은 줄에 ☐');
  assert.match(v, /담당 개인 통장으로 들어간 돈은 대표 통장에 보이지 않아/);
  assert.match(h, /id="auto_save"/);
  assert.doesNotMatch(h, /<b>가나/);
  assert.doesNotMatch(v, /T-[A-Z]/);
  assert.match(visible(V.reviewBox({ rows: [] }, {})), /맞출 입금이 없습니다/);
});

test('정산 확인 상자 — 정산표마다 사업 이름·상태·송금 줄(반환/추가 지급·누가 누구에게·사업장), 임시저장은 «확정»·«확정하면 송금», 확정은 «보냄 표시»', () => {
  const d = V.monthRuns([fakeRun('draft')], { names: NAMES, biz: { 'cons-test': '테스트사업 (테스트재단)' } });
  const v = visible(d);
  assert.match(v, /테스트사업 \(테스트재단\)\s+임시저장/);
  assert.match(v, /반환\s+&lt;b&gt;김가나&lt;\/b&gt; → 홍길동\s+87,915원\s+가나상사/);
  assert.match(v, /확정하면 송금/);
  assert.match(d, /data-act="confirm" data-rid="cons-test_2026-10"/);
  assert.match(d, /data-run="cons-test_2026-10">자세히 ▾/);
  const c = V.monthRuns([fakeRun('confirmed')], { names: NAMES, biz: {}, cur: 'cons-test_2026-10', detail: '<p id="det"></p>' });
  assert.match(c, /data-paid-btn="0" data-rid="cons-test_2026-10">보냄 표시/);
  assert.doesNotMatch(c, /data-act="confirm"/);
  assert.match(c, /접기 ▴[\s\S]*<div class="mdet"><p id="det"><\/p><\/div>/);
  assert.doesNotMatch(v, /T-LEAD|T-A /);
});

test('한 해 합계 — 달마다 한 줄(달 이름은 그 달로 가는 단추), 정산 없는 달은 뺀다, 송금·카톡 보냄', () => {
  const h = V.yearMonths([{ key: '2026-10', names: ['테스트사업', '<b>나다</b>'], state: { state: 'todo', runs: 2, transfers: 2, paid: 1 }, kq: { sent: 1, all: 2 } },
    { key: '2026-08', names: [], state: { state: 'none', runs: 0 }, kq: {} }]);
  assert.match(h, /data-month="2026-10">10월</);
  assert.doesNotMatch(h, /2026-08/);
  assert.match(visible(h), /테스트사업 · &lt;b&gt;나다&lt;\/b&gt;\s+할 일 남음\s+1 \/ 2\s+1 \/ 2/);
  assert.match(visible(V.yearMonths([])), /이 해에 정산표가 없습니다/);
});

test('카톡 보내기 상자 — 요약은 펼치고 계산 설명은 접는다, 미리보기는 복사·보내기 없음, 확정+대표+방이면 «카톡 보내기», 방이 없으면 대표에게 등록 칸', () => {
  const text = '[컨설팅 비용 정산 안내]\n요약 줄\n──────────\n[계산 설명]\n1) 설명';
  assert.deepEqual(V.splitMsg(text), { summary: '[컨설팅 비용 정산 안내]\n요약 줄', explain: '[계산 설명]\n1) 설명' });
  assert.deepEqual(V.splitMsg('한 줄'), { summary: '한 줄', explain: '' });
  /* 계산 모듈 문구와 같은 줄로 나뉜다 */
  const real = C.buildMessages(fakeRun('confirmed'), { title: '테스트사업', leadSid: 'T-LEAD' }, NAMES)[0].text;
  assert.match(V.splitMsg(real).explain, /^\[계산 설명\]/);
  const items = [{ rid: 'r1', i: 0, sid: 'T-A', name: '김가나', text, biz: '테스트사업' }, { rid: 'r1', i: 1, sid: 'T-B', name: '<i>이다라</i>', text: 'y', biz: '테스트사업' }];
  const h = V.monthMsgs(items, { rooms: { 'T-A': '김가나 노무사' }, last: { r1: { 'T-A': { status: 'sent', sentAt: Date.UTC(2026, 10, 2, 7, 0) } } }, isAdmin: true, go: { label: '카톡 1통 보내기' } });
  const v = visible(h);
  assert.match(h, /data-copy="r1\|0"/);
  assert.match(h, /data-kq="r1\|0"/);
  assert.doesNotMatch(h, /data-kq="r1\|1"/, '방 없는 사람에게 보내기 단추');
  assert.match(h, /data-room="T-B"[^>]*>[\s\S]*?data-room-save="T-B">방 등록/);
  assert.match(v, /💬 김가나 노무사/);
  assert.match(v, /✓ 보냄 · 11-02 16:00/);
  assert.match(h, /<div class="msg">\[컨설팅 비용 정산 안내\]\n요약 줄<\/div><details class="why"><summary>계산 설명 펼치기<\/summary>/);
  assert.match(h, /id="monthGo">카톡 1통 보내기</);
  assert.doesNotMatch(h, /<i>이다라/);
  assert.doesNotMatch(v, /T-[A-Z]/);
  const pv = V.monthMsgs([Object.assign({}, items[0], { preview: true })], { rooms: { 'T-A': '김가나 노무사' }, isAdmin: true });
  assert.match(visible(pv), /확정 전 미리보기/);
  assert.doesNotMatch(pv, /data-copy=|data-kq=/);
  assert.doesNotMatch(V.monthMsgs(items, { rooms: { 'T-A': '김가나 노무사' }, isAdmin: false }), /data-kq=|data-room-save=/, '대표가 아닌데 보내기·방 등록');
  assert.match(visible(V.monthMsgs([], {})), /보낼 문구가 없습니다/);
});

test('정산표 — 한 칸 한 줄(<br> 없음), 사람이 적은 글은 막는다, 사번은 화면에 없다', () => {
  const h = V.runDetail(fakeRun(), NAMES);
  assert.doesNotMatch(h, /<br/i);
  assert.doesNotMatch(h, /<b>김가나<\/b>/);
  assert.match(h, /&lt;b&gt;김가나&lt;\/b&gt;/);
  assert.doesNotMatch(visible(h), /T-LEAD|T-A\b/);
});

test('정산표 — 정산액은 쉼표와 빼기표, 실입금 칸은 계산만일 때만 입력칸', () => {
  const d = V.runDetail(fakeRun('draft'), NAMES);
  assert.match(visible(d), /−87,915/);
  assert.match(d, /<input[^>]*data-actual="C-1\|T-A"/);
  const c = V.runDetail(fakeRun('confirmed'), NAMES);
  assert.doesNotMatch(c, /<input[^>]*data-actual=/);
});

test('정산표 — 통장 실입금이 있으면 계산한 세후와 견준 딱지(일치/차이)와 «입금 확인 n/m»', () => {
  const r = fakeRun('draft');
  const a = r.sites[0].members.find((m) => m.sid === 'T-A');
  a.actual = 945000;
  const lead = r.sites[0].members.find((m) => m.sid === 'T-LEAD');
  lead.actual = lead.net;
  const v = visible(V.runDetail(r, NAMES));
  assert.match(v, /입금 확인 2\/2/);
  assert.match(v, /일치/);
  assert.match(v, /−33/);
});

test('정산표 — 사업장은 묶음 머리에 한 번(누가 누구에게 얼마), 구분·요율은 이름 옆 딱지, 차액·조정 칸은 이월·조정이 있을 때만', () => {
  const h = V.runDetail(fakeRun('draft'), NAMES, {}, { biz: '테스트사업 (테스트재단)' });
  const head = h.slice(h.indexOf('data-name="run"'), h.indexOf('</thead>', h.indexOf('data-name="run"')));
  const hv = visible(head);
  assert.doesNotMatch(hv, /사업장|구분|요율|차액|조정/, '빠진 칸이 머리에 남았다');
  assert.match(hv, /이름[\s\S]*세전[\s\S]*원천징수[\s\S]*세후[\s\S]*통장 실입금[\s\S]*몫[\s\S]*정산액[\s\S]*최종/);
  const v = visible(h);
  assert.match(v, /가나상사\s+1차 · 세후 합계/);
  assert.match(v, /&lt;b&gt;김가나&lt;\/b&gt; → 홍길동\s+87,915/);
  assert.match(v, /주관/);
  assert.match(v, /담당 25%/);
  assert.match(v, /테스트사업 \(테스트재단\)/);
  assert.equal((v.match(/가나상사/g) || []).length, 1, '사업장 이름은 상자 머리에 한 번 — 송금 목록에 다시 나오지 않는다');
  assert.doesNotMatch(v, /송금 목록/);
  assert.match(h, /<div class="site"><div class="sh"><b title="가나상사">가나상사<\/b>/);
  const r = fakeRun('draft');
  const a = r.sites[0].members.find((m) => m.sid === 'T-A'); a.adjust = -5; a.settle -= 5;
  const hv2 = visible(V.runDetail(r, NAMES).slice(0, V.runDetail(r, NAMES).indexOf('</thead>')));
  assert.match(hv2, /차액[\s\S]*조정/);
});

test('정산표 임시저장 — 저장 안 한 칸은 노란 칸·«임시저장 (n)»·안내 줄, 마지막 임시저장 시각, 확정한 달에는 없다', () => {
  const r = Object.assign(fakeRun('draft'), { updatedAt: Date.UTC(2026, 9, 31, 6, 32) });
  const h0 = V.runDetail(r, NAMES, {}, {});
  assert.match(h0, /data-act="draftSave"[^>]*>임시저장<\/button>/);
  assert.match(visible(h0), /10-31 15:32 임시저장됨/);
  assert.match(h0, /id="pendNote" style="display:none"/);
  const h1 = V.runDetail(r, NAMES, {}, { pend: { 'C-1|T-A': '945,000' } });
  assert.match(h1, /class="amt dirty" data-actual="C-1\|T-A" value="945,000"/);
  assert.match(h1, />임시저장 \(1\)<\/button>/);
  assert.match(visible(h1), /저장 안 한 칸 1개/);
  const c = V.runDetail(fakeRun('confirmed'), NAMES, {}, { pend: { 'C-1|T-A': '1' } });
  assert.doesNotMatch(c, /data-act="draftSave"|임시저장됨|pendNote/);
});

test('정산표 — 확인 필요가 있으면 «확정» 단추가 잠긴다', () => {
  const r = fakeRun('draft');
  r.sites[0].issues.push('요율 없음: 김가나');
  assert.match(V.runDetail(r, NAMES), /<button[^>]*data-act="confirm"[^>]*disabled/);
  assert.doesNotMatch(V.runDetail(fakeRun('draft'), NAMES), /<button[^>]*data-act="confirm"[^>]*disabled/);
});

test('송금 목록 — ☐·번호·보냄 칸, 보내는 사람 → 받는 사람 이름', () => {
  const h = V.runDetail(fakeRun('confirmed'), NAMES);
  const t = h.slice(h.indexOf('data-name="transfers"'));
  assert.match(t, /data-ck="t0"/);
  assert.match(t, /data-paid-btn="0"[^>]*>보냄 표시</);
  assert.match(visible(t), /87,915/);
});

test('계산만인 달도 송금 목록을 미리 보여 주되 «보냄»은 누를 수 없다', () => {
  const r = fakeRun('draft'); r.transfers = [];
  const h = V.runDetail(r, NAMES);
  const t = h.slice(h.indexOf('data-name="transfers"'));
  assert.ok(h.indexOf('data-name="transfers"') > 0, '미리보기 송금 표가 없다');
  assert.match(visible(t), /87,915/);
  assert.doesNotMatch(t, /data-paid-btn=/);
  assert.match(visible(t), /확정하면 송금/);
});

test('입금 대조 상자 — ☐·번호, 찾은 입금 고르기, 일치·금액 다름 표시, 사번은 화면에 없다', () => {
  const found = [{ id: 'p0', amount: 945033, date: '2026-10-30', memo: '<i>가나재단</i>' }, { id: 'p1', amount: 945000, date: '2026-10-30', memo: '다라' }];
  const matches = [{ key: 'C-1|T-A', company: '가나상사', expected: 945033 }, { key: 'C-2|T-A', company: '다라산업', expected: 945033 }];
  const h = V.depositBox({ open: true, people: [{ sid: 'T-A', name: '김가나' }], sid: 'T-A', found, source: 'paste', matches, pick: { 'C-1|T-A': 'p0', 'C-2|T-A': 'p1' }, sel: { 'C-1|T-A': 1 } });
  const t = h.slice(h.indexOf('data-name="deposits"'));
  const ths = [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[0]);
  assert.match(ths[0], /data-all="deposits"/);
  assert.match(ths[1], /번호/);
  assert.match(t, /<select data-dep="C-1\|T-A">/);
  assert.match(visible(t), /일치/);
  assert.match(visible(t), /금액 다름/);
  assert.match(visible(t), /−33/);
  assert.doesNotMatch(h, /<i>가나재단/);
  assert.doesNotMatch(visible(h), /T-A/);
  assert.match(h, /id="dep_apply"/);
  assert.match(h, /id="dep_pull"/);
});

test('요율표 — 줄 = 사람(☐·번호), 칸 = 사업 종류, 주관·켜짐 줄, «+ 사람»은 재직자 중 아직 없는 사람만, 사번은 화면에 없다', () => {
  const work = { types: ['cons-a', 'cons-b'], people: ['T-A', 'T-B'], dirty: true,
    rules: { 'cons-a': { leadSid: 'T-LEAD', rates: { 'T-A': '25', 'T-B': '30' }, active: true }, 'cons-b': { title: '나다사업', leadSid: '', rates: { 'T-A': '20' }, active: false } } };
  const staff = [{ sid: 'T-LEAD', name: '홍길동' }, { sid: 'T-A', name: '김가나' }, { sid: 'T-C', name: '박재직' }];
  const names = { 'T-LEAD': '홍길동', 'T-A': '김가나', 'T-B': '이퇴사' };
  const h = V.rateMatrix(work, { bizNames: { 'cons-a': '가나사업 (가나재단)', 'cons-b': '나다사업' }, staff, names, sel: {}, addTypes: [{ code: 'cons-c', name: '다라사업' }] });
  const ths = [...h.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[0]);
  assert.match(ths[0], /data-all="mxpeople"/);
  assert.match(ths[1], /번호/);
  assert.match(visible(ths[3]), /가나사업 \(가나재단\)/, '칸 머리는 사업 이름 전체(대표 지시 「사업 이름 정확하게」)');
  assert.match(h, /data-mx="cons-a\|T-A" value="25"/);
  assert.match(h, /data-mx="cons-b\|T-B" value=""/);
  assert.match(h, /<select data-lead="cons-a">[\s\S]*?value="T-LEAD" selected/);
  assert.match(h, /data-on="cons-b"(?! checked)/);
  const add = h.slice(h.indexOf('id="mx_addSid"'));
  assert.match(add, /박재직/);
  assert.doesNotMatch(add.slice(0, add.indexOf('</select>')), /김가나/, '이미 줄이 있는 사람은 다시 안 나온다');
  assert.match(visible(h), /이퇴사/, '퇴사자라도 이미 든 요율은 이름으로 보인다');
  assert.doesNotMatch(visible(h), /T-[A-Z]/);
  assert.doesNotMatch(h, /<br/i);
  assert.match(h, /id="mx_save"(?! disabled)/);
  assert.match(visible(h), /저장하지 않은 변경/);
});

test('사업마다 «자세히» — 머리말·맺음말·이름 칸과 사업장별 예외 요율(더하기·빼기)', () => {
  const work = { types: ['cons-a'], people: ['T-A'], open: 'cons-a',
    rules: { 'cons-a': { leadSid: 'T-LEAD', rates: { 'T-A': '25' }, siteRates: { 'C-1': { 'T-A': 30 } }, msgHead: '', msgFoot: '수고' } } };
  const h = V.ruleDetails(work, { bizNames: { 'cons-a': '가나사업' }, names: { 'T-A': '김가나' }, sitesByType: { 'cons-a': [{ consultingId: 'C-1', label: '가나상사' }] } });
  assert.match(h, /<details class="card rd" data-rd="cons-a" open>/);
  assert.match(h, /data-rf="cons-a\|msgFoot" value="수고"/);
  assert.match(visible(h), /가나상사/);
  assert.match(visible(h), /30%/);
  assert.match(h, /data-srate-del="cons-a\|C-1\|T-A"/);
  assert.match(h, /data-srate-add="cons-a"/);
});

test('계산기 — 종류·사업장·수행자(재직자)·구분·세전·요율 칸, 줄 맨 왼쪽 ☐·번호, 주관은 요율 칸이 없다', () => {
  const st = { type: 'cons-a', siteId: 'C-1', rows: [{ sid: 'T-LEAD', role: 'lead', pre: '2568182' }, { sid: 'T-A', role: 'staff', pre: '977273', rate: '25' }] };
  const h = V.calcBox(st, { bizList: [{ code: 'cons-a', name: '가나사업' }], sites: [{ consultingId: 'C-1', label: '가나상사' }],
    staff: [{ sid: 'T-LEAD', name: '홍길동' }, { sid: 'T-A', name: '김가나' }], names: { 'T-LEAD': '홍길동', 'T-A': '김가나' }, sel: {} });
  assert.match(h, /<select id="c_type">[\s\S]*value="cons-a" selected/);
  assert.match(h, /<select id="c_site">[\s\S]*value="C-1" selected/);
  const ths = [...h.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[0]);
  assert.match(ths[0], /data-all="calc"/); assert.match(ths[1], /번호/);
  assert.match(h, /data-c="0\|sid">[\s\S]*?value="T-LEAD" selected/);
  assert.doesNotMatch(h, /data-c="0\|rate"/, '주관 줄에는 요율 칸이 없다');
  assert.match(h, /data-c="1\|rate"[^>]*value="25"/);
  assert.match(h, /list="c_rates"/);
  assert.doesNotMatch(visible(h), /T-[A-Z]/);
  assert.doesNotMatch(h, /카톡/, '카톡 문구는 계산기에 두지 않는다(별도 탭)');
});

test('계산 결과 — 사람별 세후·몫·정산액과 «누가 누구에게 얼마»', () => {
  const res = C.calcSite([{ sid: 'T-LEAD', name: '홍길동', role: 'lead', pre: 2568182 }, { sid: 'T-A', name: '김가나', role: 'staff', pre: 977273, rate: 25 }]);
  const v = visible(V.calcResult(res, { 'T-LEAD': '홍길동', 'T-A': '김가나' }));
  assert.match(v, /3,428,475원/);
  assert.match(v, /857,118/);
  assert.match(v, /−87,915/);
  assert.match(v, /김가나 → 홍길동\s+87,915원/);
  assert.equal(V.calcResult({ members: [] }), '');
});

test('안내 파일 목록·이월 목록도 ☐ 다음 번호', () => {
  const n = V.noticesTable([{ id: 'N1', fileName: '비용지급 안내_시험.xlsx', receivedAt: Date.UTC(2026, 9, 30), months: [{ key: '2026-10', label: '10월' }], rows: [{}, {}], source: 'upload' }], {});
  const a = V.adjustsTable([{ id: 'A1', consultingId: 'C-1', sid: 'T-A', amount: -1000, memo: '이월', appliedRunId: null }], { 'C-1': '가나상사' }, NAMES, {});
  [n, a].forEach((h) => {
    const ths = [...h.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[0]);
    assert.match(ths[0], /data-all=/);
    assert.match(ths[1], /번호/);
  });
  assert.match(visible(a), /−1,000/);
});

test('송금 방향 — 담당이 더 받았으면 «반환», 주관이 더 받았으면 «추가 지급»(묶음 머리·송금 목록·뜻 풀이·카톡·계산기)', () => {
  const back = V.runDetail(fakeRun('draft'), NAMES);
  assert.match(visible(back), /반환\s+&lt;b&gt;김가나&lt;\/b&gt; → 홍길동\s+87,915/);
  assert.match(visible(back), /반환\s+담당 → 주관\(홍길동\)/);
  assert.match(visible(back), /추가 지급\s+주관\(홍길동\) → 담당/);
  const tb = back.slice(back.indexOf('data-name="transfers"'));
  assert.match(tb, /data-k="lbl">송금</);
  assert.match(tb, /data-k="dir"><span class="pill dir-back">반환</);
  /* 40% 면 담당 몫(1,371,390)이 받은 세후(945,033)보다 크다 → 주관이 더 줌 */
  const more = V.runDetail(fakeRun('draft', 40), NAMES);
  assert.match(visible(more), /추가 지급\s+홍길동 → &lt;b&gt;김가나&lt;\/b&gt;\s+426,357/);
  assert.match(more, /class="pill dir-more">추가 지급</);
  /* 확정한 달 — 저장된 송금에는 방향 칸이 없다. 받는 사람이 주관이면 반환 */
  const c = V.runDetail(fakeRun('confirmed'), NAMES);
  assert.match(c.slice(c.indexOf('data-name="transfers"')), /dir-back">반환</);
  /* 카톡 문구도 같은 말 */
  const rule = { title: '테스트사업', leadSid: 'T-LEAD' };
  assert.match(C.buildMessages(fakeRun('confirmed'), rule, NAMES)[0].text, /▶ 반환 87,915원 \(<b>김가나<\/b> → 홍길동\)/);
  assert.match(C.buildMessages(fakeRun('confirmed', 40), rule, NAMES)[0].text, /▶ 추가 지급 426,357원 \(홍길동 → <b>김가나<\/b>\)/);
  /* 계산기 */
  const calc = C.calcSite([{ name: '갑', role: 'lead', pre: 2568182 }, { name: '을', role: 'staff', pre: 977273, rate: 25 }]);
  assert.equal(calc.transfers[0].dir, 'back');
  assert.match(visible(V.calcResult(calc, {})), /을 → 갑\s+87,915원\s+반환/);
});

test('직접 입력 상자 — ☐·번호, 주관은 규칙대로 못박고, 담당은 재직자 고르기·요율 표시, 세후 계산, 넣은 것 목록, 사번은 화면에 없다', () => {
  const st = { type: 'cons-b', siteId: 'C-9', month: '2026-10', rows: [{ sid: 'T-LEAD', role: 'lead', pre: '6990000' }, { sid: 'T-A', role: 'staff', pre: '0' }, { sid: 'T-C', role: 'staff', pre: '0' }] };
  const entries = [{ key: '2026-10|x', monthKey: '2026-10', company: '<i>승진</i> (번호-1)', people: [{ name: '홍길동', pre: 6990000 }, { name: '김가나', pre: 0 }] }];
  const h = V.manualBox(st, { types: [{ code: 'cons-b', name: '나다사업 (나다협회)' }], sites: [{ consultingId: 'C-9', label: '승진' }], staff: [{ sid: 'T-A', name: '김가나' }, { sid: 'T-C', name: '박재직' }],
    names: { 'T-LEAD': '홍길동', 'T-A': '김가나', 'T-C': '박재직' }, rates: { 'T-A': 10 }, entries, sel: {}, selE: {} });
  const t = h.slice(h.indexOf('data-name="manual"'));
  const ths = [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[0]);
  assert.match(ths[0], /data-all="manual"/);
  assert.match(ths[1], /번호/);
  assert.match(visible(h), /홍길동\s+주관/);
  assert.doesNotMatch(h, /data-m="0\|sid"/, '주관 줄은 고르기가 없다');
  assert.match(h, /<select data-m="1\|sid">[\s\S]*?value="T-A" selected/);
  assert.match(visible(h), /10%/);
  assert.match(visible(h), /요율표에 없음/);
  assert.match(visible(h), /6,759,330/);
  assert.match(h, /id="m_save"/);
  assert.match(h, /id="m_month" value="2026-10"/);
  assert.match(h, /data-name="mentries"/);
  assert.match(visible(h), /홍길동 6,990,000 · 김가나 0/);
  assert.doesNotMatch(h, /<i>승진/);
  assert.doesNotMatch(visible(h), /T-[A-Z]/);
  assert.doesNotMatch(h, /<br/i);
});


test('안내 파일 목록 — 사업 칸(전체 이름), 지급월·받은 때에 연도', () => {
  const n = { id: 'N1', typeCode: 'cons-b', fileName: '안내.xlsx', receivedAt: Date.UTC(2026, 9, 31, 6, 32), source: 'upload', rows: [{}],
    months: [{ key: '2026-07', label: '7월' }, { key: '2026-09', label: '9월 (10/2 지급)' }, { key: '2027-01', label: '1월' }] };
  const v = visible(V.noticesTable([n, Object.assign({}, n, { id: 'N2', source: 'manual', fileName: '직접 입력' })], {}, { 'cons-b': '나다사업 (나다협회)' }));
  assert.match(v, /나다사업 \(나다협회\)/);
  assert.match(v, /2026년 7월 · 9월 \(10\/2 지급\) \/ 2027년 1월/);
  assert.match(v, /2026-10-31 15:32/);
  assert.match(v, /직접 입력/);
});

test('역계산 상자 — 세전·소득세·지방소득세·검산, 딱 맞는 세전이 없으면 알린다', () => {
  const h = V.revBox({ net: '6,759,330', tax: '3.3' });
  assert.match(h, /id="r_net" value="6,759,330"/);
  assert.match(h, /<select id="r_tax"[^>]*><option value="3.3" selected>/);
  assert.match(visible(h), /6,990,000원/);
  assert.match(visible(h), /209,700원/);
  assert.match(visible(h), /20,970원/);
  assert.match(visible(V.revResult({ net: '912000', tax: '8.8' })), /1,000,000원/);
  assert.match(visible(V.revResult({ net: '', tax: '3.3' })), /3\.3% 사업소득/);
});

test('연간 합계 — 담당마다 반환·추가 지급·차감, 주관 순액, 사번은 화면에 없다', () => {
  const sum = { year: '2026', counts: { runs: 3, draft: 2, confirmed: 1, manual: 0 },
    people: [{ sid: 'T-A', name: '', back: 1977964, more: 0, sites: 2 }, { sid: 'T-C', name: '', back: 0, more: 675933, sites: 1 }], leads: { 'T-LEAD': 1302031 } };
  const v = visible(V.yearBox(sum, { 'T-A': '김가나', 'T-C': '박재직', 'T-LEAD': '홍길동' }));
  assert.match(v, /2026년 합계/);
  assert.match(v, /임시저장 2 · 확정 1/);
  assert.match(v, /김가나\s+1,977,964\s+—\s+보낼 1,977,964/);
  assert.match(v, /박재직\s+—\s+675,933\s+받을 675,933/);
  assert.match(v, /주관 홍길동 — 순액\s+받을 1,302,031/);
  assert.doesNotMatch(v, /T-[A-Z]/);
});

test('직접 입력 상자 — 세율·실수령액 칸', () => {
  const h = V.manualBox({ type: 'cons-b', month: '2026-10', rows: [{ sid: 'T-LEAD', role: 'lead', tax: '8.8', net: '912,000', pre: '1,000,000' }] },
    { types: [{ code: 'cons-b', name: '나다사업' }], names: { 'T-LEAD': '홍길동' }, rates: {} });
  assert.match(h, /<select data-m="0\|tax"[^>]*>[\s\S]*?<option value="8.8" selected>/);
  assert.match(h, /data-m="0\|net" value="912,000"/);
  assert.match(visible(h), /912,000/);
  assert.match(visible(h.slice(h.indexOf('data-name="manual"'))), /세율[\s\S]*실수령액\(통장\)[\s\S]*세전[\s\S]*세후 계산/);
});

test('요율표 — 빈 칸에 기존 %를 흐리게(placeholder), 제안이 있으면 «빈 칸에 기존 % 넣기»', () => {
  const work = { types: ['cons-a', 'cons-b'], people: ['T-A'], rules: { 'cons-a': { leadSid: 'T-LEAD', rates: { 'T-A': '25' } }, 'cons-b': { leadSid: 'T-LEAD', rates: {} } } };
  const h = V.rateMatrix(work, { names: { 'T-A': '김가나' }, staff: [], suggest: { 'cons-b|T-A': 25 } });
  assert.match(h, /data-mx="cons-b\|T-A" value="" placeholder="25" title="기존 25%/);
  assert.match(h, /id="mx_fill"/);
  assert.doesNotMatch(V.rateMatrix(work, { names: {}, staff: [] }), /id="mx_fill"/);
  const m = V.manualBox({ type: 'cons-b', rows: [{ sid: 'T-LEAD', role: 'lead', pre: '' }, { sid: 'T-A', role: 'staff', pre: '0' }] },
    { types: [], staff: [{ sid: 'T-A', name: '김가나' }], names: { 'T-LEAD': '홍길동', 'T-A': '김가나' }, rates: {}, suggest: { 'T-A': 25 } });
  assert.match(visible(m), /25% \(기존\)/);
  assert.doesNotMatch(visible(m), /요율표에 없음/);
});


test('카톡 상태 딱지·심부름꾼 줄·카톡 방 표·보낸 기록 — ☐·번호, 사번은 화면에 없다', () => {
  assert.match(V.kqState({ status: 'pending' }).text, /대기 중/);
  assert.match(V.kqState({ status: 'pending', dryRunAt: 1 }).text, /시험 모드/);
  assert.match(V.kqState({ status: 'sent', redirect: '나의 채팅', sentAt: 1 }).text, /시험 발송\(나의 채팅\)/);
  assert.match(V.kqState({ status: 'failed', error: '방 이름이 다릅니다' }).text, /실패 — 방 이름/);
  assert.match(V.agentLine(null, 0), /PC 카톡이 아직 연결되지 않았습니다/);
  const now = Date.UTC(2026, 10, 2, 7, 0);
  assert.match(V.agentLine({ agentSeenAt: now - 3 * 60000, mode: 'dry-run' }, now), /^<div class="bar">.*시험 모드.*3분 전/);
  assert.match(V.agentLine({ agentSeenAt: now - 30 * 60000, mode: 'live' }, now), /^<div class="warn">.*연결됨.*30분 전.*끊긴 것 같습니다/);
  const r = V.roomsTable(['T-A', 'T-B'], { 'T-A': '김가나 노무사' }, { 'T-A': '김가나', 'T-B': '이다라' }, {}, true);
  assert.match(r, /data-all="rooms"/);
  assert.match(r, /data-room="T-A" value="김가나 노무사"/);
  assert.match(r, /data-room-save="T-B"/);
  assert.doesNotMatch(V.roomsTable(['T-A'], {}, {}, {}, false), /<input type="text"|data-room-save/, '대표가 아닌데 고칠 칸');
  const k = V.kqTable([{ id: 'K1', sid: 'T-A', runId: 'r1', status: 'pending', createdAt: 2 }, { id: 'K2', sid: 'T-B', runId: 'r1', status: 'sent', sentAt: 3, createdAt: 3 }], { 'T-A': '김가나', 'T-B': '이다라' }, { r1: '2026년 10월' }, {});
  assert.match(k, /data-all="kq"/);
  assert.ok(visible(k).indexOf('이다라') < visible(k).indexOf('김가나'), '최근 것이 위가 아니다');
  [r, k].forEach((x) => assert.doesNotMatch(visible(x), /T-[A-Z]/));
});
