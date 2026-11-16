/* 정부사업신청 — 📍 대전·충남·충북 탭 (대표 지시 2026-11-16 「대전충남충북 공공기관의 입찰 컨설턴트모집은 별도로 탭만들어 관리하게 해달라」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 이 검사가 못 박는 규칙
     ① 지역은 «적혀 있을 때만» — 기관·참가 가능 지역·지역 표시·제목·그 지역 기관 게시판. 「디지털 대전환」·「예산」·「음성」은 지역이 아니다.
     ② 서버 게시판 번호표(BOARD_REGION)는 서버(functions/recruit-watch.js BOARDS)와 맞물린다 — 이름에 그 지역이 적혀 있고,
        이름에 지역이 적힌 서버 게시판은 빠짐없이 번호표에 있다(새 지역 게시판을 더하고 여기를 잊으면 빨갛다).
     ③ 이 탭은 자료를 «빌려» 그린다 — ★·숨김·봤음은 원래 자리(공고 목록 type/hidden · recruit_star · recruit_seen)에 적힌다.
     ④ 자료 목록 규칙 — 맨 왼쪽 ☐ + 번호(보이는 차례), 고른 것은 화면을 떠나면 비운다, 일괄 숨기기는 건수를 묻고 «한 번» 저장(지우지 않는다).
     ⑤ 마감 지난 것·숨긴 것은 기본 보기에서 빠지지만 «보기»로 언제든 다시 본다(켜는 길·푸는 길).
   gov.html 의 스크립트를 vm 에 올려 «실제로» 돌린다.
   실행: node --test tests/gov-region.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const R = require('../js/gov-region.js');
const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
const watchSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'recruit-watch.js'), 'utf8');

/* ───────── ① 지역 판정 ───────── */
test('★★ 지역 낱말 — 도·광역시·시군 이름은 잡고, 낱말과 겹치는 것(대전환·예산·음성·아산재단)은 안 잡는다', () => {
  assert.deepEqual(R.regionsIn('대전광역시 유성구 노무 컨설팅'), ['대전']);
  assert.deepEqual(R.regionsIn('충청남도 천안시'), ['충남']);
  assert.deepEqual(R.regionsIn('충북 청주 일터혁신'), ['충북']);
  assert.deepEqual(R.regionsIn('대전·충남 지역 컨설턴트'), ['대전', '충남']);
  assert.deepEqual(R.regionsIn('AI 디지털 대전환 컨설팅'), [], '「대전환」은 대전이 아니다');
  assert.deepEqual(R.regionsIn('2027년 예산 편성 컨설팅'), [], '「예산」(돈)');
  assert.deepEqual(R.regionsIn('예산군 노동권익센터'), ['충남'], '«군»이 붙으면 예산군');
  assert.deepEqual(R.regionsIn('음성 인식 시스템 구축'), []);
  assert.deepEqual(R.regionsIn('서울아산병원 인사제도'), [], '아산은 «아산시»만');
  assert.deepEqual(R.regionsIn('충청권 공공기관 위원 모집'), [R.WIDE], '도가 안 적힌 «충청»은 충청권으로 따로');
  assert.deepEqual(R.regionsIn('대전충청지방노무사회 위원 추천'), ['대전'], '도가 적히면 충청권은 안 붙인다');
  assert.equal(R.label(R.WIDE), '충청권');
});

test('★★ 공고 줄 — 참가 가능 지역 → 기관 → 공고 기관 → 공고명 차례로 보고 «까닭»을 단다', () => {
  const a = R.ofFeed({ src: '나라장터', rgn: '충청남도 · 세종특별자치시', org: '서울특별시 가나구청', nm: '노무 용역' });
  assert.deepEqual(a.regions, ['충남']); assert.match(a.why[0], /^참가 가능 지역 — 충남$/);
  const b = R.ofFeed({ src: '기업마당', rgn: '충북', org: '중소벤처기업부', nm: '[충북] 컨설팅 지원' });
  assert.deepEqual(b.regions, ['충북']); assert.match(b.why[0], /^지역 표시/, '기업마당 rgn 은 해시태그·제목에서 읽은 것');
  const c = R.ofFeed({ src: '나라장터', org: '대전광역시 서구', nm: '조직진단 용역' });
  assert.deepEqual(c.regions, ['대전']); assert.match(c.why[0], /^기관 — 대전$/);
  assert.deepEqual(R.ofFeed({ src: '나라장터', org: '한국가나공사', nm: '디지털 대전환 컨설팅' }).regions, [], '어디에도 지역이 없으면 빼다');
});

test('★★ 모집 글 — 그 지역 기관 게시판이면 제목에 지역이 없어도 들어오고, 전국 게시판은 «제목»에 지역이 있을 때만', () => {
  const a = R.ofHit({ board: 'djtp', title: '전문가 인력풀 모집', boardName: '대전테크노파크 사업공고' });
  assert.deepEqual(a.regions, ['대전']); assert.match(a.why.join(' / '), /지역 기관 게시판 — 대전/);
  assert.deepEqual(R.ofHit({ board: 'nosa', title: '2027 충북 일터혁신 컨설턴트 모집', boardName: '노사발전재단 사업공고/모집' }).regions, ['충북']);
  assert.deepEqual(R.ofHit({ board: 'nosa', title: '일터혁신 컨설턴트 모집', boardName: '노사발전재단 사업공고/모집' }).regions, [], '전국 게시판 · 제목에 지역 없음 → 빼다');
  assert.deepEqual(R.ofHit({ board: 'kcplaa', title: '충남지방노동위원회 공익위원 모집', boardName: '공인노무사회 공지' }).regions, ['충남']);
});

/* ───────── ② 서버 게시판과 맞물림 ───────── */
const BOARDS = [...watchSrc.matchAll(/\{\s*id:\s*'([\w-]+)'[^}]*?name:\s*'([^']+)'/g)].map((m) => ({ id: m[1], name: m[2] }));
test('★★★ 게시판 번호표는 서버와 맞물린다 — 번호가 서버에 있고, 이름에 그 지역이 적혀 있다', () => {
  assert.ok(BOARDS.length >= 20, '서버 게시판 목록을 못 읽었다 — 이 검사의 찾는 법을 고쳐야 한다');
  Object.keys(R.BOARD_REGION).forEach((id) => {
    const b = BOARDS.find((x) => x.id === id);
    assert.ok(b, '서버에 없는 게시판 번호: ' + id + ' — 서버에서 번호를 바꿨으면 js/gov-region.js 도 바꾼다');
    assert.ok(R.regionsIn(b.name).includes(R.BOARD_REGION[id]), id + ' 게시판(' + b.name + ')의 이름에 ' + R.BOARD_REGION[id] + ' 이(가) 없다');
  });
});
test('★★★ 이름에 대전·충남·충북이 적힌 서버 게시판은 빠짐없이 번호표에 있다 — 새 지역 게시판을 더하고 잊으면 이 탭에 안 뜬다', () => {
  BOARDS.forEach((b) => {
    const rg = R.regionsIn(b.name).filter((k) => k !== R.WIDE);
    if (rg.length) assert.ok(R.BOARD_REGION[b.id], b.id + '(' + b.name + ') 가 js/gov-region.js BOARD_REGION 에 없다');
  });
});

/* ───────── build — 차례·셈 ───────── */
test('★ 차례 — 마감 안 지난 것(가까운 마감부터) → 마감 모름(최근 것부터) → 마감 지난 것 · 숨긴 것은 셈에서 뺀다', () => {
  const due = (k, days, to) => () => ({ k, days, text: k, to });
  const b = R.build({
    feed: [
      { id: 'A', org: '충청남도', nm: '가', savedAt: '2026-11-10', type: '새 공고' },
      { id: 'B', org: '충청남도', nm: '나', savedAt: '2026-11-12', type: '새 공고' },
      { id: 'C', org: '충청남도', nm: '다', savedAt: '2026-11-01', type: '지나감' },
      { id: 'D', org: '충청남도', nm: '라', savedAt: '2026-11-01', type: '새 공고', hidden: true },
      { id: 'E', org: '서울특별시', nm: '마', savedAt: '2026-11-01', type: '새 공고' }],
    hits: [{ key: 'h1', board: 'daejeon', title: '위원 모집', date: '2026-11-11' }],
    seen: {},
    deps: {
      feedDue: (r) => ({ A: { k: 'open', days: 9 }, B: { k: 'soon', days: 2 }, C: { k: 'past', days: -3 }, D: { k: 'open', days: 1 } })[r.id] || null,
      hitDue: due('unknown', null, '')
    }
  });
  assert.deepEqual(b.items.map((x) => x.ref), ['D', 'B', 'A', 'h1', 'C'], '서울 공고(E)는 빠지고, 마감 가까운 차례');
  assert.equal(b.counts.feed, 3, '숨긴 D 는 셈에서 뺀다'); assert.equal(b.counts.hit, 1);
  assert.equal(b.counts.fresh, 3, '마감 안 지난 새 공고 A·B + 안 본 모집 글 h1');
  assert.equal(b.counts['충남'], 3); assert.equal(b.counts['대전'], 1);
});

/* ───────── ③④⑤ 화면에서 «실제로» ───────── */
function FixedDate(now) {
  const Real = Date;
  function D(...a) { return a.length ? new Real(...a) : new Real(now); }
  D.now = () => new Real(now).getTime(); D.prototype = Real.prototype; D.parse = Real.parse; D.UTC = Real.UTC;
  return D;
}
function runApp(seed, opt) {
  opt = opt || {};
  const els = {}, toasts = [];
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '', className: '', checked: false, title: '',
      style: {}, classList: { add(){}, remove(){} } };
    return els[id];
  }
  const store = {};
  Object.keys(seed || {}).forEach((k) => { store['gov3_' + k] = typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]); });
  const ctx = {
    console, setTimeout, clearTimeout, Math, JSON, String, Number, Object, Array, RegExp, Promise,
    Date: FixedDate('2026-11-16T10:00:00'),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { getElementById: el, createElement: () => ({ click(){}, style:{} }), addEventListener(){} },
    location: { protocol: 'https:' }, navigator: {},
    GovG2b: require('../js/gov-g2b.js'), GovPlan: require('../js/gov-plan.js'), GovCareer: require('../js/gov-career.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'), GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'), GovRecruit: require('../js/gov-recruit.js'),
    GovSubmit: require('../js/gov-submit.js'), GovMatch: require('../js/gov-match.js'), GovOrgRec: require('../js/gov-orgrec.js'),
    GovInbox: require('../js/gov-inbox.js'), GovPick: require('../js/gov-pick.js'), GovSync: require('../js/gov-sync.js'), GovRegion: R,
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort = () => {}; this.signal = null; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} }, Blob: function(){},
    prompt: () => null, confirm: () => (opt.confirm !== false), open: opt.open || (() => null),
    screen: { availWidth: 1600, availHeight: 900 }, TextDecoder, Uint8Array
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
  vm.runInNewContext(code + '\n;globalThis.__api={setTab,draw,recDraw,rgnDraw,rgnDo,rgnTog,rgnSelAll,rgnBulk,rgnReg,get,recObj,recOpenPost,'
    + 'getSel:function(){ return _rgnSel; },setWatch:function(w){ _recWatch=w; },'
    + 'toast:function(f){ toast=f; }};', ctx);
  ctx.__api.toast((m) => toasts.push(m));
  return { api: ctx.__api, el, store, toasts };
}
const FEED = [
  { id: 'G0001', src: '나라장터', type: '새 공고', nm: '천안시 노무관리 컨설팅 용역', org: '충청남도 천안시', closeDt: '2026-11-25 18:00', savedAt: '2026-11-14T09:00:00Z', url: 'https://example.com/1' },
  { id: 'G0002', src: '나라장터', type: '새 공고', nm: '조직진단 용역', org: '서울특별시 가나구청', closeDt: '2026-11-25 18:00', savedAt: '2026-11-14T09:00:00Z' },
  { id: 'G0003', src: '알리오', type: '지나감', nm: '경영평가위원 위촉', org: '충북가나공사', closeDt: '2026-10-21 18:00', savedAt: '2026-10-07T09:00:00Z' },
  { id: 'G0004', src: '나라장터', type: '새 공고', nm: '디지털 대전환 컨설팅', org: '한국가나원', closeDt: '2026-11-30 18:00', savedAt: '2026-11-15T09:00:00Z' },
  { id: 'G0005', src: '기업마당', type: '관심', nm: '[대전] 노무 지원사업', org: '중소벤처기업부', rgn: '대전', closeDt: '2026-12-10', savedAt: '2026-11-15T09:00:00Z' }
];
const WATCH = { hits: {
  h1: { key: 'h1', board: 'djtp', boardName: '대전테크노파크 사업공고', title: '전문가 인력풀 <모집>', date: '2026-11-13', href: 'https://example.com/h1', per: { to: '2026-11-28' } },
  h2: { key: "h'2", board: 'nosa', boardName: '노사발전재단', title: '일터혁신 컨설턴트 모집', date: '2026-11-12', href: 'https://example.com/h2' },
  h3: { key: 'h3', board: 'nosa', boardName: '노사발전재단', title: '2027 충북 일터혁신 컨설턴트 모집', date: '2026-11-12', href: 'https://example.com/h3', per: { to: '2026-12-01' } }
}, last: { at: Date.now() } };
const rowsOf = (h) => (h.match(/<tr class="rr/g) || []).length;
/* 줄 하나(그 줄의 <tr …> ~ </tr>) — 다른 줄의 글자에 속지 않게 */
const rowFor = (h, sel) => h.split('</tr>').find((t) => t.includes('data-sel="' + sel + '" onclick="rgnRowClick')) || '';

test('★★★ 탭이 있고, 열면 이 화면만 보인다 · 다른 탭으로 가면 숨는다', () => {
  assert.match(src, /<button class="tb" id="tbRgn" onclick="setTab\('rgn'\)"[^>]*>📍 대전·충남·충북<\/button>/);
  assert.match(src, /<script src="js\/gov-region\.js\?v=\d+"><\/script>/, '화면이 모듈을 싣는다');
  const r = runApp({ feed: FEED });
  r.api.setTab('rgn');
  assert.equal(r.el('pgRgn').style.display, ''); assert.equal(r.el('pgFeed').style.display, 'none'); assert.equal(r.el('pgRec').style.display, 'none');
  assert.match(r.el('tbRgn').className, /\bon\b/);
  r.api.setTab('feed');
  assert.equal(r.el('pgRgn').style.display, 'none'); assert.doesNotMatch(r.el('tbRgn').className, /\bon\b/);
});

test('★★★ 그 지역 공고·모집 글만 한 목록에 — ☐ + 번호가 맨 왼쪽, 제목은 이스케이프', () => {
  const r = runApp({ feed: FEED });
  r.api.setWatch(WATCH); r.api.setTab('rgn');
  const h = r.el('rgnTb').innerHTML;
  assert.match(h, /천안시 노무관리 컨설팅 용역/); assert.match(h, /\[대전\] 노무 지원사업/);
  assert.match(h, /전문가 인력풀 &lt;모집&gt;/, '지역 게시판 글 — 제목은 이스케이프');
  assert.match(h, /2027 충북 일터혁신 컨설턴트 모집/, '전국 게시판이라도 제목에 지역');
  assert.doesNotMatch(h, /조직진단 용역|디지털 대전환/, '서울·대전환은 빠진다');
  assert.doesNotMatch(h, />일터혁신 컨설턴트 모집</, '지역 없는 전국 글은 빠진다');
  assert.doesNotMatch(h, /경영평가위원 위촉/, '마감 지난 것은 기본 보기에서 빠진다');
  assert.equal(rowsOf(h), 4);
  /* 맨 왼쪽 ★ · ☐ · 번호 차례 */
  const first = h.slice(h.indexOf('<tr class="rr'), h.indexOf('</tr>'));
  const iStar = first.indexOf('class="stc"'), iChk = first.indexOf('class="row-chk"'), iRn = first.indexOf('class="rn"'), iTt = first.indexOf('class="tt"');
  assert.ok(iStar > 0 && iStar < iChk && iChk < iRn && iRn < iTt, '★ · ☐ · № 가 제목 앞에 차례로');
  assert.match(first, /<td class="rn">1<\/td>/);
  assert.match(r.el('rCnt').textContent, /지금 4건 · 공고 2 · 모집 글 2/);
});

test('★★ 보기를 넓히면 마감 지난 것이 돌아오고, 지역 칩으로 좁힌다(켜는 길·푸는 길)', () => {
  const r = runApp({ feed: FEED });
  r.api.setWatch(WATCH); r.api.setTab('rgn');
  r.el('rView').value = 'all'; r.api.rgnDraw();
  assert.match(r.el('rgnTb').innerHTML, /경영평가위원 위촉/);
  assert.match(r.el('rgnChips').innerHTML, /📍 충북 <span class="n">2<\/span>/);
  r.api.rgnReg('충북');
  const h = r.el('rgnTb').innerHTML;
  assert.equal(rowsOf(h), 2); assert.match(h, /경영평가위원 위촉/); assert.match(h, /2027 충북/);
  r.api.rgnReg('');
  assert.equal(rowsOf(r.el('rgnTb').innerHTML), 5);
});

test('★★★ ★ 는 «원래 자리»에 — 공고는 상태 「관심」, 모집 글은 recruit_star · 공고 모아보기에도 같이 보인다', () => {
  const r = runApp({ feed: FEED });
  r.api.setWatch(WATCH); r.api.setTab('rgn');
  r.api.rgnDo('f:G0001', 'star');
  assert.equal(r.api.get('feed').find((x) => x.id === 'G0001').type, '관심');
  assert.match(r.el('tb').innerHTML, /<tr class="fr[^"]*\bstarred\b[^"]*" onclick="feedRowClick\(event,'G0001'\)"/, '공고 모아보기 목록도 같은 별');
  assert.match(rowFor(r.el('rgnTb').innerHTML, 'f:G0001'), /class="starbtn on"/);
  r.api.rgnDo('h:h1', 'star');
  assert.ok(Object.keys(r.api.recObj('recruit_star')).some((k) => /h1/.test(k)), '모집 글 별은 recruit_star 에');
  assert.match(rowFor(r.el('rgnTb').innerHTML, 'h:h1'), /class="starbtn on"/);
});

test('★★★ 고르기 — 고르면 「N건 선택」과 할 일, 일괄 숨기기는 건수를 묻고 한 번에(지우지 않는다), 「숨긴 공고」에서 되살린다', () => {
  const r = runApp({ feed: FEED });
  r.api.setWatch(WATCH); r.api.setTab('rgn');
  r.api.rgnTog('f:G0001', true); r.api.rgnTog('h:h1', true);
  const bar = r.el('rgnSel').innerHTML;
  assert.match(bar, /<b>2건<\/b> 선택/); assert.match(bar, /🚫 공고 숨기기 1/); assert.match(bar, /✓ 모집 글 봤음 1/);
  r.api.rgnBulk('hide');
  const f = r.api.get('feed');
  assert.equal(f.length, FEED.length, '지우지 않는다'); assert.equal(f.find((x) => x.id === 'G0001').hidden, true);
  assert.doesNotMatch(r.el('rgnTb').innerHTML, /천안시 노무관리/, '숨긴 것은 기본 보기에서 빠진다');
  assert.equal(Object.keys(r.api.getSel()).length, 0, '한 번 처리하면 고른 것을 비운다');
  r.el('rView').value = 'hidden'; r.api.rgnDraw();
  assert.match(r.el('rgnTb').innerHTML, /천안시 노무관리/);
  r.api.rgnTog('f:G0001', true); r.api.rgnBulk('unhide');
  assert.equal(r.api.get('feed').find((x) => x.id === 'G0001').hidden, false);
});

test('★★ 일괄 숨기기에서 «아니오»면 아무것도 안 바뀐다', () => {
  const r = runApp({ feed: FEED }, { confirm: false });
  r.api.setTab('rgn'); r.api.rgnTog('f:G0001', true); r.api.rgnBulk('hide');
  assert.equal(r.api.get('feed').find((x) => x.id === 'G0001').hidden, undefined);
});

test('★★ 모집 글 «봤음»은 recruit_seen 에 — 새 글 딱지가 사라진다 · 따옴표 든 열쇠도 data-sel 로 안전하게', () => {
  const r = runApp({ feed: [] });
  const w = JSON.parse(JSON.stringify(WATCH)); w.hits.h2.title = '대전 위원 모집';
  r.api.setWatch(w); r.api.setTab('rgn');
  const h = r.el('rgnTb').innerHTML;
  assert.match(h, /data-sel="h:h&#39;2"/, '열쇠는 onclick 글자가 아니라 data-sel 로');
  assert.doesNotMatch(h, /rgnDo\('h:h'2'/);
  assert.match(rowFor(h, 'h:h1'), /새 글/);
  r.api.rgnDo('h:h1', 'seen');
  assert.ok(r.api.recObj('recruit_seen').h1, '봤음 표시');
  const after = rowFor(r.el('rgnTb').innerHTML, 'h:h1');
  assert.ok(after, '봤음으로 적어도 목록에서 빠지지 않는다');
  assert.doesNotMatch(after, /새 글/);
});

test('★★ 화면을 떠나면 고른 것을 비운다 · 탭을 안 보고 있어도 숫자(새 것)는 탭에 뜬다', () => {
  const r = runApp({ feed: FEED });
  r.api.setWatch(WATCH); r.api.setTab('rgn'); r.api.rgnTog('f:G0001', true);
  r.api.setTab('feed');
  assert.equal(Object.keys(r.api.getSel()).length, 0);
  r.api.draw();
  assert.match(r.el('tbRgn').innerHTML, /📍 대전·충남·충북 <span class="tag red"[^>]*>3<\/span>/, '새 공고 1(G0001) + 안 본 모집 글 2(h1·h3) — 관심(G0005)은 새 것이 아니다');
});

test('★★★ 모집 글 팝업은 열자마자 opener 를 끊는다 — 바깥 누리집이 ERP 창을 다른 주소로 못 바꾼다(2026-11-16 보안 검토)', () => {
  const win = { opener: 'ERP 창', focus(){} };
  const r = runApp({ feed: [] }, { open: () => win });
  r.api.setWatch(WATCH);
  assert.equal(r.api.recOpenPost('h1'), false, '팝업이 열렸으면 링크로 또 열지 않는다');
  assert.equal(win.opener, null);
  r.api.setTab('rgn');
  assert.match(rowFor(r.el('rgnTb').innerHTML, 'h:h1'), /<a class="tlink" href="https:\/\/example\.com\/h1" target="_blank" rel="noopener"/,
    '팝업이 막히면 링크가 «새 탭»으로(이 ERP 창이 바깥으로 넘어가지 않게)');
});

test('★★ 태블릿(641px~)에서 제목 칸이 0 으로 접히지 않는다 — 표 최소 폭 ≥ 고정 칸 합 + 제목 자리(2026-11-16 검증 실측 768px)', () => {
  const page = src.slice(src.indexOf('<div class="wrap" id="pgRgn"'), src.indexOf('id="rgnTb"'));
  const fixed = [...page.matchAll(/<col style="width:(\d+)px">/g)].map((m) => Number(m[1]));
  assert.ok(fixed.length >= 8, '고정 칸을 못 찾았다 — 이 검사의 찾는 법을 고쳐야 한다');
  const css = src.slice(0, src.indexOf('</style>'));
  const m = css.match(/@media \(min-width:(\d+)px\)\{\s*#pgRgn \.rec-fixed\{min-width:(\d+)px\}\s*\}/);
  assert.ok(m, '태블릿 구간에 표 최소 폭 규칙이 없다');
  assert.ok(Number(m[1]) > 640, '폰(640 이하)은 카드라 최소 폭을 주면 옆으로 넘친다');
  const sum = fixed.reduce((a, b) => a + b, 0), TITLE_MIN = 150;
  assert.ok(Number(m[2]) >= sum + TITLE_MIN, '최소 폭 ' + m[2] + ' < 고정 칸 ' + sum + ' + 제목 ' + TITLE_MIN);
});

test('★ 키보드로도 — 공고 제목은 상세를 여는 링크(role=button), 줄 ☐ 와 검색칸에 읽는 이름', () => {
  const r = runApp({ feed: FEED });
  r.api.setTab('rgn');
  const row = rowFor(r.el('rgnTb').innerHTML, 'f:G0001');
  assert.match(row, /<a class="tlink" href="#" role="button" data-sel="f:G0001" onclick="rgnPop\(this\.dataset\.sel\);return false">천안시 노무관리/);
  assert.match(row, /<input type="checkbox" class="row-chk" aria-label="\d+번 고르기"/);
  assert.match(src, /<input id="rq"[^>]*aria-label="[^"]+"/);
});

/* ───────── 캡쳐2 정리 (같은 날 대표 「불필요한 부분이다 빼달라」) ───────── */
test('★★ 목록 위 받은 결과 줄은 남기지 않는다 — 진행 글·오류만 note 에, 받은 셈은 알림(toast)', () => {
  const fa = src.slice(src.indexOf('async function _fetchAll'), src.indexOf('/* ═══ 📅 발주 예정 — 나라장터 발주계획'));
  assert.doesNotMatch(fa, /note\('받은 공고/, '받은 결과를 목록 위(note)에 다시 쓰면 안 된다');
  assert.match(fa, /toast\('받은 공고 '/);
  assert.match(fa, /note\(errs\.length\?/, '못 받은 것은 목록 위에 남긴다');
});
