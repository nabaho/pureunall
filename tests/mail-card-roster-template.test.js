'use strict';
/* 확정 메일 명함 양식(① 품격 골드·네이비 카드형) & 근로자 명부 연락처·직책 자동 연동 검증 (대표 지시 2026-11-18)
   1) signCardHtml: 푸른노무법인 명함을 ① 품격 골드·네이비 표(table) 양식으로 생성하고,
      휴대폰(근로자 명부 Mobile) 유무·지사(천안본사/서산지사) 대표번호 대체·서버 HTML 세척(MS.sanitizeHtml, tel: 허용) 통과 검증.
   2) pu-cards 화면: HRW 전용 쓰기 경로(data/company_info/v/staffCards) + data/user_dir 에서
      로그인 직원의 이름·직책·연락처를 자동으로 채워 넣고, 입력 중 보호(grabCompose 선행) 및
      초기 대표번호(Tel.) → 근로자 명부 휴대폰(Mobile.) 비동시 업그레이드 검증.
   3) 서버(mail-deliver): 개인 발송 시 보내는사람 헤더에 「푸른노무법인 이름 직책 <주소>」 표기 및
      RFC5322 주소 구분자(, ; : @ 등) 인젝션 방어 검증.
   4) 이알피(pu-erp _syncStaffMailCards): 슬림 명부(user_dir) 오덮어쓰기 차단, 현직(active)만
      data/company_info/v/staffCards 에 동기화하여 퇴직·입사예정·삭제·사번변환 항목 자동 정리 검증. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');
const { cutFn } = require('./cut-fn.js');

const ROOT = path.join(__dirname, '..');
const MS = require(path.join(ROOT, 'functions', 'mail-send.js'));
const MD = require(path.join(ROOT, 'functions', 'mail-deliver.js'));
const cardsSrc = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const erpSrc = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('★★★ signCardHtml + mail-send: ① 품격 골드·네이비 카드형 양식 및 서버 세척(tel: 링크·표 꾸밈·word-break) 보존', () => {
  const ctx = { console, String, Array, Object, RegExp, esc };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(cardsSrc, 'function signCardHtml('), ctx);

  const raw = ctx.signCardHtml({
    id: 'pu_staff_A-903',
    name: '김가람',
    title: '과장',
    dept: '인사노무·법인회계',
    company: '푸른노무법인',
    mobile: '010-1234-5678',
    email: '370-6@hanmail.net',
    branch: '천안본사',
  });
  assert.match(raw, /class="pu-mail-card"/, '확정 골드·네이비 카드 표 클래스가 있어야 한다');
  assert.ok(raw.includes('PUREUN LABOR LAW FIRM'), '영문 법인명이 포함되어야 한다');
  assert.ok(raw.includes('https://pureunlabor.co.kr'), '공식 홈페이지 링크가 포함되어야 한다');
  assert.ok(raw.includes('천안본사') && raw.includes('서산지사'), '천안본사·서산지사 2단 안내가 모두 들어가야 한다');
  assert.ok(raw.includes('김가람') && raw.includes('과장') && raw.includes('인사노무·법인회계'));
  assert.ok(raw.includes('href="tel:010-1234-5678"'), '휴대폰 번호는 전화 걸기 링크여야 한다');

  const cleaned = MS.sanitizeHtml(raw);
  assert.match(cleaned, /class="pu-mail-card"/, '서버 세척 뒤에도 pu-mail-card 클래스가 보존되어야 한다');
  assert.ok(cleaned.includes('href="tel:010-1234-5678"'), '서버 세척 뒤에도 tel: 링크가 살아 있어야 한다');
  assert.ok(cleaned.includes('href="mailto:370-6@hanmail.net"'), '서버 세척 뒤에도 mailto: 링크가 살아 있어야 한다');
  assert.ok(cleaned.includes('background:#1e293b') && cleaned.includes('background:#d97706'), '상단·구분선 네이비·골드 배색이 유지되어야 한다');
  assert.ok(cleaned.includes('word-break:keep-all'), '한국어 단어 줄바꿈 보호가 세척 뒤에도 남아야 한다');

  assert.equal(MS.cleanHref('tel:javascript:alert(1)'), '');
  assert.equal(MS.cleanHref('tel:010-1234-5678"onclick="x()'), '');

  const seosanFallback = ctx.signCardHtml({
    id: 'pu_staff_A-904',
    name: '이수현',
    title: '노무사',
    company: '푸른노무법인',
    mobile: '',
    branch: '서산지사',
  });
  assert.ok(seosanFallback.includes('공인노무사'), '노무사 직책은 공인노무사로 정돈되어야 한다');
  assert.equal(seosanFallback.includes('Mobile.'), false, '연락처가 비어 있으면 빈 Mobile. 이름표가 남지 않아야 한다');
  assert.ok(seosanFallback.includes('href="tel:041-429-0123"'), '서산지사 소속은 서산지사 대표번호로 대체되어야 한다');
});

test('★★★ pu-cards 화면: Tel.→Mobile. 비동시 업그레이드 · 입력 중 덮어쓰기 방지(grabCompose) · HRW 경로 우선', () => {
  const secMatch = cardsSrc.match(/^const SEC_DEFAULT =\n`[\s\S]*?`;$/m);
  const signMatch = cardsSrc.match(/^const SIGN_DEFAULT =\n`[\s\S]*?`;$/m);
  assert.ok(secMatch && signMatch);

  let grabCalls = 0;
  let liveTypedSubj = '';
  const ctx = {
    Object, String, Number, Array, Boolean, Math, Date, RegExp, JSON, console,
    esc,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    DB_ROOT: 'pucards',
    MYSIGN_OFF_LS: 'pucards_mysign_off_',
    SIGN_CID: 'pusign',
    SIGN_IMG: '<img src="cid:pusign">',
    myEmail: 'a903@pureun.kr',
    _matMail: { from: '370-6@daum.net', mode: 'auto', perUser: {} },
    _compose: null,
    state: {
      view: 'mail',
      mailSent: false,
      items: {
        'pu_staff_A-903': {
          id: 'pu_staff_A-903',
          kind: 'card',
          name: '김가람',
          title: '과장',
          company: '푸른 노무법인',
          mobile: '010-0000-0000', // 일반 items 에 예전/변조 번호가 있어도 HRW staffCards 가 이겨야 한다
        },
      },
    },
    ErpMatch: {
      staffRosterBySid: {},
      staff: {
        '김가람': { sid: 'A-903', name: '김가람', title: '과장', branch: '천안본사', status: 'active' },
      },
    },
    mbMyName: () => '김가람',
    mbStaffOf: (nm) => ctx.ErpMatch.staff[nm] || null,
    mbRetired: (nm) => !!(ctx.ErpMatch.staff[nm] && ctx.ErpMatch.staff[nm].status === 'retired'),
    grabCompose: () => {
      grabCalls++;
      if (ctx._compose && liveTypedSubj) ctx._compose.subject = liveTypedSubj;
    },
    renderMailPage: () => { ctx._rendered = (ctx._rendered || 0) + 1; },
  };
  vm.createContext(ctx);
  vm.runInContext(
    secMatch[0].replace(/^const /, 'var ') + '\n' +
    signMatch[0].replace(/^const /, 'var ') + '\n',
    ctx
  );
  [
    'function textToHtml(', 'function htmlToTextC(', 'function signText(', 'function secText(',
    'function signKeyC(', 'function mySignKey(', 'function mySign(', 'function signMode(',
    'function isPureunFirmName(', 'function mySidFromEmail(', 'function myRosterCardProfile(',
    'function enrichPureunCardWithRoster(', 'function findMyLatestPureunCard(', 'function myEffectiveSignCard(',
    'function mySignCardItem(', 'function mySenderDisplayPrefix(', 'function signCardHtml(',
    'function signBlockHtml(', 'function composeTouched(', 'function refreshUntouchedComposeSign(',
  ].forEach((sig) => vm.runInContext(sliceFn(cardsSrc, sig), ctx));

  // 1) 초기에는 staffCards 미도착 + items.mobile 비어 있는 경우 Tel. 대표번호 카드로 시작하더라도,
  //    staffCards 도착 시 Tel. -> Mobile.(010-9876-5432) 로 자동 업그레이드된다.
  ctx.state.items['pu_staff_A-903'].mobile = '';
  const initHtml = '<br><br>' + ctx.signBlockHtml();
  assert.match(initHtml, /pu-mail-card/);
  assert.ok(initHtml.includes('Tel.'), '초기 미수신 상태에서는 대표번호(Tel.)가 들어간다');
  ctx._compose = {
    to: '', cc: '', subject: '',
    html: initHtml, body: ctx.htmlToTextC(initHtml),
    base: { subject: '', body: ctx.htmlToTextC(initHtml) },
    ids: [], files: [],
  };

  // HRW 전용 staffCards 도착 (items 에 다른 번호가 있어도 staffCards 번호가 우선)
  ctx.state.items['pu_staff_A-903'].mobile = '010-0000-0000';
  ctx.ErpMatch.staffRosterBySid['A-903'] = {
    sid: 'A-903', name: '김가람', title: '과장', phone: '010-9876-5432', branch: '천안본사', status: 'active',
  };
  ctx.refreshUntouchedComposeSign();

  assert.ok(grabCalls >= 1, '덮어쓰기 전 grabCompose 를 먼저 호출해야 한다');
  assert.ok(ctx._compose.html.includes('010-9876-5432'), 'HRW staffCards 연락처로 업그레이드되어야 한다');
  assert.equal(ctx._compose.html.includes('010-0000-0000'), false, '일반 items 의 번호보다 HRW staffCards 가 우선해야 한다');
  assert.equal(ctx.composeTouched(ctx._compose), false, '자동 서명 보정 뒤에도 빈 편지는 임시저장 대상으로 오인되면 안 된다');

  // 2) 사용자가 제목을 입력하는 도중 비동시 호출이 오면 grabCompose 가 먼저 돌아 덮어쓰기를 중단한다
  const userEditedHtml = '<p>작성 중인 본문</p>' + ctx._compose.html;
  ctx._compose.html = userEditedHtml;
  liveTypedSubj = '급여대장 송부';
  ctx.ErpMatch.staffRosterBySid['A-903'].phone = '010-1234-9999';
  ctx.refreshUntouchedComposeSign();
  assert.equal(ctx._compose.html, userEditedHtml, '작성 중인 편지의 본문은 절대 덮어쓰면 안 된다');

  // 3) 보내는사람 표시명 검증
  assert.equal(ctx.mySenderDisplayPrefix(false), '푸른노무법인 김가람 과장');
  assert.equal(ctx.mySenderDisplayPrefix(true), '푸른노무법인');
});

test('★★★ mail-deliver: 개인 발송 보내는사람 헤더 이름·직책 표기 및 RFC5322 구분자(, ; : @) 인젝션 방어', async () => {
  assert.equal(MD.fromLine('370-6@daum.net', '권형하 대표노무사'), '푸른노무법인 권형하 대표노무사 <370-6@daum.net>');
  const injected = MD.fromLine('370-6@daum.net', '홍 대표, ceo@evil.com;\x00 (조직)\r\nBcc:x@y.com');
  assert.equal(injected.includes(','), false, '쉼표가 남으면 복수 발신자로 쪼개질 수 있다');
  assert.equal(injected.includes('\x00'), false, 'NUL 등 제어문자가 남으면 안 된다');
  assert.equal(injected.indexOf('@'), injected.lastIndexOf('@'), '표시명 안에 @ 가 남으면 안 된다');
  assert.equal(injected.includes('\n'), false);
  assert.equal(MD.fromLine('370-6@daum.net', ''), '푸른노무법인 <370-6@daum.net>');

  // user_dir 에 매칭되지 않는 계정이 items.name 을 사칭해도 From 표시명에는 들어가지 않아야 한다
  const spoofSent = [];
  const spoofDb = {
    'data/user_dir': [],
    'pucards/config/matMail/perUser/unknown@pureun_kr': { cardId: 'pu_staff_spoof', autoAttach: true },
    'pucards/items/pu_staff_spoof': { id: 'pu_staff_spoof', name: '권형하 대표노무사', company: '푸른노무법인' },
    'pucards/items/pu_staff_spoof/name': '권형하 대표노무사',
    'pucards/thumbs/pu_staff_spoof': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
    'pucards/config/matMail/track': false,
  };
  await MD.deliver({
    db: { ref: (p) => ({ once: async () => ({ val: () => spoofDb[p] ?? null }), push: async () => ({ key: 'k0' }), set: async () => {} }) },
    from: '370-6@daum.net',
    pass: 'pw-ok',
    byEmail: 'unknown@pureun.kr',
    uid: 'uid-unknown',
    nodemailer: { createTransport: () => ({ sendMail: async (m) => { spoofSent.push(m); return { messageId: '0' }; } }) },
    copy: { mode: 'skip' },
    body: { to: 'hr@gana.kr', subject: '안내', body: '본문', html: '<p>본문</p>', attachMyCard: true, track: false },
  });
  assert.equal(spoofSent[0].from, '푸른노무법인 <370-6@daum.net>', 'user_dir 미확인 시 items.name 으로 From 표시명을 만들면 안 된다');

  const sent = [];
  const dbData = {
    'uid_roles/uid-p905': { sid: 'P-905', status: 'active' },
    'data/user_dir': [{ sid: 'P-905', name: '박한결', title: '노무사', status: 'active' }],
    'data/company_info/v/staffCards/P-905': { sid: 'P-905', name: '박한결', title: '공인노무사', phone: '010-1234-5678', status: 'active' },
    'pucards/config/matMail/track': false,
  };
  await MD.deliver({
    db: {
      ref: (p) => ({
        once: async () => ({ val: () => dbData[p] ?? null }),
        push: async () => ({ key: 'k1' }),
        set: async () => {},
      }),
    },
    from: '370-6@daum.net',
    pass: 'pw-ok',
    byEmail: 'p905@pureun.kr',
    uid: 'uid-p905',
    nodemailer: { createTransport: () => ({ sendMail: async (m) => { sent.push(m); return { messageId: '1' }; } }) },
    copy: { mode: 'skip' },
    body: { to: 'hr@gana.kr', subject: '안내드립니다', body: '본문입니다', html: '<p>본문입니다</p>', track: false },
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, '푸른노무법인 박한결 공인노무사 <370-6@daum.net>');
});

test('★★★ pu-erp _syncStaffMailCards: 슬림 명부(user_dir) 방어 및 현직(active) 전체 교체(퇴직·예정·삭제 자동 제거)', async () => {
  const fnCode = cutFn(erpSrc, 'function _syncStaffMailCards(');
  const updates = [];
  let localCache = [
    // 새 기기 로그인 직후 phone 이 없는 user_dir 슬림 캐시 상태
    { sid: 'A-901', name: '최민수', title: '사무장', status: 'active' },
  ];
  let serverAccs = null;
  const ctx = {
    console, Object, Array, String, Number, Date, RegExp,
    USERS_SEED: [],
    _dbCache: {},
    CURRENT_USER: { isAdmin: true },
    dbGet: (k) => (k === 'user_accounts' ? localCache : null),
    normalizeFbValue: (v) => v,
    fbDb: {
      ref(p) {
        if (p === 'data/user_accounts') {
          return { once: async () => ({ val: () => (serverAccs ? { v: serverAccs, u: 1 } : null) }) };
        }
        if (p === 'pucards/items') {
          return {
            orderByKey: () => ({
              startAt: () => ({
                endAt: () => ({
                  once: async () => ({
                    val: () => ({ 'pu_staff_A-901': { id: 'pu_staff_A-901', kind: 'card' } }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          update: async (patch) => { updates.push(patch); },
        };
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fnCode, ctx);

  // 1) 로컬이 슬림 명부(phone 없음)이고 서버 응답도 없으면 절대 빈 값으로 덮어쓰지 않는다
  ctx._syncStaffMailCards();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(updates.length, 0, '슬림 user_dir 캐시로 전 직원 연락처를 빈 값으로 덮어쓰면 안 된다');

  // 2) 서버에 실제 user_accounts 가 있으면 그것을 읽어 현직(active)만 staffCards 맵으로 교체한다
  serverAccs = [
    { sid: 'A-901', name: '최민수', title: '사무장', phone: '010-1234-0001', branch: '천안본사', status: 'active', rrn: '800101-1234567' },
    { sid: 'P-902', name: '박퇴직', title: '노무사', phone: '010-1234-0002', branch: '천안본사', status: 'retired' },
    { sid: 'A-909', name: '김예정', title: '주임', phone: '010-1234-0009', branch: '천안본사', status: 'scheduled' },
  ];
  ctx._syncStaffMailCards();
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(updates.length, 1);
  const patch = updates[0];
  const map = patch['data/company_info/v/staffCards'];
  assert.deepEqual(Object.keys(map), ['A-901'], '현직(active) 사번만 남고 퇴직·입사예정·삭제 사번은 맵에서 빠져야 한다');
  assert.equal(map['A-901'].phone, '010-1234-0001');
  assert.equal(map['A-901'].rrn, undefined, '주민번호 등 민감정보는 복사되면 안 된다');
  assert.equal(patch['pucards/items/pu_staff_A-901/mobile'], '010-1234-0001');
});
