'use strict';
/* 옛 홈페이지(푸른노무법인.kr)를 접은 뒤 «새 사이트에 아직 없던 길» 셋 + 미리보기 sandbox (2026-11-16)
 *   A. 얼굴 사진 — 새 사이트에 올린 우리 사진(photo.site)이 먼저, 자리는 site/files/people/<열쇠>.jpg 한 겹
 *   B. 글 번호 없는 새 노무사 — 새 사이트 사진 + 대표 허락(publishOk) + 열쇠가 다 있어야 카드(data-srl=new-…)로 간다
 *   C. 계약 끝난 자문사 로고 — 회사 열쇠(companyId)·거래 종료(closed)·로고 잇기(boardSrl)로만 숨긴다(이름으로 안 맞춤)
 *   D. 미리보기 iframe·새 창은 스크립트를 막는다(sandbox, allow-scripts 없음) — 이알피와 같은 출처라서
 * ★ 함수를 떠서 «돌려» 본다(되풀이된 실수 2). 사람 수·로고 수 같은 «지금 값»은 박지 않는다.
 * 실행: node --test tests/home-newsite-gaps.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const 읽기 = (p) => fs.readFileSync(path.join(R, p), 'utf8').replace(/\r\n/g, '\n');
const HOME = 읽기('pu-home.html');
const 사람쪽 = 읽기('site/people/index.html');
const 자문사쪽 = 읽기('site/partner/index.html');
const 메인쪽 = 읽기('site/index.html');

function 부품(파일, 이름) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(읽기(파일), ctx);
  return ctx[이름];
}
const P = 부품('js/pu-site-people.js', 'PuSitePeople');
const Pa = 부품('js/pu-site-partner.js', 'PuSitePartner');

/* ══════ A. 얼굴 사진 자리 ══════ */
test('★★ 사진자리 — 구성원 열쇠(소문자·숫자·밑줄·빼기)와 그림 종류로만 짓는다', () => {
  assert.equal(P.사진자리('190', 'image/jpeg'), 'site/files/people/190.jpg');
  assert.equal(P.사진자리('new-1763000000000', 'image/png'), 'site/files/people/new-1763000000000.png');
  ['../x', 'a/b', 'A1', '', '가나', 'a'.repeat(61)].forEach(k =>
    assert.equal(P.사진자리(k, 'image/jpeg'), '', '★★ 못 쓰는 열쇠로 자리를 지었다: ' + k));
  assert.equal(P.사진자리('190', 'image/svg+xml'), '', '★★ SVG 를 얼굴 사진 자리로 받는다(스크립트가 숨는다)');
});

test('★★ 사이트사진 — site/files/people/ 한 겹만 쪽 주소로 바꾼다, 다른 자리는 버린다', () => {
  /* 판(v)은 올린 시각 — 값이 아니라 «주소 뒤에 그대로 붙는가»만 본다 */
  const 판 = 'ab' + Date.now();
  const 좋은 = { photo: { site: { path: 'site/files/people/190.jpg', v: 판 } } };
  assert.equal(P.사이트사진(좋은), '../files/people/190.jpg' + '?v' + '=' + 판);
  [
    'site/files/logo/n1.png', 'site/files/people/../x.jpg', 'site/files/people/a.svg',
    'files/people/190.jpg', 'site/files/people/Up.jpg', 'https://evil.example/x.jpg'
  ].forEach(p => assert.equal(P.사이트사진({ photo: { site: { path: p } } }), '', '★★ 엉뚱한 자리를 사진으로 쓴다: ' + p));
  assert.equal(P.사이트사진({ photo: { site: { path: 'site/files/people/190.jpg', v: '1"><script>' } } }),
    '../files/people/190.jpg?v=1script', '★★ 판(v) 글자가 주소를 깨뜨린다 — 영문·숫자만 남겨야 한다');
});

/* ══════ A·B. 올릴사람 ══════ */
test('★★★ 우리 사진이 있으면 옛 사진 대신 그것을 쓴다 · 없으면 지금 쪽 사진 그대로', () => {
  const 지금 = P.사람읽기(사람쪽);
  assert.ok(지금.length >= 2, '본 쪽에 카드가 두 장 넘게 있어야 검사가 뜻이 있다');
  const a = 지금[0], b = 지금[1];
  const ours = [
    { key: a.srl, srl: a.srl, name: a.이름, kind: 'labor', careers: ['x'],
      photo: { bytes: 10, ver: '9', site: { path: 'site/files/people/' + a.srl + '.jpg', v: 'p' + a.srl, ver: '9' } } },
    { key: b.srl, srl: b.srl, name: b.이름, kind: 'labor', careers: ['y'] }
  ];
  const r = P.올릴사람(사람쪽, ours);
  assert.equal(r.갈것.length, 2);
  assert.equal(r.갈것[0].사진, '../files/people/' + a.srl + '.jpg' + '?v' + '=p' + a.srl, '★★★ 새로 올린 사진을 안 쓴다');
  assert.equal(r.갈것[1].사진, b.사진, '★★ 우리 사진이 없는데 지금 쪽 사진을 안 이어받는다');
});

test('★★★ 글 번호 없는 새 노무사 — 사진·허락·열쇠가 다 있어야 가고, 하나라도 없으면 «못 감»', () => {
  const 사진 = { bytes: 10, ver: '1', site: { path: 'site/files/people/new-1.jpg', v: '2', ver: '1' } };
  const 허락 = { at: '2026-11-16', 경력글: '現 노무사' };
  const 다있음 = { key: 'new-1', srl: '', name: '새분', kind: 'labor', careers: ['現 노무사'], photo: 사진, publishOk: 허락 };
  const r = P.올릴사람(사람쪽, [다있음]);
  assert.equal(r.갈것.length, 1, '★★★ 다 갖춘 새 노무사가 못 간다: ' + JSON.stringify(r.못갈것));
  assert.equal(r.갈것[0].srl, 'new-1', '★★ 카드 열쇠가 구성원 열쇠가 아니다');
  /* 화면 「줄마다 감싸기」(div) 모양으로 허락한 글도 같은 경력으로 본다 · 빈칸만 다른 것도 같다 */
  assert.equal(P.올릴사람(사람쪽, [Object.assign({}, 다있음, { publishOk: { 경력글: '<div>現 노무사</div>' } })]).갈것.length, 1);
  assert.equal(P.올릴사람(사람쪽, [Object.assign({}, 다있음, { careers: ['  現   노무사 '] })]).갈것.length, 1);
  [
    [Object.assign({}, 다있음, { publishOk: null }), /허락이 없습니다/],
    [Object.assign({}, 다있음, { photo: { bytes: 10, ver: '1' } }), /사진/],
    [Object.assign({}, 다있음, { key: '../x' }), /글 번호/],
    /* 허락한 뒤 경력을 고쳤으면 — 매달 자동 재게시도 고친 경력을 올리지 않는다 */
    [Object.assign({}, 다있음, { careers: ['現 노무사', '前 다른 곳'] }), /다시 허락/]
  ].forEach(([m, 까닭]) => {
    const x = P.올릴사람(사람쪽, [m]);
    assert.equal(x.갈것.length, 0, '★★★ 빠진 것이 있는데 새 사이트에 올라간다');
    assert.match(x.못갈것[0].why, 까닭);
  });
});

test('★★ new-… 카드도 그려지고 다시 읽힌다 — 본 카드가 new-… 여도 창 열쇠가 갈린다', () => {
  const 지금 = P.사람읽기(사람쪽);
  const 새 = { srl: 'new-1', 이름: '새분', 직책1: '', 직책2: '공인노무사', 사진: '../files/people/new-1.jpg?v=2', 경력: ['現 노무사'] };
  const 한번 = P.쪽그리기(사람쪽, [새].concat(지금));            // 새 카드가 맨 앞 — 다음 그리기의 «본»이 된다
  const 두번 = P.쪽그리기(한번, P.사람읽기(한번).slice(1).concat(P.사람읽기(한번).slice(0, 1)));
  const 읽음 = P.사람읽기(두번);
  assert.deepEqual(읽음.map(p => p.srl).sort(), 지금.map(p => p.srl).concat(['new-1']).sort(),
    '★★ new-… 카드가 다시 읽히지 않거나 다른 카드 열쇠가 바뀌었다');
  assert.equal((두번.match(/id="bh_modal_new-1"/g) || []).length, 1, '★★ new-… 카드의 창 열쇠가 하나가 아니다');
});

/* ══════ A. 서버 — 그림 자리 ══════ */
test('★★★ 서버는 얼굴 사진을 site/files/people/ 한 겹에만 받는다 — SVG·위로 올라가기·대문자 막음, 로고 자리는 그대로', () => {
  const SP = require(path.join(R, 'functions', 'site-publish.js'));
  ['site/files/people/190.jpg', 'site/files/people/new-1763000000000.webp', 'site/files/logo/n1.svg']
    .forEach(p => assert.ok(SP.올릴그림자리인가(p), '★★ 받아야 할 자리를 막는다: ' + p));
  ['site/files/people/a.svg', 'site/files/people/../x.jpg', 'site/files/people/A.jpg', 'site/files/people/a/b.jpg',
   'site/files/people/a.html', 'site/files/x.jpg', 'site/people/index.html']
    .forEach(p => assert.ok(!SP.올릴그림자리인가(p), '★★★ 엉뚱한 자리에 그림을 받는다: ' + p));
});

/* ══════ C. 계약 끝난 자문사 로고 ══════ */
test('★★★ 계약끝난로고 — 거래 종료·로고 이음·남기기 없음일 때만, 회사 열쇠로만 판정한다', () => {
  const partners = {
    c1: { boardSrl: 101 },                         // 종료 → 숨김
    c2: { boardSrl: 102 },                         // 거래 중 → 그대로
    c3: { boardSrl: 103, keep: { why: '실적' } },  // 남기기 → 그대로
    c4: { boardSrl: 104, keep: { why: ' ' } },     // 사유 없는 남기기는 남기기 아님 → 숨김
    c5: {},                                        // 로고 안 이음 → 판정 안 함
    c6: { boardSrl: 106 },                         // 지운 업체 → 판정 안 함
    c7: { boardSrl: 107 }, c8: { boardSrl: 107 }   // 번호 겹침 → 숨기지 않고 알림
  };
  const companies = [
    { id: 'c1', name: '가', status: 'closed' }, { id: 'c2', name: '가', status: 'active' },
    { id: 'c3', status: 'closed' }, { id: 'c4', status: 'closed' }, { id: 'c5', status: 'closed' },
    { id: 'c6', status: 'closed', _deleted: true }, { id: 'c7', status: 'closed' }, { id: 'c8', status: 'closed' }
  ];
  const r = Pa.계약끝난로고(partners, companies);
  assert.deepEqual(Object.keys(r.숨길).sort(), ['101', '104'], '★★★ 숨길 로고가 다르다: ' + JSON.stringify(r.숨길));
  assert.deepEqual(Array.from(r.겹침, x => x.srl), ['107', '107'], '★★ 번호가 겹친 로고를 숨기거나 알리지 않는다');
  assert.ok(!r.숨길['102'], '★★★ 이름이 같은 다른 회사(거래 중)의 로고를 숨겼다 — 이름으로 맞추면 안 된다');
  /* 업체를 못 읽으면 아무것도 안 숨긴다 */
  ['', null, [], {}].forEach(빈것 => {
    const x = Pa.계약끝난로고(partners, 빈것);
    assert.ok(x.못읽음 && !Object.keys(x.숨길).length, '★★★ 업체 목록이 비었는데 로고를 숨긴다');
  });
});

test('★★ 실제 자문사 쪽에서 계약 끝난 로고만 빠지고 나머지 차례는 그대로다', () => {
  const 로고 = Pa.로고읽기(자문사쪽).filter(x => /^\d+$/.test(x.srl));
  assert.ok(로고.length >= 2, '본 쪽에 숫자 번호 로고가 두 장 넘게 있어야 한다');
  const 끝 = 로고[1].srl;
  const r = Pa.계약끝난로고({ cX: { boardSrl: Number(끝) } }, [{ id: 'cX', status: 'closed' }]);
  const 고른것 = Pa.올릴로고(자문사쪽, { 숨김: r.숨길 });
  assert.deepEqual(Array.from(고른것.숨긴것, x => x.srl), [끝]);
  assert.deepEqual(Array.from(고른것.갈것, x => x.srl), Array.from(Pa.로고읽기(자문사쪽), x => x.srl).filter(s => s !== 끝),
    '★★ 끝난 로고 말고 다른 로고의 차례가 바뀌었다');
});

/* ══════ C. 서버 매달 자동 ══════ */
const HN = require(path.join(R, 'functions', 'homepage-newsite.js'));

test('★★★ 매달 자동 로고고르기 — 끝난 로고만 빼고, 문턱을 넘거나 업체를 못 읽으면 멈춘다', () => {
  const 로고 = Pa.로고읽기(자문사쪽).filter(x => /^\d+$/.test(x.srl));
  const partners = {}, companies = [{ id: '살아있음', status: 'active' }];
  partners.c0 = { boardSrl: Number(로고[0].srl) }; companies.push({ id: 'c0', status: 'closed' });
  const r = HN.로고고르기(자문사쪽, 메인쪽, partners, companies);
  assert.ok(r.ok && !r.멈춤 && r.바뀜 && r.숨김수 === 1, '★★★ 끝난 로고 한 장을 못 숨긴다: ' + JSON.stringify(Object.assign({}, r, { 새쪽: '', 새메인: '' })));
  assert.ok(!Pa.로고읽기(r.새쪽).some(x => x.srl === 로고[0].srl), '★★★ 새 쪽에 끝난 로고가 남았다');
  /* 문턱을 넘으면 하나도 안 숨긴다 */
  const 많이 = {}, 많은업체 = [];
  로고.slice(0, HN.로고빠짐문턱 + 1).forEach((x, i) => { 많이['c' + i] = { boardSrl: Number(x.srl) }; 많은업체.push({ id: 'c' + i, status: 'closed' }); });
  const m = HN.로고고르기(자문사쪽, 메인쪽, 많이, 많은업체);
  assert.ok(m.멈춤 && !m.새쪽, '★★★ 한 번에 많이 빠지는데 멈추지 않는다');
  /* 업체를 못 읽으면 실패로 남긴다 */
  assert.equal(HN.로고고르기(자문사쪽, 메인쪽, partners, null).ok, false);
});

test('★★★ 매달 자동 로고돌기 — 정해진 두 자리에만 올리고, 결과를 newsiteLogos 한 줄로 남긴다', async () => {
  const 로고 = Pa.로고읽기(자문사쪽).filter(x => /^\d+$/.test(x.srl));
  const 자료 = {
    'homepage/partners': { c0: { boardSrl: Number(로고[0].srl) } },
    'data/companies': [{ id: 'c0', status: 'closed' }, { id: 'c1', status: 'active' }]
  };
  const 올린 = [], 쓴 = {};
  const 도구 = {
    읽기: async (p) => 자료[p], 쓰기: async (p, v) => { 쓴[p] = v; }, 지금: () => 1, 누가: 'auto',
    파일읽기: async (자리) => (자리 === HN.자문사자리 ? 자문사쪽 : 메인쪽),
    파일올리기: async (자리, html) => { 올린.push(자리); return { commit: { sha: 'abcdef1234' } }; }
  };
  const 기록 = await HN.로고돌기(도구);
  assert.ok(기록.ok && 기록.올림, '★★★ 끝난 로고가 있는데 안 올렸다: ' + JSON.stringify(기록));
  올린.forEach(자리 => assert.ok([HN.자문사자리, HN.메인자리].includes(자리), '★★★ 정해진 자리 밖에 올렸다: ' + 자리));
  assert.ok(올린.includes(HN.자문사자리));
  assert.deepEqual(Object.keys(쓴), ['homepage/auto/newsiteLogos'], '★★★ 결과 한 줄 말고 다른 자료를 썼다(회사·로고 기록은 안 쓴다)');
  /* 숨길 것이 없으면 아무것도 안 올린다 */
  올린.length = 0;
  자료['data/companies'] = [{ id: 'c0', status: 'active' }];
  const 없음 = await HN.로고돌기(도구);
  assert.ok(없음.ok && !없음.올림 && 올린.length === 0, '★★ 숨길 것이 없는데 올렸다');
  /* 옛 부르는 쪽(파일읽기 없음)은 건너뛴다 */
  assert.equal(await HN.로고돌기({ 읽기: 도구.읽기, 쓰기: 도구.쓰기, 지금: 도구.지금 }), null);
});

/* ══════ A·B. 화면 — 「새 사이트에 올리기」 ══════ */
test('★★★ 사진은 «예»를 받은 뒤, 쪽보다 먼저 올린다 — 사진이 실패하면 쪽은 안 올라간다', () => {
  const s = stripJs(cutFn(HOME, 'async function publishPeople('));
  const 묻기 = s.indexOf('askYes(');
  const 사진 = s.indexOf('그림올리기(');
  const 쪽 = s.indexOf("올리기('site/people/index.html'");
  assert.ok(묻기 > 0 && 사진 > 0 && 쪽 > 0, '★ 묻기·사진 올리기·쪽 올리기를 못 찾았다');
  assert.ok(묻기 < 사진 && 사진 < 쪽, '★★★ 순서가 틀렸다 — 묻기 → 사진 → 쪽 이어야 한다');
  assert.match(s, /실릴열쇠/, '★★ «카드에 실리는 사람»의 사진만 올리는지 보지 않는다(허락 없는 사진이 공개 저장소에 간다)');
});

test('★★★ 올릴사진준비 — 허락 없는 새 노무사의 사진은 읽지도 않고, 이미 올린 판은 건너뛴다', async () => {
  const 읽은 = [];
  const ctx = {
    console, Object, Array, String, Number, Date,
    PuSitePeople: P,
    db: { ref(p) { 읽은.push(p); return { once: () => Promise.resolve({ val: () => ({ b64: 'QUJD', type: 'image/jpeg' }) }) }; } }
  };
  vm.createContext(ctx);
  vm.runInContext([cutFn(HOME, 'function 사진판('), cutFn(HOME, 'function 사진새사이트에있나('),
    cutFn(HOME, 'async function 올릴사진준비(')].join('\n'), ctx);
  const 사진 = { bytes: 3, ver: '7' };
  const 일 = await ctx.올릴사진준비([
    { key: 'new-1', srl: '', kind: 'labor', photo: 사진 },                                                     // 허락 없음
    { key: 'new-2', srl: '', kind: 'labor', photo: 사진, publishOk: { 경력글: 'x' } },                        // 허락 있음
    { key: '190', srl: '190', kind: 'labor', photo: Object.assign({}, 사진, { site: { path: 'site/files/people/190.jpg', ver: '7' } }) }, // 이미 올림
    { key: '195', srl: '195', kind: 'labor', photo: 사진 },                                                   // 글 번호 있음 → 올림
    { key: 's', srl: '', kind: 'staff', photo: 사진 }                                                         // 직원 — 카드 아님
  ]);
  assert.deepEqual(Object.keys(일).sort(), ['195', 'new-2'], '★★★ 올릴 사진 고르기가 틀렸다: ' + Object.keys(일));
  assert.ok(!읽은.some(p => /new-1|\/s$/.test(p)), '★★★ 허락 없는 새 노무사·직원의 사진을 읽었다');
  assert.equal(일['new-2'].site.path, 'site/files/people/new-2.jpg');
  assert.equal(일['new-2'].site.ver, '7', '★★ 올린 판을 적지 않으면 다음에 또 올린다');
});

test('★★ 「새 사이트에 올리기」(자문사)는 계약 끝난 로고를 숨기되, 숨김 설정에는 적지 않는다', () => {
  const s = stripJs(cutFn(HOME, 'async function publishPartner('));
  assert.match(s, /PuSitePartner\.계약끝난로고\(/, '★★★ 계약 끝난 로고를 판정하지 않는다');
  assert.match(s, /companiesErr/, '★★ 업체관리를 못 읽은 날에도 판정한다 — 빈 목록으로 아무 로고나 숨길 수 있다');
  assert.ok(!/ref\([^)]*숨김[^)]*\)\.set\(/.test(s) && !/숨김\[[^\]]+\]\s*=\s*true/.test(s),
    '★★ 끝난 로고를 숨김 설정에 적는다 — 계약이 다시 이어져도 영영 안 나온다');
});

/* ══════ D. 미리보기는 스크립트를 막는다 ══════ */
test('★★★ 미리보기 iframe·새 창은 sandbox 로 스크립트를 막는다 (allow-scripts 없음)', () => {
  const s = stripJs(HOME);
  const 틀들 = s.match(/<iframe[^>]*>/g) || [];
  assert.ok(틀들.length >= 2, '★ iframe 을 못 찾았다 — 훑기가 헛돈다');
  틀들.forEach(t => {
    assert.match(t, /sandbox="[^"]*"/, '★★★ sandbox 없는 iframe: ' + t.slice(0, 80));
    assert.doesNotMatch(t, /allow-scripts/, '★★★ 미리보기에서 스크립트를 연다: ' + t.slice(0, 80));
  });
  const 새창 = stripJs(cutFn(HOME, 'function openPreviewWindow('));
  assert.doesNotMatch(새창, /document\.write\(\s*base끼우기\(/, '★★★ 새 창에 쪽을 그대로 쓴다 — 그 스크립트가 이알피 출처에서 돈다');
  assert.match(새창, /sandbox=/, '★★★ 새 창 미리보기에 sandbox 틀이 없다');
});

test('★★ 미리보기문서 — 스크립트 없이도 카드가 보이게 꾸밈을 «미리보기에만» 끼운다', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext([cutFn(HOME, 'function base끼우기('), "const 미리보기꾸밈 = " + JSON.stringify((/const 미리보기꾸밈 = '([^']+)'/.exec(HOME) || [, ''])[1]) + ';',
    cutFn(HOME, 'function 미리보기문서(')].join('\n'), ctx);
  const out = ctx.미리보기문서('<html><head><title>t</title></head><body><div class="animate-in">카드</div></body></html>', 'https://x/');
  assert.match(out, /<base href="https:\/\/x\/">/, '★★ base 를 안 끼운다');
  assert.match(out, /\.animate-in[^{]*\{[^}]*visibility:\s*visible/, '★★ 스크립트를 막으면 카드가 숨는데 보이게 하지 않는다');
  /* 올리는 쪽에는 안 들어간다 — publishPeople 이 미리보기문서를 부르지 않는다 */
  assert.doesNotMatch(stripJs(cutFn(HOME, 'async function publishPeople(')), /미리보기문서\(/, '★★★ 올리는 HTML 에 미리보기 꾸밈이 섞인다');
});

/* ══════ 보안 검토(2026-11-16 높음) — 자료의 글 번호·열쇠가 카드 속성을 깨지 못한다 ══════ */
test('★★★ 따옴표·속성을 넣은 글 번호는 카드로 가지 않는다 — 우리 사진이 있어도', () => {
  const 나쁜 = ['1" onclick="alert(1)', '190 x', '<b>', '../1', '1e5', '12345678901234'];
  나쁜.forEach(srl => {
    const r = P.올릴사람(사람쪽, [{ key: '190', srl: srl, name: '가', kind: 'labor', careers: ['x'],
      photo: { bytes: 1, ver: '1', site: { path: 'site/files/people/190.jpg', v: '1', ver: '1' } } }]);
    assert.equal(r.갈것.length, 0, '★★★ 모양이 틀린 글 번호가 카드로 간다: ' + srl);
    assert.match(r.못갈것[0].why, /글 번호 모양/);
  });
});

test('★★★ 카드그리기는 안전하지 않은 열쇠·사진 주소를 받지 않는다 (부품을 따로 불러도)', () => {
  assert.throws(() => P.쪽그리기(사람쪽, [{ srl: '1" onclick="x', 이름: '가', 사진: '../a.jpg', 경력: [] }]), /열쇠/);
  assert.throws(() => P.쪽그리기(사람쪽, [{ srl: '190', 이름: '가', 사진: '../a.jpg" onerror="x', 경력: [] }]), /사진/);
  assert.throws(() => Pa.쪽그리기(자문사쪽, [{ srl: 'n1" x="', 그림: '../files/logo/n1.png' }]), /열쇠/);
  /* 새 로고(n…)가 첫 칸이어도 다음 칸 열쇠가 갈린다 */
  const 로고 = Pa.로고읽기(자문사쪽);
  const 한번 = Pa.쪽그리기(자문사쪽, [{ srl: 'n17', 그림: '../files/logo/n17.png' }].concat(Array.from(로고)));
  const 두번 = Pa.쪽그리기(한번, Pa.로고읽기(한번));
  assert.deepEqual(Array.from(Pa.로고읽기(두번), x => x.srl), ['n17'].concat(Array.from(로고, x => x.srl)),
    '★★ 첫 칸이 새 로고일 때 다른 칸 열쇠가 바뀐다');
});

test('★★ 확인창 본문 — 이름은 esc 하고 줄바꿈은 <br> 로 (askYes 는 HTML 로 넣는다)', () => {
  ['async function publishPeople(', 'async function publishPartner('].forEach(fn => {
    const s = stripJs(cutFn(HOME, fn));
    const i = s.indexOf("askYes('홈페이지에 올릴까요?'");
    assert.ok(i > 0, fn + ' 확인창을 못 찾았다');
    const 몸 = s.slice(i, s.indexOf("'올리기')", i));
    assert.match(몸, /\.replace\(\/\\n\/g, *'<br>'\)/, '★★ ' + fn + ' 확인창 줄바꿈이 한 줄로 뭉개진다');
    assert.match(몸, /esc\(/, '★★ ' + fn + ' 확인창에 이름을 esc 없이 넣는다');
  });
  assert.doesNotMatch(stripJs(cutFn(HOME, 'async function publishPeople(')), /'· ' \+ p\.이름/, '★★ 구성원 이름을 esc 없이 넣는다');
});

test('★★★ 서버 매달 자동은 «실행되는 조각»이 새로 든 쪽을 올리지 않는다', () => {
  const s = stripJs(fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8'));
  const i = s.indexOf('async function 새사이트한번(');
  const 몸 = s.slice(i, s.indexOf('\nexports.monthlyHomepageAuto', i));
  assert.match(몸, /새실행조각\(/, '★★★ 자동 올리기에 실행 조각 검사가 없다');
  const 막기 = (몸.match(/await 실행조각막기\(/g) || []).length;
  assert.ok(막기 >= 2, '★★★ 구성원·로고 두 올리기 모두 검사해야 한다 (지금 ' + 막기 + '곳)');
});

test('★★★ 실행 조각 검사는 글자 참조·탭으로 감춘 주소도 본다 (있던 쪽·새 쪽 같은 잣대)', () => {
  const SP = require(path.join(R, 'functions', 'site-publish.js'));
  const 있던 = '<p>가</p>';
  [
    '<a href="java&#x73;cript:alert(1)">누르기</a>',
    '<a href="&#106;avascript:alert(1)">누르기</a>',
    '<a href="javascript&colon;alert(1)">누르기</a>',
    '<a href="jav&Tab;ascript:alert(1)">누르기</a>',
    '<a href="java\tscript:alert(1)">누르기</a>',
    '<a href=" &#14;javascript:alert(1)">누르기</a>',
    '<svg><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>',
    /* 재검증 2회째 — 빗금·따옴표 바로 뒤 이벤트 속성, 값 «가운데» 실행 주소, 닫히지 않은 스크립트 */
    '<svg/onload=alert(1)>',
    '<img src="x"onerror=alert(1)>',
    '<svg><a><animate attributeName="href" values="https://example.org;javascript:alert(1)"/></a></svg>',
    '<p>끝</p><script>alert(1)'
  ].forEach(나쁜 => {
    assert.ok(SP.새실행조각(있던, 있던 + 나쁜).length >= 1, '★★★ 감춘 실행 주소가 빠져나간다: ' + 나쁜);
  });
  /* 글만 고친 것은 그대로 통과 — 주소 글자가 «javascript» 로 시작하는 보통 파일은 실행 주소가 아니다 */
  assert.deepEqual(SP.새실행조각(있던, '<p>나</p><a href="javascript-guide.html">안내</a>'), []);
  const 감춘것 = '<p>가</p><a href="java&#x73;cript:x()">a</a>';
  assert.deepEqual(SP.새실행조각(감춘것, 감춘것.replace('가', '나')), [], '있던 조각을 그대로 두고 글만 고치면 통과');
  /* 있던 javascript:void(0) 를 핑계로 «다른» 실행 주소를 새로 넣을 수 없다 */
  const 옛반죽 = '<a href="javascript:void(0)">메뉴</a>';
  assert.ok(SP.새실행조각(옛반죽, 옛반죽 + '<a href="javascript:alert(1)">b</a>').length >= 1,
    '★★★ 있던 javascript: 와 «앞머리만 같으면» 새 실행 주소가 통과한다');
  assert.deepEqual(SP.새실행조각(옛반죽, 옛반죽 + '<a href="javascript:void(0)">메뉴2</a>'), [], '있던 것과 똑같은 조각은 통과');
  /* 있던 스크립트를 그대로 두고 글만 고치면 통과 (닫힌 스크립트 셈이 흔들리지 않는다) */
  const 스크립트쪽 = '<p>가</p><script src="a.js"></script><script>b()</script>';
  assert.deepEqual(SP.새실행조각(스크립트쪽, 스크립트쪽.replace('가', '나')), []);
});

test('★★★ 자문사 로고 — 「추가」 목록의 이상한 열쇠·그림은 담지 않고, 칸그리기는 그림 주소도 본다', () => {
  const 로고 = Array.from(Pa.로고읽기(자문사쪽));
  const 고른것 = Pa.올릴로고(자문사쪽, { 추가: [
    { srl: "n1');alert(1);//", 그림: '../files/logo/n1.png' },
    { srl: 'n2', 그림: 'x" onerror="alert(1)' },
    { srl: 'n3', 그림: 'javascript:alert(1)' },
    { srl: 'n4', 그림: '../files/logo/n4.png' }
  ] });
  const 열쇠 = Array.from(고른것.갈것, x => x.srl);
  assert.ok(열쇠.indexOf('n4') >= 0, '★★ 바른 새 로고가 빠졌다');
  ['n2', 'n3'].forEach(k => assert.ok(열쇠.indexOf(k) < 0, '★★★ 안전하지 않은 그림이 담겼다: ' + k));
  assert.ok(!열쇠.some(k => /['()";]/.test(k)), '★★★ 따옴표 든 열쇠가 담겼다');
  assert.equal(고른것.갈것.length, 로고.length + 1);
  assert.throws(() => Pa.쪽그리기(자문사쪽, [{ srl: 'n5', 그림: 'x" onerror="alert(1)' }]), /그림/);
  assert.throws(() => Pa.쪽그리기(자문사쪽, [{ srl: 'n5', 그림: 'javascript:alert(1)' }]), /그림/);
  /* 지금 쪽의 로고(상대 주소)와 http(s) 주소는 그대로 그려진다 */
  assert.ok(Pa.쪽그리기(자문사쪽, 로고.concat([{ srl: 'n6', 그림: 'https://pureunlabor.co.kr/files/logo/n6.png' }])).length > 0);
});
