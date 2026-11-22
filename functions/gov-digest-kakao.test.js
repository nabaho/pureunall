/* 정부사업신청 «매일 카톡 요약» 서버(공식 «나에게 보내기») — 글 모양·보내기·토큰·기록·연결(동의 한 번)을 가짜 부품으로 돌려 본다
   (대표 지시 2026-11-22 「카카오톡으로 매일 받고 싶다 — 내 개인톡으로」 → 「공식 방식으로」).
   ★ 글은 200자를 넘지 않고 링크는 ERP(등록 도메인)만 · 카카오가 길이로 거절하면 더 짧게 한 번 더 · 한 통이 막히면 멈추고 못 보낸 줄은 기록하지 않는다
   ★ 모드 off 는 아무것도 안 하고 dry(기본)는 요약만 쓰고 카카오를 한 번도 안 부른다 · 토큰은 서버 전용 자리 밖 어디에도 안 남는다
   ★ 연결은 «ERP 에 연결된 총괄 관리자 카카오»만 — 아니면 토큰을 저장하지 않는다 · 화면에 나가는 글에 토큰이 없다
   ★ 자료는 지어낸 것이다(실제 공고·토큰 없음). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Memo = require('./gov-digest-kakao.js');
const KM = require('./kakao-memo-core.js');
const Digest = require('./gov-digest.js');
const ERP = require('./erp-origins');

const ROOT = path.join(__dirname, '..');
const NOW = Date.parse('2026-11-23T00:00:00Z');   // 한국 시각 09시, 오늘 = 2026-11-23
const TODAY = '2026-11-23';
const SECRET_A = 'ACCESS-TOKEN-가짜-0123456789';
const SECRET_R = 'REFRESH-TOKEN-가짜-0123456789';
const CREDS = { restKey: '0123456789abcdef0123456789abcdef', clientSecret: 'ClientSecretFake0123456789' };

function plus(n) { return new Date(Date.parse(TODAY + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
function row(no, nm, o) { return Object.assign({ no: String(no), nm, org: '지어낸기관', ntce: '지어낸기관', src: '나라장터', openDt: plus(-3), closeDt: plus(10), kw: '노무', mthd: '', url: 'https://example.test/' + no }, o || {}); }
function hit(key, title, o) { return Object.assign({ key, title, board: 'cheonan', boardName: '천안시 공고알림', org: '', date: plus(-1), href: 'https://example.test/h/' + key, per: { to: plus(9) } }, o || {}); }

/* 메모리 DB — get/update(다중 경로, null 이면 지움)/lock */
function memStore(init) {
  const db = JSON.parse(JSON.stringify(init || {}));
  const walk = (p, make) => { let cur = db; const parts = p.split('/').filter(Boolean); for (let i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') { if (!make) return [null, null]; cur[parts[i]] = {}; } cur = cur[parts[i]]; } return [cur, parts[parts.length - 1]]; };
  const locks = {};
  return {
    db, locks,
    get: async (p) => { const [o, k] = walk(p, false); const v = o ? o[k] : undefined; return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
    update: async (u) => { Object.keys(u).forEach((p) => { const [o, k] = walk(p, true); if (u[p] === null || u[p] === undefined) delete o[k]; else o[k] = JSON.parse(JSON.stringify(u[p])); }); },
    /* 조건부 저장 — 그 자리의 linkedAt 이 expect 와 같을 때만(없으면 안 쓴다) */
    cas: async (p, expect, value) => { const [o, k] = walk(p, false); const cur = o ? o[k] : undefined; if (!cur || cur.linkedAt !== expect) return false; o[k] = JSON.parse(JSON.stringify(value)); return true; },
    lock: async (name, ttl, now) => { if (locks[name] && locks[name] + ttl > now) return null; locks[name] = now; return async () => { delete locks[name]; }; }
  };
}
const feedData = () => ({
  gov_feed: { rows: { 1: row(1, '노무 진단 사업 가'), 2: row(2, '일터혁신 컨설팅 사업 나', { closeDt: plus(40), kw: '일터혁신' }) } },
  gov_watch: { hits: { a: hit('a', '천안시 자문단 공개 모집') } }
});
/* 가짜 카카오 — 호출을 모두 기록한다. memo 응답·token 응답은 시험마다 바꾼다 */
function fakeFetch(o) {
  o = o || {};
  const calls = [];
  const f = async (url, opts) => {
    const body = new URLSearchParams(String((opts && opts.body) || ''));
    const call = { url, body, headers: (opts && opts.headers) || {} }; calls.push(call);
    let r;
    if (url === Memo.MEMO_URL) r = (o.memo || (() => ({ status: 200, json: { result_code: 0 } })))(call, calls.filter((c) => c.url === Memo.MEMO_URL).length);
    else if (url === Memo.TOKEN_URL) r = (o.token || (() => ({ status: 200, json: { access_token: 'NEW-' + SECRET_A, expires_in: 43199 } })))(call);
    else r = { status: 404, json: {} };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json };
  };
  f.calls = calls; f.memos = () => calls.filter((c) => c.url === Memo.MEMO_URL); f.tokens = () => calls.filter((c) => c.url === Memo.TOKEN_URL);
  return f;
}
const tokenNode = (o) => Object.assign({ access: SECRET_A, accessExp: NOW + 3 * 3600e3, refresh: SECRET_R, refreshExp: NOW + 50 * 864e5, uid: 'U1', linkKey: 'k_12345', linkedAt: 1000 }, o || {});
const base = (o) => memStore(Object.assign(feedData(), { gov_digest_cfg: { mode: 'live' }, gov_digest_secret: { kakao: tokenNode() } }, o || {}));
async function go(store, f, over) { return Memo.run(Object.assign({ store, fetch: f, now: NOW, creds: CREDS }, over || {})); }
const templateOf = (call) => JSON.parse(call.body.get('template_object'));

test('★ 공용 모듈 사본(functions/vendor)은 js/ 와 바이트까지 같다 — 엔진이 화면과 같은 규칙을 쓴다', () => {
  ['gov-g2b.js', 'gov-recruit.js', 'gov-region.js', 'gov-ai.js', 'gov-pick.js'].forEach((f) => {
    assert.equal(fs.readFileSync(path.join(__dirname, 'vendor', f), 'utf8'), fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'),
      'functions/vendor/' + f + ' 가 js/' + f + ' 와 다르다 — js/ 를 고쳤으면 복사해 오세요: cp js/' + f + ' functions/vendor/');
  });
});

test('★ 글 — 200자를 넘지 않고, 링크는 ERP 한 곳(등록 도메인)이며, 새 것이 있는 갈래마다 한 통이다', () => {
  const rows = []; for (let i = 0; i < 14; i++) rows.push(row(i + 1, '노무 진단 사업 ' + i + '번째 공고 ' + '가'.repeat(60), { org: '기관' + i, closeDt: plus(5 + i) }));
  const d = Digest.build({ today: TODAY, rows });
  const msgs = Memo.composeMessages(d, Digest.diff(d, {}), {});
  assert.ok(msgs.length >= 1);
  msgs.forEach((m) => {
    m.texts.forEach((t) => assert.ok(t.length <= 200, t.length + '자: ' + t));
    assert.ok(m.texts[1].length < m.texts[0].length, '짧은 판이 더 짧다');
    assert.ok(m.link.startsWith(ERP.ERP_LINK_BASE + '/'), '링크는 ERP 주소');
    const tpl = Memo.templateOf(m.texts[0], m.link);
    assert.equal(tpl.object_type, 'text');
    assert.equal(tpl.link.web_url, tpl.link.mobile_web_url);
    assert.ok(tpl.button_title && tpl.button_title.length <= 10);
  });
  assert.match(msgs[0].texts[0], /외 \d+건/, '못 실은 줄은 «외 N건»');
});

test('★ 글 — 새 것·마감 임박이 없는 갈래는 안 보내고, 마감 임박은 «⏰»로 알린다', () => {
  const d = Digest.build({ today: TODAY, rows: [row(1, '노무 진단 사업 가', { closeDt: plus(2) })] });
  const st = { 'feed:1': { sent: plus(-3), reminded: '' } };
  const msgs = Memo.composeMessages(d, Digest.diff(d, st), {});
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].texts[0], /마감임박/);
  const none = Memo.composeMessages(d, Digest.diff(d, { 'feed:1': { sent: plus(-3), reminded: plus(-1) } }), {});
  assert.equal(none.length, 0, '이미 알린 줄은 또 안 보낸다');
});

test('★ 모드 off 는 아무것도 안 하고, dry(기본)는 요약만 쓰고 카카오를 한 번도 안 부른다', async () => {
  const f = fakeFetch(), off = base({ gov_digest_cfg: { mode: 'off' } });
  const r0 = await go(off, f);
  assert.equal(r0.skipped, 'off');
  assert.ok(!off.db.gov_digest, '요약도 안 쓴다');
  const dry = base({ gov_digest_cfg: null });                    // 모드가 없으면 dry
  const r1 = await go(dry, f);
  assert.equal(r1.mode, 'dry');
  assert.ok(dry.db.gov_digest.last.sections.length, '요약은 쓴다(전체 보기용)');
  assert.equal(f.calls.length, 0, '카카오를 안 부른다');
  assert.ok(!dry.db.gov_digest_state || !dry.db.gov_digest_state.sent, '보냄 기록도 안 남긴다 — live 첫 통에 전부 들어가게');
});

test('★ live — 토큰이 없으면 보내지 않고 «연결 필요»만 남긴다', async () => {
  const f = fakeFetch(), st = base({ gov_digest_secret: null });
  const r = await go(st, f);
  assert.equal(r.error, 'not-connected');
  assert.equal(f.calls.length, 0);
  assert.equal(st.db.gov_digest.status.error, 'not-connected');
});

test('★ live — 갈래마다 한 통을 «나에게 보내기»로 보내고, 보낸 줄을 통마다 기록해 다음엔 새 것만 보낸다', async () => {
  const f = fakeFetch(), st = base();
  const r1 = await go(st, f);
  assert.ok(r1.sent >= 1 && !r1.failed.length);
  f.memos().forEach((c) => {
    assert.equal(c.headers.Authorization, 'Bearer ' + SECRET_A);
    assert.match(c.headers['Content-Type'], /x-www-form-urlencoded/);
    assert.ok(templateOf(c).text.length <= 200);
  });
  assert.ok(Object.keys(st.db.gov_digest_state.sent).length >= 1, '보낸 줄이 기록됐다');
  const before = f.memos().length;
  const r2 = await go(st, f, { now: NOW + 864e5 });               // 다음 날 같은 자료
  assert.equal(r2.fresh, 0);
  assert.equal(f.memos().length, before, '새 것이 없으면 더 보내지 않는다');
  assert.equal(st.db.gov_digest.status.ok, true);
});

test('★ 접근 토큰이 곧 만료면 먼저 갈아 끼우고(client_secret 포함), 새 refresh_token 은 «응답에 있을 때만» 바꾼다', async () => {
  const f = fakeFetch(), st = base({ gov_digest_secret: { kakao: tokenNode({ accessExp: NOW + 60e3 }) } });
  await go(st, f);
  assert.equal(f.tokens().length, 1);
  const b = f.tokens()[0].body;
  assert.equal(b.get('grant_type'), 'refresh_token');
  assert.equal(b.get('client_id'), CREDS.restKey);
  assert.equal(b.get('client_secret'), CREDS.clientSecret);
  assert.equal(b.get('refresh_token'), SECRET_R);
  assert.match(f.memos()[0].headers.Authorization, /NEW-/, '새 접근 토큰으로 보낸다');
  assert.equal(st.db.gov_digest_secret.kakao.refresh, SECRET_R, '응답에 refresh_token 이 없으면 기존 것을 그대로 둔다');
  const f2 = fakeFetch({ token: () => ({ status: 200, json: { access_token: 'N2', expires_in: 100, refresh_token: 'R2-새것', refresh_token_expires_in: 5184000 } }) });
  const st2 = base({ gov_digest_secret: { kakao: tokenNode({ accessExp: NOW + 60e3 }) } });
  await go(st2, f2);
  assert.equal(st2.db.gov_digest_secret.kakao.refresh, 'R2-새것', '새 refresh_token 이 오면 바꾼다');
});

test('★ 갱신이 막히면 보내지 않고 이유를 남긴다 — 동의가 풀렸으면 «다시 연결 필요»', async () => {
  const f = fakeFetch({ token: () => ({ status: 400, json: { error: 'invalid_grant', error_description: 'refresh token expired ' + SECRET_R } }) });
  const st = base({ gov_digest_secret: { kakao: tokenNode({ accessExp: NOW + 60e3 }) } });
  const r = await go(st, f);
  assert.equal(r.error, 'reconnect-needed');
  assert.equal(f.memos().length, 0);
  assert.ok(!JSON.stringify(st.db.gov_digest).includes(SECRET_R), '상태에 토큰이 안 남는다');
});

test('★ 보내다 401(접근 토큰 죽음)이면 한 번 갈아 끼우고 같은 글을 다시 보낸다', async () => {
  const f = fakeFetch({ memo: (c, n) => n === 1 ? { status: 401, json: { msg: 'invalid token', code: -401 } } : { status: 200, json: { result_code: 0 } } });
  const st = base();
  const r = await go(st, f);
  assert.equal(f.tokens().length, 1);
  assert.ok(r.sent >= 1 && !r.failed.length);
  assert.equal(templateOf(f.memos()[0]).text, templateOf(f.memos()[1]).text, '같은 글을 다시');
});

test('★ 카카오가 길이·모양으로 거절(400)하면 더 짧은 글로 한 번 더 보낸다', async () => {
  /* 긴 글(70자 넘음)만 거절 — 짧은 판으로 다시 보내면 받아 준다 */
  const f = fakeFetch({ memo: (c) => JSON.parse(c.body.get('template_object')).text.length > 70 ? { status: 400, json: { msg: 'invalid argument', code: -2 } } : { status: 200, json: { result_code: 0 } } });
  const data = feedData(); data.gov_feed.rows[1] = row(1, '노무 진단 사업 ' + '가'.repeat(80));   // 긴 제목 — 짧은 판이 실제로 더 짧아진다
  const r = await go(memStore(Object.assign(data, { gov_digest_cfg: { mode: 'live' }, gov_digest_secret: { kakao: tokenNode() } })), f);
  assert.ok(r.sent >= 1);
  const long = f.memos().filter((c) => templateOf(c).text.length > 70), shortOk = f.memos().filter((c) => templateOf(c).text.length <= 70);
  assert.ok(long.length >= 1 && shortOk.length >= 1, '긴 글이 거절된 뒤 더 짧은 글이 나갔다');
  assert.equal(r.failed.length, 0);
});

test('★ 한 통이 막히면 멈춘다 — 막힌 통의 줄은 기록하지 않아 다음 날 다시 나가고, 앞서 간 통은 기록된다', async () => {
  const data = feedData(); data.gov_feed.rows[3] = row(3, '중소기업 AI 도입 전환 지원 사업 수행기관 모집', { kw: '' });   // 충청 모집·노무 공고·AI 사업 — 세 통
  const f = fakeFetch({ memo: (c, n) => n >= 2 ? { status: 403, json: { msg: 'x', code: -402 } } : { status: 200, json: { result_code: 0 } } });
  const st = memStore(Object.assign(data, { gov_digest_cfg: { mode: 'live' }, gov_digest_secret: { kakao: tokenNode() } }));
  const r = await go(st, f);
  assert.equal(r.sent, 1, '첫 통만 갔다');
  assert.equal(r.failed.length, 1);
  assert.equal(f.memos().length, 2, '막힌 통 다음 통은 시도하지 않는다(세 통 중 둘째에서 멈춤)');
  assert.equal(st.db.gov_digest.status.ok, false);
  const marked = Object.keys(st.db.gov_digest_state.sent).length;
  assert.ok(marked >= 1);
  const f2 = fakeFetch();
  const r2 = await go(st, f2, { now: NOW + 3600e3 });
  assert.ok(r2.sent >= 1, '못 보낸 통은 다시 나간다');
  assert.ok(Object.keys(st.db.gov_digest_state.sent).length > marked);
});

test('★ 200 이어도 result_code 가 0 이 아니면 성공으로 치지 않는다', async () => {
  const f = fakeFetch({ memo: () => ({ status: 200, json: { result_code: -1 } }) });
  const st = base();
  const r = await go(st, f);
  assert.equal(r.sent, 0);
  assert.ok(!st.db.gov_digest_state || !st.db.gov_digest_state.sent, '기록 안 함');
});

test('★ 두 번 불려도 한 번만 돈다(잠금) — 잠금은 끝나면 풀린다', async () => {
  const f = fakeFetch(), st = base();
  st.locks['gov_digest_state/lock'] = NOW;                       // 누가 돌고 있다
  assert.equal((await go(st, f)).skipped, 'locked');
  assert.equal(f.calls.length, 0);
  delete st.locks['gov_digest_state/lock'];
  await go(st, f);
  assert.ok(!st.locks['gov_digest_state/lock'], '끝나면 풀린다');
});

test('★ 토큰·열쇠는 서버 전용 자리 밖(공개 요약·상태)에 안 남는다', async () => {
  const f = fakeFetch({ memo: () => ({ status: 403, json: { msg: 'boom ' + SECRET_A } }) }), st = base();
  await go(st, f);
  const open = JSON.stringify({ pub: st.db.gov_digest, state: st.db.gov_digest_state });
  [SECRET_A, SECRET_R, CREDS.clientSecret, CREDS.restKey].forEach((v) => assert.ok(!open.includes(v), '새어 나갔다: ' + v.slice(0, 8)));
});

test('★ 공개 요약(gov_digest/last)은 줄마다 새 것·마감 임박 표시를 달고, 공개 공고 정보만 담는다', async () => {
  const st = base();
  await go(st, fakeFetch());
  const last = st.db.gov_digest.last;
  assert.ok(last.today === TODAY && last.sections.length);
  const items = [].concat(...last.sections.map((s) => s.items));
  assert.ok(items.length && items.every((x) => 'isNew' in x && 'isSoon' in x && x.title));
  assert.ok(!JSON.stringify(last).includes(SECRET_A));
});

/* ── 연결(동의 한 번) — kakao-memo.js ── */
function cbDeps(o) {
  o = o || {};
  const store = o.store || memStore({});
  const f = o.fetch || fakeFetch({ token: () => ({ status: 200, json: { access_token: SECRET_A, refresh_token: SECRET_R, expires_in: 43199, refresh_token_expires_in: 5184000, scope: o.scope || 'talk_message' } }) });
  return { store, f, d: Object.assign({
    restKey: CREDS.restKey, clientSecret: CREDS.clientSecret, now: NOW, fetch: f, redirectUri: 'https://example.test/cb',
    takeState: async () => ({ originIdx: 0 }), kakaoIdOf: async () => '12345', linkKeyOf: (id) => 'k_' + id, linkOf: async () => ({ uid: 'U1' }), roleOf: async () => ({ status: 'active', isAdmin: true }), store
  }, o.deps || {}) };
}
test('★ 연결 — 대표(총괄 관리자) 카카오가 동의하면 토큰을 저장하고, 확인 글을 «나에게» 보내고, 모드가 비어 있으면 live 로 둔다', async () => {
  const { d, store, f } = cbDeps();
  const out = await KM.handleCallback({ code: 'C', state: 'S' }, d);
  assert.equal(out.status, 200);
  assert.equal(store.db.gov_digest_secret.kakao.refresh, SECRET_R);
  assert.equal(store.db.gov_digest_secret.kakao.uid, 'U1');
  assert.equal(f.memos().length, 1, '확인 글 한 통');
  assert.ok(templateOf(f.memos()[0]).link.web_url.startsWith(ERP.ERP_LINK_BASE + '/'));
  assert.equal(store.db.gov_digest_cfg.mode, 'live');
  assert.ok(!out.html.includes(SECRET_A) && !out.html.includes(SECRET_R), '화면 글에 토큰이 없다');
});
test('★ 연결 — 이미 정해 둔 모드(예: off)는 건드리지 않는다', async () => {
  const store = memStore({ gov_digest_cfg: { mode: 'off' } });
  const { d } = cbDeps({ store });
  await KM.handleCallback({ code: 'C', state: 'S' }, d);
  assert.equal(store.db.gov_digest_cfg.mode, 'off');
});
test('★ 연결 — ERP 에 연결 안 된 카카오·총괄 관리자가 아닌 카카오·재직이 아닌 계정은 토큰을 저장하지 않는다', async () => {
  const cases = [
    { linkOf: async () => null },
    { roleOf: async () => ({ status: 'active', isAdmin: false, isSubAdmin: true }) },
    { roleOf: async () => ({ status: 'inactive', isAdmin: true }) }
  ];
  for (const deps of cases) {
    const { d, store, f } = cbDeps({ deps });
    const out = await KM.handleCallback({ code: 'C', state: 'S' }, d);
    assert.equal(out.status, 403);
    assert.ok(!store.db.gov_digest_secret, '토큰 저장 안 함');
    assert.equal(f.memos().length, 0, '글도 안 보냄');
  }
});
test('★ 연결 — 취소·잘못된 요청·만료된 state·«메시지 전송» 동의 없음은 저장하지 않고 이유를 알린다', async () => {
  const run = (q, o) => { const x = cbDeps(o); return KM.handleCallback(q, x.d).then((out) => ({ out, store: x.store })); };
  let r = await run({ error: 'access_denied' }); assert.equal(r.out.status, 400);
  r = await run({}); assert.equal(r.out.status, 400);
  r = await run({ code: 'C', state: 'S' }, { deps: { takeState: async () => false } }); assert.equal(r.out.status, 400);
  r = await run({ code: 'C', state: 'S' }, { scope: 'profile_nickname' }); assert.equal(r.out.status, 400); assert.match(r.out.html, /talk_message|메시지 전송/);
  r = await run({ code: 'C', state: 'S' }, { deps: { restKey: '' } }); assert.equal(r.out.status, 500);
  [r].forEach((x) => assert.ok(!x.store.db.gov_digest_secret));
});
test('★ 연결 — 확인 글이 거절되면(웹 도메인 미등록 등) 이유를 알린다', async () => {
  const f = fakeFetch({ token: () => ({ status: 200, json: { access_token: SECRET_A, refresh_token: SECRET_R, expires_in: 100, scope: 'talk_message' } }), memo: () => ({ status: 403, json: { msg: 'domain', code: -402 } }) });
  const { d } = cbDeps({ fetch: f });
  const out = await KM.handleCallback({ code: 'C', state: 'S' }, d);
  assert.equal(out.status, 502);
  assert.match(out.html, /웹 도메인/);
});
test('★ 연결 — 돌아올 주소는 함수 주소이고, 화면 글은 HTML 을 이스케이프한다', () => {
  assert.equal(KM.callbackUrl({ GCLOUD_PROJECT: 'proj-x' }), 'https://asia-northeast3-proj-x.cloudfunctions.net/kakaoMemoCallback');
  assert.ok(!/<script/i.test(KM.page(true, '<script>x</script>', ['<b>&"\'</b>'])));
});

/* ── 짜임 — 서버에 연결됐고, 규칙은 «공개 요약만» 연다 ── */
test('★ index.js 에 예약 함수·연결 함수가 있고 카카오 열쇠를 선언했으며, 보안규칙은 공개 요약만 읽게 열고 토큰·기록·모드 자리는 열지 않는다', () => {
  const idx = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  ['govDigestKakao', 'kakaoMemoStart', 'kakaoMemoCallback'].forEach((n) => assert.match(idx, new RegExp('exports\\.' + n + '\\s*=')));
  assert.match(idx.slice(idx.indexOf('exports.govDigestKakao')), /secrets: \["KAKAO_REST_KEY", "KAKAO_CLIENT_SECRET"\]/);
  assert.match(idx.slice(idx.indexOf('exports.govDigestKakao')), /schedule\("every day 08:30"\)/);
  const memo = fs.readFileSync(path.join(__dirname, 'kakao-memo.js'), 'utf8');
  assert.equal((memo.match(/secrets: SECRETS/g) || []).length, 2, '연결 함수 둘 다 열쇠를 선언');
  assert.ok(memo.includes("const SECRETS = ['KAKAO_REST_KEY', 'KAKAO_CLIENT_SECRET'];"), '열쇠 이름 둘을 모두 적었다');
  const rules = fs.readFileSync(path.join(ROOT, 'scripts', 'make-firebase-rules.js'), 'utf8');
  assert.match(rules, /rules\.gov_digest = \{ '\.read': LOGIN, '\.write': false \};/);
  ['gov_digest_secret', 'gov_digest_state', 'gov_digest_cfg'].forEach((n) => assert.ok(!new RegExp('rules\\.' + n + '\\b').test(rules), n + ' 는 규칙에 없어야 한다(화면에서 닫힘)'));
});

/* ── 1차 검토(2026-11-22)가 짚은 것들 ── */
const KM_CORE = KM;
const okOwner = async () => true;
test('★ 보내기 직전마다 자격을 다시 본다 — 퇴사·권한 회수·카카오 연결 해제면 옛 토큰으로 안 보낸다', async () => {
  const f = fakeFetch(), st = base();
  const r = await go(st, f, { verifyOwner: async () => false });
  assert.equal(r.error, 'owner-revoked');
  assert.equal(f.calls.length, 0, '카카오를 안 부른다');
  assert.equal(st.db.gov_digest.status.error, 'owner-revoked');
  const f2 = fakeFetch();
  const r2 = await go(base(), f2, { verifyOwner: okOwner });
  assert.ok(r2.sent >= 1, '자격이 있으면 보낸다');
});
test('★ ownerOk — 총괄 관리자·재직·대표 표지(있으면 그 사람)·연결 살아 있음이 «모두» 맞아야 한다', () => {
  const adm = { status: 'active', isAdmin: true };
  assert.equal(Memo.ownerOk('U1', adm, null, true), true, '대표 표지가 없으면 총괄 관리자면 된다');
  assert.equal(Memo.ownerOk('U1', adm, 'U1', true), true);
  assert.equal(Memo.ownerOk('U1', adm, 'U2', true), false, '대표 표지가 다른 사람이면 안 된다');
  assert.equal(Memo.ownerOk('U1', adm, 'U1', false), false, '연결이 끊겼으면 안 된다');
  assert.equal(Memo.ownerOk('U1', { status: 'inactive', isAdmin: true }, null, true), false);
  assert.equal(Memo.ownerOk('U1', { status: 'active', isAdmin: false, isSubAdmin: true }, null, true), false);
  assert.equal(Memo.ownerOk('', adm, null, true), false);
  assert.equal(Memo.ownerOk('U1', null, null, true), false);
});
test('★ 통신이 끊겨 «갔는지 모르면» 멈추고, 다음 실행이 같은 글을 또 보내지 않는다(보냄·불확실로 돌림)', async () => {
  const st = base();
  const boom = async (url) => { if (url === Memo.MEMO_URL) throw new Error('network down'); return { ok: true, status: 200, json: async () => ({}) }; };
  const r = await go(st, boom);
  assert.equal(r.sent, 0);
  assert.ok(r.failed.some((x) => x.error === 'send-unknown'));
  assert.equal(st.db.gov_digest.status.error, 'send-unknown');
  const pending = st.db.gov_digest_state.inflight;
  assert.ok(pending && pending.ids.length, '보내던 통의 줄을 적어 두었다');
  const f2 = fakeFetch();
  await go(st, f2, { now: NOW + 3600e3 });
  assert.ok(!st.db.gov_digest_state.inflight, '다음 실행이 정리한다');
  pending.ids.forEach((id) => {
    const e = st.db.gov_digest_state.sent[Memo.safeKey(id)];
    assert.ok(e && e.unsure === true, id + ' 는 «불확실»로 돌려 다시 보내지 않는다');
  });
  /* 불확실로 돌린 줄은 다음 통에 다시 실리지 않는다 */
  const resent = f2.memos().map((c) => templateOf(c).text).join('|');
  assert.ok(!resent.includes('충청 모집') || !pending.ids.some((id) => /^hit:/.test(id)), '같은 갈래 글을 또 보내지 않았다');
});
test('★ 카카오가 «안 받았다»고 분명히 답하면 inflight 를 지워 다음 날 다시 보낸다', async () => {
  const st = base(), f = fakeFetch({ memo: () => ({ status: 403, json: { msg: 'x', code: -402 } }) });
  const r = await go(st, f);
  assert.equal(r.sent, 0);
  assert.ok(!st.db.gov_digest_state || !st.db.gov_digest_state.inflight, '안 간 것이니 지운다');
  const r2 = await go(st, fakeFetch(), { now: NOW + 3600e3 });
  assert.ok(r2.sent >= 1, '다시 보낸다');
});
test('★ 보냈는데 기록이 안 됐으면 멈추고, inflight 가 남아 다음 실행이 «불확실»로 돌린다(같은 글을 또 안 보낸다)', async () => {
  const st = base();
  const realUpdate = st.update;
  st.update = async (u) => { if (Object.keys(u).some((k) => k.indexOf('gov_digest_state/sent/') === 0)) throw new Error('write failed'); return realUpdate(u); };
  const f = fakeFetch();
  const r = await go(st, f);
  assert.ok(r.failed.some((x) => x.error === 'record-failed'));
  assert.equal(f.memos().length, 1, '그 통 하나만 갔고 멈췄다');
  const pending = st.db.gov_digest_state.inflight;
  assert.ok(pending, 'inflight 가 남아 있다');
  st.update = realUpdate;
  await go(st, fakeFetch(), { now: NOW + 3600e3 });
  pending.ids.forEach((id) => assert.ok(st.db.gov_digest_state.sent[Memo.safeKey(id)].unsure === true, id + ' 불확실로 돌렸다'));
});
test('★ 오래된 기록을 덜어 내다가 «방금 보낸 기록»을 지우지 않는다', async () => {
  const old = new Date(NOW - 200 * 864e5).toISOString().slice(0, 10);
  const data = feedData(); data.gov_feed.rows[1] = row(1, '노무 진단 사업 가', { closeDt: plus(2) });   // 120일 넘은 기록이 있는 줄이 이번에 «마감 임박»으로 다시 나간다
  const st = memStore(Object.assign(data, { gov_digest_cfg: { mode: 'live' }, gov_digest_secret: { kakao: tokenNode() },
    gov_digest_state: { sent: { [Memo.safeKey('feed:1')]: { sent: old, reminded: '' } } } }));
  await go(st, fakeFetch());
  const e = st.db.gov_digest_state.sent[Memo.safeKey('feed:1')];
  assert.ok(e && e.reminded === TODAY, '이번에 쓴 기록이 남아 있다: ' + JSON.stringify(e));
});
test('★ 갈아 낀 토큰은 «시작할 때 본 연결»이 그대로일 때만 저장한다 — 그사이 다시 연결했으면 새 토큰을 덮지 않는다', async () => {
  const st = base({ gov_digest_secret: { kakao: tokenNode({ accessExp: NOW + 60e3, linkedAt: 111 }) } });
  const f = fakeFetch({ token: () => { st.db.gov_digest_secret.kakao = tokenNode({ linkedAt: 222, refresh: 'NEW-LINK-REFRESH' }); return { status: 200, json: { access_token: 'OLD-REFRESHED', expires_in: 100 } }; } });
  const r = await go(st, f);
  assert.equal(r.error, 'reconnected');
  assert.equal(st.db.gov_digest_secret.kakao.refresh, 'NEW-LINK-REFRESH', '새로 연결한 토큰이 그대로다');
  assert.equal(f.memos().length, 0, '이번에는 보내지 않는다');
});
/* ── 연결 쪽 ── */
test('★ 연결 — 대표 표지(app_owner/uid)가 있으면 그 사람 카카오만, 없으면 총괄 관리자면 된다', async () => {
  const other = memStore({ app_owner: { uid: 'SOMEONE-ELSE' } });
  const a = cbDeps({ store: other });
  const out = await KM.handleCallback({ code: 'C', state: 'S' }, a.d);
  assert.equal(out.status, 403);
  assert.ok(!other.db.gov_digest_secret, '토큰 저장 안 함');
  assert.equal(a.f.memos().length, 0, '글도 안 보냄');
  const mine = memStore({ app_owner: { uid: 'U1' } });
  const b = cbDeps({ store: mine });
  assert.equal((await KM.handleCallback({ code: 'C', state: 'S' }, b.d)).status, 200);
  assert.ok(mine.db.gov_digest_secret.kakao.refresh);
});
test('★ 연결 — 확인 글이 가지 않으면 새 토큰을 저장하지 않는다(기존 연결을 덮어 망가뜨리지 않는다)', async () => {
  const f = fakeFetch({ token: () => ({ status: 200, json: { access_token: 'NEW-A', refresh_token: 'NEW-R', expires_in: 100, scope: 'talk_message' } }), memo: () => ({ status: 403, json: { msg: 'domain', code: -402 } }) });
  const store = memStore({ gov_digest_secret: { kakao: { refresh: 'OLD-R', access: 'OLD-A', linkedAt: 1, uid: 'U1' } } });
  const { d } = cbDeps({ fetch: f, store });
  const out = await KM.handleCallback({ code: 'C', state: 'S' }, d);
  assert.equal(out.status, 502);
  assert.equal(store.db.gov_digest_secret.kakao.refresh, 'OLD-R', '기존 토큰 그대로');
  assert.ok(!JSON.stringify(store.db).includes('NEW-R'));
});
test('★ 연결표 찾기 — 지문 열쇠가 없으면 옛 원문 열쇠로도 찾는다(한 번도 로그인 안 한 옛 연결)', async () => {
  const table = { 'legacy-id-1': { uid: 'U9' } };
  const get = async (p) => table[p] || null;
  assert.deepEqual(await KM_CORE.findLink(get, 'k_hash', 'legacy-id-1'), { uid: 'U9' });
  table.k_hash = { uid: 'U1' };
  assert.deepEqual(await KM_CORE.findLink(get, 'k_hash', 'legacy-id-1'), { uid: 'U1' }, '지문 열쇠가 먼저');
  assert.equal(await KM_CORE.findLink(get, 'nope', 'nope2'), null);
});

/* ── 재검토 1회차(2026-11-22)가 짚은 것들 ── */
test('★ 송신마다 직전에 자격을 다시 본다 — 첫 통 뒤에 권한이 회수되면 둘째 통은 안 가고, 안 보낸 통의 inflight 는 지운다', async () => {
  const data = feedData(); data.gov_feed.rows[3] = row(3, '중소기업 AI 도입 전환 지원 사업 수행기관 모집', { kw: '' });   // 세 통
  const st = memStore(Object.assign(data, { gov_digest_cfg: { mode: 'live' }, gov_digest_secret: { kakao: tokenNode() } }));
  let calls = 0; const args = [];
  const f = fakeFetch();
  /* 1번째 = 보내기 전 확인, 2번째 = 첫 통 송신 직전 → 여기까지 허용하고 그다음부터 회수 */
  const r = await go(st, f, { verifyOwner: async (uid, key) => { args.push([uid, key]); calls++; return calls <= 2; } });
  assert.equal(r.sent, 1, '첫 통만 갔다');
  assert.equal(f.memos().length, 1);
  assert.ok(r.failed.some((x) => x.error === 'owner-revoked'));
  assert.equal(st.db.gov_digest.status.error, 'owner-revoked');
  assert.ok(!st.db.gov_digest_state.inflight, '안 보낸 통의 inflight 는 지운다');
  args.forEach((a) => assert.deepEqual(a, ['U1', 'k_12345'], '토큰에 적힌 uid·연결 지문으로 확인한다'));
});
test('★ 400·401 재시도 직전에도 자격을 본다', async () => {
  let n = 0;
  const f = fakeFetch({ memo: (c, k) => k === 1 ? { status: 401, json: { msg: 'invalid token', code: -401 } } : { status: 200, json: { result_code: 0 } } });
  const st = base();
  const r = await go(st, f, { verifyOwner: async () => { n++; return n <= 2; } });   // 보내기 전 확인·첫 송신 직전은 통과, 401 뒤 재시도 직전에는 회수
  assert.equal(f.memos().length, 1, '재시도는 안 나갔다');
  assert.ok(r.failed.length >= 1);
});
test('★ 연결 지문이 달라지면(카카오를 바꿔 연결) 옛 카카오로 안 보낸다 — 토큰 기록에 연결 지문이 없으면 믿지 않는다', async () => {
  const { d, store } = cbDeps();
  await KM.handleCallback({ code: 'C', state: 'S' }, d);
  assert.equal(store.db.gov_digest_secret.kakao.linkKey, 'k_12345', '연결할 때 지문을 토큰 기록에 함께 둔다');
  assert.ok(!JSON.stringify(store.db.gov_digest_secret.kakao).includes('"12345"'), '회원번호 원문은 안 둔다(지문만)');
  /* index.js 의 verifyOwner 규칙 그대로: ownerOk(uid, role, owner, linked && link.linkKey === 토큰 지문) */
  const role = { status: 'active', isAdmin: true };
  const verify = (link, tokKey) => !!tokKey && Memo.ownerOk('U1', role, null, !!(link && link.linked === true && link.linkKey === tokKey));
  assert.equal(verify({ linked: true, linkKey: 'k_12345' }, 'k_12345'), true);
  assert.equal(verify({ linked: true, linkKey: 'k_다른카카오' }, 'k_12345'), false, 'ERP 연결이 다른 카카오로 바뀌었다');
  assert.equal(verify({ linked: true, linkKey: 'k_12345' }, ''), false, '지문 없는 토큰은 믿지 않는다');
  const idx = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  assert.ok(idx.includes('link.linkKey === linkKey') && idx.includes('if (!uid || !linkKey) return false;'), 'index.js 가 같은 규칙으로 대조한다');
});
test('★ 갈아 낀 토큰 저장은 조건부다 — 그사이 연결 기록을 지웠으면 옛 토큰을 되살리지 않는다', async () => {
  const st = base({ gov_digest_secret: { kakao: tokenNode({ accessExp: NOW + 60e3 }) } });
  const f = fakeFetch({ token: () => { delete st.db.gov_digest_secret; return { status: 200, json: { access_token: 'OLD-REFRESHED', expires_in: 100, refresh_token: 'OLD-R2', refresh_token_expires_in: 100 } }; } });
  const r = await go(st, f);
  assert.equal(r.error, 'reconnected');
  assert.ok(!st.db.gov_digest_secret, '지운 기록을 되살리지 않았다');
  assert.equal(f.memos().length, 0);
});
test('★ 결과를 «성공·분명한 거절·모름»으로 가른다 — 5xx 와 result_code 없는 2xx 는 «모름»(카카오가 접수했을 수도 있다)', async () => {
  const mk = (status, json) => Memo.memoSend(fakeFetch({ memo: () => ({ status, json }) }), 'T', {});
  const ok = await mk(200, { result_code: 0 }); assert.equal(ok.ok, true); assert.ok(!ok.unknown);
  for (const [s, j] of [[500, {}], [502, { msg: 'bad gateway' }], [503, {}], [200, {}], [200, { foo: 1 }]]) {
    const r = await mk(s, j); assert.equal(r.ok, false); assert.equal(r.unknown, true, s + ' ' + JSON.stringify(j) + ' 는 모름이다');
  }
  for (const [s, j] of [[400, { code: -2 }], [401, { code: -401 }], [403, { code: -402 }], [200, { result_code: -1 }]]) {
    const r = await mk(s, j); assert.equal(r.ok, false); assert.ok(!r.unknown, s + ' ' + JSON.stringify(j) + ' 는 분명한 거절이다');
  }
});
test('★ 5xx 로 «모르면» inflight 를 남기고 멈추며 다음 실행이 같은 글을 또 보내지 않는다', async () => {
  const st = base(), f = fakeFetch({ memo: () => ({ status: 503, json: {} }) });
  const r = await go(st, f);
  assert.ok(r.failed.some((x) => x.error === 'send-unknown'));
  const pending = st.db.gov_digest_state.inflight;
  assert.ok(pending && pending.ids.length, 'inflight 가 남았다');
  const f2 = fakeFetch();
  await go(st, f2, { now: NOW + 3600e3 });
  pending.ids.forEach((id) => assert.equal(st.db.gov_digest_state.sent[Memo.safeKey(id)].unsure, true));
});
