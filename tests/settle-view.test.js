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

test('정산표 목록 — 맨 왼쪽 ☐(보이는 것 모두) 다음 번호, 사업 종류마다 묶음 머리(사업 이름 전체)를 한 번만', () => {
  const r2 = Object.assign(fakeRun(), { id: 'cons-test_2026-09', monthKey: '2026-09', label: '9월' });
  const h = V.runsTable([fakeRun(), r2], {}, { 'cons-test': '테스트사업 (테스트재단)' }, 'cons-test_2026-10');
  const ths = [...h.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[0]);
  assert.match(ths[0], /input type="checkbox" data-all=/);
  assert.match(ths[1], /번호/);
  assert.match(h, /data-ck="cons-test_2026-10"/);
  assert.match(visible(h), /임시저장/);
  assert.equal((visible(h).match(/테스트사업 \(테스트재단\)/g) || []).length, 1, '사업 이름은 묶음 머리에 한 번, 줄이지 않고 전체');
  assert.ok(h.indexOf('10월') < h.indexOf('9월'), '최근 달이 위');
  assert.match(h, /<tr data-id="cons-test_2026-10" class="on">/, '열어 둔 달 표시');
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
  assert.match(v, /가나상사 · 1차 · 세후 합계/);
  assert.match(v, /&lt;b&gt;김가나&lt;\/b&gt; → 홍길동 87,915원/);
  assert.match(v, /주관/);
  assert.match(v, /담당 25%/);
  assert.match(v, /테스트사업 \(테스트재단\)/);
  const body = visible(h.slice(h.indexOf('data-name="run"'), h.indexOf('data-name="transfers"')));
  assert.equal((body.match(/가나상사/g) || []).length, 1, '사업장 이름이 줄마다 되풀이된다');
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

test('송금 방향 — 담당이 더 받았으면 «반환», 주관이 더 받았으면 «추가 지급»(묶음 머리·송금 목록·뜻 풀이·카톡·계산기)', () => {
  const back = V.runDetail(fakeRun('draft'), NAMES);
  assert.match(visible(back), /&lt;b&gt;김가나&lt;\/b&gt; → 홍길동 87,915원\s+반환/);
  assert.match(visible(back), /정산 방향/);
  assert.match(visible(back), /주관\(홍길동\)에게 돌려줌/);
  const tb = back.slice(back.indexOf('data-name="transfers"'));
  assert.match(visible(tb.slice(0, tb.indexOf('</thead>'))), /구분/);
  assert.match(tb, /data-k="dir"><span class="pill dir-back">반환</);
  /* 40% 면 담당 몫(1,371,390)이 받은 세후(945,033)보다 크다 → 주관이 더 줌 */
  const more = V.runDetail(fakeRun('draft', 40), NAMES);
  assert.match(visible(more), /홍길동 → &lt;b&gt;김가나&lt;\/b&gt; 426,357원\s+추가 지급/);
  assert.match(more, /class="pill dir-more">추가 지급</);
  /* 확정한 달 — 저장된 송금에는 방향 칸이 없다. 받는 사람이 주관이면 반환 */
  const c = V.runDetail(fakeRun('confirmed'), NAMES);
  assert.match(c.slice(c.indexOf('data-name="transfers"')), /dir-back">반환</);
  /* 카톡 문구도 같은 말 */
  const rule = { title: '테스트사업', leadSid: 'T-LEAD' };
  assert.match(C.buildMessages(fakeRun('confirmed'), rule, NAMES)[0].text, /반환 87,915원/);
  assert.match(C.buildMessages(fakeRun('confirmed', 40), rule, NAMES)[0].text, /추가 지급 426,357원/);
  /* 계산기 */
  const calc = C.calcSite([{ name: '갑', role: 'lead', pre: 2568182 }, { name: '을', role: 'staff', pre: 977273, rate: 25 }]);
  assert.equal(calc.transfers[0].dir, 'back');
  assert.match(visible(V.calcResult(calc, {})), /을 → 갑\s+87,915원\s+반환/);
});

test('정산표 목록 — 규칙이 있는 컨설팅 종류는 정산표가 없어도 묶음으로 보이고 «+ 입력»이 붙는다', () => {
  const h = V.runsTable([fakeRun()], {}, { 'cons-test': '테스트사업', 'cons-b': '나다사업 (나다협회)' }, '', { types: ['cons-test', 'cons-b'] });
  assert.match(h, /data-manual="cons-b"/);
  assert.match(h, /data-manual="cons-test"/);
  assert.match(visible(h), /나다사업 \(나다협회\)[\s\S]*아직 정산표 없음/);
  assert.equal((h.match(/<td class="n">\d+<\/td>/g) || []).length, 1, '번호는 정산표 줄에만');
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
