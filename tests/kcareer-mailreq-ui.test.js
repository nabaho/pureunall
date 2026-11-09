/* 경력관리 «요청 메일» 화면 — kcareer.html 안의 mr* 코드를 «그대로 꺼내» 가짜 환경에서 돌린다 (2026-11-09)
   검사가 따로 짠 흉내가 아니라 화면에 실제로 있는 함수를 부른다. 합성 자료만 쓴다(저장소는 공개). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 만들기 } = require('./helpers/fake-rtdb.js');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'kcareer.html'), 'utf8');
const Q = require('../js/kcareer-mailreq.js');

const START = html.indexOf('var _mr={');
const END = html.indexOf('/* ===== ⏳ 발송 대기');
const BLOCK = html.slice(START, END);

/* ── 자리가 있다 ── */
test('화면 자리 — 모듈 불러오기 · 알림 띠 · 화면 · 옆줄 묶음 · 숫자 · 이동 후크 · 로그인 후크', () => {
  assert.ok(START > 0 && END > START, '요청 메일 코드 덩어리를 못 찾았다');
  assert.match(html, /<script src="js\/kcareer-mailreq\.js\?v=\d+"><\/script>/);
  assert.match(html, /id="mrBanner"/); assert.match(html, /id="page-mailreq"/); assert.match(html, /id="mrBody"/);
  assert.ok(/\{g:'이력서관리', items:\[(?:\['[^']*','[^']*'\],)*\['page-mailreq','📬 요청 메일'\]\]\}/.test(html), '옆줄 «이력서관리» 묶음 안에 «요청 메일»');
  assert.match(html, /if\(page==='mailreq'\) return[^\n]*mrNavCount/, '옆줄 숫자');
  assert.match(html, /if\(id==='page-mailreq'\)[^\n]*mrEnter/, '화면에 들어오면 다시 그린다');
  assert.match(html, /mrLeave/, '화면을 떠나면 고른 것을 비운다');
  assert.match(html, /typeof mrStart==='function'[^\n]*mrStart\(\)/, '로그인 후 시작');
  assert.match(html, /typeof mrStop==='function'[^\n]*mrStop\(\)/, '로그아웃하면 멈춘다');
});
test('시작은 «안전 모드가 아닌» 로그인 분기 안에 있다 — 안전 모드는 클라우드를 하나도 안 만진다', () => {
  const at = html.indexOf('mrStart();');
  const safe = html.lastIndexOf('if(!KC_SAFE){', at);
  assert.ok(safe > 0 && at - safe < 1500, 'mrStart 가 if(!KC_SAFE){…} 안에 있어야 한다');
  assert.match(BLOCK, /KC_SAFE/, 'mrStart 자신도 안전 모드를 본다');
});
test('옆줄 — «요청 메일»은 이력서관리 묶음 안(네 번째)이고 따로 묶음이 없다 · 첫 자리(서류 만들기)·사업관리 순서는 그대로', () => {
  const nav = html.slice(html.indexOf('let NAV=['), html.indexOf('];', html.indexOf('let NAV=[')));
  const i = nav.indexOf("{g:'이력서관리'"), b = nav.indexOf("{g:'사업관리'");
  const own = nav.slice(i, b);
  assert.ok(own.indexOf('page-mailreq') > own.indexOf('page-profile1'), '이력서관리 안, 프로필 1장 뒤');
  assert.ok(own.indexOf("['page-resume-hub'") < own.indexOf("['page-docbox'") && own.indexOf("['page-docbox'") < own.indexOf('page-mailreq'), '첫 자리는 서류 만들기 그대로(묶음을 누르면 거기가 열린다)');
  assert.ok(nav.indexOf("{g:'요청 메일'") < 0, '요청 메일 따로 묶음이 없다');
  assert.equal(nav.indexOf('{g:', i + 1), b, '사업관리는 이력서관리 바로 아래');
  assert.match(html, /function navGroupCount\(g\)\{[\s\S]{0,200}if\(p\[0\]==='page-mailreq'\) return;/, '요청 메일의 진행 중 건수를 이력서관리 숫자에 섞지 않는다(이력서 개수로 읽힌다)');
});
test('기기별 설정(알림 켬·띠 닫음)은 자료 통(cm3_*)에 두지 않는다 — 두면 클라우드로 간다', () => {
  assert.ok(!/LS\.(set|get)\([^)]*mailreq/.test(BLOCK), 'LS(cm3_*)에 두지 않는다');
  assert.match(BLOCK, /localStorage/);
});

/* ── 가짜 환경 ── */
function liveDb(init) {
  const db = 만들기(init); const ls = []; let writes = 0;
  const norm = (p) => String(p || '').split('/').filter(Boolean).join('/');
  const tell = () => ls.forEach((l) => l.cb({ val: () => db.읽기(l.p) }));
  const wrap = (p) => {
    const r = db.ref(p), w = Object.assign({}, r);
    ['set', 'update', 'transaction'].forEach((k) => { w[k] = async (...a) => { writes++; const out = await r[k](...a); tell(); return out; }; });
    w.child = (k) => wrap(norm(p) + '/' + k);
    w.on = (ev, cb) => { ls.push({ p: norm(p), cb }); cb({ val: () => db.읽기(p) }); };
    w.off = (ev, cb) => { const i = ls.findIndex((l) => l.cb === cb); if (i >= 0) ls.splice(i, 1); };
    return w;
  };
  return { ref: wrap, 읽기: db.읽기, writes: () => writes, listeners: () => ls.length, 쓴것: db.쓴것 };
}
const DAY = 864e5, NOW = Date.now();
const IN = 'INBOX-a1b2c3d4';
const mailRow = (o) => Object.assign({ s: '[가나연구원] 전문가 인력풀 참여 사전동의서', an: ['(양식)참여 동의서.hwp'], p: '안녕하세요', f: '가나연구원', e: 'req@example.org', a: 1, d: NOW - 20 * 60000, r: 0, w: 0 }, o || {});
const BODY = '사전동의서를 첨부하여 송부드립니다.\n- 제출기한 : ' + (() => { const d = new Date(NOW + 2 * DAY); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 18시까지'; })() + '\n- 회신방법 : 이메일 reply@example.org 로 회신';
function world(o) {
  o = o || {};
  const db = liveDb({ mailbox: { folders: { [IN]: { kind: 'inbox' } }, msgs: { [IN]: Object.assign({ '101': mailRow(), '102': mailRow({ s: '회의 일정 공유', an: [], p: '내일 회의', a: 0 }) }, o.msgs || {}) } } });
  const toasts = [], asks = [], timers = [], bodyCalls = [], els = {}, prefs = {};
  /* 옆줄 숫자 자리 — 이력서관리 상위 단추의 .gcnt(제 부모에 title) · 펼친 묶음의 «요청 메일» 줄 .ncnt */
  const cls = () => { const s = new Set(); return { toggle: (c, on) => (on ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; };
  const navTop = { textContent: '', classList: cls(), parentNode: { title: '' } }, navSub = { textContent: '', classList: cls() };
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', style: {}, className: '', checked: false, indeterminate: false, classList: { contains: (c) => (id === 'page-mailreq' ? !!o.onPage : false) }, querySelectorAll: () => [] });
  const ctx = {
    KcareerMailReq: Q, console, Date, Math, JSON, Object, Array, String, Number, Promise, RegExp, isNaN, parseFloat,
    fbDb: db, fbUid: 'U1', KC_SAFE: !!o.safe, _me: { resolved: true },
    kcOwnerState: () => (o.state || 'owner'), kcNoPush: () => false,
    _bizMbCall: async (fn, body) => { bodyCalls.push([fn, body]); if (o.bodyFails) throw new Error('메일 서버 응답 없음'); return { ok: true, text: BODY }; },
    toast: (m, ms) => toasts.push(String(m)), escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    _jsAttr: (s) => String(s == null ? '' : s), stampCellLabels: () => {}, navTile: () => {}, navCountsSoon: () => {},
    kcAskDelete: (btn, opt, onYes) => { asks.push(opt); if (!o.askNo) onYes(); },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; },
    setInterval: () => 99, clearInterval: () => {},
    localStorage: { getItem: (k) => (k in prefs ? prefs[k] : null), setItem: (k, v) => { prefs[k] = String(v); }, removeItem: (k) => { delete prefs[k]; } },
    Notification: undefined,
    document: { hidden: false, title: '경력관리', getElementById: el, addEventListener: () => {}, removeEventListener: () => {},
      querySelector: (sel) => (/data-g="이력서관리"\] \.gcnt/.test(sel) ? navTop : (/data-id="page-mailreq"\] \.ncnt/.test(sel) ? navSub : null)), querySelectorAll: () => [] },
    navInfo: (id) => ({ label: '📬 요청 메일', grp: id === 'page-mailreq' ? '이력서관리' : null }),
  };
  vm.createContext(ctx); vm.runInContext(BLOCK, ctx);
  const run = () => { const q = timers.splice(0); q.forEach((t) => t.fn && t.fn()); };
  return { ctx, db, toasts, asks, timers, run, bodyCalls, els, prefs, navTop, navSub, items: () => db.읽기('kcareer/U1/mailreq/items') || {} };
}
const settle = () => new Promise((r) => setImmediate(r));
async function started(o) { const w = world(o); w.ctx.mrStart(); await settle(); await settle(); await settle(); return w; }

test('시작 — 새로 온 메일에서 요청만 목록에 올리고, 본문을 열어 기한을 채운다', async () => {
  const w = await started();
  const it = w.items();
  assert.deepEqual(Object.keys(it), [IN + '~101'], '요청 아닌 102 는 올리지 않는다');
  assert.equal(it[IN + '~101'].st, 'new');
  assert.equal(it[IN + '~101'].replyTo, 'reply@example.org');
  assert.ok(it[IN + '~101'].deadline && it[IN + '~101'].deadline.time === '18:00', '본문에서 기한');
  assert.deepEqual(w.bodyCalls.map((c) => c[0]), ['readMailMessage'], '푸른메일함과 같은 함수로 본문을 연다');
});
test('★ 대표 본인이 아니면(직원 보기·확인 전) 훑지도 읽지도 쓰지도 않는다', async () => {
  const w = world({ state: 'locked' }); w.ctx.mrStart(); await settle(); await settle();
  assert.equal(w.db.writes(), 0, '아무 데도 쓰지 않았다'); assert.equal(w.db.listeners(), 0); assert.equal(w.bodyCalls.length, 0);
  assert.equal(w.ctx._mr.started, false);
});
test('★ 안전 모드에서는 시작하지 않는다', async () => {
  const w = world({ safe: true }); w.ctx.mrStart(); await settle();
  assert.equal(w.db.writes(), 0); assert.equal(w.ctx._mr.started, false);
});
test('멈추면 듣던 것을 놓고 비운다(로그아웃)', async () => {
  const w = await started(); assert.equal(w.db.listeners(), 1);
  w.ctx.mrStop(); assert.equal(w.db.listeners(), 0); assert.equal(w.ctx._mr.started, false); assert.deepEqual(Object.keys(w.ctx._mr.items), []);
});

/* ── 알림 ── */
test('알림 띠 — 알릴 것이 있으면 뜨고 · 「나중에」는 그 건들을 기억하고 · 새 건이 오면 다시 뜬다 · 이 화면에서는 안 뜬다', async () => {
  const w = await started(); const b = w.els.mrBanner;
  assert.equal(b.style.display, 'block'); assert.match(b.innerHTML, /확인할 요청 메일 1건/);
  assert.match(b.innerHTML, /기한 임박|새 1/);
  w.ctx.mrBannerClose();
  assert.equal(b.style.display, 'none', '「나중에」로 닫힘');
  await w.db.ref('mailbox/msgs/' + IN + '/103').set(mailRow({ s: '강사 이력서 제출 요청', an: [], a: 0, e: 'c@example.com' }));
  await w.ctx.mrScan(true); await settle();
  assert.equal(b.style.display, 'block', '알릴 건이 늘면 다시 뜬다'); assert.match(b.innerHTML, /2건/);
  const on = await started({ onPage: true });
  assert.equal(on.els.mrBanner.style.display, 'none', '요청 메일 화면에 있으면 띠를 또 보이지 않는다');
});
test('새 요청 알림 — 처음 받은 판은 조용하고 · 새로 나타난 «새 요청»은 «한 번에 모아» 한 번 알린다', async () => {
  const w = await started();
  w.run();                                             // 처음 훑을 때 올라온 건(들)의 알림 — 모아서 한 번
  assert.equal(w.toasts.filter((t) => /새 요청 메일/.test(t)).length, 1, '건마다 깜박이지 않고 한 번');
  w.toasts.length = 0;
  await w.db.ref('mailbox/msgs/' + IN + '/103').set(mailRow({ s: '서약서 제출 요청', an: [], a: 0 }));
  await w.db.ref('mailbox/msgs/' + IN + '/104').set(mailRow({ s: '이력서 제출 부탁드립니다', an: [], a: 0 }));
  await w.ctx.mrScan(true); await settle(); w.run();
  const msg = w.toasts.filter((t) => /새 요청 메일/.test(t));
  assert.equal(msg.length, 1); assert.match(msg[0], /2건/, '두 건을 모아 알린다');
});
test('이미 답장한 메일은 «새 요청»으로 울리지 않는다', async () => {
  const w = world({ msgs: { '101': mailRow({ w: 1 }) } }); w.ctx.mrStart(); await settle(); await settle(); await settle(); w.run();
  assert.equal(w.items()[IN + '~101'].st, 'doing'); assert.equal(w.toasts.filter((t) => /새 요청 메일/.test(t)).length, 0);
});
test('옆줄 — 알릴 것이 있으면 이력서관리 단추에 붉은 «📬 N» · 묶음 안 «요청 메일» 줄 숫자도 붉게 · 알릴 것이 없으면 건드리지 않는다', async () => {
  const w = await started(); w.ctx.mrPaintNav();
  assert.equal(w.navTop.textContent, '📬 1'); assert.ok(w.navTop.classList.contains('mr-alarm'));
  assert.match(w.navTop.parentNode.title, /^이력서관리 · 요청 메일/);
  assert.ok(w.navSub.classList.contains('mr-alarm'), '펼친 묶음의 줄 숫자도 붉게');
  await w.ctx.mrSet([IN + '~101'], 'done'); await settle(); w.navTop.textContent = '';   // navPaintCounts 가 원래 숫자(없음)를 다시 칠한 상태
  w.ctx.mrPaintNav();
  assert.ok(!w.navTop.classList.contains('mr-alarm') && w.navTop.textContent === '', '알릴 것이 없으면 붉은 표시도 «📬» 글자도 남기지 않는다');
  assert.ok(!w.navSub.classList.contains('mr-alarm'));
});
test('탭 제목에 알릴 건수가 붙고, 없으면 원래대로', async () => {
  const w = await started(); assert.match(w.ctx.document.title, /^\(\d+\) 경력관리$/);
  await w.ctx.mrSet([IN + '~101'], 'done'); await settle();
  assert.equal(w.ctx.document.title, '경력관리');
});

/* ── 목록 ── */
test('목록 — 한 줄 칸(제목은 … + title 전문) · ☐ + № · 탭 건수 · 기한 딱지', async () => {
  const w = await started({ onPage: true }); w.ctx.mrRender();
  const h = w.els.mrBody.innerHTML;
  assert.match(h, /class="rownum"><label class="rn-chk"><input type="checkbox" class="row-chk"/, '맨 왼쪽 ☐ + №');
  assert.match(h, /<th class="rownum-h"><input type="checkbox" id="mrAll"/, '머리줄 ☐');
  assert.match(h, /text-overflow:ellipsis;white-space:nowrap" title="[^"]*참여 사전동의서/, '제목은 … 이고 title 에 전문');
  assert.match(h, /진행 중 1/); assert.match(h, /D-\d|D-day/, '기한 딱지');
  assert.match(h, /class="mr-btx"/, '단추 말은 폰에서 숨긴다');
  assert.match(html, /@media \(max-width:760px\)\{[^}]*\.mr-btx\{display:none\}/, '폰에서 단추 말 숨김(CSS)');
});
test('알 수 없는 상태값이면 칩도 단추도 «새 요청»으로 맞는다(칩은 새 요청인데 되돌림 단추만 나오면 안 된다)', async () => {
  const w = await started({ onPage: true });
  await w.db.ref('kcareer/U1/mailreq/items/' + IN + '~101').update({ st: 'zzz' });
  w.ctx.mrTab('all');
  const h = w.els.mrBody.innerHTML;
  assert.match(h, /class="mr-chip new">새 요청</); assert.match(h, /mrOne\('[^']*','doing'\)/, '확인 단추'); assert.match(h, /mrOne\('[^']*','ignored'\)/);
  assert.ok(!/되돌림/.test(h.slice(h.indexOf('<tbody>'))), '새 요청으로 그려졌으니 되돌림 단추가 나오면 안 된다');
});
test('칩은 «자기 바탕»을 가진다 — 어두운 판에서도 표 바탕은 흰색이라 글자색만 뒤집는 규칙이 없다', () => {
  const css = html.slice(html.indexOf('.mr-chip{'), html.indexOf('#mrBody .btn:disabled'));
  assert.ok(!/html\.dark \.mr-chip/.test(css), '어두운 판에서 칩 글자만 밝게 바꾸면 흰 표 위에서 안 보인다');
  ['new', 'doing', 'done', 'red'].forEach((k) => assert.match(css, new RegExp('\\.mr-chip\\.' + k + '\\{[^}]*background:#[0-9a-f]{6};[^}]*color:#[0-9a-f]{6}'), k + ' 칩에 바탕과 글자색이 같이 있어야 한다'));
});
test('키보드로 닿는다 — 탭은 단추(button) · 띠 링크는 href 가 있고 · 고르기 칸에는 이름이 붙는다 · 도구줄은 .toolbar(제목 중복 없음)', async () => {
  const w = await started({ onPage: true }); w.ctx.mrRender();
  const h = w.els.mrBody.innerHTML;
  assert.match(h, /<button type="button" class="mr-pill on" aria-pressed="true"/); assert.ok(!/<span class="mr-pill/.test(h), '탭이 span 이면 키보드로 못 누른다');
  assert.match(h, /class="toolbar mr-top"/);
  assert.match(h, /class="row-chk" aria-label="[^"]*동의서[^"]*고르기"/);
  const off = await started();                              // 요청 메일 화면 «밖»에서 보는 띠
  assert.match(off.els.mrBanner.innerHTML, /<a href="#" onclick="navTile\('page-mailreq'\);return false">보기<\/a>/);
  assert.match(off.els.mrBanner.innerHTML, /<a href="#" class="mr-x" onclick="mrBannerClose\(\);return false">나중에<\/a>/);
  assert.match(html, /id="mrBanner" class="mr-banner" role="status"/);
  assert.match(html, /#mrBody \.btn:disabled\{[^}]*cursor:default/, '비활성 단추가 눌릴 것처럼 보이면 안 된다');
});
test('줄 수 한도 — 오래 쓰면 완료 탭이 길어져도 한도까지만 그리고, 「전체 선택」도 보이는 줄만 고른다', async () => {
  const w = await started({ onPage: true });
  const many = {}; for (let i = 0; i < 230; i++) many[IN + '~' + (500 + i)] = { id: IN + '~' + (500 + i), slug: IN, uid: String(500 + i), st: 'done', s: '완료 건 ' + i, kinds: ['consent'], d: NOW - i * 1000, updatedAt: NOW - i * 1000 };
  await w.db.ref('kcareer/U1/mailreq/items').update(Object.keys(many).reduce((o, k) => { o[k] = many[k]; return o; }, {}));
  await settle(); w.ctx.mrTab('done');
  const rows = (w.els.mrBody.innerHTML.match(/<tr class=/g) || []).length;
  assert.ok(rows > 0 && rows < 230, '한도가 있어야 한다(' + rows + '줄)'); assert.match(w.els.mrBody.innerHTML, /건만 보입니다 — 전체 230건/);
  w.ctx.mrPickAll(true);
  assert.equal(Object.keys(w.ctx._mr.sel).length, rows, '고른 것은 «보이는 줄»만(안 보이는 건을 골라 일괄로 바꾸면 안 된다)');
});
test('★ 메일 제목·보낸이를 이스케이프한다(제목에 태그가 있어도 화면에 안 심긴다)', async () => {
  const w = world({ onPage: true, msgs: { '101': mailRow({ s: '동의서 제출 <img src=x onerror=alert(1)>', f: '<b>가</b>' }) } });
  w.ctx.mrStart(); await settle(); await settle(); await settle(); w.ctx.mrRender();
  const h = w.els.mrBody.innerHTML;
  assert.ok(!/<img src=x/.test(h) && !/<b>가<\/b>/.test(h), '태그가 그대로 들어가면 안 된다');
  assert.match(h, /&lt;img src=x/);
});
test('★ DB 가 준 상태 값이 클래스에 그대로 들어가지 않는다 — 아는 상태만(모르면 «새 요청»으로)', async () => {
  const w = await started({ onPage: true });
  await w.db.ref('kcareer/U1/mailreq/items/' + IN + '~101').update({ st: 'x" onmouseover="alert(1)' });
  w.ctx.mrTab('all');                                   // 모르는 상태는 «진행 중» 탭에는 안 나온다 — 전체 탭에서 본다
  const h = w.els.mrBody.innerHTML;
  assert.ok(!/onmouseover/.test(h), '모르는 상태 글자가 화면에 심기면 안 된다');
  assert.match(h, /class="mr-chip new">새 요청</);
});
test('★ 메일함 열기는 앱끼리 여는 공용 길(PuAppBar.goApp)로 — 이름 없는 새 탭(_blank)이 아니다', () => {
  assert.match(BLOCK, /function mrOpenMail\(\)\{[^}]*PuAppBar\.goApp\(u\)/);
  assert.match(BLOCK, /onclick="mrOpenMail\(\)"/);
  assert.ok(!/'_blank'/.test(BLOCK), '누를 때마다 탭이 쌓이는 _blank 가 없어야 한다');
});
test('★ 고르기만으로는 아무것도 저장되지 않는다 — 「N건 선택」과 할 일만 띄운다', async () => {
  const w = await started({ onPage: true }); const before = w.db.writes();
  w.ctx.mrPick(IN + '~101', true);
  assert.equal(w.db.writes(), before, '저장 호출이 없다');
  assert.equal(w.items()[IN + '~101'].st, 'new');
  assert.equal(w.els.mrSelCnt.textContent, 1);
});
test('일괄 바꾸기 — 건수를 묻고(아니오면 그대로) · 예면 «한 번에 한 번» 저장', async () => {
  const no = await started({ onPage: true, askNo: true }); no.ctx.mrPick(IN + '~101', true);
  const w0 = no.db.writes(); no.ctx.mrBatch({}, 'done');
  assert.equal(no.asks.length, 1); assert.match(no.asks[0].title, /1건/);
  assert.equal(no.db.writes(), w0, '아니오 — 저장하지 않는다'); assert.equal(no.items()[IN + '~101'].st, 'new');

  const w = await started({ onPage: true, msgs: { '103': mailRow({ s: '서약서 제출 요청', an: [], a: 0 }) } });
  w.ctx.mrPick(IN + '~101', true); w.ctx.mrPick(IN + '~103', true);
  const before = w.db.writes(); w.ctx.mrBatch({}, 'ignored'); await settle(); await settle();
  assert.match(w.asks[0].title, /2건/); assert.equal(w.db.writes(), before + 1, '여러 건도 저장은 한 번');
  assert.equal(w.items()[IN + '~101'].st, 'ignored'); assert.equal(w.items()[IN + '~103'].st, 'ignored');
  assert.equal(Object.keys(w.ctx._mr.sel).length, 0, '끝나면 고른 것을 비운다');
});
test('쪽지의 조사 — «처리 완료로» · «확인함으로» · «요청 아님으로»', async () => {
  const w = await started({ onPage: true }); w.ctx.mrPick(IN + '~101', true);
  w.ctx.mrBatch({}, 'done'); assert.match(w.asks.at(-1).title, /«처리 완료»로 /); assert.match(w.asks.at(-1).yes, /«처리 완료»로 /);
  const x = await started({ onPage: true }); x.ctx.mrPick(IN + '~101', true); x.ctx.mrBatch({}, 'ignored'); assert.match(x.asks.at(-1).title, /«요청 아님»으로 /);
});
test('상태를 바꿔도 다른 칸(제목·기한·보낸이)은 건드리지 않는다 · 되돌릴 수 있다', async () => {
  const w = await started({ onPage: true }); const 전 = JSON.parse(JSON.stringify(w.items()[IN + '~101']));
  await w.ctx.mrSet([IN + '~101'], 'done'); await settle();
  const 후 = w.items()[IN + '~101'];
  assert.equal(후.st, 'done'); assert.ok(후.doneAt > 0);
  ['s', 'f', 'e', 'd', 'deadline', 'replyTo', 'kinds', 'an', 'why', 'createdAt'].forEach((k) => assert.deepEqual(후[k], 전[k], k + ' 이 바뀌면 안 된다'));
  await w.ctx.mrSet([IN + '~101'], 'doing'); await settle();
  assert.equal(w.items()[IN + '~101'].st, 'doing'); assert.ok(!w.items()[IN + '~101'].doneAt, '되돌리면 처리 시각을 지운다');
});
test('저장이 거절되면 말한다(조용히 삼키지 않는다)', async () => {
  const w = await started({ onPage: true }); const real = w.ctx.fbDb.ref;
  w.ctx.fbDb.ref = (p) => { const r = real(p); return Object.assign({}, r, { update: async () => { throw new Error('PERMISSION_DENIED'); } }); };
  const n = await w.ctx.mrSet([IN + '~101'], 'done');
  assert.equal(n, 0); assert.ok(w.toasts.some((t) => /저장하지 못했습니다/.test(t) && /PERMISSION_DENIED/.test(t)));
});
test('본문을 못 열어도 목록·알림은 된다 — 기한 칸이 «읽는 중/기한 모름»으로 정직하게', async () => {
  const w = await started({ onPage: true, bodyFails: true }); w.ctx.mrRender();
  assert.equal(w.items()[IN + '~101'].st, 'new'); assert.ok(!w.items()[IN + '~101'].deadline);
  assert.match(w.els.mrBody.innerHTML, /읽는 중|기한 모름/);
});
test('브라우저 알림 — 허락과 설정이 있고 «다른 탭을 보고 있을 때»만 띄운다', async () => {
  const shown = [];
  const w = world({ onPage: true });
  w.ctx.Notification = function (t, o) { shown.push([t, o]); this.close = () => {}; }; w.ctx.Notification.permission = 'granted';
  w.prefs.kc_mr_notify = '1';
  w.ctx.mrStart(); await settle(); await settle(); await settle(); w.run();
  assert.equal(shown.length, 0, '화면을 보고 있으면 알림 창은 띄우지 않는다(토스트가 말했다)');
  w.ctx.document.hidden = true;
  await w.db.ref('mailbox/msgs/' + IN + '/103').set(mailRow({ s: '서약서 제출 요청', an: [], a: 0 }));
  await w.ctx.mrScan(true); await settle(); w.run();
  assert.equal(shown.length, 1); assert.match(shown[0][0], /새 요청 메일/);
  w.prefs.kc_mr_notify = '0';
  await w.db.ref('mailbox/msgs/' + IN + '/104').set(mailRow({ s: '확약서 제출 요청', an: [], a: 0 }));
  await w.ctx.mrScan(true); await settle(); w.run();
  assert.equal(shown.length, 1, '꺼 두면 안 띄운다');
});
