/* 취업규칙 ✏️ 조문 편집 — 「✨ AI 다듬기」 rules.html 잇기 (Task 2 · 2026-10-04 목업 세 물음 「추천대로」). 이름은 가짜만.
   화면 토막(POL … polClick)을 «그대로» 떼어 vm 에서 돌린다 — 베껴 오면 화면이 바뀌어도 검사는 옛것을 본다.
   부르기(PuAiCall.ask)만 가짜다. 가림(kordoc)·셈(lib-polish)·상자(view-polish)·다시 판정(warnsOf)은 진짜를 돌린다.
   ★ 못 박는 것은 규칙이다(값·문장 통째가 아니다):
     ① 보내는 글에 회사 이름도, 주민번호도, 사업자번호도 없다 · 조 머리도 안 간다 · app 은 rules · 두 번 눌러도 한 번 부른다
        회사 이름은 보내는 순간 ERP 에서(앞 문서의 SITE_INFO·파일 이름·「원본」이 아니다) · 못 찾으면 묻는다
     ② 「검토 지적 반영」은 그 조의 지적(위반의심·누락·수동확인)이 있을 때만 · 지적은 지시문에 실린다
     ③ 실패 글 — 달 한도 · 분당·하루 몫(429+quota 낱말) · 로그인 · 그 밖은 까닭째
     ④ 「이 판으로 바꾸기」는 열람 전용을 먼저 본다 · 머리(【】 포함)는 지키고(AI 가 붙여 온 머리는 뗀다) · {회사} 는 이 회사 이름으로
     ⑤ 조를 바꾼 뒤 늦게 온 답은 버린다 · 조를 열면 상자가 빈다
     ⑥ 다시 판정은 이 조·이 규모·검토 기준으로 · 「위반 의심 전 → 후」 · 못 하면 0 이 아니라 「못 함」
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
  // ERP 업체 찾기 — 화면의 것 그대로(이름 다듬기 _norm·_digits 줄째)
  const line = (start) => { const i = BARE.indexOf(start); assert.ok(i >= 0, start + ' 이 없다'); return BARE.slice(i, BARE.indexOf('\n', i)); };
  return HTML.slice(a, b) + '\n' + cutFn(BARE, 'artHeadOf') + '\n' + cutFn(BARE, 'aeOwnHead') + '\n' + cutFn(BARE, 'siteName') + '\n' + cutFn(BARE, 'escapeH')
    + '\n' + line('const _norm=') + '\n' + line('const _digits=') + '\n' + cutFn(BARE, 'findErpCompany');
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
  const calls = { ask: [], alerts: [], warns: [], confirms: [] };
  const auth = { currentUser: o.noUser ? null : { getIdToken: () => Promise.resolve('토큰') } };
  const ctx = {
    $, console: { warn() {}, info() {}, log() {} }, Promise, Date, Object, Array, String, Number, Set, Map, JSON, Math, RegExp, Error, Uint8Array,
    AE_LABEL: '제20조', AE_TITLE: '연차유급휴가', READONLY: false,
    ALL_FINDINGS: o.findings || [],
    // 지금 문서 A — ERP 업체 목록(ERP_COS)에 그 업체가 있다(o.erp 로 바꾼다)
    SITE_INFO: o.siteInfo || null, LAST: o.last !== undefined ? o.last : { key: 'A', site: '🏢 ' + CO, bizno: '' },
    SITE_MAP: o.siteMap || { A: '🏢 ' + CO }, SITE_BIZNO: o.siteBizno || { A: '' }, siteSel: { value: o.sel || 'A' },
    ERP_COS: o.erp !== undefined ? o.erp : [{ id: 1, name: CO, bizNo: '123-81-00001' }],
    loadErpCompanies() { calls.erpLoad = (calls.erpLoad || 0) + 1; return Promise.resolve(ctx.ERP_COS); },
    alert: (m) => calls.alerts.push(m),
    confirm: (m) => { calls.confirms.push(m); return calls.yes !== false; },
    fetch: () => { calls.fetch = (calls.fetch || 0) + 1; return Promise.reject(new Error('부르면 안 된다')); },
    firebase: { auth: () => auth },
    PuRulesPolish: P, PuRulesPolishView: PV, PuRulesV2RecommendView: RV, PuRulesCriteria: CR, PuKordocText: KT,
    PuRulesV2TopicsView: {
      warnsOf(g, M, size) { calls.warns.push({ g, M, size }); return V.warnsOf(g, M, size); },
      judgeWarns(g, M, size) {
        calls.warns.push({ g, M, size });
        if (o.judgeThrows && o.judgeThrows(calls.warns.length)) throw new Error('판정 고장');   // n 번째 판정에서 넘어진다
        return V.judgeWarns(g, M, size);
      },
    },
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
  // 서버(readDoc)는 temperature·maxOutputTokens 만 받는다 — 안 받는 칸(responseMimeType)을 «청한 척» 보내지 않는다
  assert.equal(typeof (opts.generationConfig || {}).temperature, 'number', '답이 흔들리지 않게 temperature 를 정한다');
  assert.ok(!('responseMimeType' in opts.generationConfig), '서버가 버리는 칸을 보낸다');
  assert.equal(H.calls.confirms.length, 0, 'ERP 에서 회사를 찾았는데 물었다');
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
  // 분당 몫 — quota 낱말이 함께 있어도 «내일 다시»가 아니다(1분 뒤면 된다)
  for (const msg of ['Quota exceeded for metric: generate_content_free_tier_requests, quotaId: GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
    'Resource has been exhausted: quota per minute']) {
    H = await run({ ask: fail(429, msg) });
    assert.match(H.box(), /AI 가 잠시 바쁩니다 — 1분 뒤 다시 해 주세요/, msg);
    assert.doesNotMatch(H.box(), /오늘 AI 몫|내일/, '분당 몫을 하루 몫이라고 했다: ' + msg);
  }
  // 하루 몫 — PerDay 글은 하루 몫
  H = await run({ ask: fail(429, 'Quota exceeded, quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier') });
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
  assert.ok(H.after.value.startsWith('제20조【연차유급휴가】 '), '【】 머리를 안 지켰다: ' + H.after.value);
  assert.equal((H.after.value.match(/제\s*\d+\s*조/g) || []).length, 1, '머리가 겹쳤다');
  assert.ok(H.after.value.includes('가나상사가'), '{회사} 를 이 회사 이름(조사째)으로 안 되돌렸다');
  assert.ok(H.after.value.includes('\n② '), '줄바꿈이 사라졌다');
  assert.doesNotMatch(H.after.value, /\{회사\}/);
  assert.equal(H.calls.confirms.length, 0, '고친 것이 없는데 물었다');
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

test('④ 보낸 뒤 「변경 후」를 고쳤으면 바꾸기 전에 묻는다 — 아니오면 그대로, 예면 AI 판으로', async () => {
  await kordoc();
  const ANS = { text: '① {회사}는 15일의 유급휴가를 준다.', why: '' };
  const H = harness({ ask: () => Promise.resolve(replyOf(ANS)) });
  H.t.polMenu(); H.click('tidy'); await H.settle();
  const typed = AFTER + '\n③ 기다리는 사이 사람이 덧붙인 항.';
  H.after.value = typed;
  H.calls.yes = false;
  H.click('use');
  assert.equal(H.calls.confirms.length, 1, '고친 것이 있는데 묻지 않았다');
  assert.match(H.calls.confirms[0], /고친 것을 버리고 AI 판으로 바꿀까요/);
  assert.equal(H.after.value, typed, '아니오인데 고친 것을 버렸다');
  assert.match(H.box(), /AI 가 고친 판/, '아니오인데 상자를 닫았다');
  H.calls.yes = true;
  H.click('use');
  assert.equal(H.calls.confirms.length, 2);
  assert.ok(H.after.value.startsWith('제20조(연차유급휴가) ') && H.after.value.includes('가나상사는 15일'), H.after.value);
  assert.ok(!H.after.value.includes('덧붙인 항'));
  assert.equal(H.box(), '');
  // 머리만 바꾼 것은 고친 것이 아니다(머리는 어차피 지금 것을 지킨다)
  const H2 = harness({ ask: () => Promise.resolve(replyOf(ANS)) });
  H2.t.polMenu(); H2.click('tidy'); await H2.settle();
  H2.after.value = AFTER.replace('제20조(연차유급휴가)', '제20조【연차유급휴가】');
  H2.click('use');
  assert.equal(H2.calls.confirms.length, 0, '본문은 그대로인데 물었다');
  assert.ok(H2.after.value.startsWith('제20조【연차유급휴가】 '));
});

test('④ 열람 전용이면 부르지 않는다 — 넣을 수 없는 판에 회사 공동 하루 몫을 쓰지 않게', async () => {
  await kordoc();
  const H = harness();
  H.ctx.READONLY = true;
  H.t.polMenu();
  assert.ok(H.calls.alerts.some((m) => /열람 전용/.test(m)), '열람 전용을 알리지 않았다');
  assert.equal(H.box(), '', '열람 전용인데 고르기 상자를 열었다');
  H.click('tidy'); H.click('fix'); await H.t.polSend('tidy'); await H.settle();
  assert.equal(H.calls.ask.length, 0, '열람 전용인데 AI 를 불렀다');
  // 열람 전용으로 들어서면 단추를 숨긴다(풀리면 다시 보인다)
  const ro = cutFn(BARE, 'setReadOnly');
  assert.match(ro, /\$\(\s*["']ae-polish["']\s*\)/, '열람 전용 전환이 ✨ 단추를 다루지 않는다');
  const els = {};
  const $ = (id) => els[id] || (els[id] = { style: {}, disabled: false });
  const ctx = { $, LAST: null, escapeH: (x) => x, updateDoneBtn() {}, READONLY: false };
  vm.createContext(ctx);
  vm.runInContext(ro + '\nthis.f=setReadOnly;', ctx);
  ctx.f(true);
  assert.equal($('ae-polish').style.display, 'none');
  ctx.f(false);
  assert.notEqual($('ae-polish').style.display, 'none');
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
  // 두 번 잰다 — 보낸 «지금 글»과 AI 글을, 같은 조·같은 기준·같은 날·같은 규모로
  assert.equal(H.calls.warns.length, 2);
  const [was, now] = H.calls.warns;
  for (const { g, M, size } of [was, now]) {
    assert.equal(g.members[0].label, '제20조');
    assert.equal(g.members[0].title, '연차유급휴가');
    assert.equal(M.criteria, CR);
    assert.match(String(M.today), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(size, '10인이상');
  }
  assert.equal(was.M.today, now.M.today);
  assert.equal(was.g.members[0].body, H.t.POL.st.cur, '«전» 은 보낸 지금 글(머리 뗀 것)로 재야 한다');
  /* 2026-10-05 — {회사} 는 «원문의 꼴»(AFTER 의 「㈜가나상사」)로 되돌린다. 전에는 ERP 표기로 채워 ㈜ 가 빠졌다(rules-polish 가 남긴 일) */
  assert.equal(now.g.members[0].body, '① ㈜가나상사는 15일을 준다.', '«후» 는 되돌려 채운 AI 글로 재야 한다');
});

/* ── 최종 검토 지적 반영 (2026-10-04) ── */
test('⑥ 다시 판정 — 「위반 의심 전 → 후」 · 누락·수동확인은 다시 안 봤다고 · 못 하면 0 이 아니라 「못 함」', async () => {
  await kordoc();
  // 진짜 판정으로 — 연차 «10일»은 위반 의심, «15일»은 아니다(검토 기준이 실제로 그렇게 가르는지 먼저 본다)
  const BAD = '제20조(연차유급휴가) ① 가나상사는 1년간 80퍼센트 이상 출근한 사원에게 10일의 유급휴가를 준다.';
  const GOOD = BAD.replace('10일', '15일');
  const judge = (t) => V.judgeWarns({ members: [{ label: '제20조', title: '연차유급휴가', body: t.replace(/^제20조\(연차유급휴가\)\s*/, '') }] }, { criteria: CR, today: '2026-10-04' }, '10인이상').length;
  assert.ok(judge(BAD) >= 1 && judge(GOOD) === 0, '검토 기준이 10일/15일을 가르지 않는다 — 검사 글을 바꿀 것');
  const echo = (parts) => Promise.resolve(replyOf({ text: sentBody(parts[0].text), why: '' }));
  const fixed = () => Promise.resolve(replyOf({ text: GOOD.replace(/^.*?①/, '①').replace('가나상사', '{회사}'), why: '' }));
  const run = async (o) => { const H = harness(o); H.t.polMenu(); H.click('tidy'); await H.settle(); return H; };

  // AI 가 위반을 «그대로 둔» 판 — 1 → 1 (본문에만 있는 위반이 0 으로 보이면 안 된다)
  let H = await run({ after: BAD, ask: echo });
  assert.match(H.box(), new RegExp('위반 의심 ' + judge(BAD) + ' → ' + judge(BAD) + '(?!\\d)'), 'AI 가 그대로 둔 위반이 사라진 것처럼 보인다');
  // AI 가 고친 판 — n → 0
  H = await run({ after: BAD, ask: fixed });
  assert.match(H.box(), new RegExp('위반 의심 ' + judge(BAD) + ' → 0(?!\\d)'));
  // «전» 은 검토 결과(ALL_FINDINGS)가 아니라 보내는 순간의 지금 글로 — 검토 때 위반의심이 둘 있었어도 지금 글이 깨끗하면 0
  H = await run({ after: GOOD, ask: echo, findings: [finding('제20조', '위반의심', '가'), finding('제20조', '위반의심', '나')] });
  assert.match(H.box(), /위반 의심 0 → 0(?!\d)/, '«전» 을 검토 결과에서 셌다');
  assert.doesNotMatch(H.box(), /다시 판정하지 않음/, '위반의심만 있던 조에 덧말이 붙었다');
  // 누락·수동확인이 이 조에 있었으면(다른 조의 것은 안 본다) 다시 안 봤다고 덧붙인다
  for (const s of ['누락', '수동확인']) {
    H = await run({ after: BAD, ask: fixed, findings: [finding('제20조', s)] });
    assert.match(H.box(), /위반 의심 \d+ → 0 · 누락·수동확인은 다시 판정하지 않음/, s);
  }
  H = await run({ after: BAD, ask: fixed, findings: [finding('제3조', '누락')] });
  assert.doesNotMatch(H.box(), /다시 판정하지 않음/, '다른 조의 누락을 이 조에 붙였다');
  // 판정이 넘어지면(전·후 어느 쪽이든) 숫자를 쓰지 않는다
  for (const judgeThrows of [() => true, (n) => n === 1, (n) => n === 2]) {
    H = await run({ after: BAD, ask: fixed, judgeThrows });
    assert.match(H.box(), /다시 판정 못 함/, String(judgeThrows));
    assert.doesNotMatch(H.box(), /→/, '판정을 못 했는데 수를 적었다: ' + judgeThrows);
    assert.match(H.box(), /이 판으로 바꾸기/, '판정을 못 해도 고친 판은 보인다');
  }
});

test('⑥ judgeWarns 는 못 하면 던지고, warnsOf(📚·💡)는 그대로 [] 로 삼킨다', () => {
  const g = { members: [{ label: '제20조', title: '연차유급휴가', body: '① 쉰다.' }] };
  const broken = { criteria: { evaluate() { throw new Error('고장'); } }, today: '2026-10-04' };
  assert.throws(() => V.judgeWarns(g, broken));
  assert.throws(() => V.judgeWarns(g, { criteria: null }), '검토 기준이 없는데 «0건»이라 한다');
  assert.deepEqual(V.warnsOf(g, broken), []);
  assert.deepEqual(V.warnsOf(g, { criteria: null }), []);
  const ok = { criteria: CR, today: '2026-10-04' };
  assert.deepEqual(V.judgeWarns(g, ok).map((f) => f.rule.id), V.warnsOf(g, ok).map((f) => f.rule.id));
});

test('① 회사 이름은 보내는 그 순간 ERP 에서 — 앞 문서(A)의 업체가 남아 있어도 지금 문서(B)의 이름을 가린다', async () => {
  await kordoc();
  const A = '다라물산', B = CO;
  // A 를 검토했다(LAST·SITE_INFO 가 A) → B 를 올려 골랐다 → ✨
  const H = harness({
    sel: 'B', last: { key: 'A', site: '🏢 ' + A, bizno: '123-81-00002' }, siteInfo: { id: 2, name: A, bizNo: '123-81-00002' },
    // B 는 파일로 올렸지만 사업자번호를 정해 왔다 — 그것으로 ERP 업체를 «확실히» 찾는다
    siteMap: { A: '🏢 ' + A, B: '📄 ' + B + ' 취업규칙.hwp' }, siteBizno: { A: '123-81-00002', B: '123-81-00001' },
    erp: [{ id: 2, name: A, bizNo: '123-81-00002' }, { id: 1, name: B, bizNo: '123-81-00001' }],
    ask: (parts) => Promise.resolve(replyOf({ text: sentBody(parts[0].text), why: '' })),
  });
  H.t.polMenu(); H.click('tidy'); await H.settle();
  assert.equal(H.calls.ask.length, 1);
  const prompt = H.calls.ask[0].parts[0].text;
  assert.ok(!/가나\s*상사/.test(prompt), '지금 문서(B)의 회사 이름이 나갔다');
  assert.equal(H.calls.confirms.length, 0, 'ERP 에 B 가 있는데 물었다');
  H.click('use');
  assert.ok(H.after.value.includes(B + '는'), '{회사} 를 B 의 이름으로 안 되돌렸다: ' + H.after.value);
  assert.ok(!H.after.value.includes(A), '앞 문서(A)의 이름을 썼다: ' + H.after.value);
});

test('① ERP 에서 회사를 못 찾으면 묻는다 — 아니오면 안 부르고, 예면 이름 바꿈 없이 보낸다 · 파일 이름·「원본」은 이름이 아니다', async () => {
  await kordoc();
  const AFT = '제20조(연차유급휴가) ① 원본 서류는 회사가 보관한다. 가나상사는 15일을 준다.';
  for (const site of ['📄 ' + CO + ' 취업규칙.hwp', '원본', '📄 작업 문서']) {
    const H = harness({ after: AFT, erp: [], last: { key: 'A', site, bizno: '' }, siteMap: { A: site } });
    H.calls.yes = false;
    H.t.polMenu(); H.click('tidy'); await H.settle();
    assert.equal(H.calls.confirms.length, 1, site + ' — 회사 이름을 모르는데 묻지 않았다');
    assert.match(H.calls.confirms[0], /회사 이름을 몰라 가리지 못합니다/);
    assert.equal(H.calls.ask.length, 0, site + ' — 아니오인데 불렀다');
    assert.equal(H.t.POL.busy, false);
    assert.doesNotMatch(H.box(), /고치는 중/, '아니오인데 «고치는 중»에 멈췄다');
    // 예 — 보낸다. 자리 글(파일 이름·「원본」)로 가리지 않는다
    H.calls.yes = true;
    H.click('tidy'); await H.settle();
    assert.equal(H.calls.ask.length, 1);
    const body = sentBody(H.calls.ask[0].parts[0].text);
    assert.ok(body.includes('원본 서류'), site + ' — 본문의 「원본」을 {회사} 로 바꿨다: ' + body);
    assert.ok(!body.includes('{회사}'), site + ' — 회사 이름을 모르는데 무엇인가를 {회사} 로 바꿨다: ' + body);
  }
});

test('① 이름이 «통째로» 같거나 사업자번호가 같을 때만 그 업체 — ERP 의 짧은 이름이 파일 이름에 «들어 있다»고 고르지 않는다', async () => {
  await kordoc();
  const AFT = '제20조(연차유급휴가) ① 한국다온테크는 15일을 준다.';
  const file = '📄 한국다온테크 취업규칙.hwp';
  // ERP 에 짧은 이름 「한국」 — 파일 이름에 들어 있지만 같은 회사가 아니다 → 묻는다(조용히 보내지 않는다)
  const H = harness({ after: AFT, erp: [{ id: 9, name: '한국', bizNo: '123-81-00009' }], last: { key: 'A', site: file, bizno: '' }, siteMap: { A: file } });
  H.calls.yes = false;
  H.t.polMenu(); H.click('tidy'); await H.settle();
  assert.equal(H.calls.confirms.length, 1, '«포함» 맞추기로 엉뚱한 업체를 골라 묻지 않았다');
  assert.equal(H.calls.ask.length, 0);
  // 이름이 통째로 같으면(🏢·꼬리표·띄어쓰기·확장자는 떼고) 그 업체 — 묻지 않는다
  for (const site of ['🏢 한국다온테크', '🏢 ㈜한국 다온테크', '📄 한국다온테크.hwp']) {
    const E = harness({ after: AFT, erp: [{ id: 9, name: '한국', bizNo: '123-81-00009' }, { id: 7, name: '한국다온테크', bizNo: '123-81-00007' }],
      last: { key: 'A', site, bizno: '' }, siteMap: { A: site } });
    E.t.polMenu(); E.click('tidy'); await E.settle();
    assert.equal(E.calls.confirms.length, 0, site + ' — 이름이 같은데 물었다');
    assert.ok(!/한국\s*다온테크/.test(E.calls.ask[0].parts[0].text), site + ' — 회사 이름이 나갔다');
  }
  // 사업자번호가 같으면 이름이 달라도 그 업체
  const N = harness({ after: AFT, erp: [{ id: 7, name: '한국다온테크', bizNo: '123-81-00007' }], last: { key: 'A', site: file, bizno: '123-81-00007' }, siteMap: { A: file } });
  N.t.polMenu(); N.click('tidy'); await N.settle();
  assert.equal(N.calls.confirms.length, 0);
  assert.ok(!/한국\s*다온테크/.test(N.calls.ask[0].parts[0].text));
});

test('① 빈 글이면 회사 이름을 묻기 전에 끝낸다', async () => {
  await kordoc();
  const H = harness({ after: '제20조(연차유급휴가)  ', erp: [] });
  H.t.polMenu(); H.click('tidy'); await H.settle();
  assert.equal(H.calls.confirms.length, 0, '보낼 글이 없는데 회사 이름을 물었다');
  assert.equal(H.calls.ask.length, 0);
  assert.match(H.box(), /다듬을 글이 없습니다/);
  assert.equal(H.t.POL.busy, false);
});

test('① 사업자번호도 가린다 — 기본 가림 묶음에 더해', async () => {
  await kordoc();
  const BRN = '123-45-67890';
  const H = harness({ after: '제20조(연차유급휴가) ① 사업자등록번호 ' + BRN + ' 인 회사는 15일을 준다.' });
  H.t.polMenu(); H.click('tidy'); await H.settle();
  const prompt = H.calls.ask[0].parts[0].text;
  assert.ok(!prompt.includes(BRN) && !prompt.includes('67890'), '사업자번호가 나갔다');
  assert.ok(sentBody(prompt).includes(P.MASK));
});

test('④ AI 가 조 머리를 붙여 와도 — 견줄 때·넣을 때 머리는 하나', async () => {
  await kordoc();
  const ANS = { text: '제25조(연차휴가) ① {회사}는 15일의 유급휴가를 준다.\n② 둘째 항.', why: '' };
  const H = harness({ ask: () => Promise.resolve(replyOf(ANS)) });
  H.t.polMenu(); H.click('tidy'); await H.settle();
  assert.ok(!/제\s*25\s*조/.test(H.t.POL.st.got.text), '견주는 글에 AI 가 붙인 머리가 남았다: ' + H.t.POL.st.got.text);
  assert.match(H.t.POL.st.got.text, /^① /);
  H.click('use');
  assert.equal((H.after.value.match(/제\s*\d+\s*조/g) || []).length, 1, '머리가 겹쳤다: ' + H.after.value);
  assert.ok(H.after.value.startsWith('제20조(연차유급휴가) ① ㈜가나상사는'), H.after.value);   // 원문의 꼴 그대로(2026-10-05)
});

test('③ 실패 글 — 이번 달 한도(서버 readDoc 의 429)는 우리 글로 · 사진첩 안내는 안 보인다', async () => {
  await kordoc();
  const msg = '이번 달 AI 판독 한도(₩30,000)를 다 썼습니다 — 지금까지 약 ₩30,100. 자동 판독을 멈췄습니다. 급한 것은 사진을 열어 직접 눌러 주세요.';
  const H = harness({ ask: () => { const e = new Error(msg); e.status = 429; return Promise.reject(e); } });
  H.t.polMenu(); H.click('tidy'); await H.settle();
  assert.match(H.box(), /이번 달 AI 한도에 걸렸습니다 — 관리자에게 알려 주세요/);
  assert.doesNotMatch(H.box(), /사진을 열어|내일 다시/);
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

/* ★★ 이번 달 요금 한도 — 사람이 누른 다듬기는 «물어본 뒤» 부를 수 있다 (2026-10-04 · rules-polish 가 남긴 일)
   서버(readDoc)는 manual 이 없는 부름을 «자동»으로 보고 한도에 걸리면 막는다 — 사람이 누른 것은
   «화면이 먼저 묻고, 그때만 manual 을 실어» 통과시킨다(대표 결정 ⓵㉮). ✨ 는 늘 사람이 누르는데 manual 을
   안 실어, 한도가 차면 「관리자에게 알려 주세요」로 끝났다. */
test('★★ 달 한도에 걸리면 묻는다 — 예면 manual 을 실어 한 번 더, 아니오면 부르지 않고 한 줄', async () => {
  await kordoc();
  const over = () => { const e = new Error('이번 달 AI 판독 한도(₩30,000)를 다 썼습니다'); e.status = 429; e.overBudget = true; return Promise.reject(e); };
  const run = async (yes) => {
    const H = harness({ ask: (parts, opts, n) => (n === 1 ? over() : Promise.resolve(replyOf({ text: sentBody(parts[0].text), why: '그대로' }))) });
    H.calls.yes = yes;
    H.t.polMenu(); H.click('tidy'); await H.settle();
    return H;
  };
  let H = await run(true);
  assert.equal(H.calls.ask.length, 2, '★★ 예라고 했는데 다시 부르지 않았다');
  assert.ok(!H.calls.ask[0].opts.manual, '처음 부름은 자동(manual 없음)이어야 한다 — 한도 안이면 묻지 않고 지나간다');
  assert.equal(H.calls.ask[1].opts.manual, true, '★★ 다시 부를 때 manual 을 안 실었다 — 서버가 또 막는다');
  assert.ok(H.calls.confirms.some((m) => /한도/.test(m)), '묻지 않고 통과시켰다');
  assert.doesNotMatch(H.box(), /한도에 걸렸습니다/);
  H = await run(false);
  assert.equal(H.calls.ask.length, 1, '아니오인데 또 불렀다');
  assert.match(H.box(), /이번 달 AI 한도에 걸렸습니다/);
});

test('호출기는 manual 을 «받을 때만» 싣고, 한도 거절을 overBudget 으로 알려 준다', async () => {
  const sent = [];
  const ctx = { Promise, JSON, Error, String, Object };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(AI_SRC, ctx);
  const auth = { currentUser: { getIdToken: () => Promise.resolve('토큰') } };
  const ok = (url, init) => { sent.push(JSON.parse(init.body)); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, reply: {} }) }); };
  await ctx.PuAiCall.ask([{ text: '가' }], { auth, fetch: ok, app: 'rules' });
  await ctx.PuAiCall.ask([{ text: '가' }], { auth, fetch: ok, app: 'rules', manual: true });
  assert.equal(sent[0].manual, undefined, '안 받았는데 manual 을 실었다 — 자동 부름이 한도를 뚫는다');
  assert.equal(sent[1].manual, true);
  const no = () => Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({ ok: false, overBudget: true, error: '한도' }) });
  await assert.rejects(ctx.PuAiCall.ask([{ text: '가' }], { auth, fetch: no }), (e) => e.status === 429 && e.overBudget === true);
});
