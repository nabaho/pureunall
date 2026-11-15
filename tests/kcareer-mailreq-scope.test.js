/* 경력관리 «요청 메일» 범위 분류 — «이력서·경력·회의·비용»은 남기고 «업무»는 뺀다 (대표 지시 2026-11-15, Jev 로 자동 분류)
   ⚠ 메일은 모두 지어낸 것이다(저장소가 공개 — 실제 기관·사람 이름을 쓰지 않는다). 주소는 example.org 만.
   못 박는 것(규칙이지 «지금 값»이 아니다):
     ① 1차는 말 목록 — 개인 말만 있으면 남기고, 업무 말만 있으면 «요청 아님»으로 자동 제외, 둘 다/둘 다 없으면 애매
     ② 자동 제외는 «새 요청»(st:'new')만 — 사람이 만진 건(확인함·처리 완료)의 상태는 그대로
     ③ Jev 는 «애매한 건»만, 제목·첨부 이름만 받는다(본문·보낸이는 안 간다) · 한 번 물은 건은 다시 안 묻는다
     ④ Jev 가 못 답하면(던지면) 아무 상태도 안 바뀐다 · 모르는 답은 쓰지 않는다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Q = require('../js/kcareer-mailreq.js');
const { 만들기 } = require('./helpers/fake-rtdb.js');

const ROOT = path.join(__dirname, '..');
const kc = fs.readFileSync(path.join(ROOT, 'kcareer.html'), 'utf8');
const mod = fs.readFileSync(path.join(ROOT, 'js', 'kcareer-mailreq.js'), 'utf8');
const DAY = 864e5;
const NOW = new Date(2026, 10, 15, 16, 0).getTime();
const at = (m, d, h) => new Date(2026, m - 1, d, h || 9, 0).getTime();
const scope = (s, an) => Q.scopeOf({ s, an: an || [] }).scope;

/* ── ① 규칙 ── */
test('개인 말만 있으면 «이력·회의·비용» — 동의서(인력풀)·심의·재위촉·지급확인서·서약서(첨부 이름도 본다)', () => {
  assert.equal(scope('[가나연구원] 전문가(멘토) 인력풀 참여 사전동의서'), 'personal');
  assert.equal(scope('가나도의회 의원 상해 등 보상심의위원회 서면 심의 요청'), 'personal');
  assert.equal(scope('[가나재단] 통합 기술보호지원반 제3기 전문가 재위촉 신청 관련 활동 증빙'), 'personal');
  assert.equal(scope('[가나협회] 노무상담비 지급확인서 서명 및 회신 요청드립니다.'), 'personal');
  assert.equal(scope('가나지청 입니다', ['판단 전문위원회 제척·기피·회피 신청 및 서약서.hwpx']), 'personal', '제목에 말이 없어도 첨부 이름으로');
  assert.equal(scope('경력 증명서 제출 요청'), 'personal');
});
test('업무 말만 있으면 «업무» — 보고서·이행관리·인터뷰·신고사건·근로계약서·퇴사자 서식', () => {
  assert.equal(scope('RE: FW: [푸른노무법인] 컨설팅 중간보고서 송부의 건'), 'work');
  assert.equal(scope('FW:[업무협조요청]_홍길동 노동청 추가 신고사건 관련'), 'work');
  assert.equal(scope('[구조혁신사업] 정책매니저 보고서 수정 요청 / 가나농산(주)'), 'work');
  assert.equal(scope('[가나컨설팅] 26년 일터혁신 심화컨설팅 이행관리 안내_다라산업'), 'work');
  assert.equal(scope('RE: 석유화학산업 협력업체 컨설팅 진행을 위한 인터뷰 양식 송부'), 'work');
  assert.equal(scope('가나식당 근로계약서 양식 요청드립니다'), 'work');
  assert.equal(scope('10월 퇴사자 명단', ['입퇴사자 요청 서식.xlsx']), 'work');
});
test('둘 다 있거나 둘 다 없으면 «애매» — 지어서 가르지 않는다', () => {
  assert.equal(scope('근로자 명부 및 이력서 제출 요청'), 'unsure', '개인 말(이력서) + 업무 말(근로자)');
  assert.equal(scope('RE: [푸른노무법인] 통장 사본 송부의 건'), 'unsure', '법인 이름표(업무) + 통장 사본(비용)');
  assert.equal(scope('서류 제출 부탁드립니다', ['양식.hwp']), 'unsure', '어느 쪽 말도 없다');
  assert.equal(scope(''), 'unsure'); assert.equal(Q.scopeOf(null).scope, 'unsure');
  Q.scopeOf({ s: '근로자 명부 및 이력서 제출 요청' }).why.forEach((w) => assert.ok(w.length > 0));
});
test('말 목록의 한계를 지킨다 — 개인 말과 업무 말이 «같은 말»을 나눠 갖지 않는다', () => {
  // 한 말이 양쪽에 걸리면 «둘 다»가 되어 애매로 샌다 — 목록끼리 겹치는 낱말이 없어야 한다
  const probe = ['이력서', '프로필', '위촉', '심의', '서약서', '지급확인서', '수당', '강사료', '보고서', '노동청', '급여', '근로계약서', '취업규칙', '산재'];
  probe.forEach((w) => assert.ok(!(Q.SCOPE_PERSONAL.test(w) && Q.SCOPE_WORK.test(w)), '«' + w + '» 가 양쪽에 걸린다'));
  assert.ok(Q.SCOPES.indexOf('unsure') >= 0 && Q.SCOPES.length === 3);
});

/* ── ② 새 건 만들기·훑기 ── */
const IN = 'INBOX-a1b2c3d4';
const mkRow = (o) => Object.assign({ s: '[가나컨설팅] 결과보고서 양식 제출 요청의 건', an: ['결과보고서 양식.hwp'], p: '안녕하세요 담당자입니다 양식을 작성하여 제출해 주세요', f: '가나컨설팅', e: 'work@example.org', a: 1, d: at(11, 14, 13), r: 0, w: 0 }, o || {});
function dbWith(rows, extraItems) {
  const msgs = { [IN]: {} };
  Object.keys(rows).forEach((k) => { msgs[IN][k] = rows[k]; });
  return 만들기({ mailbox: { folders: { [IN]: { kind: 'inbox', name: '받은메일함' } }, msgs }, kcareer: { U1: { mailreq: { items: extraItems || {} } } } });
}
const items = (f) => f.읽기('kcareer/U1/mailreq/items') || {};
const scan = (f, o) => Q.scan(Object.assign({ db: f, uid: 'U1', now: NOW }, o || {}));

test('업무 말만 있는 요청 메일은 처음부터 «요청 아님»(자동 제외)으로 올라온다 — 알림·진행 중에 안 센다', async () => {
  const f = dbWith({ 101: mkRow() });
  await scan(f);
  const x = items(f)[IN + '~101'];
  assert.ok(x, '기록은 남는다(되돌릴 수 있게)');
  assert.equal(x.st, 'ignored'); assert.equal(x.scope, 'work'); assert.equal(x.scopeBy, 'rule'); assert.ok(x.autoIgnored > 0);
  const sm = Q.summary(items(f), NOW);
  assert.equal(sm.open, 0, '진행 중에 안 센다'); assert.equal(sm.alarm, 0, '알림에 안 센다'); assert.equal(sm.ignored, 1);
  assert.equal(Q.filterItems(items(f), 'open').length, 0);
});
test('개인 말(이력·회의·비용) 요청 메일은 그대로 «새 요청» — 범위 딱지만 붙는다', async () => {
  const f = dbWith({ 102: mkRow({ s: '[가나기관] 전문가 인력풀 참여 사전동의서', an: ['동의서 양식.hwp'] }) });
  await scan(f);
  const x = items(f)[IN + '~102'];
  assert.equal(x.st, 'new'); assert.equal(x.scope, 'personal'); assert.ok(!x.autoIgnored);
  assert.equal(Q.summary(items(f), NOW).alarm, 1);
});
test('애매한 요청 메일은 «새 요청»으로 두고 애매 딱지를 붙인다 — 사람이 본다', async () => {
  const f = dbWith({ 103: mkRow({ s: '서류 제출 요청드립니다', an: ['제출 양식.hwp'] }) });
  await scan(f);
  const x = items(f)[IN + '~103'];
  assert.equal(x.st, 'new'); assert.equal(x.scope, 'unsure'); assert.equal(x.scopeBy, 'rule');
});

/* ── ② 옛 건 한 번 가르기(backfill) ── */
const OLD = (id, st, s, extra) => Object.assign({ id, entityType: 'kcareer_mailreq', createdAt: NOW - DAY, updatedAt: NOW - DAY, slug: IN, uid: id.split('~')[1], kinds: ['other'], st, s, f: '가나', e: 'a@example.org', d: NOW - DAY, an: [], why: [] }, extra || {});
test('범위가 없는 옛 건을 한 번 가른다 — 새 요청인 업무 건만 자동 제외, 사람이 만진 건은 상태 그대로', async () => {
  const f = dbWith({}, {
    [IN + '~1']: OLD(IN + '~1', 'new', '고객사 보고서 수정 요청의 건'),
    [IN + '~2']: OLD(IN + '~2', 'doing', '고객사 보고서 수정 요청의 건'),
    [IN + '~3']: OLD(IN + '~3', 'done', '고객사 보고서 수정 요청의 건'),
    [IN + '~4']: OLD(IN + '~4', 'new', '위원 활동 확인서 제출 요청'),
  });
  const r = await scan(f);
  const it = items(f);
  assert.equal(it[IN + '~1'].st, 'ignored'); assert.equal(it[IN + '~1'].scope, 'work'); assert.ok(it[IN + '~1'].autoIgnored);
  assert.equal(it[IN + '~2'].st, 'doing', '확인함으로 둔 건은 사람이 정한 것 — 상태를 안 바꾼다'); assert.equal(it[IN + '~2'].scope, 'work', '딱지는 붙는다');
  assert.equal(it[IN + '~3'].st, 'done'); assert.ok(!it[IN + '~3'].autoIgnored);
  assert.equal(it[IN + '~4'].st, 'new'); assert.equal(it[IN + '~4'].scope, 'personal');
  assert.equal(r.scoped, 4); assert.equal(r.autoIgnored, 1);
});
test('이미 범위가 있는 건은 다시 안 가른다(사람이 되돌린 건을 또 치우지 않는다)', async () => {
  const f = dbWith({}, { [IN + '~1']: OLD(IN + '~1', 'doing', '고객사 보고서 수정 요청의 건', { scope: 'work', scopeBy: 'rule', autoIgnored: NOW - 3600e3 }) });
  const r1 = await scan(f); const before = JSON.stringify(items(f)[IN + '~1']);
  const r2 = await scan(f);
  assert.equal(items(f)[IN + '~1'].st, 'doing', '되돌린(확인함) 건을 스캔이 다시 치우지 않는다');
  assert.equal(JSON.stringify(items(f)[IN + '~1']), before); assert.equal(r1.scoped || 0, 0); assert.equal(r2.scoped || 0, 0);
});

/* ── ③ Jev(2차) ── */
const unsureItem = (n, extra) => OLD(IN + '~' + n, 'new', '서류 제출 요청드립니다 ' + n, Object.assign({ scope: 'unsure', scopeBy: 'rule', an: ['양식.hwp'], d: NOW - DAY }, extra || {}));
test('Jev 길에는 «애매한 새 요청»의 건 번호만 간다 — 제목·첨부 이름도 서버가 직접 읽는다(화면이 글을 싣지 않고, 본문·보낸이·주소는 어디에도 안 간다)', async () => {
  const f = dbWith({}, {
    [IN + '~1']: unsureItem(1),
    [IN + '~2']: OLD(IN + '~2', 'new', '이력서 제출 요청', { scope: 'personal', scopeBy: 'rule' }),
    [IN + '~3']: OLD(IN + '~3', 'new', '보고서 요청', { scope: 'work', scopeBy: 'rule' }),
    [IN + '~4']: unsureItem(4, { st: 'done' }),
  });
  let sent = null;
  const r = await Q.scopeAsk({ db: f, uid: 'U1', now: NOW, ask: async (list) => { sent = list; return { ok: true, results: {} }; } });
  assert.deepEqual(sent.map((x) => x.id), [IN + '~1'], '애매한 «새 요청»만(개인·업무로 이미 가른 것과 처리 완료는 안 보낸다)');
  assert.deepEqual(Object.keys(sent[0]), ['id'], '건 번호만 — 제목·첨부 이름도 서버가 그 사람의 기록에서 직접 읽는다');
  assert.equal(r.asked, 0, '답이 없으면 아무것도 바꾸지 않았다');
});
test('Jev 가 «업무»라 하면 새 요청은 자동 제외 · «개인»이면 남김 · «애매»여도 한 번 물은 건은 다시 안 묻는다', async () => {
  const f = dbWith({}, { [IN + '~1']: unsureItem(1), [IN + '~2']: unsureItem(2), [IN + '~3']: unsureItem(3) });
  const r = await Q.scopeAsk({ db: f, uid: 'U1', now: NOW, ask: async () => ({ ok: true, results: {
    [IN + '~1']: { scope: 'work' }, [IN + '~2']: { scope: 'personal' }, [IN + '~3']: { scope: 'unsure' } } }) });
  const it = items(f);
  assert.equal(it[IN + '~1'].st, 'ignored'); assert.equal(it[IN + '~1'].scope, 'work'); assert.equal(it[IN + '~1'].scopeBy, 'jev'); assert.ok(it[IN + '~1'].autoIgnored);
  assert.equal(it[IN + '~2'].st, 'new'); assert.equal(it[IN + '~2'].scope, 'personal'); assert.equal(it[IN + '~2'].scopeBy, 'jev');
  assert.equal(it[IN + '~3'].st, 'new'); assert.equal(it[IN + '~3'].scope, 'unsure'); assert.ok(it[IN + '~3'].scopeAsked, '물어봤다는 표시');
  assert.deepEqual([r.asked, r.work, r.personal, r.unsure], [3, 1, 1, 1]);
  let again = 0;
  await Q.scopeAsk({ db: f, uid: 'U1', now: NOW, ask: async () => { again++; return { ok: true, results: {} }; } });
  assert.equal(again, 0, '한 번 물은 건은 다시 안 묻는다 — 보낼 것이 없으면 부르지도 않는다');
});
test('사람이 «확인함»으로 둔 건은 Jev 가 업무라 해도 딱지만 붙이고 상태는 안 바꾼다', async () => {
  const f = dbWith({}, { [IN + '~1']: unsureItem(1, { st: 'doing' }) });
  await Q.scopeAsk({ db: f, uid: 'U1', now: NOW, ask: async () => ({ ok: true, results: { [IN + '~1']: { scope: 'work' } } }) });
  const x = items(f)[IN + '~1'];
  assert.equal(x.st, 'doing'); assert.equal(x.scope, 'work'); assert.ok(!x.autoIgnored);
});
test('물은 사이 사람이 상태를 바꿨으면 그 최신 값을 지킨다(transaction)', async () => {
  const f = dbWith({}, { [IN + '~1']: unsureItem(1) });
  await Q.scopeAsk({ db: f, uid: 'U1', now: NOW, ask: async () => {
    await f.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~1'], 'done', NOW + 1));     // 답을 기다리는 사이 사람이 «처리 완료»
    return { ok: true, results: { [IN + '~1']: { scope: 'work' } } };
  } });
  assert.equal(items(f)[IN + '~1'].st, 'done', '사람이 정한 상태를 되돌리지 않는다');
});
test('Jev 가 못 답하면(던지면) 아무것도 안 바뀌고 까닭만 돌려준다 · 모르는 답은 쓰지 않는다', async () => {
  const f = dbWith({}, { [IN + '~1']: unsureItem(1), [IN + '~2']: unsureItem(2) });
  const before = JSON.stringify(items(f));
  const r = await Q.scopeAsk({ db: f, uid: 'U1', now: NOW, ask: async () => { throw new Error('오늘 쓸 수 있는 건수를 다 썼습니다'); } });
  assert.equal(JSON.stringify(items(f)), before, '상태·딱지가 그대로'); assert.deepEqual(r.errors, ['오늘 쓸 수 있는 건수를 다 썼습니다']); assert.equal(r.asked, 0);
  const r2 = await Q.scopeAsk({ db: f, uid: 'U1', now: NOW, ask: async () => ({ ok: true, results: { [IN + '~1']: { scope: '아무말' }, [IN + '~2']: null } }) });
  assert.equal(r2.asked, 0); assert.equal(items(f)[IN + '~1'].scope, 'unsure', '모르는 답은 쓰지 않는다');
  assert.equal(items(f)[IN + '~1'].scopeTry, 1, '못 받은 횟수만 적는다(두 번까지만 다시 묻는다)');
});
test('한 번에 묻는 건수에 한도가 있고, 창보다 옛 건은 안 묻는다 · 두 번 못 받은 건은 그만 묻는다', async () => {
  const many = {}; for (let n = 1; n <= Q.JEV_MAX + 5; n++) many[IN + '~' + n] = unsureItem(n, { d: NOW - n * 1000 });
  many[IN + '~900'] = unsureItem(900, { d: NOW - 60 * DAY });                    // 창보다 옛것
  many[IN + '~901'] = unsureItem(901, { scopeTry: 2 });                          // 두 번 못 받았다
  const f = dbWith({}, many); let sent = null;
  await Q.scopeAsk({ db: f, uid: 'U1', now: NOW, ask: async (list) => { sent = list; return { ok: true, results: {} }; } });
  assert.equal(sent.length, Q.JEV_MAX); assert.ok(!sent.some((x) => /~90[01]$/.test(x.id)));
});
test('ask 가 없거나 로그인 전이면 아무것도 안 한다(던지지 않는다)', async () => {
  const f = dbWith({}, { [IN + '~1']: unsureItem(1) });
  assert.deepEqual(await Q.scopeAsk({ db: f, uid: 'U1', now: NOW }), { asked: 0, work: 0, personal: 0, unsure: 0, errors: [] });
  assert.equal((await Q.scopeAsk({ db: null, uid: '', ask: async () => ({}) })).asked, 0);
});

/* ── 화면 ── */
test('딱지는 «자동으로 치운 건»에만 — 규칙이 한 일과 Jev 가 한 일을 같은 값처럼 적지 않는다', () => {
  assert.equal(Q.scopeMark({ st: 'ignored' }), null, '사람이 치운 건에는 안 붙인다');
  const a = Q.scopeMark({ st: 'ignored', autoIgnored: 1, scopeBy: 'rule', scopeWhy: '업무 말 제목 «보고서»' });
  const b = Q.scopeMark({ st: 'ignored', autoIgnored: 1, scopeBy: 'jev', scopeWhy: 'Jev 가 «업무»으로 봤다' });
  assert.match(a.title, /^규칙가/); assert.match(b.title, /^Jev가/); assert.match(a.title, /되돌릴 수/);
});
test('화면: 훑은 뒤 Jev 를 돌리고, 켜고 끄는 단추·자동 제외 딱지·쉬는 표시가 있고, 실패하면 30분 쉰다', () => {
  assert.ok(/await KcareerMailReq\.scan\([\s\S]*?await mrJevRun\(\)/.test(kc), '훑기 뒤에 Jev 단계');
  assert.match(kc, /function mrJevToggle\(/); assert.match(kc, /onclick="mrJevToggle\(\)"/);
  const rowFn = kc.slice(kc.indexOf('function mrRowHtml('), kc.indexOf('/* 지금 탭에서 «보이는» 줄'));
  assert.match(rowFn, /Q\.scopeMark\(x\)[\s\S]*?x\.st==='ignored'[\s\S]*?mr-chip ignored" title="'\+escapeHtml\(sm\.title\)\+'">'\+escapeHtml\(sm\.text\)/, '목록 줄(상태 칸)에 자동 제외 딱지 — 치운 건에만, 까닭은 title');
  assert.match(kc, /if\(r\.errors\.length\)\{ mrLocal\('jevPause', String\(Date\.now\(\)\+30\*60\*1000\)\)/, '못 받았다고 알리면 한동안 쉰다');
  assert.match(kc, /catch\(e\)\{ mrLocal\('jevPause', String\(Date\.now\(\)\+30\*60\*1000\)\)/, '던져도 한동안 쉰다');
  assert.match(kc, /BIZ_MB_FN\+'mailReqScope'/, '서버 함수 이름');
  assert.ok(kc.indexOf("mrLocal('jev')!=='0'") >= 0, '켜짐이 기본 — 이 기기에서 끈다');
  assert.match(kc, /ask:mrJevCall/);
});
test('모듈: 본문·보낸이 주소·제목까지 Jev 길로 내보내지 않는다 — scopeAsk 가 서버에 주는 칸은 id 뿐', () => {
  const fn = mod.slice(mod.indexOf('async function scopeAsk('), mod.indexOf('/* 본문을 열어 기한'));
  assert.ok(fn.length > 200 && fn.indexOf('async function enrich') < 0, '자른 범위가 scopeAsk 하나뿐이다');
  assert.match(fn, /env\.ask\(todo\.map\(function \(x\) \{ return \{ id: x\.id \}; \}\)\)/);
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/replyTo|x\.e\b|x\.f\b|bodyOf|readBody/.test(code), 'scopeAsk 가 보낸이·본문을 만지지 않는다');
});

/* ── 검토 지적 반영 (2026-11-15) ── */
test('사람이 상태를 바꾸면 «기계가 치웠다» 표시(autoIgnored)가 지워진다 — 되돌린 건이 자동 제외로 계속 세지거나, 사람이 다시 치운 것이 기계가 한 것처럼 보이지 않게', async () => {
  const f = dbWith({}, { [IN + '~1']: OLD(IN + '~1', 'ignored', '고객사 보고서 수정 요청의 건', { scope: 'work', scopeBy: 'rule', autoIgnored: NOW - 3600e3 }) });
  assert.ok(Q.scopeMark(items(f)[IN + '~1']), '처음에는 자동 제외 딱지');
  await f.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~1'], 'doing', NOW));          // 사람이 ↩ 되돌림
  assert.ok(!items(f)[IN + '~1'].autoIgnored, '되돌리면 표시가 지워진다');
  await f.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~1'], 'ignored', NOW + 1));   // 사람이 다시 «요청 아님»
  const x = items(f)[IN + '~1'];
  assert.equal(x.st, 'ignored'); assert.equal(Q.scopeMark(x), null, '사람이 치운 것에 «자동 제외» 딱지가 다시 붙지 않는다');
  assert.equal(x.scope, 'work', '범위 딱지(왜 업무로 봤는지)는 남는다');
});
test('화면: 자동 제외 건수는 «지금도 기계가 치운 채인 건»만 센다 · 알리는 순간 상태를 다시 본다 · 까닭이 팝업과 글자로도 보인다', () => {
  const line = kc.slice(kc.indexOf('function mrJevLine('), kc.indexOf('function mrRowHtml('));
  assert.match(line, /x\.autoIgnored && x\.st==='ignored'/, '되돌린 건은 세지 않는다');
  assert.match(line, /String\(_mr\.jevMsg\)\.slice\(0,60\)/, '쉬는 까닭이 마우스를 올리지 않아도 글자로 보인다');
  assert.ok(/_mr\.freshQ\.map\(function\(x\)\{ return \(_mr\.items&&_mr\.items\[x\.id\]\)\|\|x; \}\)\.filter\(function\(x\)\{ return x\.st==='new'; \}\)/.test(kc),
    '1.5초 뒤 알릴 때 그 사이 업무로 치운 건을 거른다');
  const det = kc.slice(kc.indexOf('function mrDetRender('), kc.indexOf('async function mrDetLoadBody('));
  assert.match(det, /행\('자동 제외', escapeHtml\(sm\.title\)\)/, '팝업에도 자동 제외 까닭을 글자로');
});
