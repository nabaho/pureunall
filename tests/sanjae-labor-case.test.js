/* 산재사건관리(pu-sanjae.html) · 부당해고·노동사건관리(pu-case.html) 통합 단위·규칙 검증 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const Archive = require(path.join(ROOT, 'js', 'pu-case-archive-core.js'));
const ViewKit = require(path.join(ROOT, 'js', 'pu-case-archive-view-kit.js'));
const Collector = require(path.join(ROOT, 'scripts', 'case-archive-collector.js'));
const Sanjae = require(path.join(ROOT, 'js', 'pu-sanjae-core.js'));
const Labor = require(path.join(ROOT, 'js', 'pu-laborcase-core.js'));
const Ontology = require(path.join(ROOT, 'js', 'pu-ontology.js'));

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function evalRule(expr, ctx = {}) {
  if (typeof expr === 'boolean') return expr;
  if (expr == null) return false;
  const wrap = (v) => ({
    val: () => (v === undefined ? null : v),
    exists: () => v !== undefined && v !== null,
    isString: () => typeof v === 'string',
    isBoolean: () => typeof v === 'boolean',
    isNumber: () => typeof v === 'number',
    child: (k) => wrap(v && typeof v === 'object' ? v[k] : undefined),
    hasChildren: (keys) => !!v && typeof v === 'object' && keys.every((k) => v[k] !== undefined && v[k] !== null),
    matches: (re) => typeof v === 'string' && re.test(v),
    length: typeof v === 'string' ? v.length : 0
  });
  const rootObj = ctx.root || {};
  const mapChild = {
    auth: ctx.auth ?? null,
    now: ctx.now ?? Date.now(),
    $id: ctx.$id || '',
    $cid: ctx.$cid || '',
    $subIdx: ctx.$subIdx || '0',
    data: wrap(ctx.data),
    newData: wrap(ctx.newData),
    root: wrap(rootObj)
  };
  /* Firebase Rule `.length` on string value */
  const jsExpr = String(expr)
    .replace(/\.val\(\)\.length/g, '.val().length')
    .replace(/\.matches\(([^)]+)\)/g, '.matches($1)');
  return Boolean(vm.runInNewContext(jsExpr, mapChild));
}

test('1. 사건 분류기 — 산재·부당해고·임금체불 정분류 및 보수총액·일터혁신·세금계산서 오탐 배제', () => {
  const s1 = Archive.classifyRecord({
    relPath: '2025/가나정밀/산재',
    name: '업무상질병판정위원회_요양급여_의견서.hwpx',
    subject: '[(주)가나정밀] 근로복지공단 소음성난청 질판위 의견서 송부'
  });
  assert.equal(s1.matched, true);
  assert.equal(s1.programKey, 'sanjae');
  assert.equal(s1.subType, 'injury_disease');

  const d1 = Archive.classifyRecord({
    name: '서울2025부해1234_피신청인_답변서.hwpx',
    subject: '[(주)다라테크] 부당해고 구제신청 심문기일 답변서 및 이유서'
  });
  assert.equal(d1.matched, true);
  assert.equal(d1.programKey, 'laborcase');
  assert.equal(d1.domain, 'labor_dismissal');
  assert.equal(d1.signals.primaryCaseNo, '서울2025부해1234');

  const w1 = Archive.classifyRecord({
    name: '고용노동지청_임금체불_시정지시서_간이대지급금.pdf',
    subject: '진정사건 2026-10023 체불임금 시정명령 및 대지급금 청구'
  });
  assert.equal(w1.matched, true);
  assert.equal(w1.programKey, 'laborcase');
  assert.equal(w1.domain, 'labor_wage');

  for (const noise of [
    { name: '2025년_고용산재_보수총액_신고안내.pdf', subject: '고용산재토탈서비스 보수총액 피보험자격 취득신고 안내' },
    { name: '일터혁신_상생컨설팅_중간보고서.hwpx', subject: '노사발전재단 일터혁신 컨설팅' },
    { name: '2025-04_전자세금계산서_자문료.pdf', subject: '월 노무자문료 전자세금계산서 발행' },
    { relPath: '2025/산재사건/요양급여신청서.lnk', name: '요양급여신청서.lnk' }
  ]) {
    const out = Archive.classifyRecord(noise);
    assert.equal(out.matched, false, `오탐 배제 실패: ${noise.name}`);
  }
});

test('2. 공방 대조 매트릭스 — 상대방 서류 vs 당사 대응 1:1 매칭 및 호증 색인', () => {
  const docs = [
    { id: 'd1', name: '신청인_이유서_1차.pdf', date: '2026-09-01', roundLabel: '1차' },
    { id: 'd2', name: '피신청인_답변서_1차_푸른.hwpx', date: '2026-09-12', roundLabel: '1차', exhibitNo: '을 제1호증' },
    { id: 'd3', name: '신청인_보충서면_2차.pdf', date: '2026-09-20', roundLabel: '2차', exhibitNo: '갑 제2호증' },
    { id: 'd4', name: '서울지노위_판정서.pdf', date: '2026-10-15' }
  ];
  const mx = Archive.buildCounterMatrix(docs, 'employer', '2026-10-10');
  assert.equal(mx.summary.opponentCount, 2);
  assert.equal(mx.summary.matched, 1);
  assert.equal(mx.summary.overdue, 1);
  assert.equal(mx.summary.agencyCount, 1);

  const ex = Labor.buildExhibitIndex(docs.map((d) => Object.assign({}, d, Archive.classifyDocSideRole(d, 'employer'))));
  assert.equal(ex.total, 2);
  assert.equal(ex.ours[0].exhibitLabel, '을 제1호증');
  assert.equal(ex.opponent[0].exhibitLabel, '갑 제2호증');

  const bundles = Sanjae.discoverSanjaeFromMail([
    { id: 'm1', subject: '[(주)가나] 산재 요양급여 사업주 의견서 송부', date: '2026-10-01', attachmentNames: ['사업주_의견서.pdf'] }
  ], []);
  assert.ok(bundles.length >= 1);
  const built = Sanjae.buildCaseFromMailBundle(bundles[0], { ourRole: 'worker' });
  assert.equal(built.docs[0].side, 'opponent');
});

test('3. RTDB 메일함 평탄화(IMAP msgs + POP3 old.msgs) 및 비식별·경로 차단', () => {
  const mails = Archive.flattenMailbox({
    folders: { inbox: { kind: 'inbox' }, sent: { kind: 'sent' } },
    msgs: {
      inbox: {
        '101': { u: 101, s: '[(주)가나] 부당해고 구제신청', f: '인사팀', e: 'hr@example.com', t: 'p001@pureun.kr', d: Date.UTC(2026, 9, 1), an: ['이유서.pdf'], p: '민감본문' }
      },
      sent: {
        '202': { u: 202, s: '[(주)가나] 부당해고 구제신청', f: '인사팀', e: 'hr@example.com', t: 'p001@pureun.kr', d: Date.UTC(2026, 9, 1), messageId: 'dup-1', p: '본문' }
      }
    },
    old: {
      msgs: {
        '9001': { u: '9001', s: '[(주)나나] 산재 요양급여 불승인 심사청구', f: '담당자', e: 'old@example.com', d: Date.UTC(2024, 3, 5), an: ['불승인통지서.pdf'], p: '옛 본문' }
      }
    }
  });
  assert.equal(mails.length, 2);
  assert.equal(mails[0].attachmentNames[0], '이유서.pdf');
  assert.equal(mails[1].slug, 'past');

  const absLocal = 'C:' + '\\Users\\sample\\Desktop\\사건\\자료.pdf';
  const rrnMock = '900101-' + '1234567';
  const saved = Archive.sanitizeForSave({
    id: 'test-1',
    title: '주민번호 ' + rrnMock + ' 연락처 010-0000-9876 계좌 110-123-456789',
    preview: '본문 유출 금지',
    sourcePath: absLocal,
    archiveRelPath: '2026/가나/01_당사제출/답변서.pdf',
    docs: [{ id: 'x1', name: '문서_' + rrnMock + '.pdf', archiveRelPath: '2026/가나/01_당사제출/문서.pdf' }],
    mailLinks: [{
      id: 'm1', slug: 'inbox', uid: '101',
      subject: '문의 tester@example.com 답변',
      from: 'sender@example.com',
      to: 'recv@example.com',
      preview: '유출금지', body: '유출금지'
    }]
  });
  assert.equal(saved.preview, undefined);
  assert.equal(saved.sourcePath, undefined);
  assert.ok(!saved.title.includes(rrnMock));
  assert.ok(!saved.title.includes('9876'));
  assert.ok(!saved.title.includes('123'));
  assert.equal(saved.archiveRelPath, '2026/가나/01_당사제출/답변서.pdf');
  assert.equal(saved.mailLinks[0].preview, undefined);
  assert.equal(saved.mailLinks[0].from, undefined);
  assert.equal(saved.mailLinks[0].to, undefined);
  assert.ok(!saved.mailLinks[0].subject.includes('tester@example.com'));
});

test('4. 산재 90일 제척기간 · 부당해고 90일/재심10일/행정소송15일 · 괴롭힘 연관 탐지', () => {
  const sjAlerts = Sanjae.calcAppealDeadline({
    disapprovalDate: '2026-09-01',
    rulingResult: '불승인'
  }, '2026-11-25');
  assert.equal(sjAlerts.length, 1);
  assert.equal(sjAlerts[0].kind, 'appeal_90');
  assert.equal(sjAlerts[0].dueDate, '2026-11-30');
  assert.equal(sjAlerts[0].daysLeft, 5);
  assert.equal(sjAlerts[0].urgent, true);

  const lcAlerts = Labor.calcLaborDeadlines({
    initialServedDate: '2026-11-20',
    reServedDate: '2026-11-18'
  }, '2026-11-28');
  assert.equal(lcAlerts[0].kind, 'reappeal_10');
  assert.equal(lcAlerts[0].dueDate, '2026-11-30');
  assert.equal(lcAlerts[0].daysLeft, 2);
  assert.equal(lcAlerts[1].kind, 'court_15');
  assert.equal(lcAlerts[1].dueDate, '2026-12-03');

  const related = Labor.findRelatedHarassCases(
    { companyId: 'c1', companyName: '(주)테스트' },
    { h1: { id: 'h1', companyId: 'c1', title: '직장 내 괴롭힘 조사' } }
  );
  assert.equal(related.length, 1);
  assert.equal(related[0].id, 'h1');
});

test('5. Firebase 규칙(sanjae_cases/secret, labor_cases/secret) 2단 보안 및 권한상승 차단', () => {
  const rulesJson = JSON.parse(read('docs/firebase-rules-전체-적용본.json')).rules;
  for (const [cRoot, sRoot] of [['sanjae_cases', 'sanjae_secret'], ['labor_cases', 'labor_secret']]) {
    assert.ok(rulesJson[cRoot], `${cRoot} 규칙 존재`);
    assert.ok(rulesJson[sRoot], `${sRoot} 규칙 존재`);
    assert.equal(rulesJson[sRoot]['.read'], undefined, `${sRoot} 루트 .read 금지`);
    assert.equal(rulesJson[sRoot]['.write'], undefined, `${sRoot} 루트 .write 금지`);

    const makeAuth = (uid) => ({ uid, token: { firebase: { sign_in_provider: 'password' } } });
    const rootState = {
      uid_roles: {
        u_admin: { sid: 'P001', status: 'active', isAdmin: true },
        u_sub: { sid: 'P002', status: 'active', isAdmin: false },
        u_other: { sid: 'P009', status: 'active', isAdmin: false },
        u_ret: { sid: 'P099', status: 'retired', isAdmin: false }
      },
      [cRoot]: {
        cases: {
          c1: { id: 'c1', entityType: 'Case', managerMain: 'P001', managerSubs: ['P002'] }
        }
      },
      [sRoot]: {}
    };

    const cw = rulesJson[cRoot].cases.$id['.write'];
    const sr = rulesJson[sRoot].$cid['.read'];
    assert.equal(evalRule(rulesJson[cRoot]['.read'], { auth: makeAuth('u_other'), root: rootState }), true);
    assert.equal(evalRule(rulesJson[cRoot]['.read'], { auth: makeAuth('u_ret'), root: rootState }), false);
    /* 비담당자는 사건 수정 및 비밀금고 열람 불가 */
    assert.equal(evalRule(cw, {
      auth: makeAuth('u_other'), $id: 'c1', root: rootState,
      data: rootState[cRoot].cases.c1,
      newData: { id: 'c1', entityType: 'Case', managerMain: 'P009', managerSubs: [] }
    }), false);
    assert.equal(evalRule(sr, { auth: makeAuth('u_other'), $cid: 'c1', root: rootState }), false);
    /* 부담당자는 사건 메모는 수정 가능하나 담당자(managerMain/Subs) 목록은 변조 불가 */
    assert.equal(evalRule(cw, {
      auth: makeAuth('u_sub'), $id: 'c1', root: rootState,
      data: rootState[cRoot].cases.c1,
      newData: { id: 'c1', entityType: 'Case', managerMain: 'P002', managerSubs: [] }
    }), false);
    assert.equal(evalRule(cw, {
      auth: makeAuth('u_sub'), $id: 'c1', root: rootState,
      data: rootState[cRoot].cases.c1,
      newData: { id: 'c1', entityType: 'Case', managerMain: 'P001', managerSubs: ['P002'] }
    }), true);
    /* 물리 삭제 금지 */
    assert.equal(evalRule(cw, {
      auth: makeAuth('u_admin'), $id: 'c1', root: rootState,
      data: rootState[cRoot].cases.c1, newData: null
    }), false);
    /* ADMIN 과 배정 부담당자는 비밀금고 열람 가능 */
    assert.equal(evalRule(sr, { auth: makeAuth('u_admin'), $cid: 'c1', root: rootState }), true);
    assert.equal(evalRule(sr, { auth: makeAuth('u_sub'), $cid: 'c1', root: rootState }), true);
  }
});

test('6. HTML · 온톨로지 · 포털 · ERP 배선 확인', () => {
  assert.ok(Ontology.PROGRAMS.sanjae && Ontology.PROGRAMS.laborcase);
  const sanjaeHtml = read('pu-sanjae.html');
  const laborHtml = read('pu-case.html');
  assert.match(sanjaeHtml, /js\/pu-sid-guard\.js\?v=\d+/);
  assert.match(sanjaeHtml, /js\/pu-ontology-write\.js\?v=\d+" data-mode="observe"/);
  assert.match(laborHtml, /js\/pu-ontology-write\.js\?v=\d+" data-mode="observe"/);
  assert.match(sanjaeHtml, /gstatic\.com\/firebasejs\/9\.23\.0\/firebase-app-compat\.js/);
  assert.match(laborHtml, /gstatic\.com\/firebasejs\/9\.23\.0\/firebase-app-compat\.js/);
  assert.match(read('enter.html'), /pu-sanjae\.html/);
  assert.match(read('enter.html'), /pu-case\.html/);
  assert.match(read('pu-erp.html'), /pu-sanjae\.html\?erp=/);
  assert.match(read('pu-erp.html'), /pu-case\.html\?erp=/);
});

test('7. ViewKit 매직바이트·첨부분기 통일 · Collector 심볼릭링크 차단 · 메일 정화 확인', () => {
  const os = require('os');
  const pdfOk = Buffer.from('%PDF-1.7\n1 0 obj\n', 'latin1');
  const htmlSpoof = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>', 'latin1');
  assert.equal(ViewKit.isValidPdfHead(new Uint8Array(pdfOk)), true);
  assert.equal(ViewKit.isValidPdfHead(new Uint8Array(htmlSpoof)), false);

  const pngHead = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const svgSpoof = new Uint8Array(Buffer.from('<svg onload=alert(1)>', 'utf8'));
  assert.equal(ViewKit.detectSafeImageMime(pngHead), 'image/png');
  assert.equal(ViewKit.detectSafeImageMime(svgSpoof), '');

  const kitSrc = read('js/pu-case-archive-view-kit.js');
  assert.match(kitSrc, /var isPastMail =/);
  assert.match(kitSrc, /var res = isPastMail\s*\n\s*\? await callMailFn/);

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pu-col-safe-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pu-col-out-'));
  try {
    assert.throws(() => Collector.assertNoSymlinkAndInsideRoot(tmpRoot, path.join(tmpRoot, '..', 'escape.pdf')), /이탈/);
    Collector.safeWriteFileSync(tmpRoot, path.join(tmpRoot, '2026', 'note.txt'), 'ok');
    assert.equal(fs.readFileSync(path.join(tmpRoot, '2026', 'note.txt'), 'utf8'), 'ok');
    const juncPath = path.join(tmpRoot, 'badlink');
    let linkMade = false;
    try {
      fs.symlinkSync(outside, juncPath, process.platform === 'win32' ? 'junction' : 'dir');
      linkMade = true;
    } catch (_) { /* 권한 없는 환경 허용 */ }
    if (linkMade) {
      assert.throws(() => Collector.safeWriteFileSync(tmpRoot, path.join(juncPath, 'pwn.txt'), 'x'), /심볼릭 링크|정션/);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }

  const scrubbed = Collector.scrubMailLinksRecord({
    id: 'c1',
    mailLinks: [{ id: 'm1', slug: 'inbox', uid: '1', subject: '문의 a@b.com', from: 'x@y.com', to: 'z@w.com' }]
  });
  assert.equal(scrubbed.changed, true);
  assert.equal(scrubbed.record.mailLinks[0].from, undefined);
  assert.equal(scrubbed.record.mailLinks[0].to, undefined);
  assert.ok(!scrubbed.record.mailLinks[0].subject.includes('a@b.com'));
  assert.equal(Collector.scrubMailLinksRecord(scrubbed.record).changed, false);
});
