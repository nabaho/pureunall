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
  /* 기금관리 안의 묶음 (설계 2026-09-29 §3) — 이알피 계약서 출력은 「제안서·견적서」를 자동 체크하지 않는다(pu-erp.html).
     ⚠ 글자 하나까지 이알피와 같아야 한다(가운뎃점 U+00B7). */
  var FUND_GROUPS = ['계약서', '제안서·견적서'];
  var PROPOSAL_GROUP = FUND_GROUPS[1];
  /* ── 이알피 계약 → 고를 양식 (설계 2026-10-03-계약서류-표준-기록 §4) ──
     이알피 「계약서 출력」 자동 체크(pu-erp.html initSelMap)와 «같은 규칙»: 업체 자문·급여는 묶음 번호, 사건은 사건유형 이름,
     나머지는 그 종류 전부. 제안서·견적서 묶음과 꺼진 양식은 고르지 않는다.
     ⚠ 묶음 번호는 이알피와 글자가 같아야 한다(tests/erp-contract-fill.test.js 가 견준다). */
  /* 사건유형 번호 → 이름 — 이알피 BIZ_CASE_SEED 와 «같은 글자»(tests/erp-contract-fill.test.js 가 견준다).
     문서관리는 이알피 사건유형 표(data/biz_case_types)를 읽지 않는다 — 계약에 적힌 caseType 이 먼저, 없으면 이 표. */
  var CASE_CODES = { 'case-hr': '인사', 'case-dismiss': '부해등', 'case-wage': '체불', 'case-subsidy': '체당금', 'case-injury': '산재등',
    'case-safety': '산안', 'case-relation': '노사', 'case-support': '지원', 'case-edu': '교육', 'case-investigate': '조사',
    'case-admin': '행심', 'case-discipline': '징계', 'case-other': '기타' };
  var CONTRACT_SETS = { advisory: ['fm-pr-advisory', 'fm-pr-cms'], payroll: ['fm-pr-payroll', 'fm-pr-pension', 'fm-pr-health', 'fm-pr-employment', 'fm-pr-cms'] };
  function contractPick(forms, info) {
    info = info || {};
    var out = [];
    (info.kinds || []).forEach(function (kv) {
      var list = (forms || []).filter(function (f) { return f && f.enabled !== false && f.kind === kv && groupOf(f) !== PROPOSAL_GROUP; });
      var ids = list.map(function (f) { return f.id; }), pick = ids;
      var set = kv === 'company' ? (info.typeCode === '자문' ? CONTRACT_SETS.advisory : info.typeCode === '급여' ? CONTRACT_SETS.payroll : null) : null;
      if (set) { var a = ids.filter(function (id) { return set.indexOf(id) >= 0; }); if (a.length) pick = a; }
      else if (kv === 'case' && info.caseName) {
        var cn = String(info.caseName);
        var m = list.filter(function (f) { var g = f.groupName || ''; return g && (g === cn || cn.indexOf(g) >= 0 || g.indexOf(cn) >= 0); }).map(function (f) { return f.id; });
        if (m.length) pick = m;
      }
      pick.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    });
    return out;
  }
  /* ── 📄 계약서 만들기 (대표 「추천대로」 2026-10-07, 목업 승인) — 기업정보함 회사 상세에서 출발 ──
     계약 종류를 고르면 그 종류의 세트를 미리 체크한다. 체크 규칙은 이알피 「계약서 출력」(contractPick)과 같다 —
     어디서 시작하든 같은 서류 묶음이 나와야 한다. 사건은 사건유형을 모르므로 묶음 없는(일반) 사건 양식만. */
  var MAKE_KINDS = [
    { v: 'adv', label: '자문', icon: '🏢', kind: 'company', typeCode: '자문', sub: '자문계약서 + CMS' },
    { v: 'pay', label: '급여', icon: '💰', kind: 'company', typeCode: '급여', sub: '급여 6종' },
    { v: 'con', label: '컨설팅', icon: '📊', kind: 'consulting', sub: '컨설팅 계약' },
    { v: 'case', label: '사건', icon: '⚖️', kind: 'case', sub: '위임계약·위임장' },
    { v: 'fund', label: '기금', icon: '🏦', kind: 'fund', sub: '기금 계약' }
  ];
  function makePlan(forms, v) {
    var mk = MAKE_KINDS.filter(function (x) { return x.v === v; })[0];
    if (!mk) return { list: [], checked: [] };
    var all = (forms || []).filter(function (f) { return f && f.enabled !== false && f.kind === mk.kind; });
    var checked = mk.kind === 'case'
      ? all.filter(function (f) { return groupOf(f) === NO_GROUP; }).map(function (f) { return f.id; })
      : contractPick(all, { kinds: [mk.kind], typeCode: mk.typeCode });
    var set = mk.typeCode === '자문' ? CONTRACT_SETS.advisory : mk.typeCode === '급여' ? CONTRACT_SETS.payroll : null;
    if (set) checked.sort(function (a, b) { return set.indexOf(a) - set.indexOf(b); });   // 세트에 적힌 차례대로(급여위임 → 연금 → 건강 → 고용 → CMS)
    var rest = all.filter(function (f) { return checked.indexOf(f.id) < 0; })
      .sort(function (a, b) { return (groupOf(a) === PROPOSAL_GROUP) - (groupOf(b) === PROPOSAL_GROUP) || String(a.name || '').localeCompare(String(b.name || '')); });
    var first = checked.map(function (id) { return all.filter(function (f) { return f.id === id; })[0]; }).filter(Boolean);
    return { list: first.concat(rest), checked: checked.slice() };
  }
  /* 계약 값이 «이기는» 칸 — 계약에서만 아는 값. 회사·담당자·근로자 칸은 채우기 창에서 고른 것이 먼저(비면 계약 값) */
  var CONTRACT_WINS = /^(계약|성공보수$|주담당$|부담당$|부가세처리$|납부일$|국민연금관리번호$|건강보험번호$|고용보험번호$|산재관리번호$)/;
  /* 「계약서 / 제안서·견적서」 두 묶음을 쓰는 종류 (대표 「추천대로」 2026-10-06 — 견적서·제안 공문을 기금 밖에서도).
     사건계약은 사건유형 묶음, 상담사항은 묶음 없음. 이알피 계약서 출력은 어느 종류든 제안서·견적서를 자동 체크하지 않는다. */
  var TWO_GROUP_KINDS = ['company', 'consulting', 'fund', 'other'];
  function twoGroups(kind) { return TWO_GROUP_KINDS.indexOf(kind) >= 0; }
  function hasGroups(kind) { return kind === 'case' || twoGroups(kind); }
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
  function groupOf(f) {
    var g = (f && String(f.groupName || '').trim()) || '';
    if (g) return g;
    return f && twoGroups(f.kind) ? FUND_GROUPS[0] : NO_GROUP;   // 묶음이 없으면 계약서(기금 시드 fm-5 · 업체 표준 계약서들)
  }
  function groupRank(g, kind) {
    var list = twoGroups(kind) ? FUND_GROUPS : CASE_TYPES, i = list.indexOf(g);
    return i >= 0 ? i : (g === NO_GROUP ? 1000 : 500);
  }
  /* o = { kind, side?:'all'|'worker'|'employer'|'both', grp?:'all'|이름, q?:검색어 } */
  function filterForms(forms, o) {
    o = o || {};
    var q = String(o.q || '').trim().toLowerCase();
    var isCase = o.kind === 'case', grouped = hasGroups(o.kind);
    return (forms || []).filter(function (f) {
      if (f.kind !== o.kind) return false;
      if (isCase && o.side && o.side !== 'all' && sideOf(f) !== o.side) return false;
      if (grouped && o.grp && o.grp !== 'all' && groupOf(f) !== o.grp) return false;
      if (q && String(f.name || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (grouped) {
        var ga = groupOf(a), gb = groupOf(b), d = groupRank(ga, o.kind) - groupRank(gb, o.kind);
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
    if (twoGroups(kind)) FUND_GROUPS.forEach(function (g) { by[g] = 0; });   // 0개 묶음도 칩으로 보인다
    list.forEach(function (f) {
      var s = sideOf(f);
      if (s) sides[s]++;
      if (!hasGroups(kind)) return;
      if (kind === 'case' && side && side !== 'all' && s !== side) return;
      var g = groupOf(f);
      by[g] = (by[g] || 0) + 1;
    });
    var groups = Object.keys(by).sort(function (a, b) { return (groupRank(a, kind) - groupRank(b, kind)) || a.localeCompare(b); })
      .map(function (g) { return { name: g, count: by[g] }; });
    return { sides: sides, groups: groups };
  }

  /* ── 묶음 세트 (설계 2026-09-28-서식-묶음-채우기 §2-1) ──
     data/contract_form_sets = { v:[세트…], rm:[지운 기본 세트 id…], u } — 계약서 양식과 같은 통표·거래 방식.
     ⚠ 저장은 changeSets 한 길 — 들고 있던 사본을 통째로 밀면 그사이 남이 만든 세트를 지운다. */
  var PATH_SETS = 'data/contract_form_sets';
  /* 업무별 세트 (대표 「추천대로」 2026-10-07) — 자문·급여는 CONTRACT_SETS(이알피 계약서 출력)와 «같은 양식» */
  var SET_SEED = [
    { id: 'fs-advisory', name: '자문 세트', kind: 'company', formIds: ['fm-pr-advisory', 'fm-pr-cms'] },
    { id: 'fs-payroll', name: '급여 세트', kind: 'company', formIds: ['fm-pr-payroll', 'fm-pr-pension', 'fm-pr-health', 'fm-pr-employment', 'fm-pr-cms'] },
    { id: 'fs-fund', name: '기금 세트', kind: 'fund', formIds: ['fm-5', 'fm-pq-07'] },
    { id: 'fs-union', name: '노조 세트', kind: 'company', formIds: ['fm-pr-union'] },
    { id: 'fs-chedang', name: '체당금 접수 세트', kind: 'case', side: 'worker', groupName: '체당금',
      formIds: ['fm-case-cd-01', 'fm-case-cd-02', 'fm-case-cd-03', 'fm-case-cd-04'] }
  ];
  function setsOf(doc) {
    var list = listOf(doc && doc.v).slice(), rm = listOf(doc && doc.rm), have = {};
    list.forEach(function (s) { if (s && s.id) have[s.id] = 1; });
    SET_SEED.forEach(function (s) { if (!have[s.id] && rm.indexOf(s.id) < 0) list.push(JSON.parse(JSON.stringify(s))); });
    return list;
  }
  function changeSets(db, fn) {
    return new Promise(function (res, rej) {
      var out = null;
      db.ref(PATH_SETS).transaction(function (cur) {
        var doc = fn({ v: listOf(cur && cur.v).slice(), rm: listOf(cur && cur.rm).slice() });
        out = { v: doc.v, rm: doc.rm, u: nextU(cur) };
        return out;
      }, function (err, committed) {
        if (err || !committed) { rej(err || new Error('저장이 끝나지 않았습니다')); return; }
        res(setsOf(out));
      });
    });
  }
  function isSeedSet(id) { return SET_SEED.some(function (s) { return s.id === id; }); }
  /* 양식들의 채울 자리 합집합 — items:[{name, markers:[…]}] → [{key, forms:[양식 이름…]}] (나온 차례) */
  function bundleMarkers(items) {
    var outp = [], at = {};
    (items || []).forEach(function (it) {
      (it.markers || []).forEach(function (k) {
        if (at[k] == null) { at[k] = outp.length; outp.push({ key: k, forms: [] }); }
        var f = outp[at[k]].forms;
        if (f.indexOf(it.name) < 0) f.push(it.name);
      });
    });
    return outp;
  }
  /* 파일 이름에 못 쓰는 글자·제어 글자·방향 바꾸는 글자(U+202E 등)를 걷는다.
     길이는 자른다 — 한글은 한 글자가 3바이트라 양식·회사·근로자 이름이 길면 255바이트를 넘는다 */
  function fileSafe(s) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f‪-‮⁦-⁩]/g, '_').trim(); }
  function whoTail(V) {
    return [V && V.회사명, V && V.근로자명].map(function (x) { return fileSafe(x).slice(0, 30); }).filter(Boolean).join('_');
  }
  /* 묶음 속 파일 이름 — 01_양식_회사_근로자.hwp (번호가 붙어 같은 이름 양식 둘도 안 겹친다) */
  function bundleFileNames(items, V) {
    var tail = whoTail(V);
    return (items || []).map(function (it, i) {
      return ('0' + (i + 1)).slice(-2) + '_' + (fileSafe(it.name).slice(0, 40) || '양식') + (tail ? '_' + tail : '') + (it.ext || '');
    });
  }
  /* 계약 여러 건 묶음 — 계약마다 폴더 이름 「01_C-2026-001_가나상사」 */
  function contractFolder(info, i) {
    info = info || {};
    var no = fileSafe(info.contractNo || info.id || '').slice(0, 30), co = fileSafe((info.vals || {}).회사명 || '').slice(0, 30);
    return ('0' + (i + 1)).slice(-2) + '_' + [no || '계약', co].filter(Boolean).join('_');
  }
  /* 계약 값 → 채울 값 — 기업정보함 채우기와 같은 기본값(오늘·우편주소 등) 위에 계약 값(빈 값은 덮지 않는다) */
  function contractValues(info) {
    var CF = w.PuFormCardFill, v = (info && info.vals) || {};
    var V = CF.valuesFrom({ co: { c: v.회사명, bz: v.사업자번호, ceo: v.대표자, ad: v.주소, ct: v.대표전화, cfx: v.대표팩스, e: v.대표이메일,
      bt: v.업태, bi: v.종목, cno: v.법인등록번호, sme: v.규모 }, contact: { n: v.담당자, m: v.담당자연락처, e: v.담당자이메일 } });
    Object.keys(v).forEach(function (k) { if (v[k] != null && v[k] !== '') V[k] = v[k]; });
    return V;
  }
  function bomText(s) {
    var b = new TextEncoder().encode(s), o = new Uint8Array(b.length + 3);
    o[0] = 0xEF; o[1] = 0xBB; o[2] = 0xBF; o.set(b, 3);
    return o;
  }
  /* 양식 하나를 값 V 로 채운다(창 없이) — 채우기 창 fillOne 과 같은 길: 원본 → 표지 읽기 → 채우기, 원본이 없으면 본문(.txt) */
  function fillFormOnce(fm, V, host) {
    var CF = w.PuFormCardFill, src = hwpSources(fm)[0];
    if (!src || !host.hwpBytes || !host.hwpFill || !host.hwpMarkers) return Promise.resolve({ bytes: bomText(CF.fillText(fm.body, V)), ext: '.txt', unknown: [] });
    var xl = /\.xlsx$/i.test(src.name || '');
    return host.hwpBytes(src).then(function (u8) {
      return host.hwpMarkers(u8, src.name).then(function (ks) { return host.hwpFill(u8, src.name, CF.hwpValues(ks || [], V)); });
    }).then(function (r) { return { bytes: r.bytes, ext: xl ? '.xlsx' : '.hwp', unknown: r.unknown || [] }; });
  }
  function zipName(title, V) {
    var head = fileSafe(title).replace(/^\.+/, '').slice(0, 40), tail = whoTail(V);
    return (head || '서식묶음') + (tail ? '_' + tail : '') + '.zip';
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
  /* 바꿀 자리 만들기 «새 원본으로 저장» (설계 2026-09-29 §4) — 양식이 새 파일을 쓰게 한다.
     ⚠ 옛 원본은 지우지 않는다: originals 목록 뒤에 남고(보관함에서 받을 수 있다), 채우기는 맨 앞 것을 쓴다
       (hwpSources 는 첨부 → originals 순, 같은 이름은 앞 것만). 받은 양식은 고치지 않고 사본을 돌려준다. */
  function withNewOriginal(form, nu) {
    var f = JSON.parse(JSON.stringify(form || {}));
    var entry = { fileId: nu.fileId, name: nu.name, size: nu.size };
    if (nu.data && nu.attId) entry.attId = nu.attId;
    f.attachments = (nu.data && nu.attId) ? [{ id: nu.attId, name: nu.name, size: nu.size, type: '', data: nu.data }] : [];
    f.originals = [entry].concat((Array.isArray(f.originals) ? f.originals : []).filter(function (o) { return o && o.fileId !== nu.fileId; }));
    return f;
  }
  /* 보관함 사본이 없는 한글 첨부 — 새 원본으로 바꾸기 «전에» 보관함에 먼저 올려야 옛 원본이 사라지지 않는다 */
  function orphanInline(form) {
    var o = (form && Array.isArray(form.originals)) ? form.originals : [];
    return ((form && form.attachments) || []).filter(function (a) {
      return /\.(hwp|hwpx)$/i.test(a.name || '') && (a.data || a.dataUrl) && !o.some(function (x) { return x.attId && x.attId === a.id; });
    });
  }

  function dataUrlOf(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return 'data:application/octet-stream;base64,' + btoa(s);
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
    + '.pcf-lr{display:flex;align-items:center;gap:2px}.pcf-lr input{flex:none;margin:0 2px 0 6px;cursor:pointer}.pcf-lr .pcf-li{flex:1;min-width:0}'
    + '.pcf-set{padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;color:#1e293b;max-width:170px}'
    + '.pcf-bbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid #bfdbfe;border-top:none;background:#eff6ff;color:#1e40af;padding:6px 12px;font-size:12.5px}'
    + '.pcf-bbar[hidden]{display:none}.pcf-bbar b{white-space:nowrap}'
    + '.pcf-bnames{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569;font-size:12px}'
    + '.pcf-top{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0;padding:8px 12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
    + '.pcf-top b{flex:0 1 auto;min-width:0;max-width:38%;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pcf-top .pcf-strip{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:11.5px;color:#64748b}'
    + '.pcf-top .pcf-att{margin:0}'
            + '.pcf-ok{background:#dcfce7;color:#166534;border-radius:9px;padding:0 7px;font-size:10.5px;font-weight:700}'
    + '.pcf-sheetwrap{background:#e2e8f0;padding:16px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px}'
    + '.pcf-sheet{background:#fff;max-width:820px;margin:0 auto;padding:40px 52px;box-shadow:0 1px 3px rgba(15,23,42,.15);min-height:600px;position:relative}'
    /* 원본 모양 (2026-10-07) — 종이 대신 원본 쪽 그림을 그대로 */
    + '.pcf-sheet.orig{background:transparent;box-shadow:none;padding:0;max-width:880px}'
    + '.pcf-pvbar{display:flex;gap:6px;justify-content:flex-end;max-width:880px;margin:0 auto 8px}'
    + '.pcf-orig{min-height:200px;text-align:center}.pcf-orig .pcf-muted{padding:40px}'
    + '.pcf-offband{background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:6px 10px;border-radius:4px;margin-bottom:16px}'
    + '.pcf-body{white-space:pre-wrap;font-family:"Malgun Gothic","맑은 고딕",monospace;font-size:13px;line-height:1.85;color:#1e293b;margin:0}'
    + '.pcf-v{background:#dbeafe;color:#1e40af;border-radius:3px;padding:0 2px}'
    + '.pcf-muted{color:#94a3b8}'
    /* 채워서 받기 창 */
    + '.pcf-fcols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:16px}'
    + '.pcf-ct-list{max-height:52vh;overflow:auto;border:1px solid #e2e8f0;border-radius:8px}'
    + '.pcf-ct-row{display:grid;grid-template-columns:28px 32px 130px minmax(0,1fr) 110px 92px minmax(0,1fr);gap:6px;align-items:center;padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:12.5px;cursor:pointer}'
    + '.pcf-ct-head{position:sticky;top:0;background:#f8fafc;cursor:default}'
    + '.pcf-ct-bad{color:#b91c1c}'
    + '.pcf-mk-hits{max-height:180px;overflow:auto;margin:4px 0 8px}'
    + '.pcf-mk-hit{font-size:12px;padding:2px 0;color:#334155}'
    + '.pcf-mk-hit mark{background:#fde68a}'
    + '.pcf-prop{border:1px solid #bfdbfe;background:#f8fbff;border-radius:8px;padding:8px 10px;margin-bottom:10px}'
    + '.pcf-seg{display:inline-flex;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden}'
    + '.pcf-seg button{border:0;background:#fff;padding:5px 10px;font:inherit;font-size:12.5px;cursor:pointer}'
    + '.pcf-seg button.on{background:#1e293b;color:#fff}'
    + '.pcf-fcols input[type=search],.pcf-frow input{width:100%;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;font-family:inherit}'
    + '.pcf-fh{font-size:12px;color:#64748b;font-weight:700;margin:10px 0 4px}'
    + '.pcf-fl{display:flex;flex-direction:column;gap:2px;margin-top:4px;max-height:180px;overflow:auto}'
    + '.pcf-fi{display:flex;gap:8px;align-items:baseline;text-align:left;background:none;border:1px solid transparent;border-radius:6px;padding:5px 8px;cursor:pointer;font-family:inherit;font-size:12.5px;color:#1e293b}'
    + '.pcf-fi:hover{background:#eff6ff}.pcf-fi.on{background:#dbeafe;border-color:#bfdbfe;color:#1e40af}'
    + '.pcf-fi span{color:#64748b;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pcf-fpick{display:flex;gap:8px;align-items:center;background:#dbeafe;color:#1e40af;border-radius:6px;padding:6px 8px;margin-top:6px;font-size:12.5px}'
    + '.pcf-fpick span{flex:1;min-width:0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pcf-frow{display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:5px;font-size:12px}'
    + '.pcf-fu{display:block;font-size:10.5px;color:#94a3b8;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pcf-frow span{color:#1e40af;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pcf-frow span.miss{color:#854d0e}'
    + '.pcf-fnote{font-size:12px;color:#854d0e;margin-top:10px;min-height:1em}'
    /* 채우기 전 확인표 (2026-10-05) — ☐ · # · 칸 · 값 · 출처 */
    + '.pcf-vrow{display:grid;grid-template-columns:16px 20px 104px minmax(0,1fr) 86px;gap:6px;align-items:center;margin-bottom:5px;font-size:12px}'
    + '.pcf-vrow>span.k{color:#1e40af;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pcf-vrow>span.k.miss{color:#b91c1c}'
    + '.pcf-vrow>i{font-style:normal;color:#94a3b8;font-size:11px;text-align:right}'
    + '.pcf-vrow input[type=text]{width:100%;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;font-family:inherit}'
    + '.pcf-src{font-size:10.5px;padding:2px 5px;border-radius:5px;background:#f1f5f9;color:#475569;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pcf-src.w{background:#fef3c7;color:#92400e;font-weight:700}.pcf-src.miss{color:#b91c1c}.pcf-src.p{background:#dcfce7;color:#166534}'
    + '.pcf-vpick{grid-column:3/6;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:-2px 0 6px 42px}'
    + '.pcf-vpick button{font:inherit;font-size:11.5px;padding:3px 8px;border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:6px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pcf-vpick a{font-size:11.5px;color:#1d4ed8;cursor:pointer}'
    + '.pcf-nts{display:flex;gap:8px;align-items:center;font-size:12px;padding:6px 9px;border-radius:6px;margin-bottom:6px;background:#eff6ff;color:#1e40af}'
    + '.pcf-nts.bad{background:#fef2f2;color:#991b1b;font-weight:700}.pcf-nts.dim{background:#f8fafc;color:#64748b}'
    + '.pcf-nts button{margin-left:auto;white-space:nowrap;flex:none;font:inherit;font-size:11.5px;padding:3px 8px;border:1px solid #93c5fd;background:#fff;color:#1d4ed8;border-radius:6px;cursor:pointer}'
    /* 화면 개편 (2026-10-07) */
    + '.pcf-th{font-size:11px;color:#64748b;font-weight:700;margin:10px 0 2px 24px}.pcf-tk.add{color:#1d4ed8}'
    + '.pcf-lp{width:270px;flex:none;display:flex;flex-direction:column;border:1px solid #e2e8f0;border-right:none;border-radius:8px 0 0 8px;background:#fff;min-height:0}'
    + '.pcf-cols.card .pcf-lp{width:auto;flex:1;border-right:1px solid #e2e8f0;border-radius:8px}'
    + '.pcf-lh{padding:6px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;flex-direction:column;gap:5px}'
    + '.pcf-lhr{display:flex;gap:4px;align-items:center}.pcf-lhr .pcf-q{flex:1;min-width:0;max-width:none}'
    + '.pcf-lbody{flex:1;min-height:0;overflow-y:auto}.pcf-lbody .pcf-list{width:auto;border:none;height:auto;overflow:visible}'
    + '.pcf-vp{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}'
    + '.pcf-vp .pcf-top{border-radius:0 8px 0 0}.pcf-vp .pcf-sheetwrap{flex:1;min-height:0;overflow-y:auto;border-radius:0 0 8px 0}'
    + '.pcf-top .pcf-strip{flex:0 1 auto}.pcf-top b{max-width:46%}'
    + '.pcf-morew{position:relative;margin-left:auto}.pcf-more{font-size:15px;line-height:1;padding:3px 10px}'
    + '.pcf-menu{position:absolute;right:0;top:110%;z-index:30;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.15);padding:4px;min-width:220px;display:flex;flex-direction:column}'
    + '.pcf-menu[hidden]{display:none}.pcf-menu button{background:none;border:none;text-align:left;padding:7px 10px;border-radius:6px;font:inherit;font-size:12.5px;cursor:pointer;color:#1e293b}'
    + '.pcf-menu button:hover{background:#eff6ff}.pcf-menu hr{border:none;border-top:1px solid #e2e8f0;margin:4px 0}'
    + '@media(max-width:700px){.pcf-lp{width:auto;border-right:1px solid #e2e8f0;border-radius:8px}.pcf-lbody{max-height:40vh}.pcf-vp .pcf-top{border-radius:8px 8px 0 0;margin-top:8px}}'
    + '.pcf-mk-kinds{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:6px}'
    + '.pcf-mk-kind{border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;padding:8px;text-align:left;cursor:pointer;font:inherit;font-size:13px}'
    + '.pcf-mk-kind small{display:block;font-size:11px;color:#64748b}.pcf-mk-kind.on{border:2px solid #1d4ed8;background:#eff6ff;color:#1e40af}'
    + '.pcf-mk-kind:disabled{opacity:.45;cursor:default}'
    + '.pcf-mk-row{grid-template-columns:20px 26px minmax(0,1fr) 60px!important}'
    + '@media(max-width:700px){.pcf-mk-kinds{grid-template-columns:repeat(3,minmax(0,1fr))}}'
    + '.pcf-vsum{font-size:12px;padding:6px 9px;border-radius:6px;margin-bottom:6px;background:#fef3c7;color:#92400e}.pcf-vsum.ok{background:#dcfce7;color:#166534}'
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
    if (twoGroups(f.kind)) {
      /* 묶음 — 「제안서·견적서」는 이알피 계약서 출력이 자동 체크하지 않는다 */
      grpIn = el('select', { 'aria-label': '묶음' }, FUND_GROUPS.map(function (g) { return el('option', { value: g, text: g }); }));
      grpIn.value = groupOf(f);
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
          grpIn ? el('div', null, [el('label', { 'class': 'l', text: twoGroups(f.kind) ? '묶음' : '사건유형 (이알피 사건유형과 같은 이름)' }), grpIn,
            f.kind === 'case' ? el('datalist', { id: 'pcf-case-groups' }, CASE_TYPES.map(function (g) { return el('option', { value: g }); })) : null]) : null
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
  /* 채우기 창 — 양식 «하나 또는 여러 개» (설계 2026-09-28-서식-묶음-채우기 §2-2).
     회사·담당자·근로자는 한 번 고르고, 채울 자리는 양식들의 합집합이다(bundleMarkers).
     하나면 지금처럼 그 파일 하나, 여럿이면 host.zip 으로 묶어 .zip 하나를 받는다.
     ⚠ 채운 값은 저장하지 않는다 — 내려받는 파일에만 들어간다. db 를 만지지 않는다. */
  function openFill(fms, host, title) {
    var CF = w.PuFormCardFill;
    if (!CF || !host.cards) { toast('ERP 업체정보 연결을 불러오지 못했습니다'); return; }
    fms = (fms || []).filter(Boolean);
    if (!fms.length) return;
    ensureCss();
    var one = fms.length === 1;
    var items = fms.map(function (fm) {
      var srcs = hwpSources(fm);
      return { fm: fm, srcs: srcs, src: srcs[0] || null, hwp: null, text: CF.markersIn(fm.body), err: '' };
    });
    var st = { rows: null, co: null, coX: {}, contact: null, worker: null, edits: {}, pick: 0, srcPick: {}, ok: {}, ntsLive: null, ntsBusy: false,
      pv: { on: false, orgType: 'co', amount: '', vat: 'incl', tel: '' }, edited: null,
      wi: { on: false, task: '', wtask: '', vat: 'excl', ext: 'agree', succ: 'fixed', succAmt: '' } };
    try { st.pv.tel = w.localStorage.getItem('pcf-staff-tel') || ''; } catch (e) {}
    var propBox = el('div', { 'class': 'pcf-prop', hidden: true });
    var caseBox = el('div', { 'class': 'pcf-prop', hidden: true });
    var bg = el('div', { 'class': 'pcf-mbg' });
    function close() { document.removeEventListener('keydown', onKey); bg.remove(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    var coQ = el('input', { type: 'search', placeholder: '회사 이름·사업자번호·대표자', 'aria-label': '회사 찾기' });
    var coList = el('div', { 'class': 'pcf-fl' });
    var coPicked = el('div');
    var ctQ = el('input', { type: 'search', placeholder: '담당자 이름·회사·직급·전화·이메일', 'aria-label': '담당자 찾기' });
    var ctBox = el('div', { 'class': 'pcf-fl' });
    var wkQ = el('input', { type: 'search', placeholder: '근로자 이름·휴대폰', 'aria-label': '근로자 찾기' });
    var wkList = el('div', { 'class': 'pcf-fl' });
    var valBox = el('div');
    var note = el('div', { 'class': 'pcf-fnote' });
    var prevBox = el('div', { 'class': 'pcf-fprev', hidden: true });

    function values() {
      var co = st.co ? Object.assign({}, st.coX, st.co) : {};
      /* 확인표에서 「등록증」을 고른 칸은 등록증 값으로 — 대표자·대표자전체, 주소·우편주소가 함께 바뀐다 */
      CF.coConflicts(st.co).forEach(function (c) { if (st.srcPick[c.f] === 'biz') co[c.f] = c.biz; });
      var V = CF.valuesFrom({ co: co, contact: st.contact, worker: st.worker });
      /* 이알피 계약 → 서류 묶음 (설계 2026-10-03 §4) — 계약 칸은 계약 값이, 나머지는 비었을 때만 */
      if (host.contractCtx && host.contractCtx.vals) {
        var cv = host.contractCtx.vals;
        Object.keys(cv).forEach(function (k) {
          var x = cv[k];
          if (x == null || x === '') return;
          if (CONTRACT_WINS.test(k) || !V[k]) V[k] = x;
        });
      }
      if (st.pv.on) {
        var me = host.me ? host.me() : null;
        var P = CF.proposalValues(V, { orgType: st.pv.orgType, amount: st.pv.amount, vat: st.pv.vat,
          staffName: me && me.name, staffTel: st.pv.tel });
        Object.keys(P).forEach(function (k) { V[k] = P[k]; });
      }
      if (st.wi.on && CF.caseValues) {
        var Cv = CF.caseValues(st.wi);
        Object.keys(Cv).forEach(function (k) { if (Cv[k]) V[k] = Cv[k]; });
      }
      Object.keys(st.edits).forEach(function (k) { V[k] = st.edits[k]; });
      return V;
    }
    function markersOf(it) {
      var seen = {}, outp = [];
      it.text.concat(it.hwp ? it.hwp.markers : []).forEach(function (k) { if (!seen[k]) { seen[k] = 1; outp.push(k); } });
      return outp;
    }
    function allMarkers() {
      return bundleMarkers(items.map(function (it) { return { name: it.fm.name || '양식', markers: markersOf(it) }; }));
    }
    /* 제안서 칸 — 받는 곳 종류·금액·부가세·연락처 (설계 2026-09-29 §5). valBox 와 따로 그려야
       금액을 칠 때 커서가 안 사라진다(drawVals 는 valBox 만 다시 그린다). */
    function seg(opts, cur, fn) {
      return el('span', { 'class': 'pcf-seg', role: 'group' }, opts.map(function (o) {
        return el('button', { type: 'button', 'class': cur === o.v ? 'on' : '', 'aria-pressed': cur === o.v ? 'true' : 'false', text: o.t,
          onclick: function () { fn(o.v); drawProp(); drawVals(); } });
      }));
    }
    function drawProp() {
      propBox.innerHTML = '';
      propBox.hidden = !st.pv.on;
      if (!st.pv.on) return;
      var amt = el('input', { type: 'text', inputmode: 'numeric', placeholder: '예: 5,000,000', 'aria-label': '견적 금액' });
      amt.value = st.pv.amount;
      amt.addEventListener('input', function () { st.pv.amount = amt.value; drawVals(); });
      var tel = el('input', { type: 'text', placeholder: '041-556-0035', 'aria-label': '노무사 연락처' });
      tel.value = st.pv.tel;
      tel.addEventListener('input', function () {
        st.pv.tel = tel.value; drawVals();
        try { w.localStorage.setItem('pcf-staff-tel', tel.value); } catch (e) {}
      });
      propBox.appendChild(el('div', { 'class': 'pcf-fh', text: '제안서 — 받는 곳 종류와 견적' }));
      propBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '받는 곳' }),
        seg([{ v: 'co', t: '기업' }, { v: 'org', t: '기관·지자체' }], st.pv.orgType, function (v) { st.pv.orgType = v; })]));
      propBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '견적 금액' }), amt]));
      propBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '부가세' }),
        seg([{ v: 'incl', t: '부가세 포함' }, { v: 'excl', t: '별도(10%)' }], st.pv.vat, function (v) { st.pv.vat = v; })]));
      propBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '노무사 연락처' }), tel]));
      propBox.appendChild(el('div', { 'class': 'pcf-fnote', text: '⚠ 원본의 「비용 산출 내역」 표와 금액이 다르면, 받은 뒤 한글에서 고치거나 빼세요.' }));
    }
    /* 위임계약서 칸 — 위임사무·위임내용 고르기 · 부가세 · 기간 연장 · 성공보수 (설계 2026-10-03 §2.2·2.3, 목업 승인).
       표지가 있는 칸만 보인다. 고르면 그 칸의 손댄 값(edits)을 지워 고른 문장이 들어가게 한다. */
    function drawCase(ks) {
      caseBox.innerHTML = '';
      caseBox.hidden = !st.wi.on;
      if (!st.wi.on) return;
      var has = {}; (ks || allMarkers()).forEach(function (x) { has[x.key] = 1; });
      function pick(keys, fn) { return function (v) { fn(v); clearEdits(keys); drawCase(); drawVals(); }; }
      caseBox.appendChild(el('div', { 'class': 'pcf-fh', text: '위임계약 — 고르면 아래 칸에 문장이 들어갑니다' }));
      if (has['위임분야'] || has['위임사무']) {
        var sel = el('select', { 'aria-label': '위임사무', onchange: function () { pick(['위임분야', '위임사무'], function (v) { st.wi.task = v; })(sel.value); } },
          [el('option', { value: '', text: '— 고르세요 —' })].concat(CF.CASE_TASKS.map(function (t) { return el('option', { value: t.v, text: t.t }); })));
        sel.value = st.wi.task;
        caseBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '위임사무' }), sel]));
        if (st.wi.task === 'own') caseBox.appendChild(el('div', { 'class': 'pcf-fnote', text: '아래 「위임분야」·「위임사무」 칸에 직접 적으세요 — 위임분야는 「…과 관련하여」 앞에 들어갑니다.' }));
      }
      if (has['위임내용']) {
        var ws = el('select', { 'aria-label': '위임내용', onchange: function () { pick(['위임내용'], function (v) { st.wi.wtask = v; })(ws.value); } },
          [el('option', { value: '', text: '— 고르세요 —' })].concat(CF.WORKER_TASKS.map(function (t) { return el('option', { value: t.v, text: t.t }); })));
        ws.value = st.wi.wtask;
        caseBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '위임내용' }), ws]));
      }
      if (has['부가세처리']) caseBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '부가세' }),
        seg([{ v: 'excl', t: '별도' }, { v: 'incl', t: '포함' }], st.wi.vat, pick(['부가세처리', '성공보수'], function (v) { st.wi.vat = v; }))]));
      if (has['기간연장']) caseBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '기간 연장' }),
        seg([{ v: 'agree', t: '당사자 합의로 연장' }, { v: 'auto', t: '끝날 때까지 자동 연장' }], st.wi.ext, pick(['기간연장'], function (v) { st.wi.ext = v; }))]));
      if (has['성공보수']) {
        var amt = el('input', { type: 'text', placeholder: st.wi.succ === 'rate' ? '예: 10' : '예: 3,000,000', 'aria-label': '성공보수' });
        amt.value = st.wi.succAmt;
        amt.addEventListener('input', function () { st.wi.succAmt = amt.value; clearEdits(['성공보수']); drawVals(); });
        caseBox.appendChild(el('label', { 'class': 'pcf-frow' }, [el('span', { text: '성공보수' }),
          el('div', null, [seg([{ v: 'fixed', t: '정액(원)' }, { v: 'rate', t: '정률(%)' }], st.wi.succ, pick(['성공보수'], function (v) { st.wi.succ = v; })), amt])]));
      }
    }
    function drawVals() {
      valBox.innerHTML = '';
      if (st.edited) valBox.appendChild(el('div', { 'class': 'pcf-fnote' }, ['✏ 손본 문서를 받기·메일에 씁니다 — 아래 값을 바꿔도 손본 문서에는 들어가지 않습니다. ',
        el('button', { type: 'button', 'class': 'pcf-b', text: '손본 것 버리기', onclick: function () { st.edited = null; drawVals(); } })]));
      var ks = allMarkers();
      var wantProp = ks.some(function (x) { return CF.PROPOSAL_KEYS.indexOf(x.key) >= 0; });
      if (wantProp !== st.pv.on) { st.pv.on = wantProp; drawProp(); }
      var wantCase = !!CF.CASE_KEYS && ks.some(function (x) { return CF.CASE_KEYS.indexOf(x.key) >= 0; });
      if (wantCase !== st.wi.on) { st.wi.on = wantCase; drawCase(ks); }
      var V = values();
      if (!ks.length) { valBox.appendChild(el('div', { 'class': 'pcf-muted', text: one ? '이 양식에는 채울 자리가 없습니다' : '이 양식들에는 채울 자리가 없습니다' })); return; }
      var blank = ks.filter(function (x) { return !V[x.key]; }).length;
      var open = openConflicts(ks);
      valBox.appendChild(el('div', { 'class': 'pcf-fh', text: '채울 자리 ' + ks.length + '곳' + (one ? '' : ' (양식 ' + items.length + '개 합쳐서)') + (blank ? ' · 빈 칸 ' + blank + '곳' : '') + ' — 고칠 수 있습니다' }));
      var nv = ntsNow();
      if (nv) {
        var bzD = String((st.co && st.co.bz) || '').replace(/\D/g, '');
        var ask = (nv.stale || nv.bad) && host.ntsCheck && bzD.length === 10 && !(st.ntsLive && st.ntsLive.at);
        valBox.appendChild(el('div', { 'class': 'pcf-nts' + (nv.bad ? ' bad' : (!nv.word || nv.stale) ? ' dim' : '') }, [
          el('span', { text: (nv.bad ? '⚠ ' : '🏛 ') + nv.text + (st.ntsLive ? ' (지금 물어봄 · 저장 안 함)' : '') }),
          ask ? el('button', { type: 'button', text: st.ntsBusy ? '묻는 중…' : '지금 국세청에 묻기', title: '사업자번호만 국세청에 보냅니다', onclick: function () { askNts(bzD); } }) : null
        ]));
      }
      var conf = CF.coConflicts(st.co).filter(function (c) { return ks.some(function (x) { return CF.CO_FIELD_OF[x.key] === c.f; }); });
      if (conf.length) valBox.appendChild(el('div', { 'class': 'pcf-vsum' + (open.length ? '' : ' ok'),
        text: open.length ? '⚠ 이알피와 사업자등록증 값이 다른 칸 ' + open.length + '곳 — 어느 쪽을 쓸지 고르세요' : '✓ 다른 칸 ' + conf.length + '곳 모두 골랐습니다' }));
      var allBox = el('input', { type: 'checkbox', 'aria-label': '모두 확인', title: '모두 확인' });
      allBox.checked = ks.every(function (x) { return isOk(x.key, V); });
      allBox.addEventListener('change', function () { ks.forEach(function (x) { st.ok[x.key] = allBox.checked; }); drawVals(); });
      valBox.appendChild(el('div', { 'class': 'pcf-vrow', style: 'color:#94a3b8;font-size:11px' }, [allBox, el('span', { text: '#' }), el('span', { text: '칸' }), el('span', { text: '들어갈 값' }), el('span', { text: '출처', style: 'text-align:center' })]));
      var shown = {};
      ks.forEach(function (x, i) {
        var k = x.key;
        var inp = el('input', { type: 'text', 'aria-label': k, placeholder: '비워 두면 밑줄 — 손으로 적게 됩니다' });
        inp.value = V[k] == null ? '' : V[k];
        inp.addEventListener('input', function () { st.edits[k] = inp.value; });
        var used = one ? null : el('small', { 'class': 'pcf-fu', title: x.forms.join(', '), text: x.forms.length === items.length ? '모든 양식' : x.forms[0] + (x.forms.length > 1 ? ' 외 ' + (x.forms.length - 1) : '') });
        var src = srcOf(k);
        var box = el('input', { type: 'checkbox', 'aria-label': k + ' 확인' });
        box.checked = isOk(k, V);
        box.addEventListener('change', function () { st.ok[k] = box.checked; allBox.checked = ks.every(function (y) { return isOk(y.key, V); }); });
        valBox.appendChild(el('label', { 'class': 'pcf-vrow' }, [box, el('i', { text: String(i + 1) }),
          el('span', { 'class': 'k' + (V[k] ? '' : ' miss') }, [k, used]), inp,
          el('span', { 'class': 'pcf-src' + (src.warn ? ' w' : (src.miss && !V[k]) ? ' miss' : src.picked ? ' p' : ''), title: src.label, text: src.label || '—' })]));
        /* 다른 칸 — 같은 회사 칸(대표자·대표자전체)은 처음 나온 줄에만 고르기 단추 */
        if (src.conflict && !shown[src.conflict.f]) {
          shown[src.conflict.f] = 1;
          var c = src.conflict;
          valBox.appendChild(el('div', { 'class': 'pcf-vpick' }, [
            el('button', { type: 'button', title: c.erp, text: '이알피: ' + c.erp, onclick: function () { choose(c, 'erp'); } }),
            el('button', { type: 'button', title: c.biz, text: '등록증: ' + c.biz, onclick: function () { choose(c, 'biz'); } }),
            el('a', { title: '이알피 업체관리를 새 탭에서 엽니다', text: '이알피에서 고치기 ↗', onclick: function () { w.open('pu-erp.html#menu=biz/company', '_blank'); } })
          ]));
        }
      });
    }
    /* 출처 이름표 — 계약 칸이 이기는지는 values() 와 같은 규칙 */
    function srcOf(k) {
      var cv = host.contractCtx && host.contractCtx.vals;
      return CF.fieldSource(k, { co: st.co, coX: st.coX, contact: st.contact, worker: st.worker, edits: st.edits,
        contract: cv, contractWins: CONTRACT_WINS.test(k), picks: st.srcPick, conflicts: CF.coConflicts(st.co) });
    }
    /* ☐ 확인 — 사람이 누른 것이 먼저, 아니면 «값이 있고 다르지 않은 칸» */
    function isOk(k, V) {
      if (Object.prototype.hasOwnProperty.call(st.ok, k)) return !!st.ok[k];
      return !!V[k] && !srcOf(k).warn;
    }
    function choose(c, side) {
      st.srcPick[c.f] = side;
      Object.keys(CF.CO_FIELD_OF).forEach(function (k) { if (CF.CO_FIELD_OF[k] === c.f) { delete st.edits[k]; delete st.ok[k]; } });
      drawVals();
    }
    /* 이 양식들이 쓰는 칸 가운데 아직 안 고른 다른 칸(손으로 고쳐 적은 칸은 고른 것으로 본다) */
    function openConflicts(ks) {
      ks = ks || allMarkers();
      return CF.coConflicts(st.co).filter(function (c) {
        return !st.srcPick[c.f] && ks.some(function (x) { return CF.CO_FIELD_OF[x.key] === c.f && !Object.prototype.hasOwnProperty.call(st.edits, x.key); });
      });
    }
    /* 국세청 상태 — 방금 물어본 값이 먼저, 아니면 기업정보함이 적어 둔 값 */
    function ntsNow() {
      if (!st.co) return null;
      var x = st.ntsLive || { word: st.coX.ns, at: st.coX.na, end: st.coX.ne };
      return CF.ntsView(x);
    }
    function askNts(bz) {
      if (st.ntsBusy) return;
      st.ntsBusy = true; drawVals();
      var co = st.co;
      host.ntsCheck(bz).then(function (row) {
        if (st.co !== co) return;
        var word = CF.ntsWordOf(row);
        /* 못 물어봤는데 물어본 척 하지 않는다 */
        if (!word) throw new Error('국세청이 아무 말도 주지 않았습니다');
        var t = new Date();
        st.ntsLive = { word: word, end: CF.ntsEndOf(row), at: t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0') };
      }).catch(function (e) { toast('⚠ 국세청에 못 물어봤습니다 — ' + ((e && e.message) || e)); })
        .then(function () { st.ntsBusy = false; if (st.co === co) drawVals(); });
    }
    function conflictsOkToGo() {
      var nv = ntsNow();
      if (nv && nv.bad && !w.confirm('⚠ ' + nv.text + '\n\n이 회사로 서류를 채워 그대로 받을까요?')) return false;
      var open = openConflicts();
      if (!open.length) return true;
      return w.confirm('⚠ 이알피와 사업자등록증 값이 다른 칸 ' + open.length + '곳을 아직 고르지 않았습니다:\n  '
        + open.map(function (c) { return c.key + ' — 이알피 「' + c.erp + '」 / 등록증 「' + c.biz + '」'; }).join('\n  ')
        + '\n\n이알피 값으로 채워 그대로 받을까요?');
    }
    function rowBtn(label, sub, on, fn) {
      return el('button', { type: 'button', 'class': 'pcf-fi' + (on ? ' on' : ''), onclick: fn }, [el('b', { text: label }), sub ? el('span', { text: sub }) : null]);
    }
    function clearEdits(ks) { ks.forEach(function (k) { delete st.edits[k]; }); }
    function drawContacts() {
      ctBox.innerHTML = '';
      var cs = CF.searchContacts(st.rows || [], ctQ.value, st.co, 30);
      if (!st.co && !ctQ.value.trim()) { ctBox.appendChild(el('div', { 'class': 'pcf-muted', text: '회사를 고르거나 담당자를 바로 검색하세요' })); return; }
      if (!cs.length) { ctBox.appendChild(el('div', { 'class': 'pcf-muted', text: '찾는 명함이 없습니다 — 오른쪽 빈칸에 직접 적으세요' })); return; }
      cs.slice(0, 30).forEach(function (r) {
        ctBox.appendChild(rowBtn(r.n + (r.ti ? ' ' + r.ti : ''), [r.c || '', r.d || '', r.m || r.t || '', r.e || ''].filter(Boolean).join(' · '), st.contact === r, function () {
          var chosen = st.contact === r ? null : r;
          clearEdits(['담당자', '담당자연락처', '담당자이메일', '담당자직급', '담당자부서', '담당자휴대폰', '담당자전화', '담당자주소']);
          if (chosen && chosen.c && (!st.co || CF.sameCo(chosen.c) !== CF.sameCo(st.co.c))) {
            var match = CF.searchCompanies(st.rows || [], chosen.c, 20).filter(function (x) { return CF.sameCo(x.c) === CF.sameCo(chosen.c); })[0];
            if (match) { pickCo(match, chosen); return; }
          }
          st.contact = chosen; ctQ.value = st.contact ? st.contact.n : ''; drawContacts(); drawVals();
        }));
      });
    }
    function coSub(r) {
      return [r.bz ? CF.valuesFrom({ co: r }).사업자번호 : '', r.ceo ? '대표 ' + r.ceo : '', r.k === 'card-co' ? '명함에만 있는 회사' : ''].filter(Boolean).join(' · ');
    }
    function pickCo(r, chosenContact) {
      st.co = r; st.coX = {}; st.srcPick = {}; st.ok = {}; st.ntsLive = null; st.contact = chosenContact || null; ctQ.value = st.contact ? st.contact.n : '';
      clearEdits(['회사명', '사업자번호', '대표자', '대표자전체', '주소', '대표전화', '대표팩스', '대표이메일', '업태', '종목', '법인등록번호', '규모', '담당자', '담당자연락처', '담당자이메일', '담당자직급', '담당자부서', '담당자휴대폰', '담당자전화', '담당자주소']);
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
    var coT = null, ctT = null, wkT = null;
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
    ctQ.addEventListener('input', function () {
      clearTimeout(ctT); ctT = setTimeout(function () { withRows(function () { drawContacts(); }); }, 150);
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

    /* 원본 살피기 — 양식마다 «하나씩 차례로»(한글 엔진은 문서를 열 때 메모리를 크게 쓴다).
       한 벌을 못 찾으면 같은 양식의 다른 첨부본·보관본을 차례로 본다.
       안내·단추는 «양식마다의 상태»에서 만든다 — 개수만 세면 늦게 끝난 옛 불러오기가 안내를 멈춘 채 남긴다.
       it.state: none(원본 없음) · wait · loading · ok · nofield(채울 자리 없음) · fail */
    var busy = false;   // 묶음을 만드는 중 — 받기를 두 번 누르면 채우기가 겹쳐 돈다
    items.forEach(function (it) { it.state = it.src ? 'wait' : 'none'; });
    function nameOf(it) { return it.fm.name || '양식'; }
    function tagOf(it) { return it.state === 'none' ? ' (원본 없음 — 본문)' : it.state === 'fail' ? ' (원본 못 찾음)' : it.state === 'nofield' ? ' (채울 자리 없음)' : ''; }
    function loadingCount() { return items.filter(function (it) { return it.state === 'wait' || it.state === 'loading'; }).length; }
    function refresh() {
      var n = loadingCount();
      if (btnDown) btnDown.disabled = n > 0 || busy;
      if (busy) return;
      var re = items.filter(function (it) { return it.retry && it.state === 'loading'; })[0];
      if (re) { note.textContent = (one ? '' : nameOf(re) + ' — ') + '고른 원본을 찾지 못해 다른 보관본을 확인하는 중…'; return; }
      if (n > 0) { note.textContent = (one ? '한글 원본' : '원본 ' + n + '개') + ' 살펴보는 중…'; return; }
      var bad = items.filter(function (it) { return it.state === 'fail'; });
      var empty = items.filter(function (it) { return it.state === 'nofield'; });
      var msgs = [];
      if (bad.length) msgs.push('⚠ 원본을 찾지 못했습니다' + (one ? ' — 양식 수정에서 원본 파일을 다시 올려 주세요 (' + bad[0].err + ')'
        : ' — ' + bad.map(nameOf).join(', ') + ' (양식 수정에서 원본을 다시 올리거나, 받을 때 채운 본문으로 넣을 수 있습니다)'));
      if (empty.length) msgs.push('⚠ ' + (one ? kindWord(empty[0]) : empty.map(nameOf).join(', ')) + ' 원본에 채울 자리(회사명 같은 표시)가 없습니다 — 원본에 표시를 넣으면 채워집니다');
      note.textContent = msgs.join(' / ');
      if (pickSel) items.forEach(function (it, i) { var o = pickSel.options[i]; if (o) o.textContent = (i + 1) + '. ' + nameOf(it) + tagOf(it); });
    }
    function loadHwp(it, tried) {
      it.hwp = null; it.err = '';
      if (!it.src) { it.state = 'none'; refresh(); return Promise.resolve(); }
      var my = it.src;
      it.state = 'loading'; refresh();
      return host.hwpBytes(my).then(function (u8) {
        return host.hwpMarkers(u8, my.name).then(function (ks) { return { bytes: u8, markers: ks || [] }; });
      }).then(function (h) {
        if (it.src !== my) return;   // 그사이 다른 원본으로 바꿨다 — 새 불러오기가 상태를 정한다
        it.hwp = h; it.retry = false; it.state = h.markers.length ? 'ok' : 'nofield';
        refresh(); drawVals();
      }, function (e) {
        if (it.src !== my) return;
        var used = tried || [], next = it.srcs.filter(function (s) { return used.indexOf(s) < 0 && s !== my; })[0];
        if (next) {
          it.src = next;
          it.retry = true;   // 안내에 «다른 보관본을 보는 중»을 띄운다 (refresh)
          if (srcSel) srcSel.value = String(it.srcs.indexOf(next));
          syncBtns();
          return loadHwp(it, used.concat([my]));
        }
        it.err = (e && e.message) || String(e); it.retry = false; it.state = 'fail';
        refresh();
      });
    }
    function loadAll() {
      return items.reduce(function (p, it) { return p.then(function () { return it.state === 'wait' ? loadHwp(it) : null; }); }, Promise.resolve());
    }
    function isXl(it) { return !!it.src && /\.xlsx$/i.test(it.src.name || ''); }
    function kindWord(it) { return isXl(it) ? '엑셀' : '한글'; }
    function extOf(it) { return it.src ? (isXl(it) ? '.xlsx' : '.hwp') : '.txt'; }
    /* 채운 본문 — UTF-8 표시(BOM)를 붙인다. 없으면 한글 등 옛 도구가 CP949 로 읽어 글자가 깨진다 */
    function textBytes(s) {
      var b = new TextEncoder().encode(s), o = new Uint8Array(b.length + 3);
      o[0] = 0xEF; o[1] = 0xBB; o[2] = 0xBF; o.set(b, 3);
      return o;
    }
    /* 한 양식 채우기 → { bytes, ext, unknown, relayoutFailed }. 원본이 없거나 asText 면 채운 본문(.txt) */
    function fillOne(it, asText) {
      /* 손본 문서가 있으면 그것을 쓴다(양식 하나일 때만 — 손보기 단추도 그때만 뜬다) */
      if (one && st.edited && !asText) return Promise.resolve({ bytes: st.edited.bytes, ext: st.edited.ext, unknown: [] });
      var V = values();
      if (!it.src || asText) return Promise.resolve({ bytes: textBytes(CF.fillText(it.fm.body, V)), ext: '.txt', unknown: [] });
      if (!it.hwp) return Promise.reject(new Error(nameOf(it) + ': ' + (it.state === 'fail' ? '원본을 찾지 못했습니다' : '원본을 아직 읽는 중입니다')));
      return host.hwpFill(it.hwp.bytes, it.src.name, CF.hwpValues(it.hwp.markers, V)).then(function (r) { r.ext = extOf(it); return r; });
    }
    function outName(it) {
      var V = values();
      return CF.safeName(nameOf(it) + (V.회사명 ? '_' + V.회사명 : '') + (V.근로자명 ? '_' + V.근로자명 : '')) + extOf(it);
    }
    function warnOf(rs) {
      var unk = [], relay = false;
      rs.forEach(function (r) { (r.unknown || []).forEach(function (k) { if (unk.indexOf(k) < 0) unk.push(k); }); if (r.relayoutFailed) relay = true; });
      if (unk.length) toast('⚠ 못 채운 자리 ' + unk.length + '곳(표 속 표일 수 있음): ' + unk.join(', '));
      else if (relay) toast('⚠ 줄 다시 나누기를 못 해 원본 줄 정보로 냈습니다');
    }
    function save(bytes, name, type) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: type }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast('내려받았습니다 — ' + name);
    }
    function doPreview() {
      var it = items[st.pick] || items[0];
      if (!it.src || it.state === 'fail') {   // 원본이 없거나 못 찾았으면 글자 본문을 채워 보여 준다
        prevBox.hidden = false; prevBox.innerHTML = '';
        prevBox.appendChild(el('pre', { 'class': 'pcf-body', text: CF.fillText(it.fm.body, values()) }));
        return;
      }
      note.textContent = '채우는 중…';
      fillOne(it).then(function (r) {
        refresh(); warnOf([r]);
        prevBox.hidden = false; prevBox.innerHTML = '';
        /* 미리보기는 «다시 나누기 전» 사본(preview, .hwpx)으로 — 그림 엔진이 바르게 그린다 */
        return host.hwpShow(prevBox, r.preview || r.bytes, r.preview ? outName(it).replace(/\.[^.]+$/, '') + '.hwpx' : outName(it));
      }).catch(function (e) { note.textContent = '⚠ ' + ((e && e.message) || e); });
    }
    /* ✏ 한글처럼 손보기 (설계 2026-09-29 §6) — 지금 값으로 채운 문서를 편집기로. 다 고치면 받기·메일이 그것을 쓴다 */
    function doEdit() {
      var it = items[0];
      if (busy || !it.src || isXl(it) || !host.hwpEdit) return;
      if (loadingCount()) { note.textContent = '원본을 아직 살펴보는 중입니다'; return; }
      if (!conflictsOkToGo()) return;
      busy = true; refresh(); note.textContent = '채우는 중…';
      var base = st.edited ? Promise.resolve({ bytes: st.edited.bytes, ext: st.edited.ext }) : fillOne(it);
      base.then(function (r) {
        note.textContent = '';
        return host.hwpEdit(r.bytes, outName(it)).then(function (b) {
          busy = false; refresh();
          if (b) { st.edited = { bytes: b, ext: extOf(it) }; drawVals(); toast('✏ 손본 문서를 받기·메일에 씁니다'); }
        });
      }).catch(function (e) { busy = false; refresh(); note.textContent = '⚠ ' + ((e && e.message) || e); });
    }
    /* ✉ 메일로 보내기 (설계 §7) — 채운(손본) 파일을 들고 확인 창으로. 보내는 일은 그 창의 「✉ 보내기」에서만 */
    function doMail() {
      var it = items[0];
      if (busy) return;
      if (loadingCount()) { note.textContent = '원본을 아직 살펴보는 중입니다'; return; }
      if (!conflictsOkToGo()) return;
      busy = true; refresh(); note.textContent = '채우는 중…';
      fillOne(it, it.state === 'fail').then(function (r) {
        busy = false; refresh(); note.textContent = '';
        openSend({ fm: it.fm, V: values(), row: st.co || {}, bytes: r.bytes, pdfSrc: r.preview || null, name: outName(it).replace(/\.[^.]+$/, '') + r.ext,
          isHwp: !!it.src && !isXl(it) && r.ext !== '.txt' }, host);
      }).catch(function (e) { busy = false; refresh(); note.textContent = '⚠ ' + ((e && e.message) || e); });
    }
    function doDownload() {
      if (busy) return;
      if (loadingCount()) { note.textContent = '원본을 아직 살펴보는 중입니다 — 끝나면 받을 수 있습니다'; return; }
      if (!conflictsOkToGo()) return;
      if (one) {
        var it = items[0];
        busy = true; refresh(); note.textContent = '채우는 중…';
        fillOne(it).then(function (r) {
          busy = false; refresh(); warnOf([r]);
          save(r.bytes, outName(it), isXl(it) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/x-hwp');
        }).catch(function (e) { busy = false; refresh(); note.textContent = '⚠ ' + ((e && e.message) || e); });
        return;
      }
      if (!host.zip) { note.textContent = '⚠ 묶음 만들기(압축) 도구가 연결되지 않았습니다'; return; }
      /* 원본을 못 찾은 양식은 «채우기 전에» 한꺼번에 묻는다 — 앞 양식을 다 채운 뒤에 멈추지 않게 */
      var bad = items.filter(function (x) { return x.state === 'fail'; });
      if (bad.length && !w.confirm('원본을 찾지 못한 양식이 ' + bad.length + '개 있습니다:\n  ' + bad.map(nameOf).join('\n  ')
        + '\n\n이 양식은 채운 본문(.txt)으로 넣고 계속할까요?')) return;
      var asText = items.map(function (x) { return x.state === 'fail'; });
      /* 한 벌씩 차례로 — 한글 엔진은 문서 하나를 열 때 메모리를 크게 쓴다 */
      var V = values(), rs = [], k = 0;
      var names = bundleFileNames(items.map(function (x, i) { return { name: x.fm.name, ext: asText[i] ? '.txt' : extOf(x) }; }), V);
      busy = true; refresh();
      function next() {
        if (k >= items.length) return Promise.resolve();
        note.textContent = '채우는 중… (' + (k + 1) + '/' + items.length + ')';
        return fillOne(items[k], asText[k]).then(function (r) { rs.push(r); k++; return next(); });
      }
      next().then(function () {
        return host.zip(rs.map(function (r, i) { return { name: names[i], bytes: r.bytes }; }));
      }).then(function (zipBytes) {
        busy = false; refresh(); warnOf(rs);
        save(zipBytes, zipName(title || '서식묶음', V), 'application/zip');
      }).catch(function (e) { busy = false; refresh(); note.textContent = '⚠ ' + ((e && e.message) || e); });
    }
    function copyText() {
      var t = CF.fillText(items[0].fm.body, values());
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject(new Error('복사 기능이 없습니다')))
        .then(function () { toast('채운 본문을 복사했습니다'); }, function (e) { toast('⚠ ' + ((e && e.message) || e)); });
    }

    var srcSel = null, pickSel = null, btnPrev = null, btnDown = null, fm0 = items[0].fm;
    if (one && items[0].srcs.length > 1) {
      srcSel = el('select', { 'aria-label': '채울 원본', onchange: function () { items[0].src = items[0].srcs[+srcSel.value]; loadHwp(items[0]); syncBtns(); } },
        items[0].srcs.map(function (s, i) { return el('option', { value: String(i), text: s.name }); }));
    }
    if (!one) {
      pickSel = el('select', { 'aria-label': '열어 볼 양식', onchange: function () { st.pick = +pickSel.value; syncBtns(); } },
        items.map(function (it, i) { return el('option', { value: String(i), text: (i + 1) + '. ' + (it.fm.name || '양식') + (it.src ? '' : ' (원본 없음 — 본문)') }); }));
    }
    var head = one
      ? [el('span', { text: '📝 채워서 받기 · ' + (fm0.name || '') }),
        el('small', { style: 'font-weight:400;color:#64748b;margin-right:8px', text: items[0].src ? '원본: ' + items[0].src.name : '한글 원본 없음 — 글자 본문을 채웁니다' })]
      : [el('span', { text: '📦 묶음 채우기 · ' + (title || '고른 양식') + ' (' + items.length + '개)' }),
        el('small', { style: 'font-weight:400;color:#64748b;margin-right:8px', text: '회사·담당자·근로자를 한 번 고르면 모두 채웁니다' })];
    var m = el('div', { 'class': 'pcf-m', role: 'dialog', 'aria-label': one ? '채워서 받기' : '묶음 채우기', style: 'width:980px' }, [
      el('div', { 'class': 'pcf-mh' }, head.concat([el('button', { type: 'button', 'aria-label': '닫기', text: '×', onclick: close })])),
      el('div', { 'class': 'pcf-mb' }, [
        srcSel ? el('div', { style: 'margin-bottom:8px' }, [el('span', { 'class': 'pcf-fh', text: '채울 원본 ' }), srcSel]) : null,
        el('div', { 'class': 'pcf-fcols' }, [
          el('div', null, [
            el('div', { 'class': 'pcf-fh', text: '① 회사 — ERP 업체관리에서 찾기' }), coQ, coList, coPicked,
            el('div', { 'class': 'pcf-fh', text: '② 담당자 — 기업정보함에서 찾아오기' }), ctQ, ctBox,
            el('div', { 'class': 'pcf-fh', text: '③ 근로자 본인 — 명함에서 찾기 또는 직접 적기' }), wkQ, wkList
          ]),
          el('div', null, [propBox, caseBox, valBox])
        ]),
        note, prevBox
      ]),
      el('div', { 'class': 'pcf-mf' }, [
        el('button', { type: 'button', 'class': 'pcf-b', text: '닫기', onclick: close }),
        one && fm0.body ? el('button', { type: 'button', 'class': 'pcf-b', text: '본문 복사', onclick: copyText }) : null,
        pickSel,
        btnPrev = el('button', { type: 'button', 'class': 'pcf-b', onclick: doPreview }),
        (one && items[0].src && !isXl(items[0]) && host.hwpEdit) ? el('button', { type: 'button', 'class': 'pcf-b', text: '✏ 한글처럼 손보기', onclick: doEdit }) : null,
        (one && host.mail) ? el('button', { type: 'button', 'class': 'pcf-b', style: 'background:#166534;color:#fff', text: '✉ 메일로 보내기 →', onclick: doMail }) : null,
        btnDown = (one && !items[0].src) ? null : el('button', { type: 'button', 'class': 'pcf-b b', style: 'background:#1e40af;color:#fff', onclick: doDownload })
      ])
    ]);
    function syncBtns() {
      var it = items[st.pick] || items[0];
      if (btnPrev) btnPrev.textContent = it.src ? kindWord(it) + '로 열어 보기' : '채운 본문 보기';
      if (btnDown) btnDown.textContent = one ? kindWord(items[0]) + ' 파일 내려받기' : '📦 ' + items.length + '개 묶음 받기 (.zip)';
    }
    syncBtns();
    bg.appendChild(m);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.body.appendChild(bg);
    drawContacts(); drawVals();
    /* 기업정보함 「📨 제안서 보내기」로 왔으면 그 회사를 골라 둔다 (설계 2026-09-29 §8).
       ⚠ «회사» 줄만 — 사람(명함·담당자) 줄도 같은 회사 이름을 가져 먼저 걸리면 회사 칸이 비뚤어진다. */
    var preKey = host.propose || host.make || (host.contractCtx && host.contractCtx.coKey) || '';
    if (preKey) withRows(function (rows) {
      if (st.co) return;
      var r = rows.filter(function (x) { return (x.k === 'biz' || x.k === 'erp' || x.k === 'card-co') && CF.sentKeys(x, {}).indexOf(preKey) >= 0; })[0];
      if (r) pickCo(r);
      else note.textContent = '기업정보함에서 고른 회사를 업체 목록에서 찾지 못했습니다 — 위 ① 에서 찾아 고르세요';
    });
    refresh(); loadAll();
    setTimeout(function () { coQ.focus(); }, 0);
  }

  /* ✉ 메일로 보내기 확인 창 (설계 2026-09-29 §7) — 「✉ 보내기」를 눌러야만 나간다.
     o = { fm, V, row, bytes, name, isHwp }. 보낸 뒤: 보낸 서류 기록(받는 주소 없음) + (선택) 기업별 서류에 사본.
     ⚠ db 를 직접 만지지 않는다 — host.mail 이 한다(tests/form-cardfill.test.js 의 «채우기 창은 쓰지 않는다» 규칙). */
  function openSend(o, host) {
    var CF = w.PuFormCardFill, V = o.V || {}, d = CF.mailDefaults(V, o.fm.name || '서류');
    var MAX = 18 * 1024 * 1024, busy = false, mode = 'auto';
    ensureCss();
    var bg = el('div', { 'class': 'pcf-mbg', style: 'z-index:10001' });
    function close() { document.removeEventListener('keydown', onKey); bg.remove(); }
    function onKey(e) { if (e.key === 'Escape' && !busy) close(); }
    document.addEventListener('keydown', onKey);
    var toSel = el('select', { 'aria-label': '받는 사람' }, d.to.map(function (x) { return el('option', { value: x.v, text: x.label }); })
      .concat([el('option', { value: '', text: '직접 적기…' })]));
    var toIn = el('input', { type: 'email', placeholder: '받는 메일 주소', 'aria-label': '받는 메일 주소', hidden: d.to.length > 0 });
    toSel.addEventListener('change', function () { toIn.hidden = !!toSel.value; if (!toSel.value) toIn.focus(); });
    var ccIn = el('input', { type: 'text', placeholder: '(선택) 참조 메일', 'aria-label': '참조 메일' });
    var subIn = el('input', { type: 'text', 'aria-label': '제목' }); subIn.value = d.subject;
    var bodyIn = el('textarea', { 'aria-label': '본문', rows: 9, style: 'width:100%;font:inherit;font-size:12.5px;margin-top:6px' }); bodyIn.value = d.body;
    var pdfCk = el('input', { type: 'checkbox', checked: !!o.isHwp, disabled: !o.isHwp, 'aria-label': 'PDF도 붙이기' });
    var keepCk = el('input', { type: 'checkbox', checked: true, 'aria-label': '사본 보관' });
    var note = el('div', { 'class': 'pcf-fnote' });
    var btnSend = el('button', { type: 'button', 'class': 'pcf-b', style: 'background:#166534;color:#fff;font-weight:700', text: '✉ 보내기', onclick: send });
    function toAddr() { return String(toSel.value || toIn.value || '').trim(); }
    function pdfName() { return o.name.replace(/\.[^.]+$/, '') + '.pdf'; }
    function files() {
      var out = [{ name: o.name, bytes: o.bytes }];
      if (!pdfCk.checked) return Promise.resolve(out);
      note.textContent = 'PDF 만드는 중…';
      /* PDF 는 «다시 나누기 전» 사본으로 그린다(있으면) — 한글 프로그램에서 보이는 모양과 같다 */
      return host.hwpPdf(o.pdfSrc || o.bytes, o.pdfSrc ? o.name.replace(/\.[^.]+$/, '') + '.hwpx' : o.name).then(function (b) { out.push({ name: pdfName(), bytes: b }); return out; });
    }
    function after(fs, how) {
      var kind = CF.SENT_KIND_OF(o.fm.groupName || '');
      /* ⚠ 메일은 이미 나갔다 — 기록·보관이 실패해도(동기 throw 포함) «보내기 실패»로 보이면 안 된다(다시 눌러 두 번 간다) */
      var jobs = [function () { return host.mail.record(o.row, V, { kind: kind, names: fs.map(function (f) { return f.name; }), who: V.담당자 || '' }); }];
      if (keepCk.checked) jobs.push(function () { return host.mail.keep(V, { name: o.name, size: o.bytes.length, type: '', bytes: o.bytes }, '[보냄] ' + (o.fm.name || '서류')); });
      return Promise.all(jobs.map(function (fn) { return Promise.resolve().then(fn).then(function () { return ''; }, function (e) { return (e && e.message) || String(e); }); }))
        .then(function (errs) {
          errs = errs.filter(Boolean);
          toast(how + (errs.length ? ' — ⚠ 기록 저장 일부 실패: ' + errs[0] : ' — 보낸 서류에 기록했습니다'));
        });
    }
    function viaMailto(fs) {
      fs.forEach(function (f) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([f.bytes])); a.download = f.name;
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      });
      w.location.href = 'mailto:' + encodeURIComponent(toAddr()) + '?subject=' + encodeURIComponent(subIn.value) + '&body=' + encodeURIComponent(bodyIn.value);
      note.textContent = '메일 창을 열었습니다 — 내려받은 파일을 손으로 붙여 보내 주세요.';
      if (w.confirm('메일 창에서 보내셨으면 「보낸 서류」에 기록을 남길까요?')) return after(fs, '기록했습니다');
      return Promise.resolve();
    }
    function send() {
      if (busy) return;
      var to = toAddr();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { note.textContent = '⚠ 받는 메일 주소를 확인하세요'; return; }
      if (!subIn.value.trim() || !bodyIn.value.trim()) { note.textContent = '⚠ 제목과 본문을 적어 주세요'; return; }
      busy = true; btnSend.disabled = true;
      var failed = false;
      files().then(function (fs) {
        var total = fs.reduce(function (n, f) { return n + f.bytes.length; }, 0);
        if (total > MAX) {
          if (fs.length > 1 && w.confirm('첨부가 18MB를 넘습니다. PDF 를 빼고 보낼까요?')) fs = fs.slice(0, 1);
          else throw new Error('첨부가 18MB를 넘어 보낼 수 없습니다');
        }
        if (mode !== 'auto') return viaMailto(fs);
        note.textContent = '보내는 중…';
        return host.mail.send({ to: to, cc: ccIn.value.trim(), subject: subIn.value.trim(), body: bodyIn.value, toName: V.담당자 || V.수신자 || '' }, fs)
          .then(function () { return after(fs, '✉ 보냈습니다'); }, function (e) {
            failed = true;
            note.textContent = '⚠ 보내지 못했습니다 — ' + ((e && e.message) || e);
            if (w.confirm('메일 서버로 보내지 못했습니다:\n' + ((e && e.message) || e) + '\n\n파일을 내려받고 메일 창으로 보낼까요?')) return viaMailto(fs);
            throw e;
          });
      }).then(function () { busy = false; close(); }, function (e) {
        busy = false; btnSend.disabled = false;
        if (!failed) note.textContent = '⚠ ' + ((e && e.message) || e);
      });
    }
    var m = el('div', { 'class': 'pcf-m', role: 'dialog', 'aria-label': '메일로 보내기', style: 'width:760px' }, [
      el('div', { 'class': 'pcf-mh' }, [el('span', { text: '✉ 메일로 보내기 — ' + (V.회사명 || '') }),
        el('button', { type: 'button', 'aria-label': '닫기', text: '×', onclick: function () { if (!busy) close(); } })]),
      el('div', { 'class': 'pcf-mb' }, [
        el('label', { 'class': 'pcf-frow' }, [el('span', { text: '받는 사람' }), el('div', null, [toSel, toIn])]),
        el('label', { 'class': 'pcf-frow' }, [el('span', { text: '참조' }), ccIn]),
        el('label', { 'class': 'pcf-frow' }, [el('span', { text: '제목' }), subIn]),
        bodyIn,
        el('div', { 'class': 'pcf-fh', text: '첨부' }),
        el('div', { 'class': 'pcf-muted', text: '📄 ' + o.name + ' · ' + Math.max(1, Math.round(o.bytes.length / 1024)) + ' KB' }),
        el('label', { 'class': 'pcf-muted', style: 'display:flex;gap:6px;align-items:center' }, [pdfCk, '📕 같은 내용 PDF도 붙이기 (한글 없는 곳용 · 그림 PDF)']),
        el('div', { 'class': 'pcf-fh', text: '보낸 뒤' }),
        el('label', { 'class': 'pcf-muted', style: 'display:flex;gap:6px;align-items:center' }, [keepCk, '보낸 사본을 기업별 서류 › ' + (V.회사명 || '(회사명 없음)') + ' 에 보관']),
        el('div', { 'class': 'pcf-muted', text: '✔ 기업정보함 「보낸 서류」에 기록합니다 (언제·누가·무슨 서류 — 받는 주소는 남기지 않음)' }),
        note]),
      el('div', { 'class': 'pcf-mf' }, [
        el('span', { 'class': 'pcf-muted', style: 'margin-right:auto', text: '「✉ 보내기」를 누르기 전엔 아무것도 나가지 않습니다.' }),
        el('button', { type: 'button', 'class': 'pcf-b', text: '취소', onclick: function () { if (!busy) close(); } }), btnSend])
    ]);
    bg.appendChild(m); document.body.appendChild(bg);
    host.mail.mode().then(function (md) {
      mode = md;
      if (md !== 'auto') { btnSend.textContent = '⬇ 파일 받고 메일 창 열기'; note.textContent = '회사 메일 자동 발송이 꺼져 있습니다 — 파일을 받아 메일 창에서 붙여 보냅니다.'; }
    });
  }

  /* ══ 양식 관리 화면 — host: { db, track?, tree?, selected?, onSelect?, archive?, downloadOriginal? } ══
     왼쪽 트리(host.tree)에서 고르고, 오른쪽(root)에 A4 종이 한 장으로 크게 본다 (대표 지시 2026-09-26) */
  function mount(root, host) {
    var db = host.db;
    var track = host.track || function (p) { return p; };
    ensureCss();
    /* C안 — 메뉴(host.tree)는 계약유형 6종까지, 측·사건유형은 본문 위 칩, 양식은 본문 목록 (대표 결정 2026-09-27) */
    var S = { forms: [], removed: [], sel: host.selected || null, kind: 'company', side: 'all', grp: 'all', q: '',
      view: loadView(), loaded: false, err: null, bodyEl: null,
      /* 묶음 채우기 — checked 는 고른 차례대로의 양식 id, setId 는 세트로 골랐을 때 그 세트(손대면 풀린다) */
      sets: setsOf(null), checked: [], setId: null, barEl: null };

    function loadView() { try { return localStorage.getItem('pcf_view') === 'card' ? 'card' : 'list'; } catch (_) { return 'list'; } }
    function saveView() { try { localStorage.setItem('pcf_view', S.view); } catch (_) {} }
    /* 기업정보함 「📨 제안서 보내기」로 왔을 때 (설계 2026-09-29 §8) — 기금관리 › 제안서·견적서 로 가고,
       제안서가 하나면 채우기 창을 바로 연다(회사는 openFill 이 host.propose 로 골라 둔다). 처음 한 번만. */
    /* 이알피 「📦 문서관리에서 묶음 채우기」로 왔을 때 (설계 2026-10-03 §4) — 계약을 읽어 값(PuContractVars)을 host.contractCtx 에 두고,
       이알피 계약서 출력과 같은 규칙으로 양식을 체크해 아래 묶음 막대를 띄운다. 채우기는 사람이 막대를 눌러서. */
    /* 📦 계약 여러 건 (서식 묶음 설계 2026-09-28 상황 1-C) — 이알피 계약을 골라, 계약마다 이알피와 같은 규칙으로 양식을 골라
       같은 한 벌 값으로 채워 .zip 하나(계약마다 폴더)로 받는다. 하나씩 차례로 — 한 건이 실패해도 나머지는 계속.
       ⚠ db 를 만지지 않는다(읽기는 host). 메일·보낸 기록은 없다(내려받기만) — 보낼 때는 계약 하나씩 「📦 문서관리에서 묶음 채우기」로. */
    /* 📄 계약서 만들기 창 — 종류 고르기 → 세트 체크 → 채우기 창(회사는 host.make 로 골라 둔다) */
    function openMake() {
      ensureCss();
      var cur = MAKE_KINDS[0].v, plan = null, picked = {};
      var bg = el('div', { 'class': 'pcf-mbg' });
      function close() { document.removeEventListener('keydown', onKey); bg.remove(); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', onKey);
      var kinds = el('div', { 'class': 'pcf-mk-kinds' }), box = el('div', { 'class': 'pcf-ct-list' });
      var btnGo = el('button', { type: 'button', 'class': 'pcf-b', style: 'background:#166534;color:#fff;font-weight:700', onclick: go });
      function sel() { return plan.list.filter(function (f) { return picked[f.id]; }); }
      function sync() { var n = sel().length; btnGo.textContent = n ? '📝 ' + n + '개 채우기 → 확인표' : '양식을 고르세요'; btnGo.disabled = !n; }
      function setKind(v) {
        cur = v; plan = makePlan(S.forms, v); picked = {};
        plan.checked.forEach(function (id) { picked[id] = true; });
        drawKinds(); draw();
      }
      function drawKinds() {
        kinds.innerHTML = '';
        MAKE_KINDS.forEach(function (k) {
          var n = makePlan(S.forms, k.v).list.length;
          kinds.appendChild(el('button', { type: 'button', 'class': 'pcf-mk-kind' + (k.v === cur ? ' on' : ''), 'aria-pressed': k.v === cur ? 'true' : 'false',
            disabled: !n, onclick: function () { setKind(k.v); } }, [el('b', { text: k.icon + ' ' + k.label }), el('small', { text: n ? k.sub : '양식 없음' })]));
        });
      }
      function draw() {
        box.innerHTML = '';
        var rows = plan.list, allOn = rows.length > 0 && rows.every(function (f) { return picked[f.id]; });
        box.appendChild(el('label', { 'class': 'pcf-ct-row pcf-mk-row pcf-ct-head' }, [el('input', { type: 'checkbox', checked: allOn, 'aria-label': '모두',
          onchange: function (e) { rows.forEach(function (f) { picked[f.id] = e.target.checked; }); draw(); } }), el('b', { text: '#' }), el('b', { text: '양식' }), el('b', { text: '원본' })]));
        if (!rows.length) box.appendChild(el('div', { 'class': 'pcf-muted', style: 'padding:10px', text: '이 종류의 양식이 없습니다' }));
        rows.forEach(function (f, i) {
          var src = hwpSources(f)[0];
          box.appendChild(el('label', { 'class': 'pcf-ct-row pcf-mk-row' }, [
            el('input', { type: 'checkbox', checked: !!picked[f.id], onchange: function (e) { picked[f.id] = e.target.checked; sync(); } }),
            el('span', { text: String(i + 1) }),
            el('span', { text: f.name + (groupOf(f) === PROPOSAL_GROUP ? ' · 견적·제안' : '') }),
            el('span', { 'class': 'pcf-muted', text: src ? (/\.xlsx$/i.test(src.name) ? '엑셀' : '한글') : '본문' })]));
        });
        sync();
      }
      function go() {
        var list = sel(); if (!list.length) return;
        var mk = MAKE_KINDS.filter(function (x) { return x.v === cur; })[0];
        close();
        S.kind = mk.kind; resetFilters(); S.checked = list.map(function (f) { return f.id; }); select(list[0].id);
        openFill(list, host, mk.icon + ' ' + mk.label + ' 계약서');
      }
      var m = el('div', { 'class': 'pcf-m', role: 'dialog', 'aria-label': '계약서 만들기', style: 'width:760px' }, [
        el('div', { 'class': 'pcf-mh' }, [el('span', { text: '📄 계약서 만들기 — 기업정보함에서 고른 회사' }),
          el('button', { type: 'button', 'aria-label': '닫기', text: '×', onclick: close })]),
        el('div', { 'class': 'pcf-mb' }, [
          el('div', { 'class': 'pcf-fh', text: '계약 종류' }), kinds,
          el('div', { 'class': 'pcf-fh', text: '채울 양식 — 세트대로 미리 체크했습니다(빼거나 더할 수 있습니다)' }), box,
          el('div', { 'class': 'pcf-muted', style: 'margin-top:6px', text: '계약금액·기간은 다음 창(확인표)에서 적습니다. 회사·담당자는 이알피·기업정보함에서 채웁니다.' })]),
        el('div', { 'class': 'pcf-mf' }, [el('button', { type: 'button', 'class': 'pcf-b', text: '닫기', onclick: close }), btnGo])
      ]);
      bg.appendChild(m); document.body.appendChild(bg);
      setKind(cur);
    }
    function openContracts() {
      if (!host.contractList || !host.contractLoad) return;
      ensureCss();
      var list = [], picked = {}, busy = false, onlySigned = true, result = null;
      var bg = el('div', { 'class': 'pcf-mbg' });
      function close() { if (busy) return; document.removeEventListener('keydown', onKey); bg.remove(); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', onKey);
      var q = el('input', { type: 'search', placeholder: '계약번호·회사 찾기', 'aria-label': '계약 찾기' });
      var signedCk = el('input', { type: 'checkbox', checked: true, 'aria-label': '서명된 계약만' });
      var box = el('div', { 'class': 'pcf-ct-list' });
      var note = el('div', { 'class': 'pcf-fnote' });
      var btnGo = el('button', { type: 'button', 'class': 'pcf-b', style: 'background:#166534;color:#fff;font-weight:700', onclick: run });
      function shownList() {
        var qq = q.value.trim().toLowerCase();
        return list.filter(function (c) {
          if (onlySigned && c.status !== 'signed') return false;
          return !qq || (c.contractNo + ' ' + c.companyName).toLowerCase().indexOf(qq) >= 0;
        });
      }
      function count() { return Object.keys(picked).filter(function (k) { return picked[k]; }).length; }
      function sync() { var n = count(); btnGo.textContent = n ? '📦 ' + n + '건 채워서 받기 (.zip)' : '계약을 고르세요'; btnGo.disabled = busy || !n; }
      function draw() {
        box.innerHTML = '';
        var rows = shownList();
        var allOn = rows.length > 0 && rows.every(function (c) { return picked[c.id]; });
        var head = el('label', { 'class': 'pcf-ct-row pcf-ct-head' }, [el('input', { type: 'checkbox', checked: allOn, 'aria-label': '보이는 계약 모두',
          onchange: function (e) { rows.forEach(function (c) { picked[c.id] = e.target.checked; }); draw(); } }), el('b', { text: '#' }),
          el('b', { text: '계약번호' }), el('b', { text: '회사' }), el('b', { text: '종류' }), el('b', { text: '계약일' }), el('b', { text: '결과' })]);
        box.appendChild(head);
        if (!rows.length) { box.appendChild(el('div', { 'class': 'pcf-muted', style: 'padding:10px', text: list.length ? '찾는 계약이 없습니다' : '계약을 읽는 중…' })); sync(); return; }
        rows.forEach(function (c, i) {
          var r = result && result[c.id];
          box.appendChild(el('label', { 'class': 'pcf-ct-row' }, [
            el('input', { type: 'checkbox', checked: !!picked[c.id], disabled: busy, onchange: function (e) { picked[c.id] = e.target.checked; sync(); } }),
            el('span', { text: String(i + 1) }), el('span', { text: c.contractNo || '(번호 없음)' }), el('span', { text: c.companyName || '' }),
            el('span', { text: (c.kinds || []).map(function (k) { var x = KINDS.filter(function (y) { return y.v === k; })[0]; return x ? x.label : k; }).join('·') }),
            el('span', { text: c.signDate || '' }),
            el('span', { 'class': r && r.err ? 'pcf-ct-bad' : '', text: r ? (r.err ? '⚠ ' + r.err : r.n != null ? '✔ ' + r.n + '개' : r.state || '') : '' })]));
        });
        sync();
      }
      q.addEventListener('input', draw);
      signedCk.addEventListener('change', function () { onlySigned = signedCk.checked; draw(); });
      function run() {
        if (busy) return;
        var ids = list.filter(function (c) { return picked[c.id]; }).map(function (c) { return c.id; });
        if (!ids.length || !host.zip) return;
        busy = true; result = {}; draw();
        var files = [], made = 0, fails = 0;
        ids.reduce(function (p, id, i) {
          return p.then(function () {
            result[id] = { state: '채우는 중…' }; draw();
            note.textContent = '채우는 중… (' + (i + 1) + '/' + ids.length + ')';
            return host.contractLoad(id).then(function (info) {
              var pick = contractPick(S.forms, info), fms = pick.map(function (fid) { return S.forms.filter(function (f) { return f.id === fid; })[0]; }).filter(Boolean);
              if (!fms.length) throw new Error('이 계약 종류의 양식이 없습니다');
              var V = contractValues(info), folder = contractFolder(info, i), outs = [];
              return fms.reduce(function (q2, fm) {
                return q2.then(function () {
                  return fillFormOnce(fm, V, host).catch(function () { return { bytes: bomText(w.PuFormCardFill.fillText(fm.body, V)), ext: '.txt', unknown: [] }; })
                    .then(function (r) { outs.push({ fm: fm, r: r }); });
                });
              }, Promise.resolve()).then(function () {
                var names = bundleFileNames(outs.map(function (o) { return { name: o.fm.name, ext: o.r.ext }; }), V);
                outs.forEach(function (o, k) { files.push({ name: folder + '/' + names[k], bytes: o.r.bytes }); });
                made++; result[id] = { n: outs.length };
              });
            }).catch(function (e) { fails++; result[id] = { err: (e && e.message) || String(e) }; });
          });
        }, Promise.resolve()).then(function () {
          draw();
          if (!files.length) { busy = false; sync(); note.textContent = '⚠ 채운 서류가 없습니다'; return; }
          note.textContent = '묶는 중…';
          return host.zip(files).then(function (zb) {
            var d = new Date(), ymd = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
            var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([zb], { type: 'application/zip' }));
            a.download = '계약 묶음 ' + made + '건_' + ymd + '.zip'; document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
            busy = false; sync(); draw();
            note.textContent = '✔ ' + made + '건 · 서류 ' + files.length + '개를 받았습니다' + (fails ? ' · ⚠ ' + fails + '건은 못 채움(줄 끝 까닭)' : '');
          });
        }).catch(function (e) { busy = false; sync(); note.textContent = '⚠ ' + ((e && e.message) || e); });
      }
      var m = el('div', { 'class': 'pcf-m', role: 'dialog', 'aria-label': '계약 여러 건 채우기', style: 'width:900px' }, [
        el('div', { 'class': 'pcf-mh' }, [el('span', { text: '📦 계약 여러 건 — 계약마다 서류 묶음을 채워 .zip 하나로' }),
          el('button', { type: 'button', 'aria-label': '닫기', text: '×', onclick: close })]),
        el('div', { 'class': 'pcf-mb' }, [
          el('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap' }, [q,
            el('label', { 'class': 'pcf-muted', style: 'display:flex;gap:4px;align-items:center' }, [signedCk, '서명된 계약만'])]),
          box,
          el('div', { 'class': 'pcf-muted', style: 'margin-top:6px', text: '계약마다 이알피 「계약서 출력」과 같은 규칙으로 양식을 고르고, 계약 자료(번호·날짜·금액·기간·담당)로 채웁니다. 메일은 계약 하나씩 이알피에서 「📦 계약서등관리에서 묶음 채우기」로.' }),
          note]),
        el('div', { 'class': 'pcf-mf' }, [el('button', { type: 'button', 'class': 'pcf-b', text: '닫기', onclick: close }), btnGo])
      ]);
      bg.appendChild(m); document.body.appendChild(bg);
      draw();
      host.contractList().then(function (ls) {
        list = ls.sort(function (x, y) { return String(y.signDate).localeCompare(String(x.signDate)); }); draw();
      }, function (e) { note.textContent = '⚠ 이알피 계약을 읽지 못했습니다 — ' + ((e && e.message) || e); });
    }
    function openContract() {
      if (!host.contractLoad) return;
      toast('이알피 계약 자료를 읽는 중…');
      host.contractLoad(host.contract).then(function (info) {
        host.contractCtx = { vals: info.vals, coKey: info.coKey, label: '계약 ' + (info.contractNo || info.id) };
        var ids = contractPick(S.forms, info);
        if (!ids.length) { drawMain(); toast('이 계약 종류의 양식이 아직 없습니다 — 계약 자료는 「찾아서 채우기」에 그대로 쓰입니다'); return; }
        var first = S.forms.filter(function (f) { return f.id === ids[0]; })[0];
        S.kind = first.kind; resetFilters();
        S.checked = ids.slice(); S.setId = null;
        select(first.id);
        toast('📦 ' + host.contractCtx.label + ' — 양식 ' + ids.length + '개를 골라 두었습니다. 아래 막대에서 「채워서 받기」를 누르세요');
      }, function (e) { toast('⚠ 이알피 계약을 읽지 못했습니다 — ' + ((e && e.message) || e)); });
    }
    function openPropose() {
      /* 제안서·견적서가 있는 첫 종류(업체계약 → 컨설팅 → 기타사업 → 기금관리)를 연다 — 예전에는 기금관리만 봤다 */
      var kinds = ['company', 'consulting', 'other', 'fund'].filter(function (k) { return filterForms(S.forms, { kind: k, grp: PROPOSAL_GROUP }).length; });
      S.kind = kinds[0] || 'company'; S.side = 'all'; S.grp = PROPOSAL_GROUP; S.q = '';
      var list = filterForms(S.forms, { kind: S.kind, grp: PROPOSAL_GROUP });
      if (!list.length) { drawTree(); drawMain(); toast('제안서·견적서 양식이 아직 없습니다 — 먼저 원본을 올려 주세요'); return; }
      if (kinds.length > 1) toast('다른 종류에도 제안서·견적서가 있습니다: ' + kinds.slice(1).map(function (k) { return kindInfo(k).label; }).join('·'));
      select(list[0].id);
      if (list.length === 1) openFill([list[0]], host);
      else toast('보낼 제안서를 고르고 「📝 찾아서 채우기」를 누르세요 — 회사는 골라 둡니다');
    }
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
        if (host.propose && !S.proposed) { S.proposed = true; openPropose(); }
        if (host.make && !S.made) { S.made = true; openMake(); }
        if (host.contract && !S.contractTried) { S.contractTried = true; openContract(); }
        /* 세트는 따로 받는다 — 못 받아도 양식 화면은 그대로 쓴다(기본 세트만 보인다) */
        db.ref(PATH_SETS).once('value').then(function (s) { S.sets = setsOf(s.val()); drawMain(); }, function () {});
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
    /* ✏ 바꿀 자리 만들기 (설계 2026-09-29 §4) — 원본 글자를 찾아 {{표시}} / 고친 글자로.
       작업은 «바이트 사본» 위에서만 — 저장하기 전엔 양식도 원본도 그대로다. 되돌리기는 이 창 안에서만. */
    function openMark(fm) {
      var M = w.PuHwpMark, src = hwpSources(fm).filter(function (x) { return /\.(hwp|hwpx)$/i.test(x.name || ''); })[0];
      if (!M || !src || !host.hwpMark) { toast('한글 원본이 있어야 바꿀 자리를 만들 수 있습니다'); return; }
      ensureCss();
      var name = src.name, stack = [], cur = null, done = [], hits = [], busy = false;
      var bg = el('div', { 'class': 'pcf-mbg' });
      function close() { document.removeEventListener('keydown', onKey); bg.remove(); }
      function onKey(e) { if (e.key === 'Escape' && !busy) close(); }
      document.addEventListener('keydown', onKey);
      var findIn = el('input', { type: 'text', placeholder: '원본에서 찾을 글자 (예: ○○도 노동국 … 팀장님)', 'aria-label': '찾을 글자' });
      var modeMk = el('input', { type: 'radio', name: 'pcf-mk-mode', checked: true, 'aria-label': '표시로 바꾸기' });
      var modeTx = el('input', { type: 'radio', name: 'pcf-mk-mode', 'aria-label': '글자로 바꾸기' });
      var mkIn = el('input', { type: 'text', placeholder: '표시 이름 (예: 수신자)', 'aria-label': '표시 이름' });
      var txIn = el('input', { type: 'text', placeholder: '바꿀 글자 (오탈자 고치기)', 'aria-label': '바꿀 글자' });
      var whichSel = el('select', { 'aria-label': '어느 자리' });
      var hitBox = el('div', { 'class': 'pcf-mk-hits' });
      var doneBox = el('div');
      var prev = el('div', { 'class': 'pcf-fprev' });
      var note = el('div', { 'class': 'pcf-fnote' });
      var btnDo = el('button', { type: 'button', 'class': 'pcf-b b', text: '바꾸기', onclick: doReplace });
      var btnUndo = el('button', { type: 'button', 'class': 'pcf-b', text: '↩ 마지막 것 되돌리기', onclick: undo });
      var btnSave = el('button', { type: 'button', 'class': 'pcf-b', style: 'background:#166534;color:#fff', text: '새 원본으로 저장', onclick: saveNew });
      var chips = el('div', { 'class': 'pcf-crow', style: 'margin:2px 0 8px' }, M.COMMON.map(function (k) {
        return el('button', { type: 'button', 'class': 'pcf-chip', text: k, onclick: function () { mkIn.value = k; modeMk.checked = true; sync(); } });
      }));
      function target() { return modeMk.checked ? M.markName(mkIn.value) : String(txIn.value || ''); }
      function sync() {
        btnUndo.disabled = busy || !stack.length;
        btnSave.disabled = busy || !done.length;
        btnDo.disabled = busy || !hits.length || !target();
      }
      function show() { prev.innerHTML = ''; if (host.hwpShow && cur) host.hwpShow(prev, cur, name); }
      function drawDone() {
        doneBox.innerHTML = '';
        if (!done.length) return;
        doneBox.appendChild(el('div', { 'class': 'pcf-fh', text: '이번에 바꾼 것 (' + done.length + ')' }));
        done.forEach(function (d) { doneBox.appendChild(el('div', { 'class': 'pcf-muted', text: '「' + d.find + '」 → ' + d.to + ' · ' + d.n + '곳' })); });
      }
      var findT = null;
      function find() {
        var q = findIn.value;
        hitBox.innerHTML = ''; whichSel.innerHTML = ''; hits = []; sync();
        if (!q.trim() || !cur) return;
        host.hwpFind(cur, name, q).then(function (hs) {
          if (findIn.value !== q) return;
          hits = hs;
          if (!hs.length) { hitBox.appendChild(el('div', { 'class': 'pcf-muted', text: '찾지 못했습니다 — 띄어쓰기까지 같아야 합니다' })); sync(); return; }
          hitBox.appendChild(el('div', { 'class': 'pcf-fh', text: '✔ ' + hs.length + '곳 찾음' }));
          hs.forEach(function (h, i) {
            hitBox.appendChild(el('div', { 'class': 'pcf-mk-hit' }, [el('b', { text: (i + 1) + '. ' }), '…' + h.before,
              el('mark', { text: q }), h.after + '…', h.cell ? el('small', { text: ' (표 칸)' }) : null]));
          });
          whichSel.appendChild(el('option', { value: 'all', text: '모두 (' + hs.length + '곳)' }));
          if (hs.length > 1) hs.forEach(function (h, i) { whichSel.appendChild(el('option', { value: String(i), text: '이 곳만 — ' + (i + 1) + '/' + hs.length })); });
          sync();
        }, function (e) { note.textContent = '⚠ 찾지 못했습니다 — ' + ((e && e.message) || e); });
      }
      findIn.addEventListener('input', function () { clearTimeout(findT); findT = setTimeout(find, 250); });
      [mkIn, txIn].forEach(function (x) { x.addEventListener('input', sync); });
      [modeMk, modeTx].forEach(function (x) { x.addEventListener('change', sync); });
      function doReplace() {
        var q = findIn.value, to = target(), which = whichSel.value === 'all' ? 'all' : +whichSel.value;
        if (!q || !to || busy) return;
        busy = true; sync(); note.textContent = '바꾸는 중…';
        host.hwpMark(cur, name, q, to, which).then(function (r) {
          busy = false;
          if (!r.count) { note.textContent = '⚠ 바꾸지 못했습니다' + (r.failed ? ' (' + r.failed + '곳 실패)' : ''); sync(); return; }
          stack.push(cur); cur = r.bytes;
          done.push({ find: q, to: to, n: r.count });
          note.textContent = '✔ ' + r.count + '곳 바꿈' + (r.failed ? ' · ⚠ ' + r.failed + '곳은 못 바꿈(표 속 표일 수 있음)' : '');
          drawDone(); show(); find();
        }, function (e) { busy = false; note.textContent = '⚠ ' + ((e && e.message) || e); sync(); });
      }
      function undo() {
        if (!stack.length || busy) return;
        cur = stack.pop(); done.pop(); note.textContent = '↩ 되돌렸습니다'; drawDone(); show(); find();
      }
      /* 새 원본으로 저장 — ① 보관함 사본이 없는 옛 한글 첨부를 먼저 보관함에 ② 새 파일을 보관함에 ③ 양식을 거래로 고친다 */
      function saveNew() {
        if (!done.length || busy) return;
        if (!host.archive) { toast('원본 보관함이 연결되지 않았습니다'); return; }
        busy = true; sync(); note.textContent = '저장하는 중…';
        var from = { kind: 'form', formId: fm.id, formName: fm.name || '', formKind: fm.kind };
        var olds = orphanInline(fm);
        Promise.all(olds.map(function (a) {
          var b = bytesOfDataUrl(a.data || a.dataUrl);
          return host.archive({ name: a.name, size: b.length, type: '', bytes: b }, from).then(function (r) {
            if (!r || !r.fileId) throw new Error('옛 원본을 보관함에 올리지 못했습니다');
            return { fileId: r.fileId, name: a.name, size: b.length, attId: a.id };
          });
        })).then(function (oldEntries) {
          return host.archive({ name: name, size: cur.length, type: '', bytes: cur }, from).then(function (r) {
            if (!r || !r.fileId) throw new Error('새 원본을 보관함에 올리지 못했습니다');
            var small = cur.length <= ATTACH_MAX;
            var nu = { fileId: r.fileId, name: name, size: cur.length, attId: small ? newId('at-') : '', data: small ? dataUrlOf(cur) : '' };
            return change(function (list) {
              return list.map(function (x) {
                if (x.id !== fm.id) return x;
                var keep = JSON.parse(JSON.stringify(x));
                keep.originals = (Array.isArray(keep.originals) ? keep.originals : []).concat(oldEntries);
                return withNewOriginal(keep, nu);
              });
            }, '✔ 새 원본으로 저장했습니다 — 이전 원본은 보관함에 남아 있습니다');
          });
        }).then(function () { busy = false; close(); }, function (e) {
          busy = false; note.textContent = '⚠ 저장하지 못했습니다 — ' + ((e && e.message) || e) + ' (양식은 그대로입니다)'; sync();
        });
      }
      var m = el('div', { 'class': 'pcf-m', role: 'dialog', 'aria-label': '바꿀 자리 만들기', style: 'width:1040px' }, [
        el('div', { 'class': 'pcf-mh' }, [el('span', { text: '✏ 바꿀 자리 만들기 · ' + (fm.name || '') }),
          el('small', { style: 'font-weight:400;color:#64748b;margin-right:8px', text: '원본: ' + name }),
          el('button', { type: 'button', 'aria-label': '닫기', text: '×', onclick: function () { if (!busy) close(); } })]),
        el('div', { 'class': 'pcf-mb' }, [el('div', { 'class': 'pcf-fcols' }, [
          el('div', null, [
            el('div', { 'class': 'pcf-fh', text: '① 원본에서 찾을 글자' }), findIn, hitBox,
            el('div', { 'class': 'pcf-fh', text: '② 무엇으로 바꿀까요' }),
            el('label', { 'class': 'pcf-frow' }, [el('span', null, [modeMk, ' 표시']), mkIn]), chips,
            el('label', { 'class': 'pcf-frow' }, [el('span', null, [modeTx, ' 글자']), txIn]),
            el('label', { 'class': 'pcf-frow' }, [el('span', { text: '③ 어느 자리' }), whichSel]),
            el('div', { style: 'display:flex;gap:6px;margin:6px 0' }, [btnDo, btnUndo]),
            note, doneBox]),
          prev])]),
        el('div', { 'class': 'pcf-mf' }, [
          el('span', { 'class': 'pcf-muted', style: 'margin-right:auto', text: '저장하면 새 원본이 되고, 이전 원본은 🗄 원본 보관함에 남습니다.' }),
          el('button', { type: 'button', 'class': 'pcf-b', text: '닫기', onclick: function () { if (!busy) close(); } }), btnSave])
      ]);
      bg.appendChild(m); document.body.appendChild(bg);
      note.textContent = '원본을 여는 중…'; busy = true; sync();
      host.hwpBytes(src).then(function (u8) { cur = u8; busy = false; note.textContent = ''; show(); sync(); findIn.focus(); },
        function (e) { busy = false; note.textContent = '⚠ 원본을 열지 못했습니다 — ' + ((e && e.message) || e); sync(); });
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
      /* 📦 세트 (대표 「추천대로」 2026-10-07 화면 개편) — 업무마다 필요한 서류 묶음. 누르면 목록에 그 양식들이 체크된다 */
      t.appendChild(el('div', { 'class': 'pcf-th', text: '📦 세트' }));
      S.sets.forEach(function (st) {
        var on = S.setId === st.id;
        t.appendChild(el('button', { type: 'button', 'class': 'pcf-tk' + (on ? ' on' : ''), title: st.name + ' — 누르면 목록에 체크됩니다',
          onclick: function () { applySet(st.id); } }, [el('span', { text: st.name }), el('i', { text: String((st.formIds || []).length) })]));
      });
      t.appendChild(el('button', { type: 'button', 'class': 'pcf-tk add', text: '+ 세트 만들기', onclick: function () {
        if (S.checked.length) saveAsSet(); else toast('목록에서 양식을 체크한 뒤 다시 누르세요 — 체크한 양식으로 세트를 만듭니다');
      } }));
    }

    /* ── 오른쪽 ── */
    function mobileSelects() {
      var kSel = el('select', { 'aria-label': '계약 종류', onchange: function () { pickKind(kSel.value); } }, KINDS.map(function (k) {
        var n = S.forms.filter(function (x) { return x.kind === k.v; }).length;
        return el('option', { value: k.v, text: k.icon + ' ' + k.label + ' (' + n + ')', selected: k.v === S.kind });
      }));
      return el('div', { 'class': 'pcf-msel' }, [kSel, setPicker()]);
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
    /* 보기 칸 머리 (2026-10-07 화면 개편, 목업 승인) — 제목 · 원본 파일 · 원본 모양/글자 본문 · 📝 찾아서 채우기 · ⋯
       드물게 쓰는 것(수정·복제·삭제·바꿀 자리·올리기·계약 여러 건·rhwp)은 ⋯ 하나에 접는다 */
    function moreMenu(items) {
      var box = el('div', { 'class': 'pcf-menu', hidden: true, role: 'menu' });
      items.filter(Boolean).forEach(function (it) { box.appendChild(it.nodeType ? it : el('button', { type: 'button', role: 'menuitem', title: it.title || '', text: it.t,
        onclick: function () { box.hidden = true; it.fn(); } })); });
      var btn = el('button', { type: 'button', 'class': 'pcf-b pcf-more', 'aria-label': '더 보기', 'aria-haspopup': 'menu', text: '⋯', onclick: function (e) {
        e.stopPropagation(); box.hidden = !box.hidden;
        if (!box.hidden) setTimeout(function () { document.addEventListener('click', function off(ev) { if (!box.contains(ev.target)) { box.hidden = true; document.removeEventListener('click', off); } }); }, 0);
      } });
      return el('span', { 'class': 'pcf-morew' }, [btn, box]);
    }
    function toolbar(fm) {
      var kind = curKind(), k = kindInfo(kind);
      if (!fm) return el('div', { 'class': 'pcf-top' }, [el('b', { text: k.icon + ' ' + k.label + ' 양식' }), el('span', { 'class': 'pcf-strip', text: '목록에서 양식을 고르세요' })]);
      var strip = el('div', { 'class': 'pcf-strip' });
      var arcd = {};
      (fm.originals || []).forEach(function (o) { if (o.attId) arcd[o.attId] = 1; });
      (fm.attachments || []).forEach(function (a) {
        if (a.role === 'preview') return;   // 미리보기 PDF 는 보기 칸이 쓴다 — 받을 원본 줄에는 안 띄운다
        strip.appendChild(el('a', { 'class': 'pcf-att', href: a.data || a.dataUrl || '#', download: a.name || '첨부', title: (a.name || '첨부') + ' 받기',
          text: '📥 ' + (/\.xlsx$/i.test(a.name || '') ? '엑셀' : /\.(hwp|hwpx)$/i.test(a.name || '') ? '한글' : '파일') + (arcd[attKey(a)] ? ' ✓' : '') }));
      });
      if (!strip.childNodes.length) strip.appendChild(el('span', { text: '원본 파일 없음' }));
      var hasOrig = !!(previewPdfOf(fm) || (hwpOrigOf(fm) && w.PureunHwp));
      var view = hasOrig && S.paperView !== 'text' ? 'orig' : 'text';
      var hwpAtt = (fm.attachments || []).filter(function (a) { return /\.(hwp|hwpx)$/i.test(a.name || '') && (a.data || a.dataUrl); })[0];
      return el('div', { 'class': 'pcf-top' }, [
        el('b', { title: fm.name }, [el('span', { style: 'color:' + k.color, text: k.icon + ' ' }), fm.name]),
        strip,
        hasOrig ? el('span', { 'class': 'pcf-cgrp', role: 'group', 'aria-label': '보기' }, [
          chip('📄 원본 모양', view === 'orig', function () { S.paperView = 'orig'; drawBody(); }),
          chip('🔤 글자 본문', view === 'text', function () { S.paperView = 'text'; drawBody(); })]) : null,
        host.cards ? el('button', { type: 'button', 'class': 'pcf-act', style: 'background:#166534', title: 'ERP 업체관리와 기업정보함에서 회사·담당자·근로자를 찾아 채웁니다. 없는 값만 직접 입력합니다.', text: '📝 찾아서 채우기', onclick: function () { openFill([fm], host); } }) : null,
        moreMenu([
          { t: '✏ 수정', fn: function () { modal({ kind: fm.kind, cur: fm, onSave: save }); } },
          { t: '⧉ 복제', fn: function () { copy(fm); } },
          (host.hwpMark && hwpSources(fm).some(function (x) { return /\.(hwp|hwpx)$/i.test(x.name || ''); }))
            ? { t: '✏ 바꿀 자리 만들기', title: '원본 글자를 찾아 표시나 고친 글자로 바꿉니다. 이전 원본은 보관함에 남습니다.', fn: function () { openMark(fm); } } : null,
          hwpAtt ? { t: '🔍 한글 원본 크게 보기', fn: function () { openHwpPreview(hwpAtt, null); } } : null,
          { t: '🗑 삭제', fn: function () { del(fm); } }
        ].concat(toolItems(kind)))
      ]);
    }
    /* 드물게 쓰는 도구 — ⋯ 메뉴 아래쪽 */
    function toolItems(kind) {
      var upIn = el('input', { type: 'file', multiple: true, accept: '.hwpx,.hwp,.xlsx,.xls,.docx,.doc,.pdf', style: 'display:none',
        onchange: function (e) { quickUpload(kind, e.target.files); e.target.value = ''; } });
      return [el('hr'),
        { t: '📎 파일 올려 양식 만들기', title: 'HWPX · HWP · XLSX · DOCX · DOC · PDF — 올리면 원본 보관함에 사본이 남습니다', fn: function () { upIn.click(); } }, upIn,
        host.contractList ? { t: '📦 계약 여러 건 채우기', title: '이알피 계약 여러 건을 골라 계약마다 서류 묶음을 .zip 하나로', fn: openContracts } : null,
        { t: 'rhwp v' + rhwpVer() + ' 새 판 확인', fn: rhwpUpdatePrompt },
        kind === 'case' ? { t: '📥 체당금 기본 양식 다시 넣기', fn: reseedChedang } : null];
    }
    /* ── 원본 모양 (대표 /goal 2026-10-07 「글자크기·모양·줄간 서식 등 모든 형태가 제대로」) ──
       가운데 종이는 본문 글자판(pre)만 보여 줬다 — 원본이 있어도 상자 글자(┌─┐)로 그린 «흉내»였고,
       진짜 모양은 🔍 창에서만 보였다. 이제 원본이 있으면 종이에 원본을 그대로 그린다:
         한글(hwp·hwpx) → rhwp (한글 2022 와 쪽수까지 같음 — 양식 19개로 견줌)
         엑셀 → 엑셀이 직접 만든 「미리보기 PDF」(첨부 role:'preview', pdf.js) — 엑셀은 rhwp 가 못 그린다
       「글자 본문」 칩으로 표지({{…}}) 확인용 글자판을 볼 수 있다. */
    function previewPdfOf(fm) {
      /* 미리보기 PDF 는 크다(엑셀이 글꼴을 품는다 — 70~800KB) — 양식 목록에 박지 않고 원본 보관함(fileId)에 두고 열 때 받는다 */
      return ((fm && fm.attachments) || []).filter(function (a) { return a && a.role === 'preview' && /\.pdf$/i.test(a.name || '') && (a.data || a.dataUrl || a.fileId); })[0] || null;
    }
    function hwpOrigOf(fm) { return hwpSources(fm || {}).filter(function (x) { return /\.(hwp|hwpx)$/i.test(x.name || ''); })[0] || null; }
    function srcBytes(src) {
      if (src.data) return Promise.resolve(bytesOfDataUrl(src.data));
      return host.hwpBytes ? host.hwpBytes(src) : Promise.reject(new Error('원본을 불러올 길이 없습니다'));
    }
    function renderPdfPages(box, u8) {
      return new Promise(function (res, rej) {
        _ensurePdfjs2(function (err) {
          if (err) { rej(new Error(err)); return; }
          w.pdfjsLib.getDocument({ data: u8 }).promise.then(function (pdf) {
            var chain = Promise.resolve();
            for (var i = 1; i <= pdf.numPages; i++) (function (n) {
              chain = chain.then(function () {
                return pdf.getPage(n).then(function (pg) {
                  var vp0 = pg.getViewport({ scale: 1 }), cw = Math.max(280, Math.min((box.clientWidth || 820) - 8, 820));
                  var dpr = Math.min(2, w.devicePixelRatio || 1), vp = pg.getViewport({ scale: cw / vp0.width * dpr });
                  var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
                  c.style.cssText = 'display:block;background:#fff;margin:0 auto 14px;box-shadow:0 2px 8px rgba(0,0,0,.2);max-width:100%;width:' + Math.round(cw) + 'px';
                  box.appendChild(c);
                  return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
                });
              });
            })(i);
            return chain.then(function () { res({ pageCount: pdf.numPages }); });
          }, rej);
        });
      });
    }
    function drawOrig(box, fm) {
      var pdf = previewPdfOf(fm), src = pdf ? null : hwpOrigOf(fm), want = fm.id;
      box.innerHTML = ''; box.appendChild(el('div', { 'class': 'pcf-muted', text: '원본 모양을 그리는 중…' }));
      var go = pdf ? srcBytes({ name: pdf.name, data: pdf.data || pdf.dataUrl, fileId: pdf.fileId })
          .then(function (u8) { if (S.sel !== want) return; box.innerHTML = ''; return renderPdfPages(box, u8); })
        : srcBytes(src).then(function (u8) { if (S.sel !== want) return; box.innerHTML = ''; return w.PureunHwp.renderPreview(box, u8, src.name); });
      go.catch(function (e) {
        if (S.sel !== want) return;
        box.innerHTML = '';
        box.appendChild(el('div', { 'class': 'pcf-muted', text: '원본 모양을 그리지 못했습니다(' + ((e && e.message) || e) + ') — 「글자 본문」을 누르면 글자판으로 봅니다' }));
      });
    }
    function paper(fm) {
      var hasOrig = !!(previewPdfOf(fm) || (hwpOrigOf(fm) && w.PureunHwp));
      var view = hasOrig && S.paperView !== 'text' ? 'orig' : 'text';
      var sheet = el('div', { 'class': 'pcf-sheet' + (view === 'orig' ? ' orig' : '') });
      if (fm.enabled === false) sheet.appendChild(el('div', { 'class': 'pcf-offband', text: '사용 안 함 — 계약서 출력 때 고를 수 없습니다' }));
      if (view === 'orig') {
        var ob = el('div', { 'class': 'pcf-orig' });
        sheet.appendChild(ob);
        setTimeout(function () { if (ob.isConnected) drawOrig(ob, fm); }, 0);   // 붙은 뒤에 그려야 너비를 안다
        return el('div', { 'class': 'pcf-sheetwrap' }, [sheet]);
      }
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
    /* 목록 칸 머리 (2026-10-07 화면 개편) — 찾기 · 묶음/측/사건유형 칩 · 목록/카드. 세트는 왼쪽 나무로 갔다(휴대폰은 위 고르기 칸) */
    function listHead() {
      var kind = S.kind, row = [];
      if (host.contractCtx) row.push(chip('📄 ' + host.contractCtx.label + ' 자료로 채움 ✕', true, function () { host.contractCtx = null; drawMain(); toast('계약 자료를 풀었습니다 — 이제 기업정보함 값만으로 채웁니다'); }));
      var q = el('input', { type: 'search', 'class': 'pcf-q', placeholder: '양식 찾기', 'aria-label': '양식 이름 찾기', value: S.q });
      /* 글자를 칠 때마다 목록만 다시 그린다 — 머리까지 그리면 찾기 칸 커서가 사라진다 */
      q.addEventListener('input', function () { S.q = q.value; drawList(); });
      if (kind === 'case') {
        var fc = facetCounts(S.forms, 'case', S.side);
        row.push(el('span', { 'class': 'pcf-cgrp', role: 'group', 'aria-label': '측' },
          [chip('전체 ' + fc.sides.all, S.side === 'all', function () { setFilter({ side: 'all', grp: 'all' }); })].concat(SIDES.map(function (sd) {
            return chip(sd.label + ' ' + fc.sides[sd.v], S.side === sd.v, function () { setFilter({ side: sd.v, grp: 'all' }); });
          }))));
        row.push(el('span', { 'class': 'pcf-cgrp', role: 'group', 'aria-label': '사건유형' },
          [chip('모든 유형', S.grp === 'all', function () { setFilter({ grp: 'all' }); })].concat(fc.groups.map(function (g) {
            return chip(g.name + ' ' + g.count, S.grp === g.name, function () { setFilter({ grp: g.name }); });
          }))));
      }
      if (twoGroups(kind)) {
        var ff = facetCounts(S.forms, kind);
        row.push(el('span', { 'class': 'pcf-cgrp', role: 'group', 'aria-label': '묶음' },
          [chip('전체 ' + ff.sides.all, S.grp === 'all', function () { setFilter({ grp: 'all' }); })].concat(ff.groups.map(function (g) {
            return chip(g.name.replace('제안서·견적서', '견적') + ' ' + g.count, S.grp === g.name, function () { setFilter({ grp: g.name }); });
          }))));
      }
      return el('div', { 'class': 'pcf-lh' }, [
        el('div', { 'class': 'pcf-lhr' }, [q, el('span', { 'class': 'pcf-cgrp', role: 'group', 'aria-label': '보기' }, [
          chip('☰', S.view === 'list', function () { S.view = 'list'; saveView(); drawMain(); }),
          chip('▦', S.view === 'card', function () { S.view = 'card'; saveView(); drawMain(); })])]),
        row.length ? el('div', { 'class': 'pcf-crow' }, row) : null]);
    }
    /* ── 묶음 채우기 (설계 2026-09-28 §2-2) — 체크(2-A) · 세트(2-B) · 아래 막대 ── */
    function checkedForms() {
      return S.checked.map(function (id) { return S.forms.filter(function (f) { return f.id === id; })[0]; }).filter(Boolean);
    }
    function toggleCheck(id, on) {
      var at = S.checked.indexOf(id);
      if (on && at < 0) S.checked.push(id);
      if (!on && at >= 0) S.checked.splice(at, 1);
      S.setId = null;   // 세트에서 하나라도 빼거나 더하면 «그 세트»가 아니다
      drawBar();
    }
    function setById(id) { return S.sets.filter(function (s) { return s.id === id; })[0] || null; }
    function applySet(id) {
      var st = setById(id); if (!st) return;
      var have = {}; S.forms.forEach(function (f) { have[f.id] = 1; });
      S.checked = (st.formIds || []).filter(function (x) { return have[x]; });
      S.setId = st.id;
      if (!S.checked.length) { toast('이 세트의 양식이 모두 지워졌습니다'); drawMain(); return; }
      if (S.checked.length < (st.formIds || []).length) toast('세트 양식 ' + ((st.formIds || []).length - S.checked.length) + '개는 지워져 뺐습니다');
      var first = S.forms.filter(function (f) { return f.id === S.checked[0]; })[0];
      if (first && (first.kind !== S.kind || shown().indexOf(first) < 0)) select(first.id); else drawMain();
    }
    function saveAsSet() {
      var ids = checkedForms().map(function (f) { return f.id; }); if (!ids.length) return;   // 그사이 지워진 양식은 넣지 않는다
      var name = w.prompt('세트 이름 (예: 부당해고 구제 세트)', '');
      if (name == null) return;
      name = String(name).trim().slice(0, 40);
      if (!name) { toast('세트 이름을 넣어 주세요'); return; }
      var fs0 = S.forms.filter(function (f) { return f.id === ids[0]; })[0] || {};
      var ns = { id: newId('fs-'), name: name, formIds: ids, kind: fs0.kind || S.kind, at: Date.now() };
      track(changeSets(db, function (doc) { doc.v.push(ns); return doc; })).then(function (list) {
        S.sets = list; S.setId = ns.id; drawMain(); toast('세트를 저장했습니다 — ' + name);
      }, function (e) { toast('⚠ 세트를 저장하지 못했습니다 — ' + ((e && e.message) || e)); });
    }
    /* 이름 바꾸기·지우기. 기본 세트를 지우면 rm 에 남긴다(안 남기면 다음에 도로 생긴다) */
    function editSet(id, rename) {
      var st = setById(id); if (!st) return;
      var name = null;
      if (rename) {
        name = w.prompt('새 세트 이름', st.name || '');
        if (name == null) return;
        name = String(name).trim().slice(0, 40);
        if (!name) { toast('세트 이름을 넣어 주세요'); return; }
      } else if (!w.confirm('"' + st.name + '" 세트를 지울까요?\n(양식은 지워지지 않습니다)')) return;
      var gone = false;
      track(changeSets(db, function (doc) {
        var at = -1;
        gone = false;
        doc.v.forEach(function (s, i) { if (s && s.id === id) at = i; });
        if (rename) {
          if (at >= 0) doc.v[at].name = name;
          /* 기본 세트를 처음 고치면 저장본에 옮겨 담는다 — 단, 그사이 누가 지웠으면 되살리지 않는다 */
          else if (isSeedSet(id) && doc.rm.indexOf(id) < 0) { var cp = JSON.parse(JSON.stringify(st)); cp.name = name; doc.v.push(cp); }
          else gone = true;
        } else {
          if (at >= 0) doc.v.splice(at, 1);
          if (isSeedSet(id) && doc.rm.indexOf(id) < 0) doc.rm.push(id);
        }
        return doc;
      })).then(function (list) {
        S.sets = list; if (!rename && S.setId === id) S.setId = null; drawMain();
        toast(gone ? '이미 지워진 세트입니다' : rename ? '이름을 바꿨습니다' : '세트를 지웠습니다');
      }, function (e) { toast('⚠ 저장하지 못했습니다 — ' + ((e && e.message) || e)); });
    }
    function setPicker() {
      var sel = el('select', { 'class': 'pcf-set', 'aria-label': '묶음 세트', onchange: function () {
        var v = sel.value; sel.value = '';
        if (v.indexOf('ren:') === 0) editSet(v.slice(4), true);
        else if (v.indexOf('del:') === 0) editSet(v.slice(4), false);
        else if (v) applySet(v);
      } }, [el('option', { value: '', text: '📚 세트' })]
        .concat(S.sets.map(function (s) { return el('option', { value: s.id, text: s.name + ' (' + (s.formIds || []).length + ')' }); }))
        .concat(S.sets.length ? [el('option', { value: '', disabled: true, text: '──────' })] : [])
        .concat(S.sets.map(function (s) { return el('option', { value: 'ren:' + s.id, text: '✏ 이름 바꾸기 — ' + s.name }); }))
        .concat(S.sets.map(function (s) { return el('option', { value: 'del:' + s.id, text: '🗑 지우기 — ' + s.name }); })));
      return sel;
    }
    /* 아래 막대 — 하나라도 고르면 뜬다. 막대만 다시 그린다(목록 스크롤이 튀지 않게) */
    function bundleBar() {
      S.barEl = el('div', { 'class': 'pcf-bbar', hidden: true, role: 'region', 'aria-label': '묶음' });
      drawBar();
      return S.barEl;
    }
    function drawBar() {
      var b = S.barEl; if (!b) return;
      var fms = checkedForms();
      b.innerHTML = '';
      b.hidden = !fms.length;
      if (!fms.length) { fitHeight(); return; }
      var st = S.setId ? setById(S.setId) : null;
      b.appendChild(el('b', { text: (st ? '📚 ' + st.name + ' · ' : '☑ ') + fms.length + '개 골랐습니다' }));
      b.appendChild(el('span', { 'class': 'pcf-bnames', title: fms.map(function (f) { return f.name; }).join(', '), text: fms.map(function (f) { return f.name; }).join(' · ') }));
      if (!st) b.appendChild(el('button', { type: 'button', 'class': 'pcf-b', text: '세트로 저장', onclick: saveAsSet }));
      else { b.appendChild(el('button', { type: 'button', 'class': 'pcf-b', text: '✏ 세트 이름', onclick: function () { editSet(st.id, true); } }));
        b.appendChild(el('button', { type: 'button', 'class': 'pcf-b', text: '🗑 세트 지우기', onclick: function () { editSet(st.id, false); } })); }
      b.appendChild(el('button', { type: 'button', 'class': 'pcf-b', text: '선택 풀기', onclick: function () { S.checked = []; S.setId = null; drawMain(); } }));
      if (host.cards) b.appendChild(el('button', { type: 'button', 'class': 'pcf-act', style: 'background:#1e40af', text: '📦 ' + fms.length + '개 채워서 받기',
        onclick: function () { openFill(checkedForms(), host, st ? st.name : (host.contractCtx ? host.contractCtx.label : '고른 양식')); } }));
      fitHeight();
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
        /* 체크 칸은 줄 단추 «밖»에 둔다 — 안에 두면 체크할 때마다 그 양식이 골라진다 */
        var ck = el('input', { type: 'checkbox', 'aria-label': f.name + ' 묶음에 넣기', title: '묶음에 넣기' });
        ck.checked = S.checked.indexOf(f.id) >= 0;
        ck.addEventListener('change', function () { toggleCheck(f.id, ck.checked); });
        col.appendChild(el('div', { 'class': 'pcf-lr' }, [ck,
          el('button', { type: 'button', 'class': 'pcf-li' + (on ? ' on' : '') + (f.enabled === false ? ' off' : ''),
            title: f.name + (f.enabled === false ? ' (사용 안 함)' : ''), 'aria-current': on ? 'true' : null, onclick: function () { select(f.id); } }, [
            el('span', { 'class': 'pcf-ln', text: f.name }),
            sd && S.side === 'all' ? el('span', { 'class': 'pcf-sd ' + sd, text: sideShort(sd) }) : null])]));
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
    /* 세 칸 (2026-10-07 화면 개편, 목업 승인) — [목록 칸: 머리·목록] [보기 칸: 머리·원본]. 보기 칸이 오른쪽 전체를 쓴다 */
    function drawBody() {
      var box = S.bodyEl; if (!box) return;
      box.innerHTML = '';
      var fm = cur();
      S.listEl = el('div', { 'class': 'pcf-lbody' });
      var lp = el('div', { 'class': 'pcf-lp' }, [listHead(), S.listEl]);
      if (S.view === 'card') box.appendChild(el('div', { 'class': 'pcf-cols card' }, [lp]));
      else box.appendChild(el('div', { 'class': 'pcf-cols' }, [lp, el('div', { 'class': 'pcf-vp' }, [toolbar(fm),
        fm ? paper(fm) : el('div', { 'class': 'pcf-sheetwrap' }, [el('div', { 'class': 'pcf-none', text: '목록에서 양식을 고르세요' })])])]));
      drawList();
      fitHeight();
    }
    function drawList() {
      var b = S.listEl; if (!b) return;
      b.innerHTML = '';
      var list = shown();
      b.appendChild(S.view === 'card' ? cardGrid(list) : listCol(list));
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
      wrap.appendChild(bundleBar());
      drawTree();   // 세트가 나중에 오거나 바뀌면 왼쪽 나무도 다시
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
    CASE_TYPES: CASE_TYPES, FUND_GROUPS: FUND_GROUPS, TWO_GROUP_KINDS: TWO_GROUP_KINDS, MAKE_KINDS: MAKE_KINDS, makePlan: makePlan, contractFolder: contractFolder, contractValues: contractValues, fillFormOnce: fillFormOnce, contractPick: contractPick, CONTRACT_SETS: CONTRACT_SETS, CASE_CODES: CASE_CODES, CONTRACT_WINS: CONTRACT_WINS, PROPOSAL_GROUP: PROPOSAL_GROUP,
    SIDES: SIDES,
    sideOf: sideOf,
    filterForms: filterForms,
    facetCounts: facetCounts,
    setsOf: setsOf,
    changeSets: changeSets,
    bundleMarkers: bundleMarkers,
    bundleFileNames: bundleFileNames,
    zipName: zipName,
    splitVars: splitVars,
    attKey: attKey, withNewOriginal: withNewOriginal, orphanInline: orphanInline,
    loadForms: loadForms,
    linkOriginal: linkOriginal,
    ATTACH_MAX: ATTACH_MAX,
    hwpSources: hwpSources,
    openFill: openFill,
    mount: mount
  };
})(window);
