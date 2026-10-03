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

test('★★ 인증키가 둘·신청이 셋이라는 것을 화면이 밝힌다', () => {
  // ⚠ 공공데이터포털은 열쇠가 계정당 «하나»지만 활용신청은 API «마다» 따로다.
  //    하나만 신청하면 열쇠가 맞아도 알리오는 계속 0건이다 — 화면이 이것을 말해야 한다.
  const m = src.match(/function readyNote\([\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /data\.go\.kr\/data\/15129394/, '나라장터 활용신청 주소');
  assert.match(m[0], /data\.go\.kr\/data\/15125273/, '알리오 활용신청 주소 — 따로 신청해야 합니다');
  assert.match(m[0], /신청은 따로/, '열쇠 하나로 되는 줄 알면 알리오만 0건이 됩니다');
  assert.match(m[0], /bizinfo\.go\.kr/, '기업마당은 따로 받아야 합니다');
  assert.match(m[0], /Decoding/, '어느 열쇠인지 밝혀야 합니다');
});

test('★★ 「교육」은 낱말에 없다', () => {
  // 대표 지시 2026-09-06. 클린아이 410건 실측에서 걸린 9건이 전부
  // 「평생교육진흥원 직원 채용」 오탐이었다 — 되살리지 말 것.
  const G = require('../js/gov-g2b.js');
  assert.ok(G.KEYWORDS_DEFAULT.indexOf('교육') < 0);
  assert.ok(G.KEYWORDS_DEFAULT.indexOf('위험성평가') >= 0, '대표 결정 2026-10-03 「위험성평가 넣는다」');
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
  const hooks = {};
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
    URL: { createObjectURL: () => 'blob:x' }, Blob: function(parts){ if(hooks.blob) hooks.blob(parts); }
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');   // 부팅은 빼고 함수만 싣는다
  vm.runInNewContext(code + '\n;globalThis.__api={draw,drawKw,dchip,star,find,readyNote,ageOut,'
    + 'setTab,matDraw,matPull,matRowsFor,matText,matCsv,matLiveTog,srcBackfill,rejudge,pullAll,PAGE_MAX,matGo,matPageTo,matTog,matSelPage,matSelAll,matSelClear,matList,'
    + 'feedTog,feedSelAll,feedBulk,expCsv,feedPer,feedPageTo,feedPop,feedRowClick,unhide,popClose,matPer,matRowClick,'
    + 'setMat:function(m){_mat=m;},setFb:function(db,uid){fbDb=db;fbUid=uid;},setPull:function(f){pull=f;}};', ctx);
  return { api: ctx.__api, el, store, setBlob: (f) => { hooks.blob = f; } };
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
  const r = runApp({ feed: [{ id: 'G1', src: '알리오', nm: '가나다라공고', hidden: true }] });
  r.api.draw();
  const h = r.el('tb').innerHTML;
  assert.ok(h.indexOf('가나다라공고') < 0, '숨긴 것이 보입니다');
  assert.match(h, /숨긴 1건/, '«없다»가 아니라 숨긴 것이 있다고 말해야 합니다 — 과거 자료는 남아 있다');
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
  const h = r.el('note').innerHTML;
  assert.match(h, /인증키가 아직 없습니다/);
  assert.match(h, /Decoding/);
  assert.match(h, /15129394/, '나라장터 신청 자리');
  assert.match(h, /15125273/, '알리오 신청 자리 — 빠지면 그쪽만 0건이 됩니다');
  assert.match(h, /nabaho\.github\.io\/pureunall\/gov\.html/, '기업마당이 묻는 시스템 URL');
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

test('★ 갈래 여섯이 «단추»로 있고 누르면 그 갈래만 보인다', async () => {
  // 대표 지시 2026-10-03 「너무 많은 내용으로 정리되어 있다 구분 좀 하고」
  const r = await runMat();
  const h = r.el('matBox').innerHTML;
  ['학력', '자격 · 수료', '위촉 · 위원 경력', '표창 · 포상', '자문 · 고문', '수행 실적']
    .forEach((n) => assert.ok(h.indexOf(n) >= 0, n + ' 갈래 단추가 없습니다'));
  r.api.matGo('edu');  assert.match(r.el('matBox').innerHTML, /영남대학교/);
  assert.ok(r.el('matBox').innerHTML.indexOf('공인노무사') < 0, '다른 갈래 내용이 같이 보이면 «구분»이 아닙니다');
  r.api.matGo('cert'); assert.match(r.el('matBox').innerHTML, /공인노무사/);
  r.api.matGo('perf'); assert.match(r.el('matBox').innerHTML, /일터혁신 상생컨설팅/);
});

test('★ 위촉·위원은 「지금 맡고 있는 것만」이 기본이다', async () => {
  const r = await runMat();
  r.api.matGo('wiccok');
  assert.match(r.el('matBox').innerHTML, /충청남도경제진흥원/);
  assert.ok(r.el('matBox').innerHTML.indexOf('NCS 컨설턴트') < 0,
    '끝난 위촉이 기본 목록에 보입니다 — 197건이 다 나오면 못 읽습니다');
  r.api.matLiveTog();
  assert.match(r.el('matBox').innerHTML, /NCS 컨설턴트/, '끄면 다 보여야 합니다');
});

test('★★ 자문 목록에는 이름이 그대로 있다 — 대표님이 알아보셔야 한다', async () => {
  const r = await runMat();
  r.api.matGo('advisory');
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

test('★ 출처가 빠진 옛 줄을 부팅 때 되살린다 — 두 번 돌려도 같다', () => {
  assert.match(src, /await cloudPull\(\); srcBackfill\(\);/, '로그인 뒤 불러온 다음에 되살려야 합니다');
  const m = src.match(/function srcBackfill\(\)\{[\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /if\(r && !r\.src\)/, '이미 출처가 있는 줄은 건드리지 않습니다');
});

test('★★ 출처 되살리기를 실제로 돌린다', () => {
  const r = runApp({ feed: [
    { id: 'G1', no: 'R26BK01749015-000', nm: '가' },
    { id: 'G2', no: '305665', nm: '나' },
    { id: 'G3', no: '모름', nm: '다' },
    { id: 'G4', no: '305666', nm: '라', src: '나라장터' }
  ] });
  assert.equal(r.api.srcBackfill(), 2, '되살린 수를 정확히 세야 합니다');
  const f = JSON.parse(r.store.gov3_feed);
  assert.deepEqual(f.map((x) => x.src || ''), ['나라장터', '알리오', '', '나라장터'],
    '모르는 것은 비워 두고, 이미 있는 출처는 건드리지 않습니다');
  assert.equal(r.api.srcBackfill(), 0, '두 번 돌려도 더 바뀌지 않습니다');
});

/* ───────── ★ 쪽을 끝까지 넘긴다 (2026-10-03 실측: 3,077건 중 999건만 보고 있었다) ───────── */

function pagedApp(total, per, failAt) {
  const r = runApp({ feed: [] });
  const calls = [];
  const parse = (j) => j;                      /* 가짜 응답이 곧 풀린 꼴이다 */
  const urlOf = (p) => p;
  const fake = async (p) => {
    calls.push(p);
    if (failAt === p) throw new Error('net');
    const from = (p - 1) * per, n = Math.max(0, Math.min(per, total - from));
    return { ok: true, total, rows: Array.from({ length: n }, (_, i) => ({ no: String(from + i) })) };
  };
  r.api.setPull(fake);
  return { r, calls, run: (max) => r.api.pullAll('나라장터', urlOf, parse, max) };
}

test('★★ 첫 쪽에서 멈추지 않는다 — 전체를 다 받는다', async () => {
  const t = pagedApp(3077, 999);
  const out = await t.run(8);
  assert.equal(out.rows.length, 3077, '3,077건을 다 받아야 합니다');
  assert.deepEqual(t.calls, [1, 2, 3, 4], '필요한 만큼만 부릅니다(하루 1,000회 제한)');
  assert.equal(out.errs.length, 0, '다 받았으면 아무 말도 없어야 합니다');
});

test('★ 뚜껑에 걸려 다 못 받으면 «그렇다고 말한다» — 조용히 자르지 않는다', async () => {
  const t = pagedApp(5000, 999);
  const out = await t.run(2);
  assert.equal(out.rows.length, 1998);
  assert.match(out.errs.join(), /5000건 중 1998건만/);
});

test('★ 중간 쪽이 실패해도 받은 것은 버리지 않고, 몇 쪽에서 끊겼는지 말한다', async () => {
  const t = pagedApp(3077, 999, 3);
  const out = await t.run(8);
  assert.equal(out.rows.length, 1998);
  assert.match(out.errs.join(), /3쪽/);
});

test('★ 뚜껑은 하루 제한 안에 있다', () => {
  const r = runApp({ feed: [] });
  assert.ok(r.api.PAGE_MAX.g2b * 1 + r.api.PAGE_MAX.alio <= 50, '하루 한 번에 50회를 넘게 부르면 안 됩니다');
  assert.ok(r.api.PAGE_MAX.g2b >= 4 && r.api.PAGE_MAX.alio >= 6, '실측 7일치(3,077·525)를 덮어야 합니다');
});

test('★★ 이미 받은 줄에도 새 규칙을 댄다 — 사람이 손댄 줄은 건드리지 않는다', () => {
  const r = runApp({ feed: [
    { id: 'G1', src: '나라장터', no: 'R1-000', nm: 'KDB AI 거버넌스 수립 컨설팅', type: '새 공고' },
    { id: 'G2', src: '나라장터', no: 'R2-000', nm: '2026년 직원 근무평정 대행 용역', type: '새 공고' },
    { id: 'G3', src: '나라장터', no: 'R3-000', nm: '동남권 LNG벙커링 사업 자문 및 컨설팅 용역', type: '관심' },
    { id: 'G4', src: '알리오', no: '305684', nm: '한전KPS(주)여수사업처 단기노무원 모집', type: '새 공고' },
    { id: 'G5', src: '나라장터', no: 'R5-000', nm: '고용노동부 중부청 인천고용센터 관용차량 임차', type: '지나감' },
    { id: 'G6', src: '나라장터', no: 'R6-000', nm: '특허기술 사업화 전략 컨설팅 용역', type: '지원함' }
  ] });
  assert.equal(r.api.rejudge(), 3, '「지나감」도 기계가 정한 것이라 새 규칙을 댄다(실측: 관용차 임차가 남아 보였다)');
  const f = JSON.parse(r.store.gov3_feed);
  assert.deepEqual(f.map((x) => !!x.hidden), [true, false, false, true, true, false], '지원함은 사람이 정한 것 — 건드리지 않는다');
  assert.equal(f[2].type, '관심', '관심 표시한 것은 그대로');
  assert.ok(f[0].ruleOut, '규칙이 숨긴 것임을 남긴다');
  assert.equal(r.api.rejudge(), 0, '두 번 돌려도 더 바뀌지 않는다');
});

test('★ 로그인 뒤 불러온 다음에 규칙을 댄다', () => {
  assert.ok(src.indexOf('await cloudPull(); srcBackfill(); rejudge();') >= 0);
});

/* ═══════ 신청 재료 — 50건씩 · ㅁ · № (대표 지시 2026-10-03) ═══════ */

async function bigMat(n) {
  const r = runApp({ feed: [] });
  const rows = Array.from({ length: n }, (_, i) => ({ year: '2024' /* 실적은 해 내림차순으로 줄 선다 — 해를 같게 두어 순서를 못박는다 */, project: '과제' + (i + 1),
    org: '고객' + (i + 1), status: '완료' }));
  const map = { 'kcareer/U9/ls/consult': JSON.stringify(rows) };
  r.api.setFb(fakeDb(map), 'U9');
  await r.api.matPull();
  r.api.matGo('perf');
  return r;
}
const rowCount = (h) => (h.match(/class="row-chk"/g) || []).length;

test('★★ 한 쪽에 50건만 — 나머지는 쪽을 넘겨 본다', async () => {
  const r = await bigMat(120);
  const h = r.el('matBox').innerHTML;
  assert.equal(rowCount(h), 50, '한 쪽 50건');
  assert.match(h, /1–50 \/ 120건/);
  assert.match(h, /matPageTo\(2\)/, '3쪽까지 있어야 합니다');
  r.api.matPageTo(2);
  assert.equal(rowCount(r.el('matBox').innerHTML), 20, '마지막 쪽은 남은 20건');
  assert.match(r.el('matBox').innerHTML, /101–120 \/ 120건/);
});

test('★★ 번호는 갈래 전체로 이어 센다 — 둘째 쪽은 51번부터', async () => {
  const r = await bigMat(120);
  r.api.matPageTo(1);
  const h = r.el('matBox').innerHTML;
  assert.match(h, /<td class="rn">51<\/td>/);
  assert.match(h, /<td class="rn">100<\/td>/);
  assert.ok(h.indexOf('<td class="rn">1</td>') < 0);
});

test('★★ ㅁ 로 고르면 복사·CSV 는 «고른 것만» — 단추 글자도 그렇게 바뀐다', async () => {
  const r = await bigMat(120);
  assert.match(r.el('matBox').innerHTML, /전체 120건/);
  r.api.matTog(0, true); r.api.matTog(2, true);
  const h = r.el('matBox').innerHTML;
  assert.match(h, /고른 2건/, '무엇이 나가는지 단추가 말해야 합니다');
  assert.match(h, /class="sel-bar"/);
  const out = r.api.matRowsFor('perf');
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => x.project), ['과제1', '과제3']);
  assert.match(r.api.matText('perf'), /과제1/);
  assert.ok(r.api.matText('perf').indexOf('과제2') < 0);
});

test('★ 머리 ㅁ 는 «이 쪽»만 고르고 끈다', async () => {
  const r = await bigMat(120);
  r.api.matPageTo(1); r.api.matSelPage(true);
  assert.equal(r.api.matRowsFor('perf').length, 50);
  assert.equal(r.api.matRowsFor('perf')[0].project, '과제51');
  r.api.matSelPage(false);
  assert.equal(r.api.matRowsFor('perf').length, 120, '다 끄면 다시 전부');
});

test('★ 갈래마다 고른 것을 따로 기억한다 — 다른 갈래로 새지 않는다', async () => {
  const r = await bigMat(120);
  r.api.matTog(0, true);
  r.api.matGo('edu');
  assert.ok(r.el('matBox').innerHTML.indexOf('class="sel-bar"') < 0);
  r.api.matGo('perf');
  assert.match(r.el('matBox').innerHTML, /고른 1건/);
});

test('★★ 자문은 고른 것만 내보내도 «가려서» 나간다', async () => {
  const r = await runMat();
  r.api.matGo('advisory'); r.api.matTog(0, true);
  const out = r.api.matRowsFor('advisory');
  assert.equal(out.length, 1);
  assert.ok(String(out[0].org).indexOf('정밀') < 0, '고른 것이라도 이름이 나가면 안 됩니다');
  assert.ok(r.api.matText('advisory').indexOf('정밀') < 0);
});

test('★ 「지금 맡고 있는 것만」을 바꾸면 고른 것을 놓는다 — 번호가 다른 줄을 가리킨다', async () => {
  const r = await runMat();
  r.api.matGo('wiccok'); r.api.matTog(0, true);
  r.api.matLiveTog();
  assert.ok(r.el('matBox').innerHTML.indexOf('class="sel-bar"') < 0);
});

/* ═══════ 공고 모아보기 — ㅁ · № (대표 지시 2026-10-03) ═══════ */

const FEED3 = [
  { id: 'G1', src: '나라장터', no: 'R1-000', nm: '근무평정 대행 용역', type: '새 공고' },
  { id: 'G2', src: '나라장터', no: 'R2-000', nm: '조직진단 용역', type: '새 공고' },
  { id: 'G3', src: '알리오', no: '9', nm: '인사위원회 외부위원 공개모집', type: '관심' }
];

test('★★ 공고 줄마다 ㅁ 와 № 가 있다', () => {
  const r = runApp({ feed: FEED3 });
  r.api.draw();
  const h = r.el('tb').innerHTML;
  assert.equal(rowCount(h), 3);
  assert.match(h, /<td class="rn">1<\/td>/);
  assert.match(h, /<td class="rn">3<\/td>/);
  assert.match(src, /<th class="chk"><input type="checkbox" id="fSelAll"/, '머리에 전체 고르기');
  assert.match(src, /<th class="rn">№<\/th><th>출처<\/th>/);
});

test('★★ 고른 공고를 한꺼번에 관심으로 — 이미 관심인 것은 그대로', () => {
  const r = runApp({ feed: FEED3 });
  r.api.draw();
  r.api.feedTog('G1', true); r.api.feedTog('G3', true);
  assert.match(r.el('feedSel').innerHTML, /2건/);
  r.api.feedBulk('star');
  const f = JSON.parse(r.store.gov3_feed);
  assert.deepEqual(f.map((x) => x.type), ['관심', '새 공고', '관심']);
  assert.equal(r.el('feedSel').innerHTML, '', '하고 나면 고른 것을 놓는다');
});

test('★ 고른 것만 CSV 로 — 고르지 않은 것은 안 나간다', () => {
  const r = runApp({ feed: FEED3 });
  let blobText = '';
  r.api.draw();
  r.api.feedTog('G2', true);
  // expCsv 는 Blob 을 만든다 — 가짜 Blob 이 받은 글을 본다
  const ctxBlob = function (parts) { blobText = parts.join(''); };
  r.setBlob(ctxBlob);
  r.api.expCsv(true);
  assert.match(blobText, /조직진단 용역/);
  assert.ok(blobText.indexOf('근무평정') < 0);
});

test('★ 거르개로 안 보이게 된 줄은 고른 것에서 빠진다', () => {
  const r = runApp({ feed: FEED3 });
  r.api.draw();
  r.api.feedSelAll(true);
  assert.match(r.el('feedSel').innerHTML, /3건/);
  r.el('fSrc').value = '알리오';
  r.api.draw();
  assert.match(r.el('feedSel').innerHTML, /1건/, '안 보이는 것이 함께 숨겨지면 안 됩니다');
});

/* ═══════ 몇 건씩 · 과거 남기기 · 넓게 한 줄 · 팝업 (대표 지시 2026-10-03) ═══════ */

const many = (n) => Array.from({ length: n }, (_, i) => ({ id: 'G' + (i + 1), src: '나라장터',
  no: 'R' + (i + 1) + '-000', nm: '노무 공고 ' + (i + 1), org: '기관' + (i % 3), type: '새 공고',
  savedAt: '2026-10-0' + (1 + (i % 3)) + 'T09:00:00Z' }));

test('★★ 공고는 기본 50건씩 — 20·100·전체로 바꿀 수 있다', () => {
  const r = runApp({ feed: many(120) });
  r.api.draw();
  assert.equal(rowCount(r.el('tb').innerHTML), 50, '기본은 50건');
  assert.match(r.el('perBox').innerHTML, /<option value="50" selected>50건/);
  assert.match(r.el('feedPager').innerHTML, /1–50 \/ 120건/);
  r.api.feedPer(20); assert.equal(rowCount(r.el('tb').innerHTML), 20);
  r.api.feedPer(0);  assert.equal(rowCount(r.el('tb').innerHTML), 120, '「전체」는 한 쪽에 다');
  assert.equal(r.el('feedPager').innerHTML, '', '한 쪽이면 쪽 단추가 없다');
  r.api.feedPer(50); r.api.feedPageTo(2);
  assert.match(r.el('tb').innerHTML, /<td class="rn">101<\/td>/, '번호는 이어 센다');
});

test('★★ 숨긴 것은 지우지 않고 «숨긴 것»에서 다시 본다', () => {
  const f = many(3); f[1].hidden = true; f[1].ruleOut = true;
  const r = runApp({ feed: f });
  r.api.draw();
  assert.equal(rowCount(r.el('tb').innerHTML), 2);
  assert.match(r.el('cnt').textContent, /숨김 1건/, '숨긴 것이 있다고 말한다');
  r.el('fSt').value = '__hidden'; r.api.draw();
  assert.equal(rowCount(r.el('tb').innerHTML), 1);
  assert.match(r.el('tb').innerHTML, /숨김·규칙/);
  r.el('fSt').value = '__all'; r.api.draw();
  assert.equal(rowCount(r.el('tb').innerHTML), 3, '모두 = 숨긴 것 포함');
});

test('★★ 되살리면 규칙이 다시 숨기지 않는다', () => {
  const f = many(1); f[0].nm = 'KDB AI 거버넌스 수립 컨설팅'; f[0].hidden = true; f[0].ruleOut = true;
  const r = runApp({ feed: f });
  r.api.unhide('G1');
  assert.equal(r.api.rejudge(), 0, '되살렸는데 또 사라지면 안 됩니다');
  assert.equal(JSON.parse(r.store.gov3_feed)[0].hidden, false);
});

test('★★ 줄을 누르면 팝업 — 상세와 «비교»(같은 공고의 다른 차수 · 같은 기관의 다른 공고)', () => {
  const f = [
    { id: 'G1', src: '나라장터', no: 'R26BK01745083-001', nm: '공정위험성평가 컨설팅(재공고)', org: '한국지역난방공사', prc: 19990000, type: '새 공고' },
    { id: 'G2', src: '나라장터', no: 'R26BK01745083-000', nm: '공정위험성평가 컨설팅', org: '한국지역난방공사', prc: 18000000, type: '지나감' },
    { id: 'G3', src: '나라장터', no: 'R26BK01700000-000', nm: '작년 노무 컨설팅', org: '한국지역난방공사', type: '새 공고', hidden: true },
    { id: 'G4', src: '나라장터', no: 'R9-000', nm: '남의 기관', org: '다른곳', type: '새 공고' }
  ];
  const r = runApp({ feed: f });
  r.api.draw();
  r.api.feedRowClick({ target: { closest: () => null } }, 'G1');
  assert.equal(r.el('pop').className, 'pop on', '팝업이 떠야 합니다');
  const h = r.el('popBody').innerHTML;
  assert.match(h, /R26BK01745083-001/, '상세에 공고번호');
  assert.match(h, /같은 공고의 다른 차수/);
  // 이전 차수는 «차수» 칸에 있어야 한다 — 같은 기관 칸에만 있으면 재공고인지 알 수 없다
  const i1 = h.indexOf('같은 공고의 다른 차수'), i2 = h.indexOf('같은 기관의 다른 공고');
  assert.ok(i1 >= 0 && i2 > i1);
  assert.match(h.slice(i1, i2), /공정위험성평가 컨설팅<\/td>/, '이전 차수(-000)가 «차수» 비교 표에');
  assert.ok(h.slice(i2).indexOf('공정위험성평가 컨설팅</td>') < 0, '같은 것을 두 표에 겹쳐 싣지 않는다');
  assert.match(h, /1,800만원/, '금액을 견줄 수 있어야 합니다');
  assert.match(h, /작년 노무 컨설팅/, '같은 기관의 숨긴 것도 비교에 — 과거 자료');
  assert.ok(h.indexOf('남의 기관') < 0);
  r.api.popClose();
  assert.equal(r.el('pop').className, 'pop');
});

test('★ ㅁ·단추를 누른 것은 팝업을 띄우지 않는다', () => {
  const r = runApp({ feed: many(1) });
  r.api.draw();
  r.api.feedRowClick({ target: { closest: (sel) => (sel.indexOf('input') >= 0 ? {} : null) } }, 'G1');
  assert.notEqual(r.el('pop').className, 'pop on');
});

test('★★ 넓게 · 한 줄 — 폭 제한을 풀고 긴 칸은 줄여 title 로 전체를 본다', () => {
  assert.match(src, /\.wrap\{max-width:none/, '좌우를 다 쓴다');
  assert.ok(src.indexOf('.wrap{max-width:1180px') < 0);
  assert.match(src, /#pgFeed td,#pgMat td\{white-space:nowrap/, '한 줄');
  const r = runApp({ feed: many(1) });
  r.api.draw();
  assert.match(r.el('tb').innerHTML, /<td class="nm" title="노무 공고 1">/, '줄인 이름은 title 로');
  assert.ok(r.el('tb').innerHTML.indexOf('<div class="sub">') < 0, '두 번째 줄(번호)을 두지 않는다');
});

test('★ 신청 재료도 몇 건씩 볼지 고르고, 줄을 누르면 팝업', async () => {
  const r = await bigMat(120);
  assert.equal(rowCount(r.el('matBox').innerHTML), 50);
  r.api.matPer(100); assert.equal(rowCount(r.el('matBox').innerHTML), 100);
  r.api.matPer(0);   assert.equal(rowCount(r.el('matBox').innerHTML), 120);
  r.api.matRowClick({ target: { closest: () => null } }, 2);
  assert.equal(r.el('pop').className, 'pop on');
  assert.match(r.el('popBody').innerHTML, /과제3/);
  assert.match(r.el('popTtl').textContent, /3번/);
});
