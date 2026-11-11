'use strict';
/* ☑ 담당자 자동 분류 복원 · 푸른이알피 동기화 · 미확정 체크 화면 (대표 지시 2026-11-11)
   "담당자별로 자동으로 메일 정리가 잘안되는것 같다. 니가 푸른이알피에 담당자와 메일함의 담당자를
    우선 모두 동기화 하고 연결시켜달라 그리고 명확하게 확정되지 않은것들에 대해서 체크하게 해라.
    푸른메일함에 들어가서 판단해야한다."

   ★ 지키는 규칙
     1. 여럿이 섞인 업무 칸(why:'mixed' — 1.자문사답변·2.급여 등)은 칸 고정 담당은 내놓지 않되,
        개별 메일의 주소·업체·업무 건 기반 담당 판정은 살려 담당자 칸으로 자동 정리한다.
     2. 기계발신·반송 주소(no-reply@고객사도메인, mailer-daemon@...)는 회사 도메인이 등록되어 있어도
        담당자 칸에 오배정하지 않고 「그 밖」으로 보낸다.
     3. 아직 업무 칸으로 옮기지 않은 받은메일함(INBOX) 메일도 자문사·이알피로 담당이 확정되면
        담당자 칸(및 자문종료)에 보이고, 미확정 광고 메일은 「담당 모름」을 어지럽히지 않는다.
     4. 주소 확정 없이 폴더 담당만으로 임시 배정된 메일은 목록 딱지에 「칸」(점선)을 붙여 구분한다.
     5. 푸른메일함 안의 「☑ 미확정 체크」 화면에서 ① 추천 연결 ② 칸 임시배정 ③ 단서 없음 ④ 담당 점검을
        체크박스(☐)와 번호(#)로 보고, 고유 열쇠(co.id)로 단건·일괄 확정하거나 담당자 지정·그 밖 처리한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { sliceFn } = require('./fnslice.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
function cut(from, to){
  const i = src.indexOf(from);
  assert.ok(i > 0, from + ' 를 찾지 못했습니다');
  const j = src.indexOf(to, i + from.length);
  assert.ok(j > i, to + ' 를 찾지 못했습니다');
  return src.slice(i, j);
}

const FOLDERS = {
  B_INBOX: { path:'INBOX', name:'INBOX', kind:'inbox', order:1, total:3, unseen:1 },
  B_JAMUN: { path:'1.자문사답변', name:'1.자문사답변', kind:'custom', order:2, total:3, unseen:1 },
  B_CHEBUL:{ path:'4.체불 및 체당금메일', name:'4.체불 및 체당금메일', kind:'custom', order:4, total:2, unseen:0 },
  B_NEWS:  { path:'뉴스레터 발송분', name:'뉴스레터 발송분', kind:'custom', order:9, total:1, unseen:0 }
};

const M = (u, fnm, e, s, r) => ({ u:String(u), n:fnm, f:fnm, e:e, t:'370-6@daum.net', s:s, p:s, d:1762000000 + u, r:r, g:0, a:0, z:1 });

const COS = () => [
  { id:'co-hanbit', name:'한빛물산', managerMain:'P-001', email:'ceo@hanbit.co.kr', contacts:[] },
  { id:'co-ilshin', name:'일신테크', managerMain:'P-002', email:'hr@ilshins.co.kr', contacts:[] },
  { id:'co-maru',   name:'마루산업', managerMain:'P-002', email:'', contacts:[] },
  { id:'co-shared1',name:'청송물류', managerMain:'P-001', email:'tax@semu-shared.kr', contacts:[] },
  { id:'co-shared2',name:'백두상사', managerMain:'P-003', email:'tax@semu-shared.kr', contacts:[] },
  { id:'co-closed', name:'닫힌상사', managerMain:'P-001', status:'closed', email:'end@closedco.kr', contacts:[] }
];

function load(over){
  const o = over || {};
  const held = { wrote:{}, toasts:[], updateCalls:0 };
  const items = o.items || {
    i1: { id:'i1', email:'card@maru-card.kr', company:'마루산업' }
  };
  const state = Object.assign({
    view:'mail', mailSent:'box', mbBox:'', tab:'card', group:'all', owner:'all',
    isAdmin:true, groups:{}, pick:{}, matPick:'', sentBox:{}, schedBox:{},
    mbQ:'', mbFilter:'', mbTab:'', mbCursor:-1, mbOpen:null, mbDash:'who', items: items
  }, o.state || {});
  const dbRef = (p) => ({
    once: () => Promise.resolve({ val: () => null }),
    set: (v) => {
      if(o.rejectWrite) return Promise.reject(new Error('permission_denied'));
      held.wrote[p || '/'] = v;
      return Promise.resolve();
    },
    update: (v) => {
      held.updateCalls++;
      if(o.rejectWrite) return Promise.reject(new Error('permission_denied'));
      if(!p){ Object.assign(held.wrote, v); }
      else { held.wrote[p] = Object.assign({}, held.wrote[p] || {}, v); }
      return Promise.resolve();
    },
    remove: () => { held.wrote[p || '/'] = null; return Promise.resolve(); }
  });
  const dummy = { set innerHTML(v){ dummy._h = v; }, get innerHTML(){ return dummy._h||''; },
    style:{}, classList:{ add(){}, remove(){} }, offsetHeight:120, value:'',
    focus(){}, select(){}, setSelectionRange(){}, contains:()=>false, scrollTop:0 };
  const ctx = {
    console, Object, Array, String, Number, Boolean, Math, JSON, RegExp, Set, Map, Date, Promise, isNaN,
    setTimeout: (fn)=>{ if(fn) fn(); }, clearTimeout(){}, atob:()=>'',
    state, myEmail:'p000@pureun.kr',
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g,
      c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    Store: { mode:'firebase' },
    matMailCfg: () => ({ from:'370-6@daum.net' }),
    matList: () => [], matCat: () => '', MAT_CATS_NOW: () => [], _matMeta: {},
    schedList: () => [],
    staffName: sid => ({ 'P-001':'박한별', 'P-002':'김혜민', 'P-003':'박재원' }[sid] || String(sid||'')),
    fmtDate: () => '2026.11.11', fmtMB: n => n + 'B',
    allItems: () => items, allGroups: () => ({}),
    isPrivGroup: () => false, canSeeGroup: () => true,
    coList: () => [], coTagList: () => [], coFTabList: () => [],
    coFTabCounts: () => ({all:0,byTab:{}}), _coFolders:{}, _coTagHidden:{},
    toast: m => held.toasts.push(String(m)), confirm: () => true, prompt: () => null,
    closeFolderMenu(){}, DB_ROOT:'pucards',
    toggleSidebar(){}, openSettingsPage(){}, openMatPage(){}, openMailPage(){},
    openSentBox(){}, openSchedBox(){}, openInbox(){}, closeMailPage(){},
    openPrivateVault(){}, migrateLockedFolders(){},
    inboxBoxHtml: () => '', schedBoxHtml: () => '', sentBoxHtml: () => '', mailWriteHtml: () => '',
    wireMailWrite(){},
    pickOf: k => (state.pick[k] = state.pick[k] || {}),
    pickOn: (sel,id) => !!(sel && sel[id]),
    pickList: (sel,ids) => (ids||[]).filter(i => !!(sel && sel[i])),
    pickAllOn: (sel,ids) => !!(ids&&ids.length) && ids.every(i => !!(sel&&sel[i])),
    pickClear: k => { state.pick[k] = {}; },
    pickHit(){}, pickToggleAll(){}, pickRedraw(){},
    renderPCSide(){}, renderMailPage(){}, render(){},
    erpFillContact: (arg) => { held.erpFilled = (held.erpFilled || []).concat([arg]); return Promise.resolve(); },
    localStorage: { getItem: () => null, setItem(){} },
    document: { getElementById: () => null, addEventListener(){}, removeEventListener(){} },
    $: () => dummy,
    window: { innerWidth:1600, innerHeight:900 },
    fetch: () => Promise.resolve({ json:()=>Promise.resolve({ok:true}) }),
    firebase: {
      auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('T') } }),
      database: () => ({ ref: (p) => dbRef(p) })
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-mail-fill-core.js'), 'utf8') + ';var PuMailFill = this.PuMailFill || (typeof window !== "undefined" && window.PuMailFill);', ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-mgr-watch-core.js'), 'utf8') + ';var PuMgrWatch = this.PuMgrWatch || (typeof window !== "undefined" && window.PuMgrWatch);', ctx);
  vm.runInContext(cut('const ErpMatch = {', '\nfunction autoFolderFlush('), ctx);
  vm.runInContext(cut('function pcItem(attrs', '\nfunction switchTab('), ctx);

  const msgs = o.msgs || {
    B_INBOX: {
      '1': M(1, '한빛대표', 'ceo@hanbit.co.kr', '받은메일함 자문 문의', 0),
      '2': M(2, '닫힌담당', 'end@closedco.kr', '종료업체 정산서', 1),
      '3': M(3, '외부인',   'stranger@gmail.com', '받은메일함 일반 안내', 1)
    },
    B_JAMUN: {
      '10': M(10, '한빛인사', 'staff@hanbit.co.kr', '취업규칙 검토 요청', 0),
      '11': M(11, '김담당',   'maru77@naver.com', '마루산업 연차수당 문의', 1),
      '12': M(12, '세무사',   'tax@semu-shared.kr', '급여대장 송부', 1),
      '13': M(13, '완전미상', 'mystery@daum.net', '문의드립니다', 1)
    },
    B_CHEBUL: {
      '20': M(20, '진정인', 'worker1@naver.com', '임금체불 진정 자료', 1),
      '21': M(21, '한빛대표', 'ceo@hanbit.co.kr', '한빛물산 체불 소명', 1)
    },
    B_NEWS: {
      '30': M(30, '자동반송', 'no-reply@ilshins.co.kr', 'Delivery Status Notification', 1)
    }
  };
  vm.runInContext(
    '_mbFolders = ' + JSON.stringify(o.folders || FOLDERS) + ';' +
    '_mbMsgs = ' + JSON.stringify(msgs) + ';' +
    '_mbBins = {}; _mbPut = {};' +
    '_mbHide = {};' +
    '_mbNoWho = ' + JSON.stringify(o.noWho || { B_JAMUN: { why:'mixed', at:1 }, B_NEWS: 1 }) + ';' +
    '_mbBoxWho = ' + JSON.stringify(o.boxWho || { B_CHEBUL: { who:['박재원'] } }) + ';' +
    '_mbOwner = ' + JSON.stringify(o.owner || {}) + ';' +
    '_mbCo = ' + JSON.stringify(o.co || {}) + ';' +
    '_mbNotCo = ' + JSON.stringify(o.notCo || {}) + ';' +
    '_mgrSeen = ' + JSON.stringify(o.mgrSeen || { 'co-hanbit':'P-002' }) + ';' +
    '_mgrChange = ' + JSON.stringify(o.mgrChange || { 'co-hanbit':{ co:'co-hanbit', coName:'한빛물산', from:'P-002', to:'P-001', at:1762000000000 } }) + ';' +
    '_mgrKeep = {}; _mbOrder = {}; _mbWhoOrder = {}; _mbMeta = { at:1, ok:true };',
    ctx
  );

  const cos = o.cos || COS();
  const EM = vm.runInContext('ErpMatch', ctx);
  EM.nameBySid = { 'P-001':'박한별', 'P-002':'김혜민', 'P-003':'박재원' };
  EM.nameByEmail = { 'p001@pureun.kr':'박한별', 'p002@pureun.kr':'김혜민', 'p003@pureun.kr':'박재원' };
  EM.companies = cos;
  EM.recOfCo = (c) => ({
    id: c.id,
    company: c.name,
    main: EM.nameBySid[c.managerMain] || c.managerMain || '',
    subs: [],
    left: c.status === 'closed'
  });
  const byName = {};
  cos.forEach(c => { byName[EM._norm(c.name)] = EM.recOfCo(c); });
  EM.byName = byName;
  EM.byBiz = {};
  EM.match = (it) => {
    const k = EM._norm(it && it.company || '');
    return byName[k] || null;
  };
  EM.ready = true;
  ctx.ErpMatch = EM;
  ctx._held = held;
  vm.runInContext('mbWhoBust();', ctx);
  return ctx;
}

const rowsIn = (c, boxId) => { c.state.mbBox = boxId; c.mbMemoClear(); return c.mbAllRows(); };

/* ══ ① 여럿이 섞인 업무 칸(mixed) 자동 분류 복원 ══ */
test('★★★ 여럿이 섞인 업무 칸(1.자문사답변 등)의 자문사 메일이 사람 안 붙임으로 증발하지 않고 담당자 칸으로 자동 정리된다', () => {
  const c = load();
  const offSubjects = rowsIn(c, '@0').map(v => v.s);
  assert.ok(!offSubjects.includes('취업규칙 검토 요청'),
    '★★★ 섞임 업무 칸(B_JAMUN)의 자문사 메일이 「사람 안 붙임(@0)」으로 빠졌습니다');
  assert.ok(offSubjects.includes('Delivery Status Notification'),
    '★★ 진짜 사람 안 붙임 칸(뉴스레터 발송분)은 @0 에 남아야 합니다');

  const hanbyul = rowsIn(c, '@박한별').map(v => v.s);
  assert.ok(hanbyul.includes('취업규칙 검토 요청'),
    '★★★ 섞임 업무 칸 안의 한빛물산 도메인 메일이 담당 노무사(박한별) 칸에 들어오지 않습니다');
  assert.ok(!hanbyul.includes('문의드립니다'),
    '★★ 섞임 업무 칸의 미확정 메일이 한 사람에게 쏠리면 안 됩니다');
});

/* ══ ② 기계발신·반송 주소의 회사 도메인 오배정 차단 ══ */
test('★★★ no-reply@고객사도메인 반송 메일은 회사 도메인이 있어도 담당자 칸에 오배정되지 않는다', () => {
  /* 뉴스레터 발송분 칸이 아니더라도(일반 업무 칸에 들어와도) 기계발신 주소는 회사 도메인으로 매칭하면 안 된다 */
  const c = load({
    msgs: {
      B_JAMUN: {
        '50': M(50, '반송시스템', 'no-reply@ilshins.co.kr', '[발송실패] 주간뉴스레터', 1),
        '51': M(51, '일신인사팀', 'manager@ilshins.co.kr', '일신테크 급여 문의', 1)
      }
    }
  });
  const hyemin = rowsIn(c, '@김혜민').map(v => v.s);
  assert.ok(hyemin.includes('일신테크 급여 문의'), '실제 고객사 담당자 메일은 도메인으로 김혜민 칸에 가야 합니다');
  assert.ok(!hyemin.includes('[발송실패] 주간뉴스레터'),
    '★★★ no-reply@ilshins.co.kr 반송 메일이 도메인 일치로 김혜민 칸에 잘못 들어갔습니다');
  const other = rowsIn(c, '@#').map(v => v.s);
  assert.ok(other.includes('[발송실패] 주간뉴스레터'), '기계발신 반송 메일은 「그 밖(@#)」으로 빠져야 합니다');
});

/* ══ ③ 받은메일함(INBOX) 확정 담당 메일 반영 & 미확정 메일 격리 ══ */
test('★★★ 받은메일함(INBOX)에 남아 있어도 담당이 확정된 메일은 담당자·자문종료 칸에 잡히고, 미확정 메일은 담당 모름을 어지럽히지 않는다', () => {
  const c = load();
  const hanbyul = rowsIn(c, '@박한별').map(v => v.s);
  assert.ok(hanbyul.includes('받은메일함 자문 문의'),
    '★★★ INBOX 에 있는 확정 자문사(ceo@hanbit.co.kr) 메일이 박한별 칸에 보이지 않습니다');

  const ended = rowsIn(c, '@!').map(v => v.s);
  assert.ok(ended.includes('종료업체 정산서'),
    '★★ INBOX 에 있는 종료업체 메일이 자문종료(@!) 칸에 보이지 않습니다');

  const unknown = rowsIn(c, '@?').map(v => v.s);
  assert.ok(!unknown.includes('받은메일함 일반 안내'),
    '★★★ INBOX 미확정 메일이 「담당 모름(@?)」에 섞여 광고 폭탄을 일으키면 안 됩니다');

  /* 담당자 칸을 열 때 필요한 폴더 목록에 INBOX 가 포함되어야 실제로 읽어 온다 */
  const need = Array.from(c.mbNeedSlugs('@박한별'));
  assert.ok(need.includes('B_INBOX'), '★★ 담당자 칸을 열 때 INBOX 폴더를 읽어 오지 않습니다');

  /* 담당자 칸 목록에서 INBOX 메일은 📥 받은메일함 출처 꼬리표를 달아 준다 */
  c.state.mbBox = '@박한별';
  const inboxRow = rowsIn(c, '@박한별').find(v => v._slug === 'B_INBOX');
  assert.ok(inboxRow, 'INBOX 줄을 찾지 못했습니다');
  assert.match(c.mbWhoTag(inboxRow), /받은메일함/, '★★ 담당자 칸 안에서 받은메일함 출처 표시가 없습니다');
});

/* ══ ④ 칸 임시배정 점선 딱지 & 빈 담당자 칸 문구 ══ */
test('★★ 폴더 담당만으로 임시 배정된 메일은 목록에서 점선 「칸」 딱지로 구분되고, 확정 주소는 실선 딱지로 나온다', () => {
  const c = load();
  c.state.mbBox = '~B_CHEBUL';
  const rows = rowsIn(c, '~B_CHEBUL');
  const boxOnlyRow = rows.find(v => v.e === 'worker1@naver.com');
  const confirmedRow = rows.find(v => v.e === 'ceo@hanbit.co.kr');
  assert.ok(boxOnlyRow && confirmedRow);

  const tagBoxOnly = c.mbWhoTag(boxOnlyRow);
  const tagConfirmed = c.mbWhoTag(confirmedRow);
  assert.match(tagBoxOnly, /dm-who guess[\s\S]*박재원[\s\S]*<i>칸<\/i>/,
    '★★ 폴더 담당만으로 임시 배정된 메일에 점선 「칸」 표시가 없습니다: ' + tagBoxOnly);
  assert.doesNotMatch(tagConfirmed, /dm-who guess/,
    '★★ 푸른이알피로 확정된 한빛물산 대표 주소까지 임시배정으로 표시하면 안 됩니다');

  /* 다른 폴더에는 메일이 있는데 열린 담당자 칸에만 0통일 때 거짓 문구를 내지 않는다 */
  c.state.mbBox = '@박은비';
  const emptyListHtml = c.mbListHtml();
  assert.doesNotMatch(emptyListHtml, /아직 동기화된 메일이 없습니다/,
    '★★ 다른 폴더에 메일이 있는데 빈 담당자 칸에서 「동기화된 메일이 없다」고 잘못 안내합니다');
  assert.match(emptyListHtml, /이 칸에 해당하는 메일이 없습니다/);
});

/* ══ ⑤ 푸른메일함 내 「☑ 미확정 체크」 분류·체크박스·번호·일괄 확정 ══ */
test('★★★ ☑ 미확정 체크 화면이 PC·폰·옆줄에 연결되어 있고 4갈래로 정확히 분류한다', () => {
  assert.match(sliceFn(src, 'function renderMailPage('), /mailSent==='uchk'\s*\?\s*uchkHtml\(\)/,
    'PC 메일 화면에 uchk 분기가 없습니다');
  assert.match(sliceFn(src, 'function renderMailMobile('), /mailSent==='uchk'\s*\?\s*uchkHtml\(\)/,
    '폰 메일 화면에 uchk 분기가 없습니다');

  const c = load({
    msgs: {
      B_JAMUN: {
        '11': M(11, '김담당',   'maru77@naver.com', '마루산업 연차수당 문의', 1),
        '12': M(12, '세무사',   'tax@semu-shared.kr', '급여대장 송부', 1),
        '13': M(13, '완전미상', 'mystery@daum.net', '문의드립니다', 1),
        '14': M(14, '마루명함', 'card@maru-card.kr', '안녕하세요', 1)
      },
      B_CHEBUL: {
        '20': M(20, '진정인', 'worker1@naver.com', '임금체불 진정 자료', 1)
      }
    }
  });
  assert.match(c.mailSideHtml(), /openUchkPage\(\)[\s\S]{0,200}미확정 체크/, '옆줄에 미확정 체크 진입점이 없습니다');
  assert.match(c.mbDrawerHtml(), /openUchkPage\(\)[\s\S]{0,200}미확정 체크/, '폰 서랍에 미확정 체크 진입점이 없습니다');

  const d = c.uchkData();
  const hintEmails = Array.from(d.hint, g => g.em);
  const boxEmails = Array.from(d.box, g => g.em);
  const noneEmails = Array.from(d.none, g => g.em);

  assert.ok(hintEmails.includes('maru77@naver.com'), '제목에 마루산업이 적힌 보낸이가 추천 연결(hint)에 잡혀야 합니다');
  assert.ok(hintEmails.includes('card@maru-card.kr'), '명함 상호가 마루산업인 미확정 주소가 추천 연결(hint)에 잡혀야 합니다');
  assert.ok(hintEmails.includes('tax@semu-shared.kr'), '복수 사업장 공용 이메일이 주의 항목으로 추천 연결(hint)에 잡혀야 합니다');
  const shared = Array.from(d.hint).find(g => g.em === 'tax@semu-shared.kr');
  assert.equal(shared.sug.shared, true, '공용 이메일은 단일 회사로 자동 추천하지 않고 공용 주의로 표시해야 합니다');
  assert.equal(shared.sug.co, null);

  assert.deepEqual(boxEmails, ['worker1@naver.com'], '폴더 담당만 있는 보낸이는 칸 임시배정(box)에 잡혀야 합니다');
  assert.deepEqual(noneEmails, ['mystery@daum.net'], '단서 없는 보낸이는 단서 없음(none)에 잡혀야 합니다');
});

test('★★★ 미확정 체크 표에 체크박스(☐)와 번호(#)가 있고, 추천 업체 일괄 확정은 한 번의 update 와 고유 열쇠(co.id)로 적는다', async () => {
  const c = load({
    msgs: {
      B_JAMUN: {
        '11': M(11, '김담당', 'maru77@naver.com', '마루산업 연차수당 문의', 1),
        '14': M(14, '마루명함', 'card@maru-card.kr', '안녕하세요', 1)
      },
      B_CHEBUL: {
        '20': M(20, '진정인', 'worker1@naver.com', '임금체불 진정 자료', 1)
      }
    }
  });
  c.state.mailSent = 'uchk';
  c.state.uchkTab = 'hint';
  const html0 = c.uchkHtml();
  assert.match(html0, /<th class="ck"><input type="checkbox" aria-label=/, '표 머리에 접근성 라벨을 갖춘 전체 선택 체크박스(☐)가 없습니다');
  assert.match(html0, /<th class="no">#<\/th>/, '표 머리에 번호(#) 열이 없습니다');
  assert.match(html0, /<td class="no">1<\/td>/, '줄에 일련번호가 매겨지지 않습니다');

  /* 전체 선택 후 추천 업체 일괄 확정 실행 — 두 주소를 한 번의 원자적 update 로 적어야 한다 */
  c.uchkSelAll(true);
  const htmlSel = c.uchkHtml();
  assert.match(htmlSel, /uchkBulk\('link'\)/, '체크박스 선택 시 상단 일괄 확정 막대가 뜨지 않습니다');
  await c.uchkBulk('link');
  assert.equal(c._held.updateCalls, 1, '★★ 일괄 확정이 주소마다 따로 저장하면 부분 성공 불일치가 납니다 — 한 번의 update 여야 합니다');

  /* 고유 열쇠(co-maru)로 /pucards/config/mailCo 에 저장되고, 즉시 김혜민 담당으로 바뀌어 미확정 목록에서 사라져야 한다 */
  const saved = c._held.wrote['pucards/config/mailCo/maru77@naver,com'];
  assert.ok(saved, 'mailCo 에 저장되지 않았습니다');
  assert.equal(saved.id, 'co-maru', '★★★ 온톨로지 규칙 위반: 업체 이름이 아니라 고유 열쇠(co.id)가 적혀야 합니다');
  assert.equal(saved.n, '마루산업');
  assert.equal(Array.from(c.uchkData().hint, g => g.em).includes('maru77@naver.com'), false,
    '확정한 뒤에도 미확정 목록에 그대로 남아 있습니다');
  assert.ok(rowsIn(c, '@김혜민').some(v => v.e === 'maru77@naver.com'),
    '확정한 주소의 메일이 즉시 담당 노무사(김혜민) 칸으로 들어가지 않습니다');

  /* 칸 임시배정 탭에서 체크 후 칸 담당 일괄 확정 */
  c.uchkTabSet('box');
  c.uchkSelAll(true);
  await c.uchkBulk('boxwho');
  assert.equal(c._held.wrote['pucards/config/mailWho/worker1@naver,com'], '박재원',
    '칸 담당 일괄 확정이 mailWho 에 적히지 않았습니다');
  assert.equal(c.uchkData().box.length, 0, '칸 담당으로 확정한 뒤에도 임시배정 목록에 남았습니다');
});

test('★★ 담당 점검 탭에서도 체크박스(☐)로 여러 업체의 담당 변경을 한꺼번에 확인(mgrAckBulk)할 수 있다', async () => {
  const c = load();
  c.state.mailSent = 'uchk';
  c.state.uchkTab = 'mgr';
  const h1 = c.uchkHtml();
  assert.match(h1, /mgrPickAll\('chg'\)/, '담당 점검 변경 목록에 모두 고르기 체크박스가 없습니다');

  c.mgrPickAll('chg');
  const h2 = c.uchkHtml();
  assert.match(h2, /mgrAckBulk\(\)/, '체크 후 일괄 변경 확인 단추가 뜨지 않습니다');
  await c.mgrAckBulk();
  assert.ok(c._held.wrote['pucards/config/mgrChange/co-hanbit/ack'] > 0, '일괄 확인 시각이 기록되지 않았습니다');
  assert.equal(c.mgrRows().changes.length, 0, '일괄 확인 뒤에도 미확인 변경으로 남아 있습니다');
});

/* ══ ⑥ 보안·무결성·경계 회귀 검사 ══ */
test('★★★ 보안(XSS) — 외부 메일 보낸이 이름에 따옴표·스크립트가 들어 있어도 onclick 속성 파싱 시 코드가 실행되지 않는다', () => {
  const payload = "O'Connor ');globalThis.__uchkXss=1;//";
  const c = load({
    msgs: {
      B_JAMUN: {
        '91': M(91, payload, 'oconnor@naver.com', '마루산업 자문 요청', 1)
      }
    }
  });
  c.state.mailSent = 'uchk';
  c.state.uchkTab = 'hint';
  c.uchkPeekToggle('oconnor@naver,com');
  const html = c.uchkHtml();
  const decodeAttr = (s) => s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
  const handlers = [...html.matchAll(/\bon(?:click|change|input)="([^"]*)"/g)].map(m => decodeAttr(m[1]));
  assert.ok(handlers.length > 0, '핸들러를 찾지 못했습니다');
  const sb = {
    __uchkXss: 0,
    event: { isComposing:false, stopPropagation(){} },
    uchkTabSet(){}, uchkSetQ(){}, mbErpFillSet(){}, uchkToggleInbox(){},
    uchkLinkCoByKey(){}, uchkConfirmBox(){}, uchkFindToggle(){}, mbWhoAsk(){},
    uchkPeekToggle(){}, uchkNotCo(){}, uchkSel(){}, uchkSelAll(){},
    uchkFindInput(){}, uchkOpenInBox(){}, uchkBulk(){}, uchkBulkWhoMenu(){}
  };
  vm.createContext(sb);
  for(const code of handlers){
    /* 브라우저가 HTML 엔티티를 복원한 뒤 JS 로 컴파일·실행하는 것과 동일한 검증 */
    vm.runInContext('(function(){ const el={dataset:{k:"k",co:"c",em:"e",slug:"s",uid:"u",t:"hint"},checked:true,value:""}; (function(){ ' + code + ' }).call(el); })()', sb);
  }
  assert.equal(sb.__uchkXss, 0, '★★★ 외부 보낸이 이름이 onclick 문자열을 닫고 임의 스크립트를 실행했습니다(저장형 XSS)');
});

test('★★★ 무결성 — Firebase 저장이 거절(permission_denied)되면 로컬 상태를 거짓 확정하지 않고 오류 토스트를 띄운다', async () => {
  const c = load({
    rejectWrite: true,
    msgs: {
      B_JAMUN: {
        '11': M(11, '김담당', 'maru77@naver.com', '마루산업 연차수당 문의', 1)
      }
    }
  });
  c.state.mailSent = 'uchk';
  c.state.uchkTab = 'hint';
  c.uchkSelAll(true);
  const ok = await c.uchkBulk('link');
  assert.equal(ok, false, '저장이 실패했는데 성공(true)을 돌려주면 안 됩니다');
  assert.equal(Array.from(c.uchkData().hint, g => g.em).includes('maru77@naver.com'), true,
    '★★★ 서버 저장이 거절됐는데 로컬에서는 확정된 것처럼 목록에서 사라졌습니다');
  assert.equal(c.state.uchkSel['maru77@naver,com'], 1, '저장 실패 시 사용자가 골라 둔 체크가 날아가면 안 됩니다');
  assert.ok(c._held.toasts.some(t => /저장하지 못했습니다/.test(t)), '저장 실패 안내 토스트가 없습니다');
  assert.ok(!c._held.toasts.some(t => /확정했습니다/.test(t)), '저장 실패인데 성공 토스트가 함께 떴습니다');
});

test('★★ 경계값 — 진짜 빈 메일함(msgs:{})에서 영구 로딩에 빠지지 않고, 검색 중 일괄 확정은 화면에 보이는 선택 줄만 처리한다', async () => {
  const emptyCtx = load({ msgs: {} });
  emptyCtx.state.mailSent = 'uchk';
  const emptyHtml = emptyCtx.uchkHtml();
  assert.doesNotMatch(emptyHtml, /메일을 읽어 오는 중입니다/, '★★ 폴더 로드가 끝난 빈 메일함이 영구 로딩에 빠졌습니다');
  assert.match(emptyHtml, /미확정 항목이 없습니다/, '빈 메일함 완료 안내가 나와야 합니다');

  const c = load({
    msgs: {
      B_JAMUN: {
        '11': M(11, '김담당', 'maru77@naver.com', '마루산업 연차수당 문의', 1),
        '14': M(14, '마루명함', 'card@maru-card.kr', '안녕하세요', 1)
      }
    }
  });
  c.state.mailSent = 'uchk';
  c.state.uchkTab = 'hint';
  c.uchkSelAll(true);               /* 2개 선택 */
  c.uchkSetQ('maru77');             /* 검색으로 1개만 화면에 남김 */
  const filteredHtml = c.uchkHtml();
  assert.match(filteredHtml, /☑ 1개 선택/, '검색 필터 기준 선택 개수가 표시되어야 합니다');
  await c.uchkBulk('link');
  assert.ok(c._held.wrote['pucards/config/mailCo/maru77@naver,com'], '화면에 보이는 선택 주소는 확정되어야 합니다');
  assert.equal(c._held.wrote['pucards/config/mailCo/card@maru-card,kr'], undefined,
    '★★ 검색으로 숨겨진 줄까지 몰래 함께 확정되면 안 됩니다');
});
