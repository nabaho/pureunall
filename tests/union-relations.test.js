const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const UnionCore = require(path.join(ROOT, 'js', 'pu-union-core.js'));
const Backfill = require(path.join(ROOT, 'scripts', 'backfill-union-history.js'));

function loadUnionHwpxInVm() {
  const zipSrc = fs.readFileSync(path.join(ROOT, 'hangul', 'js', 'zip.js'), 'utf8').replace(/\r\n/g, '\n');
  const hwpxSrc = fs.readFileSync(path.join(ROOT, 'hangul', 'js', 'hwpx.js'), 'utf8').replace(/\r\n/g, '\n');
  const modSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-union-hwpx.js'), 'utf8').replace(/\r\n/g, '\n');
  const ctx = {
    console,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    DataView,
    ArrayBuffer,
    Blob,
    URL,
    Buffer,
    Date,
    Math,
    PuUnionCore: UnionCore
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(zipSrc, ctx);
  vm.runInContext(hwpxSrc, ctx);
  vm.runInContext(modSrc, ctx);
  return ctx.PuUnionHwpx;
}

/* ── 1. 카탈로그·기본 상수 ────────────────────────────────────────────── */
test('노사관계 카탈로그: 5개 트랙 · 8단계 절차 · 4대 서류군 · 14개 서류역할이 완비되어 있다', () => {
  assert.equal(Object.keys(UnionCore.TRACKS).length, 5);
  assert.equal(UnionCore.TRACK_ORDER.length, 5);
  assert.equal(UnionCore.STEPS.length, 8);
  assert.deepEqual(Object.keys(UnionCore.DOC_GROUPS), ['progress', 'review', 'signed', 'evidence']);
  assert.equal(Object.keys(UnionCore.DOC_ROLES).length, 14);
  for (const roleKey of Object.keys(UnionCore.DOC_ROLES)) {
    const r = UnionCore.DOC_ROLES[roleKey];
    assert.ok(UnionCore.DOC_GROUPS[r.group], `${roleKey} 서류군 유효성`);
  }
});

/* ── 2. 법정기일 계산기 (창구단일화 · 노동쟁의조정) ───────────────────── */
test('법정기일 계산기: 창구단일화 7/5/14일과 쟁의조정 일반 10일·공익 15일을 정확히 계산한다', () => {
  const ch = UnionCore.calcChannelTimeline('2026-04-01', '2026-04-10');
  assert.equal(ch.ok, true);
  assert.equal(ch.milestones.length, 8);
  const noticeEnd = ch.milestones.find((m) => m.key === 'notice_end');
  const confirmEnd = ch.milestones.find((m) => m.key === 'confirm_end');
  const autonomyEnd = ch.milestones.find((m) => m.key === 'autonomy_end');
  assert.equal(noticeEnd.daysOffset, 7);   // 검사고정-허용
  assert.equal(noticeEnd.date, '2026-04-08');
  assert.equal(confirmEnd.daysOffset, 12); // 검사고정-허용
  assert.equal(confirmEnd.date, '2026-04-13');
  assert.equal(confirmEnd.dDayLabel, 'D-3');
  assert.equal(confirmEnd.state, 'urgent');
  assert.equal(autonomyEnd.date, '2026-04-27');

  const dNorm = UnionCore.calcDisputeTimeline('2026-05-01', false, '2026-05-05');
  assert.equal(dNorm.ok, true);
  assert.equal(dNorm.periodDays, 10); // 검사고정-허용
  assert.equal(dNorm.milestones.find((m) => m.key === 'normal').date, '2026-05-11');

  const dPub = UnionCore.calcDisputeTimeline('2026-05-01', true, '2026-05-05');
  assert.equal(dPub.ok, true);
  assert.equal(dPub.periodDays, 15); // 검사고정-허용
  assert.equal(dPub.milestones.find((m) => m.key === 'normal').date, '2026-05-16');
});

/* ── 3. 임금협상 원가·인상률 시뮬레이터 ───────────────────────────────── */
test('임금협상 시뮬레이터: 인원·기본급총액·간접비율 기반 요구안/사측안/합의안 격차를 계산한다', () => {
  const sim = UnionCore.simulateWageImpact({
    headcount: 100,
    monthlyBaseTotal: 300000000,
    demandRate: 5,
    offerRate: 2,
    agreedRate: 3,
    indirectRatio: 20
  });
  assert.equal(sim.demand.monthlyBaseDelta, 15000000);
  assert.equal(sim.demand.annualBaseDelta, 180000000);
  assert.equal(sim.demand.annualTotalWithIndirect, 216000000);
  assert.equal(sim.offer.annualTotalWithIndirect, 86400000);
  assert.equal(sim.annualGap, 129600000);
  assert.equal(sim.rateGapPct, 3);
});

/* ── 4. PII · 로컬경로 · CSV 수식 인젝션 방어 ──────────────────────────── */
test('PII·로컬경로·CSV 방어: 개인식별정보·이메일·경로를 가리고 수식 문자를 이스케이프한다', () => {
  const raw = '담당 홍가상 010-0000-1234 hr@alpha-sample.example C:\\local\\secret\\파일.hwpx';
  const masked = UnionCore.maskPiiStrict(raw, ['홍가상'], { keepBizNo: true });
  assert.equal(masked.includes('010-0000-1234'), false);
  assert.equal(masked.includes('hr@alpha-sample.example'), false);
  assert.equal(masked.includes('C:\\local\\secret'), false);
  assert.equal(masked.includes('홍가상'), false);
  assert.equal(UnionCore.hasResidualPii(masked), false);
  assert.equal(UnionCore.hasResidualPii('문의 sample-user@corp.example'), true);
  assert.equal(UnionCore.hasResidualPii('C:\\temp\\negotiation.xlsx'), true);

  assert.equal(UnionCore.csvSafeCell('=CMD|calc'), "'=CMD|calc");
  assert.equal(UnionCore.csvSafeCell('+123'), "'+123");
  assert.equal(UnionCore.csvSafeCell('@SUM(A1)'), "'@SUM(A1)");
});

/* ── 5. 이메일 전수 분류기 & 일반 컨설팅 인터뷰 양식 오탐 차단 ────────────── */
test('이메일 분류기: 노사교섭 메일을 연도·트랙·4대 서류군별로 분류하고 컨설팅 인터뷰 오탐을 배제한다', () => {
  const companies = [
    { id: 'uco-a', name: '㈜가상제조테크' },
    { id: 'uco-b', name: '㈜가상운수물류' }
  ];
  const folders = {
    inbox: { kind: 'inbox', name: '받은편지함' },
    unionBox: { kind: 'custom', name: '단체교섭 보관함' }
  };
  const msgsBySlug = {
    inbox: {
      '101': {
        u: 101,
        s: '[㈜가상제조테크] 2026년 3차 본교섭 신구대비표 법률검토 요청',
        f: '인사팀',
        e: 'hr@virt-tech.example',
        t: 'p001@pureun-sample.example',
        d: Date.UTC(2026, 4, 15),
        a: 2,
        an: ['2026_단협_신구대비표_검토의견.docx', '3차교섭_회의록.hwpx'],
        p: '단체협약 개정 요구안 법률 검토 의견 부탁드립니다.'
      },
      '102': {
        u: 102,
        s: '[일터혁신 컨설팅] ㈜가상운수물류 기초진단 인터뷰 양식 송부',
        f: '운영팀',
        e: 'pm@virt-logis.example',
        t: 'p001@pureun-sample.example',
        d: Date.UTC(2026, 4, 16),
        a: 1,
        an: ['통합진단 인터뷰 양식_노동조합 및 근로자대표.hwp'],
        p: '일터혁신 상생컨설팅 사전진단 인터뷰 서식입니다.'
      },
      '103': {
        u: 103,
        s: '[㈜가상운수물류] 2025년 교섭창구단일화 교섭요구사실 공고문',
        f: '노무팀',
        e: 'labor@virt-logis.example',
        t: 'p001@pureun-sample.example',
        d: Date.UTC(2025, 2, 10),
        a: 1,
        an: ['교섭요구사실공고문.hwpx'],
        p: '복수노조 교섭요구 접수에 따른 창구단일화 공고 진행합니다.'
      }
    }
  };
  const oldMsgs = {
    v: {
      '201': {
        u: 201,
        s: '(㈜가상제조테크) 2024년 임금협상 합의서 날인본 송부',
        f: '총무팀',
        e: 'ga@virt-tech.example',
        t: 'p001@pureun-sample.example',
        d: Date.UTC(2024, 6, 20),
        a: 1,
        an: ['2024_임금협약_합의서_체결본.pdf'],
        p: '최종 임금협정 조인식 체결 합의서입니다.'
      }
    }
  };

  const flat = UnionCore.flattenMailbox(folders, msgsBySlug, oldMsgs);
  const res = UnionCore.scanAndGroupUnionMails(flat, { companies, existingCases: {}, dismissed: {} });

  assert.equal(res.unionMails.length, 3, '컨설팅 인터뷰 양식 메일(102)은 제외되고 3건만 수집되어야 함');
  const m101 = res.unionMails.find((m) => m.uid === '101');
  const m103 = res.unionMails.find((m) => m.uid === '103');
  const m201 = res.unionMails.find((m) => m.uid === '201');
  assert.ok(m101 && m103 && m201);
  assert.equal(m101.year, '2026');
  assert.equal(m101.roundNo, 3);
  assert.equal(m101.docGroup, 'review');
  assert.equal(m103.track, 'single_ch');
  assert.equal(m103.year, '2025');
  assert.equal(m201.year, '2024');
  assert.equal(m201.docGroup, 'signed');
  assert.equal(res.bundles.length, 3, '회사×연도 3개 사건 묶음 생성');

  /* 수기 체크가 있는 단계는 자동 재구성 시에도 보존된다 */
  const steps = UnionCore.reconstructStepsFromMails(
    { strategy: { done: false, manual: true, date: '2026-05-12', note: '보류 수기표시' } },
    [m101],
    []
  );
  assert.equal(steps.strategy.manual, true);
  assert.equal(steps.strategy.done, false);
  assert.equal(steps.negotiate.done, true);
});

/* ── 6. HWPX 생성 · 텍스트 추출 · CSV · 브리지 ────────────────────────── */
test('문서 엔진(PuUnionHwpx): 4종 HWPX 생성(ZIP 시그니처), 텍스트 추출, 브리지·CSV가 정상 동작한다', async () => {
  const H = loadUnionHwpxInVm();
  const sampleCase = {
    id: 'ur_test_1',
    companyName: '㈜테스트가상산업',
    unionName: '테스트가상노동조합',
    year: '2026',
    track: 'bargain',
    demandDate: '2026-04-01',
    agreedDate: '',
    rounds: [{ roundNo: 1, date: '2026-04-15', kind: '상견례', agenda: '기본원칙', result: '완료' }],
    steps: UnionCore.buildCaseStepsDefault()
  };
  const sampleClauses = [
    { articleNo: '제10조', category: 'wage', topic: '기본급', currentText: '동결', unionDemand: '5% 인상', companyOffer: '2% 인상', opinion: '검토중', state: 'open' }
  ];
  const sampleDocs = [
    { group: 'progress', role: 'demand_notice', title: '요구공문.hwpx', source: '메일', reviewState: 'done', docDate: '2026-04-01' }
  ];

  for (const kind of ['channel_demand', 'channel_confirm', 'review_report', 'yearly_summary']) {
    const bytes = H.generateHwpxBytes(kind, sampleCase, { clauses: sampleClauses, docs: sampleDocs, mails: [] });
    assert.ok(bytes instanceof Uint8Array && bytes.length > 500, `${kind} HWPX 바이트가 생성되어야 함`);
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
    assert.equal(bytes[2], 0x03);
    assert.equal(bytes[3], 0x04);
  }

  const hwpxBytes = H.generateHwpxBytes('channel_demand', sampleCase, {});
  const extracted = await H.extractDocumentText(hwpxBytes, '공고문.hwpx');
  assert.equal(extracted.ok, true);
  assert.ok(extracted.text.includes('테스트가상산업'));

  const payload = H.buildHangulBridgePayload('review_report', sampleCase, { clauses: sampleClauses });
  assert.equal(payload.source, 'unionrel');
  assert.equal(payload.format, 'hwpx');
  assert.ok(payload.b64.length > 100);

  const csv = H.buildClausesCsv(sampleCase, [{ ...sampleClauses[0], topic: '=SUM(A1)' }]);
  assert.ok(csv.includes("'=SUM(A1)"));
});

/* ── 7. 보안규칙 JSON · AI 문서 프록시 등록 검증 ──────────────────────── */
test('보안규칙·문서프록시: union_rel 규칙이 양쪽 JSON에 반영되고 doc-read가 unionrel PII를 차단한다', () => {
  const applyRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
  const pasteRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'rules-paste.json'), 'utf8')).rules;
  assert.deepEqual(applyRules.union_rel, pasteRules.union_rel);
  assert.ok(applyRules.union_rel);
  assert.ok(applyRules.union_rel.cases.$id['.write'].includes('newData.exists()'));
  assert.ok(applyRules.union_rel.cases.$id['.validate'].includes("'Case'"));
  assert.ok(applyRules.union_rel.mails.$cid.$id['.validate'].includes("'Message'"));
  assert.ok(applyRules.union_rel.snapshots.$cid.$id['.write'].includes('!data.exists()'));
  assert.equal(applyRules.union_rel.$other['.validate'], false);

  const docReadSrc = fs.readFileSync(path.join(ROOT, 'functions', 'doc-read.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(docReadSrc.includes('"unionrel"'));
});

/* ── 8. 백필 순수 함수 및 누출 차단 검사 ────────────────────────────────── */
test('백필 스크립트: collectUnionBackfill과 assertCleanPayload가 메일을 병합하고 PII/경로 누출을 차단한다', () => {
  const built = Backfill.collectUnionBackfill({
    companies: [{ id: 'uco-z', name: '㈜가상솔루션' }],
    erpCases: [{ id: 'ec-1', companyId: 'uco-z', companyName: '㈜가상솔루션', year: '2026', title: '단체교섭 자문' }],
    mailFolders: { inbox: { kind: 'inbox', name: '받은편지함' } },
    mailMsgs: {
      inbox: {
        '501': {
          u: 501,
          s: '[㈜가상솔루션] 2026년 2차 임금교섭 자료 송부',
          f: '인사팀',
          e: 'hr@virt-sol.example',
          t: 'p001@pureun-sample.example',
          d: Date.UTC(2026, 3, 12),
          a: 1,
          an: ['2차교섭_노조요구안_검토.hwpx'],
          p: '요구안 송부합니다.'
        }
      }
    },
    oldMailMsgs: { v: {} },
    existingUnionCases: {},
    dismissed: {},
    skipLocalDirs: true
  });

  assert.equal(built.cases.length, 1);
  assert.equal(built.cases[0].companyId, 'uco-z');
  assert.equal(built.cases[0].erpCaseId, 'ec-1');
  assert.ok(UnionCore.PERFORM_MODES[built.cases[0].performMode], '백필 수행유형이 정식 카탈로그 코드에 속해야 함');
  assert.equal(Backfill.assertCleanPayload(built.cases[0]), '');

  const dir = UnionCore.buildCompanyDirectory([{ id: 'uco-z', name: '㈜가상솔루션' }]);
  const matchedFolderCo = Backfill.normalizeFolderCorpName('2026_가상솔루션_단체교섭', dir);
  assert.equal(matchedFolderCo.companyId, 'uco-z');

  const multiPathScrubbed = Backfill.scrubText('경로1 C:\\temp\\a.hwp 및 경로2 Desktop/b.hwp 사건 2026-123456');
  assert.equal(UnionCore.hasResidualPii(multiPathScrubbed), false);
  assert.ok(multiPathScrubbed.includes('2026-123456'));

  assert.notEqual(Backfill.assertCleanPayload({ id: 'x', title: 'C:\\Users\\user\\secret.hwp' }), '');
  assert.notEqual(Backfill.assertCleanPayload({ id: 'x', title: '문의 person@sample.example' }), '');
});

/* ── 9. 화면 컨트롤러 저장 정합성 · 삭제 필터 · 문서 추출 API 검증 ─── */
test('화면 안전장치: PuKordocText.read 연동, lost-update 방지(expectedRevision), 삭제 사건 서류 제외 및 첨부명 가림을 지킨다', async () => {
  const hwpxCtxSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-union-hwpx.js'), 'utf8').replace(/\r\n/g, '\n');
  const kordocCalled = [];
  const ctx = {
    console, TextEncoder, TextDecoder, Uint8Array, Blob, URL, Date, Math,
    PuUnionCore: UnionCore,
    PuKordocText: {
      read: async (u8) => {
        kordocCalled.push(u8.length);
        return { text: '홍가상 010-0000-9999 hr@sample-corp.example 단협 검토안' };
      }
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(hwpxCtxSrc, ctx);
  const kRes = await ctx.PuUnionHwpx.extractDocumentText(new Uint8Array([1, 2, 3, 4]), 'legacy.hwp');
  assert.equal(kordocCalled[0], 4);
  assert.equal(kRes.ok, true);
  assert.equal(kRes.text.includes('010-0000-9999'), false);
  assert.equal(kRes.text.includes('hr@sample-corp.example'), false);

  const viewSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-union-view.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(viewSrc.includes('gwOpts.expectedRevision = Number(previous.revision)'), 'saveEntity 가 expectedRevision 을 검증해야 함');
  assert.ok(viewSrc.includes('if (!activeCaseMap[cid]) return;'), '휴지통 사건의 서류를 ALL_DOCS 에서 제외해야 함');
  assert.ok(viewSrc.includes('arr(ml.attNames).map(scrubField)'), '메일 연결 저장 시 첨부파일명 비식별 가림 적용');
  assert.ok(viewSrc.includes("if (!askConfirm('미등록 후보 묶음"), '일괄 편입 시 건수 확인창 필수');
});
