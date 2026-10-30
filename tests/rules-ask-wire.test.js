/* 취업규칙 ✏️ 검토·개정 — 「💬 이 문서에 묻기」 rules.html 잇기 (설계 §13 · 2026-10-30 목업 「추천대로」). 이름은 가짜만.
   화면 토막(ASK … askClick)과 그것이 쓰는 화면 함수(parseArticles·polCoName·polErr)를 «그대로» 떼어 vm 에서 돌린다.
   부르기(PuAiCall.ask)만 가짜다. 가림(kordoc)·셈(lib-ask·lib-polish)·그리기(view-ask)는 진짜를 돌린다.
   문서는 화면에 들어 있는 «지어낸 샘플»(SAMPLES.A — 한빛산업)이다.
   ★ 못 박는 것은 규칙이다(값·문장 통째가 아니다):
     ① 보내는 글 — 회사 이름·주민번호·전화가 질문에서도 조문에서도 안 나간다 · 가림은 진짜로 돌았다 · app 은 rules
        · 질문과 관련된 조만 간다(문서 통째가 아니다) · 두 번 눌러도 한 번 부른다
     ② 걸리는 조가 없으면 부르지 않는다 · 가림이 실패하면 부르지 않는다 · 회사 이름을 모르면 묻고, 아니오면 안 부른다
     ③ 답 — {회사} 는 원문 꼴로 되돌린다 · 보내지 않은 조는 근거에서 빠진다 · 같은 조 검토는 «검토했을 때만»
     ④ 문서를 바꾸면 늦게 온 답은 버린다 · 열람 전용이어도 묻는다(읽기만 한다)
     ⑤ 근거를 누르면 왼쪽 원본의 그 조로 — 원문 보기 중이면 조문 보기로 돌린 뒤
     ⑥ 탭 — 켜고 끄기 · 조를 열거나 검토를 돌리면 검토 쪽으로 · 문서가 바뀌면 목록을 비운다
     ⑦ 실패 글은 ✨ 와 한 벌(하루 몫·로그인) · 이 토막은 서버에 아무것도 쓰지 않는다 · 부품은 캐시 번호를 달고 한 번만, 쓰는 부품보다 뒤에
        · 💬 단추는 원본 미리보기 단추 줄 맨 앞 · 묻는 칸 글씨는 폰이 확대하지 않을 만큼 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const A = require('../js/rules-v2/lib-ask.js');
const AV = require('../js/rules-v2/view-ask.js');
const P = require('../js/rules-v2/lib-polish.js');
const KT = require('../js/pu-kordoc-text.js');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
// 줄끝은 여기 한 곳에서 맞춘다 — 윈도우 체크아웃(CRLF)에서 「;\n」 찾기가 조용히 빗나가지 않게
const HTML = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8').replace(/\r\n/g, '\n');
const BARE = stripComments(HTML);
const AI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-ai-call.js'), 'utf8');

function cutFn(src, name) {
  const a = src.indexOf('function ' + name + '(');
  assert.ok(a >= 0, name + ' 이 없다');
  let i = src.indexOf('{', a), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(a, i + 1);
}
const line = (start) => { const i = BARE.indexOf(start); assert.ok(i >= 0, start + ' 이 없다'); return BARE.slice(i, BARE.indexOf('\n', i)); };
/* 화면이 쓰는 함수들 — rules.html 의 것 그대로 */
const SCREEN_SRC = (() => {
  const a = BARE.indexOf('const stripWs');
  const b = BARE.indexOf('function stripToc(');
  assert.ok(a > 0 && b > a, '조 머리 정규식(stripWs…RE_TOC_LINE)을 찾지 못했습니다');
  return BARE.slice(a, b) + '\n' + cutFn(BARE, 'stripToc') + '\n' + cutFn(BARE, 'parseArticles') + '\n' + cutFn(BARE, 'escapeH')
    + '\n' + line('const _norm=') + '\n' + line('const _digits=') + '\n' + cutFn(BARE, 'polCoName') + '\n' + cutFn(BARE, 'polErr');
})();
/* 화면의 «💬 묻기» 토막 — ASK 부터 클릭 손잡이까지 */
function askSection() {
  const a = BARE.indexOf('const ASK=');
  assert.ok(a > 0, 'ASK 토막이 없다');
  const b = BARE.indexOf('\n}', BARE.indexOf('function askClick', a));
  assert.ok(b > a, 'askClick 이 없다');
  return BARE.slice(a, b + 2);
}
const SAMPLE_A = (() => {
  const i = HTML.indexOf('const SAMPLES = ');
  assert.ok(i > 0, '화면 샘플이 없다');
  return JSON.parse(HTML.slice(i + 'const SAMPLES = '.length, HTML.indexOf(';\n', i))).A;
})();

let kordocReady = null;
function kordoc() {
  if (!kordocReady) kordocReady = import(pathToFileURL(path.join(ROOT, 'vendor/kordoc/kordoc.browser.min.js')).href).then((K) => { KT._use(K); return K; });
  return kordocReady;
}

const CO = '한빛산업';
const RRN = '900101-1234567';
const replyOf = (o) => ({ candidates: [{ content: { parts: [{ text: typeof o === 'string' ? o : JSON.stringify(o) }] } }] });
const fenced = (p, tag) => p.slice(p.lastIndexOf('〈' + tag + '〉') + tag.length + 3, p.lastIndexOf('\n〈/' + tag + '〉'));

function harness(o) {
  o = o || {};
  const els = {};
  const cls = () => { const s = new Set(); return { toggle(c, on) { if (on) s.add(c); else s.delete(c); }, contains: (c) => s.has(c) }; };
  const $ = (id) => els[id] || (els[id] = { id, innerHTML: '', value: '', textContent: '', style: {}, focused: 0, classList: cls(),
    focus() { this.focused++; }, addEventListener() {} });
  const calls = { ask: [], confirms: [], go: [], render: 0 };
  const auth = { currentUser: { getIdToken: () => Promise.resolve('토큰') } };
  const doc = o.doc != null ? o.doc : SAMPLE_A;
  const ctx = {
    $, console: { warn() {}, info() {}, log() {} }, Promise, Date, Object, Array, String, Number, Set, Map, JSON, Math, RegExp, Error, Uint8Array,
    READONLY: !!o.readonly, PV_VIEW: o.view || 'arts', PICK_MODE: false,
    SAMPLES: { A: doc, B: '제1조(목적) 다른 문서다.' }, SITE_NAME: {}, SITE_MAP: { A: '🏢 ' + CO, B: '🏢 다른회사' }, SITE_BIZNO: { A: '', B: '' },
    siteSel: { value: 'A' }, LAST: o.last !== undefined ? o.last : null,
    ALL_FINDINGS: o.findings || [],
    ERP_COS: o.erp !== undefined ? o.erp : [{ id: 1, name: CO, bizNo: '123-81-00001' }],
    loadErpCompanies() { return Promise.resolve(ctx.ERP_COS); },
    confirm: (m) => { calls.confirms.push(m); return calls.yes !== false; },
    alert() {},
    focusPreviewArticle: (l) => calls.go.push(l),
    renderPreview: () => { calls.render++; },
    firebase: { auth: () => auth },
    PuRulesAsk: A, PuRulesAskView: AV, PuRulesPolish: P,
    PuKordocText: o.kt || KT,
  };
  vm.createContext(ctx);
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(AI_SRC, ctx);
  ctx.PuAiCall.ask = (parts, opts) => {
    calls.ask.push({ parts, opts });
    return o.ask ? o.ask(parts, opts, calls.ask.length) : Promise.resolve(replyOf({ answer: '{회사}는 유급 경조휴가를 줍니다.', cites: [{ label: '제16조' }], none: false }));
  };
  vm.runInContext(SCREEN_SRC + '\n' + askSection()
    + '\nthis.__t={ASK:ASK,askSend:askSend,askTab:askTab,askReset:askReset,askClick:askClick};', ctx);
  const t = ctx.__t;
  const ask = (q) => { $('ask-q').value = q; return t.askSend(); };
  const settle = async () => { for (let i = 0; i < 400 && t.ASK.busy; i++) await new Promise((r) => setTimeout(r, 2)); await new Promise((r) => setTimeout(r, 0)); };
  const list = () => $('ask-list').innerHTML;
  return { ctx, calls, t, $, ask, settle, list };
}

test('① 보내는 글 — 회사 이름·주민번호·전화가 안 나간다 · 가림은 진짜로 돌았다 · app 은 rules', async () => {
  await kordoc();
  const doc = SAMPLE_A.replace('제16조(경조휴가) 회사는', '제16조(경조휴가) 담당 홍길동(' + RRN + ', 010-1234-5678)이 관리하며 회사는');
  const H = harness({ doc });
  await H.ask(CO + ' 직원이 결혼하면 경조휴가 있나요? 문의 010-9876-5432');
  await H.settle();
  assert.equal(H.calls.ask.length, 1);
  const { parts, opts } = H.calls.ask[0];
  const p = parts[0].text;
  assert.ok(!/한빛\s*산업/.test(p), '회사 이름이 나갔다');
  assert.ok(!p.includes(RRN) && !p.includes('1234567'), '주민번호가 나갔다');
  assert.ok(!p.includes('1234-5678') && !p.includes('9876-5432'), '전화번호가 나갔다');
  assert.ok(p.includes(P.MASK), '가린 자리 표시가 없다 — 가림이 안 돌았다');
  assert.match(fenced(p, '질문'), /\{회사\}/, '질문 속 회사 이름을 {회사} 로 바꾸지 않았다');
  assert.equal(opts.app, 'rules');
});

test('① 관련된 조만 간다 — 문서 통째가 아니다 · 많아야 MAX 개', async () => {
  await kordoc();
  const H = harness();
  await H.ask('결혼하면 경조휴가 며칠?');
  await H.settle();
  const data = fenced(H.calls.ask[0].parts[0].text, '조문');
  assert.match(data, /【제16조 경조휴가】/);
  const heads = data.match(/【제\d+조/g) || [];
  assert.ok(heads.length >= 1 && heads.length <= A.MAX);
  assert.ok(heads.length < H.ctx.parseArticles(SAMPLE_A).length, '문서 통째를 보냈다');
  assert.ok(!/감급의 제한/.test(data), '관련 없는 조(감급의 제한)까지 보냈다');
});

/* 답을 «붙잡아 두는» 가짜 — 부를 때마다 놓아줄 손잡이를 쌓는다(하나만 쥐면 둘째 부름이 첫째를 영영 묶어 검사가 «취소»로 끝난다) */
function held() {
  const rel = [];
  return {
    rel,
    ask: () => new Promise((r) => rel.push(() => r(replyOf({ answer: '{회사}는 경조휴가를 줍니다.', cites: [{ label: '제16조' }] })))),
    async until(n) { for (let i = 0; i < 400 && rel.length < n; i++) await new Promise((r) => setTimeout(r, 5)); },
    all() { rel.splice(0).forEach((f) => f()); },
  };
}

test('① 두 번 눌러도 한 번 부른다', async () => {
  await kordoc();
  const g = held();
  const H = harness({ ask: g.ask });
  const first = H.ask('경조휴가 있나요?');
  await g.until(1);
  const second = H.ask('경조휴가 있나요?');
  await new Promise((r) => setTimeout(r, 30));
  g.all(); await Promise.all([first, second]); await H.settle(); g.all();
  assert.equal(H.calls.ask.length, 1, '부르는 중에 또 불렀다');
});

test('② 걸리는 조가 없으면 부르지 않는다 — 로컬에서 끝났다고 보인다', async () => {
  // ⚠ 두 글자 조각은 우연히 겹치기 쉽다(「이용」 ⊂ 「이용하여」) — 샘플에 정말 없는 말로 묻는다.
  //   우연히 걸리면 AI 가 «조항이 없다»고 답한다(틀린 답이 아니라 몫을 한 번 쓸 뿐이다)
  const H = harness();
  await H.ask('골프 동호회 가입');
  await H.settle();
  assert.equal(H.calls.ask.length, 0, '걸리는 조가 없는데 AI 를 불렀다');
  assert.match(H.list(), /관련 조를 찾지 못했습니다/);
});

test('② 가림이 실패하면 부르지 않는다', async () => {
  const kt = Object.assign({}, KT, { redactFile: () => Promise.reject(new Error('가림 고장')) });
  const H = harness({ kt });
  await H.ask('경조휴가 있나요?');
  await H.settle();
  assert.equal(H.calls.ask.length, 0, '가리지 못한 글을 보냈다');
  assert.match(H.list(), /ask-err/);
  assert.match(H.list(), /가림 고장/);
});

test('② 회사 이름을 모르면 묻는다 — 아니오면 부르지 않는다', async () => {
  await kordoc();
  const H = harness({ erp: [] });
  H.calls.yes = false;
  await H.ask('경조휴가 있나요?');
  await H.settle();
  assert.equal(H.calls.confirms.length, 1);
  assert.match(H.calls.confirms[0], /회사 이름/);
  assert.equal(H.calls.ask.length, 0);
  assert.equal(H.t.ASK.busy, false);
});

test('③ 답 — {회사} 는 원문 꼴로 · 보내지 않은 조는 빠진다 · 검토 전이면 «검토 전»', async () => {
  await kordoc();
  const H = harness({ ask: () => Promise.resolve(replyOf({ answer: '{회사}는 유급 경조휴가를 줍니다.', cites: [{ label: '제16조' }, { label: '제99조' }] })) });
  await H.ask('경조휴가 있나요?');
  await H.settle();
  const e = H.t.ASK.list[0];
  assert.equal(e.state, 'ready');
  assert.match(e.answer, /한빛산업/, '{회사} 를 되돌리지 않았다');
  assert.ok(!/\{회사\}/.test(e.answer));
  assert.deepEqual(e.cites.map((c) => c.label), ['제16조']);
  assert.equal(e.dropped, 1, '지어낸 조를 세지 않았다');
  assert.equal(e.review.state, 'before', '검토 안 한 문서에 판정을 붙였다');
  assert.match(H.list(), /data-ask-go="제16조"/);
});

test('③ 같은 조 검토 — 검토한 문서면 그 조의 지적을 붙인다', async () => {
  await kordoc();
  const findings = [{ loc: '제16조', status: '수동확인', rule: { id: 'X' } }, { loc: '제30조', status: '위반의심', rule: { id: 'Y' } }];
  const H = harness({ findings, last: { key: 'A', site: '🏢 ' + CO, res: [{ status: '적합' }] } });
  await H.ask('경조휴가 있나요?');
  await H.settle();
  const rv = H.t.ASK.list[0].review;
  assert.equal(rv.state, 'warn');
  assert.equal(rv.counts['수동확인'], 1);
  assert.equal(rv.counts['위반의심'], undefined, '근거가 아닌 조의 지적을 붙였다');
});

test('④ 문서를 바꾸면 늦게 온 답은 버린다 — 목록을 비웠든 안 비웠든', async () => {
  await kordoc();
  for (const reset of [true, false]) {
    const g = held();
    const H = harness({ ask: g.ask });
    const p = H.ask('경조휴가 있나요?');
    await g.until(1);
    H.ctx.siteSel.value = 'B';
    if (reset) H.t.askReset();
    g.all(); await p; await H.settle();
    assert.equal(H.t.ASK.list.length, 0, (reset ? '비운 뒤' : '목록이 남은 채') + ' 다른 문서에 앞 문서의 답(또는 «읽는 중»)이 남았다');
    assert.ok(!/한빛산업/.test(H.list()), '앞 문서의 답을 그렸다');
    assert.equal(H.t.ASK.busy, false);
  }
});

test('④ 열람 전용이어도 묻는다 — 읽기만 한다', async () => {
  await kordoc();
  const H = harness({ readonly: true });
  await H.ask('경조휴가 있나요?');
  await H.settle();
  assert.equal(H.calls.ask.length, 1);
});

test('⑤ 근거를 누르면 왼쪽 원본의 그 조로 — 원문 보기 중이면 조문 보기로 돌린 뒤', () => {
  const H = harness({ view: 'raw' });
  const click = (attr, val) => H.t.askClick({ target: { closest: (sel) => (sel.indexOf(attr) >= 0 ? { dataset: { askGo: val } } : null) } });
  click('data-ask-go', '제16조');
  assert.deepEqual(H.calls.go, ['제16조']);
  assert.equal(H.ctx.PV_VIEW, 'arts');
  assert.equal(H.calls.render, 1, '조문 보기로 다시 그리지 않았다');
  click('data-ask-go', '제30조');
  assert.equal(H.calls.render, 1, '이미 조문 보기인데 또 그렸다');
});

test('⑥ 탭 — 켜고 끄기 · 검토 지적을 누르면 검토 쪽으로', () => {
  const H = harness();
  H.t.askTab(true);
  assert.ok(H.$('right-pane').classList.contains('ask-on'));
  assert.ok(H.$('grid').classList.contains('ask-on'), '폰에서 묻기 칸을 위로 올릴 표시가 없다');
  assert.ok(H.$('tab-ask').classList.contains('on') && !H.$('tab-review').classList.contains('on'));
  assert.ok(H.$('ask-q').focused > 0, '묻는 칸에 커서를 두지 않았다');
  H.t.askClick({ target: { closest: (sel) => (sel.indexOf('data-ask-review') >= 0 ? {} : null) } });
  assert.ok(!H.$('right-pane').classList.contains('ask-on'));
});

test('⑥ 조를 열거나 검토를 돌리면 검토 쪽으로 · 문서가 바뀌면 목록을 비운다', () => {
  assert.match(cutFn(BARE, 'openArtEdit'), /askTab\(\s*false\s*\)/);
  assert.match(cutFn(BARE, 'resetReviewUI'), /askReset\(\)/);
  assert.match(BARE, /\$\("run"\)\.addEventListener\("click",\s*\(\)\s*=>\s*askTab\(false\)\)/);
  assert.match(BARE, /\.summary \.stat\[data-fs\]"\)\.forEach\(el=>el\.addEventListener\("click",\s*\(\)\s*=>\s*askTab\(false\)\)\)/);
  ['tab-ask', 'pv-ask', 'tab-review', 'ask-go', 'ask-q', 'ask-list'].forEach((id) =>
    assert.match(BARE, new RegExp('\\$\\("' + id + '"\\)\\.addEventListener\\('), id + ' 에 손잡이가 없다'));
});

test('⑦ 실패 글 — 하루 몫·로그인은 ✨ 와 한 벌, 그 밖은 «묻지 못했습니다» + 까닭', async () => {
  await kordoc();
  const err = (status, message) => Object.assign(new Error(message), { status });
  const run = async (e) => {
    const H = harness({ ask: () => Promise.reject(e) });
    await H.ask('경조휴가 있나요?'); await H.settle();
    return H.t.ASK.list[0].err;
  };
  assert.match(await run(err(429, 'RESOURCE_EXHAUSTED quota PerDay')), /오늘 AI 몫이 다 찼습니다/);
  assert.match(await run(err(401, 'unauth')), /로그인/);
  const other = await run(err(500, '서버 고장'));
  assert.match(other, /AI 에게 묻지 못했습니다/);
  assert.match(other, /서버 고장/);
  assert.ok(!/다듬기/.test(other), '✨ 다듬기의 글이 그대로 보인다');
});

test('⑦ 이 토막은 서버에 아무것도 쓰지 않는다', () => {
  const s = askSection();
  assert.ok(!/FBDB|\.ref\(|\.set\(|\.update\(|\.push\(|localStorage|indexedDB/.test(s.replace(/ASK\.list\.indexOf|ASK\.list\.unshift/g, '')),
    '💬 묻기 토막이 무엇인가를 저장한다');
});

test('⑦ 부품은 캐시 번호를 달고 한 번만 · 쓰는 부품보다 뒤 · 💬 단추는 단추 줄 맨 앞 · 묻는 칸 글씨 16px 이상', () => {
  const at = {};
  ['js/rules-v2/lib-polish', 'js/rules-v2/lib-ask', 'js/rules-v2/view-ask'].forEach((p) => {
    const hits = [...BARE.matchAll(new RegExp('<script src="' + p + '\\.js\\?v=(\\d+)"></script>', 'g'))];
    assert.equal(hits.length, 1, p + '.js 는 캐시 번호를 달고 한 번만 싣는다');
    at[p] = hits[0].index;
  });
  assert.ok(at['js/rules-v2/lib-polish'] < at['js/rules-v2/lib-ask'], 'lib-ask 는 lib-polish(답 읽개) 뒤에');
  // 머리(h3)는 flex 라 단추의 float:right 가 먹지 않는다 — 화면 차례 = 마크업 차례, «맨 앞»은 첫 단추
  const at0 = BARE.indexOf('id="pv-site"');
  const h3 = BARE.slice(BARE.lastIndexOf('<h3>', at0), BARE.indexOf('</h3>', at0));
  assert.match(h3, /원본 미리보기/, '원본 미리보기 머리를 못 찾았다');
  const ids = [...h3.matchAll(/<button[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 2);
  assert.equal(ids[0], 'pv-ask', '💬 묻기가 단추 줄 맨 앞이 아니다');
  assert.match(BARE, /\.pane h3\{[^}]*display:flex/, '머리가 flex 가 아니면 위 «차례» 규칙을 다시 봐야 한다');
  const css = BARE.match(/\.ask-pane \.ask-in input\{[^}]*font-size:(\d+)px/);
  assert.ok(css && +css[1] >= 16, '묻는 칸 글씨가 16px 보다 작다 — 아이폰이 누를 때마다 확대한다');
});
