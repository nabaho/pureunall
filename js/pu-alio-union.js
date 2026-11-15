/* ══════════════════════════════════════════════════════════════════════════
   푸른통합시스템 — 공공임단협 (기관 중심 통합분류 · 내부 6대 영역 한눈에 보기 · 그래프/히트맵 비교분석 시스템)
   파일: js/pu-alio-union.js
   - 포털(enter.html) 자료함 줄의 「🤝 공공임단협」 타일 또는 오른쪽 앱바(pu-appbar.js)에서
     별개의 독립 프로그램 창(pu-alio-union.html, 창 이름 pureun-aliounion)으로 열린다.
   - 모든 데이터의 기본 기준을 「기관 단위(1,693개 기관 = 중앙 ALIO 355 + 행안부 산하 유관 6 + 지방 클린아이 1,332)」로
     통합 분류하며(전 기관 노조·타임오프 현황 포함), 기관 내부 6대 영역을 한눈에 조망한다:
     ① 노동조합·타임오프 구조  ② 임금·보수·퇴직금  ③ 단체협약 13대 핵심 근로조건
     ④ 별도합의·보충협약·노사협의  ⑤ 취업규칙·내부규정·복리후생  ⑥ 연혁 타임라인 & 과거↔현행 신·구 대비
   - 하나의 기관 클릭 시 별개의 독립 창(pu-alio-union.html?organ=<기관코드>)으로 열리며
     기관별 연혁·과거임단협·유사기관 비교, 13대 핵심 쟁점 기관간 비교·원문 대조,
     단체협약 조문 통합 검색, 기관별 공시·별도합의·내부규정 원문, 공공·법령 API 실시간 연동 센터와
     SVG 레이더·막대·산점도·분포 그래프 및 히트맵 비교표를 통합 제공한다.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var DATA_SCRIPT_URL = 'js/pu-alio-data.js?v=5';
  var STYLE_ID = 'pu-alio-union-css';
  var LS_KEY_PREFIX = 'pu_alio_datagokr_key_';

  var METRIC_DEFS = [
    { key: 'union_shop', shortLabel: '조합원자격·유니온숍', label: '조합원 자격 (유니온숍/가입범위)', lawKey: '노동조합및노동관계조정법', lawArt: '81', lawTitle: '노조법 제5조·제81조 제1항 제2호 단서(유니온숍)' },
    { key: 'timeoff_activity', shortLabel: '타임오프·조합활동', label: '근로시간면제(타임오프)·조합활동', lawKey: '노동조합및노동관계조정법', lawArt: '24', lawTitle: '노조법 제24조(노동조합의 전임자·근로시간면제 한도)' },
    { key: 'check_off', shortLabel: '조합비공제·사무실', label: '조합비 일괄공제·사무실 제공', lawKey: '노동조합및노동관계조정법', lawArt: '81', lawTitle: '노조법 제81조 제1항 제4호 단서(최소한의 규모의 노동조합 사무소 제공)' },
    { key: 'personnel_participation', shortLabel: '인사원칙 노조관여', label: '인사원칙 노조 관여 (합의/협의)', lawKey: '근로기준법', lawArt: '23', lawTitle: '근로기준법 제23조(정당한 이유 없는 전보·인사 제한) 및 제94조(취업규칙 변경)' },
    { key: 'discipline_committee', shortLabel: '징계위 구성·재심', label: '징계위원회 구성·소명·재심', lawKey: '근로기준법', lawArt: '23', lawTitle: '근로기준법 제23조·제27조(해고·징계의 정당한 이유 및 서면통지)' },
    { key: 'work_hours_overtime', shortLabel: '근로시간·유연근무', label: '근로시간·연장근로·유연근무', lawKey: '근로기준법', lawArt: '50', lawTitle: '근로기준법 제50조~제53조(법정근로시간 주 40시간·연장근로 한도)' },
    { key: 'paid_holidays_leave', shortLabel: '유급휴일·경조휴가', label: '유급휴일·특별휴가·경조휴가', lawKey: '근로기준법', lawArt: '55', lawTitle: '근로기준법 제55조(관공서 공휴일 유급휴일)·제60조(연차유급휴가)' },
    { key: 'sick_leave_accident', shortLabel: '유급병가·산재보상', label: '병가(유급병가)·산재보상', lawKey: '산업안전보건법', lawArt: '52', lawTitle: '근로기준법 제78조~제80조(업무상 재해보상) 및 산업안전보건법 제52조' },
    { key: 'maternity_childcare', shortLabel: '모성보호·육아휴직', label: '모성보호·육아휴직·가족돌봄', lawKey: '남녀고용평등과일ㆍ가정양립지원에관한법률', lawArt: '19', lawTitle: '근로기준법 제74조(출산전후휴가)·남녀고용평등법 제19조(육아휴직)' },
    { key: 'wage_bonus_allowance', shortLabel: '임금·수당·퇴직금', label: '임금·상여금·수당·퇴직금', lawKey: '근로기준법', lawArt: '43', lawTitle: '근로기준법 제43조(임금 지급원칙)·제56조(가산임금)·퇴직급여법 제8조' },
    { key: 'welfare_education_housing', shortLabel: '복리후생·건강검진', label: '복리후생·학자금·건강검진', lawKey: '근로자참여및협력증진에관한법률', lawArt: '20', lawTitle: '근로자참여법 제20조(복지증진 협의)·사내근로복지기금법 기준' },
    { key: 'retirement_age_peak', shortLabel: '정년·임금피크·고용', label: '정년·명예퇴직·고용안정', lawKey: '고용상연령차별금지및고령자고용촉진에관한법률', lawArt: '19', lawTitle: '고령자고용법 제19조(정년 60세 이상 의무화)' },
    { key: 'validity_auto_extension', shortLabel: '유효기간·자동연장', label: '유효기간·효력 자동연장', lawKey: '노동조합및노동관계조정법', lawArt: '32', lawTitle: '노조법 제32조(단체협약 유효기간 3년 상한·3개월 자동연장 특칙)' }
  ];

  var RADAR_AXES = [
    { idx: 0, label: '조직률·가입범위' },
    { idx: 1, label: '타임오프·조합활동' },
    { idx: 2, label: '인사·징계 관여도' },
    { idx: 3, label: '근로·휴일·병가' },
    { idx: 4, label: '모성·복리후생' },
    { idx: 5, label: '임금·협약안정성' }
  ];

  var COMPARE_PALETTE = [
    { stroke: '#2563eb', fill: 'rgba(37,99,235,0.18)', badgeBg: '#eff6ff', badgeTxt: '#1e40af', darkBg: '#1e3a8a', darkTxt: '#eff6ff' },
    { stroke: '#ea580c', fill: 'rgba(234,88,12,0.14)', badgeBg: '#fff7ed', badgeTxt: '#9a3412', darkBg: '#7c2d12', darkTxt: '#ffedd5' },
    { stroke: '#16a34a', fill: 'rgba(22,163,74,0.14)', badgeBg: '#f0fdf4', badgeTxt: '#166534', darkBg: '#14532d', darkTxt: '#dcfce7' },
    { stroke: '#9333ea', fill: 'rgba(147,51,234,0.14)', badgeBg: '#faf5ff', badgeTxt: '#6b21a8', darkBg: '#581c87', darkTxt: '#f3e8ff' },
    { stroke: '#0891b2', fill: 'rgba(8,145,178,0.14)', badgeBg: '#ecfeff', badgeTxt: '#155e75', darkBg: '#164e63', darkTxt: '#cffafe' },
    { stroke: '#e11d48', fill: 'rgba(225,29,72,0.14)', badgeBg: '#fff1f2', badgeTxt: '#9f1239', darkBg: '#881337', darkTxt: '#ffe4e6' }
  ];

  var TAXONOMY_LIST = [
    ['ALL', '전체 쟁점 분류'],
    ['UNION_SHOP', '총칙·조합원자격·유니온숍'],
    ['TIMEOFF', '노조전임·근로시간면제·홍보'],
    ['CHECKOFF', '조합비일괄공제·편의제공'],
    ['PERSONNEL', '인사원칙·승진·전보·채용'],
    ['DISCIPLINE', '징계·해고·신분보장'],
    ['WORK_HOURS', '근로시간·연장근로·유연근무'],
    ['LEAVE', '휴일·연차·특별휴가·경조휴가'],
    ['SICK_SAFETY', '병가·산업재해·안전보건'],
    ['MATERNITY', '모성보호·육아휴직·일가정양립'],
    ['WAGE', '임금·상여금·수당·퇴직금'],
    ['WELFARE', '복리후생·학자금·복지기금'],
    ['RETIREMENT', '정년·임금피크·고용안정'],
    ['BARGAINING', '단체교섭·노사협의·유효기간'],
    ['ETC', '기타/일반조항']
  ];

  var TAXONOMY_TO_METRIC = {
    UNION_SHOP: 'union_shop',
    TIMEOFF: 'timeoff_activity',
    CHECKOFF: 'check_off',
    PERSONNEL: 'personnel_participation',
    DISCIPLINE: 'discipline_committee',
    WORK_HOURS: 'work_hours_overtime',
    LEAVE: 'paid_holidays_leave',
    SICK_SAFETY: 'sick_leave_accident',
    MATERNITY: 'maternity_childcare',
    WAGE: 'wage_bonus_allowance',
    WELFARE: 'welfare_education_housing',
    RETIREMENT: 'retirement_age_peak',
    BARGAINING: 'validity_auto_extension'
  };

  var METRIC_TO_TAXONOMY = Object.create(null);
  Object.keys(TAXONOMY_TO_METRIC).forEach(function (tk) {
    METRIC_TO_TAXONOMY[TAXONOMY_TO_METRIC[tk]] = tk;
  });

  var TOPIC_CHIP_ORDER = [
    ['ALL', '전체 13대쟁점 한눈대조'],
    ['PERSONNEL', '인사·승진·전보'],
    ['DISCIPLINE', '징계·해고·재심'],
    ['WAGE', '임금·수당·퇴직금'],
    ['TIMEOFF', '타임오프·노조활동'],
    ['LEAVE', '휴일·연차·경조휴가'],
    ['WORK_HOURS', '근로시간·유연근무'],
    ['SICK_SAFETY', '병가·산재·안전'],
    ['MATERNITY', '모성보호·육아휴직'],
    ['RETIREMENT', '정년·임금피크·고용'],
    ['UNION_SHOP', '조합원자격·유니온숍'],
    ['CHECKOFF', '조합비공제·편의제공'],
    ['WELFARE', '복리후생·학자금'],
    ['BARGAINING', '단체교섭·유효기간'],
    ['ETC', '기타 조항']
  ];

  var LAW_API_SOURCES = [
    { key: '노동조합및노동관계조정법', name: '노동조합 및 노동관계조정법', file: '법률(법률).md', mainArts: ['5', '24', '29', '29의2', '31', '32', '33', '81'] },
    { key: '근로기준법', name: '근로기준법', file: '법률(법률).md', mainArts: ['23', '27', '43', '50', '53', '55', '56', '60', '74', '93', '94'] },
    { key: '근로자참여및협력증진에관한법률', name: '근로자참여 및 협력증진에 관한 법률', file: '법률(법률).md', mainArts: ['4', '20', '21', '22', '26'] },
    { key: '남녀고용평등과일ㆍ가정양립지원에관한법률', name: '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', file: '법률.md', mainArts: ['18의2', '19', '19의2', '22의2'] },
    { key: '고용상연령차별금지및고령자고용촉진에관한법률', name: '고용상 연령차별금지 및 고령자고용촉진에 관한 법률', file: '법률.md', mainArts: ['19', '19의2'] },
    { key: '근로자퇴직급여보장법', name: '근로자퇴직급여 보장법', file: '법률.md', mainArts: ['4', '8', '9'] },
    { key: '산업안전보건법', name: '산업안전보건법', file: '법률.md', mainArts: ['24', '36', '52', '129'] }
  ];

  var SECTOR_RULES = [
    { code: 'RAIL_TRANSIT', label: '철도·도시철도·교통', kws: ['교통공사', '철도', '도시철도', '코레일', '공항', '도로공사', '교통안전', '해운', '항만', '운송'] },
    { code: 'URBAN_DEV', label: '도시개발·주택·토지', kws: ['주택도시', '도시공사', '도시개발', '토지주택', '개발공사', '부동산', '주택금융', '주택관리'] },
    { code: 'FACILITY_MGT', label: '시설관리·환경·공단', kws: ['시설공단', '시설관리공단', '공공시설', '환경공단', '관리공단', '체육시설', '레포츠'] },
    { code: 'MEDICAL_HEALTH', label: '의료원·병원·보건의료', kws: ['의료원', '병원', '적십자', '건강보험', '보훈공단', '국립암센터', '의료', '보건'] },
    { code: 'RESEARCH_INST', label: '연구원·과학기술·진흥원', kws: ['연구원', '연구개발', '과학기술', '한국연구재단', '진흥원', '테크노파크', '정보화', '평가원', '개발원'] },
    { code: 'FINANCE_GUAR', label: '신용보증·금융·공제', kws: ['신용보증', '보증기금', '은행', '금융', '예금보험', '자산관리', '서민금융', '투자공사', '연금', '공제회'] },
    { code: 'CULTURE_TOUR', label: '문화·관광·예술·컨벤션', kws: ['문화재단', '관광공사', '관광재단', '문화회관', '예술', '벡스코', '엑스코', '컨벤션', '콘텐츠', '체육', '교향악단', '디자인'] },
    { code: 'ENERGY_WATER', label: '에너지·전력·상하수도', kws: ['전력', '발전', '수력원자력', '에너지공사', '가스', '석유', '지역난방', '수자원', '상수도', '하수도'] },
    { code: 'WELFARE_EDU', label: '복지·여성가족·교육·장학', kws: ['복지재단', '사회서비스', '여성가족', '평생교육', '장학', '인재', '청소년', '일자리', '고용', '어르신'] },
    { code: 'ECON_AGRI', label: '경제진흥·농수산·유통', kws: ['경제진흥', '경제과학', '농수산', '농어촌', '유통', '신용', '상공', '산업단지'] }
  ];

  var DISC_CCODE_LIST = [
    ['ALL', '전체 8대 공시·협약·내부규정 항목'],
    ['21026', '단체협약 (단협 본문·신구대비표·주요개정)'],
    ['21027', '임금협약 (임협 본문·임금인상 합의서)'],
    ['63795', '단체협약 외 별도합의사항 (보충·특별합의)'],
    ['63796', '임금협약 외 별도합의·사규 (수당·내부규정)'],
    ['21028', '노사협의회 의결사항 (분기별 노사협의)'],
    ['63787', '노동조합 운영현황 (타임오프·전임자·가입정보)'],
    ['21025', '교섭창구 단일화 정보 (교섭대표노조 공고)'],
    ['21110', '내부규정 (취업규칙·인사·보수·복리후생규정)']
  ];

  var SPECIAL_MOIS_URLS = {
    L_ERC: {
      union_info: 'https://www.erc.re.kr/usr/com/prm/ContentView.do?cId=PRGM_000000000000154&menuNo=1007024&upperMenuId=1007',
      union_status: 'https://www.erc.re.kr/usr/com/prm/ContentView.do?cId=PRGM_000000000000154&menuNo=1007024&upperMenuId=1007',
      rules: 'https://www.erc.re.kr/usr/com/prm/BBSList.do?bbsId=BBSMSTR_000000000181&menuNo=3004005&upperMenuId=3004',
      manual: 'https://www.erc.re.kr/usr/com/prm/BBSList.do?bbsId=BBSMSTR_000000000571&menuNo=20030010&upperMenuId=2003',
      welfare: 'https://www.erc.re.kr/usr/com/prm/ContentView.do?cId=PRGM_000000000000150&menuNo=1007015&upperMenuId=1007'
    },
    L_KLID: {
      union_info: 'https://www.klid.or.kr/open/bbsDisc.do?PID=workjoin_disc_s2',
      union_status: 'https://www.klid.or.kr/open/contentDisc.do?PID=workjoin_disc_s',
      rules: 'https://www.klid.or.kr/open/contentDisc.do?PID=workrule_disc',
      welfare: 'https://www.klid.or.kr/open/contentDisc.do?PID=vacat_disc'
    },
    L_KRILA: {
      union_info: 'https://www.krila.re.kr/disclosure/labor.php',
      union_status: 'https://www.krila.re.kr/disclosure/labor.php',
      rules: 'https://www.krila.re.kr/disclosure/rules.php',
      welfare: 'https://www.krila.re.kr/disclosure/parental.php'
    },
    L_KILF: {
      union_info: 'https://www.kilf.re.kr/frt/biz/news/N01/selectNewsList.do',
      union_status: 'https://www.kilf.re.kr/frt/biz/news/N01/selectNewsList.do',
      rules: 'https://www.kilf.re.kr/frt/biz/news/N02/selectNewsList.do',
      welfare: 'https://www.kilf.re.kr/frt/biz/news/N01/selectNewsList.do'
    },
    L_LOFA: {
      union_info: 'https://www.lofa.or.kr/subList/20000000223',
      union_status: 'https://www.lofa.or.kr/subList/20000000223',
      rules: 'https://www.lofa.or.kr/subList/20000000091',
      welfare: 'https://www.lofa.or.kr/subList/20000000227'
    },
    L_POBA: {
      union_info: 'https://www.poba.or.kr/mno/mno01/mno0102/mno010201#tab1-9',
      union_status: 'https://www.poba.or.kr/mno/mno01/mno0102/mno010201#tab1-9',
      rules: 'https://www.poba.or.kr/mno/mno01/mno0106/mno010601',
      welfare: 'https://www.poba.or.kr/mno/mno01/mno0102/mno010201#tab1-7'
    }
  };

  var lawCache = {};
  var latestAppHooks = null;
  var currentAuthUid = '';
  var authLookupGen = 0;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeHttpUrl(rawUrl) {
    var s = String(rawUrl == null ? '' : rawUrl).trim();
    if (!s) return '';
    try {
      var u = new URL(s, 'https://www.alio.go.kr');
      if (u.protocol !== 'https:') return '';
      var host = (u.hostname || '').toLowerCase();
      if (
        host === 'www.alio.go.kr' ||
        host === 'alio.go.kr' ||
        host === 'www.cleaneye.go.kr' ||
        host === 'cleaneye.go.kr' ||
        host === 'www.law.go.kr' ||
        host === 'law.go.kr' ||
        host === 'www.data.go.kr' ||
        host === 'data.go.kr' ||
        host === 'apis.data.go.kr' ||
        host === 'www.mois.go.kr' ||
        host === 'mois.go.kr' ||
        host === 'www.moel.go.kr' ||
        host === 'moel.go.kr' ||
        host === 'www.erc.re.kr' ||
        host === 'erc.re.kr' ||
        host === 'www.klid.or.kr' ||
        host === 'klid.or.kr' ||
        host === 'www.krila.re.kr' ||
        host === 'krila.re.kr' ||
        host === 'www.kilf.re.kr' ||
        host === 'kilf.re.kr' ||
        host === 'www.lofa.or.kr' ||
        host === 'lofa.or.kr' ||
        host === 'www.poba.or.kr' ||
        host === 'poba.or.kr' ||
        host.endsWith('.alio.go.kr') ||
        host.endsWith('.cleaneye.go.kr') ||
        host.endsWith('.law.go.kr') ||
        host.endsWith('.data.go.kr')
      ) {
        return u.href;
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function worth(v) {
    var t = String(v == null ? '' : v).trim();
    return !!t && t !== '-' && t !== '—' && t !== 'null' && t !== 'None' && t !== '해당없음' && t !== '없음';
  }

  function fmtNum(n) {
    var v = Number(n || 0);
    return isFinite(v) ? v.toLocaleString('ko-KR') : '0';
  }

  function fmtPct(n) {
    var v = Number(n || 0);
    if (!isFinite(v) || v <= 0) return '0%';
    return (Math.round(v * 10) / 10) + '%';
  }

  // 16개 광역 시·도 지자체 정의 및 약칭·검색 별칭 사전
  var PROVINCE_DEFS = [
    { key: '서울특별시', short: '서울', aliases: '서울 서울시 서울특별시' },
    { key: '부산광역시', short: '부산', aliases: '부산 부산시 부산광역시' },
    { key: '대구광역시', short: '대구', aliases: '대구 대구시 대구광역시' },
    { key: '인천광역시', short: '인천', aliases: '인천 인천시 인천광역시' },
    { key: '대전광역시', short: '대전', aliases: '대전 대전시 대전광역시' },
    { key: '울산광역시', short: '울산', aliases: '울산 울산시 울산광역시' },
    { key: '세종특별자치시', short: '세종', aliases: '세종 세종시 세종특별자치시' },
    { key: '경기도', short: '경기', aliases: '경기 경기도' },
    { key: '강원특별자치도', short: '강원', aliases: '강원 강원도 강원특별자치도' },
    { key: '충청북도', short: '충북', aliases: '충북 충청북도' },
    { key: '충청남도', short: '충남', aliases: '충남 충청남도' },
    { key: '전북특별자치도', short: '전북', aliases: '전북 전라북도 전북특별자치도' },
    { key: '전남광주통합특별시', short: '전남·광주', aliases: '전남 광주 전라남도 광주광역시 전남광주 전남광주통합특별시' },
    { key: '경상북도', short: '경북', aliases: '경북 경상북도' },
    { key: '경상남도', short: '경남', aliases: '경남 경상남도' },
    { key: '제주특별자치도', short: '제주', aliases: '제주 제주도 제주특별자치도' }
  ];

  var PROVINCE_BY_KEY = Object.create(null);
  PROVINCE_DEFS.forEach(function (p) { PROVINCE_BY_KEY[p.key] = p; });

  var MUNI_MAP = {
    '서울특별시': ['동대문구', '서대문구', '영등포구', '종로구', '용산구', '성동구', '광진구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '마포구', '양천구', '강서구', '구로구', '금천구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구', '중구'],
    '부산광역시': ['부산진구', '해운대구', '영도구', '동래구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군', '중구', '서구', '동구', '남구', '북구'],
    '대구광역시': ['수성구', '달서구', '달성군', '군위군', '중구', '동구', '서구', '남구', '북구'],
    '인천광역시': ['미추홀구', '제물포구', '연수구', '남동구', '부평구', '계양구', '강화군', '옹진군', '중구', '동구', '서구'],
    '대전광역시': ['유성구', '대덕구', '동구', '중구', '서구'],
    '울산광역시': ['울주군', '중구', '남구', '동구', '북구'],
    '세종특별자치시': [],
    '경기도': ['남양주시', '의정부시', '동두천시', '수원시', '성남시', '안양시', '부천시', '광명시', '평택시', '안산시', '고양시', '과천시', '구리시', '오산시', '시흥시', '군포시', '의왕시', '하남시', '용인시', '파주시', '이천시', '안성시', '김포시', '화성시', '광주시', '양주시', '포천시', '여주시', '연천군', '가평군', '양평군'],
    '강원특별자치도': ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군'],
    '충청북도': ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
    '충청남도': ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군'],
    '전북특별자치도': ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군'],
    '전남광주통합특별시': ['광산구', '목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군', '동구', '서구', '남구', '북구'],
    '경상북도': ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군'],
    '경상남도': ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군'],
    '제주특별자치도': ['서귀포시', '제주시']
  };

  function isLocalOrgan(aidOrInst) {
    if (!aidOrInst) return false;
    if (typeof aidOrInst === 'string') return aidOrInst.indexOf('L_') === 0;
    return String(aidOrInst.apba_id || '').indexOf('L_') === 0 || aidOrInst.portal_source === 'CLEANEYE' || aidOrInst.portal_source === 'ERC_MOIS';
  }

  function isErcMoisOrgan(aidOrInst) {
    if (!aidOrInst) return false;
    var aid = typeof aidOrInst === 'string' ? aidOrInst : String(aidOrInst.apba_id || '');
    if (/^L_(ERC|KLID|KRILA|KILF|LOFA|POBA)$/.test(aid)) return true;
    return typeof aidOrInst === 'object' && aidOrInst.portal_source === 'ERC_MOIS';
  }

  function resolveOrganProvince(inst) {
    if (!inst || !isLocalOrgan(inst) || isErcMoisOrgan(inst)) return '';
    var min = String(inst.ministry || '').trim();
    if (PROVINCE_BY_KEY[min]) return min;
    var nm = String(inst.name || '');
    for (var i = 0; i < PROVINCE_DEFS.length; i++) {
      var p = PROVINCE_DEFS[i];
      if (nm.indexOf(p.key) >= 0 || nm.indexOf(p.short.split('·')[0]) >= 0) return p.key;
    }
    return '';
  }

  function detectMunicipality(inst, provKey) {
    var pk = provKey || resolveOrganProvince(inst);
    if (!pk) return '';
    var pDef = PROVINCE_BY_KEY[pk];
    var hqLabel = (pDef ? pDef.short : pk) + ' 본청';
    var provShort = pDef ? pDef.short : '';
    var provPrefix = pk.slice(0, 2);
    var nm = String((inst && inst.name) || '');
    // 도립 의료원(천안의료원·공주의료원·수원의료원·서귀포의료원·전라남도순천의료원 등, 단 성남시의료원·목포시의료원·진안군의료원 등 시/군립 제외)은 광역 본청 산하
    var isProvMed = nm.slice(-3) === '의료원' && nm.indexOf('시의료원') === -1 && nm.indexOf('군의료원') === -1;
    if (isProvMed) {
      if (pk === '전남광주통합특별시') {
        return nm.indexOf('광주') >= 0 ? '광주 본청' : '전남 본청';
      }
      return hqLabel;
    }
    // 경기도 도립 공기업·출연기관 중 기초지자체 지명이 포함된 기관 예외 보정
    if (pk === '경기도' && (nm.indexOf('경기평택항만공사') >= 0 || nm.indexOf('경기도수원월드컵경기장') >= 0)) {
      return hqLabel;
    }

    var list = MUNI_MAP[pk] || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (nm.indexOf(m) >= 0) {
        if (pk === '전남광주통합특별시' && (m === '광산구' || m === '동구' || m === '서구' || m === '남구' || m === '북구')) {
          return '광주 ' + m;
        }
        return m;
      }
      if (m.length >= 3) {
        var stem = m.slice(0, -1); // 천안시 -> 천안, 부여군 -> 부여 (단 제주시 -> 제주 등 광역명과 동일한 어간은 제외)
        if (stem.length >= 2 && stem !== provShort && stem !== provPrefix && nm.indexOf(stem) >= 0) {
          if (pk === '전남광주통합특별시' && m === '광산구') return '광주 광산구';
          return m;
        }
      }
    }
    if (pk === '충청남도') {
      if (nm.indexOf('홍주') >= 0) return '홍성군';
      if (nm.indexOf('대산') >= 0) return '서산시';
      if (nm.indexOf('신창') >= 0 || nm.indexOf('선장') >= 0) return '아산시';
    }
    if (pk === '전남광주통합특별시') {
      if (nm.indexOf('1004섬') >= 0) return '신안군';
      if (nm.indexOf('장보고장학회') >= 0) return '완도군';
      if (nm.indexOf('백운장학회') >= 0) return '광양시';
      if (nm.indexOf('광주') >= 0) return '광주 본청';
      if (
        nm.indexOf('전남') >= 0 || nm.indexOf('전라남도') >= 0 ||
        nm.indexOf('명량대첩') >= 0 || nm.indexOf('녹색에너지연구원') >= 0 ||
        nm.indexOf('포뮬러원') >= 0 || nm.indexOf('김대중노벨') >= 0 ||
        nm.indexOf('남도음식') >= 0 || nm.indexOf('남도장터') >= 0
      ) {
        return '전남 본청';
      }
    }
    return hqLabel;
  }

  function getProvinceAliasesText(minOrProv) {
    var s = String(minOrProv || '').trim();
    if (!s) return '';
    var p = PROVINCE_BY_KEY[s];
    return p ? (p.key + ' ' + p.aliases) : s;
  }

  function inferProvinceFromQuery(rawQ) {
    var q = String(rawQ || '').trim();
    if (!q) return '';
    for (var i = 0; i < PROVINCE_DEFS.length; i++) {
      var p = PROVINCE_DEFS[i];
      var parts = p.aliases.split(/\s+/);
      for (var j = 0; j < parts.length; j++) {
        if (q === parts[j] || q.indexOf(parts[j]) === 0) return p.key;
      }
    }
    return '';
  }

  function matchSmartQuery(haystackLower, rawQuery) {
    var q = String(rawQuery || '').trim().toLowerCase();
    if (!q) return true;
    var hay = String(haystackLower || '');
    var tokens = q.split(/[\s,]+/).filter(Boolean);
    for (var i = 0; i < tokens.length; i++) {
      if (hay.indexOf(tokens[i]) === -1) return false;
    }
    return true;
  }

  function matchOrganScope(instOrUnion, scopeCode) {
    if (!scopeCode || scopeCode === 'ALL') return true;
    var isLoc = isLocalOrgan(instOrUnion);
    var it = String((instOrUnion && instOrUnion.inst_type) || '');
    if (scopeCode === 'CENTRAL') return !isLoc;
    if (scopeCode === 'LOCAL_ALL') return isLoc;
    if (scopeCode === 'LOCAL_ERC_MOIS') return isErcMoisOrgan(instOrUnion) || it.indexOf('지방공공행정') === 0;
    if (scopeCode === 'LOCAL_CORP') return isLoc && (it.indexOf('지방공사') === 0 || it.indexOf('지방공단') === 0);
    if (scopeCode === 'LOCAL_AFFIL') return isLoc && (it.indexOf('지방출자') === 0 || it.indexOf('지방출연') === 0);
    if (scopeCode === 'LOCAL_DIRECT') return isLoc && it.indexOf('지방직영') === 0;
    return true;
  }

  function detectSectorGroup(inst) {
    if (!inst) return { code: 'GENERAL', label: '일반공공서비스' };
    var hay = ((inst.name || '') + ' ' + (inst.inst_type || '') + ' ' + (inst.ministry || '')).toLowerCase();
    for (var i = 0; i < SECTOR_RULES.length; i++) {
      var r = SECTOR_RULES[i];
      for (var j = 0; j < r.kws.length; j++) {
        if (hay.indexOf(r.kws[j].toLowerCase()) >= 0) {
          return { code: r.code, label: r.label };
        }
      }
    }
    return { code: 'GENERAL', label: '일반공공서비스' };
  }

  // 노조법 제24조 고용노동부 근로시간면제 한도 고시 기준 상한 시간 계산
  function calcLegalTimeoffLimit(memberCount) {
    var m = Number(memberCount || 0);
    if (!isFinite(m) || m <= 0) return 0;
    if (m < 50) return 1000;
    if (m < 100) return 2000;
    if (m < 200) return 3000;
    if (m < 300) return 4000;
    if (m < 500) return 5000;
    if (m < 1000) return 6000;
    if (m < 3000) return 10000;
    if (m < 5000) return 14000;
    if (m < 10000) return 22000;
    if (m < 15000) return 28000;
    return 36000 + Math.floor((m - 15000) / 3000) * 2000;
  }

  function extractOrganMetrics(rawMetrics, aid) {
    var out = {};
    if (!rawMetrics || !aid) return out;
    var arr = Array.isArray(rawMetrics) ? rawMetrics : (Array.isArray(rawMetrics.metrics) ? rawMetrics.metrics : null);
    if (arr) {
      arr.forEach(function (m) {
        if (m && (m.apba_id === aid || m.aid === aid) && (m.metric_key || m.issue)) {
          out[m.metric_key || m.issue] = m;
        }
      });
    } else if (typeof rawMetrics === 'object' && rawMetrics[aid]) {
      out = rawMetrics[aid] || {};
    }
    return out;
  }

  function isValidYmd(y, m, d) {
    var yr = Number(y), mo = Number(m), da = Number(d);
    if (!isFinite(yr) || !isFinite(mo) || !isFinite(da)) return false;
    if (yr < 1900 || yr > 2100 || mo < 1 || mo > 12 || da < 1) return false;
    var days = [31, ((yr % 4 === 0 && yr % 100 !== 0) || (yr % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return da <= days[mo - 1];
  }

  function normalizeTimelineDate(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    var m1 = /(\d{4})\s*년도?\s*(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?/.exec(s);
    if (m1) {
      var d1 = m1[3] ? Number(m1[3]) : 1;
      if (!isValidYmd(m1[1], m1[2], d1)) return '';
      return m1[1] + '-' + ('0' + Number(m1[2])).slice(-2) + '-' + ('0' + d1).slice(-2);
    }
    var m2 = /(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})(?!\d)/.exec(s);
    if (m2) {
      if (!isValidYmd(m2[1], m2[2], m2[3])) return '';
      return m2[1] + '-' + ('0' + Number(m2[2])).slice(-2) + '-' + ('0' + Number(m2[3])).slice(-2);
    }
    var m2b = /^(\d{4})[-./]\s*(\d{1,2})$/.exec(s);
    if (m2b) {
      if (!isValidYmd(m2b[1], m2b[2], 1)) return '';
      return m2b[1] + '-' + ('0' + Number(m2b[2])).slice(-2) + '-01';
    }
    var m8 = /(?:^|\D)(20\d{2}|19\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:$|\D)/.exec(s);
    if (m8 && isValidYmd(m8[1], m8[2], m8[3])) {
      return m8[1] + '-' + m8[2] + '-' + m8[3];
    }
    var m3 = /(20\d{2}|19\d{2})\s*년도?(?!\s*\d+\s*월)/.exec(s);
    if (m3 && isValidYmd(m3[1], 1, 1)) return m3[1] + '-01-01';
    return '';
  }

  function resolveTargetTypeFromDisc(dOrTl) {
    if (!dOrTl) return 'union_info';
    var dno = String(dOrTl.dno || dOrTl.id || '');
    var cc = String(dOrTl.ccode || '');
    var cText = String((dOrTl.cname || '') + ' ' + (dOrTl.title || '') + ' ' + dno);
    if (dno === 'ERC_DISC_MANUAL_2026' || cText.indexOf('경영평가편람') >= 0 || /_MANUAL/.test(dno)) return 'manual';
    if (cc === '21110' || dOrTl.catGroup === 'RULE' || cText.indexOf('내부규정') >= 0 || cText.indexOf('인사조직지침') >= 0 || /_RULES|_GUIDELINE/.test(dno)) return 'rules';
    if (cText.indexOf('복리후생') >= 0 || cText.indexOf('일가정양립') >= 0 || /_WELFARE/.test(dno)) return 'welfare';
    if (cc === '21025') return 'multi_union';
    if (cc === '63787' || cc === '21021' || dOrTl.catGroup === 'STATUS') return 'union_status';
    return 'union_info';
  }

  function stripFileExt(name) {
    return String(name || '').replace(/\.(pdf|hwpx?|zip|xlsx?|docx?)$/i, '').replace(/\s+/g, ' ').trim();
  }

  function renderFilePills(files, defaultLabel) {
    if (!Array.isArray(files) || !files.length) return '';
    var seen = {};
    var pills = [];
    files.forEach(function (f, idx) {
      if (!f) return;
      var u = safeHttpUrl(f.url || f.download_url || '');
      if (!u || seen[u]) return;
      seen[u] = true;
      var rawLbl = f.name ? String(f.name).trim() : ((defaultLabel || '첨부원문') + (files.length > 1 ? ' ' + (idx + 1) : ''));
      var shortLbl = stripFileExt(rawLbl) || rawLbl;
      pills.push('<a class="pau-pill fktu" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" title="' + esc(rawLbl) + '" style="text-decoration:none;max-width:220px;overflow:hidden;text-overflow:ellipsis;">📎 ' + esc(shortLbl) + '</a>');
    });
    return pills.length ? (pills.join(' ') + ' ') : '';
  }

  function renderCompactFilePills(files, shortLabel) {
    if (!Array.isArray(files) || !files.length) return '';
    var valid = [];
    var seen = {};
    files.forEach(function (f) {
      if (!f) return;
      var u = safeHttpUrl(f.url || f.download_url || '');
      if (!u || seen[u]) return;
      seen[u] = true;
      valid.push({ url: u, name: String(f.name || shortLabel || '원문').trim() });
    });
    if (!valid.length) return '';
    var base = shortLabel || '원문';
    if (valid.length === 1) {
      return '<a class="pau-doc-dl" href="' + esc(valid[0].url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(valid[0].name) + '">📎 ' + esc(base) + '</a>';
    }
    return valid.slice(0, 2).map(function (vf, i) {
      var tag = i === 0 ? base : ('첨부' + (i + 1));
      return '<a class="pau-doc-dl" href="' + esc(vf.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(vf.name) + '">📎 ' + esc(tag) + '</a>';
    }).join('');
  }

  function getReadableDocTitle(d) {
    if (!d) return '';
    var rawTit = String(d.title || d.cname || '').replace(/\s+/g, ' ').trim();
    var isGeneric = /^(단체협약\s*정보|임금협약\s*정보|노사협의회\s*의결사항|단체협약상\s*별도\s*합의사항|단체협약\s*외의\s*별도\s*합의사항|제도운영\s*상황.*)$/.test(rawTit);
    if (isGeneric && Array.isArray(d.files) && d.files.length) {
      var f0 = d.files[0] && d.files[0].name ? stripFileExt(d.files[0].name) : '';
      if (f0 && f0.length >= 4) {
        return f0 + (d.files.length > 1 ? (' 외 ' + (d.files.length - 1) + '건') : '');
      }
    }
    return rawTit || '공시 문서';
  }

  var NOISY_KV_KEY_RE = /^(category_code|기준일|제출일|최종수정일|체결일|합의일|의결일|회의일자|제·개정일|개정일|최종협약|주요개정내용|신구대비표|회의록|첨부파일|규정파일|\d+\.\s*수정대상.*)$/i;
  var NOISY_KV_VAL_RE = /^(해당사항\s*없음|해당없음|없음|무|-|—|관련자료|규정내용|별첨|첨부\s*참조|첨부파일\s*참조)$/i;

  function formatCleanKvPairs(kv, maxItems) {
    if (!kv || typeof kv !== 'object') return [];
    var limit = maxItems > 0 ? maxItems : 5;
    var out = [];
    Object.keys(kv).forEach(function (k) {
      if (out.length >= limit) return;
      var key = String(k || '').trim();
      if (!key || NOISY_KV_KEY_RE.test(key)) return;
      var val = String(kv[k] == null ? '' : kv[k]).replace(/\s+/g, ' ').trim();
      if (!worth(val) || NOISY_KV_VAL_RE.test(val)) return;
      if (/\.(pdf|hwpx?|zip|xlsx?|docx?)$/i.test(val)) return;
      out.push({ key: key, val: val, text: key + ': ' + val });
    });
    return out;
  }

  function confedClass(c) {
    var s = String(c || '');
    if (s.indexOf('한국노총') >= 0) return 'fktu';
    if (s.indexOf('민주노총') >= 0) return 'kctu';
    if (s.indexOf('복수') >= 0) return 'multi';
    return '';
  }

  function inferEntKindFromInst(inst) {
    if (!inst) return '006003';
    if (inst.ent_kind && /^\d{6}$/.test(String(inst.ent_kind))) return String(inst.ent_kind);
    var aid = String(inst.apba_id || '');
    var it = String(inst.inst_type || '');
    if (it.indexOf('도시철도') >= 0) return '006001';
    if (it.indexOf('도시개발') >= 0) return '006002';
    if (it.indexOf('기타공사') >= 0) return '006003';
    if (it.indexOf('시설관리') >= 0) return '011001';
    if (it.indexOf('환경공단') >= 0) return '011002';
    if (it.indexOf('지방출자') >= 0) return '012001';
    if (it.indexOf('지방출연') >= 0 || aid.indexOf('L_B') === 0) return '012002';
    if (it.indexOf('상수도') >= 0) return '001001';
    if (it.indexOf('하수도') >= 0) return '002001';
    if (it.indexOf('공영개발') >= 0) return '003001';
    if (it.indexOf('지역개발기금') >= 0) return '004001';
    if (it.indexOf('통합건설') >= 0) return '005001';
    return aid.indexOf('L_B') === 0 ? '012002' : '006003';
  }

  function buildOrganUrl(instOrAid, dno, targetType) {
    var aid = typeof instOrAid === 'string' ? instOrAid : ((instOrAid && instOrAid.apba_id) || '');
    var dnoStr = String(dno || '');
    var tType = String(targetType || '');
    if (!tType && dnoStr) {
      if (dnoStr === 'ERC_DISC_MANUAL_2026' || /_MANUAL/.test(dnoStr)) tType = 'manual';
      else if (/_RULES|_GUIDELINE/.test(dnoStr)) tType = 'rules';
      else if (/_WELFARE/.test(dnoStr)) tType = 'welfare';
    }
    tType = tType || 'union_info';
    if (SPECIAL_MOIS_URLS[aid]) {
      return SPECIAL_MOIS_URLS[aid][tType] || SPECIAL_MOIS_URLS[aid].union_info;
    }
    if (isLocalOrgan(instOrAid)) {
      if (aid.indexOf('L_B') === 0) {
        if (tType === 'union_status') return 'https://www.cleaneye.go.kr/user/iptWorkUnionStatus.do';
        if (tType === 'rules') return 'https://www.cleaneye.go.kr/user/iptSuOrdinance.do';
        if (tType === 'welfare') return 'https://www.cleaneye.go.kr/user/iptSelWelfareSystem.do';
        return 'https://www.cleaneye.go.kr/user/iptUnionCnvt.do';
      }
      if (tType === 'union_status') return 'https://www.cleaneye.go.kr/user/empWorkUnionStatus.do';
      if (tType === 'multi_union') return 'https://www.cleaneye.go.kr/user/empMultiWorkUnionInfo.do';
      if (tType === 'rules') return 'https://www.cleaneye.go.kr/user/empConsInnerRule.do';
      if (tType === 'welfare') return 'https://www.cleaneye.go.kr/user/empBreaks.do';
      if (tType === 'eval') return 'https://www.cleaneye.go.kr/user/empMngEvaluGrade.do';
      return 'https://www.cleaneye.go.kr/user/empWorkUnionInfo.do';
    }
    if (dno && /^\d{10,}$/.test(dnoStr)) {
      return 'https://www.alio.go.kr/item/itemReportTerm.do?reportNo=' + encodeURIComponent(dnoStr);
    }
    if (tType === 'rules') {
      return 'https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(aid) + '&reportFormRootNo=21110';
    }
    return 'https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(aid) + '&reportFormRootNo=21020';
  }

  function openCleaneyeDirect(instOrAid, targetType) {
    var data = global.PU_ALIO_DATA || {};
    var inst = (typeof instOrAid === 'object' && instOrAid) ? instOrAid : null;
    var aid = inst ? String(inst.apba_id || '').trim() : String(instOrAid || '').trim();
    if (!inst && aid && Array.isArray(data.institutions)) {
      inst = data.institutions.find(function (x) { return x && x.apba_id === aid; }) || null;
    }
    var tType = String(targetType || 'union_info');
    var isValidAidPattern = !!(inst || SPECIAL_MOIS_URLS[aid] || /^(C\d{4}|L_\d{10}|L_B\d{6})$/.test(aid));
    if (!aid || !isValidAidPattern) {
      return {
        mode: 'ERROR',
        error: '유효하지 않은 기관코드입니다: ' + (aid || '(빈 값)'),
        aid: aid,
        targetType: tType
      };
    }
    if (SPECIAL_MOIS_URLS[aid]) {
      var mMap = SPECIAL_MOIS_URLS[aid];
      var mUrl = mMap[tType] || mMap.union_info;
      if (typeof global.open === 'function') {
        var w = global.open(mUrl, '_blank', 'noopener,noreferrer');
        if (w) { try { w.opener = null; } catch (e) {} }
      }
      return { mode: 'URL', url: mUrl, aid: aid, targetType: tType };
    }
    if (!isLocalOrgan(inst || aid)) {
      var cUrl = tType === 'rules'
        ? ('https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(aid) + '&reportFormRootNo=21110')
        : buildOrganUrl(inst || aid, '', tType);
      if (typeof global.open === 'function') {
        var cw = global.open(cUrl, '_blank', 'noopener,noreferrer');
        if (cw) { try { cw.opener = null; } catch (e) {} }
      }
      return { mode: 'URL', url: cUrl, aid: aid, targetType: tType };
    }
    var entId = aid.indexOf('L_') === 0 ? aid.slice(2) : aid;
    var entName = (inst && (inst.name || inst.inst_name)) || entId;
    var entKind = inferEntKindFromInst(inst || { apba_id: aid });
    var isIpt = entId.indexOf('B') === 0 || entKind === '012001' || entKind === '012002';

    var actionPath = '/user/empWorkUnionInfo.do';
    var itemId = 'workUnionInfo';
    var itemNo = '14_2';
    var openedDate = isIpt ? '2026.07.31' : '2026.05.29';

    if (isIpt) {
      if (tType === 'union_status') {
        actionPath = '/user/iptWorkUnionStatus.do';
        itemId = 'iptWorkUnionStatus';
        itemNo = '90_20';
      } else if (tType === 'rules') {
        actionPath = '/user/iptSuOrdinance.do';
        itemId = 'iptSuOrdinance';
        itemNo = '90_40';
      } else if (tType === 'welfare') {
        actionPath = '/user/iptSelWelfareSystem.do';
        itemId = 'iptSelWelfareSystem';
        itemNo = '90_10';
      } else {
        actionPath = '/user/iptUnionCnvt.do';
        itemId = 'iptUnionCnvt';
        itemNo = '90_25';
      }
    } else {
      if (tType === 'union_status') {
        actionPath = '/user/empWorkUnionStatus.do';
        itemId = 'workUnionStatus';
        itemNo = '14_1';
      } else if (tType === 'multi_union') {
        actionPath = '/user/empMultiWorkUnionInfo.do';
        itemId = 'multiWorkUnionInfo';
        itemNo = '14_3';
      } else if (tType === 'rules') {
        actionPath = '/user/empConsInnerRule.do';
        itemId = 'consInnerRule';
        itemNo = '11_1';
      } else if (tType === 'welfare') {
        actionPath = '/user/empBreaks.do';
        itemId = 'breaks';
        itemNo = '8_18';
      } else if (tType === 'eval') {
        actionPath = '/user/empMngEvaluGrade.do';
        itemId = 'mngEvaluGrade';
        itemNo = '10_1';
      } else {
        actionPath = '/user/empWorkUnionInfo.do';
        itemId = 'workUnionInfo';
        itemNo = '14_2';
      }
    }

    var actionUrl = 'https://www.cleaneye.go.kr' + actionPath;
    var fields = {
      entId: entId,
      entName: entName,
      entKind: entKind,
      itemId: itemId,
      itemNo: itemNo,
      fixedYear: '2025',
      pastYear: '2021',
      beyondYear: '2029',
      openedDate: openedDate
    };

    if (typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
      var form = null;
      try {
        form = document.createElement('form');
        form.method = 'POST';
        form.action = actionUrl;
        form.target = '_blank';
        form.rel = 'noopener noreferrer';
        if (typeof form.setAttribute === 'function') form.setAttribute('rel', 'noopener noreferrer');
        form.style.display = 'none';
        Object.keys(fields).forEach(function (k) {
          var inp = document.createElement('input');
          inp.type = 'hidden';
          inp.name = k;
          inp.value = fields[k];
          form.appendChild(inp);
        });
        document.body.appendChild(form);
        if (typeof form.submit === 'function') form.submit();
        if (form.parentNode) form.parentNode.removeChild(form);
      } catch (e) {
        if (form && form.parentNode) {
          try { form.parentNode.removeChild(form); } catch (ignoreErr) {}
        }
        return {
          mode: 'ERROR',
          error: String((e && e.message) || e || '클린아이 POST 전송 실패'),
          url: actionUrl,
          fields: fields,
          aid: aid,
          targetType: tType
        };
      }
    }
    return { mode: 'POST', url: actionUrl, fields: fields, aid: aid, targetType: tType };
  }

  function cleanRevisionClauseText(raw) {
    var s = String(raw == null ? '' : raw)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\\~/g, '~')
      .replace(/\r\n?/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    s = s.replace(/^[\s)]+/, '').replace(/\(\s*$/, '').trim();
    return s || '—';
  }

  function isMarkdownPipeSummary(raw) {
    var s = String(raw || '');
    return /\|\s*---\s*\|/.test(s) || /^\s*\|\s*구\s*분\s*\|/.test(s);
  }

  function parseRevisionSummaryBullets(rawLines) {
    var bullets = [];
    var seen = {};
    (rawLines || []).forEach(function (raw) {
      var s = String(raw || '').trim();
      if (!s || isMarkdownPipeSummary(s)) return;
      s = s.replace(/<br\s*\/?>/gi, '\n').replace(/\\~/g, '~');
      s = s.replace(/^[^\n]*단체협약\s*개정\s*주요내용\s*(?:\([^)]*\))?\s*/i, '');
      s = s.replace(/\s*\d+\.\s*기타\s*참고사항\s*:\s*(?:없음|해당없음|해당사항\s*없음)[\s\S]*$/i, '');
      var parts = s.split(/(?:\n+|(?=\s+[1-9]\.\s*(?:개정이유|주요내용|개정배경|주요골자|개정내용))|(?=\s+[가-하]\.\s+[가-힣]))/);
      parts.forEach(function (p) {
        var cl = p.replace(/\s+/g, ' ').replace(/^[-·•]\s*/, '').trim();
        if (!cl || cl.length < 3) return;
        if (/^\d+\.\s*(?:개정이유|주요내용|개정배경|주요골자|개정내용)\s*:?\s*$/.test(cl)) return;
        if (!seen[cl]) {
          seen[cl] = true;
          bullets.push(cl);
        }
      });
    });
    return bullets.slice(0, 8);
  }

  function normalizeRevisionsList(rawRev) {
    if (!rawRev) return [];
    var list = (Array.isArray(rawRev) ? rawRev : [rawRev]).filter(Boolean);
    var parsed = list.map(function (r) {
      var rawLines = [];
      if (Array.isArray(r.summary)) {
        rawLines = r.summary.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
      } else if (worth(r.summary)) {
        rawLines = [String(r.summary).trim()];
      }
      var summaryBullets = parseRevisionSummaryBullets(rawLines);
      var rawDiffs = (r.diffs || []).filter(Boolean);
      var hasRealBefore = rawDiffs.some(function (d) {
        var bf = String(d.before || '').trim();
        return bf && bf !== '기존 협약 조항' && bf !== '—' && bf !== '-';
      });
      var diffs = rawDiffs.map(function (d) {
        var rawBf = String(d.before || '').trim();
        var isPlaceholder = !rawBf || rawBf === '기존 협약 조항';
        return {
          art: cleanRevisionClauseText(d.art || d.article || '개정 조항'),
          before: isPlaceholder ? '종전 규정 (개정 요약 참조)' : cleanRevisionClauseText(rawBf),
          after: cleanRevisionClauseText(d.after || '—'),
          note: cleanRevisionClauseText(d.note || '단협·규정 개정'),
          isPlaceholder: isPlaceholder
        };
      });
      var normDate = normalizeTimelineDate(r.date) || r.date || '최근 개정';
      var files = [];
      if (worth(r.url) || worth(r.file)) {
        files.push({ name: r.file || r.title || '신·구 대비표 원문', url: r.url || '' });
      }
      return {
        dno: String(r.dno || '').trim(),
        date: normDate,
        rawDate: r.date || '최근 개정',
        title: String(r.title || '단체협약 신·구 조문 대비표 및 개정 주요내용').trim(),
        file: r.file || '',
        url: r.url || '',
        files: files,
        summaryBullets: summaryBullets,
        summaryLines: summaryBullets.length ? summaryBullets : rawLines.filter(function (x) { return !isMarkdownPipeSummary(x); }),
        hasRealBefore: hasRealBefore,
        diffs: diffs
      };
    });

    // 동일 공시번호(dno)에 '개정 주요내용(요약문)'과 '신구대비표(실제 조문 전·후)'가 분리 수록된 경우 하나로 병합
    var merged = [];
    var byGroupKey = Object.create(null);
    parsed.forEach(function (item) {
      var gk = item.dno ? ('DNO_' + item.dno) : '';
      if (gk && byGroupKey[gk]) {
        var target = byGroupKey[gk];
        item.files.forEach(function (f) {
          if (target.files.every(function (tf) { return (tf.url || tf.name) !== (f.url || f.name); })) {
            target.files.push(f);
          }
        });
        if (!target.url && item.url) target.url = item.url;
        if (!target.file && item.file) target.file = item.file;
        item.summaryBullets.forEach(function (b) {
          if (target.summaryBullets.indexOf(b) === -1 && target.summaryBullets.length < 8) {
            target.summaryBullets.push(b);
          }
        });
        target.summaryLines = target.summaryBullets.length ? target.summaryBullets : target.summaryLines;
        if (!target.hasRealBefore && item.hasRealBefore && item.diffs.length) {
          target.diffs = item.diffs;
          target.hasRealBefore = true;
        } else if (target.hasRealBefore === item.hasRealBefore && item.diffs.length > target.diffs.length) {
          target.diffs = item.diffs;
        }
        return;
      }
      if (gk) byGroupKey[gk] = item;
      merged.push(item);
    });
    return merged;
  }

  function normalizeArticlesList(rawArticles) {
    if (!Array.isArray(rawArticles)) return [];
    var byKey = Object.create(null);
    var orderKeys = [];
    rawArticles.forEach(function (a) {
      if (!a || !a.apba_id) return;
      var rawTxt = String(a.text || '').replace(/\r\n?/g, '\n');
      var hasDiffHeader = /구분\s*\n+\s*현\s*행\s*\n+\s*개\s*정\s*안/.test(rawTxt);
      var cleanedLines = [];
      rawTxt.split('\n').forEach(function (ln) {
        var t = ln.trim();
        if (!t) return;
        if (/^(구분|현\s*행|개\s*정\s*안|개\s*정|정)$/.test(t)) return;
        cleanedLines.push(t);
      });
      var joined = '';
      for (var i = 0; i < cleanedLines.length; i++) {
        var cur = cleanedLines[i];
        if (!joined) {
          joined = cur;
          continue;
        }
        var prevLast = joined.slice(-1);
        var curFirst = cur.charAt(0);
        var prevShortFragment = /[가-힣]$/.test(prevLast) && /^[가-힣]/.test(curFirst) && cleanedLines[i - 1].length <= 15 && !/^(?:\d+[.)]|[가-하]\.|[①-⑳])/.test(cur);
        joined += (prevShortFragment ? '' : ' ') + cur;
      }
      joined = joined.replace(/\s+/g, ' ').trim();
      var tit = String(a.article_title || '').trim();
      var mBr = /^(?:\d+\s*)?[【\[]([^】\]]+)[】\]]\s*:?\s*(.*)$/.exec(joined);
      if (mBr) {
        if (!tit) tit = mBr[1].trim();
        joined = mBr[2].trim();
      }
      joined = joined.replace(/^[:：\-·]\s*/, '').trim();
      var artNo = String(a.article_no || '').trim();
      if (artNo && artNo.indexOf('제') !== 0 && /^\d+$/.test(artNo)) artNo = '제' + artNo + '조';

      var normObj = {
        apba_id: a.apba_id,
        inst_name: a.inst_name || '',
        inst_type: a.inst_type || '',
        chapter: a.chapter || '',
        article_no: artNo,
        article_title: tit,
        taxonomy_code: a.taxonomy_code || '',
        taxonomy_name: a.taxonomy_name || '',
        text: joined,
        _hasDiffHeader: hasDiffHeader
      };
      var dedupKey = a.apba_id + '|' + artNo + '|' + tit + '|' + (a.taxonomy_code || '');
      var prev = byKey[dedupKey];
      if (!prev) {
        byKey[dedupKey] = normObj;
        orderKeys.push(dedupKey);
      } else if ((prev._hasDiffHeader && !normObj._hasDiffHeader) || (prev._hasDiffHeader === normObj._hasDiffHeader && normObj.text.length > prev.text.length)) {
        byKey[dedupKey] = normObj;
      }
    });
    return orderKeys.map(function (k) { return byKey[k]; });
  }

  // ── ① 기관 연혁에 따른 노조·임단협·별도합의·내부규정 종합 타임라인 생성 ──
  function buildOrganTimeline(data, aid) {
    if (!data || !aid) return [];
    var unions = (data.unions || []).filter(function (u) { return u && u.apba_id === aid && u.union_structure !== '노조없음'; });
    var discs = (data.disclosures || []).filter(function (d) { return d && d.aid === aid; });
    var items = [];

    unions.forEach(function (u, idx) {
      if (worth(u.established_date)) {
        var nd = normalizeTimelineDate(u.established_date);
        items.push({
          id: 'EST_' + aid + '_' + idx,
          date: nd || '미상',
          year: (nd || '').slice(0, 4) || '설립',
          catGroup: 'STATUS',
          ccode: 'EST',
          cname: '노동조합 설립 연혁',
          title: u.union_name + ' 설립 (' + u.established_date + ')',
          union: u.union_name,
          period: worth(u.chair_term) ? u.chair_term : '현재 운영 중',
          summary: [
            worth(u.confederation) ? ('상급단체: ' + u.confederation + (worth(u.federation) ? ' · ' + u.federation : '')) : '',
            worth(u.bargaining_right) ? ('교섭권: ' + u.bargaining_right) : '',
            '조합원 ' + fmtNum(u.member_total) + '명 / 가입대상 ' + fmtNum(u.eligible_count) + '명',
            worth(u.scope) ? ('가입범위: ' + u.scope) : ''
          ].filter(Boolean).join(' · '),
          files: [],
          dno: u.disclosure_no || ''
        });
      }
    });

    discs.forEach(function (d, idx) {
      var cc = String(d.ccode || '');
      var cText = String((d.cname || '') + ' ' + (d.title || '') + ' ' + (d.dno || ''));
      var catGroup = 'AGREEMENT';
      if (cc === '21110' || cText.indexOf('내부규정') >= 0 || cText.indexOf('경영평가편람') >= 0 || cText.indexOf('인사조직지침') >= 0 || /_RULES|_MANUAL|_GUIDELINE/.test(cText)) catGroup = 'RULE';
      else if (cc === '21021' || cc === '63787' || cc === '21025') catGroup = 'STATUS';
      else if (cc === '63795' || cc === '63796' || cc === '21028') catGroup = 'SEPARATE';
      else if (cc !== '21026' && cc !== '21027') {
        var tName = String((d.cname || '') + ' ' + (d.title || ''));
        if (tName.indexOf('단체협약') >= 0 || tName.indexOf('임금협약') >= 0) catGroup = 'AGREEMENT';
        else if (tName.indexOf('규정') >= 0 || tName.indexOf('규칙') >= 0) catGroup = 'RULE';
        else if (tName.indexOf('합의') >= 0 || tName.indexOf('협의') >= 0) catGroup = 'SEPARATE';
        else catGroup = 'STATUS';
      }

      var baseDiscDate = normalizeTimelineDate((d.kv && (d.kv['개정일'] || d.kv['기준일'] || d.kv['제출일'])) || d.edate || d.rdate || '');

      if (cc === '21110' && Array.isArray(d.files) && d.files.length > 1) {
        d.files.forEach(function (f, fIdx) {
          if (!f) return;
          var fDate = normalizeTimelineDate(f.name) || baseDiscDate || '미상';
          items.push({
            id: (d.dno || ('D_' + idx)) + '_F' + fIdx,
            date: fDate,
            year: /^\d{4}/.test(fDate) ? fDate.slice(0, 4) : '규정',
            catGroup: 'RULE',
            ccode: cc,
            cname: d.cname || '내부규정 연혁',
            title: d.title + ' — ' + (f.name || ''),
            union: (d.kv && (d.kv['노조명'] || d.kv['소관부서'])) || '사규·내부규정',
            period: fDate,
            summary: '내부규정 연혁 원문: ' + (f.name || d.title),
            files: [f],
            dno: d.dno || ''
          });
        });
        return;
      }

      var rawDate = (d.kv && (d.kv['체결일'] || d.kv['합의일'] || d.kv['의결일'] || d.kv['기준일'])) || d.edate || d.rdate || '';
      var normDate = normalizeTimelineDate(rawDate) || baseDiscDate || normalizeTimelineDate(d.title) || '미상';
      var cleanKvList = formatCleanKvPairs(d.kv, 5);
      var kvParts = cleanKvList.map(function (it) { return it.text; });
      if (Array.isArray(d.highlights) && d.highlights.length) {
        kvParts.push('주요내용: ' + d.highlights.slice(0, 3).join(' / '));
      }
      if (!kvParts.length && Array.isArray(d.files) && d.files.length && d.files[0] && d.files[0].name) {
        kvParts.push('첨부원문: ' + stripFileExt(d.files[0].name) + (d.files.length > 1 ? (' 외 ' + (d.files.length - 1) + '건') : ''));
      }
      var readTit = getReadableDocTitle(d);

      items.push({
        id: d.dno || ('DISC_' + aid + '_' + idx),
        date: normDate || rawDate || '—',
        year: /^\d{4}/.test(normDate) ? normDate.slice(0, 4) : '기타',
        catGroup: catGroup,
        ccode: cc,
        cname: d.cname || '공시',
        title: readTit || d.title || d.cname || '',
        rawTitle: d.title || d.cname || '',
        union: (d.kv && d.kv['노조명']) || '',
        period: (d.kv && (d.kv['유효기간'] || d.kv['기준연도'])) || normDate || '',
        kvItems: cleanKvList,
        summary: kvParts.join(' · ') || readTit || d.title || '—',
        files: d.files || [],
        dno: d.dno || ''
      });
    });

    items.sort(function (a, b) {
      var da = /^\d{4}-\d{2}-\d{2}$/.test(String(a.date || '')) ? String(a.date) : '';
      var db = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? String(b.date) : '';
      if (da && !db) return -1;
      if (!da && db) return 1;
      if (da !== db) return db.localeCompare(da);
      if (String(a.ccode || '') !== String(b.ccode || '')) {
        if (String(a.ccode) === '21026') return -1;
        if (String(b.ccode) === '21026') return 1;
      }
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    return items;
  }

  // ── ② 13대 핵심 쟁점 정성·정량 스코어링 & 기관별 마스터 인덱스 구축 ──
  function scoreIssueItem(issueKey, mObj, rec) {
    var val = mObj ? String(mObj.metric_value || '') : '';
    var snip = mObj ? String(mObj.snippet || '') : '';
    var art = mObj ? String(mObj.evidence_article || '') : '';
    var txt = (val + ' ' + snip).toLowerCase();

    if (!mObj && !rec.hasUnion) {
      return { level: 1, score: 35, tag: '사규기준', val: '노조 미설립 (취업규칙·사규 적용)', art: '취업규칙', snip: '' };
    }

    var level = 3;
    var score = 66;
    var tag = '보통·법정';

    if (issueKey === 'union_shop') {
      if (txt.indexOf('유니온') >= 0 || txt.indexOf('자동가입') >= 0 || txt.indexOf('강제가입') >= 0) {
        level = 5; score = 92; tag = '유니온숍';
      } else if (rec.orgRate >= 75) {
        level = 4; score = 82; tag = '고조직률(' + Math.round(rec.orgRate) + '%)';
      } else if (rec.orgRate >= 45 || mObj) {
        level = 3; score = 68; tag = '자유가입(오픈숍)';
      } else {
        level = 2; score = 52; tag = '제한가입';
      }
      if (!val && rec.hasUnion) val = rec.unionStructLabel + ' · 조직률 ' + fmtPct(rec.orgRate);
    } else if (issueKey === 'timeoff_activity') {
      if (rec.timeoffHours >= 6000 || rec.timeoffLimitPct >= 85) {
        level = 5; score = 90; tag = '상한충족(' + Math.round(rec.timeoffLimitPct) + '%)';
      } else if (rec.timeoffHours >= 2000 || rec.timeoffLimitPct >= 50) {
        level = 4; score = 78; tag = '전임운영(' + fmtNum(rec.timeoffHours) + 'h)';
      } else if (rec.timeoffHours > 0 || txt.indexOf('면제') >= 0 || txt.indexOf('타임오프') >= 0) {
        level = 3; score = 66; tag = '파트면제';
      } else {
        level = 2; score = 48; tag = '비전임·근무외';
      }
      if (!val && rec.timeoffHours > 0) val = fmtNum(rec.timeoffHours) + '시간 (한도대비 ' + fmtPct(rec.timeoffLimitPct) + ')';
    } else if (issueKey === 'check_off') {
      if (txt.indexOf('일괄공제') >= 0 && (txt.indexOf('사무실') >= 0 || txt.indexOf('집기') >= 0 || txt.indexOf('차량') >= 0)) {
        level = 4; score = 80; tag = '공제+사무실';
      } else if (mObj) {
        level = 3; score = 68; tag = '일괄공제';
      } else {
        level = 2; score = 52; tag = '공시확인';
      }
    } else if (issueKey === 'personnel_participation') {
      if (txt.indexOf('사전합의') >= 0 || (txt.indexOf('합의') >= 0 && txt.indexOf('협의') === -1)) {
        level = 5; score = 92; tag = '사전합의';
      } else if (txt.indexOf('동수') >= 0 || txt.indexOf('참여') >= 0 || txt.indexOf('위원 추천') >= 0) {
        level = 4; score = 82; tag = '위원참여·협의';
      } else if (txt.indexOf('협의') >= 0 || txt.indexOf('사전통보') >= 0) {
        level = 3; score = 70; tag = '사전협의';
      } else if (mObj) {
        level = 2; score = 58; tag = '의견청취·사규';
      } else {
        level = 2; score = 50; tag = '인사규정준용';
      }
    } else if (issueKey === 'discipline_committee') {
      if (txt.indexOf('동수') >= 0 || txt.indexOf('노조위원') >= 0 || txt.indexOf('합의') >= 0) {
        level = 5; score = 90; tag = '노사동수·참여';
      } else if (txt.indexOf('재심') >= 0 && txt.indexOf('소명') >= 0) {
        level = 4; score = 78; tag = '소명·재심보장';
      } else if (mObj) {
        level = 3; score = 68; tag = '소명절차명시';
      } else {
        level = 2; score = 52; tag = '징계규정준용';
      }
    } else if (issueKey === 'work_hours_overtime') {
      if (txt.indexOf('유연') >= 0 || txt.indexOf('시차') >= 0 || txt.indexOf('재택') >= 0 || txt.indexOf('교대') >= 0) {
        level = 4; score = 80; tag = '주40h+유연/교대';
      } else if (mObj) {
        level = 3; score = 68; tag = '주40h 기준';
      } else {
        level = 2; score = 54; tag = '복무규정준용';
      }
    } else if (issueKey === 'paid_holidays_leave') {
      var mDay = /(\d+)\s*일/.exec(txt);
      var dNum = mDay ? Number(mDay[1]) : 0;
      if (txt.indexOf('특별휴가') >= 0 || txt.indexOf('창립') >= 0 || dNum >= 7) {
        level = 4; score = 82; tag = '특별·경조확대';
      } else if (mObj) {
        level = 3; score = 70; tag = '유급·경조보장';
      } else {
        level = 2; score = 54; tag = '법정휴가기준';
      }
    } else if (issueKey === 'sick_leave_accident') {
      if (txt.indexOf('180일') >= 0 || txt.indexOf('1년') >= 0 || txt.indexOf('2년') >= 0 || txt.indexOf('추가보상') >= 0) {
        level = 5; score = 90; tag = '장기병가·추가보상';
      } else if (txt.indexOf('60일') >= 0 || txt.indexOf('90일') >= 0 || txt.indexOf('120일') >= 0 || txt.indexOf('공상') >= 0) {
        level = 4; score = 79; tag = '유급병가60일+';
      } else if (mObj) {
        level = 3; score = 68; tag = '병가·산재보장';
      } else {
        level = 2; score = 52; tag = '법정산재기준';
      }
    } else if (issueKey === 'maternity_childcare') {
      if (txt.indexOf('3년') >= 0 || txt.indexOf('난임') >= 0 || txt.indexOf('기숙') >= 0 || txt.indexOf('단축') >= 0) {
        level = 5; score = 88; tag = '육아3년·확대';
      } else if (txt.indexOf('육아휴직') >= 0 || txt.indexOf('가족돌봄') >= 0) {
        level = 4; score = 78; tag = '육아·돌봄보장';
      } else if (mObj) {
        level = 3; score = 68; tag = '법정모성보호';
      } else {
        level = 2; score = 54; tag = '법정기준';
      }
    } else if (issueKey === 'wage_bonus_allowance') {
      if (rec.domains.wageDiscs.length >= 2 || txt.indexOf('수당') >= 0 || txt.indexOf('성과') >= 0) {
        level = 4; score = 80; tag = '정기임협·수당명시';
      } else if (rec.domains.wageDiscs.length >= 1 || mObj) {
        level = 3; score = 69; tag = '임협·보수규정';
      } else {
        level = 2; score = 54; tag = '보수규정준용';
      }
    } else if (issueKey === 'welfare_education_housing') {
      if (txt.indexOf('복지기금') >= 0 || (txt.indexOf('복지') >= 0 && txt.indexOf('검진') >= 0)) {
        level = 4; score = 82; tag = '선택복지·검진';
      } else if (mObj || rec.domains.ruleDiscs.length) {
        level = 3; score = 70; tag = '복리후생운영';
      } else {
        level = 2; score = 54; tag = '기본복지';
      }
    } else if (issueKey === 'retirement_age_peak') {
      if (txt.indexOf('고용안정') >= 0 || txt.indexOf('명예퇴직') >= 0) {
        level = 4; score = 80; tag = '정년60+고용안정';
      } else if (mObj) {
        level = 3; score = 70; tag = '정년60세보장';
      } else {
        level = 2; score = 56; tag = '법정정년60세';
      }
    } else if (issueKey === 'validity_auto_extension') {
      if (txt.indexOf('체결 시까지') >= 0 || txt.indexOf('체결시까지') >= 0 || txt.indexOf('새로운 단체협약') >= 0 || txt.indexOf('자동연장') >= 0) {
        level = 5; score = 88; tag = '신협약까지효력';
      } else if (rec.domains.caDiscs.length >= 1 || mObj) {
        level = 3; score = 70; tag = '유효기간2년';
      } else {
        level = 2; score = 50; tag = '법정효력기준';
      }
    }

    return {
      level: level,
      score: score,
      tag: tag,
      val: val || tag,
      art: art || '',
      snip: snip || ''
    };
  }

  function buildOrganMasterIndex(data) {
    var safeInsts = ((data && data.institutions) || []).filter(Boolean);
    var safeUnions = ((data && data.unions) || []).filter(Boolean);
    var safeDiscs = ((data && data.disclosures) || []).filter(Boolean);
    var safeMetrics = ((data && data.metrics) || []).filter(Boolean);
    var safeArticles = normalizeArticlesList((data && data.articles) || []);
    var revsMap = (data && data.revisions) || {};

    var unionsByAid = {};
    safeUnions.forEach(function (u) {
      if (!u.apba_id) return;
      if (!unionsByAid[u.apba_id]) unionsByAid[u.apba_id] = [];
      unionsByAid[u.apba_id].push(u);
    });

    var discsByAid = {};
    safeDiscs.forEach(function (d) {
      if (!d.aid) return;
      if (!discsByAid[d.aid]) discsByAid[d.aid] = [];
      discsByAid[d.aid].push(d);
    });

    var metricsByAid = {};
    safeMetrics.forEach(function (m) {
      var k = m.apba_id || m.aid;
      var mk = m.metric_key || m.issue;
      if (!k || !mk) return;
      if (!metricsByAid[k]) metricsByAid[k] = {};
      metricsByAid[k][mk] = m;
    });

    var articlesByAid = {};
    safeArticles.forEach(function (a) {
      if (!a.apba_id) return;
      if (!articlesByAid[a.apba_id]) articlesByAid[a.apba_id] = [];
      articlesByAid[a.apba_id].push(a);
    });

    var records = [];
    var byId = Object.create(null);

    safeInsts.forEach(function (inst) {
      var aid = inst.apba_id;
      var isLoc = isLocalOrgan(inst);
      var isMois = isErcMoisOrgan(inst);
      var it = String(inst.inst_type || '');
      var scopeGroup = 'CENTRAL';
      var scopeLabel = '중앙 ALIO';
      if (isMois) {
        scopeGroup = 'LOCAL_ERC_MOIS';
        scopeLabel = '행안부·평가원';
      } else if (isLoc) {
        if (it.indexOf('지방공사') === 0 || it.indexOf('지방공단') === 0) {
          scopeGroup = 'LOCAL_CORP';
          scopeLabel = '지방공사·공단';
        } else if (it.indexOf('지방직영') === 0) {
          scopeGroup = 'LOCAL_DIRECT';
          scopeLabel = '지방직영기업';
        } else {
          scopeGroup = 'LOCAL_AFFIL';
          scopeLabel = '지방출자·출연';
        }
      }

      var sector = detectSectorGroup(inst);
      var activeU = (unionsByAid[aid] || []).filter(function (u) {
        return u && u.union_structure !== '노조없음';
      }).slice().sort(function (a, b) {
        var ar = String(a.bargaining_right || '').indexOf('대표') >= 0 ? 1 : 0;
        var br = String(b.bargaining_right || '').indexOf('대표') >= 0 ? 1 : 0;
        if (ar !== br) return br - ar;
        return Number(b.member_total || 0) - Number(a.member_total || 0);
      });

      var hasUnion = activeU.length > 0;
      var repUnion = activeU[0] || null;
      var memberTotal = 0;
      var maxElig = 0;
      var timeoffHours = 0;
      var timeoffFull = 0;
      var timeoffPart = 0;
      var confedSet = {};
      var confeds = [];

      activeU.forEach(function (u) {
        memberTotal += Number(u.member_total || 0);
        if (Number(u.eligible_count || 0) > maxElig) maxElig = Number(u.eligible_count || 0);
        timeoffHours += Number(u.timeoff_hours || 0);
        timeoffFull += Number(u.timeoff_fulltime || 0);
        timeoffPart += Number(u.timeoff_parttime || 0);
        var cf = worth(u.confederation) ? u.confederation : '미가입';
        if (!confedSet[cf]) {
          confedSet[cf] = true;
          confeds.push(cf);
        }
      });

      var eligibleCount = Math.max(maxElig, memberTotal);
      var orgRate = eligibleCount > 0 ? Math.min(100, Math.round((memberTotal / eligibleCount) * 1000) / 10) : 0;
      var legalLimit = calcLegalTimeoffLimit(memberTotal);
      var timeoffLimitPct = (legalLimit > 0 && timeoffHours > 0) ? Math.min(150, Math.round((timeoffHours / legalLimit) * 1000) / 10) : 0;
      var hoursPer100 = (memberTotal > 0 && timeoffHours > 0) ? Math.round((timeoffHours / memberTotal) * 100) : 0;

      var isMulti = activeU.length >= 2 || String(inst.union_structure || '').indexOf('복수') >= 0;
      var unionStructLabel = !hasUnion ? '노조미설립' : (isMulti ? ('복수노조(' + activeU.length + '개)') : '단일노조');

      var dAll = (discsByAid[aid] || []).slice().sort(function (a, b) {
        var da = normalizeTimelineDate(a.edate || a.rdate || '') || String(a.edate || a.rdate || '');
        var db = normalizeTimelineDate(b.edate || b.rdate || '') || String(b.edate || b.rdate || '');
        return db.localeCompare(da);
      });

      var caDiscs = [];
      var wageDiscs = [];
      var sepDiscs = [];
      var ruleDiscs = [];
      var statusDiscs = [];

      dAll.forEach(function (d) {
        var cc = String(d.ccode || '');
        var tType = resolveTargetTypeFromDisc(d);
        if (tType === 'rules' || tType === 'manual' || tType === 'welfare' || cc === '21110') {
          ruleDiscs.push(d);
        } else if (cc === '21026') {
          caDiscs.push(d);
        } else if (cc === '21027') {
          wageDiscs.push(d);
        } else if (cc === '63796') {
          var sepHay = (d.title || '') + ' ' + ((d.files || []).map(function (f) { return (f && f.name) || ''; }).join(' '));
          if (/임금|보수|연봉|수당|성과급|퇴직|급여/.test(sepHay)) {
            wageDiscs.push(d);
          } else {
            sepDiscs.push(d);
          }
        } else if (cc === '63795' || cc === '21028') {
          sepDiscs.push(d);
        } else {
          statusDiscs.push(d);
        }
      });

      var revs = normalizeRevisionsList(revsMap[aid]);
      var mMap = metricsByAid[aid] || {};
      var arts = articlesByAid[aid] || [];

      var provKey = resolveOrganProvince(inst);
      var provDef = provKey ? PROVINCE_BY_KEY[provKey] : null;
      var provShort = provDef ? provDef.short : '';
      var muniName = provKey ? detectMunicipality(inst, provKey) : '';
      var unionSearchTxt = activeU.map(function (u) {
        return (u.union_name || '') + ' ' + (u.confederation || '') + ' ' + (u.federation || '');
      }).join(' ');
      var searchHaystack = [
        inst.name || '',
        aid || '',
        inst.ministry || '',
        getProvinceAliasesText(provKey || inst.ministry),
        muniName,
        inst.inst_type || '',
        scopeLabel,
        sector.label,
        unionSearchTxt
      ].join(' ').toLowerCase();

      var rec = {
        aid: aid,
        apba_id: aid,
        inst: inst,
        name: inst.name || aid,
        ministry: inst.ministry || '미분류',
        provinceKey: provKey,
        provinceShort: provShort,
        muniName: muniName,
        searchHaystack: searchHaystack,
        inst_type: inst.inst_type || '기타',
        isLocal: isLoc,
        isMois: isMois,
        scopeGroup: scopeGroup,
        scopeLabel: scopeLabel,
        sectorCode: sector.code,
        sectorLabel: sector.label,
        unions: activeU,
        hasUnion: hasUnion,
        isMulti: isMulti,
        unionCount: activeU.length,
        unionStructLabel: unionStructLabel,
        repUnion: repUnion,
        repConfed: repUnion ? (worth(repUnion.confederation) ? repUnion.confederation : '미가입') : '노조없음',
        confeds: confeds,
        eligibleCount: eligibleCount,
        memberTotal: memberTotal,
        orgRate: orgRate,
        timeoffHours: timeoffHours,
        timeoffFull: timeoffFull,
        timeoffPart: timeoffPart,
        legalTimeoffLimit: legalLimit,
        timeoffLimitPct: timeoffLimitPct,
        hoursPer100: hoursPer100,
        discTotal: dAll.length,
        domains: {
          caDiscs: caDiscs,
          wageDiscs: wageDiscs,
          sepDiscs: sepDiscs,
          ruleDiscs: ruleDiscs,
          statusDiscs: statusDiscs,
          revisions: revs,
          articles: arts,
          metricsMap: mMap
        },
        domainCount: (hasUnion ? 1 : 0) +
          (wageDiscs.length || mMap.wage_bonus_allowance ? 1 : 0) +
          (caDiscs.length || Object.keys(mMap).length ? 1 : 0) +
          (sepDiscs.length ? 1 : 0) +
          (ruleDiscs.length ? 1 : 0) +
          (revs.length || dAll.length >= 2 ? 1 : 0),
        issueScores: {},
        radar: [40, 40, 40, 40, 40, 40],
        totalScore: 40
      };

      METRIC_DEFS.forEach(function (def) {
        rec.issueScores[def.key] = scoreIssueItem(def.key, mMap[def.key] || null, rec);
      });

      var isc = rec.issueScores;
      var ax0 = hasUnion ? Math.round(isc.union_shop.score * 0.55 + Math.min(100, Math.max(25, orgRate)) * 0.45) : 28;
      var ax1 = hasUnion ? Math.round(isc.timeoff_activity.score * 0.6 + isc.check_off.score * 0.4) : 25;
      var ax2 = Math.round((isc.personnel_participation.score + isc.discipline_committee.score) / 2);
      var ax3 = Math.round((isc.work_hours_overtime.score + isc.paid_holidays_leave.score + isc.sick_leave_accident.score) / 3);
      var ax4 = Math.round((isc.maternity_childcare.score + isc.welfare_education_housing.score) / 2);
      var docBonus = Math.min(12, dAll.length * 2 + (revs.length ? 6 : 0));
      var ax5 = Math.min(98, Math.round((isc.wage_bonus_allowance.score + isc.retirement_age_peak.score + isc.validity_auto_extension.score) / 3) + Math.round(docBonus / 2));

      rec.radar = [ax0, ax1, ax2, ax3, ax4, ax5];
      rec.totalScore = Math.round((ax0 + ax1 + ax2 + ax3 + ax4 + ax5) / 6);

      records.push(rec);
      byId[aid] = rec;
    });

    // 업종별 및 전체 평균 벤치마크 산출 (노조 보유 기관 기준)
    function computeBenchmark(label, pool) {
      var uPool = pool.filter(function (r) { return r.hasUnion; });
      var src = uPool.length ? uPool : pool;
      if (!src.length) {
        return { label: label, count: 0, totalOrgans: pool.length, orgRate: 55, memberAvg: 200, timeoffAvg: 2400, timeoffLimitPct: 60, discAvg: 4, radar: [62, 62, 65, 68, 68, 66], totalScore: 65 };
      }
      var sumOrg = 0, sumMem = 0, sumTo = 0, toCnt = 0, sumPct = 0, sumDisc = 0;
      var radSum = [0, 0, 0, 0, 0, 0];
      src.forEach(function (r) {
        sumOrg += r.orgRate;
        sumMem += r.memberTotal;
        if (r.timeoffHours > 0) {
          sumTo += r.timeoffHours;
          sumPct += r.timeoffLimitPct;
          toCnt += 1;
        }
        sumDisc += r.discTotal;
        for (var k = 0; k < 6; k++) radSum[k] += r.radar[k];
      });
      var n = src.length;
      var radAvg = radSum.map(function (v) { return Math.round(v / n); });
      return {
        label: label,
        count: n,
        totalOrgans: pool.length,
        orgRate: Math.round((sumOrg / n) * 10) / 10,
        memberAvg: Math.round(sumMem / n),
        timeoffAvg: toCnt ? Math.round(sumTo / toCnt) : 0,
        timeoffLimitPct: toCnt ? Math.round((sumPct / toCnt) * 10) / 10 : 0,
        discAvg: Math.round((sumDisc / n) * 10) / 10,
        radar: radAvg,
        totalScore: Math.round(radAvg.reduce(function (a, b) { return a + b; }, 0) / 6)
      };
    }

    var localAffilPool = records.filter(function (r) { return !!r.provinceKey; });
    var benchmarks = {
      ALL: computeBenchmark('전체 공공기관 노조 평균', records),
      LOCAL_ALL: computeBenchmark('전국 지자체 산하기관 평균', localAffilPool),
      bySector: {},
      byScope: {},
      byProvince: Object.create(null)
    };

    SECTOR_RULES.concat([{ code: 'GENERAL', label: '일반공공서비스' }]).forEach(function (sr) {
      var sub = records.filter(function (r) { return r.sectorCode === sr.code; });
      benchmarks.bySector[sr.code] = computeBenchmark(sr.label + ' 업종 평균', sub);
    });
    ['CENTRAL', 'LOCAL_ERC_MOIS', 'LOCAL_CORP', 'LOCAL_AFFIL', 'LOCAL_DIRECT'].forEach(function (sc) {
      var sub = records.filter(function (r) { return r.scopeGroup === sc; });
      benchmarks.byScope[sc] = computeBenchmark(sc + ' 평균', sub);
    });
    PROVINCE_DEFS.forEach(function (p) {
      var pSub = records.filter(function (r) { return r.provinceKey === p.key; });
      benchmarks.byProvince[p.key] = computeBenchmark(p.short + ' 산하기관 평균', pSub);
    });

    return {
      records: records,
      byId: byId,
      benchmarks: benchmarks
    };
  }

  // ── ③ 유사 공공기관·지방공공기관·산하단체 탐색 및 유사도 산정 ──
  function findSimilarOrgans(data, aid, mode) {
    if (!data || !aid) return [];
    mode = mode || 'ALL';
    var insts = data.institutions || [];
    var unions = (data.unions || []).filter(Boolean);
    var discs = (data.disclosures || []).filter(Boolean);
    var rawMetrics = data.metrics || [];

    var target = insts.find(function (x) { return x && x.apba_id === aid; });
    if (!target) return [];

    var targetSector = detectSectorGroup(target);
    var targetIsLocal = isLocalOrgan(target);

    var unionsByAid = {};
    unions.forEach(function (u) {
      if (!unionsByAid[u.apba_id]) unionsByAid[u.apba_id] = [];
      unionsByAid[u.apba_id].push(u);
    });

    var discsByAid = {};
    discs.forEach(function (d) {
      if (!discsByAid[d.aid]) discsByAid[d.aid] = [];
      discsByAid[d.aid].push(d);
    });

    var metricAids = {};
    if (Array.isArray(rawMetrics)) {
      rawMetrics.forEach(function (m) { if (m && m.apba_id) metricAids[m.apba_id] = true; });
    } else if (rawMetrics && typeof rawMetrics === 'object') {
      Object.keys(rawMetrics).forEach(function (k) { metricAids[k] = true; });
    }

    var targetUnions = (unionsByAid[aid] || []).filter(function (u) { return u.union_structure !== '노조없음'; });
    var targetMembers = targetUnions.reduce(function (s, u) { return s + Number(u.member_total || 0); }, 0);
    var targetConfed = targetUnions.length ? targetUnions[0].confederation : '';
    var targetFed = targetUnions.length ? targetUnions[0].federation : '';

    var results = [];
    insts.forEach(function (cand) {
      if (!cand || cand.apba_id === aid) return;
      var candUnions = (unionsByAid[cand.apba_id] || []).filter(function (u) { return u.union_structure !== '노조없음'; });
      var candDiscs = discsByAid[cand.apba_id] || [];
      if (!candUnions.length && !candDiscs.length) return;

      var candSector = detectSectorGroup(cand);
      var sameSector = targetSector.code !== 'GENERAL' && candSector.code === targetSector.code;
      var sameMinistry = worth(target.ministry) && cand.ministry === target.ministry;
      var sameType = worth(target.inst_type) && cand.inst_type === target.inst_type;
      var sameSubType = false;
      if (!sameType && worth(target.inst_type) && worth(cand.inst_type)) {
        var tBase = target.inst_type.split('(')[0];
        var cBase = cand.inst_type.split('(')[0];
        if (tBase && tBase === cBase) sameSubType = true;
      }

      if (mode === 'SECTOR' && !sameSector) return;
      if (mode === 'MINISTRY' && !sameMinistry) return;
      if (mode === 'TYPE' && !sameType && !sameSubType) return;

      var score = 0;
      var reasons = [];

      if (sameSector) {
        score += 55;
        reasons.push('동종업종(' + targetSector.label + ')');
      }
      if (sameMinistry) {
        score += 38;
        reasons.push('동일소관(' + target.ministry + ')');
      }
      if (sameType) {
        score += 32;
        reasons.push('동일유형(' + target.inst_type + ')');
      } else if (sameSubType) {
        score += 18;
        reasons.push('유사유형(' + cand.inst_type + ')');
      }
      if (isLocalOrgan(cand) === targetIsLocal) {
        score += 6;
      }

      var candConfed = candUnions.length ? candUnions[0].confederation : '';
      var candFed = candUnions.length ? candUnions[0].federation : '';
      if (worth(targetFed) && candFed === targetFed) {
        score += 18;
        reasons.push('동일연맹(' + targetFed + ')');
      } else if (worth(targetConfed) && targetConfed !== '미가입' && candConfed === targetConfed) {
        score += 10;
        reasons.push('동일상급(' + targetConfed + ')');
      }

      if (worth(target.union_structure) && cand.union_structure === target.union_structure) {
        score += 6;
      }

      var candMembers = candUnions.reduce(function (s, u) { return s + Number(u.member_total || 0); }, 0);
      if (targetMembers > 0 && candMembers > 0) {
        var ratio = Math.min(targetMembers, candMembers) / Math.max(targetMembers, candMembers);
        if (ratio >= 0.5) {
          score += Math.round(ratio * 12);
          reasons.push('유사규모(' + fmtNum(candMembers) + '명)');
        }
      }

      var hasMetrics = !!metricAids[cand.apba_id];
      if (hasMetrics) score += 16;

      var caList = candDiscs.filter(function (d) { return d.ccode === '21026'; });
      var wageList = candDiscs.filter(function (d) { return d.ccode === '21027'; });
      if (caList.length) score += 8;

      if (score < 20) return;

      var toHours = candUnions.reduce(function (s, u) { return s + Number(u.timeoff_hours || 0); }, 0);
      results.push({
        apba_id: cand.apba_id,
        name: cand.name,
        inst_type: cand.inst_type,
        ministry: cand.ministry,
        union_structure: cand.union_structure,
        portal_source: cand.portal_source || (isLocalOrgan(cand) ? 'CLEANEYE' : 'ALIO'),
        score: score,
        reasons: reasons.slice(0, 3),
        sectorLabel: candSector.label,
        unions: candUnions,
        memberTotal: candMembers,
        timeoffHours: toHours,
        latestCa: caList[0] || null,
        latestWage: wageList[0] || null,
        discCount: candDiscs.length,
        hasMetrics: hasMetrics
      });
    });

    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.memberTotal - a.memberTotal;
    });
    return results.slice(0, 24);
  }

  // ── ④ 순수 SVG 인터랙티브 시각화 차트 엔진 (레이더·막대·산점도·분포 차트) ──
  function renderRadarChartSvg(compareRecs, benchmarkRec) {
    var W = 380, H = 290, cx = 190, cy = 136, R = 92;
    var n = RADAR_AXES.length;
    function pt(axisIdx, val100) {
      var ang = (-Math.PI / 2) + (2 * Math.PI * axisIdx / n);
      var r = (Math.max(0, Math.min(100, Number(val100 || 0))) / 100) * R;
      return [Math.round((cx + Math.cos(ang) * r) * 10) / 10, Math.round((cy + Math.sin(ang) * r) * 10) / 10];
    }
    var rings = [25, 50, 75, 100].map(function (lv) {
      var pts = RADAR_AXES.map(function (_, idx) { return pt(idx, lv).join(','); }).join(' ');
      return '<polygon points="' + pts + '" fill="none" stroke="var(--pau-bd)" stroke-width="' + (lv === 100 ? '1.3' : '0.8') + '" stroke-dasharray="' + (lv === 50 ? '2,2' : 'none') + '"/>';
    }).join('');

    var spokes = RADAR_AXES.map(function (ax, idx) {
      var end = pt(idx, 100);
      var lblPt = pt(idx, 122);
      var anchor = Math.abs(lblPt[0] - cx) < 12 ? 'middle' : (lblPt[0] > cx ? 'start' : 'end');
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + end[0] + '" y2="' + end[1] + '" stroke="var(--pau-bd)" stroke-width="0.9"/>' +
        '<text x="' + lblPt[0] + '" y="' + (lblPt[1] + 4) + '" text-anchor="' + anchor + '" fill="var(--pau-txt)" font-size="11" font-weight="700">' + esc(ax.label) + '</text>';
    }).join('');

    var benchPoly = '';
    if (benchmarkRec && Array.isArray(benchmarkRec.radar)) {
      var bPts = benchmarkRec.radar.map(function (v, idx) { return pt(idx, v).join(','); }).join(' ');
      benchPoly = '<polygon points="' + bPts + '" fill="rgba(100,116,139,0.10)" stroke="#64748b" stroke-width="1.8" stroke-dasharray="5,3"/>';
    }

    var seriesPolys = (compareRecs || []).slice(0, 5).map(function (rec, sIdx) {
      var pal = COMPARE_PALETTE[sIdx % COMPARE_PALETTE.length];
      var pts = (rec.radar || [50, 50, 50, 50, 50, 50]).map(function (v, idx) { return pt(idx, v); });
      var polyStr = pts.map(function (p) { return p.join(','); }).join(' ');
      var dots = pts.map(function (p, idx) {
        return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (sIdx === 0 ? '3.8' : '2.8') + '" fill="' + pal.stroke + '"><title>' + esc(rec.name + ' · ' + RADAR_AXES[idx].label + ': ' + rec.radar[idx] + '점') + '</title></circle>';
      }).join('');
      return '<polygon points="' + polyStr + '" fill="' + (sIdx === 0 ? pal.fill : 'none') + '" stroke="' + pal.stroke + '" stroke-width="' + (sIdx === 0 ? '2.6' : '1.9') + '"/>' + dots;
    }).join('');

    var legendItems = [];
    (compareRecs || []).slice(0, 5).forEach(function (rec, sIdx) {
      var pal = COMPARE_PALETTE[sIdx % COMPARE_PALETTE.length];
      legendItems.push('<span class="pau-lgd-item"><i style="background:' + pal.stroke + ';"></i>' + esc(rec.name) + ' (' + rec.totalScore + '점)</span>');
    });
    if (benchmarkRec) {
      legendItems.push('<span class="pau-lgd-item"><i style="background:#64748b;border:1px dashed #334155;"></i>' + esc(benchmarkRec.label) + ' (' + benchmarkRec.totalScore + '점)</span>');
    }

    return [
      '<div class="pau-chart-box">',
      '  <svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="기관 6축 프로파일 레이더 비교 그래프" style="width:100%;max-width:390px;height:auto;display:block;margin:0 auto;">',
      rings,
      spokes,
      benchPoly,
      seriesPolys,
      '    <text x="' + (cx + 4) + '" y="' + (cy - R + 11) + '" fill="var(--pau-muted)" font-size="9.5">100</text>',
      '    <text x="' + (cx + 4) + '" y="' + (cy - R * 0.5 + 10) + '" fill="var(--pau-muted)" font-size="9.5">50</text>',
      '  </svg>',
      '  <div class="pau-lgd">' + legendItems.join('') + '</div>',
      '</div>'
    ].join('');
  }

  function renderGroupedKpiBarsHtml(compareRecs, benchmarkRec) {
    var list = (compareRecs || []).slice(0, 6);
    if (!list.length) return '';
    var maxMem = Math.max.apply(null, list.map(function (r) { return r.memberTotal || 0; }).concat([benchmarkRec ? benchmarkRec.memberAvg : 100, 100]));
    var maxTo = Math.max.apply(null, list.map(function (r) { return Math.max(r.timeoffHours || 0, r.legalTimeoffLimit || 0); }).concat([benchmarkRec ? benchmarkRec.timeoffAvg : 2000, 2000]));
    var maxDisc = Math.max.apply(null, list.map(function (r) { return r.discTotal || 0; }).concat([benchmarkRec ? benchmarkRec.discAvg : 5, 5]));

    function metricBlock(title, subHint, valFn, maxVal, fmtFn, benchVal) {
      var benchPct = (benchVal > 0 && maxVal > 0) ? Math.min(100, Math.round((benchVal / maxVal) * 100)) : 0;
      return [
        '<div class="pau-bar-grp">',
        '  <div class="pau-bar-hd"><b>' + esc(title) + '</b><span>' + esc(subHint) + (benchVal > 0 ? (' · 기준평균 ' + fmtFn(benchVal)) : '') + '</span></div>',
        list.map(function (r, idx) {
          var v = valFn(r);
          var pct = maxVal > 0 ? Math.min(100, Math.round((v / maxVal) * 1000) / 10) : 0;
          var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
          return [
            '  <div class="pau-bar-row">',
            '    <div class="pau-bar-lbl" title="' + esc(r.name) + '">' + esc(r.name) + '</div>',
            '    <div class="pau-bar-track">',
            '      <div class="pau-bar-fill" style="width:' + pct + '%;background:' + pal.stroke + ';"></div>',
            (benchPct > 0 ? '      <div class="pau-bar-bench" style="left:' + benchPct + '%;" title="업종 평균 기준선: ' + esc(fmtFn(benchVal)) + '"></div>' : ''),
            '    </div>',
            '    <div class="pau-bar-val">' + esc(fmtFn(v, r)) + '</div>',
            '  </div>'
          ].join('');
        }).join(''),
        '</div>'
      ].join('');
    }

    return [
      '<div class="pau-bars-wrap">',
      metricBlock('① 노조 조직률 (%)', '가입대상 대비 조합원 비율', function (r) { return r.orgRate; }, 100, function (v) { return fmtPct(v); }, benchmarkRec ? benchmarkRec.orgRate : 0),
      metricBlock('② 총 조합원 규모 (명)', '산하 전체 단위노조 합산', function (r) { return r.memberTotal; }, maxMem, function (v) { return fmtNum(v) + '명'; }, benchmarkRec ? benchmarkRec.memberAvg : 0),
      metricBlock('③ 연간 타임오프 (시간 · 법정한도 대비)', '노조법 제24조 면제한도 비교', function (r) { return r.timeoffHours; }, maxTo, function (v, r) {
        if (!r) return fmtNum(v) + 'h';
        return fmtNum(v) + 'h' + (r.legalTimeoffLimit ? ' (' + Math.round(r.timeoffLimitPct) + '%)' : '');
      }, benchmarkRec ? benchmarkRec.timeoffAvg : 0),
      metricBlock('④ 공시·협약·사규 보유량 (건)', '단협·임협·별도합의·내부규정 합계', function (r) { return r.discTotal; }, maxDisc, function (v) { return fmtNum(v) + '건'; }, benchmarkRec ? benchmarkRec.discAvg : 0),
      '</div>'
    ].join('');
  }

  function renderScatterTimeoffSvg(poolRecs, highlightRecs) {
    var W = 420, H = 265, padL = 50, padR = 20, padT = 20, padB = 38;
    var pw = W - padL - padR, ph = H - padT - padB;
    var unionPool = (poolRecs || []).filter(function (r) { return r.hasUnion && r.memberTotal > 0; });
    var hiIds = {};
    (highlightRecs || []).forEach(function (r, idx) { if (r) hiIds[r.aid] = idx + 1; });

    function xPos(mem) {
      var lm = Math.log10(Math.max(1, Number(mem || 1)));
      // log10 scale from 1 (10^0) to 40,000 (10^4.6)
      return Math.round((padL + Math.min(1, Math.max(0, lm / 4.6)) * pw) * 10) / 10;
    }
    var maxY = 24000;
    (highlightRecs || []).forEach(function (r) {
      if (r && r.timeoffHours > maxY * 0.85) maxY = Math.ceil(r.timeoffHours / 5000) * 5000;
    });
    function yPos(hrs) {
      var ratio = Math.min(1, Math.max(0, Number(hrs || 0) / maxY));
      return Math.round((padT + ph - ratio * ph) * 10) / 10;
    }

    // 노조법 법정 상한 계단 곡선 포인트
    var legalSteps = [
      [1, 1000], [49, 1000], [50, 2000], [99, 2000], [100, 3000], [199, 3000],
      [200, 4000], [299, 4000], [300, 5000], [499, 5000], [500, 6000], [999, 6000],
      [1000, 10000], [2999, 10000], [3000, 14000], [4999, 14000], [5000, 22000], [9999, 22000],
      [10000, 28000], [35000, 36000]
    ];
    var stepPath = legalSteps.map(function (st, idx) {
      return (idx === 0 ? 'M' : 'L') + xPos(st[0]) + ',' + yPos(Math.min(maxY, st[1]));
    }).join(' ');

    var bgDots = unionPool.slice(0, 260).map(function (r) {
      if (hiIds[r.aid]) return '';
      return '<circle cx="' + xPos(r.memberTotal) + '" cy="' + yPos(r.timeoffHours) + '" r="2.5" fill="rgba(100,116,139,0.35)"><title>' + esc(r.name + ': 조합원 ' + fmtNum(r.memberTotal) + '명 / 타임오프 ' + fmtNum(r.timeoffHours) + 'h') + '</title></circle>';
    }).join('');

    var hiDots = (highlightRecs || []).slice(0, 5).map(function (r, idx) {
      if (!r) return '';
      var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
      var cx = xPos(Math.max(1, r.memberTotal));
      var cy = yPos(r.timeoffHours);
      var lblX = cx > W - 115 ? cx - 6 : cx + 6;
      var anc = cx > W - 115 ? 'end' : 'start';
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (idx === 0 ? '5.5' : '4.5') + '" fill="' + pal.stroke + '" stroke="#ffffff" stroke-width="1.5"><title>' + esc(r.name + ': 조합원 ' + fmtNum(r.memberTotal) + '명 / 타임오프 ' + fmtNum(r.timeoffHours) + 'h (법정한도 ' + fmtNum(r.legalTimeoffLimit) + 'h)') + '</title></circle>' +
        '<text x="' + lblX + '" y="' + Math.max(padT + 10, cy - 4) + '" text-anchor="' + anc + '" fill="var(--pau-txt)" font-size="10.5" font-weight="800">' + esc(r.name.slice(0, 10)) + '</text>';
    }).join('');

    var xTicks = [10, 100, 500, 3000, 15000];
    var yTicks = [0, Math.round(maxY * 0.25), Math.round(maxY * 0.5), Math.round(maxY * 0.75), maxY];

    return [
      '<div class="pau-chart-box">',
      '  <svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="조합원 규모 대비 타임오프 산점도 및 법정한도선" style="width:100%;max-width:430px;height:auto;display:block;margin:0 auto;">',
      yTicks.map(function (yv) {
        var yy = yPos(yv);
        return '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="var(--pau-bd-lt)" stroke-width="0.8"/>' +
          '<text x="' + (padL - 5) + '" y="' + (yy + 3.5) + '" text-anchor="end" fill="var(--pau-muted)" font-size="9.5">' + (yv >= 1000 ? (yv / 1000) + 'k' : yv) + '</text>';
      }).join(''),
      xTicks.map(function (xv) {
        var xx = xPos(xv);
        return '<line x1="' + xx + '" y1="' + padT + '" x2="' + xx + '" y2="' + (padT + ph) + '" stroke="var(--pau-bd-lt)" stroke-width="0.8"/>' +
          '<text x="' + xx + '" y="' + (H - 18) + '" text-anchor="middle" fill="var(--pau-muted)" font-size="9.5">' + fmtNum(xv) + '명</text>';
      }).join(''),
      '    <path d="' + stepPath + '" fill="none" stroke="#dc2626" stroke-width="1.6" stroke-dasharray="4,3"/>',
      bgDots,
      hiDots,
      '    <text x="' + (padL + pw / 2) + '" y="' + (H - 3) + '" text-anchor="middle" fill="var(--pau-sub)" font-size="10.5" font-weight="700">조합원 수 (로그 스케일) ↔ 타임오프 시간 (빨간 점선: 노조법 법정상한)</text>',
      '  </svg>',
      '</div>'
    ].join('');
  }

  function renderMacroDistributionStrip(filteredOrgans) {
    var total = filteredOrgans.length || 1;
    var singleCnt = 0, multiCnt = 0, noneCnt = 0;
    var fktuMem = 0, kctuMem = 0, indMem = 0;
    var fktuOrg = 0, kctuOrg = 0, indOrg = 0;
    var bySec = {};

    filteredOrgans.forEach(function (r) {
      if (!r.hasUnion) noneCnt += 1;
      else if (r.isMulti) multiCnt += 1;
      else singleCnt += 1;

      if (r.hasUnion) {
        if (r.repConfed.indexOf('한국노총') >= 0) fktuOrg += 1;
        else if (r.repConfed.indexOf('민주노총') >= 0) kctuOrg += 1;
        else indOrg += 1;
      }
      r.unions.forEach(function (u) {
        var cf = String(u.confederation || '');
        var m = Number(u.member_total || 0);
        if (cf.indexOf('한국노총') >= 0) fktuMem += m;
        else if (cf.indexOf('민주노총') >= 0) kctuMem += m;
        else indMem += m;
      });

      if (!bySec[r.sectorCode]) {
        bySec[r.sectorCode] = { code: r.sectorCode, label: r.sectorLabel, cnt: 0, uCnt: 0, orgSum: 0, toSum: 0, toCnt: 0 };
      }
      var bs = bySec[r.sectorCode];
      bs.cnt += 1;
      if (r.hasUnion) {
        bs.uCnt += 1;
        bs.orgSum += r.orgRate;
        if (r.timeoffHours > 0) {
          bs.toSum += r.timeoffHours;
          bs.toCnt += 1;
        }
      }
    });

    var totMem = Math.max(1, fktuMem + kctuMem + indMem);
    var pSingle = Math.round((singleCnt / total) * 1000) / 10;
    var pMulti = Math.round((multiCnt / total) * 1000) / 10;
    var pNone = Math.max(0, Math.round((100 - pSingle - pMulti) * 10) / 10);

    var pfMem = Math.round((fktuMem / totMem) * 1000) / 10;
    var pkMem = Math.round((kctuMem / totMem) * 1000) / 10;
    var piMem = Math.max(0, Math.round((100 - pfMem - pkMem) * 10) / 10);

    var secArr = Object.keys(bySec).map(function (k) { return bySec[k]; }).filter(function (s) { return s.uCnt > 0; }).sort(function (a, b) {
      return b.uCnt - a.uCnt;
    }).slice(0, 5);

    return [
      '<div class="pau-macro-grid">',
      '  <div class="pau-card">',
      '    <div class="pau-card-hd"><span>📊 1. 조회 기관 노조체계 분포 (' + fmtNum(filteredOrgans.length) + '곳)</span><span class="pau-pill ok">노조보유 ' + fmtNum(singleCnt + multiCnt) + '곳</span></div>',
      '    <div class="pau-stack-bar" role="img" aria-label="노조 형태 비율 막대">',
      (pSingle > 0 ? '<div style="width:' + pSingle + '%;background:#2563eb;" title="단일노조 ' + fmtNum(singleCnt) + '곳 (' + pSingle + '%)"></div>' : ''),
      (pMulti > 0 ? '<div style="width:' + pMulti + '%;background:#f59e0b;" title="복수노조 ' + fmtNum(multiCnt) + '곳 (' + pMulti + '%)"></div>' : ''),
      (pNone > 0 ? '<div style="width:' + pNone + '%;background:#94a3b8;" title="노조미설립(사규운영) ' + fmtNum(noneCnt) + '곳 (' + pNone + '%)"></div>' : ''),
      '    </div>',
      '    <div class="pau-lgd" style="justify-content:flex-start;">',
      '      <span class="pau-lgd-item"><i style="background:#2563eb;"></i>단일노조 <b>' + fmtNum(singleCnt) + '곳</b>(' + pSingle + '%)</span>',
      '      <span class="pau-lgd-item"><i style="background:#f59e0b;"></i>복수노조 <b>' + fmtNum(multiCnt) + '곳</b>(' + pMulti + '%)</span>',
      '      <span class="pau-lgd-item"><i style="background:#94a3b8;"></i>사규·미설립 <b>' + fmtNum(noneCnt) + '곳</b>(' + pNone + '%)</span>',
      '    </div>',
      '  </div>',
      '  <div class="pau-card">',
      '    <div class="pau-card-hd"><span>🚩 2. 상급단체별 조합원·기관 점유율</span><span class="pau-pill fktu">총 ' + fmtNum(fktuMem + kctuMem + indMem) + '명</span></div>',
      '    <div class="pau-stack-bar" role="img" aria-label="상급단체 조합원 점유율 막대">',
      (pfMem > 0 ? '<div style="width:' + pfMem + '%;background:#1d4ed8;" title="한국노총 ' + fmtNum(fktuMem) + '명 (' + pfMem + '%)"></div>' : ''),
      (pkMem > 0 ? '<div style="width:' + pkMem + '%;background:#dc2626;" title="민주노총 ' + fmtNum(kctuMem) + '명 (' + pkMem + '%)"></div>' : ''),
      (piMem > 0 ? '<div style="width:' + piMem + '%;background:#16a34a;" title="미가입·독립 ' + fmtNum(indMem) + '명 (' + piMem + '%)"></div>' : ''),
      '    </div>',
      '    <div class="pau-lgd" style="justify-content:flex-start;">',
      '      <span class="pau-lgd-item"><i style="background:#1d4ed8;"></i>한국노총 <b>' + pfMem + '%</b>(' + fmtNum(fktuOrg) + '곳)</span>',
      '      <span class="pau-lgd-item"><i style="background:#dc2626;"></i>민주노총 <b>' + pkMem + '%</b>(' + fmtNum(kctuOrg) + '곳)</span>',
      '      <span class="pau-lgd-item"><i style="background:#16a34a;"></i>미가입·독립 <b>' + piMem + '%</b>(' + fmtNum(indOrg) + '곳)</span>',
      '    </div>',
      '  </div>',
      '  <div class="pau-card">',
      '    <div class="pau-card-hd"><span>🏢 3. 주요 업종별 평균 조직률 · 타임오프 (클릭→업종필터)</span></div>',
      '    <div style="display:flex;flex-direction:column;gap:4px;">',
      (secArr.length ? secArr.map(function (s) {
        var avgOrg = Math.round((s.orgSum / s.uCnt) * 10) / 10;
        var avgTo = s.toCnt ? Math.round(s.toSum / s.toCnt) : 0;
        return [
          '      <button type="button" class="pau-sec-bar-btn" data-quick-sector="' + esc(s.code) + '" title="' + esc(s.label + ' 업종 기관만 필터링') + '">',
          '        <span class="pau-sec-bar-nm">' + esc(s.label) + ' (' + s.uCnt + ')</span>',
          '        <span class="pau-bar-track" style="height:8px;flex:1;"><span class="pau-bar-fill" style="width:' + Math.min(100, avgOrg) + '%;background:#2563eb;"></span></span>',
          '        <span class="pau-sec-bar-num">조직률 ' + avgOrg + '% · ' + fmtNum(avgTo) + 'h</span>',
          '      </button>'
        ].join('');
      }).join('') : '<div style="font-size:12px;color:var(--pau-muted);">조건에 해당하는 노조 보유 업종이 없습니다.</div>'),
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  // ── ⑤ 기관 내부 6대 핵심 영역 한눈에 보기 보드 렌더러 (인라인 펼침 & 탭 2 공용) ──
  function renderOrganSixDomainsBoard(rec, isCompact, inCompareTray, sectorBench, boardOpts) {
    var dom = rec.domains;
    var aid = rec.aid;
    var isLoc = rec.isLocal;
    var isMois = rec.isMois;
    var hideHeader = !!(boardOpts && boardOpts.hideHeader);
    var postAttrBase = (isLoc && !isMois) ? (' data-cleaneye-post="' + esc(aid) + '"') : '';

    var latestCa = dom.caDiscs[0] || null;
    var latestRule = dom.ruleDiscs[0] || null;
    var latestRev = dom.revisions[0] || null;

    var keyIssuesToPreview = [
      'personnel_participation',
      'discipline_committee',
      'work_hours_overtime',
      'paid_holidays_leave',
      'sick_leave_accident',
      'maternity_childcare',
      'retirement_age_peak',
      'validity_auto_extension'
    ];

    var ruleOpenUrl = safeHttpUrl(buildOrganUrl(rec.inst, latestRule && latestRule.dno, 'rules'));
    var unionOpenUrl = safeHttpUrl(buildOrganUrl(rec.inst, latestCa && latestCa.dno, 'union_info'));
    var welfareOpenUrl = safeHttpUrl(buildOrganUrl(rec.inst, '', 'welfare'));
    var avgScoreTxt = sectorBench ? (' (업종평균 ' + sectorBench.totalScore + '점)') : '';

    function renderDocRow(d, badgeFallback, fileLabel) {
      var dt = normalizeTimelineDate(d.edate || d.rdate || '') || String(d.edate || d.rdate || badgeFallback || '공시').trim();
      var tit = getReadableDocTitle(d);
      var fBtn = renderCompactFilePills(d.files, fileLabel || '원문');
      return '<div class="pau-doc-row">' +
        '<span class="pau-doc-dt">' + esc(dt) + '</span>' +
        '<span class="pau-doc-tit" title="' + esc(tit) + '">' + esc(tit) + '</span>' +
        (fBtn ? ('<span class="pau-doc-acts">' + fBtn + '</span>') : '') +
        '</div>';
    }

    var revPreviewItems = [];
    if (latestRev) {
      if (latestRev.summaryBullets && latestRev.summaryBullets.length) {
        revPreviewItems = latestRev.summaryBullets.slice(0, 2).map(function (b) {
          return '<div class="pau-rev-mini-item" title="' + esc(b) + '">• ' + esc(b) + '</div>';
        });
      } else if (latestRev.diffs && latestRev.diffs.length) {
        revPreviewItems = latestRev.diffs.slice(0, 2).map(function (df) {
          var fullTxt = df.art + ': ' + df.after;
          return '<div class="pau-rev-mini-item" title="' + esc(fullTxt) + '"><b>' + esc(df.art) + '</b> → ' + esc(df.after) + '</div>';
        });
      }
    }

    return [
      '<div class="pau-dom-board' + (hideHeader ? ' plain' : '') + '">',
      (!hideHeader ? [
        '  <div class="pau-dom-top">',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      <span class="pau-pill ' + (isLoc ? 'loc' : 'fktu') + '">' + esc(rec.scopeLabel) + '</span>',
        '      <span class="pau-pill">' + esc(rec.sectorLabel) + '</span>',
        '      <b style="font-size:14px;">' + esc(rec.name) + '</b>',
        '      <span style="font-size:12px;color:var(--pau-muted);">(' + esc(rec.ministry + ' · ' + rec.inst_type) + ')</span>',
        '    </div>',
        (isCompact ? [
          '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
          '      <span class="pau-pill ok">종합 ' + rec.totalScore + '점</span>',
          '      <button type="button" class="pau-act-btn' + (inCompareTray ? ' pri' : '') + '" data-toggle-cmp="' + esc(aid) + '">' + (inCompareTray ? '✓ 비교담김' : '+ 비교담기') + '</button>',
          '      <button type="button" class="pau-act-btn pri" data-open-organ-here="' + esc(aid) + '">🔎 기관 상세</button>',
          '      <button type="button" class="pau-act-btn" data-jump-organ="' + esc(aid) + '">↗ 독립 창</button>',
          '    </div>'
        ].join('') : [
          '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;">',
          '      <span class="pau-pill">노조 ' + fmtNum(rec.unionCount) + '개 · 조합원 ' + fmtNum(rec.memberTotal) + '명</span>',
          '      <span class="pau-pill fktu">조직률 ' + fmtPct(rec.orgRate) + '</span>',
          '      <span class="pau-pill multi">타임오프 ' + fmtNum(rec.timeoffHours) + 'h (' + fmtPct(rec.timeoffLimitPct) + ')</span>',
          '      <span class="pau-pill ok">종합 ' + rec.totalScore + '점' + esc(avgScoreTxt) + '</span>',
          '    </div>'
        ].join('')),
        '  </div>'
      ].join('') : ''),

      '  <div class="pau-dom-grid">',
      // 영역 1: 노동조합 · 타임오프 구성
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>👥 ① 노동조합 · 타임오프</span><span class="pau-pill ' + (rec.hasUnion ? (rec.isMulti ? 'multi' : 'fktu') : '') + '">' + esc(rec.unionStructLabel) + '</span></div>',
      (rec.hasUnion ? [
        '      <div class="pau-kv-list">',
        '        <div class="pau-kv-row"><span>합산 조합원 · 조직률</span><b>' + fmtNum(rec.memberTotal) + ' / ' + fmtNum(rec.eligibleCount) + '명 (' + fmtPct(rec.orgRate) + ')</b></div>',
        '        <div class="pau-kv-row"><span>연간 타임오프 (법정한도)</span><b>' + fmtNum(rec.timeoffHours) + 'h / ' + fmtNum(rec.legalTimeoffLimit) + 'h (' + fmtPct(rec.timeoffLimitPct) + ')</b></div>',
        '      </div>',
        '      <div class="pau-doc-list">',
        rec.unions.slice(0, 3).map(function (u) {
          var isRep = String(u.bargaining_right || '').indexOf('대표') >= 0;
          var uMeta = fmtNum(u.member_total) + '명' + (Number(u.timeoff_hours || 0) ? (' · ' + fmtNum(u.timeoff_hours) + 'h') : '');
          var uTip = u.union_name + ' (' + (u.confederation || '미가입') + (worth(u.established_date) ? ', 설립 ' + u.established_date : '') + ')';
          return '<div class="pau-doc-row" title="' + esc(uTip) + '">' +
            '<span class="pau-pill ' + confedClass(u.confederation) + '">' + esc(u.confederation || '미가입') + '</span>' +
            (isRep ? '<span class="pau-pill ok">대표</span>' : '') +
            '<span class="pau-doc-tit" style="font-weight:700;">' + esc(u.union_name) + '</span>' +
            '<span class="pau-doc-meta">' + esc(uMeta) + '</span>' +
            '</div>';
        }).join(''),
        (rec.unions.length > 3 ? '<div style="font-size:11.5px;color:var(--pau-muted);padding-left:4px;">+ 외 ' + fmtNum(rec.unions.length - 3) + '개 산하 단위노조</div>' : ''),
        '      </div>'
      ].join('') : '<div class="pau-dom-empty">현재 설립·공시된 노동조합이 없으며 취업규칙·내부규정 및 노사협의회 기준으로 운영됩니다.</div>'),
      '      <div class="pau-dom-foot">',
      (unionOpenUrl ? '<a class="pau-pill ok" href="' + esc(unionOpenUrl) + '"' + (postAttrBase ? (postAttrBase + ' data-cleaneye-type="union_status"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 노조현황 공시원문</a>' : ''),
      '      </div>',
      '    </div>',

      // 영역 2: 임금 · 보수 · 퇴직금
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>💰 ② 임금 · 보수 · 퇴직금</span><span class="pau-pill">' + (dom.wageDiscs.length ? (fmtNum(dom.wageDiscs.length) + '건') : '사규적용') + '</span></div>',
      '      <div class="pau-kv-list">',
      '        <div class="pau-kv-row"><span>보수 · 수당 기준</span><b>' + esc(rec.issueScores.wage_bonus_allowance.val) + '</b></div>',
      '        <div class="pau-kv-row"><span>정년 · 임금피크제</span><b>' + esc(rec.issueScores.retirement_age_peak.tag) + '</b></div>',
      '      </div>',
      (dom.wageDiscs.length ? [
        '      <div class="pau-doc-list">',
        dom.wageDiscs.slice(0, 3).map(function (d) { return renderDocRow(d, '임협', '원문'); }).join(''),
        '      </div>'
      ].join('') : '<div class="pau-dom-empty">별도 임금협약 공시문서 없음 — 보수규정·연봉규칙 및 단체협약 보수 조항이 적용됩니다.</div>'),
      '      <div class="pau-dom-foot">',
      (!isCompact && dom.wageDiscs.length ? '<button type="button" class="pau-act-btn" data-h-sub="HISTORY" data-h-cat="AGREEMENT">📂 임단협 연혁 보기 →</button>' : ''),
      '      </div>',
      '    </div>',

      // 영역 3: 단체협약 13대 핵심 근로조건
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>⚖️ ③ 단체협약 핵심 근로조건</span><span class="pau-pill fktu">단협 ' + fmtNum(dom.caDiscs.length) + '건</span></div>',
      '      <div class="pau-issue-mini-grid">',
      keyIssuesToPreview.map(function (k) {
        var def = METRIC_DEFS.find(function (x) { return x.key === k; });
        var sc = rec.issueScores[k];
        return '<div class="pau-issue-mini lv' + sc.level + '" title="' + esc((def ? def.label : k) + ': ' + sc.val + (sc.snip ? ' — ' + sc.snip : '')) + '">' +
          '<span>' + esc(def ? def.shortLabel : k) + '</span>' +
          '<b>' + esc(sc.tag) + '</b>' +
          '</div>';
      }).join(''),
      '      </div>',
      '      <div class="pau-dom-foot">',
      (latestCa ? renderCompactFilePills((latestCa.files || []).slice(0, 1), '단협서') : ''),
      (unionOpenUrl ? '<a class="pau-pill ok" href="' + esc(unionOpenUrl) + '"' + (postAttrBase ? (postAttrBase + ' data-cleaneye-type="union_info"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 단협공시</a>' : ''),
      (!isCompact ? '<button type="button" class="pau-act-btn" data-h-sub="ISSUES" style="margin-left:auto;">⚖️ 13대 전 항목 →</button>' : ''),
      '      </div>',
      '    </div>',

      // 영역 4: 별도합의 · 보충협약 · 노사협의회
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>🤝 ④ 별도합의 · 노사협의회</span><span class="pau-pill multi">' + fmtNum(dom.sepDiscs.length) + '건</span></div>',
      (dom.sepDiscs.length ? [
        '      <div class="pau-doc-list">',
        dom.sepDiscs.slice(0, 3).map(function (d) { return renderDocRow(d, '합의', '원문'); }).join(''),
        (dom.sepDiscs.length > 3 ? '<div style="font-size:11.5px;color:var(--pau-muted);padding-left:4px;">+ 외 ' + fmtNum(dom.sepDiscs.length - 3) + '건 별도합의·회의록 수록</div>' : ''),
        '      </div>'
      ].join('') : '<div class="pau-dom-empty">공시된 단협 외 별도합의서가 없으며 본 단체협약 및 정기 노사협의회 의결사항으로 운영됩니다.</div>'),
      '      <div class="pau-dom-foot">',
      (!isCompact && dom.sepDiscs.length ? '<button type="button" class="pau-act-btn" data-h-sub="HISTORY" data-h-cat="SEPARATE">📂 합의·회의록 연혁 →</button>' : ''),
      '      </div>',
      '    </div>',

      // 영역 5: 취업규칙 · 내부규정 · 복리후생
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>📘 ⑤ 취업규칙 · 복리후생</span><span class="pau-pill ok">' + (dom.ruleDiscs.length ? fmtNum(dom.ruleDiscs.length) + '건 수록' : '포털 직결') + '</span></div>',
      '      <div class="pau-kv-list">',
      '        <div class="pau-kv-row"><span>복리후생 수준</span><b>' + esc(rec.issueScores.welfare_education_housing.tag) + '</b></div>',
      '        <div class="pau-kv-row"><span>모성보호 · 육아휴직</span><b>' + esc(rec.issueScores.maternity_childcare.tag) + '</b></div>',
      '      </div>',
      (dom.ruleDiscs.length ? [
        '      <div class="pau-doc-list">',
        dom.ruleDiscs.slice(0, 3).map(function (d) { return renderDocRow(d, '사규', '원문'); }).join(''),
        '      </div>'
      ].join('') : '<div class="pau-dom-empty">인사규정 · 보수규정 · 복무규정 · 징계규칙 · 선택적복지 공시 원문 바로가기 지원</div>'),
      '      <div class="pau-dom-foot">',
      (ruleOpenUrl ? '<a class="pau-pill ok" href="' + esc(ruleOpenUrl) + '"' + (postAttrBase ? (postAttrBase + ' data-cleaneye-type="rules"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📘 내부규정·정관 직결</a>' : ''),
      (isLoc && welfareOpenUrl ? '<a class="pau-pill fktu" href="' + esc(welfareOpenUrl) + '"' + (postAttrBase ? (postAttrBase + ' data-cleaneye-type="welfare"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🏖️ 복리후생 직결</a>' : ''),
      '      </div>',
      '    </div>',

      // 영역 6: 연혁 타임라인 & 과거↔현행 신·구 대비
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>🔄 ⑥ 신·구 조문 대비 · 연혁</span><span class="pau-pill ' + (latestRev ? 'fktu' : '') + '">' + (latestRev ? ('조문대비 ' + fmtNum(latestRev.diffs.length) + '건') : ('누적공시 ' + fmtNum(rec.discTotal) + '건')) + '</span></div>',
      (latestRev ? [
        '      <div class="pau-kv-list">',
        '        <div class="pau-kv-row"><span>최근 개정 기준일</span><b>' + esc(latestRev.date) + '</b></div>',
        '      </div>',
        '      <div class="pau-rev-mini-list">',
        revPreviewItems.join(''),
        '      </div>'
      ].join('') : '<div class="pau-dom-empty">연도별 공시 문서(' + fmtNum(rec.discTotal) + '건)를 기반으로 과거 시점(A)과 현행 시점(B)의 체결 내역을 직접 대조할 수 있습니다.</div>'),
      '      <div class="pau-dom-foot">',
      (latestRev ? renderCompactFilePills((latestRev.files || []).slice(0, 1), '신구대비') : ''),
      (isCompact
        ? '<button type="button" class="pau-act-btn pri" data-open-organ-here="' + esc(aid) + '" data-open-sub="HISTORY" style="margin-left:auto;">🔄 신·구 조문대비표 열기</button>'
        : '<button type="button" class="pau-act-btn pri" data-h-sub="HISTORY" style="margin-left:auto;">🔄 신·구 대비 · 연혁 →</button>'),
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  // ── 기타 공용 헬퍼 (법령 API, 스타일, 데이터 로더, CSV, 인증키 동기화, 별개 창 열기) ──
  function getActiveUid() {
    if (currentAuthUid) return currentAuthUid;
    try {
      var u = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
      if (u && u.uid) return String(u.uid);
    } catch (e) {}
    return '';
  }

  function userLsKey(uid) {
    return uid ? (LS_KEY_PREFIX + uid) : '';
  }

  function parseLawMarkdown(md) {
    var s = String(md || '').replace(/\r\n?/g, '\n');
    var front = {};
    var body = s;
    var fm = /^---\n([\s\S]*?)\n---\n?/.exec(s);
    if (fm) {
      fm[1].split('\n').forEach(function (l) {
        var k = /^([^\s:-][^:]*):\s*(.*)$/.exec(l);
        if (k) front[k[1].trim()] = k[2].trim().replace(/^'|'$/g, '');
      });
      body = s.slice(fm[0].length);
    }
    var cut = body.search(/\n## 부칙/);
    var main = cut < 0 ? body : body.slice(0, cut);
    var arts = {};
    var re = /^#{3,6}\s*제(\d+)조(?:의(\d+))?\s*(?:\(([^)\n]*)\))?[^\n]*$/gm;
    var heads = [];
    var m;
    while ((m = re.exec(main))) {
      heads.push({
        at: m.index,
        end: m.index + m[0].length,
        art: m[1] + (m[2] ? '의' + m[2] : ''),
        title: (m[3] || '').trim()
      });
    }
    heads.forEach(function (h, i) {
      var stop = i + 1 < heads.length ? heads[i + 1].at : main.length;
      var seg = main.slice(h.end, stop);
      var nextHead = seg.search(/^#{1,6}\s/m);
      if (nextHead >= 0) seg = seg.slice(0, nextHead);
      var text = seg.replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim();
      arts[h.art] = { no: '제' + h.art + '조', title: h.title, text: text };
    });
    return {
      title: front['제목'] || '',
      promulgated: front['공포일자'] || '',
      effective: front['시행일자'] || '',
      lawNo: front['공포번호'] || '',
      arts: arts
    };
  }

  function fetchLawLive(lawKey, cb) {
    if (lawCache[lawKey]) {
      cb(null, lawCache[lawKey]);
      return;
    }
    var meta = LAW_API_SOURCES.find(function (x) { return x.key === lawKey; }) || LAW_API_SOURCES[0];
    var url = 'https://raw.githubusercontent.com/legalize-kr/legalize-kr/main/kr/' +
      encodeURIComponent(meta.key) + '/' + encodeURIComponent(meta.file);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (md) {
        var parsed = parseLawMarkdown(md);
        parsed.url = url;
        lawCache[lawKey] = parsed;
        cb(null, parsed);
      })
      .catch(function (err) {
        cb(err || new Error('법령 API 호출 실패'), null);
      });
  }

  function injectStyles() {
    if (typeof document === 'undefined' || !document.head || document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '.pau-root{--pau-bg:#f8fafc;--pau-card:#ffffff;--pau-bd:#cbd5e1;--pau-bd-lt:#e2e8f0;--pau-txt:#0f172a;--pau-sub:#334155;--pau-muted:#475569;--pau-th:#f1f5f9;--pau-hov:#f8fafc;--pau-pri:#1d4ed8;--pau-pri-bg:#eff6ff;display:flex;flex-direction:column;height:100%;min-height:0;font-family:"Pretendard","Malgun Gothic",-apple-system,BlinkMacSystemFont,sans-serif;color:var(--pau-txt);background:var(--pau-bg);font-size:13px;word-break:keep-all;}',
      '.pau-root[data-theme="dark"],body.dark .pau-root{--pau-bg:#0f172a;--pau-card:#1e293b;--pau-bd:#475569;--pau-bd-lt:#334155;--pau-txt:#f8fafc;--pau-sub:#e2e8f0;--pau-muted:#cbd5e1;--pau-th:#0f172a;--pau-hov:#334155;--pau-pri:#93c5fd;--pau-pri-bg:#1e3a8a;}',
      '.pau-root *{box-sizing:border-box;}',
      '.pau-lnk{color:var(--pau-pri);font-weight:700;text-decoration:none;}',
      '.pau-lnk:hover,.pau-lnk:focus-visible{text-decoration:underline;outline:2px solid var(--pau-pri);outline-offset:1px;}',
      '.pau-sec-card{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:10px 12px;margin-bottom:10px;}',
      '.pau-sec-tit{font-size:13.5px;font-weight:800;color:var(--pau-txt);margin:0 0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}',
      '.pau-hdr{display:flex;align-items:center;gap:8px;padding:7px 14px;background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);color:#ffffff;flex-wrap:nowrap;flex-shrink:0;}',
      '.pau-hdr-ico{font-size:18px;line-height:1;flex-shrink:0;}',
      '.pau-hdr-tit{font-size:15px;font-weight:800;letter-spacing:-.3px;margin-right:2px;white-space:nowrap;flex-shrink:0;}',
      '.pau-hdr-badges{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;}',
      '.pau-badge{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);color:#f8fafc;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-badge.ok{background:rgba(22,163,74,.32);border-color:rgba(74,222,128,.5);color:#f0fdf4;}',
      '.pau-hdr-r{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:nowrap;flex-shrink:0;}',
      '.pau-who-slot{display:inline-flex;align-items:center;background:#f8fafc;color:#0f172a;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid #cbd5e1;min-height:26px;white-space:nowrap;}',
      '.pau-who-slot:empty{display:none;}',
      '.pau-btn{cursor:pointer;border:1px solid rgba(255,255,255,.32);background:rgba(255,255,255,.14);color:#ffffff;padding:4px 9px;min-height:28px;border-radius:7px;font-size:12px;font-weight:600;line-height:1.2;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:4px;}',
      '.pau-btn:hover,.pau-btn:focus-visible{background:rgba(255,255,255,.24);outline:2px solid #93c5fd;outline-offset:1px;}',
      '.pau-btn.pri{background:#2563eb;border-color:#60a5fa;color:#ffffff;}',
      '.pau-btn.pri:hover{background:#1d4ed8;}',
      '.pau-tabs{display:flex;align-items:center;gap:4px;padding:4px 10px 0;background:var(--pau-card);border-bottom:1px solid var(--pau-bd-lt);flex-shrink:0;overflow-x:auto;}',
      '.pau-tab{cursor:pointer;border:1px solid transparent;border-bottom:2px solid transparent;background:transparent;color:var(--pau-muted);padding:6px 12px;min-height:32px;font-size:13px;font-weight:700;border-radius:8px 8px 0 0;white-space:nowrap;}',
      '.pau-tab:hover,.pau-tab:focus-visible{color:var(--pau-txt);background:var(--pau-th);outline:2px solid #2563eb;outline-offset:-2px;}',
      '.pau-tab.on{color:var(--pau-pri);border-bottom-color:#2563eb;background:var(--pau-pri-bg);}',
      '.pau-tab.util{margin-left:auto;font-size:12px;}',
      '.pau-cmp-tray{display:none;align-items:center;justify-content:space-between;gap:8px;padding:5px 12px;background:#eff6ff;border-bottom:1px solid #93c5fd;flex-shrink:0;flex-wrap:wrap;}',
      '.pau-cmp-tray.on{display:flex;}',
      '.pau-root[data-theme="dark"] .pau-cmp-tray,body.dark .pau-root .pau-cmp-tray{background:#172554;border-bottom-color:#3b82f6;}',
      '.pau-body{flex:1;min-height:0;overflow-y:auto;padding:8px 10px 18px;}',
      '.pau-flt{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:9px;margin-bottom:6px;}',
      '.pau-flt select,.pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password],.pau-root select,.pau-root input[type=search],.pau-root input[type=text],.pau-root input[type=password]{height:33px;min-height:33px;max-width:100%;border:1px solid var(--pau-bd);border-radius:7px;padding:0 8px;background:var(--pau-card);color:var(--pau-txt);font-size:16px;}',
      '.pau-flt select:focus-visible,.pau-flt input:focus-visible,.pau-root select:focus-visible,.pau-root input:focus-visible,.pau-chip:focus-visible{outline:2px solid #2563eb;outline-offset:1px;border-color:#2563eb;}',
      '.pau-root input::placeholder{font-size:13px;color:var(--pau-muted);}',
      '.pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password]{min-width:180px;flex:1;max-width:340px;}',
      '.pau-subbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 4px 6px;font-size:12px;color:var(--pau-sub);flex-wrap:wrap;}',
      '.pau-seg{display:inline-flex;align-items:center;background:var(--pau-th);border:1px solid var(--pau-bd);border-radius:8px;padding:2px;gap:2px;flex-wrap:wrap;}',
      '.pau-seg-btn{cursor:pointer;border:none;background:transparent;color:var(--pau-muted);padding:4px 10px;min-height:26px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap;}',
      '.pau-seg-btn:hover,.pau-seg-btn:focus-visible{color:var(--pau-txt);outline:2px solid #2563eb;outline-offset:-1px;}',
      '.pau-seg-btn.on{background:#2563eb;color:#ffffff;}',
      '.pau-seg-btn.on:hover,.pau-seg-btn.on:focus-visible{color:#ffffff;outline:2px solid #93c5fd;outline-offset:-1px;}',
      '.pau-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:8px;}',
      '.pau-kpis-6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-bottom:8px;}',
      '.pau-kpi{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:8px;padding:6px 10px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;white-space:nowrap;overflow:hidden;}',
      '.pau-kpi span{font-size:11px;color:var(--pau-muted);max-width:100%;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-kpi b{font-size:14px;font-weight:800;color:var(--pau-txt);font-variant-numeric:tabular-nums;max-width:100%;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-bulk{display:none;align-items:center;gap:8px;padding:6px 10px;background:var(--pau-pri-bg);border:1px solid #93c5fd;border-radius:8px;margin-bottom:8px;color:var(--pau-pri);font-size:12px;font-weight:600;flex-wrap:wrap;}',
      '.pau-bulk.on{display:flex;}',
      '.pau-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;margin-bottom:6px;color:#78350f;font-size:12px;font-weight:600;flex-wrap:wrap;}',
      '.pau-tbl-wrap{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;overflow:auto;max-height:calc(100vh - 185px);}',
      '.pau-tbl{width:100%;min-width:1160px;border-collapse:collapse;table-layout:fixed;}',
      '.pau-tbl th,.pau-tbl td{padding:6px 8px;border-bottom:1px solid var(--pau-bd-lt);text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;font-size:12.5px;}',
      '.pau-tbl th{position:sticky;top:0;z-index:2;background:var(--pau-th);color:var(--pau-sub);font-weight:700;font-size:12px;}',
      '.pau-tbl th.c-sort{padding:0;}',
      '.pau-th-btn{cursor:pointer;width:100%;min-height:31px;padding:5px 8px;border:none;background:transparent;color:var(--pau-sub);font-family:inherit;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:4px;white-space:nowrap;overflow:hidden;text-align:left;}',
      '.pau-th-btn > span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
      '.pau-th-ico{flex-shrink:0;font-size:11px;color:var(--pau-muted);line-height:1;}',
      '.pau-th-btn:hover,.pau-th-btn:focus-visible{background:var(--pau-hov);color:var(--pau-pri);outline:2px solid #2563eb;outline-offset:-2px;}',
      '.pau-th-btn.on{background:var(--pau-pri-bg);color:var(--pau-pri);font-weight:800;}',
      '.pau-th-btn.on .pau-th-ico{color:var(--pau-pri);font-weight:900;}',
      '.pau-root[data-theme="dark"] .pau-th-btn.on,body.dark .pau-root .pau-th-btn.on{background:#1e3a8a;color:#eff6ff;}',
      '.pau-root[data-theme="dark"] .pau-th-btn.on .pau-th-ico,body.dark .pau-root .pau-th-btn.on .pau-th-ico{color:#93c5fd;}',
      '.pau-sub-sort{height:30px;min-height:30px;padding:0 7px;font-weight:700;}',
      '.pau-tbl tr:hover td{background:var(--pau-hov);}',
      '.pau-tbl tr.pau-exp-row td{white-space:normal;overflow:visible;background:var(--pau-bg);padding:10px 12px;}',
      '.pau-tbl th.c-ck,.pau-tbl td.c-ck{width:34px;text-align:center;padding:0 2px;text-overflow:clip;}',
      '.pau-tbl th.c-no,.pau-tbl td.c-no{width:42px;text-align:right;padding:0 6px;color:var(--pau-muted);font-variant-numeric:tabular-nums;text-overflow:clip;}',
      '.pau-tbl td.c-num{text-align:right;font-variant-numeric:tabular-nums;}',
      '.pau-ck-lbl{display:inline-flex;align-items:center;justify-content:center;min-width:26px;min-height:26px;cursor:pointer;margin:0;}',
      '.pau-ck-lbl input[type=checkbox]{width:15px;height:15px;margin:0;cursor:pointer;}',
      '.pau-line{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-pill{display:inline-flex;align-items:center;padding:2px 7px;min-height:24px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid var(--pau-bd);background:var(--pau-bg);color:var(--pau-sub);flex-shrink:0;white-space:nowrap;}',
      '.pau-pill.fktu{background:#eff6ff;border-color:#93c5fd;color:#1e40af;}',
      '.pau-pill.kctu{background:#fef2f2;border-color:#fca5a5;color:#991b1b;}',
      '.pau-pill.multi{background:#fffbeb;border-color:#fcd34d;color:#78350f;}',
      '.pau-pill.ok{background:#f0fdf4;border-color:#86efac;color:#14532d;}',
      '.pau-pill.loc{background:#f5f3ff;border-color:#c4b5fd;color:#4c1d95;}',
      '.pau-root[data-theme="dark"] .pau-pill.fktu,body.dark .pau-root .pau-pill.fktu{background:#1e3a8a;border-color:#60a5fa;color:#eff6ff;}',
      '.pau-root[data-theme="dark"] .pau-pill.kctu,body.dark .pau-root .pau-pill.kctu{background:#7f1d1d;border-color:#f87171;color:#fef2f2;}',
      '.pau-root[data-theme="dark"] .pau-pill.multi,body.dark .pau-root .pau-pill.multi{background:#78350f;border-color:#fbbf24;color:#fffbeb;}',
      '.pau-root[data-theme="dark"] .pau-pill.ok,body.dark .pau-root .pau-pill.ok{background:#14532d;border-color:#4ade80;color:#f0fdf4;}',
      '.pau-root[data-theme="dark"] .pau-pill.loc,body.dark .pau-root .pau-pill.loc{background:#4c1d95;border-color:#a78bfa;color:#f5f3ff;}',
      '.pau-root[data-theme="dark"] .pau-pager,body.dark .pau-root .pau-pager{background:#451a03;border-color:#f59e0b;color:#fef3c7;}',
      '.pau-chips{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:8px;}',
      '.pau-chip{padding:4px 10px;min-height:28px;border-radius:999px;border:1px solid var(--pau-bd);background:var(--pau-card);color:var(--pau-sub);font-size:12px;cursor:pointer;white-space:nowrap;}',
      '.pau-chip.on{background:#1e40af;border-color:var(--pau-pri);color:#ffffff;font-weight:700;}',
      '.pau-sbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:10px;margin-top:10px;}',
      '.pau-api-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:10px;}',
      '.pau-macro-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:8px;margin-bottom:8px;}',
      '.pau-vis-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:10px;margin-bottom:10px;}',
      '.pau-card{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;}',
      '.pau-card.law{background:#f0fdf4;border-color:#86efac;color:#0f172a;}',
      '.pau-root[data-theme="dark"] .pau-card.law,body.dark .pau-root .pau-card.law{background:#052e16;border-color:#4ade80;color:#f0fdf4;}',
      '.pau-card-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;color:var(--pau-txt);}',
      '.pau-card-pre{margin:0;padding:8px;background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:8px;font-size:12px;line-height:1.55;white-space:pre-wrap;max-height:220px;overflow:auto;color:var(--pau-sub);font-family:inherit;}',
      '.pau-act-btn{cursor:pointer;border:1px solid var(--pau-bd);background:var(--pau-card);color:var(--pau-txt);padding:4px 9px;min-height:28px;border-radius:7px;font-size:12px;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;}',
      '.pau-act-btn:hover,.pau-act-btn:focus-visible{background:var(--pau-th);border-color:#64748b;outline:2px solid #2563eb;outline-offset:1px;}',
      '.pau-act-btn.pri{background:#2563eb;border-color:#2563eb;color:#ffffff;}',
      '.pau-act-btn:disabled,.pau-btn:disabled{opacity:.45;cursor:not-allowed;pointer-events:none;}',
      /* 기관 내부 6대 영역 보드 · 통합 프로필 히어로 · 가독성 비교 카드 스타일 */
      '.pau-dom-board{background:var(--pau-card);border:1px solid var(--pau-bd);border-radius:11px;padding:12px 14px;}',
      '.pau-dom-board.plain{background:transparent;border:none;padding:0;}',
      '.pau-dom-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid var(--pau-bd-lt);}',
      '.pau-dom-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}',
      '@media (max-width:1100px){.pau-dom-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}',
      '.pau-dom-card{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:11px;padding:13px 15px;display:flex;flex-direction:column;gap:9px;box-shadow:0 1px 3px rgba(15,23,42,.04);min-width:0;}',
      '.pau-dom-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;font-weight:800;font-size:13px;color:var(--pau-txt);padding-bottom:8px;border-bottom:1px solid var(--pau-bd-lt);}',
      '.pau-dom-stat{font-size:12px;color:var(--pau-sub);line-height:1.45;}',
      '.pau-dom-list{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--pau-txt);line-height:1.45;}',
      '.pau-dom-item{padding:3px 0;border-top:1px dashed var(--pau-bd-lt);word-break:keep-all;}',
      '.pau-dom-empty{font-size:12px;color:var(--pau-muted);line-height:1.5;padding:6px 8px;border-radius:7px;background:var(--pau-bg);}',
      '.pau-dom-foot{margin-top:auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding-top:4px;}',
      '.pau-kv-list{display:flex;flex-direction:column;gap:5px;}',
      '.pau-kv-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;line-height:1.45;}',
      '.pau-kv-row > span{color:var(--pau-muted);white-space:nowrap;}',
      '.pau-kv-row > b{color:var(--pau-txt);font-weight:700;text-align:right;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.pau-doc-list{display:flex;flex-direction:column;gap:5px;}',
      '.pau-doc-row{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:7px;background:var(--pau-bg);border:1px solid var(--pau-bd-lt);font-size:12px;min-width:0;}',
      '.pau-doc-dt{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--pau-muted);background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:5px;padding:1px 6px;white-space:nowrap;flex-shrink:0;}',
      '.pau-doc-tit{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--pau-txt);font-weight:600;}',
      '.pau-doc-meta{font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--pau-sub);white-space:nowrap;flex-shrink:0;}',
      '.pau-doc-acts{display:inline-flex;align-items:center;gap:4px;flex-shrink:0;margin-left:auto;}',
      '.pau-doc-dl{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;background:#eff6ff;border:1px solid #93c5fd;color:#1e3a8a;text-decoration:none;white-space:nowrap;}',
      '.pau-doc-dl:hover,.pau-doc-dl:focus-visible{background:#dbeafe;outline:2px solid #2563eb;outline-offset:1px;}',
      '.pau-root[data-theme="dark"] .pau-doc-dl,body.dark .pau-root .pau-doc-dl{background:#1e3a8a;border-color:#60a5fa;color:#eff6ff;}',
      '.pau-rev-mini-list{display:flex;flex-direction:column;gap:5px;}',
      '.pau-rev-mini-item{font-size:12px;line-height:1.5;color:var(--pau-sub);padding:5px 8px;border-radius:7px;background:var(--pau-bg);border-left:3px solid #2563eb;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.pau-org-hero{background:var(--pau-card);border:1px solid var(--pau-bd);border-radius:12px;padding:14px 16px 0;margin-bottom:12px;box-shadow:0 1px 4px rgba(15,23,42,.04);}',
      '.pau-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;}',
      '.pau-hero-tit{margin:4px 0 2px;font-size:17.5px;font-weight:800;color:var(--pau-txt);line-height:1.3;}',
      '.pau-hero-sub{font-size:12.5px;color:var(--pau-muted);}',
      '.pau-hero-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px;}',
      '.pau-hero-kpi{background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:9px;padding:8px 11px;min-width:0;}',
      '.pau-hero-kpi-lbl{font-size:11px;font-weight:700;color:var(--pau-muted);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-hero-kpi-val{font-size:14.5px;font-weight:800;color:var(--pau-txt);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-hero-kpi-sub{font-size:11px;color:var(--pau-sub);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-hero-nav{display:flex;align-items:center;gap:4px;flex-wrap:wrap;border-top:1px solid var(--pau-bd-lt);padding:8px 0;}',
      '.pau-hero-tab{cursor:pointer;border:1px solid transparent;background:transparent;color:var(--pau-sub);padding:6px 12px;min-height:32px;border-radius:8px;font-size:12.5px;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;}',
      '.pau-hero-tab:hover,.pau-hero-tab:focus-visible{background:var(--pau-th);color:var(--pau-txt);outline:2px solid #2563eb;outline-offset:-1px;}',
      '.pau-hero-tab.on{background:#1d4ed8;border-color:#1d4ed8;color:#ffffff;}',
      '.pau-root[data-theme="dark"] .pau-hero-tab.on,body.dark .pau-root .pau-hero-tab.on{background:#2563eb;border-color:#3b82f6;color:#ffffff;}',
      '.pau-bullet-box{background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-left:3px solid #2563eb;border-radius:8px;padding:10px 14px;margin-bottom:12px;}',
      '.pau-bullet-list{margin:4px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px;font-size:12.5px;line-height:1.55;color:var(--pau-txt);}',
      '.pau-diff-list{border:1px solid var(--pau-bd-lt);border-radius:10px;overflow:hidden;}',
      '.pau-diff-hd{display:grid;grid-template-columns:185px minmax(0,1fr) minmax(0,1fr);gap:12px;padding:8px 12px;background:var(--pau-th);border-bottom:1px solid var(--pau-bd-lt);font-size:12px;font-weight:800;color:var(--pau-sub);}',
      '.pau-diff-row{display:grid;grid-template-columns:185px minmax(0,1fr) minmax(0,1fr);gap:12px;padding:11px 12px;border-bottom:1px solid var(--pau-bd-lt);background:var(--pau-card);align-items:start;}',
      '.pau-diff-row:last-child{border-bottom:none;}',
      '.pau-diff-art{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:800;color:var(--pau-txt);line-height:1.45;}',
      '.pau-diff-old{background:var(--pau-bg);border-left:3px solid #94a3b8;border-radius:6px;padding:8px 10px;font-size:12.5px;line-height:1.6;color:var(--pau-sub);}',
      '.pau-diff-new{background:#eff6ff;border-left:3px solid #2563eb;border-radius:6px;padding:8px 10px;font-size:12.5px;line-height:1.6;color:#0f172a;font-weight:600;}',
      '.pau-root[data-theme="dark"] .pau-diff-new,body.dark .pau-root .pau-diff-new{background:#172554;border-left-color:#60a5fa;color:#f8fafc;}',
      '.pau-diff-mbl{display:none;font-size:11px;font-weight:800;margin-bottom:3px;color:var(--pau-muted);}',
      '.pau-ab-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}',
      '.pau-ab-card{background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;min-width:0;}',
      '.pau-ab-card.cur{background:var(--pau-card);border-color:#93c5fd;box-shadow:0 1px 3px rgba(37,99,235,.08);}',
      '.pau-root[data-theme="dark"] .pau-ab-card.cur,body.dark .pau-root .pau-ab-card.cur{border-color:#3b82f6;}',
      '.pau-ab-row{display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;font-size:12.5px;line-height:1.5;padding-top:6px;border-top:1px dashed var(--pau-bd-lt);}',
      '.pau-ab-lbl{font-weight:700;color:var(--pau-muted);font-size:12px;}',
      '.pau-ab-sel{width:100%;max-width:100%;height:32px;min-height:32px;padding:0 8px;border:1px solid var(--pau-bd);border-radius:7px;background:var(--pau-card);color:var(--pau-txt);font-size:12.5px;font-weight:700;}',
      '.pau-issue-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
      '.pau-issue-card{background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:11px 13px;display:flex;flex-direction:column;gap:6px;min-width:0;}',
      '.pau-clause-cmp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:10px;}',
      '.pau-clause-card{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:11px 13px;display:flex;flex-direction:column;gap:8px;min-width:0;}',
      '.pau-clause-item{background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-left:3px solid #2563eb;border-radius:7px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;min-width:0;}',
      '.pau-clause-item-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:12px;font-weight:800;color:var(--pau-txt);}',
      '.pau-clause-item-txt{font-size:12.5px;line-height:1.6;color:var(--pau-sub);white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere;}',
      '.pau-org-art-list{display:flex;flex-direction:column;gap:8px;}',
      '.pau-org-art-card{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-width:0;}',
      '.pau-org-art-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}',
      '.pau-art-subgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-top:8px;border-top:1px dashed var(--pau-bd-lt);}',
      '.pau-law-strip{background:#f0fdf4;border:1px solid #86efac;border-radius:9px;padding:9px 12px;margin-bottom:10px;color:#0f172a;display:flex;flex-direction:column;gap:5px;}',
      '.pau-root[data-theme="dark"] .pau-law-strip,body.dark .pau-root .pau-law-strip{background:#052e16;border-color:#4ade80;color:#f0fdf4;}',
      '.pau-topic-bar{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:7px 10px;background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:9px;margin-bottom:8px;}',
      '.pau-topic-chip{cursor:pointer;border:1px solid var(--pau-bd);background:var(--pau-bg);color:var(--pau-sub);padding:4px 9px;min-height:28px;border-radius:999px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}',
      '.pau-topic-chip:hover,.pau-topic-chip:focus-visible{background:var(--pau-th);color:var(--pau-txt);outline:2px solid #2563eb;outline-offset:1px;}',
      '.pau-topic-chip.on{background:#1d4ed8;border-color:#1d4ed8;color:#ffffff;}',
      '.pau-root[data-theme="dark"] .pau-topic-chip.on,body.dark .pau-root .pau-topic-chip.on{background:#2563eb;border-color:#60a5fa;color:#ffffff;}',
      '.pau-issue-mini-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;}',
      '.pau-issue-mini{display:flex;align-items:center;justify-content:space-between;gap:5px;padding:5px 8px;border-radius:6px;font-size:11.5px;border:1px solid var(--pau-bd-lt);background:var(--pau-bg);overflow:hidden;}',
      '.pau-issue-mini span{color:var(--pau-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-issue-mini b{white-space:nowrap;font-weight:700;}',
      '.pau-hm-tag{display:inline-flex;align-items:center;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid var(--pau-bd);white-space:nowrap;line-height:1.3;}',
      '.pau-issue-mini.lv5,.pau-hm-cell.lv5,.pau-hm-tag.lv5{background:#dbeafe;border-color:#93c5fd;color:#1e3a8a;}',
      '.pau-issue-mini.lv4,.pau-hm-cell.lv4,.pau-hm-tag.lv4{background:#dcfce7;border-color:#86efac;color:#14532d;}',
      '.pau-issue-mini.lv3,.pau-hm-cell.lv3,.pau-hm-tag.lv3{background:#f8fafc;border-color:#cbd5e1;color:#1e293b;}',
      '.pau-issue-mini.lv2,.pau-hm-cell.lv2,.pau-hm-tag.lv2{background:#fef9c3;border-color:#fde047;color:#713f12;}',
      '.pau-issue-mini.lv1,.pau-hm-cell.lv1,.pau-hm-tag.lv1{background:#f1f5f9;border-color:#cbd5e1;color:#475569;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv5,body.dark .pau-root .pau-issue-mini.lv5,.pau-root[data-theme="dark"] .pau-hm-cell.lv5,body.dark .pau-root .pau-hm-cell.lv5,.pau-root[data-theme="dark"] .pau-hm-tag.lv5,body.dark .pau-root .pau-hm-tag.lv5{background:#1e3a8a;border-color:#60a5fa;color:#eff6ff;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv4,body.dark .pau-root .pau-issue-mini.lv4,.pau-root[data-theme="dark"] .pau-hm-cell.lv4,body.dark .pau-root .pau-hm-cell.lv4,.pau-root[data-theme="dark"] .pau-hm-tag.lv4,body.dark .pau-root .pau-hm-tag.lv4{background:#14532d;border-color:#4ade80;color:#f0fdf4;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv3,body.dark .pau-root .pau-issue-mini.lv3,.pau-root[data-theme="dark"] .pau-hm-cell.lv3,body.dark .pau-root .pau-hm-cell.lv3,.pau-root[data-theme="dark"] .pau-hm-tag.lv3,body.dark .pau-root .pau-hm-tag.lv3{background:#1e293b;border-color:#475569;color:#e2e8f0;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv2,body.dark .pau-root .pau-issue-mini.lv2,.pau-root[data-theme="dark"] .pau-hm-cell.lv2,body.dark .pau-root .pau-hm-cell.lv2,.pau-root[data-theme="dark"] .pau-hm-tag.lv2,body.dark .pau-root .pau-hm-tag.lv2{background:#713f12;border-color:#facc15;color:#fef9c3;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv1,body.dark .pau-root .pau-issue-mini.lv1,.pau-root[data-theme="dark"] .pau-hm-cell.lv1,body.dark .pau-root .pau-hm-cell.lv1,.pau-root[data-theme="dark"] .pau-hm-tag.lv1,body.dark .pau-root .pau-hm-tag.lv1{background:#0f172a;border-color:#334155;color:#cbd5e1;}',
      '.pau-mini-meter{width:54px;height:6px;background:var(--pau-bd-lt);border-radius:999px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:4px;}',
      '.pau-mini-meter > i{display:block;height:100%;border-radius:999px;background:#2563eb;}',
      '.pau-stack-bar{display:flex;width:100%;height:14px;border-radius:999px;overflow:hidden;background:var(--pau-bd-lt);}',
      '.pau-lgd{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--pau-sub);margin-top:4px;}',
      '.pau-lgd-item{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}',
      '.pau-lgd-item > i{width:10px;height:10px;border-radius:3px;display:inline-block;}',
      '.pau-sec-bar-btn{cursor:pointer;border:none;background:transparent;padding:2px 4px;min-height:28px;border-radius:6px;display:flex;align-items:center;gap:6px;width:100%;text-align:left;color:var(--pau-txt);font-size:11.5px;white-space:nowrap;}',
      '.pau-sec-bar-btn:hover,.pau-sec-bar-btn:focus-visible{background:var(--pau-hov);outline:2px solid #2563eb;outline-offset:-1px;}',
      '.pau-sec-bar-nm{width:125px;overflow:hidden;text-overflow:ellipsis;font-weight:700;flex-shrink:0;}',
      '.pau-sec-bar-num{width:112px;text-align:right;font-variant-numeric:tabular-nums;color:var(--pau-muted);flex-shrink:0;}',
      '.pau-bars-wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px;}',
      '.pau-bar-grp{background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:5px;}',
      '.pau-bar-hd{display:flex;align-items:baseline;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:12px;}',
      '.pau-bar-hd span{font-size:11px;color:var(--pau-muted);}',
      '.pau-bar-row{display:flex;align-items:center;gap:6px;font-size:11.5px;}',
      '.pau-bar-lbl{width:92px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;flex-shrink:0;}',
      '.pau-bar-track{position:relative;flex:1;height:11px;background:var(--pau-bd-lt);border-radius:999px;overflow:visible;}',
      '.pau-bar-fill{height:100%;border-radius:999px;}',
      '.pau-bar-bench{position:absolute;top:-3px;bottom:-3px;width:2px;background:#dc2626;z-index:2;}',
      '.pau-bar-val{width:84px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;flex-shrink:0;}',
      '.pau-show-sm{display:none;}',
      '@media (max-width:768px){',
      '  .pau-show-sm{display:inline;}',
      '  .pau-hdr{padding:6px 8px;gap:4px;flex-wrap:nowrap;}',
      '  .pau-hdr-tit{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;}',
      '  .pau-hdr-badges,.pau-flt-hint,.pau-hide-sm{display:none!important;}',
      '  .pau-hdr-r{margin-left:auto;flex-shrink:0;gap:4px;flex-wrap:nowrap;}',
      '  .pau-btn{padding:4px 7px;font-size:11.5px;}',
      '  .pau-tabs{padding:4px 6px 0;}',
      '  .pau-tab{padding:5px 9px;font-size:12px;min-height:30px;}',
      '  .pau-body{padding:6px 6px 16px;}',
      '  .pau-flt{padding:6px 8px;gap:4px;margin-bottom:6px;}',
      '  .pau-flt select{flex:1 1 calc(50% - 4px);min-width:120px;max-width:100%;height:32px;min-height:32px;font-size:16px!important;}',
      '  .pau-ab-sel{font-size:16px!important;}',
      '  .pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password]{flex:1 1 100%;min-width:120px;max-width:100%;height:32px;min-height:32px;font-size:16px!important;}',
      '  .pau-kpis,.pau-kpis-6{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-bottom:6px;}',
      '  .pau-kpi{padding:4px 8px;}',
      '  .pau-kpi b{font-size:13px;}',
      '  .pau-hero-tit{font-size:15.5px;}',
      '  .pau-hero-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}',
      '  .pau-hero-tab{padding:5px 9px;font-size:11.5px;min-height:30px;}',
      '  .pau-dom-grid,.pau-issue-mini-grid,.pau-ab-grid,.pau-issue-detail-grid,.pau-clause-cmp-grid,.pau-art-subgrid{grid-template-columns:1fr;}',
      '  .pau-doc-row{flex-wrap:wrap;gap:4px 6px;}',
      '  .pau-doc-tit{flex:1 1 100%;order:3;white-space:normal;}',
      '  .pau-doc-meta{margin-left:auto;}',
      '  .pau-diff-hd{display:none;}',
      '  .pau-diff-row{grid-template-columns:1fr;gap:7px;padding:10px;}',
      '  .pau-diff-mbl{display:block;}',
      '  .pau-ab-row{grid-template-columns:1fr;gap:2px;}',
      '  .pau-tbl-wrap{max-height:none;overflow-x:hidden;border:none;background:transparent;}',
      '  .pau-tbl{min-width:0!important;width:100%!important;display:block;}',
      '  .pau-tbl thead{display:none;}',
      '  .pau-tbl tbody{display:block;width:100%;}',
      '  .pau-tbl tr{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:8px 10px;margin-bottom:6px;}',
      '  .pau-tbl td{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px;border:none;padding:2px 0;white-space:normal;overflow:visible;text-overflow:clip;max-width:100%;font-size:12.5px;}',
      '  .pau-tbl td a[data-jump-organ]{white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;}',
      '  .pau-tbl td.pau-hm-cell{display:block;width:100%;padding:5px 8px;border-radius:6px;margin-top:2px;}',
      '  .pau-tbl td.c-ck,.pau-tbl td.c-no{width:auto;padding:0 2px;}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function ensureDataLoaded(cb) {
    if (global.PU_ALIO_DATA) {
      cb(global.PU_ALIO_DATA);
      return;
    }
    if (typeof document === 'undefined') {
      cb(null);
      return;
    }
    var existing = document.querySelector('script[data-pu-alio-data="1"]');
    if (existing) {
      if (existing.dataset && existing.dataset.failed === '1') {
        if (existing.parentNode) existing.parentNode.removeChild(existing);
      } else {
        existing.addEventListener('load', function () { cb(global.PU_ALIO_DATA || null); });
        existing.addEventListener('error', function () {
          if (existing.parentNode) existing.parentNode.removeChild(existing);
          cb(null);
        });
        return;
      }
    }
    var s = document.createElement('script');
    s.src = DATA_SCRIPT_URL;
    if (s.dataset) s.dataset.puAlioData = '1';
    s.onload = function () { cb(global.PU_ALIO_DATA || null); };
    s.onerror = function () {
      if (s.dataset) s.dataset.failed = '1';
      if (s.parentNode) s.parentNode.removeChild(s);
      cb(null);
    };
    document.head.appendChild(s);
  }

  function safeCsvCell(val) {
    var s = String(val == null ? '' : val);
    if (/^[\s]*[=+\-@]/.test(s) && !/^[\s]*-\d+(\.\d+)?$/.test(s)) {
      s = "'" + s;
    }
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, headers, rows) {
    var lines = [headers.map(safeCsvCell).join(',')];
    rows.forEach(function (r) {
      lines.push(r.map(safeCsvCell).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 300);
  }

  function discoverPortalApiKeys(reqUid, cb) {
    if (typeof reqUid === 'function') {
      cb = reqUid;
      reqUid = getActiveUid();
    }
    var uid = String(reqUid == null ? '' : reqUid).trim();
    var out = { uid: uid, dataKey: '', source: '', holidays: [] };
    try {
      localStorage.removeItem('pu_alio_datagokr_key');
      if (uid) {
        var saved = localStorage.getItem(userLsKey(uid));
        if (saved && saved.trim()) {
          out.dataKey = saved.trim();
          out.source = '계정 전용 저장 열쇠';
        }
      }
    } catch (e) {}

    try {
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.database) {
        var db = firebase.database();
        var yr = new Date().getFullYear();
        db.ref('pubdata/common/holidays/' + yr).once('value').then(function (s) {
          var v = s.val();
          if (v && Array.isArray(v.list)) out.holidays = v.list;
        }).catch(function () {});

        if (uid) {
          db.ref('gov/' + uid + '/key_data').once('value').then(function (snap) {
            if (getActiveUid() !== uid) {
              cb({ uid: uid, stale: true, dataKey: '', source: '', holidays: out.holidays });
              return;
            }
            var k = snap.val();
            if (k && String(k).trim()) {
              out.dataKey = String(k).trim();
              out.source = '푸른포털 정부사업신청(gov/' + uid.slice(0, 6) + '…) 자동연동';
              try { localStorage.setItem(userLsKey(uid), out.dataKey); } catch (e) {}
            }
            cb(out);
          }).catch(function () { cb(out); });
          return;
        }
      }
    } catch (e) {}
    cb(out);
  }

  function getInitialUrlParams() {
    var res = { organ: '', region: '', muni: '', compare: [], tab: '', mode: '', doc: '' };
    try {
      if (typeof location !== 'undefined' && location.search) {
        var sp = new URLSearchParams(location.search);
        res.organ = (sp.get('organ') || sp.get('aid') || '').trim();
        res.region = (sp.get('region') || '').trim();
        res.muni = (sp.get('muni') || '').trim();
        res.tab = (sp.get('tab') || '').trim();
        res.mode = (sp.get('mode') || '').trim();
        res.doc = (sp.get('doc') || '').trim();
        var cmpRaw = (sp.get('compare') || '').trim();
        if (cmpRaw) {
          var seenCmp = Object.create(null);
          res.compare = cmpRaw.split(',').map(function (s) { return s.trim(); }).filter(function (s) {
            if (!s || seenCmp[s]) return false;
            seenCmp[s] = true;
            return true;
          }).slice(0, 6);
        }
      }
    } catch (e) {}
    return res;
  }

  function openOrganWindow(aid, forceSameWin) {
    var cleanAid = String(aid == null ? '' : aid).trim();
    if (!cleanAid) return null;
    var url = 'pu-alio-union.html?organ=' + encodeURIComponent(cleanAid);
    var winName = 'pureun-alio-organ-' + cleanAid.replace(/[^a-zA-Z0-9_-]/g, '_');
    var openedWin = null;
    var attemptedOpen = false;
    if (!forceSameWin && typeof global.open === 'function') {
      attemptedOpen = true;
      try {
        openedWin = global.open(url, winName, 'width=1560,height=940,resizable=yes,scrollbars=yes');
        if (openedWin) {
          try { openedWin.opener = null; } catch (e) {}
        }
      } catch (e) {
        openedWin = null;
      }
    }
    var shouldSwitchCurrent = Boolean(forceSameWin || (!attemptedOpen) || (!openedWin));
    if (shouldSwitchCurrent && latestAppHooks && typeof latestAppHooks.openOrganInHistoryTab === 'function') {
      latestAppHooks.openOrganInHistoryTab(cleanAid, true);
    }
    return openedWin;
  }

  function openOrganDetailModal(aid) {
    return openOrganWindow(aid, false);
  }

  function closeOrganDetailModal() {}

  function setAuthUser(u) {
    var nextUid = (u && u.uid) ? String(u.uid) : '';
    var changed = currentAuthUid !== nextUid;
    currentAuthUid = nextUid;
    authLookupGen += 1;
    if (changed && latestAppHooks && typeof latestAppHooks.refreshAuthKey === 'function') {
      latestAppHooks.refreshAuthKey();
    }
  }

  function mount(container, opts) {
    opts = opts || {};
    injectStyles();
    container.innerHTML = '<div class="pau-root"><div role="status" aria-live="polite" style="padding:48px;text-align:center;color:#475569;font-weight:600;">⏳ 공공임단협(기관 중심 통합분류 · 6대 영역 · 그래프 비교 시스템) 데이터를 불러오는 중입니다...</div></div>';

    ensureDataLoaded(function (data) {
      if (!data) {
        container.innerHTML = '<div class="pau-root"><div role="alert" style="padding:48px;text-align:center;color:#dc2626;font-weight:700;">데이터 파일(js/pu-alio-data.js)을 불러오지 못했습니다. <button type="button" class="pau-act-btn pri" data-pau-retry style="margin-left:8px;">다시 시도</button></div></div>';
        var retryBtn = container.querySelector('[data-pau-retry]');
        if (retryBtn) retryBtn.addEventListener('click', function () { mount(container, opts); });
        return;
      }
      renderApp(container, data, opts);
    });
  }

  // ── 메인 애플리케이션 렌더러 ──
  function renderApp(container, data, opts) {
    var safeInsts = (data.institutions || []).filter(Boolean);
    var safeUnions = (data.unions || []).filter(Boolean);
    var safeDiscs = (data.disclosures || []).filter(Boolean);
    var safeMetrics = (data.metrics || []).filter(Boolean);
    var safeArticles = normalizeArticlesList(data.articles || []);

    var master = buildOrganMasterIndex(data);
    var organRecords = master.records;
    var organById = master.byId;
    var benchmarks = master.benchmarks;

    var instMap = Object.create(null);
    safeInsts.forEach(function (i) { instMap[i.apba_id] = i; });
    var unionsByAid = Object.create(null);
    safeUnions.forEach(function (u) {
      if (!unionsByAid[u.apba_id]) unionsByAid[u.apba_id] = [];
      unionsByAid[u.apba_id].push(u);
    });

    var activeUnions = safeUnions.filter(function (u) { return u.union_structure !== '노조없음'; });

    var allTypes = [];
    var centralMinistries = [];
    var provinceCounts = Object.create(null);
    var provinceUnionCounts = Object.create(null);
    PROVINCE_DEFS.forEach(function (p) {
      provinceCounts[p.key] = 0;
      provinceUnionCounts[p.key] = 0;
    });
    organRecords.forEach(function (r) {
      if (worth(r.inst_type) && allTypes.indexOf(r.inst_type) === -1) allTypes.push(r.inst_type);
      if (r.provinceKey) {
        provinceCounts[r.provinceKey] = (provinceCounts[r.provinceKey] || 0) + 1;
        if (r.hasUnion) provinceUnionCounts[r.provinceKey] = (provinceUnionCounts[r.provinceKey] || 0) + 1;
      } else if (worth(r.ministry) && r.ministry !== '지방자치단체' && !PROVINCE_BY_KEY[r.ministry] && centralMinistries.indexOf(r.ministry) === -1) {
        centralMinistries.push(r.ministry);
      }
    });
    allTypes.sort();
    centralMinistries.sort();

    function getOrganSearchHaystack(aid, extraTxt) {
      var rec = aid ? organById[aid] : null;
      if (rec) return rec.searchHaystack + (extraTxt ? (' ' + String(extraTxt).toLowerCase()) : '');
      var inst = aid ? instMap[aid] : null;
      var base = inst ? ((inst.name || '') + ' ' + getProvinceAliasesText(inst.ministry) + ' ' + (inst.inst_type || '') + ' ' + aid) : String(aid || '');
      return (base + ' ' + (extraTxt || '')).toLowerCase();
    }

    function calcOrganRelevanceScore(inst, rec, q, qProv, tokens) {
      var nm = String((inst && inst.name) || (rec && rec.name) || '').toLowerCase();
      var min = String((inst && inst.ministry) || (rec && rec.ministry) || '').toLowerCase();
      var muni = rec && rec.muniName ? rec.muniName.toLowerCase() : '';
      var provAliases = rec && rec.provinceKey ? getProvinceAliasesText(rec.provinceKey).toLowerCase() : '';
      var sc = 0;
      if (nm === q) sc += 12000;
      else if (nm.indexOf(q) === 0) sc += 8000;
      else if (nm.indexOf(q) >= 0) sc += 5500;

      var allDirectHit = true;
      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        var tokHit = false;
        if (nm.indexOf(tok) === 0 || nm.indexOf('(' + tok) === 0) { sc += 4000; tokHit = true; }
        else if (nm.indexOf(tok) >= 0) { sc += 2800; tokHit = true; }
        if (muni && muni.indexOf(tok) >= 0) { sc += 2000; tokHit = true; }
        if (min && min.indexOf(tok) >= 0) { sc += 1600; tokHit = true; }
        else if (provAliases && provAliases.indexOf(tok) >= 0) { sc += 1500; tokHit = true; }
        if (!tokHit) allDirectHit = false;
      }
      if (tokens.length > 1 && allDirectHit) sc += 3000;
      if (qProv && rec && rec.provinceKey === qProv) sc += 2200;
      if (rec && rec.hasUnion) sc += 500 + Math.min(400, Math.round((rec.memberTotal || 0) / 10));
      return sc;
    }

    function sortInstsByQueryRelevance(list, rawQuery) {
      var q = String(rawQuery || '').trim().toLowerCase();
      if (!q || list.length <= 1) return list;
      var qProv = inferProvinceFromQuery(q);
      var tokens = q.split(/\s+/).filter(Boolean);
      return list.slice().sort(function (a, b) {
        return calcOrganRelevanceScore(b, organById[b.apba_id], q, qProv, tokens) -
               calcOrganRelevanceScore(a, organById[a.apba_id], q, qProv, tokens);
      });
    }

    function sortRecordsByQueryRelevance(list, rawQuery) {
      var q = String(rawQuery || '').trim().toLowerCase();
      if (!q || list.length <= 1) return list;
      var qProv = inferProvinceFromQuery(q);
      var tokens = q.split(/\s+/).filter(Boolean);
      return list.slice().sort(function (a, b) {
        return calcOrganRelevanceScore(b.inst, b, q, qProv, tokens) -
               calcOrganRelevanceScore(a.inst, a, q, qProv, tokens);
      });
    }

    function getMunicipalitiesForProvince(provKey) {
      if (!provKey || !PROVINCE_BY_KEY[provKey]) return [];
      var counts = Object.create(null);
      var hqLabel = PROVINCE_BY_KEY[provKey].short + ' 본청';
      organRecords.forEach(function (r) {
        if (r.provinceKey === provKey && r.muniName) {
          counts[r.muniName] = (counts[r.muniName] || 0) + 1;
        }
      });
      var keys = Object.keys(counts);
      keys.sort(function (a, b) {
        var aHq = (a === hqLabel || a.indexOf('본청') >= 0);
        var bHq = (b === hqLabel || b.indexOf('본청') >= 0);
        if (aHq !== bHq) return aHq ? -1 : 1;
        if (counts[b] !== counts[a]) return counts[b] - counts[a];
        return a.localeCompare(b, 'ko');
      });
      return keys.map(function (k) { return { name: k, count: counts[k] }; });
    }

    var allConfeds = [];
    activeUnions.forEach(function (u) {
      var c = worth(u.confederation) ? u.confederation : '미가입';
      if (allConfeds.indexOf(c) === -1) allConfeds.push(c);
    });
    allConfeds.sort();

    var urlInit = getInitialUrlParams();
    var urlOrgan = urlInit.organ;
    var urlRegionResolved = '';
    var urlMultiProvs = [];
    if (urlInit.region) {
      if (urlInit.region.indexOf(',') >= 0) {
        urlInit.region.split(',').forEach(function (part) {
          var t = part.trim();
          if (!t) return;
          var pk = PROVINCE_BY_KEY[t] ? t : inferProvinceFromQuery(t);
          if (pk && PROVINCE_BY_KEY[pk] && urlMultiProvs.indexOf(pk) === -1 && urlMultiProvs.length < 8) {
            urlMultiProvs.push(pk);
          }
        });
        if (urlMultiProvs.length) urlRegionResolved = urlMultiProvs[0];
      } else if (urlInit.region === 'ALL') {
        urlRegionResolved = 'ALL';
      } else if (PROVINCE_BY_KEY[urlInit.region]) {
        urlRegionResolved = urlInit.region;
      } else {
        urlRegionResolved = inferProvinceFromQuery(urlInit.region);
      }
    }
    var urlCompareValid = [];
    (urlInit.compare || []).forEach(function (cid) {
      if (organById[cid] && urlCompareValid.indexOf(cid) === -1 && urlCompareValid.length < 6) {
        urlCompareValid.push(cid);
      }
    });
    var validUrlMode = /^(STUDIO|REGION|ALL_LIST)$/.test(urlInit.mode) ? urlInit.mode : '';
    var validUrlDoc = urlInit.doc === 'DISC' ? 'DISC' : '';
    var validUrlTab = /^(unions|organ|matrix|articles|apihub)$/.test(urlInit.tab) ? urlInit.tab : (validUrlDoc ? 'articles' : '');
    var defaultOrganAid = (urlOrgan && instMap[urlOrgan]) ? urlOrgan : '';
    if (!defaultOrganAid && safeInsts.length) {
      var preferred = safeInsts.find(function (x) {
        return x.apba_id === 'C0005' || (data.revisions && data.revisions[x.apba_id]);
      });
      defaultOrganAid = preferred ? preferred.apba_id : safeInsts[0].apba_id;
    }

    var initialTab = (urlOrgan && instMap[urlOrgan])
      ? 'organ'
      : ((urlRegionResolved || (urlCompareValid.length && !validUrlTab) || validUrlMode) ? 'matrix' : (validUrlTab || 'unions'));
    var initialMSubMode = urlRegionResolved
      ? 'REGION'
      : (urlCompareValid.length ? 'STUDIO' : (validUrlMode || 'STUDIO'));
    var initialRProv = urlRegionResolved
      || ((organById[defaultOrganAid] && organById[defaultOrganAid].provinceKey) ? organById[defaultOrganAid].provinceKey : '충청남도');
    var initialRMuni = '';
    var urlMultiMunis = [];
    if (urlRegionResolved && urlRegionResolved !== 'ALL' && urlMultiProvs.length < 2 && urlInit.muni) {
      var allowedMunis = getMunicipalitiesForProvince(urlRegionResolved);
      var hqMuniLbl = PROVINCE_BY_KEY[urlRegionResolved] ? (PROVINCE_BY_KEY[urlRegionResolved].short + ' 본청') : '';
      if (urlInit.muni.indexOf(',') >= 0) {
        urlInit.muni.split(',').forEach(function (mp) {
          var mt = mp.trim();
          if (!mt) return;
          if ((mt === hqMuniLbl || allowedMunis.some(function (m) { return m.name === mt; })) && urlMultiMunis.indexOf(mt) === -1 && urlMultiMunis.length < 8) {
            urlMultiMunis.push(mt);
          }
        });
        if (urlMultiMunis.length === 1) initialRMuni = urlMultiMunis[0];
      } else if (urlInit.muni === hqMuniLbl || allowedMunis.some(function (m) { return m.name === urlInit.muni; })) {
        initialRMuni = urlInit.muni;
      }
    }

    var state = {
      tab: initialTab,
      // 탭 1: 기관별 분류 · 내부영역 통합 (전 기관 노조·타임오프 현황 포함)
      uViewMode: 'ORGAN', // 'ORGAN' (1기관 1통합행 기본) | 'FLAT_UNION' (단위노조별 나열)
      uShowMacroChart: false,
      uShowMoreFilters: false,
      uScope: 'ALL',
      uSector: '',
      uType: '',
      uMinistry: '',
      uMuni: '',
      uConfed: '',
      uStruct: '', // ''(노조보유 우선 전체) | 'has_union' | 'single' | 'multi' | 'no_union'
      uSort: 'members_desc',
      uQuery: '',
      uPage: 0,
      uExpanded: {},
      // 비교 바구니 (최대 6개 기관)
      compareIds: urlCompareValid,
      cmpAddQuery: '',
      // 탭 2: 기관별 연혁·과거임단협·유사기관 비교 & 내부 6대 영역 종합
      hScope: 'ALL',
      hSearch: '',
      hOrgan: defaultOrganAid,
      hSubTab: 'OVERVIEW', // 'OVERVIEW' (6대영역 요약) | 'HISTORY' (신구대비·연혁) | 'ISSUES' (13대쟁점·조문) | 'PEERS' (유사기관) | 'CHART' (업종그래프)
      hCatFilter: '',
      hVerA: null,
      hVerB: null,
      hSimMode: 'ALL',
      // 탭 3: 그래프·히트맵 비교분석 스튜디오 & 지역·지자체 산하 비교 & 13대 핵심 쟁점 원문 대조
      mSubMode: initialMSubMode, // 'STUDIO' (다중기관 비교) | 'REGION' (지역·지자체 산하기관 전수 비교) | 'ALL_LIST' (단일쟁점 목록)
      rProvince: initialRProv,
      rMuni: initialRMuni,
      rMultiMode: urlMultiProvs.length >= 2 || urlMultiMunis.length >= 2,
      rMultiProvs: urlMultiProvs.slice(),
      rMultiMunis: urlMultiMunis.length >= 2 ? urlMultiMunis.slice() : [],
      rTypeGroup: '', // '' | 'LOCAL_CORP' | 'LOCAL_AFFIL' | 'LOCAL_DIRECT'
      rUnionFilter: '', // ''(노조우선 전체) | 'has_union' | 'multi' | 'no_union'
      rSort: 'members_desc',
      rQuery: '',
      rChecked: {},
      mIssue: METRIC_DEFS[0].key,
      mScope: 'ALL',
      mType: '',
      mConfed: '',
      mSort: 'members_desc',
      mQuery: '',
      mChecked: {},
      // 탭 4: 조문·원문 통합 (단체협약 조문 쟁점별 다중비교·기관별 묶음·검색표 + 공시·사규 원문)
      docMode: validUrlDoc || 'ARTICLES', // 'ARTICLES' | 'DISC'
      aViewMode: 'COMPARE', // 'COMPARE' (쟁점별 다중비교 기본) | 'BY_ORGAN' (기관별 조문 묶음) | 'TABLE' (전체 조문 검색표)
      aScope: 'ALL',
      aCat: 'ALL',
      aSort: '',
      aQuery: '',
      aCmpAddQ: '',
      aPage: 0,
      aOrgExpanded: {},
      aRowExpanded: {},
      dViewMode: 'BY_ORGAN', // 'BY_ORGAN' (기관별 원문 묶음 기본) | 'TABLE' (전체 공시문서 표)
      dScope: 'ALL',
      dOrganSearch: '',
      dOrgan: (urlOrgan && instMap[urlOrgan]) ? urlOrgan : '',
      dTax: 'ALL',
      dSort: '',
      dQuery: '',
      dPage: 0,
      dOrgExpanded: {},
      // 탭 5(유틸): 공공·법령 API 실시간 연동 센터
      apiLawKey: LAW_API_SOURCES[0].key,
      apiLawArt: '24',
      apiAlioSearch: '',
      apiAlioAid: defaultOrganAid,
      apiAlioTax: '21026',
      apiDataKey: '',
      apiKeySource: '확인 중...',
      apiHolidays: []
    };

    var totalInst = safeInsts.length;
    var centralInstCount = safeInsts.filter(function (i) { return !isLocalOrgan(i); }).length;
    var localInstCount = totalInst - centralInstCount;
    var unionizedInstCount = organRecords.filter(function (r) { return r.hasUnion; }).length;
    var totalDisc = safeDiscs.length;
    var totalArt = safeArticles.length;

    container.innerHTML = [
      '<div class="pau-root">',
      '  <div class="pau-hdr">',
      '    <span class="pau-hdr-ico" aria-hidden="true">🤝</span>',
      '    <span class="pau-hdr-tit">공공임단협</span>',
      '    <div class="pau-hdr-badges">',
      '      <span class="pau-badge ok" data-pau-api-badge>중앙·지방 ' + fmtNum(totalInst) + '곳 · 실시간 법령연동</span>',
      '    </div>',
      '    <div class="pau-hdr-r">',
      '      <span id="who" class="pau-who-slot pau-hide-sm"></span>',
      '      <button type="button" class="pau-btn pri" data-pau-csv aria-label="현재 화면 엑셀 CSV 받기">📥 CSV</button>',
      (opts.isModal ? '      <a class="pau-btn pau-hide-sm" href="pu-alio-union.html" target="pureun-aliounion" rel="noopener">↗ 별개 창</a>' : ''),
      '      <a class="pau-btn" href="enter.html">🏠 포털 홈</a>',
      (opts.onClose ? '<button type="button" class="pau-btn" data-pau-close aria-label="닫기">✕ 닫기</button>' : ''),
      '    </div>',
      '  </div>',
      '  <div class="pau-tabs" role="tablist" aria-label="공공임단협 분석 탭">',
      '    <button type="button" role="tab" id="pau-tab-unions" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'unions' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'unions' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'unions' ? ' on' : '') + '" data-tab="unions" title="전 기관 노조·타임오프 현황 및 기관별 6대 영역 통합 분류">🏛️ 기관 목록</button>',
      '    <button type="button" role="tab" id="pau-tab-organ" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'organ' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'organ' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'organ' ? ' on' : '') + '" data-tab="organ" title="기관별 연혁·과거임단협·유사기관 비교 및 내부 6대 영역 한눈에 보기">🔎 기관 상세</button>',
      '    <button type="button" role="tab" id="pau-tab-matrix" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'matrix' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'matrix' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'matrix' ? ' on' : '') + '" data-tab="matrix" title="13대 핵심 쟁점 기관간 비교·원문 대조 및 그래프·히트맵 비교">📊 비교분석</button>',
      '    <button type="button" role="tab" id="pau-tab-articles" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'articles' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'articles' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'articles' ? ' on' : '') + '" data-tab="articles" title="단체협약 조문 통합 검색 및 기관별 공시·별도합의·내부규정 원문">📚 조문·원문</button>',
      '    <button type="button" role="tab" id="pau-tab-apihub" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'apihub' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'apihub' ? 'true' : 'false') + '" class="pau-tab util' + (state.tab === 'apihub' ? ' on' : '') + '" data-tab="apihub" title="공공·법령 API 실시간 연동 센터">🔌 API</button>',
      '  </div>',
      '  <div class="pau-cmp-tray" data-pau-cmp-tray></div>',
      '  <div class="pau-body" id="pau-tabpanel" role="tabpanel" aria-labelledby="pau-tab-' + state.tab + '" data-pau-body></div>',
      '</div>'
    ].join('');

    var bodyEl = container.querySelector('[data-pau-body]');
    var cmpTrayEl = container.querySelector('[data-pau-cmp-tray]');
    var apiBadgeEl = container.querySelector('[data-pau-api-badge]');

    function toggleCompareOrgan(aid) {
      if (!aid || !organById[aid]) return;
      var idx = state.compareIds.indexOf(aid);
      if (idx >= 0) {
        state.compareIds.splice(idx, 1);
      } else {
        if (state.compareIds.length >= 6) state.compareIds.shift();
        state.compareIds.push(aid);
      }
      renderCompareTray();
    }

    function launchVisualComparisonWithPeers(baseAid) {
      var targetAid = (baseAid && organById[baseAid]) ? baseAid : state.hOrgan;
      if (targetAid && organById[targetAid]) {
        var sims = findSimilarOrgans(data, targetAid, 'ALL').slice(0, 3).map(function (s) { return s.apba_id; });
        var nextIds = [targetAid];
        sims.forEach(function (sid) {
          if (nextIds.indexOf(sid) === -1 && organById[sid]) nextIds.push(sid);
        });
        state.compareIds.forEach(function (cid) {
          if (nextIds.length < 6 && nextIds.indexOf(cid) === -1 && organById[cid]) nextIds.push(cid);
        });
        state.compareIds = nextIds;
      }
      state.mSubMode = 'STUDIO';
      renderCompareTray();
      switchTab('matrix');
    }

    function renderCompareTray() {
      if (!cmpTrayEl) return;
      var inStudio = (state.tab === 'matrix' && state.mSubMode === 'STUDIO');
      var inClauseCmp = (state.tab === 'articles' && state.docMode !== 'DISC' && state.aViewMode === 'COMPARE');
      if (!state.compareIds.length || inStudio) {
        if (cmpTrayEl.classList && cmpTrayEl.classList.toggle) cmpTrayEl.classList.toggle('on', false);
        cmpTrayEl.innerHTML = '';
        return;
      }
      if (cmpTrayEl.classList && cmpTrayEl.classList.toggle) cmpTrayEl.classList.toggle('on', true);
      cmpTrayEl.innerHTML = [
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '  <span style="font-size:12px;font-weight:800;color:var(--pau-pri);">📊 비교함 (' + state.compareIds.length + '/6곳):</span>',
        state.compareIds.map(function (cid, idx) {
          var r = organById[cid];
          if (!r) return '';
          var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
          return '<button type="button" class="pau-act-btn" data-tray-rm="' + esc(cid) + '" aria-label="' + esc(r.name + ' 비교 제외') + '" style="border-color:' + pal.stroke + ';">' +
            (idx === 0 ? '⭐ ' : '') + esc(r.name) + ' ✕</button>';
        }).join(''),
        '</div>',
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '  <button type="button" class="pau-act-btn pri" data-tray-go>📊 비교분석 보기</button>',
        (!inClauseCmp ? '  <button type="button" class="pau-act-btn" data-tray-clauses>⚖️ 조문 병렬비교</button>' : ''),
        '  <button type="button" class="pau-act-btn" data-tray-clear>비우기</button>',
        '</div>'
      ].join('');

      Array.prototype.forEach.call(cmpTrayEl.querySelectorAll('[data-tray-rm]'), function (b) {
        b.addEventListener('click', function () {
          toggleCompareOrgan(b.getAttribute('data-tray-rm') || '');
          renderCurrentTab();
        });
      });
      var goBtn = cmpTrayEl.querySelector('[data-tray-go]');
      if (goBtn) {
        goBtn.addEventListener('click', function () {
          state.mSubMode = 'STUDIO';
          switchTab('matrix');
        });
      }
      var clBtn = cmpTrayEl.querySelector('[data-tray-clauses]');
      if (clBtn) {
        clBtn.addEventListener('click', function () {
          state.docMode = 'ARTICLES';
          state.aViewMode = 'COMPARE';
          switchTab('articles');
        });
      }
      var clrBtn = cmpTrayEl.querySelector('[data-tray-clear]');
      if (clrBtn) {
        clrBtn.addEventListener('click', function () {
          state.compareIds = [];
          renderCompareTray();
          renderCurrentTab();
        });
      }
    }

    function openRegionComparison(provKey, muniKey) {
      if (provKey && (provKey === 'ALL' || PROVINCE_BY_KEY[provKey])) {
        state.rProvince = provKey;
      } else if (!state.rProvince) {
        state.rProvince = '충청남도';
      }
      state.rMuni = (typeof muniKey === 'string') ? muniKey : '';
      state.rMultiMode = false;
      state.rMultiProvs = [];
      state.rMultiMunis = [];
      state.rChecked = {};
      state.mSubMode = 'REGION';
      switchTab('matrix');
    }

    // 위임 클릭 핸들러 (독립 창 열기, 클린아이 POST, 비교함 토글, 지역산하비교 이동, 인라인 펼침, 상세 전환)
    if (bodyEl) {
      bodyEl.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;

        var jumpOrganEl = e.target.closest('[data-jump-organ]');
        if (jumpOrganEl) {
          e.preventDefault();
          e.stopPropagation();
          openOrganWindow(jumpOrganEl.getAttribute('data-jump-organ') || '', false);
          return;
        }

        var postEl = e.target.closest('[data-cleaneye-post]');
        if (postEl) {
          e.preventDefault();
          e.stopPropagation();
          var cAid = postEl.getAttribute('data-cleaneye-post') || '';
          var cType = postEl.getAttribute('data-cleaneye-type') || 'union_info';
          if (cAid) openCleaneyeDirect(cAid, cType);
          return;
        }

        var jumpRegBtn = e.target.closest('[data-jump-region]');
        if (jumpRegBtn) {
          e.preventDefault();
          e.stopPropagation();
          openRegionComparison(
            jumpRegBtn.getAttribute('data-jump-region') || '',
            jumpRegBtn.getAttribute('data-jump-muni') || ''
          );
          return;
        }

        var expBtn = e.target.closest('[data-exp-organ]');
        if (expBtn) {
          e.preventDefault();
          var expId = expBtn.getAttribute('data-exp-organ') || '';
          if (expId) {
            state.uExpanded[expId] = !state.uExpanded[expId];
            renderTabUnions();
          }
          return;
        }

        var quickSecBtn = e.target.closest('[data-quick-sector]');
        if (quickSecBtn) {
          e.preventDefault();
          var sc = quickSecBtn.getAttribute('data-quick-sector') || '';
          state.uSector = (state.uSector === sc) ? '' : sc;
          state.uPage = 0;
          renderTabUnions();
          return;
        }

        var cmpBtn = e.target.closest('[data-toggle-cmp]');
        if (cmpBtn) {
          e.preventDefault();
          e.stopPropagation();
          toggleCompareOrgan(cmpBtn.getAttribute('data-toggle-cmp') || '');
          renderCurrentTab();
          return;
        }

        var hereBtn = e.target.closest('[data-open-organ-here]');
        if (hereBtn) {
          e.preventDefault();
          e.stopPropagation();
          var targetSub = hereBtn.getAttribute('data-open-sub') || 'OVERVIEW';
          openOrganInHistoryTab(hereBtn.getAttribute('data-open-organ-here') || '', true, targetSub);
          return;
        }

        var visBtn = e.target.closest('[data-go-visual-cmp]');
        if (visBtn) {
          e.preventDefault();
          e.stopPropagation();
          launchVisualComparisonWithPeers(visBtn.getAttribute('data-go-visual-cmp') || '');
          return;
        }

        var hSubBtn = e.target.closest('[data-h-sub]');
        if (hSubBtn) {
          e.preventDefault();
          var nextHSub = hSubBtn.getAttribute('data-h-sub') || 'OVERVIEW';
          var nextCatAttr = hSubBtn.getAttribute('data-h-cat');
          state.hSubTab = nextHSub;
          state.hCatFilter = nextCatAttr != null ? nextCatAttr : '';
          renderTabOrganHistory();
          if (bodyEl) {
            var focusHSub = bodyEl.querySelector('#pauOrganSubCard [data-h-sub="' + nextHSub + '"]');
            if (focusHSub && typeof focusHSub.focus === 'function') focusHSub.focus();
          }
          return;
        }

        var docModeBtn = e.target.closest('[data-doc-mode]');
        if (docModeBtn) {
          e.preventDefault();
          var nextDocMode = docModeBtn.getAttribute('data-doc-mode') || 'ARTICLES';
          state.docMode = nextDocMode;
          renderCompareTray();
          renderCurrentTab();
          if (bodyEl) {
            var focusDocBtn = bodyEl.querySelector('[data-doc-mode="' + nextDocMode + '"]');
            if (focusDocBtn && typeof focusDocBtn.focus === 'function') focusDocBtn.focus();
          }
          return;
        }

        var thSortBtn = e.target.closest('[data-th-sort]');
        if (thSortBtn) {
          e.preventDefault();
          var colId = thSortBtn.getAttribute('data-th-sort') || '';
          if (colId) {
            toggleColumnSort(colId);
            if (bodyEl) {
              var nextThBtn = bodyEl.querySelector('[data-th-sort="' + colId + '"]');
              if (nextThBtn && typeof nextThBtn.focus === 'function') nextThBtn.focus();
            }
          }
          return;
        }
      });
    }

    function renderSortTh(widthPct, label, colId, curSort, activeKeys) {
      var isAct = activeKeys.indexOf(curSort) >= 0;
      var isAsc = isAct && curSort.slice(-4) === '_asc';
      var ariaSort = isAct ? (isAsc ? 'ascending' : 'descending') : 'none';
      var ico = isAct ? (isAsc ? '▲' : '▼') : '⇅';
      var dirHint = isAct
        ? (isAsc ? '오름차순 적용 중 · 클릭 시 내림차순(▼) 전환' : '내림차순 적용 중 · 클릭 시 오름차순(▲) 전환')
        : '클릭하여 이 열 기준으로 정렬';
      return '<th class="c-sort"' + (widthPct ? (' style="width:' + widthPct + ';"') : '') + ' aria-sort="' + ariaSort + '">' +
        '<button type="button" class="pau-th-btn' + (isAct ? ' on' : '') + '" data-th-sort="' + esc(colId) + '" title="' + esc(label + ' (' + dirHint + ')') + '">' +
          '<span>' + esc(label) + '</span>' +
          '<span class="pau-th-ico" aria-hidden="true">' + ico + '</span>' +
        '</button>' +
      '</th>';
    }

    function toggleColumnSort(colId) {
      if (colId.indexOf('u_') === 0) {
        if (colId === 'u_name') {
          state.uSort = state.uSort === 'name_asc' ? 'name_desc' : (state.uSort === 'ministry_asc' ? 'ministry_desc' : 'name_asc');
        } else if (colId === 'u_sector') {
          state.uSort = state.uSort === 'sector_asc' ? 'sector_desc' : 'sector_asc';
        } else if (colId === 'u_union') {
          state.uSort = state.uSort === 'union_desc' ? 'union_asc' : 'union_desc';
        } else if (colId === 'u_confed') {
          state.uSort = state.uSort === 'confed_asc' ? 'confed_desc' : 'confed_asc';
        } else if (colId === 'u_elig') {
          state.uSort = state.uSort === 'elig_desc' ? 'elig_asc' : 'elig_desc';
        } else if (colId === 'u_members') {
          if (state.uSort === 'orgrate_desc') state.uSort = 'orgrate_asc';
          else if (state.uSort === 'orgrate_asc') state.uSort = 'orgrate_desc';
          else state.uSort = state.uSort === 'members_desc' ? 'members_asc' : 'members_desc';
        } else if (colId === 'u_timeoff') {
          if (state.uSort === 'limitpct_desc') state.uSort = 'limitpct_asc';
          else if (state.uSort === 'limitpct_asc') state.uSort = 'limitpct_desc';
          else state.uSort = state.uSort === 'timeoff_desc' ? 'timeoff_asc' : 'timeoff_desc';
        } else if (colId === 'u_domains') {
          if (state.uSort === 'score_desc') state.uSort = 'score_asc';
          else if (state.uSort === 'score_asc') state.uSort = 'score_desc';
          else state.uSort = state.uSort === 'disc_desc' ? 'disc_asc' : 'disc_desc';
        }
        state.uPage = 0;
        renderTabUnions();
        return;
      }
      if (colId.indexOf('r_') === 0) {
        if (colId === 'r_muni') state.rSort = state.rSort === 'muni_asc' ? 'muni_desc' : 'muni_asc';
        else if (colId === 'r_name') state.rSort = state.rSort === 'name_asc' ? 'name_desc' : 'name_asc';
        else if (colId === 'r_union') state.rSort = state.rSort === 'union_desc' ? 'union_asc' : 'union_desc';
        else if (colId === 'r_members') {
          if (state.rSort === 'orgrate_desc') state.rSort = 'orgrate_asc';
          else if (state.rSort === 'orgrate_asc') state.rSort = 'orgrate_desc';
          else state.rSort = state.rSort === 'members_desc' ? 'members_asc' : 'members_desc';
        } else if (colId === 'r_timeoff') state.rSort = state.rSort === 'timeoff_desc' ? 'timeoff_asc' : 'timeoff_desc';
        else if (colId === 'r_pers') state.rSort = state.rSort === 'pers_desc' ? 'pers_asc' : 'pers_desc';
        else if (colId === 'r_leave') state.rSort = state.rSort === 'leave_desc' ? 'leave_asc' : 'leave_desc';
        else if (colId === 'r_score') state.rSort = state.rSort === 'score_desc' ? 'score_asc' : 'score_desc';
        renderTabMatrix();
        return;
      }
      if (colId.indexOf('m_') === 0) {
        if (colId === 'm_name') state.mSort = state.mSort === 'name_asc' ? 'name_desc' : 'name_asc';
        else if (colId === 'm_union') state.mSort = state.mSort === 'union_asc' ? 'union_desc' : 'union_asc';
        else if (colId === 'm_members') state.mSort = state.mSort === 'members_desc' ? 'members_asc' : 'members_desc';
        else if (colId === 'm_val') state.mSort = state.mSort === 'val_desc' ? 'val_asc' : 'val_desc';
        renderTabMatrix();
        return;
      }
      if (colId.indexOf('a_') === 0) {
        state.aViewMode = 'TABLE';
        state.aPage = 0;
        if (colId === 'a_name') state.aSort = state.aSort === 'name_asc' ? 'name_desc' : 'name_asc';
        else if (colId === 'a_cat') state.aSort = state.aSort === 'cat_asc' ? 'cat_desc' : 'cat_asc';
        else if (colId === 'a_no') state.aSort = state.aSort === 'no_asc' ? 'no_desc' : 'no_asc';
        else if (colId === 'a_tit') state.aSort = state.aSort === 'tit_asc' ? 'tit_desc' : 'tit_asc';
        renderCompareTray();
        renderTabArticles();
        return;
      }
      if (colId.indexOf('d_org_') === 0) {
        state.dViewMode = 'BY_ORGAN';
        if (colId === 'd_org_name') state.dSort = state.dSort === 'name_asc' ? 'name_desc' : 'name_asc';
        else if (colId === 'd_org_cnt') state.dSort = (state.dSort || 'cnt_desc') === 'cnt_desc' ? 'cnt_asc' : 'cnt_desc';
        else if (colId === 'd_org_date') state.dSort = state.dSort === 'date_desc' ? 'date_asc' : 'date_desc';
        state.dPage = 0;
        renderTabDetail();
        return;
      }
      if (colId.indexOf('d_') === 0) {
        state.dViewMode = 'TABLE';
        if (colId === 'd_name') state.dSort = state.dSort === 'name_asc' ? 'name_desc' : 'name_asc';
        else if (colId === 'd_cat') state.dSort = state.dSort === 'cat_asc' ? 'cat_desc' : 'cat_asc';
        else if (colId === 'd_date') state.dSort = state.dSort === 'date_desc' ? 'date_asc' : 'date_desc';
        state.dPage = 0;
        renderTabDetail();
      }
    }

    function switchTab(nextTab, focusTabBtn) {
      if (nextTab === 'detail') {
        state.tab = 'articles';
        state.docMode = 'DISC';
      } else {
        state.tab = nextTab;
      }
      if (bodyEl) bodyEl.setAttribute('aria-labelledby', 'pau-tab-' + state.tab);
      Array.prototype.forEach.call(container.querySelectorAll('.pau-tab'), function (b) {
        var on = b.getAttribute('data-tab') === state.tab;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.setAttribute('tabindex', on ? '0' : '-1');
        if (on && focusTabBtn && typeof b.focus === 'function') b.focus();
      });
      renderCompareTray();
      renderCurrentTab();
    }

    function openOrganInHistoryTab(aid, shouldSwitchHere, targetSubTab) {
      if (!aid || !instMap[aid]) return;
      state.hOrgan = aid;
      state.hSearch = '';
      state.hCatFilter = '';
      state.hSubTab = targetSubTab || 'OVERVIEW';
      state.dOrgan = aid;
      state.apiAlioAid = aid;
      state.hVerA = null;
      state.hVerB = null;
      if (shouldSwitchHere) {
        switchTab('organ');
      }
    }

    function refreshAuthKey() {
      var myGen = ++authLookupGen;
      var reqUid = getActiveUid();
      state.apiDataKey = '';
      state.apiKeySource = reqUid ? '확인 중...' : '미설정 (로그인 후 자동연동)';
      if (!reqUid) {
        if (apiBadgeEl) apiBadgeEl.textContent = '중앙·지방 ' + fmtNum(totalInst) + '곳 · 실시간 법령연동';
        if (state.tab === 'apihub') renderTabApiHub();
        return;
      }
      discoverPortalApiKeys(reqUid, function (res) {
        if (myGen !== authLookupGen || getActiveUid() !== reqUid || (res && res.stale)) return;
        state.apiDataKey = (res && res.dataKey) ? res.dataKey : '';
        state.apiKeySource = (res && res.source) ? res.source : '미설정 (API 탭에서 등록)';
        state.apiHolidays = (res && res.holidays) ? res.holidays : [];
        if (apiBadgeEl) {
          apiBadgeEl.textContent = state.apiDataKey
            ? '중앙·지방 ' + fmtNum(totalInst) + '곳 · API 연동됨'
            : '중앙·지방 ' + fmtNum(totalInst) + '곳 · 실시간 법령연동';
        }
        if (state.tab === 'apihub') renderTabApiHub();
      });
    }

    latestAppHooks = {
      refreshAuthKey: refreshAuthKey,
      openOrganInHistoryTab: openOrganInHistoryTab,
      openRegionComparison: openRegionComparison
    };
    refreshAuthKey();

    var tabBtns = Array.prototype.slice.call(container.querySelectorAll('.pau-tab'));
    tabBtns.forEach(function (btn, idx) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab') || 'unions', false);
      });
      btn.addEventListener('keydown', function (e) {
        var key = e.key;
        var nextIdx = -1;
        if (key === 'ArrowRight') nextIdx = (idx + 1) % tabBtns.length;
        else if (key === 'ArrowLeft') nextIdx = (idx - 1 + tabBtns.length) % tabBtns.length;
        else if (key === 'Home') nextIdx = 0;
        else if (key === 'End') nextIdx = tabBtns.length - 1;
        if (nextIdx >= 0) {
          e.preventDefault();
          switchTab(tabBtns[nextIdx].getAttribute('data-tab') || 'unions', true);
        }
      });
    });

    var closeBtn = container.querySelector('[data-pau-close]');
    if (closeBtn && opts.onClose) closeBtn.addEventListener('click', opts.onClose);

    var csvBtn = container.querySelector('[data-pau-csv]');
    if (csvBtn) csvBtn.addEventListener('click', function () { exportCurrentTabCsv(); });

    // ════════════════════════════════════════════════════════════════════════
    // 탭 1: 기관별 분류 · 6대영역 현황 (1기관 = 1행 마스터 분류 + 인라인 6대영역 펼침)
    // ════════════════════════════════════════════════════════════════════════
    function filterOrganMasterList() {
      var filtered = organRecords.filter(function (r) {
        if (!matchOrganScope(r.inst, state.uScope)) return false;
        if (state.uSector && r.sectorCode !== state.uSector) return false;
        if (state.uType && r.inst_type !== state.uType) return false;
        if (state.uMinistry) {
          if (PROVINCE_BY_KEY[state.uMinistry]) {
            if (r.provinceKey !== state.uMinistry) return false;
          } else if (r.ministry !== state.uMinistry) {
            return false;
          }
        }
        if (state.uMuni && r.muniName !== state.uMuni) return false;
        if (state.uConfed) {
          if (!r.hasUnion || r.confeds.indexOf(state.uConfed) === -1) return false;
        }
        if (state.uStruct === 'has_union' && !r.hasUnion) return false;
        if (state.uStruct === 'single' && (!r.hasUnion || r.isMulti)) return false;
        if (state.uStruct === 'multi' && (!r.hasUnion || !r.isMulti)) return false;
        if (state.uStruct === 'no_union' && r.hasUnion) return false;
        if (!matchSmartQuery(r.searchHaystack, state.uQuery)) return false;
        return true;
      });

      filtered.sort(function (a, b) {
        var s = state.uSort || 'members_desc';
        if (s === 'name_asc') return a.name.localeCompare(b.name, 'ko');
        if (s === 'name_desc') return b.name.localeCompare(a.name, 'ko');
        if (s === 'ministry_asc' || s === 'ministry_desc') {
          var ma = (a.ministry || '') + ' ' + (a.muniName || '');
          var mb = (b.ministry || '') + ' ' + (b.muniName || '');
          var mc = ma.localeCompare(mb, 'ko');
          if (mc !== 0) return s === 'ministry_asc' ? mc : -mc;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (s === 'sector_asc' || s === 'sector_desc') {
          var sa = (a.scopeLabel || '') + ' ' + (a.sectorLabel || '') + ' ' + (a.inst_type || '');
          var sb = (b.scopeLabel || '') + ' ' + (b.sectorLabel || '') + ' ' + (b.inst_type || '');
          var sc = sa.localeCompare(sb, 'ko');
          if (sc !== 0) return s === 'sector_asc' ? sc : -sc;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (s === 'union_desc') {
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (b.unionCount !== a.unionCount) return b.unionCount - a.unionCount;
          if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (s === 'union_asc') {
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          var ua = a.repUnion ? (a.repUnion.union_name || '') : '';
          var ub = b.repUnion ? (b.repUnion.union_name || '') : '';
          var uc = ua.localeCompare(ub, 'ko');
          if (uc !== 0) return uc;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (s === 'confed_asc' || s === 'confed_desc') {
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          var ca = a.repConfed || '미가입';
          var cb = b.repConfed || '미가입';
          var cc = ca.localeCompare(cb, 'ko');
          if (cc !== 0) return s === 'confed_asc' ? cc : -cc;
          return b.memberTotal - a.memberTotal;
        }
        if (s === 'elig_desc' || s === 'elig_asc') {
          var aHasEl = a.eligibleCount > 0;
          var bHasEl = b.eligibleCount > 0;
          if (aHasEl !== bHasEl) return bHasEl ? 1 : -1;
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (a.eligibleCount !== b.eligibleCount) {
            return s === 'elig_desc' ? (b.eligibleCount - a.eligibleCount) : (a.eligibleCount - b.eligibleCount);
          }
          return a.name.localeCompare(b.name, 'ko');
        }
        if (s === 'timeoff_desc' || s === 'timeoff_asc') {
          var aHasTo = a.timeoffHours > 0;
          var bHasTo = b.timeoffHours > 0;
          if (aHasTo !== bHasTo) return bHasTo ? 1 : -1;
          if (a.timeoffHours !== b.timeoffHours) {
            return s === 'timeoff_desc' ? (b.timeoffHours - a.timeoffHours) : (a.timeoffHours - b.timeoffHours);
          }
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          return b.memberTotal - a.memberTotal;
        }
        if (s === 'limitpct_desc' || s === 'limitpct_asc') {
          var aHasLp = a.timeoffLimitPct > 0;
          var bHasLp = b.timeoffLimitPct > 0;
          if (aHasLp !== bHasLp) return bHasLp ? 1 : -1;
          if (a.timeoffLimitPct !== b.timeoffLimitPct) {
            return s === 'limitpct_desc' ? (b.timeoffLimitPct - a.timeoffLimitPct) : (a.timeoffLimitPct - b.timeoffLimitPct);
          }
          return b.timeoffHours - a.timeoffHours;
        }
        if (s === 'orgrate_desc' || s === 'orgrate_asc') {
          var aHasOr = a.orgRate > 0;
          var bHasOr = b.orgRate > 0;
          if (aHasOr !== bHasOr) return bHasOr ? 1 : -1;
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (a.orgRate !== b.orgRate) {
            return s === 'orgrate_desc' ? (b.orgRate - a.orgRate) : (a.orgRate - b.orgRate);
          }
          return b.memberTotal - a.memberTotal;
        }
        if (s === 'score_desc' || s === 'score_asc') {
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (a.totalScore !== b.totalScore) {
            return s === 'score_desc' ? (b.totalScore - a.totalScore) : (a.totalScore - b.totalScore);
          }
          return b.memberTotal - a.memberTotal;
        }
        if (s === 'disc_desc' || s === 'disc_asc') {
          if (a.discTotal !== b.discTotal) {
            return s === 'disc_desc' ? (b.discTotal - a.discTotal) : (a.discTotal - b.discTotal);
          }
          if (a.totalScore !== b.totalScore) {
            return s === 'disc_desc' ? (b.totalScore - a.totalScore) : (a.totalScore - b.totalScore);
          }
          return a.name.localeCompare(b.name, 'ko');
        }
        var aHasMem = a.memberTotal > 0;
        var bHasMem = b.memberTotal > 0;
        if (aHasMem !== bHasMem) return bHasMem ? 1 : -1;
        if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
        if (s === 'members_asc') {
          if (a.memberTotal !== b.memberTotal) return a.memberTotal - b.memberTotal;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
        if (b.discTotal !== a.discTotal) return b.discTotal - a.discTotal;
        return a.name.localeCompare(b.name, 'ko');
      });
      return filtered;
    }

    function filterFlatUnions() {
      var list = activeUnions.filter(function (u) {
        var inst = instMap[u.apba_id] || u;
        var rec = organById[u.apba_id];
        if (!matchOrganScope(inst, state.uScope)) return false;
        if (state.uSector && detectSectorGroup(inst).code !== state.uSector) return false;
        if (state.uType && u.inst_type !== state.uType) return false;
        if (state.uMinistry) {
          if (PROVINCE_BY_KEY[state.uMinistry]) {
            if ((rec ? rec.provinceKey : resolveOrganProvince(inst)) !== state.uMinistry) return false;
          } else if (u.ministry !== state.uMinistry) {
            return false;
          }
        }
        if (state.uMuni && (rec ? rec.muniName : '') !== state.uMuni) return false;
        var cf = worth(u.confederation) ? u.confederation : '미가입';
        if (state.uConfed && cf !== state.uConfed) return false;
        if (state.uStruct === 'multi' && String(u.union_structure || '').indexOf('복수') === -1) return false;
        if (state.uStruct === 'single' && String(u.union_structure || '').indexOf('단일') === -1) return false;
        var hay = getOrganSearchHaystack(u.apba_id, (u.union_name || '') + ' ' + (u.federation || '') + ' ' + (u.confederation || ''));
        if (!matchSmartQuery(hay, state.uQuery)) return false;
        return true;
      });
      var s = state.uSort || 'members_desc';
      list.sort(function (a, b) {
        var an = String(a.inst_name || '');
        var bn = String(b.inst_name || '');
        if (s === 'name_asc') return an.localeCompare(bn, 'ko') || String(a.union_name || '').localeCompare(String(b.union_name || ''), 'ko');
        if (s === 'name_desc') return bn.localeCompare(an, 'ko') || String(a.union_name || '').localeCompare(String(b.union_name || ''), 'ko');
        if (s === 'ministry_asc' || s === 'ministry_desc') {
          var mc = String(a.ministry || '').localeCompare(String(b.ministry || ''), 'ko');
          if (mc !== 0) return s === 'ministry_asc' ? mc : -mc;
          return an.localeCompare(bn, 'ko');
        }
        if (s === 'sector_asc' || s === 'sector_desc') {
          var ta = (isLocalOrgan(a) ? '지방 ' : '중앙 ') + String(a.inst_type || '');
          var tb = (isLocalOrgan(b) ? '지방 ' : '중앙 ') + String(b.inst_type || '');
          var tc = ta.localeCompare(tb, 'ko');
          if (tc !== 0) return s === 'sector_asc' ? tc : -tc;
          return an.localeCompare(bn, 'ko');
        }
        if (s === 'union_asc' || s === 'union_desc') {
          var uc = String(a.union_name || '').localeCompare(String(b.union_name || ''), 'ko');
          if (uc !== 0) return s === 'union_asc' ? uc : -uc;
          return an.localeCompare(bn, 'ko');
        }
        if (s === 'confed_asc' || s === 'confed_desc') {
          var cfa = (a.confederation || '미가입') + ' ' + (a.federation || '');
          var cfb = (b.confederation || '미가입') + ' ' + (b.federation || '');
          var cc = cfa.localeCompare(cfb, 'ko');
          if (cc !== 0) return s === 'confed_asc' ? cc : -cc;
          return Number(b.member_total || 0) - Number(a.member_total || 0);
        }
        if (s === 'elig_desc' || s === 'elig_asc') {
          var ea = Number(a.eligible_count || 0);
          var eb = Number(b.eligible_count || 0);
          if ((ea > 0) !== (eb > 0)) return eb > 0 ? 1 : -1;
          if (ea !== eb) return s === 'elig_desc' ? (eb - ea) : (ea - eb);
          return an.localeCompare(bn, 'ko');
        }
        if (s === 'limitpct_desc' || s === 'limitpct_asc') {
          var limA = calcLegalTimeoffLimit(Number(a.member_total || 0));
          var limB = calcLegalTimeoffLimit(Number(b.member_total || 0));
          var lpA = (limA > 0 && Number(a.timeoff_hours || 0) > 0) ? ((Number(a.timeoff_hours || 0) / limA) * 100) : 0;
          var lpB = (limB > 0 && Number(b.timeoff_hours || 0) > 0) ? ((Number(b.timeoff_hours || 0) / limB) * 100) : 0;
          if ((lpA > 0) !== (lpB > 0)) return lpB > 0 ? 1 : -1;
          if (lpA !== lpB) return s === 'limitpct_asc' ? (lpA - lpB) : (lpB - lpA);
          return Number(b.timeoff_hours || 0) - Number(a.timeoff_hours || 0);
        }
        if (s === 'timeoff_desc' || s === 'timeoff_asc') {
          var taH = Number(a.timeoff_hours || 0);
          var tbH = Number(b.timeoff_hours || 0);
          var aPos = taH > 0;
          var bPos = tbH > 0;
          if (aPos !== bPos) return bPos ? 1 : -1;
          if (taH !== tbH) return s === 'timeoff_asc' ? (taH - tbH) : (tbH - taH);
          return Number(b.member_total || 0) - Number(a.member_total || 0);
        }
        if (s === 'orgrate_desc' || s === 'orgrate_asc') {
          var ra = Number(a.eligible_count || 0) > 0 ? (Number(a.member_total || 0) / Number(a.eligible_count)) : 0;
          var rb = Number(b.eligible_count || 0) > 0 ? (Number(b.member_total || 0) / Number(b.eligible_count)) : 0;
          if ((ra > 0) !== (rb > 0)) return rb > 0 ? 1 : -1;
          if (ra !== rb) return s === 'orgrate_desc' ? (rb - ra) : (ra - rb);
        }
        if (s === 'score_desc' || s === 'score_asc' || s === 'disc_desc' || s === 'disc_asc') {
          var oa = organById[a.apba_id];
          var ob = organById[b.apba_id];
          var va = oa ? (s.indexOf('score_') === 0 ? oa.totalScore : oa.discTotal) : 0;
          var vb = ob ? (s.indexOf('score_') === 0 ? ob.totalScore : ob.discTotal) : 0;
          if (va !== vb) return s.slice(-4) === '_asc' ? (va - vb) : (vb - va);
        }
        var maN = Number(a.member_total || 0);
        var mbN = Number(b.member_total || 0);
        if ((maN > 0) !== (mbN > 0)) return mbN > 0 ? 1 : -1;
        if (s === 'members_asc') return (maN - mbN) || an.localeCompare(bn, 'ko');
        return (mbN - maN) || an.localeCompare(bn, 'ko');
      });
      return list;
    }

    function renderUnionSortOptionsHtml() {
      var optsList = [
        ['members_desc', '정렬: 조합원 많은순 ▼'],
        ['members_asc', '정렬: 조합원 적은순 ▲'],
        ['orgrate_desc', '정렬: 조직률(%) 높은순 ▼'],
        ['orgrate_asc', '정렬: 조직률(%) 낮은순 ▲'],
        ['timeoff_desc', '정렬: 타임오프 많은순 ▼'],
        ['timeoff_asc', '정렬: 타임오프 적은순 ▲'],
        ['limitpct_desc', '정렬: 한도대비(%) 높은순 ▼'],
        ['limitpct_asc', '정렬: 한도대비(%) 낮은순 ▲'],
        ['disc_desc', '정렬: 6대영역 공시 많은순 ▼'],
        ['disc_asc', '정렬: 6대영역 공시 적은순 ▲'],
        ['score_desc', '정렬: 6대영역 점수 높은순 ▼'],
        ['score_asc', '정렬: 6대영역 점수 낮은순 ▲'],
        ['union_desc', '정렬: 노조수(복수우선)순 ▼'],
        ['union_asc', '정렬: 노조명 가나다순 ▲'],
        ['confed_asc', '정렬: 상급단체순 ▲'],
        ['confed_desc', '정렬: 상급단체 역순 ▼'],
        ['elig_desc', '정렬: 가입대상 많은순 ▼'],
        ['elig_asc', '정렬: 가입대상 적은순 ▲'],
        ['name_asc', '정렬: 기관명 가나다순 ▲'],
        ['name_desc', '정렬: 기관명 역순 ▼'],
        ['ministry_asc', '정렬: 소관·지자체순 ▲'],
        ['ministry_desc', '정렬: 소관·지자체 역순 ▼'],
        ['sector_asc', '정렬: 권역·업종순 ▲'],
        ['sector_desc', '정렬: 권역·업종 역순 ▼']
      ];
      return optsList.map(function (it) {
        return '<option value="' + esc(it[0]) + '"' + (state.uSort === it[0] ? ' selected' : '') + '>' + esc(it[1]) + '</option>';
      }).join('');
    }

    function renderUnionsDynHtml() {
      var organRows = filterOrganMasterList();
      var unionizedRows = organRows.filter(function (r) { return r.hasUnion; });
      var totalUnionUnits = 0;
      var totalMembers = 0;
      var timeoffSum = 0;
      var timeoffCnt = 0;
      var orgRateSum = 0;
      organRows.forEach(function (r) {
        totalUnionUnits += r.unionCount;
        totalMembers += r.memberTotal;
        if (r.hasUnion) orgRateSum += r.orgRate;
        if (r.timeoffHours > 0) {
          timeoffSum += r.timeoffHours;
          timeoffCnt += 1;
        }
      });
      var avgOrgRate = unionizedRows.length ? (Math.round((orgRateSum / unionizedRows.length) * 10) / 10) : 0;
      var avgTimeoff = timeoffCnt ? Math.round(timeoffSum / timeoffCnt) : 0;

      var pageSize = 250;
      var listSource = state.uViewMode === 'FLAT_UNION' ? filterFlatUnions() : organRows;
      var totalPages = Math.max(1, Math.ceil(listSource.length / pageSize));
      if (state.uPage >= totalPages) state.uPage = totalPages - 1;
      if (state.uPage < 0) state.uPage = 0;
      var startIdx = state.uPage * pageSize;
      var visibleRows = listSource.slice(startIdx, startIdx + pageSize);

      var activeProv = (state.uMinistry && PROVINCE_BY_KEY[state.uMinistry])
        ? state.uMinistry
        : inferProvinceFromQuery(state.uQuery);
      var activeProvCount = activeProv ? (provinceCounts[activeProv] || 0) : 0;

      return {
        totalPages: totalPages,
        html: [
          (state.uShowMacroChart ? renderMacroDistributionStrip(organRows) : ''),
          '<div class="pau-subbar">',
          '  <span>조회 <b>' + fmtNum(organRows.length) + '곳</b> (노조 <b>' + fmtNum(unionizedRows.length) + '곳</b> · 단위노조 <b>' + fmtNum(totalUnionUnits) + '개</b> · 조합원 <b>' + fmtNum(totalMembers) + '명</b> · 평균 조직률 <b>' + avgOrgRate + '%</b> · 타임오프 <b>' + fmtNum(avgTimeoff) + 'h</b>)</span>',
          '  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
          (activeProv ? '    <button type="button" class="pau-act-btn pri" data-jump-region="' + esc(activeProv) + '" data-jump-muni="' + esc(PROVINCE_BY_KEY[state.uMinistry] ? state.uMuni : '') + '">🗺️ ' + esc(PROVINCE_BY_KEY[activeProv].short) + ' 산하기관(' + fmtNum(activeProvCount) + '곳) 한눈비교 →</button>' : ''),
          '    <select class="pau-sub-sort" data-u-sort aria-label="목록 정렬 기준" title="목록 정렬 기준 선택">',
          renderUnionSortOptionsHtml(),
          '    </select>',
          (listSource.length > pageSize ? [
            '    <span>' + (state.uPage + 1) + ' / ' + totalPages + ' 페이지</span>',
            '    <button type="button" class="pau-act-btn" data-u-prev' + (state.uPage <= 0 ? ' disabled' : '') + '>◀ 이전</button>',
            '    <button type="button" class="pau-act-btn" data-u-next' + (state.uPage + 1 >= totalPages ? ' disabled' : '') + '>다음 ▶</button>'
          ].join('') : ''),
          '  </div>',
          '</div>',

          (state.uViewMode === 'ORGAN' ? [
            '<div class="pau-tbl-wrap">',
            '  <table class="pau-tbl">',
            '    <thead>',
            '      <tr>',
            '        <th class="c-no">№</th>',
            '        ' + renderSortTh('19%', '기관명 · 소관부처/지자체 (클릭→별개 창)', 'u_name', state.uSort, ['name_asc', 'name_desc', 'ministry_asc', 'ministry_desc']),
            '        ' + renderSortTh('12%', '권역 · 업종 · 유형', 'u_sector', state.uSort, ['sector_asc', 'sector_desc']),
            '        ' + renderSortTh('16%', '노조 구성 · 대표노조 · 상급단체', 'u_union', state.uSort, ['union_desc', 'union_asc', 'confed_asc', 'confed_desc']),
            '        ' + renderSortTh('11%', '조합원 · 조직률(%)', 'u_members', state.uSort, ['members_desc', 'members_asc', 'orgrate_desc', 'orgrate_asc', 'elig_desc', 'elig_asc']),
            '        ' + renderSortTh('10%', '타임오프 · 한도대비', 'u_timeoff', state.uSort, ['timeoff_desc', 'timeoff_asc', 'limitpct_desc', 'limitpct_asc']),
            '        ' + renderSortTh('14%', '기관 내부 6대 영역 현황', 'u_domains', state.uSort, ['disc_desc', 'disc_asc', 'score_desc', 'score_asc']),
            '        <th style="width:18%;">한눈에 펼침 · 비교 · 상세</th>',
            '      </tr>',
            '    </thead>',
            '    <tbody>',
            (visibleRows.length ? visibleRows.map(function (r, idx) {
              var absNo = startIdx + idx + 1;
              var isExp = !!state.uExpanded[r.aid];
              var inCmp = state.compareIds.indexOf(r.aid) >= 0;
              var subJuris = r.muniName ? (r.ministry + ' · ' + r.muniName) : r.ministry;
              var organFull = r.name + ' (' + subJuris + ')';
              var unionSummary = !r.hasUnion
                ? '노조 미설립 (취업규칙·사규 운영)'
                : ((r.repUnion ? r.repUnion.union_name : '노동조합') + (r.unionCount > 1 ? (' 외 ' + (r.unionCount - 1) + '개') : ''));

              var domBadges = [];
              if (r.hasUnion) domBadges.push('<span class="pau-pill fktu" title="단위노조 ' + r.unionCount + '개">노조 ' + r.unionCount + '</span>');
              if (r.domains.caDiscs.length) domBadges.push('<span class="pau-pill ok" title="단체협약 ' + r.domains.caDiscs.length + '건">단협 ' + r.domains.caDiscs.length + '</span>');
              if (r.domains.wageDiscs.length) domBadges.push('<span class="pau-pill ok" title="임금협약 ' + r.domains.wageDiscs.length + '건">임협 ' + r.domains.wageDiscs.length + '</span>');
              if (r.domains.sepDiscs.length) domBadges.push('<span class="pau-pill multi" title="별도합의·노사협의 ' + r.domains.sepDiscs.length + '건">별도 ' + r.domains.sepDiscs.length + '</span>');
              if (r.domains.ruleDiscs.length) domBadges.push('<span class="pau-pill" title="내부규정·사규 ' + r.domains.ruleDiscs.length + '건">사규 ' + r.domains.ruleDiscs.length + '</span>');
              if (r.domains.revisions.length) domBadges.push('<span class="pau-pill loc" title="과거↔현행 신·구 대비표 수록">신구대비</span>');
              if (!domBadges.length) domBadges.push('<span class="pau-pill">사규·공시직결</span>');

              var mainRow = [
                '<tr' + (inCmp ? ' style="background:var(--pau-pri-bg);"' : '') + '>',
                '  <td class="c-no">' + absNo + '</td>',
                '  <td title="' + esc(organFull) + ' (클릭→별개 독립 창)"><a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="color:var(--pau-pri);font-weight:800;text-decoration:none;">↗ ' + esc(organFull) + '</a></td>',
                '  <td title="' + esc(r.scopeLabel + ' · ' + r.sectorLabel + ' · ' + r.inst_type) + '"><span class="pau-pill ' + (r.isLocal ? 'loc' : '') + '">' + esc(r.scopeLabel) + '</span> ' + esc(r.sectorLabel) + '</td>',
                '  <td title="' + esc(r.unionStructLabel + ' · ' + unionSummary) + '">' +
                  (r.hasUnion
                    ? ('<span class="pau-pill ' + (r.isMulti ? 'multi' : confedClass(r.repConfed)) + '">' + esc(r.isMulti ? ('복수 ' + r.unionCount) : r.repConfed) + '</span> ' + esc(unionSummary))
                    : '<span style="color:var(--pau-muted);">미설립 · 사규운영</span>') +
                  '</td>',
                '  <td class="c-num" title="조합원 ' + fmtNum(r.memberTotal) + '명 / 가입대상 ' + fmtNum(r.eligibleCount) + '명 (조직률 ' + fmtPct(r.orgRate) + ')">' +
                  (r.hasUnion
                    ? ('<span class="pau-mini-meter"><i style="width:' + Math.min(100, r.orgRate) + '%;"></i></span><b>' + fmtNum(r.memberTotal) + '명</b> (' + Math.round(r.orgRate) + '%)')
                    : '—') +
                  '</td>',
                '  <td class="c-num" title="타임오프 ' + fmtNum(r.timeoffHours) + 'h / 법정상한 ' + fmtNum(r.legalTimeoffLimit) + 'h (' + fmtPct(r.timeoffLimitPct) + ')">' +
                  (r.timeoffHours > 0
                    ? ('<b>' + fmtNum(r.timeoffHours) + 'h</b> <span style="font-size:11px;color:var(--pau-muted);">(' + Math.round(r.timeoffLimitPct) + '%)</span>')
                    : (r.hasUnion ? '비전임/미상' : '—')) +
                  '</td>',
                '  <td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;">' + domBadges.slice(0, 3).join('') + '</div></td>',
                '  <td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' +
                  '<button type="button" class="pau-act-btn' + (isExp ? ' pri' : '') + '" data-exp-organ="' + esc(r.aid) + '" aria-expanded="' + (isExp ? 'true' : 'false') + '">' + (isExp ? '▲ 접기' : '▼ 6대영역') + '</button>' +
                  '<button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(r.aid) + '" title="그래프·표 비교함에 담기">' + (inCmp ? '✓비교' : '+비교') + '</button>' +
                  '<button type="button" class="pau-act-btn" data-open-organ-here="' + esc(r.aid) + '" title="기관 내부 종합·세부비교 화면으로 이동" aria-label="' + esc(r.name + ' 세부비교 열기') + '">🔎</button>' +
                '</div></td>',
                '</tr>'
              ].join('');

              if (!isExp) return mainRow;
              return mainRow + '<tr class="pau-exp-row"><td colspan="8">' + renderOrganSixDomainsBoard(r, true, inCmp) + '</td></tr>';
            }).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--pau-muted);">검색·분류 조건에 해당하는 기관이 없습니다.</td></tr>'),
            '    </tbody>',
            '  </table>',
            '</div>'
          ].join('') : [
            '<div class="pau-tbl-wrap">',
            '  <table class="pau-tbl">',
            '    <thead>',
            '      <tr>',
            '        <th class="c-no">№</th>',
            '        ' + renderSortTh('20%', '기관명 · 소관부처/지자체 (클릭→별개 창)', 'u_name', state.uSort, ['name_asc', 'name_desc', 'ministry_asc', 'ministry_desc']),
            '        ' + renderSortTh('14%', '구분 · 기관유형', 'u_sector', state.uSort, ['sector_asc', 'sector_desc']),
            '        ' + renderSortTh('18%', '노동조합명 · 교섭권', 'u_union', state.uSort, ['union_desc', 'union_asc']),
            '        ' + renderSortTh('13%', '상급단체 (총연맹·연맹)', 'u_confed', state.uSort, ['confed_asc', 'confed_desc']),
            '        ' + renderSortTh('7%', '가입대상', 'u_elig', state.uSort, ['elig_desc', 'elig_asc']),
            '        ' + renderSortTh('7%', '조합원', 'u_members', state.uSort, ['members_desc', 'members_asc', 'orgrate_desc', 'orgrate_asc']),
            '        ' + renderSortTh('9%', '타임오프', 'u_timeoff', state.uSort, ['timeoff_desc', 'timeoff_asc', 'limitpct_desc', 'limitpct_asc']),
            '        <th style="width:12%;">비교담기 · 원문</th>',
            '      </tr>',
            '    </thead>',
            '    <tbody>',
            (visibleRows.length ? visibleRows.map(function (r, idx) {
              var absIdx = startIdx + idx;
              var isLoc = isLocalOrgan(r);
              var isMois = isErcMoisOrgan(r);
              var isRep = String(r.bargaining_right || '').indexOf('대표') >= 0;
              var inCmp = state.compareIds.indexOf(r.apba_id) >= 0;
              var organFull = (r.inst_name || '') + (r.ministry ? ' (' + r.ministry + ')' : '');
              var toFull = (Number(r.timeoff_hours || 0) ? fmtNum(r.timeoff_hours) + 'h' : '—') +
                ((Number(r.timeoff_fulltime || 0) || Number(r.timeoff_parttime || 0)) ? ' · 풀' + (r.timeoff_fulltime || 0) + '·파트' + (r.timeoff_parttime || 0) : '');
              var safeUnionUrl = safeHttpUrl(buildOrganUrl(r, r.disclosure_no));
              var postAttr = (isLoc && !isMois) ? (' data-cleaneye-post="' + esc(r.apba_id) + '" data-cleaneye-type="union_info"') : '';
              return [
                '<tr>',
                '  <td class="c-no">' + (absIdx + 1) + '</td>',
                '  <td title="' + esc(organFull) + '"><a href="pu-alio-union.html?organ=' + encodeURIComponent(r.apba_id) + '" data-jump-organ="' + esc(r.apba_id) + '" style="color:var(--pau-pri);font-weight:700;text-decoration:none;">↗ ' + esc(organFull) + '</a></td>',
                '  <td><span class="pau-pill ' + (isLoc ? 'loc' : '') + '">' + (isLoc ? '지방' : '중앙') + '</span> ' + esc(r.inst_type || '') + '</td>',
                '  <td style="font-weight:600;">' + (isRep ? '<span class="pau-pill fktu">대표</span> ' : '') + esc(r.union_name || '') + '</td>',
                '  <td><span class="pau-pill ' + confedClass(r.confederation) + '">' + esc(r.confederation || '미가입') + '</span> ' + esc(r.federation || '') + '</td>',
                '  <td class="c-num">' + fmtNum(r.eligible_count) + '</td>',
                '  <td class="c-num" style="font-weight:700;">' + fmtNum(r.member_total) + '</td>',
                '  <td class="c-num">' + esc(toFull) + '</td>',
                '  <td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' +
                  '<button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(r.apba_id) + '">' + (inCmp ? '✓비교' : '+비교') + '</button>' +
                  (safeUnionUrl ? '<a class="pau-pill ok" href="' + esc(safeUnionUrl) + '"' + postAttr + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 원문</a>' : '') +
                '</div></td>',
                '</tr>'
              ].join('');
            }).join('') : '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--pau-muted);">조건에 해당하는 단위노조가 없습니다.</td></tr>'),
            '    </tbody>',
            '  </table>',
            '</div>'
          ].join(''))
        ].join('')
      };
    }

    function calcExtraUnionFilterCount() {
      return (state.uType ? 1 : 0) + (state.uConfed ? 1 : 0) + (state.uSort !== 'members_desc' ? 1 : 0) + (state.uViewMode === 'FLAT_UNION' ? 1 : 0);
    }

    function renderTabUnions() {
      var extraFilterCount = calcExtraUnionFilterCount();
      var selectedProv = (state.uMinistry && PROVINCE_BY_KEY[state.uMinistry]) ? state.uMinistry : '';
      var muniOptions = selectedProv ? getMunicipalitiesForProvince(selectedProv) : [];
      var dynRes = renderUnionsDynHtml();
      var jumpProvTarget = selectedProv || inferProvinceFromQuery(state.uQuery) || state.rProvince || '충청남도';

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select data-f="uScope" aria-label="권역 구분 선택" title="중앙·지방 권역 구분">',
        '    <option value="ALL"' + (state.uScope === 'ALL' ? ' selected' : '') + '>구분 전체 (' + fmtNum(totalInst) + '곳)</option>',
        '    <option value="CENTRAL"' + (state.uScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙 ALIO (' + fmtNum(centralInstCount) + '곳)</option>',
        '    <option value="LOCAL_ERC_MOIS"' + (state.uScope === 'LOCAL_ERC_MOIS' ? ' selected' : '') + '>🏛️ 평가원·행안부 유관 (6곳)</option>',
        '    <option value="LOCAL_CORP"' + (state.uScope === 'LOCAL_CORP' ? ' selected' : '') + '>🚇 지방공사·공단</option>',
        '    <option value="LOCAL_AFFIL"' + (state.uScope === 'LOCAL_AFFIL' ? ' selected' : '') + '>🏢 지방출자·출연</option>',
        '    <option value="LOCAL_DIRECT"' + (state.uScope === 'LOCAL_DIRECT' ? ' selected' : '') + '>💧 지방직영기업</option>',
        '    <option value="LOCAL_ALL"' + (state.uScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방 전체 (' + fmtNum(localInstCount) + '곳)</option>',
        '  </select>',
        '  <select data-f="uSector" aria-label="10대 기능·업종 분류" title="업종군 분류">',
        '    <option value="">업종 전체</option>',
        SECTOR_RULES.concat([{ code: 'GENERAL', label: '일반공공서비스' }]).map(function (s) {
          return '<option value="' + esc(s.code) + '"' + (state.uSector === s.code ? ' selected' : '') + '>' + esc(s.label) + '</option>';
        }).join(''),
        '  </select>',
        '  <select data-f="uMinistry" aria-label="소관부처·시도 지자체 선택" title="소관부처·16개 시도 지자체">',
        '    <option value="">소관·시/도 전체</option>',
        '    <optgroup label="🗺️ 16개 시·도 지자체 산하기관">',
        PROVINCE_DEFS.map(function (p) {
          var cnt = provinceCounts[p.key] || 0;
          return '<option value="' + esc(p.key) + '"' + (state.uMinistry === p.key ? ' selected' : '') + '>' + esc(p.key + ' (' + p.short + ' · ' + fmtNum(cnt) + '곳)') + '</option>';
        }).join(''),
        '    </optgroup>',
        '    <optgroup label="🏛️ 중앙행정기관 (ALIO 소관부처)">',
        centralMinistries.map(function (m) {
          return '<option value="' + esc(m) + '"' + (state.uMinistry === m ? ' selected' : '') + '>' + esc(m) + '</option>';
        }).join(''),
        '    </optgroup>',
        '  </select>',
        (selectedProv ? [
          '  <select data-f="uMuni" aria-label="기초지자체 시·군·구 선택" title="본청·시군구 산하기관 선택">',
          '    <option value="">본청·시/군/구 전체</option>',
          muniOptions.map(function (m) {
            return '<option value="' + esc(m.name) + '"' + (state.uMuni === m.name ? ' selected' : '') + '>' + esc(m.name + ' (' + m.count + '곳)') + '</option>';
          }).join(''),
          '  </select>'
        ].join('') : ''),
        '  <select data-f="uStruct" aria-label="노조 보유·형태 분류" title="노조 보유·형태">',
        '    <option value=""' + (state.uStruct === '' ? ' selected' : '') + '>노조유무 전체</option>',
        '    <option value="has_union"' + (state.uStruct === 'has_union' ? ' selected' : '') + '>노조 보유 (' + fmtNum(unionizedInstCount) + '곳)</option>',
        '    <option value="multi"' + (state.uStruct === 'multi' ? ' selected' : '') + '>복수노조 기관</option>',
        '    <option value="single"' + (state.uStruct === 'single' ? ' selected' : '') + '>단일노조 기관</option>',
        '    <option value="no_union"' + (state.uStruct === 'no_union' ? ' selected' : '') + '>미설립·사규 운영</option>',
        '  </select>',
        '  <input type="search" data-f="uQuery" aria-label="기관명·노동조합명 검색" placeholder="기관·노조·지역 검색" value="' + esc(state.uQuery) + '" style="min-width:165px;max-width:240px;">',
        '  <div style="display:flex;align-items:center;gap:5px;margin-left:auto;flex-wrap:wrap;">',
        '    <button type="button" class="pau-act-btn" data-jump-region="' + esc(jumpProvTarget) + '" data-jump-muni="' + esc(selectedProv ? state.uMuni : '') + '" title="지역·지자체 산하기관 전체 한눈 비교">🗺️ 지역산하비교</button>',
        '    <button type="button" class="pau-act-btn' + ((state.uShowMoreFilters || extraFilterCount > 0) ? ' pri' : '') + '" aria-pressed="' + (state.uShowMoreFilters ? 'true' : 'false') + '" data-toggle-more-flt>⚙️ 상세필터' + (extraFilterCount > 0 ? ' (' + extraFilterCount + ')' : '') + '</button>',
        '    <button type="button" class="pau-act-btn' + (state.uShowMacroChart ? ' pri' : '') + '" aria-pressed="' + (state.uShowMacroChart ? 'true' : 'false') + '" data-toggle-macro>📊 분포차트</button>',
        '  </div>',
        '</div>',

        (state.uShowMoreFilters ? [
          '<div class="pau-flt" style="background:var(--pau-th);">',
          '  <select data-f="uType" aria-label="기관유형 선택" title="기관유형">',
          '    <option value="">기관유형 전체</option>',
          allTypes.map(function (t) { return '<option value="' + esc(t) + '"' + (state.uType === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''),
          '  </select>',
          '  <select data-f="uConfed" aria-label="상급단체 선택" title="상급단체">',
          '    <option value="">상급단체 전체</option>',
          allConfeds.map(function (c) { return '<option value="' + esc(c) + '"' + (state.uConfed === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join(''),
          '  </select>',
          '  <select data-f="uSort" aria-label="기관 정렬 기준" title="정렬 기준">',
          renderUnionSortOptionsHtml(),
          '  </select>',
          '  <div class="pau-seg" role="group" aria-label="목록 보기 방식">',
          '    <button type="button" class="pau-seg-btn' + (state.uViewMode === 'ORGAN' ? ' on' : '') + '" aria-pressed="' + (state.uViewMode === 'ORGAN' ? 'true' : 'false') + '" data-u-mode="ORGAN">🏢 기관 통합</button>',
          '    <button type="button" class="pau-seg-btn' + (state.uViewMode === 'FLAT_UNION' ? ' on' : '') + '" aria-pressed="' + (state.uViewMode === 'FLAT_UNION' ? 'true' : 'false') + '" data-u-mode="FLAT_UNION">👥 단위노조 나열</button>',
          '  </div>',
          '  <button type="button" class="pau-act-btn" data-u-reset style="margin-left:auto;">초기화</button>',
          '</div>'
        ].join('') : ''),

        '<div data-u-dyn>' + dynRes.html + '</div>'
      ].join('');

      function bindUnionsPager(totalPagesNow) {
        var quickSortSel = bodyEl.querySelector('[data-u-sort]');
        if (quickSortSel) {
          quickSortSel.addEventListener('change', function () {
            state.uSort = quickSortSel.value || 'members_desc';
            state.uPage = 0;
            var advSortSel = bodyEl.querySelector('select[data-f="uSort"]');
            if (advSortSel) advSortSel.value = state.uSort;
            updateUnionsDyn();
            var nextQuickSort = bodyEl.querySelector('[data-u-sort]');
            if (nextQuickSort && typeof nextQuickSort.focus === 'function') nextQuickSort.focus();
          });
        }
        var prevBtn = bodyEl.querySelector('[data-u-prev]');
        if (prevBtn) {
          prevBtn.addEventListener('click', function () {
            if (state.uPage > 0) {
              state.uPage -= 1;
              updateUnionsDyn();
            }
          });
        }
        var nextBtn = bodyEl.querySelector('[data-u-next]');
        if (nextBtn) {
          nextBtn.addEventListener('click', function () {
            if (state.uPage + 1 < totalPagesNow) {
              state.uPage += 1;
              updateUnionsDyn();
            }
          });
        }
      }

      function updateUnionsDyn() {
        var dynEl = bodyEl.querySelector('[data-u-dyn]');
        if (!dynEl) return;
        var nextRes = renderUnionsDynHtml();
        dynEl.innerHTML = nextRes.html;
        var topJumpBtn = bodyEl.querySelector('.pau-flt [data-jump-region]');
        if (topJumpBtn) {
          var nextTarget = (state.uMinistry && PROVINCE_BY_KEY[state.uMinistry])
            ? state.uMinistry
            : (inferProvinceFromQuery(state.uQuery) || state.rProvince || '충청남도');
          topJumpBtn.setAttribute('data-jump-region', nextTarget);
        }
        var moreFltBtn = bodyEl.querySelector('[data-toggle-more-flt]');
        if (moreFltBtn) {
          var nextExtraCnt = calcExtraUnionFilterCount();
          moreFltBtn.classList.toggle('pri', !!(state.uShowMoreFilters || nextExtraCnt > 0));
          moreFltBtn.textContent = '⚙️ 상세필터' + (nextExtraCnt > 0 ? ' (' + nextExtraCnt + ')' : '');
        }
        bindUnionsPager(nextRes.totalPages);
      }

      bindFilterInputs(renderTabUnions, { uQuery: updateUnionsDyn });
      bindUnionsPager(dynRes.totalPages);

      var moreFltBtn = bodyEl.querySelector('[data-toggle-more-flt]');
      if (moreFltBtn) {
        moreFltBtn.addEventListener('click', function () {
          state.uShowMoreFilters = !state.uShowMoreFilters;
          renderTabUnions();
          var nextBtn = bodyEl.querySelector('[data-toggle-more-flt]');
          if (nextBtn && typeof nextBtn.focus === 'function') nextBtn.focus();
        });
      }
      var resetBtn = bodyEl.querySelector('[data-u-reset]');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          state.uScope = 'ALL';
          state.uSector = '';
          state.uMinistry = '';
          state.uMuni = '';
          state.uType = '';
          state.uStruct = '';
          state.uConfed = '';
          state.uSort = 'members_desc';
          state.uViewMode = 'ORGAN';
          state.uQuery = '';
          state.uPage = 0;
          renderTabUnions();
        });
      }
      var macroBtn = bodyEl.querySelector('[data-toggle-macro]');
      if (macroBtn) {
        macroBtn.addEventListener('click', function () {
          state.uShowMacroChart = !state.uShowMacroChart;
          renderTabUnions();
          var nextBtn = bodyEl.querySelector('[data-toggle-macro]');
          if (nextBtn && typeof nextBtn.focus === 'function') nextBtn.focus();
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-u-mode]'), function (b) {
        b.addEventListener('click', function () {
          var nextMode = b.getAttribute('data-u-mode') || 'ORGAN';
          state.uViewMode = nextMode;
          state.uPage = 0;
          renderTabUnions();
          var nextBtn = bodyEl.querySelector('[data-u-mode="' + nextMode + '"]');
          if (nextBtn && typeof nextBtn.focus === 'function') nextBtn.focus();
        });
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 탭 2: 기관 상세 — 통합 프로필 히어로 & 5대 포커스 서브탭 (6대영역·신구대비/연혁·13대쟁점/조문·유사기관·업종그래프)
    // ════════════════════════════════════════════════════════════════════════
    function renderTabOrganHistory() {
      if (!organRecords.length) {
        bodyEl.innerHTML = '<div class="pau-sec-card" style="padding:32px;text-align:center;color:var(--pau-muted);">표시할 공공기관 데이터가 없습니다.</div>';
        return;
      }

      function computeHistoryCandidates(preferTopMatch) {
        var hasQ = !!String(state.hSearch || '').trim();
        var cands = safeInsts.filter(function (o) {
          if (!matchOrganScope(o, state.hScope)) return false;
          if (!hasQ) return true;
          return matchSmartQuery(getOrganSearchHaystack(o.apba_id), state.hSearch);
        });
        if (hasQ) {
          cands = sortInstsByQueryRelevance(cands, state.hSearch);
        }
        var curAid = state.hOrgan || defaultOrganAid;
        var curInst = instMap[curAid] || safeInsts[0];
        if (!hasQ) {
          if (curInst && matchOrganScope(curInst, state.hScope)) {
            if (cands.every(function (o) { return o.apba_id !== curInst.apba_id; })) cands.unshift(curInst);
            state.hOrgan = curInst.apba_id;
          } else if (cands.length > 0) {
            state.hOrgan = cands[0].apba_id;
            state.hCatFilter = '';
            state.hVerA = null;
            state.hVerB = null;
          } else {
            state.hOrgan = curInst ? curInst.apba_id : defaultOrganAid;
          }
        } else if (cands.length > 0 && (preferTopMatch || cands.every(function (o) { return o.apba_id !== state.hOrgan; }))) {
          if (state.hOrgan !== cands[0].apba_id) {
            state.hOrgan = cands[0].apba_id;
            state.hCatFilter = '';
            state.hVerA = null;
            state.hVerB = null;
          }
        }
        return cands;
      }

      function pickDefaultComparePair(list) {
        if (!list || list.length < 2) return { a: 0, b: 0 };
        var bIdx = 0;
        var bItem = list[bIdx];
        for (var i = 1; i < list.length; i++) {
          if (bItem.ccode && list[i].ccode && String(list[i].ccode) === String(bItem.ccode)) {
            return { a: i, b: bIdx };
          }
        }
        for (var j = 1; j < list.length; j++) {
          if (bItem.catGroup && list[j].catGroup === bItem.catGroup) {
            return { a: j, b: bIdx };
          }
        }
        return { a: 1, b: 0 };
      }

      function renderHistorySelectOptionsHtml(cands, activeAid) {
        if (!cands.length) {
          return '<option value="">검색 결과 없음 (0곳)</option>';
        }
        return cands.map(function (o) {
          var oRec = organById[o.apba_id];
          var tag = isLocalOrgan(o) ? '(지방) ' : '(중앙) ';
          var subLabel = (oRec && oRec.muniName) ? (o.ministry + ' · ' + oRec.muniName) : (o.ministry || o.inst_type || o.apba_id);
          return '<option value="' + esc(o.apba_id) + '"' + (o.apba_id === activeAid ? ' selected' : '') + '>' + esc(tag + o.name + ' · ' + subLabel) + '</option>';
        }).join('');
      }

      function renderHistoryTopActsHtml(aid, rec, hasMatch) {
        if (!hasMatch || !rec) return '';
        var inCmp = state.compareIds.indexOf(aid) >= 0;
        return [
          (rec.provinceKey ? '<button type="button" class="pau-act-btn" data-jump-region="' + esc(rec.provinceKey) + '" title="' + esc(rec.provinceKey + ' 산하기관 전체 비교') + '">🗺️ ' + esc(rec.provinceShort) + ' 산하비교</button>' : ''),
          '<button type="button" class="pau-act-btn pri" data-go-visual-cmp="' + esc(aid) + '">📊 유사기관 비교분석</button>',
          '<button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(aid) + '">' + (inCmp ? '✓ 비교담김' : '+ 비교담기') + '</button>',
          '<button type="button" class="pau-act-btn" data-jump-organ="' + esc(aid) + '">↗ 독립 창</button>'
        ].join('');
      }

      function renderPortalViewLink(inst, aid, item, isLoc, label) {
        if (!item) return '';
        var tType = resolveTargetTypeFromDisc(item);
        var url = safeHttpUrl(buildOrganUrl(inst, item.dno, tType));
        if (!url) return '';
        var postAttr = (isLoc && !isErcMoisOrgan(inst)) ? (' data-cleaneye-post="' + esc(aid) + '" data-cleaneye-type="' + esc(tType) + '"') : '';
        return '<a class="pau-pill ok" href="' + esc(url) + '"' + postAttr + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 ' + esc(label || '공시원문') + '</a>';
      }

      function renderHistoryDynHtml(cands) {
        var hasQ = !!String(state.hSearch || '').trim();
        if (hasQ && !cands.length) {
          var qProv = inferProvinceFromQuery(state.hSearch);
          return [
            '<div class="pau-sec-card" style="padding:28px 16px;text-align:center;">',
            '  <div style="font-size:14px;font-weight:800;margin-bottom:6px;">「' + esc(state.hSearch) + '」 검색 조건에 해당하는 기관이 없습니다.</div>',
            '  <div style="font-size:12.5px;color:var(--pau-muted);margin-bottom:12px;">검색 범위(중앙/지방)를 「구분 전체」로 바꾸거나 검색어를 초기화해 보세요.</div>',
            '  <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">',
            '    <button type="button" class="pau-act-btn pri" data-h-clear-search>검색 초기화</button>',
            (qProv ? '    <button type="button" class="pau-act-btn" data-jump-region="' + esc(qProv) + '">🗺️ ' + esc(qProv) + ' 산하기관 비교로 이동</button>' : ''),
            '  </div>',
            '</div>'
          ].join('');
        }

        var aid = state.hOrgan || defaultOrganAid;
        var inst = instMap[aid] || safeInsts[0] || { apba_id: aid, name: aid };
        aid = inst.apba_id;
        state.hOrgan = aid;
        var rec = organById[aid] || organRecords[0];

        var timelineAll = buildOrganTimeline(data, aid);
        var timeline = timelineAll.filter(function (t) {
          if (!state.hCatFilter) return true;
          return t.catGroup === state.hCatFilter;
        });

        var onlyAgreements = timelineAll.filter(function (t) { return t.catGroup === 'AGREEMENT'; });
        var agreementsForCompare = onlyAgreements.length >= 2
          ? onlyAgreements
          : timelineAll.filter(function (t) {
              return t.catGroup === 'AGREEMENT' || t.catGroup === 'SEPARATE' || t.catGroup === 'RULE' || t.catGroup === 'STATUS';
            });
        if (agreementsForCompare.length < 2) agreementsForCompare = timelineAll.slice();

        var maxCmpIdx = Math.max(0, agreementsForCompare.length - 1);
        var defPair = pickDefaultComparePair(agreementsForCompare);
        var idxB = Math.min(Math.max(0, Number(state.hVerB != null ? state.hVerB : defPair.b)), maxCmpIdx);
        var idxA = Math.min(Math.max(0, Number(state.hVerA != null ? state.hVerA : defPair.a)), maxCmpIdx);
        var verA = agreementsForCompare[idxA] || null;
        var verB = agreementsForCompare[idxB] || null;

        var allRevs = normalizeRevisionsList(data.revisions && data.revisions[aid]);
        function isRevMatchVersion(rev, ver) {
          if (!rev || !ver) return false;
          if (worth(rev.dno) && worth(ver.dno) && String(rev.dno) === String(ver.dno)) return true;
          if (/^\d{4}-\d{2}-\d{2}$/.test(rev.date) && rev.date === ver.date) return true;
          return false;
        }
        var revList = allRevs.slice().sort(function (ra, rb) {
          var ma = (isRevMatchVersion(ra, verA) || isRevMatchVersion(ra, verB)) ? 1 : 0;
          var mb = (isRevMatchVersion(rb, verA) || isRevMatchVersion(rb, verB)) ? 1 : 0;
          return mb - ma;
        });
        var totalDiffCount = revList.reduce(function (acc, r) { return acc + (r.diffs ? r.diffs.length : 0); }, 0);

        var similars = findSimilarOrgans(data, aid, state.hSimMode || 'ALL');
        var topPeerRecs = similars.slice(0, 2).map(function (s) { return organById[s.apba_id]; }).filter(Boolean);
        var sectorBench = benchmarks.bySector[rec.sectorCode] || benchmarks.ALL;
        var sectorPool = organRecords.filter(function (r) { return r.sectorCode === rec.sectorCode; });

        var isLoc = isLocalOrgan(inst);
        var inCmp = state.compareIds.indexOf(aid) >= 0;
        var bannerProv = rec.provinceKey || inferProvinceFromQuery(state.hSearch);
        var orgArticles = (rec.domains && rec.domains.articles) ? rec.domains.articles : [];
        var curSub = state.hSubTab || 'OVERVIEW';
        if (!/^(OVERVIEW|HISTORY|ISSUES|PEERS|CHART)$/.test(curSub)) curSub = 'OVERVIEW';

        var kpiUnionVal = rec.hasUnion ? (rec.unionStructLabel + ' · ' + fmtNum(rec.unionCount) + '개') : '노조 미설립';
        var kpiUnionSub = rec.hasUnion
          ? ((rec.repUnion.confederation || '미가입') + ' · ' + (rec.repUnion.union_name || '단위노조'))
          : '취업규칙 · 노사협의회 적용';
        var kpiMemVal = rec.hasUnion ? (fmtNum(rec.memberTotal) + '명 (' + fmtPct(rec.orgRate) + ')') : '0명 (—)';
        var kpiMemSub = rec.eligibleCount ? ('가입대상 ' + fmtNum(rec.eligibleCount) + '명 기준') : '가입대상 인원 미기재';
        var kpiToVal = rec.timeoffHours
          ? (fmtNum(rec.timeoffHours) + 'h (' + fmtPct(rec.timeoffLimitPct) + ')')
          : (rec.hasUnion ? '0h (미기재)' : '해당없음');
        var kpiToSub = rec.legalTimeoffLimit
          ? ('법정한도 ' + fmtNum(rec.legalTimeoffLimit) + 'h · 풀' + fmtNum(rec.timeoffFull) + '·파트' + fmtNum(rec.timeoffPart))
          : '조합원 규모별 법정한도 적용';
        var kpiDocVal = '공시 ' + fmtNum(timelineAll.length) + '건' + (totalDiffCount ? (' · 대비 ' + fmtNum(totalDiffCount) + '조항') : '');
        var kpiDocSub = '유사기관 ' + fmtNum(similars.length) + '곳 · 추출조문 ' + fmtNum(orgArticles.length) + '건';

        var subBodyHtml = '';
        if (curSub === 'OVERVIEW') {
          subBodyHtml = renderOrganSixDomainsBoard(rec, false, inCmp, sectorBench, { hideHeader: true });
        } else if (curSub === 'HISTORY') {
          var revCardsHtml = revList.length ? revList.map(function (rev, rIdx) {
            var isSelectedMatch = isRevMatchVersion(rev, verA) || isRevMatchVersion(rev, verB);
            return [
              '<div class="pau-sec-card">',
              '  <div class="pau-sec-tit">',
              '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
              '      <span>📌 ' + (isSelectedMatch ? '⭐ ' : '') + '신·구 조문 대비표' + (revList.length > 1 ? (' #' + (rIdx + 1)) : '') + ' — ' + esc(rev.title) + '</span>',
              '      <span class="pau-pill fktu">기준일 ' + esc(rev.date) + ' · ' + fmtNum(rev.diffs.length) + '개 조항</span>',
              '    </div>',
              '    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">' + renderCompactFilePills(rev.files, '대비표 원문') + '</div>',
              '  </div>',
              (rev.summaryBullets && rev.summaryBullets.length ? [
                '  <div class="pau-bullet-box">',
                '    <div style="font-size:12px;font-weight:800;color:var(--pau-pri);">📋 주요 개정 요약</div>',
                '    <ul class="pau-bullet-list">',
                rev.summaryBullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join(''),
                '    </ul>',
                '  </div>'
              ].join('') : ''),
              (rev.diffs && rev.diffs.length ? [
                '  <div class="pau-diff-list">',
                '    <div class="pau-diff-hd">',
                '      <div>개정 조문 · 사유</div>',
                '      <div>⏪ 종전 협약 (개정 전)</div>',
                '      <div>⏩ 현행 협약 (개정 후)</div>',
                '    </div>',
                rev.diffs.map(function (d, dIdx) {
                  return [
                    '    <div class="pau-diff-row">',
                    '      <div class="pau-diff-art">',
                    '        <span>' + (dIdx + 1) + '. ' + esc(d.art) + '</span>',
                    (worth(d.note) ? '        <span class="pau-pill" style="align-self:flex-start;">' + esc(d.note) + '</span>' : ''),
                    '      </div>',
                    '      <div class="pau-diff-old"><span class="pau-diff-mbl">⏪ 종전 협약 (개정 전)</span>' + esc(d.before) + '</div>',
                    '      <div class="pau-diff-new"><span class="pau-diff-mbl">⏩ 현행 협약 (개정 후)</span>' + esc(d.after) + '</div>',
                    '    </div>'
                  ].join('');
                }).join(''),
                '  </div>'
              ].join('') : ''),
              '</div>'
            ].join('');
          }).join('') : '';

          var abCompareHtml = (verA && verB) ? [
            '<div class="pau-sec-card">',
            '  <div class="pau-sec-tit">',
            '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
            '      <span>⚖️ 시점별 협약 · 공시 대조 (과거 A ↔ 현행 B)</span>',
            (idxA === idxB && agreementsForCompare.length >= 2
              ? '      <span class="pau-pill multi">동일 시점 문서 선택됨</span>'
              : (verA.ccode && verB.ccode && String(verA.ccode) === String(verB.ccode)
                  ? '      <span class="pau-pill ok">동일 분류(' + esc(verB.cname) + ') 시점 대조</span>'
                  : '      <span class="pau-pill">선택 문서 1:1 대조</span>')),
            '    </div>',
            '  </div>',
            '  <div class="pau-ab-grid">',
            '    <div class="pau-ab-card">',
            '      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">',
            '        <span class="pau-pill">⏪ 비교 시점 A (과거)</span>',
            '        <span style="font-size:11.5px;color:var(--pau-muted);font-weight:700;">' + esc(verA.date) + '</span>',
            '      </div>',
            '      <select class="pau-ab-sel" data-f="hVerA" aria-label="과거 임단협 시점 A 선택">',
            agreementsForCompare.map(function (a, idx) {
              return '<option value="' + idx + '"' + (idx === idxA ? ' selected' : '') + '>' + esc('[' + a.date + '] ' + a.title + ' (' + a.cname + ')') + '</option>';
            }).join(''),
            '      </select>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">문서 명칭</span><b style="color:var(--pau-txt);">' + esc(verA.title) + '</b></div>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">분류 · 기준일</span><span><span class="pau-pill">' + esc(verA.cname) + '</span> ' + esc(verA.date) + '</span></div>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">대상 · 유효기간</span><span>' + esc((verA.union ? (verA.union + ' · ') : '') + (verA.period || verA.date)) + '</span></div>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">주요 내용</span><span>' + esc(verA.summary || '첨부 원문 참조') + '</span></div>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">원문 · 공시</span><div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">' +
              renderCompactFilePills(verA.files, '과거A 원문') +
              renderPortalViewLink(inst, aid, verA, isLoc, '공시원문') +
              (!verA.files.length && !safeHttpUrl(buildOrganUrl(inst, verA.dno, resolveTargetTypeFromDisc(verA))) ? '—' : '') +
            '</div></div>',
            '    </div>',
            '    <div class="pau-ab-card cur">',
            '      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">',
            '        <span class="pau-pill fktu">⏩ 비교 시점 B (현행)</span>',
            '        <span style="font-size:11.5px;color:var(--pau-pri);font-weight:800;">' + esc(verB.date) + '</span>',
            '      </div>',
            '      <select class="pau-ab-sel" data-f="hVerB" aria-label="현행 임단협 시점 B 선택">',
            agreementsForCompare.map(function (b, idx) {
              return '<option value="' + idx + '"' + (idx === idxB ? ' selected' : '') + '>' + esc('[' + b.date + '] ' + b.title + ' (' + b.cname + ')') + '</option>';
            }).join(''),
            '      </select>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">문서 명칭</span><b style="color:var(--pau-pri);">' + esc(verB.title) + '</b></div>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">분류 · 기준일</span><span><span class="pau-pill fktu">' + esc(verB.cname) + '</span> ' + esc(verB.date) + '</span></div>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">대상 · 유효기간</span><span>' + esc((verB.union ? (verB.union + ' · ') : '') + (verB.period || verB.date)) + '</span></div>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">주요 내용</span><span>' + esc(verB.summary || '첨부 원문 참조') + '</span></div>',
            '      <div class="pau-ab-row"><span class="pau-ab-lbl">원문 · 공시</span><div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">' +
              renderCompactFilePills(verB.files, '현행B 원문') +
              renderPortalViewLink(inst, aid, verB, isLoc, '공시원문') +
              (!verB.files.length && !safeHttpUrl(buildOrganUrl(inst, verB.dno, resolveTargetTypeFromDisc(verB))) ? '—' : '') +
            '</div></div>',
            '    </div>',
            '  </div>',
            '</div>'
          ].join('') : '';

          var timelineCardHtml = [
            '<div class="pau-sec-card">',
            '  <div class="pau-sec-tit">',
            '    <span>📅 전체 공시 · 협약 · 사규 연혁 타임라인 (' + fmtNum(timeline.length) + '건)</span>',
            '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
            '      <select class="pau-ab-sel" data-f="hCatFilter" aria-label="연혁 구분 필터" style="width:auto;">',
            '        <option value=""' + (!state.hCatFilter ? ' selected' : '') + '>연혁 전체 (' + timelineAll.length + '건)</option>',
            '        <option value="AGREEMENT"' + (state.hCatFilter === 'AGREEMENT' ? ' selected' : '') + '>단체협약·임금협약</option>',
            '        <option value="SEPARATE"' + (state.hCatFilter === 'SEPARATE' ? ' selected' : '') + '>별도합의·노사협의</option>',
            '        <option value="STATUS"' + (state.hCatFilter === 'STATUS' ? ' selected' : '') + '>노조·타임오프 현황</option>',
            '        <option value="RULE"' + (state.hCatFilter === 'RULE' ? ' selected' : '') + '>취업규칙·내부규정</option>',
            '      </select>',
            '    </div>',
            '  </div>',
            '  <div class="pau-tbl-wrap" style="max-height:340px;">',
            '    <table class="pau-tbl">',
            '      <thead><tr><th class="c-no">№</th><th style="width:12%;">기준일</th><th style="width:13%;">영역 분류</th><th style="width:23%;">문서 제목</th><th style="width:22%;">주요 내용 요약</th><th style="width:12%;">시점 지정</th><th style="width:18%;">첨부 · 공시</th></tr></thead>',
            '      <tbody>',
            (timeline.length ? timeline.map(function (t, i) {
              var cmpIdx = agreementsForCompare.findIndex(function (x) { return x.id === t.id; });
              var isA = verA && verA.id === t.id;
              var isB = verB && verB.id === t.id;
              var filePillsHtml = renderCompactFilePills(t.files, '원문');
              var portalHtml = renderPortalViewLink(inst, aid, t, isLoc, '공시');
              return [
                '<tr' + ((isA || isB) ? ' style="background:var(--pau-pri-bg);"' : '') + '>',
                '  <td class="c-no">' + (i + 1) + '</td>',
                '  <td style="font-weight:700;"><span class="pau-pill">' + esc(t.year) + '</span> ' + esc(t.date) + '</td>',
                '  <td><span class="pau-pill ' + (t.catGroup === 'AGREEMENT' ? 'fktu' : (t.catGroup === 'SEPARATE' ? 'multi' : 'ok')) + '">' + esc(t.cname) + '</span></td>',
                '  <td title="' + esc(t.title) + '" style="font-weight:700;">' + esc(t.title) + '</td>',
                '  <td title="' + esc(t.summary) + '">' + esc(t.summary || '—') + '</td>',
                '  <td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">',
                (cmpIdx >= 0 ? '<button type="button" class="pau-act-btn' + (isA ? ' pri' : '') + '" aria-pressed="' + (isA ? 'true' : 'false') + '" data-set-vera="' + cmpIdx + '">과거A' + (isA ? '✓' : '') + '</button>' : ''),
                (cmpIdx >= 0 ? '<button type="button" class="pau-act-btn' + (isB ? ' pri' : '') + '" aria-pressed="' + (isB ? 'true' : 'false') + '" data-set-verb="' + cmpIdx + '">현행B' + (isB ? '✓' : '') + '</button>' : ''),
                '  </div></td>',
                '  <td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' + filePillsHtml + portalHtml + (!filePillsHtml && !portalHtml ? '—' : '') + '</div></td>',
                '</tr>'
              ].join('');
            }).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--pau-muted);">해당 영역 분류의 연혁 문서가 없습니다.</td></tr>'),
            '      </tbody>',
            '    </table>',
            '  </div>',
            '</div>'
          ].join('');

          subBodyHtml = revCardsHtml + abCompareHtml + timelineCardHtml;
        } else if (curSub === 'ISSUES') {
          var latestCaDoc = (rec.domains && rec.domains.caDiscs && rec.domains.caDiscs[0]) || null;
          var latestWageDoc = (rec.domains && rec.domains.wageDiscs && rec.domains.wageDiscs[0]) || null;
          subBodyHtml = [
            '<div class="pau-sec-card">',
            '  <div class="pau-sec-tit">',
            '    <span>⚖️ 13대 핵심 근로조건 표준 진단 — 종합 ' + rec.totalScore + '점 (업종평균 ' + sectorBench.totalScore + '점)</span>',
            '    <button type="button" class="pau-act-btn pri" data-go-visual-cmp="' + esc(aid) + '">📊 유사기관과 13대 쟁점 병렬 대조 ↗</button>',
            '  </div>',
            '  <div class="pau-issue-detail-grid">',
            METRIC_DEFS.map(function (def, idx) {
              var sc = rec.issueScores[def.key] || { level: 2, score: 50, tag: '기준확인', val: '—', art: '', snip: '' };
              return [
                '    <div class="pau-issue-card">',
                '      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">',
                '        <b style="font-size:13px;color:var(--pau-txt);">' + (idx + 1) + '. ' + esc(def.label) + '</b>',
                '        <span class="pau-pill pau-hm-cell lv' + sc.level + '" style="font-weight:800;">' + esc(sc.tag) + ' · ' + sc.score + '점</span>',
                '      </div>',
                '      <div style="font-size:12.5px;font-weight:700;color:var(--pau-txt);">' + esc(sc.val) + (worth(sc.art) ? ' <span style="font-weight:600;color:var(--pau-pri);">(' + esc(sc.art) + ')</span>' : '') + '</div>',
                (worth(sc.snip) ? '      <div style="font-size:12px;color:var(--pau-sub);line-height:1.55;background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:6px;padding:6px 9px;">' + esc(sc.snip) + '</div>' : ''),
                '      <div style="font-size:11px;color:var(--pau-muted);margin-top:auto;">⚖️ 관련법령: ' + esc(def.lawTitle) + '</div>',
                '    </div>'
              ].join('');
            }).join(''),
            '  </div>',
            '</div>',
            '<div class="pau-sec-card">',
            '  <div class="pau-sec-tit">',
            '    <span>📜 수록 단체협약 · 사규 주요 조문 원문 (' + fmtNum(orgArticles.length) + '건)</span>',
            '    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">',
            (latestCaDoc ? renderCompactFilePills(latestCaDoc.files, '단협 전문') : ''),
            (latestWageDoc ? renderCompactFilePills(latestWageDoc.files, '임협 전문') : ''),
            '    </div>',
            '  </div>',
            (orgArticles.length ? [
              '  <div class="pau-issue-detail-grid">',
              orgArticles.map(function (a) {
                return [
                  '    <div class="pau-issue-card">',
                  '      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
                  '        <span class="pau-pill fktu">' + esc(a.taxonomy_name || '기타') + '</span>',
                  '        <b style="font-size:13px;color:var(--pau-txt);">' + esc(a.article_no || '조문') + (worth(a.article_title) ? (' (' + esc(a.article_title) + ')') : '') + '</b>',
                  '      </div>',
                  '      <div style="font-size:12.5px;line-height:1.6;color:var(--pau-sub);">' + esc(a.text) + '</div>',
                  '    </div>'
                ].join('');
              }).join(''),
              '  </div>'
            ].join('') : [
              '  <div class="pau-dom-empty" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">',
              '    <span>이 기관의 단체협약·임금협약은 HWP·PDF 첨부파일 원문 형태로 공시되어 있습니다. 오른쪽 버튼에서 전문을 바로 열람할 수 있습니다.</span>',
              '    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">' +
                (latestCaDoc ? renderCompactFilePills(latestCaDoc.files, '단협 원문') : '') +
                renderPortalViewLink(inst, aid, latestCaDoc || timelineAll[0], isLoc, '공시포털 원문') +
              '    </div>',
              '  </div>'
            ].join('')),
            '</div>'
          ].join('');
        } else if (curSub === 'PEERS') {
          subBodyHtml = [
            '<div class="pau-sec-card">',
            '  <div class="pau-sec-tit">',
            '    <span>🏛️ 유사 공공기관 추천 (' + fmtNum(similars.length) + '곳)</span>',
            '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
            '      <select class="pau-ab-sel" data-f="hSimMode" aria-label="유사기관 추천 기준 선택" style="width:auto;">',
            '        <option value="ALL"' + (state.hSimMode === 'ALL' ? ' selected' : '') + '>유사 기준: 종합 추천</option>',
            '        <option value="SECTOR"' + (state.hSimMode === 'SECTOR' ? ' selected' : '') + '>동종 업종 (' + esc(rec.sectorLabel) + ')</option>',
            '        <option value="MINISTRY"' + (state.hSimMode === 'MINISTRY' ? ' selected' : '') + '>동일 소관·지자체 (' + esc(inst.ministry || '') + ')</option>',
            '        <option value="TYPE"' + (state.hSimMode === 'TYPE' ? ' selected' : '') + '>동일 기관유형 (' + esc(inst.inst_type || '') + ')</option>',
            '      </select>',
            '      <button type="button" class="pau-act-btn pri" data-go-visual-cmp="' + esc(aid) + '">📊 상위 유사기관 비교분석</button>',
            '    </div>',
            '  </div>',
            '  <div class="pau-tbl-wrap" style="max-height:380px;">',
            '    <table class="pau-tbl">',
            '      <thead><tr><th class="c-no">№</th><th style="width:20%;">기관명 · 소관 (클릭→별개 창)</th><th style="width:13%;">권역 · 유형</th><th style="width:15%;">대표노조 · 상급</th><th style="width:10%;">조합원 · 조직률</th><th style="width:9%;">타임오프</th><th style="width:17%;">유사 선정 사유 · 점수</th><th style="width:16%;">비교담기 · 상세</th></tr></thead>',
            '      <tbody>',
            (similars.length ? similars.map(function (sim, idx) {
              var sRec = organById[sim.apba_id];
              var sInCmp = state.compareIds.indexOf(sim.apba_id) >= 0;
              var sRep = (sim.unions || [])[0] || {};
              var simOrgFull = sim.name + (sim.ministry ? ' (' + sim.ministry + ')' : '');
              return [
                '<tr>',
                '  <td class="c-no">' + (idx + 1) + '</td>',
                '  <td title="' + esc(simOrgFull) + '"><a href="pu-alio-union.html?organ=' + encodeURIComponent(sim.apba_id) + '" data-jump-organ="' + esc(sim.apba_id) + '" style="color:var(--pau-pri);font-weight:700;text-decoration:none;">↗ ' + esc(simOrgFull) + '</a></td>',
                '  <td><span class="pau-pill ' + (isLocalOrgan(sim.apba_id) ? 'loc' : '') + '">' + (isLocalOrgan(sim.apba_id) ? '지방' : '중앙') + '</span> ' + esc(sim.inst_type || '') + '</td>',
                '  <td><span class="pau-pill ' + confedClass(sRep.confederation) + '">' + esc(sRep.confederation || '미가입') + '</span> ' + esc(sRep.union_name || '—') + '</td>',
                '  <td class="c-num">' + fmtNum(sim.memberTotal) + '명' + (sRec ? (' (' + Math.round(sRec.orgRate) + '%)') : '') + '</td>',
                '  <td class="c-num">' + (sim.timeoffHours ? fmtNum(sim.timeoffHours) + 'h' : '—') + '</td>',
                '  <td><span class="pau-pill fktu">' + sim.score + '점</span> ' + esc((sim.reasons || []).join(' · ')) + '</td>',
                '  <td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' +
                  '<button type="button" class="pau-act-btn' + (sInCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(sim.apba_id) + '">' + (sInCmp ? '✓비교담김' : '+비교담기') + '</button>' +
                  '<button type="button" class="pau-act-btn" data-open-organ-here="' + esc(sim.apba_id) + '">🔎 열기</button>' +
                '</div></td>',
                '</tr>'
              ].join('');
            }).join('') : '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--pau-muted);">선택한 추천 기준에 해당하는 유사기관이 없습니다.</td></tr>'),
            '      </tbody>',
            '    </table>',
            '  </div>',
            '</div>'
          ].join('');
        } else {
          subBodyHtml = [
            '<div class="pau-sec-card">',
            '  <div class="pau-sec-tit">',
            '    <span>📈 동종업종(' + esc(rec.sectorLabel) + ') 평균 및 유사기관 그래프 진단</span>',
            '    <button type="button" class="pau-act-btn pri" data-go-visual-cmp="' + esc(aid) + '">📊 비교분석 탭에서 다중기관 확장 ↗</button>',
            '  </div>',
            '  <div class="pau-vis-grid">',
            '    <div class="pau-card">',
            '      <div class="pau-card-hd"><span>🕸️ 6대 영역 프로파일 레이더 비교 (기준 vs 유사기관 vs 업종평균)</span></div>',
            renderRadarChartSvg([rec].concat(topPeerRecs), sectorBench),
            '    </div>',
            '    <div class="pau-card">',
            '      <div class="pau-card-hd"><span>🔵 동종업종(' + esc(rec.sectorLabel) + ') 조합원 규모 ↔ 타임오프 위치 진단</span></div>',
            renderScatterTimeoffSvg(sectorPool, [rec].concat(topPeerRecs)),
            '    </div>',
            '  </div>',
            renderGroupedKpiBarsHtml([rec].concat(topPeerRecs), sectorBench),
            '</div>'
          ].join('');
        }

        return [
          (hasQ ? '<div class="pau-subbar" style="margin-bottom:8px;"><span>🔎 「<b>' + esc(state.hSearch) + '</b>」 검색 일치 기관 <b>' + fmtNum(cands.length) + '곳</b> 중 <b>' + esc(rec.name) + '</b> 선택됨 (상단 드롭다운에서 전환 가능)</span>' + (bannerProv ? '<button type="button" class="pau-act-btn pri" data-jump-region="' + esc(bannerProv) + '">🗺️ ' + esc(bannerProv) + ' 산하기관(' + fmtNum(provinceCounts[bannerProv] || 0) + '곳) 전체 비교 →</button>' : '') + '</div>' : ''),
          '<div class="pau-org-hero">',
          '  <div class="pau-hero-top">',
          '    <div>',
          '      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
          '        <span class="pau-pill ' + (isLoc ? 'loc' : 'fktu') + '">' + esc(rec.scopeLabel) + '</span>',
          '        <span class="pau-pill">' + esc(rec.sectorLabel) + '</span>',
          '        <span class="pau-pill">기관코드 ' + esc(aid) + '</span>',
          '      </div>',
          '      <h2 class="pau-hero-tit">' + esc(rec.name) + '</h2>',
          '      <div class="pau-hero-sub">' + esc(rec.ministry + ' · ' + rec.inst_type + (rec.muniName ? (' · ' + rec.muniName) : '')) + '</div>',
          '    </div>',
          '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
          '      <span class="pau-pill ok" style="font-size:12.5px;padding:4px 10px;">종합 ' + rec.totalScore + '점 · 업종평균 ' + sectorBench.totalScore + '점</span>',
          '    </div>',
          '  </div>',
          '  <div class="pau-hero-kpis">',
          '    <div class="pau-hero-kpi"><div class="pau-hero-kpi-lbl">노조 체계 · 대표노조</div><div class="pau-hero-kpi-val" title="' + esc(kpiUnionVal) + '">' + esc(kpiUnionVal) + '</div><div class="pau-hero-kpi-sub" title="' + esc(kpiUnionSub) + '">' + esc(kpiUnionSub) + '</div></div>',
          '    <div class="pau-hero-kpi"><div class="pau-hero-kpi-lbl">합산 조합원 · 조직률</div><div class="pau-hero-kpi-val" title="' + esc(kpiMemVal) + '">' + esc(kpiMemVal) + '</div><div class="pau-hero-kpi-sub" title="' + esc(kpiMemSub) + '">' + esc(kpiMemSub) + '</div></div>',
          '    <div class="pau-hero-kpi"><div class="pau-hero-kpi-lbl">연간 타임오프 · 한도대비</div><div class="pau-hero-kpi-val" title="' + esc(kpiToVal) + '">' + esc(kpiToVal) + '</div><div class="pau-hero-kpi-sub" title="' + esc(kpiToSub) + '">' + esc(kpiToSub) + '</div></div>',
          '    <div class="pau-hero-kpi"><div class="pau-hero-kpi-lbl">수록 공시 · 신구대비</div><div class="pau-hero-kpi-val" title="' + esc(kpiDocVal) + '">' + esc(kpiDocVal) + '</div><div class="pau-hero-kpi-sub" title="' + esc(kpiDocSub) + '">' + esc(kpiDocSub) + '</div></div>',
          '  </div>',
          '  <div class="pau-hero-nav" id="pauOrganSubCard" role="group" aria-label="기관 세부 분석 전환">',
          '    <button type="button" class="pau-hero-tab' + (curSub === 'OVERVIEW' ? ' on' : '') + '" aria-pressed="' + (curSub === 'OVERVIEW' ? 'true' : 'false') + '" data-h-sub="OVERVIEW">📋 6대영역 요약</button>',
          '    <button type="button" class="pau-hero-tab' + (curSub === 'HISTORY' ? ' on' : '') + '" aria-pressed="' + (curSub === 'HISTORY' ? 'true' : 'false') + '" data-h-sub="HISTORY">🔄 신·구대비·연혁 (' + fmtNum(timelineAll.length) + ')</button>',
          '    <button type="button" class="pau-hero-tab' + (curSub === 'ISSUES' ? ' on' : '') + '" aria-pressed="' + (curSub === 'ISSUES' ? 'true' : 'false') + '" data-h-sub="ISSUES">⚖️ 13대쟁점·조문 (' + fmtNum(13 + orgArticles.length) + ')</button>',
          '    <button type="button" class="pau-hero-tab' + (curSub === 'PEERS' ? ' on' : '') + '" aria-pressed="' + (curSub === 'PEERS' ? 'true' : 'false') + '" data-h-sub="PEERS">🏛️ 유사기관 (' + fmtNum(similars.length) + ')</button>',
          '    <button type="button" class="pau-hero-tab' + (curSub === 'CHART' ? ' on' : '') + '" aria-pressed="' + (curSub === 'CHART' ? 'true' : 'false') + '" data-h-sub="CHART">📈 업종그래프</button>',
          '  </div>',
          '</div>',
          subBodyHtml
        ].join('');
      }

      var candidateOrgans = computeHistoryCandidates();
      var activeAid = state.hOrgan || defaultOrganAid;
      var activeRec = organById[activeAid] || organRecords[0];
      var hasMatchNow = !String(state.hSearch || '').trim() || candidateOrgans.length > 0;

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select data-f="hScope" aria-label="기관 검색 범위">',
        '    <option value="ALL"' + (state.hScope === 'ALL' ? ' selected' : '') + '>구분 전체 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.hScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙 ALIO</option>',
        '    <option value="LOCAL_ALL"' + (state.hScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방 전체 (' + fmtNum(localInstCount) + '곳)</option>',
        '    <option value="LOCAL_ERC_MOIS"' + (state.hScope === 'LOCAL_ERC_MOIS' ? ' selected' : '') + '>🏛️ 평가원·행안부 유관 (6곳)</option>',
        '    <option value="LOCAL_CORP"' + (state.hScope === 'LOCAL_CORP' ? ' selected' : '') + '>🚇 지방공사·공단</option>',
        '    <option value="LOCAL_AFFIL"' + (state.hScope === 'LOCAL_AFFIL' ? ' selected' : '') + '>🏢 지방출자·출연</option>',
        '  </select>',
        '  <input type="search" data-f="hSearch" aria-label="분석할 기관명·지역 검색" placeholder="기관·지역 검색" value="' + esc(state.hSearch) + '" style="min-width:165px;max-width:220px;">',
        '  <select data-f="hOrgan" aria-label="분석 대상 기관 선택" style="min-width:240px;font-weight:700;">',
        renderHistorySelectOptionsHtml(candidateOrgans, activeAid),
        '  </select>',
        '  <div data-h-top-acts style="display:flex;align-items:center;gap:6px;margin-left:auto;flex-wrap:wrap;">',
        renderHistoryTopActsHtml(activeAid, activeRec, hasMatchNow),
        '  </div>',
        '</div>',
        '<div data-h-dyn>' + renderHistoryDynHtml(candidateOrgans) + '</div>'
      ].join('');

      function bindHistoryDynEvents() {
        var dynEl = bodyEl.querySelector('[data-h-dyn]');
        if (!dynEl) return;
        Array.prototype.forEach.call(dynEl.querySelectorAll('select[data-f]'), function (sel) {
          sel.addEventListener('change', function () {
            var k = sel.getAttribute('data-f');
            state[k] = sel.value;
            renderTabOrganHistory();
            var next = bodyEl.querySelector('[data-f="' + k + '"]');
            if (next && typeof next.focus === 'function') next.focus();
          });
        });
        Array.prototype.forEach.call(dynEl.querySelectorAll('[data-set-vera]'), function (b) {
          b.addEventListener('click', function () {
            var rawA = b.getAttribute('data-set-vera') || '0';
            state.hVerA = Number(rawA);
            renderTabOrganHistory();
            var nextA = bodyEl.querySelector('[data-set-vera="' + rawA + '"]');
            if (nextA && typeof nextA.focus === 'function') nextA.focus();
          });
        });
        Array.prototype.forEach.call(dynEl.querySelectorAll('[data-set-verb]'), function (b) {
          b.addEventListener('click', function () {
            var rawB = b.getAttribute('data-set-verb') || '0';
            state.hVerB = Number(rawB);
            renderTabOrganHistory();
            var nextB = bodyEl.querySelector('[data-set-verb="' + rawB + '"]');
            if (nextB && typeof nextB.focus === 'function') nextB.focus();
          });
        });
        var clrBtn = dynEl.querySelector('[data-h-clear-search]');
        if (clrBtn) {
          clrBtn.addEventListener('click', function () {
            state.hSearch = '';
            state.hScope = 'ALL';
            renderTabOrganHistory();
          });
        }
      }

      function updateHistorySearch() {
        var nextCands = computeHistoryCandidates(true);
        var nextAid = state.hOrgan || defaultOrganAid;
        var nextRec = organById[nextAid] || organRecords[0];
        var nextHasMatch = !String(state.hSearch || '').trim() || nextCands.length > 0;
        var organSel = bodyEl.querySelector('select[data-f="hOrgan"]');
        if (organSel) {
          organSel.innerHTML = renderHistorySelectOptionsHtml(nextCands, nextAid);
          if (nextHasMatch) organSel.value = nextAid;
        }
        var topActsEl = bodyEl.querySelector('[data-h-top-acts]');
        if (topActsEl) {
          topActsEl.innerHTML = renderHistoryTopActsHtml(nextAid, nextRec, nextHasMatch);
        }
        var dynEl = bodyEl.querySelector('[data-h-dyn]');
        if (dynEl) {
          dynEl.innerHTML = renderHistoryDynHtml(nextCands);
          bindHistoryDynEvents();
        }
      }

      // 상단 필터 바의 select[data-f="hScope"], select[data-f="hOrgan"], input[data-f="hSearch"]만 바인딩 (dyn 내부 select 중복 바인딩 방지)
      var topFlt = bodyEl.querySelector('.pau-flt');
      if (topFlt) {
        Array.prototype.forEach.call(topFlt.querySelectorAll('select[data-f]'), function (sel) {
          sel.addEventListener('change', function () {
            var k = sel.getAttribute('data-f');
            state[k] = sel.value;
            if (k === 'hOrgan') {
              state.hCatFilter = '';
              state.hVerA = null;
              state.hVerB = null;
            }
            renderTabOrganHistory();
            var next = bodyEl.querySelector('[data-f="' + k + '"]');
            if (next && typeof next.focus === 'function') next.focus();
          });
        });
      }
      bindFilterInputs(renderTabOrganHistory, { hSearch: function () { updateHistorySearch(); syncUrlState(); } }, '.pau-flt input[data-f]');
      bindHistoryDynEvents();
      syncUrlState();
    }

    // ════════════════════════════════════════════════════════════════════════
    // 탭 3: 다중 기관 그래프 · 히트맵 비교분석 & 지역·지자체 산하기관 전수비교 & 쟁점 목록
    // ════════════════════════════════════════════════════════════════════════
    var allLocalAffilCount = organRecords.filter(function (r) { return !!r.provinceKey; }).length;

    function renderMatrixSubModeSegHtml() {
      return [
        '<div class="pau-seg" role="group" aria-label="비교분석 보기 전환">',
        '  <button type="button" class="pau-seg-btn' + (state.mSubMode === 'STUDIO' ? ' on' : '') + '" aria-pressed="' + (state.mSubMode === 'STUDIO' ? 'true' : 'false') + '" data-m-submode="STUDIO">📊 다중비교</button>',
        '  <button type="button" class="pau-seg-btn' + (state.mSubMode === 'REGION' ? ' on' : '') + '" aria-pressed="' + (state.mSubMode === 'REGION' ? 'true' : 'false') + '" data-m-submode="REGION">🗺️ 지역산하비교</button>',
        '  <button type="button" class="pau-seg-btn' + (state.mSubMode === 'ALL_LIST' ? ' on' : '') + '" aria-pressed="' + (state.mSubMode === 'ALL_LIST' ? 'true' : 'false') + '" data-m-submode="ALL_LIST">⚖️ 쟁점목록</button>',
        '</div>'
      ].join('');
    }

    function bindMatrixSubModeButtons() {
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-m-submode]'), function (b) {
        b.addEventListener('click', function () {
          var nextMode = b.getAttribute('data-m-submode') || 'STUDIO';
          state.mSubMode = nextMode;
          renderCompareTray();
          renderTabMatrix();
          var nextBtn = bodyEl.querySelector('[data-m-submode="' + nextMode + '"]');
          if (nextBtn && typeof nextBtn.focus === 'function') nextBtn.focus();
        });
      });
    }

    function filterRegionalOrgans() {
      var curProv = state.rProvince || '충청남도';
      var hasMultiProvs = state.rMultiMode && state.rMultiProvs.length >= 2;
      var hasMultiMunis = state.rMultiMode && !hasMultiProvs && curProv !== 'ALL' && state.rMultiMunis.length >= 2;
      var curHqLabel = (!hasMultiProvs && curProv !== 'ALL' && PROVINCE_BY_KEY[curProv]) ? (PROVINCE_BY_KEY[curProv].short + ' 본청') : '';
      var list = organRecords.filter(function (r) {
        if (!r.provinceKey) return false;
        if (hasMultiProvs) {
          if (state.rMultiProvs.indexOf(r.provinceKey) === -1) return false;
        } else {
          if (curProv !== 'ALL' && r.provinceKey !== curProv) return false;
          if (hasMultiMunis) {
            var mk = r.muniName || curHqLabel;
            if (state.rMultiMunis.indexOf(mk) === -1) return false;
          } else if (curProv !== 'ALL' && state.rMuni && r.muniName !== state.rMuni) {
            return false;
          }
        }
        if (state.rTypeGroup && !matchOrganScope(r.inst, state.rTypeGroup)) return false;
        if (state.rUnionFilter === 'has_union' && !r.hasUnion) return false;
        if (state.rUnionFilter === 'multi' && (!r.hasUnion || !r.isMulti)) return false;
        if (state.rUnionFilter === 'no_union' && r.hasUnion) return false;
        if (!matchSmartQuery(r.searchHaystack, state.rQuery)) return false;
        return true;
      });

      var rs = state.rSort || 'members_desc';
      list.sort(function (a, b) {
        if (rs === 'muni_asc' || rs === 'muni_desc') {
          if (rs === 'muni_asc' && curProv !== 'ALL') {
            var aHq = !!(a.muniName && a.muniName.indexOf('본청') >= 0);
            var bHq = !!(b.muniName && b.muniName.indexOf('본청') >= 0);
            if (aHq !== bHq) return aHq ? -1 : 1;
          }
          var aj = (a.provinceShort ? a.provinceShort + ' ' : '') + (a.muniName || a.ministry || '');
          var bj = (b.provinceShort ? b.provinceShort + ' ' : '') + (b.muniName || b.ministry || '');
          var jc = aj.localeCompare(bj, 'ko');
          if (jc !== 0) return rs === 'muni_asc' ? jc : -jc;
          if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (rs === 'name_asc') return a.name.localeCompare(b.name, 'ko');
        if (rs === 'name_desc') return b.name.localeCompare(a.name, 'ko');
        if (rs === 'union_desc' || rs === 'union_asc') {
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (rs === 'union_desc') {
            if (b.unionCount !== a.unionCount) return b.unionCount - a.unionCount;
            if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
          } else {
            if (a.unionCount !== b.unionCount) return a.unionCount - b.unionCount;
            var au = (a.repUnion && a.repUnion.union_name) || '';
            var bu = (b.repUnion && b.repUnion.union_name) || '';
            var uc = au.localeCompare(bu, 'ko');
            if (uc !== 0) return uc;
          }
          return a.name.localeCompare(b.name, 'ko');
        }
        if (rs === 'orgrate_desc' || rs === 'orgrate_asc') {
          if ((a.orgRate > 0) !== (b.orgRate > 0)) return b.orgRate > 0 ? 1 : -1;
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (a.orgRate !== b.orgRate) return rs === 'orgrate_asc' ? (a.orgRate - b.orgRate) : (b.orgRate - a.orgRate);
          if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (rs === 'timeoff_desc' || rs === 'timeoff_asc') {
          var aHasTo = a.timeoffHours > 0;
          var bHasTo = b.timeoffHours > 0;
          if (aHasTo !== bHasTo) return bHasTo ? 1 : -1;
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (a.timeoffHours !== b.timeoffHours) return rs === 'timeoff_asc' ? (a.timeoffHours - b.timeoffHours) : (b.timeoffHours - a.timeoffHours);
          if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (rs === 'pers_desc' || rs === 'pers_asc') {
          var ap = ((a.issueScores.personnel_participation && a.issueScores.personnel_participation.score) || 0) + ((a.issueScores.discipline_committee && a.issueScores.discipline_committee.score) || 0);
          var bp = ((b.issueScores.personnel_participation && b.issueScores.personnel_participation.score) || 0) + ((b.issueScores.discipline_committee && b.issueScores.discipline_committee.score) || 0);
          if (ap !== bp) return rs === 'pers_asc' ? (ap - bp) : (bp - ap);
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (rs === 'leave_desc' || rs === 'leave_asc') {
          var al = ((a.issueScores.paid_holidays_leave && a.issueScores.paid_holidays_leave.score) || 0) + ((a.issueScores.work_hours_overtime && a.issueScores.work_hours_overtime.score) || 0);
          var bl = ((b.issueScores.paid_holidays_leave && b.issueScores.paid_holidays_leave.score) || 0) + ((b.issueScores.work_hours_overtime && b.issueScores.work_hours_overtime.score) || 0);
          if (al !== bl) return rs === 'leave_asc' ? (al - bl) : (bl - al);
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (rs === 'score_desc' || rs === 'score_asc') {
          if (a.totalScore !== b.totalScore) return rs === 'score_asc' ? (a.totalScore - b.totalScore) : (b.totalScore - a.totalScore);
          if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
          return a.name.localeCompare(b.name, 'ko');
        }
        if ((a.memberTotal > 0) !== (b.memberTotal > 0)) return b.memberTotal > 0 ? 1 : -1;
        if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
        if (rs === 'members_asc') {
          if (a.memberTotal !== b.memberTotal) return a.memberTotal - b.memberTotal;
          return a.name.localeCompare(b.name, 'ko');
        }
        if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
        if (b.timeoffHours !== a.timeoffHours) return b.timeoffHours - a.timeoffHours;
        if (b.discTotal !== a.discTotal) return b.discTotal - a.discTotal;
        return a.name.localeCompare(b.name, 'ko');
      });
      return list;
    }

    function getActiveCompareRecords() {
      if (!organRecords.length) return [];
      var valid = state.compareIds.map(function (id) { return organById[id]; }).filter(Boolean);
      if (valid.length >= 2) return valid.slice(0, 6);
      var baseAid = valid.length === 1 ? valid[0].aid : (state.hOrgan || defaultOrganAid);
      var baseRec = organById[baseAid] || organRecords[0];
      if (!baseRec) return [];
      var out = [baseRec];
      var sims = findSimilarOrgans(data, baseRec.aid, 'ALL');
      for (var i = 0; i < sims.length && out.length < 4; i++) {
        var pr = organById[sims[i].apba_id];
        if (pr && out.every(function (x) { return x.aid !== pr.aid; })) out.push(pr);
      }
      return out;
    }

    function filterMatrix() {
      var list = safeMetrics.filter(function (m) {
        if (m.metric_key !== state.mIssue) return false;
        var inst = instMap[m.apba_id] || { apba_id: m.apba_id, inst_type: m.inst_type };
        if (!matchOrganScope(inst, state.mScope)) return false;
        if (state.mType && m.inst_type !== state.mType) return false;
        var uList = unionsByAid[m.apba_id] || [];
        var repU = uList[0] || {};
        var cf = worth(repU.confederation) ? repU.confederation : '미가입';
        if (state.mConfed && cf !== state.mConfed) return false;
        var hay = getOrganSearchHaystack(m.apba_id, (repU.union_name || '') + ' ' + (m.metric_value || '') + ' ' + (m.snippet || '') + ' ' + (m.evidence_article || ''));
        if (!matchSmartQuery(hay, state.mQuery)) return false;
        return true;
      });
      var ms = state.mSort || 'members_desc';
      function getRepUnionRow(aid) {
        var ul = (unionsByAid[aid] || []).filter(function (u) { return u && u.union_structure !== '노조없음'; });
        return ul[0] || {};
      }
      list.sort(function (a, b) {
        if (ms === 'name_asc') return String(a.inst_name || '').localeCompare(String(b.inst_name || ''), 'ko');
        if (ms === 'name_desc') return String(b.inst_name || '').localeCompare(String(a.inst_name || ''), 'ko');
        var au = getRepUnionRow(a.apba_id);
        var bu = getRepUnionRow(b.apba_id);
        if (ms === 'union_asc' || ms === 'union_desc') {
          var aun = String(au.union_name || '');
          var bun = String(bu.union_name || '');
          if ((!!aun) !== (!!bun)) return bun ? 1 : -1;
          var unc = aun.localeCompare(bun, 'ko');
          if (unc !== 0) return ms === 'union_asc' ? unc : -unc;
          return String(a.inst_name || '').localeCompare(String(b.inst_name || ''), 'ko');
        }
        if (ms === 'val_desc' || ms === 'val_asc') {
          var as = (organById[a.apba_id] && organById[a.apba_id].issueScores[state.mIssue] && organById[a.apba_id].issueScores[state.mIssue].score) || 0;
          var bs = (organById[b.apba_id] && organById[b.apba_id].issueScores[state.mIssue] && organById[b.apba_id].issueScores[state.mIssue].score) || 0;
          if (as !== bs) return ms === 'val_asc' ? (as - bs) : (bs - as);
          var vc = String(a.metric_value || '').localeCompare(String(b.metric_value || ''), 'ko');
          if (vc !== 0) return ms === 'val_asc' ? vc : -vc;
          return String(a.inst_name || '').localeCompare(String(b.inst_name || ''), 'ko');
        }
        var am = Number(au.member_total || 0);
        var bm = Number(bu.member_total || 0);
        if ((am > 0) !== (bm > 0)) return bm > 0 ? 1 : -1;
        if (am !== bm) return ms === 'members_asc' ? (am - bm) : (bm - am);
        var ato = Number(au.timeoff_hours || 0);
        var bto = Number(bu.timeoff_hours || 0);
        if (ato !== bto) return bto - ato;
        return String(a.inst_name || '').localeCompare(String(b.inst_name || ''), 'ko');
      });
      return list;
    }

    function renderTabMatrix() {
      var def = METRIC_DEFS.find(function (d) { return d.key === state.mIssue; }) || METRIC_DEFS[0];

      // ── 1) REGION 모드: 지역별 · 기초지자체(본청/시군구)별 산하기관 전수 & 다중비교 ──
      if (state.mSubMode === 'REGION') {
        var curProv = state.rProvince || '충청남도';
        var hasMultiProvs = state.rMultiMode && state.rMultiProvs.length >= 2;
        var hasMultiMunis = state.rMultiMode && !hasMultiProvs && curProv !== 'ALL' && state.rMultiMunis.length >= 2;
        var isAllProv = !hasMultiProvs && (curProv === 'ALL');
        var provMeta = (!hasMultiProvs && !isAllProv) ? PROVINCE_BY_KEY[curProv] : null;
        var muniOptions = (!hasMultiProvs && !isAllProv) ? getMunicipalitiesForProvince(curProv) : [];

        function computeGovGroupStats(label, subsetRows, keyId) {
          var uRows = subsetRows.filter(function (r) { return r.hasUnion; });
          var cCnt = 0, aCnt = 0, dCnt = 0, memSum = 0, orgSum = 0, toSum = 0, toCnt = 0, scSum = 0;
          var persSum = 0, leaveSum = 0;
          subsetRows.forEach(function (r) {
            if (matchOrganScope(r.inst, 'LOCAL_CORP')) cCnt += 1;
            else if (matchOrganScope(r.inst, 'LOCAL_DIRECT')) dCnt += 1;
            else aCnt += 1;
            memSum += r.memberTotal;
            if (r.hasUnion) {
              orgSum += r.orgRate;
              scSum += r.totalScore;
              persSum += (((r.issueScores.personnel_participation && r.issueScores.personnel_participation.score) || 0) + ((r.issueScores.discipline_committee && r.issueScores.discipline_committee.score) || 0)) / 2;
              leaveSum += (((r.issueScores.paid_holidays_leave && r.issueScores.paid_holidays_leave.score) || 0) + ((r.issueScores.work_hours_overtime && r.issueScores.work_hours_overtime.score) || 0)) / 2;
            }
            if (r.timeoffHours > 0) { toSum += r.timeoffHours; toCnt += 1; }
          });
          var topUnionRec = uRows.slice().sort(function (a, b) { return b.memberTotal - a.memberTotal; })[0] || subsetRows[0] || null;
          return {
            key: keyId,
            label: label,
            total: subsetRows.length,
            corpCnt: cCnt,
            affilCnt: aCnt,
            directCnt: dCnt,
            unionCnt: uRows.length,
            unionPct: subsetRows.length ? Math.round((uRows.length / subsetRows.length) * 1000) / 10 : 0,
            members: memSum,
            avgOrgRate: uRows.length ? Math.round((orgSum / uRows.length) * 10) / 10 : 0,
            avgTimeoff: toCnt ? Math.round(toSum / toCnt) : 0,
            avgScore: uRows.length ? Math.round(scSum / uRows.length) : 0,
            avgPers: uRows.length ? Math.round(persSum / uRows.length) : 0,
            avgLeave: uRows.length ? Math.round(leaveSum / uRows.length) : 0,
            topOrgan: topUnionRec
          };
        }

        function renderMultiGovCompareHtml(regRows) {
          if (!hasMultiProvs && !hasMultiMunis) return '';
          var groups = [];
          if (hasMultiProvs) {
            state.rMultiProvs.forEach(function (pk) {
              var pDef = PROVINCE_BY_KEY[pk];
              var pRows = regRows.filter(function (r) { return r.provinceKey === pk; });
              groups.push(computeGovGroupStats(pDef ? (pDef.short + ' (' + pk + ')') : pk, pRows, pk));
            });
          } else if (hasMultiMunis && provMeta) {
            var hqNm = provMeta.short + ' 본청';
            state.rMultiMunis.forEach(function (mk) {
              var mRows = regRows.filter(function (r) { return (r.muniName || hqNm) === mk; });
              groups.push(computeGovGroupStats(mk, mRows, mk));
            });
          }
          if (groups.length < 2) return '';
          var maxMemG = Math.max.apply(null, groups.map(function (g) { return g.members; }).concat([0]));
          var maxOrgG = Math.max.apply(null, groups.map(function (g) { return g.avgOrgRate; }).concat([0]));
          var maxToG = Math.max.apply(null, groups.map(function (g) { return g.avgTimeoff; }).concat([0]));
          var maxScG = Math.max.apply(null, groups.map(function (g) { return g.avgScore; }).concat([0]));

          return [
            '<div class="pau-sec-card" data-r-multigov-card style="border-color:#93c5fd;">',
            '  <div class="pau-sec-tit">',
            '    <span>⚖️ ' + (hasMultiProvs ? ('선택 광역 시·도(' + groups.length + '곳)') : (esc(curProv) + ' 내 선택 기초지자체(' + groups.length + '곳)')) + ' 산하기관 총괄 다중비교</span>',
            '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
            '      <button type="button" class="pau-act-btn pri" data-r-multi-rep-cmp>📊 지자체별 대표 산하기관 레이더·조문 심층대조 ↗</button>',
            '      <button type="button" class="pau-act-btn" data-r-multi-reset>다중지자체 초기화</button>',
            '    </div>',
            '  </div>',
            '  <div class="pau-tbl-wrap" style="max-height:340px;">',
            '    <table class="pau-tbl">',
            '      <thead>',
            '        <tr>',
            '          <th class="c-no">№</th>',
            '          <th style="width:16%;">비교 지자체</th>',
            '          <th style="width:15%;">산하기관 구성</th>',
            '          <th style="width:12%;">노조보유 (설립률)</th>',
            '          <th style="width:12%;">합산 조합원</th>',
            '          <th style="width:10%;">평균 조직률</th>',
            '          <th style="width:10%;">평균 타임오프</th>',
            '          <th style="width:11%;">인사·휴가 수준</th>',
            '          <th style="width:14%;">종합점수 · 대표기관</th>',
            '        </tr>',
            '      </thead>',
            '      <tbody>',
            groups.map(function (g, idx) {
              var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
              var isTopMem = maxMemG > 0 && g.members === maxMemG;
              var isTopOrg = maxOrgG > 0 && g.avgOrgRate === maxOrgG;
              var isTopTo = maxToG > 0 && g.avgTimeoff === maxToG;
              var isTopSc = maxScG > 0 && g.avgScore === maxScG;
              return [
                '<tr>',
                '  <td class="c-no">' + (idx + 1) + '</td>',
                '  <td style="font-weight:800;border-left:3px solid ' + pal.stroke + ';">' + esc(g.label) + '</td>',
                '  <td>총 <b>' + fmtNum(g.total) + '곳</b> <span style="font-size:11px;color:var(--pau-muted);">(공단' + g.corpCnt + '·출연' + g.affilCnt + (g.directCnt ? '·직영' + g.directCnt : '') + ')</span></td>',
                '  <td class="c-num"><span class="pau-show-sm">노조보유: </span><b>' + fmtNum(g.unionCnt) + '곳</b> (' + g.unionPct + '%)</td>',
                '  <td class="c-num"' + (isTopMem ? ' style="font-weight:800;color:var(--pau-pri);background:var(--pau-pri-bg);"' : '') + '><span class="pau-show-sm">조합원: </span>' + (isTopMem ? '🏆 ' : '') + '<b>' + fmtNum(g.members) + '명</b></td>',
                '  <td class="c-num"' + (isTopOrg ? ' style="font-weight:800;color:var(--pau-pri);background:var(--pau-pri-bg);"' : '') + '><span class="pau-show-sm">평균조직률: </span>' + (isTopOrg ? '🏆 ' : '') + fmtPct(g.avgOrgRate) + '</td>',
                '  <td class="c-num"' + (isTopTo ? ' style="font-weight:800;color:var(--pau-pri);background:var(--pau-pri-bg);"' : '') + '><span class="pau-show-sm">타임오프: </span>' + (isTopTo ? '🏆 ' : '') + (g.avgTimeoff ? (fmtNum(g.avgTimeoff) + 'h') : '—') + '</td>',
                '  <td class="c-num">인사 ' + g.avgPers + ' · 휴가 ' + g.avgLeave + '점</td>',
                '  <td' + (isTopSc ? ' style="font-weight:800;color:var(--pau-pri);background:var(--pau-pri-bg);"' : '') + '><span class="pau-show-sm">종합점수: </span>' + (isTopSc ? '🏆 ' : '') + '<b>' + g.avgScore + '점</b>' + (g.topOrgan ? (' · <a href="pu-alio-union.html?organ=' + encodeURIComponent(g.topOrgan.aid) + '" data-jump-organ="' + esc(g.topOrgan.aid) + '" style="color:var(--pau-pri);text-decoration:none;font-weight:700;">↗ ' + esc(g.topOrgan.name) + '</a>') : '') + '</td>',
                '</tr>'
              ].join('');
            }).join(''),
            '      </tbody>',
            '    </table>',
            '  </div>',
            '</div>'
          ].join('');
        }

        function renderInlineRegInstCompareHtml(checkedIds) {
          var selRecs = checkedIds.map(function (id) { return organById[id]; }).filter(Boolean).slice(0, 6);
          if (selRecs.length < 2) return '';
          var maxMemS = Math.max.apply(null, selRecs.map(function (r) { return r.memberTotal; }).concat([0]));
          var maxOrgS = Math.max.apply(null, selRecs.map(function (r) { return r.orgRate; }).concat([0]));
          var maxToS = Math.max.apply(null, selRecs.map(function (r) { return r.timeoffHours; }).concat([0]));
          var maxScS = Math.max.apply(null, selRecs.map(function (r) { return r.totalScore; }).concat([0]));
          var cmpIssueRows = [
            { key: 'personnel_participation', label: '인사원칙 노조 관여' },
            { key: 'discipline_committee', label: '징계위원회 구성·재심' },
            { key: 'work_hours_overtime', label: '근로시간·유연근무' },
            { key: 'paid_holidays_leave', label: '유급휴일·경조휴가' },
            { key: 'maternity_childcare', label: '모성보호·육아휴직' },
            { key: 'retirement_age_peak', label: '정년·임금피크·고용' }
          ];
          return [
            '<div class="pau-sec-card" data-r-inline-cmp style="border-color:#2563eb;box-shadow:0 2px 8px rgba(37,99,235,.08);">',
            '  <div class="pau-sec-tit">',
            '    <span>⚖️ 선택 산하기관(' + selRecs.length + '곳) 즉석 다중비교 매트릭스</span>',
            '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
            '      <button type="button" class="pau-act-btn pri" data-r-go-studio>📊 레이더·산점도 심층비교 ↗</button>',
            '      <button type="button" class="pau-act-btn" data-r-go-clauses>📚 선택 기관 조문 병렬비교 →</button>',
            '      <button type="button" class="pau-act-btn" data-r-sync-tray>📥 비교함 담기</button>',
            '      <button type="button" class="pau-act-btn" data-r-clr-ck>✕ 선택 해제</button>',
            '    </div>',
            '  </div>',
            '  <div class="pau-tbl-wrap" style="max-height:420px;">',
            '    <table class="pau-tbl">',
            '      <thead>',
            '        <tr>',
            '          <th style="width:16%;">비교 항목</th>',
            selRecs.map(function (r, idx) {
              var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
              return '<th style="border-bottom:3px solid ' + pal.stroke + ';"><a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="color:var(--pau-pri);text-decoration:none;font-weight:800;">↗ ' + esc(r.name) + '</a></th>';
            }).join(''),
            '        </tr>',
            '      </thead>',
            '      <tbody>',
            '        <tr><td style="font-weight:700;">소속 지자체 · 유형</td>' + selRecs.map(function (r) {
              var jt = (r.provinceShort || '') + (r.muniName ? ' · ' + r.muniName : '');
              return '<td title="' + esc(jt + ' (' + r.inst_type + ')') + '"><span class="pau-show-sm" style="font-weight:800;">' + esc(r.name) + ': </span><span class="pau-pill loc">' + esc(jt || r.ministry) + '</span> ' + esc(r.inst_type) + '</td>';
            }).join('') + '</tr>',
            '        <tr><td style="font-weight:700;">노조체계 · 대표노조</td>' + selRecs.map(function (r) {
              var ut = r.hasUnion ? ('[' + (r.isMulti ? ('복수' + r.unionCount) : r.repConfed) + '] ' + (r.repUnion ? r.repUnion.union_name : '노동조합')) : '미설립·사규운영';
              return '<td title="' + esc(ut) + '"><span class="pau-show-sm" style="font-weight:800;">' + esc(r.name) + ': </span>' + esc(ut) + '</td>';
            }).join('') + '</tr>',
            '        <tr><td style="font-weight:700;">합산 조합원 · 조직률</td>' + selRecs.map(function (r) {
              var isTop = maxMemS > 0 && r.memberTotal === maxMemS;
              var isTopO = maxOrgS > 0 && r.orgRate === maxOrgS;
              var mt = r.hasUnion ? (fmtNum(r.memberTotal) + '명 (' + fmtPct(r.orgRate) + ')') : '—';
              return '<td' + (isTop || isTopO ? ' style="font-weight:800;color:var(--pau-pri);background:var(--pau-pri-bg);"' : '') + '><span class="pau-show-sm" style="font-weight:800;">' + esc(r.name) + ': </span>' + (isTop ? '🏆 ' : '') + esc(mt) + '</td>';
            }).join('') + '</tr>',
            '        <tr><td style="font-weight:700;">연간 타임오프 (한도%)</td>' + selRecs.map(function (r) {
              var isTop = maxToS > 0 && r.timeoffHours === maxToS;
              var tt = r.timeoffHours > 0 ? (fmtNum(r.timeoffHours) + 'h (' + fmtPct(r.timeoffLimitPct) + ')') : (r.hasUnion ? '비전임' : '—');
              return '<td' + (isTop ? ' style="font-weight:800;color:var(--pau-pri);background:var(--pau-pri-bg);"' : '') + '><span class="pau-show-sm" style="font-weight:800;">' + esc(r.name) + ': </span>' + (isTop ? '🏆 ' : '') + esc(tt) + '</td>';
            }).join('') + '</tr>',
            cmpIssueRows.map(function (ir) {
              return '<tr><td style="font-weight:700;">' + esc(ir.label) + '</td>' + selRecs.map(function (r) {
                var sc = r.issueScores[ir.key] || { tag: '기본', val: '—', level: 2 };
                return '<td class="pau-hm-cell lv' + sc.level + '" title="' + esc('[' + sc.tag + '] ' + sc.val) + '"><span class="pau-show-sm" style="font-weight:800;">' + esc(r.name) + ': </span><b>[' + esc(sc.tag) + ']</b> ' + esc(sc.val) + '</td>';
              }).join('') + '</tr>';
            }).join(''),
            '        <tr><td style="font-weight:700;">6대영역 종합 · 바로가기</td>' + selRecs.map(function (r) {
              var isTop = maxScS > 0 && r.totalScore === maxScS;
              var sUrl = safeHttpUrl(buildOrganUrl(r.inst));
              var pAttr = (!isErcMoisOrgan(r.inst)) ? (' data-cleaneye-post="' + esc(r.aid) + '" data-cleaneye-type="union_info"') : '';
              return '<td style="white-space:normal;' + (isTop ? 'background:var(--pau-pri-bg);' : '') + '"><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;"><span class="pau-show-sm" style="font-weight:800;">' + esc(r.name) + ': </span><b style="color:var(--pau-pri);">' + (isTop ? '🏆 ' : '') + r.totalScore + '점</b> <button type="button" class="pau-act-btn" data-open-organ-here="' + esc(r.aid) + '">🔎 상세</button>' + (sUrl ? (' <a class="pau-pill ok" href="' + esc(sUrl) + '"' + pAttr + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">원문</a>') : '') + '</div></td>';
            }).join('') + '</tr>',
            '      </tbody>',
            '    </table>',
            '  </div>',
            '</div>'
          ].join('');
        }

        function renderRegionDynHtml() {
          var regRows = filterRegionalOrgans();
          var unionRegRows = regRows.filter(function (r) { return r.hasUnion; });
          var corpCnt = 0;
          var affilCnt = 0;
          var directCnt = 0;
          var totalMembers = 0;
          var orgRateSum = 0;
          var toSum = 0;
          var toCnt = 0;
          var scoreSum = 0;
          regRows.forEach(function (r) {
            if (matchOrganScope(r.inst, 'LOCAL_CORP')) corpCnt += 1;
            else if (matchOrganScope(r.inst, 'LOCAL_DIRECT')) directCnt += 1;
            else affilCnt += 1;
            totalMembers += r.memberTotal;
            if (r.hasUnion) {
              orgRateSum += r.orgRate;
              scoreSum += r.totalScore;
            }
            if (r.timeoffHours > 0) {
              toSum += r.timeoffHours;
              toCnt += 1;
            }
          });
          var avgOrgRate = unionRegRows.length ? (Math.round((orgRateSum / unionRegRows.length) * 10) / 10) : 0;
          var avgTimeoff = toCnt ? Math.round(toSum / toCnt) : 0;
          var avgScore = unionRegRows.length ? Math.round(scoreSum / unionRegRows.length) : 0;
          var natLocalBench = benchmarks.LOCAL_ALL || benchmarks.ALL;

          // 좌측 비교 막대 대상 (노조 보유 산하기관 우선, 없으면 전체 산하기관 상위)
          var chartRows = unionRegRows.length ? unionRegRows.slice(0, 40) : regRows.slice(0, 25);
          var maxChartMem = 50;
          chartRows.forEach(function (r) { if (r.memberTotal > maxChartMem) maxChartMem = r.memberTotal; });

          // 우측 지자체 분포 집계 (다중 시·도 선택 시 선택된 시·도 비교, 단일 시·도 선택 시 본청 vs 시·군·구, 전국 선택 시 16개 시·도)
          var breakdownItems = [];
          var maxBreakCnt = 1;
          if (!hasMultiProvs && !isAllProv && provMeta) {
            var hqName = provMeta.short + ' 본청';
            var muniStatMap = Object.create(null);
            organRecords.forEach(function (r) {
              if (r.provinceKey !== curProv) return;
              if (state.rTypeGroup && !matchOrganScope(r.inst, state.rTypeGroup)) return;
              if (state.rUnionFilter === 'has_union' && !r.hasUnion) return;
              if (state.rUnionFilter === 'multi' && (!r.hasUnion || !r.isMulti)) return;
              if (state.rUnionFilter === 'no_union' && r.hasUnion) return;
              if (!matchSmartQuery(r.searchHaystack, state.rQuery)) return;
              var mk = r.muniName || hqName;
              if (!muniStatMap[mk]) muniStatMap[mk] = { key: mk, label: mk, total: 0, unionCnt: 0, members: 0 };
              muniStatMap[mk].total += 1;
              if (r.hasUnion) muniStatMap[mk].unionCnt += 1;
              muniStatMap[mk].members += r.memberTotal;
            });
            breakdownItems = Object.keys(muniStatMap).map(function (k) { return muniStatMap[k]; });
            breakdownItems.sort(function (a, b) {
              var aHq = (a.key === hqName || a.key.indexOf('본청') >= 0);
              var bHq = (b.key === hqName || b.key.indexOf('본청') >= 0);
              if (aHq !== bHq) return aHq ? -1 : 1;
              if (b.total !== a.total) return b.total - a.total;
              return a.label.localeCompare(b.label, 'ko');
            });
          } else {
            PROVINCE_DEFS.forEach(function (p) {
              if (hasMultiProvs && state.rMultiProvs.indexOf(p.key) === -1) return;
              var tot = 0;
              var uCnt = 0;
              var mem = 0;
              organRecords.forEach(function (r) {
                if (r.provinceKey !== p.key) return;
                if (state.rTypeGroup && !matchOrganScope(r.inst, state.rTypeGroup)) return;
                if (state.rUnionFilter === 'has_union' && !r.hasUnion) return;
                if (state.rUnionFilter === 'multi' && (!r.hasUnion || !r.isMulti)) return;
                if (state.rUnionFilter === 'no_union' && r.hasUnion) return;
                if (!matchSmartQuery(r.searchHaystack, state.rQuery)) return;
                tot += 1;
                if (r.hasUnion) uCnt += 1;
                mem += r.memberTotal;
              });
              if (tot > 0) breakdownItems.push({ key: p.key, label: p.short + ' (' + p.key.slice(0, 4) + ')', total: tot, unionCnt: uCnt, members: mem, isProv: true });
            });
            breakdownItems.sort(function (a, b) { return b.total - a.total; });
          }
          breakdownItems.forEach(function (it) { if (it.total > maxBreakCnt) maxBreakCnt = it.total; });

          var checkedRegIds = Object.keys(state.rChecked).filter(function (k) { return !!state.rChecked[k] && !!organById[k]; });
          var tableLimit = 350;
          var shownRegRows = regRows.slice(0, tableLimit);
          var regionTitleLabel = hasMultiProvs
            ? (state.rMultiProvs.map(function (pk) { return PROVINCE_BY_KEY[pk] ? PROVINCE_BY_KEY[pk].short : pk; }).join(' · ') + ' (' + state.rMultiProvs.length + '개 시·도 다중비교)')
            : (isAllProv
              ? '전국 16개 시·도 지방산하기관'
              : (curProv + (hasMultiMunis ? (' · ' + state.rMultiMunis.join('·')) : (state.rMuni ? (' · ' + state.rMuni) : ' 전체'))));

          return {
            rows: regRows,
            html: [
              renderMultiGovCompareHtml(regRows),
              // ① 상단 지역 산하기관 한눈 그래프 비교 카드
              '<div class="pau-sec-card">',
              '  <div class="pau-sec-tit">',
              '    <span>🗺️ ① ' + esc(regionTitleLabel) + ' 산하기관 현황 한눈에 그래프 비교</span>',
              '    <span style="font-size:12px;color:var(--pau-sub);font-weight:600;">산하 <b>' + fmtNum(regRows.length) + '곳</b> (공사·공단 ' + corpCnt + ' · 출자·출연 ' + affilCnt + ' · 직영 ' + directCnt + ') · 노조보유 <b>' + fmtNum(unionRegRows.length) + '곳</b> · 조합원 <b>' + fmtNum(totalMembers) + '명</b> · 평균 조직률 <b>' + avgOrgRate + '%</b> · 타임오프 <b>' + fmtNum(avgTimeoff) + 'h</b></span>',
              '  </div>',
              '  <div class="pau-vis-grid">',
              '    <div class="pau-card">',
              '      <div class="pau-card-hd"><span>📊 산하기관별 조합원 · 조직률 · 타임오프 · 종합점수 비교 (' + fmtNum(chartRows.length) + '곳)</span><span class="pau-pill loc">지역평균 ' + (avgScore || natLocalBench.totalScore) + '점 / 전국지방 ' + natLocalBench.totalScore + '점</span></div>',
              '      <div style="max-height:285px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding-right:3px;">',
              (chartRows.length ? chartRows.map(function (r) {
                var memW = r.hasUnion ? Math.max(5, Math.round((r.memberTotal / maxChartMem) * 100)) : 0;
                var scW = Math.max(8, Math.min(100, r.totalScore));
                var jurTag = (!hasMultiProvs && !isAllProv) ? (r.muniName || r.provinceShort) : (r.provinceShort + (r.muniName && r.muniName.indexOf('본청') === -1 ? '·' + r.muniName : ''));
                return [
                  '<div style="background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:7px;padding:5px 8px;display:flex;flex-direction:column;gap:4px;">',
                  '  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:12px;">',
                  '    <div style="display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;">',
                  '      <span class="pau-pill">' + esc(jurTag) + '</span>',
                  '      <a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="font-weight:800;color:var(--pau-pri);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">↗ ' + esc(r.name) + '</a>',
                  '    </div>',
                  '    <span style="font-size:11.5px;font-variant-numeric:tabular-nums;white-space:nowrap;">' +
                    (r.hasUnion
                      ? ('<b>' + fmtNum(r.memberTotal) + '명</b>(' + Math.round(r.orgRate) + '%) · ' + (r.timeoffHours ? (fmtNum(r.timeoffHours) + 'h') : '비전임') + ' · <b style="color:var(--pau-pri);">' + r.totalScore + '점</b>')
                      : ('사규·공시 ' + r.discTotal + '건 · ' + r.totalScore + '점')) +
                  '</span>',
                  '  </div>',
                  '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:center;">',
                  '    <div style="height:6px;background:var(--pau-bd-lt);border-radius:999px;overflow:hidden;" title="조합원 규모 비율"><div style="width:' + memW + '%;height:100%;background:#2563eb;border-radius:999px;"></div></div>',
                  '    <div style="position:relative;height:6px;background:var(--pau-bd-lt);border-radius:999px;overflow:visible;" title="6대영역 종합점수 ' + r.totalScore + '점 (빨간선: 전국지방 평균 ' + natLocalBench.totalScore + '점)"><div style="width:' + scW + '%;height:100%;background:#059669;border-radius:999px;"></div><i style="position:absolute;left:' + Math.min(98, natLocalBench.totalScore) + '%;top:-2px;bottom:-2px;width:2px;background:#dc2626;"></i></div>',
                  '  </div>',
                  '</div>'
                ].join('');
              }).join('') : '<div style="padding:20px;text-align:center;color:var(--pau-muted);">조건에 해당하는 산하기관이 없습니다.</div>'),
              '      </div>',
              '      <div class="pau-lgd">',
              '        <span class="pau-lgd-item"><i style="background:#2563eb;"></i>좌측막대: 조합원 규모</span>',
              '        <span class="pau-lgd-item"><i style="background:#059669;"></i>우측막대: 6대영역 종합점수</span>',
              '        <span class="pau-lgd-item"><i style="background:#dc2626;width:3px;"></i>전국지방 평균선</span>',
              '      </div>',
              '    </div>',

              '    <div class="pau-card">',
              '      <div class="pau-card-hd"><span>' + ((!hasMultiProvs && !isAllProv) ? ('🏛️ ' + esc(provMeta.short) + ' 본청 · 시·군·구별 분포 (' + (state.rMultiMode ? '클릭→시·군·구 다중비교 추가' : '클릭→지자체 필터') + ')') : '🗺️ 시·도별 지방산하기관 · 노조 분포 (클릭→시·도 선택)') + '</span>' + ((state.rMuni || hasMultiMunis) ? '<button type="button" class="pau-act-btn" data-r-muni-clear>시·군·구 해제</button>' : '') + '</div>',
              '      <div style="max-height:285px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;padding-right:3px;">',
              (breakdownItems.length ? breakdownItems.map(function (it) {
                var isAct = !it.isProv && (hasMultiMunis ? (state.rMultiMunis.indexOf(it.key) >= 0) : (state.rMuni === it.key));
                var totW = Math.max(6, Math.round((it.total / maxBreakCnt) * 100));
                var uRatio = it.total ? Math.round((it.unionCnt / it.total) * totW) : 0;
                return [
                  '<button type="button" class="pau-sec-bar-btn" ' + (it.isProv ? ('data-r-prov="' + esc(it.key) + '"') : ('data-r-muni-pick="' + esc(it.key) + '"')) + ' aria-pressed="' + (isAct ? 'true' : 'false') + '" style="' + (isAct ? 'background:var(--pau-pri-bg);outline:1px solid #2563eb;' : '') + '">',
                  '  <span class="pau-sec-bar-nm">' + (isAct ? '✓ ' : '') + esc(it.label) + '</span>',
                  '  <span style="flex:1;height:10px;background:var(--pau-bd-lt);border-radius:999px;overflow:hidden;display:flex;">',
                  '    <i style="width:' + uRatio + '%;background:#2563eb;height:100%;" title="노조보유 ' + it.unionCnt + '곳"></i>',
                  '    <i style="width:' + Math.max(0, totW - uRatio) + '%;background:#93c5fd;height:100%;" title="미설립 ' + (it.total - it.unionCnt) + '곳"></i>',
                  '  </span>',
                  '  <span class="pau-sec-bar-num" style="width:128px;">산하 <b>' + it.total + '</b> · 노조 <b>' + it.unionCnt + '</b> (' + fmtNum(it.members) + '명)</span>',
                  '</button>'
                ].join('');
              }).join('') : '<div style="padding:20px;text-align:center;color:var(--pau-muted);">집계할 지자체 산하기관이 없습니다.</div>'),
              '      </div>',
              '      <div class="pau-lgd">',
              '        <span class="pau-lgd-item"><i style="background:#2563eb;"></i>노조보유 산하기관</span>',
              '        <span class="pau-lgd-item"><i style="background:#93c5fd;"></i>미설립·사규운영 산하기관</span>',
              '      </div>',
              '    </div>',
              '  </div>',
              '</div>',

              // ①-B 선택 산하기관 즉석 다중비교 보드 (2곳 이상 체크 시 바로 노출)
              renderInlineRegInstCompareHtml(checkedRegIds),

              // ② 지역 산하기관 전체 현황 · 핵심 근로조건 한눈 비교 매트릭스 표
              '<div class="pau-sec-card">',
              '  <div class="pau-sec-tit">',
              '    <span>📋 ② ' + esc(regionTitleLabel) + ' 산하기관 전체 현황 · 핵심 근로조건 한눈 비교표 (' + fmtNum(regRows.length) + '곳' + (regRows.length > tableLimit ? ' 중 상위 ' + tableLimit + '곳 표시' : ' 전수') + ')</span>',
              '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
              '      <select class="pau-sub-sort" data-r-sort aria-label="지역 산하기관 정렬 기준">',
              [
                ['members_desc', '정렬: 조합원 많은순 ▼'],
                ['members_asc', '정렬: 조합원 적은순 ▲'],
                ['orgrate_desc', '정렬: 조직률 높은순 ▼'],
                ['orgrate_asc', '정렬: 조직률 낮은순 ▲'],
                ['timeoff_desc', '정렬: 타임오프 많은순 ▼'],
                ['timeoff_asc', '정렬: 타임오프 적은순 ▲'],
                ['score_desc', '정렬: 6대영역 점수 높은순 ▼'],
                ['score_asc', '정렬: 6대영역 점수 낮은순 ▲'],
                ['pers_desc', '정렬: 인사·징계 관여 높은순 ▼'],
                ['pers_asc', '정렬: 인사·징계 관여 낮은순 ▲'],
                ['leave_desc', '정렬: 휴가·근로시간 높은순 ▼'],
                ['leave_asc', '정렬: 휴가·근로시간 낮은순 ▲'],
                ['muni_asc', '정렬: 소속 지자체 가나다 ▲'],
                ['muni_desc', '정렬: 소속 지자체 역순 ▼'],
                ['name_asc', '정렬: 산하기관명 가나다 ▲'],
                ['name_desc', '정렬: 산하기관명 역순 ▼'],
                ['union_desc', '정렬: 산하 노조수 많은순 ▼'],
                ['union_asc', '정렬: 대표노조 가나다 ▲']
              ].map(function (it) {
                var curRSort = state.rSort || 'members_desc';
                return '<option value="' + esc(it[0]) + '"' + (curRSort === it[0] ? ' selected' : '') + '>' + esc(it[1]) + '</option>';
              }).join(''),
              '      </select>',
              '      <span class="pau-hide-sm" style="font-size:11.5px;color:var(--pau-muted);">☑ 최대 6곳 선택 비교</span>',
              (checkedRegIds.length < 2 && shownRegRows.length >= 2 ? '      <button type="button" class="pau-act-btn" data-r-quick-top4>⚡ 상위 4곳 즉석 다중비교</button>' : ''),
              (checkedRegIds.length ? '      <button type="button" class="pau-act-btn" data-r-clr-ck>선택 해제 (' + checkedRegIds.length + ')</button>' : ''),
              '      <button type="button" class="pau-act-btn pri" data-r-go-studio>📊 ' + (checkedRegIds.length ? ('선택 ' + checkedRegIds.length + '곳') : '대표 산하기관(최대 6곳)') + ' 레이더·조문 심층대조 ↗</button>',
              '    </div>',
              '  </div>',
              '  <div class="pau-tbl-wrap" style="max-height:540px;">',
              '    <table class="pau-tbl">',
              '      <thead>',
              '        <tr>',
              '          <th class="c-ck" title="다중비교 최대 한도(상위 6곳) 일괄 선택·해제"><label class="pau-ck-lbl" title="다중비교 최대 한도(상위 6곳) 일괄 선택·해제"><input type="checkbox" data-r-ck-all aria-label="상위 6개 산하기관 전체 선택"' + (shownRegRows.length && shownRegRows.slice(0, 6).every(function (r) { return !!state.rChecked[r.aid]; }) ? ' checked' : '') + '></label></th>',
              '          <th class="c-no">№</th>',
              '          ' + renderSortTh('9%', '소속 지자체', 'r_muni', state.rSort || 'members_desc', ['muni_asc', 'muni_desc']),
              '          ' + renderSortTh('16%', '산하기관명 · 유형 (클릭→별개 창)', 'r_name', state.rSort || 'members_desc', ['name_asc', 'name_desc']),
              '          ' + renderSortTh('13%', '노조체계 · 대표노조', 'r_union', state.rSort || 'members_desc', ['union_desc', 'union_asc']),
              '          ' + renderSortTh('10%', '조합원 · 조직률', 'r_members', state.rSort || 'members_desc', ['members_desc', 'members_asc', 'orgrate_desc', 'orgrate_asc']),
              '          ' + renderSortTh('9%', '타임오프(한도%)', 'r_timeoff', state.rSort || 'members_desc', ['timeoff_desc', 'timeoff_asc']),
              '          ' + renderSortTh('11%', '인사 · 징계 관여', 'r_pers', state.rSort || 'members_desc', ['pers_desc', 'pers_asc']),
              '          ' + renderSortTh('11%', '휴가 · 근로시간', 'r_leave', state.rSort || 'members_desc', ['leave_desc', 'leave_asc']),
              '          ' + renderSortTh('10%', '임금 · 정년 · 점수', 'r_score', state.rSort || 'members_desc', ['score_desc', 'score_asc']),
              '          <th style="width:11%;">비교 · 상세 · 원문</th>',
              '        </tr>',
              '      </thead>',
              '      <tbody>',
              (shownRegRows.length ? shownRegRows.map(function (r, idx) {
                var isCk = !!state.rChecked[r.aid];
                var inCmp = state.compareIds.indexOf(r.aid) >= 0;
                var jurText = (hasMultiProvs || isAllProv) ? (r.provinceShort + (r.muniName ? '·' + r.muniName : '')) : (r.muniName || (provMeta ? provMeta.short + ' 본청' : r.ministry));
                var typeShort = matchOrganScope(r.inst, 'LOCAL_CORP') ? '공사·공단' : (matchOrganScope(r.inst, 'LOCAL_DIRECT') ? '직영기업' : '출자·출연');
                var scPers = r.issueScores.personnel_participation || { tag: '기본', val: '—', level: 2 };
                var scDisc = r.issueScores.discipline_committee || { tag: '기본', val: '—', level: 2 };
                var scLeave = r.issueScores.paid_holidays_leave || { tag: '기본', val: '—', level: 2 };
                var scWork = r.issueScores.work_hours_overtime || { tag: '기본', val: '—', level: 2 };
                var scPeak = r.issueScores.retirement_age_peak || { tag: '기본', val: '—', level: 2 };
                var scWage = r.issueScores.wage_bonus_allowance || { tag: '기본', val: '—', level: 2 };
                var persTxt = scPers.tag + ' / 징계:' + scDisc.tag;
                var workTxt = scLeave.tag + ' / 시간:' + scWork.tag;
                var wageTxt = scPeak.tag + ' · ' + r.totalScore + '점';
                var safeUrl = safeHttpUrl(buildOrganUrl(r.inst));
                var postAttr = (!isErcMoisOrgan(r.inst)) ? (' data-cleaneye-post="' + esc(r.aid) + '" data-cleaneye-type="union_info"') : '';
                return [
                  '<tr' + (isCk || inCmp ? ' style="background:var(--pau-pri-bg);"' : '') + '>',
                  '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-r-ck="' + esc(r.aid) + '" aria-label="' + esc(r.name + ' 다중비교 선택') + '"' + (isCk ? ' checked' : '') + '></label></td>',
                  '  <td class="c-no">' + (idx + 1) + '</td>',
                  '  <td title="' + esc(r.ministry + ' · ' + jurText) + '"><span class="pau-pill ' + (jurText.indexOf('본청') >= 0 ? 'loc' : '') + '">' + esc(jurText) + '</span></td>',
                  '  <td title="' + esc(r.name + ' (' + r.inst_type + ')') + '"><a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="color:var(--pau-pri);font-weight:800;text-decoration:none;">↗ ' + esc(r.name) + '</a> <span style="font-size:11px;color:var(--pau-muted);">(' + esc(typeShort) + ')</span></td>',
                  '  <td title="' + esc(r.unionStructLabel + (r.repUnion ? (' · ' + r.repUnion.union_name) : '')) + '">' +
                    (r.hasUnion
                      ? ('<span class="pau-pill ' + (r.isMulti ? 'multi' : confedClass(r.repConfed)) + '">' + esc(r.isMulti ? ('복수' + r.unionCount) : r.repConfed) + '</span> ' + esc(r.repUnion ? r.repUnion.union_name : '노동조합'))
                      : '<span style="color:var(--pau-muted);">미설립·사규</span>') +
                  '</td>',
                  '  <td class="c-num">' + (r.hasUnion ? ('<span class="pau-mini-meter"><i style="width:' + Math.min(100, r.orgRate) + '%;"></i></span><b>' + fmtNum(r.memberTotal) + '명</b>(' + Math.round(r.orgRate) + '%)') : '—') + '</td>',
                  '  <td class="c-num">' + (r.timeoffHours > 0 ? ('<b>' + fmtNum(r.timeoffHours) + 'h</b>(' + Math.round(r.timeoffLimitPct) + '%)') : (r.hasUnion ? '비전임' : '—')) + '</td>',
                  '  <td class="pau-hm-cell lv' + Math.max(scPers.level, scDisc.level) + '" title="' + esc('인사: ' + scPers.val + ' / 징계: ' + scDisc.val) + '">' + esc(persTxt) + '</td>',
                  '  <td class="pau-hm-cell lv' + Math.max(scLeave.level, scWork.level) + '" title="' + esc('휴가: ' + scLeave.val + ' / 근로시간: ' + scWork.val) + '">' + esc(workTxt) + '</td>',
                  '  <td class="pau-hm-cell lv' + Math.max(scPeak.level, scWage.level) + '" title="' + esc('임금: ' + scWage.val + ' / 정년: ' + scPeak.val + ' / 6대영역 종합 ' + r.totalScore + '점') + '"><b>' + esc(wageTxt) + '</b></td>',
                  '  <td style="white-space:normal;"><div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap;">' +
                    '<button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(r.aid) + '" title="비교함에 담기 (타 지역·중앙기관과 교차비교)">' + (inCmp ? '✓비교' : '+비교') + '</button>' +
                    '<button type="button" class="pau-act-btn" data-open-organ-here="' + esc(r.aid) + '" title="6대영역 상세 열기" aria-label="' + esc(r.name + ' 상세 열기') + '">🔎</button>' +
                    (safeUrl ? '<a class="pau-pill ok" href="' + esc(safeUrl) + '"' + postAttr + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;" title="클린아이 공시원문 열기">원문</a>' : '') +
                  '</div></td>',
                  '</tr>'
                ].join('');
              }).join('') : '<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--pau-muted);">선택한 지역·지자체 조건에 해당하는 산하기관이 없습니다.</td></tr>'),
              '      </tbody>',
              '    </table>',
              '  </div>',
              '</div>'
            ].join('')
          };
        }

        var initRegDyn = renderRegionDynHtml();

        bodyEl.innerHTML = [
          '<div class="pau-sec-card" style="padding:8px 10px;">',
          '  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
          '    ' + renderMatrixSubModeSegHtml(),
          '    <select data-f="rProvince" aria-label="광역 시·도 지자체 선택" style="font-weight:800;max-width:235px;">',
          '      <option value="ALL"' + (isAllProv ? ' selected' : '') + '>🗺️ 전국 16개 시·도 산하 전체 (' + fmtNum(allLocalAffilCount) + '곳)</option>',
          PROVINCE_DEFS.map(function (p) {
            return '<option value="' + esc(p.key) + '"' + (!isAllProv && curProv === p.key ? ' selected' : '') + '>' + esc(p.key + ' (' + p.short + ' · 산하 ' + fmtNum(provinceCounts[p.key] || 0) + '곳 · 노조 ' + fmtNum(provinceUnionCounts[p.key] || 0) + '곳)') + '</option>';
          }).join(''),
          '    </select>',
          (!hasMultiProvs && !isAllProv ? [
            '    <select data-f="rMuni" aria-label="본청·기초지자체 시·군·구 선택" style="max-width:175px;">',
            '      <option value="">본청 · 시/군/구 전체 (' + fmtNum(provinceCounts[curProv] || 0) + '곳)</option>',
            muniOptions.map(function (m) {
              return '<option value="' + esc(m.name) + '"' + (state.rMuni === m.name ? ' selected' : '') + '>' + esc(m.name + ' (' + m.count + '곳)') + '</option>';
            }).join(''),
            '    </select>'
          ].join('') : ''),
          '    <select data-f="rTypeGroup" aria-label="산하기관 유형 분류" style="max-width:130px;">',
          '      <option value=""' + (!state.rTypeGroup ? ' selected' : '') + '>산하유형 전체</option>',
          '      <option value="LOCAL_CORP"' + (state.rTypeGroup === 'LOCAL_CORP' ? ' selected' : '') + '>🚇 지방공사·공단</option>',
          '      <option value="LOCAL_AFFIL"' + (state.rTypeGroup === 'LOCAL_AFFIL' ? ' selected' : '') + '>🏢 지방출자·출연</option>',
          '      <option value="LOCAL_DIRECT"' + (state.rTypeGroup === 'LOCAL_DIRECT' ? ' selected' : '') + '>💧 지방직영기업</option>',
          '    </select>',
          '    <select data-f="rUnionFilter" aria-label="노조 보유 필터" style="max-width:130px;">',
          '      <option value=""' + (!state.rUnionFilter ? ' selected' : '') + '>노조유무 전체</option>',
          '      <option value="has_union"' + (state.rUnionFilter === 'has_union' ? ' selected' : '') + '>👥 노조보유 산하만</option>',
          '      <option value="multi"' + (state.rUnionFilter === 'multi' ? ' selected' : '') + '>🔀 복수노조 산하</option>',
          '      <option value="no_union"' + (state.rUnionFilter === 'no_union' ? ' selected' : '') + '>📘 미설립·사규운영</option>',
          '    </select>',
          '    <input type="search" data-f="rQuery" aria-label="산하기관명·시군구 검색" placeholder="산하기관·시군구 검색" value="' + esc(state.rQuery) + '" style="min-width:148px;max-width:195px;flex:1 1 148px;">',
          '  </div>',
          '  <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:6px;padding-top:6px;border-top:1px dashed var(--pau-bd-lt);">',
          '    <button type="button" class="pau-act-btn' + (state.rMultiMode ? ' pri' : '') + '" aria-pressed="' + (state.rMultiMode ? 'true' : 'false') + '" data-r-multi-toggle title="여러 시·도 또는 여러 시·군·구를 동시에 선택하여 총괄 비교합니다">⚖️ 지자체 다중비교' + (state.rMultiMode ? ' ON' : '') + '</button>',
          '    <button type="button" class="pau-act-btn' + (!state.rMultiMode && isAllProv ? ' pri' : '') + '" aria-pressed="' + (!state.rMultiMode && isAllProv ? 'true' : 'false') + '" data-r-prov="ALL">전국(' + fmtNum(allLocalAffilCount) + ')</button>',
          PROVINCE_DEFS.map(function (p) {
            var isCurP = state.rMultiMode ? (state.rMultiProvs.indexOf(p.key) >= 0) : (curProv === p.key);
            return '<button type="button" class="pau-act-btn' + (isCurP ? ' pri' : '') + '" aria-pressed="' + (isCurP ? 'true' : 'false') + '" data-r-prov="' + esc(p.key) + '">' + (state.rMultiMode && isCurP ? '✓ ' : '') + esc(p.short) + '(' + (provinceCounts[p.key] || 0) + ')</button>';
          }).join(''),
          '  </div>',
          (state.rMultiMode ? [
            '  <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:6px;padding:5px 8px;background:var(--pau-pri-bg);border-radius:7px;font-size:12px;">',
            '    <b style="color:var(--pau-pri);">💡 다중비교 선택:</b>',
            '    <span style="color:var(--pau-sub);">위 시·도 버튼(또는 우측 시·군·구 막대)을 여러 개 클릭하세요.</span>',
            '    <button type="button" class="pau-act-btn" data-r-bloc="CHUNGCHEONG">충청권 4곳(충남·대전·세종·충북)</button>',
            '    <button type="button" class="pau-act-btn" data-r-bloc="CAPITAL">수도권 3곳(서울·경기·인천)</button>',
            '    <button type="button" class="pau-act-btn" data-r-bloc="YEONGNAM">동남권 3곳(부산·울산·경남)</button>',
            '    <button type="button" class="pau-act-btn" data-r-bloc="DAEGYEONG">대경권 2곳(대구·경북)</button>',
            '    <button type="button" class="pau-act-btn" data-r-bloc="HONAM">호남권 2곳(전북·전남광주)</button>',
            '    <button type="button" class="pau-act-btn" data-r-multi-reset>다중비교 해제</button>',
            '  </div>'
          ].join('') : ''),
          '</div>',
          '<div data-m-reg-dyn>' + initRegDyn.html + '</div>'
        ].join('');

        var curRegRowsRef = initRegDyn.rows;

        function getPickedOrTopRegIds() {
          var picked = Object.keys(state.rChecked).filter(function (k) { return state.rChecked[k] && organById[k]; }).slice(0, 6);
          if (!picked.length) {
            picked = curRegRowsRef.slice(0, 6).map(function (r) { return r.aid; });
          }
          return picked;
        }

        function bindRegionDynEvents() {
          var dynEl = bodyEl.querySelector('[data-m-reg-dyn]');
          if (!dynEl) return;
          Array.prototype.forEach.call(dynEl.querySelectorAll('[data-r-muni-pick]'), function (b) {
            b.addEventListener('click', function () {
              var mk = b.getAttribute('data-r-muni-pick') || '';
              if (state.rMultiMode && !hasMultiProvs) {
                var idxM = state.rMultiMunis.indexOf(mk);
                if (idxM >= 0) state.rMultiMunis.splice(idxM, 1);
                else if (state.rMultiMunis.length < 8) state.rMultiMunis.push(mk);
                state.rMuni = state.rMultiMunis.length === 1 ? state.rMultiMunis[0] : '';
              } else {
                state.rMuni = (state.rMuni === mk) ? '' : mk;
              }
              renderTabMatrix();
            });
          });
          var clrMuni = dynEl.querySelector('[data-r-muni-clear]');
          if (clrMuni) {
            clrMuni.addEventListener('click', function () {
              state.rMuni = '';
              state.rMultiMunis = [];
              renderTabMatrix();
            });
          }
          Array.prototype.forEach.call(dynEl.querySelectorAll('[data-r-prov]'), function (b) {
            b.addEventListener('click', function () {
              var pk = b.getAttribute('data-r-prov') || 'ALL';
              state.rProvince = pk;
              state.rMultiMode = false;
              state.rMultiProvs = [];
              state.rMultiMunis = [];
              state.rMuni = '';
              state.rChecked = {};
              renderTabMatrix();
            });
          });
          var repCmpBtn = dynEl.querySelector('[data-r-multi-rep-cmp]');
          if (repCmpBtn) {
            repCmpBtn.addEventListener('click', function () {
              var repIds = [];
              if (hasMultiProvs) {
                state.rMultiProvs.forEach(function (pk) {
                  var best = curRegRowsRef.find(function (r) { return r.provinceKey === pk && r.hasUnion; }) || curRegRowsRef.find(function (r) { return r.provinceKey === pk; });
                  if (best && repIds.indexOf(best.aid) === -1 && repIds.length < 6) repIds.push(best.aid);
                });
              } else if (hasMultiMunis && provMeta) {
                var hqNm2 = provMeta.short + ' 본청';
                state.rMultiMunis.forEach(function (mk) {
                  var bestM = curRegRowsRef.find(function (r) { return (r.muniName || hqNm2) === mk && r.hasUnion; }) || curRegRowsRef.find(function (r) { return (r.muniName || hqNm2) === mk; });
                  if (bestM && repIds.indexOf(bestM.aid) === -1 && repIds.length < 6) repIds.push(bestM.aid);
                });
              }
              if (repIds.length) {
                state.compareIds = repIds;
                state.mSubMode = 'STUDIO';
                renderCompareTray();
                renderTabMatrix();
              }
            });
          }
          Array.prototype.forEach.call(dynEl.querySelectorAll('[data-r-multi-reset]'), function (b) {
            b.addEventListener('click', function () {
              state.rMultiMode = false;
              state.rMultiProvs = [];
              state.rMultiMunis = [];
              renderTabMatrix();
            });
          });
          var quickTop4Btn = dynEl.querySelector('[data-r-quick-top4]');
          if (quickTop4Btn) {
            quickTop4Btn.addEventListener('click', function () {
              state.rChecked = {};
              curRegRowsRef.slice(0, 4).forEach(function (r) { state.rChecked[r.aid] = true; });
              updateRegionDyn();
            });
          }
          var ckAll = dynEl.querySelector('[data-r-ck-all]');
          if (ckAll) {
            ckAll.addEventListener('change', function () {
              state.rChecked = {};
              if (ckAll.checked) {
                curRegRowsRef.slice(0, 6).forEach(function (r) { state.rChecked[r.aid] = true; });
              }
              updateRegionDyn();
            });
          }
          Array.prototype.forEach.call(dynEl.querySelectorAll('[data-r-ck]'), function (ck) {
            ck.addEventListener('change', function () {
              var id = ck.getAttribute('data-r-ck') || '';
              if (ck.checked) {
                var cnt = Object.keys(state.rChecked).filter(function (k) { return state.rChecked[k]; }).length;
                if (cnt >= 6) {
                  var firstK = Object.keys(state.rChecked).find(function (k) { return state.rChecked[k]; });
                  if (firstK) delete state.rChecked[firstK];
                }
                state.rChecked[id] = true;
              } else {
                delete state.rChecked[id];
              }
              updateRegionDyn();
            });
          });
          Array.prototype.forEach.call(dynEl.querySelectorAll('[data-r-clr-ck]'), function (clrCkBtn) {
            clrCkBtn.addEventListener('click', function () {
              state.rChecked = {};
              updateRegionDyn();
            });
          });
          var syncTrayBtn = dynEl.querySelector('[data-r-sync-tray]');
          if (syncTrayBtn) {
            syncTrayBtn.addEventListener('click', function () {
              var picked = getPickedOrTopRegIds();
              picked.forEach(function (id) {
                if (state.compareIds.indexOf(id) === -1) {
                  if (state.compareIds.length >= 6) state.compareIds.shift();
                  state.compareIds.push(id);
                }
              });
              renderCompareTray();
              updateRegionDyn();
            });
          }
          var goClausesBtn = dynEl.querySelector('[data-r-go-clauses]');
          if (goClausesBtn) {
            goClausesBtn.addEventListener('click', function () {
              var picked = getPickedOrTopRegIds();
              if (picked.length) {
                state.compareIds = picked;
                state.docMode = 'ARTICLES';
                state.aViewMode = 'COMPARE';
                renderCompareTray();
                switchTab('articles');
              }
            });
          }
          var rSortSel = dynEl.querySelector('[data-r-sort]');
          if (rSortSel) {
            rSortSel.addEventListener('change', function () {
              state.rSort = rSortSel.value || 'members_desc';
              updateRegionDyn();
              var nextRSel = bodyEl.querySelector('[data-r-sort]');
              if (nextRSel && typeof nextRSel.focus === 'function') nextRSel.focus();
            });
          }
          Array.prototype.forEach.call(dynEl.querySelectorAll('[data-r-go-studio]'), function (goStudioBtn) {
            goStudioBtn.addEventListener('click', function () {
              var picked = getPickedOrTopRegIds();
              if (picked.length) {
                state.compareIds = picked;
                state.mSubMode = 'STUDIO';
                renderCompareTray();
                renderTabMatrix();
              }
            });
          });
        }

        function updateRegionDyn() {
          var dynEl = bodyEl.querySelector('[data-m-reg-dyn]');
          if (!dynEl) return;
          var nextRes = renderRegionDynHtml();
          curRegRowsRef = nextRes.rows;
          dynEl.innerHTML = nextRes.html;
          bindRegionDynEvents();
        }

        bindMatrixSubModeButtons();
        var multiToggleBtn = bodyEl.querySelector('[data-r-multi-toggle]');
        if (multiToggleBtn) {
          multiToggleBtn.addEventListener('click', function () {
            state.rMultiMode = !state.rMultiMode;
            if (state.rMultiMode) {
              if (!state.rMultiProvs.length && curProv !== 'ALL') {
                state.rMultiProvs = [curProv];
              }
              if (state.rMuni && !state.rMultiMunis.length) {
                state.rMultiMunis = [state.rMuni];
              }
            } else {
              if (state.rMultiProvs.length) state.rProvince = state.rMultiProvs[0];
              state.rMultiProvs = [];
              state.rMultiMunis = [];
            }
            renderTabMatrix();
            var nextToggle = bodyEl.querySelector('[data-r-multi-toggle]');
            if (nextToggle && typeof nextToggle.focus === 'function') nextToggle.focus();
          });
        }
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-r-bloc]'), function (bb) {
          bb.addEventListener('click', function () {
            var bloc = bb.getAttribute('data-r-bloc') || '';
            var blocMap = {
              CHUNGCHEONG: ['충청남도', '대전광역시', '세종특별자치시', '충청북도'],
              CAPITAL: ['서울특별시', '경기도', '인천광역시'],
              YEONGNAM: ['부산광역시', '울산광역시', '경상남도'],
              DAEGYEONG: ['대구광역시', '경상북도'],
              HONAM: ['전북특별자치도', '전남광주통합특별시']
            };
            if (blocMap[bloc]) {
              state.rMultiMode = true;
              state.rMultiProvs = blocMap[bloc].slice();
              state.rProvince = state.rMultiProvs[0];
              state.rMultiMunis = [];
              state.rMuni = '';
              state.rChecked = {};
              renderTabMatrix();
            }
          });
        });
        Array.prototype.forEach.call(bodyEl.querySelectorAll('.pau-sec-card [data-r-multi-reset]'), function (rb) {
          rb.addEventListener('click', function () {
            state.rMultiMode = false;
            state.rMultiProvs = [];
            state.rMultiMunis = [];
            renderTabMatrix();
          });
        });
        Array.prototype.forEach.call(bodyEl.querySelectorAll('.pau-sec-card > div [data-r-prov]'), function (b) {
          b.addEventListener('click', function () {
            var nextProv = b.getAttribute('data-r-prov') || 'ALL';
            if (state.rMultiMode && nextProv !== 'ALL') {
              var pIdx = state.rMultiProvs.indexOf(nextProv);
              if (pIdx >= 0) {
                if (state.rMultiProvs.length > 1) state.rMultiProvs.splice(pIdx, 1);
              } else if (state.rMultiProvs.length < 8) {
                state.rMultiProvs.push(nextProv);
              }
              state.rProvince = state.rMultiProvs[0] || nextProv;
              state.rMultiMunis = [];
              state.rMuni = '';
            } else {
              state.rMultiMode = false;
              state.rMultiProvs = [];
              state.rMultiMunis = [];
              state.rProvince = nextProv;
              state.rMuni = '';
              state.rChecked = {};
            }
            renderTabMatrix();
            var nextProvBtn = bodyEl.querySelector('.pau-sec-card > div [data-r-prov="' + nextProv + '"]');
            if (nextProvBtn && typeof nextProvBtn.focus === 'function') nextProvBtn.focus();
          });
        });
        bindFilterInputs(renderTabMatrix, { rQuery: updateRegionDyn });
        bindRegionDynEvents();
        syncUrlState();
        return;
      }

      // ── 2) ALL_LIST 모드: 13대 단일 쟁점 전체 기관 목록 ──
      if (state.mSubMode === 'ALL_LIST') {
        function renderMatrixListDynHtml() {
          var rows = filterMatrix();
          var checkedAids = Object.keys(state.mChecked).filter(function (k) { return state.mChecked[k]; });
          var selectedRows = rows.filter(function (r) { return state.mChecked[r.apba_id]; });
          return {
            rows: rows,
            checkedAids: checkedAids,
            selectedRows: selectedRows,
            html: [
              '<div class="pau-bulk' + (checkedAids.length ? ' on' : '') + '">',
              '  <span>☑️ 선택한 <b>' + fmtNum(checkedAids.length) + '곳</b> 하단 원문 대조 중</span>',
              '  <button type="button" class="pau-act-btn pri" data-m-bulk-cmp>📊 선택 기관 그래프·히트맵 비교</button>',
              '  <button type="button" class="pau-act-btn" data-m-bulk-clr>선택 해제</button>',
              '</div>',
              '<div class="pau-tbl-wrap" style="max-height:360px;">',
              '  <table class="pau-tbl">',
              '    <thead><tr><th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-m-all aria-label="상위 6개 기관 전체 선택"' + (rows.length && rows.slice(0, 6).every(function (r) { return !!state.mChecked[r.apba_id]; }) ? ' checked' : '') + '></label></th><th class="c-no">№</th>' +
                renderSortTh('18%', '기관명 (클릭→별개 창)', 'm_name', state.mSort || 'members_desc', ['name_asc', 'name_desc']) +
                renderSortTh('15%', '대표노조 · 상급', 'm_union', state.mSort || 'members_desc', ['union_asc', 'union_desc']) +
                renderSortTh('11%', '조합원 · 타임오프', 'm_members', state.mSort || 'members_desc', ['members_desc', 'members_asc']) +
                renderSortTh('18%', '단협 핵심 지표 요약', 'm_val', state.mSort || 'members_desc', ['val_desc', 'val_asc']) +
                '<th style="width:23%;">조문 발췌</th><th style="width:12%;">비교담기</th></tr></thead>',
              '    <tbody>',
              (rows.length ? rows.map(function (r, idx) {
                var inst = instMap[r.apba_id] || { apba_id: r.apba_id, inst_type: r.inst_type };
                var isLoc = isLocalOrgan(inst);
                var uList = (unionsByAid[r.apba_id] || []).filter(function (u) { return u && u.union_structure !== '노조없음'; });
                var repU = uList[0] || {};
                var inCmp = state.compareIds.indexOf(r.apba_id) >= 0;
                var isCk = !!state.mChecked[r.apba_id];
                var memFull = fmtNum(repU.member_total || 0) + '명 / ' + (repU.timeoff_hours ? fmtNum(repU.timeoff_hours) + 'h' : '—');
                var snip = String(r.snippet || '').replace(/\s+/g, ' ').trim();
                return [
                  '<tr' + (isCk ? ' style="background:var(--pau-pri-bg);"' : '') + '>',
                  '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-m-ck="' + esc(r.apba_id) + '" aria-label="' + esc(r.inst_name + ' 선택') + '"' + (isCk ? ' checked' : '') + '></label></td>',
                  '  <td class="c-no">' + (idx + 1) + '</td>',
                  '  <td><span class="pau-pill ' + (isLoc ? 'loc' : '') + '">' + (isLoc ? '지방' : '중앙') + '</span> <a href="pu-alio-union.html?organ=' + encodeURIComponent(r.apba_id) + '" data-jump-organ="' + esc(r.apba_id) + '" style="font-weight:700;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(r.inst_name) + '</a></td>',
                  '  <td><span class="pau-pill ' + confedClass(repU.confederation) + '">' + esc(repU.confederation || '미가입') + '</span> ' + esc(repU.union_name || '노동조합') + '</td>',
                  '  <td class="c-num">' + esc(memFull) + '</td>',
                  '  <td title="' + esc(r.metric_value || '') + '" style="font-weight:700;color:var(--pau-pri);">' + esc(r.metric_value || '—') + '</td>',
                  '  <td title="' + esc(snip) + '">' + esc(snip || '—') + '</td>',
                  '  <td style="white-space:normal;"><button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(r.apba_id) + '">' + (inCmp ? '✓비교' : '+비교') + '</button></td>',
                  '</tr>'
                ].join('');
              }).join('') : '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--pau-muted);">조건에 해당하는 쟁점 지표 데이터가 없습니다.</td></tr>'),
              '    </tbody>',
              '  </table>',
              '</div>',
              '<div class="pau-sbs" data-m-sbs></div>'
            ].join('')
          };
        }

        var initListRes = renderMatrixListDynHtml();

        bodyEl.innerHTML = [
          '<div class="pau-flt">',
          '  ' + renderMatrixSubModeSegHtml(),
          '  <select data-f="mIssue" aria-label="13대 핵심 단협 쟁점 선택" style="font-weight:700;">',
          METRIC_DEFS.map(function (d) {
            return '<option value="' + esc(d.key) + '"' + (state.mIssue === d.key ? ' selected' : '') + '>쟁점: ' + esc(d.label) + '</option>';
          }).join(''),
          '  </select>',
          '  <select data-f="mScope" aria-label="중앙·지방 구분">',
          '    <option value="ALL"' + (state.mScope === 'ALL' ? ' selected' : '') + '>구분 전체 (중앙+지방)</option>',
          '    <option value="CENTRAL"' + (state.mScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙 ALIO</option>',
          '    <option value="LOCAL_ALL"' + (state.mScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방 전체</option>',
          '    <option value="LOCAL_ERC_MOIS"' + (state.mScope === 'LOCAL_ERC_MOIS' ? ' selected' : '') + '>🏛️ 평가원·행안부 유관</option>',
          '  </select>',
          '  <select data-f="mType" aria-label="기관유형 선택">',
          '    <option value="">기관유형 전체</option>',
          allTypes.map(function (t) { return '<option value="' + esc(t) + '"' + (state.mType === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''),
          '  </select>',
          '  <select data-f="mConfed" aria-label="상급단체 선택">',
          '    <option value="">상급단체 전체</option>',
          allConfeds.map(function (c) { return '<option value="' + esc(c) + '"' + (state.mConfed === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join(''),
          '  </select>',
          '  <input type="search" data-f="mQuery" aria-label="쟁점 조문 검색" placeholder="기관·지역·조문 검색" value="' + esc(state.mQuery) + '" style="min-width:155px;max-width:220px;">',
          '  <select class="pau-sub-sort" data-f="mSort" aria-label="13대 쟁점 목록 정렬 기준">',
          [
            ['members_desc', '정렬: 조합원 많은순 ▼'],
            ['members_asc', '정렬: 조합원 적은순 ▲'],
            ['val_desc', '정렬: 쟁점수준 높은순 ▼'],
            ['val_asc', '정렬: 쟁점수준 낮은순 ▲'],
            ['name_asc', '정렬: 기관명 가나다 ▲'],
            ['name_desc', '정렬: 기관명 역순 ▼'],
            ['union_asc', '정렬: 대표노조 가나다 ▲'],
            ['union_desc', '정렬: 대표노조 역순 ▼']
          ].map(function (it) {
            return '<option value="' + esc(it[0]) + '"' + ((state.mSort || 'members_desc') === it[0] ? ' selected' : '') + '>' + esc(it[1]) + '</option>';
          }).join(''),
          '  </select>',
          '  <span class="pau-flt-hint" style="font-size:12px;font-weight:700;">⚖️ ' + esc(def.lawTitle) + '</span>',
          '</div>',
          '<div data-m-list-dyn>' + initListRes.html + '</div>'
        ].join('');

        var curListResRef = initListRes;

        function bindMatrixListDynEvents() {
          var dynEl = bodyEl.querySelector('[data-m-list-dyn]');
          if (!dynEl) return;
          var mAllCk = dynEl.querySelector('[data-m-all]');
          if (mAllCk) {
            mAllCk.addEventListener('change', function () {
              state.mChecked = {};
              if (mAllCk.checked) {
                curListResRef.rows.slice(0, 6).forEach(function (r) { state.mChecked[r.apba_id] = true; });
              }
              updateMatrixListDyn();
            });
          }
          Array.prototype.forEach.call(dynEl.querySelectorAll('[data-m-ck]'), function (ck) {
            ck.addEventListener('change', function () {
              var k = ck.getAttribute('data-m-ck') || '';
              if (ck.checked) state.mChecked[k] = true;
              else delete state.mChecked[k];
              updateMatrixListDyn();
            });
          });
          var bulkCmpBtn = dynEl.querySelector('[data-m-bulk-cmp]');
          if (bulkCmpBtn) {
            bulkCmpBtn.addEventListener('click', function () {
              state.compareIds = curListResRef.checkedAids.filter(function (id) { return !!organById[id]; }).slice(0, 6);
              state.mSubMode = 'STUDIO';
              renderCompareTray();
              renderTabMatrix();
            });
          }
          var bulkClrBtn = dynEl.querySelector('[data-m-bulk-clr]');
          if (bulkClrBtn) {
            bulkClrBtn.addEventListener('click', function () {
              state.mChecked = {};
              updateMatrixListDyn();
            });
          }
          var sbsEl2 = dynEl.querySelector('[data-m-sbs]');
          var compareList2 = curListResRef.selectedRows.length ? curListResRef.selectedRows.slice(0, 6) : curListResRef.rows.slice(0, 3);
          if (sbsEl2 && compareList2.length) {
            sbsEl2.innerHTML = [
              '<div class="pau-card law"><div class="pau-card-hd"><span>⚖️ 대한민국 법령 기준 · ' + esc(def.lawTitle) + '</span><span class="pau-pill ok">법령 API</span></div><pre class="pau-card-pre" data-law-live-box>원문 조회 중...</pre></div>'
            ].concat(compareList2.map(function (r) {
              return '<div class="pau-card"><div class="pau-card-hd"><b>🏛️ ' + esc(r.inst_name) + '</b><span class="pau-pill fktu">' + esc(r.metric_value || '') + '</span></div><pre class="pau-card-pre">' + esc(r.snippet || '') + '</pre></div>';
            })).join('');
            var lb2 = sbsEl2.querySelector('[data-law-live-box]');
            fetchLawLive(def.lawKey, function (err, law) {
              if (!lb2) return;
              var a = law && law.arts ? law.arts[def.lawArt] : null;
              lb2.textContent = a ? ('(' + law.title + ' ' + a.no + ' ' + a.title + ')\n' + a.text) : def.lawTitle;
            });
          }
        }

        function updateMatrixListDyn() {
          var dynEl = bodyEl.querySelector('[data-m-list-dyn]');
          if (!dynEl) return;
          curListResRef = renderMatrixListDynHtml();
          dynEl.innerHTML = curListResRef.html;
          bindMatrixListDynEvents();
        }

        bindMatrixSubModeButtons();
        bindFilterInputs(renderTabMatrix, { mQuery: updateMatrixListDyn });
        bindMatrixListDynEvents();
        syncUrlState();
        return;
      }

      // ── 3) STUDIO 모드 (기본): 다중 기관 그래프 + 정량비교표 + 13대 쟁점 히트맵 매트릭스 + 조문 원문 병렬대조 ──
      var cmpRecs = getActiveCompareRecords();
      if (!cmpRecs.length) {
        bodyEl.innerHTML = '<div class="pau-sec-card" style="padding:32px;text-align:center;color:var(--pau-muted);">비교 분석할 공공기관 데이터가 없습니다.</div>';
        syncUrlState();
        return;
      }
      var baseRec = cmpRecs[0];
      var bench = benchmarks.bySector[baseRec.sectorCode] || benchmarks.ALL;
      var scatterPool = organRecords.filter(function (r) { return r.sectorCode === baseRec.sectorCode; });
      if (scatterPool.length < 8) scatterPool = organRecords;

      function computeAddCandidates() {
        var hasQ = !!String(state.cmpAddQuery || '').trim();
        var matched = organRecords.filter(function (r) {
          if (!hasQ) return r.hasUnion;
          return matchSmartQuery(r.searchHaystack, state.cmpAddQuery);
        });
        if (hasQ) {
          matched = sortRecordsByQueryRelevance(matched, state.cmpAddQuery);
        }
        return matched.slice(0, 150);
      }

      function renderAddSelectOptionsHtml(cands) {
        var hasQ = !!String(state.cmpAddQuery || '').trim();
        if (!cands.length) {
          return '<option value="">검색 결과 없음 (0곳)</option>';
        }
        var headerTxt = hasQ ? ('검색 일치 ' + fmtNum(cands.length) + '곳 — 선택 시 비교 추가') : '+ 기관 추가 (최대 6곳)';
        return '<option value="">' + esc(headerTxt) + '</option>' + cands.map(function (c) {
          var sub = c.muniName ? (c.provinceShort + '·' + c.muniName) : c.scopeLabel;
          return '<option value="' + esc(c.aid) + '">' + esc('(' + sub + ') ' + c.name + (c.hasUnion ? (' · ' + fmtNum(c.memberTotal) + '명') : ' · 사규운영')) + '</option>';
        }).join('');
      }

      var addCandidates = computeAddCandidates();

      var quantRows = [
        { label: '권역 · 소관부처/지자체', fn: function (r) { return r.scopeLabel + ' · ' + r.ministry + (r.muniName ? (' (' + r.muniName + ')') : ''); }, benchTxt: esc(bench.label) },
        { label: '기능·업종 분류 · 기관유형', fn: function (r) { return r.sectorLabel + ' · ' + r.inst_type; }, benchTxt: fmtNum(bench.count) + '개 기관 평균' },
        { label: '노조 체계 · 대표노조', fn: function (r) { return r.unionStructLabel + (r.repUnion ? (' · ' + r.repUnion.union_name) : ''); }, benchTxt: '—' },
        { label: '상급단체 (총연맹)', fn: function (r) { return r.confeds.length ? r.confeds.join(' / ') : '노조없음'; }, benchTxt: '—' },
        { label: '가입대상 / 합산 조합원 수', numFn: function (r) { return r.memberTotal; }, fn: function (r) { return fmtNum(r.memberTotal) + '명 / 대상 ' + fmtNum(r.eligibleCount) + '명'; }, benchTxt: '평균 ' + fmtNum(bench.memberAvg) + '명' },
        { label: '노조 조직률 (%)', numFn: function (r) { return r.orgRate; }, fn: function (r) { return fmtPct(r.orgRate); }, benchTxt: fmtPct(bench.orgRate) },
        { label: '연간 타임오프 (근로시간면제)', numFn: function (r) { return r.timeoffHours; }, fn: function (r) { return r.timeoffHours ? (fmtNum(r.timeoffHours) + 'h (풀' + r.timeoffFull + '·파트' + r.timeoffPart + ')') : '—'; }, benchTxt: '평균 ' + fmtNum(bench.timeoffAvg) + 'h' },
        { label: '노조법 법정상한 대비 사용률', numFn: function (r) { return r.timeoffLimitPct; }, fn: function (r) { return r.legalTimeoffLimit ? (fmtPct(r.timeoffLimitPct) + ' (한도 ' + fmtNum(r.legalTimeoffLimit) + 'h)') : '—'; }, benchTxt: fmtPct(bench.timeoffLimitPct) },
        { label: '조합원 100명당 면제시간', numFn: function (r) { return r.hoursPer100; }, fn: function (r) { return r.hoursPer100 ? (fmtNum(r.hoursPer100) + 'h / 100명') : '—'; }, benchTxt: '—' },
        { label: '단협·임협·별도합의·사규 공시', numFn: function (r) { return r.discTotal; }, fn: function (r) { return '총 ' + r.discTotal + '건 (단협' + r.domains.caDiscs.length + '·임협' + r.domains.wageDiscs.length + '·별도' + r.domains.sepDiscs.length + '·사규' + r.domains.ruleDiscs.length + ')'; }, benchTxt: '평균 ' + bench.discAvg + '건' },
        { label: '6대영역 프로파일 종합점수', numFn: function (r) { return r.totalScore; }, fn: function (r) { return r.totalScore + '점 / 100점'; }, benchTxt: bench.totalScore + '점' }
      ];

      bodyEl.innerHTML = [
        '<div class="pau-sec-card" style="padding:8px 10px;">',
        '  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      ' + renderMatrixSubModeSegHtml(),
        '      <button type="button" class="pau-act-btn" data-preset-cmp="PEER">🔄 유사그룹</button>',
        '      <button type="button" class="pau-act-btn" data-preset-cmp="METRO">🚇 교통공사</button>',
        '      <button type="button" class="pau-act-btn" data-preset-cmp="MOIS">🏛️ 행안부유관</button>',
        '    </div>',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      <input type="search" data-f="cmpAddQuery" aria-label="비교 추가할 기관·지역 검색" placeholder="추가 기관·지역 검색" value="' + esc(state.cmpAddQuery) + '" style="min-width:145px;max-width:190px;">',
        '      <select data-cmp-add-sel aria-label="비교함에 추가할 기관 선택" style="max-width:240px;">',
        renderAddSelectOptionsHtml(addCandidates),
        '      </select>',
        '    </div>',
        '  </div>',
        '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-top:6px;margin-top:6px;border-top:1px dashed var(--pau-bd);">',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      <b style="font-size:12px;">🎯 비교 대상 (' + cmpRecs.length + '곳 + 업종평균):</b>',
        cmpRecs.map(function (r, idx) {
          var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
          return '<span style="display:inline-flex;align-items:center;gap:3px;">' +
            '<a class="pau-act-btn" href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="border:2px solid ' + pal.stroke + ';font-weight:800;text-decoration:none;">' +
            (idx === 0 ? '⭐ ' : ('비교' + idx + ': ')) + esc(r.name) + '</a>' +
            '<button type="button" class="pau-act-btn" data-cmp-rm-here="' + esc(r.aid) + '" aria-label="' + esc(r.name + ' 제외') + '" style="padding:4px 7px;">✕</button></span>';
        }).join(''),
        '    </div>',
        (baseRec.provinceKey
          ? '<button type="button" class="pau-act-btn" data-jump-region="' + esc(baseRec.provinceKey) + '">🗺️ ' + esc(baseRec.provinceKey) + ' 산하기관 전체 비교 →</button>'
          : '<span style="font-size:11.5px;color:var(--pau-muted);">그래프·정량표·13대 쟁점 히트맵 실시간 동기화</span>'),
        '  </div>',
        '</div>',

        '<div class="pau-sec-card">',
        '  <div class="pau-sec-tit"><span>📊 ① 다중 기관 핵심 수치 · 6대 영역 프로파일 그래프 비교</span></div>',
        '  <div class="pau-vis-grid">',
        '    <div class="pau-card">',
        '      <div class="pau-card-hd"><span>🕸️ 6축 프로파일 레이더 비교 (기준 vs 비교기관 vs 업종평균)</span></div>',
        renderRadarChartSvg(cmpRecs, bench),
        '    </div>',
        '    <div class="pau-card">',
        '      <div class="pau-card-hd"><span>🔵 조합원 규모 ↔ 타임오프 법정상한 산점도 비교</span></div>',
        renderScatterTimeoffSvg(scatterPool, cmpRecs),
        '    </div>',
        '  </div>',
        renderGroupedKpiBarsHtml(cmpRecs, bench),
        '</div>',

        '<div class="pau-sec-card">',
        '  <div class="pau-sec-tit"><span>📋 ② 기관별 핵심 정량 수치 총괄 비교표 (최고 수치 강조)</span></div>',
        '  <div class="pau-tbl-wrap" style="max-height:360px;">',
        '    <table class="pau-tbl">',
        '      <thead>',
        '        <tr>',
        '          <th class="c-no">№</th>',
        '          <th style="width:18%;">정량 비교 지표</th>',
        cmpRecs.map(function (r, idx) {
          var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
          return '<th style="border-bottom:3px solid ' + pal.stroke + ';">' + (idx === 0 ? '⭐ ' : '') + '<a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="color:var(--pau-pri);text-decoration:none;">↗ ' + esc(r.name) + '</a></th>';
        }).join(''),
        '          <th style="width:14%;">기준 평균 (' + esc(baseRec.sectorLabel) + ')</th>',
        '        </tr>',
        '      </thead>',
        '      <tbody>',
        quantRows.map(function (qr, rIdx) {
          var maxVal = -1;
          if (qr.numFn) {
            cmpRecs.forEach(function (r) {
              var v = qr.numFn(r);
              if (v > maxVal) maxVal = v;
            });
          }
          return [
            '<tr>',
            '  <td class="c-no">' + (rIdx + 1) + '</td>',
            '  <td style="font-weight:700;">' + esc(qr.label) + '</td>',
            cmpRecs.map(function (r) {
              var isTop = qr.numFn && maxVal > 0 && qr.numFn(r) === maxVal;
              var txt = qr.fn(r);
              return '<td title="' + esc(txt) + '"' + (isTop ? ' style="font-weight:800;color:var(--pau-pri);background:var(--pau-pri-bg);"' : '') + '>' +
                (isTop ? '🏆 ' : '') + esc(txt) + '</td>';
            }).join(''),
            '  <td style="color:var(--pau-muted);font-weight:600;">' + qr.benchTxt + '</td>',
            '</tr>'
          ].join('');
        }).join(''),
        '      </tbody>',
        '    </table>',
        '  </div>',
        '</div>',

        '<div class="pau-sec-card">',
        '  <div class="pau-sec-tit">',
        '    <span>🟦 ③ 13대 핵심 단체협약 쟁점 히트맵 비교표 (행 클릭 → 하단 조문 원문 1:N 병렬 대조)</span>',
        '    <span style="font-size:11.5px;color:var(--pau-muted);">색상 농도: 5단계(강화·합의) → 4단계(확대·우수) → 3단계(보통·법정) → 2단계(기본·사규)</span>',
        '  </div>',
        '  <div class="pau-tbl-wrap" style="max-height:460px;">',
        '    <table class="pau-tbl">',
        '      <thead>',
        '        <tr>',
        '          <th class="c-no">№</th>',
        '          <th style="width:20%;">13대 핵심 단협 쟁점 (클릭→원문대조)</th>',
        cmpRecs.map(function (r, idx) {
          var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
          return '<th style="border-bottom:3px solid ' + pal.stroke + ';">' + (idx === 0 ? '⭐ 기준: ' : '') + esc(r.name) + '</th>';
        }).join(''),
        '        </tr>',
        '      </thead>',
        '      <tbody>',
        METRIC_DEFS.map(function (mDef, idx) {
          var isSel = state.mIssue === mDef.key;
          var baseSc = baseRec.issueScores[mDef.key];
          return [
            '<tr data-hm-issue="' + esc(mDef.key) + '" tabindex="0" aria-label="' + esc(mDef.label + ' 쟁점 원문 대조 선택') + '" style="cursor:pointer;' + (isSel ? 'outline:2px solid #2563eb;outline-offset:-2px;' : '') + '">',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(mDef.label + ' (' + mDef.lawTitle + ')') + '" style="font-weight:800;color:' + (isSel ? 'var(--pau-pri)' : 'var(--pau-txt)') + ';">' + (isSel ? '▶ ' : '') + esc(mDef.label) + '</td>',
            cmpRecs.map(function (r, cIdx) {
              var sc = r.issueScores[mDef.key];
              var diffBadge = '';
              if (cIdx > 0) {
                if (sc.score >= baseSc.score + 8) diffBadge = ' <span style="font-weight:800;white-space:nowrap;">▲강화</span>';
                else if (sc.score <= baseSc.score - 8) diffBadge = ' <span style="font-weight:700;white-space:nowrap;">▼완화</span>';
                else diffBadge = ' <span style="white-space:nowrap;">━유사</span>';
              }
              return '<td class="pau-hm-cell lv' + sc.level + '" title="' + esc(r.name + ' [' + sc.tag + ' · ' + sc.score + '점] ' + sc.val + (sc.snip ? ' — ' + sc.snip : '')) + '">' +
                '<span class="pau-show-sm" style="font-weight:800;">' + esc(r.name) + ': </span><b style="white-space:nowrap;">[' + esc(sc.tag) + ']</b>' + diffBadge + ' ' + esc(sc.val) + '</td>';
            }).join(''),
            '</tr>'
          ].join('');
        }).join(''),
        '      </tbody>',
        '    </table>',
        '  </div>',
        '</div>',

        '<div class="pau-sec-card">',
        '  <div class="pau-sec-tit">',
        '    <span>⚖️ ④ 선택 쟁점 원문 1:N 병렬 대조 — 「' + esc(def.label) + '」 (' + esc(def.lawTitle) + ')</span>',
        '  </div>',
        '  <div class="pau-sbs" data-studio-sbs>',
        '    <div class="pau-card law">',
        '      <div class="pau-card-hd"><span>⚖️ 대한민국 현행 법령 기준</span><span class="pau-pill ok">실시간 법령 API</span></div>',
        '      <pre class="pau-card-pre" data-law-live-box>법령 API에서 (' + esc(def.lawTitle) + ') 원문을 불러오는 중...</pre>',
        '    </div>',
        cmpRecs.map(function (r, idx) {
          var sc = r.issueScores[def.key];
          var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
          return [
            '    <div class="pau-card" style="border-top:3px solid ' + pal.stroke + ';">',
            '      <div class="pau-card-hd"><a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="color:var(--pau-pri);text-decoration:none;">↗ 🏛️ ' + esc(r.name) + '</a><span class="pau-pill fktu">' + esc(sc.tag + ' · ' + sc.score + '점') + '</span></div>',
            '      <div style="font-size:12px;font-weight:700;color:var(--pau-sub);">' + esc(sc.val) + (sc.art ? (' (' + esc(sc.art) + ')') : '') + '</div>',
            '      <pre class="pau-card-pre">' + esc(sc.snip || '해당 쟁점의 요약 기준(' + sc.val + ')이 적용되며, 상단 공시원문 버튼으로 협약 전문을 열람할 수 있습니다.') + '</pre>',
            '    </div>'
          ].join('');
        }).join(''),
        '  </div>',
        '</div>'
      ].join('');

      var addSel = bodyEl.querySelector('[data-cmp-add-sel]');
      function addOrganToStudio(aidToAdd) {
        if (!aidToAdd || !organById[aidToAdd]) return;
        if (!state.compareIds.length) {
          state.compareIds = cmpRecs.map(function (r) { return r.aid; });
        }
        if (state.compareIds.indexOf(aidToAdd) === -1) {
          if (state.compareIds.length >= 6) state.compareIds.pop();
          state.compareIds.push(aidToAdd);
        }
        renderCompareTray();
        renderTabMatrix();
      }

      function updateStudioAddOptions() {
        if (!addSel) return;
        var nextCands = computeAddCandidates();
        addSel.innerHTML = renderAddSelectOptionsHtml(nextCands);
      }

      bindFilterInputs(renderTabMatrix, { cmpAddQuery: updateStudioAddOptions });

      var addQIn = bodyEl.querySelector('input[data-f="cmpAddQuery"]');
      if (addQIn) {
        addQIn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            var nextCands = computeAddCandidates();
            var pick = nextCands.find(function (c) { return cmpRecs.every(function (r) { return r.aid !== c.aid; }); }) || nextCands[0];
            if (pick) {
              state.cmpAddQuery = '';
              addOrganToStudio(pick.aid);
            }
          }
        });
      }

      bindMatrixSubModeButtons();

      if (addSel) {
        addSel.addEventListener('change', function () {
          addOrganToStudio(addSel.value);
        });
      }

      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-cmp-rm-here]'), function (b) {
        b.addEventListener('click', function () {
          var rmId = b.getAttribute('data-cmp-rm-here') || '';
          if (!state.compareIds.length) {
            state.compareIds = cmpRecs.map(function (r) { return r.aid; });
          }
          state.compareIds = state.compareIds.filter(function (x) { return x !== rmId; });
          renderCompareTray();
          renderTabMatrix();
        });
      });

      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-preset-cmp]'), function (b) {
        b.addEventListener('click', function () {
          var pType = b.getAttribute('data-preset-cmp');
          if (pType === 'METRO') {
            state.compareIds = organRecords.filter(function (r) { return r.sectorCode === 'RAIL_TRANSIT' && r.hasUnion; }).slice(0, 5).map(function (r) { return r.aid; });
          } else if (pType === 'MOIS') {
            state.compareIds = ['L_ERC', 'L_KLID', 'L_LOFA', 'L_POBA', 'L_KRILA', 'L_KILF'].filter(function (id) { return !!organById[id]; });
          } else {
            launchVisualComparisonWithPeers(baseRec.aid);
            return;
          }
          renderCompareTray();
          renderTabMatrix();
        });
      });

      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-hm-issue]'), function (tr) {
        function selectHmIssue(keepFocus) {
          var nextIssue = tr.getAttribute('data-hm-issue') || METRIC_DEFS[0].key;
          state.mIssue = nextIssue;
          renderTabMatrix();
          if (keepFocus) {
            var nextTr = bodyEl.querySelector('[data-hm-issue="' + nextIssue + '"]');
            if (nextTr && typeof nextTr.focus === 'function') nextTr.focus();
          }
        }
        tr.addEventListener('click', function () {
          selectHmIssue(false);
        });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectHmIssue(true);
          }
        });
      });

      var lawBox = bodyEl.querySelector('[data-law-live-box]');
      syncUrlState();
      fetchLawLive(def.lawKey, function (err, law) {
        if (!lawBox) return;
        if (err || !law) {
          lawBox.textContent = def.lawTitle + ' — 법령 원문 조회 대기 중 (🔌 API 탭에서 전체 조문 조회 가능)';
          return;
        }
        var a = law.arts[def.lawArt];
        lawBox.textContent = a
          ? '(' + law.title + ' ' + a.no + ' ' + a.title + ' · 시행 ' + law.effective + ')\n' + a.text
          : '(' + law.title + ') 공포 ' + law.promulgated + ' (제' + def.lawArt + '조)';
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 탭 4: 조문·원문 통합 (단체협약 조문 통합 검색 + 기관별 공시·별도합의·내부규정 원문)
    // ════════════════════════════════════════════════════════════════════════
    function renderDocModeToggleHtml() {
      var isDisc = state.docMode === 'DISC';
      return [
        '<div class="pau-seg" role="group" aria-label="조문·원문 전환">',
        '  <button type="button" class="pau-seg-btn' + (!isDisc ? ' on' : '') + '" aria-pressed="' + (!isDisc ? 'true' : 'false') + '" data-doc-mode="ARTICLES">🔍 단협 조문 (' + fmtNum(totalArt) + ')</button>',
        '  <button type="button" class="pau-seg-btn' + (isDisc ? ' on' : '') + '" aria-pressed="' + (isDisc ? 'true' : 'false') + '" data-doc-mode="DISC">📂 공시·사규 원문 (' + fmtNum(totalDisc) + ')</button>',
        '</div>'
      ].join('');
    }

    function filterArticles() {
      var list = safeArticles.filter(function (a) {
        var inst = instMap[a.apba_id] || { apba_id: a.apba_id, inst_type: a.inst_type };
        if (!matchOrganScope(inst, state.aScope)) return false;
        if (state.aCat && state.aCat !== 'ALL' && a.taxonomy_code !== state.aCat) return false;
        var hay = getOrganSearchHaystack(a.apba_id, (a.inst_name || '') + ' ' + (a.article_title || '') + ' ' + (a.text || '') + ' ' + (a.taxonomy_name || ''));
        if (!matchSmartQuery(hay, state.aQuery)) return false;
        return true;
      });
      if (state.aSort) {
        var as = state.aSort;
        list.sort(function (a, b) {
          if (as === 'name_asc' || as === 'name_desc') {
            var nc = String(a.inst_name || '').localeCompare(String(b.inst_name || ''), 'ko');
            if (nc !== 0) return as === 'name_asc' ? nc : -nc;
          } else if (as === 'cat_asc' || as === 'cat_desc') {
            var cc = String(a.taxonomy_name || '').localeCompare(String(b.taxonomy_name || ''), 'ko');
            if (cc !== 0) return as === 'cat_asc' ? cc : -cc;
          } else if (as === 'no_asc' || as === 'no_desc') {
            var am = String(a.article_no || '').match(/(\d+)/);
            var bm = String(b.article_no || '').match(/(\d+)/);
            var an = am ? Number(am[1]) : 999999;
            var bn = bm ? Number(bm[1]) : 999999;
            if ((an < 999999) !== (bn < 999999)) return an < 999999 ? -1 : 1;
            if (an !== bn) return as === 'no_asc' ? (an - bn) : (bn - an);
            var ac = String(a.article_no || '').localeCompare(String(b.article_no || ''), 'ko');
            if (ac !== 0) return as === 'no_asc' ? ac : -ac;
          } else if (as === 'tit_asc' || as === 'tit_desc') {
            var tc = String(a.article_title || '').localeCompare(String(b.article_title || ''), 'ko');
            if (tc !== 0) return as === 'tit_asc' ? tc : -tc;
          }
          return String(a.inst_name || '').localeCompare(String(b.inst_name || ''), 'ko');
        });
      }
      return list;
    }

    function formatArticleNoLabel(rawNo) {
      var artNo = String(rawNo || '').trim();
      if (artNo && artNo.indexOf('제') !== 0 && /^\d+$/.test(artNo)) artNo = '제' + artNo + '조';
      return artNo;
    }

    function getClauseCompareRecords() {
      var valid = state.compareIds.map(function (id) { return organById[id]; }).filter(Boolean);
      var hasQ = !!String(state.aQuery || '').trim();

      function pickPool(excludeMap) {
        var pool = organRecords.filter(function (r) {
          if (excludeMap[r.aid]) return false;
          if (!matchOrganScope(r.inst, state.aScope)) return false;
          if (hasQ) {
            var extraTxt = r.domains.articles.map(function (a) { return (a.article_title || '') + ' ' + (a.text || ''); }).join(' ');
            if (!matchSmartQuery(r.searchHaystack + ' ' + extraTxt, state.aQuery)) return false;
          }
          return true;
        });
        var withArts = pool.filter(function (r) { return r.domains.articles.length > 0; });
        var target = withArts.length >= 2 ? withArts : pool.filter(function (r) { return r.hasUnion; });
        if (!target.length) target = pool;
        target.sort(function (a, b) {
          var ac = (state.aCat && state.aCat !== 'ALL')
            ? a.domains.articles.filter(function (x) { return x.taxonomy_code === state.aCat; }).length
            : a.domains.articles.length;
          var bc = (state.aCat && state.aCat !== 'ALL')
            ? b.domains.articles.filter(function (x) { return x.taxonomy_code === state.aCat; }).length
            : b.domains.articles.length;
          if ((ac > 0) !== (bc > 0)) return bc > 0 ? 1 : -1;
          if (bc !== ac) return bc - ac;
          return b.memberTotal - a.memberTotal;
        });
        return target;
      }

      if (valid.length >= 2) return valid.slice(0, 6);
      if (valid.length === 1) {
        var base = valid[0];
        var used = {};
        used[base.aid] = true;
        var peers = findSimilarOrgans(data, base.aid, 'ALL')
          .map(function (s) { return organById[s.apba_id]; })
          .filter(function (p) {
            return p && !used[p.aid] && matchOrganScope(p.inst, state.aScope);
          });
        var peerWithArts = peers.filter(function (p) { return p.domains.articles.length > 0; });
        var chosen = (peerWithArts.length >= 2 ? peerWithArts : peers).slice(0, 3);
        chosen.forEach(function (c) { used[c.aid] = true; });
        if (chosen.length < 3) {
          pickPool(used).slice(0, 3 - chosen.length).forEach(function (c) { chosen.push(c); });
        }
        return [base].concat(chosen).slice(0, 6);
      }
      var picked = pickPool({}).slice(0, 4);
      if (picked.length < 2) {
        picked = organRecords.filter(function (r) { return r.domains.articles.length > 0; }).slice(0, 4);
      }
      return picked;
    }

    function renderOrganCaSourceLinkHtml(rec) {
      var caDisc = (rec.domains.caDiscs && rec.domains.caDiscs[0]) || (rec.domains.statusDiscs && rec.domains.statusDiscs[0]) || null;
      var caFile = (caDisc && caDisc.files && caDisc.files[0]) ? caDisc.files[0] : null;
      var caFileUrl = caFile ? safeHttpUrl(caFile.url) : '';
      var portalUrl = safeHttpUrl(buildOrganUrl(rec.inst, caDisc ? caDisc.dno : null, 'union_info'));
      var parts = [];
      if (caFileUrl) {
        parts.push('<a class="pau-act-btn" href="' + esc(caFileUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📎 단협원문</a>');
      } else if (portalUrl) {
        parts.push('<a class="pau-act-btn" href="' + esc(portalUrl) + '"' + ((rec.isLocal && !rec.isMois) ? (' data-cleaneye-post="' + esc(rec.aid) + '" data-cleaneye-type="union_info"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시원문</a>');
      }
      return parts.join('');
    }

    function renderTabArticles() {
      var curView = state.aViewMode || 'COMPARE';

      function computeClauseAddCandidates(cmpRecs) {
        var used = {};
        cmpRecs.forEach(function (r) { used[r.aid] = true; });
        var q = String(state.aCmpAddQ || '').trim();
        var list = organRecords.filter(function (r) {
          if (used[r.aid]) return false;
          if (!matchOrganScope(r.inst, state.aScope)) return false;
          if (!q) return true;
          return matchSmartQuery(r.searchHaystack, q);
        });
        if (q) {
          var instRank = {};
          sortInstsByQueryRelevance(list.map(function (r) { return r.inst; }), q).forEach(function (inst, idx) {
            instRank[inst.apba_id] = idx;
          });
          list.sort(function (a, b) { return (instRank[a.aid] || 0) - (instRank[b.aid] || 0); });
        } else {
          list.sort(function (a, b) {
            var ac = a.domains.articles.length;
            var bc = b.domains.articles.length;
            if ((ac > 0) !== (bc > 0)) return bc > 0 ? 1 : -1;
            if (bc !== ac) return bc - ac;
            return b.memberTotal - a.memberTotal;
          });
        }
        return list.slice(0, 120);
      }

      function renderClauseAddOptionsHtml(cands) {
        if (!cands.length) return '<option value="">추가 가능한 기관 없음 (0곳)</option>';
        return '<option value="">+ 비교기관 추가 선택 (' + fmtNum(cands.length) + '곳)</option>' +
          cands.map(function (r) {
            var artTag = r.domains.articles.length ? (' · 조문 ' + r.domains.articles.length + '건') : (' · ' + (r.hasUnion ? fmtNum(r.memberTotal) + '명' : '미설립'));
            return '<option value="' + esc(r.aid) + '">' + esc('[' + r.scopeLabel + '] ' + r.name + artTag) + '</option>';
          }).join('');
      }

      function renderClauseCompareModeHtml(filteredRows) {
        var cmpRecs = getClauseCompareRecords();
        var addCands = computeClauseAddCandidates(cmpRecs);
        var autoPairedNotice = state.compareIds.length === 1
          ? '기준기관 1곳에 유사·조문수록 기관을 자동 매칭했습니다'
          : (state.compareIds.length === 0 ? '조문 수록 주요기관을 기본 대조 중입니다 (기관 추가·변경 가능)' : '비교함에 담긴 기관들을 조문·쟁점 단위로 직접 대조합니다');

        var topicCounts = Object.create(null);
        var allCmpArts = 0;
        cmpRecs.forEach(function (r) {
          r.domains.articles.forEach(function (a) {
            if (state.aQuery && !matchSmartQuery(getOrganSearchHaystack(r.aid, (a.article_title || '') + ' ' + (a.text || '') + ' ' + (a.taxonomy_name || '')), state.aQuery)) return;
            allCmpArts += 1;
            var tc = a.taxonomy_code || 'ETC';
            topicCounts[tc] = (topicCounts[tc] || 0) + 1;
          });
        });

        var mappedMetricKey = (state.aCat && state.aCat !== 'ALL') ? (TAXONOMY_TO_METRIC[state.aCat] || '') : '';
        var activeDef = mappedMetricKey ? METRIC_DEFS.find(function (d) { return d.key === mappedMetricKey; }) : null;
        var hasQueryFilter = !!String(state.aQuery || '').trim();
        var showOverviewMatrix = (state.aCat === 'ALL' && !hasQueryFilter);

        var colPct = Math.max(12, Math.floor(80 / Math.max(1, cmpRecs.length)));

        return [
          '<div class="pau-card" style="padding:10px 12px;">',
          '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">',
          '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
          '      <span style="font-size:12.5px;font-weight:900;color:var(--pau-pri);">🎯 조문 병렬비교 대상 (' + cmpRecs.length + '/6곳):</span>',
          cmpRecs.map(function (r, idx) {
            var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
            return '<span class="pau-pill" style="background:' + pal.fill + ';border:1px solid ' + pal.stroke + ';color:var(--pau-txt);padding:3px 8px;gap:5px;">' +
              '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + pal.stroke + ';"></span>' +
              '<a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="font-weight:800;color:inherit;text-decoration:none;">' + (idx === 0 ? '⭐ ' : '') + esc(r.name) + '</a>' +
              '<span style="font-size:10.5px;color:var(--pau-muted);">조문 ' + r.domains.articles.length + '</span>' +
              (cmpRecs.length > 2 ? '<button type="button" data-a-cmp-rm="' + esc(r.aid) + '" aria-label="' + esc(r.name + ' 비교 제외') + '" style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;border:0;border-radius:999px;background:rgba(15,23,42,.08);color:var(--pau-txt);cursor:pointer;padding:0 5px;font-size:11px;font-weight:800;line-height:1;">✕</button>' : '') +
            '</span>';
          }).join(''),
          '    </div>',
          '    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">',
          '      <input type="search" data-f="aCmpAddQ" aria-label="조문 비교기관 검색" placeholder="비교기관 추가 검색" value="' + esc(state.aCmpAddQ) + '" style="width:140px;min-width:120px;">',
          '      <select data-a-cmp-add aria-label="조문 비교기관 추가 선택" style="max-width:225px;">' + renderClauseAddOptionsHtml(addCands) + '</select>',
          '      <button type="button" class="pau-act-btn" data-a-preset="CENTRAL_CLAUSE">🏛️ 주요공기업</button>',
          '      <button type="button" class="pau-act-btn" data-a-preset="LOCAL_METRO">🚇 도시철도·교통</button>',
          '      <button type="button" class="pau-act-btn" data-a-preset="LOCAL_MEDICAL">🏥 지방의료원</button>',
          '      <button type="button" class="pau-act-btn" data-a-go-studio>📊 레이더·수치 비교</button>',
          '    </div>',
          '  </div>',
          '  <div style="font-size:11.5px;color:var(--pau-muted);margin-top:4px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">',
          '    <span>💡 ' + esc(autoPairedNotice) + ' — 아래 쟁점 칩이나 표 행을 클릭하면 해당 쟁점 조문만 나란히 모아 비교합니다.</span>',
          '    <span>전체 조건 일치 조문 <b>' + fmtNum(filteredRows.length) + '</b>건</span>',
          '  </div>',
          '  <div class="pau-topic-bar" role="group" aria-label="단협 쟁점 빠른 선택" style="margin-top:6px;">',
          TOPIC_CHIP_ORDER.map(function (tp) {
            var code = tp[0];
            var label = tp[1];
            var on = state.aCat === code;
            var cnt = code === 'ALL' ? allCmpArts : (topicCounts[code] || 0);
            return '<button type="button" class="pau-topic-chip' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-a-topic="' + esc(code) + '">' +
              esc(label) + (cnt > 0 ? (' <b>(' + cnt + ')</b>') : '') + '</button>';
          }).join(''),
          '  </div>',
          '</div>',

          (activeDef ? [
            '<div class="pau-law-strip">',
            '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">',
            '    <span>⚖️ <b>' + esc(activeDef.label) + '</b> — 대한민국 현행 법정 기준: <b>' + esc(activeDef.lawTitle) + '</b></span>',
            '    <button type="button" class="pau-act-btn" data-a-topic="ALL">↩ 전체 13대쟁점 요약표로 복귀</button>',
            '  </div>',
            '  <div data-a-law-out data-law-key="' + esc(activeDef.lawKey) + '" data-law-art="' + esc(activeDef.lawArt) + '" data-law-title="' + esc(activeDef.lawTitle) + '" style="font-size:11.5px;color:inherit;white-space:pre-line;line-height:1.45;">법령 기준 조회 중...</div>',
            '</div>'
          ].join('') : ''),

          (showOverviewMatrix ? [
            '<div class="pau-card">',
            '  <div class="pau-card-hd">',
            '    <span>📊 ① 비교 대상 기관(' + cmpRecs.length + '곳) 13대 핵심 단협 쟁점 한눈 비교표 (행 클릭 → 해당 쟁점 조문 전문 병렬대조)</span>',
            '    <span class="pau-pill">기준진단 + 수록조문 건수 통합</span>',
            '  </div>',
            '  <div class="pau-tbl-wrap" style="max-height:none;overflow:visible;">',
            '    <table class="pau-tbl pau-hm-tbl">',
            '      <thead><tr>',
            '        <th style="width:20%;">13대 단협 핵심 쟁점 (클릭→조문 대조)</th>',
            cmpRecs.map(function (r, idx) {
              var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
              return '<th style="width:' + colPct + '%;border-bottom:2px solid ' + pal.stroke + ';" title="' + esc(r.name) + '">' +
                '<a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="color:var(--pau-pri);text-decoration:none;font-weight:800;">↗ ' + esc(r.name) + '</a></th>';
            }).join(''),
            '      </tr></thead>',
            '      <tbody>',
            METRIC_DEFS.map(function (d) {
              var taxCode = METRIC_TO_TAXONOMY[d.key] || 'ALL';
              return '<tr data-a-topic="' + esc(taxCode) + '" tabindex="0" role="button" aria-label="' + esc(d.label + ' 조문 병렬 대조 열기') + '" style="cursor:pointer;">' +
                '<td title="' + esc(d.label + ' · ' + d.lawTitle) + '"><span style="font-weight:800;color:var(--pau-pri);">▸ ' + esc(d.label) + '</span></td>' +
                cmpRecs.map(function (r) {
                  var sc = r.issueScores[d.key];
                  var lvCls = 'lv' + Math.max(1, Math.min(5, sc.level));
                  var artCnt = r.domains.articles.filter(function (a) { return a.taxonomy_code === taxCode; }).length;
                  return '<td class="pau-hm-cell ' + lvCls + '" title="' + esc(sc.val + (sc.snip ? ' · ' + sc.snip : '')) + '">' +
                    '<span class="pau-show-sm" style="font-weight:800;">' + esc(r.name) + ': </span>' +
                    '<span class="pau-hm-tag ' + lvCls + '">' + esc(sc.tag) + '</span> ' +
                    '<span>' + esc(sc.val) + '</span>' +
                    (artCnt > 0 ? ' <span class="pau-pill ok">조문 ' + artCnt + '</span>' : '') +
                  '</td>';
                }).join('') +
              '</tr>';
            }).join(''),
            '      </tbody>',
            '    </table>',
            '  </div>',
            '</div>',

            '<div class="pau-card">',
            '  <div class="pau-card-hd">',
            '    <span>📖 ② 비교 기관별 주요 수록 조문 카드 대조 (한 기관당 핵심 조문 묶음 요약)</span>',
            '    <span style="font-size:11.5px;color:var(--pau-muted);">상단 쟁점 칩을 선택하면 해당 분야 전 조문을 나란히 대조합니다</span>',
            '  </div>',
            '  <div class="pau-clause-cmp-grid">',
            cmpRecs.map(function (r, idx) {
              var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
              var sampleArts = r.domains.articles.slice(0, 4);
              var revPreview = (!sampleArts.length && r.domains.revisions && r.domains.revisions[0] && r.domains.revisions[0].diffs) ? r.domains.revisions[0].diffs.slice(0, 3) : [];
              return [
                '<div class="pau-clause-card" style="border-top:3px solid ' + pal.stroke + ';">',
                '  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;flex-wrap:wrap;">',
                '    <div>',
                '      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">',
                '        <span class="pau-pill ' + (r.isLocal ? 'loc' : '') + '">' + esc(r.scopeLabel) + '</span>',
                '        <a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="font-size:13.5px;font-weight:900;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(r.name) + '</a>',
                '      </div>',
                '      <div style="font-size:11px;color:var(--pau-muted);margin-top:2px;">' + esc(r.ministry + ' · ' + (r.hasUnion ? (r.unionStructLabel + ' ' + fmtNum(r.memberTotal) + '명') : '노조 미설립')) + '</div>',
                '    </div>',
                '    <span class="pau-pill ' + (r.domains.articles.length ? 'ok' : '') + '">수록조문 ' + r.domains.articles.length + '건</span>',
                '  </div>',
                (sampleArts.length ? sampleArts.map(function (a) {
                  var noLbl = formatArticleNoLabel(a.article_no);
                  return '<div class="pau-clause-item">' +
                    '<div class="pau-clause-item-hd">' +
                      '<span style="font-weight:800;color:var(--pau-pri);">' + esc((noLbl ? noLbl + ' ' : '') + (a.article_title || '조문')) + '</span>' +
                      '<button type="button" class="pau-pill" data-a-topic="' + esc(a.taxonomy_code || 'ETC') + '" style="border:0;cursor:pointer;">' + esc(a.taxonomy_name || '기타') + ' ▸</button>' +
                    '</div>' +
                    '<div class="pau-clause-item-txt">' + esc(String(a.text || '').trim()) + '</div>' +
                  '</div>';
                }).join('') : (revPreview.length ? revPreview.map(function (rv) {
                  return '<div class="pau-clause-item">' +
                    '<div class="pau-clause-item-hd"><span style="font-weight:800;color:var(--pau-pri);">[신·구대비] ' + esc(rv.art || '개정사항') + '</span></div>' +
                    '<div class="pau-clause-item-txt">' + esc(String(rv.after || rv.note || rv.before || '').trim()) + '</div>' +
                  '</div>';
                }).join('') : '<div class="pau-clause-item" style="color:var(--pau-muted);font-size:12px;">텍스트 추출 조문 대신 첨부 단체협약서(PDF/HWP) 원문 및 13대 핵심기준 진단이 제공됩니다.</div>')),
                '  <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:auto;padding-top:4px;">',
                (r.domains.articles.length > 4 ? '<button type="button" class="pau-act-btn pri" data-a-jump-org="' + esc(r.aid) + '">📖 이 기관 전체 조문(' + r.domains.articles.length + '건) 보기</button>' : ''),
                '    <button type="button" class="pau-act-btn" data-open-organ-here="' + esc(r.aid) + '" data-open-sub="ISSUES">🔎 기관 상세</button>',
                '    ' + renderOrganCaSourceLinkHtml(r),
                '  </div>',
                '</div>'
              ].join('');
            }).join(''),
            '  </div>',
            '</div>'
          ].join('') : [
            '<div class="pau-card">',
            '  <div class="pau-card-hd">',
            '    <span>⚖️ ' + esc((TAXONOMY_LIST.find(function (t) { return t[0] === state.aCat; }) || ['', '전체 쟁점'])[1]) + (hasQueryFilter ? (' · 검색어 "' + esc(state.aQuery.trim()) + '"') : '') + ' — 기관별 조문 전문 병렬 대조 (' + cmpRecs.length + '곳)</span>',
            '    <button type="button" class="pau-act-btn" data-a-view="BY_ORGAN">🏛️ 전체 기관 묶음에서 더 찾기</button>',
            '  </div>',
            '  <div class="pau-clause-cmp-grid">',
            cmpRecs.map(function (r, idx) {
              var pal = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
              var sc = mappedMetricKey ? r.issueScores[mappedMetricKey] : null;
              var lvCls = sc ? ('lv' + Math.max(1, Math.min(5, sc.level))) : '';
              var matchingArts = r.domains.articles.filter(function (a) {
                if (state.aCat && state.aCat !== 'ALL' && a.taxonomy_code !== state.aCat) return false;
                if (hasQueryFilter && !matchSmartQuery(getOrganSearchHaystack(r.aid, (a.article_title || '') + ' ' + (a.text || '') + ' ' + (a.taxonomy_name || '')), state.aQuery)) return false;
                return true;
              });
              return [
                '<div class="pau-clause-card" style="border-top:3px solid ' + pal.stroke + ';">',
                '  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;flex-wrap:wrap;">',
                '    <div>',
                '      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">',
                '        <span class="pau-pill ' + (r.isLocal ? 'loc' : '') + '">' + esc(r.scopeLabel) + '</span>',
                '        <a href="pu-alio-union.html?organ=' + encodeURIComponent(r.aid) + '" data-jump-organ="' + esc(r.aid) + '" style="font-size:13.5px;font-weight:900;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(r.name) + '</a>',
                '      </div>',
                '      <div style="font-size:11px;color:var(--pau-muted);margin-top:2px;">' + esc(r.ministry + ' · ' + (r.repUnion ? r.repUnion.union_name : r.unionStructLabel)) + '</div>',
                '    </div>',
                (sc ? '<span class="pau-hm-tag ' + lvCls + '">' + esc(sc.tag + ' · ' + sc.score + '점') + '</span>' : '<span class="pau-pill">조문 ' + matchingArts.length + '건</span>'),
                '  </div>',
                (sc ? '<div style="background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:7px;padding:6px 9px;font-size:11.5px;line-height:1.45;">' +
                  '<div><b style="color:var(--pau-pri);">핵심 기준:</b> <b>' + esc(sc.val) + '</b>' + (sc.art ? (' <span style="color:var(--pau-muted);">(' + esc(sc.art) + ')</span>') : '') + '</div>' +
                  (sc.snip ? '<div style="color:var(--pau-muted);margin-top:2px;">' + esc(sc.snip) + '</div>' : '') +
                '</div>' : ''),
                (matchingArts.length ? matchingArts.map(function (a) {
                  var noLbl = formatArticleNoLabel(a.article_no);
                  return '<div class="pau-clause-item">' +
                    '<div class="pau-clause-item-hd">' +
                      '<span style="font-weight:800;color:var(--pau-pri);">' + esc((noLbl ? noLbl + ' ' : '') + (a.article_title || '조문')) + '</span>' +
                      '<span class="pau-pill">' + esc(a.taxonomy_name || '기타') + '</span>' +
                    '</div>' +
                    '<div class="pau-clause-item-txt">' + esc(String(a.text || '').trim()) + '</div>' +
                  '</div>';
                }).join('') : '<div class="pau-clause-item" style="color:var(--pau-muted);font-size:12px;">해당 분류로 추출된 텍스트 조문이 없습니다. 위 핵심 기준 요약 또는 아래 단체협약 첨부 원문으로 전문을 확인할 수 있습니다.</div>'),
                '  <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:auto;padding-top:4px;">',
                '    <button type="button" class="pau-act-btn" data-open-organ-here="' + esc(r.aid) + '" data-open-sub="ISSUES">🔎 기관 상세</button>',
                '    ' + renderOrganCaSourceLinkHtml(r),
                '  </div>',
                '</div>'
              ].join('');
            }).join(''),
            '  </div>',
            '</div>'
          ].join(''))
        ].join('');
      }

      function renderArticlesByOrganHtml(rows) {
        var groupMap = Object.create(null);
        var groups = [];
        rows.forEach(function (a) {
          var g = groupMap[a.apba_id];
          if (!g) {
            g = {
              aid: a.apba_id,
              rec: organById[a.apba_id] || null,
              instName: a.inst_name || (instMap[a.apba_id] ? instMap[a.apba_id].name : a.apba_id),
              items: [],
              catCounts: Object.create(null)
            };
            groupMap[a.apba_id] = g;
            groups.push(g);
          }
          g.items.push(a);
          var cName = a.taxonomy_name || '기타';
          g.catCounts[cName] = (g.catCounts[cName] || 0) + 1;
        });

        groups.sort(function (a, b) {
          if (state.aSort === 'name_asc') return a.instName.localeCompare(b.instName, 'ko');
          if (state.aSort === 'name_desc') return b.instName.localeCompare(a.instName, 'ko');
          if (b.items.length !== a.items.length) return b.items.length - a.items.length;
          return a.instName.localeCompare(b.instName, 'ko');
        });

        var pageSize = 25;
        var totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
        if (state.aPage >= totalPages) state.aPage = totalPages - 1;
        if (state.aPage < 0) state.aPage = 0;
        var startIdx = state.aPage * pageSize;
        var visGroups = groups.slice(startIdx, startIdx + pageSize);

        return [
          '<div class="pau-subbar">',
          '  <span>조문 수록 기관 <b>' + fmtNum(groups.length) + '</b>곳 · 일치 조문 <b>' + fmtNum(rows.length) + '</b>건 (기관별 중복 없이 1카드 통합 정리)</span>',
          '  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:auto;">',
          (groups.length > pageSize ? [
            '    <span>' + (state.aPage + 1) + ' / ' + totalPages + ' 페이지</span>',
            '    <button type="button" class="pau-act-btn" data-a-prev' + (state.aPage <= 0 ? ' disabled' : '') + '>◀ 이전</button>',
            '    <button type="button" class="pau-act-btn" data-a-next' + (state.aPage + 1 >= totalPages ? ' disabled' : '') + '>다음 ▶</button>'
          ].join('') : ''),
          '  </div>',
          '</div>',
          (visGroups.length ? '<div class="pau-org-art-list">' + visGroups.map(function (g, idx) {
            var rec = g.rec;
            var inCmp = state.compareIds.indexOf(g.aid) >= 0;
            var expVal = state.aOrgExpanded[g.aid];
            var isExp = expVal === true || (expVal === undefined && ((state.aPage === 0 && idx < 2) || groups.length <= 3));
            var catEntries = Object.keys(g.catCounts).map(function (k) { return [k, g.catCounts[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 6);
            return [
              '<div class="pau-org-art-card">',
              '  <div class="pau-org-art-hd">',
              '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
              (rec ? '<span class="pau-pill ' + (rec.isLocal ? 'loc' : '') + '">' + esc(rec.scopeLabel) + '</span>' : ''),
              '      <a href="pu-alio-union.html?organ=' + encodeURIComponent(g.aid) + '" data-jump-organ="' + esc(g.aid) + '" style="font-size:13.5px;font-weight:900;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(g.instName) + '</a>',
              (rec ? '<span style="font-size:11.5px;color:var(--pau-muted);">(' + esc(rec.ministry + (rec.hasUnion ? ' · ' + fmtNum(rec.memberTotal) + '명' : '')) + ')</span>' : ''),
              '      <span class="pau-pill ok">수록조문 ' + g.items.length + '건</span>',
              catEntries.map(function (ce) {
                return '<span class="pau-pill">' + esc(ce[0].split('·')[0] + ' ' + ce[1]) + '</span>';
              }).join(''),
              '    </div>',
              '    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">',
              '      <button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(g.aid) + '">' + (inCmp ? '✓비교담김' : '+비교담기') + '</button>',
              (rec ? renderOrganCaSourceLinkHtml(rec) : ''),
              '      <button type="button" class="pau-act-btn' + (isExp ? ' pri' : '') + '" data-a-org-exp="' + esc(g.aid) + '" aria-expanded="' + (isExp ? 'true' : 'false') + '">' + (isExp ? '▲ 조문 접기' : ('📖 조문 ' + g.items.length + '건 펼치기')) + '</button>',
              '    </div>',
              '  </div>',
              (isExp ? '<div class="pau-art-subgrid">' + g.items.map(function (a) {
                var noLbl = formatArticleNoLabel(a.article_no);
                return '<div class="pau-clause-item">' +
                  '<div class="pau-clause-item-hd">' +
                    '<span style="font-weight:800;color:var(--pau-pri);">' + esc((noLbl ? noLbl + ' ' : '') + (a.article_title || '조문')) + '</span>' +
                    '<span class="pau-pill">' + esc(a.taxonomy_name || '기타') + '</span>' +
                  '</div>' +
                  '<div class="pau-clause-item-txt">' + esc(String(a.text || '').trim()) + '</div>' +
                '</div>';
              }).join('') + '</div>' : ''),
              '</div>'
            ].join('');
          }).join('') + '</div>' : '<div class="pau-card" style="text-align:center;padding:24px;color:var(--pau-muted);">검색 조건에 해당하는 단체협약 조문이 없습니다.</div>')
        ].join('');
      }

      function renderArticlesTableHtml(rows) {
        var pageSize = 200;
        var totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        if (state.aPage >= totalPages) state.aPage = totalPages - 1;
        if (state.aPage < 0) state.aPage = 0;
        var startIdx = state.aPage * pageSize;
        var visRows = rows.slice(startIdx, startIdx + pageSize);

        return [
          '<div class="pau-subbar">',
          '  <span>전체 조문 검색표 <b>' + fmtNum(rows.length) + '</b>건' + (rows.length > pageSize ? (' (' + fmtNum(startIdx + 1) + '~' + fmtNum(startIdx + visRows.length) + '번째 표시)') : '') + ' — 행의 [전문]을 누르면 잘림 없이 전문이 펼쳐집니다</span>',
          '  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:auto;">',
          (rows.length > pageSize ? [
            '    <span>' + (state.aPage + 1) + ' / ' + totalPages + ' 페이지</span>',
            '    <button type="button" class="pau-act-btn" data-a-prev' + (state.aPage <= 0 ? ' disabled' : '') + '>◀ 이전</button>',
            '    <button type="button" class="pau-act-btn" data-a-next' + (state.aPage + 1 >= totalPages ? ' disabled' : '') + '>다음 ▶</button>'
          ].join('') : ''),
          '  </div>',
          '</div>',
          '<div class="pau-tbl-wrap">',
          '  <table class="pau-tbl">',
          '    <thead>',
          '      <tr>',
          '        <th class="c-no">№</th>',
          '        ' + renderSortTh('18%', '기관명 (클릭→별개 창)', 'a_name', state.aSort, ['name_asc', 'name_desc']),
          '        ' + renderSortTh('14%', '쟁점 분류', 'a_cat', state.aSort, ['cat_asc', 'cat_desc']),
          '        ' + renderSortTh('8%', '조문번호', 'a_no', state.aSort, ['no_asc', 'no_desc']),
          '        ' + renderSortTh('16%', '조문제목', 'a_tit', state.aSort, ['tit_asc', 'tit_desc']),
          '        <th style="width:31%;">조문 본문 요약</th>',
          '        <th style="width:13%;">전문 · 비교</th>',
          '      </tr>',
          '    </thead>',
          '    <tbody>',
          (visRows.length ? visRows.map(function (a, idx) {
            var absIdx = startIdx + idx;
            var bodyTxt = String(a.text || '').replace(/\s+/g, ' ').trim();
            var artNo = formatArticleNoLabel(a.article_no);
            var inCmp = state.compareIds.indexOf(a.apba_id) >= 0;
            var rowKey = (a.apba_id || '') + '_' + absIdx;
            var isRowExp = !!state.aRowExpanded[rowKey];
            return [
              '<tr>',
              '  <td class="c-no">' + (absIdx + 1) + '</td>',
              '  <td title="' + esc(a.inst_name) + '"><a href="pu-alio-union.html?organ=' + encodeURIComponent(a.apba_id) + '" data-jump-organ="' + esc(a.apba_id) + '" style="font-weight:700;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(a.inst_name) + '</a></td>',
              '  <td><span class="pau-pill">' + esc(a.taxonomy_name || '기타') + '</span></td>',
              '  <td style="font-weight:700;">' + esc(artNo) + '</td>',
              '  <td title="' + esc(a.article_title || '') + '" style="font-weight:700;color:var(--pau-pri);">' + esc(a.article_title || '—') + '</td>',
              '  <td title="' + esc(bodyTxt) + '">' + esc(bodyTxt) + '</td>',
              '  <td style="white-space:normal;"><div style="display:flex;gap:4px;flex-wrap:wrap;">' +
                '<button type="button" class="pau-act-btn' + (isRowExp ? ' pri' : '') + '" data-a-row-exp="' + esc(rowKey) + '" aria-expanded="' + (isRowExp ? 'true' : 'false') + '">' + (isRowExp ? '접기' : '전문') + '</button>' +
                '<button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(a.apba_id) + '">' + (inCmp ? '✓비교' : '+비교') + '</button>' +
              '</div></td>',
              '</tr>',
              (isRowExp ? '<tr class="pau-exp-row"><td colspan="7"><div style="padding:4px 6px;">' +
                '<div style="font-weight:800;color:var(--pau-pri);margin-bottom:4px;">' + esc(a.inst_name + ' — ' + (artNo ? artNo + ' ' : '') + (a.article_title || '')) + '</div>' +
                '<div style="font-size:12.5px;line-height:1.6;white-space:pre-line;color:var(--pau-txt);">' + esc(String(a.text || '').trim()) + '</div>' +
              '</div></td></tr>' : '')
            ].join('');
          }).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--pau-muted);">검색 조건에 해당하는 단체협약 조문이 없습니다.</td></tr>'),
          '    </tbody>',
          '  </table>',
          '</div>'
        ].join('');
      }

      function renderArticlesDynHtml(rows) {
        if (state.aViewMode === 'BY_ORGAN') return renderArticlesByOrganHtml(rows);
        if (state.aViewMode === 'TABLE') return renderArticlesTableHtml(rows);
        return renderClauseCompareModeHtml(rows);
      }

      function populateClauseLawStrip() {
        var lawOut = bodyEl.querySelector('[data-a-law-out]');
        if (!lawOut) return;
        var lKey = lawOut.getAttribute('data-law-key') || '';
        var lArt = lawOut.getAttribute('data-law-art') || '';
        var lTit = lawOut.getAttribute('data-law-title') || '';
        if (!lKey) return;
        fetchLawLive(lKey, function (err, law) {
          if (!lawOut) return;
          if (err || !law) {
            lawOut.textContent = lTit + ' — 법령 원문 연동 대기 중 (🔌 API 탭에서 전체 법령 조문 조회 가능)';
            return;
          }
          var artObj = law.arts[lArt];
          lawOut.textContent = artObj
            ? '(' + law.title + ' ' + artObj.no + ' ' + artObj.title + ' · 시행 ' + law.effective + ') ' + artObj.text
            : '(' + law.title + ') 공포 ' + law.promulgated + ' (제' + lArt + '조)';
        });
      }

      function bindArticlesDynEvents() {
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-a-view]'), function (b) {
          b.addEventListener('click', function () {
            var nextView = b.getAttribute('data-a-view') || 'COMPARE';
            state.aViewMode = nextView;
            state.aPage = 0;
            renderCompareTray();
            renderTabArticles();
            var focusBtn = bodyEl.querySelector('[data-a-view="' + nextView + '"]');
            if (focusBtn && typeof focusBtn.focus === 'function') focusBtn.focus();
          });
        });

        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-a-topic]'), function (el) {
          function applyTopic(keepFocus) {
            var nextTopic = el.getAttribute('data-a-topic') || 'ALL';
            state.aCat = nextTopic;
            state.aPage = 0;
            renderTabArticles();
            if (keepFocus) {
              var nextEl = bodyEl.querySelector('.pau-topic-chip[data-a-topic="' + nextTopic + '"]');
              if (nextEl && typeof nextEl.focus === 'function') nextEl.focus();
            }
          }
          el.addEventListener('click', function (e) {
            if (e.target && e.target.closest && e.target.closest('a[data-jump-organ]')) return;
            applyTopic(false);
          });
          if (el.tagName === 'TR') {
            el.addEventListener('keydown', function (e) {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                applyTopic(true);
              }
            });
          }
        });

        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-a-cmp-rm]'), function (b) {
          b.addEventListener('click', function () {
            var rmAid = b.getAttribute('data-a-cmp-rm') || '';
            if (state.compareIds.length < 2) {
              state.compareIds = getClauseCompareRecords().map(function (r) { return r.aid; });
            }
            state.compareIds = state.compareIds.filter(function (x) { return x !== rmAid; });
            renderCompareTray();
            renderTabArticles();
            syncUrlState();
          });
        });

        var addSel = bodyEl.querySelector('[data-a-cmp-add]');
        function addClauseOrgan(aidToAdd) {
          if (!aidToAdd || !organById[aidToAdd]) return;
          if (!state.compareIds.length) {
            state.compareIds = getClauseCompareRecords().map(function (r) { return r.aid; });
          }
          if (state.compareIds.indexOf(aidToAdd) === -1) {
            if (state.compareIds.length >= 6) state.compareIds.pop();
            state.compareIds.push(aidToAdd);
          }
          state.aCmpAddQ = '';
          renderCompareTray();
          renderTabArticles();
          syncUrlState();
        }
        if (addSel) {
          addSel.addEventListener('change', function () {
            addClauseOrgan(addSel.value);
          });
        }

        var addQIn = bodyEl.querySelector('input[data-f="aCmpAddQ"]');
        if (addQIn) {
          var applyAddSearch = function () {
            state.aCmpAddQ = addQIn.value;
            if (!addSel) return;
            addSel.innerHTML = renderClauseAddOptionsHtml(computeClauseAddCandidates(getClauseCompareRecords()));
          };
          addQIn.addEventListener('input', applyAddSearch);
          addQIn.addEventListener('compositionend', applyAddSearch);
          addQIn.addEventListener('search', applyAddSearch);
          addQIn.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.isComposing) {
              e.preventDefault();
              var cands = computeClauseAddCandidates(getClauseCompareRecords());
              if (cands[0]) addClauseOrgan(cands[0].aid);
            }
          });
        }

        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-a-preset]'), function (b) {
          b.addEventListener('click', function () {
            var p = b.getAttribute('data-a-preset') || '';
            var picks = [];
            if (p === 'LOCAL_METRO') {
              picks = organRecords.filter(function (r) { return r.isLocal && r.sectorCode === 'RAIL_TRANSIT' && r.hasUnion; });
            } else if (p === 'LOCAL_MEDICAL') {
              picks = organRecords.filter(function (r) { return r.isLocal && r.sectorCode === 'MEDICAL_HEALTH' && r.hasUnion; });
            } else {
              picks = organRecords.filter(function (r) { return !r.isLocal && r.domains.articles.length >= 8 && r.hasUnion; });
            }
            picks.sort(function (a, c) { return (c.domains.articles.length - a.domains.articles.length) || (c.memberTotal - a.memberTotal); });
            if (picks.length) {
              state.compareIds = picks.slice(0, 4).map(function (r) { return r.aid; });
            }
            renderCompareTray();
            renderTabArticles();
            syncUrlState();
          });
        });

        var goStudioBtn = bodyEl.querySelector('[data-a-go-studio]');
        if (goStudioBtn) {
          goStudioBtn.addEventListener('click', function () {
            if (!state.compareIds.length) {
              state.compareIds = getClauseCompareRecords().map(function (r) { return r.aid; });
            }
            state.mSubMode = 'STUDIO';
            switchTab('matrix');
          });
        }

        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-a-jump-org]'), function (b) {
          b.addEventListener('click', function () {
            var aid = b.getAttribute('data-a-jump-org') || '';
            var rec = organById[aid];
            state.aViewMode = 'BY_ORGAN';
            state.aPage = 0;
            if (rec) state.aQuery = rec.name;
            state.aOrgExpanded[aid] = true;
            renderCompareTray();
            renderTabArticles();
          });
        });

        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-a-org-exp]'), function (b) {
          b.addEventListener('click', function () {
            var aid = b.getAttribute('data-a-org-exp') || '';
            var curExp = b.getAttribute('aria-expanded') === 'true';
            state.aOrgExpanded[aid] = !curExp;
            updateArticlesDyn();
          });
        });

        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-a-row-exp]'), function (b) {
          b.addEventListener('click', function () {
            var rk = b.getAttribute('data-a-row-exp') || '';
            state.aRowExpanded[rk] = !state.aRowExpanded[rk];
            updateArticlesDyn();
          });
        });

        var prevBtn = bodyEl.querySelector('[data-a-prev]');
        if (prevBtn) prevBtn.addEventListener('click', function () { if (state.aPage > 0) { state.aPage -= 1; updateArticlesDyn(); } });
        var nextBtn = bodyEl.querySelector('[data-a-next]');
        if (nextBtn) nextBtn.addEventListener('click', function () { state.aPage += 1; updateArticlesDyn(); });

        populateClauseLawStrip();
      }

      var initRows = filterArticles();

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  ' + renderDocModeToggleHtml(),
        '  <div class="pau-seg" role="group" aria-label="단협 조문 보기 방식">',
        '    <button type="button" class="pau-seg-btn' + (curView === 'COMPARE' ? ' on' : '') + '" aria-pressed="' + (curView === 'COMPARE' ? 'true' : 'false') + '" data-a-view="COMPARE">⚖️ 쟁점별 다중비교</button>',
        '    <button type="button" class="pau-seg-btn' + (curView === 'BY_ORGAN' ? ' on' : '') + '" aria-pressed="' + (curView === 'BY_ORGAN' ? 'true' : 'false') + '" data-a-view="BY_ORGAN">🏛️ 기관별 묶음</button>',
        '    <button type="button" class="pau-seg-btn' + (curView === 'TABLE' ? ' on' : '') + '" aria-pressed="' + (curView === 'TABLE' ? 'true' : 'false') + '" data-a-view="TABLE">📑 전체 조문표</button>',
        '  </div>',
        '  <select data-f="aScope" aria-label="기관 권역 선택">',
        '    <option value="ALL"' + (state.aScope === 'ALL' ? ' selected' : '') + '>구분 전체 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.aScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙 ALIO</option>',
        '    <option value="LOCAL_ALL"' + (state.aScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방 전체</option>',
        '    <option value="LOCAL_ERC_MOIS"' + (state.aScope === 'LOCAL_ERC_MOIS' ? ' selected' : '') + '>🏛️ 평가원·행안부 유관</option>',
        '  </select>',
        '  <select data-f="aCat" aria-label="조문 분류 선택">',
        TAXONOMY_LIST.map(function (t) {
          return '<option value="' + esc(t[0]) + '"' + (state.aCat === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join(''),
        '  </select>',
        '  <input type="search" data-f="aQuery" aria-label="단체협약 조문 검색" placeholder="조문·기관·지역 검색 (예: 충남, 징계)" value="' + esc(state.aQuery) + '" style="min-width:190px;">',
        (curView !== 'COMPARE' ? [
          '  <select class="pau-sub-sort" data-f="aSort" aria-label="단협 조문 정렬 기준">',
          [
            ['', curView === 'BY_ORGAN' ? '정렬: 수록조문 많은순' : '정렬: 기본순'],
            ['name_asc', '정렬: 기관명 가나다 ▲'],
            ['name_desc', '정렬: 기관명 역순 ▼'],
            ['cat_asc', '정렬: 쟁점분류 가나다 ▲'],
            ['cat_desc', '정렬: 쟁점분류 역순 ▼'],
            ['no_asc', '정렬: 조문번호 오름차순 ▲'],
            ['no_desc', '정렬: 조문번호 내림차순 ▼'],
            ['tit_asc', '정렬: 조문제목 가나다 ▲'],
            ['tit_desc', '정렬: 조문제목 역순 ▼']
          ].map(function (it) {
            return '<option value="' + esc(it[0]) + '"' + ((state.aSort || '') === it[0] ? ' selected' : '') + '>' + esc(it[1]) + '</option>';
          }).join(''),
          '  </select>'
        ].join('') : ''),
        '  <span data-a-cnt style="font-size:12px;margin-left:auto;">조회 <b>' + fmtNum(initRows.length) + '</b>건</span>',
        '</div>',
        '<div data-a-dyn>' + renderArticlesDynHtml(initRows) + '</div>'
      ].join('');

      function updateArticlesDyn() {
        var rowsNow = filterArticles();
        var cntEl = bodyEl.querySelector('[data-a-cnt]');
        if (cntEl) cntEl.innerHTML = '조회 <b>' + fmtNum(rowsNow.length) + '</b>건';
        var dynEl = bodyEl.querySelector('[data-a-dyn]');
        if (dynEl) {
          dynEl.innerHTML = renderArticlesDynHtml(rowsNow);
          bindArticlesDynEvents();
        }
      }

      bindFilterInputs(renderTabArticles, { aQuery: updateArticlesDyn }, '[data-f]:not([data-f="aCmpAddQ"])');
      bindArticlesDynEvents();
    }

    function filterDisclosures() {
      var list = safeDiscs.filter(function (d) {
        var inst = instMap[d.aid] || { apba_id: d.aid };
        if (!matchOrganScope(inst, state.dScope)) return false;
        if (state.dOrgan && d.aid !== state.dOrgan) return false;
        if (state.dOrganSearch && !matchSmartQuery(getOrganSearchHaystack(d.aid, d.iname), state.dOrganSearch)) return false;
        if (state.dTax && state.dTax !== 'ALL' && String(d.ccode) !== String(state.dTax)) return false;
        if (state.dQuery) {
          var hay = getOrganSearchHaystack(d.aid, (d.iname || '') + ' ' + (d.cname || '') + ' ' + (d.title || '') + ' ' + ((d.highlights || []).join(' ')));
          if (!matchSmartQuery(hay, state.dQuery)) return false;
        }
        return true;
      });
      if (state.dSort) {
        var ds = state.dSort;
        list.sort(function (a, b) {
          if (ds === 'name_asc' || ds === 'name_desc') {
            var nc = String(a.iname || '').localeCompare(String(b.iname || ''), 'ko');
            if (nc !== 0) return ds === 'name_asc' ? nc : -nc;
          } else if (ds === 'cat_asc' || ds === 'cat_desc') {
            var cc = String(a.cname || a.ccode || '').localeCompare(String(b.cname || b.ccode || ''), 'ko');
            if (cc !== 0) return ds === 'cat_asc' ? cc : -cc;
          } else if (ds === 'date_desc' || ds === 'date_asc') {
            var ad = normalizeTimelineDate(a.edate || a.rdate || '');
            var bd = normalizeTimelineDate(b.edate || b.rdate || '');
            if ((!!ad) !== (!!bd)) return bd ? 1 : -1;
            var dc = ad.localeCompare(bd);
            if (dc !== 0) return ds === 'date_asc' ? dc : -dc;
            var tc = String(a.title || '').localeCompare(String(b.title || ''), 'ko');
            if (tc !== 0) return ds === 'date_asc' ? tc : -tc;
          }
          return String(a.iname || '').localeCompare(String(b.iname || ''), 'ko');
        });
      }
      return list;
    }

    function renderTabDetail() {
      function computeScopedOrgans() {
        var hasOrgQ = !!String(state.dOrganSearch || '').trim();
        if (state.dOrgan) {
          var curDInst = instMap[state.dOrgan];
          if (!curDInst || !matchOrganScope(curDInst, state.dScope) || (hasOrgQ && !matchSmartQuery(getOrganSearchHaystack(state.dOrgan), state.dOrganSearch))) {
            state.dOrgan = '';
          }
        }
        var cands = safeInsts.filter(function (o) {
          if (!matchOrganScope(o, state.dScope)) return false;
          if (!hasOrgQ) return true;
          return matchSmartQuery(getOrganSearchHaystack(o.apba_id), state.dOrganSearch);
        });
        if (hasOrgQ) {
          cands = sortInstsByQueryRelevance(cands, state.dOrganSearch);
        }
        return cands;
      }

      function renderDetailOrganOptionsHtml(scopedOrgans) {
        return '<option value=""' + (!state.dOrgan ? ' selected' : '') + '>전체 기관 (' + fmtNum(scopedOrgans.length) + '곳)</option>' +
          scopedOrgans.map(function (i) {
            return '<option value="' + esc(i.apba_id) + '"' + (state.dOrgan === i.apba_id ? ' selected' : '') + '>' + esc((isLocalOrgan(i) ? '(지방) ' : '(중앙) ') + i.name + ' (' + i.apba_id + ')') + '</option>';
          }).join('');
      }

      function renderDetailSelActsHtml() {
        var selectedInst = state.dOrgan ? instMap[state.dOrgan] : null;
        if (!selectedInst) return '';
        var safeSelectedUnionUrl = safeHttpUrl(buildOrganUrl(selectedInst));
        return [
          '<button type="button" class="pau-act-btn pri" data-open-organ-here="' + esc(selectedInst.apba_id) + '">🔎 ' + esc(selectedInst.name) + ' 상세</button>',
          (safeSelectedUnionUrl ? '<a class="pau-act-btn" href="' + esc(safeSelectedUnionUrl) + '"' + ((isLocalOrgan(selectedInst) && !isErcMoisOrgan(selectedInst)) ? (' data-cleaneye-post="' + esc(selectedInst.apba_id) + '" data-cleaneye-type="' + esc(state.dTax === '21110' ? 'rules' : (state.dTax === '63787' ? 'union_status' : (state.dTax === '21025' ? 'multi_union' : 'union_info'))) + '"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시 원문</a>' : '')
        ].join('');
      }

      function renderDetailDynHtml() {
        var rows = filterDisclosures();
        var curDView = state.dOrgan ? 'TABLE' : (state.dViewMode || 'BY_ORGAN');

        if (curDView === 'BY_ORGAN') {
          var orgMap = Object.create(null);
          var orgGroups = [];
          rows.forEach(function (d) {
            var g = orgMap[d.aid];
            if (!g) {
              g = {
                aid: d.aid,
                iname: d.iname || (instMap[d.aid] ? instMap[d.aid].name : d.aid),
                rec: organById[d.aid] || null,
                items: [],
                cats: Object.create(null),
                latestDate: '',
                latestDoc: null,
                repFiles: []
              };
              orgMap[d.aid] = g;
              orgGroups.push(g);
            }
            g.items.push(d);
            var cn = d.cname || d.ccode || '기타';
            g.cats[cn] = (g.cats[cn] || 0) + 1;
            var nd = normalizeTimelineDate(d.edate || d.rdate || '');
            if (!g.latestDoc || (nd && (!g.latestDate || nd > g.latestDate))) {
              if (nd) g.latestDate = nd;
              g.latestDoc = d;
            }
            if (g.repFiles.length < 2 && d.files && d.files.length) {
              d.files.forEach(function (f) {
                if (g.repFiles.length < 2) g.repFiles.push(f);
              });
            }
          });

          var ds = state.dSort || 'cnt_desc';
          orgGroups.sort(function (a, b) {
            if (ds === 'name_asc') return a.iname.localeCompare(b.iname, 'ko');
            if (ds === 'name_desc') return b.iname.localeCompare(a.iname, 'ko');
            if (ds === 'date_desc' || ds === 'date_asc') {
              if ((!!a.latestDate) !== (!!b.latestDate)) return b.latestDate ? 1 : -1;
              var dc = a.latestDate.localeCompare(b.latestDate);
              if (dc !== 0) return ds === 'date_asc' ? dc : -dc;
            }
            if (ds === 'cnt_asc') return (a.items.length - b.items.length) || a.iname.localeCompare(b.iname, 'ko');
            return (b.items.length - a.items.length) || a.iname.localeCompare(b.iname, 'ko');
          });

          var gPageSize = 60;
          var gTotalPages = Math.max(1, Math.ceil(orgGroups.length / gPageSize));
          if (state.dPage >= gTotalPages) state.dPage = gTotalPages - 1;
          if (state.dPage < 0) state.dPage = 0;
          var gStart = state.dPage * gPageSize;
          var visGroups = orgGroups.slice(gStart, gStart + gPageSize);

          return {
            totalPages: gTotalPages,
            html: [
              '<div class="pau-subbar">',
              '  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">',
              '    <div class="pau-seg" role="group" aria-label="공시·사규 보기 방식">',
              '      <button type="button" class="pau-seg-btn on" aria-pressed="true" data-d-view="BY_ORGAN">🏛️ 기관별 원문 묶음 (' + fmtNum(orgGroups.length) + '곳)</button>',
              '      <button type="button" class="pau-seg-btn" aria-pressed="false" data-d-view="TABLE">📑 문서별 전체 표 (' + fmtNum(rows.length) + '건)</button>',
              '    </div>',
              '    <span>공시 보유 기관 <b>' + fmtNum(orgGroups.length) + '</b>곳 · 문서 합계 <b>' + fmtNum(rows.length) + '</b>건</span>',
              '  </div>',
              '  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:auto;">',
              '    <select class="pau-sub-sort" data-d-sort aria-label="공시문서 정렬 기준">',
              [
                ['', '정렬: 수록문서 많은순 ▼'],
                ['cnt_asc', '정렬: 수록문서 적은순 ▲'],
                ['date_desc', '정렬: 최근 공시일 최신순 ▼'],
                ['date_asc', '정렬: 최근 공시일 오래된순 ▲'],
                ['name_asc', '정렬: 기관명 가나다 ▲'],
                ['name_desc', '정렬: 기관명 역순 ▼'],
                ['cat_asc', '정렬: 공시분류별 전체표 ▲']
              ].map(function (it) {
                return '<option value="' + esc(it[0]) + '"' + ((state.dSort || '') === it[0] ? ' selected' : '') + '>' + esc(it[1]) + '</option>';
              }).join(''),
              '    </select>',
              (orgGroups.length > gPageSize ? [
                '    <span>' + (state.dPage + 1) + ' / ' + gTotalPages + ' 페이지</span>',
                '    <button type="button" class="pau-act-btn" data-d-prev' + (state.dPage <= 0 ? ' disabled' : '') + '>◀ 이전</button>',
                '    <button type="button" class="pau-act-btn" data-d-next' + (state.dPage + 1 >= gTotalPages ? ' disabled' : '') + '>다음 ▶</button>'
              ].join('') : ''),
              '  </div>',
              '</div>',
              '<div class="pau-tbl-wrap">',
              '  <table class="pau-tbl">',
              '    <thead><tr>',
              '      <th class="c-no">№</th>',
              '      ' + renderSortTh('20%', '기관명 · 소관 (클릭→별개 창)', 'd_org_name', ds, ['name_asc', 'name_desc']),
              '      ' + renderSortTh('25%', '공시항목 분류 · 수록현황', 'd_org_cnt', ds, ['cnt_desc', 'cnt_asc']),
              '      ' + renderSortTh('22%', '최근 공시문서 · 기준연혁일', 'd_org_date', ds, ['date_desc', 'date_asc']),
              '      <th style="width:18%;">대표 첨부파일 · 뷰어</th>',
              '      <th style="width:15%;">비교 · 문서펼침</th>',
              '    </tr></thead>',
              '    <tbody>',
              (visGroups.length ? visGroups.map(function (g, idx) {
                var absIdx = gStart + idx;
                var catPills = Object.keys(g.cats).slice(0, 4).map(function (ck) {
                  var shortCk = ck.replace('노동조합 관련 현황', '노조현황').replace('단체협약 정보', '단협').replace('임금협약 정보', '임협').replace('단체협약 외의 별도 합의사항', '별도합의').replace('내부규정', '사규').replace('노사협의회 의결사항', '노사협의');
                  return '<span class="pau-pill">' + esc(shortCk + ' ' + g.cats[ck]) + '</span>';
                }).join(' ');
                var latestTitle = g.latestDoc ? (getReadableDocTitle(g.latestDoc) + (g.latestDate ? ' (' + g.latestDate + ')' : '')) : '—';
                var safeViewerUrl = g.latestDoc ? safeHttpUrl(buildOrganUrl(instMap[g.aid] || g.aid, g.latestDoc.dno, resolveTargetTypeFromDisc(g.latestDoc))) : '';
                var inCmp = state.compareIds.indexOf(g.aid) >= 0;
                var dExpVal = state.dOrgExpanded[g.aid];
                var isExp = dExpVal === true || (dExpVal === undefined && orgGroups.length === 1);
                return [
                  '<tr>',
                  '  <td class="c-no">' + (absIdx + 1) + '</td>',
                  '  <td title="' + esc(g.iname + (g.rec ? ' · ' + g.rec.ministry : '')) + '">' +
                    '<a href="pu-alio-union.html?organ=' + encodeURIComponent(g.aid) + '" data-jump-organ="' + esc(g.aid) + '" style="font-weight:700;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(g.iname) + '</a>' +
                    (g.rec ? ' <span style="font-size:11px;color:var(--pau-muted);">(' + esc(g.rec.ministry) + ')</span>' : '') +
                  '</td>',
                  '  <td style="white-space:normal;"><div style="display:flex;gap:3px;flex-wrap:wrap;align-items:center;"><span class="pau-pill ok">총 ' + g.items.length + '건</span>' + catPills + '</div></td>',
                  '  <td title="' + esc(latestTitle) + '" style="font-weight:600;">' + esc(latestTitle) + '</td>',
                  '  <td style="white-space:normal;"><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">' +
                    renderFilePills(g.repFiles, '원문다운') +
                    (safeViewerUrl ? '<a class="pau-pill ok" href="' + esc(safeViewerUrl) + '"' + ((isLocalOrgan(g.aid) && !isErcMoisOrgan(g.aid)) ? (' data-cleaneye-post="' + esc(g.aid) + '" data-cleaneye-type="' + esc(resolveTargetTypeFromDisc(g.latestDoc)) + '"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 뷰어</a>' : '') +
                  '</div></td>',
                  '  <td style="white-space:normal;"><div style="display:flex;gap:4px;flex-wrap:wrap;">' +
                    '<button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(g.aid) + '">' + (inCmp ? '✓비교' : '+비교') + '</button>' +
                    '<button type="button" class="pau-act-btn' + (isExp ? ' pri' : '') + '" data-d-org-exp="' + esc(g.aid) + '" aria-expanded="' + (isExp ? 'true' : 'false') + '">' + (isExp ? '▲ 접기' : ('📂 펼침(' + g.items.length + ')')) + '</button>' +
                  '</div></td>',
                  '</tr>',
                  (isExp ? '<tr class="pau-exp-row"><td colspan="6"><div class="pau-doc-list" style="padding:4px 0;">' +
                    g.items.slice(0, 25).map(function (d) {
                      var nd = normalizeTimelineDate(d.edate || d.rdate || '') || (d.edate || d.rdate || '');
                      var dTarget = resolveTargetTypeFromDisc(d);
                      var vUrl = safeHttpUrl(buildOrganUrl(instMap[d.aid] || d.aid, d.dno, dTarget));
                      return '<div class="pau-doc-row">' +
                        '<span class="pau-pill">' + esc(d.cname || d.ccode) + '</span>' +
                        (nd ? '<span class="pau-doc-dt">' + esc(nd) + '</span>' : '') +
                        '<span class="pau-doc-tit">' + esc(getReadableDocTitle(d)) + '</span>' +
                        '<div class="pau-doc-acts">' +
                          renderFilePills(d.files || [], '다운로드') +
                          (vUrl ? '<a class="pau-pill ok" href="' + esc(vUrl) + '"' + ((isLocalOrgan(d.aid) && !isErcMoisOrgan(d.aid)) ? (' data-cleaneye-post="' + esc(d.aid) + '" data-cleaneye-type="' + esc(dTarget) + '"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시뷰어</a>' : '') +
                        '</div>' +
                      '</div>';
                    }).join('') +
                  '</div></td></tr>' : '')
                ].join('');
              }).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--pau-muted);">선택한 조건에 해당하는 공시·내부규정 문서가 없습니다.</td></tr>'),
              '    </tbody>',
              '  </table>',
              '</div>'
            ].join('')
          };
        }

        var pageSize = 300;
        var totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        if (state.dPage >= totalPages) state.dPage = totalPages - 1;
        if (state.dPage < 0) state.dPage = 0;
        var startIdx = state.dPage * pageSize;
        var visibleRows = rows.slice(startIdx, startIdx + pageSize);

        return {
          totalPages: totalPages,
          html: [
            '<div class="pau-subbar">',
            '  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">',
            (!state.dOrgan ? [
              '    <div class="pau-seg" role="group" aria-label="공시·사규 보기 방식">',
              '      <button type="button" class="pau-seg-btn" aria-pressed="false" data-d-view="BY_ORGAN">🏛️ 기관별 원문 묶음</button>',
              '      <button type="button" class="pau-seg-btn on" aria-pressed="true" data-d-view="TABLE">📑 문서별 전체 표 (' + fmtNum(rows.length) + '건)</button>',
              '    </div>'
            ].join('') : ''),
            '    <span>조회 공시·사규 문서 <b>' + fmtNum(rows.length) + '</b>건' + (rows.length > pageSize ? ' (' + fmtNum(startIdx + 1) + '~' + fmtNum(startIdx + visibleRows.length) + '번째 표시)' : '') + '</span>',
            '  </div>',
            '  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:auto;">',
            '    <select class="pau-sub-sort" data-d-sort aria-label="공시문서 정렬 기준">',
            [
              ['', '정렬: 기본순'],
              ['date_desc', '정렬: 기준연혁일 최신순 ▼'],
              ['date_asc', '정렬: 기준연혁일 오래된순 ▲'],
              ['name_asc', '정렬: 기관명 가나다 ▲'],
              ['name_desc', '정렬: 기관명 역순 ▼'],
              ['cat_asc', '정렬: 공시분류 가나다 ▲'],
              ['cat_desc', '정렬: 공시분류 역순 ▼']
            ].map(function (it) {
              return '<option value="' + esc(it[0]) + '"' + ((state.dSort || '') === it[0] ? ' selected' : '') + '>' + esc(it[1]) + '</option>';
            }).join(''),
            '    </select>',
            (rows.length > pageSize ? [
              '    <span>' + (state.dPage + 1) + ' / ' + totalPages + ' 페이지</span>',
              '    <button type="button" class="pau-act-btn" data-d-prev' + (state.dPage <= 0 ? ' disabled' : '') + '>◀ 이전</button>',
              '    <button type="button" class="pau-act-btn" data-d-next' + (state.dPage + 1 >= totalPages ? ' disabled' : '') + '>다음 ▶</button>'
            ].join('') : ''),
            '  </div>',
            '</div>',
            '<div class="pau-tbl-wrap">',
            '  <table class="pau-tbl">',
            '    <thead><tr><th class="c-no">№</th>' +
              renderSortTh('17%', '기관명 (클릭→별개 창)', 'd_name', state.dSort, ['name_asc', 'name_desc']) +
              renderSortTh('14%', '공시항목 분류', 'd_cat', state.dSort, ['cat_asc', 'cat_desc']) +
              renderSortTh('23%', '문서 제목 · 기준연혁일', 'd_date', state.dSort, ['date_desc', 'date_asc']) +
              '<th style="width:22%;">원문 첨부파일 · 공시뷰어 API</th><th style="width:24%;">본문 요약 · 추출 미리보기</th></tr></thead>',
            '    <tbody>',
            (visibleRows.length ? visibleRows.map(function (d, idx) {
              var absIdx = startIdx + idx;
              var files = d.files || [];
              var firstFile = files[0] || null;
              var dTargetType = resolveTargetTypeFromDisc(d);
              var filePillsHtml = renderFilePills(files, '원문다운');
              var safeViewerUrl = safeHttpUrl(buildOrganUrl(instMap[d.aid] || d.aid, d.dno, dTargetType));
              var kvParts = formatCleanKvPairs(d.kv, 4).map(function (it) { return it.text; });
              if (!kvParts.length && firstFile && firstFile.name) {
                kvParts.push('첨부원문: ' + stripFileExt(firstFile.name) + (files.length > 1 ? (' 외 ' + (files.length - 1) + '건') : ''));
              }
              var prev = ((d.highlights || []).join(' ') || kvParts.join(' · ')).replace(/\s+/g, ' ').trim();
              var normDt = normalizeTimelineDate(d.edate || d.rdate || '');
              var rawDt = String(d.edate || d.rdate || '').trim();
              var cleanTitle = String(getReadableDocTitle(d) || '').replace(/\((20\d{2}[^()]{3,18})\)\s*$/, '[$1]');
              var titFull = cleanTitle + (normDt ? ' (' + normDt + ')' : (rawDt ? ' [' + rawDt + ']' : ''));
              return [
                '<tr>',
                '  <td class="c-no">' + (absIdx + 1) + '</td>',
                '  <td title="' + esc(d.iname) + '"><a href="pu-alio-union.html?organ=' + encodeURIComponent(d.aid) + '" data-jump-organ="' + esc(d.aid) + '" style="font-weight:700;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(d.iname) + '</a></td>',
                '  <td><span class="pau-pill">' + esc(d.cname || d.ccode) + '</span></td>',
                '  <td title="' + esc(titFull) + '" style="font-weight:600;">' + esc(titFull) + '</td>',
                '  <td style="white-space:normal;" title="' + esc((firstFile ? firstFile.name : '') + ' ' + (safeViewerUrl || '')) + '"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' +
                  filePillsHtml +
                  (safeViewerUrl ? '<a class="pau-pill ok" href="' + esc(safeViewerUrl) + '"' + ((isLocalOrgan(d.aid) && !isErcMoisOrgan(d.aid)) ? (' data-cleaneye-post="' + esc(d.aid) + '" data-cleaneye-type="' + esc(dTargetType) + '"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시뷰어</a>' : '') +
                  '</div></td>',
                '  <td title="' + esc(prev) + '"><span>' + esc(prev || '—') + '</span></td>',
                '</tr>'
              ].join('');
            }).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--pau-muted);">선택한 조건에 해당하는 공시·내부규정 문서가 없습니다.</td></tr>'),
            '    </tbody>',
            '  </table>',
            '</div>'
          ].join('')
        };
      }

      var scopedOrgans = computeScopedOrgans();
      var initDyn = renderDetailDynHtml();

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  ' + renderDocModeToggleHtml(),
        '  <select data-f="dScope" aria-label="중앙·지방 구분">',
        '    <option value="ALL"' + (state.dScope === 'ALL' ? ' selected' : '') + '>구분 전체 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.dScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙 ALIO</option>',
        '    <option value="LOCAL_ALL"' + (state.dScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방 전체</option>',
        '    <option value="LOCAL_ERC_MOIS"' + (state.dScope === 'LOCAL_ERC_MOIS' ? ' selected' : '') + '>🏛️ 평가원·행안부 유관</option>',
        '  </select>',
        '  <input type="search" data-f="dOrganSearch" aria-label="공시 조회 기관명·지역 필터" placeholder="기관·지역 검색" value="' + esc(state.dOrganSearch) + '" style="min-width:130px;max-width:175px;">',
        '  <select data-f="dOrgan" aria-label="공시 조회 기관 선택">',
        renderDetailOrganOptionsHtml(scopedOrgans),
        '  </select>',
        '  <select data-f="dTax" aria-label="공시 항목 분류 선택">',
        DISC_CCODE_LIST.map(function (t) {
          return '<option value="' + esc(t[0]) + '"' + (state.dTax === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join(''),
        '  </select>',
        '  <input type="search" data-f="dQuery" aria-label="공시문서 검색" placeholder="문서·첨부파일명 검색" value="' + esc(state.dQuery) + '" style="min-width:175px;max-width:240px;">',
        '  <span data-d-sel-acts style="display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;">' + renderDetailSelActsHtml() + '</span>',
        '</div>',
        '<div data-d-dyn>' + initDyn.html + '</div>'
      ].join('');

      function bindDetailPager(totalPagesNow) {
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-d-view]'), function (b) {
          b.addEventListener('click', function () {
            var nextDV = b.getAttribute('data-d-view') || 'BY_ORGAN';
            state.dViewMode = nextDV;
            state.dPage = 0;
            updateDetailDyn();
            var focusBtn = bodyEl.querySelector('[data-d-view="' + nextDV + '"]');
            if (focusBtn && typeof focusBtn.focus === 'function') focusBtn.focus();
          });
        });
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-d-org-exp]'), function (b) {
          b.addEventListener('click', function () {
            var aid = b.getAttribute('data-d-org-exp') || '';
            var curExp = b.getAttribute('aria-expanded') === 'true';
            state.dOrgExpanded[aid] = !curExp;
            updateDetailDyn();
          });
        });
        var dSortSel = bodyEl.querySelector('[data-d-sort]');
        if (dSortSel) {
          dSortSel.addEventListener('change', function () {
            state.dSort = dSortSel.value || '';
            if (state.dSort === 'cat_asc' || state.dSort === 'cat_desc') {
              state.dViewMode = 'TABLE';
            }
            state.dPage = 0;
            updateDetailDyn();
            var nextDSel = bodyEl.querySelector('[data-d-sort]');
            if (nextDSel && typeof nextDSel.focus === 'function') nextDSel.focus();
          });
        }
        var prevBtn = bodyEl.querySelector('[data-d-prev]');
        if (prevBtn) prevBtn.addEventListener('click', function () { if (state.dPage > 0) { state.dPage -= 1; updateDetailDyn(); } });
        var nextBtn = bodyEl.querySelector('[data-d-next]');
        if (nextBtn) nextBtn.addEventListener('click', function () { if (state.dPage + 1 < totalPagesNow) { state.dPage += 1; updateDetailDyn(); } });
      }

      function updateDetailDyn() {
        var dynEl = bodyEl.querySelector('[data-d-dyn]');
        if (!dynEl) return;
        var nextDyn = renderDetailDynHtml();
        dynEl.innerHTML = nextDyn.html;
        bindDetailPager(nextDyn.totalPages);
      }

      function updateDetailOrganSearch() {
        var nextScoped = computeScopedOrgans();
        var dOrgSel = bodyEl.querySelector('select[data-f="dOrgan"]');
        if (dOrgSel) {
          dOrgSel.innerHTML = renderDetailOrganOptionsHtml(nextScoped);
          dOrgSel.value = state.dOrgan || '';
        }
        var selActsEl = bodyEl.querySelector('[data-d-sel-acts]');
        if (selActsEl) selActsEl.innerHTML = renderDetailSelActsHtml();
        updateDetailDyn();
      }

      bindFilterInputs(renderTabDetail, {
        dOrganSearch: updateDetailOrganSearch,
        dQuery: updateDetailDyn
      });
      bindDetailPager(initDyn.totalPages);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 탭 5(유틸): 공공·법령 API 실시간 연동 센터
    // ════════════════════════════════════════════════════════════════════════
    function renderTabApiHub() {
      function computeApiOrgans(preferTopMatch) {
        var hasQ = !!String(state.apiAlioSearch || '').trim();
        var list = safeInsts.filter(function (o) {
          if (!hasQ) return true;
          return matchSmartQuery(getOrganSearchHaystack(o.apba_id), state.apiAlioSearch);
        });
        if (hasQ) {
          list = sortInstsByQueryRelevance(list, state.apiAlioSearch);
        }
        var curInst = instMap[state.apiAlioAid] || safeInsts[0] || { apba_id: 'C0005', name: '(주)강원랜드' };
        if (!hasQ) {
          if (list.every(function (o) { return o.apba_id !== curInst.apba_id; })) list.unshift(curInst);
          state.apiAlioAid = curInst.apba_id;
        } else if (list.length > 0 && (preferTopMatch || list.every(function (o) { return o.apba_id !== state.apiAlioAid; }))) {
          state.apiAlioAid = list[0].apba_id;
        }
        return list;
      }

      function renderApiOrganOptionsHtml(apiOrgans) {
        if (!apiOrgans.length) return '<option value="">검색 결과 없음 (0곳)</option>';
        return apiOrgans.map(function (i) {
          return '<option value="' + esc(i.apba_id) + '"' + (state.apiAlioAid === i.apba_id ? ' selected' : '') + '>' + esc((isLocalOrgan(i) ? '(지방) ' : '(중앙) ') + i.name + ' (' + i.apba_id + ')') + '</option>';
        }).join('');
      }

      function renderApiOrganActsHtml() {
        var inst = instMap[state.apiAlioAid] || safeInsts[0] || { apba_id: 'C0005', name: '(주)강원랜드' };
        var isLoc = isLocalOrgan(inst);
        var alioLiveUrl = isLoc
          ? 'https://www.cleaneye.go.kr/user/gongsiCompare/selectGongsiCompare.do'
          : ('https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(inst.apba_id) + '&reportFormRootNo=' + encodeURIComponent(state.apiAlioTax));
        var alioRuleUrl = isLoc
          ? alioLiveUrl
          : ('https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(inst.apba_id) + '&reportFormRootNo=21110');
        return [
          '<button type="button" class="pau-act-btn pri" data-jump-organ="' + esc(inst.apba_id) + '">↗ ' + esc(inst.name) + ' 6대영역·비교 창 열기</button>',
          (isLoc
            ? ('<button type="button" class="pau-act-btn" data-cleaneye-post="' + esc(inst.apba_id) + '" data-cleaneye-type="union_info">🔗 ' + (isErcMoisOrgan(inst) ? '기관 임단협·노조 공시 열기' : '클린아이 협약정보(14_2/90_25) 직결') + '</button>' +
               '<button type="button" class="pau-act-btn" data-cleaneye-post="' + esc(inst.apba_id) + '" data-cleaneye-type="union_status">👥 노조현황(14_1/90_20) 직결</button>' +
               '<button type="button" class="pau-act-btn" data-cleaneye-post="' + esc(inst.apba_id) + '" data-cleaneye-type="rules">📘 정관·내부규정(11_1/90_40) 직결</button>' +
               '<button type="button" class="pau-act-btn" data-cleaneye-post="' + esc(inst.apba_id) + '" data-cleaneye-type="welfare">🏖️ 휴가·복리후생 직결</button>')
            : ('<a class="pau-act-btn" href="' + esc(alioLiveUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 ALIO 공시 열기</a>' +
               '<a class="pau-act-btn" href="' + esc(alioRuleUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📘 내부규정 열기</a>'))
        ].join('');
      }

      var apiOrgans = computeApiOrgans();
      var alioDocUrl = 'https://www.alio.go.kr/download/file.json?f=FILE&d=DOC';

      bodyEl.innerHTML = [
        '<div class="pau-api-grid">',
        '  <div class="pau-card">',
        '    <div class="pau-card-hd"><span>⚖️ 1. 대한민국 노동관계법령 실시간 API (노조법·근로기준법·참여법·고령자법)</span><span class="pau-pill ok">실시간 연결됨</span></div>',
        '    <div class="pau-flt" style="margin:4px 0;">',
        '      <select data-f="apiLawKey" aria-label="조회할 노동관계법령 선택">',
        LAW_API_SOURCES.map(function (l) {
          return '<option value="' + esc(l.key) + '"' + (state.apiLawKey === l.key ? ' selected' : '') + '>' + esc(l.name) + '</option>';
        }).join(''),
        '      </select>',
        '      <input type="text" data-f="apiLawArt" aria-label="법령 조문번호 입력" placeholder="조문번호 (예: 24)" value="' + esc(state.apiLawArt) + '" style="min-width:145px;max-width:185px;">',
        '      <button type="button" class="pau-act-btn pri" data-api-law-run>법령 조문 조회</button>',
        '    </div>',
        '    <pre class="pau-card-pre" data-api-law-out style="max-height:260px;">조회 중...</pre>',
        '  </div>',
        '  <div class="pau-card">',
        '    <div class="pau-card-hd"><span>🏛️ 2. 중앙 ALIO + 지방 클린아이(Cleaneye) + 평가원 원문 직결 API</span><span class="pau-pill ok">실시간 연결됨</span></div>',
        '    <div class="pau-flt" style="margin:4px 0;">',
        '      <input type="search" data-f="apiAlioSearch" aria-label="API 대상 기관명·지역 검색" placeholder="기관·지역 검색" value="' + esc(state.apiAlioSearch) + '" style="min-width:130px;max-width:180px;">',
        '      <select data-f="apiAlioAid" aria-label="API 대상 기관 선택">',
        renderApiOrganOptionsHtml(apiOrgans),
        '      </select>',
        '      <select data-f="apiAlioTax" aria-label="공시 항목 코드 선택">',
        DISC_CCODE_LIST.filter(function (x) { return x[0] !== 'ALL'; }).map(function (t) {
          return '<option value="' + esc(t[0]) + '"' + (state.apiAlioTax === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join(''),
        '      </select>',
        '    </div>',
        '    <div data-api-organ-acts style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;">',
        renderApiOrganActsHtml(),
        '    </div>',
        '    <pre class="pau-card-pre" style="max-height:220px;">' + esc([
          '• 중앙공공기관(ALIO 355곳): https://www.alio.go.kr/item/itemOrganList.do?apbaId={기관코드}&reportFormRootNo={항목코드}',
          '• 지방공기업(클린아이 429곳): https://www.cleaneye.go.kr/user/empWorkUnionInfo.do (단협·임협·별도합의·내부규정 POST 직결)',
          '• 지방출자·출연기관(클린아이 903곳): https://www.cleaneye.go.kr/user/iptUnionCnvt.do (노조현황·협약·정관·복리후생 POST 직결)',
          '• 행안부 산하 지방유관 6곳: 지방공기업평가원(ERC)·한국지역정보개발원(KLID)·KRILA·KILF·LOFA·POBA 원문 직결',
          '• 첨부파일 다운로드: ALIO (' + alioDocUrl + ') / 클린아이 (/file/FileDownload.do)'
        ].join('\n')) + '</pre>',
        '  </div>',
        '  <div class="pau-card">',
        '    <div class="pau-card-hd"><span>🔑 3. 공공데이터포털 (data.go.kr) Open API 열쇠 & 공휴일 캐시 연동</span><span class="pau-pill ' + (state.apiDataKey ? 'ok' : 'multi') + '">' + esc(state.apiKeySource) + '</span></div>',
        '    <div class="pau-flt" style="margin:4px 0;">',
        '      <input type="password" data-api-key-in aria-label="공공데이터포털 인증키 입력" placeholder="공공데이터포털 인증키 입력" value="' + esc(state.apiDataKey) + '" autocomplete="off" style="min-width:210px;">',
        '      <button type="button" class="pau-act-btn pri" data-api-key-save>인증키 저장·동기화</button>',
        '    </div>',
        '    <pre class="pau-card-pre" style="max-height:220px;">' + esc([
          '• 푸른 통합시스템 정부사업신청(gov/{uid}/key_data) 및 공휴일 API(pubdata/common/holidays)와 자동 연동됩니다.',
          '• 한국천문연구원 특일정보(공휴일) 캐시 수신 건수: ' + (state.apiHolidays.length ? state.apiHolidays.length + '건 연동됨' : '포털 로그인 시 자동 수신'),
          '• 전체 수록 현황: 총 ' + fmtNum(totalInst) + '개 기관 (중앙 ALIO ' + fmtNum(centralInstCount) + '곳 + 지방·유관 ' + fmtNum(localInstCount) + '곳)'
        ].join('\n')) + '</pre>',
        '  </div>',
        '</div>'
      ].join('');

      var lawOut = bodyEl.querySelector('[data-api-law-out]');
      var lawDebounceTimer = null;
      function runLawLookup() {
        if (!lawOut) return;
        lawOut.textContent = '법령 API 호출 중...';
        fetchLawLive(state.apiLawKey, function (err, law) {
          if (err || !law) {
            lawOut.textContent = '법령 조회 실패: ' + (err ? err.message : '');
            return;
          }
          var artKey = state.apiLawArt.replace(/^제/, '').replace(/조$/, '').trim();
          var art = law.arts[artKey];
          if (art) {
            lawOut.textContent = '(' + law.title + ' · 공포 ' + law.promulgated + ' · 시행 ' + law.effective + ')\n' +
              art.no + '(' + art.title + ')\n\n' + art.text;
          } else {
            var keys = Object.keys(law.arts).slice(0, 25).map(function (k) { return '제' + k + '조(' + law.arts[k].title + ')'; });
            lawOut.textContent = '(' + law.title + ') 제' + artKey + '조를 찾을 수 없습니다.\n주요 조문 목록: ' + keys.join(', ') + ' ...';
          }
        });
      }
      runLawLookup();

      function updateApiLawArt() {
        if (lawDebounceTimer) clearTimeout(lawDebounceTimer);
        lawDebounceTimer = setTimeout(runLawLookup, 120);
      }

      function updateApiOrganSearch() {
        var nextOrgans = computeApiOrgans(true);
        var aidSel = bodyEl.querySelector('select[data-f="apiAlioAid"]');
        if (aidSel) {
          aidSel.innerHTML = renderApiOrganOptionsHtml(nextOrgans);
          if (nextOrgans.length) aidSel.value = state.apiAlioAid;
        }
        var actsEl = bodyEl.querySelector('[data-api-organ-acts]');
        if (actsEl) actsEl.innerHTML = renderApiOrganActsHtml();
      }

      bindFilterInputs(renderTabApiHub, {
        apiLawArt: updateApiLawArt,
        apiAlioSearch: updateApiOrganSearch
      });

      var lawArtIn = bodyEl.querySelector('input[data-f="apiLawArt"]');
      if (lawArtIn) {
        lawArtIn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            if (lawDebounceTimer) clearTimeout(lawDebounceTimer);
            runLawLookup();
          }
        });
      }

      var runBtn = bodyEl.querySelector('[data-api-law-run]');
      if (runBtn) runBtn.addEventListener('click', runLawLookup);

      var saveKeyBtn = bodyEl.querySelector('[data-api-key-save]');
      var keyIn = bodyEl.querySelector('[data-api-key-in]');
      if (saveKeyBtn && keyIn) {
        saveKeyBtn.addEventListener('click', function () {
          var v = keyIn.value.trim();
          var uid = getActiveUid();
          if (!uid) {
            state.apiKeySource = '로그인 후 계정에 저장할 수 있습니다';
            renderTabApiHub();
            return;
          }
          state.apiDataKey = v;
          state.apiKeySource = v ? '계정 전용 저장 열쇠' : '미설정';
          try {
            if (v) localStorage.setItem(userLsKey(uid), v);
            else localStorage.removeItem(userLsKey(uid));
          } catch (e) {}
          try {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.database) {
              var p = firebase.database().ref('gov/' + uid + '/key_data').set(v);
              if (p && typeof p.then === 'function') {
                state.apiKeySource = 'Firebase 동기화 중...';
                renderTabApiHub();
                p.then(function () {
                  if (getActiveUid() !== uid) return;
                  state.apiKeySource = 'Firebase gov/' + uid.slice(0, 6) + '… 동기화 완료';
                  if (state.tab === 'apihub') renderTabApiHub();
                }).catch(function (err) {
                  if (getActiveUid() !== uid) return;
                  state.apiKeySource = '로컬 저장됨 (서버 동기화 실패: ' + ((err && err.message) ? err.message : '권한/네트워크 오류') + ')';
                  if (state.tab === 'apihub') renderTabApiHub();
                });
                return;
              } else {
                state.apiKeySource = 'Firebase gov/' + uid.slice(0, 6) + '… 동기화 완료';
              }
            }
          } catch (e) {
            state.apiKeySource = '로컬 저장됨 (서버 오류)';
          }
          renderTabApiHub();
        });
      }
    }

    function bindFilterInputs(rerender, inputHandlers, customSelector) {
      var handlers = inputHandlers || {};
      var selector = customSelector || '[data-f]';
      Array.prototype.forEach.call(bodyEl.querySelectorAll(selector), function (el) {
        var key = el.getAttribute('data-f');
        if (!key) return;
        if (el.tagName === 'SELECT') {
          el.addEventListener('change', function () {
            state[key] = el.value;
            if (key === 'uMinistry') {
              state.uMuni = '';
            }
            if (key === 'rProvince') {
              state.rMuni = '';
              state.rMultiMode = false;
              state.rMultiProvs = [];
              state.rMultiMunis = [];
              state.rChecked = {};
            }
            if (key === 'rMuni') {
              state.rMultiMunis = [];
              state.rChecked = {};
            }
            if (key === 'uScope' || key === 'uSector' || key === 'uType' || key === 'uMinistry' || key === 'uMuni' || key === 'uConfed' || key === 'uStruct' || key === 'uSort') {
              state.uPage = 0;
            }
            if (key === 'aScope' || key === 'aCat' || key === 'aSort') {
              state.aPage = 0;
              if (key === 'aSort' && (el.value.indexOf('no_') === 0 || el.value.indexOf('tit_') === 0 || el.value.indexOf('cat_') === 0)) {
                state.aViewMode = 'TABLE';
              }
            }
            if (key === 'dScope' || key === 'dOrgan' || key === 'dTax') {
              state.dPage = 0;
            }
            if (key === 'hOrgan') {
              state.hCatFilter = '';
              state.hVerA = null;
              state.hVerB = null;
            }
            rerender();
            var next = bodyEl.querySelector('[data-f="' + key + '"]');
            if (next && typeof next.focus === 'function') next.focus();
          });
          return;
        }

        // 텍스트/검색 입력창: 한글 IME 자모 조합 및 커서 보호를 위해 <input> DOM을 절대 파괴하지 않고 부분 영역만 즉시 갱신
        var lastAppliedVal = state[key];
        function applyTextInput(forceRun) {
          var nextVal = el.value;
          state[key] = nextVal;
          if (!forceRun && nextVal === lastAppliedVal) return;
          lastAppliedVal = nextVal;
          if (key === 'uQuery') state.uPage = 0;
          if (key === 'aQuery') state.aPage = 0;
          if (key === 'dOrganSearch' || key === 'dQuery') state.dPage = 0;
          if (typeof handlers[key] === 'function') {
            handlers[key](nextVal, el);
          }
        }
        el.addEventListener('input', function () {
          applyTextInput(false);
        });
        el.addEventListener('compositionend', function () {
          applyTextInput(false);
        });
        el.addEventListener('search', function () {
          applyTextInput(false);
        });
      });
    }

    function exportCurrentTabCsv() {
      if (state.tab === 'unions') {
        if (state.uViewMode === 'FLAT_UNION') {
          var uRows = filterFlatUnions();
          downloadCsv(
            '공공임단협_단위노조상세현황.csv',
            ['기관코드', '구분', '기관명', '소관부처_지자체', '기관유형', '노조형태', '노동조합명', '교섭권', '상급단체', '연맹', '가입대상', '조합원수', '타임오프시간'],
            uRows.map(function (r) {
              return [r.apba_id, isLocalOrgan(r) ? '지방' : '중앙', r.inst_name, r.ministry, r.inst_type, r.union_structure, r.union_name, r.bargaining_right, r.confederation, r.federation, r.eligible_count, r.member_total, r.timeoff_hours];
            })
          );
        } else {
          var oRows = filterOrganMasterList();
          downloadCsv(
            '공공임단협_기관별통합분류현황.csv',
            ['기관코드', '권역', '기관명', '소관부처_지자체', '기초지자체', '업종분류', '기관유형', '노조체계', '단위노조수', '대표노조', '상급단체', '가입대상', '합산조합원', '조직률(%)', '타임오프(h)', '법정상한(h)', '한도사용률(%)', '단협건수', '임협건수', '별도합의건수', '사규건수', '종합점수'],
            oRows.map(function (r) {
              return [
                r.aid, r.scopeLabel, r.name, r.ministry, r.muniName || '', r.sectorLabel, r.inst_type, r.unionStructLabel,
                r.unionCount, r.repUnion ? r.repUnion.union_name : '', r.confeds.join('/'),
                r.eligibleCount, r.memberTotal, r.orgRate, r.timeoffHours, r.legalTimeoffLimit, r.timeoffLimitPct,
                r.domains.caDiscs.length, r.domains.wageDiscs.length, r.domains.sepDiscs.length, r.domains.ruleDiscs.length, r.totalScore
              ];
            })
          );
        }
      } else if (state.tab === 'organ') {
        var tl = buildOrganTimeline(data, state.hOrgan);
        var inst = instMap[state.hOrgan] || { name: state.hOrgan };
        downloadCsv(
          '공공임단협_기관연혁_' + (inst.name || state.hOrgan) + '.csv',
          ['기관코드', '기관명', '일자', '연도', '분류', '항목명', '제목', '주요내용요약'],
          tl.map(function (t) {
            return [state.hOrgan, inst.name || '', t.date, t.year, t.catGroup, t.cname, t.title, t.summary];
          })
        );
      } else if (state.tab === 'matrix' && state.mSubMode === 'REGION') {
        var regRowsCsv = filterRegionalOrgans();
        var regLabel = (state.rMultiMode && state.rMultiProvs.length >= 2)
          ? state.rMultiProvs.join('_')
          : ((state.rProvince === 'ALL' ? '전국지방' : (state.rProvince || '충청남도')) + ((state.rMultiMode && state.rMultiMunis.length >= 2) ? ('_' + state.rMultiMunis.slice(0, 4).join('_')) : (state.rMuni ? ('_' + state.rMuni) : '')));
        downloadCsv(
          '공공임단협_지역산하기관비교_' + regLabel + '.csv',
          ['기관코드', '광역지자체', '소속_기초지자체', '산하기관명', '기관유형', '업종분류', '노조체계', '대표노조', '상급단체', '합산조합원', '조직률(%)', '타임오프(h)', '법정상한비율(%)', '인사관여', '징계위구성', '유급휴가', '근로시간_유연근무', '임금피크_정년', '공시문서수', '6대영역종합점수'],
          regRowsCsv.map(function (r) {
            return [
              r.aid, r.provinceKey, r.muniName || '', r.name, r.inst_type, r.sectorLabel, r.unionStructLabel,
              r.repUnion ? r.repUnion.union_name : '', r.confeds.join('/'),
              r.memberTotal, r.orgRate, r.timeoffHours, r.timeoffLimitPct,
              (r.issueScores.personnel_participation || {}).val || '',
              (r.issueScores.discipline_committee || {}).val || '',
              (r.issueScores.paid_holidays_leave || {}).val || '',
              (r.issueScores.work_hours_overtime || {}).val || '',
              (r.issueScores.retirement_age_peak || {}).val || '', r.discTotal, r.totalScore
            ];
          })
        );
      } else if (state.tab === 'matrix' && state.mSubMode === 'STUDIO') {
        var cmpList = getActiveCompareRecords();
        var headers = ['구분', '항목명'].concat(cmpList.map(function (r) { return r.name; }));
        var csvRows = [
          ['정량지표', '권역·소관'].concat(cmpList.map(function (r) { return r.scopeLabel + ' ' + r.ministry; })),
          ['정량지표', '업종·기관유형'].concat(cmpList.map(function (r) { return r.sectorLabel + ' ' + r.inst_type; })),
          ['정량지표', '노조체계'].concat(cmpList.map(function (r) { return r.unionStructLabel; })),
          ['정량지표', '합산조합원(명)'].concat(cmpList.map(function (r) { return r.memberTotal; })),
          ['정량지표', '조직률(%)'].concat(cmpList.map(function (r) { return r.orgRate; })),
          ['정량지표', '타임오프(시간)'].concat(cmpList.map(function (r) { return r.timeoffHours; })),
          ['정량지표', '법정한도대비(%)'].concat(cmpList.map(function (r) { return r.timeoffLimitPct; })),
          ['정량지표', '6대영역 종합점수'].concat(cmpList.map(function (r) { return r.totalScore; }))
        ];
        METRIC_DEFS.forEach(function (d) {
          csvRows.push(['13대쟁점', d.label].concat(cmpList.map(function (r) {
            var sc = r.issueScores[d.key];
            return '[' + sc.tag + '·' + sc.score + '점] ' + sc.val;
          })));
        });
        downloadCsv('공공임단협_다중기관비교분석표.csv', headers, csvRows);
      } else if (state.tab === 'matrix') {
        var mRows = filterMatrix();
        var def = METRIC_DEFS.find(function (d) { return d.key === state.mIssue; }) || METRIC_DEFS[0];
        downloadCsv(
          '공공임단협_13대쟁점_' + def.label + '.csv',
          ['쟁점', '기관코드', '기관명', '기관유형', '지표요약', '관련조문', '조문발췌'],
          mRows.map(function (r) {
            return [def.label, r.apba_id, r.inst_name, r.inst_type, r.metric_value, r.evidence_article, r.snippet];
          })
        );
      } else if (state.tab === 'articles' && state.docMode !== 'DISC') {
        if (state.aViewMode === 'COMPARE') {
          var cRecs = getClauseCompareRecords();
          var cHeaders = ['쟁점_분류', '항목'].concat(cRecs.map(function (r) { return r.name; }));
          var cRows = METRIC_DEFS.map(function (d) {
            var tc = METRIC_TO_TAXONOMY[d.key] || '';
            return [d.label, '기준진단·수록조문'].concat(cRecs.map(function (r) {
              var sc = r.issueScores[d.key];
              var mArts = r.domains.articles.filter(function (a) { return a.taxonomy_code === tc; }).map(function (a) {
                return (formatArticleNoLabel(a.article_no) ? formatArticleNoLabel(a.article_no) + ' ' : '') + (a.article_title || '') + ': ' + String(a.text || '').replace(/\s+/g, ' ').trim();
              }).join(' / ');
              return '[' + sc.tag + '] ' + sc.val + (mArts ? ' | ' + mArts : '');
            }));
          });
          downloadCsv('공공임단협_단협조문다중비교.csv', cHeaders, cRows);
        } else {
          var arts = filterArticles();
          downloadCsv(
            '공공임단협_단협조문검색.csv',
            ['기관코드', '기관명', '분류', '조문번호', '조문제목', '조문본문'],
            arts.map(function (a) {
              return [a.apba_id, a.inst_name, a.taxonomy_name, a.article_no, a.article_title, a.text];
            })
          );
        }
      } else {
        var discs = filterDisclosures();
        downloadCsv(
          '공공임단협_공시및내부규정목록.csv',
          ['기관코드', '기관명', '분류코드', '분류명', '문서제목', '기준일', '첨부파일수', '요약'],
          discs.map(function (d) {
            return [d.aid, d.iname, d.ccode, d.cname, d.title, d.edate || d.rdate || '', (d.files || []).length, (d.highlights || []).join(' ')];
          })
        );
      }
    }

    function syncUrlState() {
      if (opts.isModal) return;
      try {
        if (typeof location === 'undefined' || typeof history === 'undefined' || typeof history.replaceState !== 'function') return;
        if (location.protocol === 'file:') return;
        var sp = new URLSearchParams(location.search || '');
        sp.delete('organ');
        sp.delete('aid');
        sp.delete('region');
        sp.delete('muni');
        sp.delete('compare');
        sp.delete('tab');
        sp.delete('mode');
        sp.delete('doc');
        if (state.tab === 'organ' && state.hOrgan) {
          sp.set('organ', state.hOrgan);
        } else if (state.tab === 'matrix' && state.mSubMode === 'REGION') {
          if (state.rMultiMode && state.rMultiProvs.length >= 2) {
            sp.set('region', state.rMultiProvs.join(','));
          } else {
            sp.set('region', state.rProvince || '충청남도');
            if (state.rProvince !== 'ALL') {
              if (state.rMultiMode && state.rMultiMunis.length >= 2) {
                sp.set('muni', state.rMultiMunis.join(','));
              } else if (state.rMuni) {
                sp.set('muni', state.rMuni);
              }
            }
          }
        } else if (state.tab === 'matrix' && state.mSubMode === 'ALL_LIST') {
          sp.set('tab', 'matrix');
          sp.set('mode', 'ALL_LIST');
        } else if (state.tab === 'matrix' && state.mSubMode === 'STUDIO') {
          if (state.compareIds.length) sp.set('compare', state.compareIds.slice(0, 6).join(','));
          else sp.set('tab', 'matrix');
        } else if (state.tab === 'articles') {
          sp.set('tab', 'articles');
          if (state.docMode === 'DISC') sp.set('doc', 'DISC');
          else if (state.aViewMode === 'COMPARE' && state.compareIds.length) sp.set('compare', state.compareIds.slice(0, 6).join(','));
        } else if (state.tab !== 'unions') {
          sp.set('tab', state.tab);
        }
        var qs = sp.toString();
        var nextUrl = (location.pathname || 'pu-alio-union.html') + (qs ? ('?' + qs) : '') + (location.hash || '');
        if (nextUrl !== ((location.pathname || '') + (location.search || '') + (location.hash || ''))) {
          history.replaceState(null, '', nextUrl);
        }
      } catch (e) {}
    }

    function renderCurrentTab() {
      if (state.tab === 'unions') renderTabUnions();
      else if (state.tab === 'organ') renderTabOrganHistory();
      else if (state.tab === 'matrix') renderTabMatrix();
      else if (state.tab === 'articles') {
        if (state.docMode === 'DISC') renderTabDetail();
        else renderTabArticles();
      } else if (state.tab === 'detail') renderTabDetail();
      else renderTabApiHub();
      syncUrlState();
    }

    renderCompareTray();
    renderCurrentTab();
  }

  function openModal() {
    if (typeof global.open === 'function') {
      global.open('pu-alio-union.html', 'pureun-aliounion', 'noopener');
    } else if (typeof location !== 'undefined') {
      location.href = 'pu-alio-union.html';
    }
  }

  function closeModal() {}

  global.PuAlioUnion = {
    openModal: openModal,
    closeModal: closeModal,
    openOrganWindow: openOrganWindow,
    openOrganDetailModal: openOrganDetailModal,
    closeOrganDetailModal: closeOrganDetailModal,
    openCleaneyeDirect: openCleaneyeDirect,
    buildOrganUrl: buildOrganUrl,
    buildOrganTimeline: buildOrganTimeline,
    buildOrganMasterIndex: buildOrganMasterIndex,
    calcLegalTimeoffLimit: calcLegalTimeoffLimit,
    renderRadarChartSvg: renderRadarChartSvg,
    renderScatterTimeoffSvg: renderScatterTimeoffSvg,
    findSimilarOrgans: findSimilarOrgans,
    extractOrganMetrics: extractOrganMetrics,
    resolveOrganProvince: resolveOrganProvince,
    detectMunicipality: detectMunicipality,
    matchSmartQuery: matchSmartQuery,
    inferProvinceFromQuery: inferProvinceFromQuery,
    safeHttpUrl: safeHttpUrl,
    setAuthUser: setAuthUser,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
