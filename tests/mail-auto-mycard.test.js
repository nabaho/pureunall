'use strict';
/* 📇 담당자 본인 명함 자동 매칭 · 메일 발송 시 자동 첨부 검증 (대표 지시 2026-11-18)
   「담당자가 본인이 메일을 보내는경우 본인의 명함이 자동으로 첨부되어 보낼수 있게 되었으면 좋겠다.
     푸른노무법인 최근 명함 확인하고 메일을 보낼때 명함도 첨부하게 해라」
   1) 서버(mail-sign / mail-deliver): attachMyCard=true 일 때 본인 명함을 정식 첨부파일
      (푸른노무법인_<이름>_명함.jpg, cid 없음)로 붙이고 보낸메일함(sentBox) 기록에도 남기며,
      perUser 미설정 직원도 uid_roles → data/user_dir → pucards/idx 에서 최근 푸른노무법인 명함을 자동 매칭한다.
   2) 예약 발송(slimPayload): attachMyCard 플래그를 보존해 예약 메일에도 명함이 첨부된다.
   3) 화면(pu-cards.html): 메일쓰기 진입 시 본인 최근 푸른노무법인 명함을 자동 선택·연결하고
      첨부칸(#cpDrop)에 내 명함 자동첨부 칩을 표시하되, 빈 편지의 임시저장 판정(composeTouched)은 건드리지 않고
      단체 묶음 발송(bulk)에는 개인 명함을 뿌리지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const SG = require(path.join(ROOT, 'functions', 'mail-sign.js'));
const MD = require(path.join(ROOT, 'functions', 'mail-deliver.js'));
const app = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');

const SAMPLE_JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';

test('★★★ mail-sign: 일반 첨부용 명함 파일 생성 및 허용 Storage 주소 검증(SSRF 차단)', () => {
  const att = SG.cardFileAttachment(SAMPLE_JPG, '홍길동');
  assert.ok(att, '유효한 dataURL 명함은 첨부 객체로 만들어져야 한다');
  assert.equal(att.filename, '푸른노무법인_홍길동_명함.jpg');
  assert.equal(att.cid, undefined, '일반 파일 첨부이므로 cid 가 없어야 첨부파일 목록에 뜬다');
  assert.equal(att.contentDisposition, undefined);
  assert.equal(att.encoding, 'base64');

  assert.equal(SG.allowedCardThumbUrl('http://127.0.0.1:8080/secret'), '', '내부망 주소는 차단해야 한다');
  assert.equal(SG.allowedCardThumbUrl('https://evil.example.com/card.jpg'), '', '외부 임의 주소는 차단해야 한다');
  assert.equal(
    SG.allowedCardThumbUrl('https://firebasestorage.googleapis.com/v0/b/pureun-erp-hrphotos/o/hr%2Fphoto.jpg?alt=media'),
    '',
    '인사 사진 버킷 주소는 명함 첨부로 허용하지 않아야 한다'
  );
  assert.ok(
    SG.allowedCardThumbUrl('https://firebasestorage.googleapis.com/v0/b/pureun-erp.firebasestorage.app/o/pu_photos%2Fthumb.jpg?alt=media'),
    '우리 프로젝트 명함 Storage 썸네일 주소는 허용해야 한다'
  );
});

test('★★★ mail-deliver: attachMyCard=true 발송 시 본인 최근 푸른노무법인 명함이 정식 첨부되고 예약(slimPayload)에도 유지된다', async () => {
  const sentMails = [];
  const pushedSentBox = [];
  const dbData = {
    'uid_roles/uid-hong': { sid: 'P-901', status: 'active' },
    'data/user_dir': [
      { sid: 'P-901', name: '홍길동', title: '공인노무사', status: 'active' },
    ],
    'pucards/idx': {
      '-OzOld': { k: 'card', n: '홍길동', c: '한국공인노무사회' },
      '-OzPuOld': { k: 'card', n: '홍길동', c: '푸른 노무법인' },
      '-P0PuNew': { k: 'card', n: '홍길동', c: '푸른 노무법인' },
    },
    'pucards/thumbs/-P0PuNew': SAMPLE_JPG,
    'pucards/items/-P0PuNew/name': '홍길동',
    'pucards/config/matMail/track': false,
  };
  const fakeDb = {
    ref: (p) => ({
      once: async () => ({ val: () => dbData[p] ?? null }),
      push: async (v) => {
        if (p === 'pucards/sentBox') pushedSentBox.push(v);
        return { key: 'pushed-1' };
      },
      set: async () => {},
    }),
  };
  const fakeMailer = {
    createTransport: () => ({
      sendMail: async (mail) => { sentMails.push(mail); return { messageId: 'm1' }; },
    }),
  };

  // perUser 설정이 아직 비어 있어도 uid → user_dir → idx 자동 매칭으로 최근 푸른 노무법인 명함(c-new)을 첨부한다
  const res = await MD.deliver({
    db: fakeDb,
    from: '370-6@daum.net',
    pass: 'app-pass-ok',
    byEmail: 'p901@pureun.kr',
    uid: 'uid-hong',
    nodemailer: fakeMailer,
    copy: { mode: 'skip' },
    body: {
      to: 'client@gana.kr',
      subject: '자문 의견서 송부드립니다',
      body: '첨부 확인 부탁드립니다.',
      html: '<p>첨부 확인 부탁드립니다.</p>',
      matIds: [],
      files: [],
      attachMyCard: true,
      track: false,
    },
  });

  assert.equal(res.ok, true, '발송이 성공해야 한다');
  assert.equal(sentMails.length, 1);
  assert.ok(
    sentMails[0].attachments.some((a) => a.filename === '푸른노무법인_홍길동_명함.jpg' && !a.cid),
    '받는 사람 메일에 푸른노무법인_홍길동_명함.jpg 정식 첨부파일이 실려야 한다'
  );
  assert.ok(
    pushedSentBox[0] && pushedSentBox[0].names.includes('푸른노무법인_홍길동_명함.jpg'),
    '보낸메일함(sentBox) 첨부 이름에도 명함 파일명이 기록되어야 한다'
  );

  const slim = MD.slimPayload({ to: 'client@gana.kr', subject: '예약', body: '본문', attachMyCard: true });
  assert.equal(slim.attachMyCard, true, '예약 메일 페이로드(slimPayload)에도 attachMyCard 가 유지되어야 한다');

  // 동명이인 외부 거래처 명함만 있거나 autoAttach:false 인 경우에는 제3자 개인정보 보호를 위해 첨부하지 않는다
  const sentGuard = [];
  const guardDbData = {
    'uid_roles/uid-lee': { sid: 'A-901', status: 'active' },
    'data/user_dir': [{ sid: 'A-901', name: '이몽룡', title: '사무장', status: 'active' }],
    'pucards/idx': {
      '-P6ClientSameName': { k: 'card', n: '이몽룡', c: '가나건설' },
    },
    'pucards/thumbs/-P6ClientSameName': SAMPLE_JPG,
    'pucards/items/-P6ClientSameName': { id: '-P6ClientSameName', name: '이몽룡', company: '가나건설' },
    'pucards/config/matMail/track': false,
  };
  await MD.deliver({
    db: {
      ref: (p) => ({
        once: async () => ({ val: () => guardDbData[p] ?? null }),
        push: async () => ({ key: 'p2' }),
        set: async () => {},
      }),
    },
    from: '370-6@daum.net',
    pass: 'app-pass-ok',
    byEmail: 'a901@pureun.kr',
    uid: 'uid-lee',
    nodemailer: { createTransport: () => ({ sendMail: async (m) => { sentGuard.push(m); return { messageId: 'm2' }; } }) },
    copy: { mode: 'skip' },
    body: { to: 'client@gana.kr', subject: '안내', body: '본문', html: '<p>본문</p>', matIds: [], files: [], attachMyCard: true, track: false },
  });
  assert.equal(sentGuard[0].attachments.length, 0, '동명이인 외부 거래처 명함은 절대 첨부되어 나가면 안 된다');
});

test('★★★ pu-cards 화면: 본인 최근 푸른노무법인 명함 우선 선택 · 첨부칸 자동 표시 · 빈 편지 미오염 · 단체메일 제외', () => {
  const storeMem = {};
  const ctx = {
    Object, String, Number, Array, Boolean, Math, Date, RegExp, Promise, JSON,
    console,
    localStorage: {
      getItem: (k) => storeMem[k] || null,
      setItem: (k, v) => { storeMem[k] = String(v); },
      removeItem: (k) => { delete storeMem[k]; },
    },
    DB_ROOT: 'pucards',
    MAIL_MAX_BYTES: 10 * 1024 * 1024,
    MYSIGN_OFF_LS: 'pucards_mysign_off_',
    Store: { mode: 'local', getThumb: async () => SAMPLE_JPG },
    myEmail: 'p901@pureun.kr',
    _matMail: { from: '370-6@daum.net', mode: 'auto', perUser: {} },
    _matMeta: {},
    _signThumb: SAMPLE_JPG,
    _compose: null,
    state: {
      view: 'mail',
      isAdmin: false,
      edMode: 'editor',
      attFold: false,
      items: {
        c_assoc: { id: 'c_assoc', kind: 'card', name: '홍길동', company: '한국공인노무사회', updatedAt: 9000 },
        c_old_pu: { id: 'c_old_pu', kind: 'card', name: '홍길동', company: '푸른 노무법인', updatedAt: 5000 },
        c_latest_pu: { id: 'c_latest_pu', kind: 'card', name: '홍길동', company: '푸른 노무법인', title: '공인노무사', mobile: '010-1234-5678', updatedAt: 8000 },
        c_other: { id: 'c_other', kind: 'card', name: '김영희', company: '푸른 노무법인', updatedAt: 9500 },
      },
    },
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    $: () => null,
    toast: () => {},
    renderMailPage: () => {},
    mbMyName: () => '홍길동',
    matMailCfg: () => ctx._matMail,
    attachTotal: () => 0,
    fmtMB: (b) => Math.round(b / 1024) + 'KB',
    matIcon: () => '📄',
    edKeep: (k) => (k === 'font' ? '맑은고딕' : '10'),
    ED_TOOLS: [],
    signPreviewHtml: (h) => h,
    composeHtml: (c) => c.html || '',
    htmlToTextC: (h) => String(h || '').replace(/<[^>]*>/g, ''),
  };
  vm.createContext(ctx);
  [
    'function signKeyC(', 'function mySignKey(', 'function mySign(', 'function safeCardImgSrc(', 'function loadSignThumb(',
    'function isPureunFirmName(', 'function findMyLatestPureunCard(', 'function myCardAutoAttachOn(',
    'function mySignCardItem(', 'function estimateDataUrlBytes(', 'function myCardAttachInfo(',
    'function myCardAttachActive(', 'function myCardShouldAttachNow(', 'function grabCompose(',
    'function toggleComposeMyCard(', 'function ensureMyPureunCard(', 'function composeTouched(',
    'function mailWriteHtml(',
  ].forEach((sig) => {
    vm.runInContext(sliceFn(app, sig), ctx);
  });
  vm.runInContext('var _ensuringMyCard = false;', ctx);

  // 1) 외부 단체 명함(updatedAt 9000)보다 푸른 노무법인 최근 명함(c_latest_pu, 8000 > 5000)을 골라야 한다
  const picked = ctx.findMyLatestPureunCard();
  assert.equal(picked.id, 'c_latest_pu', '본인의 가장 최근 푸른 노무법인 명함을 먼저 골라야 한다');

  // 2) ensureMyPureunCard 실행 시 자동으로 perUser 에 연결된다
  ctx.ensureMyPureunCard();
  assert.equal(ctx.mySign().cardId, 'c_latest_pu');

  // 3) 새 메일 작성 화면에 내 명함 자동첨부 칩이 표시되지만 빈 편지의 composeTouched 는 false 여야 한다
  ctx._compose = { to: '', cc: '', subject: '', body: '기본서명', html: '<p>기본서명</p>', base: { subject: '', body: '기본서명' }, ids: [], files: [] };
  assert.equal(ctx.composeTouched(ctx._compose), false, '명함 자동첨부 때문에 아무것도 안 쓴 빈 편지가 임시저장 대상으로 잡히면 안 된다');
  const writeHtml = ctx.mailWriteHtml();
  assert.match(writeHtml, /푸른노무법인_홍길동_명함\.jpg/, '첨부칸에 본인 명함 파일명이 자동으로 보여야 한다');
  assert.match(writeHtml, /내 명함 자동첨부/, '내 명함 자동첨부 안내가 표시되어야 한다');

  // 4) 이번 메일에서 ✕ 로 빼면 빠지고 [+ 📇 내 명함 첨부] 복구 단추가 나타난다
  ctx.toggleComposeMyCard(false);
  const afterDropHtml = ctx.mailWriteHtml();
  assert.doesNotMatch(afterDropHtml, /내 명함 자동첨부/);
  assert.match(afterDropHtml, /내 명함 첨부/, '이번 메일에서 뺀 뒤 다시 붙일 수 있는 단추가 보여야 한다');

  // 5) 단체 묶음 발송(bulk)에서는 개인 명함을 자동 첨부하지 않는다
  ctx._compose = { bulk: [{ email: 'a@gana.kr' }], ids: [], files: [] };
  assert.equal(ctx.myCardAttachActive(ctx._compose), false, '단체 묶음 메일에는 개인 명함 자동첨부를 끄고 발송해야 한다');

  // 6) cleared 표식이 저장된 직원은 다른 기기에서도 자동 되살아나지 않는다
  ctx._matMail.perUser['p901@pureun_kr'] = { cleared: true, autoAttach: false, at: 9999 };
  ctx.ensureMyPureunCard();
  assert.equal(ctx.mySign().cleared, true, '빼기(cleared) 상태는 자동 매칭으로 덮어쓰지 않아야 한다');
  assert.equal(ctx.myCardAutoAttachOn(), false);
});
