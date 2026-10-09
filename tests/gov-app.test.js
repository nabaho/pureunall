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
    GovG2b: require('../js/gov-g2b.js'), GovPlan: require('../js/gov-plan.js'),
    GovCareer: require('../js/gov-career.js'), GovMatch: require('../js/gov-match.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'),
    Promise, navigator: {},
    GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'),
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort=()=>{}; this.signal=null; },
    URL: { createObjectURL: () => 'blob:x' }, Blob: function(parts){ if(hooks.blob) hooks.blob(parts); },
    confirm: () => true
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');   // 부팅은 빼고 함수만 싣는다
  vm.runInNewContext(code + '\n;globalThis.__api={draw,drawKw,dchip,star,find,readyNote,ageOut,'
    + 'setTab,careerPull,matchEnsure,matchNoteHtml,getMat:function(){ return _mat; },srcBackfill,rejudge,pullAll,PAGE_MAX,'
    + 'feedTog,feedSelAll,feedBulk,expCsv,feedPer,feedPageTo,feedPop,feedRowClick,unhide,popClose,'
    + 'feedMthd,isSole,planFetchNow,planDraw,planTog,planSelAll,planBulk,planStar,planHide,planGoFeed,planMthd,'
    + 'fetchAll,setMat:function(m){_mat=m;},setFb:function(db,uid){fbDb=db;fbUid=uid;},setPull:function(f){pull=f;}};', ctx);
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

/* ═══════ 경력관리 자료 — 견주기 전용 (대표 지시 2026-10-07 「신청재료 필요없다 모두 정리해달라」) ═══════
   「👤 신청 재료」 탭(목록·복사·CSV)은 걷어냈다. 경력관리 자료는 «지난 이력과 견주기»에만 읽는다. */

const MAT_LS = {
  edu: JSON.stringify([{ school: '영남대학교', major: '법학과', degree: '학사',
                         period: '1999.03 ~ 2003.02', graduated: '졸업' }]),
  cert: JSON.stringify([{ title: '공인노무사', org: '고용노동부', date: '20100813', num: '제9999호' }]),
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

async function runCareer(mode) {
  const r = runApp({ feed: [] });
  const map = {};
  Object.keys(MAT_LS).forEach((k) => { map['kcareer/U9/ls/' + k] = MAT_LS[k]; });
  const db = fakeDb(map, mode);
  r.api.setFb(db, 'U9');
  await r.api.careerPull();
  return { ...r, db };
}

test('★★ 「신청 재료」 탭이 없다 — 탭·화면·복사·CSV 모두', () => {
  ['tbMat', 'pgMat', 'matBox', 'matNote', "setTab('mat')", 'matPull', 'matDraw', 'matCopy', 'matCsv',
   'matRowsFor', 'MAT_KINDS', '👤 신청 재료<'].forEach((w) => {
    assert.ok(src.indexOf(w) < 0, '남았다: ' + w);
  });
  assert.match(src, /id="tbFeed"[^>]*onclick="setTab\('feed'\)"/);
  assert.match(src, /id="tbRec"[^>]*onclick="setTab\('rec'\)"/);
});

test('★ 내보내기용 가리기 모듈을 싣지 않는다 — 고객사 이름을 내보내는 길 자체가 없다', () => {
  assert.ok(src.indexOf('kcareer-adv-summary.js') < 0);
  assert.match(src, /<script src="js\/gov-career\.js\?v=\d+"><\/script>/, '견주기는 경력관리 자료를 읽어야 합니다');
});

test('★ 예전에 「신청 재료」를 보던 기기도 공고 탭으로 연다', () => {
  const r = runApp({ feed: [] });
  r.api.setTab('mat');
  assert.equal(r.el('pgFeed').style.display, '');
  assert.equal(r.el('pgRec').style.display, 'none');
  assert.match(r.el('tbFeed').className, /\bon\b/);
});

test('★★ 창고를 «콕 집어» 읽는다 — 노드를 통째로 읽지 않는다', async () => {
  const r = await runCareer();
  assert.ok(r.db.seen.length >= 8);
  r.db.seen.forEach((p) => {
    assert.match(p, /^kcareer\/U9\/ls\//, '통째로 읽으면 첨부 조각·열쇠까지 딸려 옵니다: ' + p);
  });
  assert.ok(r.db.seen.every((p) => p.indexOf('_secrets') < 0));
});

test('★★ 받은 자료가 견주기 재료가 된다', async () => {
  const r = await runCareer();
  const m = r.api.getMat();
  assert.ok(m, '받은 것이 없습니다');
  assert.ok(require('../js/gov-career.js').counts(m).total > 0);
});

test('★★ 경력관리 자료를 «클라우드로 내보내지 않는다»', () => {
  const m = src.match(/function cloudPush\(\)\{[\s\S]*?\n\}/);
  assert.ok(m, 'cloudPush 를 못 찾았습니다');
  ['_mat', 'mat:', 'advisory', 'wiccok'].forEach((w) => {
    assert.ok(m[0].indexOf(w) < 0, 'cloudPush 가 경력관리 자료를 밀어 올립니다: ' + w);
  });
});

test('★★ 경력관리 자료를 이 기기에도 담지 않는다', async () => {
  const r = await runCareer();
  Object.keys(r.store).forEach((k) => {
    const v = String(r.store[k] || '');
    assert.ok(v.indexOf('영남대학교') < 0 && v.indexOf('정밀') < 0, '저장되어 남았습니다: ' + k);
  });
});

const tick = () => new Promise((res) => setTimeout(res, 0));
test('★★ 하나도 못 읽으면 «없다»가 아니라 «못 읽었다»고 말한다', async () => {
  const r = runApp({ feed: [] });
  r.api.setFb(fakeDb({}, 'fail'), 'U9');
  r.api.matchEnsure(); await tick(); await tick();
  assert.equal(r.api.getMat(), null);
  assert.match(r.api.matchNoteHtml(), /못 읽어/);
});

test('★★ 클라우드가 비었으면 «☁ 저장을 한 번 누르시라»고 알려 준다', async () => {
  // 경력관리에서 한 번도 저장을 안 하면 클라우드는 비어 있다 — 흔한 막다른 길이다.
  const r = runApp({ feed: [] });
  r.api.setFb(fakeDb({}, 'empty'), 'U9');
  r.api.matchEnsure(); await tick(); await tick();
  const h = r.api.matchNoteHtml();
  assert.match(h, /클라우드에 아직 없습니다/, '무엇이 문제인지 말해야 합니다');
  assert.match(h, /클라우드에 저장/, '무엇을 하면 되는지도 말해야 합니다');
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

const rowCount = (h) => (h.match(/class="row-chk"/g) || []).length;

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
  assert.match(src, /#pgFeed td\{white-space:nowrap/, '한 줄');
  const r = runApp({ feed: many(1) });
  r.api.draw();
  assert.match(r.el('tb').innerHTML, /<td class="nm" title="노무 공고 1">/, '줄인 이름은 title 로');
  assert.ok(r.el('tb').innerHTML.indexOf('<div class="sub">') < 0, '두 번째 줄(번호)을 두지 않는다');
});

/* ═══ 「새로 받기」 사이에 누른 ★·숨김 — 다 받은 «뒤» 목록에 더한다 (검토 2026-10-04) ═══ */
test('★★ 받는 사이 누른 ★ 이 되돌아가지 않는다 · 두 번 눌러도 한 번만 받는다', async () => {
  const r = runApp({ feed: [{ id: 'G0001', src: '나라장터', type: '새 공고', no: 'OLD-1', nm: '노무자문 용역', org: 'A', closeDt: '2099-12-31' }],
    key_data: 'K' });
  let release; const gate = new Promise((res) => { release = res; });
  let calls = 0;
  r.api.setPull(async () => { calls++; await gate;
    return { response: { header: { resultCode: '00' }, body: { totalCount: 1,
      items: [{ bidNtceNo: 'NEW-1', bidNtceOrd: '000', bidNtceNm: '임금체계 개편 노무 컨설팅 용역', ntceInsttNm: 'B', bidClseDt: '2099-12-31 10:00' }] } } }; });
  const p1 = r.api.fetchAll();
  const p2 = r.api.fetchAll();               // 두 번 눌러도
  r.api.star('G0001');                       // 받는 사이 ★
  release(); await p1; await p2;
  const feed = JSON.parse(r.store.gov3_feed);
  assert.equal(feed.find((x) => x.no === 'OLD-1').type, '관심', '받는 사이 누른 ★ 이 지워졌다');
  assert.ok(feed.some((x) => x.no === 'NEW-1-000'), '새 공고는 들어온다');
  assert.equal(feed.filter((x) => x.no === 'NEW-1-000').length, 1, '두 번 받으면 안 된다');
  /* 한 번 받기 = 나라장터 + 알리오 + 발주계획(올해 1월부터 31일씩) + 사전규격 — 두 번 눌러도 «한 번 받기»와 같아야 한다 */
  const one = runApp({ feed: [], key_data: 'K' }); let calls1 = 0;
  one.api.setPull(async () => { calls1++; return { response: { header: { resultCode: '00' }, body: { totalCount: 0, items: [] } } }; });
  await one.api.fetchAll();
  assert.ok(calls1 >= 3, '발주계획·사전규격도 부른다');
  assert.equal(calls, calls1, '두 번 눌렀더니 더 불렀다');
});

/* ═══════ 수의계약 — 표시하고, 빼고 볼 수 있게 (대표 지시 2026-10-09) ═══════ */
const SOLE = () => [
  { id: 'S1', src: '나라장터', type: '새 공고', no: 'R1-000', nm: '노무 자문 용역', org: '갑기관', mthd: '수의계약', savedAt: '2026-10-05T01:37:00Z' },
  { id: 'S2', src: '나라장터', type: '새 공고', no: 'R2-000', nm: '평가체계 기획연구', org: '을기관', mthd: '제한경쟁', savedAt: '2026-10-07T11:02:00Z' },
  { id: 'S3', src: '나라장터', type: '새 공고', no: 'R3-000', nm: '인사 컨설팅', org: '병기관', mthd: '수의(소액)', savedAt: '2026-10-06T09:00:00Z' },
  { id: 'S4', src: '알리오', type: '새 공고', no: 'A4', nm: '경영평가위원 모집', org: '정기관', savedAt: '2026-10-06T09:00:00Z' }
];
test('★★ 수의계약 가르기 — 계약방법에 「수의」(수의계약·수의(소액)), 경쟁·빈칸·알리오는 아니다', () => {
  const r = runApp({});
  assert.equal(r.api.isSole({ mthd: '수의계약' }), true);
  assert.equal(r.api.isSole({ mthd: '수의(소액)' }), true);
  ['제한경쟁', '일반경쟁', '지명경쟁', ''].forEach((m) => assert.equal(r.api.isSole({ mthd: m }), false, m));
  assert.equal(r.api.isSole({ src: '알리오' }), false); assert.equal(r.api.isSole(null), false);
});
test('★★★ 목록에 「수의계약」 딱지 — 공고명 «앞»에(긴 이름에 잘려 안 보이면 안 된다)', () => {
  const r = runApp({ feed: SOLE() });
  r.api.draw();
  const tb = r.el('tb').innerHTML;
  const row = (nm) => tb.split('<tr').find((x) => x.indexOf(nm) >= 0) || '';
  assert.match(row('노무 자문 용역'), /<td class="nm"[^>]*><span class="tag amber"[^>]*>수의계약<\/span> <b>노무 자문 용역<\/b>/);
  assert.match(row('인사 컨설팅'), /수의계약<\/span> <b>인사 컨설팅/);
  assert.doesNotMatch(row('평가체계 기획연구'), /tag amber/, '경쟁 입찰에 수의계약 딱지');
  assert.doesNotMatch(row('경영평가위원 모집'), /tag amber/);
  assert.match(row('노무 자문 용역'), /title="노무 자문 용역 · 수의계약"/, '이름 칸 풍선에도');
});
test('★★★ 「수의계약 빼기」 — 목록에서만 빼고(숨기지·지우지 않음) 몇 건 뺐는지 말한다 · 「수의계약만」', () => {
  const r = runApp({ feed: SOLE() });
  r.el('fMthd').value = 'nosole'; r.api.draw();
  assert.equal(rowCount(r.el('tb').innerHTML), 2);
  assert.doesNotMatch(r.el('tb').innerHTML, /노무 자문 용역|인사 컨설팅/);
  assert.match(r.el('cnt').textContent, /수의계약 2건 뺌/);
  assert.equal(JSON.parse(r.store.gov3_feed).filter((x) => x.hidden).length, 0, '숨김으로 바꿨다');
  r.el('fMthd').value = 'sole'; r.api.draw();
  assert.equal(rowCount(r.el('tb').innerHTML), 2); assert.match(r.el('cnt').textContent, /수의계약만/);
  assert.doesNotMatch(r.el('tb').innerHTML, /평가체계|경영평가위원/);
  r.el('fMthd').value = ''; r.api.draw();
  assert.equal(rowCount(r.el('tb').innerHTML), 4); assert.doesNotMatch(r.el('cnt').textContent, /수의계약/);
});
test('★★ 고른 것은 이 기기에 기억하고(feed_mthd) 첫 쪽으로 · 이상한 값은 안 남긴다 · 부팅 때 되살린다', () => {
  const r = runApp({ feed: many(120).map((x, i) => Object.assign(x, { mthd: i % 2 ? '수의계약' : '일반경쟁' })) });
  r.api.draw(); r.api.feedPageTo(1);
  r.el('fMthd').value = 'nosole'; r.api.feedMthd('nosole');
  assert.equal(r.store.gov3_feed_mthd, 'nosole');
  assert.match(r.el('tb').innerHTML, /<td class="rn">1<\/td>/, '거르면 첫 쪽부터');
  assert.equal(rowCount(r.el('tb').innerHTML), 50); assert.match(r.el('cnt').textContent, /수의계약 60건 뺌/);
  r.api.feedMthd('<x>'); assert.equal(r.store.gov3_feed_mthd, '');
  assert.match(src, /function boot\(\)\{\s*recStickyWatch\(\);\s*var fmd=\$\('fMthd'\); if\(fmd\)\{ var fmv=lsGet\('feed_mthd'\); fmd\.value=\(fmv==='sole'\|\|fmv==='nosole'\)\?fmv:''; \}/);
  assert.match(src, /<select id="fMthd" onchange="feedMthd\(this\.value\)"[^>]*><option value="">전체 계약<\/option>\s*<option value="nosole">수의계약 빼기<\/option><option value="sole">수의계약만<\/option><\/select>/);
});
test('★ 팝업 계약방법 칸에도 딱지', () => {
  const r = runApp({ feed: SOLE() });
  r.api.draw(); r.api.feedPop('S1');
  assert.match(r.el('popBody').innerHTML, /계약방법[\s\S]{0,80}<span class="tag amber"[^>]*>수의계약<\/span> 수의계약/);
  r.api.feedPop('S2');
  assert.doesNotMatch(r.el('popBody').innerHTML, /tag amber/);
});

/* ═══════ 📅 발주 예정 — 나라장터 발주계획·사전규격 (대표 지시 2026-10-09) ═══════ */
const ymAdd = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const futureDt = () => { const d = new Date(Date.now() + 5 * 86400000); return d.toISOString().slice(0, 10) + ' 18:00:00'; };
const PLANS = () => [
  { kind: 'plan', no: 'P1', nm: '노무 자문 용역', org: '갑공단', ym: ymAdd(0), prc: 30000000, mthd: '수의계약', dept: '경영지원팀', tel: '02-000-0000', bids: [], kw: '노무' },
  { kind: 'plan', no: 'P2', nm: '직무분석 용역', org: '을공사', ym: ymAdd(3), prc: 60000000, mthd: '협상에의한계약', bids: [], kw: '직무분석' },
  { kind: 'plan', no: 'P3', nm: '조직진단 용역', org: '병재단', ym: ymAdd(-2), prc: 50000000, mthd: '제한경쟁', bids: [], kw: '조직진단' },
  { kind: 'spec', no: 'S9', nm: '인사평가체계 개선 컨설팅', org: '정시', prc: 20000000, rcptDt: '2026-10-07 09:00:00', closeDt: futureDt(), bids: [], kw: '평가체계',
    files: ['https://www.g2b.go.kr:8082/ep/co/fileDownload.do?fileTask=PS&fileSeq=9::1'] },
  { kind: 'plan', no: 'P4', nm: '임금체계 개편 용역', org: '무원', ym: ymAdd(-1), prc: 40000000, mthd: '일반경쟁', bids: ['R26BK00000001'], kw: '임금' },
  { kind: 'plan', no: 'P5', nm: '숨긴 노무 용역', org: '기관', ym: ymAdd(1), bids: [], hidden: true, kw: '노무' }
];
const planRowsOf = (h) => (h.match(/class="row-chk"/g) || []).length;
test('★★ 「📅 발주 예정」 탭이 있고 고르면 그 화면만 보인다', () => {
  assert.match(src, /<button class="tb" id="tbPlan" onclick="setTab\('plan'\)">📅 발주 예정<\/button>/);
  assert.match(src, /<script src="js\/gov-plan\.js\?v=\d+"><\/script>/);
  const r = runApp({ plan: PLANS() });
  r.api.setTab('plan');
  assert.equal(r.el('pgPlan').style.display, ''); assert.equal(r.el('pgFeed').style.display, 'none'); assert.equal(r.el('pgRec').style.display, 'none');
  assert.equal(r.el('tbPlan').className, 'tb on');
  r.api.setTab('feed'); assert.equal(r.el('pgPlan').style.display, 'none');
});
test('★★★ 공고 전(기본) — 임박·이번 달·예정월 지남·몇 달 뒤 차례, 공고 나온 것·숨긴 것은 빼고 ㅁ·№ · 탭에 임박 건수', () => {
  const r = runApp({ plan: PLANS() });
  r.el('pView').value = 'ahead'; r.api.planDraw();
  const h = r.el('ptb').innerHTML;
  assert.equal(planRowsOf(h), 4);
  const order = ['인사평가체계', '노무 자문', '조직진단', '직무분석'].map((t) => h.indexOf(t));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), '차례: 임박 → 이번 달 → 지남 → 뒤 ' + order);
  assert.doesNotMatch(h, /임금체계|숨긴 노무/);
  assert.match(h, /<td class="rn">1<\/td>[\s\S]*<td class="rn">4<\/td>/);
  assert.match(h, /<span class="tag red">사전규격<\/span>[\s\S]*🔔 공고 임박 · 의견 마감/);
  assert.match(h, /<span class="tag amber"[^>]*>수의계약<\/span> <b>노무 자문 용역<\/b>/, '수의계약 딱지');
  assert.match(h, /⏳ 이번 달 발주 예정/); assert.match(h, /⚠ 예정월 지남 · 아직 공고 없음/); assert.match(h, /3개월 뒤 발주 예정/);
  assert.match(h, /경영지원팀<div>02-000-0000<\/div>/, '담당 부서·전화');
  assert.match(h, /href="https:\/\/www\.g2b\.go\.kr:8082\/ep\/co\/fileDownload\.do\?fileTask=PS&amp;fileSeq=9::1"/, '사전규격서 링크');
  assert.match(r.el('tbPlan').innerHTML, /📅 발주 예정 <span class="tag red"[^>]*>2<\/span>/, '임박 1 + 이번 달 1');
  assert.match(r.el('pCnt').textContent, /전체 5건 · 지금 4건 · 숨김 1건/);
});
test('★★★ 「공고 나옴」 보기 — 공고 모아보기에 그 공고가 있으면 「공고 보기」로 바로 연다', () => {
  const r = runApp({ plan: PLANS(), feed: [{ id: 'G0001', src: '나라장터', type: '새 공고', no: 'R26BK00000001-000', nm: '임금체계 개편 용역', org: '무원' }] });
  r.el('pView').value = 'posted'; r.api.planDraw();
  const h = r.el('ptb').innerHTML;
  assert.equal(planRowsOf(h), 1); assert.match(h, /✅ 공고 나옴/); assert.match(h, /title="입찰공고번호 R26BK00000001"/);
  assert.match(h, /onclick="planGoFeed\('G0001'\)"[^>]*>공고 보기<\/button>/);
  r.api.planGoFeed('G0001');
  assert.equal(r.el('pgFeed').style.display, ''); assert.equal(r.el('pop').className, 'pop on');
  r.el('pView').value = 'hidden'; r.api.planDraw();
  assert.equal(planRowsOf(r.el('ptb').innerHTML), 1); assert.match(r.el('ptb').innerHTML, /숨긴 노무 용역/);
});
test('★★ 수의계약 고르개는 두 탭이 «한 값» — 발주 예정에서 빼면 공고 모아보기도 빠진다', () => {
  const r = runApp({ plan: PLANS() });
  r.el('pView').value = 'ahead'; r.el('pMthd').value = 'nosole'; r.api.planMthd('nosole');
  assert.doesNotMatch(r.el('ptb').innerHTML, /노무 자문 용역/);
  assert.match(r.el('pCnt').textContent, /수의계약 1건 뺌/);
  assert.equal(r.store.gov3_feed_mthd, 'nosole'); assert.equal(r.el('fMthd').value, 'nosole');
  r.api.feedMthd(''); assert.equal(r.el('pMthd').value, '', '반대쪽도 따라온다');
});
test('★★ ★ 관심 · 숨기기(지우지 않음) · 골라서 한꺼번에', () => {
  const r = runApp({ plan: PLANS() });
  r.el('pView').value = 'ahead'; r.api.planDraw();
  r.api.planStar('P2'); assert.equal(JSON.parse(r.store.gov3_plan).find((x) => x.no === 'P2').star, true);
  r.api.planTog('P1', true); r.api.planTog('P3', true);
  assert.match(r.el('planSel').innerHTML, /<b>2건<\/b> 선택/);
  r.api.planBulk('hide');
  const after = JSON.parse(r.store.gov3_plan);
  assert.equal(after.length, 6, '지우지 않는다'); assert.equal(after.filter((x) => x.hidden).length, 3);
  assert.equal(planRowsOf(r.el('ptb').innerHTML), 2);
  r.api.planHide('P1', false); assert.equal(JSON.parse(r.store.gov3_plan).find((x) => x.no === 'P1').hidden, false);
  r.el('pView').value = 'star'; r.api.planDraw(); assert.equal(planRowsOf(r.el('ptb').innerHTML), 1);
});
const PLAN_ENV = (items) => ({ response: { header: { resultCode: '00' }, body: { totalCount: items.length, items } } });
test('★★★ 새로 받기 — 발주계획(올해 1월부터 31일씩)·사전규격을 받아 «같은 찾는 말»로 거르고, 다음부터는 지난 며칠치만', async () => {
  const r = runApp({ feed: [], key_data: 'K' }); const urls = [];
  r.api.setPull(async (u) => { urls.push(u);
    if (/OrderPlanSttusService/.test(u)) return PLAN_ENV([
      { orderPlanUntyNo: 'R26DD1', bizNm: '근무평정 대행 용역', orderInsttNm: '갑', orderYear: '2026', orderMnth: '12', sumOrderAmt: '10000000', cntrctMthdNm: '수의계약' },
      { orderPlanUntyNo: 'R26DD2', bizNm: '청사 청소 용역', orderInsttNm: '을', orderYear: '2026', orderMnth: '12' }]);
    if (/HrcspSsstndrdInfoService/.test(u)) return PLAN_ENV([{ bfSpecRgstNo: '77', prdctClsfcNoNm: '노사관계 진단 컨설팅', rlDminsttNm: '병', opninRgstClseDt: '2099-01-01 18:00:00', rcptDt: '2026-10-08 09:00:00' }]);
    return PLAN_ENV([]); });
  await r.api.fetchAll();
  const plan = JSON.parse(r.store.gov3_plan);
  assert.deepEqual(plan.map((x) => x.no).sort(), ['R26DD1', 'S77'], '청소 용역은 안 걸린다');
  const y = new Date().getFullYear();
  const pu = urls.filter((u) => /OrderPlanSttusService/.test(u));
  assert.ok(pu.length >= 1 && pu.length === Math.ceil(((Date.now() - new Date(y, 0, 1)) / 86400000 + 1) / 31), '처음엔 올해 1월부터 31일씩: ' + pu.length);
  assert.match(pu[0], new RegExp('inqryBgnDt=' + y + '01010000'));
  assert.match(pu[0], new RegExp('orderBgnYm=' + y + '01&orderEndYm=' + (y + 1) + '12'));
  assert.match(r.store.gov3_plan_since, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(r.el('note').innerHTML, /📅 발주 예정 <b>2건<\/b> 새로 걸림/);
  urls.length = 0; await r.api.fetchAll();
  assert.equal(urls.filter((u) => /OrderPlanSttusService/.test(u)).length, 1, '두 번째부터는 지난 며칠치 한 묶음');
  assert.equal(JSON.parse(r.store.gov3_plan).length, 2, '같은 줄이 또 들어왔다');
});
test('★★★ 활용신청 승인 전 — 「승인을 기다리는 중」이라 말하고 신청 자리를 알려 주며, 받은 범위를 남기지 않는다', async () => {
  const r = runApp({ feed: [], key_data: 'K' });
  r.api.setPull(async (u) => (/\/ao\//.test(u)
    ? { OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg: 'SERVICE_ACCESS_DENIED_ERROR', returnAuthMsg: '서비스 접근거부', returnReasonCode: '20' } } }
    : PLAN_ENV([])));
  await r.api.fetchAll();
  assert.equal(r.store.gov3_plan_since || '', '', '못 받았는데 받은 범위를 남겼다 — 승인 뒤 1월부터 못 채운다');
  assert.equal(r.store.gov3_spec_since || '', '');
  assert.match(r.store.gov3_plan_err, /발주계획: 아직 못 받습니다 — 공공데이터포털 «활용신청 승인»을 기다리는 중/);
  assert.match(r.store.gov3_plan_err, /사전규격: 아직 못 받습니다/);
  r.api.planDraw();
  assert.match(r.el('planNote').innerHTML, /href="https:\/\/www\.data\.go\.kr\/data\/15129462\/openapi\.do"[\s\S]*15129437/);
  assert.match(r.el('note').innerHTML, /활용신청 승인/);
});
test('★ 저장된 줄의 규격서 주소가 https 가 아니면 링크로 안 그린다(다른 기기·옛 자료)', () => {
  const l = PLANS(); l[3].files = ['javascript:alert(1)'];
  const r = runApp({ plan: l }); r.el('pView').value = 'ahead'; r.api.planDraw();
  assert.doesNotMatch(r.el('ptb').innerHTML, /javascript:/); assert.doesNotMatch(r.el('ptb').innerHTML, /📎/);
});

/* ═══ 발주 예정 — 처음 열면 저절로 받고, 받는 동안 «이 탭»에 보인다 (2026-10-09 대표 화면: 「아직 받은 적이 없습니다」만 떠 있었다) ═══ */
const tickP = (ms) => new Promise((ok) => setTimeout(ok, ms || 0));
test('★★★ 인증키가 있고 한 번도 안 받았으면 탭을 여는 순간 받기 시작 — 진행이 이 탭에 보인다', async () => {
  const r = runApp({ feed: [], key_data: 'K' }); let release; const gate = new Promise((ok) => { release = ok; }); const urls = [];
  r.api.setPull(async (u) => { urls.push(u); await gate; return PLAN_ENV([]); });
  r.api.setTab('plan');
  await tickP();
  assert.ok(urls.length >= 1 && /OrderPlanSttusService/.test(urls[0]), '탭을 열어도 안 받는다');
  assert.match(r.el('planNote').innerHTML, /<b>⏳ 발주계획 받는 중… \(\d{4}-01-01 게시분부터, 1\/\d+\)<\/b>/);
  release();
  for (let i = 0; i < 100 && !r.store.gov3_plan_at; i++) await tickP(5);
  assert.match(r.store.gov3_plan_at || '', /^\d{4}-/, '받은 때를 남긴다');
  assert.match(r.el('planNote').innerHTML, /마지막으로 받은 때/);
  assert.match(r.el('note').innerHTML, /📅 발주 예정 <b>0건<\/b> 새로 걸림/);
});
test('★★ 받은 적이 있으면 탭을 열어도 다시 안 받는다(하루 한 번 자동에 맡긴다) · 열쇠가 없으면 안 받는다', async () => {
  let n = 0;
  const r = runApp({ feed: [], key_data: 'K', plan_at: '2026-10-09T10:00:00Z' }); r.api.setPull(async () => { n++; return PLAN_ENV([]); });
  r.api.setTab('plan'); await tickP(20);
  assert.equal(n, 0);
  const r2 = runApp({ feed: [] }); r2.api.setPull(async () => { n++; return PLAN_ENV([]); });
  r2.api.setTab('plan'); await tickP(20);
  assert.equal(n, 0); assert.match(r2.el('ptb').innerHTML, /인증키를 먼저/);
});
test('★★ 「아직 받은 적이 없습니다」 옆과 빈 표에 «누르는» 단추 — 글자만 있으면 막다른 길', () => {
  const r = runApp({ feed: [], key_data: 'K' }); r.api.planDraw();
  assert.match(r.el('planNote').innerHTML, /아직 받은 적이 없습니다<\/b> <button class="btn sm" onclick="planFetchNow\(\)">🔄 지금 받기<\/button>/);
  assert.match(r.el('ptb').innerHTML, /<button class="btn sm" onclick="planFetchNow\(\)">🔄 지금 받기<\/button>/);
});
test('★★ 지금 받기를 두 번 눌러도 한 번만 · 받는 중엔 새로 받기(전부)와 겹치지 않는다', async () => {
  const r = runApp({ feed: [], key_data: 'K', plan_at: 'x' }); let calls = 0, release; const gate = new Promise((ok) => { release = ok; });
  r.api.setPull(async () => { calls++; await gate; return PLAN_ENV([]); });
  const a = r.api.planFetchNow(); const b = r.api.planFetchNow(); const c = r.api.fetchAll();
  release(); await a; await b; await c;
  const one = runApp({ feed: [], key_data: 'K', plan_at: 'x' }); let c1 = 0;
  one.api.setPull(async () => { c1++; return PLAN_ENV([]); }); await one.api.planFetchNow();
  assert.equal(calls, c1, '겹쳐 받았다');
});
