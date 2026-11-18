/* ══ 계약서·견적서 원스톱 자동 정리 · 간결 선택 · 지난 계약 검토 · 구두(음성) 입력 · 창조적 계약서 생성 모듈 (2026-11-18) ══
   ■ 핵심 역할
     1) parseBrief(text)                     : 한 줄 메모·문의글·구두 음성에서 회사명·대표자·사업자번호·금액·한글금액·부가세·기간·인원·담당 자동 추출
     2) searchAll(q, forms, sets)            : 6개 분류 전체 양식 + 27개 하위 세트 전수 통합 검색
     3) recommendBundle(text, forms, sets)   : 업무 키워드/프리셋으로 필요한 견적서+계약서+위임장 묶음 자동 추천
     4) startVoiceInput(handlers, Rec)       : 브라우저 내장 SpeechRecognition(ko-KR) 구두 입력 (브라우저 음성 서버 고지·동의 + 주민번호 발화 금지 안내 및 즉시 가림)
     5) composeCreativeBundle / draftCreativeBundle : 기존 양식에 없는 새로운 맞춤형 계약서·견적서·위임장 창조 생성 (강화 비식별 PuAiCall + 무과금 즉시 합성 폴백)
     6) templatizeText / buildStandardTemplate : 기존 문서 {{변수}} 원클릭 변환 및 조항 체크 10초 표준 조립
     7) openQuickMakeModal(ctx)              : 간결 1~2줄 업무 선택 + 옆 견적/계약/위임장 체크 + 지난 계약 검토 + 구두 입력 + 창조적 계약 생성 원스톱 모달
     8) openEasyFormWizard(ctx)              : 파일 변환 · 10초 조항 조립 · 구두/AI 창조 양식 만들기 마법사

   ■ 절대 준수 규칙
     - 실시간 DB 직접 쓰기 금지 (호출 측이 주입한 콜백만 사용, 채우기 초안은 메모리로만 전달)
     - 미입력 금액·기간을 '0'이나 임의 기본값으로 채우지 않는다 (빈칸 서식 밑줄 보존)
     - 주민등록번호는 본문·파일명·음성인식·AI 프롬프트 전 구간에서 비소비 전방탐색으로 가린다
     - 외부 AI 호출(PuAiCall) 전에는 거래처명·대표자·사업자번호·주민번호·연락처를 모두 {{변수}}로 비식별화한다
     - 소송촉진법 기준 지연이자 문구는 '연 12%의 이자'만 사용한다
     - 푸른 디자인 시스템 27색 팔레트만 사용한다 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.PuContractEasy = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function (w) {
  'use strict';

  var PROPOSAL_GROUP = '제안서·견적서';

  /* ── 대표 업무 22종 프리셋 (핵심 8종은 1~2줄 간략 칩으로 노출, 나머지 14종은 바로 옆 선택상자로 제공) ── */
  var WORK_PRESETS = [
    { id: 'advisory', core: true, shortLabel: '상시 노무자문', label: '상시 노무자문', icon: '🏢', kind: 'company', setId: 'fs-advisory',
      sub: '자문계약서 + 노무자문 견적서 + CMS 신청서',
      re: /상시\s*자문|노무\s*자문|자문\s*계약|월\s*자문|고문\s*노무/ },
    { id: 'payroll', core: true, shortLabel: '급여·4대보험', label: '임금·4대보험 급여대행', icon: '💰', kind: 'company', setId: 'fs-payroll',
      sub: '급여위임계약 + 견적서 + 4대보험·EDI 위임장',
      re: /급여\s*(관리|대행|위임|아웃소싱)|임금\s*대장|페이롤|4대\s*보험\s*대행/ },
    { id: 'harass', core: true, shortLabel: '괴롭힘·성희롱 조사', label: '직장내괴롭힘·성희롱 조사', icon: '🔍', kind: 'company', setId: 'fs-harass',
      sub: '조사 견적서 + 조사 위탁계약서 + 비밀서약서',
      re: /직장\s*내\s*괴롭힘|괴롭힘\s*조사|성희롱\s*조사|고충\s*조사|객관적\s*조사|사실\s*조사/ },
    { id: 'bargain', core: true, shortLabel: '임금·단체교섭', label: '임금·단체교섭 대행', icon: '🤝', kind: 'company', setId: 'fs-bargain',
      sub: '교섭 견적서 + 위임계약서 + 교섭권 위임장',
      re: /단체\s*교섭|임금\s*교섭|임단협|단체\s*협약|교섭\s*(위임|대행)|노사\s*교섭/ },
    { id: 'rules', core: true, shortLabel: '취업규칙·규정', label: '취업규칙·인사규정 정비', icon: '📘', kind: 'company', setId: 'fs-rules',
      sub: '규정 정비 견적서 + 제·개정 위탁계약서',
      re: /취업\s*규칙|인사\s*규정|복무\s*규정|보수\s*규정|규정\s*(정비|개정|제정)/ },
    { id: 'case_dismiss', core: true, shortLabel: '부당해고·징계 사건', label: '부당해고·징계 구제 사건', icon: '⚖', kind: 'case', setId: 'fs-case-dismiss',
      sub: '사건 견적서 + 부당해고 위임약정서 + 대리인 위임장',
      re: /부당\s*해고|부당\s*징계|부당\s*전보|구제\s*신청|해고\s*사건/ },
    { id: 'consulting_hr', core: true, shortLabel: '인사·원가 컨설팅', label: '인사노무·직무·임금 컨설팅', icon: '📊', kind: 'consulting', setId: 'fs-consulting-hr',
      sub: '컨설팅 제안·견적서 + 컨설팅 용역계약서',
      re: /직무\s*분석|임금\s*체계|평가\s*제도|노무\s*진단|조직\s*진단|인사\s*컨설팅|노무\s*컨설팅|컨설팅/ },
    { id: 'change', core: true, shortLabel: '계약 변경·연장', label: '계약 변경·연장·갱신', icon: '🔄', kind: 'company', setId: 'fs-amend',
      sub: '변경·연장 합의서 + 견적서 + 자문계약서',
      re: /변경\s*합의|계약\s*(변경|연장|갱신)|보수\s*(인상|조정)|재계약/ },
    { id: 'agency', core: false, shortLabel: '보험사무대행·EDI', label: '보험사무대행·EDI', icon: '🏛', kind: 'company', setId: 'fs-office',
      sub: '고용산재 사무위탁 + 건강·연금 EDI 위임장',
      re: /사무\s*대행|보험\s*사무|edi\s*위임|고용\s*산재\s*위탁/i },
    { id: 'union', core: false, shortLabel: '노동조합 자문', label: '노동조합 자문', icon: '🚩', kind: 'company', setId: 'fs-union',
      sub: '노조 자문계약서 + 자문 견적서',
      re: /노동\s*조합\s*자문|노조\s*자문/ },
    { id: 'costing', core: false, shortLabel: '입찰·인건비 원가산정', label: '입찰·인건비 원가산정', icon: '🧮', kind: 'company', setId: 'fs-costing',
      sub: '원가산정 견적서(원본) + 용역계약서',
      re: /원가\s*산정|인건비\s*산정|용역\s*원가|입찰\s*원가/ },
    { id: 'opinion', core: false, shortLabel: '법률의견서·노무검토', label: '법률의견서·노무검토', icon: '⚖', kind: 'company', setId: 'fs-opinion',
      sub: '의견서 견적서 + 작성 약정서',
      re: /법률\s*의견서|노무\s*의견서|의견서\s*작성|법률\s*검토/ },
    { id: 'case_wage', core: false, shortLabel: '임금체불·대지급금', label: '임금체불·대지급금 사건', icon: '👷', kind: 'case', setId: 'fs-case-wage',
      sub: '사건 견적서 + 임금체불 위임약정서 + 대리인 위임장',
      re: /임금\s*체불|체불\s*진정|퇴직금\s*체불|체당금|대지급금/ },
    { id: 'case_ind', core: false, shortLabel: '산재·유족·장해급여', label: '산재·유족·장해급여 사건', icon: '🏥', kind: 'case', setId: 'fs-case-ind',
      sub: '산재 견적서 + 산재 위임약정서 + 위임장',
      re: /산재|산업\s*재해|요양\s*급여|장해\s*급여|유족\s*급여|업무상\s*질병/ },
    { id: 'case_harass', core: false, shortLabel: '괴롭힘·성희롱 사건대리', label: '괴롭힘·성희롱 사건 대리', icon: '🛡', kind: 'case', setId: 'fs-case-harass',
      sub: '사건 대리 위임약정서 + 대리인 위임장 + 견적서',
      re: /(괴롭힘|성희롱).*(대리|위임|피해자|신고\s*사건)/ },
    { id: 'case_ulab', core: false, shortLabel: '부당노동행위·노동위', label: '부당노동행위·노동위 사건', icon: '🏛', kind: 'case', setId: 'fs-case-ulabor',
      sub: '부당노동행위 위임약정서 + 위임장 + 견적서',
      re: /부당\s*노동\s*행위|교섭\s*단위|공정\s*대표/ },
    { id: 'consulting_safety', core: false, shortLabel: '산업안전·중대재해 컨설팅', label: '산업안전·중대재해 컨설팅', icon: '⛑', kind: 'consulting', setId: 'fs-consulting-safety',
      sub: '안전보건 견적서 + 중대재해·위험성평가 용역계약서',
      re: /중대\s*재해|산업\s*안전|안전\s*보건|위험성\s*평가/ },
    { id: 'consulting_dispatch', core: false, shortLabel: '불법파견·사내하도급', label: '불법파견·사내하도급 진단', icon: '🔗', kind: 'consulting', setId: 'fs-consulting-dispatch',
      sub: '도급·파견 진단 견적서 + 컨설팅 계약서',
      re: /불법\s*파견|사내\s*하도급|위장\s*도급|파견\s*진단/ },
    { id: 'fund_setup', core: false, shortLabel: '근로복지기금 설립', label: '사내근로복지기금 설립', icon: '🏦', kind: 'fund', setId: 'fs-fund-company',
      sub: '기금 설립 제안·견적서 + 설립 위탁계약서 + 위임장',
      re: /사내\s*근로\s*복지\s*기금|기금\s*설립|복지\s*기금/ },
    { id: 'fund_joint', core: false, shortLabel: '공동기금 운영·지원사업', label: '공동기금 운영·지원사업', icon: '🤝', kind: 'fund', setId: 'fs-fund-joint',
      sub: '공동기금 운영·결산 계약서 + 제안서',
      re: /공동\s*근로\s*복지\s*기금|공동\s*기금/ },
    { id: 'other_edu', core: false, shortLabel: '법정의무·노동법 강의', label: '법정의무·노동법 교육·강의', icon: '🎓', kind: 'other', setId: 'fs-edu',
      sub: '교육·특강 견적서 + 강의 위탁계약서',
      re: /교육|강의|특강|설명회|워크숍/ },
    { id: 'consult_note', core: false, shortLabel: '일회성 노무상담·자문확인', label: '일회성 노무상담·자문확인', icon: '📞', kind: 'consult', setId: 'fs-consult',
      sub: '상담 확인서 + 법률검토 약정서 + 견적서',
      re: /노무\s*상담|방문\s*상담|전화\s*상담|상담\s*확인/ }
  ];

  var PRESET_SORTED = WORK_PRESETS.slice().sort(function (a, b) {
    var pa = (a.id === 'consulting_safety' || a.id === 'consulting_dispatch') ? 0 : (a.id === 'consulting_hr' ? 2 : 1);
    var pb = (b.id === 'consulting_safety' || b.id === 'consulting_dispatch') ? 0 : (b.id === 'consulting_hr' ? 2 : 1);
    return pa - pb;
  });

  function isQuoteForm(f) {
    if (!f) return false;
    if (f.groupName === PROPOSAL_GROUP) return true;
    return /견적서|제안서/.test(f.name || '');
  }

  function isPowerForm(f) {
    if (!f || isQuoteForm(f)) return false;
    var nm = String(f.name || '');
    if (/위임계약|위임약정|용역계약|자문계약|합의서/.test(nm)) return false;
    return /위임장|신청서|자동이체|CMS|확인서|서약서|동의서/i.test(nm);
  }

  /* 양식 1건의 3분류 역할: 'quote' | 'contract' | 'power' */
  function classifyDocRole(f) {
    if (isQuoteForm(f)) return 'quote';
    if (isPowerForm(f)) return 'power';
    return 'contract';
  }

  /* 숫자 → 한글 금액 표기 (계약서 위변조 방지 표기: 10,000,000 → '일천만', 4,400,000 → '사백사십만') */
  function numToKorWon(num) {
    var n = Math.floor(Math.abs(Number(num) || 0));
    if (!n || !isFinite(n)) return '';
    var digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    var small = ['', '십', '백', '천'];
    var big = ['', '만', '억', '조'];
    var parts = [], unitIdx = 0;
    while (n > 0 && unitIdx < big.length) {
      var chunk = n % 10000;
      if (chunk > 0) {
        var s = '', c = chunk;
        for (var i = 0; i < 4 && c > 0; i++) {
          var d = c % 10;
          if (d > 0) s = digits[d] + small[i] + s;
          c = Math.floor(c / 10);
        }
        parts.unshift(s + big[unitIdx]);
      }
      n = Math.floor(n / 10000);
      unitIdx++;
    }
    return parts.join('');
  }

  function commaNum(n) {
    var v = Math.round(Number(n) || 0);
    if (!v || !isFinite(v)) return '';
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function parseSubChunk(chunk) {
    var r = String(chunk || ''), sum = 0, hit = false;
    var mc = /(\d+(?:\.\d+)?)천/.exec(r);
    if (mc) { sum += parseFloat(mc[1]) * 1000; hit = true; r = r.slice(mc.index + mc[0].length); }
    var mb = /(\d+(?:\.\d+)?)백/.exec(r);
    if (mb) { sum += parseFloat(mb[1]) * 100; hit = true; r = r.slice(mb.index + mb[0].length); }
    var ms = /(\d+(?:\.\d+)?)십/.exec(r);
    if (ms) { sum += parseFloat(ms[1]) * 10; hit = true; r = r.slice(ms.index + ms[0].length); }
    var md = /^(\d+(?:\.\d+)?)$/.exec(r);
    if (md) { sum += parseFloat(md[1]); hit = true; }
    return hit ? sum : 0;
  }

  /* 한국어 금액 표현 파싱: '440만원', '1000만원', '1,000만원', '1천5백만원', '55만5천원', '5천원', '1억원', '3,300,000원' → 숫자(원). 없으면 null */
  function parseKoreanMoney(frag) {
    var s = String(frag || '').replace(/\s+/g, '').replace(/,/g, '');
    if (!s) return null;
    if (/[억천백십만]/.test(s)) {
      var total = 0, matched = false, rest = s;
      var mEok = /(\d+(?:\.\d+)?)억/.exec(rest);
      if (mEok) {
        total += Math.round(parseFloat(mEok[1]) * 100000000);
        matched = true;
        rest = rest.slice(mEok.index + mEok[0].length);
      }
      var mMan = /((?:\d+(?:\.\d+)?[천백십]?)+)만/.exec(rest);
      if (mMan) {
        var manVal = parseSubChunk(mMan[1]);
        if (manVal > 0) {
          total += Math.round(manVal * 10000);
          matched = true;
        }
        rest = rest.slice(mMan.index + mMan[0].length);
      }
      var mSub = /((?:\d+(?:\.\d+)?[천백십])+\d*)원?/.exec(rest);
      if (mSub) {
        var subVal = parseSubChunk(mSub[1]);
        if (subVal > 0) {
          total += Math.round(subVal);
          matched = true;
        }
        rest = rest.slice(mSub.index + mSub[0].length);
      } else {
        var mTail = /^(\d+)원?$/.exec(rest);
        if (mTail && matched) total += Number(mTail[1]);
      }
      return matched && total > 0 ? total : null;
    }
    var mExact = /^(\d{4,})원?$/.exec(s) || /(\d{4,})원/.exec(s);
    if (mExact) {
      var raw = Number(mExact[1]);
      if (raw >= 1000) return raw;
    }
    return null;
  }

  function normYmd(y, mo, d) {
    var yy = String(y).length === 2 ? ('20' + y) : String(y);
    var mm = ('0' + Number(mo)).slice(-2);
    var dd = ('0' + Number(d)).slice(-2);
    return yy + '-' + mm + '-' + dd;
  }

  /* ── 기존 문안·입력 → 주민등록번호 철저 가림 (하이픈·공백 구분·무하이픈·7번째 자리 0~9·연속 나열까지 비소비 전방탐색으로 모두 가림) ── */
  var RRN_HEAD = '\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])';
  var RE_RRN_HYPHEN = new RegExp('(^|[^0-9])(' + RRN_HEAD + '\\s*[-–—]\\s*\\d{7})(?![0-9])', 'g');
  var RE_RRN_SPACE = new RegExp('(^|[^0-9])(' + RRN_HEAD + '\\s+\\d{7})(?![0-9])', 'g');
  var RE_RRN_PLAIN = new RegExp('(^|[^0-9])(' + RRN_HEAD + '\\d{7})(?![0-9])', 'g');

  function maskRrnSafe(s) {
    var t = String(s == null ? '' : s);
    if (w && w.PuRrnMask && typeof w.PuRrnMask.maskRrnInText === 'function') {
      t = w.PuRrnMask.maskRrnInText(t).text;
    }
    return t
      .replace(RE_RRN_HYPHEN, '$1******-*******')
      .replace(RE_RRN_SPACE, '$1******-*******')
      .replace(RE_RRN_PLAIN, '$1******-*******');
  }

  /* ── 한 줄 메모 / 카톡·메일 문의글 / 구두 음성 → 항목 일괄 자동 추출 ──
     ⚠ 빈 값은 절대 0원·기본값으로 채우지 않는다(서식 밑줄 유지 규칙). */
  function parseBrief(text) {
    var src = maskRrnSafe(String(text || '').trim());
    var out = { values: {}, presetId: '', setId: '', docScope: 'all', notes: [] };
    if (!src) return out;

    /* 1) 문서 범위 (견적서만 / 계약서만 / 전체) */
    if (/견적서?\s*만|견적\s*먼저|견적\s*초안/.test(src) && !/계약서\s*도|계약\s*함께/.test(src)) out.docScope = 'quote';
    else if (/(계약서|위임장|약정서)\s*만/.test(src)) out.docScope = 'contract';

    /* 2) 업무 프리셋 매칭 */
    for (var i = 0; i < PRESET_SORTED.length; i++) {
      if (PRESET_SORTED[i].re.test(src)) {
        out.presetId = PRESET_SORTED[i].id;
        out.setId = PRESET_SORTED[i].setId;
        break;
      }
    }

    var V = out.values;

    /* 3) 사업자등록번호 */
    var mBz = /\b(\d{3}-\d{2}-\d{5})\b/.exec(src);
    if (mBz && mBz[1] !== '312-81-52792') V['사업자번호'] = mBz[1];

    /* 4) 부가세 별도/포함 */
    if (/(부가세|vat)\s*별도/i.test(src)) V['부가세처리'] = '부가세 별도';
    else if (/(부가세|vat)\s*포함/i.test(src)) V['부가세처리'] = '부가세 포함';

    /* 5) 계약기간 / 시작일~종료일 */
    var mRange = /(20\d{2}|\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})일?\s*(?:~|-|–|부터)\s*(20\d{2}|\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})일?/.exec(src);
    if (mRange) {
      V['계약시작일'] = normYmd(mRange[1], mRange[2], mRange[3]);
      V['계약종료일'] = normYmd(mRange[4], mRange[5], mRange[6]);
      V['계약기간'] = V['계약시작일'] + ' ~ ' + V['계약종료일'];
    } else {
      var mDur = /(\d+\s*(?:개월|주|년|일)(?:\s*간)?)/.exec(src);
      if (mDur && !/연\s*\d+%/.test(mDur[0])) V['계약기간'] = mDur[1].replace(/\s+/g, '');
    }

    /* 6) 대상인원 / 기준인원 */
    var mStaff = /(?:대상\s*인원|상시\s*근로자|근로자|직원|인원)?\s*(\d{1,5})\s*(명|인)(?=\s|$|[,.)/])/.exec(src);
    if (mStaff) {
      V['대상인원'] = mStaff[1] + '명';
      V['기준인원'] = mStaff[1];
    }

    /* 7) 착수금 · 성공보수 · 일반 계약/견적 금액 */
    var mRetainer = /(?:착수금|선금)\s*[:：]?\s*([0-9,.\s억천백십만원]+?)(?=\s|$|[,/]|성공|잔금|중도금|부가세)/.exec(src);
    if (mRetainer) {
      var retAmt = parseKoreanMoney(mRetainer[1]);
      if (retAmt) V['착수금'] = commaNum(retAmt);
    }
    var mSuccPct = /성공\s*보수(?:율)?\s*[:：]?\s*(\d{1,2}(?:\.\d+)?\s*%)/.exec(src);
    if (mSuccPct) {
      V['성공보수율'] = mSuccPct[1].replace(/\s+/g, '');
      V['성공보수'] = '수령금(경제적 이익)의 ' + V['성공보수율'];
    } else {
      var mSuccAmt = /성공\s*보수\s*[:：]?\s*([0-9,.\s억천백십만원]+?)(?=\s|$|[,/]|부가세)/.exec(src);
      if (mSuccAmt) {
        var sAmt = parseKoreanMoney(mSuccAmt[1]);
        if (sAmt) V['성공보수'] = '금 ' + commaNum(sAmt) + '원';
      }
    }

    var cleanedForAmt = src.replace(/(?:착수금|선금)\s*[:：]?\s*[0-9,.\s억천백십만원]+/g, ' ').replace(/성공\s*보수\s*[:：]?\s*[0-9,.\s억천백십만원%]+/g, ' ');
    var mAmt = /(?:(?:월|자문료|보수|견적|금액|수수료|용역비|강의료|상담료)\s*[:：]?\s*)?((?:[\d,]+(?:\.\d+)?\s*억\s*)?(?:[\d,]+\s*천\s*)?(?:[\d,]+\s*백\s*)?[\d,]+(?:\.\d+)?\s*만(?:\s*[\d,]+\s*천)?(?:\s*[\d,]+\s*백)?(?:\s*\d+)?\s*원?|[\d,]+(?:\.\d+)?\s*억\s*원?|[\d,]+\s*천(?:\s*[\d,]+\s*백)?\s*원|[\d,]{5,}\s*원)/.exec(cleanedForAmt);
    if (mAmt) {
      var mainAmt = parseKoreanMoney(mAmt[1]);
      if (mainAmt) {
        V['계약금액'] = commaNum(mainAmt);
        V['견적금액'] = commaNum(mainAmt);
        V['계약금액한글'] = numToKorWon(mainAmt);
      }
    } else if (V['착수금'] && !V['계약금액']) {
      var rNum = Number(V['착수금'].replace(/,/g, ''));
      V['계약금액'] = V['착수금'];
      V['견적금액'] = V['착수금'];
      if (rNum) V['계약금액한글'] = numToKorWon(rNum);
    }

    /* 8) 대표자 · 근로자 · 담당노무사 명시 패턴 */
    var mCeo = /대표(?:자|이사)?\s*[:：]?\s*([가-힣]{2,5})/.exec(src);
    if (mCeo) V['대표자'] = mCeo[1];
    var mWorker = /(?:근로자|신청인|피해자|재해자)\s*[:：]?\s*([가-힣]{2,5})/.exec(src);
    if (mWorker) {
      V['근로자명'] = mWorker[1];
      V['근로자이름'] = mWorker[1];
    }
    var mMgr = /(?:담당\s*노무사|주담당|담당)\s*[:：]?\s*([가-힣]{2,4})(?:\s*노무사)?/.exec(src);
    if (mMgr) V['주담당'] = mMgr[1];

    /* 9) 회사명 추출 */
    var mCoExplicit = /(?:회사명?|사업장|의뢰처|수신|거래처)\s*[:：]\s*([^\n,·/]+?)(?=\s+(?:대표|사업자|직장|임금|급여|노무|자문|취업|인사|산재|부당|괴롭힘|컨설팅|\d)|[,·/\n]|$)/.exec(src);
    if (mCoExplicit) {
      V['회사명'] = mCoExplicit[1].trim();
    } else {
      var mCorp = /((?:\(주\)|주식회사|㈜|\(유\)|\(사\)|\(재\)|의료법인|사회복지법인|학교법인)\s*[가-힣A-Za-z0-9]{1,20}|[가-힣A-Za-z0-9]{1,20}\s*(?:\(주\)|주식회사|㈜)|[가-힣A-Za-z0-9]{2,16}(?:상사|산업|물산|테크|전자|건설|병원|요양원|어린이집|학원|조합|협회|공단|공사|재단|코퍼레이션|솔루션|시스템|바이오|제약|운수|물류|푸드|개발|그룹|홀딩스))/.exec(src);
      if (mCorp && !/푸른노무법인/.test(mCorp[1])) {
        V['회사명'] = mCorp[1].trim();
      }
    }

    /* 10) 과업내용 기본 요약 */
    if (out.presetId) {
      var pObj = WORK_PRESETS.filter(function (p) { return p.id === out.presetId; })[0];
      if (pObj) V['과업내용'] = pObj.label;
    }

    return out;
  }

  /* ── 브라우저 내장 구두(음성) 입력기 (SpeechRecognition ko-KR) ──
     ⚠ 주의: 푸른 자체 AI 서버로는 오디오를 보내지 않으나, Chrome·Edge·Safari 등 브라우저 내장 SpeechRecognition은
       브라우저 제공사(Google·Microsoft·Apple 등) 음성 인식 서버를 거쳐 글자로 변환된다.
       따라서 최초 사용 시 서버 음성 인식 사실을 안내·동의받고 주민등록번호·계좌번호 발화 금지 경고를 표시하며,
       변환된 글자에서도 주민번호를 즉시 가린다. */
  var _voiceConsented = false;
  var SPEECH_ERR_KO = {
    'not-allowed': '마이크 권한이 꺼져 있습니다 — 주소창 자물쇠에서 마이크를 허용하거나 키보드 음성 입력(Win+H / 🎤)을 써 주세요.',
    'service-not-allowed': '이 기기에서는 브라우저 음성 인식을 쓸 수 없습니다 — 키보드 음성 입력(Win+H / 🎤)으로 말씀해 주세요.',
    'no-speech': '말씀이 들리지 않았습니다 — 다시 [🎙 구두 입력]을 눌러 말씀해 주세요.',
    'audio-capture': '연결된 마이크를 찾지 못했습니다 — 마이크 연결을 확인하거나 키보드 🎤 버튼을 써 주세요.',
    'network': '음성 인식 연결이 고르지 않습니다 — 잠시 후 다시 시도하거나 키보드 🎤 버튼을 써 주세요.',
    'aborted': ''
  };

  function speechSupported(Rec) {
    return !!(Rec || (w && (w.SpeechRecognition || w.webkitSpeechRecognition)));
  }

  function startVoiceInput(handlers, Rec) {
    handlers = handlers || {};
    var Ctor = Rec || (w && (w.SpeechRecognition || w.webkitSpeechRecognition));
    if (typeof Ctor !== 'function') {
      if (handlers.onError) {
        handlers.onError('이 브라우저에서는 내장 마이크 인식을 지원하지 않습니다 — 입력칸을 누른 뒤 키보드 음성 입력(Windows: Win+H / 휴대폰: 자판 🎤)으로 바로 말씀하실 수 있습니다.');
      }
      return null;
    }
    if (!_voiceConsented) {
      var askConsent = handlers.confirm || (w && typeof w.confirm === 'function' ? w.confirm.bind(w) : null);
      if (!askConsent) {
        if (handlers.onError) handlers.onError('음성 입력 안내·동의 확인 창을 열 수 없어 음성 인식을 시작하지 않았습니다.');
        return null;
      }
      var agreed = askConsent('🎙 구두(음성) 입력 안내\n\n음성 인식은 사용 중인 브라우저(Chrome·Edge·Safari 등)의 음성 인식 서비스를 통해 글자로 변환됩니다.\n⚠ 주민등록번호·계좌번호 등 민감 고유식별정보는 말로 부르지 마세요.\n\n음성 입력을 시작할까요?');
      if (!agreed) {
        if (handlers.onError) handlers.onError('음성 입력을 취소했습니다 — 글자로 직접 입력해 주세요.');
        return null;
      }
      _voiceConsented = true;
    }
    var rec;
    try { rec = new Ctor(); } catch (_) {
      if (handlers.onError) handlers.onError('음성 인식을 시작할 수 없습니다.');
      return null;
    }
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    var stopped = false;

    rec.onresult = function (ev) {
      if (stopped) return;
      var txt = '', fin = true;
      var list = (ev && ev.results) || [];
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        txt += (r && r[0] && r[0].transcript) || '';
        if (!r || !r.isFinal) fin = false;
      }
      var safe = scrubVoiceTranscript(txt.trim());
      if (handlers.onText) handlers.onText(safe, fin);
    };
    rec.onerror = function (ev) {
      var code = String((ev && ev.error) || '');
      var msg = Object.prototype.hasOwnProperty.call(SPEECH_ERR_KO, code)
        ? SPEECH_ERR_KO[code]
        : ('음성 인식 오류 (' + code + ')');
      if (msg && handlers.onError) handlers.onError(msg);
    };
    rec.onend = function () {
      stopped = true;
      if (handlers.onEnd) handlers.onEnd();
    };
    try {
      rec.start();
    } catch (_) {
      if (handlers.onError) handlers.onError('음성 인식을 시작하지 못했습니다.');
      return null;
    }
    return {
      stop: function () {
        stopped = true;
        try { rec.stop(); } catch (_) {}
      }
    };
  }

  function joinSpokenText(prev, spoken) {
    var a = String(prev || '').trim(), b = maskRrnSafe(String(spoken || '').trim());
    if (!b) return a;
    return a ? (a + ' ' + b) : b;
  }

  /* ── 6개 분류 전수 통합 검색 ── */
  function searchAll(query, forms, sets) {
    var raw = String(query || '').trim().toLowerCase();
    var activeForms = (forms || []).filter(function (f) { return f && f.closed !== true; });
    if (!raw) return { forms: activeForms, sets: sets || [], presets: WORK_PRESETS };
    var tokens = raw.split(/\s+/).filter(Boolean);

    function scoreText(hayName, haySub) {
      var n = String(hayName || '').toLowerCase();
      var b = String(haySub || '').toLowerCase();
      var s = 0;
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i];
        if (n.indexOf(tk) >= 0) s += (n.indexOf(tk) === 0 ? 12 : 8);
        else if (b.indexOf(tk) >= 0) s += 3;
        else return 0;
      }
      return s;
    }

    var matchedSets = (sets || []).map(function (st) {
      return { item: st, sc: scoreText(st.name, st.desc || '') };
    }).filter(function (x) { return x.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc; })
      .map(function (x) { return x.item; });

    var matchedPresets = WORK_PRESETS.filter(function (p) {
      return scoreText(p.label, p.sub) > 0 || p.re.test(raw);
    });

    var setBoostIds = {};
    matchedSets.forEach(function (st) {
      (Array.isArray(st.formIds) ? st.formIds : Object.values(st.formIds || {})).forEach(function (fid) { setBoostIds[fid] = true; });
    });

    var matchedForms = activeForms.map(function (f) {
      var sc = scoreText(f.name, (f.groupName || '') + ' ' + String(f.body || '').slice(0, 600));
      if (!sc && setBoostIds[f.id]) sc = 2;
      return { item: f, sc: sc };
    }).filter(function (x) { return x.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc; })
      .map(function (x) { return x.item; });

    return { forms: matchedForms, sets: matchedSets, presets: matchedPresets };
  }

  function listOf(x) {
    if (Array.isArray(x)) return x.filter(Boolean);
    return x && typeof x === 'object' ? Object.keys(x).sort(function (a, b) { return (+a) - (+b); }).map(function (k) { return x[k]; }).filter(Boolean) : [];
  }

  /* ── 업무 텍스트 / 프리셋 ID → 추천 세트 및 체크 양식 목록 결정 ──
     scope: 'all'(견적+계약+부속) | 'quote'(견적서만) | 'contract'(계약서·위임장만)
     또는 객체 { quote: bool, contract: bool, power: bool } */
  function recommendBundle(inputOrPresetId, forms, sets, scopeOverride) {
    var activeForms = (forms || []).filter(function (f) { return f && f.closed !== true && f.enabled !== false; });
    var byId = {};
    activeForms.forEach(function (f) { byId[f.id] = f; });

    var preset = WORK_PRESETS.filter(function (p) { return p.id === inputOrPresetId; })[0] || null;
    var parsed = preset ? { presetId: preset.id, setId: preset.setId, docScope: 'all', values: {} } : parseBrief(inputOrPresetId);
    if (!preset && parsed.presetId) {
      preset = WORK_PRESETS.filter(function (p) { return p.id === parsed.presetId; })[0] || null;
    }

    var roleFilter = null;
    var scope = (typeof scopeOverride === 'string' && scopeOverride) ? scopeOverride : (parsed.docScope || 'all');
    if (scopeOverride && typeof scopeOverride === 'object') {
      roleFilter = {
        quote: !!scopeOverride.quote,
        contract: !!scopeOverride.contract,
        power: !!scopeOverride.power
      };
    }

    var chosenSet = null;
    if (preset && preset.setId) {
      chosenSet = (sets || []).filter(function (s) { return s && s.id === preset.setId; })[0] || null;
    }
    if (!chosenSet && inputOrPresetId) {
      var sr = searchAll(inputOrPresetId, activeForms, sets);
      if (sr.sets.length) chosenSet = sr.sets[0];
    }
    if (!chosenSet && (sets || []).length) chosenSet = sets[0];

    var setFormList = chosenSet
      ? listOf(chosenSet.formIds).map(function (id) { return byId[id]; }).filter(Boolean)
      : [];

    var baseList = setFormList.length ? setFormList : searchAll(inputOrPresetId, activeForms, sets).forms.slice(0, 6);
    var checked = baseList.filter(function (f) {
      var role = classifyDocRole(f);
      if (roleFilter) return !!roleFilter[role];
      if (scope === 'quote') return role === 'quote';
      if (scope === 'contract') return role !== 'quote';
      return true;
    });
    if (!checked.length && !roleFilter) checked = baseList.slice();

    return {
      preset: preset,
      scope: scope,
      set: chosenSet,
      forms: baseList,
      checkedIds: checked.map(function (f) { return f.id; }),
      parsed: parsed
    };
  }

  function escapeRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function templatizeText(rawText, hints) {
    hints = hints || {};
    var t = String(rawText == null ? '' : rawText);
    var count = 0;
    function rep(re, to) {
      t = t.replace(re, function () { count++; return to; });
    }

    /* 1) 주민등록번호(하이픈·공백 구분·무하이픈·연속 나열 모두) → {{주민번호}} 및 잔여 패턴 가림 */
    t = t.replace(RE_RRN_HYPHEN, function (_m, p1) {
      count++;
      return p1 + '{{주민번호}}';
    }).replace(RE_RRN_SPACE, function (_m, p1) {
      count++;
      return p1 + '{{주민번호}}';
    }).replace(RE_RRN_PLAIN, function (_m, p1) {
      count++;
      return p1 + '{{주민번호}}';
    });
    t = maskRrnSafe(t);

    /* 2) 사용자 지정 단어(예전 회사명·대표자·근로자명·주소·과업내용·담당노무사) 우선 치환 */
    var pairs = [
      [hints.oldCompany, '{{회사명}}'],
      [hints.oldCeo, '{{대표자}}'],
      [hints.oldWorker, '{{근로자명}}'],
      [hints.oldAddr, '{{주소}}'],
      [hints.oldScope, '{{과업내용}}'],
      [hints.oldManager, '{{주담당}}']
    ];
    pairs.forEach(function (pair) {
      var needle = String(pair[0] || '').trim();
      if (needle.length >= 2 && needle !== '푸른노무법인' && needle !== '권형하') {
        rep(new RegExp(escapeRegExp(needle), 'g'), pair[1]);
      }
    });

    /* 3) 사업자등록번호 (푸른노무법인 고유 사업자번호 312-81-52792 는 보존!) */
    t = t.replace(/\b(\d{3}-\d{2}-\d{5})\b/g, function (m) {
      if (m === '312-81-52792') return m;
      count++;
      return '{{사업자번호}}';
    });

    /* 4) 날짜 범위 */
    rep(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일|\.)?\s*(?:~|–|-|부터)\s*(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일|\.)?(?:까지)?/g,
      '{{계약시작일}} ~ {{계약종료일}}');

    /* 5) 단일 날짜 */
    rep(/20\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, '{{계약일}}');
    rep(/\b20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\.?/g, '{{계약일}}');
    rep(/\b20\d{2}-\d{2}-\d{2}\b/g, '{{계약일}}');

    /* 6) 금액 표현 */
    rep(/일금\s*[가-힣]+원정\s*\(\s*[₩\\]?\s*[\d,]+\s*원?\s*\)/g, '일금 {{계약금액한글}}원정 (₩{{계약금액}})');
    rep(/금\s*[\d,]{5,}\s*원/g, '금 {{계약금액}}원');
    rep(/[₩\\]\s*[\d,]{5,}/g, '₩{{계약금액}}');
    rep(/\b\d{1,3}(?:,\d{3}){1,3}\s*원/g, '{{계약금액}}원');

    var varsFound = [];
    var seen = {};
    var vre = /\{\{([^{}\s]+)\}\}/g, vm;
    while ((vm = vre.exec(t)) !== null) {
      if (!seen[vm[1]]) { seen[vm[1]] = true; varsFound.push(vm[1]); }
    }
    return { text: t, replacedCount: count, vars: varsFound };
  }

  /* ── 제목·본문으로 양식 분류(kind) · 그룹 · 하위 세트 자동 추론 ── */
  function guessFormMeta(name, body, sets) {
    var combined = (String(name || '') + ' ' + String(body || '').slice(0, 500)).trim();
    var isQuote = /견적서|제안서/.test(name || '');
    var preset = null;
    for (var i = 0; i < PRESET_SORTED.length; i++) {
      if (PRESET_SORTED[i].re.test(combined)) { preset = PRESET_SORTED[i]; break; }
    }
    var kind = preset ? preset.kind : 'company';
    if (!preset) {
      if (/위임약정|구제신청|진정|고소|심판|재심|피해근로자/.test(combined)) kind = 'case';
      else if (/컨설팅|진단|연구용역/.test(combined)) kind = 'consulting';
      else if (/복지기금|사내기금|공동기금/.test(combined)) kind = 'fund';
      else if (/강의|교육|특강|위원/.test(combined)) kind = 'other';
      else if (/상담/.test(combined)) kind = 'consult';
    }
    if (isQuote && (kind === 'case' || kind === 'consult')) kind = 'other';

    var groupName = '';
    if (kind === 'company' || kind === 'consulting' || kind === 'fund' || kind === 'other') {
      groupName = isQuote ? PROPOSAL_GROUP : '계약서';
    } else if (kind === 'case') {
      if (/체당금|대지급금/.test(combined)) groupName = '체당금';
      else if (/체불|임금/.test(combined)) groupName = '체불';
      else if (/해고|전보/.test(combined)) groupName = '부해등';
      else if (/징계/.test(combined)) groupName = '징계';
      else if (/산재|요양|장해|유족/.test(combined)) groupName = '산재등';
      else if (/안전|중대재해/.test(combined)) groupName = '산안';
      else if (/부당노동|노조|쟁의/.test(combined)) groupName = '노사';
      else if (/괴롭힘|성희롱|조사/.test(combined)) groupName = '조사';
      else if (/행정심판|행심/.test(combined)) groupName = '행심';
      else groupName = '기타';
    }

    var side = '';
    if (kind === 'case') {
      if (/\{\{근로자|근로자측|\(근로자\)/.test(combined)) side = 'worker';
      else if (/사용자측|\(사용자\)|위임인\s*:\s*\{\{회사명\}\}/.test(combined)) side = 'employer';
      else side = 'both';
    }

    var setId = preset ? preset.setId : '';
    if (setId && Array.isArray(sets) && sets.length && !sets.some(function (s) { return s && s.id === setId; })) {
      setId = '';
    }
    return { kind: kind, groupName: groupName, side: side, isQuote: isQuote, setId: setId };
  }

  /* ── 파일 없이 체크박스만으로 표준 계약서·견적서·위임약정서 본문 10초 조립 ──
     ⚠ 지연이자 문구는 소송촉진법 기준 '연 12%의 이자'만 사용한다(tests/contract-rate-12.test.js). */
  function buildStandardTemplate(spec) {
    spec = spec || {};
    var docType = spec.docType || 'contract';
    var title = String(spec.title || '').trim() || (docType === 'quote' ? '표준 견적서' : docType === 'case' ? '사건 위임약정서' : docType === 'agree' ? '계약 변경·연장 합의서' : '업무 위탁계약서');
    var c = Object.assign({
      scope: true, period: true, fee: true, successFee: docType === 'case',
      autoRenew: docType === 'contract', materials: true, nda: true,
      lateInterest: docType === 'case', account: true, lawyers: docType === 'case'
    }, spec.clauses || {});

    if (docType === 'quote') {
      var qLines = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '              견   적   서 (' + title + ')',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        '■ 수 신: {{회사명}} 귀중 (사업자번호: {{사업자번호}} / 담당: {{담당자}})',
        '■ 발 신: 푸른노무법인 (사업자번호: 312-81-52792 / 대표노무사: 권형하)',
        '■ 일 자: {{계약일}}',
        ''
      ];
      var qNo = 1;
      if (c.scope) qLines.push((qNo++) + '. 과 업 명: {{과업내용}} (대상인원: {{대상인원}})');
      if (c.period) qLines.push((qNo++) + '. 수행기간: {{계약기간}}');
      if (c.fee) qLines.push((qNo++) + '. 견적금액: 일금 {{계약금액한글}}원정 (₩{{계약금액}} / {{부가세처리}})');
      if (c.successFee) qLines.push((qNo++) + '. 성공보수 조건: {{성공보수}}');
      qLines.push((qNo++) + '. 담당노무사: {{주담당}}');
      qLines.push('');
      qLines.push('[세부 수행 범위]');
      qLines.push('  - 관련 노동관계법령·판례·행정해석 정밀 검토 및 실무 자문');
      qLines.push('  - 과업 수행 결과물 작성·제출 및 후속 이행 지원');
      qLines.push('');
      if (c.account) qLines.push('※ 입금계좌: 하나은행 680-910005-45904 (예금주: 푸른노무법인)');
      qLines.push('※ 본 견적의 유효기간은 발행일로부터 30일입니다.');
      qLines.push('');
      qLines.push('                    푸 른 노 무 법 인  대표노무사 권 형 하 (인)');
      return qLines.join('\n') + '\n';
    }

    if (docType === 'case') {
      var kLines = [
        '              ' + title,
        '',
        '   위임인 {{회사명}}(대표자 {{대표자}} / 또는 근로자 {{근로자명}})은 수임인 푸른노무법인에게',
        '   아래 사건의 법률 대리 및 서면 작성·출석 업무 일체를 위임하고 다음과 같이 약정한다.',
        ''
      ];
      var art = 1;
      if (c.scope) kLines.push('제' + (art++) + '조 【위임 사건】\n   {{과업내용}}');
      if (c.fee) kLines.push('제' + (art++) + '조 【착수 보수】\n   금 {{계약금액}}원 ({{부가세처리}})을 위임약정 체결 시 지급한다.');
      if (c.successFee) {
        var lateTxt = c.lateInterest ? ' (지급 지체 시 지급기일 다음날부터 연 12%의 이자를 가산한다)' : '';
        kLines.push('제' + (art++) + '조 【성공 보수】\n   사건 처리 결과 목적을 달성(승소·인용·화해·합의 등 포함)한 때에는 {{성공보수}}를 지급한다.' + lateTxt);
      }
      if (c.materials) kLines.push('제' + (art++) + '조 【자료 제출 및 협조】\n   위임인은 사건 수행에 필요한 사실관계 및 증빙자료를 성실히 제공하며, 수임인은 제공된 자료 범위 내에서 책임을 진다.');
      if (c.nda) kLines.push('제' + (art++) + '조 【비밀 유지】\n   수임인은 직무상 알게 된 위임인의 비밀을 정당한 사유 없이 외부에 누설하지 아니한다.');
      if (c.lawyers) kLines.push('제' + (art++) + '조 【담당 공인노무사】\n   {{공인노무사명단}}');
      if (c.account) kLines.push('\n※ 입금계좌: 하나은행 680-910005-45904 [푸른노무법인]');
      kLines.push('', '                              {{계약일}}', '',
        '   위임인: {{회사명}} {{대표자}} / {{근로자명}} (인)  [{{주소}}]',
        '   수임인: 푸른노무법인  대표노무사 권형하 (인)  [충남 천안시 서북구 원두정8길 6, 두정빌딩 3층 301호]');
      return kLines.join('\n') + '\n';
    }

    var lines = [
      '              ' + title,
      '',
      '                                                     계약번호: {{계약번호}}',
      '',
      '   {{회사명}} (이하 "갑"이라 한다)과 푸른노무법인 (이하 "을"이라 한다)은',
      '   신의와 성실의 원칙에 따라 다음과 같이 계약을 체결한다.',
      ''
    ];
    var no = 1;
    if (c.scope) lines.push('제' + (no++) + '조 【위탁 과업 및 범위】\n   ① 과업내용: {{과업내용}}\n   ② 대상규모: {{대상인원}}');
    if (c.period) {
      var renewTxt = c.autoRenew ? '\n   ② 계약 만료 1개월 전까지 별도의 서면 해지 통보가 없는 경우 동일 조건으로 1년간 자동 연장된다.' : '';
      lines.push('제' + (no++) + '조 【계약 기간】\n   ① 수행기간은 {{계약기간}} ({{계약시작일}} ~ {{계약종료일}})로 한다.' + renewTxt);
    }
    if (c.fee) {
      var succLine = c.successFee ? '\n   ② 성과·추가 약정 보수: {{성공보수}}' : '';
      var lateLine = c.lateInterest ? '\n   ③ 보수 지급을 지체한 때에는 지급기일 다음날부터 연 12%의 이자를 가산한다.' : '';
      lines.push('제' + (no++) + '조 【보수 및 지급방법】\n   ① 갑은 을에게 위탁보수로 금 {{계약금액}}원 ({{부가세처리}})을 지급한다.' + succLine + lateLine);
    }
    if (c.materials) lines.push('제' + (no++) + '조 【자료 제공 및 협조】\n   갑은 을이 업무를 원활히 수행할 수 있도록 관련 자료 제출 및 현업 면담에 협조하며, 을은 갑이 제공한 자료 범위 내에서 책임을 진다.');
    if (c.nda) lines.push('제' + (no++) + '조 【비밀 유지】\n   갑과 을은 본 계약 수행 과정에서 알게 된 상대방의 영업비밀 및 개인정보를 계약 종료 후에도 제3자에게 누설하지 아니한다.');
    lines.push('제' + (no++) + '조 【수행 담당】\n   책임 수행 노무사: {{주담당}}' + (c.lawyers ? ' (수임 공인노무사단: {{공인노무사명단}})' : ''));
    if (c.account) lines.push('\n   ※ 입금계좌: 하나은행 680-910005-45904 [푸른노무법인]');
    lines.push('', '                              {{계약일}}', '',
      '   갑(위탁자)  상 호: {{회사명}} (사업자번호: {{사업자번호}})',
      '               주 소: {{주소}}',
      '               대표자: {{대표자}}                              (인)',
      '',
      '   을(수탁자)  상 호: 푸른노무법인 (사업자번호: 312-81-52792)',
      '               주 소: 충남 천안시 서북구 원두정8길 6, 두정빌딩 3층 301호',
      '               대표자: 권 형 하                                (인)');
    return lines.join('\n') + '\n';
  }

  /* ══ 창조적 새 계약서·견적서·위임장 설계 엔진 (무과금 즉시 합성 + 비식별 PuAiCall 고도화) ══
     ⚠ 외부 AI 호출 전에는 모든 회사명(다중 상호·ERP 상호)·직함 앞뒤 인명·무호칭 인명·사업자번호·주민번호·전화번호(+82/무하이픈/일반전화)·계좌번호(2~3마디/연속숫자)·주소를 비식별화하고,
        사람이 확인(confirmSend)했을 때만 외부 전송한다. */
  var NON_NAME_WORDS = /^(?:푸른노무법인|권형하|인사|총무|노무|재무|회계|영업|생산|안전|근로자|사용자|위임인|수임인|노동조합|노조|현장|본사|사내|외부|전담|담당|공동|각자|부대표|대표자|담당자|대상자|관계자|책임자|신청인|피해자|재해자|의뢰인|당사자|위원회|노동청|사업장|기숙사|외국인|내국인|기간제|단시간|일용직|계약직|파견직|정규직|비정규|교대제|사업주|경영진|임직원|관리자|실무자|근로시간|근로조건|취업규칙|인사규정|단체교섭|단체협약|계약서|견적서|합의서|위임장|약정서|확인서|보고서|의견서|퇴직금|착수금|부가세|수수료|자문료|용역비)$/;

  function anonymizeCreativeInput(raw, hints) {
    hints = hints || {};
    var s = maskRrnSafe(String(raw || ''));
    var pairs = [
      [hints.coName, '{{회사명}}'],
      [hints.oldCompany, '{{회사명}}'],
      [hints.ceo, '{{대표자}}'],
      [hints.worker, '{{근로자명}}'],
      [hints.addr, '{{주소}}']
    ];
    (hints.knownCompanies || []).forEach(function (nm) {
      if (nm && String(nm).trim().length >= 2) pairs.push([nm, '{{회사명}}']);
    });
    (hints.knownPeople || []).forEach(function (nm) {
      if (nm && String(nm).trim().length >= 2) pairs.push([nm, '{{대표자}}']);
    });
    pairs.forEach(function (p) {
      var needle = String(p[0] || '').trim();
      if (needle.length >= 2 && needle !== '푸른노무법인' && needle !== '권형하') {
        s = s.replace(new RegExp(escapeRegExp(needle), 'g'), p[1]);
      }
    });

    /* 1) 문장 안 모든 법인·상호 패턴 반복 비식별화 (첫 번째뿐 아니라 '다나테크', '라마정밀' 등 전체) */
    s = s.replace(/(?:\(주\)|주식회사|㈜|\(유\)|\(사\)|\(재\)|의료법인|사회복지법인|학교법인)\s*[가-힣A-Za-z0-9]{1,20}|[가-힣A-Za-z0-9]{1,20}\s*(?:\(주\)|주식회사|㈜)|[가-힣A-Za-z0-9]{2,16}(?:상사|산업|물산|테크|전자|건설|병원|요양원|어린이집|학원|공단|공사|재단|코퍼레이션|솔루션|시스템|바이오|제약|운수|물류|푸드|그룹|홀딩스|정밀|기계|화학|금속|전기|통신|모터스|에너지|엔지니어링|파트너스)/g, function (m) {
      return /푸른노무법인/.test(m) ? m : '{{회사명}}';
    });

    /* 2) 직함이 앞에 오는 모든 인명 ('부대표 이영희', '대표 홍길동', '근로자 김철수' 등 반복 치환) */
    s = s.replace(/(부대표|공동대표|각자대표|대표이사|대표자?|병원장|원장|소장|센터장|지점장|공장장|이사장|이사|본부장|실장|부장|차장|과장|팀장|대리|주임|근로자|신청인|피해자|재해자|의뢰인|당사자)\s*[:：]?\s*([가-힣]{2,4})(?=[\s,.)/]|과|와|이|가|은|는|을|를|의|에게|$)/g, function (m, role, nm) {
      if (NON_NAME_WORDS.test(nm)) return m;
      var tok = /근로자|신청인|피해자|재해자/.test(role) ? '{{근로자명}}' : (/대표|원장|소장|이사장/.test(role) ? '{{대표자}}' : '{{담당자}}');
      return role + ' ' + tok;
    });

    /* 3) 직함·호칭이 뒤에 오는 인명 ('박팀장', '이영희 부대표', '김철수 씨' 등) */
    s = s.replace(/(^|[\s,(/])([가-힣]{1,4})(\s*(?:부대표|공동대표|각자대표|대표이사|대표자?|병원장|원장|소장|이사|부장|차장|과장|팀장|실장|대리|주임|근로자|신청인|피해자|재해자|의뢰인|씨|님))(?=[\s,.)/]|과|와|이|가|은|는|을|를|의|에게|$)/g, function (m, pre, nm, suf) {
      if (NON_NAME_WORDS.test(nm) || (nm === '부' && /^대표/.test(suf.trim()))) return m;
      return pre + '{{담당자}}' + suf;
    });

    /* 4) 호칭 없는 병렬·주격 인명 ('홍길동과 이영희가', '김철수는' 등 흔한 성씨 3자 성명) */
    var SUR = '김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구라민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편';
    var reBarePair = new RegExp('([' + SUR + '][가-힣]{2})(?:(과|와)\\s+([' + SUR + '][가-힣]{2}))(?=[가-힣\\s,.)/]|$)', 'g');
    s = s.replace(reBarePair, function (m, n1, conj, n2) {
      var a = NON_NAME_WORDS.test(n1) ? n1 : '{{당사자}}';
      var b = NON_NAME_WORDS.test(n2) ? n2 : '{{당사자}}';
      return a + conj + ' ' + b;
    });
    var reBareSubj = new RegExp('(^|[\\s,(/])([' + SUR + '][가-힣]{2})(?=(?:이|가|은|는|을|를|에게)\\s)', 'g');
    s = s.replace(reBareSubj, function (m, pre, nm) {
      return NON_NAME_WORDS.test(nm) ? m : (pre + '{{당사자}}');
    });

    /* 5) 사업자번호 · 국제/휴대/일반 전화번호(무하이픈·공백 모두) · 이메일 · 2~3마디/연속숫자 계좌번호 · 시/군/구 주소 비식별화 */
    s = s.replace(/\b(\d{3}-\d{2}-\d{5})\b/g, function (m) { return m === '312-81-52792' ? m : '{{사업자번호}}'; });
    s = s.replace(/(^|[^0-9])((?:\+82[\s.-]?0?|0)(?:1[016-9]|2|[3-6][1-5]|70|50\d?)[\s.-]?\d{3,4}[\s.-]?\d{4})(?![0-9])/g, '$1{{담당자연락처}}');
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '{{담당자이메일}}');
    s = s.replace(/(?:국민|신한|우리|하나|농협|기업|카카오|토스|SC|제일|씨티|대구|부산|경남|광주|전북|제주|새마을|신협|우체국|수협)\s*(?:은행|뱅크)?\s*[\d\-–—\s]{8,22}/g, function (m) {
      return /680-910005-45904/.test(m) ? m : '[계좌번호]';
    });
    s = s.replace(/\b(\d{2,6}[-–—]\d{2,6}[-–—]\d{4,8})\b/g, function (m) {
      if (m === '312-81-52792' || m === '680-910005-45904' || /^20\d{2}-\d{2}-\d{2}$/.test(m)) return m;
      return '[계좌번호]';
    });
    s = s.replace(/\b(\d{2,6}[-–—]\d{5,11})\b/g, '[계좌번호]');
    s = s.replace(/(^|[^0-9,])(\d{9,14})(?![0-9,]|\s*(?:원|만원|억원))/g, '$1[계좌번호]');
    /* 광역시·도 포함 주소 및 시·군·구로 바로 시작하는 주소('천안시 서북구 두정로 10') 모두 비식별화 */
    s = s.replace(/(?:(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)(?:특별시|광역시|특별자치시|특별자치도|도)?\s+)?(?:[가-힣]{1,8}(?:시|군|구)\s+){1,3}[가-힣0-9\s\-]{1,24}(?:로|길|번길|동|읍|면|리)\s*\d[\d\-호층\s]*/g, function (m) {
      return /원두정8길/.test(m) ? m : '{{주소}}';
    });
    return s;
  }

  /* 음성 인식 텍스트에서도 주민번호·계좌·전화번호를 즉시 가린다 */
  function scrubVoiceTranscript(txt) {
    var s = maskRrnSafe(String(txt || ''));
    s = s.replace(/(^|[^0-9])((?:\+82[\s.-]?0?|0)(?:1[016-9]|2|[3-6][1-5]|70|50\d?)[\s.-]?\d{3,4}[\s.-]?\d{4})(?![0-9])/g, '$1[연락처]');
    s = s.replace(/\b(\d{2,6}[-–—]\d{5,11})\b/g, '[계좌번호]');
    return s;
  }

  function enforceLegalTextRules(text) {
    var s = maskRrnSafe(String(text || ''));
    /* AI 생성물의 지연이자·연체이율을 소송촉진법 기준 연 12%로 정규화 */
    s = s.replace(/연\s*\d+(?:\.\d+)?\s*%\s*의?\s*(?:지연\s*)?(?:이자|손해금|연체료)/g, '연 12%의 이자');
    s = s.replace(/(지연\s*이자|지연\s*손해금|연체\s*이율|연체\s*이자|연체료)([^\n.]{0,24}?)연\s*(?!12(?:\.0+)?\s*%)\d+(?:\.\d+)?\s*%/g, '$1$2연 12%');
    s = s.replace(/연\s*(?!12(?:\.0+)?\s*%)\d+(?:\.\d+)?\s*%\s*(?:를|을)?\s*가산/g, '연 12%의 이자를 가산');
    /* AI 환각 등으로 법인 공식 계좌 외 임의 은행 계좌가 들어오면 공식 계좌로 교정 */
    s = s.replace(/(?:국민|신한|우리|하나|농협|기업|카카오|토스|SC|제일|씨티|대구|부산|경남|광주|전북|제주|새마을|신협|우체국|수협)\s*(?:은행|뱅크)?\s*[\d\-–—]{8,22}/g, function (m) {
      return /680-910005-45904/.test(m) ? m : '하나은행 680-910005-45904';
    });
    return s;
  }

  function extractCreativeTopic(desc, hints) {
    var clean = anonymizeCreativeInput(desc, hints || {})
      .replace(/(?:부대표|공동대표|각자대표|대표이사|대표자?|원장|소장|팀장|부장|차장|과장|실장|대리|주임|근로자|신청인|피해자|재해자|의뢰인|당사자)\s*\{\{[^{}]+\}\}/g, ' ')
      .replace(/\{\{[^{}]+\}\}\s*(?:부대표|공동대표|각자대표|대표이사|대표자?|원장|소장|팀장|부장|차장|과장|실장|대리|주임|근로자|신청인|피해자|재해자|의뢰인|당사자|씨|님)?/g, ' ')
      .replace(/\[계좌번호\]|\*{6}-\*{7}/g, ' ')
      .replace(/(?:부가세\s*(?:별도|포함)|착수금|성공보수|선금|잔금|중도금|계약서|견적서|위임장|만들어\s*줘|부탁드립니다|작성)/g, ' ')
      .replace(/\b\d[\d,.\s]*(?:억|천|백|만|원|명|개월|주|년|%|일)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!clean) return '맞춤 인사노무 용역';
    return clean.length > 40 ? clean.slice(0, 40).trim() : clean;
  }

  /* 공용 양식함에 영구 등록할 때는 양식 이름과 본문 모두에서 거래처·인명·연락처·일회성 특약을 비식별·변수화 */
  function sanitizeFormForSharedSave(fm, hints) {
    var copy = JSON.parse(JSON.stringify(fm));
    var cleanName = anonymizeCreativeInput(copy.name || '', hints || {})
      .replace(/\{\{[^{}]+\}\}|\[계좌번호\]|\*{6}-\*{7}/g, ' ')
      .replace(/\s+/g, ' ').trim();
    copy.name = (cleanName || '맞춤 표준 양식').slice(0, 120);
    var s = anonymizeCreativeInput(copy.body || '', hints || {});
    s = s.replace(/(【맞춤 특약사항】\n\s*당사자 간 구두·사전 협의에 따라 다음 사항을 특약으로 정한다\.\n)(?:\s*-\s*[^\n]+\n?)+/g,
      '$1   - 세부 과업 및 협의 특약: {{과업내용}}\n');
    s = s.replace(/(\[협의·특기사항\]\n)(?:\s*-\s*[^\n]+\n?)+/g,
      '$1  - 세부 협의 조건: {{과업내용}}\n');
    copy.body = s;
    return copy;
  }

  function composeCreativeBundle(spec) {
    spec = spec || {};
    var rawDesc = [spec.subject || '', spec.brief || '', spec.verbalNotes || ''].filter(Boolean).join(' ').trim();
    var safeDesc = anonymizeCreativeInput(rawDesc, spec.hints || {});
    var topic = String(spec.subject || '').trim()
      ? extractCreativeTopic(spec.subject, spec.hints || {})
      : extractCreativeTopic(rawDesc, spec.hints || {});
    var meta = guessFormMeta(topic, safeDesc, []);
    var isCase = meta.kind === 'case';
    var wantQuote = spec.wantQuote !== false;
    var wantContract = spec.wantContract !== false;
    var wantPower = !!spec.wantPower;
    var today = (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();

    /* 문맥 기반 맞춤형 조항 자동 설계 */
    var deliverables = [];
    if (/조사|실태|진단|점검/.test(safeDesc)) deliverables.push('객관적 사실·실태 조사 및 법적 검토 의견 보고서');
    if (/규정|규칙|매뉴얼|지침|제도|설계|개편/.test(safeDesc)) deliverables.push('맞춤형 인사·노무 규정(제도) 설계안 및 실무 운영 매뉴얼');
    if (/교육|강의|설명회|워크숍/.test(safeDesc)) deliverables.push('임직원·관리자 대상 맞춤형 교육 교안 및 현장 설명회 수행');
    if (/교섭|노사|합의|협약/.test(safeDesc)) deliverables.push('노사 교섭 전략 수립, 교섭안 검토 및 합의서 작성 지원');
    if (/감독|근로감독|시정|대응|소명/.test(safeDesc)) deliverables.push('고용노동부 등 관계기관 점검·소명 대응 서면 및 현장 조력');
    if (!deliverables.length) {
      deliverables.push('{{과업내용}} 관련 노동관계법령 정밀 검토 및 맞춤형 실행 방안 수립');
      deliverables.push('과업 수행 결과 보고서(또는 자문 의견서) 제출 및 이행 자문');
    }

    var feeDetail = '   ① 갑은 을에게 본 계약의 위탁보수로 금 {{계약금액}}원 ({{부가세처리}})을 지급한다.';
    if (/선금|착수금|중도금|잔금|분할|50%|절반/.test(safeDesc)) {
      feeDetail += '\n   ② 보수는 계약 체결과 동시에 착수금(선금)을 지급하고, 최종 과업 결과물 제출(또는 과업 완료) 시 잔금을 정산·지급한다.';
    } else if (/월\s*자문|매월|월정/.test(safeDesc)) {
      feeDetail += '\n   ② 보수는 매월 말일까지 지정 계좌로 정기 지급한다.';
    }
    if (/성공\s*보수|성과\s*보수|타결/.test(safeDesc) || isCase) {
      feeDetail += '\n   ③ 성과·성공보수 약정이 있는 경우 목적 달성 시 {{성공보수}}를 별도 지급한다.';
    }
    feeDetail += '\n   ④ 정해진 기일 내 보수 지급을 지체한 때에는 지급기일 다음날부터 연 12%의 이자를 가산한다.';

    var spokenClause = '';
    if (spec.verbalNotes && String(spec.verbalNotes).trim()) {
      var cleanVerbal = templatizeText(anonymizeCreativeInput(spec.verbalNotes, spec.hints || {}), {}).text.trim();
      if (cleanVerbal) {
        spokenClause = cleanVerbal;
      }
    }

    var contractTitle = isCase
      ? (topic + ' 사건 대리 위임약정서')
      : (topic + (/자문/.test(topic) ? ' 자문계약서' : ' 위탁계약서'));
    var quoteTitle = topic + ' 견적서';
    var powerTitle = topic + (isCase ? ' 대리인 위임장' : ' 업무대행 위임장');

    var cArt = 1;
    var cBodyLines = [
      '              ' + contractTitle,
      '',
      '                                                     계약번호: {{계약번호}}',
      '',
      '   {{회사명}} (이하 "갑"이라 한다)과 푸른노무법인 (이하 "을"이라 한다)은',
      '   "' + topic + '" 업무 수행에 관하여 다음과 같이 맞춤형 계약을 체결한다.',
      '',
      '제' + (cArt++) + '조 【목적 및 과업 범위】',
      '   ① 본 계약은 갑이 위탁하는 {{과업내용}} 업무(대상규모: {{대상인원}})를 을이 전문적으로 수행함을 목적으로 한다.',
      '   ② 세부 수행 범위 및 주요 산출물은 다음 각 호와 같다.'
    ];
    deliverables.forEach(function (d, idx) {
      cBodyLines.push('      ' + (idx + 1) + '. ' + d);
    });
    cBodyLines.push(
      '제' + (cArt++) + '조 【계약 및 수행 기간】',
      '   본 계약의 수행기간은 {{계약기간}} ({{계약시작일}} ~ {{계약종료일}})로 하며, 갑과 을의 서면 합의로 기간을 조정할 수 있다.',
      '제' + (cArt++) + '조 【위탁보수 및 지급조건】',
      feeDetail,
      '제' + (cArt++) + '조 【현업 협조 및 자료 제공】',
      '   갑은 을의 원활한 과업 수행을 위하여 기초 인사·노무 자료 제공 및 관계자 면담에 성실히 협조하며, 을은 갑이 제공한 자료의 진실성을 전제로 업무를 수행한다.',
      '제' + (cArt++) + '조 【산출물의 활용 및 비밀 유지】',
      '   ① 을이 본 계약에 따라 납품한 최종 결과물은 갑의 내부 인사·노무관리 목적으로 활용할 수 있다.',
      '   ② 갑과 을은 본 계약 과정에서 취득한 상대방의 영업비밀·개인정보·노무 현안을 계약 종료 후에도 제3자에게 누설하지 아니한다.'
    );
    if (spokenClause) {
      cBodyLines.push(
        '제' + (cArt++) + '조 【맞춤 특약사항】',
        '   당사자 간 구두·사전 협의에 따라 다음 사항을 특약으로 정한다.',
        '   - ' + spokenClause.replace(/\n+/g, '\n   - ')
      );
    }
    cBodyLines.push(
      '제' + (cArt++) + '조 【책임 수행 노무사】',
      '   본 과업의 책임 수행 노무사는 {{주담당}} 노무사로 한다.' + (isCase ? ' (수임 공인노무사단: {{공인노무사명단}})' : ''),
      '',
      '   ※ 입금계좌: 하나은행 680-910005-45904 [예금주: 푸른노무법인]',
      '',
      '                              {{계약일}}',
      '',
      '   갑(위탁자)  상 호: {{회사명}} (사업자번호: {{사업자번호}})',
      '               주 소: {{주소}}',
      '               대표자: {{대표자}}' + (isCase ? ' / 신청인: {{근로자명}}' : '') + '                  (인)',
      '',
      '   을(수탁자)  상 호: 푸른노무법인 (사업자번호: 312-81-52792)',
      '               주 소: 충남 천안시 서북구 원두정8길 6, 두정빌딩 3층 301호',
      '               대표자: 권 형 하                                (인)'
    );

    var qBodyLines = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '              견   적   서 (' + topic + ')',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '■ 수 신: {{회사명}} 귀중 (사업자번호: {{사업자번호}} / 대표: {{대표자}})',
      '■ 발 신: 푸른노무법인 (사업자번호: 312-81-52792 / 대표노무사: 권형하)',
      '■ 일 자: {{계약일}}',
      '',
      '1. 과 업 명: {{과업내용}} (' + topic + ')',
      '2. 대상규모: {{대상인원}}',
      '3. 수행기간: {{계약기간}}',
      '4. 견적금액: 일금 {{계약금액한글}}원정 (₩{{계약금액}} / {{부가세처리}})',
      '5. 책임수행: {{주담당}} 공인노무사',
      '',
      '[세부 수행 항목 및 산출물]'
    ];
    deliverables.forEach(function (d, idx) {
      qBodyLines.push('  ' + (idx + 1) + ') ' + d);
    });
    if (spokenClause) {
      qBodyLines.push('', '[협의·특기사항]', '  - ' + spokenClause.replace(/\n+/g, '\n  - '));
    }
    qBodyLines.push(
      '',
      '※ 입금계좌: 하나은행 680-910005-45904 (예금주: 푸른노무법인)',
      '※ 본 견적서의 유효기간은 제출일로부터 30일입니다.',
      '',
      '                    푸 른 노 무 법 인  대표노무사 권 형 하 (인)'
    );

    var pBodyLines = [
      '                    위     임     장',
      '',
      '■ 위 임 인: {{회사명}} (사업자번호: {{사업자번호}} / 대표자: {{대표자}}' + (isCase ? ' / 당사자: {{근로자명}}' : '') + ')',
      '            주소: {{주소}}',
      '■ 수 임 인: 푸른노무법인 (대표노무사 권형하 / 담당 공인노무사: {{공인노무사명단}})',
      '            주소: 충남 천안시 서북구 원두정8길 6, 두정빌딩 3층 301호',
      '',
      '■ 위임사항: "' + topic + '" ({{과업내용}}) 관련 노동관계법령 자문·서류 작성·제출·의견 진술 및 대리 업무 일체',
      '',
      '   위 수임인에게 상기 위임사항에 관한 권한 일체를 위임합니다.',
      '',
      '                              {{계약일}}',
      '',
      '                    위임인: {{회사명}} {{대표자}} (인)'
    ];

    var stamp = Date.now().toString(36);
    var cKind = meta.kind || 'company';
    var qKind = (cKind === 'case' || cKind === 'consult') ? 'other' : cKind;
    var contractForm = {
      id: 'fm-creative-c-' + stamp,
      kind: cKind,
      groupName: cKind === 'case' ? (meta.groupName || '기타') : '계약서',
      name: contractTitle.slice(0, 120),
      body: enforceLegalTextRules(cBodyLines.join('\n') + '\n'),
      enabled: true,
      createdAt: today,
      attachments: [],
      originals: []
    };
    var quoteForm = {
      id: 'fm-creative-q-' + stamp,
      kind: qKind,
      groupName: PROPOSAL_GROUP,
      name: quoteTitle.slice(0, 120),
      body: enforceLegalTextRules(qBodyLines.join('\n') + '\n'),
      enabled: true,
      createdAt: today,
      attachments: [],
      originals: []
    };
    var powerForm = {
      id: 'fm-creative-p-' + stamp,
      kind: cKind,
      groupName: cKind === 'case' ? (meta.groupName || '기타') : '계약서',
      name: powerTitle.slice(0, 120),
      body: enforceLegalTextRules(pBodyLines.join('\n') + '\n'),
      enabled: true,
      createdAt: today,
      attachments: [],
      originals: []
    };

    var list = [];
    if (wantContract) list.push(contractForm);
    if (wantQuote) list.push(quoteForm);
    if (wantPower) list.push(powerForm);
    if (!list.length) list.push(contractForm);

    return {
      via: 'smart',
      topic: topic,
      kind: cKind,
      setId: meta.setId || '',
      contractForm: contractForm,
      quoteForm: quoteForm,
      powerForm: powerForm,
      forms: list
    };
  }

  function draftCreativeBundle(spec, deps) {
    spec = spec || {};
    deps = deps || {};
    var base = composeCreativeBundle(spec);
    var ai = deps.ai || (w && w.PuAiCall);
    var auth = deps.auth || (w && w.firebase && typeof w.firebase.auth === 'function' ? w.firebase.auth() : null);
    if (!ai || typeof ai.ask !== 'function' || !auth || !auth.currentUser) {
      return Promise.resolve(base);
    }
    var safeSubject = anonymizeCreativeInput(spec.subject || base.topic, spec.hints || {});
    var safeBrief = anonymizeCreativeInput([spec.brief || '', spec.verbalNotes || ''].join('\n'), spec.hints || {});
    var confirmSend = deps.confirmSend || (w && typeof w.confirm === 'function' ? w.confirm.bind(w) : null);
    if (!confirmSend) return Promise.resolve(base);
    var okSend = confirmSend(
      '🤖 외부 AI 초안 생성 전송 확인\n' +
      '아래와 같이 비식별화된 요청 문구만 전송됩니다:\n\n' +
      '· 주제: ' + safeSubject + '\n' +
      '· 조건: ' + (safeBrief || safeSubject).slice(0, 240) + '\n\n' +
      '전송하여 AI 초안을 생성할까요? ([취소] 시 외부 전송 없이 내장 엔진으로 즉시 생성합니다)'
    );
    if (!okSend) return Promise.resolve(base);
    var prompt = [
      '당신은 대한민국 공인노무사 법인(푸른노무법인, 사업자번호 312-81-52792, 대표노무사 권형하)의 수석 계약서 설계 전문가입니다.',
      '아래 요구사항에 맞추어 실무에서 즉시 사용할 수 있는 창조적이고 체계적인 맞춤형 계약서 본문과 견적서 본문을 JSON으로 작성하세요.',
      '[필수 치환변수 규칙 — 실제 이름이나 금액 대신 반드시 아래 변수를 그대로 넣으세요]',
      '{{회사명}}, {{사업자번호}}, {{주소}}, {{대표자}}, {{담당자}}, {{과업내용}}, {{대상인원}}, {{계약기간}}, {{계약시작일}}, {{계약종료일}}, {{계약금액}}, {{계약금액한글}}, {{부가세처리}}, {{성공보수}}, {{주담당}}, {{계약번호}}, {{계약일}}',
      '[법률 준수 규칙]',
      '- 지연이자·연체이자 조항을 넣을 때는 반드시 "연 12%의 이자" 문구만 사용하세요(15%·20% 절대 금지).',
      '- 입금계좌는 "하나은행 680-910005-45904 [푸른노무법인]"을 넣으세요.',
      '- JSON 키는 정확히 {"contractTitle":"...","contractBody":"...","quoteTitle":"...","quoteBody":"..."} 로만 답하세요.',
      '',
      '[창작 주제]: ' + safeSubject,
      '[세부 요청·구두 조건]: ' + (safeBrief || safeSubject)
    ].join('\n');

    return Promise.resolve().then(function () {
      return ai.ask([{ text: prompt }], {
        auth: auth,
        fetch: deps.fetch,
        app: 'docs',
        generationConfig: { temperature: 0.25, maxOutputTokens: 2800 }
      });
    }).then(function (reply) {
      var raw = typeof ai.textOf === 'function' ? ai.textOf(reply) : String((reply && reply.text) || '');
      var m = raw.match(/\{[\s\S]*\}/);
      if (!m) return base;
      var parsed = JSON.parse(m[0]);
      if (parsed && typeof parsed.contractBody === 'string' && parsed.contractBody.trim().length > 60) {
        base.contractForm.body = anonymizeCreativeInput(enforceLegalTextRules(parsed.contractBody.trim()), spec.hints || {}) + '\n';
        if (typeof parsed.contractTitle === 'string' && parsed.contractTitle.trim()) {
          base.contractForm.name = extractCreativeTopic(parsed.contractTitle.trim(), spec.hints || {}) + ' 위탁계약서';
        }
      }
      if (parsed && typeof parsed.quoteBody === 'string' && parsed.quoteBody.trim().length > 40) {
        base.quoteForm.body = anonymizeCreativeInput(enforceLegalTextRules(parsed.quoteBody.trim()), spec.hints || {}) + '\n';
        if (typeof parsed.quoteTitle === 'string' && parsed.quoteTitle.trim()) {
          base.quoteForm.name = extractCreativeTopic(parsed.quoteTitle.trim(), spec.hints || {}) + ' 견적서';
        }
      }
      base.via = 'ai';
      return base;
    }).catch(function () {
      return base;
    });
  }

  /* ── 지난 계약(이알피) + 보낸 견적·계약(PuQuotes) 통합 조회 (읽기 전용 · 주민번호 비노출) ── */
  var QUOTE_TYPE_KO = {
    education: '교육·강의', investigation: '괴롭힘·성희롱 조사', safety: '산업안전 컨설팅',
    hr_consult: '인사노무 컨설팅', bargaining: '노사·단체교섭', fund: '근로복지기금',
    opinion: '법률의견서', advice: '노무자문·급여', 'case': '사건 대리', other: '기타'
  };

  function scrubLoadedVals(vals) {
    var clean = {};
    Object.keys(vals || {}).forEach(function (k) {
      if (/주민번호|rrn/i.test(k)) return;
      var v = maskRrnSafe(String(vals[k] == null ? '' : vals[k])).trim();
      if (v) clean[k] = v;
    });
    return clean;
  }

  function fetchPastHistory(ctx) {
    ctx = ctx || {};
    if (Array.isArray(ctx.pastRecords)) {
      return Promise.resolve(ctx.pastRecords.slice());
    }
    var host = ctx.host || {};
    var quotesApi = ctx.quotesApi || (w && w.PuQuotes);

    var erpP = (host && typeof host.contractList === 'function')
      ? Promise.resolve().then(function () { return host.contractList(); }).catch(function () { return []; })
      : Promise.resolve([]);

    var quotesP = (quotesApi && typeof quotesApi.list === 'function')
      ? Promise.resolve().then(function () { return quotesApi.list(); }).then(function (qList) {
          var arr = Array.isArray(qList) ? qList : [];
          if (!arr.length || typeof quotesApi.amounts !== 'function') return { list: arr, amts: {} };
          var ids = arr.slice(0, 150).map(function (q) { return q.id; }).filter(Boolean);
          return Promise.resolve().then(function () { return quotesApi.amounts(ids); }).catch(function () { return {}; })
            .then(function (amts) { return { list: arr, amts: amts || {} }; });
        }).catch(function () { return { list: [], amts: {} }; })
      : Promise.resolve({ list: [], amts: {} });

    return Promise.all([erpP, quotesP]).then(function (got) {
      var items = [];
      (got[0] || []).forEach(function (c) {
        if (!c || !c.id) return;
        var kText = Array.isArray(c.kinds) && c.kinds.length ? c.kinds.join('·') : '확정 계약';
        items.push({
          uidKey: 'erp:' + c.id,
          source: 'erp',
          contractId: c.id,
          badge: '확정계약',
          date: String(c.signDate || '').slice(0, 10),
          coName: maskRrnSafe(c.companyName || ''),
          bizNo: c.bizNo || '',
          kindLabel: kText + (c.contractNo ? ' (' + c.contractNo + ')' : ''),
          status: c.status || '',
          amountText: '',
          vatText: '',
          period: '',
          scope: kText,
          manager: ''
        });
      });

      var qData = got[1] || { list: [], amts: {} };
      (qData.list || []).forEach(function (q) {
        if (!q || !q.id) return;
        var a = qData.amts[q.id] || null;
        var amtNum = a && typeof a.amount === 'number' && a.amount > 0 ? a.amount : 0;
        var vatLabel = a && a.vat === 'incl' ? '부가세 포함' : (a && a.vat === 'excl' ? '부가세 별도' : '');
        items.push({
          uidKey: 'quote:' + q.id,
          source: 'quote',
          quoteId: q.id,
          badge: q.doc === 'contract' ? '계약기록' : '보낸견적',
          date: String(q.date || '').slice(0, 10),
          coName: maskRrnSafe(q.co || ''),
          bizNo: '',
          kindLabel: QUOTE_TYPE_KO[q.type] || q.type || '기타',
          status: '',
          amountText: amtNum ? commaNum(amtNum) : '',
          vatText: vatLabel,
          period: maskRrnSafe(q.period || ''),
          scope: maskRrnSafe(q.scope || ''),
          staff: q.staff ? (q.staff + '명') : '',
          manager: maskRrnSafe(q.ownerGuess || '')
        });
      });

      items.sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
      return items;
    });
  }

  /* ── 공통 DOM 유틸 & 간결 스타일 (27색 팔레트 엄수) ── */
  var _easyCssDone = false;
  var EASY_CSS = ''
    + '.pce-mbg{position:fixed;inset:0;background:rgba(30,41,59,.55);z-index:10002;display:flex;align-items:center;justify-content:center;padding:12px}'
    + '.pce-m{background:#fff;border-radius:12px;width:860px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;border:1px solid #cbd5e1;overflow:hidden}'
    + '.pce-mh{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0}'
    + '.pce-mh b{flex:1;font-size:14.5px;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pce-x{background:#fff;border:1px solid #cbd5e1;border-radius:7px;min-width:36px;min-height:36px;padding:0 8px;font-size:16px;color:#475569;cursor:pointer;flex:none}'
    + '.pce-mb{padding:12px 14px;overflow-y:auto;overflow-x:hidden;flex:1;display:flex;flex-direction:column;gap:9px}'
    + '.pce-mf{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding:10px 14px;background:#f8fafc;border-top:1px solid #e2e8f0}'
    + '.pce-sec{border:1px solid #e2e8f0;border-radius:9px;padding:9px 11px;background:#f8fafc;box-sizing:border-box;max-width:100%;min-width:0}'
    + '.pce-sh{font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}'
    + '.pce-sub{font-size:12px;color:#475569;font-weight:400;min-width:0;overflow-wrap:anywhere}'
    + '.pce-in,.pce-ta,.pce-sel{width:100%;max-width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:7px;padding:6px 9px;font-family:inherit;font-size:13px;color:#1e293b;background:#fff}'
    + '.pce-ta{resize:vertical;line-height:1.5}'
    + '.pce-btn{box-sizing:border-box;max-width:100%;border:1px solid #cbd5e1;background:#fff;color:#1e293b;border-radius:7px;padding:6px 11px;min-height:34px;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}'
    + '.pce-btn:hover{background:#f8fafc}'
    + '.pce-btn.pri{background:#1e40af;border-color:#1e40af;color:#fff;font-weight:700}'
    + '.pce-btn.grn{background:#166534;border-color:#166534;color:#fff;font-weight:700}'
    + '.pce-btn.soft{background:#eff6ff;border-color:#bfdbfe;color:#1e40af}'
    + '.pce-btn.mic{background:#fffbeb;border-color:#fde68a;color:#854d0e;font-weight:700}'
    + '.pce-btn.mic.rec{background:#fef2f2;border-color:#fecaca;color:#991b1b;font-weight:700}'
    + '.pce-btn:disabled{opacity:.5;cursor:default}'
    + '.pce-qrow{display:flex;gap:6px;align-items:stretch}'
    + '.pce-qrow .pce-ta{flex:1;min-width:0}'
    + '.pce-workbar{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}'
    + '.pce-wchips{flex:1 1 420px;min-width:0;display:flex;flex-wrap:wrap;gap:5px;align-items:center}'
    + '.pce-wchip{border:1px solid #cbd5e1;background:#fff;color:#1e293b;border-radius:99px;padding:5px 10px;min-height:32px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}'
    + '.pce-wchip:hover{border-color:#60a5fa;background:#eff6ff}'
    + '.pce-wchip.on{background:#1e40af;border-color:#1e40af;color:#fff;font-weight:700}'
    + '.pce-wchip.newc{border-color:#16a34a;background:#f0fdf4;color:#166534;font-weight:700}'
    + '.pce-wchip.newc.on{background:#166534;border-color:#166534;color:#fff}'
    + '.pce-wsel{width:auto;min-width:148px;max-width:205px;min-height:32px;padding:4px 8px;font-size:12px;border-radius:99px;font-weight:600}'
    + '.pce-rchecks{flex:0 0 auto;display:flex;gap:5px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid #bfdbfe;border-radius:8px;padding:4px 8px}'
    + '.pce-rck{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:#1e293b;cursor:pointer;margin:0;padding:2px 4px;min-height:30px;white-space:nowrap}'
    + '.pce-rck input[type=checkbox]{width:24px;height:24px;margin:0;flex:none;cursor:pointer}'
    + '.pce-docsum{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:7px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:12px;color:#475569}'
    + '.pce-docsum b{color:#1e293b}'
    + '.pce-docsum .names{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pce-doclist{display:flex;flex-direction:column;gap:4px;max-height:160px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:7px;padding:6px;margin-top:6px}'
    + '.pce-docrow{display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:6px;cursor:pointer;font-size:12.5px;color:#1e293b;margin:0}'
    + '.pce-docrow:hover{background:#f8fafc}'
    + '.pce-docrow input[type=checkbox]{width:24px;height:24px;margin:0;flex:none}'
    + '.pce-docrow .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pce-tag{font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;flex:none;white-space:nowrap}'
    + '.pce-tag.q{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}'
    + '.pce-tag.c{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}'
    + '.pce-tag.p{background:#fffbeb;color:#854d0e;border:1px solid #fde68a}'
    + '.pce-fgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}'
    + '.pce-fg{display:flex;flex-direction:column;gap:2px;min-width:0}'
    + '.pce-fg label{margin:0;font-size:11.5px;font-weight:700;color:#475569}'
    + '.pce-corow{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}'
    + '.pce-cochip{border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:99px;padding:4px 10px;min-height:32px;font-size:12px;font-weight:600;cursor:pointer}'
    + '.pce-refbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
    + '.pce-hlist{display:flex;flex-direction:column;gap:5px;max-height:165px;overflow-y:auto;margin-top:6px}'
    + '.pce-hitem{background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:6px 8px;display:flex;flex-direction:column;gap:4px}'
    + '.pce-hmain{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:#1e293b}'
    + '.pce-hmain .hsum{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pce-hdet{font-size:11.5px;color:#475569;background:#f8fafc;border-top:1px solid #e2e8f0;padding:6px;border-radius:5px;white-space:pre-wrap;overflow-wrap:anywhere}'
    + '.pce-tabs{display:flex;gap:6px;flex-wrap:wrap}'
    + '.pce-tab{border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:7px;padding:6px 12px;min-height:32px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer}'
    + '.pce-tab.on{background:#1e40af;border-color:#1e40af;color:#fff}'
    + '.pce-vchips{display:flex;flex-wrap:wrap;gap:5px}'
    + '.pce-vchip{border:1px solid #cbd5e1;background:#fff;color:#1e293b;border-radius:6px;padding:4px 8px;min-height:32px;font-family:monospace;font-size:12px;cursor:pointer}'
    + '.pce-vchip:hover{background:#eff6ff;border-color:#2563eb;color:#1e40af}'
    + '.pce-cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px}'
    + '.pce-cklbl{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:6px 9px;font-size:12.5px;color:#1e293b;cursor:pointer;margin:0;font-weight:600;min-width:0}'
    + '.pce-cklbl input[type=checkbox]{width:24px;height:24px;margin:0;flex:none}'
    + '@media(max-width:760px){'
    + '.pce-mbg{padding:8px}.pce-mb{padding:10px}.pce-qrow{flex-wrap:wrap}.pce-qrow .pce-ta{flex:1 1 100%}'
    + '.pce-fgrid{grid-template-columns:minmax(0,1fr)}.pce-cgrid{grid-template-columns:minmax(0,1fr)}'
    + '.pce-rchecks{width:100%;box-sizing:border-box}.pce-wsel{max-width:100%;flex:1 1 160px}'
    + '.pce-btn{white-space:normal;height:auto;min-height:36px;line-height:1.35;text-align:center}'
    + '.pce-x{min-width:40px;min-height:36px}'
    + '.pce-in,.pce-ta,.pce-sel{font-size:16px}'
    + '}';

  function ensureEasyCss(doc) {
    doc = doc || (w && w.document);
    if (_easyCssDone || !doc || !doc.head) return;
    if (doc.getElementById && doc.getElementById('pu-contract-easy-css')) { _easyCssDone = true; return; }
    var s = doc.createElement('style');
    s.id = 'pu-contract-easy-css';
    s.textContent = EASY_CSS;
    doc.head.appendChild(s);
    _easyCssDone = true;
  }

  function domEl(doc, tag, attrs, kids) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') n.textContent = String(v);
      else if (k === 'class') n.className = String(v);
      else if (k === 'style') n.style.cssText = String(v);
      else if (k === 'value') n.value = String(v);
      else if (k === 'checked') n.checked = !!v;
      else if (k === 'selected') n.selected = !!v;
      else if (k === 'disabled') n.disabled = !!v;
      else if (k === 'hidden') n.hidden = !!v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    });
    return n;
  }

  function bindModalKeys(doc, md, onClose) {
    function isHiddenDeep(el) {
      var cur = el;
      while (cur && cur !== md) {
        if (cur.hidden || (cur.getAttribute && cur.getAttribute('hidden') !== null)) return true;
        cur = cur.parentNode;
      }
      return false;
    }
    function onKey(e) {
      if (!e) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'Tab' && md && md.querySelectorAll) {
        var fcs = Array.prototype.slice.call(md.querySelectorAll('button,input,select,textarea')).filter(function (x) {
          return !x.disabled && x.getAttribute('disabled') === null && !isHiddenDeep(x);
        });
        if (!fcs.length) return;
        var first = fcs[0], last = fcs[fcs.length - 1], ae = doc.activeElement;
        if (e.shiftKey && (ae === first || (md.contains && !md.contains(ae)))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && ae === last) { e.preventDefault(); first.focus(); }
      }
    }
    doc.addEventListener('keydown', onKey);
    return function () { doc.removeEventListener('keydown', onKey); };
  }

  /* ══ 모달 1: ⚡ 간결 계약·견적 만들기 (1~2줄 업무 선택 + 옆 견적/계약 체크 + 지난 계약 검토 + 구두 입력 + 새 계약서 창작) ══
     ctx: { forms, sets, host, openFill, onPickSet?, onSaveForm?, initialText?, autoVoice?, speechRec?, ai?, auth?, quotesApi?, pastRecords?, returnFocus?, toast? } */
  function openQuickMakeModal(ctx) {
    ctx = ctx || {};
    var doc = ctx.doc || (w && w.document);
    if (!doc || !doc.body) return null;
    ensureEasyCss(doc);

    var prevFocus = ctx.returnFocus || doc.activeElement;
    var forms = (ctx.forms || []).filter(function (f) { return f && f.closed !== true && f.enabled !== false; });
    var sets = ctx.sets || [];
    var byId = {};
    forms.forEach(function (f) { byId[f.id] = f; });
    var notify = ctx.toast || function () {};

    var st = {
      presetId: WORK_PRESETS[0].id,
      setId: 'fs-advisory',
      creativeMode: false,
      creativeBundle: null,
      wantQuote: true,
      wantContract: true,
      wantPower: true,
      picked: {},
      showDocDetail: false,
      showMoreFields: false,
      activeRefTab: '', // '' | 'history' | 'verbal'
      coRows: [],
      pickedCo: null,
      historyAll: [],
      historyLoaded: false,
      expandedHistKey: '',
      erpDetailCache: {},
      voiceStopper: null,
      voiceTarget: '' // 'brief' | 'verbal' | 'creative'
    };

    var bg = domEl(doc, 'div', { 'class': 'pce-mbg' });
    var unbindKeys = null;
    function stopActiveVoice() {
      if (st.voiceStopper) {
        var sp = st.voiceStopper;
        st.voiceStopper = null;
        st.voiceTarget = '';
        sp.stop();
        syncVoiceButtons();
      }
    }
    function close(skipFocus) {
      stopActiveVoice();
      if (unbindKeys) { unbindKeys(); unbindKeys = null; }
      bg.remove();
      if (skipFocus !== true && prevFocus && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus(); } catch (_) {}
      }
    }
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });

    /* ── ① 상단 한 줄 메모·문의글 + 🎙 구두(음성) 입력 줄 ── */
    var briefIn = domEl(doc, 'textarea', {
      'class': 'pce-ta', rows: '1', 'aria-label': '한 줄 메모 또는 구두 문의글 입력',
      placeholder: '한 줄 메모·문의글 또는 [🎙 구두 입력] — 예: (주)가나상사 괴롭힘 조사 35명 440만원 부가세별도',
      value: ctx.initialText || ''
    });
    var btnBriefMic = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn mic', 'aria-pressed': 'false',
      title: '마이크로 말씀하시면 한 줄 메모에 바로 받아적고 양식과 금액·기간까지 자동 정리합니다',
      text: '🎙 구두 입력',
      onclick: function () { toggleVoice('brief', briefIn, parseStatus, true); }
    });
    var parseStatus = domEl(doc, 'div', { 'class': 'pce-sub', role: 'status', 'aria-live': 'polite', hidden: true });

    function setStatusMsg(node, msg) {
      node.textContent = msg || '';
      node.hidden = !msg;
    }

    function toggleVoice(targetKey, inputEl, statusNode, autoParseAfter) {
      if (st.voiceStopper && st.voiceTarget === targetKey) {
        stopActiveVoice();
        return;
      }
      stopActiveVoice();
      var baseBefore = inputEl.value.trim();
      setStatusMsg(statusNode, '🔴 말씀하세요… 회사명·업무·금액·기간 (⚠ 주민등록번호·계좌번호는 말로 부르지 마세요)');
      st.voiceTarget = targetKey;
      var handle = startVoiceInput({
        confirm: ctx.confirmVoice,
        onText: function (txt, isFinal) {
          inputEl.value = joinSpokenText(baseBefore, txt);
          if (isFinal) {
            setStatusMsg(statusNode, '✔ 구두 입력 완료: "' + txt + '"');
          } else {
            setStatusMsg(statusNode, '🔴 듣는 중: ' + txt);
          }
        },
        onError: function (errMsg) {
          st.voiceStopper = null;
          st.voiceTarget = '';
          syncVoiceButtons();
          setStatusMsg(statusNode, '💡 ' + errMsg);
          try { inputEl.focus(); } catch (_) {}
        },
        onEnd: function () {
          var finishedTarget = st.voiceTarget;
          st.voiceStopper = null;
          st.voiceTarget = '';
          syncVoiceButtons();
          if (autoParseAfter && inputEl.value.trim()) {
            if (finishedTarget === 'brief') runParseBrief();
            else if (finishedTarget === 'verbal') applyVerbalNotes(false);
          }
        }
      }, ctx.speechRec);

      if (handle) {
        st.voiceStopper = handle;
        syncVoiceButtons();
      } else {
        st.voiceTarget = '';
        syncVoiceButtons();
        try { inputEl.focus(); } catch (_) {}
      }
    }

    /* ── ② 간결 업무 선택(1~2줄) + 바로 옆 견적서·계약서·위임장 체크 ── */
    var coreChipWrap = domEl(doc, 'div', { 'class': 'pce-wchips', role: 'group', 'aria-label': '주요 업무 선택' });
    var otherPresetSel = domEl(doc, 'select', { 'class': 'pce-sel pce-wsel', 'aria-label': '그 외 업무 선택' });

    var ckQuote = domEl(doc, 'input', { type: 'checkbox', checked: true, 'aria-label': '견적서 포함' });
    var ckContract = domEl(doc, 'input', { type: 'checkbox', checked: true, 'aria-label': '계약서 포함' });
    var ckPower = domEl(doc, 'input', { type: 'checkbox', checked: true, 'aria-label': '위임장·부속 포함' });

    function onRoleCheckChange() {
      st.wantQuote = !!ckQuote.checked;
      st.wantContract = !!ckContract.checked;
      st.wantPower = !!ckPower.checked;
      if (st.creativeMode && !st.creativeBundle) {
        refreshCreativeBundle();
      } else {
        applyRoleChecksToPicked();
      }
      syncInputVisibility();
    }
    ckQuote.addEventListener('change', onRoleCheckChange);
    ckContract.addEventListener('change', onRoleCheckChange);
    ckPower.addEventListener('change', onRoleCheckChange);

    var docSumNames = domEl(doc, 'span', { 'class': 'names' });
    var btnToggleDocs = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn', style: 'padding:3px 9px;min-height:30px;font-size:11.5px',
      'aria-expanded': 'false',
      text: '세부 서류 변경 ▾',
      onclick: function () {
        st.showDocDetail = !st.showDocDetail;
        docDetailWrap.hidden = !st.showDocDetail;
        btnToggleDocs.setAttribute('aria-expanded', st.showDocDetail ? 'true' : 'false');
        btnToggleDocs.textContent = st.showDocDetail ? '세부 서류 접기 ▴' : '세부 서류 변경 ▾';
      }
    });
    var docListBox = domEl(doc, 'div', { 'class': 'pce-doclist' });
    var addExtraSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '다른 양식 추가하기', style: 'margin-top:5px' });
    var docDetailWrap = domEl(doc, 'div', { hidden: true }, [docListBox, addExtraSel]);

    /* ── ✨ 창조적 새 계약서·견적서 제작 박스 (새 계약서 창작 선택 시만 펼침) ── */
    var creativeSubjIn = domEl(doc, 'input', {
      type: 'text', 'class': 'pce-in', 'aria-label': '새로 만들 계약서 주제',
      placeholder: '새 계약 주제 — 예: 외국인 근로자 노무관리 및 기숙사 점검 용역 / AI 인사규정 설계·교육'
    });
    var creativeDescIn = domEl(doc, 'textarea', {
      'class': 'pce-ta', rows: '2', 'aria-label': '창작할 계약 조건 및 특약 설명',
      placeholder: '원하는 과업·산출물·지급방식·특약을 자유롭게 적거나 [🎙 구두 설명]으로 말씀하세요 (예: 착수금 50% 선지급, 보고서 납품 후 잔금 50%, 비밀유지 특약)'
    });
    var btnCreativeMic = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn mic', 'aria-pressed': 'false',
      text: '🎙 구두 설명',
      onclick: function () { toggleVoice('creative', creativeDescIn, creativeStatus, false); }
    });
    var creativeStatus = domEl(doc, 'div', { 'class': 'pce-sub', role: 'status', 'aria-live': 'polite', text: '주제와 조건을 적고 [✨ 맞춤 계약·견적 창조 생성]을 누르면 오른쪽에 체크된 견적서·계약서가 새로 만들어집니다.' });
    var creativePreviewTa = domEl(doc, 'textarea', { 'class': 'pce-ta', rows: '7', 'aria-label': '생성된 맞춤 계약서 본문 편집' });
    var creativePreviewWrap = domEl(doc, 'div', { hidden: true, style: 'margin-top:6px' }, [
      domEl(doc, 'div', { 'class': 'pce-sub', style: 'margin-bottom:4px', text: '생성된 맞춤 계약서 본문 (필요하면 바로 다듬을 수 있으며 {{변수}} 자리에 아래 입력값이 채워집니다)' }),
      creativePreviewTa
    ]);
    creativePreviewTa.addEventListener('input', function () {
      if (st.creativeBundle && st.creativeBundle.contractForm) {
        /* 사람이 직접 다듬은 본문은 주민번호만 가리고 계좌·이율을 임의 치환하지 않는다 */
        st.creativeBundle.contractForm.body = maskRrnSafe(creativePreviewTa.value);
      }
    });
    var btnPreviewCreative = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn',
      text: '생성 본문 보기·다듬기 ▾',
      onclick: function () {
        creativePreviewWrap.hidden = !creativePreviewWrap.hidden;
        btnPreviewCreative.textContent = creativePreviewWrap.hidden ? '생성 본문 보기·다듬기 ▾' : '생성 본문 접기 ▴';
      }
    });
    var btnRunCreative = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn grn',
      text: '✨ 맞춤 계약·견적 창조 생성',
      onclick: function () { runCreativeDraft(true); }
    });
    var saveCreativeCk = domEl(doc, 'input', { type: 'checkbox', 'aria-label': '창작한 양식을 공용 양식함에도 함께 저장' });
    var saveCreativeWrap = domEl(doc, 'label', { 'class': 'pce-rck', hidden: true, title: '체크하면 일회성 채우기뿐 아니라 공용 계약서 양식 목록에도 영구 등록됩니다' }, [
      saveCreativeCk,
      domEl(doc, 'span', { text: '공용 양식함에도 등록' })
    ]);
    var creativePane = domEl(doc, 'div', { 'class': 'pce-sec', style: 'background:#f0fdf4;border-color:#bbf7d0', hidden: true }, [
      domEl(doc, 'div', { 'class': 'pce-sh' }, [
        domEl(doc, 'span', { style: 'color:#166534', text: '✨ 새로운 계약서·견적서 창조 설계' }),
        btnCreativeMic,
        btnRunCreative,
        btnPreviewCreative
      ]),
      domEl(doc, 'div', { style: 'display:flex;flex-direction:column;gap:6px' }, [creativeSubjIn, creativeDescIn]),
      domEl(doc, 'div', { style: 'margin-top:5px' }, [creativeStatus]),
      creativePreviewWrap
    ]);

    /* ── ③ 참고·구두 보조 장면 (📂 지난 계약·견적 검토 / 🎙 구두로 조건·특약 넣기) ── */
    var btnHistTab = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn soft', 'aria-expanded': 'false',
      text: '📂 지난 계약·견적 검토',
      onclick: function () { toggleRefPane('history'); }
    });
    var btnVerbalTab = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn mic', 'aria-expanded': 'false',
      text: '🎙 구두로 조건·특약 넣기',
      onclick: function () { toggleRefPane('verbal'); }
    });

    var histSearchIn = domEl(doc, 'input', {
      type: 'search', 'class': 'pce-in', 'aria-label': '지난 계약·견적 회사명 또는 업무 검색',
      placeholder: '회사명·업무 검색 (비워 두면 최근 계약·견적 순으로 표시)'
    });
    var histListBox = domEl(doc, 'div', { 'class': 'pce-hlist' });
    var histPane = domEl(doc, 'div', { 'class': 'pce-sec', hidden: true }, [
      domEl(doc, 'div', { 'class': 'pce-sh' }, [
        domEl(doc, 'span', { text: '📂 전에 어떤 계약·견적을 했는지 검토하고 그대로 불러올 수 있습니다' }),
        domEl(doc, 'span', { style: 'margin-left:auto;min-width:220px;flex:1;max-width:320px' }, [histSearchIn])
      ]),
      histListBox
    ]);
    histSearchIn.addEventListener('input', drawHistoryList);

    var verbalIn = domEl(doc, 'textarea', {
      'class': 'pce-ta', rows: '2', 'aria-label': '구두 협의 조건·특약 내용 입력',
      placeholder: '지난 계약이 없거나 구두로 협의한 조건·금액·특약을 말이나 글로 편하게 남기세요 — 예: "착수금 220만원 먼저 받고 보고서 제출 후 잔금 220만원, 임직원 설명회 1회 포함"'
    });
    var btnVerbalMic = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn mic', 'aria-pressed': 'false',
      text: '🎙 마이크 켜고 말하기',
      onclick: function () { toggleVoice('verbal', verbalIn, verbalStatus, true); }
    });
    var verbalStatus = domEl(doc, 'span', { 'class': 'pce-sub', role: 'status', 'aria-live': 'polite', text: '말씀하신 내용은 금액·기간·과업·특약에 자동 반영됩니다.' });
    var verbalPane = domEl(doc, 'div', { 'class': 'pce-sec', style: 'background:#fffbeb;border-color:#fde68a', hidden: true }, [
      domEl(doc, 'div', { 'class': 'pce-sh' }, [
        domEl(doc, 'span', { style: 'color:#854d0e', text: '🎙 구두로 계약 조건·특약 넣기' }),
        btnVerbalMic,
        domEl(doc, 'button', { type: 'button', 'class': 'pce-btn pri', text: '✔ 아래 입력칸·특약에 반영', onclick: function () { applyVerbalNotes(true); } }),
        verbalStatus
      ]),
      verbalIn
    ]);

    function syncVoiceButtons() {
      var bOn = !!(st.voiceStopper && st.voiceTarget === 'brief');
      btnBriefMic.className = 'pce-btn mic' + (bOn ? ' rec' : '');
      btnBriefMic.setAttribute('aria-pressed', bOn ? 'true' : 'false');
      btnBriefMic.textContent = bOn ? '⏹ 듣는 중 (완료)' : '🎙 구두 입력';

      var vOn = !!(st.voiceStopper && st.voiceTarget === 'verbal');
      btnVerbalMic.className = 'pce-btn mic' + (vOn ? ' rec' : '');
      btnVerbalMic.setAttribute('aria-pressed', vOn ? 'true' : 'false');
      btnVerbalMic.textContent = vOn ? '⏹ 말하기 완료' : '🎙 마이크 켜고 말하기';

      var cOn = !!(st.voiceStopper && st.voiceTarget === 'creative');
      btnCreativeMic.className = 'pce-btn mic' + (cOn ? ' rec' : '');
      btnCreativeMic.setAttribute('aria-pressed', cOn ? 'true' : 'false');
      btnCreativeMic.textContent = cOn ? '⏹ 설명 완료' : '🎙 구두 설명';
    }

    function toggleRefPane(which) {
      st.activeRefTab = st.activeRefTab === which ? '' : which;
      histPane.hidden = st.activeRefTab !== 'history';
      verbalPane.hidden = st.activeRefTab !== 'verbal';
      btnHistTab.setAttribute('aria-expanded', st.activeRefTab === 'history' ? 'true' : 'false');
      btnVerbalTab.setAttribute('aria-expanded', st.activeRefTab === 'verbal' ? 'true' : 'false');
      if (st.activeRefTab === 'history') {
        if (!histSearchIn.value.trim() && fCo.inp.value.trim()) histSearchIn.value = fCo.inp.value.trim();
        ensureHistoryLoaded();
      } else if (st.activeRefTab === 'verbal') {
        try { verbalIn.focus(); } catch (_) {}
      }
    }

    /* ── ④ 체크한 서류 맞춤 핵심 입력칸 (간결 2줄 기본 + 세부 접기) ── */
    function mkField(label, placeholder, aria) {
      var lbl = domEl(doc, 'label', { text: label });
      var inp = domEl(doc, 'input', { type: 'text', 'class': 'pce-in', placeholder: placeholder, 'aria-label': aria || label });
      var wrap = domEl(doc, 'div', { 'class': 'pce-fg' }, [lbl, inp]);
      return { lbl: lbl, inp: inp, wrap: wrap };
    }
    var fCo = mkField('의뢰처(회사·기관명)', '예: (주)가나상사 — 자동완성', '의뢰처 회사명');
    var fCeo = mkField('대표자', '예: 홍길동', '대표자');
    var fWorker = mkField('근로자·신청인명', '예: 김가나', '근로자명');
    var fBz = mkField('사업자등록번호', '예: 123-45-67890', '사업자등록번호');
    var fAmt = mkField('계약·견적 금액(원, 선택)', '비우면 밑줄 유지 (예: 4,400,000)', '계약 또는 견적 금액');
    var vatSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '부가세 처리' }, [
      domEl(doc, 'option', { value: '', text: '선택 안 함 (서식 기본)' }),
      domEl(doc, 'option', { value: '부가세 별도', text: '부가세 별도' }),
      domEl(doc, 'option', { value: '부가세 포함', text: '부가세 포함' })
    ]);
    var fVatWrap = domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: '부가세' }), vatSel]);
    var fPeriod = mkField('계약·수행 기간(선택)', '예: 2026-11-20 ~ 2026-12-31 / 1년', '계약기간');

    /* 선택적 세부 항목 (기본 접힘으로 화면 간소화!) */
    var fScope = mkField('과업·특약 핵심 내용(선택)', '예: 직장 내 괴롭힘 조사 및 보고서 제출', '과업내용');
    var fStaff = mkField('대상·기준 인원(선택)', '예: 35명', '대상인원');
    var fMgr = mkField('주담당 노무사(선택)', '예: 권형하', '주담당 노무사');
    var fAddr = mkField('사업장 주소(선택)', '업체 선택 시 자동 입력', '사업장 주소');
    var fSucc = mkField('성공보수·분할지급 조건(선택)', '예: 수령금의 15% / 착수 50%·잔금 50%', '성공보수');

    var inputHeadTitle = domEl(doc, 'span', { text: '③ 내용 넣기 — 체크한 서류에 공통 반영 (비운 칸은 서식 밑줄 유지)' });
    var btnMoreFields = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn', style: 'margin-left:auto;padding:3px 9px;min-height:30px;font-size:11.5px',
      'aria-expanded': 'false',
      text: '+ 세부 항목 더 넣기 (과업·인원·주소·담당) ▾',
      onclick: function () { setMoreFieldsOpen(!st.showMoreFields); }
    });
    var extraFieldGrid = domEl(doc, 'div', { 'class': 'pce-fgrid', style: 'margin-top:7px', hidden: true }, [
      fScope.wrap, fStaff.wrap, fMgr.wrap, fAddr.wrap, fSucc.wrap
    ]);
    function setMoreFieldsOpen(open) {
      st.showMoreFields = !!open;
      extraFieldGrid.hidden = !st.showMoreFields;
      btnMoreFields.setAttribute('aria-expanded', st.showMoreFields ? 'true' : 'false');
      btnMoreFields.textContent = st.showMoreFields ? '▲ 세부 항목 접기' : '+ 세부 항목 더 넣기 (과업·인원·주소·담당) ▾';
    }

    var moneyPeriodRow = domEl(doc, 'div', { 'class': 'pce-fgrid', style: 'margin-top:7px' }, [
      fAmt.wrap, fVatWrap, fPeriod.wrap
    ]);
    var partyRow = domEl(doc, 'div', { 'class': 'pce-fgrid', style: 'margin-top:4px' }, [
      fCo.wrap, fCeo.wrap, fWorker.wrap, fBz.wrap
    ]);
    var emptyCheckHint = domEl(doc, 'div', { 'class': 'pce-sub', hidden: true, text: '위에서 [견적서], [계약서], [위임장·부속] 중 만들 서류를 체크하면 입력칸이 열립니다.' });

    function isCaseSelected() {
      if (st.creativeMode) return st.creativeBundle && st.creativeBundle.kind === 'case';
      var curP = WORK_PRESETS.filter(function (p) { return p.id === st.presetId; })[0];
      return !!(curP && curP.kind === 'case');
    }

    function syncInputVisibility() {
      var anyChecked = st.wantQuote || st.wantContract || st.wantPower;
      emptyCheckHint.hidden = anyChecked;
      partyRow.hidden = !anyChecked;
      btnMoreFields.hidden = !anyChecked;
      if (!anyChecked) extraFieldGrid.hidden = true;
      else extraFieldGrid.hidden = !st.showMoreFields;

      var caseMode = isCaseSelected();
      fWorker.wrap.hidden = !caseMode;
      fCeo.wrap.hidden = caseMode;

      var needMoneyOrPeriod = st.wantQuote || st.wantContract;
      moneyPeriodRow.hidden = !anyChecked || !needMoneyOrPeriod;

      if (st.wantQuote && !st.wantContract) {
        inputHeadTitle.textContent = '③ 견적서 내용 넣기 (비운 칸은 서식 밑줄 유지)';
        fAmt.lbl.textContent = '견적 금액(원, 선택)';
        fPeriod.lbl.textContent = '예상 수행기간(선택)';
      } else if (!st.wantQuote && st.wantContract) {
        inputHeadTitle.textContent = '③ 계약서 내용 넣기 (비운 칸은 서식 밑줄 유지)';
        fAmt.lbl.textContent = caseMode ? '착수·계약 보수(원, 선택)' : '계약 보수(원, 선택)';
        fPeriod.lbl.textContent = '계약기간(선택)';
      } else if (!needMoneyOrPeriod && st.wantPower) {
        inputHeadTitle.textContent = '③ 위임장 기본 정보 넣기';
      } else {
        inputHeadTitle.textContent = '③ 내용 넣기 — 견적서·계약서 공통 반영 (비운 칸은 밑줄 유지)';
        fAmt.lbl.textContent = '계약·견적 금액(원, 선택)';
        fPeriod.lbl.textContent = '계약·수행 기간(선택)';
      }
    }

    /* ── 의뢰처 자동완성 + 지난 계약 건수 배지 자동 연동 ── */
    var coSuggestBox = domEl(doc, 'div', { 'class': 'pce-corow' });
    if (ctx.host && ctx.host.cards && typeof ctx.host.cards.rows === 'function') {
      ctx.host.cards.rows().then(function (rows) {
        st.coRows = Array.isArray(rows) ? rows : [];
        if (fCo.inp.value.trim()) drawCoSuggest();
      }, function () {});
    }

    function normCoName(s) {
      return String(s || '').toLowerCase().replace(/\(주\)|㈜|주식회사|\(유\)|\(사\)|\(재\)|\s+/g, '');
    }

    function updateHistoryBadge() {
      if (!st.historyLoaded) return;
      var q = normCoName(fCo.inp.value);
      if (q) {
        var cnt = st.historyAll.filter(function (h) { return normCoName(h.coName).indexOf(q) >= 0; }).length;
        btnHistTab.textContent = cnt > 0
          ? ('📂 지난 계약·견적 검토 (이 업체 ' + cnt + '건)')
          : '📂 지난 계약·견적 검토 (이력 없음)';
      } else {
        btnHistTab.textContent = st.historyAll.length
          ? ('📂 지난 계약·견적 검토 (' + st.historyAll.length + '건)')
          : '📂 지난 계약·견적 검토';
      }
    }

    function ensureHistoryLoaded() {
      if (st.historyLoaded) {
        updateHistoryBadge();
        drawHistoryList();
        return Promise.resolve(st.historyAll);
      }
      histListBox.innerHTML = '';
      histListBox.appendChild(domEl(doc, 'div', { 'class': 'pce-sub', text: '⏳ 지난 계약·견적 이력을 불러오는 중…' }));
      return fetchPastHistory(ctx).then(function (list) {
        st.historyAll = list || [];
        st.historyLoaded = true;
        updateHistoryBadge();
        drawHistoryList();
        return st.historyAll;
      });
    }
    /* 모달 열릴 때 백그라운드로 가볍게 건수 조회 */
    ensureHistoryLoaded();

    function applyHistoryRecord(item, loadedVals) {
      var vals = scrubLoadedVals(loadedVals || {});
      var co = vals['회사명'] || item.coName || '';
      if (co) fCo.inp.value = co;
      if (vals['대표자']) fCeo.inp.value = vals['대표자'];
      if (vals['사업자번호'] || item.bizNo) fBz.inp.value = vals['사업자번호'] || item.bizNo;
      if (vals['주소']) fAddr.inp.value = vals['주소'];
      if (vals['계약금액'] || item.amountText) fAmt.inp.value = vals['계약금액'] || item.amountText;
      if (vals['부가세처리'] || item.vatText) vatSel.value = vals['부가세처리'] || item.vatText;
      var per = vals['계약기간'] || ((vals['계약시작일'] && vals['계약종료일']) ? (vals['계약시작일'] + ' ~ ' + vals['계약종료일']) : '') || item.period || '';
      if (per) fPeriod.inp.value = per;
      if (vals['과업내용'] || item.scope) fScope.inp.value = vals['과업내용'] || item.scope;
      if (vals['대상인원'] || item.staff) fStaff.inp.value = vals['대상인원'] || item.staff;
      if (vals['주담당'] || item.manager) fMgr.inp.value = vals['주담당'] || item.manager;
      if (fScope.inp.value || fAddr.inp.value || fMgr.inp.value || fStaff.inp.value) setMoreFieldsOpen(true);

      var guess = parseBrief((item.kindLabel || '') + ' ' + (item.scope || ''));
      if (guess.presetId && !st.creativeMode) {
        selectPreset(guess.presetId);
      }
      drawCoSuggest();
      updateHistoryBadge();
      notify('✔ 지난 ' + item.badge + ' 내용을 불러왔습니다 — 변경할 금액·기간만 손보세요');
    }

    function withErpDetail(item, cb) {
      if (item.source !== 'erp' || !item.contractId || !ctx.host || typeof ctx.host.contractLoad !== 'function') {
        cb(null);
        return;
      }
      if (st.erpDetailCache[item.contractId]) {
        cb(st.erpDetailCache[item.contractId]);
        return;
      }
      Promise.resolve().then(function () { return ctx.host.contractLoad(item.contractId); })
        .then(function (info) {
          var safeInfo = info ? { contractNo: info.contractNo || '', kinds: info.kinds || [], caseName: info.caseName || '', vals: scrubLoadedVals(info.vals || {}) } : null;
          if (safeInfo) st.erpDetailCache[item.contractId] = safeInfo;
          cb(safeInfo);
        }, function () { cb(null); });
    }

    function drawHistoryList() {
      histListBox.innerHTML = '';
      if (!st.historyLoaded) return;
      var qRaw = histSearchIn.value.trim();
      var qNorm = normCoName(qRaw);
      var filtered = st.historyAll.filter(function (h) {
        if (!qRaw) return true;
        var hay = normCoName(h.coName + ' ' + h.kindLabel + ' ' + h.scope + ' ' + h.date);
        return hay.indexOf(qNorm) >= 0 || (h.coName + ' ' + h.kindLabel + ' ' + h.scope).toLowerCase().indexOf(qRaw.toLowerCase()) >= 0;
      }).slice(0, 25);

      if (!filtered.length) {
        histListBox.appendChild(domEl(doc, 'div', { 'class': 'pce-hitem' }, [
          domEl(doc, 'div', { 'class': 'pce-sub', text: qRaw
            ? ('"' + qRaw + '" 관련 지난 계약·보낸 견적 이력이 없습니다. 구두로 합의한 내용을 바로 넣거나 새 계약서를 창작해 보세요.')
            : '저장된 지난 계약·보낸 견적 이력이 없습니다.' }),
          domEl(doc, 'div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:2px' }, [
            domEl(doc, 'button', { type: 'button', 'class': 'pce-btn mic', text: '🎙 구두로 조건·특약 바로 넣기', onclick: function () { toggleRefPane('verbal'); } }),
            domEl(doc, 'button', { type: 'button', 'class': 'pce-btn soft', text: '✨ 새 계약서 직접 창작하기', onclick: function () { activateCreativeMode(); } })
          ])
        ]));
        return;
      }

      filtered.forEach(function (item) {
        var detBox = domEl(doc, 'div', { 'class': 'pce-hdet', hidden: st.expandedHistKey !== item.uidKey });
        function fillDetText(erpInfo) {
          var v = (erpInfo && erpInfo.vals) || {};
          var lines = [
            '· 구분: ' + item.badge + ' (' + (item.kindLabel || '-') + ')' + (item.date ? ' · 일자: ' + item.date : ''),
            '· 의뢰처: ' + (v['회사명'] || item.coName || '-') + ((v['대표자']) ? ' / 대표: ' + v['대표자'] : '') + ((v['사업자번호'] || item.bizNo) ? ' (' + (v['사업자번호'] || item.bizNo) + ')' : ''),
            '· 금액/조건: ' + ((v['계약금액'] || item.amountText) ? (v['계약금액'] || item.amountText) + '원' : '금액 미기재(또는 비공개)') + ((v['부가세처리'] || item.vatText) ? ' · ' + (v['부가세처리'] || item.vatText) : ''),
            '· 기간/과업: ' + (v['계약기간'] || item.period || '-') + ((v['과업내용'] || item.scope) ? ' / ' + (v['과업내용'] || item.scope) : '')
          ];
          detBox.textContent = lines.join('\n');
        }
        if (st.expandedHistKey === item.uidKey) fillDetText(st.erpDetailCache[item.contractId]);

        var sumParts = [
          item.date || '날짜미상',
          item.coName || '(회사 미기재)',
          item.kindLabel,
          item.amountText ? (item.amountText + '원') : '',
          item.period || item.scope || ''
        ].filter(Boolean).join(' · ');

        histListBox.appendChild(domEl(doc, 'div', { 'class': 'pce-hitem' }, [
          domEl(doc, 'div', { 'class': 'pce-hmain' }, [
            domEl(doc, 'span', { 'class': 'pce-tag ' + (item.source === 'erp' ? 'c' : 'q'), text: item.badge }),
            domEl(doc, 'span', { 'class': 'hsum', title: sumParts, text: sumParts }),
            domEl(doc, 'button', {
              type: 'button', 'class': 'pce-btn', style: 'padding:4px 8px;min-height:32px;font-size:11.5px',
              text: st.expandedHistKey === item.uidKey ? '접기' : '내용 검토',
              onclick: function () {
                if (st.expandedHistKey === item.uidKey) {
                  st.expandedHistKey = '';
                  detBox.hidden = true;
                  drawHistoryList();
                  return;
                }
                st.expandedHistKey = item.uidKey;
                detBox.hidden = false;
                detBox.textContent = '불러오는 중…';
                withErpDetail(item, function (info) { fillDetText(info); });
              }
            }),
            domEl(doc, 'button', {
              type: 'button', 'class': 'pce-btn pri', style: 'padding:4px 9px;min-height:32px;font-size:11.5px',
              text: '이 조건 적용',
              onclick: function () {
                withErpDetail(item, function (info) { applyHistoryRecord(item, info && info.vals); });
              }
            })
          ]),
          detBox
        ]));
      });
    }

    function applyCoRow(r) {
      if (!r) return;
      st.pickedCo = r;
      if (r.c) fCo.inp.value = r.c;
      if (r.ceo && !fCeo.inp.value.trim()) fCeo.inp.value = r.ceo;
      if (r.bz && !fBz.inp.value.trim()) fBz.inp.value = r.bz;
      if (r.adr && !fAddr.inp.value.trim()) fAddr.inp.value = r.adr;
      drawCoSuggest();
      updateHistoryBadge();
      if (st.activeRefTab === 'history') {
        histSearchIn.value = r.c || '';
        drawHistoryList();
      }
    }
    function drawCoSuggest() {
      coSuggestBox.innerHTML = '';
      var q = normCoName(fCo.inp.value);
      if (!q || !st.coRows.length) return;
      var hits = st.coRows.filter(function (r) {
        var nm = normCoName(r && r.c);
        var bz = String((r && r.bz) || '').replace(/\D/g, '');
        return (nm && nm.indexOf(q) >= 0) || (bz && q.length >= 3 && bz.indexOf(q.replace(/\D/g, '')) >= 0);
      }).slice(0, 5);
      hits.forEach(function (r) {
        coSuggestBox.appendChild(domEl(doc, 'button', {
          type: 'button', 'class': 'pce-cochip',
          title: '누르면 대표자·사업자번호·주소를 한 번에 채웁니다',
          text: '🏢 ' + r.c + (r.ceo ? ' · ' + r.ceo : '') + (r.bz ? ' (' + r.bz + ')' : ''),
          onclick: function () { applyCoRow(r); }
        }));
      });
    }
    fCo.inp.addEventListener('input', function () {
      drawCoSuggest();
      updateHistoryBadge();
    });

    function applyVerbalNotes(showToastNow) {
      var vtxt = maskRrnSafe(verbalIn.value.trim());
      if (!vtxt) {
        setStatusMsg(verbalStatus, '먼저 마이크나 글자로 조건·특약을 입력해 주세요.');
        return;
      }
      var res = parseBrief(vtxt);
      var V = res.values;
      if (V['회사명'] && !fCo.inp.value.trim()) fCo.inp.value = V['회사명'];
      if (V['대표자'] && !fCeo.inp.value.trim()) fCeo.inp.value = V['대표자'];
      if (V['사업자번호'] && !fBz.inp.value.trim()) fBz.inp.value = V['사업자번호'];
      if (V['계약금액']) fAmt.inp.value = V['계약금액'];
      if (V['착수금']) st.parsedRetainer = V['착수금'];
      if (V['부가세처리']) vatSel.value = V['부가세처리'];
      if (V['계약기간']) fPeriod.inp.value = V['계약기간'];
      if (V['대상인원']) fStaff.inp.value = V['대상인원'];
      if (V['성공보수']) fSucc.inp.value = V['성공보수'];
      fScope.inp.value = vtxt;
      setMoreFieldsOpen(true);
      if (st.creativeMode) {
        if (!creativeDescIn.value.trim()) creativeDescIn.value = vtxt;
        refreshCreativeBundle();
      } else if (res.presetId) {
        selectPreset(res.presetId);
      }
      drawCoSuggest();
      updateHistoryBadge();
      setStatusMsg(verbalStatus, '✔ 구두 조건을 입력칸과 과업·특약에 반영했습니다.');
      if (showToastNow) notify('✔ 구두 조건을 반영했습니다');
    }

    /* ── 업무 선택 · 서류 체크 · 창작 모드 동기화 ── */
    var btnGo = domEl(doc, 'button', { type: 'button', 'class': 'pce-btn grn', onclick: onConfirm });

    function activateCreativeMode() {
      st.creativeMode = true;
      st.setId = '';
      creativePane.hidden = false;
      saveCreativeWrap.hidden = typeof ctx.onSaveForm !== 'function';
      if (!creativeSubjIn.value.trim() && briefIn.value.trim()) {
        creativeSubjIn.value = extractCreativeTopic(briefIn.value);
      }
      if (!creativeDescIn.value.trim() && (verbalIn.value.trim() || briefIn.value.trim())) {
        creativeDescIn.value = verbalIn.value.trim() || briefIn.value.trim();
      }
      refreshCreativeBundle();
      drawWorkBar();
      syncInputVisibility();
    }

    function currentCreativeHints() {
      return {
        coName: fCo.inp.value,
        ceo: fCeo.inp.value,
        worker: fWorker.inp.value,
        addr: fAddr.inp.value,
        knownCompanies: st.coRows.map(function (r) { return r && r.c; }).filter(Boolean),
        knownPeople: st.coRows.map(function (r) { return r && r.ceo; }).filter(Boolean)
      };
    }

    function refreshCreativeBundle() {
      var bundle = composeCreativeBundle({
        subject: creativeSubjIn.value,
        brief: briefIn.value,
        verbalNotes: creativeDescIn.value || verbalIn.value,
        wantQuote: st.wantQuote,
        wantContract: st.wantContract,
        wantPower: st.wantPower,
        hints: currentCreativeHints()
      });
      st.creativeBundle = bundle;
      creativePreviewTa.value = bundle.contractForm.body;
      st.picked = {};
      bundle.forms.forEach(function (f) { st.picked[f.id] = true; });
      drawDocs();
    }

    function runCreativeDraft(useAi) {
      var spec = {
        subject: creativeSubjIn.value,
        brief: briefIn.value,
        verbalNotes: creativeDescIn.value || verbalIn.value,
        wantQuote: st.wantQuote,
        wantContract: st.wantContract,
        wantPower: st.wantPower,
        hints: currentCreativeHints()
      };
      if (!useAi) {
        refreshCreativeBundle();
        return;
      }
      btnRunCreative.disabled = true;
      creativeStatus.textContent = '⏳ 요청하신 조건에 맞춰 새로운 계약서·견적서 문안을 창조 설계하는 중…';
      draftCreativeBundle(spec, { ai: ctx.ai, auth: ctx.auth, fetch: ctx.fetch }).then(function (bundle) {
        btnRunCreative.disabled = false;
        st.creativeBundle = bundle;
        creativePreviewTa.value = bundle.contractForm.body;
        st.picked = {};
        bundle.forms.forEach(function (f) { st.picked[f.id] = true; });
        if (!fScope.inp.value.trim() && bundle.topic) fScope.inp.value = bundle.topic;
        creativeStatus.textContent = bundle.via === 'ai'
          ? ('✔ AI 맞춤 창작 완료: 「' + bundle.contractForm.name + '」 — 바로 채우거나 본문을 다듬으실 수 있습니다.')
          : ('✔ 맞춤 초안 생성 완료: 「' + bundle.contractForm.name + '」 — 바로 채우거나 [생성 본문 보기·다듬기]로 손보실 수 있습니다.');
        drawDocs();
        syncInputVisibility();
      });
    }

    function rebuildExtraSelect() {
      addExtraSel.innerHTML = '';
      addExtraSel.appendChild(domEl(doc, 'option', { value: '', text: '+ 다른 공용 양식도 이 묶음에 추가하기 (' + forms.length + '종)…' }));
      forms.forEach(function (f) {
        if (st.picked[f.id]) return;
        var r = classifyDocRole(f);
        var tag = r === 'quote' ? '[견적서]' : (r === 'power' ? '[위임장·부속]' : '[계약서]');
        addExtraSel.appendChild(domEl(doc, 'option', { value: f.id, text: f.name + ' ' + tag }));
      });
    }
    addExtraSel.addEventListener('change', function () {
      var id = addExtraSel.value;
      addExtraSel.value = '';
      if (id && byId[id]) {
        st.picked[id] = true;
        drawDocs();
      }
    });

    function baseFormsOfCurrent() {
      if (st.creativeMode && st.creativeBundle) {
        var b = st.creativeBundle;
        return [b.contractForm, b.quoteForm, b.powerForm].filter(Boolean);
      }
      var curSet = sets.filter(function (s) { return s && s.id === st.setId; })[0];
      var baseIds = curSet ? listOf(curSet.formIds) : [];
      return baseIds.map(function (id) { return byId[id]; }).filter(Boolean);
    }

    function currentOrderedForms() {
      var base = baseFormsOfCurrent();
      var seen = {};
      base.forEach(function (f) { seen[f.id] = true; });
      var extras = Object.keys(st.picked).filter(function (id) { return !seen[id] && byId[id]; }).map(function (id) { return byId[id]; });
      return base.concat(extras);
    }

    function applyRoleChecksToPicked() {
      var base = baseFormsOfCurrent();
      var next = {};
      base.forEach(function (f) {
        var r = classifyDocRole(f);
        if (r === 'quote' && st.wantQuote) next[f.id] = true;
        else if (r === 'contract' && st.wantContract) next[f.id] = true;
        else if (r === 'power' && st.wantPower) next[f.id] = true;
      });
      /* 사용자가 수동 추가한 외부 양식은 유지 */
      var baseMap = {};
      base.forEach(function (f) { baseMap[f.id] = true; });
      Object.keys(st.picked).forEach(function (id) {
        if (!baseMap[id] && st.picked[id]) next[id] = true;
      });
      st.picked = next;
      drawDocs();
    }

    function selectPreset(presetId, scopeStr) {
      st.creativeMode = false;
      creativePane.hidden = true;
      saveCreativeWrap.hidden = true;
      if (scopeStr === 'quote') {
        st.wantQuote = true; st.wantContract = false; st.wantPower = false;
      } else if (scopeStr === 'contract') {
        st.wantQuote = false; st.wantContract = true; st.wantPower = true;
      } else if (scopeStr === 'all') {
        st.wantQuote = true; st.wantContract = true; st.wantPower = true;
      }
      ckQuote.checked = st.wantQuote;
      ckContract.checked = st.wantContract;
      ckPower.checked = st.wantPower;

      var rec = recommendBundle(presetId, forms, sets, {
        quote: st.wantQuote,
        contract: st.wantContract,
        power: st.wantPower
      });
      if (rec.preset) st.presetId = rec.preset.id;
      if (rec.set) st.setId = rec.set.id;
      st.picked = {};
      rec.checkedIds.forEach(function (id) { st.picked[id] = true; });
      drawWorkBar();
      drawDocs();
      syncInputVisibility();
    }

    function drawWorkBar() {
      coreChipWrap.innerHTML = '';
      var corePresets = WORK_PRESETS.filter(function (p) { return p.core; });
      var nonCorePresets = WORK_PRESETS.filter(function (p) { return !p.core; });
      var activeNonCore = !st.creativeMode ? nonCorePresets.filter(function (p) { return p.id === st.presetId; })[0] : null;

      corePresets.forEach(function (p) {
        var on = !st.creativeMode && p.id === st.presetId;
        coreChipWrap.appendChild(domEl(doc, 'button', {
          type: 'button', 'class': 'pce-wchip' + (on ? ' on' : ''),
          'aria-pressed': on ? 'true' : 'false',
          title: p.label + ' (' + p.sub + ')',
          text: p.icon + ' ' + p.shortLabel,
          onclick: function () { selectPreset(p.id); }
        }));
      });

      otherPresetSel.innerHTML = '';
      otherPresetSel.appendChild(domEl(doc, 'option', {
        value: '',
        text: activeNonCore ? (activeNonCore.icon + ' ' + activeNonCore.shortLabel + ' ▾') : ('기타 업무 ' + nonCorePresets.length + '종 ▾')
      }));
      nonCorePresets.forEach(function (p) {
        otherPresetSel.appendChild(domEl(doc, 'option', {
          value: p.id,
          selected: !st.creativeMode && p.id === st.presetId,
          text: p.icon + ' ' + p.label
        }));
      });
      otherPresetSel.value = activeNonCore ? activeNonCore.id : '';
      coreChipWrap.appendChild(otherPresetSel);

      coreChipWrap.appendChild(domEl(doc, 'button', {
        type: 'button', 'class': 'pce-wchip newc' + (st.creativeMode ? ' on' : ''),
        'aria-pressed': st.creativeMode ? 'true' : 'false',
        title: '기존 양식에 없는 새로운 계약서·견적서를 말이나 키워드로 즉시 창조 설계합니다',
        text: '✨ 새 계약서 창작',
        onclick: function () { activateCreativeMode(); }
      }));
    }
    otherPresetSel.addEventListener('change', function () {
      if (otherPresetSel.value) selectPreset(otherPresetSel.value);
    });

    function chosenFormsList() {
      return currentOrderedForms().filter(function (f) { return !!st.picked[f.id]; });
    }

    function syncFooter() {
      var chosen = chosenFormsList();
      var cnt = chosen.length;
      docSumNames.textContent = cnt
        ? chosen.map(function (f) { return f.name; }).join(' · ')
        : '(체크된 서류 없음 — 오른쪽 [견적서]·[계약서]를 체크하세요)';
      btnGo.textContent = cnt
        ? ('🚀 선택한 ' + cnt + '종 한 번에 채우기·받기·메일 열기')
        : '만들 서류를 1개 이상 체크해 주세요';
      btnGo.disabled = !cnt;
      rebuildExtraSelect();
    }

    function drawDocs() {
      docListBox.innerHTML = '';
      var list = currentOrderedForms();
      if (!list.length) {
        docListBox.appendChild(domEl(doc, 'div', { 'class': 'pce-sub', style: 'padding:6px', text: '추천 양식이 없습니다 — 아래에서 양식을 추가하거나 [✨ 새 계약서 창작]을 눌러 만드세요.' }));
        syncFooter();
        return;
      }
      list.forEach(function (f) {
        var role = classifyDocRole(f);
        var tagCls = role === 'quote' ? 'q' : (role === 'power' ? 'p' : 'c');
        var tagTxt = role === 'quote' ? '견적서' : (role === 'power' ? '위임장·부속' : '계약서');
        var ck = domEl(doc, 'input', {
          type: 'checkbox', checked: !!st.picked[f.id],
          onchange: function () {
            if (ck.checked) st.picked[f.id] = true; else delete st.picked[f.id];
            syncFooter();
          }
        });
        docListBox.appendChild(domEl(doc, 'label', { 'class': 'pce-docrow' }, [
          ck,
          domEl(doc, 'span', { 'class': 'nm', title: f.name, text: f.name }),
          domEl(doc, 'span', { 'class': 'pce-tag ' + tagCls, text: tagTxt })
        ]));
      });
      syncFooter();
    }

    function runParseBrief() {
      var txt = maskRrnSafe(briefIn.value.trim());
      if (!txt) {
        setStatusMsg(parseStatus, '먼저 위 칸에 회사명·업무·금액·기간을 적거나 [🎙 구두 입력]으로 말씀해 주세요.');
        return;
      }
      briefIn.value = txt;
      var res = parseBrief(txt);
      var V = res.values;
      st.parsedRetainer = V['착수금'] || '';
      if (V['회사명']) fCo.inp.value = V['회사명'];
      if (V['대표자']) fCeo.inp.value = V['대표자'];
      if (V['사업자번호']) fBz.inp.value = V['사업자번호'];
      if (V['계약금액'] || V['견적금액']) fAmt.inp.value = V['계약금액'] || V['견적금액'];
      if (V['부가세처리']) vatSel.value = V['부가세처리'];
      if (V['계약기간']) fPeriod.inp.value = V['계약기간'];
      if (V['대상인원']) fStaff.inp.value = V['대상인원'];
      if (V['과업내용']) fScope.inp.value = V['과업내용'];
      if (V['주담당']) fMgr.inp.value = V['주담당'];
      if (V['근로자명']) fWorker.inp.value = V['근로자명'];
      if (V['성공보수']) fSucc.inp.value = V['성공보수'];

      if (V['대상인원'] || V['성공보수'] || V['주담당']) setMoreFieldsOpen(true);

      if (/새\s*계약|창작|맞춤\s*계약|신규\s*유형/.test(txt) && !res.presetId) {
        creativeSubjIn.value = extractCreativeTopic(txt);
        creativeDescIn.value = txt;
        activateCreativeMode();
      } else if (res.presetId) {
        selectPreset(res.presetId, res.docScope);
      } else {
        var rec = recommendBundle(txt, forms, sets, res.docScope);
        if (rec.preset) {
          selectPreset(rec.preset.id, res.docScope);
        } else {
          /* 기존 프리셋에 뚜렷이 안 잡히는 생소한 업무면 창작 모드로 자연스럽게 연결 */
          creativeSubjIn.value = extractCreativeTopic(txt);
          creativeDescIn.value = txt;
          activateCreativeMode();
        }
      }
      drawCoSuggest();
      updateHistoryBadge();
      if (st.coRows.length && fCo.inp.value.trim()) {
        var qNorm = normCoName(fCo.inp.value);
        var exact = st.coRows.filter(function (r) { return normCoName(r && r.c) === qNorm; });
        if (exact.length === 1) applyCoRow(exact[0]);
      }
      var curP = WORK_PRESETS.filter(function (p) { return p.id === st.presetId; })[0];
      var modeLabel = st.creativeMode ? '✨ 새 계약서 창작' : (curP ? curP.icon + ' ' + curP.shortLabel : '맞춤 묶음');
      setStatusMsg(parseStatus, '✔ 자동 정리 완료 (' + modeLabel + ') — 아래 칸에서 필요한 값만 확인하세요.');
    }

    function buildInitialValues() {
      var init = {};
      function put(k, v) { var s = maskRrnSafe(String(v || '')).trim(); if (s) init[k] = s; }
      put('회사명', fCo.inp.value);
      put('대표자', fCeo.inp.value);
      put('사업자번호', fBz.inp.value);
      put('주소', fAddr.inp.value);
      var amtInputStr = String(fAmt.inp.value || '').trim();
      var parsedAmtNum = parseKoreanMoney(amtInputStr);
      if (!parsedAmtNum) {
        var onlyDigits = amtInputStr.replace(/[^\d]/g, '');
        if (onlyDigits && Number(onlyDigits) > 0) parsedAmtNum = Number(onlyDigits);
      }
      if (parsedAmtNum && parsedAmtNum > 0) {
        var cm = commaNum(parsedAmtNum);
        init['계약금액'] = cm;
        init['견적금액'] = cm;
        init['착수금'] = st.parsedRetainer || cm;
        var kor = numToKorWon(parsedAmtNum);
        if (kor) init['계약금액한글'] = kor;
      } else if (st.parsedRetainer) {
        init['착수금'] = st.parsedRetainer;
      }
      put('부가세처리', vatSel.value);
      var per = fPeriod.inp.value.trim();
      if (per) {
        init['계약기간'] = per;
        var mr = /(20\d{2}-\d{2}-\d{2})\s*~\s*(20\d{2}-\d{2}-\d{2})/.exec(per);
        if (mr) { init['계약시작일'] = mr[1]; init['계약종료일'] = mr[2]; }
      }
      var stf = fStaff.inp.value.trim();
      if (stf) {
        init['대상인원'] = /\d$/.test(stf) ? (stf + '명') : stf;
        var stfNum = stf.replace(/\D/g, '');
        if (stfNum) init['기준인원'] = stfNum;
      }
      put('과업내용', fScope.inp.value || (st.creativeMode && st.creativeBundle ? st.creativeBundle.topic : ''));
      put('주담당', fMgr.inp.value);
      if (fWorker.inp.value.trim()) {
        put('근로자명', fWorker.inp.value);
        put('근로자이름', fWorker.inp.value);
      }
      if (fSucc.inp.value.trim()) {
        put('성공보수', fSucc.inp.value);
        var mp = /(\d+(?:\.\d+)?%)/.exec(fSucc.inp.value);
        if (mp) init['성공보수율'] = mp[1];
      }
      var d = new Date();
      init['계약일'] = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      return init;
    }

    function onConfirm() {
      var chosen = chosenFormsList();
      if (!chosen.length) { notify('만들 서류를 하나 이상 체크해 주세요'); return; }
      var init = buildInitialValues();
      var curP = WORK_PRESETS.filter(function (p) { return p.id === st.presetId; })[0];
      var title = st.creativeMode
        ? ('✨ ' + ((st.creativeBundle && st.creativeBundle.topic) || '창작 계약·견적 묶음'))
        : (curP ? (curP.icon + ' ' + curP.shortLabel) : '맞춤 서류 묶음');

      var saveP = Promise.resolve();
      if (st.creativeMode && saveCreativeCk.checked && typeof ctx.onSaveForm === 'function' && st.creativeBundle) {
        var targetSid = st.creativeBundle.setId || '';
        var saveHints = currentCreativeHints();
        saveP = chosen.reduce(function (p, fm) {
          var sharedCopy = sanitizeFormForSharedSave(fm, saveHints);
          return p.then(function () { return ctx.onSaveForm(sharedCopy, targetSid); });
        }, Promise.resolve());
      } else if (!st.creativeMode && typeof ctx.onPickSet === 'function' && st.setId) {
        try { ctx.onPickSet(st.setId, chosen.map(function (f) { return f.id; })); } catch (_) {}
      }

      saveP.then(function () {
        close(true);
        var retFocus = (prevFocus && prevFocus.isConnected === false && doc.querySelector) ? (doc.querySelector('.pcf-qbar-go') || prevFocus) : prevFocus;
        if (typeof ctx.openFill === 'function') {
          ctx.openFill(chosen, ctx.host, title, {
            coName: init['회사명'] || '',
            bizNo: init['사업자번호'] || '',
            initial: init,
            returnFocus: retFocus
          });
        }
      }, function (e) {
        notify('⚠ 양식 저장 실패 — ' + ((e && e.message) || e));
      });
    }

    var md = domEl(doc, 'div', { 'class': 'pce-m', role: 'dialog', 'aria-modal': 'true', 'aria-label': '한 번에 계약·견적 정리 및 만들기' }, [
      domEl(doc, 'div', { 'class': 'pce-mh' }, [
        domEl(doc, 'b', { text: '⚡ 계약·견적 간편 만들기 — 업무·서류만 체크하면 한 번에 완성' }),
        domEl(doc, 'button', { type: 'button', 'class': 'pce-x', 'aria-label': '닫기', text: '×', onclick: function () { close(); } })
      ]),
      domEl(doc, 'div', { 'class': 'pce-mb' }, [
        /* ① 한 줄 메모·문의글 + 구두 입력 */
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-qrow' }, [
            briefIn,
            btnBriefMic,
            domEl(doc, 'button', { type: 'button', 'class': 'pce-btn pri', text: '🪄 자동 정리', onclick: runParseBrief })
          ]),
          parseStatus
        ]),
        /* ② 업무 1~2줄 간략 선택 + 바로 옆 견적서·계약서·위임장 체크 */
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-workbar' }, [
            coreChipWrap,
            domEl(doc, 'div', { 'class': 'pce-rchecks', role: 'group', 'aria-label': '만들 서류 종류 체크' }, [
              domEl(doc, 'label', { 'class': 'pce-rck' }, [ckQuote, domEl(doc, 'span', { text: '견적서' })]),
              domEl(doc, 'label', { 'class': 'pce-rck' }, [ckContract, domEl(doc, 'span', { text: '계약서' })]),
              domEl(doc, 'label', { 'class': 'pce-rck' }, [ckPower, domEl(doc, 'span', { text: '위임장·부속' })])
            ])
          ]),
          domEl(doc, 'div', { 'class': 'pce-docsum' }, [
            domEl(doc, 'b', { text: '📄 포함 서류:' }),
            docSumNames,
            btnToggleDocs
          ]),
          docDetailWrap
        ]),
        /* ✨ 새 계약서 창작 작업대 (선택 시만 표시) */
        creativePane,
        /* 보조 참고·구두 입력 토글 바 */
        domEl(doc, 'div', { 'class': 'pce-refbar' }, [
          btnHistTab,
          btnVerbalTab,
          domEl(doc, 'span', { 'class': 'pce-sub', text: '전에 한 계약을 검토해 그대로 쓰거나, 구두 협의 내용을 말로 바로 넣으세요.' })
        ]),
        histPane,
        verbalPane,
        /* ③ 체크한 서류 맞춤 핵심 입력칸 */
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-sh' }, [
            inputHeadTitle,
            btnMoreFields
          ]),
          emptyCheckHint,
          coSuggestBox,
          partyRow,
          moneyPeriodRow,
          extraFieldGrid
        ])
      ]),
      domEl(doc, 'div', { 'class': 'pce-mf' }, [
        saveCreativeWrap,
        domEl(doc, 'span', { 'class': 'pce-sub', style: 'margin-right:auto', text: '다음 창에서 한글(.hwpx)·묶음(.zip)·인쇄·메일 발송까지 바로 처리됩니다.' }),
        domEl(doc, 'button', { type: 'button', 'class': 'pce-btn', text: '취소', onclick: function () { close(); } }),
        btnGo
      ])
    ]);

    bg.appendChild(md);
    doc.body.appendChild(bg);
    unbindKeys = bindModalKeys(doc, md, function () { close(); });

    selectPreset(st.presetId, 'all');
    if (ctx.initialText && String(ctx.initialText).trim()) runParseBrief();
    try { briefIn.focus(); } catch (_) {}
    if (ctx.autoVoice) toggleVoice('brief', briefIn, parseStatus, true);
    return { close: close };
  }

  /* ══ 모달 2: ✨ 쉽게 새 양식 만들기 마법사 (파일·문안 자동 변환 + 10초 표준 조립 + 구두·AI 창조 양식 생성) ══ */
  function openEasyFormWizard(ctx) {
    ctx = ctx || {};
    var doc = ctx.doc || (w && w.document);
    if (!doc || !doc.body) return null;
    ensureEasyCss(doc);

    var prevFocus = ctx.returnFocus || doc.activeElement;
    var kinds = (ctx.kinds || []).filter(function (k) { return k.v !== '_closed'; });
    if (!kinds.length) {
      kinds = [
        { v: 'company', label: '업체계약', icon: '🏢' },
        { v: 'case', label: '사건계약', icon: '⚖️' },
        { v: 'consulting', label: '컨설팅계약', icon: '📊' },
        { v: 'fund', label: '기금관리', icon: '🏛️' },
        { v: 'other', label: '기타사업', icon: '📋' },
        { v: 'consult', label: '상담사항', icon: '📞' }
      ];
    }
    var sets = ctx.sets || [];
    var notify = ctx.toast || function () {};

    var mode = 'convert'; // 'convert' | 'assemble' | 'creative'
    var stagedFile = null;
    var pendingFiles = 0;
    var busy = false;
    var wizVoiceStop = null;
    var wizCoRows = [];
    if (ctx.host && ctx.host.cards && typeof ctx.host.cards.rows === 'function') {
      ctx.host.cards.rows().then(function (rows) { wizCoRows = Array.isArray(rows) ? rows : []; }, function () {});
    }

    var bg = domEl(doc, 'div', { 'class': 'pce-mbg' });
    var unbindKeys = null;
    function stopWizVoice() {
      if (wizVoiceStop) {
        var sp = wizVoiceStop;
        wizVoiceStop = null;
        sp.stop();
        btnWizMic.className = 'pce-btn mic';
        btnWizMic.setAttribute('aria-pressed', 'false');
        btnWizMic.textContent = '🎙 구두로 설명 말하기';
      }
    }
    function close() {
      stopWizVoice();
      if (unbindKeys) { unbindKeys(); unbindKeys = null; }
      bg.remove();
      if (prevFocus && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus(); } catch (_) {}
      }
    }
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });

    var tabConvert = domEl(doc, 'button', { type: 'button', 'class': 'pce-tab on', 'aria-pressed': 'true', text: '📎 기존 파일·문안 → 자동 {{변수}} 변환', onclick: function () { setMode('convert'); } });
    var tabAssemble = domEl(doc, 'button', { type: 'button', 'class': 'pce-tab', 'aria-pressed': 'false', text: '🧩 조항 체크로 10초 표준 양식 조립', onclick: function () { setMode('assemble'); } });
    var tabCreative = domEl(doc, 'button', { type: 'button', 'class': 'pce-tab', 'aria-pressed': 'false', text: '✨ 구두·AI로 새로운 양식 창작', onclick: function () { setMode('creative'); } });

    var nameIn = domEl(doc, 'input', { type: 'text', 'class': 'pce-in', placeholder: '예: 외국인 근로자 노무관리 용역계약서 (푸른 표준)', 'aria-label': '새 양식 이름' });
    var kindSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '계약 분류' }, kinds.map(function (k) {
      return domEl(doc, 'option', { value: k.v, text: (k.icon || '') + ' ' + k.label, selected: k.v === (ctx.defaultKind || 'company') });
    }));
    kindSel.value = ctx.defaultKind || 'company';
    var roleSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '문서 구분' }, [
      domEl(doc, 'option', { value: '계약서', text: '📑 계약서·약정서·위임장' }),
      domEl(doc, 'option', { value: PROPOSAL_GROUP, text: '🧾 견적서·제안서' })
    ]);
    var setSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '함께 넣을 하위 세트' });
    function rebuildSetOptions(selectedId) {
      var curVal = selectedId !== undefined ? selectedId : setSel.value;
      setSel.innerHTML = '';
      setSel.appendChild(domEl(doc, 'option', { value: '', text: '(선택 안 함 — 양식 목록에만 등록)' }));
      sets.forEach(function (s) {
        setSel.appendChild(domEl(doc, 'option', { value: s.id, text: '📦 ' + s.name, selected: s.id === curVal }));
      });
      setSel.value = curVal || '';
    }
    rebuildSetOptions('');

    /* 모드 A: 파일 올리기 + 기존 값 → {{변수}} 원클릭 변환 */
    var fileStatus = domEl(doc, 'span', { 'class': 'pce-sub', role: 'status', 'aria-live': 'polite', text: '한글(.hwpx/.hwp)·워드·PDF 파일을 고르면 브라우저 안에서 본문만 뽑아 자동으로 {{변수}}로 변환합니다.' });
    var fileIn = domEl(doc, 'input', {
      type: 'file', accept: '.hwpx,.hwp,.docx,.doc,.pdf,.xlsx,.xls', hidden: true, style: 'display:none',
      onchange: function (e) { handleFiles(e.target.files); e.target.value = ''; }
    });
    var filePickBtn = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn soft',
      text: '📎 기존 파일에서 본문 뽑기 (.hwpx/.hwp/.docx/.pdf)',
      onclick: function () { if (typeof fileIn.click === 'function') fileIn.click(); }
    });
    var attachRawCk = domEl(doc, 'input', { type: 'checkbox', 'aria-label': '빈 공용 서식 원본 파일도 함께 첨부' });
    var attachRawRow = domEl(doc, 'label', { 'class': 'pce-cklbl', style: 'margin-top:8px', hidden: true }, [
      attachRawCk,
      domEl(doc, 'span', { text: '빈 공용 서식 원본 파일임 확인 — 원본 파일도 양식·보관함에 함께 첨부 (개인·거래처 정보가 든 파일은 체크하지 마세요)' })
    ]);
    var oldCoIn = domEl(doc, 'input', { type: 'text', 'class': 'pce-in', placeholder: '문서에 적혀 있던 예전 회사명 (예: 가나상사 → {{회사명}})', 'aria-label': '치환할 예전 회사명' });
    var oldCeoIn = domEl(doc, 'input', { type: 'text', 'class': 'pce-in', placeholder: '예전 대표자명 (→ {{대표자}})', 'aria-label': '치환할 예전 대표자명' });
    var oldWorkerIn = domEl(doc, 'input', { type: 'text', 'class': 'pce-in', placeholder: '예전 근로자명 (→ {{근로자명}})', 'aria-label': '치환할 예전 근로자명' });
    var convertNote = domEl(doc, 'div', { 'class': 'pce-sub', role: 'status', 'aria-live': 'polite', style: 'margin-top:6px' });

    var convertPane = domEl(doc, 'div', { 'class': 'pce-sec' }, [
      domEl(doc, 'div', { 'class': 'pce-sh' }, [filePickBtn, fileIn, fileStatus]),
      attachRawRow,
      domEl(doc, 'div', { 'class': 'pce-fgrid', style: 'margin-top:8px' }, [
        domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: '문서 속 예전 회사명 (선택)' }), oldCoIn]),
        domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: '문서 속 예전 대표자명 (선택)' }), oldCeoIn]),
        domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: '문서 속 예전 근로자명 (선택)' }), oldWorkerIn])
      ]),
      domEl(doc, 'div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px' }, [
        domEl(doc, 'button', { type: 'button', 'class': 'pce-btn pri', text: '🪄 본문 속 날짜·금액·사업자번호·이름 → {{변수}} 한 번에 변환', onclick: runAutoTemplatize }),
        convertNote
      ])
    ]);

    /* 모드 B: 10초 표준 조항 조립기 */
    var docTypeSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '조립할 문서 기본 틀' }, [
      domEl(doc, 'option', { value: 'contract', text: '📑 위탁·자문·용역 계약서 표준 틀', selected: true }),
      domEl(doc, 'option', { value: 'quote', text: '🧾 견적서·제안서 표준 틀' }),
      domEl(doc, 'option', { value: 'case', text: '⚖ 사건 대리 위임약정서 표준 틀' }),
      domEl(doc, 'option', { value: 'agree', text: '🔄 계약 변경·연장 합의서 표준 틀' })
    ]);
    docTypeSel.value = 'contract';
    var clauseDefs = [
      { k: 'scope', label: '과업 범위·대상인원', on: true },
      { k: 'period', label: '계약·수행 기간', on: true },
      { k: 'autoRenew', label: '1년 자동 연장 조항', on: true },
      { k: 'fee', label: '보수 금액·부가세', on: true },
      { k: 'successFee', label: '성공·성과 보수 약정', on: false },
      { k: 'lateInterest', label: '지연이자 (연 12%의 이자)', on: false },
      { k: 'materials', label: '자료 제공 및 면책', on: true },
      { k: 'nda', label: '비밀 유지 조항', on: true },
      { k: 'account', label: '푸른 입금계좌 안내', on: true },
      { k: 'lawyers', label: '재직 공인노무사 명단 연동', on: false }
    ];
    var clauseChecks = {};
    var clauseGrid = domEl(doc, 'div', { 'class': 'pce-cgrid' }, clauseDefs.map(function (cd) {
      var ck = domEl(doc, 'input', { type: 'checkbox', checked: cd.on });
      clauseChecks[cd.k] = ck;
      return domEl(doc, 'label', { 'class': 'pce-cklbl' }, [ck, domEl(doc, 'span', { text: cd.label })]);
    }));
    docTypeSel.addEventListener('change', function () {
      var dt = docTypeSel.value;
      clauseChecks.successFee.checked = dt === 'case';
      clauseChecks.lateInterest.checked = dt === 'case';
      clauseChecks.lawyers.checked = dt === 'case';
      clauseChecks.autoRenew.checked = dt === 'contract';
      roleSel.value = dt === 'quote' ? PROPOSAL_GROUP : '계약서';
    });

    var assemblePane = domEl(doc, 'div', { 'class': 'pce-sec', hidden: true }, [
      domEl(doc, 'div', { 'class': 'pce-sh' }, [
        domEl(doc, 'span', { text: '문서 틀과 넣을 조항만 체크하고 [🧩 표준 본문 한 번에 조립]을 누르면 즉시 만들어집니다.' })
      ]),
      domEl(doc, 'div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px' }, [
        domEl(doc, 'div', { style: 'min-width:240px' }, [docTypeSel]),
        domEl(doc, 'button', { type: 'button', 'class': 'pce-btn pri', text: '🧩 체크한 조항으로 표준 본문 한 번에 조립', onclick: runAssemble })
      ]),
      clauseGrid
    ]);

    /* 모드 C: ✨ 구두·AI로 새로운 맞춤형 양식 창작 */
    var wizPromptIn = domEl(doc, 'textarea', {
      'class': 'pce-ta', rows: '2', 'aria-label': '창작할 양식 설명',
      placeholder: '어떤 새로운 양식을 만들지 글이나 말로 설명해 주세요 — 예: "사내 하도급 적법성 정기점검 및 개선 자문 계약서, 분기별 보고서 제출, 착수금·잔금 50%씩 지급"'
    });
    var wizCreativeNote = domEl(doc, 'span', { 'class': 'pce-sub', role: 'status', 'aria-live': 'polite', text: '구두 또는 글로 설명하면 표준 {{변수}}가 갖춰진 새 양식 본문을 창조 생성합니다.' });
    var btnWizMic = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn mic', 'aria-pressed': 'false',
      text: '🎙 구두로 설명 말하기',
      onclick: function () {
        if (wizVoiceStop) { stopWizVoice(); return; }
        var before = wizPromptIn.value.trim();
        wizCreativeNote.textContent = '🔴 말씀하세요… 어떤 양식을 만들까요? (⚠ 주민번호·계좌번호 발화 금지)';
        var h = startVoiceInput({
          confirm: ctx.confirmVoice,
          onText: function (txt, fin) {
            wizPromptIn.value = joinSpokenText(before, txt);
            wizCreativeNote.textContent = fin ? ('✔ 구두 입력 완료: ' + txt) : ('🔴 듣는 중: ' + txt);
          },
          onError: function (msg) { stopWizVoice(); wizCreativeNote.textContent = '💡 ' + msg; },
          onEnd: function () { stopWizVoice(); }
        }, ctx.speechRec);
        if (h) {
          wizVoiceStop = h;
          btnWizMic.className = 'pce-btn mic rec';
          btnWizMic.setAttribute('aria-pressed', 'true');
          btnWizMic.textContent = '⏹ 말하기 완료';
        }
      }
    });
    var btnWizDraft = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn grn',
      text: '✨ 맞춤 양식 본문 창조 생성',
      onclick: function () {
        var desc = wizPromptIn.value.trim() || nameIn.value.trim();
        if (!desc) { notify('만들고 싶은 양식 주제나 조건을 간단히 적거나 말씀해 주세요'); wizPromptIn.focus(); return; }
        btnWizDraft.disabled = true;
        wizCreativeNote.textContent = '⏳ 새로운 양식 본문을 창조 설계하는 중…';
        var wantQ = roleSel.value === PROPOSAL_GROUP || /견적서|제안서/.test(nameIn.value);
        draftCreativeBundle({
          subject: nameIn.value.trim(),
          brief: desc,
          verbalNotes: '',
          wantQuote: wantQ,
          wantContract: !wantQ,
          hints: {
            oldCompany: oldCoIn.value,
            coName: oldCoIn.value,
            ceo: oldCeoIn.value,
            worker: oldWorkerIn.value,
            knownCompanies: wizCoRows.map(function (r) { return r && r.c; }).filter(Boolean),
            knownPeople: wizCoRows.map(function (r) { return r && r.ceo; }).filter(Boolean)
          }
        }, { ai: ctx.ai, auth: ctx.auth, fetch: ctx.fetch }).then(function (bundle) {
          btnWizDraft.disabled = false;
          var pickedFm = wantQ ? bundle.quoteForm : bundle.contractForm;
          bodyIn.value = pickedFm.body;
          if (!nameIn.value.trim()) nameIn.value = pickedFm.name;
          autoDetectMeta();
          wizCreativeNote.textContent = '✔ 「' + pickedFm.name + '」 본문을 생성했습니다 — 아래에서 확인 후 저장하세요.';
        });
      }
    });
    var creativeWizPane = domEl(doc, 'div', { 'class': 'pce-sec', style: 'background:#f0fdf4;border-color:#bbf7d0', hidden: true }, [
      domEl(doc, 'div', { 'class': 'pce-sh' }, [btnWizMic, btnWizDraft, wizCreativeNote]),
      wizPromptIn
    ]);

    /* 본문 편집기 + 자주 쓰는 변수 원클릭 칩 */
    var bodyIn = domEl(doc, 'textarea', {
      'class': 'pce-ta', rows: '10', 'aria-label': '양식 본문',
      placeholder: '기존 문안을 붙여넣고 [🪄 {{변수}} 한 번에 변환]을 누르거나, 위 탭에서 [조항 조립] · [새로운 양식 창작]을 이용하세요.'
    });
    var quickVars = ['{{회사명}}', '{{사업자번호}}', '{{대표자}}', '{{주소}}', '{{담당자}}', '{{계약금액}}', '{{계약금액한글}}', '{{부가세처리}}', '{{계약기간}}', '{{계약시작일}}', '{{계약종료일}}', '{{과업내용}}', '{{대상인원}}', '{{성공보수}}', '{{근로자명}}', '{{주담당}}', '{{공인노무사명단}}', '{{계약일}}'];
    var varChipBar = domEl(doc, 'div', { 'class': 'pce-vchips' }, quickVars.map(function (code) {
      return domEl(doc, 'button', {
        type: 'button', 'class': 'pce-vchip', title: '커서 자리에 ' + code + ' 넣기', text: code,
        onclick: function () {
          var s = bodyIn.selectionStart || bodyIn.value.length, e = bodyIn.selectionEnd || s;
          bodyIn.value = bodyIn.value.slice(0, s) + code + bodyIn.value.slice(e);
          bodyIn.focus();
          try { bodyIn.selectionStart = bodyIn.selectionEnd = s + code.length; } catch (_) {}
        }
      });
    }));

    function autoDetectMeta() {
      var meta = guessFormMeta(nameIn.value, bodyIn.value, sets);
      if (kinds.some(function (k) { return k.v === meta.kind; })) kindSel.value = meta.kind;
      roleSel.value = meta.isQuote ? PROPOSAL_GROUP : '계약서';
      if (meta.setId) rebuildSetOptions(meta.setId);
    }
    nameIn.addEventListener('change', autoDetectMeta);

    function setMode(m) {
      mode = m;
      [
        [tabConvert, 'convert'],
        [tabAssemble, 'assemble'],
        [tabCreative, 'creative']
      ].forEach(function (pair) {
        var on = pair[1] === m;
        pair[0].className = 'pce-tab' + (on ? ' on' : '');
        pair[0].setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      convertPane.hidden = m !== 'convert';
      assemblePane.hidden = m !== 'assemble';
      creativeWizPane.hidden = m !== 'creative';
    }

    function runAutoTemplatize() {
      if (!bodyIn.value.trim()) {
        notify('먼저 본문 칸에 기존 문안을 붙여넣거나 파일을 불러와 주세요');
        bodyIn.focus();
        return;
      }
      var res = templatizeText(bodyIn.value, {
        oldCompany: oldCoIn.value,
        oldCeo: oldCeoIn.value,
        oldWorker: oldWorkerIn.value
      });
      bodyIn.value = res.text;
      autoDetectMeta();
      convertNote.textContent = '✔ ' + res.replacedCount + '곳을 {{변수}}로 자동 변환했습니다 · 현재 포함된 변수: ' + (res.vars.length ? res.vars.join(', ') : '없음');
    }

    function runAssemble() {
      var cls = {};
      Object.keys(clauseChecks).forEach(function (k) { cls[k] = !!clauseChecks[k].checked; });
      bodyIn.value = buildStandardTemplate({
        docType: docTypeSel.value,
        title: nameIn.value.trim(),
        clauses: cls
      });
      if (!nameIn.value.trim()) {
        nameIn.value = docTypeSel.value === 'quote' ? '신규 업무 표준 견적서' : docTypeSel.value === 'case' ? '신규 사건 위임약정서 (푸른 표준)' : '신규 업무 위탁계약서 (푸른 표준)';
      }
      autoDetectMeta();
      notify('표준 양식 본문을 한 번에 조립했습니다');
    }

    function handleFiles(fileList) {
      var arr = Array.prototype.slice.call(fileList || []);
      if (!arr.length) return;
      var file = arr[0];
      var safeFileName = maskRrnSafe(String(file.name || ''));
      stagedFile = file;
      attachRawCk.checked = false;
      attachRawRow.hidden = false;
      if (!nameIn.value.trim()) nameIn.value = safeFileName.replace(/\.[^.]+$/, '');
      pendingFiles++;
      fileStatus.textContent = '⏳ 브라우저 안에서 본문 뽑는 중… (' + safeFileName + ')';

      var textP = new Promise(function (res) {
        if (typeof ctx.extractTemplateText !== 'function') { res(''); return; }
        ctx.extractTemplateText(file, function (txt, err) { res(err ? '' : String(txt || '')); });
      });

      textP.then(function (txt) {
        pendingFiles--;
        if (txt) {
          var conv = templatizeText(txt, { oldCompany: oldCoIn.value, oldCeo: oldCeoIn.value, oldWorker: oldWorkerIn.value });
          bodyIn.value = conv.text;
          convertNote.textContent = '✔ 파일 본문 추출 및 ' + conv.replacedCount + '곳 자동 {{변수}} 변환 완료 (개인정보 보호를 위해 원본 파일은 기본 미첨부)';
        } else if (!bodyIn.value.trim()) {
          bodyIn.value = '수신: {{회사명}} (대표 {{대표자}})\n과업: {{과업내용}}\n금액: 금 {{계약금액}}원 ({{부가세처리}})\n기간: {{계약기간}}\n작성일: {{계약일}}\n';
        }
        autoDetectMeta();
        fileStatus.textContent = '✔ 본문 추출 완료: ' + safeFileName;
      }, function () {
        pendingFiles--;
        fileStatus.textContent = '⚠ 파일 글자를 읽지 못했습니다 — 본문을 직접 붙여넣거나 조항 조립을 이용해 주세요.';
      });
    }

    var btnSave = domEl(doc, 'button', { type: 'button', 'class': 'pce-btn grn', text: '💾 양식 저장 (+ 하위 세트 자동 반영)', onclick: onSave });
    function onSave() {
      if (busy) return;
      if (pendingFiles > 0) { notify('파일을 읽는 중입니다 — 잠시 후 저장해 주세요'); return; }
      var wizHints = {
        oldCompany: oldCoIn.value,
        coName: oldCoIn.value,
        ceo: oldCeoIn.value,
        worker: oldWorkerIn.value,
        knownCompanies: wizCoRows.map(function (r) { return r && r.c; }).filter(Boolean),
        knownPeople: wizCoRows.map(function (r) { return r && r.ceo; }).filter(Boolean)
      };
      var nm = maskRrnSafe(nameIn.value).trim();
      var bd = maskRrnSafe(bodyIn.value);
      if (mode === 'creative') {
        var cleanWiz = sanitizeFormForSharedSave({ name: nm, body: bd }, wizHints);
        nm = cleanWiz.name;
        bd = cleanWiz.body;
      }
      if (!nm) { notify('새 양식 이름을 넣어 주세요'); nameIn.focus(); return; }
      if (!bd.trim()) { notify('양식 본문을 넣어 주세요 ([표준 본문 조립] 또는 [새로운 양식 창작]을 누르면 자동 생성됩니다)'); bodyIn.focus(); return; }

      var meta = guessFormMeta(nm, bd, sets);
      var kVal = kindSel.value || meta.kind || 'company';
      var isQuote = roleSel.value === PROPOSAL_GROUP;
      if (isQuote && (kVal === 'case' || kVal === 'consult')) kVal = 'other';

      if (typeof ctx.onSaveForm !== 'function') { close(); return; }
      busy = true; btnSave.disabled = true;

      var wantRaw = !!(stagedFile && attachRawCk.checked && mode === 'convert');
      var prepP = wantRaw ? (function () {
        var f = stagedFile;
        var safeRawName = maskRrnSafe(String(f.name || ''));
        var arcTarget = f;
        if (safeRawName !== f.name) {
          if (typeof Blob === 'function' && f instanceof Blob && typeof File === 'function') {
            arcTarget = new File([f], safeRawName, { type: f.type || '' });
          } else {
            arcTarget = Object.assign({}, f, { name: safeRawName });
          }
        }
        var readerP = new Promise(function (res) {
          if (f.size > 1024 * 1024 || typeof FileReader === 'undefined') { res(''); return; }
          var fr = new FileReader();
          fr.onload = function () { res(String(fr.result || '')); };
          fr.onerror = function () { res(''); };
          fr.readAsDataURL(f);
        });
        var arcP = typeof ctx.archiveFile === 'function'
          ? ctx.archiveFile(arcTarget, { kind: 'form', formName: nm, formKind: kVal, safeName: safeRawName })
          : Promise.resolve({});
        return Promise.all([readerP, arcP]).then(function (got) {
          var dataUrl = got[0], arc = got[1] || {};
          var attId = 'at-' + Date.now().toString(36);
          return {
            attachments: dataUrl ? [{ id: attId, name: safeRawName, size: f.size, type: f.type || '', data: dataUrl }] : [],
            originals: arc.fileId ? [{ attId: dataUrl ? attId : '', fileId: arc.fileId, name: safeRawName, size: f.size }] : []
          };
        });
      })() : Promise.resolve({ attachments: [], originals: [] });

      prepP.then(function (fileMeta) {
        var fmObj = {
          id: 'fm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          kind: kVal,
          name: nm.slice(0, 120),
          body: bd,
          enabled: true,
          createdAt: (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })(),
          attachments: fileMeta.attachments,
          originals: fileMeta.originals
        };
        if (kVal === 'company' || kVal === 'consulting' || kVal === 'fund' || kVal === 'other') {
          fmObj.groupName = isQuote ? PROPOSAL_GROUP : '계약서';
        } else if (kVal === 'case') {
          fmObj.groupName = meta.groupName || '기타';
          if (meta.side) fmObj.side = meta.side;
        }
        return Promise.resolve(ctx.onSaveForm(fmObj, setSel.value || ''));
      }).then(function () {
        busy = false;
        close();
      }, function (e) {
        busy = false; btnSave.disabled = false;
        notify('⚠ 저장 실패 — ' + ((e && e.message) || e));
      });
    }

    var md = domEl(doc, 'div', { 'class': 'pce-m', role: 'dialog', 'aria-modal': 'true', 'aria-label': '쉽게 새 양식 만들기' }, [
      domEl(doc, 'div', { 'class': 'pce-mh' }, [
        domEl(doc, 'b', { text: '✨ 쉽게 새 양식 만들기 — 자동 {{변수}} 변환 · 조항 조립 · 구두/AI 창작' }),
        domEl(doc, 'button', { type: 'button', 'class': 'pce-x', 'aria-label': '닫기', text: '×', onclick: function () { close(); } })
      ]),
      domEl(doc, 'div', { 'class': 'pce-mb' }, [
        domEl(doc, 'div', { 'class': 'pce-tabs' }, [tabConvert, tabAssemble, tabCreative]),
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-fgrid' }, [
            domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: '새 양식 이름 *' }), nameIn]),
            domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: '상위 분류 (자동 추천됨)' }), kindSel]),
            domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: '문서 역할' }), roleSel])
          ]),
          domEl(doc, 'div', { 'class': 'pce-fg', style: 'margin-top:8px' }, [
            domEl(doc, 'label', { text: '함께 묶어 둘 동종 하위 세트 (선택 시 견적서·계약서 세트에 자동 편입)' }),
            setSel
          ])
        ]),
        convertPane,
        assemblePane,
        creativeWizPane,
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-sh' }, [
            domEl(doc, 'span', { text: '양식 본문 ({{변수}} 칩을 누르면 커서 위치에 바로 들어갑니다 · 주민번호 자동 가림)' })
          ]),
          varChipBar,
          domEl(doc, 'div', { style: 'margin-top:6px' }, [bodyIn])
        ])
      ]),
      domEl(doc, 'div', { 'class': 'pce-mf' }, [
        domEl(doc, 'button', { type: 'button', 'class': 'pce-btn', text: '취소', onclick: function () { close(); } }),
        btnSave
      ])
    ]);

    bg.appendChild(md);
    doc.body.appendChild(bg);
    unbindKeys = bindModalKeys(doc, md, function () { close(); });
    if (ctx.initialMode === 'creative') setMode('creative');
    try { nameIn.focus(); } catch (_) {}
    return { close: close };
  }

  return {
    WORK_PRESETS: WORK_PRESETS,
    classifyDocRole: classifyDocRole,
    numToKorWon: numToKorWon,
    parseKoreanMoney: parseKoreanMoney,
    parseBrief: parseBrief,
    speechSupported: speechSupported,
    startVoiceInput: startVoiceInput,
    searchAll: searchAll,
    recommendBundle: recommendBundle,
    templatizeText: templatizeText,
    guessFormMeta: guessFormMeta,
    buildStandardTemplate: buildStandardTemplate,
    composeCreativeBundle: composeCreativeBundle,
    draftCreativeBundle: draftCreativeBundle,
    fetchPastHistory: fetchPastHistory,
    openQuickMakeModal: openQuickMakeModal,
    openEasyFormWizard: openEasyFormWizard
  };
});
