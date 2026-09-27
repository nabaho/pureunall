'use strict';
/* 정부사업신청 앱(gov.html) 정적 검사
   대표 지시 2026-09-05 「별도 프로그램 … 정부사업신청 으로」 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
const kcareer = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

test('인라인 스크립트가 문법 오류 없이 파싱된다', () => {
  const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length > 0);
  blocks.forEach((m, i) => {
    if (!m[1].trim()) return;
    assert.doesNotThrow(() => new vm.Script(m[1], { filename: 'gov.html:' + i }));
  });
});

test('부품 셋을 외부 파일로 로드한다', () => {
  ['gov-g2b', 'gov-alio', 'gov-bizinfo'].forEach((m) => {
    assert.match(src, new RegExp('<script src="js/' + m + '\\.js\\?v=\\d+"></script>'),
      m + ' 를 ?v= 와 함께 불러야 합니다');
  });
});

test('★ 경력관리와 저장 자리가 겹치지 않는다', () => {
  // ⚠ 같은 자리를 쓰면 한쪽이 다른 쪽 자료를 덮는다
  assert.match(src, /var NS='gov3_'/, '이 앱만의 접두사를 씁니다');
  assert.ok(src.indexOf("'cm3_'") < 0, '경력관리 접두사를 쓰면 안 됩니다');
  assert.match(src, /fbDb\.ref\('gov\/'\s*\+\s*fbUid\)/, '클라우드도 gov/{uid} 자리입니다');
  assert.ok(!/ref\('kcareer\//.test(src), '경력관리 자리를 건드리면 안 됩니다');
});

test('★★ 「모르면 잠근다」 — 신원을 못 알아내면 열지 않는다', () => {
  const m = src.match(/async function whoAmI\([\s\S]*?\n\}/);
  assert.ok(m, 'whoAmI 가 있어야 합니다');
  assert.match(m[0], /return \{ *ok: *false/, '마지막은 «못 열어 줌»으로 끝나야 합니다');
  assert.match(m[0], /uid_roles/, '권한은 uid_roles 를 1순위로 봅니다');
});

test('★ pu-erp 봉투를 벗긴다', () => {
  // pu-erp 는 data/{키} = {v:값, u:시각} 으로 담는다. 안 벗기면 직원 목록이 어긋난다.
  const m = src.match(/async function whoAmI\([\s\S]*?\n\}/);
  assert.match(m[0], /hasOwnProperty\.call\(raw, *'v'\)/, '봉투를 벗겨야 합니다');
});

test('★ 확인 중에는 잠그지 않는다', () => {
  // 깜빡임을 만든다 — 경력관리에서 정한 규칙과 같다
  const m = src.match(/function applyLock\([\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /checking/, 'checking 상태를 따로 다뤄야 합니다');
});

test('★ 하루 1,000회 제한을 지킨다 — 화면 열 때마다 부르지 않는다', () => {
  const m = src.match(/function auto\([\s\S]*?\n\}/);
  assert.ok(m, 'auto 가 있어야 합니다');
  assert.match(m[0], /lsGet\('last'\)/, '마지막으로 받은 날을 기억해야 합니다');
});

test('★ 인증키가 둘이라는 것을 화면이 밝힌다', () => {
  const m = src.match(/function readyNote\([\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /data\.go\.kr\/data\/15129394/, '나라장터·알리오 겸용 발급 주소');
  assert.match(m[0], /bizinfo\.go\.kr/, '기업마당은 따로 받아야 합니다');
  assert.match(m[0], /Decoding/, '어느 열쇠인지 밝혀야 합니다');
});

test('★★ 「교육」은 낱말에 없다', () => {
  // 대표 지시 2026-09-06. 클린아이 410건 실측에서 걸린 9건이 전부
  // 「평생교육진흥원 직원 채용」 오탐이었다 — 되살리지 말 것.
  const G = require('../js/gov-g2b.js');
  assert.ok(G.KEYWORDS_DEFAULT.indexOf('교육') < 0);
  assert.deepEqual(G.KEYWORDS_DEFAULT, ['노무', '인사', '고용', '임금', '컨설팅', '일터혁신', '노사']);
});

test('★ 마감이 지나도 관심 표시한 것은 건드리지 않는다', () => {
  const m = src.match(/function ageOut\([\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /관심/, '관심·지원함은 「지나감」으로 바꾸지 않습니다');
});

test('★ 숨긴 공고는 CSV 에도 안 나간다', () => {
  const m = src.match(/function expCsv\([\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /!r\.hidden/);
});

test('★★ 경력관리에는 여전히 나라장터가 없다', () => {
  // 별도 앱으로 뺀 것을 되돌리지 말 것(대표 지시 2026-09-05)
  ['g2b', 'G2B', '나라장터'].forEach((t) => {
    assert.ok(kcareer.indexOf(t) < 0, '경력관리에 「' + t + '」 가 되살아났습니다');
  });
});

test('출처를 표에 밝힌다', () => {
  assert.match(src, /<option>나라장터<\/option><option>알리오<\/option><option>기업마당<\/option>/);
});

/* ───────── 실제로 그려지는가 (가짜 화면에서 돌려 본다) ───────── */

function runApp(seed) {
  const els = {};
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '',
      style: {}, classList: { add(){}, remove(){} } };
    return els[id];
  }
  const store = {};
  Object.keys(seed || {}).forEach((k) => { store['gov3_' + k] = JSON.stringify(seed[k]); });
  const ctx = {
    console, setTimeout, clearTimeout, Math, JSON, Date, String, Number, Object, Array, RegExp,
    localStorage: { getItem: (k) => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = v; } },
    document: { getElementById: el, createElement: () => ({ click(){}, style:{} }) },
    location: { protocol: 'https:' },
    GovG2b: require('../js/gov-g2b.js'),
    GovCareer: require('../js/gov-career.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'),
    Promise, navigator: {},
    GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'),
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort=()=>{}; this.signal=null; },
    URL: { createObjectURL: () => 'blob:x' }, Blob: function(){}
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');   // 부팅은 빼고 함수만 싣는다
  vm.runInNewContext(code + '\n;globalThis.__api={draw,drawKw,dchip,star,find,readyNote,ageOut,'
    + 'setTab,matDraw,matPull,matRowsFor,matText,matCsv,matLiveTog,'
    + 'setMat:function(m){_mat=m;},setFb:function(db,uid){fbDb=db;fbUid=uid;}};', ctx);
  return { api: ctx.__api, el, store };
}

test('★ 공고 줄이 실제로 그려진다', () => {
  const r = runApp({ feed: [
    { id: 'G0001', src: '나라장터', type: '새 공고', no: '2026-1', nm: '노무자문 용역',
      org: '충청남도경제진흥원', closeDt: '2026-12-31', prc: 36000000, kw: '노무' }
  ] });
  r.api.draw();
  const html = r.el('tb').innerHTML;
  assert.match(html, /노무자문 용역/);
  assert.match(html, /충청남도경제진흥원/);
  assert.match(html, /나라장터/);
  assert.match(html, /3,600만원/, '금액이 만원 단위로 반올림돼야 합니다');
  assert.match(r.el('cnt').textContent, /전체 1건/);
});

test('★ 공고가 없으면 «없다»고 말한다 — 빈 표로 두지 않는다', () => {
  const r = runApp({ feed: [] });
  r.api.draw();
  assert.match(r.el('tb').innerHTML, /아직 받은 공고가 없습니다/);
});

test('★ 숨긴 것은 목록에 안 나온다', () => {
  const r = runApp({ feed: [{ id: 'G1', src: '알리오', nm: '가', hidden: true }] });
  r.api.draw();
  assert.match(r.el('tb').innerHTML, /아직 받은 공고가 없습니다/);
});

test('★ 마감일을 모르면 «-» 로 둔다 — D-0 으로 속이지 않는다', () => {
  const r = runApp({ feed: [] });
  assert.match(r.api.dchip({ closeDt: '' }), /-/);
  assert.ok(r.api.dchip({ closeDt: '' }).indexOf('D-') < 0);
});

test('★ 찾는 말 칩이 그려지고 「교육」은 없다', () => {
  const r = runApp({ feed: [] });
  r.api.drawKw();
  const html = r.el('kwBox').innerHTML;
  assert.match(html, /노무/);
  assert.match(html, /일터혁신/);
  assert.ok(html.indexOf('교육') < 0, '「교육」이 되살아나면 안 됩니다');
});

test('★ 인증키가 없으면 받는 방법을 화면에 적는다', () => {
  const r = runApp({ feed: [] });
  r.api.readyNote();
  assert.match(r.el('note').innerHTML, /인증키가 아직 없습니다/);
  assert.match(r.el('note').innerHTML, /Decoding/);
});

/* ═══════ 신청 재료 탭 (2026-09-10, 대표 승인 「안 A · 접이식」 + 수행실적) ═══════ */

const MAT_LS = {
  edu: JSON.stringify([{ school: '영남대학교', major: '법학과', degree: '학사',
                         period: '1999.03 ~ 2003.02', graduated: '졸업' }]),
  cert: JSON.stringify([{ title: '공인노무사', org: '고용노동부', date: '20100813', num: '제3016호' },
                        { title: 'NCS 기업활용 수료증', org: '한국산업인력공단', date: '2024-05-30' }]),
  wiccok: JSON.stringify([
    { type: '위촉장', org: '충청남도경제진흥원', titleVal: '노무자문위원',
      periodStart: '2025-03-01', periodEnd: '2099-02-28' },
    { type: '위촉장', org: '한국산업인력공단', titleVal: 'NCS 컨설턴트',
      periodStart: '2012-04-01', periodEnd: '2014-03-31' },
    { type: '표창', org: '고용노동부', titleVal: '노사문화 우수', issueDate: '2023-12-05' }
  ]),
  advisory: JSON.stringify([{ org: '○○정밀주식회사', type: '고문', bizType: '제조업',
                              size: '중소', insured: 412, period: '2019.03~', status: '진행' }]),
  consult: JSON.stringify([{ year: '2024', project: '일터혁신 상생컨설팅',
                             org: '○○정밀주식회사', agency: '노사발전재단', status: '완료' }])
};

/* 가짜 파이어베이스 — «어느 자리를 읽었는지» 기록한다 */
function fakeDb(map, mode) {
  const seen = [];
  return { seen, ref(p) { seen.push(p); return {
    once() {
      if (mode === 'fail') return Promise.reject(new Error('권한 없음'));
      return Promise.resolve({ val: () => (mode === 'empty' ? null : map[p]) });
    } }; } };
}

async function runMat(mode) {
  const r = runApp({ feed: [] });
  const map = {};
  Object.keys(MAT_LS).forEach((k) => { map['kcareer/U9/ls/' + k] = MAT_LS[k]; });
  const db = fakeDb(map, mode);
  r.api.setFb(db, 'U9');
  await r.api.matPull();
  return { ...r, db };
}

test('두 문(공고·신청 재료)이 화면에 있다', () => {
  assert.match(src, /id="tbFeed"[^>]*onclick="setTab\('feed'\)"/);
  assert.match(src, /id="tbMat"[^>]*onclick="setTab\('mat'\)"/);
  assert.match(src, /<div class="wrap" id="pgFeed">/);
  assert.match(src, /id="pgMat"/);
});

test('★ 재료 부품 둘을 싣는다 — 가리기는 경력관리 것을 빌려 쓴다', () => {
  assert.match(src, /<script src="js\/gov-career\.js\?v=\d+"><\/script>/);
  assert.match(src, /<script src="js\/kcareer-adv-summary\.js\?v=\d+"><\/script>/,
    '가리기 모듈을 안 실으면 자문 문장이 통째로 빕니다');
});

test('★ 문을 바꾸면 화면이 실제로 바뀐다', () => {
  const r = runApp({ feed: [] });
  r.api.setTab('mat');
  assert.equal(r.el('pgFeed').style.display, 'none');
  assert.equal(r.el('pgMat').style.display, '');
  assert.match(r.el('tbMat').className, /\bon\b/);
  r.api.setTab('feed');
  assert.equal(r.el('pgFeed').style.display, '');
  assert.equal(r.el('pgMat').style.display, 'none');
});

test('★★ 창고를 «콕 집어» 읽는다 — 노드를 통째로 읽지 않는다', async () => {
  const r = await runMat();
  assert.ok(r.db.seen.length >= 8);
  r.db.seen.forEach((p) => {
    assert.match(p, /^kcareer\/U9\/ls\//, '통째로 읽으면 첨부 조각·열쇠까지 딸려 옵니다: ' + p);
  });
  assert.ok(r.db.seen.every((p) => p.indexOf('_secrets') < 0));
});

test('★ 갈래 여섯이 실제로 그려진다', async () => {
  const r = await runMat();
  const h = r.el('matBox').innerHTML;
  ['학력', '자격 · 수료', '위촉 · 위원 경력', '표창 · 포상', '자문 · 고문', '수행 실적']
    .forEach((n) => assert.ok(h.indexOf(n) >= 0, n + ' 갈래가 없습니다'));
  assert.match(h, /영남대학교/);
  assert.match(h, /공인노무사/);
  assert.match(h, /일터혁신 상생컨설팅/);
});

test('★ 위촉·위원은 「지금 맡고 있는 것만」이 기본이다', async () => {
  const r = await runMat();
  assert.match(r.el('matBox').innerHTML, /충청남도경제진흥원/);
  assert.ok(r.el('matBox').innerHTML.indexOf('NCS 컨설턴트') < 0,
    '끝난 위촉이 기본 목록에 보입니다 — 197건이 다 나오면 못 읽습니다');
  r.api.matLiveTog();
  assert.match(r.el('matBox').innerHTML, /NCS 컨설턴트/, '끄면 다 보여야 합니다');
});

test('★★ 자문 목록에는 이름이 그대로 있다 — 대표님이 알아보셔야 한다', async () => {
  const r = await runMat();
  assert.match(r.el('matBox').innerHTML, /○○정밀주식회사/);
});

test('★★ 내보낼 때는 고객사 이름이 한 글자도 안 나간다', async () => {
  const r = await runMat();
  const rows = r.api.matRowsFor('advisory');
  assert.ok(rows.length > 0);
  rows.forEach((x) => assert.ok(String(x.org).indexOf('정밀') < 0,
    '이름이 그대로 나갔습니다: ' + x.org));
  const t = r.api.matText('advisory');
  assert.ok(t.length > 0, '가린 문장이 만들어져야 합니다');
  assert.ok(t.indexOf('정밀') < 0 && t.indexOf('주식회사') < 0, '문장에 이름이 샜습니다: ' + t);
});

test('★★ 재료를 «클라우드로 내보내지 않는다»', () => {
  // 담으면 대표님 이력이 두 자리에 있게 되고, 한쪽이 낡아 «두 앱이 다른 건수»를 보여 준다.
  const m = src.match(/function cloudPush\(\)\{[\s\S]*?\n\}/);
  assert.ok(m, 'cloudPush 를 못 찾았습니다');
  ['_mat', 'mat:', 'advisory', 'wiccok'].forEach((w) => {
    assert.ok(m[0].indexOf(w) < 0, 'cloudPush 가 재료를 밀어 올립니다: ' + w);
  });
});

test('★★ 재료를 이 기기에도 담지 않는다', async () => {
  const r = await runMat();
  Object.keys(r.store).forEach((k) => {
    const v = String(r.store[k] || '');
    assert.ok(v.indexOf('영남대학교') < 0 && v.indexOf('정밀') < 0,
      '재료가 저장되어 남았습니다: ' + k);
  });
});

test('★★ 하나도 못 읽으면 «없다»가 아니라 «못 읽었다»고 말한다', async () => {
  // 「이력이 0건」으로 보이면 대표님이 자료가 날아간 줄 아신다.
  const r = await runMat('fail');
  assert.match(r.el('matNote').innerHTML, /읽지 못했습니다/);
  assert.equal(r.el('matBox').innerHTML, '');
});

test('★★ 클라우드가 비었으면 «☁ 저장을 한 번 누르시라»고 알려 준다', async () => {
  // 경력관리에서 한 번도 저장을 안 하면 클라우드는 비어 있다 — 흔한 막다른 길이다.
  const r = await runMat('empty');
  const h = r.el('matNote').innerHTML;
  assert.match(h, /클라우드에는 아직 없습니다/, '무엇이 문제인지 말해야 합니다');
  assert.match(h, /클라우드에 저장/, '무엇을 하면 되는지도 말해야 합니다');
});

test('★ 재료 탭을 처음 열면 저절로 받아온다 — 빈 화면을 내놓지 않는다', () => {
  assert.match(src, /if\(t==='mat' *&& *!_mat\) *matPull\(\);/);
});
