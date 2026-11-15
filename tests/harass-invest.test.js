'use strict';
/* 괴롭힘·성희롱 조사(pu-harass.html · js/pu-harass-core.js · js/pu-harass-view.js) 및 푸른이알피 자동연동 · 비밀유지 보안규칙 검사
 *
 * 검증하는 핵심 규칙:
 *   ① 메일 제목·첨부파일명만으로 8단계 문서 역할(견적계약·착수계획·비밀보호·신고인진술·피신고소명·참고증거·초안검토·최종보고)을 가른다
 *   ② 사건별 공문 메일을 자동 수집하고, 사람이 직접 수정한 단계(manual: true)는 덮어쓰지 않는다
 *   ③ 이알피에 아직 없는 조사 메일 묶음을 의뢰처별로 발굴하되(한글 사업장명 분리 포함), 기등록 사건·제외(dismissed) 묶음은 빼고 보여 준다
 *   ④ 푸른이알피 동기화 시 수기 비고는 보존하고 자동연동 블록과 결정적 메모 열쇠(cm-hi-...)만 멱등 갱신한다
 *   ⑤ 비밀유지 의무(근로기준법 제76조의3 제7항) 및 권한 상승 차단:
 *      - harass_secret 은 루트 열람이 닫혀 있고 주·부담당 노무사 및 대표만 읽고 쓴다
 *      - harass_invest/cases/$id 는 비담당 직원이 담당자 목록을 덮어써 권한을 탈취할 수 없고, 부담당도 담당자를 바꿀 수 없다
 *      - harass_invest/erp_sync/$id 도 사건 담당자·대표만 발행할 수 있다
 *   ⑥ 3요건 판정, 하이픈 유무와 무관한 13자리 주민번호 자동 마스킹, 동일 사업장 동시 사건 메일 분리, DOMParser XSS 방어 및 로그아웃 기밀 폐기
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-harass-core.js');

const ROOT = path.join(__dirname, '..');

test('① 8단계 프로토콜 및 공문·서류 역할 분류기·기관명 추출기가 정확히 작동한다', () => {
  assert.equal(C.STEPS.length, 8); // 검사고정-허용: 8단계 표준 조사 프로토콜 정의
  assert.equal(C.classifyDocRole('직장 내 괴롭힘 외부조사 위임계약서 및 견적서 송부', ['위임계약서.pdf']).code, 'quote_contract');
  assert.equal(C.classifyDocRole('조사계획서 및 출석요구서 발송의 건', ['조사계획서.hwp']).code, 'official_plan');
  assert.equal(C.classifyDocRole('조사 참여자 비밀유지서약서 및 보호조치 안내', ['비밀유지서약서.hwp']).code, 'pledge_protect');
  assert.equal(C.classifyDocRole('신고인 면담 피해진술 제출의 건', []).code, 'victim_stmt');
  assert.equal(C.classifyDocRole('피신고인 소명서 및 답변서 제출의 건', []).code, 'accused_stmt');
  assert.equal(C.classifyDocRole('참고인 문답서 및 녹취 증거자료 제출', []).code, 'witness_evid');
  assert.equal(C.classifyDocRole('조사결과보고서(초안) 법리검토 요청', []).code, 'draft_review');
  assert.equal(C.classifyDocRole('[최종보고] 직장 내 괴롭힘 조사결과보고서 제출의 건', ['최종보고서.pdf']).code, 'final_report');

  assert.equal(C.extractOrgName('[(주)가나점검테크] 직장 내 괴롭힘 조사 의뢰의 건', []), '(주)가나점검테크');
  assert.equal(C.inferCategory('직장 내 성희롱 및 괴롭힘 복합 조사 요청'), 'both');
  assert.equal(C.inferCategory('성희롱 고충심의위원회 외부조사 건'), 'sexual');
  assert.equal(C.inferCategory('직장 내 괴롭힘 신고 건 조사'), 'harass');
});

test('② 사건별 메일 자동 수집 및 8단계 자동 복원 — 수동 편집(manual:true) 단계는 덮어쓰지 않는다', () => {
  const companies = [
    { id: 'co-a', name: '(주)가나점검테크', bizNo: '123-81-20012', email: 'hr@gana-check.example' },
    { id: 'co-b', name: '(주)타사점검산업', bizNo: '123-81-20098', email: 'info@other-check.example' },
  ];
  const coDir = C.buildCompanyDirectory(companies);
  const folders = {
    inbox: { kind: 'inbox', name: '받은편지함' },
    sent: { kind: 'sent', name: '보낸편지함' },
  };
  const msgs = {
    inbox: {
      '1': { u: 1, s: '[(주)가나점검테크] 직장 내 괴롭힘 조사 위임계약서 송부', f: '인사팀', e: 'hr@gana-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 9, 2), a: 1, an: ['위임계약서.pdf'] },
      '2': { u: 2, s: '[(주)가나점검테크] 신고인 피해진술 송부의 건', f: '인사팀', e: 'hr@gana-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 9, 10), a: 1, an: ['피해진술서.hwp'] },
      '3': { u: 3, s: '[(주)타사점검산업] 직장 내 괴롭힘 조사 문의', f: '담당자', e: 'info@other-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 9, 11), a: 0, an: [] },
    },
    sent: {
      '9': { u: 9, s: '[(주)가나점검테크] 직장 내 괴롭힘 조사결과보고서(초안) 검토 요청', f: '점검노무', e: 'p001@pureun.kr', t: 'hr@gana-check.example', d: Date.UTC(2026, 9, 25), a: 1, an: ['보고서초안.pdf'] },
    },
  };
  const flat = C.flattenMailbox(folders, msgs);
  const caseRec = {
    id: 'hc-a', companyId: 'co-a', companyName: '(주)가나점검테크',
    steps: {
      intake: { done: true, date: '2026-09-30', note: '노무사가 직접 적은 수기 메모', manual: true },
    },
  };
  const collected = C.collectMailsForCase(caseRec, flat, coDir);
  assert.equal(collected.length, 3, '해당 의뢰처의 조사 메일 3건만 수집하고 타사 메일은 섞지 않는다');

  const nextSteps = C.deriveStepsFromMails(caseRec.steps, collected, '2026-09-30', '');
  assert.equal(nextSteps.intake.date, '2026-09-30', 'manual:true 인 단계의 날짜는 메일이 덮어쓰지 않는다');
  assert.equal(nextSteps.intake.note, '노무사가 직접 적은 수기 메모', 'manual:true 인 단계의 메모는 보존된다');
  assert.equal(nextSteps.victim.done, true, '신고인 진술 메일로 4단계(victim)가 자동 완료된다');
  assert.equal(nextSteps.review.done, true, '보고서 초안 발신 메일로 7단계(review)가 자동 완료된다');

  const prog = C.summarizeProgress(nextSteps, '');
  assert.equal(prog.erpStatus, 'judgment', '7단계 법리검토 완료 시 이알피 상태는 판정·보고 대기(judgment)가 된다');
});

test('③ 미등록 후보 묶음(Bundle) 발굴 및 동일 사업장 동시 사건 공문 분리', () => {
  const companies = [{ id: 'co-1', name: '(주)가나점검테크', bizNo: '123-81-20012', email: 'hr@gana-check.example' }];
  const coDir = C.buildCompanyDirectory(companies);
  const folders = { inbox: { kind: 'inbox', name: '받은편지함' } };
  const msgs = {
    inbox: {
      '10': { u: 10, s: '[(주)가나점검테크] 생산팀 직장 내 괴롭힘 조사 착수공문', f: '인사팀', e: 'hr@gana-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 9, 1) },
      '11': { u: 11, s: '[(주)가나점검테크] 물류팀 직장 내 괴롭힘 조사 착수공문', f: '인사팀', e: 'hr@gana-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 9, 2) },
      '12': { u: 12, s: '[(주)가나점검테크] 직장 내 괴롭힘 조사 자료 협조 공문', f: '인사팀', e: 'hr@gana-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 9, 3) },
      '20': { u: 20, s: '[(주)새의뢰점검물산] 직장 내 성희롱 조사 견적서 요청', f: '총무팀', e: 'audit@newclient-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 10, 1) },
      '21': { u: 21, s: '[(주)새의뢰점검물산] 직장 내 성희롱 조사 위임계약서 회신', f: '총무팀', e: 'audit@newclient-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 10, 3) },
      '30': { u: 30, s: '[(주)제외점검상사] 직장 내 괴롭힘 조사 외부전문가 조사 문의', f: '법무팀', e: 'edu@ignore-check.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 10, 4) },
    },
  };
  const flat = C.flattenMailbox(folders, msgs);

  const caseProd = { id: 'hc-prod', companyId: 'co-1', companyName: '(주)가나점검테크', title: '생산팀 괴롭힘 조사', receiveDate: '2026-10-01' };
  const caseLogi = { id: 'hc-logi', companyId: 'co-1', companyName: '(주)가나점검테크', title: '물류팀 괴롭힘 조사', receiveDate: '2026-10-01' };
  const peers = [caseProd, caseLogi];

  const prodMails = C.collectMailsForCase(caseProd, flat, coDir, peers);
  const logiMails = C.collectMailsForCase(caseLogi, flat, coDir, peers);
  const prodAmbig = C.findAmbiguousCompanyMails(caseProd, flat, coDir, peers);

  assert.equal(prodMails.length, 1, '동시 사건 중 생산팀 키워드 메일만 생산팀 사건에 자동 귀속된다');
  assert.ok(prodMails[0].subject.includes('생산팀'));
  assert.equal(logiMails.length, 1, '동시 사건 중 물류팀 키워드 메일만 물류팀 사건에 자동 귀속된다');
  assert.ok(logiMails[0].subject.includes('물류팀'));
  assert.equal(prodAmbig.length, 1, '특정 부서 키워드가 없는 공통 공문은 두 사건에 중복 귀속되지 않고 모호 목록으로 분리된다');
  assert.ok(prodAmbig[0].subject.includes('자료 협조 공문'));

  const existingCases = [{ id: 'hc-prod', companyId: 'co-1', companyName: '(주)가나점검테크', mailLinks: [{ key: 'i:inbox:10' }] }];
  const allBundles = C.discoverUnregisteredBundles(flat, existingCases, coDir, {});
  assert.ok(allBundles.some((b) => b.companyName.includes('새의뢰점검물산') && b.mails.length === 2), '새 의뢰처 메일 2건이 한 묶음으로 그룹화된다');
  assert.ok(!allBundles.some((b) => b.companyName.includes('가나점검테크')), '이미 사건에 연결된 의뢰처 메일은 미등록 후보에 뜨지 않는다');

  const ignoreBundle = allBundles.find((b) => b.companyName.includes('제외점검상사'));
  assert.ok(ignoreBundle, '한글 사업장명 번들이 충돌 없이 별도 묶음으로 분리된다');
  const afterDismiss = C.discoverUnregisteredBundles(flat, existingCases, coDir, { [ignoreBundle.bundleKey]: { _deleted: false, dismissed: true } });
  assert.ok(!afterDismiss.some((b) => b.bundleKey === ignoreBundle.bundleKey), '제외 처리한 묶음은 다시 나타나지 않는다');
});

test('④ 푸른이알피 동기화 페이로드 및 비고 병합 — 기존 수기 비고를 지우지 않고 결정적 메모 키를 만든다', () => {
  const manualNote = '착수금 세금계산서 10/15 발행 완료\n담당 임원 직통 내선 확인';
  const merged1 = C.mergeErpNote(manualNote, '진행률: 3/8단계 (38%)');
  assert.ok(merged1.includes('착수금 세금계산서 10/15 발행 완료'), '기존 수기 비고가 그대로 보존된다');
  assert.ok(merged1.includes('진행률: 3/8단계 (38%)'), '자동연동 블록이 붙는다');

  const merged2 = C.mergeErpNote(merged1, '진행률: 8/8단계 (100%)');
  assert.ok(merged2.includes('착수금 세금계산서 10/15 발행 완료'), '재동기화 후에도 수기 비고가 보존된다');
  assert.ok(!merged2.includes('3/8단계'), '이전 자동연동 블록은 새 블록으로 깔끔히 교체된다');
  assert.ok(merged2.includes('8/8단계'), '새 자동연동 블록이 반영된다');

  const stepsDone = {};
  C.STEPS.forEach((d) => { stepsDone[d.code] = { done: true, date: '2026-11-10', note: d.short + ' 완료' }; });
  const payload = C.buildErpSyncPayload({
    id: 'hc-sync-1',
    companyId: 'co-1',
    companyName: '(주)가나점검테크',
    category: 'harass',
    managerMain: 'P001',
    receiveDate: '2026-10-01',
    closeDate: '2026-11-10',
    verdictSummary: 'recognized',
    steps: stepsDone,
    mailLinks: [{ key: 'i:inbox:55', date: '2026-10-01', dir: 'in', docRole: 'quote_contract', subject: '위임계약서 송부', attNames: ['계약서.pdf'] }],
  });
  assert.equal(payload.erpStatus, 'closed', '8단계 모두 완료 시 이알피 사건 상태는 closed 로 전환된다');
  assert.equal(payload.action, 'create_and_sync', 'erpCaseId 가 없으면 신규 생성 후 동기화 액션이 지정된다');
  assert.ok(payload.memos.length >= 9, '8단계 완료 메모 + 수집 공문 메모가 생성된다');
  assert.ok(payload.memos.every((m) => /^cm-hi-/.test(m.memoKey) && !/[.#$\[\]/]/.test(m.memoKey)), '모든 업무 메모 키가 결정적이며 Firebase 안전 키다');
});

test('⑤ 비밀유지 열람 권한 및 실시간DB 보안규칙 — 비담당 직원의 열람 및 담당자 덮어쓰기 권한상승을 차단한다', () => {
  const caseRec = { id: 'hc-sec-1', managerMain: 'P001', managerSubs: ['P002'] };
  assert.equal(C.canAccessSecret(caseRec, { sid: 'P001', isAdmin: false }), true, '주담당 노무사는 열람 가능');
  assert.equal(C.canAccessSecret(caseRec, { sid: 'P002', isAdmin: false }), true, '부담당 노무사는 열람 가능');
  assert.equal(C.canAccessSecret(caseRec, { sid: 'P999', isAdmin: true }), true, '대표(관리자)는 열람 가능');
  assert.equal(C.canAccessSecret(caseRec, { sid: 'P003', isAdmin: false, isSubAdmin: true }), false, '사건 담당이 아닌 위임관리인·타 직원은 열람 불가');
  assert.equal(C.canAccessSecret(caseRec, null), false, '비로그인 열람 불가');

  const rulesJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
  assert.ok(rulesJson.harass_invest, 'harass_invest 규칙이 존재한다');
  assert.ok(rulesJson.harass_secret, 'harass_secret 규칙이 존재한다');
  assert.equal(rulesJson.harass_secret['.read'], undefined, '★ harass_secret 루트에 .read 를 두면 전체 사건 비밀 본문이 새어 나간다');
  assert.equal(rulesJson.harass_secret['.write'], undefined, '★ harass_secret 루트에 .write 를 두면 안 된다');

  class Snap {
    constructor(v) { this.value = v; }
    child(p) { let cur = this.value; for (const s of String(p).split('/')) cur = (cur && typeof cur === 'object') ? cur[s] : undefined; return new Snap(cur); }
    val() { return this.value === undefined ? null : this.value; }
    isString() { return typeof this.value === 'string'; }
    exists() { return this.value !== undefined && this.value !== null; }
  }
  const existingCase = { id: 'hc-sec-1', entityType: 'Case', managerMain: 'P001', managerSubs: ['P002'] };
  const tree = {
    uid_roles: {
      uAdmin: { sid: 'P900', status: 'active', isAdmin: true },
      uMain: { sid: 'P001', status: 'active' },
      uSub: { sid: 'P002', status: 'active' },
      uOther: { sid: 'P003', status: 'active', isSubAdmin: true },
      uRetired: { sid: 'P001', status: 'retired' },
    },
    harass_invest: {
      cases: {
        'hc-sec-1': existingCase,
      },
      erp_sync: {
        'hc-sec-1': { id: 'hc-sec-1', entityType: 'Task', revision: 4 },
      },
    },
    harass_secret: {
      'hc-orphan-sec': { id: 'hc-orphan-sec', entityType: 'Document' },
    },
  };
  const evalExpr = (expr, uid, varName, keyVal, curData, newData) => {
    const auth = uid ? { uid, token: { firebase: { sign_in_provider: 'password' } } } : null;
    const hadMatches = Object.prototype.hasOwnProperty.call(String.prototype, 'matches');
    const prevMatches = String.prototype.matches;
    String.prototype.matches = function (re) { return re.test(String(this)); };
    try {
      return Boolean(Function('auth', 'root', 'data', 'newData', varName, '"use strict"; return (' + expr + ');')(
        auth, new Snap(tree), new Snap(curData), new Snap(newData), keyVal
      ));
    } catch (_) { return false; }
    finally {
      if (hadMatches) String.prototype.matches = prevMatches;
      else delete String.prototype.matches;
    }
  };

  const secRead = rulesJson.harass_secret.$cid['.read'];
  const secWrite = rulesJson.harass_secret.$cid['.write'];
  assert.equal(evalExpr(secRead, 'uMain', '$cid', 'hc-sec-1', null, null), true, '주담당 노무사 비밀금고 읽기 허용');
  assert.equal(evalExpr(secRead, 'uSub', '$cid', 'hc-sec-1', null, null), true, '부담당 노무사 비밀금고 읽기 허용');
  assert.equal(evalExpr(secRead, 'uAdmin', '$cid', 'hc-sec-1', null, null), true, '대표 비밀금고 읽기 허용');
  assert.equal(evalExpr(secRead, 'uOther', '$cid', 'hc-sec-1', null, null), false, '비담당 재직 직원(위임관리인 포함) 비밀금고 읽기 차단');
  assert.equal(evalExpr(secRead, 'uRetired', '$cid', 'hc-sec-1', null, null), false, '퇴사 처리된 전 담당자 비밀금고 읽기 차단');
  assert.equal(evalExpr(secWrite, 'uMain', '$cid', 'hc-sec-1', null, null), false, '비밀금고 물리 삭제(null 쓰기) 차단');

  /* ★ 권한 상승 차단 검증: 비담당 직원이 cases/$id 의 담당자를 자기 사번으로 덮어쓰는 공격 */
  const caseWrite = rulesJson.harass_invest.cases.$id['.write'];
  assert.equal(
    evalExpr(caseWrite, 'uOther', '$id', 'hc-sec-1', existingCase, { id: 'hc-sec-1', entityType: 'Case', managerMain: 'P003', managerSubs: ['P002'] }),
    false,
    '비담당 직원이 기존 사건의 managerMain 을 자기 사번으로 바꿔 권한을 탈취하려는 쓰기를 차단한다'
  );
  assert.equal(
    evalExpr(caseWrite, 'uOther', '$id', 'hc-sec-1', existingCase, { id: 'hc-sec-1', entityType: 'Case', managerMain: 'P001', managerSubs: ['P002', 'P003'] }),
    false,
    '비담당 직원이 기존 사건의 managerSubs 에 자기 사번을 끼워 넣는 쓰기를 차단한다'
  );
  assert.equal(
    evalExpr(caseWrite, 'uSub', '$id', 'hc-sec-1', existingCase, { id: 'hc-sec-1', entityType: 'Case', managerMain: 'P001', managerSubs: ['P002'], title: '진행메모 갱신' }),
    true,
    '부담당 노무사가 담당자 목록을 유지한 채 사건 진행현황을 갱신하는 쓰기는 허용한다'
  );
  assert.equal(
    evalExpr(caseWrite, 'uSub', '$id', 'hc-sec-1', existingCase, { id: 'hc-sec-1', entityType: 'Case', managerMain: 'P002', managerSubs: [] }),
    false,
    '부담당 노무사가 주담당이나 공동담당 명단을 임의로 변경하는 쓰기는 차단한다'
  );
  assert.equal(
    evalExpr(caseWrite, 'uMain', '$id', 'hc-sec-1', existingCase, { id: 'hc-sec-1', entityType: 'Case', managerMain: 'P001', managerSubs: ['P002', 'P003'] }),
    true,
    '주담당 노무사는 공동담당 노무사를 추가 배정할 수 있다'
  );
  assert.equal(
    evalExpr(caseWrite, 'uOther', '$id', 'hc-orphan-sec', null, { id: 'hc-orphan-sec', entityType: 'Case', managerMain: 'P003', managerSubs: [] }),
    false,
    '이미 비밀금고(harass_secret)가 존재하는 사건 ID 를 선점 생성하여 비밀을 읽으려는 우회도 차단한다'
  );
  assert.equal(
    evalExpr(caseWrite, 'uOther', '$id', 'hc-new-1', null, { id: 'hc-new-1', entityType: 'Case', managerMain: 'P003', managerSubs: [] }),
    true,
    '재직 직원이 본인을 담당자로 하여 완전히 새로운 사건을 등록하는 것은 허용한다'
  );

  /* ★ 동기화 큐 위조 차단 검증 */
  const syncWrite = rulesJson.harass_invest.erp_sync.$id['.write'];
  assert.equal(
    evalExpr(syncWrite, 'uOther', '$id', 'hc-sec-1', null, { id: 'hc-sec-1', entityType: 'Task' }),
    false,
    '비담당 직원은 타 담당 사건의 푸른이알피 동기화 큐를 발행할 수 없다'
  );
  assert.equal(
    evalExpr(syncWrite, 'uSub', '$id', 'hc-sec-1', null, { id: 'hc-sec-1', entityType: 'Task' }),
    true,
    '사건 담당 노무사는 푸른이알피 동기화 큐를 발행할 수 있다'
  );

  /* ★ 동기화 응답(erp_ack) 위조 및 부풀린 revision 방해 차단 검증 */
  const ackWrite = rulesJson.harass_invest.erp_ack.$id['.write'];
  assert.equal(
    evalExpr(ackWrite, 'uOther', '$id', 'hc-sec-1', null, { id: 'hc-sec-1', entityType: 'Task', syncedRevision: 4 }),
    false,
    '비담당 직원은 타 담당 사건의 erp_ack 를 쓸 수 없다'
  );
  assert.equal(
    evalExpr(ackWrite, 'uMain', '$id', 'hc-sec-1', null, { id: 'hc-sec-1', entityType: 'Task', syncedRevision: 999999 }),
    false,
    '담당자라도 erp_sync 의 현재 revision(4)과 다른 위조 syncedRevision 을 기록할 수 없다'
  );
  assert.equal(
    evalExpr(ackWrite, 'uMain', '$id', 'hc-sec-1', null, { id: 'hc-sec-1', entityType: 'Task', syncedRevision: 4 }),
    true,
    '담당자가 실제 동기화된 revision(4)과 일치하는 erp_ack 를 기록하는 것은 허용된다'
  );

  /* ★ managerMain / managerSubs SID 형식 검증 (악성 HTML·스크립트 주입 원천 차단) */
  const subValidate = rulesJson.harass_invest.cases.$id.managerSubs.$subIdx['.validate'];
  const mainValidate = rulesJson.harass_invest.cases.$id.managerMain['.validate'];
  assert.equal(evalExpr(subValidate, 'uMain', '$subIdx', '2', null, '<img src=x onerror=alert(1)>'), false, '공동담당 배열에 HTML 태그 문자열 저장을 서버 규칙에서 차단한다');
  assert.equal(evalExpr(subValidate, 'uMain', '$subIdx', '2', null, 'P003'), true, '정상 사번(P003)은 공동담당으로 허용된다');
  assert.equal(evalExpr(mainValidate, 'uMain', '$id', 'hc-sec-1', null, '<script>'), false, '주담당 필드에 비정상 태그 문자열 저장을 차단한다');
});

test('⑥ 3요건 판정, 13자리 연속 주민번호 마스킹, DOMParser XSS 방어 및 로그아웃 기밀 폐기 확인', () => {
  assert.equal(C.judgeIssue({ factStatus: 'recognized', elemSuperiority: 'yes', elemBeyondScope: 'yes', elemHarm: 'yes' }), 'yes');
  assert.equal(C.judgeIssue({ factStatus: 'recognized', elemSuperiority: 'yes', elemBeyondScope: 'no', elemHarm: 'yes' }), 'no');
  assert.equal(C.judgeIssue({ factStatus: 'unrecognized', elemSuperiority: 'yes', elemBeyondScope: 'yes', elemHarm: 'yes' }), 'no');
  assert.equal(C.judgeIssue({ factStatus: 'partial', elemSuperiority: 'yes', elemBeyondScope: 'hold', elemHarm: 'yes' }), 'hold');

  const hyphenRrn = ['800101', '1234567'].join('-');
  const plainRrn = ['800101', '1234567'].join('');
  assert.equal(C.hasUnmaskedRrn('진술인 주민번호 ' + hyphenRrn + ' 기재'), true);
  assert.equal(C.hasUnmaskedRrn('하이픈 없는 주민번호 ' + plainRrn + ' 기재'), true, '하이픈 없는 13자리 주민번호도 탐지한다');
  const maskedPlain = C.maskRrnText('하이픈 없는 주민번호 ' + plainRrn + ' 기재');
  assert.equal(C.hasUnmaskedRrn(maskedPlain), false, '하이픈 없는 13자리 주민번호도 뒷자리 6자리가 마스킹된다');
  assert.ok(maskedPlain.includes('800101-1******'));

  const draft = C.assembleReportDraft(
    { companyName: '(주)가나점검테크 ' + hyphenRrn, title: '품질팀 조사 건', category: 'harass', receiveDate: '2026-10-01', verdictSummary: 'recognized', steps: { intake: { done: true, date: '2026-10-01' } } },
    { overview: '개요 ' + plainRrn, interviews: [{ role: 'victim', alias: '신고인 ' + hyphenRrn, dept: '부서 ' + plainRrn, summary: '진술 요지' }], issues: [{ title: '폭언 건', factStatus: 'recognized', elemSuperiority: 'yes', elemBeyondScope: 'yes', elemHarm: 'yes' }] }
  );
  assert.equal(C.hasUnmaskedRrn(draft), false, '조립된 보고서 초안(alias·dept·사업장명 포함)에 노출된 주민번호가 없어야 한다');
  assert.ok(draft.includes('괴롭힘·성희롱 해당'), '3요건 충족 쟁점의 판단 결과가 보고서에 반영된다');
  assert.ok(draft.includes('근로기준법 제76조의3'), '법정 후속 조치 안내가 포함된다');

  const strAttInspected = C.inspectMailForHarass({
    key: 'i:inbox:str1', slug: 'inbox', uid: 'str1', dir: 'in', date: '2026-10-02', ts: 100,
    subject: '직장 내 괴롭힘 조사 요청', attNames: '단일문자열첨부.pdf', preview: '', attCount: 1,
  }, true);
  assert.ok(strAttInspected && Array.isArray(strAttInspected.attNames), 'attNames 가 문자열로 들어와도 예외 없이 배열로 정규화된다');

  const viewJs = fs.readFileSync(path.join(ROOT, 'js', 'pu-harass-view.js'), 'utf8');
  assert.ok(viewJs.includes('new DOMParser().parseFromString'), 'HTML 메일 평문 추출에 안전한 비활성 DOMParser 를 사용한다');
  assert.ok(!/tmp\.innerHTML\s*=/.test(viewJs), '외부 HTML 메일에 실행 가능한 innerHTML 대입을 쓰지 않는다');
  assert.ok(viewJs.includes('function purgeSessionState()'), '로그아웃 및 계정 전환 시 기밀 캐시·DOM 폐기 함수가 구현되어 있다');

  const erpHtml = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  assert.match(erpHtml, /js\/pu-harass-core\.js\?v=\d+/, '푸른이알피가 조사 코어 모듈을 캐시 번호와 함께 로드한다');
  assert.ok(erpHtml.includes('function erpHarassInvestSync('), '푸른이알피 자동 동기화 함수가 배선되어 있다');
  assert.ok(!erpHtml.includes('caseRec.erpCaseId || (ack && ack.erpCaseId)'), '푸른이알피 동기화는 ACK 의 erpCaseId 를 대상 사건 선택에 신뢰하지 않는다');
  assert.ok(erpHtml.includes('pu-harass.html?erp='), '푸른이알피 사건 상세에서 조사실 바로가기가 배선되어 있다');
});

test('⑦ 동시 단계·필드 수정 병합, 종결단계 취소 시 종결일 초기화, 조회·저장·메일 비동기 경합 시 기밀 재유입 차단', async () => {
  const vm = require('node:vm');

  function makeEl(id) {
    const classes = new Set();
    return {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      disabled: false,
      classes,
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        toggle(c, force) {
          const on = force === undefined ? !classes.has(c) : !!force;
          if (on) classes.add(c); else classes.delete(c);
        },
        contains(c) { return classes.has(c); },
      },
      listeners: {},
      addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getAttribute() { return ''; },
      closest() { return null; },
      matches() { return false; },
    };
  }

  const els = {};
  const getEl = (id) => (els[id] = els[id] || makeEl(id));
  ['outBtn', 'lock', 'lockWhy', 'app', 'tabs', 'reloadBtn', 'syncAllBtn', 'newCaseBtn', 'imapScanBtn', 'imapInboxBtn',
    'caseQ', 'inQ', 'caseCat', 'caseSt', 'caseMgr', 'nCases', 'nInbox', 'mailStat',
    'p-cases', 'p-inbox', 'p-detail', 'p-report', 'rBody', 'mMailBody', 'mMailAtts',
    'kpiBox', 'casesBox', 'inboxBox', 'detailBox', 'reportBox', 'printArea', 'modal', 'mbox', 'toast', 'loadNote'].forEach(getEl);

  let slowSaveResolver = null;
  let slowMailResolver = null;
  const docListeners = {};
  const ctx = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    Promise,
    URLSearchParams,
    PuHarassCore: C,
    fetch(_url, opts) {
      const reqBody = JSON.parse((opts && opts.body) || '{}');
      if (reqBody.uid === 'slow-mail') {
        return new Promise((res) => {
          slowMailResolver = (text) => res({ json: async () => ({ ok: true, text, atts: [] }) });
        });
      }
      return Promise.resolve({ json: async () => ({ ok: true, text: 'CURRENT_MODAL_MAIL_BODY', atts: [] }) });
    },
    PuOntologyWrite: {
      createGateway() {
        return {
          async save(ref, fn) {
            const v = typeof fn === 'function' ? fn(null) : fn;
            if (ref && ref.path === 'harass_secret/hc-race' && v && v.reportBody === 'OLD_ACCOUNT_SECRET') {
              return new Promise((res) => { slowSaveResolver = () => res({ committed: true, snapshot: { val: () => v } }); });
            }
            return { committed: true, snapshot: { val: () => v } };
          },
        };
      },
    },
    PuGate: { show() {}, hide() {} },
    location: { search: '', hash: '', pathname: '/pu-harass.html' },
    history: { replaceState() {} },
    document: {
      activeElement: null,
      contains: () => false,
      getElementById: (id) => getEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    },
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-harass-view.js'), 'utf8'), ctx);

  /* 1) 서로 다른 단계·필드 동시 수정 및 편집창 부분 필드 수정 시 최신 서버 스냅샷(prev) 보존 검증 */
  const applyMut = ctx.PuHarassView._applyCaseMutation;
  const diffModal = ctx.PuHarassView._diffCaseModalFields;
  const serverLatest = {
    id: 'hc-1',
    companyId: 'co-1',
    companyName: '(주)가나점검테크',
    title: '주담당이 방금 수정한 최신 제목',
    managerMain: 'P001',
    managerSubs: ['P002'],
    receiveDate: '2026-10-01',
    dueDate: '',
    closeDate: '',
    steps: {
      intake: { done: true, date: '2026-10-01', note: '주담당 수임 확정', manual: true },
    },
    mailLinks: [{ key: 'm:1', subject: '기존 수동 공문', manual: true, ts: 100 }],
  };
  const staleClientClean = {
    id: 'hc-1',
    companyId: 'co-1',
    companyName: '(주)가나점검테크',
    title: '오래된 이전 제목',
    managerMain: 'P001',
    managerSubs: ['P002'],
    receiveDate: '2026-10-01',
    dueDate: '',
    closeDate: '',
    steps: {
      intake: { done: false, date: '', note: '', manual: false },
      victim: { done: true, date: '2026-10-08', note: '부담당 피해자 면담 완료', manual: true },
    },
    mailLinks: [],
  };
  const merged = applyMut(serverLatest, staleClientClean, {
    stepPatches: {
      victim: { done: true, date: '2026-10-08', note: '부담당 피해자 면담 완료', manual: true },
    },
  });
  assert.equal(merged.title, '주담당이 방금 수정한 최신 제목', '단계를 수정한 부담당의 오래된 화면 상태가 서버의 최신 사건명을 덮어쓰지 않는다');
  assert.equal(merged.steps.intake.done, true, '다른 담당자가 먼저 완료한 1단계(intake)가 되돌아가지 않는다');
  assert.equal(merged.steps.victim.done, true, '방금 수정한 4단계(victim)도 함께 반영된다');
  assert.equal(merged.mailLinks.length, 1, '서버에 있던 수동 연결 공문도 보존된다');

  const modalInit = { title: '오래된 이전 제목', dueDate: '', managerSubs: ['P002'] };
  const modalSaved = { title: '오래된 이전 제목', dueDate: '2026-11-25', managerSubs: ['P002'] };
  const modalDiff = diffModal(modalInit, modalSaved);
  assert.deepEqual(JSON.parse(JSON.stringify(modalDiff)), { dueDate: '2026-11-25' }, '편집 모달은 열었을 때와 비교해 실제 변경된 필드만 추출한다');
  const modalMerged = applyMut(serverLatest, staleClientClean, { fields: modalDiff });
  assert.equal(modalMerged.title, '주담당이 방금 수정한 최신 제목', 'A가 기한만 바꿔 저장할 때 B가 수정한 최신 제목이 원복되지 않는다');
  assert.equal(modalMerged.dueDate, '2026-11-25', 'A가 수정한 기한은 정상 반영된다');

  /* 2) 8단계(report) 완료 후 취소 시 closeDate 초기화 → 이알피 closed 고착 해소 */
  const closedServer = Object.assign({}, merged, {
    closeDate: '2026-11-10',
    steps: Object.assign({}, merged.steps, { report: { done: true, date: '2026-11-10', note: '종결', manual: true } }),
  });
  const reopened = applyMut(closedServer, staleClientClean, {
    stepPatches: { report: { done: false, date: '', note: '', manual: true } },
    closeDate: '',
  });
  assert.equal(reopened.closeDate, '', '8단계(보고·종결) 완료를 취소하면 종결일(closeDate)도 함께 비워진다');
  assert.notEqual(C.summarizeProgress(reopened.steps, reopened.closeDate).erpStatus, 'closed', '종결 취소 후 이알피 상태가 closed 에 고착되지 않는다');

  /* 3) 비동기 경합 ①: 비밀자료 조회 중 로그아웃 발생 시 지연 응답 차단 및 재로그인 시 기본 탭(p-cases) 표시 */
  let authCb = null;
  let curUser = { uid: 'uMain', getIdToken: async () => 'tok-main' };
  let resolveSlowSecret = null;
  let secretFetchCalls = 0;

  const mockDbData = {
    'uid_roles/uMain': { sid: 'P001', name: '점검노무', status: 'active', isAdmin: false },
    'uid_roles/uOther': { sid: 'P009', name: '타담당노무', status: 'active', isAdmin: false },
    'data/user_dir': [
      { sid: 'P001', name: '점검노무', status: 'active' },
      { sid: 'P009', name: '타담당노무', status: 'active' },
    ],
    'harass_invest/cases': {
      'hc-race': {
        id: 'hc-race', companyId: 'co-1', companyName: '(주)경합점검', title: '경합사건', managerMain: 'P001', managerSubs: [],
        mailLinks: [
          { key: 'i:inbox:slow-mail', slug: 'inbox', uid: 'slow-mail', subject: '지연 메일' },
          { key: 'i:inbox:fast-mail', slug: 'inbox', uid: 'fast-mail', subject: '새 메일' },
        ],
      },
    },
  };

  function makeRef(refPath) {
    return {
      path: refPath,
      child(seg) { return makeRef(refPath ? refPath + '/' + seg : String(seg)); },
      on() {},
      off() {},
      once() {
        if (refPath === 'harass_secret/hc-race') {
          secretFetchCalls++;
          return new Promise((res) => { resolveSlowSecret = res; });
        }
        return Promise.resolve({ val: () => (mockDbData[refPath] !== undefined ? mockDbData[refPath] : null) });
      },
    };
  }

  ctx.PuHarassView.boot({
    auth: Object.assign(() => ({
      get currentUser() { return curUser; },
      setPersistence() {},
      onAuthStateChanged(fn) { authCb = fn; },
    }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    database: () => ({ ref: (p) => makeRef(p || '') }),
  });

  await authCb(curUser);
  assert.equal(getEl('p-cases').classList.contains('on'), true, '초기 로그인 시 사건 현황(p-cases) 탭이 활성화된다');

  const openReportBtn = {
    disabled: false,
    getAttribute: (n) => (n === 'data-act' ? 'openReport' : n === 'data-id' ? 'hc-race' : ''),
  };
  const clickPromise = docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? openReportBtn : null) },
    stopPropagation() {},
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(secretFetchCalls, 1, '비밀금고 지연 조회가 시작되었다');

  curUser = null;
  await authCb(null);

  resolveSlowSecret({ val: () => ({ id: 'hc-race', reportBody: 'CONFIDENTIAL_RACE_LEAK_CHECK' }) });
  await clickPromise;
  assert.ok(!getEl('reportBox').innerHTML.includes('CONFIDENTIAL_RACE_LEAK_CHECK'), '로그아웃 뒤 도착한 지연 조회 응답이 화면에 그려지지 않는다');

  curUser = { uid: 'uMain', getIdToken: async () => 'tok-main' };
  await authCb(curUser);
  assert.equal(getEl('p-cases').classList.contains('on'), true, '로그아웃 후 재로그인해도 기본 탭(p-cases)이 정상 표시된다');

  const clickPromise2 = docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? openReportBtn : null) },
    stopPropagation() {},
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(secretFetchCalls, 2, '로그아웃 후 지연 응답이 secretCache 에 유입되지 않았으므로 재로그인 시 새로 조회한다');
  resolveSlowSecret({ val: () => ({ id: 'hc-race', reportBody: 'FRESH_SESSION_OK' }) });
  await clickPromise2;
  assert.ok(getEl('reportBox').innerHTML.includes('FRESH_SESSION_OK'), '새 세션의 정상 응답은 화면에 반영된다');

  /* 4) 비동기 경합 ②: A 계정 저장(saveSecretRecord) 지연 중 로그아웃 → B 계정 로그인 → A 저장 응답 도착 시 B 및 재로그인 세션 오염 차단 */
  getEl('rBody').value = 'OLD_ACCOUNT_SECRET';
  const saveReportBtn = {
    disabled: false,
    getAttribute: (n) => (n === 'data-act' ? 'saveReportAll' : ''),
  };
  const savePromise = docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? saveReportBtn : null) },
    stopPropagation() {},
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(typeof slowSaveResolver, 'function', 'A 계정의 지연 비밀 저장 요청이 대기 중이다');

  curUser = null;
  await authCb(null);
  curUser = { uid: 'uOther', getIdToken: async () => 'tok-other' };
  await authCb(curUser);

  slowSaveResolver();
  await savePromise;
  assert.ok(!getEl('reportBox').innerHTML.includes('OLD_ACCOUNT_SECRET'), '비담당 B 계정 화면에 A의 지연 저장 본문이 유입되지 않는다');

  /* 다시 A 계정으로 로그인해 보고서 탭을 열어도 이전 세션의 지연 저장 응답이 캐시에 남지 않아 서버에서 새로 읽는다 */
  curUser = null;
  await authCb(null);
  curUser = { uid: 'uMain', getIdToken: async () => 'tok-main' };
  await authCb(curUser);
  const clickPromise3 = docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? openReportBtn : null) },
    stopPropagation() {},
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(secretFetchCalls, 3, '교차 세션 지연 저장 응답이 secretCache 에 남지 않아 새로 조회한다');
  resolveSlowSecret({ val: () => ({ id: 'hc-race', reportBody: 'SERVER_CLEAN_SECRET' }) });
  await clickPromise3;

  /* 5) 비동기 경합 ③: 메일 본문 조회 지연 중 다른 메일 모달을 열면 이전 모달의 지연 응답이 새 모달 DOM을 덮어쓰지 않는다 */
  const viewSlowBtn = {
    disabled: false,
    getAttribute: (n) => (n === 'data-act' ? 'viewMail' : n === 'data-id' ? 'i:inbox:slow-mail' : ''),
  };
  const viewFastBtn = {
    disabled: false,
    getAttribute: (n) => (n === 'data-act' ? 'viewMail' : n === 'data-id' ? 'i:inbox:fast-mail' : ''),
  };
  const slowMailClick = docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? viewSlowBtn : null) },
    stopPropagation() {},
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(typeof slowMailResolver, 'function', '첫 번째 메일 본문 지연 요청이 시작되었다');

  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? viewFastBtn : null) },
    stopPropagation() {},
  });
  assert.equal(getEl('mMailBody').textContent, 'CURRENT_MODAL_MAIL_BODY', '새로 연 두 번째 메일 본문이 모달에 표시된다');

  slowMailResolver('STALE_OLD_MAIL_BODY');
  await slowMailClick;
  assert.equal(getEl('mMailBody').textContent, 'CURRENT_MODAL_MAIL_BODY', '뒤늦게 도착한 이전 모달의 메일 본문이 현재 열린 메일 모달을 덮어쓰지 않는다');

  /* 6) 저장 없이 인쇄·복사할 때도 본문 내 주민번호 형식이 즉시 가려진다 */
  ctx.print = () => {};
  const rawSynthRrn = ['800101', '1234567'].join('-');
  getEl('rBody').value = '미저장 본문 ' + rawSynthRrn;
  const printBtn = { disabled: false, getAttribute: (n) => (n === 'data-act' ? 'printRpt' : '') };
  await docListeners.click[0]({ target: { closest: (sel) => (sel === '[data-act]' ? printBtn : null) }, stopPropagation() {} });
  assert.equal(C.hasUnmaskedRrn(getEl('printArea').textContent), false, '저장 전 인쇄 시에도 주민번호 뒷자리가 가려져 출력된다');

  /* 7) 3번째 공동담당(managerSubs[2])에 악성 태그가 있어도 편집 모달 HTML 에 이스케이프되어 삽입된다 */
  mockDbData['harass_invest/cases']['hc-race'].managerSubs = ['P002', 'P003', '<img src=x onerror=alert(1)>'];
  await ctx.PuHarassView.reload();
  ['mCoId', 'mCoName', 'mTitle', 'mCat', 'mEmail', 'mMgr', 'mSub1', 'mSub2', 'mRecv', 'mDue', 'mClose', 'mSaveCaseBtn'].forEach(getEl);
  const editCaseBtn = { disabled: false, getAttribute: (n) => (n === 'data-act' ? 'editCase' : n === 'data-id' ? 'hc-race' : '') };
  await docListeners.click[0]({ target: { closest: (sel) => (sel === '[data-act]' ? editCaseBtn : null) }, stopPropagation() {} });
  assert.ok(!getEl('mbox').innerHTML.includes('<img src=x'), '공동담당(extraSubs)의 악성 태그가 모달 innerHTML 에 원문으로 삽입되지 않는다');
  assert.ok(getEl('mbox').innerHTML.includes('&lt;img src=x'), '공동담당(extraSubs) 문자열이 HTML 엔티티로 안전하게 이스케이프된다');

  /* 8) 푸른이알피 erpApplyHarassSyncOne — 업무 메모(dbSet) 저장이 실패하면 ACK 를 발행하지 않고 재시도 가능하게 유지한다 */
  const erpSrc = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const startIdx = erpSrc.indexOf('var _erpHarassSyncBusy = Object.create(null);');
  const endMarker = 'async function erpHarassInvestSync(';
  const endIdx = erpSrc.indexOf(endMarker, startIdx);
  assert.ok(startIdx > 0 && endIdx > startIdx, 'pu-erp.html 에서 erpApplyHarassSyncOne 본문을 추출할 수 있다');

  let allowMemoSave = false;
  const savedAck = {};
  const erpStore = {
    cases: [{ id: 'ec-1', caseNo: '조사-2026-010', typeCode: 'case-investigate', companyId: 'co-1', managerMain: 'P001' }],
    case_memos: [],
  };
  const erpCtx = vm.createContext({
    Object, Array, String, Number, Date, Promise,
    CASE_MEMO_KEY: 'case_memos',
    PU_APP: 'erp',
    _fbSynced: true,
    CURRENT_USER: { sid: 'P001', isAdmin: false },
    fbDb: { ref: (p) => ({ path: p }) },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    getCaseTypes: () => [{ code: 'case-investigate', name: '조사', short: '조사' }],
    genCaseNo: () => '조사-2026-099',
    dbGet: (k, fbVal) => (erpStore[k] !== undefined ? erpStore[k] : fbVal),
    dbUpsert: () => true,
    dbPatch: (k, id, patch) => {
      erpStore[k] = erpStore[k].map((x) => (x.id === id ? Object.assign({}, x, patch) : x));
      return true;
    },
    dbSet: (k, v) => {
      if (!allowMemoSave) return false;
      erpStore[k] = v;
      return true;
    },
    PuHarassCore: C,
    PuOntologyWrite: {
      createGateway() {
        return {
          async save(ref, fn) {
            const val = typeof fn === 'function' ? fn(null) : fn;
            if (ref && ref.path && ref.path.startsWith('harass_invest/erp_ack/')) savedAck[ref.path] = val;
            return { committed: true, snapshot: { val: () => val } };
          },
        };
      },
    },
    dispatchEvent() {},
  });
  erpCtx.window = erpCtx;
  vm.runInContext(erpSrc.slice(startIdx, endIdx), erpCtx);

  const syncCaseMap = {
    'hc-m1': {
      id: 'hc-m1', erpCaseId: 'ec-1', companyId: 'co-1', companyName: '(주)메모재시도점검',
      category: 'harass', title: '메모 재시도 건', managerMain: 'P001', managerSubs: [],
      receiveDate: '2026-10-01', steps: { intake: { done: true, date: '2026-10-01', note: '착수' } }, mailLinks: [],
    },
  };
  const firstTry = await erpCtx.erpApplyHarassSyncOne('hc-m1', { id: 'hc-m1', revision: 2 }, {}, syncCaseMap);
  assert.equal(firstTry, false, '업무 메모 저장(dbSet)이 실패하면 erpApplyHarassSyncOne 은 false 를 반환한다');
  assert.equal(savedAck['harass_invest/erp_ack/hc-m1'], undefined, '메모 저장 실패 시 erp_ack 를 기록하지 않아 다음 주기 재시도가 보장된다');

  allowMemoSave = true;
  const secondTry = await erpCtx.erpApplyHarassSyncOne('hc-m1', { id: 'hc-m1', revision: 2 }, {}, syncCaseMap);
  assert.equal(secondTry, true, '메모 저장이 복구된 뒤 재시도하면 정상 반영된다');
  assert.equal(savedAck['harass_invest/erp_ack/hc-m1'].syncedRevision, 2, '메모까지 모두 반영된 뒤에야 syncedRevision ACK 가 기록된다');
  assert.ok(erpStore.case_memos.length >= 1, '이알피 업무 메모도 누락 없이 저장되었다');
});

test('⑧ 녹취록 자동 문답(Q&A)·요지·3요건 쟁점 구조화 및 주민번호 가림 검증', () => {
  const synthRrn = ['900303', '2345678'].join('-');
  const rawTranscript = [
    '조사자: 2026년 9월 주간회의 당시 어떤 일이 있었는지 말씀해 주세요.',
    '신고인: 박팀장이 직원 10명이 있는 회의실에서 서류를 집어 던지며 폭언과 모욕적 발언을 반복했습니다. 제 번호는 ' + synthRrn + ' 입니다.',
    '조사자: 그 이후 업무 배제나 불이익도 있었나요?',
    '신고인: 다음 날부터 주요 프로젝트 메일 수신에서 제외되고 자리도 창고 옆으로 이동 지시를 받았습니다.',
  ].join('\n');

  const parsed = C.parseTranscriptFallback(rawTranscript, 'victim');
  assert.equal(parsed.qaList.length, 2, '화자 구분 녹취록이 질문·답변 2쌍으로 정확히 분리된다');
  assert.equal(C.hasUnmaskedRrn(JSON.stringify(parsed)), false, '정리된 문답·요지·쟁점 어디에도 마스킹 전 주민번호가 남지 않는다');
  assert.ok(parsed.summary.includes('박팀장'), '핵심 진술 요지가 자동 생성된다');
  assert.ok(parsed.candidateIssues.length >= 1, '폭언·업무배제 키워드가 포함된 답변에서 3요건 쟁점 후보가 자동 추출된다');

  /* 한글(.hwpx) 표 추출 형태(질문 | 답변)도 문답으로 구조화된다 */
  const tableStyleTxt = [
    '구분 | 진술 내용',
    '문: 성희롱 발언 시점과 장소는 언제입니까? | 답: 2026-08-14 부서 회식 자리에서 부적절한 신체 접촉과 성적 농담이 있었습니다.',
  ].join('\n');
  const parsedTbl = C.parseTranscriptFallback(tableStyleTxt, 'victim');
  assert.ok(parsedTbl.qaList.some((q) => q.a.includes('부서 회식')), '표(칸 | 칸) 형태 진술서에서도 질문·답변이 정상 추출된다');

  /* AI 프롬프트 조립 및 JSON 응답 정규화 검증 */
  const prompt = C.buildTranscriptAiPrompt(rawTranscript, { role: 'victim', alias: '신고인 A' });
  assert.equal(C.hasUnmaskedRrn(prompt), false, 'AI로 보내는 프롬프트 단계에서 이미 주민번호가 마스킹된다');

  const aiJson = JSON.stringify({
    summary: '회의실 폭언 및 업무 배제 진술 (' + synthRrn + ')',
    qaList: [{ q: '폭언 경위', a: '회의 중 서류 투척 및 모욕 (' + synthRrn + ')' }],
    candidateIssues: [{ title: '주간회의 폭언', whenWhere: '2026-09 회의실', claimVictim: '서류 투척 및 폭언' }],
  });
  const normAi = C.normalizeTranscriptAiResult(aiJson, rawTranscript, 'victim');
  assert.equal(normAi.qaList.length, 1, 'AI JSON 응답의 문답 배열이 정규화된다');
  assert.equal(C.hasUnmaskedRrn(JSON.stringify(normAi)), false, 'AI 응답 정규화 결과에서도 주민번호가 완전히 가려진다');
});

test('⑨ 정식 한글(.hwpx) 양방향 입출력 — 진술확인서(전자서명 이미지·정정의견 내장) 및 조사결과보고서 왕복 검증', async () => {
  const H = require(path.join(ROOT, 'js', 'pu-harass-hwpx.js'));
  const synthRrn = ['850505', '1234567'].join('-');
  /* 1x1 투명 PNG base64 (전자서명 이미지 내장 검증용) */
  const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const caseRec = {
    id: 'hc-hwpx-1',
    companyName: '(주)푸른한글검증',
    category: 'harass',
    title: '직장 내 괴롭힘 조사',
    erpCaseNo: '조사-2026-077',
    receiveDate: '2026-10-01',
    closeDate: '2026-10-25',
    verdictSummary: 'recognized',
    steps: {
      intake: { done: true, date: '2026-10-01', note: '조사 수임' },
      victim: { done: true, date: '2026-10-10', note: '피해자 면담 및 전자서명' },
    },
    mailLinks: [],
  };

  const ivRec = {
    id: 'iv-hwpx-1',
    role: 'victim',
    alias: '신고인 김푸른',
    dept: '경영지원팀',
    date: '2026-10-10',
    method: '대면면담',
    pledgeSigned: true,
    stmtSigned: true,
    signMode: 'mobile',
    signedAtText: '2026-10-10 15:30',
    docHash: 'a'.repeat(64),
    sigDataUrl: tinyPngDataUrl,
    summary: '직속 상사의 반복적 폭언 진술 ' + synthRrn,
    amendNote: '2번 답변의 일시를 10월 3일 오전 10시로 정정합니다.',
    qaList: [
      { q: '최초 폭언 일시는 언제입니까?', a: '2026년 10월 초 주간회의 시간입니다.' },
      { q: '목격한 동료 근로자가 있습니까?', a: '같은 팀 이참고 대리가 동석했습니다.' },
    ],
  };

  /* 1) 면담 진술확인서 .hwpx 생성 → ZIP 내부 구조(OWPML + 서명 PNG) 및 재추출 왕복 확인 */
  const ivBytes = H.buildInterviewHwpx(caseRec, ivRec);
  assert.ok(ivBytes instanceof Uint8Array && ivBytes.byteLength > 500, '진술확인서 .hwpx 바이트가 정상 생성된다');
  assert.equal(ivBytes[0], 0x50, 'ZIP(PK) 시그니처로 시작하는 정식 OWPML 패키지다');

  const zFiles = await globalThis.PureunZip.readZip(ivBytes);
  assert.equal(new TextDecoder().decode(zFiles.mimetype), 'application/hwp+zip', '한컴 표준 mimetype(application/hwp+zip)을 갖춘다');
  assert.ok(zFiles['Contents/section0.xml'], '본문 OWPML(Contents/section0.xml)이 존재한다');
  const binKeys = Object.keys(zFiles).filter((k) => k.startsWith('BinData/'));
  assert.equal(binKeys.length, 1, '전자서명 PNG 이미지가 BinData 폴더 안에 정식 첨부된다');

  const extractedIv = await H.extractDocumentText(ivBytes, '면담진술확인서.hwpx');
  assert.equal(extractedIv.ok, true, '생성된 진술확인서 .hwpx 파일을 다시 읽어 텍스트를 추출할 수 있다');
  assert.equal(extractedIv.format, 'hwpx', '추출 포맷이 hwpx 로 식별된다');
  assert.ok(extractedIv.text.includes('최초 폭언 일시는 언제입니까?'), '문답 표의 질문이 손실 없이 재추출된다');
  assert.ok(extractedIv.text.includes('10월 3일 오전 10시로 정정'), '진술인 정정·보완 의견이 .hwpx 본문에 포함된다');
  assert.equal(C.hasUnmaskedRrn(extractedIv.text), false, '.hwpx 출력물에도 마스킹 전 주민번호가 절대 노출되지 않는다');

  /* 진술확인서 .hwpx 재반입(buildInterviewHwpx → extractDocumentText → parseTranscriptFallback) 왕복 무오염 검증 */
  const roundtripParsed = C.parseTranscriptFallback(extractedIv.text);
  assert.equal(roundtripParsed.qaList.length, 2, '진술확인서 .hwpx 를 다시 가져와도 표 머리글·서약문·서명란이 섞이지 않고 문답 2개만 정확히 복원된다');
  assert.equal(roundtripParsed.qaList[0].q, '최초 폭언 일시는 언제입니까?', '1번 질문 원문이 정확히 복원된다');
  assert.equal(roundtripParsed.qaList[1].a, '같은 팀 이참고 대리가 동석했습니다.', '2번 답변 원문이 서명란 텍스트 혼입 없이 복원된다');
  assert.ok(roundtripParsed.amendNote.includes('10월 3일 오전 10시로 정정'), '진술인 정정·보완 의견도 별도 필드로 깨끗이 복원된다');

  /* 파이프(|) 및 여러 줄(\n)이 포함된 문답·요지·정정의견 .hwpx 왕복 무손실 복원 검증 */
  const complexIv = Object.assign({}, ivRec, {
    summary: '요지 첫째 줄\n요지 둘째 줄',
    amendNote: '정정의견 1항\n정정의견 2항',
    qaList: [{ q: '표시 A | B 중 무엇입니까?', a: '첫째 답변\n둘째 답변' }],
  });
  const complexBytes = H.buildInterviewHwpx(caseRec, complexIv);
  const complexExtracted = await H.extractDocumentText(complexBytes, '복합문답.hwpx');
  const complexParsed = C.parseTranscriptFallback(complexExtracted.text);
  assert.equal(complexParsed.qaList.length, 1, '파이프(|)가 포함된 질문도 열이 쪼개지지 않고 1문답으로 복원된다');
  assert.equal(complexParsed.qaList[0].q, '표시 A | B 중 무엇입니까?', '질문 안의 파이프(|) 기호가 그대로 보존된다');
  assert.equal(complexParsed.qaList[0].a, '첫째 답변\n둘째 답변', '답변 안의 줄바꿈(\\n)이 그대로 보존된다');
  assert.equal(complexParsed.summary, '요지 첫째 줄\n요지 둘째 줄', '진술 요지의 여러 줄이 그대로 보존된다');
  assert.equal(complexParsed.amendNote, '정정의견 1항\n정정의견 2항', '정정의견의 여러 줄이 그대로 보존된다');

  /* PDF getTextContent 스팬 분절 주민번호(['900101-','123','4567']) 로컬 추출·isEvalSupported:false·150쪽 상한 안내·손상 파일 거부 검증 */
  const prevPdfLib = globalThis.pdfjsLib;
  let capturedPdfOpts = null;
  let mockPdfPages = 1;
  globalThis.pdfjsLib = {
    getDocument(opts) {
      capturedPdfOpts = opts;
      return {
        promise: Promise.resolve({
          numPages: mockPdfPages,
          async getPage(pNo) {
            return {
              async getTextContent() {
                return {
                  items: pNo === 1 ? [
                    { str: '진술인 주민번호 ' },
                    { str: ['900101', '-'].join('') },
                    { str: '123' },
                    { str: '4567', hasEOL: true },
                  ] : [
                    { str: pNo + '쪽 본문', hasEOL: true },
                  ],
                };
              },
            };
          },
        }),
      };
    },
  };
  try {
    const fakePdfBytes = new TextEncoder().encode('%PDF-1.4 mock');
    const pdfRes = await H.extractDocumentText(fakePdfBytes, '진술서.pdf');
    assert.equal(pdfRes.ok, true, '로컬 PDF 텍스트 추출기가 동작한다');
    assert.equal(capturedPdfOpts && capturedPdfOpts.isEvalSupported, false, 'PDF.js 호출 시 CVE-2024-4367 방어용 isEvalSupported:false 를 반드시 넘긴다');
    assert.equal(pdfRes.truncated, false, '150쪽 이하 PDF는 잘림 표시가 없다');
    assert.ok(pdfRes.text.includes('900101-1******'), '스팬이 쪼개진 PDF 주민번호도 추출 즉시 마스킹된다');
    assert.equal(C.hasUnmaskedRrn(pdfRes.text), false, '추출된 PDF 텍스트에 미가림 주민번호가 남지 않는다');

    mockPdfPages = 151;
    const longPdfRes = await H.extractDocumentText(fakePdfBytes, '장문진술서.pdf');
    assert.equal(longPdfRes.ok, true, '151쪽 PDF도 앞 150쪽 본문을 안전하게 추출한다');
    assert.equal(longPdfRes.truncated, true, '150쪽 초과 PDF는 truncated:true 를 반환한다');
    assert.equal(longPdfRes.totalPages, 151, '전체 쪽수(151)를 반환한다');
    assert.equal(longPdfRes.readPages, 150, '읽은 쪽수(150)를 반환한다');
    assert.ok(longPdfRes.text.includes('전체 151쪽 중 앞 150쪽까지만 추출'), '본문 말미에 쪽수 상한 안내가 명시된다');

    const corruptHwpx = await H.extractDocumentText(new Uint8Array([1, 2]), 'bad.hwpx');
    assert.equal(corruptHwpx.ok, false, '손상된 .hwpx 바이트가 일반 텍스트 폴백으로 잘못 성공 처리되지 않는다');
    const corruptBin = await H.extractDocumentText(new Uint8Array([0, 1, 2, 3, 4]), 'unknown.dat');
    assert.equal(corruptBin.ok, false, 'NUL·제어문자가 섞인 임의 바이너리도 텍스트로 오인하지 않는다');
    const bomBypass = await H.extractDocumentText(new Uint8Array([0xff, 0xfe, 0x00, 0x00, 0x01, 0x00, 0x41, 0x00]), 'bom.dat');
    assert.equal(bomBypass.ok, false, 'UTF-16 BOM 뒤에 NUL·제어문자가 섞인 바이너리도 거부한다');
    const tailBypassBuf = new Uint8Array(4100);
    tailBypassBuf.fill(0x61);
    tailBypassBuf[4099] = 0x00;
    const tailBypass = await H.extractDocumentText(tailBypassBuf, 'tail.dat');
    assert.equal(tailBypass.ok, false, '4096바이트 이후 끝에 NUL·제어문자가 숨은 파일도 전체 길이 검사로 거부한다');
    const ratioBypassBuf = new TextEncoder().encode('정상 진술 본문 줄입니다.\n'.repeat(30) + '\x01');
    const ratioBypass = await H.extractDocumentText(ratioBypassBuf, 'ratio.txt');
    assert.equal(ratioBypass.ok, false, '소량의 비인쇄 제어문자(0x01)가 섞인 파일도 거부한다');

    const spacedRrn = ['900101', '- ', '123', ' ', '4567'].join('');
    assert.equal(C.hasUnmaskedRrn(spacedRrn), true, '내부 공백이 섞인 주민번호도 미가림 탐지기가 잡아낸다');
    assert.equal(C.maskRrnText(spacedRrn), '900101-1******', '내부 공백이 섞인 주민번호도 정확히 가린다');
  } finally {
    globalThis.pdfjsLib = prevPdfLib;
  }

  /* 장시간 면담(45문답) 무손실 파싱 검증 */
  const longLines = [];
  for (let n = 1; n <= 45; n++) {
    longLines.push(`문${n}: ${n}번째 확인 질문입니다.`);
    longLines.push(`답${n}: ${n}번째 진술 답변입니다.`);
  }
  const longParsed = C.parseTranscriptFallback(longLines.join('\n'));
  assert.equal(longParsed.qaList.length, 45, '40개를 넘는 장시간 면담 녹취록(45문답)도 잘리지 않고 모두 구조화된다');
  assert.equal(longParsed.truncatedQaCount, 0, '500문답 이하에서는 잘림 경고가 발생하지 않는다');

  /* 2) 최종 조사결과보고서 .hwpx 생성 및 재추출·본문 복원 왕복 검증 */
  const secRec = {
    overview: '직속 상사의 폭언 및 부당 업무배제 신고 건',
    conclusion: '근로기준법 제76조의2 직장 내 괴롭힘 해당',
    recommendations: '피해근로자 보호 및 행위자 징계·분리배치 권고',
    interviews: [ivRec],
    issues: [{
      id: 'iss-1',
      title: '회의실 공개 폭언',
      whenWhere: '2026-10 회의실',
      factStatus: 'recognized',
      elemSuperiority: 'yes',
      elemBeyondScope: 'yes',
      elemHarm: 'yes',
      verdict: 'yes',
    }],
    reportBody: '',
  };
  secRec.reportBody = C.assembleReportDraft(caseRec, secRec);
  assert.ok(secRec.reportBody.includes('정정·보완 의견'), '표준 보고서 초안 조립 시에도 진술인 정정·보완 의견과 서명 상태가 반영된다');

  const rptBytes = H.buildReportHwpx(caseRec, secRec);
  const extractedRpt = await H.extractDocumentText(rptBytes, '최종조사결과보고서.hwpx');
  assert.equal(extractedRpt.ok, true, '최종 조사결과보고서 .hwpx 를 생성하고 다시 읽을 수 있다');
  assert.ok(extractedRpt.text.includes('조사결과보고서') && extractedRpt.text.includes('회의실 공개 폭언'), '보고서 표제 및 3요건 판정 표가 .hwpx 에 수록된다');
  assert.equal(C.hasUnmaskedRrn(extractedRpt.text), false, '최종 보고서 .hwpx 에도 주민번호 원문이 남지 않는다');
  const restoredBody = H.extractReportBodyFromText(extractedRpt.text);
  assert.ok(
    restoredBody.startsWith('【 직장 내 괴롭힘 사안 외부전문가 조사결과보고서 】') &&
      restoredBody.includes('1. 사건 개요') &&
      !restoredBody.includes('3. 쟁점 행위별 근로기준법 3요건 검토 요약'),
    '보고서 .hwpx 재반입 시 앞쪽 요약표 중복 없이 원본 보고서 본문(reportBody)만 정확히 복원된다',
  );
});

test('⑩ 비밀 전자서명(PuHarassSign · sign-harass.html · harass_sign 규칙 · doc-read 서버 가드) 2채널 암호화 및 위변조 차단 검증', async () => {
  const S = require(path.join(ROOT, 'js', 'pu-harass-sign.js'));
  const cp = require('node:child_process');

  const k = S.newHexKey();
  const t = S.newHexKey();
  const code = S.newPasscode();
  assert.match(k, /^[0-9a-f]{32}$/, '128비트 16진 보안 열쇠가 생성된다');
  assert.match(code, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/, '60비트 고엔트로피 12자리 보안코드(XXXX-XXXX-XXXX)가 생성된다');
  assert.equal(S.cleanPasscode(code.toLowerCase()), code.replace(/-/g, ''), '소문자·하이픈 입력도 정규화 검증된다');

  const synthRrn = ['910202', '1234567'].join('-');
  const norm = S.normalizeSignPayload({
    docKind: 'pledge_and_stmt',
    role: 'victim',
    alias: '신고인 박검증',
    dept: '영업1팀',
    date: '2026-10-12',
    method: '대면면담',
    summary: '진술 요지 ' + synthRrn,
    qaList: [{ q: '확인 질문', a: '확인 답변 ' + synthRrn }],
  });
  assert.equal(C.hasUnmaskedRrn(S.canonicalString(norm)), false, '서명 페이로드 정규화 단계에서 주민번호가 자동 가려진다');

  const docHash = await S.sha256Hex(S.canonicalString(norm));
  assert.match(docHash, /^[0-9a-f]{64}$/, 'SHA-256 문서 무결성 지문(64자 hex)이 계산된다');

  const subAuth = await S.computeSubAuth(t, k, code, docHash);
  assert.match(subAuth, /^[0-9a-f]{64}$/, 't·#k·보안코드·docHash 결합 256비트 제출인증자(subAuth)가 생성된다');

  const enc = await S.encryptWithCode({ payload: norm, docHash }, k, code);
  assert.ok(!JSON.stringify(enc).includes('박검증') && !JSON.stringify(enc).includes('영업1팀'), '암호문 객체에는 당사자 이름·부서·진술 평문이 일절 남지 않는다');

  const dec = await S.decryptWithCode(enc, k, code);
  assert.equal(dec.docHash, docHash, '올바른 #k 열쇠와 12자리 보안코드로 복호화하면 원본 문서와 지문이 일치한다');

  await assert.rejects(() => S.decryptWithCode(enc, k, S.newPasscode()), '12자리 보안코드가 다르면 복호화가 거부된다');
  await assert.rejects(() => S.decryptWithCode(enc, S.newHexKey(), code), 'URL #k 열쇠 조각이 다르면 복호화가 거부된다');

  const link = S.linkOf('https://nabaho.github.io/pureunall/pu-harass.html', t, k);
  assert.equal(link, `https://nabaho.github.io/pureunall/sign-harass.html?t=${t}#k=${k}`, '열쇠 k 는 서버로 전송되지 않는 해시(#k) 조각에만 실린다');

  const msg1 = S.shareLinkMessage({ alias: '신고인 박검증', docKind: 'pledge_and_stmt', link, exp: Date.now() + 86400000 });
  const msg2 = S.shareCodeMessage({ accessCode: code });
  assert.ok(msg1.includes(link) && !msg1.includes(code), '1채널 링크 안내문에는 2채널 보안코드가 절대 함께 적히지 않는다');
  assert.ok(msg2.includes(code) && !msg2.includes(t) && !msg2.includes(k), '2채널 보안코드 안내문에는 링크나 #k 열쇠가 절대 함께 적히지 않는다');

  /* sign-harass.html 및 harass_sign 실시간DB 보안규칙 불변식 점검 */
  const signHtml = fs.readFileSync(path.join(ROOT, 'sign-harass.html'), 'utf8');
  assert.ok(signHtml.includes('noindex,nofollow') && signHtml.includes('no-referrer'), '외부 서명 화면은 검색 차단 및 리퍼러 차단을 갖춘다');
  assert.ok(signHtml.includes('PuOntologyWrite.prepareRecord'), '익명 서명 제출도 온톨로지 필수 메타데이터 계약을 준수한다');
  assert.ok(!signHtml.includes('pu_sign'), '전 직원 공유 서명함(pu_sign)을 참조하지 않고 전용 비밀 경로만 사용한다');
  assert.ok(signHtml.includes('applyTypedSigBtn'), '손서명이 어려운 사용자를 위한 키보드 성명 서명 대체 수단을 제공한다');

  const built = JSON.parse(cp.execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8' }));
  const hs = built.rules.harass_sign;
  assert.ok(hs && hs.req && hs.open, '실시간DB 규칙에 harass_sign(req·open)이 정의되어 있다');
  assert.equal(hs.req['.read'], undefined, 'harass_sign/req 상위 전체 목록 읽기가 닫혀 있다');
  assert.equal(hs.open['.read'], undefined, 'harass_sign/open 상위 전체 목록 읽기가 닫혀 있어 슬롯 열거가 불가능하다');
  assert.ok(hs.req.$cid['.read'].includes('managerMain'), '서명 요청 원장(req/$cid)은 해당 사건 주·부담당 노무사 및 대표만 읽을 수 있다');
  assert.ok(hs.open.$t.sub['.write'].includes('!data.exists()'), '서명 제출(sub)은 1회 제출 잠금(!data.exists())이 강제된다');
  assert.ok(hs.open.$t.sub['.write'].includes("child('subAuth').val()"), '서명 제출 시 256비트 제출인증자(subAuth) 일치를 서버 규칙이 강제하여 슬롯 선점을 차단한다');
  assert.ok(!JSON.stringify(hs).includes("'p4'"), '공개·요청 규칙 어디에도 취약한 4자리 전화번호(p4) 평문 필드를 쓰지 않는다');
  assert.ok(hs.open.$t.sub['.write'].includes("child('docHash').val()"), '서명 제출 시 원본 문서 해시(docHash) 일치를 서버 규칙이 검증한다');

  /* 500문답 대용량 진술확인서 암호화 압축 및 RTDB 허용 크기(MAX_ENC_CT_CHARS) 이내 통과 검증 */
  const qa500 = Array.from({ length: 500 }, (_, idx) => ({
    q: `${idx + 1}번째 면담 확인 질문입니다. 당시 회의실 상황과 참석자 발언을 구체적으로 설명해 주시겠습니까?`,
    a: `${idx + 1}번째 답변입니다. 당시 팀장이 업무 지시 범위를 넘어 반복적으로 서류를 던지고 인격 모독성 발언을 하였으며 동료들이 목격했습니다.`,
  }));
  const norm500 = S.normalizeSignPayload({
    docKind: 'pledge_and_stmt',
    role: 'victim',
    alias: '신고인 대용량검증',
    dept: '인사팀',
    date: '2026-10-12',
    method: '대면면담',
    summary: '장시간 면담 500문답 요약',
    qaList: qa500,
  });
  const hash500 = await S.sha256Hex(S.canonicalString(norm500));
  const enc500 = await S.encryptWithCode({ payload: norm500, docHash: hash500 }, k, code);
  assert.ok(enc500.ct.length <= S.MAX_ENC_CT_CHARS && enc500.ct.length <= 2500000, '500문답 암호문도 압축을 거쳐 실시간DB 허용 한도 이내로 생성된다');
  const dec500 = await S.decryptWithCode(enc500, k, code);
  assert.equal(dec500.payload.qaList.length, 500, '압축 암호화된 500문답이 손실 없이 복호화 복원된다');

  /* doc-read 서버 가드: inline_data 뿐 아니라 inlineData·fileData 등 복합 바이너리 필드를 원천 차단하고 text 만 재구성 */
  const DR = require(path.join(ROOT, 'functions', 'doc-read.js'));
  const badInlineCamel = DR.validate({
    app: 'harass',
    parts: [{ text: '정상 글자', inlineData: { mimeType: 'application/pdf', data: 'JVBERi0=' } }],
  });
  assert.equal(badInlineCamel.ok, false, '서버(doc-read.js)가 harass 요청의 camelCase inlineData 바이너리 밀반입을 거부한다');
  const badInlineSnake = DR.validate({
    app: 'harass',
    parts: [{ inline_data: { mime_type: 'image/png', data: 'iVBORw0KGgo=' } }],
  });
  assert.equal(badInlineSnake.ok, false, '서버(doc-read.js)가 harass 요청의 inline_data 바이너리를 거부한다');
  const badFileData = DR.validate({
    app: 'harass',
    parts: [{ text: '정상 글자', fileData: { fileUri: 'gs://bucket/raw.pdf' } }],
  });
  assert.equal(badFileData.ok, false, '서버(doc-read.js)가 harass 요청의 fileData 등 기타 필드를 거부한다');
  const goodHarass = DR.validate({
    app: 'harass',
    parts: [{ text: '면담 기록 ' + ['900101', '- ', '123', ' ', '4567'].join('') }],
  });
  assert.equal(goodHarass.ok, true, '순수 text 단일 필드만 담긴 harass 요청은 통과한다');
  assert.deepEqual(goodHarass.parts, [{ text: '면담 기록 900101-1******' }], '서버(doc-read.js)에서도 분절 주민번호를 재가림한 새 객체만 전달한다');
});

test('⑪ 모바일 전자서명 수거(harvestCaseSignatures) — 복호화 검증 · 비밀금고 봉인 · 공개슬롯 암호문 폐기 · 8단계 동기화', async () => {
  const vm = require('node:vm');
  const S = require(path.join(ROOT, 'js', 'pu-harass-sign.js'));
  const H = require(path.join(ROOT, 'js', 'pu-harass-hwpx.js'));

  const cid = 'hc-sign-1';
  const ivId = 'iv-sign-1';
  const reqId = 'sr-test-1';
  const t = S.newHexKey();
  const k = S.newHexKey();
  const accessCode = S.newPasscode();
  const validSigUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const baseIv = {
    id: ivId,
    role: 'victim',
    alias: '신고인 최검증',
    dept: '개발팀',
    date: '2026-10-15',
    method: '대면면담',
    pledgeSigned: false,
    stmtSigned: false,
    summary: '팀장으로부터 공개석상 모욕 발언을 들음',
    qaList: [{ q: '발언 내용이 무엇입니까?', a: '인격 모독성 폭언을 들었습니다.' }],
  };

  const normPayload = S.normalizeSignPayload({
    docKind: 'pledge_and_stmt',
    role: baseIv.role,
    alias: baseIv.alias,
    dept: baseIv.dept,
    date: baseIv.date,
    method: baseIv.method,
    summary: baseIv.summary,
    qaList: baseIv.qaList,
  });
  const docHash = await S.sha256Hex(S.canonicalString(normPayload));
  const subAuth = await S.computeSubAuth(t, k, accessCode, docHash);
  const encPayload = await S.encryptWithCode({ payload: normPayload, docHash }, k, accessCode);
  const encSub = await S.encryptWithCode({
    docHash,
    sigDataUrl: validSigUrl,
    amendNote: '문답 1번 일시는 오후 3시경입니다.',
    pledgeAgree: true,
    agree: true,
  }, k, accessCode);

  const dbStore = {
    'uid_roles/uAtty': { sid: 'P001', name: '담당노무', status: 'active', isAdmin: false },
    'data/user_dir': [{ sid: 'P001', name: '담당노무', status: 'active' }],
    'harass_invest/cases': {
      [cid]: {
        id: cid, companyId: 'co-1', companyName: '(주)서명수거검증', title: '서명 수거 사건',
        managerMain: 'P001', managerSubs: [], receiveDate: '2026-10-01', steps: {}, mailLinks: [],
      },
    },
    [`harass_secret/${cid}`]: {
      id: cid, companyId: 'co-1', overview: '', conclusion: '', recommendations: '',
      interviews: [baseIv], issues: [], reportBody: '',
    },
    [`harass_sign/req/${cid}`]: {
      [reqId]: {
        id: reqId, cid, companyId: 'co-1', ivId, alias: baseIv.alias, docKind: 'pledge_and_stmt',
        t, k, accessCode, subAuth, exp: Date.now() + 86400000, docHash, status: 'sent',
      },
    },
    [`harass_sign/open/${t}`]: {
      id: t, cid, reqId, companyId: 'co-1', exp: Date.now() + 86400000, docHash, encPayload,
      sub: { id: t, entityType: 'Submission', subAuth, docHash, agree: true, pledgeAgree: true, at: 1760500000000, encSub },
    },
  };

  function makeEl(id) {
    const classes = new Set();
    return {
      id, value: '', textContent: '', innerHTML: '', style: {}, disabled: false,
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        toggle(c, f) { const on = f === undefined ? !classes.has(c) : !!f; if (on) classes.add(c); else classes.delete(c); },
        contains(c) { return classes.has(c); },
      },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getAttribute() { return ''; },
      closest() { return null; },
      matches() { return false; },
    };
  }
  const els = {};
  const getEl = (id) => (els[id] = els[id] || makeEl(id));
  const docListeners = {};

  function makeRef(p) {
    return {
      path: p,
      child(seg) { return makeRef(p ? p + '/' + seg : String(seg)); },
      on() {},
      off() {},
      once() {
        return Promise.resolve({ val: () => (dbStore[p] !== undefined ? dbStore[p] : null) });
      },
    };
  }

  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Promise, URLSearchParams,
    PuHarassCore: C,
    PuHarassSign: S,
    PuHarassHwpx: H,
    PuOntologyWrite: {
      createGateway() {
        return {
          async save(ref, fn) {
            const prev = dbStore[ref.path] || null;
            const next = typeof fn === 'function' ? fn(prev) : fn;
            dbStore[ref.path] = next;
            if (ref.path.startsWith('harass_invest/cases/')) {
              const id = ref.path.split('/')[2];
              dbStore['harass_invest/cases'][id] = next;
            }
            if (ref.path.startsWith(`harass_sign/req/${cid}/`)) {
              const rid = ref.path.split('/')[3];
              dbStore[`harass_sign/req/${cid}`][rid] = next;
            }
            return { committed: true, snapshot: { val: () => next } };
          },
        };
      },
    },
    PuGate: { show() {}, hide() {} },
    location: { search: '', hash: '', pathname: '/pu-harass.html', href: 'https://nabaho.github.io/pureunall/pu-harass.html' },
    history: { replaceState() {} },
    document: {
      activeElement: null,
      contains: () => false,
      getElementById: (id) => getEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    },
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-harass-view.js'), 'utf8'), ctx);

  let authCb = null;
  const curUser = { uid: 'uAtty', getIdToken: async () => 'tok' };
  ctx.PuHarassView.boot({
    auth: Object.assign(() => ({
      currentUser: curUser,
      setPersistence() {},
      onAuthStateChanged(fn) { authCb = fn; },
    }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    database: () => ({ ref: (p) => makeRef(p || '') }),
  });

  await authCb(curUser);

  /* 보고서 작업실 열기 → 자동 서명 수거(harvestCaseSignatures) 완료까지 결정론적 대기(병렬 실행 시 타이밍 흔들림 방지) */
  const openReportBtn = {
    disabled: false,
    getAttribute: (n) => (n === 'data-act' ? 'openReport' : n === 'data-id' ? cid : ''),
  };
  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? openReportBtn : null) },
    stopPropagation() {},
  });
  for (let attempt = 0; attempt < 200; attempt++) {
    const curSec = dbStore[`harass_secret/${cid}`];
    const curCase = dbStore['harass_invest/cases'][cid];
    if (curSec && curSec.interviews[0] && curSec.interviews[0].stmtSigned && curCase && curCase.steps && curCase.steps.victim && curCase.steps.victim.done) {
      break;
    }
    await new Promise((r) => setTimeout(r, 25));
  }

  const savedSecret = dbStore[`harass_secret/${cid}`];
  const sealedIv = savedSecret.interviews[0];
  assert.equal(sealedIv.stmtSigned, true, '외부 서명 제출본이 자동 복호화·검증되어 면담 진술서명 완료(stmtSigned)로 봉인된다');
  assert.equal(sealedIv.pledgeSigned, true, '비밀유지서약 완료(pledgeSigned)도 함께 체크된다');
  assert.equal(sealedIv.amendNote, '문답 1번 일시는 오후 3시경입니다.', '서명자가 제출한 정정·보완 의견이 진술 기록에 보존된다');
  assert.equal(sealedIv.docHash, docHash, '원본 문서 SHA-256 지문이 진술 기록에 함께 봉인된다');

  const scrubbedOpen = dbStore[`harass_sign/open/${t}`];
  assert.equal(scrubbedOpen._deleted, true, '수거 완료된 공개 슬롯은 온톨로지 삭제 표식(_deleted:true)으로 봉인된다');
  assert.equal(scrubbedOpen.void, true, '공개 슬롯이 무효화(void:true)된다');
  assert.equal(scrubbedOpen.encPayload, undefined, '공개 슬롯에 남아 있던 문서 암호문(encPayload)이 깨끗이 제거된다');
  assert.equal(scrubbedOpen.sub, undefined, '공개 슬롯에 남아 있던 제출 암호문(sub)도 깨끗이 제거된다');

  const updatedCase = dbStore['harass_invest/cases'][cid];
  assert.equal(updatedCase.steps.pledge.done, true, '서명 수거와 동시에 3단계(비밀서약 징구)가 자동 완료된다');
  assert.equal(updatedCase.steps.victim.done, true, '서명 수거와 동시에 4단계(피해자 면담)가 자동 완료된다');
  assert.ok(getEl('reportBox').innerHTML.includes('진술서명 완료'), '통합 작업실 왼쪽 카드에 진술서명 완료 배지가 즉시 표시된다');
  assert.ok(getEl('reportBox').innerHTML.includes('오후 3시경입니다'), '통합 작업실 왼쪽 카드에 진술인의 정정·보완 의견이 강조 표시된다');
});

test('⑫ 지난메일(POP3 mailbox/old/msgs) 통합·사업장 약칭 2차 확장·예방교육 분리·다년도 에피소드 분할 및 연도별 전체 자료함 검증', async () => {
  const vm = require('node:vm');
  /* 1) coCoreNorm 약칭 정규화 및 ymdOf 극단값 방어 검증 */
  assert.equal(C.coCoreNorm('(주) 가나점검장항공장'), '가나점검', '사업장 끝 공장·지점 접미어를 덜어내 핵심 상호를 추출한다');
  assert.equal(C.coCoreNorm('국공립푸른점검어린이집'), '푸른점검어린이집', '국공립·공립 접두어를 덜어내 핵심 기관명을 추출한다');
  assert.equal(C.ymdOf(Number.MAX_VALUE), '', 'ymdOf 는 범위 밖 숫자(Number.MAX_VALUE)에도 예외 없이 빈 문자열을 돌려준다');

  /* 2) flattenMailbox — IMAP↔POP3 정밀 중복제거, POP3 간 오병합 방지 및 370-6@daum.net 발신 판별 */
  const t2026 = Date.UTC(2026, 1, 10, 3, 0, 0);
  const t2026b = Date.UTC(2026, 1, 18, 3, 0, 0);
  const t2025 = Date.UTC(2025, 5, 12, 3, 0, 0);
  const t2023 = Date.UTC(2023, 3, 20, 3, 0, 0);
  const t2021 = Date.UTC(2021, 8, 5, 3, 0, 0);

  const folders = {
    inbox: { kind: 'inbox', name: '받은편지함' },
    tome: { kind: 'tome', name: '내게쓴편지함' },
  };
  const imapMsgs = {
    inbox: {
      '501': { u: '501', s: '[가나점검] 직장 내 괴롭힘 조사 착수공문 송부', f: '인사담당', e: 'hr@gana-branch.example', t: '370-6@daum.net', d: t2026, a: 1, an: ['착수공문.hwp'], p: '조사 착수 요청' },
      '502': { u: '502', s: '피신고인 문답서 및 추가 소명서 제출의 건', f: '인사담당', e: 'hr@gana-branch.example', t: '370-6@daum.net', d: t2026b, a: 1, an: ['문답서.hwpx'], p: '소명서 첨부' },
      '503': { u: '503', s: '2026년 직장 내 성희롱 예방교육 일지 및 수료증 송부', f: '총무팀', e: 'edu@edu-sample.example', t: '370-6@daum.net', d: t2026, a: 1, an: ['성희롱예방교육일지.pdf'], p: '법정의무교육 자료' },
    },
    tome: {
      '601': { u: '601', s: '푸른점검어린이집 직장 내 괴롭힘 조사결과보고서 초안', f: '점검노무사', e: '370-6@daum.net', t: 'care@child-sample.example', d: t2026, a: 1, an: ['조사결과보고서.hwpx'], p: '보고서 송부' },
    },
  };
  const oldPopMsgs = {
    /* 501 과 동일 시각·발신자·수신자·제목·첨부 → IMAP↔POP3 중복 제거 대상 */
    'p_dup': { u: 'p_dup', s: '[가나점검] 직장 내 괴롭힘 조사 착수공문 송부', f: '인사담당', e: 'hr@gana-branch.example', t: '370-6@daum.net', d: t2026 + 500, a: 1, an: ['착수공문.hwp'] },
    /* 동일 제목으로 5초 간격에 서로 다른 수신처(a·b)로 발송된 별개 POP3 메일 2통 → 둘 다 보존되어야 함 */
    'p_same_a': { u: 'p_same_a', s: '조사 협조 공문 안내', f: '푸른점검', e: '370-6@daum.net', t: 'a@client-one.example', d: t2023 + 1000, a: 0, an: [] },
    'p_same_b': { u: 'p_same_b', s: '조사 협조 공문 안내', f: '푸른점검', e: '370-6@daum.net', t: 'b@client-two.example', d: t2023 + 6000, a: 0, an: [] },
    /* outOfWindow 폴백 점검용 과거 메일 (메모리상의 mailbox/old/msgs 에는 p 가 존재) */
    'pop_oow': { u: 'pop_oow', s: '2021년 착수공문', f: '담당자', e: 'old@past-sample.example', t: '370-6@daum.net', d: Date.UTC(2021, 2, 1), a: 1, an: ['착수공문.hwp'], p: '보관된 착수공문 요약글 900101-1234567' },
    /* 동일 사업장(co-gana)의 2023년 과거 별개 사건 */
    'p_2023': { u: 'p_2023', s: '[(주)가나점검장항공장] 직장 내 성희롱 조사결과보고서 최종본', f: '푸른점검', e: '370-6@daum.net', t: 'hr@gana-branch.example', d: t2023, a: 1, an: ['성희롱조사보고서_2023.hwpx'], p: '2023년 사건 종결 보고' },
    /* 반복 의뢰사(나라마바점검)의 2025년 사건 & 2021년 사건 → 2개 에피소드로 분리되어야 함 */
    'p_2025': { u: 'p_2025', s: '[(주)나라마바점검] 직장 내 괴롭힘 외부전문가 조사 위임계약서', f: '법무팀', e: 'legal@naramaba.example', t: '370-6@daum.net', d: t2025, a: 1, an: ['위임계약서_2025.pdf'], p: '2025년 조사 위임' },
    'p_2021': { u: 'p_2021', s: '[(주)나라마바점검] 직장 내 괴롭힘 신고 진상조사 보고서 송부', f: '푸른점검', e: '370-6@daum.net', t: 'legal@naramaba.example', d: t2021, a: 1, an: ['진상조사보고서_2021.hwp'], p: '2021년 조사 보고' },
  };

  const flat = C.flattenMailbox(folders, imapMsgs, oldPopMsgs);
  assert.equal(flat.some((r) => r.key === 'p:p_dup'), false, 'IMAP에 이미 있는 동일 메일은 POP3 병합 시 자동 중복 제거된다');
  assert.equal(flat.some((r) => r.key === 'p:p_same_a') && flat.some((r) => r.key === 'p:p_same_b'), true, '5초 간격·동일 제목이라도 수신자가 다른 별개 POP3 메일 2통은 절대 하나로 합쳐지지 않는다');
  const p2023Row = flat.find((r) => r.key === 'p:p_2023');
  assert.ok(p2023Row && p2023Row.dir === 'out' && p2023Row.old === true, '370-6@daum.net 발신 지난메일은 발신(out)·old:true 로 분류된다');

  /* 3) 단순 법정의무 예방교육 메일 제외 + 공유 사건 원장용 mailLink 에 본문 preview 미포함 검증 */
  const eduRow = flat.find((r) => r.key === 'i:inbox:503');
  assert.equal(C.inspectMailForHarass(eduRow, true), null, '단순 성희롱 예방교육 일지 메일은 조사 사건 자동발굴에서 제외된다');
  const inspected2023 = C.inspectMailForHarass(p2023Row, true);
  assert.equal(inspected2023.preview, undefined, '공유 원장(harass_invest/cases)에 저장될 mailLink 객체는 본문 미리보기(preview)를 담지 않는다');

  /* 4) 업체 이메일 미등록 ERP 사건도 coCoreNorm + 2차 상대방 주소 확장으로 후속 문답서(502)까지 수집하되 2023년 메일은 섞지 않는다 */
  const coDir = C.buildCompanyDirectory([
    { id: 'co-gana', name: '(주) 가나점검장항공장', bizNo: '123-81-55555', email: 'hr@gana-branch.example' },
  ]);
  const erpCaseNoEmail = {
    id: 'hc-gana-2026',
    companyId: '',
    companyName: '(주) 가나점검장항공장',
    receiveDate: '2026-02-01',
    mailLinks: [],
  };
  const ganaMails = C.collectMailsForCase(erpCaseNoEmail, flat, null, []);
  assert.equal(ganaMails.length, 2, '약칭([가나점검]) 1차 매칭 후 동일 기간 후속 문답서(502)까지 2건 모두 수집하고 2023년 메일은 섞지 않는다');

  /* 5) 다년도 사건 발굴 및 연도 단위 제외(dismissed) 키 격리 검증 */
  const regCase2026 = {
    id: 'hc-gana-reg',
    companyId: 'co-gana',
    companyName: '(주) 가나점검장항공장',
    receiveDate: '2026-02-01',
    mailLinks: ganaMails,
  };
  const bundles = C.discoverUnregisteredBundles(flat, [regCase2026], coDir, {});
  const gana2023Bundle = bundles.find((b) => b.companyId === 'co-gana' && C.bundleYearOf(b) === '2023');
  assert.ok(gana2023Bundle, '2026년 등록사건이 있는 사업장의 2023년 과거 별개 사건이 누락되지 않고 발굴된다');
  assert.ok(/_2023\d{4}$/.test(gana2023Bundle.bundleKey), '묶음 열쇠에 에피소드 고유 시작일(_2023MMDD)이 고정되어 다른 사건과 격리된다');
  const naraBundles = bundles.filter((b) => b.companyName.includes('나라마바점검'));
  assert.equal(naraBundles.length, 2, '동일 의뢰처의 2025년·2021년 사건이 연도별 별개 묶음 2건으로 분리된다');

  /* 동일 업체 같은 해(2023-01-05 · 2023-08-10) 두 사건에서 앞 사건을 등록해도 뒤 사건의 bundleKey 가 흔들리지 않아 제외(dismissed) 상태가 유지된다 */
  const sameYearRows = C.flattenMailbox({}, {}, {
    'sy_1': { u: 'sy_1', s: '[동일연도점검] 직장 내 괴롭힘 조사 의뢰', f: '인사팀', e: 'hr@sameyear.example', t: '370-6@daum.net', d: Date.UTC(2023, 0, 5, 3, 0, 0), a: 0, an: [] },
    'sy_2': { u: 'sy_2', s: '[동일연도점검] 직장 내 성희롱 조사 의뢰', f: '인사팀', e: 'hr@sameyear.example', t: '370-6@daum.net', d: Date.UTC(2023, 7, 10, 3, 0, 0), a: 0, an: [] },
  });
  const syInitial = C.discoverUnregisteredBundles(sameYearRows, [], coDir, {});
  assert.equal(syInitial.length, 2, '같은 해라도 120일 초과 공백이 있으면 별개 에피소드 2건으로 나뉜다');
  const sySecond = syInitial.find((b) => b.firstDate === '2023-08-10');
  assert.ok(sySecond, '8월 두 번째 에피소드가 존재한다');
  const syAfterRegFirst = C.discoverUnregisteredBundles(
    sameYearRows,
    [{ id: 'hc-sy-1', companyName: '동일연도점검', receiveDate: '2023-01-05', mailLinks: [{ key: 'p:sy_1' }] }],
    coDir,
    { [sySecond.bundleKey]: { id: sySecond.bundleKey } }
  );
  assert.equal(syAfterRegFirst.length, 0, '앞 에피소드가 기등록 처리되더라도 제외해 둔 뒤 에피소드의 bundleKey 가 변하지 않아 되살아나지 않는다');

  /* 2023년 묶음을 제외 처리하더라도 동일 의뢰처의 향후 2026년 신규 묶음은 정상 노출된다 */
  const dismissed2023 = { [gana2023Bundle.bundleKey]: { id: gana2023Bundle.bundleKey } };
  const futureBundles = C.discoverUnregisteredBundles(flat, [], coDir, dismissed2023);
  assert.equal(futureBundles.some((b) => b.companyId === 'co-gana' && C.bundleYearOf(b) === '2023'), false, '제외 처리한 2023년 묶음은 숨겨진다');
  assert.equal(futureBundles.some((b) => b.companyId === 'co-gana' && C.bundleYearOf(b) === '2026'), true, '과거 연도 묶음을 제외해도 같은 사업장의 2026년 신규 묶음은 가려지지 않는다');

  const archive = C.buildYearlyArchive([regCase2026], bundles);
  assert.deepEqual(archive.years, ['2026', '2025', '2023', '2021'], '연도별 전체 자료함이 최신 연도순(2026→2025→2023→2021)으로 집계된다');
  assert.equal(archive.totalCases, 1, '등록 사건 수가 정확히 집계된다');
  assert.equal(archive.totalBundles, 4, '미등록 묶음 수(2026 어린이집 + 2025 나라마바 + 2023 가나 + 2021 나라마바)가 정확히 집계된다');

  /* 6) PuHarassView — preview 무저장 정화, readOldMail / outOfWindow RRN 가림 폴백, CSV·유형칩 필터 일치 및 일괄 제외 1회 저장 검증 */
  const els = {};
  const savedSnapshots = {};
  const updateCalls = [];
  const confirmMsgs = [];
  const capturedCsvTexts = [];
  const makeEl = (id) => ({
    id, value: '', textContent: '', innerHTML: '', checked: false, disabled: false,
    style: { display: '' },
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener(ev, fn) { (this._ev = this._ev || {})[ev] = fn; },
    querySelector: () => null, querySelectorAll: () => [], focus() {},
  });
  const getEl = (id) => (els[id] = els[id] || makeEl(id));
  const calledFns = [];
  const docListeners = {};
  const mockDb = {
    'uid_roles/u1': { sid: 'P001', name: '점검노무', status: 'active', isAdmin: true },
    'data/user_dir': [{ sid: 'P001', name: '점검노무', status: 'active' }],
    'harass_invest/cases': {
      'hc-old-1': {
        id: 'hc-old-1', companyName: '(주)과거메일점검', title: '2022년 조사 건', category: 'harass', managerMain: 'P001', receiveDate: '2022-05-10',
        mailLinks: [
          { key: 'p:pop_ok', slug: '*old', uid: 'pop_ok', old: true, date: '2022-05-12', subject: '2022년 진술서', preview: '과거 잔존 미리보기', attNames: ['진술서.hwpx'] },
          { key: 'p:pop_oow', slug: '*old', uid: 'pop_oow', old: true, date: '2021-03-01', subject: '2021년 착수공문', attNames: ['착수공문.hwp'] },
        ],
      },
      'hc-2023-h': {
        id: 'hc-2023-h', companyName: '(주)둘공이삼괴롭힘', title: '2023년 괴롭힘 건', category: 'harass', managerMain: 'P001', receiveDate: '2023-02-10',
        mailLinks: [],
      },
    },
    'mailbox/old/msgs': oldPopMsgs,
  };
  function makeRef(p) {
    return {
      path: p,
      child(s) { return makeRef(p ? p + '/' + s : String(s)); },
      on() {}, off() {},
      once: () => Promise.resolve({ val: () => (mockDb[p] !== undefined ? mockDb[p] : null) }),
      async update(patch) {
        updateCalls.push({ path: p, patch });
        return true;
      },
    };
  }
  class MockBlob {
    constructor(parts, opts) {
      this.parts = parts;
      this.type = opts && opts.type;
      capturedCsvTexts.push(parts.join(''));
    }
  }
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Promise, URLSearchParams, Blob: MockBlob,
    confirm(msg) { confirmMsgs.push(msg); return true; },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    PuHarassCore: C,
    PuGate: { show() {}, hide() {} },
    PuOntologyWrite: {
      createGateway: () => ({
        prepare(rec, cOpts) {
          return {
            ok: true,
            value: Object.assign({}, rec, {
              entityType: (cOpts && cOpts.entityType) || 'Task',
              createdAt: 1,
              updatedAt: 2,
              revision: 1,
            }),
            issues: [],
          };
        },
        async save(r, fn) {
          const prev = mockDb[r.path] || null;
          const v = typeof fn === 'function' ? fn(prev) : fn;
          savedSnapshots[r.path] = v;
          return { committed: true, snapshot: { val: () => v } };
        },
      }),
    },
    fetch(url, opts) {
      const fnName = String(url).split('/').pop();
      const body = JSON.parse((opts && opts.body) || '{}');
      calledFns.push({ fnName, body });
      if (fnName === 'readOldMail' && body.key === 'pop_oow') {
        return Promise.resolve({ json: async () => ({ ok: false, outOfWindow: true, error: 'POP3 창 밖' }) });
      }
      return Promise.resolve({ json: async () => ({ ok: true, text: 'POP3_OLD_MAIL_BODY_OK', atts: [] }) });
    },
    location: { search: '?tab=yearly', hash: '', pathname: '/pu-harass.html' },
    history: { replaceState() {} },
    document: {
      activeElement: null, contains: () => false,
      createElement: () => ({ click() {}, remove() {}, style: {} }),
      body: { appendChild() {} },
      getElementById: (id) => getEl(id),
      querySelector: () => null, querySelectorAll: () => [],
      addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    },
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-harass-view.js'), 'utf8'), ctx);

  let authCb = null;
  const curUser = { uid: 'u1', getIdToken: async () => 'tok-1' };
  ctx.PuHarassView.boot({
    auth: Object.assign(() => ({ currentUser: curUser, setPersistence() {}, onAuthStateChanged(fn) { authCb = fn; } }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    database: () => ({ ref: (p) => makeRef(p || '') }),
  });
  await authCb(curUser);

  assert.equal(getEl('p-yearly').classList.contains('on'), true, '?tab=yearly 딥링크로 연도별 전체 자료함 탭이 즉시 열린다');
  assert.ok(getEl('yrPillsBar').innerHTML.includes('aria-pressed="true"'), '연도 알약 필터 버튼에 aria-pressed 접근성 상태가 표시된다');
  assert.ok(getEl('yearlyBox').innerHTML.includes('2022년'), '연도별 전체 자료함에 2022년 사건 카드가 렌더링된다');
  assert.ok(getEl('yearlyBox').innerHTML.includes('2021년'), '연도별 전체 자료함에 POP3 2021년 메일 묶음 카드가 렌더링된다');

  /* 화면 필터(#yrCat='sexual') 적용 시 카드 머리글 유형 칩과 CSV 내보내기가 모두 필터 결과와 일치하는지 검증 */
  getEl('yrCat').value = 'sexual';
  getEl('yrCat')._ev.change();
  assert.ok(getEl('yearlyBox').innerHTML.includes('괴롭힘 0') && getEl('yearlyBox').innerHTML.includes('성희롱 1'), '유형 필터 적용 시 연도 카드 상단 집계 칩도 거른 행 기준 건수(괴롭힘 0 · 성희롱 1)를 표시한다');
  getEl('yrCsvBtn')._ev.click();
  assert.equal(capturedCsvTexts.length, 1, '연도별 목록 CSV 내보내기 Blob 이 생성된다');
  assert.ok(capturedCsvTexts[0].includes('가나점검장항공장'), '성희롱 필터 적용 시 2023년 성희롱 묶음이 CSV에 포함된다');
  assert.equal(capturedCsvTexts[0].includes('과거메일점검'), false, '성희롱 필터 적용 시 괴롭힘 사건은 CSV에서 제외된다');
  getEl('yrCat').value = '';
  getEl('yrCat')._ev.change();

  /* 후보 묶음 다중 선택 제외 시 건수 확인(confirm) 및 단일 update 저장 검증 */
  const nara2025Key = naraBundles.find((b) => C.bundleYearOf(b) === '2025').bundleKey;
  const nara2021Key = naraBundles.find((b) => C.bundleYearOf(b) === '2021').bundleKey;
  docListeners.change = docListeners.change || [];
  /* 체크박스 선택 이벤트를 태워 2건을 고른 뒤 일괄 제외 실행 */
  await docListeners.click[0]({
    target: { closest: (sel) => (sel === 'button[data-tab]' ? null : null) },
    stopPropagation() {},
  });
  /* change 리스너로 bundles 체크박스 2건 선택 */
  const changeFn = docListeners.change && docListeners.change[0];
  assert.ok(changeFn, '체크박스 change 이벤트 리스너가 등록되어 있다');
  await changeFn({ target: { checked: true, matches: (sel) => sel === '[data-ck]', getAttribute: (n) => (n === 'data-ck' ? 'bundles|' + nara2025Key : null) } });
  await changeFn({ target: { checked: true, matches: (sel) => sel === '[data-ck]', getAttribute: (n) => (n === 'data-ck' ? 'bundles|' + nara2021Key : null) } });
  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-bulkact]' ? { disabled: false, getAttribute: () => 'bundles:hide' } : null) },
    stopPropagation() {},
  });
  assert.ok(confirmMsgs.some((m) => m.includes('2건')), '다중 후보 제외 시 선택한 건수(2건)를 먼저 확인한다');
  assert.equal(updateCalls.length, 1, '다중 후보 제외 시 개별 루프 저장 대신 단일 원자적 update 1회로 저장한다');
  assert.deepEqual(Object.keys(updateCalls[0].patch).sort(), [nara2021Key, nara2025Key].sort(), '선택한 두 후보 묶음 키가 한 번의 update 패치에 함께 담긴다');

  /* 등록 사건(hc-old-1) 상세 열기 → 단계 토글 저장 시 기존 mailLinks 의 preview 가 깨끗이 제거되는지 검증 */
  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? { disabled: false, getAttribute: (n) => (n === 'data-act' ? 'openDetail' : 'hc-old-1') } : null) },
    stopPropagation() {},
  });
  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? { disabled: false, getAttribute: (n) => (n === 'data-act' ? 'toggleStep' : 'intake') } : null) },
    stopPropagation() {},
  });
  const savedCase = savedSnapshots['harass_invest/cases/hc-old-1'];
  assert.ok(savedCase && Array.isArray(savedCase.mailLinks), '사건 저장 스냅샷이 생성된다');
  assert.equal(savedCase.mailLinks.some((m) => m.preview !== undefined), false, '저장된 harass_invest/cases/*/mailLinks 에는 preview 본문 조각이 절대 남지 않는다');

  /* POP3 지난메일(pop_ok) 열람 시 readOldMail 엔드포인트가 호출된다 */
  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? { disabled: false, getAttribute: (n) => (n === 'data-act' ? 'viewMail' : 'p:pop_ok') } : null) },
    stopPropagation() {},
  });
  assert.ok(calledFns.some((c) => c.fnName === 'readOldMail' && c.body.key === 'pop_ok'), 'slug:*old 지난메일 열람 시 readOldMail API를 호출한다');
  assert.equal(getEl('mMailBody').textContent, 'POP3_OLD_MAIL_BODY_OK', 'POP3 지난메일 본문이 모달에 안전하게 표시된다');

  /* POP3 3만 통 창 밖(outOfWindow) 지난메일은 mailLinks 에 preview 가 없어도 메모리상 mailbox/old/msgs 요약(주민번호 마스킹 적용)을 안내한다 */
  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? { disabled: false, getAttribute: (n) => (n === 'data-act' ? 'viewMail' : 'p:pop_oow') } : null) },
    stopPropagation() {},
  });
  assert.ok(getEl('mMailBody').textContent.includes('보관된 착수공문 요약글 900101-1******'), 'outOfWindow 과거 메일은 메모리 보관함의 요약을 주민번호 가림 처리하여 표시한다');
});

test('⑬ 현장 상담 실시간 음성녹취(Web Speech API) 좌·우 창 자동채움 및 과거 자료 이알피 번호 공란(erpDefer) 편입·일괄정리 검증', async () => {
  const vm = require('node:vm');
  const synthRrn = ['880707', '1234567'].join('-');

  /* 1) C.buildErpSyncPayload & C.synthesizeWorkspaceFromCase 단위 검증 */
  const deferCase = {
    id: 'hc-defer-unit',
    companyId: '',
    companyName: '(주)과거보류점검',
    category: 'harass',
    title: '(주)과거보류점검 직장 내 괴롭힘 조사',
    managerMain: 'P001',
    receiveDate: '2022-04-10',
    erpCaseId: '',
    erpCaseNo: '',
    erpDefer: true,
    steps: {
      intake: { done: true, date: '2022-04-10', note: '착수 공문 접수' },
      victim: { done: true, date: '2022-04-15', note: '피해근로자 진술서 접수' },
    },
    mailLinks: [
      { key: 'p:u1', slug: '*old', uid: 'u1', date: '2022-04-15', subject: '[(주)과거보류점검] 피해근로자 진술서 송부', docRole: 'victim_stmt', attNames: ['피해진술서.hwpx'] },
    ],
  };

  assert.equal(C.buildErpSyncPayload(deferCase), null, 'erpDefer:true 이고 erpCaseId 가 비어 있으면 이알피 동기화 페이로드를 발행하지 않아 번호를 공란으로 유지한다');
  const promotedPayload = C.buildErpSyncPayload(Object.assign({}, deferCase, { erpDefer: false }));
  assert.ok(promotedPayload && promotedPayload.harassCaseId === 'hc-defer-unit', '추후 일괄정리에서 erpDefer:false 로 전환하면 이알피 채번·동기화 페이로드가 정상 생성된다');

  const synInit = C.synthesizeWorkspaceFromCase(deferCase, {});
  assert.ok(synInit.interviews.length >= 1, '수집 공문·기초정보로부터 좌측 면담·진술 기록이 자동 합성된다');
  assert.ok(synInit.issues.length >= 1, '우측 법정 3요건 쟁점 검토표 기초 행이 자동 합성된다');
  assert.ok(synInit.overview.includes('(주)과거보류점검'), '우측 신고 요지(overview)가 자동 합성된다');
  assert.ok(synInit.recommendations.includes('근로기준법'), '우측 재발방지 권고안(recommendations)이 자동 합성된다');
  assert.ok(synInit.conclusion.length > 10, '우측 종합 결론 요지(conclusion)가 자동 합성된다');
  assert.ok(synInit.reportBody.includes('조사결과보고서'), '우측 표준 조사결과보고서 본문 초안(reportBody)이 자동 조립된다');
  assert.equal(synInit.reportBodyAuto, true, '자동 생성된 보고서 본문은 reportBodyAuto:true 표식을 갖는다');

  /* 사용자가 수동 작성해 저장한 보고서 본문(reportBodyAuto:false)은 새 면담 추가 시에도 보존된다 */
  const manualSec = Object.assign({}, synInit, { reportBody: 'CUSTOM_MANUAL_REPORT_BODY', reportBodyAuto: false });
  const synKeepManual = C.synthesizeWorkspaceFromCase(deferCase, manualSec, {
    upsertInterview: {
      id: 'iv-new',
      role: 'victim',
      alias: '신고인 가',
      date: '2022-04-16',
      qaList: [{ q: '회의 폭언 여부', a: '팀장이 공개석상에서 폭언과 업무 배제를 했습니다.' }],
      summary: '공개 폭언 및 업무배제',
    },
    refreshReportBody: true,
  });
  assert.equal(synKeepManual.reportBody, 'CUSTOM_MANUAL_REPORT_BODY', '수동 편집된 보고서 본문(reportBodyAuto:false)은 덮어쓰지 않고 보존한다');
  assert.ok(synKeepManual.issues.some((x) => x.title.includes('회의 폭언') || x.claimVictim.includes('폭언')), '새 면담의 3요건 쟁점 후보는 우측 검토표에 정상 추가된다');

  /* 2) pu-erp.html 방어선: erpDefer:true 인 사건은 혹시 큐 조각이 남아 있어도 신규 채번하지 않는다 */
  const erpSrc = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const sIdx = erpSrc.indexOf('var _erpHarassSyncBusy = Object.create(null);');
  const eIdx = erpSrc.indexOf('async function erpHarassInvestSync(', sIdx);
  let mintedCount = 0;
  const erpGuardCtx = vm.createContext({
    Object, Array, String, Number, Date, Promise,
    CASE_MEMO_KEY: 'case_memos',
    PU_APP: 'erp',
    _fbSynced: true,
    CURRENT_USER: { sid: 'P001', isAdmin: true },
    fbDb: { ref: (p) => ({ path: p }) },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    getCaseTypes: () => [{ code: 'case-investigate', name: '조사', short: '조사' }],
    genCaseNo: () => { mintedCount++; return '조사-2026-999'; },
    dbGet: () => [],
    dbUpsert: () => { mintedCount++; return true; },
    dbPatch: () => true,
    dbSet: () => true,
    PuHarassCore: C,
    PuOntologyWrite: { createGateway: () => ({ async save() { return { committed: true, snapshot: { val: () => ({}) } }; } }) },
    dispatchEvent() {},
  });
  erpGuardCtx.window = erpGuardCtx;
  vm.runInContext(erpSrc.slice(sIdx, eIdx), erpGuardCtx);
  const blockedRes = await erpGuardCtx.erpApplyHarassSyncOne('hc-defer-unit', { id: 'hc-defer-unit', revision: 1 }, {}, { 'hc-defer-unit': deferCase });
  assert.equal(blockedRes, false, 'pu-erp.html 은 erpDefer:true 사건에 대해 채번·반영을 건너뛴다');
  assert.equal(mintedCount, 0, '과거 보류 사건에 대해 2026년 신규 이알피 사건번호가 절대 채번되지 않는다');

  /* 3) PuHarassView 통합 검증: 과거 묶음 공란 편입 → 현장 상담 실시간 음성녹취(RRN 마스킹·문답·좌우 반영) → 추후 일괄 이알피 연결 */
  const els = {};
  const makeEl = (id) => ({
    id, value: '', textContent: '', innerHTML: '', checked: id === 'ivSyncRightPane' || id === 'ivPledge', disabled: false,
    scrollTop: 0, scrollHeight: 100,
    style: { display: '' },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { const v = on === undefined ? !this._s.has(c) : !!on; if (v) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(ev, fn) { (this._ev = this._ev || {})[ev] = fn; },
    querySelector: () => null,
    querySelectorAll: () => [],
    focus() {},
  });
  const getEl = (id) => (els[id] = els[id] || makeEl(id));
  const docListeners = {};

  let activeRecog = null;
  let recogStoppedCount = 0;
  let trackStoppedCount = 0;
  class MockSpeechRecognition {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      activeRecog = this;
    }
    start() { this.started = true; }
    stop() { recogStoppedCount++; this.started = false; }
  }
  class MockMediaRecorder {
    constructor(stream) {
      this.stream = stream;
      this.state = 'inactive';
      this.mimeType = 'audio/webm';
      this.ondataavailable = null;
      this.onstop = null;
    }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      if (this.ondataavailable) this.ondataavailable({ data: { size: 16 } });
      if (this.onstop) this.onstop();
    }
  }

  const dbStore = {
    'uid_roles/uLive': { sid: 'P001', name: '점검대표', status: 'active', isAdmin: true },
    'data/user_dir': [{ sid: 'P001', name: '점검대표', status: 'active' }],
    'data/cases/v': [
      { id: 'ec-exist-2023', caseNo: '조사-2023-007', typeCode: 'case-investigate', companyName: '(주)현장녹취점검', managerMain: 'P001' },
    ],
    'data/biz_case_types/v': [{ code: 'case-investigate', name: '조사', short: '조사' }],
    'harass_invest/cases': {},
    'harass_invest/erp_sync': {},
    'mailbox/old/msgs': {
      'hist_1': {
        u: 'hist_1',
        s: '[(주)다마바과거점검] 직장 내 괴롭힘 신고 조사 의뢰 및 착수공문',
        f: '인사팀',
        e: 'hr@damaba-past.example',
        t: '370-6@daum.net',
        d: Date.UTC(2023, 5, 10, 2, 0, 0),
        a: 1,
        an: ['착수공문_2023.hwp'],
        p: '조사 착수 요청',
      },
    },
  };

  function makeRef(p) {
    return {
      path: p,
      child(s) { return makeRef(p ? p + '/' + s : String(s)); },
      on() {},
      off() {},
      once: () => Promise.resolve({ val: () => (dbStore[p] !== undefined ? dbStore[p] : null) }),
    };
  }

  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URLSearchParams,
    Blob: function (parts, opts) { this.parts = parts; this.type = opts && opts.type; },
    URL: { createObjectURL: () => 'blob:live-rec', revokeObjectURL() {} },
    confirm: () => true,
    SpeechRecognition: MockSpeechRecognition,
    MediaRecorder: MockMediaRecorder,
    navigator: {
      mediaDevices: {
        async getUserMedia() {
          return { getTracks: () => [{ stop() { trackStoppedCount++; } }] };
        },
      },
    },
    PuHarassCore: C,
    PuGate: { show() {}, hide() {} },
    PuOntologyWrite: {
      createGateway: () => ({
        async save(ref, fn) {
          const prev = dbStore[ref.path] || null;
          const next = typeof fn === 'function' ? fn(prev) : fn;
          dbStore[ref.path] = next;
          if (ref.path.startsWith('harass_invest/cases/')) {
            const cid = ref.path.split('/')[2];
            dbStore['harass_invest/cases'][cid] = next;
          }
          if (ref.path.startsWith('harass_invest/erp_sync/')) {
            const cid = ref.path.split('/')[2];
            dbStore['harass_invest/erp_sync'][cid] = next;
          }
          return { committed: true, snapshot: { val: () => next } };
        },
        async remove(ref) {
          delete dbStore[ref.path];
          if (ref.path.startsWith('harass_invest/erp_sync/')) {
            delete dbStore['harass_invest/erp_sync'][ref.path.split('/')[2]];
          }
          return true;
        },
      }),
    },
    location: { search: '', hash: '', pathname: '/pu-harass.html', href: 'https://nabaho.github.io/pureunall/pu-harass.html' },
    history: { replaceState() {} },
    document: {
      activeElement: null,
      contains: () => false,
      createElement: () => ({ click() {}, remove() {}, style: {} }),
      body: { appendChild() {} },
      getElementById: (id) => getEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
      removeEventListener(ev, fn) {
        if (docListeners[ev]) docListeners[ev] = docListeners[ev].filter((x) => x !== fn);
      },
    },
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-harass-view.js'), 'utf8'), ctx);

  let authCb = null;
  const curUser = { uid: 'uLive', getIdToken: async () => 'tok-live' };
  ctx.PuHarassView.boot({
    auth: Object.assign(() => ({ currentUser: curUser, setPersistence() {}, onAuthStateChanged(fn) { authCb = fn; } }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    database: () => ({ ref: (p) => makeRef(p || '') }),
  });
  await authCb(curUser);

  /* 과거 미등록 메일 묶음(hist_1)을 [📥 편입(번호공란)]으로 등록 */
  await getEl('tabs')._ev.click({
    target: { closest: (s) => (s === 'button[data-tab]' ? { getAttribute: () => 'inbox' } : null) },
  });
  const bundleMatch = /data-act="regBundleDefer" data-id="([^"]+)"/.exec(getEl('inboxBox').innerHTML || '');
  assert.ok(bundleMatch && bundleMatch[1], '미등록 후보 탭에 [📥 편입(번호공란)] 버튼이 렌더링된다');

  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? { disabled: false, getAttribute: (n) => (n === 'data-act' ? 'regBundleDefer' : bundleMatch[1]) } : null) },
    stopPropagation() {},
  });

  const deferCaseIds = Object.keys(dbStore['harass_invest/cases']).filter((k) => k.startsWith('hi_'));
  assert.equal(deferCaseIds.length, 1, '과거 메일 묶음이 조사 사건(harass_invest/cases)으로 편입되었다');
  const importedId = deferCaseIds[0];
  const importedCase = dbStore['harass_invest/cases'][importedId];
  assert.equal(importedCase.erpDefer, true, '편입된 과거 사건에 erpDefer:true 가 기록된다');
  assert.equal(importedCase.erpCaseId, '', '편입된 과거 사건의 erpCaseId 는 공란으로 유지된다');
  assert.equal(importedCase.erpCaseNo, '', '편입된 과거 사건의 erpCaseNo 는 공란으로 유지된다');
  assert.equal(dbStore['harass_invest/erp_sync'][importedId], undefined, '공란 편입 사건은 푸른이알피 동기화 큐(erp_sync)에 올라가지 않는다');

  const importedSec = dbStore[`harass_secret/${importedId}`];
  assert.ok(importedSec && importedSec.interviews.length >= 1 && importedSec.issues.length >= 1 && importedSec.reportBody.includes('조사결과보고서'),
    '과거 묶음 편입 즉시 좌측(진술 기록)과 우측(3요건 검토표·보고서 본문 초안)이 모두 채워진다');

  /* 현장 상담 실시간 녹취 시작(liveRecIv) → 조사자 질문 & 진술인 답변(주민번호 포함) 음성 인식 → 종료 시 자동 문답·3요건·보고서 반영 */
  ['ivRole', 'ivAlias', 'ivDept', 'ivDate', 'ivMethod', 'ivPledge', 'ivRaw', 'ivSum', 'ivAmend', 'ivQaBox', 'ivCandWrap', 'ivCandBox',
    'ivLiveBar', 'ivLiveStartBtn', 'ivSpkQBtn', 'ivSpkABtn', 'ivLiveTimer', 'ivDlAudioBtn', 'ivLiveCap', 'ivLocalAudioBox',
    'ivSyncRightPane', 'ivSaveBtn'].forEach(getEl);
  getEl('ivRole').value = 'victim';
  getEl('ivAlias').value = '신고인 현장상담';
  getEl('ivDate').value = '2023-06-12';
  getEl('ivMethod').value = '대면면담';
  getEl('ivSyncRightPane').checked = true;

  await docListeners.click[0]({
    target: { closest: (sel) => (sel === '[data-act]' ? { disabled: false, getAttribute: (n) => (n === 'data-act' ? 'liveRecIv' : '') } : null) },
    stopPropagation() {},
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(activeRecog && activeRecog.started === true && activeRecog.lang === 'ko-KR', '현장 실시간 녹취 버튼 클릭 즉시 한국어(ko-KR) 연속 음성인식이 시작된다');

  /* 조사자 질문 인식 */
  activeRecog.onresult({
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: '상담에 오시게 된 구체적인 폭언 경위를 말씀해 주세요.' } }],
  });
  /* 화자 전환(답: 진술인) 후 주민등록번호가 섞인 답변 인식 */
  getEl('ivSpkABtn')._ev.click();
  activeRecog.onresult({
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: '본부장이 주간회의에서 전 직원이 보는 가운데 폭언과 업무 배제를 지시했습니다. 제 번호는 ' + synthRrn + ' 입니다.' } }],
  });
  assert.equal(C.hasUnmaskedRrn(getEl('ivRaw').value), false, '실시간 음성인식 중 주민등록번호가 들어와도 원문 창(#ivRaw)에 들어가는 즉시 마스킹된다');
  assert.ok(getEl('ivRaw').value.includes('문: ') && getEl('ivRaw').value.includes('답: '), '화자 전환 버튼에 따라 [문:]과 [답:] 구분자가 자동 부여된다');

  /* 녹취 종료 버튼 클릭 → 문답(Q&A)·요지·3요건 후보 자동 정리 및 마이크 트랙 해제 확인 */
  getEl('ivLiveStartBtn')._ev.click();
  assert.ok(recogStoppedCount >= 1 && trackStoppedCount >= 1, '녹취 종료 즉시 음성인식 및 마이크 스트림 트랙이 안전하게 정지된다');
  assert.ok(getEl('ivSum').value.includes('본부장'), '실시간 상담 녹취 종료와 동시에 진술 핵심 요지가 자동 생성된다');
  assert.ok(getEl('ivQaBox').innerHTML.includes('문답 1'), '실시간 상담 녹취 종료와 동시에 문답(Q&A) 카드가 자동 구조화된다');

  /* collectQaFromDom 이 DOM 행을 읽을 수 있도록 1행 스텁 연결 후 [💾 저장] 실행 */
  getEl('ivQaBox').querySelectorAll = () => [{
    querySelector: (sel) => (sel === '[data-qa-q]'
      ? { value: '상담에 오시게 된 구체적인 폭언 경위를 말씀해 주세요.' }
      : { value: '본부장이 주간회의에서 전 직원이 보는 가운데 폭언과 업무 배제를 지시했습니다.' }),
  }];
  getEl('ivSaveBtn')._ev.click();
  await new Promise((r) => setTimeout(r, 30));

  const secAfterLive = dbStore[`harass_secret/${importedId}`];
  assert.ok(secAfterLive.interviews.some((iv) => iv.alias === '신고인 현장상담' && iv.qaList.length === 1), '현장 상담 실시간 녹취록이 좌측 면담 진술 기록에 저장된다');
  assert.ok(secAfterLive.issues.some((iss) => iss.claimVictim && iss.claimVictim.includes('본부장')), '현장 상담 진술에서 감지된 쟁점이 우측 법정 3요건 검토표에 자동 추가된다');
  assert.ok(secAfterLive.reportBody.includes('신고인 현장상담'), '우측 조사결과보고서 본문 초안에도 방금 녹취한 상담 진술이 즉시 반영된다');
  assert.equal(dbStore['harass_invest/cases'][importedId].steps.victim.done, true, '현장 상담 저장 시 4단계(피해자 면담)가 자동 완료된다');
  assert.equal(dbStore['harass_invest/cases'][importedId].steps.review.done, true, '3요건 검토표 자동 구성과 함께 7단계(3요건 법리검토)도 자동 반영된다');
  assert.equal(dbStore['harass_invest/erp_sync'][importedId], undefined, '진술·단계를 갱신해도 이알피 공란 보류(erpDefer:true) 사건은 여전히 채번을 유예한다');

  /* 추후 [🏢 이알피 공란 정리] 모달에서 일괄 채번·연결 실행 */
  getEl('mErpBatchRunBtn');
  getEl('mErpBatchList').querySelectorAll = () => [{ checked: true, getAttribute: () => importedId }];
  getEl('mErpBatchList').querySelector = () => ({ value: '' });
  getEl('erpBatchBtn')._ev.click();
  await getEl('mErpBatchRunBtn')._ev.click();

  assert.equal(dbStore['harass_invest/cases'][importedId].erpDefer, false, '일괄 정리 실행 후 erpDefer 가 false 로 전환된다');
  assert.ok(dbStore['harass_invest/erp_sync'][importedId], '일괄 정리 실행 즉시 푸른이알피 채번·동기화 큐(erp_sync)에 등록된다');
});

test('⑭ 한국어 사업장·사건명 정밀 식별 — 영문 이메일·머리말 태그([FW]/[RE]/[대외비]) 배제, 명함함(pucards/idx)·형제메일·담당노무사 추론 및 배너 오탐 차단', async () => {
  const vm = require('node:vm');

  /* 1) [FW]/[RE]/[대외비]/[확인요망]/부서명('경영지원') 등 노이즈를 건너뛰고 실제 한국어 회사명 추출 */
  assert.equal(
    C.extractOrgName('RE: [대외비](주)가상점검솔루션_직장 내 괴롭힘 조사 의뢰의 건', [], ''),
    '(주)가상점검솔루션',
    '[대외비] 뒤에 이어지는 실제 한국어 법인명을 정확히 추출한다'
  );
  assert.equal(
    C.extractOrgName('[FW] 직장 내 괴롭힘 개선지도 관련 문의', [], '홍점검/인사(경영지원)/푸른가상정밀'),
    '푸른가상정밀',
    '[FW]와 부서명(경영지원)을 건너뛰고 슬래시 소속의 한국어 회사명을 추출한다'
  );
  assert.equal(
    C.extractOrgName('직장 내 괴롭힘 사실관계 조사 요청드립니다.', [], '총무담당', '안녕하세요, 가나점검대학교 총무팀 김점검입니다. 조사위원 위촉 문의드립니다.'),
    '가나점검대학교',
    '제목에 기관명이 없어도 본문 인사말에서 한국어 대학교·기관명을 추출한다'
  );

  /* 2) 공직자메일 하단 정책뉴스 배너 및 단독 영업비밀 비밀유지서약서 오탐 차단 */
  const bannerNoiseMail = {
    key: 'i:inbox:gov1', slug: 'inbox', uid: 'gov1', dir: 'in', date: '2026-04-01', ts: 100,
    subject: 'RE: 가나돌봄 임금체불(접수번호: 9999) 진정인 근로자성 판단 자료',
    attNames: [],
    preview: '전체적으로 1부 제출해 주세요 공무원 ‘직장 내 괴롭힘’ 피해도 공무상 재해 인정',
    attCount: 0,
  };
  assert.equal(C.inspectMailForHarass(bannerNoiseMail, true), null, '공직자통합메일 하단 정책뉴스 배너 때문에 일반 임금체불 메일이 괴롭힘 사건으로 오탐되지 않는다');

  const pureNdaMail = {
    key: 'i:inbox:nda1', slug: 'inbox', uid: 'nda1', dir: 'in', date: '2026-04-02', ts: 200,
    subject: '기술보호컨설팅 퇴사자 경업금지 및 비밀유지서약서 검토 요청',
    attNames: ['[서식]비밀유지서약서.hwp'],
    preview: '영업비밀 보호 서식 검토 부탁드립니다.',
    attCount: 1,
  };
  assert.equal(C.inspectMailForHarass(pureNdaMail, true), null, '괴롭힘·고충 맥락이 없는 단독 기술보호 비밀유지서약서 메일은 조사 사건으로 오탐되지 않는다');

  const harassPledgeMail = {
    key: 'i:inbox:hp1', slug: 'inbox', uid: 'hp1', dir: 'in', date: '2026-04-03', ts: 300,
    subject: '직장 내 괴롭힘 조사 참여자 비밀유지서약서 제출',
    attNames: ['비밀유지서약서.pdf'],
    preview: '조사 면담 전 서약서 송부합니다.',
    attCount: 1,
  };
  assert.equal(C.inspectMailForHarass(harassPledgeMail, true).docRole, 'pledge_protect', '실제 괴롭힘 조사 맥락의 비밀유지서약서 메일은 2단계 공문으로 정상 수집된다');

  /* 3) 기업정보함(pucards/idx) + 형제 메일 + 담당 노무사(staffList) 추론으로 영문 없는 한국어 '<회사이름> <사건> 조사' 묶음 생성 */
  const companies = [
    { id: 'co-card-link', name: '(주)명함연결점검', bizNo: '123-81-77777', email: '' },
  ];
  const cardIdx = {
    c1: { k: 'card', c: '(주)명함연결점검', bz: '123-81-77777', e: 'manager@cardlink-sample.example', n: '이담당' },
    c2: { k: 'card', c: '다라점검복지재단', bz: '123-82-33333', e: 'welfare@darawf-sample.example', n: '박부장' },
  };
  const coDir = C.buildCompanyDirectory(companies, cardIdx);
  const staffList = [
    { sid: 'P-001', name: '김대표' },
    { sid: 'P-005', name: '박조사' },
  ];

  const flatRows = C.flattenMailbox(
    { inbox: { kind: 'inbox', name: '받은편지함' } },
    {
      inbox: {
        'm_card1': {
          u: 'm_card1',
          s: 'RE: 사내 직장 내 괴롭힘 신고 건 외부조사 문의',
          f: 'manager@cardlink-sample.example',
          e: 'manager@cardlink-sample.example',
          t: '370-6@daum.net',
          d: Date.UTC(2026, 2, 10),
          a: 0,
          an: [],
          p: '안녕하세요. 푸른노무법인 박조사 노무사님께 조사 일정 문의드립니다.',
        },
        'm_card2_a': {
          u: 'm_card2_a',
          s: '고충심의위원회 개최 및 직장 내 괴롭힘 조사 요청',
          f: 'welfare@darawf-sample.example',
          e: 'welfare@darawf-sample.example',
          t: '370-6@daum.net',
          d: Date.UTC(2025, 1, 10),
          a: 0,
          an: [],
          p: '고충심의 관련 문의드립니다.',
        },
        'm_card2_b': {
          u: 'm_card2_b',
          s: '직장 내 괴롭힘 재진정 사건 조사 의뢰',
          f: 'welfare@darawf-sample.example',
          e: 'welfare@darawf-sample.example',
          t: '370-6@daum.net',
          d: Date.UTC(2026, 7, 15),
          a: 0,
          an: [],
          p: '재진정 조사 의뢰 건입니다.',
        },
        'm_sib_general': {
          u: 'm_sib_general',
          s: '[바사점검전자(주)] 취업규칙 개정 검토 요청',
          f: 'hr@basa-elec.example',
          e: 'hr@basa-elec.example',
          t: '370-6@daum.net',
          d: Date.UTC(2024, 3, 1),
          a: 0,
          an: [],
          p: '취업규칙 문의',
        },
        'm_sib_harass': {
          u: 'm_sib_harass',
          s: 'RE: 직장 내 성희롱 신고 건 인사위원회 징계심의 문의',
          f: 'hr@basa-elec.example',
          e: 'hr@basa-elec.example',
          t: '370-6@daum.net',
          d: Date.UTC(2024, 3, 12),
          a: 0,
          an: [],
          p: '징계심의 관련 문의드립니다.',
        },
      },
    }
  );

  const bundles = C.discoverUnregisteredBundles(flatRows, [], coDir, {}, { staffList });
  assert.equal(bundles.length, 4, '명함 연결 1건 + 복지재단 연도별 2건 + 형제메일 전자회사 1건 총 4묶음이 발굴된다');
  bundles.forEach((b) => {
    assert.equal(/@/.test(b.companyName), false, '어떤 묶음의 사업장명에도 영문 이메일(@)이 노출되지 않는다: ' + b.companyName);
    assert.equal(/@/.test(b.suggestedTitle), false, '어떤 묶음의 사건명에도 영문 이메일(@)이 노출되지 않는다: ' + b.suggestedTitle);
    assert.equal(/^\[20\d{2}년/.test(b.suggestedTitle), false, '기계식 [2026년 #2] 대괄호 접두어를 쓰지 않는다: ' + b.suggestedTitle);
    assert.ok(b.suggestedTitle.includes(b.companyName) && b.suggestedTitle.includes('조사'), '모든 사건명이 "<회사이름> <사건내용> 조사" 형식을 갖춘다: ' + b.suggestedTitle);
  });

  const cardLinkedBundle = bundles.find((b) => b.companyId === 'co-card-link');
  assert.ok(cardLinkedBundle, '명함 사업자번호·상호를 통해 업체원장(co-card-link)까지 자동 연결된다');
  assert.equal(cardLinkedBundle.companyName, '(주)명함연결점검');
  assert.equal(cardLinkedBundle.managerMain, 'P-005', '메일 본문의 노무사 성명으로부터 담당 노무사 사번(P-005)이 자동 추론된다');

  const sibBundle = bundles.find((b) => b.companyName === '바사점검전자(주)');
  assert.ok(sibBundle, '조사 메일 자체에 회사명이 없어도 같은 담당자의 형제 메일에서 한국어 회사명을 찾아낸다');
  assert.ok(sibBundle.suggestedTitle.includes('징계심의'), '메일 내용(징계심의)이 한국어 사건명에 반영된다');

  /* 4) PuHarassView 화면 방어: 과거에 영문 이메일로 저장된 사건이 있어도 pucards/idx 를 통해 한국어 사업장·사건명으로 렌더링한다 */
  const els = {};
  const makeEl = (id) => ({
    id, value: '', textContent: '', innerHTML: '', checked: false, disabled: false, style: { display: '' },
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], focus() {},
  });
  const getEl = (id) => (els[id] = els[id] || makeEl(id));
  const mockDb = {
    'uid_roles/uView': { sid: 'P001', name: '점검노무', status: 'active', isAdmin: true },
    'data/user_dir': [{ sid: 'P001', name: '점검노무', status: 'active' }],
    'pucards/idx': { cardA: { k: 'card', c: '아자점검대학교', e: 'admin@ajauniv-sample.example', n: '최총무' } },
    'harass_invest/cases': {
      'hc-legacy-eng': {
        id: 'hc-legacy-eng',
        companyName: 'admin@ajauniv-sample.example',
        title: 'admin@ajauniv-sample.example 직장 내 괴롭힘 조사',
        email: 'admin@ajauniv-sample.example',
        category: 'harass',
        managerMain: 'P001',
        receiveDate: '2026-03-01',
        erpDefer: true,
        mailLinks: [],
      },
    },
  };
  function makeRef(p) {
    return {
      path: p, child(s) { return makeRef(p ? p + '/' + s : String(s)); }, on() {}, off() {},
      once: () => Promise.resolve({ val: () => (mockDb[p] !== undefined ? mockDb[p] : null) }),
    };
  }
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Promise, URLSearchParams,
    PuHarassCore: C, PuGate: { show() {}, hide() {} },
    PuOntologyWrite: { createGateway: () => ({ async save(r, fn) { const v = typeof fn === 'function' ? fn(null) : fn; return { committed: true, snapshot: { val: () => v } }; } }) },
    location: { search: '', hash: '', pathname: '/pu-harass.html' }, history: { replaceState() {} },
    document: { activeElement: null, contains: () => false, getElementById: (id) => getEl(id), querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-harass-view.js'), 'utf8'), ctx);
  let authCb = null;
  const curUser = { uid: 'uView', getIdToken: async () => 'tok' };
  ctx.PuHarassView.boot({
    auth: Object.assign(() => ({ currentUser: curUser, setPersistence() {}, onAuthStateChanged(fn) { authCb = fn; } }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    database: () => ({ ref: (p) => makeRef(p || '') }),
  });
  await authCb(curUser);
  assert.ok(getEl('casesBox').innerHTML.includes('아자점검대학교'), '영문 이메일로 남아 있던 레거시 사건도 화면에서 명함함 한국어 기관명으로 표시된다');
  assert.equal(getEl('casesBox').innerHTML.includes('admin@ajauniv-sample.example'), false, '사건 현황 표에 영문 이메일 주소가 사업장명으로 노출되지 않는다');
  assert.equal(C.extractOrgName('[대건] 직장 내 괴롭힘 조사 요청', [], '', ''), '대건', '건으로 끝나는 2글자 상호 말머리도 잘리지 않고 보존된다');
});
