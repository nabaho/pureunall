/* ══ 계약서 양식 — 문서관리 › 사무관리서류 › 계약서 양식 (대표 지시 2026-09-26) ══
   「환경설정 계약서 양식에 계약서 서식이 있다 이부분 그대로 빼서 문서관리에 넣어 줄수 있나
    제목은 사무관리서류 로해서 하위에 계약서 양식을 별도로 두는것이다」 → 「칸을없앤다」

   ■ 누가 무엇을 쓰나
     · 문서관리(docs-esign.html) — 양식을 «고치는» 유일한 화면이다(mount).
     · 푸른이알피(pu-erp.html)   — 「📄 계약서 출력」이 양식을 «읽는다»(SEED·mergeSeeds).
     이알피 환경설정 › 사무관리기준 › 「계약서 양식」 칸은 2026-09-26 에 없앴다.

   ■ 자료는 옮기지 않았다 — data/contract_forms 그대로다
     ⚠ 이 표는 이알피가 «통째로» 저장하는 표다({v:[…], u:시각}, 건별 저장 아님).
       그래서 여기서는 늘 서버 최신본을 거래(transaction)로 받아 «그 위에» 한 건만 고쳐
       올린다 — 들고 있던 사본을 통째로 밀면 그사이 이알피가 넣은 기본 양식을 지운다.
     ⚠ u 를 올려야 이알피가 새것을 받는다 — 이알피는 u 가 자기 기준보다 새것이면
       덮어쓰지 않고 서버 것을 받는다(되돌림 방지). 그래서 u 는 «늘 커지게» 적는다.
     ⚠ 기본(시드) 양식을 지우면 data/contract_forms_removed 에 번호를 남긴다 —
       안 남기면 이알피가 다음에 열 때 「빠진 기본 양식」이라며 도로 넣는다.

   ■ 글자 뽑기는 «공용 읽개» 하나 — hwp_extract.js 의 extractDocText
     (tests/erp-template-text.test.js — 2026-09-12 에 알피만 제 읽개를 들고 있다가
      같은 파일이 화면마다 다르게 읽혔다. 옮겨 와도 두 벌을 만들지 않는다.) */
(function (w) {
  'use strict';

  /* 계약 종류 — 이알피 CONTRACT_KINDS 와 «같은 순서·같은 이름»이어야 한다
     (tests/docs-office-forms.test.js 가 견준다). 여기는 화면에 쓰는 것만 둔다. */
  var KINDS = [
    { v:'consult',    label:'상담사항',   icon:'📞', color:'#dc2626' },
    { v:'company',    label:'업체계약',   icon:'🏢', color:'#d97706' },
    { v:'case',       label:'사건계약',   icon:'⚖️', color:'#2563eb' },
    { v:'consulting', label:'컨설팅계약', icon:'📊', color:'#2563eb' },
    { v:'fund',       label:'기금관리',   icon:'🏦', color:'#d97706' },
    { v:'other',      label:'기타사업',   icon:'📋', color:'#16a34a' }
  ];

  /* ── 칸 목록·기본 양식 (2026-09-26 이알피에서 그대로 옮겨 왔다) ── */
  var CONTRACT_FORM_VARS = [
    { code:'{{회사명}}',     desc:'의뢰인 회사명' },
    { code:'{{사업자번호}}', desc:'사업자등록번호' },
    { code:'{{대표자}}',     desc:'대표자명' },
    { code:'{{주소}}',       desc:'사업장 주소' },
    { code:'{{우편번호}}',   desc:'사업장 우편번호' },
    { code:'{{대표전화}}',   desc:'대표 전화번호' },
    { code:'{{대표팩스}}',   desc:'대표 팩스번호' },
    { code:'{{대표이메일}}', desc:'대표 이메일' },
    { code:'{{업태}}',       desc:'업태' },
    { code:'{{종목}}',       desc:'종목' },
    { code:'{{규모}}',       desc:'규모 (소기업/중기업/중견기업/대기업)' },
    { code:'{{고용가입자수}}',desc:'고용보험 가입자수' },
    { code:'{{산재가입자수}}',desc:'산재보험 가입자수' },
    { code:'{{담당자}}',     desc:'기업 주담당자명' },
    { code:'{{담당자연락처}}',desc:'기업 주담당자 연락처' },
    { code:'{{담당자이메일}}',desc:'기업 주담당자 이메일' },
    { code:'{{계약번호}}',   desc:'계약번호' },
    { code:'{{계약일}}',     desc:'계약일' },
    { code:'{{계약시작일}}', desc:'계약 시작일 (자문/컨설팅)' },
    { code:'{{계약종료일}}', desc:'계약 종료일 (자문/컨설팅)' },
    { code:'{{계약기간}}',   desc:'계약 기간 (시작일~종료일)' },
    { code:'{{부가세처리}}', desc:'부가세 별도/포함' },
    { code:'{{납부일}}',     desc:'자문료 납부일/출금일 (예: 15일/말일)' },
    { code:'{{국민연금관리번호}}', desc:'국민연금 사업장가입자번호' },
    { code:'{{건강보험번호}}', desc:'건강보험 증번호' },
    { code:'{{고용보험번호}}', desc:'고용보험 피보험자번호' },
    { code:'{{산재관리번호}}', desc:'산재보험 관리번호' },
    { code:'{{법인등록번호}}', desc:'법인등록번호 (업체관리)' },
    { code:'{{대표생년월일}}', desc:'대표자 생년월일 (업체관리)' },
    { code:'{{대표자전체}}',   desc:'대표자 전체 (대표1, 대표2 자동결합)' },
    { code:'{{대표주민번호}}', desc:'대표 주민번호 앞7자리+마스킹 (생년월일+성별)' },
    { code:'{{계약금액}}',   desc:'계약금액 (콤마 포함)' },
    { code:'{{계약금액한글}}', desc:'계약금액 한글 표기 (예: 일백만)' },
    { code:'{{성공보수}}',   desc:'성공보수 (정액/정률)' },
    { code:'{{주담당}}',     desc:'노무사 주담당' },
    { code:'{{부담당}}',     desc:'노무사 부담당' },
    { code:'{{오늘날짜}}',   desc:'오늘 날짜 (YYYY-MM-DD)' },
    // 의뢰인(근로자) 변수
    { code:'{{근로자수}}',     desc:'의뢰인(근로자) 인원 수' },
    { code:'{{근로자이름}}',   desc:'대표 의뢰인 이름' },
    { code:'{{근로자명단}}',   desc:'전체 근로자 이름 (콤마)' },
    { code:'{{근로자주민}}',   desc:'대표 의뢰인 주민번호 (마스킹)' },
    { code:'{{근로자주소}}',   desc:'대표 의뢰인 주소' },
    { code:'{{근로자연락처}}', desc:'대표 의뢰인 연락처' },
    { code:'{{근로자상세}}',   desc:'전체 근로자 상세 (이름·주소·연락처 줄바꿈)' }
  ];

  // 시드 데이터: 6종 × 1개씩 기본 양식
  var CONTRACT_FORM_SEED = [
    { id:'fm-1', kind:'consult', name:'기본 상담확인서',
      body:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n            상 담 확 인 서\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n■ 상담일: {{계약일}}\n■ 의뢰인: {{회사명}} (사업자번호: {{사업자번호}})\n■ 대표자: {{대표자}}\n■ 담당자: {{담당자}} ({{담당자연락처}})\n\n[상담내용]\n\n\n[자문 결과]\n\n\n2026.   .   .\n\n푸른노무법인\n담당노무사: {{주담당}} (인)\n',
      attachments:[], enabled:true, createdAt:'2026-04-01' },
    { id:'fm-2', kind:'company', name:'업체 자문계약서 (월정액)',
      body:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n          노무자문 위탁계약서\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n계약번호: {{계약번호}}\n\n위임인 (이하 "갑")\n   회사명: {{회사명}}\n   사업자번호: {{사업자번호}}\n   대표자: {{대표자}}\n   주소: {{주소}}\n\n수임인 (이하 "을")\n   상호: 푸른노무법인\n   대표자: 권형하 노무사\n   주소: 충남 천안시 동남구\n\n제1조 (목적)\n   "갑"은 "을"에게 노무관리 자문을 위탁하고, "을"은 이를 수임한다.\n\n제2조 (자문료)\n   월 자문료: 금 {{계약금액}}원 (부가세 별도)\n\n제3조 (계약기간)\n   {{계약일}} 부터 1년간\n\n제4조 (담당)\n   주담당 노무사: {{주담당}}\n   부담당: {{부담당}}\n\n2026.   .   .\n\n갑: {{회사명}}  대표자 {{대표자}} (인)\n을: 푸른노무법인  대표자 권형하 (인)\n',
      attachments:[], enabled:true, createdAt:'2026-04-01' },
    { id:'fm-3', kind:'case', name:'사건위임계약서 (부당해고)',
      body:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n             사건위임계약서\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n사건번호: {{계약번호}}\n\n위임인: {{회사명}} (대표 {{대표자}})\n수임인: 푸른노무법인 (대표 권형하)\n\n제1조 (위임사건)\n   {{회사명}}에 관한 노동사건 일체\n\n제2조 (보수)\n   1. 착수금: 금 {{계약금액}}원 (부가세 별도)\n   2. 성공보수: {{성공보수}}\n\n제3조 (수임담당)\n   주담당노무사: {{주담당}}\n   부담당노무사: {{부담당}}\n\n제4조 (계약일)\n   {{계약일}}\n\n2026.   .   .\n\n위임인: {{회사명}}  대표자 {{대표자}} (인)\n수임인: 푸른노무법인  대표자 권형하 (인)\n',
      attachments:[], enabled:true, createdAt:'2026-04-01' },
    { id:'fm-4', kind:'consulting', name:'컨설팅 위탁계약서',
      body:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n           컨설팅 위탁계약서\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n계약번호: {{계약번호}}\n\n위탁자: {{회사명}} (대표 {{대표자}})\n   소재지: {{주소}}\n   고용가입자: {{고용가입자수}}명 / 산재가입자: {{산재가입자수}}명\n\n수탁자: 푸른노무법인 (대표 권형하)\n\n제1조 (컨설팅 내용)\n   인사노무 컨설팅 일체\n\n제2조 (계약금액)\n   금 {{계약금액}}원 (부가세 별도)\n\n제3조 (수임담당)\n   주담당: {{주담당}}\n\n제4조 (계약기간)\n   {{계약일}} 부터 1년간\n\n2026.   .   .\n\n위탁자: {{회사명}}  대표자 {{대표자}} (인)\n수탁자: 푸른노무법인  대표자 권형하 (인)\n',
      attachments:[], enabled:true, createdAt:'2026-04-01' },
    { id:'fm-5', kind:'fund', name:'공동근로복지기금 설립지원 계약서',
      body:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n     공동근로복지기금 설립지원 계약서\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n계약번호: {{계약번호}}\n\n위임인: {{회사명}} (대표 {{대표자}})\n수임인: 푸른노무법인\n\n제1조 (목적)\n   {{회사명}} 공동근로복지기금 설립인가 신청 및 운영 컨설팅\n\n제2조 (수임료)\n   금 {{계약금액}}원 (부가세 별도)\n\n제3조 (담당)\n   주담당노무사: {{주담당}}\n\n2026.   .   .\n\n위임인: {{회사명}} 대표자 {{대표자}} (인)\n수임인: 푸른노무법인 대표자 권형하 (인)\n',
      attachments:[], enabled:true, createdAt:'2026-04-01' },
    { id:'fm-6', kind:'other', name:'기타사업 (강의·교육) 계약서',
      body:'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n           강의(교육) 위탁계약서\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n계약번호: {{계약번호}}\n\n위탁자: {{회사명}} (대표 {{대표자}})\n수탁자: 푸른노무법인\n\n제1조 (강의내용)\n\n\n제2조 (강의료)\n   금 {{계약금액}}원 (부가세 별도)\n\n제3조 (담당강사)\n   {{주담당}}\n\n제4조 (강의일)\n   {{계약일}}\n\n2026.   .   .\n\n위탁자: {{회사명}} 대표자 {{대표자}} (인)\n수탁자: 푸른노무법인 대표자 권형하 (인)\n',
      attachments:[], enabled:true, createdAt:'2026-04-01' },
    // ── 푸른노무법인 표준 양식 6종 (업체계약용) ──
    { id:'fm-pr-advisory', kind:'company', name:'자문계약서 (푸른 표준)',
      body:'                    자  문  계  약  서\n\n                                                     계약번호: {{계약번호}}\n\n   {{회사명}} (이하 "갑"이라 한다)과 푸른노무법인 (이하 "을"이라 한다)은\n   인사노무관리에 대하여 다음과 같이 자문계약을 체결한다.\n\n제1조 【계약의 성립】\n   갑은 을을 노무자문으로 위촉하고 노동관계법령 및 노사관계업무에 관한\n   지도, 상담 등의 사무를 위임하고, 을은 이를 신의와 성실로 공정하게\n   수행할 것을 승낙함으로써 본 계약은 성립한다.\n\n제2조 【자문보수】\n   ① 갑은 을에게 월 자문수수료 매월 금 {{계약금액}}원 (부가세 포함)을\n      지불한다.\n   ② 갑은 전항의 자문수수료를 월별로 해당 월의 자문료를 매월 ____일까지\n      지급한다.\n\n제3조 【특약보수】\n   ① 위임사무와 관련하여 실태조사, 자료수집 등 특별한 연구 및 서비스를\n      요하는 경우 또는 교육훈련을 행하는 경우에는 을은 자문보수 외 별도\n      보수를 청구할 수 있다.\n   ② 보수기준과 청구범위는 갑과 을이 상호 협의하여 정한다.\n\n제4조 【자료제공】\n   갑은 을이 위임사무를 처리하는데 필요한 자료에 적극 조력하며, 을은\n   갑이 제시한 자료의 범위 내에서 책임진다.\n\n제5조 【비밀엄수】\n   을은 본 계약기간 중 또는 만료 후라도 업무와 관련된 갑의 비밀을 정당한\n   이유 없이 타인에게 누설하지 않는다.\n\n제6조 【계약기간】\n   본 계약의 기간은 {{계약시작일}} 부터 {{계약종료일}} 까지 1년으로 하며\n   계약 만료일 1개월 전까지 명시적 의사 표시를 하지 않는 한 본 계약은\n   자동 연장되는 것으로 본다.\n\n제7조 【기한이익의 상실】\n   ① 갑이 임의로 계약을 해지하거나, 계약내용을 위반한 사무를 처리한 때에는\n      기한이익은 상실한다.\n   ② 전항에 의하여 기한이익이 상실된 경우 갑은 기 지불된 보수의 반환을\n      청구할 수 없으며, 계약기간까지의 자문보수도 을이 청구하면 지불한다.\n\n제8조 【기타】\n   ① 본 계약에 명시되지 아니한 사항은 일반관례에 따라 갑과 을이 상호\n      협의하여 결정한다.\n   ② 상기 사항을 증명하기 위하여 본 계약서 2통을 작성하여 각 1통씩 보관한다.\n\n   ※ 입금계좌: 하나은행 680-910005-45904 [푸른노무법인]\n\n                              {{계약일}}\n\n   갑   사업체명: {{회사명}}\n        주    소: {{주소}}\n        대 표 자: {{대표자}}                              (인)\n\n   을   사업소명: 푸른노무법인\n        주    소: 충남 천안시 서북구 원두정8길 6, 두정빌딩 3층\n        대 표 자: 권 형 하                              (인)\n',
      attachments:[], enabled:true, createdAt:'2026-05-08' },
    { id:'fm-pr-payroll', kind:'company', name:'급여관리업무 위임계약서 (푸른 표준)',
      body:'                급여관리업무 위임계약서\n\n                                                     계약번호: {{계약번호}}\n\n   {{회사명}} (이하 "갑"이라 한다)과 푸른노무법인 (이하 "을"이라 한다)은\n   민법 제680조에 의해 아래와 같이 위임계약을 체결하고 성실히 이행할 것을\n   약정한다.\n\n                          - 아 래 -\n\n제1조 【위임사무】\n   ① 갑은 을에게 갑의 회사 내 근로자의 급여관리업무를 위임한다.\n   ② 제1항의 급여관리업무란 갑의 급여대장 관리업무이다.\n   ③ 제1항의 급여관리업무에는 4대보험업무를 포함한다. 단, 을이 보험사무\n      대행기관 자격으로 수행할 수 없는 업무는 위임사무에서 제외한다.\n   ④ 제3항의 급여관리업무에는 {{회사명}}을(를) 포함한 부속사업장의 업무도\n      포함한다.\n\n제2조 【보수】\n   ① 갑은 을에게 제1조에서 정한 위임사무에 대한 보수로 매월 금 {{계약금액}}원\n      (부가세 포함)을 지불한다.\n   ② 갑은 을의 계좌로 제1항에 따른 비용을 지급하되, 지급일은 매월 ____일로\n      한다.\n   ③ 제1항의 월 보수액은 갑의 상시 근로자 수 및 사업장의 상황 등에 따라\n      계약기간 도중 혹은 연장시점에 인상될 수 있다. 인상 보수액은 갑과 을이\n      상호 합의하여 결정한다.\n\n제3조 【비용】\n   제1항의 위임사무를 처리하는데 있어서 특별히 소요되는 기타경비는 을이\n   부담한다.\n\n제4조 【자료제출 및 편의제공】\n   ① 갑은 위임사무를 원활히 수행하는데 필요한 각종 자료의 제출요구에 적극\n      조력하여야 하며 을은 갑이 제시한 자료에 따라 위임사무를 처리한다.\n   ② 갑은 위임사무의 원활한 수행에 필요한 시설물의 이용, 사무기기의 사용\n      등에 협조하여야 한다.\n\n제5조 【자료의 보관】\n   갑이 사무 처리를 위하여 제공한 서류와 자료는 위임사무가 종료된 때 갑의\n   요청에 의해 반환하는 것을 원칙으로 하고 반환요청이 없는 경우 을은 3년이\n   경과한 때 이를 폐기할 수 있다.\n\n제6조 【계약기간】\n   ① 위임사무를 수행하는 계약기간은 {{계약시작일}} 부터 {{계약종료일}} 까지로 한다.\n   ② 갑과 을 중 어느 일방이 계약기간 만료 전 1개월 이내에 본 계약과 관련하여\n      이의를 제기하지 아니하는 경우에는 동일 조건으로 1년간 계약을 연장하는\n      것으로 간주한다.\n\n제7조 【계약의 해지】\n   갑과 을이 본 약정서에 정한 의무를 이행하지 않을 때와 갑이 제공한 자료나\n   진술한 사항이 허위인 경우 또는 을이 위임사무를 고의로 지연시킨 경우에는\n   일방이 본 계약을 해지할 수 있다.\n\n제8조 【비밀 준수】\n   을은 위임사무를 통하여 지득한 갑의 비밀을 준수하여야 한다.\n\n제9조 【특약사항】\n   제2조 제2항에 명시한 업무 외의 노무관리업무로서 노동위원회 사건, 노동부\n   진정사건, 업무상 재해 등의 사건처리와 별도의 방문상담이 필요한 업무처리의\n   경우에는 갑은 을에게 별도의 비용을 지불한다.\n\n   본 약정의 성립을 증명하기 위하여 약정서 2부를 작성하여 서명 날인하여\n   계약당사자가 각각 1부씩 보관한다.\n\n                              {{계약일}}\n\n   갑   대 표 자: {{대표자}}        을   대 표 자: 권 형 하\n        주    소: {{주소}}              주    소: 충남 천안시 서북구\n                                                  원두정8길 6, 301호\n        업 체 명: {{회사명}} (인)        업 체 명: 푸른노무법인 (인)\n',
      attachments:[], enabled:true, createdAt:'2026-05-08' },
    { id:'fm-pr-pension', kind:'company', name:'국민연금 EDI 업무대행 신청서 (푸른 표준)',
      body:'              국민연금 웹 EDI 업무대행 신청서\n\n                                                     계약번호: {{계약번호}}\n\n   접수번호: ______________   접수일: ______________   처리기간: 즉시\n\n┌─────────────────────────────────────────────┐\n│ [업무대행기관]                                              │\n│  사업장관리번호: 312-81-52792-0                            │\n│  사업장 명칭   : 푸른노무법인                              │\n│  소 재 지      : 충청남도 천안시 서북구 원두정8길 6, 3층  │\n│  사업자등록번호: 312-81-52792                              │\n│  법인등록번호  : 161571-0000304                            │\n│  사    용    자: 권 형 하  (생년월일: 1975.01.07)         │\n└─────────────────────────────────────────────┘\n\n┌─────────────────────────────────────────────┐\n│ [위탁사업장]                                                │\n│  사업장관리번호: {{사업자번호}}                            │\n│  사업장 명칭   : {{회사명}}                                │\n│  소 재 지      : {{주소}}                                  │\n│  사업자등록번호: {{사업자번호}}                            │\n│  법인등록번호  : ____________________                      │\n│  사    용    자: {{대표자}}  (생년월일: ______________)   │\n└─────────────────────────────────────────────┘\n\n[업무위탁 범위]\n   ▪ 자격의 취득 및 상실 신고\n   ▪ 내용변경 신고\n   ▪ 기준소득월액 변경 등 신고\n   ▪ 신고서 처리결과 및 보험료결정내역 확인\n\n   ※ 증명서 발급에 관한 사항은 업무대행 범위에 포함되지 않음\n\n   위탁사업장은 민법 제114조 규정에 따라 국민연금 웹 EDI 업무대행을 위탁하고,\n   업무대행기관은 대행기관으로서 제반 업무처리에 따른 법적 책임을 부담하며,\n   각 신청인은 개인정보의 부적정사용을 방지하기 위한 조치를 취하고 불법 유출\n   등으로 발생하는 손해배상 등에 대하여 연대하여 책임질 것을 서약하며 업무대행을\n   신청합니다.\n\n                              {{계약일}}\n\n   신청인 (업무대행기관 사용자):\n     푸른노무법인                                       (서명 또는 인)\n\n   신청인 (업무대행 위탁사업장 사용자):\n     {{대표자}}                                         (서명 또는 인)\n\n              국민연금공단  ○○○○ 지사장  귀하\n',
      attachments:[], enabled:true, createdAt:'2026-05-08' },
    { id:'fm-pr-health', kind:'company', name:'건강보험 EDI 업무대행 위임장 (푸른 표준)',
      body:'              건강보험 EDI 업무대행 위임장\n\n                                                     계약번호: {{계약번호}}\n\n┌─────────────────────────────────────────────┐\n│ [업무대행기관]                                              │\n│  사업장관리번호: 312-81-52792-0                            │\n│  기 관 명      : 푸른노무법인                              │\n│  소 재 지      : 충청남도 천안시 서북구 원두정8길 6,      │\n│                  두정빌딩 301호 (전화: 041-556-0035)       │\n│  대 표 자      : 권 형 하                                  │\n│  주 민 번 호   : 750107-1******                            │\n└─────────────────────────────────────────────┘\n\n┌─────────────────────────────────────────────┐\n│ [위탁사업장]                                                │\n│  사업장관리번호 (단위사업장기호): {{사업자번호}}-0         │\n│  사 업 장 명   : {{회사명}}                                │\n│  소 재 지      : {{주소}}                                  │\n│  대 표 자      : {{대표자}}                                │\n│  주 민 번 호   : ______________                            │\n│  사업자등록번호: {{사업자번호}}                            │\n└─────────────────────────────────────────────┘\n\n[위임 업무 범위]\n   공단 웹 EDI 서비스 업무\n\n[작성 방법]\n   - 주민번호: 생년월일 + 성별까지 기재\n\n   민법 제114조(대리행위의 효력)의 규정에 의하여 위와 같이 건강보험 EDI\n   업무대행 대리인 위임을 신청합니다.\n\n                              {{계약일}}\n\n                  위임자: {{대표자}}                (서명 또는 인)\n\n              국민건강보험공단  ○○○○ 지사장  귀하\n',
      attachments:[], enabled:true, createdAt:'2026-05-08' },
    { id:'fm-pr-employment', kind:'company', name:'고용·산재 보험사무대행기관 사무위탁서 (푸른 표준)',
      body:'              보험사무대행기관 사무위탁서\n\n                                                     계약번호: {{계약번호}}\n\n┌─────────────────────────────────────────────┐\n│ 사업장관리번호: {{사업자번호}}-0                           │\n│ 사업장명      : {{회사명}}                                 │\n│ 상시사용근로자수:           명                             │\n│ 소 재 지      : {{주소}}                                   │\n│ 전 화 번 호   : ________________                           │\n│ 대 표 자      : {{대표자}}                                 │\n│ 사업의 종류   : ________________                           │\n└─────────────────────────────────────────────┘\n\n[위탁사항]\n   □ 고용보험 및 산업재해보상보험 (임금채권 및 석면피해구제 포함) 관련 사무\n     1. 보수총액 및 근로자 고용정보 신고에 관한 사무\n     2. 보험료 신고에 관한 사무\n     3. 보험관계 성립, 변경, 소멸 등의 신고에 관한 사무\n     4. 기타 관계 법령 및 규칙 등에 의하여 사업주가 근로복지공단이나\n        지방고용노동관서에 신고 또는 보고하여야 할 보험사무\n     5. 피보험자격의 취득·상실 및 근로내역확인 신고 등 피보험자관리에\n        관한 사무 (고용보험에 한함)\n\n   ※ 보험사무대행기관이 상기 위탁사항의 처리에 필요한 정보를 근로복지공단\n     에서 제공받는 것에 동의함\n\n   사무처리 시작 연월일 (예정): {{계약일}}\n\n   위와 같이 귀 보험사무대행기관에 [√]고용보험 [√]산업재해보상보험\n   (임금채권 및 석면피해구제 포함) 사무의 처리를 위탁합니다.\n\n                              {{계약일}}\n\n   위탁사업주 주소: {{주소}}\n   위탁사업주 성명: {{대표자}}                          (서명 또는 인)\n\n              보험사무대행기관 대표  귀하\n\n   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n   [√]고용보험 [√]산업재해보상보험 관련 사무 수탁을 [√]승낙 [ ]불승낙 합니다.\n\n   불승낙 사유: ________________________________________\n\n   보험가입자 사업장관리번호: 2009-0049-00\n\n                              {{계약일}}\n\n   보험사무대행기관 명칭: 푸른노무법인\n   소 재 지            : 충청남도 천안시 서북구 원두정8길 6\n   대 표 자            : 권 형 하                       (서명 또는 인)\n\n              {{회사명}} 귀하\n',
      attachments:[], enabled:true, createdAt:'2026-05-08' },
    { id:'fm-pr-cms', kind:'company', name:'CMS 자동이체 이용신청서 (푸른 표준)',
      body:'         계좌/신용카드 자동출금 이용신청서 (■신규 □변경 □해지)\n\n                                                     계약번호: {{계약번호}}\n\n※ 전자금융거래법 관련 규정(시행령 10조)에 의거, 자동이체 신청시에는 반드시\n   서면/공동인증서/녹취를 통한 예금주/카드주/휴대폰명의자 본인의 동의가\n   필요합니다.\n※ 신용카드 이용시 카드이용내역서상 카드사에 따라 결제대행기관인 나이스\n   또는 나이스(올더게이트)의 이름으로 청구될 수 있으며, 계좌출금 시에는\n   통장 내역에 수납기관이 지정한 통장기재내역으로 6자 이내 표시됩니다.\n\n◈ 수납기관 및 요금정보 (수납기관 기재란)\n   수납기관명    : 푸른노무법인\n   자동이체사유  : 월 자문료\n   금     액     : {{계약금액}}원\n   비     고     : 통장기재내역: 푸른노무법인\n\n◈ 납부자 정보 (수납기관 기재란)\n   납부자 번호 (고객번호): __________________\n   이체개시 년월         : {{계약시작일}}\n   지정 출금일           : 매월 ___일\n\n◈ 신청인 정보 입력\n   신청인 성명           : {{회사명}}\n   이 메 일             : {{대표이메일}}\n   주     소             : {{주소}}\n   연 락 처              : {{대표전화}}\n   휴대폰번호            : __________________\n\n   결제수단 선택         : ■ 계좌(CMS)  □ 신용카드\n                          *계좌이용시 휴대폰번호 등으로 개설된 평생계좌번호는\n                           이용 불가\n\n   은행명/카드사         : __________________\n   사업자번호            : {{사업자번호}}\n   예금주/카드주 본인명  : __________________\n   계좌/카드번호         : __________________\n   예금주/카드주 본인 주민번호 앞6자리: ______ - *******\n   카드유효기간          : ___/___ (월/년)  *카드 선택시\n\n※ 법인공용카드, 선불카드, 해외발행카드 등 일부 카드는 이용이 불가능할 수\n   있습니다.\n※ 연체, 잔액부족 등의 사유로 납부가 지연되는 경우가 발생하지 않도록 유의\n   하여 주십시오.\n\n[자동이체 서비스 이용 약관 / 개인정보 수집·이용동의 / 개인정보 취급위탁 /\n 문자(SMS) 발송 동의]\n   상기 자동이체 신청과 관련하여 계좌예금주/카드주로서 자동이체서비스\n   이용약관과 개인정보 수집 및 이용동의, 개인정보 취급 위탁에 동의,\n   문자(SMS) 발송에 동의하며, 자동출금이체서비스를 신청합니다.\n\n                              {{계약일}}\n\n   신청인               : {{대표자}}                  (인 또는 서명)\n   예금주/카드주 동의란 :                              (인 또는 서명)\n\n   * 신청인과 예금주/카드주가 상이한 경우에는 예금주/카드주의 동의가 필요\n     하며, 날인 또는 서명은 출금통장의 거래날인, 서명 사용\n',
      attachments:[], enabled:true, createdAt:'2026-05-08' }
  ];

  // ── 체당금 사건 양식 시드 (4종) ──
  var CASE_CHEDANG_FORMS = [
    {
      id:'fm-case-cd-01', kind:'case', groupName:'체당금',
      name:'위임약정서-임금체불',
      body: '위   임   약   정   서\n\n본    인 (위임인)\n  이름 : {{근로자명}}\n  주민번호 : {{주민번호}}\n  주소 : {{근로자주소}}\n  연락처 : {{근로자연락처}}\n  가족연락처(연락두절시) : {{가족연락처}}\n\n위임내용 : 미지급임금 등 체불 처리에 대한 일체의 사항 위임\n\n제1조[사건위임]\n  본인은 귀하에게 상기 사건의 처리에 관한 일체의 사항을 위임하고 대리사건에 관하여는 별도의 위임장에 기재된 권한을 귀하에게 수여한다.\n\n제2조[보수]\n  ① 본인은 사건처리를 위임함에 있어 착수금으로 금 {{착수금}}원(부가세포함)을 선지급한다.\n  ② 귀하는 착수금을 수령한 이후부터 위임사무를 개시한다.\n  ③ 착수금은 약정해지여부 및 사건처리결과에 관계없이 반환을 청구할 수 없으며 아래 제3조 성공보수지급시 공제하지 아니한다.\n\n제3조[성공보수]\n  ① 사건처리결과 성공한 때에는 총 수령금의 {{성공보수율}}(부가세포함)을 성공보수로 지급한다.\n\n제4조[사건을 성공으로 보는 경우] 다음의 경우에는 위임사무가 성공된 것으로 보고 제3조의 성공보수를 지급한다.\n  ① 위임사무 착수 후 본인이 귀하의 동의 없이 임의로 계약해지, 신청(청구)의 포기 및 취하, 화해한 때\n  ② 본인이 이 약정서에 정한 의무를 이행치 않거나 진술한 사실이 허위인 까닭에 귀하가 위임계약을 해지한 때\n  ③ 귀하의 책임없는 사유로 인하여 사건처리가 종결될 때\n\n제5조[자료제출]\n  본인은 위임사무를 원활히 행하는데 필요한 자료제출 요구에 적극 조력하며 귀하는 본인이 제시한 자료의 범위내에서 책임을 진다.\n\n제6조[인장사용] 본인은 위임사무의 필요한 범위에서 인장사용에 대하여 승인한다.\n\n제7조[자료의 보관]\n  ① 본인이 사무처리를 위하여 제공한 서류와 자료는 본인이 이 약정서에 정한 의무를 이행치 않을 때에 귀하가 이를 유치하여도 이의를 제기하지 않는다.\n  ② 위임사무가 종료된 때부터 3년이 경과한 때에는 귀하가 전항의 서류와 자료를 폐기하여도 이의를 제기하지 않는다.\n\n제8조[계약의 해지]\n  본인이 이 약정서에 정한 의무를 이행치 않을 때 또는 위임사무의 내용에 대하여 본인이 진술한 사실이 허위인 때에는 고의가 아닌 경우라도 귀하는 이 위임계약을 해제할 수 있다.\n\n제9조[성공보수 미지급시]\n  ① 위임인은 사건의 성공으로 금품을 지급받은 다음날부터 1주일 이내 수임인에게 성공보수를 지급한다.\n  ② 위임인이 수임인에게 성공보수를 지급하지 않은 경우 금품을 지급받은 다음날로부터 7일후 부터 연 15%의 이자를 지급한다.\n\n제10조[특별사항]\n  퇴직금등 기타 금액에 대하여 대리인이 위임인을 대신하여 수령할 수 있고, 이를 수령한 경우 성공보수를 제하고 위임인에게 지급할 수 있다.\n\n{{계약일}}\n\n위임인 :  {{근로자명}}                  (인)\n\n푸른노무법인 대표 권형하 노무사       (인)',
      attachments:[], enabled:true, createdAt:'2026-05-08'
    },
    {
      id:'fm-case-cd-02', kind:'case', groupName:'체당금',
      name:'위임장',
      body: '위        임        장\n\n사 무 소 명 : 푸른 노무법인\n소   재   지 : 충남 천안시 서북구 원두정8길 6, 두정빌딩 3층\n연   락   처 : TEL 041-556-0035   FAX 041-556-3656\n이메일주소 : 370-6@daum.net\n\n성         명 : 대표 / 공인노무사   권 형 하\n                           공인노무사   박 한 별\n                           공인노무사   김 혜 민\n                           공인노무사   박 재 원\n\n상기인을 공인노무사법 제2조 제1항의 규정에 의하여 대리인으로 선임하고 아래 사항의 처리에 관한 일체의 권한을 위임합니다.\n\n---------------- 아         래 ----------------\n\n미지급임금 등 체불 처리에 대한 일체의 사항 위임\n\n{{계약일}}\n\n위임인 :  {{근로자명}}                  ( 서 명 )\n연락처 :  {{근로자연락처}}',
      attachments:[], enabled:true, createdAt:'2026-05-08'
    },
    {
      id:'fm-case-cd-03', kind:'case', groupName:'체당금',
      name:'개인정보 제공 동의서',
      body: '개인정보 제공 동의서\n\n성         명 : {{근로자명}}\n자 택 주 소 : {{근로자주소}}\n연   락   처 : {{근로자연락처}}\n\n1. 본인은 아래 내용에 대하여 사전에 충분히 인지하였으며, \'개인정보보호법\' 등에 의해 보호되고 있는 본인에 관한 아래 정보자료를 푸른노무법인에서 수집·이용하는 것에 동의합니다.\n\n[개인정보항목]\n  가. 성명\n  나. 주소, 이메일, 연락처\n  다. 학력, 근무경력, 등록번호\n  라. 기타 관련된 개인정보\n\n[수집·이용목적]\n  가. 회원서비스의 기초자료\n  나. 회비산출의 근거자료\n  다. 회원에 대한 추천 등 실적증명자료\n  라. 제도개선, 동향파악등 기초자료\n\n[보유기간] 가입 후 탈퇴시까지\n\n개인정보의 수집·이용에 대해 ( ■ 동의함  □ 동의하지 않음 )\n\n2. 본인은 상기 개인정보에 대한 동의와 별도로 아래의 민감정보와 고유식별정보를 수집·이용하는 것에 동의합니다.\n\n[민감정보 항목]\n  가. 신체장애\n  나. 국가보훈대상\n  다. 병력\n  라. 범죄경력\n\n[수집·이용목적]\n  가. 우선채용대상자격 및 정부지원금(장려금 등)\n  나. 인사이동, 업무적합성판단, 기타 인적자원관리\n\n민감정보 수집·이용에 대해 ( ■ 동의함  □ 동의하지 않음 )\n\n[고유식별정보 항목]\n  가. 주민등록번호(외국인의 경우 외국인등록번호)\n\n[수집·이용목적]\n  가. 개인정보식별\n  나. 자격확인\n\n고유식별정보의 수집·이용에 대해 ( ■ 동의함  □ 동의하지 않음 )\n\n{{계약일}}\n\n서명 또는 (인) :  {{근로자명}}',
      attachments:[], enabled:true, createdAt:'2026-05-08'
    },
    {
      id:'fm-case-cd-04', kind:'case', groupName:'체당금',
      name:'효성CMS 자동이체 신청서',
      body: '효성CMS 자동이체 신청서\n(금융기관 및 결제대행사(효성에프엠에스㈜) 제출용)\n\n◈ 수납업체 및 목적 (수납업체 기재란)\n  수납업체 : 푸른노무법인\n  수납목적 : 사무처리 수수료\n  대표자  : 권형하\n  사업자등록번호 : 312-81-52792\n  주소    : 충남 천안시 원두정8길 6. 두정빌딩 3층 301호\n\n◈ 자동이체 신청내용 (신청고객 기재란)\n\n[신청정보]\n  신청인       : {{근로자명}}\n  예금주와의 관계 : (본인)\n  연락처       : {{근로자연락처}}\n\n[납부금액]\n  □ 고정금액 (             원)\n  □ 변동(추가 계약내용에 따름)\n  납부일 : 매월        일\n  *미납시      일,      일 재출금\n\n[금융거래정보]\n  은행명     : \n  예금주     : {{근로자명}}\n  계좌번호   : \n  예금주 생년월일 (또는 사업자등록번호) :\n  예금주 휴대전화번호 :\n\n◇ 개인정보 수집 및 이용 동의 ◇\n  ◆ 수집 및 이용목적 : 효성CMS 자동이체를 통한 요금 수납\n  ◆ 수집항목 : 성명, 생년월일, 연락처, 은행명, 예금주명, 계좌번호, 예금주 휴대전화번호\n  ◆ 보유 및 이용기간 : 수집/이용 동의일부터 자동이체 종료일(해지일)까지\n  ◆ 신청자는 개인정보의 수집 및 이용을 거부할 수 있습니다. 단, 거부 시 자동이체 신청이 처리되지 않습니다.\n  동의함 ■    동의하지 않음 □\n\n◇ 개인정보 제3자 제공 동의 ◇\n  ◆ 개인정보를 제공받는 자 : 효성에프엠에스㈜, 금융기관, 통신사(SKT, KT, LGU+, CJ헬로비전)등\n  ◆ 자세한 내용은 홈페이지 게시 (www.efnc.co.kr / 제휴사 소개 메뉴 내)\n  ◆ 제공받는 자의 이용 목적 : 자동이체서비스 제공 및 자동이체 동의 사실 통지\n  ◆ 제공하는 개인정보의 항목 : 성명, 생년월일, 연락처, 은행명, 예금주명, 계좌번호, 예금주 휴대전화번호\n  ◆ 보유 및 이용기간 : 동의일부터 자동이체 종료일(해지일)까지. 단, 관계 법령에 의거 일정 기간 보관\n  ◆ 신청자는 개인정보 제3자 제공을 거부할 수 있습니다. 단, 거부 시 자동이체 신청이 처리되지 않습니다.\n  동의함 ■    동의하지 않음 □\n\n# 자동이체 동의여부 통지 안내 : 효성에프엠에스㈜ 및 금융기관은 안전한 서비스의 제공을 위하여 예금주 휴대전화번호로 자동이체 동의 사실을 SMS(또는 LMS)로 통지합니다.\n\n신청인(예금주)은 신청정보, 금융거래정보 등 개인정보의 수집·이용 및 제3자 제공에 동의하며 상기와 같이 효성CMS 자동이체를 신청합니다.\n\n{{계약일}}\n\n신청인 :  {{근로자명}}                       (인) 또는 서명\n(신청인과 예금주가 다를 경우) 예금주 :                      (인) 또는 서명\n\n[안내사항]\n1. 신청인과 예금주가 다른 경우 반드시 예금주의 별도 서명을 받아야 합니다.\n2. 인감 또는 서명은 출금통장의 사용인감 또는 서명을 사용해야 합니다.\n3. 기존 신청내용을 변경하고자 하는 경우에는 자동이체신청서를 신규로 작성하셔야 합니다.\n4. 신청가능은행 : 국민, 우리, 신한, 농협, 하나, SC, 기업, 외환, 씨티, 산업, 새마을, 부산, 대구, 경남, 광주, 전북, 제주, 수협, 신협, 우체국, 동양증권, 삼성증권',
      attachments:[], enabled:true, createdAt:'2026-05-08'
    }
  ];

  /* 기본 양식 채워 넣기 — 저장본에 없는 기본 양식만 더한다(사람이 고친 것·지운 것은 그대로).
     이알피 getContractForms 와 문서관리가 «같은 이 함수»를 쓴다. */
  function mergeSeeds(arr, removed) {
    var list = Array.isArray(arr) ? arr.slice() : [];
    var gone = {};
    (Array.isArray(removed) ? removed : []).forEach(function (id) { gone[id] = true; });
    var have = {};
    list.forEach(function (f) { if (f && f.id != null) have[f.id] = true; });
    var added = 0;
    CONTRACT_FORM_SEED.concat(CASE_CHEDANG_FORMS).forEach(function (s) {
      if (!have[s.id] && !gone[s.id]) { list.push(s); have[s.id] = true; added++; }
    });
    return { list: list, added: added };
  }
  function isSeedId(id) {
    return CONTRACT_FORM_SEED.concat(CASE_CHEDANG_FORMS).some(function (s) { return s.id === id; });
  }

  /* ── 글자 뽑기 (공용 읽개를 «그 파일을 열 때만» 받는다) ── */
  function _ensurePdfjs2(cb) {
    if (typeof w.pdfjsLib !== 'undefined') { cb(null); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function () { w.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; cb(null); };
    s.onerror = function () { cb('PDF.js 로드 실패'); };
    document.head.appendChild(s);
  }
  /* ⚠ 처음부터 받아 두지 않는다 — 양식을 올리는 사람은 드물다.
     ⚠ PDF 는 «PDF 일 때만» pdf.js 를 받는다 — 한글 파일 하나 읽자고 1MB 를 받을 일이 아니다. */
  function _ensureDocText(needPdf, cb){
    var one = function (src, has, next) {
      if (has()) { next(null); return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { next(null); };
      s.onerror = function () { next(src + ' 로드 실패'); };
      document.head.appendChild(s);
    };
    one('vendor/pako.min.js', function () { return w.pako; }, function (e) {
      if (e) { cb(e); return; }
      one('hwp_extract.js?v=5', function () { return w.extractDocText; }, function (e2) {
        if (e2) { cb(e2); return; }
        if(!needPdf){ cb(null); return; }
        _ensurePdfjs2(cb);
      });
    });
  }
  /* 파일 «속 표식»으로 PDF 인지 본다 — 이름이 아니라 내용으로 */
  function _looksPdf(buf){
    var u=new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    return u[0]===0x25 && u[1]===0x50 && u[2]===0x44 && u[3]===0x46;   // "%PDF"
  }
  /* cb(text, err) — err 가 있으면 뽑기 실패(첨부만 저장) */
  function extractTemplateText(file, cb){
    file.arrayBuffer().then(function(buf){
      _ensureDocText(_looksPdf(buf), function(e){
        if(e){ cb('', e); return; }
        Promise.resolve(w.extractDocText(buf)).then(function(t){
          var text=String(t||'').replace(/\n{3,}/g,'\n\n').trim();
          cb(text, text?null:'본문 텍스트 없음');
        }).catch(function(err){
          /* 읽개가 «왜» 못 읽었는지 그대로 전한다 — 암호화·손상은 사람이 할 일이 다르다 */
          cb('', (err && err.message) || '글자를 뽑지 못했습니다');
        });
      });
    }).catch(function(){ cb('','파일 읽기 실패'); });
  }

  /* ── 서버 자리 ── */
  var PATH = 'data/contract_forms', PATH_RM = 'data/contract_forms_removed';
  /* 서버 본문 → 배열. 이알피는 배열로 적지만 실시간DB 는 「0,1,2…」 열쇠 지도로 돌려줄 때가 있다 */
  function listOf(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort(function (a, b) { return (+a) - (+b); }).map(function (k) { return v[k]; }).filter(Boolean);
    }
    return [];
  }
  function nextU(cur) {
    return Math.max(((cur && typeof cur.u === 'number') ? cur.u : 0) + 1, Date.now());
  }
  /* 서버 최신본 «위에» 한 번 고친다. fn(list) → 새 list. 끝나면 새 목록을 돌려준다. */
  function changeForms(db, removed, fn) {
    return new Promise(function (res, rej) {
      var out = null;
      db.ref(PATH).transaction(function (cur) {
        var base = mergeSeeds(listOf(cur && cur.v), removed).list;
        out = fn(base.slice());
        return { v: out, u: nextU(cur) };
      }, function (err, committed) {
        if (err) { rej(err); return; }
        if (!committed) { rej(new Error('저장이 끝나지 않았습니다')); return; }
        res(out);
      });
    });
  }
  function changeRemoved(db, fn) {
    return new Promise(function (res, rej) {
      var out = null;
      db.ref(PATH_RM).transaction(function (cur) {
        out = fn(listOf(cur && cur.v).slice());
        return { v: out, u: nextU(cur) };
      }, function (err, committed) {
        if (err || !committed) { rej(err || new Error('저장이 끝나지 않았습니다')); return; }
        res(out);
      });
    });
  }

  function newId(p) {
    return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '-' + Math.random().toString(36).slice(2, 5);
  }
  function todayYMD() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function kindInfo(v) { return KINDS.filter(function (k) { return k.v === v; })[0] || KINDS[0]; }

  var ATTACH_MAX = 1024 * 1024; // 양식 첨부(base64)는 1MB 까지 — 이알피가 통표로 받는다

  /* 왼쪽 트리의 모양 — 화면 없이 검사한다 */
  function treeModel(forms) {
    function leaf(f) { return { id: f.id, name: f.name || '(이름 없음)', enabled: f.enabled !== false }; }
    return KINDS.map(function (k) {
      var list = (forms || []).filter(function (f) { return f.kind === k.v; });
      var groups;
      if (k.v === 'case') {
        var by = {};
        list.forEach(function (f) { var g = f.groupName || '미지정'; (by[g] = by[g] || []).push(f); });
        groups = Object.keys(by).sort(function (a, b) { return a.localeCompare(b); })
          .map(function (g) { return { name: g, forms: by[g].map(leaf) }; });
        if (!groups.length) groups = [{ name: null, forms: [] }];
      } else groups = [{ name: null, forms: list.map(leaf) }];
      return { kind: k.v, label: k.label, icon: k.icon, color: k.color, count: list.length, groups: groups };
    });
  }
  /* ── C안 거르기 (대표 결정 2026-09-27) — 메뉴는 계약유형까지, 측·사건유형은 본문 위 칩 ──
     ⚠ 사건유형 이름은 이알피 BIZ_CASE_SEED 와 «같은 이름·같은 순서»다(tests/office-forms-filter.test.js 가 견준다).
       이알피 「계약서 출력」이 양식 그룹명을 계약의 사건유형 이름과 맞춰 자동 체크하기 때문이다.
       그래서 새 칸을 만들지 않고 그룹명을 이 목록에서 고르게 한다. */
  var CASE_TYPES = ['인사', '부해등', '체불', '체당금', '산재등', '산안', '노사', '지원', '교육', '조사', '행심', '징계', '기타'];
  var SIDES = [{ v: 'worker', label: '근로자측' }, { v: 'employer', label: '사용자측' }, { v: 'both', label: '공통' }];
  var NO_GROUP = '(미지정)';
  /* 측 — 사건계약에만. 적힌 값이 먼저, 없으면 본문 칸으로 짐작한다(근로자 칸이 있으면 근로자측:
     근로자측 양식도 상대 회사 {{회사명}} 을 적는 일이 흔하다). */
  function sideOf(f) {
    if (!f || f.kind !== 'case') return null;
    if (f.side === 'worker' || f.side === 'employer' || f.side === 'both') return f.side;
    var b = String(f.body || '');
    if (/\{\{근로자/.test(b)) return 'worker';
    if (/\{\{(회사명|대표자)\}\}/.test(b)) return 'employer';
    return 'both';
  }
  function groupOf(f) { return (f && String(f.groupName || '').trim()) || NO_GROUP; }
  function groupRank(g) {
    var i = CASE_TYPES.indexOf(g);
    return i >= 0 ? i : (g === NO_GROUP ? 1000 : 500);
  }
  /* o = { kind, side?:'all'|'worker'|'employer'|'both', grp?:'all'|이름, q?:검색어 } */
  function filterForms(forms, o) {
    o = o || {};
    var q = String(o.q || '').trim().toLowerCase();
    var isCase = o.kind === 'case';
    return (forms || []).filter(function (f) {
      if (f.kind !== o.kind) return false;
      if (isCase && o.side && o.side !== 'all' && sideOf(f) !== o.side) return false;
      if (isCase && o.grp && o.grp !== 'all' && groupOf(f) !== o.grp) return false;
      if (q && String(f.name || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (isCase) {
        var ga = groupOf(a), gb = groupOf(b), d = groupRank(ga) - groupRank(gb);
        if (d) return d;
        if (ga !== gb) return ga.localeCompare(gb);
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }
  /* 칩 개수 — 측 칩은 사건계약 전체에서, 사건유형 칩은 «고른 측 안에서» 센다 */
  function facetCounts(forms, kind, side) {
    var list = (forms || []).filter(function (f) { return f.kind === kind; });
    var sides = { all: list.length, worker: 0, employer: 0, both: 0 };
    var by = {};
    list.forEach(function (f) {
      var s = sideOf(f);
      if (s) sides[s]++;
      if (kind !== 'case') return;
      if (side && side !== 'all' && s !== side) return;
      var g = groupOf(f);
      by[g] = (by[g] || 0) + 1;
    });
    var groups = Object.keys(by).sort(function (a, b) { return (groupRank(a) - groupRank(b)) || a.localeCompare(b); })
      .map(function (g) { return { name: g, count: by[g] }; });
    return { sides: sides, groups: groups };
  }

  /* 본문을 칸({{…}})과 글로 가른다 — 칸만 딱지로 감싸고 나머지는 글 그대로 넣는다 */
  function splitVars(text) {
    var s = String(text || ''), re = /\{\{[^{}\n]+\}\}/g, outp = [], at = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > at) outp.push({ t: s.slice(at, m.index), v: false });
      outp.push({ t: m[0], v: true });
      at = m.index + m[0].length;
    }
    if (at < s.length) outp.push({ t: s.slice(at), v: false });
    return outp;
  }
  function attKey(a) { return (a && a.id) || ('n:' + (a && a.name) + '|' + (a && a.size)); }
  function loadForms(db) {
    return Promise.all([db.ref(PATH).once('value'), db.ref(PATH_RM).once('value')]).then(function (r) {
      var cf = r[0].val(), rm = r[1].val();
      return mergeSeeds(listOf(cf && cf.v), listOf(rm && rm.v)).list;
    });
  }
  /* 보관함 원본을 양식에 잇는다 — 저장 한 길(changeForms)로, 같은 것은 한 번만 */
  function linkOriginal(db, formId, entry) {
    return db.ref(PATH_RM).once('value').then(function (s) {
      var rm = listOf((s.val() || {}).v);
      return changeForms(db, rm, function (list) {
        list.forEach(function (f) {
          if (f.id !== formId) return;
          var o = Array.isArray(f.originals) ? f.originals : [];
          var dup = o.some(function (x) { return x.fileId === entry.fileId && (x.attId || '') === (entry.attId || ''); });
          if (!dup) o.push(entry);
          f.originals = o;
        });
        return list;
      });
    });
  }
  function readDataUrl(file) {
    return new Promise(function (res) {
      var rd = new FileReader();
      rd.onload = function (ev) { res(ev.target.result); };
      rd.onerror = function () { res(''); };
      rd.readAsDataURL(file);
    });
  }
  function readBytes(file) {
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onload = function (ev) { res(new Uint8Array(ev.target.result)); };
      rd.onerror = function () { rej(new Error('파일을 읽지 못했습니다')); };
      rd.readAsArrayBuffer(file);
    });
  }
  function origEntry(fileId, file, attId) {
    var o = { fileId: fileId, name: file.name, size: file.size };
    if (attId) o.attId = attId;
    return o;
  }

  function bytesOfDataUrl(dataUrl) {
    var b64 = String(dataUrl || '').split(',')[1] || '';
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  /* ── 화면 조각 ── */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'style') n.style.cssText = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  var CSS = ''
    + '.pcf,.pcf *,.pcf-mbg *,.pcf-hv *{box-sizing:border-box}'
    + '.pcf{font-size:13px;color:#1e293b}'
    + '.pcf-b{border:1px solid #cbd5e1;background:#f8fafc;color:#475569;padding:4px 10px;border-radius:4px;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;font-family:inherit}'
    + '.pcf-b.g{background:#f0fdf4;color:#166534;border-color:#bbf7d0}.pcf-b.b{background:#eff6ff;color:#1e40af;border-color:#bfdbfe}.pcf-b.y{background:#fffbeb;color:#854d0e;border-color:#fde68a}'
    + '.pcf-act{border:none;color:#fff;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}'
    + '.pcf-att{display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1e40af;padding:3px 8px;border-radius:4px;font-size:10.5px;font-weight:600;text-decoration:none;margin:0 4px 4px 0}'
    + '.pcf-none{color:#94a3b8;font-size:11.5px;text-align:center;padding:48px;border:1px dashed #e2e8f0;margin:16px;border-radius:4px}'
    + '.pcf-mbg{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:1200;display:flex;align-items:center;justify-content:center;padding:20px}'
    + '.pcf-m{background:#fff;border-radius:12px;width:780px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden}'
    + '.pcf-mh{padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;font-weight:700}'
    + '.pcf-mh span{flex:1}.pcf-mh button{border:none;background:none;font-size:20px;cursor:pointer;color:#64748b}'
    + '.pcf-mb{padding:16px;overflow-y:auto;flex:1}'
    + '.pcf-mf{padding:10px 16px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px}'
    + '.pcf-mb label.l{display:block;font-size:12px;font-weight:600;color:#475569;margin:10px 0 4px}'
    + '.pcf-mb input[type=text],.pcf-mb textarea{width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;font-family:inherit}'
    + '.pcf-mb textarea{min-height:320px;font-family:monospace;font-size:12px;line-height:1.6;resize:vertical}'
    + '.pcf-vars{background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;margin-top:10px}'
    + '.pcf-vars button{background:#fff;color:#1e40af;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px;font-size:10.5px;font-family:monospace;cursor:pointer;margin:0 4px 4px 0}'
    + '.pcf-drop{border:1px dashed #cbd5e1;border-radius:6px;padding:10px;background:#f8fafc}'
    + '.pcf-arow{display:flex;align-items:center;gap:8px;padding:5px 8px;background:#fff;border:1px solid #e2e8f0;border-radius:4px;margin-top:4px;font-size:11.5px}'
    + '.pcf-arow span.n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pcf-hv{position:fixed;inset:0;z-index:1300;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.pcf-hvb{background:#fff;border-radius:10px;max-width:900px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden}'
    + '.pcf-hvh{padding:10px 14px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;background:#f8fafc;flex-wrap:wrap}'
    + '.pcf-hvh b{flex:1;min-width:120px;color:#166534;font-size:13px}'
    + '.pcf-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1e293b;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:1400;display:flex;gap:12px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,.25)}'
    + '.pcf-toast button{background:#fbbf24;color:#1e293b;border:none;border-radius:5px;padding:3px 10px;font-weight:700;cursor:pointer}'
    + '.pcf-tk{display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;border-radius:6px;padding:5px 8px 5px 24px;font-size:12.5px;color:#334155;cursor:pointer;font-family:inherit;text-align:left}'
    + '.pcf-tk:hover{background:#eff6ff}.pcf-tk.on{background:#dbeafe;color:#1e40af;font-weight:700}'
    + '.pcf-tk i{font-style:normal;margin-left:auto;font-size:10.5px;color:#64748b;background:#e2e8f0;border-radius:9px;padding:0 6px}'
    + '.pcf-fbar{border:1px solid #e2e8f0;border-top:none;background:#f8fafc;padding:6px 10px}'
    + '.pcf-crow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
    + '.pcf-cgrp{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}'
    + '.pcf-fsep{width:1px;height:18px;background:#cbd5e1;margin:0 2px}'
    + '.pcf-tools{margin-left:auto;display:inline-flex;flex-wrap:wrap;gap:5px;align-items:center}'
    + '.pcf-chip{border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:99px;padding:3px 11px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}'
    + '.pcf-chip:hover{border-color:#93c5fd}.pcf-chip.on{background:#1e40af;border-color:#1e40af;color:#fff;font-weight:700}'
    + '.pcf-q{flex:0 1 200px;min-width:120px;padding:5px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;font-family:inherit}'
        + '.pcf-cols{display:flex;align-items:stretch;height:100%}'
    + '.pcf-cols .pcf-sheetwrap{flex:1;min-width:0;height:100%;overflow-y:auto}'
    + '.pcf-list{width:250px;flex:none;border:1px solid #e2e8f0;border-top:none;border-right:none;background:#fff;height:100%;overflow-y:auto;padding:4px}'
    + '.pcf-lg{font-size:11px;color:#94a3b8;padding:8px 8px 2px;font-weight:700}'
    + '.pcf-li{display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;border-radius:6px;padding:6px 8px;font-size:12.5px;color:#334155;cursor:pointer;text-align:left;font-family:inherit}'
    + '.pcf-li:hover{background:#eff6ff}.pcf-li.on{background:#dbeafe;color:#1e40af;font-weight:700}.pcf-li.off .pcf-ln{color:#94a3b8;text-decoration:line-through}.pcf-li.add{color:#2563eb;font-size:12px}'
    + '.pcf-ln{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pcf-sd{flex:none;font-size:10.5px;font-weight:700;border-radius:9px;padding:0 6px}'
    + '.pcf-sd.worker{background:#dcfce7;color:#166534}.pcf-sd.employer{background:#fef3c7;color:#92400e}.pcf-sd.both{background:#f1f5f9;color:#64748b}'
    + '.pcf-cards{height:100%;overflow-y:auto;align-content:start;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;background:#e2e8f0;padding:14px}'
    + '.pcf-card{border:1px solid #e2e8f0;border-radius:6px;background:#fff;padding:0;cursor:pointer;text-align:left;font-family:inherit;overflow:hidden}'
    + '.pcf-card:hover{border-color:#93c5fd}.pcf-card.on{outline:2px solid #2563eb}'
    + '.pcf-thumb{height:150px;overflow:hidden;white-space:pre-wrap;font-family:"Malgun Gothic","맑은 고딕",monospace;font-size:8.5px;line-height:1.5;color:#64748b;padding:12px 14px;border-bottom:1px solid #f1f5f9}'
    + '.pcf-cn{display:flex;align-items:center;gap:6px;padding:7px 10px;font-size:12px;color:#1e293b}'
    + '.pcf-top{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0;padding:8px 12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
    + '.pcf-top b{flex:0 1 auto;min-width:0;max-width:38%;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pcf-top .pcf-strip{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:11.5px;color:#64748b}'
    + '.pcf-top .pcf-att{margin:0}'
            + '.pcf-ok{background:#dcfce7;color:#166534;border-radius:9px;padding:0 7px;font-size:10.5px;font-weight:700}'
    + '.pcf-sheetwrap{background:#e2e8f0;padding:16px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px}'
    + '.pcf-sheet{background:#fff;max-width:820px;margin:0 auto;padding:40px 52px;box-shadow:0 1px 3px rgba(15,23,42,.15);min-height:600px;position:relative}'
    + '.pcf-offband{background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:6px 10px;border-radius:4px;margin-bottom:16px}'
    + '.pcf-body{white-space:pre-wrap;font-family:"Malgun Gothic","맑은 고딕",monospace;font-size:13px;line-height:1.85;color:#1e293b;margin:0}'
    + '.pcf-v{background:#dbeafe;color:#1e40af;border-radius:3px;padding:0 2px}'
    + '.pcf-muted{color:#94a3b8}'
    /* 채워서 받기 창 */
    + '.pcf-fcols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:16px}'
    + '.pcf-fcols input[type=search],.pcf-frow input{width:100%;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;font-family:inherit}'
    + '.pcf-fh{font-size:12px;color:#64748b;font-weight:700;margin:10px 0 4px}'
    + '.pcf-fl{display:flex;flex-direction:column;gap:2px;margin-top:4px;max-height:180px;overflow:auto}'
    + '.pcf-fi{display:flex;gap:8px;align-items:baseline;text-align:left;background:none;border:1px solid transparent;border-radius:6px;padding:5px 8px;cursor:pointer;font-family:inherit;font-size:12.5px;color:#1e293b}'
    + '.pcf-fi:hover{background:#eff6ff}.pcf-fi.on{background:#dbeafe;border-color:#bfdbfe;color:#1e40af}'
    + '.pcf-fi span{color:#64748b;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pcf-fpick{display:flex;gap:8px;align-items:center;background:#dbeafe;color:#1e40af;border-radius:6px;padding:6px 8px;margin-top:6px;font-size:12.5px}'
    + '.pcf-fpick span{flex:1;min-width:0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pcf-frow{display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:5px;font-size:12px}'
    + '.pcf-frow span{color:#1e40af;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pcf-frow span.miss{color:#854d0e}'
    + '.pcf-fnote{font-size:12px;color:#854d0e;margin-top:10px;min-height:1em}'
    + '.pcf-fprev{margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;max-height:60vh;overflow:auto;background:#e2e8f0;padding:12px}'
    + '@media(max-width:700px){.pcf-fcols{grid-template-columns:1fr}}'
    + '.pcf-msel{display:none;gap:6px;margin-bottom:10px}.pcf-msel select{flex:1;min-width:0;padding:7px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px}'
    + '@media(max-width:700px){.pcf-msel{display:flex}.pcf-cols{flex-direction:column;align-items:stretch}'
    + '.pcf-cols{height:auto}.pcf-list{width:auto;height:auto;max-height:40vh;border-right:1px solid #e2e8f0}.pcf-cols .pcf-sheetwrap{height:auto;overflow:visible}.pcf-cards{height:auto}.pcf-tools{margin-left:0}.pcf-top b{max-width:none;flex:1 1 100%}'
    + '.pcf-crow{flex-wrap:nowrap;overflow-x:auto}.pcf-q{max-width:none}'
    + '.pcf-cards{grid-template-columns:repeat(2,minmax(0,1fr));padding:8px}'
    + '.pcf-sheetwrap{padding:8px}.pcf-sheet{padding:24px 18px;min-height:0}.pcf-body{font-size:12.5px}}';

  var _toastT = null;
  function toast(msg, undo) {
    var old = document.querySelector('.pcf-toast'); if (old) old.remove();
    clearTimeout(_toastT);
    var t = el('div', { 'class': 'pcf-toast', role: 'status' }, [el('span', { text: msg })]);
    if (undo) t.appendChild(el('button', { type: 'button', text: '되돌리기', onclick: function () { t.remove(); undo(); } }));
    document.body.appendChild(t);
    _toastT = setTimeout(function () { t.remove(); }, undo ? 7000 : 3000);
  }

  /* 한글 원본 미리보기 — 공용 한글 엔진(js/pu-hwp-engine.js)으로 그린다.
     「본문 교체」는 올릴 때와 «같은 읽개»로 뽑는다(두 벌이 되면 또 갈린다). */
  function openHwpPreview(att, onApplyText) {
    var ov = el('div', { 'class': 'pcf-hv' });
    var body = el('div', { style: 'flex:1;overflow:auto;background:#e2e8f0;min-height:300px' },
      [el('div', { style: 'color:#475569;padding:40px;text-align:center', text: '📥 한글 엔진을 불러오는 중…' })]);
    var apply = onApplyText ? el('button', { type: 'button', 'class': 'pcf-b b', text: '📝 이 파일 글자로 본문 교체', onclick: function () {
      var u8 = bytesOfDataUrl(att.data || att.dataUrl);
      extractTemplateText(new Blob([u8]), function (text, err) {
        if (err || !text) { toast('❌ 글자를 뽑지 못했습니다: ' + (err || '빈 본문')); return; }
        onApplyText(text); toast('✅ 본문을 바꿨습니다'); ov.remove();
      });
    } }) : null;
    var box = el('div', { 'class': 'pcf-hvb' }, [
      el('div', { 'class': 'pcf-hvh' }, [el('b', { text: '🔍 원본 미리보기 — ' + (att.name || '') }), apply,
        el('button', { type: 'button', 'class': 'pcf-b', text: '닫기', onclick: function () { ov.remove(); } })]),
      body]);
    ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    if (!w.PureunHwp) { body.firstChild.textContent = '한글 엔진을 불러오지 못했습니다.'; return; }
    try {
      w.PureunHwp.renderPreview(body, bytesOfDataUrl(att.data || att.dataUrl), att.name)
        .catch(function (e) { body.textContent = '❌ 미리보기 실패: ' + ((e && e.message) || e); });
    } catch (e) { body.textContent = '❌ 미리보기 실패: ' + ((e && e.message) || e); }
  }

  /* rhwp 판 올리기 — 이알피 「계약서 출력」과 같은 브라우저 자리(pureun_v6_rhwp_ver)에 적는다.
     (같은 주소라 한 번 올리면 이알피도 그 판을 쓴다. 같은 minor 안의 갱신은 이알피가 하루 한 번 스스로 한다.) */
  function rhwpVer() {
    try { return w.PureunHwp ? w.PureunHwp.activeVersion() : '?'; } catch (_) { return '?'; }
  }
  function rhwpUpdatePrompt() {
    toast('rhwp 최신 판 확인 중…');
    fetch('https://data.jsdelivr.com/v1/packages/npm/@rhwp/core/resolved')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var latest = j && j.version, cur = rhwpVer();
        if (!latest) { toast('판 정보가 없습니다'); return; }
        if (latest === cur || (w.PureunHwp && !w.PureunHwp.verNewer(latest, cur))) { toast('✅ 이미 최신 (v' + cur + ')'); return; }
        if (w.confirm('rhwp 새 판이 있습니다\n지금: v' + cur + '\n최신: v' + latest + '\n\n쓸까요? (다음 미리보기부터 새 판)')) {
          try { localStorage.setItem('pureun_v6_rhwp_ver', latest); } catch (_) {}
          toast('✅ rhwp v' + latest + ' 적용 — 새로고침하면 바뀝니다');
        }
      })
      .catch(function () { toast('❌ 최신 판 조회 실패'); });
  }

  /* ══ 양식 고치기 창 ══ */
  function openModal(opts) {
    var f = JSON.parse(JSON.stringify(opts.cur || {
      id: newId('fm-'), kind: opts.kind || 'consult',
      name: '', body: '', attachments: [], enabled: true, createdAt: todayYMD()
    }));
    if (!Array.isArray(f.attachments)) f.attachments = [];
    if (!Array.isArray(f.originals)) f.originals = [];
    var k = kindInfo(f.kind);
    var bg = el('div', { 'class': 'pcf-mbg' });
    function close() { document.removeEventListener('keydown', onKey); bg.remove(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    var nameIn = el('input', { type: 'text', placeholder: '예: 위임약정서-임금체불' }); nameIn.value = f.name || '';
    var grpIn = null, sideBox = null, sideV = null, sideTouched = false;
    if (f.kind === 'case') {
      /* 그룹명 = 이알피 사건유형 이름 — 이알피 「계약서 출력」이 이 이름으로 자동 체크한다. 옛 값은 그대로 둔다(직접 입력 가능).
         ⚠ 보기는 이알피 기본 목록(BIZ_CASE_SEED)이다. 이알피에서 사건유형 이름을 바꾸면 여기 보기에는 안 나온다(직접 입력). */
      grpIn = el('input', { type: 'text', placeholder: '체당금 / 부해등 / 산재등', list: 'pcf-case-groups' }); grpIn.value = f.groupName || '';
      /* ⚠ 짐작한 측은 «굳히지» 않는다 — 사람이 단추를 눌렀을 때만 적는다. 안 그러면 새 양식이 빈 본문의
           짐작(공통)으로 굳어, 나중에 {{근로자명}} 을 넣어도 근로자측 칩에 영영 안 나온다. */
      sideTouched = f.side === 'worker' || f.side === 'employer' || f.side === 'both';
      sideV = sideOf(f);
      sideBox = el('div', { role: 'radiogroup', 'aria-label': '측', style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, SIDES.map(function (s) {
        var r = el('input', { type: 'radio', name: 'pcf-side', value: s.v });
        r.checked = s.v === sideV;
        r.addEventListener('change', function () { if (r.checked) { sideV = s.v; sideTouched = true; } });
        return el('label', { style: 'display:inline-flex;align-items:center;gap:4px;border:1px solid #cbd5e1;border-radius:6px;padding:5px 10px;font-size:12.5px;cursor:pointer' }, [r, s.label]);
      }).concat(sideTouched ? [] : [el('span', { style: 'font-size:11.5px;color:#64748b', text: '지금은 본문 칸으로 짐작한 값입니다 — 누르면 정해집니다' })]));
    }
    var onIn = el('input', { type: 'checkbox' }); onIn.checked = f.enabled !== false;
    var bodyIn = el('textarea', { placeholder: '예시:\n━━━━━━━━━━━━━━━━━━━━\n        사건위임계약서\n━━━━━━━━━━━━━━━━━━━━\n\n위임인: {{회사명}} (대표 {{대표자}})\n계약금액: {{계약금액}}원' });
    bodyIn.value = f.body || '';
    function insertVar(code) {
      var s = bodyIn.selectionStart || 0, e = bodyIn.selectionEnd || 0;
      bodyIn.value = bodyIn.value.slice(0, s) + code + bodyIn.value.slice(e);
      bodyIn.focus(); bodyIn.selectionStart = bodyIn.selectionEnd = s + code.length;
    }
    var attWrap = el('div');
    var pending = 0; // 올리는 중(보관함·읽기)인 파일 수 — 이게 있는 채로 저장하면 첨부가 통째로 빠진다
    function drawAtts() {
      attWrap.innerHTML = '';
      var arcd = {};
      f.originals.forEach(function (o) { if (o.attId) arcd[o.attId] = 1; });
      var only = f.originals.filter(function (o) { return !o.attId; });
      if (!f.attachments.length && !only.length && !pending) { attWrap.appendChild(el('div', { style: 'font-size:11px;color:#94a3b8;margin-top:6px', text: '첨부된 파일 없음' })); return; }
      f.attachments.forEach(function (a) {
        attWrap.appendChild(el('div', { 'class': 'pcf-arow' }, [
          el('span', { text: '📎' }), el('span', { 'class': 'n', text: a.name, title: a.name }),
          arcd[attKey(a)] ? el('span', { 'class': 'pcf-ok', text: '보관함' }) : null,
          el('span', { style: 'color:#94a3b8;font-family:monospace;font-size:10.5px', text: ((a.size || 0) / 1024).toFixed(1) + 'KB' }),
          /\.(hwp|hwpx)$/i.test(a.name || '') ? el('button', { type: 'button', 'class': 'pcf-b g', title: '원본 미리보기', text: '🔍',
            onclick: function () { openHwpPreview(a, function (t) { bodyIn.value = t; }); } }) : null,
          el('button', { type: 'button', 'class': 'pcf-b', style: 'color:#dc2626', text: '×', title: '첨부 빼기 (보관함 사본은 남습니다)',
            onclick: function () { f.attachments = f.attachments.filter(function (x) { return x.id !== a.id; }); drawAtts(); } })
        ]));
      });
      only.forEach(function (o) {
        attWrap.appendChild(el('div', { 'class': 'pcf-arow' }, [
          el('span', { text: '🗄' }), el('span', { 'class': 'n', text: o.name, title: o.name }),
          el('span', { 'class': 'pcf-ok', text: '보관함에만 (1MB 초과)' }),
          el('span', { style: 'color:#94a3b8;font-family:monospace;font-size:10.5px', text: ((o.size || 0) / 1024 / 1024).toFixed(1) + 'MB' }),
          el('button', { type: 'button', 'class': 'pcf-b', style: 'color:#dc2626', text: '×', title: '양식에서 빼기 (보관함 사본은 남습니다)',
            onclick: function () { f.originals = f.originals.filter(function (x) { return x !== o; }); drawAtts(); } })
        ]));
      });
      if (pending > 0) attWrap.appendChild(el('div', { style: 'font-size:11px;color:#94a3b8;margin-top:4px', text: '⏳ 올리는 중… (' + pending + ')' }));
    }
    /* 첨부는 «읽기 끝나는 대로» 곧장 넣는다(보관함 응답을 기다리지 않는다) — 안 그러면
       사람이 그 사이 [저장]을 눌러 첨부 없는 양식이 저장된다(원본 연결만 뒤늦게 붙는다). */
    function addFiles(files) {
      Array.prototype.forEach.call(files || [], function (file) {
        var small = file.size <= ATTACH_MAX;
        if (!small && !opts.archiveFile) { toast(file.name + ': 1MB 초과'); return; }
        var attId = newId('at-');
        var from = { kind: 'form', formId: f.id, formName: nameIn.value.trim() || f.name || file.name, formKind: f.kind };
        pending++; drawAtts();
        var dataP = (small ? readDataUrl(file) : Promise.resolve('')).then(function (dataUrl) {
          if (small) { f.attachments.push({ id: attId, name: file.name, size: file.size, type: file.type, data: dataUrl }); drawAtts(); }
        });
        var arcP = (opts.archiveFile ? opts.archiveFile(file, from) : Promise.resolve({ why: '' })).then(function (arc) {
          if (!small && !arc.fileId) { toast('❌ ' + file.name + ': 1MB 초과 파일은 보관함에만 담을 수 있는데 보관함이 실패했습니다 — ' + arc.why); return; }
          if (arc.fileId) f.originals.push(origEntry(arc.fileId, file, small ? attId : ''));
          else if (arc.why) toast('⚠ ' + file.name + ': 보관함 사본을 못 남겼습니다 — ' + arc.why);
          drawAtts();
        });
        Promise.all([dataP, arcP]).then(function () { pending--; drawAtts(); }, function () { pending--; drawAtts(); });
      });
    }
    var fileIn = el('input', { type: 'file', multiple: true, accept: '.hwpx,.hwp,.xlsx,.xls,.docx,.doc,.pdf', style: 'display:none',
      onchange: function (e) { addFiles(e.target.files); e.target.value = ''; } });
    var drop = el('div', { 'class': 'pcf-drop',
      ondragover: function (e) { e.preventDefault(); drop.style.background = '#eff6ff'; },
      ondragleave: function () { drop.style.background = ''; },
      ondrop: function (e) { e.preventDefault(); e.stopPropagation(); drop.style.background = ''; if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); }
    }, [el('label', { 'class': 'pcf-b b', style: 'display:inline-flex' }, ['+ 파일 추가 (끌어다 놓기도 됩니다)', fileIn]), attWrap]);
    drawAtts();

    function save() {
      if (pending > 0) { toast('파일을 올리는 중입니다 — 끝나면 저장하세요'); return; }
      f.name = nameIn.value.trim(); f.body = bodyIn.value; f.enabled = onIn.checked;
      if (grpIn) { var g = grpIn.value.trim(); if (g) f.groupName = g; else delete f.groupName; }
      if (sideBox && sideTouched && sideV) f.side = sideV;
      if (!f.name) { toast('양식 이름을 넣어 주세요'); nameIn.focus(); return; }
      if (!f.body) { toast('본문을 넣어 주세요'); bodyIn.focus(); return; }
      opts.onSave(f, close);
    }

    var m = el('div', { 'class': 'pcf-m', role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { 'class': 'pcf-mh' }, [el('span', { text: (opts.cur ? '양식 수정' : '양식 추가') + ' - ' + k.icon + ' ' + k.label }),
        el('button', { type: 'button', 'aria-label': '닫기', text: '×', onclick: close })]),
      el('div', { 'class': 'pcf-mb' }, [
        el('div', { style: 'display:grid;grid-template-columns:' + (grpIn ? '1fr 180px' : '1fr') + ';gap:10px' }, [
          el('div', null, [el('label', { 'class': 'l', text: '양식 이름 *' }), nameIn]),
          grpIn ? el('div', null, [el('label', { 'class': 'l', text: '사건유형 (이알피 사건유형과 같은 이름)' }), grpIn,
            el('datalist', { id: 'pcf-case-groups' }, CASE_TYPES.map(function (g) { return el('option', { value: g }); }))]) : null
        ]),
        sideBox ? el('div', null, [el('label', { 'class': 'l', text: '측 (누가 의뢰하는 계약인가)' }), sideBox]) : null,
        el('label', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:10px;font-size:12.5px' }, [onIn, '활성 (계약서 출력 때 고를 수 있음)']),
        el('div', { 'class': 'pcf-vars' }, [
          el('div', { style: 'font-size:11.5px;font-weight:700;color:#475569;margin-bottom:6px', text: '🔖 칸 (누르면 본문 커서 자리에 들어갑니다)' }),
          el('div', null, CONTRACT_FORM_VARS.map(function (v) {
            return el('button', { type: 'button', title: v.desc, text: v.code, onclick: function () { insertVar(v.code); } });
          }))
        ]),
        el('label', { 'class': 'l', text: '본문 (칸은 계약 자료로 바뀝니다) *' }), bodyIn,
        el('label', { 'class': 'l', text: '원본 파일 (HWPX/HWP/XLSX/DOCX/PDF · 올리면 원본 보관함에 사본이 영구 보관됩니다 · 1MB 초과는 보관함에만)' }), drop
      ]),
      el('div', { 'class': 'pcf-mf' }, [
        el('button', { type: 'button', 'class': 'pcf-b', text: '취소', onclick: close }),
        el('button', { type: 'button', 'class': 'pcf-b b', style: 'background:#1e40af;color:#fff', text: '저장', onclick: save })
      ])
    ]);
    bg.appendChild(m);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.body.appendChild(bg);
    setTimeout(function () { nameIn.focus(); }, 0);
  }

  /* ── 📝 채워서 받기 — 기업정보함에서 회사·담당자·근로자를 골라 채운다 (대표 지시 2026-09-27, 목업 승인) ──
     규칙·값 함수는 js/pu-form-cardfill.js(순수). 여기는 그리기만.
     host.cards.rows()        → 기업정보함 검색목록(pucards/idx) 줄들 (한 번 읽고 캐시)
     host.cards.coInfo(keys)  → 고른 회사 딸림정보 한 칸씩 [값…]
     host.hwpBytes(src)       → 한글 원본 바이트 (첨부 data 또는 보관함 fileId)
     host.hwpMarkers(u8,name) → 문서 속 표지 이름들
     host.hwpFill(u8,name,V)  → { bytes, unknown, relayoutFailed }
     host.hwpShow(el,u8,name) → 채운 파일 미리보기
     ⚠ 채운 값은 저장하지 않는다 — 내려받는 파일에만 들어간다. 기업정보함에는 쓰지 않는다. */
  function ensureCss() {
    if (document.getElementById('pcf-css')) return;
    var st = document.createElement('style'); st.id = 'pcf-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  function hwpSources(fm) {
    var out = [];
    (fm.attachments || []).forEach(function (a) {
      if (/\.(hwp|hwpx|xlsx)$/i.test(a.name || '') && (a.data || a.dataUrl)) out.push({ name: a.name, data: a.data || a.dataUrl });
    });
    (fm.originals || []).forEach(function (o) {
      if (/\.(hwp|hwpx|xlsx)$/i.test(o.name || '') && o.fileId && !out.some(function (x) { return x.name === o.name; }))
        out.push({ name: o.name, fileId: o.fileId });
    });
    return out;
  }
  function openFill(fm, host) {
    var CF = w.PuFormCardFill;
    if (!CF || !host.cards) { toast('ERP 업체정보 연결을 불러오지 못했습니다'); return; }
    ensureCss();
    var srcs = hwpSources(fm), src = srcs[0] || null;
    var st = { rows: null, co: null, coX: {}, contact: null, worker: null, markers: CF.markersIn(fm.body), edits: {}, hwp: null };
    var bg = el('div', { 'class': 'pcf-mbg' });
    function close() { document.removeEventListener('keydown', onKey); bg.remove(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    var coQ = el('input', { type: 'search', placeholder: '회사 이름·사업자번호·대표자', 'aria-label': '회사 찾기' });
    var coList = el('div', { 'class': 'pcf-fl' });
    var coPicked = el('div');
    var ctBox = el('div', { 'class': 'pcf-fl' });
    var wkQ = el('input', { type: 'search', placeholder: '근로자 이름·휴대폰', 'aria-label': '근로자 찾기' });
    var wkList = el('div', { 'class': 'pcf-fl' });
    var valBox = el('div');
    var note = el('div', { 'class': 'pcf-fnote' });
    var prevBox = el('div', { 'class': 'pcf-fprev', hidden: true });

    function values() {
      var co = st.co ? Object.assign({}, st.coX, st.co) : {};
      var V = CF.valuesFrom({ co: co, contact: st.contact, worker: st.worker });
      Object.keys(st.edits).forEach(function (k) { V[k] = st.edits[k]; });
      return V;
    }
    function allMarkers() {
      var seen = {}, out = [];
      st.markers.concat(st.hwp ? st.hwp.markers : []).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
      return out;
    }
    function drawVals() {
      valBox.innerHTML = '';
      var V = values(), ks = allMarkers();
      if (!ks.length) { valBox.appendChild(el('div', { 'class': 'pcf-muted', text: '이 양식에는 채울 자리가 없습니다' })); return; }
      valBox.appendChild(el('div', { 'class': 'pcf-fh', text: '채울 자리 ' + ks.length + '곳 — 고칠 수 있습니다' }));
      ks.forEach(function (k) {
        var inp = el('input', { type: 'text', 'aria-label': k, placeholder: CF.BLANK + ' (비워 두면 밑줄)' });
        inp.value = V[k] == null ? '' : V[k];
        inp.addEventListener('input', function () { st.edits[k] = inp.value; });
        valBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { 'class': V[k] ? '' : 'miss', text: k }), inp]));
      });
    }
    function rowBtn(label, sub, on, fn) {
      return el('button', { type: 'button', 'class': 'pcf-fi' + (on ? ' on' : ''), onclick: fn }, [el('b', { text: label }), sub ? el('span', { text: sub }) : null]);
    }
    function clearEdits(ks) { ks.forEach(function (k) { delete st.edits[k]; }); }
    function drawContacts() {
      ctBox.innerHTML = '';
      if (!st.co) { ctBox.appendChild(el('div', { 'class': 'pcf-muted', text: '회사를 먼저 고르세요' })); return; }
      var cs = CF.contactsOf(st.rows || [], st.co);
      if (!cs.length) { ctBox.appendChild(el('div', { 'class': 'pcf-muted', text: '이 회사 명함이 없습니다 — 오른쪽 칸에 적으세요' })); return; }
      cs.slice(0, 30).forEach(function (r) {
        ctBox.appendChild(rowBtn(r.n + (r.ti ? ' ' + r.ti : ''), r.m || r.t || r.e || '', st.contact === r, function () {
          st.contact = st.contact === r ? null : r; clearEdits(['담당자', '담당자연락처', '담당자이메일']); drawContacts(); drawVals();
        }));
      });
    }
    function coSub(r) {
      return [r.bz ? CF.valuesFrom({ co: r }).사업자번호 : '', r.ceo ? '대표 ' + r.ceo : '', r.k === 'card-co' ? '명함에만 있는 회사' : ''].filter(Boolean).join(' · ');
    }
    function pickCo(r) {
      st.co = r; st.coX = {}; st.contact = null;
      clearEdits(['회사명', '사업자번호', '대표자', '대표자전체', '주소', '대표전화', '대표팩스', '대표이메일', '업태', '종목', '법인등록번호', '규모', '담당자', '담당자연락처', '담당자이메일']);
      coList.innerHTML = ''; coQ.value = '';
      coPicked.innerHTML = '';
      coPicked.appendChild(el('div', { 'class': 'pcf-fpick' }, [
        el('b', { text: r.c || '(이름 없음)' }), el('span', { text: coSub(r) }),
        el('button', { type: 'button', 'class': 'pcf-b', text: '바꾸기', onclick: function () { st.co = null; st.contact = null; coPicked.innerHTML = ''; drawContacts(); drawVals(); coQ.focus(); } })
      ]));
      drawContacts(); drawVals();
      var keys = CF.coInfoKeys(r);
      if (keys.length) host.cards.coInfo(keys).then(function (vals) {
        if (st.co !== r) return;
        st.coX = CF.mergeCoInfo(vals); drawVals();
      }, function () {});
    }
    function withRows(fn) {
      if (st.rows) { fn(st.rows); return; }
      note.textContent = 'ERP 업체정보 불러오는 중…';
      host.cards.rows().then(function (rows) { st.rows = CF.rowsOf(rows); note.textContent = ''; fn(st.rows); },
        function (e) { note.textContent = '⚠ ERP 업체정보를 읽지 못했습니다 — ' + ((e && e.message) || e); });
    }
    var coT = null, wkT = null;
    coQ.addEventListener('input', function () {
      clearTimeout(coT); coT = setTimeout(function () {
        withRows(function (rows) {
          coList.innerHTML = '';
          var hits = CF.searchCompanies(rows, coQ.value, 12);
          if (coQ.value.trim() && !hits.length) coList.appendChild(el('div', { 'class': 'pcf-muted', text: '찾는 회사가 없습니다' }));
          hits.forEach(function (r) { coList.appendChild(rowBtn(r.c || '(이름 없음)', coSub(r), false, function () { pickCo(r); })); });
        });
      }, 200);
    });
    wkQ.addEventListener('input', function () {
      clearTimeout(wkT); wkT = setTimeout(function () {
        withRows(function (rows) {
          wkList.innerHTML = '';
          var hits = CF.searchPeople(rows, wkQ.value, 10);
          if (wkQ.value.trim() && !hits.length) wkList.appendChild(el('div', { 'class': 'pcf-muted', text: '없습니다 — 오른쪽 칸에 바로 적으세요' }));
          hits.forEach(function (r) {
            wkList.appendChild(rowBtn(r.n, [r.c || '', r.m || ''].filter(Boolean).join(' · '), false, function () {
              st.worker = r; clearEdits(['근로자명', '근로자이름', '이름', '근로자명단', '근로자연락처', '근로자주소', '근로자수', '근로자상세']);
              wkList.innerHTML = ''; wkQ.value = r.n; drawVals();
            }));
          });
        });
      }, 200);
    });

    var srcSel = null, btnPrev = null, btnDown = null;
    if (srcs.length > 1) {
      srcSel = el('select', { 'aria-label': '채울 원본', onchange: function () { src = srcs[+srcSel.value]; loadHwp(); syncBtns(); } },
        srcs.map(function (s, i) { return el('option', { value: String(i), text: s.name }); }));
    }
    function loadHwp(tried) {
      st.hwp = null; drawVals();
      if (!src) return;
      note.textContent = '한글 원본 살펴보는 중…';
      var my = src;
      host.hwpBytes(src).then(function (u8) {
        return host.hwpMarkers(u8, my.name).then(function (ks) { return { bytes: u8, markers: ks || [] }; });
      }).then(function (h) {
        if (src !== my) return;
        st.hwp = h;
        note.textContent = h.markers.length ? '' : '⚠ ' + kindWord() + ' 원본에 채울 자리(회사명 같은 표시)가 없습니다 — 원본에 표시를 넣으면 채워집니다';
        drawVals();
      }, function (e) {
        var used = tried || [], next = srcs.filter(function (s) { return used.indexOf(s) < 0 && s !== my; })[0];
        if (src !== my) return;
        if (next) {
          note.textContent = '원본 한 벌을 못 찾아 다른 보관본을 확인하는 중…'; src = next;
          if (srcSel) srcSel.value = String(srcs.indexOf(next)); syncBtns(); loadHwp(used.concat([my])); return;
        }
        note.textContent = '⚠ 원본을 찾지 못했습니다 — 양식 수정에서 원본 파일을 다시 올려 주세요 (' + ((e && e.message) || e) + ')';
      });
    }
    function isXl() { return !!src && /\.xlsx$/i.test(src.name || ''); }
    function kindWord() { return isXl() ? '엑셀' : '한글'; }
    function fillHwp() {
      if (!st.hwp) return Promise.reject(new Error(src ? '한글 원본을 아직 읽는 중입니다' : '이 양식에는 한글 원본이 없습니다'));
      return host.hwpFill(st.hwp.bytes, src.name, CF.hwpValues(st.hwp.markers, values()));
    }
    function outName() {
      var V = values();
      return CF.safeName(fm.name + (V.회사명 ? '_' + V.회사명 : '') + (V.근로자명 ? '_' + V.근로자명 : '')) + (isXl() ? '.xlsx' : '.hwp');
    }
    function warnOf(r) {
      if (r.unknown && r.unknown.length) toast('⚠ 못 채운 자리 ' + r.unknown.length + '곳(표 속 표일 수 있음): ' + r.unknown.join(', '));
      else if (r.relayoutFailed) toast('⚠ 줄 다시 나누기를 못 해 원본 줄 정보로 냈습니다');
    }
    function doPreview() {
      if (!src) {   // 한글 원본이 없으면 글자 본문을 채워 보여 준다
        prevBox.hidden = false; prevBox.innerHTML = '';
        prevBox.appendChild(el('pre', { 'class': 'pcf-body', text: CF.fillText(fm.body, values()) }));
        return;
      }
      note.textContent = '채우는 중…';
      fillHwp().then(function (r) {
        note.textContent = ''; warnOf(r);
        prevBox.hidden = false; prevBox.innerHTML = '';
        return host.hwpShow(prevBox, r.bytes, outName());
      }).catch(function (e) { note.textContent = '⚠ ' + ((e && e.message) || e); });
    }
    function doDownload() {
      note.textContent = '채우는 중…';
      fillHwp().then(function (r) {
        note.textContent = ''; warnOf(r);
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.bytes], { type: isXl() ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/x-hwp' }));
        a.download = outName(); document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        toast('내려받았습니다 — ' + a.download);
      }).catch(function (e) { note.textContent = '⚠ ' + ((e && e.message) || e); });
    }
    function copyText() {
      var t = CF.fillText(fm.body, values());
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject(new Error('복사 기능이 없습니다')))
        .then(function () { toast('채운 본문을 복사했습니다'); }, function (e) { toast('⚠ ' + ((e && e.message) || e)); });
    }

    var m = el('div', { 'class': 'pcf-m', role: 'dialog', 'aria-label': '채워서 받기', style: 'width:980px' }, [
      el('div', { 'class': 'pcf-mh' }, [el('span', { text: '📝 채워서 받기 · ' + (fm.name || '') }),
        el('small', { style: 'font-weight:400;color:#64748b;margin-right:8px', text: src ? '원본: ' + src.name : '한글 원본 없음 — 글자 본문을 채웁니다' }),
        el('button', { type: 'button', 'aria-label': '닫기', text: '×', onclick: close })]),
      el('div', { 'class': 'pcf-mb' }, [
        srcSel ? el('div', { style: 'margin-bottom:8px' }, [el('span', { 'class': 'pcf-fh', text: '채울 원본 ' }), srcSel]) : null,
        el('div', { 'class': 'pcf-fcols' }, [
          el('div', null, [
            el('div', { 'class': 'pcf-fh', text: '① 회사 — ERP 업체관리에서 찾기' }), coQ, coList, coPicked,
            el('div', { 'class': 'pcf-fh', text: '② 담당자 — 이 회사 명함' }), ctBox,
            el('div', { 'class': 'pcf-fh', text: '③ 근로자 본인 — 명함에서 찾기 또는 직접 적기' }), wkQ, wkList
          ]),
          valBox
        ]),
        note, prevBox
      ]),
      el('div', { 'class': 'pcf-mf' }, [
        el('button', { type: 'button', 'class': 'pcf-b', text: '닫기', onclick: close }),
        fm.body ? el('button', { type: 'button', 'class': 'pcf-b', text: '본문 복사', onclick: copyText }) : null,
        btnPrev = el('button', { type: 'button', 'class': 'pcf-b', text: src ? kindWord() + '로 열어 보기' : '채운 본문 보기', onclick: doPreview }),
        btnDown = src ? el('button', { type: 'button', 'class': 'pcf-b b', style: 'background:#1e40af;color:#fff', text: kindWord() + ' 파일 내려받기', onclick: doDownload }) : null
      ])
    ]);
    function syncBtns() {
      if (btnPrev && src) btnPrev.textContent = kindWord() + '로 열어 보기';
      if (btnDown) btnDown.textContent = kindWord() + ' 파일 내려받기';
    }
    bg.appendChild(m);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.body.appendChild(bg);
    drawContacts(); drawVals(); loadHwp();
    setTimeout(function () { coQ.focus(); }, 0);
  }

  /* ══ 양식 관리 화면 — host: { db, track?, tree?, selected?, onSelect?, archive?, downloadOriginal? } ══
     왼쪽 트리(host.tree)에서 고르고, 오른쪽(root)에 A4 종이 한 장으로 크게 본다 (대표 지시 2026-09-26) */
  function mount(root, host) {
    var db = host.db;
    var track = host.track || function (p) { return p; };
    ensureCss();
    /* C안 — 메뉴(host.tree)는 계약유형 6종까지, 측·사건유형은 본문 위 칩, 양식은 본문 목록 (대표 결정 2026-09-27) */
    var S = { forms: [], removed: [], sel: host.selected || null, kind: 'company', side: 'all', grp: 'all', q: '',
      view: loadView(), loaded: false, err: null, bodyEl: null };

    function loadView() { try { return localStorage.getItem('pcf_view') === 'card' ? 'card' : 'list'; } catch (_) { return 'list'; } }
    function saveView() { try { localStorage.setItem('pcf_view', S.view); } catch (_) {} }
    function cur() { return S.sel ? S.forms.filter(function (x) { return x.id === S.sel; })[0] || null : null; }
    function curKind() { return S.kind; }
    function shown() { return filterForms(S.forms, { kind: S.kind, side: S.side, grp: S.grp, q: S.q }); }
    function resetFilters() { S.side = 'all'; S.grp = 'all'; S.q = ''; }

    function load() {
      S.err = null;
      return Promise.all([db.ref(PATH).once('value'), db.ref(PATH_RM).once('value')]).then(function (r) {
        var cf = r[0].val(), rm = r[1].val();
        S.removed = listOf(rm && rm.v);
        S.forms = mergeSeeds(listOf(cf && cf.v), S.removed).list;
        S.loaded = true;
        var fm = cur();
        if (S.sel && !fm) { S.sel = null; if (host.onSelect) host.onSelect(null); }
        if (fm) S.kind = fm.kind;
        /* 고른 것이 없으면 첫 양식을 «보여만» 준다 — host 에 알리지 않는다(다른 칸을 보는 중이면 끌려온다) */
        else { var f0 = shown()[0]; S.sel = f0 ? f0.id : null; }
        drawTree(); drawMain();
      }).catch(function (e) { S.err = (e && e.message) || String(e); drawTree(); drawMain(); });
    }
    /* 한 번 고치고 → 서버가 돌려준 목록으로 다시 그린다 */
    function change(fn, okMsg, undo) {
      return track(changeForms(db, S.removed, fn)).then(function (list) {
        S.forms = list;
        if (S.sel && !cur()) S.sel = null;
        /* 마지막 양식이 지워지거나 옮겨 가 사라진 사건유형 칩을 계속 누른 채로 두지 않는다 */
        if (S.grp !== 'all' && !facetCounts(S.forms, S.kind, S.side).groups.some(function (g) { return g.name === S.grp; })) S.grp = 'all';
        drawTree(); drawMain();
        if (okMsg) toast(okMsg, undo);
        return list;
      }).catch(function (e) { toast('⚠ 저장 실패 — ' + ((e && e.message) || e)); throw e; });
    }
    function select(id) {
      S.sel = id || null;
      var fm = cur();
      if (fm && fm.kind !== S.kind) { S.kind = fm.kind; resetFilters(); }
      /* 칩(측·사건유형)에 가려진 양식을 골랐으면 칩을 푼다 — 종이에는 뜨는데 목록에는 없는 일이 없게.
         (이름 찾기로 가려진 것은 그대로 둔다 — 글자를 칠 때마다 선택이 바뀌면 안 된다) */
      if (fm && (S.side !== 'all' || S.grp !== 'all') && shown().indexOf(fm) < 0) { S.side = 'all'; S.grp = 'all'; }
      drawTree(); drawMain();
      if (host.onSelect) host.onSelect(S.sel);
    }
    function pickKind(v) {
      S.kind = v; resetFilters();
      var f0 = shown()[0];
      select(f0 ? f0.id : null);
    }
    /* 칩을 바꾸면 — 고른 양식이 목록에서 빠졌으면 목록 첫 양식으로 옮긴다 */
    function setFilter(p) {
      Object.keys(p).forEach(function (k) { S[k] = p[k]; });
      var list = shown(), fm = cur();
      if (!fm || list.indexOf(fm) < 0) { select(list[0] ? list[0].id : null); return; }
      drawMain();
    }
    /* 파일 하나를 보관함에 — 실패는 던지지 않고 {why} 로 돌려준다(양식 저장은 계속한다) */
    function archiveFile(file, from) {
      if (!host.archive) return Promise.resolve({ why: '' });
      return readBytes(file).then(function (bytes) {
        return host.archive({ name: file.name, size: file.size, type: file.type || '', bytes: bytes }, from);
      }).then(function (r) { return { fileId: r && r.fileId }; }, function (e) { return { why: (e && e.message) || String(e) }; });
    }

    function save(form, close) {
      change(function (list) {
        var at = -1;
        list.forEach(function (x, i) { if (x.id === form.id) at = i; });
        if (at >= 0) list[at] = form; else list.push(form);
        return list;
      }, '저장했습니다').then(function () { close(); select(form.id); }, function () {});
    }
    function copy(fm) {
      var c = JSON.parse(JSON.stringify(fm)); c.id = 'fm-copy-' + Date.now(); c.name = fm.name + ' (복사)';
      change(function (list) { return list.concat([c]); }, '복제했습니다').then(function () { select(c.id); }, function () {});
    }
    function del(fm) {
      if (!w.confirm('"' + fm.name + '" 양식을 지울까요?\n(올린 원본은 원본 보관함에 그대로 남습니다)')) return;
      var seed = isSeedId(fm.id);
      var p = seed ? track(changeRemoved(db, function (rm) { if (rm.indexOf(fm.id) < 0) rm.push(fm.id); return rm; }))
                      .then(function (rm) { S.removed = rm; }) : Promise.resolve();
      p.then(function () {
        return change(function (list) { return list.filter(function (x) { return x.id !== fm.id; }); }, '🗑️ 양식을 지웠습니다', function () {
          /* 되돌리기 — «그 한 건»만 다시 넣는다(통째로 되돌리면 그사이 남이 고친 것을 지운다) */
          var q = seed ? track(changeRemoved(db, function (rm) { return rm.filter(function (x) { return x !== fm.id; }); }))
                           .then(function (rm) { S.removed = rm; }) : Promise.resolve();
          q.then(function () {
            return change(function (list) { return list.some(function (x) { return x.id === fm.id; }) ? list : list.concat([fm]); }, '되돌렸습니다');
          }).then(function () { select(fm.id); }).catch(function () {});
        });
      }).then(function () {
        /* ⚠ change() 가 성공한 «뒤에만» 고른 것을 놓는다 — 실패했으면(네트워크 등)
           양식은 그대로 남아 있으므로 고른 것도 그대로 둔다. */
        if (S.sel === fm.id) S.sel = null;
        if (host.onSelect) host.onSelect(S.sel);
      }).catch(function (e) { toast('⚠ 지우지 못했습니다 — ' + ((e && e.message) || e)); });
    }
    function reseedChedang() {
      if (!w.confirm('체당금 양식 4개를 새로 등록(또는 덮어쓰기)합니다.\n\n계속할까요?')) return;
      var added = 0;
      change(function (list) {
        added = 0;
        CASE_CHEDANG_FORMS.forEach(function (s) {
          var at = -1;
          list.forEach(function (x, i) { if (x.id === s.id) at = i; });
          if (at >= 0) list[at] = JSON.parse(JSON.stringify(s)); else { list.push(JSON.parse(JSON.stringify(s))); added++; }
        });
        return list;
      }).then(function () { toast(added ? ('체당금 양식 ' + added + '개 추가') : '체당금 양식 갱신'); }).catch(function () {});
    }
    function quickUpload(kind, files) {
      var arr = Array.prototype.slice.call(files || []);
      if (!arr.length) return;
      toast('📎 ' + arr.length + '개 파일 읽는 중…');
      var jobs = arr.map(function (file) {
        var id = newId('fm-'), name = file.name.replace(/\.[^.]+$/, ''), attId = newId('at-');
        var small = file.size <= ATTACH_MAX;
        if (!small && !host.archive) { toast(file.name + ': 1MB 초과'); return Promise.resolve(null); }
        return Promise.all([
          small ? readDataUrl(file) : Promise.resolve(''),
          new Promise(function (res) { extractTemplateText(file, function (t, err) { res(err ? null : (t || '')); }); }),
          archiveFile(file, { kind: 'form', formId: id, formName: name, formKind: kind })
        ]).then(function (r) {
          var arc = r[2];
          if (!small && !arc.fileId) { toast('❌ ' + file.name + ': 1MB 초과 파일은 보관함에만 담을 수 있는데 보관함이 실패했습니다 — ' + arc.why); return null; }
          return { warn: r[1] == null, arcWhy: arc.fileId ? '' : (arc.why || ''), form: {
            id: id, kind: kind, name: name, body: r[1] || '',
            attachments: small ? [{ id: attId, name: file.name, size: file.size, type: file.type, data: r[0] }] : [],
            originals: arc.fileId ? [origEntry(arc.fileId, file, small ? attId : '')] : [],
            enabled: true, createdAt: todayYMD() } };
        });
      });
      Promise.all(jobs).then(function (rs) {
        rs = rs.filter(Boolean);
        if (!rs.length) return;
        var warns = rs.filter(function (r) { return r.warn; }).length;
        var arcFail = rs.filter(function (r) { return r.arcWhy; });
        change(function (list) { return list.concat(rs.map(function (r) { return r.form; })); },
          rs.length + '개 양식 등록' + (warns ? ' · ' + warns + '개는 글자를 못 뽑아 첨부만 저장' : '')
            + (arcFail.length ? ' · ⚠ 보관함 사본 ' + arcFail.length + '개 실패 — ' + arcFail[0].arcWhy : ''))
          .then(function () { select(rs[rs.length - 1].form.id); }, function () {});
      });
    }
    function filesOf(e) { return e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length ? e.dataTransfer.files : null; }
    function modal(o) { o.archiveFile = archiveFile; openModal(o); }

    /* ── 왼쪽 메뉴 — 계약유형만(양식 이름은 본문 목록) ── */
    function drawTree() {
      var t = host.tree; if (!t) return;
      t.innerHTML = '';
      if (!S.loaded) return;
      KINDS.forEach(function (k) {
        var n = S.forms.filter(function (f) { return f.kind === k.v; }).length;
        var on = S.kind === k.v;
        t.appendChild(el('button', { type: 'button', 'class': 'pcf-tk' + (on ? ' on' : ''), 'aria-current': on ? 'true' : null,
          onclick: function () { pickKind(k.v); } }, [el('span', { text: k.icon + ' ' + k.label }), el('i', { text: String(n) })]));
      });
    }

    /* ── 오른쪽 ── */
    function mobileSelects() {
      var kSel = el('select', { 'aria-label': '계약 종류', onchange: function () { pickKind(kSel.value); } }, KINDS.map(function (k) {
        var n = S.forms.filter(function (x) { return x.kind === k.v; }).length;
        return el('option', { value: k.v, text: k.icon + ' ' + k.label + ' (' + n + ')', selected: k.v === S.kind });
      }));
      return el('div', { 'class': 'pcf-msel' }, [kSel]);
    }
    function uploadBtn(kind) {
      var upIn = el('input', { type: 'file', multiple: true, accept: '.hwpx,.hwp,.xlsx,.xls,.docx,.doc,.pdf', style: 'display:none',
        onchange: function (e) { quickUpload(kind, e.target.files); e.target.value = ''; } });
      var b = el('label', { 'class': 'pcf-b g', title: '📎 파일을 이 단추 위로 끌어다 놓아도 됩니다\n· HWPX · HWP · XLSX · DOCX · DOC · PDF\n· 올리면 원본 보관함에 사본이 영구 보관됩니다\n· 1MB 초과는 보관함에만 담깁니다',
        ondragover: function (e) { e.preventDefault(); b.style.background = '#bbf7d0'; },
        ondragleave: function () { b.style.background = ''; },
        ondrop: function (e) { e.preventDefault(); b.style.background = ''; var fl = filesOf(e); if (fl) quickUpload(kind, fl); } },
        ['📎 파일 업로드', upIn]);
      return b;
    }
    /* 제목 줄 «하나» — 제목 · 원본 첨부 · 채워서 받기/수정/복제/삭제 (한 화면에 보이게, 2026-09-27) */
    function toolbar(fm) {
      var kind = curKind(), k = kindInfo(kind);
      var strip = el('div', { 'class': 'pcf-strip' });
      if (fm) {
        var arcd = {};
        (fm.originals || []).forEach(function (o) { if (o.attId) arcd[o.attId] = 1; });
        (fm.attachments || []).forEach(function (a) {
          strip.appendChild(el('a', { 'class': 'pcf-att', href: a.data || a.dataUrl || '#', download: a.name || '첨부', text: '📥 ' + (a.name || '첨부') }));
          if (/\.(hwp|hwpx)$/i.test(a.name || '')) strip.appendChild(el('button', { type: 'button', 'class': 'pcf-b g', title: '한글 원본 미리보기', text: '🔍', onclick: function () { openHwpPreview(a, null); } }));
          if (arcd[attKey(a)]) strip.appendChild(el('span', { 'class': 'pcf-ok', text: '✓ 보관함' }));
        });
        (fm.originals || []).filter(function (o) { return !o.attId; }).forEach(function (o) {
          strip.appendChild(el('button', { type: 'button', 'class': 'pcf-att', style: 'border:none;cursor:pointer', title: '원본 보관함에서 내려받기',
            text: '🗄 ' + o.name, onclick: function () { if (host.downloadOriginal) host.downloadOriginal(o.fileId, o.name); else toast('보관함이 연결되지 않았습니다'); } }));
        });
        if (!strip.childNodes.length) strip.appendChild(el('span', { text: '원본 파일 없음' }));
      }
      return el('div', { 'class': 'pcf-top' }, fm ? [
        el('b', { title: fm.name }, [el('span', { style: 'color:' + k.color, text: k.icon + ' ' + k.label + ' · ' }), fm.name]),
        strip,
        host.cards ? el('button', { type: 'button', 'class': 'pcf-act', style: 'background:#166534', title: '기업정보함에서 회사·담당자·근로자를 골라 채웁니다', text: '📝 채워서 받기', onclick: function () { openFill(fm, host); } }) : null,
        el('button', { type: 'button', 'class': 'pcf-act', style: 'background:#1e40af', text: '수정', onclick: function () { modal({ kind: fm.kind, cur: fm, onSave: save }); } }),
        el('button', { type: 'button', 'class': 'pcf-act', style: 'background:#166534', text: '복제', onclick: function () { copy(fm); } }),
        el('button', { type: 'button', 'class': 'pcf-act', style: 'background:#dc2626', text: '삭제', onclick: function () { del(fm); } })
      ].concat(rareTools(kind)) : [el('b', { text: k.icon + ' ' + k.label + ' 양식' }), el('span', { 'class': 'pcf-strip', text: '목록에서 양식을 고르세요' })].concat(rareTools(kind)));
    }
    /* 드물게 쓰는 도구 — 제목 줄 끝(칩 줄을 한 줄로 두려고) */
    function rareTools(kind) {
      return [el('button', { type: 'button', 'class': 'pcf-b', title: 'rhwp(한글 미리보기 엔진) 최신 판 확인', text: 'rhwp v' + rhwpVer() + ' ⟳', onclick: rhwpUpdatePrompt }),
        kind === 'case' ? el('button', { type: 'button', 'class': 'pcf-b y', title: '체당금 기본 양식 4개를 다시 넣습니다', text: '📥 체당금 시드', onclick: reseedChedang }) : null];
    }
    function paper(fm) {
      var sheet = el('div', { 'class': 'pcf-sheet' });
      if (fm.enabled === false) sheet.appendChild(el('div', { 'class': 'pcf-offband', text: '사용 안 함 — 계약서 출력 때 고를 수 없습니다' }));
      var pre = el('pre', { 'class': 'pcf-body' });
      var parts = splitVars(fm.body);
      if (!parts.length) pre.appendChild(el('span', { 'class': 'pcf-muted', text: '본문 없음 — [수정]에서 넣으세요' }));
      parts.forEach(function (p) {
        pre.appendChild(p.v ? el('span', { 'class': 'pcf-v', text: p.t }) : document.createTextNode(p.t));
      });
      sheet.appendChild(pre);
      var wrap = el('div', { 'class': 'pcf-sheetwrap',
        ondragover: function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault(); },
        ondrop: function (e) { var fl = filesOf(e); if (fl) { e.preventDefault(); quickUpload(fm.kind, fl); } } }, [sheet]);
      return wrap;
    }
    function sideShort(v) { return v === 'worker' ? '근로자' : v === 'employer' ? '사용자' : '공통'; }
    function chip(label, on, fn) {
      return el('button', { type: 'button', 'class': 'pcf-chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: fn }, [label]);
    }
    /* 칩 줄 «하나» — 사건계약: 측 칩 | 사건유형 칩(고른 측 안에서 센 수). 모든 종류: 이름 찾기 · 목록/카드 · 올리기·추가 도구.
       넓은 화면에서는 한 줄, 좁으면 줄바꿈한다(한 화면에 보이게, 2026-09-27) */
    function filterBar() {
      var kind = S.kind, row = [];
      if (kind === 'case') {
        var fc = facetCounts(S.forms, 'case', S.side);
        row.push(el('span', { 'class': 'pcf-cgrp', role: 'group', 'aria-label': '측' },
          [chip('전체 ' + fc.sides.all, S.side === 'all', function () { setFilter({ side: 'all', grp: 'all' }); })].concat(SIDES.map(function (sd) {
            return chip(sd.label + ' ' + fc.sides[sd.v], S.side === sd.v, function () { setFilter({ side: sd.v, grp: 'all' }); });
          }))));
        row.push(el('span', { 'class': 'pcf-fsep' }));
        row.push(el('span', { 'class': 'pcf-cgrp', role: 'group', 'aria-label': '사건유형' },
          [chip('모든 유형', S.grp === 'all', function () { setFilter({ grp: 'all' }); })].concat(fc.groups.map(function (g) {
            return chip(g.name + ' ' + g.count, S.grp === g.name, function () { setFilter({ grp: g.name }); });
          }))));
      }
      var q = el('input', { type: 'search', 'class': 'pcf-q', placeholder: '양식 이름 찾기', 'aria-label': '양식 이름 찾기', value: S.q });
      /* 글자를 칠 때마다 본문만 다시 그린다 — 칩 줄까지 그리면 찾기 칸 커서가 사라진다 */
      q.addEventListener('input', function () { S.q = q.value; drawBody(); });
      row.push(q);
      row.push(el('span', { 'class': 'pcf-cgrp', role: 'group', 'aria-label': '보기' }, [
        chip('목록', S.view === 'list', function () { S.view = 'list'; saveView(); drawMain(); }),
        chip('카드', S.view === 'card', function () { S.view = 'card'; saveView(); drawMain(); })]));
      row.push(el('span', { 'class': 'pcf-tools' }, [
        uploadBtn(kind),
        el('button', { type: 'button', 'class': 'pcf-b b', text: '+ 양식 추가', onclick: function () { modal({ kind: kind, onSave: save }); } })]));
      return el('div', { 'class': 'pcf-fbar' }, [el('div', { 'class': 'pcf-crow' }, row)]);
    }
    function listCol(list) {
      var col = el('div', { 'class': 'pcf-list' });
      if (!list.length) col.appendChild(el('div', { 'class': 'pcf-muted', style: 'padding:14px;font-size:12px', text: '맞는 양식이 없습니다' }));
      var prev = null;
      list.forEach(function (f) {
        if (S.kind === 'case') {
          var g = groupOf(f);
          if (g !== prev) { prev = g; col.appendChild(el('div', { 'class': 'pcf-lg', text: g })); }
        }
        var on = S.sel === f.id, sd = sideOf(f);
        col.appendChild(el('button', { type: 'button', 'class': 'pcf-li' + (on ? ' on' : '') + (f.enabled === false ? ' off' : ''),
          title: f.name + (f.enabled === false ? ' (사용 안 함)' : ''), 'aria-current': on ? 'true' : null, onclick: function () { select(f.id); } }, [
          el('span', { 'class': 'pcf-ln', text: f.name }),
          sd && S.side === 'all' ? el('span', { 'class': 'pcf-sd ' + sd, text: sideShort(sd) }) : null]));
      });
      col.appendChild(el('button', { type: 'button', 'class': 'pcf-li add', text: '+ 새 양식', onclick: function () { modal({ kind: S.kind, onSave: save }); } }));
      return col;
    }
    function cardGrid(list) {
      var grid = el('div', { 'class': 'pcf-cards' });
      if (!list.length) grid.appendChild(el('div', { 'class': 'pcf-none', style: 'grid-column:1/-1', text: '맞는 양식이 없습니다' }));
      list.forEach(function (f) {
        var sd = sideOf(f);
        grid.appendChild(el('button', { type: 'button', 'class': 'pcf-card' + (S.sel === f.id ? ' on' : ''), title: f.name + ' — 누르면 크게 봅니다',
          onclick: function () { S.view = 'list'; saveView(); select(f.id); } }, [
          el('div', { 'class': 'pcf-thumb', text: String(f.body || '본문 없음').slice(0, 260) }),
          el('div', { 'class': 'pcf-cn' }, [el('span', { 'class': 'pcf-ln', text: f.name }), sd ? el('span', { 'class': 'pcf-sd ' + sd, text: sideShort(sd) }) : null])]));
      });
      return grid;
    }
    function drawBody() {
      var box = S.bodyEl; if (!box) return;
      box.innerHTML = '';
      var list = shown(), fm = cur();
      if (S.view === 'card') box.appendChild(cardGrid(list));
      else box.appendChild(el('div', { 'class': 'pcf-cols' }, [listCol(list),
        fm ? paper(fm) : el('div', { 'class': 'pcf-sheetwrap' }, [el('div', { 'class': 'pcf-none', text: '목록에서 양식을 고르세요' })])]));
      fitHeight();
    }
    /* 목록·종이(또는 카드)를 화면 아래 끝까지만 — 그 안에서 스크롤한다. 페이지 전체가 아래로 늘어나면
       종이 끝을 보려고 제목·칩이 화면 밖으로 밀려난다. 휴대폰(세로로 쌓는 화면)은 묶지 않는다. */
    function fitHeight() {
      var box = S.bodyEl; if (!box || !box.isConnected) return;
      if (w.innerWidth <= 700) { box.style.height = ''; return; }
      var top = box.getBoundingClientRect().top + (w.pageYOffset || 0);
      var h = Math.max(320, w.innerHeight - top - 16);
      box.style.height = h + 'px';
      /* 아래 여백(감싼 카드의 padding·margin)은 이 파일이 모른다 — 넘친 만큼 한 번 더 줄인다 */
      var over = document.documentElement.scrollHeight - w.innerHeight;
      if (over > 0) box.style.height = Math.max(320, h - over) + 'px';
    }
    w.addEventListener('resize', fitHeight);
    function drawMain() {
      root.innerHTML = '';
      var wrap = el('div', { 'class': 'pcf' });
      if (S.err) {
        wrap.appendChild(el('div', { 'class': 'pcf-none', style: 'color:#991b1b' }, ['양식을 불러오지 못했습니다 — ' + S.err + ' ',
          el('button', { type: 'button', 'class': 'pcf-b', text: '다시 불러오기', onclick: load })]));
        root.appendChild(wrap); return;
      }
      if (!S.loaded) { wrap.appendChild(el('div', { 'class': 'pcf-none', text: '불러오는 중…' })); root.appendChild(wrap); return; }
      wrap.appendChild(mobileSelects());
      wrap.appendChild(toolbar(cur()));
      wrap.appendChild(filterBar());
      S.bodyEl = el('div');
      wrap.appendChild(S.bodyEl);
      root.appendChild(wrap);
      drawBody();
    }

    drawTree(); drawMain();
    load();
    return { reload: load, select: select, current: function () { return S.sel; }, fit: fitHeight };
  }

  w.PuContractForms = {
    KINDS: KINDS,
    VARS: CONTRACT_FORM_VARS,
    SEED: CONTRACT_FORM_SEED,
    CHEDANG: CASE_CHEDANG_FORMS,
    mergeSeeds: mergeSeeds,
    isSeedId: isSeedId,
    listOf: listOf,
    changeForms: changeForms,
    changeRemoved: changeRemoved,
    extractTemplateText: extractTemplateText,
    treeModel: treeModel,
    CASE_TYPES: CASE_TYPES,
    SIDES: SIDES,
    sideOf: sideOf,
    filterForms: filterForms,
    facetCounts: facetCounts,
    splitVars: splitVars,
    attKey: attKey,
    loadForms: loadForms,
    linkOriginal: linkOriginal,
    ATTACH_MAX: ATTACH_MAX,
    hwpSources: hwpSources,
    openFill: openFill,
    mount: mount
  };
})(window);
