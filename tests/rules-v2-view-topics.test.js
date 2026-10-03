/* 취업규칙(새) 「📚 조별 문안」 화면 — Task 4.
   그림(DOM)이 아니라 «그린 글»을 본다 — 화면은 문자열 그리기 함수(model·listHtml·topicHtml)를 따로 낸다.
   ★ 못 박는 것은 규칙이다(값·개수가 아니다):
     ① 주제는 표준 차례·장 머리 아래 — 장 머리가 빈 맨 앞은 「제1장 총칙」, 표준에 없는 주제는 「그 밖의 조」
     ② 찾기 글은 주제 «이름»만 거른다(본문 낱말로는 안 걸린다)
     ③ 덩어리 차례(★최종본 → 곳 수 → 최근), 맨 위는 전문, 아래는 <ins>/<del> 과 「A 와 다른 곳」 한 줄
     ④ 위반 의심 — 규정관리와 같은 검토 기준을 «진짜로» 돌려, 기준 미달 덩어리에만 한 줄
     ⑤ 「쓴 회사」 — 미확정은 「(미확정)」, 최종본은 ★
     ⑥ 회사 이름·조 제목은 글자로만(꺾쇠가 태그가 되면 안 된다)
     ⑦ 모델은 한 번만 셈한다 — 주제를 바꿔도 다시 셈하지 않는다
     ⑧ 화면 머리 — 새 js 캐시 번호, #topics 가르기, 뒤로가기 깃발, 인라인 스크립트 구문 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const V = require('../js/rules-v2/view-topics.js');
const CR = require('../js/pu-rules-criteria.js');
const { stripComments } = require('./strip-comments');

/* 작은 표준 — 맨 앞 두 조는 장 머리가 없다(실제 표준 글이 그렇다) */
const STD = [
  '제1조(목적) 이 취업규칙은 ○○주식회사 사원의 근로조건을 정한다.',
  '제2조(적용범위) 이 규칙은 모든 사원에게 적용한다.',
  '제2장 휴일·휴가',
  '제3조(연차유급휴가) ① 회사는 1년간 80퍼센트 이상 출근한 사원에게 15일의 유급휴가를 준다.',
].join('\n');

const CO_BAD = '<img src=x onerror=alert(1)>';
const COS = [{ id: 'co1', name: '가나상사' }, { id: 'co2', name: '나다물산' }, { id: 'co4', name: '라마전자' }, { id: 'co5', name: CO_BAD }];
const DAY = 864e5, T0 = Date.UTC(2026, 6, 1);
const D = (id, d) => ({ id, kind: '규칙본문', status: '담김', dir: '받음', name: id + '.hwp', createdAt: d,
  mail: { src: 'imap', box: 'INBOX', key: id, date: T0 + d * DAY } });
const linked = (co) => ({ companyId: co, companyLinkStatus: 'linked' });

function body(co, 호칭, days) {
  return [
    `제1조(목적) 이 규칙은 ${co} ${호칭}의 근로조건을 정한다.`,
    `제20조(연차유급휴가) ① 1년간 80퍼센트 이상 출근한 ${호칭}에게 ${days}일의 유급휴가를 준다.`,
    `② 계속하여 근로한 기간이 1년 미만인 ${호칭}에게 1개월 개근 시 1일의 유급휴가를 준다.`,
  ].join('\n');
}
const DATA = {
  docs: { d1: D('d1', 1), d2: D('d2', 2), d3: D('d3', 3), d4: D('d4', 90), d5: D('d5', 4),
    dx: Object.assign(D('dx', 5), { kind: '신고서' }), dh: Object.assign(D('dh', 6), { status: '보류' }) },
  human: { d1: linked('co1'), d2: linked('co2'), d4: linked('co4'), d5: linked('co5') },
  rounds: { co1_r202607: { finalDocId: 'd1' }, co2_r202607: {} },   // 실제 RTDB 는 null 칸을 버린다 — 없는 칸은 «최종본 없음»
};
const TEXTS = {
  d1: body('가나상사', '사원', 15),
  d2: body('나다물산', '근로자', 15),
  d3: body('다라기계', '직원', 15),          // 사업장 미확정
  d4: body('라마전자', '사원', 12),           // 기준 미달
  d5: body(CO_BAD, '사원', 15) + '\n제31조(동호회) 회사는 동호회를 지원한다.\n제32조(<i>꾀</i>) 꾀를 쓰지 않는다.',
  dx: '제1조(목적) 신고서는 주제가 되면 안 된다',
  dh: '제1조(목적) 보류는 주제가 되면 안 된다',
};
const TODAY = '2026-10-03';
const M = () => V.model(DATA, TEXTS, COS, STD, TODAY, CR);
const K = '연차유급휴가';
const cards = (h) => h.split('<div class="card').slice(1);

test('① 주제는 표준 차례·장 머리 아래 — 빈 장 머리는 「제1장 총칙」, 표준에 없는 것은 「그 밖의 조」', () => {
  const m = M(), h = V.listHtml(m, K, '');
  const at = (s) => { const i = h.indexOf(s); assert.ok(i >= 0, '목록에 없음: ' + s); return i; };
  assert.ok(at('>' + V.FIRST_CHAPTER + '<') < at('>목적<'), '장 머리 없는 맨 앞 조는 「제1장 총칙」 아래');
  assert.ok(at('>목적<') < at('>제2장 휴일·휴가<'));
  assert.ok(at('>제2장 휴일·휴가<') < at('>연차유급휴가<'), '표준 차례대로');
  assert.ok(at('>연차유급휴가<') < at('>' + V.OTHER_CHAPTER + '<'), '표준에 없는 주제는 맨 뒤');
  assert.ok(at('>' + V.OTHER_CHAPTER + '<') < at('>동호회<'));
  // 표준에 있어도 아무도 안 쓴 주제는 목록에 없다(적용범위)
  assert.doesNotMatch(h, />적용범위</);
  // 고른 주제는 표시, 곳 수가 붙는다
  assert.match(h, /class="tp on" data-act="topic" data-k="연차유급휴가"/);
  assert.match(h, /<i>\d+곳<\/i>/);
  // 규칙 본문·담김만 — 신고서·보류의 글은 주제를 만들지 않는다
  assert.equal(m.docs, 5);
});

test('① «곳» — 같은 회사의 여러 문서는 한 곳, 미확정 문서는 문서마다 한 곳', () => {
  assert.equal(V.places([{ companyId: 'co1', docId: 'a' }, { companyId: 'co1', docId: 'b' }]), 1);
  assert.equal(V.places([{ companyId: '', docId: 'a' }, { companyId: '', docId: 'b' }]), 2);
  const t = M().topics.find((x) => x.key === K);
  assert.equal(t.count, V.places(M().byTopic[K].flatMap((g) => g.members)));
});

test('② 찾기 글은 주제 «이름»만 거른다', () => {
  const m = M();
  const h = V.listHtml(m, '', '연차');
  assert.match(h, />연차유급휴가</);
  assert.doesNotMatch(h, />목적</);
  assert.doesNotMatch(h, />동호회</);
  // 본문에만 있는 낱말로는 아무 주제도 안 걸린다
  const b = V.listHtml(m, '', '퍼센트');
  assert.doesNotMatch(b, /data-act="topic"/);
  assert.match(b, /맞는 조 주제가 없습니다/);
});

test('③ 덩어리 차례와 맨 위 전문, 아래 덩어리는 다른 곳만 칠하고 한 줄 요약', () => {
  const m = M(), gs = m.byTopic[K];
  assert.ok(gs.length >= 2);
  // 차례: ★최종본이 많은 것이 먼저
  for (let i = 1; i < gs.length; i++) assert.ok(gs[i - 1].finals >= gs[i].finals);
  const h = V.topicHtml(m, K, new Set());
  const cs = cards(h);
  assert.equal(cs.length, gs.length);
  // 맨 위 — 대표 글 전문(자리표시 그대로), 칠하지 않는다
  assert.match(cs[0], /^ top1"/);
  assert.match(cs[0], /\{근로자\}에게 15일의 유급휴가/);
  assert.match(cs[0], /1개월 개근 시 1일/);
  assert.doesNotMatch(cs[0], /<ins>|<del>/);
  assert.doesNotMatch(cs[0], /A 와 다른 곳/);
  // 아래 — <del>/<ins> 와 diffSummary 한 줄
  const low = cs.find((c) => /<ins>12<\/ins>/.test(c));
  assert.ok(low, '12일 덩어리가 칠해져 있어야 한다');
  assert.match(low, /<del>15<\/del>/);
  assert.match(low, /class="diff" title="A 와 다른 곳: [^"]+">A 와 다른 곳: /);
  // 한 줄 칸 — 넘칠 수 있는 머리 배지에는 title
  assert.match(h, /<span class="diff" title="/);
  // ★최종본 수
  assert.match(cs[0], /★최종본 \d+/);
});

test('④ 위반 의심 — 검토 기준을 진짜로 돌려 기준 미달 덩어리에만 한 줄', () => {
  // 규칙을 짐작해 박지 않는다 — 진짜 규칙집에서 연차(근로기준법 §60) 값비교 기준을 찾는다
  const r = CR.RULES.find((x) => /§\s*60\b/.test(x.law) && x.type === '값비교' && x.keywords.some((k) => /연차/.test(k)));
  assert.ok(r, '연차휴가 일수 기준(근로기준법 §60)이 규칙집에 있어야 한다');
  const line = '⚠ 검토 기준 ' + r.id + ' ' + r.name + ' — ' + r.law + ' 위반 의심';
  const cs = cards(V.topicHtml(M(), K, new Set()));
  const low = cs.find((c) => /<ins>12<\/ins>/.test(c)), top = cs[0];
  assert.ok(low.includes(V.esc(line)), '12일 덩어리에 위반 의심 한 줄');
  assert.ok(!top.includes(V.esc(line)), '15일 덩어리에는 없다');
  assert.match(low, /<div class="warn" title="[^"]+">/, '경고 줄도 한 줄 — title 에 까닭');
});

test('⑤ 「쓴 회사」 — 회사(id 로 찾은 이름) · 조 · ★최종본/중간 판 · 연월, 미확정은 「(미확정)」', () => {
  const m = M();
  const shut = V.topicHtml(m, K, new Set());
  assert.doesNotMatch(shut, /class="who"/, '펼치기 전에는 안 보인다');
  const h = cards(V.topicHtml(m, K, new Set([K + '|0'])))[0];
  assert.match(h, /class="who"/);
  assert.match(h, /★ 가나상사 · 제20조/);
  assert.match(h, /\d{4}-\d{2} ★최종본/);
  assert.match(h, /\d{4}-\d{2} 중간 판/);
  assert.match(h, /\(미확정\) · 제20조/);
  assert.doesNotMatch(h, /다라기계/, '미확정 문서의 회사 이름을 지어내지 않는다');
  m.byTopic[K].flatMap((g) => g.members).filter((e) => !e.companyId)
    .forEach((e) => assert.equal(e.companyName, '', '미확정은 회사 이름이 비어 있어야 한다(같은 글 판정에 남의 이름을 쓰지 않게)'));
  // 단추는 곳(회사)과 건(펼친 줄 수)을 함께 — 곳보다 줄이 많아도 헷갈리지 않게
  const lab = h.match(/data-act="who"[^>]*>쓴 회사 (\d+)곳 · (\d+)건 ▾/);
  assert.ok(lab, '펼침 단추에 곳과 건이 함께');
  assert.equal(+lab[2], (h.split('class="who"')[1].match(/<div title=/g) || []).length, '건 = 펼친 줄 수');
});

/* 따로 쓰는 작은 자료 — 한 주제만 */
function mini(texts, human, rounds) {
  const docs = {}; Object.keys(texts).forEach((id, i) => { docs[id] = D(id, 10 + i); });
  return V.model({ docs, human: human || {}, rounds: rounds || {} }, texts, COS.concat([{ id: 'co7', name: '마바상사' },
    { id: 'co8', name: '바사물산' }, { id: 'co9', name: '사아전자' }]), STD, TODAY, CR);
}

test('③ 덩어리 차례는 «곳»(회사) 수 — 한 회사의 판 여럿이 회사 여럿을 앞서지 않는다', () => {
  const X = '제7조(휴게) {호칭}의 휴게시간은 낮 12시부터 1시간으로 한다.';
  const Y = '제7조(휴게) {호칭}의 휴게시간은 낮 12시 30분부터 1시간으로 한다.';
  const t = (s) => s.replace('{호칭}', '사원');
  // X: 한 회사(co7)의 판 셋 — 3건 1곳. Y: 회사 둘 — 2건 2곳. 최종본 없음. 최근은 X 가 더 늦다
  const m = mini({ y1: t(Y), y2: t(Y), x1: t(X), x2: t(X), x3: t(X) },
    { x1: linked('co7'), x2: linked('co7'), x3: linked('co7'), y1: linked('co8'), y2: linked('co9') });
  const gs = m.byTopic['휴게'];
  assert.equal(gs.length, 2);
  assert.match(gs[0].text, /12시 30분/, '회사 둘이 쓴 글이 회사 하나의 판 셋보다 위');
  for (let i = 1; i < gs.length; i++) {
    assert.ok(gs[i - 1].finals > gs[i].finals || (gs[i - 1].finals === gs[i].finals && gs[i - 1].places >= gs[i].places));
  }
});

test('④ 위반 의심은 «이 조»의 기준만 — 맞게 쓴 출산전후휴가 조에 다른 조의 기준을 달지 않는다', () => {
  const ok = '제40조(출산전후휴가) ① 회사는 임신 중인 여성 사원에게 출산 전과 출산 후를 통하여 90일(미숙아를 출산한 경우 100일)의'
    + ' 출산전후휴가를 준다. 다만, 임신 중인 여성 사원이 1일 2시간의 근로시간 단축을 신청하는 경우 이를 허용한다.';
  const m = mini({ b1: ok }, { b1: linked('co7') });
  const h = V.topicHtml(m, '출산전후휴가', new Set());
  assert.doesNotMatch(h, /class="warn"/, '맞게 쓴 조인데 다른 조(임신기 근로시간 단축 등)의 기준이 붙었다');
});

test('⑥ 회사 이름·조 제목은 글자로만 — 꺾쇠가 태그가 되면 안 된다', () => {
  const m = M();
  const all = m.byTopic[K].map((g, i) => K + '|' + i);
  const h = V.topicHtml(m, K, new Set(all));
  assert.ok(!h.includes(CO_BAD), '회사 이름이 그대로 태그로 들어갔다');
  assert.ok(h.includes(V.esc(CO_BAD)));
  const list = V.listHtml(m, '', '');
  assert.ok(!list.includes('<i>꾀</i>'), '조 제목이 그대로 태그로 들어갔다');
  assert.ok(list.includes('&lt;i&gt;꾀&lt;/i&gt;'));
});

test('복사 글은 대표 글 그대로(자리표시 포함) — 단추 title 이 그렇다고 알린다', () => {
  const m = M();
  assert.match(V.copyText(m, K, 0), /\{근로자\}/);
  assert.match(V.topicHtml(m, K, new Set()), /data-act="copy"[^>]*title="[^"]*\{근로자\}[^"]*"/);
});

test('⑦ 모델은 한 번만 — 주제를 바꾸고 펼쳐도 다시 셈하지 않는다 · 진행·실패 알림 · 교정 기억', async () => {
  const real = V.model;
  let n = 0;
  V.model = function () { n++; return real.apply(this, arguments); };
  let fixGot = null;
  const crit = { evaluate: CR.evaluate, useMatchFix: (fn) => { fixGot = fn(); } };
  const S = {
    load: () => Promise.resolve(DATA),
    texts: (docs, cache, onProgress) => {
      const ids = Object.keys(docs);
      assert.ok(!ids.includes('dx') && !ids.includes('dh'), '규칙 본문·담김만 받는다');
      ids.forEach((id, i) => onProgress(i + 1, ids.length));
      seen = el.innerHTML;   // 받는 동안의 알림
      const t = {}; ids.filter((id) => id !== 'd3').forEach((id) => { t[id] = TEXTS[id]; });
      return Promise.resolve({ texts: t, failed: ['d3'] });
    },
  };
  const el = { innerHTML: '' };
  let seen = '';
  try {
    const ctl = V.mount(el, { S, cache: null, companies: COS, stdText: STD, today: TODAY, criteria: crit,
      loadFix: () => Promise.resolve({ B5: { pin: {} } }) });
    await ctl.ready;
    assert.match(seen, /글 읽는 중 \d+\/\d+/, '받는 동안 진행을 보인다');
    assert.equal(n, 1);
    assert.deepEqual(Object.keys(fixGot || {}), ['B5'], '교정 기억을 판정에 넘긴다');
    assert.match(el.innerHTML, /글을 못 읽은 문서 1건/);
    ctl.select('목적'); ctl.select(K); ctl.toggle(K, 0); ctl.search('연차'); ctl.select(K);
    assert.equal(n, 1, '주제를 바꿀 때마다 모델을 다시 셈했다');
    assert.match(el.innerHTML, /<h2>연차유급휴가<\/h2>/);
    assert.match(el.innerHTML, /class="who"/);
  } finally { V.model = real; }
});

test('⑦ 자료를 아직 못 받았을 때는 「불러오는 중」 — 「글 읽는 중 0/0」 이 아니다', async () => {
  let go;
  const S = { load: () => new Promise((r) => { go = r; }), texts: () => Promise.resolve({ texts: TEXTS, failed: [] }) };
  const el = { innerHTML: '' };
  const ctl = V.mount(el, { S, companies: COS, stdText: STD, today: TODAY, criteria: { evaluate: CR.evaluate, useMatchFix() {} } });
  assert.match(el.innerHTML, /불러오는 중/);
  assert.doesNotMatch(el.innerHTML, /글 읽는 중 0\/0/);
  go(DATA); await ctl.ready;
  assert.ok(ctl.state.M);
});

test('⑦ 교정 기억을 못 읽어도 화면은 선다', async () => {
  const S = { load: () => Promise.resolve(DATA), texts: (docs) => Promise.resolve({ texts: TEXTS, failed: [] }) };
  const el = { innerHTML: '' };
  const crit = { evaluate: CR.evaluate, useMatchFix: () => {} };
  const ctl = V.mount(el, { S, companies: COS, stdText: STD, today: TODAY, criteria: crit,
    loadFix: () => Promise.reject(new Error('권한 없음')) });
  await ctl.ready;
  assert.ok(ctl.state.M, '모델이 서야 한다');
  assert.doesNotMatch(el.innerHTML, /못 만들었습니다/);
});

/* ── 화면 머리 ── */
const RAW = fs.readFileSync(path.join(__dirname, '../rules-v2.html'), 'utf8');
const HTML = stripComments(RAW);

test('⑧ 새 js 는 캐시 번호를 달고 싣는다', () => {
  ['js/pu-rules-criteria.js', 'std_2026.js', 'js/rules-v2/lib-topics.js', 'js/rules-v2/text-cache.js', 'js/rules-v2/view-topics.js']
    .forEach((f) => assert.match(HTML, new RegExp('<script src="' + f.replace(/[.\/]/g, '\\$&') + '\\?v=\\d+"></script>'), f));
});

test('⑧ 주소 #topics 는 조별 문안, 그 밖은 모은 자료 — 같은 창, 뒤로가기는 깃발을 든다', () => {
  // 가르는 함수를 그대로 돌려 본다
  const head = HTML.match(/<script>\s*(window\.RV2_MODE[\s\S]*?)<\/script>/);
  assert.ok(head, '머리에 화면 가르기 손잡이가 있어야 한다');
  const ctx = { window: {}, location: { hash: '' }, addEventListener: () => {} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(head[1], ctx);
  assert.equal(ctx.RV2_MODE('#topics'), 'topics');
  assert.equal(ctx.RV2_MODE(''), 'lib');
  assert.equal(ctx.RV2_MODE('#lib'), 'lib');
  // 뒤로가기 손잡이는 공통 층(pu-back.js)보다 먼저 달린다 — 그래야 깃발이 먼저 선다
  assert.ok(HTML.indexOf("addEventListener('popstate'") < HTML.indexOf('js/pu-back.js'));
  assert.match(head[1], /__puBackNav = true/);
  assert.match(head[1], /addEventListener\('hashchange'/);
  // 갈래 자리 하나 — 세 갈래 단추(Task 5)에 이 파일의 두 화면 길이 다 있다
  //   (두 화면이 같은 단추를 드는지는 tests/rules-merge.test.js 가 본다)
  const nav = HTML.match(/<nav class="rmode"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, '머리줄에 갈래 단추가 있어야 한다');
  assert.match(nav[1], /href="rules-v2\.html#lib"/);
  assert.match(nav[1], /href="rules-v2\.html#topics"/);
});

test('⑧ 화면의 인라인 스크립트는 모두 구문이 맞다', () => {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(RAW))) { n++; assert.doesNotThrow(() => new vm.Script(m[1]), '인라인 스크립트 ' + n + ' 구문 오류'); }
  assert.ok(n >= 1);
});

test('⑧ 조별 문안의 한 줄 칸 — 넘치면 … ', () => {
  ['\\.tp span', '\\.ch2 \\.diff', '\\.warn', '\\.who div span'].forEach((sel) => {
    assert.match(HTML, new RegExp('#topics ' + sel + '\\{[^}]*text-overflow:ellipsis'), sel);
  });
  assert.match(HTML, /#topics \.ch2\{[^}]*white-space:nowrap/);
});
