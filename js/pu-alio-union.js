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
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
      var host = (u.hostname || '').toLowerCase();
      if (
        host === 'www.alio.go.kr' ||
        host === 'alio.go.kr' ||
        host === 'www.cleaneye.go.kr' ||
        host === 'cleaneye.go.kr' ||
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
        host.endsWith('.go.kr')
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

  function renderFilePills(files, defaultLabel) {
    if (!Array.isArray(files) || !files.length) return '';
    var seen = {};
    var pills = [];
    files.forEach(function (f, idx) {
      if (!f) return;
      var u = safeHttpUrl(f.url || f.download_url || '');
      if (!u || seen[u]) return;
      seen[u] = true;
      var lbl = f.name ? String(f.name) : ((defaultLabel || '첨부원문') + (files.length > 1 ? ' ' + (idx + 1) : ''));
      pills.push('<a class="pau-pill fktu" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" title="' + esc(lbl) + '" style="text-decoration:none;max-width:210px;overflow:hidden;text-overflow:ellipsis;">📎 ' + esc(lbl) + '</a>');
    });
    return pills.length ? (pills.join(' ') + ' ') : '';
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

  function normalizeRevisionsList(rawRev) {
    if (!rawRev) return [];
    var list = (Array.isArray(rawRev) ? rawRev : [rawRev]).filter(Boolean);
    return list.map(function (r) {
      var sumLines = [];
      if (Array.isArray(r.summary)) {
        sumLines = r.summary.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
      } else if (worth(r.summary)) {
        sumLines = [String(r.summary).trim()];
      }
      var diffs = (r.diffs || []).filter(Boolean).map(function (d) {
        return {
          art: d.art || d.article || '개정 조항',
          before: d.before || '—',
          after: d.after || '—',
          note: d.note || '단협·규정 개정'
        };
      });
      return {
        dno: r.dno || '',
        date: normalizeTimelineDate(r.date) || r.date || '최근 개정',
        rawDate: r.date || '최근 개정',
        title: r.title || '단체협약 신·구 조문 대비표 및 개정 주요내용',
        file: r.file || '',
        url: r.url || '',
        summaryLines: sumLines,
        diffs: diffs
      };
    });
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
      var kvParts = [];
      Object.keys(d.kv || {}).forEach(function (k) {
        if (k !== '기준일' && k !== '제출일' && worth(d.kv[k])) {
          kvParts.push(k + ': ' + d.kv[k]);
        }
      });
      if (Array.isArray(d.highlights) && d.highlights.length) {
        kvParts.push('주요내용: ' + d.highlights.slice(0, 3).join(' / '));
      }

      items.push({
        id: d.dno || ('DISC_' + aid + '_' + idx),
        date: normDate || rawDate || '—',
        year: /^\d{4}/.test(normDate) ? normDate.slice(0, 4) : '기타',
        catGroup: catGroup,
        ccode: cc,
        cname: d.cname || '공시',
        title: d.title || d.cname || '',
        union: (d.kv && d.kv['노조명']) || '',
        period: (d.kv && (d.kv['유효기간'] || d.kv['기준연도'])) || normDate || '',
        summary: kvParts.join(' · ') || d.title || '—',
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
    var safeArticles = ((data && data.articles) || []).filter(Boolean);
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
    var byId = {};

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
        var da = String(a.edate || a.rdate || '');
        var db = String(b.edate || b.rdate || '');
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
          wageDiscs.push(d);
        } else if (cc === '63795' || cc === '21028') {
          sepDiscs.push(d);
        } else {
          statusDiscs.push(d);
        }
      });

      var revs = normalizeRevisionsList(revsMap[aid]);
      var mMap = metricsByAid[aid] || {};
      var arts = articlesByAid[aid] || [];

      var rec = {
        aid: aid,
        apba_id: aid,
        inst: inst,
        name: inst.name || aid,
        ministry: inst.ministry || '미분류',
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
        return { label: label, count: 0, orgRate: 55, memberAvg: 200, timeoffAvg: 2400, timeoffLimitPct: 60, discAvg: 4, radar: [62, 62, 65, 68, 68, 66], totalScore: 65 };
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
        orgRate: Math.round((sumOrg / n) * 10) / 10,
        memberAvg: Math.round(sumMem / n),
        timeoffAvg: toCnt ? Math.round(sumTo / toCnt) : 0,
        timeoffLimitPct: toCnt ? Math.round((sumPct / toCnt) * 10) / 10 : 0,
        discAvg: Math.round((sumDisc / n) * 10) / 10,
        radar: radAvg,
        totalScore: Math.round(radAvg.reduce(function (a, b) { return a + b; }, 0) / 6)
      };
    }

    var benchmarks = {
      ALL: computeBenchmark('전체 공공기관 노조 평균', records),
      bySector: {},
      byScope: {}
    };

    SECTOR_RULES.concat([{ code: 'GENERAL', label: '일반공공서비스' }]).forEach(function (sr) {
      var sub = records.filter(function (r) { return r.sectorCode === sr.code; });
      benchmarks.bySector[sr.code] = computeBenchmark(sr.label + ' 업종 평균', sub);
    });
    ['CENTRAL', 'LOCAL_ERC_MOIS', 'LOCAL_CORP', 'LOCAL_AFFIL', 'LOCAL_DIRECT'].forEach(function (sc) {
      var sub = records.filter(function (r) { return r.scopeGroup === sc; });
      benchmarks.byScope[sc] = computeBenchmark(sc + ' 평균', sub);
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
  function renderOrganSixDomainsBoard(rec, isCompact, inCompareTray, sectorBench) {
    var dom = rec.domains;
    var aid = rec.aid;
    var isLoc = rec.isLocal;
    var isMois = rec.isMois;
    var postAttrBase = (isLoc && !isMois) ? (' data-cleaneye-post="' + esc(aid) + '"') : '';

    var latestCa = dom.caDiscs[0] || null;
    var latestSep = dom.sepDiscs[0] || null;
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

    return [
      '<div class="pau-dom-board">',
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
      '  </div>',

      '  <div class="pau-dom-grid">',
      // 영역 1: 노동조합 · 타임오프 구성
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>👥 ① 노동조합 · 타임오프 구조</span><span class="pau-pill ' + (rec.hasUnion ? (rec.isMulti ? 'multi' : 'fktu') : '') + '">' + esc(rec.unionStructLabel) + '</span></div>',
      (rec.hasUnion ? [
        '      <div class="pau-dom-stat">합산 조합원 <b>' + fmtNum(rec.memberTotal) + '명</b> / 가입대상 ' + fmtNum(rec.eligibleCount) + '명 (조직률 <b>' + fmtPct(rec.orgRate) + '</b>) · 타임오프 <b>' + fmtNum(rec.timeoffHours) + 'h</b> (법정한도 ' + fmtNum(rec.legalTimeoffLimit) + 'h 대비 <b>' + fmtPct(rec.timeoffLimitPct) + '</b>)</div>',
        '      <div class="pau-dom-list">',
        rec.unions.map(function (u) {
          var isRep = String(u.bargaining_right || '').indexOf('대표') >= 0;
          return '<div class="pau-dom-item">' +
            '<span class="pau-pill ' + confedClass(u.confederation) + '">' + esc(u.confederation || '미가입') + '</span> ' +
            (isRep ? '<span class="pau-pill ok">대표</span> ' : '') +
            '<b>' + esc(u.union_name) + '</b> · ' + fmtNum(u.member_total) + '명' +
            (Number(u.timeoff_hours || 0) ? (' · ' + fmtNum(u.timeoff_hours) + 'h') : '') +
            (worth(u.established_date) ? (' <span style="color:var(--pau-muted);">(' + esc(u.established_date) + ')</span>') : '') +
            '</div>';
        }).join(''),
        '      </div>'
      ].join('') : '<div class="pau-dom-empty">현재 설립·공시된 노동조합이 없으며 취업규칙·내부규정 및 노사협의회 기준으로 운영됩니다.</div>'),
      '      <div class="pau-dom-foot">',
      (unionOpenUrl ? '<a class="pau-pill ok" href="' + esc(unionOpenUrl) + '"' + (postAttrBase ? (postAttrBase + ' data-cleaneye-type="union_status"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 노조현황 원문</a>' : ''),
      '      </div>',
      '    </div>',

      // 영역 2: 임금 · 보수 · 퇴직금
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>💰 ② 임금 · 보수 · 퇴직금 영역</span><span class="pau-pill">' + fmtNum(dom.wageDiscs.length) + '건</span></div>',
      '      <div class="pau-dom-stat">보수기준: <b>' + esc(rec.issueScores.wage_bonus_allowance.val) + '</b></div>',
      '      <div class="pau-dom-list">',
      (dom.wageDiscs.length ? dom.wageDiscs.slice(0, 3).map(function (d) {
        return '<div class="pau-dom-item"><b>[' + esc(d.edate || d.rdate || '공시') + ']</b> ' + esc(d.title || d.cname) + ' ' + renderFilePills((d.files || []).slice(0, 2), '임협원문') + '</div>';
      }).join('') : '<div class="pau-dom-item">별도 임금협약 공시문서 없음 — 보수규정·연봉규칙 및 통합 단체협약 내 임금 조항 적용</div>'),
      '      </div>',
      '      <div class="pau-dom-foot">',
      '<span class="pau-pill">' + esc('정년·임금피크: ' + rec.issueScores.retirement_age_peak.tag) + '</span>',
      '      </div>',
      '    </div>',

      // 영역 3: 단체협약 13대 핵심 근로조건
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>⚖️ ③ 단체협약 핵심 근로조건 요약</span><span class="pau-pill fktu">단협 ' + fmtNum(dom.caDiscs.length) + '건 · 조문 ' + fmtNum(dom.articles.length) + '개</span></div>',
      (latestCa ? '<div class="pau-dom-stat">최근 단협: <b>' + esc((latestCa.edate || latestCa.rdate || '') + ' ' + latestCa.title) + '</b></div>' : '<div class="pau-dom-stat">13대 핵심 쟁점 표준 분석 등급:</div>'),
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
      (latestCa ? renderFilePills((latestCa.files || []).slice(0, 2), '단협원문') : ''),
      (unionOpenUrl ? '<a class="pau-pill ok" href="' + esc(unionOpenUrl) + '"' + (postAttrBase ? (postAttrBase + ' data-cleaneye-type="union_info"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 단협·협약 공시</a>' : ''),
      '      </div>',
      '    </div>',

      // 영역 4: 별도합의 · 보충협약 · 노사협의회
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>🤝 ④ 별도합의 · 보충협약 · 노사협의회</span><span class="pau-pill multi">' + fmtNum(dom.sepDiscs.length) + '건</span></div>',
      '      <div class="pau-dom-list">',
      (dom.sepDiscs.length ? dom.sepDiscs.slice(0, 3).map(function (d) {
        return '<div class="pau-dom-item"><b>[' + esc(d.edate || d.rdate || '합의') + ']</b> ' + esc(d.title || d.cname) + ' ' + renderFilePills((d.files || []).slice(0, 1), '합의서') + '</div>';
      }).join('') : '<div class="pau-dom-empty">공시된 단협 외 별도합의서가 없으며 본 단체협약 및 정기 노사협의회 의결사항으로 통합 운영됩니다.</div>'),
      '      </div>',
      (latestSep && latestSep.kv ? '<div class="pau-dom-foot"><span style="font-size:11.5px;color:var(--pau-muted);">' + esc(Object.keys(latestSep.kv).slice(0, 2).map(function (k) { return k + ': ' + latestSep.kv[k]; }).join(' · ')) + '</span></div>' : ''),
      '    </div>',

      // 영역 5: 취업규칙 · 내부규정 · 복리후생
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>📘 ⑤ 취업규칙 · 내부규정 · 복리후생</span><span class="pau-pill ok">' + (dom.ruleDiscs.length ? fmtNum(dom.ruleDiscs.length) + '건 수록' : '포털 직결') + '</span></div>',
      '      <div class="pau-dom-stat">복리후생·모성보호: <b>' + esc(rec.issueScores.welfare_education_housing.tag + ' · ' + rec.issueScores.maternity_childcare.tag) + '</b></div>',
      '      <div class="pau-dom-list">',
      (dom.ruleDiscs.length ? dom.ruleDiscs.slice(0, 3).map(function (d) {
        return '<div class="pau-dom-item"><b>[' + esc(d.cname || '사규') + ']</b> ' + esc(d.title) + ' ' + renderFilePills((d.files || []).slice(0, 2), '규정원문') + '</div>';
      }).join('') : '<div class="pau-dom-item">인사규정 · 보수규정 · 복무규정 · 징계규칙 · 선택적복지 공시 원문 바로가기 지원</div>'),
      '      </div>',
      '      <div class="pau-dom-foot">',
      (ruleOpenUrl ? '<a class="pau-pill ok" href="' + esc(ruleOpenUrl) + '"' + (postAttrBase ? (postAttrBase + ' data-cleaneye-type="rules"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📘 내부규정·정관 직결</a> ' : ''),
      (isLoc && welfareOpenUrl ? '<a class="pau-pill fktu" href="' + esc(welfareOpenUrl) + '"' + (postAttrBase ? (postAttrBase + ' data-cleaneye-type="welfare"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🏖️ 휴가·복리후생 직결</a>' : ''),
      '      </div>',
      '    </div>',

      // 영역 6: 연혁 타임라인 & 과거↔현행 신·구 대비
      '    <div class="pau-dom-card">',
      '      <div class="pau-dom-hd"><span>🔄 ⑥ 연혁 · 과거↔현행 신·구 조문 대비</span><span class="pau-pill ' + (latestRev ? 'fktu' : '') + '">' + (latestRev ? ('개정대비 ' + fmtNum(latestRev.diffs.length) + '건') : ('누적공시 ' + fmtNum(rec.discTotal) + '건')) + '</span></div>',
      (latestRev ? [
        '      <div class="pau-dom-stat"><b>' + esc(latestRev.title) + '</b> (' + esc(latestRev.date) + ')</div>',
        '      <div class="pau-dom-list">',
        latestRev.diffs.slice(0, 2).map(function (df) {
          return '<div class="pau-dom-item"><b>' + esc(df.art) + ':</b> <span style="color:var(--pau-muted);">' + esc(String(df.before).slice(0, 38)) + '…</span> → <b style="color:var(--pau-pri);">' + esc(String(df.after).slice(0, 46)) + '</b></div>';
        }).join(''),
        '      </div>'
      ].join('') : '<div class="pau-dom-empty">연도별 공시 문서(' + fmtNum(rec.discTotal) + '건)를 기반으로 과거 시점(A)과 현행 시점(B)의 체결 내역을 직접 대조할 수 있습니다.</div>'),
      '      <div class="pau-dom-foot">',
      (isCompact ? '<button type="button" class="pau-act-btn pri" data-open-organ-here="' + esc(aid) + '">🔄 과거↔현행 조문대비표 열기</button>' : '<button type="button" class="pau-act-btn" data-h-sub="HISTORY" data-scroll-sub="1">🔄 하단 연혁·신구대비 보기</button>'),
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
      /* 기관 내부 6대 영역 보드 및 차트 스타일 */
      '.pau-dom-board{background:var(--pau-card);border:1px solid var(--pau-bd);border-radius:10px;padding:10px 12px;}',
      '.pau-dom-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--pau-bd-lt);}',
      '.pau-dom-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}',
      '@media (max-width:1100px){.pau-dom-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}',
      '.pau-dom-card{background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:9px;padding:9px 10px;display:flex;flex-direction:column;gap:6px;}',
      '.pau-dom-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;font-weight:800;font-size:12.5px;color:var(--pau-txt);}',
      '.pau-dom-stat{font-size:12px;color:var(--pau-sub);line-height:1.45;}',
      '.pau-dom-list{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--pau-txt);line-height:1.45;}',
      '.pau-dom-item{padding:3px 0;border-top:1px dashed var(--pau-bd-lt);word-break:keep-all;}',
      '.pau-dom-empty{font-size:12px;color:var(--pau-muted);line-height:1.45;}',
      '.pau-dom-foot{margin-top:auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding-top:4px;}',
      '.pau-issue-mini-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;}',
      '.pau-issue-mini{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:3px 6px;border-radius:6px;font-size:11px;border:1px solid var(--pau-bd-lt);background:var(--pau-card);overflow:hidden;}',
      '.pau-issue-mini span{color:var(--pau-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-issue-mini b{white-space:nowrap;font-weight:700;}',
      '.pau-issue-mini.lv5,.pau-hm-cell.lv5{background:#dbeafe;border-color:#93c5fd;color:#1e3a8a;}',
      '.pau-issue-mini.lv4,.pau-hm-cell.lv4{background:#dcfce7;border-color:#86efac;color:#14532d;}',
      '.pau-issue-mini.lv3,.pau-hm-cell.lv3{background:#f8fafc;border-color:#cbd5e1;color:#1e293b;}',
      '.pau-issue-mini.lv2,.pau-hm-cell.lv2{background:#fef9c3;border-color:#fde047;color:#713f12;}',
      '.pau-issue-mini.lv1,.pau-hm-cell.lv1{background:#f1f5f9;border-color:#cbd5e1;color:#475569;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv5,body.dark .pau-root .pau-issue-mini.lv5,.pau-root[data-theme="dark"] .pau-hm-cell.lv5,body.dark .pau-root .pau-hm-cell.lv5{background:#1e3a8a;border-color:#60a5fa;color:#eff6ff;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv4,body.dark .pau-root .pau-issue-mini.lv4,.pau-root[data-theme="dark"] .pau-hm-cell.lv4,body.dark .pau-root .pau-hm-cell.lv4{background:#14532d;border-color:#4ade80;color:#f0fdf4;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv3,body.dark .pau-root .pau-issue-mini.lv3,.pau-root[data-theme="dark"] .pau-hm-cell.lv3,body.dark .pau-root .pau-hm-cell.lv3{background:#1e293b;border-color:#475569;color:#e2e8f0;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv2,body.dark .pau-root .pau-issue-mini.lv2,.pau-root[data-theme="dark"] .pau-hm-cell.lv2,body.dark .pau-root .pau-hm-cell.lv2{background:#713f12;border-color:#facc15;color:#fef9c3;}',
      '.pau-root[data-theme="dark"] .pau-issue-mini.lv1,body.dark .pau-root .pau-issue-mini.lv1,.pau-root[data-theme="dark"] .pau-hm-cell.lv1,body.dark .pau-root .pau-hm-cell.lv1{background:#0f172a;border-color:#334155;color:#cbd5e1;}',
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
      '  .pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password]{flex:1 1 100%;min-width:120px;max-width:100%;height:32px;min-height:32px;font-size:16px!important;}',
      '  .pau-kpis,.pau-kpis-6{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-bottom:6px;}',
      '  .pau-kpi{padding:4px 8px;}',
      '  .pau-kpi b{font-size:13px;}',
      '  .pau-dom-grid,.pau-issue-mini-grid{grid-template-columns:1fr;}',
      '  .pau-tbl-wrap{max-height:none;overflow-x:hidden;border:none;background:transparent;}',
      '  .pau-tbl{min-width:0!important;width:100%!important;display:block;}',
      '  .pau-tbl thead{display:none;}',
      '  .pau-tbl tbody{display:block;width:100%;}',
      '  .pau-tbl tr{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:8px 10px;margin-bottom:6px;}',
      '  .pau-tbl td{display:inline-flex;align-items:center;gap:4px;border:none;padding:2px 0;white-space:normal;overflow:visible;text-overflow:clip;max-width:100%;font-size:12.5px;}',
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

  function getInitialOrganFromUrl() {
    try {
      if (typeof location !== 'undefined' && location.search) {
        var sp = new URLSearchParams(location.search);
        var org = sp.get('organ') || sp.get('aid') || '';
        return org.trim();
      }
    } catch (e) {}
    return '';
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
    var safeArticles = (data.articles || []).filter(Boolean);

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
    var allMinistries = [];
    safeInsts.forEach(function (i) {
      if (worth(i.inst_type) && allTypes.indexOf(i.inst_type) === -1) allTypes.push(i.inst_type);
      if (worth(i.ministry) && allMinistries.indexOf(i.ministry) === -1) allMinistries.push(i.ministry);
    });
    allTypes.sort();
    allMinistries.sort();

    var allConfeds = [];
    activeUnions.forEach(function (u) {
      var c = worth(u.confederation) ? u.confederation : '미가입';
      if (allConfeds.indexOf(c) === -1) allConfeds.push(c);
    });
    allConfeds.sort();

    var urlOrgan = getInitialOrganFromUrl();
    var defaultOrganAid = (urlOrgan && instMap[urlOrgan]) ? urlOrgan : '';
    if (!defaultOrganAid && safeInsts.length) {
      var preferred = safeInsts.find(function (x) {
        return x.apba_id === 'C0005' || (data.revisions && data.revisions[x.apba_id]);
      });
      defaultOrganAid = preferred ? preferred.apba_id : safeInsts[0].apba_id;
    }

    var state = {
      tab: (urlOrgan && instMap[urlOrgan]) ? 'organ' : 'unions',
      // 탭 1: 기관별 분류 · 내부영역 통합 (전 기관 노조·타임오프 현황 포함)
      uViewMode: 'ORGAN', // 'ORGAN' (1기관 1통합행 기본) | 'FLAT_UNION' (단위노조별 나열)
      uShowMacroChart: false,
      uShowMoreFilters: false,
      uScope: 'ALL',
      uSector: '',
      uType: '',
      uMinistry: '',
      uConfed: '',
      uStruct: '', // ''(노조보유 우선 전체) | 'has_union' | 'single' | 'multi' | 'no_union'
      uSort: 'members_desc',
      uQuery: '',
      uPage: 0,
      uExpanded: {},
      // 비교 바구니 (최대 6개 기관)
      compareIds: [],
      cmpAddQuery: '',
      // 탭 2: 기관별 연혁·과거임단협·유사기관 비교 & 내부 6대 영역 종합
      hScope: 'ALL',
      hSearch: '',
      hOrgan: defaultOrganAid,
      hSubTab: 'HISTORY', // 'HISTORY' (연혁·신구대비) | 'PEERS' (유사기관 추천) | 'CHART' (업종 대비 진단 그래프)
      hCatFilter: '',
      hVerA: 1,
      hVerB: 0,
      hSimMode: 'ALL',
      // 탭 3: 그래프·히트맵 비교분석 스튜디오 & 13대 핵심 쟁점 기관간 비교·원문 대조
      mSubMode: 'STUDIO', // 'STUDIO' (다중기관 그래프·히트맵 비교) | 'ALL_LIST' (전 기관 단일쟁점 일람)
      mIssue: METRIC_DEFS[0].key,
      mScope: 'ALL',
      mType: '',
      mConfed: '',
      mQuery: '',
      mChecked: {},
      // 탭 4: 조문·원문 통합 (단체협약 조문 통합 검색 + 기관별 공시·별도합의·내부규정 원문)
      docMode: 'ARTICLES', // 'ARTICLES' | 'DISC'
      aScope: 'ALL',
      aCat: 'ALL',
      aQuery: '',
      dScope: 'ALL',
      dOrganSearch: '',
      dOrgan: defaultOrganAid,
      dTax: 'ALL',
      dQuery: '',
      dPage: 0,
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
      if (!state.compareIds.length || state.tab === 'matrix') {
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
      var clrBtn = cmpTrayEl.querySelector('[data-tray-clear]');
      if (clrBtn) {
        clrBtn.addEventListener('click', function () {
          state.compareIds = [];
          renderCompareTray();
          renderCurrentTab();
        });
      }
    }

    // 위임 클릭 핸들러 (클린아이 POST, 비교함 토글, 인라인 상세 전환, 서브탭 전환)
    if (bodyEl) {
      bodyEl.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;

        var postEl = e.target.closest('[data-cleaneye-post]');
        if (postEl) {
          e.preventDefault();
          e.stopPropagation();
          var cAid = postEl.getAttribute('data-cleaneye-post') || '';
          var cType = postEl.getAttribute('data-cleaneye-type') || 'union_info';
          if (cAid) openCleaneyeDirect(cAid, cType);
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
          openOrganInHistoryTab(hereBtn.getAttribute('data-open-organ-here') || '', true);
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
          var shouldScroll = hSubBtn.getAttribute('data-scroll-sub') === '1';
          state.hSubTab = hSubBtn.getAttribute('data-h-sub') || 'HISTORY';
          renderTabOrganHistory();
          if (shouldScroll && bodyEl) {
            var subCard = bodyEl.querySelector('#pauOrganSubCard');
            if (subCard && subCard.scrollIntoView) subCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }

        var docModeBtn = e.target.closest('[data-doc-mode]');
        if (docModeBtn) {
          e.preventDefault();
          state.docMode = docModeBtn.getAttribute('data-doc-mode') || 'ARTICLES';
          renderCurrentTab();
          return;
        }
      });
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

    function openOrganInHistoryTab(aid, shouldSwitchHere) {
      if (!aid || !instMap[aid]) return;
      state.hOrgan = aid;
      state.dOrgan = aid;
      state.apiAlioAid = aid;
      state.hVerA = 1;
      state.hVerB = 0;
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
      openOrganInHistoryTab: openOrganInHistoryTab
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
      var q = state.uQuery.trim().toLowerCase();
      var filtered = organRecords.filter(function (r) {
        if (!matchOrganScope(r.inst, state.uScope)) return false;
        if (state.uSector && r.sectorCode !== state.uSector) return false;
        if (state.uType && r.inst_type !== state.uType) return false;
        if (state.uMinistry && r.ministry !== state.uMinistry) return false;
        if (state.uConfed) {
          if (!r.hasUnion || r.confeds.indexOf(state.uConfed) === -1) return false;
        }
        if (state.uStruct === 'has_union' && !r.hasUnion) return false;
        if (state.uStruct === 'single' && (!r.hasUnion || r.isMulti)) return false;
        if (state.uStruct === 'multi' && (!r.hasUnion || !r.isMulti)) return false;
        if (state.uStruct === 'no_union' && r.hasUnion) return false;
        if (q) {
          var uNames = r.unions.map(function (u) { return u.union_name + ' ' + (u.federation || ''); }).join(' ');
          var hay = (r.name + ' ' + r.ministry + ' ' + r.inst_type + ' ' + r.sectorLabel + ' ' + uNames).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });

      filtered.sort(function (a, b) {
        if (state.uSort === 'name_asc') return a.name.localeCompare(b.name, 'ko');
        if (state.uSort === 'timeoff_desc') {
          if (b.timeoffHours !== a.timeoffHours) return b.timeoffHours - a.timeoffHours;
          return b.memberTotal - a.memberTotal;
        }
        if (state.uSort === 'orgrate_desc') {
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (b.orgRate !== a.orgRate) return b.orgRate - a.orgRate;
          return b.memberTotal - a.memberTotal;
        }
        if (state.uSort === 'score_desc') {
          if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          return b.memberTotal - a.memberTotal;
        }
        if (state.uSort === 'disc_desc') {
          if (b.discTotal !== a.discTotal) return b.discTotal - a.discTotal;
          return b.memberTotal - a.memberTotal;
        }
        // 기본: 노조 보유 기관 우선 + 조합원 수 내림차순
        if (a.hasUnion !== b.hasUnion) return b.hasUnion ? 1 : -1;
        if (b.memberTotal !== a.memberTotal) return b.memberTotal - a.memberTotal;
        if (b.discTotal !== a.discTotal) return b.discTotal - a.discTotal;
        return a.name.localeCompare(b.name, 'ko');
      });
      return filtered;
    }

    function filterFlatUnions() {
      var q = state.uQuery.trim().toLowerCase();
      return activeUnions.filter(function (u) {
        var inst = instMap[u.apba_id] || u;
        if (!matchOrganScope(inst, state.uScope)) return false;
        if (state.uSector && detectSectorGroup(inst).code !== state.uSector) return false;
        if (state.uType && u.inst_type !== state.uType) return false;
        if (state.uMinistry && u.ministry !== state.uMinistry) return false;
        var cf = worth(u.confederation) ? u.confederation : '미가입';
        if (state.uConfed && cf !== state.uConfed) return false;
        if (state.uStruct === 'multi' && String(u.union_structure || '').indexOf('복수') === -1) return false;
        if (state.uStruct === 'single' && String(u.union_structure || '').indexOf('단일') === -1) return false;
        if (q) {
          var hay = ((u.inst_name || '') + ' ' + (u.union_name || '') + ' ' + (u.ministry || '') + ' ' + (u.federation || '') + ' ' + (u.inst_type || '')).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function renderTabUnions() {
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

      var extraFilterCount = (state.uType ? 1 : 0) + (state.uConfed ? 1 : 0) + (state.uSort !== 'members_desc' ? 1 : 0) + (state.uViewMode === 'FLAT_UNION' ? 1 : 0);

      var pageSize = 250;
      var listSource = state.uViewMode === 'FLAT_UNION' ? filterFlatUnions() : organRows;
      var totalPages = Math.max(1, Math.ceil(listSource.length / pageSize));
      if (state.uPage >= totalPages) state.uPage = totalPages - 1;
      if (state.uPage < 0) state.uPage = 0;
      var startIdx = state.uPage * pageSize;
      var visibleRows = listSource.slice(startIdx, startIdx + pageSize);

      bodyEl.innerHTML = [
        // 1) 1줄 통합 필터 바
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
        '  <select data-f="uMinistry" aria-label="소관부처·시도 지자체 선택" title="소관부처·시도 지자체">',
        '    <option value="">소관·시/도 전체</option>',
        allMinistries.map(function (m) { return '<option value="' + esc(m) + '"' + (state.uMinistry === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join(''),
        '  </select>',
        '  <select data-f="uStruct" aria-label="노조 보유·형태 분류" title="노조 보유·형태">',
        '    <option value=""' + (state.uStruct === '' ? ' selected' : '') + '>노조유무 전체</option>',
        '    <option value="has_union"' + (state.uStruct === 'has_union' ? ' selected' : '') + '>노조 보유 (' + fmtNum(unionizedInstCount) + '곳)</option>',
        '    <option value="multi"' + (state.uStruct === 'multi' ? ' selected' : '') + '>복수노조 기관</option>',
        '    <option value="single"' + (state.uStruct === 'single' ? ' selected' : '') + '>단일노조 기관</option>',
        '    <option value="no_union"' + (state.uStruct === 'no_union' ? ' selected' : '') + '>미설립·사규 운영</option>',
        '  </select>',
        '  <input type="search" data-f="uQuery" aria-label="기관명·노동조합명 검색" placeholder="기관명·노조명·지역 검색" value="' + esc(state.uQuery) + '" style="min-width:170px;max-width:260px;">',
        '  <div style="display:flex;align-items:center;gap:5px;margin-left:auto;flex-wrap:wrap;">',
        '    <button type="button" class="pau-act-btn' + ((state.uShowMoreFilters || extraFilterCount > 0) ? ' pri' : '') + '" data-toggle-more-flt>⚙️ 상세필터' + (extraFilterCount > 0 ? ' (' + extraFilterCount + ')' : '') + '</button>',
        '    <button type="button" class="pau-act-btn' + (state.uShowMacroChart ? ' pri' : '') + '" data-toggle-macro>📊 분포차트</button>',
        '  </div>',
        '</div>',

        // 2) 접이식 상세필터 바 (필요할 때만 펼침)
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
          '    <option value="members_desc"' + (state.uSort === 'members_desc' ? ' selected' : '') + '>정렬: 조합원 규모순</option>',
          '    <option value="timeoff_desc"' + (state.uSort === 'timeoff_desc' ? ' selected' : '') + '>정렬: 타임오프 시간순</option>',
          '    <option value="orgrate_desc"' + (state.uSort === 'orgrate_desc' ? ' selected' : '') + '>정렬: 조직률(%)순</option>',
          '    <option value="score_desc"' + (state.uSort === 'score_desc' ? ' selected' : '') + '>정렬: 종합점수순</option>',
          '    <option value="disc_desc"' + (state.uSort === 'disc_desc' ? ' selected' : '') + '>정렬: 공시건수순</option>',
          '    <option value="name_asc"' + (state.uSort === 'name_asc' ? ' selected' : '') + '>정렬: 가나다순</option>',
          '  </select>',
          '  <div class="pau-seg" role="group" aria-label="목록 보기 방식">',
          '    <button type="button" class="pau-seg-btn' + (state.uViewMode === 'ORGAN' ? ' on' : '') + '" data-u-mode="ORGAN">🏢 기관 통합</button>',
          '    <button type="button" class="pau-seg-btn' + (state.uViewMode === 'FLAT_UNION' ? ' on' : '') + '" data-u-mode="FLAT_UNION">👥 단위노조 나열</button>',
          '  </div>',
          '  <button type="button" class="pau-act-btn" data-u-reset style="margin-left:auto;">초기화</button>',
          '</div>'
        ].join('') : ''),

        // 3) 접이식 거시 분포 차트 (버튼 클릭 시에만 펼침)
        (state.uShowMacroChart ? renderMacroDistributionStrip(organRows) : ''),

        // 4) 1줄 슬림 요약 + 인라인 페이저 바
        '<div class="pau-subbar">',
        '  <span>조회 <b>' + fmtNum(organRows.length) + '곳</b> (노조 <b>' + fmtNum(unionizedRows.length) + '곳</b> · 단위노조 <b>' + fmtNum(totalUnionUnits) + '개</b> · 조합원 <b>' + fmtNum(totalMembers) + '명</b> · 평균 조직률 <b>' + avgOrgRate + '%</b> · 타임오프 <b>' + fmtNum(avgTimeoff) + 'h</b>)</span>',
        (listSource.length > pageSize ? [
          '  <div style="display:flex;align-items:center;gap:6px;">',
          '    <span>' + (state.uPage + 1) + ' / ' + totalPages + ' 페이지</span>',
          '    <button type="button" class="pau-act-btn" data-u-prev' + (state.uPage <= 0 ? ' disabled' : '') + '>◀ 이전</button>',
          '    <button type="button" class="pau-act-btn" data-u-next' + (state.uPage + 1 >= totalPages ? ' disabled' : '') + '>다음 ▶</button>',
          '  </div>'
        ].join('') : ''),
        '</div>',

        // 6) 기관 중심 통합 마스터 테이블 (기본) vs 단위노조 나열 테이블
        (state.uViewMode === 'ORGAN' ? [
          '<div class="pau-tbl-wrap">',
          '  <table class="pau-tbl">',
          '    <thead>',
          '      <tr>',
          '        <th class="c-no">№</th>',
          '        <th style="width:19%;">기관명 · 소관부처/지자체 (클릭→별개 창)</th>',
          '        <th style="width:12%;">권역 · 업종 · 유형</th>',
          '        <th style="width:16%;">노조 구성 · 대표노조 · 상급단체</th>',
          '        <th style="width:11%;">조합원 · 조직률(%)</th>',
          '        <th style="width:10%;">타임오프 · 한도대비</th>',
          '        <th style="width:14%;">기관 내부 6대 영역 현황</th>',
          '        <th style="width:18%;">한눈에 펼침 · 비교 · 상세</th>',
          '      </tr>',
          '    </thead>',
          '    <tbody>',
          (visibleRows.length ? visibleRows.map(function (r, idx) {
            var absNo = startIdx + idx + 1;
            var isExp = !!state.uExpanded[r.aid];
            var inCmp = state.compareIds.indexOf(r.aid) >= 0;
            var organFull = r.name + ' (' + r.ministry + ')';
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
          // 단위노조 상세 나열 모드
          '<div class="pau-tbl-wrap">',
          '  <table class="pau-tbl">',
          '    <thead>',
          '      <tr>',
          '        <th class="c-no">№</th>',
          '        <th style="width:20%;">기관명 · 소관부처/지자체 (클릭→별개 창)</th>',
          '        <th style="width:14%;">구분 · 기관유형</th>',
          '        <th style="width:18%;">노동조합명 · 교섭권</th>',
          '        <th style="width:13%;">상급단체 (총연맹·연맹)</th>',
          '        <th style="width:7%;">가입대상</th>',
          '        <th style="width:7%;">조합원</th>',
          '        <th style="width:9%;">타임오프</th>',
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
      ].join('');

      bindFilterInputs(renderTabUnions);

      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-quick-sector]'), function (b) {
        b.addEventListener('click', function () {
          var sc = b.getAttribute('data-quick-sector') || '';
          state.uSector = (state.uSector === sc) ? '' : sc;
          state.uPage = 0;
          renderTabUnions();
        });
      });
      var moreFltBtn = bodyEl.querySelector('[data-toggle-more-flt]');
      if (moreFltBtn) {
        moreFltBtn.addEventListener('click', function () {
          state.uShowMoreFilters = !state.uShowMoreFilters;
          renderTabUnions();
        });
      }
      var resetBtn = bodyEl.querySelector('[data-u-reset]');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          state.uScope = 'ALL';
          state.uSector = '';
          state.uMinistry = '';
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
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-u-mode]'), function (b) {
        b.addEventListener('click', function () {
          state.uViewMode = b.getAttribute('data-u-mode') || 'ORGAN';
          state.uPage = 0;
          renderTabUnions();
        });
      });
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-exp-organ]'), function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-exp-organ') || '';
          state.uExpanded[id] = !state.uExpanded[id];
          renderTabUnions();
        });
      });
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-jump-organ]'), function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
        });
      });
      var prevBtn = bodyEl.querySelector('[data-u-prev]');
      if (prevBtn) prevBtn.addEventListener('click', function () { if (state.uPage > 0) { state.uPage -= 1; renderTabUnions(); } });
      var nextBtn = bodyEl.querySelector('[data-u-next]');
      if (nextBtn) nextBtn.addEventListener('click', function () { if (state.uPage + 1 < totalPages) { state.uPage += 1; renderTabUnions(); } });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 탭 2: 기관 내부 6대 영역 종합 · 연혁 비교 · 유사기관 그래프 진단
    // ════════════════════════════════════════════════════════════════════════
    function renderTabOrganHistory() {
      if (!organRecords.length) {
        bodyEl.innerHTML = '<div class="pau-sec-card" style="padding:32px;text-align:center;color:var(--pau-muted);">표시할 공공기관 데이터가 없습니다.</div>';
        return;
      }
      var aid = state.hOrgan || defaultOrganAid;
      var inst = instMap[aid] || safeInsts[0] || { apba_id: aid, name: aid };
      aid = inst.apba_id;
      state.hOrgan = aid;
      var rec = organById[aid] || organRecords[0];

      var hSearchLower = (state.hSearch || '').trim().toLowerCase();
      var candidateOrgans = safeInsts.filter(function (o) {
        if (!matchOrganScope(o, state.hScope)) return false;
        if (!hSearchLower) return true;
        var hay = ((o.name || '') + ' ' + (o.ministry || '') + ' ' + (o.inst_type || '') + ' ' + (o.apba_id || '')).toLowerCase();
        return hay.indexOf(hSearchLower) !== -1;
      });
      if (candidateOrgans.every(function (o) { return o.apba_id !== aid; })) {
        candidateOrgans.unshift(inst);
      }

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
      var idxB = Math.min(Math.max(0, Number(state.hVerB != null ? state.hVerB : 0)), maxCmpIdx);
      var idxA = Math.min(Math.max(0, Number(state.hVerA != null ? state.hVerA : (agreementsForCompare.length >= 2 ? 1 : 0))), maxCmpIdx);
      var verA = agreementsForCompare[idxA] || null;
      var verB = agreementsForCompare[idxB] || null;

      var allRevs = normalizeRevisionsList(data.revisions && data.revisions[aid]);
      function isRevMatchVersion(rev, ver) {
        if (!rev || !ver) return false;
        if (worth(rev.dno) && worth(ver.dno) && String(rev.dno) === String(ver.dno)) return true;
        if (/^\d{4}-\d{2}-\d{2}$/.test(rev.date) && rev.date === ver.date) return true;
        return false;
      }
      var revForA = allRevs.find(function (r) { return isRevMatchVersion(r, verA); }) || null;
      var revForB = allRevs.find(function (r) { return isRevMatchVersion(r, verB); }) || null;
      var revList = allRevs.slice().sort(function (ra, rb) {
        var ma = (isRevMatchVersion(ra, verA) || isRevMatchVersion(ra, verB)) ? 1 : 0;
        var mb = (isRevMatchVersion(rb, verA) || isRevMatchVersion(rb, verB)) ? 1 : 0;
        return mb - ma;
      });

      var matchedDiffPreviewA = revForA && revForA.diffs.length
        ? revForA.diffs.slice(0, 3).map(function (d) { return d.art + '(개정후): ' + d.after; }).join(' / ')
        : (revForB && revForB.diffs.length && verA && verB && verA.date < verB.date
            ? revForB.diffs.slice(0, 3).map(function (d) { return d.art + '(개정전): ' + d.before; }).join(' / ')
            : (verA ? ('대상노조: ' + (verA.union || '해당노조') + ' · 유효기간/기준: ' + (verA.period || verA.date)) : '—'));
      var matchedDiffPreviewB = revForB && revForB.diffs.length
        ? revForB.diffs.slice(0, 3).map(function (d) { return d.art + '(개정후): ' + d.after; }).join(' / ')
        : (verB ? ('대상노조: ' + (verB.union || '해당노조') + ' · 유효기간/기준: ' + (verB.period || verB.date)) : '—');

      var similars = findSimilarOrgans(data, aid, state.hSimMode || 'ALL');
      var topPeerRecs = similars.slice(0, 2).map(function (s) { return organById[s.apba_id]; }).filter(Boolean);
      var sectorBench = benchmarks.bySector[rec.sectorCode] || benchmarks.ALL;
      var sectorPool = organRecords.filter(function (r) { return r.sectorCode === rec.sectorCode; });

      var isLoc = isLocalOrgan(inst);
      var inCmp = state.compareIds.indexOf(aid) >= 0;

      bodyEl.innerHTML = [
        // 1) 1줄 기관 선택 · 액션 바
        '<div class="pau-flt">',
        '  <select data-f="hScope" aria-label="기관 검색 범위">',
        '    <option value="ALL"' + (state.hScope === 'ALL' ? ' selected' : '') + '>구분 전체 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.hScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙 ALIO</option>',
        '    <option value="LOCAL_ALL"' + (state.hScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방 전체 (1,338곳)</option>',
        '    <option value="LOCAL_ERC_MOIS"' + (state.hScope === 'LOCAL_ERC_MOIS' ? ' selected' : '') + '>🏛️ 평가원·행안부 유관 (6곳)</option>',
        '    <option value="LOCAL_CORP"' + (state.hScope === 'LOCAL_CORP' ? ' selected' : '') + '>🚇 지방공사·공단</option>',
        '    <option value="LOCAL_AFFIL"' + (state.hScope === 'LOCAL_AFFIL' ? ' selected' : '') + '>🏢 지방출자·출연</option>',
        '  </select>',
        '  <input type="search" data-f="hSearch" aria-label="분석할 기관명 검색" placeholder="기관·지역 필터" value="' + esc(state.hSearch) + '" style="min-width:165px;max-width:220px;">',
        '  <select data-f="hOrgan" aria-label="분석 대상 기관 선택" style="min-width:240px;font-weight:700;">',
        candidateOrgans.map(function (o) {
          var tag = isLocalOrgan(o) ? '(지방) ' : '(중앙) ';
          return '<option value="' + esc(o.apba_id) + '"' + (o.apba_id === aid ? ' selected' : '') + '>' + esc(tag + o.name + ' · ' + (o.ministry || o.inst_type || o.apba_id)) + '</option>';
        }).join(''),
        '  </select>',
        '  <div style="display:flex;align-items:center;gap:6px;margin-left:auto;flex-wrap:wrap;">',
        '    <button type="button" class="pau-act-btn pri" data-go-visual-cmp="' + esc(aid) + '">📊 유사기관 비교분석</button>',
        '    <button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(aid) + '">' + (inCmp ? '✓ 비교담김' : '+ 비교담기') + '</button>',
        '    <button type="button" class="pau-act-btn" data-h-open-win="' + esc(aid) + '">↗ 독립 창</button>',
        '  </div>',
        '</div>',

        // 2) 기관 내부 6대 핵심 영역 보드 (3×2 대칭 격자, 중복 KPI·버튼 제거)
        '<div style="margin-bottom:8px;">',
        renderOrganSixDomainsBoard(rec, false, inCmp, sectorBench),
        '</div>',

        // 3) 하단 세부 비교 단일 카드 (연혁·신구대비 | 유사기관 추천 | 업종 대비 그래프 전환)
        '<div class="pau-sec-card" id="pauOrganSubCard">',
        '  <div class="pau-sec-tit">',
        '    <div class="pau-seg" role="group" aria-label="기관 세부 분석 전환">',
        '      <button type="button" class="pau-seg-btn' + (state.hSubTab === 'HISTORY' ? ' on' : '') + '" data-h-sub="HISTORY">🔄 연혁 · 과거↔현행 대비 (' + fmtNum(timelineAll.length) + '건)</button>',
        '      <button type="button" class="pau-seg-btn' + (state.hSubTab === 'PEERS' ? ' on' : '') + '" data-h-sub="PEERS">🏛️ 유사기관 추천 (' + fmtNum(similars.length) + '곳)</button>',
        '      <button type="button" class="pau-seg-btn' + (state.hSubTab === 'CHART' ? ' on' : '') + '" data-h-sub="CHART">📈 업종 대비 그래프 진단</button>',
        '    </div>',
        (state.hSubTab === 'HISTORY' ? [
          '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
          '      <select data-f="hCatFilter" aria-label="연혁 구분 필터">',
          '        <option value=""' + (!state.hCatFilter ? ' selected' : '') + '>연혁 전체 (' + timelineAll.length + '건)</option>',
          '        <option value="AGREEMENT"' + (state.hCatFilter === 'AGREEMENT' ? ' selected' : '') + '>단체협약·임금협약</option>',
          '        <option value="SEPARATE"' + (state.hCatFilter === 'SEPARATE' ? ' selected' : '') + '>별도합의·노사협의</option>',
          '        <option value="STATUS"' + (state.hCatFilter === 'STATUS' ? ' selected' : '') + '>노조·타임오프 현황</option>',
          '        <option value="RULE"' + (state.hCatFilter === 'RULE' ? ' selected' : '') + '>취업규칙·내부규정</option>',
          '      </select>',
          '      <label style="font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">과거(A):',
          '        <select data-f="hVerA" aria-label="과거 임단협 시점 A 선택" style="max-width:200px;">',
          agreementsForCompare.map(function (a, idx) {
            return '<option value="' + idx + '"' + (idx === idxA ? ' selected' : '') + '>' + esc('(' + a.date + ') ' + a.title) + '</option>';
          }).join(''),
          '        </select>',
          '      </label>',
          '      <label style="font-size:12px;color:var(--pau-pri);font-weight:800;display:inline-flex;align-items:center;gap:4px;">↔ 현행(B):',
          '        <select data-f="hVerB" aria-label="현행 임단협 시점 B 선택" style="max-width:200px;">',
          agreementsForCompare.map(function (b, idx) {
            return '<option value="' + idx + '"' + (idx === idxB ? ' selected' : '') + '>' + esc('(' + b.date + ') ' + b.title) + '</option>';
          }).join(''),
          '        </select>',
          '      </label>',
          '    </div>'
        ].join('') : (state.hSubTab === 'PEERS' ? [
          '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
          '      <select data-f="hSimMode" aria-label="유사기관 추천 기준 선택">',
          '        <option value="ALL"' + (state.hSimMode === 'ALL' ? ' selected' : '') + '>유사 기준: 종합 추천</option>',
          '        <option value="SECTOR"' + (state.hSimMode === 'SECTOR' ? ' selected' : '') + '>동종 업종 (' + esc(rec.sectorLabel) + ')</option>',
          '        <option value="MINISTRY"' + (state.hSimMode === 'MINISTRY' ? ' selected' : '') + '>동일 소관·지자체 (' + esc(inst.ministry || '') + ')</option>',
          '        <option value="TYPE"' + (state.hSimMode === 'TYPE' ? ' selected' : '') + '>동일 기관유형 (' + esc(inst.inst_type || '') + ')</option>',
          '      </select>',
          '      <button type="button" class="pau-act-btn pri" data-go-visual-cmp="' + esc(aid) + '">📊 상위 유사기관 비교분석</button>',
          '    </div>'
        ].join('') : '    <button type="button" class="pau-act-btn pri" data-go-visual-cmp="' + esc(aid) + '">📊 비교분석 탭에서 다중기관 확장 ↗</button>')),
        '  </div>',

        (state.hSubTab === 'HISTORY' ? [
          (verA && verB ? [
            '  <div class="pau-tbl-wrap" style="max-height:240px;margin-bottom:10px;">',
            '    <table class="pau-tbl">',
            '      <thead>',
            '        <tr>',
            '          <th class="c-no">№</th>',
            '          <th style="width:16%;">시점 비교 항목</th>',
            '          <th style="width:42%;">⏪ 과거 임단협·공시 (시점 A: ' + esc(verA.date) + ')</th>',
            '          <th style="width:42%;">⏩ 현행 임단협·공시 (시점 B: ' + esc(verB.date) + ')</th>',
            '        </tr>',
            '      </thead>',
            '      <tbody>',
            '        <tr><td class="c-no">1</td><td style="font-weight:700;">협약·공시 명칭</td><td title="' + esc(verA.title) + '">' + esc(verA.title) + '</td><td title="' + esc(verB.title) + '" style="font-weight:700;color:var(--pau-pri);">' + esc(verB.title) + '</td></tr>',
            '        <tr><td class="c-no">2</td><td style="font-weight:700;">체결·공시 기준일</td><td>' + esc(verA.date + ' (' + verA.cname + ')') + '</td><td style="font-weight:700;">' + esc(verB.date + ' (' + verB.cname + ')') + '</td></tr>',
            '        <tr><td class="c-no">3</td><td style="font-weight:700;">주요 체결·개정 요약</td><td title="' + esc(verA.summary) + '">' + esc(verA.summary || '—') + '</td><td title="' + esc(verB.summary) + '" style="font-weight:600;">' + esc(verB.summary || '—') + '</td></tr>',
            '        <tr><td class="c-no">4</td><td style="font-weight:700;">핵심 조문 신·구 대비</td><td title="' + esc(matchedDiffPreviewA) + '">' + esc(matchedDiffPreviewA) + '</td><td title="' + esc(matchedDiffPreviewB) + '" style="font-weight:600;color:var(--pau-pri);">' + esc(matchedDiffPreviewB) + '</td></tr>',
            '        <tr><td class="c-no">5</td><td style="font-weight:700;">원문 첨부 · 공시뷰어</td><td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' +
              renderFilePills(verA.files, '과거A 원문') +
              (safeHttpUrl(buildOrganUrl(inst, verA.dno, resolveTargetTypeFromDisc(verA))) ? '<a class="pau-pill ok" href="' + esc(safeHttpUrl(buildOrganUrl(inst, verA.dno, resolveTargetTypeFromDisc(verA)))) + '"' + ((isLoc && !isErcMoisOrgan(inst)) ? (' data-cleaneye-post="' + esc(aid) + '" data-cleaneye-type="' + esc(resolveTargetTypeFromDisc(verA)) + '"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시원문</a>' : '—') +
              '</div></td><td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' +
              renderFilePills(verB.files, '현행B 원문') +
              (safeHttpUrl(buildOrganUrl(inst, verB.dno, resolveTargetTypeFromDisc(verB))) ? '<a class="pau-pill ok" href="' + esc(safeHttpUrl(buildOrganUrl(inst, verB.dno, resolveTargetTypeFromDisc(verB)))) + '"' + ((isLoc && !isErcMoisOrgan(inst)) ? (' data-cleaneye-post="' + esc(aid) + '" data-cleaneye-type="' + esc(resolveTargetTypeFromDisc(verB)) + '"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시원문</a>' : '—') +
              (idxA === idxB && agreementsForCompare.length >= 2 ? ' <span class="pau-pill multi">동일 시점 문서 선택됨</span>' : '') +
              '</div></td></tr>',
            '      </tbody>',
            '    </table>',
            '  </div>'
          ].join('') : ''),

          (revList.length ? revList.map(function (rev, rIdx) {
            var isSelectedMatch = isRevMatchVersion(rev, verA) || isRevMatchVersion(rev, verB);
            return [
              '  <div style="font-size:12.5px;font-weight:700;color:var(--pau-pri);margin:8px 0 4px;">📌 ' + (isSelectedMatch ? '⭐ 선택 시점 연동 ' : '') + '신·구 조문 대비표 #' + (rIdx + 1) + ' — ' + esc(rev.title) + ' (기준일: ' + esc(rev.date) + ' · 조문비교 ' + fmtNum(rev.diffs.length) + '건)</div>',
              (rev.summaryLines.length ? '<div style="background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:8px;padding:7px 11px;margin-bottom:6px;font-size:12px;color:var(--pau-sub);line-height:1.5;"><b>주요 개정 요약:</b> ' + rev.summaryLines.slice(0, 6).map(function (s) { return esc(s); }).join(' · ') + '</div>' : ''),
              (rev.diffs.length ? [
                '  <div class="pau-tbl-wrap" style="max-height:240px;margin-bottom:8px;">',
                '    <table class="pau-tbl">',
                '      <thead><tr><th class="c-no">№</th><th style="width:18%;">개정 조문 · 항목</th><th style="width:35%;">⏪ 과거 임단협 (개정 전)</th><th style="width:35%;">⏩ 현행 임단협 (개정 후)</th><th style="width:12%;">비고</th></tr></thead>',
                '      <tbody>',
                rev.diffs.map(function (d, idx) {
                  return '<tr><td class="c-no">' + (idx + 1) + '</td><td title="' + esc(d.art) + '" style="font-weight:700;">' + esc(d.art) + '</td><td title="' + esc(d.before) + '">' + esc(d.before) + '</td><td title="' + esc(d.after) + '" style="color:var(--pau-pri);font-weight:600;">' + esc(d.after) + '</td><td>' + esc(d.note) + '</td></tr>';
                }).join(''),
                '      </tbody>',
                '    </table>',
                '  </div>'
              ].join('') : '')
            ].join('');
          }).join('') : ''),

          '  <div style="font-size:12px;font-weight:700;margin:6px 0 4px;">📅 전체 연혁 타임라인 (' + fmtNum(timeline.length) + '건)</div>',
          '  <div class="pau-tbl-wrap" style="max-height:260px;">',
          '    <table class="pau-tbl">',
          '      <thead><tr><th class="c-no">№</th><th style="width:12%;">연혁 일자</th><th style="width:13%;">영역 분류</th><th style="width:23%;">임단협·공시·규정 제목</th><th style="width:20%;">체결·개정 주요 요약</th><th style="width:14%;">시점 대조</th><th style="width:18%;">원문 · 첨부</th></tr></thead>',
          '      <tbody>',
          (timeline.length ? timeline.map(function (t, i) {
            var cmpIdx = agreementsForCompare.findIndex(function (x) { return x.id === t.id; });
            var isA = verA && verA.id === t.id;
            var isB = verB && verB.id === t.id;
            var tlTargetType = resolveTargetTypeFromDisc(t);
            var safeView = safeHttpUrl(buildOrganUrl(inst, t.dno, tlTargetType));
            var filePillsHtml = renderFilePills(t.files, '첨부원문');
            return [
              '<tr' + ((isA || isB) ? ' style="background:var(--pau-pri-bg);"' : '') + '>',
              '  <td class="c-no">' + (i + 1) + '</td>',
              '  <td style="font-weight:700;"><span class="pau-pill">' + esc(t.year) + '</span> ' + esc(t.date) + '</td>',
              '  <td><span class="pau-pill ' + (t.catGroup === 'AGREEMENT' ? 'fktu' : (t.catGroup === 'SEPARATE' ? 'multi' : 'ok')) + '">' + esc(t.cname) + '</span></td>',
              '  <td title="' + esc(t.title) + '" style="font-weight:700;">' + esc(t.title) + '</td>',
              '  <td title="' + esc(t.summary) + '">' + esc(t.summary || '—') + '</td>',
              '  <td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">',
              (cmpIdx >= 0 ? '<button type="button" class="pau-act-btn' + (isA ? ' pri' : '') + '" data-set-vera="' + cmpIdx + '">과거A' + (isA ? '✓' : '') + '</button>' : ''),
              (cmpIdx >= 0 ? '<button type="button" class="pau-act-btn' + (isB ? ' pri' : '') + '" data-set-verb="' + cmpIdx + '">현행B' + (isB ? '✓' : '') + '</button>' : ''),
              '  </div></td>',
              '  <td style="white-space:normal;"><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' + filePillsHtml + (safeView ? '<a class="pau-pill ok" href="' + esc(safeView) + '"' + ((isLoc && !isErcMoisOrgan(inst)) ? (' data-cleaneye-post="' + esc(aid) + '" data-cleaneye-type="' + esc(tlTargetType) + '"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시원문</a>' : '') + (!filePillsHtml && !safeView ? '—' : '') + '</div></td>',
              '</tr>'
            ].join('');
          }).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--pau-muted);">해당 영역 분류의 연혁 문서가 없습니다.</td></tr>'),
          '      </tbody>',
          '    </table>',
          '  </div>'
        ].join('') : (state.hSubTab === 'PEERS' ? [
          '  <div class="pau-tbl-wrap" style="max-height:320px;">',
          '    <table class="pau-tbl">',
          '      <thead><tr><th class="c-no">№</th><th style="width:19%;">기관명 · 소관 (클릭→별개 창)</th><th style="width:13%;">권역 · 유형</th><th style="width:15%;">대표노조 · 상급</th><th style="width:10%;">조합원 · 조직률</th><th style="width:9%;">타임오프</th><th style="width:18%;">유사 선정 사유 · 점수</th><th style="width:16%;">비교담기 · 상세</th></tr></thead>',
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
          '  </div>'
        ].join('') : [
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
          renderGroupedKpiBarsHtml([rec].concat(topPeerRecs), sectorBench)
        ].join(''))),
        '</div>'
      ].join('');

      bindFilterInputs(renderTabOrganHistory);

      var openWinBtn = bodyEl.querySelector('[data-h-open-win]');
      if (openWinBtn) {
        openWinBtn.addEventListener('click', function () {
          openOrganWindow(openWinBtn.getAttribute('data-h-open-win') || aid, false);
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-jump-organ]'), function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
        });
      });
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-set-vera]'), function (b) {
        b.addEventListener('click', function () {
          state.hVerA = Number(b.getAttribute('data-set-vera') || 0);
          renderTabOrganHistory();
        });
      });
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-set-verb]'), function (b) {
        b.addEventListener('click', function () {
          state.hVerB = Number(b.getAttribute('data-set-verb') || 0);
          renderTabOrganHistory();
        });
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 탭 3: 다중 기관 그래프 · 히트맵 비교분석 스튜디오 & 13대 핵심 쟁점 원문 대조
    // ════════════════════════════════════════════════════════════════════════
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
      var q = state.mQuery.trim().toLowerCase();
      return safeMetrics.filter(function (m) {
        if (m.metric_key !== state.mIssue) return false;
        var inst = instMap[m.apba_id] || { apba_id: m.apba_id, inst_type: m.inst_type };
        if (!matchOrganScope(inst, state.mScope)) return false;
        if (state.mType && m.inst_type !== state.mType) return false;
        var uList = unionsByAid[m.apba_id] || [];
        var repU = uList[0] || {};
        var cf = worth(repU.confederation) ? repU.confederation : '미가입';
        if (state.mConfed && cf !== state.mConfed) return false;
        if (q) {
          var hay = ((m.inst_name || '') + ' ' + (repU.union_name || '') + ' ' + (m.metric_value || '') + ' ' + (m.snippet || '') + ' ' + (m.evidence_article || '')).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function renderTabMatrix() {
      var def = METRIC_DEFS.find(function (d) { return d.key === state.mIssue; }) || METRIC_DEFS[0];

      if (state.mSubMode === 'ALL_LIST') {
        var rows = filterMatrix();
        var checkedAids = Object.keys(state.mChecked).filter(function (k) { return state.mChecked[k]; });
        var selectedRows = rows.filter(function (r) { return state.mChecked[r.apba_id]; });

        bodyEl.innerHTML = [
          '<div class="pau-flt">',
          '  <div class="pau-seg" role="group" aria-label="비교분석 보기 전환">',
          '    <button type="button" class="pau-seg-btn" data-m-submode="STUDIO">📊 다중기관 비교</button>',
          '    <button type="button" class="pau-seg-btn on" data-m-submode="ALL_LIST">⚖️ 단일쟁점 목록</button>',
          '  </div>',
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
          '  <input type="search" data-f="mQuery" aria-label="쟁점 조문 검색" placeholder="기관명·조문 검색" value="' + esc(state.mQuery) + '" style="min-width:155px;max-width:220px;">',
          '  <span class="pau-flt-hint" style="font-size:12px;font-weight:700;">⚖️ ' + esc(def.lawTitle) + '</span>',
          '</div>',
          '<div class="pau-bulk' + (checkedAids.length ? ' on' : '') + '">',
          '  <span>☑️ 선택한 <b>' + fmtNum(checkedAids.length) + '곳</b> 하단 원문 대조 중</span>',
          '  <button type="button" class="pau-act-btn pri" data-m-bulk-cmp>📊 선택 기관 그래프·히트맵 비교</button>',
          '  <button type="button" class="pau-act-btn" data-m-bulk-clr>선택 해제</button>',
          '</div>',
          '<div class="pau-tbl-wrap" style="max-height:360px;">',
          '  <table class="pau-tbl">',
          '    <thead><tr><th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-m-all aria-label="상위 6개 기관 전체 선택"' + (rows.length && rows.slice(0, 6).every(function (r) { return !!state.mChecked[r.apba_id]; }) ? ' checked' : '') + '></label></th><th class="c-no">№</th><th style="width:18%;">기관명 (클릭→별개 창)</th><th style="width:15%;">대표노조 · 상급</th><th style="width:11%;">조합원 · 타임오프</th><th style="width:18%;">단협 핵심 지표 요약</th><th style="width:23%;">조문 발췌</th><th style="width:12%;">비교담기</th></tr></thead>',
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
        ].join('');

        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-m-submode]'), function (b) {
          b.addEventListener('click', function () {
            state.mSubMode = b.getAttribute('data-m-submode') || 'STUDIO';
            renderTabMatrix();
          });
        });
        var mAllCk = bodyEl.querySelector('[data-m-all]');
        if (mAllCk) {
          mAllCk.addEventListener('change', function () {
            if (mAllCk.checked) {
              state.mChecked = {};
              rows.slice(0, 6).forEach(function (r) { state.mChecked[r.apba_id] = true; });
            } else {
              state.mChecked = {};
            }
            renderTabMatrix();
          });
        }
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-m-ck]'), function (ck) {
          ck.addEventListener('change', function () {
            var k = ck.getAttribute('data-m-ck') || '';
            if (ck.checked) state.mChecked[k] = true;
            else delete state.mChecked[k];
            renderTabMatrix();
          });
        });
        var bulkCmpBtn = bodyEl.querySelector('[data-m-bulk-cmp]');
        if (bulkCmpBtn) {
          bulkCmpBtn.addEventListener('click', function () {
            state.compareIds = checkedAids.filter(function (id) { return !!organById[id]; }).slice(0, 6);
            state.mSubMode = 'STUDIO';
            renderCompareTray();
            renderTabMatrix();
          });
        }
        var bulkClrBtn = bodyEl.querySelector('[data-m-bulk-clr]');
        if (bulkClrBtn) {
          bulkClrBtn.addEventListener('click', function () {
            state.mChecked = {};
            renderTabMatrix();
          });
        }
        bindFilterInputs(renderTabMatrix);
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-jump-organ]'), function (a) {
          a.addEventListener('click', function (e) {
            e.preventDefault();
            openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
          });
        });
        var sbsEl2 = bodyEl.querySelector('[data-m-sbs]');
        var compareList2 = selectedRows.length ? selectedRows.slice(0, 6) : rows.slice(0, 3);
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
        return;
      }

      // ── STUDIO 모드 (기본): 다중 기관 그래프 + 정량비교표 + 13대 쟁점 히트맵 매트릭스 + 조문 원문 병렬대조 ──
      var cmpRecs = getActiveCompareRecords();
      if (!cmpRecs.length) {
        bodyEl.innerHTML = '<div class="pau-sec-card" style="padding:32px;text-align:center;color:var(--pau-muted);">비교 분석할 공공기관 데이터가 없습니다.</div>';
        return;
      }
      var baseRec = cmpRecs[0];
      var bench = benchmarks.bySector[baseRec.sectorCode] || benchmarks.ALL;
      var scatterPool = organRecords.filter(function (r) { return r.sectorCode === baseRec.sectorCode; });
      if (scatterPool.length < 8) scatterPool = organRecords;

      var addQ = (state.cmpAddQuery || '').trim().toLowerCase();
      var addCandidates = organRecords.filter(function (r) {
        if (!addQ) return r.hasUnion;
        return (r.name + ' ' + r.ministry + ' ' + r.sectorLabel).toLowerCase().indexOf(addQ) >= 0;
      }).slice(0, 120);

      // 정량 비교표 행 정의
      var quantRows = [
        { label: '권역 · 소관부처/지자체', fn: function (r) { return r.scopeLabel + ' · ' + r.ministry; }, benchTxt: esc(bench.label) },
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
        // 상단 단일 통합 컨트롤 + 비교 대상 기관 배지 카드
        '<div class="pau-sec-card" style="padding:8px 10px;">',
        '  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      <div class="pau-seg" role="group" aria-label="비교분석 보기 전환">',
        '        <button type="button" class="pau-seg-btn on" data-m-submode="STUDIO">📊 다중기관 비교</button>',
        '        <button type="button" class="pau-seg-btn" data-m-submode="ALL_LIST">⚖️ 단일쟁점 목록</button>',
        '      </div>',
        '      <button type="button" class="pau-act-btn" data-preset-cmp="PEER">🔄 유사그룹</button>',
        '      <button type="button" class="pau-act-btn" data-preset-cmp="METRO">🚇 교통공사</button>',
        '      <button type="button" class="pau-act-btn" data-preset-cmp="MOIS">🏛️ 행안부유관</button>',
        '    </div>',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      <input type="search" data-f="cmpAddQuery" aria-label="비교 추가할 기관 검색" placeholder="추가 기관 필터" value="' + esc(state.cmpAddQuery) + '" style="min-width:140px;max-width:185px;">',
        '      <select data-cmp-add-sel aria-label="비교함에 추가할 기관 선택" style="max-width:230px;">',
        '        <option value="">+ 기관 추가 (최대 6곳)</option>',
        addCandidates.map(function (c) {
          return '<option value="' + esc(c.aid) + '">' + esc('(' + c.scopeLabel + ') ' + c.name + ' · ' + fmtNum(c.memberTotal) + '명') + '</option>';
        }).join(''),
        '      </select>',
        '    </div>',
        '  </div>',
        '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:1px dashed var(--pau-bd);">',
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
        '    <span style="font-size:11.5px;color:var(--pau-muted);">그래프·정량표·13대 쟁점 히트맵 실시간 동기화</span>',
        '  </div>',
        '</div>',

        // 1) 상단 시각화 그래프 2단 + 정량 그룹 막대 차트
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

        // 2) 정량 수치 총괄 비교표
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

        // 3) 13대 핵심 단협 쟁점 × 비교기관 색상 히트맵 비교표
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

        // 4) 선택한 쟁점의 조문 원문 1:N 병렬 대조 + 실시간 법령 기준
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

      bindFilterInputs(renderTabMatrix);

      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-m-submode]'), function (b) {
        b.addEventListener('click', function () {
          state.mSubMode = b.getAttribute('data-m-submode') || 'STUDIO';
          renderTabMatrix();
        });
      });

      var addSel = bodyEl.querySelector('[data-cmp-add-sel]');
      if (addSel) {
        addSel.addEventListener('change', function () {
          var v = addSel.value;
          if (v && organById[v]) {
            if (!state.compareIds.length) {
              state.compareIds = cmpRecs.map(function (r) { return r.aid; });
            }
            if (state.compareIds.indexOf(v) === -1) {
              if (state.compareIds.length >= 6) state.compareIds.pop();
              state.compareIds.push(v);
            }
            renderCompareTray();
            renderTabMatrix();
          }
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

      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-jump-organ]'), function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
        });
      });

      var lawBox = bodyEl.querySelector('[data-law-live-box]');
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
      return [
        '<div class="pau-seg" role="group" aria-label="조문·원문 전환">',
        '  <button type="button" class="pau-seg-btn' + (state.docMode !== 'DISC' ? ' on' : '') + '" data-doc-mode="ARTICLES">🔍 단협 조문 (' + fmtNum(totalArt) + ')</button>',
        '  <button type="button" class="pau-seg-btn' + (state.docMode === 'DISC' ? ' on' : '') + '" data-doc-mode="DISC">📂 공시·사규 원문 (' + fmtNum(totalDisc) + ')</button>',
        '</div>'
      ].join('');
    }

    function filterArticles() {
      var q = state.aQuery.trim().toLowerCase();
      return safeArticles.filter(function (a) {
        var inst = instMap[a.apba_id] || { apba_id: a.apba_id, inst_type: a.inst_type };
        if (!matchOrganScope(inst, state.aScope)) return false;
        if (state.aCat && state.aCat !== 'ALL' && a.taxonomy_code !== state.aCat) return false;
        if (q) {
          var hay = ((a.inst_name || '') + ' ' + (a.article_title || '') + ' ' + (a.text || '') + ' ' + (a.taxonomy_name || '')).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function renderTabArticles() {
      var rows = filterArticles();

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  ' + renderDocModeToggleHtml(),
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
        '  <input type="search" data-f="aQuery" aria-label="단체협약 조문 검색" placeholder="조문 검색 (예: 타임오프, 징계, 정년)" value="' + esc(state.aQuery) + '" style="min-width:220px;">',
        '  <span style="font-size:12px;margin-left:auto;">조회 <b>' + fmtNum(rows.length) + '</b>건</span>',
        '</div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-no">№</th>',
        '        <th style="width:18%;">기관명 (클릭→별개 창)</th>',
        '        <th style="width:14%;">쟁점 분류</th>',
        '        <th style="width:8%;">조문번호</th>',
        '        <th style="width:16%;">조문제목</th>',
        '        <th style="width:35%;">조문 본문</th>',
        '        <th style="width:9%;">비교담기</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody>',
        (rows.length ? rows.map(function (a, idx) {
          var bodyTxt = String(a.text || '').replace(/\s+/g, ' ').trim();
          var artNo = String(a.article_no || '');
          if (artNo && artNo.indexOf('제') !== 0 && /^\d+$/.test(artNo)) artNo = '제' + artNo + '조';
          var inCmp = state.compareIds.indexOf(a.apba_id) >= 0;
          return [
            '<tr>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(a.inst_name) + '"><a href="pu-alio-union.html?organ=' + encodeURIComponent(a.apba_id) + '" data-jump-organ="' + esc(a.apba_id) + '" style="font-weight:700;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(a.inst_name) + '</a></td>',
            '  <td><span class="pau-pill">' + esc(a.taxonomy_name || '기타') + '</span></td>',
            '  <td style="font-weight:700;">' + esc(artNo) + '</td>',
            '  <td title="' + esc(a.article_title || '') + '" style="font-weight:700;color:var(--pau-pri);">' + esc(a.article_title || '—') + '</td>',
            '  <td title="' + esc(bodyTxt) + '">' + esc(bodyTxt) + '</td>',
            '  <td style="white-space:normal;"><button type="button" class="pau-act-btn' + (inCmp ? ' pri' : '') + '" data-toggle-cmp="' + esc(a.apba_id) + '">' + (inCmp ? '✓비교' : '+비교') + '</button></td>',
            '</tr>'
          ].join('');
        }).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--pau-muted);">검색 조건에 해당하는 단체협약 조문이 없습니다.</td></tr>'),
        '    </tbody>',
        '  </table>',
        '</div>'
      ].join('');

      bindFilterInputs(renderTabArticles);
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-jump-organ]'), function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
        });
      });
    }

    function filterDisclosures() {
      var q = state.dQuery.trim().toLowerCase();
      return safeDiscs.filter(function (d) {
        var inst = instMap[d.aid] || { apba_id: d.aid };
        if (!matchOrganScope(inst, state.dScope)) return false;
        if (state.dOrgan && d.aid !== state.dOrgan) return false;
        if (state.dTax && state.dTax !== 'ALL' && String(d.ccode) !== String(state.dTax)) return false;
        if (q) {
          var hay = ((d.iname || '') + ' ' + (d.cname || '') + ' ' + (d.title || '') + ' ' + ((d.highlights || []).join(' '))).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function renderTabDetail() {
      var rows = filterDisclosures();
      var selectedInst = state.dOrgan ? instMap[state.dOrgan] : null;
      var safeSelectedUnionUrl = selectedInst ? safeHttpUrl(buildOrganUrl(selectedInst)) : '';
      var dOrgSearchLower = (state.dOrganSearch || '').trim().toLowerCase();
      var scopedOrgans = safeInsts.filter(function (o) {
        if (!matchOrganScope(o, state.dScope)) return false;
        if (!dOrgSearchLower) return true;
        var hay = ((o.name || '') + ' ' + (o.ministry || '') + ' ' + (o.apba_id || '')).toLowerCase();
        return hay.indexOf(dOrgSearchLower) !== -1;
      });
      if (selectedInst && scopedOrgans.every(function (o) { return o.apba_id !== selectedInst.apba_id; })) {
        scopedOrgans.unshift(selectedInst);
      }

      var pageSize = 300;
      var totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      if (state.dPage >= totalPages) state.dPage = totalPages - 1;
      if (state.dPage < 0) state.dPage = 0;
      var startIdx = state.dPage * pageSize;
      var visibleRows = rows.slice(startIdx, startIdx + pageSize);

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  ' + renderDocModeToggleHtml(),
        '  <select data-f="dScope" aria-label="중앙·지방 구분">',
        '    <option value="ALL"' + (state.dScope === 'ALL' ? ' selected' : '') + '>구분 전체 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.dScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙 ALIO</option>',
        '    <option value="LOCAL_ALL"' + (state.dScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방 전체</option>',
        '    <option value="LOCAL_ERC_MOIS"' + (state.dScope === 'LOCAL_ERC_MOIS' ? ' selected' : '') + '>🏛️ 평가원·행안부 유관</option>',
        '  </select>',
        '  <input type="search" data-f="dOrganSearch" aria-label="공시 조회 기관명 필터" placeholder="기관 필터" value="' + esc(state.dOrganSearch) + '" style="min-width:120px;max-width:165px;">',
        '  <select data-f="dOrgan" aria-label="공시 조회 기관 선택">',
        '    <option value="">전체 기관 (' + fmtNum(scopedOrgans.length) + '곳)</option>',
        scopedOrgans.map(function (i) {
          return '<option value="' + esc(i.apba_id) + '"' + (state.dOrgan === i.apba_id ? ' selected' : '') + '>' + esc((isLocalOrgan(i) ? '(지방) ' : '(중앙) ') + i.name + ' (' + i.apba_id + ')') + '</option>';
        }).join(''),
        '  </select>',
        '  <select data-f="dTax" aria-label="공시 항목 분류 선택">',
        DISC_CCODE_LIST.map(function (t) {
          return '<option value="' + esc(t[0]) + '"' + (state.dTax === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join(''),
        '  </select>',
        '  <input type="search" data-f="dQuery" aria-label="공시문서 검색" placeholder="문서·첨부파일명 검색" value="' + esc(state.dQuery) + '" style="min-width:175px;max-width:240px;">',
        (selectedInst ? '<button type="button" class="pau-act-btn pri" data-open-organ-here="' + esc(selectedInst.apba_id) + '">🔎 ' + esc(selectedInst.name) + ' 상세</button>' : ''),
        (safeSelectedUnionUrl ? '<a class="pau-act-btn" href="' + esc(safeSelectedUnionUrl) + '"' + ((selectedInst && isLocalOrgan(selectedInst) && !isErcMoisOrgan(selectedInst)) ? (' data-cleaneye-post="' + esc(selectedInst.apba_id) + '" data-cleaneye-type="' + esc(state.dTax === '21110' ? 'rules' : (state.dTax === '63787' ? 'union_status' : (state.dTax === '21025' ? 'multi_union' : 'union_info'))) + '"') : '') + ' target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시 원문</a>' : ''),
        '</div>',
        '<div class="pau-subbar">',
        '  <span>조회 공시·사규 문서 <b>' + fmtNum(rows.length) + '</b>건' + (rows.length > pageSize ? ' (' + fmtNum(startIdx + 1) + '~' + fmtNum(startIdx + visibleRows.length) + '번째 표시)' : '') + '</span>',
        (rows.length > pageSize ? [
          '  <div style="display:flex;align-items:center;gap:6px;">',
          '    <span>' + (state.dPage + 1) + ' / ' + totalPages + ' 페이지</span>',
          '    <button type="button" class="pau-act-btn" data-d-prev' + (state.dPage <= 0 ? ' disabled' : '') + '>◀ 이전</button>',
          '    <button type="button" class="pau-act-btn" data-d-next' + (state.dPage + 1 >= totalPages ? ' disabled' : '') + '>다음 ▶</button>',
          '  </div>'
        ].join('') : ''),
        '</div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead><tr><th class="c-no">№</th><th style="width:17%;">기관명 (클릭→별개 창)</th><th style="width:14%;">공시항목 분류</th><th style="width:23%;">문서 제목 · 기준연혁일</th><th style="width:22%;">원문 첨부파일 · 공시뷰어 API</th><th style="width:24%;">본문 요약 · 추출 미리보기</th></tr></thead>',
        '    <tbody>',
        (visibleRows.length ? visibleRows.map(function (d, idx) {
          var absIdx = startIdx + idx;
          var files = d.files || [];
          var firstFile = files[0] || null;
          var dTargetType = resolveTargetTypeFromDisc(d);
          var filePillsHtml = renderFilePills(files, '원문다운');
          var safeViewerUrl = safeHttpUrl(buildOrganUrl(instMap[d.aid] || d.aid, d.dno, dTargetType));
          var kvParts = [];
          Object.keys(d.kv || {}).forEach(function (k) {
            if (worth(d.kv[k])) kvParts.push(k + ': ' + d.kv[k]);
          });
          var prev = ((d.highlights || []).join(' ') || kvParts.join(' · ')).replace(/\s+/g, ' ').trim();
          var dt = d.edate || d.rdate || '';
          var titFull = (d.title || '') + (dt ? ' (' + dt + ')' : '');
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
            '  <td title="' + esc(prev) + '">' + esc(prev || '—') + '</td>',
            '</tr>'
          ].join('');
        }).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--pau-muted);">선택한 조건에 해당하는 공시·내부규정 문서가 없습니다.</td></tr>'),
        '    </tbody>',
        '  </table>',
        '</div>'
      ].join('');

      bindFilterInputs(renderTabDetail);
      var prevBtn = bodyEl.querySelector('[data-d-prev]');
      if (prevBtn) prevBtn.addEventListener('click', function () { if (state.dPage > 0) { state.dPage -= 1; renderTabDetail(); } });
      var nextBtn = bodyEl.querySelector('[data-d-next]');
      if (nextBtn) nextBtn.addEventListener('click', function () { if (state.dPage + 1 < totalPages) { state.dPage += 1; renderTabDetail(); } });

      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-jump-organ]'), function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
        });
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 탭 6: 공공·법령 API 실시간 연동 센터
    // ════════════════════════════════════════════════════════════════════════
    function renderTabApiHub() {
      var inst = instMap[state.apiAlioAid] || safeInsts[0] || { apba_id: 'C0005', name: '(주)강원랜드' };
      var isLoc = isLocalOrgan(inst);
      var apiSearchLower = (state.apiAlioSearch || '').trim().toLowerCase();
      var apiOrgans = safeInsts.filter(function (o) {
        if (!apiSearchLower) return true;
        var hay = ((o.name || '') + ' ' + (o.ministry || '') + ' ' + (o.apba_id || '')).toLowerCase();
        return hay.indexOf(apiSearchLower) !== -1;
      });
      if (apiOrgans.every(function (o) { return o.apba_id !== inst.apba_id; })) {
        apiOrgans.unshift(inst);
      }

      var alioLiveUrl = isLoc
        ? 'https://www.cleaneye.go.kr/user/gongsiCompare/selectGongsiCompare.do'
        : ('https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(inst.apba_id) + '&reportFormRootNo=' + encodeURIComponent(state.apiAlioTax));
      var alioDocUrl = 'https://www.alio.go.kr/download/file.json?f=FILE&d=DOC';
      var alioRuleUrl = isLoc
        ? alioLiveUrl
        : ('https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(inst.apba_id) + '&reportFormRootNo=21110');

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
        '      <input type="search" data-f="apiAlioSearch" aria-label="API 대상 기관명 검색" placeholder="기관 필터" value="' + esc(state.apiAlioSearch) + '" style="min-width:125px;max-width:175px;">',
        '      <select data-f="apiAlioAid" aria-label="API 대상 기관 선택">',
        apiOrgans.map(function (i) {
          return '<option value="' + esc(i.apba_id) + '"' + (state.apiAlioAid === i.apba_id ? ' selected' : '') + '>' + esc((isLocalOrgan(i) ? '(지방) ' : '(중앙) ') + i.name + ' (' + i.apba_id + ')') + '</option>';
        }).join(''),
        '      </select>',
        '      <select data-f="apiAlioTax" aria-label="공시 항목 코드 선택">',
        DISC_CCODE_LIST.filter(function (x) { return x[0] !== 'ALL'; }).map(function (t) {
          return '<option value="' + esc(t[0]) + '"' + (state.apiAlioTax === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join(''),
        '      </select>',
        '    </div>',
        '    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;">',
        '      <button type="button" class="pau-act-btn pri" data-api-open-organ="' + esc(inst.apba_id) + '">↗ ' + esc(inst.name) + ' 6대영역·비교 창 열기</button>',
        (isLoc
          ? ('<button type="button" class="pau-act-btn" data-cleaneye-post="' + esc(inst.apba_id) + '" data-cleaneye-type="union_info">🔗 ' + (isErcMoisOrgan(inst) ? '기관 임단협·노조 공시 열기' : '클린아이 협약정보(14_2/90_25) 직결') + '</button>' +
             '<button type="button" class="pau-act-btn" data-cleaneye-post="' + esc(inst.apba_id) + '" data-cleaneye-type="union_status">👥 노조현황(14_1/90_20) 직결</button>' +
             '<button type="button" class="pau-act-btn" data-cleaneye-post="' + esc(inst.apba_id) + '" data-cleaneye-type="rules">📘 정관·내부규정(11_1/90_40) 직결</button>' +
             '<button type="button" class="pau-act-btn" data-cleaneye-post="' + esc(inst.apba_id) + '" data-cleaneye-type="welfare">🏖️ 휴가·복리후생 직결</button>')
          : ('<a class="pau-act-btn" href="' + esc(alioLiveUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 ALIO 공시 열기</a>' +
             '<a class="pau-act-btn" href="' + esc(alioRuleUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📘 내부규정 열기</a>')),
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

      bindFilterInputs(renderTabApiHub);
      var openOrganBtn = bodyEl.querySelector('[data-api-open-organ]');
      if (openOrganBtn) {
        openOrganBtn.addEventListener('click', function () {
          openOrganWindow(openOrganBtn.getAttribute('data-api-open-organ') || inst.apba_id, false);
        });
      }
      var lawOut = bodyEl.querySelector('[data-api-law-out]');
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

    function bindFilterInputs(rerender) {
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-f]'), function (el) {
        var key = el.getAttribute('data-f');
        var ev = (el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(ev, function () {
          state[key] = el.value;
          if (key === 'uScope' || key === 'uSector' || key === 'uType' || key === 'uMinistry' || key === 'uConfed' || key === 'uStruct' || key === 'uSort' || key === 'uQuery') {
            state.uPage = 0;
          }
          if (key === 'dScope' || key === 'dOrganSearch' || key === 'dOrgan' || key === 'dTax' || key === 'dQuery') {
            state.dPage = 0;
          }
          if (key === 'hOrgan') {
            state.hVerA = 1;
            state.hVerB = 0;
          }
          var pos = el.selectionStart;
          rerender();
          var next = bodyEl.querySelector('[data-f="' + key + '"]');
          if (next && typeof next.focus === 'function') {
            next.focus();
            if (ev === 'input') {
              try { next.setSelectionRange(pos, pos); } catch (e) {}
            }
          }
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
            ['기관코드', '권역', '기관명', '소관부처_지자체', '업종분류', '기관유형', '노조체계', '단위노조수', '대표노조', '상급단체', '가입대상', '합산조합원', '조직률(%)', '타임오프(h)', '법정상한(h)', '한도사용률(%)', '단협건수', '임협건수', '별도합의건수', '사규건수', '종합점수'],
            oRows.map(function (r) {
              return [
                r.aid, r.scopeLabel, r.name, r.ministry, r.sectorLabel, r.inst_type, r.unionStructLabel,
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
        var arts = filterArticles();
        downloadCsv(
          '공공임단협_단협조문검색.csv',
          ['기관코드', '기관명', '분류', '조문번호', '조문제목', '조문본문'],
          arts.map(function (a) {
            return [a.apba_id, a.inst_name, a.taxonomy_name, a.article_no, a.article_title, a.text];
          })
        );
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

    function renderCurrentTab() {
      if (state.tab === 'unions') renderTabUnions();
      else if (state.tab === 'organ') renderTabOrganHistory();
      else if (state.tab === 'matrix') renderTabMatrix();
      else if (state.tab === 'articles') {
        if (state.docMode === 'DISC') renderTabDetail();
        else renderTabArticles();
      } else if (state.tab === 'detail') renderTabDetail();
      else renderTabApiHub();
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
    safeHttpUrl: safeHttpUrl,
    setAuthUser: setAuthUser,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
