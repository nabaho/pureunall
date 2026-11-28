/* 경력관리 «요청 메일» 범위 — «이력서·경력·회의·비용»만 들이고 나머지는 걸러 둔다 (대표 지시 2026-11-15 · 2026-11-19 «아예 안 들임»)
   ⚠ 메일은 모두 지어낸 것이다(저장소가 공개 — 실제 기관·사람 이름을 쓰지 않는다). 주소는 example.org 만.
   ⚠ 예외 하나 — «푸른노무법인»은 이 저장소 주인(법인) 자신의 이름이고 규칙의 열쇠말(제목의 «[푸른노무법인]» 이름표 = 법인이 고객에게 보낸 업무 메일의 답장)이라 시험에 그대로 쓴다.
     고객·다른 기관의 이름이 아니다(2026-11-15 검토에서 «실제 기관명»으로 지적되어 사유를 적어 둔다).
   ⚠ 실제 요청 메일 64건(2026-11-19)으로 잰 숫자는 이 PC 안에서만 계산했고, 실제 제목은 여기 넣지 않는다.
   못 박는 것(규칙이지 «지금 값»이 아니다):
     ① 말 목록 — 개인 말만 있으면 personal, 업무 말만 있으면 work, 둘 다/둘 다 없으면 unsure.
        기관 이름이 «위원회»·«수당»을 품어도 고객 업무(노동위원회·징계위원회·주휴수당 …)면 개인 말로 치지 않는다 · 위원 활동의 «주제»(괴롭힘 …)는 업무 말이 아니다
     ② personal 이 아니면 «새 요청»을 처음부터 걸러 둔다(ignored + autoIgnored) — 진행 중·알림에 안 센다 · 사람이 만진 건의 상태는 그대로
     ③ 🧠 Laya 는 «의견»만 적는다 — 제목·첨부 이름만 이 PC(127.0.0.1)로 보내고, 상태·범위·걸러냄 표시를 절대 안 바꾼다
     ④ 대표 판단과 맞는 비율은 «사람이 정한 건»만 센다 */
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
test('회의·위원·비용 말 — 위원 활동과 묶인 회의만(자문회의·운영위원회), 맨 «회의 일정»·«참석 요청»은 아니다', () => {
  assert.equal(scope('자문회의 개최 안내 및 참석 요청'), 'personal');
  assert.equal(scope('제3차 운영위원회 개최 안내(서면 참석 가능)'), 'personal');
  assert.equal(scope('위원 수당 지급을 위한 신분증 사본 요청'), 'personal');
  assert.equal(scope('[가나재단] 컨설턴트 이력카드 갱신 안내'), 'personal');
  assert.notEqual(scope('회의 일정 공유'), 'personal', '맨 회의 말 — 고객 회의·내부 공유까지 들어온다');
  assert.notEqual(scope('가나협의회 참석 요청'), 'personal');
});
test('기관 이름이 «위원회»·«수당»을 품어도 고객 업무면 개인 말이 아니다 — 진짜 위원 일은 «위촉»·«공익위원» 말로 들어온다', () => {
  ['가나지방노동위원회 부당해고 구제신청 이유서 검토 요청', '산업안전보건위원회 회의록 검토 요청', '징계위원회 개최 관련 자료 송부',
    '고충처리위원회 운영 규정 검토', '주휴수당 및 연장근로수당 계산 자료 요청', '노동 위원회 사건 자료']
    .forEach((s) => assert.notEqual(scope(s), 'personal', s));
  assert.equal(scope('가나지방노동위원회 공익위원 위촉 관련 이력서 제출'), 'personal', '노동위원회라도 «위원 위촉»은 대표 본인 일');
  assert.equal(scope('산업안전보건 분야 평가위원 위촉 안내'), 'personal');
});
test('업무 말은 «고객 일의 행위·서류»만 — 위원 활동의 «주제»(괴롭힘 …)는 업무 말이 아니다', () => {
  assert.equal(scope('직장 내 괴롭힘 판단 전문위원회 서약서 제출'), 'personal', '실제 처리 완료 건이 «괴롭힘» 한 말에 걸러진 적이 있다(2026-11-19)');
  ['부당해고 구제신청 답변서 작성 자료', '연차휴가 사용촉진 통지서 양식 요청드립니다', '임금체불 진정 사건', '컨설팅 킥오프 회의 개최 안내']
    .forEach((s) => assert.notEqual(scope(s), 'personal', s));
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
  const probe = ['이력서', '프로필', '위촉', '심의', '서약서', '지급확인서', '수당', '강사료', '자문회의', '위원회', '보고서', '노동청', '급여', '근로계약서', '취업규칙', '산재', '구제신청', '주휴수당'];
  probe.forEach((w) => assert.ok(!(Q.SCOPE_PERSONAL.test(w) && Q.SCOPE_WORK.test(w)), '«' + w + '» 가 양쪽에 걸린다'));
  assert.ok(Q.SCOPES.indexOf('unsure') >= 0 && Q.SCOPES.length === 3);
});

/* ── ② 새 건 만들기·훑기 — personal 만 들인다 ── */
const IN = 'INBOX-a1b2c3d4';
const mkRow = (o) => Object.assign({ s: '[가나컨설팅] 결과보고서 양식 제출 요청의 건', an: ['결과보고서 양식.hwp'], p: '안녕하세요 담당자입니다 양식을 작성하여 제출해 주세요', f: '가나컨설팅', e: 'work@example.org', a: 1, d: at(11, 14, 13), r: 0, w: 0 }, o || {});
function dbWith(rows, extraItems) {
  const msgs = { [IN]: {} };
  Object.keys(rows).forEach((k) => { msgs[IN][k] = rows[k]; });
  return 만들기({ mailbox: { folders: { [IN]: { kind: 'inbox', name: '받은메일함' } }, msgs }, kcareer: { U1: { mailreq: { items: extraItems || {} } } } });
}
const items = (f) => f.읽기('kcareer/U1/mailreq/items') || {};
const scan = (f, o) => Q.scan(Object.assign({ db: f, uid: 'U1', now: NOW }, o || {}));

test('업무 말만 있는 요청 메일은 처음부터 걸러 둔다 — 알림·진행 중에 안 센다(기록은 남는다)', async () => {
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
test('★ 애매한 요청 메일(이력·회의·비용 말이 없거나 업무 말과 섞임)도 들이지 않고 걸러 둔다 — 대표 지시 «아예 안 들임»', async () => {
  const f = dbWith({ 103: mkRow({ s: '서류 제출 요청드립니다', an: ['제출 양식.hwp'] }), 104: mkRow({ s: '근로자 명부 및 이력서 제출 요청', an: [] }) });
  await scan(f);
  [IN + '~103', IN + '~104'].forEach((id) => {
    const x = items(f)[id];
    assert.equal(x.st, 'ignored', id); assert.equal(x.scope, 'unsure'); assert.ok(x.autoIgnored > 0); assert.ok(Q.scopeMark(x), '자동으로 걸렀다는 딱지');
  });
  assert.equal(Q.summary(items(f), NOW).alarm, 0);
});
test('회의·위원·비용 메일은 서류 말이 없어도 들인다 — 종류는 🗓 회의·위원 / 💰 비용', async () => {
  const f = dbWith({
    105: mkRow({ s: '자문위원 회의 일정 안내 및 참석 여부 회신 요청', an: [], p: '' }),
    106: mkRow({ s: '회의비 및 교통비 지급을 위한 서류 요청', an: [], p: '' }),
    107: mkRow({ s: '회의 일정 공유', an: [], p: '내일 회의입니다' }),
  });
  await scan(f);
  assert.deepEqual(items(f)[IN + '~105'].kinds, ['meeting']); assert.equal(items(f)[IN + '~105'].st, 'new');
  assert.deepEqual(items(f)[IN + '~106'].kinds, ['fee']); assert.equal(items(f)[IN + '~106'].st, 'new');
  assert.ok(!(IN + '~107' in items(f)), '맨 회의 말은 요청이 아니다');
  assert.ok(Q.kindMeta('meeting') && Q.kindMeta('fee'), '화면이 이름·아이콘을 안다');
});

/* ── ② 옛 건 한 번 가르기(backfill) ── */
const OLD = (id, st, s, extra) => Object.assign({ id, entityType: 'kcareer_mailreq', createdAt: NOW - DAY, updatedAt: NOW - DAY, slug: IN, uid: id.split('~')[1], kinds: ['other'], st, s, f: '가나', e: 'a@example.org', d: NOW - DAY, an: [], why: [] }, extra || {});
test('범위가 없는 옛 건을 한 번 가른다 — personal 이 아닌 «새 요청»만 걸러 두고, 사람이 만진 건은 상태 그대로', async () => {
  const f = dbWith({}, {
    [IN + '~1']: OLD(IN + '~1', 'new', '고객사 보고서 수정 요청의 건'),
    [IN + '~2']: OLD(IN + '~2', 'doing', '고객사 보고서 수정 요청의 건'),
    [IN + '~3']: OLD(IN + '~3', 'done', '고객사 보고서 수정 요청의 건'),
    [IN + '~4']: OLD(IN + '~4', 'new', '위원 활동 확인서 제출 요청'),
    [IN + '~5']: OLD(IN + '~5', 'new', '서류 제출 요청드립니다'),
  });
  const r = await scan(f);
  const it = items(f);
  assert.equal(it[IN + '~1'].st, 'ignored'); assert.equal(it[IN + '~1'].scope, 'work'); assert.ok(it[IN + '~1'].autoIgnored);
  assert.equal(it[IN + '~2'].st, 'doing', '확인함으로 둔 건은 사람이 정한 것 — 상태를 안 바꾼다'); assert.equal(it[IN + '~2'].scope, 'work', '딱지는 붙는다');
  assert.equal(it[IN + '~3'].st, 'done'); assert.ok(!it[IN + '~3'].autoIgnored);
  assert.equal(it[IN + '~4'].st, 'new'); assert.equal(it[IN + '~4'].scope, 'personal');
  assert.equal(it[IN + '~5'].st, 'ignored', '애매한 새 요청도 걸러 둔다'); assert.equal(it[IN + '~5'].scope, 'unsure');
  assert.equal(r.scoped, 5); assert.equal(r.autoIgnored, 2);
});
test('이미 범위가 있는 건은 다시 안 가른다(사람이 되돌린 건을 또 거르지 않는다)', async () => {
  const f = dbWith({}, { [IN + '~1']: OLD(IN + '~1', 'doing', '고객사 보고서 수정 요청의 건', { scope: 'work', scopeBy: 'rule', autoIgnored: NOW - 3600e3 }) });
  const r1 = await scan(f); const before = JSON.stringify(items(f)[IN + '~1']);
  const r2 = await scan(f);
  assert.equal(items(f)[IN + '~1'].st, 'doing', '되돌린(확인함) 건을 스캔이 다시 거르지 않는다');
  assert.equal(JSON.stringify(items(f)[IN + '~1']), before); assert.equal(r1.scoped || 0, 0); assert.equal(r2.scoped || 0, 0);
});

/* ── ③ 🧠 Laya 의견 ── */
const judged = (n, extra) => OLD(IN + '~' + n, 'new', '평가위원 위촉 안내 ' + n, Object.assign({ scope: 'personal', scopeBy: 'rule', an: ['위촉 동의서.hwp'], d: NOW - n * 1000, replyTo: 'r@example.org', memo: '메모' }, extra || {}));
test('Laya 길에는 «건 번호·제목·첨부 이름»만 간다 — 보낸이·주소·회신 주소·메모·본문은 안 간다', async () => {
  const f = dbWith({}, { [IN + '~1']: judged(1, { an: ['a.hwp', 'b.hwp', 'c.hwp', 'd.hwp'] }) });
  let sent = null;
  await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask: async (list) => { sent = list; return { ok: true, results: {} }; } });
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0]).sort(), ['an', 's', 'id'].sort());
  assert.equal(sent[0].an.length, 3, '첨부 이름은 셋까지');
  assert.ok(!JSON.stringify(sent).includes('example.org') && !JSON.stringify(sent).includes('메모'));
});
test('★ Laya 는 «의견»만 적는다 — 업무라 해도 상태·범위·걸러냄 표시를 바꾸지 않는다', async () => {
  const f = dbWith({}, { [IN + '~1']: judged(1), [IN + '~2']: judged(2, { st: 'ignored', autoIgnored: NOW - 1, scope: 'unsure' }) });
  const before = JSON.parse(JSON.stringify(items(f)));
  const r = await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask: async () => ({ ok: true, results: { [IN + '~1']: { v: 'work', p: 0.93 }, [IN + '~2']: { v: 'personal', p: 0.12 } } }) });
  const it = items(f);
  ['st', 'scope', 'scopeBy', 'autoIgnored', 'kinds', 'updatedAt'].forEach((k) => {
    assert.deepEqual(it[IN + '~1'][k], before[IN + '~1'][k], k); assert.deepEqual(it[IN + '~2'][k], before[IN + '~2'][k], k);
  });
  assert.deepEqual(it[IN + '~1'].laya, { v: 'work', p: 0.93, at: NOW }); assert.equal(it[IN + '~2'].laya.v, 'personal');
  assert.deepEqual([r.asked, r.work, r.personal], [2, 1, 1]);
  let again = 0;
  await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask: async () => { again++; return { ok: true, results: {} }; } });
  assert.equal(again, 0, '의견을 받은 건은 다시 안 묻는다 — 물을 것이 없으면 부르지도 않는다');
});
test('Laya 가 못 답하면(던지면) 아무것도 안 바뀐다 · 모르는 답·범위 밖 확률은 쓰지 않고 못 받은 횟수만 적는다', async () => {
  const f = dbWith({}, { [IN + '~1']: judged(1), [IN + '~2']: judged(2), [IN + '~3']: judged(3) });
  const before = JSON.stringify(items(f));
  const r = await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask: async () => { throw new Error('이 PC 의 Laya 판단기에 닿지 못했습니다'); } });
  assert.equal(JSON.stringify(items(f)), before); assert.equal(r.errors.length, 1); assert.equal(r.asked, 0);
  await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask: async () => ({ ok: true, results: { [IN + '~1']: { v: '아무말', p: 0.5 }, [IN + '~2']: { v: 'work', p: 7 }, [IN + '~3']: null } }) });
  [1, 2, 3].forEach((n) => { assert.ok(!items(f)[IN + '~' + n].laya, n + ' 은 쓰지 않는다'); assert.equal(items(f)[IN + '~' + n].layaTry, 1); });
  /* 확률이 숫자가 아니면(null·''·false·'0.5') 0% 로 받아들이지 않는다 — Number(null) 은 0 이다(2026-11-19 검토) */
  const g = dbWith({}, { [IN + '~4']: judged(4), [IN + '~5']: judged(5), [IN + '~6']: judged(6), [IN + '~7']: judged(7) });
  await Q.layaAsk({ db: g, uid: 'U1', now: NOW, ask: async () => ({ ok: true, results: { [IN + '~4']: { v: 'work', p: null }, [IN + '~5']: { v: 'work', p: '' }, [IN + '~6']: { v: 'personal', p: false }, [IN + '~7']: { v: 'work', p: '0.5' } } }) });
  [4, 5, 6, 7].forEach((n) => assert.ok(!g.읽기('kcareer/U1/mailreq/items')[IN + '~' + n].laya, n + ' — 숫자가 아닌 확률은 쓰지 않는다'));
  assert.ok(!/0%/.test(Q.layaMark({ laya: { v: 'work', p: null } }).title), '숫자가 아니면 확률을 적지 않는다');
  for (let k = 0; k < 3; k++) await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask: async () => ({ ok: true, results: {} }) });
  let asked = 0; await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask: async (l) => { asked = l.length; return { ok: true, results: {} }; } });
  assert.equal(asked, 0, 'LAYA_TRY 번 못 받은 건은 그만 묻는다');
});
test('Laya — 답을 기다리는 사이 지워진 건은 되살리지 않는다 · 한 번에 묻는 건수에 한도가 있다(최근 것부터)', async () => {
  const f = dbWith({}, { [IN + '~1']: judged(1) });
  await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask: async () => { await f.ref('kcareer/U1/mailreq/items/' + IN + '~1').set(null); return { ok: true, results: { [IN + '~1']: { v: 'work', p: 0.9 } } }; } });
  assert.ok(!(IN + '~1' in items(f)), '지워진 건이 의견 한 칸으로 되살아나면 안 된다');
  const many = {}; for (let n = 1; n <= Q.LAYA_MAX + 7; n++) many[IN + '~' + n] = judged(n);
  const g = dbWith({}, many); let sent = null;
  await Q.layaAsk({ db: g, uid: 'U1', now: NOW, ask: async (l) => { sent = l; return { ok: true, results: {} }; } });
  assert.equal(sent.length, Q.LAYA_MAX); assert.equal(sent[0].id, IN + '~1', '받은 시각이 늦은(최근) 것부터');
  assert.deepEqual(await Q.layaAsk({ db: g, uid: 'U1', now: NOW }), { asked: 0, work: 0, personal: 0, errors: [] }, 'ask 가 없으면 아무것도 안 한다');
});
test('대표 판단과 맞는 비율은 «사람이 정한 건»만 센다 — 기계가 걸러 둔 채인 건·의견 없는 건은 빼고', () => {
  const xs = [
    { st: 'done', laya: { v: 'personal' } }, { st: 'doing', laya: { v: 'work' } },                 // 들일 것 2 — 1 맞음
    { st: 'ignored', laya: { v: 'work' } }, { st: 'ignored', laya: { v: 'personal' } },             // 사람이 치움 2 — 1 맞음
    { st: 'ignored', autoIgnored: 1, laya: { v: 'work' } },                                          // 기계가 거른 채 — 정답 아님
    { st: 'new', laya: { v: 'work' } }, { st: 'done' }, { st: 'done', laya: { v: '이상' } },
  ];
  assert.deepEqual(Q.layaAgree(xs), { n: 4, same: 2, keepN: 2, keepSame: 1, dropN: 2, dropSame: 1 });
  const m = Q.layaMark({ laya: { v: 'work', p: 0.81 } });
  assert.match(m.text, /Laya 의견/); assert.match(m.title, /81%/); assert.match(m.title, /상태를 바꾸지 않습니다/); assert.ok(m.short.length <= 8, '목록 칸에는 짧게');
  assert.equal(Q.layaMark({ laya: { v: '?' } }), null); assert.equal(Q.layaMark({}), null);
});
test('모듈: Laya 단계는 st·scope·autoIgnored 를 쓰지 않는다 · 보낼 칸은 layaPayload 한 곳', () => {
  const fn = mod.slice(mod.indexOf('async function layaAsk('), mod.indexOf('function layaAgree('));
  assert.ok(fn.length > 200 && fn.indexOf('function enrich') < 0, '자른 범위가 layaAsk 하나뿐이다');
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/c\.st\s*=|c\.scope\s*=|c\.autoIgnored\s*=|c\.scopeBy\s*=/.test(code), 'Laya 단계가 상태·범위를 바꾸면 안 된다');
  assert.match(code, /env\.ask\(todo\.map\(layaPayload\)\)/);
  assert.ok(!/replyTo|x\.e\b|x\.f\b|bodyOf|readBody|memo/.test(code), '보낸이·본문·메모를 만지지 않는다');
});

/* ── 화면 ── */
test('딱지는 «자동으로 거른 건»에만 — 규칙이 한 일과 (옛) Jev 가 한 일을 같은 값처럼 적지 않는다', () => {
  assert.equal(Q.scopeMark({ st: 'ignored' }), null, '사람이 치운 건에는 안 붙인다');
  const a = Q.scopeMark({ st: 'ignored', autoIgnored: 1, scopeBy: 'rule', scopeWhy: '업무 말 제목 «보고서»' });
  const b = Q.scopeMark({ st: 'ignored', autoIgnored: 1, scopeBy: 'jev', scopeWhy: 'Jev 가 «업무»으로 봤다' });
  assert.match(a.title, /^규칙이 /, '받침에 맞춘 조사'); assert.match(b.title, /^Jev가 /); assert.match(a.title, /되돌릴 수/);
});
test('화면: 훑은 뒤 Laya 의견을 묻고(켠 기기에서만 · 꺼짐이 기본), 이 PC(127.0.0.1)로만 보내고, 못 닿으면 10분 쉰다 · Jev 는 부르지 않는다', () => {
  const scanFn = kc.slice(kc.indexOf('async function mrScan('), kc.indexOf('function mrScanNow('));
  assert.ok(/await KcareerMailReq\.scan\([\s\S]*?finally\{ _mr\.busy=false; mrRender\(\); \}\s*[\s\S]*?mrLayaRun\(\)\.then\(/.test(scanFn), '훑기가 «끝난 뒤»(busy 를 푼 뒤) Laya 단계 — 판단을 기다리느라 «지금 확인» 단추가 묶이지 않게');
  assert.ok(!/await mrLayaRun\(\)/.test(scanFn), '훑기가 Laya 를 기다리지 않는다');
  assert.match(kc, /if\(_mr\.layaBusy \|\| !mrLayaOn\(\)/, '겹쳐 돌지 않는다'); assert.match(kc, /finally\{ _mr\.layaBusy=false; \}/);
  assert.match(kc, /function mrLayaToggle\(/); assert.match(kc, /onclick="mrLayaToggle\(\)"/);
  assert.ok(kc.indexOf("function mrLayaOn(){ return mrLocal('laya')==='1'; }") >= 0, '꺼짐이 기본 — 판단기가 없는 폰·다른 PC 에서 «이 기기의 다른 앱 접근»을 묻지 않게');
  assert.match(kc, /'http:\/\/127\.0\.0\.1:'\+/, '받는 곳은 이 PC 안');
  assert.match(kc, /mrLocal\('layaPause', String\(Date\.now\(\)\+10\*60\*1000\)\)/);
  assert.match(kc, /ask:mrLayaCall/);
  const call = kc.slice(kc.indexOf('async function mrLayaCall('), kc.indexOf('async function mrLayaRun('));
  assert.ok(!/Authorization|getIdToken/.test(call), '이 PC 판단기에 로그인 열쇠를 보내지 않는다');
  assert.ok(!/mrJevRun\(|scopeAsk\(|'mailReqScope'/.test(kc), '화면이 Jev 단계를 부르지 않는다(애매한 건은 처음부터 걸러진다)');
});
test('화면: 걸러 둔 건수는 «지금도 기계가 거른 채인 건»만 센다 · 알리는 순간 상태를 다시 본다 · 까닭과 Laya 의견이 팝업에 글자로도 보인다', () => {
  const line = kc.slice(kc.indexOf('function mrLayaLine('), kc.indexOf('function mrRowHtml('));
  assert.match(line, /x\.autoIgnored && x\.st==='ignored'/, '되돌린 건은 세지 않는다');
  assert.match(line, /String\(_mr\.layaMsg\)\.slice\(0,60\)/, '쉬는 까닭이 마우스를 올리지 않아도 글자로 보인다');
  assert.match(line, /Q\.layaAgree\(_mr\.items\)/, '대표 판단과 맞는 비율을 센다');
  assert.ok(/_mr\.freshQ\.map\(function\(x\)\{ return \(_mr\.items&&_mr\.items\[x\.id\]\)\|\|x; \}\)\.filter\(function\(x\)\{ return x\.st==='new'; \}\)/.test(kc),
    '1.5초 뒤 알릴 때 그 사이 걸러진 건을 거른다');
  const det = kc.slice(kc.indexOf('function mrDetRender('), kc.indexOf('async function mrDetLoadBody('));
  assert.match(det, /행\('자동 걸러냄', escapeHtml\(sm\.title\)\)/, '팝업에도 걸러낸 까닭을 글자로');
  assert.match(det, /Q\.layaMark\(x\)/, '팝업에 Laya 의견');
});
test('화면: 걸러낸 메일은 «조용한» 탭 — 숫자를 키우는 «전체» 탭은 안 보인다', () => {
  assert.deepEqual(Q.TABS.map((t) => t.key), ['open', 'done', 'ignored']);
  assert.ok(Q.TABS.find((t) => t.key === 'ignored').quiet, '걸러낸 메일은 조용한 단추');
  assert.equal(Q.filterItems([{ st: 'new' }, { st: 'ignored' }], 'all').length, 2, '«전체»는 안 보여도 받는다(옛 화면·검사)');
  assert.match(kc, /\(t\.quiet\?' quiet':''\)/); assert.match(kc, /\.mr-pill\.quiet:not\(\.on\)\{/);
  /* 단추가 하나뿐인 탭은 «관리» 칸을 좁힌다 — 공용 200px 가 걸러낸 메일 탭에서 표를 가로로 밀었다(1280px, 2026-11-19 검토) */
  assert.match(kc, /\(_mr\.tab==='open'\?'':' mr-act1'\)/); assert.match(kc, /#mrBody \.dt\.mr-act1 thead th:last-child\{width:auto;min-width:\d+px\}/);
});
test('화면: 폰에서 글자가 숨는 단추에도 이름이 있다(aria-label) · 팝업 «메일 내용» 제목은 한 줄 (2026-11-19 검토)', () => {
  const rowFn = kc.slice(kc.indexOf('function mrRowHtml('), kc.indexOf('/* 지금 탭에서 «보이는» 줄'));
  assert.match(rowFn, /var 단추=function\(st, 그림, 글, 설명\)\{ return '<button[^>]*aria-label="'\+글\+'"/, '줄 단추');
  const render = kc.slice(kc.indexOf('function mrRender('), kc.indexOf('box.innerHTML=h;', kc.indexOf('function mrRender(')));
  ['mrScanNow()', 'mrLayaToggle()', 'mrNotifyToggle()', 'mrOpenMail()'].forEach((fn) => {
    const at = render.indexOf('onclick="' + fn + '"'); assert.ok(at > 0, fn);
    const tag = render.slice(render.lastIndexOf('<button', at), render.indexOf('>', at));
    assert.match(tag, /aria-label="[^"]+"/, fn + ' 단추에 이름');
  });
  assert.match(kc, /<b style="font-size:13px;white-space:nowrap">메일 내용<\/b>/);
});

/* ── 검토 지적 반영 (2026-11-15) ── */
test('사람이 상태를 바꾸면 «기계가 걸렀다» 표시(autoIgnored)가 지워진다 — 되돌린 건이 계속 세지거나, 사람이 다시 치운 것이 기계가 한 것처럼 보이지 않게', async () => {
  const f = dbWith({}, { [IN + '~1']: OLD(IN + '~1', 'ignored', '고객사 보고서 수정 요청의 건', { scope: 'work', scopeBy: 'rule', autoIgnored: NOW - 3600e3 }) });
  assert.ok(Q.scopeMark(items(f)[IN + '~1']), '처음에는 자동 걸러냄 딱지');
  await f.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~1'], 'doing', NOW));          // 사람이 ↩ 되돌림
  assert.ok(!items(f)[IN + '~1'].autoIgnored, '되돌리면 표시가 지워진다');
  await f.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~1'], 'ignored', NOW + 1));   // 사람이 다시 «요청 아님»
  const x = items(f)[IN + '~1'];
  assert.equal(x.st, 'ignored'); assert.equal(Q.scopeMark(x), null, '사람이 치운 것에 «자동» 딱지가 다시 붙지 않는다');
  assert.equal(x.scope, 'work', '범위 딱지(왜 업무로 봤는지)는 남는다');
});

/* ── 법인에 «지원하는 사람»의 메일(수습노무사 지원 등)은 요청 메일이 아니다 (대표 지시 2026-11-23) ──
   ⚠ 제목·이름은 모두 지어낸 것이다(홍길동·김가나) — 저장소가 공개, 실제 지원자 이름을 넣지 않는다. */
test('★ 수습노무사 지원 메일은 이력서·경력 서류를 첨부해도 «업무»로 거른다 — 첨부 이름의 «이력서» 말에 개인으로 들어오지 않는다', () => {
  const 이력 = ['이력서_홍길동.pdf', '자기소개서_홍길동.pdf', '자격증 사본.pdf'];
  ['노무사 지원(수습)_홍길동', '수습노무사 지원합니다 - 김가나', '[지원] 노무사 수습 채용 지원 건', '입사 지원_홍길동(경력 3년)', '인턴 지원합니다_김가나', '노무사 지원 (수습) 홍길동']
    .forEach((s) => {
      const r = Q.scopeOf({ s, an: 이력 });
      assert.equal(r.scope, 'work', s); assert.ok(r.why.length > 0 && r.why[0].length > 0, '왜 걸렀는지 적는다');
    });
  assert.equal(scope('이력서 보냅니다', 이력), 'personal', '제목에 지원 말이 없으면 첨부 이름만으로는 거르지 않는다(규칙은 제목만 본다)');
});
test('지원 말은 «지원하는 쪽»으로 좁다 — 지원 사업·대표가 지원하는 쪽·수습 교육 강사 위촉은 그대로 개인 말로 들어온다', () => {
  assert.equal(scope('노무사 지원 사업 컨설턴트 이력서 제출 안내'), 'personal', '«지원 사업»은 지원금 제도다');
  assert.equal(scope('노무사 지원센터 자문위원 위촉 안내'), 'personal');
  assert.equal(scope('[가나재단] 자문위원 지원 접수 안내 — 위촉 신청서 제출'), 'personal', '대표가 지원하는 쪽');
  assert.equal(scope('수습노무사 직무교육 강사 위촉 안내'), 'personal', '수습 말이 있어도 지원이 아니면 걸리지 않는다');
  assert.equal(scope('이력서 제출 요청', ['노무사 지원(수습)_홍길동.pdf']), 'personal', '첨부 이름의 지원 말은 안 본다 — 대표 본인이 낸 지원서일 수 있다');
  const probe = ['이력서', '프로필', '위촉', '심의', '서약서', '지급확인서', '수당', '강사료', '자문회의', '위원회', '경력증명서', '재직증명서'];
  probe.forEach((w) => assert.ok(!Q.SCOPE_RECRUIT.test(w), '«' + w + '» 가 지원 말에 걸린다'));
});
test('새로 온 수습노무사 지원 메일은 처음부터 걸러 둔다 — 진행 중·알림에 안 센다(기록은 남아 걸러낸 메일에서 되돌릴 수 있다)', async () => {
  const f = dbWith({ 201: mkRow({ s: '노무사 지원(수습)_홍길동', an: ['이력서_홍길동.pdf', '경력기술서.pdf'], p: '안녕하세요 수습노무사로 지원합니다 이력서를 첨부합니다', f: '홍길동', e: 'a@example.org' }) });
  await scan(f);
  const x = items(f)[IN + '~201'];
  assert.ok(x, '기록은 남는다'); assert.equal(x.st, 'ignored'); assert.equal(x.scope, 'work'); assert.ok(x.autoIgnored > 0);
  assert.equal(x.scopeV, Q.SCOPE_RULE_V, '어느 판 규칙으로 갈랐는지 적는다');
  const sm = Q.summary(items(f), NOW);
  assert.equal(sm.open, 0); assert.equal(sm.alarm, 0); assert.equal(sm.ignored, 1);
});
test('★ 옛 규칙이 «개인»으로 들인 새 요청도 훑을 때 한 번 다시 가른다 — 이미 목록에 올라와 있던 지원 메일이 치워진다', async () => {
  const f = dbWith({}, {
    [IN + '~1']: OLD(IN + '~1', 'new', '노무사 지원(수습)_홍길동', { scope: 'personal', scopeBy: 'rule', an: ['이력서_홍길동.pdf'] }),
    [IN + '~2']: OLD(IN + '~2', 'new', '위원 활동 확인서 제출 요청', { scope: 'personal', scopeBy: 'rule' }),
    [IN + '~3']: OLD(IN + '~3', 'doing', '노무사 지원(수습)_김가나', { scope: 'personal', scopeBy: 'rule', an: ['이력서_김가나.pdf'] }),
    [IN + '~4']: OLD(IN + '~4', 'done', '노무사 지원(수습)_김가나', { scope: 'personal', scopeBy: 'rule' }),
    [IN + '~5']: OLD(IN + '~5', 'new', '노무사 지원(수습)_홍길동', { scope: 'personal', scopeBy: 'jev' }),
    [IN + '~6']: OLD(IN + '~6', 'new', '노무사 지원(수습)_홍길동', { scope: 'personal', scopeBy: 'rule', scopeV: Q.SCOPE_RULE_V }),
  });
  const r = await scan(f);
  const it = items(f);
  assert.equal(it[IN + '~1'].st, 'ignored'); assert.equal(it[IN + '~1'].scope, 'work'); assert.ok(it[IN + '~1'].autoIgnored); assert.equal(it[IN + '~1'].scopeV, Q.SCOPE_RULE_V);
  assert.equal(it[IN + '~2'].st, 'new', '여전히 개인 말이면 그대로 들인다'); assert.equal(it[IN + '~2'].scopeV, Q.SCOPE_RULE_V, '다시 봤다는 표시만 적는다');
  assert.equal(it[IN + '~3'].st, 'doing', '사람이 확인함으로 둔 건은 안 건드린다'); assert.equal(it[IN + '~3'].scope, 'personal');
  assert.equal(it[IN + '~4'].st, 'done'); assert.equal(it[IN + '~4'].scope, 'personal');
  assert.equal(it[IN + '~5'].st, 'new', 'Jev 가 가른 범위는 규칙이 다시 보지 않는다'); assert.equal(it[IN + '~5'].scopeBy, 'jev');
  assert.equal(it[IN + '~6'].st, 'new', '이미 이 판 규칙으로 가른 건은 다시 안 본다');
  assert.equal(r.autoIgnored, 1, '이번에 거른 것은 하나'); assert.equal(r.scoped || 0, 0, '«처음 가른 건수»에는 안 센다');
  const before = JSON.stringify(items(f));
  const r2 = await scan(f);
  assert.equal(JSON.stringify(items(f)), before, '두 번째 훑기는 아무것도 안 바꾼다'); assert.equal(r2.autoIgnored || 0, 0);
});
test('다시 가르는 길은 한 번에 한도가 있다 · «개인·규칙·새 요청»만 고른다(사람이 만진 건을 고르지 않는다)', () => {
  assert.match(mod, /function rescopable\(x\)[\s\S]{0,400}x\.st === 'new'/, '새 요청만');
  assert.match(mod, /function rescopable\(x\)[\s\S]{0,400}x\.scopeBy === 'rule'/, '규칙이 가른 것만');
  assert.match(mod, /!x\.scope \|\| rescopable\(x\)\)[\s\S]{0,40}\.slice\(0, SCOPE_BACKFILL_MAX\)/, '한도(SCOPE_BACKFILL_MAX) 안에서');
  assert.ok(Number(Q.SCOPE_RULE_V) >= 2, '판 번호는 말 목록을 넓힐 때 올린다');
});

/* ── 검토 지적 반영 (2026-11-23, Orca 보안 검토 중간 2건) ── */
test('★ 기관이 대표에게 보낸 «위촉·위원» 요청은 지원 말이 있어도 거르지 않는다 — 지원 접수 안내·채용 지원센터 이름에 속지 않는다', () => {
  assert.equal(scope('공익노무사 지원 접수 안내 및 자문위원 위촉 서류 제출 요청'), 'personal', '기관의 «지원 접수 안내» + 위촉');
  assert.equal(scope('청년 인턴 채용 지원센터 자문위원 위촉 안내'), 'personal', '«채용 지원센터»는 기관 이름');
  assert.equal(scope('공익노무사 지원 접수 안내', ['이력서 양식.hwp']), 'personal', '지원 «접수 안내»는 기관이 보낸 안내다 — 첨부 이름의 이력서 말로 들어온다');
  assert.equal(scope('수습노무사 지원자 평가위원 위촉 안내'), 'personal', '평가위원 일');
  /* 위원 일 말(예외 말)이 없는 제목에서도 «지원하는 쪽» 말이 아니면 걸리지 않는다 — 예외 말에만 기대지 않는다 */
  assert.equal(scope('수습노무사 직무교육 강사 이력서 제출 요청'), 'personal', '수습 말만으로는 거르지 않는다(지원 말이 있어야)');
  assert.equal(scope('청년 인턴 채용 지원센터 이력서 양식 제출 안내'), 'personal', '«채용 지원센터»는 기관 이름');
  /* 그래도 지원자가 제목에 «이력서»를 적어도(위원 일 말은 안 쓴다) 걸러진다 */
  assert.equal(scope('노무사 지원(수습)_홍길동 이력서 첨부', ['이력서_홍길동.pdf']), 'work');
  assert.equal(scope('입사 지원합니다 경력기술서 첨부', ['경력기술서.pdf']), 'work');
  ['위촉', '위원회', '평가위원', '위원 명단', '심의', '인력풀', '제척', '강사료', '자문료'].forEach((w) => assert.ok(Q.SCOPE_RECRUIT_NOT.test(w), w));
  ['이력서', '프로필', '경력증명서', '서약서', '위원'].forEach((w) => assert.ok(!Q.SCOPE_RECRUIT_NOT.test(w), '«' + w + '» 는 지원자도 제목에 쓴다(맨 말) — 예외 말에 넣으면 지원 메일이 샌다'));
  /* Orca 재검증(2026-11-23): 예외 말이 «맨 서약서·맨 위원»까지 넓었더니 지원자 메일이 개인으로 남았다 */
  assert.equal(scope('수습노무사 지원 서약서 및 이력서 제출', ['이력서_홍길동.pdf']), 'work', '입사 서약서는 지원자도 낸다');
  assert.equal(scope('입사 지원 서약서 제출_김가나', ['서약서.pdf', '이력서.pdf']), 'work');
  assert.equal(scope('노무사 지원(수습) 위원 경력 포함 이력서 첨부', ['이력서.pdf']), 'work', '맨 «위원»은 위원 일이 아니다');
});
test('★ 사람이 직접 고친 «새 요청»은 다시 가르기로 치우지 않는다 — 종류·기한·메모를 고치면 «고쳤다»(edited) 표시가 남는다', async () => {
  const f = dbWith({}, { [IN + '~1']: OLD(IN + '~1', 'new', '노무사 지원(수습)_홍길동', { scope: 'personal', scopeBy: 'rule', an: ['이력서_홍길동.pdf'] }),
                          [IN + '~2']: OLD(IN + '~2', 'new', '노무사 지원(수습)_김가나', { scope: 'personal', scopeBy: 'rule', an: ['이력서_김가나.pdf'] }) });
  await f.ref('kcareer/U1/mailreq/items').update(Q.editUpdate(IN + '~1', { memo: '이 분은 우리 법인 지원자가 아니라 지인 소개' }, NOW).update);   // 사람이 열어 보고 메모를 적음(상태는 새 요청 그대로)
  await scan(f);
  const it = items(f);
  assert.equal(it[IN + '~1'].st, 'new', '사람이 고친 건은 그대로 둔다'); assert.ok(it[IN + '~1'].edited > 0); assert.equal(it[IN + '~1'].scope, 'personal');
  assert.equal(it[IN + '~2'].st, 'ignored', '안 만진 건은 걸러진다');
  assert.match(mod, /function rescopable\(x\)[\s\S]{0,400}!touched\(x\)/, '다시 가르기가 «만진 흔적»(edited 포함)을 본다');
  assert.match(mod, /function touched\(x\)[\s\S]{0,120}x\.edited/, '«고쳤다» 표시(edited)가 만진 흔적에 든다');
});
test('★ 사람이 만진 흔적(edited·옛 판의 fixed·memo)이 있는 «새 요청»은 처음 가를 때도 다시 가를 때도 치우지 않는다 — 범위 딱지만 붙는다', async () => {
  const f = dbWith({}, {
    [IN + '~1']: OLD(IN + '~1', 'new', '노무사 지원(수습)_홍길동', { scope: 'personal', scopeBy: 'rule', fixed: { deadline: 1 }, an: ['이력서_홍길동.pdf'] }),   // 이 판 전에 기한을 직접 고친 건
    [IN + '~2']: OLD(IN + '~2', 'new', '노무사 지원(수습)_김가나', { scope: 'personal', scopeBy: 'rule', memo: '지인 소개', an: ['이력서_김가나.pdf'] }),   // 이 판 전에 메모만 적은 건
    [IN + '~3']: OLD(IN + '~3', 'new', '고객사 보고서 수정 요청의 건', { memo: '확인 필요' }),                                        // 범위가 아직 없는 옛 건 + 메모
    [IN + '~4']: OLD(IN + '~4', 'new', '고객사 보고서 수정 요청의 건', { fixed: { kinds: 1 } }),                                    // 범위가 아직 없는 옛 건 + 종류를 고침
    [IN + '~5']: OLD(IN + '~5', 'new', '고객사 보고서 수정 요청의 건'),                                                            // 안 만진 옛 건 — 걸러진다
    [IN + '~6']: OLD(IN + '~6', 'new', '노무사 지원(수습)_박다라', { scope: 'personal', scopeBy: 'rule', an: ['이력서_박다라.pdf'] }),   // 안 만진 옛 개인 건 — 걸러진다
  });
  await scan(f);
  const it = items(f);
  ['1', '2'].forEach((n) => { assert.equal(it[IN + '~' + n].st, 'new', n + ' — 사람이 만진 건은 그대로'); assert.ok(!it[IN + '~' + n].autoIgnored); });
  ['3', '4'].forEach((n) => { assert.equal(it[IN + '~' + n].st, 'new', n + ' — 처음 가르는 건도 만진 흔적이 있으면 상태를 안 바꾼다'); assert.equal(it[IN + '~' + n].scope, 'work', '딱지는 붙는다'); assert.ok(!it[IN + '~' + n].autoIgnored); });
  ['5', '6'].forEach((n) => { assert.equal(it[IN + '~' + n].st, 'ignored', n + ' — 안 만진 건은 걸러진다'); assert.ok(it[IN + '~' + n].autoIgnored); });
  assert.match(mod, /function touched\(x\)[\s\S]{0,300}x\.memo[\s\S]{0,120}x\.fixed/, '«만진 흔적»은 edited·memo·fixed 를 본다');
  assert.match(mod, /sc\.scope !== 'personal' && c\.st === 'new' && !touched\(c\)/, '처음 가르는 길도 흔적을 본다');
});
test('★ 지원 «결과 통지»와 후속 서류 요청은 지원자 메일이 아니다 — 대표가 지원한 쪽에서 온 요청이 걸러지지 않는다(Orca 재검증 2회차)', () => {
  assert.equal(scope('채용 지원 결과 안내 및 경력증명서 제출 요청'), 'personal', '기관이 보낸 결과 통지 + 서류 요청');
  assert.equal(scope('인턴 지원 합격 안내 및 재직증명서 제출'), 'personal');
  assert.equal(scope('입사 지원 면접 일정 안내 및 경력 확인서 제출 요청'), 'personal');
  assert.equal(scope('노무사 지원(수습)_홍길동', ['이력서_홍길동.pdf']), 'work', '지원자가 보낸 제목은 그대로 걸러진다');
  assert.equal(scope('노무사 지원 결과 안내 및 경력증명서 제출 요청'), 'personal', '«노무사 지원» 갈래도 같다');
  ['결과', '합격', '불합격', '통보', '발표', '면접', '심사'].forEach((w) => ['채용 지원 ', '노무사 지원 ', '수습 지원 ', '인턴 지원 '].forEach((앞) => assert.ok(!Q.SCOPE_RECRUIT.test(앞 + w + ' 안내'), 앞 + w)));
  assert.ok(Q.SCOPE_RECRUIT.test('채용 지원합니다'), '지원자의 «지원합니다»는 걸린다');
});

/* ── 전문가 참여동의서 메일 (대표 제보 2026-11-27) — 지어낸 제목만 ── */
test('★ 전문가 참여동의서 메일은 «이력·회의·비용» 말로 들어온다 — 외부 전문가 참여·전문가 풀·멘토 동의서', () => {
  assert.equal(scope('[가나연구원] 외부 전문가 참여동의서 요청'), 'personal');
  assert.equal(scope('재송부_개인정보수집이용동의서 첨부 [가나연구원] 외부 전문가 참여동의서 요청'), 'personal', '실제로 걸러져 있던 모양');
  assert.equal(scope('내·외부 전문가 참여 동의서 제출 안내'), 'personal');
  assert.equal(scope('[가나재단] 전문가(멘토) 인력풀 참여 사전동의서'), 'personal');
  assert.equal(scope('서류 제출 부탁드립니다', ['내외부 전문가 참여 동의서.hwp']), 'personal', '제목에 말이 없어도 첨부 이름으로');
  /* 각 말이 «혼자서도» 걸리는지 — 다른 개인 말에 기대지 않는 제목 */
  assert.equal(scope('외부 전문가 풀 등록 안내'), 'personal', '«외부 전문가 + 풀·등록» 만으로');
  assert.equal(scope('[가나재단] 전문가 풀 안내'), 'personal', '«전문가 풀» 만으로');
  assert.equal(scope('멘토 사전동의서 제출 요청'), 'personal', '«멘토 사전 동의서» 만으로');
  assert.equal(scope('전문가 참여 동의서 회신'), 'personal', '«전문가 참여 동의서» 만으로');
  assert.equal(scope('외부 전문가 참여 안내'), 'personal', '«외부 전문가 + 참여» 만으로 — 서류 말이 없어도');
  /* 꾸밈말이 둘 붙어도(참여 사전동의서) · 개인정보가 끼어도 — 걸러지면 안 되는 진짜 요청(Orca 재검증 2026-11-27) */
  ['[가나연구원] 전문가 참여 사전동의서 요청', '멘토 참여 사전 동의서', '전문가 위원 참여동의서 회신', '외부 전문가 개인정보 수집·이용 동의서', '전문가 참여 개인정보 동의서 제출']
    .forEach((t) => assert.equal(scope(t), 'personal', t));
});
test('★ 고객사 업무 동의서·안내 메일은 개인 말이 아니다 — 맨 동의서·맨 참여/사전 동의서·위원 동의서·외부 전문가 안내는 걸러진다(Orca 검토 2026-11-27)', () => {
  ['일터혁신 컨설팅 참여 동의서 제출 요청', '직원 교육 참여 동의서 양식 송부', '휴일근무 사전 동의서 양식 요청', '개인정보 제3자 제공 사전동의서 회신',
    '노사협의회 위원 동의서 제출', '동의서 서명 요청', '직원 동의서 회수', '개인정보 동의서 회신 요청']
    .forEach((s) => assert.notEqual(scope(s), 'personal', s));
  ['외부 전문가 초청 세미나 안내', '외부 전문가 컨설팅 안내', '외부 전문가 활용 지원사업 신청 안내', '전문가 모임 일정 안내', '전문가 참여 세미나 안내',
    '외부 전문가 참여 세미나 안내', '외부 전문가 참여 간담회 안내', '외부 전문가 참여 기업 모집 공고', '전문가 등록 지원사업 안내', '고객사 전문가 명단 송부', '전문가 풀이 강의 안내',
    '외부 전문가 명단 송부', '외부 전문가 참여 교육 안내', '외부 전문가 참여 워크숍 안내', '외부 전문가 참여 포럼 안내', '외부 전문가 참여 설명회 안내', '외부 전문가 동의 하에 진행하는 컨설팅 안내']
    .forEach((s) => assert.notEqual(scope(s), 'personal', '«외부 전문가»·«전문가»는 서류 말이 붙을 때만: ' + s));
  assert.notEqual(scope('근로자 개인정보 수집·이용 동의서 양식 송부'), 'personal', '업무 말(근로자)');
  assert.notEqual(scope('근로자 참여 동의서 회수(노사협의회)'), 'personal', '업무 말이 섞이면 «애매» — 걸러 둔다');
});
test('새로 온 전문가 참여동의서 메일은 «새 요청»(동의서)으로 들어오고, 외부 전문가 안내 메일은 요청이 되지 않는다', async () => {
  const f = dbWith({
    301: mkRow({ s: '[가나연구원] 외부 전문가 참여동의서 요청', an: ['내외부 전문가 참여 동의서.hwp'], p: '아래 서류를 작성하여 회신해 주시기 바랍니다 제출기한 12월 4일' }),
    302: mkRow({ s: '외부 전문가 초청 세미나 안내', an: [], p: '세미나를 개최하오니 참석 바랍니다' }),
  });
  await scan(f);
  const x = items(f)[IN + '~301'];
  assert.ok(x, '기록이 생긴다'); assert.equal(x.st, 'new'); assert.equal(x.scope, 'personal'); assert.ok(!x.autoIgnored);
  assert.ok(x.kinds.indexOf('consent') >= 0, '종류는 동의서');
  assert.equal(Q.summary(items(f), NOW).alarm, 1, '안내 메일은 알림에 안 센다');
  const y = items(f)[IN + '~302'];
  assert.ok(!y || y.st !== 'new', '외부 전문가 초청 세미나 안내는 새 요청이 아니다');
});
test('범위를 가르는 글은 길이·공백에 한도가 있다 — 밖에서 오는 긴 반복 입력으로 느려지지 않는다', () => {
  const t = Date.now();
  Q.scopeOf({ s: '전문가('.repeat(20000), an: ['내' + ' '.repeat(50000) + '가', '외부' + ' '.repeat(50000) + '전문가'] });
  assert.ok(Date.now() - t < 1500, '아주 긴 제목·첨부 이름도 한 건 가르는 데 오래 걸리지 않는다(' + (Date.now() - t) + 'ms)');
  assert.ok(Number(Q.SCOPE_TEXT_MAX) > 0 || /SCOPE_TEXT_MAX/.test(mod), '길이 한도가 있다');
  /* 말 목록 «자체»도 긴 반복 입력에서 느려지지 않는다(괄호 말에 길이 한도 — 한도가 없으면 8만 자에서 몇 초) */
  const t2 = Date.now();
  Q.SCOPE_PERSONAL.test('전문가('.repeat(30000)); Q.SCOPE_WORK.test('전문가('.repeat(30000));
  Q.SCOPE_PERSONAL.test('내' + ' '.repeat(50000) + '가'); Q.SCOPE_PERSONAL.test('외부' + ' '.repeat(50000) + '가');   // 공백 두 줄이 맞닿는 말(내 [·]? 외부)도 한 번에 끝난다
  assert.ok(Date.now() - t2 < 800, '말 목록이 긴 반복 입력에서 느리다(' + (Date.now() - t2) + 'ms)');   // 한도가 없던 판은 12만 자에서 2초 안팎
  /* 한도 밖의 글은 보지 않는다 — 첨부 이름도 제목처럼 길이를 자르고 공백을 줄인다 */
  assert.equal(scope('서류 요청', ['가'.repeat(400) + ' 이력서.pdf']), 'unsure', '한도(수백 자) 밖의 말은 보지 않는다');
  assert.equal(scope('서류 요청', ['가'.repeat(20) + ' 이력서.pdf']), 'personal', '한도 안의 말은 본다');
});
