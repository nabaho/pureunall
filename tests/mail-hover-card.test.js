/* 👁 메일 줄에 마우스를 올리면 «내용 카드» (대표 승인 목업 2026-10-30)
   「마우스 커서를 메일 위에 클릭 없이 올리면 내용을 볼 수 있게 … 팝업창으로 어떤 내용인지 볼 수 있게 해서
     다른 사람이 안 열어봐도 되게」
   ═══════════════════════════════════════════════════════════════════════════
   ★ 가장 중요한 것 — 읽음 표시를 «안 한다». 직원이 함께 쓰는 메일함이라 「읽음」이 곧 「누가 봤다」다.
     올려 본 것을 열어 본 것으로 치면 이 카드를 만든 뜻(다른 분이 안 열어도 되게)이 사라진다.
   이 검사는 카드를 «실제로 그려» 보고, 올려놓기·치우기·켜고 끄기를 «실제로 해» 본다(가짜 화면 요소). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const fn = (n) => sliceFn(HTML, 'function ' + n + '(');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ── 아주 작은 가짜 화면 요소 ── */
class El {
  constructor(tag) { this.tagName = tag; this.className = ''; this.children = []; this._text = ''; this.style = {}; this._on = new Set(); this.ev = {}; this.isConnected = true; this.offsetWidth = 560; this.offsetHeight = 300; this.id = ''; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(n, f) { this.ev[n] = f; }
  get classList() { const s = this._on; const me = this; return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) }; }
  getBoundingClientRect() { return this.rect || { top: 200, bottom: 240, left: 0, right: 900 }; }
}
function rowEl(top) { const e = new El('div'); e.rect = { top: top === undefined ? 200 : top, bottom: (top === undefined ? 200 : top) + 40, left: 0, right: 900 }; return e; }
const findCls = (el, cls) => { const out = []; (function w(e) { if ((' ' + e.className + ' ').indexOf(' ' + cls + ' ') >= 0) out.push(e); e.children.forEach(w); })(el); return out; };

function make(o) {
  const opt = o || {};
  const calls = { fetch: [], toast: [], render: 0, flag: 0, store: {} };
  const cache = {};
  const els = {};
  const document = {
    getElementById: (id) => els[id] || null,
    createElement: (t) => new El(t),
    createTextNode: (t) => { const e = new El('#text'); e.textContent = t; return e; },
    body: { appendChild: (e) => { if (e.id) els[e.id] = e; return e; } },
  };
  const box = {
    console, Promise, Object, Array, Number, String, Math, Date, JSON, setTimeout, clearTimeout,
    MB_OLD_ID: '*old',
    state: { mbOpen: opt.open || null, mbPickMode: !!opt.pick },
    localStorage: { getItem: (k) => (k in calls.store ? calls.store[k] : (opt.ls === undefined ? null : opt.ls)), setItem: (k, v) => { calls.store[k] = String(v); } },
    toast: (m) => calls.toast.push(m),
    renderMailPage: () => { calls.render++; },
    window: { innerWidth: opt.W || 1600, innerHeight: opt.H || 900 },
    matchMedia: () => ({ matches: !!opt.touch }),
    document, DOMParser: undefined,
    fmtDate: () => '2026.10.30', fmtMB: (b) => Math.round(b / 1024) + 'KB',
    mbNameOf: (e, f) => f || '', mbBoxName: (s) => (s === '*old' ? '지난 메일' : '받은메일함'),
    mbBodyGet: (s, u) => cache[s + '|' + u] || null,
    mbFetchBody: (s, u, peek) => { calls.fetch.push({ s, u, peek }); return Promise.resolve().then(() => { if (opt.body) cache[s + '|' + u] = opt.body; return opt.body; }); },
    _mbMsgs: { INBOX: { 5: { e: 'lee@example.com', f: '이영희', s: opt.subject || '10월 근태 자료', d: 1790000000000, p: '미리보기 글입니다', a: 2, r: 0 } },
               '*old': { K1: { e: 'old@example.com', f: '옛사람', s: '옛 메일', d: 1600000000000, p: '옛 미리보기' } } },
    mbReadMarkBg: () => { calls.flag++; }, mbSeenMark: () => { calls.flag++; },
  };
  box.window.matchMedia = box.matchMedia;
  vm.createContext(box);
  vm.runInContext('const MB_CARD_LS = "pucards_mb_hovercard"; const MB_CARD_MS = 400; const MB_CARD_SWITCH_MS = 120; const MB_CARD_GRACE = 250; const MB_CARD_TEXT_MAX = 2400;\n' +
    'let _mbCardT = 0, _mbCardHideT = 0, _mbCardKey = "";\n' +
    ['mbCardOn', 'mbCardToggle', 'mbCardCanHover', 'mbCardEl', 'mbCardVisible', 'mbCardText', 'mbCardAttLine', 'mbCardFill', 'mbCardPlace', 'mbCardShow', 'mbCardEnter', 'mbCardLeave', 'mbCardHide'].map(fn).join('\n') +
    '\n;' + ['mbCardOn', 'mbCardToggle', 'mbCardText', 'mbCardAttLine', 'mbCardEnter', 'mbCardLeave', 'mbCardHide', 'mbCardVisible', 'mbCardShow', 'mbCardPlace', 'mbCardEl'].map((n) => 'this.' + n + ' = ' + n).join('; '), box);
  box.calls = calls; box.els = els; box.cache = cache;
  return box;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BODY = { html: '', text: '안녕하세요 노무사님.\n10월분 근태 자료를 보내드립니다.\n감사합니다.', atts: [{ name: '10월 근태.xlsx', size: 1228800 }, { name: '퇴사자.hwp', size: 86016 }] };

/* ══ ① 읽음 표시를 안 한다 — 이 카드의 존재 이유 ══ */
test('★★★ 올려 본 것은 «읽음 표시를 안 한다» — 본문은 peek 로만 받고, 읽음·열람 기록을 부르지 않는다', async () => {
  const b = make({ body: BODY });
  const row = rowEl();
  b.mbCardEnter(row, { clientX: 400 }, 'INBOX', '5');
  await wait(560);
  assert.equal(b.mbCardVisible(), true, '카드가 안 떴다');
  assert.ok(b.calls.fetch.length >= 1, '본문을 안 받는다');
  assert.ok(b.calls.fetch.every((c) => c.peek === true), '★★★ 읽음 표시가 되는 길(peek 아님)로 받았다 — 올려 보기만 해도 «읽음»이 된다');
  assert.equal(b.calls.flag, 0, '★★★ 읽음/열람 기록을 불렀다');
  assert.equal(b._mbMsgs.INBOX[5].r, 0, '★★★ 줄의 읽음 값이 바뀌었다');
});

test('★★★ 카드 코드는 읽음·열람 기록 함수를 «아예 부르지 않는다» (글자 검사 — 위 실제 검사의 안전망)', () => {
  const src = strip(['mbCardShow', 'mbCardFill', 'mbCardEnter', 'mbCardText', 'mbCardAttLine'].map(fn).join('\n'));
  ['mbReadMarkBg', 'mbSeenMark', 'flagMailMessages', 'mbOpenMsg', 'mbToggleRead', 'mbFlag(', '.r = 1', '.r=1'].forEach((w) => {
    assert.ok(src.indexOf(w) < 0, '카드가 ' + w + ' 를 부른다 — 올려 보기만 해도 읽음이 된다');
  });
  assert.match(src, /mbFetchBody\(slug, uid, true\)/, '본문을 peek(true)로 받지 않는다');
});

/* ══ ② 안전 — 남의 글이다 ══ */
test('★★★ 글자는 textContent 로만 넣는다 — 제목·본문의 태그가 «글자 그대로» 보인다(HTML 로 안 넣는다)', async () => {
  const b = make({ body: { text: '<img src=x onerror=alert(1)> 본문', html: '', atts: [] }, subject: '<script>alert(1)</script>' });
  b.mbCardEnter(rowEl(), { clientX: 400 }, 'INBOX', '5');
  await wait(560);
  const c = b.els.mbCard;
  assert.match(c.textContent, /<script>alert\(1\)<\/script>/, '제목이 글자 그대로가 아니다');
  assert.match(c.textContent, /<img src=x onerror=alert\(1\)> 본문/, '본문이 글자 그대로가 아니다');
  assert.ok(!/innerHTML/.test(strip(['mbCardFill', 'mbCardEl', 'mbCardShow'].map(fn).join('\n'))), '카드가 innerHTML 을 쓴다 — 메일 한 통이 이 앱을 조종할 수 있다');
});

/* ══ ③ 내용 ══ */
test('★★ 카드에 제목·보낸 사람·주소·받은 때·칸·첨부(이름·크기)·본문이 있다', async () => {
  const b = make({ body: BODY });
  b.mbCardEnter(rowEl(), { clientX: 400 }, 'INBOX', '5');
  await wait(560);
  const c = b.els.mbCard;
  assert.equal(findCls(c, 'sj')[0].textContent, '10월 근태 자료');
  const mt = findCls(c, 'mt')[0].textContent;
  assert.match(mt, /이영희/); assert.match(mt, /<lee@example\.com>/); assert.match(mt, /2026\.10\.30/); assert.match(mt, /받은메일함/);
  const at = findCls(c, 'at')[0].textContent;
  assert.match(at, /📎 10월 근태\.xlsx · 1200KB/); assert.match(at, /퇴사자\.hwp/);
  assert.match(findCls(c, 'bd')[0].textContent, /10월분 근태 자료를 보내드립니다/);
  assert.match(findCls(c, 'ft')[0].textContent, /읽음 표시가 안 됩니다/, '읽음 표시가 안 된다는 안내가 없다');
});

test('★★ 본문이 오기 «전»에는 목록의 미리보기 글(row.p)을 바로 보인다 — 빈 카드를 보이지 않는다', async () => {
  const b = make({ body: null });                    // 본문을 못 받는 경우
  b.mbCardEnter(rowEl(), { clientX: 400 }, 'INBOX', '5');
  await wait(560);
  assert.match(findCls(b.els.mbCard, 'bd')[0].textContent, /미리보기 글입니다/);
  assert.match(findCls(b.els.mbCard, 'at')[0].textContent, /첨부 2개/, '첨부 수도 없다');
});

test('★★ 지난 메일(POP3)은 본문을 «받지 않는다» — 한 통에 메일 통째다. 앞부분(미리보기)만 보인다', async () => {
  const b = make({ body: BODY });
  b.mbCardEnter(rowEl(), { clientX: 400 }, '*old', 'K1');
  await wait(560);
  assert.equal(b.calls.fetch.length, 0, '지난 메일 본문을 받았다');
  assert.match(findCls(b.els.mbCard, 'bd')[0].textContent, /옛 미리보기/);
  assert.match(findCls(b.els.mbCard, 'mt')[0].textContent, /지난 메일/);
});

test('★ 본문 글자 만들기 — 인용된 이전 메일은 자르고, 너무 길면 …로 자르고, html 만 있으면 태그를 걷는다', () => {
  const b = make({});
  const quoted = '답장입니다. 확인했습니다. 감사합니다.\n회신 부탁드립니다 내용이 충분히 깁니다 정말로 길게.\n\n------ 원본 메시지 ------\n보낸 사람: 누구\n옛 내용';
  const t = b.mbCardText({ text: quoted });
  assert.ok(t.indexOf('원본 메시지') < 0 && t.indexOf('옛 내용') < 0, '인용된 이전 메일이 남았다: ' + t);
  assert.match(t, /회신 부탁드립니다/);
  assert.ok(b.mbCardText({ text: 'ㄱ'.repeat(5000) }).length <= 2401, '길이를 안 자른다');
  const h = b.mbCardText({ text: '', html: '<style>p{}</style><p>첫줄</p><p>둘째줄<br>셋째줄</p><script>x()</script>' });
  assert.ok(!/[<>]|x\(\)|p\{\}/.test(h), 'html 태그·스크립트가 남았다: ' + h);
  assert.match(h, /첫줄\s+둘째줄\s+셋째줄/);
});

/* ══ ④ 언제 뜨고 언제 사라지나 ══ */
test('★★ 스쳐 지나가면 안 뜬다 — 0.4초 머물러야 뜬다', async () => {
  const b = make({ body: BODY });
  b.mbCardEnter(rowEl(), { clientX: 400 }, 'INBOX', '5');
  await wait(150); b.mbCardLeave();
  await wait(600);
  assert.equal(!!b.els.mbCard && b.mbCardVisible(), false, '스치기만 했는데 카드가 떴다');
  assert.equal(b.calls.fetch.length, 0, '스치기만 했는데 본문을 받았다');
});

test('★★ 줄·카드를 벗어나면 사라지고, 카드 «안으로» 들어가면 안 사라진다(긴 글을 스크롤해 읽도록)', async () => {
  const b = make({ body: BODY });
  b.mbCardEnter(rowEl(), { clientX: 400 }, 'INBOX', '5');
  await wait(560);
  assert.equal(b.mbCardVisible(), true);
  b.mbCardLeave();                                    // 줄을 벗어남
  b.els.mbCard.ev.mouseenter();                       // 그 사이 카드 안으로
  await wait(400);
  assert.equal(b.mbCardVisible(), true, '카드 안으로 들어갔는데 사라졌다 — 긴 글을 못 읽는다');
  b.els.mbCard.ev.mouseleave();                       // 카드도 벗어남
  await wait(400);
  assert.equal(b.mbCardVisible(), false, '다 벗어났는데 안 사라진다');
});

test('★ 카드가 떠 있을 때 다른 줄로 옮기면 «바로» 바뀐다(0.12초) — 줄을 훑을 때마다 0.4초씩 기다리지 않는다', async () => {
  const b = make({ body: BODY });
  b._mbMsgs.INBOX[6] = { e: 'k@example.com', f: '김', s: '둘째 메일', d: 1790000100000, p: '둘째 미리보기' };
  b.mbCardEnter(rowEl(), { clientX: 400 }, 'INBOX', '5');
  await wait(560);
  b.mbCardLeave();
  b.mbCardEnter(rowEl(260), { clientX: 400 }, 'INBOX', '6');
  await wait(260);
  assert.equal(findCls(b.els.mbCard, 'sj')[0].textContent, '둘째 메일', '다른 줄로 옮겼는데 카드가 안 바뀌었다');
});

test('★★ 꺼져 있거나 · 터치 기기거나 · 메일을 열어 읽는 중이면 안 뜬다', async () => {
  for (const o of [{ ls: '0' }, { touch: true }, { open: { slug: 'INBOX', uid: '5' } }, { pick: true }]) {
    const b = make(Object.assign({ body: BODY }, o));
    b.mbCardEnter(rowEl(), { clientX: 400 }, 'INBOX', '5');
    await wait(560);
    assert.equal(!!b.els.mbCard && b.mbCardVisible(), false, JSON.stringify(o) + ' 인데 카드가 떴다');
    assert.equal(b.calls.fetch.length, 0, JSON.stringify(o) + ' 인데 본문을 받았다');
  }
});

/* ══ ⑤ 켜고 끄기 ══ */
test('★★ 기본은 «켜짐» — 안 적혀 있으면 켜진 것. 끄면 이 PC 에 «0»으로 기억하고 카드를 치운다', async () => {
  const b = make({ body: BODY });
  assert.equal(b.mbCardOn(), true, '안 적혀 있는데 꺼져 있다');
  b.mbCardEnter(rowEl(), { clientX: 400 }, 'INBOX', '5');
  await wait(560);
  assert.equal(b.mbCardVisible(), true);
  b.mbCardToggle();
  assert.equal(b.calls.store.pucards_mb_hovercard, '0');
  assert.equal(b.mbCardOn(), false);
  assert.equal(b.mbCardVisible(), false, '껐는데 카드가 남았다');
  assert.ok(b.calls.render >= 1, '칩 모양을 안 다시 그린다');
  b.mbCardToggle();
  assert.equal(b.calls.store.pucards_mb_hovercard, '1');
  assert.equal(make({ ls: '0' }).mbCardOn(), false, '기억해 둔 꺼짐을 못 읽는다');
});

/* ══ ⑥ 자리 ══ */
test('★★ 마우스 «오른쪽»에 둔다 — 모자라면 왼쪽, 그래도 모자라면 창 안으로(아래도 마찬가지)', () => {
  const place = (W, H, x, top) => { const b = make({ W, H }); const c = new El('div'); c.offsetWidth = 560; c.offsetHeight = 300; b.mbCardPlace(c, rowEl(top), x); return { l: parseFloat(c.style.left), t: parseFloat(c.style.top) }; };
  assert.equal(place(1600, 900, 400, 200).l, 428, '오른쪽에 안 둔다');
  assert.equal(place(1000, 900, 700, 200).l, 700 - 28 - 560, '오른쪽이 모자란데 왼쪽으로 안 뒤집는다');
  const tight = place(500, 900, 300, 200);
  assert.ok(tight.l >= 8 && tight.l + 560 <= 500 + 560, '창 안으로 안 들어온다');
  assert.equal(place(1600, 900, 400, 700).t, 900 - 8 - 300, '아래가 모자란데 위로 안 올린다');
  assert.equal(place(1600, 300, 400, 10).t >= 8, true);
});

/* ══ ⑦ 화면에 달려 있나 ══ */
test('★★ 줄에 달려 있다 — 본문 미리 받기(mbHoverPeek)와 «같이» 부른다 · 켜고 끄는 칩 · 다시 그릴 때·열 때 닫는다', () => {
  const app = strip(HTML);
  assert.match(HTML, /onmouseenter="mbHoverPeek\('\$\{v\._slug\}','\$\{v\.u\}'\);mbCardEnter\(this,event,'\$\{v\._slug\}','\$\{v\.u\}'\)" onmouseleave="mbHoverCancel\(\);mbCardLeave\(\)"/, '줄에 안 달렸다');
  assert.match(HTML, /class="dm-cardtog \$\{mbCardOn\(\)\?'on':''\}" onclick="mbCardToggle\(\)"/, '켜고 끄는 칩이 없다');
  assert.match(strip(fn('renderMailPage')), /mbCardHide\(\)/, '줄을 다시 그려도 카드가 남는다');
  assert.match(strip(fn('mbOpenMsg')), /mbCardHide\(\)/, '메일을 열어도 카드가 남는다');
  assert.match(app, /document\.addEventListener\('click', mbCardHide\)/, '클릭해도 안 닫힌다');
  assert.match(app, /document\.addEventListener\('scroll', mbCardHide, true\)/, '스크롤해도 안 닫힌다');
});

test('★ 카드 모양 — 창 위에 뜨고(fixed) 안 보일 땐 display:none, 본문만 스크롤된다', () => {
  const css = strip(HTML.slice(0, HTML.indexOf('</style>')));
  const rule = (sel) => { const i = css.indexOf(sel + '{'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('#mbCard'), /position:fixed/);
  assert.match(rule('#mbCard'), /display:none/);
  assert.match(rule('#mbCard.on'), /display:flex/);
  assert.match(rule('#mbCard .bd'), /overflow:auto/);
  assert.match(rule('#mbCard .mt'), /white-space:nowrap/, '보낸 사람 줄이 두 줄로 꺾인다');
});
