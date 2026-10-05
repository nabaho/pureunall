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

/* ═══ 공인노무사회 회원 공지 — 로그인해야 보인다 (2026-10-04 「회원 공지 진행」) ═══ */

test('★★ 로그인 게시판만 로그인한 손으로 읽고, 로그인은 한 번만 한다', async () => {
  let 로그인 = 0; const 읽은 = [];
  const f = W.makeFetcher({
    plain: async (u) => { 읽은.push('plain ' + u); return 'P'; },
    login: async (kind) => { 로그인++; assert.equal(kind, 'kcplaa'); return async (u) => { 읽은.push('login ' + u); return 'L'; }; }
  });
  const 회원 = W.BOARDS.find((b) => b.id === 'kcplaa_m');
  assert.ok(회원 && 회원.login === 'kcplaa' && 회원.org === '' && /kcplaa\.or\.kr\/bbs\/news\/list$/.test(회원.url), '회원 공지 게시판이 빠졌다');
  assert.equal(await f('https://a/1', { id: 'erc' }), 'P');
  assert.equal(await f(회원.url, 회원), 'L');
  assert.equal(await f(회원.url + '?page=2', 회원), 'L');
  assert.equal(await f('https://a/2'), 'P', '게시판을 안 넘기면(옛 부르는 쪽) 그냥 읽는다');
  assert.equal(로그인, 1, '로그인을 여러 번 했다');
  assert.deepEqual(읽은, ['plain https://a/1', 'login ' + 회원.url, 'login ' + 회원.url + '?page=2', 'plain https://a/2']);
});

test('★★ 로그인이 실패하면 그 게시판만 오류 — 나머지는 돈다, 같은 날 비밀번호를 다시 안 보낸다', async () => {
  let 로그인 = 0;
  const f = W.makeFetcher({
    plain: async () => '<table><tr><td><a href="/v?1">2027년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고</a></td><td>2026-12-20</td></tr></table>',
    login: async () => { 로그인++; throw new Error('로그인 실패: 비밀번호'); }
  });
  const 회원 = W.BOARDS.find((b) => b.login);
  const 둘 = [회원, { id: 'kcplaa', org: '', name: '공지', url: 'https://www.kcplaa.or.kr/bbs/notice/list' }, Object.assign({}, 회원, { id: 'kcplaa_m2' })];
  const r = await W.run({ boards: 둘, existing: {}, today: '2026-12-22', fetchText: f });
  assert.deepEqual(r.errors.map((e) => e.board), ['kcplaa_m', 'kcplaa_m2']);
  assert.match(r.errors[0].why, /로그인 실패/);
  assert.equal(r.hits.length, 1, '로그인 없는 게시판까지 멈췄다');
  assert.equal(r.hits[0].org, 'nosa');
  assert.equal(로그인, 1, '실패한 로그인을 또 시도했다 — 남의 서버에 비밀번호를 거듭 보낸다');
});

test('★ 처음 훑기 — 여러 쪽을 읽어 줄 수·기간·모집 글을 남기고, 쪽이 안 넘어가면 멈춘다', async () => {
  const 회원 = W.BOARDS.find((b) => b.login);
  const 쪽 = {
    1: [['2026-09-30', '2027년도 공무직 노사협력 프로그램 사업 컨설턴트 모집공고'], ['2026-09-01', '회원 연수 일정 안내']],
    2: [['2025-02-03', '2025년 NCS 기업활용 컨설팅 사업 컨설턴트 모집 공고'], ['2025-01-02', '제5기 고용노사관계 전문가과정 교육생 모집']],
    3: [['2025-02-03', '2025년 NCS 기업활용 컨설팅 사업 컨설턴트 모집 공고']]   // 2쪽과 같은 첫 줄이 아니면 계속
  };
  const html = (rows) => '<table>' + rows.map(([d, t], i) => '<tr><td><a href="/v?' + i + '">' + t + '</a></td><td>' + d + '</td></tr>').join('') + '</table>';
  const 부른 = [];
  const r = await W.probeBoard({ board: 회원, pages: 5, fetchText: async (u, b) => {
    assert.equal(b, 회원, '로그인 손으로 읽으려면 게시판을 넘겨야 한다');
    부른.push(u); const p = Number(/page=(\d+)/.exec(u)[1]); return 쪽[p] ? html(쪽[p]) : '<p>끝</p>';
  } });
  assert.equal(r.board, 'kcplaa_m');
  assert.equal(r.pages, 3); assert.equal(r.rows, 5);
  assert.equal(r.to, '2026-09-30'); assert.equal(r.from, '2025-02-03');
  assert.deepEqual(r.recruit.map((x) => x.org + ':' + x.date), ['nosa:2026-09-30', 'hrdk:2025-02-03', 'hrdk:2025-02-03']);
  assert.equal(부른.length, 4, '빈 쪽에서 멈춰야 한다');
  assert.match(부른[0], /news\/list\?page=1$/);
  /* 쪽 번호를 무시하는 게시판 — 같은 첫 줄이 되풀이되면 멈춘다(끝없이 읽지 않는다) */
  const 늘같음 = await W.probeBoard({ board: 회원, pages: 5, fetchText: async () => html(쪽[1]) });
  assert.equal(늘같음.pages, 1); assert.equal(늘같음.rows, 2);
});

/* ═══ 공인노무사회 (대표 지시 2026-10-04 「공인노무사회에서 컨설턴트 모집 또는 고문 자문 노무사 모집등 공고도 수집」) ═══
   제목은 2026-10-04 실제 «채용 정보»에서 옮겼다(공개 게시판). */
test('★★ 공인노무사회 — 노무사에게 «맡기는» 글만, 노무법인 직원 채용·공무원 채용시험은 거른다', () => {
  ['직장 내 괴롭힘 사건 외부 조사자 선임 공고',
    'AI 노동법 상담서비스 개선지원단 DB작성 담당자 모집의 건',
    '○○공사 고문노무사 모집 공고',
    '△△시 노동권익센터 자문위원 추천 요청'
  ].forEach((t) => assert.equal(W.isKcplaa(t), true, t));
  ['[ 노무법인 청파 본사 ] 경력 노무사 모집공고 (포항)',
    '[노무법인 이산] 공인노무사 모집(법률센터/서울)',
    '경기도청 임기제(공인노무사) 채용 공고',
    '충남대학교 국가공무원(전문경력관 나군(노무 담당)) 경력경쟁채용시험 공고',
    '[인사노무컨설팅 율] 임금·4대보험 아웃소싱 담당자 채용',
    '[홍익노무법인 부산지사] 수습노무사 및 경력노무사 초빙',
    '한국공인노무사회 유튜브 토크쇼 출연 참여자 모집 안내',
    '청년위원회「퍼스널 브랜딩·마케팅 전략 코칭 프로그램」 2회차 개최 안내',
    '[노무법인 가나] 산재 전문 컨설턴트 모집',      // 누구·뽑는다가 다 있어도 노무법인의 직원 채용
    '2026년 공인노무사 직무교육 강사 모집 결과'     // 끝난 글
  ].forEach((t) => assert.equal(W.isKcplaa(t), false, t));
});
test('★ 게시판마다 잣대를 고른다 — 공인노무사회는 rule, 나머지는 isRecruit', () => {
  const kc = { rule: 'kcplaa' }, other = { id: 'erc' };
  assert.equal(W.pass(kc, '직장 내 괴롭힘 사건 외부 조사자 선임 공고'), true);
  assert.equal(W.pass(other, '직장 내 괴롭힘 사건 외부 조사자 선임 공고'), false, '일반 잣대엔 「조사자·선임」이 없다');
  assert.equal(W.pass(kc, '[노무법인 이산] 공인노무사 모집(법률센터/서울)'), false);
  assert.equal(W.pass(other, '[노무법인 이산] 공인노무사 모집(법률센터/서울)'), true, '일반 잣대는 「노무사 모집」을 잡는다 — 그래서 공인노무사회엔 따로 쓴다');
});
test('★★ 한 번 돌 때 공인노무사회도 같은 열쇠·같은 자리에 남는다', async () => {
  const kcHtml = '<table><tbody>'
    + '<tr><td><a href="/worker/view/22797?scd=1">직장 내 괴롭힘 사건 외부 조사자 선임 공고</a></td><td>2026-09-30</td></tr>'
    + '<tr><td><a href="/worker/view/22796?scd=1">[노무법인 이산] 공인노무사 모집(법률센터/서울)</a></td><td>2026-09-30</td></tr></tbody></table>';
  const r = await W.run({ boards: W.BOARDS.filter((b) => b.id === 'kcplaa_job'), fetchText: () => Promise.resolve(kcHtml), today: '2026-10-04' });
  assert.deepEqual(r.hits.map((h) => h.title), ['직장 내 괴롭힘 사건 외부 조사자 선임 공고']);
  assert.equal(r.hits[0].org, 'kcplaa');
  assert.equal(r.hits[0].href, 'https://www.kcplaa.or.kr/worker/view/22797?scd=1');
});

/* ── 시간 셈 (검토 2026-10-04) — 서버는 300초에 끊기고, 끊기면 그날 읽은 것을 하나도 못 남긴다 ── */
const 한줄 = (t) => '<table><tr><td><a href="/v?1">' + t + '</a></td><td>2026-10-01</td></tr></table>';
const 판 = (id) => ({ id, org: 'x', name: id, url: 'https://' + id + '.kr/' });
const 멈춤 = () => new Promise(() => {});   // 영영 답이 없는 게시판

test('★★★ 한 게시판이 «영영» 답이 없어도 나머지는 남는다 — 그 곳만 «너무 오래 걸림»', async () => {
  const boards = [판('a'), 판('b'), 판('c')];
  const r = await W.run({ boards, today: '2026-10-02', boardMs: 60, totalMs: 5000,
    fetchText: (u, b) => b.id === 'b' ? 멈춤() : Promise.resolve(한줄(b.id + ' 컨설턴트 모집 공고')) });
  assert.deepEqual(r.hits.map((h) => h.board), ['a', 'c']);
  assert.equal(r.errors.length, 1); assert.equal(r.errors[0].board, 'b');
  assert.match(r.errors[0].why, /오래 걸려/);
});

test('★★★ 전체 마감을 넘기면 «못 읽은 곳»은 오류로 적고 끝낸다 — 읽은 것은 남는다', async () => {
  let 시계 = 0;
  const boards = [판('a'), 판('b'), 판('c'), 판('d')];
  const r = await W.run({ boards, today: '2026-10-02', together: 1, totalMs: 100, now: () => 시계,
    fetchText: async (u, b) => { 시계 += 60; return 한줄(b.id + ' 컨설턴트 모집 공고'); } });
  /* a(0→60) b(60→120) 는 읽고, c 는 시작할 때 이미 120 > 100 → 못 읽음, d 도 */
  assert.deepEqual(r.hits.map((h) => h.board), ['a', 'b']);
  assert.deepEqual(r.errors.map((e) => e.board), ['c', 'd']);
  r.errors.forEach((e) => assert.match(e.why, /시간이 모자라/));
  assert.equal(r.checked, 4, '몇 곳을 보려 했는지는 그대로');
});

test('★★ 몇 곳씩 «함께» 읽는다 — 하나씩 차례로면 17곳이 다 느릴 때 5분을 넘긴다', async () => {
  let 지금 = 0, 최대 = 0;
  const boards = ['a', 'b', 'c', 'd', 'e', 'f'].map(판);
  await W.run({ boards, today: '2026-10-02', together: 3,
    fetchText: async (u, b) => { 지금++; 최대 = Math.max(최대, 지금); await new Promise((ok) => setTimeout(ok, 15)); 지금--; return 한줄(b.id + ' 모집'); } });
  assert.equal(최대, 3, '함께 읽는 수가 정한 만큼이어야 한다');
  assert.ok(W.LIMITS.together >= 2 && W.LIMITS.together <= 6, '기본값은 몇 곳씩');
  assert.ok(W.LIMITS.totalMs <= 240000, '전체 마감은 300초보다 넉넉히 앞서야 쓸 시간이 남는다');
});

test('★★ 함께 읽어도 결과 차례는 «게시판 차례» 그대로 — 날마다 같은 답', async () => {
  const boards = [판('a'), 판('b'), 판('c')];
  const 늦게 = { a: 30, b: 0, c: 10 };
  const r = await W.run({ boards, today: '2026-10-02', together: 3,
    fetchText: async (u, b) => { await new Promise((ok) => setTimeout(ok, 늦게[b.id])); return 한줄(b.id + ' 컨설턴트 모집'); } });
  assert.deepEqual(r.hits.map((h) => h.board), ['a', 'b', 'c']);
});

test('★★ 시간이 지나 그만둔 게시판이 «다른 곳을 읽는 사이» 끝나도 그 글은 안 섞인다', async () => {
  /* ⚠ 윈도 시계는 15ms 단위로 튄다 — 여유를 넉넉히(그만두기 100ms · 빠른 곳 20ms · 늦은 곳 200ms) */
  const 쉼 = (ms) => new Promise((ok) => setTimeout(ok, ms));
  /* 차례로(together 1): a 는 100ms 에 그만두고 200ms 에 답 · b 는 그 뒤 100~400ms 동안 돈다 → 모을 때 a 의 답은 이미 왔다 */
  const r = await W.run({ boards: [판('a'), 판('b')], today: '2026-10-02', together: 1, boardMs: 100,
    fetchText: async (u, b) => { if (b.id === 'a') { await 쉼(200); } else { await 쉼(20); await 쉼(250); return 멈춤(); } return 한줄(b.id + ' 컨설턴트 모집'); },
  });
  assert.deepEqual(r.hits.map((h) => h.board), [], '그만둔 게시판의 늦은 답이 섞였다');
  assert.deepEqual(r.errors.map((e) => e.board), ['a', 'b']);
  /* 함께(together 2): a 그만둠(늦은 답 200ms) · b 는 20ms 에 제때 · c 는 300ms 뒤 그만둠 */
  const r2 = await W.run({ boards: [판('a'), 판('b'), 판('c')], today: '2026-10-02', together: 2, boardMs: 100,
    fetchText: async (u, b) => { await 쉼(b.id === 'a' ? 200 : b.id === 'b' ? 20 : 300); return 한줄(b.id + ' 컨설턴트 모집'); },
  });
  assert.deepEqual(r2.hits.map((h) => h.board), ['b']);
  assert.deepEqual(r2.errors.map((e) => e.board), ['a', 'c']);
});

test('★ 제목 «뒤»에 붙는 딱지(마감)·[모집중]도 뗀다 — 같은 글이 두 번 안 들어온다', () => {
  assert.equal(W.parseRows(한줄('2027년 공정채용 컨설턴트 모집 (마감)'), 'https://a.kr/')[0].title, '2027년 공정채용 컨설턴트 모집');
  assert.equal(W.parseRows(한줄('2027년 공정채용 컨설턴트 모집[모집중]'), 'https://a.kr/')[0].title, '2027년 공정채용 컨설턴트 모집');
  /* 괄호 안이 딱지가 아니면 남긴다 */
  assert.equal(W.parseRows(한줄('강사 모집 (재공고)'), 'https://a.kr/')[0].title, '강사 모집 (재공고)');
});

test('★★ 서버 — 처음 훑기는 남은 시간이 있을 때만, 그것도 시간 제한을 걸고', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, 'index.js'), 'utf8');
  const i = src.indexOf('exports.recruitWatch'); const body = src.slice(i, src.indexOf('exports.', i + 30));
  assert.match(body, /const 시작 = Date\.now\(\)/);
  assert.match(body, /남은 > 60000/);
  assert.match(body, /Promise\.race\(\[\s*RecruitWatch\.probeBoard/);
  /* 읽은 것은 훑기보다 «먼저» 쓴다 — 훑다 끊겨도 그날 결과는 남는다 */
  assert.ok(body.indexOf('root.update(RecruitWatch.updatesOf') < body.indexOf('probeBoard'), '쓰기가 훑기보다 뒤에 있다');
});

/* ── 접수 기간 (대표 지시 2026-10-05 「서류에 기간이 있다 — 날짜가 지났는지 반드시 표시」) ── */
const PER_CASES = [
  /* 2026-10-05 실제 본문 문구 그대로 */
  ['「산업·일자리전환 지원센터」컨설턴트 추가 모집 공고 모집기간 : 2026-06-22 ~ 2026-06-28 / 작성일 : 2026-06-22', '2026-06-22', { from: '2026-06-22', to: '2026-06-28', rolling: false }],
  ['□ 제출기간 및 방법 ○ 제출기간 : 2026. 7. 8.(수) ~ 2026. 7. 20.(월) 18:00까지, 12일간 ○ 제출방법', '2026-07-08', { from: '2026-07-08', to: '2026-07-20', rolling: false }],
  ['제출서류 접수방법 이메일 접수 접수마감일 채용시 마감 기타', '2026-09-30', { from: '', to: '', rolling: true }],
  ['[세종농촌융복합산업지원센터] 현장코칭 전문위원 선정 안내 및 관리카드 작성 요청(~03.27 까지)', '2026-03-20', { from: '', to: '2026-03-27', rolling: false }],
  ['가. 신청기간: 2026. 9. 1.(월) ~ 9. 15.(월) 18:00까지 나. 위촉기간: 2027.1.1~2028.12.31', '2026-08-28', { from: '2026-09-01', to: '2026-09-15', rolling: false }],
  ['□ 접수기간 : 2026년 12월 20일(금) ~ 2027년 1월 10일(금)', '2026-12-15', { from: '2026-12-20', to: '2027-01-10', rolling: false }],
  ['○ 접수 일정 : 12. 22.(월) ~ 1. 9.(금)', '2026-12-15', { from: '2026-12-22', to: '2027-01-09', rolling: false }],
  ['추천 기한: 10. 13.(월)까지 회신', '2026-10-01', { from: '', to: '2026-10-13', rolling: false }],
  ['모집기간: 상시 모집', '2026-05-01', { from: '', to: '', rolling: true }],
  ['10.15(수)까지 접수 — 공정채용 컨설턴트 모집', '2026-10-01', { from: '', to: '2026-10-15', rolling: false }]
];
const PER_NONE = [
  ['사업기간 2026.1.1~2026.12.31 위촉기간 2년', '2026-01-02'],   /* ⚠ 사업·위촉 기간은 마감이 아니다 */
  ['사업 기간: 2026.1.1~12.31', '2026-01-02'],
  ['위촉기간: 2027.1.1~2028.12.31', '2026-10-01'],
  ['2027년 일터혁신 컨설팅 지원사업 컨설턴트 모집 공고', '2026-09-20'],
  /* ⚠ 라벨에서 한참 떨어진 날짜는 접수 기간이 아니다 */
  ['모집기간 및 제출방법 등 자세한 사항은 붙임 공고문을 참고하시기 바랍니다. 사업기간: 2026.1.1~2026.12.31', '2026-01-02']
];
test('★★★ 접수 기간 읽기 — 실제 본문·제목 문구로', () => {
  PER_CASES.forEach(([t, d, want]) => assert.deepEqual(W.periodOf(t, d), want, t));
  PER_NONE.forEach(([t, d]) => assert.equal(W.periodOf(t, d), null, '마감이 아닌 날짜를 읽었다: ' + t));
});
test('★★ 서버와 화면의 기간 읽기는 «같은 답» — 둘이 갈라지면 서버가 붙인 것과 화면이 읽은 것이 다르다', () => {
  const C = require('../js/gov-recruit.js');
  PER_CASES.concat(PER_NONE.map((x) => x.concat([null]))).forEach(([t, d]) => assert.deepEqual(C.periodOf(t, d), W.periodOf(t, d), t));
  /* 글자까지 — 들여쓰기만 다르다 */
  const fs = require('fs'), path = require('path');
  const cut = (src) => src.slice(src.indexOf('var PER_D'), src.indexOf('return null;\n', src.indexOf('function periodOf'))).replace(/^ +/gm, '');
  assert.equal(cut(fs.readFileSync(path.join(__dirname, 'recruit-watch.js'), 'utf8').replace(/\r\n/g, '\n')),
    cut(fs.readFileSync(path.join(__dirname, '..', 'js', 'gov-recruit.js'), 'utf8').replace(/\r\n/g, '\n')));
});
const LIST1 = '<table><tr><td><a href="/v?1">2027년 일터혁신 컨설턴트 모집 공고</a></td><td>2026-10-01</td></tr></table>';
const BODY1 = '<div>공고 본문 … 접수기간 : 2026. 10. 2.(금) ~ 2026. 10. 16.(금) 18:00 까지 … 위촉기간 2027.1.1~2027.12.31</div>';
const B1 = { id: 'tst', org: 'x', name: '시험 공지', url: 'https://t.kr/list' };
test('★★★ 새 글은 본문을 열어 접수 기간을 붙인다 — details 를 켰을 때만', async () => {
  const f = async (u) => (u === B1.url ? LIST1 : BODY1);
  const r = await W.run({ boards: [B1], fetchText: f, today: '2026-10-05', details: true });
  assert.deepEqual(r.hits[0].per, { from: '2026-10-02', to: '2026-10-16', rolling: false });
  const r2 = await W.run({ boards: [B1], fetchText: f, today: '2026-10-05' });
  assert.equal(r2.hits[0].per, undefined, 'details 없이는 본문을 열지 않는다');
});
test('★★ 본문에 없으면 { none } — 날마다 다시 열지 않는다. 제목에서 찾은 것은 지킨다', async () => {
  const L = '<table><tr><td><a href="/v?1">강사 모집 (~10.20 까지)</a></td><td>2026-10-01</td></tr><tr><td><a href="/v?2">컨설턴트 모집 공고</a></td><td>2026-10-01</td></tr></table>';
  const r = await W.run({ boards: [B1], fetchText: async (u) => (u === B1.url ? L : '<p>본문</p>'), today: '2026-10-05', details: true });
  const by = Object.fromEntries(r.hits.map((h) => [h.title, h.per]));
  assert.equal(by['강사 모집 (~10.20 까지)'].to, '2026-10-20');
  assert.deepEqual(by['컨설턴트 모집 공고'], { none: true });
});
test('★★ 이미 있던 글도 하루 몇 건씩 기간을 채운다 — 이미 본 것(to·rolling·none)은 다시 안 연다', async () => {
  const k = W.keyOf('tst', { title: '옛 글', date: '2026-09-01' });
  const have = {
    [k]: { board: 'tst', title: '옛 글', date: '2026-09-01', href: 'https://t.kr/v?9' },
    x1: { board: 'tst', title: '본 글', date: '2026-09-01', href: 'https://t.kr/v?8', per: { none: true } },
    x2: { board: 'tst', title: '목록뿐', date: '2026-09-01', href: B1.url }
  };
  const opened = [];
  const r = await W.run({ boards: [B1], existing: have, today: '2026-10-05', details: true,
    fetchText: async (u) => { opened.push(u); return u === B1.url ? '<table></table>' : BODY1; } });
  assert.deepEqual(r.pers[k], { from: '2026-10-02', to: '2026-10-16', rolling: false });
  assert.ok(!opened.includes('https://t.kr/v?8'), '이미 본 글을 또 열었다');
  assert.ok(!opened.includes(B1.url + '#') && r.pers.x2 === undefined, '목록 주소는 본문이 아니다');
  const u = W.updatesOf(r, have, 'T');
  assert.deepEqual(u['hits/' + k + '/per'], r.pers[k]);
});
test('★★ 프로그램 링크(javascript)에서 본문 주소를 만든다 — 지방공기업평가원·소진공 실측 꼴', () => {
  const erc = W.BOARDS.find((b) => b.id === 'erc'), semas = W.BOARDS.find((b) => b.id === 'semas');
  const e = W.parseRows('<table><tr><td><a href="javascript: void(0);" onclick="fn_detail(\'11513\');"> 지방공기업평가원 위촉직이사 모집 재공고</a></td><td>2026-07-08</td></tr></table>', erc.url, erc);
  assert.match(e[0].href, /BBSDetail\.do\?bbsId=BBSMSTR_000000000251&nttId=11513/);
  const m = W.parseRows('<table><tr><td><a href="javascript:fncGoDetail(\'56585\');"> 소상공인시장진흥공단 비상임이사 모집공고 </a></td><td>2026-09-09</td></tr></table>', semas.url, semas);
  assert.match(m[0].href, /webBoardView\.kmdc\?bCd=1&b_idx=56585/);
  /* 판 정보가 없으면 예전처럼 비운다 */
  assert.equal(W.parseRows('<table><tr><td><a href="javascript:fncGoDetail(\'1\');">소상공인시장진흥공단 비상임이사 모집공고</a></td><td>2026-09-09</td></tr></table>', semas.url)[0].href, '');
});
test('★★ 옛 글의 목록 주소를 본문 주소로 고쳐 쓴다 — 열쇠는 그대로(두 번 안 들어온다)', async () => {
  const B = { id: 'jsb', org: 'x', name: 'js 판', url: 'https://j.kr/list', js: { re: /go\('(\d+)'/, url: 'https://j.kr/view?id={id}' } };
  const L = '<table><tr><td><a href="javascript:go(\'7\');">외부 컨설턴트 모집 공고</a></td><td>2026-09-01</td></tr></table>';
  const k = W.keyOf('jsb', { title: '외부 컨설턴트 모집 공고', date: '2026-09-01' });
  const have = { [k]: { board: 'jsb', title: '외부 컨설턴트 모집 공고', date: '2026-09-01', href: B.url } };
  const r = await W.run({ boards: [B], existing: have, today: '2026-10-05', details: true, fetchText: async (u) => (u === B.url ? L : BODY1) });
  assert.equal(r.hits.length, 0, '옛 글이 새 글로 또 들어왔다');
  assert.equal(r.fixes[k], 'https://j.kr/view?id=7');
  assert.equal(r.pers[k].to, '2026-10-16');
  const u = W.updatesOf(r, have, 'T');
  assert.equal(u['hits/' + k + '/href'], 'https://j.kr/view?id=7');
});
test('★ 지우는 글에는 기간·주소를 안 붙인다 — RTDB 는 부모(null)·자식을 한 번에 못 쓴다', () => {
  const have = {}; for (let i = 0; i < W.MAX_KEEP + 1; i++) have['h' + i] = { date: '2026-01-' + String(1 + (i % 28)).padStart(2, '0') };
  const old = Object.keys(have).sort((a, b) => have[a].date.localeCompare(have[b].date))[0];
  const u = W.updatesOf({ hits: [], errors: [], counts: {}, checked: 0, pers: { [old]: { none: true } }, fixes: { [old]: 'https://x' } }, have, 'T');
  assert.equal(u['hits/' + old], null);
  assert.equal(u['hits/' + old + '/per'], undefined); assert.equal(u['hits/' + old + '/href'], undefined);
});
test('★ 본문 읽기도 전체 마감 안에서만 — 시간이 없으면 안 연다', async () => {
  let t = 0; const opened = [];
  const r = await W.run({ boards: [B1], today: '2026-10-05', details: true, totalMs: 100, now: () => t,
    fetchText: async (u) => { opened.push(u); t += 150; return u === B1.url ? LIST1 : BODY1; } });
  assert.equal(r.hits.length, 1); assert.deepEqual(opened, [B1.url], '마감이 지났는데 본문을 열었다');
});
test('★ 서버는 본문 읽기를 켠다', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, 'index.js'), 'utf8');
  assert.match(src, /RecruitWatch\.run\(\{ existing, today, nowIso, fetchText, details: true \}\)/);
});
