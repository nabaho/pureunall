/* ══ 계약서·견적서 원스톱 자동 정리 & 쉬운 양식 만들기 (2026-11-16) ══
   ■ 왜 필요한가 (대표 지시 2026-11-16)
     「계약서 관리에서 사람이 모든 계약서를 클릭해서 찾아야 한다. 이건 너무 찾기 어렵다.
      어떻게 자동화하고 쉽게 담당자가 계약서 양식을 만들 수 있는지 검토하고,
      최대한 쉽게 한 번에 내용을 모두 정리해서 넣을 수 있게 만들어라.」
   ■ 핵심 기능 3가지 (AI 한도·서버 비용 0원, 브라우저 안에서 즉시 동작)
     ① 한 줄 메모·문의글 자동 정리 & 동종 서류 묶음 자동 추천 (parseBrief · recommendBundle · openQuickMakeModal)
        — 회사·업무·인원·기간·금액을 한 줄로 적거나 업무 버튼 하나만 누르면 80여 종 양식을 뒤질 필요 없이
          맞는 견적서+계약서+위임장 세트가 자동 선택되고, 모든 입력칸이 한 화면에 모여 한 번에 채워진다.
        — 빈 금액·기간은 0원이나 임의 기본값으로 채우지 않고 비워 두어 서식 밑줄이 그대로 살아남는다.
     ② 전 분류 통합 검색 (searchAll)
        — 어느 분류를 보고 있든 검색어 하나로 6개 분류 전체 양식과 27개 하위 세트를 한 번에 찾는다.
     ③ 쉬운 새 양식 만들기 마법사 (templatizeText · buildStandardTemplate · guessFormMeta · openEasyFormWizard)
        — 쓰던 파일(.hwpx/.hwp/.docx/.pdf)이나 문안을 넣으면 날짜·기간·금액·사업자번호·주민번호(자동 가림)·거래처명을
          한 번에 {{변수}}로 바꾸고, 파일이 없어도 조항 체크만으로 푸른 표준 양식을 조립해 하위 세트까지 동시 등록한다.
   ⚠ 사용자 입력은 textContent·value 로만 다루며 innerHTML 은 비울 때('')만 쓴다.
   ⚠ 색상은 푸른 통합 27색 팔레트만 쓴다(tests/color-palette-apps.test.js). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuContractEasy = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (w) {
  'use strict';

  var PROPOSAL_GROUP = '제안서·견적서';

  /* ── 22종 대표 업무 프리셋 (양식 이름을 몰라도 업무 하나로 견적+계약+부속서류 자동 매칭) ── */
  var WORK_PRESETS = [
    { id: 'advisory', setId: 'fs-advisory', kind: 'company', icon: '🏢', label: '상시 노무자문', sub: '자문계약서 + 노무자문 견적서 + CMS',
      re: /상시\s*자문|노무\s*자문|월\s*자문|고문\s*계약|자문\s*계약|자문료/ },
    { id: 'payroll', setId: 'fs-payroll', kind: 'company', icon: '💰', label: '임금·4대보험 대행', sub: '급여위임계약 + 견적서 + 4대보험 EDI + CMS',
      re: /급여\s*관리|급여\s*아웃소싱|임금\s*관리|급여\s*대행|급여\s*위탁|급여\s*대장|명세서/ },
    { id: 'office', setId: 'fs-office', kind: 'company', icon: '🏛', label: '보험사무대행·EDI', sub: '고용산재 사무위탁 + 건강·연금 EDI + 견적서',
      re: /사무\s*대행|보험\s*사무|웹\s*edi|edi\s*위임|보수\s*총액|취득\s*상실/i },
    { id: 'harass', setId: 'fs-harass', kind: 'company', icon: '🔍', label: '직장내괴롭힘·성희롱 조사', sub: '조사 견적서 + 조사 위탁계약서 + 비밀유지서약서 + 청구서',
      re: /(직장\s*내\s*)?(괴롭힘|성희롱)\s*(사안\s*|진상\s*|실태\s*|객관적\s*)?조사|진상\s*조사|외부\s*조사/ },
    { id: 'bargain', setId: 'fs-bargain', kind: 'company', icon: '🤝', label: '임금·단체교섭 대행', sub: '교섭 견적서 + 위임계약서 + 교섭권 위임장 + 노조자문',
      re: /단체\s*교섭|임금\s*교섭|임단협|교섭권|단체\s*협약|노사\s*협의회|임금\s*협상/ },
    { id: 'union', setId: 'fs-union', kind: 'company', icon: '🚩', label: '노동조합 자문', sub: '노조 자문계약서 + 자문 견적서',
      re: /노동\s*조합\s*자문|노조\s*자문|조합\s*규약/ },
    { id: 'rules', setId: 'fs-rules', kind: 'company', icon: '📘', label: '취업규칙·인사규정 정비', sub: '규정 정비 견적서 + 제·개정 위탁계약서',
      re: /취업\s*규칙|인사\s*규정|제\s*규정|복무\s*규정|사규\s*(개정|정비)/ },
    { id: 'costing', setId: 'fs-costing', kind: 'company', icon: '🧮', label: '입찰·인건비 원가산정', sub: '원가산정 견적서(원본) + 용역계약서 + 청구서',
      re: /원가\s*산정|인건비\s*산정|입찰\s*원가|예정\s*가격|용역\s*원가/ },
    { id: 'opinion', setId: 'fs-opinion', kind: 'company', icon: '⚖', label: '법률의견서·노무검토', sub: '의견서 견적서 + 작성 약정서 + 질의회시 공문',
      re: /법률\s*의견|노무\s*의견|의견서|법리\s*검토|노무\s*검토|질의\s*회시/ },
    { id: 'amend', setId: 'fs-amend', kind: 'company', icon: '🔄', label: '계약 변경·연장·갱신', sub: '변경·연장 합의서 + 견적서 + CMS',
      re: /변경\s*합의|연장\s*합의|갱신\s*계약|재\s*계약|보수\s*(인상|변경)/ },
    { id: 'case_wage', setId: 'fs-case-wage', kind: 'case', icon: '👷', label: '임금체불·대지급금 사건', sub: '사건 견적서 + 임금체불 위임약정서 + 위임장',
      re: /임금\s*체불|체불|대지급금|체당금|퇴직금\s*미지급|진정\s*사건/ },
    { id: 'case_dismiss', setId: 'fs-case-dismiss', kind: 'case', icon: '🛡', label: '부당해고·징계 구제', sub: '사건 견적서 + 부당해고 위임계약서 + 위임장',
      re: /부당\s*해고|부당\s*징계|부당\s*전보|구제\s*신청|해고\s*사건|지노위|중노위/ },
    { id: 'case_ulabor', setId: 'fs-case-ulabor', kind: 'case', icon: '🏛', label: '부당노동행위·노동쟁의', sub: '사건 견적서 + 부당노동행위 위임약정서 + 위임장',
      re: /부당\s*노동\s*행위|노동\s*쟁의|조정\s*신청|중재\s*신청/ },
    { id: 'case_harass', setId: 'fs-case-harass', kind: 'case', icon: '🚨', label: '괴롭힘·성희롱 사건대리', sub: '견적서 + 괴롭힘·성희롱 대리 약정서 + 위임장',
      re: /(괴롭힘|성희롱)\s*(사건|대리|진정|피해|불복)/ },
    { id: 'case_ind', setId: 'fs-case-ind', kind: 'case', icon: '🏥', label: '산재 보상·재심사', sub: '산재 견적서 + 요양·장해·유족 위임약정서 + 위임장',
      re: /산재|산업\s*재해|요양\s*급여|장해\s*급여|유족\s*급여|업무상\s*질병|재심사/ },
    { id: 'case_etc', setId: 'fs-case-etc', kind: 'case', icon: '📋', label: '노동청·행정심판 대리', sub: '사건 견적서 + 진정·행정심판 위임약정서',
      re: /행정\s*심판|노동청\s*대리|고소\s*고발|근로\s*감독/ },
    { id: 'consulting_safety', setId: 'fs-consulting-safety', kind: 'consulting', icon: '⛑', label: '산업안전·중대재해 컨설팅', sub: '안전보건 견적서 + 중대재해 위탁계약서',
      re: /산업\s*안전|중대\s*재해|위험성\s*평가|안전\s*보건/ },
    { id: 'consulting_dispatch', setId: 'fs-consulting-dispatch', kind: 'consulting', icon: '🏭', label: '불법파견·사내하도급 진단', sub: '진단 견적서 + 불법파견·하도급 계약서',
      re: /불법\s*파견|사내\s*하도급|적법\s*도급|파견\s*진단/ },
    { id: 'consulting_hr', setId: 'fs-consulting-hr', kind: 'consulting', icon: '📊', label: '인사노무·직무·임금 컨설팅', sub: '컨설팅 견적서 + 비교견적 + 위탁계약서',
      re: /인사\s*노무\s*컨설팅|인사\s*컨설팅|직무\s*분석|직무\s*급|임금\s*체계|평가\s*체계|조직\s*진단|일터\s*혁신|산업\s*일자리|컨설팅/ },
    { id: 'fund', setId: 'fs-fund-company', kind: 'fund', icon: '🏦', label: '사내·공동근로복지기금', sub: '기금 제안·견적서 + 설립·운영 위탁계약서',
      re: /복지\s*기금|사내\s*기금|공동\s*기금|기금\s*설립|기금\s*운영|기금\s*지원/ },
    { id: 'edu', setId: 'fs-edu', kind: 'other', icon: '🎓', label: '법정의무·노무교육 강의', sub: '강의 견적서 + 교육 위탁계약서 + 청구서',
      re: /성희롱\s*예방\s*교육|노무\s*교육|법정\s*의무\s*교육|출강|강의|특강|교육\s*위탁/ },
    { id: 'consult', setId: 'fs-consult', kind: 'consult', icon: '📞', label: '심층 노무상담·확인', sub: '상담 견적서 + 상담 약정서 + 상담확인서',
      re: /심층\s*상담|상담\s*확인서|노무\s*상담/ }
  ];

  /* ── 숫자 → 한글 금액 (예: 4400000 → '사백사십만') ── */
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

  /* 한국어 금액 표현 파싱: '440만원', '1000만원', '1,000만원', '1천5백만원', '55만5천원', '5천원', '3,300,000원' → 숫자(원). 없으면 null */
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

  /* ── 한 줄 메모 / 카톡·메일 문의글 → 항목 일괄 자동 추출 ──
     ⚠ 빈 값은 절대 0원·기본값으로 채우지 않는다(서식 밑줄 유지 규칙). */
  function parseBrief(text) {
    var src = String(text || '').trim();
    var out = { values: {}, presetId: '', setId: '', docScope: 'all', notes: [] };
    if (!src) return out;

    /* 1) 문서 범위 (견적서만 / 계약서만 / 전체) */
    if (/견적서?\s*만|견적\s*먼저|견적\s*초안/.test(src) && !/계약서\s*도|계약\s*함께/.test(src)) out.docScope = 'quote';
    else if (/(계약서|위임장|약정서)\s*만/.test(src)) out.docScope = 'contract';

    /* 2) 업무 프리셋 매칭 */
    for (var i = 0; i < WORK_PRESETS.length; i++) {
      if (WORK_PRESETS[i].re.test(src)) {
        out.presetId = WORK_PRESETS[i].id;
        out.setId = WORK_PRESETS[i].setId;
        break;
      }
    }

    var V = out.values;

    /* 3) 사업자등록번호 */
    var mBz = /\b(\d{3}-\d{2}-\d{5})\b/.exec(src);
    if (mBz) V['사업자번호'] = mBz[1];

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

    /* 6) 대상인원 / 기준인원 (한글 뒤에는 JS \b 가 동작하지 않으므로 공백·문장끝·구두점으로 경계 판별) */
    var mStaff = /(?:대상\s*인원|상시\s*근로자|근로자|직원|인원)?\s*(\d{1,5})\s*(명|인)(?=\s|$|[,.)/])/.exec(src);
    if (mStaff) {
      V['대상인원'] = mStaff[1] + '명';
      V['기준인원'] = mStaff[1];
    }

    /* 7) 착수금 · 성공보수 · 일반 계약/견적 금액 */
    var mRetainer = /착수금\s*[:：]?\s*([0-9,.\s억천백만원]+?)(?=\s|$|[,/]|성공|부가세)/.exec(src);
    if (mRetainer) {
      var retAmt = parseKoreanMoney(mRetainer[1]);
      if (retAmt) V['착수금'] = commaNum(retAmt);
    }
    var mSuccPct = /성공\s*보수(?:율)?\s*[:：]?\s*(\d{1,2}(?:\.\d+)?\s*%)/.exec(src);
    if (mSuccPct) {
      V['성공보수율'] = mSuccPct[1].replace(/\s+/g, '');
      V['성공보수'] = '수령금(경제적 이익)의 ' + V['성공보수율'];
    } else {
      var mSuccAmt = /성공\s*보수\s*[:：]?\s*([0-9,.\s억천백만원]+?)(?=\s|$|[,/]|부가세)/.exec(src);
      if (mSuccAmt) {
        var sAmt = parseKoreanMoney(mSuccAmt[1]);
        if (sAmt) V['성공보수'] = '금 ' + commaNum(sAmt) + '원';
      }
    }

    /* 일반 금액 (착수금 외 대표 보수/견적금액 — '1억원', '1,000만원', '1000만원', '1천5백만원', '55만5천원', '5천원', '4,400,000원' 모두 포괄) */
    var cleanedForAmt = src.replace(/착수금\s*[:：]?\s*[0-9,.\s억천백십만원]+/g, ' ').replace(/성공\s*보수\s*[:：]?\s*[0-9,.\s억천백십만원%]+/g, ' ');
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
    var mMgr = /(?:주?담당(?:\s*노무사)?)\s*[:：]?\s*([가-힣]{2,5})(?:\s*노무사)?/.exec(src);
    if (mMgr) V['주담당'] = mMgr[1];

    /* 9) 회사명 추출 — ㈜/(주)/주식회사/(유)/법인·상사·산업·테크·병원·조합·학원 등 또는 의뢰처: 표기 */
    var mCoLabel = /(?:회사명?|의뢰처|사업장|거래처)\s*[:：]\s*([^\n,/]+?)(?=\s+(?:대표|근로자|담당|직장|괴롭힘|성희롱|임금|단체|취업|원가|산재|부당|자문|급여|컨설팅|\d)|\s*$)/.exec(src);
    if (mCoLabel) {
      V['회사명'] = mCoLabel[1].trim();
    } else {
      var mCoCorp = /((?:\(주\)|㈜|주식회사\s*|\(유\)|유한회사\s*|\(사\)|\(재\))[가-힣A-Za-z0-9·\-]{1,24}|[가-힣A-Za-z0-9·\-]{2,20}(?:\(주\)|㈜|상사|산업|물산|테크|전자|화학|건설|운수|물류|병원|의원|요양원|복지관|어린이집|유치원|학교|학원|공단|공사|재단|협회|노동조합|노조|코퍼레이션|엔지니어링|솔루션|시스템|푸드|바이오|메디컬|제약|금속|기계|자동차|에너지))/.exec(src);
      if (mCoCorp && !/^(푸른노무법인|고용노동부|근로복지공단|노동위원회)$/.test(mCoCorp[1].trim())) {
        V['회사명'] = mCoCorp[1].trim();
      }
    }

    /* 10) 과업내용 — 지정된 프리셋이 있으면 깔끔한 요약 또는 원문 핵심 구절 */
    var mScope = /(?:과업(?:\s*내용)?|내용|사안)\s*[:：]\s*([^\n]+)/.exec(src);
    if (mScope) {
      V['과업내용'] = mScope[1].trim();
    } else if (out.presetId) {
      var pr = WORK_PRESETS.filter(function (x) { return x.id === out.presetId; })[0];
      if (pr && src.length <= 80) V['과업내용'] = pr.label;
    }

    return out;
  }

  function isQuoteForm(f) {
    return !!(f && (f.groupName === PROPOSAL_GROUP || f.docRole === 'quote' || /(견적서|제안서|청구서)/.test(f.name || '')));
  }

  function listOf(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === 'object') return Object.keys(v).sort(function (a, b) { return (+a) - (+b); }).map(function (k) { return v[k]; }).filter(Boolean);
    return [];
  }

  /* ── 전 분류 통합 검색 (양식 + 하위 세트 동시 검색) ── */
  function searchAll(query, forms, sets) {
    var raw = String(query || '').trim().toLowerCase();
    if (!raw) return { tokens: [], sets: [], forms: [] };
    var tokens = raw.split(/\s+/).filter(Boolean);
    var activeForms = (forms || []).filter(function (f) { return f && f.closed !== true; });
    var byId = {};
    activeForms.forEach(function (f) { byId[f.id] = f; });

    /* 프리셋 별칭 보강 — 예: '중대재해' 검색 시 관련 세트 가산점 */
    var matchedSetIds = {};
    WORK_PRESETS.forEach(function (p) {
      if (p.re.test(raw) || p.label.toLowerCase().indexOf(raw) >= 0) matchedSetIds[p.setId] = 1;
    });

    var hitSets = (sets || []).filter(function (st) {
      if (!st) return false;
      var fNames = listOf(st.formIds).map(function (id) { return byId[id] ? byId[id].name : ''; }).join(' ');
      var hay = (String(st.name || '') + ' ' + fNames).toLowerCase();
      if (matchedSetIds[st.id]) return true;
      return tokens.every(function (tk) { return hay.indexOf(tk) >= 0; });
    });

    var hitForms = activeForms.filter(function (f) {
      var hay = [f.name || '', f.groupName || '', f.kind || '', String(f.body || '').slice(0, 600)].join(' ').toLowerCase();
      return tokens.every(function (tk) { return hay.indexOf(tk) >= 0; });
    });

    return { tokens: tokens, sets: hitSets, forms: hitForms };
  }

  /* ── 업무 설명·키워드로 최적 동종 하위 세트 & 체크할 양식 묶음 추천 ── */
  function recommendBundle(textOrPresetId, forms, sets, docScope) {
    var scope = docScope || 'all';
    var activeForms = (forms || []).filter(function (f) { return f && f.closed !== true && f.enabled !== false; });
    var byId = {};
    activeForms.forEach(function (f) { byId[f.id] = f; });
    var allSets = sets || [];

    var preset = WORK_PRESETS.filter(function (p) { return p.id === textOrPresetId || p.setId === textOrPresetId; })[0] || null;
    var parsed = preset ? { presetId: preset.id, setId: preset.setId, docScope: scope, values: {} } : parseBrief(textOrPresetId);
    if (!preset && parsed.presetId) {
      preset = WORK_PRESETS.filter(function (p) { return p.id === parsed.presetId; })[0] || null;
    }

    var chosenSet = null;
    if (parsed.setId) {
      chosenSet = allSets.filter(function (s) { return s && s.id === parsed.setId; })[0] || null;
    }
    if (!chosenSet && textOrPresetId) {
      var sr = searchAll(textOrPresetId, activeForms, allSets);
      if (sr.sets.length) chosenSet = sr.sets[0];
    }
    if (!chosenSet && allSets.length) {
      chosenSet = allSets[0];
    }

    var baseList = [];
    if (chosenSet) {
      baseList = listOf(chosenSet.formIds).map(function (id) { return byId[id]; }).filter(Boolean);
    }
    if (!baseList.length && textOrPresetId) {
      baseList = searchAll(textOrPresetId, activeForms, allSets).forms.slice(0, 6);
    }

    var checkedIds = baseList.filter(function (f) {
      if (scope === 'quote') return isQuoteForm(f);
      if (scope === 'contract') return !isQuoteForm(f);
      return true;
    }).map(function (f) { return f.id; });

    /* 만약 해당 범위에 양식이 0개면 전체 묶음을 유지해 빈 선택을 막는다 */
    if (!checkedIds.length) checkedIds = baseList.map(function (f) { return f.id; });

    return {
      preset: preset,
      set: chosenSet,
      forms: baseList,
      checkedIds: checkedIds,
      parsed: parsed
    };
  }

  /* ── 기존 문안 → 표준 {{치환변수}} 원클릭 변환기 (연속된 주민번호·하이픈 없는 13자리 주민번호까지 비소비 전방탐색으로 모두 가림) ── */
  function maskRrnSafe(s) {
    var t = String(s == null ? '' : s);
    if (w && w.PuRrnMask && typeof w.PuRrnMask.maskRrnInText === 'function') {
      t = w.PuRrnMask.maskRrnInText(t).text;
    }
    return t
      .replace(/(^|[^0-9])(\d{6}[-–—]\s?[1-8]\d{6})(?![0-9])/g, '$1******-*******')
      .replace(/(^|[^0-9])(\d{6}[1-8]\d{6})(?![0-9])/g, '$1******-*******');
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

    /* 1) 주민등록번호(하이픈 있음·없음·연속 나열 모두) → {{주민번호}} 및 잔여 패턴 가림 */
    t = t.replace(/(^|[^0-9])(\d{6}[-–—]\s?[1-8]\d{6})(?![0-9])/g, function (_m, p1) {
      count++;
      return p1 + '{{주민번호}}';
    }).replace(/(^|[^0-9])(\d{6}[1-8]\d{6})(?![0-9])/g, function (_m, p1) {
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

    /* 4) 계약기간 (시작일 ~ 종료일) — '2026. 11. 01. ~ 2027. 10. 31.' 처럼 일 뒤에 마침표가 붙는 표기도 포괄 */
    rep(/20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*(?:일|\.)?\s*(?:부터|~|-|–)\s*20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*(?:일|\.)?(?:\s*까지)?/g,
      '{{계약시작일}} ~ {{계약종료일}}');

    /* 5) 단독 날짜 (2026년 11월 16일 / 2026. 11. 16.) */
    rep(/20\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, '{{계약일}}');
    rep(/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\.?/g, '{{계약일}}');

    /* 6) 금액 (금 3,300,000원 / ₩3,300,000) */
    rep(/금\s*[\d,]{4,}\s*원/g, '금 {{계약금액}}원');
    rep(/[₩￦]\s*[\d,]{4,}/g, '₩{{계약금액}}');

    var vars = [];
    var m;
    var vr = /\{\{([^{}\n]+)\}\}/g;
    while ((m = vr.exec(t))) {
      if (vars.indexOf(m[0]) < 0) vars.push(m[0]);
    }
    return { text: t, replacedCount: count, vars: vars };
  }

  /* ── 양식 이름·본문으로 분류·묶음·측·하위 세트 자동 판별 ── */
  function guessFormMeta(name, body, sets) {
    var nm = String(name || '').trim();
    var bd = String(body || '');
    var combined = nm + ' ' + bd.slice(0, 500);
    var isQuote = /(견적서|제안서|비교견적|청구서|수임료\s*안내|비용\s*안내)/.test(nm);
    var preset = null;
    for (var i = 0; i < WORK_PRESETS.length; i++) {
      if (WORK_PRESETS[i].re.test(combined)) { preset = WORK_PRESETS[i]; break; }
    }
    var kind = preset ? preset.kind : 'company';
    if (!preset) {
      if (/(위임약정서|구제신청|진정|체불|체당금|대지급금|산재|행정심판)/.test(combined)) kind = 'case';
      else if (/(컨설팅|진단|위험성평가|중대재해|산업안전)/.test(combined)) kind = 'consulting';
      else if (/(기금|근로복지기금)/.test(combined)) kind = 'fund';
      else if (/(강의|교육|출강)/.test(combined)) kind = 'other';
      else if (/(상담확인|노무상담)/.test(combined)) kind = 'consult';
    }
    /* 사건계약에는 '제안서·견적서' 묶음이 없으므로 사건 견적서는 other 분류에 둔다 */
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
    var docType = spec.docType || 'contract'; // contract | quote | case | agree
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

    /* 일반 위탁·자문 계약서 또는 변경합의서 */
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

  /* ── 공통 DOM 유틸 & 스타일 ── */
  var _easyCssDone = false;
  var EASY_CSS = ''
    + '.pce-mbg{position:fixed;inset:0;background:rgba(30,41,59,.55);z-index:10002;display:flex;align-items:center;justify-content:center;padding:14px}'
    + '.pce-m{background:#fff;border-radius:12px;width:960px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;border:1px solid #cbd5e1;overflow:hidden}'
    + '.pce-mh{display:flex;align-items:center;gap:8px;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}'
    + '.pce-mh b{flex:1;font-size:15px;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pce-x{background:#fff;border:1px solid #cbd5e1;border-radius:7px;min-width:36px;min-height:36px;padding:0 8px;font-size:16px;color:#475569;cursor:pointer;flex:none}'
    + '.pce-mb{padding:14px 16px;overflow-y:auto;overflow-x:hidden;flex:1;display:flex;flex-direction:column;gap:12px}'
    + '.pce-mf{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding:11px 16px;background:#f8fafc;border-top:1px solid #e2e8f0}'
    + '.pce-sec{border:1px solid #e2e8f0;border-radius:9px;padding:11px 12px;background:#f8fafc;box-sizing:border-box;max-width:100%;min-width:0}'
    + '.pce-sh{font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}'
    + '.pce-sub{font-size:12px;color:#475569;font-weight:400;min-width:0;overflow-wrap:anywhere}'
    + '.pce-in,.pce-ta,.pce-sel{width:100%;max-width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:7px;padding:7px 9px;font-family:inherit;font-size:13px;color:#1e293b;background:#fff}'
    + '.pce-ta{resize:vertical;line-height:1.55}'
    + '.pce-btn{box-sizing:border-box;max-width:100%;border:1px solid #cbd5e1;background:#fff;color:#1e293b;border-radius:7px;padding:6px 12px;min-height:32px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}'
    + '.pce-btn:hover{background:#f8fafc}'
    + '.pce-btn.pri{background:#1e40af;border-color:#1e40af;color:#fff;font-weight:700}'
    + '.pce-btn.grn{background:#166534;border-color:#166534;color:#fff;font-weight:700}'
    + '.pce-btn.soft{background:#eff6ff;border-color:#bfdbfe;color:#1e40af}'
    + '.pce-btn:disabled{opacity:.5;cursor:default}'
    + '.pce-pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px}'
    + '.pce-pbtn{box-sizing:border-box;min-width:0;max-width:100%;overflow:hidden;text-align:left;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:7px 9px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px}'
    + '.pce-pbtn:hover{border-color:#60a5fa;background:#eff6ff}'
    + '.pce-pbtn.on{border-color:#1e40af;background:#eff6ff;color:#1e40af}'
    + '.pce-pbtn b{font-size:12.5px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pce-pbtn.on b{color:#1e40af}'
    + '.pce-pbtn small{font-size:11px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pce-fgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}'
    + '.pce-fg{display:flex;flex-direction:column;gap:3px;min-width:0}'
    + '.pce-fg label{margin:0;font-size:11.5px;font-weight:700;color:#475569}'
    + '.pce-doclist{display:flex;flex-direction:column;gap:4px;max-height:190px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:7px;padding:6px}'
    + '.pce-docrow{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:12.5px;color:#1e293b}'
    + '.pce-docrow:hover{background:#f8fafc}'
    + '.pce-docrow input[type=checkbox]{width:24px;height:24px;margin:0;flex:none}'
    + '.pce-docrow .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pce-tag{font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;flex:none;white-space:nowrap}'
    + '.pce-tag.q{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}'
    + '.pce-tag.c{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}'
    + '.pce-corow{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}'
    + '.pce-cochip{border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:99px;padding:4px 10px;min-height:32px;font-size:12px;font-weight:600;cursor:pointer}'
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
    + '.pce-mbg{padding:8px}.pce-mb{padding:10px}.pce-fgrid{grid-template-columns:minmax(0,1fr)}.pce-pgrid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.pce-cgrid{grid-template-columns:minmax(0,1fr)}'
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
    function onKey(e) {
      if (!e) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'Tab' && md && md.querySelectorAll) {
        var fcs = Array.prototype.slice.call(md.querySelectorAll('button,input,select,textarea')).filter(function (x) {
          return !x.disabled && x.getAttribute('disabled') === null && !x.hidden;
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

  /* ══ 모달 1: ⚡ 한 번에 계약·견적 정리·만들기 ══
     ctx: { forms, sets, host, openFill, applySet?, initialText?, returnFocus?, toast? } */
  function openQuickMakeModal(ctx) {
    ctx = ctx || {};
    var doc = (ctx.doc) || (w && w.document);
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
      scope: 'all',
      picked: {},
      showAllPresets: false,
      coRows: [],
      pickedCo: null
    };

    var bg = domEl(doc, 'div', { 'class': 'pce-mbg' });
    var unbindKeys = null;
    function close(skipFocus) {
      if (unbindKeys) { unbindKeys(); unbindKeys = null; }
      bg.remove();
      if (skipFocus !== true && prevFocus && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus(); } catch (_) {}
      }
    }
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });

    /* ① 한 줄 붙여넣기·자동 정리 칸 */
    var briefIn = domEl(doc, 'textarea', {
      'class': 'pce-ta', rows: '2', 'aria-label': '업무 내용 한 줄 입력',
      placeholder: '예) (주)가나상사 대표 홍길동 직장내괴롭힘 조사 35명 2026-11-20~2026-12-31 440만원 부가세별도 담당 김노무  (카톡·메일 문의글을 그대로 붙여넣어도 됩니다)',
      value: ctx.initialText || ''
    });
    var parseStatus = domEl(doc, 'span', { 'class': 'pce-sub', role: 'status', 'aria-live': 'polite', text: '글을 적고 [🪄 자동 정리]를 누르거나 아래 업무 카드를 고르면 필요한 서류와 입력칸이 한 번에 맞춰집니다.' });

    /* ② 통합 입력칸 (한 번만 적으면 선택된 모든 서류에 공통 반영) */
    function mkField(label, placeholder, aria) {
      var inp = domEl(doc, 'input', { type: 'text', 'class': 'pce-in', placeholder: placeholder, 'aria-label': aria || label });
      var wrap = domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: label }), inp]);
      return { inp: inp, wrap: wrap };
    }
    var fCo = mkField('의뢰처(회사·기관명)', '예: (주)가나상사 — 입력하면 이알피·기업정보함 자동 찾기', '의뢰처 회사명');
    var fCeo = mkField('대표자', '예: 홍길동', '대표자');
    var fBz = mkField('사업자등록번호', '예: 123-45-67890', '사업자등록번호');
    var fAddr = mkField('사업장 주소', '업체 선택 시 자동 입력', '사업장 주소');
    var fAmt = mkField('계약·견적 금액(원, 선택)', '비워 두면 서식 밑줄로 남음 (예: 4,400,000)', '계약 또는 견적 금액');
    var vatSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '부가세 처리' }, [
      domEl(doc, 'option', { value: '', text: '선택 안 함 (서식 기본)' }),
      domEl(doc, 'option', { value: '부가세 별도', text: '부가세 별도' }),
      domEl(doc, 'option', { value: '부가세 포함', text: '부가세 포함' })
    ]);
    var fVatWrap = domEl(doc, 'div', { 'class': 'pce-fg' }, [domEl(doc, 'label', { text: '부가세 처리' }), vatSel]);
    var fPeriod = mkField('계약·수행 기간(선택)', '예: 2026-11-20 ~ 2026-12-31 또는 4주 / 1년', '계약기간');
    var fStaff = mkField('대상·기준 인원(선택)', '예: 35명', '대상인원');
    var fScope = mkField('과업·사건 핵심 내용(선택)', '예: 직장 내 괴롭힘 객관적 사실조사 및 보고서 작성', '과업내용');
    var fMgr = mkField('주담당 노무사(선택)', '예: 권형하', '주담당 노무사');
    var fWorker = mkField('근로자명(사건일 때, 선택)', '예: 김가나', '근로자명');
    var fSucc = mkField('성공보수·특약(선택)', '예: 수령금의 15% / 타결 시 300만원', '성공보수');

    var coSuggestBox = domEl(doc, 'div', { 'class': 'pce-corow' });
    if (ctx.host && ctx.host.cards && typeof ctx.host.cards.rows === 'function') {
      ctx.host.cards.rows().then(function (rows) {
        st.coRows = Array.isArray(rows) ? rows : [];
        if (fCo.inp.value.trim()) drawCoSuggest();
      }, function () {});
    }
    function applyCoRow(r) {
      if (!r) return;
      st.pickedCo = r;
      if (r.c) fCo.inp.value = r.c;
      if (r.ceo && !fCeo.inp.value.trim()) fCeo.inp.value = r.ceo;
      if (r.bz && !fBz.inp.value.trim()) fBz.inp.value = r.bz;
      if (r.adr && !fAddr.inp.value.trim()) fAddr.inp.value = r.adr;
      drawCoSuggest();
    }
    function drawCoSuggest() {
      coSuggestBox.innerHTML = '';
      var q = fCo.inp.value.trim().toLowerCase().replace(/\(주\)|㈜|주식회사|\s+/g, '');
      if (!q || !st.coRows.length) return;
      var hits = st.coRows.filter(function (r) {
        var nm = String((r && r.c) || '').toLowerCase().replace(/\(주\)|㈜|주식회사|\s+/g, '');
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
    fCo.inp.addEventListener('input', drawCoSuggest);

    /* ③ 업무 카드 격자 + 서류 범위 토글 + 체크 목록 */
    var presetGrid = domEl(doc, 'div', { 'class': 'pce-pgrid' });
    var toggleMoreBtn = domEl(doc, 'button', {
      type: 'button', 'class': 'pce-btn',
      onclick: function () { st.showAllPresets = !st.showAllPresets; drawPresets(); }
    });
    var scopeTabs = domEl(doc, 'div', { 'class': 'pce-tabs', role: 'group', 'aria-label': '포함할 서류 범위' });
    var docListBox = domEl(doc, 'div', { 'class': 'pce-doclist' });
    var addExtraSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '다른 양식 추가하기', style: 'max-width:340px' });
    var btnGo = domEl(doc, 'button', { type: 'button', 'class': 'pce-btn grn', onclick: onConfirm });

    function rebuildExtraSelect() {
      addExtraSel.innerHTML = '';
      addExtraSel.appendChild(domEl(doc, 'option', { value: '', text: '+ 다른 양식도 이 묶음에 추가하기 (' + forms.length + '종 전체)…' }));
      forms.forEach(function (f) {
        if (st.picked[f.id]) return;
        addExtraSel.appendChild(domEl(doc, 'option', { value: f.id, text: f.name + (isQuoteForm(f) ? ' [견적·제안]' : ' [계약·부속]') }));
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

    function selectPreset(presetId, scopeOverride) {
      if (scopeOverride) st.scope = scopeOverride;
      var rec = recommendBundle(presetId, forms, sets, st.scope);
      if (rec.preset) st.presetId = rec.preset.id;
      if (rec.set) st.setId = rec.set.id;
      st.picked = {};
      rec.checkedIds.forEach(function (id) { st.picked[id] = true; });
      drawPresets();
      drawScopes();
      drawDocs();
    }

    function drawPresets() {
      presetGrid.innerHTML = '';
      var shownPresets = st.showAllPresets ? WORK_PRESETS : WORK_PRESETS.slice(0, 12);
      if (!shownPresets.some(function (p) { return p.id === st.presetId; })) {
        var curP = WORK_PRESETS.filter(function (p) { return p.id === st.presetId; })[0];
        if (curP) shownPresets = [curP].concat(shownPresets.slice(0, 11));
      }
      shownPresets.forEach(function (p) {
        var on = p.id === st.presetId;
        presetGrid.appendChild(domEl(doc, 'button', {
          type: 'button', 'class': 'pce-pbtn' + (on ? ' on' : ''),
          'aria-pressed': on ? 'true' : 'false',
          title: p.label + ' — ' + p.sub,
          onclick: function () { selectPreset(p.id); }
        }, [
          domEl(doc, 'b', { text: p.icon + ' ' + p.label }),
          domEl(doc, 'small', { text: p.sub })
        ]));
      });
      toggleMoreBtn.textContent = st.showAllPresets ? '▲ 주요 12개만 보기' : ('▼ 전체 업무 ' + WORK_PRESETS.length + '종 모두 보기');
    }

    function drawScopes() {
      scopeTabs.innerHTML = '';
      [
        { v: 'all', label: '📦 견적서 + 계약서 + 위임장 한 번에' },
        { v: 'quote', label: '🧾 견적서만 먼저' },
        { v: 'contract', label: '📑 계약서·위임장만' }
      ].forEach(function (it) {
        var on = st.scope === it.v;
        scopeTabs.appendChild(domEl(doc, 'button', {
          type: 'button', 'class': 'pce-tab' + (on ? ' on' : ''),
          'aria-pressed': on ? 'true' : 'false',
          text: it.label,
          onclick: function () { selectPreset(st.presetId, it.v); }
        }));
      });
    }

    function currentOrderedForms() {
      var curSet = sets.filter(function (s) { return s && s.id === st.setId; })[0];
      var baseIds = curSet ? listOf(curSet.formIds) : [];
      var extraIds = Object.keys(st.picked).filter(function (id) { return baseIds.indexOf(id) < 0; });
      return baseIds.concat(extraIds).map(function (id) { return byId[id]; }).filter(Boolean);
    }

    function syncFooter() {
      var cnt = Object.keys(st.picked).filter(function (id) { return st.picked[id] && byId[id]; }).length;
      btnGo.textContent = cnt ? ('🚀 선택한 ' + cnt + '종 한 번에 채우기·받기·메일 열기') : '서류를 1개 이상 체크해 주세요';
      btnGo.disabled = !cnt;
      rebuildExtraSelect();
    }

    function drawDocs() {
      docListBox.innerHTML = '';
      var list = currentOrderedForms();
      if (!list.length) {
        docListBox.appendChild(domEl(doc, 'div', { 'class': 'pce-sub', style: 'padding:8px', text: '추천할 양식이 없습니다 — 아래에서 양식을 추가해 주세요.' }));
        syncFooter();
        return;
      }
      list.forEach(function (f) {
        var isQ = isQuoteForm(f);
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
          domEl(doc, 'span', { 'class': 'pce-tag ' + (isQ ? 'q' : 'c'), text: isQ ? '견적·제안' : '계약·부속' })
        ]));
      });
      syncFooter();
    }

    function runParseBrief() {
      var txt = briefIn.value.trim();
      if (!txt) { parseStatus.textContent = '먼저 위 칸에 회사명·업무·금액·기간 등을 간단히 적어 주세요.'; return; }
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

      if (res.presetId) {
        selectPreset(res.presetId, res.docScope);
      } else {
        var rec = recommendBundle(txt, forms, sets, res.docScope);
        if (rec.preset) st.presetId = rec.preset.id;
        if (rec.set) st.setId = rec.set.id;
        st.scope = res.docScope;
        st.picked = {};
        rec.checkedIds.forEach(function (id) { st.picked[id] = true; });
        drawPresets(); drawScopes(); drawDocs();
      }
      drawCoSuggest();
      if (st.coRows.length && fCo.inp.value.trim()) {
        var qNorm = fCo.inp.value.trim().replace(/\(주\)|㈜|주식회사|\s+/g, '').toLowerCase();
        var exact = st.coRows.filter(function (r) {
          return String((r && r.c) || '').replace(/\(주\)|㈜|주식회사|\s+/g, '').toLowerCase() === qNorm;
        });
        if (exact.length === 1) applyCoRow(exact[0]);
      }
      var filledKeys = Object.keys(V);
      var curP = WORK_PRESETS.filter(function (p) { return p.id === st.presetId; })[0];
      parseStatus.textContent = '✔ 자동 정리 완료: ' + (curP ? curP.icon + ' ' + curP.label : '맞춤 묶음')
        + (filledKeys.length ? ' · 추출 항목(' + filledKeys.join(', ') + ')' : ' · 아래 칸에서 필요한 값만 채우세요(비운 칸은 밑줄로 남습니다)');
    }

    function buildInitialValues() {
      var init = {};
      function put(k, v) { var s = String(v || '').trim(); if (s) init[k] = s; }
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
      put('과업내용', fScope.inp.value);
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
      var chosen = currentOrderedForms().filter(function (f) { return !!st.picked[f.id]; });
      if (!chosen.length) { notify('채울 서류를 하나 이상 체크해 주세요'); return; }
      var init = buildInitialValues();
      var curP = WORK_PRESETS.filter(function (p) { return p.id === st.presetId; })[0];
      var title = curP ? (curP.icon + ' ' + curP.label) : '맞춤 서류 묶음';
      if (typeof ctx.onPickSet === 'function' && st.setId) {
        try { ctx.onPickSet(st.setId, chosen.map(function (f) { return f.id; })); } catch (_) {}
      }
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
    }

    var md = domEl(doc, 'div', { 'class': 'pce-m', role: 'dialog', 'aria-modal': 'true', 'aria-label': '한 번에 계약·견적 정리 및 만들기' }, [
      domEl(doc, 'div', { 'class': 'pce-mh' }, [
        domEl(doc, 'b', { text: '⚡ 한 번에 계약·견적 정리·만들기 — 양식 찾을 필요 없이 자동 추천·일괄 입력' }),
        domEl(doc, 'button', { type: 'button', 'class': 'pce-x', 'aria-label': '닫기', text: '×', onclick: function () { close(); } })
      ]),
      domEl(doc, 'div', { 'class': 'pce-mb' }, [
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-sh' }, [
            domEl(doc, 'span', { text: '① 한 줄 메모·문의글 붙여넣기 (선택)' }),
            domEl(doc, 'button', { type: 'button', 'class': 'pce-btn pri', text: '🪄 내용 자동 정리·양식 추천', onclick: runParseBrief }),
            parseStatus
          ]),
          briefIn
        ]),
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-sh' }, [
            domEl(doc, 'span', { text: '② 무슨 업무인가요? — 누르면 필요한 견적서·계약서·위임장이 한 번에 체크됩니다' }),
            domEl(doc, 'span', { style: 'margin-left:auto' }, [toggleMoreBtn])
          ]),
          presetGrid,
          domEl(doc, 'div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 6px' }, [
            scopeTabs,
            domEl(doc, 'span', { style: 'margin-left:auto' }, [addExtraSel])
          ]),
          docListBox
        ]),
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-sh' }, [
            domEl(doc, 'span', { text: '③ 한 번에 내용 넣기 — 여기서 적은 값이 선택된 모든 서류에 공통으로 들어갑니다 (비워 둔 칸은 서식 밑줄 유지)' })
          ]),
          coSuggestBox,
          domEl(doc, 'div', { 'class': 'pce-fgrid', style: 'margin-top:6px' }, [
            fCo.wrap, fCeo.wrap, fBz.wrap,
            fAmt.wrap, fVatWrap, fPeriod.wrap,
            fStaff.wrap, fScope.wrap, fMgr.wrap,
            fAddr.wrap, fWorker.wrap, fSucc.wrap
          ])
        ])
      ]),
      domEl(doc, 'div', { 'class': 'pce-mf' }, [
        domEl(doc, 'span', { 'class': 'pce-sub', style: 'margin-right:auto', text: '다음 창에서 한글(.hwpx)·묶음(.zip) 내려받기, 인쇄, 전자서명, 메일 발송까지 바로 처리됩니다.' }),
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
    return { close: close };
  }

  /* ══ 모달 2: ✨ 쉽게 새 양식 만들기 마법사 (파일·문안 자동 변수 변환 + 10초 표준 조항 조립 + 하위 세트 동시 등록) ══
     ctx: { kinds, caseTypes, sets, defaultKind?, extractTemplateText?, archiveFile?, onSaveForm(formObj, targetSetId), returnFocus?, toast? } */
  function openEasyFormWizard(ctx) {
    ctx = ctx || {};
    var doc = ctx.doc || (w && w.document);
    if (!doc || !doc.body) return null;
    ensureEasyCss(doc);

    var prevFocus = ctx.returnFocus || doc.activeElement;
    var kinds = ctx.kinds || [
      { v: 'consult', label: '상담사항', icon: '📞' },
      { v: 'company', label: '업체계약', icon: '🏢' },
      { v: 'case', label: '사건계약', icon: '⚖️' },
      { v: 'consulting', label: '컨설팅계약', icon: '📊' },
      { v: 'fund', label: '기금관리', icon: '🏦' },
      { v: 'other', label: '기타사업', icon: '📋' }
    ];
    var sets = ctx.sets || [];
    var notify = ctx.toast || function () {};
    var busy = false, pendingFiles = 0, stagedFile = null;

    var bg = domEl(doc, 'div', { 'class': 'pce-mbg' });
    var unbindKeys = null;
    function close(skipFocus) {
      if (busy) return;
      if (unbindKeys) { unbindKeys(); unbindKeys = null; }
      bg.remove();
      if (skipFocus !== true && prevFocus && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus(); } catch (_) {}
      }
    }
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });

    var mode = 'convert'; // 'convert' | 'assemble'
    var tabConvert = domEl(doc, 'button', { type: 'button', 'class': 'pce-tab on', 'aria-pressed': 'true', text: '📄 쓰던 파일·문안 붙여넣어 자동 양식화', onclick: function () { setMode('convert'); } });
    var tabAssemble = domEl(doc, 'button', { type: 'button', 'class': 'pce-tab', 'aria-pressed': 'false', text: '🧩 파일 없이 조항 체크로 10초 표준 양식 조립', onclick: function () { setMode('assemble'); } });

    /* 공통 메타 입력 */
    var nameIn = domEl(doc, 'input', { type: 'text', 'class': 'pce-in', placeholder: '예: 직무급 도입 컨설팅 위탁계약서 (푸른 표준)', 'aria-label': '새 양식 이름' });
    var kindSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '상위 계약 분류' }, kinds.map(function (k) {
      return domEl(doc, 'option', { value: k.v, text: k.icon + ' ' + k.label, selected: k.v === (ctx.defaultKind || 'company') });
    }));
    kindSel.value = ctx.defaultKind || 'company';
    var roleSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '서류 구분' }, [
      domEl(doc, 'option', { value: '계약서', text: '📑 계약서·약정서·위임장', selected: true }),
      domEl(doc, 'option', { value: PROPOSAL_GROUP, text: '🧾 제안서·견적서·청구서' })
    ]);
    roleSel.value = '계약서';
    var setSel = domEl(doc, 'select', { 'class': 'pce-sel', 'aria-label': '함께 넣을 동종 하위 세트' });
    function rebuildSetOptions(autoSetId) {
      var curVal = autoSetId !== undefined ? autoSetId : setSel.value;
      setSel.innerHTML = '';
      setSel.appendChild(domEl(doc, 'option', { value: '', text: '(선택 안 함 — 분류 목록에만 등록)' }));
      sets.forEach(function (s) {
        if (!s) return;
        setSel.appendChild(domEl(doc, 'option', { value: s.id, text: '📦 ' + s.name, selected: s.id === curVal }));
      });
      setSel.value = curVal || '';
    }
    rebuildSetOptions('');

    /* 모드 A: 파일 올리기 + 기존 값 → {{변수}} 원클릭 변환
       ⚠ 개인정보 보호: 파일을 고른 단계에서는 브라우저 안에서 글자만 뽑아 {{변수}}로 바꾸고 서버(보관함)에는 올리지 않는다.
         실제 원본 파일 첨부·보관함 업로드는 사용자가 '빈 공용 서식 원본임 확인'에 체크하고 [저장]을 눌렀을 때만 수행한다. */
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
      domEl(doc, 'div', { 'class': 'pce-sh' }, [
        filePickBtn,
        fileIn,
        fileStatus
      ]),
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
        domEl(doc, 'span', { text: '문서 틀과 넣을 조항만 체크하고 [🧩 표준 본문 조립]을 누르면 모든 {{변수}}가 정리된 본문이 즉시 만들어집니다.' })
      ]),
      domEl(doc, 'div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px' }, [
        domEl(doc, 'div', { style: 'min-width:240px' }, [docTypeSel]),
        domEl(doc, 'button', { type: 'button', 'class': 'pce-btn pri', text: '🧩 체크한 조항으로 표준 본문 한 번에 조립', onclick: runAssemble })
      ]),
      clauseGrid
    ]);

    /* 본문 편집기 + 자주 쓰는 변수 원클릭 칩 */
    var bodyIn = domEl(doc, 'textarea', {
      'class': 'pce-ta', rows: '11', 'aria-label': '양식 본문',
      placeholder: '기존 계약서·견적서 문안을 여기에 붙여넣고 위 [🪄 {{변수}} 한 번에 변환]을 누르거나, [🧩 조항 체크로 10초 표준 양식 조립] 탭을 눌러 자동 생성하세요.'
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
      tabConvert.className = 'pce-tab' + (m === 'convert' ? ' on' : '');
      tabConvert.setAttribute('aria-pressed', m === 'convert' ? 'true' : 'false');
      tabAssemble.className = 'pce-tab' + (m === 'assemble' ? ' on' : '');
      tabAssemble.setAttribute('aria-pressed', m === 'assemble' ? 'true' : 'false');
      convertPane.hidden = m !== 'convert';
      assemblePane.hidden = m !== 'assemble';
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
      var nm = maskRrnSafe(nameIn.value).trim();
      var bd = maskRrnSafe(bodyIn.value);
      if (!nm) { notify('새 양식 이름을 넣어 주세요'); nameIn.focus(); return; }
      if (!bd.trim()) { notify('양식 본문을 넣어 주세요 ([표준 본문 조립]을 누르면 자동 생성됩니다)'); bodyIn.focus(); return; }

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
        domEl(doc, 'b', { text: '✨ 쉽게 새 양식 만들기 — 자동 {{변수}} 변환 · 조항 체크 조립 · 하위 세트 동시 등록' }),
        domEl(doc, 'button', { type: 'button', 'class': 'pce-x', 'aria-label': '닫기', text: '×', onclick: function () { close(); } })
      ]),
      domEl(doc, 'div', { 'class': 'pce-mb' }, [
        domEl(doc, 'div', { 'class': 'pce-tabs' }, [tabConvert, tabAssemble]),
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
        domEl(doc, 'div', { 'class': 'pce-sec' }, [
          domEl(doc, 'div', { 'class': 'pce-sh' }, [
            domEl(doc, 'span', { text: '양식 본문 ({{변수}} 칩을 누르면 커서 위치에 바로 들어갑니다 · 주민번호는 자동 가림 처리)' })
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
    try { nameIn.focus(); } catch (_) {}
    return { close: close };
  }

  return {
    WORK_PRESETS: WORK_PRESETS,
    numToKorWon: numToKorWon,
    parseKoreanMoney: parseKoreanMoney,
    parseBrief: parseBrief,
    searchAll: searchAll,
    recommendBundle: recommendBundle,
    templatizeText: templatizeText,
    guessFormMeta: guessFormMeta,
    buildStandardTemplate: buildStandardTemplate,
    openQuickMakeModal: openQuickMakeModal,
    openEasyFormWizard: openEasyFormWizard
  };
});
