'use strict';
/* 건의한 본인은 로그인하면 «해결됐는지 반드시 확인» 하라는 경고를 본다 (대표 지시 2026-11-18)

   ■ 무엇이 문제였나
     건의가 «완료» 로 처리돼도 건의자 본인이 ☑ 해결됐어요 를 눌러야 최종 확정이다. 그런데 로그인 때 뜨는 창은
     「🎉 해결되었습니다」 축하 창이었고, 첫 칸이 「나중에 확인」이라 Enter 한 번에 넘어갔고, 넘기면 아무 표시도 남지 않았다.
     → 확인을 안 하고 지나가는 건이 쌓였다.

   ■ 지킬 것 (값이 아니라 «규칙»)
     ① 확인 창은 «경고»다 — 머리가 ⚠ 이고 «반드시 확인» 문구가 있다(축하 🎉 가 아니다)
     ② 로그인 직후 이 확인이 가장 먼저 — 관리자 «처리할 건의» 팝업은 확인 창이 닫힌 뒤에 뜬다
     ③ 확인하기 전에는 «건의하기» 단추에 ⚠ 표시가 남는다(나중에 확인으로 넘겨도) — 다 확인하면 거둔다
     ④ 건의함 안쪽(직원 홈·관리자 목록)에도 «지금 확인하기» 경고 띠가 있어 다시 확인하러 갈 수 있다
     ⑤ 첫 칸은 ☑ 해결됐어요 — 넘기는 단추가 아니다
     ⑥ 단추는 떠 있게 하지 않는다(공용 앱바 규칙) · 움직임을 줄이는 설정을 따른다

   실행: node --test tests/suggestion-login-confirm.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').split('\r\n').join('\n');

function between(a, b, from) {
  const i = src.indexOf(a, from || 0);
  assert.ok(i >= 0, a + ' 를 찾지 못했습니다');
  const j = src.indexOf(b, i + a.length);
  assert.ok(j > i, b + ' 를 찾지 못했습니다');
  return src.slice(i, j);
}

test('★ ① 확인 창은 경고다 — 머리가 ⚠ 이고 «반드시 확인» 문구가 있다', () => {
  const modal = between('<div id="sgDoneModal"', '</div>\n</div>');
  assert.match(modal, /class="hd warn"[^>]*>\s*⚠/, '★ 머리가 경고(⚠)가 아닙니다');
  assert.ok(!/🎉/.test(modal), '★ 축하(🎉) 머리가 남아 있습니다 — 경고여야 합니다');
  assert.match(modal, /id="sgDoneWarn"[^>]*role="alert"/, '★ 경고 상자(role=alert)가 없습니다');
  const fn = between('function sgCheckResolved(', "$('sgDoneOk').onclick");
  assert.match(fn, /<b>반드시 확인<\/b>/, '★ 「반드시 확인」 문구가 없습니다');
  assert.match(fn, /최종 종료/, '왜 확인해야 하는지(확인해야 최종 종료)를 말해 주지 않습니다');
});

test('★ ② 로그인 직후 확인 창이 먼저 — 관리자 처리할 건의 팝업은 그 뒤', () => {
  const body = between('window.sgSetUser = function', 'function sgShowTip');
  const iRes = body.indexOf('sgCheckResolved(');
  assert.ok(iRes > 0, 'sgSetUser 가 해결 확인을 부르지 않습니다');
  /* 관리자 팝업 호출은 «확인 창이 끝난 뒤 불리는 함수 안» 에 있어야 한다 — sgCheckResolved( 의 인자 */
  const end = body.indexOf('\n', iRes);
  const call = body.slice(iRes, end);
  assert.match(call, /sgCheckResolved\(function\(\)\{[^}]*sgCheckPending\(\)/, '★ 처리할 건의 팝업이 확인 창이 닫힌 뒤에 뜨지 않습니다');
  /* 확인 창과 «나란히»(바깥에서) 또 부르면 두 창이 겹친다 */
  const rest = body.replace(call, '');
  assert.ok(!/sgCheckPending\(\)\s*;/.test(rest.replace(/\/\/[^\n]*/g, '')), '★ 처리할 건의 팝업을 확인 창과 별도로 또 부릅니다 — 두 창이 겹칩니다');
});

/* ── sgCheckResolved 를 «실제로 돌려» 순서·표시를 본다 ── */
function el(id) {
  const o = {
    id, style: {}, _html: '', textContent: '', disabled: false, hidden: false, onclick: null, classList: null, _l: {},
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    addEventListener(ev, cb) { (this._l[ev] = this._l[ev] || []).push(cb); },
    focus() { el.focused = this.id; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    removeAttribute(k) { delete this[k]; },
  };
  const set = new Set();
  o.classList = { add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c), _set: set };
  return o;
}

function world(records) {
  const els = {};
  const $ = (id) => (els[id] = els[id] || el(id));
  const log = [];
  /* 팝업 몸통은 «칸 찾기» 만 흉내 — 첫 ☑ 칸이 있으면 그것을 돌려 주고, 건 한 줄은 «번호마다 같은 줄»을 돌려 준다
     (줄 안의 칸도 이름마다 같은 것 — 눌러 보고 포커스가 어디로 갔는지 볼 수 있게) */
  const rows = {};
  $('sgDoneBody').querySelector = (q) => {
    if (/data-sgd-chk\]/.test(q)) return { focus() { el.focused = 'chk'; } };
    const m = q.match(/data-sgd="(\d+)"/);
    if (!m) return null;
    const k = m[1];
    if (!rows[k]) {
      const cells = {};
      rows[k] = {
        style: {},
        querySelector: (q2) => {
          if (!cells[q2]) {
            const e = el(k + q2);
            e.checked = false;
            e.focus = () => { el.focused = (/data-sgd-chk/.test(q2) ? 'chk' : 'other') + k; };
            cells[q2] = e;
          }
          return cells[q2];
        },
      };
    }
    return rows[k];
  };
  const ctx = {
    $, Array, Object, Math, Date, JSON, console, setTimeout: (fn) => fn(),
    SG: { uid: 'U1', name: 'N', email: 'e@x', role: 'member' },
    sgLoadOwnResolved: () => Promise.resolve(records),
    sgResolvedUidPath: (u) => 'suggestions_resolved_private/' + u,
    sgCatClass: (c) => c || 'etc', sgCatName: (c) => c || '기타', sgEsc: (s) => String(s == null ? '' : s),
    sgImgSrc: (u) => u, sgUpdateBadge: () => log.push('badge'),
    db: { ref: () => ({ update: () => ({ catch() {} }), set: () => ({ catch() {} }), push: () => ({ key: 'k', set: () => Promise.resolve() }) }) },
    SG_PRIVATE_PATH: 'p', SG_META_PRIVATE_PATH: 'm', sgCompress() {}, alert() {},
  };
  /* 진짜 sgSetNeed·sgCheckResolved 를 쓴다 — 단추(sgFab)에 표시가 남는지 본다 */
  const setNeedSrc = between('function sgSetNeed(', 'function sgNeedBannerHtml(');
  /* 함수 «전체»를 그대로 돌린다 — 「나중에 확인」 단추의 동작까지 진짜 코드여야 망가뜨렸을 때 잡힌다 */
  const fnSrc = between('function sgCheckResolved(', 'function sgCatName(');
  vm.createContext(ctx);
  vm.runInContext(setNeedSrc + '\n' + fnSrc, ctx);
  return { ctx, $, log, rows };
}
const tick = () => new Promise((r) => setImmediate(r));

test('★ ② 확인할 건이 있으면 창을 띄우고 «닫힌 뒤» 에야 다음(관리자 팝업)이 불린다', async () => {
  const w = world({ A: { title: 'T', cat: 'erp', status: 'done', reply: '고쳤습니다', at: 1, seen: false } });
  let after = 0;
  w.ctx.sgCheckResolved(() => { after++; });
  await tick(); await tick();
  assert.equal(w.$('sgDoneModal').style.display, 'flex', '★ 확인할 건이 있는데 창이 안 뜹니다');
  assert.equal(after, 0, '★ 창이 떠 있는 동안 다음 팝업이 먼저 불렸습니다 — 확인 창이 묻힙니다');
  w.$('sgDoneOk').onclick();   // 「나중에 확인」
  assert.equal(after, 1, '★ 창을 닫았는데 다음 팝업이 안 불립니다 — 관리자 처리할 건의 알림이 사라집니다');
  w.$('sgDoneOk').onclick();
  assert.equal(after, 1, '다음 팝업이 두 번 불립니다');
});

test('② 확인할 건이 없으면 창 없이 바로 다음으로 넘어간다 · 로그인 전(uid 없음)도 막히지 않는다', async () => {
  const w = world({ A: { title: 'T', status: 'done', seen: true }, B: { title: 'U', status: 'ing', seen: false } });
  let after = 0;
  w.ctx.sgCheckResolved(() => { after++; });
  await tick(); await tick();
  assert.notEqual(w.$('sgDoneModal').style.display, 'flex', '확인할 게 없는데 창이 뜹니다(검토중·이미 확인한 건은 대상이 아닙니다)');
  assert.equal(after, 1, '★ 확인할 게 없는데 다음 팝업이 안 불립니다 — 관리자 알림이 영영 안 뜹니다');
  const w2 = world({}); w2.ctx.SG.uid = '';
  let a2 = 0; w2.ctx.sgCheckResolved(() => { a2++; });
  assert.equal(a2, 1, 'uid 가 없을 때 막힙니다');
});

test('★ ③ 나중에 확인으로 넘겨도 «건의하기» 단추에 ⚠ 가 남는다 · 다 확인하면 거둔다', async () => {
  const w = world({
    A: { title: 'T1', status: 'done', seen: false, at: 1 },
    B: { title: 'T2', status: 'done', seen: false, at: 2 },
    C: { title: 'T3', status: 'ing', seen: false, at: 3 },   // 검토중은 대상이 아니다
  });
  const fab = w.$('sgFab');
  w.ctx.sgCheckResolved();
  await tick(); await tick();
  assert.ok(fab.classList.contains('sg-need'), '★ 확인할 건이 있는데 단추에 경고 표시가 없습니다');
  assert.match(fab.title || '', /2건/, '단추 설명에 확인할 건수(2건 — 검토중 제외)가 없습니다: ' + fab.title);
  w.$('sgDoneOk').onclick();   // 나중에 확인
  assert.ok(fab.classList.contains('sg-need'), '★ 「나중에 확인」으로 넘기자 경고가 사라졌습니다 — 확인 안 한 채 지나갑니다');
  w.ctx.sgSetNeed(0);
  assert.ok(!fab.classList.contains('sg-need'), '다 확인했는데 경고가 남아 있습니다');
  assert.equal(fab.title, undefined, '다 확인했는데 설명이 남아 있습니다');
});

test('⑤ 첫 칸은 ☑ 해결됐어요 — 넘기는 단추가 아니다', async () => {
  const w = world({ A: { title: 'T', status: 'done', seen: false, at: 1 } });
  el.focused = '';
  w.ctx.sgCheckResolved();
  await tick(); await tick();
  assert.equal(el.focused, 'chk', '★ 첫 칸이 ☑ 해결됐어요 가 아닙니다 (' + el.focused + ') — Enter 한 번에 그냥 넘어갑니다');
});

/* 한 건을 확인(☑ → 완료)한다 — 줄 안의 칸을 눌러 본다 */
function confirmRow(w, i) {
  const row = w.rows[String(i)];
  row.querySelector('[data-sgd-chk="' + i + '"]').checked = true;
  row.querySelector('[data-sgd-ok="' + i + '"]')._l.click[0]();
}

test('★ 여러 건 중 한 건을 확인하면 남은 수로 경고가 바뀌고 포커스는 다음 ☑ 칸으로 간다 · 다 하면 닫힌다', async () => {
  const w = world({
    A: { title: 'T1', status: 'done', seen: false, at: 1 },
    B: { title: 'T2', status: 'done', seen: false, at: 2 },
  });
  const fab = w.$('sgFab');
  let after = 0;
  w.ctx.sgCheckResolved(() => { after++; });
  await tick(); await tick();
  el.focused = '';
  confirmRow(w, 0);
  assert.equal(w.$('sgDoneModal').style.display, 'flex', '한 건 남았는데 창이 닫혔습니다');
  assert.match(w.$('sgDoneWarn').innerHTML, /<b>1건<\/b>/, '★ 경고 문구의 건수가 남은 수(1건)로 안 바뀝니다');
  assert.match(fab.title, /1건/, '단추 설명의 건수가 남은 수로 안 바뀝니다');
  assert.ok(fab.classList.contains('sg-need'), '한 건 남았는데 단추 경고가 꺼졌습니다');
  assert.equal(el.focused, 'chk1', '★ 확인한 뒤 포커스가 다음 건의 ☑ 칸으로 안 갑니다(' + el.focused + ') — 키보드 사용자가 길을 잃습니다');
  assert.equal(after, 0, '아직 남았는데 다음 팝업이 불렸습니다');
  confirmRow(w, 1);
  assert.equal(w.$('sgDoneModal').style.display, 'none', '다 확인했는데 창이 안 닫힙니다');
  assert.ok(!fab.classList.contains('sg-need'), '★ 다 확인했는데 단추 경고가 남아 있습니다');
  assert.equal(after, 1, '다 확인한 뒤 다음 팝업이 안 불립니다');
});

test('★ 관리자도 «내 건의 확인 대기» 수로 단추 경고를 맞춘다 (숫자 배지는 미처리 수 그대로)', async () => {
  const code = between('function sgUpdateBadge(', '// ══════════ 새 건의 폰 알림');
  const calls = [];
  const snap = { forEach: (cb) => [{ val: () => ({ status: 'new' }) }, { val: () => ({ status: 'done' }) }].forEach(cb) };
  const ctx = {
    Object, Promise,
    SG: { email: 'e', uid: 'U' },
    sgIsAdmin: () => true,
    sgEnsurePrivateMigration: () => Promise.resolve(),
    db: { ref: () => ({ once: () => Promise.resolve(snap) }) },
    SG_META_PRIVATE_PATH: 'm',
    sgSetBadge: (n) => calls.push('badge:' + n),
    sgSetNeed: (n) => calls.push('need:' + n),
    sgLoadOwnResolved: () => Promise.resolve({ a: { status: 'done', seen: false }, b: { status: 'done', seen: true }, c: { status: 'ing', seen: false }, d: { seen: false } }),
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  ctx.sgUpdateBadge();
  await tick(); await tick(); await tick();
  assert.ok(calls.includes('badge:1'), '관리자 숫자 배지(미처리 수)가 달라졌습니다: ' + calls);
  /* a(완료·미확인) + d(status 없는 옛 기록=완료·미확인) = 2 — 이미 확인한 b·검토중 c 는 세지 않는다 */
  assert.ok(calls.includes('need:2'), '★ 관리자 단추의 ⚠ 가 «내 건의 확인 대기» 수(2)로 안 맞춰집니다: ' + calls);
});

test('긴 제목·답변(공백 없는 글자)이 팝업 옆으로 넘치지 않는다', () => {
  assert.match(src, /\.sgd-t\{[^}]*overflow-wrap:anywhere/, '건의 제목이 길면 팝업이 옆으로 넘칩니다');
  assert.match(src, /\.sgd-r\{[^}]*overflow-wrap:anywhere/, '답변이 길면 팝업이 옆으로 넘칩니다');
});

test('경고 띠의 「지금 확인하기」는 눌러 쓰기 편한 높이다', () => {
  const m = src.match(/\.sgd-warn-bar \.sg-btn\{[^}]*\}/);
  assert.ok(m, '띠 단추 규칙을 못 찾았습니다');
  const h = m[0].match(/min-height:(\d+)px/);
  assert.ok(h && Number(h[1]) >= 32, '★ 띠 단추 높이가 눌러 쓰기에 작습니다(32px 이상): ' + m[0]);
});

test('★ ④ 건의함 안쪽(직원 홈·관리자 목록)에도 「지금 확인하기」 띠가 있다', () => {
  const home = between('function sgViewMemberHome(', 'function sgViewList(');
  assert.match(home, /sgNeedBannerHtml\(\)/, '직원 건의함 홈에 경고 띠가 없습니다');
  assert.match(home, /sgBindNeedBanner\(bd\)/, '직원 건의함 홈의 띠가 눌러지지 않습니다');
  assert.match(home, /⚠ 확인 필요/, '진행 목록에서 어느 건을 확인해야 하는지 안 보입니다');
  const list = between('function sgRenderList(', 'function sgViewCreate(');
  assert.match(list, /sgNeedBannerHtml\(\)/, '관리자 목록에 경고 띠가 없습니다(관리자도 건의자일 수 있습니다)');
  assert.match(list, /sgBindNeedBanner\(wrap\)/, '관리자 목록의 띠가 눌러지지 않습니다');
});

test('④ 경고 띠: 확인할 건이 없으면 비고, 있으면 건수와 단추가 있다 · 누르면 건의함을 닫고 다시 확인한다', () => {
  const code = between('function sgSetNeed(', 'function sgUpdateBadge(');
  const calls = [];
  let handler = null;
  const btn = { addEventListener: (ev, cb) => { handler = cb; } };
  const ctx = {
    SG: {}, Math, $: () => null,
    sgCloseModal: () => calls.push('close'), sgCheckResolved: () => calls.push('check'),
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  ctx.SG.needConfirm = 0;
  assert.equal(ctx.sgNeedBannerHtml(), '', '확인할 건이 없는데 띠가 나옵니다');
  ctx.SG.needConfirm = 3;
  const h = ctx.sgNeedBannerHtml();
  assert.match(h, /role="alert"/);
  assert.match(h, /3건/, '건수가 안 보입니다');
  assert.match(h, /data-sg-need-open/, '누르는 단추가 없습니다');
  ctx.sgBindNeedBanner({ querySelector: () => btn });
  handler();
  assert.deepEqual(calls, ['close', 'check'], '★ 누르면 건의함을 닫고 확인 창을 다시 띄워야 합니다: ' + calls);
});

test('⑥ 경고 단추·띠는 떠 있지 않고, 움직임 줄이기 설정을 따른다', () => {
  const css = between('.sg-fabwarn{', '/* ── 시스템 설정 (관리자 전용)');
  assert.ok(!/position\s*:\s*(fixed|sticky)/.test(css), '★ 경고 표시를 화면에 띄우면 안 됩니다 — 떠 있는 단추 자리는 공용 앱바가 정합니다');
  const rm = between('@media (prefers-reduced-motion:reduce)', '\n', src.indexOf('.sg-fabwarn{'));
  assert.match(rm, /#sgFab\.sg-need\{animation:none/, '★ 움직임 줄이기 설정을 따르지 않습니다');
  assert.match(src, /id="sgFab" type="button"><span class="sg-fabwarn" id="sgFabWarn" aria-hidden="true">/, '단추 안에 ⚠ 자리가 없습니다');
});

test('일반 직원 배지를 셀 때 경고 수도 같은 수로 맞춘다 (둘이 어긋나지 않게)', () => {
  const fn = between('function sgUpdateBadge(', '// ══════════ 새 건의 폰 알림');
  assert.match(fn, /sgSetBadge\(n\);\s*sgSetNeed\(n\);/, '★ 배지와 경고가 따로 계산됩니다 — 어긋납니다');
});
