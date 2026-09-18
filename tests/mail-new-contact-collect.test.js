/* 👤 처음 보는 주소 — 한 화면에 모아 담는다 (대표 지시 2026-09-16)
   「메일함으로 들어오는 정보중에 이메일이 처음이거나 담당자가 처음인 경우가 자주 있다.
    이럴 경우에는 기업정보함에 정보 저장할 수 있는 기능을 만들고 싶다」

   ★ 실측 2026-09-16 — 메일을 열었을 때 뜨는 띠는 최근 1년 주소 681개 가운데
     46개(7%)에만 떴다. 짚이지 않으면 아무것도 안 뜬다. 그래서 모아 보는 자리를 둔다.

   지키는 것.
   ① 공공기관·협회·학교와 기계발신은 «아예 안 나온다» — 업체가 아니라 담을 것이 없다
   ② 이미 아는 주소·「넘어가기」 한 주소는 안 나온다
   ③ 짚이면 그 업체가 미리 골라져 있고, 안 짚이면 «사람이» 고른다
   ④ 이름으로 업체를 «자동 연결하지 않는다» — 고른 것의 열쇠(id)로만 잇는다
   ⑤ 셈을 담아 둔다 — 찾기 칸에 한 글자 칠 때마다 수십만 번 돌면 안 된다
   ⑥ 담거나 넘어가면 그 줄이 «바로» 빠진다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'pu-cards.html'), 'utf8');
const bare = app.replace(/\/\*[\s\S]*?\*\//g, ' ');

const NOW = Date.now(), D = 86400000;
const CO = [
  { id:'co1', name:'가나상사', email:'hong1@ganasa.co.kr', contacts:[{email:'hong1@ganasa.co.kr'}] },
  { id:'co2', name:'다라물류', contacts:[] },
  { id:'co3', name:'마바', contacts:[] },       /* 이름이 짧다 — 이름으로 짚으면 안 된다 */
  { id:'co4', name:'ABC물산', contacts:[] },    /* 한 글자 찾기를 재려고 — 영문이라 길이가 확실하다 */
  /* ⚠ 담당자가 «네이버»를 쓰는 업체. 도메인으로 짚으면 온 세상 네이버가 여기로 온다 */
  { id:'co5', name:'사아무역', contacts:[{ email:'saa@naver.com' }] }
];

function run(msgs, opt){
  const o = opt || {};
  const ctx = {
    Object, String, Number, Array, Date, RegExp, console,
    state: { mbNewQ:{} },
    _mbMsgs: msgs,
    /* ⚠ 지난 메일(*old)도 «칸으로 등록해» 둔다. 등록을 안 해 두면 mbGotFolder 가
         모르는 칸이라고 먼저 튕겨 내서, 「*old 는 처음이 아니다」라는 잣대가
         있으나 없으나 검사가 통과한다 — 2026-09-18 이빨 확인에서 실제로 새어나갔다. */
    _mbFolders: { IN:{ path:'INBOX', name:'INBOX', kind:'inbox', total:9 },
                  SENT:{ path:'Sent', name:'Sent', kind:'sent', total:9 },
                  '*old':{ path:'*old', name:'지난 메일', kind:'inbox', total:9 } },
    _mbOwner: o.owner || {},
    MB_OLD_ID: '*old',
    MB_PUB_DOM: ['naver.com','daum.net','hanmail.net','gmail.com','nate.com'],
    MB_SENT_KINDS: { sent:1, drafts:1, tome:1, sched:1 },
    ErpMatch: { ready:true, companies: CO, nameByEmail: o.staff || {} },
    mbWhoIndex: () => ({ coAddr: o.coAddr || {} }),
    mbCoOf: e => (o.coOf || {})[e] || '',
    mbMyAddr: () => (o.my || '370-6@daum.net'),
    mbNewSkipSet: () => (o.skip || {}),
    mbWhoKey: s => String(s||'').replace(/[.#$/\[\]]/g,'_'),
    mbDomOf: e => { const i = String(e).lastIndexOf('@'); return i<0 ? '' : String(e).slice(i+1); },
    mbFolderBy: s => ctx._mbFolders[s] || null,
    renderMailPage(){}
  };
  vm.createContext(ctx);
  ['mbGotFolder','mbNewAskable','mbNewCoOf','mbNewList','mbNewBust','mbNewFind','mbNewHits']
    .forEach(n => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  ['MB_PUB_TAIL','MB_BOT_RE','MB_NEW_DAYS'].forEach(n =>
    vm.runInContext(bare.match(new RegExp('const ' + n + ' = [^\\n]*'))[0], ctx));
  vm.runInContext('let _mbNewLs = null;', ctx);
  return ctx;
}
const M = (e, f, s, days) => ({ u:1, e:e, f:f||'', s:s||'', t:'370-6@daum.net',
  d: NOW - (days||1)*D, r:1 });
const box = (...rows) => { const b = {}; rows.forEach((r,i)=>b['k'+i] = r); return { IN:b }; };

/* ══════ ① 업체가 아닌 것은 안 나온다 ══════ */

test('★★★ 공공기관·협회·학교는 «아예» 안 나온다 — 업체가 아니라 담을 것이 없다', () => {
  const c = run(box(
    M('jiyun12@korea.kr','공무원'), M('abc@moel.go.kr','노동부'),
    M('x@nosa.or.kr','협회'), M('y@koreatech.ac.kr','학교'),
    M('z@kli.re.kr','연구원'), M('hong@ganasa.co.kr','홍길동')));
  const got = c.mbNewList().map(r=>r.em);
  assert.deepEqual(got, ['hong@ganasa.co.kr'],
    '업체가 아닌 곳이 물음으로 나옵니다: ' + got.join(', '));
});

test('★★★ 기계가 보내는 자리도 안 나온다 — 담당자로 담을 사람이 없다', () => {
  ['no-reply@abc.com','noreply@abc.com','webmaster@abc.com','billing@abc.com',
   'notification@abc.com','do-not-reply@abc.com','info@abc.com'].forEach(e=>{
    const c = run(box(M(e,'기계')));
    assert.equal(c.mbNewList().length, 0, e + ' 가 물음으로 나옵니다');
  });
  /* ⚠ 사람 이름에 들어간 낱말까지 걸러내면 안 된다 */
  const c2 = run(box(M('information.kim@abc.com','김정보')));
  assert.equal(c2.mbNewList().length, 1, '사람 주소까지 기계로 봤습니다');
});

/* ══════ ② 이미 아는 것은 안 묻는다 ══════ */

test('★★★ 이미 업체에 이어졌거나 «넘어가기» 한 주소는 안 나온다', () => {
  const rows = box(M('a@x.co.kr','가'), M('b@x.co.kr','나'), M('c@x.co.kr','다'), M('d@x.co.kr','라'));
  assert.equal(run(rows).mbNewList().length, 4, '밑바탕이 4줄이 아닙니다');
  assert.equal(run(rows, { coAddr:{ 'a@x.co.kr':'홍길동' } }).mbNewList().length, 3, '이어진 주소가 나옵니다');
  assert.equal(run(rows, { skip:{ 'b@x_co_kr':1 } }).mbNewList().length, 3, '넘어간 주소가 나옵니다');
  assert.equal(run(rows, { staff:{ 'c@x.co.kr':'김혜민' } }).mbNewList().length, 3, '우리 직원이 나옵니다');
  assert.equal(run(rows, { owner:{ 'd@x_co_kr':'p001' } }).mbNewList().length, 3, '담당자를 박은 것이 나옵니다');
  /* ★ 자문사 이메일 잇기로 «이미 회사가 잡히는» 주소도 물을 것이 없다.
       이 길은 coAddr 과 «다른» 잣대다 — 둘 중 하나만 막으면 아는 주소를 또 묻는다. */
  assert.equal(run(rows, { coOf:{ 'a@x.co.kr':'가나상사' } }).mbNewList().length, 3,
    '자문사로 이미 이어진 주소를 또 묻습니다');
});

test('★★ 우리가 «낸» 칸과 지난 메일은 안 본다 — 거기 보낸이는 우리다', () => {
  const c = run({ SENT:{ a:M('someone@x.co.kr','상대') },
                  '*old':{ b:M('old@y.co.kr','옛사람') } });
  assert.equal(c.mbNewList().length, 0, '보낸 칸·지난 메일에서 물음이 나옵니다');
});

test('★★ 1년보다 오래된 것은 «처음»이 아니다', () => {
  const c = run(box(M('a@x.co.kr','가', '', 400), M('b@x.co.kr','나', '', 30)));
  assert.deepEqual(c.mbNewList().map(r=>r.em), ['b@x.co.kr'], '1년 밖까지 물어봅니다');
});

/* ══════ ③④ 짚기 ══════ */

test('★★★ 도메인이 그 업체 것이면 «미리 골라» 둔다', () => {
  const c = run(box(M('kildong@ganasa.co.kr','김길동')));
  const r = c.mbNewList()[0];
  assert.ok(r && r.co && r.co.id === 'co1', '도메인으로 안 짚습니다');
  assert.equal(r.why, '도메인');
});

test('★★★ 무료메일(네이버·다음·지메일)은 도메인으로 «절대» 안 짚는다', () => {
  /* 실측 2026-09-16 — 처음 보는 주소 681개 가운데 198개가 무료메일이었다.
     도메인으로 짚으면 그 198명이 모두 「사아무역」 담당자로 담긴다.
     ⚠ 한 번 담기면 사람이 한 건씩 되돌려야 한다 — 짚지 «않는» 쪽이 옳다. */
  ['naver.com','daum.net','hanmail.net','gmail.com','nate.com'].forEach(d=>{
    const c = run(box(M('nobody@' + d, '누군가')));
    const r = c.mbNewList()[0];
    assert.ok(r, d + ' 줄이 아예 안 나옵니다');
    assert.equal(r.co, null, d + ' 를 도메인으로 짚었습니다 — 남의 담당자로 담깁니다');
  });
});

test('★★★ 우리 메일함이 daum.net 이라고 «다음 쓰는 거래처»가 사라지면 안 된다', () => {
  /* 「우리 도메인은 뺀다」는 잣대가 무료메일까지 재면, 우리 메일이 다음이라서
     다음을 쓰는 거래처 담당자가 통째로 안 보인다 — 2026-09-18 이빨 확인에서 드러났다.
     ⚠ 우리 «회사» 도메인은 그대로 뺀다. 그건 우리 직원이다. */
  const c = run(box(M('geodaecheo@daum.net','거래처사람')));
  assert.equal(c.mbNewList().length, 1, '다음 쓰는 거래처가 통째로 안 보입니다');
  const c2 = run(box(M('kim@fairrunlabor.com','우리사람')), { my:'370-6@fairrunlabor.com' });
  assert.equal(c2.mbNewList().length, 0, '우리 회사 도메인까지 물어봅니다');
});

test('★★★ 본문·제목에 업체 이름이 보이면 짚는다 — 다만 «네 글자 이상»만', () => {
  const c = run(box(M('who@zzz.kr','아무개','다라물류 급여 자료입니다')));
  assert.equal((c.mbNewList()[0]||{}).why, '이름', '이름으로 안 짚습니다');
  /* ⚠ 짧은 이름은 아무 데나 걸린다 — 「마바」가 「마바지」에 걸리면 안 된다 */
  const c2 = run(box(M('who2@zzz.kr','아무개','마바 관련 문의')));
  assert.equal((c2.mbNewList()[0]||{}).co, null, '짧은 이름으로 짚었습니다');
});

test('★★★ 이름으로 업체를 «자동 연결하지 않는다» — 고른 것의 열쇠로만 잇는다', () => {
  /* 찾기는 «후보를 보여 줄» 뿐이고, 담는 것은 사람이 그 줄을 눌러야 한다 */
  const c = run(box(M('x@zzz.kr','아무개')));
  /* ⚠ 상자 «안에서» 만들어진 배열은 겉보기가 같아도 deepEqual 이 튕긴다(집이 다르다).
       그래서 ids() 로 한 번 옮겨 담아 잰다 — 2026-09-18 에 여기서 반나절 헛짚었다. */
  const ids = r => Array.prototype.map.call(r, x => x.id);
  assert.deepEqual(ids(c.mbNewHits('ABC')), ['co4'], '이름으로 못 찾습니다');
  /* ⚠ 한 글자로는 안 찾는다 — 아무 데나 걸린다.
       ⚠ 한글 한 글자로 재지 «않는다». 자모가 갈린 꼴(NFD)이면 길이가 2라 이 검사가
         조용히 헛돈다 — 2026-09-18 에 실제로 그랬다. 영문 한 글자로 잰다. */
  assert.deepEqual(ids(c.mbNewHits('A')), [],
    '한 글자로도 찾아 줍니다 — 아무거나 걸립니다');
  /* ★ 넘기는 것은 «열쇠(id)»다 — 이름을 넘기면 같은 이름 두 곳일 때 엉뚱한 데 담긴다.
       ⚠ 글귀를 통째로 박지 «않는다». 단추를 짓는 방식(이어붙이기/틀문자열)은 바뀔 수 있고,
         지켜야 할 것은 «무엇을 넘기는가» 하나다. */
  const pick = sliceFn(app, 'function mbCheckHtml(');
  assert.match(pick, /mbNewOpen\([^\n]{0,60}esc\(String\(c\.id/,
    '찾아서 고른 업체의 «열쇠»를 안 넘깁니다');
  assert.match(pick, /esc\(String\(x\.co\.id/,
    '도메인·이름으로 짚어 준 업체의 «열쇠»를 안 넘깁니다');
  assert.doesNotMatch(pick, /mbNewOpen\([^\n]{0,80}\.name/,
    '업체 «이름»을 넘깁니다 — 같은 이름이 둘이면 엉뚱한 곳에 담깁니다');
});

/* ══════ ⑤ 셈을 담아 둔다 ══════ */

test('★★★ 목록을 «담아 둔다» — 한 글자 칠 때마다 수십만 번 돌면 안 된다', () => {
  const c = run(box(M('a@x.co.kr','가')));
  const one = c.mbNewList();
  assert.equal(c.mbNewList(), one, '부를 때마다 새로 셉니다');
  c.mbNewBust();
  assert.notEqual(c.mbNewList(), one, '버려도 그대로입니다');
});

test('★★★ 담거나 넘어가면 «바로» 버린다 — 안 버리면 담은 줄이 그대로 남는다', () => {
  ['mbNewNo', 'mbNewSave', 'mbCheckAgain'].forEach((n)=>{
    const f = sliceFn(app, 'function ' + n + '(') || sliceFn(app, 'async function ' + n + '(');
    assert.match(f, /mbNewBust\(\)/, n + ' 이 목록을 안 버립니다');
  });
});

/* ══════ ⑥ 화면에 붙어 있나 ══════ */

test('★★ 점검 창에 갈래로 붙어 있다 — 새 창을 만들지 않았다', () => {
  const f = sliceFn(app, 'function mbCheckHtml(');
  assert.match(f, /\['new',\s*'👤 처음 보는 주소'/, '갈래가 없습니다');
  assert.match(f, /tab === 'new'/, '그 갈래를 그리는 자리가 없습니다');
  assert.ok(f.indexOf('mbNewNo(') > 0, '넘어가기가 없습니다');
});

test('★★ 「왜 이 화면인가」와 «안 담는 것»을 그 칸 안에 적어 둔다', () => {
  const f = sliceFn(app, 'function mbCheckHtml(');
  const i = f.indexOf('new:');
  assert.ok(i > 0, '설명이 없습니다');
  const seg = f.slice(i, i + 700);
  assert.match(seg, /공공기관/, '무엇이 안 나오는지 안 적혀 있습니다');
  assert.match(seg, /안 덮습니다/, '있는 값을 덮는지 안 덮는지 안 적혀 있습니다');
  assert.match(seg, /기업정보함/, '없는 회사는 어디서 만드는지 안 알려 줍니다');
});

test('★★★ 담는 길은 «새로 안 짓는다» — erpFillContact 하나다', () => {
  /* ⚠ 두 벌이 되면 한쪽만 「빈 칸만 채우기」를 지키게 된다.
       ⚠ 「업체 기록을 쓰는 자리가 몇 곳인가」로는 못 본다 — 기업정보함 편집도 그 자리를
         쓴다(2026-09-18 에 그렇게 세다 헛걸렸다). 이 화면이 «제 손으로 안 쓰는지»를 본다. */
  const save = sliceFn(app, 'async function mbNewSave(');
  assert.match(save, /erpFillContact\(/, '담는 길이 erpFillContact 가 아닙니다');
  assert.ok(!/data\/companies/.test(save), '이 화면이 업체 기록을 제 손으로 씁니다');
  const fill = sliceFn(app, 'async function erpFillContact(');
  assert.match(fill, /if\(has\) return \{ ok:true, added:false/,
    '이미 적힌 주소를 덮습니다 — 남이 고쳐 둔 것이 조용히 사라집니다');
  assert.match(fill, /blank\(cur\.primaryContactEmail\)/,
    '대표 담당자 칸을 «빈 칸만» 채우지 않습니다');
});
