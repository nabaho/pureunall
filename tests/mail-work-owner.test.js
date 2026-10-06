'use strict';
/* 📁 진행 중인 사건·컨설팅을 메일함에서 바로 본다 (대표 승인 목업 2026-09-28)
   「현재 진행중인사건이나 컨설팅의 경우 푸른이알피에서는 지정되어 있는데
    메일함에서는 직접 확인하기가 어려운데」

   지키는 것
   ① 사건·컨설팅에 주소가 «그대로» 적혀 있으면 그 건 주담당이 메일 담당이 된다
      — 사람이 정한 것(①·①-2)보다는 뒤, 명함(②)보다는 앞
   ② 담당이 둘로 갈리면 정하지 않는다 · 끝난 건은 안 본다 · 퇴사자는 이어받은 사람
   ③ 업체로 잇는 열쇠는 id·사업자번호뿐 — «이름»으로는 잇지 않는다(온톨로지 규칙)
   ④ 건 담당의 칸에도 함께 보인다 — 부담당과 같은 길, 한 사람 칸에 두 번 세지 않는다
   ⑤ 딱지는 한 줄 — 여럿이면 「컨설팅 2」, 건 담당 칸에서는 「함께 · ○○ 업체」
   ⑥ 🏢 제목 속 업체 — 주소 전체가 «한 업체»만 말할 때만, 저절로 잇지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 업체관리 기록 — ErpMatch 가 만드는 것과 같은 꼴(같은 «기록 하나»를 열쇠로 쓴다) */
const GANA = { company: '가나상사', main: '박한별', left: false, bizNo: '123-45-67890' };
const SAA = { company: '사아무역', main: '김혜민', left: true, bizNo: '' };

function box(o) {
  o = o || {};
  const ctx = {
    Object, String, Number, Array, JSON, Map, RegExp,
    digits: (s) => String(s || '').replace(/\D/g, ''),
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    _mbOwner: o.owner || {},
    _mbWork: null,
    /* 사람이 손으로 이은 주소 → 건 (대표 승인 목업 2026-10-05) — config/mailWork */
    _mbWorkLink: o.workLink || {},
    _mbNoWho: {}, _mbBoxWho: o.boxWho || {},   /* 👤 이 칸을 보는 사람 (2026-10-06) */
    MB_RAW_P: '~', MB_WHO_P: '@',
    mbNow: () => (o.now === undefined ? '#bin' : o.now),
    mbSentBox: () => !!o.sent,
    mbWhoKey: (s) => String(s || '').replace(/[.#$/[\]]/g, '_'),
    mbDomOf: (e) => { const i = String(e).lastIndexOf('@'); return i < 0 ? '' : String(e).slice(i + 1); },
    mbRetired: (w) => !!(o.retired || {})[w],
    mbSuccOf: (w) => (o.succ || {})[w] || '',
    mbCoOf: (e) => (o.coOf || {})[e] || '',
    mbCoRec: (nm) => ({ '가나상사': GANA, '사아무역': SAA })[nm] || null,
    mbWhoIndex: () => ({ byAddr: o.byAddr || {}, byDom: {}, coAddr: o.coAddr || {} }),
  };
  vm.createContext(ctx);
  ['mbWhoLive', 'mbWhoWhy','mbWhoWhyOf', 'mbWorkLive', 'mbWorkBuild', 'mbWorkHandOf',
    'mbWorkMgrOfAddr', 'mbWorkOfRow', 'mbWorkMgrs', 'mbWorkTag', 'mbSubsOfRow', 'mbCoNameOf',
    'mbWorkLinkedKeys', 'mbWorkTodo',
    'mbNoWhoBox', 'mbBoxWhoList', 'mbBoxWhoOfRow']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  /* ⚠ 갈래 목록을 여기 «베껴 두지 않는다». 베껴 두면 앱이 갈래를 늘려도 검사만 옛 목록을
       보고 통과해, 「검사는 파란데 화면에는 안 나오는」 자리가 생긴다(2026-10-05 기금·기타). */
  const kindSrc = app.match(/const MB_WORK_KIND = \{[^}]*\};/);
  assert.ok(kindSrc, 'MB_WORK_KIND 를 앱에서 찾지 못했습니다 — 이름이 바뀌었는지 보십시오');
  vm.runInContext('var ' + kindSrc[0].slice('const '.length), ctx);
  /* 메일 담당 — 실제 앱처럼 mbWhoWhy 를 그대로 쓴다 */
  ctx.mbWhoOfRow = (v) => ctx.mbWhoWhy(String((v && v.e) || ''), null).who;
  ctx.mbPerson = (s) => s;
  ctx.ErpMatch = { _norm: (s) => String(s || '').replace(/\s/g, '') };
  ctx._mbBizSubs = {};
  /* 사무관리 자료 — loadErpCaseCons 가 주는 꼴 {byBiz, byName} */
  const recs = o.recs || [];
  const m = { byBiz: {}, byName: { x: recs } };
  ctx._mbWork = ctx.mbWorkBuild(m, { 'P-001': '권형하', 'P-002': '박재원', 'P-003': '김동현', 'P-009': '퇴사자' },
    { 'co-gana': GANA, 'co-saa': SAA }, { '1234567890': GANA });
  return ctx;
}
const CONS = (x) => Object.assign({ _kind: 'consulting', id: 'c1', status: 'progress', managerMain: 'P-001',
  companyName: '가나상사 아산공장', title: '성과급 설계' }, x);
const who = (c, e) => c.mbWhoWhy(e, null);

test('★★★ 사건·컨설팅에 적힌 주소면 그 건 주담당이 메일 담당이다', () => {
  const c = box({ recs: [CONS({ primaryContactEmail: 'Hong@Naver.com ' })] });
  const r = who(c, 'hong@naver.com');
  assert.equal(r.who, '권형하', '★★★ 컨설팅 기록에 적힌 주소인데 담당을 못 찾습니다');
  assert.equal(r.why, 'work');
});

test('★★ 담당자 이메일 줄(contacts)도 본다 — 떠난 사람 줄은 안 본다', () => {
  const c = box({ recs: [CONS({ contacts: [{ email: 'kim@dara.co.kr' }, { email: 'old@dara.co.kr', left: true }] })] });
  assert.equal(who(c, 'kim@dara.co.kr').who, '권형하');
  assert.equal(who(c, 'old@dara.co.kr').who, '', '★★ 떠난 담당자 주소까지 이어 붙입니다');
});

test('★★★ 사람이 정한 주소·이어 둔 자문사가 «먼저»다 — 기계가 사람을 덮지 않는다', () => {
  const c = box({ recs: [CONS({ email: 'hong@naver.com' })], owner: { 'hong@naver_com': '김동현' } });
  assert.equal(who(c, 'hong@naver.com').who, '김동현', '★★★ 사람이 정한 담당을 사건·컨설팅이 덮습니다');
  const c2 = box({ recs: [CONS({ email: 'hong@naver.com' })], coOf: { 'hong@naver.com': '가나상사' } });
  assert.equal(who(c2, 'hong@naver.com').who, '박한별', '★★ 사람이 이어 둔 자문사를 사건·컨설팅이 덮습니다');
});

test('★★ 명함(기업정보함)보다는 앞이다 — 명함은 이름으로 짚은 것이다', () => {
  const c = box({ recs: [CONS({ email: 'hong@naver.com' })], byAddr: { 'hong@naver.com': '박재원' } });
  assert.equal(who(c, 'hong@naver.com').who, '권형하');
});

test('★★★ 담당이 둘로 갈리면 «정하지 않는다»', () => {
  const c = box({ recs: [CONS({ email: 'hong@naver.com' }),
    { _kind: 'case', id: 's1', status: 'open', managerMain: 'P-002', email: 'hong@naver.com' }] });
  assert.equal(who(c, 'hong@naver.com').who, '', '★★★ 두 건 두 사람인데 한 사람에게 몰아 줍니다');
});

test('★★★ 끝난 건은 안 본다 — 종료·완료·closedDate·지운 것', () => {
  ['closed', 'done', '종료', '완료'].forEach((st) => {
    const c = box({ recs: [CONS({ status: st, email: 'hong@naver.com' })] });
    assert.equal(who(c, 'hong@naver.com').who, '', '★★★ 끝난 건(' + st + ')의 담당에게 메일이 갑니다');
  });
  const c = box({ recs: [CONS({ closedDate: '2026-09-01', email: 'hong@naver.com' }),
    CONS({ id: 'c2', _deleted: true, email: 'lee@naver.com' })] });
  assert.equal(who(c, 'hong@naver.com').who, '');
  assert.equal(who(c, 'lee@naver.com').who, '');
});

/* 2026-09-28 에는 사건·컨설팅만 봤다. 대표께서 2026-10-05 「사건관리 컨설팅관리 «등등»」
   이라 하셨고 목업에도 기금·기타 칸이 있어 넓혔다 — 진행 중인 기금 3건·기타 1건이다. */
test('★★ 기금·기타도 본다 (대표 지시 2026-10-05 「등등」) — 계약은 안 본다', () => {
  const mk = (kind) => box({ recs: [{ _kind: kind, id: kind + '1', status: 'open',
    managerMain: 'P-001', email: 'hong@naver.com' }] });
  assert.equal(who(mk('fund'), 'hong@naver.com').who, '권형하', '기금 담당이 메일 담당이어야 한다');
  assert.equal(who(mk('other'), 'hong@naver.com').who, '권형하', '기타 담당도 마찬가지다');
  /* ⚠ 계약은 «받은 업무»가 아니라 문서다 — 넣으면 계약 담당이 그 회사 메일을 통째로 본다 */
  assert.equal(who(mk('contract'), 'hong@naver.com').who, '', '계약은 보지 않는다');
});

test('★★ 퇴사자가 담당이면 이어받은 사람 — 없으면 정하지 않는다', () => {
  const recs = [CONS({ managerMain: 'P-009', email: 'hong@naver.com' })];
  assert.equal(who(box({ recs, retired: { '퇴사자': 1 }, succ: { '퇴사자': '박재원' } }), 'hong@naver.com').who, '박재원');
  assert.equal(who(box({ recs, retired: { '퇴사자': 1 } }), 'hong@naver.com').who, '');
});

test('★★ 우리 주소는 잇지 않는다 — 담당자가 제 주소를 연락처에 적어 둔 것', () => {
  const c = box({ recs: [CONS({ email: 'p001@pureun.kr' })] });
  assert.equal(who(c, 'p001@pureun.kr').who, '');
});

test('★★★ 업체로는 id·사업자번호로만 잇는다 — 이름이 같아도 안 잇는다', () => {
  const byId = box({ recs: [CONS({ companyId: 'co-gana', companyName: '엉뚱한이름' })], coOf: { 'office@ganasa.co.kr': '가나상사' } });
  assert.equal(byId.mbWorkOfRow({ e: 'office@ganasa.co.kr' }).length, 1, '★★★ 업체 id 로 이어진 건을 못 찾습니다');
  const byBiz = box({ recs: [CONS({ bizNo: '1234567890' })], coOf: { 'office@ganasa.co.kr': '가나상사' } });
  assert.equal(byBiz.mbWorkOfRow({ e: 'office@ganasa.co.kr' }).length, 1, '★★ 사업자번호로 이어진 건을 못 찾습니다');
  const byName = box({ recs: [CONS({ companyName: '가나상사' })], coOf: { 'office@ganasa.co.kr': '가나상사' } });
  assert.equal(byName.mbWorkOfRow({ e: 'office@ganasa.co.kr' }).length, 0, '★★★ 업체 «이름»으로 건을 잇습니다(온톨로지 규칙 위반)');
});

test('★★ 자문이 끝난 업체면 업체 쪽 건은 안 붙인다', () => {
  const c = box({ recs: [CONS({ companyId: 'co-saa' })], coOf: { 'a@saa.kr': '사아무역' } });
  assert.equal(c.mbWorkOfRow({ e: 'a@saa.kr' }).length, 0, '★★ 자문이 끝난 업체의 건을 붙입니다');
  const c2 = box({ recs: [CONS({ companyId: 'co-gana' })], coOf: { 'a@saa.kr': '가나상사' } });
  assert.equal(c2.mbWorkOfRow({ e: 'a@saa.kr' }).length, 1, '(대조) 살아 있는 업체면 붙는다');
});

test('★★★ 건 담당 칸에도 함께 — 부담당 길에 얹힌다, 한 사람 칸에 두 번 안 센다', () => {
  /* 가나상사 업체 담당 박한별 · 컨설팅 담당 권형하 */
  const c = box({ recs: [CONS({ companyId: 'co-gana' })], coOf: { 'office@ganasa.co.kr': '가나상사' } });
  assert.equal(c.mbWhoOfRow({ e: 'office@ganasa.co.kr' }), '박한별', '★★ 업체 담당이 바뀌면 안 됩니다');
  const subs = Array.prototype.slice.call(c.mbSubsOfRow({ e: 'office@ganasa.co.kr' }, null));
  assert.deepEqual(subs, ['권형하'], '★★★ 컨설팅 담당 칸에 그 메일이 안 보입니다');
  /* 주소로 잡힌 건(업체 없음) — 메일 담당 = 건 담당이면 부담당으로 또 넣지 않는다 */
  const c2 = box({ recs: [CONS({ email: 'hong@naver.com' })] });
  assert.deepEqual(Array.prototype.slice.call(c2.mbSubsOfRow({ e: 'hong@naver.com' }, null)), [],
    '★★★ 같은 사람을 부담당으로 또 넣어 그 칸에 두 번 셉니다');
});

test('★★★ 거르는 곳·세는 곳이 모두 mbSubsOfRow 를 본다 — 칩 숫자와 칸 통수가 같다', () => {
  const fits = strip(sliceFn(app, 'function mbRowFits('));
  const tally = strip(sliceFn(app, 'function mbWhoTally('));
  assert.match(fits, /mbSubsOfRow\(/);
  assert.match(tally, /mbSubsOfRow\(/);
  assert.match(strip(sliceFn(app, 'function mbSubsOfRow(')), /mbWorkOfRow\(/, '★★★ 건 담당을 부담당 길에 안 얹었습니다');
});

test('★★★ 딱지 — 업체 담당과 다르면 건 담당 이름을 함께, 같으면 이름을 안 되풀이', () => {
  const c = box({ recs: [CONS({ companyId: 'co-gana' })], coOf: { 'office@ganasa.co.kr': '가나상사' } });
  const h = c.mbWorkTag({ e: 'office@ganasa.co.kr' });
  assert.match(h, /📁 컨설팅 · 권형하/);
  assert.match(h, /class="dm-work"/);
  assert.match(h, /mbWorkPick\('office@ganasa\.co\.kr',event\)/, '★★ 눌러도 이알피로 안 갑니다');
  assert.doesNotMatch(h, /onclick="[^"]*c1/, '★ 건 번호를 단추 글자에 실었습니다 — 누를 때 다시 찾아야 합니다');
  const c2 = box({ recs: [CONS({ email: 'hong@naver.com' })] });
  const h2 = c2.mbWorkTag({ e: 'hong@naver.com' });
  assert.match(h2, /📁 컨설팅</, '★ 담당이 같은데 이름을 또 적습니다');
});

test('★★ 여럿이면 「컨설팅 2」로 줄인다 — 전부는 마우스를 올리면 보인다', () => {
  const c = box({ recs: [CONS({ companyId: 'co-gana' }), CONS({ id: 'c2', companyId: 'co-gana', title: '임금체계' })],
    coOf: { 'office@ganasa.co.kr': '가나상사' } });
  const h = c.mbWorkTag({ e: 'office@ganasa.co.kr' });
  assert.match(h, /📁 컨설팅 2 · 권형하/);
  assert.match(h, /성과급 설계/);
  assert.match(h, /임금체계/);
});

test('★★★ 건 담당 칸에서는 「함께 · ○○ 업체」 — 내 업체가 아니라는 것을 밝힌다', () => {
  const c = box({ now: '@권형하', recs: [CONS({ companyId: 'co-gana' })], coOf: { 'office@ganasa.co.kr': '가나상사' } });
  const h = c.mbWorkTag({ e: 'office@ganasa.co.kr' });
  assert.match(h, /dm-work with/);
  assert.match(h, /컨설팅으로 함께 · 박한별 업체/);
});

test('★★ 걸린 건이 없거나, 원본·보낸 칸이면 아무것도 안 그린다', () => {
  const c = box({ recs: [CONS({ email: 'hong@naver.com' })] });
  assert.equal(c.mbWorkTag({ e: 'nobody@zzz.kr' }), '');
  assert.equal(box({ now: '~raw', recs: [CONS({ email: 'hong@naver.com' })] }).mbWorkTag({ e: 'hong@naver.com' }), '');
  assert.equal(box({ sent: true, recs: [CONS({ email: 'hong@naver.com' })] }).mbWorkTag({ e: 'hong@naver.com' }), '');
});

test('★★ 남이 적은 건 제목은 걸러 넣는다', () => {
  const c = box({ recs: [CONS({ email: 'hong@naver.com', title: '<img src=x onerror=alert(1)>' })] });
  assert.doesNotMatch(c.mbWorkTag({ e: 'hong@naver.com' }, true), /<img/);
});

test('★★ 목록 줄과 읽는 화면 «둘 다»에 붙는다 · 한 줄(넘치면 …)', () => {
  assert.match(app, /function mbTagParts\([\s\S]{0,600}mbWhoTag\(v\),\s*mbWorkTag\(v\)/, '★★ 목록 줄에 딱지가 없습니다');
  assert.match(app, /\$\{mbTagColsHtml\(tagCols, i\)\}/);
  assert.match(app, /\$\{mbWorkTag\(v, true\)\}/, '★★ 읽는 화면에 딱지가 없습니다');
  const css = (app.match(/\.dm-work\{[^}]*\}/) || [''])[0];
  assert.match(css, /white-space:nowrap/);
  assert.match(css, /text-overflow:ellipsis/);
});

test('★★ 이알피 원장은 읽기만 — 새로 읽는 자리도 없다(같은 자료로 만든다)', () => {
  const body = strip(['mbWorkBuild', 'mbWorkOfRow', 'mbWorkTag', 'mbWorkGo', 'mbWorkMgrOfAddr']
    .map((n) => sliceFn(app, 'function ' + n + '(')).join('\n'));
  assert.doesNotMatch(body, /firebase|\.ref\(/, '★★ 메일함이 이알피 원장을 건드립니다');
  assert.match(strip(sliceFn(app, 'function mbBizSubsLoad(')), /_mbWork = mbWorkBuild\(/);
  assert.match(strip(sliceFn(app, 'function mbWorkGo(')), /PuAppBar\.goApp\(/, '★ 창을 공용 층 밖에서 엽니다');
});

/* ══════ 📁 을 누르면 «그 한 건»이 열린다 (대표 지시 2026-09-30 「1번」) ══════ */
function gobox(recs) {
  const c = box({ recs });
  const went = [];
  c.PuAppBar = { goApp: (u, p) => went.push(u + ' | ' + p) };
  c.window = c;
  c.encodeURIComponent = encodeURIComponent;
  c.Date = { now: () => 1700000000000 };
  c.toast = (t) => went.push('toast ' + t);
  c.$ = () => c._menu;
  c._menu = { innerHTML: '' };
  c.mbPlaceMenu = () => went.push('menu');
  c.closeFolderMenu = () => {};
  ['mbWorkPick', 'mbWorkGoAt', 'mbWorkGo'].forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), c));
  return { c, went };
}

test('★★★ 건이 하나면 그 건의 번호를 실어 이알피를 연다 — 메뉴가 아니라 «그 한 건»', () => {
  const { c, went } = gobox([CONS({ id: 'cons 7/가', email: 'hong@naver.com' })]);
  c.mbWorkPick('hong@naver.com', {});
  assert.equal(went.length, 1);
  assert.match(went[0], /^pu-erp\.html\?open=consulting:cons%207%2F%EA%B0%80&opent=\d+#menu=biz\/consulting \| /,
    '★★★ 건 번호가 주소에 안 실렸습니다 — 목록까지만 갑니다');
  const s = gobox([{ _kind: 'case', id: 's9', status: 'open', managerMain: 'P-002', email: 'lee@naver.com' }]);
  s.c.mbWorkPick('lee@naver.com', {});
  assert.match(s.went[0], /\?open=case:s9&opent=\d+#menu=biz\/case/);
});

test('★★ 번호 없는 옛 건은 메뉴까지만 — 빈 번호로 열라고 하지 않는다', () => {
  const { c, went } = gobox([CONS({ id: '', email: 'hong@naver.com' })]);
  c.mbWorkPick('hong@naver.com', {});
  assert.match(went[0], /^pu-erp\.html#menu=biz\/consulting/);
});

test('★★★ 건이 여럿이면 «고르게» 한다 — 고른 그 건이 열린다', () => {
  const { c, went } = gobox([CONS({ id: 'c1', email: 'hong@naver.com' }),
    { _kind: 'case', id: 's2', status: 'open', managerMain: 'P-002', email: 'hong@naver.com', companyName: '가나상사', title: '부당해고' }]);
  c.mbWorkPick('hong@naver.com', {});
  assert.deepEqual(went.slice(), ['menu'], '★★★ 여럿인데 고르지도 않고 하나를 엽니다');
  assert.match(c._menu.innerHTML, /성과급 설계/);
  assert.match(c._menu.innerHTML, /부당해고/);
  assert.match(c._menu.innerHTML, /mbWorkGoAt\('hong@naver\.com',1\)/);
  c.mbWorkGoAt('hong@naver.com', 1);
  assert.match(went[1], /\?open=case:s2&/, '★★ 고른 것과 다른 건이 열립니다');
});

test('★★ 그 사이에 건이 끝났으면 알린다 — 눌렀는데 아무 일도 없게 두지 않는다', () => {
  const { c, went } = gobox([]);
  c.mbWorkPick('hong@naver.com', {});
  assert.match(went[0], /^toast /);
});

/* ══════ 🏢 제목 속 업체 ══════ */
function gbox(msgs) {
  const ctx = {
    Object, String, Number, Array,
    _mbMsgs: msgs,
    _memo: {},
    MB_GUESS_MINEV: 3, MB_GUESS_MINRATIO: 0.5,
    mbGuessOurs: (e) => /@pureun\.kr$/.test(e),
    /* 제목에 업체 이름이 있으면 그 업체 */
    mbGuessOf: (v) => {
      const s = String(v.s || '');
      if (s.indexOf('다라물류') >= 0) return { co: '다라물류', id: '', who: '김혜민', from: '제목', txt: s };
      if (s.indexOf('마바상사') >= 0) return { co: '마바상사', id: '', who: '박재원', from: '제목', txt: s };
      return null;
    },
  };
  ctx.mbMemoOf = () => ctx._memo;
  vm.createContext(ctx);
  ['mbGuessRow', 'mbGuessAddr', 'mbGuessChip'].forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return ctx;
}
const M = (e, s) => ({ e, s, n: '이영희' });

test('★★★ 주소 전체가 한 업체만 말하면 🏢 을 띄운다 — 근거 통수도 함께', () => {
  const c = gbox({ IN: { a: M('lee@naver.com', '[다라물류] 9월 급여대장'), b: M('lee@naver.com', '다라물류 4대보험'),
    c: M('LEE@naver.com', '안녕하세요') } });
  const r = c.mbGuessChip(M('lee@naver.com', '[다라물류] 9월 급여대장'));
  assert.ok(r, '★★★ 제목에 업체가 있는데 안 띄웁니다');
  assert.equal(r.co, '다라물류');
  assert.equal(r.v, 2);
  assert.equal(r.n, 3, '★ 대소문자가 다른 같은 주소를 따로 셉니다');
});

test('★★★ 한 주소에 여러 업체가 섞이면 «안 띄운다» — 세무사무소·단체 메일', () => {
  const c = gbox({ IN: { a: M('tax@naver.com', '다라물류 원천세'), b: M('tax@naver.com', '마바상사 원천세') } });
  assert.equal(c.mbGuessChip(M('tax@naver.com', '다라물류 원천세')), null, '★★★ 여러 업체를 말하는 주소를 한 곳에 잇게 권합니다');
});

test('★★ 이 한 통에 업체가 없거나, 우리 주소면 안 띄운다', () => {
  const c = gbox({ IN: { a: M('lee@naver.com', '다라물류'), b: M('p001@pureun.kr', '다라물류') } });
  assert.equal(c.mbGuessChip(M('lee@naver.com', '안녕하세요')), null);
  assert.equal(c.mbGuessChip(M('p001@pureun.kr', '다라물류')), null);
  /* 이 한 통이 말하는 업체가 주소 전체와 다르면(아직 표에 안 든 새 메일) 안 띄운다 */
  assert.equal(c.mbGuessChip(M('lee@naver.com', '마바상사 견적')), null, '★★ 이 메일은 딴 업체를 말하는데 그 주소의 업체를 권합니다');
});

test('★★★ 저절로 잇지 않는다 — 누르면 확인을 거쳐 mbCoSet 한 곳으로', () => {
  const c = gbox({ IN: { a: M('lee@naver.com', '다라물류 급여'), b: M('lee@naver.com', '다라물류 보험') } });
  const put = [];
  c.mbCoSet = (e, co) => put.push(e + '→' + co);
  c.toast = () => {};
  let asked = '';
  c.confirm = (q) => { asked = q; return false; };
  vm.runInContext(sliceFn(app, 'function mbGuessChipGo('), c);
  c.mbGuessChipGo('LEE@naver.com');
  assert.equal(put.length, 0, '★★★ 아니요를 눌렀는데 잇습니다');
  assert.match(asked, /다라물류/);
  assert.match(asked, /2통/, '★★ 몇 통이 옮겨 가는지 안 알립니다');
  c.confirm = () => true;
  c.mbGuessChipGo('LEE@naver.com');
  assert.deepEqual(put.slice(), ['lee@naver.com→다라물류']);
  const go = strip(sliceFn(app, 'function mbGuessChipGo('));
  assert.match(go, /confirm\(/, '★★★ 묻지 않고 잇습니다');
  assert.ok(go.indexOf('confirm(') < go.indexOf('mbCoSet('), '★★★ 묻기 전에 잇습니다');
  const tag = strip(sliceFn(app, 'function mbWhoTag('));
  assert.match(tag, /mbGuessChip\(v\)/, '★★ 담당 모름 줄에 🏢 을 안 띄웁니다');
  assert.match(tag, /mbGuessChipGo\(/);
  assert.doesNotMatch(tag, /mbCoSet\(/, '★★★ 그리기만 해도 이어 버립니다');
});

test('★★ 메일 한 통에 업체를 «한 번»만 찾는다 — 부담당 길이 찾은 것을 건 찾기에 넘긴다', () => {
  /* 대표 화면 2026-10-02 「mbWhoKey 871,624번」 — 같은 업체를 두 번씩 찾고 있었다 */
  const c = box({ recs: [CONS({ companyId: 'co-gana' })], coOf: { 'office@ganasa.co.kr': '가나상사' } });
  let n = 0;
  const real = c.mbCoOf;
  c.mbCoOf = (e) => { n++; return real(e); };
  const subs = Array.prototype.slice.call(c.mbSubsOfRow({ e: 'office@ganasa.co.kr' }, null));
  assert.deepEqual(subs, ['권형하'], '(대조) 건 담당은 그대로 함께 본다');
  /* 부담당 길(업체·이름 한 번씩) + 메일 담당(mbWhoWhy) 한 번 = 셋. 건 찾기가 또 찾으면 넷이 된다 */
  assert.ok(n <= 3, '★★ 업체를 ' + n + '번 찾습니다 — 건 찾기가 다시 찾고 있습니다');
  /* 건 찾기에 업체를 넘기면 «한 번도» 안 찾는다 — 없다(null)고 넘겨도 마찬가지 */
  n = 0;
  assert.equal(c.mbWorkOfRow({ e: 'office@ganasa.co.kr' }, null, GANA).length, 1);
  assert.equal(c.mbWorkOfRow({ e: 'office@ganasa.co.kr' }, null, null).length, 0);
  assert.equal(n, 0, '★★ 넘겨 준 업체를 두고 다시 찾습니다');
});
