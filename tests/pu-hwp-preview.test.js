'use strict';
/* 한글 미리보기 창(js/pu-hwp-preview.js) — 읽기 전용, 엔진은 PureunHwp.renderPreview 만 (2026-10-11)
 * 지키는 것: 열기·실패(약속 거절·동기 throw)·엔진 없음·닫기 정리·한 번에 하나·취소는 실패가 아니다(cancelled)·
 *           Esc 는 창이 먼저 받아 멈춘다(밑의 창 듣개까지 안 간다)·뒤로가기는 미리보기를 먼저 닫는다·
 *           바깥 클릭만 닫는다(안쪽 클릭은 거품으로 올라가도 안 닫힌다)·파일 이름은 글자로(textContent)·
 *           외부 주소·편집기(iframe)·새 창·저장(storage)·주소 바꾸기 없음.
 * 가짜 문서는 tests/helpers/fake-preview-dom.js — 이벤트가 진짜처럼 잡기 → 대상 → 거품으로 흐른다.
 * node --test tests/pu-hwp-preview.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments.js');
const { fakeDoc, all } = require('./helpers/fake-preview-dom.js');

const FILE = path.join(__dirname, '..', 'js', 'pu-hwp-preview.js');
const BACK = path.join(__dirname, '..', 'js', 'pu-back.js');
const SRC = fs.readFileSync(FILE, 'utf8');

const walk = (doc) => all(doc.body);

function load(opts) {
  const o = opts || {};
  const doc = fakeDoc();
  const calls = [];
  const g = { document: doc };
  if (o.engine !== false) {
    g.PureunHwp = {
      renderPreview(host, input, name) {
        const c = { host, input, name };
        calls.push(c);
        if (o.throwSync) throw new Error(o.throwSync);
        if (o.fail) return Promise.reject(new Error(o.fail));
        if (o.hold) return new Promise((res, rej) => { c.resolve = () => res({ pageCount: 3 }); c.reject = (e) => rej(e); });
        host.appendChild(doc.createElement('canvas'));
        return Promise.resolve({ pageCount: o.pages || 3 });
      }
    };
  }
  if (o.back) g.PuBack = o.back;
  delete require.cache[require.resolve(FILE)];
  const saved = {};
  Object.keys(g).forEach((k) => { saved[k] = global[k]; global[k] = g[k]; });
  const P = require(FILE);
  Object.keys(g).forEach((k) => { if (saved[k] === undefined) delete global[k]; else global[k] = saved[k]; });
  /* 모듈은 globalThis 를 읽으니, 시험 동안은 다시 걸어 둔다 */
  return { P, doc, calls, g, run: async (fn) => {
    Object.keys(g).forEach((k) => { saved[k] = global[k]; global[k] = g[k]; });
    try { return await fn(); } finally { Object.keys(g).forEach((k) => { if (saved[k] === undefined) delete global[k]; else global[k] = saved[k]; }); }
  } };
}
const text = (doc) => walk(doc).map((e) => e._text).join('|');
/* 거절을 받아 둔다 — 취소 표시(cancelled·AbortError)를 보려고 */
const caught = (p) => p.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }));

test('열기 — 창이 뜨고 제목은 파일 이름, 엔진에 (host, 입력, 이름)이 간다, 끝나면 「N쪽」', async () => {
  const w = load({ pages: 4 });
  await w.run(async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const r = await w.P.open(bytes, '보고서.hwpx');
    assert.strictEqual(r.pageCount, 4);
    assert.strictEqual(w.P.isOpen(), true);
    assert.strictEqual(w.calls.length, 1);
    assert.strictEqual(w.calls[0].input, bytes);
    assert.strictEqual(w.calls[0].name, '보고서.hwpx');
    assert.ok(text(w.doc).includes('보고서.hwpx'));
    assert.ok(text(w.doc).includes('4쪽'));
    assert.ok(walk(w.doc).some((e) => e.tagName === 'CANVAS'), '그림판이 host 안에 없다');
  });
});
test('불러오는 중… 이 먼저 보인다', async () => {
  const w = load({ hold: true });
  await w.run(async () => {
    const p = w.P.open(new Uint8Array(1), 'a.hwp');
    assert.ok(text(w.doc).includes('불러오는 중…'));
    w.calls[0].resolve(); await p;
    assert.ok(!text(w.doc).includes('불러오는 중…'));
  });
});
test('실패 — 창 안에 「미리보기를 열지 못했습니다 — 이유」, onFail 호출, 거절', async () => {
  const w = load({ fail: '파일이 깨졌습니다' });
  await w.run(async () => {
    let seen = null;
    await assert.rejects(w.P.open(new Uint8Array(1), 'x.hwp', { onFail: (e) => { seen = e; } }), /미리보기를 열지 못했습니다 — 파일이 깨졌습니다/);
    assert.ok(text(w.doc).includes('미리보기를 열지 못했습니다 — 파일이 깨졌습니다'));
    assert.ok(seen && /깨졌/.test(seen.message));
    assert.ok(!seen.cancelled, '진짜 실패에 취소 표시가 붙었다');
    assert.strictEqual(w.P.isOpen(), true, '실패해도 창은 닫기 전까지 남는다');
    w.P.close();
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('실패 — 엔진이 «바로» 던져도(validate: 빈 파일·확장자와 내용이 다름) 같은 실패로 받는다', async () => {
  const w = load({ throwSync: '파일 내용과 확장자가 일치하지 않습니다.' });
  await w.run(async () => {
    let seen = null;
    const r = await caught(w.P.open(new Uint8Array(1), '이름만바꾼.hwp', { onFail: (e) => { seen = e; } }));
    assert.strictEqual(r.ok, false);
    assert.match(r.e.message, /^미리보기를 열지 못했습니다 — 파일 내용과 확장자가 일치하지 않습니다\.$/);
    assert.ok(!r.e.cancelled);
    assert.ok(seen, 'onFail 을 안 불렀다');
    assert.ok(text(w.doc).includes('미리보기를 열지 못했습니다 — 파일 내용과 확장자가 일치하지 않습니다.'), '창 안에 이유가 없다');
    assert.ok(!text(w.doc).includes('불러오는 중…'), '「불러오는 중…」에 멈춰 있다');
    assert.strictEqual(w.P.isOpen(), true);
  });
});
test('엔진이 없으면 창을 열지 않고 「한글 엔진을 불러오지 못했습니다」', async () => {
  const w = load({ engine: false });
  await w.run(async () => {
    let seen = null;
    await assert.rejects(w.P.open(new Uint8Array(1), 'a.hwp', { onFail: (e) => { seen = e; } }), /한글 엔진을 불러오지 못했습니다/);
    assert.strictEqual(w.P.isOpen(), false);
    assert.strictEqual(walk(w.doc).length, 1, '창 조각이 남았다');
    assert.ok(seen);
  });
});
test('닫기 — 창·키 듣개가 사라지고 뒤로가기 층도 비운다', async () => {
  const closed = []; let handler = null;
  const back = { open(n, f) { handler = f; return 7; }, close(id) { closed.push(id); } };
  const w = load({ back });
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    assert.strictEqual(w.doc.listenerCount('keydown'), 1);
    assert.strictEqual(typeof handler, 'function');
    w.P.close();
    assert.strictEqual(w.P.isOpen(), false);
    assert.strictEqual(walk(w.doc).length, 1);
    assert.strictEqual(w.doc.listenerCount('keydown'), 0, '키 듣개가 남았다 — 붙일 때와 다른 capture 값으로 뗐다');
    assert.deepStrictEqual(closed, [7]);
    w.P.close(); /* 여러 번 불려도 탈이 없다 */
    /* 뒤로가기가 닫는 함수를 부르면 닫힌다 */
    await w.P.open(new Uint8Array(1), 'b.hwp');
    handler();
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('닫기 단추는 data-close 를 달고, 누르면 닫힌다', async () => {
  const w = load();
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    const b = walk(w.doc).find((e) => e.tagName === 'BUTTON');
    assert.ok(b && b.getAttribute('data-close') !== null);
    assert.strictEqual(b.textContent, '닫기');
    b.click();
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('한 번에 하나 — 두 번째 open 은 같은 창을 쓰고 제목·내용만 바꾼다', async () => {
  const w = load();
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), '첫째.hwp');
    const rootsBefore = w.doc.body.children.length;
    await w.P.open(new Uint8Array(2), '둘째.hwpx');
    assert.strictEqual(w.doc.body.children.length, rootsBefore);
    assert.strictEqual(rootsBefore, 1);
    assert.ok(text(w.doc).includes('둘째.hwpx'));
    assert.ok(!text(w.doc).includes('첫째.hwp|'), '첫째 제목이 남았다');
    assert.strictEqual(w.doc.listenerCount('keydown'), 1, '키 듣개가 겹쳤다');
    assert.strictEqual(walk(w.doc).filter((e) => e.tagName === 'CANVAS').length, 1, '옛 그림판이 남았다');
  });
});
test('늦게 끝난 옛 요청은 새 창을 건드리지 않는다 — 옛 것은 「다른 파일을 열어 …」 취소(cancelled·AbortError)', async () => {
  const w = load({ hold: true });
  await w.run(async () => {
    let failed = 0;
    const p1 = caught(w.P.open(new Uint8Array(1), '첫째.hwp', { onFail: () => { failed++; } }));
    const p2 = w.P.open(new Uint8Array(1), '둘째.hwp');
    w.calls[0].resolve();
    const r1 = await p1;
    assert.strictEqual(r1.ok, false);
    assert.strictEqual(r1.e.cancelled, true, '밀린 요청에 취소 표시가 없다 — 쓰는 쪽이 빨간 실패로 알린다');
    assert.strictEqual(r1.e.name, 'AbortError');
    assert.strictEqual(r1.e.message, '다른 파일을 열어 이 미리보기는 취소되었습니다');
    assert.strictEqual(failed, 0, '취소에 onFail 을 불렀다');
    assert.ok(text(w.doc).includes('불러오는 중…'), '옛 요청이 새 창의 상태를 바꿨다');
    w.calls[1].resolve(); await p2;
    assert.ok(text(w.doc).includes('3쪽'));
  });
});
test('늦게 «실패한» 옛 요청도 새 창을 건드리지 않는다 — 상태·내용 그대로, onFail 없음', async () => {
  const w = load({ hold: true });
  await w.run(async () => {
    let failed = 0;
    const p1 = caught(w.P.open(new Uint8Array(1), '첫째.hwp', { onFail: () => { failed++; } }));
    const p2 = w.P.open(new Uint8Array(1), '둘째.hwp');
    w.calls[0].reject(new Error('옛 파일이 깨졌습니다'));
    const r1 = await p1;
    assert.strictEqual(r1.e.cancelled, true);
    assert.strictEqual(failed, 0);
    assert.ok(text(w.doc).includes('불러오는 중…'), '옛 실패가 새 창의 「불러오는 중…」을 지웠다');
    assert.ok(!text(w.doc).includes('깨졌습니다'), '옛 실패 안내가 새 창에 들어갔다');
    w.calls[1].resolve(); await p2;
    assert.ok(text(w.doc).includes('3쪽'));
  });
});
test('불러오는 사이 닫으면 — 「미리보기가 닫혀 취소되었습니다」 취소(cancelled), 「다른 파일」이라고 하지 않는다', async () => {
  const w = load({ hold: true });
  await w.run(async () => {
    let failed = 0;
    const p = caught(w.P.open(new Uint8Array(1), 'a.hwp', { onFail: () => { failed++; } }));
    w.P.close();
    w.calls[0].resolve();
    const r = await p;
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.e.cancelled, true);
    assert.strictEqual(r.e.name, 'AbortError');
    assert.strictEqual(r.e.message, '미리보기가 닫혀 취소되었습니다');
    assert.strictEqual(failed, 0);
    /* 닫힌 뒤 엔진이 실패로 끝나도 같다 */
    const p2 = caught(w.P.open(new Uint8Array(1), 'b.hwp', { onFail: () => { failed++; } }));
    w.P.close();
    w.calls[1].reject(new Error('깨짐'));
    const r2 = await p2;
    assert.strictEqual(r2.e.cancelled, true);
    assert.strictEqual(r2.e.message, '미리보기가 닫혀 취소되었습니다');
    assert.strictEqual(failed, 0);
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('Esc 로 닫힌다, 다른 키는 아니다', async () => {
  const w = load();
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    w.doc.key('Enter'); assert.strictEqual(w.P.isOpen(), true);
    w.doc.key('Escape'); assert.strictEqual(w.P.isOpen(), false);
  });
});
test('★ Esc 는 미리보기만 닫는다 — 먼저 붙은 페이지 Esc 듣개(거품 단계)까지 가지 않는다', async () => {
  const w = load();
  await w.run(async () => {
    /* 정부사업일정 initShortcuts 자리 — 페이지를 열 때 문서에 붙어, 미리보기보다 «먼저» 있다.
       이 듣개가 Esc 를 받으면 맨 위 .mb(보고서 창)를 닫아 적던 값이 날아간다 */
    const page = [];
    w.doc.addEventListener('keydown', (e) => { page.push(e.key); });
    const later = [];
    await w.P.open(new Uint8Array(1), 'a.hwp');
    w.doc.addEventListener('keydown', (e) => { later.push(e.key); }, true);   /* 뒤에 붙은 잡기 듣개도 */
    const btn = w.doc.createElement('button');                            /* 보고서 창의 👁 단추에 초점이 남아 있다 */
    w.doc.body.appendChild(btn);
    const ev = w.doc.key('Escape', btn);
    assert.strictEqual(w.P.isOpen(), false, '미리보기가 안 닫혔다');
    assert.deepStrictEqual(page, [], 'Esc 가 밑의 창 듣개까지 갔다 — 보고서 창도 같이 닫힌다');
    assert.deepStrictEqual(later, [], '뒤에 붙은 문서 듣개까지 갔다(stopImmediatePropagation 없음)');
    assert.strictEqual(ev.defaultPrevented, true);
    /* 창이 닫힌 뒤의 Esc 는 페이지 몫 — 가로채지 않는다 */
    const ev2 = w.doc.key('Escape', btn);
    assert.deepStrictEqual(page, ['Escape']);
    assert.strictEqual(ev2.defaultPrevented, false);
    assert.strictEqual(w.doc.listenerCount('keydown', true), 1, '미리보기 듣개가 남았다');
    /* 열려 있어도 Esc 가 아닌 키는 그대로 지나간다 */
    await w.P.open(new Uint8Array(1), 'b.hwp');
    const ev3 = w.doc.key('Enter', btn);
    assert.deepStrictEqual(page, ['Escape', 'Enter']);
    assert.strictEqual(ev3.defaultPrevented, false);
    assert.strictEqual(w.P.isOpen(), true);
  });
});
test('★ 뒤로가기(진짜 js/pu-back.js) — 미리보기를 먼저 닫고, 다음 뒤로가기에서야 밑의 창 차례', async () => {
  delete require.cache[require.resolve(BACK)];
  const PuBack = require(BACK);
  const under = [];
  /* 정부사업일정 줄 끝: PuBack.guard(() => closeTopOverlay() === true || …) — 보고서 창(.mb)을 닫는 자리 */
  PuBack.guard(() => { under.push('보고서 창'); return true; });
  const w = load({ back: PuBack });
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    assert.strictEqual(PuBack.depth(), 1);
    PuBack._pop();
    assert.strictEqual(w.P.isOpen(), false, '뒤로가기가 미리보기를 안 닫았다');
    assert.deepStrictEqual(under, [], '뒤로가기 한 번에 밑의 창까지 닫혔다');
    assert.strictEqual(PuBack.depth(), 0);
    PuBack._pop();
    assert.deepStrictEqual(under, ['보고서 창']);
    /* 사람이 닫기로 닫으면 층도 빠진다 — 다음 뒤로가기는 곧장 밑의 창 */
    await w.P.open(new Uint8Array(1), 'b.hwp');
    w.P.close();
    assert.strictEqual(PuBack.depth(), 0);
  });
  delete require.cache[require.resolve(BACK)];
});
test('바깥(배경)을 누르면 닫히고, 안쪽을 누르면 — 거품으로 바깥까지 올라가도 — 안 닫힌다', async () => {
  const w = load();
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    const root = w.doc.body.children[0];
    const inner = root.children[0];
    let reached = 0;
    root.addEventListener('click', () => { reached++; });
    inner.click();
    assert.strictEqual(reached, 1, '가짜 문서가 거품을 안 올린다 — 이 검사가 헛돈다');
    assert.strictEqual(w.P.isOpen(), true, '안쪽을 눌렀는데 닫혔다');
    const deep = walk(w.doc).find((e) => e.tagName === 'CANVAS');
    deep.click();
    assert.strictEqual(w.P.isOpen(), true, '그림판을 눌렀는데 닫혔다');
    root.click();
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('파일 이름은 «글자»로 넣는다 — innerHTML 에 데이터를 넣지 않는다', async () => {
  const w = load();
  await w.run(async () => {
    const evil = '<img src=x onerror=alert(1)>.hwp';
    await w.P.open(new Uint8Array(1), evil);
    const hit = walk(w.doc).filter((e) => e._text === evil);
    assert.strictEqual(hit.length, 1, '이름이 글자로 들어가지 않았다');
    assert.ok(!walk(w.doc).some((e) => e.tagName === 'IMG'));
  });
  const code = stripJs(SRC);
  assert.ok(!/innerHTML\s*=\s*[^'"\s;]/.test(code) && !/innerHTML\s*\+?=\s*['"][^'"]/.test(code), 'innerHTML 로 글을 넣는 줄이 있다');
});

/* ══ 정적 — 주석은 저장소의 진짜 걷개(tests/strip-comments.js stripJs)로 걷는다.
   손으로 쓴 「// 뒤 지우기」는 글자열 안의 https:// 뒤를 통째로 지워서 'https://esm.sh/x' 를 못 잡았다(2026-10-11 검토). ══ */
function forbidden(src) {
  const bare = stripJs(src);
  const bad = [];
  if (/esm\.sh|edwardkim\.github\.io/.test(bare)) bad.push('남의 주소(esm.sh·edwardkim)');
  if (/https?:\/\//.test(bare)) bad.push('외부 주소');
  if (/createEditor/.test(bare)) bad.push('편집기');
  if (/iframe/i.test(bare)) bad.push('iframe');
  if (/window\.open|\.open\(\s*['"]http/.test(bare)) bad.push('새 창');
  if (/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB/.test(bare)) bad.push('밖으로 보내거나 저장');
  if (/location\./.test(bare)) bad.push('주소 바꾸기');
  return { bad, bare };
}
test('★ 새 파일에 남의 주소·편집기(iframe)·새 창·저장·주소 바꾸기가 없다', () => {
  const r = forbidden(SRC);
  assert.deepStrictEqual(r.bad, []);
  assert.match(r.bare, /renderPreview/);
});
test('★ 위 검사에 이빨이 있다 — 글자열 안 주소·iframe·sessionStorage·location 을 실제로 잡는다', () => {
  [
    ["var U='https://esm.sh/x';", '남의 주소(esm.sh·edwardkim)'],
    ["var U='https://edwardkim.github.io/rhwp/';", '외부 주소'],
    ["var U='https://evil.example/x';", '외부 주소'],
    ["make('iframe','');", 'iframe'],
    ["sessionStorage.setItem('a','b');", '밖으로 보내거나 저장'],
    ["location.href='x';", '주소 바꾸기']
  ].forEach(([line, want]) => {
    assert.ok(forbidden(SRC + '\n' + line + '\n').bad.includes(want), '못 잡았다: ' + line);
  });
  /* 주석 속 설명은 잡지 않는다 */
  assert.deepStrictEqual(forbidden(SRC + '\n/* 예전엔 https://esm.sh 를 썼다 */\n').bad, []);
});
test('브라우저에서는 window.PuHwpPreview 로 붙는다', () => {
  assert.match(SRC, /global\.PuHwpPreview\s*=/);
  assert.match(SRC, /module\.exports/);
});
