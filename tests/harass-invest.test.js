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
    { id: 'co-a', name: '(주)가나점검테크', bizNo: '000-00-20001', email: 'hr@gana-check.example' },
    { id: 'co-b', name: '(주)타사점검산업', bizNo: '000-00-20099', email: 'info@other-check.example' },
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
  const companies = [{ id: 'co-1', name: '(주)가나점검테크', bizNo: '000-00-20001', email: 'hr@gana-check.example' }];
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
