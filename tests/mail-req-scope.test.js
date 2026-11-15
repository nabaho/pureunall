/* 📬 요청 메일 범위 분류(Jev) 서버 쪽 — functions/mail-req-scope.js + index.js 의 mailReqScope (대표 지시 2026-11-15)
   ⚠ 메일·이름은 모두 지어낸 것이다(저장소가 공개). Jev 는 «가짜 fetch» — 실제 업체를 부르지 않는다.
   못 박는 것:
     ① 보내는 글은 «제목 + 첨부 이름»뿐이고, 직원·업체 이름과 번호를 가린 뒤에 나간다
     ② 이름 목록을 못 읽으면 «아무것도 안 보내고» 건너뛴다 · 하루 한도를 넘으면 «부르지 않는다»
     ③ 모르는 답·빈 답은 «애매»로 둔다 — 지어낸 분류로 메일을 치우지 않는다
     ④ 성공한 것만 센다 · 업체가 거절하면 상태 코드와 까닭을 그대로 돌려준다
     ⑤ 서버 함수는 관리자 확인 → 열쇠 확인 → 분류 순서다(누구에게도 금고 상태를 안 알린다) */
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
const YMD = '2026-11-15';

function names() {
  return { data: {
    user_accounts: { v: { u1: { name: '김가나' }, u2: { name: '이다라' } } },
    companies: { v: { c1: { name: '마바사식품' }, c2: { name: '아자차산업' } } },
  } };
}
function makeDb(extra) { return 만들기(Object.assign(names(), extra || {})); }
/* Jev 흉내 — 받은 요청을 모두 적어 두고, answer(text) 로 답을 만든다 */
function fakeFetch(answer, o) {
  const calls = [];
  const fn = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, body, auth: init.headers.Authorization });
    if (o && o.status) return { ok: false, status: o.status, json: async () => ({ error: { message: '거절' } }) };
    return { ok: true, status: 200, json: async () => ({ answers: { scope: answer(body.state) }, usage: {} }) };
  };
  fn.calls = calls; return fn;
}
const item = (n, s, an) => ({ id: 'INBOX-ab~' + n, s, an: an || [] });

test('보낼 건을 추린다 — 모양이 틀린 번호는 버리고, 건수·첨부 개수·글자 수에 한도가 있다', () => {
  const raw = [item(1, '  제목   하나 ', ['a.hwp', 'b.pdf', 'c', 'd', 'e']), { id: 'bad/id~1', s: 'x' }, item(2, '', []), null, 'x', item(3, 'ㄱ'.repeat(500))];
  for (let n = 10; n < 30; n++) raw.push(item(n, '건 ' + n));
  const out = M.cleanItems(raw);
  assert.equal(out.length, M.MAX_ITEMS);
  assert.equal(out[0].s, '제목 하나'); assert.deepEqual(out[0].an, ['a.hwp', 'b.pdf', 'c'], '첨부는 세 개까지');
  assert.ok(!out.some((x) => /bad/.test(x.id)), '이상한 번호는 버린다');
  assert.ok(out.every((x) => x.s.length <= 140), '제목 길이 한도');
  assert.deepEqual(M.cleanItems('x'), []); assert.deepEqual(M.cleanItems(undefined), []);
});
test('받지도 보내지도 않는 것 — 본문·보낸이·주소·날짜가 들어와도 Jev 글에 안 실린다', () => {
  const t = M.composeText(Object.assign(M.cleanItems([Object.assign(item(1, '자료 요청', ['양식.hwp']), { body: '비밀 본문', from: 'secret@example.org', f: '보낸이', e: 'a@example.org', d: 1 })])[0]), { staff: [], companies: [] });
  assert.equal(t, 'Subject: 자료 요청\nAttachments: 양식.hwp');
  assert.ok(!/비밀|secret|example|보낸이/.test(t));
  /* 추리기(cleanItems)를 거치지 않고 칸이 그대로 넘어와도 글은 제목·첨부 이름뿐이다 — 한 겹이 아니라 두 겹으로 막는다 */
  const raw = M.composeText({ id: 'x~1', s: '자료 요청', an: ['양식.hwp'], body: '비밀 본문', from: 'secret@example.org', e: 'a@example.org', f: '보낸이' }, { staff: [], companies: [] });
  assert.equal(raw, 'Subject: 자료 요청\nAttachments: 양식.hwp');
});
test('이름·숫자를 가린 뒤에 나간다 — 직원·업체 이름 · 4자리 이상 숫자', () => {
  const t = M.composeText({ id: 'x~1', s: '[마바사식품] 김가나 노무사님 2026-1234 건 보고서', an: ['아자차산업 계약서 9876543.hwp'] }, { staff: ['김가나'], companies: ['마바사식품', '아자차산업'] });
  assert.ok(!/마바사식품|김가나|아자차산업/.test(t), '이름은 가렸다: ' + t);
  assert.ok(!/\d{4}/.test(t), '네 자리 이상 숫자는 가렸다: ' + t);
  assert.match(t, /\[업체\d\]/); assert.match(t, /\[직원\d\]/);
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
test('분류한다 — 제목·첨부 이름만 가려서 보내고, 답을 건 번호별로 돌려주며, 성공한 만큼 센다', async () => {
  const db = makeDb(); const ff = fakeFetch((t) => ({ choice: /보고서/.test(t) ? 'work' : 'personal' }));
  const r = await M.run({ db, key: 'K', fetchFn: ff, ymd: YMD }, { items: [item(1, '[마바사식품] 중간보고서 송부', []), item(2, '위촉 서약서 제출', ['서약서.hwp'])] });
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.results, { 'INBOX-ab~1': { scope: 'work' }, 'INBOX-ab~2': { scope: 'personal' } });
  assert.equal(ff.calls.length, 2); assert.ok(ff.calls.every((c) => c.auth === 'Bearer K'));
  assert.ok(!ff.calls.some((c) => /마바사식품/.test(c.body.state)), '업체 이름은 Jev 로 안 나갔다');
  assert.equal(db.읽기(M.tallyPath(YMD)), 2, '성공한 두 건을 센다');
  assert.equal(r.body.left, M.DAY_LIMIT - 2);
});
test('모르는 답은 «애매» — 지어낸 분류로 치우지 않는다', async () => {
  const db = makeDb(); const ff = fakeFetch(() => ({ choice: '업무 같기도' }));
  const r = await M.run({ db, key: 'K', fetchFn: ff, ymd: YMD }, { items: [item(1, '서류 요청')] });
  assert.equal(r.body.results['INBOX-ab~1'].scope, 'unsure');
});
test('하루 한도를 넘었으면 «부르지 않는다» — 429, 업체에 한 건도 안 나간다', async () => {
  const db = makeDb({ [M.TALLY_ROOT]: { [YMD]: M.DAY_LIMIT } }); const ff = fakeFetch(() => ({ choice: 'work' }));
  const r = await M.run({ db, key: 'K', fetchFn: ff, ymd: YMD }, { items: [item(1, '서류 요청')] });
  assert.equal(r.status, 429); assert.equal(r.body.why, 'dayLimit'); assert.equal(ff.calls.length, 0);
  const db2 = makeDb({ [M.TALLY_ROOT]: { [YMD]: M.DAY_LIMIT - 1 } }); const ff2 = fakeFetch(() => ({ choice: 'work' }));
  const r2 = await M.run({ db: db2, key: 'K', fetchFn: ff2, ymd: YMD }, { items: [item(1, 'a 서류'), item(2, 'b 서류'), item(3, 'c 서류')] });
  assert.equal(ff2.calls.length, 1, '남은 한 건만큼만 부른다'); assert.equal(Object.keys(r2.body.results).length, 1);
});
test('이름 목록을 못 읽으면 «통째로 건너뛴다» — 가리지 못한 채 업체로 보내지 않는다(503)', async () => {
  const db = { ref: (p) => ({ once: async () => { if (/user_accounts|companies/.test(p)) throw new Error('읽기 실패'); return { val: () => null }; } }) };
  const ff = fakeFetch(() => ({ choice: 'work' }));
  const r = await M.run({ db, key: 'K', fetchFn: ff, ymd: YMD }, { items: [item(1, '서류 요청')] });
  assert.equal(r.status, 503); assert.equal(r.body.why, 'masking'); assert.equal(ff.calls.length, 0);
});
test('분류할 건이 없으면 400 — 업체도 이름 목록도 부르지 않는다', async () => {
  const ff = fakeFetch(() => ({ choice: 'work' }));
  const r = await M.run({ db: makeDb(), key: 'K', fetchFn: ff, ymd: YMD }, { items: [{ id: 'x/y', s: 'z' }] });
  assert.equal(r.status, 400); assert.equal(ff.calls.length, 0);
});
test('업체가 거절하면 그 상태와 까닭을 그대로 돌려주고 센 것도 없다 · 중간에 막히면 지금까지 것은 살린다', async () => {
  const db = makeDb(); const ff = fakeFetch(() => ({ choice: 'work' }), { status: 401 });
  const r = await M.run({ db, key: 'K', fetchFn: ff, ymd: YMD }, { items: [item(1, '서류 요청')] });
  assert.equal(r.status, 502); assert.equal(r.body.ok, false); assert.equal(r.body.why, 'key');
  assert.ok(!db.읽기(M.tallyPath(YMD)), '거절된 부름은 세지 않는다');
  let n = 0;
  const flaky = async (u, init) => { n++; if (n === 2) throw new Error('끊김'); return { ok: true, status: 200, json: async () => ({ answers: { scope: { choice: 'work' } } }) }; };
  const db2 = makeDb();
  const r2 = await M.run({ db: db2, key: 'K', fetchFn: flaky, ymd: YMD }, { items: [item(1, 'a 서류'), item(2, 'b 서류'), item(3, 'c 서류')] });
  assert.equal(r2.status, 200); assert.equal(Object.keys(r2.body.results).length, 1, '첫 건은 살린다'); assert.ok(r2.body.partial);
  assert.equal(db2.읽기(M.tallyPath(YMD)), 1);
});
test('서버 함수 — 관리자 확인 → 열쇠 확인 → 분류 순서, 열쇠는 금고(secrets)에서, 로그인 없이는 못 부른다', () => {
  const i = indexSrc.indexOf('exports.mailReqScope = functions');
  assert.ok(i > 0, 'mailReqScope 가 내보내진다');
  const fn = indexSrc.slice(i, indexSrc.indexOf('\n/* 열쇠를 얻는다', i));
  const posAuth = fn.indexOf('requireReader(req)'), posAdmin = fn.indexOf('typeSafeIsAdmin('), posKey = fn.indexOf('process.env.TYPESAFE_API_KEY'), posRun = fn.indexOf('MailReqScope.run(');
  assert.ok(posAuth > 0 && posAdmin > posAuth && posKey > posAdmin && posRun > posKey, '로그인 → 관리자 → 열쇠 → 분류');
  assert.match(fn, /secrets: \["TYPESAFE_API_KEY"\]/); assert.match(fn, /why: "adminOnly"/); assert.match(fn, /why: "noKey"/);
  assert.match(fn, /req\.method !== "POST"/); assert.match(fn, /region\(MAIL_REGION\)/);
  assert.match(indexSrc, /const MailReqScope = require\("\.\/mail-req-scope"\)/);
});
test('모듈이 읽는 칸은 id·s·an 뿐이고, 자기 하루 셈 자리를 쓴다(사람 몫·메일 분류 몫과 다른 자리)', () => {
  const code = modSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/x\.(body|from|e|f|replyTo|html|text)\b/.test(code), '본문·보낸이 칸을 읽지 않는다');
  assert.equal(M.TALLY_ROOT, 'typesafe_tally_mailreq');
  ['typesafe_tally/', 'typesafe_tally_mail/'].forEach((p) => assert.ok(M.tallyPath(YMD).indexOf(p) !== 0, '다른 하루 문과 자리가 겹치지 않는다'));
});
