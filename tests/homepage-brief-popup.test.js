/* 홈페이지 «주간 노동 브리핑» — 글 쪽 꾸밈 · 첫 화면 팝업 (대표 지시 2026-11-18)
   「홈페이지상 주간브리핑 깔끔하게 해주고 팝업으로 나오게 해달라」

   지키는 것
   ① 서버가 만드는 브리핑 본문은 꾸밈 묶음(pu_brief)과 이름표(pb_law·pb_news·pb_when)를 단다
   ② 그 본문을 담는 글 쪽에는 꾸밈 줄(assets/css/pu-brief.css)이 «한 번» 붙는다 — 본에 없어도
   ③ 이미 올라간 브리핑 글도 새 모양이다(옛 줄글 모양이 남지 않는다)
   ④ 첫 화면이 팝업 스크립트와 꾸밈을 싣고, 그 파일이 실제로 있다
   ⑤ 팝업은 읽어 온 글을 꺾쇠째 넣지 않는다(innerHTML 금지) · 링크는 http(s) 만 · 저장소는 막혀도 죽지 않는다
   ⑥ 팝업이 읽는 이름표와 꾸밈 이름표가 서버·꾸밈 파일과 어긋나지 않는다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..');
const SITE = path.join(R, 'site');
const NB = require(path.join(R, 'functions', 'news-brief.js'));
const NoticeLib = require(path.join(R, 'functions', 'notice-lib.js'));
const 읽기 = (p) => fs.readFileSync(path.join(R, p), 'utf8');

const 법령 = [{ 이름: '근로기준법', 구분: '법률', 고친결: '일부개정', 공포일: '20261110', 시행일: '20261201',
  부처: '고용노동부', 링크: '/LSW/lsInfoP.do?lsiSeq=1' }];
const 뉴스 = [{ 제목: '최저임금 논의', 링크: 'https://a.kr/1', 언론사: '매일노동뉴스' },
  { 제목: '산재 판결', 링크: 'https://a.kr/2', 언론사: '안전저널' }];

test('① 브리핑 본문은 꾸밈 묶음과 이름표를 단다', () => {
  const 글 = NB.주간브리핑(뉴스, 법령, '2026-11-16', 7);
  ['pu_brief', 'pb_lead', 'pb_law', 'pb_news', 'pb_name', 'pb_when', 'pb_note'].forEach((이름) =>
    assert.ok(글.본문.indexOf('class="' + 이름 + '"') >= 0, '★ 이름표 ' + 이름 + ' 이(가) 없습니다'));
  assert.ok((글.본문.match(/<li>/g) || []).length >= 법령.length + 뉴스.length,
    '★ 줄(<li>)에 이름표를 달면 줄 세기 검사가 깨집니다 — 꾸밈은 <ul> 이름표로');
  assert.match(글.본문, /시행 2026-12-01/, '★ 시행일이 사라졌습니다');
  assert.match(글.본문, /법제처에서 보기/, '★ 원문 길이 사라졌습니다');
});

const 본쪽 = '<html><head><title>x</title></head><body><h1><a href="#">옛 제목</a></h1>'
  + '<!--BeforeDocument(9,5)--><div class="document_9_5 xe_content">옛 본문</div><!--AfterDocument(9,5)--></body></html>';

test('② 브리핑 글 쪽에는 꾸밈 줄이 한 번 붙는다 — 본에 없어도, 본에 있어도', () => {
  const 글 = NB.주간브리핑(뉴스, 법령, '2026-11-16', 7);
  const 쪽 = NoticeLib.글쪽만들기(본쪽, { 번호: '10', 제목: 글.제목, 본문: 글.본문, 날짜: '2026.11.16 07:30' });
  assert.equal((쪽.match(/assets\/css\/pu-brief\.css/g) || []).length, 1, '★ 꾸밈 줄이 없거나 두 번입니다');
  assert.match(쪽, /href="\.\.\/\.\.\/assets\/css\/pu-brief\.css"/, '★ 글 쪽(notice/번호/)에서 두 칸 올라가야 합니다');
  const 또 = NoticeLib.글쪽만들기(쪽.replace(/\(10,5\)/g, '(9,5)'), { 번호: '11', 제목: 글.제목, 본문: 글.본문, 날짜: '' });
  assert.equal((또.match(/assets\/css\/pu-brief\.css/g) || []).length, 1, '★ 본에 있는데 또 붙였습니다');
  const 다른글 = NoticeLib.글쪽만들기(본쪽, { 번호: '10', 제목: '알림', 본문: '<p>알림</p>', 날짜: '' });
  assert.ok(다른글.indexOf('pu-brief.css') < 0, '★ 브리핑이 아닌 글에도 붙였습니다');
});

function 브리핑쪽들() {
  const 자리 = path.join(SITE, 'notice');
  if (!fs.existsSync(자리)) return [];
  return fs.readdirSync(자리).filter((d) => /^\d+$/.test(d))
    .map((d) => path.join(자리, d, 'index.html'))
    .filter((p) => fs.existsSync(p) && /<title>[^<]*주간 노동 브리핑/.test(fs.readFileSync(p, 'utf8')));
}

test('③ 올라가 있는 브리핑 글은 모두 새 모양이고 꾸밈 줄을 싣는다', () => {
  const 쪽들 = 브리핑쪽들();
  assert.ok(쪽들.length >= 1, '브리핑 글을 못 찾았습니다 — 검사가 아무것도 안 지킵니다');
  쪽들.forEach((p) => {
    const h = fs.readFileSync(p, 'utf8');
    const 이름 = path.relative(SITE, p);
    assert.ok(h.indexOf('class="pu_brief"') >= 0, '★ ' + 이름 + ' 이(가) 옛 줄글 모양입니다');
    assert.ok(h.indexOf('../../assets/css/pu-brief.css') >= 0, '★ ' + 이름 + ' 에 꾸밈 줄이 없습니다');
  });
});

test('④ 첫 화면이 팝업 스크립트와 꾸밈을 싣고, 그 파일이 실제로 있다', () => {
  const 첫 = 읽기('site/index.html');
  assert.match(첫, /<script[^>]+src="assets\/js\/pu-brief-pop\.js"/, '★ 첫 화면이 팝업을 안 싣습니다');
  assert.match(첫, /<link[^>]+href="assets\/css\/pu-brief\.css"/, '★ 첫 화면이 팝업 꾸밈을 안 싣습니다');
  ['site/assets/js/pu-brief-pop.js', 'site/assets/css/pu-brief.css'].forEach((p) =>
    assert.ok(fs.existsSync(path.join(R, p)), '★ ' + p + ' 이(가) 없습니다'));
});

test('⑤ 팝업은 읽어 온 글을 꺾쇠째 넣지 않고, 링크는 http(s) 만, 저장소가 막혀도 죽지 않는다', () => {
  const js = 읽기('site/assets/js/pu-brief-pop.js');
  assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(js),
    '★ 읽어 온 글을 꺾쇠째 넣는 길이 있습니다 — textContent 로만');
  assert.match(js, /\^https\?:/, '★ 링크 거르개(http(s) 만)가 없습니다');
  assert.match(js, /try\s*\{[^}]*Storage|try\s*\{\s*return window\[/, '★ 저장소 읽기가 try 로 싸여 있지 않습니다');
  assert.match(js, /오늘 하루 보지 않기/, '★ 「오늘 하루 보지 않기」가 없습니다');
  assert.match(js, /며칠까지/, '★ 묵은 브리핑을 거르는 기한이 없습니다');
});

test('⑥ 팝업이 쓰는 이름표가 꾸밈 파일·서버 본문과 맞는다', () => {
  const js = 읽기('site/assets/js/pu-brief-pop.js');
  const css = 읽기('site/assets/css/pu-brief.css');
  const 팝업이름표 = [...new Set((js.match(/'pb_pop[a-z_]*'/g) || []).map((s) => s.slice(1, -1)))];
  assert.ok(팝업이름표.length >= 5, '팝업 이름표를 못 읽었습니다');
  팝업이름표.forEach((이름) => assert.ok(css.indexOf('.' + 이름) >= 0, '★ 꾸밈에 .' + 이름 + ' 이(가) 없습니다'));
  const 본문 = NB.주간브리핑(뉴스, 법령, '2026-11-16', 7).본문;
  ['pu_brief', 'pb_law', 'pb_news', 'pb_name', 'pb_when'].forEach((이름) => {
    assert.ok(js.indexOf('.' + 이름) >= 0, '팝업이 ' + 이름 + ' 을(를) 안 읽습니다 — 검사를 고치십시오');
    assert.ok(본문.indexOf('class="' + 이름 + '"') >= 0, '★ 팝업은 ' + 이름 + ' 을(를) 읽는데 서버 본문에 없습니다');
  });
  assert.match(css, /@media \(max-width:\d+px\)/, '★ 폰 구간 꾸밈이 없습니다');
});
