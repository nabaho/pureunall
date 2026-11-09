'use strict';
/* ✉ 기업에 설립시 준비서류 보내기 (대표 지시 2026-11-09 — 기업에 요청할 서류·관련 사항을 메일로 한번에 · 기업정보는 기업정보함에서)
   · 설립 진행판 팝업 [✉ 기업에 설립시 준비서류] → 참여사업장마다 «받는 사람·제목·본문»을 만들어 푸른메일함 쓰기 창에 채워 연다
   · 서류 목록은 서식 탭의 «기업 준비·첨부서류 목록»(REQ_DOCS)을 그대로 쓴다 — 기금법인 준비분·이미 확인한 서류는 기본으로 뺀다
   · 기업 정보와 받는 사람은 기업정보함(카드·명함·회사 메일)에서 가져온다 — 읽기만 한다
   · 앱은 메일을 «보내지» 않는다 — 쓰기 창에 채워 열 뿐이다. 쓰는 곳은 [✔ 보냈음]의 prep_mail 한 줄과 감사 기록뿐
   ⚠ 이름·주소·번호는 모두 가짜다. 함수를 «떠서 돌려» 본다(글자만 찾는 검사는 기능을 꺼도 초록이다).
   node --test tests/fund-prep-mail.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0, on = false;
  for (let k = i; k < SRC.length; k++) { if (SRC[k] === '{') { d++; on = true; } else if (SRC[k] === '}') { d--; if (on && !d) return SRC.slice(i, k + 1); } }
  throw new Error('끝을 못 찾음 ' + n); };
/* 이 기능 블록 전체(상수 + 함수) — «기능 블록 안에 이것이 없다»를 볼 때 쓴다 */
const BLOCK = (() => { const a = SRC.indexOf('var PM=null;'), b = SRC.indexOf('/* ══ 🖨 서식 자동 채움'); assert.ok(a > 0 && b > a, '기능 블록을 못 찾음(「서식 자동 채움」 블록 바로 앞에 둔다)'); return SRC.slice(a, b); })();
const CONSTS = BLOCK.slice(0, BLOCK.indexOf('function _pmId('));
const REQ_SRC = (() => { const a = SRC.indexOf('var REQ_DOCS={'), b = SRC.indexOf('function reqDocsFor('); assert.ok(a > 0 && b > a, 'REQ_DOCS 를 못 찾음'); return SRC.slice(a, b); })();
const FUNCS = ['_pmId', '_pmDocs', '_pmCands', '_pmInfo', 'pmText', 'pmMailUrl', '_pmRow', '_pmTo', '_pmRowOf', '_pmMail', '_pmCopy', '_pmOpenMail', 'pmOpen',
  '_pmHTML', '_pmWho', 'pmRender', 'pmPreview', 'pmBack', 'pmTick', 'pmTickAll', 'pmCur', 'pmPick', 'pmManual', 'pmDoc', 'pmDocAll', 'pmCopy', 'pmCompose', 'pmNext', 'pmSent', 'pmKey', '_pmSentN', 'pmHelp', '_pmK',
  'reqDocsFor', '_primaryContact', '_siteCardMatch', '_cardFundKey', '_digits'];

/* ── 가짜 세상 위에서 «진짜 함수»를 돌린다 ── */
function world(o) {
  o = o || {};
  const W = { writes: [], audits: [], toasts: [], opened: [], composed: [], order: [], els: {}, modal: null, closed: 0, copied: [] };
  const funds = o.funds || { F1: { fund_type: '공동', setup_stage: '설립준비', name: '검증공동기금', short_name: '검증기금', mgr_main: { name: '담당A' }, setup: {} } };
  const sites = o.sites || [];
  const idx = o.idx || [];
  const coOf = o.coOf || {};
  const reqDocs = o.reqDocs || {};
  const fbDb = { ref: (p) => ({
    once: () => Promise.resolve({ val: () => (/\/req_docs\//.test(p) ? reqDocs : null) }),
    set: (v) => { W.writes.push(['set', p, v]); return o.setFail ? Promise.reject(new Error('쓰기 실패')) : Promise.resolve(); },
    update: (v) => { W.writes.push(['update', p, v]); return Promise.resolve(); },
    push: () => { W.writes.push(['push', p]); return { set: () => Promise.resolve() }; },
    remove: () => { W.writes.push(['remove', p]); return Promise.resolve(); },
  }) };
  const win = o.win === undefined ? { puMailComposeTo: (x) => { W.composed.push(x); return true; }, focus() { W.order.push('focus'); }, location: { href: '' } } : o.win;
  const body = [
    "var NS='fund_erp'; var S={user:'담당A'};",
    "function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;'); }",
    "function hlp(k){ return ''; }",
    "function ymd(){ return '2026-11-09'; }",
    "function toast(m,t){ W.toasts.push([m,t||'']); }",
    "function _audit(fid,what,detail){ W.audits.push([fid,what,detail]); }",
    "function _loadSites(fid){ return Promise.resolve(SITES); }",
    "function loadCardIdx(){ return IDXFAIL?Promise.reject(new Error('권한 없음')):Promise.resolve(IDX); }",
    "function loadCardCo(r){ return Promise.resolve(COOF[(r&&r.c)||'']||{}); }",
    "function $(id){ return W.els[id]||null; }",
    /* 진짜 브라우저처럼 — innerHTML 을 바꾸면 안쪽 칸(기업 표·서류 표)은 «새 칸»이 되어 스크롤이 0 으로 돌아간다 */
    "function showModal(html,opts){ W.modal={html:html,opts:opts||{}}; W.els.modalbox={_h:html,scrollTop:0,attrs:{},setAttribute:function(k,v){ this.attrs[k]=v; },",
    "  get innerHTML(){ return this._h; }, set innerHTML(v){ this._h=v; if(W.els.pmCo) W.els.pmCo={scrollTop:0}; if(W.els.pmDocs) W.els.pmDocs={scrollTop:0}; },",
    "  querySelector:function(q){ return { focus:function(){ W.focused=q; } }; } }; }",
    "var document={ activeElement:null };",
    "var HELP={'setup.prepmail':{t:'도움말',h:'<p>도움말 본문</p>'}};",
    "W.setActive=function(k){ document.activeElement={ getAttribute:function(n){ return n==='data-pmk'?k:null; } }; };",
    "function closeM(){ var m=W.modal; W.modal=null; W.els.modalbox=null; W.closed++; if(m&&m.opts.onclose) m.opts.onclose(); }",
    "function sdPop(){ W.order.push('sdPop'); }",
    "var SD={sel:''};",
    "var window={ open:function(u,n){ W.order.push('open:'+n); W.opened.push([u,n]); return WIN; } };",
    "var navigator={ clipboard:{ writeText:function(t){ W.order.push('copy'); W.copied.push(t); return COPYFAIL?Promise.reject(new Error('x')):Promise.resolve(); } } };",
    REQ_SRC, CONSTS, ...FUNCS.map(fnSrc),
    'return {pmOpen:pmOpen,pmRender:pmRender,_pmHTML:_pmHTML,_pmDocs:_pmDocs,_pmCands:_pmCands,_pmInfo:_pmInfo,pmText:pmText,pmMailUrl:pmMailUrl,_pmRow:_pmRow,_pmMail:_pmMail,_pmOpenMail:_pmOpenMail,',
    'pmKey:pmKey,_pmSentN:_pmSentN,pmHelp:pmHelp,_pmK:_pmK,pmCompose:pmCompose,pmNext:pmNext,pmSent:pmSent,pmTick:pmTick,pmPick:pmPick,pmManual:pmManual,pmDoc:pmDoc,pmDocAll:pmDocAll,pmCur:pmCur,pmBack:pmBack,pmPreview:pmPreview,pmCopy:pmCopy,pmTickAll:pmTickAll,',
    'getPM:function(){ return PM; }, setPM:function(v){ PM=v; }, funds:funds, reqDocsFor:reqDocsFor};',
  ].join('\n');
  const api = new Function('W', 'SITES', 'IDX', 'COOF', 'IDXFAIL', 'WIN', 'COPYFAIL', 'funds', 'fbDb', body)(W, sites, idx, coOf, !!o.idxFail, win, !!o.copyFail, funds, fbDb);
  return Object.assign(W, { api, win, funds });
}

/* 가짜 자료 — 가나산업: 기업정보함 사업자등록증·명함·참여사업장 담당자 모두 있음 / 다라전자: 담당자 없음·명함+회사 메일 / 마바상사: 기업정보함에 없음 */
const SITES = [
  { _id: 's1', name: '가나산업', ceo: '김가나', biz_no: '123-81-20098', contacts: [{ name: '정자차', position: '대리', email: 'jung@ganasan.test' }, { name: '박마바', position: '과장', email: 'park@ganasan.test', isPrimary: true }] },
  { _id: 's2', name: '다라전자', biz_no: '123-81-20099' },
  { _id: 's3', name: '마바상사', ceo: '이사아', address: '충남 검증시 나로 2' },
];
const IDX = [
  { k: 'biz', c: '가나산업(주)', bz: '1238120098', ceo: '김가나', ad: '충남 검증시 가로 1' },
  { k: 'card', c: '가나산업', n: '최사아', ti: '주임', e: 'choi@ganasan.test' },
  { k: 'card', c: '가나산업', n: '정자차', ti: '대리', e: 'JUNG@ganasan.test' },
  { k: 'biz', c: '다라전자', bz: '1238120099', ceo: '정다라', ad: '충남 검증시 다로 3' },
  { k: 'card', c: '다라전자', n: '오차카', ti: '부장', e: 'oh@dara.test' },
  { k: 'card', c: '다라전자', n: '메일없음', e: '이메일 아님' },
];
const COOF = { '다라전자': { e: 'info@dara.test' } };
const flush = () => new Promise((r) => setTimeout(r, 0));
async function opened(o) { const w = world(Object.assign({ sites: SITES, idx: IDX, coOf: COOF }, o || {})); w.api.pmOpen('F1'); await flush(); await flush(); return w; }

test('★ 서류 목록은 새로 짓지 않는다 — 서식 탭의 «기업 준비·첨부서류 목록»(REQ_DOCS) 설립 3단계 그대로', () => {
  const w = world();
  const secs = w.api._pmDocs('공동', null);
  assert.deepEqual(secs.map((s) => s.ph), ['inka', 'reg', 'tax'], '인가·등기·세무 순서');
  secs.forEach((s) => assert.deepEqual(s.docs.map((d) => d.id), w.api.reqDocsFor(s.ph, '공동').map((d) => d.id), s.ph + ' 목록이 REQ_DOCS 와 다르다'));
  const ids = secs.flatMap((s) => s.docs.map((d) => d.id));
  assert.equal(new Set(ids).size, ids.length, '서류 번호가 겹친다');
  assert.ok(ids.length >= 10, '설립 서류가 거의 없다');
});

const COOP = ['inka_fseal', 'reg_fseal', 'reg_minutes', 'reg_taxfee', 'reg_sealcard'];   // 준비처는 «기금법인»이지만 도장·날인·납부에 기업 협조가 필요한 줄
test('★ 기본으로 고르는 것 — 기업이 준비하는 줄 + 도장·날인·납부 «협조» 줄(기금법인 준비분의 나머지·이미 확인한 서류는 뺀다)', () => {
  const w = world();
  const all = w.api._pmDocs('공동', null).flatMap((s) => s.docs);
  all.forEach((d) => {
    assert.equal(d.coop, COOP.includes(d.id), d.id + ' — 협조 줄은 정해진 다섯뿐');
    assert.equal(d.ask, d.who !== '기금법인' || d.coop, d.id);
    assert.equal(d.on, d.ask, d.id + ' — 기업이 준비하는 줄과 협조 줄만 기본으로 고른다');
  });
  COOP.forEach((id) => { const d = all.filter((x) => x.id === id)[0]; assert.ok(d && d.who === '기금법인' && d.on, id + ' — 준비처는 기금법인이어도 기본으로 고른다'); });
  ['reg_inkacert', 'reg_charter'].forEach((id) => assert.ok(!all.filter((x) => x.id === id)[0].on, id + ' — 사업장이 할 일 없는 줄은 뺀다'));
  assert.ok(all.some((d) => d.on) && all.some((d) => !d.on), '고른 것과 안 고른 것이 둘 다 있어야 한다');
  const got = w.api._pmDocs('공동', { inka: { inka_bizreg: true, inka_ei: true }, reg: { reg_jumin: true } }).flatMap((s) => s.docs);
  ['inka_bizreg', 'inka_ei', 'reg_jumin'].forEach((id) => { const d = got.filter((x) => x.id === id)[0]; assert.ok(d.got && !d.on, id + ' — 서식 탭에서 이미 확인한 서류는 기본으로 뺀다'); });
  assert.ok(got.filter((x) => x.id === 'inka_wrep')[0].on, '확인 안 한 서류는 그대로 고른다');
});

test('★ 협조 줄은 메일에서 «도장·날인·납부 등 협조해 주실 사항» 한 단락으로 따로 — 단계별 서류와 섞지 않고, 기업에 «준비: 기금법인»이라 적지 않는다', async () => {
  const w = await opened();
  const P = w.api.getPM();
  const m = w.api._pmMail(P, P.rows[0]);
  const L = m.body.split('\n');
  const idx = (re) => L.findIndex((x) => re.test(x));
  const head = idx(/^■ \d+\. 도장·날인·납부 등 협조해 주실 사항$/);
  assert.ok(head > 0, '협조 단락이 없다');
  assert.ok(head > idx(/^■ 3\. 설립등기를 마친 뒤/), '협조 단락은 단계별 서류 뒤에 온다');
  assert.ok(idx(/^■ 함께 정해 주실 사항/) > head, '함께 정할 사항은 협조 단락 뒤');
  assert.ok(L[head + 1].startsWith('아래 서류는 저희가 작성·신청을 진행하지만'), '협조 단락의 취지 글이 없다');
  const part = L.slice(head, idx(/^■ 함께 정해 주실 사항/)).join('\n');
  assert.match(part, /기금법인 직인\(도장\) 제작 {2}\(시기: 인가 신청 때\)/);
  assert.match(part, /설립준비위원회 의사록\(회의록\) 및 협의회 위원 명부 \(위원 인감날인\) {2}\(시기: 법인 설립등기 때\)/);
  ['기금법인 인감도장', '등록면허세 영수필확인서', '법인인감카드 발급신청'].forEach((t) => assert.ok(part.includes(t), t + ' 이(가) 협조 단락에 없다'));
  const before = L.slice(0, head).join('\n');
  COOP.forEach((id) => { const d = P.secs.flatMap((s) => s.docs).filter((x) => x.id === id)[0]; assert.ok(!before.includes(d.title), d.title + ' 이(가) 단계별 서류 단락에도 들어갔다(중복)'); });
  assert.ok(!/준비: 기금법인/.test(m.body), '기업에 «준비: 기금법인»이라 적었다 — 기업이 준비할 서류로 읽힌다');
  ['설립인가증 원본', '인가받은 정관 사본'].forEach((t) => assert.ok(!m.body.includes(t), t + ' — 사업장이 할 일이 없는 줄이 들어갔다'));
  /* 요청 N종 에 협조 줄도 센다 · 모두 끄면 단락이 사라진다 */
  const n = m.nDoc; COOP.forEach((id) => w.api.pmDoc(id, false));
  const m2 = w.api._pmMail(P, P.rows[0]);
  assert.equal(m2.nDoc, n - COOP.length, '요청 N종이 협조 줄을 세지 않는다'); assert.ok(!/협조해 주실 사항/.test(m2.body), '협조 줄을 모두 껐는데 단락이 남았다');
  COOP.slice(0, 1).forEach((id) => w.api.pmDoc(id, true));
  const m3 = w.api._pmMail(P, P.rows[0]); assert.match(m3.body, /■ \d+\. 도장·날인·납부 등 협조해 주실 사항/); assert.equal(m3.body.split('\n').filter((x) => /^\d+\) /.test(x)).length - m2.body.split('\n').filter((x) => /^\d+\) /.test(x)).length, 1);
});

test('화면 — 협조 줄에는 «협조» 표시(기금법인 준비분이라도 □ 가 켜져 있다) · 안내 문구', async () => {
  const w = await opened();
  const h = w.els.modalbox.innerHTML;
  assert.equal((h.match(/class="chip warn" style="font-size:10px" title="준비처는 기금법인이지만[^"]*">협조<\/span>/g) || []).length, COOP.length, '협조 표시가 다섯 줄에 있어야 한다');
  assert.ok((h.match(/>우리 진행<\/span>/g) || []).length >= 3, '협조가 아닌 기금법인 줄은 «우리 진행»으로 남는다');
  assert.ok(h.includes('<input type="checkbox" data-pmk="d_inka_fseal" checked'), '협조 줄 □ 가 기본으로 켜져 있어야 한다');
  assert.ok(h.includes('(협조)은 넣었습니다'), '목록 위 안내 문구가 협조 줄을 설명한다');
});

test('사내기금은 «참여기업» 말을 «설립기업»으로 · 공동 전용 서류는 없다(reqDocsFor 를 따른다)', () => {
  const w = world();
  const a = w.api._pmDocs('사내', null).flatMap((s) => s.docs), b = w.api._pmDocs('공동', null).flatMap((s) => s.docs);
  assert.ok(!a.some((d) => d.id === 'inka_match') && b.some((d) => d.id === 'inka_match'), '공동 전용 서류가 사내에 섞였다');
  assert.ok(!a.some((d) => /참여기업별/.test(d.who)), '사내기금에 «참여기업별»이 남았다');
});

test('★ 받는 사람 후보 — 참여사업장 대표 담당자가 맨 앞 → 기업정보함 명함 → 회사 메일 · 이메일 꼴 아니면 버리고 같은 주소는 한 번만', () => {
  const w = world();
  const site = SITES[0], cards = IDX.filter((r) => r.k === 'card' && /가나/.test(r.c));
  const c = w.api._pmCands(site, cards, { e: 'info@ganasan.test' });
  assert.deepEqual(c.map((x) => x.email), ['park@ganasan.test', 'jung@ganasan.test', 'choi@ganasan.test', 'info@ganasan.test'], '순서 — 대표 연락처 · 다른 담당 · 명함 · 회사 메일');
  assert.deepEqual(c.map((x) => x.src), ['site', 'site', 'card', 'co']);
  assert.equal(c.filter((x) => /^jung@/i.test(x.email)).length, 1, '같은 주소(대소문자만 다름)를 두 번 올렸다');
  const d = w.api._pmCands(SITES[1], IDX.filter((r) => r.k === 'card' && /다라/.test(r.c)), {});
  assert.deepEqual(d.map((x) => x.email), ['oh@dara.test'], '이메일 꼴이 아닌 값을 후보로 올렸다');
  assert.deepEqual(w.api._pmCands({}, [], null), [], '아무것도 없으면 빈 목록(짐작으로 채우지 않는다)');
});

test('★ 기업 정보 — 기업정보함 값이 먼저 · 없으면 참여사업장 값 · 빈 줄은 뺀다(«미정» 같은 글자로 메우지 않는다)', () => {
  const w = world();
  const a = w.api._pmInfo(SITES[0], IDX[0], {});
  assert.deepEqual(a.map((r) => r[0]), ['상호', '대표자', '사업자등록번호', '소재지']);
  assert.equal(a[0][1], '가나산업(주)', '기업정보함 상호가 먼저');
  assert.equal(a[3][1], '충남 검증시 가로 1');
  assert.equal(a[2][1], '123-81-20098', '사업자등록번호는 000-00-00000 꼴로 적는다');
  assert.equal(w.api._pmInfo({ biz_no: '12-3' }, null, {})[0][1], '12-3', '열 자리가 아니면 그대로 둔다(짐작으로 고치지 않는다)');
  const b = w.api._pmInfo(SITES[2], null, {});
  assert.deepEqual(b, [['상호', '마바상사'], ['대표자', '이사아'], ['소재지', '충남 검증시 나로 2']], '기업정보함에 없으면 참여사업장 값 — 사업자등록번호처럼 없는 줄은 뺀다');
  assert.deepEqual(w.api._pmInfo({}, null, null), []);
});

const SECS = (docs) => [{ label: '지금 준비해 주실 서류', note: '메모', docs }];
test('★ 메일 본문 — 인사·기업 정보·시기별 서류·함께 정할 사항·맺음, 그 기업 이름만(다른 기업·이메일 주소는 없다)', () => {
  const w = world();
  const t = w.api.pmText({ name: '검증공동기금' }, '가나산업', { name: '박마바', pos: '과장', mgr: '담당A', info: [['상호', '가나산업(주)']], secs: SECS([{ title: '서류가', desc: '설명가', who: '참여기업별' }, { title: '서류나', desc: '설명나', who: '' }]) });
  assert.match(t.subject, /^\[푸른노무법인\] 가나산업 검증공동기금 설립 시 준비서류 안내 및 요청$/);
  const L = t.body.split('\n');
  assert.equal(L[0], '박마바 과장님 안녕하세요.'); assert.equal(L[1], '푸른노무법인 담당A입니다.');
  const at = (re) => L.findIndex((x) => re.test(x));
  assert.ok(at(/■ 기업 정보 확인/) > 0 && at(/- 상호: 가나산업\(주\)/) > at(/■ 기업 정보 확인/), '기업 정보 확인 줄');
  assert.ok(at(/■ 1\. 지금 준비해 주실 서류/) > at(/- 상호/), '서류 단락이 기업 정보 다음');
  assert.ok(at(/^1\) 서류가 {2}\(준비: 참여기업별\)/) > 0 && at(/^ {3}- 설명가/) > 0, '서류 줄: 제목(준비처) + 설명');
  assert.ok(at(/^2\) 서류나$/) > 0, '준비처가 없으면 괄호를 안 붙인다');
  assert.ok(at(/■ 함께 정해 주실 사항/) > at(/^2\) 서류나/), '함께 정할 사항이 서류 뒤');
  assert.ok(at(/푸른노무법인 드림/) === L.length - 1, '맺음');
  assert.ok(!/undefined|NaN|\[확인 필요\]|null/.test(t.body), '빈 값 글자가 샌다');
  assert.ok(!/@/.test(t.body), '본문에 이메일 주소가 들어갔다');
});

test('제목 — 사내기금은 기금 이름에 회사 이름이 이미 있으니 또 붙이지 않는다 · 기업 정보 안내는 «기업정보함» 같은 내부 말을 쓰지 않는다', () => {
  const w = world();
  assert.equal(w.api.pmText({ name: '다라전자사내근로복지기금' }, '다라전자(주)', {}).subject, '[푸른노무법인] 다라전자사내근로복지기금 설립 시 준비서류 안내 및 요청');
  assert.equal(w.api.pmText({ name: '검증공동기금' }, '가나산업', {}).subject, '[푸른노무법인] 가나산업 검증공동기금 설립 시 준비서류 안내 및 요청');
  assert.equal(w.api.pmText({ name: '검증공동기금' }, '', {}).subject, '[푸른노무법인] 검증공동기금 설립 시 준비서류 안내 및 요청');
  const t = w.api.pmText({ name: 'X기금' }, '다라전자', { info: [['상호', '다라전자']] });
  assert.ok(/■ 기업 정보 확인/.test(t.body) && !/기업정보함/.test(t.body), '고객에게 보내는 글에 내부 앱 이름이 나간다');
});

test('인사말 — 담당자 이름이 없으면 «기업명 담당자님» · 기업명도 없으면 «안녕하세요.»만 · 서류가 없는 단락은 그리지 않는다', () => {
  const w = world();
  assert.equal(w.api.pmText({ name: 'X기금' }, '다라전자', {}).body.split('\n')[0], '다라전자 담당자님 안녕하세요.');
  assert.equal(w.api.pmText({ name: 'X기금' }, '', { name: '오차카' }).body.split('\n')[0], '오차카님 안녕하세요.');
  assert.equal(w.api.pmText({ name: 'X기금' }, '', {}).body.split('\n')[0], '안녕하세요.');
  assert.equal(w.api.pmText({ name: 'X기금' }, '', {}).body.split('\n')[1], '푸른노무법인입니다.', '담당이 없으면 법인 이름만');
  const t = w.api.pmText({ name: 'X기금', name_temp: true }, '다라전자', { secs: [{ label: '빈', docs: [] }, { label: '채움', docs: [{ title: 'T', desc: 'D', who: '' }] }] });
  assert.ok(/X기금\(가칭\)/.test(t.body), '가칭 기금은 «(가칭)»을 붙인다');
  assert.ok(!/빈/.test(t.body) && /■ 1\. 채움/.test(t.body), '서류가 없는 단락은 건너뛰고 번호도 이어 센다');
});

test('★ 사업장 줄 — 기업정보함 사업자등록증·명함·회사 메일로 받는 사람과 기업 정보를 채운다(없으면 비워 둔다)', () => {
  const w = world();
  const f = w.funds.F1;
  const r1 = w.api._pmRow(SITES[0], IDX, {}, f), r2 = w.api._pmRow(SITES[1], IDX, COOF['다라전자'], f), r3 = w.api._pmRow(SITES[2], IDX, {}, f);
  assert.ok(r1.biz && r2.biz && !r3.biz, '사업자등록증 짝 — 번호가 맞으면 그것으로, 없으면 이름으로');
  assert.equal(r1.nCard, 2); assert.equal(r2.nCard, 2, '이메일이 없는 명함도 «명함 수»에는 센다'); assert.equal(r3.nCard, 0);
  assert.deepEqual(r1.cands.map((c) => c.src), ['site', 'site', 'card'], '가나산업 — 담당자 둘 + 명함(같은 주소는 한 번)');
  assert.deepEqual(r2.cands.map((c) => c.email), ['oh@dara.test', 'info@dara.test'], '다라전자 — 명함 + 회사 메일');
  assert.equal(r3.cands.length, 0); assert.equal(r3.pick, -1, '받는 사람을 못 찾으면 «직접 입력»으로 둔다');
  assert.equal(r1.pick, 0);
  assert.ok(r1.on && r1.sent === null, '아직 안 보냈으면 기본으로 고른다');
  const r4 = w.api._pmRow(SITES[0], IDX, {}, Object.assign({}, f, { prep_mail: { s1: { at: '2026-11-08', by: '담당A' } } }));
  assert.ok(!r4.on && r4.sent && r4.sent.at === '2026-11-08', '이미 보냈음으로 표시한 곳은 기본으로 고르지 않는다');
});

test('★ 기업정보함에 사업자등록증이 이미 있는 회사에는 «사업자등록증 사본»을 달라고 하지 않는다 · 없는 회사에는 요청한다', async () => {
  const w = await opened();
  const P = w.api.getPM();
  assert.equal(P.sel.inka_bizreg, true, '기본 선택에는 들어 있다');
  const m1 = w.api._pmMail(P, P.rows[0]), m3 = w.api._pmMail(P, P.rows[2]);
  assert.ok(!/사업자등록증 사본/.test(m1.body), '기업정보함에 있는 회사에 사업자등록증 사본을 요청했다');
  assert.ok(/사업자등록증 사본/.test(m3.body), '기업정보함에 없는 회사에는 요청해야 한다');
  assert.equal(m3.nDoc - m1.nDoc, 1, '차이는 그 한 장뿐');
  assert.ok(/법인등기부등본/.test(m1.body), '나머지 서류는 그대로');
});

test('★ 창을 열 때는 «읽기만» 한다 — 쓰기가 한 번도 없고, 참여사업장 줄·기금 이름 줄을 기업정보함으로 채운다', async () => {
  const w = await opened();
  assert.deepEqual(w.writes, [], '열기만 했는데 쓴다: ' + JSON.stringify(w.writes));
  const P = w.api.getPM();
  assert.equal(P.rows.length, 3); assert.equal(P.loading, false);
  assert.equal(P.cur, 's1', '미리보기는 고른 첫 기업');
  const H = w.els.modalbox.innerHTML;
  assert.match(H, /기업에 설립시 준비서류/); assert.match(H, /가나산업/); assert.match(H, /park@ganasan\.test/);
  assert.ok(!/undefined|NaN/.test(H), '그린 창에 undefined 가 샌다');
  assert.equal(w.opened.length, 0, '열기만 했는데 메일 창을 열었다');
});

test('참여사업장이 아직 없으면(설립 초기) 기금 이름에서 뗀 회사 하나를 기업정보함 이름으로 찾는다', async () => {
  const w = await opened({ sites: [], funds: { F1: { fund_type: '사내', setup_stage: '설립준비', name: '다라전자 사내근로복지기금' } } });
  const P = w.api.getPM();
  assert.equal(P.rows.length, 1); assert.equal(P.rows[0].name, '다라전자'); assert.equal(P.rows[0].sid, '_fund');
  assert.ok(P.rows[0].biz, '기업정보함에서 이름으로 찾아야 한다');
  assert.deepEqual(P.rows[0].cands.map((c) => c.email), ['oh@dara.test', 'info@dara.test']);
});

test('기업정보함을 못 읽어도 창은 열린다 — 참여사업장에 적힌 값으로 채우고 알린다', async () => {
  const w = await opened({ idxFail: true });
  const P = w.api.getPM();
  assert.equal(P.rows.length, 3); assert.ok(P.cardsErr, '읽지 못한 까닭을 보관해야 한다');
  assert.deepEqual(P.rows[0].cands.map((c) => c.email), ['park@ganasan.test', 'jung@ganasan.test'], '참여사업장 담당자는 그대로');
  assert.ok(!P.rows[0].biz, '못 읽었으면 «기업정보함에 있음»이라 하지 않는다');
  assert.match(w.els.modalbox.innerHTML, /기업정보함을 읽지 못했습니다/);
});

test('★ 쓰기 창 열기 — 떠 있는 창에 «받는이·제목·본문»을 직접 넘긴다(주소에 본문을 싣지 않는다) · 복사는 창을 열기 «전에»', async () => {
  const w = await opened();
  w.api.pmCompose('s1'); await flush(); await flush();
  assert.equal(w.composed.length, 1);
  const x = w.composed[0];
  assert.equal(x.to, 'park@ganasan.test'); assert.match(x.subject, /가나산업/); assert.match(x.body, /법인등기부등본/); assert.equal(x.card, '');
  assert.ok(w.order.indexOf('copy') >= 0 && w.order.indexOf('copy') < w.order.indexOf('open:puMailWrite'), '복사를 창 열기 전에 시작해야 한다');
  assert.equal(w.win.location.href, '', '채우기가 됐으면 주소는 건드리지 않는다');
  assert.deepEqual(w.writes, [], '메일 창을 여는 일은 쓰기가 아니다');
});

test('쓰기 창이 «아직 안 떠 있으면» 받는이·제목만 주소로 싣고 본문은 복사해 둔다 — 주소가 짧다', async () => {
  const w = await opened({ win: { focus() {}, location: { href: '' } } });
  w.api.pmCompose('s1'); await flush(); await flush();
  const href = w.win.location.href;
  assert.match(href, /^pu-cards\.html\?view=mail&to=park%40ganasan\.test&name=/);
  assert.ok(!/body=/.test(href), '본문을 주소에 실었다');
  assert.ok(href.length < 600, '주소가 길다 — 서버 한도에 걸린다: ' + href.length);
  assert.equal(w.copied.length, 1); assert.match(w.copied[0], /■ 2\. 설립인가를 받은 뒤/, '본문 전체를 복사해 두어야 한다');
  assert.ok(w.toasts.some((t) => /붙여 넣/.test(t[0])), '붙여 넣으라고 알려야 한다');
});

test('복사까지 막히면 «복사 단추를 누르라»고 알리고, 팝업이 막히면 열지 않고 알린다 — 둘 다 터지지 않는다', async () => {
  const a = await opened({ win: { focus() {}, location: { href: '' } }, copyFail: true });
  a.api.pmCompose('s1'); await flush(); await flush();
  assert.ok(a.toasts.some((t) => t[1] === 'warn' && /복사/.test(t[0])));
  const b = await opened({ win: null });
  b.api.pmCompose('s1'); await flush();
  assert.ok(b.toasts.some((t) => /막혔/.test(t[0])), '팝업 막힘을 알려야 한다');
});

test('★ 받는 사람 이메일이 올바르지 않거나 요청할 서류가 없으면 «열지 않고» 알린다', async () => {
  const w = await opened();
  w.api.pmCompose('s3'); await flush();                                 // 마바상사 — 기업정보함에 이메일이 없다
  assert.equal(w.opened.length, 0, '이메일이 없는데 쓰기 창을 열었다');
  assert.ok(w.toasts.some((t) => /이메일/.test(t[0]) && t[1] === 'warn'));
  w.api.pmManual('s3', '메일 아님'); w.api.pmCompose('s3'); await flush();
  assert.equal(w.opened.length, 0, '이메일 꼴이 아닌 직접 입력을 받았다');
  w.api.pmManual('s3', 'lee@maba.test'); w.api.pmCompose('s3'); await flush();
  assert.equal(w.opened.length, 1, '올바른 이메일을 직접 적으면 열려야 한다'); assert.equal(w.composed[0].to, 'lee@maba.test');
  const w2 = await opened();
  w2.api.pmDocAll('inka', false); w2.api.pmDocAll('reg', false); w2.api.pmDocAll('tax', false);
  w2.api.pmCompose('s1'); await flush();
  assert.equal(w2.opened.length, 0); assert.ok(w2.toasts.some((t) => /서류/.test(t[0])), '서류를 하나도 안 골랐는데 열었다');
});

test('★ [✔ 보냈음] — 쓰는 곳은 funds/{기금}/prep_mail/{사업장} 한 줄(날짜·누른 사람)과 감사 기록뿐 · 받는 주소는 어디에도 남기지 않는다', async () => {
  const w = await opened();
  w.api.pmSent('s1', true); await flush(); await flush();
  assert.equal(w.writes.length, 1); assert.deepEqual(w.writes[0], ['set', 'fund_erp/funds/F1/prep_mail/s1', { at: '2026-11-09', by: '담당A' }]);
  assert.equal(w.audits.length, 1); assert.equal(w.audits[0][0], 'F1'); assert.match(w.audits[0][1], /준비서류/);
  assert.ok(!/@/.test(JSON.stringify([w.writes, w.audits])), '받는 주소가 기록에 들어갔다');
  assert.equal(w.funds.F1.prep_mail.s1.at, '2026-11-09', '메모리의 기금 값도 맞춘다');
  assert.ok(!w.api.getPM().rows[0].on, '보냈음으로 표시하면 다음 차례에서 빠진다');
  assert.match(w.els.modalbox.innerHTML, /↩ 취소/, '취소 단추로 바뀐다');
  w.api.pmSent('s1', false); await flush(); await flush();
  assert.deepEqual(w.writes[1], ['set', 'fund_erp/funds/F1/prep_mail/s1', null]); assert.equal(w.funds.F1.prep_mail.s1, undefined);
});

test('저장이 실패하면 «보냈음»으로 바꾸지 않고 알린다', async () => {
  const w = await opened({ setFail: true });
  w.api.pmSent('s1', true); await flush(); await flush();
  assert.ok(w.toasts.some((t) => /저장 실패/.test(t[0]) && t[1] === 'err'));
  assert.equal(w.api.getPM().rows[0].sent, null); assert.equal(w.audits.length, 0, '실패했는데 감사 기록을 남겼다');
});

test('★ [▶ 다음 기업] — 고른 기업 가운데 아직 보냄 표시가 없는 «다음» 곳을 연다 · 다 보냈으면 열지 않는다', async () => {
  const w = await opened();
  w.api.pmManual('s3', 'lee@maba.test');
  w.api.pmTick('s2', false);                                            // 다라전자는 이번에 안 보낸다
  w.api.pmNext(); await flush();
  assert.equal(w.composed.at(-1).to, 'park@ganasan.test', '첫 차례는 가나산업');
  w.api.pmNext(); await flush();
  assert.equal(w.composed.at(-1).to, 'lee@maba.test', '다음은 짚지 않은 다라전자를 건너뛴 마바상사');
  w.api.pmSent('s1', true); w.api.pmSent('s3', true); await flush(); await flush();
  w.api.pmTick('s1', true); w.api.pmTick('s3', true);                  // 보냄 표시한 곳을 다시 짚어도 «보낸 곳»은 건너뛴다
  const n = w.opened.length; w.api.pmNext(); await flush();
  assert.equal(w.opened.length, n, '다 보냈는데 또 열었다');
  assert.ok(w.toasts.some((t) => /모두 보냄/.test(t[0])));
});

test('★ [▶ 다음 기업] 첫 누름은 «지금 미리 보는 기업»을 건너뛰지 않는다 — 앞 기업이 이미 보냄 표시면 그 다음 첫 곳부터, 다 열었으면 열지 않고 알린다', async () => {
  const w = await opened({ funds: { F1: { fund_type: '공동', setup_stage: '설립준비', name: '검증공동기금', prep_mail: { s1: { at: '2026-11-08', by: '담당A' } } } } });
  const P = w.api.getPM();
  assert.equal(P.cur, 's2', '미리보기는 보냄 표시 안 한 첫 기업');
  w.api.pmManual('s3', 'lee@maba.test');
  w.api.pmNext(); await flush();
  assert.equal(w.composed.at(-1).to, 'oh@dara.test', '첫 누름이 미리 보던 다라전자를 건너뛰었다');
  w.api.pmNext(); await flush();
  assert.equal(w.composed.at(-1).to, 'lee@maba.test', '둘째 누름은 다음 기업');
  const n = w.opened.length; w.api.pmNext(); await flush();
  assert.equal(w.opened.length, n, '다 열었는데 또 열었다');
  assert.ok(w.toasts.some((t) => /모두 열었습니다/.test(t[0])), '다 열었다고 알려야 한다');
  w.api.pmCompose('s2'); await flush();
  assert.equal(w.composed.at(-1).to, 'oh@dara.test', '기업 줄의 [✉ 쓰기]로는 다시 열 수 있다');
});

test('서류 □ 는 미리보기만 다시 그린다(창 전체를 다시 그리지 않는다) · 고른 서류가 본문에 바로 반영된다', async () => {
  const w = await opened();
  w.els.pmSubj = { value: '' }; w.els.pmBody = { value: '' }; w.els.pmWho = { innerHTML: '' };
  const before = w.els.modalbox.innerHTML;
  w.api.pmDoc('inka_ei', false);
  assert.equal(w.els.modalbox.innerHTML, before, '서류 □ 로 창 전체를 다시 그렸다 — 목록 스크롤이 튄다');
  assert.ok(!/고용보험 가입자명부/.test(w.els.pmBody.value), '뺀 서류가 본문에 남았다');
  w.api.pmDoc('inka_ei', true);
  assert.ok(/고용보험 가입자명부/.test(w.els.pmBody.value));
  assert.match(w.els.pmWho.innerHTML, /가나산업/);
});

test('★ 서류 □ 를 누르면 «요청 N종»·단계 머리의 n/m종·단계 □ 도 같이 바뀐다 — 창을 다시 그리지 않고 그 자리만 고친다(외부 검토 지적)', async () => {
  const w = await opened();
  ['r0', 'r1', 'r2'].forEach((s) => { w.els['pmN_' + s] = { innerHTML: '' }; w.els['pmR_' + s] = { style: {} }; });
  ['inka', 'reg', 'tax'].forEach((p) => { w.els['pmS_' + p] = { textContent: '' }; w.els['pmSck_' + p] = { checked: false }; });
  w.els.pmSubj = { value: '' }; w.els.pmBody = { value: '' }; w.els.pmWho = { innerHTML: '' };
  const P = w.api.getPM(), before = w.els.modalbox.innerHTML;
  const nOn = (ph) => P.secs.filter((s) => s.ph === ph)[0].docs.filter((d) => P.sel[d.id]).length, tot = (ph) => P.secs.filter((s) => s.ph === ph)[0].docs.length;
  w.api.pmDoc('inka_wrep', false);
  assert.equal(w.els.modalbox.innerHTML, before, '창 전체를 다시 그렸다');
  assert.equal(w.els.pmS_inka.textContent, nOn('inka') + '/' + tot('inka') + '종', '단계 머리의 n/m종이 안 바뀐다');
  assert.equal(w.els.pmSck_inka.checked, false);
  const m1 = w.api._pmMail(P, P.rows[0]).nDoc;
  assert.equal(w.els.pmN_r0.innerHTML, '<span class="muted">' + m1 + '종</span>', '기업 표의 «요청 N종»이 안 바뀐다');
  w.api.pmDoc('inka_wrep', true);
  assert.equal(w.els.pmN_r0.innerHTML, '<span class="muted">' + (m1 + 1) + '종</span>');
  assert.equal(w.els.pmR_r0.style.background, 'var(--acc-soft)', '지금 미리 보는 줄 표시');
  assert.equal(w.els.pmR_r1.style.background, '');
  P.secs.filter((s) => s.ph === 'tax')[0].docs.forEach((d) => { P.sel[d.id] = true; });
  w.api.pmDoc('tax_lease', true);
  assert.equal(w.els.pmSck_tax.checked, true, '단계 서류를 모두 골랐으면 단계 □ 가 켜진다');
});

test('★ 직접 입력한 이메일은 «창을 다시 그리지 않는다» — 바로 이어 누른 단추가 사라지지 않게(외부 검토 지적) · 미리보기에는 바로 반영', async () => {
  const w = await opened();
  w.els.pmSubj = { value: '' }; w.els.pmBody = { value: '' }; w.els.pmWho = { innerHTML: '' };
  const before = w.els.modalbox.innerHTML;
  ['r0', 'r1', 'r2'].forEach((s) => { w.els['pmR_' + s] = { style: {}, attrs: s === 'r0' ? { 'aria-current': 'true' } : {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } }; });
  w.api.pmManual('s3', 'lee@maba.test');
  assert.equal(w.els.pmR_r2.attrs['aria-current'], 'true', '지금 미리 보는 줄로 바뀌면 aria-current 도 옮겨 가야 한다');
  assert.equal(w.els.pmR_r0.attrs['aria-current'], undefined, '이전 줄의 aria-current 가 남았다');
  assert.equal(w.els.modalbox.innerHTML, before, '직접 입력 때문에 창을 다시 그렸다 — 바로 이어 누른 [✉ 쓰기]가 사라진다');
  assert.match(w.els.pmWho.innerHTML, /lee@maba\.test/, '미리보기에 바로 보여야 한다');
  w.api.pmCompose('s3'); await flush();
  assert.equal(w.composed.at(-1).to, 'lee@maba.test');
});

test('[✔ 보냈음]을 저장이 끝나기 전에 두 번 눌러도 한 번만 쓴다 · 실패하면 다시 누를 수 있다(외부 검토 지적)', async () => {
  const w = await opened();
  w.api.pmSent('s1', true); w.api.pmSent('s1', true); await flush(); await flush();
  assert.equal(w.writes.length, 1, '두 번 썼다'); assert.equal(w.audits.length, 1, '감사 기록이 겹친다');
  const f = await opened({ setFail: true });
  f.api.pmSent('s1', true); await flush(); await flush();
  f.api.pmSent('s1', true); await flush(); await flush();
  assert.equal(f.writes.length, 2, '실패한 뒤에는 다시 시도할 수 있어야 한다');
});

test('진행판 칩의 «보냈음 N곳» — 참여사업장이 없을 때 임시로 쓴 줄(_fund)은 실제 사업장이 생기면 세지 않는다(외부 검토 지적)', () => {
  const w = world();
  const f = { prep_mail: { _fund: { at: '2026-11-09' }, s1: { at: '2026-11-09' } } };
  assert.equal(w.api._pmSentN(f, [{ _id: 's1' }, { _id: 's2' }]), 1, '임시 줄까지 세어 실제보다 1곳 많다');
  assert.equal(w.api._pmSentN(f, []), 2, '사업장이 없을 때는 임시 줄도 «보낸 곳»이다');
  assert.equal(w.api._pmSentN({}, null), 0); assert.equal(w.api._pmSentN(null, null), 0);
});

test('접근성 — 기업 이름 칸은 키보드로 눌린다(Enter·Space) · 입력칸마다 이름표 · 창에 role=dialog(외부 검토 지적)', async () => {
  const w = await opened();
  const h = w.els.modalbox.innerHTML;
  assert.match(h, /<td tabindex="0" role="button"[^>]*onkeydown="pmKey\(event,/, '기업 이름 칸을 키보드로 못 누른다');
  const bare = [...h.matchAll(/<(input|select|textarea)\b[^>]*>/g)].map((m) => m[0]).filter((t) => !/aria-label=/.test(t));
  assert.deepEqual(bare, [], '이름표(aria-label) 없는 입력칸: ' + bare.join(' | ').slice(0, 200));
  assert.equal(w.els.modalbox.attrs.role, 'dialog'); assert.equal(w.els.modalbox.attrs['aria-modal'], 'true');
  w.els.pmSubj = { value: '' }; w.els.pmBody = { value: '' }; w.els.pmWho = { innerHTML: '' };
  let pr = 0; w.api.pmKey({ key: 'Tab', preventDefault() { pr++; } }, 's2'); assert.equal(w.api.getPM().cur, 's1', 'Tab 으로 바뀌면 안 된다'); assert.equal(pr, 0);
  w.api.pmKey({ key: 'Enter', preventDefault() { pr++; } }, 's2'); assert.equal(w.api.getPM().cur, 's2'); assert.equal(pr, 1);
  w.api.pmKey({ key: ' ', preventDefault() { pr++; } }, 's3'); assert.equal(w.api.getPM().cur, 's3');
});

test('★ 다시 그려도 기업 표 스크롤 · 서류 표 스크롤 · 키보드 포커스가 그대로다(외부 검토 2차 지적)', async () => {
  const w = await opened();
  w.els.pmCo = { scrollTop: 140 }; w.els.pmDocs = { scrollTop: 75 };
  w.setActive('rt_r1');
  w.api.pmTick('s2', false);                                            // 다시 그리기
  assert.equal(w.els.pmCo.scrollTop, 140, '기업이 많을 때 다시 그리면 목록이 맨 위로 튄다');
  assert.equal(w.els.pmDocs.scrollTop, 75, '서류 목록 스크롤이 튄다');
  assert.equal(w.focused, '[data-pmk="rt_r1"]', '키보드로 누르던 □ 의 포커스를 잃었다');
  const h = w.els.modalbox.innerHTML;
  ['rt_', 'rn_', 'rs_', 'rw_', 'rd_'].forEach((p) => assert.ok(h.includes('data-pmk="' + p + 'r0"'), p + ' 포커스 표식이 없다'));
  ['sc_inka', 'ha', 'nx', 'd_inka_wrep'].forEach((k) => assert.ok(h.includes('data-pmk="' + k + '"'), k + ' 포커스 표식이 없다'));
  assert.equal((h.match(/aria-current="true"/g) || []).length, 1, '지금 미리 보는 기업 줄은 하나만 aria-current');
});

test('받는 기업이 0곳이면 [▶ 다음 기업]이 «모두 보냈다»고 거짓말하지 않는다 · 한글 등이 섞인 사업장 키도 동작한다(외부 검토 2차 지적)', async () => {
  const w = await opened({ sites: [] , funds: { F1: { fund_type: '공동', setup_stage: '설립준비', name: '' } } });
  assert.equal(w.api.getPM().rows.length, 0);
  w.api.pmNext(); assert.ok(w.toasts.some((t) => /받는 기업이 없습니다/.test(t[0])), '0곳인데 엉뚱한 안내가 뜬다'); assert.ok(!w.toasts.some((t) => /모두 보냄/.test(t[0])));
  const k = await opened({ sites: [{ _id: 'ab한cd', name: '특수키상사', contacts: [{ name: '담당', email: 'sp@key.test', isPrimary: true }] },
    { _id: 'abcd', name: '평범상사', contacts: [{ name: '담당', email: 'plain@key.test', isPrimary: true }] }] });
  const KP = k.api.getPM();
  assert.deepEqual(KP.rows.map((r) => r.key), ['r0', 'r1'], '줄마다 화면 번호가 따로 있어야 한다');
  const KH = k.els.modalbox.innerHTML;
  assert.ok(KH.includes("pmCompose('r1')") && !KH.includes("pmCompose('abcd')"), '화면이 사업장 키를 걸러 쓴다 — 서로 다른 키가 같아져 엉뚱한 기업에 적용된다');
  k.api.pmCompose('r0'); await flush();
  assert.equal(k.composed.at(-1).to, 'sp@key.test', '한글이 섞인 키(ab한cd)의 기업이 열려야 한다');
  k.api.pmCompose('r1'); await flush();
  assert.equal(k.composed.at(-1).to, 'plain@key.test', '걸러지면 같아지는 다른 키(abcd)의 기업이 첫째 기업으로 잡힌다');
  k.api.pmSent('r1', true); await flush(); await flush();
  assert.equal(k.writes.at(-1)[1], 'fund_erp/funds/F1/prep_mail/abcd', '저장은 «진짜 사업장 키»로 해야 한다');
  k.api.pmSent('r0', true); await flush(); await flush();
  assert.equal(k.writes.at(-1)[1], 'fund_erp/funds/F1/prep_mail/ab한cd');
  k.api.pmCur('r0'); assert.equal(k.api.getPM().cur, 'ab한cd', '미리 보는 줄은 진짜 사업장 키로 둔다(걸러진 번호면 줄 강조·aria-current 가 사라진다)');
  assert.ok(k.els.modalbox.innerHTML.includes('id="pmR_r0" style="background:var(--acc-soft)" aria-current="true"'), '한글이 섞인 키의 줄 강조가 사라졌다');
  k.api.pmPick('r1', '-1'); assert.equal(k.api.getPM().cur, 'abcd');
  assert.ok(k.els.modalbox.innerHTML.includes('id="pmR_r1" style="background:var(--acc-soft)" aria-current="true"'));
  /* 기업 0곳 — 복사 단추도 말을 한다 */
  w.api.pmCopy(); assert.ok(w.toasts.some((t) => /복사할 메일이 없습니다/.test(t[0])), '0곳인데 복사 단추가 조용하다');
});

test('ⓘ 도움말은 이 창 안에서 펼쳐진다 — 모달을 겹쳐 띄우지 않으니 닫을 때 준비서류 창이 먼저 닫히지 않는다(외부 검토 3차 지적)', async () => {
  const w = await opened();
  assert.ok(w.els.modalbox.innerHTML.includes('id="pmHelp" class="helpbody" style="display:none'), '도움말이 처음부터 펼쳐져 있다');
  assert.match(w.els.modalbox.innerHTML, /도움말 본문/, '도움말 내용이 창 안에 없다');
  w.els.pmHelp = { style: {} }; w.els.pmHelpBtn = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const closed = w.closed, shown = w.modal;
  w.api.pmHelp();
  assert.equal(w.els.pmHelp.style.display, 'block'); assert.equal(w.els.pmHelpBtn.attrs['aria-expanded'], 'true');
  assert.equal(w.closed, closed, '도움말을 펼치려 창을 닫았다'); assert.equal(w.modal, shown, '도움말이 새 창을 띄웠다');
  w.api.pmTick('s2', false);                                            // 다시 그려도 펼침 상태가 유지된다
  assert.ok(w.els.modalbox.innerHTML.includes('id="pmHelp" class="helpbody" style="display:block'));
  w.api.pmHelp(); assert.equal(w.els.pmHelp.style.display, 'none'); assert.equal(w.els.pmHelpBtn.attrs['aria-expanded'], 'false');
});

test('직접 입력 칸을 보이면 고르기 상자를 줄여 «받는 사람» 칸이 평소 폭을 넘지 않는다(1040px 창 가로 스크롤 방지) · 타이핑 중에도 미리보기가 따라온다', async () => {
  const w = await opened({ sites: [{ _id: 's9', name: '메일없음상사' }] });
  const h = w.els.modalbox.innerHTML;
  const sel = +(/<select[^>]*style="width:(\d+)px"/.exec(h) || [])[1], inp = +(/<input type="text"[^>]*style="width:(\d+)px/.exec(h) || [])[1];
  assert.ok(sel && inp, '직접 입력 칸이 안 보인다');
  assert.ok(sel + inp + 4 <= 236 + 8, '직접 입력일 때 받는 사람 칸이 평소(236px)보다 넓다: ' + (sel + inp));
  assert.match(h, /<input type="text"[^>]*oninput="pmManual\(/, '타이핑 중 미리보기가 안 따라온다');
  const w2 = await opened();
  assert.match(w2.els.modalbox.innerHTML, /<select[^>]*style="width:236px"/, '이메일이 있으면 평소 폭');
});

test('줄을 고르는 □ 는 _ckRow(초록 칠)를 쓰지 않는다 — 다시 그리면 사라져 «켰다 껐다»만 들쭉날쭉해진다(외부 검토 지적)', () => {
  assert.ok(!/_ckRow/.test(BLOCK.replace(/\/\*[\s\S]*?\*\//g, '')), '_ckRow 를 쓴다');
});

test('폰 CSS — 단계 줄 배경은 줄(tr)에 · 빈 줄 여백 · 터치 크기 · 기업 표 세로 한도(외부 검토 지적)', () => {
  assert.match(SRC, /\.pmdoc tr\.pmsec\{background:#e2e8f0\}/, '단계 줄 배경이 폰에서 끊긴다');
  assert.match(SRC, /\.pmco td\.pmempty\{padding:14px!important\}/);
  assert.match(SRC, /\.pmco button\{padding:7px 12px!important/, '폰에서 단추가 작다');
  assert.match(SRC, /class="pmco" id="pmCo" style="overflow:auto;max-height:\d+px/, '참여사업장이 많을 때 기업 표 높이 한도가 없다(스크롤 복원 자리 pmCo 도 필요)');
});

test('★ 화면 — ☐ 고르기 칸 + 번호가 맨 왼쪽 · 한 칸은 한 줄(nowrap·말줄임+title) · 이름·주소는 걸러 넣는다', async () => {
  const w = await opened({ sites: [{ _id: 'sx', name: '<img src=x onerror=alert(1)>상사', contacts: [{ name: '<b>김</b>', email: 'kim@x.test' }] }, SITES[0]] });
  const h = w.els.modalbox.innerHTML;
  assert.ok(!/<img src=x/.test(h) && /&lt;img src=x/.test(h), '기업 이름을 거르지 않고 넣었다(스크립트가 돈다)');
  assert.ok(!/<b>김<\/b>/.test(h), '담당자 이름을 거르지 않았다');
  const trs = h.split('<tr').slice(1).filter((t) => /<td class="no">/.test(t));
  assert.ok(trs.length >= 10, '표 줄이 없다');
  trs.forEach((t) => { assert.match(t, /^[^>]*>\s*<td class="ckcol"><input type="checkbox"/, '맨 왼쪽은 ☐ 칸이어야 한다'); assert.match(t, /<td class="no">\d+<\/td>/, '다음은 번호'); });
  assert.ok(/text-overflow:ellipsis;white-space:nowrap" title="/.test(h), '긴 칸은 …+title 로 한 줄');
  assert.ok(!/<br\s*\/?>/i.test(h), '칸 안에서 줄을 내린다');
  assert.match(h, /pmNext\(\)/); assert.match(h, /pmCopy\(\)/); assert.match(h, /pmBack\(\)/);
});

test('← 진행판은 진행판 팝업으로 되돌린다 · 닫으면 상태를 비운다', async () => {
  const w = await opened();
  w.api.pmBack();
  assert.ok(w.order.includes('sdPop'), '진행판으로 돌아가지 않는다'); assert.equal(w.api.getPM(), null, '창을 닫았는데 상태가 남았다');
});

test('★ 이 기능은 메일을 «보내지» 않는다 — 보내는 길(sendMail·putMailFile·sendMaterialMail·fetch)이 블록에 없다(결산 후 진행 flowMail 과 같은 약속)', () => {
  const code = BLOCK.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
  assert.ok(!/sendMail|putMailFile|sendMaterialMail|httpsCallable|fetch\(|XMLHttpRequest|mailto:/.test(code), '직접 보내는 길이 있다');
  assert.ok(!/firebase\.functions|functions\(\)/.test(code));
});

test('★ 쓰는 곳은 pmSent 의 prep_mail 한 줄과 감사 기록뿐 — 기업정보함(pucards)·다른 기금 자료에는 쓰지 않는다', () => {
  const code = BLOCK.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
  const WRITE = /fbDb\.ref\([^)]*\)\s*\.(set|update|push|remove)\(/g;   // 배열 .push( 는 쓰기가 아니다 — Firebase 참조에 붙은 것만 센다
  const writers = [...code.matchAll(WRITE)];
  const onlyIn = fnSrc('pmSent');
  assert.equal(writers.length, (onlyIn.match(WRITE) || []).length, 'pmSent 밖에서 Firebase 에 쓴다');
  assert.equal(writers.length, 1, '쓰는 곳이 하나여야 한다');
  assert.match(onlyIn, /NS\+'\/funds\/'\+fid\+'\/prep_mail\/'\+sid/);
  assert.ok(!/pucards/.test(code.replace(/\/\*[\s\S]*?\*\//g, '')) || !/ref\('pucards/.test(code), '기업정보함 자리에 쓴다');
  assert.ok(!/\.ref\([^)]*pucards[^)]*\)\s*\.(set|update|push|remove)/.test(code));
});

test('★ 배선 — 진행판 팝업 머리에 [✉ 기업에 설립시 준비서류] · 도움말 · 보낸 곳 칩 · 서류 단계는 REQ_DOCS 에 실제로 있다', () => {
  const board = fnSrc('_sdBoard');
  /* 기금 번호는 «속성»으로 넘긴다 — 따옴표가 든 번호를 스크립트 글자에 이어 붙이면 누를 때 그 글자가 돈다(외부 보안 검토 지적) */
  assert.match(board, /<button data-fid="'\+esc\(fid\)\+'" onclick="pmOpen\(this\.dataset\.fid\)"[^>]*>✉ 기업에 설립시 준비서류<\/button>/, '진행판 머리에 단추가 없거나 기금 번호를 스크립트에 이어 붙인다');
  assert.ok(!/pmOpen\(\\''/.test(board), '기금 번호를 스크립트 글자에 이어 붙인 단추가 남아 있다');
  assert.match(board, /_pmSentN\(f,SD\.sites\[fid\]\)/, '보낸 곳 칩이 없다');
  assert.ok(SRC.indexOf("'setup.prepmail':{") >= 0 && /onclick="pmHelp\(\)"/.test(BLOCK) && /HELP\[PM_UI\.help\]\.h/.test(BLOCK) && /var PM_UI=\{help:'setup\.prepmail'\}/.test(BLOCK), 'ⓘ 도움말이 없다');
  assert.ok(!/hlp\('setup\.prepmail'\)/.test(BLOCK), 'ⓘ 가 모달을 겹쳐 띄운다 — 닫을 때 «뒤» 준비서류 창이 먼저 닫힌다');
  const m = REQ_SRC; ['inka', 'reg', 'tax'].forEach((k) => assert.ok(new RegExp('\\b' + k + ':\\[').test(m), k + ' 단계가 REQ_DOCS 에 없다'));
  assert.match(fnSrc('sdPop'), /Object\.assign\(\{\},f,\{_id:SD\.sel\}\)/, 'sdPop 이 기금 번호를 실어 주지 않는다(prep_mail 단추가 undefined 로 나간다)');
});
