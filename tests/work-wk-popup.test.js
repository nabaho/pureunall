'use strict';
/* 주간 칸 — «크게 쓰기» 창 · «긴 기록 전체 보기» 창   node --test tests/work-wk-popup.test.js

   대표 지시 2026-10-17 「기록을 넣을 때 화면이 너무 작다 — 팝업처럼 창이 열려서 직접 내용을 넣을 수 있나 /
   메일로 들어온 내용이 너무 길게 내려가면 안 보인다 — 클릭하면 팝업으로 전체 내용을 볼 수 있나」
   → 목업 6안 중 «추천대로» = ① 가(칸 옆 ⤢ → 가운데 창) + ② 가(칸 안은 한 줄 + …, 누르면 전체 창)

   ★ 지키는 것
     · 한 줄 입력(Enter 저장)은 그대로 — 크게 쓰는 길을 «덧붙일» 뿐이다
     · 창에서 저장해도 같은 길(wkSave)을 지난다 — 오늘 이후 날짜면 «할 일»이 되는 규칙 그대로
     · 칸의 기록은 «한 줄 + …» — 전체는 창에서. 창에는 «보여 줄 수 있는 것만» 적는다
       (메일 본문 전체는 업무관리에 없다 — 미리보기까지, 본문은 푸른메일함)
   예시 이름은 늘 가나상사·홍길동 (실제 고객 이름을 쓰지 않는다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CSS = W.slice(W.indexOf('<style>'), W.indexOf('</style>'));
const rule = (sel) => {            /* 선택자 «그대로» 시작하는 규칙 한 덩이(중괄호 안) */
  const i = CSS.indexOf(sel + '{'); if (i < 0) return null;
  return CSS.slice(i, CSS.indexOf('}', i) + 1);
};

const TODAY = '2026-10-14';                         /* 수요일 */
const WEEK = '2026-W42';
const FNS = ['wkLgBox', 'wkBigOpen', 'wkBigDay', 'wkBigHint', 'wkBigKey', 'wkBigSave',
  'wkLogFind', 'wkLogOpen', 'wkLogMail', 'isPlanDay', 'md', '_ime', 'mailKey', '_mailWhen'];

function box(o) {
  o = o || {};
  const ELS = {}, rec = { modal: [], closed: 0, toasts: [], saved: [], routed: 0 };
  const b = { String, Number, Object, Array, Date, Promise, JSON, RegExp, Math, isNaN, console,
    ELS, rec,
    items: o.items || { W1: { _id: 'W1', company: '가나상사', cat: '자문', title: '기본 자문', co_id: 'C1' } },
    S: { week: new Date('2026-10-12T00:00:00'), me: { sid: 'P-001', name: '권형하' } },
    wkCache: o.wkCache || {}, itemLogsCache: o.itemLogsCache || {},
    mailSrc: o.mailSrc === undefined ? [] : o.mailSrc,
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    escJ: (x) => String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    todayStr: () => TODAY,
    isCurWeek: () => o.curWeek !== false,
    ymd: (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    addDays: (d, n) => new Date(d.getTime() + n * 86400000),
    weekKeyOf: () => WEEK,
    catBadge: (c) => '<span class="badge">' + c + '</span>',
    itemName: (it) => it.title || '',
    canLog: (l) => !!l && l.by === 'P-001',
    toast: (m, t) => rec.toasts.push([String(m), t || '']),
    route: () => { rec.routed++; },
    closeM: () => { rec.closed++; },
    editLog: () => {}, delLog: () => {}, mbGo: () => {}, mbCoId: () => 'C1',
    mailLoad: () => { rec.mailLoaded = true; b.mailSrc = o.mailAfterLoad || []; return Promise.resolve(b.mailSrc); },
    wkSave: (id, t, d) => { rec.saved.push([id, t, d]); return Promise.resolve(o.saveOk !== false); },
    /* 창을 «그린 것처럼» — 글 속에서 칸 몇 개를 만들어 두면 $(id) 로 집을 수 있다 */
    $: (id) => ELS[id] || null,
    showModal: (html) => {
      rec.modal.push(html);
      Object.keys(ELS).forEach((k) => delete ELS[k]);
      const ta = /<textarea id="wkb-t"[^>]*>([\s\S]*?)<\/textarea>/.exec(html);
      if (ta) {
        ELS['wkb-t'] = { value: ta[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
          focus() {}, setSelectionRange() {} };
        ELS['wkb-d'] = { value: (/id="wkb-d" value="([^"]*)"/.exec(html) || [])[1] || '' };
        ELS['wkb-msg'] = { textContent: '' };
        ELS['wkb-save'] = { disabled: false };
      }
      if (html.indexOf('id="wkl-mail"') > 0) ELS['wkl-mail'] = { innerHTML: '' };
    },
    setTimeout: () => 0,
  };
  b.window = b;
  vm.createContext(b);
  vm.runInContext(W.match(/var WK_BIG_BTN='.*?';\n/)[0] + '\n' + FNS.map((n) => sliceFn(W, 'function ' + n + '(')).join('\n'), b);
  return b;
}
const inpOf = (o) => {
  const inp = { value: (o && o.value) || '', getAttribute: (n) => ({ 'data-id': (o && o.id) || 'W1', 'data-d': o && o.day }[n] || null) };
  inp.parentNode = { querySelector: () => inp };
  return inp;
};
const tick = () => new Promise((r) => setImmediate(r));

/* ══════════════════════════════════════════════
   ① 크게 쓰기 창
   ══════════════════════════════════════════════ */
test('★★ ⤢ 를 누르면 창이 열리고, 칸에서 쓰던 글이 그대로 옮겨 간다', () => {
  const b = box(); const inp = inpOf({ day: '2026-10-13', value: '쓰던 <글> & "줄"' });
  b.wkBigOpen(inp);
  const h = b.rec.modal[0];
  assert.match(h, /<textarea id="wkb-t"/);
  assert.equal(b.ELS['wkb-t'].value, '쓰던 <글> & "줄"', '쓰던 글이 안 따라왔거나 이스케이프가 어긋났다');
  assert.ok(h.indexOf('<글>') < 0, '입력 글자가 그대로 태그로 들어갔다');
  assert.match(h, /가나상사/);
  assert.match(h, /Ctrl\+Enter/);
});

test('★★ 날짜는 누른 칸의 요일이 기본 — 오늘 단추도 함께', () => {
  const b = box(); b.wkBigOpen(inpOf({ day: '2026-10-13' }));
  assert.equal(b.ELS['wkb-d'].value, '2026-10-13');
  assert.match(b.rec.modal[0], /wkBigDay\('2026-10-14'\)/, '«오늘» 단추가 없다');
  assert.match(b.rec.modal[0], /10\/13 \(화\)/);
});

test('★ 요일 없는 «한 칸 보기»는 오늘(wkKey 와 같은 셈), 지난 주는 그 주 금요일', () => {
  assert.equal((() => { const b = box(); b.wkBigOpen(inpOf({})); return b.ELS['wkb-d'].value; })(), TODAY);
  assert.equal((() => { const b = box({ curWeek: false }); b.wkBigOpen(inpOf({})); return b.ELS['wkb-d'].value; })(), '2026-10-16');
});

test('★ 오늘 이후 날짜면 «할 일»로 저장된다고 저장 «전에» 알려 준다 — 지금 규칙(isPlanDay)과 같다', () => {
  const b = box(); b.wkBigOpen(inpOf({ day: '2026-10-13' }));
  assert.equal(b.ELS['wkb-msg'].textContent, '', '과거 날짜인데 안내가 뜬다');
  b.wkBigDay('2026-10-20');
  assert.match(b.ELS['wkb-msg'].textContent, /할 일/);
  b.wkBigDay(TODAY);
  assert.equal(b.ELS['wkb-msg'].textContent, '', '오늘은 기록이다');
});

test('★★★ 저장은 한 줄 입력과 «같은 길»(wkSave) — 여러 줄도 앞뒤만 다듬어 그대로, 날짜는 창에서 고른 것', async () => {
  const b = box(); b.wkBigOpen(inpOf({ day: '2026-10-13' }));
  b.ELS['wkb-t'].value = '  첫 줄\n둘째 줄  '; b.ELS['wkb-d'].value = '2026-10-15';
  b.wkBigSave(); await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(b.rec.saved)), [['W1', '첫 줄\n둘째 줄', '2026-10-15']]);
  assert.equal(b.rec.closed, 1, '저장했는데 창이 안 닫혔다');
  assert.equal(b.rec.routed, 1, '표를 다시 그리지 않았다');
  assert.ok(b.rec.toasts.some((t) => /10\/15/.test(t[0])), '다른 날에 저장했다는 알림이 없다 — 칸에서 사라진 줄 안다');
});

test('★ 코드로도 — 저장 길을 새로 만들지 않는다(addLog·planAdd 를 직접 부르지 않는다)', () => {
  const s = code(sliceFn(W, 'function wkBigSave('));
  assert.match(s, /wkSave\(b\.id,t,d\)/);
  assert.ok(!/addLog\(|planAdd\(/.test(s), '저장 길이 두 갈래가 됐다 — 오늘 이후 날짜의 «할 일» 규칙이 어긋난다');
});

test('★★ 빈 글·잘못된 날짜는 저장하지 않고 창에서 말해 준다', async () => {
  const b = box(); b.wkBigOpen(inpOf({ day: '2026-10-13' }));
  b.ELS['wkb-t'].value = '   '; b.wkBigSave(); await tick();
  assert.equal(b.rec.saved.length, 0); assert.match(b.ELS['wkb-msg'].textContent, /내용/);
  b.ELS['wkb-t'].value = '글'; b.ELS['wkb-d'].value = ''; b.wkBigSave(); await tick();
  assert.equal(b.rec.saved.length, 0); assert.match(b.ELS['wkb-msg'].textContent, /날짜/);
  assert.equal(b.rec.closed, 0);
});

test('★★★ 저장이 실패하면 창을 «닫지 않는다» — 길게 쓴 글을 잃으면 안 된다', async () => {
  const b = box({ saveOk: false }); b.wkBigOpen(inpOf({ day: '2026-10-13' }));
  b.ELS['wkb-t'].value = '길게 쓴 글'; b.wkBigSave(); await tick();
  assert.equal(b.rec.closed, 0, '실패했는데 창이 닫혔다');
  assert.equal(b.ELS['wkb-t'].value, '길게 쓴 글');
  assert.match(b.ELS['wkb-msg'].textContent, /저장하지 못했습니다/);
  assert.equal(b.ELS['wkb-save'].disabled, false, '다시 누를 수 있어야 한다');
});

test('★ 저장하는 동안 단추를 잠근다 — 두 번 눌러도 한 줄만', () => {
  const b = box(); b.wkBigOpen(inpOf({ day: '2026-10-13' }));
  b.ELS['wkb-t'].value = '글'; b.wkBigSave();
  assert.equal(b.ELS['wkb-save'].disabled, true);
});

test('★ Ctrl+Enter 로 저장, 그냥 Enter 는 줄바꿈(저장 아님), 한글 조합 중에는 아무 일 없다', () => {
  const b = box(); b.wkBigOpen(inpOf({ day: '2026-10-13' })); b.ELS['wkb-t'].value = '글';
  const ev = (o) => Object.assign({ key: 'Enter', preventDefault() { ev.pd = true; } }, o);
  b.wkBigKey(ev({})); assert.equal(b.rec.saved.length, 0, 'Enter 만으로 저장됐다 — 여러 줄을 못 쓴다');
  b.wkBigKey(ev({ ctrlKey: true, isComposing: true })); assert.equal(b.rec.saved.length, 0, '한글 조합 중 저장됐다');
  b.wkBigKey(ev({ ctrlKey: true })); assert.equal(b.rec.saved.length, 1);
});

/* ══════════════════════════════════════════════
   ② 긴 기록 전체 보기 창
   ══════════════════════════════════════════════ */
const LOG = (x) => Object.assign({ d: '2026-10-13', t: '긴 글\n둘째 줄', by: 'P-001', byName: '권형하', at: '2026-10-13T01:02:03Z' }, x);
const withLog = (l, extra) => box(Object.assign({ wkCache: { [WEEK]: { W1: { L1: l } } } }, extra));

test('★★ 내 기록 — 전체 글이 줄바꿈 그대로 보이고 고치기·지우기가 있다', () => {
  const b = withLog(LOG()); b.wkLogOpen('W1', 'L1');
  const h = b.rec.modal[0];
  assert.match(h, /white-space:pre-wrap/, '줄바꿈이 사라진다');
  assert.match(h, /긴 글\n둘째 줄/);
  assert.match(h, /editLog\('W1','L1'\)/); assert.match(h, /delLog\('W1','L1'\)/);
  assert.ok(h.indexOf('wkl-mail') < 0, '메일이 아닌데 메일 칸이 있다');
});

test('★★ 남의 기록 — 고치기·지우기를 안 낸다(칸의 ✎ ✕ 와 같은 권한)', () => {
  const b = withLog(LOG({ by: 'P-009', byName: '김혜민' })); b.wkLogOpen('W1', 'L1');
  assert.ok(!/editLog\(|delLog\(/.test(b.rec.modal[0]));
});

test('★★★ 받은 메일 줄 — 제목·보낸이·받은 시각·미리보기·푸른메일함 열기, 그리고 «본문은 메일함»이라고 적는다', () => {
  const m = { _k: 'K1', subject: '<b>출산휴가</b> 선정안내', from: '인사팀 <hr@example.co.kr>', at: Date.UTC(2026, 9, 12, 0, 41), preview: '안녕하십니까 인사팀입니다', atts: 2 };
  const b = withLog(LOG({ auto: 1, sourceKind: 'mail', sourceId: 'K1', t: '✉ 10.12 메일 — 선정안내 · 같은 회사 업무 3건에 함께' }), { mailSrc: [m] });
  b.wkLogOpen('W1', 'L1');
  assert.match(b.rec.modal[0], /mbGo\(mbCoId\(items\['W1'\]\)\)/, '푸른메일함으로 가는 단추가 없다');
  const h = b.ELS['wkl-mail'].innerHTML;
  assert.match(h, /&lt;b&gt;출산휴가&lt;\/b&gt;/, '제목을 이스케이프하지 않았다');
  assert.match(h, /hr@example\.co\.kr/); assert.match(h, /미리보기/); assert.match(h, /안녕하십니까/);
  assert.match(h, /첨부 2개/); assert.match(h, /본문 전체는 푸른메일함/);
});

test('★★ 수집함에서 못 찾는 옛 메일 — 없는 내용을 지어내지 않고 «못 찾았다»고 말한다', () => {
  const b = withLog(LOG({ auto: 1, sourceKind: 'mail', sourceId: 'GONE' }), { mailSrc: [{ _k: 'K1', at: 1 }] });
  b.wkLogOpen('W1', 'L1');
  assert.match(b.ELS['wkl-mail'].innerHTML, /찾지 못했습니다/);
});

test('★ 수집함을 아직 안 읽었으면 읽은 뒤에 채운다', async () => {
  const m = { _k: 'K1', subject: '늦게 온 메일', from: 'a@x.kr', at: Date.UTC(2026, 9, 12), preview: '앞' };
  const b = withLog(LOG({ auto: 1, sourceKind: 'mail', sourceId: 'K1' }), { mailSrc: null, mailAfterLoad: [m] });
  b.wkLogOpen('W1', 'L1');
  assert.match(b.ELS['wkl-mail'].innerHTML, /불러오는 중/);
  await tick(); await tick();
  assert.equal(b.rec.mailLoaded, true);
  assert.match(b.ELS['wkl-mail'].innerHTML, /늦게 온 메일/);
});

test('★ 일정으로 들어온 자동 줄 — 메일 칸·메일함 단추 없이 글만(없는 것을 보여 주지 않는다)', () => {
  const b = withLog(LOG({ auto: 1, sourceKind: 'gcal', sourceId: 'G1', t: '1000 현장 방문 · 같은 회사 업무 2건에 함께' }));
  b.wkLogOpen('W1', 'L1');
  const h = b.rec.modal[0];
  assert.ok(h.indexOf('wkl-mail') < 0 && h.indexOf('mbGo(') < 0);
  assert.match(h, /일정/); assert.match(h, /1000 현장 방문/);
});

test('★ 업무 이름에 태그가 들어 있어도 창에서 글자로만 나온다', () => {
  const b = withLog(LOG(), { items: { W1: { _id: 'W1', company: '<img src=x onerror=alert(1)>', cat: '자문' } } });
  b.wkLogOpen('W1', 'L1');
  assert.ok(b.rec.modal[0].indexOf('<img') < 0, '업무 이름이 태그로 들어갔다');
});

test('★ 없는 기록·없는 업무는 말해 주고 창을 안 연다', () => {
  const b = box(); b.wkLogOpen('W1', 'NONE');
  assert.equal(b.rec.modal.length, 0); assert.ok(b.rec.toasts.some((t) => t[1] === 'warn'));
});

test('기록은 이 주 표에서 먼저, 없으면 업무별 기록에서 찾는다', () => {
  const b = box({ itemLogsCache: { W1: { L9: LOG({ t: '업무별에만 있는 글' }) } } });
  b.wkLogOpen('W1', 'L9');
  assert.match(b.rec.modal[0], /업무별에만 있는 글/);
});

/* ══════════════════════════════════════════════
   칸의 모양 — 한 줄 + … · 단추 · 줄바꿈 (소스 규칙)
   ══════════════════════════════════════════════ */
test('★★ 칸의 기록은 «한 줄 + …» — 글자 단위 줄바꿈(break-all)으로 내려가지 않는다', () => {
  const r = rule('.wkc .wklog') || '';
  assert.match(r, /white-space:nowrap/); assert.match(r, /text-overflow:ellipsis/); assert.match(r, /overflow:hidden/);
  assert.ok(!/break-all/.test(r), '다시 글자 단위로 줄바꿈된다');
  assert.match(r, /cursor:pointer/, '눌러진다는 표시가 없다');
});

test('★ ✎ ✕ 는 글자 «위에» 겹쳐 뜬다 — 자리를 먹으면 한 줄이 더 짧아진다', () => {
  const r = rule('.wkc .wklog .lgbox') || '';
  assert.match(r, /position:absolute/); assert.match(r, /display:none/);
  assert.match(CSS, /\.wkc \.wklog:hover \.lgbox\{display:inline-flex\}/);
});

test('★ ⤢ 는 마우스를 올리거나 칸에 들어갔을 때 보이고, 터치 화면에서는 늘 보인다', () => {
  assert.match(rule('.wkbig') || '', /opacity:0/);
  assert.match(CSS, /\.wkinw:hover \.wkbig,\.wkinw:focus-within \.wkbig\{opacity:1\}/);
  assert.match(CSS, /@media \(hover:none\)\{ \.wkbig\{opacity:1\} \}/);
});

test('★ ⤢ 를 눌러도 칸·줄의 다른 동작(요일 고르기 등)으로 번지지 않는다', () => {
  assert.match(W.match(/var WK_BIG_BTN='.*?';/)[0], /event\.stopPropagation\(\);wkBigOpen\(this\)/);
});

test('★ 요일 칸·한 칸 보기 둘 다 ⤢ 와 «눌러서 전체 보기»가 달려 있고, 한 줄 입력은 그대로다', () => {
  const cell = code(sliceFn(W, 'function wkCellHTML('));
  assert.match(cell, /\+WK_BIG_BTN\+/); assert.match(cell, /onkeydown=\\"wkKey\(event,this\)\\"|onkeydown="wkKey\(event,this\)"/);
  assert.match(cell, /wkLogOpen\(\\''\+escJ\(it\._id\)\+'\\',\\''\+escJ\(l\._id\|\|''\)\+'\\'\)/);
  assert.match(cell, /title="'\+esc\(l\.t\)\+/, '칸에서 줄여진 글의 전문이 title 에 없다');
  assert.match(cell, /wkLgBox\(it\._id,l\)/);
  const row = code(sliceFn(W, 'function rowHTML('));
  assert.match(row, /\+WK_BIG_BTN\+/); assert.match(row, /wkLogOpen\(/);
});

test('★ 서랍의 기록 목록은 줄바꿈을 보인다 — 여러 줄로 쓰게 됐으므로', () => {
  assert.match(rule('.fe .tx') || '', /white-space:pre-line/);
});

test('wkLgBox — 권한이 없어 ✎ ✕ 가 비면 상자도 안 만든다', () => {
  const b = box(); b.logBtns = (id, l) => (l.by === 'P-001' ? '<BTN>' : '');
  assert.equal(b.wkLgBox('W1', { by: 'P-009' }), '');
  assert.equal(b.wkLgBox('W1', { by: 'P-001' }), '<span class="lgbox"><BTN></span>');
});
