/* 공동기금·사내기금 사업장 제출서류 체크리스트 메일 요청 · 메일함 수신 자동체크 · 내용검토 자동/수동 확인 검사
 * ⚠ 공개 저장소 규칙: 실제 기금명·실제 상호·실제 인명·실제 사업자번호를 절대 쓰지 않는다(가상 데이터만 사용).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const idx = SRC.indexOf('function ' + name + '(');
  assert.ok(idx >= 0, '함수를 찾을 수 없음: ' + name);
  let d = 0, started = false;
  for (let i = idx; i < SRC.length; i++) {
    if (SRC[i] === '{') { d++; started = true; }
    else if (SRC[i] === '}') { d--; if (started && d === 0) return SRC.slice(idx, i + 1); }
  }
  throw new Error('함수 끝을 찾을 수 없음: ' + name);
}

function buildSandbox(overrides = {}) {
  const sdcStart = SRC.indexOf('var SDC=null;');
  const sdcEnd = SRC.indexOf('function sitesTab(){', sdcStart);
  assert.ok(sdcStart > 0 && sdcEnd > sdcStart, 'SDC 블록 경계를 찾을 수 없음');
  const sdcCode = SRC.slice(sdcStart, sdcEnd);

  const dbStore = {};
  function getAt(p) {
    const parts = String(p || '').split('/').filter(Boolean);
    let cur = dbStore;
    for (const k of parts) {
      if (!cur || typeof cur !== 'object') return null;
      cur = cur[k];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
  }
  function setAt(p, val) {
    const parts = String(p || '').split('/').filter(Boolean);
    let cur = dbStore;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    const last = parts[parts.length - 1];
    if (val === null || val === undefined) delete cur[last];
    else cur[last] = JSON.parse(JSON.stringify(val));
  }

  const toasts = [];
  const audits = [];
  let openedMail = null;
  let modalHtml = '';

  const elMap = {};
  const ctx = {
    console,
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Uint8Array, Blob,
    TextDecoder, TextEncoder,
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    btoa: (bin) => Buffer.from(bin, 'binary').toString('base64'),
    URL: { createObjectURL: () => 'blob:test-preview', revokeObjectURL: () => {} },
    NS: 'fund_erp',
    S: { fundId: 'F_COOP', year: 2026, tab: 'sites', user: '담당노무사' },
    HELP: { 'site.doccenter': { t: '도움말', h: '<p>설명</p>' } },
    PM_MAIL_RE: /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]+$/,
    funds: {
      F_COOP: { name: '가상공동근로복지기금', short_name: '가상공동', fund_type: '공동', mgr_main: { name: '김노무' } },
      F_INTRA: { name: '가상솔루션사내근로복지기금', short_name: '가상솔루션사내', fund_type: '사내', mgr_main: { name: '김노무' } }
    },
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    ymd: () => '2026-11-18',
    toast: (msg, lv) => { toasts.push({ msg, lv }); },
    _audit: (fid, kind, detail) => { audits.push({ fid, kind, detail }); },
    showModal: (h) => { modalHtml = h; elMap.modalbox = { innerHTML: h, scrollTop: 0 }; },
    closeM: () => {},
    loadingHTML: (t) => '<div>' + (t || 'loading') + '</div>',
    $: (id) => elMap[id] || null,
    _pmCopy: () => Promise.resolve(true),
    _pmOpenMail: (m) => { openedMail = m; },
    _pmTo: (r) => {
      if (!r) return { email: '', name: '', pos: '' };
      const c = r.pick >= 0 ? (r.cands || [])[r.pick] : null;
      return c || { email: String(r.manual || '').trim(), name: '', pos: '' };
    },
    _pmRow: (site, idx, co) => ({
      sid: String(site._id || ''),
      name: String(site.name || ''),
      site,
      biz: !!site._hasBizCard,
      nCard: 0,
      co: co || {},
      cands: (site.contacts || []).map((c) => ({ email: c.email, name: c.name, pos: c.position || '', src: 'site' })),
      pick: (site.contacts && site.contacts.length) ? 0 : -1,
      manual: '',
      on: true,
      info: [['상호', site.name || ''], ['사업자등록번호', site.biz_no || '']].filter((x) => x[1])
    }),
    loadCardIdx: () => Promise.resolve([]),
    _siteCardMatch: () => null,
    loadCardCo: () => Promise.resolve({}),
    _loadSites: (fid) => Promise.resolve(fid === 'F_INTRA'
      ? [{ _id: 'S_ONE', name: '(주)가상솔루션', ceo: '이대표', biz_no: '123-86-00099', address: '서울특별시 강남구 테헤란로 10', contacts: [{ name: '박인사', position: '차장', email: 'hr@virtualsol-test.kr' }] }]
      : [
          { _id: 'S_A', name: '(주)가상테크', ceo: '홍대표', biz_no: '123-81-00011', address: '경기도 화성시 동탄대로 100', contacts: [{ name: '최담당', position: '과장', email: 'choi@vtech-test.kr' }] },
          { _id: 'S_B', name: '(주)하늘정밀', ceo: '강대표', biz_no: '123-81-00022', address: '경기도 평택시 산단로 200', contacts: [{ name: '정총무', position: '대리', email: 'jung@haneul-test.kr' }] }
        ]),
    _cardFundKey: (s) => String(s || '').replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|(사내|공동)?근로복지기금(법인)?|[^가-힣a-z0-9]/gi, '').toLowerCase(),
    subNormCo: (s) => String(s || '').replace(/\(주\)|㈜|주식회사|\s+/g, '').toLowerCase(),
    _flat: (s) => String(s || '').replace(/\s+/g, ' ').trim(),
    _safeArchiveKey: (k) => /^[A-Za-z0-9_-]{1,80}$/.test(String(k || '')),
    fbDb: {
      ref: (p) => ({
        once: () => Promise.resolve({ val: () => getAt(p) }),
        set: (v) => { setAt(p, v); return Promise.resolve(); },
        transaction: (fn) => {
          const next = fn(getAt(p));
          setAt(p, next);
          return Promise.resolve({ committed: true, snapshot: { val: () => getAt(p) } });
        },
        update: (obj) => { Object.keys(obj || {}).forEach((k) => setAt(p + '/' + k, obj[k])); return Promise.resolve(); }
      })
    },
    _mfCall: () => Promise.resolve({ ok: true, atts: [] }),
    _extractArchiveTextForCheck: () => Promise.resolve({ status: 'ok', text: '' }),
    _loadJsZip: () => Promise.reject(new Error('no jszip')),
    ...overrides
  };

  vm.createContext(ctx);
  /* 실제 fund.html 의 판독·대조 순수 함수들을 그대로 로드 */
  const helperFns = [
    '_loose', '_cleanName', '_cleanAddr', '_cleanCoName', '_cleanBizWord',
    'parseSmeCert', 'parseBizReg', 'parseSiteReg',
    'rvNormAddr', '_rvSameDigits', '_rvSameName', '_rvSameCeo', '_rvSameAddr',
    'rvPickRead', 'docCompare', '_mfKeys', '_mfScore', '_mfKind', '_mfZipName'
  ];
  vm.runInContext(
    'var RV_AREA=[["경기도","경기"],["서울특별시","서울"]];\n' +
    'var RV_PICK={bizno:["biz_no","name","ceo","address"],sme:["sme_cert","sme_from","sme_to","name"],reg:["corp_no","name","address","issued"]};\n' +
    'var MF_KINDS=[["corpreg",/등기사항|등기부|법인등기/],["taxid",/고유번호/],["inka",/인가증/],["wrep",/재직증명/],["smecert",/중소기업확인/]];\n' +
    helperFns.map(grabFn).join('\n') + '\n' + sdcCode,
    ctx
  );

  return {
    ctx,
    dbStore,
    getAt,
    setAt,
    toasts,
    audits,
    getOpenedMail: () => openedMail,
    getModalHtml: () => modalHtml,
    elMap
  };
}

test('1. 공동기금·사내기금 단계별 필요서류 구성 및 간략 체크리스트 메일 생성', () => {
  const { ctx } = buildSandbox();

  /* 공동기금 vs 사내기금 항목 구분 확인 */
  const coopInka = ctx.sdcDocsFor('inka', '공동');
  const intraInka = ctx.sdcDocsFor('inka', '사내');
  assert.ok(coopInka.some((d) => d.id === 'inka_match'), '공동기금은 참여신청서 항목 포함');
  assert.ok(!intraInka.some((d) => d.id === 'inka_match'), '사내기금은 공동기금 전용 참여신청서 제외');

  const docs = ctx.sdcDocsFor('subsidy', '공동');
  const f = ctx.funds.F_COOP;
  const row = {
    sid: 'S_A',
    name: '(주)가상테크',
    biz: true, /* 기업정보함에 이미 사업자등록증 보유 */
    info: [['상호', '(주)가상테크'], ['사업자등록번호', '123-81-00011']]
  };
  const siteCells = {
    sub_corpreg: { recv: true, ok: { mode: 'auto', at: '2026-11-18' } }, /* 이미 확인완료 */
    sub_smecert: { recv: true, hold: '유효기간 만료 (2026-03-31)' }      /* 보완필요 */
  };

  const mail = ctx.sdcMailText(f, row, {
    phase: 'subsidy',
    docs,
    siteCells,
    style: 'brief',
    deadline: '2026-11-28',
    mgr: '김노무',
    toName: '최담당',
    toPos: '과장',
    skipCardBiz: true,
    includeOk: false
  });

  assert.match(mail.subject, /보완·필요서류 요청/, '보완필요 항목이 있으면 제목에 보완 표시');
  assert.match(mail.body, /최담당 과장님 안녕하세요\./);
  assert.match(mail.body, /\[ \] 1\. 중소기업확인서 \[보완요청: 유효기간 만료 \(2026-03-31\)\]/, '부연 설명 없이 제목과 보완 사유만 간결 반영');
  assert.ok(!mail.body.includes('[ ] 1. 사업자등록증 사본'), '기업정보함 보유 사업자등록증은 요청 목록에서 기본 제외');
  assert.ok(!mail.body.includes('법인등기부등본(말소사항 포함)'), '이미 확인완료된 등기부등본은 미제출 목록에서 제외');
  assert.ok(!mail.body.includes(' — '), '각 항목 뒤에 장황한 설명을 붙이지 않음');
  assert.match(mail.body, /확인 완료\(제출 불필요\): 사업자등록증, 법인등기부등본/, '제외된 기확인 서류 한 줄 안내');
  assert.match(mail.body, /요청 기한: 2026-11-28까지/);

  /* 사내기금 인가 단계 불필요 항목 제외 및 상호 중복 방지 확인 */
  assert.ok(!intraInka.some((d) => d.id === 'inka_fin' || d.id === 'inka_ei'), '사내기금 인가 단계에는 재무제표·고용보험명부 제외');
  const intraDocs = ctx.sdcDocsFor('ops', '사내');
  const intraMail = ctx.sdcMailText(ctx.funds.F_INTRA, { sid: 'S_ONE', name: '(주)가상솔루션' }, {
    phase: 'ops',
    docs: intraDocs
  });
  assert.ok(!intraMail.subject.includes('(주)가상솔루션 가상솔루션사내'), '사내기금 명칭에 회사명이 들어 있으면 중복 표기 생략');
  assert.match(intraMail.body, /필요서류 요청드립니다\./);
});

test('2. 첨부파일명·메일제목 분류 및 공동·사내기금 사업장 자동 매칭', () => {
  const { ctx } = buildSandbox();
  const sites = [
    { _id: 'S_A', name: '(주)가상테크', biz_no: '123-81-00011', contacts: [{ email: 'choi@vtech-test.kr' }] },
    { _id: 'S_B', name: '(주)하늘정밀', biz_no: '123-81-00022', contacts: [{ email: 'jung@haneul-test.kr' }] }
  ];

  assert.equal(ctx.sdcClassifyKind('2026_중소기업확인서_가상테크.pdf', ''), 'smecert');
  assert.equal(ctx.sdcClassifyKind('등기사항전부증명서(말소포함).pdf', ''), 'corpreg');
  assert.equal(ctx.sdcClassifyKind('기금출연확인서_직인날인.hwp', ''), 'contrib');
  assert.equal(ctx.sdcClassifyKind('scan001.pdf', '[회신] 사업자등록증 사본 송부'), 'bizreg');

  /* 이메일 · 사업자번호 · 상호 매칭 */
  assert.equal(ctx.sdcGuessSite('scan.pdf', '서류 제출', 'choi@vtech-test.kr', '최담당', sites, true), 'S_A');
  assert.equal(ctx.sdcGuessSite('123-81-00022_사업자등록증.pdf', '첨부', 'unknown@other.kr', '', sites, true), 'S_B');
  assert.equal(ctx.sdcGuessSite('하늘정밀_재무제표.pdf', '회신', 'tax@office.kr', '', sites, true), 'S_B');
  assert.equal(ctx.sdcGuessSite('서류묶음.pdf', '자료 송부', 'unknown@other.kr', '', sites, true), '', '복수 사업장 중 단서가 없으면 오배정하지 않고 빈 문자열 반환');

  /* 사내기금(단일 사업장)은 기금 매칭 메일이면 해당 1개 사업장으로 매칭 */
  const oneSite = [{ _id: 'S_ONE', name: '(주)가상솔루션', biz_no: '123-86-00099' }];
  assert.equal(ctx.sdcGuessSite('결산기초자료.xlsx', '가상솔루션사내근로복지기금 자료 회신', 'acc@other.kr', '회계팀', oneSite, true), 'S_ONE');
});

test('3. 서류 내용 자동검토 — 일치·유효기간 만료·등기 3개월 경과·민감서류 보호·주민번호 가림', () => {
  const { ctx } = buildSandbox();
  const site = { _id: 'S_A', name: '(주)가상테크', ceo: '홍대표', biz_no: '123-81-00011', address: '경기도 화성시 동탄대로 100' };

  /* ① 사업자등록증 일치 */
  const okBiz = ctx.sdcVerifyText('bizreg', '사업자등록증 등록번호 123-81-00011 법인명(단체명): 주식회사 가상테크 대표자: 홍대표 사업장소재지: 경기도 화성시 동탄대로 100 업태: 제조', site, { refDate: '2026-11-18', today: '2026-11-18' });
  assert.equal(okBiz.st, 'match');

  /* ② 사업자등록증 번호 불일치 */
  const diffBiz = ctx.sdcVerifyText('bizreg', '사업자등록증 등록번호 123-81-99999 상호: 주식회사 가상테크 대표자: 홍대표', site, { refDate: '2026-11-18', today: '2026-11-18' });
  assert.equal(diffBiz.st, 'diff');

  /* ③ 중소기업확인서 유효기간 정상 vs 만료 */
  const okSme = ctx.sdcVerifyText('smecert', '중소기업 확인서 기업명: (주)가상테크 기업규모: 중소기업(소기업) 유효기간: 2026.04.01 ~ 2027.03.31', site, { refDate: '2026-11-18', today: '2026-11-18' });
  assert.equal(okSme.st, 'match');
  const expSme = ctx.sdcVerifyText('smecert', '중소기업 확인서 기업명: (주)가상테크 기업규모: 중소기업 유효기간: 2025.04.01 ~ 2026.03.31', site, { refDate: '2026-11-18', today: '2026-11-18' });
  assert.equal(expSme.st, 'diff');
  assert.match(expSme.summary, /유효기간 만료/);

  /* ④ 법인등기부등본 3개월 이내 vs 3개월 경과 */
  const okReg = ctx.sdcVerifyText('corpreg', '등기사항전부증명서 등록번호 110111-0099887 상호 주식회사 가상테크 본점 경기도 화성시 동탄대로 100 발급일 2026년 10월 20일', site, { refDate: '2026-11-18', today: '2026-11-18', req3m: true });
  assert.equal(okReg.st, 'match');
  const oldReg = ctx.sdcVerifyText('corpreg', '등기사항전부증명서 등록번호 110111-0099887 상호 주식회사 가상테크 본점 경기도 화성시 동탄대로 100 발급일 2026년 05월 01일', site, { refDate: '2026-11-18', today: '2026-11-18', req3m: true });
  assert.equal(oldReg.st, 'diff');
  assert.match(oldReg.summary, /발급 3개월 경과/);

  /* ⑤ 인감·주민등록초본 등 민감 서류는 자동 match 하지 않고 수동 확인 유지 + 하이픈/공백/무하이픈 주민번호 가림 */
  const inseal = ctx.sdcVerifyText('inseal', '인감증명서 성명 홍대표 주민등록번호 800512-1234567', site, { refDate: '2026-11-18' });
  assert.equal(inseal.st, 'unk', '민감 신분서류는 자동확인 대상에서 제외');
  assert.equal(ctx._sdcMaskRrn('대표 홍대표 800512-1234567 확인'), '대표 홍대표 800512-1****** 확인');
  assert.equal(ctx._sdcMaskRrn('무하이픈 8005121234567 및 공백 901231 2345678 끝'), '무하이픈 800512-1****** 및 공백 901231-2****** 끝');

  /* ⑥ 출연확인서는 상호·기금명이 없으면 unk, 상호 또는 기금명이 있으면 match */
  const noCoContrib = ctx.sdcVerifyText('contrib', '기금출연확인서 일금 10,000,000원정', site, { refDate: '2026-11-18' });
  assert.equal(noCoContrib.st, 'unk', '상호·기금명 없는 일반 문구만으로는 자동 일치 판정하지 않음');
  const fundContrib = ctx.sdcVerifyText('contrib', '가상공동근로복지기금 기금출연확인서 일금 10,000,000원정', site, { refDate: '2026-11-18', fundName: '가상공동근로복지기금' });
  assert.equal(fundContrib.st, 'match');
});

test('4. 푸른메일함 스캔 → 자동 입수 체크 → 신뢰 발신자 자동확인·외부 발신자 보류·subsidy_chk 보호·ZIP 상한 통합 검증', async () => {
  const fileTexts = {
    '123-81-00011_사업자등록증.pdf': '사업자등록증 123-81-00011 상호: (주)가상테크 대표자: 홍대표 사업장소재지: 경기도 화성시 동탄대로 100',
    '하늘정밀_중소기업확인서.pdf': '중소기업 확인서 기업명: (주)하늘정밀 유효기간: 2025-01-01 ~ 2025-12-31',
    '123-81-00022_등기부등본.pdf': '등기사항전부증명서 등록번호 110111-0000000 상호 주식회사 하늘정밀 본점 경기도 평택시 산단로 200 발급일 2026년 11월 01일'
  };
  let bombExtracted = false;

  const sb = buildSandbox({
    _mfCall: (fn, body) => {
      if (fn === 'readMailMessage') {
        if (body.uid === '101') return Promise.resolve({ ok: true, atts: [{ name: '123-81-00011_사업자등록증.pdf', part: '2', size: 1024 }] });
        if (body.uid === '102') return Promise.resolve({ ok: true, atts: [{ name: '하늘정밀_중소기업확인서.pdf', part: '2', size: 1024 }] });
        if (body.uid === '103') return Promise.resolve({ ok: true, atts: [{ name: '첨부파일1.pdf', part: '2', size: 1024 }] });
        if (body.uid === '104') return Promise.resolve({ ok: true, atts: [{ name: '123-81-00022_등기부등본.pdf', part: '2', size: 1024 }] });
        if (body.uid === '105') return Promise.resolve({ ok: true, atts: [{ name: '묶음.zip', part: '2', size: 2048 }] });
      }
      if (fn === 'readMailAttachment') {
        if (body.uid === '105') return Promise.resolve({ ok: true, name: '묶음.zip', mime: 'application/zip', b64: Buffer.from('ZIP').toString('base64') });
        const nm = body.uid === '101' ? '123-81-00011_사업자등록증.pdf' : body.uid === '102' ? '하늘정밀_중소기업확인서.pdf' : body.uid === '104' ? '123-81-00022_등기부등본.pdf' : '첨부파일1.pdf';
        return Promise.resolve({ ok: true, name: nm, mime: 'application/pdf', b64: Buffer.from('PDFDATA').toString('base64') });
      }
      return Promise.resolve({ ok: true });
    },
    _loadJsZip: () => Promise.resolve({
      loadAsync: () => Promise.resolve({
        files: {
          'bomb.pdf': {
            dir: false,
            _data: { uncompressedSize: 99 * 1024 * 1024 },
            async: () => { bombExtracted = true; return Promise.resolve(new Uint8Array(10)); }
          }
        }
      })
    }),
    _extractArchiveTextForCheck: (nm) => Promise.resolve({ status: 'ok', text: fileTexts[nm] || '가상공동근로복지기금 기금출연확인서 일금 10,000,000원정' })
  });

  /* 기존에 근복지원금 탭에서 사람이 직접 체크해 둔 값(sdc_src 없음) */
  sb.setAt('fund_erp/subsidy_chk/F_COOP/2026/site/S_B/sme', 1);

  /* 메일함 데이터 준비 */
  sb.setAt('mailbox/folders/inbox', { kind: 'inbox', name: '받은메일함' });
  sb.setAt('mailbox/msgs/inbox/101', { a: 1, d: Date.UTC(2026, 10, 17), e: 'choi@vtech-test.kr', f: '최담당', s: '사업자등록증 제출', p: '' });
  sb.setAt('mailbox/msgs/inbox/102', { a: 1, d: Date.UTC(2026, 10, 18), e: 'jung@haneul-test.kr', f: '정총무', s: '중소기업확인서 송부', p: '' });
  sb.setAt('mailbox/msgs/inbox/103', { a: 1, d: Date.UTC(2026, 10, 18), e: 'other@unknown-test.kr', f: '외부발신', s: '가상공동근로복지기금 서류', p: '' });
  sb.setAt('mailbox/msgs/inbox/104', { a: 1, d: Date.UTC(2026, 10, 18), e: 'stranger@unknown-test.kr', f: '미등록발신', s: '가상공동근로복지기금 등기부', p: '' });
  sb.setAt('mailbox/msgs/inbox/105', { a: 1, d: Date.UTC(2026, 10, 18), e: 'choi@vtech-test.kr', f: '최담당', s: '압축서류', p: '' });

  await sb.ctx.openSiteDocCenter('F_COOP', 'subsidy');
  assert.equal(sb.ctx.SDC.rows.length, 2);

  /* 메일 스캔 실행 */
  sb.ctx.sdcScanMail();
  await new Promise((r) => setTimeout(r, 100));

  /* ① 압축 해제 전 12MB 초과 ZIP 항목은 async 호출 전에 차단 */
  assert.equal(bombExtracted, false, 'ZIP 폭탄 의심 항목은 메모리 해제 전에 차단');

  /* ② 등록 연락처(choi@vtech-test.kr) 발신 + 내용 일치 → 자동 확인완료 & subsidy_chk=1 연동 & 최소수집(from/subject 미저장) */
  const cellA = sb.getAt('fund_erp/site_doc_chk/F_COOP/S_A/sub_bizreg');
  assert.equal(cellA.recv, true);
  assert.equal(cellA.mail.from, undefined, 'RTDB mailRef에는 발신자명 사본을 중복 저장하지 않음');
  assert.equal(cellA.ok.mode, 'auto', '등록 연락처 발신 + 일치 시 자동 확인완료');
  assert.equal(sb.getAt('fund_erp/subsidy_chk/F_COOP/2026/site/S_A/bizno'), 1, '확인완료 시 지원금 진행표 연동');

  /* ③ 미등록 발신자(stranger@unknown-test.kr)가 보낸 파일은 입수·내용일치까지만 기록하고 자동확인은 보류되며, 일괄 재검토(sdcReviewAll)에서도 자동확인으로 승격되지 않음 */
  const cellUntrusted = sb.getAt('fund_erp/site_doc_chk/F_COOP/S_B/sub_corpreg');
  assert.equal(cellUntrusted.recv, true);
  assert.equal(cellUntrusted.mail.trusted, false);
  assert.equal(cellUntrusted.review.st, 'match');
  assert.equal(cellUntrusted.ok, undefined, '미등록 외부 발신 메일은 사람 확인 전까지 자동확인 보류');
  assert.equal(sb.getAt('fund_erp/subsidy_chk/F_COOP/2026/site/S_B/reg'), null, '단순 입수만으로는 지원금 완비 체크를 켜지 않음');

  sb.ctx.sdcReviewAll();
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(sb.getAt('fund_erp/site_doc_chk/F_COOP/S_B/sub_corpreg').ok, undefined, 'sdcReviewAll 후에도 미등록 발신 메일은 자동확인되지 않음');

  /* 스트리밍 해제 중 조작된 헤더(uncompressedSize=100)가 실제 청크 합계로 상한을 넘을 때 즉시 중단 검증 */
  let paused = false;
  await assert.rejects(
    sb.ctx._sdcReadZipEntryBounded({
      _data: { uncompressedSize: 100 },
      internalStream: () => {
        const handlers = {};
        const stObj = {
          on(ev, cb) { handlers[ev] = cb; return stObj; },
          pause() { paused = true; },
          resume() {
            handlers.data(new Uint8Array(8 * 1024 * 1024));
            handlers.data(new Uint8Array(6 * 1024 * 1024));
          }
        };
        return stObj;
      }
    }, 12 * 1024 * 1024),
    /상한 초과/
  );
  assert.equal(paused, true, '조작된 ZIP 스트림이 한도를 넘자마자 pause 호출');

  /* ④ S_B 의 중소기업확인서는 유효기간 만료로 hold 설정, 그러나 기존 지원금 탭 수동 체크(sme=1)는 지우지 않음! */
  const cellB = sb.getAt('fund_erp/site_doc_chk/F_COOP/S_B/sub_smecert');
  assert.equal(cellB.recv, true);
  assert.equal(cellB.ok, undefined);
  assert.match(cellB.hold, /유효기간 만료/);
  assert.equal(sb.getAt('fund_erp/subsidy_chk/F_COOP/2026/site/S_B/sme'), 1, '지원금 탭에서 직접 한 기존 체크는 지우지 않음');

  /* ⑤ 재스캔 시 이미 입수된 동일 메일은 신규 입수 건수(newRecv)에 중복 집계되지 않음 */
  sb.ctx.sdcScanMail();
  await new Promise((r) => setTimeout(r, 80));
  assert.match(sb.ctx.SDC.scanMsg, /신규 입수 0건/, '동일 첨부 재스캔 시 신규 입수 0건');

  /* ⑥ 미지정 목록(103번)을 다른 단계 서류(inka_wrep 등 전체 단계 드롭다운 포함) 또는 출연확인서로 배정 */
  assert.equal(sb.ctx.SDC.unmatched.length, 1);
  assert.equal(sb.ctx.SDC.unmatched[0].bytes, undefined, '미지정 목록에 파일 바이트를 메모리에 쥐고 있지 않음');
  sb.elMap['sdc-us-0'] = { value: 'r0' };
  sb.elMap['sdc-ud-0'] = { value: 'sub_contrib' };
  sb.ctx.sdcAssignUnmatched(0);
  await new Promise((r) => setTimeout(r, 60));
  const cellContrib = sb.getAt('fund_erp/site_doc_chk/F_COOP/S_A/sub_contrib');
  assert.equal(cellContrib.recv, true);
  assert.equal(cellContrib.ok.mode, 'auto', '사람이 직접 지정한 출연확인서 문구·기금명 확인 시 자동확인');

  /* ⑦ autoOk=false 상태에서 유효기간 정상 서류로 재검토하면 기존 hold(보완필요)가 해제되어야 함 */
  sb.ctx.SDC.autoOk = false;
  fileTexts['하늘정밀_중소기업확인서.pdf'] = '중소기업 확인서 기업명: (주)하늘정밀 기업규모: 중소기업 유효기간: 2026-04-01 ~ 2027-03-31';
  sb.ctx.sdcReviewSingle('r1', 'sub_smecert');
  await new Promise((r) => setTimeout(r, 60));
  const fixedB = sb.getAt('fund_erp/site_doc_chk/F_COOP/S_B/sub_smecert');
  assert.equal(fixedB.hold, undefined, 'autoOk=false 여도 새 서류가 일치하면 이전 보완필요(hold)는 해제됨');
  assert.equal(fixedB.ok, undefined, 'autoOk=false 이므로 수동 확인 대기 상태');

  /* ⑧ 담당자 수동 확인 토글 및 요청메일 작성 연동 검증 */
  sb.ctx.sdcManualOk('r1', 'sub_bizreg', true);
  await new Promise((r) => setTimeout(r, 30));
  const manualCell = sb.getAt('fund_erp/site_doc_chk/F_COOP/S_B/sub_bizreg');
  assert.equal(manualCell.ok.mode, 'manual', '수동 체크박스로 즉시 수동 확인완료 전환');

  sb.ctx.sdcCompose('r1');
  const sentDraft = sb.getOpenedMail();
  assert.ok(sentDraft, '푸른메일함 쓰기 창 호출');
  assert.equal(sentDraft.to, 'jung@haneul-test.kr');
  assert.ok(!sentDraft.body.includes('사업자등록증 사본 —'), '방금 수동 확인한 사업자등록증은 재요청 체크리스트에서 제외');

  /* XSS 위험 키 거부 검증 */
  assert.equal(sb.ctx._sdcSafeKey("bad'key"), false);
  assert.equal(sb.ctx._sdcSafeKey('S_A-01'), true);
});
