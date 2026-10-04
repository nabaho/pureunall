/* 정부사업신청 › 「냈나·됐나」 메일 가르기 + 제출 전 점검 — 순수 모듈을 «돌려 보는» 검사 (2026-10-04)
   제목은 2026-10-04 실제 메일 목록에서 옮겼다. ⚠ 고객 사업장 이름은 가짜로 바꿨다(공개 저장소). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/gov-submit.js');
const R = require('../js/gov-recruit.js');
const W = require('../functions/recruit-watch.js');

const D = (y, m, d) => new Date(y, m - 1, d, 10).getTime();
function cls(subj, sent, folder) { return S.classify({ u: 1, s: subj, d: D(2026, 3, 1), a: 2 }, { sent: !!sent, folder: folder || 'F', matches: R.matches }); }

test('★★ 모집 공고 잣대가 서버(functions/recruit-watch.js)와 «한 글자도» 같다', () => {
  ['WHO', 'PICK', 'DONE', 'LEARN'].forEach((k) => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../functions/recruit-watch.js'), 'utf8');
    const m = new RegExp('const ' + k + ' = (/.*/[a-z]*);').exec(src);
    assert.ok(m, k + ' 를 서버 파일에서 못 찾음');
    assert.equal(String(S[k]), m[1], k + ' 가 서버와 다르다 — 둘 다 고쳐야 한다');
  });
  ['컨설턴트 모집 공고', '지방공기업평가원 위촉직이사 모집 재공고', '컨설턴트 모집 결과 안내', '입주기업 모집공고', '고용노사관계 전문가과정 교육생 모집']
    .forEach((t) => assert.equal(S.isRecruit(t), W.isRecruit(t), t));
});

test('★★ 내가 보낸 지원 메일 — 실측 제목', () => {
  assert.equal(cls('[권형하노무사] 지원서 입니다.', true).kind, 'submit');
  const r = cls('Re: [푸른노무법인] 2026년 지방공기업평가원 자문위원_인사노무 부문 응모서류 제출의 건', false);
  assert.equal(r.kind, 'submit', '받은편지함의 «내 지원 메일에 단 답장»도 지원의 증거다');
  assert.equal(r.org, 'erc'); assert.equal(r.viaReply, true);
});
test('★★ 고객 업무 메일은 지원이 아니다 — 실측 오탐', () => {
  ['[푸른노무법인] 가나안경원 근로복지공단 보험료 고지 건 - 추가제출서류가 있어 메일 드립니다.',
    '[푸른노무법인] 산업일자리전환컨설팅 신청서 송부의 건 (가나엔지니어링)',
    '[푸른노무법인] 가나식당_자동이체 신청서 송부의 건',
    '[푸른노무법인] 비즈니스지원단 현장클리닉 인사노무 컨설팅 산출물 송부의 건',
    '[푸른노무법인] 가나식당 근로자 이력서 송부의 건'      // 「이력서」가 있어도 고객 근로자의 것
  ].forEach((t) => assert.equal(cls(t, true), null, t));
});
test('보낸 메일도 «답장 아닌 받은 메일»도 아니면 지원이 아니다', () => {
  assert.equal(cls('이력서 양식 보내드립니다', false), null, '남이 보낸 새 메일의 「이력서」는 내 지원이 아니다');
});

test('★★ 결과 메일 — 실측 제목과 짐작', () => {
  const cases = [
    ['2026년 지방공기업 경영평가 평가위원 선정 안내', '선정', 'erc'],
    ['[중소벤처기업진흥공단] 재기컨설팅(사업정리) 공급기업(컨설턴트) 선정안내', '선정', 'kosmes'],
    ['지방공기업평가원 상시자문 위원 심사 결과 안내', '', 'erc'],
    ['[에프엠어소시에이츠] 일터혁신 상생컨설팅 컨설턴트 지원 결과를 알려드립니다.', '', 'nosa'],
    ['[충남6차산업센터] 전문상담 및 현장코칭 전문위원 재위촉 동의서', '선정', 'agri6'],
    ['2026년 천안여성인력개발센터 운영위원회 위원 위촉 동의서 회신 부탁드립니다.', '선정', ''],
    ['○○ 컨설턴트 모집 최종 탈락 안내', '탈락', '']
  ];
  cases.forEach(([t, g, org]) => { const r = cls(t, false); assert.equal(r && r.kind, 'result', t); assert.equal(r.guess, g, t); assert.equal(r.org, org, t); });
});
test('★ 고객 일의 「선정」은 결과가 아니다 — 실측', () => {
  ['｢충남경제진흥원｣산업일자리전환 지원센터 기업 선정 결과 및 컨설팅 실시 안내',
    '[충남북부상의] 2025년도 마케팅 지원사업 선정결과 안내(푸른노무법인)',
    '[충남북부상의] 인사노무 컨설팅 참여기업 선정 결과 안내(컨설턴트 배정)'   // 「컨설턴트」가 있어도 참여기업 선정
  ].forEach((t) => assert.equal(cls(t, false), null, t));
  assert.equal(cls('RE: 2026년 지방공기업 경영평가 평가위원 선정 안내', false), null, '답장은 결과로 세지 않는다(원 메일이 결과다)');
});

test('★★ 메일로 온 모집 공고 — 분명한 것만(실측 46건 중 절반이 업무 메일이었다)', () => {
  ['[로컬브릿지 사회경제연구원] 2026년 창업경영지원 전문기관 강사 모집 안내',
    "[필독] '26년 충남지방중소벤처기업청 상담위원 등록요청 드립니다.(첨부파일 참조)",
    '[상생협력재단] 2025년 통합기술보호지원반 우수 컨설턴트 모집공고 게시 안내',
    '[세종농촌융복합산업지원센터] 농촌융복합산업 전문상담 및 현장코칭 모집 공고(~26.02.25까지)'
  ].forEach((t) => assert.equal((cls(t, false) || {}).kind, 'notice', t));
  ["(7차) '25년 충남청 비즈니스지원단 무료 현장상담 신청내역입니다.",
    '[한국경영기술지도사회] 2026년 비즈니스지원단 현장클리닉 성과추적관리 신청 안내 (클리닉위원, 선착순접수)',
    '[회신요청] 「충남 농촌융복합산업 현장코칭 전문위원 위촉식 및 사업설명회」참석 여부 재확인 요청',
    '[상생협력재단] 통합 기술보호지원반 제2기 전문가 위촉기간 연장 안내',
    "[충남중기청] 25년 공영홈쇼핑 충남지역 혁신기업 제품 코칭상담회 참여기업 추가 모집 안내",
    "[한국문화산업협회] 10월 '공급망 ESG실사 컨설턴트 양성과정' 모집 안내",
    '2026년 서산시 사회적경제 전문가 현장지원단 구성 알림'   // 게시판 잣대엔 걸리지만 «분명한» 모집 말이 없다
  ].forEach((t) => { const r = cls(t, false); assert.ok(!r || r.kind !== 'notice', t); });
  assert.equal(S.isRecruit('2026년 서산시 사회적경제 전문가 현장지원단 구성 알림'), true, '게시판 잣대만으로는 걸린다 — 그래서 메일엔 덧씌운다');
});

function folders() {
  return [
    { folder: 'Sent', sent: true, rows: {
      1: { u: 1, s: '[권형하노무사] 지원서 입니다.', d: D(2026, 9, 29), a: 3 },
      2: { u: 2, s: '[푸른노무법인] 가나식당_자동이체 신청서 송부의 건', d: D(2026, 9, 2), a: 1 } } },
    { folder: '3.컨설팅', sent: false, rows: {
      7: { u: 7, s: 'Re: [푸른노무법인] 2026년 지방공기업평가원 자문위원_인사노무 부문 응모서류 제출의 건', d: D(2026, 1, 24), a: 0 },
      8: { u: 8, s: '2026년 지방공기업 경영평가 평가위원 선정 안내', d: D(2026, 2, 6), a: 0 },
      9: { u: 9, s: '[세종농촌융복합산업지원센터] 농촌융복합산업 전문상담 및 현장코칭 모집 공고(~26.02.25까지)', d: D(2026, 2, 11), a: 1 },
      10: { u: 10, s: '2026년 천안여성인력개발센터 운영위원회 위원 위촉 동의서 회신 부탁드립니다.', d: D(2026, 4, 27), a: 1 } } },
    { folder: 'INBOX', sent: false, rows: {
      8: { u: 8, s: '2026년 지방공기업 경영평가 평가위원 선정 안내', d: D(2026, 2, 6), a: 0 } } }
  ];
}
test('★ 모으기 — 최근 먼저, 같은 메일이 두 폴더에 있어도 한 번', () => {
  const it = S.collect(folders(), R.matches);
  assert.equal(it.filter((x) => x.subject === '2026년 지방공기업 경영평가 평가위원 선정 안내').length, 1, '두 폴더에 같은 결과 메일 — 한 번만');
  assert.deepEqual(it.map((x) => x.date), it.map((x) => x.date).slice().sort().reverse());
  assert.equal(it.length, 5);
});

test('★★ 계획 — 지원은 저절로, 결과는 묻고, 기관 모름은 고르게, 공고는 따로', () => {
  const p = S.plan(S.collect(folders(), R.matches), {}, {}, {});
  assert.deepEqual(p.auto.map((a) => a.org + a.year), ['erc2026']);
  assert.deepEqual(p.ask.map((a) => a.org + a.year + a.guess), ['erc2026선정']);
  assert.deepEqual(p.pick.map((x) => x.kind + ' ' + x.subject), ['submit [권형하노무사] 지원서 입니다.',
    'result 2026년 천안여성인력개발센터 운영위원회 위원 위촉 동의서 회신 부탁드립니다.'], '기관을 모르는 «결과»도 버리지 않고 고르게 한다');
  assert.equal(p.notices.length, 1);
});
test('★★ 사람이 적은 상태는 덮지 않는다 — 선정·탈락·지원함', () => {
  const items = S.collect(folders(), R.matches);
  ['선정', '탈락', '지원함'].forEach((st) => {
    const p = S.plan(items, { erc: { 2026: { st } } }, {}, {});
    assert.equal(p.auto.length, 0, st + ' 를 덮으면 안 된다');
  });
  assert.equal(S.plan(items, { erc: { 2026: { st: '지원 예정' } } }, {}, {}).auto.length, 1, '「지원 예정」은 지원함으로 올린다');
  assert.equal(S.plan(items, { erc: { 2026: { st: '선정' } } }, {}, {}).ask.length, 0, '이미 선정이면 다시 안 묻는다');
});
test('★ 고른 기관을 기억하고, 무시한 메일은 다시 안 나온다', () => {
  const items = S.collect(folders(), R.matches);
  const k = items.find((x) => /지원서 입니다/.test(x.subject)).key;
  const p = S.plan(items, {}, { [k]: 'cepa' }, {});
  assert.ok(p.auto.some((a) => a.org === 'cepa' && a.year === '2026'));
  assert.ok(!S.plan(items, {}, {}, { [k]: 1 }).pick.some((x) => x.key === k), '무시한 메일은 다시 안 나온다');
});
test('같은 기관·같은 해 지원 메일이 여럿이어도 한 번만 적는다', () => {
  const f = folders(); f[0].rows[3] = { u: 3, s: 'RE: 지방공기업평가원 응모서류 재송부', d: D(2026, 1, 25), a: 1 };
  const p = S.plan(S.collect(f, R.matches), {}, {}, {});
  assert.equal(p.auto.filter((a) => a.org === 'erc').length, 1);
});
test('★ 적기 — 원래 기록을 안 고치고, 메일 열쇠·날짜·제목·첨부 수를 남긴다(되돌리기용)', () => {
  const log = { erc: { 2026: { due: '2026-01-20' } } };
  const p = S.plan(S.collect(folders(), R.matches), log, {}, {});
  const out = S.applyAuto(log, p.auto, 99);
  assert.equal(log.erc[2026].st, undefined, '원래 것은 그대로');
  assert.equal(out.erc[2026].st, '지원함'); assert.equal(out.erc[2026].via, 'mail');
  assert.equal(out.erc[2026].due, '2026-01-20', '마감일은 남는다');
  assert.ok(out.erc[2026].mail.key); assert.equal(out.erc[2026].mail.date, '2026-01-24');
});

/* ═══ 제출 전 점검 ═══ */
test('★ 서류 종류 — 파일 이름 먼저, 모르면 글 앞부분', () => {
  assert.equal(S.kindOf('개인정보수집이용동의서_권형하.hwp', ''), 'consent');
  assert.equal(S.kindOf('지원서(양식).hwpx', '이력 사항'), 'apply', '「지원서」에 「이력」이 들어도 지원서');
  assert.equal(S.kindOf('경력증명서.pdf', ''), 'career');
  assert.equal(S.kindOf('공인노무사 자격증.jpg', ''), 'license');
  assert.equal(S.kindOf('scan001.pdf', '이 력 서\n성명'), '', '띄어 쓴 「이 력 서」는 못 알아본다 — 지어내지 않는다');
  assert.equal(S.kindOf('scan002.pdf', '경력증명서\n위 사람은'), 'career');
});
test('★★ 주민번호 — «뒷자리까지» 보이는 것만 센다, 가린 것은 안 센다', () => {
  assert.deepEqual(S.rrnCount('주민등록번호 800101-1234567'), { dashed: 1, joined: 0 });
  assert.deepEqual(S.rrnCount('800101-1******'), { dashed: 0, joined: 0 });
  assert.deepEqual(S.rrnCount('800101-●●●●●●●'), { dashed: 0, joined: 0 });
  assert.deepEqual(S.rrnCount('8001011234567'), { dashed: 0, joined: 1 }, '붙여 쓴 13자리 — 계좌일 수도 있어 따로');
  assert.deepEqual(S.rrnCount('사업자 123-45-67890 · 전화 041-000-0001'), { dashed: 0, joined: 0 });
});
test('서명 칸·빈칸·작년 파일', () => {
  assert.equal(S.signSpots('신청인 권형하 (서명)\n대표 (인)'), 2);
  assert.equal(S.blankSpots('     년     월     일\n성명 ○○○'), 2);
  assert.equal(S.oldYear('2025_지원서.hwp', 2026), '2025');
  assert.equal(S.oldYear('2026_지원서.hwp', 2026), '');
  assert.equal(S.oldYear('지원서.hwp', 2026), '');
});
test('★★ 점검 — 빠진 서류·주민번호·마감·못 읽은 파일', () => {
  const r = S.checkFiles([
    { name: '지원서.hwpx', size: 1000, text: '지원서 주민등록번호 800101-1234567 (서명)' },
    { name: '이력서.pdf', size: 1000, text: '이력서' },
    { name: '자격증.jpg', size: 1000, text: null, textErr: '그림 파일' }
  ], { year: 2026, need: ['apply', 'resume', 'career', 'consent', 'license'], due: '2026-03-01', today: '2026-03-02' });
  assert.deepEqual(r.missing, ['경력증명서', '개인정보 동의서']);
  assert.ok(r.top.some((t) => /마감일\(2026-03-01\)이 지났습니다/.test(t)));
  assert.match(r.rows[0].warn.join(' '), /주민번호 1곳/);
  assert.match(r.rows[0].info.join(' '), /서명·날인 칸 1곳/);
  assert.equal(r.rows[2].readable, false);
  assert.match(r.rows[2].info.join(' '), /그림 파일/, '못 읽은 것을 «통과»로 치지 않고 밝힌다');
  assert.equal(r.ok, false);
});
test('다 갖추면 통과 — 단 못 읽은 파일이 있어도 «경고»는 아니다(정보로 밝힌다)', () => {
  const r = S.checkFiles([{ name: '지원서.hwp', size: 1, text: '지원서' }, { name: '이력서.hwp', size: 1, text: '' }],
    { year: 2026, need: ['apply', 'resume'], today: '2026-01-01' });
  assert.equal(r.ok, true);
  assert.equal(S.checkFiles([], { need: ['apply'] }).ok, false);
});
test('첨부가 20MB 넘으면 알린다 · 오늘이 마감일이면 알린다', () => {
  const r = S.checkFiles([{ name: '지원서.pdf', size: 21 * 1048576, text: '지원서' }], { need: ['apply'], due: '2026-01-01', today: '2026-01-01' });
  assert.ok(r.top.some((t) => /20MB/.test(t))); assert.ok(r.top.some((t) => /오늘이 마감일/.test(t)));
});
