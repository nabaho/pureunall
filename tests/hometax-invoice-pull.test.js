'use strict';
/* 🏛 홈택스 매출 세금계산서 자동 수집(팝빌) — 지키는 것 (2026-11-28 대표 「테스트로 시작」)
   ① 서버가 쓰는 보관함 열쇠가 이알피 _invArcKey 와 «같다» — 다르면 같은 계산서가 두 줄로 쌓인다.
   ② 개인정보를 담지 않는다 — 주민번호·외국인 번호는 사업자번호 칸에 안 들어가고, 대표자 이름·메일·비고는 버린다.
   ③ 엑셀·이카운트로 이미 들어온 같은 계산서는 «새 줄»이 아니라 그 줄에 승인번호만 붙인다(예상부가세 두 번 세기 방지).
      번호가 다르면 이름이 같아도 붙이지 않는다(회사를 이름으로 맞추지 않는다 — STATUS 되풀이된 실수 3).
   ④ 시험 모드는 보관함에 «쓰지 않는다». 꺼져 있으면 예약은 팝빌을 부르지도 않는다. 실패해도 잠금이 풀린다.
   ⑤ 규칙 — 스위치는 관리자만, 결과·잠금은 서버만 쓴다. 읽기는 재무 권한자.
   ⑥ 화면 띠 글자는 상태마다 다르게 말한다(실패는 실패로, 시험은 «안 넣음»으로).
   함수를 «떠서 돌려» 본다 — 글자만 찾는 검사는 기능을 꺼도 통과한다(STATUS 되풀이된 실수 2). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const HT = require('../functions/hometax-invoice');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* 이알피에서 함수 하나를 떠 온다 (여는 괄호까지 붙여 찾는다 — 남의 이름으로 시작하는 함수에 걸리지 않게) */
function cut(name){
  const at = ERP.indexOf('function ' + name + '(');
  assert.ok(at >= 0, '이알피에서 ' + name + ' 을 못 찾았습니다');
  let i = ERP.indexOf('{', at), depth = 0;
  for(; i < ERP.length; i++){
    if(ERP[i] === '{') depth++;
    else if(ERP[i] === '}'){ depth--; if(depth === 0) break; }
  }
  return ERP.slice(at, i + 1);
}
function load(names){
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(names.map(cut).join('\n'), ctx);
  return ctx;
}

/* 팝빌 목록 한 줄 — 실제 HTTaxinvoiceAbbr 모양(문서 developers.popbill.com …/httaxinvoice/node/api/search) */
function prow(over){
  return Object.assign({
    ntsconfirmNum: '20261110410000420000abcd', writeDate: '20261110', issueDate: '20261110', sendDate: '20261111',
    invoiceType: '매출', taxType: '과세', purposeType: '청구', modifyYN: false, orgNTSConfirmNum: null,
    invoicerCorpNum: '1112233333', invoicerCorpName: '우리 노무법인',
    invoiceeCorpNum: '2208800000', invoiceeType: '사업자', invoiceeCorpName: '(주)가나상사',
    invoiceeCEOName: '홍길동', invoiceeEmail1: 'boss@example.com', invoiceeEmail2: '',
    supplyCostTotal: '200000', taxTotal: '20000', totalAmount: '220000',
    itemName: '11월 노무자문료', remark1: '메모'
  }, over || {});
}

test('① 보관함 열쇠 — 서버와 이알피가 같은 열쇠를 짓는다', () => {
  const c = load(['_invArcKey']);
  ['nts|20261110410000420000abcd', '가나상사|2026-11-10|200000|자문료#1', '', 'x'.repeat(900), '(주)「특수」.#$/[]'].forEach((s) => {
    assert.equal(HT.invArcKey(s), c._invArcKey(s), '열쇠가 다릅니다: ' + s.slice(0, 30));
  });
  assert.doesNotMatch(HT.invArcKey('nts|1.2#3'), /[.#$\/\[\]]/, '실시간DB 금지 글자가 열쇠에 들면 안 된다');
});

test('① 상호 정리 — 서버와 이알피 erpNormName 이 같다', () => {
  const c = load(['erpNormName']);
  ['(주)가나 상사', '주식회사 가나상사', '㈜가나-상사', '재단법인 다라', '가나상사'].forEach((s) => {
    assert.equal(HT.normName(s), c.erpNormName(s), s);
  });
});

test('② 한 줄 옮기기 — 쓸 칸만, 개인정보는 버린다', () => {
  const r = HT.mapRow(prow());
  assert.equal(r.nts, '20261110410000420000abcd');
  assert.equal(r._id, 'nts|' + r.nts);
  assert.equal(r.date, '2026-11-10');
  assert.equal(r.supply, 200000);
  assert.equal(r.tax, 20000);
  assert.equal(r.biznum, '2208800000');
  assert.equal(r.company, '(주)가나상사');
  const keys = Object.keys(r);
  ['invoiceeCEOName', 'invoiceeEmail1', 'remark1', 'invoicerCorpNum'].forEach((k) => assert.ok(!keys.includes(k), k + ' 를 담았다'));
  assert.ok(!JSON.stringify(r).includes('홍길동'), '대표자 이름이 들어갔다');
  assert.ok(!JSON.stringify(r).includes('example.com'), '메일이 들어갔다');

  assert.equal(HT.mapRow(prow({ invoiceeType: '개인', invoiceeCorpNum: '9001011234567' })).biznum, undefined, '주민번호가 사업자번호 칸에');
  assert.equal(HT.mapRow(prow({ invoiceeType: '외국인', invoiceeCorpNum: '9999999999999' })).biznum, undefined);
  assert.equal(HT.mapRow(prow({ invoiceeType: '개인', invoiceeCorpNum: '1234567890' })).biznum, undefined, '개인이면 10자리여도 담지 않는다');

  const m = HT.mapRow(prow({ modifyYN: true, orgNTSConfirmNum: '20261001-41000042-0000aaaa', supplyCostTotal: '-200000' }));
  assert.equal(m.modify, true);
  assert.equal(m.supply, -200000, '수정(음수)은 그대로 — 예상부가세가 빼야 한다');
  assert.ok(m.orgNts && !/-/.test(m.orgNts));

  assert.equal(HT.mapRow(prow({ ntsconfirmNum: '' })), null);
  assert.equal(HT.mapRow(prow({ writeDate: '' })), null);
  assert.equal(HT.mapRow(prow({ supplyCostTotal: '공급가' })), null);
  assert.equal(HT.mapRow(null), null);
});

test('수집 기간 — 오늘(한국)까지, 한 번 요청은 3개월 이하로 나눠 이어 붙인다', () => {
  const now = Date.parse('2026-11-28T00:30:00Z');   // 한국 09:30
  const one = HT.windows(now, HT.DEFAULT_DAYS);
  assert.equal(one.length, 1);
  assert.equal(one[0].e, HT.ymdKst(now));
  const many = HT.windows(now, 200);
  assert.ok(many.length >= 3);
  many.forEach((w, i) => {
    const days = (Date.parse(w.e) - Date.parse(w.s)) / 864e5 + 1;
    assert.ok(days >= 1 && days <= HT.WINDOW_DAYS, '창이 3개월을 넘었다');
    if(i) assert.equal(Date.parse(w.s) - Date.parse(many[i - 1].e), 864e5, '창 사이가 비거나 겹친다');
  });
  assert.equal((Date.parse(many[many.length - 1].e) - Date.parse(many[0].s)) / 864e5 + 1, 200);
  assert.ok(HT.windows(now, 99999).length <= Math.ceil(HT.MAX_DAYS / HT.WINDOW_DAYS), '한도 밖 기간을 받았다');
  const kst = HT.windows(Date.parse('2026-11-27T16:00:00Z'), 1);   // 한국으로는 11-28 01:00
  assert.equal(kst[0].e, '2026-11-28', '한국 날짜로 끊는다');
});

test('③ 보관함에 더하기 — 새 줄·합침·이미 있음', () => {
  const now = 1764300000000;
  const a = HT.mapRow(prow());
  const b = HT.mapRow(prow({ ntsconfirmNum: 'B0000000000000000000000b', invoiceeCorpNum: '3330000000', invoiceeCorpName: '다라', supplyCostTotal: '300000' }));
  const c = HT.mapRow(prow({ ntsconfirmNum: 'C0000000000000000000000c', invoiceeCorpNum: '4440000000', invoiceeCorpName: '마바', supplyCostTotal: '400000' }));
  const ex = {
    old1: { _id: '(주)가나상사|2026-11-10|200000|자문료#1', company: '(주)가나상사', biznum: '220-88-00000', date: '2026-11-10', supply: 200000, t: 1 },
    old2: { _id: '다라|2026-11-10|300000|#1', company: '주식회사 다라', date: '2026-11-10', supply: 300000, t: 1 },
    old3: { _id: '마바|2026-11-10|400000|#1', company: '마바', biznum: '9990000000', date: '2026-11-10', supply: 400000, t: 1 }
  };
  const p = HT.planWrites([a, b, c], ex, now);
  assert.equal(p.merged, 2, '번호가 같은 줄·번호 없는 줄(상호 같음)은 합친다');
  assert.equal(p.added, 1, '번호가 다른 줄은 상호가 같아도 새 줄');
  assert.equal(p.upd[HT.ROOT + '/h/old1/nts'], a.nts);
  assert.equal(p.upd[HT.ROOT + '/h/old1/t'], now, '다른 PC 가 다시 받게 t 를 올린다');
  assert.equal(p.upd[HT.ROOT + '/h/old2/nts'], b.nts);
  assert.equal(p.upd[HT.ROOT + '/h/old2/biznum'], '3330000000', '번호 없던 옛 줄에 번호를 채운다');
  assert.equal(p.upd[HT.ROOT + '/h/old3/nts'], undefined, '번호가 다른 옛 줄에 붙였다');
  const newKey = HT.ROOT + '/h/' + HT.invArcKey(c._id);
  assert.equal(p.upd[newKey].nts, c.nts);
  assert.equal(p.upd[newKey].t, now);
  assert.equal(p.upd[HT.ROOT + '/u'], now);

  /* 다시 돌리면(같은 승인번호) 아무것도 안 쓴다 */
  const after = Object.assign({}, ex);
  after.old1 = Object.assign({}, ex.old1, { nts: a.nts });
  after.old2 = Object.assign({}, ex.old2, { nts: b.nts });
  after[HT.invArcKey(c._id)] = Object.assign({}, c, { t: now });
  const p2 = HT.planWrites([a, b, c, a], after, now + 1);
  assert.deepEqual([p2.added, p2.merged, p2.same], [0, 0, 3]);
  assert.deepEqual(p2.upd, {}, '바뀐 것이 없으면 u 도 안 건드린다');
});

test('③ 같은 날 같은 금액 두 장 — 옛 줄 하나에 둘을 붙이지 않는다', () => {
  const r1 = HT.mapRow(prow({ ntsconfirmNum: 'X1' }));
  const r2 = HT.mapRow(prow({ ntsconfirmNum: 'X2' }));
  const ex = { o1: { company: '(주)가나상사', biznum: '2208800000', date: '2026-11-10', supply: 200000 } };
  const p = HT.planWrites([r1, r2], ex, 5);
  assert.equal(p.merged, 1);
  assert.equal(p.added, 1);
});

/* ── 가짜 실시간DB · 가짜 팝빌 ── */
function fakeDb(init){
  const data = JSON.parse(JSON.stringify(init || {}));
  const writes = [];
  const parts = (p) => String(p || '').split('/').filter(Boolean);
  function get(p){ let o = data; for(const k of parts(p)){ if(o == null || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : o; }
  function put(p, v){
    const ks = parts(p); let o = data;
    ks.slice(0, -1).forEach((k) => { if(typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
    o[ks[ks.length - 1]] = v;
  }
  return {
    data, writes,
    ref(p){
      return {
        once: async () => ({ val: () => { const v = get(p); return v == null ? null : JSON.parse(JSON.stringify(v)); } }),
        update: async (obj) => { writes.push({ path: p || '/', obj }); Object.keys(obj).forEach((k) => put((p ? p + '/' : '') + k, obj[k])); },
        set: async (v) => { writes.push({ path: p, set: v }); put(p, v); },
        transaction: async (fn) => { const n = fn(get(p)); if(n === undefined) return { committed: false }; put(p, n); return { committed: true }; }
      };
    }
  };
}
function fakePopbill(list, o){
  const calls = { made: [], req: [], search: [] };
  class Svc {
    constructor(cfg){ calls.made.push(cfg); }
    requestJob(corp, type, dtype, s, e, user, ok, err){
      calls.req.push({ corp, type, dtype, s, e });
      if(o && o.reqErr) return err({ code: -99999999, message: '홈택스 인증 정보 없음' });
      ok('012345678901234567');
    }
    getJobState(corp, job, user, ok){
      ok(o && o.jobFail ? { jobState: 3, errorCode: 2, errorReason: '부서사용자 로그인 실패' } : { jobState: 3, errorCode: 1 });
    }
    search(corp, job, type, taxType, purpose, a, b, c, page, perPage, order, user, ss, ok){
      calls.search.push({ type, page, perPage });
      const per = 2;
      ok({ code: 1, total: list.length, pageNum: page, pageCount: Math.max(1, Math.ceil(list.length / per)), list: list.slice((page - 1) * per, page * per) });
    }
  }
  return { calls, requireFn: (name) => { assert.match(name, /^popbill\//); return Svc; } };
}
const ENV = { POPBILL_LINK_ID: 'LINK', POPBILL_SECRET_KEY: 'SECRET' };
const NOW = Date.parse('2026-11-28T00:10:00Z');

test('④ 꺼져 있으면 예약은 팝빌을 부르지 않는다', async () => {
  const db = fakeDb({ hometax_pull: { cfg: { on: false, test: true, corpNum: '1112233333' } } });
  const pb = fakePopbill([prow()]);
  const r = await HT.runOnce({ getDatabase: () => db, env: ENV, now: () => NOW, requireFn: pb.requireFn }, {});
  assert.equal(r.skipped, 'off');
  assert.equal(pb.calls.made.length, 0);
  assert.equal(db.data.hometax_pull.status.state, 'off');
});

test('④ 열쇠·사업자번호가 없으면 부르지 않고 까닭을 적는다', async () => {
  const db = fakeDb({ hometax_pull: { cfg: { on: true, test: true, corpNum: '' } } });
  const pb = fakePopbill([prow()]);
  const r1 = await HT.runOnce({ getDatabase: () => db, env: ENV, now: () => NOW, requireFn: pb.requireFn }, {});
  assert.equal(r1.ok, false);
  assert.match(db.data.hometax_pull.status.error, /사업자번호/);
  db.data.hometax_pull.cfg.corpNum = '1112233333';
  const r2 = await HT.runOnce({ getDatabase: () => db, env: {}, now: () => NOW, requireFn: pb.requireFn }, {});
  assert.equal(r2.ok, false);
  assert.match(db.data.hometax_pull.status.error, /POPBILL/);
  assert.equal(pb.calls.made.length, 0);
});

test('④ 시험 모드 — 읽기만, 보관함에는 쓰지 않는다 (처음 값이 시험이다)', async () => {
  const db = fakeDb({ hometax_pull: { cfg: { on: true, corpNum: '1112233333' } }, invoice_arc: { h: {} } });
  const pb = fakePopbill([prow(), prow({ ntsconfirmNum: 'B1' }), prow({ ntsconfirmNum: 'C1' })]);
  const r = await HT.runOnce({ getDatabase: () => db, env: ENV, now: () => NOW, requireFn: pb.requireFn }, {});
  assert.equal(r.ok, true);
  assert.equal(r.test, true);
  assert.equal(r.read, 3, '쪽을 넘겨 다 읽는다');
  assert.equal(pb.calls.made[0].IsTest, true);
  assert.equal(pb.calls.made[0].IPRestrictOnOff, false);
  assert.deepEqual(pb.calls.req[0], { corp: '1112233333', type: 'SELL', dtype: 'S', s: '20261122', e: '20261128' });
  assert.ok(!db.writes.some((w) => String(w.path).startsWith('invoice_arc') || (w.obj && Object.keys(w.obj).some((k) => k.startsWith('invoice_arc')))),
    '시험 모드가 보관함에 썼다');
  assert.equal(db.data.hometax_pull.status.state, 'test');
  assert.equal(db.data.hometax_pull.lock, 0, '잠금이 풀리지 않았다');
});

test('④ 운영 모드 — 보관함에 더하고 결과를 적는다', async () => {
  const db = fakeDb({
    hometax_pull: { cfg: { on: true, test: false, corpNum: '111-22-33333' } },
    invoice_arc: { h: { old1: { company: '(주)가나상사', biznum: '2208800000', date: '2026-11-10', supply: 200000, t: 1 } } }
  });
  const pb = fakePopbill([prow(), prow({ ntsconfirmNum: 'NEW1', invoiceeCorpNum: '5550000000', supplyCostTotal: '50000' })]);
  const r = await HT.runOnce({ getDatabase: () => db, env: ENV, now: () => NOW, requireFn: pb.requireFn }, { manual: true, by: 'S001' });
  assert.deepEqual([r.ok, r.test, r.added, r.merged], [true, false, 1, 1]);
  assert.equal(pb.calls.made[0].IsTest, false);
  assert.equal(db.data.invoice_arc.h.old1.nts, '20261110410000420000abcd');
  assert.ok(db.data.invoice_arc.h[HT.invArcKey('nts|NEW1')]);
  const st = db.data.hometax_pull.status;
  assert.deepEqual([st.state, st.added, st.merged, st.by], ['ok', 1, 1, 'S001']);
  assert.equal(db.data.hometax_pull.lock, 0);
});

test('④ 팝빌·홈택스 실패 — 까닭을 적고 잠금을 푼다, 보관함은 그대로', async () => {
  for(const o of [{ reqErr: true }, { jobFail: true }]){
    const db = fakeDb({ hometax_pull: { cfg: { on: true, test: false, corpNum: '1112233333' } }, invoice_arc: { h: {} } });
    const pb = fakePopbill([prow()], o);
    const r = await HT.runOnce({ getDatabase: () => db, env: ENV, now: () => NOW, requireFn: pb.requireFn }, {});
    assert.equal(r.ok, false);
    assert.equal(db.data.hometax_pull.status.state, 'error');
    assert.ok(db.data.hometax_pull.status.error.length > 0);
    assert.equal(db.data.hometax_pull.lock, 0);
    assert.deepEqual(db.data.invoice_arc.h, {});
  }
});

test('④ 이미 돌고 있으면 겹쳐 돌지 않는다', async () => {
  const db = fakeDb({ hometax_pull: { cfg: { on: true, test: true, corpNum: '1112233333' }, lock: NOW - 1000 } });
  const pb = fakePopbill([prow()]);
  const r = await HT.runOnce({ getDatabase: () => db, env: ENV, now: () => NOW, requireFn: pb.requireFn }, { manual: true });
  assert.equal(r.busy, true);
  assert.equal(pb.calls.made.length, 0);
  assert.equal(db.data.hometax_pull.lock, NOW - 1000, '남의 잠금을 풀었다');
});

test('⑤ 규칙 — 읽기 재무, 스위치 관리자, 결과·잠금 서버만', () => {
  const rules = JSON.parse(cp.execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8', maxBuffer: 1 << 26 })).rules;
  const r = rules.hometax_pull;
  assert.ok(r, 'hometax_pull 규칙이 없다');
  assert.match(r['.read'], /'fin'/);
  assert.equal(r['.write'], undefined, '뿌리에 쓰기 문이 있으면 아래 칸을 다시 닫을 수 없다');
  assert.match(r.cfg['.write'], /'isAdmin'/);
  assert.equal(r.status['.write'], false);
  assert.equal(r.lock['.write'], false);
  assert.equal(r.cfg.$other['.validate'], false, '스위치에 아무 칸이나 적힌다');
  assert.ok(rules.invoice_arc, '보관함 규칙이 사라졌다');
});

test('⑥ 화면 띠 — 상태마다 다르게 말한다', () => {
  const c = load(['_htpTime', 'erpHometaxPullLine']);
  const never = c.erpHometaxPullLine({}, {});
  assert.match(never.chip, /꺼짐/);
  assert.match(never.text, /한 번도/);
  const t = Date.parse('2026-11-28T22:10:00Z');
  const err = c.erpHometaxPullLine({ on: true }, { lastRunAt: t, state: 'error', error: '부서사용자 로그인 실패' });
  assert.equal(err.tone, 'bad');
  assert.match(err.text, /부서사용자 로그인 실패/);
  assert.match(err.text, /11-29 07:10/, '한국 시각으로 보인다');
  const tst = c.erpHometaxPullLine({ on: true }, { lastRunAt: t, lastOkAt: t, state: 'test', read: 12 });
  assert.match(tst.chip, /시험/);
  assert.match(tst.text, /12건/);
  assert.match(tst.text, /안 넣음|넣지 않음/);
  const ok = c.erpHometaxPullLine({ on: true, test: false }, { lastRunAt: t, lastOkAt: t, state: 'ok', added: 3, merged: 2, same: 7, range: '2026-11-22~2026-11-28' });
  assert.equal(ok.tone, 'ok');
  assert.doesNotMatch(ok.chip, /시험|꺼짐/);
  assert.match(ok.text, /3/); assert.match(ok.text, /2/); assert.match(ok.text, /7/);
  const off = c.erpHometaxPullLine({ on: false, test: false }, { lastRunAt: t, state: 'off' });
  assert.match(off.chip, /꺼짐/);
});

test('⑥ 화면 — 아카이브 두 갈래 모두에 띠, 지금 받기는 로그인 증표로, 설정은 관리자만', () => {
  const ra = cut('FinanceInvoice');
  const arch = ra.slice(ra.indexOf('function renderArchive('));
  assert.ok((arch.match(/^\s*pullStrip,$/gm) || []).length >= 2, '빈 보관함·찬 보관함 둘 다 띠가 있어야 한다');
  const strip = cut('HometaxPullStrip');
  assert.match(strip, /HOMETAX_PULL_FN/);
  assert.match(strip, /'Authorization':\s*'Bearer '\s*\+/);
  assert.match(strip, /isAdm\s*&&\s*h\('button'/, '⚙ 단추가 관리자 조건 없이 보인다');
  assert.match(strip, /isAdm\s*&&\s*form\s*&&/, '설정 줄이 관리자 조건 없이 열린다');
  assert.match(strip, /confirm\(/, '운영으로 바꿀 때 묻지 않는다');
  assert.match(ERP, /var HOMETAX_PULL_FN = 'https:\/\/asia-northeast3-pureun-erp\.cloudfunctions\.net\/hometaxInvoicePullNow'/);
});

test('서버 함수가 배포 목록에 있고, 팝빌 꾸러미는 부를 때만 싣는다', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  const chk = require('../scripts/firebase-deploy-check.js').check('hometaxInvoicePull,hometaxInvoicePullNow', idx);
  assert.equal(chk.ok, true, chk.why);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'functions', 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies.popbill, 'functions/package.json 에 popbill 이 없다 — 배포하면 «모듈 없음»');
  const src = fs.readFileSync(path.join(ROOT, 'functions', 'hometax-invoice.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.doesNotMatch(src.split('\n').filter((l) => /^\S/.test(l)).join('\n'), /require\(["']popbill/,
    '맨 위에서 popbill 을 부르면 꾸러미 없는 검사·다른 함수가 같이 죽는다');
  assert.match(src, /secrets:\s*SECRETS/);
  assert.match(src, /POPBILL_LINK_ID/);
  assert.match(HT.SCHEDULE, /^\d+ \d+ \* \* \*$/, '매일 도는 예약이어야 한다');
});
