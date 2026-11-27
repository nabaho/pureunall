/* 정부사업신청 — 🏢 푸른노무법인 지원사업 (대표 지시 2026-11-22)
   「컨설턴트 모집이나 연구사업 일을 진행한다면 … 푸른노무법인에서 사업 진행 아니면 컨설턴트 모집 지원 클릭을 만들어 주고
    … 진행했다면 정부사업 신청에서는 푸른노무법인 지원사업으로 표시 · 사업 신청서와 관련 서식을 다 끌어오고 모으고」
   대표 결정: ① 법인 진행은 경력관리 «기존 사업관리»에 ② 별도 탭 + 딱지 ③ 서식은 이름·링크만.
   ═══════════════════════════════════════════════════════════════════════════
   ★ 이 검사가 못 박는 규칙
     ① 공고 줄의 「📝」는 «고르는 창» — 🏢 법인 진행 / 👤 컨설턴트 지원(예전 📝 길 그대로). 어느 탭에서든 같은 창.
     ② 고르면 「🏢 푸른 지원사업」 탭과 공고 줄 딱지에 보인다. 같은 공고는 한 줄(영구 id) — 지우지 않고 「그만둠」으로.
     ③ 👤 넘기기(🎯 ☐ 지원 포함)는 표시를 하되, 이미 🏢 로 고른 공고의 갈래를 몰래 바꾸지 않는다.
     ④ 나라장터 공고는 그 공고일 «하루치» 목록에서 번호·차수로 찾아 첨부 서식 «링크»를 모은다 — 못 모으면 까닭을 남긴다.
        링크는 http(s)만(javascript:·아이디 박힌 주소 버림), 같은 주소는 한 번만.
     ⑤ 경력관리로는 같은 사이트 localStorage(pu_kc_biz_handoff)로 «채울 내용»만 — 경력관리가 사업 창을 채워 열고 저장은 사람이.
        같은 공고는 govRef(정부사업신청 기록 id)로 찾는다(사업명으로 찾지 않는다).
   실행: node --test tests/gov-pursue.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const G = require('../js/gov-g2b.js');
const P = require('../js/gov-pursue.js');
const KB = require('../js/kcareer-biz.js');
const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
const kc = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* ───────── 판정 모듈 ───────── */
test('★★★ 표시 — 새 기록은 영구 id·개체 종류·만든 때를 갖고, 같은 공고는 «한 줄»(갈래만 바뀐다)', () => {
  const a = P.mark([], { kind: 'corp', src: 'feed', ref: 'G1', srcName: '나라장터', title: '노무관리 컨설팅 용역', org: '대전광역시',
    url: 'https://www.g2b.go.kr/x', closeDt: '2026-12-01 10:00', prc: 5e7 }, '2026-11-22T01:00:00.000Z', 0.123456);
  assert.equal(a.isNew, true);
  const r = a.rec;
  assert.match(r.id, /^PS-/); assert.equal(r.entityType, 'Project'); assert.equal(r.createdAt, '2026-11-22T01:00:00.000Z');
  assert.equal(r.updatedAt, r.createdAt); assert.equal(r.state, '진행'); assert.equal(r.kind, 'corp');
  const b = P.mark(a.list, { kind: 'person', src: 'feed', ref: 'G1', title: '' }, '2026-11-23T01:00:00.000Z');
  assert.equal(b.isNew, false); assert.equal(b.list.length, 1, '같은 공고가 두 줄이 되면 안 된다');
  assert.equal(b.rec.id, r.id, 'id 는 바뀌지 않는다'); assert.equal(b.rec.kind, 'person');
  assert.equal(b.rec.title, '노무관리 컨설팅 용역', '빈 값으로 베낀 사실을 지우지 않는다');
  assert.equal(b.rec.createdAt, r.createdAt); assert.equal(b.rec.updatedAt, '2026-11-23T01:00:00.000Z');
  assert.equal(P.mark([], { kind: 'x', src: 'feed', ref: 'G1' }).rec, null);
  assert.equal(P.mark([], { kind: 'corp', src: 'mail', ref: 'G1' }).rec, null);
  assert.equal(P.mark([], { kind: 'corp', src: 'feed', ref: '' }).rec, null);
});

test('★★ 그만둠은 «지우기»가 아니다 — 줄은 남고, 사람이 되살린다', () => {
  const a = P.mark([], { kind: 'corp', src: 'hit', ref: 'h1', title: 't' }, '2026-11-22T00:00:00Z');
  const off = P.setState(a.list, a.rec.id, '그만둠', '2026-11-22T02:00:00Z');
  assert.equal(off.list.length, 1); assert.equal(off.rec.state, '그만둠');
  assert.equal(P.setState(off.list, a.rec.id, '삭제', 'x').rec, null, '모르는 상태로는 못 바꾼다');
  assert.deepEqual(P.index(off.list), {}, '그만둔 공고에는 딱지를 안 붙인다');
  const again = P.mark(off.list, { kind: 'corp', src: 'hit', ref: 'h1' }, '2026-11-22T03:00:00Z');
  assert.equal(again.rec.state, '진행', '사람이 다시 고르면 진행'); assert.equal(again.list.length, 1);
});

test('★★ 탭 보기 — 진행 중(마감 안 지남·모름) · 마감 지난 것 · 그만둔 것 · 갈래·검색', () => {
  let L = [];
  const add = (ref, kind, closeDt, t) => { L = P.mark(L, { kind, src: 'feed', ref, title: t || ref, org: '기관', closeDt }, '2026-11-2' + ref.slice(-1) + 'T00:00:00Z').list; };
  add('a1', 'corp', '2026-12-10'); add('a2', 'person', '2026-11-25 18:00'); add('a3', 'corp', '2026-11-01'); add('a4', 'corp', ''); add('a5', 'person', '2026-11-30', '스마트공장 구축');
  L = P.setState(L, L.find((r) => r.ref === 'a5').id, '그만둠', 'z').list;
  const ids = (o) => P.visible(L, Object.assign({ today: '2026-11-22' }, o)).map((r) => r.ref);
  assert.deepEqual(ids({ view: 'live' }), ['a2', 'a1', 'a4'], '마감 가까운 것부터, 마감 모름은 끝');
  assert.deepEqual(ids({ view: 'past' }), ['a3']);
  assert.deepEqual(ids({ view: 'off' }), ['a5']);
  assert.equal(ids({ view: 'all' }).length, 5);
  assert.deepEqual(ids({ view: 'live', kind: 'person' }), ['a2']);
  assert.deepEqual(ids({ view: 'all', q: '스마트' }), ['a5']);
  const c = P.counts(L, '2026-11-22');
  assert.equal(c.live, 3); assert.equal(c.past, 1); assert.equal(c.off, 1); assert.equal(c.corp + c.person, c.live);
  assert.equal(P.days({ closeDt: '2026-02-30' }, '2026-02-01'), null, '없는 날짜는 마감 모름');
});

test('★★ 링크는 http(s)만 · 아이디 박힌 주소 버림 · 같은 주소 한 번 · 많게는 FILES_MAX', () => {
  assert.equal(P.safeUrl('javascript:alert(1)'), '');
  assert.equal(P.safeUrl('https://user:pw@evil.example/x'), '');
  assert.equal(P.safeUrl('https://www.g2b.go.kr/a?b=1'), 'https://www.g2b.go.kr/a?b=1');
  assert.equal(P.safeUrl('https://evil.example\\@www.g2b.go.kr/x'), '', '«\» 섞인 비표준 모양도 버린다(해석기로 본다)');
  assert.equal(KB.govUrl('https://u:p@evil.example/x'), ''); assert.equal(KB.govUrl('javascript:alert(1)'), '');
  const many = Array.from({ length: P.FILES_MAX + 5 }, (_, i) => ({ name: 'f' + i, url: 'https://x.example/' + i }));
  assert.equal(P.cleanFiles(many).length, P.FILES_MAX);
  assert.equal(P.cleanFiles([{ name: 'a', url: 'https://x/1' }, { name: 'b', url: 'https://x/1' }]).length, 1);
  const h = P.bizHandoff({ id: 'PS-1', title: 't', url: 'javascript:x', files: [{ name: 'n', url: 'data:x' }], secret: 's' }, 5, 'u1', 'tk');
  assert.deepEqual(Object.keys(h).sort(), ['at', 'closeDt', 'files', 'no', 'openDt', 'org', 'prc', 'pursueId', 'src', 'title', 'tok', 'uid', 'url', 'v'],
    '공개 공고의 사실 + 보낸 계정·일회용 표뿐');
  assert.equal(h.url, ''); assert.deepEqual(h.files, []);
});

/* ───────── 나라장터 첨부 서식 ───────── */
const ITEM = { bidNtceNo: 'R26BK01234567', bidNtceOrd: '000', bidNtceNm: '노무관리 컨설팅 용역',
  stdNtceDocUrl: 'https://www.g2b.go.kr/std?no=1',
  ntceSpecDocUrl1: 'https://www.g2b.go.kr/f?seq=1', ntceSpecFileNm1: '제안요청서.hwp',
  ntceSpecDocUrl2: 'javascript:alert(1)', ntceSpecFileNm2: '나쁜.hwp',
  ntceSpecDocUrl3: 'https://www.g2b.go.kr/f?seq=1', ntceSpecFileNm3: '겹친.hwp',
  ntceSpecDocUrl4: 'https://www.g2b.go.kr/f?seq=4', ntceSpecFileNm4: '' };
const OK = (items) => ({ response: { header: { resultCode: '00' }, body: { totalCount: items.length, items } } });

test('★★★ 공고 하나의 서식 — 표준 공고서 + 규격서 열 벌, 나쁜·겹친 주소는 버리고 이름 없는 것은 「첨부 N」', () => {
  const f = G.specFiles(ITEM);
  assert.deepEqual(f.map((x) => x.name), ['표준 공고서', '제안요청서.hwp', '첨부 3']);
  assert.ok(f.every((x) => /^https:\/\//.test(x.url)));
  const r = G.filesFrom(OK([{ bidNtceNo: 'R26BK09999999', bidNtceOrd: '000', ntceSpecDocUrl1: 'https://x/other' }, ITEM]), 'R26BK01234567-000');
  assert.equal(r.ok, true); assert.equal(r.found, true); assert.equal(r.files.length, 3);
  assert.equal(G.filesFrom(OK([ITEM]), 'R26BK01234567-001').found, false, '차수가 다르면 다른 공고');
  const e = G.filesFrom({ 'nkoneps.com.response.ResponseError': { header: { resultCode: '07', resultMsg: '입력범위값 초과 에러' } } }, 'R26BK01234567-000');
  assert.equal(e.ok, false, 'HTTP 200 오류 묶음을 «서식 없음»으로 읽지 않는다'); assert.match(e.err, /입력범위값/);
});

test('★★ 나라장터 «공식 주소»(g2b.go.kr)만 서식으로 — 다른 사이트는 빼고 몇 개 뺐는지 알린다', () => {
  const bad = Object.assign({}, ITEM, { ntceSpecDocUrl5: 'https://evil.example/f?seq=5', ntceSpecFileNm5: '가짜 서식.hwp',
    ntceSpecDocUrl6: 'https://g2b.go.kr.evil.example/f', ntceSpecFileNm6: '닮은 주소.hwp', ntceSpecDocUrl7: 'https://ebid.g2b.go.kr:8101/f?x=7', ntceSpecFileNm7: '하위 주소.hwp' });
  const o = {};
  const f = G.specFiles(bad, o);
  assert.ok(f.every((x) => /^https:\/\/([a-z0-9-]+\.)*g2b\.go\.kr(:\d+)?\//.test(x.url)), '공식 주소만');
  assert.ok(f.some((x) => x.name === '하위 주소.hwp'), 'g2b.go.kr 아래 주소는 받는다');
  assert.ok(!f.some((x) => /가짜|닮은/.test(x.name)));
  assert.equal(o.dropped, 3, 'javascript: 하나 + 다른 사이트 둘');
  const only = G.filesFrom(OK([{ bidNtceNo: 'R1', bidNtceOrd: '000', ntceSpecDocUrl1: 'https://evil.example/x', ntceSpecFileNm1: 'x' }]), 'R1-000');
  assert.equal(only.files.length, 0); assert.equal(only.dropped, 1);
});

/* ───────── 화면에서 «실제로» ───────── */
function FixedDate(now) {
  const Real = Date;
  function D(...a) { return a.length ? new Real(...a) : new Real(now); }
  D.now = () => new Real(now).getTime(); D.prototype = Real.prototype; D.parse = Real.parse; D.UTC = Real.UTC;
  return D;
}
function runApp(seed) {
  const els = {}, toasts = [], opened = [], ss = {};
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '', className: '', checked: false, title: '',
      style: {}, classList: { add(){}, remove(){} } };
    return els[id];
  }
  el('uView').value = 'live';
  const store = {};
  Object.keys(seed || {}).forEach((k) => { store['gov3_' + k] = typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]); });
  const ctx = {
    console, setTimeout, clearTimeout, Math, JSON, String, Number, Object, Array, RegExp, Promise,
    Date: FixedDate('2026-11-22T10:00:00'),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    sessionStorage: { setItem: (k, v) => { ss[k] = v; } },
    document: { getElementById: el, createElement: () => ({ click(){}, style:{} }), addEventListener(){} },
    location: { protocol: 'https:', href: '', pathname: '/gov.html' }, navigator: {},
    GovG2b: G, GovPlan: require('../js/gov-plan.js'), GovCareer: require('../js/gov-career.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'), GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'), GovRecruit: require('../js/gov-recruit.js'),
    GovSubmit: require('../js/gov-submit.js'), GovMatch: require('../js/gov-match.js'), GovOrgRec: require('../js/gov-orgrec.js'),
    GovInbox: require('../js/gov-inbox.js'), GovPick: require('../js/gov-pick.js'), GovSync: require('../js/gov-sync.js'),
    GovRegion: require('../js/gov-region.js'), GovAi: require('../js/gov-ai.js'), GovPursue: P,
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort = () => {}; this.signal = null; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} }, Blob: function(){},
    prompt: () => null, confirm: () => true, open: (u) => { opened.push(u); return {}; },
    screen: { availWidth: 1600, availHeight: 900 }, TextDecoder, Uint8Array
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
  vm.runInNewContext(code + '\n;globalThis.__api={setTab,draw,get,pursueAsk,pursueCorp,purShow,purToBiz,purOff,purOn,purDraw,purTog,purSelAll,purBulk,toForm,applicationFromHit,lensDraw,'
    + 'setWatch:function(w){ _recWatch=w; },setFb:function(db,uid){ fbDb=db; fbUid=uid; },setPull:function(f){ pull=f; },toast:function(f){ toast=f; }};', ctx);
  ctx.__api.toast((m) => toasts.push(m));
  ctx.__api.setFb(null, 'qa-owner');
  return { api: ctx.__api, el, store, toasts, opened, ss, ctx };
}
const FEED = [
  { id: 'G0001', src: '나라장터', no: 'R26BK01234567-000', type: '새 공고', nm: '2027 대전 노무관리 컨설팅 용역', org: '대전광역시',
    openDt: '2026-11-20 10:00:00', closeDt: '2026-12-01 10:00:00', prc: 50000000, savedAt: '2026-11-20T09:00:00Z', kw: '노무', url: 'https://www.g2b.go.kr/link/G0001' },
  { id: 'G0002', src: '기업마당', no: 'PBLN_1', type: '새 공고', nm: '영세사업장 인사노무관리체계 구축 지원사업', org: '고용노동부',
    openDt: '2026-11-19', closeDt: '2026-12-10', savedAt: '2026-11-19T09:00:00Z', kw: '노무,인사', url: 'https://www.bizinfo.go.kr/x' }
];
const WATCH = { hits: { h1: { key: 'h1', board: 'nosa', boardName: '노사발전재단', title: '2027 일터혁신 컨설턴트 모집', date: '2026-11-18', href: 'https://example.com/h1', per: { to: '2026-11-29' } } },
  last: { at: Date.now() } };

test('★★★ 「📝」 는 어느 줄에서든 «고르는 창» — 🏢 법인 진행 / 👤 컨설턴트 지원(예전 길)', () => {
  /* 줄 단추가 지원 작업함으로 «바로» 가지 않는다 — 공고 모아보기·모아보기 탭·컨설턴트 모집 */
  assert.match(src, /data-id="'\+id\+'" onclick="pursueAsk\(\\'feed\\',this\.dataset\.id\)">📝<\/button>/, '공고 모아보기 줄 — 번호는 data 속성으로(인라인 글자에 박지 않는다)');
  assert.match(src, /else if\(what==='apply'\) pursueAsk\('feed', t\.ref\)/, '📍·🤖 탭 공고 줄');
  assert.match(src, /else if\(what==='apply'\) pursueAsk\('hit', t\.ref\)/, '📍·🤖 탭 모집 글');
  assert.match(src, /function recSupportInput\(key\)\{\s*return '<button[^\n]*pursueAsk\(\\'hit\\'/, '컨설턴트 모집 글 줄');
  const r = runApp({ feed: FEED });
  r.api.setWatch(WATCH);
  r.api.pursueAsk('feed', 'G0001');
  const h = r.el('popBody').innerHTML;
  assert.match(h, /onclick="pursueCorp\(this\.dataset\.src,this\.dataset\.ref\)"/);
  assert.match(h, /onclick="toForm\(this\.dataset\.ref\)"/, '👤 은 예전 「📝 지원 준비」 길 그대로');
  assert.match(h, /푸른노무법인 사업으로 진행/); assert.match(h, /컨설턴트로 지원 준비/);
  r.api.pursueAsk('hit', 'h1');
  assert.match(r.el('popBody').innerHTML, /onclick="applicationFromHit\(this\.dataset\.ref\)"/);
});

test('★★★ 🏢 법인 진행 — 표시하고, 나라장터는 그 공고일 하루치에서 서식 링크를 모아 «사업관리에 담기» 창을 띄운다', async () => {
  const r = runApp({ feed: FEED, key_data: 'QA-KEY' });
  const urls = [];
  r.api.setPull(async (u) => { urls.push(u); return OK([{ bidNtceNo: 'R26BK00000001', bidNtceOrd: '000' }, ITEM]); });
  await r.api.pursueCorp('feed', 'G0001');
  const list = r.api.get('pursue');
  assert.equal(list.length, 1);
  const rec = list[0];
  assert.equal(rec.kind, 'corp'); assert.equal(rec.src, 'feed'); assert.equal(rec.ref, 'G0001'); assert.equal(rec.srcName, '나라장터');
  assert.equal(rec.title, FEED[0].nm); assert.equal(rec.closeDt, FEED[0].closeDt, '마감을 베껴 둔다(목록 줄이 정리돼도 탭이 그려지게)');
  assert.equal(urls.length, 1, '한 번 불러 찾았다');
  assert.match(urls[0], /inqryBgnDt=202611200000/); assert.match(urls[0], /inqryEndDt=202611202359/, '공고일 하루치(7일 제한 안)');
  assert.deepEqual(rec.files.map((f) => f.name), ['표준 공고서', '제안요청서.hwp', '첨부 3']);
  assert.equal(rec.filesErr, '');
  const pop = r.el('popBody').innerHTML;
  assert.match(pop, /onclick="purToBiz\(this\.dataset\.id\)"[^>]*>🏢 경력관리 사업관리에 담기/);
  assert.match(pop, /제안요청서\.hwp/); assert.match(pop, /rel="noopener noreferrer"/);
  /* 공고 줄 딱지 */
  r.api.draw();
  assert.match(r.el('tb').innerHTML, /<span class="ptag"[^>]*>🏢 푸른 진행<\/span>/);
  /* 탭 */
  r.api.setTab('pur');
  assert.equal(r.el('pgPur').style.display, ''); assert.equal(r.el('pgFeed').style.display, 'none');
  const tb = r.el('purTb').innerHTML;
  assert.match(tb, /2027 대전 노무관리 컨설팅 용역/); assert.match(tb, /법인 진행/); assert.match(tb, /📎 3/); assert.match(tb, /D-9/);
  assert.match(tb, /<td class="chk"><input type="checkbox"/); assert.match(tb, /<td class="rn">1<\/td>/);
  assert.match(r.el('purN').innerHTML, />1</, '탭에 진행 중 건수');
});

test('★★ 서식을 못 모으면 «없다»가 아니라 까닭을 남긴다 — 오류·인증키 없음 · 모집 글은 원문에서', async () => {
  const r = runApp({ feed: FEED, key_data: 'QA-KEY' });
  r.api.setPull(async () => ({ 'nkoneps.com.response.ResponseError': { header: { resultCode: '30', resultMsg: '등록되지 않은 서비스키' } } }));
  await r.api.pursueCorp('feed', 'G0001');
  assert.match(r.api.get('pursue')[0].filesErr, /나라장터: 등록되지 않은 서비스키/);
  const r2 = runApp({ feed: FEED });
  await r2.api.pursueCorp('feed', 'G0001');
  assert.match(r2.api.get('pursue')[0].filesErr, /인증키가 없어/);
  const r3 = runApp({ feed: FEED, key_data: 'QA-KEY' });
  let called = 0; r3.api.setPull(async () => { called++; return OK([]); });
  r3.api.setWatch(WATCH);
  await r3.api.pursueCorp('hit', 'h1');
  assert.equal(called, 0, '모집 글은 나라장터를 부르지 않는다');
  const rec = r3.api.get('pursue')[0];
  assert.equal(rec.srcName, '모집 글'); assert.equal(rec.closeDt, '2026-11-29');
  assert.match(r3.el('popBody').innerHTML, /원문 공고에서 받으세요/);
});

test('★★★ 🏢 → 경력관리 사업관리 — 같은 사이트 localStorage 로 «채울 내용»만, 새 탭 kcareer.html?go=biz', async () => {
  const r = runApp({ feed: FEED, key_data: 'QA-KEY' });
  r.api.setPull(async () => OK([ITEM]));
  await r.api.pursueCorp('feed', 'G0001');
  const id = r.api.get('pursue')[0].id;
  r.api.purToBiz(id);
  const h = JSON.parse(r.store.pu_kc_biz_handoff);
  assert.equal(h.v, 1); assert.equal(h.pursueId, id); assert.equal(h.title, FEED[0].nm); assert.equal(h.files.length, 3);
  assert.equal(h.uid, 'qa-owner', '보낸 계정');
  assert.ok(h.tok && r.opened.length === 1 && r.opened[0] === 'kcareer.html?go=biz&t=' + encodeURIComponent(h.tok), '일회용 표가 주소에도 간다');
  assert.equal(KB.govCheck(h, h.at + 1000, 'qa-owner', h.tok), 'ok', '경력관리가 받아 쓸 수 있는 모양(1초 뒤 받는다고 보고)');
  assert.ok(r.api.get('pursue')[0].handAt, '넘긴 때를 남긴다');
  assert.ok(!/kcareer\//.test(src.match(/function purToBiz[\s\S]*?\n\}/)[0]), '경력관리 자리(kcareer/…)에 직접 쓰지 않는다');
});

test('★★★ 👤 넘기기는 표시하되 — 이미 🏢 로 고른 공고의 갈래는 몰래 바꾸지 않는다', async () => {
  const r = runApp({ feed: FEED, key_data: 'QA-KEY' });
  r.api.setPull(async () => OK([ITEM]));
  r.api.toForm('G0002');
  assert.match(r.ctx.location.href, /kcareer\.html\?go=form&application=/, '예전 지원 작업함 길 그대로');
  let p = r.api.get('pursue');
  assert.equal(p.length, 1); assert.equal(p[0].kind, 'person'); assert.equal(p[0].ref, 'G0002');
  await r.api.pursueCorp('feed', 'G0001');
  r.api.toForm('G0001');
  p = r.api.get('pursue');
  assert.equal(p.find((x) => x.ref === 'G0001').kind, 'corp', '🎯 ☐ 지원·📝 👤 이 🏢 를 덮지 않는다');
  r.api.draw();
  assert.match(r.el('tb').innerHTML, /<span class="ptag person"[^>]*>👤 지원 준비<\/span>/);
});

test('★★ 그만둠·되살림 · ☐ 고르기는 «보이는 것»만 · 일괄은 한 번에 저장', async () => {
  const r = runApp({ feed: FEED, key_data: 'QA-KEY' });
  r.api.setPull(async () => OK([ITEM]));
  await r.api.pursueCorp('feed', 'G0001');
  r.api.toForm('G0002');
  r.api.setTab('pur');
  assert.equal((r.el('purTb').innerHTML.match(/<tr class="rr/g) || []).length, 2);
  r.api.purSelAll(true);
  assert.match(r.el('purSel').innerHTML, /2건<\/b> 선택/);
  r.api.purBulk('off');
  assert.ok(r.api.get('pursue').every((x) => x.state === '그만둠'));
  assert.equal(r.api.get('pursue').length, 2, '지우지 않는다');
  assert.match(r.el('purTb').innerHTML, /아직 고른 공고가 없습니다|조건에 맞는 것이 없습니다/);
  r.el('uView').value = 'off'; r.api.purDraw();
  assert.equal((r.el('purTb').innerHTML.match(/<tr class="rr/g) || []).length, 2);
  r.api.purOn(r.api.get('pursue')[0].id);
  assert.equal(r.api.get('pursue').filter((x) => x.state === '진행').length, 1);
  r.api.setTab('feed');
  r.api.setTab('pur');
  assert.equal(r.el('purSel').innerHTML, '', '탭을 떠나면 고른 것을 비운다');
});

test('★★ 탭 짜임 — 맨 왼쪽 ☐ + №, 폰에서는 「지원사업」, 기록은 기기 사이로(GovSync pursue)', () => {
  const tb = (src.match(/<button class="tb" id="tbPur" onclick="setTab\('pur'\)"[^>]*>([\s\S]*?)<\/button>/) || [])[1];
  assert.ok(tb, '🏢 탭 단추가 없다');
  assert.equal(tb.replace(/<span class="mx">[^<]*<\/span>/g, '').replace(/<span id="purN"><\/span>/, ''), '지원사업', '폰(.mx 숨음)');
  const head = (src.match(/<table class="rec-hits rec-fixed"><colgroup>[^\n]*\n\s*<thead><tr><th class="chk"><input type="checkbox" id="uSelAll"[^\n]*<\/tr><\/thead>/) || [])[0];
  assert.ok(head && /<th class="chk">[\s\S]*?<th class="rn">№<\/th>/.test(head), '머리줄 ☐ 다음 №');
  assert.match(src, /<script src="js\/gov-pursue\.js\?v=\d+"><\/script>/);
  const S = require('../js/gov-sync.js');
  assert.equal(S.field('pursue').kind, 'rows'); assert.equal(S.field('pursue').idf, 'id', '줄은 영구 id 로 합친다');
});

/* ───────── 경력관리 쪽 받는 문 ───────── */
test('★★★ 경력관리 — 넘어온 공고를 사업 칸으로(단계 「준비」·마감·구분), 오래되거나 모양이 틀리면 안 받는다', () => {
  const now = Date.parse('2026-11-22T01:00:00Z');
  const h = { v: 1, at: now - 1000, pursueId: 'PS-abc', title: '2027 대전 노무관리 컨설팅 용역', org: '대전광역시', url: 'https://www.g2b.go.kr/x',
    no: 'R26BK01234567-000', src: '나라장터', openDt: '2026-11-20 10:00:00', closeDt: '2026-12-01 10:00:00', prc: 50000000,
    files: [{ name: '제안요청서.hwp', url: 'https://www.g2b.go.kr/f?1' }, { name: '참가신청서.hwp', url: 'https://www.g2b.go.kr/f?2' }, { name: 'x', url: 'javascript:1' }] };
  assert.equal(KB.govOk(h, now), true);
  assert.equal(KB.govOk(Object.assign({}, h, { at: now - 11 * 60000 }), now), false, '10분 넘은 것');
  assert.equal(KB.govOk(Object.assign({}, h, { v: 2 }), now), false);
  assert.equal(KB.govOk(Object.assign({}, h, { pursueId: '' }), now), false);
  /* 받는 탭 — 같은 계정 · 자기 표만 쓴다. 남의 것은 건드리지 않고(other), 낡은 것만 지운다(stale) */
  const hh = Object.assign({}, h, { uid: 'u1', tok: 't1' });
  assert.equal(KB.govCheck(hh, now, 'u1', 't1'), 'ok');
  assert.equal(KB.govCheck(hh, now, 'u2', 't1'), 'other', '계정을 바꾼 뒤의 다른 계정');
  assert.equal(KB.govCheck(hh, now, 'u1', 't9'), 'other', '다른 탭에서 넘긴 것');
  assert.equal(KB.govCheck(hh, now, 'u1', ''), 'other', '표 없이 연 주소');
  assert.equal(KB.govCheck(Object.assign({}, hh, { at: now - 11 * 60000 }), now, 'u1', 't1'), 'stale');
  const v = KB.fromGov(h, now);
  assert.equal(v.stage, '준비'); assert.equal(v.kind, '입찰·용역'); assert.equal(v.due, '2026-12-01'); assert.equal(v.year, '2026');
  assert.equal(v.amt, '50000000'); assert.equal(v.govRef, 'PS-abc'); assert.match(v.memo, /정부사업신청에서 넘김/);
  assert.deepEqual(v.govFiles.map((f) => f.kind), ['공고문', '입찰서식'], '갈래 짐작은 사업관리의 guessDocKind 한 곳');
  assert.equal(KB.fromGov(Object.assign({}, h, { src: '기업마당' }), now).kind, '공모·바우처');
  assert.equal(KB.fromGov(Object.assign({}, h, { src: '모집 글' }), now).kind, '수행기관');
  KB.STAGES.indexOf(v.stage) >= 0 || assert.fail('사업관리 단계 목록에 있는 값');
  const rec = { govFiles: [{ name: '제안요청서.hwp', url: 'https://www.g2b.go.kr/f?1', kind: '기타' }] };
  assert.equal(KB.mergeGovFiles(rec, h.files), 1, '새 링크만 더한다');
  assert.equal(rec.govFiles[0].kind, '기타', '사람이 고친 갈래를 덮지 않는다');
});

test('★★★ 경력관리 받는 문 — go=biz 는 채워서 «열기만»(저장은 사람이) · 읽으면 지운다 · govRef 로 찾는다', () => {
  assert.match(kc, /if\(\/\[\?&\]go=biz\(\?:&\|\$\)\/\.test\(location\.search\)\) return kcBizFromGov\(tries\);/);
  const fn = (kc.match(/function kcBizFromGov\(tries\)\{[\s\S]*?\n\}/) || [])[0];
  assert.ok(fn, '받는 함수가 없다');
  assert.doesNotMatch(fn, /_bizPut\(|bizSaveForm\(|set\(BIZ_STORE/, '받는 문이 몰래 저장하면 안 된다');
  assert.match(fn, /localStorage\.removeItem\('pu_kc_biz_handoff'\)/);
  assert.match(fn, /KcareerBiz\.govCheck\(h, Date\.now\(\), me, tok\)/, '계정·일회용 표를 맞춰 본다');
  assert.match(fn, /if\(ck!=='ok'\)\{[\s\S]*?return; \}/, '맞지 않으면 쓰지 않는다');
  assert.ok(fn.indexOf("if(ck==='stale')") < fn.indexOf("if(ck!=='ok')"), '남의 것(other)은 지우지 않고 낡은 것만 지운다');
  assert.match(fn, /r\.govRef && r\.govRef===v\.govRef/, '같은 공고는 govRef 로');
  assert.doesNotMatch(fn, /\.title\s*===/, '사업명으로 찾지 않는다');
  assert.match(fn, /kcApplyLock/, '본인 확인 뒤에만 연다');
  /* 사업 창 — 서식 링크는 그릴 때 다시 거른다 */
  assert.match(kc, /var gf=\(r\.govFiles\|\|\[\]\)\.filter\(function\(f\)\{ return f && KcareerBiz\.govUrl\(f\.url\); \}\)/);
  assert.match(kc, /<script src="js\/kcareer-biz\.js\?v=\d+"><\/script>/);
});
