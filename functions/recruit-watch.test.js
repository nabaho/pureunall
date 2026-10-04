/* 컨설턴트 모집 감시(서버) — recruit-watch.js
   가짜 게시판으로 돌린다. 네트워크를 안 쓴다.
   제목들은 2026-10-04 실제 게시판 11곳에서 읽은 것을 그대로 옮겼다(공개 공지 제목). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./recruit-watch');

const BOARD_TR = `<table><thead><tr><th>번호</th><th>제목</th><th>작성일</th></tr></thead><tbody>
<tr><td>12</td><td class="tit"><a href="javascript:fn_view('77')">2026년 하반기 지방공기업평가원 정책연구 및 컨설팅 외부연구진 풀(Pool) 공개 모집</a></td><td>2026-06-09</td></tr>
<tr><td>11</td><td><a href="/bbs/list.do?cat=7">[공지사항 게시판]</a> <a href="/bbs/view.do?id=76&amp;m=1">지방공기업평가원 위촉직이사 모집 재공고</a> <a href="/f/1.hwp">첨부</a></td><td>2026.07.08</td></tr>
<tr><td>10</td><td><a href="/bbs/view.do?id=75">2026년 지방공공기관 혁신 우수사례 공모 결과</a></td><td>2026-09-16</td></tr>
<tr><td>9</td><td><a href="/bbs/view.do?id=74">충남지식산업센터 입주기업 모집공고</a></td><td>2026-09-22</td></tr>
</tbody></table>`;
const BOARD_LI = `<ul class="list"><li><a href="view.cs?no=5"><span>[모집]</span> 2027년 농촌융복합산업 현장코칭 전문위원 모집</a><span class="date">2026년 12월 3일</span></li>
<li><a href="view.cs?no=4">2026년 농촌융복합산업 우수사례 경진대회 참여자 모집</a><span>2026.06.05</span></li>
<li><a href="#">메뉴</a></li>
<li><a href="/menu/recruit">컨설턴트 모집 안내 바로가기</a></li></ul>`;

test('★ 표 줄에서 제목·날짜를 뽑는다 — 머리줄은 버리고, 가장 긴 링크 글자가 제목', () => {
  const r = W.parseRows(BOARD_TR, 'https://www.erc.re.kr/usr/com/prm/BBSList.do');
  assert.equal(r.length, 4);
  assert.equal(r[1].title, '지방공기업평가원 위촉직이사 모집 재공고', '앞의 분류 링크·뒤의 「첨부」가 아니라 «가장 긴» 제목');
  assert.equal(r[1].date, '2026-07-08', '2026.07.08 → 2026-07-08');
  assert.equal(r[1].href, 'https://www.erc.re.kr/bbs/view.do?id=76&m=1', '상대 주소를 풀고 &amp; 를 되돌린다');
  assert.equal(r[0].href, '', 'javascript: 는 비운다(서버가 열 주소가 아니다)');
});

test('★ 목록(<li>) 줄과 「2026년 12월 3일」 꼴 날짜도 읽는다', () => {
  const r = W.parseRows(BOARD_LI, 'https://xn--980b99s59h34f6tl.com/home/board/B0030.cs');
  assert.equal(r.length, 2, '날짜 없는 메뉴 줄은 버린다 — 제목이 «모집 안내»처럼 길어도');
  assert.equal(r[0].date, '2026-12-03');
  assert.match(r[0].title, /현장코칭 전문위원 모집/);
});

test('날짜가 말이 안 되면 버린다', () => {
  assert.equal(W.parseRows('<tr><td><a href="/x">아무개 전문가 모집 공고</a></td><td>2026-13-40</td></tr>', 'https://a.b/').length, 0);
});

test('★★ 사람을 뽑는 글만 — 실측 제목으로', () => {
  [
    '2026년 하반기 지방공기업평가원 정책연구 및 컨설팅 외부연구진 풀(Pool) 공개 모집',
    '지방공기업평가원 위촉직이사 모집 재공고',
    '직업능력개발사업 외부전문가 모집분야 및 신청자격 안내',
    '2027년 농촌융복합산업 현장코칭 전문위원 모집',
    '2026년 노동전환 컨설팅 수행 컨설턴트 모집 공고',
    '충청남도일자리경제진흥원 비상임이사 공개 모집',
    '2026년 소상공인 역량강화사업 전문가 POOL 모집'
  ].forEach((t) => assert.equal(W.isRecruit(t), true, t));
});
test('★★ 사람을 안 뽑는 글은 거른다 — 실측 잡음 그대로', () => {
  [
    '충남지식산업센터 입주기업 모집공고',
    "(붙임1)'26.10월행복주택예비입주자통합정례모집사전안내문.hwpx (96.44KB)",
    '2026년 지방공공기관 혁신 우수사례 공모 결과',
    '한국농촌경제연구원 원장후보자심사위원회 개최결과',
    '[공모전] 2026년 노인 일자리 및 사회활동 지원사업 수행기관 안전관리 우수사례 공모전',
    '2026년 4기 신체활동 대상자 모집 (10.12. ~ 10.16.)',
    '2026년 마이데이터 컨설팅 및 교육 지원 사업 공모',
    '2026년 제3차 이사회 개최 안내',
    '외부전문가 최종 선정 결과 안내',
    '2026년 노동전환 컨설턴트 모집 결과 안내',      // 누구+뽑는다가 다 있어도 «결과»면 끝난 글
    '외부전문가 간담회 안내',                        // 누구는 있는데 뽑는다가 없다
    '신임 이사장 초빙 공고'                          // «맨 이사»는 이사장까지 걸린다 — 위촉직·비상임·사외만
  ].forEach((t) => assert.equal(W.isRecruit(t), false, t));
});

const BOARDS = [{ id: 'erc', org: 'erc', name: '평가원', url: 'https://www.erc.re.kr/list' },
  { id: 'agri6', org: 'agri6', name: '6차', url: 'https://x.example/b' },
  { id: 'dead', org: 'lh', name: '죽은 곳', url: 'https://dead.example/' },
  { id: 'empty', org: 'tp', name: '빈 곳', url: 'https://empty.example/' }];
function fake(u) {
  if (u.indexOf('erc') >= 0) return Promise.resolve(BOARD_TR);
  if (u.indexOf('x.example') >= 0) return Promise.resolve(BOARD_LI);
  if (u.indexOf('empty') >= 0) return Promise.resolve('<html>프로그램으로 그리는 쪽</html>');
  return Promise.reject(new Error('HTTP 503'));
}

test('★★ 한 번 돈다 — 모집 글만 남기고, 고장 난 게시판은 «무엇이» 고장인지 남긴다', async () => {
  const r = await W.run({ boards: BOARDS, fetchText: fake, today: '2026-10-20', nowIso: 'T' });
  const titles = r.hits.map((h) => h.title).sort();
  assert.deepEqual(titles, ['[모집] 2027년 농촌융복합산업 현장코칭 전문위원 모집', '지방공기업평가원 위촉직이사 모집 재공고'],
    '6월 외부연구진 글은 133일 지나 빠지고, 입주기업·공모 결과·경진대회는 걸러진다');
  const h = r.hits.find((x) => x.board === 'erc');
  assert.equal(h.org, 'erc'); assert.equal(h.href, 'https://www.erc.re.kr/bbs/view.do?id=76&m=1');
  assert.deepEqual(r.errors.map((e) => e.board).sort(), ['dead', 'empty']);
  assert.match(r.errors.find((e) => e.board === 'empty').why, /모양이 바뀌었을/);
  assert.equal(r.checked, 4);
});

test('★ 주소를 모르는 글은 게시판 주소로 보낸다 — 막다른 링크 금지', async () => {
  const r = await W.run({ boards: BOARDS.slice(0, 1), fetchText: fake, today: '2026-07-10' });
  const pool = r.hits.find((x) => /외부연구진/.test(x.title));
  assert.equal(pool.href, 'https://www.erc.re.kr/list');
});

test('★ 오래된 글(120일 넘음)은 처음 봐도 안 남긴다 — 첫날 과거 글이 쏟아지지 않게', async () => {
  const r = await W.run({ boards: BOARDS.slice(0, 1), fetchText: fake, today: '2026-12-10' });
  assert.ok(!r.hits.some((x) => /외부연구진/.test(x.title)), '6월 글은 12월에 새로 안 남긴다');
});

test('★★ 이미 본 글은 다시 안 남긴다 — 열쇠는 게시판+제목+날짜', async () => {
  const a = await W.run({ boards: BOARDS, fetchText: fake, today: '2026-10-20' });
  const have = {}; a.hits.forEach((h) => { have[h.key] = h; });
  const b = await W.run({ boards: BOARDS, fetchText: fake, today: '2026-10-20', existing: have });
  assert.ok(a.hits.length >= 2, '처음엔 남긴다');
  assert.equal(b.hits.length, 0);
  assert.equal(W.keyOf('erc', { title: 'a', date: '2026-01-02' }), W.keyOf('erc', { title: 'a', date: '2026-01-02' }));
  assert.notEqual(W.keyOf('erc', { title: 'a', date: '2026-01-02' }), W.keyOf('erc', { title: 'a', date: '2026-01-03' }));
  assert.match(W.keyOf('erc', { title: 'a.b#c$[d]/', date: '2026-01-02' }), /^[A-Za-z0-9_]+$/, 'RTDB 열쇠에 못 쓰는 글자 없음');
});

test('★ 쓸 것 — 새 글만 더하고, 넘치면 오래된 것부터 지운다(있던 글은 고치지 않는다)', () => {
  const existing = {}; for (let i = 0; i < W.MAX_KEEP; i++) existing['k' + i] = { date: '2025-01-' + String(1 + (i % 28)).padStart(2, '0') };
  const res = { hits: [{ key: 'new1', date: '2026-10-01', title: 't' }], errors: [], counts: { erc: 3 }, checked: 1 };
  const u = W.updatesOf(res, existing, 'NOW');
  assert.equal(u['hits/new1'].title, 't');
  const removed = Object.keys(u).filter((k) => u[k] === null);
  assert.equal(removed.length, 1, '하나 넘쳤으니 하나만 지운다');
  assert.equal(existing[removed[0].slice(5)].date, '2025-01-01', '가장 오래된 것');
  assert.deepEqual(u.last, { at: 'NOW', checked: 1, added: 1, errors: [], counts: { erc: 3 } });
  const few = W.updatesOf(res, { a: { date: '2020-01-01' } }, 'NOW');
  assert.equal(Object.values(few).filter((v) => v === null).length, 0, '안 넘치면 안 지운다');
});

test('★ euc-kr 게시판도 글자가 안 깨진다', () => {
  const html = '<meta charset="euc-kr"><a>';
  const bytes = Buffer.concat([Buffer.from(html, 'latin1'), Buffer.from([0xb8, 0xf0, 0xc1, 0xfd])]); // 「모집」
  assert.match(W.decode(bytes, 'text/html'), /모집/);
  assert.equal(W.decode(Buffer.from('모집', 'utf8'), 'text/html; charset=utf-8'), '모집');
});

test('★★ 게시판 목록 — https 만, 기관 번호가 화면 사전과 맞는다, 번호 안 겹침', () => {
  const R = require('../js/gov-recruit.js');
  const orgs = R.ORGS.map((o) => o.id);
  W.BOARDS.forEach((b) => {
    assert.match(b.url, /^https:\/\//, b.id);
    /* 빈 org = 여러 기관 글이 섞인 게시판(공인노무사회) — 제목으로 정한다(ORG_HINTS) */
    assert.ok(b.org === '' || orgs.indexOf(b.org) >= 0, b.id + ' → ' + b.org + ' 가 화면 사전에 없다');
  });
  assert.equal(new Set(W.BOARDS.map((b) => b.id)).size, W.BOARDS.length);
});

/* 2026-10-04 더한 넷 — 이 파일의 parseRows·isRecruit 로 실제 게시판을 재어 본 제목 그대로 */
test('★ 더한 게시판 넷 — 들어 있고, 실제 제목에서 «사람 뽑는 글»만 고른다', () => {
  ['semas', 'cepa', 'sinbo', 'keli'].forEach((id) =>
    assert.ok(W.BOARDS.some((b) => b.id === id && b.org === id), id + ' 게시판이 빠졌다'));
  [
    '「산업·일자리전환 지원센터」컨설턴트 추가 모집 공고',
    '충남 국적 Dream 사업 강사·멘토 인력풀(POOL) 모집 재공고',
    '소상공인시장진흥공단 비상임이사 모집공고'
  ].forEach((t) => assert.equal(W.isRecruit(t), true, '놓친다: ' + t));
  [
    '[모집중] 충남신용보증재단 10월 소상공인 교육생 모집 공고',
    '2026년 충청남도 도시재생 주민참여 경진대회 참가단체 모집공고',
    '2026년 생애주기별 노동교육 전문가 양성과정 선발 결과 공고'
  ].forEach((t) => assert.equal(W.isRecruit(t), false, '잡음을 잡는다: ' + t));
});

test('★ 신보처럼 제목 링크가 «#contents + onclick» 이어도 제목은 읽고, 주소는 비운다', () => {
  const html = '<table><tbody><tr><td>공지</td><td class="link"><a href="#contents" title="x" onclick="goView(\'134\',\'33908\')">'
    + '<strong>[모집중] 2027년 컨설턴트 모집 공고</strong></a></td><td>2026-09-02</td></tr></tbody></table>';
  const rows = W.parseRows(html, 'https://www.cnsinbo.co.kr/boardCnts/list.do?boardID=134');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '2027년 컨설턴트 모집 공고', '[모집중] 딱지는 뗀다(딱지가 바뀌면 같은 글이 또 들어온다)');
  assert.equal(rows[0].date, '2026-09-02');
  assert.equal(rows[0].href, '', '#contents 는 열 주소가 아니다 — 화면이 게시판 주소로 보낸다');
});

/* ═══ 노사발전재단 (2026-10-04 대표 지시 「노발 진행」) ═══ */

/* 노사발전재단 사업공고/모집 한 줄 — 실측 모양 그대로(제목 링크 + 첨부 목록) */
const NOSA_TR = `<table><tbody><tr> <td class="table_con cf"> <div class="table_num">1236</div> <div class="table_top"> <div class="table_title">
<p class="txt_title"><a style="cursor:pointer;" class="txt_ellipsis" onclick="ebList.readBulletin('nosa05','11790646998545')">[선정공고] 2026년 재취업지원서비스 기업컨설팅 6차 지원사업장 선정공고</a></p> </div>
<div class="table_tiny cf"> <div class="table_day">2026.09.29</div> <div class="table_writer">기업고용지원팀 </div> </div> </div>
<div class="table_bottom cf"> <ul class="table_file"> <li class="xlsx"><a href='fileMngr?cmd=down&boardId=nosa05&bltnNo=11790646998545&fileSeq=1&subId=sub06' target='download'>붙임. (선정공고) 2026년 재취업지원서비스 기업컨설팅 6차 지원사업장 명단.xlsx</a></li> </ul> </div> </td> </tr></tbody></table>`;

test('★★ 첨부 파일 이름을 제목으로 잡지 않는다 — 노사발전재단·LH 실측', () => {
  const rows = W.parseRows(NOSA_TR, 'https://www.nosa.or.kr/board/bltnMngr?boardId=nosa05&');
  const 제목들 = rows.map((r) => r.title);
  assert.ok(제목들.includes('[선정공고] 2026년 재취업지원서비스 기업컨설팅 6차 지원사업장 선정공고'), JSON.stringify(제목들));
  assert.ok(!제목들.some((t) => /\.xlsx$/.test(t)), '첨부 이름이 제목이 됐다: ' + JSON.stringify(제목들));
  /* LH 꼴 — 파일 이름이 링크 주소가 아니라 «글자»에만 드러나도 거른다 */
  const lh = '<table><tr><td><a href="/board.es?act=view&list_no=1">2026년도 수급조절용 비축토지 매입 공고</a> '
    + '<a href="/attach/1">붙임2. 2026년도 「수급조절용 비축토지」 매입 공고문_.pdf</a></td><td>2026-09-30</td></tr></table>';
  assert.equal(W.parseRows(lh, 'https://www.lh.or.kr/')[0].title, '2026년도 수급조절용 비축토지 매입 공고');
  /* 파일 링크밖에 없는 줄은 그래도 파일 이름을 쓴다(줄을 통째로 버리지 않는다) */
  const only = '<table><tr><td><a href="/fileMngr?cmd=down&x=1">2025년도 강사 풀(Pool) 참여 신청서.pdf</a></td><td>2025-02-11</td></tr></table>';
  assert.equal(W.parseRows(only, 'https://www.nosa.or.kr/board/')[0].title, '2025년도 강사 풀(Pool) 참여 신청서.pdf');
});

test('★★ 잠깐 붙는 딱지(새글·[모집중]·NEW)는 떼어 — 딱지가 바뀌어도 같은 글이 또 안 들어온다', async () => {
  const 줄 = (t) => '<table><tr><td><a href="/v?1">' + t + '</a></td><td>2026-10-01</td></tr></table>';
  const 처음 = W.parseRows(줄('[모집중] 2027년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고'), 'https://a.kr/')[0];
  const 나중 = W.parseRows(줄('[모집마감] 2027년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고'), 'https://a.kr/')[0];
  assert.equal(처음.title, '2027년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고');
  assert.equal(W.keyOf('kcplaa', 처음), W.keyOf('kcplaa', 나중), '딱지가 바뀌면 열쇠가 달라져 같은 글이 두 번 들어온다');
  assert.equal(W.parseRows(줄('새글 2027년 공정채용 컨설턴트 모집'), 'https://a.kr/')[0].title, '2027년 공정채용 컨설턴트 모집');
  assert.equal(W.parseRows(줄('2027년 공정채용 컨설턴트 모집 NEW'), 'https://a.kr/')[0].title, '2027년 공정채용 컨설턴트 모집');
  /* 「[모집공고]」는 딱지가 아니라 글의 종류다 — 남긴다 */
  assert.equal(W.parseRows(줄('[모집공고] 2027년 컨설턴트 모집'), 'https://a.kr/')[0].title, '[모집공고] 2027년 컨설턴트 모집');
  /* 그리고 run 이 실제로 그 열쇠로 거른다 */
  const 있던 = {}; 있던[W.keyOf('kcplaa', 처음)] = { date: '2026-10-01' };
  const r = await W.run({ boards: [{ id: 'kcplaa', org: '', name: 'x', url: 'https://a.kr/' }], existing: 있던, today: '2026-10-02',
    fetchText: async () => 줄('[모집마감] 2027년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고') });
  assert.equal(r.hits.length, 0, '딱지만 바뀐 글이 새 글로 들어왔다');
});

test('★★ 공인노무사회 공지 — 기관 모집 공문은 잡고, 교육생·시상·서식은 거른다 (실측 제목)', () => {
  [
    '2023년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고',
    '2022년도 공무직 노사협력 프로그램 사업 컨설턴트 모집공고',
    '2022년도 공공부문 고용개선 컨설팅 컨설턴트 모집',
    '2023년도 비정규직 고용구조개선 지원단 컨설팅 사업 프로젝트 매니저(PM) 모집 공고',
    '2023년 NCS 기업활용 컨설팅 사업 컨설턴트 모집 공고',
    '2024년 공정채용 컨설팅 사업 컨설턴트 모집',
    '2023년 근로조건 자율개선 지원사업(기초노동질서 자율점검 지원) 수행노무사 모집 공고'
  ].forEach((t) => assert.equal(W.isRecruit(t), true, '놓친다: ' + t));
  [
    '제3기 고용노사관계 전문가과정 교육생 모집안내',
    '한국공인노무사회 국제심포지엄 안내 및 참가신청',
    '위험성평가 컨설팅 전문가과정 대전 강좌 신청 독려',
    '우수 공인노무사 시상 추천 접수',
    '공인노무사 자격증(발급,재발급) 신청서식',
    '[갈등조정전문가 기본과정8기 모집안내]',
    '2026년 생애주기별 노동교육 전문가 양성과정 대상자 모집'
  ].forEach((t) => assert.equal(W.isRecruit(t), false, '잡음을 잡는다: ' + t));
});

test('★★ 여러 기관이 섞인 게시판은 제목으로 기관을 정한다 — 찾는 말은 화면 사전(js/gov-recruit.js)과 글자 하나까지 같다', async () => {
  const R = require('../js/gov-recruit.js');
  W.ORG_HINTS.forEach(([id, re]) => {
    const o = R.ORGS.find((x) => x.id === id);
    assert.ok(o, id + ' 가 화면 사전에 없다');
    assert.equal(re.source, o.re.source, id + ' 의 찾는 말이 화면 사전과 다르다 — 🆕 가 엉뚱한 줄에 붙는다');
  });
  assert.equal(W.orgHint('2023년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고'), 'nosa');
  assert.equal(W.orgHint('2023년 NCS 기업활용 컨설팅 사업 컨설턴트 모집 공고'), 'hrdk');
  assert.equal(W.orgHint('2022년 노동시간 단축 전문가 컨설팅 PM 모집 안내'), '', '모르면 지어내지 않는다');
  /* run 이 실제로 쓴다 — 기관이 정해진 게시판(org)이 이기고, 빈 게시판만 제목으로 */
  const html = '<table><tr><td><a href="/v?1">2027년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고</a></td><td>2026-12-20</td></tr>'
    + '<tr><td><a href="/v?2">2027년 NCS 기업활용 컨설팅 사업 컨설턴트 모집 공고</a></td><td>2026-12-21</td></tr></table>';
  const r = await W.run({ boards: [{ id: 'kcplaa', org: '', name: '공인노무사회', url: 'https://www.kcplaa.or.kr/bbs/notice/list' },
    { id: 'erc', org: 'erc', name: '평가원', url: 'https://e.kr/' }], existing: {}, today: '2026-12-22', fetchText: async () => html });
  const 기관 = r.hits.map((h) => h.board + ':' + h.org).sort();
  assert.deepEqual(기관, ['erc:erc', 'erc:erc', 'kcplaa:hrdk', 'kcplaa:nosa']);
});

test('★ 노사발전재단 — 서버는 틀(iframe) 주소를 읽고, 링크 없는 글은 사람이 보는 바깥 화면으로 보낸다', async () => {
  const b = W.BOARDS.find((x) => x.id === 'nosa');
  assert.ok(b && /boardId=nosa05/.test(b.url), '노사발전재단 게시판이 빠졌다');
  assert.equal(b.page, 'https://www.nosa.or.kr/portal/nosa/FoundNews/bizNotice');
  const k = W.BOARDS.find((x) => x.id === 'kcplaa');
  assert.ok(k && k.org === '' && /kcplaa\.or\.kr\/bbs\/notice\/list$/.test(k.url), '공인노무사회 공지가 빠졌다');
  const html = '<table><tr><td><a onclick="ebList.readBulletin(\'nosa05\',\'1\')">2026년 상생파트너십 현장지원 코칭 전문가 모집 공고</a></td><td>2026-09-26</td></tr></table>';
  const r = await W.run({ boards: [b], existing: {}, today: '2026-10-01', fetchText: async () => html });
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].href, b.page, '틀 주소(맨 목록)로 보내면 사람이 길을 잃는다');
});
