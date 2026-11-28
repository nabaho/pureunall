'use strict';
/* 푸른 지식백과(pu-wiki.html) — 3층 검증형 사내위키 순수 엔진 (브라우저 window.PuWiki / Node 겸용)
 *
 * 3층 정보 분리·교차검증 원칙 (2026-11-28):
 *   1층 [사내 실무 지식] : 옵시디언 사내배포 문서(내 PC 경로·실명·주민번호 2중 비식별 정화본) 및 노무사 작성 가이드
 *   2층 [법적 근거 원문] : P박스(PuPBoxCorpus·PuPBoxLawIndex·PuPBoxEngine) 및 국가법령정보센터(law.go.kr) 공식 법령·판례 직결
 *   3층 [외부 배경지식]  : 한국어 위키백과(ko.wikipedia.org 공식 REST API) — 본문과 엄격히 분리된 «법적 근거 아님» 참고 상자 전용,
 *                         고객사·근로자 개인정보가 섞인 검색어는 외부 전송 전 원천 차단(sanitizeWikiSearchQuery)
 *   교차검증 워크플로   : 재직 직원·노무사 [검토 확인(verify)] 실명(사번 연결) 서명 + [오류·법개정 신고(flag)] 즉시 경고 배지
 *
 * 온톨로지·보안 불변식:
 *   · 저장 자리: puwiki/articles/{id} (WikiArticle), puwiki/reviews/{articleId}/{id} (WikiReview)
 *   · 사람 관계 열쇠는 오직 영구 사번(actorSid / resolvedBySid)만 저장하고 이름은 화면에서 data/user_dir 로 풀어 그린다.
 *   · 물리 삭제 금지 — 공용 관문(PuOntologyWrite enforce) tombstone(_deleted: true)만 쓴다.
 *   · 외부 주소는 http(s) 만 허용(safeUrl), 위키백과 응답 주소는 ko.wikipedia.org 만 허용한다.
 */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var Corpus = null, LawIdx = null, Engine = null, RrnMask = null;
  if (isNode) {
    try { Corpus = require('./pu-pbox-corpus.js'); } catch (e) {}
    try { require('./pu-pbox-lawindex.js'); LawIdx = globalThis.PuPBoxLawIndex || null; } catch (e) {}
    try { Engine = require('./pu-pbox-engine.js'); } catch (e) {}
    try { RrnMask = require('./pu-rrn-mask.js'); } catch (e) {}
  } else if (root) {
    Corpus = root.PuPBoxCorpus || null;
    LawIdx = root.PuPBoxLawIndex || null;
    Engine = root.PuPBoxEngine || null;
    RrnMask = root.PuRrnMask || null;
  }

  var ROOT = 'puwiki';
  var ARTICLES = 'articles';
  var REVIEWS = 'reviews';
  var ENTITY_ARTICLE = 'WikiArticle';
  var ENTITY_REVIEW = 'WikiReview';

  var LIMIT = {
    title: 120,
    category: 40,
    summary: 300,
    body: 12000,
    obsidianNote: 160,
    lawCite: 100,
    laws: 25,
    wikiTopic: 60,
    wikiTopics: 8,
    apps: 10,
    note: 800,
    checkedLawNote: 200,
    resolutionNote: 400,
    url: 600
  };

  var ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
  var SID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  function badKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }
  function own(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function cut(v, n) { return str(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').slice(0, n).trim(); }
  function rows(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.keys(v).filter(function (k) { return !badKey(k); }).map(function (k) { return v[k]; });
    return [];
  }
  function okId(c) { return typeof c === 'string' && ID_RE.test(c) && !badKey(c); }
  function okSid(c) { return typeof c === 'string' && SID_RE.test(c) && !badKey(c); }

  var CATEGORIES = [
    '임금·퇴직·체불',
    '해고·징계·노동위',
    '괴롭힘·성희롱 조사',
    '자문·취업규칙·근로시간',
    '산재·산업안전',
    '정부지원 컨설팅',
    '사내·공동기금',
    '노사관계·단체교섭',
    '일반 노무실무'
  ];

  /* 사내 포털에서 바로 건너갈 허용 앱 목록 (enter.html APPS key 와 1:1) */
  var INNER = {
    pbox: { name: 'P박스(법령·판례원문)', icon: '📚', url: 'pu-pbox.html' },
    erp: { name: '푸른이알피', icon: '🏢', url: 'pu-erp.html' },
    consult: { name: '정부사업일정', icon: '📅', url: 'gov-consulting.html' },
    govreport: { name: '컨설팅보고서', icon: '📑', url: 'gov-report.html' },
    govlinks: { name: '정부사업 바로가기', icon: '🔗', url: 'gov-links.html' },
    govaid: { name: '기업정부지원금', icon: '🎯', url: 'pu-govaid.html' },
    harass: { name: '괴롭힘·성희롱 조사', icon: '🛡️', url: 'pu-harass.html' },
    ilteo: { name: '일터상생혁신', icon: '🏭', url: 'ilteo.html' },
    jobtrans: { name: '산업일자리전환', icon: '⚡', url: 'jobtrans.html' },
    safety: { name: '안전보건체계구축', icon: '🦺', url: 'safety.html' },
    techprotect: { name: '기술보호컨설팅', icon: '🔐', url: 'techprotect.html' },
    clinic: { name: '현장클리닉', icon: '🩺', url: 'clinic.html' },
    chamber: { name: '상공회의소컨설팅', icon: '🏬', url: 'chamber.html' },
    hrconsult: { name: '기초인사노무', icon: '🗂️', url: 'hrconsult.html' },
    evalcomp: { name: '평가보상·임금체계', icon: '📈', url: 'evalcomp.html' },
    pubconsult: { name: '공공기관컨설팅', icon: '🏤', url: 'pubconsult.html' },
    familywork: { name: '출산육아·유연근무', icon: '🏡', url: 'familywork.html' },
    socialent: { name: '사회적기업·씨앗', icon: '🌱', url: 'socialent.html' },
    sixthind: { name: '6차산업컨설팅', icon: '🌾', url: 'sixthind.html' },
    laboraudit: { name: '근로감독 대응·이력', icon: '🧭', url: 'laboraudit.html' },
    unionneg: { name: '민간노조·단체교섭', icon: '🫂', url: 'unionneg.html' },
    specialcons: { name: '특화·위탁컨설팅', icon: '🧩', url: 'specialcons.html' },
    fund: { name: '기금관리', icon: '🪙', url: 'fund.html' },
    rules: { name: '기업규정집', icon: '📜', url: 'rules-v2.html' },
    docs: { name: '계약서등관리', icon: '📤', url: 'docs-esign.html' },
    edulib: { name: '강의자료', icon: '🎓', url: 'pu-edulib.html' },
    aliounion: { name: '공공임단협', icon: '🤝', url: 'pu-alio-union.html' },
    payroll: { name: '급여아웃소싱', icon: '💰', url: 'payroll-os.html' },
    coach: { name: '실무코치·RAG학습', icon: '🧠', url: 'pu-coach.html' }
  };

  /* 기본 수록 8대 비식별 표준 실무 문서 (옵시디언 사내배포_지식백과/*.md 와 동일 본문 — 고객사·실명·로컬경로 0건) */
  var DEFAULTS = [
    {
      id: 'pw-wage-ordinary', order: 10,
      title: '통상임금·포괄임금 산정 및 임금체불·대지급금 실무 기준',
      category: '임금·퇴직·체불',
      summary: '정기성·일률성·통상임금 소정근로 대가성 판단, 포괄임금 유효 요건, 금품청산 14일 원칙 및 간이·도산대지급금 청구 체크리스트',
      laws: ['근로기준법 제2조', '근로기준법 제36조', '근로기준법 제43조', '근로기준법 제56조', '임금채권보장법 제7조', '근로자퇴직급여 보장법 제8조'],
      wikiTopics: ['임금', '최저임금', '퇴직금'],
      apps: ['erp', 'payroll', 'pbox', 'docs'],
      obsidianNote: '사내배포_지식백과/01_통상임금_포괄임금_임금체불_대지급금_실무기준.md',
      body: '## 1. 통상임금 해당성 판단 핵심\n- **법적 정의**: 소정근로의 대가로서 정기적·일률적으로 지급하기로 정한 시급·일급·주급·월급 또는 도급 금액(근로기준법 시행령 제6조).\n- **판례 동향 점검**: 재직조건이나 기준기간 내 특정 일수 이상 근무조건이 부가된 정기상여금의 소정근로 대가성 인정 여부를 최신 대법원 전원합의체 법리와 대조하여 시급 산정 기초에 반영한다.\n- **산정검산 순서**: ① 임금항목 전수 분류(기본급·직책수당·자격수당·식대·상여금) → ② 소정근로시간(주휴 포함 월 환산시간 209시간 등) 확정 → ③ 연장·야간·휴일 가산수당(근로기준법 제56조) 차액 역산.\n\n## 2. 포괄임금 약정의 유효성 한계\n- 근로시간 산정이 어려운 업무가 아님에도 연장·야간·휴일근로수당을 정액으로 묶어 둔 약정은, 법정 기준에 따라 산정한 수당액에 미달하는 부분만큼 무효가 되며 사용자는 그 차액을 지급해야 한다.\n- 감시·단속적 근로자 승인(근로기준법 제63조) 여부와 고정OT 시간수 명시 여부를 근로계약서·급여명세서와 교차 확인한다.\n\n## 3. 임금체불 진정 및 대지급금(구 체당금) 절차\n- **금품청산 기한**: 퇴직일(또는 지급사유 발생일)로부터 14일 이내 전액 지급 원칙(근로기준법 제36조, 당사자 합의 시 기일 연장 가능).\n- **간이대지급금(재직자·퇴직자)**: 체불 임금등·사업주 확인서 발급 후 확정판결 또는 지방고용노동관서 확인을 거쳐 근로복지공단에 청구(임금채권보장법 제7조).\n- **도산대지급금**: 법원 회생·파산 결정 또는 지방노동관서 사실상 도산인정 신청 요건(상시근로자수·사업기간·사업활동 정지 상태) 충족 여부를 먼저 검토한다.'
    },
    {
      id: 'pw-dismissal-nlrc', order: 20,
      title: '징계·부당해고·부당전보 판단 법리 및 노동위원회 구제신청 절차',
      category: '해고·징계·노동위',
      summary: '근로기준법 제23조 정당한 이유 3단계(사유·양정·절차), 해고 서면통지 요건, 전보·대기발령 정당성 비교형량 및 제척기간 3개월 실무 점검',
      laws: ['근로기준법 제23조', '근로기준법 제26조', '근로기준법 제27조', '근로기준법 제28조', '근로기준법 제30조', '노동위원회법 제15조'],
      wikiTopics: ['중앙노동위원회', '해고'],
      apps: ['erp', 'docs', 'pbox'],
      obsidianNote: '사내배포_지식백과/02_징계_부당해고_부당전보_노동위원회_구제신청_절차.md',
      body: '## 1. 해고·징계의 정당성 3단계 심사 구조\n- **징계사유의 정당성**: 취업규칙·근로계약상 징계사유 해당 여부 및 객관적 입증자료(인사기록, 시말서, 메일·메신저 기록, 감사보고서) 확보 여부.\n- **징계양정의 적정성**: 비위행위의 정도·고의성·과거 전력·타 근로자 형평성에 비추어 사회통념상 고용관계를 계속할 수 없을 정도인지 판단.\n- **징계절차의 적법성**: 인사위원회 개최 통보 기한 준수, 소명기회 실질 부여, 재심절차 이행, **해고사유와 해고시기의 서면통지(근로기준법 제27조)** 준수 여부(이메일·문자 통지는 원칙적으로 무효이나 예외 요건 엄격 심사).\n\n## 2. 인사명령(전보·전직·대기발령) 정당성 판단\n- 업무상 필요성과 근로자가 입게 될 생활상 불이익을 비교·교량하고, 신의칙상 요구되는 협의절차를 거쳤는지 종합 검토한다.\n- 대기발령이 장기간 지속되어 실질적 징계·배제 수단으로 변질된 경우 부당 대기발령 성립 가능성을 점검한다.\n\n## 3. 지방노동위원회 구제신청 진행 체크리스트\n- **상시근로자 5인 이상 확인**: 사건 발생일 전 1개월간 가동일수별 연인원 산정(근로기준법 시행령 제7조의2).\n- **제척기간**: 부당해고 등이 있었던 날부터 **3개월 이내** 관할 지방노동위원회 접수(근로기준법 제28조 제2항).\n- **금전보상명령 신청**: 원직복직을 원하지 않는 근로자 대리 시 심문회의 개최 통보 전 금전보상명령 신청서 및 임금상당액 산출내역서를 구비한다(근로기준법 제30조 제3항).'
    },
    {
      id: 'pw-harass-invest', order: 30,
      title: '직장 내 괴롭힘·성희롱 객관조사 8단계 및 비밀유지·보호조치 실무',
      category: '괴롭힘·성희롱 조사',
      summary: '신고 접수 후 지체 없는 객관적 조사 의무, 피해근로자 분리·유급휴가 보호조치, 조사참여자 비밀누설 금지(과태료 제재) 및 최종 조사보고서 작성 기준',
      laws: ['근로기준법 제76조의2', '근로기준법 제76조의3', '근로기준법 제116조', '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률 제12조', '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률 제14조'],
      wikiTopics: ['직장 내 괴롭힘', '성희롱'],
      apps: ['harass', 'edulib', 'pbox'],
      obsidianNote: '사내배포_지식백과/03_직장내괴롭힘_성희롱_객관조사_비밀유지_보호조치_실무.md',
      body: '## 1. 직장 내 괴롭힘 3대 성립요건 검증\n- **지위 또는 관계 등의 우위 이용**: 직급·연령·정규직 여부·다수 집단·업무 숙련도 등 저항하기 어려운 관계성 확인.\n- **업무상 적정범위 초과**: 사회통념에 비추어 업무상 필요성이 인정되지 않거나, 필요성이 있더라도 행위 양태가 상당하지 않은 경우(폭언, 모욕, 집단 따돌림, 허드렛일 강요·업무 배제 등).\n- **신체적·정신적 고통 또는 근무환경 악화**: 행위자의 의도가 없더라도 피해자의 근무환경이 저해되었는지 객관적 정황·진료기록·동료 진술로 판단.\n\n## 2. 객관적 조사 8단계 표준 절차\n- ① 신고 접수 및 조사계획 수립(외부 전문 조사위원 위촉·이해충돌 배제)\n- ② 조사기간 중 피해근로자 등 보호조치(근무장소 변경·유급휴가 등, 피해자 의사에 반하는 조치 금지 — 근로기준법 제76조의3 제3항)\n- ③ 조사 참여자 전원 비밀유지 서약서 징구(근로기준법 제76조의3 제7항 비밀누설 금지)\n- ④ 신고인(피해 주장인) 대면 문답조사 및 진술조서 확인 서명\n- ⑤ 참고인 조사 및 객관적 물증(메신저·녹취록·업무지시 내역) 대조\n- ⑥ 피신고인(행위 지목인) 방어권·반론권 보장 문답조사(혐의사실 특정 고지)\n- ⑦ 요건별 사실인정 및 법리 검토 보고서 작성\n- ⑧ 사업주 후속조치(행위자 징계·근무장소 변경 시 피해자 의견 사전 청취 필수) 및 불이익 처우 예방 모니터링'
    },
    {
      id: 'pw-rules-contract', order: 40,
      title: '취업규칙 작성·불이익변경 동의 절차 및 근로계약서 필수 점검표',
      category: '자문·취업규칙·근로시간',
      summary: '상시 10인 이상 취업규칙 필수 기재사항, 불이익변경 시 근로자 과반수 집단적 회의방식 동의 요건, 서면 명시·교부 및 유연근로시간제 도입 요건',
      laws: ['근로기준법 제17조', '근로기준법 제50조', '근로기준법 제51조', '근로기준법 제53조', '근로기준법 제60조', '근로기준법 제93조', '근로기준법 제94조'],
      wikiTopics: ['취업규칙', '근로계약', '근로시간'],
      apps: ['rules', 'hrconsult', 'laboraudit', 'pbox'],
      obsidianNote: '사내배포_지식백과/04_취업규칙_불이익변경_동의절차_및_근로계약서_필수점검.md',
      body: '## 1. 근로계약서 서면 명시·교부 필수 항목 (근로기준법 제17조)\n- 임금의 구성항목·계산방법·지급방법, 소정근로시간, 제55조에 따른 휴일, 제60조에 따른 연차 유급휴가, 취업의 장소와 종사하여야 할 업무에 관한 사항.\n- **임금명세서 교부 의무(근로기준법 제48조 제2항)**: 임금 지급 시 구성항목·계산방법(연장·야간·휴일근로 시간수 포함)·공제내역을 적은 명세서를 서면 또는 전자문서로 교부해야 한다.\n- 기간제·단시간 근로자는 「기간제 및 단시간근로자 보호 등에 관한 법률」 제17조에 따라 근로계약기간, 근로일 및 근로일별 근로시간을 누락 없이 명시해야 과태료 처분을 예방한다.\n\n## 2. 취업규칙 불이익변경 적법 절차 (근로기준법 제94조 제1항 단서)\n- **동의 주체**: 근로자의 과반수로 조직된 노동조합이 있는 경우 그 노동조합, 없는 경우 **근로자 과반수의 집단적 의사결정 방법에 의한 동의**.\n- **회의방식 동의 실무 주의점**: 사용자의 개입이나 간섭이 배제된 상태에서 근로자 상호 간 의견을 교환하여 찬반을 집약한 뒤 과반수 찬성을 얻어야 하며, 단순 개별 회람 서명만으로는 효력이 부정될 위험이 높다.\n- **신구조문대비표 및 변경신고**: 개정 전·후 조문 대비표, 의견청취서(또는 동의서), 회의록을 첨부해 관할 지방고용노동관서에 신고한다.\n\n## 3. 근로시간·연차휴가 자문 핵심 포인트\n- 1주 연장근로 한도 12시간 준수 여부(근로기준법 제53조) 및 탄력적·선택적 근로시간제 도입 시 근로자대표 서면합의 요건(제51조·제52조) 점검.\n- 1년 미만 입사자 월 단위 연차(최대 11일)와 1년 출근율 80% 이상 연차(15일~25일), 적법한 연차유급휴가 사용촉진(제61조 2단계 서면 통보) 시기를 달력으로 검증한다.'
    },
    {
      id: 'pw-sanjae-safety', order: 50,
      title: '산재보상(뇌심혈관·근골격계·정신질병) 질판위 입증 및 안전보건체계 실무',
      category: '산재·산업안전',
      summary: '업무상 사고·출퇴근재해·업무상 질병(과로시간 산정·신체부담작업) 상당인과관계 입증 자료, 위험성평가 및 중대재해처벌법 안전보건확보의무 점검',
      laws: ['산업재해보상보험법 제37조', '산업재해보상보험법 제38조', '산업안전보건법 제36조', '산업안전보건법 제38조', '중대재해 처벌 등에 관한 법률 제4조'],
      wikiTopics: ['산업재해', '근로복지공단', '산업안전보건'],
      apps: ['erp', 'safety', 'pbox'],
      obsidianNote: '사내배포_지식백과/05_산재보상_업무상질병_질판위_및_중대재해_안전보건_실무.md',
      body: '## 1. 업무상 질병판정위원회(질판위) 핵심 입증 구조\n- **뇌혈관·심장질병**: 발병 전 24시간 이내 돌발적 사건·급격한 환경변화, 발병 전 1주일 이내 단기 과로(일상 업무 대비 30% 이상 증가), 발병 전 12주간 주당 평균 업무시간(주 52시간·60시간 기준 및 교대제·야간근무·유해환경 가중요인)을 교통카드·출입기록·PC 로그·메신저 시각으로 정밀 복원한다.\n- **근골격계 질병**: 담당 공정 동영상 촬영, 중량물 취급 무게·빈도, 부적절한 작업자세(어깨 위·허리 굴곡·반복동작) 근무기간 이력을 일관되게 정리한다.\n- **정신질병(적응장애·우울병 등)**: 직장 내 괴롭힘·고객 폭언·중대 사고 목격·과도한 직무 스트레스 요인과 개인 소인 외 업무기인성을 의학적 의무기록과 대조한다.\n\n## 2. 산업안전보건 및 중대재해 예방 컨설팅 체크리스트\n- **위험성평가(산업안전보건법 제36조)**: 유해·위험요인 파악 및 감소대책 수립·이행 과정에 현장 근로자를 실질적으로 참여시키고 평가 결과를 공유·보존한다.\n- **안전보건관리체계 구축(중대재해 처벌 등에 관한 법률 제4조)**: 경영책임자의 안전보건 목표·경영방침 설정, 전담 조직·예산 편성·집행, 반기 1회 이상 유해·위험요인 확인·개선 및 안전보건 관계법령 의무이행 점검표를 남긴다.'
    },
    {
      id: 'pw-gov-consulting', order: 60,
      title: '정부지원 컨설팅(일터혁신·산업일자리전환·기술보호·현장클리닉) 수행 및 증빙 표준',
      category: '정부지원 컨설팅',
      summary: '노사발전재단 일터혁신, 중진공·능률협회 산업일자리전환, 대중소협력재단 기술보호, 중기부 현장클리닉 회차별 수행일지·현장사진·이행관리 제출 기준',
      laws: ['고용정책 기본법 제29조', '중소기업기술 보호 지원에 관한 법률 제8조', '근로자참여 및 협력증진에 관한 법률 제4조'],
      wikiTopics: ['노사발전재단', '중소벤처기업진흥공단', '영업비밀'],
      apps: ['consult', 'govreport', 'govlinks', 'ilteo', 'jobtrans', 'techprotect', 'clinic'],
      obsidianNote: '사내배포_지식백과/06_정부지원컨설팅_일터혁신_산업일자리전환_기술보호_수행표준.md',
      body: '## 1. 정부지원 컨설팅 공통 수행 원칙 (부정수급·반려 원천 예방)\n- **실제 방문 일시·시간 정합성**: 컨설턴트 회차별 수행일지, 서명부, 현장 사진 메타데이터, 출장 증빙의 날짜·시간이 타 사업 일정과 중복되지 않는지 포털 「정부사업일정」 및 「푸른 캘린더」에서 사전 교차 확인한다.\n- **노사 참여 절차**: 제도 설계안(임금체계·평가제도·근로시간 개편 등)은 경영진 단독 인터뷰에 그치지 않고 근로자대표·노사협의회 의견수렴 회의록을 반드시 첨부한다.\n\n## 2. 주요 사업별 핵심 산출물 체크\n- **일터혁신 상생컨설팅(노사발전재단)**: 착수·수행계획서 → 회차별 수행일지(서명지·현장사진) → 중간보고서 → 최종보고서 및 노사합의 확인서 → 이행관리 점검.\n- **구조혁신·산업일자리전환(중진공·능률협회·충남경제진흥원)**: 사업전환·디지털전환에 따른 직무 재설계, 전환배치 교육훈련 계획, 고용안정 협약 및 MD별 수행일지 플랫폼 등록.\n- **통합 기술보호지원반(대·중소기업·농어업협력재단)**: 핵심기술·영업비밀 등급 분류, 임직원 입·퇴사 시 비밀유지서약서·경업금지 약정 적법성 검토, 보안관리규정 제·개정 및 기술보호울타리 완료보고.\n- **비즈니스지원단 현장클리닉(중소벤처기업부)**: 현장 애로사항 법률·인사노무 진단 및 실행 가능한 개선안(표준 근로계약·취업규칙 조항안) 상담일지 기한 내 등록.'
    },
    {
      id: 'pw-welfare-fund', order: 70,
      title: '사내·공동근로복지기금 설립·정관 변경·지원사업 신청 및 결산 실무',
      category: '사내·공동기금',
      summary: '근로복지기본법상 기금법인과 출연 모회사의 별개 법인격 원칙, 설립인가·등기, 기본재산·목적사업 한도, 공동기금 지원사업 및 연간 운영상황보고 실무',
      laws: ['근로복지기본법 제50조', '근로복지기본법 제52조', '근로복지기본법 제62조', '근로복지기본법 제86조의2'],
      wikiTopics: ['사내근로복지기금', '복리후생'],
      apps: ['fund', 'govaid', 'pbox'],
      obsidianNote: '사내배포_지식백과/07_사내_공동근로복지기금_설립_지원금신청_결산실무.md',
      body: '## 1. 기금법인의 독립성 및 지배구조 원칙\n- **별개 법인격**: 사내·공동근로복지기금법인은 출연하는 사업주(회사)와 법인격·회계가 엄격히 분리된 별개의 비영리법인이다(푸른 온톨로지에서도 관련회사 fundedBy 관계로 구분 관리).\n- **복지기금협의회 구성**: 근로자와 사용자를 대표하는 같은 수의 위원으로 구성하되(각 2명 이상 10명 이하, 공동기금은 참여 사업장별 노사 위원), 근로자위원은 근로자가 직접·비밀·무기명투표(또는 과반수 노조 추천)로 선출한다.\n\n## 2. 기금 재원 운용 및 목적사업 한도 (근로복지기본법 제62조)\n- **원칙(수익금 사용)**: 기금의 수익금으로 근로자 주택구입·임차 자금 지원, 장학금, 재난구호금, 체육·문화활동, 모성보호·보육비용 등 법정 복지사업을 수행한다.\n- **기본재산 사용 특례**: 당해 회계연도 출연금이 있으면 출연금의 일정 비율 범위에서 복지기금협의회가 정하는 바에 따라 기본재산을 목적사업에 사용할 수 있다(취약계층·협력업체 상생지원 특례 한도는 반드시 현행 근로복지기본법 시행령 원문 대조).\n- **임금 대체 금지**: 사용자가 법령 또는 단체협약·취업규칙에 따라 근로자에게 지급할 의무가 있는 임금·퇴직금 등을 기금 복지비로 대체 지급할 수 없다.\n\n## 3. 연간 결산 및 운영상황보고\n- 매 회계연도 종료 후 기금 결산서(재무상태표·운영성과표·부속명세서), 사업실적서 및 다음 연도 사업계획서·예산서를 작성하여 복지기금협의회 의결을 거친 뒤 관할 지방고용노동관서에 운영상황을 보고한다.'
    },
    {
      id: 'pw-union-bargaining', order: 80,
      title: '노동조합 설립·교섭창구 단일화·단체교섭 및 노동쟁의 조정 대응 매뉴얼',
      category: '노사관계·단체교섭',
      summary: '복수노조 교섭창구 단일화 일자별 공고·확정 일정, 공정대표의무·근로시간면제(타임오프) 한도, 성실교섭 의무 및 노동위원회 조정·부당노동행위 예방',
      laws: ['노동조합 및 노동관계조정법 제24조', '노동조합 및 노동관계조정법 제29조', '노동조합 및 노동관계조정법 제29조의2', '노동조합 및 노동관계조정법 제30조', '노동조합 및 노동관계조정법 제45조', '노동조합 및 노동관계조정법 제81조'],
      wikiTopics: ['단체교섭', '노동조합', '알리오'],
      apps: ['unionneg', 'aliounion', 'pubconsult', 'pbox'],
      obsidianNote: '사내배포_지식백과/08_노동조합_교섭창구단일화_단체교섭_노동쟁의조정_매뉴얼.md',
      body: '## 1. 복수노조 교섭창구 단일화 단계별 기한 (노조법 제29조의2·시행령)\n- ① **교섭요구 사실의 공고**: 노동조합으로부터 교섭을 요구받은 날부터 **7일간** 전 사업장 게시판 등에 공고(미공고·지연 시 노동조합의 노동위원회 시정 요청 대상).\n- ② **다른 노동조합의 교섭 참여 신청**: 위 7일 공고기간 내 신청.\n- ③ **교섭요구 노동조합 확정 공고**: 공고기간 만료 다음 날부터 **5일간** 확정 명단 공고.\n- ④ **자율적 단일화(14일) → 과반수 노조 통지·공고(5일) → 공동교섭대표단 구성**: 기한 계산(초일 불산입·말일 공휴일 연장 여부)을 달력으로 이중 검산한다(개별교섭 동의는 자율적 단일화 기한 내 사용자 동의 시에만 성립).\n\n## 2. 단체교섭 및 근로시간면제(타임오프) 유의사항\n- **근로시간면제 한도(노조법 제24조)**: 조합원 규모별 법정 시간·인원 한도를 초과하는 유급 전임 급여 지원은 부당노동행위(경비원조)에 해당할 수 있으므로 고용노동부 고시 한도를 확인한다.\n- **공정대표의무(노조법 제29조의4)**: 교섭대표노동조합과 사용자는 창구단일화 절차에 참여한 소수 노동조합 또는 그 조합원을 합리적 이유 없이 차별해서는 안 된다(노조사무실·게시판·고충처리 등).\n\n## 3. 노동쟁의 조정 및 부당노동행위 예방 (노조법 제45조·제81조)\n- 조정전치주의에 따른 지방노동위원회 조정신청(일반사업 10일, 공익사업 15일) 경과 여부와 쟁의행위의 주체·목적·절차(조합원 직접·비밀·무기명투표 과반수 찬성)·수단의 정당성을 점검한다.\n- 교섭 기간 중 사용자의 언론·사내 담화문 발표 시 지배·개입(제81조 제1항 제4호) 또는 불이익취급 소지가 없도록 사실 전달 범위 내에서 사전 법률 검토를 거친다.'
    }
  ];

  /* 주소 검증 — http(s) 만 허용, 아이디·비밀번호·스크립트 차단 */
  function safeUrl(v) {
    var s = str(v);
    if (!s || s.length > LIMIT.url || /[\s\u0000-\u001f\u007f<>"'`\\]/.test(s)) return '';
    if (!/^https?:\/\//i.test(s)) return '';
    try {
      var u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      if (!u.hostname || u.username || u.password) return '';
    } catch (e) { return ''; }
    return s;
  }

  /* ── 개인정보·로컬경로 정화기 (뒤돌아보기 lookbehind 미사용 — 구형 아이폰 사파리 호환) ── */
  function hasRawRrn(text) {
    var s = String(text == null ? '' : text);
    if (/(^|[^0-9])\d{6}\s*[-–—]\s*\d{7}(?![0-9])/.test(s)) return true;
    if (/(^|[^0-9])\d{13}(?![0-9])/.test(s)) return true;
    return false;
  }

  function scrubTextForWiki(rawText) {
    var t = String(rawText == null ? '' : rawText).replace(/\r\n/g, '\n');
    var maskedCount = 0;

    /* 1) 옵시디언 로컬 폴더 트리 주석 구간 제거 */
    var deepAt = t.indexOf('<!-- deep-folder-links:start -->');
    if (deepAt >= 0) {
      t = t.slice(0, deepAt).trim();
      maskedCount++;
    }

    /* 2) file:/// 및 윈도우 드라이브 경로(C:\, D:\ 등) 제거 */
    t = t.replace(/\[([^\]]*📂[^\]]*|열기|PDF 열기)\]\((?:file:\/\/\/|\.\.\/)[^)]+\)/g, function () { maskedCount++; return ''; });
    t = t.replace(/\[([^\]]+)\]\((?:file:\/\/\/|\.\.\/)[^)]+\)/g, function (_, label) { maskedCount++; return label; });
    t = t.replace(/file:\/\/\/[^\s)>\]]+/gi, function () { maskedCount++; return '[로컬경로제거]'; });
    t = t.replace(/[A-Za-z]:\\[^\s|)>\]"`']+/g, function () { maskedCount++; return '[내PC경로제거]'; });

    /* 3) 주민번호 원문 감지(저장 차단용) 후 주민번호·카드·사업자번호·전화·이메일 가림 */
    var preRrn = hasRawRrn(t);
    t = t.replace(/(^|[^0-9])(\d{6}\s*[-–—]\s*\d{7})(?![0-9])/g, function (_, a) { maskedCount++; return a + '[주민번호가림]'; });
    t = t.replace(/(^|[^0-9])(\d{13})(?![0-9])/g, function (_, a) { maskedCount++; return a + '[주민번호가림]'; });
    t = t.replace(/(^|[^0-9])(\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4})(?![0-9])/g, function (_, a) { maskedCount++; return a + '[카드번호가림]'; });
    t = t.replace(/(^|[^0-9])(\d{3}\s?-\s?\d{2}\s?-\s?\d{5}\s?-\s?\d)(?![0-9])/g, function (_, a) { maskedCount++; return a + '[사업장관리번호가림]'; });
    t = t.replace(/(^|[^0-9])(\d{3}\s?-\s?\d{2}\s?-\s?\d{5})(?![0-9]|-\d)/g, function (_, a) { maskedCount++; return a + '[사업자번호가림]'; });
    t = t.replace(/(^|[^0-9])((?:01[016789][- .]?\d{3,4}[- .]?\d{4}|(?:02|0[3-6][1-5]|070|080|050\d?)[- .]\d{3,4}[- .]\d{4}))(?![0-9])/g, function (_, a) { maskedCount++; return a + '[연락처가림]'; });
    t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, function () { maskedCount++; return '[이메일가림]'; });

    /* 4) 옵시디언 내부 위키링크 [[문서|표시]] → 굵은 글씨 */
    t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '**$2**');
    t = t.replace(/\[\[([^\]]+)\]\]/g, '**$1**');

    return { text: t.replace(/\n{3,}/g, '\n\n').trim(), maskedCount: maskedCount, rrnBlocked: preRrn || hasRawRrn(t) };
  }

  /* ── 2층: 법제처 국가법령정보센터 · P박스 공식 법령/판례 자동 추출 및 대조 ── */
  var ABBREV_FALLBACK = {
    '근기법': '근로기준법',
    '노조법': '노동조합 및 노동관계조정법',
    '산재법': '산업재해보상보험법',
    '산안법': '산업안전보건법',
    '중처법': '중대재해 처벌 등에 관한 법률',
    '중대재해처벌법': '중대재해 처벌 등에 관한 법률',
    '남녀고용평등법': '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률',
    '퇴직급여법': '근로자퇴직급여 보장법',
    '근퇴법': '근로자퇴직급여 보장법',
    '임채법': '임금채권보장법',
    '근복법': '근로복지기본법',
    '근참법': '근로자참여 및 협력증진에 관한 법률',
    '기간제법': '기간제 및 단시간근로자 보호 등에 관한 법률',
    '파견법': '파견근로자 보호 등에 관한 법률'
  };

  function normLawKey(s) {
    return str(s).replace(/[\s·ㆍ・\-_]/g, '');
  }

  function resolveFullLawName(rawName) {
    var base = str(rawName).replace(/\s*(?:시행령|시행규칙)$/, '').trim();
    var suffixM = str(rawName).match(/\s*(시행령|시행규칙)$/);
    var suffix = suffixM ? (' ' + suffixM[1]) : '';
    var map = (Corpus && Corpus.LAW_ABBREV_MAP) ? Object.assign({}, ABBREV_FALLBACK, Corpus.LAW_ABBREV_MAP) : ABBREV_FALLBACK;
    if (own(map, base)) return map[base] + suffix;
    var nk = normLawKey(base);
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (normLawKey(keys[i]) === nk) return map[keys[i]] + suffix;
    }
    return str(rawName);
  }

  function extractLawCitations(text) {
    var src = String(text == null ? '' : text);
    var out = [], seen = {};
    function pushCite(c) {
      var v = cut(c.replace(/[「『」』"']/g, ' ').replace(/\s+/g, ' '), LIMIT.lawCite);
      if (!v || own(seen, v) || out.length >= LIMIT.laws) return;
      seen[v] = true;
      out.push(v);
    }
    var lawRe = /(근로기준법|근기법|최저임금법|근로자퇴직급여\s*보장법|퇴직급여법|임금채권보장법|근로복지기본법|근복법|노동조합\s*및\s*노동관계조정법|노조법|노동위원회법|근로자참여\s*및\s*협력증진에\s*관한\s*법률|근참법|산업재해보상보험법|산재법|산업안전보건법|산안법|중대재해\s*처벌\s*등에\s*관한\s*법률|중대재해처벌법|중처법|남녀고용평등과\s*일[·ㆍ]가정\s*양립\s*지원에\s*관한\s*법률|남녀고용평등법|기간제\s*및\s*단시간근로자\s*보호\s*등에\s*관한\s*법률|기간제법|파견근로자\s*보호\s*등에\s*관한\s*법률|파견법|고용정책\s*기본법|중소기업기술\s*보호\s*지원에\s*관한\s*법률|고용보험법|채용절차의\s*공정화에\s*관한\s*법률)(?:\s*시행령|\s*시행규칙)?[」』"']?(?:\s*제\d+조(?:의\d+)?)?/g;
    var m;
    while ((m = lawRe.exec(src)) !== null) pushCite(m[0]);
    var precRe = /대법원\s*\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*선고\s*\d{2,4}[다두도마바카합]\d+\s*(?:전원합의체\s*)?판결/g;
    while ((m = precRe.exec(src)) !== null) pushCite(m[0]);
    return out;
  }

  var _lawIdxByNorm = null;
  function getLawIdxMap() {
    if (_lawIdxByNorm) return _lawIdxByNorm;
    var map = {};
    if (LawIdx && LawIdx.PRIORITY_META) {
      Object.keys(LawIdx.PRIORITY_META).forEach(function (k) {
        var meta = LawIdx.PRIORITY_META[k];
        map[normLawKey(k)] = { title: meta.title || k, dept: meta.dept || '', rank: meta.rank || 0, cat: meta.cat || '' };
        if (meta.title) map[normLawKey(meta.title)] = map[normLawKey(k)];
      });
    }
    if (LawIdx && typeof LawIdx.list === 'function') {
      try {
        LawIdx.list().forEach(function (row) {
          var nk = normLawKey(row.title || row.dir);
          if (!own(map, nk)) map[nk] = { title: row.title || row.dir, dept: row.dept || '', rank: row.priority || 0, cat: row.cat || '' };
        });
      } catch (e) {}
    }
    _lawIdxByNorm = map;
    return map;
  }

  /* 문서 인용 목록 → 법제처 공식 원문 URL + P박스 연결 + 시행일 대조 결과 생성 */
  function matchOfficialLaws(article, verifiedYmd, todayYmd) {
    article = article || {};
    var cites = [];
    var seen = {};
    rows(article.laws).concat(extractLawCitations(article.body || '')).forEach(function (c) {
      var v = cut(c, LIMIT.lawCite);
      if (v && !own(seen, v) && cites.length < LIMIT.laws) { seen[v] = true; cites.push(v); }
    });

    var idxMap = getLawIdxMap();
    var seeds = (Corpus && Array.isArray(Corpus.SEED_DOCS)) ? Corpus.SEED_DOCS : [];
    var nowYmd = str(todayYmd) || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

    var out = [], seenFull = {};
    cites.forEach(function (cite) {
      var isPrec = /^대법원|헌법재판소|중앙노동위원회/.test(cite);
      var artM = cite.match(/(제\d+조(?:의\d+)?)/);
      var articleNo = artM ? artM[1] : '';
      var rawLawPart = isPrec ? cite : cite.replace(/\s*제\d+조(?:의\d+)?.*$/, '').trim();
      var fullLaw = isPrec ? cite : resolveFullLawName(rawLawPart);
      var baseLaw = fullLaw.replace(/\s*(?:시행령|시행규칙)$/, '').trim();
      var suffixM = rawLawPart.match(/\s*(시행령|시행규칙)$/);
      var suffix = suffixM ? (' ' + suffixM[1]) : '';
      var idxHit = !isPrec ? (idxMap[normLawKey(fullLaw)] || idxMap[normLawKey(baseLaw)] || null) : null;
      var displayLaw = (!isPrec && idxHit && idxHit.title)
        ? ((suffix && !/\s*(?:시행령|시행규칙)$/.test(idxHit.title)) ? (idxHit.title + suffix) : idxHit.title)
        : fullLaw;
      var fullTitle = isPrec ? cite : (displayLaw + (articleNo ? (' ' + articleNo) : ''));
      var dedupKey = normLawKey(fullTitle);
      if (own(seenFull, dedupKey)) return;
      seenFull[dedupKey] = true;

      /* SEED_DOCS 에서 정확 일치 또는 조문/사건번호 일치 원문 찾기 */
      var seedHit = null;
      for (var i = 0; i < seeds.length; i++) {
        var sd = seeds[i];
        if (!sd) continue;
        if (isPrec && sd.docNumber && cite.indexOf(sd.docNumber) >= 0) { seedHit = sd; break; }
        if (!isPrec && normLawKey(sd.lawName || sd.title) === normLawKey(fullLaw)) { seedHit = sd; break; }
      }

      var officialUrl = '';
      if (seedHit && safeUrl(seedHit.officialUrl)) {
        officialUrl = safeUrl(seedHit.officialUrl);
      } else if (isPrec) {
        var caseNoM = cite.match(/(\d{2,4}[다두도마바카합]\d+)/);
        var qPrec = caseNoM ? caseNoM[1] : cite;
        officialUrl = 'https://www.law.go.kr/precSc.do?menuId=7&subMenuId=47&tabMenuId=213&query=' + encodeURIComponent(qPrec);
      } else {
        var lawUrlTarget = fullLaw + (articleNo ? ('/' + articleNo) : '');
        officialUrl = 'https://www.law.go.kr/' + encodeURI('법령/' + lawUrlTarget);
      }

      var effDate = (seedHit && str(seedHit.effectiveDate)) || '';
      var effState = (Engine && typeof Engine.effectiveState === 'function' && effDate)
        ? Engine.effectiveState(effDate, nowYmd)
        : 'current';
      var needsLawRecheck = !!(effDate && verifiedYmd && effDate > verifiedYmd);

      out.push({
        cite: cite,
        kind: isPrec ? 'precedent' : 'statute',
        fullTitle: fullTitle,
        dept: (idxHit && idxHit.dept) || (isPrec ? '대법원' : '국가법령정보센터'),
        indexedInPBox: !!(idxHit || seedHit),
        effectiveDate: effDate,
        effectiveState: effState,
        needsLawRecheck: needsLawRecheck,
        officialUrl: safeUrl(officialUrl),
        pboxUrl: 'pu-pbox.html?q=' + encodeURIComponent(fullTitle)
      });
    });
    return out;
  }

  /* ── 3층: 한국어 위키백과(Wikipedia 공식 API) 엄격 분리 및 검색어 안전 관문 ── */
  function sanitizeWikiSearchQuery(rawQuery, extraBlockedNames) {
    var q = cut(rawQuery, LIMIT.wikiTopic);
    if (!q) return { ok: false, query: '', reason: '검색할 일반 용어·업종·기관명을 입력해 주세요.' };
    if (hasRawRrn(q)) {
      return { ok: false, query: '', blockedPii: true, reason: '주민등록번호 패턴이 포함되어 외부 위키백과 전송을 차단했습니다.' };
    }
    if (/(?:01[016789][- .]?\d{3,4}[- .]?\d{4}|(?:02|0[3-6][1-5]|070|080|050\d?)[- .]\d{3,4}[- .]\d{4})/.test(q)
      || /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(q)
      || /\d{3}\s?-\s?\d{2}\s?-\s?\d{5}/.test(q)
      || /[A-Za-z]:\\/.test(q)
      || /file:\/\/\//i.test(q)) {
      return { ok: false, query: '', blockedPii: true, reason: '연락처·이메일·사업자번호·내 PC 경로는 외부 위키백과로 전송하지 않습니다.' };
    }
    if (/\d{4}\s*(?:부해|부노|산재|진정|가합|가단|나|다|구합|구단|누|두)\s*\d+/.test(q)) {
      return { ok: false, query: '', blockedPii: true, reason: '개별 사건번호는 외부 위키백과 대신 사내 P박스에서 조회해 주세요.' };
    }
    /* 개별 거래처 법인명·당사자 호칭이 섞인 검색어 차단 (일반 업종·공공기관·개념어만 허용) */
    if (/㈜|\((?:주|유|사|재|합)\)|주식회사|유한회사|유한책임회사|합자회사|합명회사/.test(q)
      || /[가-힣]{2,4}\s*(?:대표이사|진정인|피진정인|피신고인|신고인|의뢰인|귀하)(?:[은는이가을를의에과와도만](?:[^가-힣]|$)|[^가-힣]|$)/.test(q)
      || /[가-힣]{2,4}\s+(?:님|씨)(?:[은는이가을를의에과와도만](?:[^가-힣]|$)|[^가-힣]|$)/.test(q)) {
      return { ok: false, query: '', blockedPii: true, reason: '개별 기업명(㈜·주식회사)이나 개인 호칭이 포함된 검색어는 외부 위키백과로 전송하지 않습니다.' };
    }
    if (Array.isArray(extraBlockedNames)) {
      for (var i = 0; i < extraBlockedNames.length; i++) {
        var nm = str(extraBlockedNames[i]);
        if (nm.length >= 2 && q.indexOf(nm) >= 0) {
          return { ok: false, query: '', blockedPii: true, reason: '사내 구성원·당사자 이름이 포함되어 외부 위키백과 전송을 차단했습니다.' };
        }
      }
    }
    return { ok: true, query: q, blockedPii: false, reason: '' };
  }

  function buildWikipediaApiUrls(rawQuery, extraBlockedNames) {
    var checked = sanitizeWikiSearchQuery(rawQuery, extraBlockedNames);
    if (!checked.ok) return { ok: false, reason: checked.reason, blockedPii: !!checked.blockedPii };
    var enc = encodeURIComponent(checked.query);
    return {
      ok: true,
      query: checked.query,
      summaryUrl: 'https://ko.wikipedia.org/api/rest_v1/page/summary/' + enc,
      searchUrl: 'https://ko.wikipedia.org/w/api.php?action=query&list=search&srlimit=5&utf8=1&format=json&origin=*&srsearch=' + enc
    };
  }

  function safeWikipediaPageUrl(rawUrl, fallbackTitle) {
    var u = safeUrl(rawUrl);
    if (u) {
      try {
        var parsed = new URL(u);
        if (parsed.protocol === 'https:' && parsed.hostname === 'ko.wikipedia.org') return u;
      } catch (e) {}
    }
    var t = cut(fallbackTitle, LIMIT.wikiTopic);
    return t ? ('https://ko.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/\s+/g, '_'))) : 'https://ko.wikipedia.org/';
  }

  function normalizeWikipediaSummary(payload, fetchedAtYmd) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' || payload.status === 404) return null;
    var title = cut(payload.title, 120);
    var extract = cut(payload.extract, 1200);
    if (!title || !extract) return null;
    var rawPage = payload.content_urls && payload.content_urls.desktop && payload.content_urls.desktop.page;
    return {
      title: title,
      description: cut(payload.description, 160),
      extract: extract,
      pageUrl: safeWikipediaPageUrl(rawPage, title),
      isDisambiguation: payload.type === 'disambiguation',
      sourceTier: 'wikipedia_reference',
      legalBasis: false,
      badgeLabel: '참고용 외부 백과(한국어 위키백과) · 법적 근거 아님',
      licenseNote: 'CC BY-SA 4.0 · 조회일 ' + (str(fetchedAtYmd) || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10))
    };
  }

  /* ── 옵시디언 마크다운(.md) 및 배포 묶음(.json) 파서 ── */
  function parseObsidianMarkdown(mdText, fallbackId) {
    var norm = String(mdText == null ? '' : mdText).replace(/\r\n/g, '\n');
    var meta = {}, bodyRaw = norm;
    var fm = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fm) {
      bodyRaw = fm[2];
      fm[1].split('\n').forEach(function (line) {
        var kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
        if (!kv) return;
        var k = kv[1].trim(), v = kv[2].trim();
        if (v.charAt(0) === '[' && v.charAt(v.length - 1) === ']') {
          meta[k] = v.slice(1, -1).split(',').map(function (s) { return s.trim().replace(/^["']|["']$/g, ''); }).filter(Boolean);
        } else if (v === 'true' || v === 'false') {
          meta[k] = v === 'true';
        } else {
          meta[k] = v.replace(/^["']|["']$/g, '');
        }
      });
    }
    bodyRaw = bodyRaw.replace(/^\s+/, '');
    var h1M = bodyRaw.match(/^#\s+(.+)\n+/);
    var titleCand = meta.title || (h1M ? h1M[1] : '') || fallbackId || '';
    if (h1M) bodyRaw = bodyRaw.slice(h1M[0].length);
    bodyRaw = bodyRaw.replace(/^\s*>\s*\*\*요약\*\*\s*:[^\n]*\n*/i, '');

    var scrubbedTitle = scrubTextForWiki(titleCand);
    var scrubbedSummary = scrubTextForWiki(meta.summary || meta.description || '');
    var scrubbedBody = scrubTextForWiki(bodyRaw);
    if (scrubbedTitle.rrnBlocked || scrubbedSummary.rrnBlocked || scrubbedBody.rrnBlocked) {
      return { ok: false, errors: ['주민등록번호 의심 숫자가 남아 있어 가져오기를 차단했습니다. 원본에서 제거한 뒤 다시 시도해 주세요.'] };
    }

    var explicitId = str(meta.id);
    var rawId = (explicitId && okId(explicitId)) ? explicitId : stableNoteId(fallbackId || titleCand || bodyRaw.slice(0, 80));

    return cleanArticle({
      id: rawId,
      title: scrubbedTitle.text,
      category: str(meta.category) || '일반 노무실무',
      summary: scrubbedSummary.text,
      body: scrubbedBody.text,
      laws: Array.isArray(meta.laws) ? meta.laws : [],
      wikiTopics: Array.isArray(meta.wikiTopics) ? meta.wikiTopics : [],
      apps: Array.isArray(meta.apps) ? meta.apps : [],
      obsidianNote: str(meta.obsidianNote || fallbackId)
    });
  }

  function parseObsidianBundle(jsonText) {
    var parsed;
    try { parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText; }
    catch (e) { return { ok: false, items: [], errors: ['JSON 파일 형식이 올바르지 않습니다.'] }; }
    var list = (parsed && Array.isArray(parsed.articles)) ? parsed.articles : (Array.isArray(parsed) ? parsed : []);
    if (!list.length) return { ok: false, items: [], errors: ['가져올 지식백과 문서 항목(articles)이 없습니다.'] };
    var items = [], errors = [];
    list.forEach(function (raw, idx) {
      var c = cleanArticle(raw);
      if (c.ok) items.push(c.value);
      else errors.push((idx + 1) + '번째 문서: ' + c.errors.join(', '));
    });
    return { ok: items.length > 0 && errors.length === 0, items: items, errors: errors };
  }

  /* ── 레코드 검증·정규화 (저장 직전 + 화면 표시 직전 이중 호출) ── */
  function cleanArticle(raw) {
    raw = raw || {};
    var errors = [];
    var id = str(raw.id);
    if (!okId(id)) errors.push('문서 영구 번호(id)가 올바르지 않습니다');

    var scTitle = scrubTextForWiki(raw.title);
    var scCat = scrubTextForWiki(raw.category);
    var scSummary = scrubTextForWiki(raw.summary);
    var scBody = scrubTextForWiki(raw.body);
    var scObs = scrubTextForWiki(String(raw.obsidianNote || '').replace(/^.*[\\/]/, ''));
    if (scTitle.rrnBlocked || scCat.rrnBlocked || scSummary.rrnBlocked || scBody.rrnBlocked || scObs.rrnBlocked) {
      errors.push('주민등록번호 모양의 숫자는 사내 공용 지식백과에 저장할 수 없습니다');
    }

    var title = cut(scTitle.text, LIMIT.title);
    if (!title) errors.push('문서 제목을 적어 주세요 (1~120자)');
    var body = cut(scBody.text, LIMIT.body);
    if (!body) errors.push('실무 기준 본문을 적어 주세요');

    var cat = cut(scCat.text, LIMIT.category) || '일반 노무실무';
    var summary = cut(scSummary.text, LIMIT.summary);

    var laws = [], lawSeen = {};
    rows(raw.laws).concat(extractLawCitations(body)).forEach(function (l) {
      var sl = scrubTextForWiki(l);
      if (sl.rrnBlocked) { errors.push('법령 인용란에 주민등록번호 의심 숫자를 넣을 수 없습니다'); return; }
      var v = cut(sl.text, LIMIT.lawCite);
      if (v && !own(lawSeen, v) && laws.length < LIMIT.laws) { lawSeen[v] = true; laws.push(v); }
    });

    var wikiTopics = [], topicSeen = {};
    rows(raw.wikiTopics).forEach(function (w) {
      var chk = sanitizeWikiSearchQuery(w);
      if (chk.ok && !own(topicSeen, chk.query) && wikiTopics.length < LIMIT.wikiTopics) {
        topicSeen[chk.query] = true;
        wikiTopics.push(chk.query);
      }
    });

    var apps = [];
    rows(raw.apps).forEach(function (k) {
      k = str(k);
      if (own(INNER, k) && apps.indexOf(k) < 0 && apps.length < LIMIT.apps) apps.push(k);
    });

    var obsNote = cut(scObs.text, LIMIT.obsidianNote);
    var order = Number(raw.order);

    var value = {
      id: id,
      title: title,
      category: cat,
      summary: summary,
      body: body,
      laws: laws,
      wikiTopics: wikiTopics,
      apps: apps,
      obsidianNote: obsNote,
      order: isFinite(order) ? order : 0
    };
    return { ok: errors.length === 0, value: value, errors: errors, maskedCount: scTitle.maskedCount + scSummary.maskedCount + scBody.maskedCount };
  }

  function cleanReview(raw) {
    raw = raw || {};
    var errors = [];
    var id = str(raw.id);
    if (!okId(id)) errors.push('검토·신고 번호가 올바르지 않습니다');
    var articleId = str(raw.articleId);
    if (!okId(articleId)) errors.push('대상 문서 번호(articleId)가 올바르지 않습니다');
    var actorSid = str(raw.actorSid);
    if (!okSid(actorSid)) errors.push('작성자 사번(actorSid)이 없습니다');

    var kind = str(raw.kind) === 'flag' ? 'flag' : (str(raw.kind) === 'verify' ? 'verify' : '');
    if (!kind) errors.push('검토 종류(verify 또는 flag)가 올바르지 않습니다');

    var status = str(raw.status);
    if (kind === 'verify') status = 'active';
    else if (status !== 'open' && status !== 'resolved' && status !== 'dismissed') status = 'open';

    var scNote = scrubTextForWiki(raw.note);
    var scLaw = scrubTextForWiki(raw.checkedLawNote);
    var scRes = scrubTextForWiki(raw.resolutionNote);
    if (scNote.rrnBlocked || scLaw.rrnBlocked || scRes.rrnBlocked) {
      errors.push('주민등록번호 모양의 숫자는 검토·신고 메모에 적을 수 없습니다');
    }

    var note = cut(scNote.text, LIMIT.note);
    if (!note) errors.push(kind === 'flag' ? '오류·법개정 신고 내용을 적어 주세요' : '검토 확인 메모를 적어 주세요');

    var articleRev = Math.max(1, Math.floor(Number(raw.articleRev) || 1));
    var value = {
      id: id,
      articleId: articleId,
      kind: kind,
      status: status,
      actorSid: actorSid,
      articleRev: articleRev,
      checkedLawNote: cut(scLaw.text, LIMIT.checkedLawNote),
      note: note,
      resolvedBySid: okSid(str(raw.resolvedBySid)) ? str(raw.resolvedBySid) : '',
      resolvedAt: Number(raw.resolvedAt) > 0 ? Number(raw.resolvedAt) : 0,
      resolutionNote: cut(scRes.text, LIMIT.resolutionNote)
    };
    return { ok: errors.length === 0, value: value, errors: errors };
  }

  /* ── 목록·신뢰 상태 집계 ── */
  function isEmpty(rawArticles) {
    if (!rawArticles || typeof rawArticles !== 'object') return true;
    return Object.keys(rawArticles).filter(function (k) { return !badKey(k); }).length === 0;
  }

  function defaultArticles() {
    return DEFAULTS.map(function (d) {
      var c = cleanArticle(d).value;
      c.revision = 0;
      c.isDefault = true;
      return c;
    });
  }

  function liveArticles(rawArticles) {
    var out = [];
    if (!rawArticles || typeof rawArticles !== 'object') return out;
    Object.keys(rawArticles).forEach(function (k) {
      if (badKey(k)) return;
      var r = rawArticles[k];
      if (!r || typeof r !== 'object' || r._deleted) return;
      var c = cleanArticle(Object.assign({}, r, { id: r.id || k }));
      if (!c.ok) return;
      var v = c.value;
      v.revision = Number(r.revision) || 0;
      v.updatedAt = r.updatedAt || r.createdAt || 0;
      v.updatedBy = str(r.updatedBy || r.createdBy);
      out.push(v);
    });
    out.sort(function (a, b) {
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title, 'ko');
    });
    return out;
  }

  function deletedArticles(rawArticles) {
    var out = [];
    if (!rawArticles || typeof rawArticles !== 'object') return out;
    Object.keys(rawArticles).forEach(function (k) {
      if (badKey(k)) return;
      var r = rawArticles[k];
      if (!r || typeof r !== 'object' || !r._deleted) return;
      var c = cleanArticle(Object.assign({}, r, { id: r.id || k }));
      if (!c.ok) return;
      var v = c.value;
      v.revision = Number(r.revision) || 0;
      v.deletedAt = r.deletedAt || r.updatedAt || 0;
      v.deletedBy = str(r.deletedBy || r.updatedBy);
      out.push(v);
    });
    out.sort(function (a, b) { return Number(b.deletedAt || 0) - Number(a.deletedAt || 0); });
    return out;
  }

  function liveReviewsByArticle(rawReviewsTree) {
    var byArt = {};
    if (!rawReviewsTree || typeof rawReviewsTree !== 'object') return byArt;
    Object.keys(rawReviewsTree).forEach(function (artId) {
      if (badKey(artId) || !okId(artId)) return;
      var sub = rawReviewsTree[artId];
      if (!sub || typeof sub !== 'object') return;
      var list = [];
      Object.keys(sub).forEach(function (rid) {
        if (badKey(rid)) return;
        var r = sub[rid];
        if (!r || typeof r !== 'object' || r._deleted) return;
        var c = cleanReview(Object.assign({}, r, { id: r.id || rid, articleId: r.articleId || artId }));
        if (!c.ok) return;
        var v = c.value;
        v.revision = Number(r.revision) || 0;
        v.createdAt = r.createdAt || 0;
        v.updatedAt = r.updatedAt || r.createdAt || 0;
        list.push(v);
      });
      list.sort(function (a, b) { return Number(b.createdAt || b.updatedAt || 0) - Number(a.createdAt || a.updatedAt || 0); });
      byArt[artId] = list;
    });
    return byArt;
  }

  function kstDay(ts) {
    if (!ts) return '';
    var d = new Date(typeof ts === 'number' ? ts + 9 * 3600e3 : ts);
    return isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
  }

  function summarizeArticleTrust(article, reviews, todayYmd) {
    var list = Array.isArray(reviews) ? reviews : [];
    var verifications = list.filter(function (r) { return r.kind === 'verify' && r.status === 'active'; }).slice().sort(function (a, b) {
      var dt = Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
      if (dt !== 0) return dt;
      return Number(b.articleRev || 0) - Number(a.articleRev || 0);
    });
    var seenSids = {}, verifierCount = 0;
    verifications.forEach(function (v) {
      var s = str(v.actorSid);
      if (s && !own(seenSids, s)) { seenSids[s] = true; verifierCount++; }
    });
    var openFlags = list.filter(function (r) { return r.kind === 'flag' && r.status === 'open'; });
    var closedFlags = list.filter(function (r) { return r.kind === 'flag' && r.status !== 'open'; });
    var latestVerify = verifications[0] || null;
    var verifiedYmd = latestVerify ? kstDay(latestVerify.updatedAt || latestVerify.createdAt) : '';
    var officialLaws = matchOfficialLaws(article, verifiedYmd, todayYmd);
    var lawChangedAfterVerify = officialLaws.some(function (l) { return l.needsLawRecheck; });
    var curRev = Math.max(1, Number(article && article.revision) || 1);
    var revOutdated = !!(latestVerify && Number(latestVerify.articleRev || 1) !== curRev);

    var state = 'unverified';
    var label = '최초 검토 대기';
    if (openFlags.length > 0) {
      state = 'flagged';
      label = '오류·법개정 신고 ' + openFlags.length + '건';
    } else if (lawChangedAfterVerify) {
      state = 'flagged';
      label = '검토일 이후 법령 시행일 변동 확인';
    } else if (latestVerify && revOutdated) {
      state = 'stale_rev';
      label = '본문 개정 후 재검토 대기';
    } else if (latestVerify) {
      state = 'verified';
      label = '검토 확인됨 (' + Math.max(1, verifierCount) + '명)';
    }

    return {
      state: state,
      label: label,
      verifierCount: verifierCount,
      verifications: verifications,
      openFlags: openFlags,
      closedFlags: closedFlags,
      latestVerify: latestVerify,
      verifiedYmd: verifiedYmd,
      officialLaws: officialLaws
    };
  }

  function buildBoard(opts) {
    opts = opts || {};
    var articles = Array.isArray(opts.articles) ? opts.articles : [];
    var reviewsByArt = opts.reviewsByArt || {};
    var todayYmd = opts.todayYmd || '';
    var q = str(opts.query).toLowerCase();
    var catFilter = str(opts.category);
    var kpiFilter = str(opts.kpiFilter);

    var enriched = articles.map(function (art) {
      var trust = summarizeArticleTrust(art, reviewsByArt[art.id] || [], todayYmd);
      return { article: art, trust: trust };
    });

    var lawSet = {};
    var verifiedCount = 0, attentionCount = 0;
    enriched.forEach(function (item) {
      if (item.trust.state === 'verified') verifiedCount++;
      if (item.trust.state === 'flagged' || item.trust.state === 'stale_rev') attentionCount++;
      item.trust.officialLaws.forEach(function (l) { lawSet[l.fullTitle] = true; });
    });

    var filtered = enriched.filter(function (item) {
      var a = item.article, tr = item.trust;
      if (catFilter && a.category !== catFilter) return false;
      if (kpiFilter === 'verified' && tr.state !== 'verified') return false;
      if (kpiFilter === 'attention' && tr.state !== 'flagged' && tr.state !== 'stale_rev') return false;
      if (kpiFilter === 'unverified' && tr.state !== 'unverified') return false;
      if (q) {
        var hay = [a.title, a.category, a.summary, a.body].concat(a.laws || [], a.wikiTopics || []).join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var openFlagRows = [];
    enriched.forEach(function (item) {
      item.trust.openFlags.forEach(function (fl) {
        openFlagRows.push({ flag: fl, article: item.article });
      });
    });

    return {
      total: enriched.length,
      verifiedCount: verifiedCount,
      attentionCount: attentionCount,
      lawCount: Object.keys(lawSet).length,
      items: filtered,
      allItems: enriched,
      openFlagRows: openFlagRows
    };
  }

  function stableNoteId(seedText) {
    var s = str(seedText).replace(/\\/g, '/').toLowerCase() || 'untitled';
    if (/^[a-z0-9_-]{3,50}$/.test(s) && !badKey(s)) return s;
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 ^= (c + i); h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
    }
    return 'pw-md-' + h1.toString(36) + '-' + h2.toString(36);
  }

  function newId(nowMs, prefix) {
    var p = str(prefix) || 'pw';
    return p + '-' + Number(nowMs || Date.now()).toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  var api = {
    ROOT: ROOT,
    ARTICLES: ARTICLES,
    REVIEWS: REVIEWS,
    ENTITY_ARTICLE: ENTITY_ARTICLE,
    ENTITY_REVIEW: ENTITY_REVIEW,
    LIMIT: LIMIT,
    CATEGORIES: CATEGORIES,
    INNER: INNER,
    DEFAULTS: DEFAULTS,
    safeUrl: safeUrl,
    hasRawRrn: hasRawRrn,
    scrubTextForWiki: scrubTextForWiki,
    resolveFullLawName: resolveFullLawName,
    extractLawCitations: extractLawCitations,
    matchOfficialLaws: matchOfficialLaws,
    sanitizeWikiSearchQuery: sanitizeWikiSearchQuery,
    buildWikipediaApiUrls: buildWikipediaApiUrls,
    safeWikipediaPageUrl: safeWikipediaPageUrl,
    normalizeWikipediaSummary: normalizeWikipediaSummary,
    parseObsidianMarkdown: parseObsidianMarkdown,
    parseObsidianBundle: parseObsidianBundle,
    cleanArticle: cleanArticle,
    cleanReview: cleanReview,
    isEmpty: isEmpty,
    defaultArticles: defaultArticles,
    liveArticles: liveArticles,
    deletedArticles: deletedArticles,
    liveReviewsByArticle: liveReviewsByArticle,
    summarizeArticleTrust: summarizeArticleTrust,
    buildBoard: buildBoard,
    stableNoteId: stableNoteId,
    newId: newId,
    kstDay: kstDay
  };

  if (isNode) module.exports = api;
  if (root) root.PuWiki = api;
})(typeof window !== 'undefined' ? window : globalThis);
