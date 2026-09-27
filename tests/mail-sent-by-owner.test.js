/* 📤 보낸 메일을 «사람마다» 갈라 본다 (대표 지시 2026-09-16 · 목업 승인 2026-09-18)
   「각자 사람마다 보낸것에 대해서 별도로 관리할 수 있을까?」 · 기준 ㉮ 담당자별

   ★ 왜 짐작일 수밖에 없나 — 보낸메일함은 다음메일의 «거울»이고 거기 보낸이는 우리
     주소 하나다. 글자만으로는 누가 눌렀는지 가를 길이 없다.
   ★ 실측 2026-09-16 (손에 든 보낸 메일 903통) — 받는 업체의 담당자로 399통(44%).

   지키는 것.
   ① 잣대가 «한 벌»이다 — 받은 메일과 같은 mbWhoWhy 를 받는이 주소에 쓴다
   ② 짐작을 «짐작이라고» 적는다 — 사람이 정한 것만 확실(hand)이다
   ③ 서명으로 짐작하지 «않는다»
   ④ 세는 곳과 «거르는 곳»이 같다 — 칩에 적힌 수만큼 나와야 한다
   ⑤ 셈을 담아 둔다 — 칩 누를 때마다 903통 × 업체 376곳이 새로 돌면 안 된다
   ⑥ 받은 칸에서는 «아무 일도 안 한다» */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'pu-cards.html'), 'utf8');
const bare = app.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 가나상사 담당은 홍길동, 다라물류 담당은 김철수 */
const CO = {
  '가나상사': { main:'홍길동', left:false },
  '다라물류': { main:'김철수', left:false },
  '사아무역': { main:'이영희', left:true }   /* 자문이 끝났다 — 담당자를 안 준다 */
};

function run(opt){
  const o = opt || {};
  const ctx = {
    Object, String, Number, Array, Date, RegExp, Math, console,
    state: { mbSentWho: o.pick === undefined ? '' : o.pick },
    _mbMsgs: o.msgs || {},
    _mbOwner: o.owner || {},
    _mbWhoMsg: o.msgWho || {},
    MB_SENT_NA: '*na',
    MB_SENT_GAP_MAX: 8,
    MB_PUB_DOM: ['naver.com','daum.net','hanmail.net','gmail.com','nate.com'],
    /* 지금 보고 있는 칸 */
    mbNow: () => (o.box === undefined ? 'SENT' : o.box),
    mbFolderBy: s => ({ SENT:{ path:'Sent', name:'Sent', kind:'sent' },
                        IN:{ path:'INBOX', name:'INBOX', kind:'inbox' },
                        DRAFT:{ path:'Drafts', name:'Drafts', kind:'drafts' } })[s] || null,
    mbWhoIndex: () => ({ byAddr: o.byAddr || {}, byDom: o.byDom || {} }),
    mbCoOf: e => (o.coOf || {})[e] || '',
    mbCoRec: nm => CO[nm] || null,
    mbRetired: w => !!(o.retired || {})[w],
    mbSuccOf: w => (o.succ || {})[w] || '',
    mbPerson: w => w,
    mbWhoKey: s => String(s||'').replace(/[.#$/\[\]]/g,'_'),
    mbDomOf: e => { const i = String(e).lastIndexOf('@'); return i<0 ? '' : String(e).slice(i+1); },
    esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
    renderMailPage(){ ctx._drew = (ctx._drew||0) + 1; },
    _memo: {}
  };
  ctx.mbMemoOf = () => ctx._memo;
  vm.createContext(ctx);
  ['mbWhoLive','mbWhoWhy','mbSentTo','mbSentBox','mbSentWho','mbSentTally',
   'mbSentWhoList','mbSentGapList','mbSentPick','mbSentWhoLineHtml','mbSentGapHtml']
    .forEach(n => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return ctx;
}
/* 보낸 메일 한 줄 — t 는 받는이 */
const S = (to, subj, read) => ({ u:1, e:'370-6@daum.net', t:to, s:subj||'', d:Date.now(), r:read===undefined?1:read });
const sent = (...rows) => { const b = {}; rows.forEach((r,i)=>b['k'+i] = r); return { SENT:b }; };
/* 상자에서 나온 것을 밖의 집으로 옮겨 담는다 — deepEqual 이 집을 잰다 */
const names = r => Array.prototype.map.call(r, x => x.name);

/* ══════ ① 잣대가 한 벌이다 ══════ */

test('★★★ 받은 메일과 «같은 잣대»를 받는이 주소에 쓴다 — 두 벌을 만들지 않았다', () => {
  /* mbWhoOfRow(받은 메일)와 mbSentWho(보낸 메일)가 모두 mbWhoWhy 를 부른다.
     ⚠ 잣대가 둘이면 같은 주소가 받은 칸과 보낸 칸에서 «다른 사람»에게 잡힌다. */
  const got = sliceFn(app, 'function mbWhoOfRow(');
  const put = sliceFn(app, 'function mbSentWho(');
  assert.match(got, /mbWhoWhy\(/, '받은 메일이 공용 잣대를 안 씁니다');
  assert.match(put, /mbWhoWhy\(/, '보낸 메일이 공용 잣대를 안 씁니다');
  /* 순서까지 베껴 두지 않았는지 — 보낸 쪽에 제 나름의 차례가 또 있으면 안 된다 */
  assert.doesNotMatch(put, /byAddr|byDom/, '보낸 쪽이 담당자 차례를 다시 셈합니다');
});

test('★★★ 받는이 업체의 담당자로 짚는다', () => {
  const c = run({ msgs: sent(S('hong1@ganasa.co.kr')), coOf: { 'hong1@ganasa.co.kr':'가나상사' } });
  const r = c.mbSentWho({ t:'hong1@ganasa.co.kr' });
  assert.equal(r.who, '홍길동', '업체 담당자로 안 짚습니다');
  assert.equal(r.why, 'co', '짐작인 것을 확실한 것으로 적었습니다');
});

test('★★★ 사람이 정한 주소는 «확실»이다 — 짐작과 가른다', () => {
  const c = run({ owner: { 'hong1@ganasa_co_kr':'박민수' }, coOf: { 'hong1@ganasa.co.kr':'가나상사' } });
  const r = c.mbSentWho({ t:'hong1@ganasa.co.kr' });
  assert.equal(r.who, '박민수', '사람이 정한 것보다 업체가 셉니다');
  assert.equal(r.why, 'hand', '사람이 정한 것을 짐작으로 적었습니다');
});

test('★★ 이 «한 통»에 박아 둔 것이 가장 세다 — 받은 메일과 같은 규칙', () => {
  const c = run({ msgWho: { 'SENT:k0':'이영희' }, coOf: { 'a@ganasa.co.kr':'가나상사' } });
  const r = c.mbSentWho({ t:'a@ganasa.co.kr', _key:'SENT:k0' });
  assert.equal(r.who, '이영희');
  assert.equal(r.why, 'hand');
});

test('★★ 자문이 끝난 업체는 담당자를 «안 준다»', () => {
  const c = run({ coOf: { 'x@sabiz.co.kr':'사아무역' } });
  assert.equal(c.mbSentWho({ t:'x@sabiz.co.kr' }).who, '', '끝난 업체의 담당자를 붙입니다');
});

test('★★ 퇴사한 담당자는 «이어받은 사람»에게 넘긴다', () => {
  const c = run({ coOf: { 'a@ganasa.co.kr':'가나상사' },
                  retired: { '홍길동':1 }, succ: { '홍길동':'박민수' } });
  assert.equal(c.mbSentWho({ t:'a@ganasa.co.kr' }).who, '박민수', '퇴사자 이름이 그대로 남습니다');
  const c2 = run({ coOf: { 'a@ganasa.co.kr':'가나상사' }, retired: { '홍길동':1 } });
  assert.equal(c2.mbSentWho({ t:'a@ganasa.co.kr' }).who, '', '이어받은 사람이 없는데 퇴사자를 붙입니다');
});

/* ══════ ② 받는이 주소 고르기 ══════ */

test('★★ 여럿에게 보낸 것은 «맨 앞 한 사람»으로 본다 — 한 통이 세 칸에 겹치면 안 된다', () => {
  const c = run({});
  assert.equal(c.mbSentTo({ t:'"홍 길동" <hong1@ganasa.co.kr>, kim@daramul.co.kr' }),
    'hong1@ganasa.co.kr', '받는이를 못 꺼냅니다');
});

test('받는 주소가 없거나 망가져도 안 터진다', () => {
  const c = run({});
  assert.equal(c.mbSentTo({ t:'' }), '');
  assert.equal(c.mbSentTo({}), '');
  assert.equal(c.mbSentTo({ t:'이름만 적혀 있음' }), '');
  assert.deepEqual(Object.assign({}, c.mbSentWho({ t:'' })), { who:'', why:'' });
  assert.deepEqual(Object.assign({}, c.mbSentWho(null)), { who:'', why:'' });
});

/* ══════ ③ 서명으로 짐작하지 않는다 ══════ */

test('★★★ 본문 미리보기(서명)로 «절대» 짐작하지 않는다', () => {
  /* 실측 2026-09-16 — 서명은 6%에만 걸리고, 걸린 것도 인용문 속 남의 서명일 수 있다.
     틀린 이름을 붙이는 것이 모르는 것보다 나쁘다. */
  const c = run({});
  const r = c.mbSentWho({ t:'nobody@zzz.kr', s:'홍길동 드림', p:'노무법인 푸른 홍길동 드림' });
  assert.equal(r.who, '', '제목·본문에 적힌 이름으로 짚었습니다');
  const fn = sliceFn(app, 'function mbSentWho(');
  assert.doesNotMatch(fn, /\.p\b|\.s\b/, '보낸이 판정이 본문·제목을 봅니다');
});

/* ══════ ④ 세는 곳과 거르는 곳이 같다 ══════ */

test('★★★ 칩에 적힌 수만큼 나온다 — 세는 잣대와 거르는 잣대가 같다', () => {
  /* 2026-09-18 에 「안읽음 8」을 눌러도 아무 일이 없던 것이 바로 이 어긋남이었다 */
  const msgs = sent(S('a@ganasa.co.kr'), S('b@ganasa.co.kr'), S('c@daramul.co.kr'), S('d@zzz.kr'));
  const coOf = { 'a@ganasa.co.kr':'가나상사', 'b@ganasa.co.kr':'가나상사', 'c@daramul.co.kr':'다라물류' };
  const c = run({ msgs, coOf });
  const list = names(c.mbSentWhoList());
  assert.deepEqual(list, ['홍길동','김철수'], '칩 줄이 통수 많은 순이 아닙니다: ' + list.join(','));
  const t = c.mbSentTally();
  assert.equal(t.cnt['홍길동'], 2);
  assert.equal(t.cnt['김철수'], 1);
  assert.equal(t.none, 1, '못 짚은 것을 「모름」으로 안 셉니다');
  assert.equal(t.n, 4);
  /* 거르개가 그 수와 «같은 잣대»를 쓰는가 — mbMatchedRows 한 자리에서 건다 */
  const mr = sliceFn(app, 'function mbMatchedRows(');
  assert.match(mr, /mbSentWho\(/, '목록을 딴 잣대로 거릅니다');
  assert.match(mr, /mbSentBox\(\)/, '받은 칸에서도 거릅니다');
  assert.match(mr, /state\.mbSentWho/, '고른 사람을 안 봅니다');
});

test('★★ 「모름」 칩은 «못 짚은 것»을 고른다 — 사람 이름과 안 겹치는 열쇠다', () => {
  const mr = sliceFn(app, 'function mbMatchedRows(');
  assert.match(mr, /MB_SENT_NA/, '「모름」을 글자로 박아 두었습니다');
  assert.match(bare, /const MB_SENT_NA = '\*/, '사람 이름과 겹칠 수 있는 열쇠입니다');
});

test('★★ 고른 사람이 셈의 «열쇠»에 들어간다 — 안 넣으면 눌러도 옛 목록이 나온다', () => {
  const mr = sliceFn(app, 'function mbMatchedRows(');
  const iTag = mr.indexOf('matchedTag = tag');
  assert.ok(iTag > 0, '셈 열쇠를 못 찾았습니다');
  assert.match(mr.slice(0, iTag), /state\.mbSentWho/, '고른 사람이 셈 열쇠에 없습니다');
  /* 거르는 자리는 그 «뒤»에 있어야 한다 — 앞에서 걸면 담아 둔 것이 딴 사람 것이 된다 */
  assert.ok(mr.lastIndexOf('state.mbSentWho') > iTag, '거르개가 셈 열쇠보다 앞섭니다');
});

/* ══════ ⑤ 셈을 담아 둔다 ══════ */

test('★★★ 셈을 담아 둔다 — 칩 누를 때마다 다시 돌면 안 된다', () => {
  const msgs = sent(S('a@ganasa.co.kr'), S('b@ganasa.co.kr'));
  const c = run({ msgs, coOf: { 'a@ganasa.co.kr':'가나상사', 'b@ganasa.co.kr':'가나상사' } });
  const t1 = c.mbSentTally();
  const t2 = c.mbSentTally();
  assert.equal(t1, t2, '셈을 다시 돌립니다 — 903통 × 업체 376곳입니다');
});

test('★★★ 칸이 바뀌면 «다시» 센다 — 담아 둔 것이 딴 칸 수를 보여 주면 안 된다', () => {
  const ctx = run({ msgs: { SENT:{ k0:S('a@ganasa.co.kr') }, IN:{ k0:S('x@zzz.kr') } },
                    coOf: { 'a@ganasa.co.kr':'가나상사' } });
  const t1 = ctx.mbSentTally();
  assert.equal(t1.n, 1);
  ctx.mbNow = () => 'IN';
  const t2 = ctx.mbSentTally();
  assert.notEqual(t1, t2, '칸을 옮겼는데 옛 셈을 그대로 씁니다');
});

/* ══════ ⑥ 받은 칸에서는 아무 일도 안 한다 ══════ */

test('★★★ 받은 칸·초안 칸에는 칩 줄이 «안» 나온다', () => {
  /* ⚠ 세 칸에 «모두» 메일을 넣어 둔다. 안 넣으면 셀 것이 없어 어차피 빈 줄이 나와,
       칸을 가르는 잣대가 있으나 없으나 검사가 통과한다 — 2026-09-18 이빨 확인에서
       실제로 새어나갔다. */
  const one = { SENT:{ k0:S('a@ganasa.co.kr') },
                IN:{ k0:S('b@ganasa.co.kr') },
                DRAFT:{ k0:S('c@ganasa.co.kr') } };
  const coOf = { 'a@ganasa.co.kr':'가나상사', 'b@ganasa.co.kr':'가나상사', 'c@ganasa.co.kr':'가나상사' };
  assert.match(run({ msgs:one, coOf }).mbSentWhoLineHtml(), /홍길동/, '보낸 칸에 칩 줄이 안 나옵니다');
  assert.equal(run({ msgs:one, coOf, box:'IN' }).mbSentWhoLineHtml(), '', '받은 칸에 칩 줄이 나옵니다');
  assert.equal(run({ msgs:one, coOf, box:'DRAFT' }).mbSentWhoLineHtml(), '',
    '아직 «안 나간» 초안에도 「누가 보냈나」가 나옵니다');
  /* 거르개도 같은 잣대를 봐야 한다 — 줄만 숨기고 거르기가 살아 있으면 더 나쁘다 */
  assert.match(sliceFn(app, 'function mbMatchedRows('), /mbSentBox\(\)/, '받은 칸에서도 거릅니다');
});

test('★★★ 아무도 못 짚어도 줄은 «남는다» — 그때가 이 줄이 가장 필요한 때다', () => {
  /* 한 사람도 못 짚었으면 기업정보함이 비어 있다는 뜻이다.
     그때 줄을 없애면 그 사실을 알려 줄 자리가 통째로 사라진다 —
     2026-09-18 에 실제로 그렇게 지었다가 검사에서 드러나 고쳤다. */
  const c = run({ msgs: sent(S('nobody@zzz.kr'), S('other@zzz.kr')) });
  const h = c.mbSentWhoLineHtml();
  assert.match(h, /모름<span class="n">2<\/span>/, '아무도 못 짚었더니 줄이 통째로 사라집니다');
});

test('★★ 보낸 메일이 0통이면 줄 자체가 없다 — 셀 것이 없으면 말할 것도 없다', () => {
  assert.equal(run({ msgs: { SENT:{} } }).mbSentWhoLineHtml(), '', '빈 칸에 칩 줄이 나옵니다');
});

/* ══════ ⑦ 화면 ══════ */

test('★★ 칩 줄에 «전체 · 사람들 · 모름»이 다 있고 수가 적힌다', () => {
  const c = run({ msgs: sent(S('a@ganasa.co.kr'), S('b@ganasa.co.kr'), S('z@zzz.kr')),
                  coOf: { 'a@ganasa.co.kr':'가나상사', 'b@ganasa.co.kr':'가나상사' } });
  const h = c.mbSentWhoLineHtml();
  assert.match(h, /전체<span class="n">3<\/span>/, '전체 수가 안 맞습니다');
  assert.match(h, /홍길동<span class="n">2<\/span>/, '사람 수가 안 맞습니다');
  assert.match(h, /모름<span class="n">1<\/span>/, '모름 수가 안 맞습니다');
  assert.match(h, /mbSentPick\(/, '눌러도 아무 일이 없습니다');
});

test('★★★ 「모름」을 고르면 «어떻게 줄이는지»를 함께 보여 준다', () => {
  const c = run({ msgs: sent(S('a@zzz.kr'), S('b@zzz.kr'), S('c@naver.com')), pick:'*na' });
  const h = c.mbSentWhoLineHtml();
  assert.match(h, /zzz\.kr/, '많이 보낸 도메인을 안 보여 줍니다');
  assert.match(h, /무료메일/, '무료메일이라 못 짚는다는 것을 안 적습니다');
  assert.match(h, /mbCheckOpen\('new'\)/, '「처음 보는 주소」로 가는 문이 없습니다');
  /* 안 고르면 안 나온다 — 평소에 자리를 차지하면 안 된다 */
  const c2 = run({ msgs: sent(S('a@zzz.kr')), pick:'' });
  assert.doesNotMatch(c2.mbSentWhoLineHtml(), /dm-sentgap/, '안 골랐는데 도움말 표가 나옵니다');
});

test('★★★ 여기서 «담지 않는다» — 담는 자리는 「처음 보는 주소」 하나다', () => {
  const fn = sliceFn(app, 'function mbSentGapHtml(');
  assert.doesNotMatch(fn, /erpFillContact|\.(set|update|push|remove)\(/,
    '보낸메일함이 기업정보함에 직접 씁니다 — 담는 길이 두 벌이 됩니다');
});

test('★★★ 짐작을 «짐작이라고» 그린다 — 확실한 것과 달라 보여야 한다', () => {
  const tag = sliceFn(app, 'function mbWhoTag(');
  assert.match(tag, /mbSentBox\(id\)/, '보낸 칸을 「받은이」로 그립니다');
  assert.match(tag, /guess/, '짐작에 다른 차림새를 안 줍니다');
  assert.match(tag, /업체/, '어떻게 알았는지를 딱지에 안 적습니다');
  /* 차림새가 실제로 «다른가» — 글자만 다르고 모양이 같으면 눈이 못 가른다 */
  assert.match(app, /\.dm-who\.guess\{[^}]*dashed/, '짐작 딱지가 확실한 것과 같아 보입니다');
});

test('★★ 딱지를 누르면 «받는이» 주소의 담당자를 바꾼다 — 보낸이(우리)가 아니다', () => {
  const tag = sliceFn(app, 'function mbWhoTag(');
  const seg = tag.slice(tag.indexOf('mbSentBox(id)'), tag.indexOf("const em = String(v.e"));
  assert.match(seg, /mbWhoAsk\('\$\{esc\(to\)\}'/, '보낸 칸에서 엉뚱한 주소의 담당자를 바꿉니다');
  assert.doesNotMatch(seg, /esc\(em\)/, '우리 주소의 담당자를 바꿉니다');
});
