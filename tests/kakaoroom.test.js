'use strict';
/* 법인 카카오톡 방 (pu-kakaoroom.html · js/pu-kakaoroom-core.js) 규칙 검증
 * ⚠ 여기서는 값이 아니라 규칙(안전 판별·마스킹·온톨로지 강제 계약·보안규칙·앱 연동)을 본다.
 * ⚠ 예시 인물·주민번호·계좌·전화는 모두 지어낸 가짜 값이다.
 * 실행: node --test tests/kakaoroom.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const Core = require(path.join(ROOT, 'js', 'pu-kakaoroom-core.js'));
const O = require(path.join(ROOT, 'js', 'pu-ontology.js'));
const W = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));

test('OTP·인증번호·보안코드는 자동 차단(blocked)하고 일반 사건번호·날짜는 차단하지 않는다', () => {
  assert.equal(Core.isOtpOrSecret('[Web발신] 카카오 인증번호 482910 타인 노출 금지'), true);
  assert.equal(Core.isOtpOrSecret('일회용 비밀번호 OTP 739120 입력 요청'), true);
  assert.equal(Core.isOtpOrSecret('API_KEY=abcdefghij1234567890'), true);

  assert.equal(Core.isOtpOrSecret('경기2026부해3347 답변서 제출기한 2026-12-04까지 연장 신청'), false);
  assert.equal(Core.isOtpOrSecret('가나제조 자문-2026-019 회의 14:30 진행'), false);

  const b = Core.assessSafety({ sender: '문자', text: '[Web발신] 본인확인번호 551290 입니다' });
  assert.equal(b.verdict, 'blocked');
  assert.equal(b.safeText, '');
});

test('주민번호·카드·계좌·비밀번호는 가리고 업무용 전화번호는 보존한다', () => {
  const raw = '홍길동 900101-1234567 하이픈없는 9001011234567 카드 1111-2222-3333-4444 계좌 110-123-456789 비번: secret99 전화 010-1111-2222';
  const out = Core.stripSecrets(raw);
  assert.equal(out.hadSecret, true);
  assert.ok(out.redactedCount >= 4);
  assert.ok(!/900101-1234567/.test(out.text), '주민번호가 남았다');
  assert.ok(!/9001011234567/.test(out.text), '하이픈 없는 주민번호가 남았다');
  assert.ok(!/1111-2222-3333-4444/.test(out.text), '카드번호가 남았다');
  assert.ok(!/110-123-456789/.test(out.text), '계좌번호가 남았다');
  assert.ok(!/secret99/.test(out.text), '비밀번호가 남았다');
  assert.ok(/010-1111-2222/.test(out.text), '업무용 전화번호가 지워졌다');

  const res = Core.assessSafety({ sender: '박담당', text: raw });
  assert.equal(res.verdict, 'redacted');

  const fileMasked = Core.buildArchiveRecord({
    room: '푸른노무법인 업무채팅방',
    day: '2026-11-28',
    domain: 'case',
    safety: 'safe',
    d: { text: '서류 공유', who: ['김보람'], n: 1 },
    g: { files: ['등본_900101-1234567.pdf'], caseNos: [], msgs: [] },
    companyHint: '한빛_900101-1234567',
    note: '900101-1234567 확인',
  }, { actor: 'P-001' });
  assert.equal(fileMasked.safety, 'redacted');
  assert.ok(!/900101-1234567/.test(JSON.stringify(fileMasked)), 'fileNames/companyHint/note에 주민번호가 남으면 안 됩니다');
});

test('단순 응답·잡담·내용 없는 시스템 알림은 제외(noise)하고 실질 업무 문장은 유지한다', () => {
  assert.equal(Core.isNoiseMessage('네'), true);
  assert.equal(Core.isNoiseMessage('네 확인했습니다'), true);
  assert.equal(Core.isNoiseMessage('확인했습니다'), true);
  assert.equal(Core.isNoiseMessage('사진을 보냈습니다.'), true);
  assert.equal(Core.isNoiseMessage('홍길동님이 들어왔습니다.'), true);
  assert.equal(Core.isNoiseMessage('확인했습니다 내일 오전까지 가나제조 답변서 초안 전달하겠습니다'), false);

  assert.equal(Core.assessSafety({ sender: '이노무사', text: '네' }).verdict, 'noise');
  assert.equal(Core.assessSafety({ sender: '이노무사', text: '가나제조 답변서 초안 송부 완료했습니다' }).verdict, 'safe');
});

test('민감 파일명은 서버·사진첩 전송에서 제외하고 PC에만 보관(pc)으로 지정한다', () => {
  assert.equal(Core.isSensitiveFileName('홍길동_신분증_사본.jpg'), true);
  assert.equal(Core.isSensitiveFileName('가나제조_급여대장_11월.xlsx'), true);
  assert.equal(Core.isSensitiveFileName('답변서_연장신청서.hwpx'), false);

  const sensRec = Core.buildFileRecord({ name: '근로자_통장사본.pdf', sender: '박담당', sentAt: 1700000000000, dest: 'photo' }, { actor: 'P-001' });
  assert.equal(sensRec.sensitive, true);
  assert.equal(sensRec.dest, 'pc', '민감 파일은 photo 로 요청해도 pc 로 강제되어야 합니다');

  const checkSens = W.inspectWrite({ kind: 'set', path: 'kakao_room/files/' + sensRec.id, value: sensRec, mode: 'enforce' });
  assert.equal(checkSens.ok, true, JSON.stringify(checkSens.issues));
});

test('6대 업무 영역 자동 분류 및 빠른 붙여넣기 파싱이 동작한다', () => {
  assert.equal(Core.classifyDomain('부당해고 답변서 제출', ['경기2026부해3347']), 'case');
  assert.equal(Core.classifyDomain('근로복지기금 출연 정관 인가', []), 'fund');
  assert.equal(Core.classifyDomain('일터혁신 컨설팅 중간보고 일정', []), 'consult');
  assert.equal(Core.classifyDomain('4대보험 취득신고 및 급여명세서 확인', []), 'payroll');
  assert.equal(Core.classifyDomain('자문계약서 및 취업규칙 검토', []), 'advisory');

  const paste = [
    '2026년 11월 28일 토요일',
    '[김노무사] [오전 9:30] 경기2026부해3347 답변서 12월 4일까지 제출입니다.',
    '[이노무사] [오전 9:31] 네 확인했습니다',
    '[문자알림] [오전 9:32] [Web발신] 카카오 인증번호 881234',
    '[김노무사] [오전 9:33] 파일: 답변서_최종.hwpx',
  ].join('\n');
  const parsed = Core.parseQuickPaste(paste, '푸른노무법인 업무채팅방');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.messages.length, 3);
  assert.equal(parsed.files.length, 1);
});

test('사건번호 정확 일치만 확정 후보(sure), 업체명만 일치(guess)는 이름으로 id 를 채우지 않는다', () => {
  const t = Date.UTC(2026, 10, 28, 1, 0, 0);
  const raw = [
    { sender: '김노무사', at: t, text: '경기2026부해3347 답변서 검토 요청' },
    { sender: '이노무사', at: t + 1000, text: '네' },
    { sender: '문자', at: t + 2000, text: '[Web발신] 인증번호 123456' },
    { sender: '박담당', at: t + 3600000, text: '가나제조 자문 검토 900101-1234567 확인요' },
  ];
  const out = Core.analyzeMessages(raw, {
    room: '푸른노무법인 업무채팅방',
    workItems: [
      { id: 'wk1', no: '경기2026부해3347', stageNos: [], key: '가나제조', open: true },
      { id: 'wk2', no: '자문-2026-01', stageNos: [], key: '가나제조', open: true },
    ],
    companies: [{ key: '가나제조', name: '가나제조', label: '가나제조(주)', id: 'co1' }],
    now: t,
  });

  assert.equal(out.stats.blockedCount, 1);
  assert.equal(out.stats.noiseCount, 1);
  assert.equal(out.rows.length, 2);

  const sureRow = out.rows.find((r) => r.m.basis === 'sure');
  assert.ok(sureRow);
  assert.equal(sureRow.itemId, 'wk1');
  assert.equal(sureRow.on, true);

  const guessRow = out.rows.find((r) => r.m.basis === 'guess');
  assert.ok(guessRow);
  assert.equal(guessRow.itemId, '', '업체명 일치만으로 workItemId 를 자동 채우면 안 됩니다');
  assert.equal(guessRow.on, false);
  assert.equal(guessRow.safety, 'redacted');
});

test('영구 보관 레코드와 work_erp 진행기록이 PuOntologyWrite 강제(enforce) 관문을 통과하고 companyName 을 쓰지 않는다', () => {
  const t = Date.UTC(2026, 10, 28, 1, 0, 0);
  const out = Core.analyzeMessages(
    [{ sender: '김노무사', at: t, text: '경기2026부해3347 답변서 제출 완료' }],
    {
      room: '푸른노무법인 업무채팅방',
      workItems: [{ id: 'wk1', no: '경기2026부해3347', stageNos: [], key: '가나제조', open: true }],
      companies: [],
      now: t,
    }
  );
  const row = out.rows[0];
  const arch = Core.buildArchiveRecord(row, { now: t, actor: 'P-001', room: '푸른노무법인 업무채팅방', companyId: '' });
  assert.match(arch.id, /^kr_[a-z0-9_]+$/);
  assert.equal(arch.entityType, 'KakaoWorkArchive');
  assert.equal('companyName' in arch, false, 'companyId 없는 companyName 필드를 넣으면 온톨로지 관문에서 차단됩니다');

  const archCheck = W.inspectWrite({ kind: 'set', path: 'kakao_room/items/' + arch.id, value: arch, mode: 'enforce' });
  assert.equal(archCheck.ok, true, JSON.stringify(archCheck.issues));

  const wp = Core.buildWorkLogPayload(row, 'wk1', { sid: 'P-001', name: '점검대표' }, t);
  assert.ok(wp);
  assert.equal(wp.logRecord.k, 'kt');
  assert.equal(wp.logRecord.entityType, 'Message');
  assert.equal(wp.itemLogRecord.w, wp.week);

  const logCheck = W.inspectWrite({ kind: 'set', path: wp.logPath, value: wp.logRecord, mode: 'enforce' });
  const ilogCheck = W.inspectWrite({ kind: 'set', path: wp.itemLogPath, value: wp.itemLogRecord, mode: 'enforce' });
  assert.equal(logCheck.ok, true, JSON.stringify(logCheck.issues));
  assert.equal(ilogCheck.ok, true, JSON.stringify(ilogCheck.issues));

  const joined = Core.joinWorkProgress(
    { [arch.id]: Object.assign({}, arch, { companyId: 'co1' }) },
    { wk1: { id: 'wk1', no: '경기2026부해3347', title: '부당해고 대응', status: '진행중', mgr_main: { name: '점검노무' } } },
    { co1: { id: 'co1', name: '가나제조(주)' } }
  );
  assert.equal(joined.length, 1);
  assert.equal(joined[0].workLinked, true);
  assert.equal(joined[0].workState, '진행중');
  assert.equal(joined[0].companyLabel, '가나제조(주)');
});

test('화면·온톨로지·포털·앱바·보안규칙이 한 벌로 연결되어 있다', () => {
  const html = read('pu-kakaoroom.html');
  const appJs = read('js/pu-kakaoroom-app.js');
  const enter = read('enter.html');
  const appbar = read('js/pu-appbar.js');

  /* 화면 규칙: 주민번호 지우개, 공용 게이트, Whoami, 뒤로가기, 온톨로지 강제 관문 */
  assert.match(html, /js\/pu-rrn-mask\.js\?v=\d+/);
  assert.match(html, /js\/pu-ontology\.js\?v=\d+/);
  assert.match(html, /js\/pu-ontology-write\.js\?v=\d+[^>]*data-mode="observe"/);
  assert.match(html, /js\/pu-appbar\.js\?v=\d+/);
  assert.match(html, /PuGate\.show\(/);
  assert.match(html, /PuWhoami\.mount\(/);
  assert.match(html, /PuBack\.guard\(/);
  assert.match(html, /id="recent-diff-bar"/);
  assert.match(appJs, /maskRrnInText/);
  assert.match(appJs, /createGateway\(\{\s*mode:\s*'enforce'/);

  /* 포털·앱바·온톨로지 등록 */
  assert.match(enter, /key:'kakaoroom',\s*name:'법인 카카오톡 방'[\s\S]{0,160}?url:'pu-kakaoroom\.html'[\s\S]{0,60}?row:'store'/);
  assert.match(appbar, /key:\s*'kakaoroom'[\s\S]{0,160}?url:\s*'pu-kakaoroom\.html'/);
  assert.ok(O.TERMS.entityTypes.KakaoWorkArchive);
  assert.ok(O.TERMS.entityTypes.KakaoFileRecord);
  assert.ok(O.PROGRAMS.kakaoroom);
  assert.equal(O.PROGRAMS.kakaoroom.file, 'pu-kakaoroom.html');
  assert.ok(O.READ_ADAPTERS.kakaoroom_core);

  /* 실시간DB 보안규칙: kakao_room 재직 직원만, 물리 삭제 금지, companyName 금지 */
  const rulesOut = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const kr = rulesOut.rules.kakao_room;
  assert.ok(kr, 'kakao_room 보안규칙이 없습니다');
  assert.match(kr['.read'], /status'\)\.val\(\) === 'active'/);
  assert.match(kr.items.$id['.write'], /newData\.exists\(\)/);
  assert.match(kr.items.$id['.validate'], /KakaoWorkArchive/);
  assert.match(kr.items.$id['.validate'], /!newData\.hasChild\('companyName'\)/);
  assert.match(kr.items.$id['.validate'], /_deleted/);
  assert.equal(kr.items.$id.$other['.validate'], false);
  assert.equal(kr.items.$id.redactedCount['.validate'], 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000');
  assert.match(kr.files.$id['.validate'], /KakaoFileRecord/);
  assert.equal(kr.files.$id.$other['.validate'], false);
  assert.equal(kr.watcher['.write'], false);
});

test('비밀번호 가림이 멱등(2회 적용 안전)이고 spinning 오탐이 없으며 30일 원문 서버 보관 필터가 동작한다', () => {
  const once = Core.stripSecrets('비번: secret1234 확인 · spinning 설비 · pinned 메모 점검');
  assert.equal(once.text, '비번: [비밀번호 가림] 확인 · spinning 설비 · pinned 메모 점검');
  const twice = Core.stripSecrets(once.text);
  assert.equal(twice.text, once.text, '이미 가린 [비밀번호 가림] 이 다시 가려지면 안 됩니다');

  const now = Date.UTC(2026, 10, 28, 3, 0, 0);
  const prep = Core.prepareServerImport([
    { sender: '김노무', sentAt: now - 40 * 86400000, text: '30일 지난 옛 대화' },
    { sender: '문자', sentAt: now - 1000, text: '[Web발신] 카카오 인증번호 991234' },
    { sender: '박담당', sentAt: now - 500, text: '비번: temp9876 변경 완료' },
    { sender: '이노무', sentAt: now - 100, text: '신규 업무 보고' }
  ], [
    { sender: '이노무', sentAt: now - 100, name: '안내.pdf' },
    { sender: '이노무', sentAt: now - 40 * 86400000, name: '옛날.pdf' }
  ], { now, keepDays: 30, maxLines: 5000 });

  assert.equal(prep.oldCount, 1);
  assert.equal(prep.blockedCount, 1);
  assert.equal(prep.lines.length, 2);
  assert.ok(!/991234/.test(JSON.stringify(prep.lines)));
  assert.ok(!/temp9876/.test(JSON.stringify(prep.lines)));
  assert.equal(prep.lines[0].text, '비번: [비밀번호 가림] 변경 완료');
  assert.equal(prep.files.length, 1);

  const appJs = read('js/pu-kakaoroom-app.js');
  assert.match(appJs, /prev && prev\._deleted/);
  assert.match(appJs, /prepareServerImport\(/);
  assert.match(appJs, /esc\(String\(n\)\)/);
});

test('사람별·사건별·공유건별 대시보드 자동 집계와 공유 유형 분류가 정확히 동작한다', () => {
  const now = Date.UTC(2026, 10, 28, 3, 0, 0);
  assert.equal(Core.classifyShareType('근로감독관 시정지시 제출 요청', []).key, 'directive');
  assert.equal(Core.classifyShareType('경기2026부해3347 답변서 연장신청서', []).key, 'submission');
  assert.equal(Core.classifyShareType('스캔 공유', ['시정지시서(이미지)']).key, 'document');
  assert.equal(Core.classifyShareType('[공지] 법인 AI 계정 안내드립니다', []).key, 'notice');
  assert.equal(Core.classifyShareType('방문 확인 결과 전화 부재중 확인되면 말씀드리겠습니다', []).key, 'progress');
  assert.equal(Core.classifyShareType('담당감독관 전화 부재중 시정지시 확인되면 말씀드리겠습니다', []).key, 'directive');

  const workItems = {
    wk1: { id: 'wk1', no: '경기2026부해3347', title: '가나제조 부당해고 구제신청', status: '진행중', co_id: 'co1', mgr_main: { name: '점검노무' } },
  };
  const companies = { co1: { id: 'co1', name: '가나제조(주)' } };
  const archive = {
    kr_001: {
      id: 'kr_001', room: '푸른노무법인 업무채팅방', day: '2026-11-28',
      senders: ['김보람', '이노무'], domain: 'case', safety: 'safe', redactedCount: 0,
      summary: '💬 카톡 · 김보람 — 시정지시서 2026.12.11. 까지 제출 안내',
      caseNos: ['경기2026부해3347'], due: '2026-12-02', fileNames: ['시정지시서(이미지)'],
      workItemId: 'wk1', companyId: 'co1', status: 'open', updatedAt: now - 1000,
    },
    kr_002: {
      id: 'kr_002', room: '푸른노무법인 업무채팅방', day: '2026-11-27',
      senders: ['김보람'], domain: 'case', safety: 'safe', redactedCount: 0,
      summary: '💬 카톡 · 김보람 — 답변서 초안 검토 요청',
      caseNos: [], due: '', fileNames: [],
      workItemId: '', companyId: '', companyHint: '다라물류', status: 'tracking', updatedAt: now - 2000,
    },
    kr_deleted: {
      id: 'kr_deleted', _deleted: true, room: '푸른노무법인 업무채팅방', day: '2026-11-28',
      senders: ['삭제자'], domain: 'admin', safety: 'safe', redactedCount: 0,
      summary: '삭제됨', workItemId: '', status: 'open',
    },
  };

  const joined = Core.joinWorkProgress(archive, workItems, companies, { now });
  assert.equal(joined.length, 2);
  const summary = Core.buildDashboardSummary(joined, workItems, companies, { now });

  assert.equal(summary.totals.totalRows, 2);
  assert.equal(summary.totals.personCount, 2);
  assert.equal(summary.totals.caseCount, 2);
  assert.equal(summary.totals.linkedCaseCount, 1);
  assert.equal(summary.totals.dueSoonCount, 1);
  assert.equal(summary.totals.unlinkedCount, 1);

  const boram = summary.byPerson.find((p) => p.name === '김보람');
  assert.ok(boram);
  assert.equal(boram.total, 2);
  assert.equal(boram.unlinkedCount, 1);
  assert.equal(boram.dueSoonCount, 1);

  const wkCase = summary.byCase.find((c) => c.workItemId === 'wk1');
  assert.ok(wkCase);
  assert.equal(wkCase.dueDaysLeft, 4);
  assert.deepEqual(wkCase.files, ['시정지시서(이미지)']);
  assert.equal(summary.byTopic[0].shareType, 'directive');
});

test('PC 화면·하단알림 OCR 파서가 등록 방의 말풍선·시정지시서·기한을 구조화하고 미등록 개인방 팝업을 차단한다', () => {
  const now = Date.UTC(2026, 10, 28, 3, 0, 0);
  const ocrLines = [
    { x: 66, y: 52, text: '푸른노무법인 업무大H팅방' },
    { x: 256, y: 61, text: 'Q 9' },
    { x: 29, y: 112, text: '7, 법인 AI 유료 구독 계정 안내드립니다. 동시 로..' },
    { x: 72, y: 152, text: '.12.11. 까지 제출하시기 바랍니다.' },
    { x: 73, y: 234, text: '담당감독관: 대전지방고용노동정서산' },
    { x: 72, y: 252, text: '지정 노동기준감독과 근로감독관 이' },
    { x: 72, y: 268, text: '수미(0416615645)' },
    { x: 306, y: 278, text: '오전 1108' },
    { x: 64, y: 306, text: '김보람' },
    { x: 72, y: 335, text: '현재 노동포털에 관련 정보 조회 안되' },
    { x: 72, y: 352, text: '고 담당감독관이 전화 부재중이어서' },
    { x: 74, y: 368, text: '내용 확인을 하지 못했습니다.' },
    { x: 306, y: 412, text: '오전 11:14' },
    { x: 64, y: 440, text: '김보람' },
    { x: 150, y: 495, text: '시 정 지 시 서' },
    { x: 14, y: 542, text: '예시지 입력' },
  ];

  const res = Core.parseOcrChatLines(ocrLines, {
    surface: 'room',
    room: '푸른노무법인 업무채팅방',
    allowedRooms: ['푸른노무법인 업무채팅방'],
    imageHeight: 650,
    nowMs: now,
  });
  assert.equal(res.ok, true);
  assert.equal(res.room, '푸른노무법인 업무채팅방');
  assert.ok(!res.messages.some((m) => /예시지 입력/.test(m.text)), '하단 입력창 글자가 섞이면 안 됩니다');
  assert.ok(res.messages.some((m) => /2026\.12\.11\. 까지 제출/.test(m.text) && /고용노동청/.test(m.text)));
  assert.ok(res.messages.some((m) => m.sender === '김보람' && /부재중/.test(m.text)));
  assert.ok(res.messages.some((m) => m.sender === '김보람' && /\[이미지 공유: 시정지시서\]/.test(m.text)));
  assert.deepEqual(res.files.map((f) => f.name), ['시정지시서(이미지)']);

  /* 하단 알림 팝업: 미등록 개인방 차단 vs 등록 법인방 허용 */
  const blockedPop = Core.parseOcrChatLines([
    { x: 10, y: 10, text: '친구 개인톡방' },
    { x: 10, y: 30, text: '홍길동' },
    { x: 10, y: 50, text: '오늘 저녁 7시 약속' },
  ], { surface: 'popup', allowedRooms: ['푸른노무법인 업무채팅방'], nowMs: now });
  assert.equal(blockedPop.ok, false);
  assert.equal(blockedPop.reason, 'room-not-allowed');

  const okPop = Core.parseOcrChatLines([
    { x: 10, y: 10, text: '푸른노무법인 업무채팅방' },
    { x: 10, y: 30, text: '김보람' },
    { x: 10, y: 50, text: '경기2026부해3347 시정지시서 도착했습니다' },
  ], { surface: 'popup', allowedRooms: ['푸른노무법인 업무채팅방'], nowMs: now });
  assert.equal(okPop.ok, true);
  assert.equal(okPop.messages[0].sender, '김보람');
  assert.match(okPop.messages[0].text, /시정지시서/);

  /* 유사 방 이름·글자 순서 뒤섞기 차단 (단순 문자 주머니 오탐 금지) */
  assert.equal(Core.matchAllowedRoom('푸른노무법인 업무방', ['푸른노무법인 업무채팅방'], { maxDist: 1 }), '');
  assert.equal(Core.matchAllowedRoom('방채팅무업법노른푸', ['푸른노무법인 업무채팅방'], { maxDist: 2 }), '');
  assert.equal(Core.matchAllowedRoom('푸른노무법인 업무大H팅방', ['푸른노무법인 업무채팅방'], { maxDist: 1 }), '푸른노무법인 업무채팅방');

  /* 화면 날짜 구분선 인식 및 구분선 이전 말풍선 dayInferred 표시 */
  const daySplit = Core.parseOcrChatLines([
    { x: 64, y: 100, text: '김노무' },
    { x: 72, y: 120, text: '날짜 구분선 위쪽 보고' },
    { x: 306, y: 140, text: '오후 5:00' },
    { x: 120, y: 170, text: '2026년 11월 27일 금요일' },
    { x: 64, y: 200, text: '김노무' },
    { x: 72, y: 220, text: '어제 날짜 구분선 아래 보고' },
    { x: 306, y: 240, text: '오후 6:10' },
  ], { surface: 'room', room: '푸른노무법인 업무채팅방', allowedRooms: ['푸른노무법인 업무채팅방'], imageHeight: 650, nowMs: now });
  assert.equal(daySplit.ok, true);
  assert.equal(daySplit.messages[0].dayInferred, true);
  assert.equal(daySplit.messages[1].day, '2026-11-27');
  assert.equal(daySplit.messages[1].dayInferred, false);
});

test('푸른인사관리 사번 기준 1줄 표 집계 및 첨부서류·푸른메일 발송일시 대조가 누락 없이 동작한다', () => {
  const now = Date.UTC(2026, 10, 28, 5, 0, 0); /* 14:00 KST */

  assert.ok(Core.compareSid('P001', 'P002') < 0);
  assert.ok(Core.compareSid('P002', 'P010') < 0);
  assert.ok(Core.compareSid('P001', '') < 0);

  const staff = Core.normalizeHrStaff(
    {
      v: {
        P010: { sid: 'P010', name: '점검주임', pos: '주임', dept: '지원', status: 'active' },
        P001: { sid: 'P001', name: '점검노무', pos: '대표', dept: '총괄' },
        P002: { sid: 'P002', name: '점검대리', pos: '대리', dept: '기금', status: 'active' },
        P005: { sid: 'P005', name: '점검동명', pos: '노무사', dept: '자문', status: 'active' },
        P007: { sid: 'P007', name: '점검동명', pos: '주임', dept: '지원', status: 'active' },
        P099: { sid: 'P099', name: '퇴사점검', pos: '사원', dept: '지원' },
      },
    },
    {
      P001: { sid: 'P001', name: '점검노무', status: 'active' },
      P003: { sid: 'P003', name: '점검사무', roleTitle: '팀장', status: 'active' },
      P099: { sid: 'P099', name: '퇴사점검', status: 'retired' },
    }
  );
  assert.deepEqual(staff.map((s) => s.sid), ['P001', 'P002', 'P003', 'P005', 'P007', 'P010']);
  assert.equal(staff.find((s) => s.sid === 'P001').title, '대표', 'user_dir 에 status 가 없어도 병합 시 pos/dept 가 유지됩니다');
  assert.equal(staff.find((s) => s.sid === 'P001').dept, '총괄');
  assert.equal(Core.matchStaffByName('점검노무 대표노무사님', staff).sid, 'P001');
  assert.equal(Core.matchStaffByName('P003', staff).name, '점검사무');
  assert.equal(Core.matchStaffByName('점검동명', staff), null, '동명이인은 첫 번째 사번으로 추측 귀속하지 않습니다');

  const mails = Core.extractSentMails(
    {
      sent_a: { kind: 'sent', name: '보낸편지함' },
      tome_a: { kind: 'tome', name: '내게쓴메일함' },
      inbox_a: { kind: 'inbox', name: '받은편지함' },
    },
    {
      sent_a: {
        m1: { d: now - 3600000, f: '점검노무', tn: '기관담당', t: 'gov@example.com', s: '[경기2026부해3347] 답변서_연장신청서 제출', a: 1, an: ['답변서_연장신청서.hwpx'] },
        m2: { d: now - 600000, f: '점검대리', t: '감독관', s: '[서산2026시정108] 시정지시서 회신', a: 1, an: ['시정지시서.pdf'] },
        m_old_generic: { d: now - 150 * 86400000, f: '점검노무', t: '타사', s: '타사 위임장 송부', a: 1, an: ['위임장.pdf'] },
        m_other_co: { d: now - 500000, f: '점검노무', t: '타사', s: '[타사주식회사] 10월 급여 안내', a: 1, an: ['임금명세서_2026_10_타사.xlsx'] },
        m_before_chat: { d: now - 20 * 86400000, f: '점검노무', t: '가나제조', s: '사전 위임장 초안', a: 1, an: ['사전합의안_2026_1108.hwpx'] },
        m_old: { d: now - 220 * 86400000, f: '점검노무', t: '기관', s: '오래된 메일', a: 1, an: ['옛문서.pdf'] },
      },
      tome_a: {
        m_tome: { d: now - 1000, f: '점검노무', t: '점검노무', s: '내게쓴 메모 위임장', a: 1, an: ['위임장.pdf'] },
      },
      inbox_a: {
        m_in: { d: now - 1000, f: '외부', t: '점검노무', s: '답변서_연장신청서 수신', a: 1, an: ['답변서_연장신청서.hwpx'] },
      },
    },
    { now, days: 180 }
  );
  assert.equal(mails.length, 5);
  assert.equal(mails.some((m) => m.uid === 'm_tome' || m.uid === 'm_in'), false, '내게쓴메일함·받은편지함은 대외 발송 메일에서 제외합니다');
  assert.equal(mails.find((m) => m.uid === 'm1').to, '기관담당 <gov@example.com>');

  /* 오매칭 방어: 과거 일반문서명, 타사 부분일치, 카톡 이전 메일 */
  const guardRow = { day: '2026-11-28', caseNos: ['경기2026부해3347'], companyHint: '(주)가나제조' };
  assert.equal(Core.matchAttachmentMailSent('위임장.pdf', guardRow, mails), null);
  assert.equal(Core.matchAttachmentMailSent('임금명세서.xlsx', guardRow, mails), null);
  assert.equal(Core.matchAttachmentMailSent('사전합의안_2026_1108.hwpx', guardRow, mails), null);

  const workItems = {
    wk1: { id: 'wk1', no: '경기2026부해3347', title: '가나제조 부당해고', status: '진행중', co_id: 'co1' },
  };
  const companies = { co1: { id: 'co1', name: '가나제조(주)' } };
  const archive = {
    kr_a: {
      id: 'kr_a', room: '푸른노무법인 업무채팅방', day: '2026-11-28',
      senders: ['점검노무'], domain: 'case', safety: 'safe', redactedCount: 0,
      summary: '💬 카톡 · 점검노무 — 답변서 연장신청 제출 · 📎 답변서_연장신청서.hwpx',
      caseNos: ['경기2026부해3347'], due: '2026-12-04', fileNames: [],
      workItemId: 'wk1', companyId: 'co1', status: 'tracking', updatedAt: now - 2000,
    },
    kr_b: {
      id: 'kr_b', room: '푸른노무법인 업무채팅방', day: '2026-11-28',
      senders: ['점검대리'], domain: 'case', safety: 'safe', redactedCount: 0,
      summary: '💬 카톡 · 점검대리 — 서산2026시정108 시정지시 확인 · [이미지 공유: 시정지시서]',
      caseNos: ['서산2026시정108'], due: '2026-12-02', fileNames: [],
      workItemId: '', companyId: '', status: 'open', updatedAt: now - 1000,
    },
    kr_ext: {
      id: 'kr_ext', room: '푸른노무법인 업무채팅방', day: '2026-11-28',
      senders: ['외부게스트'], domain: 'admin', safety: 'safe', redactedCount: 0,
      summary: '💬 카톡 · 외부게스트 — 안내 확인',
      caseNos: [], due: '', fileNames: [],
      workItemId: '', companyId: '', status: 'done', updatedAt: now - 3000,
    },
  };
  const linkedFile = { id: 'f_linked', room: '푸른노무법인 업무채팅방', name: '톡서랍_추가제출본.pdf', sender: '점검대리', sentAt: now, status: 'todo', dest: 'photo' };
  const orphanFile = { id: 'f_orphan', room: '푸른노무법인 업무채팅방', name: '근로자_신분증_사본.pdf', sender: '점검사무', sentAt: now - 10 * 86400000, status: 'todo', dest: 'pc' };

  const joined = Core.joinWorkProgress(archive, workItems, companies, { now });
  const dash = Core.buildStaffRowsDashboard(joined, staff, [linkedFile, orphanFile], mails, { now });

  assert.deepEqual(dash.staffRows.map((sl) => sl.sid || sl.name), ['P001', 'P002', 'P003', 'P005', 'P007', 'P010', '외부게스트']);
  const p1 = dash.staffRows.find((sl) => sl.sid === 'P001');
  assert.equal(p1.attachments.length, 1);
  assert.equal(p1.attachments[0].name, '답변서_연장신청서.hwpx');
  assert.ok(p1.attachments[0].mailSent);
  assert.equal(p1.attachments[0].mailSent.day, '2026-11-28');

  const p2 = dash.staffRows.find((sl) => sl.sid === 'P002');
  assert.equal(p2.attachments.length, 2);
  assert.ok(p2.attachments.find((a) => a.name === '시정지시서(이미지)').mailSent, '일반 문서명(시정지시서)도 사건번호 문맥이 맞으면 메일 발송과 연결됩니다');

  /* 필터 시 orphanFiles=[] 로 재호출해도 이미 연결된 톡서랍 첨부파일과 메일 발송 정보가 보존되어야 함 */
  const filteredDash = Core.buildStaffRowsDashboard([dash.enrichedRows.find((r) => r.id === 'kr_b')], staff, [], mails, { now });
  const p2Filtered = filteredDash.staffRows.find((sl) => sl.sid === 'P002');
  assert.equal(p2Filtered.attachments.length, 2, '검색·필터 중에도 행에 연결된 톡서랍 첨부서류가 유지되어야 합니다');

  const p3 = dash.staffRows.find((sl) => sl.sid === 'P003');
  assert.equal(p3.rows.length, 0);
  assert.equal(p3.attachments.length, 1, '대화 미연결 톡서랍 파일도 사번 직원 행에 누락 없이 집계됩니다');
  assert.equal(p3.attachments[0].sensitive, true);

  const p10 = dash.staffRows.find((sl) => sl.sid === 'P010');
  assert.equal(p10.rows.length, 0);

  const html = read('pu-kakaoroom.html');
  const appJs = read('js/pu-kakaoroom-app.js');
  assert.match(html, /id="chkOnlyActiveStaff"/);
  assert.match(html, /id="btnToggleExpandAll"/);
  assert.match(appJs, /buildStaffRowsDashboard/);
  assert.match(appJs, /loadHrAndMailData/);
  assert.ok(!/ref\(\s*['"]sid_roles/.test(appJs), '온톨로지 미등록 루트 sid_roles 를 직접 읽지 않아야 합니다');
  assert.ok(!/user_accounts/.test(appJs), '최소 권한 원칙상 finOnly data/user_accounts 를 읽지 않아야 합니다');
  assert.ok(!/class="dash-grid"|class="dash-card/.test(appJs), '대시보드 박스 카드를 사용하지 않아야 합니다');
});
