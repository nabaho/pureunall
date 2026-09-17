/* ══════ ☑ 골라서 «한 번에» 바꾸기 (대표 지시 2026-09-17) ═══════════════════════
   「여러 개인데 ㅁ표시하고 한번에 바꾸기 기능도 만들어 달라.
     우선 먼저 확인 후 한번에 모두 바꾸는게 좋다」

   ★ 「먼저 확인」이 이 일의 뜻이다 — 고르는 동안에는 «한 글자도» 안 바뀐다.
     체크가 곧 확인이고, 마지막에 한 번 묻고 그때 통째로 쓴다.

   ★ 못 박는 것
     ①⚠ **처음에 아무것도 안 골라져 있다.** 미리 켜 두면 「확인 후」가 아니라 「확인 전」이다.
     ② 고르는 동안 서버에 **한 글자도 안 쓴다.**
     ③⚠ **묻고 나서** 쓴다 — 몇 개·몇 곳인지, 무엇이 안 바뀌는지까지 말한다.
        「아니오」면 한 칸도 안 쓴다.
     ④⚠⚠ **한 통씩 모아 쓴다**(100줄). 한 줄씩 보내면 2026-08-16 대량 쓰기 사고가 다시 난다.
     ⑤⚠⚠ 쓰는 칸이 낱개 바꾸기(coTakeNewFor)와 **같다.** 하나라도 빠지면
        「한 번에 바꾼 것」과 「하나씩 바꾼 것」이 서로 다른 자국을 남긴다.
     ⑥ 고른 사이에 **사라진 줄**은 안 쓴다 — 남이 정리한 것을 되살리면 안 된다.
     ⑦ 한 회사에 어긋난 칸이 여럿이라 열쇠는 «회사|칸»이다.

   node --test tests/coinfo-clash-bulk.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

const c = (had, got, pid) => ({ had: had, got: got, photoId: pid || 'p1', photoYear: '2026' });
const CO = (key, name, cf, src) => ({ key, name, extra: { conflicts: cf, src: src || {} } });

function load(over) {
  const calls = { asked: 0, msg: '', wrote: [], toast: [], drew: 0 };
  const ctx = Object.assign({ console, Object, Array, String, Number, Math, Set, Date, Promise,
    esc: s => String(s == null ? '' : s),
    CO_FIELDS: [['ceo','대표자'], ['address','소재지'], ['sales','직전년도 매출액']],
    state: { coClashSel: {} },
    myEmail: 'a@b.c',
    DB_ROOT: 'pucards',
    coAttachDocKey: (y, i) => String(y) + '_' + String(i),
    coListBust: () => {},
    openCoClash: () => { calls.drew++; },
    toast: m => calls.toast.push(String(m)),
    confirm: m => { calls.asked++; calls.msg = String(m); return over && over.예스 !== false; },
    Store: { db: { ref: () => ({ update: u => { calls.wrote.push(u); return Promise.resolve(); } }) } },
    coList: () => (over && over.list) || [] }, (over && over.ctx) || {});
  vm.createContext(ctx);
  vm.runInContext([
    SRC.match(/^const CLASH_CHUNK = [^\n]*$/m)[0].replace('const ', 'var '),
    cutFn(SRC, 'function coClashList('), cutFn(SRC, 'function coClashId('),
    cutFn(SRC, 'function coClashPicked('), cutFn(SRC, 'function coClashToggle('),
    cutFn(SRC, 'function coClashPickGroup('), cutFn(SRC, 'function coClashClear('),
    cutFn(SRC, 'function coClashTakeWrites('),
    /* ⚠ async 는 cutFn 이 떼어 버린다 — 도로 붙인다 */
    'async ' + cutFn(SRC, 'function coClashTakeMany(')
  ].join('\n'), ctx);
  ctx._calls = calls;
  return ctx;
}
const 자료 = [
  CO('k1', '신성컨트롤', { ceo: c('조성환','조성환, 조규현'), address: c('충남 천안시','충청남도 천안시') }),
  CO('k3', '대천맛김', { sales: c('91 803928 017','91,803,928,017') })
];

/* ── ①② 고르는 동안에는 «한 글자도» 안 바뀐다 ────────────────────────── */

test('★★★ ① 처음에 «아무것도» 안 골라져 있다 — 미리 켜면 「확인 후」가 아니다', () => {
  const x = load({ list: 자료 });
  assert.equal(x.coClashPicked().length, 0,
    '★★★ 미리 골라 두면 대표님이 보시기 전에 「한 번에 바꾸기」가 눌릴 수 있다');
});

test('★★★ ② 고르는 동안 서버에 «한 글자도» 안 쓴다', () => {
  const x = load({ list: 자료 });
  x.coClashToggle('k1|ceo');
  x.coClashPickGroup('all');
  x.coClashClear();
  assert.deepEqual(x._calls.wrote, [],
    '★★★ 고르기만 했는데 값이 바뀌면 「먼저 확인」이 아무 뜻이 없다');
});

test('★★ 눌러서 켜고 «다시 눌러» 끈다', () => {
  const x = load({ list: 자료 });
  x.coClashToggle('k1|ceo');
  assert.equal(x.coClashPicked().length, 1);
  x.coClashToggle('k1|ceo');
  assert.equal(x.coClashPicked().length, 0, '★★ 풀 길이 없으면 잘못 고른 것을 못 되돌린다');
});

test('★★★ ⑦ 한 회사의 «칸마다» 따로 고른다 — 열쇠가 회사|칸이다', () => {
  const x = load({ list: 자료 });
  x.coClashToggle('k1|ceo');
  const got = Array.from(x.coClashPicked()).map(r => r.key + '|' + r.f);
  assert.deepEqual(got, ['k1|ceo'],
    '★★★ 회사 열쇠만 쓰면 같은 회사의 소재지까지 함께 골라진다');
});

test('★★ 묶음째 고르고, 다시 누르면 묶음째 푼다', () => {
  const x = load({ list: 자료 });
  x.coClashPickGroup('other');
  assert.equal(x.coClashPicked().length, 3);
  x.coClashPickGroup('other');
  assert.equal(x.coClashPicked().length, 0);
});

test('★★★ ⑥ 고른 사이에 «사라진» 줄은 안 센다 — 남이 정리한 것을 되살리면 안 된다', () => {
  const x = load({ list: 자료 });
  x.coClashPickGroup('all');
  assert.equal(x.coClashPicked().length, 3);
  /* 남이 대천맛김의 그 칸을 정리했다 */
  x.coList = () => [자료[0]];
  assert.equal(Array.from(x.coClashPicked()).map(r => r.key).indexOf('k3'), -1,
    '★★★ 이미 끝난 일을 되살려 쓰면 남이 고른 답이 지워진다');
});

/* ── ③ 묻고 나서 쓴다 ────────────────────────────────────────────────── */

test('★★★ ③ 「아니오」면 «한 칸도» 안 쓴다', async () => {
  const x = load({ list: 자료, 예스: false });
  x.coClashPickGroup('all');
  await x.coClashTakeMany();
  assert.equal(x._calls.asked, 1, '★★★ 묻지도 않고 여러 곳을 한꺼번에 바꾸면 안 된다');
  assert.deepEqual(x._calls.wrote, []);
});

test('★★★ 물을 때 «몇 개·몇 곳»과 무엇이 안 바뀌는지 말한다', async () => {
  const x = load({ list: 자료 });
  x.coClashPickGroup('all');
  await x.coClashTakeMany();
  const m = x._calls.msg;
  assert.match(m, /3개 칸\(2곳\)/, '★★ 몇 개를 바꾸는지 모르고 누르게 하면 안 된다');
  assert.match(m, /사진첩 원본과 명함/, '★★ 무엇이 «안» 바뀌는지도 말한다');
  assert.match(m, /고르지 «않은» 줄은 한 글자도 안 바뀝니다/);
  assert.match(m, /신성컨트롤 — 대표자/, '★★ 무엇을 바꾸는지 보기가 없으면 확인이 안 된다');
});

test('★ 고른 줄이 없으면 «묻지도» 않는다', async () => {
  const x = load({ list: 자료 });
  await x.coClashTakeMany();
  assert.equal(x._calls.asked, 0);
  assert.ok(x._calls.toast.some(t => /네모를 먼저/.test(t)),
    '★ 「안 된다」만 하면 무엇을 해야 할지 모른다');
});

/* ── ④⑤ 쓰는 모양 ───────────────────────────────────────────────────── */

test('★★★ ⑤ 낱개 바꾸기와 «같은 칸»을 쓴다 — 다르면 자국이 두 벌이 된다', () => {
  const x = load({ list: 자료 });
  const rows = [{ key:'k1', f:'ceo', c: c('조성환','조성환, 조규현') }];
  const u = x.coClashTakeWrites(rows, 1234, 'a@b.c', 100)[0];
  assert.equal(u['coInfo/k1/ceo'], '조성환, 조규현', '★★★ 값을 안 쓰면 아무 일도 안 한 것이다');
  assert.equal(u['coInfo/k1/conflicts/ceo'], null, '★★★ 어긋남 줄을 안 치우면 다 끝난 일을 또 묻는다');
  assert.equal(u['coInfo/k1/src/ceo'], '2026_p1', '★★ 어느 서류에서 왔는지 안 적으면 다시 읽을 때 또 어긋난다');
  assert.equal(u['coInfo/k1/at'], 1234);
  assert.equal(u['coInfo/k1/by'], 'a@b.c');
  /* 낱개 바꾸기가 쓰는 칸을 원본에서 떠 와 견준다 — 베껴 적으면 한쪽만 고쳐진다 */
  const one = stripJs(cutFn(SRC, 'function coTakeNewFor('));
  ['/conflicts/', '/src/', '/at', '/by'].forEach(function(k){
    assert.ok(one.indexOf(k) >= 0, '낱개 바꾸기가 ' + k + ' 를 안 씁니다 — 견줄 잣대가 바뀌었습니다');
  });
});

test('★ 사진이 없으면 «출처를 지어내지» 않는다', () => {
  const x = load({ list: 자료 });
  const u = x.coClashTakeWrites([{ key:'k1', f:'ceo', c:{ had:'가', got:'나' } }], 1, 'a', 100)[0];
  assert.equal(u['coInfo/k1/src/ceo'], undefined);
  assert.equal(u['coInfo/k1/ceo'], '나');
});

test('★★★ ④ 100줄씩 «한 통»으로 모아 쓴다 — 한 줄씩 보내면 2026-08-16 사고가 다시 난다', () => {
  const x = load({ list: 자료 });
  const many = [];
  for(let i = 0; i < 250; i++) many.push({ key:'k'+i, f:'ceo', c: c('가','나') });
  const ups = Array.from(x.coClashTakeWrites(many, 1, 'a', x.CLASH_CHUNK));
  assert.deepEqual(ups.map(u => Object.keys(u).length), [500, 500, 250],
    '★★ 줄마다 다섯 칸(값·어긋남·출처·때·누가)이라 100줄이면 500칸이다');
  assert.equal(x.CLASH_CHUNK, 100);
});

test('★★ 바꾼 뒤 «고르기를 푼다» — 안 풀면 다음에 또 같은 것이 골라져 있다', async () => {
  const x = load({ list: 자료 });
  x.coClashPickGroup('all');
  await x.coClashTakeMany();
  /* ⚠ vm 안에서 만든 것은 «원형이 다르다» — deepEqual({},{}) 이 「다르다」로 나온다.
     세어서 본다(2026-09-13에도 같은 자리를 밟았다). */
  assert.equal(Object.keys(x.state.coClashSel || {}).length, 0);
  assert.ok(x._calls.wrote.length, '★ 「예」인데 아무것도 안 썼다');
  assert.ok(x._calls.toast.some(t => /3개 칸\(2곳\)을 바꿨습니다/.test(t)),
    '★★ 몇 개를 바꿨는지 안 말하면 다 됐는지 알 수 없다');
});

/* ── 화면에 실제로 붙어 있나 ─────────────────────────────────────────── */

test('★★★ 줄마다 «네모»가 있다', () => {
  const row = cutFn(SRC, 'function coClashRowHtml(');
  assert.match(row, /type="checkbox" class="ck"/, '★★★ 고를 네모가 없으면 이 일이 통째로 없다');
  assert.match(row, /coClashToggle\('\$\{id\}'\)/);
  /* ⚠ 열쇠에 작은따옴표가 든 회사가 있다 — 이 저장소가 한 번 크게 겪은 자리다 */
  assert.match(row, /coClashId\(x\)\.replace\(\/'\/g,"\\\\'"\)/,
    '★★★ 따옴표가 든 열쇠에서 누르면 조용히 아무 일도 안 일어난다');
});

/* ⚠⚠ 창을 «실제로 그려» 본다. 글자만 찾으면 `${띠}` 를 통째로 빼도 통과한다 —
   띠를 만드는 글귀는 함수 안에 그대로 남아 있기 때문이다(2026-09-17 이빨 확인에서 샜다). */
function 그려보기(over){
  const x = load(over);
  vm.runInContext([
    cutFn(SRC, 'function coDiffParts('), cutFn(SRC, 'function coDiffTokens('),
    cutFn(SRC, 'function coDiffAlign('), cutFn(SRC, 'function coDiffMark('),
    cutFn(SRC, 'function coClashRowHtml('), cutFn(SRC, 'function coClashHtml(')
  ].join('\n'), x);
  x._closeBtn = () => '<x>';
  return x;
}

test('★★★ 고른 것이 있을 때 «맨 위에 붙는» 띠가 선다', () => {
  const x = 그려보기({ list: 자료 });
  assert.ok(x.coClashHtml().indexOf('coClashTakeMany()') < 0,
    '★ 아무것도 안 골랐는데 띠가 줄을 먹는다');
  x.coClashPickGroup('all');
  const h = x.coClashHtml();
  assert.ok(h.indexOf('coClashTakeMany()') > 0, '★★★ 한 번에 바꾸는 단추가 화면에 없다');
  assert.ok(h.indexOf('coClashClear()') > 0, '★★ 고르기를 푸는 길이 화면에 없다');
  assert.ok(h.indexOf('3개 고름') > 0, '★★ 몇 개를 골랐는지 안 보인다');
  assert.match(SRC, /\.coclashpick\{position:sticky;top:0/,
    '★★★ 스무 줄을 고르고 맨 아래까지 내려가 눌러야 하면 고르는 일이 벌이 된다');
});

test('★★ 묶음째 고르는 단추가 화면에 «실제로» 있다', () => {
  const x = 그려보기({ list: 자료.concat([
    Object.assign({}, 자료[0], { key:'k9', name:'다시읽음', extra:{
      conflicts:{ ceo: c('가','나','p9') }, src:{ ceo: '2026_p9' } } })]) });
  const h = x.coClashHtml();
  assert.ok(h.indexOf("coClashPickGroup('same')") > 0, '★★ 「다시 읽은 것」 묶음 고르기가 없다');
  assert.ok(h.indexOf("coClashPickGroup('other')") > 0, '★★ 「다른 서류」 묶음 고르기가 없다');
});

/* ══ ☑ 전체 한 번에 고르기 (대표 지시 2026-09-17) ══════════════════════════
   묶음이 둘이라 「전체」를 고르려면 묶음 단추를 «두 번» 눌러야 했다. */

test('★★★ 「전체 고르기」가 «늘» 서 있다 — 0개일 때 쓰라고 있는 단추다', () => {
  const x = 그려보기({ list: 자료 });
  const h = x.coClashHtml();
  assert.ok(h.indexOf("coClashPickGroup('all')") > 0,
    '★★★ 고른 것이 0개일 때 안 보이면, 정작 쓸 그때 없는 단추가 된다');
  assert.ok(h.indexOf('전체 3개 고르기') > 0, '★★ 몇 개를 고르게 되는지 안 적혀 있다');
  /* ⚠ 띠(고른 뒤에만 뜬다) 안에 넣으면 처음에 안 보인다 — 자리가 달라야 한다 */
  assert.ok(h.indexOf('coclashall') > 0, '★★ 띠와 같은 자리에 들어가면 처음에 안 보인다');
});

test('★★★ 한 번 눌러 «두 묶음을 통틀어» 다 골라진다', () => {
  const x = 그려보기({ list: 자료.concat([
    Object.assign({}, 자료[0], { key:'k9', name:'다시읽음', extra:{
      conflicts:{ ceo: c('가','나','p9') }, src:{ ceo: '2026_p9' } } })]) });
  const 전체 = x.coClashList().length;
  x.coClashPickGroup('all');
  assert.equal(x.coClashPicked().length, 전체,
    '★★★ 묶음이 둘인데 한쪽만 골라지면 「전체」가 아니다');
  assert.equal((x.coClashHtml().match(/checkbox[^>]*checked/g) || []).length, 전체,
    '★★ 표만 찼고 화면의 네모는 안 켜졌다');
});

test('★★★ 다 골라져 있으면 같은 자리가 «푸는» 단추가 된다', () => {
  const x = 그려보기({ list: 자료 });
  x.coClashPickGroup('all');
  const h = x.coClashHtml();
  assert.ok(h.indexOf('전체 고르기 풀기') > 0,
    '★★★ 스물여섯 개를 고른 뒤 무르려고 또 다른 단추를 찾아 헤매게 된다');
  assert.ok(h.indexOf('전체 3개 고르기') < 0, '★★ 다 골랐는데 아직 「고르기」라고 적혀 있다');
  x.coClashPickGroup('all');
  assert.equal(x.coClashPicked().length, 0, '★★★ 다시 눌러도 안 풀린다');
});

test('★★ 「전체 고르기」는 고르기만 한다 — 여기서도 한 글자도 안 바뀐다', () => {
  const x = 그려보기({ list: 자료 });
  x.coClashPickGroup('all');
  assert.equal(x._calls.wrote.length, 0,
    '★★★ 고르는 동안 서버에 쓰면 「우선 먼저 확인」이 아니다');
  assert.equal(x._calls.asked, 0, '★★ 묻지도 않았는데 물음창이 떴다');
});

test('★★★ 줄의 네모가 «골랐을 때만» 켜져 있다 — 화면과 표가 어긋나면 안 된다', () => {
  const x = 그려보기({ list: 자료 });
  assert.equal((x.coClashHtml().match(/checkbox[^>]*checked/g) || []).length, 0,
    '★★★ 처음부터 켜져 있으면 「먼저 확인」이 아니다');
  x.coClashToggle('k1|ceo');
  assert.equal((x.coClashHtml().match(/checkbox[^>]*checked/g) || []).length, 1,
    '★★ 골랐는데 네모가 안 켜지면 무엇을 골랐는지 알 수 없다');
});
