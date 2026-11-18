/* 🚫 메일에서 온 스팸 명함 — 들어올 때 거르고, 들어온 것도 정리하고, 의심은 묻는다 (대표 지시 2026-11-18)

   「메일에서 가지고 오는 정보들 중에 처음부터 스팸이거나 추후에 스팸이 되거나 광고 등으로 들어오는
    내용들이 많다 — 수집이 필요 없다. 완전 스팸은 자동으로 걸러서 반드시 제거해라. 기업정보함으로
    들어왔더라도 스팸으로 바로 정리해라.」
   「스팸으로 의심되는 것은 별도로 모아서 들어올 경우 팝업창으로 남길지 판단을 요청하게 해라.」

   ★ 못 박는 것
     ① 잣대(js/pu-card-spam.js) — 모양이 망가진 주소·글자 없는 이름·아무렇게나 친 주소는 «확실한 스팸»,
        광고 제목·직함만 있는 이름·해외 영업은 «의심», 멀쩡한 명함(같은 회사 공용 메일 포함)은 통과
     ② 사람이 앞선다 — 남기기·메일함 「스팸 아님」은 무엇에도 안 걸리고, 「스팸」으로 정한 주소는 다음부터 스팸
     ③ 진짜 사람을 잃지 않는다 — 휴대폰·업체관리 연결·메일 명함이 아님이면 저절로 안 지우고 묻는다
     ④ 메일함 거르개(mbBadLocal)와 같은 식이다
     ⑤ 받는 탭 — 스팸은 넣지 않고 닫고, 의심은 보류, 목록을 모르면 버리지 않고 보류, 「남기기」 줄은 다시 안 묻는다
     ⑥ 기업정보함 — 메일 명함 가운데 확실한 스팸만 휴지통으로, 모르면·너무 많으면 안 지운다, 의심은 창으로
     ⑦ 창에서 정한 것은 주소로 남고, 보류 줄 «남기기»는 받는 탭의 같은 문으로 돌려보낸다
     ⑧ 메일함 「🚫 스팸신고」한 보낸 사람은 기업정보함에서도 스팸이 된다(«추후에 스팸이 된» 곳)
   ⚠ 예시는 가짜다(가나상사·홍길동·*.example).
   node --test tests/card-spam.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/pu-card-spam.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\r\n').join('\n');

const J = (f, c) => S.judge(f, Object.assign({ fromMail: true }, c || {}));

test('★★★ ① 확실한 스팸 — 모양으로만', () => {
  assert.equal(J({ name: 'ㄴㄴ', email: 'ab??cd???@zzq.example' }).level, 'spam', '주소에 ? 가 든 메일');
  assert.equal(J({ name: '홍길동', email: 'hong@ga?na.example' }).level, 'spam', '도메인에 ? 가 든 메일');
  assert.equal(J({ name: '...', email: 'x1@gana.example' }).level, 'spam', '글자 없는 이름');
  assert.equal(J({ name: '가나 다라', email: 'qwrtzxkp@vbnmlkj.example' }).level, 'spam', '앞뒤 모두 아무렇게나 친 주소');
  assert.equal(J({ name: '홍길동', email: 'hong@gana.example' }, { subject: '안녕하세요 ��' }).level, 'spam', '깨진 글자');
});

test('★★★ ① 의심 — 낱말은 «의심»까지만(사람이 정한다)', () => {
  const role = J({ name: '기업지원팀장', email: 'abc9@gana.example' });
  assert.equal(role.level, 'suspect', '직함만 있는 이름');
  const out = J({ name: 'Alex', company: 'Gana Labs', title: 'Founder', email: 'alex@ganalabs.example' });
  assert.equal(out.level, 'suspect', '국내 연락처 없는 해외 영업');
  assert.equal(J({ name: '홍길동', company: '가나상사', email: 'hong@gana.example' }, { subject: '[광고] 가을 행사' }).level, 'suspect', '광고 제목');
  assert.equal(J({ name: '홍길동', company: '가나상사', email: 'hong@gana.example' }, { subject: '제휴 제안 드립니다' }).level, 'suspect');
  assert.ok(role.why.length >= 1 && out.why.length >= 1, '왜 의심하는지 말해야 사람이 정한다');
});

test('★★★ ① 멀쩡한 명함은 안 걸린다', () => {
  /* 같은 회사 사람 여럿이 공용 메일을 함께 쓴다 — 중복 ⚠ 와 상관없이 스팸은 아니다 */
  ['홍길동', '김가나', '이다라'].forEach((n, i) =>
    assert.equal(J({ name: n, company: '가나상사', title: '대리', mobile: '010-1234-567' + i, tel: '02-123-4567', email: 'office@gana.example' }).level, ''));
  assert.equal(J({ name: '홍길동', email: 'gildong.hong@gana.example' }).level, '', '사람 이름 + 주소만');
  assert.equal(J({ name: '홍길동', email: 'sjhwang@gana.example' }).level, '', '한국식 줄임 주소(자음이 많다)');
  assert.equal(J({ name: '전략기획팀', title: '전략기획팀', email: 'plan@gana.or.kr' }).level, '', '공공기관 부서 이름');
  assert.equal(J({ name: '가나센터', company: '가나도청 가나센터', tel: '041-123-4567', email: 'center@gana.example' }).level, '', '회사·전화가 있는 기관');
  assert.equal(J({ name: '홍길동', company: '가나상사', email: 'hong@gana.example' }, { subject: '무료 상담 가능한가요? 해고 문의' }).level, '',
    '★★ 진짜 문의 제목을 광고로 읽었다(메일함 거르개가 낱말을 안 쓰는 까닭)');
});

test('★★★ ② 사람이 앞선다', () => {
  const junk = { name: 'ㄴㄴ', email: 'ab??cd???@zzq.example' };
  assert.equal(J(junk, { ok: { [S.key(junk.email)]: 1 } }).level, '', '남기기로 정한 주소');
  assert.equal(J(junk, { notSpam: { [S.key('@zzq.example')]: 1 } }).level, '', '메일함 「스팸 아님」 도메인');
  const p = { name: '홍길동', company: '가나상사', email: 'hong@gana.example' };
  assert.equal(J(p).level, '');
  assert.equal(J(p, { spam: { [S.key(p.email)]: 1 } }).level, 'spam', '★★ 스팸으로 정한 주소가 다음에 또 들어온다');
  assert.equal(J(p, { spam: { [S.key('@gana.example')]: 1 } }).level, '', '★★ 스팸 목록은 주소 하나씩 — 도메인째로 막으면 네이버 전체가 막힌다');
  assert.equal(S.key('Hong.Gil@Gana.Example'), 'hong,gil@gana,example', '열쇠 모양이 메일함·서버와 다르다');
});

test('★★★ ③ 진짜 사람은 저절로 안 지운다 — 묻는다', () => {
  const junk = { name: 'ㄴㄴ', email: 'ab??cd???@zzq.example' };
  assert.equal(J(Object.assign({ mobile: '010-1234-5678' }, junk)).level, 'suspect', '휴대폰이 있다');
  assert.equal(J(junk, { protect: true }).level, 'suspect', '업체관리에 이어진 명함');
  const p = { name: '홍길동', company: '가나상사', email: 'hong@gana.example' };
  assert.equal(J(p, { spam: { [S.key(p.email)]: 1 }, fromMail: false }).level, 'suspect', '메일 명함이 아닌데 지운다');
});

test('★★ ④ 메일함 거르개(mbBadLocal)와 같은 식', () => {
  const html = read('pu-cards.html');
  const a = html.indexOf('function mbBadLocal('), fn = html.slice(a, html.indexOf('\n}\n', a));
  const mine = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-card-spam.js'), 'utf8');
  const b = mine.indexOf('function badLocal('), fn2 = mine.slice(b, mine.indexOf('\n  }\n', b));
  const re = (s) => (s.match(/return (\/[^\n]*\/)\.test\(/) || [])[1];
  assert.ok(re(fn) && re(fn) === re(fn2), '★★ 메일함과 기업정보함이 «주소 규약»을 다르게 본다 — 한쪽만 고쳤다');
});

/* ── 받는 탭: 거르기 덩어리만 떼어 가짜 DB 로 돌린다 ── */
function intakeGate(lists, opt) {
  const html = read('remember-intake.html');
  const a = html.indexOf('  var CARD_SPAM ='), b = html.indexOf('  function mailPump()', a);
  assert.ok(a > 0 && b > a, '받는 탭의 스팸 거르기 덩어리를 못 찾았다');
  const writes = {}, notes = [], put = [];
  const db = { ref: (p) => ({
    once: async () => { if (opt && opt.listFail) throw new Error('권한 없음'); return { val: () => (lists || {})[p.split('/').pop()] || null }; },
    update: async (u) => { writes[p] = Object.assign(writes[p] || {}, u); }
  }) };
  const fn = new Function('db', 'PuCardSpam', 'MAIL_Q', 'mailOne', 'note', html.slice(a, b) + '\nreturn mailGate;');
  const gate = fn(db, (opt && opt.noJudge) ? undefined : S, 'pucards/mailcard/q',
    (id) => { put.push(id); return Promise.resolve(); }, (r) => { notes.push(r); return Promise.resolve(); });
  return { gate, writes, notes, put };
}

test('★★★ ⑤ 받는 탭 — 스팸은 안 넣고, 의심은 보류, 멀쩡한 것은 같은 문으로', async () => {
  const t = intakeGate({});
  await t.gate('A_1', { st: 'read', e: 'ab??cd???@zzq.example', f: { name: 'ㄴㄴ', email: 'ab??cd???@zzq.example' } });
  await t.gate('A_2', { st: 'read', e: 'abc9@gana.example', s: '정책자금 안내', f: { name: '기업지원팀장', email: 'abc9@gana.example' } });
  await t.gate('A_3', { st: 'read', e: 'hong@gana.example', s: '해고 문의', f: { name: '홍길동', company: '가나상사', tel: '02-123-4567' } });
  assert.equal(t.writes['pucards/mailcard/q/A_1'].st, 'spam', '★★★ 확실한 스팸을 명함으로 넣었다');
  assert.equal(t.writes['pucards/mailcard/q/A_2'].st, 'hold', '★★★ 의심을 묻지 않고 넣었다');
  assert.ok(t.writes['pucards/mailcard/q/A_2'].why, '왜 보류했는지 남긴다');
  assert.deepEqual(t.put, ['A_3'], '★★★ 멀쩡한 메일 명함까지 막았다 · 스팸을 같은 문으로 보냈다');
  assert.equal(t.notes.length, 2, '거른 것은 «최근에 받은 명함»에 까닭과 함께 적는다 — 조용히 버리지 않는다');
});

test('★★★ ⑤ 받는 탭 — 모르면 버리지 않고, 「남기기」 줄은 다시 안 묻는다', async () => {
  const t = intakeGate({}, { listFail: true });
  await t.gate('B_1', { st: 'read', e: 'ab??cd???@zzq.example', f: { name: 'ㄴㄴ' } });
  assert.equal(t.writes['pucards/mailcard/q/B_1'].st, 'hold', '★★ 사람이 정한 목록을 못 읽었는데 버렸다(남기기로 정한 주소일 수 있다)');
  const k = intakeGate({});
  await k.gate('B_2', { st: 'read', keep: 1, e: 'ab??cd???@zzq.example', f: { name: 'ㄴㄴ' } });
  assert.deepEqual(k.put, ['B_2'], '★★ 대표가 「남기기」로 정했는데 또 걸렀다');
  const ok = intakeGate({ ok: { [S.key('ab??cd???@zzq.example')]: { at: 1 } } });
  await ok.gate('B_3', { st: 'read', e: 'ab??cd???@zzq.example', f: { name: 'ㄴㄴ' } });
  assert.deepEqual(ok.put, ['B_3'], '남기기로 정한 주소의 새 메일');
  const sp = intakeGate({ spam: { [S.key('hong@gana.example')]: { at: 1 } } });
  await sp.gate('B_4', { st: 'read', e: 'hong@gana.example', f: { name: '홍길동', company: '가나상사' } });
  assert.equal(sp.writes['pucards/mailcard/q/B_4'].st, 'spam', '★★ 스팸으로 정한 곳이 또 명함으로 들어온다');
  const nj = intakeGate({}, { noJudge: true });
  await nj.gate('B_5', { st: 'read', e: 'hong@gana.example', f: { name: '홍길동' } });
  assert.deepEqual(nj.put, [], '★★ 잣대 파일을 못 실었는데 거르지 않고 넣었다');
  assert.equal(Object.keys(nj.writes).length, 0, '잣대가 없으면 줄을 건드리지 않는다(다음에 다시 본다)');
});

test('★★ ⑤ 받는 탭 연결 — 잣대 파일을 싣고, 펌프가 거르기를 지난다', () => {
  const html = read('remember-intake.html');
  assert.match(html, /<script src="js\/pu-card-spam\.js\?v=\d+"><\/script>/, '잣대 파일을 안 싣는다');
  const p = html.slice(html.indexOf('function mailPump()'), html.indexOf('function mailWatch()'));
  assert.match(p, /mailGate\(/, '★★★ 펌프가 거르기를 건너뛰고 바로 넣는다');
  assert.doesNotMatch(p, /mailOne\(/, '★★★ 펌프가 거르기를 건너뛰고 바로 넣는다');
});

/* ── 기업정보함: 정리 덩어리만 떼어 가짜 상태·가짜 DB 로 돌린다 ── */
function cardsSpam(items, lists, opt) {
  const html = read('pu-cards.html');
  const a = html.indexOf('const CARD_SPAM_AUTO_MAX'), h = html.indexOf('\nfunction cspHtml(', a);
  assert.ok(a > 0 && h > a, '기업정보함의 스팸 정리 덩어리를 못 찾았다');
  const b = html.indexOf('\n}\n', h) + 3;                 /* 창 그리기(cspHtml)까지 — 그리다 넘어지면 창이 안 뜬다 */
  const deleted = [], updates = [], toasts = [];
  let holdCb = null;
  const db = {
    ref: (p) => ({
      once: async () => { if (opt && opt.listFail) throw new Error('권한 없음'); return { val: () => (lists || {})[p.split('/').pop()] || null }; },
      orderByChild: () => ({ equalTo: () => ({ on: (ev, cb) => { holdCb = cb; } }) }),
      set: async () => {},
      update: async (u) => { updates.push(u); }
    })
  };
  const Store = { mode: 'firebase', db, _itemsReady: true, del: async (id) => { deleted.push(id); delete state.items[id]; } };
  const state = { items, groups: { g1: { id: 'g1', name: '📬 메일에서 온 명함', kind: 'card' }, g2: { id: 'g2', name: '가나 폴더', kind: 'card' } },
    isAdmin: !!(opt && opt.admin) };
  const boxes = [];
  const doc = { querySelector: () => (opt && opt.modalOpen) ? {} : null, createElement: () => { const b = {}; boxes.push(b); return b; },
    body: { appendChild() {}, classList: { contains: () => !(opt && opt.phone) } } };
  const deps = { state, Store, DB_ROOT: 'pucards', inHiddenLocked: (it) => !!it.locked, PuCardSpam: S,
    ErpMatch: { match: (it) => (it.erp ? {} : null) }, toast: (m) => toasts.push(m), render() {}, renderSoon() {}, myEmail: 'boss@gana.example',
    $: () => null, document: doc, esc: (s) => String(s), confirm: () => true, setTimeout: () => 0,
    delMany: async (ids) => { for (const id of ids) await Store.del(id); return { ok: ids.length, fail: 0, why: '' }; } };
  const names = Object.keys(deps);
  const fn = new Function(...names, html.slice(a, b) + '\nreturn { cardSpamRun, cspRows, cspDecide, cspMarkSpamAddrs, cspCount, isOn: () => _cspOn };');
  const api = fn(...names.map((k) => deps[k]));
  return Object.assign(api, { deleted, updates, toasts, state, html: () => (boxes.length && boxes[boxes.length - 1].innerHTML) || '',
    hold: (v) => holdCb && holdCb({ val: () => v }) });
}
const mailCard = (id, f, extra) => Object.assign({ id, kind: 'card', capturedBy: '메일', group: 'g1' }, f, extra || {});

test('★★★ ⑥ 기업정보함 — 메일 명함 가운데 확실한 스팸만 휴지통으로', async () => {
  const items = {
    s1: mailCard('s1', { name: 'ㄴㄴ', email: 'ab??cd???@zzq.example' }),
    s2: mailCard('s2', { name: '가나 다라', email: 'qwrtzxkp@vbnmlkj.example' }, { group: '' }),
    q1: mailCard('q1', { name: '기업지원팀장', email: 'abc9@gana.example' }),
    ok: mailCard('ok', { name: '홍길동', company: '가나상사', tel: '02-123-4567', email: 'hong@gana.example' }),
    moved: mailCard('moved', { name: 'ㄴㄴ', email: 'zz??@zzq.example' }, { group: 'g2' }),
    scan: { id: 'scan', kind: 'card', name: 'ㄴㄴ', email: 'yy??@zzq.example', capturedBy: '사진첩' },
    erp: mailCard('erp', { name: 'ㄴㄴ', email: 'xx??@zzq.example', erp: 1 }),
    lock: mailCard('lock', { name: 'ㄴㄴ', email: 'ww??@zzq.example', locked: 1 })
  };
  const c = cardsSpam(items, {}, { admin: true });
  await c.cardSpamRun();
  assert.deepEqual(c.deleted.sort(), ['s1', 's2'], '★★★ 확실한 스팸만, 메일에서 온 것만 휴지통으로');
  assert.ok(!c.deleted.includes('moved'), '★★ 사람이 다른 폴더로 옮긴 명함을 지웠다');
  assert.ok(!c.deleted.includes('scan'), '★★★ 사진첩·리멤버로 온 명함(진짜 만난 사람)을 지웠다');
  assert.ok(!c.deleted.includes('erp'), '★★★ 업체관리에 이어진 명함을 지웠다');
  assert.ok(!c.deleted.includes('lock'), '남의 잠긴 폴더 명함을 건드렸다');
  assert.ok(c.toasts.some((m) => /휴지통/.test(m)), '★★ 지우고도 알리지 않았다 — 「명함이 사라졌다」가 된다');
  const asked = c.cspRows().map((r) => r.id).sort();
  assert.deepEqual(asked, ['erp', 'q1'], '의심(직함만 · 업체관리 연결)은 창으로 묻는다');
  assert.ok(c.isOn(), '★★★ 의심이 있는데 창을 안 띄웠다');
  const box = c.html();
  assert.match(box, /type="checkbox"/, '목록 맨 왼쪽 ☐ 고르기 칸이 없다');
  assert.match(box, /cspDecide\(\[cspKeyOf\(this\)\],'keep'\)/, '줄마다 «남기기»가 없다');
  assert.match(box, /cspDecide\(\[cspKeyOf\(this\)\],'spam'\)/, '줄마다 «스팸»이 없다');
  assert.match(box, /data-k="c:q1"/, '줄 열쇠를 글자로 단추 코드에 박지 않고 data- 로 단다');
  const phone = cardsSpam({ q1: mailCard('q1', { name: '기업지원팀장', email: 'abc9@gana.example' }) }, {}, { admin: true, phone: true });
  await phone.cardSpamRun();
  assert.match(phone.html(), /class="nck-m"/, '폰에서는 넓은 표 대신 줄마다 카드로');
  assert.doesNotMatch(phone.html(), /<table/, '폰에서 넓은 표를 그린다');
});

test('★★★ ⑥ 기업정보함 — 모르면·너무 많으면 안 지운다 · 직원에게는 창을 안 띄운다', async () => {
  const one = { s1: mailCard('s1', { name: 'ㄴㄴ', email: 'ab??cd???@zzq.example' }) };
  const f = cardsSpam(Object.assign({}, one), {}, { listFail: true, admin: true });
  await f.cardSpamRun();
  assert.deepEqual(f.deleted, [], '★★★ 사람이 정한 목록(남기기)을 못 읽었는데 지웠다');
  const many = {};
  for (let i = 0; i < 80; i++) many['m' + i] = mailCard('m' + i, { name: 'ㄴㄴ', email: 'a' + i + '??@zzq.example' });
  const m = cardsSpam(many, {}, { admin: true });
  await m.cardSpamRun();
  assert.deepEqual(m.deleted, [], '★★★ 한꺼번에 너무 많이 걸렸는데 다 지웠다 — 잣대가 틀렸을 수 있다');
  assert.equal(m.cspRows().length, 80, '저절로 안 지운 것은 창으로 묻는다');
  const staff = cardsSpam({ q1: mailCard('q1', { name: '기업지원팀장', email: 'abc9@gana.example' }) }, {}, { admin: false });
  await staff.cardSpamRun();
  assert.equal(staff.isOn(), false, '직원 화면에 스팸 판단 창을 띄웠다');
  assert.equal(staff.cspCount(), 0);
  const busy = cardsSpam({ q1: mailCard('q1', { name: '기업지원팀장', email: 'abc9@gana.example' }) }, {}, { admin: true, modalOpen: true });
  await busy.cardSpamRun();
  assert.equal(busy.isOn(), false, '다른 창 위에 겹쳐 띄웠다');
});

test('★★★ ⑦ 창에서 정하기 — 주소로 남고, 보류 줄 «남기기»는 받는 탭의 같은 문으로', async () => {
  const items = { q1: mailCard('q1', { name: '기업지원팀장', email: 'abc9@gana.example' }) };
  const c = cardsSpam(items, {}, { admin: true });
  await c.cardSpamRun();
  c.hold({ H1: { st: 'hold', e: 'alex@ganalabs.example', s: 'Quick question', why: '해외 영업', f: { name: 'Alex', company: 'Gana Labs' } } });
  const rows = c.cspRows();
  assert.equal(rows.length, 2, '보류한 메일 줄과 의심 명함을 한 창에 모은다');
  await c.cspDecide(['q:H1'], 'keep');
  const u1 = Object.assign({}, ...c.updates);
  assert.equal(u1['pucards/mailcard/q/H1/st'], 'read', '★★★ 남기기로 한 줄을 받는 탭에 돌려보내지 않았다');
  assert.equal(u1['pucards/mailcard/q/H1/keep'], 1, '★★ 받는 탭이 또 걸러 보류한다');
  assert.ok(u1['pucards/mailcard/ok/' + S.key('alex@ganalabs.example')], '★★ 남기기를 주소로 안 남겼다 — 다음 메일에 또 묻는다');
  assert.ok(!Object.keys(u1).some((k) => /\/items\//.test(k)), '★★★ 창이 명함을 직접 만든다(겹침 검사를 비켜 간다)');
  await c.cspDecide(['c:q1'], 'spam');
  const u2 = Object.assign({}, ...c.updates);
  assert.ok(u2['pucards/mailcard/spam/' + S.key('abc9@gana.example')], '★★★ 스팸으로 정한 주소를 안 남겼다 — 또 들어온다');
  assert.deepEqual(c.deleted, ['q1'], '스팸으로 정한 명함은 휴지통으로');
  assert.equal(c.cspRows().length, 0);
});

test('★★ ⑦ 창이 먼저 열려 있어도 새로 찾은 의심을 그 창에 그린다', async () => {
  const c = cardsSpam({ ok: mailCard('ok', { name: '홍길동', company: '가나상사', tel: '02-123-4567', email: 'hong@gana.example' }) }, {}, { admin: true });
  await c.cardSpamRun();
  assert.equal(c.isOn(), false, '물을 것이 없는데 창을 띄웠다');
  c.hold({ H1: { st: 'hold', e: 'news@promo.example', s: '[웨비나] 초대', f: { name: '점검팀' } } });
  assert.ok(c.isOn() && /data-k="q:H1"/.test(c.html()), '보류 메일이 오면 창을 띄운다');
  c.state.items.q1 = mailCard('q1', { name: '기업지원팀장', email: 'abc9@gana.example' });
  await c.cardSpamRun();
  assert.match(c.html(), /data-k="c:q1"/, '★★ 창이 열려 있으면 새 의심 명함이 창에 안 나온다(옆줄 숫자만 는다)');
  assert.match(c.html(), /data-k="q:H1"/);
});

test('★★ ⑧ 메일함 「🚫 스팸신고」 → 기업정보함 스팸 목록', async () => {
  const html = read('pu-cards.html');
  const a = html.indexOf('function mbSpamReport('), fn = html.slice(a, html.indexOf('\n}\n', a));
  assert.match(fn, /cspMarkSpamAddrs\(/, '★★ 메일함에서 스팸으로 신고한 곳이 기업정보함에는 그대로 남는다');
  const c = cardsSpam({}, {}, { admin: true });
  c.cspMarkSpamAddrs(['Hong@Gana.example', '', 'x'], '메일 스팸신고');
  const u = Object.assign({}, ...c.updates);
  assert.deepEqual(Object.keys(u), ['pucards/mailcard/spam/' + S.key('hong@gana.example')], '주소 열쇠로만, 빈 것·주소 아닌 것은 빼고');
});

test('★★ 다시 여는 길 · 싣기 · 쓰기 허락', () => {
  const html = read('pu-cards.html');
  assert.match(html, /<script src="js\/pu-card-spam\.js\?v=\d+"><\/script>/, '잣대 파일을 안 싣는다');
  assert.match(html, /onclick="cspOpen\(\)"[^>]*>🤔<em>스팸 의심<\/em>/, '★★ 「나중에」로 닫으면 다시 열 길이 없다(옆줄)');
  assert.match(html, /cspOpen\(\)">🤔 스팸 의심/, '★★ 폰 메뉴에서 다시 열 길이 없다');
  const ready = html.slice(html.indexOf('if(!Store._itemsReady){'), html.indexOf('if(!Store._itemsReady){') + 3000);
  assert.match(ready, /setTimeout\(cardSpamRun,/, '★★★ 명함을 다 읽은 뒤 정리를 부르지 않는다');
  const rules = read('scripts/make-firebase-rules.js');
  assert.match(rules, /mailcard: \{[^\n]*\$k2: \{ '\.write': LOGIN/, '스팸·남기기 목록(mailcard/ok·spam)에 쓸 허락이 없다');
});
