/* 📬 요청 메일 범위 분류(Jev) 서버 쪽 — functions/mail-req-scope.js + index.js 의 mailReqScope (대표 지시 2026-11-15)
   ⚠ 메일·이름은 모두 지어낸 것이다(저장소가 공개). Jev 는 «가짜 fetch» — 실제 업체를 부르지 않는다.
   못 박는 것:
     ① 화면은 «건 번호»만 준다 — 서버가 그 사람의 기록에서 제목·첨부 이름을 «직접» 읽는다(임의 글을 중계하지 않는다)
     ② 보내는 글은 «제목 + 첨부 이름»뿐이고, 번호·이메일 → 직원·업체 이름 → 남은 숫자 순서로 가린 뒤에 나간다
     ③ 이름 목록을 못 읽거나 직원 목록이 비어 있으면 «아무것도 안 보내고» 건너뛴다
     ④ 하루 한도는 부르기 «전에» 칸을 잡는다 — 동시 부름도 한도를 못 넘고, 못 쓴 칸은 돌려준다
     ⑤ 건마다 시간 한도, 함수 전체 마감 — 넘으면 «지금까지 결과만» 돌려준다
     ⑥ 모르는 답·빈 답은 «애매» — 지어낸 분류로 메일을 치우지 않는다
     ⑦ 서버 함수는 로그인 → 관리자 확인 → 열쇠 확인 → 분류 순서다(누구에게도 금고 상태를 안 알린다) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../functions/mail-req-scope.js');
const { 만들기 } = require('./helpers/fake-rtdb.js');

const ROOT = path.join(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const modSrc = fs.readFileSync(path.join(ROOT, 'functions', 'mail-req-scope.js'), 'utf8');
const YMD = '2026-11-15', UID = 'U1';

const rec = (n, s, extra) => Object.assign({ id: 'INBOX-ab~' + n, st: 'new', scope: 'unsure', scopeBy: 'rule', s: s, an: [], f: '보낸이 이름', e: 'a@example.org', d: 1 }, extra || {});
function makeDb(items, extra) {
  const map = {}; (items || []).forEach((r) => { map[r.id] = r; });
  return 만들기(Object.assign({
    data: {
      user_accounts: { v: { u1: { name: '김가나' }, u2: { name: '이다라' } } },
      companies: { v: { c1: { name: '마바사식품' }, c2: { name: '아자차산업' } } },
    },
    kcareer: { [UID]: { mailreq: { items: map } } },
  }, extra || {}));
}
const ids = (...n) => n.map((k) => ({ id: 'INBOX-ab~' + k }));
/* Jev 흉내 — 받은 요청을 모두 적어 두고, answer(text) 로 답을 만든다 */
function fakeFetch(answer, o) {
  const calls = [];
  const fn = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, body, auth: init.headers.Authorization, signal: init.signal });
    if (o && o.status) return { ok: false, status: o.status, json: async () => ({ error: { message: '거절' } }) };
    return { ok: true, status: 200, json: async () => ({ answers: { scope: answer(body.state) }, usage: {} }) };
  };
  fn.calls = calls; return fn;
}
const deps = (db, ff, extra) => Object.assign({ db, key: 'K', fetchFn: ff, ymd: YMD, uid: UID }, extra || {});

/* ── ① 건 번호만 받고, 서버가 직접 읽는다 ── */
test('건 번호만 뽑는다 — 모양이 틀린 번호·겹친 번호는 버리고, 다른 칸(제목·본문)을 실어 보내도 읽지 않는다', () => {
  const raw = [{ id: 'INBOX-ab~1', s: '화면이 실은 제목', body: '비밀 본문' }, 'INBOX-ab~2', { id: 'bad/id~1' }, { id: 'INBOX-ab~1' }, null, 7, { id: '' }];
  assert.deepEqual(M.cleanIds(raw), ['INBOX-ab~1', 'INBOX-ab~2']);
  const many = []; for (let n = 1; n <= 30; n++) many.push('INBOX-ab~' + n);
  assert.equal(M.cleanIds(many).length, M.MAX_ITEMS); assert.deepEqual(M.cleanIds('x'), []); assert.deepEqual(M.cleanIds(undefined), []);
});
test('서버가 «그 사람의 기록»에서 읽는다 — 물을 만한 건(애매·새 요청/확인함·아직 안 물음)만, 제목·첨부 이름만', async () => {
  const db = makeDb([
    rec(1, '  제목   하나 ', { an: ['a.hwp', 'b.pdf', 'c', 'd', 'e'] }),
    rec(2, '이미 개인으로 가른 건', { scope: 'personal' }), rec(3, '이미 Jev 가 본 건', { scopeBy: 'jev', scopeAsked: 1 }),
    rec(4, '처리 완료한 건', { st: 'done' }), rec(5, '요청 아님으로 치운 건', { st: 'ignored' }), rec(6, '확인함 건', { st: 'doing' }),
  ]);
  const out = await M.loadItems(db, UID, M.cleanIds(ids(1, 2, 3, 4, 5, 6, 7)));
  assert.deepEqual(out.map((x) => x.id), ['INBOX-ab~1', 'INBOX-ab~6'], '규칙이 이미 가른 건·물은 건·사람이 끝낸 건·없는 건은 읽어도 안 보낸다');
  assert.equal(out[0].s, '제목 하나'); assert.deepEqual(out[0].an, ['a.hwp', 'b.pdf', 'c'], '첨부는 세 개까지');
  assert.deepEqual(Object.keys(out[0]).sort(), ['an', 'id', 's'], '보낸이(f·e)·날짜 칸은 옮기지 않는다');
  assert.deepEqual(await M.loadItems(db, 'OTHER', ['INBOX-ab~1']), [], '다른 사람의 기록은 읽지 않는다(그 사람 자리만)');
});
test('받지도 보내지도 않는 것 — 건에 본문·보낸이 칸이 있어도 Jev 글에 안 실린다(칸을 넘겨도 두 겹으로 막는다)', () => {
  const t = M.composeText(M.pickText({ s: '자료 요청', an: ['양식.hwp'], body: '비밀 본문', from: 'secret@example.org', f: '보낸이', e: 'a@example.org' }), { staff: [], companies: [] });
  assert.equal(t, 'Subject: 자료 요청\nAttachments: 양식.hwp');
  const raw = M.composeText({ id: 'x~1', s: '자료 요청', an: ['양식.hwp'], body: '비밀 본문', from: 'secret@example.org', e: 'a@example.org', f: '보낸이' }, { staff: [], companies: [] });
  assert.equal(raw, 'Subject: 자료 요청\nAttachments: 양식.hwp');
});

/* ── ② 가리는 차례 ── */
test('이름·번호를 가린 뒤에 나간다 — 직원·업체 이름 · 4자리 이상 숫자', () => {
  const t = M.composeText({ id: 'x~1', s: '[마바사식품] 김가나 노무사님 2026-1234 건 보고서', an: ['아자차산업 계약서 9876543.hwp'] }, { staff: ['김가나'], companies: ['마바사식품', '아자차산업'] });
  assert.ok(!/마바사식품|김가나|아자차산업/.test(t), '이름은 가렸다: ' + t);
  assert.ok(!/\d{4}/.test(t), '네 자리 이상 숫자는 가렸다: ' + t);
  assert.match(t, /\[업체\d\]/); assert.match(t, /\[직원\d\]/);
});
test('이메일·전화·사업자번호는 «숫자를 지우기 전에» 가린다 — 숫자를 먼저 지우면 이메일 가림이 못 알아봐 아이디·도메인이 샌다', () => {
  const t = M.composeText({ id: 'x~1', s: 'gildong2024@example.com 문의 010-1234-5678 사업자 123-45-67890', an: ['hong1234@example.org 자료.hwp'] }, { staff: [], companies: [] });
  assert.ok(!/gildong|hong|example|@/.test(t), '이메일 글자가 한 조각도 안 남는다: ' + t);
  assert.ok(!/010|1234|5678|123-45|67890/.test(t), '전화·사업자번호 조각이 안 남는다: ' + t);
  assert.match(t, /\[이메일\]/); assert.match(t, /\[전화번호\]/); assert.match(t, /\[사업자번호\]/);
  const src = modSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const f = src.slice(src.indexOf('function composeText('), src.indexOf('function scopeQuestion('));
  assert.ok(f.indexOf('TS.redact(') > 0 && f.indexOf('TS.redact(') < f.indexOf('redactNames(') && f.indexOf('redactNames(') < f.indexOf('\\d{4,}'), '차례: 이메일·번호 → 이름 → 남은 숫자');
});
test('물음 모양 — 업무 · 개인 · 애매 세 칸이고, 모르는 답은 애매다', () => {
  const q = M.scopeQuestion();
  assert.equal(q.scope.type, 'choice'); assert.deepEqual(Object.keys(q.scope.criteria).sort(), ['personal', 'unsure', 'work']);
  assert.ok(/unsure/.test(q.scope.instructions), '모를 때 고를 길을 준다');
  assert.equal(M.choiceOf({ answers: { scope: { choice: 'work' } } }), 'work');
  assert.equal(M.choiceOf({ answers: { scope: { value: 'personal' } } }), 'personal');
  assert.equal(M.choiceOf({ answers: { scope: { choice: '아무말' } } }), 'unsure');
  assert.equal(M.choiceOf({ answers: {} }), 'unsure'); assert.equal(M.choiceOf(null), 'unsure');
});

/* ── ③ 분류 ── */
test('분류한다 — 제목·첨부 이름만 가려서 보내고, 답을 건 번호별로 돌려주며, 성공한 만큼만 센다', async () => {
  const db = makeDb([rec(1, '[마바사식품] 중간보고서 송부'), rec(2, '위촉 서약서 제출', { an: ['서약서.hwp'] })]); const ff = fakeFetch((t) => ({ choice: /보고서/.test(t) ? 'work' : 'personal' }));
  const r = await M.run(deps(db, ff), { items: ids(1, 2) });
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.results, { 'INBOX-ab~1': { scope: 'work' }, 'INBOX-ab~2': { scope: 'personal' } });
  assert.equal(ff.calls.length, 2); assert.ok(ff.calls.every((c) => c.auth === 'Bearer K'));
  assert.ok(!ff.calls.some((c) => /마바사식품|보낸이 이름|example\.org/.test(c.body.state)), '업체 이름·보낸이·주소는 Jev 로 안 나갔다');
  assert.equal(db.읽기(M.tallyPath(YMD)), 2, '성공한 두 건만 센다'); assert.equal(r.body.left, M.DAY_LIMIT - 2);
  assert.ok(ff.calls.every((c) => c.signal), '건마다 시간 한도(AbortSignal)가 걸린다');
});
test('모르는 답은 «애매» — 지어낸 분류로 치우지 않는다', async () => {
  const db = makeDb([rec(1, '서류 요청')]); const ff = fakeFetch(() => ({ choice: '업무 같기도' }));
  const r = await M.run(deps(db, ff), { items: ids(1) });
  assert.equal(r.body.results['INBOX-ab~1'].scope, 'unsure');
});
test('보낼 건이 없으면 400 — 업체도 이름 목록도 칸 잡기도 안 한다(물을 만하지 않은 건·다른 사람 건·이상한 번호)', async () => {
  const ff = fakeFetch(() => ({ choice: 'work' }));
  const db = makeDb([rec(1, '이미 가른 건', { scope: 'work' })]);
  for (const body of [{ items: ids(1) }, { items: ids(9) }, { items: [{ id: 'x/y' }] }, {}, null]) {
    const r = await M.run(deps(db, ff), body);
    assert.equal(r.status, 400, JSON.stringify(body)); assert.equal(r.body.why, 'empty');
  }
  assert.equal(ff.calls.length, 0); assert.ok(!db.읽기(M.tallyPath(YMD)), '칸도 안 잡았다');
});

/* ── ④ 한도 ── */
test('하루 한도가 다 찼으면 «부르지 않는다» — 429 · 한 칸 남았으면 한 건만', async () => {
  const db = makeDb([rec(1, '서류 요청')], { [M.TALLY_ROOT]: { [YMD]: M.DAY_LIMIT } }); const ff = fakeFetch(() => ({ choice: 'work' }));
  const r = await M.run(deps(db, ff), { items: ids(1) });
  assert.equal(r.status, 429); assert.equal(r.body.why, 'dayLimit'); assert.equal(ff.calls.length, 0);
  const db2 = makeDb([rec(1, 'a 서류'), rec(2, 'b 서류'), rec(3, 'c 서류')], { [M.TALLY_ROOT]: { [YMD]: M.DAY_LIMIT - 1 } }); const ff2 = fakeFetch(() => ({ choice: 'work' }));
  const r2 = await M.run(deps(db2, ff2), { items: ids(1, 2, 3) });
  assert.equal(ff2.calls.length, 1, '남은 한 칸만큼만 부른다'); assert.equal(Object.keys(r2.body.results).length, 1);
  assert.equal(db2.읽기(M.tallyPath(YMD)), M.DAY_LIMIT);
});
test('두 부름이 «함께» 와도 한도를 못 넘는다 — 칸을 부르기 전에 transaction 으로 잡는다', async () => {
  const items = []; for (let n = 1; n <= 10; n++) items.push(rec(n, n + ' 서류'));
  const db = makeDb(items, { [M.TALLY_ROOT]: { [YMD]: M.DAY_LIMIT - 7 } }); const ff = fakeFetch(() => ({ choice: 'work' }));
  const [a, b] = await Promise.all([M.run(deps(db, ff), { items: ids(1, 2, 3, 4, 5) }), M.run(deps(db, ff), { items: ids(6, 7, 8, 9, 10) })]);
  assert.equal(ff.calls.length, 7, '남은 7칸을 둘이 나눠 썼다 — 읽고 나서 부르는 방식이면 10건이 나간다');
  assert.equal(Object.keys(a.body.results || {}).length + Object.keys(b.body.results || {}).length, 7);
  assert.equal(db.읽기(M.tallyPath(YMD)), M.DAY_LIMIT);
});
test('칸 잡기가 안 되면(DB 오류) 부르지 않는다 — 셈이 안 되는 채로 보내지 않는다', async () => {
  const base = makeDb([rec(1, '서류 요청')]);
  const db = { ref: (p) => (String(p).indexOf(M.TALLY_ROOT) === 0 ? { transaction: async () => { throw new Error('쓰기 실패'); }, once: async () => ({ val: () => null }) } : base.ref(p)) };
  const ff = fakeFetch(() => ({ choice: 'work' }));
  const r = await M.run(deps(db, ff), { items: ids(1) });
  assert.equal(r.status, 429); assert.equal(ff.calls.length, 0);
});
test('못 쓴 칸은 돌려준다 — 업체가 거절한 부름은 세지 않고, 일부만 성공하면 성공한 만큼만 센다', async () => {
  const db = makeDb([rec(1, '서류 요청')]); const ff = fakeFetch(() => ({ choice: 'work' }), { status: 401 });
  const r = await M.run(deps(db, ff), { items: ids(1) });
  assert.equal(r.status, 502); assert.equal(r.body.ok, false); assert.equal(r.body.why, 'key');
  assert.ok(!db.읽기(M.tallyPath(YMD)), '거절된 부름은 세지 않는다(칸을 돌려줬다)');
  let n = 0;
  const flaky = async () => { n++; if (n === 2) throw new Error('끊김'); return { ok: true, status: 200, json: async () => ({ answers: { scope: { choice: 'work' } } }) }; };
  const db2 = makeDb([rec(1, 'a 서류'), rec(2, 'b 서류'), rec(3, 'c 서류')]);
  const r2 = await M.run(deps(db2, flaky), { items: ids(1, 2, 3) });
  assert.equal(r2.status, 200); assert.equal(Object.keys(r2.body.results).length, 1, '첫 건은 살린다'); assert.ok(r2.body.partial);
  assert.equal(db2.읽기(M.tallyPath(YMD)), 1, '성공한 한 건만 센다(잡아 둔 세 칸 중 둘은 돌려줬다)');
});

/* ── ⑤ 마감 ── */
test('함수 전체 마감을 넘으면 «지금까지 결과만» 돌려주고 못 쓴 칸은 돌려준다(partial)', async () => {
  const db = makeDb([rec(1, 'a 서류'), rec(2, 'b 서류'), rec(3, 'c 서류')]); const ff = fakeFetch(() => ({ choice: 'work' }));
  let t = 1000; const now = () => { const v = t; t += M.TOTAL_MS / 2 + 1; return v; };       // 부를 때마다 «마감의 절반 + 1» 이 흐른다
  const r = await M.run(deps(db, ff, { now }), { items: ids(1, 2, 3) });
  assert.equal(r.status, 200); assert.ok(ff.calls.length >= 1 && ff.calls.length < 3, '다 못 부르고 멈췄다: ' + ff.calls.length);
  assert.equal(r.body.partial, 'deadline'); assert.equal(Object.keys(r.body.results).length, ff.calls.length);
  assert.equal(db.읽기(M.tallyPath(YMD)), ff.calls.length, '못 쓴 칸을 돌려줬다');
});
test('이름 목록을 못 읽거나 직원 목록이 비어 있으면 «통째로 건너뛴다» — 가리지 못한 채 업체로 보내지 않는다(503)', async () => {
  const base = makeDb([rec(1, '서류 요청')]);
  const failing = { ref: (p) => (/user_accounts|companies/.test(p) ? { once: async () => { throw new Error('읽기 실패'); } } : base.ref(p)) };
  const ff = fakeFetch(() => ({ choice: 'work' }));
  const r = await M.run(deps(failing, ff), { items: ids(1) });
  assert.equal(r.status, 503); assert.equal(r.body.why, 'masking'); assert.equal(ff.calls.length, 0);
  const empty = makeDb([rec(1, '서류 요청')], { data: { user_accounts: { v: null }, companies: { v: { c1: { name: '마바사식품' } } } } });
  const r2 = await M.run(deps(empty, ff), { items: ids(1) });
  assert.equal(r2.status, 503, '직원 목록이 «읽혔지만 비어 있다» — 가릴 직원 이름을 모르는 채 보내지 않는다'); assert.equal(ff.calls.length, 0);
  assert.ok(!empty.읽기(M.tallyPath(YMD)), '칸도 안 잡았다');
});

/* ── ⑦ 서버 함수 ── */
test('서버 함수 — 로그인 → 관리자 확인 → 열쇠 확인 → 분류 순서, 열쇠는 금고(secrets)에서, 그 사람 uid 로 읽는다', () => {
  const i = indexSrc.indexOf('exports.mailReqScope = functions');
  assert.ok(i > 0, 'mailReqScope 가 내보내진다');
  const fn = indexSrc.slice(i, indexSrc.indexOf('\n/* 열쇠를 얻는다', i));
  const posAuth = fn.indexOf('requireReader(req)'), posAdmin = fn.indexOf('typeSafeIsAdmin('), posKey = fn.indexOf('process.env.TYPESAFE_API_KEY'), posRun = fn.indexOf('MailReqScope.run(');
  assert.ok(posAuth > 0 && posAdmin > posAuth && posKey > posAdmin && posRun > posKey, '로그인 → 관리자 → 열쇠 → 분류');
  assert.match(fn, /secrets: \["TYPESAFE_API_KEY"\]/); assert.match(fn, /why: "adminOnly"/); assert.match(fn, /why: "noKey"/);
  assert.match(fn, /req\.method !== "POST"/); assert.match(fn, /region\(MAIL_REGION\)/);
  assert.match(fn, /uid: who\.uid/, '요청 본문이 아니라 «로그인한 사람»의 기록을 읽는다');
  assert.match(indexSrc, /const MailReqScope = require\("\.\/mail-req-scope"\)/);
});
test('모듈이 읽는 칸은 s·an·st·scope·scopeBy·scopeAsked 뿐이고, 자기 하루 셈 자리를 쓴다(사람 몫·메일 분류 몫과 다른 자리)', () => {
  const code = modSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/rec\.(body|from|e|f|replyTo|html|text|d)\b/.test(code), '본문·보낸이·날짜 칸을 읽지 않는다');
  assert.equal(M.TALLY_ROOT, 'typesafe_tally_mailreq');
  ['typesafe_tally/', 'typesafe_tally_mail/'].forEach((p) => assert.ok(M.tallyPath(YMD).indexOf(p) !== 0, '다른 하루 문과 자리가 겹치지 않는다'));
  assert.match(M.itemPath(UID, 'INBOX-ab~1'), /^kcareer\/U1\/mailreq\/items\/INBOX-ab~1$/);
});
