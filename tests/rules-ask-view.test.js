/* 취업규칙 「💬 이 문서에 묻기」 그리기 (설계 §13). 회사·조문은 지어낸 것만.
   ★ 못 박는 것은 규칙이다:
     ① 글은 모두 esc — 질문·AI 답·조 제목의 꺾쇠가 태그가 되지 않는다
     ② 근거 조 단추는 data-ask-go(조 이름) — 왼쪽으로 옮겨 가는 손잡이 · AI 가 읽은 조도 같은 손잡이
     ③ 근거가 없으면 «없음», 근거를 못 믿으면 ⚠ — 빈칸으로 두지 않는다 · 뺀 조가 있으면 ⚠ 로 센다
     ④ 같은 조 검토 — 검토 전 / ✓ 지적 없음 / ⚠ 수(누르면 검토 탭으로 — data-ask-review)
     ⑤ 기다리는 중 · 실패 · 로컬에서 끝남(AI 안 부름)이 서로 다르게 보인다 · 빈 목록에도 안내가 있다
     ⑥ 묻는 범위는 «이 문서(원본)»라고 밝힌다 · 한 줄 칸은 title 에 전문 */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/rules-v2/view-ask.js');

const READY = {
  state: 'ready', q: '본인 결혼하면 며칠 <쉬나요>?', sent: ['제20조', '제21조'], titles: { '제20조': '연차유급휴가', '제21조': '경조휴가' },
  answer: '본인 결혼은 <b>5일</b>입니다.\n휴일은 넣지 않습니다.', cites: [{ label: '제21조', where: '①' }], none: false, dropped: 0,
  review: { state: 'ok' },
};

test('① 글은 모두 esc — 질문·답의 꺾쇠가 태그가 되지 않는다', () => {
  const h = V.itemHtml(READY);
  assert.ok(!h.includes('<b>5일</b>'), 'AI 답의 태그가 살아났다');
  assert.ok(h.includes('&lt;b&gt;5일&lt;/b&gt;'));
  assert.ok(h.includes('&lt;쉬나요&gt;'));
  assert.match(h, /입니다\.<br>휴일/, '줄바꿈을 지키지 않는다');
  const t = V.itemHtml(Object.assign({}, READY, { titles: { '제21조': '경조"><img src=x onerror=1>' } }));
  assert.ok(!/<img/.test(t), '조 제목의 태그가 살아났다');
});

test('② 근거 조 단추와 AI 가 읽은 조는 data-ask-go 손잡이', () => {
  const h = V.itemHtml(READY);
  const go = [...h.matchAll(/data-ask-go="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(go.includes('제21조'));
  assert.ok(go.includes('제20조'), 'AI 가 읽은 조에서 옮겨 갈 수 없다');
  assert.match(h, /제21조【경조휴가】 ①/);
  assert.match(h, /AI 가 읽은 조 2개/);
});

test('③ 근거 없음 · 근거를 못 믿음 · 뺀 조', () => {
  const none = V.itemHtml(Object.assign({}, READY, { none: true, cites: [], answer: '이 규칙에는 재택근무를 정한 조항이 없습니다.' }));
  assert.match(none, /근거<\/span><span class="ask-rv none">없음/);
  assert.ok(!/근거 조를 확인하지 못했습니다/.test(none), '«없다»는 답에 «못 믿는다»를 붙였다');
  const bare = V.itemHtml(Object.assign({}, READY, { cites: [] }));
  assert.match(bare, /근거 조를 확인하지 못했습니다/);
  const dropped = V.itemHtml(Object.assign({}, READY, { dropped: 2 }));
  assert.match(dropped, /문서에 없는 조를 근거로 들어 2개를 뺐습니다/);
});

test('④ 같은 조 검토 — 검토 전 / 지적 없음 / 지적 수(누르면 검토 탭)', () => {
  assert.match(V.reviewHtml({ state: 'before' }), /검토 전/);
  assert.match(V.reviewHtml({ state: 'ok' }), /지적 없음/);
  const w = V.reviewHtml({ state: 'warn', counts: { '위반의심': 1, '수동확인': 2 }, n: 3 });
  assert.match(w, /data-ask-review/);
  assert.match(w, /위반의심 1/);
  assert.match(w, /수동확인 2/);
  assert.ok(!/누락/.test(w), '없는 갈래를 적었다');
  // 근거가 없으면 «같은 조 검토» 줄도 없다 — 볼 조가 없다
  assert.ok(!/같은 조 검토/.test(V.itemHtml(Object.assign({}, READY, { none: true, cites: [] }))));
});

test('⑤ 기다림 · 실패 · 로컬에서 끝남이 다르게 보인다 · 빈 목록에도 안내', () => {
  const wait = V.itemHtml({ state: 'sending', q: '경조휴가?', sent: ['제21조'], titles: {} });
  assert.match(wait, /읽는 중/);
  assert.ok(!/ask-note/.test(wait), '답이 오기 전에 «AI 가 쓴 답» 경고가 붙었다');
  const err = V.itemHtml({ state: 'error', q: '경조휴가?', err: '오늘 AI 몫이 다 찼습니다' });
  assert.match(err, /ask-err/);
  assert.match(err, /AI 몫이 다 찼습니다/);
  const local = V.itemHtml({ state: 'nolocal', q: '주차장?', msg: '이 문서에서 관련 조를 찾지 못했습니다' });
  assert.match(local, /관련 조를 찾지 못했습니다/);
  assert.ok(!/AI 가 읽은 조/.test(local), 'AI 를 안 불렀는데 «읽은 조»를 그렸다');
  assert.match(V.listHtml([]), /ask-empty/);
  const two = V.listHtml([READY, { state: 'error', q: '둘째', err: '실패' }]);
  assert.ok(two.indexOf('결혼') < two.indexOf('둘째'), '목록 차례를 바꿨다');
});

test('⑥ 묻는 범위 — «이 문서(원본)» · 회사 · 조 수 · 한 줄 칸은 title 에 전문', () => {
  const s = V.scopeHtml({ site: '가나상사㈜', n: 101 });
  assert.match(s, /이 문서\(원본\)/);
  assert.match(s, /가나상사㈜/);
  assert.match(s, /101개 조/);
  assert.match(s, /title="[^"]*101개 조/);
  assert.match(V.itemHtml(READY), /class="ask-note" title="[^"]+"/);
});
