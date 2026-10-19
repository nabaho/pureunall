/* 📎 첨부 «한 파일 = 한 줄» (대표 승인 목업 2026-10-20 「목업대로」, 다음메일 모양)
   ═══════════════════════════════════════════════════════════════════════════
   예전에는 첨부 하나가 단추 다섯(내려받기·미리보기·급여데이터함·기업별 계약서·사진첩)이라 파일마다
   두 줄로 꺾였다. 이제 ⬇ 가 내려받기, 이름 옆에 크기, 「미리보기」는 글자 링크, 담는 길 셋은 「보내기 ▾」 하나.
   이 검사는 줄을 «실제로 그려» 보고, 「보내기 ▾」와 「모두저장」을 «실제로 눌러» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const fn = (n) => sliceFn(HTML, 'function ' + n + '(');

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kindOf = (n, m) => (/\.hwp$|\.docx?$/i.test(n) ? 'doc' : /\.pdf$/i.test(n) || /pdf/.test(m || '') ? 'pdf' : /\.(png|jpe?g)$/i.test(n) ? 'img' : /\.xlsx?$/i.test(n) ? 'xls' : '');
const extOf = (n) => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

function makeHtmlBox(open) {
  const box = {
    console, Object, Array, Number, String, Math,
    MB_OLD_ID: '*old', esc,
    fmtMB: (b) => (Math.round(b / 1024 / 1024 * 10) / 10) + 'MB',
    mbPvKind: kindOf, mbPvExt: extOf,
  };
  vm.createContext(box);
  vm.runInContext(fn('mbAttIcon') + '\n' + fn('mbAttsHtml') + '\n;this.mbAttsHtml = mbAttsHtml; this.mbAttIcon = mbAttIcon;', box);
  box.render = (o) => box.mbAttsHtml(o);
  return box;
}
const FILES = [
  { name: '[공고] 모집 공고.hwp', mime: '', size: 250 * 1024 },
  { name: '운영지침 개정자료.zip', mime: 'application/zip', size: 1.4 * 1024 * 1024 },
];

test('★★ 한 파일 = 한 줄 — 줄 수가 첨부 수와 같고, 옛 단추 덩이(attone·topay)가 없다', () => {
  const h = makeHtmlBox().render({ slug: 'INBOX-a', uid: '1', atts: FILES });
  assert.equal((h.match(/class="attrow"/g) || []).length, 2, '첨부 한 개가 한 줄이 아니다');
  assert.doesNotMatch(h, /attone|class="topay"/, '옛 단추 덩이가 남았다 — 한 파일에 단추 다섯');
  assert.match(h, /첨부파일 2개/);
  assert.match(h, /\(1\.6MB\)/, '합계 크기가 없다');
});

test('★★ 줄마다 ⬇ 내려받기 · 이름 · 크기 · 미리보기 · 보내기 ▾ 가 번호를 달고 있다', () => {
  const h = makeHtmlBox().render({ slug: 'INBOX-a', uid: '1', atts: FILES });
  [0, 1].forEach((i) => {
    assert.match(h, new RegExp('class="dl" onclick="mbAtt\\(' + i + '\\)"'), i + '번 ⬇ 가 없다');
    assert.match(h, new RegExp('class="nm" onclick="mbAtt\\(' + i + '\\)"'), i + '번 이름을 눌러도 안 받는다');
    assert.match(h, new RegExp('mbAttMenu\\(' + i + ', event\\)'), i + '번 「보내기」가 없다');
    assert.match(h, new RegExp('id="mbAttMenu' + i + '"'), i + '번 메뉴 자리가 없다');
  });
});

test('★★ 「보내기 ▾」 안에 담는 길 셋이 «다» 있다 — 단추를 접었지 기능을 지운 게 아니다', () => {
  const h = makeHtmlBox().render({ slug: 'INBOX-a', uid: '1', atts: [FILES[0]] });
  ['mbAttToPay', 'mbAttToCo', 'mbAttToPhoto'].forEach((f) => {
    assert.match(h, new RegExp('mbAttMenuClose\\(\\);' + f + '\\(0\\)'), f + ' 길이 사라졌다');
  });
  /* 메뉴 안을 눌러도 문서 클릭(닫기)에 안 닿게 막는다 */
  assert.match(h, /class="attmenu"[^>]*onclick="event\.stopPropagation\(\)"/);
});

test('★★ 못 그리는 파일에는 «흐린 미리보기 없음»(disabled) — 감추지도 켜 두지도 않는다', () => {
  const h = makeHtmlBox().render({ slug: 'INBOX-a', uid: '1', atts: FILES });
  assert.match(h, /class="peek" onclick="mbAttPeek\(0\)" onmouseenter="mbAttPeekHover\(0\)"/, '그릴 수 있는 것의 미리보기');
  assert.match(h, /class="peek off" disabled[\s\S]{0,200}미리보기 없음/, 'zip 의 흐린 단추');
  assert.doesNotMatch(h, /mbAttPeek\(1\)/, '못 그리는 것에 살아 있는 미리보기가 달렸다');
});

test('★★ 「모두저장」은 첨부가 둘 이상일 때만 · 지난 메일(POP3)에는 안 넣는다', () => {
  const b = makeHtmlBox();
  assert.match(b.render({ slug: 'INBOX-a', uid: '1', atts: FILES }), /onclick="mbAttAll\(\)"[^>]*>모두저장/);
  assert.doesNotMatch(b.render({ slug: 'INBOX-a', uid: '1', atts: [FILES[0]] }), /모두저장/, '하나뿐인데 모두저장이 뜬다');
  assert.doesNotMatch(b.render({ slug: '*old', uid: 'K', atts: FILES }), /모두저장/, '지난 메일은 첨부마다 메일 통째를 받아야 한다');
});

test('★ 이름은 이스케이프한다 — 파일 이름이 글자 그대로 들어가지 않는다', () => {
  const h = makeHtmlBox().render({ slug: 'INBOX-a', uid: '1', atts: [{ name: '<img src=x onerror=alert(1)>.hwp', size: 10 }] });
  assert.doesNotMatch(h, /<img src=x/);
});

test('★ 종류 그림 — 그림·표·문서·압축·그 밖', () => {
  const b = makeHtmlBox();
  assert.equal(b.mbAttIcon('a.png', ''), '🖼');
  assert.equal(b.mbAttIcon('a.xlsx', ''), '📊');
  assert.equal(b.mbAttIcon('a.hwp', ''), '📄');
  assert.equal(b.mbAttIcon('a.zip', ''), '🗜');
  assert.equal(b.mbAttIcon('a.exe', ''), '📎');
});

/* ── 「보내기 ▾」 열고 닫기 ── */
function makeMenuBox() {
  const els = {};
  [0, 1, 2].forEach((i) => {
    const set = new Set();
    els['mbAttMenu' + i] = { classList: { add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c) }, __set: set };
  });
  const box = {
    document: {
      getElementById: (id) => els[id] || null,
      querySelectorAll: () => Object.values(els).filter((e) => e.__set.has('open')),
      addEventListener() {},
    },
    console,
  };
  vm.createContext(box);
  vm.runInContext(fn('mbAttMenuClose') + '\n' + fn('mbAttMenu') + '\n;this.mbAttMenu = mbAttMenu; this.mbAttMenuClose = mbAttMenuClose;', box);
  box.els = els;
  return box;
}

test('★★ 「보내기 ▾」 — 한 번 누르면 열리고, 또 누르면 닫히고, 다른 줄을 열면 앞의 것은 닫힌다', () => {
  const b = makeMenuBox();
  const stop = { stopPropagation() { this.n = (this.n || 0) + 1; } };
  b.mbAttMenu(0, stop);
  assert.equal(b.els.mbAttMenu0.__set.has('open'), true, '안 열린다');
  b.mbAttMenu(1, stop);
  assert.equal(b.els.mbAttMenu0.__set.has('open'), false, '다른 줄을 열었는데 앞의 것이 안 닫힌다');
  assert.equal(b.els.mbAttMenu1.__set.has('open'), true);
  b.mbAttMenu(1, stop);
  assert.equal(b.els.mbAttMenu1.__set.has('open'), false, '또 누르면 닫혀야 한다');
  assert.ok(stop.n >= 3, '문서 클릭(바깥 닫기)에 같이 닫혀 버린다 — stopPropagation 이 없다');
});

/* ── 모두저장 ── */
function makeAllBox(o) {
  const opt = o || {};
  const log = { fetched: [], zipped: [], download: 0, toast: [], dl: null };
  class JSZip { file(n, b) { log.zipped.push(n); } generateAsync() { return Promise.resolve({ size: 1 }); } }
  const box = {
    console, Promise, Object, Array, Number, String, Math, setTimeout,
    MB_OLD_ID: '*old', MB_ATT_ALL_WARN: 50 * 1024 * 1024,
    state: { mbOpen: opt.open || { slug: 'INBOX-a', uid: '9', atts: [{ name: 'a.hwp', size: 10 }, { name: 'a.hwp', size: 10 }, { name: '표.xlsx', size: 10 }] } },
    window: { JSZip }, JSZip,
    fmtMB: (b) => b + 'B', confirm: () => !!opt.confirmYes,
    toast: (m) => { log.toast.push(m); },
    mbPvLib: () => Promise.resolve(),
    mbAttBytes: async (oo, i) => { log.fetched.push(i); return new Uint8Array(3); },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    puExport() {},
    document: { createElement: () => { const e = { click() { log.download++; log.dl = e.download; }, remove() {} }; return e; }, body: { appendChild() {} } },
  };
  vm.createContext(box);
  vm.runInContext('let _mbAttAllBusy = false;\n' + fn('mbAttAll') + '\n;this.mbAttAll = mbAttAll; this.__busy = () => _mbAttAllBusy;', box);
  box.log = log;
  return box;
}
const settle = () => new Promise((r) => setTimeout(r, 30));

test('★★ 모두저장 — 첨부를 «차례로» 받아 zip «하나»로, 다운로드는 «한 번»', async () => {
  const b = makeAllBox();
  b.mbAttAll();
  await settle();
  assert.deepEqual(JSON.parse(JSON.stringify(b.log.fetched)), [0, 1, 2], '차례로 받지 않았다');
  assert.equal(b.log.download, 1, '파일을 여러 번 받으면 브라우저가 「차단/허용」을 묻는다 — 한 번이어야 한다');
  assert.match(b.log.dl, /\.zip$/);
  assert.equal(b.__busy(), false, '끝났는데 잠금이 안 풀렸다 — 다시 못 누른다');
});

test('★★ 같은 이름이 둘이면 «덮어쓰지 않고» 번호를 붙인다 — 한 파일이 조용히 사라지면 안 된다', async () => {
  const b = makeAllBox();
  b.mbAttAll();
  await settle();
  const z = b.log.zipped;
  assert.equal(new Set(z).size, 3, '이름이 겹쳐 하나가 덮어써졌다: ' + z.join(' | '));
  assert.ok(z.indexOf('a.hwp') >= 0 && z.some((n) => /^a \(2\)\.hwp$/.test(n)), '번호 붙인 이름이 이상하다: ' + z.join(' | '));
});

test('★ 모두저장 — 지난 메일·첨부 하나뿐·이미 받는 중이면 안 한다', async () => {
  const old = makeAllBox({ open: { slug: '*old', uid: 'K', atts: [{ name: 'a', size: 1 }, { name: 'b', size: 1 }] } });
  old.mbAttAll(); await settle();
  assert.equal(old.log.download, 0, '지난 메일을 받았다');
  assert.ok(old.log.toast.some((t) => /지난 메일/.test(t)), '왜 안 되는지 말하지 않았다');
  const one = makeAllBox({ open: { slug: 'INBOX-a', uid: '1', atts: [{ name: 'a', size: 1 }] } });
  one.mbAttAll(); await settle();
  assert.equal(one.log.download, 0);
  const busy = makeAllBox();
  busy.mbAttAll(); busy.mbAttAll();
  await settle();
  assert.equal(busy.log.download, 1, '두 번 눌렀더니 두 번 받는다');
});

test('★ 50MB 가 넘으면 먼저 여쭙고, 「아니오」면 아무것도 안 받는다', async () => {
  const big = { slug: 'INBOX-a', uid: '1', atts: [{ name: 'a', size: 30 * 1024 * 1024 }, { name: 'b', size: 30 * 1024 * 1024 }] };
  const no = makeAllBox({ open: big, confirmYes: false });
  no.mbAttAll(); await settle();
  assert.equal(no.log.fetched.length, 0, '여쭙지 않고 받았다');
  const yes = makeAllBox({ open: big, confirmYes: true });
  yes.mbAttAll(); await settle();
  assert.equal(yes.log.download, 1);
});

/* ── 모양(CSS) ── */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
const CSS = strip(HTML.slice(0, HTML.indexOf('</style>')));
const rule = (sel) => { const i = CSS.indexOf(sel + '{'); return i < 0 ? '' : CSS.slice(i, CSS.indexOf('}', i)); };

test('★★ 한 줄이다 — 줄은 nowrap, 이름은 …로 자른다(폰 폭에서만 줄바꿈)', () => {
  assert.match(rule('.atts .attrow'), /white-space:nowrap/, '첨부 줄이 두 줄로 꺾일 수 있다');
  const nm = rule('.atts .attrow .nm');
  assert.match(nm, /overflow:hidden/);
  assert.match(nm, /text-overflow:ellipsis/);
  assert.match(nm, /min-width:0/, 'min-width:0 이 없으면 긴 이름이 줄을 밀어낸다');
});

test('★★ 「보내기」 메뉴는 «닫혀 있는 게 기본» — .open 일 때만 보인다', () => {
  assert.match(rule('.atts .attmenu'), /display:none/);
  assert.match(rule('.atts .attmenu.open'), /display:block/);
});
