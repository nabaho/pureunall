'use strict';
/* 📨 보낸메일함 → 이알피 계약 요청 (견적·계약 자동화 계획 3 · 작업 3)
   Review Focus — ① 같은 메일을 두 번 처리할 때 ② 사업장을 못 찾거나 둘 이상일 때 ④ 금액이 대기열에 실리지 않는다 ⑦ 훅이 죽어도 동기화는 계속된다.
   ⚠ 회사·주소·사람은 전부 지어낸 것이다(example 도메인). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('./mail-quote-watch.js');

const NOW = Date.parse('2026-11-08T12:00:00+09:00');
const out = (v) => JSON.parse(JSON.stringify(v));

/* 아주 작은 가짜 DB — 거래는 실제 SDK 처럼 «지금 값»을 넘겨 부른다(처음엔 null 일 수 있다) */
function fakeDb(tree, opts) {
  const o = opts || {};
  const get = (p) => p.split('/').filter(Boolean).reduce((a, k) => (a == null ? a : a[k]), tree);
  const put = (p, v) => {
    const ks = p.split('/').filter(Boolean); let a = tree;
    ks.slice(0, -1).forEach((k) => { a = a[k] = a[k] || {}; });
    a[ks[ks.length - 1]] = v;
  };
  return {
    tree,
    ref: (p) => ({
      once: async () => ({ val: () => { const v = get(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }),
      transaction: async (fn) => {
        if (o.failWrite) throw new Error('쓰기 실패(가짜)');
        const cur = get(p);
        const r = fn(cur === undefined ? null : cur);
        if (r === undefined) return { committed: false };
        put(p, r); return { committed: true };
      },
    }),
  };
}
const co = (o) => Object.assign({ id: 'co1', name: '가나기관', bizNo: '1234567890', status: 'active', email: '',
  contacts: [{ name: '김가나', email: 'kim@gana.example', addedFrom: '' }] }, o || {});
const row = (o) => Object.assign({ u: '1001', s: '[푸른노무법인] 가나기관 컨설팅 견적서 송부의 건', d: NOW - 3600e3, t: 'kim@gana.example', tn: 'kim@gana.example',
  an: ['견적서_가나기관.pdf'], a: 1 }, o || {});
async function run(rows, cos, over) {
  const o = over || {};
  const db = fakeDb({ pucards: { config: { quoteWatch: { on: o.on === undefined ? true : o.on } } }, data: { contract_requests: {} } }, o.db);
  const res = await W.watchSentMail({ getDatabase: () => db }, { slug: 'Sent Messages-6d8c6b35', rows, now: NOW,
    readCompanies: async () => (cos === undefined ? [co()] : cos), self: o.self || ['370-6@daum.net'] });
  return { res, reqs: db.tree.data.contract_requests, db };
}

test('★ 기본 «꺼짐» — 스위치가 없거나 true 가 아니면 아무것도 안 한다', async () => {
  const db0 = fakeDb({ data: { contract_requests: {} } });                       /* 스위치 칸 자체가 없다 */
  const r0 = await W.watchSentMail({ getDatabase: () => db0 }, { slug: 's', rows: [row()], now: NOW, readCompanies: async () => [co()] });
  assert.equal(r0.ran, false); assert.deepEqual(db0.tree.data.contract_requests, {});
  for (const off of [false, 0, 'true', 1]) {
    const x = await run([row()], undefined, { on: off });
    assert.equal(x.res.ran, false, '꺼짐 값 ' + JSON.stringify(off));
    assert.deepEqual(x.reqs, {});
  }
});

test('견적서 → kind:quote · 업체를 한 곳으로 이었으면 pending + companyId, 금액·본문 칸 없음', async () => {
  const { res, reqs } = await run([row()]);
  assert.equal(res.made, 1);
  const k = W.reqKey('Sent Messages-6d8c6b35|1001');
  const r = out(reqs[k]);
  assert.equal(r.kind, 'quote'); assert.equal(r.state, 'pending'); assert.equal(r.companyId, 'co1'); assert.equal(r.docKind, 'quote');
  assert.equal(r.srcKey, 'Sent Messages-6d8c6b35|1001'); assert.equal(r.by, 'server');
  assert.deepEqual(r.to, ['kim@gana.example']); assert.deepEqual(r.atts, ['견적서_가나기관.pdf']);
  assert.ok(!('managerMain' in r), '담당자는 서버가 정하지 않는다(이름으로 사번을 채우지 않는다)');
  const allowed = ['kind', 'state', 'srcKey', 'subject', 'docKind', 'atts', 'to', 'at', 'by', 'createdAt', 'companyId'];
  assert.deepEqual(Object.keys(r).sort(), allowed.sort(), '요청에는 허용한 칸만 있다 — 금액·본문 같은 칸이 없다');
  assert.ok(!/금액|amount|원$/.test(JSON.stringify(r)));
});

test('계약서 → kind:advance(계약협의로 이동 신호)', async () => {
  const { reqs } = await run([row({ s: '[푸른노무법인] 2026년 자문계약서 송부의 건', an: ['자문계약서_가나기관.pdf'] })]);
  const r = out(Object.values(reqs)[0]);
  assert.equal(r.kind, 'advance'); assert.equal(r.docKind, 'contract'); assert.equal(r.companyId, 'co1');
});

test('① 같은 메일을 두 번 처리해도 요청은 하나다(없을 때만 쓴다)', async () => {
  const db = fakeDb({ pucards: { config: { quoteWatch: { on: true } } }, data: { contract_requests: {} } });
  const call = () => W.watchSentMail({ getDatabase: () => db }, { slug: 's1', rows: [row()], now: NOW, readCompanies: async () => [co()], self: [] });
  const a = await call(); const b = await call();
  assert.equal(a.made, 1); assert.equal(b.made, 0); assert.equal(b.skipped, 1);
  assert.equal(Object.keys(db.tree.data.contract_requests).length, 1);
});

test('② 사업장을 못 찾으면 blocked + 까닭, 표시 이름은 «미리 채운 값»일 뿐이다', async () => {
  const { reqs } = await run([row({ t: 'who@unknown.example', tn: '다라상사' })]);
  const r = out(Object.values(reqs)[0]);
  assert.equal(r.state, 'blocked'); assert.ok(!r.companyId);
  assert.match(r.why, /사업장을 찾지 못했습니다/);
  assert.equal(r.companyName, '다라상사');
  const noName = out(Object.values((await run([row({ t: 'who@unknown.example', tn: 'who@unknown.example' })])).reqs)[0]);
  assert.equal(noName.companyName, '', '주소가 그대로 표시 이름이면 이름 후보로 쓰지 않는다');
});

test('② 같은 도메인을 쓰는 업체가 둘이면 안 짚는다(blocked)', async () => {
  const cos = [co({ id: 'a1', contacts: [{ email: 'x@twin.example' }] }), co({ id: 'a2', name: '쌍둥이상사', contacts: [{ email: 'y@twin.example' }] })];
  const { reqs } = await run([row({ t: 'z@twin.example' })], cos);
  const r = out(Object.values(reqs)[0]);
  assert.equal(r.state, 'blocked'); assert.match(r.why, /둘 이상/);
});

test('② 받는 주소가 서로 다른 업체에 걸리면 안 짚는다', async () => {
  const cos = [co({ id: 'a1', contacts: [{ email: 'x@one.example' }] }), co({ id: 'a2', name: '둘째상사', contacts: [{ email: 'y@two.example' }] })];
  const { reqs } = await run([row({ t: 'x@one.example, y@two.example' })], cos);
  const r = out(Object.values(reqs)[0]);
  assert.equal(r.state, 'blocked'); assert.match(r.why, /서로 다른 업체 2곳/);
});

test('개인 메일(naver 등)은 도메인으로 안 잇고, 업체관리에 «사람이 적은» 그 주소째 있을 때만 잇는다', async () => {
  const cos = [co({ id: 'p1', contacts: [{ email: 'owner@naver.com', addedFrom: '' }] })];
  const hit = out(Object.values((await run([row({ t: 'owner@naver.com' })], cos)).reqs)[0]);
  assert.equal(hit.state, 'pending'); assert.equal(hit.companyId, 'p1');
  const miss = out(Object.values((await run([row({ t: 'someone@naver.com' })], cos)).reqs)[0]);
  assert.equal(miss.state, 'blocked', '같은 개인 메일 도메인이라고 업체를 잇지 않는다');
});

test('공공기관·재단 도메인(or.kr·go.kr)도 한 업체뿐이면 잇는다 — 이 길은 «공공기관 제외»를 쓰지 않는다', async () => {
  const cos = [co({ id: 'g1', name: '가나재단', contacts: [{ email: 'staff@gana.or.kr', addedFrom: '' }] })];
  const r = out(Object.values((await run([row({ t: 'other@gana.or.kr' })], cos)).reqs)[0]);
  assert.equal(r.state, 'pending'); assert.equal(r.companyId, 'g1');
});

test('메일에서 이은 담당자 주소(addedFrom mail…)는 업체를 잇는 근거가 아니다', async () => {
  const cos = [co({ id: 'm1', contacts: [{ email: 'auto@mailadded.example', addedFrom: 'mail-fill' }] })];
  const r = out(Object.values((await run([row({ t: 'auto@mailadded.example' })], cos)).reqs)[0]);
  assert.equal(r.state, 'blocked');
});

test('끝난·지운 업체는 잇지 않는다', async () => {
  for (const bad of [{ status: 'closed' }, { status: 'terminated' }, { _deleted: true }]) {
    const r = out(Object.values((await run([row()], [co(bad)])).reqs)[0]);
    assert.equal(r.state, 'blocked', JSON.stringify(bad));
  }
});

test('견적도 계약서도 아닌 메일·비교견적 «요청» 메일·받는 사람 없는 줄은 요청을 만들지 않는다', async () => {
  const rows = [row({ u: '1', s: '안녕하세요 자료입니다', an: ['소개서.pdf'] }),
    row({ u: '2', s: '[푸른노무법인] 비교견적서 요청의 건', an: [] }),
    row({ u: '3', t: '' }),
    row({ u: '4', t: '370-6@daum.net' })];                                       /* 받는 사람이 나 자신뿐 */
  const { res, reqs } = await run(rows);
  assert.deepEqual(reqs, {});
  assert.equal(res.made, 0);
});

test('한 달 넘은 메일은 안 본다 · 한 번에 MAX_PER_RUN 건까지만', async () => {
  const old = await run([row({ d: NOW - 31 * 24 * 3600e3 })]);
  assert.deepEqual(old.reqs, {});
  const many = [];
  for (let i = 0; i < W.MAX_PER_RUN + 5; i++) many.push(row({ u: String(2000 + i) }));
  const r = await run(many);
  assert.equal(Object.keys(r.reqs).length, W.MAX_PER_RUN);
});

test('⑦ 쓰기가 실패해도 던지지 않는다 — 다음 메일로 넘어가고 skipped 로 센다', async () => {
  const r = await run([row()], undefined, { db: { failWrite: true } });
  assert.equal(r.res.made, 0); assert.equal(r.res.skipped, 1);
});

test('요청 열쇠는 RTDB 에 못 쓰는 글자가 없고 메일마다 다르다', () => {
  const a = W.reqKey('Sent Messages-6d8c6b35|1001'), b = W.reqKey('Sent Messages-6d8c6b35|1002');
  assert.match(a, /^mq-[0-9a-f]{20}$/); assert.notEqual(a, b);
  assert.equal(W.reqKey('x'), W.reqKey('x'));
});

test('메일 동기화가 «보낸편지함의 새로 받은 줄»에서만, try/catch 로 감싸 부른다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'mail-sync.js'), 'utf8');
  assert.match(src, /require\('\.\/mail-quote-watch'\)/);
  const i = src.indexOf('QUOTEWATCH.watchSentMail');
  assert.ok(i > 0);
  const before = src.slice(Math.max(0, i - 700), i);
  assert.match(before, /r\.dir === 'fresh' && held\.length && MB\.folderKind\(p\.box\) === 'sent'/);
  assert.match(before, /try \{/);
  assert.match(src.slice(i, i + 700), /catch \(e\)[\s\S]{0,200}동기화는 계속합니다/);
});

test('서버가 쓰는 두 사본(quote-detect-core·mail-fill-core)이 배포 폴더 안에 있다', () => {
  assert.ok(fs.existsSync(path.join(__dirname, 'quote-detect-core', 'pu-quote-detect.js')));
  assert.ok(fs.existsSync(path.join(__dirname, 'mail-fill-core', 'pu-mail-fill-core.js')));
});
