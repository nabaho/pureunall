'use strict';
/* TypeSafe(Jev) 검토 — 국외 보관 확인란 (2026-09-20 대표 결정 「안내문 만들고 쓴다」)

   대표: 「국외보관 문제, 어떻게 하시겠습니까?」 → 「안내문 만들고 쓴다 (추천)」.

   그냥 문구만 적어 두는 것과, «확인해야 다음으로 못 간다»는 것은 다르다. 안내문을
   읽었는지까지는 못 보장해도, 최소한 「몰랐다」는 말은 못 하게 해야 안내한 뜻이 있다.

   ■ 여기서 보는 것 — «값»이 아니라 «자리»다
   실제로 창을 그려 본다(가짜 window/document 를 만들어 js/pu-typesafe.js 를 그대로
   돌린다 — tests/appbar-admin-only.test.js 와 같은 길, jsdom 없이 손으로 지은 상자). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-typesafe.js'), 'utf8');

/* 손으로 지은 최소 DOM — appbar-admin-only.test.js 와 같은 자리다.
   id 를 «설정»하면 조회할 수 있게 등록해 둔다(getElementById 가 실제로 쓰인다). */
function load() {
  const byId = {};
  function makeEl(tag) {
    const el = {
      tagName: tag, style: {}, children: [],
      setAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, remove() {},
      /* ⚠ 진짜 요소에는 이것이 «늘» 있다. 없는 가짜를 쓰면, 자리를 재는 코드가
         들어오는 날 검사가 «기능이 멀쩡한데» 깨진다 — 2026-09-23 창 끌기를 넣자
         이 자리에서 그렇게 깨졌다. 가짜는 실물에 없는 것을 더하지 말되,
         실물에 «있는 것»을 빠뜨려도 안 된다. */
      getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
      appendChild(child) { this.children.push(child); return child; },
      _id: '',
      get id() { return this._id; },
      set id(v) { this._id = v; if (v) byId[v] = this; }
    };
    return el;
  }
  const body = makeEl('body'); body.classList = { toggle() {} };
  const head = makeEl('head');
  const win = {};
  const doc = {
    createElement: makeEl,
    getElementById: (id) => byId[id] || null,
    addEventListener() {},
    body, head, documentElement: head,
    readyState: 'complete'
  };
  const ctx = { console, window: win, document: doc, setTimeout, clearTimeout,
    fetch: () => Promise.reject(new Error('안 불러야 한다')), AbortController: undefined };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { win, byId };
}

/* byId 는 id 붙은 것만 담는다. status(span)·textarea 처럼 id 가 없는 것은
   host(= pu-typesafe-review, id 있음)부터 children 트리를 훑어 태그로 찾는다.
   ⚠ 이 창 안에는 textarea·span 이 하나씩뿐이라 안전하다(늘어나면 이 검사부터 걸린다). */
function 찾기(byId, tag) {
  for (const root of Object.values(byId)) {
    const hit = 훑기(root, tag);
    if (hit) return hit;
  }
  throw new Error('태그를 못 찾음: ' + tag);
}
function 훑기(el, tag) {
  if (!el || !Array.isArray(el.children)) return null;
  if (el.tagName === tag) return el;
  for (const c of el.children) {
    const hit = 훑기(c, tag);
    if (hit) return hit;
  }
  return null;
}

test('창을 처음 열면 확인란은 비어 있고, 단추는 눌러지지 않는다', () => {
  const { win, byId } = load();
  win.PuTypeSafe.open();
  const ack = byId['pu-typesafe-ack'];
  const runBtn = byId['pu-typesafe-run-btn'];
  assert.ok(ack, '확인란이 없습니다.');
  assert.ok(runBtn, '제안 받기 단추가 없습니다.');
  assert.notEqual(ack.checked, true, '확인란이 미리 체크된 채로 열립니다.');
  assert.equal(runBtn.disabled, true, '확인 전인데 단추가 눌립니다 — 안내문이 «장식»일 뿐입니다.');
});

test('확인란을 체크하면 단추가 풀린다', () => {
  const { win, byId } = load();
  win.PuTypeSafe.open();
  const ack = byId['pu-typesafe-ack'];
  const runBtn = byId['pu-typesafe-run-btn'];
  ack.checked = true;
  ack.onchange();
  assert.equal(runBtn.disabled, false, '체크해도 단추가 안 풀립니다.');
});

test('단추의 disabled 를 건너뛰고 run() 을 직접 불러도, 확인 안 했으면 막힌다', async () => {
  /* ⚠ 웹에서 disabled 단추는 클릭 자체가 안 되지만, 이건 «화면의 장치»일 뿐이다.
     정말 지켜지는지는 run() 이 «스스로도» 확인하는지를 봐야 한다(방어선 두 겹). */
  const { win, byId } = load();
  win.PuTypeSafe.open();
  const runBtn = byId['pu-typesafe-run-btn'];
  /* input.value 를 채워도 — 확인란이 «검토할 내용 입력」보다 먼저 걸려야 한다.
     안 그러면 사람이 글을 다 쓴 뒤에야 확인을 요구받아 순서가 뒤집힌다. */
  const textarea = 찾기(byId, 'textarea');
  textarea.value = '문의 내용입니다.';
  await runBtn.onclick();
  const status = byId['pu-typesafe-status'];
  assert.match(status.textContent, /확인란에 체크/,
    '확인 전에 눌러도 «확인란에 체크»라는 말이 안 뜹니다: ' + status.textContent);
});

test('확인하고 누르면 «확인란» 안내가 아니라 다음 검사(내용 입력)로 넘어간다', async () => {
  const { win, byId } = load();
  win.PuTypeSafe.open();
  const ack = byId['pu-typesafe-ack'];
  const runBtn = byId['pu-typesafe-run-btn'];
  ack.checked = true; ack.onchange();
  await runBtn.onclick();   // 내용은 비어 있다
  const status = byId['pu-typesafe-status'];
  assert.match(status.textContent, /검토할 내용을 입력/,
    '확인했는데도 «확인란» 문구가 남아 있으면, 확인이 실제로 안 통했다는 뜻입니다: ' + status.textContent);
});

test('창을 닫았다 다시 열면 확인이 «도로 풀린다» — 저번 확인이 이번 글까지 덮지 않는다', () => {
  const { win, byId } = load();
  win.PuTypeSafe.open();
  const ack = byId['pu-typesafe-ack'];
  const runBtn = byId['pu-typesafe-run-btn'];
  ack.checked = true; ack.onchange();
  assert.equal(runBtn.disabled, false);
  win.PuTypeSafe.open();   // 다시 연다(같은 창을 재사용 — make() 는 한 번만 짓는다)
  assert.notEqual(ack.checked, true, '다시 열어도 확인란이 그대로 체크돼 있습니다.');
  assert.equal(runBtn.disabled, true, '다시 열었는데 단추가 그대로 풀려 있습니다.');
});
