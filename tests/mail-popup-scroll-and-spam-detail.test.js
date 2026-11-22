/* 📬 메일 올려보기 팝업(#mbCard) 스크롤 보강 + 🤔 스팸 의심(#cspBox) 내용 확인·원본 삭제 표시 검증 (2026-11-19) */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice');
const S = require('../js/pu-card-spam.js');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r/g, '');
const fn = (n) => sliceFn(HTML, 'function ' + n + '(');

class FakeEl {
  constructor(tag) {
    this.tagName = tag;
    this.className = '';
    this.children = [];
    this.parent = null;
    this._text = '';
    this.style = {};
    this._on = new Set();
    this.ev = {};
    this.isConnected = true;
    this.offsetWidth = 560;
    this.offsetHeight = 360;
    this.clientHeight = 240;
    this.scrollHeight = 900;
    this.scrollTop = 0;
    this.id = '';
  }
  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join('');
  }
  set textContent(v) {
    this._text = String(v);
    this.children = [];
  }
  appendChild(c) {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  contains(target) {
    let cur = target;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parent || null;
    }
    return false;
  }
  querySelector(sel) {
    if (sel && sel.charAt(0) === '.') {
      const cls = sel.slice(1);
      let found = null;
      (function walk(el) {
        if (found) return;
        if ((' ' + el.className + ' ').indexOf(' ' + cls + ' ') >= 0) { found = el; return; }
        el.children.forEach(walk);
      })(this);
      return found;
    }
    return null;
  }
  addEventListener(n, f) {
    this.ev[n] = f;
  }
  get classList() {
    const s = this._on;
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      contains: (c) => s.has(c),
    };
  }
  getBoundingClientRect() {
    return this.rect || { top: 180, bottom: 220, left: 0, right: 900 };
  }
}

function makeHoverSandbox(opt) {
  const o = opt || {};
  const els = {};
  const cache = {};
  const document = {
    getElementById: (id) => els[id] || null,
    createElement: (t) => new FakeEl(t),
    createTextNode: (t) => { const e = new FakeEl('#text'); e.textContent = t; return e; },
    body: { appendChild: (e) => { if (e.id) els[e.id] = e; return e; } },
  };
  const ctx = {
    console, Promise, Object, Array, Number, String, Math, Date, JSON, setTimeout, clearTimeout,
    MB_OLD_ID: '*old',
    state: { mbOpen: null, mbPickMode: false },
    localStorage: { getItem: () => null, setItem: () => {} },
    toast: () => {},
    renderMailPage: () => {},
    window: { innerWidth: 1600, innerHeight: 900, matchMedia: () => ({ matches: false }) },
    matchMedia: () => ({ matches: false }),
    document,
    DOMParser: undefined,
    fmtDate: () => '2026.11.19',
    fmtMB: (b) => Math.round(b / 1024) + 'KB',
    mbNameOf: (e, f) => f || '',
    mbBoxName: () => '1.자문사답변',
    mbBodyGet: (s, u) => cache[s + '|' + u] || null,
    mbFetchBody: (s, u) => Promise.resolve().then(() => {
      if (o.body) cache[s + '|' + u] = o.body;
      return o.body || null;
    }),
    _mbMsgs: {
      BOX1: {
        10: {
          e: 'sender@gana.example',
          f: '홍길동',
          s: '성과급 지급 기준 문의',
          d: 1795080000000,
          p: '&nbsp;· 3개월 미만: 미지급\n&nbsp;· 3~6개월: 100% 일할 적용',
          a: 0,
          r: 0,
        },
        11: {
          e: 'other@gana.example',
          f: '김갑돌',
          s: '이웃 줄 메일',
          d: 1795080100000,
          p: '이웃 줄 미리보기',
          a: 0,
          r: 0,
        },
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(
    'const MB_CARD_LS = "pucards_mb_hovercard"; const MB_CARD_MS = 30; const MB_CARD_SWITCH_MS = 40; const MB_CARD_GRACE = 60; const MB_CARD_TEXT_MAX = 4800;\n'
    + 'let _mbCardT = 0, _mbCardHideT = 0, _mbCardKey = "";\n'
    + ['mbCardOn', 'mbCardToggle', 'mbCardCanHover', 'mbCardEl', 'mbCardVisible', 'mbCardText', 'mbCardAttLine', 'mbCardFill', 'mbCardPlace', 'mbCardShow', 'mbCardEnter', 'mbCardLeave', 'mbCardHide'].map(fn).join('\n')
    + '\n;this.mbCardEnter=mbCardEnter;this.mbCardLeave=mbCardLeave;this.mbCardHide=mbCardHide;this.mbCardVisible=mbCardVisible;this.mbCardText=mbCardText;',
    ctx
  );
  ctx.els = els;
  return ctx;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('★★★ ① 메일 올려보기 팝업(#mbCard) — 팝업 내부 스크롤·클릭·휠·방향키에도 닫히지 않고 아래까지 내려간다', async () => {
  const longText = Array.from({ length: 40 }, (_, i) => `${i + 1}번째 줄: &nbsp;· 3개월 미만 미지급 기준 안내`).join('\n');
  const b = makeHoverSandbox({ body: { text: longText, html: '', atts: [] } });
  const row1 = new FakeEl('div');
  const row2 = new FakeEl('div');
  const outerList = new FakeEl('div');

  b.mbCardEnter(row1, { clientX: 380 }, 'BOX1', '10');
  await wait(80);
  assert.equal(b.mbCardVisible(), true, '올려보기 팝업이 열려야 한다');

  const card = b.els.mbCard;
  const bd = card.querySelector('.bd');
  const hd = card.querySelector('.hd');
  assert.ok(bd && hd, '머리글(.hd)과 본문(.bd) 요소가 있어야 한다');
  assert.ok(!/&nbsp;/.test(bd.textContent), '본문에 &nbsp; 가 글자 그대로 남으면 안 된다');
  assert.match(bd.textContent, /· 3개월 미만 미지급 기준 안내/);

  /* 1) 대각선으로 마우스를 옮기다 이웃 줄을 잠깐 스친 뒤 팝업 안으로 진입해도 다른 메일로 바뀌지 않는다 */
  b.mbCardLeave();
  b.mbCardEnter(row2, { clientX: 400 }, 'BOX1', '11');
  card.ev.mouseenter();
  await wait(80);
  assert.equal(b.mbCardVisible(), true);
  assert.equal(card.querySelector('.sj').textContent, '성과급 지급 기준 문의', '팝업 진입 시 이웃 줄 타이머를 취소해야 한다');

  /* 2) 팝업 본문(.bd) 내부 스크롤 이벤트(capture scroll)가 발생해도 닫히지 않는다 */
  bd.scrollTop = 180;
  b.mbCardHide({ type: 'scroll', target: bd });
  assert.equal(b.mbCardVisible(), true, '★★★ 팝업 본문을 스크롤했는데 팝업이 닫혔다');

  /* 3) 스크롤바 클릭·본문 드래그 클릭에도 닫히지 않는다 */
  b.mbCardHide({ type: 'click', target: bd });
  assert.equal(b.mbCardVisible(), true, '★★★ 팝업 내부(스크롤바·글자)를 클릭했는데 팝업이 닫혔다');

  /* 4) 머리글(.hd) 위에서 마우스 휠을 굴려도 본문(.bd)이 아래로 내려가고 바깥 목록으로 전파되지 않는다 */
  let prevented = false, stopped = false;
  card.ev.wheel({
    deltaY: 120,
    deltaMode: 0,
    target: hd,
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  });
  assert.equal(bd.scrollTop, 300, '머리글 위에서 휠을 굴리면 본문(.bd)이 스크롤되어야 한다');
  assert.equal(prevented, true);
  assert.equal(stopped, true);

  /* 5) 키보드 ArrowDown / PageDown 으로도 본문이 내려가고 닫히지 않으며, Escape 를 누르면 닫힌다 */
  b.mbCardHide({ type: 'keydown', key: 'ArrowDown', target: bd, preventDefault: () => {} });
  assert.equal(bd.scrollTop, 348);
  assert.equal(b.mbCardVisible(), true);

  /* 6) 팝업 바깥 목록을 스크롤하거나 클릭하면 기존처럼 즉시 닫힌다 */
  card.ev.mouseleave();
  b.mbCardHide({ type: 'scroll', target: outerList });
  assert.equal(b.mbCardVisible(), false, '바깥 메일 목록을 스크롤하면 팝업이 닫혀야 한다');
});

test('★★ ①-2 본문 도착 전 미리보기(v.p)에도 &nbsp; 가 풀리고 overscroll-behavior:contain 이 걸려 있다', async () => {
  const b = makeHoverSandbox({ body: null });
  b.mbCardEnter(new FakeEl('div'), { clientX: 380 }, 'BOX1', '10');
  await wait(80);
  const bd = b.els.mbCard.querySelector('.bd');
  assert.ok(!/&nbsp;/.test(bd.textContent), '미리보기(v.p)에 &nbsp; 가 남았다');
  assert.match(bd.textContent, /· 3개월 미만: 미지급/);
  const css = HTML.slice(0, HTML.indexOf('</style>'));
  const bdCss = css.slice(css.indexOf('#mbCard .bd{'), css.indexOf('}', css.indexOf('#mbCard .bd{')));
  assert.match(bdCss, /overscroll-behavior:contain/, '본문 끝에서 바깥 목록까지 연쇄 스크롤되는 것을 막아야 한다');
});

function makeSpamDialogSandbox(items, lists, mailTree, opt) {
  const o = opt || {};
  const a = HTML.indexOf('const CARD_SPAM_AUTO_MAX');
  const h = HTML.indexOf('\nfunction cspHtml(', a);
  const b = HTML.indexOf('\n}\n', h) + 3;
  const boxes = [];
  const peekCalls = [];
  const escHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const getPath = (tree, p) => p.split('/').filter(Boolean).reduce((cur, k) => (cur && typeof cur === 'object' ? cur[k] : undefined), tree);
  const mailDb = mailTree ? {
    ref: (p) => {
      const valAt = () => {
        const v = getPath(mailTree, p);
        return v === undefined ? null : v;
      };
      return {
        once: async () => ({ val: valAt }),
        orderByKey: () => ({ limitToLast: () => ({ once: async () => ({ val: valAt }) }) }),
        orderByChild: () => ({
          startAt: () => ({ endAt: () => ({ once: async () => ({ val: valAt }) }) }),
        }),
      };
    },
  } : null;

  const db = {
    ref: (p) => ({
      limitToLast: () => ({ once: async () => ({ val: () => (lists || {})[p.split('/').pop()] || null }) }),
      once: async () => ({ val: () => (lists || {})[p.split('/').pop()] || null }),
      orderByChild: () => ({ equalTo: () => ({ on: () => {} }) }),
      set: async () => {},
      update: async () => {},
    }),
  };
  const Store = { mode: 'firebase', db, mailDb, _itemsReady: true, del: async (id) => { delete state.items[id]; } };
  const state = {
    items,
    groups: { g1: { id: 'g1', name: '📬 메일에서 온 명함', kind: 'card' } },
    isAdmin: true,
  };
  let boxEl = null;
  const doc = {
    addEventListener() {},
    querySelector: () => null,
    createElement: () => { boxEl = { innerHTML: '' }; boxes.push(boxEl); return boxEl; },
    body: {
      appendChild() {},
      classList: { contains: (c) => (c === 'pc' ? !o.phone : false) },
    },
  };
  const deps = {
    state, Store, DB_ROOT: 'pucards', inHiddenLocked: () => false, PuCardSpam: S,
    ErpMatch: { match: () => null }, toast() {}, render() {}, renderSoon() {}, myEmail: 'admin@gana.example',
    $: (id) => (id === 'cspBox' ? boxEl : null), document: doc, esc: escHtml, confirm: () => true, setTimeout: () => 0,
    delMany: async () => ({ ok: 0, fail: 0, why: '' }),
    mbFetchBody: (slug, uid, peek) => {
      peekCalls.push({ slug, uid, peek });
      if (o.fetchGone) return Promise.reject(new Error('다음메일에서 지웠거나 다른 칸으로 옮긴 메일입니다'));
      return Promise.resolve(o.fetchedBody || { text: '실제 메일 전체 본문입니다.\n검토 부탁드립니다.', html: '', atts: [{ name: '소개서.pdf' }] });
    },
    mbBodyGet: () => null,
  };
  const names = Object.keys(deps);
  const runner = new Function(...names, HTML.slice(a, b) + '\nreturn { cardSpamRun, cspOpen, cspToggle, cspRows, html: () => (cspHtml()) };');
  const api = runner(...names.map((k) => deps[k]));
  return Object.assign(api, { boxes, peekCalls, boxHtml: () => (boxEl && boxEl.innerHTML) || '' });
}

test('★★★ ② 스팸 의심(#cspBox) — 원본 메일이 삭제되었으면 「🗑 삭제됨 · 원본 메일이 삭제되었습니다」를 분명히 표시하고 수집 기록을 복원한다', async () => {
  const items = {
    c1: { id: 'c1', kind: 'card', capturedBy: '메일', group: 'g1', name: 'Zuma Tester', email: 'test@xinli.example', createdAt: 1795070000000 },
  };
  const lists = {
    q: {
      'INBOX-a1b2c3d4_881': {
        st: 'done',
        card: 'c1',
        e: 'test@xinli.example',
        n: 'Zuma Tester',
        s: 'Hello business cooperation <script>x</script>',
        sig: 'Best regards,\nZuma Tester\nXinli Trading',
        d: 1795069000000,
      },
    },
  };
  const mailTree = {
    mailbox: {
      folders: {
        'INBOX-a1b2c3d4': { kind: 'inbox', name: '받은메일함', path: 'INBOX' },
        'Trash-deadbeef': { kind: 'trash', name: '휴지통', path: 'Trash' },
      },
      msgs: {
        'INBOX-a1b2c3d4': {},
        'Trash-deadbeef': {},
      },
    },
  };
  const c = makeSpamDialogSandbox(items, lists, mailTree);
  await c.cardSpamRun();
  await wait(40);
  const h = c.boxHtml();
  assert.match(h, /🗑 삭제됨/, '원본 메일이 삭제되었는데 줄에 🗑 삭제됨 배지가 없다');
  assert.match(h, /원본 메일이 삭제되었습니다/, '상세 패널에 원본 메일 삭제 안내가 없다');
  assert.match(h, /Hello business cooperation &lt;script&gt;x&lt;\/script&gt;/, '복원한 메일 제목이 이스케이프되어 보여야 한다');
  assert.ok(!/<script>x<\/script>/.test(h), '메일 제목의 스크립트 태그가 그대로 들어가면 안 된다');
  assert.match(h, /Xinli Trading/, '수집 당시 남겨 둔 서명·본문 글자를 보여 줘야 판단할 수 있다');
  assert.match(h, /저장된 상세 정보: <b>없음<\/b>/, '회사·직함·전화가 비어 있음을 분명히 알려야 한다');
});

test('★★★ ②-2 원본 메일도 삭제되고 서명 기록도 전혀 없는 명함은 본문이 삭제되어 남아 있지 않음을 명시한다', async () => {
  const items = {
    c2: { id: 'c2', kind: 'card', capturedBy: '메일', group: 'g1', name: 'Unknown Sender', email: 'empty@gone.example', createdAt: 1795070000000 },
  };
  const mailTree = {
    mailbox: {
      folders: {
        'INBOX-a1b2c3d4': { kind: 'inbox', name: '받은메일함', path: 'INBOX' },
        'Trash-deadbeef': { kind: 'trash', name: '휴지통', path: 'Trash' },
      },
      msgs: { 'INBOX-a1b2c3d4': {}, 'Trash-deadbeef': {} },
    },
  };
  const c = makeSpamDialogSandbox(items, {}, mailTree);
  await c.cardSpamRun();
  await wait(40);
  const h = c.boxHtml();
  assert.match(h, /🗑 삭제됨/);
  assert.match(h, /원본 메일 내용이 삭제되어 메일함·휴지통 어디에도 본문이 남아 있지 않습니다/);
});

test('★★ ②-3 휴지통에 있는 메일은 「🗑 휴지통」, 보관 중인 메일은 「📩 받은메일함」과 본문(peek=true)을 보여 준다', async () => {
  const items = {
    cTrash: { id: 'cTrash', kind: 'card', capturedBy: '메일', group: 'g1', name: '영업지원팀장', email: 'park@promo.example', createdAt: 1795070000000 },
    cLive:  { id: 'cLive',  kind: 'card', capturedBy: '메일', group: 'g1', name: 'Alex Choi', email: 'choi@inquiry.example', createdAt: 1795075000000 },
  };
  const mailTree = {
    mailbox: {
      folders: {
        'INBOX-a1b2c3d4': { kind: 'inbox', name: '받은메일함', path: 'INBOX' },
        'Trash-deadbeef': { kind: 'trash', name: '휴지통', path: 'Trash' },
      },
      msgs: {
        'INBOX-a1b2c3d4': {
          501: { e: 'choi@inquiry.example', f: '최문의', s: '자문 견적 문의드립니다', p: '안녕하세요 자문 문의합니다', d: 1795075000000 },
        },
        'Trash-deadbeef': {
          301: { e: 'park@promo.example', f: '박영업', s: '[광고] 판촉물 안내', p: '판촉물 카탈로그입니다', d: 1795070000000 },
        },
      },
    },
  };
  const c = makeSpamDialogSandbox(items, {}, mailTree);
  await c.cardSpamRun();
  await wait(40);
  const h = c.boxHtml();
  assert.match(h, /🗑 휴지통/, '휴지통으로 지워진 메일 표시가 없다');
  assert.match(h, /휴지통으로 삭제된 메일입니다/);
  assert.match(h, /📩 받은메일함/, '보관 중인 메일의 폴더 표시가 없다');
  assert.match(h, /실제 메일 전체 본문입니다/, '보관 중인 메일의 본문이 표시되어야 한다');
  assert.ok(c.peekCalls.length >= 1 && c.peekCalls.every((x) => x.peek === true), '★★★ 스팸 의심 내용 보기가 읽음 표시를 건드리면 안 된다(peek=true 필수)');
});

test('★ ②-4 본문 조회(peek) 중 다음메일에서 방금 지워진 메일(gone/404)로 판명되면 즉시 「🗑 삭제됨」으로 바뀐다', async () => {
  const items = {
    cGone: { id: 'cGone', kind: 'card', capturedBy: '메일', group: 'g1', name: 'Alex Gone', email: 'alex@gone-now.example', createdAt: 1795075000000 },
  };
  const mailTree = {
    mailbox: {
      folders: { 'INBOX-a1b2c3d4': { kind: 'inbox', name: '받은메일함', path: 'INBOX' } },
      msgs: {
        'INBOX-a1b2c3d4': {
          777: { e: 'alex@gone-now.example', f: 'Alex Gone', s: '방금 지운 메일', p: '', d: 1795075000000 },
        },
      },
    },
  };
  const c = makeSpamDialogSandbox(items, {}, mailTree, { fetchGone: true });
  await c.cardSpamRun();
  await wait(40);
  const h = c.boxHtml();
  assert.match(h, /🗑 삭제됨/, 'peek 조회에서 삭제된 메일로 판명되면 즉시 🗑 삭제됨으로 바뀌어야 한다');
  assert.match(h, /다음메일에서 삭제되어 원본 메일이 남아 있지 않습니다/);
});
