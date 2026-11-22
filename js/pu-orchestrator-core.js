/* ══════════════════════════════════════════════════════════════════════════
 * 🔄 푸른통합시스템 — 29개 앱 통합 업무 오케스트레이션 순수 엔진
 *    (js/pu-orchestrator-core.js — 화면·Firebase·네트워크 무의존 순수 모듈)
 *
 * 맡는 일:
 *   1. 포털 4대 줄(의뢰인 업무·자료함·영업관리·내부관리 + 머리줄 캘린더) 전체 앱의
 *      5대 업무 생애주기(유입·계약 ➔ 사건·조사·규정 ➔ 컨설팅·기금·지원금 ➔ 주간업무·급여 ➔ 청구·입금·정산) 연결 정의
 *   2. 온톨로지 불변 규칙(sourceMutation:'never', 영구 ID·고유번호 몸통·사업자번호 매칭, 사번 비노출, 민감 본문 비열람)에 따라
 *      여러 앱에 흩어진 대기 요청·미연결 건·기한 임박·다음 단계 바통(Actionable Baton)을 읽기 전용으로 조립
 *   3. 사업장별 360° 생애주기 진행판(Company 360° Lifecycle) 및 연결 무결성 진단(Diagnostics) 산출
 *   4. 앱 간 이동 시 안전하게 맥락을 건네는 세션 바통(Baton Pack/Unpack — 개인식별정보 자동 마스킹·30분 만료·상대경로 강제)
 * ══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuOrchestratorCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var BATON_STORAGE_KEY = 'pu_orch_baton_v1';
  var BATON_TTL_MS = 30 * 60 * 1000;
  var DAY_MS = 86400000;

  /* ── Ⅰ. 5대 업무 생애주기 단계 ── */
  var STAGES = [
    {
      id: 'intake',
      no: 1,
      short: '① 유입·계약',
      title: '① 유입 · 견적 · 계약 · 원장 개시',
      desc: '메일·사진첩·명함·견적·전자서명에서 들어온 의뢰를 푸른이알피 업체·계약 원장으로 연결합니다.',
      apps: ['mail', 'photos', 'cards', 'docs', 'erp']
    },
    {
      id: 'case_rules',
      no: 2,
      short: '② 사건·조사·규정',
      title: '② 노동사건 · 괴롭힘조사 · 취업규칙 · 법리 서면',
      desc: '노동사건 불변기한, 직장 내 괴롭힘 8단계 조사↔이알피 동기화, 취업규칙 개정·신고, P박스·한글 편집을 잇습니다.',
      apps: ['erp', 'harass', 'rules', 'pbox', 'aliounion', 'hangul']
    },
    {
      id: 'consulting_fund',
      no: 3,
      short: '③ 컨설팅·기금·지원금',
      title: '③ 공고 발굴 · 컨설팅 일정/보고서 · 기금 · 지원금',
      desc: '입찰공고 탐색부터 컨설팅 수임·현장회차·보고서(일터상생·산업일자리)·복지기금·고용지원금 대행까지 이어 줍니다.',
      apps: ['govbid', 'consult', 'govreport', 'ilteo', 'jobtrans', 'fund', 'govaid']
    },
    {
      id: 'work_payroll',
      no: 4,
      short: '④ 주간업무·일정·급여',
      title: '④ 주간 할 일 · 캘린더 일정 · 급여아웃소싱 실행',
      desc: '사업장별 주간 업무관리, 법인 공용·근태 캘린더, 급여자료 도착·입퇴사 연락을 실무 실행줄로 묶습니다.',
      apps: ['work', 'cal', 'payroll', 'paydata', 'orch']
    },
    {
      id: 'finance_settle',
      no: 5,
      short: '⑤ 입금·정산·환류',
      title: '⑤ 입금 매칭 · 세금계산서 · 컨설팅정산 · 실적/영업 환류',
      desc: '계좌 입금·청구 매칭, 개인입금 컨설팅 차액 정산, 수행 경력 축적 및 뉴스레터·홈페이지·회생광고로 환류합니다.',
      apps: ['fin', 'settle', 'hr', 'deungi', 'career', 'news', 'home', 'rehabad', 'signboard']
    }
  ];

  /* ── Ⅱ. 전체 앱 입출력 역할 및 기본 딥링크 카탈로그 ── */
  var APP_META = {
    erp:       { key: 'erp',       name: '푸른이알피',         icon: '🏢', row: 'client', stage: 'intake',          url: 'pu-erp.html',              role: '전사 업체·계약·사건·컨설팅 마스터 원장' },
    cal:       { key: 'cal',       name: '푸른 캘린더',        icon: '📅', row: 'client', stage: 'work_payroll',    url: 'pu-cal.html',              role: '공용 방문·재판 일정 및 직원 근태 공유' },
    consult:   { key: 'consult',   name: '정부사업일정',       icon: '📅', row: 'client', stage: 'consulting_fund', url: 'gov-consulting.html',      role: '수임 컨설팅 방문회차·사진·보고서 초안 작성' },
    govreport: { key: 'govreport', name: '컨설팅보고서',       icon: '📑', row: 'client', stage: 'consulting_fund', url: 'gov-report.html',          role: '전사 보고서 진도 및 서명본·별첨·제출 관리' },
    govaid:    { key: 'govaid',    name: '기업정부지원금',     icon: '🎯', row: 'client', stage: 'consulting_fund', url: 'pu-govaid.html',           role: '지원사업 요건 매칭·검토 → 업무관리 할 일 생성' },
    harass:    { key: 'harass',    name: '괴롭힘·성희롱 조사', icon: '🛡️', row: 'client', stage: 'case_rules',      url: 'pu-harass.html',           role: '조사 공문 수집·8단계 조사·이알피 사건 동기화' },
    ilteo:     { key: 'ilteo',     name: '일터상생혁신',       icon: '🏭', row: 'client', stage: 'consulting_fund', url: 'ilteo.html',               role: '노사발전재단 상생컨설팅 비식별 진단·보고서·PPTX' },
    jobtrans:  { key: 'jobtrans',  name: '산업일자리전환',     icon: '⚡', row: 'client', stage: 'consulting_fund', url: 'jobtrans.html',            role: '능률협회·충남경제진흥원 맞춤 보고서·완료계 HWPX' },
    fund:      { key: 'fund',      name: '기금관리',           icon: '🪙', row: 'client', stage: 'consulting_fund', url: 'fund.html',                role: '사내·공동근로복지기금 설립·결산·출연회사 연동' },
    rules:     { key: 'rules',     name: '기업규정집',         icon: '📜', row: 'client', stage: 'case_rules',      url: 'rules-v2.html',            role: '취업규칙 메일 자동수집·회차별 개정·신고 관리' },
    hangul:    { key: 'hangul',    name: '한글 편집기',        icon: '📝', row: 'client', stage: 'case_rules',      url: 'hangul.html',              role: '서버 무전송 브라우저 로컬 HWP/HWPX 열람·편집' },
    payroll:   { key: 'payroll',   name: '급여아웃소싱',       icon: '💰', row: 'client', stage: 'work_payroll',    url: 'payroll-os.html',          role: '고객사 임금대장·명세서·연차 정산 대행' },
    orch:      { key: 'orch',      name: '오케스트레이션',     icon: '🔄', row: 'store',  stage: 'work_payroll',    url: 'pu-orchestrator.html',     role: '전 프로그램 업무 바통 감지·360° 생애주기 지휘' },
    work:      { key: 'work',      name: '업무관리',           icon: '📋', row: 'store',  stage: 'work_payroll',    url: 'work.html',                role: '사업장별 주간 할 일·오간 메일·방문 통합 실행' },
    mail:      { key: 'mail',      name: '푸른 메일',          icon: '📧', row: 'store',  stage: 'intake',          url: 'pu-cards.html?view=mail',  role: '다음메일 동기화·사업장 스레드·서류 후보 공급' },
    cards:     { key: 'cards',     name: '기업정보함',         icon: '📇', row: 'store',  stage: 'intake',          url: 'pu-cards.html',            role: '사업자등록증·명함·기업 연도별 통합 이력 허브' },
    photos:    { key: 'photos',    name: '사진첩',             icon: '🖼️', row: 'store',  stage: 'intake',          url: 'pu-photos.html',           role: '서류·명함 촬영·주민번호 가림 판독·계약요청 발신' },
    docs:      { key: 'docs',      name: '계약서등관리',       icon: '📤', row: 'store',  stage: 'intake',          url: 'docs-esign.html',          role: '견적·계약 양식 작성 및 휴대폰 전자서명 수발신' },
    aliounion: { key: 'aliounion', name: '공공임단협',         icon: '🤝', row: 'store',  stage: 'case_rules',      url: 'pu-alio-union.html',       role: '공공기관 노조·임금·복리후생·단체협약 비교분석' },
    pbox:      { key: 'pbox',      name: 'P박스',              icon: '📚', row: 'store',  stage: 'case_rules',      url: 'pu-pbox.html',             role: '전 법령·판례·재결례·행정해석 검색 및 AI 서면' },
    paydata:   { key: 'paydata',   name: '급여데이터함',       icon: '💼', row: 'store',  stage: 'work_payroll',    url: 'pu-paydata.html',          role: '사업장별 급여 기초자료 도착·입퇴사 연락 수집', off: true },
    news:      { key: 'news',      name: '뉴스레터',           icon: '📰', row: 'sales',  stage: 'finance_settle',  url: 'pu-news.html',             role: '이알피 실시간 거래처 명단 기반 주간 뉴스레터 발송' },
    home:      { key: 'home',      name: '홈페이지',           icon: '🌐', row: 'sales',  stage: 'finance_settle',  url: 'pu-home.html',             role: '공식 홈페이지 구성원·업무 게시 및 주간 브리핑 공급' },
    rehabad:   { key: 'rehabad',   name: '회생광고',           icon: '⚖️', row: 'sales',  stage: 'finance_settle',  url: 'rehab-ad.html',            role: '법원 법인회생 공고 수집·기존 거래처 대조·안내 선별' },
    signboard: { key: 'signboard', name: '전광판',             icon: '📺', row: 'sales',  stage: 'finance_settle',  url: 'pu-signboard.html',        role: '외부 LED 전광판 홍보 문안 편성 및 에이전트 송출' },
    govbid:    { key: 'govbid',    name: '정부사업신청',       icon: '🏛', row: 'sales',  stage: 'consulting_fund', url: 'gov.html',                 role: '나라장터·알리오·기업마당 공고 수집 및 제안 준비' },
    hr:        { key: 'hr',        name: '인사관리',           icon: '👥', row: 'inside', stage: 'finance_settle',  url: 'pu-erp.html?app=hr',       role: '법인 소속 구성원 명부·근태·연차·급여·퇴직 관리', perm: 'hr' },
    fin:       { key: 'fin',       name: '재무관리',           icon: '📒', row: 'inside', stage: 'finance_settle',  url: 'pu-erp.html?app=fin',      role: '계좌 입출금 알림·청구 매칭·세금계산서·월 마감', perm: 'fin' },
    settle:    { key: 'settle',    name: '컨설팅정산',         icon: '🧾', row: 'inside', stage: 'finance_settle',  url: 'pu-settle.html',           role: '개인입금 정부컨설팅 주관·담당 노무사 차액 정산', perm: 'fin' },
    deungi:    { key: 'deungi',    name: '푸른등기',           icon: '🖋', row: 'inside', stage: 'finance_settle',  url: 'pu-deungi.html',           role: '노무법인 사원·정관·분사무소 변경등기 HWPX 자동화', perm: 'deungi' },
    career:    { key: 'career',    name: '경력관리',           icon: '👤', row: 'inside', stage: 'finance_settle',  url: 'kcareer.html',             role: '이알피 수행실적 파생 경력카드·지원서 HWPX·요청메일', adminOnly: true }
  };

  /* ── Ⅲ. 실무 표준 오케스트레이션 런북 8선 ── */
  var WORKFLOW_RUNBOOKS = [
    {
      id: 'rb-onboard',
      stage: 'intake',
      title: '신규 자문·수임 거래처 원스톱 온보딩',
      summary: '명함·사업자등록증 촬영부터 전자계약 체결, 이알피 원장 개시, 주간 업무·뉴스레터 자동 반영까지 한 줄로 잇습니다.',
      chain: [
        { app: 'photos', label: '서류·명함 촬영 판독', url: 'pu-photos.html' },
        { app: 'cards',  label: '기업정보함 카드 확인', url: 'pu-cards.html' },
        { app: 'docs',   label: '견적·전자계약서 발송', url: 'docs-esign.html#forms' },
        { app: 'erp',    label: '업체·자문계약 확정',   url: 'pu-erp.html#menu=biz/contract' },
        { app: 'work',   label: '초기 세팅 할 일 등록', url: 'work.html' }
      ]
    },
    {
      id: 'rb-labor-case',
      stage: 'case_rules',
      title: '노동위원회·진정·산재 사건 수임 ~ 판정 ~ 입금',
      summary: '위임장 전자서명 징구, 이알피 사건·기한 등록, P박스 판례·서면 작성, 캘린더 심문일정, 착수·성공보수 입금까지 연결합니다.',
      chain: [
        { app: 'docs',   label: '전자위임장·계약 서명', url: 'docs-esign.html#esign' },
        { app: 'erp',    label: '사건 원장·기한 등록',   url: 'pu-erp.html#menu=biz/case' },
        { app: 'pbox',   label: '판례 검색·이유서 초안', url: 'pu-pbox.html' },
        { app: 'hangul', label: '로컬 HWP 서면 편집',   url: 'hangul.html' },
        { app: 'cal',    label: '조사·심문기일 공유',   url: 'pu-cal.html' },
        { app: 'fin',    label: '착수·성공보수 매칭',   url: 'pu-erp.html?app=fin#menu=fin/income' }
      ]
    },
    {
      id: 'rb-harass',
      stage: 'case_rules',
      title: '직장 내 괴롭힘·성희롱 조사 8단계 폐루프',
      summary: '조사 공문 메일 수집부터 비밀유지 전자서명, 면담·3요건 검토, 조사결과보고서 HWPX 출력 및 이알피 사건 자동 동기화 흐름입니다.',
      chain: [
        { app: 'mail',   label: '조사 의뢰·공문 수신',   url: 'pu-cards.html?view=mail' },
        { app: 'harass', label: '8단계 조사·결과보고서', url: 'pu-harass.html' },
        { app: 'erp',    label: '사건 원장 동기화 확인', url: 'pu-erp.html#menu=biz/case' },
        { app: 'fin',    label: '조사 용역비 청구·입금', url: 'pu-erp.html?app=fin#menu=fin/invoice' }
      ]
    },
    {
      id: 'rb-gov-consult',
      stage: 'consulting_fund',
      title: '정부컨설팅 공고 발굴 ~ 수임 ~ 보고서 ~ 정산',
      summary: '입찰공고 탐색·경력 증빙 묶기부터 수임 등록, 현장회차 사진, 보고서 서명·제출 체크, 개인입금 주관·담당 정산까지 이어 줍니다.',
      chain: [
        { app: 'govbid',    label: '입찰·모집 공고 탐색', url: 'gov.html' },
        { app: 'career',    label: '수행실적·지원서 채움', url: 'kcareer.html' },
        { app: 'erp',       label: '수임 컨설팅 배정',     url: 'pu-erp.html#menu=biz/consulting' },
        { app: 'consult',   label: '방문일정·HWPX 초안',  url: 'gov-consulting.html' },
        { app: 'govreport', label: '서명본·별첨·제출 체크', url: 'gov-report.html' },
        { app: 'settle',    label: '주관·담당 차액 정산',  url: 'pu-settle.html' }
      ]
    },
    {
      id: 'rb-ilteo-jobtrans',
      stage: 'consulting_fund',
      title: '일터상생혁신 · 산업일자리전환 전문 보고서 파이프라인',
      summary: '메일 기초자료 로컬 비식별 통계 산출부터 중간보고 스냅샷, 후속 피드백 대조, 최종 PPTX/HWPX 보고서 조립까지 연결합니다.',
      chain: [
        { app: 'erp',      label: '참여 사업장 수임 원장', url: 'pu-erp.html#menu=biz/consulting' },
        { app: 'mail',     label: '기초자료·피드백 메일', url: 'pu-cards.html?view=mail' },
        { app: 'ilteo',    label: '일터상생 진단·PPTX',   url: 'ilteo.html' },
        { app: 'jobtrans', label: '산업일자리·구조혁신',   url: 'jobtrans.html' },
        { app: 'govreport',label: '전사 제출 진도 마감',  url: 'gov-report.html' }
      ]
    },
    {
      id: 'rb-govaid-rules',
      stage: 'consulting_fund',
      title: '고용지원금 매칭 · 취업규칙 개정 · 신청 대행',
      summary: '고용보험 피보험자수 기반 지원금 매칭 후 「신청 대행」 확정 시 업무관리 할 일을 자동 생성하고 필요 규정 개정을 병행합니다.',
      chain: [
        { app: 'erp',    label: '고객사 원장·인원 확인', url: 'pu-erp.html#menu=biz/company' },
        { app: 'govaid', label: '지원사업 매칭·검토',    url: 'pu-govaid.html' },
        { app: 'rules',  label: '관련 취업규칙 개정',    url: 'rules-v2.html#sites' },
        { app: 'work',   label: '신청 대행 할 일 완료',  url: 'work.html' }
      ]
    },
    {
      id: 'rb-fund',
      stage: 'consulting_fund',
      title: '사내·공동근로복지기금 설립 ~ 운영 ~ 결산',
      summary: '출연 모회사 정보 참조, 설립 준비서류 안내 메일 발송, 기금 설립 계약 후보 이관, 연간 결산·별지 서식 작성을 잇습니다.',
      chain: [
        { app: 'cards', label: '출연회사 사업자 참조', url: 'pu-cards.html' },
        { app: 'fund',  label: '설립·결산·별지 서식',  url: 'fund.html' },
        { app: 'mail',  label: '준비서류 안내 발송',   url: 'pu-cards.html?view=mail' },
        { app: 'erp',   label: '기금설립 계약 확정',   url: 'pu-erp.html#menu=biz/contract' }
      ]
    },
    {
      id: 'rb-sales-flywheel',
      stage: 'finance_settle',
      title: '주간 노동 브리핑 · 뉴스레터 · 회생공고 영업 환류',
      summary: '홈페이지 주간 브리핑을 뉴스레터로 조합해 활성 자문사에 발송하고, 법원 회생공고를 기존 거래처와 대조해 안내를 선별합니다.',
      chain: [
        { app: 'home',      label: '주간 노동 브리핑 확인', url: 'pu-home.html' },
        { app: 'news',      label: '실시간 명단 뉴스레터',  url: 'pu-news.html' },
        { app: 'rehabad',   label: '회생공고 대조·안내',    url: 'rehab-ad.html' },
        { app: 'signboard', label: '외부 전광판 홍보 송출', url: 'pu-signboard.html' }
      ]
    }
  ];

  /* ── 공통 정제 도우미 ── */
  var hasOwn = Object.prototype.hasOwnProperty;
  function bareMap() { return Object.create(null); }
  function str(v) { return String(v == null ? '' : v).trim(); }

  function uidTagOf(uid) {
    var s = str(uid);
    if (!s) return '';
    var h = 2166136261;
    var input = 'pu-orch-uid:' + s;
    for (var i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul ? Math.imul(h, 16777619) : ((h * 16777619) | 0);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function normBiz(v) { return str(v).replace(/\D/g, ''); }

  function normName(v) {
    return str(v).toLowerCase().replace(/주식회사|유한회사|사단법인|재단법인|사회복지법인|의료법인|㈜|\(주\)|\(유\)|[\s()（）·.,_\-]/g, '');
  }

  function parsePuBody(v) {
    if (typeof v === 'number' && isFinite(v)) {
      var n0 = Math.floor(v);
      return (n0 >= 10001 && n0 <= 99999) ? n0 : 0;
    }
    var s = str(v);
    var m = /^(?:자문|급여|노조|기금|대행|미정)-(\d{5})$/.exec(s);
    if (m) {
      var n1 = Number(m[1]);
      return (n1 >= 10001 && n1 <= 99999) ? n1 : 0;
    }
    var digits = s.replace(/\D/g, '');
    if (digits.length !== 5) return 0;
    var n2 = Number(digits);
    return (n2 >= 10001 && n2 <= 99999) ? n2 : 0;
  }

  function formatPuNo(co) {
    co = co || {};
    var body = parsePuBody(co.puNo);
    if (!body) return '';
    var head = str(co.status) === 'suboffice' ? '대행' : (str(co.typeCode) || str(co.puNoHead) || '미정');
    if (!/^(자문|급여|노조|기금|대행|미정)$/.test(head)) head = '미정';
    return head + '-' + body;
  }

  function safeRecordId(rawId, fallback) {
    var s = str(rawId);
    if (!s || s === '__proto__' || s === 'constructor' || s === 'prototype') return fallback;
    return s;
  }

  function toList(raw) {
    if (!raw) return [];
    var v = (typeof raw === 'object' && !Array.isArray(raw) && raw.v !== undefined && typeof raw.v === 'object') ? raw.v : raw;
    if (Array.isArray(v)) {
      var arrOut = [];
      for (var i = 0; i < v.length; i++) {
        var x = v[i];
        if (!x || typeof x !== 'object' || x._deleted) continue;
        var sid0 = safeRecordId(x.id, '_idx_' + i);
        arrOut.push(sid0 === x.id ? x : Object.assign({}, x, { id: sid0 }));
      }
      return arrOut;
    }
    if (typeof v === 'object') {
      return Object.keys(v).map(function (k, idx) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') return null;
        var item = v[k];
        if (!item || typeof item !== 'object' || item._deleted) return null;
        var sid1 = safeRecordId(item.id, safeRecordId(k, '_key_' + idx));
        return sid1 === item.id ? item : Object.assign({}, item, { id: sid1 });
      }).filter(Boolean);
    }
    return [];
  }

  function parseDateMs(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number' && isFinite(v)) {
      return v > 1e11 ? v : (v > 1e9 ? v * 1000 : 0);
    }
    var s = str(v);
    if (!s) return 0;
    if (/^\d{10,13}$/.test(s)) {
      var num = Number(s);
      return s.length === 10 ? num * 1000 : num;
    }
    var m = /^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/.exec(s);
    if (m) {
      var dt = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0) - 9 * 3600 * 1000;
      return isFinite(dt) ? dt : 0;
    }
    var p = Date.parse(s);
    return isFinite(p) ? p : 0;
  }

  function daysBetween(targetMs, nowMs) {
    if (!targetMs || !nowMs) return null;
    return Math.ceil((targetMs - nowMs) / DAY_MS);
  }

  function formatDday(days) {
    if (days == null || !isFinite(days)) return '';
    if (days === 0) return '오늘 마감';
    if (days < 0) return '기한 +' + Math.abs(days) + '일 경과';
    return 'D-' + days;
  }

  /* 개인정보·로그인 아이디(사번·이메일·주민번호·전화·계좌·카드) 화면/바통 유출 차단 */
  function maskSensitiveText(text) {
    var s = str(text);
    if (!s) return '';
    // 카드번호 (4-4-4-4 / 4-4-4-3 / Amex 4-6-5 · 하이픈/공백/마침표 구분)
    s = s.replace(/\b\d{4}[-\s.]\d{4}[-\s.]\d{4}[-\s.]\d{3,4}\b/g, '[카드가림]');
    s = s.replace(/\b\d{4}[-\s.]\d{6}[-\s.]\d{5}\b/g, '[카드가림]');
    // 주민번호·외국인등록번호 패턴 (하이픈 유무 모두 포함)
    s = s.replace(/\b\d{6}\s*[-~]\s*[1-8]\d{6}\b/g, '[주민번호가림]');
    s = s.replace(/\b\d{6}[1-8]\d{6}\b/g, '[주민번호가림]');
    // 이메일(로그인 아이디 포함)
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[이메일가림]');
    // 국제(+82)·괄호 지역번호((02))·휴대폰·유선 전화번호
    s = s.replace(/\+82[-\s.]?(?:0?1[016789]|0?2|[3-6][1-5]|70)[-\s.)]*\d{3,4}[-\s.]?\d{4}\b/g, '[연락처가림]');
    s = s.replace(/\(0(?:2|[3-6][1-5]|70)\)[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g, '[연락처가림]');
    s = s.replace(/\b01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}\b/g, '[연락처가림]');
    s = s.replace(/\b0(?:2|[3-6][1-5]|70)[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g, '[연락처가림]');
    // 계좌·카드 유사 숫자열 (3~4묶음 하이픈/공백 계좌, 사업자번호 3-2-5 10자리 제외, 11~19자리 연속 숫자 포함)
    s = s.replace(/\b\d{2,6}[-\s]\d{2,6}[-\s]\d{2,7}(?:[-\s]\d{1,5})?\b/g, function (m) {
      if (/^\d{3}-\d{2}-\d{5}$/.test(m)) return m;
      var dg = m.replace(/\D/g, '');
      return dg.length >= 10 ? '[계좌가림]' : m;
    });
    s = s.replace(/\b\d{11,19}\b/g, '[계좌가림]');
    // 사번 패턴(P-001 등)이 노출 문구에 섞여 있으면 제거 (일반 동·호수 A-101 훼손 방지)
    s = s.replace(/\bP-\d{3,4}\b/gi, '');
    return s.replace(/\s{2,}/g, ' ').trim();
  }

  function safeRelUrl(url, fallback) {
    var u = str(url);
    if (!u) return fallback || 'pu-orchestrator.html';
    if (/^(?:https?:|javascript:|data:|vbscript:|\/\/|\/)/i.test(u)) return fallback || 'pu-orchestrator.html';
    if (/[\r\n\t"'<>]/.test(u)) return fallback || 'pu-orchestrator.html';
    var base = u.split('#')[0].split('?')[0];
    if (!/^[A-Za-z0-9._-]+\.html$/.test(base)) return fallback || 'pu-orchestrator.html';
    return u;
  }

  function appCanAccess(appKey, userCtx) {
    if (!hasOwn.call(APP_META, appKey)) return false;
    var meta = APP_META[appKey];
    if (!meta || meta.off) return false;
    var role = str(userCtx && userCtx.role);
    var isAdmin = role === 'admin' || !!(userCtx && userCtx.isAdmin);
    var isSubAdmin = !!(userCtx && userCtx.isSubAdmin);
    if (role === 'reviewer') return appKey === 'hangul' || appKey === 'aliounion';
    if (meta.adminOnly && !isAdmin) return false;
    if (meta.soon && !isAdmin) return false;
    if (meta.perm) {
      if (isAdmin || isSubAdmin) return true;
      var perms = (userCtx && userCtx.perms) || {};
      return !!perms[meta.perm];
    }
    return true;
  }

  /* ── Ⅳ. 직원 명부 색인 (사번 sid ➔ 이름만 반환, 화면에 사번 절대 미표시) ── */
  function buildStaffDirectory(userDirRaw, userAccountsRaw) {
    var bySid = bareMap();
    var activeSids = bareMap();
    function ingest(list) {
      toList(list).forEach(function (u) {
        var sid = str(u.sid || u.empSid);
        var nm = str(u.name || u.userName);
        if (!sid) return;
        if (nm && nm.indexOf('@') < 0 && !/^P-\d+$/i.test(nm)) {
          bySid[sid] = nm;
        }
        if (str(u.status || 'active') !== 'resigned' && str(u.status) !== 'inactive') {
          activeSids[sid] = true;
        }
      });
    }
    ingest(userDirRaw);
    ingest(userAccountsRaw);
    return {
      bySid: bySid,
      activeSids: activeSids,
      hasSid: function (sid) { var k = str(sid); return !!(k && bySid[k]); },
      nameOf: function (sidOrObj) {
        if (!sidOrObj) return '';
        if (typeof sidOrObj === 'object') {
          var s0 = str(sidOrObj.sid || sidOrObj.empSid || sidOrObj.id);
          if (s0 && bySid[s0]) return bySid[s0];
          var rawNm = str(sidOrObj.name || sidOrObj.label);
          return (rawNm && rawNm.indexOf('@') < 0 && !/^P-\d+$/i.test(rawNm)) ? maskSensitiveText(rawNm) : '';
        }
        var s = str(sidOrObj);
        if (bySid[s]) return bySid[s];
        // 만약 사번이나 이메일 형태면 화면에 그대로 노출하지 않는다 (대표 지시 2026-10-25)
        if (/^P-?\d{3,4}$/i.test(s) || s.indexOf('@') >= 0) return '담당자 확인필요';
        return maskSensitiveText(s);
      }
    };
  }

  /* ── Ⅴ. 업체 원장 색인 (영구 companyId · 고유번호 몸통 · 사업자번호 확정 vs 상호 추정 분리) ── */
  function buildOrgDirectory(companiesRaw) {
    var byId = bareMap();
    var byPuBody = bareMap();
    var byBiz = bareMap();
    var byName = bareMap();
    var list = toList(companiesRaw);

    list.forEach(function (co) {
      var id = str(co.id);
      if (!id) return;
      var nm = str(co.name || co.companyName || co.company) || '업체명 미입력';
      var bz = normBiz(co.bizNo || co.businessNumber || co.bizNum);
      var puBody = parsePuBody(co.puNo);
      var puLabel = formatPuNo(co);
      var managerSid = str(co.managerMain || co.managerSid || co.ownerSid || (co.mgr_main && co.mgr_main.sid));
      var rec = {
        id: id,
        name: nm,
        bizNo: bz.length === 10 ? bz : '',
        puBody: puBody,
        puLabel: puLabel,
        status: str(co.status || 'active'),
        typeCode: str(co.typeCode),
        managerSid: managerSid,
        raw: co
      };
      byId[id] = rec;
      if (puBody && !byPuBody[puBody]) byPuBody[puBody] = rec;
      if (rec.bizNo) {
        if (!byBiz[rec.bizNo]) byBiz[rec.bizNo] = [];
        byBiz[rec.bizNo].push(rec);
      }
      var nk = normName(nm);
      if (nk) {
        if (!byName[nk]) byName[nk] = [];
        byName[nk].push(rec);
      }
    });

    function match(refObj) {
      refObj = refObj || {};
      var cid = str(refObj.companyId || refObj.co_id || refObj.puerp_co_id || refObj.erpCoId);
      if (cid && byId[cid]) {
        return { org: byId[cid], companyId: cid, confidence: 'confirmed', via: 'companyId' };
      }
      var pBody = parsePuBody(refObj.puNo || refObj.companyNo);
      if (pBody && byPuBody[pBody]) {
        return { org: byPuBody[pBody], companyId: byPuBody[pBody].id, confidence: 'confirmed', via: 'puNo' };
      }
      var bz = normBiz(refObj.bizNo || refObj.businessNumber || refObj.coKey);
      if (bz.length === 10 && byBiz[bz] && byBiz[bz].length === 1) {
        return { org: byBiz[bz][0], companyId: byBiz[bz][0].id, confidence: 'confirmed', via: 'bizNo' };
      }
      var rawName = str(refObj.companyName || refObj.company || refObj.co || refObj.co_name || refObj.siteName || refObj.name);
      var nk = normName(rawName);
      if (nk && byName[nk] && byName[nk].length === 1) {
        // 이름으로만 일치하는 경우는 온톨로지 규칙에 따라 확정하지 않고 'candidate'(이름 추정 후보)로 표시한다
        return { org: byName[nk][0], companyId: '', candidateId: byName[nk][0].id, confidence: 'candidate', via: 'name_guess' };
      }
      return { org: null, companyId: '', confidence: 'none', via: '' };
    }

    return {
      list: Object.keys(byId).map(function (k) { return byId[k]; }),
      byId: byId,
      byPuBody: byPuBody,
      byBiz: byBiz,
      match: match
    };
  }

  function extractSid(rec) {
    if (!rec || typeof rec !== 'object') return '';
    if (rec.mgr_main && typeof rec.mgr_main === 'object' && rec.mgr_main.sid) return str(rec.mgr_main.sid);
    return str(rec.managerMain || rec.ownerSid || rec.mainSid || rec.sid || rec.empSid || rec.assigneeSid);
  }

  function isClosedStatus(st) {
    var s = str(st).toLowerCase();
    return s === 'done' || s === 'closed' || s === 'completed' || s === 'terminated' ||
      s === 'cancelled' || s === 'canceled' || s === 'transferred' || s === 'archived' ||
      s === '종결' || s === '완료' || s === '계약종료' || s === '해지' || s === '이관' || s === '취소' || s === '보관';
  }

  function isRecordClosed(rec) {
    if (!rec || typeof rec !== 'object') return true;
    if (rec._deleted || rec.permanentArchived || rec.done === true) return true;
    if (str(rec.closedAt) || str(rec.closeDate)) return true;
    return isClosedStatus(rec.status) || isClosedStatus(rec.stage) || isClosedStatus(rec.state);
  }

  function pickCaseDueMs(cs, nowMs) {
    var fields = [cs.deadline, cs.dueDate, cs.hearingDate, cs.nextDate];
    var bestUpcoming = 0;
    var bestOverdue = 0;
    for (var i = 0; i < fields.length; i++) {
      var ms = parseDateMs(fields[i]);
      if (!ms) continue;
      if (ms >= nowMs - DAY_MS) {
        if (!bestUpcoming || ms < bestUpcoming) bestUpcoming = ms;
      } else {
        if (!bestOverdue || ms > bestOverdue) bestOverdue = ms;
      }
    }
    return bestUpcoming || bestOverdue || 0;
  }

  /* ── Ⅵ. 통합 워크스페이스 오케스트레이션 분석기 (읽기 전용 · 원본 무변경) ── */
  function analyzeWorkspace(raw, opts) {
    raw = raw || {};
    opts = opts || {};
    var now = Number(opts.now) || Date.now();
    var userCtx = {
      uid: str(opts.uid),
      sid: str(opts.sid),
      role: str(opts.role || 'staff'),
      isAdmin: opts.role === 'admin' || !!opts.isAdmin,
      isSubAdmin: !!opts.isSubAdmin,
      perms: opts.perms || {}
    };
    var localState = opts.localState || {}; // { checked: {id: at}, snoozedUntil: {id: ts}, notes: {id: text} }
    var checkedMap = localState.checked || {};
    var snoozeMap = localState.snoozedUntil || {};
    var noteMap = localState.notes || {};

    var staffDir = buildStaffDirectory(raw.userDir, raw.userAccounts);
    var orgDir = buildOrgDirectory(raw.companies);

    var batons = [];
    var diagnostics = [];
    var coStats = bareMap();

    function ensureCoStat(coId, fallbackName, orgRec) {
      var cleanFallback = str(fallbackName);
      var key = coId || ('unlinked:' + (normName(cleanFallback) || 'unknown'));
      if (!coStats[key]) {
        coStats[key] = {
          key: key,
          companyId: coId || '',
          name: (orgRec && orgRec.name) || cleanFallback || '미연결 사업장',
          puLabel: (orgRec && orgRec.puLabel) || '',
          bizNo: (orgRec && orgRec.bizNo) || '',
          status: (orgRec && orgRec.status) || 'pending',
          managerSid: (orgRec && orgRec.managerSid) || '',
          managerName: (orgRec && orgRec.managerSid) ? staffDir.nameOf(orgRec.managerSid) : '',
          counts: { contracts: 0, cases: 0, consultings: 0, funds: 0, works: 0, rules: 0, govaid: 0, finance: 0 },
          stages: { intake: 'idle', case_rules: 'idle', consulting_fund: 'idle', work_payroll: 'idle', finance_settle: 'idle' },
          batons: [],
          appsInvolved: bareMap()
        };
      }
      return coStats[key];
    }

    orgDir.list.forEach(function (org) {
      if (isClosedStatus(org.status)) return;
      ensureCoStat(org.id, org.name, org);
    });

    function markStage(stat, stageId, level, appKey) {
      if (!stat) return;
      if (appKey) stat.appsInvolved[appKey] = true;
      var rank = { idle: 0, active: 1, done: 2, warn: 3, urgent: 4 };
      var cur = stat.stages[stageId] || 'idle';
      if ((rank[level] || 0) > (rank[cur] || 0)) stat.stages[stageId] = level;
    }

    function pushBaton(b) {
      if (!b || !b.id) return;
      if (!appCanAccess(b.toApp, userCtx)) return;
      var bid = str(b.id);
      var snoozedUntil = hasOwn.call(snoozeMap, bid) ? (Number(snoozeMap[bid]) || 0) : 0;
      var isSnoozed = snoozedUntil > now;
      var isChecked = hasOwn.call(checkedMap, bid) ? !!checkedMap[bid] : false;
      var memoRaw = hasOwn.call(noteMap, bid) ? noteMap[bid] : '';
      var safeTitle = maskSensitiveText(b.title);
      var safeReason = maskSensitiveText(b.reason);
      var toMeta = hasOwn.call(APP_META, b.toApp) ? APP_META[b.toApp] : null;
      var fromMeta = hasOwn.call(APP_META, b.fromApp) ? APP_META[b.fromApp] : null;
      var targetUrl = safeRelUrl(b.targetUrl, (toMeta && toMeta.url) || 'enter.html');
      var ownerSid = str(b.ownerSid);
      var ownerName = ownerSid ? staffDir.nameOf(ownerSid) : (str(b.ownerName) ? maskSensitiveText(b.ownerName) : '미배정');

      var item = {
        id: bid,
        ruleCode: str(b.ruleCode),
        stage: str(b.stage || 'intake'),
        severity: b.severity === 'urgent' ? 'urgent' : (b.severity === 'warn' ? 'warn' : 'normal'),
        fromApp: str(b.fromApp || 'erp'),
        toApp: str(b.toApp || 'erp'),
        fromName: (fromMeta && fromMeta.name) || str(b.fromApp),
        toName: (toMeta && toMeta.name) || str(b.toApp),
        fromIcon: (fromMeta && fromMeta.icon) || '📌',
        toIcon: (toMeta && toMeta.icon) || '➡️',
        companyId: str(b.companyId),
        candidateCompanyId: str(b.candidateCompanyId),
        companyLabel: maskSensitiveText(b.companyLabel || '사업장 미지정'),
        puLabel: str(b.puLabel),
        linkConfidence: b.linkConfidence || (b.companyId ? 'confirmed' : 'none'),
        title: safeTitle,
        reason: safeReason,
        actionLabel: str(b.actionLabel || '이어서 처리'),
        ownerSid: ownerSid,
        ownerName: ownerName,
        isMine: !!(userCtx.sid && ownerSid && userCtx.sid === ownerSid),
        dueMs: Number(b.dueMs) || 0,
        ddayLabel: str(b.ddayLabel),
        createdMs: Number(b.createdMs) || 0,
        ageDays: b.ageDays != null ? Number(b.ageDays) : null,
        targetUrl: targetUrl,
        checked: isChecked,
        snoozed: isSnoozed,
        memo: maskSensitiveText(memoRaw || '')
      };
      batons.push(item);

      var shouldBindCo = (b.bindCompany !== false) && !!(item.companyId || b.bindCompany === true);
      if (shouldBindCo) {
        var st = ensureCoStat(item.companyId, item.companyLabel, item.companyId ? orgDir.byId[item.companyId] : null);
        st.batons.push(item);
        if (!isChecked && !isSnoozed) {
          markStage(st, item.stage, item.severity === 'urgent' ? 'urgent' : 'warn', item.toApp);
        }
        st.appsInvolved[item.fromApp] = true;
        st.appsInvolved[item.toApp] = true;
      }
    }

    /* 1) 사진첩·현장클리닉 ➔ 푸른이알피 계약 등록 요청 대기 (data/contract_requests) */
    var contractReqs = toList(raw.contractRequests);
    contractReqs.forEach(function (req) {
      var st = str(req.status || req.state || 'pending').toLowerCase();
      if (st === 'done' || st === 'merged' || st === 'applied' || st === 'rejected' || st === 'cancelled' || isRecordClosed(req)) return;
      var m = orgDir.match(req);
      var createdMs = parseDateMs(req.createdAt || req.at);
      var age = createdMs ? Math.max(0, Math.floor((now - createdMs) / DAY_MS)) : 0;
      var srcApp = str(req.from || req.source || '').indexOf('clinic') >= 0 ? 'erp' : 'photos';
      var rawCoNm = str(req.companyName || req.company);
      pushBaton({
        id: 'creq:' + str(req.id),
        ruleCode: 'contract_request_pending',
        stage: 'intake',
        severity: age >= 3 ? 'urgent' : 'warn',
        fromApp: srcApp,
        toApp: 'erp',
        companyId: m.companyId,
        candidateCompanyId: m.candidateId,
        companyLabel: (m.org && m.org.name) || rawCoNm || '신규 의뢰처',
        puLabel: (m.org && m.org.puLabel) || '',
        linkConfidence: m.confidence,
        bindCompany: !!(m.companyId || rawCoNm),
        title: '계약 등록 요청 대기 · ' + (str(req.contractType || req.kind || req.title) || '신규 계약'),
        reason: (srcApp === 'photos' ? '사진첩 판독 서류' : '현장클리닉 접수') + '에서 올라온 계약 요청이 이알피 확정 대기 중입니다',
        actionLabel: '이알피 계약확정',
        ownerSid: extractSid(req),
        createdMs: createdMs,
        ageDays: age,
        targetUrl: 'pu-erp.html#menu=biz/contract'
      });
    });

    /* 2) 푸른이알피 계약 원장 점검 (상담접수·계약협의 진행 / 업체 연결 보류 / 담당자 미지정) */
    var contracts = toList(raw.contracts);
    var contractOrgSet = bareMap();
    contracts.forEach(function (ct) {
      var m = orgDir.match(ct);
      var closedCt = isRecordClosed(ct);
      var rawCoNm = str(ct.companyName || ct.company);
      if (m.companyId || rawCoNm) {
        var coStat = ensureCoStat(m.companyId, rawCoNm, m.org);
        coStat.counts.contracts++;
        markStage(coStat, 'intake', closedCt ? 'done' : 'active', 'erp');
      }
      if (m.companyId && !closedCt) contractOrgSet[m.companyId] = true;

      var ownerSid = extractSid(ct) || (m.org && m.org.managerSid) || '';
      var linkState = str(ct.companyLinkStatus);
      var stageStr = str(ct.stage || ct.status || '');

      if (!closedCt && (linkState === 'pending' || (!m.companyId && rawCoNm))) {
        diagnostics.push({
          id: 'diag:ct-link:' + ct.id,
          code: linkState === 'pending' ? 'pending_company_link' : 'missing_company_id',
          severity: 'high',
          app: 'erp',
          appName: '푸른이알피',
          recordId: str(ct.id),
          companyLabel: maskSensitiveText(rawCoNm || '미상'),
          detail: linkState === 'pending'
            ? '계약의 업체 연결이 보류(pending) 상태입니다 — 사업자번호 확인 후 원장과 연결하세요'
            : '업체명만 있고 영구 companyId가 비어 있습니다' + (m.confidence === 'candidate' ? ' (원장 동일 상호 후보 있음)' : ''),
          targetUrl: 'pu-erp.html#menu=biz/contract'
        });
        pushBaton({
          id: 'ctlink:' + str(ct.id),
          ruleCode: 'erp_company_unlinked',
          stage: 'intake',
          severity: 'warn',
          fromApp: 'cards',
          toApp: 'erp',
          companyId: '',
          candidateCompanyId: m.candidateId || '',
          companyLabel: rawCoNm || '미연결 계약',
          linkConfidence: m.confidence,
          bindCompany: !!rawCoNm,
          title: '계약 업체원장 연결 보류 · ' + (str(ct.type || ct.contractType || ct.title) || '계약'),
          reason: '사업자등록번호 대조 후 업체 원장(companyId)과 확정 연결이 필요합니다',
          actionLabel: '업체 연결 확인',
          ownerSid: ownerSid,
          targetUrl: 'pu-erp.html#menu=biz/contract'
        });
      }

      if (!closedCt && !ownerSid) {
        diagnostics.push({
          id: 'diag:ct-mgr:' + ct.id,
          code: 'missing_manager_sid',
          severity: 'medium',
          app: 'erp',
          appName: '푸른이알피',
          recordId: str(ct.id),
          companyLabel: maskSensitiveText((m.org && m.org.name) || rawCoNm || '업체 미상'),
          detail: '진행 계약에 주담당 사번(managerMain)이 지정되지 않았습니다',
          targetUrl: 'pu-erp.html#menu=biz/contract'
        });
      }

      if (!closedCt && /상담접수|계약협의|quote|negotiating/i.test(stageStr)) {
        var cMs = parseDateMs(ct.updatedAt || ct.createdAt || ct.contractDate);
        var ageDays = cMs ? Math.max(0, Math.floor((now - cMs) / DAY_MS)) : 0;
        pushBaton({
          id: 'ctstage:' + str(ct.id),
          ruleCode: 'contract_stage_followup',
          stage: 'intake',
          severity: ageDays >= 7 ? 'urgent' : 'normal',
          fromApp: 'docs',
          toApp: 'erp',
          companyId: m.companyId,
          candidateCompanyId: m.candidateId,
          companyLabel: (m.org && m.org.name) || rawCoNm || '신규 상담처',
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          bindCompany: !!(m.companyId || rawCoNm),
          title: '[' + stageStr + '] 계약서 서명·확정 전환 점검',
          reason: '견적·협의 단계 계약입니다' + (ageDays ? ' (' + ageDays + '일 경과)' : '') + ' — 서명본 회수 시 계약확정으로 전환하세요',
          actionLabel: '계약 단계 전환',
          ownerSid: ownerSid,
          createdMs: cMs,
          ageDays: ageDays,
          targetUrl: 'pu-erp.html#menu=biz/contract'
        });
      }
    });

    /* 3) 계약서등관리 견적·계약 기록 ➔ 이알피 계약 미전환 점검 (pu_quotes) */
    var quotes = toList(raw.quotes);
    quotes.forEach(function (q) {
      if (str(q.status) === 'archived' || str(q.erpLinkedId) || isRecordClosed(q)) return;
      var m = orgDir.match({ companyId: q.companyId, bizNo: q.coKey, companyName: q.co });
      var alreadyContracted = !!(m.companyId && contractOrgSet[m.companyId]);
      if (str(q.review) !== 'check' && alreadyContracted) return;
      var qMs = parseDateMs(q.date || q.createdAt);
      var age = qMs ? Math.max(0, Math.floor((now - qMs) / DAY_MS)) : 0;
      if (age > 60) return; // 오래된 과거 아카이브는 실행 대기열 과밀 방지를 위해 제외
      var rawCoNm = str(q.co);
      pushBaton({
        id: 'quote:' + str(q.id),
        ruleCode: 'quote_to_contract',
        stage: 'intake',
        severity: str(q.review) === 'check' ? 'warn' : 'normal',
        fromApp: 'mail',
        toApp: 'docs',
        companyId: m.companyId,
        candidateCompanyId: m.candidateId,
        companyLabel: (m.org && m.org.name) || rawCoNm || '견적 발송처',
        puLabel: (m.org && m.org.puLabel) || '',
        linkConfidence: m.confidence,
        bindCompany: !!(m.companyId || rawCoNm),
        title: (q.doc === 'contract' ? '발송 계약서' : '발송 견적서') + ' 검토·이알피 연계 (' + str(q.scope || q.type || '업무') + ')',
        reason: str(q.review) === 'check'
          ? '보낸메일에서 감지된 서류의 담당·내용 검토 확인이 필요합니다'
          : '견적 발송 후 아직 이알피 계약 원장에 연결되지 않았습니다',
        actionLabel: '견적·계약 열기',
        ownerSid: extractSid(q),
        createdMs: qMs,
        ageDays: age,
        targetUrl: 'docs-esign.html#quotes'
      });
    });

    /* 4) 기업정보함 얇은 거울(pucards/ontIdx) ➔ 푸른이알피 업체 원장 미연결 점검 */
    var cardsOntIdx = (raw.cardsOntIdx && typeof raw.cardsOntIdx === 'object') ? raw.cardsOntIdx : {};
    Object.keys(cardsOntIdx).forEach(function (idxKey) {
      if (idxKey === '__proto__' || idxKey === 'constructor' || idxKey === 'prototype') return;
      var ci = cardsOntIdx[idxKey];
      if (!ci || typeof ci !== 'object' || ci._deleted) return;
      var erpCoId = str(ci.erpCoId || ci.companyId);
      if (erpCoId && orgDir.byId[erpCoId]) return;
      var rawCoNm = str(ci.company || ci.name);
      var docCnt = Array.isArray(ci.docs) ? ci.docs.length : (ci.docs && typeof ci.docs === 'object' ? Object.keys(ci.docs).length : 0);
      if (!rawCoNm || docCnt === 0) return;
      var m = orgDir.match({ companyId: erpCoId, bizNo: idxKey, companyName: rawCoNm });
      if (m.companyId) return;
      var safeId = safeRecordId(idxKey, normName(rawCoNm) || 'card');
      pushBaton({
        id: 'card-unlinked:' + safeId,
        ruleCode: 'card_ontidx_unlinked',
        stage: 'intake',
        severity: 'normal',
        fromApp: 'cards',
        toApp: 'erp',
        companyId: '',
        candidateCompanyId: m.candidateId,
        companyLabel: rawCoNm,
        linkConfidence: m.confidence,
        bindCompany: true,
        title: '기업정보함 보관 서류(' + docCnt + '건) ➔ 업체 원장 연결 대기',
        reason: '기업정보함 얇은 거울(ontIdx)에 서류가 모였으나 아직 이알피 영구 companyId와 연결되지 않았습니다',
        actionLabel: '기업정보·원장 확인',
        ownerSid: '',
        targetUrl: 'pu-cards.html'
      });
    });

    /* 5) 노동사건 · 직장 내 괴롭힘/성희롱 사건 기한 · 조사 연동 바통 (data/cases — harass_invest in_app 본문 미열람) */
    var cases = toList(raw.cases);
    cases.forEach(function (cs) {
      var m = orgDir.match(cs);
      var closed = isRecordClosed(cs);
      var rawCoNm = str(cs.companyName || cs.company);
      var caseKind = str(cs.caseType || cs.category || cs.title);
      var isHarassCase = /괴롭힘|성희롱/.test(caseKind) || !!str(cs.harassCaseId);
      if (m.companyId || rawCoNm) {
        var coStat = ensureCoStat(m.companyId, rawCoNm, m.org);
        coStat.counts.cases++;
        markStage(coStat, 'case_rules', closed ? 'done' : 'active', isHarassCase ? 'harass' : 'erp');
      }
      if (closed) return;

      var ownerSid = extractSid(cs) || (m.org && m.org.managerSid) || '';

      if (isHarassCase && !str(cs.harassCaseId)) {
        pushBaton({
          id: 'harass-link:' + str(cs.id),
          ruleCode: 'harass_erp_sync',
          stage: 'case_rules',
          severity: 'warn',
          fromApp: 'erp',
          toApp: 'harass',
          companyId: m.companyId,
          candidateCompanyId: m.candidateId,
          companyLabel: (m.org && m.org.name) || rawCoNm || '조사 의뢰 사업장',
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          bindCompany: !!(m.companyId || rawCoNm),
          title: '괴롭힘·성희롱 사건 ➔ 8단계 조사 워크스페이스 연동 점검',
          reason: '이알피에 접수된 괴롭힘·성희롱 사건입니다 — 조사 전용 앱에서 절차·보고서 연결 상태를 확인하세요',
          actionLabel: '조사 현황 열기',
          ownerSid: ownerSid,
          targetUrl: 'pu-harass.html'
        });
      }

      var dueMs = pickCaseDueMs(cs, now);
      var dLeft = dueMs ? daysBetween(dueMs, now) : null;

      if (dLeft != null && dLeft <= 14) {
        pushBaton({
          id: 'case-due:' + str(cs.id),
          ruleCode: 'case_deadline_imminent',
          stage: 'case_rules',
          severity: dLeft <= 3 ? 'urgent' : 'warn',
          fromApp: 'erp',
          toApp: 'pbox',
          companyId: m.companyId,
          candidateCompanyId: m.candidateId,
          companyLabel: (m.org && m.org.name) || rawCoNm || str(cs.title || '진행 사건'),
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          bindCompany: !!(m.companyId || rawCoNm),
          title: '사건 기일·서면 기한 ' + formatDday(dLeft) + ' · ' + (caseKind || '노동사건'),
          reason: dLeft < 0
            ? '기일·제출기한이 경과한 미종결 사건입니다 — 종결 반영 또는 후속 서면을 즉시 점검하세요'
            : '기일·제출기한이 임박했습니다 — P박스 판례 검증·서면 초안 또는 한글 편집기로 서면을 마무리하세요',
          actionLabel: 'P박스 서면작성',
          ownerSid: ownerSid,
          dueMs: dueMs,
          ddayLabel: formatDday(dLeft),
          targetUrl: 'pu-pbox.html'
        });
      }
    });

    /* 7) 정부컨설팅 원장(data/consultings) ➔ 일정·보고서·일터상생·산업일자리·정산 파이프라인 (원고 본문 미수집) */
    var consultings = toList(raw.consultings);
    consultings.forEach(function (cs) {
      var m = orgDir.match(cs);
      var closed = isRecordClosed(cs);
      var rawCoNm = str(cs.companyName || cs.company);
      if (m.companyId || rawCoNm) {
        var coStat = ensureCoStat(m.companyId, rawCoNm, m.org);
        coStat.counts.consultings++;
        markStage(coStat, 'consulting_fund', closed ? 'done' : 'active', 'consult');
      }
      if (closed) return;

      var bizLabel = str(cs.bizName || cs.typeName || cs.consultingType || cs.title);
      var ownerSid = extractSid(cs) || (m.org && m.org.managerSid) || '';

      // 일터혁신·상생컨설팅 수임 ➔ 일터상생혁신 워크스페이스 연동
      if (/일터\s*혁신|상생\s*컨설팅/.test(bizLabel) && m.companyId && !cs.ilteoLinked) {
        pushBaton({
          id: 'cons-ilteo:' + str(cs.id),
          ruleCode: 'consulting_to_ilteo',
          stage: 'consulting_fund',
          severity: 'warn',
          fromApp: 'erp',
          toApp: 'ilteo',
          companyId: m.companyId,
          companyLabel: (m.org && m.org.name) || rawCoNm || '컨설팅 사업장',
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          title: '일터혁신 수임 사업장 ➔ 일터상생혁신 보고서·진단 연동 점검',
          reason: '이알피에 수임 등록된 일터혁신 사업장입니다 — 일터상생혁신 앱에서 기초자료 및 PPTX 보고서 진도를 확인하세요',
          actionLabel: '일터상생 열기',
          ownerSid: ownerSid,
          targetUrl: 'ilteo.html'
        });
      }

      // 산업일자리전환·구조혁신 수임 ➔ 산업일자리전환 워크스페이스 연동
      if (/산업\s*일자리|구조\s*혁신|능률\s*협회|충남\s*경제\s*진흥/.test(bizLabel) && m.companyId && !cs.jobtransLinked) {
        pushBaton({
          id: 'cons-jt:' + str(cs.id),
          ruleCode: 'consulting_to_jobtrans',
          stage: 'consulting_fund',
          severity: 'warn',
          fromApp: 'erp',
          toApp: 'jobtrans',
          companyId: m.companyId,
          companyLabel: (m.org && m.org.name) || rawCoNm || '컨설팅 사업장',
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          title: '산업일자리·구조혁신 수임 ➔ 기관별 HWPX 보고서 연동 점검',
          reason: '수임 확정된 산업일자리/구조혁신 사업장입니다 — 능률협회·충남경제진흥원 맞춤 보고서 진행을 확인하세요',
          actionLabel: '산업일자리 열기',
          ownerSid: ownerSid,
          targetUrl: 'jobtrans.html'
        });
      }

      // 컨설팅 마감기한 임박 점검
      var cDueMs = parseDateMs(cs.deadline || cs.dueDate || cs.endDate);
      var cLeft = cDueMs ? daysBetween(cDueMs, now) : null;
      if (cLeft != null && cLeft <= 10) {
        pushBaton({
          id: 'cons-due:' + str(cs.id),
          ruleCode: 'consulting_deadline_imminent',
          stage: 'consulting_fund',
          severity: cLeft <= 2 ? 'urgent' : 'warn',
          fromApp: 'consult',
          toApp: 'govreport',
          companyId: m.companyId,
          candidateCompanyId: m.candidateId,
          companyLabel: (m.org && m.org.name) || rawCoNm || '컨설팅 수행 사업장',
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          bindCompany: !!(m.companyId || rawCoNm),
          title: '컨설팅 수행·보고서 마감 ' + formatDday(cLeft) + ' · ' + (bizLabel || '정부지원 컨설팅'),
          reason: '컨설팅 보고서 제출·서명본 회수 기한이 다가왔습니다 — 컨설팅보고서 진도를 확인하세요',
          actionLabel: '컨설팅보고서 열기',
          ownerSid: ownerSid,
          dueMs: cDueMs,
          ddayLabel: formatDday(cLeft),
          targetUrl: 'gov-report.html'
        });
      }

      // 개인입금·정산 대상 컨설팅 완료분 ➔ 컨설팅정산 연계 (권한 보유자 전용, in_app 금액 본문 미수집)
      if (appCanAccess('settle', userCtx) && /정산대기|보고완료|제출완료|settle_pending/i.test(str(cs.stage || cs.settlementStatus))) {
        pushBaton({
          id: 'cons-settle:' + str(cs.id),
          ruleCode: 'consulting_to_settle',
          stage: 'finance_settle',
          severity: 'warn',
          fromApp: 'consult',
          toApp: 'settle',
          companyId: m.companyId,
          candidateCompanyId: m.candidateId,
          companyLabel: (m.org && m.org.name) || rawCoNm || '컨설팅 정산 대상',
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          bindCompany: !!(m.companyId || rawCoNm),
          title: '보고 완료 컨설팅 ➔ 주관·담당 정산 확인 (' + (bizLabel || '컨설팅') + ')',
          reason: '수행 보고가 마무리된 건입니다 — 컨설팅정산 앱 안에서 입금·차액 정산을 확인하세요',
          actionLabel: '컨설팅정산 열기',
          ownerSid: ownerSid,
          targetUrl: 'pu-settle.html'
        });
      }
    });

    /* 8) 근로복지기금 참여사업장 연결 점검 (data/funds) */
    var funds = toList(raw.funds);
    funds.forEach(function (fd) {
      var m = orgDir.match(fd);
      var rawCoNm = str(fd.companyName || fd.fundName || fd.name);
      if (m.companyId || rawCoNm) {
        var coStat = ensureCoStat(m.companyId, rawCoNm, m.org);
        coStat.counts.funds++;
        markStage(coStat, 'consulting_fund', isRecordClosed(fd) ? 'done' : 'active', 'fund');
      }
    });

    /* 9) 업무관리(work_erp/items) 주간 할 일 & 지원금 신청 대행(GA-*) 연계 점검 */
    var workItemsList = toList(raw.workItems);
    workItemsList.forEach(function (w) {
      var wid = str(w.id);
      var closedW = isRecordClosed(w);
      var m = orgDir.match(w);
      var rawCoNm = str(w.co_name || w.companyName);
      if (m.companyId) {
        var st = ensureCoStat(m.companyId, rawCoNm, m.org);
        st.counts.works++;
        markStage(st, 'work_payroll', closedW ? 'done' : 'active', 'work');
      }
      if (closedW) return;

      // 기업정부지원금에서 생성된 GA-* 신청 대행 할 일 추적 (govaid in_app 본문 조회 없이 경량 연계)
      if (wid.indexOf('GA-') === 0) {
        if (m.companyId) {
          var stGa = ensureCoStat(m.companyId, rawCoNm, m.org);
          stGa.counts.govaid++;
          markStage(stGa, 'consulting_fund', 'active', 'govaid');
        }
        pushBaton({
          id: 'govaid-ing:' + wid,
          ruleCode: 'govaid_agency_in_progress',
          stage: 'consulting_fund',
          severity: 'normal',
          fromApp: 'govaid',
          toApp: 'work',
          companyId: m.companyId,
          candidateCompanyId: m.candidateId,
          companyLabel: (m.org && m.org.name) || rawCoNm || '지원금 신청 기업',
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          bindCompany: !!(m.companyId || rawCoNm),
          title: '지원금 신청 대행 진행 중 · ' + str(w.title || wid),
          reason: '기업정부지원금에서 넘어온 신청 대행 할 일이 업무관리에서 진행 중입니다',
          actionLabel: '업무관리로 이동',
          ownerSid: extractSid(w) || (m.org && m.org.managerSid) || '',
          targetUrl: 'work.html#item=' + encodeURIComponent(wid)
        });
      }

      var dueMs = parseDateMs(w.dueDate || w.due || w.deadline);
      var dLeft = dueMs ? daysBetween(dueMs, now) : null;
      if (dLeft == null || dLeft > 3) return;
      pushBaton({
        id: 'work-due:' + wid,
        ruleCode: 'work_item_due',
        stage: 'work_payroll',
        severity: dLeft <= 0 ? 'urgent' : 'warn',
        fromApp: 'work',
        toApp: 'work',
        companyId: m.companyId,
        candidateCompanyId: m.candidateId,
        companyLabel: (m.org && m.org.name) || rawCoNm || '내부·일반업무',
        puLabel: (m.org && m.org.puLabel) || '',
        linkConfidence: m.confidence,
        bindCompany: !!(m.companyId || rawCoNm),
        title: '주간 할 일 ' + formatDday(dLeft) + ' · ' + str(w.title || w.content || '업무 항목'),
        reason: '업무관리 할 일 기한이 도래했습니다 — 완료 체크 또는 일정 조정을 진행하세요',
        actionLabel: '할 일 열기',
        ownerSid: extractSid(w) || (m.org && m.org.managerSid) || '',
        dueMs: dueMs,
        ddayLabel: formatDday(dLeft),
        targetUrl: 'work.html#item=' + encodeURIComponent(wid)
      });
    });

    /* 10) 재무·경력·뉴스레터 경량 알림 요약 연동 (재무 원장 본문은 fin_private in_app 원칙에 따라 직접 열지 않음) */
    if (appCanAccess('fin', userCtx)) {
      contracts.forEach(function (ct) {
        if (isRecordClosed(ct)) return;
        var billSt = str(ct.billingStatus || ct.invoiceStatus);
        if (billSt !== 'pending' && billSt !== 'unbilled' && billSt !== '청구대기') return;
        var m = orgDir.match(ct);
        var rawCoNm = str(ct.companyName || ct.company);
        pushBaton({
          id: 'ct-bill:' + str(ct.id),
          ruleCode: 'contract_billing_followup',
          stage: 'finance_settle',
          severity: 'warn',
          fromApp: 'erp',
          toApp: 'fin',
          companyId: m.companyId,
          candidateCompanyId: m.candidateId,
          companyLabel: (m.org && m.org.name) || rawCoNm || '청구 확인 대상',
          puLabel: (m.org && m.org.puLabel) || '',
          linkConfidence: m.confidence,
          bindCompany: !!(m.companyId || rawCoNm),
          title: '확정 계약 청구·입금 확인 대기 · ' + (str(ct.type || ct.contractType || ct.title) || '계약'),
          reason: '계약 원장에 청구 대기 상태가 표시되어 있습니다 — 재무관리 앱 안에서 세금계산서·입금을 확인하세요',
          actionLabel: '재무 청구·입금',
          ownerSid: extractSid(ct) || (m.org && m.org.managerSid) || '',
          targetUrl: 'pu-erp.html?app=fin#menu=fin/invoice'
        });
      });

      if (Number(raw.hanaAlertCount) > 0) {
        pushBaton({
          id: 'fin-hana-alerts',
          ruleCode: 'hana_deposit_alert',
          stage: 'finance_settle',
          severity: 'urgent',
          fromApp: 'fin',
          toApp: 'fin',
          companyId: '',
          companyLabel: '법인 계좌 실시간 알림',
          linkConfidence: 'none',
          bindCompany: false,
          title: '새 계좌 입금 확인 알림 ' + Number(raw.hanaAlertCount) + '건',
          reason: '하나은행·카드 브리지로 수집된 입금 알림의 입금 사업장 확인이 필요합니다',
          actionLabel: '거래내역 확인',
          ownerSid: '',
          targetUrl: 'pu-erp.html?app=fin&hanaAlert=1#menu=fin/ledger'
        });
      }
    }

    var careerMailCnt = Number(raw.mailreqAlarmCount) || Number(raw.careerCounts && raw.careerCounts.mailreqOpen) || 0;
    if (appCanAccess('career', userCtx) && careerMailCnt > 0) {
      pushBaton({
        id: 'career-mailreq',
        ruleCode: 'career_mailreq_alarm',
        stage: 'finance_settle',
        severity: 'urgent',
        fromApp: 'mail',
        toApp: 'career',
        companyId: '',
        companyLabel: '법인 메일함 요청',
        linkConfidence: 'none',
        bindCompany: false,
        title: '경력증명·위촉 동의서 제출 요청 메일 ' + careerMailCnt + '건',
        reason: '메일함에서 감지된 경력·이력서·동의서 제출 요청 건을 경력관리에서 확인하세요',
        actionLabel: '요청 메일 열기',
        ownerSid: userCtx.sid,
        targetUrl: 'kcareer.html?go=mailreq'
      });
    }

    if (Number(raw.newsWarnCount) > 0) {
      pushBaton({
        id: 'news-warn',
        ruleCode: 'newsletter_warning',
        stage: 'finance_settle',
        severity: 'warn',
        fromApp: 'mail',
        toApp: 'news',
        companyId: '',
        companyLabel: '주간 뉴스레터',
        linkConfidence: 'none',
        bindCompany: false,
        title: '뉴스레터 반송·자동화 점검 필요 ' + Number(raw.newsWarnCount) + '건',
        reason: '거래처 이메일 반송 또는 주간 뉴스레터 자동화 상태를 점검해 주세요',
        actionLabel: '뉴스레터 점검',
        ownerSid: '',
        targetUrl: 'pu-news.html'
      });
    }

    /* ── 정렬: 미보류·미확인 우선 ➔ 긴급(urgent:0) ➔ 주의(warn:1) ➔ 일반(normal:2) ➔ 기한 임박 순 ── */
    var sevRank = { urgent: 0, warn: 1, normal: 2 };
    function compareBatons(a, b) {
      var aDone = (a.checked || a.snoozed) ? 1 : 0;
      var bDone = (b.checked || b.snoozed) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      var ra = hasOwn.call(sevRank, a.severity) ? sevRank[a.severity] : 2;
      var rb = hasOwn.call(sevRank, b.severity) ? sevRank[b.severity] : 2;
      if (ra !== rb) return ra - rb;
      if (a.dueMs && b.dueMs && a.dueMs !== b.dueMs) return a.dueMs - b.dueMs;
      if (a.dueMs && !b.dueMs) return -1;
      if (!a.dueMs && b.dueMs) return 1;
      return (b.ageDays || 0) - (a.ageDays || 0);
    }
    batons.sort(compareBatons);

    /* ── 단계별 집계 ── */
    var stageSummary = STAGES.map(function (st) {
      var activeList = batons.filter(function (b) { return b.stage === st.id && !b.checked && !b.snoozed; });
      var urgentCnt = activeList.filter(function (b) { return b.severity === 'urgent'; }).length;
      var warnCnt = activeList.filter(function (b) { return b.severity === 'warn'; }).length;
      return {
        id: st.id,
        no: st.no,
        short: st.short,
        title: st.title,
        desc: st.desc,
        apps: st.apps.slice(),
        total: activeList.length,
        urgent: urgentCnt,
        warn: warnCnt
      };
    });

    /* ── 사업장 360° 흐름판 배열 정리 ── */
    var companyFlows = Object.keys(coStats).map(function (k) {
      var c = coStats[k];
      c.batons.sort(compareBatons);
      var openBatons = c.batons.filter(function (b) { return !b.checked && !b.snoozed; });
      var urgentCnt = openBatons.filter(function (b) { return b.severity === 'urgent'; }).length;
      var appKeys = Object.keys(c.appsInvolved);
      return {
        key: c.key,
        companyId: c.companyId,
        name: maskSensitiveText(c.name),
        puLabel: c.puLabel,
        status: c.status,
        managerSid: c.managerSid,
        managerName: c.managerName || (c.managerSid ? staffDir.nameOf(c.managerSid) : '미배정'),
        counts: c.counts,
        stages: c.stages,
        openBatonCount: openBatons.length,
        urgentBatonCount: urgentCnt,
        topBaton: openBatons[0] || null,
        batons: c.batons,
        appKeys: appKeys
      };
    }).filter(function (c) {
      var totalRecords = c.counts.contracts + c.counts.cases + c.counts.consultings +
        c.counts.funds + c.counts.works + c.counts.rules + c.counts.govaid + c.counts.finance;
      return totalRecords > 0 || c.batons.length > 0 || !!c.companyId;
    }).sort(function (a, b) {
      if (b.urgentBatonCount !== a.urgentBatonCount) return b.urgentBatonCount - a.urgentBatonCount;
      if (b.openBatonCount !== a.openBatonCount) return b.openBatonCount - a.openBatonCount;
      return a.name.localeCompare(b.name, 'ko');
    });

    var activeBatons = batons.filter(function (b) { return !b.checked && !b.snoozed; });

    return {
      readOnly: true,
      sourceMutation: 'never',
      generatedAt: now,
      totals: {
        activeBatons: activeBatons.length,
        urgentBatons: activeBatons.filter(function (b) { return b.severity === 'urgent'; }).length,
        mineBatons: activeBatons.filter(function (b) { return b.isMine; }).length,
        snoozedOrChecked: batons.length - activeBatons.length,
        companies: companyFlows.length,
        diagnostics: diagnostics.length
      },
      stageSummary: stageSummary,
      batons: batons,
      companyFlows: companyFlows,
      diagnostics: diagnostics
    };
  }

  /* ── Ⅶ. 필터링 도우미 (화면 순번 재부여 전처리) ── */
  function filterBatons(batons, filter) {
    filter = filter || {};
    var q = str(filter.q).toLowerCase();
    var stage = str(filter.stage);
    var severity = str(filter.severity);
    var app = str(filter.app);
    var mineOnly = !!filter.mineOnly;
    var showDone = !!filter.showDone;

    return (Array.isArray(batons) ? batons : []).filter(function (b) {
      if (!showDone && (b.checked || b.snoozed)) return false;
      if (mineOnly && !b.isMine) return false;
      if (stage && b.stage !== stage) return false;
      if (severity && b.severity !== severity) return false;
      if (app && b.fromApp !== app && b.toApp !== app) return false;
      if (q) {
        var hay = (b.companyLabel + ' ' + b.puLabel + ' ' + b.title + ' ' + b.reason + ' ' + b.fromName + ' ' + b.toName + ' ' + b.ownerName).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function filterCompanyFlows(flows, filter) {
    filter = filter || {};
    var q = str(filter.q).toLowerCase();
    var stage = str(filter.stage);
    var onlyPending = !!filter.onlyPending;
    var mineSid = str(filter.mineSid);

    return (Array.isArray(flows) ? flows : []).filter(function (c) {
      if (onlyPending && c.openBatonCount === 0) return false;
      if (mineSid && c.managerSid !== mineSid && !c.batons.some(function (b) { return b.ownerSid === mineSid; })) return false;
      if (stage && (!c.stages[stage] || c.stages[stage] === 'idle')) return false;
      if (q) {
        var hay = (c.name + ' ' + c.puLabel + ' ' + c.managerName).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /* ── Ⅷ. 앱 간 세션 바통 패킹·언패킹 (개인 민감정보 비보관 · 필수 계정 바인딩 · 30분 만료) ── */
  function packBaton(baton, nowMs) {
    baton = baton || {};
    var at = Number(nowMs) || Date.now();
    var rawTo = str(baton.toApp).slice(0, 30);
    var safeTo = hasOwn.call(APP_META, rawTo) ? rawTo : '';
    var rawFrom = str(baton.fromApp).slice(0, 30);
    var safeFrom = hasOwn.call(APP_META, rawFrom) ? rawFrom : 'orch';
    var uTag = str(baton.uidTag) || uidTagOf(baton.uid);
    return {
      v: 1,
      at: at,
      expiresAt: at + BATON_TTL_MS,
      uidTag: /^[0-9a-f]{8}$/.test(uTag) ? uTag : '',
      id: str(baton.id).slice(0, 120),
      stage: str(baton.stage || 'intake').slice(0, 40),
      fromApp: safeFrom,
      toApp: safeTo,
      fromName: maskSensitiveText(baton.fromName).slice(0, 40),
      toName: maskSensitiveText(baton.toName).slice(0, 40),
      companyId: str(baton.companyId).slice(0, 80),
      puLabel: str(baton.puLabel).slice(0, 30),
      companyLabel: maskSensitiveText(baton.companyLabel).slice(0, 60),
      title: maskSensitiveText(baton.title).slice(0, 120),
      reason: maskSensitiveText(baton.reason).slice(0, 180),
      returnUrl: safeRelUrl(baton.returnUrl || 'pu-orchestrator.html', 'pu-orchestrator.html')
    };
  }

  function unpackBaton(rawJson, nowMs, expectedUid) {
    if (!rawJson || !str(expectedUid)) return null;
    var obj = rawJson;
    if (typeof rawJson === 'string') {
      try { obj = JSON.parse(rawJson); } catch (_) { return null; }
    }
    if (!obj || typeof obj !== 'object' || obj.v !== 1) return null;
    var now = Number(nowMs) || Date.now();
    var at = Number(obj.at) || 0;
    var exp = Number(obj.expiresAt) || 0;
    if (!at || !exp || now > exp || exp > at + BATON_TTL_MS || now < at - 60000) return null;
    if (!obj.uidTag || str(obj.uidTag) !== uidTagOf(expectedUid)) return null;
    if (obj.toApp && !hasOwn.call(APP_META, str(obj.toApp))) return null;
    return packBaton(obj, at);
  }

  return {
    BATON_STORAGE_KEY: BATON_STORAGE_KEY,
    BATON_TTL_MS: BATON_TTL_MS,
    STAGES: STAGES,
    APP_META: APP_META,
    WORKFLOW_RUNBOOKS: WORKFLOW_RUNBOOKS,
    uidTagOf: uidTagOf,
    normBiz: normBiz,
    normName: normName,
    parsePuBody: parsePuBody,
    formatPuNo: formatPuNo,
    maskSensitiveText: maskSensitiveText,
    safeRelUrl: safeRelUrl,
    appCanAccess: appCanAccess,
    buildStaffDirectory: buildStaffDirectory,
    buildOrgDirectory: buildOrgDirectory,
    analyzeWorkspace: analyzeWorkspace,
    filterBatons: filterBatons,
    filterCompanyFlows: filterCompanyFlows,
    packBaton: packBaton,
    unpackBaton: unpackBaton
  };
});
