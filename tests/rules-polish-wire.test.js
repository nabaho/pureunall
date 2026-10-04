/* 취업규칙 ✏️ 조문 편집 — 「✨ AI 다듬기」 rules.html 잇기 (Task 2 · 2026-10-04 목업 세 물음 「추천대로」). 이름은 가짜만.
   화면 토막(POL … polClick)을 «그대로» 떼어 vm 에서 돌린다 — 베껴 오면 화면이 바뀌어도 검사는 옛것을 본다.
   부르기(PuAiCall.ask)만 가짜다. 가림(kordoc)·셈(lib-polish)·상자(view-polish)·다시 판정(warnsOf)은 진짜를 돌린다.
   ★ 못 박는 것은 규칙이다(값·문장 통째가 아니다):
     ① 보내는 글에 회사 이름도, 주민번호도 없다 · 조 머리도 안 간다 · app 은 rules · 두 번 눌러도 한 번 부른다
     ② 「검토 지적 반영」은 그 조의 지적(위반의심·누락·수동확인)이 있을 때만 · 지적은 지시문에 실린다
     ③ 실패 글 — 하루 몫(429+quota 낱말) · 로그인 · 그 밖은 까닭째
     ④ 「이 판으로 바꾸기」는 열람 전용을 먼저 본다 · 머리(【】 포함)는 지키고 · {회사} 는 이 회사 이름으로
     ⑤ 조를 바꾼 뒤 늦게 온 답은 버린다 · 조를 열면 상자가 빈다
     ⑥ 다시 판정은 이 조·이 규모·검토 기준으로
     ⑦ 이 토막은 서버에 아무것도 쓰지 않는다 · 부품은 캐시 번호를 달고 한 번만, 쓰는 부품보다 뒤에 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const P = require('../js/rules-v2/lib-polish.js');
const PV = require('../js/rules-v2/view-polish.js');
const RV = require('../js/rules-v2/view-recommend.js');
const V = require('../js/rules-v2/view-topics.js');
const CR = require('../js/pu-rules-criteria.js');
const KT = require('../js/pu-kordoc-text.js');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8');
const BARE = stripComments(HTML);
const AI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-ai-call.js'), 'utf8');

function cutFn(src, name) {
  const a = src.indexOf('function ' + name + '(');
  assert.ok(a >= 0, name + ' 이 없다');
  let i = src.indexOf('{', a), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(a, i + 1);
}
/* 화면의 조 머리 정규식·머리 찾기·회사 이름 고르기 — rules.html 의 것 그대로 */
const HEAD_SRC = (() => {
  const a = HTML.indexOf('const BR_OPEN=');
  const b = HTML.indexOf('\n', HTML.indexOf('const RE_HEAD_SPLIT=', a));
  assert.ok(a > 0 && b > a, '조 머리 정규식(BR_OPEN…RE_HEAD_SPLIT)을 찾지 못했습니다');
  return HTML.slice(a, b) + '\n' + cutFn(BARE, 'artHeadOf') + '\n' + cutFn(BARE, 'aeOwnHead') + '\n' + cutFn(BARE, 'siteName') + '\n' + cutFn(BARE, 'escapeH');
})();
/* 화면의 «AI 다듬기» 토막 — POL 부터 클릭 손잡이까지 */
function polSection() {
  const a = BARE.indexOf('const POL=');
  assert.ok(a > 0, 'POL 토막이 없다');
  const b = BARE.indexOf('\n}', BARE.indexOf('function polClick', a));
  assert.ok(b > a, 'polClick 이 없다');
  return BARE.slice(a, b + 2);
}

/* 진짜 kordoc 가림 — 화면이 싣는 그 묶음 */
let kordocReady = null;
function kordoc() {
  if (!kordocReady) kordocReady = import(pathToFileURL(path.join(ROOT, 'vendor/kordoc/kordoc.browser.min.js')).href).then((K) => { KT._use(K); return K; });
  return kordocReady;
}

const CO = '가나상사';
const RRN = '900101-1234567';
const AFTER = '제20조(연차유급휴가) ① ㈜가나상사는 1년간 80퍼센트 이상 출근한 사원에게 15일의 유급휴가를 준다.\n'
  + '② 담당 홍길동(' + RRN + ', 010-1234-5678)이 휴가를 관리한다. 가나 상사의 사원은 쉰다.';
/* 구글 응답 모양 하나 */
const replyOf = (o) => ({ candidates: [{ content: { parts: [{ text: typeof o === 'string' ? o : JSON.stringify(o) }] } }] });
/* 지시문 속 〈조문〉 자료만 */
const sentBody = (prompt) => prompt.slice(prompt.lastIndexOf('〈조문〉') + '〈조문〉'.length + 1, prompt.lastIndexOf('\n〈/조문〉'));

function harness(o) {
  o = o || {};
  const els = {};
  const $ = (id) => els[id] || (els[id] = { id, innerHTML: '', value: '', textContent: '', style: {}, focused: 0,
    focus() { this.focused++; }, addEventListener() {} });
  $('size').value = '10인이상';
  $('ae-after').value = o.after != null ? o.after : AFTER;
  const calls = { ask: [], alerts: [], warns: [] };
  const auth = { currentUser: o.noUser ? null : { getIdToken: () => Promise.resolve('토큰') } };
  const ctx = {
    $, console: { warn() {}, info() {}, log() {} }, Promise, Date, Object, Array, String, Number, Set, Map, JSON, Math, RegExp, Error, Uint8Array,
    AE_LABEL: '제20조', AE_TITLE: '연차유급휴가', READONLY: false,
    ALL_FINDINGS: o.findings || [],
    SITE_INFO: null, LAST: { site: '📄 ' + CO }, SITE_MAP: {}, siteSel: { value: 'A' },
    alert: (m) => calls.alerts.push(m),
    fetch: () => { calls.fetch = (calls.fetch || 0) + 1; return Promise.reject(new Error('부르면 안 된다')); },
    firebase: { auth: () => auth },
    PuRulesPolish: P, PuRulesPolishView: PV, PuRulesV2RecommendView: RV, PuRulesCriteria: CR, PuKordocText: KT,
    PuRulesV2TopicsView: { warnsOf(g, M, size) { calls.warns.push({ g, M, size }); return V.warnsOf(g, M, size); } },
  };
  vm.createContext(ctx);
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(AI_SRC, ctx);   // 진짜 호출기 — 토큰 없으면 부르지 않는 길까지 진짜로
  if (!o.realAsk) {
    ctx.PuAiCall.ask = (parts, opts) => {
      calls.ask.push({ parts, opts });
      return o.ask ? o.ask(parts, opts, calls.ask.length) : Promise.resolve(replyOf({ text: sentBody(parts[0].text), why: '그대로' }));
    };
  }
  vm.runInContext(HEAD_SRC + '\n' + polSection() + '\nthis.__t={POL:POL,polSend:polSend,polClick:polClick,polMenu:polMenu};', ctx);
  const t = ctx.__t;
  const box = () => $('ae-pol').innerHTML;
  const click = (pol) => t.polClick({ target: { closest: (sel) => (/data-pol/.test(sel) ? { dataset: { pol } } : null) } });
  const settle = async () => { for (let i = 0; i < 400 && t.POL.busy; i++) await new Promise((r) => setTimeout(r, 2)); await new Promise((r) => setTimeout(r, 0)); };
  return { ctx, calls, t, box, click, settle, after: $('ae-after'), auth };
}
const finding = (loc, status, name) => ({ rule: { id: 'R1', name: name || '연차 일수', law: '근로기준법 §60', criterion: '1년 미만 연차 조항' }, status, loc, note: '관련 조항 미발견' });

test('① 보내는 글 — 회사 이름도 주민번호도 없다 · 머리는 안 간다 · app 은 rules · 가림은 진짜로 돌았다', async () => {
  await kordoc();
  const H = harness();
  H.t.polMenu();
  H.click('tidy');
  await H.settle();
  assert.equal(H.calls.ask.length, 1);
  const { parts, opts } = H.calls.ask[0];
  assert.equal(parts.length, 1);
  const prompt = parts[0].text, body = sentBody(prompt);
  assert.ok(!/가나\s*상사/.test(prompt), '회사 이름이 나갔다');
  assert.ok(!prompt.includes(RRN) && !prompt.includes('1234567'), '주민번호가 나갔다');
  assert.ok(!prompt.includes('1234-5678'), '전화번호가 나갔다');
  assert.ok(body.includes(P.MASK), '가린 자리 표시가 없다 — 가림이 안 돌았다');
  assert.match(body, /\{회사\}는/);
  assert.ok(!/제\s*20\s*조/.test(body), '조 머리가 함께 나갔다');
  assert.match(body, /^① /);
  assert.match(body, /\n② /, '줄바꿈이 사라졌다');
  assert.equal(opts.app, 'rules');
  assert.equal(opts.auth, H.auth, '로그인 증명을 넘기지 않았다');
  assert.ok(opts.generationConfig && /json/.test(opts.generationConfig.responseMimeType || ''), 'JSON 답을 청하지 않았다');
  // 가린 글 그대로 돌아오면 «가린 자리가 남았다»를 알린다 — parse 에 «보낸 가림 글»을 넘겼다는 뜻
  assert.match(H.box(), /가린 자리가 남아 있습니다/);
});

test('① 두 번 눌러도 한 번 부른다 — 끝나면 다시 부를 수 있다', async () => {
  await kordoc();
  const H = harness();
  H.t.polMenu();
  const a = H.t.polSend('tidy'), b = H.t.polSend('tidy');
  H.click('tidy');
  await Promise.all([a, b]); await H.settle();
  assert.equal(H.calls.ask.length, 1, '한 번 누르면 한 번 부른다');
  assert.match(H.box(), /AI 가 고친 판/);
  H.click('menu'); H.click('tidy'); await H.settle();
  assert.equal(H.calls.ask.length, 2, '끝난 뒤에도 막혀 있다');
});

test('② 「검토 지적 반영」은 그 조의 지적이 있을 때만 · 지적은 지시문에 실린다', async () => {
  await kordoc();
  const none = harness({ findings: [finding('제1조', '위반의심'), finding('제20조', '시행예정'), finding('제20조', '적합')] });
  none.t.polMenu();
  assert.match(none.box(), /data-pol="tidy"/);
  assert.doesNotMatch(none.box(), /data-pol="fix"/, '이 조의 지적이 없는데 지적 반영이 보인다');
  // 지적이 없으면 눌러도(옛 단추) 부르지 않는다
  await none.t.polSend('fix');
  assert.equal(none.calls.ask.length, 0);

  ['위반의심', '누락', '수동확인'].forEach((s) => {
    const H = harness({ findings: [finding('제20조', s)] });
    H.t.polMenu();
    assert.match(H.box(), /data-pol="fix"/, s + ' 지적인데 지적 반영이 안 보인다');
  });
  const H = harness({ findings: [finding('제20조', '위반의심', '연차 <일수>'), finding('제20조', '누락', '사용기간'), finding('제3조', '누락', '딴 조의 지적')] });
  H.t.polMenu();
  assert.match(H.box(), /지적 2건/);
  H.click('fix'); await H.settle();
  const prompt = H.calls.ask[0].parts[0].text;
  assert.ok(prompt.includes('연차 <일수>') && prompt.includes('사용기간'), '이 조의 지적이 지시문에 없다');
  assert.ok(!prompt.includes('딴 조의 지적'), '다른 조의 지적이 실렸다');
  const tidy = harness({ findings: [finding('제20조', '위반의심', '연차 일수')] });
  tidy.t.polMenu(); tidy.click('tidy'); await tidy.settle();
  assert.ok(!tidy.calls.ask[0].parts[0].text.includes('〈지적〉'), '뜻 그대로 다듬기에 지적이 실렸다');
});

test('③ 실패 글 — 하루 몫 · 로그인 · 그 밖은 까닭째 (어떤 실패도 상자 한 줄)', async () => {
  await kordoc();
  const fail = (status, message) => () => { const e = new Error(message); if (status) e.status = status; return Promise.reject(e); };
  const run = async (o) => { const H = harness(o); H.t.polMenu(); H.click('tidy'); await H.settle(); return H; };

  let H = await run({ ask: fail(429, 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 500') });
  assert.match(H.box(), /오늘 AI 몫이 다 찼습니다 — 내일 다시 해 주세요/);
  H = await run({ ask: fail(429, 'You exceeded your current quota') });
  assert.match(H.box(), /오늘 AI 몫이 다 찼습니다/);
  // 429 라도 하루 몫이 아니면 까닭째
  H = await run({ ask: fail(429, '잠시 바쁩니다') });
  assert.doesNotMatch(H.box(), /오늘 AI 몫/);
  assert.match(H.box(), /AI 다듬기를 못 했습니다 — 잠시 바쁩니다/);
  // 로그인이 없으면 진짜 호출기가 부르지 않고 던진다
  H = await run({ realAsk: true, noUser: true });
  assert.match(H.box(), /로그인을 확인해 주세요/);
  assert.ok(!H.calls.fetch, '로그인 없이 서버를 불렀다');
  H = await run({ ask: fail(500, '<b>서버</b> 오류') });
  assert.match(H.box(), /AI 다듬기를 못 했습니다 — /);
  assert.doesNotMatch(H.box(), /<b>서버/, '오류 글은 글자로만');
  // 못 읽는 답
  H = await run({ ask: () => Promise.resolve(replyOf('그냥 글')) });
  assert.match(H.box(), /AI 답을 읽지 못했습니다/);
  assert.equal(H.t.POL.busy, false, '실패 뒤에도 막혀 있다');
});

test('④ 「이 판으로 바꾸기」 — 열람 전용을 먼저 본다 · 머리(【】)는 지키고 {회사} 는 이 회사 이름으로', async () => {
  await kordoc();
  const ANS = { text: '① {회사}는 1년간 80퍼센트 이상 출근한 사원에게 15일의 유급휴가를 준다.\n② {회사}가 휴가를 관리한다.', why: '다듬음' };
  const H = harness({ after: '제20조【연차유급휴가】 ① 가나상사는 15일을 준다.\n② 옛 둘째 항', ask: () => Promise.resolve(replyOf(ANS)) });
  H.t.polMenu(); H.click('tidy'); await H.settle();
  assert.match(H.box(), /이 판으로 바꾸기/);
  const before = H.after.value;
  H.ctx.READONLY = true;
  H.click('use');
  assert.equal(H.after.value, before, '열람 전용인데 글을 바꿨다');
  assert.ok(H.calls.alerts.some((m) => /열람 전용/.test(m)));
  assert.match(H.box(), /AI 가 고친 판/, '열람 전용에서 상자를 닫았다');
  H.ctx.READONLY = false;
  H.click('use');
  assert.equal(H.after.value, '제20조【연차유급휴가】 ① 가나상사는 1년간 80퍼센트 이상 출근한 사원에게 15일의 유급휴가를 준다.\n② 가나상사가 휴가를 관리한다.');
  assert.doesNotMatch(H.after.value, /\{회사\}/);
  assert.equal(H.box(), '', '넣은 뒤 상자를 닫는다');
  assert.ok(H.after.focused > 0, '손을 「변경 후」 칸에');

  // 머리가 없으면 연 조의 머리(라벨 그대로 + 제목)
  const H2 = harness({ after: '머리 없는 글', ask: () => Promise.resolve(replyOf(ANS)) });
  H2.t.polMenu(); H2.click('tidy'); await H2.settle();
  H2.click('use');
  assert.ok(H2.after.value.startsWith('제20조(연차유급휴가) ① 가나상사는'), H2.after.value);
  // 버리기 — 「변경 후」는 그대로, 상자만 닫힌다
  const H3 = harness({ ask: () => Promise.resolve(replyOf(ANS)) });
  H3.t.polMenu(); H3.click('tidy'); await H3.settle();
  H3.click('drop');
  assert.equal(H3.after.value, AFTER);
  assert.equal(H3.box(), '');
});

test('⑤ 조를 바꾼 뒤 늦게 온 답은 버린다 · 조를 열면 상자가 빈다', async () => {
  await kordoc();
  let answer;
  const H = harness({ ask: () => new Promise((r) => { answer = () => r(replyOf({ text: '① {회사}는 쉰다.', why: '' })); }) });
  H.t.polMenu(); H.click('tidy');
  for (let i = 0; i < 400 && !answer; i++) await new Promise((r) => setTimeout(r, 2));
  assert.ok(answer, '부르지 않았다');
  assert.match(H.box(), /고치는 중/);
  H.ctx.AE_LABEL = '제1조';     // 그새 다른 조를 열었다
  answer(); await H.settle();
  assert.doesNotMatch(H.box(), /AI 가 고친 판/, '다른 조에 앞 조의 답이 그려졌다');
  H.click('use');
  assert.equal(H.after.value, AFTER, '다른 조에 앞 조의 답을 넣었다');
  assert.equal(H.t.POL.busy, false);
  // 같은 조로 돌아와도(열 때마다 상자를 비우므로) 옛 답은 없다
  const open = cutFn(BARE, 'openArtEdit');
  assert.match(open, /POL\.st\s*=\s*null/, '조를 열 때 상자를 비우지 않는다');
  assert.match(open, /polDraw\(\)/, '조를 열 때 빈 상자를 그리지 않는다');
});

test('⑥ 다시 판정 — 이 조(라벨·제목)·AI 가 고친 글·#size 규모·검토 기준으로', async () => {
  await kordoc();
  const H = harness({ ask: () => Promise.resolve(replyOf({ text: '① {회사}는 15일을 준다.', why: '' })) });
  H.t.polMenu(); H.click('tidy'); await H.settle();
  assert.equal(H.calls.warns.length, 1);
  const { g, M, size } = H.calls.warns[0];
  assert.equal(g.members[0].label, '제20조');
  assert.equal(g.members[0].title, '연차유급휴가');
  assert.equal(g.members[0].body, '① 가나상사는 15일을 준다.', '되돌려 채운 글로 판정해야 한다');
  assert.equal(M.criteria, CR);
  assert.match(String(M.today), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(size, '10인이상');
  assert.match(H.box(), new RegExp('지적 ' + H.t.POL.st.warns.length + '건'));
});

test('⑦ 이 토막은 서버에 아무것도 쓰지 않는다 · 단추·상자 자리 · 손잡이', () => {
  const sec = polSection();
  assert.doesNotMatch(sec, /\.(set|update|transaction|push|remove)\(|\.ref\(/, 'AI 다듬기 토막이 서버에 쓴다');
  const card = BARE.slice(BARE.indexOf('id="art-edit"'), BARE.indexOf('id="fs-bar"'));
  const btns = card.slice(card.indexOf('class="ae-btns"'), card.indexOf('</div>', card.indexOf('class="ae-btns"')));
  assert.match(btns, /<button[^>]*id="ae-polish"[^>]*>✨ 다듬기<\/button>/, '단추 줄에 ✨ 다듬기가 없다');
  const pol = card.indexOf('id="ae-pol"'), rec = card.indexOf('id="ae-rec"');
  assert.ok(pol > card.indexOf('class="ae-btns"') && pol < rec, '#ae-pol 는 단추 줄 아래, 💡 상자 위');
  assert.match(BARE, /\$\(\s*["']ae-pol["']\s*\)\.addEventListener\(\s*["']click["']\s*,\s*polClick\s*\)/);
  assert.match(BARE, /\$\(\s*["']ae-polish["']\s*\)\.addEventListener\(\s*["']click["']\s*,\s*polMenu\s*\)/);
});

test('⑦ 부품은 캐시 번호를 달고 한 번만 · 쓰는 부품보다 뒤 · 호출기는 다른 화면과 같은 판', () => {
  const at = {};
  ['js/pu-rules-filecmp', 'js/pu-kordoc-text', 'js/rules-v2/lib-topics', 'js/rules-v2/view-topics', 'js/rules-v2/view-recommend',
    'js/pu-ai-call', 'js/rules-v2/lib-polish', 'js/rules-v2/view-polish'].forEach((p) => {
    const hits = [...BARE.matchAll(new RegExp('<script src="' + p + '\\.js\\?v=(\\d+)"></script>', 'g'))];
    assert.equal(hits.length, 1, p + '.js 는 캐시 번호를 달고 한 번만 싣는다');
    assert.equal((BARE.match(new RegExp(p + '\\.js[?"]', 'g')) || []).length, 1, p + '.js 를 두 번 싣는다');
    at[p] = { i: hits[0].index, v: hits[0][1] };
  });
  ['js/pu-rules-filecmp', 'js/rules-v2/lib-topics', 'js/pu-kordoc-text'].forEach((p) => assert.ok(at[p].i < at['js/rules-v2/lib-polish'].i, p + ' 가 lib-polish 보다 늦다'));
  assert.ok(at['js/rules-v2/lib-polish'].i < at['js/rules-v2/view-polish'].i);
  assert.ok(at['js/rules-v2/view-recommend'].i < at['js/rules-v2/lib-polish'].i, '💡 부품 뒤에 싣는다');
  // 호출기 판 — 같은 파일을 싣는 다른 화면과 같은 번호(한 화면만 옛 판을 붙들지 않게)
  const others = ['kcareer.html', 'pu-cards.html', 'work.html', 'pu-news.html'].map((f) => {
    const m = fs.readFileSync(path.join(ROOT, f), 'utf8').match(/js\/pu-ai-call\.js\?v=(\d+)/);
    return m && m[1];
  }).filter(Boolean);
  assert.ok(others.length >= 1);
  others.forEach((v) => assert.equal(at['js/pu-ai-call'].v, v, '호출기 캐시 번호가 다른 화면과 다르다'));
});

test('⑦ 상자 CSS — 한 줄 칸은 … 로 자르고, 뺀 곳(<del>)은 줄을 긋고, 빈 상자는 숨긴다', () => {
  const css = (BARE.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const rulesFor = (c) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => new RegExp('\\.' + c + '(?![\\w-])').test(m[1])).map((m) => m[2]).join(';');
  ['pol-hm', 'pol-note', 'pol-why', 'pol-warn', 'pol-err'].forEach((c) => {
    const r = rulesFor(c);
    assert.match(r, /white-space:\s*nowrap/, c + ' 이 두 줄이 된다');
    assert.match(r, /text-overflow:\s*ellipsis/, c + ' 가 넘침을 … 로 안 자른다');
  });
  const del = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /pol-body\s+del/.test(m[1])).map((m) => m[2]).join(';');
  assert.match(del, /line-through/, 'AI 가 뺀 곳에 줄이 안 그어진다');
  assert.ok([...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some((m) => /\.ae-pol:empty/.test(m[1]) && /display:\s*none/.test(m[2])), '빈 상자가 자리를 차지한다');
});

test('⑦ rules.html 안 스크립트는 구문이 맞다', () => {
  const re = /<script(?![^>]*\bsrc=)(?![^>]*type="module")[^>]*>([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(HTML))) { assert.doesNotThrow(() => new vm.Script(m[1]), '스크립트 ' + n + ' 구문 오류'); n++; }
  assert.ok(n >= 1);
});
