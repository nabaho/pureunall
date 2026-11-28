/* 푸른통합시스템 — 전체 컨설팅 통합 카탈로그 · 수습 RAG 플레이북 레지스트리
 * (브라우저 window.PuConsultCatalogs / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 신규 컨설팅 전용 앱 12종(Catalogs A + B)을 하나의 카탈로그로 통합한다.
 *   2. 기존 운영 중인 전용 앱 6종(일터상생혁신·산업일자리전환·안전보건체계구축·괴롭힘조사·기금관리·기업규정집)의
 *      플레이북 요약·메일힌트도 함께 제공하여 수습 노무사 RAG 코치(pu-coach.html)가 전 사업을 포괄하게 한다.
 *   3. ERP 유형명(biz_cons_types) 및 엑셀 사업유형명으로부터 해당 앱 key 를 찾아낸다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var CatA = isNode ? require('./pu-consult-catalogs-a.js') : root.PuConsultCatalogsA;
  var CatB = isNode ? require('./pu-consult-catalogs-b.js') : root.PuConsultCatalogsB;
  var api = factory(CatA, CatB);
  if (isNode) module.exports = api;
  if (root) root.PuConsultCatalogs = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (CatA, CatB) {
  'use strict';

  var NEW_APPS = {};
  if (CatA && CatA.APPS) Object.keys(CatA.APPS).forEach(function (k) { NEW_APPS[k] = CatA.APPS[k]; });
  if (CatB && CatB.APPS) Object.keys(CatB.APPS).forEach(function (k) { NEW_APPS[k] = CatB.APPS[k]; });

  var NEW_APP_KEYS = Object.keys(NEW_APPS);

  var EXISTING_PLAYBOOKS = {
    ilteo: {
      key: 'ilteo',
      rtdbRoot: 'scal_ilteo',
      name: '일터상생혁신',
      shortName: '일터혁신',
      icon: '🏭',
      htmlFile: 'ilteo.html',
      agency: '노사발전재단 · 에프엠어소시에이츠 · KMAC',
      desc: '메일자료·중간·결과보고·PPT 자동화',
      stages: (CatA && CatA.STANDARD_STAGES) || [],
      mailRules: {
        includeRe: /일터\s*혁신|일터\s*상생|상생\s*컨설팅|에프엠어소시에이|노사발전재단.*컨설팅|이행점검확인서/i,
        excludeRe: /세금계산서|주간뉴스레터|광고\)/i
      },
      ragPlaybook: {
        overview: '노사발전재단 일터혁신 상생컨설팅(기초형·심화형)을 수행하며 사전진단·노사협의·임금/평가/근로시간/장시간개선 영역 중간보고서(PPT)·최종결과보고서·사후관리 이행점검까지 진행하는 사업입니다.',
        stageActions: [
          { stageId: 'intake', mustDo: ['착수보고 및 수진기업 노사공동추진팀(TF)·EOS 설문 준비', '심화형/기초형 영역 확정'], checkPoints: ['아카데미 교육 수료증 제출 기한 확인'], deliverables: ['착수계·수행계획서'], cautions: ['원본 급여대장·근태명부는 브라우저 로컬에서만 비식별 집계합니다.'] },
          { stageId: 'design', mustDo: ['7개 섹션 중간보고서 및 발표용 PPTX 작성 후 확정 기준선(midConfirmedAt) 생성'], checkPoints: ['노사 합의·협의회 회의록 및 현장사진 확보'], deliverables: ['중간보고서(.pptx/.hwpx)'], cautions: ['모니터링 수정요청(Red-line) 수신 시 즉시 보완대비표를 남깁니다.'] },
          { stageId: 'final', mustDo: ['최종결과보고서·참여기업 확인서 날인본·사후 3개월 이행점검표 제출'], checkPoints: ['최종 결과물과 플랫폼 입력 문안 일치 여부'], deliverables: ['최종보고서(.pptx)', '통합 산출물 .zip'], cautions: ['종료 후 이행점검 확인서 제출 시점을 잊지 않도록 캘린더에 등록합니다.'] }
        ],
        commonMistakes: [
          '노사대표 면담 사진과 회의록 서명이 빠져 모니터링 보완 요청을 받는 사례',
          '아카데미 교육 수료증·이행점검확인서를 제때 회수하지 못해 잔여 정산이 늦어지는 사례'
        ],
        legalRefs: ['노사발전재단 일터혁신 상생컨설팅 운영지침', '근로기준법·남녀고용평등법·근로자참여법'],
        sampleQA: [
          { q: '일터혁신 중간보고 확정 후 후속 메일이 오면 어떻게 관리하나요?', a: '일터상생혁신 전용 앱(ilteo.html)에서 중간보고 확정 스냅샷을 찍어두면 이후 수신되는 수정요청·협의회신·찬반투표·사진 메일을 ③ 후속메일 Diff 탭에서 자동 비교해 결과보고서에 반영합니다.' }
        ],
        quizzes: []
      }
    },
    jobtrans: {
      key: 'jobtrans',
      rtdbRoot: 'scal_jobtrans',
      name: '산업일자리전환',
      shortName: '산업일자리',
      icon: '⚡',
      htmlFile: 'jobtrans.html',
      agency: '한국능률협회컨설팅(KMAC) · 충남경제진흥원(CEPA)',
      desc: '능률협회·충경진 메일·보고서·HWPX',
      stages: (CatA && CatA.STANDARD_STAGES) || [],
      mailRules: {
        includeRe: /산업\s*일자리|일자리\s*전환|구조\s*혁신|노동\s*전환|석유화학.*컨설팅|정책\s*매니저|한국능률협회컨설팅/i,
        excludeRe: /세금계산서|주간뉴스레터|광고\)/i
      },
      ragPlaybook: {
        overview: 'KMAC 구조혁신지원사업 및 충남경제진흥원(CEPA) 산업일자리전환 컨설팅(석유화학·자동차 등 노동전환 포함)을 기관별 분리 양식(7장/8장)에 맞춰 수행하고 정책매니저 연계지원사업 신청까지 연결하는 사업입니다.',
        stageActions: [
          { stageId: 'intake', mustDo: ['운영기관(KMAC vs 충남경제진흥원) 및 세부 트랙(진단·석탄화력·미래차) 확정', '정책매니저 원천세/윤리서약 서류 등록'], checkPoints: ['두 기관은 보고서 목차·완료계 양식이 완전히 다름'], deliverables: ['착수보고·수행계획서'], cautions: ['3개년 재무·인력·임금 엑셀 원본은 로컬 비식별 통계만 추출합니다.'] },
          { stageId: 'final', mustDo: ['중간/최종보고서·완료계·5종 통합 .zip 및 정책매니저 연계지원 신청서(사업주 직업능력개발훈련 등) 제출'], checkPoints: ['인터뷰 수당확인서·설문지 회수 여부'], deliverables: ['기관맞춤 최종보고서', '완료계(.hwpx)'], cautions: ['인터뷰 수당확인서 서명과 설문지 회수 누락 시 검수가 보류됩니다.'] }
        ],
        commonMistakes: [
          'KMAC 양식과 충남경제진흥원 양식을 혼용해 제출하는 실수',
          '정책매니저 수당지급 서류·인터뷰 수당확인서 마감 기한을 놓치는 실수'
        ],
        legalRefs: ['산업전환에 따른 고용안정 지원 등에 관한 법률', 'KMAC·충남경제진흥원 사업 운영매뉴얼'],
        sampleQA: [
          { q: '정책매니저 연계지원사업 신청서는 언제 어떻게 내나요?', a: '산업일자리전환 컨설팅 중간~최종 단계에서 기업의 훈련·지원금 수요를 발굴해 [산업일자리전환 지원금 신청서] 및 [사업주 직업능력개발훈련 신청서]를 함께 제출합니다.' }
        ],
        quizzes: []
      }
    },
    safety: {
      key: 'safety',
      rtdbRoot: 'scal_safety',
      name: '안전보건체계구축',
      shortName: '안전보건',
      icon: '🦺',
      htmlFile: 'safety.html',
      agency: '안전보건공단 · 자체 중대재해 컨설팅',
      desc: '과거이력·업종별체크·위험성·HWPX',
      stages: (CatA && CatA.STANDARD_STAGES) || [],
      mailRules: {
        includeRe: /안전보건\s*관리\s*체계|안전보건\s*체계|안전보건\s*컨설팅|위험성\s*평가|중대재해.*(?:컨설팅|체계|구축|이행|점검)|산업안전\s*컨설팅/i,
        excludeRe: /요양\s*급여|유족\s*급여|장해\s*급여|질병\s*판정|산재\s*심사|세금계산서|광고\)/i
      },
      ragPlaybook: {
        overview: '안전보건공단 안전보건관리체계 구축(제조 일반·고위험 특화·기타업종) 및 민간 중대재해처벌법 이행점검·위험성평가 컨설팅을 수행하며, 7대 핵심요소(25문항)·8대 업종 특화·고위험 기인물 24종 점검 후 7장 종합보고서와 1P 요약보고서를 산출합니다.',
        stageActions: [
          { stageId: 'intake', mustDo: ['상시근로자 규모(5인·20인·50인)별 법적 의무 판별 및 사전 체크 12항목 확인'], checkPoints: ['개별 산재보상 사건과 안전보건체계구축 컨설팅 명확히 구분'], deliverables: ['규모별 의무 진단표'], cautions: ['공단 사업은 1·2회차 2인 1조 및 CEO 면담 2회·14일 이상 간격 기준을 반드시 준수해야 합니다.'] },
          { stageId: 'final', mustDo: ['사업주 강평용 핵심 개선사항 1P 요약보고서 + 7장 종합보고서(.hwpx/.zip) 교부'], checkPoints: ['위험성평가 감소대책 및 CEO 면담 기록 포함 여부'], deliverables: ['1P 요약보고서', '종합보고서(.hwpx)'], cautions: ['고위험 기인물(지게차·크레인·프레스·사다리 등) 사진/개선전후가 빠지면 실효성이 떨어집니다.'] }
        ],
        commonMistakes: [
          '2인 1조 방문이나 CEO 면담 2회, 회차 간 14일 간격 등 공단 수행기준을 어겨 정산 감액되는 사례',
          '개별 근로자 산재보상 사건 메일을 안전보건체계구축 컨설팅으로 섞어 넣는 실수'
        ],
        legalRefs: ['중대재해 처벌 등에 관한 법률 제4~5조', '산업안전보건법 제36조(위험성평가)', '고용노동부·안전보건공단 7대 핵심요소 OPL 기준'],
        sampleQA: [
          { q: '2026 공단 안전보건체계구축 컨설팅의 핵심 수행기준 3가지는?', a: '① 1·2회차 2인 1조 현장 방문, ② 사업주(CEO) 면담 2회 이상(착수+강평), ③ 회차 간 적정 간격(통상 14일 이상) 및 마지막 회차 1P 핵심 개선요약보고서 교부입니다.' }
        ],
        quizzes: []
      }
    },
    harass: {
      key: 'harass',
      rtdbRoot: 'harass_invest',
      name: '괴롭힘·성희롱 조사',
      shortName: '괴롭힘조사',
      icon: '🛡️',
      htmlFile: 'pu-harass.html',
      agency: '푸른노무법인 (객관적 사실조사 · 외부조사)',
      desc: '사건조사·메일수집·보고서',
      stages: (CatA && CatA.STANDARD_STAGES) || [],
      mailRules: {
        includeRe: /직장\s*내\s*괴롭힘|성희롱.*조사|성폭력.*조사|객관적?\s*조사|사실\s*조사|외부\s*조사|고충\s*조사/i,
        excludeRe: /예방\s*교육\s*강의|세금계산서|광고\)/i
      },
      ragPlaybook: {
        overview: '근로기준법 제76조의3에 따른 직장 내 괴롭힘·성희롱 사건의 객관적 외부 사실조사(8단계 프로토콜, 비밀유지 전자서명, 문답서·3요건 검토, 조사결과보고서)를 비밀금고(harass_secret) 분리 환경에서 수행합니다.',
        stageActions: [
          { stageId: 'intake', mustDo: ['착수공문·위임계약 체결 및 이해충돌(기존 자문사 내 중립성) 고지'], checkPoints: ['신고인·피신고인 분리조치 및 2차 가해 예방 안내'], deliverables: ['착수 안내 공문', '분리조치 권고'], cautions: ['근기법 제76조의3 제7항 비밀누설 금지 의무에 따라 사건 진술은 담당자·대표 외 절대 공유 금지!'] },
          { stageId: 'visit', mustDo: ['당사자·참고인 면담 전 sign-harass.html 비밀유지서약 전자서명 완료 및 녹취·문답서 확인'], checkPoints: ['피해자·행위자·참고인 대면 시간 겹치지 않게 동선 분리'], deliverables: ['비밀유지서약서', '진술확인서'], cautions: ['조사자가 예단을 드러내는 유도신문을 하지 않도록 객관적 사실관계(일시·장소·목격자·증빙) 중심으로 질문합니다.'] },
          { stageId: 'final', mustDo: ['행위 요건(지위/관계 우위 · 업무상 적정범위 초과 · 신체/정신적 고통 또는 근무환경 악화) 포섭 및 조사결과보고서(.hwpx) 납품'], checkPoints: ['인사/징계위원회 후속절차 분리 권고'], deliverables: ['조사결과보고서(.hwpx)'], cautions: ['조사보고서는 "사실 인정 및 법적 요건 성립 여부"를 판단하고, 징계 양정은 인사·징계위원회 몫임을 구분합니다.'] }
        ],
        commonMistakes: [
          '조사 시작 시 피해자·행위자 동선 분리를 권고하지 않아 2차 가해 민원이 발생하는 사례',
          '단순 업무지시와 괴롭힘(업무상 적정범위 초과)의 3요건 논증을 빠뜨리고 결론만 적는 실수'
        ],
        legalRefs: ['근로기준법 제76조의2, 제76조의3(객관적 조사·비밀유지 의무)', '남녀고용평등법 제14조(직장 내 성희롱 발생 시 조치)'],
        sampleQA: [
          { q: '직장 내 괴롭힘 성립 3요건은 무엇인가요?', a: '① 직장에서의 지위 또는 관계 등의 우위를 이용할 것, ② 업무상 적정범위를 넘을 것, ③ 다른 근로자에게 신체적·정신적 고통을 주거나 근무환경을 악화시키는 행위일 것 — 3가지가 모두 충족되어야 합니다.' }
        ],
        quizzes: []
      }
    },
    fund: {
      key: 'fund',
      rtdbRoot: 'fund_erp',
      name: '기금관리',
      shortName: '기금관리',
      icon: '🪙',
      htmlFile: 'fund.html',
      agency: '푸른노무법인 (사내·공동근로복지기금)',
      desc: '근로복지기금 운영',
      stages: (CatA && CatA.STANDARD_STAGES) || [],
      mailRules: {
        includeRe: /근로\s*복지\s*기금|공동\s*기금|사내\s*기금|기금\s*법인|기금\s*설립|운영상황\s*보고서/i,
        excludeRe: /세금계산서|광고\)/i
      },
      ragPlaybook: {
        overview: '사내근로복지기금 및 (지역)공동근로복지기금의 설립 인가, 정관·복지기금협의회 구성, 출연금·국고지원금 신청, 회계결산 및 매년 3월 말 운영상황보고서 제출까지 전 과정을 수행하는 전문 사업입니다.',
        stageActions: [
          { stageId: 'intake', mustDo: ['출연 회사(`puerp_co_id`)와 기금법인은 별도 법인격이므로 온톨로지 `fundedBy` 관계로 분리 등록'], checkPoints: ['공동근로복지기금 참여 중소기업 요건 및 지자체/공단 지원사업 공고 확인'], deliverables: ['설립준비위원회 서류', '정관안'], cautions: ['회사 계좌와 기금 계좌의 혼합 집행은 법령 위반입니다.'] },
          { stageId: 'final', mustDo: ['고용노동청 설립인가/변경신고, 국세청 비영리법인 고유번호증, 매년 3월 31일 운영상황보고서 제출'], checkPoints: ['기본재산 vs 사용가능 재원(당기출연금 50%/80% 등) 한도 준수'], deliverables: ['운영상황보고서', '기금결산서'], cautions: ['법정기한(결산 종료 후 3개월 이내 운영상황보고서) 경과 시 과태료 대상입니다.'] }
        ],
        commonMistakes: ['출연 회사와 기금법인을 같은 사업장으로 합쳐 입력하는 실수', '기본재산에서 목적사업비를 직접 지출해 시정명령을 받는 실수'],
        legalRefs: ['근로복지기본법 제50조~제86조', '고용노동부 사내·공동근로복지기금 업무처리지침(예규)'],
        sampleQA: [],
        quizzes: []
      }
    },
    rules: {
      key: 'rules',
      rtdbRoot: 'rules_mgmt',
      name: '기업규정집',
      shortName: '기업규정집',
      icon: '📜',
      htmlFile: 'rules-v2.html',
      agency: '푸른노무법인 (취업규칙·노사협의회·단협)',
      desc: '취업규칙·노사협의회·단체협약',
      stages: (CatA && CatA.STANDARD_STAGES) || [],
      mailRules: {
        includeRe: /취업\s*규칙|인사\s*규정|복무\s*규정|보수\s*규정|신구\s*조문|신구\s*대비|취업규칙\s*변경/i,
        excludeRe: /세금계산서|광고\)/i
      },
      ragPlaybook: {
        overview: '상시근로자 10인 이상 사업장의 취업규칙 제·개정, 92개 검토기준 및 법령조문 연계 분석, 신구조문대비표 작성, 과반수 의견청취·불이익변경 동의서 및 고용노동청 신고 필증까지 관리하는 앱입니다.',
        stageActions: [
          { stageId: 'intake', mustDo: ['상시 10인 이상 여부 및 기존 신고본(노동청 접수본) 유무 확인'], checkPoints: ['개정 전 기존 취업규칙 원본을 `rules_mgmt/orig`에 먼저 보존'], deliverables: ['기존규정 원본'], cautions: ['회차별로 최종본 1개를 확정해야 다음 개정 시 비교기준이 깨지지 않습니다.'] },
          { stageId: 'design', mustDo: ['92개 법적 검토기준(육아지원3법·통상임금·직괴·해고·연차) 대조 및 불이익변경 여부 판정'], checkPoints: ['불이익 조항 1개라도 있으면 근로자 과반수 집단적 동의 필수'], deliverables: ['신구조문대비표', '동의서/의견서'], cautions: ['신고 시 취업규칙(전문), 신구조문대비표, 동의서(또는 의견서), 근로자명부/과반수 입증자료를 함께 제출합니다.'] }
        ],
        commonMistakes: ['불이익변경이 포함된 규정을 의견청취만 받고 신고해 노동청에서 보완/반려되는 사례'],
        legalRefs: ['근로기준법 제93조~제96조', '대법원 취업규칙 불이익변경 사회통념상 합리성 제한 판례(2017다261388 전원합의체)'],
        sampleQA: [],
        quizzes: []
      }
    }
  };

  function get(key) {
    var k = String(key || '').trim();
    return NEW_APPS[k] || EXISTING_PLAYBOOKS[k] || null;
  }

  function listNew12() {
    return NEW_APP_KEYS.map(function (k) { return NEW_APPS[k]; });
  }

  function listAll() {
    return NEW_APP_KEYS.map(function (k) { return NEW_APPS[k]; })
      .concat(Object.keys(EXISTING_PLAYBOOKS).map(function (k) { return EXISTING_PLAYBOOKS[k]; }));
  }

  function getAllWithExisting() {
    var out = {};
    NEW_APP_KEYS.forEach(function (k) { out[k] = NEW_APPS[k]; });
    Object.keys(EXISTING_PLAYBOOKS).forEach(function (k) { out[k] = EXISTING_PLAYBOOKS[k]; });
    return out;
  }

  function findByErpType(typeText) {
    var s = String(typeText || '').replace(/\s+/g, '');
    if (!s) return '';
    for (var i = 0; i < NEW_APP_KEYS.length; i++) {
      var k = NEW_APP_KEYS[i];
      var kws = NEW_APPS[k].erpTypeKeywords || [];
      for (var j = 0; j < kws.length; j++) {
        if (s.indexOf(String(kws[j]).replace(/\s+/g, '')) >= 0) return k;
      }
    }
    return '';
  }

  function findByExcelType(typeText) {
    var s = String(typeText || '').replace(/\s+/g, '');
    if (!s) return '';
    for (var i = 0; i < NEW_APP_KEYS.length; i++) {
      var k = NEW_APP_KEYS[i];
      var kws = NEW_APPS[k].excelTypeKeywords || [];
      for (var j = 0; j < kws.length; j++) {
        if (s.indexOf(String(kws[j]).replace(/\s+/g, '')) >= 0) return k;
      }
    }
    return '';
  }

  return {
    STANDARD_STAGES: (CatA && CatA.STANDARD_STAGES) || [],
    NEW_APPS: NEW_APPS,
    NEW_APP_KEYS: NEW_APP_KEYS,
    EXISTING_PLAYBOOKS: EXISTING_PLAYBOOKS,
    ALL_KEYS: NEW_APP_KEYS.concat(Object.keys(EXISTING_PLAYBOOKS)),
    get: get,
    listNew12: listNew12,
    listAll: listAll,
    getAllWithExisting: getAllWithExisting,
    findByErpType: findByErpType,
    findByExcelType: findByExcelType
  };
});
