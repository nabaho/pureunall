/* 푸른 메일 — 🏢 많이 오는 회사 (대표 승인 목업 2026-10-04 「추천대로」)

   ★ 무엇이었나 — 「담당 모름」 가운데 처음 보는 회사 메일 1,144통이 110개 도메인에서 왔고
     10곳이 823통이었다. 주소별 목록에서는 한 회사가 여러 줄로 흩어져 안 보였다.
   ★ 이제 「자문사 이메일 잇기」 맨 위에 회사(@도메인)별로 묶어 많이 온 순으로 보인다.
     한 번 고르면 회사 전체가 이어진다 — 잇는 길은 있던 것(mbCoSet / mbNotCoSet byDomain).

   지키는 것.
   ① 개인 메일(네이버 등)은 묶지 않는다 — 하나를 이으면 온 세상이 한 회사가 된다
   ② 공공기관·자동발송은 잇기 목록에 안 나온다 — 저절로 「그 밖」이다
   ③ 회사째 이으면 «그 회사 메일 전부»가 담당자에게 간다
   ④ 회사째 치우면 되돌릴 길이 그 줄에 남는다
   ⑤ 한 줄은 한 줄이다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

function cut(from, to){
  const i = src.indexOf(from);
  assert.ok(i > 0, from + ' 를 찾지 못했습니다');
  const j = src.indexOf(to, i + from.length);
  assert.ok(j > i, to + ' 를 찾지 못했습니다');
  return src.slice(i, j);
}

/* ── 밑그림 (가짜 이름) ──
   가람사      a@hy.kr               자문사 · 담당 하윤서          → 담당자 칸
   가나상사    hong@ / kim@gana-sangsa.kr  5통 · 처음 보는 회사       → 🏢 묶음
   다라        lee@dara.kr           1통                           → 묶음 아님(2통 미만)
   개인 메일   hong123@naver.com     4통                           → 묶음 아님(개인 메일)
   노동청      labor@moel.go.kr      2통                           → 「그 밖」(잇기 목록에도 없음)
   자동발송    no-reply@bada.kr      2통                           → 「그 밖」 */
const DIR = [
  { sid:'P-001', name:'권형하', sortOrder:10, role:'admin',  title:'대표노무사', status:'active' },
  { sid:'P-002', name:'하윤서', sortOrder:20, role:'member', title:'노무사',     status:'active' },
];
const COS = [
  { id:'c1', name:'가람사', bizNo:'1', typeCode:'자문', status:'active',
    managerMain:'P-002', email:'a@hy.kr', contacts:[] },
];
const FOLDERS = { B1:{ path:'1.칸', name:'1.칸', kind:'custom', order:1, total:20, unseen:5 } };
const M = (u,e,r)=>({ u:u, f:'보낸이'+u, e:e, t:'x@daum.net', s:'제목'+u,
                      d:1756000000+u, r:r===undefined?0:r, g:0, a:0, z:1, p:'' });
const BASE = {
  '1':M(1,'a@hy.kr'),
  '2':M(2,'hong@gana-sangsa.kr'), '3':M(3,'hong@gana-sangsa.kr'), '4':M(4,'hong@gana-sangsa.kr'),
  '5':M(5,'kim@gana-sangsa.kr'), '6':M(6,'kim@gana-sangsa.kr'),
  '7':M(7,'lee@dara.kr'),
  '8':M(8,'hong123@naver.com'), '9':M(9,'hong123@naver.com'),
  '10':M(10,'hong123@naver.com'), '11':M(11,'hong123@naver.com'),
  '12':M(12,'labor@moel.go.kr'), '13':M(13,'labor@moel.go.kr'),
  '14':M(14,'no-reply@bada.kr'), '15':M(15,'no-reply@bada.kr'),
};

function load(over){
  const o = over || {};
  const state = Object.assign({
    view:'mail', mailSent:'who', whoTab:'addr', mbBox:'', tab:'card', group:'all', owner:'all',
    isAdmin:true, groups:{}, pick:{}, matPick:'', sentBox:{}, schedBox:{},
    mbQ:'', mbFilter:'', mbTab:'', mbCursor:-1, mbOpen:null, mbDash:'who',
    items:{}, mbMineOpen:true
  }, o.state || {});
  const el = () => ({ set innerHTML(v){}, get innerHTML(){ return ''; }, style:{},
    offsetHeight:100, value:'', focus(){}, select(){}, contains:()=>false, scrollTop:0,
    classList:{ toggle(){}, add(){}, remove(){}, contains:()=>false } });
  const dbRef = () => ({ once:()=>new Promise(()=>{}), set:()=>Promise.resolve(),
    remove:()=>Promise.resolve(), update:()=>Promise.resolve(),
    orderByKey(){ return this; }, limitToLast(){ return this; } });
  const ctx = {
    console, Object, Array, String, Number, Math, JSON, RegExp, Set, Map, Date, Promise,
    setTimeout:()=>0, clearTimeout(){}, atob:()=>'', state,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g,
      c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    Store:{ mode:'firebase' }, DB_ROOT:'pucards',
    matMailCfg:()=>({ from:'x@daum.net' }),
    matList:()=>[], matCat:()=>'', MAT_CATS_NOW:()=>[], _matMeta:{}, _matLoaded:true,
    loadMaterials(){}, schedList:()=>[],
    staffName: e => (String(e||'')==='p001@pureun.kr' ? '권형하' : String(e||'')),
    fmtDate:()=>'2026.10.04', fmtMB:n=>n+'B',
    allItems:()=>({}), allGroups:()=>({}),
    isPrivGroup:()=>false, canSeeGroup:()=>true,
    coList:()=>[], coTagList:()=>[], coFTabList:()=>[],
    coFTabCounts:()=>({all:0,byTab:{}}), _coFolders:{}, _coTagHidden:{},
    toast(){}, confirm:()=>true, closeFolderMenu(){},
    toggleSidebar(){}, openSettingsPage(){}, openMatPage(){}, openMailPage(){},
    openSentBox(){}, openSchedBox(){}, openInbox(){}, closeMailPage(){},
    openPrivateVault(){}, migrateLockedFolders(){},
    inboxBoxHtml:()=>'', schedBoxHtml:()=>'', sentBoxHtml:()=>'',
    mailWriteHtml:()=>'', wireMailWrite(){}, redrawCompose(){},
    pickOf:k=>(state.pick[k]=state.pick[k]||{}),
    pickOn:()=>false, pickList:()=>[], pickAllOn:()=>false,
    pickClear(){}, pickHit(){}, pickToggleAll(){}, pickRedraw(){},
    render(){}, renderMailPage(){}, renderPCSide(){},
    document:{ getElementById:el, addEventListener(){}, removeEventListener(){},
      body:{ classList:{ contains:()=>true } } },
    $: el,
    firebase:{ auth:()=>({ currentUser:{ uid:'U1', email:'p001@pureun.kr' } }),
      database:()=>({ ref: dbRef }) },
    fetch:()=>new Promise(()=>{})
  };
  vm.createContext(ctx);
  vm.runInContext(cut('const ErpMatch = {', '\nfunction autoFolderFlush('), ctx);
  vm.runInContext(cut('function pcItem(attrs', '\nfunction switchTab('), ctx);
  vm.runInContext(
    '_mbFolders = ' + JSON.stringify(FOLDERS) + ';' +
    '_mbMsgs = ' + JSON.stringify({ B1: o.msgs || BASE }) + ';' +
    '_mbBins = {}; _mbPut = {}; _mbHide = {}; _mbSucc = {};' +
    '_mbCo = ' + JSON.stringify(o.co || {}) + ';' +
    '_mbOwner = {};' +
    '_mbNotCo = ' + JSON.stringify(o.notco || {}) + ';' +
    '_mbWhoMsg = {}; _mbOrder = {}; _mbWhoOrder = {}; _mbCkSkip = {};' +
    '_mbBinRule = {}; _mbNewSkip = {}; _mbMeta = { at:1, ok:true };', ctx);
  const EM = vm.runInContext('ErpMatch', ctx);
  const staff = {}, nameBySid = {}, byName = {}, byBiz = {};
  DIR.forEach(u => { nameBySid[u.sid] = u.name;
    staff[EM._norm(u.name)] = { sid:u.sid, name:u.name, ord:u.sortOrder,
      role:u.role, title:u.title, status:u.status }; });
  COS.forEach(co => {
    const rec = { id:co.id, company:co.name, main:nameBySid[co.managerMain]||'', subs:[],
      type:co.typeCode, status:co.status, left:false, contact:'', phone:'', address:'',
      contacts:co.contacts||[] };
    byName[EM._norm(co.name)] = rec; byBiz[String(co.bizNo)] = rec;
  });
  EM.byName = byName; EM.byBiz = byBiz; EM.staff = staff;
  EM.companies = COS; EM.ready = true;
  ctx.ErpMatch = EM; ctx.myEmail = 'p001@pureun.kr';
  EM.nameByEmail = { 'p001@pureun.kr':'권형하' };
  return ctx;
}
const plain = x => JSON.parse(JSON.stringify(x));
const inBox = (c, id) => c.mbCkRows().filter(v => c.mbRowFits(v, id)).length;

/* ══════ ①② 무엇이 묶이나 ══════ */

test('★★ 처음 보는 회사 메일이 «@도메인 하나»로 묶인다 — 개인 메일·한 통짜리는 안 묶인다', () => {
  const c = load();
  const g = plain(c.whoDomGroups());
  assert.deepEqual(g.map(x => x.d), ['gana-sangsa.kr'],
    '묶음이 다릅니다: ' + g.map(x => x.d).join(', '));
  assert.equal(g[0].n, 5, '통수를 합치지 못했습니다');
  assert.equal(g[0].addrs.length, 2, '주소 둘이 한 묶음에 안 들었습니다');
});

test('★★ 공공기관·자동발송은 잇기 목록에 «안 나온다» — 저절로 「그 밖」이다', () => {
  const c = load();
  const ems = plain(c.whoUnknownSenders({ all:true })).map(o => o.e);
  assert.ok(ems.indexOf('labor@moel.go.kr') < 0, '공공기관이 잇기 목록에 남았습니다');
  assert.ok(ems.indexOf('no-reply@bada.kr') < 0, '자동발송이 잇기 목록에 남았습니다');
  assert.ok(ems.indexOf('hong123@naver.com') >= 0, '개인 메일 사람까지 빠졌습니다 — 그건 한 사람씩 이어야 합니다');
});

/* ══════ ③ 회사째 잇기 ══════ */

test('★★ 회사째 이으면 «그 회사 메일 전부»가 담당자에게 가고 묶음에서 빠진다', () => {
  const before = load();
  const na0 = before.mbWhoNoneCount().n;
  const c = load({ co:{ '@gana-sangsa,kr':{ n:'가람사', id:'c1', at:1 } } });
  assert.equal(na0 - c.mbWhoNoneCount().n, 5, '담당 모름이 다섯 통 줄지 않았습니다');
  assert.equal(inBox(c, '@하윤서'), 6, '담당자 칸에 회사 메일이 안 왔습니다');
  assert.equal(plain(c.whoDomGroups()).length, 0, '이었는데 묶음에 남았습니다');
});

test('★★ 줄의 단추가 «회사째»로 잇고 치운다 — 주소 하나로 이으면 다른 직원 메일이 남는다', () => {
  const c = load();
  const h = c.whoDomHtml();
  assert.ok(h.indexOf("mbCoSet('hong@gana-sangsa.kr',this.value,true)") >= 0, '회사째 잇는 칸이 없습니다');
  assert.ok(h.indexOf("mbNotCoSet('hong@gana-sangsa.kr',true,true)") >= 0, '회사째 치우는 단추가 없습니다');
  assert.ok(h.indexOf('list="mbCoDL"') >= 0, '자문사 목록(한 벌)을 안 가리킵니다');
});

/* ══════ ④ 치운 것 되돌리기 ══════ */

test('★★ 회사째 치우면 줄에 «되돌리기»가 남고, 주소별 목록에서는 빠진다', () => {
  const c = load({ notco:{ '@gana-sangsa,kr':1 } });
  const h = c.whoDomHtml();
  assert.ok(h.indexOf("mbNotCoSet('hong@gana-sangsa.kr',false,true)") >= 0, '되돌릴 길이 없습니다');
  const page = c.whoPageHtml();
  const list = page.slice(page.indexOf('📧 주소별'));
  assert.ok(list.indexOf('kim@gana-sangsa.kr') < 0, '치운 회사의 주소가 주소별 목록에 남았습니다');
});

/* ══════ 화면 ══════ */

test('★ 잇기 화면 «맨 위»에 있다 — 주소별 목록보다 먼저', () => {
  const c = load();
  const h = c.whoPageHtml();
  const dom = h.indexOf('🏢 많이 오는 회사'), addr = h.indexOf('📧 주소별');
  assert.ok(dom > 0, '「많이 오는 회사」가 없습니다');
  assert.ok(addr > dom, '주소별 목록이 위에 있습니다');
});

test('★ 위 10곳만 보이고 나머지는 «더 보기»로 — 화면이 길어지지 않게', () => {
  const msgs = {};
  let u = 1;
  for(let i = 0; i < 12; i++){
    msgs[String(u)] = M(u++, 'a@co' + i + '.kr');
    msgs[String(u)] = M(u++, 'a@co' + i + '.kr');
  }
  const c = load({ msgs });
  const h = c.whoDomHtml();
  const rows = (h.match(/>@co\d+\.kr</g) || []).length;
  assert.ok(rows > 0 && rows < 12, '한도 없이 다 그렸습니다 (' + rows + '줄)');
  assert.ok(/나머지 [\d,]+곳 더 보기/.test(h), '「더 보기」가 없습니다');
  c.state.whoDomAll = true;
  assert.equal((c.whoDomHtml().match(/>@co\d+\.kr</g) || []).length, 12, '더 보기를 눌러도 다 안 나옵니다');
});

test('★★ 한 줄은 한 줄이다 — 줄 안에 <br> 이 없다', () => {
  const c = load();
  const h = c.whoDomHtml();
  h.split('<div class="dm-row"').slice(1).forEach(r => {
    const row = r.slice(0, r.indexOf('</div>'));
    assert.ok(row.indexOf('<br') < 0, '줄이 두 줄로 갈립니다');
  });
});
