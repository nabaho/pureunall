'use strict';
/* 🏛 지역공동기금 설립 요청서류 리스트 · 기업별 OX 수합 체크 · 엑셀 · 메일 발송 검증
 * ⚠ 공개 저장소 규칙: 실제 상호·실제 인명·실제 이메일·실제 사업자번호(123- 시작 예시만 허용)는 절대 사용하지 않는다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const JSZIP_SRC = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'jszip.min.js'), 'utf8');

let _cachedJSZip = null;
function getJSZip() {
  if (_cachedJSZip) return _cachedJSZip;
  const zCtx = { console, Date, Math, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Uint8Array, ArrayBuffer, DataView, setTimeout, clearTimeout };
  zCtx.window = zCtx;
  zCtx.self = zCtx;
  vm.createContext(zCtx);
  vm.runInContext(JSZIP_SRC, zCtx);
  _cachedJSZip = zCtx.JSZip;
  assert.ok(_cachedJSZip, 'vendor/jszip.min.js 로드 확인');
  return _cachedJSZip;
}

function grabFn(name) {
  const idx = SRC.indexOf('function ' + name + '(');
  assert.ok(idx >= 0, '함수를 찾을 수 없음: ' + name);
  let d = 0, on = false;
  for (let i = idx; i < SRC.length; i++) {
    if (SRC[i] === '{') { d++; on = true; }
    else if (SRC[i] === '}') { d--; if (on && d === 0) return SRC.slice(idx, i + 1); }
  }
  throw new Error('함수 끝을 찾을 수 없음: ' + name);
}

function buildWorld(opts = {}) {
  const rgpStart = SRC.indexOf('var RGP=null;');
  const rgpEnd = SRC.indexOf('var SDC=null;', rgpStart);
  assert.ok(rgpStart > 0 && rgpEnd > rgpStart, 'RGP 블록 경계를 찾을 수 없음');
  const rgpCode = [
    grabFn('_digits'),
    grabFn('_cardFundKey'),
    grabFn('_siteCardMatch'),
    SRC.slice(rgpStart, rgpEnd)
  ].join('\n');

  const db = {};
  function getAt(p) {
    const parts = String(p || '').split('/').filter(Boolean);
    let cur = db;
    for (const k of parts) {
      if (!cur || typeof cur !== 'object') return null;
      cur = cur[k];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
  }
  function setAt(p, val) {
    const parts = String(p || '').split('/').filter(Boolean);
    let cur = db;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    const last = parts[parts.length - 1];
    if (val === null || val === undefined) delete cur[last];
    else cur[last] = JSON.parse(JSON.stringify(val));
  }

  let pushSeq = 0;
  const toasts = [];
  const audits = [];
  const openedMails = [];
  const popupUrls = [];
  const replacedUrls = [];
  const exportedWorkbooks = [];
  const els = {};
  let modal = null;
  let failNextUpdate = !!opts.failNextUpdate;

  /* 동일 출처 메일 쓰기 창 모의 객체 — ready=true면 즉시 puMailComposeTo 수신, false면 창 로드 후 지연 수신 */
  const mailPopup = {
    closed: false,
    location: {
      _href: '',
      get href() { return this._href; },
      set href(u) { this._href = u; popupUrls.push(u); }
    },
    history: {
      replaceState(_s, _t, u) { replacedUrls.push(u); }
    },
    focus() {}
  };
  if (opts.popupDeferred !== true) {
    mailPopup.puMailComposeTo = (m) => { openedMails.push(m); return true; };
  }

  const ctx = {
    console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Uint8Array, ArrayBuffer,
    TextDecoder, TextEncoder,
    parseInt, parseFloat, isFinite, isNaN, setTimeout, clearTimeout,
    NS: 'fund_erp',
    S: { fundId: 'F_JEJU', view: 'setup', tab: 'sites', user: '담당노무사', sitesFor: null },
    SD: { sel: 'F_JEJU', pop: true, sites: {} },
    HELP: { 'setup.regprep': { t: '지역공동기금 도움말', h: '<p>도움말 본문</p>' } },
    PM_MAIL_RE: /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]+$/,
    funds: opts.funds || {
      F_JEJU: { name: '가상제주공동근로복지기금1호', short_name: '가상제주1호', name_temp: true, fund_type: '공동', region: '제주', setup_stage: '설립준비', mgr_main: { name: '김노무' } },
      F_GG: { name: '가상경기공동근로복지기금1호', short_name: '가상경기1호', fund_type: '공동', region: '경기북부', setup_stage: '설립준비', mgr_main: { name: '박노무' } },
      F_INTRA: { name: '가상사내근로복지기금', short_name: '가상사내', fund_type: '사내', setup_stage: '설립준비' }
    },
    window: {
      open(u) {
        if (u) popupUrls.push(u);
        return mailPopup;
      }
    },
    FileReader: class MockFileReader {
      readAsArrayBuffer(file) {
        setTimeout(() => {
          if (this.onload) this.onload({ target: { result: file._buf } });
        }, 1);
      }
    },
    _loadJsZip: () => Promise.resolve(getJSZip()),
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    ymd: () => '2026-11-22',
    num: (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) && n !== 0 ? Math.round(n) : 0; },
    isTrashed: (f) => !!(f && f.deleted),
    loadingHTML: (m) => '<div class="loading">' + (m || '') + '</div>',
    toast: (m, lv) => { toasts.push({ m, lv: lv || '' }); },
    _audit: (fid, kind, detail) => { audits.push({ fid, kind, detail }); },
    $: (id) => els[id] || null,
    document: { activeElement: null },
    showModal: (html, o) => {
      modal = { html, opts: o || {} };
      els.modalbg = {
        attrs: { role: 'dialog', 'aria-modal': 'true' },
        setAttribute(k, v) { this.attrs[k] = v; }
      };
      els.modalbox = {
        _h: html,
        scrollTop: 0,
        attrs: {},
        setAttribute(k, v) { this.attrs[k] = v; },
        get innerHTML() { return this._h; },
        set innerHTML(v) { this._h = v; },
        querySelector(q) { return { focus() { ctx._focused = q; } }; }
      };
    },
    closeM: () => {
      const m = modal;
      modal = null;
      els.modalbg = null;
      els.modalbox = null;
      if (m && m.opts && m.opts.onclose) m.opts.onclose();
    },
    confirmM: () => Promise.resolve(true),
    sdPop: () => { ctx._sdPopCalled = true; },
    _pmCopy: (t) => { ctx._copied = t; return Promise.resolve(true); },
    _sdcMaskRrn: (s) => String(s == null ? '' : s).replace(/(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))[\s\-]*([1-8])\d{6}(?!\d)/g, '$1$2-$3******'),
    _primaryContact: (s) => {
      const list = Array.isArray(s && s.contacts) ? s.contacts : [];
      const idx = list.findIndex((c) => c && c.isPrimary);
      return { list, idx: idx >= 0 ? idx : 0 };
    },
    _siteWrep: (s) => ({ name: (s && s.worker_rep) || '', doc: !!(s && s._wrepDoc) }),
    _loadSites: (fid) => Promise.resolve(opts.sitesByFund ? JSON.parse(JSON.stringify(opts.sitesByFund[fid] || [])) : []),
    loadCardIdx: () => Promise.resolve(opts.cardIdx || []),
    XLSX: {
      read: () => { throw new Error('보안 정책 위반: 구버전 XLSX.read는 절대 호출하면 안 됩니다'); },
      utils: {
        book_new: () => ({ SheetNames: [], Sheets: {} }),
        aoa_to_sheet: (aoa) => ({ aoa }),
        book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; }
      },
      writeFile: (wb, fileName) => { exportedWorkbooks.push({ wb, fileName }); }
    },
    fbDb: {
      ref: (p) => ({
        once: () => Promise.resolve({ val: () => getAt(p) }),
        set: (v) => {
          if (failNextUpdate) { failNextUpdate = false; return Promise.reject(new Error('DB 권한 거부')); }
          setAt(p, v);
          return Promise.resolve();
        },
        update: (obj) => {
          if (failNextUpdate) { failNextUpdate = false; return Promise.reject(new Error('DB 쓰기 실패')); }
          Object.keys(obj || {}).forEach((k) => setAt(p + '/' + k, obj[k]));
          return Promise.resolve();
        },
        push: () => {
          const key = 'pushed_' + (++pushSeq);
          return { key, set: (v) => { setAt(p + '/' + key, v); return Promise.resolve(); } };
        }
      })
    }
  };

  vm.createContext(ctx);
  vm.runInContext(rgpCode, ctx);
  return {
    ctx, db, getAt, setAt, toasts, audits, openedMails, popupUrls, replacedUrls, mailPopup, exportedWorkbooks, els,
    setFailNextUpdate: (v) => { failNextUpdate = !!v; },
    getModal: () => modal
  };
}

const flush = (ms = 15) => new Promise((r) => setTimeout(r, ms));

test('1. 배선 점검 — 설립중 기금 대시보드 · 설립 진행판 팝업 · 참여사업장 탭(0곳 포함) · 서식 탭 · 도움말에 [🏛 지역공동기금 서류·OX체크] 단추가 연결되어 있다', () => {
  assert.match(grabFn('renderSetupDash'), /rgpOpen\(this\.dataset\.fid\)[^>]*>🏛 지역공동기금 서류·OX체크<\/button>/, '설립중 기금 대시보드 상단 버튼 확인');
  assert.match(grabFn('_sdBoard'), /rgpOpen\(this\.dataset\.fid\)[^>]*>🏛 지역공동기금 서류·OX체크<\/button>/, '설립 진행판 팝업 상단 버튼 확인');
  const sitesFn = grabFn('sitesTab');
  assert.equal((sitesFn.match(/rgpOpen\(this\.dataset\.fid\)/g) || []).length, 2, '참여사업장 머리줄 및 0곳 빈안내 양쪽 배선 확인');
  assert.match(grabFn('reqDocsBoxHTML'), /rgpOpen\(this\.dataset\.fid\)[^>]*>🏛 지역공동기금 서류·OX체크<\/button>/, '서식 탭 첨부서류 상단 버튼 확인');
  assert.ok(SRC.includes("'setup.regprep':{"), 'HELP 사전 등록 확인');
});

test('2. 주관기관(예: 제주상공회의소) 메일 생성 — 초기 0개사 안내 모드 및 다수 참여기업 OX 요약 모드 · 등기이사 노1·사1 선택 추가 검증', async () => {
  const w0 = buildWorld({
    cardIdx: [{ k: 'card', c: '제주상공회의소', n: '강담당', ti: '과장', e: 'jeju-chamber@example.test' }]
  });
  await w0.ctx.rgpOpen('F_JEJU');
  await flush();

  const G = w0.ctx.RGP;
  assert.equal(G.agency.org, '제주상공회의소', '제주 기금은 제주상공회의소를 기본 주관기관으로 자동 제안');
  assert.equal(G.agency.email, 'jeju-chamber@example.test', '기업정보함에 상공회의소 명함이 있으면 이메일 자동 연결');

  const mail0 = w0.ctx.rgpBuildAgencyMail(G.f, { agency: G.agency, docSel: G.docSel, opts: G.opts, rows: G.rows });
  assert.match(mail0.subject, /\[푸른노무법인\] 제주상공회의소 가상제주공동근로복지기금1호\(가칭\) 설립 참여기업 요청서류 및 수합 체크리스트 안내/);
  assert.match(mail0.body, /제주상공회의소 강담당 과장님 안녕하세요\./);
  assert.match(mail0.body, /■ 1\. 기업 설립 시 준비서류 \(기초자료·지원요건·일반도장\)/, '설립준비 서류 단락 기본 포함');
  assert.match(mail0.body, /■ 2\. 노동부 설립인가 필요서류/, '노동부 인가 서류 단락 기본 포함');
  assert.match(mail0.body, /■ 3\. 법인 설립등기 필요서류 — 등기자 딱 2명\(사용자 1명, 근로자 1명\)만 필요/, '등기 서류도 기본값(incReg=true)으로 한 번에 요청');
  assert.match(mail0.body, /※ 인감증명서·개인인감도장은 실제 법인 등기할 사람 딱 2명\(사용자 1명, 근로자 1명\)만 필요합니다\. 나머지 참여기업·위원은 인감증명서·인감도장이 전혀 필요 없습니다/);
  assert.match(mail0.body, /고용보험 사업장 자격취득자 명부 1부/);
  assert.match(mail0.body, /일반 막도장 또는 막도장 사용동의서 \(노 1부, 사 1부 · 인감증명·인감도장 불필요\)/);
  assert.match(mail0.body, /설립준비위원 재직증명서 \(대표자 1부, 근로자대표 1부 · 노 1부, 사 1부\)/);
  assert.match(mail0.body, /실무 담당자 성명·직위·휴대폰·이메일\(명함\)/);
  assert.match(mail0.body, /\[등기자 딱 2명만 — 사용자 1명, 근로자 1명\] 개인인감증명서 각 1부 \(발급 3개월 이내 · 나머지 인원은 인감증명 불필요\)/);
  assert.match(mail0.body, /\[등기자 딱 2명만 — 사용자 1명, 근로자 1명\] 주민등록등본 또는 초본 각 1부/);
  assert.match(mail0.body, /\[등기자 딱 2명만 — 사용자 1명, 근로자 1명\] 신분증 사본 및 개인인감도장 각 1부 \(나머지 인원은 인감도장 불필요\)/);
  assert.ok(!mail0.body.includes('기금출연확인서 날인본'), '출연확인서 날인본은 기본 요청에서 해제되어 있음');
  assert.match(mail0.body, /첨부 수합표 엑셀에 표시해 회신/, '참여기업 0곳일 때 수합표 회신 안내 출력');

  /* 등기서류 체크 해제 시 본문에서 제외 가능 확인 후 다시 켜기 */
  w0.ctx.rgpOpt('incReg', false);
  const mailNoReg = w0.ctx.rgpBuildAgencyMail(G.f, { agency: G.agency, docSel: G.docSel, opts: G.opts, rows: G.rows });
  assert.ok(!mailNoReg.body.includes('개인인감증명서 각 1부'), 'incReg=false 해제 시 등기서류 단락 제외 가능');
  w0.ctx.rgpOpt('incReg', true);

  /* 주관기관 메일 발송 창 호출 및 주소창 개인정보 스크러빙 확인 */
  w0.ctx.rgpComposeAgency();
  assert.equal(w0.openedMails.length, 1);
  assert.equal(w0.openedMails[0].to, 'jeju-chamber@example.test');
  assert.deepEqual(w0.replacedUrls, ['pu-cards.html?view=mail'], '즉시 전달 후에도 팝업 주소창에서 개인정보 쿼리를 제거');
});

test('3. 기존 수합 엑셀 파서(rgpParseSheetRows) — 중복 사업자등록증 열 판별 · 고용보험 1~12월 평균 산출 · 개인사업자 면제(-) · 주민번호/비밀번호 원천 차단', () => {
  const { ctx } = buildWorld();

  /* 유형 A: 충남형 구비서류 제출현황 (사업자등록증 번호열 + 사업자등록증 제출열 공존 + 아이디/비밀번호/주민번호 혼재) */
  const chungnamAoa = [
    ['지역공동복지기금 참여 예정업체 현황'],
    ['지역', '번호', '상호', '대표자', '주민번호', '사업자등록증', '근로자대표', '확정', '담당자', '직책', '휴대폰번호', '이메일', '참여신청서', '고용보험가입자명부(연간)', '사업자등록증', '중소기업확인서', '법인등기부등본', '재직증명서2부', '막도장사용동의서2부', '직전년도매출액서류', '아이디', '비밀번호'],
    ['제주시', '1', '(주)가상감귤테크', '김대표', '750101-1000000', '123-81-00111', '박노조', '18', '최총무', '과장', '010-0000-1111', 'choi@gamgyul.test', '○', '제출', '제출', '○', '○', '○', '미제출', '25억', 'user01', 'dummy_pw_1'],
    ['', '2', '가상돌하르방상사', '이대표', '800202-2000000', '123-12-00222', '정근로', '7', '이대표', '대표', '010-0000-2222', 'lee@harubang.test', '○', '○', '○', '보완', '개인사업자', '', '○', '없음', 'user02', 'dummy_pw_2'],
    ['', '', '합계', '', '', '', '', '25']
  ];

  const rowsA = ctx.rgpParseSheetRows(chungnamAoa);
  assert.equal(rowsA.length, 2, '합계 줄은 제외하고 실제 기업 2곳만 추출');
  assert.equal(rowsA[0].biz_no, '123-81-00111', '앞쪽 사업자등록증 열은 10자리 사업자번호로 인식');
  assert.equal(rowsA[0].ox.bizreg, 'O', '뒤쪽 사업자등록증 열은 제출여부(O)로 인식');
  assert.equal(rowsA[0].ox.stamp, 'X', '미제출은 X로 정규화');
  assert.equal(rowsA[0].ox.fin_sales, 'O', '매출액 서류 텍스트(25억)는 O로 인식');
  assert.equal(rowsA[1].area, '제주시', '병합·생략된 지역명은 직전 행 지역을 승계');
  assert.equal(rowsA[1].ox.corpreg, '-', '개인사업자는 법인등기부 면제(-) 처리');
  assert.equal(rowsA[1].ox.smecert, '△', '보완은 △로 정규화');
  const dumped = JSON.stringify(rowsA);
  assert.ok(!dumped.includes('1000000') && !dumped.includes('dummy_pw') && !dumped.includes('user01'), '주민등록번호·아이디·비밀번호는 메모리·저장 객체에 절대 유입되지 않음');

  /* 유형 B: 경기형 참여신청 명단 (고용보험 1~12월 열 → 월평균 자동 계산 및 ei_list=O, 소기업/중기업 → smecert=O) */
  const gyeonggiAoa = [
    ['[공동근로복지기금 참여신청 명단]'],
    ['구분', '기업명', '중소기업확인서', '사업자번호', '대표자', '담당자', '직위', '담당자 핸드폰', '이메일주소', '고용보험 (1)', '고용보험 (2)', '고용보험 (3)', '고용보험 (4)'],
    ['1', '주식회사 한라산전', '소기업', '123-86-00333', '오대표', '한실장', '실장', '010-0000-3333', 'han@halla.test', '10', '12', '14', '12']
  ];
  const rowsB = ctx.rgpParseSheetRows(gyeonggiAoa);
  assert.equal(rowsB.length, 1);
  assert.equal(rowsB[0].emp, 12, '고용보험 월별 인원 평균(12명) 자동 산출');
  assert.equal(rowsB[0].ox.ei_list, 'O', '고용보험 월별 인원이 있으면 고용보험명부 O 처리');
  assert.equal(rowsB[0].ox.smecert, 'O', '소기업 확인 표기는 중소기업확인서 O 처리');
});

test('4. OX 원클릭 토글(무깜빡임) · 기존 자료 자동반영 · 개별 기업 미제출(X) 메일 발송 · 3시트 엑셀 내보내기 · 접근성/XSS 방어', async () => {
  const w = buildWorld({
    sitesByFund: {
      F_JEJU: [
        { _id: 'S1', name: '(주)가상해양<script>alert(1)</script>', ceo: '김해양', worker_rep: '박선원', biz_no: '123-81-00555', company_size: 15, contacts: [{ name: '정과장', position: '과장', mobile: '010-0000-5555', email: 'jung@ocean.test', isPrimary: true }] },
        { _id: 'S2', name: '가상오름식품', ceo: '이오름', worker_rep: '최현장', biz_no: '123-11-00666', company_size: 8, contacts: [{ name: '송대리', position: '대리', mobile: '010-0000-6666', email: 'song@oreum.test', isPrimary: true }] }
      ]
    },
    cardIdx: [
      { k: 'biz', c: '(주)가상해양', bz: '1238100555', ceo: '김해양' }
    ]
  });
  w.setAt('fund_erp/site_doc_chk/F_JEJU/S1/inka_wrep', { recv: true, ok: { mode: 'manual', at: '2026-11-20' } });

  await w.ctx.rgpOpen('F_JEJU');
  await flush();

  const html = w.els.modalbox.innerHTML;
  assert.ok(!html.includes('<script>alert(1)') && html.includes('&lt;script&gt;alert(1)'), '기업명 스크립트 삽입 차단 확인');
  assert.equal(w.els.modalbg.attrs.role, 'dialog');
  assert.equal(w.els.modalbg.attrs['aria-modal'], 'true');
  assert.equal(w.els.modalbg.attrs['aria-label'], '지역공동기금 설립 요청서류 및 OX 수합 체크');
  assert.equal(w.els.modalbox.attrs.role, undefined, '#modalbg와 #modalbox에 role=dialog 중복 부여 방지');
  assert.ok(!html.includes('class="mo"'), '600px 이하 모바일에서 이메일을 숨기는 .mo 클래스를 쓰지 않음');
  assert.match(html, /accept="\.xlsx,\.csv"/, '구형 .xls를 제외한 .xlsx,.csv 전용 입력 제한 확인');
  assert.match(html, /class="center rgp-cell" data-lbl="고용보험명부\(연간\)"/, '모바일 카드 전환 시 항목명 표시용 data-lbl 부여 확인');
  const bareInputs = [...html.matchAll(/<(input|select|textarea)\b[^>]*>/g)].map((m) => m[0]).filter((tag) => !/aria-label=/.test(tag));
  assert.deepEqual(bareInputs, [], '모든 입력칸에 aria-label이 있어야 한다: ' + bareInputs.join(' | '));

  /* S1은 기업정보함 사업자등록증(bizreg=O), site_doc_chk 재직증명(wrep=O), 담당자+메일+근로자대표(contact_info=O) 자동 추론 */
  const r0 = w.ctx.RGP.rows[0];
  assert.equal(r0.effOx.bizreg, 'O');
  assert.equal(r0.effOx.wrep, 'O');
  assert.equal(r0.effOx.contact_info, 'O');
  assert.equal(r0.effOx.stamp, 'X');

  /* 칸 클릭 토글 시 모달 전체를 다시 그리지 않고 RTDB에 즉시 기록 */
  const beforeHtml = w.els.modalbox.innerHTML;
  w.ctx.rgpToggleOx('g0', 'stamp');
  assert.equal(w.els.modalbox.innerHTML, beforeHtml, 'OX 토글이 모달 전체를 다시 그려 스크롤을 초기화하지 않음');
  assert.equal(r0.effOx.stamp, 'O');
  assert.equal(w.getAt('fund_erp/regional_prep/F_JEJU/ox/S1/stamp'), 'O');

  /* 법인등기부 칸은 X → O → △ → -(개인) → X 순환 허용 */
  assert.equal(r0.effOx.corpreg, 'X');
  w.ctx.rgpToggleOx('g0', 'corpreg'); assert.equal(r0.effOx.corpreg, 'O');
  w.ctx.rgpToggleOx('g0', 'corpreg'); assert.equal(r0.effOx.corpreg, '△');
  w.ctx.rgpToggleOx('g0', 'corpreg'); assert.equal(r0.effOx.corpreg, '-');

  /* 개별 기업(S1) 미제출 요청 메일: O 항목과 -(개인) 항목은 요청에서 빠지고 미제출(X) 항목만 요청됨 */
  w.ctx.rgpComposeSite('g0');
  assert.equal(w.openedMails.length, 1);
  const sMail = w.openedMails[0];
  assert.equal(sMail.to, 'jung@ocean.test');
  assert.ok(!sMail.body.includes('사업자등록증 사본 1부'), '이미 O인 사업자등록증은 미제출 목록에서 제외');
  assert.ok(!sMail.body.includes('법인등기부등본 1부'), '개인 면제(-) 처리된 법인등기부는 미제출 목록에서 제외');
  assert.match(sMail.body, /고용보험 사업장 자격취득자 명부 1부/, '아직 X인 고용보험명부는 요청 목록에 포함');
  assert.match(sMail.body, /등기자 딱 2명\(사용자 1명, 근로자 1명\)만 필요/, '개별 기업 메일에도 등기자 딱 2명만 인감증명·인감도장 필요 안내 포함');
  assert.match(sMail.body, /제출 확인 완료\(O\): 담당자·메일·노대표, 일반막도장·동의서\(노1·사1\), 사업자등록증, 재직증명\(노1·사1\)/);

  /* [▶ 다음 미비 기업 메일 쓰기] 호출 시 S2(song@oreum.test)로 이동 */
  w.ctx.rgpComposeNextSite();
  assert.equal(w.openedMails.length, 2);
  assert.equal(w.openedMails[1].to, 'song@oreum.test');

  /* 3시트 엑셀(.xlsx) 내보내기 구조 확인 */
  w.ctx.rgpExportXlsx();
  assert.equal(w.exportedWorkbooks.length, 1);
  assert.deepEqual(w.exportedWorkbooks[0].wb.SheetNames, ['1_요청서류리스트', '2_기업별_OX수합현황', '3_도장제작명단']);
  const sealSheet = w.exportedWorkbooks[0].wb.Sheets['3_도장제작명단'].aoa;
  assert.match(JSON.stringify(sealSheet[1]), /사각형 법인직인 \(2\.5cm × 2\.5cm\)/, '도장제작명단 시트에 법인직인 규격 포함');
});

test('5. 엑셀 반영 시 직전매출액(sales)·주담당자 하위필드 보강·사업자번호 불일치 오매칭 차단·300행 상한 및 잘못된 이메일 경고', async () => {
  const w = buildWorld({
    sitesByFund: {
      F_JEJU: [
        {
          _id: 'S_EXIST', name: '(주)한라물산', biz_no: '123-81-00777', ceo: '김한라',
          contacts: [
            { name: '보조담당', email: 'sub@halla.test', isPrimary: false },
            { name: '박담당', email: '', isPrimary: true }
          ]
        },
        { _id: 'S_GONE', name: '탈퇴예전기업', biz_no: '123-81-00888', status: 'inactive' }
      ]
    },
    cardIdx: [
      /* 상호는 '(주)한라물산'으로 같지만 사업자번호(123-81-99999)가 다른 타기업 카드 — 절대 매칭되면 안 됨 */
      { k: 'biz', c: '(주)한라물산', bz: '123-81-99999', ceo: '타사대표', e: 'wrong-company@other.test' }
    ]
  });
  await w.ctx.rgpOpen('F_JEJU');
  await flush();

  assert.equal(w.ctx.RGP.rows.length, 1, '비활성(inactive) 사업장은 목록에서 제외');
  assert.equal(w.ctx.RGP.rows[0].bizMatched, false, '사업자번호가 다른 동명 기업정보함 카드는 실제 _siteCardMatch에서도 차단');
  assert.equal(w.ctx.RGP.rows[0].email, '', '타사 카드의 이메일을 끌어오지 않음');

  /* 1) 같은 상호 '(주)한라물산'이라도 사업자번호가 다르면(123-81-00999) 별도 기업으로 분리하고,
        사업자번호가 일치하는 행(123-81-00777)은 주담당자(contacts[1]) 빈 이메일·전화번호만 하위 경로로 보강한다 */
  const parsed = [
    { area: '제주시', name: '(주)한라물산', biz_no: '123-81-00777', ceo: '김한라', wrep: '이노조', emp: 22, sales: '48억', cname: '박담당', cpos: '팀장', phone: '010-0000-7777', email: 'park@halla.test', eiFromExcel: true, ox: { apply: 'O', bizreg: 'O' } },
    { area: '서귀포시', name: '(주)한라물산', biz_no: '123-81-00999', ceo: '다른대표', wrep: '다른노조', emp: 9, sales: '12억', cname: '최담당', cpos: '대리', phone: '010-0000-9999', email: 'choi@otherhalla.test', eiFromExcel: false, ox: { apply: 'O' } }
  ];
  await w.ctx._rgpApplyImportedRows(w.ctx.RGP, 'F_JEJU', parsed, '구비서류 제출현황', 'test.xlsx');
  await flush();

  assert.equal(w.ctx.RGP.rows.length, 2, '사업자번호가 다른 동명 기업은 덮어쓰지 않고 별도 행으로 분리');
  const rExist = w.ctx.RGP.rows.find((r) => r.id === 'S_EXIST');
  assert.equal(rExist.email, 'park@halla.test', '주담당자(contacts[1])에 비어 있던 이메일이 보강됨');
  assert.equal(rExist.site.contacts[0].email, 'sub@halla.test', '기존 다른 담당자(contacts[0])는 손상 없이 그대로 유지됨');
  assert.equal(w.getAt('fund_erp/sites/F_JEJU/S_EXIST/contacts/1/email'), 'park@halla.test', '배열 통째 덮어쓰기 대신 하위 필드 경로로 기록');
  assert.equal(rExist.sales, '48억', 'syncSitesOnImport=true 일 때도 직전매출액(sales)이 유실되지 않음');

  /* 2) + 기업 한 줄 추가 시 잘못된 이메일 형식 차단 */
  w.els.rgpNewNm = { value: '신규기업' };
  w.els.rgpNewEm = { value: 'invalid-email', focus() {} };
  const beforeLen = w.ctx.RGP.rows.length;
  w.ctx.rgpAddRowInline();
  await flush();
  assert.equal(w.ctx.RGP.rows.length, beforeLen, '잘못된 이메일 형식이면 추가하지 않고 경고');
  assert.ok(w.toasts.some((t) => /올바른 담당자 이메일/.test(t.m) && t.lv === 'warn'));

  /* 3) 300행 초과 배열 파싱 시 _truncated 플래그 표시 */
  const bigAoa = [['기업명', '사업자번호']];
  for (let i = 1; i <= 305; i++) bigAoa.push(['가상기업' + i, '']);
  const capped = w.ctx.rgpParseSheetRows(bigAoa);
  assert.equal(capped.length, 300);
  assert.equal(capped._truncated, true);
});

test('6. 보안 검증 — 자체 OOXML(.xlsx)/CSV 리더(XLSX.read 미사용) · DB 실패 시 메모리 오염 0 · 메일 폴백 URL 개인정보 무노출', async () => {
  const JSZip = getJSZip();

  /* 1) 실제 ZIP 구조의 .xlsx 버퍼 생성 (빈 스타일 셀 <c r="A2" s="1"/>, 세로 병합 머리글 C1:C2, <rPh> 후리가나 포함) */
  const z = new JSZip();
  z.file('xl/workbook.xml', '<?xml version="1.0"?><workbook><sheets><sheet name="구비서류 제출현황" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  z.file('xl/sharedStrings.xml', '<?xml version="1.0"?><sst>'
    + '<si><t>기업명</t><rPh><t>기</t></rPh></si>'
    + '<si><t>사업자번호</t></si>'
    + '<si><t>참여신청서</t></si>'
    + '<si><t>이메일</t></si>'
    + '<si><t>(주)가상우주항공 &amp; 파트너스</t></si>'
    + '<si><t>123-85-00444</t></si>'
    + '<si><t>○</t></si>'
    + '<si><t>astro@space.test</t></si>'
    + '</sst>');
  z.file('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet><sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>구비서류</t></is></c><c r="D1" t="s"><v>3</v></c></row>'
    + '<row r="2"><c r="A2" s="1"/><c r="B2" s="1"/><c r="C2" t="s"><v>2</v></c><c r="D2" s="1"/></row>'
    + '<row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" t="s"><v>5</v></c><c r="C3" t="s"><v>6</v></c><c r="D3" t="s"><v>7</v></c></row>'
    + '</sheetData><mergeCells><mergeCell ref="A1:A2"/><mergeCell ref="B1:B2"/><mergeCell ref="D1:D2"/></mergeCells></worksheet>');
  const xlsxU8 = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

  const w = buildWorld({ popupDeferred: true });
  await w.ctx.rgpOpen('F_JEJU');
  await flush();

  /* 2) DB 쓰기 실패 시 메모리(G.sites / G.regData) 오염이 전혀 없어야 한다 */
  w.setFailNextUpdate(true);
  await w.ctx.rgpImportFile({ files: [{ name: '제주수합.xlsx', size: xlsxU8.byteLength, _buf: xlsxU8.buffer }], value: 'x' });
  await flush(30);
  assert.equal(w.ctx.RGP.sites.length, 0, 'DB 저장 실패 시 G.sites 메모리에 반영되지 않아야 함');
  assert.equal(w.ctx.RGP.rows.length, 0, 'DB 저장 실패 시 화면 행도 추가되지 않아야 함');
  assert.ok(w.toasts.some((t) => /엑셀 반영 저장 실패/.test(t.m) && t.lv === 'err'));

  /* 3) DB 정상 상태에서 동일 .xlsx 재반영 — XLSX.read를 전혀 부르지 않고 정상 파싱·저장 */
  await w.ctx.rgpImportFile({ files: [{ name: '제주수합.xlsx', size: xlsxU8.byteLength, _buf: xlsxU8.buffer }], value: 'x' });
  await flush(30);
  assert.equal(w.ctx.RGP.rows.length, 1, 'XLSX.read 없이 자체 OOXML 리더로 1개사 정상 반영');
  assert.equal(w.ctx.RGP.rows[0].name, '(주)가상우주항공 & 파트너스', '<rPh> 후리가나 제거 및 &amp; 복원 확인');
  assert.equal(w.ctx.RGP.rows[0].biz_no, '123-85-00444');
  assert.equal(w.ctx.RGP.rows[0].effOx.apply, 'O', '2줄 세로 병합 머리글 아래 참여신청서 ○ 정상 인식');

  /* 4) XML <!ENTITY> 공격 파일 및 구형 .xls 차단 확인 */
  const zEvil = new JSZip();
  zEvil.file('xl/workbook.xml', '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]><workbook/>');
  const evilU8 = await zEvil.generateAsync({ type: 'uint8array' });
  await assert.rejects(() => w.ctx.rgpReadWorkbookSafe(evilU8, 'evil.xlsx'), /엔티티/);
  await assert.rejects(() => w.ctx.rgpReadWorkbookSafe(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 1, 2, 3, 4]), 'legacy.xls'), /구형 \.xls/);

  /* 5) CSV 파일 리더 정상 동작 확인 */
  const csvBytes = new TextEncoder().encode('기업명,사업자번호,담당자,이메일,참여신청서\r\n"가상성산일출(주)",123-86-00555,오과장,oh@sunrise.test,O\r\n');
  const csvSheets = await w.ctx.rgpReadWorkbookSafe(csvBytes, 'list.csv');
  const csvRows = w.ctx.rgpParseSheetRows(csvSheets[0].aoa);
  assert.equal(csvRows.length, 1);
  assert.equal(csvRows[0].name, '가상성산일출(주)');
  assert.equal(csvRows[0].ox.apply, 'O');

  /* 6) 메일 쓰기 창이 아직 안 열려 있을 때 폴백 URL에 이메일·이름·제목이 절대 포함되지 않고 로드 후 전달됨 */
  w.ctx.rgpComposeSite('g0');
  assert.deepEqual(w.popupUrls, ['pu-cards.html?view=mail'], '폴백 URL에 @, to=, name=, subject= 가 일절 노출되지 않음');
  assert.equal(w.openedMails.length, 0, '창 로드 전에는 대기');
  w.mailPopup.puMailComposeTo = (m) => { w.openedMails.push(m); return true; };
  await flush(260);
  assert.equal(w.openedMails.length, 1, '창 로드 완료 후 동일 출처 참조로 수신자·제목·본문 자동 채움');
  assert.equal(w.openedMails[0].to, 'astro@space.test');
});
