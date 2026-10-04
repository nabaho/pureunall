/* 취업규칙 ✏️ 조문 편집 — 「💡 우리 문안」 상자 (Task 2 · 2026-10-04 목업 「추천대로」). 이름은 가짜만.
   그림(DOM)이 아니라 «그린 글»을 본다 — 상자는 문자열 그리기(boxHtml)와 넣을 글 만들기(insertText)를 따로 낸다.
   ★ 못 박는 것은 규칙이다(값·개수가 아니다):
     ① 상태마다 한 줄 — 읽는 중(몇 개 중 몇 개) · 못 읽음(편집은 그대로) · 제목 없음 · 다른 문안 없음
     ② 덩어리마다 갈래 딱지(셋이 서로 다른 모양) · 흐린 한 줄은 넘치면 … 이고 title 에 전문
     ③ 초록(<ins>)은 «지금 글에 없는 곳»만 — 지금 글에만 있는 것은 아예 안 보인다
     ④ 회사 이름은 글자로만(꺾쇠가 태그가 되면 안 된다)
     ⑤ 위반 의심이 있는 덩어리에만 ⚠ 한 줄 · 「쓴 회사」를 펼치면 회사 줄(미확정은 「(미확정)」)
     ⑥ 넣기 — 머리(제N조…)는 지금 「변경 후」의 것을 지키고, {회사}·{근로자}는 화면의 채우개로 채운다
     ⑦ rules.html — 부품은 캐시 번호를 달고 «한 번만», 📚 와 같은 판, 실을 차례
     ⑧ 처음 한 번만 읽는다 · 그새 다른 조를 열면 «지금 연 조»를 그린다 · 어떤 실패도 한 줄로 끝난다
     ⑨ 넣기는 «열람 전용»을 먼저 본다 · 이 상자는 서버에 아무것도 쓰지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const RV = require('../js/rules-v2/view-recommend.js');
const R = require('../js/rules-v2/lib-recommend.js');
const T = require('../js/rules-v2/lib-topics.js');
const V = require('../js/rules-v2/view-topics.js');
const S = require('../js/rules-v2/lib-sites.js');
const O = require('../js/rules-v2/lib-order.js');
const TC = require('../js/rules-v2/text-cache.js');
const CR = require('../js/pu-rules-criteria.js');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8');
const BARE = stripComments(HTML);

/* 화면의 조사 채우개를 «그대로» 떼어 돌린다 — 베껴 오면 화면이 바뀌어도 검사는 옛것을 본다 */
const FILL = (() => {
  const a = HTML.indexOf('const JOSA=');
  const b = HTML.indexOf('\n', HTML.indexOf('const fillTpl=', a));
  assert.ok(a > 0 && b > a, '조사 채우개(JOSA…fillTpl)를 찾지 못했습니다');
  return new Function(HTML.slice(a, b) + '\nreturn { fillTpl, fillWord, hasBatchim };')();
})();

/* ── 모은 자료 한 벌 ── */
const CO_BAD = '<b>가나</b>상사';
const COS = [
  { id: 'co1', name: CO_BAD, employmentInsuredCount: 40, bizType: '도소매업' },
  { id: 'co2', name: '나다물산', employmentInsuredCount: 50, bizType: '도소매업' },
  { id: 'co4', name: '라마전자', employmentInsuredCount: 3, bizType: '건설업' },
  { id: 'co6', name: '마바식품', employmentInsuredCount: 12, bizType: '제조업' },
  { id: 'co9', name: '하나상사', bizNo: '123-45-67890', employmentInsuredCount: 20, bizType: '제조업' },   // 지금 회사
];
const DAY = 864e5, T0 = Date.UTC(2026, 6, 1);
const D = (id, d) => ({ id, kind: '규칙본문', status: '담김', dir: '받음', name: id + '.hwp', createdAt: d,
  mail: { src: 'imap', box: 'INBOX', key: id, date: T0 + d * DAY } });
const linked = (co) => ({ companyId: co, companyLinkStatus: 'linked' });
function body(co, 호칭, days) {
  return [
    `제1조(목적) 이 규칙은 ${co} ${호칭}의 근로조건을 정한다.`,
    `제20조(연차유급휴가) ① 1년간 80퍼센트 이상 출근한 ${호칭}에게 ${days}일의 유급휴가를 준다.`,
  ].join('\n');
}
const DATA = {
  docs: { d1: D('d1', 1), d2: D('d2', 2), d3: D('d3', 3), d4: D('d4', 40), d6: D('d6', 20) },
  human: { d1: linked('co1'), d2: linked('co2'), d4: linked('co4'), d6: linked('co6') },
  rounds: { co1_r202607: { finalDocId: 'd1' } },
};
const TEXTS = {
  d1: body(CO_BAD, '사원', 15),
  d2: body('나다물산', '근로자', 15),
  d3: body('다라기계', '직원', 15),     // 사업장 미확정
  d4: body('라마전자', '사원', 12),
  d6: body('마바식품', '사원', 13),
};
const STD = '제1조(목적) 목적.\n제2장 휴가\n제20조(연차유급휴가) 15일.';
const K = '연차유급휴가';
const CUR = '① 1년간 80퍼센트 이상 출근한 사원에게 14일의 유급휴가를 준다.';   // 지금 글 — 어느 덩어리와도 다르다
const M = () => V.model(DATA, TEXTS, COS, STD, '2026-10-04', CR);
const CTX = (m) => ({ curBody: CUR, curCoName: '하나상사', companyId: 'co9', band: S.band(20), bizType: '제조업',
  coById: Object.fromEntries(COS.map((c) => [c.id, c])), _m: m });
function readySt(extra) {
  const m = M(), picks = R.pick(m.byTopic[K], CTX(m));
  return Object.assign({ state: 'ready', picks, curBody: CUR, curCoName: '하나상사', warns: {}, open: {},
    docs: m.docs, places: m.topics.filter((t) => t.key === K)[0].count, band: S.band(20), bizType: '제조업',
    terms: { 회사: '하나상사', 근로자: '사원' }, fill: FILL.fillTpl }, extra || {});
}
/* 덩어리 카드로 쪼갠다 — 차례는 picks 차례 */
const cards = (h) => h.split('data-rec-card').slice(1);
const bodyOf = (card) => (card.match(/<div class="rec-ob">([\s\S]*?)<\/div>/) || [])[1] || '';
const ONE_LINE = ['rec-meta', 'rec-warn', 'rec-who-r', 'rec-hm', 'rec-foot'];

test('① 상태마다 한 줄 — 읽는 중·못 읽음·제목 없음·다른 문안 없음', () => {
  const ld = RV.boxHtml({ state: 'loading', done: 3, total: 10 });
  assert.match(ld, /💡 우리 문안/);
  assert.match(ld, /모은 자료 읽는 중 3\/10/);
  // 몇 개인지 모를 때는 숫자를 지어내지 않는다
  assert.doesNotMatch(RV.boxHtml({ state: 'loading', done: 0, total: 0 }), /0\/0/);
  const er = RV.boxHtml({ state: 'error', err: '<i>막힘</i>' });
  assert.match(er, /우리 문안을 못 읽었습니다 — /);
  assert.doesNotMatch(er, /<i>막힘/, '오류 글도 글자로만');
  assert.match(RV.boxHtml({ state: 'notitle' }), /이 조는 제목이 없어 주제로 찾을 수 없습니다/);
  assert.match(RV.boxHtml(readySt({ picks: [] })), /이 주제로 모은 다른 문안이 없습니다/);
  assert.equal(cards(RV.boxHtml({ state: 'error', err: 'x' })).length, 0);
});

test('② 갈래 딱지 — 고른 갈래마다 하나, 셋이 서로 다른 모양 · 머리 줄에 자료 수·주제 곳 수', () => {
  const st = readySt(), h = RV.boxHtml(st);
  assert.ok(st.picks.length >= 3, '이 자료에서는 세 갈래가 다 나와야 한다: ' + st.picks.map((p) => p.why));
  const cs = cards(h);
  assert.equal(cs.length, st.picks.length);
  const cls = new Set();
  st.picks.forEach((p, i) => {
    const tag = cs[i].match(/<span class="(rec-tag[^"]*)"[^>]*>([^<]*)<\/span>/);
    assert.ok(tag, '딱지가 없다: ' + p.why);
    assert.equal(tag[2], R.LABELS[p.why]);
    cls.add(tag[1]);
  });
  assert.equal(cls.size, st.picks.length, '갈래 딱지는 서로 다른 모양(색)이어야 한다');
  assert.match(h, new RegExp('모은 자료 규칙 본문 ' + st.docs + '건 · 이 주제 ' + st.places + '곳'));
  // 넣기 단추·쓴 회사 단추가 덩어리 열쇠를 단다
  st.picks.forEach((p, i) => {
    assert.match(cs[i], /data-rec="put"/);
    assert.match(cs[i], new RegExp('쓴 회사 ' + p.group.places + '곳'));
  });
});

test('② 흐린 한 줄 — 갈래마다 맞는 말, 넘치면 … 이고 title 에 전문', () => {
  const st = readySt(), cs = cards(RV.boxHtml(st));
  st.picks.forEach((p, i) => {
    const meta = cs[i].match(/<span class="rec-meta" title="([^"]*)">([^<]*)<\/span>/);
    assert.ok(meta, '흐린 한 줄이 없거나 title 이 없다: ' + p.why);
    assert.equal(meta[1], meta[2], 'title 에 보이는 글 전문');
    if (p.why === 'recent') {
      assert.match(meta[2], /★최종본/, '★최종본이면 ★ 를 단다');
      assert.match(meta[2], /\d{4}-\d{2}$/);
    }
    if (p.why === 'similar') {
      assert.ok(meta[2].startsWith(st.band + ' · ' + st.bizType + ' ' + p.similar.length + '곳'), meta[2]);
      assert.ok(meta[2].includes(p.similar[0].companyName), '첫 회사 이름');
    }
    if (p.why === 'most') assert.match(meta[2], new RegExp('^' + p.group.places + '곳 · .*최근 \\d{4}-\\d{2}$'));
  });
  // ★ 아닌 덩어리의 «가장 최근» 은 ★ 를 빼고
  const m = M(), g = m.byTopic[K].filter((x) => !x.finals)[0];
  const h = RV.boxHtml(readySt({ picks: [{ why: 'recent', group: g, rep: g.members[0] }] }));
  assert.doesNotMatch(h.match(/<span class="rec-meta"[^>]*>([^<]*)</)[1], /★/);
});

test('③ 초록은 «지금 글에 없는 곳»만 — 지금 글에만 있는 것은 안 보인다', () => {
  const st = readySt(), cs = cards(RV.boxHtml(st));
  st.picks.forEach((p, i) => {
    const b = bodyOf(cs[i]);
    const days = (p.group.text.match(/(\d+)일의/) || [])[1];
    assert.ok(days && days !== '14');
    assert.match(b, new RegExp('<ins>[^<]*' + days + '[^<]*</ins>'), '덩어리에만 있는 숫자는 초록');
    assert.doesNotMatch(b, /14/, '지금 글에만 있는 숫자는 보이지 않는다');
    assert.doesNotMatch(b, /<del>/);
    (b.match(/<ins>([^<]*)<\/ins>/g) || []).forEach((x) => assert.doesNotMatch(x, /출근한/, '같은 곳을 초록으로 칠했다'));
    assert.match(b, /출근한/, '같은 곳은 그대로 보인다');
  });
  // 지금 글에 회사 이름이 들어 있어도 {회사} 자리표시와 같은 곳으로 본다
  const g = { key: 'k', text: '{회사}는 15일을 준다.', members: [{ companyId: 'co2', companyName: '나다물산', date: T0 }], places: 1, finals: 0, last: T0 };
  const h = RV.boxHtml(readySt({ curBody: '하나상사는 14일을 준다.', picks: [{ why: 'most', group: g, rep: g.members[0] }] }));
  assert.doesNotMatch(bodyOf(cards(h)[0]), /<ins>[^<]*회사/);
});

test('③ 몸은 «넣을 글» 그대로 — 자리표시를 채워 보이고, 초록은 여전히 새 곳만 · 조사도 맞게', () => {
  const st = readySt(), h = RV.boxHtml(st);
  assert.doesNotMatch(h, /\{근로자\}|\{회사\}/, '채울 말이 있는데 자리표시가 보인다');
  cards(h).forEach((c) => {
    const b = bodyOf(c);
    assert.match(b, /출근한 사원에게/, '호칭이 이 회사 것으로 채워져야 한다');
    (b.match(/<ins>([^<]*)<\/ins>/g) || []).forEach((x) => assert.doesNotMatch(x, /사원|출근한/, '같은 곳을 초록으로 칠했다'));
  });
  // 조사 — 자리표시 바로 뒤 조사가 받침에 맞는다(지금 글과 같은 곳이든, 새 곳이든)
  const g = (text) => ({ key: text, text, members: [{ companyId: 'co2', companyName: '나다물산', date: T0 }], places: 1, finals: 0, last: T0 });
  const one = (cur, text) => bodyOf(cards(RV.boxHtml(readySt({ curBody: cur, picks: [{ why: 'most', group: g(text), rep: g(text).members[0] }] })))[0]);
  const same = one('사원이 청구하면 14일을 준다.', '{근로자}가 청구하면 15일을 준다.');
  assert.match(same, /^사원이 청구하면 <ins>15<\/ins>일을 준다\.$/);
  const fresh = one('회사가 쉰다.', '{근로자}가 쉰다.');
  assert.match(fresh, /<ins>사원이<\/ins>/);
  assert.doesNotMatch(fresh, /사원가/);
  const co = one('하나상사는 14일을 준다.', '{회사}는 15일을 준다.');
  assert.match(co, /^하나상사는 <ins>15<\/ins>일을 준다\.$/, '{회사}는 이 회사 이름으로, 같은 곳은 그대로');
});

test('④ 회사 이름은 글자로만 · ⑤ 펼친 회사 줄', () => {
  const st = readySt(), rec = st.picks.findIndex((p) => p.why === 'recent');
  assert.ok(rec >= 0);
  const key = st.picks[rec].group.key;
  const closed = cards(RV.boxHtml(st))[rec];
  assert.doesNotMatch(closed, /<b>가나/, '이름의 꺾쇠가 태그가 됐다');
  assert.match(closed, /&lt;b&gt;가나&lt;\/b&gt;상사/);
  assert.doesNotMatch(closed, /\(미확정\)/, '닫혀 있으면 회사 줄이 없다');
  const open = cards(RV.boxHtml(Object.assign(st, { open: { [key]: true } })))[rec];
  assert.match(open, /\(미확정\)/, '사업장 미확정 문서는 이름을 지어내지 않는다');
  assert.match(open, /나다물산/);
  assert.match(open, /★/);
  assert.doesNotMatch(open, /<b>가나/);
  // 다른 덩어리는 닫힌 그대로
  cards(RV.boxHtml(st)).forEach((c, i) => { if (i !== rec) assert.doesNotMatch(c, /rec-who-r/); });
});

test('⑤ ⚠ 줄 — 위반 의심이 있는 덩어리에만, 첫 기준 이름', () => {
  const st = readySt(), k0 = st.picks[0].group.key;
  st.warns = { [k0]: [{ rule: { id: 'R9', name: '연차 <일수>', law: '근로기준법' }, note: '15일 미만' },
    { rule: { id: 'R10', name: '둘째 기준', law: '근로기준법' }, note: '' }] };
  const cs = cards(RV.boxHtml(st));
  assert.match(cs[0], /⚠[^<]*연차 &lt;일수&gt;/);
  cs.slice(1).forEach((c) => assert.doesNotMatch(c, /⚠/));
  // 끝의 흐린 한 줄 — 넣을 때 무엇으로 바뀌는지
  const h = RV.boxHtml(st);
  assert.match(h, /초록 = 지금 글에 없는 곳\./);
  assert.match(h.match(/class="rec-foot"[^>]*>([^<]*)</)[1], /하나상사·사원/, '무엇으로 채워 보이는지');
  // 채우개가 없으면(자리표시 그대로 보일 때) 넣을 때 바뀐다고 알린다
  assert.match(RV.boxHtml(Object.assign(st, { fill: undefined })),
    /넣을 때 \{회사\}·\{근로자\}는 이 회사 이름·호칭\(사원\)으로 바뀝니다\./);
});

test('② 한 줄 칸은 모두 title 을 달고, 화면 CSS 가 넘침을 … 로 자른다', () => {
  const st = readySt();
  st.warns = { [st.picks[0].group.key]: [{ rule: { id: 'R9', name: '연차', law: '법' } }] };
  st.open = { [st.picks[0].group.key]: true };
  const h = RV.boxHtml(st);
  ONE_LINE.forEach((c) => {
    const tags = h.match(new RegExp('<[^>]*class="' + c + '"[^>]*>', 'g')) || [];
    assert.ok(tags.length, '그린 글에 없다: ' + c);
    tags.forEach((t) => assert.match(t, /title="[^"]+"/, c + ' 에 title 이 없다'));
  });
  const css = (BARE.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  ONE_LINE.forEach((c) => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => new RegExp('\\.' + c + '(?![\\w-])').test(m[1])).map((m) => m[2]).join(';');
    assert.match(rules, /white-space:\s*nowrap/, c + ' 이 두 줄이 된다');
    assert.match(rules, /text-overflow:\s*ellipsis/, c + ' 가 넘침을 … 로 안 자른다');
  });
});

test('⑥ 넣기 — 머리는 지금 「변경 후」의 것, 본문은 덩어리 글을 채워서', () => {
  const fill = FILL.fillTpl, terms = { 회사: '하나상사', 근로자: '사원' };
  const grp = '① {회사}는 {근로자}가 청구하면 {근로자}에게 15일을 준다.';
  assert.equal(RV.insertText('제5조의2(연차유급휴가) 옛 글', grp, terms, fill),
    '제5조의2(연차유급휴가) ① 하나상사는 사원이 청구하면 사원에게 15일을 준다.');
  assert.equal(RV.insertText('제20조(연차) ① 옛 글', grp, { 회사: '가나상사', 근로자: '근로자' }, fill),
    '제20조(연차) ① 가나상사는 근로자가 청구하면 근로자에게 15일을 준다.', '받침 없는 호칭은 가·는');
  // 머리가 없으면 본문만
  assert.equal(RV.insertText('머리 없는 글', grp, terms, fill), '① 하나상사는 사원이 청구하면 사원에게 15일을 준다.');
  assert.equal(RV.insertText('', grp, terms, fill), '① 하나상사는 사원이 청구하면 사원에게 15일을 준다.');
  // 덩어리 글에 머리가 붙어 와도 지금 머리 하나만 남는다
  assert.equal(RV.insertText('제3조(휴게시간) x', '제9조(휴게) 본문.', terms, fill), '제3조(휴게시간) 본문.');
  // 채우개를 안 주면 자리표시 그대로(사람이 보고 바꾼다)
  assert.equal(RV.insertText('제3조(휴게) x', '{근로자}는 쉰다.', terms), '제3조(휴게) {근로자}는 쉰다.');
});

test('⑥ 넣기의 머리 정규식은 문안 은행(bankUse)과 같은 것 — 두 벌이면 함께 고친다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'rules-v2', 'view-recommend.js'), 'utf8');
  const bank = BARE.slice(BARE.indexOf('function bankUse'), BARE.indexOf('function bankUse') + 800);
  const headRe = (bank.match(/cur\.match\((\/\^\(제[^\n]*?\/)\)/) || [])[1];
  assert.ok(headRe, 'bankUse 의 머리 정규식을 못 찾았다');
  assert.ok(src.includes(headRe), '넣기의 머리 정규식이 문안 은행과 다르다: ' + headRe);
});

/* ── rules.html 잇기 ── */
const PARTS = ['lib-order', 'lib-topics', 'lib-sites', 'store', 'text-cache', 'view-topics', 'lib-recommend', 'view-recommend'];
test('⑦ 부품은 캐시 번호를 달고 한 번만 · 📚 와 같은 판 · lib-order 가 먼저', () => {
  const v2 = stripComments(fs.readFileSync(path.join(ROOT, 'rules-v2.html'), 'utf8'));
  const at = {};
  PARTS.forEach((p) => {
    const re = new RegExp('<script src="js/rules-v2/' + p + '\\.js\\?v=(\\d+)"></script>', 'g');
    const hits = [...BARE.matchAll(re)];
    assert.equal(hits.length, 1, p + '.js 는 캐시 번호를 달고 한 번만 싣는다');
    at[p] = hits[0].index;
    const there = v2.match(new RegExp('js/rules-v2/' + p + '\\.js\\?v=(\\d+)'));
    if (there) assert.equal(hits[0][1], there[1], p + '.js 의 캐시 번호가 📚(rules-v2.html)와 다르다');
    assert.equal((BARE.match(new RegExp('js/rules-v2/' + p + '\\.js[?"]', 'g')) || []).length, 1, p + '.js 를 두 번 싣는다');
  });
  assert.ok(at['lib-order'] < at['lib-sites'], 'lib-sites 는 실을 때 lib-order 를 찾는다');
  assert.ok(at['lib-order'] < at['view-topics']);
});

/* 화면의 «우리 문안» 토막 — REC 부터 클릭 손잡이까지 */
function recSection() {
  const a = BARE.indexOf('const REC=');
  assert.ok(a > 0, 'REC 토막이 없다');
  const b = BARE.indexOf('\n}', BARE.indexOf('function recClick', a));
  assert.ok(b > a, 'recClick 이 없다');
  return BARE.slice(a, b + 2);
}
function cutFn(src, name) {
  const a = src.indexOf('function ' + name + '(');
  assert.ok(a >= 0, name + ' 이 없다');
  let i = src.indexOf('{', a), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(a, i + 1);
}

test('⑦ 조를 열면 상자를 그린다 · 클릭 손잡이가 달렸다', () => {
  assert.match(cutFn(BARE, 'openArtEdit'), /recRender\(\s*a\s*\)/);
  assert.match(BARE, /\$\(\s*["']ae-rec["']\s*\)\.addEventListener\(\s*["']click["']\s*,\s*recClick\s*\)/);
  // 상자는 편집 카드의 단추 줄 «아래»
  const card = BARE.slice(BARE.indexOf('id="art-edit"'), BARE.indexOf('id="fs-bar"'));
  assert.ok(card.indexOf('id="ae-rec"') > card.indexOf('class="ae-btns"'), '#ae-rec 는 .ae-btns 아래');
});

test('⑨ 넣기는 «열람 전용»을 먼저 본다 · 상자는 서버에 아무것도 쓰지 않는다', () => {
  const click = cutFn(BARE, 'recClick');
  const ro = click.indexOf('READONLY'), ins = click.indexOf('insertText');
  assert.ok(ro > 0 && ins > 0 && ro < ins, '넣기 전에 READONLY 를 봐야 한다');
  const sec = recSection();
  assert.doesNotMatch(sec, /\.(set|update|transaction|push|remove)\(/, '우리 문안 토막이 서버에 쓴다');
  const view = stripComments('<script>' + fs.readFileSync(path.join(ROOT, 'js', 'rules-v2', 'view-recommend.js'), 'utf8') + '</script>');
  assert.doesNotMatch(view, /\.(set|update|transaction|push|remove)\(|\.ref\(/);
});

/* ── 토막을 «진짜로» 돌려 본다 ── */
function harness(o) {
  o = o || {};
  const els = {};
  const $ = (id) => els[id] || (els[id] = { id, innerHTML: '', value: '', textContent: '', style: {}, focused: 0,
    focus() { this.focused++; }, addEventListener() {} });
  $('size').value = '10인이상';
  const calls = { make: 0, load: 0, texts: 0, alerts: [], erp: 0 };
  const store = { make(cfg) {
    calls.make++; calls.cfg = cfg;
    return {
      load() { calls.load++; return o.load ? o.load(calls.load) : Promise.resolve(DATA); },
      texts(docs, cache, on) { calls.texts++; on(1, Object.keys(docs).length); return Promise.resolve({ texts: TEXTS, failed: [] }); },
    };
  } };
  const ctx = {
    $, console: { warn() {}, info() {}, log() {} }, Promise, Date, Object, Array, String, Number, Set, Map, JSON, Math, RegExp, Error,
    FBDB: o.noDb ? null : {}, ERP_COS: o.cos || COS, SITE_INFO: { name: '하나상사', bizNo: '123-45-67890', bizType: '제조업', empTotal: 20 },
    LAST: { site: '하나상사' }, SITE_MAP: {}, siteSel: { value: 'A' }, SAMPLES: { A: '사원 사원 사원 근로자' },
    CUR_ITEMS: [{ id: 'art_제20조', orig: '제20조(연차유급휴가) ' + CUR }, { id: 'art_제1조', orig: '제1조(목적) 이 규칙은 하나상사 사원의 복무를 정한다.' }],
    AE_LABEL: '제20조', READONLY: false,
    RE_HEAD_STRIP: /^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?\s*(?:[(（][^)）\n]{0,40}[)）]?)?\s*/,
    siteName: () => '하나상사',
    escapeH: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    detectTerms: () => ({ 회사: '회사', 근로자: '사원' }),
    fillTpl: FILL.fillTpl,
    _digits: (s) => String(s || '').replace(/[^0-9]/g, ''),
    libWait: (ok) => Promise.resolve(!!ok()), loadErpCompanies() { calls.erp++; },
    alert: (m) => calls.alerts.push(m),
    PuRulesV2Store: store, PuRulesV2TextCache: TC, PuRulesV2TopicsView: V, PuRulesV2Recommend: R, PuRulesV2Topics: T,
    PuRulesV2Sites: S, PuRulesV2Order: O, PuRulesV2RecommendView: RV, PuRulesCriteria: CR, STD_2026: { text: STD },
  };
  if (o.noView) delete ctx.PuRulesV2RecommendView;
  vm.createContext(ctx);
  ctx.window = ctx;
  vm.runInContext(recSection() + '\nthis.__t={REC:REC,recRender:recRender,recClick:recClick};', ctx);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return { ctx, calls, box: () => $('ae-rec').innerHTML, after: $('ae-after'), t: ctx.__t, settle: async () => { for (let i = 0; i < 8; i++) await tick(); } };
}
const ART = { label: '제20조', title: '연차유급휴가' };

test('⑧ 처음 한 번만 읽는다 — 다시 열어도 모델을 다시 쓴다 · 쓰기 관문은 늘 거절', async () => {
  const H = harness();
  H.t.recRender(ART);
  assert.match(H.box(), /읽는 중/);
  await H.settle();
  assert.match(H.box(), /data-rec-card/);
  assert.match(H.box(), new RegExp(R.LABELS.recent));
  assert.doesNotMatch(H.box(), /\{근로자\}|\{회사\}/, '화면의 몸은 넣을 글 그대로(채운 글)여야 한다');
  assert.match(H.box(), /사원에게/);
  H.t.recRender(ART); await H.settle();
  H.ctx.AE_LABEL = '제1조'; H.t.recRender({ label: '제1조', title: '목적' }); await H.settle();
  assert.equal(H.calls.load, 1, '조를 열 때마다 자료를 다시 읽는다');
  assert.equal(H.calls.make, 1);
  await assert.rejects(Promise.resolve().then(() => H.calls.cfg.gateway.save()), /읽기 전용/);
});

test('⑧ 읽는 사이 다른 조를 열면 «지금 연 조»를 그린다', async () => {
  let open;
  const H = harness({ load: () => new Promise((r) => { open = () => r(DATA); }) });
  H.t.recRender(ART);
  H.ctx.AE_LABEL = '제1조'; H.t.recRender({ label: '제1조', title: '목적' });
  open(); await H.settle();
  assert.match(H.box(), /근로조건/, '지금 연 조(목적)의 문안이 아니다');
  assert.doesNotMatch(H.box(), /유급휴가/, '앞서 연 조의 문안이 남았다');
  assert.equal(H.calls.load, 1);
});

test('⑧ 실패는 한 줄 — 로그인 전 · 읽기 실패(다음에 다시) · 부품 없음 · 제목 없음', async () => {
  const H0 = harness({ noDb: true });
  assert.doesNotThrow(() => H0.t.recRender(ART)); await H0.settle();
  assert.match(H0.box(), /우리 문안을 못 읽었습니다 — 로그인 뒤에 보입니다/);

  const H = harness({ load: (n) => (n === 1 ? Promise.reject(new Error('권한 없음')) : Promise.resolve(DATA)) });
  H.t.recRender(ART); await H.settle();
  assert.match(H.box(), /우리 문안을 못 읽었습니다 — 권한 없음/);
  H.t.recRender(ART); await H.settle();
  assert.match(H.box(), /data-rec-card/, '한 번 실패했다고 다시 안 읽는다');

  const H2 = harness({ noView: true });
  assert.doesNotThrow(() => H2.t.recRender(ART)); await H2.settle();
  assert.match(H2.box(), /우리 문안을 못 읽었습니다/);
  assert.doesNotThrow(() => H2.t.recClick({ target: { closest: () => ({ dataset: { rec: 'put', i: '0' } }) } }));

  const H3 = harness();
  H3.t.recRender({ label: '제20조', title: '' }); await H3.settle();
  assert.match(H3.box(), /이 조는 제목이 없어 주제로 찾을 수 없습니다/);
  assert.equal(H3.calls.load, 0, '제목이 없으면 읽을 까닭이 없다');
});

test('⑨ 넣기 — 열람 전용이면 막고, 아니면 머리 지켜 채워 넣고 손을 그 칸에 · 「쓴 회사」 펼치기', async () => {
  const H = harness();
  H.t.recRender(ART); await H.settle();
  const p = H.t.REC.st.picks[0];
  const btn = (rec) => ({ target: { closest: () => ({ dataset: { rec, i: '0' } }) } });
  H.after.value = '제20조(연차유급휴가) 지금 고치던 글';
  H.ctx.READONLY = true;
  H.t.recClick(btn('put'));
  assert.equal(H.after.value, '제20조(연차유급휴가) 지금 고치던 글', '열람 전용인데 글을 바꿨다');
  assert.ok(H.calls.alerts.some((m) => /열람 전용/.test(m)));
  H.ctx.READONLY = false;
  H.t.recClick(btn('put'));
  assert.ok(H.after.value.startsWith('제20조(연차유급휴가) '), H.after.value);
  assert.doesNotMatch(H.after.value, /\{회사\}|\{근로자\}/, '자리표시가 남았다');
  assert.match(H.after.value, /사원에게/);
  assert.ok(H.after.focused > 0);
  assert.doesNotMatch(H.box(), /rec-who-r/);
  H.t.recClick(btn('who'));
  assert.match(H.box(), /rec-who-r/);
  H.t.recClick(btn('who'));
  assert.doesNotMatch(H.box(), /rec-who-r/);
});

test('⑧ 업체 목록이 늦게 오면 — 목록 없이 지은 모델에 머물지 않고, 온 뒤 한 번 더 짓는다(자료는 다시 안 받는다)', async () => {
  const H = harness({ cos: [] });
  H.t.recRender(ART); await H.settle();
  assert.equal(H.calls.erp, 1, '업체 목록이 비었으면 한 번 부른다');
  assert.match(H.box(), /\(지운 업체\)/, '목록 없이 지으면 이름을 모른다');
  H.ctx.ERP_COS = COS;   // 목록이 왔다
  H.t.recRender(ART); await H.settle();
  assert.match(H.box(), /&lt;b&gt;가나&lt;\/b&gt;상사/, '목록이 온 뒤에도 옛 모델(이름 없음)을 쓴다');
  assert.equal(H.calls.load, 1, '모델만 다시 짓고 자료는 다시 받지 않는다');
  assert.equal(H.calls.texts, 1);
});

test('⑧ 업체 목록을 읽는 중이면 두 번 읽지 않는다 — 로그인·🏢·💡 가 겹쳐 불러도 같은 약속', async () => {
  const a = BARE.indexOf('let ERP_COS_LOADING=');
  assert.ok(a > 0, '읽는 중 표시가 없다');
  const load = cutFn(BARE, 'loadErpCompanies'), end = BARE.indexOf(load) + load.length;
  assert.ok(end > a);
  const src = cutFn(BARE, 'erpCompaniesFrom') + '\n' + BARE.slice(a, end);
  let reads = 0, fail = false;
  const pend = [];
  const ctx = { console: { info() {}, warn() {} }, ERP_COS: [], LAST: null, matchErpSite() {}, Object, Array, Promise,
    FBDB: { ref() { return { once() { reads++; return new Promise((ok, no) => pend.push(() => (fail ? no(new Error('막힘')) : ok({ val: () => ({ v: { a: { id: 'co2', name: '나다물산' } } }) })))); } }; } } };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.__l=loadErpCompanies;', ctx);
  const p1 = ctx.__l(), p2 = ctx.__l();
  assert.equal(reads, 1, '읽는 중인데 또 읽는다');
  assert.equal(p1, p2);
  pend.shift()(); await p1;
  assert.equal(ctx.ERP_COS.length, 1);
  const p3 = ctx.__l();
  assert.equal(reads, 2, '다 읽은 뒤에는 다시 부를 수 있어야 한다');
  fail = true; pend.shift()();
  assert.equal((await p3).length, 1, '실패해도 던지지 않고 있는 목록을 돌려준다');
  ctx.__l();
  assert.equal(reads, 3, '실패한 뒤 읽는 중 표시가 남아 다시 못 읽는다');
});
