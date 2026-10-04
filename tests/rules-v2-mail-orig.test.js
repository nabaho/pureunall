// 취업규칙(새) 메일에서 원본 받기 — 가짜 call 로(진짜 fetch 없음). 이름은 가짜(홍길동·가나상사)만.
// sha 값은 검사 안에서 셈해 넣는다(박지 않는다) — 규칙은 «지문이 같을 때만 돌려준다».
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const M = require('../js/rules-v2/mail-orig.js');

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const b64 = (buf) => Buffer.from(buf).toString('base64');
const first = Buffer.from('가나상사 취업규칙 첫째 파일');
const second = Buffer.from('가나상사 취업규칙 둘째 파일');
const NAME = '가나상사_취업규칙.hwp';

// 부른 차례를 적으며 답을 돌려주는 가짜 call
function fake(table) {
  const calls = [];
  const call = async (fn, body) => {
    calls.push({ fn, body });
    const r = table(fn, body);
    if (r instanceof Error) throw r;
    return r;
  };
  call.calls = calls;
  return call;
}

test('IMAP: 같은 이름 둘 중 둘째가 지문과 맞으면 그것을 돌려준다 — 부른 차례도 본다', async () => {
  const call = fake((fn, body) => {
    if (fn === 'readMailMessage') {
      return { ok: true, atts: [
        { i: 0, part: '2', name: NAME, size: 10 },
        { i: 1, part: '3', name: '다른.pdf', size: 10 },
        { i: 2, part: '4', name: NAME, size: 10 }] };
    }
    if (fn === 'readMailAttachment') return { ok: true, name: NAME, mime: 'x', b64: b64(body.index === 0 ? first : second) };
    throw new Error('모르는 함수 ' + fn);
  });
  const doc = { name: NAME, sha: sha(second), mail: { src: 'imap', box: 'INBOX', key: 77 } };
  const r = await M.fetchOriginal({ doc, call, sha256: M.sha256Hex });
  assert.equal(r.ok, true);
  assert.equal(r.name, NAME);
  assert.deepEqual(Buffer.from(r.bytes), second);
  assert.deepEqual(call.calls.map((c) => c.fn), ['readMailMessage', 'readMailAttachment', 'readMailAttachment']);
  assert.equal(call.calls[0].body.peek, true, '★ 고객 메일을 읽음으로 바꾼다 — peek 없이 열면 공용 메일함의 \Seen·r=1 이 바뀐다');
  assert.deepEqual(call.calls[0].body, { slug: 'INBOX', uid: '77', peek: true });
  assert.deepEqual(call.calls[1].body, { slug: 'INBOX', uid: '77', index: 0, part: '2' });
  assert.deepEqual(call.calls[2].body, { slug: 'INBOX', uid: '77', index: 2, part: '4' });
});

test('IMAP: 첨부에 i 가 없으면 배열 차례를 쓴다', async () => {
  const call = fake((fn, body) => {
    if (fn === 'readMailMessage') return { ok: true, atts: [{ part: '2', name: '다른.pdf' }, { part: '3', name: NAME }] };
    return { ok: true, b64: b64(first) };
  });
  const doc = { name: NAME, sha: sha(first), mail: { src: 'imap', box: 'INBOX', key: 'k' } };
  const r = await M.fetchOriginal({ doc, call, sha256: M.sha256Hex });
  assert.equal(r.ok, true);
  assert.equal(call.calls[1].body.index, 1);
});

test('POP3: readOldMail{key} → readOldMail{key,index}', async () => {
  const call = fake((fn, body) => {
    assert.equal(fn, 'readOldMail');
    if (body.index === undefined) return { ok: true, old: true, atts: [{ i: 0, part: '', name: NAME }] };
    return { ok: true, name: NAME, b64: b64(first) };
  });
  const doc = { name: NAME, sha: sha(first), mail: { src: 'pop3', box: '', key: 123 } };
  const r = await M.fetchOriginal({ doc, call, sha256: M.sha256Hex });
  assert.equal(r.ok, true);
  assert.deepEqual(Buffer.from(r.bytes), first);
  assert.deepEqual(call.calls.map((c) => c.body), [{ key: '123' }, { key: '123', index: 0 }]);
});

test('지문이 안 맞으면 ok:false — 바이트를 돌려주지 않는다', async () => {
  const call = fake((fn) => (fn === 'readMailMessage'
    ? { ok: true, atts: [{ i: 0, part: '2', name: NAME }] } : { ok: true, b64: b64(first) }));
  const doc = { name: NAME, sha: sha(second), mail: { src: 'imap', box: 'INBOX', key: 1 } };
  const r = await M.fetchOriginal({ doc, call, sha256: M.sha256Hex });
  assert.equal(r.ok, false);
  assert.ok(r.why && r.why.length > 0);
  assert.equal(r.bytes, undefined);
});

test('같은 이름의 첨부가 메일에 없으면 ok:false — 첨부 내려받기는 부르지 않는다', async () => {
  const call = fake(() => ({ ok: true, atts: [{ i: 0, part: '2', name: '다른.pdf' }] }));
  const doc = { name: NAME, sha: sha(first), mail: { src: 'imap', box: 'INBOX', key: 1 } };
  const r = await M.fetchOriginal({ doc, call, sha256: M.sha256Hex });
  assert.equal(r.ok, false);
  assert.deepEqual(call.calls.map((c) => c.fn), ['readMailMessage']);
});

test('지문(sha)이 비었으면 아무 호출도 하지 않고 ok:false', async () => {
  const call = fake(() => { throw new Error('부르면 안 됨'); });
  for (const empty of ['', null, undefined]) {
    const doc = { name: NAME, sha: empty, mail: { src: 'imap', box: 'INBOX', key: 1 } };
    const r = await M.fetchOriginal({ doc, call, sha256: M.sha256Hex });
    assert.equal(r.ok, false);
  }
  assert.equal(call.calls.length, 0);
});

test('call 이 던지면(404·네트워크) ok:false — 까닭에 서버 메시지가 들어간다', async () => {
  const call = fake(() => new Error('메일을 찾을 수 없습니다'));
  const doc = { name: NAME, sha: sha(first), mail: { src: 'imap', box: 'INBOX', key: 1 } };
  const r = await M.fetchOriginal({ doc, call, sha256: M.sha256Hex });
  assert.equal(r.ok, false);
  assert.ok(r.why.includes('메일을 찾을 수 없습니다'));
});

test('b64ToBytes: 바이트가 그대로 돌아온다', () => {
  const raw = Buffer.from([0, 1, 2, 250, 255, 128]);
  assert.deepEqual(Buffer.from(M.b64ToBytes(b64(raw))), raw);
});

test('sha256Hex: 노드 crypto 와 같은 소문자 hex', async () => {
  assert.equal(await M.sha256Hex(first), sha(first));
});

test('makeCall: 주소·머리(Bearer)·몸통을 맞춰 보내고 JSON 을 돌려준다', async () => {
  let seen;
  const fetchFake = async (url, opt) => { seen = { url, opt }; return { status: 200, json: async () => ({ ok: true, v: 1 }) }; };
  const call = M.makeCall({ base: 'https://x.test/fn/', getToken: async () => 'tok123', fetch: fetchFake });
  const j = await call('readOldMail', { key: 'k' });
  assert.equal(j.v, 1);
  assert.equal(seen.url, 'https://x.test/fn/readOldMail');
  assert.equal(seen.opt.method, 'POST');
  assert.equal(seen.opt.headers['Content-Type'], 'application/json');
  assert.equal(seen.opt.headers.Authorization, 'Bearer tok123');
  assert.deepEqual(JSON.parse(seen.opt.body), { key: 'k' });
});

test('makeCall: ok 가 true 가 아니면 던진다 — 메시지와 status 를 싣는다', async () => {
  const fetchFake = async () => ({ status: 404, json: async () => ({ ok: false, error: '없는 메일' }) });
  const call = M.makeCall({ base: 'b/', getToken: async () => 't', fetch: fetchFake });
  await assert.rejects(() => call('f', {}), (e) => e.message === '없는 메일' && e.status === 404);
  const fetchBlank = async () => ({ status: 500, json: async () => ({}) });
  const call2 = M.makeCall({ base: 'b/', getToken: async () => 't', fetch: fetchBlank });
  await assert.rejects(() => call2('f', {}), (e) => e.message.length > 0 && e.status === 500);
});
