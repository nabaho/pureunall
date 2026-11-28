/* 푸른통합시스템 산재·노동사건 공통 분류 · 4축 정리 · 공방 대조 코어 (브라우저 · Node 수집기 겸용)
   - 공개 저장소 및 RTDB 공유 원장 보호를 위해 본문/주민번호/계좌/로컬 OS 절대경로를 저장 객체에서 자동 제거한다.
   - 원본 무변경 · 표준 보관함 상대경로(archiveRelPath) 기반 실시간 열람 및 1:1 상대방↔당사 대응 매칭을 제공한다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuCaseArchiveCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  function s(v) { return v == null ? '' : String(v); }
  function clean(v) { return s(v).replace(/\s+/g, ' ').trim(); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  var ARCHIVE_DOCS_STANDARD_FOLDERS = [
    { key: 'ours', label: '01_당사제출·대응서류', short: '당사 대응', color: 'blue' },
    { key: 'opponent', label: '02_상대방제출서류', short: '상대방 서류', color: 'red' },
    { key: 'agency', label: '03_판정문·결정·처분통지', short: '판정·기관', color: 'green' },
    { key: 'evidence', label: '04_입증자료·사실확인', short: '입증자료', color: 'amber' },
    { key: 'contract', label: '05_위임·계약·기타', short: '수임·행정', color: 'gray' }
  ];

  var SUBTYPE_LABELS = {
    injury_accident: '업무상 사고',
    injury_disease: '업무상 질병·질판위',
    injury_commute: '출퇴근 재해',
    injury_death: '유족·중대재해',
    injury_review: '산재 심사·재심사·소송',
    safety_accident: '산안·중대재해처벌법',
    dismissal: '부당해고 구제',
    discipline: '징계·정직·감봉',
    transfer: '부당전보·대기발령',
    unfair_labor: '부당노동행위·교섭',
    discrimination: '차별시정',
    harassment_labor: '괴롭힘·성희롱 사건',
    wage: '임금·퇴직금 체불',
    petition: '고용노동청 진정·고소',
    subrogation: '대지급금(간이·도산)'
  };

  /* ── 분류 규칙 (오탐 배제 + 3영역 판별) ──────────────────────────────── */
  var SANJAE_STRONG = [
    ['산재', 12], ['산업재해', 16], ['요양급여', 18], ['최초요양', 18], ['추가상병', 18],
    ['재요양', 16], ['휴업급여', 16], ['장해급여', 18], ['장해보상', 16], ['유족급여', 18],
    ['간병급여', 16], ['업무상질병', 18], ['업무상 질병', 18], ['업무상사고', 16], ['업무상 사고', 16],
    ['질판위', 20], ['질병판정위원회', 20], ['근로복지공단', 12], ['산재심사', 18], ['재심사청구', 16],
    ['산업재해보상보험', 16], ['소음성난청', 16], ['뇌심혈관', 16], ['근골격계', 14], ['진폐', 14],
    ['직업성암', 16], ['직업병', 14], ['출퇴근재해', 16], ['유족연금', 14], ['합병증예방', 14],
    ['중대재해', 12], ['중대산업재해', 16], ['작업중지', 12], ['산재은폐', 16], ['요양불승인', 20],
    ['산재승인', 16], ['요양신청', 16], ['재해경위서', 16], ['산재조사', 14]
  ];
  var DISMISSAL_STRONG = [
    ['부당해고', 22], ['부당징계', 20], ['부당정직', 20], ['부당전보', 20], ['부당전직', 20],
    ['부당감봉', 18], ['부당노동행위', 22], ['불이익취급', 16], ['지배개입', 16], ['교섭해태', 16],
    ['공정대표의무', 18], ['차별시정', 18], ['구제신청', 20], ['구제명령', 18], ['재심신청', 18],
    ['노동위원회', 16], ['중노위', 18], ['중앙노동위원회', 20], ['지노위', 18], ['지방노동위원회', 18],
    ['심문회의', 18], ['심문기일', 18], ['화해조서', 16], ['화해권고', 16], ['이행강제금', 18],
    ['징계위원회', 14], ['징계의결서', 16], ['해고통지서', 18], ['해고예고', 12], ['대기발령', 14],
    ['초심이유서', 20], ['재심이유서', 20], ['피신청인답변서', 20], ['이유서', 10], ['답변서', 9],
    ['보충서면', 14], ['판정서', 12]
  ];
  var WAGE_STRONG = [
    ['임금체불', 22], ['체불임금', 22], ['체불금품', 20], ['진정서', 16], ['진정사건', 18],
    ['피진정인', 18], ['피고소인', 16], ['진정인', 14], ['고소장', 14], ['고발장', 14],
    ['시정지시', 18], ['시정명령', 16], ['출석요구서', 16], ['범죄인지', 18], ['기소의견', 18],
    ['검찰송치', 16], ['불송치', 14], ['도산사실인정', 22], ['대지급금', 22], ['간이대지급금', 22],
    ['도산대지급금', 22], ['소액체당금', 20], ['체당금', 18], ['체불임금등사업주확인서', 22],
    ['근로감독관', 14], ['고용노동지청', 16], ['고용노동청', 14], ['노동청', 12], ['금품청산', 14],
    ['퇴직금체불', 18], ['미지급임금', 16], ['미지급수당', 14], ['연차수당체불', 18], ['권리구제', 12]
  ];

  var NOISE_EXCLUSIONS = [
    ['보수총액', 20], ['고용산재토탈', 18], ['피보험자격', 14], ['취득신고', 14], ['상실신고', 14],
    ['일자리안정자금', 22], ['두루누리', 20], ['일터혁신', 22], ['산업일자리전환', 22],
    ['법정교육', 14], ['법정의무교육', 18], ['수료증', 14], ['전자세금계산서', 16],
    ['매월 급여대장', 16], ['정기급여', 14], ['뉴스레터', 18], ['구독해지', 18],
    ['노무자문료', 12], ['계약갱신', 10], ['연말정산', 18], ['원천징수영수증', 16], ['퇴직연금가입', 14]
  ];

  var KNOWN_NOISE_PATHS = /(\\|\/)(백업_중복|node_modules|\.git|\.claude|dist|build|temp|cache|세무|연말정산|일터상생|산업일자리전환|강의자료)(\\|\/|$)/i;

  function scoreTerms(text, list) {
    var score = 0;
    var hits = [];
    for (var i = 0; i < list.length; i++) {
      var kw = list[i][0];
      var w = list[i][1];
      if (text.indexOf(kw) !== -1) {
        score += w;
        hits.push(kw);
      }
    }
    return { score: score, hits: hits };
  }

  function detectSanjaeSubType(text) {
    if (/재심사|심사청구|행정소송|구합|누\d|불승인/.test(text)) return 'injury_review';
    if (/유족|사망|장례비|중대재해|중대산업재해/.test(text)) return 'injury_death';
    if (/산안|산업안전|안전보건|작업중지|안전관리자/.test(text)) return 'safety_accident';
    if (/출퇴근/.test(text)) return 'injury_commute';
    if (/질판위|업무상\s*질병|난청|뇌심혈관|근골격계|진폐|직업병|직업성암|폐질환/.test(text)) return 'injury_disease';
    return 'injury_accident';
  }

  function detectLaborSubType(text, domain) {
    if (domain === 'labor_wage') {
      if (/대지급금|체당금|도산사실/.test(text)) return 'subrogation';
      if (/체불|임금체불|퇴직금|금품청산|미지급/.test(text)) return 'wage';
      return 'petition';
    }
    if (/부당노동행위|교섭해태|지배개입|불이익취급|공정대표|부노|단노/.test(text)) return 'unfair_labor';
    if (/차별시정|기간제차별/.test(text)) return 'discrimination';
    if (/전보|전직|인사발령|대기발령|부전/.test(text)) return 'transfer';
    if (/징계|정직|감봉|견책|해임|파면|부징|부정/.test(text)) return 'discipline';
    if (/괴롭힘|성희롱/.test(text)) return 'harassment_labor';
    return 'dismissal';
  }

  /* ── 사건번호 · 연도 · 관할 · 당사자 · 기업명 신호 추출 ────────────── */
  var LABOUR_CASE_RE = /(서울|경기|부산|인천|대구|광주|대전|울산|강원|충북|충남|전북|전남|경북|경남|제주|중앙|중노위|지노위)?\s*(20[12]\d)\s*(부해|부노|부징|부정|부전|차별|단노|구제|재심|초심|교섭)\s*[-제호\s]*(\d{1,5})/g;
  var COURT_CASE_RE = /(20[12]\d)\s*(구합|구단|누|가합|가단|가소|나|다|노|고단|고정|고합|초)\s*(\d{1,6})/g;
  var PETITION_CASE_RE = /(?:진정|고소|사건|접수|산재)\s*(?:번호|No\.?)?\s*[:：\-#]?\s*(20[12]\d[\-_]?\d{3,8})/gi;

  var STOP_ORG_WORDS = /^(주식회사|유한회사|의료법인|사회복지법인|학교법인|사단법인|재단법인|농업회사법인|푸른노무법인|노무법인푸른|노무법인 푸른|고용노동부|근로복지공단|노동위원회|서울지방노동위원회|중앙노동위원회|경기지방노동위원회|인천지방노동위원회|충남지방노동위원회|부산지방노동위원회|업체|사업장|사업주|근로자|근로자측|사용자|사용자측|원처분기관|공통|참고|기타|다운로드|이미지|사진|이미지·사진|확인서|답변서|이유서|보충서면|준비서면|고충심의|징계|임금|급여|임금·급여|산재|안전보건|산재·안전보건|부당해고|부당해고·노동분쟁|노동분쟁|노동부사건|종료사건정리|년도별사건정리|발굴|신분·개인서류|컨설팅·보고서|견적|구제신청|진정|체불|체당금|대지급금|pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx|jpg|png|txt|eml|msg|재심의|자료|서류|내게쓴편지함|받은편지함|보낸편지함|보낸메일함|메일백업|성은|성에|현보|미분류|수정|샘플|제안서|재심의\s*자료|고소|산정내역서|보충서면|기타|확인서)$/i;
  var STOP_PERSON_WORDS = /^(진정인|피진정인|신청인|피신청인|재해자|근로자|사용자|사업주|대표이사|노무사|변호사|대리인|주식회사|유한회사|위원회|노동청|근로복지공단|고용노동부|푸른노무법인|확인서|답변서|이유서|판정서|결정서|준비서면|보충서면|해당없음|미상|불상|발생|사망|신청|접수|조사|판정|결정|통지|확인|제출|작성|검토|청구|명령|지시|요구|해고|징계|체불|산재|진정|위임|계약|참고|기타|본인|상대방|피해자)$/;

  function extractCaseNumbers(text) {
    var out = [];
    var seen = {};
    function pushNo(kind, raw, year, prefix, num) {
      var k = clean(raw).replace(/\s+/g, '');
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push({ kind: kind, text: clean(raw), norm: k, year: Number(year) || 0, code: prefix || '', num: num || '' });
    }
    var m;
    LABOUR_CASE_RE.lastIndex = 0;
    while ((m = LABOUR_CASE_RE.exec(text)) !== null) {
      pushNo('nlrc', m[0], m[2], (m[1] || '') + m[3], m[4]);
    }
    COURT_CASE_RE.lastIndex = 0;
    while ((m = COURT_CASE_RE.exec(text)) !== null) {
      pushNo('court', m[0], m[1], m[2], m[3]);
    }
    PETITION_CASE_RE.lastIndex = 0;
    while ((m = PETITION_CASE_RE.exec(text)) !== null) {
      var yrMatch = m[1].match(/^(20[12]\d)/);
      pushNo('agency', m[1], yrMatch ? yrMatch[1] : 0, '', m[1]);
    }
    return out;
  }

  function extractYear(input, caseNos) {
    if (input && input.year && Number(input.year) >= 2005 && Number(input.year) <= 2035) {
      return Number(input.year);
    }
    if (caseNos && caseNos.length && caseNos[0].year) return caseNos[0].year;
    var dateStr = clean(input && (input.date || input.receiveDate || input.isoDate));
    var dm = dateStr.match(/(20[012]\d)/);
    if (dm) return Number(dm[1]);
    var joined = clean((input && input.relPath) || '') + ' ' + clean((input && input.name) || '') + ' ' + clean((input && input.subject) || '');
    var pm = joined.match(/(?:^|[^0-9])(20[12]\d)(?:[^0-9]|$)/);
    if (pm) return Number(pm[1]);
    if (input && input.mtime) {
      var d = new Date(input.mtime);
      if (isFinite(d.getTime())) return d.getFullYear();
    }
    return new Date().getFullYear();
  }

  function extractYearMonth(input, fallbackYear) {
    var dateStr = clean(input && (input.date || input.receiveDate || input.isoDate));
    var m = dateStr.match(/(20[012]\d)[\-.\/년\s]+(\d{1,2})/);
    if (m) return m[1] + '-' + String(Number(m[2])).padStart(2, '0');
    var combined = clean((input && input.name) || '') + ' ' + clean((input && input.subject) || '');
    var m2 = combined.match(/(20[012]\d)[\-.\/](\d{2})/);
    if (m2) return m2[1] + '-' + m2[2];
    if (input && input.mtime) {
      var d = new Date(input.mtime);
      if (isFinite(d.getTime())) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      }
    }
    return String(fallbackYear || new Date().getFullYear()) + '-00';
  }

  function extractJurisdiction(text) {
    var patterns = [
      /(중앙노동위원회|중노위)/,
      /(서울|경기|부산|인천|대구|광주|대전|울산|강원|충북|충남|전북|전남|경북|경남|제주)\s*(?:지방)?노동위원회/,
      /(서울|경기|인천|충남|부산|대구|광주|대전|전남|경남)\s*지노위/,
      /근로복지공단\s*([가-힣0-9]{2,12}(?:지역본부|지사|병원|업무상질병판정위원회)?)/,
      /([가-힣]{2,10}업무상질병판정위원회|질판위)/,
      /(산업재해보상보험재심사위원회)/,
      /(고용노동부\s*[가-힣0-9]{2,12}(?:청|지청)?|[가-힣]{2,8}고용노동지청|[가-힣]{2,8}노동지청)/,
      /([가-힣]{2,8}(?:행정법원|지방법원|고등법원|대법원))/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i]);
      if (m) return clean(m[0]);
    }
    return '';
  }

  function normalizeCompanyName(name) {
    return clean(name)
      .replace(/^\(주\)|^주식회사\s*|\(주\)$|\s*주식회사$/g, '')
      .replace(/^\(유\)|^유한회사\s*|\(유\)$/g, '')
      .replace(/[^\w가-힣]/g, '')
      .toLowerCase();
  }

  function isNoiseOrgSegment(seg) {
    var st = clean(seg);
    if (!st || st.length < 2) return true;
    if (STOP_ORG_WORDS.test(st)) return true;
    if (/^(?:\d{4}(?:년)?|20\d{2}년|\d{1,2}월|제?\d+차|답변서|이유서|보충서면|준비서면|확인서|판정서|결정서|진정서|고소장|소장|구제신청|부당전보|부당징계|부당정직|부당해고|임금체불|노무|사건|종결|진행|메일|스캔|백업|미분류|수정|샘플|제안서|산정내역서|고소|재심의|scan|downloads?|desktop|documents?|pictures?|images?)(?:\s*\(\d+\))?$/i.test(st)) return true;
    if (/(께서\s*주식회사|^\d+분|호증|부해\d+|부노\d+|사건번호\d+|산정내역서|재심의\s*자료)/.test(st)) return true;
    return false;
  }

  function cleanOrgCandidate(raw) {
    var s0 = clean(raw)
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/[-_\s]*\((?:주|유)?\s*$/, '')
      .replace(/\s+(?:부당해고|부당징계|부당정직|부당전보|부당노동행위|구제신청|임금체불|진정사건|진정|산재사건|산재|체당금|대지급금|사건)\s*$/g, '')
      .replace(/[,\.;\)\(\-\[\]]+$/, '')
      .trim();
    /* 짝이 맞지 않는 열린 괄호 제거 */
    if (s0.indexOf('(') !== -1 && s0.indexOf(')') === -1) s0 = s0.replace(/\([^)]*$/, '').trim();
    return s0;
  }

  function extractCompanyName(text, folderHint) {
    var hint = clean(folderHint);
    var combined = (hint ? hint + ' ' : '') + clean(text);
    /* 1) [회사명] 또는 괄호 안 기관/회사명(예: 부당정직 구제신청(당진시복지재단)) 우선 탐색 */
    var mParen = combined.match(/(?:구제신청|부당해고|부당징계|부당정직|부당전보|산재|진정|체불)[^\(\n]{0,12}\(\s*([가-힣A-Za-z0-9·&㈜()]{2,22})\s*\)/);
    if (mParen) {
      var cp = cleanOrgCandidate(mParen[1]);
      if (!isNoiseOrgSegment(cp) && cp.indexOf('푸른') === -1) return cp;
    }
    /* 2) 주식회사·(주)·(유)·의료법인·사회복지법인 정식 상호 */
    var m1 = combined.match(/(\(주\)\s*[가-힣A-Za-z0-9·&\-]{2,20}|[가-힣A-Za-z0-9·&\-]{2,20}\s*\(주\)|[가-힣A-Za-z0-9·&\-]{2,20}\s*㈜|주식회사\s*[가-힣A-Za-z0-9·&\-]{2,20}|[가-힣A-Za-z0-9·&\-]{2,20}\s*주식회사|의료법인\s*[가-힣A-Za-z0-9]{2,18}|사회복지법인\s*[가-힣A-Za-z0-9]{2,18})/);
    if (m1) {
      var cand = cleanOrgCandidate(m1[1]);
      if (!isNoiseOrgSegment(cand) && cand.indexOf('푸른') === -1) return cand;
    }
    /* 3) 명시적 레이블 뒤 */
    var m2 = combined.match(/(?:피신청인|피진정인|사업장|회사명|사업주|업체)\s*[:：]\s*([가-힣A-Za-z0-9·&\-\(\)]{2,24})/);
    if (m2) {
      var c2 = cleanOrgCandidate(m2[1]);
      if (!isNoiseOrgSegment(c2) && c2.indexOf('푸른') === -1) return c2;
    }
    /* 4) 경로 세그먼트 역탐색 (사건 폴더명 위주 — 파일명·역할폴더 제외) */
    if (hint) {
      var segs = hint.split(/[\\/_]+/);
      for (var i = segs.length - 1; i >= 0; i--) {
        var seg = cleanOrgCandidate(clean(segs[i]).replace(/^\d+[\.\-\s]*/, '').replace(/\(\d{4}\)$/, ''));
        if (seg.length >= 2 && seg.length <= 24 && !isNoiseOrgSegment(seg) && seg.indexOf('푸른') === -1) {
          return seg;
        }
      }
    }
    return '';
  }

  function extractParties(text) {
    var claimants = [];
    var respondents = [];
    var seenC = {};
    var seenR = {};

    var cRe = /(?:진정인|신청인|재해자|청구인|피해근로자|고소인|원고|망)\s*[:：\-\(]?\s*([가-힣]{2,4})(?:\s|[,.\)\]님씨]|$)/g;
    var m;
    while ((m = cRe.exec(text)) !== null) {
      var nm = clean(m[1]);
      if (!STOP_PERSON_WORDS.test(nm) && !seenC[nm]) {
        seenC[nm] = 1;
        claimants.push(nm);
      }
    }
    var rRe = /(?:피진정인|피신청인|피고소인|상대방|사업주|피고)\s*[:：]?\s*([^\n,;()\[\]]{2,24})/g;
    while ((m = rRe.exec(text)) !== null) {
      var rn = clean(m[1]).replace(/\s+(등|외\s*\d+명).*$/, '');
      if (!STOP_PERSON_WORDS.test(rn) && rn.indexOf('푸른') === -1 && !seenR[rn]) {
        seenR[rn] = 1;
        respondents.push(rn);
      }
    }
    return { claimants: claimants, respondents: respondents };
  }

  function parseCaseSignals(input) {
    input = input || {};
    var text = [
      clean(input.relPath),
      clean(input.folderHint),
      clean(input.name),
      clean(input.subject),
      clean(input.body).slice(0, 1200),
      arr(input.attachmentNames).join(' ')
    ].join('\n');

    var caseNumbers = extractCaseNumbers(text);
    var year = extractYear(input, caseNumbers);
    var yearMonth = extractYearMonth(input, year);
    var jurisdiction = extractJurisdiction(text);
    var companyName = clean(input.companyName) || extractCompanyName(text, input.folderHint || input.relPath);
    var parties = extractParties(text);

    return {
      caseNumbers: caseNumbers,
      primaryCaseNo: caseNumbers.length ? caseNumbers[0].text : '',
      year: year,
      yearMonth: yearMonth,
      jurisdiction: jurisdiction,
      companyName: companyName,
      companyNorm: normalizeCompanyName(companyName),
      claimants: parties.claimants,
      respondents: parties.respondents,
      claimantName: clean(input.claimantName) || (parties.claimants[0] || '')
    };
  }

  function classifyRecord(input) {
    input = input || {};
    var rel = clean(input.relPath);
    var name = clean(input.name);
    var subject = clean(input.subject);
    var body = clean(input.body).slice(0, 1800);
    var atts = arr(input.attachmentNames).join(' ');
    var text = [rel, name, subject, body, atts].join(' ');
    var lcText = text.toLowerCase();

    if (KNOWN_NOISE_PATHS.test(rel)) {
      return {
        matched: false, domain: 'ignore', subType: '', programKey: '',
        score: 0, reasons: [], exclusionReasons: ['제외 폴더 경로']
      };
    }

    var san = scoreTerms(text, SANJAE_STRONG);
    var dis = scoreTerms(text, DISMISSAL_STRONG);
    var wag = scoreTerms(text, WAGE_STRONG);
    var noi = scoreTerms(text, NOISE_EXCLUSIONS);

    var signals = parseCaseSignals(input);
    if (signals.caseNumbers.length) {
      signals.caseNumbers.forEach(function (cn) {
        if (cn.kind === 'nlrc') dis.score += 24;
        else if (cn.kind === 'agency') wag.score += 12;
        else if (cn.kind === 'court') { san.score += 6; dis.score += 8; }
      });
    }
    if (/(^|[\\\/])(5\.\s*산재|산재관련|산재사건|6\.\s*산업안전|산업안전)/i.test(rel)) san.score += 18;
    if (/(^|[\\\/])(4\.\s*노동위원회|노동위원회|부당해고|부당징계|징계)/i.test(rel)) dis.score += 18;
    if (/(^|[\\\/])(2\.\s*임금체불|2\.\s*진정사건|임금체불|진정사건|대지급금|체당금)/i.test(rel)) wag.score += 18;
    if (/(^|[\\\/])9\.\s*종료사건/.test(rel)) {
      if (san.score > 0) san.score += 6;
      if (dis.score > 0) dis.score += 6;
      if (wag.score > 0) wag.score += 6;
    }

    var maxScore = Math.max(san.score, dis.score, wag.score);
    var penalty = noi.score;
    /* 강사건 신호(사건번호 또는 핵심 키워드 2개 이상)가 있으면 단순 잡음 감점 완화 */
    if (signals.caseNumbers.length && maxScore >= 24) penalty = Math.floor(penalty * 0.4);
    var netScore = maxScore - penalty;

    if (netScore < 14 || (maxScore < 18 && !signals.caseNumbers.length)) {
      return {
        matched: false,
        domain: 'ignore',
        subType: '',
        programKey: '',
        score: netScore,
        reasons: [],
        exclusionReasons: noi.hits.length ? noi.hits : ['관련 점수 기준 미달 (' + netScore + ')'],
        signals: signals
      };
    }

    var domain = 'labor_wage';
    var reasons = wag.hits;
    if (san.score >= dis.score && san.score >= wag.score) {
      domain = 'sanjae';
      reasons = san.hits;
    } else if (dis.score >= wag.score) {
      domain = 'labor_dismissal';
      reasons = dis.hits;
    }

    /* 보낸메일/파일형식이 단순 임시·시스템 파일(.lnk/.tmp/.ini 등)이면 제외 */
    if (/\.(lnk|tmp|ini|ds_store|thumbs\.db)$/i.test(name || rel) || /^~\$/.test(name)) {
      return {
        matched: false, domain: 'ignore', subType: '', programKey: '',
        score: 0, reasons: [], exclusionReasons: ['임시/시스템 파일'], signals: signals
      };
    }

    var subType = domain === 'sanjae'
      ? detectSanjaeSubType(text)
      : detectLaborSubType(text, domain);
    var programKey = domain === 'sanjae' ? 'sanjae' : 'laborcase';

    return {
      matched: true,
      domain: domain,
      subType: subType,
      subTypeLabel: SUBTYPE_LABELS[subType] || subType,
      programKey: programKey,
      score: netScore,
      scores: { sanjae: san.score, labor_dismissal: dis.score, labor_wage: wag.score, noise: penalty },
      reasons: reasons.slice(0, 8),
      exclusionReasons: noi.hits,
      signals: signals
    };
  }

  /* ── 서류 대립축 분류(당사 대응 vs 상대방 서류 vs 판정·기관 vs 입증 vs 계약) ── */
  function classifyDocSideRole(input, ourRole) {
    input = input || {};
    ourRole = clean(ourRole) || 'unknown'; /* 'employer' | 'worker' | 'unknown' */
    var name = clean(input.name || input.title || '');
    var rel = clean(input.relPath || '');
    var subject = clean(input.subject || '');
    var text = [name, rel, subject, clean(input.snippet || input.body).slice(0, 400)].join(' ');
    var box = clean(input.box).toLowerCase();
    var sender = clean(input.from || '').toLowerCase();

    /* 호증 / 차수 파싱 */
    var exhibitMatch = text.match(/(소?[갑을병]\s*제?\s*\d+(?:-\d+)?\s*호증|호증목록|증거목록)/);
    var exhibitNo = clean(input.exhibitNo) || (exhibitMatch ? clean(exhibitMatch[1]) : '');
    var roundMatch = text.match(/(초심|재심|제?\s*\d+\s*차|추가\s*\d*차|보충\s*\d*차)/);
    var roundLabel = roundMatch ? clean(roundMatch[1]) : '';

    /* 기관 처분·판정·통지서 우선 판정 */
    var outcomeSignal = '';
    if (/(전부인정|요양승인|승인결정|구제명령|인용판정|화해성립|화해조서)/.test(text)) outcomeSignal = 'win';
    else if (/(불승인|기각결정|각하결정|범죄인지|기소의견|시정명령|이행강제금부과)/.test(text)) outcomeSignal = 'lose';
    else if (/(일부인정|일부인용|일부승인|취하)/.test(text)) outcomeSignal = 'partial';

    if (/(판정서|결정서|명령서|재결서|조서|화해권고안|화해조서|요양급여\s*결정에\s*따른\s*통지|불승인\s*결정|승인\s*통지|심사결정서|재심사재결서|심문기일통지|심문회의\s*출석통지|출석요구서|시정지시서|시정명령서|이송통지|접수증|처분사유서|사실조회서|보완요구|보정명령|체불임금등사업주확인서)/.test(text)
      && !/(초안|검토안|답변|의견서)/.test(name)) {
      return {
        side: 'agency',
        roleLabel: outcomeSignal ? '기관 판정·처분' : '공단·위원회·노동청 통지',
        exhibitNo: exhibitNo,
        roundLabel: roundLabel,
        pairKey: roundLabel || (outcomeSignal ? '최종판정' : '기관통지'),
        outcomeSignal: outcomeSignal || 'pending'
      };
    }

    /* 수임·계약·행정 */
    if (/(위임계약|위임장|수임계약|대리인선임|착수금|성공보수|세금계산서|견적서)/.test(text) && !/(답변서|이유서|진정서|의견서)/.test(name)) {
      return {
        side: 'contract',
        roleLabel: '위임·대리인·계약서류',
        exhibitNo: exhibitNo,
        roundLabel: roundLabel,
        pairKey: '수임행정',
        outcomeSignal: ''
      };
    }

    /* 명확한 상대방 태그 */
    if (/(\[상대방\]|상대방|상대측|반박서면|원처분기관\s*의견서|02_상대방)/.test(text)) {
      return {
        side: 'opponent',
        roleLabel: '상대방 제출서류',
        exhibitNo: exhibitNo,
        roundLabel: roundLabel,
        pairKey: roundLabel || (/이유서/.test(text) ? '이유-답변' : /진정서|고소장/.test(text) ? '진정-소명' : /보충/.test(text) ? '보충서면' : '상대방주장'),
        outcomeSignal: ''
      };
    }

    /* 역할 기반 대립 판단 */
    var isWorkerPaper = /(신청인[\s_\-\.\(\)\[\]]*(이유서|보충서면|준비서면|진술서)|근로자측[\s_\-\.\(\)\[\]]*(서면|이유서)|진정인[\s_\-\.\(\)\[\]]*(진정서|고소장|준비서면)|원고[\s_\-\.\(\)\[\]]*(소장|준비서면))/.test(text);
    var isEmployerPaper = /(피신청인[\s_\-\.\(\)\[\]]*(답변서|보충서면|준비서면|이유서)|회사측[\s_\-\.\(\)\[\]]*(답변서|의견서|소명자료)|사업주[\s_\-\.\(\)\[\]]*(의견서|진술서|소명서)|피진정인[\s_\-\.\(\)\[\]]*(답변서|소명서)|피고[\s_\-\.\(\)\[\]]*(답변서|준비서면))/.test(text);

    if (ourRole === 'employer') {
      if (isWorkerPaper) {
        return { side: 'opponent', roleLabel: '상대방(근로자·진정인) 서류', exhibitNo: exhibitNo, roundLabel: roundLabel, pairKey: roundLabel || '이유-답변', outcomeSignal: '' };
      }
      if (isEmployerPaper) {
        return { side: 'ours', roleLabel: '당사(사업주 대리) 대응서류', exhibitNo: exhibitNo, roundLabel: roundLabel, pairKey: roundLabel || '이유-답변', outcomeSignal: '' };
      }
    } else if (ourRole === 'worker') {
      if (isEmployerPaper) {
        return { side: 'opponent', roleLabel: '상대방(사업주·원처분청) 서류', exhibitNo: exhibitNo, roundLabel: roundLabel, pairKey: roundLabel || '이유-답변', outcomeSignal: '' };
      }
      if (isWorkerPaper) {
        return { side: 'ours', roleLabel: '당사(재해자·근로자 대리) 서류', exhibitNo: exhibitNo, roundLabel: roundLabel, pairKey: roundLabel || '이유-답변', outcomeSignal: '' };
      }
    }

    /* 당사 대응 파일·발신 메일 단서 */
    if (/(01_당사|_푸른|푸른노무법인|대응서면|소명서|검토의견|답변서|보충서면|준비서면|최후진술|심사청구서|재심사청구서|요양급여신청서|추가상병신청서|시정완료보고|대지급금청구|의견서|갑제)/.test(text)
      || box === 'sent' || /pureun|nabaho/.test(sender)) {
      return {
        side: 'ours',
        roleLabel: '당사 작성·대응·제출 서류',
        exhibitNo: exhibitNo,
        roundLabel: roundLabel,
        pairKey: roundLabel || (/답변서/.test(text) ? '이유-답변' : /심사|재심사/.test(text) ? '불복·심사' : /보충/.test(text) ? '보충서면' : '당사대응'),
        outcomeSignal: ''
      };
    }

    /* 그 외 진정서/해고통지/징계통지 등은 문맥상 상대방 공격·처분 출발 서류 */
    if (/(해고통지|징계통지|징계의결|진정서|고소장|소장|구제신청서|을제)/.test(text)) {
      var sideGuess = ourRole === 'worker' && /(진정서|고소장|소장|구제신청서)/.test(text) ? 'ours' : 'opponent';
      return {
        side: sideGuess,
        roleLabel: sideGuess === 'ours' ? '당사 최초 청구·신청' : '상대방(초기 신청·처분) 서류',
        exhibitNo: exhibitNo,
        roundLabel: roundLabel,
        pairKey: roundLabel || '이유-답변',
        outcomeSignal: ''
      };
    }

    /* 입증·기초자료 */
    return {
      side: 'evidence',
      roleLabel: '입증·사실관계 기초자료',
      exhibitNo: exhibitNo,
      roundLabel: roundLabel,
      pairKey: exhibitNo || '입증자료',
      outcomeSignal: ''
    };
  }

  /* ── 상대방 서류 ↔ 당사 대응 1:1 공방 대조표 생성 ─────────────────────── */
  function buildCounterMatrix(docs, ourRole, refDateStr) {
    var list = arr(docs).map(function (d, idx) {
      var inferred = (!d.side || !d.pairKey || !d.roundLabel || !d.exhibitNo) ? classifyDocSideRole(d, ourRole) : null;
      var role = d.side ? {
        side: d.side,
        roleLabel: d.roleLabel || (inferred && inferred.roleLabel) || '',
        exhibitNo: d.exhibitNo || (inferred && inferred.exhibitNo) || '',
        roundLabel: d.roundLabel || (inferred && inferred.roundLabel) || '',
        pairKey: d.pairKey || (inferred && inferred.pairKey) || '',
        outcomeSignal: d.outcomeSignal || (inferred && inferred.outcomeSignal) || ''
      } : inferred;
      return Object.assign({}, d, role, {
        _idx: idx,
        _date: clean(d.date || d.isoDate || (d.mtime ? new Date(d.mtime).toISOString().slice(0, 10) : '')) || '0000-00-00'
      });
    });

    list.sort(function (a, b) {
      if (a._date !== b._date) return a._date < b._date ? -1 : 1;
      return a._idx - b._idx;
    });

    var oursPool = list.filter(function (d) { return d.side === 'ours'; });
    var usedOurs = {};
    var rows = [];
    var nowMs = refDateStr ? Date.parse(refDateStr) : Date.now();
    if (!isFinite(nowMs)) nowMs = Date.now();

    function matchCounterDoc(targetDoc) {
      var best = null;
      var bestScore = -1;
      for (var i = 0; i < oursPool.length; i++) {
        var o = oursPool[i];
        var key = o.id || o._idx;
        if (usedOurs[key]) continue;
        var sc = 0;
        if (targetDoc.counterDocId && o.id === targetDoc.counterDocId) sc += 100;
        if (targetDoc.pairKey && o.pairKey && targetDoc.pairKey === o.pairKey) sc += 30;
        if (targetDoc.roundLabel && o.roundLabel && targetDoc.roundLabel === o.roundLabel) sc += 25;
        if (o._date >= targetDoc._date && targetDoc._date !== '0000-00-00') sc += 15;
        /* 쌍 키워드 보너스 */
        var tn = clean(targetDoc.name || targetDoc.title);
        var on = clean(o.name || o.title);
        if (/이유서/.test(tn) && /답변서/.test(on)) sc += 25;
        if (/보충서면/.test(tn) && /보충서면|반박/.test(on)) sc += 22;
        if (/진정서/.test(tn) && /답변서|소명|시정/.test(on)) sc += 22;
        if (/불승인|보완/.test(tn) && /심사청구|보완|의견서/.test(on)) sc += 22;
        if (/시정지시/.test(tn) && /시정완료/.test(on)) sc += 30;
        if (sc > bestScore && sc >= 15) {
          bestScore = sc;
          best = o;
        }
      }
      if (best) usedOurs[best.id || best._idx] = 1;
      return best;
    }

    var matchedCount = 0;
    var pendingCount = 0;
    var overdueCount = 0;
    var opponentCount = 0;
    var agencyCount = 0;

    list.forEach(function (d) {
      if (d.side === 'opponent' || (d.side === 'agency' && /(보완|시정지시|사실조회|불승인|출석요구)/.test(clean(d.name || d.title)))) {
        if (d.side === 'opponent') opponentCount++;
        else agencyCount++;
        var counter = matchCounterDoc(d);
        var elapsedDays = 0;
        if (d._date !== '0000-00-00') {
          var tMs = Date.parse(d._date);
          if (isFinite(tMs)) elapsedDays = Math.max(0, Math.floor((nowMs - tMs) / 86400000));
        }
        var status = counter ? 'matched' : (elapsedDays >= 14 ? 'overdue' : 'pending');
        if (status === 'matched') matchedCount++;
        else if (status === 'overdue') overdueCount++;
        else pendingCount++;
        rows.push({
          rowType: d.side === 'agency' ? 'agency_action' : 'exchange',
          roundLabel: d.roundLabel || d.pairKey || '공방',
          triggerSide: d.side,
          opponentDoc: d,
          ourDoc: counter || null,
          status: status,
          elapsedDays: elapsedDays
        });
      } else if (d.side === 'agency') {
        agencyCount++;
        rows.push({
          rowType: 'agency_ruling',
          roundLabel: d.roundLabel || d.pairKey || '판정·통지',
          triggerSide: 'agency',
          opponentDoc: d,
          ourDoc: null,
          status: 'agency_final',
          elapsedDays: 0
        });
      }
    });

    /* 짝 없이 단독으로 당사가 선제 제출한 서류(최초 요양신청, 구제신청 등) */
    oursPool.forEach(function (o) {
      var key = o.id || o._idx;
      if (usedOurs[key]) return;
      rows.push({
        rowType: 'ours_lead',
        roundLabel: o.roundLabel || o.pairKey || '당사 선제출',
        triggerSide: 'ours',
        opponentDoc: null,
        ourDoc: o,
        status: 'matched',
        elapsedDays: 0
      });
    });

    rows.sort(function (a, b) {
      var da = (a.opponentDoc && a.opponentDoc._date) || (a.ourDoc && a.ourDoc._date) || '0000-00-00';
      var db = (b.opponentDoc && b.opponentDoc._date) || (b.ourDoc && b.ourDoc._date) || '0000-00-00';
      return da < db ? -1 : da > db ? 1 : 0;
    });

    return {
      rows: rows,
      summary: {
        totalDocs: list.length,
        totalRows: rows.length,
        opponentCount: opponentCount,
        oursCount: oursPool.length,
        agencyCount: agencyCount,
        matched: matchedCount,
        pending: pendingCount,
        overdue: overdueCount
      }
    };
  }

  /* ── 메일함(IMAP mailbox/msgs + POP3 mailbox/old/msgs) 중복 제거 평탄화 ── */
  function toIsoDateTime(d) {
    if (typeof d === 'number' && isFinite(d)) {
      var dt = new Date(d);
      return isFinite(dt.getTime()) ? dt.toISOString() : '';
    }
    var st = clean(d);
    if (/^\d{10,13}$/.test(st)) {
      var num = Number(st.length === 10 ? Number(st) * 1000 : Number(st));
      var dt2 = new Date(num);
      return isFinite(dt2.getTime()) ? dt2.toISOString() : '';
    }
    return st;
  }

  function flattenMailbox(mailboxRoot) {
    var out = [];
    var seen = {};
    if (!mailboxRoot || typeof mailboxRoot !== 'object') return out;
    var folders = (mailboxRoot.folders && typeof mailboxRoot.folders === 'object') ? mailboxRoot.folders : {};

    function pushEntry(entry, slug, boxHint) {
      if (!entry || typeof entry !== 'object') return;
      var subj = clean(entry.subject != null ? entry.subject : entry.s);
      var fromName = clean(entry.f);
      var fromEmail = clean(entry.e);
      var fromFull = clean(entry.from) || (fromEmail ? (fromName ? (fromName + ' <' + fromEmail + '>') : fromEmail) : fromName);
      var toVal = clean(entry.to != null ? entry.to : entry.t);
      var dateStr = toIsoDateTime(entry.date || entry.isoDate || entry.d);
      var date19 = dateStr.slice(0, 19);
      var msgId = clean(entry.messageId || entry.msgId || '');
      var contentSig = (fromFull || date19 || subj) ? (fromFull + '|' + date19 + '|' + subj) : '';
      if ((msgId && seen['id:' + msgId]) || (contentSig && seen['sig:' + contentSig])) return;
      if (msgId) seen['id:' + msgId] = 1;
      if (contentSig) seen['sig:' + contentSig] = 1;
      var dedup = msgId || contentSig;
      var uid = entry.uid != null ? entry.uid : (entry.u != null ? entry.u : '');
      var rawKey = clean(entry.key || (slug === 'past' && uid ? String(uid) : ''));
      var id = clean(entry.id || (slug ? slug + '_' + uid : '') || rawKey || dedup).replace(/[.#$\[\]\/]/g, '_').slice(0, 120);
      var folderKind = folders[slug] && folders[slug].kind ? clean(folders[slug].kind) : '';
      var boxVal = clean(entry.box || folderKind || boxHint || (String(slug).indexOf('sent') !== -1 ? 'sent' : 'inbox'));
      var rawAtts = entry.attachments || entry.attachmentNames || entry.an;
      out.push({
        id: id || ('mail_' + out.length),
        slug: clean(slug || entry.slug || boxHint),
        uid: uid !== '' ? String(uid) : '',
        key: rawKey,
        box: boxVal,
        subject: subj,
        from: fromFull,
        to: toVal,
        date: dateStr,
        messageId: msgId,
        attachmentNames: arr(rawAtts).map(function (a) {
          return typeof a === 'string' ? clean(a) : clean(a && (a.filename || a.name));
        }).filter(Boolean),
        bodyPreview: clean(entry.snippet || entry.preview || entry.text || entry.p).slice(0, 600)
      });
    }

    /* 구조 1: RTDB 실제 운영 스키마 mailbox.msgs[slug][uid] */
    if (mailboxRoot.msgs && typeof mailboxRoot.msgs === 'object') {
      Object.keys(mailboxRoot.msgs).forEach(function (slug) {
        var bucket = mailboxRoot.msgs[slug];
        if (!bucket || typeof bucket !== 'object') return;
        Object.keys(bucket).forEach(function (uid) {
          var item = bucket[uid];
          if (item && typeof item === 'object') {
            pushEntry(Object.assign({ uid: uid }, item), slug, slug);
          }
        });
      });
    }

    /* 구조 2: POP3 지난메일 mailbox.old.msgs[key] */
    if (mailboxRoot.old && mailboxRoot.old.msgs && typeof mailboxRoot.old.msgs === 'object') {
      Object.keys(mailboxRoot.old.msgs).forEach(function (key) {
        var item = mailboxRoot.old.msgs[key];
        if (item && typeof item === 'object') {
          pushEntry(Object.assign({ key: key, uid: item.u != null ? item.u : key }, item), 'past', 'past');
        }
      });
    }

    /* 구조 3: 하위 호환 — 레거시/직접 평탄 객체 ({slug}/msgs/{uid} 등) */
    Object.keys(mailboxRoot).forEach(function (k) {
      if (k === 'folders' || k === 'msgs' || k === 'old') return;
      var v = mailboxRoot[k];
      if (!v || typeof v !== 'object') return;
      if (v.msgs && typeof v.msgs === 'object') {
        Object.keys(v.msgs).forEach(function (uid) {
          pushEntry(Object.assign({}, v.msgs[uid], { uid: uid, slug: k }), k, k);
        });
      } else if (v.subject || v.s || v.from || v.f || v.date || v.d) {
        pushEntry(Object.assign({}, v, { key: k }), v.slug || 'past', v.box || 'past');
      } else {
        Object.keys(v).forEach(function (subk) {
          var row2 = v[subk];
          if (row2 && typeof row2 === 'object' && (row2.subject || row2.s || row2.from || row2.f || row2.date || row2.d)) {
            pushEntry(Object.assign({}, row2, { key: subk }), k, k);
          }
        });
      }
    });

    out.sort(function (a, b) {
      var da = clean(a.date);
      var db = clean(b.date);
      return da > db ? -1 : da < db ? 1 : 0;
    });
    return out;
  }

  /* ── 다축 뷰 생성(연도별 · 기업중심 · 당사자중심 · 판정/결과중심) ─────── */
  function buildMultiAxisViews(casesList) {
    var list = arr(casesList).filter(function (c) { return c && !c._deleted; });
    var byYearMap = {};
    var byCompanyMap = {};
    var byPartyMap = {};
    var byRulingList = [];

    list.forEach(function (c) {
      var yr = String(c.year || (clean(c.receiveDate).slice(0, 4)) || '미상');
      if (!byYearMap[yr]) byYearMap[yr] = { year: yr, count: 0, openCount: 0, docCount: 0, pendingCounter: 0, cases: [] };
      byYearMap[yr].count++;
      if (!/(종결|확정|취하|취소)/.test(clean(c.status))) byYearMap[yr].openCount++;
      byYearMap[yr].docCount += arr(c.docs).length;
      byYearMap[yr].cases.push(c);

      var coKey = clean(c.companyId) || ('nm_' + (normalizeCompanyName(c.companyName) || '미연결'));
      var coTitle = clean(c.companyName) || '(업체 미지정·근로자 의뢰)';
      if (!byCompanyMap[coKey]) {
        byCompanyMap[coKey] = {
          companyKey: coKey, companyId: clean(c.companyId), companyName: coTitle,
          count: 0, docCount: 0, openCount: 0, latestDate: '', cases: []
        };
      }
      byCompanyMap[coKey].count++;
      byCompanyMap[coKey].docCount += arr(c.docs).length;
      if (!/(종결|확정)/.test(clean(c.status))) byCompanyMap[coKey].openCount++;
      if (clean(c.receiveDate) > byCompanyMap[coKey].latestDate) byCompanyMap[coKey].latestDate = clean(c.receiveDate);
      byCompanyMap[coKey].cases.push(c);

      var pName = clean(c.claimantName || (arr(c.claimants)[0])) || '당사자 미상';
      var pKey = pName + '|' + (normalizeCompanyName(c.companyName) || '-');
      if (!byPartyMap[pKey]) {
        byPartyMap[pKey] = { partyKey: pKey, partyName: pName, companyName: coTitle, count: 0, domains: {}, cases: [] };
      }
      byPartyMap[pKey].count++;
      byPartyMap[pKey].domains[clean(c.subTypeLabel || c.subType || c.domain)] = 1;
      byPartyMap[pKey].cases.push(c);

      if (clean(c.rulingResult) || clean(c.rulingDate) || arr(c.docs).some(function (d) { return d.side === 'agency'; })) {
        byRulingList.push(c);
      }
    });

    var byYear = Object.keys(byYearMap).sort(function (a, b) { return b.localeCompare(a); }).map(function (k) { return byYearMap[k]; });
    var byCompany = Object.keys(byCompanyMap).map(function (k) { return byCompanyMap[k]; })
      .sort(function (a, b) { return b.count - a.count || a.companyName.localeCompare(b.companyName, 'ko'); });
    var byParty = Object.keys(byPartyMap).map(function (k) {
      var it = byPartyMap[k];
      it.domainSummary = Object.keys(it.domains).join(' · ');
      return it;
    }).sort(function (a, b) { return b.count - a.count || a.partyName.localeCompare(b.partyName, 'ko'); });

    return {
      byYear: byYear,
      byCompany: byCompany,
      byParty: byParty,
      byRuling: byRulingList
    };
  }

  /* ── 개인정보·민감본문·절대경로 비식별 & 저장 위생 ─────────────────────── */
  function maskRrnText(text) {
    return s(text).replace(/(\d{6})\s*[-‐‑–—]\s*([1-8]\d{6})/g, '$1-*******')
      .replace(/(\d{6})([1-8]\d{6})/g, '$1*******');
  }
  function maskAccountText(text) {
    return s(text).replace(/\b(\d{2,4})-(\d{2,6})-(\d{3,7})\b/g, '$1-***-$3');
  }
  function maskPhoneText(text) {
    return s(text).replace(/(^|[^0-9])(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?=$|[^0-9])/g, '$1$2-$3-****');
  }
  function maskEmailText(text) {
    return s(text).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '***@***');
  }
  function stripOsAbsPaths(val) {
    var st = clean(val);
    if (!st) return '';
    if (/^([A-Za-z]:\\|\\\\[^\\]+\\|\/Users\/|\/home\/)/.test(st)) return '';
    return st;
  }

  function sanitizeDocMeta(doc) {
    if (!doc || typeof doc !== 'object') return null;
    return {
      id: clean(doc.id || ('doc_' + Date.now())),
      title: maskAccountText(maskPhoneText(maskRrnText(clean(doc.title || doc.name)))),
      name: maskAccountText(maskPhoneText(maskRrnText(clean(doc.name || doc.title)))),
      ext: clean(doc.ext).toLowerCase(),
      date: clean(doc.date || doc.isoDate).slice(0, 10),
      side: clean(doc.side) || 'evidence',
      roleLabel: clean(doc.roleLabel),
      exhibitNo: clean(doc.exhibitNo),
      roundLabel: clean(doc.roundLabel),
      pairKey: clean(doc.pairKey),
      counterDocId: clean(doc.counterDocId),
      outcomeSignal: clean(doc.outcomeSignal),
      sha256: clean(doc.sha256),
      size: Number(doc.size) || 0,
      sourceOrigin: clean(doc.sourceOrigin), /* 'D' | 'NAS' | 'PC' | 'mail' | 'manual' */
      archiveRelPath: stripOsAbsPaths(doc.archiveRelPath).replace(/\\/g, '/')
    };
  }

  function sanitizeMailLink(m) {
    if (!m || typeof m !== 'object') return null;
    return {
      id: clean(m.id),
      slug: clean(m.slug),
      uid: m.uid != null ? String(m.uid) : '',
      key: clean(m.key),
      box: clean(m.box),
      date: clean(m.date).slice(0, 19),
      subject: maskEmailText(maskAccountText(maskPhoneText(maskRrnText(clean(m.subject))))).slice(0, 200),
      attachmentNames: arr(m.attachmentNames).map(function (a) {
        return maskEmailText(maskAccountText(maskPhoneText(maskRrnText(clean(a)))));
      }).slice(0, 30)
      /* ⚠ 메일 본문(preview/body/text) 및 송수신 이메일 주소(from/to)는 공유 원장에 저장하지 않는다 */
    };
  }

  function sanitizeForSave(rec) {
    var out = Object.assign({}, rec || {});
    delete out.preview;
    delete out.body;
    delete out.rawBody;
    delete out.secretMemo;
    delete out.statementText;
    delete out.sourcePath;
    delete out.localAbsPath;
    out.title = maskAccountText(maskPhoneText(maskRrnText(clean(out.title))));
    out.summary = maskAccountText(maskPhoneText(maskRrnText(clean(out.summary)))).slice(0, 400);
    if (out.archiveRelPath) out.archiveRelPath = stripOsAbsPaths(out.archiveRelPath).replace(/\\/g, '/');
    if (Array.isArray(out.docs)) {
      out.docs = out.docs.map(sanitizeDocMeta).filter(Boolean);
    }
    if (Array.isArray(out.mailLinks)) {
      out.mailLinks = out.mailLinks.map(sanitizeMailLink).filter(Boolean);
    }
    if (Array.isArray(out.managerSubs)) {
      out.managerSubs = out.managerSubs.map(function (x) { return clean(x); }).filter(function (x) {
        return /^[A-Za-z0-9_-]{1,20}$/.test(x);
      }).slice(0, 5);
    }
    out.managerMain = /^[A-Za-z0-9_-]{1,20}$/.test(clean(out.managerMain)) ? clean(out.managerMain) : '';
    return out;
  }

  return {
    ARCHIVE_DOCS_STANDARD_FOLDERS: ARCHIVE_DOCS_STANDARD_FOLDERS,
    SUBTYPE_LABELS: SUBTYPE_LABELS,
    classifyRecord: classifyRecord,
    parseCaseSignals: parseCaseSignals,
    extractCaseNumbers: extractCaseNumbers,
    extractCompanyName: extractCompanyName,
    normalizeCompanyName: normalizeCompanyName,
    extractJurisdiction: extractJurisdiction,
    extractParties: extractParties,
    classifyDocSideRole: classifyDocSideRole,
    buildCounterMatrix: buildCounterMatrix,
    flattenMailbox: flattenMailbox,
    buildMultiAxisViews: buildMultiAxisViews,
    maskRrnText: maskRrnText,
    maskAccountText: maskAccountText,
    maskPhoneText: maskPhoneText,
    maskEmailText: maskEmailText,
    sanitizeDocMeta: sanitizeDocMeta,
    sanitizeMailLink: sanitizeMailLink,
    sanitizeForSave: sanitizeForSave
  };
});
