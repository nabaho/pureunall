/* 푸른통합시스템 — 괴롭힘·성희롱 조사 핵심 순수 로직 (브라우저 window.PuHarassCore / Node 겸용)
 *
 * 무엇을 맡나
 *   1. 근로기준법 제76조의2·제76조의3 및 남녀고용평등법 제14조에 따른 8단계 표준 조사 프로토콜
 *   2. 푸른 메일함(mailbox/folders · mailbox/msgs · searchMailbox 결과)에서 조사 공문·서류를 자동 분류하고
 *      기존 사건 귀속 및 미등록 사건 후보 묶음(Bundle)으로 자동 그룹화
 *   3. 수집된 메일로부터 사건별 진행단계(steps) 자동 복원(사람이 손으로 고친 manual 칸은 덮지 않음)
 *   4. 푸른이알피(pu-erp.html) 사건 원장(status·brief·note·harassSummary) 및 업무 메모(case_memos)로
 *      모든 진행 과정을 중복 없이 동기화하는 순수 변환기
 *   5. 비밀유지 권한 검사(담당 노무사 주·부 + 대표만 열람), 주민등록번호 가림, 조사결과보고서 초안·인쇄본 조립
 *
 * ⚠ 저장소는 공개다 — 실제 고객·근로자 실명·주민번호·계좌를 코드에 넣지 않는다.
 */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuHarassCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var STEPS = [
    { code: 'intake',  no: 1, short: '상담·수임',   name: '① 상담·수임·기초검토',     erpStatus: 'pending',  desc: '견적서 발송 · 조사 위임계약 체결 · 사내 취업규칙 검토' },
    { code: 'plan',    no: 2, short: '조사계획',   name: '② 조사계획·착수공문',       erpStatus: 'progress', desc: '조사위원 위촉 · 조사계획서 수립 · 착수·출석요구 공문 발송' },
    { code: 'pledge',  no: 3, short: '비밀·보호',  name: '③ 비밀유지·피해자 보호조치', erpStatus: 'progress', desc: '비밀유지서약서 징구 · 근무장소 변경·유급휴가 등 보호조치 검토' },
    { code: 'victim',  no: 4, short: '신고인조사', name: '④ 신고인(피해자) 면담조사', erpStatus: 'progress', desc: '신고서·기초설문 확인 · 신고인 진술 청취 및 진술조서 확인' },
    { code: 'accused', no: 5, short: '행위자조사', name: '⑤ 피신고인(행위자) 면담조사', erpStatus: 'progress', desc: '피신고 요지 고지 · 소명 기회 부여 · 2차 가해 금지 고지' },
    { code: 'witness', no: 6, short: '참고·증거',  name: '⑥ 참고인·조직 실태조사',   erpStatus: 'progress', desc: '참고인 면담 · 녹취·메신저·공문 증거 대조 · 조직 설문조사' },
    { code: 'review',  no: 7, short: '법리검토',   name: '⑦ 사실인정·3요건 법리검토', erpStatus: 'judgment', desc: '행위별 사실관계 확정 · 지위우위·업무적정범위·근무환경악화 판단' },
    { code: 'report',  no: 8, short: '보고·종결',  name: '⑧ 조사결과보고서 제출·종결', erpStatus: 'closed',   desc: '조사결과보고서 제출 · 징계·재발방지 조치권고 · 사건 종결' }
  ];

  var CATEGORIES = {
    harass: { code: 'harass', label: '직장 내 괴롭힘', short: '괴롭힘' },
    sexual: { code: 'sexual', label: '직장 내 성희롱', short: '성희롱' },
    both:   { code: 'both',   label: '괴롭힘·성희롱 복합', short: '복합조사' }
  };

  /* 사건 특수 형태 구분: 일반 사내 당사자 / 고객·민원인 등 제3자 / 원하청·도급 혼재 */
  var CASE_SUBTYPES = {
    '':            { code: '',            label: '사내 당사자 사건 (일반)',            short: '사내일반' },
    third_party:   { code: 'third_party', label: '고객·민원인 등 제3자 가해 사건',     short: '제3자가해' },
    subcontract:   { code: 'subcontract', label: '원하청·도급·파견 사업장 혼재 사건',  short: '원하청·도급' }
  };

  /* 사건·쟁점별 법정 성립요건 스키마 (근로기준법 제76조의2 / 남녀고용평등법 제14조 / 산안법 제41조·남녀고평법 제14조의2) */
  var LEGAL_SCHEMAS = {
    harass: {
      code: 'harass',
      shortTitle: '괴롭힘 3요건',
      lawBasis: '근로기준법 제76조의2 및 제76조의3',
      colHeader: '법정 3요건 (①우위·②초과·③악화)',
      e1: { short: '①우위', chip: '①우위성', label: '직장에서의 지위 또는 관계 등의 우위 이용' },
      e2: { short: '②초과', chip: '②적정범위초과', label: '업무상 적정범위를 넘는 행위' },
      e3: { short: '③악화', chip: '③고통·환경악화', label: '신체적·정신적 고통 유발 또는 근무환경 악화' },
      verdictYes: '직장 내 괴롭힘 해당(인정)',
      verdictNo: '직장 내 괴롭힘 비해당'
    },
    sexual: {
      code: 'sexual',
      shortTitle: '성희롱 성립요건',
      lawBasis: '남녀고용평등법 제2조 제2호 및 제14조',
      colHeader: '성희롱 요건 (①업무관련·②성적언동·③굴욕/불이익)',
      e1: { short: '①업무관련', chip: '①지위·업무관련', label: '사업주·상급자·근로자의 지위 이용 또는 업무 관련성' },
      e2: { short: '②성적언동', chip: '②성적언동·요구', label: '성적 언동 또는 성적 요구 등 객관적 행위' },
      e3: { short: '③굴욕·불이익', chip: '③굴욕감·불이익', label: '성적 굴욕감·혐오감 유발 또는 불응을 이유로 한 불이익' },
      verdictYes: '직장 내 성희롱 해당(인정)',
      verdictNo: '직장 내 성희롱 비해당'
    },
    third_party: {
      code: 'third_party',
      shortTitle: '제3자 피해·보호요건',
      lawBasis: '산업안전보건법 제41조 및 남녀고용평등법 제14조의2',
      colHeader: '제3자 요건 (①업무수행·②가해언동·③보호필요)',
      e1: { short: '①업무수행', chip: '①업무수행관련', label: '고객 응대·민원 처리 등 업무 수행 과정과의 관련성' },
      e2: { short: '②가해언동', chip: '②폭언·성적언동', label: '고객 등 제3자의 폭언·폭행·성적 언동 등 가해 행위' },
      e3: { short: '③보호필요', chip: '③고통·보호필요', label: '신체·정신적 건강장해·고통 발생 및 업무중단·분리 필요성' },
      verdictYes: '고객 등 제3자 피해 인정(보호조치 대상)',
      verdictNo: '제3자 피해 요건 미충족'
    }
  };

  /* 징계 양정 참고 기준표 (고용노동부 매뉴얼 및 중앙노동위원회 판정례 경향 요약) */
  var DISCIPLINARY_GUIDE = [
    { level: 'light',    name: '경고 · 견책 (경징계)',        scoreRange: '1~2점', criteria: '일회성·우발적 부적절 언동, 피해 경미, 즉시 사과·개선 의지 명확, 2차 가해 없음', caution: '취업규칙상 서면경고·견책 사유 해당 여부 및 재발방지 특별교육 병행 권장' },
    { level: 'medium',   name: '감봉 · 배치전환 (중간수위)',   scoreRange: '3~5점', criteria: '수차례 반복된 폭언·모욕·부당지시 또는 언어적 성희롱, 근무환경 악화 발생', caution: '근로기준법 제95조 감액 한도(1회 평균임금 1일분 1/2, 총액 1/10 이내) 준수 필수' },
    { level: 'heavy',    name: '정직 · 강등 · 직위해제 (중징계)', scoreRange: '6~8점', criteria: '장기간·지속적 괴롭힘·집단 따돌림, 우위 악용 업무배제, 성적 접촉·반복 성희롱, 진단서상 정신적 피해 확인', caution: '징계 전 피해근로자 의견 사전 청취(근기법 제76조의3 제5항) 및 인사위원회 충분한 소명기회 부여 필수' },
    { level: 'dismissal', name: '해고 · 파면 (배제징계)',     scoreRange: '9점 이상', criteria: '폭행·상해, 강제추행 등 중대 성비위, 신고자 보복·회유·2차 가해, 시정지시 불이행 등 고용관계 지속 불가능', caution: '근로기준법 제23조 제1항 사회통념상 고용관계를 계속할 수 없을 정도의 책임 사유 입증 및 서면통지(제27조) 엄수' }
  ];

  /* 부서·조직 실태조사 무기명 보안 설문 표준 문항 */
  var SURVEY_QUESTIONS = [
    { id: 'sq1', type: 'choice', q: '최근 1년 내 부서·사업장 내에서 폭언·욕설·모욕적 언동을 직접 겪거나 목격한 적이 있습니까?', opts: ['전혀 없음', '1~2회 있음', '월 1회 이상 반복됨', '매주·상시 발생함'] },
    { id: 'sq2', type: 'choice', q: '업무와 무관한 사적 심부름, 과도한 감시, 정당한 이유 없는 업무 배제·전가를 경험하거나 목격한 적이 있습니까?', opts: ['전혀 없음', '일부 있음', '자주 있음', '심각한 수준임'] },
    { id: 'sq3', type: 'choice', q: '집단 따돌림, 의도적 무시, 정보 공유 배제, 회식·야근 강요 분위기를 경험하거나 목격한 적이 있습니까?', opts: ['전혀 없음', '일부 있음', '자주 있음', '심각한 수준임'] },
    { id: 'sq4', type: 'choice', q: '성적 농담, 외모 평가, 불쾌한 신체 접촉 등 직장 내 성희롱에 해당하는 언동을 겪거나 목격한 적이 있습니까?', opts: ['전혀 없음', '1~2회 있음', '반복적으로 있음', '심각한 수준임'] },
    { id: 'sq5', type: 'choice', q: '문제 제기나 고충 신고 시 비밀이 지켜지고 불이익(2차 가해) 없이 공정하게 처리될 것이라고 신뢰하십니까?', opts: ['매우 신뢰함', '대체로 신뢰함', '별로 신뢰하지 않음', '전혀 신뢰하지 않음'] },
    { id: 'sq6', type: 'choice', q: '현재 부서 내 근무환경으로 인해 스트레스·수면장애·이직 고려 등 신체적·정신적 어려움을 겪고 있습니까?', opts: ['전혀 없음', '약간 있음', '상당히 있음', '진료·상담이 필요할 정도임'] },
    { id: 'sq7', type: 'choice', q: '조직문화 개선 및 재발 방지를 위해 가장 시급한 조치는 무엇이라고 생각하십니까?', opts: ['관리자 리더십·소통 개선', '가해 행위자 엄정 조치·분리', '명확한 업무분장 및 인력 보충', '익명 고충신고 창구 및 정기 교육'] }
  ];

  /* 수행 유형 구분: 푸른노무법인 직접수행+결과보고 완료 건을 대리·자문·외부위원과 명확히 분리 */
  var PERFORM_MODES = {
    direct_report:    { code: 'direct_report',    label: '푸른노무법인 직접수행 · 결과보고 완료', short: '직접수행·결과보고', icon: '🏅' },
    direct_active:    { code: 'direct_active',    label: '푸른노무법인 직접조사 수행 (진행·착수)', short: '직접조사(진행)',   icon: '🔍' },
    advisory_rep:     { code: 'advisory_rep',     label: '당사자 대리 · 법률자문 · 보고서검토',   short: '대리·자문·검토',   icon: '⚖️' },
    committee_collab: { code: 'committee_collab', label: '외부위원 위촉 · 타법인 협업',           short: '외부위원·협업',     icon: '🏛️' }
  };

  var DOC_ROLES = {
    quote_contract: { code: 'quote_contract', label: '견적·위임계약', stepCode: 'intake' },
    official_plan:  { code: 'official_plan',  label: '착수공문·계획', stepCode: 'plan' },
    pledge_protect: { code: 'pledge_protect', label: '비밀유지·보호', stepCode: 'pledge' },
    victim_stmt:    { code: 'victim_stmt',    label: '신고·피해진술', stepCode: 'victim' },
    accused_stmt:   { code: 'accused_stmt',   label: '피신고·소명',   stepCode: 'accused' },
    witness_evid:   { code: 'witness_evid',   label: '참고인·증거',   stepCode: 'witness' },
    draft_review:   { code: 'draft_review',   label: '검토·초안',     stepCode: 'review' },
    final_report:   { code: 'final_report',   label: '최종보고·조치', stepCode: 'report' },
    general:        { code: 'general',        label: '일반공문·연락', stepCode: '' }
  };

  var VERDICTS = {
    '':             { code: '',             label: '판단 전' },
    recognized:     { code: 'recognized',   label: '해당(인정)' },
    partial:        { code: 'partial',      label: '일부 해당' },
    unrecognized:   { code: 'unrecognized', label: '비해당(불인정)' },
    withdrawn:      { code: 'withdrawn',    label: '신고 취하' },
    settled:        { code: 'settled',      label: '합의·조정 종결' }
  };

  var PUB_DOMAINS = {
    'naver.com': 1, 'daum.net': 1, 'hanmail.net': 1, 'gmail.com': 1,
    'kakao.com': 1, 'nate.com': 1, 'yahoo.com': 1, 'hotmail.com': 1,
    'outlook.com': 1, 'icloud.com': 1, 'korea.com': 1, 'paran.com': 1
  };
  var OWN_RE = /(?:^370-6@(?:daum\.net|hanmail\.net)$|@pureun\.kr$)/i;
  var NOREPLY_RE = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|postmaster|mailer-daemon|newsletter|marketing|ad|webmaster)@/i;
  var BOX_KINDS = ['inbox', 'sent', 'archive', 'custom', 'tome', 'sched'];

  /* 홍보·뉴스레터·일반 의무교육 안내·단순 4대보험 신고 메일은 조사 사건 자동발굴에서 제외 */
  var NOISE_RE = /뉴스레터|수신\s*거부|광고\)|법정의무교육\s*안내|교육기관\s*지정|무료\s*특강|세미나\s*안내|홍보물|카드\s*명세서|세금계산서\s*발행\s*안내|사대보험\s*상실신고서|4대보험\s*상실신고서|입퇴사자\s*요청\s*서식/i;
  /* 단순 법정의무 예방교육·강의안·근로조건 자율점검·기술보호 일반서식·임금체불 확인서는 실제 조사·분쟁 신호가 없으면 제외 */
  var EDU_ONLY_RE = /예방\s*교육\s*(자료|일지|서명|안내|보고서|실습생|일정|게시|이수|확인서|사진)|성폭력\s*예방\s*교육|법정의무\s*교육|강의\s*(자료|안|주제)|교육\s*주제\s*알려|교육\s*지정\s*기관|자율\s*(개선|점검)\s*(지원\s*사업|사업|내역|신청)|기술\s*보호\s*(컨설팅|지원반|서식)|사업주\s*체불\s*확인서|임금\s*체불.*근로자성/i;
  var CASE_OVERRIDE_RE = /조사\s*(결과|보고|위원|위임|착수|계획|용역|의뢰|진행)|문답서|진술서|소명서|신고서|징계|인사위원회|고충\s*(심의|처리\s*조사|신청)|개선\s*지도|재진정|실태\s*조사/;
  /* 공직자통합메일(korea.kr) 등 메일 하단에 자동 삽입되는 정책뉴스 배너 문구 제거 */
  var GOV_BANNER_STRIP_RE = /공무원\s*[‘'""「]?\s*직장\s*내\s*괴롭힘\s*[’'""」]?\s*피해도[\s\S]*$/i;
  /* 개인 민감 서류(급여·주민번호·계좌) — 목록에는 표시하되 자동 열람 경고 */
  var PRIV_RE = /급여\s*대장|임금\s*대장|원천\s*징수|주민등록|신분증|통장\s*사본|연말\s*정산|4대\s*보험\s*명부/;

  /* 괴롭힘·성희롱 조사 직접 신호 (단독 영업비밀·입사 비밀유지서약서는 제외하고 조사·고충 맥락이 있는 신호만 채택) */
  var HARASS_SIGNAL_RE = /직장\s*내\s*괴롭힘|직장내괴롭힘|직괴|직장\s*내\s*성희롱|직장내성희롱|직장\s*괴롭힘|괴롭힘\s*조사|성희롱\s*조사|괴롭힘\s*신고|성희롱\s*신고|성희롱\s*사건|성희롱\s*발언|성희롱\s*징계|고충\s*조사|고충\s*심의|고충\s*처리|피해\s*근로자\s*보호|피신고인|신고인\s*면담|행위자\s*면담|(?:조사|면담|고충|괴롭힘|성희롱)[^\n]{0,24}비밀\s*유지\s*서약|비밀\s*유지\s*서약[^\n]{0,24}(?:조사|면담|고충|괴롭힘|성희롱)|조사\s*결과\s*보고서|외부\s*전문가\s*조사|조사\s*위원\s*위촉|진상\s*조사\s*보고|성폭력\s*상담|(?:소장|고충|사내|신고)\s*(?:관련\s*)?["'「]?조사\s*보고서/;
  /* 기등록 조사 사건의 업체와 주고받은 보조 진행 서류 신호 */
  var CASE_DOC_SIGNAL_RE = /공문|조사|면담|출석|진술|문답|소명|경위서|서약서|동의서|녹취|증거|호증|설문|실태|보고서|의견서|인사위원회|징계|보호\s*조치|위임|계약서|견적서/;
  /* 추정 외부 이메일(2차 확장)에서 허용할 조사 핵심 진행 서류 신호 */
  var INFERRED_STEP_RE = /위임\s*계약|위임\s*약정|서면\s*진술|문답서|소명서|의견서|결과\s*보고|기한\s*연장|징계|고충\s*처리|심의\s*위원회|감사실|실태\s*조사|추가\s*자료\s*제출|녹취/;
  /* 공공기관 감독관·위원회·협업 노무법인 메일은 의뢰인 고유 이메일 자동확장 대상에서 제외 */
  var NON_CLIENT_ADDR_RE = /(?:@(?:korea\.kr|korea\.co\.kr|mail\.go\.kr|hrdkorea\.or\.kr|kcplaa\.or\.kr)$|^(?:labor1002|ourlabor|thlabor)@)/i;

  var NOTE_START = '── [괴롭힘·성희롱 조사 자동연동] ──';
  var NOTE_END   = '── [/괴롭힘·성희롱 조사 자동연동] ──';
  var DAY_MS = 86400000;

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o || {}, k); }
  function okId(k) { return typeof k === 'string' && !!k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && !/[.#$\/\[\]]/.test(k); }
  function safeKey(s) { return str(s).replace(/[^\uAC00-\uD7A3A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 120) || 'item'; }
  function digits(v) { return str(v).replace(/\D/g, ''); }

  function rowsOf(v) {
    var x = obj(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(function (r) { return obj(r) && !r._deleted; });
    if (obj(x)) return Object.keys(x).map(function (k) { return x[k]; }).filter(function (r) { return obj(r) && !r._deleted; });
    return [];
  }

  function ymdOf(msOrStr) {
    var s = str(msOrStr);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var n = Number(msOrStr);
    if (!isFinite(n) || n <= 0 || n > 8640000000000000 - 9 * 3600000) return '';
    var d = new Date(n + 9 * 3600000);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  function parseYmdMs(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(ymd));
    if (!m) return 0;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - 9 * 3600000;
  }

  function parseAddrs(raw) {
    var out = [];
    var s = str(raw).toLowerCase();
    if (!s) return out;
    var re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g;
    var m;
    while ((m = re.exec(s))) {
      if (out.indexOf(m[0]) < 0) out.push(m[0]);
    }
    return out;
  }

  function domainOf(addr) {
    var a = str(addr).toLowerCase();
    var i = a.lastIndexOf('@');
    return i < 0 ? '' : a.slice(i + 1);
  }

  function isPrivateDomain(dom) {
    var d = str(dom).toLowerCase();
    if (!d || PUB_DOMAINS[d]) return false;
    if (/pureun\.kr$/i.test(d)) return false;
    /* 정부 공용 메일(korea.kr)은 여러 지자체·기관이 함께 쓰므로 단일 업체 도메인으로 보지 않음 */
    if (d === 'korea.kr' || d === 'mail.go.kr') return false;
    return true;
  }

  function coNameNorm(name) {
    var s = str(name);
    if (!s) return '';
    s = s.replace(/\((주|유|합|사|재|학|의)\)|주식회사|유한회사|사단법인|재단법인|학교법인|의료법인|사회복지법인/g, ' ');
    s = s.replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, '').toLowerCase();
    return s;
  }

  /* 사업장 약칭·핵심명 정규화 (예: '(주)가나점검장항공장' -> '가나점검', '국공립푸른어린이집' -> '푸른어린이집') */
  function coCoreNorm(name) {
    var c = coNameNorm(name);
    if (!c) return '';
    var s = c.replace(/^(?:국공립|공립|시립|구립|도립|군립|민간|가정|부설)/, '');
    var s2 = s.replace(/(?:[가-힣]{1,2}(?:공장|지점|지사|사업소|물류센터|사업장)|본사|공장|지점|지사)$/, '');
    if (s2.length >= 2) return s2;
    if (s.length >= 2) return s;
    return c;
  }

  /* 주민등록번호 패턴 가림 — 하이픈·물결표 유무 및 PDF 스팬 분절 공백('900101- 123 4567' 등)까지 모두 가린다 */
  var RRN_REPLACE_RE = /(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-~–—]\s*)?([1-8])\d{6}(?!\d)/g;
  var RRN_SPACED_REPLACE_RE = /(^|[^\d])((?:\d\s*){2}(?:0\s*[1-9]|1\s*[0-2])(?:0\s*[1-9]|[12]\s*\d|3\s*[01]))\s*[-~–—]\s*([1-8])(?:\s*\d){6}(?!\s*\d)/g;
  var RRN_TEST_RE = /(?:^|[^\d])(?:\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:\s*[-~–—]\s*)?[1-8]\d{6}(?!\d)|(?:\d\s*){2}(?:0\s*[1-9]|1\s*[0-2])(?:0\s*[1-9]|[12]\s*\d|3\s*[01])\s*[-~–—]\s*[1-8](?:\s*\d){6}(?!\s*\d))/;

  function maskRrnText(text) {
    var s = String(text == null ? '' : text);
    return s
      .replace(RRN_REPLACE_RE, '$1$2-$3******')
      .replace(RRN_SPACED_REPLACE_RE, function (_, pre, front, gender) {
        return pre + String(front).replace(/\s+/g, '') + '-' + gender + '******';
      });
  }

  function hasUnmaskedRrn(text) {
    return RRN_TEST_RE.test(String(text == null ? '' : text));
  }

  /* 비밀유지 열람 권한: 대표(isAdmin) 또는 해당 사건의 주담당(managerMain)·부담당(managerSubs 앞 5명) */
  function canAccessSecret(caseRec, me) {
    if (!obj(me) || !str(me.sid)) return false;
    if (me.isAdmin === true || me.role === 'admin') return true;
    if (!obj(caseRec)) return false;
    var mySid = str(me.sid);
    if (str(caseRec.managerMain) && str(caseRec.managerMain) === mySid) return true;
    var subs = Array.isArray(caseRec.managerSubs) ? caseRec.managerSubs.slice(0, 5) : [];
    for (var i = 0; i < subs.length; i++) {
      if (str(subs[i]) === mySid) return true;
    }
    return false;
  }

  /* 조사 종류 판별: 괴롭힘 / 성희롱 / 복합 */
  function inferCategory(text) {
    var t = str(text);
    var hasH = /괴롭힘|직괴|갑질|폭언|따돌림/.test(t);
    var hasS = /성희롱|성폭력|성적\s*언동|성비위/.test(t);
    if (hasH && hasS) return 'both';
    if (hasS) return 'sexual';
    return 'harass';
  }

  /* 메일 제목·첨부 이름 → 문서 역할 및 자동 연결 단계 */
  function classifyDocRole(subject, attNames, preview, isSent) {
    var s = str(subject);
    var an = Array.isArray(attNames) ? attNames.map(str).join(' ') : str(attNames);
    var head = s + ' ' + an;
    var full = head + ' ' + str(preview);

    /* 빈 서식·예시 파일, 제출기한 연장, 행정기관 개선지도 착수 공문은 최종보고서(8단계)로 오탐하지 않음 */
    var isBlankForm = /(?:보고서?|문답서|진술서|신고서)\s*(?:서식|양식)|\((?:예시|서식|양식)\)|\[(?:서식|양식)\]/.test(head);
    var isGovOrderOrExt = /기한\s*연장|연장\s*신청|연장\s*안내|(?:노동청|고용노동부|지청)[^\n]{0,36}개선\s*지도|개선\s*지도\s*(?:송부|공문|입니다|통보|안내)|시정\s*지도\s*(?:송부|공문|통보)/.test(head);
    var isReviewOrDraft = /초안|검토본|수정안|가안|검토\s*(?:요청|부탁|의뢰)|봐주|의견\s*조회|법리\s*검토|사실\s*확인표|보고서\s*안/.test(head);

    if (isGovOrderOrExt) {
      return DOC_ROLES.official_plan;
    }
    if (!isBlankForm && !isReviewOrDraft) {
      var hasFinalReportKw = /최종\s*(?:조사\s*)?보고|조사\s*결과\s*보고서|결과\s*보고서\s*(?:제출|송부|전달)|개선\s*(?:지도\s*)?결과\s*보고|징계\s*처분|인사위원회\s*결과|사건\s*처리\s*결과|조치\s*결과|신고\s*결과\s*보고|조사\s*자료\s*취합본\s*\(?최종\)?|정식\s*조사\s*종료/.test(head);
      var hasSentReportKw = !!isSent && /(?:조사\s*보고서|괴롭힘\s*보고서|성희롱\s*보고서|의견서[_\s]*(?:최종|수정본))/.test(head);
      if (hasFinalReportKw || hasSentReportKw) {
        return DOC_ROLES.final_report;
      }
    }
    if (isReviewOrDraft) {
      return DOC_ROLES.draft_review;
    }
    if (/견적서|위임\s*계약|위임\s*약정|용역\s*계약|수임|과업\s*지시|제안서|위임장\s*(?:송부|날인)/.test(head)) {
      return DOC_ROLES.quote_contract;
    }
    if (/비밀\s*유지|서약서|개인정보\s*동의|분리\s*조치|보호\s*조치|유급\s*휴가|근무\s*장소\s*변경/.test(head)) {
      return DOC_ROLES.pledge_protect;
    }
    if (/조사\s*계획|착수\s*공문|조사위원\s*위촉|출석\s*요구|면담\s*일정|조사\s*일정|조사\s*안내|업무\s*의뢰\s*요청/.test(head)) {
      return DOC_ROLES.official_plan;
    }
    if (/피신고인|행위자|피진정인|소명서|답변서|반박|경위서/.test(head)) {
      return DOC_ROLES.accused_stmt;
    }
    if (/신고서|고충\s*접수|피해자|신고인|진정인|피해\s*진술|주장\s*요약/.test(head)) {
      return DOC_ROLES.victim_stmt;
    }
    if (!isBlankForm && /참고인|목격자|녹취|호증|증거|설문|실태\s*조사|진술서|문답서|사실\s*확인서/.test(full)) {
      return DOC_ROLES.witness_evid;
    }
    if (isBlankForm) {
      return DOC_ROLES.official_plan;
    }
    if (/공문|협조\s*요청|자료\s*제출|의견서/.test(head)) {
      return isSent ? DOC_ROLES.official_plan : DOC_ROLES.general;
    }
    return DOC_ROLES.general;
  }

  function stripMailBannerNoise(text) {
    return str(text).replace(GOV_BANNER_STRIP_RE, ' ');
  }

  function cleanMailDisplayName(raw) {
    var s = str(raw);
    if (!s) return '';
    /* "홍길동" <a@b.com> 형태에서 꺾쇠 주소 제거 */
    s = s.replace(/<[^>]*>/g, ' ').replace(/^["'‘’“”\s]+|["'‘’“”\s]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!s || /@/.test(s)) return '';
    return s;
  }

  /* 제목·첨부·상대방 표시이름·본문 미리보기에서 한국어 기관/회사 이름 추출 */
  var ORG_NOISE_EXACT_RE = /^(?:fw|fwd|re|sv|회신|답장|전달|재송부|재발송|재전송|대외비|극비|기밀|비밀|긴급|필독|중요|공지|공문|안내|알림|참고|참고용|확인|확인요망|검토|검토요망|자문|자문요청|문의|업무협조|협조요청|서식|양식|초안|수정|수정본|최종|최종본|최종보고|별첨|붙임|첨부|개정|신규|감사메일|자동회신|부재중|결혼|부음|전자세금계산서|세금계산서|푸른노무법인|푸른노무|공인노무사|노무법인|직장내괴롭힘|직장내성희롱|괴롭힘조사|성희롱조사|조사결과보고서|조사보고서|진상조사보고서|비밀유지서약서|위임계약서|위임약정서|견적서|문답서|진술서|소명서|경위서|의견서|내용증명|신고인|피신고인|피해자|피해근로자|행위자|가해자|참고인|진정인|피진정인|신청인|피신청인|근로자|사용자|사업주|경영지원|경영지원팀|경영지원실|경영지원부|경영지원본부|경영관리|경영관리팀|인사|인사팀|인사부|인사총무팀|총무|총무팀|관리|관리팀|법무|법무팀|재무|재무팀|회계|회계팀|기획|기획팀|감사|감사팀|감사실|윤리경영실|운영지원팀|근로개선지도팀|현장클리닉|기술보호|기술보호서식|강의자료|교육자료)$/i;
  var ORG_CASE_NO_NOISE_RE = /^(?:[가-힣]{0,4}\d{0,4}(?:부해|부노|차별|단협)\d+|접수번호\d*|iso\d+|esg경영|aeo|hr|ir|pr|qa|qc|tf|tft)$/i;
  var KOREAN_INST_RE = /((?:주식회사|유한회사|합자회사|재단법인|사단법인|사회복지법인|학교법인|의료법인)\s*[가-힣0-9]{2,18}|(?:\(주\)|㈜|\(유\)|\(재\)|\(사\))\s*[가-힣A-Za-z0-9]{2,18}|[가-힣A-Za-z0-9]{2,18}\s*(?:주식회사|\(주\)|㈜|\(유\))|(?:국공립|공립|시립|구립|도립)?\s*[가-힣]{2,16}(?:대학교\s*산학협력단|대학교\s*인권센터|교육대학교|대학교|대학|지방고용노동청\s*[가-힣]{2,6}지청|지방고용노동청|고용노동청|지방중소벤처기업청|시설관리공단|산업인력공단|국제협력단|과학기술연구회|연구회|여성정책개발원|연구원|개발원|개발공사|전력공사\s*[가-힣]{2,6}본부|전력공사|철도공사|청화공사|경제진흥원|정보문화산업진흥원|진흥원|어린이인성학습원|인성학습원|사회서비스원|복지재단|문화복지센터|노인종합복지관|종합복지관|복지관|성폭력상담소|상담소|새마을금고|중앙신협|신협|산림조합|어린이집|유치원|산부인과의원|산부인과|정형외과의원|병원|의원|쉼터|요양원|호텔관리단|노사민정협의회|노동권익센터))/;

  function extractOrgName(subject, attNames, peerName, previewText) {
    var an = Array.isArray(attNames) ? attNames : (str(attNames) ? [str(attNames)] : []);
    var sources = [str(subject)].concat(an.map(str));

    function cleanCand(raw) {
      var c = str(raw)
        .replace(/^(?:RE|FW|FWD|SV|회신|전달)\s*[:：]\s*/gi, '')
        .replace(/@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ')
        .replace(/\b20\d{2}[._-]?\d{0,2}[._-]?\d{0,2}\b/g, ' ')
        .replace(/\b\d{6,8}\b/g, ' ')
        .replace(/\.(hwp|hwpx|pdf|docx?|xlsx?|pptx?|pptm|zip|jpg|jpeg|png)$/i, '')
        .replace(/(?:견적서|위임계약서|위임약정서|용역계약서|조사결과보고서|조사보고서|진상조사보고서|완료보고서|착수공문|비밀유지서약서|비밀유지서약|정보보호서약서|윤리경영서약서|청렴의무준수서약서|문답서|진술서|소명서|의견서|직장\s*내\s*괴롭힘|직장내괴롭힘|직장\s*내\s*성희롱|직장내성희롱|성희롱|괴롭힘|자문의뢰|자문요청|조사위원|위촉|외부전문가|인사노무|컨설팅|초안|최종본|최종|수정본|수정|검토|회신|송부의\s*건|제출의\s*건|요청의\s*건|송부|제출|요청|관련|\s+및|\s+건)$/g, ' ')
        .replace(/[_\-·•]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      c = c.replace(/\s+(?:직장|괴롭힘|성희롱|고충|조사|자문|관련|건|송부|제출|요청).*$/, '').trim();
      if (c.length < 2 || c.length > 28) return '';
      if (/푸른노무|370-6/.test(c)) return '';
      var compact = c.replace(/\s+/g, '');
      if (ORG_NOISE_EXACT_RE.test(compact) || ORG_CASE_NO_NOISE_RE.test(compact)) return '';
      if (/^\d+$/.test(compact)) return '';
      /* 한글이 전혀 없는 짧은 영문 머리말(FW, RE, BNK, HR 등)은 회사명으로 채택하지 않음 */
      if (!/[가-힣]/.test(c) && c.length <= 6) return '';
      if (/@|https?:\/\//i.test(c)) return '';
      return c;
    }

    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      if (!src) continue;
      /* 1) 대괄호 [기관명] — 앞머리에 [RE]·[FW]·[대외비]가 있어도 뒤의 실제 [기관명]까지 모두 확인 */
      var brRe = /\[([^\[\]]{2,30})\]/g;
      var mBr;
      while ((mBr = brRe.exec(src))) {
        var cb = cleanCand(mBr[1]);
        if (cb && /[가-힣]/.test(cb)) return cb;
      }
      /* 2) [대외비](주)가나테크_... 처럼 대괄호 바로 뒤에 붙은 법인·기관명 */
      var afterBr = src.replace(/^(?:\s*(?:RE|FW|FWD)\s*[:：]\s*|\s*\[[^\[\]]{1,16}\]\s*)+/i, '');
      var mLeadCorp = /^((?:\(주\)|㈜|\(유\)|\(재\)|\(사\)|주식회사|유한회사|재단법인|사단법인|합자회사)\s*[가-힣A-Za-z0-9]{2,18}|[가-힣A-Za-z0-9]{2,18}(?:\(주\)|㈜|\(유\)))/.exec(afterBr);
      if (mLeadCorp) {
        var clc = cleanCand(mLeadCorp[1]);
        if (clc) return clc;
      }
      /* 3) 파일명·제목 밑줄 패턴: 견적서(직장내괴롭힘)_기관명_250423 또는 완료보고서_기관명 */
      var mUnder = /(?:견적서|계약서|약정서|보고서|공문|조사|서약서)[^_]*_([가-힣A-Za-z0-9()㈜\s]{2,25}?)(?:_\d{2,8}|_v\d+|\.[a-z0-9]{2,4}|$)/i.exec(src);
      if (mUnder) {
        var cu = cleanCand(mUnder[1]);
        if (cu && /[가-힣]/.test(cu)) return cu;
      }
      /* 4) 괄호 패턴: 조사보고서(기관명) — 단 (신고인)·(피신고인)·(초안)은 cleanCand 에서 자동 제외 */
      var parenRe = /(?:견적서|계약서|보고서|조사|자문\s*요청)\s*[（(]([^()（）]{2,25})[)）]/g;
      var mParen;
      while ((mParen = parenRe.exec(src))) {
        var cp = cleanCand(mParen[1]);
        if (cp && /[가-힣]/.test(cp)) return cp;
      }
      /* 5) 제목·첨부 안의 명확한 한국어 법인·공공기관·학교·어린이집·조합 명칭 */
      var mInst = KOREAN_INST_RE.exec(afterBr);
      if (mInst) {
        var ci = cleanCand(mInst[1]);
        if (ci) return ci;
      }
    }

    /* 6) 상대방 표시 이름 안의 소속: '홍길동/인사(경영지원)/한국상하수도협회' 또는 '홍길동(한국상하수도협회)' */
    var pn = cleanMailDisplayName(peerName);
    if (pn && !/푸른노무/.test(pn)) {
      if (pn.indexOf('/') >= 0) {
        var slashParts = pn.split('/').map(str).filter(Boolean);
        for (var sp = slashParts.length - 1; sp >= 0; sp--) {
          var spPart = slashParts[sp].replace(/[（(][^()（）]*[)）]/g, ' ').trim();
          var csp = cleanCand(spPart);
          if (csp && /[가-힣]/.test(csp) && sp > 0) return csp;
        }
      }
      var pRe = /[（(]([^)）]{2,25})[)）]/g;
      var mp2;
      while ((mp2 = pRe.exec(pn))) {
        var cp2 = cleanCand(mp2[1]);
        if (cp2 && /[가-힣]/.test(cp2)) return cp2;
      }
      if (/협회|병원|의원|센터|공단|공사|재단|대학교|대학|산학협력단|금고|신협|조합|시청|군청|구청|노동청|지청|기업청|주식회사|합자회사|\(주\)|㈜|\(유\)|\(재\)|위원회|연구회|연구원|개발원|진흥원|학습원|복지관|어린이집|유치원|상담소|쉼터|요양원|관리단|노무법인|컨설팅/.test(pn)) {
        var cp3 = cleanCand(pn);
        if (cp3) return cp3;
      }
    }

    /* 7) 본문 미리보기(preview) 자기소개·수신처 표기에서 한국어 기관명 추출 */
    var pv = stripMailBannerNoise(previewText);
    if (pv) {
      var mLabel = /(?:회사명|사업장명|기관명|업체명|소속)\s*[:：]\s*([가-힣0-9()㈜\s]{2,24})/.exec(pv);
      if (mLabel) {
        var clb = cleanCand(mLabel[1]);
        if (clb) return clb;
      }
      var mIntroInst = KOREAN_INST_RE.exec(pv.slice(0, 220));
      if (mIntroInst) {
        var cii = cleanCand(mIntroInst[1]);
        if (cii) return cii;
      }
      var mHello = /(?:안녕하세요|안녕하십니까)[,.!\s]*(?:노무사님[,.!\s]*)?([가-힣0-9()㈜]{2,18})\s+(?:[가-힣]{2,10}(?:팀|부|실|과|처|국|센터|본부)\s+)?[가-힣]{2,4}\s*(?:입니다|드림|올림|배상|과장|차장|부장|팀장|대리|주임|사원|실장|본부장|센터장|원장|소장|국장|처장|이사|상무|전무|대표|위원|연구원|계장|주무관|감독관|프로|매니저|책임|선임)/.exec(pv);
      if (mHello) {
        var ch = cleanCand(mHello[1]);
        if (ch) return ch;
      }
    }
    return '';
  }

  function mailFp(fromAddr, toAddrs, ts, subject, attNames) {
    var sNorm = str(subject).replace(/\s+/g, ' ').toLowerCase().slice(0, 120);
    var tNorm = Array.isArray(toAddrs)
      ? toAddrs.map(function (a) { return str(a).toLowerCase(); }).sort().join(',')
      : str(toAddrs).toLowerCase();
    var aNorm = Array.isArray(attNames)
      ? attNames.map(function (a) { return str(a).toLowerCase(); }).sort().join('|')
      : '';
    var secSlot = ts > 0 ? String(Math.round(ts / 2000)) : '0';
    return str(fromAddr).toLowerCase() + '|' + tNorm + '|' + secSlot + '|' + sNorm + '|' + aNorm;
  }

  /* 메일함 폴더(IMAP) + 지난메일(POP3 mailbox/old/msgs) → 중복 제거·평탄화된 메일 행 배열 */
  function flattenMailbox(folders, msgsBySlug, oldMsgsMap) {
    var out = [];
    var imapFpSet = {};
    if (obj(folders) && obj(msgsBySlug)) {
      Object.keys(folders).forEach(function (slug) {
        var f = folders[slug];
        if (!okId(slug) || !obj(f) || f.nomsg) return;
        var kind = str(f.kind || 'custom');
        if (BOX_KINDS.indexOf(kind) < 0) return;
        var box = msgsBySlug[slug];
        if (!obj(box) && !Array.isArray(box)) return;
        var isSent = (kind === 'sent' || kind === 'tome' || kind === 'sched');
        Object.keys(box).forEach(function (uidKey) {
          var m = box[uidKey];
          if (!obj(m)) return;
          var uid = str(m.u || uidKey);
          if (!uid) return;
          var fromAddrs = parseAddrs(m.e || m.f);
          var toAddrs = parseAddrs(m.t);
          var fromAddr = fromAddrs[0] || '';
          if (!isSent && NOREPLY_RE.test(fromAddr)) return;
          /* 내부 직원끼리 주고받은 순수 내부 메일은 제외하되 고객 주소가 함께 있으면 포함 */
          var extAddrs = (isSent ? toAddrs : fromAddrs.concat(toAddrs)).filter(function (a) { return !OWN_RE.test(a); });
          var an = Array.isArray(m.an) ? m.an.map(str).filter(Boolean) : [];
          var ts = Number(m.d) || 0;
          if (ts > 0 || str(m.s)) imapFpSet[mailFp(fromAddr, toAddrs, ts, m.s, an)] = 1;
          var fDisp = cleanMailDisplayName(m.f);
          var tDisp = cleanMailDisplayName(m.tn) || cleanMailDisplayName(m.t);
          out.push({
            key: 'i:' + slug + ':' + uid,
            slug: slug,
            uid: uid,
            old: false,
            folderKind: kind,
            dir: isSent ? 'out' : 'in',
            ts: ts,
            date: ymdOf(ts),
            fromName: fDisp,
            fromAddr: fromAddr,
            toAddr: toAddrs.join(', '),
            toName: tDisp,
            extAddrs: extAddrs,
            subject: str(m.s),
            preview: str(m.p),
            attCount: Number(m.a) || an.length,
            attNames: an
          });
        });
      });
    }

    var oldBox = obj(oldMsgsMap) && oldMsgsMap.v !== undefined ? oldMsgsMap.v : oldMsgsMap;
    if (obj(oldBox) || Array.isArray(oldBox)) {
      Object.keys(oldBox).forEach(function (uidKey) {
        var m = oldBox[uidKey];
        if (!obj(m) || m._deleted) return;
        var uid = str(m.u || uidKey);
        if (!uid) return;
        var fromAddrs = parseAddrs(m.e || m.f);
        var toAddrs = parseAddrs(m.t);
        var fromAddr = fromAddrs[0] || '';
        var isSent = OWN_RE.test(fromAddr);
        if (!isSent && NOREPLY_RE.test(fromAddr)) return;
        var an = Array.isArray(m.an) ? m.an.map(str).filter(Boolean) : [];
        var ts = Number(m.d) || 0;
        var fp = mailFp(fromAddr, toAddrs, ts, m.s, an);
        if ((ts > 0 || str(m.s)) && imapFpSet[fp]) return;
        var extAddrs = (isSent ? toAddrs : fromAddrs.concat(toAddrs)).filter(function (a) { return !OWN_RE.test(a); });
        var fDispOld = cleanMailDisplayName(m.f);
        var tDispOld = cleanMailDisplayName(m.tn) || cleanMailDisplayName(m.t);
        out.push({
          key: 'p:' + uid,
          slug: '*old',
          uid: uid,
          old: true,
          folderKind: 'old',
          dir: isSent ? 'out' : 'in',
          ts: ts,
          date: ymdOf(ts),
          fromName: fDispOld,
          fromAddr: fromAddr,
          toAddr: toAddrs.join(', '),
          toName: tDispOld,
          extAddrs: extAddrs,
          subject: str(m.s),
          preview: str(m.p),
          attCount: Number(m.a) || an.length,
          attNames: an
        });
      });
    }

    out.sort(function (a, b) { return (b.ts - a.ts) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); });
    return out;
  }

  /* 업체 마스터 목록 + 선택적 기업정보함 명함 색인(pucards/idx 또는 items)에서 이메일·도메인·사업자번호·정규화이름 색인 구축 */
  function buildCompanyDirectory(companiesRaw, cardsRaw) {
    var list = rowsOf(companiesRaw);
    var byId = {}, byAddr = {}, byDomain = {}, byBiz = {}, byName = {}, byCore = {};
    var cardByAddr = {}, cardByDomain = {};
    list.forEach(function (co) {
      var id = str(co.id);
      if (!id) return;
      var addrs = [];
      ['email', 'primaryContactEmail', 'contactEmail', 'taxEmail'].forEach(function (f) {
        parseAddrs(co[f]).forEach(function (a) { if (addrs.indexOf(a) < 0) addrs.push(a); });
      });
      if (Array.isArray(co.contacts)) {
        co.contacts.forEach(function (ct) {
          if (obj(ct)) parseAddrs(ct.email).forEach(function (a) { if (addrs.indexOf(a) < 0) addrs.push(a); });
        });
      }
      var core = coCoreNorm(co.name);
      var entry = { id: id, rec: co, name: str(co.name), nameNorm: coNameNorm(co.name), coreNorm: core, bizNo: digits(co.bizNo), addrs: addrs };
      byId[id] = entry;
      if (entry.bizNo.length === 10 && !byBiz[entry.bizNo]) byBiz[entry.bizNo] = entry;
      if (entry.nameNorm) {
        if (!byName[entry.nameNorm]) byName[entry.nameNorm] = [];
        byName[entry.nameNorm].push(entry);
      }
      if (core && core.length >= 2) {
        if (!byCore[core]) byCore[core] = [];
        if (byCore[core].indexOf(entry) < 0) byCore[core].push(entry);
      }
      addrs.forEach(function (a) {
        if (!OWN_RE.test(a) && !byAddr[a]) byAddr[a] = entry;
        var dom = domainOf(a);
        if (isPrivateDomain(dom)) {
          if (!byDomain[dom]) byDomain[dom] = [];
          if (byDomain[dom].indexOf(entry) < 0) byDomain[dom].push(entry);
        }
      });
    });

    /* 기업정보함(명함·사업자등록증) 경량 색인(pucards/idx): 등록 업체 연결 및 미등록 외부기관 한국어 상호 파악 */
    var cardSrc = obj(cardsRaw) && obj(cardsRaw.idx) ? cardsRaw.idx : (obj(cardsRaw) && !Array.isArray(cardsRaw) && cardsRaw.items !== undefined ? {} : cardsRaw);
    var cardRows = rowsOf(cardSrc);
    var domCandNames = {};
    cardRows.forEach(function (card) {
      if (!obj(card)) return;
      var cName = str(card.company || card.c || card.co || '');
      if (!cName || /푸른노무/.test(cName) || /@/.test(cName)) return;
      var bz = digits(card.bizNo || card.bizno || card.bz || '').slice(0, 10);
      var cAddrs = parseAddrs(card.email || card.e || '');
      if (!cAddrs.length) return;

      var linkedEntry = null;
      if (bz.length === 10 && byBiz[bz]) {
        linkedEntry = byBiz[bz];
      } else {
        var cn = coNameNorm(cName);
        var cc = coCoreNorm(cName);
        if (cn && byName[cn] && byName[cn].length === 1) linkedEntry = byName[cn][0];
        else if (cc && cc.length >= 3 && byCore[cc] && byCore[cc].length === 1) linkedEntry = byCore[cc][0];
      }

      var cardInfo = { name: cName, bizNo: bz.length === 10 ? bz : '', companyEntry: linkedEntry };
      cAddrs.forEach(function (a) {
        if (OWN_RE.test(a)) return;
        if (linkedEntry && !byAddr[a]) byAddr[a] = linkedEntry;
        if (!cardByAddr[a]) cardByAddr[a] = cardInfo;
        var dom = domainOf(a);
        if (isPrivateDomain(dom)) {
          if (linkedEntry) {
            if (!byDomain[dom]) byDomain[dom] = [];
            if (byDomain[dom].indexOf(linkedEntry) < 0) byDomain[dom].push(linkedEntry);
          }
          if (!domCandNames[dom]) domCandNames[dom] = [];
          var normKey = coCoreNorm(cName) || coNameNorm(cName);
          if (normKey && !domCandNames[dom].some(function (x) { return (coCoreNorm(x.name) || coNameNorm(x.name)) === normKey; })) {
            domCandNames[dom].push(cardInfo);
          }
        }
      });
    });
    Object.keys(domCandNames).forEach(function (dom) {
      if (domCandNames[dom].length === 1) cardByDomain[dom] = domCandNames[dom][0];
    });

    return {
      list: list,
      byId: byId,
      byAddr: byAddr,
      byDomain: byDomain,
      byBiz: byBiz,
      byName: byName,
      byCore: byCore,
      cardByAddr: cardByAddr,
      cardByDomain: cardByDomain
    };
  }

  /* 한국어 기관명으로 업체 원장 단일 엔트리 역추적 */
  function resolveCompanyByOrgName(coDir, orgName) {
    if (!obj(coDir) || !str(orgName)) return null;
    var nm = coNameNorm(orgName);
    if (nm && coDir.byName && coDir.byName[nm] && coDir.byName[nm].length === 1) return coDir.byName[nm][0];
    var cr = coCoreNorm(orgName);
    if (cr && cr.length >= 3 && coDir.byCore && coDir.byCore[cr] && coDir.byCore[cr].length === 1) return coDir.byCore[cr][0];
    return null;
  }

  /* 메일 제목·본문·발신표시에서 담당 노무사 사번(sid) 자동 추론 */
  function inferManagerSidFromText(text, staffList) {
    var t = str(text);
    var staff = Array.isArray(staffList) ? staffList : [];
    if (!t || !staff.length) return '';
    var bestSid = '';
    var bestPos = Infinity;
    staff.forEach(function (st) {
      if (!obj(st) || !str(st.sid) || !str(st.name)) return;
      var nm = str(st.name).replace(/\s+/g, '');
      if (nm.length < 2) return;
      var escNm = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var reAtty = new RegExp(escNm + '\\s*(?:대표\\s*)?노무사');
      var m = reAtty.exec(t);
      if (m && m.index < bestPos) {
        bestPos = m.index;
        bestSid = str(st.sid);
      }
    });
    if (bestSid) return bestSid;
    staff.forEach(function (st) {
      if (!obj(st) || !str(st.sid) || !str(st.name)) return;
      var nm = str(st.name).replace(/\s+/g, '');
      if (nm.length < 2) return;
      var idx = t.indexOf(nm);
      if (idx >= 0 && idx < bestPos) {
        bestPos = idx;
        bestSid = str(st.sid);
      }
    });
    return bestSid;
  }

  /* 사업장명과 수집 메일 내용으로부터 깔끔한 한국어 조사 사건명('<회사이름> <사건내용> 조사') 생성 */
  function buildKoreanCaseTitle(companyName, catCode, mails, periodSuffix) {
    var co = str(companyName) || '의뢰 사업장';
    var cat = CATEGORIES[catCode] || CATEGORIES.harass;
    var joined = (Array.isArray(mails) ? mails : []).map(function (m) {
      if (!obj(m)) return '';
      var an = Array.isArray(m.attNames) ? m.attNames.join(' ') : str(m.attNames);
      return str(m.subject) + ' ' + an;
    }).join(' ');

    var topic = '';
    if (/재심의/.test(joined)) topic = cat.label + ' 재심의 사건 조사';
    else if (/재진정/.test(joined)) topic = cat.label + ' 재진정 사건 조사';
    else if (/전문위원|판단\s*전문/.test(joined)) topic = cat.label + ' 판단 전문위원회 사건 조사';
    else if (/고충\s*심의|고충\s*처리/.test(joined)) {
      topic = catCode === 'sexual' ? '성희롱·성폭력 고충심의 사건 조사' : '고충처리 및 ' + cat.label + ' 사건 조사';
    } else if (/징계\s*심의|인사위원회|징계\s*양형|징계\s*적정/.test(joined)) {
      topic = cat.label + ' 및 징계심의 사건 조사';
    } else if (/개선\s*지도|시정\s*지도/.test(joined)) {
      topic = cat.label + ' 개선지도 사건 조사';
    } else if (/부당\s*해고|부당\s*전보|부당\s*전직|구제\s*신청/.test(joined)) {
      topic = cat.label + ' 및 부당인사 사건 조사';
    } else if (/실태\s*조사/.test(joined)) {
      topic = cat.label + ' 실태조사 사건';
    } else {
      topic = cat.label + ' 사건 조사';
    }
    return co + ' ' + topic + (str(periodSuffix) ? (' (' + str(periodSuffix) + ')') : '');
  }

  /* 이알피 사건이 괴롭힘·성희롱·조사 사건인지 판별 */
  function isErpInvestigateCase(erpCase, caseTypesRaw) {
    if (!obj(erpCase) || erpCase._deleted) return false;
    var tc = str(erpCase.typeCode);
    if (tc === 'case-investigate') return true;
    var types = rowsOf(caseTypesRaw);
    var tObj = null;
    for (var i = 0; i < types.length; i++) {
      if (str(types[i].code) === tc) { tObj = types[i]; break; }
    }
    var typeLabel = tObj ? (str(tObj.name) + ' ' + str(tObj.short)) : str(erpCase.typeName);
    if (/조사|괴롭힘|성희롱/.test(typeLabel)) return true;
    var txt = str(erpCase.title) + ' ' + str(erpCase.brief) + ' ' + str(erpCase.caseNo);
    return /직장\s*내\s*괴롭힘|직장내괴롭힘|직괴|성,?\s*직괴|직장\s*내\s*성희롱|직장내성희롱|괴롭힘\s*조사|성희롱\s*조사|^조사-\d{4}/.test(txt);
  }

  /* 메일 1건을 조사 관련 문서 객체로 변환 (무관하면 null) */
  function inspectMailForHarass(mailRow, strictSignal) {
    if (!obj(mailRow)) return null;
    var attArr = Array.isArray(mailRow.attNames)
      ? mailRow.attNames.map(str).filter(Boolean)
      : (str(mailRow.attNames) ? [str(mailRow.attNames)] : []);
    var headText = str(mailRow.subject) + ' ' + attArr.join(' ');
    var cleanPreview = stripMailBannerNoise(mailRow.preview);
    var text = headText + ' ' + cleanPreview;
    if (NOISE_RE.test(text)) return null;
    if (EDU_ONLY_RE.test(headText) && !CASE_OVERRIDE_RE.test(headText)) return null;
    var hasDirect = HARASS_SIGNAL_RE.test(text) || !!mailRow.imapHit;
    var hasDocSig = CASE_DOC_SIGNAL_RE.test(text) || mailRow.attCount > 0;
    if (strictSignal ? !hasDirect : (!hasDirect && !hasDocSig)) return null;

    var role = classifyDocRole(mailRow.subject, attArr, cleanPreview, mailRow.dir === 'out');
    var priv = PRIV_RE.test(headText);
    return {
      key: mailRow.key,
      slug: mailRow.slug,
      uid: mailRow.uid,
      old: !!mailRow.old,
      dir: mailRow.dir,
      date: mailRow.date,
      ts: mailRow.ts,
      from: mailRow.fromName ? (mailRow.fromName + (mailRow.fromAddr ? ' <' + mailRow.fromAddr + '>' : '')) : mailRow.fromAddr,
      fromAddr: mailRow.fromAddr,
      to: mailRow.toName ? (mailRow.toName + (mailRow.toAddr ? ' <' + mailRow.toAddr + '>' : '')) : mailRow.toAddr,
      extAddrs: mailRow.extAddrs || [],
      subject: mailRow.subject,
      attCount: mailRow.attCount,
      attNames: attArr.slice(0, 5),
      docRole: role.code,
      docRoleLabel: role.label,
      stepCode: role.stepCode,
      category: inferCategory(text),
      isDirectSignal: hasDirect,
      isPrivacySensitive: priv,
      auto: true
    };
  }

  var MAX_CASE_MAILS = 300;
  var GENERIC_TITLE_WORDS = {
    '직장': 1, '내': 1, '괴롭힘': 1, '직장내괴롭힘': 1, '직괴': 1,
    '성희롱': 1, '직장내성희롱': 1, '복합': 1, '복합조사': 1, '조사': 1,
    '사건': 1, '사안': 1, '외부': 1, '전문가': 1, '외부전문가': 1,
    '의뢰': 1, '신고': 1, '접수': 1, '건': 1, '관련': 1, '대응': 1
  };

  /* 대용량 메일함(수만 통) 반복 스캔 병목 제거용 WeakMap 메모이제이션 (원본 객체 무변경 · 자동 GC) */
  var MAIL_ROW_MEMO = typeof WeakMap === 'function' ? new WeakMap() : null;
  var SHORT_TOKEN_RE_CACHE = Object.create(null);

  function cloneHarassMailInfo(info) {
    if (!info) return null;
    return Object.assign({}, info, {
      extAddrs: Array.isArray(info.extAddrs) ? info.extAddrs.slice() : [],
      attNames: Array.isArray(info.attNames) ? info.attNames.slice() : []
    });
  }

  function getMailRowMemo(row) {
    if (!MAIL_ROW_MEMO || !obj(row)) return null;
    var m = MAIL_ROW_MEMO.get(row);
    if (!m) {
      m = { strictDone: false, strictInfo: null, hayRaw: null, hayNorm: null };
      MAIL_ROW_MEMO.set(row, m);
    }
    return m;
  }

  function getCachedStrictHarassInfo(row) {
    var m = getMailRowMemo(row);
    if (!m) return inspectMailForHarass(row, true);
    if (!m.strictDone) {
      m.strictInfo = inspectMailForHarass(row, true);
      m.strictDone = true;
    }
    return cloneHarassMailInfo(m.strictInfo);
  }

  function getCachedRowHay(row) {
    var m = getMailRowMemo(row);
    if (!m) {
      var rawFallback = str(row.subject) + ' ' + (row.attNames || []).join(' ') + ' ' + (row.dir === 'out' ? str(row.toName) : str(row.fromName)) + ' ' + str(row.preview);
      return { hayRaw: rawFallback, hayNorm: coNameNorm(rawFallback) };
    }
    if (m.hayRaw === null) {
      m.hayRaw = str(row.subject) + ' ' + (row.attNames || []).join(' ') + ' ' + (row.dir === 'out' ? str(row.toName) : str(row.fromName)) + ' ' + str(row.preview);
      m.hayNorm = coNameNorm(m.hayRaw);
    }
    return m;
  }

  function hasNameToken(rawText, normToken, precomputedHayNorm) {
    if (!normToken || normToken.length < 2) return false;
    if (normToken.length >= 3) {
      var normed = typeof precomputedHayNorm === 'string' ? precomputedHayNorm : coNameNorm(rawText);
      return normed.indexOf(normToken) >= 0;
    }
    if (GENERIC_TITLE_WORDS[normToken]) return false;
    var re = SHORT_TOKEN_RE_CACHE[normToken];
    if (!re) {
      var esc = normToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp('(?:^|[^가-힣a-z0-9])' + esc + '(?:$|[^가-힣a-z0-9]|공장|지점|지사|본사|사건|조사)', 'i');
      SHORT_TOKEN_RE_CACHE[normToken] = re;
    }
    return re.test(str(rawText));
  }

  function extractCaseTokens(c) {
    if (!obj(c)) return [];
    var out = [];
    var cNorm = coNameNorm(c.companyName);
    var no = str(c.erpCaseNo);
    if (no && no.length >= 4) out.push(no.toLowerCase());
    var words = str(c.title).split(/[\s·,()[\]\/_-]+/);
    words.forEach(function (w) {
      var clean = w.replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, '').toLowerCase();
      if (clean.length < 2 || GENERIC_TITLE_WORDS[clean]) return;
      if (cNorm && (clean === cNorm || cNorm.indexOf(clean) >= 0)) return;
      if (out.indexOf(clean) < 0) out.push(clean);
    });
    return out;
  }

  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    var a1 = aStart > 0 ? aStart - 60 * DAY_MS : 0;
    var a2 = aEnd > 0 ? aEnd + 90 * DAY_MS : Infinity;
    var b1 = bStart > 0 ? bStart - 60 * DAY_MS : 0;
    var b2 = bEnd > 0 ? bEnd + 90 * DAY_MS : Infinity;
    return a1 <= b2 && b1 <= a2;
  }

  function findOverlappingSiblings(caseRec, peerCases) {
    if (!Array.isArray(peerCases) || !peerCases.length) return [];
    var cid = str(caseRec.id);
    var coId = str(caseRec.companyId);
    var cNorm = coNameNorm(caseRec.companyName);
    var s1 = parseYmdMs(caseRec.receiveDate), e1 = parseYmdMs(caseRec.closeDate);
    return peerCases.filter(function (p) {
      if (!obj(p) || p._deleted || str(p.id) === cid) return false;
      var sameCo = coId ? (str(p.companyId) === coId) : (!str(p.companyId) && cNorm.length >= 3 && coNameNorm(p.companyName) === cNorm);
      if (!sameCo) return false;
      return rangesOverlap(s1, e1, parseYmdMs(p.receiveDate), parseYmdMs(p.closeDate));
    });
  }

  function matchesCaseSpecifics(row, info, target, others) {
    var hay = (str(row.subject) + ' ' + (row.attNames || []).join(' ') + ' ' + str(row.preview)).toLowerCase();
    var myTokens = extractCaseTokens(target);
    var otherTokenSet = {};
    (others || []).forEach(function (o) {
      extractCaseTokens(o).forEach(function (t) { otherTokenSet[t] = 1; });
    });
    for (var i = 0; i < myTokens.length; i++) {
      var tk = myTokens[i];
      if (!otherTokenSet[tk] && hay.indexOf(tk) >= 0) return true;
    }
    var myCat = str(target.category || 'harass');
    if (info && info.category && info.category !== 'both' && myCat === info.category) {
      var otherSameCat = (others || []).some(function (o) { return str(o.category || 'harass') === myCat || str(o.category) === 'both'; });
      if (!otherSameCat && /성희롱|괴롭힘|직괴/.test(hay)) return true;
    }
    return false;
  }

  /* 사건의 이메일·도메인·시간 창과 메일 행 매칭 (동일 사업장 동시 사건 충돌 방지 포함) */
  function scanMailsForCaseInternal(caseRec, mailRows, coDir, peerCases) {
    if (!obj(caseRec) || !Array.isArray(mailRows)) return { items: [], ambiguous: [], truncated: 0 };
    var addrs = {};
    var doms = {};
    function addAddrList(arr) {
      (arr || []).forEach(function (a) {
        var cleanA = str(a).toLowerCase();
        if (!cleanA || OWN_RE.test(cleanA)) return;
        addrs[cleanA] = 1;
        var dm = domainOf(cleanA);
        if (isPrivateDomain(dm)) doms[dm] = 1;
      });
    }
    parseAddrs(caseRec.email).forEach(function (a) { addAddrList([a]); });
    if (Array.isArray(caseRec.contacts)) {
      caseRec.contacts.forEach(function (ct) { if (obj(ct)) addAddrList(parseAddrs(ct.email)); });
    }
    if (coDir && str(caseRec.companyId) && coDir.byId[str(caseRec.companyId)]) {
      addAddrList(coDir.byId[str(caseRec.companyId)].addrs);
    }
    var cNorm = coNameNorm(caseRec.companyName);
    var cCore = coCoreNorm(caseRec.companyName);
    var startMs = parseYmdMs(caseRec.receiveDate);
    var endMs = parseYmdMs(caseRec.closeDate);
    var fromBound = startMs > 0 ? (startMs - 60 * DAY_MS) : 0;
    var toBound = endMs > 0 ? (endMs + 90 * DAY_MS) : 0;

    var siblings = findOverlappingSiblings(caseRec, peerCases);
    var siblingManualKeys = {};
    siblings.forEach(function (sib) {
      (Array.isArray(sib.mailLinks) ? sib.mailLinks : []).forEach(function (ml) {
        if (obj(ml) && ml.key && ml.manual === true) siblingManualKeys[ml.key] = 1;
      });
    });

    var manualItems = [];
    var seen = {};
    /* 수동 연결된 메일은 개수 한도에 잘리지 않고 항상 보존 */
    (Array.isArray(caseRec.mailLinks) ? caseRec.mailLinks : []).forEach(function (ml) {
      if (obj(ml) && ml.key && ml.manual === true && !seen[ml.key]) {
        seen[ml.key] = 1;
        manualItems.push(ml);
      }
    });

    var autoItems = [];
    var ambiguous = [];
    mailRows.forEach(function (row) {
      if (!obj(row) || seen[row.key] || siblingManualKeys[row.key]) return;
      if (fromBound > 0 && row.ts > 0 && row.ts < fromBound) return;
      if (toBound > 0 && row.ts > 0 && row.ts > toBound) return;

      var addrHit = (row.extAddrs || []).some(function (a) { return !!addrs[a]; });
      var info = null;
      if (addrHit) {
        /* 주소가 정확히 일치하면 조사 보조 서류(공문·진술서·첨부)까지 폭넓게 수집 */
        info = inspectMailForHarass(row, false);
        if (!info) return;
      } else {
        /* 이름·도메인 매칭은 직접 조사 신호(strictSignal)가 있는 약 1~2% 메일에만 성립하므로 먼저 O(1) 캐시로 걸러 수백만 회 정규식 반복을 차단 */
        info = getCachedStrictHarassInfo(row);
        if (!info) return;
        var domHit = (row.extAddrs || []).some(function (a) { var d = domainOf(a); return d && !!doms[d]; });
        var nameHit = false;
        if (!domHit) {
          var hm = getCachedRowHay(row);
          if (hasNameToken(hm.hayRaw, cNorm, hm.hayNorm) || (cCore && cCore !== cNorm && hasNameToken(hm.hayRaw, cCore, hm.hayNorm))) {
            nameHit = true;
          }
        }
        if (!domHit && !nameHit) return;
      }

      if (siblings.length > 0) {
        var mySpec = matchesCaseSpecifics(row, info, caseRec, siblings);
        var sibSpec = siblings.some(function (sib) { return matchesCaseSpecifics(row, info, sib, [caseRec]); });
        if (sibSpec && !mySpec) return;
        if (!mySpec && !sibSpec) {
          seen[row.key] = 1;
          ambiguous.push(info);
          return;
        }
      }

      seen[row.key] = 1;
      autoItems.push(info);
    });

    /* 2차 확장: 업체 이메일이 마스터에 없더라도 1차 직접 매칭된 의뢰인 주소와의 동일 사건기간 후속 서류(문답서·소명서·보고서 등)를 자동 연결 */
    if (siblings.length === 0 && autoItems.length > 0) {
      var inferredAddrs = {};
      var inferredDoms = {};
      var minAutoTs = 0;
      var maxAutoTs = 0;
      autoItems.forEach(function (it) {
        var t = Number(it.ts) || 0;
        if (t > 0) {
          if (!minAutoTs || t < minAutoTs) minAutoTs = t;
          if (!maxAutoTs || t > maxAutoTs) maxAutoTs = t;
        }
        (it.extAddrs || []).forEach(function (a) {
          var cleanA = str(a).toLowerCase();
          if (!cleanA || OWN_RE.test(cleanA) || NOREPLY_RE.test(cleanA) || NON_CLIENT_ADDR_RE.test(cleanA) || addrs[cleanA]) return;
          if (coDir && coDir.byAddr[cleanA] && str(caseRec.companyId) && coDir.byAddr[cleanA].id !== str(caseRec.companyId)) return;
          inferredAddrs[cleanA] = 1;
          var dm = domainOf(cleanA);
          if (isPrivateDomain(dm) && (!coDir || !coDir.byDomain[dm] || coDir.byDomain[dm].length <= 1)) {
            inferredDoms[dm] = 1;
          }
        });
      });

      if (Object.keys(inferredAddrs).length > 0) {
        var p2From = fromBound > 0 ? fromBound : (minAutoTs > 0 ? minAutoTs - 45 * DAY_MS : 0);
        var p2To = toBound > 0 ? toBound : (maxAutoTs > 0 ? maxAutoTs + 120 * DAY_MS : 0);
        mailRows.forEach(function (row) {
          if (!obj(row) || seen[row.key] || siblingManualKeys[row.key]) return;
          if (p2From > 0 && row.ts > 0 && row.ts < p2From) return;
          if (p2To > 0 && row.ts > 0 && row.ts > p2To) return;
          var infAddr = (row.extAddrs || []).some(function (a) { return !!inferredAddrs[a]; });
          var infDom = !infAddr && (row.extAddrs || []).some(function (a) { var d = domainOf(a); return d && !!inferredDoms[d]; });
          if (!infAddr && !infDom) return;
          var p2Text = str(row.subject) + ' ' + (row.attNames || []).join(' ') + ' ' + str(row.preview);
          if (!HARASS_SIGNAL_RE.test(p2Text) && !(infAddr && INFERRED_STEP_RE.test(p2Text))) return;
          var info2 = inspectMailForHarass(row, false);
          if (!info2) return;
          seen[row.key] = 1;
          autoItems.push(info2);
        });
      }
    }

    autoItems.sort(function (a, b) { return ((Number(b.ts) || 0) - (Number(a.ts) || 0)); });
    var allowAuto = Math.max(0, MAX_CASE_MAILS - manualItems.length);
    var keptAuto = autoItems.slice(0, allowAuto);
    var truncated = Math.max(0, autoItems.length - keptAuto.length);
    var combined = manualItems.concat(keptAuto);
    combined.sort(function (a, b) { return ((Number(b.ts) || 0) - (Number(a.ts) || 0)); });
    return { items: combined, ambiguous: ambiguous, truncated: truncated };
  }

  function collectMailsForCase(caseRec, mailRows, coDir, peerCases) {
    return scanMailsForCaseInternal(caseRec, mailRows, coDir, peerCases).items;
  }

  function findAmbiguousCompanyMails(caseRec, mailRows, coDir, peerCases) {
    return scanMailsForCaseInternal(caseRec, mailRows, coDir, peerCases).ambiguous;
  }

  /* 수집된 메일 목록을 사건의 8단계 진행현황(steps)에 자동 반영 (manual 도장이 찍힌 단계는 보존) */
  function deriveStepsFromMails(currentSteps, mailLinks, receiveDate, closeDate) {
    var steps = {};
    STEPS.forEach(function (s) {
      var prev = (obj(currentSteps) && obj(currentSteps[s.code])) ? currentSteps[s.code] : {};
      steps[s.code] = {
        done: !!prev.done,
        date: str(prev.date),
        note: str(prev.note),
        srcMail: str(prev.srcMail),
        manual: !!prev.manual
      };
    });

    if (str(receiveDate) && !steps.intake.manual && !steps.intake.done) {
      steps.intake.done = true;
      steps.intake.date = str(receiveDate).slice(0, 10);
      if (!steps.intake.note) steps.intake.note = '사건 수임·접수 등록';
    }

    /* 오래된 메일부터 순서대로 훑어 첫 근거 일자를 잡는다 */
    var asc = (Array.isArray(mailLinks) ? mailLinks.slice() : []).sort(function (a, b) {
      return (Number(a.ts) || 0) - (Number(b.ts) || 0);
    });
    asc.forEach(function (ml) {
      if (!obj(ml) || !ml.stepCode || !steps[ml.stepCode]) return;
      var st = steps[ml.stepCode];
      if (st.manual) return;
      if (!st.done) {
        st.done = true;
        st.date = ml.date || st.date;
        st.srcMail = ml.key || '';
        st.note = '[' + (ml.dir === 'out' ? '발신' : '수신') + '] ' + str(ml.subject).slice(0, 60);
      } else if (!st.date && ml.date) {
        st.date = ml.date;
      }
    });

    if (str(closeDate) && !steps.report.manual && !steps.report.done) {
      steps.report.done = true;
      steps.report.date = str(closeDate).slice(0, 10);
      if (!steps.report.note) steps.report.note = '조사 종결 처리';
    }
    return steps;
  }

  /* 진행단계 요약: 완료 수, 퍼센트, 현재 대표 단계, 이알피 상태 코드 */
  function summarizeProgress(steps, closeDate) {
    var st = obj(steps) ? steps : {};
    var doneCount = 0;
    var highestIdx = -1;
    STEPS.forEach(function (def, idx) {
      if (st[def.code] && st[def.code].done) {
        doneCount++;
        highestIdx = idx;
      }
    });
    var pct = Math.round((doneCount / STEPS.length) * 100);
    var curDef = highestIdx >= 0 ? STEPS[highestIdx] : STEPS[0];
    var erpStatus = 'pending';
    if (str(closeDate) || (st.report && st.report.done)) erpStatus = 'closed';
    else if (st.review && st.review.done) erpStatus = 'judgment';
    else if (highestIdx >= 1) erpStatus = 'progress';
    return {
      doneCount: doneCount,
      totalCount: STEPS.length,
      progressPct: pct,
      currentStep: curDef.code,
      currentStepName: curDef.name,
      currentStepShort: curDef.short,
      erpStatus: erpStatus
    };
  }

  function earliestMailTs(links) {
    var minTs = 0;
    (Array.isArray(links) ? links : []).forEach(function (m) {
      if (!obj(m)) return;
      var t = Number(m.ts) || parseYmdMs(m.date);
      if (t > 0 && (!minTs || t < minTs)) minTs = t;
    });
    return minTs;
  }

  function latestMailTs(links) {
    var maxTs = 0;
    (Array.isArray(links) ? links : []).forEach(function (m) {
      if (!obj(m)) return;
      var t = Number(m.ts) || parseYmdMs(m.date);
      if (t > 0 && t > maxTs) maxTs = t;
    });
    return maxTs;
  }

  /* 미등록 조사 메일 자동 발굴 → 사건별·연도별 후보 묶음(Bundle) 생성 */
  function discoverUnregisteredBundles(mailRows, existingCases, coDir, dismissedMap, opts) {
    var o = obj(opts) ? opts : {};
    var staffList = Array.isArray(o.staffList) ? o.staffList : [];
    var linkedMailKeys = {};
    var existingByCoId = {};
    var existingByCore = {};
    (Array.isArray(existingCases) ? existingCases : []).forEach(function (c) {
      if (!obj(c) || c._deleted) return;
      (Array.isArray(c.mailLinks) ? c.mailLinks : []).forEach(function (m) {
        if (obj(m) && m.key) linkedMailKeys[m.key] = 1;
      });
      var ecStart = parseYmdMs(c.receiveDate) || earliestMailTs(c.mailLinks);
      var ecEnd = parseYmdMs(c.closeDate) || (ecStart > 0 ? Math.max(ecStart + 180 * DAY_MS, latestMailTs(c.mailLinks)) : 0);
      var cid = str(c.companyId);
      if (cid) {
        if (!existingByCoId[cid]) existingByCoId[cid] = [];
        existingByCoId[cid].push({ start: ecStart, end: ecEnd });
      }
      var cCore = coCoreNorm(c.companyName);
      if (cCore && cCore.length >= 3) {
        if (!existingByCore[cCore]) existingByCore[cCore] = [];
        existingByCore[cCore].push({ start: ecStart, end: ecEnd });
      }
    });

    /* 1단계: 미연결 직접 조사 신호 후보 메일만 먼저 추출하고, 그 후보들의 외부 주소·도메인에 대해서만 형제 메일 기관명 단서를 스캔 */
    var rowsArr = Array.isArray(mailRows) ? mailRows : [];
    var rowByKey = {};
    var candHits = [];
    var needSiblingAddr = {};
    var needSiblingDom = {};
    var hasSiblingTarget = false;

    rowsArr.forEach(function (row) {
      if (!obj(row) || linkedMailKeys[row.key]) return;
      var info = getCachedStrictHarassInfo(row);
      if (!info) return;
      if (row.key) rowByKey[row.key] = row;
      candHits.push({ row: row, info: info });
      (row.extAddrs || []).forEach(function (ea) {
        if (!ea || NON_CLIENT_ADDR_RE.test(ea)) return;
        needSiblingAddr[ea] = 1;
        hasSiblingTarget = true;
        var dm = domainOf(ea);
        if (isPrivateDomain(dm)) needSiblingDom[dm] = 1;
      });
    });

    var siblingOrgByAddr = {};
    var siblingDomCands = {};
    if (hasSiblingTarget) {
      rowsArr.forEach(function (r) {
        if (!obj(r)) return;
        var exts = Array.isArray(r.extAddrs) ? r.extAddrs : [];
        if (!exts.length) return;
        var relevant = false;
        for (var ei = 0; ei < exts.length; ei++) {
          var a0 = exts[ei];
          if (needSiblingAddr[a0] || needSiblingDom[domainOf(a0)]) { relevant = true; break; }
        }
        if (!relevant) return;
        var candOrg = extractOrgName(r.subject, r.attNames, r.dir === 'out' ? r.toName : r.fromName, r.preview);
        if (!candOrg || !/[가-힣]/.test(candOrg)) return;
        exts.forEach(function (ea) {
          if (!ea || NON_CLIENT_ADDR_RE.test(ea)) return;
          if (!siblingOrgByAddr[ea]) siblingOrgByAddr[ea] = candOrg;
          var dom = domainOf(ea);
          if (isPrivateDomain(dom)) {
            if (!siblingDomCands[dom]) siblingDomCands[dom] = [];
            var nk = coCoreNorm(candOrg) || coNameNorm(candOrg);
            if (nk && !siblingDomCands[dom].some(function (x) { return (coCoreNorm(x) || coNameNorm(x)) === nk; })) {
              siblingDomCands[dom].push(candOrg);
            }
          }
        });
      });
    }
    var siblingOrgByDom = {};
    Object.keys(siblingDomCands).forEach(function (dom) {
      if (siblingDomCands[dom].length === 1) siblingOrgByDom[dom] = siblingDomCands[dom][0];
    });

    var dis = obj(dismissedMap) ? dismissedMap : {};
    var rawGroups = {};

    candHits.forEach(function (hit) {
      var row = hit.row;
      var info = hit.info;

      var exts = row.extAddrs || [];
      /* 업체 식별: 1) 업체원장 이메일/도메인 → 2) 메일 본문·제목 한국어 기관명 → 3) 기업정보함(명함) → 4) 형제 메일 한국어 기관명 */
      var matchedCo = null;
      var cardMatch = null;
      if (coDir) {
        for (var i = 0; i < exts.length; i++) {
          var ea = exts[i];
          if (coDir.byAddr && coDir.byAddr[ea]) { matchedCo = coDir.byAddr[ea]; break; }
        }
        if (!matchedCo) {
          for (var j = 0; j < exts.length; j++) {
            var dom = domainOf(exts[j]);
            if (dom && coDir.byDomain && coDir.byDomain[dom] && coDir.byDomain[dom].length === 1) {
              matchedCo = coDir.byDomain[dom][0];
              break;
            }
          }
        }
        for (var ci = 0; ci < exts.length; ci++) {
          if (coDir.cardByAddr && coDir.cardByAddr[exts[ci]]) { cardMatch = coDir.cardByAddr[exts[ci]]; break; }
        }
        if (!cardMatch) {
          for (var cj = 0; cj < exts.length; cj++) {
            var cDom = domainOf(exts[cj]);
            if (cDom && coDir.cardByDomain && coDir.cardByDomain[cDom]) { cardMatch = coDir.cardByDomain[cDom]; break; }
          }
        }
      }

      var peerDisp = row.dir === 'out' ? row.toName : row.fromName;
      var extractedName = extractOrgName(row.subject, row.attNames, peerDisp, row.preview);
      if (!extractedName && cardMatch && str(cardMatch.name)) {
        extractedName = str(cardMatch.name);
      }
      if (!extractedName) {
        for (var si = 0; si < exts.length; si++) {
          if (siblingOrgByAddr[exts[si]]) { extractedName = siblingOrgByAddr[exts[si]]; break; }
        }
      }
      if (!extractedName) {
        for (var sj = 0; sj < exts.length; sj++) {
          var sDom = domainOf(exts[sj]);
          if (sDom && siblingOrgByDom[sDom]) { extractedName = siblingOrgByDom[sDom]; break; }
        }
      }

      if (!matchedCo && extractedName && coDir) {
        matchedCo = resolveCompanyByOrgName(coDir, extractedName);
      }
      if (!matchedCo && cardMatch && cardMatch.companyEntry) {
        matchedCo = cardMatch.companyEntry;
      }

      /* 법인·기관명이 확인되지 않은 경우 당사자·개인의 성명을 사업장명으로 노출하지 않고 공란 처리(묶음 표기는 '기타 조사 의뢰 사업장') */
      var companyId = matchedCo ? matchedCo.id : '';
      var companyName = matchedCo ? matchedCo.name : extractedName;
      var companyLinkStatus = companyId ? 'linked' : 'pending';

      /* 이미 같은 companyId 또는 같은 한국어 핵심 상호로 활성 조사 사건이 등록돼 있고 사건 기간이 겹치면 기존 사건 수집 대상이므로 제외 */
      if (companyId && existingByCoId[companyId]) {
        var overlapsExisting = existingByCoId[companyId].some(function (b) {
          if (!b.start || !row.ts) return true;
          return rangesOverlap(row.ts, row.ts, b.start, b.end);
        });
        if (overlapsExisting) return;
      }
      var candCore = coCoreNorm(companyName);
      if (!companyId && candCore && candCore.length >= 3 && existingByCore[candCore]) {
        var overlapsByName = existingByCore[candCore].some(function (b) {
          if (!b.start || !row.ts) return false;
          return rangesOverlap(row.ts, row.ts, b.start, b.end);
        });
        if (overlapsByName) return;
      }

      var baseKey = '';
      if (companyId) baseKey = 'co_' + safeKey(companyId);
      else if (companyName && coNameNorm(companyName).length >= 2) baseKey = 'nm_' + safeKey(coNameNorm(companyName));
      else if (exts && exts[0]) {
        var d0 = domainOf(exts[0]);
        baseKey = isPrivateDomain(d0) ? ('dom_' + safeKey(d0)) : ('addr_' + safeKey(exts[0]));
      } else {
        baseKey = 'msg_' + safeKey(row.slug + '_' + row.uid);
      }

      if (!rawGroups[baseKey]) {
        rawGroups[baseKey] = {
          baseKey: baseKey,
          companyId: companyId,
          companyLinkStatus: companyLinkStatus,
          companyName: companyName || '기타 조사 의뢰 사업장',
          bizNo: (matchedCo && matchedCo.rec && str(matchedCo.rec.bizNo)) || (cardMatch && str(cardMatch.bizNo)) || '',
          managerMain: (matchedCo && matchedCo.rec && str(matchedCo.rec.managerMain)) || '',
          entries: []
        };
      } else if (companyName && (rawGroups[baseKey].companyName === '기타 조사 의뢰 사업장' || / 의뢰 사업장$/.test(rawGroups[baseKey].companyName)) && !/ 의뢰 사업장$/.test(companyName)) {
        rawGroups[baseKey].companyName = companyName;
      }
      rawGroups[baseKey].entries.push(info);
    });

    var list = [];
    var usedBundleKeys = {};
    Object.keys(rawGroups).forEach(function (bk) {
      var rg = rawGroups[bk];
      var asc = rg.entries.slice().sort(function (a, b) {
        return ((Number(a.ts) || 0) - (Number(b.ts) || 0)) || (str(a.key) < str(b.key) ? -1 : 1);
      });
      if (!asc.length) return;

      /* 동일 의뢰처가 여러 해에 걸쳐 별개 조사 사건을 의뢰한 경우 사건 단위로 분리 (120일 초과 공백 또는 해가 바뀌며 45일 초과 공백) */
      var episodes = [[asc[0]]];
      for (var i = 1; i < asc.length; i++) {
        var prev = asc[i - 1];
        var cur = asc[i];
        var prevTs = Number(prev.ts) || 0;
        var curTs = Number(cur.ts) || 0;
        var prevYr = str(prev.date).slice(0, 4);
        var curYr = str(cur.date).slice(0, 4);
        var gap = (prevTs > 0 && curTs > 0) ? (curTs - prevTs) : 0;
        if (gap > 120 * DAY_MS || (prevYr && curYr && prevYr !== curYr && gap > 45 * DAY_MS)) {
          episodes.push([cur]);
        } else {
          episodes[episodes.length - 1].push(cur);
        }
      }

      var yrCounts = {};
      episodes.forEach(function (epMails) {
        var fDt = '';
        var lDt = '';
        epMails.forEach(function (m) {
          if (m.date && (!fDt || m.date < fDt)) fDt = m.date;
          if (m.date && (!lDt || m.date > lDt)) lDt = m.date;
        });
        var y = str(fDt || lDt).slice(0, 4) || '미상';
        yrCounts[y] = (yrCounts[y] || 0) + 1;
      });

      var yrSeq = {};
      episodes.forEach(function (epMails) {
        var cat = epMails[0].category || 'harass';
        var firstDate = '';
        var lastDate = '';
        var lastTs = 0;
        epMails.forEach(function (info) {
          if (info.category === 'both' || (cat !== info.category && cat !== 'both')) {
            if ((cat === 'harass' && info.category === 'sexual') || (cat === 'sexual' && info.category === 'harass') || info.category === 'both') {
              cat = 'both';
            }
          }
          if (info.date && (!firstDate || info.date < firstDate)) firstDate = info.date;
          if ((info.ts || 0) >= lastTs) {
            lastTs = info.ts || 0;
            if (info.date) lastDate = info.date;
          }
        });
        var epYear = str(firstDate || lastDate).slice(0, 4) || '미상';
        yrSeq[epYear] = (yrSeq[epYear] || 0) + 1;
        /* 앞선 에피소드가 사건 등록되더라도 뒤 에피소드의 열쇠가 흔들리지 않도록 에피소드 고유 시작일(또는 첫 메일 키)을 열쇠에 고정 */
        var epAnchor = digits(firstDate || lastDate) || safeKey(epYear + '_' + str(epMails[0] && epMails[0].key));
        var bKey = bk + '_' + epAnchor;
        if (usedBundleKeys[bKey]) {
          var dupIdx = 2;
          while (usedBundleKeys[bKey + '_' + dupIdx]) dupIdx++;
          bKey = bKey + '_' + dupIdx;
        }
        usedBundleKeys[bKey] = 1;
        if (dis[bKey] && !dis[bKey]._deleted) return;
        if (dis[bk] && !dis[bk]._deleted) {
          var disTs = Number(dis[bk].updatedAt || dis[bk].createdAt || 0);
          if ((disTs > 0 && lastTs > 0 && lastTs <= disTs + 7 * DAY_MS) || (!disTs && episodes.length === 1)) return;
        }

        var descMails = epMails.slice().sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); });
        var steps = deriveStepsFromMails({}, descMails, firstDate, '');
        var summary = summarizeProgress(steps, '');

        var mgrSid = rg.managerMain;
        if (!mgrSid && staffList.length) {
          var clueTxt = descMails.map(function (m) {
            var rawRow = rowByKey[m.key];
            return [m.subject, m.from, m.to, rawRow ? rawRow.preview : ''].join(' ');
          }).join('\n');
          mgrSid = inferManagerSidFromText(clueTxt, staffList);
        }

        var periodSuffix = '';
        if (episodes.length > 1 && /^20\d{2}$/.test(epYear)) {
          if (yrCounts[epYear] > 1) {
            var mm = Number(str(firstDate || lastDate).slice(5, 7)) || 0;
            var halfLbl = mm >= 7 ? '하반기' : mm >= 1 ? '상반기' : (yrSeq[epYear] + '차');
            periodSuffix = epYear + '년 ' + halfLbl + (yrCounts[epYear] > 2 ? ' ' + yrSeq[epYear] + '차' : '');
          } else {
            periodSuffix = epYear + '년';
          }
        }

        list.push({
          bundleKey: bKey,
          year: epYear,
          companyId: rg.companyId,
          companyLinkStatus: rg.companyLinkStatus,
          companyName: rg.companyName,
          bizNo: rg.bizNo,
          managerMain: mgrSid,
          category: cat,
          firstDate: firstDate,
          lastDate: lastDate,
          lastTs: lastTs,
          mails: descMails,
          steps: steps,
          summary: summary,
          suggestedTitle: buildKoreanCaseTitle(rg.companyName, cat, descMails, periodSuffix)
        });
      });
    });

    list.sort(function (a, b) { return (b.lastTs - a.lastTs) || (b.mails.length - a.mails.length); });
    return list;
  }

  /* 사건 기준 연도 산출: 수임일 → 가장 이른 수집메일 일자 → 사건번호 연도 → 종결일 → 생성시각 */
  function caseYearOf(caseRec) {
    if (!obj(caseRec)) return '미상';
    var m1 = /^(20\d{2})/.exec(str(caseRec.receiveDate));
    if (m1) return m1[1];
    var minTs = earliestMailTs(caseRec.mailLinks);
    if (minTs > 0) {
      var ym = ymdOf(minTs).slice(0, 4);
      if (/^20\d{2}$/.test(ym)) return ym;
    }
    var mNo = /(20\d{2})/.exec(str(caseRec.erpCaseNo));
    if (mNo) return mNo[1];
    var mClose = /^(20\d{2})/.exec(str(caseRec.closeDate));
    if (mClose) return mClose[1];
    var cr = ymdOf(caseRec.createdAt).slice(0, 4);
    if (/^20\d{2}$/.test(cr)) return cr;
    return '미상';
  }

  function bundleYearOf(bundle) {
    if (!obj(bundle)) return '미상';
    if (/^20\d{2}$/.test(str(bundle.year))) return str(bundle.year);
    var m = /^(20\d{2})/.exec(str(bundle.firstDate || bundle.lastDate));
    return m ? m[1] : '미상';
  }

  /* ═══ 외부 업무 시스템(푸른이알피·계약·기타사업·업무관리·캘린더) 자동 분류 및 8단계 정리 ═══ */
  var EXT_GEN_CONSULT_NOISE_RE = /취업규칙\s*(?:개정|제정|작성|변경|신고)|노사협의회\s*규정|인사규정\s*개정|임금체계\s*개편|강의\s*(?:자료|안|주제)|ppt\s*제작|예방\s*교육/i;
  var EXT_HARASS_RE = /직장\s*내\s*괴롭힘|직장내괴롭힘|직괴|성,?\s*직괴|직장\s*내\s*성희롱|직장내성희롱|괴롭힘\s*(?:조사|사건|신고|진정|대리|성립|보고)|성희롱\s*(?:조사|사건|신고|진정|보고서|성립|입회)|고충\s*(?:조사|심의)/;

  /* 진행 로그·메모·계약·일정 텍스트에서 해당하는 8단계 표준 코드 배열을 추출 */
  function inferStepsFromText(rawText) {
    var t = str(rawText);
    if (!t) return [];
    var out = [];
    function pushStep(code) {
      if (out.indexOf(code) < 0) out.push(code);
    }
    if (/수임|위임\s*계약|계약\s*체결|견적|자문\s*의뢰|조사\s*의뢰|접수/.test(t)) {
      pushStep('intake');
    }
    if (/출입\s*신청|조사\s*예정|조사\s*일정|일정\s*조율|문답지\s*작성|문답서\s*준비|질문지|인계\s*완료|착수/.test(t)) {
      pushStep('plan');
    }
    if (/비밀\s*유지|서약서|분리\s*조치|보호\s*조치/.test(t)) {
      pushStep('pledge');
    }
    if (/(?:신고인|피해자|진정인)[^\n]{0,16}(?:조사|면담|문답)|1차\s*조사|추가\s*조사\s*완료|조사\s*(?:완료|실시)|직괴\s*조사|성희롱\s*조사\s*입회/.test(t) &&
        !/조사\s*예정/.test(t.replace(/조사\s*(?:완료|실시)[\s\S]*/g, ''))) {
      pushStep('victim');
    }
    if (/(?:피신고인|행위자|가해자|피진정인)[^\n]{0,16}(?:조사|면담|문답|소명)|2차\s*조사\s*(?:실시|완료)|소명서/.test(t) &&
        !/피신고인\s*조사[^\n]{0,10}예정/.test(t)) {
      pushStep('accused');
    }
    if (/참고인[^\n]{0,16}(?:조사|면담|문답)|3차\s*조사|증빙\s*자료|증거\s*자료|사실\s*확인서|녹취|실태\s*조사/.test(t)) {
      pushStep('witness');
    }
    if (/보고서\s*(?:초안|작성|검토|내용\s*수정|수정)|의견서\s*(?:작성|초안|검토|제출\s*협의)|추가\s*의견서|법리\s*검토|3요건/.test(t)) {
      pushStep('review');
    }
    if (/조사\s*(?:결과\s*)?보고서[^\n]{0,24}(?:송부|재송부|제출|발송)|재검토\s*후\s*송부|최종\s*보고서\s*(?:송부|제출|완료)|신고\s*결과\s*보고|의견서[^\n]{0,16}(?:최종|전달\s*완료)|세금계산서\s*발행(?!\s*예정)|(?:^|[\s/·])(?:용역\s*)?완료$/.test(t) &&
        !/작성\s*예정|검토\s*요청|인계\s*완료/.test(t)) {
      pushStep('report');
    }
    return out;
  }

  /* 외부 연동 기록(_autoLogs)을 사건의 8단계(steps)에 반영 — 수동 편집(manual:true) 단계는 보존 */
  function applyExternalLogsToSteps(existingSteps, autoLogs, receiveDate, closeDate) {
    var steps = {};
    STEPS.forEach(function (def) {
      var prev = obj(existingSteps) && obj(existingSteps[def.code]) ? existingSteps[def.code] : {};
      steps[def.code] = {
        done: !!prev.done,
        date: str(prev.date),
        note: str(prev.note),
        srcMail: str(prev.srcMail),
        manual: !!prev.manual
      };
    });

    if (str(receiveDate) && !steps.intake.manual && !steps.intake.done) {
      steps.intake.done = true;
      steps.intake.date = str(receiveDate).slice(0, 10);
      if (!steps.intake.note) steps.intake.note = '사건 수임·접수 등록';
    }

    var asc = (Array.isArray(autoLogs) ? autoLogs.slice() : []).sort(function (a, b) {
      var da = str(a && a.date) || '9999-99-99';
      var db = str(b && b.date) || '9999-99-99';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    asc.forEach(function (lg) {
      if (!obj(lg)) return;
      var codes = Array.isArray(lg.stepCodes) && lg.stepCodes.length
        ? lg.stepCodes
        : (lg.stepCode ? [lg.stepCode] : inferStepsFromText(lg.text));
      codes.forEach(function (sc) {
        if (!steps[sc] || steps[sc].manual) return;
        var badge = str(lg.sourceBadge || lg.sourceNo || '연동');
        var dt = str(lg.date).slice(0, 10);
        if (!steps[sc].done) {
          steps[sc].done = true;
          steps[sc].date = dt || steps[sc].date || str(receiveDate).slice(0, 10);
          steps[sc].note = '[' + badge + '] ' + maskRrnText(str(lg.text)).slice(0, 72);
        } else if (dt && (!steps[sc].date || (sc === 'report' && dt > steps[sc].date))) {
          steps[sc].date = dt;
        }
      });
    });

    if (str(closeDate) && !steps.report.manual && !steps.report.done) {
      steps.report.done = true;
      steps.report.date = str(closeDate).slice(0, 10);
      if (!steps.report.note) steps.report.note = '조사 종결 처리';
    }
    return steps;
  }

  /* 업무관리(work_erp/items) 엑셀 재반입 중복 제거 — 연도 하위 폴더(2026/...)까지 평탄화하고 동일 관리번호(no)가 있으면 -r행번호 재반입본 우선 */
  function dedupeWorkItems(workItemsRaw) {
    var rawMap = obj(workItemsRaw) && workItemsRaw.v === undefined ? workItemsRaw : null;
    var list = [];
    function collectMap(m) {
      Object.keys(m).forEach(function (k) {
        var it = m[k];
        if (!obj(it) || it._deleted) return;
        if (!it.no && !it.title && !it.company && !it.co && !it.companyName && !it.cat && !it.ptype) {
          collectMap(it);
          return;
        }
        list.push(Object.assign({ id: str(it.id || k) }, it));
      });
    }
    if (rawMap && !Array.isArray(rawMap)) {
      collectMap(rawMap);
    } else {
      rowsOf(workItemsRaw).forEach(function (it) {
        list.push(Object.assign({ id: str(it.id) }, it));
      });
    }

    var bestByXNo = Object.create(null);
    list.forEach(function (it) {
      var id = str(it.id);
      var no = str(it.no);
      if (id.indexOf('X-') !== 0 || !no) return;
      var hasRowSuffix = /-r\d+$/.test(id) ? 1 : 0;
      var upAt = str(it.up_at || it.updatedAt || it.created_at || '');
      var prev = bestByXNo[no];
      if (!prev || hasRowSuffix > prev.hasRowSuffix || (hasRowSuffix === prev.hasRowSuffix && upAt > prev.upAt)) {
        bestByXNo[no] = { id: id, hasRowSuffix: hasRowSuffix, upAt: upAt };
      }
    });

    return list.filter(function (it) {
      var id = str(it.id);
      var no = str(it.no);
      if (id.indexOf('X-') === 0 && no && bestByXNo[no] && bestByXNo[no].id !== id) return false;
      return true;
    });
  }

  function parseFlexYmd(v) {
    var s = str(v);
    if (!s) return '';
    var mFull = /(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/.exec(s);
    if (mFull) {
      var mm = ('0' + Number(mFull[2])).slice(-2);
      var dd = ('0' + Number(mFull[3])).slice(-2);
      return mFull[1] + '-' + mm + '-' + dd;
    }
    return ymdOf(v);
  }

  /* 푸른이알피(사건·업무메모) · 계약 · 견적 · 기타사업 · 컨설팅 · 업무관리 · 캘린더 일정을 사건별로 자동 분류·연결 */
  function integrateExternalSources(baseCasesById, extSources, coDir, optUserDir) {
    var src = obj(extSources) ? extSources : {};
    var nameToSid = Object.create(null);
    var validSids = Object.create(null);
    var hasStaffCatalog = false;
    var rawUd = optUserDir || src.userDir;
    if (obj(rawUd)) {
      Object.keys(rawUd).forEach(function (k) {
        var u = rawUd[k];
        if (!obj(u)) return;
        var sid = str(u.sid || k);
        var nm = str(u.name).replace(/\s+/g, '');
        if (/^[A-Za-z0-9_-]{1,20}$/.test(sid)) {
          validSids[sid] = sid;
          validSids[sid.toUpperCase().replace(/[^A-Z0-9]/g, '')] = sid;
          hasStaffCatalog = true;
          if (nm) nameToSid[nm] = sid;
        }
      });
    }
    if (Array.isArray(src.staffList)) {
      src.staffList.forEach(function (st) {
        if (!obj(st)) return;
        var sid = str(st.sid);
        var nm = str(st.name).replace(/\s+/g, '');
        if (/^[A-Za-z0-9_-]{1,20}$/.test(sid)) {
          validSids[sid] = sid;
          validSids[sid.toUpperCase().replace(/[^A-Z0-9]/g, '')] = sid;
          hasStaffCatalog = true;
          if (nm && !nameToSid[nm]) nameToSid[nm] = sid;
        }
      });
    }
    function resolveSid(raw) {
      var v = str(raw);
      if (!v) return '';
      if (/^[A-Za-z0-9_-]{1,20}$/.test(v)) {
        if (!hasStaffCatalog) return v;
        return validSids[v] || validSids[v.toUpperCase().replace(/[^A-Z0-9]/g, '')] || '';
      }
      var cleaned = v.replace(/(대표)?노무사|팀장|실장|과장|대리|사원/g, '').replace(/\s+/g, '');
      return nameToSid[cleaned] || nameToSid[v.replace(/\s+/g, '')] || '';
    }
    function resolveSidList(arr, mainSid) {
      var out = [];
      (Array.isArray(arr) ? arr : []).forEach(function (x) {
        var s = resolveSid(x);
        if (s && s !== mainSid && out.indexOf(s) < 0 && out.length < 5) out.push(s);
      });
      return out;
    }

    var byId = {};
    if (Array.isArray(baseCasesById)) {
      baseCasesById.forEach(function (c) { if (obj(c) && str(c.id)) byId[str(c.id)] = Object.assign({}, c); });
    } else if (obj(baseCasesById)) {
      Object.keys(baseCasesById).forEach(function (k) {
        var c = baseCasesById[k];
        if (obj(c) && !c._deleted) byId[str(c.id || k)] = Object.assign({}, c);
      });
    }

    Object.keys(byId).forEach(function (cid) {
      var c = byId[cid];
      c._linkedSources = Array.isArray(c._linkedSources) ? c._linkedSources.slice() : [];
      c._autoLogs = Array.isArray(c._autoLogs) ? c._autoLogs.slice() : [];
      c._extMap = obj(c._extMap) ? Object.assign({}, c._extMap) : {};
      if (str(c.erpCaseId)) {
        addLinkedSource(c, 'erp', str(c.erpCaseNo) || '이알피사건', str(c.erpCaseId));
      }
    });

    function addLinkedSource(c, kind, label, refId) {
      if (!c) return;
      if (!Array.isArray(c._linkedSources)) c._linkedSources = [];
      var lbl = str(label);
      var key = kind + ':' + (refId || lbl);
      if (!c._extMap) c._extMap = {};
      if (c._extMap[key]) return;
      c._extMap[key] = 1;
      if (kind === 'work' && lbl && c._linkedSources.some(function (s) { return s && s.label === lbl; })) return;
      c._linkedSources.push({ kind: kind, label: lbl, id: str(refId) });
    }

    function addAutoLog(c, entry) {
      if (!c || !obj(entry) || !str(entry.text)) return;
      if (!Array.isArray(c._autoLogs)) c._autoLogs = [];
      var lid = str(entry.id || (entry.sourceKind + ':' + entry.date + ':' + str(entry.text).slice(0, 40)));
      if (c._autoLogs.some(function (x) { return x && x.id === lid; })) return;
      var codes = Array.isArray(entry.stepCodes) && entry.stepCodes.length
        ? entry.stepCodes
        : inferStepsFromText(entry.text);
      c._autoLogs.push({
        id: lid,
        date: str(entry.date).slice(0, 10),
        sourceKind: str(entry.sourceKind),
        sourceBadge: str(entry.sourceBadge),
        sourceNo: str(entry.sourceNo),
        stepCode: codes[0] || '',
        stepCodes: codes,
        text: maskRrnText(str(entry.text))
      });
    }

    var contracts = rowsOf(src.contracts);
    var ctById = Object.create(null), ctByNo = Object.create(null);
    contracts.forEach(function (ct) {
      if (str(ct.id)) ctById[str(ct.id)] = ct;
      if (str(ct.contractNo)) ctByNo[str(ct.contractNo)] = ct;
    });

    function isRelevantHarassText(headTxt, fullTxt) {
      var h = str(headTxt);
      var f = str(fullTxt || headTxt);
      if (!EXT_HARASS_RE.test(f)) return false;
      if (EDU_ONLY_RE.test(h) && !CASE_OVERRIDE_RE.test(h)) return false;
      if (EXT_GEN_CONSULT_NOISE_RE.test(h) && !CASE_OVERRIDE_RE.test(f)) return false;
      return true;
    }

    function extractClues(rec, linkedCt) {
      var coSub = obj(rec && rec.company) ? rec.company : {};
      var ctCoSub = obj(linkedCt && linkedCt.company) ? linkedCt.company : {};
      var coId = str((rec && rec.companyId) || coSub.id || (linkedCt && linkedCt.companyId) || ctCoSub.id);
      var coName = str((rec && (rec.companyName || rec.co)) || coSub.name || (linkedCt && (linkedCt.companyName || linkedCt.co)) || ctCoSub.name);
      var bizNo = digits((rec && rec.bizNo) || coSub.bizNo || (linkedCt && linkedCt.bizNo) || ctCoSub.bizNo).slice(0, 10);
      var email = str((rec && rec.email) || (obj(rec && rec.jurisdiction) && rec.jurisdiction.email) || coSub.email || coSub.primaryContactEmail || ctCoSub.email || ctCoSub.primaryContactEmail);
      if (coDir) {
        var matched = null;
        if (coId && coDir.byId && coDir.byId[coId]) matched = coDir.byId[coId];
        else if (bizNo.length === 10 && coDir.byBiz && coDir.byBiz[bizNo]) matched = coDir.byBiz[bizNo];
        else if (coName) matched = resolveCompanyByOrgName(coDir, coName);
        if (matched) {
          coId = coId || matched.id;
          coName = coName || matched.name;
          bizNo = bizNo || matched.bizNo;
          if (!email && Array.isArray(matched.addrs) && matched.addrs.length) email = matched.addrs[0];
        }
      }
      return { companyId: coId, companyName: coName, bizNo: bizNo, email: email };
    }

    function findBestCase(optsMatch) {
      var o = obj(optsMatch) ? optsMatch : {};
      var erpId = str(o.erpCaseId);
      var erpNo = str(o.erpCaseNo);
      var ctId = str(o.contractId);
      var opId = str(o.otherProjectId);
      var csId = str(o.consultingId);
      var wkNo = str(o.workNo);
      var allCases = Object.keys(byId).map(function (k) { return byId[k]; });

      for (var i = 0; i < allCases.length; i++) {
        var c = allCases[i];
        if (erpId && str(c.erpCaseId) === erpId) return c;
        if (erpNo && str(c.erpCaseNo) === erpNo) return c;
        if (ctId && ((c._extMap && c._extMap['contract:' + ctId]) || c.id === 'hi_ct_' + safeKey(ctId))) return c;
        if (opId && ((c._extMap && c._extMap['other:' + opId]) || c.id === 'hi_op_' + safeKey(opId))) return c;
        if (csId && ((c._extMap && c._extMap['consulting:' + csId]) || c.id === 'hi_cs_' + safeKey(csId))) return c;
        if (wkNo && ((c._extMap && c._extMap['workno:' + wkNo]) || c.id === 'hi_wk_' + safeKey(wkNo))) return c;
      }

      var coId = str(o.companyId);
      var bz = digits(o.bizNo).slice(0, 10);
      var core = coCoreNorm(o.companyName);
      var cands = allCases.filter(function (c) {
        if (erpId && str(c.erpCaseId) && str(c.erpCaseId) !== erpId) return false;
        if (coId && str(c.companyId) && str(c.companyId) === coId) return true;
        if (bz.length === 10 && digits(c.bizNo).slice(0, 10) === bz) return true;
        var cCore = coCoreNorm(c.companyName);
        if (core.length >= 2 && !GENERIC_TITLE_WORDS[core] && cCore && (cCore === core || (core.length >= 3 && (cCore.indexOf(core) >= 0 || core.indexOf(cCore) >= 0)))) {
          return true;
        }
        return false;
      });
      if (!cands.length) return null;

      var dMs = parseYmdMs(o.dateYmd);
      if (!dMs) return cands.length === 1 ? cands[0] : null;

      var inWin = cands.filter(function (c) {
        var cStart = parseYmdMs(c.receiveDate) || earliestMailTs(c.mailLinks);
        var cEnd = parseYmdMs(c.closeDate) || latestMailTs(c.mailLinks) || (cStart ? cStart + 210 * DAY_MS : 0);
        if (!cStart) return true;
        return dMs >= (cStart - 60 * DAY_MS) && dMs <= (Math.max(cEnd, cStart + 210 * DAY_MS) + 100 * DAY_MS);
      });
      if (!inWin.length) return null;
      if (inWin.length === 1) return inWin[0];

      /* 동일 사업장 복수 연도·반기 사건이 있을 때는 수임일(cStart - 14일) 이후 가장 가까운 에피소드에 귀속 */
      inWin.sort(function (a, b) {
        var sa = parseYmdMs(a.receiveDate) || earliestMailTs(a.mailLinks) || 0;
        var sb = parseYmdMs(b.receiveDate) || earliestMailTs(b.mailLinks) || 0;
        return sa - sb;
      });
      var chosen = inWin[0];
      for (var j = 0; j < inWin.length; j++) {
        var stMs = parseYmdMs(inWin[j].receiveDate) || earliestMailTs(inWin[j].mailLinks) || 0;
        if (stMs > 0 && dMs >= stMs - 14 * DAY_MS) chosen = inWin[j];
      }
      return chosen;
    }

    var autoCreatedIds = [];
    function ensureExtCase(id, clues, recMeta) {
      if (byId[id]) return byId[id];
      var co = str(clues.companyName) || '의뢰 사업장';
      var cat = inferCategory(recMeta.fullText);
      var mainSid = resolveSid(recMeta.managerMain);
      var newRec = {
        id: id,
        erpCaseId: str(recMeta.erpCaseId),
        erpCaseNo: str(recMeta.erpCaseNo),
        companyId: str(clues.companyId),
        companyLinkStatus: str(clues.companyId) ? 'linked' : 'pending',
        companyName: co,
        bizNo: str(clues.bizNo),
        email: str(clues.email),
        category: cat,
        title: str(recMeta.title) || buildKoreanCaseTitle(co, cat, [], ''),
        managerMain: mainSid,
        managerSubs: resolveSidList(recMeta.managerSubs, mainSid),
        receiveDate: str(recMeta.receiveDate),
        dueDate: str(recMeta.dueDate),
        closeDate: str(recMeta.closeDate),
        erpDefer: !str(recMeta.erpCaseId),
        verdictSummary: '',
        mailLinks: [],
        steps: {},
        _linkedSources: [],
        _autoLogs: [],
        _extMap: {},
        _virtualFromExt: true
      };
      byId[id] = newRec;
      autoCreatedIds.push(id);
      return newRec;
    }

    var linkedContractIds = Object.create(null);

    function contractBriefText(ct) {
      if (!obj(ct)) return '';
      var parts = [str(ct.scope), str(ct.brief)];
      if (obj(ct.briefs)) {
        Object.keys(ct.briefs).forEach(function (bk) {
          if (str(ct.briefs[bk])) parts.push(str(ct.briefs[bk]));
        });
      }
      return parts.filter(Boolean).join(' / ');
    }

    function contractTransferredCaseNo(ct) {
      var tr = str(ct && ct.transferredTo);
      if (tr.indexOf('case:') === 0) return tr.slice(5).trim();
      return '';
    }

    /* 1) 기타사업(data/other_projects/v) 및 컨설팅(data/consultings/v) — 원천 계약(sourceContractId) 결합 분류 */
    function processProjectRows(rows, kind, badgePrefix, idPrefix) {
      rows.forEach(function (pr) {
        var pid = str(pr.id);
        if (!pid) return;
        var srcCt = (str(pr.sourceContractId) && ctById[str(pr.sourceContractId)]) ||
                    (str(pr.sourceContractNo) && ctByNo[str(pr.sourceContractNo)]) || null;
        var ownHead = [pr.no, pr.programName, pr.projectType, pr.typeName, pr.title].map(str).join(' ');
        var srcCtBrief = contractBriefText(srcCt);
        var ctTxt = srcCt ? [srcCt.contractNo, srcCt.caseType, srcCt.projectType, srcCt.title, srcCtBrief, srcCt.note].map(str).join(' ') : '';
        var fullTxt = ownHead + ' ' + str(pr.brief) + ' ' + str(pr.note) + ' ' + ctTxt;
        if (!isRelevantHarassText(ownHead, fullTxt)) return;

        var clues = extractClues(pr, srcCt);
        var startDt = parseFlexYmd(pr.startDate || pr.contractDate || pr.receiveDate || (srcCt && (srcCt.contractDate || srcCt.signDate || srcCt.startDate || srcCt.createdAt)) || pr.createdAt);
        var endDt = parseFlexYmd(pr.closeDate || pr.endDate || '');
        var target = findBestCase({
          companyId: clues.companyId,
          companyName: clues.companyName,
          bizNo: clues.bizNo,
          contractId: srcCt ? str(srcCt.id) : str(pr.sourceContractId),
          otherProjectId: kind === 'other' ? pid : '',
          consultingId: kind === 'consulting' ? pid : '',
          dateYmd: startDt
        });
        if (!target) {
          var niceTitle = str(pr.title || pr.brief || srcCtBrief);
          if (!niceTitle || (clues.companyName && niceTitle.indexOf(clues.companyName) < 0)) {
            niceTitle = (clues.companyName ? clues.companyName + ' ' : '') + (niceTitle || '직장 내 괴롭힘·성희롱 사건 조사');
          }
          target = ensureExtCase(idPrefix + safeKey(pid), clues, {
            fullText: fullTxt,
            title: niceTitle,
            managerMain: str(pr.managerMain || pr.manager || (srcCt && (srcCt.managerMain || srcCt.manager))),
            managerSubs: Array.isArray(pr.managerSubs) ? pr.managerSubs : (srcCt && Array.isArray(srcCt.managerSubs) ? srcCt.managerSubs : []),
            receiveDate: startDt,
            dueDate: parseFlexYmd(pr.dueDate),
            closeDate: /종결|완료/.test(str(pr.status)) ? (endDt || '') : ''
          });
        } else {
          if (!target.companyId && clues.companyId) { target.companyId = clues.companyId; target.companyLinkStatus = 'linked'; }
          if (!target.email && clues.email) target.email = clues.email;
          var projSid = resolveSid(pr.managerMain || pr.manager || (srcCt && (srcCt.managerMain || srcCt.manager)));
          if (!target.managerMain && projSid) target.managerMain = projSid;
        }

        var pNo = str(pr.no) || badgePrefix;
        addLinkedSource(target, kind, pNo, pid);
        addAutoLog(target, {
          id: kind + ':' + pid,
          date: startDt,
          sourceKind: kind,
          sourceBadge: badgePrefix,
          sourceNo: pNo,
          stepCodes: inferStepsFromText(fullTxt).length ? inferStepsFromText(fullTxt) : ['intake'],
          text: pNo + ' 등록 — ' + (str(pr.title || pr.programName || pr.brief) || '진행 관리')
        });
        if (srcCt && str(srcCt.id)) {
          linkedContractIds[str(srcCt.id)] = 1;
          var ctNo = str(srcCt.contractNo) || '계약';
          addLinkedSource(target, 'contract', ctNo, str(srcCt.id));
          addAutoLog(target, {
            id: 'ct:' + str(srcCt.id),
            date: parseFlexYmd(srcCt.contractDate || srcCt.signDate || srcCt.startDate || srcCt.createdAt) || startDt,
            sourceKind: 'contract',
            sourceBadge: '계약관리',
            sourceNo: ctNo,
            stepCodes: ['intake'],
            text: ctNo + ' 체결 — ' + (srcCtBrief || str(srcCt.title || srcCt.caseType) || '조사·자문 위임계약') + (str(srcCt.note) ? ' (' + str(srcCt.note).slice(0, 80) + ')' : '')
          });
        }
      });
    }

    processProjectRows(rowsOf(src.otherProjects), 'other', '기타사업', 'hi_op_');
    processProjectRows(rowsOf(src.consultings), 'consulting', '컨설팅', 'hi_cs_');

    /* 2) 계약관리(data/contracts/v) 및 견적함(pu_quotes) 자동 분류·연결 */
    contracts.forEach(function (ct) {
      var ctid = str(ct.id);
      if (!ctid || linkedContractIds[ctid] || str(ct.status) === '취소') return;
      var ctBrief = contractBriefText(ct);
      var trCaseNo = contractTransferredCaseNo(ct);
      var headTxt = [ct.contractNo, ct.arrivedNo, trCaseNo, ct.caseType, ct.projectType, ct.title].map(str).join(' ');
      var fullTxt = headTxt + ' ' + ctBrief + ' ' + str(ct.note);
      if (!isRelevantHarassText(headTxt, fullTxt)) return;

      var clues = extractClues(ct, null);
      var ctDate = parseFlexYmd(ct.contractDate || ct.signDate || ct.startDate || ct.date || ct.regAt || ct.createdAt);
      var target = findBestCase({
        erpCaseId: str(ct.arrivedCaseId || ct.caseId),
        erpCaseNo: str(ct.arrivedNo || trCaseNo),
        contractId: ctid,
        companyId: clues.companyId,
        companyName: clues.companyName,
        bizNo: clues.bizNo,
        dateYmd: ctDate
      });
      if (!target) {
        target = ensureExtCase('hi_ct_' + safeKey(ctid), clues, {
          fullText: fullTxt,
          title: (clues.companyName ? clues.companyName + ' ' : '') + (str(ct.title) || ctBrief || str(ct.caseType) || '직장 내 괴롭힘 사건 조사'),
          managerMain: str(ct.managerMain || ct.manager || ct.writerSid),
          managerSubs: Array.isArray(ct.managerSubs) ? ct.managerSubs : [],
          receiveDate: ctDate
        });
      } else {
        if (!target.companyId && clues.companyId) { target.companyId = clues.companyId; target.companyLinkStatus = 'linked'; }
        if (!target.email && clues.email) target.email = clues.email;
        var ctSid = resolveSid(ct.managerMain || ct.manager || ct.writerSid);
        if (!target.managerMain && ctSid) target.managerMain = ctSid;
      }
      var ctNo = str(ct.contractNo) || '계약';
      addLinkedSource(target, 'contract', ctNo, ctid);
      addAutoLog(target, {
        id: 'ct:' + ctid,
        date: ctDate,
        sourceKind: 'contract',
        sourceBadge: '계약관리',
        sourceNo: ctNo,
        stepCodes: ['intake'],
        text: ctNo + ' 체결 — ' + (ctBrief || str(ct.title || ct.caseType) || '조사 위임계약')
      });
    });

    rowsOf(src.quotes).forEach(function (qt) {
      var qid = str(qt.id);
      if (!qid) return;
      var qTxt = [qt.type, qt.co, qt.title, qt.note].map(str).join(' ');
      if (!isRelevantHarassText(qTxt, qTxt)) return;
      var clues = extractClues({ companyName: qt.co }, null);
      var qDate = parseFlexYmd(qt.date || qt.createdAt);
      var target = findBestCase({
        companyId: clues.companyId,
        companyName: clues.companyName,
        bizNo: clues.bizNo,
        dateYmd: qDate
      });
      if (!target) return;
      var docLbl = str(qt.doc) === 'contract' ? '위임계약서' : '견적서';
      addLinkedSource(target, 'quote', docLbl, qid);
      addAutoLog(target, {
        id: 'qt:' + qid,
        date: qDate,
        sourceKind: 'quote',
        sourceBadge: '견적·계약함',
        sourceNo: docLbl,
        stepCodes: ['intake'],
        text: docLbl + ' 발송·검토 (' + str(qt.type || '조사') + ')'
      });
    });

    /* 3) 업무관리(work_erp/items + work_erp/itemlogs) 조사·사건 진행로그 자동 연결·단계 복원 */
    var dedupedWork = dedupeWorkItems(src.workItems);
    var rawLogsMap = obj(src.workItemLogs) ? src.workItemLogs : {};
    dedupedWork.forEach(function (wk) {
      var wid = str(wk.id);
      if (!wid) return;
      var refObj = obj(wk.ref) ? wk.ref : {};
      var refType = str(refObj.type);
      var srcId = str(wk.src_id || refObj.id || (wid.indexOf('PE-case-') === 0 ? wid.slice(8) : wid.indexOf('PE-other-') === 0 ? wid.slice(9) : wid.indexOf('PE-cons-') === 0 ? wid.slice(8) : wid.indexOf('PE-contract-') === 0 ? wid.slice(12) : ''));
      var isInvestCat = (str(wk.cat) === '조사' || str(wk.ptype) === '조사' || /^\d{4}-조사-/.test(str(wk.no)));
      var rawWkCo = str(wk.company || wk.co || wk.companyName);
      if (!rawWkCo) {
        var mParenCo = /\/\s*\(([^()]{2,30})\)\s*$/.exec(str(wk.title));
        if (mParenCo) rawWkCo = str(mParenCo[1]);
      }
      var primaryWkCo = rawWkCo.indexOf('/') >= 0 ? str(rawWkCo.split('/')[0]) : rawWkCo;
      var ownTxt = [wk.no, rawWkCo, wk.title, wk.brief, wk.note].map(str).join(' ');
      if (EDU_ONLY_RE.test(ownTxt) && !CASE_OVERRIDE_RE.test(ownTxt)) return;

      var itemLogObj = obj(rawLogsMap[wid]) ? rawLogsMap[wid] : {};
      var logEntries = Object.keys(itemLogObj).map(function (lk) {
        var lv = itemLogObj[lk];
        if (!obj(lv) || lv._deleted) return null;
        if (lv.k === 'mail' || lv.sourceKind === 'mail') return null;
        var ltxt = str(lv.t || lv.txt || lv.text || lv.memo || lv.content || lv.note);
        if (!ltxt) return null;
        /* 과거 엑셀 행 혼합으로 끼어든 무관 산재 로그(추가상병·휴업급여·질판위·특진·재해발생경위서)는 제외 */
        if (/추가\s*상병|휴업\s*급여|질판위|특진\s*완료|재해\s*발생\s*경위서/.test(ltxt) && !EXT_HARASS_RE.test(ltxt)) return null;
        return {
          key: lk,
          date: parseFlexYmd(lv.d || lv.date || lv.dt || lv.week || lv.w || lv.at || lv.created_at),
          text: ltxt
        };
      }).filter(Boolean);

      /* 내장 일정·진행 필드(wk.sched / wk.status_note 등)도 함께 반영 */
      if (Array.isArray(wk.sched)) {
        wk.sched.forEach(function (sc, sIdx) {
          if (!obj(sc)) return;
          var stx = str(sc.title || sc.txt || sc.memo);
          if (stx) logEntries.push({ key: 'sched_' + sIdx, date: parseFlexYmd(sc.date || sc.dt), text: stx });
        });
      }
      if (str(wk.memo || wk.progress || wk.statusNote)) {
        logEntries.push({ key: 'memo_main', date: parseFlexYmd(wk.up_at || wk.date), text: str(wk.memo || wk.progress || wk.statusNote) });
      }

      logEntries.sort(function (a, b) {
        var da = a.date || '9999-99-99', db = b.date || '9999-99-99';
        return da < db ? -1 : da > db ? 1 : 0;
      });

      var directMatch = srcId ? findBestCase({
        erpCaseId: (wid.indexOf('PE-case-') === 0 || refType === 'case') ? srcId : '',
        otherProjectId: (wid.indexOf('PE-other-') === 0 || refType === 'other') ? srcId : '',
        consultingId: (wid.indexOf('PE-cons-') === 0 || refType === 'consulting') ? srcId : '',
        contractId: (wid.indexOf('PE-contract-') === 0 || refType === 'contract') ? srcId : ''
      }) : null;

      if (!directMatch && !isInvestCat && !isRelevantHarassText(ownTxt, ownTxt)) {
        return;
      }

      var firstLogDt = parseFlexYmd(wk.start || wk.startDate || wk.date) || (logEntries[0] && logEntries[0].date) || parseFlexYmd(wk.created_at);
      var lastLogDt = parseFlexYmd(wk.done_date) || (logEntries.length && logEntries[logEntries.length - 1].date) || firstLogDt;
      var clues = extractClues({ companyId: wk.companyId || wk.co_id, companyName: primaryWkCo || rawWkCo, bizNo: wk.bizNo }, null);
      var target = directMatch || findBestCase({
        workNo: str(wk.no),
        companyId: clues.companyId,
        companyName: clues.companyName,
        bizNo: clues.bizNo,
        dateYmd: firstLogDt
      });

      var wkMgrRaw = obj(wk.mgr_main) ? (wk.mgr_main.sid || wk.mgr_main.name) : (wk.mgr || wk.managerMain || wk.sid || wk.ownerName || wk.owner);
      var wkSubsRaw = Array.isArray(wk.mgr_subs) ? wk.mgr_subs.map(function (s) { return obj(s) ? (s.sid || s.name) : s; }) : [];

      if (!target) {
        /* 이알피 원본이 삭제된 고아 미러(pe_gone)는 단독 가상 사건으로 새로 만들지 않음 */
        if (wk.pe_gone || !isInvestCat || !clues.companyName) return;
        var mgrSid = resolveSid(wkMgrRaw);
        var hasReportDoneInLogs = logEntries.some(function (l) { return inferStepsFromText(l.text).indexOf('report') >= 0; });
        target = ensureExtCase('hi_wk_' + safeKey(wk.no || wid), clues, {
          fullText: ownTxt + ' ' + logEntries.map(function (l) { return l.text; }).join(' '),
          title: clues.companyName + ' ' + (str(wk.title).replace(/\s*\/\s*\([^()]+\)\s*$/, '').trim() || '직장 내 괴롭힘 사건 조사'),
          managerMain: mgrSid,
          managerSubs: wkSubsRaw,
          receiveDate: firstLogDt,
          closeDate: (hasReportDoneInLogs && /종결|종료|완료/.test(str(wk.status || wk.state))) ? lastLogDt : ''
        });
      } else {
        var existingMgr = resolveSid(wkMgrRaw);
        if (!target.managerMain && existingMgr) target.managerMain = existingMgr;
      }

      var wkLabel = str(wk.no) || '업무관리';
      addLinkedSource(target, 'work', wkLabel, wid);
      if (str(wk.no)) target._extMap['workno:' + str(wk.no)] = 1;

      if (!logEntries.length && str(wk.title)) {
        addAutoLog(target, {
          id: 'wk:' + wid + ':init',
          date: firstLogDt,
          sourceKind: 'work',
          sourceBadge: '업무관리',
          sourceNo: wkLabel,
          text: (wkLabel !== '업무관리' ? '[' + wkLabel + '] ' : '') + str(wk.title)
        });
      }
      logEntries.forEach(function (le) {
        addAutoLog(target, {
          id: 'wk:' + wid + ':' + le.key,
          date: le.date || firstLogDt,
          sourceKind: 'work',
          sourceBadge: '업무관리',
          sourceNo: wkLabel,
          text: (str(wk.no) ? '[' + str(wk.no) + '] ' : '') + le.text
        });
      });
    });

    /* 4) 푸른이알피 수동 업무메모(data/case_memos/v) 반영 — 자동동기화 메모(harassSync / cm-hi-)는 역유입 제외 */
    rowsOf(src.caseMemos).forEach(function (cm) {
      if (cm.harassSync === true || /^cm-hi-/.test(str(cm.id))) return;
      var cidErp = str(cm.caseId);
      var txt = str(cm.content || cm.text || cm.memo);
      if (!cidErp || !txt) return;
      var target = findBestCase({ erpCaseId: cidErp });
      if (!target) return;
      addAutoLog(target, {
        id: 'cm:' + str(cm.id),
        date: parseFlexYmd(cm.date || cm.createdAt || cm.updatedAt),
        sourceKind: 'erp_memo',
        sourceBadge: '이알피메모',
        sourceNo: str(target.erpCaseNo) || '이알피',
        text: txt
      });
    });

    /* 5) 푸른 캘린더 일정(data/my_schedules/v) 중 면담·조사·심의 일정 자동 연결 */
    rowsOf(src.schedules).forEach(function (sc) {
      var sid = str(sc.id);
      var sTxt = [sc.title, sc.memo, sc.desc, sc.note].map(str).join(' ').trim();
      if (!sid || !sTxt) return;
      var linkedErpId = str(sc.caseId || (sc.sourceKind === 'case' ? sc.sourceId : ''));
      if (!linkedErpId && !EXT_HARASS_RE.test(sTxt)) return;
      var sDate = parseFlexYmd(sc.date || sc.startDate || sc.start);
      var clues = extractClues({ companyId: sc.companyId, companyName: sc.companyName || extractOrgName(sTxt, [], '', '') }, null);
      var target = findBestCase({
        erpCaseId: linkedErpId,
        companyId: clues.companyId,
        companyName: clues.companyName,
        dateYmd: sDate
      });
      if (!target) return;
      addLinkedSource(target, 'schedule', '일정', sid);
      addAutoLog(target, {
        id: 'sc:' + sid,
        date: sDate,
        sourceKind: 'schedule',
        sourceBadge: '캘린더일정',
        sourceNo: sDate,
        text: sTxt
      });
    });

    /* 각 사건의 _autoLogs 최신순 정렬 및 8단계 자동 반영 */
    Object.keys(byId).forEach(function (cid) {
      var c = byId[cid];
      if (Array.isArray(c._autoLogs) && c._autoLogs.length) {
        c._autoLogs.sort(function (a, b) {
          var da = str(a.date) || '0000-00-00', db = str(b.date) || '0000-00-00';
          return db.localeCompare(da);
        });
        c.steps = applyExternalLogsToSteps(c.steps || {}, c._autoLogs, c.receiveDate, c.closeDate);
      }
    });

    return { casesById: byId, autoCreatedIds: autoCreatedIds };
  }

  /* 수행 유형 정밀 판별: 푸른노무법인 직접수행+결과보고 완료(direct_report) vs 직접조사 진행(direct_active) vs 대리·자문·검토(advisory_rep) vs 외부위원·협업(committee_collab) */
  function classifyPerformMode(caseRec) {
    if (!obj(caseRec)) return 'advisory_rep';
    var explicit = str(caseRec.performMode);
    var mails = Array.isArray(caseRec.mailLinks) ? caseRec.mailLinks : [];
    var logs = Array.isArray(caseRec._autoLogs) ? caseRec._autoLogs : [];
    var erpNo = str(caseRec.erpCaseNo);
    var coName = str(caseRec.companyName);
    var title = str(caseRec.title);
    var headTxt = coName + ' ' + title + ' ' + erpNo;
    var allMailHead = mails.map(function (m) {
      if (!obj(m)) return '';
      var an = Array.isArray(m.attNames) ? m.attNames.join(' ') : str(m.attNames);
      return str(m.subject) + ' ' + an;
    }).join(' ');
    var allLogTxt = logs.map(function (l) { return obj(l) ? (str(l.sourceNo) + ' ' + str(l.text)) : ''; }).join(' ');
    var combined = headTxt + ' ' + allMailHead + ' ' + allLogTxt;

    if (explicit && has(PERFORM_MODES, explicit)) {
      if (explicit === 'direct_active' && (caseRec.hasResultReport === true || (caseRec.steps && caseRec.steps.report && caseRec.steps.report.done))) {
        return 'direct_report';
      }
      return explicit;
    }
    if (caseRec.hasResultReport === true) return 'direct_report';

    var isDirectErpNo = /^(?:성,?\s*직괴|조사-|직괴조사)/.test(erpNo) ||
      (/\b20\d{2}-조사-\d+/.test(allLogTxt) && !/^직괴\s*대리|근로자\s*측.*대응|위임\s*범위\s*제외\s*[:：]?\s*사실\s*조사/.test(combined));
    var isCollabFirm = /(?:열린|태현|예일|해밀|대일)\s*(?:인사\s*)?노무|노동법률사무소/.test(coName + ' ' + title);
    var isCommitteeRole = /판단\s*전문\s*위원|전문위원\s*(?:위촉|회의|수당|참석|안내)|심의위원\s*(?:위촉|회의|참석|수당|개최)|징계(?:심의)?위원(?:회)?\s*위원|고충(?:처리|심의)위원\s*(?:위촉|참석)|인권센터[^\n]{0,20}위촉|고충처리\s*대응\s*전문기관|비교\s*견적/.test(combined);
    if (!isDirectErpNo && (isCollabFirm || isCommitteeRole)) {
      return 'committee_collab';
    }

    if (/^직괴\s*대리|대리-\d{4}|구제\s*신청|부해|부노/.test(erpNo) || /위임\s*범위\s*제외\s*[:：]?\s*사실\s*조사/.test(combined)) {
      return 'advisory_rep';
    }

    var sentDirectReport = mails.some(function (m) {
      if (!obj(m)) return false;
      var subAtt = str(m.subject) + ' ' + (Array.isArray(m.attNames) ? m.attNames.join(' ') : str(m.attNames));
      if (/(?:서식|양식|예시)/.test(subAtt)) return false;
      if (/조사결과보고서_노무사의견/.test(subAtt)) return true;
      if (m.dir !== 'out') return false;
      if (/의견서/.test(subAtt) && !/조사\s*(?:결과\s*)?보고|괴롭힘\s*보고|성희롱\s*보고|최종\s*보고|결과\s*보고/.test(subAtt)) return false;
      return /(?:조사\s*(?:결과\s*)?보고서|괴롭힘\s*보고서|성희롱\s*보고서|최종\s*(?:조사\s*)?보고서?|조사\s*자료\s*취합본\s*\(?최종\)?)/.test(subAtt);
    });

    var authoredReportAtt = mails.some(function (m) {
      if (!obj(m)) return false;
      var subAtt = str(m.subject) + ' ' + (Array.isArray(m.attNames) ? m.attNames.join(' ') : str(m.attNames));
      if (/(?:서식|양식|예시)|검토\s*(?:요청|부탁|의뢰)|봐주|보내드립니다/.test(subAtt)) return false;
      return /조사결과보고서_노무사의견|최종보고서\.(?:hwp|hwpx|pdf|docx?)|신고\s*결과\s*보고|(?:직장\s*내\s*)?(?:괴롭힘|성희롱)\s*최종\s*보고서\s*$|정식\s*조사\s*종료/.test(subAtt);
    });

    var workReportDone = logs.some(function (l) {
      if (!obj(l) || l.sourceKind !== 'work') return false;
      var lt = str(l.text);
      if (/보고서\s*검토|조사\s*입회|작성\s*예정/.test(lt)) return false;
      return /조사\s*(?:결과\s*)?보고서[^\n]{0,24}(?:송부|재송부|제출|완료)|재검토\s*후\s*송부|조사\s*완료\s*\/\s*보고서\s*작성|보고서\s*(?:작성|내용\s*수정)|세금계산서\s*발행/.test(lt);
    });

    var sentInvestDoc = mails.some(function (m) {
      if (!obj(m) || m.dir !== 'out') return false;
      var subAtt = str(m.subject) + ' ' + (Array.isArray(m.attNames) ? m.attNames.join(' ') : str(m.attNames));
      if (/법률\s*의견서|자문\s*계약|대리/.test(subAtt) && !/조사/.test(subAtt)) return false;
      return /문답서|진술\s*확인서|조사\s*(?:위임|용역|견적|보고서|초안)|직괴\s*조사\s*위임/.test(subAtt);
    });

    var hasInvestContractOrWork = isDirectErpNo || logs.some(function (l) {
      if (!obj(l)) return false;
      var lt = str(l.sourceNo) + ' ' + str(l.text);
      if (/법률\s*의견서|보고서\s*검토|조사\s*입회|직괴\s*대리/.test(lt) && !/조사\s*대행|조사\s*용역|20\d{2}-조사-/.test(lt)) return false;
      return /조사\s*대행|조사\s*용역|조사\s*보고서\s*작성|20\d{2}-조사-|(?:괴롭힘|성희롱|복합)\s*조사\s*(?:위임|계약|수임)/.test(lt);
    });

    var hasFormalClientInvestReq = (/정식\s*조사\s*의뢰|조사\s*업무\s*의뢰\s*요청|조사\s*용역\s*과업\s*지시서|조사위원회\s*견적|문답서\s*(?:확인\s*요청|서명본|송부)/.test(combined) ||
      (/조사위원회\s*관련\s*자료/.test(combined) && /심의에\s*따른\s*보고서\s*수정/.test(combined))) &&
      !/보고서\s*검토\s*(?:요청|부탁)|종결\s*보고서.*검토/.test(combined);

    var isDirectInvest = isDirectErpNo || sentDirectReport || sentInvestDoc || hasInvestContractOrWork || hasFormalClientInvestReq;

    if (caseRec.hasResultReport !== false) {
      if (sentDirectReport || (isDirectInvest && (authoredReportAtt || workReportDone))) {
        return 'direct_report';
      }
      if (isDirectInvest && caseRec.steps && caseRec.steps.report && caseRec.steps.report.done && caseRec.steps.report.manual === true) {
        return 'direct_report';
      }
    }

    if (isDirectInvest) {
      return 'direct_active';
    }
    return 'advisory_rep';
  }

  function hasDirectResultReport(caseRec) {
    return classifyPerformMode(caseRec) === 'direct_report';
  }

  /* 등록 사건 + 미등록 메일 묶음을 연도별(최신순)로 통합 집계 */
  function buildYearlyArchive(cases, bundles) {
    var byYear = {};
    var totalCases = 0;
    var totalBundles = 0;
    var totalMails = 0;
    var totalDirectReport = 0;

    function ensureYr(yr) {
      var y = str(yr) || '미상';
      if (!byYear[y]) {
        byYear[y] = {
          year: y,
          cases: [],
          bundles: [],
          caseCount: 0,
          bundleCount: 0,
          totalCount: 0,
          mailCount: 0,
          directReportCount: 0,
          catCounts: { harass: 0, sexual: 0, both: 0 },
          performCounts: { direct_report: 0, direct_active: 0, advisory_rep: 0, committee_collab: 0 }
        };
      }
      return byYear[y];
    }

    (Array.isArray(cases) ? cases : []).forEach(function (c) {
      if (!obj(c) || c._deleted) return;
      var yr = caseYearOf(c);
      var bucket = ensureYr(yr);
      var mc = Array.isArray(c.mailLinks) ? c.mailLinks.length : 0;
      var cat = CATEGORIES[c.category] ? c.category : 'harass';
      var pm = classifyPerformMode(c);
      bucket.cases.push(c);
      bucket.caseCount++;
      bucket.totalCount++;
      bucket.mailCount += mc;
      bucket.catCounts[cat] = (bucket.catCounts[cat] || 0) + 1;
      bucket.performCounts[pm] = (bucket.performCounts[pm] || 0) + 1;
      if (pm === 'direct_report') {
        bucket.directReportCount++;
        totalDirectReport++;
      }
      totalCases++;
      totalMails += mc;
    });

    (Array.isArray(bundles) ? bundles : []).forEach(function (b) {
      if (!obj(b)) return;
      var yr = bundleYearOf(b);
      var bucket = ensureYr(yr);
      var mc = Array.isArray(b.mails) ? b.mails.length : 0;
      var cat = CATEGORIES[b.category] ? b.category : 'harass';
      bucket.bundles.push(b);
      bucket.bundleCount++;
      bucket.totalCount++;
      bucket.mailCount += mc;
      bucket.catCounts[cat] = (bucket.catCounts[cat] || 0) + 1;
      totalBundles++;
      totalMails += mc;
    });

    var years = Object.keys(byYear).sort(function (a, b) {
      var na = /^20\d{2}$/.test(a) ? Number(a) : -1;
      var nb = /^20\d{2}$/.test(b) ? Number(b) : -1;
      if (na !== nb) return nb - na;
      return a < b ? -1 : a > b ? 1 : 0;
    });

    var groups = years.map(function (yr) {
      var g = byYear[yr];
      g.cases.sort(function (a, b) {
        var da = str(a.receiveDate);
        var db = str(b.receiveDate);
        if (da !== db) return db.localeCompare(da);
        return ((Array.isArray(b.mailLinks) ? b.mailLinks.length : 0) - (Array.isArray(a.mailLinks) ? a.mailLinks.length : 0));
      });
      g.bundles.sort(function (a, b) {
        return ((Number(b.lastTs) || 0) - (Number(a.lastTs) || 0)) || ((b.mails || []).length - (a.mails || []).length);
      });
      return g;
    });

    return {
      years: years,
      byYear: byYear,
      groups: groups,
      totalCases: totalCases,
      totalBundles: totalBundles,
      totalItems: totalCases + totalBundles,
      totalMails: totalMails,
      totalDirectReport: totalDirectReport
    };
  }

  /* 이알피 비고(note)에 조사 자동연동 블록을 안전하게 병합 (사람이 직접 적은 위·아래 글은 그대로 보존) */
  function mergeErpNote(existingNote, autoBlock) {
    var orig = String(existingNote == null ? '' : existingNote);
    var blk = str(autoBlock);
    var iStart = orig.indexOf(NOTE_START);
    var iEnd = orig.indexOf(NOTE_END);
    if (!blk) return orig;
    var wrapped = NOTE_START + '\n' + blk + '\n' + NOTE_END;
    if (iStart >= 0 && iEnd > iStart) {
      var before = orig.slice(0, iStart).replace(/\s+$/, '');
      var after = orig.slice(iEnd + NOTE_END.length).replace(/^\s+/, '');
      return [before, wrapped, after].filter(Boolean).join('\n\n');
    }
    var trimmed = orig.trim();
    return trimmed ? (trimmed + '\n\n' + wrapped) : wrapped;
  }

  /* 푸른이알피 동기화용 패치 & 업무 메모(case_memos) 결정적 목록 생성
   * - erpDefer === true 이고 아직 erpCaseId 가 없는 과거·보류 사건은
   *   추후 일괄 정리 시점(opts.forceCreate === true 또는 erpDefer 해제)까지 이알피 자동 채번 큐를 발행하지 않는다.
   */
  function buildErpSyncPayload(caseRec, opts) {
    if (!obj(caseRec)) return null;
    var cid = str(caseRec.id);
    var eid = str(caseRec.erpCaseId);
    var forceCreate = !!(opts && opts.forceCreate === true);
    if (!eid && caseRec.erpDefer === true && !forceCreate) return null;
    var steps = obj(caseRec.steps) ? caseRec.steps : {};
    var mails = Array.isArray(caseRec.mailLinks) ? caseRec.mailLinks : [];
    var prog = summarizeProgress(steps, caseRec.closeDate);
    var catShort = (CATEGORIES[caseRec.category] || CATEGORIES.harass).short;

    /* 40자 이내 업무 요약(brief) */
    var brief = '[' + catShort + '조사 ' + prog.doneCount + '/' + prog.totalCount + '] ' + prog.currentStepShort;
    if (mails.length > 0) brief += ' · 메일' + mails.length;
    brief = brief.slice(0, 40);

    /* 자동연동 비고 블록 & 단계별 결정적 메모(cm-hi-...) */
    var pmCode = classifyPerformMode(caseRec);
    var pmInfo = PERFORM_MODES[pmCode] || PERFORM_MODES.advisory_rep;
    var noteLines = [
      '수행구분: ' + pmInfo.icon + ' ' + pmInfo.label,
      '진행률: ' + prog.doneCount + '/' + prog.totalCount + '단계 (' + prog.progressPct + '%) · 수집 공문·메일 ' + mails.length + '건'
    ];
    var memos = [];
    STEPS.forEach(function (def) {
      var st = steps[def.code];
      if (!st || !st.done) return;
      var dTxt = st.date ? (' (' + st.date + ')') : '';
      var nTxt = st.note ? (' — ' + str(st.note).slice(0, 80)) : '';
      noteLines.push('✓ ' + def.name + dTxt + nTxt);
      memos.push({
        memoKey: 'cm-hi-' + safeKey(cid) + '-step-' + def.code,
        date: st.date || ymdOf(Date.now()),
        text: '🛡️ [' + catShort + '조사 진행] ' + def.name + ' 완료' + dTxt + nTxt
      });
    });

    /* 주요 공문·보고서·계약 메일(최대 20건)도 사건 업무 메모 타임라인으로 기록 */
    mails.slice(0, 20).forEach(function (ml) {
      if (!obj(ml) || !ml.key) return;
      var rLabel = (DOC_ROLES[ml.docRole] || DOC_ROLES.general).label;
      var dirTxt = ml.dir === 'out' ? '발신' : '수신';
      var attTxt = (Array.isArray(ml.attNames) && ml.attNames.length) ? (' [첨부: ' + ml.attNames.join(', ').slice(0, 60) + ']') : '';
      memos.push({
        memoKey: 'cm-hi-' + safeKey(cid) + '-mail-' + safeKey(ml.key),
        date: ml.date || ymdOf(Date.now()),
        text: '📧 [' + rLabel + '·' + dirTxt + '] ' + (ml.date ? ml.date + ' ' : '') + str(ml.subject).slice(0, 80) + attTxt
      });
    });

    return {
      id: cid,
      harassCaseId: cid,
      erpCaseId: str(caseRec.erpCaseId),
      action: str(caseRec.erpCaseId) ? 'sync' : 'create_and_sync',
      companyId: str(caseRec.companyId),
      companyLinkStatus: str(caseRec.companyId) ? 'linked' : 'pending',
      companyName: str(caseRec.companyName),
      bizNo: str(caseRec.bizNo),
      category: str(caseRec.category || 'harass'),
      title: str(caseRec.title) || (str(caseRec.companyName) + ' ' + (CATEGORIES[caseRec.category] || CATEGORIES.harass).label + ' 조사'),
      managerMain: str(caseRec.managerMain),
      managerSubs: Array.isArray(caseRec.managerSubs) ? caseRec.managerSubs.slice(0, 5) : [],
      receiveDate: str(caseRec.receiveDate),
      dueDate: str(caseRec.dueDate),
      closeDate: str(caseRec.closeDate),
      erpStatus: prog.erpStatus,
      erpBrief: brief,
      erpNoteBlock: noteLines.join('\n'),
      harassSummary: {
        harassCaseId: cid,
        category: str(caseRec.category || 'harass'),
        doneCount: prog.doneCount,
        totalCount: prog.totalCount,
        progressPct: prog.progressPct,
        currentStep: prog.currentStep,
        currentStepName: prog.currentStepName,
        mailCount: mails.length,
        verdictSummary: str(caseRec.verdictSummary),
        steps: STEPS.map(function (d) {
          var s = steps[d.code] || {};
          return { code: d.code, no: d.no, short: d.short, done: !!s.done, date: str(s.date), note: str(s.note).slice(0, 80) };
        }),
        syncedAt: Date.now()
      },
      memos: memos
    };
  }

  /* 노동청 연장기한을 반영한 유효 보고마감일 계산 (2차 연장 > 1차 연장 > 최초 보고기한) */
  function effectiveDueDateOf(caseRec) {
    if (!obj(caseRec)) return '';
    var d2 = str(caseRec.extDue2);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d2)) return d2;
    var d1 = str(caseRec.extDue1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d1)) return d1;
    var d0 = str(caseRec.dueDate);
    return /^\d{4}-\d{2}-\d{2}$/.test(d0) ? d0 : '';
  }

  /* 사건·쟁점 특성에 맞는 적용 법령 요건 코드 추론 */
  function inferIssueLawType(issue, caseRec) {
    var iss = obj(issue) ? issue : {};
    var c = obj(caseRec) ? caseRec : {};
    var explicit = str(iss.lawType);
    if (explicit && LEGAL_SCHEMAS[explicit]) return explicit;
    if (str(c.caseSubType) === 'third_party') return 'third_party';
    var cat = str(c.category) || 'harass';
    if (cat === 'sexual') return 'sexual';
    if (cat === 'both') {
      var probe = str(iss.title) + ' ' + str(iss.claimVictim) + ' ' + str(iss.evidenceNote);
      if (/성희롱|성폭력|성추행|성적|신체\s*접촉|외모\s*평가|음담패설|성비위/.test(probe)) return 'sexual';
      return 'harass';
    }
    return 'harass';
  }

  function getLegalSchema(categoryOrCase, subType, issueLawType) {
    if (issueLawType && LEGAL_SCHEMAS[issueLawType]) return LEGAL_SCHEMAS[issueLawType];
    var cat = obj(categoryOrCase) ? str(categoryOrCase.category) : str(categoryOrCase);
    var sub = obj(categoryOrCase) ? str(categoryOrCase.caseSubType) : str(subType);
    if (sub === 'third_party') return LEGAL_SCHEMAS.third_party;
    if (cat === 'sexual') return LEGAL_SCHEMAS.sexual;
    return LEGAL_SCHEMAS.harass;
  }

  /* 행위(쟁점) 1건의 근로기준법 제76조의2 / 남녀고평법 제14조 / 제3자 3요건 자동 판정 보조 */
  function judgeIssue(issue) {
    if (!obj(issue)) return 'hold';
    var fact = str(issue.factStatus); /* recognized | partial | unrecognized */
    if (fact === 'unrecognized') return 'no';
    if (fact !== 'recognized' && fact !== 'partial') return 'hold';
    var e1 = str(issue.elemSuperiority); /* yes | no | hold */
    var e2 = str(issue.elemBeyondScope);
    var e3 = str(issue.elemHarm);
    if (e1 === 'no' || e2 === 'no' || e3 === 'no') return 'no';
    if (e1 === 'yes' && e2 === 'yes' && e3 === 'yes') return 'yes';
    return 'hold';
  }

  /* 호증(갑·을·참고자료) 순번 자동 편철 및 표준 호증명 생성 */
  function renumberEvidences(evidences) {
    var list = (Array.isArray(evidences) ? evidences : []).filter(function (x) { return obj(x) && !x._deleted; });
    var counts = { gap: 0, eul: 0, ref: 0 };
    var sideOrder = { gap: 1, eul: 2, ref: 3 };
    var sorted = list.slice().sort(function (a, b) {
      var sa = sideOrder[str(a.side)] || 3;
      var sb = sideOrder[str(b.side)] || 3;
      if (sa !== sb) return sa - sb;
      var da = str(a.date), db = str(b.date);
      if (da && db && da !== db) return da.localeCompare(db);
      return str(a.id).localeCompare(str(b.id));
    });
    return sorted.map(function (ev) {
      var side = str(ev.side);
      if (side !== 'gap' && side !== 'eul') side = 'ref';
      counts[side] += 1;
      var no = counts[side];
      var prefix = side === 'gap' ? ('갑 제' + no + '호증')
        : side === 'eul' ? ('을 제' + no + '호증')
        : ('참고자료 ' + no);
      return Object.assign({}, ev, {
        side: side,
        no: no,
        exhibitNo: prefix,
        title: maskRrnText(str(ev.title) || '제출 증빙자료'),
        submitter: maskRrnText(str(ev.submitter)),
        summary: maskRrnText(str(ev.summary))
      });
    });
  }

  /* 사건 수집 메일·첨부파일로부터 호증 목록 자동 추출 (이미 연결된 mailKey 는 중복 건너뜀) */
  function extractEvidencesFromMails(caseRec, existingEvidences) {
    var c = obj(caseRec) ? caseRec : {};
    var cur = (Array.isArray(existingEvidences) ? existingEvidences : []).filter(function (x) { return obj(x) && !x._deleted; });
    var seenMailKeys = {};
    cur.forEach(function (ev) {
      if (str(ev.mailKey)) seenMailKeys[str(ev.mailKey)] = 1;
    });
    var added = [];
    (Array.isArray(c.mailLinks) ? c.mailLinks : []).forEach(function (ml, idx) {
      if (!obj(ml) || !str(ml.key) || seenMailKeys[str(ml.key)]) return;
      var role = str(ml.docRole);
      var subj = str(ml.subject);
      var atts = Array.isArray(ml.attNames) ? ml.attNames.map(str).filter(Boolean) : [];
      if (!atts.length && role === 'general') return;
      var side = 'ref';
      var submitter = '사업장·공통';
      var combinedText = subj + ' ' + atts.join(' ');
      if (role === 'accused_stmt' || /피신고인|행위자|피진정인|소명|경위서|반박/.test(combinedText)) {
        side = 'eul';
        submitter = '피신고인 측';
      } else if (role === 'victim_stmt' || /(?:^|[^피])신고인|피해자|진정인|진단서|진료|고충\s*신고/.test(combinedText)) {
        side = 'gap';
        submitter = '신고인 측';
      }
      var title = atts.length ? atts.join(', ') : (subj || '수집 공문·자료');
      added.push({
        id: 'ev_' + safeKey(ml.key).slice(0, 48) + '_' + idx,
        side: side,
        date: str(ml.date),
        title: maskRrnText(title),
        submitter: submitter,
        summary: maskRrnText(subj + (atts.length ? ' (첨부 ' + atts.length + '건)' : '')),
        mailKey: str(ml.key)
      });
      seenMailKeys[str(ml.key)] = 1;
    });
    return renumberEvidences(cur.concat(added));
  }

  /* 일자순 사건 타임라인 및 양측 주장·객관적 증거 대조표 생성 */
  function buildCaseTimelineRows(caseRec, secretRec) {
    var c = obj(caseRec) ? caseRec : {};
    var sec = obj(secretRec) ? secretRec : {};
    var rows = [];
    var evs = renumberEvidences(sec.evidences || []);

    (Array.isArray(sec.issues) ? sec.issues : []).filter(function (x) { return obj(x) && !x._deleted; }).forEach(function (iss, idx) {
      var m = /(\d{4}[-./]\d{1,2}[-./]\d{1,2})/.exec(str(iss.whenWhere));
      var dStr = m ? m[1].replace(/[./]/g, '-').replace(/-(\d)(?=-|$)/g, '-0$1') : '';
      rows.push({
        date: dStr || str(iss.whenWhere) || '-',
        sortKey: /^\d{4}-\d{2}-\d{2}$/.test(dStr) ? dStr : ('9999-' + String(idx + 1).padStart(2, '0')),
        kind: '쟁점 ' + (idx + 1),
        title: maskRrnText(str(iss.title) || '쟁점 행위'),
        victimSide: maskRrnText(str(iss.claimVictim) || '-'),
        accusedSide: maskRrnText(str(iss.claimAccused) || '-'),
        objectiveFact: maskRrnText(str(iss.evidenceNote) || '-')
      });
    });

    (Array.isArray(sec.interviews) ? sec.interviews : []).filter(function (x) { return obj(x) && !x._deleted; }).forEach(function (iv) {
      var dStr = str(iv.date);
      var sum = maskRrnText(str(iv.summary) || '(면담 실시)');
      rows.push({
        date: dStr || '-',
        sortKey: /^\d{4}-\d{2}-\d{2}$/.test(dStr) ? dStr : '9998-00',
        kind: iv.role === 'accused' ? '피신고인 면담' : iv.role === 'witness' ? '참고인 면담' : '신고인 면담',
        title: maskRrnText((str(iv.alias) || '익명') + (iv.stmtSigned ? ' (서명필)' : '')),
        victimSide: iv.role === 'victim' ? sum : '-',
        accusedSide: iv.role === 'accused' ? sum : '-',
        objectiveFact: iv.role === 'witness' ? sum : (iv.stmtSigned ? '진술확인 전자서명 봉인' : '면담 조서 작성')
      });
    });

    evs.forEach(function (ev) {
      var dStr = str(ev.date);
      rows.push({
        date: dStr || '-',
        sortKey: /^\d{4}-\d{2}-\d{2}$/.test(dStr) ? dStr : '9998-50',
        kind: ev.exhibitNo,
        title: ev.title,
        victimSide: ev.side === 'gap' ? (ev.summary || ev.title) : '-',
        accusedSide: ev.side === 'eul' ? (ev.summary || ev.title) : '-',
        objectiveFact: ev.side === 'ref' ? (ev.summary || ev.title) : ('제출인: ' + (ev.submitter || '-'))
      });
    });

    rows.sort(function (a, b) { return a.sortKey.localeCompare(b.sortKey); });
    return rows;
  }

  /* 조직 실태조사 무기명 보안 설문 응답 집계 */
  function aggregateSurveyResponses(responses, questions) {
    var qs = Array.isArray(questions) && questions.length ? questions : SURVEY_QUESTIONS;
    var list = (Array.isArray(responses) ? responses : []).filter(function (r) { return obj(r) && !r._deleted; });
    var total = list.length;
    var stats = qs.map(function (q) {
      var opts = Array.isArray(q.opts) ? q.opts : [];
      var counts = opts.map(function () { return 0; });
      list.forEach(function (r) {
        var ansObj = obj(r.answers) ? r.answers : {};
        var v = ansObj[q.id];
        var idx = typeof v === 'number' ? v : opts.indexOf(str(v));
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      });
      var highRiskCnt = (counts[2] || 0) + (counts[3] || 0);
      var highRiskPct = total > 0 ? Math.round((highRiskCnt / total) * 100) : 0;
      return {
        id: q.id,
        q: q.q,
        opts: opts,
        counts: counts,
        highRiskCnt: highRiskCnt,
        highRiskPct: highRiskPct
      };
    });
    var comments = list.map(function (r) { return maskRrnText(str(r.freeComment || r.amendNote)); }).filter(Boolean);
    return { total: total, items: stats, comments: comments };
  }

  /* 인정 쟁점 및 가중·감경 요소 기반 징계 양정 참고 수준 산출 */
  function suggestDisciplinaryLevel(issues, opts) {
    var o = obj(opts) ? opts : {};
    var active = (Array.isArray(issues) ? issues : []).filter(function (x) { return obj(x) && !x._deleted; });
    var recIssues = active.filter(function (iss) { return (str(iss.verdict) || judgeIssue(iss)) === 'yes'; });
    if (!recIssues.length && !o.hasSecondaryHarm) {
      return { score: 0, recCount: 0, guide: null, summary: '인정된 괴롭힘·성희롱 쟁점이 없어 징계 대상 아님 (조직 갈등 중재·예방교육 권고)' };
    }
    var score = recIssues.length * 2;
    recIssues.forEach(function (iss) {
      var txt = str(iss.title) + ' ' + str(iss.claimVictim) + ' ' + str(iss.evidenceNote);
      if (/폭행|상해|투척|강제\s*추행|신체\s*접촉|성추행/.test(txt)) score += 4;
      else if (/반복|지속|수차례|장기간|집단|따돌림|배제|진단서|정신과/.test(txt)) score += 2;
    });
    if (o.hasSecondaryHarm) score += 4;
    if (o.isRepeatedOffender) score += 2;
    if (o.hasSincereApology && score > 1) score -= 1;

    var idx = score >= 9 ? 3 : score >= 6 ? 2 : score >= 3 ? 1 : 0;
    var g = DISCIPLINARY_GUIDE[idx];
    return {
      score: score,
      recCount: recIssues.length,
      guide: g,
      summary: '인정 쟁점 ' + recIssues.length + '건 (참고 양정점수 ' + score + '점) → 통상 권고 수위: 【 ' + g.name + ' 】'
    };
  }

  /* 재진정 · 지노위 연계 사건 시 선행 조사 쟁점 vs 현 사건 주장 쟁점 비교 */
  function buildRecomplaintComparison(curCase, curSec, priorCase, priorSec) {
    var cIss = (obj(curSec) && Array.isArray(curSec.issues)) ? curSec.issues.filter(function (x) { return obj(x) && !x._deleted; }) : [];
    var pIss = (obj(priorSec) && Array.isArray(priorSec.issues)) ? priorSec.issues.filter(function (x) { return obj(x) && !x._deleted; }) : [];
    function normTok(s) { return str(s).replace(/[^\uAC00-\uD7A3A-Za-z0-9]/g, '').toLowerCase(); }
    var rows = cIss.map(function (ci, idx) {
      var cn = normTok(ci.title);
      var matched = null;
      for (var j = 0; j < pIss.length; j++) {
        var pn = normTok(pIss[j].title);
        if (cn && pn && (cn.indexOf(pn.slice(0, 6)) >= 0 || pn.indexOf(cn.slice(0, 6)) >= 0)) {
          matched = pIss[j];
          break;
        }
      }
      var curRes = str(ci.verdict) || judgeIssue(ci);
      var prevRes = matched ? (str(matched.verdict) || judgeIssue(matched)) : '';
      return {
        seq: idx + 1,
        curTitle: maskRrnText(str(ci.title) || ('쟁점 ' + (idx + 1))),
        whenWhere: maskRrnText(str(ci.whenWhere)),
        isDuplicate: !!matched,
        statusLabel: matched ? '기조사 중복 쟁점' : '신규 추가 쟁점',
        priorTitle: matched ? maskRrnText(str(matched.title)) : '(1차 조사 미포함)',
        priorVerdict: matched ? (prevRes === 'yes' ? '기인정' : prevRes === 'no' ? '기불인정' : '검토이력') : '-',
        curVerdict: curRes === 'yes' ? '인정' : curRes === 'no' ? '불인정' : '검토중',
        scopeNote: matched ? '선행 조사 기록·증거 원용 및 신규 증빙 유무만 보충 확인' : '신규 사실관계 및 당사자 문답 집중 조사 대상'
      };
    });
    var dupCnt = rows.filter(function (r) { return r.isDuplicate; }).length;
    return {
      priorCaseTitle: obj(priorCase) ? str(priorCase.title) : '',
      priorCloseDate: obj(priorCase) ? str(priorCase.closeDate || priorCase.receiveDate) : '',
      totalCurrent: rows.length,
      duplicateCount: dupCnt,
      newCount: rows.length - dupCnt,
      rows: rows
    };
  }

  /* 보고서·열람청구 대응용 비식별 익명본(신고인 A · 피신고인 B · 참고인 C · 사업장 甲) 일괄 변환 */
  function anonymizeReportPackage(caseRec, secretRec, opts) {
    var c = obj(caseRec) ? Object.assign({}, caseRec) : {};
    var sec = obj(secretRec) ? Object.assign({}, secretRec) : {};
    var o = obj(opts) ? opts : {};
    var maskCo = o.maskCompany !== false;
    var ivs = (Array.isArray(sec.interviews) ? sec.interviews : []).filter(function (x) { return obj(x) && !x._deleted; });

    var roleBuckets = { victim: [], accused: [], witness: [] };
    ivs.forEach(function (iv) {
      var r = iv.role === 'accused' ? 'accused' : iv.role === 'witness' ? 'witness' : 'victim';
      roleBuckets[r].push(iv);
    });

    var replacements = [];
    var aliasByIvId = {};
    var titleSuffixRe = /\s*(?:대표이사|본부장|센터장|사업소장|연구소장|부원장|원장|관장|소장|국장|실장|부장|차장|과장|팀장|계장|주임|대리|사원|책임|선임|전임|매니저|프로|선생님|교사|보육교사|간호사|기사|반장|조장|점장|근로감독관|감독관|공인노무사|노무사|조사위원|조사원|점검원|변호사|위원|님|씨)\s*$/;

    var rolePrefixRe = /^(?:신고인|피신고인|참고인|신청인|피신청인|행위자|피해자)\s+/;
    var alreadyCodeRe = /^(?:익명(?:\s*참여자)?|(?:신고인|피신고인|참고인)(?:\s*(?:[A-Z](?:-\d+)?|\d+|[가나다라마바사아자차카타파하]|[갑을병정]))?)$/;
    var nonNameWordsRe = /^(?:신고인|피신고인|참고인|신청인|피신청인|행위자|피해자|담당자|관리자|근로자|조사원|조사위원|조사역|점검원|감독관|근로감독관|노무사|공인노무사|변호사|위원장|심의위원|감사역|외부위원|내부위원|책임|담당|외부|내부|공동|수석|대표|전문|독립|자문|선임|출석|재적|참석|소속|관련|익명|본인|타인|직원|임원|팀원|부서장|인사팀|총무팀|감사실)$/;

    function registerPersonAlias(rawAlias, codeLabel) {
      var full = str(rawAlias);
      if (!full || alreadyCodeRe.test(full)) return;
      replacements.push({ from: full, to: codeLabel });
      var noParen = str(full.replace(/\([^)]*\)/g, ''));
      var strippedPrefix = str(noParen.replace(rolePrefixRe, ''));
      var bare = str(strippedPrefix.replace(titleSuffixRe, ''));
      if (strippedPrefix && strippedPrefix.length >= 2 && strippedPrefix !== full && !alreadyCodeRe.test(strippedPrefix) && !nonNameWordsRe.test(strippedPrefix)) {
        replacements.push({ from: strippedPrefix, to: codeLabel });
      }
      if (bare && bare.length >= 2 && bare !== full && bare !== strippedPrefix && !alreadyCodeRe.test(bare) && !nonNameWordsRe.test(bare)) {
        replacements.push({ from: bare, to: codeLabel });
      }
    }

    function registerDeptName(rawDept) {
      var d = str(rawDept);
      if (!d || d === '관련 부서' || d.length < 2) return;
      replacements.push({ from: d, to: '관련 부서' });
    }

    ['victim', 'accused', 'witness'].forEach(function (role) {
      var arr = roleBuckets[role];
      var baseCode = role === 'victim' ? '신고인 A' : role === 'accused' ? '피신고인 B' : '참고인 C';
      arr.forEach(function (iv, i) {
        var lbl = arr.length > 1 ? (baseCode + '-' + (i + 1)) : baseCode;
        aliasByIvId[iv.id] = lbl;
        registerPersonAlias(iv.alias, lbl);
        registerDeptName(iv.dept);
      });
    });

    /* 사전 의견청취·종결합의 확인서에만 적힌 당사자 성명·부서도 비식별 기호 사전에 함께 등록 */
    (Array.isArray(sec.victimOpinions) ? sec.victimOpinions : []).forEach(function (vo) {
      if (obj(vo) && !vo._deleted) {
        if (str(vo.alias)) registerPersonAlias(vo.alias, '신고인 A');
        registerDeptName(vo.dept);
      }
    });
    (Array.isArray(sec.closureConsents) ? sec.closureConsents : []).forEach(function (cl) {
      if (obj(cl) && !cl._deleted) {
        if (str(cl.alias)) {
          var clCode = cl.role === 'accused' ? '피신고인 B' : cl.role === 'witness' ? '참고인 C' : '신고인 A';
          registerPersonAlias(cl.alias, clCode);
        }
        registerDeptName(cl.dept);
      }
    });
    (Array.isArray(sec.surveyResponses) ? sec.surveyResponses : []).forEach(function (sv) {
      if (obj(sv) && !sv._deleted) registerDeptName(sv.dept);
    });
    if (Array.isArray(o.extraMaskNames)) {
      o.extraMaskNames.forEach(function (nm) {
        if (str(nm)) registerPersonAlias(nm, '담당 전문가');
      });
    }

    /* 모든 출력 대상 자유서술 칸(templateMeta·issues·interviews·evidences·본문 등)에 등장하는 양방향 어순 직함 인명 및 관리번호 사전 수집 */
    var postTitleNonNamesRe = /^(?:검토|조사|면담|심의|의견|참석|출석|확인|선임|위촉|입회|주재|보고|판단|구성|전원|과반|외부|내부|공동|단독|작성|서명|날인|진술|소명|제척|기피|회피|자문|배석|주관|수행|명의|측|등|외)$/;
    var koreanNameEndingRe = /(?:이셨습니다|이었습니다|이십니다|입니다|였습니다|이라며|이라고|이라서|이므로|이지만|이시며|이고|이며|이나|이라|께서|에게서|에게|한테서|한테|으로|로써|로서|부터|까지|[이가은는을를의과와도만로])$/;
    var titledPersonScanRe = /([가-힣]{2,4})\s*[:：]?\s*(공인노무사|노무사|변호사|조사위원|조사원|조사역|점검원|근로감독관|감독관|심의위원|위원장|감사역)/g;
    var titleFirstScanRe = /(공인노무사|노무사|변호사|조사위원|조사원|조사역|점검원|근로감독관|감독관|심의위원|위원장|감사역)\s*[:：]?\s*([가-힣]{2,12})(?![가-힣])/g;
    function harvestTitledNamesFromText(txt) {
      var s = str(txt);
      if (!s || s.indexOf('data:image/') === 0) return;
      var m;
      titledPersonScanRe.lastIndex = 0;
      while ((m = titledPersonScanRe.exec(s)) !== null) {
        var candName = str(m[1]);
        var candTitle = str(m[2]);
        if (candName && !nonNameWordsRe.test(candName) && !postTitleNonNamesRe.test(candName)) {
          replacements.push({ from: m[0], to: '담당 ' + candTitle });
          replacements.push({ from: candName, to: '담당 ' + candTitle });
        } else {
          titledPersonScanRe.lastIndex = m.index + m[1].length;
        }
      }
      titleFirstScanRe.lastIndex = 0;
      while ((m = titleFirstScanRe.exec(s)) !== null) {
        var tRole = str(m[1]);
        var rawAfter = str(m[2]);
        var strippedJosa = rawAfter.length >= 3 ? rawAfter.replace(koreanNameEndingRe, '') : rawAfter;
        var checkCand = (strippedJosa.length >= 2 && strippedJosa.length <= 4) ? strippedJosa : rawAfter;
        if (checkCand.length >= 2 && checkCand.length <= 4 && !nonNameWordsRe.test(checkCand) && !postTitleNonNamesRe.test(checkCand) && !postTitleNonNamesRe.test(rawAfter)) {
          var tailLen = rawAfter.length - checkCand.length;
          var matchedPhrase = tailLen > 0 ? m[0].slice(0, m[0].length - tailLen) : m[0];
          replacements.push({ from: matchedPhrase, to: '담당 ' + tRole });
          replacements.push({ from: checkCand, to: '담당 ' + tRole });
        } else {
          titleFirstScanRe.lastIndex = m.index + m[1].length;
        }
      }
    }
    var nonHarvestKeys = { signaturePng: 1, id: 1, caseId: 1, fileHash: 1, sha256: 1, mimeType: 1 };
    function harvestAllRecordStrings(node, keyName, depth) {
      if (depth > 6 || node == null) return;
      if (typeof node === 'string') {
        if ((keyName === 'docRefNo' || keyName === 'agendaNo') && str(node)) {
          replacements.push({ from: str(node), to: '(문서번호 비식별)' });
        } else if (!nonHarvestKeys[keyName]) {
          harvestTitledNamesFromText(node);
        }
        return;
      }
      if (Array.isArray(node)) {
        for (var idx = 0; idx < node.length; idx++) {
          if (obj(node[idx]) && node[idx]._deleted) continue;
          harvestAllRecordStrings(node[idx], keyName, depth + 1);
        }
        return;
      }
      if (obj(node)) {
        if (node._deleted) return;
        var ks = Object.keys(node);
        for (var ki = 0; ki < ks.length; ki++) {
          var k = ks[ki];
          if (nonHarvestKeys[k]) continue;
          harvestAllRecordStrings(node[k], k, depth + 1);
        }
      }
    }
    harvestAllRecordStrings(c, '', 0);
    harvestAllRecordStrings(sec, '', 0);

    if (str(c.erpCaseNo)) replacements.push({ from: str(c.erpCaseNo), to: '(관리번호 비식별)' });
    if (str(c.caseNo)) replacements.push({ from: str(c.caseNo), to: '(관리번호 비식별)' });

    if (maskCo && str(c.companyName)) {
      var fullCo = str(c.companyName);
      replacements.push({ from: fullCo, to: '의뢰 사업장(甲)' });
      var strippedCo = str(fullCo.replace(/\((?:주|유|합|사|재|학|의)\)|주식회사|유한회사|사단법인|재단법인|사회복지법인/g, ''));
      if (strippedCo.length >= 2 && strippedCo !== fullCo) {
        replacements.push({ from: strippedCo, to: '의뢰 사업장(甲)' });
      }
    }
    if (maskCo && str(c.bizNo)) {
      replacements.push({ from: str(c.bizNo), to: '***-**-*****' });
      var bizDigits = str(c.bizNo).replace(/\D+/g, '');
      if (bizDigits.length === 10) {
        replacements.push({ from: bizDigits.slice(0, 3) + '-' + bizDigits.slice(3, 5) + '-' + bizDigits.slice(5), to: '***-**-*****' });
        replacements.push({ from: bizDigits.slice(0, 3) + ' ' + bizDigits.slice(3, 5) + ' ' + bizDigits.slice(5), to: '***-**-*****' });
        replacements.push({ from: bizDigits.slice(0, 3) + '.' + bizDigits.slice(3, 5) + '.' + bizDigits.slice(5), to: '***-**-*****' });
        replacements.push({ from: bizDigits, to: '***-**-*****' });
      }
    }
    if (str(c.inspectorName)) {
      registerPersonAlias(c.inspectorName, '담당 감독관');
      replacements.push({ from: str(c.inspectorName), to: '담당 감독관' });
    }
    if (str(c.govCaseNo)) {
      replacements.push({ from: str(c.govCaseNo), to: '(사건번호 비식별)' });
    }
    (Array.isArray(c.monitoringLogs) ? c.monitoringLogs : []).forEach(function (lg) {
      if (obj(lg) && str(lg.checker)) {
        registerPersonAlias(lg.checker, '담당 조사역');
        replacements.push({ from: str(lg.checker), to: '담당 조사역' });
      }
    });

    /* 긴 문자열부터 먼저 치환하여 부분 일치 깨짐 방지 (중복 등록 제거) */
    var seenFrom = Object.create(null);
    replacements = replacements.filter(function (pair) {
      if (!pair.from || seenFrom[pair.from]) return false;
      seenFrom[pair.from] = 1;
      return true;
    }).sort(function (a, b) { return b.from.length - a.from.length; });

    function scrubAnonText(s) {
      var out = maskRrnText(String(s == null ? '' : s));
      if (!out) return '';
      replacements.forEach(function (pair) {
        if (pair.from && out.indexOf(pair.from) >= 0) {
          out = out.split(pair.from).join(pair.to);
        }
      });
      /* 휴대전화·일반전화·이메일·사업자번호·행정사건번호 비식별화 */
      out = out.replace(/\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b/g, '$1-****-$3');
      out = out.replace(/\b(0\d{1,2})[-.\s](\d{3,4})[-.\s](\d{4})\b/g, '$1-****-$3');
      out = out.replace(/\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, '$1***@$2');
      if (maskCo) {
        out = out.replace(/\b\d{3}-\d{2}-\d{5}\b/g, '***-**-*****');
      }
      out = out.replace(/(?:진정|고소|고발|사건|접수)[\s-]*(?:제\s*)?\d{4}[-.\s]\d{2,8}\s*호?/g, '(사건번호 비식별)');
      return out;
    }

    var anonSteps = {};
    if (obj(c.steps)) {
      Object.keys(c.steps).forEach(function (sk) {
        var st = c.steps[sk];
        if (obj(st)) {
          anonSteps[sk] = Object.assign({}, st, { note: scrubAnonText(st.note) });
        }
      });
    }

    var anonCase = Object.assign({}, c, {
      companyName: maskCo ? '의뢰 사업장(甲)' : scrubAnonText(c.companyName),
      bizNo: maskCo ? '' : str(c.bizNo),
      erpCaseNo: '',
      caseNo: '',
      title: scrubAnonText(c.title),
      inspectorName: str(c.inspectorName) ? '담당 감독관' : '',
      govCaseNo: str(c.govCaseNo) ? '(사건번호 비식별)' : '',
      steps: anonSteps,
      monitoringLogs: (Array.isArray(c.monitoringLogs) ? c.monitoringLogs : []).map(function (lg) {
        return Object.assign({}, lg, {
          note: scrubAnonText(lg && lg.note),
          status: scrubAnonText(lg && lg.status),
          checker: lg && lg.checker ? '담당 조사역' : ''
        });
      }),
      mailLinks: (Array.isArray(c.mailLinks) ? c.mailLinks : []).map(function (m) {
        return Object.assign({}, m, {
          subject: scrubAnonText(m.subject),
          from: scrubAnonText(m.from),
          attNames: (Array.isArray(m.attNames) ? m.attNames : []).map(scrubAnonText)
        });
      })
    });

    var anonSec = Object.assign({}, sec, {
      overview: scrubAnonText(sec.overview),
      conclusion: scrubAnonText(sec.conclusion),
      recommendations: scrubAnonText(sec.recommendations),
      companyRuleQuote: scrubAnonText(sec.companyRuleQuote),
      reportBody: scrubAnonText(sec.reportBody),
      interviews: ivs.map(function (iv) {
        return Object.assign({}, iv, {
          alias: aliasByIvId[iv.id] || scrubAnonText(iv.alias) || '익명 참여자',
          dept: iv.dept ? '관련 부서' : '',
          summary: scrubAnonText(iv.summary),
          amendNote: scrubAnonText(iv.amendNote),
          sigDataUrl: '', /* 익명 열람본에는 자필서명 필적 이미지를 싣지 않아 신원 노출 원천 차단 */
          qaList: (Array.isArray(iv.qaList) ? iv.qaList : []).map(function (qa) {
            return { q: scrubAnonText(qa && qa.q), a: scrubAnonText(qa && qa.a) };
          })
        });
      }),
      issues: (Array.isArray(sec.issues) ? sec.issues : []).filter(function (x) { return obj(x) && !x._deleted; }).map(function (iss) {
        return Object.assign({}, iss, {
          title: scrubAnonText(iss.title),
          whenWhere: scrubAnonText(iss.whenWhere),
          claimVictim: scrubAnonText(iss.claimVictim),
          claimAccused: scrubAnonText(iss.claimAccused),
          evidenceNote: scrubAnonText(iss.evidenceNote),
          credibilityNote: scrubAnonText(iss.credibilityNote)
        });
      }),
      templateMeta: (function () {
        var rawTm = obj(sec.templateMeta) ? sec.templateMeta : {};
        var cleanTm = {};
        Object.keys(rawTm).forEach(function (k) {
          var v = rawTm[k];
          if (typeof v === 'string') {
            cleanTm[k] = (k === 'docRefNo' || k === 'agendaNo') ? (str(v) ? '(문서번호 비식별)' : '') : scrubAnonText(v);
          } else if (typeof v === 'boolean' || typeof v === 'number') {
            cleanTm[k] = v;
          } else if (obj(v)) {
            var sub = {};
            Object.keys(v).forEach(function (sk) {
              var sv = v[sk];
              if (typeof sv === 'string') {
                sub[sk] = (sk === 'docRefNo' || sk === 'agendaNo') ? (str(sv) ? '(문서번호 비식별)' : '') : scrubAnonText(sv);
              } else {
                sub[sk] = sv;
              }
            });
            cleanTm[k] = sub;
          }
        });
        return cleanTm;
      })(),
      evidences: (Array.isArray(sec.evidences) ? sec.evidences : []).filter(function (x) { return obj(x) && !x._deleted; }).map(function (ev) {
        return Object.assign({}, ev, {
          title: scrubAnonText(ev.title),
          submitter: scrubAnonText(ev.submitter),
          summary: scrubAnonText(ev.summary)
        });
      }),
      victimOpinions: (Array.isArray(sec.victimOpinions) ? sec.victimOpinions : []).filter(function (x) { return obj(x) && !x._deleted; }).map(function (vo) {
        return Object.assign({}, vo, {
          alias: scrubAnonText(vo.alias) || '신고인 A',
          dept: vo.dept ? '관련 부서' : '',
          measuresText: scrubAnonText(vo.measuresText),
          summary: scrubAnonText(vo.summary),
          amendNote: scrubAnonText(vo.amendNote),
          selectedMeasures: (Array.isArray(vo.selectedMeasures) ? vo.selectedMeasures : []).map(scrubAnonText),
          sigDataUrl: ''
        });
      }),
      closureConsents: (Array.isArray(sec.closureConsents) ? sec.closureConsents : []).filter(function (x) { return obj(x) && !x._deleted; }).map(function (cl) {
        return Object.assign({}, cl, {
          alias: scrubAnonText(cl.alias) || '당사자',
          dept: cl.dept ? '관련 부서' : '',
          summary: scrubAnonText(cl.summary),
          amendNote: scrubAnonText(cl.amendNote),
          sigDataUrl: ''
        });
      }),
      surveyResponses: (Array.isArray(sec.surveyResponses) ? sec.surveyResponses : []).filter(function (x) { return obj(x) && !x._deleted; }).map(function (sv) {
        return Object.assign({}, sv, {
          dept: sv.dept ? '관련 부서' : '',
          freeComment: scrubAnonText(sv.freeComment)
        });
      })
    });

    if (!str(anonSec.reportBody)) {
      anonSec.reportBody = scrubAnonText(assembleReportDraft(anonCase, anonSec, o.reportTemplate));
    } else {
      anonSec.reportBody = scrubAnonText(anonSec.reportBody);
    }

    return {
      caseRec: anonCase,
      secretRec: anonSec,
      aliasPairs: replacements
    };
  }

  /* ═══ 대한민국 노무법인 · 법무법인 · 고용노동부 · 공공기관 · 대기업 6대 마스터 조사양식 체계 ═══ */
  var CREDIBILITY_FACTORS = [
    { key: 'consistency', short: '일관성', label: '① 진술의 일관성 (시간 경과·반복 문답에도 핵심 사실 모순 없음)' },
    { key: 'specificity', short: '구체성', label: '② 내용의 구체성·생생함 (직접 경험자 특유의 세부 정황 묘사)' },
    { key: 'rationality', short: '합리성', label: '③ 경험칙·상식 부합성 (당시 업무 맥락·조직 여건과의 부합)' },
    { key: 'noMotive', short: '허위동기 부재', label: '④ 무고·과장 동기 부재 (인사 불만·보복 등 허위 유인 없음)' },
    { key: 'corroboration', short: '객관증거 부합', label: '⑤ 물증·제3자 목격 부합 (녹취·메신저·참고인 진술 일치)' }
  ];

  function evaluateIssueCredibility(iss) {
    var rec = obj(iss) ? iss : {};
    var cred = obj(rec.credibility) ? rec.credibility : {};
    var checked = [];
    var unchecked = [];
    CREDIBILITY_FACTORS.forEach(function (f) {
      if (cred[f.key] === true || cred[f.key] === 'yes' || cred[f.key] === 1) {
        checked.push(f);
      } else {
        unchecked.push(f);
      }
    });
    var cnt = checked.length;
    var hasAnySet = Object.keys(cred).some(function (k) { return cred[k] !== undefined && cred[k] !== ''; });
    var level = !hasAnySet
      ? (rec.factStatus === 'recognized' ? '인정근거 확보' : rec.factStatus === 'partial' ? '일부 부합' : rec.factStatus === 'unrecognized' ? '입증 부족' : '검토 전')
      : cnt >= 4 ? '신빙성 높음 (' + cnt + '/5)'
      : cnt >= 2 ? '신빙성 보통 (' + cnt + '/5)'
      : '보강증거 필요 (' + cnt + '/5)';
    return {
      count: cnt,
      total: CREDIBILITY_FACTORS.length,
      hasExplicit: hasAnySet,
      level: level,
      checkedLabels: checked.map(function (f) { return f.short; }),
      uncheckedLabels: unchecked.map(function (f) { return f.short; }),
      note: maskRrnText(str(rec.credibilityNote))
    };
  }

  var MOEL_OBLIGATION_CHECKS = [
    { key: 'c1_prompt', label: '지체 없는 객관적 조사 착수·실시 (근기법 제76조의3 제2항 · 남녀고평법 제14조 제2항)' },
    { key: 'c2_interim', label: '조사 기간 중 피해근로자 잠정 보호·분리조치 검토 및 시행 (제3항)' },
    { key: 'c3_victim_op', label: '확정 보호조치 및 행위자 조치 전 피해근로자 사전 의견청취 (제4항·제5항)' },
    { key: 'c4_actor_act', label: '사실 확인 시 행위자에 대한 징계·근무장소 변경 등 지체 없는 조치 (제5항)' },
    { key: 'c5_no_retal', label: '신고인·피해근로자·참고인에 대한 불리한 처우 금지 고지 및 준수 (제6항)' },
    { key: 'c6_secret', label: '조사 참여자 전원 비밀누설 금지 서약 징구 및 기밀 관리 (제7항)' }
  ];

  function isMoelObligationMet(chkKey, caseRec, secRec, optTm) {
    var c = obj(caseRec) ? caseRec : {};
    var sec = obj(secRec) ? secRec : {};
    var tm = obj(optTm) ? optTm : ((obj(sec.templateMeta) && obj(sec.templateMeta.moel_standard)) ? sec.templateMeta.moel_standard : (obj(sec.templateMeta) ? sec.templateMeta : {}));
    var mc = obj(tm.moelChecks) ? tm.moelChecks : {};
    if (mc[chkKey] !== undefined) return !!mc[chkKey];
    var steps = obj(c.steps) ? c.steps : {};
    var ivs = Array.isArray(sec.interviews) ? sec.interviews.filter(function (x) { return obj(x) && !x._deleted; }) : [];
    var vicOps = Array.isArray(sec.victimOpinions) ? sec.victimOpinions.filter(function (x) { return obj(x) && !x._deleted; }) : [];
    if (chkKey === 'c1_prompt') return !!(steps.intake && steps.intake.done);
    if (chkKey === 'c2_interim') return !!(str(tm.interimMeasure) || (steps.pledge && steps.pledge.done));
    if (chkKey === 'c3_victim_op') return vicOps.length > 0;
    if (chkKey === 'c6_secret') return ivs.some(function (iv) { return iv.pledgeSigned; });
    return false;
  }

  var REPORT_TEMPLATES = {
    laborfirm_deep: {
      id: 'laborfirm_deep',
      name: '전문 노무법인 심층 사실조사 표준형',
      short: '노무법인 심층조사형',
      orgType: '전문 노무법인 마스터 표준',
      badge: '사실조사·매트릭스·로드맵',
      docClassBadge: '대외비 · 외부독립조사 보고서',
      docTitleSuffix: '사안 외부전문가 조사결과보고서',
      desc: '당사자·참고인 문답, 갑·을 호증 대조, 쟁점별 법정 3요건 포섭, 단계별 인사조치 실행 로드맵을 가장 균형 있게 수록하는 전문 노무법인 정석 양식입니다.',
      sections: [
        '1. 사건 개요 및 외부조사단 구성',
        '2. 조사 경위 및 공정성·비밀유지 확보 절차',
        '3. 당사자·참고인 진술 요지 및 제출 호증 편철',
        '4. 쟁점 행위별 사실인정 및 법정 성립요건 포섭',
        '5. 종합 판정 결론 및 단계별 인사조치 실행 로드맵'
      ],
      fields: [
        { key: 'investTeam', label: '외부조사단 구성 · 조사방식', type: 'text', placeholder: '예: 책임 공인노무사 외 1인 공동조사 · 독립 대면면담 및 녹취록 교차검증' },
        { key: 'orgContext', label: '당사자 위계 · 조직 맥락 요약', type: 'text', placeholder: '예: 부서장(1차 인사평가권자) 대 실무 담당자 간 직속 지휘·감독 관계' },
        { key: 'actionRoadmap', label: '단계별 후속 실행 로드맵', type: 'textarea', placeholder: '예: ① 피해자 사전의견청취 → ② 인사위원회 회부·소명 부여 → ③ 분리배치 확정 및 1·3·6개월 사후모니터링' }
      ]
    },
    lawfirm_opinion: {
      id: 'lawfirm_opinion',
      name: '대형 법무법인(로펌) 법률검토의견서형',
      short: '법무법인 법률의견서형',
      orgType: '대형 법무법인 인사노무 자문형',
      badge: '결론선제시·신빙성 5지표·리스크',
      docClassBadge: '극비(Strictly Confidential) · 법률검토의견서',
      docTitleSuffix: '사안 사실조사 및 법률검토 의견서',
      desc: '의뢰 질의와 핵심 결론(Executive Summary)을 서두에 배치하고, 대법원 판례 법리에 따른 진술 신빙성 5대 지표 평가와 분쟁·소송 리스크를 정밀 논증하는 로펌 자문 양식입니다.',
      sections: [
        'Ⅰ. 검토 배경 및 핵심 법률의견 요약 (Executive Summary)',
        'Ⅱ. 조사 범위 및 적법절차(방어권 보장) 이행 경과',
        'Ⅲ. 관련 법령·판례 법리 및 사규 체계',
        'Ⅳ. 대법원 판례 기준 진술 신빙성(Credibility) 5대 지표 평가',
        'Ⅴ. 쟁점별 사실관계 확정 및 법리 포섭(Subsumption)',
        'Ⅵ. 인사조치 양정 적정성 및 노동위원회·소송 리스크 진단'
      ],
      fields: [
        { key: 'docRefNo', label: '문서관리번호 · 보안표기', type: 'text', placeholder: '예: 법률의견 제2026-HR-001호 · 인사권자 외 열람금지' },
        { key: 'querySummary', label: '검토 질의 요지 (Issues Presented)', type: 'text', placeholder: '예: 피신고인 각 행위의 직장 내 괴롭힘 성립 여부 및 징계처분 시 법적 유효성 검토' },
        { key: 'litigationRisk', label: '분쟁·소송 리스크 등급', type: 'select', options: [
          { value: 'low', label: '안정 (객관적 물증·절차 확보 — 방어력 충분)' },
          { value: 'mid', label: '보통 (진술 대립 존재 — 양정 비례성·절차 유의)' },
          { value: 'high', label: '주의 (부당징계·재진정 분쟁 가능성 높음 — 보완 권고)' }
        ] },
        { key: 'execSummary', label: '핵심 법률의견 요약 (Brief Answer)', type: 'textarea', placeholder: '서두 Executive Summary 박스에 수록할 결론 선제시 요약을 기재하세요' }
      ]
    },
    moel_standard: {
      id: 'moel_standard',
      name: '고용노동부 매뉴얼 별지 · 감독관 대응형',
      short: '고용노동부 표준·감독관형',
      orgType: '고용노동부 표준매뉴얼 · 지청 보고용',
      badge: '별지표준·근기법 §76조의3 점검표',
      docClassBadge: '법정 조사·조치 이행 증빙문서',
      docTitleSuffix: '고충사건 조사결과 및 법정의무 이행 보고서',
      desc: '고용노동부 《직장 내 괴롭힘 판단 및 예방·대응 매뉴얼》 별지 서식과 근로감독관 진정·개선지도 점검 항목(제76조의3 제2~7항 6대 법정의무)에 1:1 대응하는 행정 입증 양식입니다.',
      sections: [
        '1. 사건 접수 및 당사자 인적사항 (관할 노동관서 연계)',
        '2. 신고 행위 요지 및 객관적 조사 실시 경과',
        '3. 당사자·참고인 문답 요지 및 입증자료 목록',
        '4. 근로기준법 제76조의2(남녀고평법 제14조) 성립요건 판단',
        '5. 사용자 법정의무 6대 항목(제76조의3 제2~7항) 이행 점검표',
        '6. 확정 조치 결과 및 향후 재발방지 시정계획'
      ],
      hasMoelChecklist: true,
      fields: [
        { key: 'intakeRoute', label: '사건 인지 · 접수 경로', type: 'text', placeholder: '예: 사내 고충상담창구 서면 접수 / 관할 노동지청 자체조사 시정지시' },
        { key: 'interimMeasure', label: '조사 중 잠정 보호·분리 내역', type: 'text', placeholder: '예: 접수 당일 유급휴가 부여 및 업무공간 즉시 분리 조치 시행' },
        { key: 'preventPlan', label: '재발방지 및 예방교육 계획', type: 'textarea', placeholder: '예: 전 임직원 특별 예방교육 실시 및 취업규칙 불이익처우 금지 조항 재고지' }
      ]
    },
    public_committee: {
      id: 'public_committee',
      name: '공공기관·공기업 감사실·고충심의위원회형',
      short: '공공기관 고충심의위형',
      orgType: '공공기관 · 지자체 · 출연연 심의표준',
      badge: '부의안건·성인지·심의의결주문',
      docClassBadge: '고충심의위원회 심의·의결 대외비 안건',
      docTitleSuffix: '고충심의위원회 조사결과 및 심의 부의안건서',
      desc: '여성가족부·국가인권위원회·인사혁신처 공공기관 표준지침에 맞춰 안건번호, 외부위원 정족수·제척 확인, 성인지 감수성·2차 피해 검토, 위원회 의결 주문(인용/기각) 및 서명란을 갖춘 양식입니다.',
      sections: [
        'Ⅰ. 부의 안건 개요 및 위원회 구성·제척 확인',
        'Ⅱ. 신청인·피신청인 진술 및 참고인 조사 결과',
        'Ⅲ. 인권·성인지 감수성 및 2차 피해 유발 여부 검토',
        'Ⅳ. 행위별 관계법령 및 기관 인권·복무지침 위반 판단',
        'Ⅴ. 고충심의위원회 의결 주문(안) 및 기관장 조치 건의'
      ],
      fields: [
        { key: 'agendaNo', label: '부의 안건번호 · 소관부서', type: 'text', placeholder: '예: 제2026-고충심의-01호 · 감사실(인권윤리센터)' },
        { key: 'committeeQuorum', label: '외부위원 참여 · 제척 확인', type: 'text', placeholder: '예: 외부 노무·법률 전문가 2인 포함 재적 5인 출석 · 이해충돌 제척사유 없음' },
        { key: 'resolutionOrder', label: '심의위 의결 주문(안)', type: 'select', options: [
          { value: 'uphold', label: '인용 — 직장 내 괴롭힘·성희롱에 해당함 (가결)' },
          { value: 'partial', label: '일부 인용 — 쟁점 중 일부 행위 해당함 (일부 가결)' },
          { value: 'dismiss', label: '기각 — 직장 내 괴롭힘·성희롱에 해당하지 아니함' },
          { value: 'reject', label: '각하 — 심의 대상 불해당 또는 신청인 자유의사 취하' }
        ] },
        { key: 'secondaryHarmNote', label: '성인지 감수성 · 2차피해 검토', type: 'textarea', placeholder: '조사 및 심의 과정에서의 피해자 보호, 성인지 감수성 기준 검토, 소문 유포 등 2차 피해 유무 기재' }
      ]
    },
    corp_executive: {
      id: 'corp_executive',
      name: '대기업 준법감시·경영진(C-Level)·인사위 보고형',
      short: '대기업 경영진 요약형',
      orgType: '대기업 윤리경영 · 준법감시 · 인사위',
      badge: '1쪽 브리프·심각도·리스크 신호등',
      docClassBadge: '경영진 보고용 대외비 (Executive Brief)',
      docTitleSuffix: '윤리·준법감시 특별조사 경영진 보고서',
      desc: '대표이사·인사위원회 의사결정을 위해 첫 장에 심각도 등급(S/A/B/C), 법규·평판 리스크 신호등, 3줄 핵심 결론, 즉시 실행 과제를 요약하고 세부 사실조사를 부록(Annex)으로 편제하는 양식입니다.',
      sections: [
        '[Executive Brief] 핵심 결론 · 심각도 등급 · 리스크 신호등',
        '[Action Plan] 인사위원회 부의 수위 및 즉시 실행 과제',
        '[Annex 1] 쟁점 행위별 사실인정 및 법정요건 요약 매트릭스',
        '[Annex 2] 당사자·참고인 진술 및 핵심 물증(호증) 요지',
        '[Annex 3] 취업규칙·윤리강령 위반 대조 및 조직관리 개선안'
      ],
      fields: [
        { key: 'severityGrade', label: '사안 심각도 등급', type: 'select', options: [
          { value: 'S', label: 'S등급 (Critical — 중대 비위·중징계 및 즉시 분리 필수)' },
          { value: 'A', label: 'A등급 (High — 법 위반 인정·정식 징계 및 부서 조정)' },
          { value: 'B', label: 'B등급 (Medium — 부적절 언행·경고 및 리더십 코칭)' },
          { value: 'C', label: 'C등급 (Low — 법 위반 불인정·자체 종결 및 모니터링)' }
        ] },
        { key: 'riskLegal', label: '법규 · 행정처분 리스크', type: 'select', options: [
          { value: 'green', label: '🟢 안정 (법정 절차 준수 완료)' },
          { value: 'amber', label: '🟡 주의 (후속조치·기한 관리 필요)' },
          { value: 'red', label: '🔴 고위험 (즉시 시정·법률방어 필수)' }
        ] },
        { key: 'riskRep', label: '평판 · 조직이탈 리스크', type: 'select', options: [
          { value: 'green', label: '🟢 안정 (당사자 수용·확산 없음)' },
          { value: 'amber', label: '🟡 주의 (부서 갈등·이직 우려)' },
          { value: 'red', label: '🔴 고위험 (외부 제보·집단 갈등 우려)' }
        ] },
        { key: 'execKeyPoints', label: '경영진 의사결정 3줄 핵심 요약', type: 'textarea', placeholder: '① 사실확인 결과 요약 / ② 권고 인사조치 수위 / ③ 조직 안정화 대책 3줄 요약' }
      ]
    },
    nlrb_defense: {
      id: 'nlrb_defense',
      name: '노동위원회·법원 부당징계 방어 소명형',
      short: '지노위·소송 방어형',
      orgType: '지방노동위원회 · 행정/민사 소송 대응',
      badge: '징계사유·절차·양정 3단 입증',
      docClassBadge: '부당징계·재진정 방어 입증 자료집',
      docTitleSuffix: '징계정당성 입증 사실조사 및 소명 보고서',
      desc: '행위자의 지방노동위원회 부당징계·부당해고 구제신청 또는 재진정에 대비하여 ① 징계사유(사실인정·호증 1:1 매핑), ② 징계절차(방어권 보장), ③ 징계양정(사회통념상 상당성·형평성) 3단 구조로 정리하는 양식입니다.',
      sections: [
        'Ⅰ. 처분(조사) 경위 및 소명절차의 적법성 입증',
        'Ⅱ. 징계(혐의)사유별 구체적 사실인정 및 입증 호증 매핑',
        'Ⅲ. 당사자 진술 신빙성 대비 및 피징계자 주장 반박',
        'Ⅳ. 징계양정의 적정성(비례원칙·동종사례 형평성) 법리 검토',
        'Ⅴ. 선행 사건·재진정 쟁점 구분 및 최종 소명 결론'
      ],
      fields: [
        { key: 'dueProcessNote', label: '방어권 · 소명기회 부여 경과', type: 'text', placeholder: '예: 출석통지 사전 교부, 쟁점별 서면질문지 회신, 면담 진술확인 전자서명 징구 완료' },
        { key: 'equityNote', label: '양정 형평성 · 참작사유 검토', type: 'text', placeholder: '예: 사내 동종 폭언·성희롱 징계 선례 부합, 반복성·2차가해 가중 및 반성 여부 참작' },
        { key: 'defensePoint', label: '예상 다툼 쟁점 및 반박 논리', type: 'textarea', placeholder: '피징계자가 노동위원회에서 주장할 것으로 예상되는 항변(업무상 통상 지시 주장 등)과 객관적 반박 근거' }
      ]
    }
  };

  var STATEMENT_STYLES = {
    confirm_std: {
      id: 'confirm_std',
      label: '노무법인 표준 진술확인서형 (개요표 + 문답표 + 핵심요지 + 서명봉인)',
      short: '표준 진술확인서형'
    },
    legal_record: {
      id: 'legal_record',
      label: '법무법인·조서형 문답조서 (사전고지 + 【문】/【답】 연속 조서체 + 확인서명)',
      short: '법무 문답조서형'
    },
    moel_sheet: {
      id: 'moel_sheet',
      label: '고용노동부 매뉴얼 별지 면담기록지형 (육하원칙 요약칸 + 문답표 + 조사역 확인란)',
      short: '노동부 면담기록지형'
    }
  };

  var INTERVIEW_TEMPLATES = {
    victim_harass: {
      id: 'victim_harass',
      role: 'victim',
      lawType: 'harass',
      label: '신고인(괴롭힘) 육하원칙·3요건 심층 문답지 (8문항)',
      questions: [
        '피신고인과의 소속 부서, 직급·연차 차이, 업무 지시·인사평가 등 지위·관계상 구조를 구체적으로 말씀해 주십시오.',
        '신고하신 핵심 피해 행위가 발생한 일시, 장소, 당시 참석자(목격자) 및 구체적인 발언·행동 경위를 육하원칙에 따라 말씀해 주십시오.',
        '해당 행위가 통상적인 업무 수행이나 업무 지시와 무관하거나 사회통념상 적정범위를 넘었다고 판단하신 구체적인 이유는 무엇입니까?',
        '동일·유사한 행위가 일회성이었습니까, 아니면 일정 기간 반복·지속되었습니까? (빈도 및 기간)',
        '당시 현장에서 거부 의사를 표시하거나 상급자·동료에게 고충을 토로한 사실, 또는 직후 남겨둔 기록(메신저·일지·녹음 등)이 있습니까?',
        '위 행위로 인하여 겪으신 신체적·정신적 고통(병원 진료·상담 여부 포함)이나 실제 업무 수행·근무환경 악화 정황을 말씀해 주십시오.',
        '현재 회사에 희망하시는 잠정·확정 보호조치(근무장소 분리, 부서 전환, 유급휴가 등) 및 행위자에 대한 조치 의견은 무엇입니까?',
        '마지막으로 이번 조사와 관련하여 추가로 제출할 객관적 증거자료나 보충 진술할 사항이 있습니까?'
      ]
    },
    accused_harass: {
      id: 'accused_harass',
      role: 'accused',
      lawType: 'harass',
      label: '피신고인(괴롭힘) 방어권 보장·반박 소명 문답지 (8문항)',
      questions: [
        '본 면담에 앞서 조사 목적, 비밀유지 의무(근기법 제76조의3 제7항), 신고인·참고인에 대한 연락·보복 등 2차 가해 금지 고지사항을 안내받으셨습니까?',
        '신고인과는 언제부터 어떠한 업무 지휘·협업 관계로 근무하셨습니까?',
        '신고인이 제기한 쟁점 일시·장소에서의 발언 또는 행동 사실 자체를 인정하십니까, 아니면 사실과 다른 부분이 있습니까?',
        '해당 지시나 발언을 하게 된 구체적인 업무상 배경과 필요성, 긴급성은 무엇이었습니까?',
        '당시 언성, 표현 수위, 장소(타 직원 동석 여부) 등 전달 방식에 있어 다른 온건한 대안 수단을 택할 수는 없었습니까?',
        '신고인이 주장하는 내용 중 사실과 다르거나 과장·오해가 있다고 소명하실 부분과 이를 뒷받침할 객관적 자료(메신저·이메일·업무일지 등)가 있습니까?',
        '당시 현장 상황에 함께 있었던 동료 등 객관적 정황을 확인해 줄 수 있는 참고인이 있습니까?',
        '현재 신고인과의 분리조치 준수 현황 및 향후 재발방지·근무환경 개선에 관한 입장을 말씀해 주십시오.'
      ]
    },
    victim_sexual: {
      id: 'victim_sexual',
      role: 'victim',
      lawType: 'sexual',
      label: '신고인(성희롱) 성인지·2차피해 방지 심층 문답지 (8문항)',
      questions: [
        '피신고인과의 직급·직무 관계 및 해당 상황이 발생한 장소·모임의 성격(업무시간·회식·출장·메신저 등 업무관련성)을 말씀해 주십시오.',
        '문제 된 성적 언동이나 신체 접촉, 성적 요구의 구체적인 일시·장소 및 전후 정황을 기억나는 대로 말씀해 주십시오.',
        '당시 행위에 대하여 거부 의사나 불쾌감을 표현하셨거나, 위계·분위기상 즉시 거부하기 어려웠던 사정이 있었습니까?',
        '해당 언동 이후 성적 굴욕감·혐오감으로 인한 정신적 고통이나 업무 집중 저하 등 근무환경이 어떻게 변화하였습니까?',
        '성적 언동에 대한 불응이나 문제 제기를 이유로 업무 배제, 평가 불이익 등 불리한 처우를 겪으신 사실이 있습니까?',
        '사건 직후 가족·동료·상담기관에 피해 사실을 알린 내역이나 메신저·통화기록 등 간접 정황 증거가 있습니까?',
        '2차 피해(소문 유포, 합의 종용 등) 발생 여부 및 현재 희망하시는 피해자 보호조치(남녀고평법 제14조 제4항)를 말씀해 주십시오.',
        '행위자 인사조치 수위에 관한 사전 의견 및 추가로 진술하실 사항이 있습니까?'
      ]
    },
    accused_sexual: {
      id: 'accused_sexual',
      role: 'accused',
      lawType: 'sexual',
      label: '피신고인(성희롱) 행위 맥락·거부의사 인지 소명 문답지 (7문항)',
      questions: [
        '남녀고용평등법 제14조에 따른 비밀누설 금지 및 신고인·참고인에 대한 불리한 처우·2차 가해 금지 의무를 고지받으셨습니까?',
        '쟁점이 된 일시·장소(회식·회의·출장·메신저 등)에 참석하거나 연락한 사실 및 당시의 전반적인 분위기는 어떠했습니까?',
        '신고인이 지목한 발언이나 신체 접촉 등 구체적 행위 중 인정하는 부분과 부인하거나 기억이 다른 부분을 구분하여 말씀해 주십시오.',
        '당시 신고인의 표정·반응·자리 이동 등 불쾌감이나 거부 신호를 인지하신 바가 있습니까?',
        '사건 이후 신고인에게 별도로 연락하거나 사과 메시지 등을 보낸 사실이 있습니까? 있다면 그 경위는 무엇입니까?',
        '본 사안과 관련하여 소명하고자 하는 전후 맥락이나 제출하실 증빙자료가 있습니까?',
        '조사 종결 시까지 공간·업무 분리 및 비밀유지 준수에 관한 확인 말씀을 해주십시오.'
      ]
    },
    witness_common: {
      id: 'witness_common',
      role: 'witness',
      lawType: 'common',
      label: '참고인(목격자·동료) 직접목격·조직분위기 객관 확인 문답지 (6문항)',
      questions: [
        '참고인 진술은 근로기준법 제76조의3 제6항·제7항에 따라 철저히 비밀이 보장되며 어떠한 불이익 처우도 금지됨을 안내받으셨습니까?',
        '신고인 및 피신고인과는 각각 어떤 업무 관계로 근무하고 계십니까?',
        '쟁점이 된 일시·장소에서 문제의 발언이나 행동을 직접 목격·청취하신 사실이 있습니까? (직접 목격한 사실과 전해 들은 내용을 구분해 주십시오)',
        '당시 피신고인의 언성·태도와 직후 신고인의 반응·상태는 어떠했습니까?',
        '평소 부서 내 업무 지시 방식이나 회식·회의 문화에서 유사한 언행이 반복된 적이 있었습니까?',
        '그 밖에 객관적 사실 확인을 위해 조사역이 참고해야 할 사항이 있습니까?'
      ]
    },
    third_party_victim: {
      id: 'third_party_victim',
      role: 'victim',
      lawType: 'third_party',
      label: '고객·원하청 제3자 가해 피해근로자 보호 문답지 (6문항)',
      questions: [
        '가해 행위자(고객·민원인·거래처·원하청 관계자 등)의 소속·지위 및 귀하의 담당 업무와의 관련성을 말씀해 주십시오.',
        '폭언·성적 언동·부당 업무지시 등이 발생한 구체적 일시·장소·매체(대면·유선·현장) 및 발언 내용을 말씀해 주십시오.',
        '발생 직후 회사 관리자나 고충창구에 보고하고 업무의 일시적 중단·전환 등 보호조치를 요청하신 경위는 어떠합니까?',
        '산업안전보건법 제41조 및 남녀고용평등법 제14조의2에 따른 분리·휴게시간 연장·치료 지원 등 현재 필요한 보호조치는 무엇입니까?',
        '원·하청 도급 혼재 사업장인 경우 작업동선 분리나 원청 담당창구 협조가 필요한 사항이 있습니까?',
        '관련 녹음파일·통화기록·메신저 등 제출하실 입증자료가 있습니까?'
      ]
    }
  };

  function normalizeTemplateId(tplId) {
    var k = str(tplId);
    return REPORT_TEMPLATES[k] ? k : 'laborfirm_deep';
  }

  function pickDefaultInterviewTemplate(caseRec, role) {
    var c = obj(caseRec) ? caseRec : {};
    var r = str(role) || 'victim';
    if (r === 'witness') return 'witness_common';
    if (str(c.caseSubType) === 'third_party' || str(c.caseSubType) === 'subcontract') {
      if (r === 'victim') return 'third_party_victim';
    }
    if (c.category === 'sexual') {
      return r === 'accused' ? 'accused_sexual' : 'victim_sexual';
    }
    return r === 'accused' ? 'accused_harass' : 'victim_harass';
  }

  /* 선택된 마스터 양식 기준 필수 구성항목·전용 입력칸 충족도 진단 */
  function evaluateTemplateCompleteness(caseRec, secretRec, optTplId) {
    var c = obj(caseRec) ? caseRec : {};
    var sec = obj(secretRec) ? secretRec : {};
    var tplId = normalizeTemplateId(optTplId || c.reportTemplate || sec.reportTemplate);
    var tpl = REPORT_TEMPLATES[tplId];
    var tm = (obj(sec.templateMeta) && obj(sec.templateMeta[tplId])) ? sec.templateMeta[tplId] : (obj(sec.templateMeta) ? sec.templateMeta : {});
    var ivs = (Array.isArray(sec.interviews) ? sec.interviews : []).filter(function (x) { return obj(x) && !x._deleted; });
    var isss = (Array.isArray(sec.issues) ? sec.issues : []).filter(function (x) { return obj(x) && !x._deleted; });
    var evs = (Array.isArray(sec.evidences) ? sec.evidences : []).filter(function (x) { return obj(x) && !x._deleted; });

    var items = [
      { key: 'overview', label: '사건·착수 요지', ok: !!str(sec.overview), focusId: 'rOverview' },
      { key: 'interviews', label: '당사자·참고인 진술 (' + ivs.length + '건)', ok: ivs.length > 0, act: 'addInterview' },
      { key: 'issues', label: '쟁점·법정요건 검토 (' + isss.length + '건)', ok: isss.length > 0, act: 'addIssue' },
      { key: 'evidences', label: '호증·공문 편철 (' + (evs.length + (Array.isArray(c.mailLinks) ? c.mailLinks.length : 0)) + '건)', ok: (evs.length > 0 || (Array.isArray(c.mailLinks) && c.mailLinks.length > 0)), act: 'addEvidence' }
    ];

    (tpl.fields || []).forEach(function (fd) {
      var val = str(tm[fd.key]);
      items.push({
        key: 'tm_' + fd.key,
        label: fd.label,
        ok: fd.type === 'select' ? true : !!val,
        focusId: 'tm_' + fd.key
      });
    });

    if (tpl.hasMoelChecklist) {
      var checkedCnt = MOEL_OBLIGATION_CHECKS.filter(function (chk) { return isMoelObligationMet(chk.key, c, sec, tm); }).length;
      items.push({
        key: 'moel_checks',
        label: '법정의무 6대 점검 (' + checkedCnt + '/6)',
        ok: checkedCnt >= 4,
        focusId: 'moelck_' + MOEL_OBLIGATION_CHECKS[0].key
      });
    }

    if (tplId === 'lawfirm_opinion' || tplId === 'nlrb_defense') {
      var credCnt = isss.filter(function (iss) { return evaluateIssueCredibility(iss).hasExplicit || str(iss.credibilityNote); }).length;
      items.push({
        key: 'credibility',
        label: '진술 신빙성 5지표 (' + credCnt + '/' + (isss.length || 1) + ')',
        ok: isss.length > 0 && credCnt > 0,
        act: isss.length ? 'editIssueFirst' : 'addIssue'
      });
    }

    items.push({ key: 'conclusion', label: '종합 판단·결론', ok: !!(str(c.verdictSummary) && str(sec.conclusion)), focusId: 'rConclusion' });

    var doneCnt = items.filter(function (it) { return it.ok; }).length;
    var pct = items.length ? Math.round((doneCnt / items.length) * 100) : 100;
    return {
      templateId: tplId,
      template: tpl,
      total: items.length,
      done: doneCnt,
      pct: pct,
      items: items
    };
  }

  /* 조사 데이터 전체 + 선택된 마스터 양식(6종)에 따라 맞춤형 조사결과보고서·법률의견서 본문 자동 조립 */
  function assembleReportDraft(caseRec, secretRec, optTplId) {
    var c = obj(caseRec) ? caseRec : {};
    var sec = obj(secretRec) ? secretRec : {};
    var tplId = normalizeTemplateId(optTplId || c.reportTemplate || sec.reportTemplate);
    var tpl = REPORT_TEMPLATES[tplId];
    var tm = (obj(sec.templateMeta) && obj(sec.templateMeta[tplId])) ? sec.templateMeta[tplId] : (obj(sec.templateMeta) ? sec.templateMeta : {});
    var cat = CATEGORIES[c.category] || CATEGORIES.harass;
    var subMeta = CASE_SUBTYPES[str(c.caseSubType)] || CASE_SUBTYPES[''];
    var caseSchema = getLegalSchema(c);
    var steps = obj(c.steps) ? c.steps : {};
    var mails = Array.isArray(c.mailLinks) ? c.mailLinks : [];
    var interviews = Array.isArray(sec.interviews) ? sec.interviews.filter(function (x) { return obj(x) && !x._deleted; }) : [];
    var issues = Array.isArray(sec.issues) ? sec.issues.filter(function (x) { return obj(x) && !x._deleted; }) : [];
    var evidences = renumberEvidences(sec.evidences || []);
    var victimOpinions = Array.isArray(sec.victimOpinions) ? sec.victimOpinions.filter(function (x) { return obj(x) && !x._deleted; }) : [];
    var closureConsents = Array.isArray(sec.closureConsents) ? sec.closureConsents.filter(function (x) { return obj(x) && !x._deleted; }) : [];
    var surveyStats = (Array.isArray(sec.surveyResponses) && sec.surveyResponses.length) ? aggregateSurveyResponses(sec.surveyResponses) : null;
    var verdict = VERDICTS[str(c.verdictSummary)] || VERDICTS[''];

    var lawLawDesc = str(c.caseSubType) === 'third_party'
      ? ' (산업안전보건법 제41조 · 남녀고용평등법 제14조의2)'
      : c.category === 'sexual'
        ? ' (남녀고용평등법 제2조 제2호 · 제14조)'
        : c.category === 'both'
          ? ' (근로기준법 제76조의2 · 남녀고용평등법 제14조)'
          : ' (근로기준법 제76조의2 · 제76조의3)';

    var ynMap = { yes: '충족', no: '미충족', hold: '검토중' };
    var factMap = { recognized: '사실 인정', partial: '일부 인정', unrecognized: '불인정' };
    var recCount = issues.filter(function (iss) { return (str(iss.verdict) || judgeIssue(iss)) === 'yes'; }).length;

    function pushPartyStatements(lines) {
      if (!interviews.length) {
        lines.push('  - 등록된 면담 진술 요약이 없습니다.');
      } else {
        interviews.forEach(function (iv, idx) {
          var roleKr = iv.role === 'accused' ? '피신고인(행위자)' : iv.role === 'witness' ? '참고인' : '신고인(피해자)';
          var qaCnt = Array.isArray(iv.qaList) ? iv.qaList.filter(function (q) { return obj(q) && (str(q.q) || str(q.a)); }).length : 0;
          var badges = [];
          if (iv.pledgeSigned) badges.push('비밀유지서약 완료');
          if (iv.stmtSigned) badges.push('진술확인 전자서명 완료' + (iv.docHash ? '·지문 ' + str(iv.docHash).slice(0, 8) : ''));
          if (qaCnt > 0) badges.push('문답 ' + qaCnt + '항');
          lines.push('  (' + (idx + 1) + ') [' + roleKr + '] ' + (maskRrnText(str(iv.alias)) || '익명') +
            (iv.dept ? ' · ' + maskRrnText(str(iv.dept)) : '') +
            (iv.date ? ' (' + str(iv.date) + ', ' + (maskRrnText(str(iv.method)) || '면담') + ')' : '') +
            (badges.length ? ' [' + badges.join(' · ') + ']' : ''));
          lines.push('      진술 요지: ' + (maskRrnText(str(iv.summary)) || '(요지 미입력)'));
          if (str(iv.amendNote)) {
            lines.push('      진술인 정정·보완 의견: ' + maskRrnText(str(iv.amendNote)));
          }
        });
      }
    }

    function pushEvidencesAndSurvey(lines) {
      if (evidences.length) {
        evidences.forEach(function (ev) {
          lines.push('  - [' + ev.exhibitNo + '] ' + (ev.date ? ev.date + ' · ' : '') + ev.title +
            (ev.submitter ? ' (제출: ' + ev.submitter + ')' : '') +
            (ev.summary ? ' — ' + ev.summary : ''));
        });
      }
      if (!evidences.length && !mails.length) {
        lines.push('  - 수집된 메일·호증 기록이 없습니다.');
      } else if (mails.length) {
        mails.slice(0, 25).forEach(function (m, idx) {
          var rLbl = (DOC_ROLES[m.docRole] || DOC_ROLES.general).label;
          var atts = (Array.isArray(m.attNames) && m.attNames.length) ? ' (첨부: ' + m.attNames.join(', ') + ')' : '';
          lines.push('  - [공문 ' + (idx + 1) + '] ' + (m.date || '') + ' [' + rLbl + '] ' + maskRrnText(str(m.subject)) + atts);
        });
      }
      if (surveyStats && surveyStats.total > 0) {
        lines.push('');
        lines.push('  [부서·조직 무기명 실태조사 설문 집계 — 응답 ' + surveyStats.total + '명]');
        surveyStats.items.forEach(function (it, qi) {
          lines.push('    · 문항 ' + (qi + 1) + '. ' + it.q + ' → 주의·반복 응답 ' + it.highRiskCnt + '명 (' + it.highRiskPct + '%)');
        });
        if (surveyStats.comments.length) {
          lines.push('    · 주요 자유의견 요약: ' + surveyStats.comments.slice(0, 5).join(' / '));
        }
      }
    }

    function pushIssuesAnalysis(lines, includeCredibility) {
      if (!issues.length) {
        lines.push('  - 등록된 쟁점 행위가 없습니다.');
        return;
      }
      issues.forEach(function (iss, idx) {
        var issLaw = inferIssueLawType(iss, c);
        var sch = getLegalSchema(c, '', issLaw);
        var autoRes = str(iss.verdict) || judgeIssue(iss);
        var resText = autoRes === 'yes' ? sch.verdictYes : autoRes === 'no' ? sch.verdictNo : '판단 보류';
        var cred = evaluateIssueCredibility(iss);
        lines.push('  [쟁점 ' + (idx + 1) + '] ' + (maskRrnText(str(iss.title)) || '행위 ' + (idx + 1)) +
          (iss.whenWhere ? ' (' + maskRrnText(str(iss.whenWhere)) + ')' : '') +
          ' — 적용법리: ' + sch.lawBasis);
        if (iss.claimVictim) lines.push('    · 신고인 주장: ' + maskRrnText(str(iss.claimVictim)));
        if (iss.claimAccused) lines.push('    · 피신고인 소명: ' + maskRrnText(str(iss.claimAccused)));
        if (iss.evidenceNote) lines.push('    · 객관적 증거·판단 근거: ' + maskRrnText(str(iss.evidenceNote)));
        if (includeCredibility || cred.hasExplicit || cred.note) {
          var credDetail = cred.checkedLabels.length ? (' [충족지표: ' + cred.checkedLabels.join('·') + ']') : '';
          lines.push('    · 진술 신빙성 평가: ' + cred.level + credDetail + (cred.note ? (' — ' + cred.note) : ''));
        }
        lines.push('    · 사실인정 결과: ' + (factMap[iss.factStatus] || '검토중'));
        lines.push('    · 법정 요건 포섭: ' + sch.e1.chip + '(' + (ynMap[iss.elemSuperiority] || '검토중') +
          ') / ' + sch.e2.chip + '(' + (ynMap[iss.elemBeyondScope] || '검토중') +
          ') / ' + sch.e3.chip + '(' + (ynMap[iss.elemHarm] || '검토중') + ')');
        lines.push('    · 최종 판단: 【 ' + resText + ' 】' + (autoRes === 'yes' ? ' (괴롭힘·성희롱 해당 · 법 위반 성립)' : ''));
        lines.push('');
      });
    }

    function pushStatutoryRecommendations(lines) {
      if (victimOpinions.length) {
        var latestOp = victimOpinions[victimOpinions.length - 1];
        lines.push('  · 피해근로자 사전 의견청취 확인: ' + (str(latestOp.date) || '확인 완료') +
          ' — 희망 보호·후속조치: ' + maskRrnText(str(latestOp.measuresText || latestOp.summary) || '의견 확인필'));
      }
      if (closureConsents.length) {
        var latestCl = closureConsents[closureConsents.length - 1];
        lines.push('  · 당사자 조사종료·취하·합의 의사 확인: ' + (str(latestCl.date) || '확인 완료') +
          ' — ' + maskRrnText(str(latestCl.summary) || '자유의사에 따른 종결 동의 확인필'));
      }
      lines.push('  · 관계 법령상 필수 후속 조치 권고 (' + caseSchema.lawBasis + '):');
      if (str(c.caseSubType) === 'third_party') {
        lines.push('    1) 고객 등 제3자 분리·업무중단: 업무의 일시적 중단·전환, 휴게시간 연장, 치료·상담 지원 등 보호조치 즉시 이행');
        lines.push('    2) 불이익 처우 금지: 피해 주장 및 보호조치 요구를 이유로 한 해고나 불리한 처우 엄금');
      } else if (str(c.caseSubType) === 'subcontract') {
        lines.push('    1) 원·하청 도급 근무공간·업무동선 분리: 도급인·수급인 간 인사권 직접 개입을 배제하고 작업장소 분리 및 담당창구 일원화 시행');
        lines.push('    2) 수급인 소속 피해근로자 보호협조 및 재발방지 공동 예방교육 실시');
      } else if (c.category === 'sexual') {
        lines.push('    1) 피해근로자 보호조치(남녀고평법 제14조 제4항): 근무장소 변경, 배치전환, 유급휴가 명령 등 시행 (의사에 반하는 조치 금지)');
        lines.push('    2) 행위자 징계 등 조치(제14조 제5항): 성희롱 사실 확인 시 지체 없이 징계·근무장소 변경 등 조치 (조치 전 피해근로자 의견 청취 필수)');
        lines.push('    3) 불리한 처우 및 비밀누설 금지(제14조 제6항·제7항): 신고·피해근로자·참고인에 대한 불리한 처우 및 조사 비밀 누설 엄금');
      } else {
        lines.push('    1) 피해근로자 보호조치(근로기준법 제76조의3 제4항): 피해근로자 의견 청취 후 근무장소 변경, 배치전환, 유급휴가 명령 등 적절한 조치 시행');
        lines.push('    2) 행위자 조치(제76조의3 제5항): 사규에 따른 징계·근무장소 변경 등 필요한 조치 (조치 전 반드시 피해근로자 의견 사전 청취 필수)');
        lines.push('    3) 불리한 처우 금지(제76조의3 제6항): 신고인·피해근로자·참고인에 대한 해고 등 불리한 처우 엄격 금지 (3년 이하 징역 또는 3천만원 이하 벌금)');
        lines.push('    4) 비밀유지 및 사후 모니터링(제76조의3 제7항): 조사 참여자 비밀누설 금지 및 종결 후 2차 가해 여부 정기 점검');
      }
      if (str(sec.recommendations)) {
        lines.push('  · 사업장 맞춤 권고사항: ' + maskRrnText(str(sec.recommendations)));
      }
    }

    function pushStepHistory(lines) {
      if (c.fairnessChecked) {
        lines.push('  - 외부 조사위원 제척·기피·회피 해당 없음 공정성 확인 완료');
      }
      STEPS.forEach(function (def) {
        var st = steps[def.code];
        if (st && st.done) {
          lines.push('  - ' + def.name + ': ' + (st.date || '완료') + (st.note ? ' (' + maskRrnText(st.note) + ')' : ''));
        }
      });
      if (!STEPS.some(function (d) { return steps[d.code] && steps[d.code].done; })) {
        lines.push('  - (진행 단계 기록 전)');
      }
    }

    var lines = [];
    lines.push('【 ' + cat.label + ' ' + tpl.docTitleSuffix + ' 】');
    lines.push('  [적용 양식: ' + tpl.name + ' · ' + tpl.docClassBadge + ']');
    lines.push('');

    if (tplId === 'lawfirm_opinion') {
      /* ① 대형 법무법인(로펌) 법률검토의견서형 */
      var riskMap = { low: '안정 (방어력 충분)', mid: '보통 (절차·양정 비례성 유의)', high: '주의 (분쟁·부당징계 리스크 높음)' };
      lines.push('Ⅰ. 검토 배경 및 핵심 법률의견 요약 (Executive Summary)');
      if (str(tm.docRefNo)) lines.push('  1. 문서관리번호: ' + maskRrnText(str(tm.docRefNo)));
      lines.push('  2. 의뢰인(회사) 및 사안명: ' + (str(c.companyName) || '(미입력)') + ' / ' + (str(c.title) || cat.label + ' 조사 건'));
      lines.push('  3. 검토 질의 요지 (Issues Presented): ' + (maskRrnText(str(tm.querySummary)) || (cat.label + lawLawDesc + ' 해당 여부 및 인사조치의 법적 적정성 검토')));
      lines.push('  4. 핵심 법률의견 결론 (Brief Answer): 【 ' + verdict.label + ' 】 (전체 쟁점 ' + issues.length + '건 중 인정 ' + recCount + '건)');
      lines.push('     ' + (maskRrnText(str(tm.execSummary || sec.conclusion)) || '확보된 문답 진술의 신빙성 및 객관적 호증을 대법원 판례 법리에 비추어 종합 검토한 결과 위와 같이 판단함.'));
      lines.push('  5. 분쟁·소송 리스크 진단: ' + (riskMap[str(tm.litigationRisk)] || riskMap.low));
      lines.push('');

      lines.push('Ⅱ. 조사 범위 및 적법절차(Due Process · 방어권 보장) 이행 경과');
      lines.push('  1. 조사 기간: ' + (str(c.receiveDate) || '착수일') + ' ~ ' + (str(c.closeDate) || effectiveDueDateOf(c) || '진행 중'));
      if (str(sec.overview)) lines.push('  2. 사건 접수 및 착수 경위: ' + maskRrnText(str(sec.overview)));
      pushStepHistory(lines);
      lines.push('');

      lines.push('Ⅲ. 관련 법령·판례 법리 및 사규 체계');
      lines.push('  1. 적용 법령: ' + caseSchema.lawBasis + ' — ' + caseSchema.e1.label + ', ' + caseSchema.e2.label + ', ' + caseSchema.e3.label);
      lines.push('  2. 진술 신빙성 판단 법리: 대법원 판례에 따라 진술 내용 자체의 합리성·일관성·구체성, 객관적 정황·참고인 진술과의 부합 여부, 허위 진술 동기 유무를 종합 심리함.');
      if (str(sec.companyRuleQuote)) lines.push('  3. 관련 사규(취업규칙·인사규정): ' + maskRrnText(str(sec.companyRuleQuote)));
      lines.push('');

      lines.push('Ⅳ. 당사자·참고인 진술 요지 및 진술 신빙성(Credibility) 5대 지표 분석');
      pushPartyStatements(lines);
      lines.push('  [제출 호증 및 객관적 입증자료 (' + evidences.length + '건)]');
      pushEvidencesAndSurvey(lines);
      lines.push('');

      lines.push('Ⅴ. 쟁점 행위별 사실관계 확정 및 법리 포섭(Subsumption) 의견');
      pushIssuesAnalysis(lines, true);

      lines.push('Ⅵ. 인사조치 양정 적정성 및 노동위원회·소송 리스크 관리 제언');
      lines.push('  · 최종 법률의견: ' + (maskRrnText(str(sec.conclusion)) || verdict.label));
      pushStatutoryRecommendations(lines);

    } else if (tplId === 'moel_standard') {
      /* ② 고용노동부 매뉴얼 별지 · 감독관 대응 표준형 */
      var mc = obj(tm.moelChecks) ? tm.moelChecks : {};
      lines.push('1. 사건 접수 및 당사자 개요 (고용노동부 표준매뉴얼 기준)');
      lines.push('  가. 사업장명: ' + (str(c.companyName) || '(미입력)') + (str(c.bizNo) ? ' (사업자등록번호: ' + str(c.bizNo) + ')' : ''));
      lines.push('  나. 사건명 및 구분: ' + (str(c.title) || cat.label + ' 조사 건') + ' / ' + cat.label + (str(c.caseSubType) ? ' · ' + subMeta.label : '') + lawLawDesc);
      lines.push('  다. 인지·접수 경로 및 조사 기간: ' + (maskRrnText(str(tm.intakeRoute)) || '고충접수') + ' (' + (str(c.receiveDate) || '착수일') + ' ~ ' + (str(c.closeDate) || effectiveDueDateOf(c) || '진행 중') + ')');
      if (str(c.laborOffice) || str(c.govCaseNo)) {
        lines.push('  라. 관할 노동관서 · 사건번호: ' + [str(c.laborOffice), str(c.inspectorName) ? ('담당 ' + str(c.inspectorName)) : '', str(c.govCaseNo)].filter(Boolean).join(' · '));
      }
      lines.push('');

      lines.push('2. 신고 행위 요지 및 객관적 조사 실시 경과');
      if (str(sec.overview)) lines.push('  가. 신고 및 착수 요지: ' + maskRrnText(str(sec.overview)));
      if (str(tm.interimMeasure)) lines.push('  나. 조사 기간 중 잠정 보호·분리조치(제76조의3 제3항): ' + maskRrnText(str(tm.interimMeasure)));
      pushStepHistory(lines);
      lines.push('');

      lines.push('3. 당사자 · 참고인 문답 요지 및 입증자료 목록');
      pushPartyStatements(lines);
      pushEvidencesAndSurvey(lines);
      lines.push('');

      lines.push('4. 법정 성립요건 항목별 판단 (' + caseSchema.lawBasis + ')');
      pushIssuesAnalysis(lines, false);

      lines.push('5. 사용자 법정의무 6대 항목(근로기준법 제76조의3 · 남녀고용평등법 제14조) 이행 점검표');
      MOEL_OBLIGATION_CHECKS.forEach(function (chk) {
        var autoOk = isMoelObligationMet(chk.key, c, sec, tm);
        lines.push('  ' + (autoOk ? '☑ [이행확인] ' : '☐ [점검대상] ') + chk.label);
      });
      lines.push('');

      lines.push('6. 종합 판단 결과 및 재발방지 시정계획');
      lines.push('  · 종합 판정: ' + verdict.label + ' — ' + (maskRrnText(str(sec.conclusion)) || '위 요건별 검토 결과에 따름.'));
      if (str(sec.companyRuleQuote)) lines.push('  · 적용 취업규칙 조항: ' + maskRrnText(str(sec.companyRuleQuote)));
      pushStatutoryRecommendations(lines);
      if (str(tm.preventPlan)) lines.push('  · 향후 재발방지 및 예방교육 이행계획: ' + maskRrnText(str(tm.preventPlan)));

    } else if (tplId === 'public_committee') {
      /* ③ 공공기관·공기업 감사실·고충심의위원회 상정형 */
      var resOrderMap = {
        uphold: '인용 (직장 내 괴롭힘·성희롱에 해당함 — 가결)',
        partial: '일부 인용 (일부 쟁점 행위에 한하여 해당함 — 일부 가결)',
        dismiss: '기각 (직장 내 괴롭힘·성희롱에 해당하지 아니함)',
        reject: '각하 (심의 요건 불비 또는 신청인 자유의사 취하)'
      };
      lines.push('Ⅰ. 고충심의위원회 부의 안건 개요 및 위원회 구성 확인');
      lines.push('  1. 안건번호 · 소관부서: ' + (maskRrnText(str(tm.agendaNo)) || '제' + caseYearOf(c) + '-고충심의-호 · 감사/인권윤리 부서'));
      lines.push('  2. 기관명 · 안건명: ' + (str(c.companyName) || '(미입력)') + ' / ' + (str(c.title) || cat.label + ' 심의의 건'));
      lines.push('  3. 외부위원 참여 및 제척·기피·회피 확인: ' + (maskRrnText(str(tm.committeeQuorum)) || (c.fairnessChecked ? '외부전문가 참여 및 제척사유 없음 확인 완료' : '외부전문가 조사위원 독립 조사 수행')));
      if (str(sec.overview)) lines.push('  4. 상정(부의) 사유 요지: ' + maskRrnText(str(sec.overview)));
      lines.push('');

      lines.push('Ⅱ. 신청인·피신청인 진술 및 참고인 조사 결과');
      pushPartyStatements(lines);
      pushEvidencesAndSurvey(lines);
      lines.push('');

      lines.push('Ⅲ. 인권 · 성인지 감수성 및 2차 피해 유발 여부 검토');
      lines.push('  · ' + (maskRrnText(str(tm.secondaryHarmNote)) || '피해자 중심 보호원칙, 성인지 감수성 판단 기준(대법원 판례) 및 조사 중 소문 유포·회유·보복 등 2차 피해 발생 여부를 병행 점검함.'));
      pushStepHistory(lines);
      lines.push('');

      lines.push('Ⅳ. 행위별 관계법령 및 기관 인권·복무지침 위반 판단');
      if (str(sec.companyRuleQuote)) lines.push('  · 관련 지침·취업규칙 근거: ' + maskRrnText(str(sec.companyRuleQuote)));
      pushIssuesAnalysis(lines, true);

      lines.push('Ⅴ. 고충심의위원회 의결 주문(안) 및 기관장 조치 건의');
      lines.push('  1. 의결 주문(안): 【 ' + (resOrderMap[str(tm.resolutionOrder)] || verdict.label) + ' 】');
      lines.push('  2. 종합 심의 의견: ' + (maskRrnText(str(sec.conclusion)) || '위 사실조사 및 법령·내규 검토 결과와 같음.'));
      pushStatutoryRecommendations(lines);

    } else if (tplId === 'corp_executive') {
      /* ④ 대기업 준법감시·경영진(C-Level)·인사위원회 요약보고형 */
      var sevMap = { S: 'S등급 (Critical — 중대 비위)', A: 'A등급 (High — 법 위반 인정)', B: 'B등급 (Medium — 주의·경고)', C: 'C등급 (Low — 불인정·종결)' };
      var lightMap = { red: '[고위험/적색]', amber: '[주의/황색]', green: '[안정/녹색]' };
      lines.push('[Executive Brief] 경영진 의사결정 핵심 요약');
      lines.push('  · 대상 법인 / 사안명: ' + (str(c.companyName) || '(미입력)') + ' — ' + (str(c.title) || cat.label + ' 특별조사'));
      lines.push('  · 사안 심각도 등급: ' + (sevMap[str(tm.severityGrade)] || sevMap.A) + '  |  최종 판정: ' + verdict.label + ' (인정 ' + recCount + '건 / 전체 ' + issues.length + '건)');
      lines.push('  · 리스크 신호등: 법규·행정 ' + (lightMap[str(tm.riskLegal)] || '[안정/녹색]') + '  /  평판·조직이탈 ' + (lightMap[str(tm.riskRep)] || '[주의/황색]'));
      lines.push('  · 3대 핵심 보고 요지:');
      lines.push('    ' + (maskRrnText(str(tm.execKeyPoints || sec.conclusion || sec.overview)) || '외부전문가 독립 사실조사 결과 객관적 증거에 기초하여 사실관계를 확정하고 인사위원회 후속조치를 건의함.'));
      lines.push('');

      lines.push('[Action Plan] 인사위원회 부의 수위 및 즉시 실행 과제');
      lines.push('  · 종합 결론: ' + (maskRrnText(str(sec.conclusion)) || verdict.label));
      pushStatutoryRecommendations(lines);
      lines.push('');

      lines.push('[Annex 1] 쟁점 행위별 사실인정 및 법정요건 검증 매트릭스');
      pushIssuesAnalysis(lines, true);

      lines.push('[Annex 2] 당사자·참고인 진술 및 핵심 물증(호증) 요지');
      pushPartyStatements(lines);
      pushEvidencesAndSurvey(lines);
      lines.push('');

      lines.push('[Annex 3] 사규·윤리강령 적용 조항 및 조사 절차 기록');
      if (str(sec.companyRuleQuote)) lines.push('  · 관련 사규·윤리강령: ' + maskRrnText(str(sec.companyRuleQuote)));
      pushStepHistory(lines);

    } else if (tplId === 'nlrb_defense') {
      /* ⑤ 지방노동위원회·법원 부당징계 방어 소명형 */
      lines.push('Ⅰ. 처분(조사) 경위 및 조사·소명 절차의 적법성 입증');
      lines.push('  1. 당사자 및 사건 개요: ' + (str(c.companyName) || '(미입력)') + ' / ' + (str(c.title) || cat.label + ' 건'));
      if (str(sec.overview)) lines.push('  2. 사건 발단 및 착수 경위: ' + maskRrnText(str(sec.overview)));
      lines.push('  3. 방어권 및 소명기회 보장 내역: ' + (maskRrnText(str(tm.dueProcessNote)) || '객관적 외부전문가 조사, 피신고인 대면·서면 소명기회 부여 및 진술확인 서명 절차 적법 이행'));
      pushStepHistory(lines);
      lines.push('');

      lines.push('Ⅱ. 징계(혐의)사유별 구체적 사실인정 및 입증 호증 1:1 매핑');
      pushIssuesAnalysis(lines, true);
      lines.push('  [입증 호증 편철 목록 (' + evidences.length + '건)]');
      pushEvidencesAndSurvey(lines);
      lines.push('');

      lines.push('Ⅲ. 당사자 진술 신빙성 대비 및 피징계자 주장 반박 논리');
      pushPartyStatements(lines);
      if (str(tm.defensePoint)) {
        lines.push('  · 예상 항변 및 핵심 반박 논리: ' + maskRrnText(str(tm.defensePoint)));
      }
      lines.push('');

      lines.push('Ⅳ. 징계양정의 적정성(사회통념상 상당성 · 비례원칙 · 형평성) 검토');
      if (str(sec.companyRuleQuote)) lines.push('  · 취업규칙·인사규정 징계근거: ' + maskRrnText(str(sec.companyRuleQuote)));
      if (str(tm.equityNote)) lines.push('  · 동종사례 형평성 및 가중·감경 참작사유: ' + maskRrnText(str(tm.equityNote)));
      var discSug = suggestDisciplinaryLevel(issues, {});
      if (discSug && discSug.summary) lines.push('  · 양정 기준선 검토: ' + discSug.summary);
      lines.push('');

      lines.push('Ⅴ. 최종 소명 결론 및 사후 보호조치 이행');
      lines.push('  · 종합 판단: ' + verdict.label + ' — ' + (maskRrnText(str(sec.conclusion)) || '징계사유·절차·양정 모두 정당성 요건을 충족함.'));
      pushStatutoryRecommendations(lines);

    } else {
      /* ⑥ 기본값: 전문 노무법인 심층 사실조사 표준형 (laborfirm_deep) */
      lines.push('1. 사건 개요');
      lines.push('  가. 의뢰 사업장: ' + (str(c.companyName) || '(미입력)'));
      lines.push('  나. 사건명: ' + (str(c.title) || cat.label + ' 조사 건'));
      lines.push('  다. 조사 구분: ' + cat.label + (str(c.caseSubType) ? ' · ' + subMeta.label : '') + lawLawDesc);
      lines.push('  라. 조사 기간: ' + (str(c.receiveDate) || '착수일') + ' ~ ' + (str(c.closeDate) || effectiveDueDateOf(c) || '진행 중'));
      if (str(tm.investTeam)) lines.push('  마. 외부조사단 구성 · 조사방식: ' + maskRrnText(str(tm.investTeam)));
      if (str(tm.orgContext)) lines.push('  바. 당사자 위계 · 업무체계 맥락: ' + maskRrnText(str(tm.orgContext)));
      if (str(c.laborOffice) || str(c.govCaseNo)) {
        lines.push('  사. 행정기관 연계: ' + [str(c.laborOffice), str(c.inspectorName) ? ('담당 ' + str(c.inspectorName)) : '', str(c.govCaseNo)].filter(Boolean).join(' · '));
      }
      if (str(sec.overview)) lines.push('  아. 신고 및 착수 요지: ' + maskRrnText(str(sec.overview)));
      if (str(sec.companyRuleQuote)) lines.push('  자. 관련 사규(취업규칙·인사규정) 근거: ' + maskRrnText(str(sec.companyRuleQuote)));
      lines.push('');

      lines.push('2. 조사 경위 및 공정성·비밀유지 확보 절차');
      pushStepHistory(lines);
      lines.push('');

      lines.push('3. 당사자·참고인 진술 요지 및 제출 호증 편철 (호증 ' + evidences.length + '건 · 공문 ' + mails.length + '건)');
      pushPartyStatements(lines);
      lines.push('');
      pushEvidencesAndSurvey(lines);
      lines.push('');

      lines.push('4. 쟁점 행위별 사실인정 및 법정 성립요건 포섭');
      pushIssuesAnalysis(lines, false);

      lines.push('5. 종합 판정 결론 및 단계별 인사조치 실행 로드맵');
      lines.push('  가. 종합 판단: ' + verdict.label);
      lines.push('  나. 종합 의견: ' + (maskRrnText(str(sec.conclusion)) || '위 사실인정 및 법리 검토 결과를 종합하여 판단함.'));
      if (str(tm.actionRoadmap)) {
        lines.push('  다. 단계별 인사·조직관리 실행 로드맵: ' + maskRrnText(str(tm.actionRoadmap)));
      }
      pushStatutoryRecommendations(lines);
    }

    lines.push('');
    lines.push('작성기관: 푸른노무법인');

    return maskRrnText(lines.join('\n'));
  }

  /* ═══ 녹취록·진술서 원문 자동 정리 (규칙 기반 즉시 정리 + AI JSON 정규화) ═══ */
  var MAX_QA_ITEMS = 500;
  var TS_HEAD_RE = /^\s*(?:\[\d{1,2}:\d{2}(?::\d{2})?\]|\(\d{1,2}:\d{2}(?::\d{2})?\)|\d{1,2}:\d{2}(?::\d{2})?)\s*/;
  var Q_LABEL_RE = /^(?:문|질문|Q|조사자|조사역|노무사|진행자|면담자|참석자\s*1|화자\s*1)(?:\s*[\dA-Za-z가-힣]{0,6})?\s*[:.)\]】>]\s*/i;
  var A_LABEL_RE = /^(?:답|답변|A|진술인|신고인|피신고인|피해자|행위자|참고인|근로자|참석자\s*[2-9]|화자\s*[2-9])(?:\s*[\dA-Za-z가-힣]{0,8})?\s*[:.)\]】>]\s*/i;
  var META_LABEL_RE = /^(?:의뢰\s*사업장|조사\s*구분|사건명|대상자\s*구분|성명[·\s]*호칭(?:\s*\/\s*소속)?|면담\s*일자|면담\s*방식|조사\s*수행\s*기관|작성기관|확인\s*진술인|문서\s*무결성\s*지문|서약\s*확인\s*상태|조사\s*착수일|보고[·\s]*종결일|종합\s*판단\s*요약|일시|장소|참석자|소속|직위|성명|연락처)$/;
  var ISSUE_CLUE_RE = /(폭언|욕설|고성|모욕|비하|사직|퇴사|따돌림|배제|무시|사적\s*지시|심부름|회식|성희롱|신체\s*접촉|성적|외모|야근\s*강요|업무\s*과다|업무\s*배제|협박|서류\s*투척|던지|강요|괴롭)/;
  var DATE_PLACE_RE = /((?:20\d{2}\s*[년./-]\s*)?\d{1,2}\s*[월./-]\s*\d{1,2}\s*일?(?:\s*(?:경|쯤|오전|오후|\d{1,2}시))?(?:\s*[가-힣A-Za-z0-9]{1,10}(?:회의실|사무실|식당|현장|단톡방|메신저|자리))?)/;

  function cleanUtterance(s) {
    return maskRrnText(str(s).replace(TS_HEAD_RE, '').replace(/\s+/g, ' ').trim());
  }

  function extractCandidateIssuesFromQa(qaList, roleHint) {
    var candidateIssues = [];
    var seenTitles = {};
    (qaList || []).forEach(function (qa) {
      if (candidateIssues.length >= 10) return;
      var a = str(qa && qa.a);
      var mClue = a.match(ISSUE_CLUE_RE);
      if (!mClue) return;
      var mWhen = a.match(DATE_PLACE_RE);
      var whenWhere = mWhen ? str(mWhen[1]) : '';
      var kw = mClue[1];
      var title = (whenWhere ? whenWhere + ' ' : '') + kw + ' 관련 행위';
      if (seenTitles[title]) return;
      seenTitles[title] = 1;
      var snippet = a.length > 160 ? (a.slice(0, 158) + '…') : a;
      candidateIssues.push({
        title: maskRrnText(title.slice(0, 80)),
        whenWhere: maskRrnText(whenWhere.slice(0, 80)),
        claimVictim: roleHint === 'accused' ? '' : maskRrnText(snippet),
        claimAccused: roleHint === 'accused' ? maskRrnText(snippet) : '',
        evidenceNote: roleHint === 'witness' ? ('참고인 진술: ' + maskRrnText(snippet)) : ''
      });
    });
    return candidateIssues;
  }

  /* 자체 생성 「비밀유지서약 및 면담 진술확인서」(.hwpx) 추출 텍스트를 무손실 복원 */
  function tryParseStructuredInterviewText(safeRaw, roleHint) {
    var i3 = safeRaw.indexOf('3. 면담 문답(Q&A) 정리 내역');
    var i4 = safeRaw.indexOf('4. 진술 핵심 요지');
    if (i3 < 0 || i4 <= i3) return null;
    var i5 = safeRaw.indexOf('5. 진술인 열람 후 정정·보완 의견', i4);
    var i6 = safeRaw.indexOf('6. 진술 확인 및 서명', i5 > 0 ? i5 : i4);

    var qaBlock = safeRaw.slice(i3 + '3. 면담 문답(Q&A) 정리 내역'.length, i4).trim();
    var sumEnd = i5 > i4 ? i5 : (i6 > i4 ? i6 : safeRaw.length);
    var sumBlock = safeRaw.slice(i4 + '4. 진술 핵심 요지'.length, sumEnd).trim();
    var amendBlock = (i5 > i4)
      ? safeRaw.slice(i5 + '5. 진술인 열람 후 정정·보완 의견'.length, i6 > i5 ? i6 : safeRaw.length).trim()
      : '';

    var qaList = [];
    if (qaBlock.indexOf('【문') >= 0) {
      var curItem = null;
      var curField = '';
      qaBlock.split(/\r?\n/).forEach(function (rawLn) {
        var ln = String(rawLn == null ? '' : rawLn);
        var mQ = ln.match(/^\s*【문\d+】\s?(.*)$/);
        if (mQ) {
          curItem = { qLines: [mQ[1]], aLines: [] };
          qaList.push(curItem);
          curField = 'q';
          return;
        }
        var mA = ln.match(/^\s*【답\d+】\s?(.*)$/);
        if (mA && curItem) {
          curItem.aLines.push(mA[1]);
          curField = 'a';
          return;
        }
        if (!curItem) return;
        if (curField === 'q') curItem.qLines.push(ln);
        else if (curField === 'a') curItem.aLines.push(ln);
      });
      qaList = qaList.map(function (it) {
        var qTxt = maskRrnText(it.qLines.join('\n').trim());
        var aTxt = maskRrnText(it.aLines.join('\n').trim());
        if (qTxt === '-') qTxt = '';
        if (aTxt === '-') aTxt = '';
        return (qTxt || aTxt) ? { q: qTxt || '진술 사항 확인', a: aTxt || '(답변 확인 필요)' } : null;
      }).filter(Boolean);
    } else {
      qaBlock.split(/\r?\n/).forEach(function (line) {
        var s = str(line);
        if (!s || s.indexOf('개별 문답 항목 없이') >= 0) return;
        if (s.indexOf('|') >= 0) {
          var cols = s.split('|').map(function (c) { return str(c); });
          if (cols.length >= 3 && /^순번$/.test(cols[0])) return;
          if (cols.length >= 3 && /^\d+$/.test(cols[0])) {
            var qTxt = cleanUtterance(cols[1] === '-' ? '' : cols[1]);
            var aTxt = cleanUtterance(cols.slice(2).join(' | ') === '-' ? '' : cols.slice(2).join(' | '));
            if (qTxt || aTxt) qaList.push({ q: qTxt || '진술 사항 확인', a: aTxt || '(답변 확인 필요)' });
          }
        }
      });
    }

    var truncatedQaCount = 0;
    if (qaList.length > MAX_QA_ITEMS) {
      truncatedQaCount = qaList.length - MAX_QA_ITEMS;
      qaList = qaList.slice(0, MAX_QA_ITEMS);
    }
    var summary = sumBlock === '(진술 요지 미입력)' ? '' : maskRrnText(sumBlock);
    var amendNote = (!amendBlock || amendBlock.indexOf('별도 정정·보완 의견 없음') === 0) ? '' : maskRrnText(amendBlock);
    return {
      qaList: qaList,
      summary: summary,
      amendNote: amendNote,
      candidateIssues: extractCandidateIssuesFromQa(qaList, roleHint),
      truncatedQaCount: truncatedQaCount,
      fromStructuredDoc: true
    };
  }

  function parseTranscriptFallback(rawText, roleHint) {
    var safeRaw = maskRrnText(String(rawText == null ? '' : rawText));
    if (!str(safeRaw)) return { qaList: [], summary: '', candidateIssues: [], truncatedQaCount: 0 };

    var structured = tryParseStructuredInterviewText(safeRaw, roleHint);
    if (structured) return structured;

    var rawLines = safeRaw.split(/\r?\n/);
    var turns = [];
    var inQaTable = false;
    rawLines.forEach(function (line) {
      var s = String(line || '').replace(TS_HEAD_RE, '').trim();
      if (!s) return;
      /* 한글(.hwpx) 표 추출 줄: 순번 | 질문 | 답변 또는 질문 | 답변 */
      if (s.indexOf('|') >= 0) {
        var cols = s.split('|').map(function (c) { return str(c); }).filter(Boolean);
        if (cols.length >= 2) {
          var headJoin = cols.join(' ');
          if (/^(?:순번|연번|번호)?\s*(?:질문|문|조사자|조사역)/.test(headJoin) && cols[0].length <= 10 && cols[1].length <= 16) {
            inQaTable = true;
            return;
          }
          /* 4칸 개요표나 메타데이터 머리칸 표는 문답으로 오인하지 않고 건너뛴다 */
          if (cols.length >= 4 && (META_LABEL_RE.test(cols[0]) || META_LABEL_RE.test(cols[2]))) return;
          if (META_LABEL_RE.test(cols[0])) return;
          var hasNumSeq = cols.length >= 3 && /^\d{1,4}$/.test(cols[0]);
          if (inQaTable || hasNumSeq || cols.length === 2) {
            var qCol = hasNumSeq ? cols[1] : cols[0];
            var aCol = hasNumSeq ? cols.slice(2).join(' ') : cols.slice(1).join(' ');
            if (qCol && aCol) {
              turns.push({ kind: 'Q', text: cleanUtterance(qCol) });
              turns.push({ kind: 'A', text: cleanUtterance(aCol) });
              return;
            }
          }
        }
      } else {
        inQaTable = false;
      }
      if (Q_LABEL_RE.test(s)) {
        turns.push({ kind: 'Q', text: cleanUtterance(s.replace(Q_LABEL_RE, '')) });
        return;
      }
      if (A_LABEL_RE.test(s)) {
        turns.push({ kind: 'A', text: cleanUtterance(s.replace(A_LABEL_RE, '')) });
        return;
      }
      /* 일반 이름: 말 모양 (예: 김노무: ... / 박주임: ...), 단 서지사항 메타 라벨은 제외 */
      var spMatch = s.match(/^([가-힣A-Za-z0-9_·\s]{1,12})\s*[:：]\s*(.+)$/);
      if (spMatch && spMatch[2]) {
        var spk = str(spMatch[1]);
        if (META_LABEL_RE.test(spk)) return;
        var body = cleanUtterance(spMatch[2]);
        var isQ = /노무|조사|위원|진행|질문|\?$/.test(spk) || (!turns.length && /\?\s*$/.test(body));
        turns.push({ kind: isQ ? 'Q' : 'A', speaker: spk, text: body });
        return;
      }
      if (turns.length) {
        turns[turns.length - 1].text = cleanUtterance(turns[turns.length - 1].text + ' ' + s);
      } else {
        turns.push({ kind: /\?\s*$/.test(s) ? 'Q' : 'A', text: cleanUtterance(s) });
      }
    });

    var qaList = [];
    var curQ = '';
    var curA = [];
    function flushPair() {
      var qTxt = str(curQ);
      var aTxt = str(curA.join(' '));
      if (qTxt || aTxt) {
        qaList.push({
          q: qTxt || '진술 사항 확인',
          a: aTxt || '(답변 확인 필요)'
        });
      }
      curQ = '';
      curA = [];
    }
    turns.forEach(function (t) {
      if (!str(t.text)) return;
      if (t.kind === 'Q') {
        if (curQ && curA.length) flushPair();
        curQ = curQ ? (curQ + ' ' + t.text) : t.text;
      } else {
        curA.push(t.text);
      }
    });
    flushPair();

    /* 화자 구분 없이 통문단으로 작성된 진술서일 경우 문단 단위로 정돈 */
    if (qaList.length <= 1 && !turns.some(function (t) { return t.kind === 'Q'; })) {
      var paras = safeRaw.split(/\n\s*\n/).map(cleanUtterance).filter(function (p) { return p.length >= 8; });
      if (paras.length >= 2) {
        qaList = paras.map(function (p, i) {
          return { q: '진술 항목 ' + (i + 1), a: p };
        });
      }
    }
    var truncatedQaCount = 0;
    if (qaList.length > MAX_QA_ITEMS) {
      truncatedQaCount = qaList.length - MAX_QA_ITEMS;
      qaList = qaList.slice(0, MAX_QA_ITEMS);
    }

    /* 핵심 진술 요지 생성 (답변 중심 상위 핵심 문장 추출) */
    var answerPool = qaList.map(function (x) { return str(x.a); }).filter(function (a) { return a && a !== '(답변 확인 필요)'; });
    var summaryBullets = [];
    answerPool.forEach(function (ans) {
      if (summaryBullets.length >= 5) return;
      var shortAns = ans.length > 140 ? (ans.slice(0, 138) + '…') : ans;
      if (ISSUE_CLUE_RE.test(ans) || DATE_PLACE_RE.test(ans) || summaryBullets.length < 3) {
        summaryBullets.push('• ' + shortAns);
      }
    });
    if (!summaryBullets.length && str(safeRaw)) {
      summaryBullets.push('• ' + cleanUtterance(safeRaw).slice(0, 200));
    }

    return {
      qaList: qaList,
      summary: maskRrnText(summaryBullets.join('\n')),
      candidateIssues: extractCandidateIssuesFromQa(qaList, roleHint),
      truncatedQaCount: truncatedQaCount
    };
  }

  function buildTranscriptAiPrompt(maskedText, meta) {
    var m = obj(meta) ? meta : {};
    var roleKr = m.role === 'accused' ? '피신고인(행위자)' : m.role === 'witness' ? '참고인' : '신고인(피해근로자)';
    var clipped = maskRrnText(String(maskedText == null ? '' : maskedText)).slice(0, 28000);
    return [
      '당신은 대한민국 공인노무사의 직장 내 괴롭힘·성희롱 사건 조사를 보조하는 전문 기록 정리기입니다.',
      '아래 면담 녹취록(또는 진술서) 원문을 읽고 객관적·중립적 문체로 정리하여 **오직 JSON 객체 하나**만 출력하세요.',
      '절대 추측하거나 원문에 없는 사실을 보태지 말고, 주민등록번호가 보이면 000000-******* 로 가리세요.',
      '',
      '[면담 정보]',
      '- 대상자 구분: ' + roleKr,
      '- 대상자 호칭: ' + (maskRrnText(str(m.alias)) || roleKr),
      '- 면담 일자·방식: ' + (str(m.date) || '미기재') + ' / ' + (str(m.method) || '면담'),
      '',
      '[출력 JSON 형식]',
      '{',
      '  "qaList": [ { "q": "조사자 질문 요지", "a": "진술인 답변 내용(1인칭 또는 객관화 정돈)" } ],',
      '  "summary": "• 핵심 진술 요지 1\\n• 핵심 진술 요지 2\\n• 핵심 진술 요지 3",',
      '  "candidateIssues": [',
      '    { "title": "쟁점 행위 제목(예: 10.14 주간회의 중 폭언 및 사직 강요)", "whenWhere": "일시·장소", "claimVictim": "신고인 측 진술 요지", "claimAccused": "피신고인 측 소명 요지", "evidenceNote": "관련 참고인 진술·언급 증거" }',
      '  ]',
      '}',
      '',
      '[원문 시작]',
      clipped,
      '[원문 끝]'
    ].join('\n');
  }

  function normalizeTranscriptAiResult(rawInput, fallbackRawText, roleHint) {
    var parsed = null;
    if (obj(rawInput)) {
      parsed = rawInput;
    } else if (typeof rawInput === 'string') {
      var txt = rawInput.replace(/```json|```/gi, '').trim();
      var firstBrace = txt.indexOf('{');
      var lastBrace = txt.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) txt = txt.slice(firstBrace, lastBrace + 1);
      try { parsed = JSON.parse(txt); } catch (e) { parsed = null; }
    }
    var fb = parseTranscriptFallback(fallbackRawText, roleHint);
    if (!obj(parsed)) return fb;

    var rawQa = Array.isArray(parsed.qaList)
      ? parsed.qaList.filter(obj).map(function (x) {
        return { q: maskRrnText(str(x.q).slice(0, 500)), a: maskRrnText(str(x.a).slice(0, 2500)) };
      }).filter(function (x) { return x.q || x.a; })
      : [];
    var truncatedQaCount = rawQa.length > MAX_QA_ITEMS ? (rawQa.length - MAX_QA_ITEMS) : 0;
    var qaList = rawQa.slice(0, MAX_QA_ITEMS);
    if (!qaList.length) {
      qaList = fb.qaList;
      truncatedQaCount = fb.truncatedQaCount || 0;
    }

    var summary = '';
    if (Array.isArray(parsed.summary)) {
      summary = parsed.summary.map(function (s) { return '• ' + str(s).replace(/^[•\-*]\s*/, ''); }).join('\n');
    } else {
      summary = str(parsed.summary);
    }
    summary = maskRrnText(summary.slice(0, 4000)) || fb.summary;

    var candidateIssues = Array.isArray(parsed.candidateIssues)
      ? parsed.candidateIssues.filter(obj).map(function (iss) {
        return {
          title: maskRrnText(str(iss.title).slice(0, 120)),
          whenWhere: maskRrnText(str(iss.whenWhere).slice(0, 100)),
          claimVictim: maskRrnText(str(iss.claimVictim).slice(0, 800)),
          claimAccused: maskRrnText(str(iss.claimAccused).slice(0, 800)),
          evidenceNote: maskRrnText(str(iss.evidenceNote).slice(0, 800))
        };
      }).filter(function (iss) { return !!iss.title; }).slice(0, 12)
      : fb.candidateIssues;

    return { qaList: qaList, summary: summary, candidateIssues: candidateIssues, truncatedQaCount: truncatedQaCount };
  }

  /* ═══ 사건 메일·진행단계·상담녹취 기반 좌·우 통합작업실(Left/Right Pane) 자동 채움 합성기 ═══
   * - 기존에 사람이 작성한 항목은 절대 덮어쓰지 않고(보존), 비어 있는 좌측 면담카드·우측 신고요지·3요건 검토표·권고안·결론·보고서 초안을 자동으로 채운다.
   * - 현장 상담 녹취나 새 면담(opts.upsertInterview · opts.extraCandidateIssues)이 들어오면 좌측 면담 목록과 우측 3요건 검토표·보고서 본문까지 한 번에 연동 갱신한다.
   */
  function normIssueTitle(t) {
    return str(t).replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, '').toLowerCase();
  }

  function synthesizeWorkspaceFromCase(caseRec, existingSecret, opts) {
    var c = obj(caseRec) ? caseRec : {};
    var sec = obj(existingSecret) ? existingSecret : {};
    var o = obj(opts) ? opts : {};
    var cid = str(c.id || sec.id || 'case');
    var catCode = CATEGORIES[c.category] ? c.category : 'harass';
    var cat = CATEGORIES[catCode];
    var steps = obj(c.steps) ? c.steps : {};
    var prog = summarizeProgress(steps, c.closeDate);
    var mails = Array.isArray(c.mailLinks) ? c.mailLinks : [];

    /* 1) 좌측 단: 면담·상담 진술 목록 (interviews) */
    var rawIvs = Array.isArray(sec.interviews) ? sec.interviews.slice() : [];
    if (obj(o.upsertInterview) && str(o.upsertInterview.id)) {
      var upIdx = rawIvs.findIndex(function (x) { return obj(x) && x.id === o.upsertInterview.id; });
      if (upIdx >= 0) rawIvs[upIdx] = o.upsertInterview;
      else rawIvs.push(o.upsertInterview);
    }
    var activeIvs = rawIvs.filter(function (x) { return obj(x) && !x._deleted; });

    if (!activeIvs.length) {
      var stmtMails = mails.filter(function (m) {
        if (!obj(m)) return false;
        if (m.docRole === 'victim_stmt' || m.docRole === 'accused_stmt' || m.docRole === 'witness_evid') return true;
        var txt = str(m.subject) + ' ' + (Array.isArray(m.attNames) ? m.attNames.join(' ') : '');
        return /진술|소명|면담|상담|녹취|문답|답변서|확인서|경위서/.test(txt);
      });

      stmtMails.slice(0, 6).forEach(function (ml, idx) {
        var rCode = ml.docRole === 'accused_stmt' ? 'accused' : ml.docRole === 'witness_evid' ? 'witness' : 'victim';
        var txt = str(ml.subject) + ' ' + (Array.isArray(ml.attNames) ? ml.attNames.join(' ') : '');
        if (rCode === 'victim' && /피신고|행위자|가해|소명|반론/.test(txt)) rCode = 'accused';
        else if (rCode === 'victim' && /참고인|목격/.test(txt)) rCode = 'witness';
        var roleAlias = rCode === 'accused' ? '피신고인 측 소명·면담 기록' : rCode === 'witness' ? '참고인 진술·제출증거 기록' : '신고인(피해근로자) 상담·진술 기록';
        var attList = (Array.isArray(ml.attNames) && ml.attNames.length) ? ml.attNames.map(maskRrnText).join(', ') : '';
        var method = /서면|진술서|소명서|답변서|경위서|의견서/.test(txt) ? '서면진술' : '대면면담';
        var qPrompt = rCode === 'accused'
          ? '신고 사안에 대한 피신고인 측 사실관계 소명 및 입장 확인'
          : rCode === 'witness'
            ? '참고인 목격 경위 및 객관적 제출 증빙 확인'
            : '신고 접수 경위 및 피해 주장 핵심 사실 확인';
        var ansTxt = maskRrnText(str(ml.subject || '수집 진술 자료')) + (attList ? (' [첨부: ' + attList + ']') : '');
        var sumLines = ['• [' + (str(ml.date) || '수집자료') + '] ' + maskRrnText(str(ml.subject || '진술·면담 관련 공문'))];
        if (attList) sumLines.push('• 확인 첨부서류: ' + attList);
        var synthIv = {
          id: 'iv_auto_' + safeKey(cid + '_' + (ml.key || idx)),
          role: rCode,
          alias: roleAlias + (stmtMails.length > 1 ? ' #' + (idx + 1) : ''),
          dept: '',
          date: str(ml.date) || str(c.receiveDate) || ymdOf(Date.now()),
          method: method,
          pledgeSigned: !!(steps.pledge && steps.pledge.done),
          summary: maskRrnText(sumLines.join('\n')),
          qaList: [{ q: qPrompt, a: ansTxt }],
          rawTranscript: '',
          amendNote: '',
          stmtSigned: false,
          autoSynthesized: true
        };
        rawIvs.push(synthIv);
        activeIvs.push(synthIv);
      });

      if (!activeIvs.length) {
        var firstMail = mails[mails.length - 1] || mails[0] || null;
        var baseDate = str(c.receiveDate) || (firstMail && str(firstMail.date)) || ymdOf(Date.now());
        var intakeNote = (steps.intake && str(steps.intake.note)) || (firstMail && str(firstMail.subject)) || (str(c.title) || (cat.label + ' 조사 의뢰 접수'));
        var docSummary = mails.length
          ? ('수집 공문·서류 총 ' + mails.length + '건 (' + mails.slice(0, 3).map(function (m) { return maskRrnText(str(m.subject)).slice(0, 45); }).join(' / ') + ')')
          : '초기 수임·상담 접수 기록 (현장 상담 실시간 녹취 또는 녹취록 파일 업로드로 상세 문답 추가 가능)';
        var baseIv = {
          id: 'iv_auto_intake_' + safeKey(cid),
          role: 'victim',
          alias: '초기 상담·접수 기초기록',
          dept: '',
          date: baseDate,
          method: '대면면담',
          pledgeSigned: !!(steps.pledge && steps.pledge.done),
          summary: maskRrnText('• 접수·착수 요지: ' + intakeNote + '\n• 기초 수집현황: ' + docSummary),
          qaList: [
            {
              q: '사건 의뢰 및 초기 상담·신고 접수 경위',
              a: maskRrnText((str(c.companyName) ? str(c.companyName) + ' — ' : '') + intakeNote)
            },
            {
              q: '수집 공문 및 진행 단계 확인 사항',
              a: maskRrnText('현재 ' + prog.doneCount + '/8단계(' + prog.currentStepShort + ') 진행 · ' + docSummary)
            }
          ],
          rawTranscript: '',
          amendNote: '',
          stmtSigned: false,
          autoSynthesized: true
        };
        rawIvs.push(baseIv);
        activeIvs.push(baseIv);
      }
    }

    /* 2) 우측 단: 쟁점 행위별 사실인정 및 법정 3요건 검토표 (issues) */
    var rawIssues = Array.isArray(sec.issues) ? sec.issues.slice() : [];
    var activeIssues = rawIssues.filter(function (x) { return obj(x) && !x._deleted; });
    var seenIssueNorm = {};
    activeIssues.forEach(function (iss) {
      var nk = normIssueTitle(iss.title);
      if (nk) seenIssueNorm[nk] = 1;
    });

    var incomingCands = [];
    if (Array.isArray(o.extraCandidateIssues)) {
      incomingCands = incomingCands.concat(o.extraCandidateIssues);
    }
    activeIvs.forEach(function (iv) {
      var extracted = extractCandidateIssuesFromQa(iv.qaList || [], iv.role || 'victim');
      extracted.forEach(function (ci) {
        incomingCands.push(Object.assign({}, ci, {
          _sourceAlias: str(iv.alias)
        }));
      });
    });

    incomingCands.forEach(function (ci, idx) {
      if (!obj(ci) || !str(ci.title)) return;
      var nk = normIssueTitle(ci.title);
      if (!nk || seenIssueNorm[nk]) return;
      seenIssueNorm[nk] = 1;
      var newIss = {
        id: 'iss_auto_' + safeKey(cid + '_' + nk.slice(0, 24) + '_' + idx),
        title: maskRrnText(str(ci.title).slice(0, 120)),
        whenWhere: maskRrnText(str(ci.whenWhere).slice(0, 100)),
        claimVictim: maskRrnText(str(ci.claimVictim).slice(0, 800)),
        claimAccused: maskRrnText(str(ci.claimAccused).slice(0, 800)),
        evidenceNote: maskRrnText(str(ci.evidenceNote) || ((ci._sourceAlias ? ci._sourceAlias + ' ' : '') + '면담·녹취 진술 및 수집 자료 대조')),
        factStatus: 'hold',
        elemSuperiority: 'hold',
        elemBeyondScope: 'hold',
        elemHarm: 'hold',
        verdict: 'hold',
        autoSynthesized: true
      };
      newIss.verdict = judgeIssue(newIss);
      rawIssues.push(newIss);
      activeIssues.push(newIss);
    });

    if (!activeIssues.length) {
      var vCode = str(c.verdictSummary);
      var defFact = vCode === 'recognized' ? 'recognized' : vCode === 'partial' ? 'partial' : vCode === 'unrecognized' ? 'unrecognized' : 'hold';
      var defElem = vCode === 'recognized' ? 'yes' : vCode === 'unrecognized' ? 'no' : 'hold';
      var vicIv = activeIvs.find(function (x) { return x.role === 'victim'; });
      var accIv = activeIvs.find(function (x) { return x.role === 'accused'; });
      var baseTitle = maskRrnText((str(c.title) || (cat.label + ' 신고 사안')) + ' 관련 핵심 행위 요건 검토');
      var baseIss = {
        id: 'iss_auto_base_' + safeKey(cid),
        title: baseTitle.slice(0, 120),
        whenWhere: maskRrnText(((str(c.receiveDate) ? str(c.receiveDate) + ' 전후 · ' : '') + (str(c.companyName) || '의뢰 사업장')).slice(0, 100)),
        claimVictim: maskRrnText((vicIv && str(vicIv.summary)) ? str(vicIv.summary).replace(/^•\s*/gm, '').slice(0, 300) : '신고 접수 및 피해근로자 측 진술 요지 확인'),
        claimAccused: maskRrnText((accIv && str(accIv.summary)) ? str(accIv.summary).replace(/^•\s*/gm, '').slice(0, 300) : '피신고인 측 업무상 경위 및 소명 의견 확인'),
        evidenceNote: maskRrnText(mails.length ? ('수집 공문·첨부서류 ' + mails.length + '건 및 당사자 진술 교차 검토') : '상담·면담 진술 및 객관적 제출 증빙 대조'),
        factStatus: defFact,
        elemSuperiority: defFact === 'recognized' ? 'yes' : defElem,
        elemBeyondScope: defElem,
        elemHarm: defElem,
        verdict: 'hold',
        autoSynthesized: true
      };
      baseIss.verdict = vCode === 'recognized' ? 'yes' : vCode === 'unrecognized' ? 'no' : judgeIssue(baseIss);
      rawIssues.push(baseIss);
      activeIssues.push(baseIss);
    }

    /* 3) 우측 단: 신고요지(overview) · 맞춤권고(recommendations) · 결론요지(conclusion) */
    var lawBasis = catCode === 'sexual'
      ? '남녀고용평등법 제14조'
      : catCode === 'both'
        ? '근로기준법 제76조의2·제76조의3 및 남녀고용평등법 제14조'
        : '근로기준법 제76조의2·제76조의3';

    var nextOverview = str(sec.overview);
    if (!nextOverview || o.forceOverwrite) {
      var coTxt = str(c.companyName) || '의뢰 사업장';
      var recvTxt = str(c.receiveDate) ? (str(c.receiveDate) + ' 수임·착수하여 ') : '';
      var mailStatTxt = mails.length
        ? ('푸른 메일함에서 관련 공문·진술·보고 자료 총 ' + mails.length + '건을 수집·대조하였으며, ')
        : '';
      nextOverview = maskRrnText(
        coTxt + '에서 의뢰한 ' + cat.label + '(' + lawBasis + ') 조사 사안(' + (str(c.title) || cat.label + ' 조사') + ')으로, ' +
        recvTxt + mailStatTxt + '현재 8단계 표준 조사 절차 중 ' + prog.doneCount + '단계(' + prog.currentStepName + ') 기준으로 면담 진술 및 법정 요건을 검토함.'
      );
    }

    var nextRec = str(sec.recommendations);
    if (!nextRec || o.forceOverwrite) {
      if (catCode === 'sexual') {
        nextRec = '남녀고용평등법 제14조에 따른 피해근로자 보호·근무장소 분리, 비밀유지 준수 및 전 직원 성희롱 예방 특별교육 권고';
      } else if (catCode === 'both') {
        nextRec = '근로기준법 제76조의3 및 남녀고용평등법 제14조에 따른 당사자 분리배치 유지, 피해자 의견청취 후 인사조치 및 조직문화·예방 특별교육 권고';
      } else {
        nextRec = '근로기준법 제76조의3에 따른 피해근로자 의견청취·보호조치(분리배치 등), 참여자 비밀유지 엄수 및 상호존중 조직문화 교육 실시 권고';
      }
    }

    var nextConclusion = str(sec.conclusion);
    if (!nextConclusion || o.forceOverwrite) {
      var verdictInfo = VERDICTS[str(c.verdictSummary)] || VERDICTS[''];
      if (str(c.closeDate) || (steps.report && steps.report.done)) {
        nextConclusion = maskRrnText(
          '수집된 공문·증빙(' + mails.length + '건)과 당사자 진술(' + activeIvs.length + '건), 쟁점 행위(' + activeIssues.length + '건)의 법정 요건 검토를 종합하여 최종 보고서 제출 및 조사를 종결함 (' + verdictInfo.label + ').'
        );
      } else {
        nextConclusion = maskRrnText(
          '당사자 상담·면담 진술(' + activeIvs.length + '건) 및 수집 자료(' + mails.length + '건)를 교차 대조하여 총 ' + activeIssues.length + '개 쟁점 행위의 사실인정 여부와 법정 3요건 충족 여부를 종합 판단함 (' + verdictInfo.label + ').'
        );
      }
    }

    var nextSec = Object.assign({}, sec, {
      id: cid,
      companyId: str(c.companyId || sec.companyId),
      overview: maskRrnText(nextOverview),
      conclusion: maskRrnText(nextConclusion),
      recommendations: maskRrnText(nextRec),
      interviews: rawIvs,
      issues: rawIssues
    });

    var curBody = str(sec.reportBody);
    var allowAutoRefresh = !curBody || o.forceOverwrite || (o.refreshReportBody && (o.forceRefreshBody || sec.reportBodyAuto !== false));
    if (allowAutoRefresh) {
      nextSec.reportBody = assembleReportDraft(c, nextSec);
      nextSec.reportBodyAuto = true;
    } else {
      nextSec.reportBody = maskRrnText(curBody);
      nextSec.reportBodyAuto = sec.reportBodyAuto === true;
    }

    return nextSec;
  }

  /* 클로바노트·다글로·음성메모 텍스트의 화자 표기(참석자 1, 화자 A 등)를 조사역·진술인 표준 머리말로 일괄 치환 */
  function replaceTranscriptSpeakers(rawText, qSpeaker, aSpeaker, aRoleLabel) {
    var out = maskRrnText(String(rawText == null ? '' : rawText));
    function escRe(v) { return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    if (Array.isArray(qSpeaker)) {
      qSpeaker.forEach(function (pair) {
        if (!obj(pair) || !str(pair.from) || !str(pair.to)) return;
        var pRe = new RegExp('(^|\\n)(\\s*(?:\\[\\d{1,2}:\\d{2}(?::\\d{2})?\\]\\s*|\\(\\d{1,2}:\\d{2}(?::\\d{2})?\\)\\s*|\\d{1,2}:\\d{2}(?::\\d{2})?\\s*)?)' + escRe(str(pair.from)) + '(?:\\s*[:.)\\]】>]\\s*|\\s{2,})', 'gm');
        out = out.replace(pRe, '$1$2' + str(pair.to) + ': ');
      });
      return out;
    }
    if (obj(qSpeaker)) {
      Object.keys(qSpeaker).forEach(function (fromKey) {
        var toVal = str(qSpeaker[fromKey]);
        if (!str(fromKey) || !toVal) return;
        var oRe = new RegExp('(^|\\n)(\\s*(?:\\[\\d{1,2}:\\d{2}(?::\\d{2})?\\]\\s*|\\(\\d{1,2}:\\d{2}(?::\\d{2})?\\)\\s*|\\d{1,2}:\\d{2}(?::\\d{2})?\\s*)?)' + escRe(str(fromKey)) + '(?:\\s*[:.)\\]】>]\\s*|\\s{2,})', 'gm');
        out = out.replace(oRe, '$1$2' + toVal + ': ');
      });
      return out;
    }
    var qs = str(qSpeaker);
    var as = str(aSpeaker);
    var rLbl = str(aRoleLabel) || '진술인';
    if (qs) {
      var qRe = new RegExp('(^|\\n)(\\s*(?:\\[\\d{1,2}:\\d{2}(?::\\d{2})?\\]\\s*|\\(\\d{1,2}:\\d{2}(?::\\d{2})?\\)\\s*|\\d{1,2}:\\d{2}(?::\\d{2})?\\s*)?)' + escRe(qs) + '(?:\\s*[:.)\\]】>]\\s*|\\s{2,})', 'gm');
      out = out.replace(qRe, '$1$2문(조사역): ');
    }
    if (as) {
      var aRe = new RegExp('(^|\\n)(\\s*(?:\\[\\d{1,2}:\\d{2}(?::\\d{2})?\\]\\s*|\\(\\d{1,2}:\\d{2}(?::\\d{2})?\\)\\s*|\\d{1,2}:\\d{2}(?::\\d{2})?\\s*)?)' + escRe(as) + '(?:\\s*[:.)\\]】>]\\s*|\\s{2,})', 'gm');
      out = out.replace(aRe, '$1$2답(' + rLbl + '): ');
    }
    return out;
  }

  /* JSON 형태 녹취록(클로바노트·Whisper segments 배열 등)에서 시간·화자·발화 추출 */
  function parseJsonTranscript(jsonStr) {
    try {
      var objData = JSON.parse(String(jsonStr || ''));
      var segs = Array.isArray(objData) ? objData
        : Array.isArray(objData && objData.segments) ? objData.segments
        : Array.isArray(objData && objData.utterances) ? objData.utterances
        : [];
      if (!segs.length) return '';
      var lines = [];
      segs.forEach(function (sg) {
        if (!obj(sg)) return;
        var txt = str(sg.text || sg.msg || sg.transcript || sg.content);
        if (!txt) return;
        var spk = str((obj(sg.speaker) ? (sg.speaker.name || sg.speaker.label) : sg.speaker) || sg.speakerLabel || '');
        var secVal = typeof sg.start === 'number' ? (sg.start > 1000 ? Math.floor(sg.start / 1000) : Math.floor(sg.start)) : -1;
        var ts = '';
        if (secVal >= 0) {
          var mm = String(Math.floor(secVal / 60)).padStart(2, '0');
          var ss = String(secVal % 60).padStart(2, '0');
          ts = '[' + mm + ':' + ss + '] ';
        }
        lines.push(ts + (spk ? (spk + ': ') : '') + txt);
      });
      return maskRrnText(lines.join('\n'));
    } catch (e) {
      return '';
    }
  }

  return {
    STEPS: STEPS,
    CATEGORIES: CATEGORIES,
    CASE_SUBTYPES: CASE_SUBTYPES,
    LEGAL_SCHEMAS: LEGAL_SCHEMAS,
    DISCIPLINARY_GUIDE: DISCIPLINARY_GUIDE,
    SURVEY_QUESTIONS: SURVEY_QUESTIONS,
    PERFORM_MODES: PERFORM_MODES,
    DOC_ROLES: DOC_ROLES,
    VERDICTS: VERDICTS,
    NOTE_START: NOTE_START,
    NOTE_END: NOTE_END,
    str: str,
    safeKey: safeKey,
    ymdOf: ymdOf,
    effectiveDueDateOf: effectiveDueDateOf,
    inferIssueLawType: inferIssueLawType,
    getLegalSchema: getLegalSchema,
    parseAddrs: parseAddrs,
    domainOf: domainOf,
    isPrivateDomain: isPrivateDomain,
    findOverlappingSiblings: findOverlappingSiblings,
    coNameNorm: coNameNorm,
    coCoreNorm: coCoreNorm,
    maskRrnText: maskRrnText,
    hasUnmaskedRrn: hasUnmaskedRrn,
    canAccessSecret: canAccessSecret,
    inferCategory: inferCategory,
    classifyDocRole: classifyDocRole,
    extractOrgName: extractOrgName,
    flattenMailbox: flattenMailbox,
    buildCompanyDirectory: buildCompanyDirectory,
    resolveCompanyByOrgName: resolveCompanyByOrgName,
    inferManagerSidFromText: inferManagerSidFromText,
    buildKoreanCaseTitle: buildKoreanCaseTitle,
    isErpInvestigateCase: isErpInvestigateCase,
    MAX_CASE_MAILS: MAX_CASE_MAILS,
    inspectMailForHarass: inspectMailForHarass,
    scanMailsForCaseInternal: scanMailsForCaseInternal,
    collectMailsForCase: collectMailsForCase,
    findAmbiguousCompanyMails: findAmbiguousCompanyMails,
    deriveStepsFromMails: deriveStepsFromMails,
    inferStepsFromText: inferStepsFromText,
    applyExternalLogsToSteps: applyExternalLogsToSteps,
    dedupeWorkItems: dedupeWorkItems,
    integrateExternalSources: integrateExternalSources,
    classifyPerformMode: classifyPerformMode,
    hasDirectResultReport: hasDirectResultReport,
    summarizeProgress: summarizeProgress,
    discoverUnregisteredBundles: discoverUnregisteredBundles,
    caseYearOf: caseYearOf,
    bundleYearOf: bundleYearOf,
    buildYearlyArchive: buildYearlyArchive,
    mergeErpNote: mergeErpNote,
    buildErpSyncPayload: buildErpSyncPayload,
    CREDIBILITY_FACTORS: CREDIBILITY_FACTORS,
    MOEL_OBLIGATION_CHECKS: MOEL_OBLIGATION_CHECKS,
    isMoelObligationMet: isMoelObligationMet,
    REPORT_TEMPLATES: REPORT_TEMPLATES,
    STATEMENT_STYLES: STATEMENT_STYLES,
    INTERVIEW_TEMPLATES: INTERVIEW_TEMPLATES,
    normalizeTemplateId: normalizeTemplateId,
    pickDefaultInterviewTemplate: pickDefaultInterviewTemplate,
    evaluateIssueCredibility: evaluateIssueCredibility,
    evaluateTemplateCompleteness: evaluateTemplateCompleteness,
    judgeIssue: judgeIssue,
    renumberEvidences: renumberEvidences,
    extractEvidencesFromMails: extractEvidencesFromMails,
    buildCaseTimelineRows: buildCaseTimelineRows,
    aggregateSurveyResponses: aggregateSurveyResponses,
    suggestDisciplinaryLevel: suggestDisciplinaryLevel,
    buildRecomplaintComparison: buildRecomplaintComparison,
    anonymizeReportPackage: anonymizeReportPackage,
    assembleReportDraft: assembleReportDraft,
    synthesizeWorkspaceFromCase: synthesizeWorkspaceFromCase,
    extractCandidateIssuesFromQa: extractCandidateIssuesFromQa,
    parseTranscriptFallback: parseTranscriptFallback,
    replaceTranscriptSpeakers: replaceTranscriptSpeakers,
    parseJsonTranscript: parseJsonTranscript,
    buildTranscriptAiPrompt: buildTranscriptAiPrompt,
    normalizeTranscriptAiResult: normalizeTranscriptAiResult
  };
});
