'use strict';
/* 📬 담당자별 본인 사업장 지정 · 이름 오른쪽 빠른 클릭 · 과거자료 즉시 가져오기 · 세무사무실 연계 이중 점검
   (대표 지시 2026-11-18)
   1) 사업장 연결({n,id})을 열쇠(id) 우선으로 해석하고, 받은메일함·보관메일함·📦 지난 메일에 있는
      담당 사업장 메일도 담당자 함(@이름)으로 빠짐없이 가져오되 담당 모름(@?)은 어지럽히지 않는다.
   2) 여러 사업장을 함께 맡는 세무사무실(byTaxEmail) 메일은 제목·첨부파일명·4글자 앞머리 일치로
      해당 사업장 담당자에게 정확히 가른다.
   3) 담당자 팝업(mbOwnerMove)에서 사람 이름 오른쪽에 🏢 사업장 · 📥 과거까지 · 📁 건 버튼을 두어
      빠르게 클릭하고, 클릭 즉시 전체 폴더 과거 메일(loadMailBox 0)과 📦 지난 메일(mbOldLoad)을 끌어온다.
   4) 세무사무실과 사업장·본인 담당자 일치 여부를 상단 배너·저장 모달·빠른 사업장 지정에서 한 번 더 체크한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');

function normName(s) {
  return String(s || '')
    .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|사단법인|재단법인/g, '')
    .replace(/[^가-힣a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function makeSandbox(opts = {}) {
  const companies = opts.companies || [
    { id: 'co-101', name: '다라식당앤구이', bizNo: '101-81-00001', status: 'active', managerMain: '김영희', taxEmail: 'tax@chungsol.kr', taxOfficeName: '세무법인청솔' },
    { id: 'co-102', name: '주식회사 마바유통', bizNo: '102-81-00002', status: 'active', managerMain: '이철수', taxEmail: 'tax@chungsol.kr', taxOfficeName: '세무법인청솔' },
    { id: 'co-103', name: '가나상사', bizNo: '103-81-00003', status: 'active', managerMain: '김영희', email: 'ceo@gana.kr' },
    { id: 'co-104', name: '사아테크', bizNo: '104-81-00004', status: 'active', managerMain: '김영희', taxEmail: '' },
  ];
  const byId = {};
  const byName = {};
  const byTaxEmail = {};
  companies.forEach((c) => {
    const rec = {
      id: String(c.id),
      company: c.name,
      coName: c.name,
      name: c.name,
      main: c.managerMain || '',
      sub: c.managerSub || [],
      subs: c.managerSub || [],
      left: c.status === 'terminated' || c.status === 'ended',
      status: c.status || 'active',
      bizNo: c.bizNo || '',
      bizno: String(c.bizNo || '').replace(/\D/g, ''),
      taxEmail: c.taxEmail || '',
      taxOfficeName: c.taxOfficeName || '',
    };
    byId[rec.id] = rec;
    byName[normName(c.name)] = rec;
    if (c.taxEmail) {
      const em = c.taxEmail.toLowerCase();
      (byTaxEmail[em] = byTaxEmail[em] || []).push({
        id: rec.id,
        coName: c.name,
        company: c.name,
        taxOfficeName: c.taxOfficeName || '',
        bizno: rec.bizno,
      });
    }
  });

  const confirms = [];
  const toasts = [];
  const loadedBoxes = [];
  let oldLoaded = 0;
  const patchedJobs = [];

  const menuEl = { innerHTML: '', style: {} };
  const listEl = { innerHTML: '' };

  const ctx = {
    Object, String, Number, Array, Boolean, Math, Date, RegExp, Map, Set, Promise, JSON,
    console,
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    indexedDB: {},
    MB_WHO_P: '@',
    MB_WHO_NA: '@?',
    MB_WHO_OTH: '@#',
    MB_WHO_END: '@!',
    MB_WHO_OFF: '@-',
    MB_BIN_P: '#',
    MB_RAW_P: '~',
    MB_OLD_ID: '*old',
    MB_PUB_DOM: ['naver.com', 'daum.net', 'hanmail.net', 'nate.com', 'gmail.com'],
    DB_ROOT: 'pucards',
    Store: { mode: opts.storeMode || 'firebase' },
    firebase: {
      auth: () => ({ currentUser: { uid: 'u-test' } }),
      database: () => ({
        ref: () => ({
          update: () => Promise.resolve(),
          set: () => Promise.resolve(),
        }),
      }),
    },
    state: {
      view: 'mail',
      mailFolder: '@김영희',
      mbOwnKeep: false,
      mbOwnPast: false,
      mbOwnOne: null,
      mbOwnPullPast: true,
      taxSave: null,
      mbOpen: {},
      cards: [],
    },
    _mbMsgs: opts.msgs || {},
    _mbOwner: opts.hand || {},
    _mbWhoMsg: opts.whoMsg || {},
    _mbCo: opts.co || {},
    _mbNotCo: {},
    _mbPut: {},
    _mbWork: { all: [] },
    _mbWorkLink: {},
    _mbWkAddr: {},
    _mbWkMsg: {},
    _mbWkMsgAddr: {},
    _mbOldLoaded: false,
    _mbFullSlugs: {},
    _mbPastPulling: false,
    _mbAutoPastDone: false,
    ErpMatch: {
      ready: true,
      companies,
      byId,
      byName,
      byTaxEmail,
      nameByEmail: {},
      _norm: normName,
      load: async () => {},
      match: (card) => {
        if (card && card.erpCoId && byId[String(card.erpCoId)]) return byId[String(card.erpCoId)];
        return byName[normName(card && card.company)] || null;
      },
    },
    esc: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    $: (id) => (id === 'folderMenu' ? menuEl : (id === 'mbOwnCoList' ? listEl : null)),
    document: { querySelector: () => null },
    confirm: (msg) => {
      confirms.push(msg);
      return opts.confirmReply !== undefined
        ? (typeof opts.confirmReply === 'function' ? opts.confirmReply(msg, confirms.length) : opts.confirmReply)
        : true;
    },
    toast: (msg) => { toasts.push(msg); },
    closeFolderMenu: () => {},
    mbPlaceMenu: () => {},
    renderPCSide: () => {},
    renderMailPage: () => {},
    render: () => {},
    mbDrawSoon: () => {},
    mbWhoBust: () => { ctx._memo = {}; },
    _memo: {},
    mbMemoOf: () => ctx._memo,
    mbWhoKey: (s) => String(s || '').trim().toLowerCase().replace(/[.#$/\[\]]/g, ','),
    mbDomOf: (em) => { const i = String(em || '').lastIndexOf('@'); return i < 0 ? '' : String(em).slice(i + 1).toLowerCase(); },
    mbRetired: () => false,
    mbSuccOf: () => '',
    mbPerson: (s) => String(s || '').trim(),
    mbStaffOf: () => ({}),
    mbWhoPosOf: () => 999,
    mbWhoOrd: () => 999,
    mbMyName: () => opts.me || '이철수',
    mbNow: () => ctx.state.mailFolder,
    mbHidden: () => false,
    mbBins: () => [{ id: '#pay', name: '2.급여+사무대행', link: 'f_pay' }],
    mbBinBy: (id) => (id === '#pay' ? { id: '#pay', name: '2.급여+사무대행', link: 'f_pay' } : null),
    mbBinIdOfRow: (v) => (v && v._slug === 'f_pay' ? '#pay' : ''),
    mbBinOfRow: (v) => (v && v._slug === 'f_pay' ? { id: '#pay', name: '2.급여+사무대행', link: 'f_pay' } : null),
    mbFolders: () => [
      { slug: 'f_in', kind: 'inbox', name: '받은메일함', total: 50 },
      { slug: 'f_pay', kind: 'custom', name: '2.급여+사무대행', total: 50 },
      { slug: 'f_arc', kind: 'archive', name: '보관메일함', total: 50 },
      { slug: 'f_trash', kind: 'trash', name: '휴지통', total: 5 },
    ],
    mbFolderBy: (slug) => ctx.mbFolders().find((f) => f.slug === slug) || null,
    mbFolderOf: (kind) => ctx.mbFolders().filter((f) => f.kind === kind),
    mbGotFolder: (f) => !!(f && f.kind !== 'sent' && f.kind !== 'draft' && f.kind !== 'trash' && f.kind !== 'spam'),
    mbEndedOfRow: () => false,
    mbNoWhoOfRow: () => false,
    mbOtherOfRow: () => false,
    mbWasRetired: () => false,
    mbBoxWhoOfRow: () => [],
    mbWorkMgrOfAddr: () => '',
    mbWorkHandOf: () => null,
    mbWorkOfRow: () => [],
    mbGuessOf: () => null,
    mbErpFillOn: () => false,
    erpFillContact: async () => ({ ok: true, added: false }),
    erpCoPatchMany: async (jobs) => {
      let done = 0;
      const infos = {};
      jobs.forEach((j) => {
        const cur = companies.find((x) => String(x.id) === String(j.id)) || {};
        const res = j.plan(cur);
        infos[j.id] = (res && res.info) || {};
        if (res && !res.none && res.fields) {
          Object.assign(cur, res.fields);
          patchedJobs.push({ coId: String(j.id), patch: res.fields });
          done++;
        }
      });
      return { done, infos, failed: [] };
    },
    loadMailBox: (slug, limit, cb) => {
      loadedBoxes.push({ slug, limit });
      if (opts.onLoadMailBox) opts.onLoadMailBox(ctx, slug, limit);
      if (cb) cb();
    },
    mbOldLoad: (cb) => {
      oldLoaded++;
      ctx._mbOldLoaded = true;
      if (opts.onOldLoad) opts.onOldLoad(ctx);
      if (cb) cb();
    },
    mbWhoIndex: () => {
      const byAddr = {};
      companies.forEach((c) => {
        if (c.email && c.managerMain) byAddr[c.email.toLowerCase()] = c.managerMain;
      });
      return { byAddr, byDom: {}, coAddr: {}, rawCo: {} };
    },
    mbOneRow: (slug, uid) => {
      const r = ((ctx._mbMsgs || {})[slug] || {})[uid];
      return r ? Object.assign({}, r, { _slug: slug, _key: slug + ':' + uid }) : null;
    },
    mbPicked: () => [],
  };

  vm.createContext(ctx);
  [
    'function mbWhoLive(', 'function mbHqMap(', 'function mbHqRec(', 'function mbCoValName(',
    'function mbCoOf(', 'function mbCoNameOf(', 'function mbCoRec(', 'function mbCoRecOfAddr(', 'function mbTaxRecOfRow(',
    'function mbWkMsgOf(', 'function mbWhoWhy(', 'function mbWhoWhyOf(', 'function mbWhoOfRow(',
    'function mbSubsOfRow(', 'function mbIsPersonBox(', 'function mbWhoScope(', 'function mbWhoTally(',
    'function mbWhoList(', 'function mbRowFits(', 'function mbNeedSlugs(', 'function mbRowMentionsCo(',
    'function mbTagPastSenderInLoaded(', 'function mbPullPastAll(',
    'function taxSkipSet(', 'function taxHintFor(', 'function taxCoInfoOf(', 'function taxCheckOf(',
    'function taxStripHtml(', 'function taxSaveOpen(', 'function taxSaveClose(',
    'function taxSaveNeedsVerify(', 'function taxSaveAddHitsHtml(', 'function taxSaveAddQ(',
    'async function taxSaveDo(', 'function taxSaveHtml(',
    'function mbOwnRows(', 'function mbOwnerKeep(', 'function mbOwnerOne(', 'function mbOwnerMove(',
    'function mbOwnerPut(', 'function mbTaxSenderInfo(', 'function mbOwnCoByIdx(',
    'function mbOwnAllByIdx(', 'function mbOwnWkByIdx(', 'function mbOwnCoOpen(', 'function mbOwnCoQ(',
    'function mbOwnCoTogglePast(', 'function mbOwnCoToggleTax(', 'function mbOwnCoDetectedIds(',
    'function mbOwnCoListHtml(', 'function mbOwnCoDraw(', 'async function mbOwnCoPickIdx(',
    'async function mbOwnCoPick(',
  ].forEach((sig) => {
    vm.runInContext(sliceFn(app, sig), ctx);
  });
  vm.runInContext('var _mbOwnCoShown = []; var _mbBizSubs = {}; var _mbPastWaiters = []; var _taxSaveBusy = false; var _mbOwnCoBusy = false; var TAX_SKIP_KEY = "t_skip"; var localStorage = { getItem:()=>null, setItem:()=>{} };', ctx);

  return { ctx, confirms, toasts, loadedBoxes, getOldLoaded: () => oldLoaded, patchedJobs, menuEl, listEl };
}

test('★★★ 사업장 ID 우선 해석 + 받은메일함·보관메일함·지난메일(*old) 담당자 메일 유입 (담당모름 오염 없음)', () => {
  const { ctx } = makeSandbox({
    companies: [
      { id: 'co-a', name: '가나상사', bizNo: '111-11-11111', status: 'active', managerMain: '이철수' },
      { id: 'co-b', name: '가나상사(천안)', bizNo: '222-22-22222', status: 'active', managerMain: '김영희' },
    ],
    co: {
      'hr@gana-cheonan,kr': { n: '가나상사', id: 'co-b', at: 1 },
    },
    msgs: {
      f_in: {
        '1': { e: 'hr@gana-cheonan.kr', s: '4대보험 상실신고 요청', r: 0 },
        '2': { e: 'ad@newsletter.kr', s: '특가 광고 안내', r: 0 },
      },
      f_arc: {
        '3': { e: 'hr@gana-cheonan.kr', s: '보관된 급여대장', r: 1 },
      },
      '*old': {
        '4': { e: 'hr@gana-cheonan.kr', s: '작년 원천징수영수증', r: 1 },
        '5': { e: 'unknown@random.kr', s: '오래된 미분류 메일', r: 1 },
      },
    },
  });

  const rec = ctx.mbCoRecOfAddr('hr@gana-cheonan.kr');
  assert.equal(rec.id, 'co-b', '동명·유사명 사업장이 있어도 저장된 열쇠(id)로 먼저 찾아야 한다');

  const tally = ctx.mbWhoTally();
  assert.equal(tally.cnt['김영희'], 3, '받은메일함·보관메일함·지난메일(*old)에 흩어진 본인 사업장 메일 3통이 모두 잡혀야 한다');
  assert.equal(tally.none.n, 0, '받은메일함·지난메일의 미확인 메일은 담당 모름(@?)을 오염시키면 안 된다');

  const slugsForPerson = ctx.mbNeedSlugs('@김영희');
  assert.ok(slugsForPerson.includes('f_in') && slugsForPerson.includes('f_arc'), '담당자 칸을 열 때 받은메일함·보관메일함도 함께 읽어야 한다');
  const slugsForUnknown = ctx.mbNeedSlugs('@?');
  assert.ok(!slugsForUnknown.includes('f_in'), '담당 모름(@?)은 받은메일함을 읽지 않는다');
});

test('★★★ 공용 세무사무실(byTaxEmail) 메일을 제목·첨부파일명·4글자 앞머리로 담당 사업장별 분리', () => {
  const { ctx } = makeSandbox({
    msgs: {
      f_pay: {
        '10': {
          e: 'tax@chungsol.kr',
          f: '청솔담당자',
          s: '다라식당',
          p: '',
          an: ['퇴직소득원천징수영수증.pdf', '다라식당앤구이_106_홍길동_2026_근로소득원천징수영수증.pdf'],
          r: 0,
        },
        '11': {
          e: 'tax@chungsol.kr',
          f: '청솔담당자',
          s: '마바유통 10월 급여대장 송부',
          p: '',
          an: ['급여대장.xlsx'],
          r: 0,
        },
        '12': {
          e: 'tax@chungsol.kr',
          f: '청솔담당자',
          s: '안부 인사드립니다',
          p: '사업장 언급 없는 일반 메일',
          an: [],
          r: 0,
        },
      },
    },
  });

  const tally = ctx.mbWhoTally();
  assert.equal(tally.cnt['김영희'], 1, '다라식당(다라식당앤구이) 메일은 김영희 담당으로 가야 한다');
  assert.equal(tally.cnt['이철수'], 1, '마바유통 메일은 이철수 담당으로 가야 한다');
  assert.equal(tally.none.n, 1, '어느 사업장인지 적히지 않은 공용 세무사무실 메일은 임의로 섞지 않고 남겨 둔다');
});

test('★★★ 사람 이름 오른쪽 빠른 클릭 버튼 렌더링 및 클릭 즉시 과거자료(전체 폴더 + 지난메일) 가져오기', async () => {
  const { ctx, menuEl, loadedBoxes, getOldLoaded } = makeSandbox({
    me: '김영희',
    msgs: {
      f_pay: {
        '20': { e: 'staff@saatech.kr', f: '사아실무자', s: '사아테크 급여자료 요청', p: '', r: 0 },
      },
    },
    onLoadMailBox: (c, slug, limit) => {
      if (slug === 'f_arc' && limit === 0) {
        c._mbMsgs.f_arc = {
          '99': { e: 'staff@saatech.kr', f: '사아실무자', s: '사아테크 봄 급여자료', r: 1 },
        };
      }
    },
    onOldLoad: (c) => {
      c._mbMsgs['*old'] = {
        '199': { e: 'staff@saatech.kr', f: '사아실무자', s: '사아테크 작년 연말정산', r: 1 },
      };
    },
  });

  ctx.mbOwnerOne('f_pay', '20', null);
  assert.match(menuEl.innerHTML, /mbOwnCoByIdx\(\d+,event\)/, '사람 이름 오른쪽에 🏢 사업장 빠른 버튼이 있어야 한다');
  assert.match(menuEl.innerHTML, /mbOwnAllByIdx\(\d+,event\)/, '사람 이름 오른쪽에 📥 과거까지 빠른 버튼이 있어야 한다');
  assert.match(menuEl.innerHTML, /mbOwnWkByIdx\(\d+,event\)/, '사람 이름 오른쪽에 📁 건 빠른 버튼이 있어야 한다');

  ctx.mbOwnCoByIdx(0, null);
  assert.match(menuEl.innerHTML, /사아테크/, '본인 담당 사업장 목록과 감지된 사업장에 사아테크가 바로 떠야 한다');
  ctx.mbOwnCoToggleTax(false);
  await ctx.mbOwnCoPick('co-104');

  assert.ok(loadedBoxes.some((x) => x.limit === 0), '사업장 클릭 직후 limit=0 으로 전체 폴더 과거 메일을 끌어와야 한다');
  assert.equal(getOldLoaded(), 1, '사업장 클릭 직후 📦 지난 메일(mbOldLoad)도 즉시 불러와야 한다');

  ctx.mbWhoBust();
  const tally = ctx.mbWhoTally();
  assert.equal(tally.cnt['김영희'], 3, '현재 메일(1) + 보관메일함 과거자료(1) + 지난메일 과거자료(1) = 총 3통이 즉시 잡혀야 한다');
});

test('★★★ 세무사무실 ↔ 본인 ↔ 사업장 연계 이중 체크 (배너 · 저장 모달 · 빠른 사업장 지정)', async () => {
  const { ctx, confirms, toasts, patchedJobs } = makeSandbox({
    me: '이철수',
    msgs: {
      f_pay: {
        '30': {
          e: 'tax@chungsol.kr',
          f: '세무법인청솔',
          s: '사아테크 원천징수 자료',
          p: '',
          an: ['사아테크_원천징수이행상황신고서.pdf'],
          r: 0,
        },
      },
    },
  });

  const row = ctx.mbOneRow('f_pay', '30');
  const tc = ctx.taxCheckOf(row);
  assert.equal(tc.kind, 'known', '등록된 세무사무실 주소를 알아봐야 한다');
  assert.ok(tc.extraCo && tc.extraCo.id === 'co-104', '첨부파일명에서 아직 이 세무사무실에 안 묶인 사아테크를 찾아내야 한다');

  const strip = ctx.taxStripHtml(row);
  assert.match(strip, /추가 연계/, '미연계 사업장이 감지되면 상단 세무 배너에 추가 연계 안내가 떠야 한다');

  // 모달 저장 시 [한 번 더 확인] 체크박스를 안 켜면 저장이 차단되어야 한다
  ctx.taxSaveOpen('tax@chungsol.kr', '세무법인청솔', 'co-104');
  assert.equal(ctx.taxSaveNeedsVerify(ctx.state.taxSave), true, '추가/다중 사업장 세무 연계 시 한 번 더 확인 체크가 필수여야 한다');
  await ctx.taxSaveDo();
  assert.equal(patchedJobs.length, 0, '확인 체크 전에는 ERP 세무 이메일을 저장하면 안 된다');
  assert.ok(toasts.some((m) => m.includes('확인란에 먼저 체크')), '확인 체크 안내 토스트가 떠야 한다');

  // 확인 체크 후에는 사아테크(co-104)의 빈 taxEmail 칸에 정상 저장된다
  ctx.state.taxSave.verified = true;
  await ctx.taxSaveDo();
  assert.ok(patchedJobs.some((j) => j.coId === 'co-104' && j.patch.taxEmail === 'tax@chungsol.kr'), '확인 체크 후 미연계 사업장에 taxEmail이 저장되어야 한다');

  // 빠른 사업장 지정에서도 다른 사람 사업장을 고르거나 세무사무실 연계 시 confirm 으로 한 번 더 체크한다
  ctx.state.mbOwnOne = { slug: 'f_pay', uid: '30' };
  ctx.mbOwnCoOpen('이철수', null);
  await ctx.mbOwnCoPick('co-101');
  assert.ok(confirms.some((m) => m.includes('일치 여부를 한 번 더 확인')), '본인/선택 담당자와 ERP 사업장 담당자가 다르면 경고 확인창이 떠야 한다');
  assert.ok(confirms.some((m) => m.includes('세무사무실 · 사업장 연계 한 번 더 확인')), '세무사무실 연계 시 최종 연계 확인창이 한 번 더 떠야 한다');
});
