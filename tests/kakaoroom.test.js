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
