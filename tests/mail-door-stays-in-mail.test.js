'use strict';
/* 메일 문(?view=mail)에서 메일을 눌러도 «기업정보함으로 들어가지» 않는다 (대표 지적 2026-10-19)

   「메일함에 클릭했는데 왜 기업정보함으로 들어가서 화면이 바뀌냐? … 메일함 기업정보함 연결되어 있는 거
    제대로 다 정리해 달라」

   ■ 무슨 일이었나 — 한 파일(pu-cards.html)에 «문이 둘»이다(기업정보함 · 푸른 메일).
     ① 폰 메일 목록(.dmm)은 화면을 통째로 덮는 앱 차림(검정 바탕 · position:fixed)인데, 읽기는 PC 것(.dm-read)을
        «흐름 속에» 그려 덮개 «아래»에 깔렸다. 메일을 누르는 순간 덮개가 걷히며 기업정보함 머리줄과 흰 바탕이 드러났다.
     ② 머리줄 이름이 메일 문에서도 「기업정보함」이었다(탭 제목·홈 화면 이름은 이미 「푸른 메일」).
     ③ 메일 화면의 「‹ 목록」·「← 목록으로」가 «명함 목록»으로 나갔다 — 메일 문에서 누르면 메일 주소 그대로
        내용만 명함으로 바뀌었다.
     ④ 「‹ 기업정보함으로」(서랍·옆줄)도 화면만 갈아 끼웠다 — 주소·제목은 메일, 내용은 명함인 «섞인 문».

   ■ 지킬 것(값이 아니라 «규칙»)
     ① 폰 읽기는 목록과 «같은 전체 화면 틀»에 담긴다 — 머리줄이 안 드러난다
     ② 읽기 틀의 맨 위(‹ 목록 · ▲ · ▼)는 스크롤해도 붙어 있다
     ③ 메일 문의 머리줄 이름은 「푸른 메일」이되, 마크업의 「기업정보함」은 지운 것이 아니다(CSS 로만 바꾼다)
     ④ 「목록으로」 단추는 mailBack — 메일 문이면 메일함, 기업정보함 문이면 예전 그대로
     ⑤ 나가는 길(「기업정보함으로」)은 closeMailPage — 메일 문에서는 «문을 바꾼다»(쓰던 편지는 임시저장)
     ⑥ 나가는 길은 «끊기지 않는다» — 갇히면 안 된다

   실행: node --test tests/mail-door-stays-in-mail.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const fn = (name) => sliceFn(app, 'function ' + name + '(');
const css = app.slice(app.indexOf('<style>'), app.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 「선택자{…}」 덩이 가운데 선택자 목록에 want(정규식)에 맞는 것이 하나라도 있는 것 — 중첩(@media) 안은 풀어서 읽는다 */
function rules(src, want) {
  const flat = src.replace(/@media[^{]*\{/g, ' ');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(flat))) {
    const sels = m[1].split(',').map((s) => s.trim());
    if (sels.some((s) => want.test(s))) out.push({ sel: m[1].trim(), body: m[2].replace(/\s+/g, '') });
  }
  return out;
}
const z = (body) => { const m = /z-index:(-?\d+)/.exec(body); return m ? Number(m[1]) : null; };

/* ── ① 폰 읽기도 «같은 전체 화면 틀» ── */
test('★★ ① 폰에서 메일을 열면 읽기가 «덮개(.dmr)»에 담긴다 — 기업정보함 머리줄이 안 드러난다', () => {
  const ctx = {
    String, state: { mbOpen: { slug: 'IN', uid: '1' } },
    mbReadHtml: () => '[READ]', mbPvHtml: () => '[PV]', mbNewHtml: () => '[NEW]',
  };
  vm.createContext(ctx);
  vm.runInContext(fn('mbMobileHtml'), ctx);
  const out = ctx.mbMobileHtml();
  assert.match(out, /^<div class="dmr">\[READ\]<\/div>/,
    '★★ 읽기가 덮개 «밖»에 그려집니다 — 목록(전체 화면)과 달리 기업정보함 머리줄 아래에 깔려 화면이 바뀐 것처럼 보입니다');
  /* 팝업(미리보기·새 주소)은 덮개 «밖»이다 — 덮개 안에 두면 position:fixed 가 덮개에 갇혀 잘린다 */
  assert.ok(out.indexOf('[PV]') > out.indexOf('</div>'), '미리보기 창이 덮개 안에 들어갔습니다');
  assert.ok(out.indexOf('[NEW]') > out.indexOf('[PV]'), '처음 보는 주소 창이 사라졌습니다');
});

test('★★ ① 덮개(.dmr)는 목록(.dmm)과 «같은 틀» — 화면 전체·같은 층, 팝업보다는 아래', () => {
  const dmr = rules(css, /^\.dmr$/).filter((r) => /position:fixed/.test(r.body));
  assert.ok(dmr.length, '★★ .dmr 이 화면 전체(position:fixed)를 덮지 않습니다 — 아래 기업정보함 머리줄이 드러납니다');
  const b = dmr[0].body;
  assert.match(b, /inset:0|top:0[^}]*left:0/, '.dmr 이 화면 전체를 덮지 않습니다');
  assert.match(b, /overflow-y:auto/, '.dmr 이 스스로 스크롤하지 않습니다 — 긴 메일이 잘립니다');
  const dmm = rules(css, /^\.dmm$/).filter((r) => /position:fixed/.test(r.body))[0];
  assert.ok(dmm, '목록(.dmm) 규칙을 못 찾았습니다');
  assert.equal(z(b), z(dmm.body), '읽기 덮개와 목록 덮개의 층이 다릅니다 — 한쪽만 다른 것 위/아래로 갑니다');
  const pop = rules(css, /^\.mck-dim$/)[0];
  assert.ok(pop && z(b) < z(pop.body), '★★ 덮개가 팝업(.mck-dim)보다 위입니다 — 첨부 미리보기·주소 등록 창이 가려집니다');
});

/* ── ② 맨 위 줄은 붙어 있다 ── */
test('★ ② 읽기 덮개의 맨 위 «한 줄»(‹ 목록 · ▲ · ▼)만 스크롤해도 따라온다 — 돌아갈 길은 남고 화면은 안 막힌다', () => {
  /* 붙는 것이 두 줄(오가는 길 + 답장·전달…)이면 내릴수록 화면의 1/9 이 막힌다(대표 캡처 2026-10-19 「깔끔하게」).
     sticky 는 «부모 상자 안»에서만 붙으므로 .rtop 을 풀어(display:contents) .rgt 가 .dm-read 의 직접 자식이 되게 한다. */
  assert.ok(rules(css, /^\.dmr\s+\.dm-read\s+\.rtop$/).some((x) => /display:contents/.test(x.body)),
    '★ .rtop 이 안 풀렸습니다 — .rgt 가 키 작은 .rtop 안에 갇혀 스크롤하면 같이 사라집니다');
  const rgt = rules(css, /^\.dmr\s+\.dm-read\s+\.rtop\s+\.rgt$/).filter((x) => /position:sticky/.test(x.body) && /top:0/.test(x.body));
  assert.ok(rgt.length, '★ 오가는 길 줄이 붙어 있지 않습니다 — 긴 메일을 내리면 「‹ 목록」이 사라져 갇힙니다');
  assert.ok(/background:/.test(rgt[0].body), '붙는 줄에 바탕이 없습니다 — 본문 글자가 비쳐 뒤섞입니다');
  /* 이 메일에 하는 일(.lft)은 붙지 않는다 — 붙이면 다시 두 줄이 된다 */
  assert.ok(!rules(css, /^\.dmr\s+\.dm-read\s+\.rtop\s+\.lft$/).some((x) => /position:sticky/.test(x.body)),
    '★ 답장·전달 줄까지 붙어 있습니다 — 화면 위가 두 줄 막힙니다');
  /* 순서 — 오가는 길이 첫 줄, 이 메일에 하는 일이 그 다음 */
  const ord = (r) => { const m = /order:(-?\d+)/.exec(r.map((x) => x.body).join(';')); return m ? Number(m[1]) : null; };
  const o1 = ord(rgt), o2 = ord(rules(css, /^\.dmr\s+\.dm-read\s+\.rtop\s+\.lft$/));
  assert.ok(o1 !== null && o2 !== null && o1 < o2, '오가는 길이 이 메일에 하는 일보다 «위»가 아닙니다 — 단추 줄이 길면 목록 단추가 밀립니다');
});

/* ── ②-1 첨부는 «카드 한 장» ── */
test('★★ ②-1 폰 읽기의 첨부는 «두 줄» — 파일 이름 «통째로», 크기·미리보기·보내기는 아래 줄 (글자가 세로로 쌓이지 않는다)', () => {
  /* 2026-10-20 다음메일 모양(한 파일 = 한 줄)으로 바꾸면서 카드(.attone)를 줄(.attrow)로 바꿨다.
     PC 는 한 줄이지만 폰 폭에서는 이름이 잘려 무슨 파일인지 모른다 — 폰에서만 줄바꿈을 허락한다. */
  const row = rules(css, /^\.dmr\s+\.dm-read\s+\.atts\s+\.attrow$/);
  assert.ok(row.some((x) => /flex-wrap:wrap/.test(x.body)),
    '★★ 첨부 줄이 줄바꿈하지 않습니다 — 좁은 폰 폭에서 이름이 …로 잘려 무슨 파일인지 모릅니다');
  const name = rules(css, /^\.dmr\s+\.dm-read\s+\.atts\s+\.attrow\s+\.nm$/);
  assert.ok(name.some((x) => /white-space:normal/.test(x.body) && /flex:11calc\(100%-\d+px\)|flex-basis:calc\(100%/.test(x.body)),
    '파일 이름이 통째로 안 보입니다 — 단추들과 한 줄에 눌려 잘립니다');
  const btn = rules(css, /^\.dmr\s+\.dm-read\s+\.atts\s+\.attrow\s+\.(z|peek|send)$/);
  assert.ok(btn.some((x) => /white-space:nowrap/.test(x.body)),
    '★★ 첨부 단추가 줄바꿈될 수 있습니다 — 글자가 한 글자씩 세로로 쌓입니다');
});

/* ── ②-2 떠다니는 것은 읽는 동안 비킨다 ── */
test('★ ②-2 읽는 동안 떠다니는 🏠·즐겨찾기 손잡이가 본문 글자를 덮지 않는다', () => {
  const hide = rules(css, /^body:has\(\.dmr\)\s+\[data-pu-appbar-btn\]$/).filter((x) => /display:none!important/.test(x.body));
  assert.ok(hide.length, '★ 읽는 동안 🏠·즐겨찾기를 안 비킵니다 — 본문 글자를 덮습니다(대표 캡처)');
  /* 목록(.dmm)에서는 그대로 — 읽기를 나가면 도로 나온다 */
  assert.ok(!rules(css, /^body:has\(\.dmm\)\s+\[data-pu-appbar-btn\]$/).length, '목록에서도 🏠 를 치웠습니다 — 포털로 갈 길이 사라집니다');
});

/* ── ③ 머리줄 이름 ── */
test('★★ ③ 메일 문의 머리줄 이름은 「푸른 메일」 — CSS 로만 바꾼다(마크업·스크립트를 건드리지 않는다)', () => {
  const lab = rules(css, /^html\.maildoor\s+#appbar\s+\.logo::after$/).filter((x) => /content:'푸른메일'|content:"푸른메일"/.test(x.body.replace(/푸른 메일/g, '푸른메일')));
  assert.ok(lab.length, '★★ 메일 문 머리줄이 여전히 「기업정보함」입니다 — 탭 제목·홈 화면 이름은 「푸른 메일」인데 혼자 다릅니다');
  assert.ok(rules(css, /^html\.maildoor\s+#appbar\s+\.logo$/).some((x) => /font-size:0/.test(x.body)),
    '원래 글자를 안 감춥니다 — 「기업정보함푸른 메일」로 둘이 겹쳐 보입니다');
  /* 기업정보함 문은 그대로 — 마크업의 이름은 지우지 않았다 */
  assert.match(app, /<div class="logo">기업정보함<\/div>/, '기업정보함 문의 이름이 사라졌습니다');
  /* 마크업 사이에 <script> 를 끼우지 않는다 — 2.7MB 를 다 읽을 때까지 이름이 틀리게 보이고, 본문 마크업을 훑는 검사가 끊긴다 */
  const body = app.slice(app.indexOf('<body'));
  const bar = body.indexOf('<div id="appbar">');
  assert.ok(bar > 0, '#appbar 를 못 찾았습니다');
  assert.ok(!/<script>[^<]*#appbar \.logo/.test(body.slice(bar, bar + 4000)),
    '머리줄 이름을 바꾸는 스크립트가 #appbar 곁에 끼었습니다 — CSS(html.maildoor)로 하십시오');
  /* 문 표시(maildoor)는 «문»이라 화면이 안 뗀다 — render 가 떼는 mailview 에 걸면 자료함·설정에서 이름이 도로 바뀐다 */
  const head = app.slice(app.indexOf('<script>'), app.indexOf('</script>'));
  assert.match(head, /classList\.add\('maildoor'\)/, '★ 메일 문 표시(maildoor)를 <head> 가 안 붙입니다 — 머리줄 이름이 첫 그림부터 맞지 않습니다');
  assert.ok(!/classList\.toggle\('maildoor'/.test(app) && !/classList\.remove\('maildoor'/.test(app),
    '★ 화면이 문 표시를 떼거나 바꿉니다 — 자료함·설정으로 가면 머리줄이 「기업정보함」으로 돌아옵니다');
});

/* ── 서랍의 ⚙️ 환경설정 ── */
test('★★ ⑦ 폰 서랍의 ⚙️ 환경설정은 «메일» 설정으로 간다 — 기업정보함 설정으로 새면 화면이 통째로 기업정보함이 된다', () => {
  const drawer = fn('mbDrawerHtml');
  assert.match(drawer, /onclick="openMailSetPage\(\)"[^>]*>⚙️ 환경설정/, '★★ 서랍의 환경설정이 메일 설정으로 안 갑니다');
  assert.ok(drawer.indexOf('openSettingsPage()') < 0, '★★ 서랍에 기업정보함 설정(openSettingsPage)이 남았습니다');
  /* PC 옆줄은 이미 «창 따라» 갈린다 — 폰 서랍도 그 뜻과 같아야 한다 */
  assert.match(app, /onMailNow\s*\n?\s*\?\s*`<button class="pcside-settings" onclick="openMailSetPage\(\)"/, 'PC 옆줄의 메일 설정 길이 사라졌습니다');
});

/* ── ④ 「목록으로」 ── */
function backBox(door) {
  const calls = [];
  const ctx = {
    urlWantsMail: () => door,
    openMailBox: (id) => calls.push('box:' + id),
    mbNow: () => 'IN-SLUG',
    closeMailPage: () => calls.push('close'),
  };
  vm.createContext(ctx);
  vm.runInContext(fn('mailBack'), ctx);
  ctx.__calls = calls;
  return ctx;
}
test('★★ ④ 메일 문에서 「‹ 목록」은 «메일함» — 명함 목록으로 나가지 않는다', () => {
  const c = backBox(true);
  c.mailBack();
  assert.deepEqual(Array.from(c.__calls), ['box:IN-SLUG'],
    '★★ 메일 문에서 목록 단추가 메일함을 안 엽니다: ' + JSON.stringify(c.__calls));
});
test('④ 기업정보함 문에서 「‹ 목록」은 예전 그대로 — 명함 목록으로 돌아간다', () => {
  const c = backBox(false);
  c.mailBack();
  assert.deepEqual(Array.from(c.__calls), ['close'], '기업정보함 문의 동작이 바뀌었습니다: ' + JSON.stringify(c.__calls));
});
test('★★ ④ 메일 화면의 «목록으로» 단추는 전부 mailBack — closeMailPage 를 부르면 메일 문에서 명함으로 샌다', () => {
  const found = [...app.matchAll(/<button class="(?:setback|mmback)"[^>]*onclick="([^"]+)"[^>]*>([^<]*)</g)];
  const viaBack = found.filter((m) => /^mailBack\(\)$/.test(m[1]));
  assert.ok(viaBack.length >= 4, '메일 화면의 「목록으로」 단추를 ' + viaBack.length + '개밖에 못 찾았습니다 — 찾는 법이 낡았습니다');
  /* 이 단추가 «나가는 길»(closeMailPage)을 부르면 메일 문에서 누를 때 문이 바뀐다 — 목록으로 가려던 것이 기업정보함이 된다.
     ⚠ 자료함(closeMatPage)은 «왔던 곳»(_matFrom)으로, 기업정보함 설정(closeSettingsPage)은 명함 쪽 화면이라 여기서 뺀다. */
  const bad = found.filter((m) => /closeMailPage\(\)/.test(m[1]));
  assert.deepEqual(bad.map((m) => m[2] + ' → ' + m[1]), [],
    '★★ 이 단추가 closeMailPage 입니다 — 메일 문에서 누르면 기업정보함으로 나갑니다(mailBack 을 쓰십시오)');
});

/* ── ⑤⑥ 나가는 길 ── */
function exitBox(door, touched) {
  const log = { href: null, saved: 0, rendered: 0 };
  const ctx = {
    urlWantsMail: () => door,
    composeTouched: () => touched,
    saveDraft: () => { log.saved++; },
    state: { view: 'mail' },
    render: () => { log.rendered++; },
    location: { set href(v) { log.href = v; }, get href() { return ''; } },
    _compose: { x: 1 },
  };
  vm.createContext(ctx);
  vm.runInContext(fn('closeMailPage'), ctx);
  ctx.__log = log;
  return ctx;
}
test('★★ ⑤ 메일 문에서 「기업정보함으로」는 «문을 바꾼다» — 주소·제목은 메일, 내용만 명함인 섞인 문을 만들지 않는다', () => {
  const c = exitBox(true, false);
  c.closeMailPage();
  assert.equal(c.__log.href, 'pu-cards.html', '★★ 메일 문에서 나가는데 기업정보함 문(주소)으로 안 갑니다');
  assert.equal(c.state.view, 'mail', '화면만 갈아 끼웠습니다 — 이름·아이콘은 메일인 채로 명함이 보입니다');
  assert.equal(c.__log.saved, 0, '쓰던 것이 없는데 임시저장을 만들었습니다');
});
test('⑤ 쓰던 편지가 있으면 «임시저장하고» 나간다 — 문을 바꾸며 글을 잃지 않는다', () => {
  const c = exitBox(true, true);
  c.closeMailPage();
  assert.equal(c.__log.saved, 1, '★ 쓰던 편지를 임시저장 안 하고 나갑니다');
  assert.equal(c.__log.href, 'pu-cards.html');
});
test('⑤ 기업정보함 문에서는 예전 그대로 — 주소를 안 바꾸고 화면만 명함으로', () => {
  const c = exitBox(false, false);
  c.closeMailPage();
  assert.equal(c.__log.href, null, '기업정보함 문에서 주소를 바꿨습니다');
  assert.equal(c.state.view, 'list');
  assert.equal(c.__log.rendered, 1);
});
test('★ ⑥ 「기업정보함으로」 나가는 길은 서랍(폰)과 옆줄(PC) 둘 다 closeMailPage — 끊기면 메일 창에 갇힌다', () => {
  const drawer = fn('mbDrawerHtml');
  assert.match(drawer, /onclick="closeMailPage\(\)">‹ 기업정보함으로/, '폰 서랍에서 기업정보함으로 나갈 길이 없습니다');
  const at = app.indexOf('class="pcside-settings" onclick="closeMailPage()"');
  assert.ok(at > 0, 'PC 옆줄에서 기업정보함으로 나갈 길이 없습니다');
});
