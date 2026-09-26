/* 법 개정 감시 — 화면 쪽 (js/pu-rules-lawwatch.js · rules.html)
   왜 생겼나(2026-09-26): 우리 검토 기준 92개는 손으로 관리해서, 법이 바뀌어도 아무도 알려주지
   않았다. 서버가 매일 새벽 법 개정을 적고, 화면은 그것을 «흔들린 기준 → 다시 볼 사업장» 으로 좁힌다.
   지키는 것: ① 판정 규칙(반영 안 됨·조항 없음·확인 필요·반영됨) ② 「개정안 만들기」 가
             시행일을 기준일로 넘긴다 ③ 이 창은 아무것도 저장하지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../js/pu-rules-lawwatch.js');
const K = require('../js/pu-rules-lawlink.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'rules.html'), 'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
function rules() {
  const at = html.indexOf('const RULES = ');
  return JSON.parse(html.slice(at + 'const RULES = '.length, html.indexOf('\n', at)).replace(/;\s*$/, ''));
}
const R = rules();
/* 실제 사건 모양 — 2026-06-09 근로기준법 개정(제54조는 부칙 단서로 6개월 뒤 시행) */
const EV = { id: '001872_21784', lawKey: '근로기준법', no: '21784', promulgated: '2026-06-09', effective: '2027-06-10',
  firstEffective: '2026-12-10',
  arts: { 54: { art: '54', title: '휴게', kind: '개정', before: '① 옛', after: '① 새', effective: '2026-12-10' } } };
const byRule = id => R.find(r => r.id === id);
/* 파이어베이스에 손대는 곳 — ref(...) 뒤에 이어 부른 것이 once 가 아니면 «쓰기»(또는 구독)다.
   ⚠ 배열 push·WeakMap set 을 쓰기로 세지 않는다(그건 화면 안의 일이다). */
function dbWrites(src) {
  const out = [];
  for (const m of src.matchAll(/\bref\s*\(/g)) {
    let d = 0, i = m.index + m[0].length - 1;
    for (; i < src.length; i++) { if (src[i] === '(') d++; else if (src[i] === ')' && --d === 0) break; }
    const next = /^\s*(?:\.child\([^)]*\)\s*)*\.(\w+)/.exec(src.slice(i + 1));
    if (!next || next[1] !== 'once') out.push(src.slice(m.index, i + 30));
  }
  if (/\b(putRecord|storePut|putRulesIndex)\s*\(/.test(src)) out.push('보관함 저장');
  return out;
}

test('흔들린 기준 — 시행일이 같은 기준이 있으면 「이미 있음」, 나머지는 그 기준이 맡는다', () => {
  const c = W.criteria(EV, R, K)[0];
  const cited = K.rulesForArticle('근로기준법', '54', R);
  assert.ok(cited.length >= 1);
  const same = cited.filter(id => byRule(id).effective === '2026-12-10');
  c.rules.forEach(r => {
    if (same.includes(r.id)) assert.equal(r.state, 'covered', r.id);
    else assert.equal(r.state, same.length ? 'coveredBy' : 'update', r.id);
  });
  assert.equal(c.covered, same.length > 0);
  /* 시행일이 다른 조 — 맡을 기준이 없으면 「손질 필요」 로 드러난다 */
  const odd = Object.assign({}, EV, { arts: { 54: Object.assign({}, EV.arts[54], { effective: '2031-01-01' }) } });
  assert.ok(W.criteria(odd, R, K)[0].rules.every(r => r.state === 'update'),
    '★ 우리 기준에 없는 개정인데 「이미 있음」 으로 보이면 아무도 기준을 안 고친다');
});

test('법 전체에 기댄 규칙은 조 개정의 «흔들린 기준» 에 안 섞인다', () => {
  const lawWide = R.filter(r => K.parse(r.law).laws.some(x => x.law === '근로기준법')).map(r => r.id);
  assert.ok(lawWide.length >= 1, '이 검사가 뜻이 있으려면 법 전체 규칙이 하나는 있어야 합니다');
  const ids = W.criteria(EV, R, K)[0].rules.map(r => r.id);
  lawWide.forEach(id => assert.ok(!ids.includes(id), id + ' 가 제54조 개정에 섞였습니다'));
});

test('사업장마다 «마지막 완료 회차» 하나 — 지운 회차는 안 본다', () => {
  const s = W.latestSites({
    site_a: { r1: { asof: '2025-01-01' }, r2: { asof: '2026-07-01' }, r3: { asof: '2027-01-01', _deleted: true } },
    site_b: { r1: { asof: '2024-01-01', doneAt: '2024-01-02' } }
  });
  assert.equal(s.find(x => x.siteKey === 'site_a').rev, 'r2');
  assert.equal(s.length, 2);
});

test('사업장 판정 — 엔진 결과를 따르고, 수동확인은 그 회차의 기준일로 가른다', () => {
  const ids = K.rulesForArticle('근로기준법', '54', R);
  const mk = (asof, results) => ({ siteKey: 's_' + asof, rev: 'r', rec: { site: '가나상사', asof, ownerUid: 'u1', ownerName: '홍길동', _r: results } });
  const evalFn = (rec) => rec._r;
  const ok = ids.map(id => ({ id, status: '적합', found: true, loc: '제9조(휴게)' }));
  const rows = W.sitesFor(EV, [
    mk('2026-01-01', [{ id: ids[0], status: '누락', found: true, loc: '제9조(휴게)' }]),      // 조항은 있는데 못 채움
    mk('2026-02-01', [{ id: ids[0], status: '누락', found: false, loc: '' }]),               // 관련 조항 자체가 없음
    mk('2026-03-01', [{ id: ids[0], status: '수동확인', found: true, loc: '제9조(휴게)' }]),  // 시행일 전 기준일
    mk('2026-12-15', [{ id: ids[0], status: '수동확인', found: true, loc: '제9조(휴게)' }]),  // 시행일 뒤 기준일로 검토됨
    mk('2026-04-01', ok),
    mk('2026-05-01', [])                                                                     // 이 사업장엔 안 걸림
  ], evalFn, R, K);
  const st = Object.fromEntries(rows.map(r => [r.asof, r.state]));
  assert.equal(st['2026-01-01'], 'todo');
  assert.equal(st['2026-02-01'], 'missing');
  assert.equal(st['2026-03-01'], 'manual');
  assert.equal(st['2026-12-15'], 'done', '★ 시행일 뒤 기준일로 검토한 회차까지 「확인 필요」 면 끝없이 뜬다');
  assert.equal(st['2026-04-01'], 'done');
  assert.equal(st['2026-05-01'], undefined, '걸리는 기준이 없는 사업장은 줄을 안 만든다');
  assert.equal(rows[0].state, 'todo', '반영 안 됨이 맨 위');
  const c = W.counts(rows, 'u1');
  assert.equal(c.open, 3);
  assert.equal(c.mine, 3);
});

test('판정 함수는 조마다 «그 조의 시행일» 을 기준일로 받는다', () => {
  const seen = [];
  W.sitesFor(EV, [{ siteKey: 's', rev: 'r', rec: { asof: '2026-01-01' } }], (rec, asof, ids) => { seen.push(asof); return []; }, R, K);
  assert.deepEqual(seen, ['2026-12-10']);
});

test('사건은 가까운 시행일 순', () => {
  const s = W.sortEvents({ a: { id: 'a', arts: {}, firstEffective: '2027-06-10' }, b: { id: 'b', arts: {}, firstEffective: '2026-11-27' } });
  assert.deepEqual(s.map(e => e.id), ['b', 'a']);
  assert.equal(W.daysTo('2026-12-10', '2026-09-26'), 75);
  assert.equal(W.artLabel('18의3'), '제18조의3');
});

test('셈개는 읽기만 한다 — 사건과 마지막 확인만 받고, 기준 판(base)은 안 받는다', () => {
  const src = bare(fs.readFileSync(path.join(root, 'js/pu-rules-lawwatch.js'), 'utf8'));
  assert.deepEqual(dbWrites(src), [], '★ 셈개가 저장소에 씁니다(또는 구독합니다) — 한 번 읽기(once)만 합니다');
  assert.ok(/ref\(PATH \+ '\/events'\)\s*\.once/.test(src), '사건을 읽는 자리를 못 찾았습니다 — 검사가 헛돕니다');
  assert.doesNotMatch(src, /\/base['"]/, '★ 기준 판은 화면에 필요 없습니다 — 법마다 조 글자가 다 들어 있어 무겁습니다');
});

/* ── rules.html ── */
function lwBlock() {
  const a = html.indexOf('/* ══════ 법 개정 감시');
  const b = html.indexOf('document.querySelectorAll("[data-close]")', a);
  assert.ok(a > 0 && b > a, '규정관리에서 법 개정 감시 토막을 찾지 못했습니다');
  return html.slice(a, b);
}

test('규정관리가 연결표·셈개를 캐시 번호와 함께 싣는다', () => {
  assert.match(html, /<script src="js\/pu-rules-lawlink\.js\?v=\d+"><\/script>/);
  assert.match(html, /<script src="js\/pu-rules-lawwatch\.js\?v=\d+"><\/script>/);
  assert.match(html, /id="lw-open"/);
  assert.match(html, /id="ov-lw"/);
});

test('법 개정 감시 창은 아무것도 저장하지 않는다', () => {
  const b = bare(lwBlock());
  assert.deepEqual(dbWrites(b), [], '★ 이 창이 저장합니다 — 「개정안 만들기」 는 새 회차 길로 넘길 뿐이어야 합니다');
  /* 검사가 헛돌지 않는지 — 쓰기를 한 줄 넣으면 잡혀야 한다 */
  assert.equal(dbWrites('FBDB.ref("rules_mgmt/lawwatch/x").set(1)').length, 1);
  assert.equal(dbWrites('LW_ARTS.set(rec,arts); out.push(1); db.ref(P).once("value")').length, 0);
});

test('「개정안 만들기」 는 그 조의 시행일을 기준일로 새 회차 길에 넘기고, 새 회차 길은 그 날짜로 검토한다', () => {
  const b = bare(lwBlock());
  assert.match(b, /startNextRevision\([^)]*\{\s*asof\s*:/, '★ 기준일을 안 넘기면 오늘 기준으로 검토해 시행 예정 개정이 안 걸린다');
  const at = html.indexOf('async function startNextRevision(');
  const body = bare(html.slice(at, html.indexOf('\nfunction ', at)));
  const setAsof = body.search(/opts\.asof[\s\S]{0,40}\$\("asof"\)\.value\s*=\s*opts\.asof/);
  const run = body.indexOf('$("run").click()');
  assert.ok(setAsof > 0, '★ 새 회차 길이 넘겨받은 기준일을 안 씁니다');
  assert.ok(run > setAsof, '★ 기준일을 검토를 돌린 «뒤에» 바꾸면 소용이 없습니다');
  /* 남의 사업장은 단추 대신 담당자 이름 — 저장 권한이 담당자에게만 있다 */
  assert.match(b, /r\.ownerUid===FBUSER\.uid/);
});

test('로그인하면 불러오고, 완료 회차가 바뀌면 다시 판정한다', () => {
  /* 로그인 갈래(if(u){ … }) 한 덩어리를 통째로 본다 — 고정 길이로 자르면 줄이 하나 늘 때마다 깨진다 */
  const at = html.indexOf('if(u){subscribeArch();');
  const login = html.slice(at, html.indexOf('}else if(FBDB){', at));
  assert.match(login, /lwLoad\(\)/);
  const sub = html.slice(html.indexOf('function subscribeArch()'), html.indexOf('function subscribeArch()') + 1200);
  assert.match(sub, /lwInvalidate\(\)/, '★ 누가 개정을 확정해도 배지가 그대로면 이미 한 일을 또 하라고 한다');
});

test('앞뒤 글자 대조 — 바뀐 줄 안에서 더해진 글자만 칠한다', () => {
  const b = lwBlock();
  const pick = name => { const i = b.indexOf('function ' + name + '('); let d = 0, j = b.indexOf('{', i); for (; j < b.length; j++) { if (b[j] === '{') d++; else if (b[j] === '}' && --d === 0) break; } return b.slice(i, j + 1); };
  const fn = new Function(pick('lwE') + pick('lwCharDiff') + pick('lwDiff') + '; return lwDiff;')();
  const d = fn('① 1시간을 준다.\n② 자유롭게 쓴다.', '① 1시간을 준다. 다만, 요청하면 아니한다.\n② 자유롭게 쓴다.');
  assert.match(d.n, /<ins> 다만, 요청하면 아니한다\.<\/ins>/);
  assert.doesNotMatch(d.n, /<ins>② /, '안 바뀐 줄은 칠하지 않는다');
  assert.doesNotMatch(d.o, /<del>/, '지운 글자가 없으면 앞쪽은 칠하지 않는다');
  /* 앞·뒤 «둘 다» — 한쪽만 보면 다른 쪽이 새도 모른다(2026-09-26 망가뜨려 보기에서 앞쪽이 샜다) */
  const tagged = fn('<b>x', '<i>x');
  [tagged.o, tagged.n].forEach(s => {
    assert.doesNotMatch(s, /<i>|<b>/, '★ 법 원문의 꺾쇠가 태그로 먹힌다 — 글자로만 넣는다');
    assert.match(s, /&lt;/);
  });
});
