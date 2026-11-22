/* 정부사업신청 «매일 카톡 요약» (scripts/gov-digest) — 무엇을 «걸러 내고 / 남기는지»와 «언제 카톡을 건드리는지»를 못 박는다
   (대표 지시 2026-11-22 「수의계약 제외하고 필요할 만한 것 · 컨설턴트 모집은 대전·충청 · AI 사업은 전국」).
   ★ 수의계약·마감 지난 것은 어느 갈래에도 안 나간다 · 충청권 모집 글은 나가고 다른 지역·주민자치 강사 모집은 안 나간다
   ★ 같은 공고 고침판은 한 줄 · 처음엔 전부 새 것이고 보낸 뒤엔 새 것이 없다 · 마감 임박은 한 번만 다시 알린다
   ★ 실전이 아니면 PC 카톡을 «한 번도» 안 부른다 · 한 통이 막히면 멈추고 못 보낸 줄은 기록하지 않는다(다음 날 다시)
   ★ 자료는 지어낸 것이다(실제 공고·고객 정보 없음). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const D = require('../scripts/gov-digest/digest.js');
const M = require('../scripts/gov-digest/main.js');
const G2B = require('../js/gov-g2b.js');
const REC = require('../js/gov-recruit.js');

const TODAY = '2026-11-22';
const NOW = Date.parse('2026-11-22T01:00:00Z');   // 한국 시각 10시
function plus(n) { return new Date(Date.parse(TODAY + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
function row(no, nm, o) { return Object.assign({ no: String(no), nm, org: '지어낸기관', ntce: '지어낸기관', src: '나라장터', openDt: plus(-3), closeDt: plus(10), kw: '노무', mthd: '', url: 'https://example.test/' + no }, o || {}); }
function hit(key, title, o) { return Object.assign({ key, title, board: 'cheonan', boardName: '천안시 공고알림', org: '', date: plus(-1), href: 'https://example.test/h/' + key, per: { to: plus(9) } }, o || {}); }
const ids = (d, sec) => d.sections.find((s) => s.key === sec).items.map((x) => x.title);
const allTitles = (d) => [].concat(...d.sections.map((s) => s.items.map((x) => x.title)));

test('★ 수의계약·마감 지난 공고는 어느 갈래에도 안 나간다', () => {
  const d = D.build({ today: TODAY, rows: [
    row(1, '노무 컨설팅 용역 가'), row(2, '노무 컨설팅 용역 나', { mthd: '수의계약' }), row(3, '노무 컨설팅 용역 다', { mthd: '수의(소액)' }),
    row(4, '노무 컨설팅 용역 라', { closeDt: plus(-2) })] });
  const t = allTitles(d);
  assert.ok(t.includes('노무 컨설팅 용역 가'));
  ['노무 컨설팅 용역 나', '노무 컨설팅 용역 다', '노무 컨설팅 용역 라'].forEach((x) => assert.ok(!t.includes(x), x + ' 는 빠져야 한다'));
  assert.ok(d.counts.soleOut >= 2, '수의계약으로 뺀 수를 센다');
});

test('★ 공고는 «노무 핵심 낱말»이 걸렸을 때만 — 약한 낱말(컨설팅·인사·고용)만이면 빠진다. 단 충청권 공고는 약한 낱말이어도 남는다', () => {
  const d = D.build({ today: TODAY, rows: [
    row(1, '노무 진단 사업', { kw: '노무' }),
    row(2, '일반 컨설팅 지원 사업', { kw: '컨설팅' }),
    row(3, '[충남] 충남 컨설팅 지원 사업', { kw: '컨설팅', src: '기업마당', rgn: '충남' })] });
  const t = ids(d, 'main');
  assert.ok(t.includes('노무 진단 사업'));
  assert.ok(!t.includes('일반 컨설팅 지원 사업'));
  assert.ok(t.includes('[충남] 충남 컨설팅 지원 사업'));
});

test('★ 우리 지역이 아닌 지역 제한 공고는 빠진다(화면 🎯 규칙)', () => {
  const d = D.build({ today: TODAY, rows: [
    row(1, '[경기] 경기 노무 지원', { src: '기업마당', rgn: '경기' }), row(2, '[충북] 충북 노무 지원', { src: '기업마당', rgn: '충북' })] });
  const t = allTitles(d);
  assert.ok(!t.includes('[경기] 경기 노무 지원'));
  assert.ok(t.includes('[충북] 충북 노무 지원'));
});

test('★ 모집 글 — 충청권 것만 나가고, 다른 지역·주민자치 강사 모집은 안 나간다. 노무 낱말이 든 강사 모집은 나간다', () => {
  const T = { cons: '자문단 공개 모집', teach: '프로그램 강사 모집 공고', teachLabor: '근로조건 개선 사업 강사 모집 공고' };
  assert.equal(REC.kindOf(T.cons), 'cons', '검사 전제: 자문단 모집은 컨설팅 갈래');
  assert.equal(REC.kindOf(T.teach), 'teach', '검사 전제: 강사 모집은 강사 갈래');
  const d = D.build({ today: TODAY, hits: [
    hit('a', '천안시 ' + T.cons), hit('b', '서울시 ' + T.cons, { board: 'seoul', boardName: '서울시 고시공고' }),
    hit('c', '천안시 주민자치센터 ' + T.teach), hit('d', '천안시 ' + T.teachLabor)] });
  const t = ids(d, 'rgn');
  assert.ok(t.includes('천안시 ' + T.cons), '충청권 컨설팅·자문 모집은 나간다');
  assert.ok(!t.includes('서울시 ' + T.cons), '다른 지역 모집은 안 나간다');
  assert.ok(!t.includes('천안시 주민자치센터 ' + T.teach), '주민자치 강사 모집은 안 나간다');
  assert.ok(t.includes('천안시 ' + T.teachLabor), '노무 낱말이 든 강사 모집은 나간다');
});

test('★ 모집 글 — 법인·단체 위탁 운영 모집과 임원 공개모집은 «사람을 뽑는 일»이 아니라 안 나간다', () => {
  const ok = hit('a', '천안시 일자리 사업 자문단 공개 모집'), op = hit('b', '충청남도 지역센터 위탁 운영 법인(단체) 모집 공고'), ex = hit('c', '충청남도 공사 임원 공개 모집 공고 자문');
  assert.equal(REC.kindOf(ok.title), 'cons', '검사 전제: 자문단 모집은 컨설팅 갈래');
  const t = ids(D.build({ today: TODAY, hits: [ok, op, ex] }), 'rgn');
  assert.ok(t.includes(ok.title));
  assert.ok(!t.includes(op.title));
  assert.ok(!t.includes(ex.title));
});

test('★ 공인노무사회 게시판 모집은 지역이 없어도 나간다 — RULES.nationalBoard 를 끄면 안 나간다', () => {
  const h = hit('k', '직장 내 괴롭힘 사건 외부 조사자 선임 공고', { board: 'kcplaa_job', boardName: '공인노무사회 채용', per: { rolling: true } });
  assert.equal(REC.kindOf(h.title), 'cons', '검사 전제: 조사자 선임은 컨설팅·조사 갈래');
  assert.ok(ids(D.build({ today: TODAY, hits: [h] }), 'rgn').includes(h.title));
  const keep = D.RULES.nationalBoard;
  try { D.RULES.nationalBoard = /^$/; assert.ok(!ids(D.build({ today: TODAY, hits: [h] }), 'rgn').includes(h.title)); }
  finally { D.RULES.nationalBoard = keep; }
});

test('★ AI 사업 — 전국 공고가 나가되 스마트공장·교육 과정 운영 용역은 빠지고, AI 로만 걸린 줄은 노무 공고에 섞이지 않는다', () => {
  const ok = row(1, '중소기업 AI 도입 전환 지원 사업 수행기관 모집', { kw: '' }), fac = row(2, '스마트공장 구축 지원 사업 수행기관 모집', { kw: '' }),
    edu = row(3, '중소기업 AI 도입 지원 교육 운영 용역 업체 선정', { kw: '' }), far = row(4, '[제주] 제주 AI 도입 전환 지원 사업', { kw: '', src: '기업마당', rgn: '제주' });
  assert.ok(G2B.judgeAi(ok).length, '검사 전제: AI 도입 공고는 AI 갈래');
  assert.ok(G2B.judgeAi(edu).length, '검사 전제: 교육 운영 용역도 AI 갈래로 읽힌다(그래야 «뺀다»를 확인할 수 있다)');
  assert.deepEqual(G2B.judgeAi(fac), ['factory'], '검사 전제: 스마트공장은 factory 갈래');
  const d = D.build({ today: TODAY, rows: [ok, fac, edu, far] });
  const ai = ids(d, 'ai'), main = ids(d, 'main');
  assert.ok(ai.includes(ok.nm));
  assert.ok(ai.includes(far.nm), 'AI 는 지역으로 거르지 않는다(전국)');
  assert.ok(!ai.includes(fac.nm), '스마트공장은 뺀다');
  assert.ok(!ai.includes(edu.nm), '교육 운영 용역은 뺀다');
  assert.ok(!main.includes(ok.nm), 'AI 로만 걸린 줄은 노무 공고 갈래에 안 나온다');
});

test('★ 같은 공고의 고침판·재공고는 한 줄이고, 한 줄은 한 갈래에만 나온다', () => {
  const d = D.build({ today: TODAY, rows: [row(1, '노무 진단 사업 모집 공고'), row(2, '노무 진단 사업 모집 공고(수정)'), row(3, '[변경] 노무 진단 사업 모집 공고 재공고')] });
  assert.equal(ids(d, 'main').filter((t) => /노무 진단 사업/.test(t)).length, 1);
  const seen = new Set();
  d.sections.forEach((s) => s.items.forEach((x) => { assert.ok(!seen.has(x.id), x.id + ' 가 두 갈래에 나왔다'); seen.add(x.id); }));
});

test('★ 마감일을 지어내지 않는다 — 마감 없는 공고는 «마감 모름», 오래된 것(90일 넘음)은 뺀다', () => {
  const d = D.build({ today: TODAY, rows: [row(1, '노무 진단 사업 가', { closeDt: '', openDt: plus(-5) }), row(2, '노무 진단 사업 나', { closeDt: '', openDt: plus(-200) })] });
  const t = ids(d, 'main');
  assert.ok(t.includes('노무 진단 사업 가'));
  assert.ok(!t.includes('노무 진단 사업 나'));
  assert.match(d.sections.find((s) => s.key === 'main').items.find((x) => x.title === '노무 진단 사업 가').dueText, /모름/);
});

test('★ diff — 처음엔 전부 새 것, 보낸 뒤엔 새 것이 없고, 마감 임박은 한 번만 다시 알린다', () => {
  const d = D.build({ today: TODAY, rows: [row(1, '노무 진단 사업 가', { closeDt: plus(2) }), row(2, '노무 진단 사업 나', { closeDt: plus(30) })] });
  const n = d.sections.reduce((a, s) => a + s.items.length, 0);
  const a = D.diff(d, {});
  assert.equal(a.fresh.size, n, '처음엔 전부 새 것');
  const st1 = a.mark(TODAY);
  const b = D.diff(d, st1);
  assert.equal(b.fresh.size, 0, '보낸 줄은 다시 새 것이 아니다');
  assert.equal(b.remind.size, 1, '마감이 가까운(' + D.RULES.remindDays + '일 안) 한 줄만 다시 알린다');
  const st2 = b.mark(TODAY);
  assert.equal(D.diff(d, st2).remind.size, 0, '다시 알린 줄은 또 알리지 않는다');
  assert.equal(Object.keys(D.prune(st1, plus(500))).length, 0, '오래된 기록은 덜어 낸다');
});

test('★ render — 갈래마다 줄 수 한도·글자 수 한도가 있고, 보낸 줄(ids)을 알려 준다', () => {
  const rows = []; for (let i = 0; i < 20; i++) rows.push(row(i + 1, '노무 진단 사업 ' + String.fromCharCode(65 + i) + '그룹 ' + i + '번째 공고', { org: '기관' + i, closeDt: plus(5 + i) }));
  const d = D.build({ today: TODAY, rows });
  const msgs = D.render(d, { max: 5, limit: 400 });
  const mainMsgs = msgs.filter((m) => m.section === 'main');
  assert.ok(mainMsgs.length >= 1);
  assert.equal(mainMsgs.reduce((a, m) => a + m.ids.length, 0), 5, '한 갈래 최대 줄 수를 넘기지 않는다');
  assert.ok(mainMsgs.length > 1, '글자 수 한도를 넘으면 쪼갠다');
  assert.match(mainMsgs[mainMsgs.length - 1].text, /외 \d+건/);
  mainMsgs.forEach((m) => assert.ok(m.text.length < 900));
});

/* ── main.run — 가짜 부품으로 한 바퀴 ── */
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gov-digest-test-')); }
function data() {
  return { rows: { 1: row(1, '노무 진단 사업 가'), 2: row(2, '노무 진단 사업 나', { closeDt: plus(40) }) }, hits: { a: hit('a', '천안시 자문단 공개 모집') } };
}
function fakeKakao(o) {
  const sends = [];
  return { sends, probe: () => ({ ok: true }), send(room, text) { sends.push([room, text]); return (o && o.failAt === sends.length) ? { ok: false, code: 'not-running', error: 'x' } : { ok: true }; } };
}
const cfg = (o) => Object.assign({ liveEnabled: false, selfChat: false, room: '', project: 'pureun-erp' }, o || {});
const LIVE = { liveEnabled: true, selfChat: true, room: '나와의 채팅' };   // 실전 = 셋 다 있어야 한다

test('★ 미리보기는 아무것도 보내지 않고 기록도 안 남긴다', async () => {
  const home = tmp(), k = fakeKakao();
  const r = await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: k });
  assert.equal(r.mode, 'preview');
  assert.ok(r.messages.length);
  assert.equal(k.sends.length, 0);
  assert.ok(!fs.existsSync(path.join(home, 'sent.json')));
});

test('★ 시험 모드(--send 인데 실전 아님)는 카톡을 안 부르고 outbox 에만 적는다 — 기록은 안 남겨 실전 첫 통에 전부 들어간다', async () => {
  for (const c of [cfg(), cfg({ liveEnabled: true, selfChat: true, room: '' }), cfg({ liveEnabled: false, selfChat: true, room: '나와의 채팅' }), cfg({ liveEnabled: true, selfChat: false, room: '나와의 채팅' })]) {
    const home = tmp(), k = fakeKakao();
    const r = await M.run({ home, config: c, now: NOW, load: data, kakao: k, send: true });
    assert.equal(r.mode, 'test');
    assert.equal(k.sends.length, 0, '실전이 아니면 카톡을 부르지 않는다');
    assert.ok(fs.readdirSync(path.join(home, 'outbox')).length >= 1);
    assert.ok(!fs.existsSync(path.join(home, 'sent.json')));
  }
});

test('★ 실전은 설정한 방으로만 보내고, 보낸 줄을 기록해 다음 날엔 새 것만 보낸다', async () => {
  const home = tmp(), k = fakeKakao(), c = cfg(LIVE);
  const r1 = await M.run({ home, config: c, now: NOW, load: data, kakao: k, send: true });
  assert.equal(r1.mode, 'live');
  assert.ok(r1.sent >= 1 && r1.ok);
  k.sends.forEach(([room]) => assert.equal(room, '나와의 채팅'));
  const n1 = k.sends.length;
  const r2 = await M.run({ home, config: c, now: NOW + 864e5, load: data, kakao: k, send: true });   // 다음 날 — 같은 자료
  assert.equal(r2.fresh, 0, '이미 보낸 줄은 새 것이 아니다');
  assert.ok(r2.messages.every((m) => /마감 임박/.test(m.text)) || r2.messages.length === 0, '새 것이 없으면 보낼 것이 없다(마감 임박 다시 알림만 있을 수 있다)');
  assert.ok(k.sends.length >= n1);
});

test('★ 한 통이 막히면 멈추고, 못 보낸 줄은 기록하지 않는다 — 다음 날 다시 나간다', async () => {
  const home = tmp(), c = cfg(LIVE);
  const k = fakeKakao({ failAt: 1 });
  const r = await M.run({ home, config: c, now: NOW, load: data, kakao: k, send: true });
  assert.equal(r.ok, false);
  assert.equal(r.sent, 0);
  assert.equal(k.sends.length, 1, '막힌 뒤로는 더 보내지 않는다');
  assert.ok(!fs.existsSync(path.join(home, 'sent.json')), '못 보냈으니 기록하지 않는다');
  const k2 = fakeKakao();
  const r2 = await M.run({ home, config: c, now: NOW, load: data, kakao: k2, send: true });
  assert.ok(r2.sent >= 1, '다음에 다시 나간다');
});

test('★ 서버를 못 읽으면 보내지 않고 이유를 알린다(자료를 지어내지 않는다)', async () => {
  const home = tmp(), k = fakeKakao();
  const r = await M.run({ home, config: cfg(LIVE), now: NOW, load: () => { throw new Error('offline'); }, kakao: k, send: true });
  assert.equal(r.ok, false);
  assert.match(r.error, /읽지 못했습니다/);
  assert.equal(k.sends.length, 0);
});

test('★ 설정은 저장소 밖(%APPDATA%) — 저장소 안에 방 이름·열쇠를 두지 않는다 / 서버에는 쓰지 않는다', () => {
  const appdata = path.join(os.tmpdir(), 'appdata-gov-digest-test');
  assert.equal(M.homeDir({ APPDATA: appdata }), path.join(appdata, 'pureun-gov-digest'), '설정 자리는 %APPDATA% 아래');
  assert.ok(!M.homeDir({ APPDATA: appdata }).startsWith(path.join(__dirname, '..')), '저장소 안이 아니다');
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'gov-digest', 'main.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'scripts', 'gov-digest', 'digest.js'), 'utf8');
  assert.ok(!/database:(set|update|remove|push)/.test(src), '서버는 읽기만 한다');
  assert.ok(/database:get/.test(src));
  assert.ok(!/liveEnabled\s*:\s*true/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), '코드가 실전을 켜 두지 않는다 — 기본은 시험 모드');
});

/* ── 2026-11-22 자동 검증·보안 검토가 짚은 것들 — 하나씩 못 박는다 ── */
test('★ 공인노무사회 게시판이어도 제목에 다른 지역이 적혀 있으면 «전국»으로 내지 않는다', () => {
  const other = hit('o', '[서울] 서울시 직장 내 괴롭힘 외부 조사위원 모집 공고', { board: 'kcplaa_job', boardName: '공인노무사회 채용', per: { rolling: true } });
  const all = hit('p', '직장 내 괴롭힘 외부 조사위원 모집 공고', { board: 'kcplaa_job', boardName: '공인노무사회 채용', per: { rolling: true } });
  assert.equal(REC.kindOf(all.title), 'cons', '검사 전제: 조사위원 모집은 컨설팅·조사 갈래');
  const t = ids(D.build({ today: TODAY, hits: [other, all] }), 'rgn');
  assert.ok(t.includes(all.title));
  assert.ok(!t.includes(other.title));
});

test('★ 중복 묶기 — 지역 표시·차수가 다른 공고는 따로, 고침판·재공고는 한 줄로', () => {
  const k = (title, org) => D.sameKey({ title, org: org || '기관' });
  assert.notEqual(k('[대전] 노무 컨설팅 지원사업'), k('[충남] 노무 컨설팅 지원사업'), '지역이 다르면 다른 공고');
  assert.notEqual(k('노무 컨설팅 지원사업(1차)'), k('노무 컨설팅 지원사업(2차)'), '차수가 다르면 다른 공고');
  assert.equal(k('노무 사업 공고'), k('노무 사업 재공고'));
  assert.equal(k('노무 사업 공고'), k('노무 사업 공고(수정)'));
  assert.equal(k('노무 사업 공고'), k('[변경] 노무 사업 공고'));
  assert.notEqual(k('노무 사업 공고', '가 기관'), k('노무 사업 공고', '나 기관'), '기관이 다르면 다른 공고');
});

test('★ 노무 쪽 공고와 AI 갈래에 모두 걸리는 공고는 고침판까지 한 갈래에만 나온다', () => {
  const a = row(1, '노무 AI 도입 지원 사업 수행기관 모집', { kw: '노무' }), b = row(2, '노무 AI 도입 지원 사업 수행기관 모집(수정)', { kw: '노무' });
  assert.ok(G2B.judgeAi(a).length, '검사 전제: 이 공고는 AI 갈래에도 걸린다');
  const d = D.build({ today: TODAY, rows: [a, b] });
  assert.equal(allTitles(d).filter((t) => /노무 AI 도입/.test(t)).length, 1);
});

test('★ 충청권 공고여도 찾는 말이 하나도 안 걸렸으면 낸다지 않는다(하수관로 정비 용역 같은 것)', () => {
  const d = D.build({ today: TODAY, rows: [row(1, '[충남] 충남 하수관로 정비 용역', { kw: '', src: '기업마당', rgn: '충남' })] });
  assert.ok(!allTitles(d).includes('[충남] 충남 하수관로 정비 용역'));
});

test('★ 카톡 글 — 외부 글의 줄바꿈·제어문자를 걷고, 주소는 https 만(계정 정보가 든 주소 제외)', () => {
  assert.equal(D.oneLine('가' + String.fromCharCode(10) + '⚠ 가짜 안내' + String.fromCharCode(13, 9) + '끝'), '가 ⚠ 가짜 안내 끝');
  assert.equal(D.safeUrl('https://example.test/a?b=1'), 'https://example.test/a?b=1');
  ['http://example.test/a', 'javascript:alert(1)', 'https://user:pw@example.test/', 'https://exa mple.test/', 'https://a@example.test/'].forEach((u) => assert.equal(D.safeUrl(u), '', u));
  const d = D.build({ today: TODAY, rows: [row(1, '노무 진단' + String.fromCharCode(10) + '사업 안내', { url: 'http://example.test/x' })] });
  const x = d.sections.find((s) => s.key === 'main').items[0];
  assert.ok(!/[\r\n]/.test(x.title));
  assert.equal(x.url, '');
});

test('★ 설정 — 깨진 config.json 은 시험 모드로 «조용히» 넘기지 않고 알린다 / 직접 넘긴 설정도 같은 검사를 지난다', async () => {
  const home = tmp();
  assert.equal(M.loadConfig(home).errors.length, 0, '파일이 없으면 기본(시험 모드)');
  fs.writeFileSync(path.join(home, 'config.json'), '{ 깨진 json');
  assert.ok(M.loadConfig(home).errors.length, '있는데 깨졌으면 오류');
  const r = await M.run({ home, now: NOW, load: data, send: true, kakao: fakeKakao() });
  assert.equal(r.ok, false);
  const bad = await M.run({ home: tmp(), config: cfg({ project: 'x; echo hi' }), now: NOW, load: data });
  assert.equal(bad.ok, false, '셸로 넘어가는 project 이름은 직접 넘겨도 검사한다');
});

test('★ --dir 은 두 파일이 다 있어야 한다 — 없는 폴더·깨진 파일을 «0건»으로 삼키지 않는다', async () => {
  const empty = tmp();
  const r = await M.run({ home: tmp(), config: cfg(), now: NOW, dir: empty });
  assert.equal(r.ok, false);
  assert.match(r.error, /읽지 못했습니다/);
  fs.writeFileSync(path.join(empty, 'gov_feed.json'), '{ 깨짐');
  fs.writeFileSync(path.join(empty, 'gov_watch.json'), '{}');
  assert.equal((await M.run({ home: tmp(), config: cfg(), now: NOW, dir: empty })).ok, false);
});

test('★ 보낸 기록(sent.json)이 깨졌으면 보내지 않는다 — 그대로 보내면 지난 글이 전부 다시 나간다', async () => {
  const home = tmp(), k = fakeKakao();
  fs.writeFileSync(path.join(home, 'sent.json'), '{ 깨짐');
  const r = await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: k, send: true });
  assert.equal(r.ok, false);
  assert.equal(k.sends.length, 0);
  assert.match(r.error, /sent\.json/);
});

test('★ 같은 때 두 번 돌지 않는다(잠금) — 죽은 잠금(30분 넘음)은 치운다', async () => {
  const home = tmp(), k = fakeKakao();
  const rel = M.takeLock(home, NOW);
  assert.ok(rel, '처음엔 잠금을 잡는다');
  const r = await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: k, send: true });
  assert.equal(r.ok, false, '이미 돌고 있으면 건너뛴다');
  assert.equal(k.sends.length, 0);
  rel();
  const old = path.join(home, 'run.lock'); fs.writeFileSync(old, 'x'); fs.utimesSync(old, new Date(NOW - 3600e3), new Date(NOW - 3600e3));
  assert.ok(M.takeLock(home, NOW), '한 시간 된 잠금은 죽은 것이라 치우고 잡는다');
});

test('★ 통마다 바로 기록한다 — 둘째 통에서 막혀도 첫 통에 실린 줄은 다시 나가지 않는다', async () => {
  const home = tmp(), c = cfg(LIVE);
  const k = fakeKakao({ failAt: 2 });
  const r = await M.run({ home, config: c, now: NOW, load: data, kakao: k, send: true });
  assert.equal(r.sent, 1);
  assert.equal(r.ok, false);
  const st = JSON.parse(fs.readFileSync(path.join(home, 'sent.json'), 'utf8'));
  assert.ok(Object.keys(st).length >= 1, '보낸 통의 줄은 기록돼 있다');
  const k2 = fakeKakao();
  const r2 = await M.run({ home, config: c, now: NOW, load: data, kakao: k2, send: true });
  assert.equal(r2.sent, 1, '못 보낸 통만 다시 나간다');
});

test('★ 실전은 «내 나와의 채팅임을 직접 확인했다(selfChat)»가 있어야 한다 — 방 이름만으로는 남에게 갈 수 있다', async () => {
  const k = fakeKakao();
  const r = await M.run({ home: tmp(), config: cfg({ liveEnabled: true, room: '나와의 채팅' }), now: NOW, load: data, kakao: k, send: true });
  assert.equal(r.mode, 'test');
  assert.equal(k.sends.length, 0);
});

test('★ prune — 이상한 기록·날짜가 와도 멈추지 않는다', () => {
  assert.doesNotThrow(() => D.prune({ a: null, b: 'x', c: { sent: TODAY } }, TODAY));
  assert.doesNotThrow(() => D.prune({}, ''));
  assert.deepEqual(Object.keys(D.prune({ a: null, c: { sent: TODAY } }, TODAY)), ['c']);
});

test('★ render — 한 통 글자 수가 머리글·제목·끝 안내까지 한도 안에 든다', () => {
  const rows = []; for (let i = 0; i < 12; i++) rows.push(row(i + 1, '노무 진단 사업 ' + i + '번째 공고 ' + 'ㅁ'.repeat(30), { org: '기관' + i, closeDt: plus(5 + i) }));
  const limit = 500;
  const msgs = D.render(D.build({ today: TODAY, rows }), { max: 12, limit });
  assert.ok(msgs.length > 1, '한도를 넘으면 쪼갠다');
  msgs.forEach((m) => assert.ok(m.text.length <= limit, m.text.length + '자 — 머리글·제목·끝 안내까지 한도 안이어야 한다'));
});

/* ── 2차 재검토(2026-11-22)가 짚은 것들 ── */
test('★ 한 줄이 아무리 길어도 통은 한도를 넘지 않는다 — 제목·기관·까닭에 길이 한도가 있고, 너무 긴 주소는 뺀다', () => {
  const long = '가'.repeat(900);
  const d = D.build({ today: TODAY, rows: [row(1, '노무 진단 사업 ' + long, { org: '나'.repeat(400), url: 'https://example.test/' + 'a'.repeat(900) })] });
  const x = d.sections.find((s) => s.key === 'main').items[0];
  assert.ok(x.title.length <= 160 && x.org.length <= 60, '제목·기관 길이 한도');
  assert.equal(x.url, '', '500자 넘는 주소는 잘라 쓰면 깨지므로 뺀다');
  const limit = 600;
  D.render(d, { limit }).forEach((m) => assert.ok(m.text.length <= limit, m.text.length + '자'));
});

test('★ 보낸 기록은 문법만이 아니라 «칸 모양»까지 맞아야 한다 — 틀리면 멈춘다', async () => {
  for (const bad of ['{"feed:1": 5}', '{"feed:1": {}}', '{"feed:1": {"sent": "어제"}}', '[1]']) {
    const home = tmp(), k = fakeKakao();
    fs.writeFileSync(path.join(home, 'sent.json'), bad);
    const r = await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: k, send: true });
    assert.equal(r.ok, false, bad);
    assert.equal(k.sends.length, 0, bad);
  }
  const home = tmp(); fs.writeFileSync(path.join(home, 'sent.json'), JSON.stringify({ 'feed:1': { sent: TODAY, reminded: '' } }));
  assert.equal((await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: fakeKakao(), send: true })).ok, true, '모양이 맞는 기록은 통과');
});

test('★ 보낸 뒤 기록에 실패하면 멈추고 «같은 통이 다시 갈 수 있다»고 알린다', async () => {
  const home = tmp(), k = fakeKakao();
  fs.mkdirSync(path.join(home, 'sent.json.' + process.pid + '.tmp'));   // 임시 파일 자리를 폴더로 막아 기록 쓰기를 실패시킨다
  const r = await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: k, send: true });
  assert.equal(r.ok, false);
  assert.equal(k.sends.length, 1, '기록에 실패하면 더 보내지 않는다');
  assert.ok(r.failed.some((f) => f.code === 'state-write'));
  assert.match(r.failed[0].error, /다시 갈 수/);
});

test('★ 보낼 때 120일 지난 옛 기록도 함께 덜어 낸다', async () => {
  const home = tmp(), old = new Date(NOW - 200 * 864e5).toISOString().slice(0, 10);
  fs.writeFileSync(path.join(home, 'sent.json'), JSON.stringify({ 'feed:옛것': { sent: old, reminded: '' } }));
  await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: fakeKakao(), send: true });
  const st = JSON.parse(fs.readFileSync(path.join(home, 'sent.json'), 'utf8'));
  assert.ok(!('feed:옛것' in st), '옛 기록은 지워진다');
  assert.ok(Object.keys(st).length >= 1, '오늘 보낸 줄은 기록된다');
});

test('★ --dir 덤프는 rows·hits 칸이 있고 객체여야 한다 — 비어 있거나 배열이면 «0건»으로 삼키지 않는다', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'gov_feed.json'), JSON.stringify({ rows: {} }));
  for (const bad of ['{}', '[]', '{"hits": 5}']) {
    fs.writeFileSync(path.join(dir, 'gov_watch.json'), bad);
    assert.equal((await M.run({ home: tmp(), config: cfg(), now: NOW, dir })).ok, false, bad);
  }
  fs.writeFileSync(path.join(dir, 'gov_watch.json'), JSON.stringify({ hits: {} }));
  assert.equal((await M.run({ home: tmp(), config: cfg(), now: NOW, dir })).ok, true);
});

/* ── 최종 재검토(2026-11-22 3차)가 짚은 것들 ── */
test('★ 보낸 기록은 «진짜 달력 날짜»와 칸 종류까지 맞아야 한다 — 2026-99-99·엉뚱한 reminded 는 멈춘다', async () => {
  for (const bad of [{ sent: '2026-99-99', reminded: '' }, { sent: '2026-02-30', reminded: '' }, { sent: TODAY, reminded: 'invalid' }, { sent: TODAY, reminded: 7 }, [TODAY], { sent: ['2026-11-22'], reminded: '' }]) {
    const home = tmp(), k = fakeKakao();
    fs.writeFileSync(path.join(home, 'sent.json'), JSON.stringify({ 'feed:1': bad }));
    const r = await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: k, send: true });
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(k.sends.length, 0, JSON.stringify(bad));
  }
  const home = tmp(); fs.writeFileSync(path.join(home, 'sent.json'), JSON.stringify({ 'feed:1': { sent: plus(-3), reminded: plus(-1) } }));
  assert.equal((await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: fakeKakao(), send: true })).ok, true, '진짜 날짜로 된 기록은 통과');
});

test('★ --dir 덤프의 rows·hits 가 배열이면 거절한다(빈 배열도 «0건»으로 삼키지 않는다)', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'gov_feed.json'), JSON.stringify({ rows: [42, null] }));
  fs.writeFileSync(path.join(dir, 'gov_watch.json'), JSON.stringify({ hits: {} }));
  assert.equal((await M.run({ home: tmp(), config: cfg(), now: NOW, dir })).ok, false, 'rows 가 배열');
  fs.writeFileSync(path.join(dir, 'gov_feed.json'), JSON.stringify({ rows: {} }));
  fs.writeFileSync(path.join(dir, 'gov_watch.json'), JSON.stringify({ hits: [] }));
  assert.equal((await M.run({ home: tmp(), config: cfg(), now: NOW, dir })).ok, false, 'hits 가 빈 배열');
});

test('★ 보내는 도중 기록 파일이 망가져도 메모리의 기록으로 이어 쓴다 — 읽다가 깨진 것을 만나 지난 기록을 덮지 않는다', async () => {
  const home = tmp(), sends = [];
  const k = { sends, probe: () => ({ ok: true }), send(room, text) { sends.push(text); fs.writeFileSync(path.join(home, 'sent.json'), '{ 누가 망가뜨림'); return { ok: true }; } };
  fs.writeFileSync(path.join(home, 'sent.json'), JSON.stringify({ 'feed:옛': { sent: plus(-2), reminded: '' } }));
  const r = await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: k, send: true });
  assert.ok(sends.length >= 2 && r.ok, '통이 둘 이상이어야 이 검사가 뜻이 있다');
  const st = JSON.parse(fs.readFileSync(path.join(home, 'sent.json'), 'utf8'));
  assert.ok('feed:옛' in st, '지난 기록이 그대로 있다');
  assert.ok(Object.keys(st).length > 1, '이번에 보낸 줄도 기록됐다');
});

test('★ 기록 실패 경고는 화면 출력만이 아니라 digest.log 에도 남는다(예약 작업은 화면이 안 남는다)', async () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, 'sent.json.' + process.pid + '.tmp'));
  await M.run({ home, config: cfg(LIVE), now: NOW, load: data, kakao: fakeKakao(), send: true });
  assert.match(fs.readFileSync(path.join(home, 'digest.log'), 'utf8'), /다시 갈 수 있음/);
});

test('★ render — limit 을 아주 작게 줘도 줄 길이 한도 덕에 한 통이 1,500자를 넘지 않는다', () => {
  const d = D.build({ today: TODAY, rows: [row(1, '노무 진단 사업 ' + '가'.repeat(900), { org: '나'.repeat(400), url: 'https://example.test/' + 'a'.repeat(450) })] });
  const msgs = D.render(d, { limit: 100 });
  assert.ok(msgs.length >= 1);
  msgs.forEach((m) => assert.ok(m.text.length <= 1500, m.text.length + '자'));
});
