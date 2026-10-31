/* 컨설팅정산 표 그리기(js/pu-settle-view.js) — ☐·번호·한 줄 칸·글 막기·사번 감추기 (2026-10-31)
   ★ 자료는 지어낸 것이다. 화면 글자(>…< 사이)만 떠서 본다 — 속성(data-*)의 열쇠는 화면에 안 보인다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-settle-core.js');
const V = require('../js/pu-settle-view.js');

function visible(html) { return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' '); }

const NAMES = { 'T-LEAD': '홍길동', 'T-A': '<b>김가나</b>' };
function fakeRun(status) {
  const notice = { months: [{ key: '2026-10', label: '10월' }], rows: [
    { name: '홍길동', company: '가나상사', totalPre: 5136364, amounts: { '2026-10': 2568182 } },
    { name: '<b>김가나</b>', company: '가나상사', totalPre: 1954545, amounts: { '2026-10': 977273 } }
  ] };
  const ctx = { companyLinks: {}, personLinks: {}, actuals: {}, adjusts: [], names: NAMES };
  ctx.companyLinks[C.linkKey('가나상사')] = { consultingId: 'C-1', companyId: 'CO-1' };
  ctx.personLinks[C.linkKey('홍길동')] = 'T-LEAD';
  ctx.personLinks[C.linkKey('<b>김가나</b>')] = 'T-A';
  const rule = { typeCode: 'cons-test', title: '테스트사업', leadSid: 'T-LEAD', rates: { 'T-A': 25 }, siteRates: {} };
  const res = C.settleMonth(notice, '2026-10', rule, ctx);
  return { id: 'cons-test_2026-10', typeCode: 'cons-test', monthKey: '2026-10', label: '10월', status: status || 'draft', sites: res.sites,
    issues: res.issues, transfers: C.transfersOf(res.sites, 'T-LEAD').map((t) => Object.assign({ paid: false }, t)), changed: false };
}

test('정산표 목록 — 맨 왼쪽 ☐(보이는 것 모두) 다음 번호', () => {
  const h = V.runsTable([fakeRun()], {}, { 'cons-test': '테스트사업' });
  const ths = [...h.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[0]);
  assert.match(ths[0], /input type="checkbox" data-all=/);
  assert.match(ths[1], /번호/);
  assert.match(h, /data-ck="cons-test_2026-10"/);
  assert.match(visible(h), /계산만/);
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

test('정산표 — 확인 필요가 있으면 «확정» 단추가 잠긴다', () => {
  const r = fakeRun('draft');
  r.sites[0].issues.push('요율 없음: 김가나');
  assert.match(V.runDetail(r, NAMES), /<button[^>]*data-act="confirm"[^>]*disabled/);
  assert.doesNotMatch(V.runDetail(fakeRun('draft'), NAMES), /<button[^>]*data-act="confirm"[^>]*disabled/);
});

test('송금 목록 — ☐·번호·보냄 칸, 보내는 사람 → 받는 사람 이름', () => {
  const h = V.runDetail(fakeRun('confirmed'), NAMES);
  const t = h.slice(h.indexOf('data-name="transfers"'));
  assert.match(t, /data-all="transfers"/);
  assert.match(t, /data-paid="0"/);
  assert.match(visible(t), /87,915/);
});

test('계산만인 달도 송금 목록을 미리 보여 주되 «보냄»은 누를 수 없다', () => {
  const r = fakeRun('draft'); r.transfers = [];
  const h = V.runDetail(r, NAMES);
  const t = h.slice(h.indexOf('data-name="transfers"'));
  assert.ok(h.indexOf('data-name="transfers"') > 0, '미리보기 송금 표가 없다');
  assert.match(visible(t), /87,915/);
  assert.match(t, /data-paid="0" disabled/);
  assert.match(visible(h), /미리보기/);
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

test('카톡 문구 상자 — 사람마다 복사 단추', () => {
  const h = V.messagesBox([{ sid: 'T-A', name: '김가나', text: '첫 줄\n둘째 줄' }, { sid: 'T-B', name: '이다라', text: 'x' }]);
  assert.match(h, /data-copy="0"/);
  assert.match(h, /data-copy="1"/);
  assert.doesNotMatch(visible(h), /T-A|T-B/);
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
