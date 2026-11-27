/* 정부사업신청 «📮 오늘의 요약» 팝업 — 카톡 «전체 보기» 단추가 gov.html?digest=1 로 여는 곳 (대표 지시 2026-11-22 「공식 방식으로」)
   ★ 남이 쓴 글이라 제목·기관·까닭은 전부 이스케이프하고, 원문 주소는 https 만 링크로 건다(javascript: 는 못 쓴다)
   ★ 서버가 못 보냈으면 이유를 쉬운 말로 보여 준다 · 아직 요약이 없으면 «언제 만들어지는지» 말한다
   ★ 읽기만 한다 — gov_digest 한 자리만 읽고, 카카오 토큰 자리(gov_digest_secret)는 화면 코드에 아예 없다
   ★ 카톡 «전체 보기»(?digest=1)로 들어오면 🎯 하루 한 번 자동 팝업을 겹쳐 띄우지 않는다
   ★ 자료는 지어낸 것이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
function slice(from, to) {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  assert.ok(a >= 0 && b > a, '화면 코드에서 ' + from + ' 를 못 찾았다');
  return SRC.slice(a, b);
}
function load() {
  const ctx = { String, Array, Number };
  vm.runInNewContext(slice('function esc(s){', '\nfunction ') + '\n' + slice('var DIGEST_WHY=', 'async function digestOpen') + '\n;globalThis.__api={digestBody,esc};', ctx);
  return ctx.__api;
}
const item = (o) => Object.assign({ id: 'feed:1', title: '노무 진단 사업', org: '지어낸기관', due: '~11.30 · D-7', days: 7, why: ['걸린 낱말 노무'], url: 'https://example.test/a', groups: [], isNew: true, isSoon: false }, o || {});
const last = (items) => ({ today: '2026-11-23', fresh: 2, remind: 1, sections: [{ key: 'main', title: '📋 정부사업 공고', items: items || [item()] }, { key: 'ai', title: '🤖 AI 사업 (전국)', items: [] }] });

test('★ 줄마다 제목 링크·기관·마감·까닭·새/마감 임박 표시를 그린다', () => {
  const h = load().digestBody(last([item(), item({ id: 'feed:2', title: '둘째', isNew: false, isSoon: true, why: [] })]), null);
  assert.match(h, /href="https:\/\/example\.test\/a"/);
  assert.match(h, /rel="noopener"/);
  assert.match(h, /target="_blank"/);
  assert.match(h, /지어낸기관 · ~11\.30 · D-7/);
  assert.match(h, /걸린 낱말 노무/);
  assert.match(h, /새/);
  assert.match(h, /마감 임박/);
  assert.match(h, /기준 · 새로 걸린 것 <b>2<\/b>건 · 마감 임박 <b>1<\/b>건/);
  assert.match(h, /오늘은 이 갈래에 걸린 것이 없습니다/, '빈 갈래는 빈 갈래라고 말한다');
});

test('★ 남이 쓴 글은 이스케이프하고, https 가 아닌 주소는 링크로 걸지 않는다', () => {
  const bad = ['javascript:alert(1)', 'http://example.test/x', 'data:text/html,<script>1</script>', '//example.test/x', ' https://example.test/x'];
  bad.forEach((u) => {
    const h = load().digestBody(last([item({ title: '<img src=x onerror=alert(1)>', org: '<b>기관</b>', why: ['"><script>x</script>'], url: u })]), null);
    assert.ok(!/<img src=x/.test(h) && !/<script>/i.test(h) && !/<b>기관<\/b>/.test(h), '이스케이프: ' + u);
    assert.ok(!/href="(javascript|http:|data|\/\/)/i.test(h), '링크로 걸리면 안 된다: ' + u);
  });
  const ok = load().digestBody(last([item({ url: 'https://example.test/a?x="onmouseover="y' })]), null);
  assert.ok(!/onmouseover="y/.test(ok.replace(/&quot;/g, '')) || /&quot;onmouseover=&quot;/.test(ok), '따옴표를 이스케이프해 속성을 못 빠져나간다');
});

test('★ 서버가 못 보냈으면 이유를 쉬운 말로, 요약이 없으면 «언제 만들어지는지»를 말한다', () => {
  const api = load();
  assert.match(api.digestBody(last(), { ok: false, error: 'not-connected' }), /카카오 연결이 아직 안 됐습니다/);
  assert.match(api.digestBody(last(), { ok: false, error: 'reconnect-needed' }), /다시 연결/);
  assert.match(api.digestBody(last(), { ok: false, error: '<script>' }), /알 수 없는 오류/, '모르는 코드는 그대로 찍지 않는다');
  assert.ok(!/마지막 카톡 보내기가 안 됐습니다/.test(api.digestBody(last(), { ok: true })), '잘 됐으면 경고 없음');
  const none = api.digestBody(null, null);
  assert.match(none, /아직 요약이 없습니다/);
  assert.match(none, /8시 30분/);
});

test('★ 화면은 gov_digest 한 자리만 읽는다 — 토큰 자리는 코드에 없고, 카톡으로 들어오면 🎯 팝업을 겹쳐 띄우지 않는다', () => {
  assert.ok(SRC.includes("fbDb.ref('gov_digest').once('value')"));
  assert.ok(!/gov_digest_(secret|state|cfg)/.test(SRC), '서버 전용 자리 이름이 화면 코드에 없다');
  assert.ok(!/\.ref\(['"]gov_digest['"]\)\.(set|update|remove|push)/.test(SRC), '화면은 쓰지 않는다');
  assert.match(SRC, /digest=1\(\?:&\|\$\)\/\.test\(location\.search\)\) digestOpen\(\);/);
  assert.match(SRC, /async function pickAuto\(\)\{\s*try\{\s*if\(\/\[\?&\]digest=1\(\?:&\|\$\)\/\.test\(String\(location\.search\|\|''\)\)\) return;/, 'pickAuto 가 ?digest=1 이면 물러난다');
});
