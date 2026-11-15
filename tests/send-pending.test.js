/* 메일 보내기 — 쓰기 화면에 붙잡아 두지 않고 «보낸 창»에서 기다린다 (대표 지시 2026-11-09)
 *
 *   「메일보내면 보낸창으로 바로 넘어가고 기다리게 했으면 좋겠다」
 *
 * ■ 무슨 일이었나
 *   서버가 한 통 보내는 데 4~6초 걸린다(서버 로그 2026-11-09: 6.1초·4.2초). 그동안 쓰기 화면에
 *   «보내는 중… N초» 단추만 남아 아무것도 못 했고, 다 나간 뒤에야 보낸 창으로 갔다.
 *
 * ■ 무엇을 지키나
 *   ① 메일함에서 「지금 보내기」를 누르면 «서버 답을 기다리기 전에» 보낸 창이 열리고 맨 위에 보내는 중 줄이 선다.
 *   ② 나가면 줄이 실제 기록으로 바뀐다 — 목록을 다시 읽은 뒤에 거둔다. 임시저장은 «나간 뒤에만» 지운다.
 *   ③ 실패하면 붉은 줄 + 「다시 쓰기」 — 쓴 글이 그대로 되살아난다. 알림(alert)도 그대로 띄운다.
 *   ④ 예약·메일함이 아닌 곳(자료함 보내기 창)은 예전 그대로다(보내는 중 줄 없음 · 끝난 뒤에 이동).
 *   ⑤ 보내는 동안 다시 보낼 수 없다(같은 메일이 두 번 나가는 길을 막는다).
 *   ⑥ 기다리는 사이 새로 쓰기 시작한 글을 «건드리지 않는다»(지우지도 덮지도 않는다).
 *   ⑦ 줄에 찍히는 받는 곳·제목·오류는 가려서(esc) 찍고, id 는 data 속성으로만 싣는다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const cards = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

function constLine(name) {
  const m = new RegExp('^const ' + name + ' = [^\\n]*;', 'm').exec(cards);
  assert.ok(m, name + ' 상수를 못 찾았습니다');
  return m[0];
}
const DRAFT_KEY = /^const DRAFT_LS = '([^']+)'/m.exec(cards)[1];

function makeEnv(over) {
  const store = {};
  const ctx = Object.assign({
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    state: { view: 'mail', mailSent: false, items: {}, sendPend: [], sentBox: {}, draftAt: '' },
    myEmail: 'me@example.invalid', _matMeta: { m1: { name: '제안서.pdf' } }, _sendMatSetName: '',
    sent: [], toasts: [], alerts: [], calls: [], redraws: 0,
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    fmtDate: () => '2026.11.09', sentHm: () => '10:00', staffName: () => '보낸이',
    fmtWhen: (t) => String(t), setInterval: () => 1, clearInterval: () => {},
    document: { querySelectorAll: () => [] },
    alert: null, confirm: () => true,
  }, over || {});
  ctx.toast = (m) => { ctx.toasts.push(String(m)); };
  ctx.alert = (m) => { ctx.alerts.push(String(m)); };
  ctx.grabCompose = () => {};
  ctx.composeCheck = () => ({ ok: true });
  ctx.suspectList = () => [];
  ctx.attachTotal = () => 0;
  ctx.mbAnswered = (s, u) => ctx.calls.push('mbAnswered:' + s + ':' + u);
  ctx.draft = () => { const v = ctx.localStorage.getItem(DRAFT_KEY); return v ? JSON.parse(v) : null; };   /* 임시저장 칸을 들여다본다 */
  ctx.loadSendLog = () => ctx.calls.push('loadSendLog');
  ctx.loadSentBox = (cb) => { ctx.calls.push('loadSentBox'); if (cb) cb(); };
  ctx.openSentBox = () => { ctx.calls.push('openSentBox'); ctx.state.mailSent = true; };
  ctx.openSchedBox = () => ctx.calls.push('openSchedBox');
  ctx.closeSendMat = () => ctx.calls.push('closeSendMat');
  ctx.renderPCSide = () => ctx.calls.push('renderPCSide');
  ctx.renderMailPage = () => { ctx.redraws++; };
  ctx.render = () => ctx.calls.push('render');
  ctx.bulkSendAll = () => ctx.calls.push('bulkSendAll');
  ctx.postAutoMail = (payload) => new Promise((res, rej) => { ctx.sent.push({ payload, res, rej }); });
  const src = [
    'let _compose = null; let _sending = false;',
    constLine('DRAFT_LS'),
    /* 임시저장은 «진짜 함수»로 — 지우기·덮어쓰기 규칙이 이 일의 핵심이다 */
    sliceFn(cards, 'function draftOf(c)'), sliceFn(cards, 'function composeTouched(c)'),
    sliceFn(cards, 'function saveDraft(quiet, pid)'), sliceFn(cards, 'function clearDraft()'), sliceFn(cards, 'function clearDraftIf(pid)'),
    sliceFn(cards, 'async function sendCompose(){'),
    sliceFn(cards, 'function lockSendButtons(on)'),
    sliceFn(cards, 'function sendPendAdd(c)'),
    sliceFn(cards, 'function sendPendTick()'),
    sliceFn(cards, 'function sendPendRedraw()'),
    sliceFn(cards, 'function sendPendFail(p, e)'),
    sliceFn(cards, 'function sentAfterSend(p)'),
    sliceFn(cards, 'function sendPendDrop(id)'),
    sliceFn(cards, 'function sendPendRetry(id)'),
    sliceFn(cards, 'function sendPendHtml()'),
    `({ sendCompose, sendPendRetry, sendPendDrop, sendPendHtml, saveDraft,
        setCompose(c){ _compose = c; }, getCompose(){ return _compose; }, isSending(){ return _sending; } })`,
  ].join('\n');
  vm.createContext(ctx);
  const api = vm.runInContext(src, ctx);
  return { api, ctx };
}
const compose = (over) => Object.assign({ cardId: 'c1', to: 'a@example.invalid', cc: '', subject: '제목입니다', body: '본문', html: '<p>본문</p>', ids: ['m1'], files: [] }, over || {});
const tick = () => new Promise((r) => setImmediate(r));

test('① 누르면 «서버 답을 기다리기 전에» 보낸 창이 열리고 보내는 중 줄이 선다', async () => {
  const { api, ctx } = makeEnv();
  const c = compose();
  api.setCompose(c);
  const pr = api.sendCompose();
  assert.equal(ctx.sent.length, 1, '서버에 보내지 않았습니다');
  assert.ok(ctx.calls.includes('openSentBox'), '★ 서버 답을 기다리는 동안 쓰기 화면에 붙잡혀 있습니다');
  assert.equal(api.getCompose(), null, '쓰기 화면의 글을 비우지 않아 새 메일에 같은 글이 또 열립니다');
  assert.equal(ctx.state.sendPend.length, 1);
  assert.equal(ctx.state.sendPend[0].status, 'sending');
  assert.equal(api.isSending(), true);
  const d = ctx.draft();
  assert.ok(d, '★ 나가기도 전에 임시저장이 없습니다 — 보내는 중 창이 닫히면 글이 사라집니다');
  assert.equal(d.subject, '제목입니다');
  assert.equal(d.pid, ctx.state.sendPend[0].id, '임시저장이 «지금 나가는 그 편지 것»이라는 표가 없습니다');
  const html = api.sendPendHtml();
  assert.match(html, /⏳/); assert.match(html, /보내는 중/); assert.ok(html.includes('data-t0='), '초가 올라가는 자리가 없습니다');
  ctx.sent[0].res({ ok: true, from: 'x@example.invalid', files: 0, missing: 0 });
  await pr;
});

test('② 나가면 목록을 다시 읽은 뒤 줄을 거두고, 그제야 임시저장을 지운다', async () => {
  const { api, ctx } = makeEnv();
  api.setCompose(compose({ replyTo: { slug: 'S', uid: 7 } }));
  const pr = api.sendCompose();
  ctx.sent[0].res({ ok: true, from: 'x@example.invalid', files: 1, missing: 0 });
  await pr;
  assert.equal(ctx.state.sendPend.length, 0, '나갔는데 보내는 중 줄이 남았습니다');
  assert.ok(ctx.calls.includes('loadSentBox'), '목록을 다시 안 읽어 방금 기록이 안 보입니다');
  assert.equal(ctx.draft(), null, '나갔는데 임시저장이 남아 다음에 또 뜹니다');
  assert.ok(ctx.calls.includes('mbAnswered:S:7'), '답장 표시를 안 켰습니다');
  assert.equal(ctx.calls.filter((x) => x === 'openSentBox').length, 1, '나간 뒤 보낸 창을 또 열어 화면이 두 번 바뀝니다');
  assert.ok(ctx.toasts.some((t) => t.includes('보냈습니다')));
  assert.equal(api.isSending(), false, '끝났는데 잠금이 안 풀립니다');
});

test('③ 실패하면 붉은 줄 + 알림 — 글은 그대로, 「다시 쓰기」가 되살린다', async () => {
  const { api, ctx } = makeEnv();
  const c = compose({ subject: '못 보낸 제목' });
  api.setCompose(c);
  const pr = api.sendCompose();
  ctx.sent[0].rej(new Error('다음메일 연결이 끊겼습니다'));
  await pr;
  const p = ctx.state.sendPend[0];
  assert.equal(p.status, 'failed');
  assert.match(p.error, /다음메일 연결/);
  assert.equal(ctx.alerts.length, 1, '실패를 알림으로도 알려야 합니다(보낸 창을 안 보고 있을 수 있다)');
  assert.ok(ctx.draft(), '★ 실패했는데 임시저장을 지웠습니다 — 글이 사라집니다');
  assert.equal(api.isSending(), false);
  const html = api.sendPendHtml();
  assert.match(html, /❌/); assert.match(html, /다시 쓰기/); assert.match(html, /다음메일 연결이 끊겼습니다/);
  /* 다시 쓰기 — 쓴 글이 그대로 돌아온다 */
  api.sendPendRetry(p.id);
  assert.equal(api.getCompose(), c, '★ 못 보낸 글을 되살리지 못했습니다');
  assert.equal(ctx.state.mailSent, false);
  assert.equal(ctx.state.sendPend.length, 0);
  assert.ok(ctx.calls.includes('render'));
});

test('③ 못 보낸 줄은 「지우기」로 치울 수 있다', async () => {
  const { api, ctx } = makeEnv();
  api.setCompose(compose());
  const pr = api.sendCompose();
  ctx.sent[0].rej(new Error('실패'));
  await pr;
  api.sendPendDrop(ctx.state.sendPend[0].id);
  assert.equal(ctx.state.sendPend.length, 0);
});

test('④ 예약은 예전 그대로 — 보내는 중 줄도, 미리 이동도 없다', async () => {
  const { api, ctx } = makeEnv();
  const c = compose({ sendAt: Date.now() + 3600e3 });
  api.setCompose(c);
  const pr = api.sendCompose();
  assert.ok(!ctx.calls.includes('openSentBox'), '예약인데 보낸 창으로 갔습니다');
  assert.equal(ctx.state.sendPend.length, 0);
  assert.equal(api.getCompose(), c, '예약은 서버가 답할 때까지 글을 들고 있어야 합니다');
  ctx.sent[0].res({ ok: true, scheduled: true, at: Date.now() + 3600e3 });
  await pr;
  assert.ok(ctx.calls.includes('openSchedBox'));
  assert.equal(api.getCompose(), null);
});

test('④ 메일함이 아닌 곳(자료함 보내기 창)은 예전 그대로 — 끝난 뒤에 닫는다', async () => {
  const { api, ctx } = makeEnv();
  ctx.state.view = 'list';
  api.setCompose(compose());
  const pr = api.sendCompose();
  assert.ok(!ctx.calls.includes('openSentBox'), '메일함이 아닌데 보낸 창으로 갔습니다');
  assert.equal(ctx.state.sendPend.length, 0);
  ctx.sent[0].res({ ok: true, from: 'x@example.invalid', files: 0, missing: 0 });
  await pr;
  assert.ok(ctx.calls.includes('closeSendMat'));
  assert.ok(!ctx.calls.includes('openSentBox'));
});

test('⑤ 보내는 동안 다시 보내면 막는다 — 같은 메일이 두 번 나가지 않는다', async () => {
  const { api, ctx } = makeEnv();
  api.setCompose(compose());
  const pr = api.sendCompose();
  api.setCompose(compose({ subject: '두 번째' }));
  await api.sendCompose();
  assert.equal(ctx.sent.length, 1, '★ 보내는 중인데 서버에 또 보냈습니다');
  assert.ok(ctx.toasts.length >= 1, '막았으면 이유를 말해야 합니다');
  ctx.sent[0].res({ ok: true, from: 'x@example.invalid', files: 0, missing: 0 });
  await pr;
});

test('⑥ 기다리는 사이 새로 쓰기 시작한 글은 건드리지 않는다', async () => {
  const { api, ctx } = makeEnv();
  api.setCompose(compose());
  const pr = api.sendCompose();
  const fresh = compose({ subject: '새로 쓰는 글' });
  api.setCompose(fresh);                       /* 보낸 창에서 「새 메일」 */
  ctx.sent[0].res({ ok: true, from: 'x@example.invalid', files: 0, missing: 0 });
  await pr;
  assert.equal(api.getCompose(), fresh, '★ 나간 메일이 새로 쓰던 글을 지웠습니다');
});

test('★★ 새로 쓰던 글을 자동저장으로 저장해 두었으면, 나간 메일이 그 저장본을 «지우지 않는다»', async () => {
  const { api, ctx } = makeEnv();
  api.setCompose(compose({ subject: '나가는 글' }));
  const pr = api.sendCompose();
  const fresh = compose({ subject: '새로 쓰는 글', to: 'b@example.invalid' });
  api.setCompose(fresh);
  api.saveDraft(true);                                   /* 30초 자동저장이 돌았다 — 저장본이 새 글로 덮였다 */
  assert.equal(ctx.draft().subject, '새로 쓰는 글');
  ctx.sent[0].res({ ok: true, from: 'x@example.invalid', files: 0, missing: 0 });
  await pr;
  assert.ok(ctx.draft(), '★ 나간 메일이 새로 쓰던 글의 임시저장을 지웠습니다');
  assert.equal(ctx.draft().subject, '새로 쓰는 글');
});

test('★★ 새 메일을 «열어만 둔»(비어 있는) 사이 나가도 나간 글의 저장본은 지운다 — 다음에 또 이어 쓰자고 묻지 않게', async () => {
  const { api, ctx } = makeEnv();
  api.setCompose(compose({ subject: '나가는 글' }));
  const pr = api.sendCompose();
  api.setCompose({ cardId: '', to: '', cc: '', subject: '', body: '', html: '', ids: [], files: [], base: {} });   /* 「새 메일」만 눌렀다 */
  assert.ok(ctx.draft(), '보내는 중에는 저장본이 있어야 합니다');
  ctx.sent[0].res({ ok: true, from: 'x@example.invalid', files: 0, missing: 0 });
  await pr;
  assert.equal(ctx.draft(), null, '★ 이미 나간 메일의 저장본이 남아 다음에 같은 글을 이어 쓰게 합니다(이중 발송 길)');
});

test('★★ 보내기 직전의 «마지막 수정»까지 저장해 둔다 — 자동저장(30초) 뒤에 고친 글도 남는다', async () => {
  const { api, ctx } = makeEnv();
  const c = compose({ subject: '자동저장 때 제목' });
  api.setCompose(c);
  api.saveDraft(true);                                   /* 마지막 자동저장 */
  c.subject = '그 뒤에 고친 제목';                        /* 곧바로 고치고 */
  c.body = '그 뒤에 고친 본문';
  const pr = api.sendCompose();                          /* 바로 보낸다 */
  const d = ctx.draft();
  assert.equal(d.subject, '그 뒤에 고친 제목', '★ 마지막 수정이 저장되지 않았습니다 — 창이 닫히면 사라집니다');
  assert.equal(d.body, '그 뒤에 고친 본문');
  ctx.sent[0].rej(new Error('실패'));
  await pr;
});

test('못 보낸 줄을 「지우기」하면 그 저장본도 지운다 — 방금 버린 글이 또 뜨지 않게. 남의 저장본은 건드리지 않는다', async () => {
  const { api, ctx } = makeEnv();
  api.setCompose(compose({ subject: '못 보낼 글' }));
  const pr = api.sendCompose();
  ctx.sent[0].rej(new Error('실패'));
  await pr;
  assert.ok(ctx.draft(), '실패했으니 저장본은 남아 있어야 합니다');
  api.sendPendDrop(ctx.state.sendPend[0].id);
  assert.equal(ctx.draft(), null, '버렸는데 저장본이 남았습니다');
  /* 그 사이 새 글이 저장본을 덮은 경우 — 지우기가 새 글을 지우면 안 된다 */
  api.setCompose(compose({ subject: '또 못 보낼 글' }));
  const pr2 = api.sendCompose();
  ctx.sent[1].rej(new Error('실패'));
  await pr2;
  api.setCompose(compose({ subject: '새로 쓰는 글', to: 'z@example.invalid' }));
  api.saveDraft(true);
  api.sendPendDrop(ctx.state.sendPend[0].id);
  assert.equal(ctx.draft().subject, '새로 쓰는 글', '★ 못 보낸 줄을 지우다 새로 쓰던 글의 저장본을 지웠습니다');
});

test('⑥ 실패한 글을 되살릴 때 쓰던 글이 있으면 «묻는다»', async () => {
  const { api, ctx } = makeEnv();
  const first = compose({ subject: '첫 글' });
  api.setCompose(first);
  const pr = api.sendCompose();
  api.setCompose(compose({ subject: '쓰던 글' }));
  ctx.sent[0].rej(new Error('실패'));
  await pr;
  let asked = 0;
  ctx.confirm = () => { asked++; return false; };
  const keep = api.getCompose();
  api.sendPendRetry(ctx.state.sendPend[0].id);
  assert.equal(asked, 1, '쓰던 글을 말없이 덮었습니다');
  assert.equal(api.getCompose(), keep, '거절했는데 덮였습니다');
  assert.equal(ctx.state.sendPend.length, 1, '거절했는데 줄이 사라졌습니다');
});

test('⑦ 줄에 찍히는 값은 가려서 찍고, id 는 data 속성으로만 싣는다', async () => {
  const { api, ctx } = makeEnv();
  const c = compose({ to: '"><img src=x onerror=alert(1)>@example.invalid', subject: '<script>alert(1)</script>' });
  api.setCompose(c);
  const pr = api.sendCompose();
  ctx.sent[0].rej(new Error('<b onmouseover=alert(1)>오류</b>'));
  await pr;
  const html = api.sendPendHtml();
  assert.ok(!/<script>|<img src=x|<b onmouseover/.test(html), '★ 입력한 값이 가려지지 않고 찍혔습니다');
  const clicks = (html.match(/onclick="[^"]*"/g) || []);
  assert.ok(clicks.length >= 2);
  clicks.forEach((a) => assert.match(a, /this\.dataset\.pid/, '단추가 id 를 글자로 박았습니다: ' + a));
  assert.ok(!/onclick="[^"]*\('/.test(html), 'onclick 이 값을 따옴표 문자열로 박습니다');
});

/* ── 소스 지킴 ── */
test('보낸 창이 맨 위에 보내는 중 줄을 그린다 — 없으면 아직 보낸 메일이 없다고 말하지 않는다', () => {
  const body = sliceFn(cards, 'function sentBoxHtml()');
  assert.match(body, /sendPendHtml\(\)/, '보낸 창이 보내는 중 줄을 안 그립니다');
  assert.match(body, /\$\{pendHtml\}\$\{body\}/, '보내는 중 줄이 목록 위에 안 섭니다');
  assert.match(body, /pendHtml \? ''/, '보내는 중인데 「아직 보낸 메일이 없습니다」가 같이 뜹니다');
});

test('보내는 중에는 «쓰다 만 글 이어 쓸래요?»를 묻지 않는다 — 같은 글이 또 열려 두 번 나가는 길', () => {
  const body = sliceFn(cards, 'function openMailPage(pre)').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(body, /if\(!_compose && !pre && !_sending\)/, '보내는 중에도 임시저장을 이어 쓰자고 묻습니다');
});

test('못 보낸 줄에서 나온 저장본을 이어 쓰면 그 붉은 줄을 거둔다 — 줄과 편집기가 같은 글을 두 벌로 들지 않게', () => {
  const body = sliceFn(cards, 'function openMailPage(pre)').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(body, /if\(d\.pid\) state\.sendPend = \(state\.sendPend\|\|\[\]\)\.filter\(x=>x\.id!==d\.pid\)/, '이어 쓰기가 붉은 줄을 안 거둡니다');
});

test('못 보낸 줄의 단추는 type=button · 오류 칸은 role=alert — 보조기기가 알아본다', () => {
  const { api, ctx } = makeEnv();
  ctx.state.sendPend = [{ id: 'sp1', t0: Date.now(), to: 'a@example.invalid', toName: '', subject: '제목', names: [], status: 'failed', error: '실패', snap: {} }];
  const html = api.sendPendHtml();
  assert.match(html, /<button type="button" data-pid/);
  assert.match(html, /role="alert"/);
});

test('보내기 구조의 약속이 그대로다 — 수상한 주소 확인 → 서버 → 답장 표시 순서, 서식·평문 동반', () => {
  const fn = sliceFn(cards, 'async function sendCompose(){').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const ask = fn.indexOf('suspectList('), post = fn.indexOf('await postAutoMail('), mark = fn.indexOf('mbAnswered(');
  assert.ok(ask > 0 && post > ask && mark > post, '확인 → 서버 → 표시 순서가 깨졌습니다');
  /* 직접 이동(openSentBox)과 마지막 수정 저장(saveDraft)은 서버를 부르기 «전»에, 임시저장 지우기는 서버 «뒤»에 와야 한다 */
  const nav = fn.indexOf('openSentBox()'), clr = fn.indexOf('clearDraftIf(pend.id)'), sav = fn.indexOf('saveDraft(true, pend.id)');
  assert.ok(nav > 0 && nav < post, '보낸 창으로 가는 것이 서버 답을 기다린 뒤입니다');
  assert.ok(sav > 0 && sav < nav, '쓰기 화면을 비우기 «전에» 마지막 수정을 저장하지 않습니다');
  assert.ok(clr > post, '임시저장을 나가기 전에 지웁니다');
  assert.match(fn, /html:\s*c\.html/); assert.match(fn, /body:\s*c\.body/);
});
