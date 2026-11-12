/* ══════════════════════════════════════════════════════════════════════════
   푸른통합시스템 — 공공임단협 (중앙 ALIO + 지방 클린아이 노동조합·임금·단체협약 통합비교 독립 프로그램)
   파일: js/pu-alio-union.js
   - 포털(enter.html) 자료함 줄의 「🤝 공공임단협」 타일 또는 오른쪽 앱바(pu-appbar.js)에서
     별개의 독립 프로그램 창(pu-alio-union.html, 창 이름 pureun-aliounion)으로 열린다.
   - 하나의 기관을 클릭하면 팝업 모달이 아니라 별개의 독립 창(pu-alio-union.html?organ=<기관코드>)으로
     열리며, 해당 기관의:
     ① 기관 연혁에 따른 노조·단체협약·임금협약·별도합의·내부규정 타임라인 정리
     ② 과거 임단협 vs 현행 임단협 비교 (신·구 조문 대비표 · 주요개정내용 · 시기별 협약 대조)
     ③ 유사 공공기관·지방공공기관·지방산하단체 임단협 검토 및 13대 핵심 쟁점 비교
     화면을 제공한다.
   - 중앙공공기관(기획재정부 ALIO 355곳) + 지방공공기관·지방산하단체(행정안전부 클린아이 1,332곳:
     지방공사·지방공단·지방직영기업·지방출자기관·지방출연기관) 총 1,687개 기관을 통합 수록한다.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var DATA_SCRIPT_URL = 'js/pu-alio-data.js?v=3';
  var STYLE_ID = 'pu-alio-union-css';
  var LS_KEY_PREFIX = 'pu_alio_datagokr_key_';

  var METRIC_DEFS = [
    { key: 'union_shop', label: '조합원 자격 (유니온숍/가입범위)', lawKey: '노동조합및노동관계조정법', lawArt: '81', lawTitle: '노조법 제5조·제81조 제1항 제2호 단서(유니온숍)' },
    { key: 'timeoff_activity', label: '근로시간면제(타임오프)·조합활동', lawKey: '노동조합및노동관계조정법', lawArt: '24', lawTitle: '노조법 제24조(노동조합의 전임자·근로시간면제 한도)' },
    { key: 'check_off', label: '조합비 일괄공제·사무실 제공', lawKey: '노동조합및노동관계조정법', lawArt: '81', lawTitle: '노조법 제81조 제1항 제4호 단서(최소한의 규모의 노동조합 사무소 제공)' },
    { key: 'personnel_participation', label: '인사원칙 노조 관여 (합의/협의)', lawKey: '근로기준법', lawArt: '23', lawTitle: '근로기준법 제23조(정당한 이유 없는 전보·인사 제한) 및 제94조(취업규칙 변경)' },
    { key: 'discipline_committee', label: '징계위원회 구성·소명·재심', lawKey: '근로기준법', lawArt: '23', lawTitle: '근로기준법 제23조·제27조(해고·징계의 정당한 이유 및 서면통지)' },
    { key: 'work_hours_overtime', label: '근로시간·연장근로·유연근무', lawKey: '근로기준법', lawArt: '50', lawTitle: '근로기준법 제50조~제53조(법정근로시간 주 40시간·연장근로 한도)' },
    { key: 'paid_holidays_leave', label: '유급휴일·특별휴가·경조휴가', lawKey: '근로기준법', lawArt: '55', lawTitle: '근로기준법 제55조(관공서 공휴일 유급휴일)·제60조(연차유급휴가)' },
    { key: 'sick_leave_accident', label: '병가(유급병가)·산재보상', lawKey: '산업안전보건법', lawArt: '52', lawTitle: '근로기준법 제78조~제80조(업무상 재해보상) 및 산업안전보건법 제52조' },
    { key: 'maternity_childcare', label: '모성보호·육아휴직·가족돌봄', lawKey: '남녀고용평등과일ㆍ가정양립지원에관한법률', lawArt: '19', lawTitle: '근로기준법 제74조(출산전후휴가)·남녀고용평등법 제19조(육아휴직)' },
    { key: 'wage_bonus_allowance', label: '임금·상여금·수당·퇴직금', lawKey: '근로기준법', lawArt: '43', lawTitle: '근로기준법 제43조(임금 지급원칙)·제56조(가산임금)·퇴직급여법 제8조' },
    { key: 'welfare_education_housing', label: '복리후생·학자금·건강검진', lawKey: '근로자참여및협력증진에관한법률', lawArt: '20', lawTitle: '근로자참여법 제20조(복지증진 협의)·사내근로복지기금법 기준' },
    { key: 'retirement_age_peak', label: '정년·명예퇴직·고용안정', lawKey: '고용상연령차별금지및고령자고용촉진에관한법률', lawArt: '19', lawTitle: '고령자고용법 제19조(정년 60세 이상 의무화)' },
    { key: 'validity_auto_extension', label: '유효기간·효력 자동연장', lawKey: '노동조합및노동관계조정법', lawArt: '32', lawTitle: '노조법 제32조(단체협약 유효기간 3년 상한·3개월 자동연장 특칙)' }
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
    { code: 'RESEARCH_INST', label: '연구원·과학기술·진흥원', kws: ['연구원', '연구개발', '과학기술', '한국연구재단', '진흥원', '테크노파크', '정보화'] },
    { code: 'FINANCE_GUAR', label: '신용보증·금융·기금', kws: ['신용보증', '보증기금', '은행', '금융', '예금보험', '자산관리', '서민금융', '투자공사', '연금'] },
    { code: 'CULTURE_TOUR', label: '문화·관광·예술·컨벤션', kws: ['문화재단', '관광공사', '관광재단', '문화회관', '예술', '벡스코', '엑스코', '컨벤션', '콘텐츠', '체육', '교향악단', '디자인'] },
    { code: 'ENERGY_WATER', label: '에너지·전력·상하수도', kws: ['전력', '발전', '수력원자력', '에너지공사', '가스', '석유', '지역난방', '수자원', '상수도', '하수도'] },
    { code: 'WELFARE_EDU', label: '복지·여성가족·교육·장학', kws: ['복지재단', '사회서비스', '여성가족', '평생교육', '장학', '인재', '청소년', '일자리', '고용', '어르신'] },
    { code: 'ECON_AGRI', label: '경제진흥·농수산·유통', kws: ['경제진흥', '경제과학', '농수산', '농어촌', '유통', '신용', '상공', '산업단지'] }
  ];

  var lawCache = {};
  var latestAppHooks = null;
  var currentAuthUid = '';
  var authLookupGen = 0;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function isLocalOrgan(aidOrInst) {
    if (!aidOrInst) return false;
    if (typeof aidOrInst === 'string') return aidOrInst.indexOf('L_') === 0;
    return String(aidOrInst.apba_id || '').indexOf('L_') === 0 || aidOrInst.portal_source === 'CLEANEYE';
  }

  function matchOrganScope(instOrUnion, scopeCode) {
    if (!scopeCode || scopeCode === 'ALL') return true;
    var isLoc = isLocalOrgan(instOrUnion);
    var it = String((instOrUnion && instOrUnion.inst_type) || '');
    if (scopeCode === 'CENTRAL') return !isLoc;
    if (scopeCode === 'LOCAL_ALL') return isLoc;
    if (scopeCode === 'LOCAL_CORP') return isLoc && (it.indexOf('지방공사') === 0 || it.indexOf('지방공단') === 0);
    if (scopeCode === 'LOCAL_AFFIL') return isLoc && (it.indexOf('지방출자') === 0 || it.indexOf('지방출연') === 0);
    if (scopeCode === 'LOCAL_DIRECT') return isLoc && it.indexOf('지방직영') === 0;
    return true;
  }

  function detectSectorGroup(inst) {
    if (!inst) return { code: 'GENERAL', label: '일반공공행정' };
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

  // ── ① 기관의 연혁에 따른 노조·임단협·별도합의·내부규정 종합 타임라인 생성 ──
  function buildOrganTimeline(data, aid) {
    if (!data || !aid) return [];
    var unions = (data.unions || []).filter(function (u) { return u && u.apba_id === aid && u.union_structure !== '노조없음'; });
    var discs = (data.disclosures || []).filter(function (d) { return d && d.aid === aid; });
    var items = [];

    // 1) 노동조합 설립 연혁
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

    // 2) 공시 및 연도별 내부규정 개정 연혁
    discs.forEach(function (d, idx) {
      var cc = String(d.ccode || '');
      var catGroup = 'AGREEMENT';
      if (cc === '21110') catGroup = 'RULE';
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

      // 내부규정(21110)에 다년도 개정 파일([2020년 개정] 등)이 여러 개 들어 있으면 연도별로 펼쳐서 타임라인에 등록
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
      '@media (prefers-color-scheme:dark){.pau-root[data-theme="dark"],body.dark .pau-root{--pau-bg:#0f172a;--pau-card:#1e293b;--pau-bd:#475569;--pau-bd-lt:#334155;--pau-txt:#f8fafc;--pau-sub:#e2e8f0;--pau-muted:#cbd5e1;--pau-th:#0f172a;--pau-hov:#334155;--pau-pri:#93c5fd;--pau-pri-bg:#1e3a8a;}}',
      '.pau-root[data-theme="dark"],body.dark .pau-root{--pau-bg:#0f172a;--pau-card:#1e293b;--pau-bd:#475569;--pau-bd-lt:#334155;--pau-txt:#f8fafc;--pau-sub:#e2e8f0;--pau-muted:#cbd5e1;--pau-th:#0f172a;--pau-hov:#334155;--pau-pri:#93c5fd;--pau-pri-bg:#1e3a8a;}',
      '.pau-lnk{color:var(--pau-pri);font-weight:700;text-decoration:none;}',
      '.pau-lnk:hover,.pau-lnk:focus-visible{text-decoration:underline;outline:2px solid var(--pau-pri);outline-offset:1px;}',
      '.pau-root *{box-sizing:border-box;}',
      '.pau-sec-card{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:10px 12px;margin-bottom:10px;}',
      '.pau-sec-tit{font-size:13.5px;font-weight:800;color:var(--pau-txt);margin:0 0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}',
      '.pau-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);color:#ffffff;flex-wrap:wrap;flex-shrink:0;}',
      '.pau-hdr-ico{font-size:20px;line-height:1;}',
      '.pau-hdr-tit{font-size:15px;font-weight:800;letter-spacing:-.3px;margin-right:4px;word-break:keep-all;}',
      '.pau-hdr-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.pau-badge{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);color:#f8fafc;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap;}',
      '.pau-badge.ok{background:rgba(22,163,74,.35);border-color:rgba(74,222,128,.55);color:#f0fdf4;}',
      '.pau-hdr-r{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.pau-who-slot{display:inline-flex;align-items:center;background:#f8fafc;color:#0f172a;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid #cbd5e1;min-height:26px;}',
      '.pau-who-slot:empty{display:none;}',
      '.pau-btn{cursor:pointer;border:1px solid rgba(255,255,255,.32);background:rgba(255,255,255,.14);color:#ffffff;padding:5px 10px;min-height:28px;border-radius:8px;font-size:12px;font-weight:600;line-height:1.2;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:4px;}',
      '.pau-btn:hover,.pau-btn:focus-visible{background:rgba(255,255,255,.24);outline:2px solid #93c5fd;outline-offset:1px;}',
      '.pau-btn.pri{background:#2563eb;border-color:#60a5fa;color:#ffffff;}',
      '.pau-btn.pri:hover{background:#1d4ed8;}',
      '.pau-tabs{display:flex;align-items:center;gap:4px;padding:6px 10px 0;background:var(--pau-card);border-bottom:1px solid var(--pau-bd-lt);flex-shrink:0;overflow-x:auto;}',
      '.pau-tab{cursor:pointer;border:1px solid transparent;border-bottom:2px solid transparent;background:transparent;color:var(--pau-muted);padding:7px 11px;min-height:32px;font-size:12.5px;font-weight:700;border-radius:8px 8px 0 0;white-space:nowrap;}',
      '.pau-tab:hover,.pau-tab:focus-visible{color:var(--pau-txt);background:var(--pau-th);outline:2px solid #2563eb;outline-offset:-2px;}',
      '.pau-tab.on{color:var(--pau-pri);border-bottom-color:#2563eb;background:var(--pau-pri-bg);}',
      '.pau-body{flex:1;min-height:0;overflow-y:auto;padding:8px 10px 18px;}',
      '.pau-flt{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 10px;background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;margin-bottom:8px;}',
      '.pau-flt select,.pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password],.pau-root select,.pau-root input[type=search],.pau-root input[type=text],.pau-root input[type=password]{height:34px;min-height:34px;max-width:100%;border:1px solid var(--pau-bd);border-radius:7px;padding:0 8px;background:var(--pau-card);color:var(--pau-txt);font-size:16px;}',
      '.pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password]{min-width:170px;flex:1;max-width:320px;}',
      '.pau-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:8px;}',
      '.pau-kpi{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:8px;padding:6px 10px;display:flex;align-items:baseline;justify-content:space-between;gap:6px;white-space:nowrap;overflow:hidden;}',
      '.pau-kpi span{font-size:11.5px;color:var(--pau-muted);}',
      '.pau-kpi b{font-size:14.5px;font-weight:800;color:var(--pau-txt);font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-bulk{display:none;align-items:center;gap:8px;padding:6px 10px;background:var(--pau-pri-bg);border:1px solid #93c5fd;border-radius:8px;margin-bottom:8px;color:var(--pau-pri);font-size:12px;font-weight:600;flex-wrap:wrap;}',
      '.pau-bulk.on{display:flex;}',
      '.pau-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;margin-bottom:6px;color:#78350f;font-size:12px;font-weight:600;flex-wrap:wrap;}',
      '.pau-tbl-wrap{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;overflow:auto;max-height:calc(100vh - 250px);}',
      '.pau-tbl{width:100%;min-width:1180px;border-collapse:collapse;table-layout:fixed;}',
      '.pau-tbl th,.pau-tbl td{padding:6px 8px;border-bottom:1px solid var(--pau-bd-lt);text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;font-size:12.5px;}',
      '.pau-tbl th{position:sticky;top:0;z-index:2;background:var(--pau-th);color:var(--pau-sub);font-weight:700;font-size:12px;}',
      '.pau-tbl tr:hover td{background:var(--pau-hov);}',
      '.pau-tbl th.c-ck,.pau-tbl td.c-ck{width:34px;text-align:center;padding:0 2px;text-overflow:clip;}',
      '.pau-tbl th.c-no,.pau-tbl td.c-no{width:44px;text-align:right;padding:0 6px;color:var(--pau-muted);font-variant-numeric:tabular-nums;text-overflow:clip;}',
      '.pau-tbl td.c-num{text-align:right;font-variant-numeric:tabular-nums;}',
      '.pau-ck-lbl{display:inline-flex;align-items:center;justify-content:center;min-width:26px;min-height:26px;cursor:pointer;margin:0;}',
      '.pau-ck-lbl input[type=checkbox]{width:15px;height:15px;margin:0;cursor:pointer;}',
      '.pau-line{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-pill{display:inline-flex;align-items:center;padding:2px 7px;min-height:24px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid var(--pau-bd);background:var(--pau-bg);color:var(--pau-sub);flex-shrink:0;white-space:nowrap;}',
      '.pau-pill.fktu{background:#eff6ff;border-color:#93c5fd;color:var(--pau-pri);}',
      '.pau-pill.kctu{background:#fef2f2;border-color:#fca5a5;color:#991b1b;}',
      '.pau-pill.multi{background:#fffbeb;border-color:#fcd34d;color:#78350f;}',
      '.pau-pill.ok{background:#f0fdf4;border-color:#86efac;color:#14532d;}',
      '.pau-pill.loc{background:#f5f3ff;border-color:#c4b5fd;color:#4c1d95;}',
      '.pau-chips{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:8px;}',
      '.pau-chip{padding:4px 10px;min-height:28px;border-radius:999px;border:1px solid var(--pau-bd);background:var(--pau-card);color:var(--pau-sub);font-size:12px;cursor:pointer;white-space:nowrap;}',
      '.pau-chip.on{background:#1e40af;border-color:var(--pau-pri);color:#ffffff;font-weight:700;}',
      '.pau-sbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:10px;margin-top:10px;}',
      '.pau-api-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:10px;}',
      '.pau-card{background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;}',
      '.pau-card.law{background:#f0fdf4;border-color:#86efac;color:#0f172a;}',
      '.pau-card-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;color:var(--pau-txt);}',
      '.pau-card-pre{margin:0;padding:8px;background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:8px;font-size:12px;line-height:1.55;white-space:pre-wrap;max-height:220px;overflow:auto;color:var(--pau-sub);font-family:inherit;}',
      '.pau-act-btn{cursor:pointer;border:1px solid var(--pau-bd);background:var(--pau-card);color:var(--pau-txt);padding:4px 9px;min-height:28px;border-radius:7px;font-size:12px;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;}',
      '.pau-act-btn:hover,.pau-act-btn:focus-visible{background:var(--pau-th);border-color:#64748b;outline:2px solid #2563eb;outline-offset:1px;}',
      '.pau-act-btn.pri{background:#2563eb;border-color:#2563eb;color:#ffffff;}',
      '@media (max-width:768px){',
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
      '  .pau-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-bottom:6px;}',
      '  .pau-kpi{padding:4px 8px;}',
      '  .pau-kpi b{font-size:13px;}',
      '  .pau-tbl-wrap{max-height:none;overflow-x:hidden;border:none;background:transparent;}',
      '  .pau-tbl{min-width:0!important;width:100%!important;display:block;}',
      '  .pau-tbl thead{display:none;}',
      '  .pau-tbl tbody{display:block;width:100%;}',
      '  .pau-tbl tr{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;background:var(--pau-card);border:1px solid var(--pau-bd-lt);border-radius:10px;padding:8px 10px;margin-bottom:6px;}',
      '  .pau-tbl td{display:inline-flex;align-items:center;gap:4px;border:none;padding:2px 0;white-space:normal;overflow:visible;text-overflow:clip;max-width:100%;font-size:12.5px;}',
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

  function downloadCsv(filename, headers, rows) {
    var lines = [headers.map(function (h) { return '"' + String(h).replace(/"/g, '""') + '"'; }).join(',')];
    rows.forEach(function (r) {
      lines.push(r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','));
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

  // ── 하나의 기관을 클릭할 경우: 팝업 모달이 아니라 별개의 독립 창으로 열기 ──
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
    var shouldSwitchCurrent = forceSameWin || (!attemptedOpen) || (!openedWin);
    if (latestAppHooks && typeof latestAppHooks.openOrganInHistoryTab === 'function') {
      latestAppHooks.openOrganInHistoryTab(cleanAid, shouldSwitchCurrent);
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
    container.innerHTML = '<div class="pau-root"><div role="status" aria-live="polite" style="padding:48px;text-align:center;color:#475569;font-weight:600;">⏳ 공공임단협(중앙 ALIO + 지방 클린아이 + 노동법령 API) 통합 데이터를 불러오는 중입니다...</div></div>';

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

  var DISC_CCODE_LIST = [
    ['ALL', '전체 8대 공시·협약·내부규정 항목'],
    ['21026', '단체협약 (단협 본문·신구대비표·주요개정)'],
    ['21027', '임금협약 (임협 본문·임금인상 합의서)'],
    ['63795', '단체협약 외 별도합의사항 (보충·특별합의)'],
    ['63796', '임금협약 외 별도합의사항 (수당·성과급합의)'],
    ['21028', '노사협의회 의결사항 (분기별 노사협의)'],
    ['63787', '노동조합 운영현황 (타임오프·전임자·가입정보)'],
    ['21025', '교섭창구 단일화 정보 (교섭대표노조 공고)'],
    ['21110', '내부규정 (취업규칙·인사·보수·복리후생규정)']
  ];

  function confedClass(c) {
    var s = String(c || '');
    if (s.indexOf('한국노총') >= 0) return 'fktu';
    if (s.indexOf('민주노총') >= 0) return 'kctu';
    if (s.indexOf('복수') >= 0) return 'multi';
    return '';
  }

  function buildOrganUrl(instOrAid, dno) {
    var aid = typeof instOrAid === 'string' ? instOrAid : ((instOrAid && instOrAid.apba_id) || '');
    if (isLocalOrgan(instOrAid)) {
      return 'https://www.cleaneye.go.kr/user/gongsiCompare/selectGongsiCompare.do';
    }
    if (dno && /^\d{10,}$/.test(String(dno))) {
      return 'https://www.alio.go.kr/item/itemReportTerm.do?reportNo=' + encodeURIComponent(String(dno));
    }
    return 'https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(aid) + '&reportFormRootNo=21020';
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

  function renderApp(container, data, opts) {
    var safeInsts = (data.institutions || []).filter(Boolean);
    var safeUnions = (data.unions || []).filter(Boolean);
    var safeDiscs = (data.disclosures || []).filter(Boolean);
    var safeMetrics = (data.metrics || []).filter(Boolean);
    var safeArticles = (data.articles || []).filter(Boolean);

    var instMap = {};
    safeInsts.forEach(function (i) { instMap[i.apba_id] = i; });
    var unionsByAid = {};
    safeUnions.forEach(function (u) {
      if (!unionsByAid[u.apba_id]) unionsByAid[u.apba_id] = [];
      unionsByAid[u.apba_id].push(u);
    });
    var discByAid = {};
    safeDiscs.forEach(function (d) {
      if (!discByAid[d.aid]) discByAid[d.aid] = [];
      discByAid[d.aid].push(d);
    });

    var allTypes = [];
    var allMinistries = [];
    safeInsts.forEach(function (i) {
      if (worth(i.inst_type) && allTypes.indexOf(i.inst_type) === -1) allTypes.push(i.inst_type);
      if (worth(i.ministry) && allMinistries.indexOf(i.ministry) === -1) allMinistries.push(i.ministry);
    });
    allTypes.sort();
    allMinistries.sort();

    var allConfeds = [];
    safeUnions.forEach(function (u) {
      if (u.union_structure === '노조없음') return;
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
      uScope: 'ALL',
      uType: '',
      uMinistry: '',
      uConfed: '',
      uStruct: '',
      uQuery: '',
      uPage: 0,
      uChecked: {},
      hScope: 'ALL',
      hOrgan: defaultOrganAid,
      hSearch: '',
      hCatFilter: '',
      hVerA: 1,
      hVerB: 0,
      hSimMode: 'ALL',
      hCheckedTl: {},
      hCheckedSim: {},
      mIssue: METRIC_DEFS[1].key,
      mScope: 'ALL',
      mType: '',
      mConfed: '',
      mQuery: '',
      mChecked: {},
      aCat: 'ALL',
      aQuery: '',
      aChecked: {},
      dScope: 'ALL',
      dOrgan: defaultOrganAid,
      dOrganSearch: '',
      dTax: 'ALL',
      dQuery: '',
      dPage: 0,
      dChecked: {},
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
    var activeUnions = safeUnions.filter(function (u) { return u.union_structure !== '노조없음'; });
    var totalUnions = activeUnions.length;
    var totalDisc = safeDiscs.length;
    var totalArt = safeArticles.length;

    container.innerHTML = [
      '<div class="pau-root">',
      '  <div class="pau-hdr">',
      '    <span class="pau-hdr-ico" aria-hidden="true">🤝</span>',
      '    <span class="pau-hdr-tit">공공임단협 — 중앙(ALIO)·지방공공기관·산하단체(클린아이) 임단협 비교시스템</span>',
      '    <div class="pau-hdr-badges">',
      '      <span class="pau-badge ok" data-pau-api-badge>🟢 중앙 ALIO + 지방 클린아이 + 법령 API 실시간 연동</span>',
      '      <span class="pau-badge">전체 ' + fmtNum(totalInst) + '곳 (중앙 ' + fmtNum(centralInstCount) + ' · 지방 ' + fmtNum(localInstCount) + ')</span>',
      '      <span class="pau-badge">단위노조 ' + fmtNum(totalUnions) + '개</span>',
      '      <span class="pau-badge">공시·협약 ' + fmtNum(totalDisc) + '건</span>',
      '      <span class="pau-badge">단협조문 ' + fmtNum(totalArt) + '개</span>',
      '    </div>',
      '    <div class="pau-hdr-r">',
      '      <span id="who" class="pau-who-slot pau-hide-sm"></span>',
      '      <button type="button" class="pau-btn pri" data-pau-csv aria-label="현재 표 엑셀 CSV 받기">📥 CSV 받기</button>',
      '      <a class="pau-btn pau-hide-sm" href="pu-alio-union.html" target="pureun-aliounion" rel="noopener">↗ 별개 창으로 열기</a>',
      '      <a class="pau-btn" href="enter.html">🏠 포털 홈</a>',
      (opts.onClose ? '<button type="button" class="pau-btn" data-pau-close aria-label="닫기">✕ 닫기</button>' : ''),
      '    </div>',
      '  </div>',
      '  <div class="pau-tabs" role="tablist" aria-label="공공임단협 분석 탭">',
      '    <button type="button" role="tab" id="pau-tab-unions" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'unions' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'unions' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'unions' ? ' on' : '') + '" data-tab="unions">📊 1. 전 기관 노조·타임오프 현황</button>',
      '    <button type="button" role="tab" id="pau-tab-organ" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'organ' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'organ' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'organ' ? ' on' : '') + '" data-tab="organ">🏛️ 2. 기관별 연혁·과거임단협·유사기관 비교</button>',
      '    <button type="button" role="tab" id="pau-tab-matrix" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'matrix' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'matrix' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'matrix' ? ' on' : '') + '" data-tab="matrix">⚖️ 3. 13대 핵심 쟁점 기관간 비교·원문 대조</button>',
      '    <button type="button" role="tab" id="pau-tab-articles" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'articles' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'articles' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'articles' ? ' on' : '') + '" data-tab="articles">🔍 4. 단체협약 조문 통합 검색</button>',
      '    <button type="button" role="tab" id="pau-tab-detail" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'detail' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'detail' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'detail' ? ' on' : '') + '" data-tab="detail">📂 5. 기관별 공시·별도합의·내부규정 원문</button>',
      '    <button type="button" role="tab" id="pau-tab-apihub" aria-controls="pau-tabpanel" tabindex="' + (state.tab === 'apihub' ? '0' : '-1') + '" aria-selected="' + (state.tab === 'apihub' ? 'true' : 'false') + '" class="pau-tab' + (state.tab === 'apihub' ? ' on' : '') + '" data-tab="apihub">🔌 6. 공공·법령 API 실시간 연동 센터</button>',
      '  </div>',
      '  <div class="pau-body" id="pau-tabpanel" role="tabpanel" aria-labelledby="pau-tab-' + state.tab + '" data-pau-body></div>',
      '</div>'
    ].join('');

    var bodyEl = container.querySelector('[data-pau-body]');
    var apiBadgeEl = container.querySelector('[data-pau-api-badge]');

    function switchTab(nextTab, focusTabBtn) {
      state.tab = nextTab;
      if (bodyEl) bodyEl.setAttribute('aria-labelledby', 'pau-tab-' + state.tab);
      Array.prototype.forEach.call(container.querySelectorAll('.pau-tab'), function (b) {
        var on = b.getAttribute('data-tab') === state.tab;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.setAttribute('tabindex', on ? '0' : '-1');
        if (on && focusTabBtn && typeof b.focus === 'function') b.focus();
      });
      renderCurrentTab();
    }

    function openOrganInHistoryTab(aid, shouldSwitchHere) {
      if (!aid || !instMap[aid]) return;
      state.hOrgan = aid;
      state.dOrgan = aid;
      state.apiAlioAid = aid;
      state.hVerA = 1;
      state.hVerB = 0;
      state.hCheckedTl = {};
      state.hCheckedSim = {};
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
        if (apiBadgeEl) apiBadgeEl.textContent = '🟢 중앙 ALIO + 지방 클린아이 + 법령 API 실시간 연동';
        if (state.tab === 'apihub') renderTabApiHub();
        return;
      }
      discoverPortalApiKeys(reqUid, function (res) {
        if (myGen !== authLookupGen || getActiveUid() !== reqUid || (res && res.stale)) return;
        state.apiDataKey = (res && res.dataKey) ? res.dataKey : '';
        state.apiKeySource = (res && res.source) ? res.source : '미설정 (탭 6에서 등록 가능)';
        state.apiHolidays = (res && res.holidays) ? res.holidays : [];
        if (apiBadgeEl) {
          apiBadgeEl.textContent = state.apiDataKey
            ? '🟢 중앙 ALIO + 지방 클린아이 + 법령 API (' + state.apiKeySource + ')'
            : '🟢 중앙 ALIO + 지방 클린아이 + 법령 API 실시간 연동';
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

    function filterUnions() {
      var q = state.uQuery.trim().toLowerCase();
      return activeUnions.filter(function (u) {
        var inst = instMap[u.apba_id] || u;
        if (!matchOrganScope(inst, state.uScope)) return false;
        if (state.uType && u.inst_type !== state.uType) return false;
        if (state.uMinistry && u.ministry !== state.uMinistry) return false;
        var cf = worth(u.confederation) ? u.confederation : '미가입';
        if (state.uConfed && cf !== state.uConfed) return false;
        if (state.uStruct === 'multi' && String(u.union_structure || '').indexOf('복수') === -1) return false;
        if (state.uStruct === 'single' && String(u.union_structure || '').indexOf('단일') === -1) return false;
        if (state.uStruct === 'rep' && String(u.bargaining_right || '').indexOf('대표') === -1) return false;
        if (q) {
          var hay = ((u.inst_name || '') + ' ' + (u.union_name || '') + ' ' + (u.ministry || '') + ' ' + (u.federation || '') + ' ' + (u.inst_type || '')).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    // ── 탭 1: 중앙·지방 전 기관 노조·타임오프 현황 ──
    function renderTabUnions() {
      var rows = filterUnions();
      var uniqOrgans = {};
      var totalMembers = 0;
      var timeoffSum = 0;
      var timeoffCnt = 0;
      rows.forEach(function (r) {
        uniqOrgans[r.apba_id] = 1;
        totalMembers += Number(r.member_total || 0);
        if (Number(r.timeoff_hours || 0) > 0) {
          timeoffSum += Number(r.timeoff_hours || 0);
          timeoffCnt += 1;
        }
      });
      var avgTimeoff = timeoffCnt ? Math.round(timeoffSum / timeoffCnt) : 0;
      var checkedKeys = Object.keys(state.uChecked).filter(function (k) { return state.uChecked[k]; });
      var pageSize = 400;
      var totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      if (state.uPage >= totalPages) state.uPage = totalPages - 1;
      if (state.uPage < 0) state.uPage = 0;
      var startIdx = state.uPage * pageSize;
      var visibleRows = rows.slice(startIdx, startIdx + pageSize);

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select data-f="uScope" aria-label="중앙·지방 구분" title="중앙·지방 구분">',
        '    <option value="ALL"' + (state.uScope === 'ALL' ? ' selected' : '') + '>전체 기관 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.uScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙공공기관 (ALIO 355곳)</option>',
        '    <option value="LOCAL_ALL"' + (state.uScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방공공기관·산하단체 전체 (클린아이 1,332곳)</option>',
        '    <option value="LOCAL_CORP"' + (state.uScope === 'LOCAL_CORP' ? ' selected' : '') + '>🚇 지방공사·지방공단</option>',
        '    <option value="LOCAL_AFFIL"' + (state.uScope === 'LOCAL_AFFIL' ? ' selected' : '') + '>🏢 지방출자·출연기관 (산하단체)</option>',
        '    <option value="LOCAL_DIRECT"' + (state.uScope === 'LOCAL_DIRECT' ? ' selected' : '') + '>💧 지방직영기업 (상·하수도/공영개발)</option>',
        '  </select>',
        '  <select data-f="uType" aria-label="기관유형 선택" title="기관유형">',
        '    <option value="">기관유형 전체</option>',
        allTypes.map(function (t) { return '<option value="' + esc(t) + '"' + (state.uType === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''),
        '  </select>',
        '  <select data-f="uMinistry" aria-label="소관부처·지자체 선택" title="소관부처·시도 지자체">',
        '    <option value="">부처·지자체 전체</option>',
        allMinistries.map(function (m) { return '<option value="' + esc(m) + '"' + (state.uMinistry === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join(''),
        '  </select>',
        '  <select data-f="uConfed" aria-label="상급단체 선택" title="상급단체(총연맹)">',
        '    <option value="">상급단체 전체</option>',
        allConfeds.map(function (c) { return '<option value="' + esc(c) + '"' + (state.uConfed === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join(''),
        '  </select>',
        '  <select data-f="uStruct" aria-label="노조 형태 선택" title="노조 형태">',
        '    <option value="">노조형태 전체</option>',
        '    <option value="single"' + (state.uStruct === 'single' ? ' selected' : '') + '>단일노조 기관</option>',
        '    <option value="multi"' + (state.uStruct === 'multi' ? ' selected' : '') + '>복수노조 기관</option>',
        '    <option value="rep"' + (state.uStruct === 'rep' ? ' selected' : '') + '>교섭대표노조만</option>',
        '  </select>',
        '  <input type="search" data-f="uQuery" aria-label="기관명·노동조합명 검색" placeholder="기관명·노동조합명·부처·지자체 검색..." value="' + esc(state.uQuery) + '">',
        '  <span class="pau-flt-hint" style="font-size:11.5px;color:var(--pau-pri);font-weight:700;">💡 기관명을 클릭하면 별개의 독립 창으로 연혁·과거임단협·유사기관 비교 창이 열립니다</span>',
        '</div>',
        '<div class="pau-kpis">',
        '  <div class="pau-kpi"><span>조회 기관 수</span><b>' + fmtNum(Object.keys(uniqOrgans).length) + '곳</b></div>',
        '  <div class="pau-kpi"><span>조회 단위노조</span><b>' + fmtNum(rows.length) + '개</b></div>',
        '  <div class="pau-kpi"><span>총 조합원 합계</span><b>' + fmtNum(totalMembers) + '명</b></div>',
        '  <div class="pau-kpi"><span>평균 타임오프</span><b>' + fmtNum(avgTimeoff) + '시간</b></div>',
        '</div>',
        '<div class="pau-bulk' + (checkedKeys.length ? ' on' : '') + '">',
        '  <span>선택 <b>' + checkedKeys.length + '</b>건</span>',
        '  <button type="button" class="pau-act-btn pri" data-u-open-sel>↗ 선택 기관 별개 창으로 열기</button>',
        '  <button type="button" class="pau-act-btn" data-u-export-sel>📥 선택 항목 CSV 내보내기</button>',
        '  <button type="button" class="pau-act-btn" data-u-clear-sel>선택 해제</button>',
        '</div>',
        (rows.length > pageSize ? [
          '<div class="pau-pager">',
          '  <span>전체 <b>' + fmtNum(rows.length) + '</b>건 중 <b>' + fmtNum(startIdx + 1) + '~' + fmtNum(startIdx + visibleRows.length) + '</b>번째 표시 (페이지 ' + (state.uPage + 1) + '/' + totalPages + ')</span>',
          '  <div style="display:flex;gap:6px;">',
          '    <button type="button" class="pau-act-btn" data-u-prev' + (state.uPage <= 0 ? ' disabled' : '') + '>◀ 이전 ' + pageSize + '건</button>',
          '    <button type="button" class="pau-act-btn" data-u-next' + (state.uPage + 1 >= totalPages ? ' disabled' : '') + '>다음 ' + pageSize + '건 ▶</button>',
          '  </div>',
          '</div>'
        ].join('') : ''),
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-u-ckall aria-label="현재 페이지 전체 선택" title="현재 표시 목록 전체 선택"></label></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:18%;">기관명 · 소관부처/지자체 (클릭→별개 창)</th>',
        '        <th style="width:13%;">구분 · 기관유형</th>',
        '        <th style="width:16%;">노동조합명 · 교섭권</th>',
        '        <th style="width:12%;">상급단체 (총연맹·연맹)</th>',
        '        <th style="width:6%;">가입대상</th>',
        '        <th style="width:6%;">조합원</th>',
        '        <th style="width:10%;">타임오프 (시간·명)</th>',
        '        <th style="width:9%;">설립일 · 임기</th>',
        '        <th style="width:10%;">공시원문 · 가입범위</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody>',
        visibleRows.map(function (r, idx) {
          var absIdx = startIdx + idx;
          var rowKey = r.apba_id + '_' + absIdx;
          var checked = !!state.uChecked[rowKey];
          var isLoc = isLocalOrgan(r);
          var isMulti = String(r.union_structure || '').indexOf('복수') >= 0;
          var isRep = String(r.bargaining_right || '').indexOf('대표') >= 0;
          var organFull = (r.inst_name || '') + (r.ministry ? ' (' + r.ministry + ')' : '');
          var typeFull = (isLoc ? '지방 · ' : '중앙 · ') + (isMulti ? '복수 · ' : '') + (r.inst_type || '');
          var unionFull = (isRep ? '(대표) ' : '') + (r.union_name || '');
          var confFull = (r.confederation || '미가입') + (worth(r.federation) ? ' · ' + r.federation : '');
          var toFull = (Number(r.timeoff_hours || 0) ? fmtNum(r.timeoff_hours) + 'h' : '—') +
            ((Number(r.timeoff_fulltime || 0) || Number(r.timeoff_parttime || 0)) ? ' · 풀' + (r.timeoff_fulltime || 0) + '·파트' + (r.timeoff_parttime || 0) : '');
          var estFull = (r.established_date || '—') + (worth(r.chair_term) ? ' · ' + r.chair_term : '');
          var scopeTxt = String(r.scope || '').replace(/\s+/g, ' ').trim();
          var safeUnionUrl = safeHttpUrl(buildOrganUrl(r, r.disclosure_no));
          var srcLabel = isLoc ? '클린아이' : 'ALIO원문';
          return [
            '<tr>',
            '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-u-ck="' + esc(rowKey) + '" aria-label="' + esc((r.inst_name || '') + ' ' + (r.union_name || '') + ' 선택') + '"' + (checked ? ' checked' : '') + '></label></td>',
            '  <td class="c-no">' + (absIdx + 1) + '</td>',
            '  <td title="' + esc(organFull) + ' (클릭하면 별개의 창으로 열기)"><a href="pu-alio-union.html?organ=' + encodeURIComponent(r.apba_id) + '" data-jump-organ="' + esc(r.apba_id) + '" style="color:var(--pau-pri);font-weight:700;text-decoration:none;">↗ ' + esc(organFull) + '</a></td>',
            '  <td title="' + esc(typeFull) + '"><span class="pau-pill ' + (isLoc ? 'loc' : '') + '">' + (isLoc ? '지방' : '중앙') + '</span> ' + esc((isMulti ? '복수 · ' : '') + (r.inst_type || '')) + '</td>',
            '  <td title="' + esc(unionFull) + '" style="font-weight:600;">' + (isRep ? '<span class="pau-pill fktu">대표</span> ' : '') + esc(r.union_name || '') + '</td>',
            '  <td title="' + esc(confFull) + '"><span class="pau-pill ' + confedClass(r.confederation) + '">' + esc(r.confederation || '미가입') + '</span> ' + esc(r.federation || '') + '</td>',
            '  <td class="c-num" title="가입대상 ' + fmtNum(r.eligible_count) + '명">' + fmtNum(r.eligible_count) + '</td>',
            '  <td class="c-num" title="조합원 ' + fmtNum(r.member_total) + '명" style="font-weight:700;">' + fmtNum(r.member_total) + '</td>',
            '  <td class="c-num" title="' + esc(toFull) + '">' + esc(toFull) + '</td>',
            '  <td title="' + esc(estFull) + '">' + esc(estFull) + '</td>',
            '  <td title="' + esc(scopeTxt || (srcLabel + ' 공시 바로가기')) + '">' +
              (safeUnionUrl ? '<a class="pau-pill ok" href="' + esc(safeUnionUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 ' + srcLabel + '</a> ' : '') +
              esc(scopeTxt || '—') + '</td>',
            '</tr>'
          ].join('');
        }).join(''),
        '    </tbody>',
        '  </table>',
        '</div>'
      ].join('');

      bindFilterInputs(renderTabUnions);
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

      var ckAll = bodyEl.querySelector('[data-u-ckall]');
      if (ckAll) {
        ckAll.addEventListener('change', function () {
          visibleRows.forEach(function (r, i) { state.uChecked[r.apba_id + '_' + (startIdx + i)] = ckAll.checked; });
          renderTabUnions();
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-u-ck]'), function (ck) {
        ck.addEventListener('change', function () {
          state.uChecked[ck.getAttribute('data-u-ck')] = ck.checked;
          renderTabUnions();
        });
      });
      var openSelBtn = bodyEl.querySelector('[data-u-open-sel]');
      if (openSelBtn) {
        openSelBtn.addEventListener('click', function () {
          var firstAid = '';
          rows.forEach(function (r, i) {
            if (!firstAid && state.uChecked[r.apba_id + '_' + i]) firstAid = r.apba_id;
          });
          if (firstAid) openOrganWindow(firstAid, false);
        });
      }
      var clearBtn = bodyEl.querySelector('[data-u-clear-sel]');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () { state.uChecked = {}; renderTabUnions(); });
      }
      var expSel = bodyEl.querySelector('[data-u-export-sel]');
      if (expSel) {
        expSel.addEventListener('click', function () {
          var sel = rows.filter(function (r, i) { return state.uChecked[r.apba_id + '_' + i]; });
          exportUnionsCsv(sel);
        });
      }
    }

    // ── 탭 2: 하나의 기관 클릭 시 열리는 [기관별 연혁 · 과거임단협 비교 · 유사기관 비교] ──
    function renderTabOrganHistory() {
      var aid = state.hOrgan || defaultOrganAid;
      var inst = instMap[aid] || safeInsts[0] || { apba_id: aid, name: aid };
      aid = inst.apba_id;
      state.hOrgan = aid;

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

      var organUnions = (unionsByAid[aid] || []).filter(function (u) { return u && u.union_structure !== '노조없음'; });
      var timelineAll = buildOrganTimeline(data, aid);
      var timeline = timelineAll.filter(function (t) {
        if (!state.hCatFilter) return true;
        return t.catGroup === state.hCatFilter;
      });

      // 과거A vs 현행B 비교 후보: 단체협약·임금협약(AGREEMENT) 우선, 부족할 경우 별도합의/내부규정/노조현황 순으로 보충
      var onlyAgreements = timelineAll.filter(function (t) { return t.catGroup === 'AGREEMENT'; });
      var agreementsForCompare = onlyAgreements.length >= 2
        ? onlyAgreements
        : timelineAll.filter(function (t) {
            return t.catGroup === 'AGREEMENT' || t.catGroup === 'SEPARATE' || t.catGroup === 'RULE' || t.catGroup === 'STATUS';
          });
      if (agreementsForCompare.length < 2) agreementsForCompare = timelineAll.slice();

      // timelineAll 및 agreementsForCompare는 최신순(index 0 = 가장 최근/현행, index 1 = 직전/과거)
      var idxB = Math.min(Math.max(0, Number(state.hVerB != null ? state.hVerB : 0)), Math.max(0, agreementsForCompare.length - 1));
      var idxA = Math.min(Math.max(0, Number(state.hVerA != null ? state.hVerA : 1)), Math.max(0, agreementsForCompare.length - 1));
      if (idxA === idxB && agreementsForCompare.length >= 2) {
        idxB = 0; // 현행 B = 최신
        idxA = 1; // 과거 A = 이전
      }
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

      var baseMetrics = extractOrganMetrics(safeMetrics, aid);
      var similars = findSimilarOrgans(data, aid, state.hSimMode || 'ALL');
      var topPeersForMatrix = similars.slice(0, 4);
      var isLoc = isLocalOrgan(inst);
      var safeUnionUrl = safeHttpUrl(buildOrganUrl(inst));
      var safeRuleUrl = isLoc ? safeUnionUrl : safeHttpUrl('https://www.alio.go.kr/item/itemOrganList.do?apbaId=' + encodeURIComponent(aid) + '&reportFormRootNo=21110');
      var sectorInfo = detectSectorGroup(inst);

      var totalMembers = 0;
      var totalTimeoff = 0;
      organUnions.forEach(function (u) {
        totalMembers += Number(u.member_total || 0);
        totalTimeoff += Number(u.timeoff_hours || 0);
      });

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select data-f="hScope" aria-label="기관 검색 범위" title="기관 검색 범위">',
        '    <option value="ALL"' + (state.hScope === 'ALL' ? ' selected' : '') + '>전체 기관 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.hScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙공공기관 (ALIO)</option>',
        '    <option value="LOCAL_ALL"' + (state.hScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방공공기관·산하단체 (클린아이)</option>',
        '    <option value="LOCAL_CORP"' + (state.hScope === 'LOCAL_CORP' ? ' selected' : '') + '>🚇 지방공사·지방공단</option>',
        '    <option value="LOCAL_AFFIL"' + (state.hScope === 'LOCAL_AFFIL' ? ' selected' : '') + '>🏢 지방출자·출연기관 (산하단체)</option>',
        '  </select>',
        '  <input type="search" data-f="hSearch" aria-label="분석할 기관명 검색" placeholder="분석할 기관명·시도·부처 빠른 필터..." value="' + esc(state.hSearch) + '" style="max-width:220px;">',
        '  <select data-f="hOrgan" aria-label="분석 대상 기관 선택" title="분석 대상 기관 선택 (' + fmtNum(candidateOrgans.length) + '곳)" style="min-width:260px;font-weight:700;">',
        candidateOrgans.map(function (o) {
          var tag = isLocalOrgan(o) ? '(지방) ' : '(중앙) ';
          return '<option value="' + esc(o.apba_id) + '"' + (o.apba_id === aid ? ' selected' : '') + '>' + esc(tag + o.name + ' · ' + (o.ministry || o.inst_type || o.apba_id)) + '</option>';
        }).join(''),
        '  </select>',
        '  <button type="button" class="pau-act-btn pri" data-h-open-win="' + esc(aid) + '">↗ 이 기관을 별개 창으로 열기</button>',
        (safeUnionUrl ? '<a class="pau-act-btn" href="' + esc(safeUnionUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 ' + (isLoc ? '클린아이 공시 원문' : 'ALIO 노조공시 원문') + '</a>' : ''),
        (safeRuleUrl ? '<a class="pau-act-btn" href="' + esc(safeRuleUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📘 내부규정·협약 원문</a>' : ''),
        '</div>',

        '<div class="pau-kpis">',
        '  <div class="pau-kpi"><span>대상 기관 · 분류</span><b title="' + esc(inst.name + ' · ' + (inst.ministry || '') + ' · ' + (inst.inst_type || '')) + '">' + esc(inst.name) + '</b></div>',
        '  <div class="pau-kpi"><span>단위노조 · 조합원</span><b>' + fmtNum(organUnions.length) + '개 노조 · ' + fmtNum(totalMembers) + '명</b></div>',
        '  <div class="pau-kpi"><span>연혁 공시·임단협 누적</span><b>' + fmtNum(timelineAll.length) + '건 (과거~현행)</b></div>',
        '  <div class="pau-kpi"><span>유사 비교기관 추천</span><b>' + fmtNum(similars.length) + '곳 (' + esc(sectorInfo.label) + ')</b></div>',
        '</div>',

        // ── 섹션 1: 기관의 연혁에 따른 노동조합 · 임단협 · 내부규정 타임라인 ──
        '<div class="pau-sec-card">',
        '  <div class="pau-sec-tit">',
        '    <span>📅 ① ' + esc(inst.name) + ' — 기관 연혁에 따른 노동조합 설립 · 임단협 체결 · 내부규정 개정 타임라인 (' + fmtNum(timeline.length) + '건)</span>',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      <select data-f="hCatFilter" aria-label="연혁 구분 필터" title="연혁 구분 필터">',
        '        <option value=""' + (!state.hCatFilter ? ' selected' : '') + '>연혁 구분 전체 (' + timelineAll.length + '건)</option>',
        '        <option value="AGREEMENT"' + (state.hCatFilter === 'AGREEMENT' ? ' selected' : '') + '>단체협약·임금협약 체결 연혁</option>',
        '        <option value="SEPARATE"' + (state.hCatFilter === 'SEPARATE' ? ' selected' : '') + '>별도합의·보충협약·노사협의회</option>',
        '        <option value="STATUS"' + (state.hCatFilter === 'STATUS' ? ' selected' : '') + '>노조설립·연도별 노조현황·타임오프</option>',
        '        <option value="RULE"' + (state.hCatFilter === 'RULE' ? ' selected' : '') + '>취업규칙·보수·복리후생 내부규정 연혁</option>',
        '      </select>',
        '    </div>',
        '  </div>',
        '  <div class="pau-tbl-wrap" style="max-height:310px;">',
        '    <table class="pau-tbl">',
        '      <thead>',
        '        <tr>',
        '          <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-htl-ckall aria-label="타임라인 전체 선택" title="전체 선택"></label></th>',
        '          <th class="c-no">№</th>',
        '          <th style="width:12%;">연혁 일자 (연도)</th>',
        '          <th style="width:14%;">연혁 분류 · 공시항목</th>',
        '          <th style="width:25%;">임단협·공시·규정 제목</th>',
        '          <th style="width:28%;">주요 연혁 내용 · 체결사항 요약</th>',
        '          <th style="width:11%;">비교 선택 (과거↔현행)</th>',
        '          <th style="width:10%;">원문 · 첨부파일</th>',
        '        </tr>',
        '      </thead>',
        '      <tbody>',
        timeline.map(function (t, i) {
          var ck = !!state.hCheckedTl[t.id];
          var cmpIdx = agreementsForCompare.findIndex(function (x) { return x.id === t.id; });
          var isA = verA && verA.id === t.id;
          var isB = verB && verB.id === t.id;
          var safeView = safeHttpUrl(buildOrganUrl(inst, t.dno));
          var firstFile = (t.files && t.files[0]) ? t.files[0] : null;
          var safeFile = firstFile ? safeHttpUrl(firstFile.url || firstFile.download_url || '') : '';
          return [
            '<tr' + ((isA || isB) ? ' style="background:var(--pau-pri-bg);"' : '') + '>',
            '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-htl-ck="' + esc(t.id) + '" aria-label="' + esc(t.title + ' 선택') + '"' + (ck ? ' checked' : '') + '></label></td>',
            '  <td class="c-no">' + (i + 1) + '</td>',
            '  <td title="' + esc(t.date + ' (' + t.year + ')') + '" style="font-weight:700;"><span class="pau-pill">' + esc(t.year) + '</span> ' + esc(t.date) + '</td>',
            '  <td title="' + esc(t.cname) + '"><span class="pau-pill ' + (t.catGroup === 'AGREEMENT' ? 'fktu' : (t.catGroup === 'SEPARATE' ? 'multi' : 'ok')) + '">' + esc(t.cname) + '</span></td>',
            '  <td title="' + esc(t.title) + '" style="font-weight:700;">' + esc(t.title) + '</td>',
            '  <td title="' + esc(t.summary) + '">' + esc(t.summary || '—') + '</td>',
            '  <td><div class="pau-line">',
            (cmpIdx >= 0 ? '<button type="button" class="pau-act-btn' + (isA ? ' pri' : '') + '" data-set-vera="' + cmpIdx + '" aria-label="과거A 시점으로 선택">과거A' + (isA ? '✓' : '') + '</button>' : ''),
            (cmpIdx >= 0 ? '<button type="button" class="pau-act-btn' + (isB ? ' pri' : '') + '" data-set-verb="' + cmpIdx + '" aria-label="현행B 시점으로 선택">현행B' + (isB ? '✓' : '') + '</button>' : ''),
            '  </div></td>',
            '  <td>',
            (safeFile ? '<a class="pau-pill fktu" href="' + esc(safeFile) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📎 첨부원문</a> ' : ''),
            (safeView ? '<a class="pau-pill ok" href="' + esc(safeView) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시원문</a>' : ''),
            (!safeFile && !safeView ? '—' : ''),
            '  </td>',
            '</tr>'
          ].join('');
        }).join(''),
        '      </tbody>',
        '    </table>',
        '  </div>',
        '</div>',

        // ── 섹션 2: 과거 임단협 vs 현행 임단협 비교 (과거A ↔ 현행B + 신·구 조문 대비표) ──
        '<div class="pau-sec-card">',
        '  <div class="pau-sec-tit">',
        '    <span>🔄 ② ' + esc(inst.name) + ' — 과거 임단협(A) vs 현행 임단협(B) 비교 및 신·구 조문 대비표</span>',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      <label style="font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">과거 임단협(A):',
        '        <select data-f="hVerA" aria-label="과거 임단협 시점 A 선택" style="max-width:250px;">',
        agreementsForCompare.map(function (a, idx) {
          return '<option value="' + idx + '"' + (idx === idxA ? ' selected' : '') + '>' + esc('(' + a.date + ') ' + a.title) + '</option>';
        }).join(''),
        '        </select>',
        '      </label>',
        '      <label style="font-size:12px;color:var(--pau-pri);font-weight:800;display:inline-flex;align-items:center;gap:4px;">↔ 현행 임단협(B):',
        '        <select data-f="hVerB" aria-label="현행 임단협 시점 B 선택" style="max-width:250px;">',
        agreementsForCompare.map(function (b, idx) {
          return '<option value="' + idx + '"' + (idx === idxB ? ' selected' : '') + '>' + esc('(' + b.date + ') ' + b.title) + '</option>';
        }).join(''),
        '        </select>',
        '      </label>',
        '    </div>',
        '  </div>',

        (verA && verB ? [
          '  <div class="pau-tbl-wrap" style="max-height:260px;margin-bottom:10px;">',
          '    <table class="pau-tbl">',
          '      <thead>',
          '        <tr>',
          '          <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="비교표 행 선택" disabled></label></th>',
          '          <th class="c-no">№</th>',
          '          <th style="width:16%;">비교 항목</th>',
          '          <th style="width:42%;">⏪ 과거 임단협·공시 (시점 A: ' + esc(verA.date) + ')</th>',
          '          <th style="width:42%;">⏩ 현행 임단협·공시 (시점 B: ' + esc(verB.date) + ')</th>',
          '        </tr>',
          '      </thead>',
          '      <tbody>',
          '        <tr><td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="항목 1" disabled></label></td><td class="c-no">1</td><td style="font-weight:700;">협약·공시 명칭</td><td title="' + esc(verA.title) + '">' + esc(verA.title) + '</td><td title="' + esc(verB.title) + '" style="font-weight:700;color:var(--pau-pri);">' + esc(verB.title) + '</td></tr>',
          '        <tr><td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="항목 2" disabled></label></td><td class="c-no">2</td><td style="font-weight:700;">체결·공시 기준일</td><td>' + esc(verA.date + ' (' + verA.cname + ')') + '</td><td style="font-weight:700;">' + esc(verB.date + ' (' + verB.cname + ')') + '</td></tr>',
          '        <tr><td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="항목 3" disabled></label></td><td class="c-no">3</td><td style="font-weight:700;">주요 체결·개정 요약</td><td title="' + esc(verA.summary) + '">' + esc(verA.summary || '—') + '</td><td title="' + esc(verB.summary) + '" style="font-weight:600;">' + esc(verB.summary || '—') + '</td></tr>',
          '        <tr><td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="항목 4" disabled></label></td><td class="c-no">4</td><td style="font-weight:700;">핵심 조문 신·구 대비</td><td title="' + esc(matchedDiffPreviewA) + '">' + esc(matchedDiffPreviewA) + '</td><td title="' + esc(matchedDiffPreviewB) + '" style="font-weight:600;color:var(--pau-pri);">' + esc(matchedDiffPreviewB) + '</td></tr>',
          '        <tr><td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="항목 5" disabled></label></td><td class="c-no">5</td><td style="font-weight:700;">원문 파일 · 뷰어</td><td>' +
            ((verA.files && verA.files[0] && safeHttpUrl(verA.files[0].url)) ? '<a class="pau-pill fktu" href="' + esc(safeHttpUrl(verA.files[0].url)) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📎 ' + esc(verA.files[0].name || '과거A 원문') + '</a> ' : '') +
            (safeHttpUrl(buildOrganUrl(inst, verA.dno)) ? '<a class="pau-pill ok" href="' + esc(safeHttpUrl(buildOrganUrl(inst, verA.dno))) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시원문</a>' : '—') +
            '</td><td>' +
            ((verB.files && verB.files[0] && safeHttpUrl(verB.files[0].url)) ? '<a class="pau-pill fktu" href="' + esc(safeHttpUrl(verB.files[0].url)) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📎 ' + esc(verB.files[0].name || '현행B 원문') + '</a> ' : '') +
            (safeHttpUrl(buildOrganUrl(inst, verB.dno)) ? '<a class="pau-pill ok" href="' + esc(safeHttpUrl(buildOrganUrl(inst, verB.dno))) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시원문</a>' : '—') +
            '</td></tr>',
          '      </tbody>',
          '    </table>',
          '  </div>'
        ].join('') : ''),

        (revList.length ? revList.map(function (rev, rIdx) {
          var isSelectedMatch = isRevMatchVersion(rev, verA) || isRevMatchVersion(rev, verB);
          return [
            '  <div style="font-size:12.5px;font-weight:700;color:var(--pau-pri);margin:8px 0 4px;">📌 ' + (isSelectedMatch ? '⭐ 선택 시점 연동 ' : '') + '신·구 조문 대비표 #' + (rIdx + 1) + ' — ' + esc(rev.title) + ' (기준일: ' + esc(rev.date) + ' · 조문비교 ' + fmtNum(rev.diffs.length) + '건)</div>',
            (rev.summaryLines.length ? [
              '  <div style="background:var(--pau-bg);border:1px solid var(--pau-bd-lt);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:var(--pau-sub);line-height:1.55;">',
              '    <b>주요 개정 요약:</b> ' + rev.summaryLines.slice(0, 6).map(function (s) { return esc(s); }).join(' · '),
              '  </div>'
            ].join('') : ''),
            (rev.diffs.length ? [
              '  <div class="pau-tbl-wrap" style="max-height:260px;margin-bottom:8px;">',
              '    <table class="pau-tbl">',
              '      <thead>',
              '        <tr>',
              '          <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="신구대비표 전체" disabled></label></th>',
              '          <th class="c-no">№</th>',
              '          <th style="width:16%;">개정 조문 · 항목</th>',
              '          <th style="width:36%;">⏪ 과거 임단협 (개정 전 구 조문)</th>',
              '          <th style="width:36%;">⏩ 현행 임단협 (개정 후 신 조문)</th>',
              '          <th style="width:12%;">개정 구분 · 비고</th>',
              '        </tr>',
              '      </thead>',
              '      <tbody>',
              rev.diffs.map(function (d, idx) {
                return [
                  '<tr>',
                  '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="조문 ' + (idx + 1) + '" disabled></label></td>',
                  '  <td class="c-no">' + (idx + 1) + '</td>',
                  '  <td title="' + esc(d.art) + '" style="font-weight:700;">' + esc(d.art) + '</td>',
                  '  <td title="' + esc(d.before) + '">' + esc(d.before) + '</td>',
                  '  <td title="' + esc(d.after) + '" style="color:var(--pau-pri);font-weight:600;">' + esc(d.after) + '</td>',
                  '  <td title="' + esc(d.note) + '">' + esc(d.note) + '</td>',
                  '</tr>'
                ].join('');
              }).join(''),
              '      </tbody>',
              '    </table>',
              '  </div>'
            ].join('') : '')
          ].join('');
        }).join('') : '<div style="font-size:12px;color:#475569;padding:4px 2px;">💡 상단 타임라인 표에서 과거A와 현행B 버튼을 눌러 연도별 임단협·노조현황·내부규정 버전을 자유롭게 대조할 수 있습니다.</div>'),
        '</div>',

        // ── 섹션 3: 유사한 기관별(중앙+지방+산하단체) 임단협 검토 및 비교 ──
        '<div class="pau-sec-card">',
        '  <div class="pau-sec-tit">',
        '    <span>🏛️ ③ ' + esc(inst.name) + ' — 유사 공공기관·지방공공기관·산하단체 임단협 검토 및 비교 (' + fmtNum(similars.length) + '곳)</span>',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        '      <select data-f="hSimMode" aria-label="유사기관 추천 기준 선택" title="유사기관 추천 기준">',
        '        <option value="ALL"' + (state.hSimMode === 'ALL' ? ' selected' : '') + '>유사 기준: 종합 추천 (업종+부처/지자체+유형+노조규모)</option>',
        '        <option value="SECTOR"' + (state.hSimMode === 'SECTOR' ? ' selected' : '') + '>동종 업종·기능 기관만 (' + esc(sectorInfo.label) + ' 중앙+지방 교차비교)</option>',
        '        <option value="MINISTRY"' + (state.hSimMode === 'MINISTRY' ? ' selected' : '') + '>동일 소관부처 · 동일 시/도 지자체 산하단체 (' + esc(inst.ministry || '') + ')</option>',
        '        <option value="TYPE"' + (state.hSimMode === 'TYPE' ? ' selected' : '') + '>동일·유사 기관유형 (' + esc(inst.inst_type || '') + ')</option>',
        '      </select>',
        '    </div>',
        '  </div>',

        '  <div class="pau-tbl-wrap" style="max-height:310px;margin-bottom:12px;">',
        '    <table class="pau-tbl">',
        '      <thead>',
        '        <tr>',
        '          <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-hsim-ckall aria-label="유사기관 전체 선택" title="유사기관 전체 선택"></label></th>',
        '          <th class="c-no">№</th>',
        '          <th style="width:18%;">기관명 · 부처/지자체 (클릭→별개 창)</th>',
        '          <th style="width:13%;">구분 · 기관유형</th>',
        '          <th style="width:16%;">대표노조 · 상급단체</th>',
        '          <th style="width:8%;">조합원 수</th>',
        '          <th style="width:9%;">타임오프</th>',
        '          <th style="width:18%;">최근 단체협약 · 임금협약 · 원문</th>',
        '          <th style="width:18%;">유사 선정 사유 · 유사도</th>',
        '        </tr>',
        '      </thead>',
        '      <tbody>',
        (function () {
          var repU = organUnions.find(function (u) { return String(u.bargaining_right || '').indexOf('대표') >= 0; }) || organUnions[0] || {};
          var latestAg = timelineAll.find(function (t) { return t.catGroup === 'AGREEMENT'; }) || timelineAll[0] || null;
          return [
            '<tr style="background:var(--pau-pri-bg);font-weight:700;">',
            '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="기준 기관" checked disabled></label></td>',
            '  <td class="c-no">0</td>',
            '  <td title="기준 기관: ' + esc(inst.name) + '"><span class="pau-pill fktu">기준</span> ' + esc(inst.name + ' (' + (inst.ministry || '') + ')') + '</td>',
            '  <td><span class="pau-pill ' + (isLoc ? 'loc' : '') + '">' + (isLoc ? '지방' : '중앙') + '</span> ' + esc(inst.inst_type || '') + '</td>',
            '  <td title="' + esc((repU.union_name || '—') + ' · ' + (repU.confederation || '')) + '"><span class="pau-pill ' + confedClass(repU.confederation) + '">' + esc(repU.confederation || '—') + '</span> ' + esc(repU.union_name || '—') + '</td>',
            '  <td class="c-num">' + fmtNum(totalMembers) + '명</td>',
            '  <td class="c-num">' + (totalTimeoff ? fmtNum(totalTimeoff) + 'h' : '—') + '</td>',
            '  <td title="' + esc(latestAg ? (latestAg.date + ' ' + latestAg.title) : '') + '">' + esc(latestAg ? (latestAg.date + ' · ' + latestAg.title) : '—') + '</td>',
            '  <td><span class="pau-pill ok">현재 분석 대상 기관</span></td>',
            '</tr>'
          ].join('');
        })(),
        similars.map(function (sim, idx) {
          var sLoc = sim.portal_source === 'CLEANEYE' || isLocalOrgan(sim.apba_id);
          var sRep = (sim.unions || [])[0] || {};
          var sLatest = sim.latestCa || sim.latestWage || null;
          var sFileUrl = (sLatest && sLatest.files && sLatest.files[0]) ? safeHttpUrl(sLatest.files[0].url) : '';
          var sSafeUrl = sFileUrl || safeHttpUrl(buildOrganUrl(sim, sLatest && sLatest.dno));
          var ck = !!state.hCheckedSim[sim.apba_id];
          var latestTxt = sLatest ? ((sLatest.edate || sLatest.rdate || '') + ' · ' + (sLatest.title || sLatest.cname || '')) : ('공시 ' + fmtNum(sim.discCount) + '건');
          var simOrgFull = sim.name + (sim.ministry ? ' (' + sim.ministry + ')' : '');
          return [
            '<tr>',
            '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-hsim-ck="' + esc(sim.apba_id) + '" aria-label="' + esc(sim.name + ' 선택') + '"' + (ck ? ' checked' : '') + '></label></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(simOrgFull) + ' (클릭→별개 창)"><a href="pu-alio-union.html?organ=' + encodeURIComponent(sim.apba_id) + '" data-jump-organ="' + esc(sim.apba_id) + '" style="color:var(--pau-pri);font-weight:700;text-decoration:none;">↗ ' + esc(simOrgFull) + '</a></td>',
            '  <td title="' + esc(sim.inst_type || '') + '"><span class="pau-pill ' + (sLoc ? 'loc' : '') + '">' + (sLoc ? '지방' : '중앙') + '</span> ' + esc(sim.inst_type || '') + '</td>',
            '  <td title="' + esc((sRep.union_name || '—') + ' · ' + (sRep.confederation || '')) + '"><span class="pau-pill ' + confedClass(sRep.confederation) + '">' + esc(sRep.confederation || '미가입') + '</span> ' + esc(sRep.union_name || '—') + '</td>',
            '  <td class="c-num">' + fmtNum(sim.memberTotal) + '명</td>',
            '  <td class="c-num">' + (sim.timeoffHours ? fmtNum(sim.timeoffHours) + 'h' : '—') + '</td>',
            '  <td title="' + esc(latestTxt) + '">' +
              (sSafeUrl ? '<a class="pau-pill ok" href="' + esc(sSafeUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 원문</a> ' : '') +
              esc(latestTxt) + '</td>',
            '  <td title="' + esc((sim.reasons || []).join(', ')) + '"><span class="pau-pill fktu">' + sim.score + '점</span> ' + esc((sim.reasons || []).join(' · ')) + '</td>',
            '</tr>'
          ].join('');
        }).join(''),
        '      </tbody>',
        '    </table>',
        '  </div>',

        '  <div style="font-size:12.5px;font-weight:700;margin:8px 0 6px;">⚖️ 기준 기관(' + esc(inst.name) + ') vs 상위 유사 기관 13대 핵심 단협 쟁점 1:N 정밀 대조표</div>',
        '  <div class="pau-tbl-wrap" style="max-height:340px;">',
        '    <table class="pau-tbl">',
        '      <thead>',
        '        <tr>',
        '          <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="13대 쟁점 대조표 전체" disabled></label></th>',
        '          <th class="c-no">№</th>',
        '          <th style="width:18%;">13대 핵심 단협 쟁점 · 관련법령</th>',
        '          <th style="width:20%;background:var(--pau-pri-bg);color:var(--pau-pri);">⭐ 기준: ' + esc(inst.name) + '</th>',
        topPeersForMatrix.map(function (p) {
          return '<th style="width:15.5%;"><a href="pu-alio-union.html?organ=' + encodeURIComponent(p.apba_id) + '" data-jump-organ="' + esc(p.apba_id) + '" style="color:var(--pau-pri);text-decoration:none;">↗ ' + esc(p.name) + '</a></th>';
        }).join(''),
        '        </tr>',
        '      </thead>',
        '      <tbody>',
        METRIC_DEFS.map(function (def, idx) {
          var bItem = baseMetrics[def.key] || null;
          var bVal = bItem ? (bItem.metric_value || '—') : (idx === 1 && totalTimeoff ? fmtNum(totalTimeoff) + '시간' : '—');
          var bSnip = bItem ? (bItem.evidence_article || bItem.snippet || '') : '';
          return [
            '<tr>',
            '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" aria-label="쟁점 ' + (idx + 1) + '" disabled></label></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(def.label + ' (' + def.lawTitle + ')') + '" style="font-weight:700;">' + esc(def.label) + '</td>',
            '  <td title="' + esc(bVal + ' — ' + bSnip) + '" style="font-weight:700;color:var(--pau-pri);">' + esc(bVal + (bSnip ? ' · ' + bSnip : '')) + '</td>',
            topPeersForMatrix.map(function (p) {
              var pm = extractOrganMetrics(safeMetrics, p.apba_id)[def.key] || null;
              var pVal = pm ? (pm.metric_value || '—') : (idx === 1 && p.timeoffHours ? fmtNum(p.timeoffHours) + '시간' : '—');
              var pSnip = pm ? (pm.evidence_article || pm.snippet || '') : '';
              return '<td title="' + esc(p.name + ': ' + pVal + ' — ' + pSnip) + '">' + esc(pVal + (pSnip ? ' · ' + pSnip : '')) + '</td>';
            }).join(''),
            '</tr>'
          ].join('');
        }).join(''),
        '      </tbody>',
        '    </table>',
        '  </div>',
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
      var tlCkAll = bodyEl.querySelector('[data-htl-ckall]');
      if (tlCkAll) {
        tlCkAll.addEventListener('change', function () {
          timeline.forEach(function (t) { state.hCheckedTl[t.id] = tlCkAll.checked; });
          renderTabOrganHistory();
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-htl-ck]'), function (ck) {
        ck.addEventListener('change', function () {
          state.hCheckedTl[ck.getAttribute('data-htl-ck')] = ck.checked;
        });
      });
      var simCkAll = bodyEl.querySelector('[data-hsim-ckall]');
      if (simCkAll) {
        simCkAll.addEventListener('change', function () {
          similars.forEach(function (s) { state.hCheckedSim[s.apba_id] = simCkAll.checked; });
          renderTabOrganHistory();
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-hsim-ck]'), function (ck) {
        ck.addEventListener('change', function () {
          state.hCheckedSim[ck.getAttribute('data-hsim-ck')] = ck.checked;
        });
      });
    }

    // ── 탭 3: 13대 핵심 쟁점 기관간 비교·원문 대조 ──
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
      var rows = filterMatrix();
      var checkedAids = Object.keys(state.mChecked).filter(function (k) { return state.mChecked[k]; });
      var selectedRows = rows.filter(function (r) { return state.mChecked[r.apba_id]; });

      bodyEl.innerHTML = [
        '<div class="pau-chips">',
        METRIC_DEFS.map(function (d) {
          return '<button type="button" class="pau-chip' + (state.mIssue === d.key ? ' on' : '') + '" data-issue="' + esc(d.key) + '">' + esc(d.label) + '</button>';
        }).join(''),
        '</div>',
        '<div class="pau-flt">',
        '  <select data-f="mScope" aria-label="중앙·지방 구분" title="중앙·지방 구분">',
        '    <option value="ALL"' + (state.mScope === 'ALL' ? ' selected' : '') + '>전체 기관 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.mScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙공공기관 (ALIO)</option>',
        '    <option value="LOCAL_ALL"' + (state.mScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방공공기관·산하단체 (클린아이)</option>',
        '  </select>',
        '  <select data-f="mType" aria-label="기관유형 선택" title="기관유형">',
        '    <option value="">기관유형 전체</option>',
        allTypes.map(function (t) { return '<option value="' + esc(t) + '"' + (state.mType === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''),
        '  </select>',
        '  <select data-f="mConfed" aria-label="상급단체 선택" title="상급단체">',
        '    <option value="">상급단체 전체</option>',
        allConfeds.map(function (c) { return '<option value="' + esc(c) + '"' + (state.mConfed === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join(''),
        '  </select>',
        '  <input type="search" data-f="mQuery" aria-label="쟁점 조문 검색" placeholder="기관명·조문 내용·요약값 검색..." value="' + esc(state.mQuery) + '">',
        '  <span class="pau-flt-hint" style="font-size:12px;font-weight:700;">⚖️ 관련법령: ' + esc(def.lawTitle) + '</span>',
        '</div>',
        '<div class="pau-bulk' + (checkedAids.length ? ' on' : '') + '">',
        '  <span>대조 선택 <b>' + checkedAids.length + '</b>개 기관 — 하단 카드에서 법령 기준 vs 기관별 단협 원문을 나란히 비교합니다</span>',
        '  <button type="button" class="pau-act-btn" data-m-clear>선택 초기화</button>',
        '</div>',
        '<div class="pau-tbl-wrap" style="max-height:' + (selectedRows.length ? '340px' : 'calc(100vh - 295px)') + ';">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-m-ckall aria-label="쟁점 비교 기관 전체 선택" title="전체 선택"></label></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:18%;">기관명 · 유형 (클릭→별개 창)</th>',
        '        <th style="width:16%;">대표노조 · 상급단체</th>',
        '        <th style="width:10%;">조합원 · 타임오프</th>',
        '        <th style="width:18%;">단협 핵심 지표 요약</th>',
        '        <th style="width:12%;">관련 단협 조문</th>',
        '        <th style="width:26%;">단협 조문 원문 발췌 (클릭→체크)</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody>',
        rows.map(function (r, idx) {
          var ck = !!state.mChecked[r.apba_id];
          var inst = instMap[r.apba_id] || { apba_id: r.apba_id, inst_type: r.inst_type };
          var isLoc = isLocalOrgan(inst);
          var uList = (unionsByAid[r.apba_id] || []).filter(function (u) { return u && u.union_structure !== '노조없음'; });
          var repU = uList[0] || {};
          var orgFull = (r.inst_name || '') + ' · ' + (r.inst_type || '');
          var uniFull = (repU.confederation || '미가입') + ' · ' + (repU.union_name || '노동조합');
          var memFull = fmtNum(repU.member_total || 0) + '명 / ' + (repU.timeoff_hours ? fmtNum(repU.timeoff_hours) + 'h' : '—');
          var artFull = r.evidence_article || '';
          var snip = String(r.snippet || '').replace(/\s+/g, ' ').trim();
          return [
            '<tr data-m-row="' + esc(r.apba_id) + '" style="cursor:pointer;">',
            '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-m-ck="' + esc(r.apba_id) + '" aria-label="' + esc(r.inst_name + ' 선택') + '"' + (ck ? ' checked' : '') + '></label></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(orgFull) + ' (클릭→별개 창)"><span class="pau-pill ' + (isLoc ? 'loc' : '') + '">' + (isLoc ? '지방' : '중앙') + '</span> <a href="pu-alio-union.html?organ=' + encodeURIComponent(r.apba_id) + '" data-jump-organ="' + esc(r.apba_id) + '" style="font-weight:700;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(r.inst_name) + '</a></td>',
            '  <td title="' + esc(uniFull) + '"><span class="pau-pill ' + confedClass(repU.confederation) + '">' + esc(repU.confederation || '미가입') + '</span> ' + esc(repU.union_name || '노동조합') + '</td>',
            '  <td class="c-num" title="' + esc(memFull) + '">' + esc(memFull) + '</td>',
            '  <td title="' + esc(r.metric_value || '') + '" style="font-weight:700;color:var(--pau-pri);">' + esc(r.metric_value || '—') + '</td>',
            '  <td title="' + esc(artFull) + '">' + esc(artFull || '—') + '</td>',
            '  <td title="' + esc(snip) + '">' + esc(snip || '—') + '</td>',
            '</tr>'
          ].join('');
        }).join(''),
        '    </tbody>',
        '  </table>',
        '</div>',
        '<div class="pau-sbs" data-m-sbs></div>'
      ].join('');

      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-issue]'), function (b) {
        b.addEventListener('click', function () {
          state.mIssue = b.getAttribute('data-issue');
          renderTabMatrix();
        });
      });
      bindFilterInputs(renderTabMatrix);
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-jump-organ]'), function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
        });
      });

      var ckAll = bodyEl.querySelector('[data-m-ckall]');
      if (ckAll) {
        ckAll.addEventListener('change', function () {
          rows.forEach(function (r) { state.mChecked[r.apba_id] = ckAll.checked; });
          renderTabMatrix();
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-m-ck]'), function (ck) {
        ck.addEventListener('click', function (e) { e.stopPropagation(); });
        ck.addEventListener('change', function () {
          state.mChecked[ck.getAttribute('data-m-ck')] = ck.checked;
          renderTabMatrix();
        });
      });
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-m-row]'), function (tr) {
        tr.addEventListener('click', function () {
          var aid = tr.getAttribute('data-m-row');
          state.mChecked[aid] = !state.mChecked[aid];
          renderTabMatrix();
        });
      });
      var clr = bodyEl.querySelector('[data-m-clear]');
      if (clr) clr.addEventListener('click', function () { state.mChecked = {}; renderTabMatrix(); });

      var sbsEl = bodyEl.querySelector('[data-m-sbs]');
      var compareList = selectedRows.length ? selectedRows.slice(0, 6) : rows.slice(0, 3);
      if (sbsEl && compareList.length) {
        sbsEl.innerHTML = [
          '<div class="pau-card law">',
          '  <div class="pau-card-hd" title="대한민국 현행 법령 기준 (' + esc(def.lawTitle) + ')"><span>⚖️ 대한민국 법령 기준 · ' + esc(def.lawTitle) + '</span><span class="pau-pill ok">실시간 법령 API</span></div>',
          '  <pre class="pau-card-pre" data-law-live-box>법령 API에서 (' + esc(def.lawTitle) + ') 원문을 불러오는 중...</pre>',
          '</div>'
        ].concat(compareList.map(function (r) {
          return [
            '<div class="pau-card">',
            '  <div class="pau-card-hd" title="' + esc(r.inst_name) + '"><a href="pu-alio-union.html?organ=' + encodeURIComponent(r.apba_id) + '" data-jump-organ="' + esc(r.apba_id) + '" style="color:var(--pau-pri);text-decoration:none;">↗ 🏛️ ' + esc(r.inst_name) + '</a><span class="pau-pill fktu">' + esc(r.metric_value || '') + '</span></div>',
            '  <div style="font-size:11.5px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><b>' + esc(r.evidence_article || '') + '</b></div>',
            '  <pre class="pau-card-pre">' + esc(r.snippet || '') + '</pre>',
            '</div>'
          ].join('');
        })).join('');

        Array.prototype.forEach.call(sbsEl.querySelectorAll('[data-jump-organ]'), function (a) {
          a.addEventListener('click', function (e) {
            e.preventDefault();
            openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
          });
        });

        var lawBox = sbsEl.querySelector('[data-law-live-box]');
        fetchLawLive(def.lawKey, function (err, law) {
          if (!lawBox) return;
          if (err || !law) {
            lawBox.textContent = def.lawTitle + ' — 법령 원문 조회 대기 중 (탭 6에서 전체 조문 조회 가능)';
            return;
          }
          var a = law.arts[def.lawArt];
          lawBox.textContent = a
            ? '(' + law.title + ' ' + a.no + ' ' + a.title + ' · 시행 ' + law.effective + ')\n' + a.text
            : '(' + law.title + ') 공포 ' + law.promulgated + ' (제' + def.lawArt + '조)';
        });
      }
    }

    // ── 탭 4: 단체협약 조문 통합 검색 ──
    function filterArticles() {
      var q = state.aQuery.trim().toLowerCase();
      return safeArticles.filter(function (a) {
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
        '  <select data-f="aCat" aria-label="조문 분류 선택" title="조문 분류">',
        TAXONOMY_LIST.map(function (t) {
          return '<option value="' + esc(t[0]) + '"' + (state.aCat === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join(''),
        '  </select>',
        '  <input type="search" data-f="aQuery" aria-label="단체협약 조문 검색" placeholder="조문 제목·본문 키워드 검색 (예: 타임오프, 징계위원회, 정년, 자동연장, 산재, 육아휴직)..." value="' + esc(state.aQuery) + '">',
        '  <span style="font-size:12px;">조회 조문 <b>' + fmtNum(rows.length) + '</b>건</span>',
        '</div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-a-ckall aria-label="조문 전체 선택" title="전체 선택"></label></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:17%;">기관명 (클릭→별개 창)</th>',
        '        <th style="width:14%;">분류</th>',
        '        <th style="width:8%;">조문번호</th>',
        '        <th style="width:16%;">조문제목</th>',
        '        <th style="width:45%;">조문 본문 (마우스 오버 시 전문 확인)</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody>',
        rows.map(function (a, idx) {
          var key = a.apba_id + '_' + a.article_no + '_' + idx;
          var ck = !!state.aChecked[key];
          var bodyTxt = String(a.text || '').replace(/\s+/g, ' ').trim();
          var artNo = String(a.article_no || '');
          if (artNo && artNo.indexOf('제') !== 0) artNo = '제' + artNo + '조';
          return [
            '<tr>',
            '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-a-ck="' + esc(key) + '" aria-label="' + esc(a.inst_name + ' ' + artNo + ' 선택') + '"' + (ck ? ' checked' : '') + '></label></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(a.inst_name) + ' (클릭→별개 창)"><a href="pu-alio-union.html?organ=' + encodeURIComponent(a.apba_id) + '" data-jump-organ="' + esc(a.apba_id) + '" style="font-weight:700;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(a.inst_name) + '</a></td>',
            '  <td title="' + esc(a.taxonomy_name || '') + '"><span class="pau-pill">' + esc(a.taxonomy_name || '기타') + '</span></td>',
            '  <td title="' + esc(artNo) + '" style="font-weight:700;">' + esc(artNo) + '</td>',
            '  <td title="' + esc(a.article_title || '') + '" style="font-weight:700;color:var(--pau-pri);">' + esc(a.article_title || '—') + '</td>',
            '  <td title="' + esc(bodyTxt) + '">' + esc(bodyTxt) + '</td>',
            '</tr>'
          ].join('');
        }).join(''),
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
      var ckAll = bodyEl.querySelector('[data-a-ckall]');
      if (ckAll) {
        ckAll.addEventListener('change', function () {
          rows.forEach(function (a, i) { state.aChecked[a.apba_id + '_' + a.article_no + '_' + i] = ckAll.checked; });
          renderTabArticles();
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-a-ck]'), function (ck) {
        ck.addEventListener('change', function () {
          state.aChecked[ck.getAttribute('data-a-ck')] = ck.checked;
        });
      });
    }

    // ── 탭 5: 기관별 공시·별도합의·내부규정 원문 ──
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

      var pageSize = 400;
      var totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      if (state.dPage >= totalPages) state.dPage = totalPages - 1;
      if (state.dPage < 0) state.dPage = 0;
      var startIdx = state.dPage * pageSize;
      var visibleRows = rows.slice(startIdx, startIdx + pageSize);

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select data-f="dScope" aria-label="중앙·지방 구분" title="중앙·지방 구분">',
        '    <option value="ALL"' + (state.dScope === 'ALL' ? ' selected' : '') + '>전체 기관 (중앙+지방)</option>',
        '    <option value="CENTRAL"' + (state.dScope === 'CENTRAL' ? ' selected' : '') + '>🏛️ 중앙공공기관 (ALIO)</option>',
        '    <option value="LOCAL_ALL"' + (state.dScope === 'LOCAL_ALL' ? ' selected' : '') + '>🏙️ 지방공공기관·산하단체 (클린아이)</option>',
        '  </select>',
        '  <input type="search" data-f="dOrganSearch" aria-label="공시 조회 기관명 필터" placeholder="기관명 빠른 필터..." value="' + esc(state.dOrganSearch) + '" style="max-width:170px;">',
        '  <select data-f="dOrgan" aria-label="공시 조회 기관 선택" title="기관 선택 (' + fmtNum(scopedOrgans.length) + '곳)">',
        '    <option value="">전체 기관 (' + fmtNum(scopedOrgans.length) + '곳)</option>',
        scopedOrgans.map(function (i) {
          return '<option value="' + esc(i.apba_id) + '"' + (state.dOrgan === i.apba_id ? ' selected' : '') + '>' + esc((isLocalOrgan(i) ? '(지방) ' : '(중앙) ') + i.name + ' (' + i.apba_id + ')') + '</option>';
        }).join(''),
        '  </select>',
        '  <select data-f="dTax" aria-label="공시 항목 분류 선택" title="공시 항목 분류">',
        DISC_CCODE_LIST.map(function (t) {
          return '<option value="' + esc(t[0]) + '"' + (state.dTax === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        }).join(''),
        '  </select>',
        '  <input type="search" data-f="dQuery" aria-label="공시문서 검색" placeholder="공시문서명·첨부파일명·본문 검색..." value="' + esc(state.dQuery) + '">',
        (selectedInst ? '<button type="button" class="pau-act-btn pri" data-d-open-win="' + esc(selectedInst.apba_id) + '">↗ ' + esc(selectedInst.name) + ' 연혁·비교 별개 창</button>' : ''),
        (safeSelectedUnionUrl ? '<a class="pau-act-btn" href="' + esc(safeSelectedUnionUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시 원문</a>' : ''),
        '</div>',
        (rows.length > pageSize ? [
          '<div class="pau-pager">',
          '  <span>전체 <b>' + fmtNum(rows.length) + '</b>건 중 <b>' + fmtNum(startIdx + 1) + '~' + fmtNum(startIdx + visibleRows.length) + '</b>번째 표시 (페이지 ' + (state.dPage + 1) + '/' + totalPages + ')</span>',
          '  <div style="display:flex;gap:6px;">',
          '    <button type="button" class="pau-act-btn" data-d-prev' + (state.dPage <= 0 ? ' disabled' : '') + '>◀ 이전 ' + pageSize + '건</button>',
          '    <button type="button" class="pau-act-btn" data-d-next' + (state.dPage + 1 >= totalPages ? ' disabled' : '') + '>다음 ' + pageSize + '건 ▶</button>',
          '  </div>',
          '</div>'
        ].join('') : ''),
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-d-ckall aria-label="공시 목록 전체 선택" title="전체 선택"></label></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:16%;">기관명 (클릭→별개 창)</th>',
        '        <th style="width:14%;">공시항목 분류</th>',
        '        <th style="width:22%;">문서 제목 · 기준연혁일</th>',
        '        <th style="width:20%;">원문 첨부파일 · 공시뷰어 API</th>',
        '        <th style="width:28%;">본문 요약 · 추출 미리보기</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody>',
        visibleRows.map(function (d, idx) {
          var absIdx = startIdx + idx;
          var key = String(d.dno || (d.aid + '_' + d.ccode + '_' + absIdx));
          var ck = !!state.dChecked[key];
          var files = d.files || [];
          var firstFile = files[0] || null;
          var safeFirstFileUrl = firstFile ? safeHttpUrl(firstFile.url || firstFile.download_url || '') : '';
          var safeViewerUrl = safeHttpUrl(buildOrganUrl(instMap[d.aid] || d.aid, d.dno));
          var kvParts = [];
          Object.keys(d.kv || {}).forEach(function (k) {
            if (worth(d.kv[k])) kvParts.push(k + ': ' + d.kv[k]);
          });
          var prev = ((d.highlights || []).join(' ') || kvParts.join(' · ')).replace(/\s+/g, ' ').trim();
          var dt = d.edate || d.rdate || '';
          var titFull = (d.title || '') + (dt ? ' (' + dt + ')' : '');
          return [
            '<tr>',
            '  <td class="c-ck"><label class="pau-ck-lbl"><input type="checkbox" data-d-ck="' + esc(key) + '" aria-label="' + esc(d.iname + ' ' + titFull + ' 선택') + '"' + (ck ? ' checked' : '') + '></label></td>',
            '  <td class="c-no">' + (absIdx + 1) + '</td>',
            '  <td title="' + esc(d.iname) + ' (클릭→별개 창)"><a href="pu-alio-union.html?organ=' + encodeURIComponent(d.aid) + '" data-jump-organ="' + esc(d.aid) + '" style="font-weight:700;color:var(--pau-pri);text-decoration:none;">↗ ' + esc(d.iname) + '</a></td>',
            '  <td title="' + esc((d.cname || '') + ' (' + (d.ccode || '') + ')') + '"><span class="pau-pill">' + esc(d.cname || d.ccode) + '</span></td>',
            '  <td title="' + esc(titFull) + '" style="font-weight:600;">' + esc(titFull) + '</td>',
            '  <td title="' + esc((firstFile ? firstFile.name : '') + ' ' + (safeViewerUrl || '')) + '">' +
              (safeFirstFileUrl ? '<a class="pau-pill fktu" href="' + esc(safeFirstFileUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📎 ' + esc(firstFile.name || '원문다운') + '</a> ' : '') +
              (safeViewerUrl ? '<a class="pau-pill ok" href="' + esc(safeViewerUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 공시뷰어</a>' : '') +
              '</td>',
            '  <td title="' + esc(prev) + '">' + esc(prev || '—') + '</td>',
            '</tr>'
          ].join('');
        }).join(''),
        '    </tbody>',
        '  </table>',
        '</div>'
      ].join('');

      bindFilterInputs(renderTabDetail);
      var prevBtn = bodyEl.querySelector('[data-d-prev]');
      if (prevBtn) prevBtn.addEventListener('click', function () { if (state.dPage > 0) { state.dPage -= 1; renderTabDetail(); } });
      var nextBtn = bodyEl.querySelector('[data-d-next]');
      if (nextBtn) nextBtn.addEventListener('click', function () { if (state.dPage + 1 < totalPages) { state.dPage += 1; renderTabDetail(); } });

      var openWinBtn = bodyEl.querySelector('[data-d-open-win]');
      if (openWinBtn) {
        openWinBtn.addEventListener('click', function () {
          openOrganWindow(openWinBtn.getAttribute('data-d-open-win') || '', false);
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-jump-organ]'), function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          openOrganWindow(a.getAttribute('data-jump-organ') || '', false);
        });
      });
      var ckAll = bodyEl.querySelector('[data-d-ckall]');
      if (ckAll) {
        ckAll.addEventListener('change', function () {
          visibleRows.forEach(function (d, i) {
            var key = String(d.dno || (d.aid + '_' + d.ccode + '_' + (startIdx + i)));
            state.dChecked[key] = ckAll.checked;
          });
          renderTabDetail();
        });
      }
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-d-ck]'), function (ck) {
        ck.addEventListener('change', function () {
          state.dChecked[ck.getAttribute('data-d-ck')] = ck.checked;
        });
      });
    }

    // ── 탭 6: 공공·법령 API 실시간 연동 센터 ──
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
        '      <input type="text" data-f="apiLawArt" aria-label="법령 조문번호 입력" placeholder="조문번호 (예: 24, 29의2, 50, 60)" value="' + esc(state.apiLawArt) + '" style="max-width:150px;">',
        '      <button type="button" class="pau-act-btn pri" data-api-law-run>법령 조문 조회</button>',
        '    </div>',
        '    <pre class="pau-card-pre" data-api-law-out style="max-height:260px;">조회 중...</pre>',
        '  </div>',
        '  <div class="pau-card">',
        '    <div class="pau-card-hd"><span>🏛️ 2. 중앙 ALIO + 지방 클린아이(Cleaneye) 원문·첨부파일 직결 API</span><span class="pau-pill ok">실시간 연결됨</span></div>',
        '    <div class="pau-flt" style="margin:4px 0;">',
        '      <input type="search" data-f="apiAlioSearch" aria-label="API 대상 기관명 검색" placeholder="기관명 빠른 검색..." value="' + esc(state.apiAlioSearch) + '" style="max-width:160px;">',
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
        '      <button type="button" class="pau-act-btn pri" data-api-open-organ="' + esc(inst.apba_id) + '">↗ ' + esc(inst.name) + ' 연혁·비교 별개 창 열기</button>',
        '      <a class="pau-act-btn" href="' + esc(alioLiveUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">🔗 ' + (isLoc ? '클린아이 공시 열기' : 'ALIO 공시 열기') + '</a>',
        '      <a class="pau-act-btn" href="' + esc(alioRuleUrl) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">📘 내부규정 열기</a>',
        '    </div>',
        '    <pre class="pau-card-pre" style="max-height:220px;">' + esc([
          '• 중앙공공기관(ALIO) 공시 엔드포인트: https://www.alio.go.kr/item/itemOrganList.do?apbaId={기관코드}&reportFormRootNo={항목코드}',
          '• 지방공공기관(클린아이 지방공기업 429곳): https://www.cleaneye.go.kr/user/empWorkUnionInfo.do (단체·임금·보충·별도합의서)',
          '• 지방산하단체(클린아이 출자·출연기관 903곳): https://www.cleaneye.go.kr/user/iptUnionCnvt.do (노조현황·단협·임협 원문)',
          '• 첨부파일 다운로드: ALIO (' + alioDocUrl + ') / 클린아이 (/file/FileDownload.do)'
        ].join('\n')) + '</pre>',
        '  </div>',
        '  <div class="pau-card">',
        '    <div class="pau-card-hd"><span>🔑 3. 공공데이터포털 (data.go.kr) Open API 열쇠 & 공휴일 캐시 연동</span><span class="pau-pill ' + (state.apiDataKey ? 'ok' : 'multi') + '">' + esc(state.apiKeySource) + '</span></div>',
        '    <div class="pau-flt" style="margin:4px 0;">',
        '      <input type="password" data-api-key-in aria-label="공공데이터포털 인증키 입력" placeholder="공공데이터포털 Decoding 인증키 입력..." value="' + esc(state.apiDataKey) + '" autocomplete="off">',
        '      <button type="button" class="pau-act-btn pri" data-api-key-save>인증키 저장·동기화</button>',
        '    </div>',
        '    <pre class="pau-card-pre" style="max-height:220px;">' + esc([
          '• 푸른 통합시스템 정부사업신청(gov/{uid}/key_data) 및 공휴일 API(pubdata/common/holidays)와 자동 연동됩니다.',
          '• 한국천문연구원 특일정보(공휴일) 캐시 수신 건수: ' + (state.apiHolidays.length ? state.apiHolidays.length + '건 연동됨' : '포털 로그인 시 자동 수신'),
          '• 전체 수록 현황: 총 ' + fmtNum(totalInst) + '개 기관 (중앙 ALIO ' + fmtNum(centralInstCount) + '곳 + 지방 클린아이 ' + fmtNum(localInstCount) + '곳)'
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
          if (key === 'uScope' || key === 'uType' || key === 'uMinistry' || key === 'uConfed' || key === 'uStruct' || key === 'uQuery') {
            state.uPage = 0;
          }
          if (key === 'dScope' || key === 'dOrgan' || key === 'dTax' || key === 'dQuery') {
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

    function exportUnionsCsv(rows) {
      downloadCsv(
        '공공임단협_중앙지방_노조타임오프현황.csv',
        ['기관코드', '구분', '기관명', '소관부처_지자체', '기관유형', '노조형태', '노동조합명', '교섭권', '상급단체(총연맹)', '산별연맹', '가입대상인원', '조합원수', '타임오프시간', '전임자_풀타임', '전임자_파트타임', '설립일', '위원장임기', '가입범위'],
        rows.map(function (r) {
          return [
            r.apba_id, isLocalOrgan(r) ? '지방공공기관·산하단체' : '중앙공공기관',
            r.inst_name, r.ministry, r.inst_type, r.union_structure, r.union_name,
            r.bargaining_right, r.confederation, r.federation,
            r.eligible_count, r.member_total, r.timeoff_hours,
            r.timeoff_fulltime, r.timeoff_parttime,
            r.established_date, r.chair_term, r.scope
          ];
        })
      );
    }

    function exportCurrentTabCsv() {
      if (state.tab === 'unions') {
        exportUnionsCsv(filterUnions());
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
      } else if (state.tab === 'matrix') {
        var rows = filterMatrix();
        var def = METRIC_DEFS.find(function (d) { return d.key === state.mIssue; }) || METRIC_DEFS[0];
        downloadCsv(
          '공공임단협_13대쟁점_' + def.label + '.csv',
          ['쟁점', '기관코드', '기관명', '기관유형', '지표요약', '관련조문', '조문발췌'],
          rows.map(function (r) {
            return [def.label, r.apba_id, r.inst_name, r.inst_type, r.metric_value, r.evidence_article, r.snippet];
          })
        );
      } else if (state.tab === 'articles') {
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
      else if (state.tab === 'articles') renderTabArticles();
      else if (state.tab === 'detail') renderTabDetail();
      else renderTabApiHub();
    }

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
    buildOrganTimeline: buildOrganTimeline,
    findSimilarOrgans: findSimilarOrgans,
    extractOrganMetrics: extractOrganMetrics,
    safeHttpUrl: safeHttpUrl,
    setAuthUser: setAuthUser,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
