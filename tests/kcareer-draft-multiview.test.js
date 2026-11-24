'use strict';
/* 👁 작성 중 서류 «한꺼번에 보기» (대표 지시 2026-11-24 「서류가 여러장인 경우 한번에 모두 볼 수 있게」)
   ─────────────────────────────────────────────────────────────
   무엇이었나
     한 건이 여러 장(공적조서 앞·뒤·이력서·동의서)인데, 작성 중 서류 목록에서 장마다 「이어서」를 눌러 열어야 했다 —
     서로 맞는지(이름·날짜·도장) 견주려면 한 화면에 모두 있어야 한다.
   지금
     목록의 ☐ 로 고른 서류(고른 것이 없으면 「전부 한꺼번에 보기」)를 한 창에 쪽 그림으로 펼친다.
     그리는 일은 「한글 문서 보기」와 같은 엔진 하나(PureunHwp.renderPreview).
   ⚠ 글자만 찾는 검사는 기능을 꺼 버려도 통과한다 — 앱의 함수를 그대로 떼어 vm 에 올려 «돌려» 본다.
   ⚠ 값(폭·문구)이 아니라 «규칙»을 본다: 고른 장마다 한 칸 · 한 장이 못 그려도 나머지는 그린다 · 닫으면 비운다 ·
     고르지 않으면 안 연다 · 보기만 한다(저장 안 바꾼다) · 폰에서만 한 줄에 한 장.
   node --test tests/kcareer-draft-multiview.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8').replace(/\r\n/g, '\n');

function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}
const 주석뺌 = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');

/* ── 아주 작은 가짜 화면 ── */
function 가짜칸(tag) {
  const el = {
    tag, className: '', textContent: '', _html: '', children: [], styleProps: {}, 속성: {}, _자식: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }
    },
    style: {
      setProperty(k, v) { el.styleProps[k] = v; },
      removeProperty(k) { delete el.styleProps[k]; }
    },
    setAttribute(k, v) { el.속성[k] = v; },
    removeAttribute(k) { delete el.속성[k]; if (k === 'style') el.styleProps = {}; },
    appendChild(c) { el.children.push(c); return c; },
    querySelector(sel) { return el._자식[sel] || (el._자식[sel] = 가짜칸('x')); }
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) {
      el._html = v;
      if (v === '') { el.children = []; }
      el._자식 = {};            /* 새로 쓰면 안쪽 칸을 새로 만든다 */
    }
  });
  return el;
}

/* o: { 서류: {id:{name,title,base64|null}}, 쪽수:{id:n}, 열린: id|null, 느림: {id:ms} } */
function 무대(o) {
  o = o || {};
  const 호출 = { 알림: [], 그림: [], 담음: [], 저장바꿈: 0 };
  const 칸 = {
    modalDraftMulti: 가짜칸('div'), dmBody: 가짜칸('div'), dmInfo: 가짜칸('div'),
    dmSizeS: 가짜칸('button'), dmSizeL: 가짜칸('button')
  };
  const 눌린키 = [];
  const ctx = {
    console: { warn() {}, log() {} },
    document: {
      getElementById: (id) => 칸[id] || null,
      createElement: (t) => 가짜칸(t),
      addEventListener: (k, fn) => { 눌린키.push(fn); }
    },
    window: { PureunHwp: {
      renderPreview: async (box, bytes, name, opt) => {
        호출.그림.push({ box, name, opt, 길이: bytes.length });
        const ms = (o.느림 && o.느림[name]) || 0;
        if (ms) await new Promise((r) => setTimeout(r, ms));
        if (o.그리기실패 && o.그리기실패[name]) throw new Error(o.그리기실패[name]);
        return { pageCount: (o.쪽수 && o.쪽수[name]) || 1 };
      }
    } },
    toast: (m) => 호출.알림.push(String(m)),
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    _jsAttr: (s) => String(s).replace(/'/g, "\\'"),
    b64ToAb: (b) => Uint8Array.from(Buffer.from(String(b), 'base64')).buffer,
    _hwpFixName: (u8, nm) => nm,
    rhDraftFind: (id) => (o.서류 && o.서류[id] && { id, name: o.서류[id].name, title: o.서류[id].title }) || null,
    rhDraftAll: () => Object.keys(o.서류 || {}).map((id) => ({ id, name: o.서류[id].name, done: !!o.서류[id].done })),
    rhDraftSelIds: () => o.고른 || [],
    getFileAsync: async (id) => {
      if (o.파일느림) await new Promise((r) => setTimeout(r, o.파일느림));
      const s = o.서류 && o.서류[id];
      if (!s || s.base64 === null) return null;
      return { name: s.name, base64: s.base64 || Buffer.from('hwpx-' + id).toString('base64') };
    },
    rhDraftNow: async () => { 호출.담음.push('담음'); },
    rhDraftResume: () => {},
    _rhDraftId: o.열린 || null,
    _rhDoc: o.열린 ? { bytes: new Uint8Array([1]) } : null,
    _hwpEngineReady: !!o.엔진있음,
    /* 저장을 건드리는 길 — 보기만 하는 기능이 부르면 안 된다 */
    rhDraftPut: () => { 호출.저장바꿈++; },
    saveFileUnified: () => { 호출.저장바꿈++; },
    kcTrashPut: () => { 호출.저장바꿈++; },
    setTimeout
  };
  ctx.PureunHwp = ctx.window.PureunHwp;      /* 앱은 «창 전역»이라 맨 이름으로 부른다 */
  vm.createContext(ctx);
  const 머리 = SRC.match(/var DM_MIN = [^\n]+\nvar _dmSize = [^\n]+\nvar _dmIds = [^\n]+\nvar _dmRun = [^\n]+\nvar _dmKeyBound = [^\n]+/);
  assert.ok(머리, '「한꺼번에 보기」 전역 변수 묶음을 못 찾았습니다');
  const 코드 = [
    떼기('function _isHwpName(n){'),
    머리[0],
    떼기('function rhDraftViewSel('),
    떼기('function rhDraftViewAll('),
    떼기('function rhDraftViewManyRedraw('),
    떼기('function rhDraftViewManyClose('),
    떼기('async function rhDraftViewMany(')
  ].join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  vm.runInContext(코드, ctx);
  return { ctx, 칸, 호출, 눌린키 };
}
const 문서 = (이름) => ({ name: 이름 });

/* ── ① 화면 틀 — 단추와 창이 있고, 코드가 부르는 자리가 화면에 있다 ── */
test('① 고른 서류 «한꺼번에 보기» 단추가 선택 줄에, «전부» 단추가 목록 아래에 있고 창이 갖춰져 있다', () => {
  const 선택줄 = SRC.slice(SRC.indexOf('id="rhDraftSelBar"'), SRC.indexOf('id="rhDraftSelBar"') + 1600);
  assert.match(선택줄, /onclick="rhDraftViewSel\(\)"/, '선택 줄에 「한꺼번에 보기」가 없습니다');
  assert.match(선택줄, /rhDraftTrashSel/, '선택 줄 — 버리기는 그대로 있어야 합니다');
  assert.match(SRC, /onclick="rhDraftViewAll\(\)"/, '「전부 한꺼번에 보기」 단추가 없습니다');
  for (const id of ['modalDraftMulti', 'dmBody', 'dmInfo', 'dmSizeS', 'dmSizeL']) {
    assert.ok(SRC.includes('id="' + id + '"'), '창 안의 ' + id + ' 가 화면에 없습니다 — 코드가 찾는 자리입니다');
  }
  assert.match(SRC, /onclick="rhDraftViewManyClose\(\)"/, '창에 닫기가 없습니다');
  assert.match(SRC, /onclick="rhDraftViewManyRedraw\('s'\)"/);
  assert.match(SRC, /onclick="rhDraftViewManyRedraw\('l'\)"/);
});

test('① 코드가 getElementById 로 찾는 자리는 모두 화면에 있다', () => {
  const 본문 = 주석뺌(떼기('async function rhDraftViewMany(') + 떼기('function rhDraftViewManyClose('));
  /* 직접 적은 것 + 삼항(k==='s'?'dmSizeS':'dmSizeL') 안의 것까지 — 이 창의 자리는 modalDraftMulti·dm… 로 시작한다 */
  const ids = new Set(Array.from(본문.matchAll(/'(modalDraftMulti|dm[A-Z][A-Za-z]*)'/g)).map((m) => m[1]));
  assert.ok(ids.size >= 5, '찾는 자리를 읽지 못했습니다: ' + Array.from(ids));
  for (const id of ids) assert.ok(SRC.includes('id="' + id + '"'), id + ' 가 화면에 없습니다');
});

/* ── ② 돌려 본다 ── */
test('② 고른 장마다 한 칸 — 차례대로 «№ 번호 + 이름 + 쪽수» 를 적고, 그린 쪽을 합쳐 알린다', async () => {
  const m = 무대({
    서류: { a: { name: '공적조서(앞).hwpx', title: '공적조서 앞면' }, b: { name: '공적조서(뒤).hwpx' }, c: { name: '이력서.hwpx' } },
    쪽수: { '공적조서(앞).hwpx': 1, '공적조서(뒤).hwpx': 1, '이력서.hwpx': 2 }
  });
  await m.ctx.rhDraftViewMany(['a', 'b', 'c']);
  const 칸들 = m.칸.dmBody.children;
  assert.equal(칸들.length, 3, '고른 3장이 3칸이어야 합니다');
  assert.match(칸들[0].innerHTML, /№ 1/);
  assert.match(칸들[2].innerHTML, /№ 3/);
  assert.ok(칸들[0].innerHTML.includes('공적조서 앞면'), '보일 이름(title)이 먼저입니다');
  assert.ok(칸들[1].innerHTML.includes('공적조서(뒤).hwpx'), 'title 이 없으면 파일 이름');
  assert.equal(m.호출.그림.length, 3, '장마다 엔진으로 한 번씩 그려야 합니다');
  assert.ok(m.칸.modalDraftMulti.classList.contains('open'), '창이 열려야 합니다');
  assert.match(m.칸.dmInfo.innerHTML, /3건/);
  assert.match(m.칸.dmInfo.innerHTML, /4쪽/, '쪽 합계(1+1+2)를 알려야 합니다');
});

test('② 메모리 — 장을 여럿 그리므로 한 쪽을 «화면 배율 그대로(크게)» 그리지 않는다', async () => {
  const m = 무대({ 서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx' } } });
  await m.ctx.rhDraftViewMany(['a', 'b']);
  for (const g of m.호출.그림) {
    assert.ok(g.opt && typeof g.opt.dpr === 'number', '그림 배율(dpr)을 정해서 불러야 합니다');
    assert.ok(g.opt.dpr <= 1.5, '여러 장이라 배율이 높으면 메모리가 한없이 듭니다: ' + g.opt.dpr);
  }
});

test('② 한 장이 못 그려져도 나머지는 그린다 — 까닭은 그 칸에, 알림은 합계에', async () => {
  const m = 무대({
    서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx', base64: null }, c: { name: 'c.hwpx' }, d: { name: 'd.pdf' }, e: { name: 'e.hwpx' } },
    그리기실패: { 'c.hwpx': '엔진이 거절했습니다' }
  });
  await m.ctx.rhDraftViewMany(['a', 'b', 'c', 'd', 'e']);
  const 칸 = m.칸.dmBody.children;
  assert.equal(칸.length, 5, '실패한 장도 칸은 남아야 합니다(어느 장인지 알 수 있게)');
  assert.ok(칸[1]._자식['.dm-pg'].innerHTML.includes('서식 파일이 이 기기에 없'), '파일 없음 까닭');
  assert.ok(칸[2]._자식['.dm-pg'].innerHTML.includes('엔진이 거절했습니다'), '엔진 오류 까닭');
  assert.ok(칸[3]._자식['.dm-pg'].innerHTML.includes('한글 문서가 아니라'), '한글이 아니면 그리지 않고 까닭을 말한다');
  assert.equal(m.호출.그림.length, 3, '못 그릴 것(파일 없음·한글 아님)은 엔진을 부르지 않는다(a·c·e 만)');
  assert.match(m.칸.dmInfo.innerHTML, /3건은 그리지 못했습니다|⚠ 3건/);
});

test('② 고른 것이 없으면 창을 열지 않고 방법을 알려 준다', async () => {
  const m = 무대({ 서류: { a: { name: 'a.hwpx' } } });
  await m.ctx.rhDraftViewMany([]);
  assert.equal(m.칸.modalDraftMulti.classList.contains('open'), false);
  assert.equal(m.호출.그림.length, 0);
  assert.equal(m.호출.알림.length, 1);
  await m.ctx.rhDraftViewMany(['없는-id']);
  assert.equal(m.칸.modalDraftMulti.classList.contains('open'), false, '목록에 없는 id 만 오면 열지 않는다');
});

test('② 「전부」는 «작성 중»만 — 지난 작성(done)은 빼고, 「고른 것」은 고른 그대로', async () => {
  const m = 무대({
    서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx', done: true }, c: { name: 'c.hwpx' } },
    고른: ['c']
  });
  await m.ctx.rhDraftViewAll();
  assert.deepEqual(m.호출.그림.map((g) => g.name).sort(), ['a.hwpx', 'c.hwpx']);
  const m2 = 무대({ 서류: { a: { name: 'a.hwpx' }, c: { name: 'c.hwpx' } }, 고른: ['c'] });
  await m2.ctx.rhDraftViewSel();
  assert.deepEqual(m2.호출.그림.map((g) => g.name), ['c.hwpx']);
});

test('② 지금 열어 둔 서류가 들었으면 먼저 담는다(방금 고친 것이 빠지지 않게) — 안 들었으면 안 건드린다', async () => {
  const 들 = 무대({ 서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx' } }, 열린: 'a' });
  await 들.ctx.rhDraftViewMany(['a', 'b']);
  assert.equal(들.호출.담음.length, 1, '열려 있는 서류가 고른 것에 들었으면 한 번 담는다');
  const 안 = 무대({ 서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx' } }, 열린: 'a' });
  await 안.ctx.rhDraftViewMany(['b']);
  assert.equal(안.호출.담음.length, 0, '고르지 않은 서류는 건드리지 않는다');
});

test('② 크기 — 작게/크게가 칸 최소 폭을 바꾸고(크게가 더 넓다), 같은 장들을 다시 그린다', async () => {
  const m = 무대({ 서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx' } } });
  await m.ctx.rhDraftViewMany(['a', 'b'], 's');
  const 작 = parseInt(m.칸.dmBody.styleProps['--dm-min'], 10);
  await m.ctx.rhDraftViewManyRedraw('l');
  const 큼 = parseInt(m.칸.dmBody.styleProps['--dm-min'], 10);
  assert.ok(작 > 0 && 큼 > 작, '크게 보기는 칸이 더 넓어야 합니다: ' + 작 + ' → ' + 큼);
  assert.equal(m.칸.dmBody.children.length, 2, '다시 그려도 같은 장 수');
  assert.equal(m.호출.그림.length, 4, '두 번 그렸다(2장 × 2번)');
  assert.ok(m.칸.dmSizeL.classList.contains('primary') && !m.칸.dmSizeS.classList.contains('primary'), '고른 크기 단추가 눌린 모양');
});

test('② 닫으면 그림을 비우고, 그리던 중에 닫으면 뒤늦게 그려 붙이지 않는다', async () => {
  const m = 무대({ 서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx' } }, 느림: { 'a.hwpx': 30 } });
  const 중 = m.ctx.rhDraftViewMany(['a', 'b']);
  await new Promise((r) => setTimeout(r, 5));
  m.ctx.rhDraftViewManyClose();
  await 중;
  assert.equal(m.칸.dmBody.children.length, 0, '닫은 뒤에는 칸이 남지 않아야 합니다');
  assert.equal(m.칸.modalDraftMulti.classList.contains('open'), false);
  assert.equal(m.호출.그림.length, 1, '닫은 뒤에는 다음 장을 그리지 않는다');
  const 열림 = 무대({ 서류: { a: { name: 'a.hwpx' } } });
  await 열림.ctx.rhDraftViewMany(['a']);
  열림.ctx.rhDraftViewManyClose();
  assert.equal(열림.칸.dmBody.children.length, 0);
});

test('② 파일을 받는 사이에 닫아도 — 무거운 그리기를 시작하지 않는다', async () => {
  const m = 무대({ 서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx' } }, 파일느림: 30 });
  const 중 = m.ctx.rhDraftViewMany(['a', 'b']);
  await new Promise((r) => setTimeout(r, 8));
  m.ctx.rhDraftViewManyClose();
  await 중;
  assert.equal(m.호출.그림.length, 0, '닫은 뒤에 엔진으로 그리기를 시작했습니다');
  assert.equal(m.칸.dmBody.children.length <= 1, true);
});

test('② 느린 첫 요청 도중 다시 누르면 «뒤 요청의 장»만 남는다(앞 요청이 뒤늦게 섞이지 않는다)', async () => {
  const m = 무대({ 서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx' }, c: { name: 'c.hwpx' } }, 느림: { 'a.hwpx': 40 } });
  const 앞 = m.ctx.rhDraftViewMany(['a', 'b']);
  await new Promise((r) => setTimeout(r, 5));
  const 뒤 = m.ctx.rhDraftViewMany(['c']);
  await Promise.all([앞, 뒤]);
  const 제목들 = m.칸.dmBody.children.map((c) => c.innerHTML).join('|');
  assert.ok(제목들.includes('c.hwpx'), '뒤 요청의 장이 있어야 합니다');
  assert.ok(!제목들.includes('b.hwpx'), '앞 요청의 다음 장(b)이 뒤늦게 붙으면 안 됩니다');
});

test('② Esc 로 닫힌다(창이 열려 있을 때만)', async () => {
  const m = 무대({ 서류: { a: { name: 'a.hwpx' } } });
  await m.ctx.rhDraftViewMany(['a']);
  assert.ok(m.눌린키.length >= 1, 'Esc 를 듣는 자리를 한 번 묶어야 합니다');
  m.눌린키[0]({ key: 'Escape' });
  assert.equal(m.칸.modalDraftMulti.classList.contains('open'), false);
  m.눌린키[0]({ key: 'Escape' });                    /* 닫힌 뒤에는 아무 일도 없어야 한다 */
  await m.ctx.rhDraftViewMany(['a']);
  assert.equal(m.눌린키.length, 1, '다시 열어도 듣는 자리를 또 묶지 않는다');
});

test('② 보기만 한다 — 목록·파일 저장을 바꾸는 길을 부르지 않는다(열어 둔 서류 담기만 예외)', async () => {
  const m = 무대({ 서류: { a: { name: 'a.hwpx' }, b: { name: 'b.hwpx', base64: null } }, 열린: 'a' });
  await m.ctx.rhDraftViewMany(['a', 'b']);
  assert.equal(m.호출.저장바꿈, 0, '보기가 목록·파일을 바꿨습니다');
  const 본문 = 주석뺌(떼기('async function rhDraftViewMany(') + 떼기('function rhDraftViewManyClose('));
  for (const 금 of ['rhDraftPut(', 'saveFileUnified(', 'kcTrashPut', 'rhDraftTrash', 'set(RH_DRAFTS']) {
    assert.ok(!본문.includes(금), '보기 코드에 저장을 바꾸는 호출이 있습니다: ' + 금);
  }
});

/* ── ③ 폰에서만 한 줄에 한 장 — PC 는 그대로 ── */
test('③ 칸 배치는 PC 에서 «여러 장 나란히»(auto-fill), 한 줄에 한 장은 폰 구간 안에서만', () => {
  const 폰구간 = Array.from(SRC.matchAll(/@media \(max-width:520px\)\{([\s\S]*?)\n\}/g)).map((m) => m[1]);
  const 폰안 = 폰구간.filter((b) => /\.dm-grid\{/.test(b));
  assert.equal(폰안.length, 1, '폰 구간에 .dm-grid 규칙이 있어야 합니다');
  assert.match(폰안[0], /\.dm-grid\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, '폰: 한 줄에 한 장');
  const 폰밖 = SRC.replace(/@media \(max-width:520px\)\{[\s\S]*?\n\}/g, '');
  const pc = 폰밖.match(/\.dm-grid\{[^}]*\}/);
  assert.ok(pc, 'PC 용 .dm-grid 규칙이 있어야 합니다');
  assert.match(pc[0], /auto-fill|auto-fit/, 'PC: 창이 넓으면 여러 장이 나란히');
  assert.match(pc[0], /var\(--dm-min/, '칸 폭은 «고른 크기» 변수가 정한다');
});

test('③ 어두운 판 — 칸(.dm-card)과 이름줄(.dm-cap)에 어두운 판 옷이 있다(밝은 바탕에 밝은 글자 방지)', () => {
  assert.match(SRC, /html\.dark \.dm-card\{[^}]*background/);
  assert.match(SRC, /html\.dark \.dm-cap\{[^}]*background[^}]*color/);
});

test('③ 이름은 한 줄(…으로 줄임) — 이름이 길어도 줄이 밀리지 않는다', () => {
  const t = SRC.match(/\.dm-cap \.dm-t\{[^}]*\}/);
  assert.ok(t, '.dm-t 규칙');
  assert.match(t[0], /white-space:nowrap/);
  assert.match(t[0], /text-overflow:ellipsis/);
});
