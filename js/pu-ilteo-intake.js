/* 푸른통합시스템 — 일터혁신 상생컨설팅 메일 체크 · 내용확인 · 개인정보 무유출 이원화 분석 엔진
 * (브라우저 window.PuIlteoIntake / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 다음메일 거울(mailbox/folders · mailbox/msgs)에서 사업장(companyId 확정 주소·고유 도메인) 송수신 메일을 스캔하고,
 *      중간보고 확정 시각(midConfirmedAt) 및 제목·첨부 시그널에 따라 기초자료(pre_mid)와 후속·결과보고 자료(post_mid)로 분기한다.
 *   2. 상호 텍스트만으로 자동 연결하지 않으며(온톨로지 원칙), 제목 일치 메일은 사람 확인 대기 후보(name_candidate)로만 분리 표시한다.
 *   3. 트랙 A(정량 엑셀 로컬 비식별 분석): 인력·입퇴사, 근태·연차, 임금·통상시급 모의계산, EOS 설문 결과를
 *      개별 성명·주민번호·연락처 없이 순수 사업장 통계로만 집계한다(외부 AI·서버 원본 전송 0건).
 *   4. 트랙 B(규정·계약·회의록·후속 메일 본문 분석): 2중 개인정보 가림(주민·전화·계좌·이메일) 검증 후
 *      법정 노무 진단 이슈 및 중간보고 이후 합의·피드백 변경점(Diff)을 추출한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-ilteo-catalog.js') : root.PuIlteoCatalog;
  if (isNode && !root.PuCoThread) {
    try { require('./pu-co-thread.js'); } catch (e) {}
  }
  var api = factory(root, Cat);
  if (isNode) module.exports = api;
  if (root) root.PuIlteoIntake = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat) {
  'use strict';

  var PUBLIC_DOMAINS = {
    'naver.com': 1, 'daum.net': 1, 'hanmail.net': 1, 'gmail.com': 1, 'kakao.com': 1,
    'nate.com': 1, 'hotmail.com': 1, 'outlook.com': 1, 'yahoo.com': 1, 'yahoo.co.kr': 1,
    'icloud.com': 1, 'korea.kr': 1, 'pureun.kr': 1
  };
  var OWN_MAIL_RE = /@pureun\.kr$|^370-6@(?:daum\.net|hanmail\.net)$/i;
  var BOX_KINDS = ['inbox', 'sent', 'archive', 'custom'];

  /* 개인정보 정규식 — 하이픈 없는 13자리·공백 낀 주민번호·유무선 전화·도로명/지번 주소·문맥 인명까지 가린다 */
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var RRN_TIGHT_RE = /(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-~–—_]\s*)?([1-8])\d{6}(?!\d)/g;
  var RRN_SPACED_RE = /(^|[^\d])((?:\d\s*){2}(?:0\s*[1-9]|1\s*[0-2])(?:0\s*[1-9]|[12]\s*\d|3\s*[01]))\s*[-~–—_]\s*([1-8])(?:\s*\d){6}(?!\s*\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0\d{1,2}\)?[-.\s]?\d{3,4}[-.\s]\d{4}(?!\d)/g;
  var REP_TEL_RE = /(?<!\d)1[5-9]\d{2}-\d{4}(?!\d)/g;
  var ACCT_LONG_RE = /\b\d[\d-]{9,18}\d\b/g;
  var ADDR_ROAD_RE = /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|충청북도|충청남도|전북|전남|전라북도|전라남도|경북|경남|경상북도|경상남도|제주)(?:특별시|광역시|특별자치시|특별자치도|도|시)?\s+[가-힣]{1,10}(?:시|군|구)(?:\s+[가-힣]{1,10}(?:구|읍|면))?\s+[가-힣0-9\-]{1,18}(?:대로|번길|로|길)\s*\d{1,5}(?:-\d{1,4})?(?:\s*(?:,|\()\s*[가-힣0-9\-\s동호층]{1,16}\)?|\s+\d{1,4}(?:동|층|호))*/g;
  var ADDR_LOT_RE = /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|충청북도|충청남도|전북|전남|전라북도|전라남도|경북|경남|경상북도|경상남도|제주)(?:특별시|광역시|특별자치시|특별자치도|도|시)?\s+[가-힣]{1,10}(?:시|군|구)(?:\s+[가-힣]{1,10}(?:구|읍|면))?\s+[가-힣0-9]{1,12}(?:읍|면|동|가|리)\s+(?:산\s*)?\d{1,5}(?:-\d{1,4})?(?:\s*번지)?/g;
  var PERSON_PREFIX_RE = /(성명|이름|작성자|신청인|진술인|면담자|참석자|응답자|대상자|결재자|확인자|보고자|입회인|담당\s*근로자|근로자\s*대표|근로자|담당자|대표이사|대표자|위원장|위원|간사)(\s*[:：=]\s*|\s+)([가-힣]{2,4})(?![가-힣])/g;
  var PERSON_SPACED_PREFIX_RE = /(성명|이름|작성자|신청인|진술인|면담자|참석자|응답자|대상자|결재자|확인자|보고자|입회인|담당\s*근로자|근로자\s*대표|근로자|담당자|대표이사|대표자|위원장|위원|간사)(\s*[:：=]\s*|\s+)([가-힣]{1,2}(?:[ \t]+[가-힣]{1,2}){1,3})(?![가-힣])/g;
  var PERSON_SUFFIX_RE = /(?<![가-힣])([가-힣]{2,4})(\s*)(님|씨|사원|주임|대리|과장|차장|부장|팀장|실장|본부장|사무장|상무|전무|이사|대표이사|위원|간사|노무사|변호사|세무사)(?![가-힣])/g;
  var PERSON_SPACED_SUFFIX_RE = /(?<![가-힣])([가-힣]{1,2}(?:[ \t]+[가-힣]{1,2}){1,2})([ \t]+)(님|씨|사원|주임|대리|과장|차장|부장|팀장|실장|본부장|사무장|상무|전무|이사|대표이사|위원|간사|노무사|변호사|세무사)(?![가-힣])/g;
  var PERSON_NARRATIVE_RE = /(?<![가-힣])([가-힣]{2,4})(은|는|이|가|을|를|도|의|와|과|에게|께|한테|께서|으로부터|로부터)(?=[\s,.)\]?!;:"]|$)/g;
  var PERSON_SPACED_NARRATIVE_RE = /(?<![가-힣])([가-힣]{1,2}(?:[ \t]+[가-힣]{1,2}){1,3})(은|는|이|가|을|를|도|의|와|과|에게|께|한테|께서|으로부터|로부터)(?=[\s,.)\]?!;:"]|$)/g;

  /* 통계청(KOSIS) 대한민국 성씨 286개 단성 전체 + 14개 복성 전체 (희귀 성씨 '피·궉·팽·태·복·봉·사공·제갈·황목' 등 누락 방지) */
  var ALL_KOR_SURNAMES = '가간갈감강견경계고곡공곽교구국군궁궉권근금기길김나난남낭내노뇌다단담당대도돈동두라랑류마매맹명모목묘무묵문미민박반방배백범변보복봉부비빈빙사삼상서석선설섭성소손송수순승시신심아안애야양어엄여연염엽영예오옥온옹왕요용우운원위유육윤은음이인임자장저전점정제조종좌주준즙증지진차창채척천초최추축춘탁탄태판팽편평포표풍피필하학한함해허현형호홍화환황후흥';
  var COMPOUND_SURNAMES = {
    '남궁': 1, '황보': 1, '제갈': 1, '사공': 1, '선우': 1, '독고': 1, '서문': 1,
    '동방': 1, '어금': 1, '망절': 1, '소봉': 1, '장곡': 1, '황목': 1, '강전': 1
  };
  var NON_NAME_WORDS = {
    '근로자': 1, '노동자': 1, '사용자': 1, '사업주': 1, '사업장': 1, '담당자': 1, '대표자': 1, '작성자': 1,
    '신청자': 1, '대상자': 1, '참석자': 1, '입사자': 1, '퇴사자': 1, '퇴직자': 1, '재직자': 1, '관리자': 1,
    '책임자': 1, '실무자': 1, '결재자': 1, '승인자': 1, '평가자': 1, '면접관': 1, '위원장': 1, '위원회': 1,
    '협의회': 1, '디자인': 1, '추진팀': 1, '인사팀': 1, '총무팀': 1, '전담팀': 1, '공인노무': 1, '전담': 1,
    '수습': 1, '신입': 1, '경력': 1, '생산직': 1, '사무직': 1, '기술직': 1, '영업직': 1, '연구직': 1,
    '관리직': 1, '현장직': 1, '정규직': 1, '계약직': 1, '일용직': 1, '단시간': 1, '고령자': 1, '외국인': 1,
    '장애인': 1, '임산부': 1, '배우자': 1, '본인': 1, '귀하': 1, '당사': 1, '귀사': 1, '회사': 1, '기업': 1,
    '법인': 1, '현장': 1, '본부': 1, '지점': 1, '공장': 1, '부서': 1, '소속': 1, '직위': 1, '직급': 1,
    '직책': 1, '성명': 1, '이름': 1, '주소': 1, '연락처': 1, '전화': 1, '이메일': 1, '서명': 1, '날인': 1,
    '동의': 1, '반대': 1, '찬성': 1, '과반수': 1, '설문': 1, '인터뷰': 1, '면담': 1, '자문': 1, '진단': 1,
    '설계': 1, '개선': 1, '도입': 1, '시행': 1, '운영': 1, '규정': 1, '규칙': 1, '임금': 1, '급여': 1,
    '수당': 1, '휴가': 1, '연차': 1, '교대': 1, '근무': 1, '근로': 1, '채용': 1, '평가': 1, '교육': 1,
    '훈련': 1, '정년': 1, '고용': 1, '노사': 1, '상생': 1, '일터': 1, '혁신': 1, '푸른': 1, '전원': 1,
    '전체': 1, '개별': 1, '일반': 1, '해당': 1, '관련': 1, '기타': 1, '비고': 1, '참조': 1, '첨부': 1,
    '선임': 1, '책임': 1, '수석': 1, '주관': 1, '참여': 1, '수행': 1, '발표': 1, '검토': 1, '보고': 1,
    '미정': 1, '없음': 1, '공란': 1, '생략': 1, '익명': 1, '무기명': 1, '비공개': 1, '해당없음': 1,
    '인사원': 1, '임금일': 1, '고용일': 1, '근로일': 1, '휴무일': 1, '정기분': 1, '소급분': 1,
    '기본급': 1, '상여금': 1, '퇴직금': 1, '위로금': 1, '지원금': 1, '장려금': 1, '보조금': 1, '수당금': 1,
    '회의실': 1, '사무실': 1, '상담실': 1, '휴게실': 1, '연구소': 1, '사무소': 1, '영업소': 1, '사업소': 1,
    '고용안': 1, '개편안': 1, '설계안': 1, '합의안': 1, '변경안': 1, '조정안': 1, '시행안': 1, '단일안': 1, '복수안': 1,
    '이사회': 1, '간담회': 1, '설명회': 1, '발표회': 1, '보고회': 1, '공청회': 1,
    '임직원': 1, '구성원': 1, '조합원': 1, '종업원': 1, '연구원': 1, '상담원': 1, '사무원': 1, '심사원': 1,
    '감사원': 1, '교육원': 1, '연수원': 1, '진흥원': 1, '평가원': 1, '개발원': 1, '기술원': 1, '관리원': 1,
    '공무원': 1, '승무원': 1, '경비원': 1, '미화원': 1, '조리원': 1, '보육원': 1, '수습원': 1, '노조원': 1, '대의원': 1,
    '인원수': 1, '근로수': 1, '시간수': 1, '교대조': 1, '근무조': 1, '생산조': 1, '출퇴근': 1, '괴롭힘': 1, '성희롱': 1,
    '본부장': 1, '부서장': 1, '사업부': 1, '총괄': 1, '인사': 1, '총무': 1, '노무': 1, '회계': 1, '재무': 1,
    '공인': 1, '대상': 1, '배치': 1, '주도형': 1, '온보딩': 1, '민주적': 1, '선출': 1, '구성': 1, '의견': 1,
    '확인': 1, '승인': 1, '지정': 1, '위촉': 1, '교부': 1, '청구': 1, '보호': 1, '지원': 1
  };
  var NARRATIVE_NON_NAME_WORDS = {
    '강화': 1, '개선': 1, '개편': 1, '검토': 1, '결과': 1, '경과': 1, '고려': 1, '공정성': 1, '과제': 1, '과정': 1, '관점': 1, '관리': 1,
    '가능성': 1, '가치': 1, '간소화': 1, '객관성': 1, '경영진': 1, '계정': 1, '구분': 1, '구성': 1, '구조': 1, '구조체': 1,
    '규명': 1, '근거': 1, '근속': 1, '금지': 1, '금액': 1, '기간': 1, '기대': 1, '기능': 1, '기록': 1, '기반': 1,
    '기본': 1, '기술': 1, '기여': 1, '기재': 1, '기준': 1, '기준선': 1, '기한': 1, '기회': 1, '내역': 1, '내용': 1,
    '노력': 1, '다음': 1, '단계': 1, '단위': 1, '단축': 1, '달성': 1, '담당': 1, '당신': 1, '대비': 1, '대상': 1, '대안': 1,
    '대응': 1, '대표': 1, '도메인': 1, '도입': 1, '도출': 1, '동시': 1, '마련': 1, '만족': 1, '명부': 1, '명시': 1,
    '모델': 1, '모집': 1, '목록': 1, '목적': 1, '목표': 1, '몰입': 1, '문구': 1, '문안': 1, '문장': 1, '문제': 1, '문체': 1,
    '문화': 1, '반영': 1, '발생': 1, '방법': 1, '방식': 1, '방안': 1, '방지': 1, '배분': 1, '배치': 1, '범위': 1, '변경': 1,
    '보상': 1, '보완': 1, '보장': 1, '보전': 1, '보호': 1, '부담': 1, '부문': 1, '부분': 1, '부여': 1, '부족': 1,
    '부하': 1, '분야': 1, '분석': 1, '분쟁': 1, '비교': 1, '비율': 1, '비중': 1, '비용': 1, '사람': 1, '사례': 1, '사유': 1,
    '사업': 1, '사용': 1, '사전': 1, '사후': 1, '사항': 1, '산정': 1, '상세': 1, '상승': 1, '상호': 1, '상태': 1,
    '상황': 1, '생산': 1, '생산성': 1, '서류': 1, '선택': 1, '설계': 1, '설명': 1, '성과': 1, '성장': 1, '세부': 1,
    '소득': 1, '소수점': 1, '소요': 1, '소지': 1, '소진율': 1, '소통': 1, '수립': 1, '수용': 1, '수용성': 1, '수준': 1,
    '수집': 1, '수치': 1, '순서': 1, '승인': 1, '승진': 1, '시각': 1, '시간': 1, '시기': 1, '시행일': 1, '신고': 1,
    '신규': 1, '신뢰': 1, '신청': 1, '실시': 1, '실적': 1, '실태': 1, '실효성': 1, '안내': 1, '안전': 1, '안전성': 1,
    '안정': 1, '안정성': 1, '약정': 1, '양식': 1, '업무': 1, '업종': 1, '여부': 1, '역량': 1, '역할': 1, '연계': 1,
    '연령': 1, '연봉': 1, '연속': 1, '연장': 1, '영역': 1, '영향': 1, '영향도': 1, '예방': 1, '예산': 1, '예시': 1,
    '예정': 1, '오류': 1, '요건': 1, '요구': 1, '요약': 1, '요인': 1, '요청': 1, '우선': 1, '원문': 1, '원인': 1,
    '원칙': 1, '위원': 1, '유도': 1, '유연': 1, '유연성': 1, '유지': 1, '유형': 1, '의견': 1, '의무': 1, '의미': 1,
    '의사': 1, '이내': 1, '이번': 1, '이상': 1, '이외': 1, '이유': 1, '이의': 1, '이익': 1, '이전': 1, '이하': 1,
    '이행': 1, '이후': 1, '인력': 1, '인식': 1, '인원': 1, '인정': 1, '일관성': 1, '일정': 1, '일치': 1, '임원': 1,
    '입사': 1, '자격': 1, '자료': 1, '자유': 1, '자율': 1, '작업': 1, '작성': 1, '장기': 1, '장소': 1, '재고': 1,
    '재직': 1, '재택': 1, '저장': 1, '적법성': 1, '적용': 1, '적정': 1, '점수': 1, '전반': 1, '전문성': 1, '전송': 1,
    '전제': 1, '전통': 1, '전환': 1, '절차': 1, '정도': 1, '정기': 1, '정립': 1, '정산': 1, '정상': 1, '정비': 1,
    '정보': 1, '정의': 1, '정원': 1, '정착': 1, '정책': 1, '정함': 1, '정합성': 1, '제목': 1, '조건': 1, '조정': 1,
    '조직': 1, '조치': 1, '조항': 1, '조화': 1, '종료': 1, '종류': 1, '주관': 1, '주요': 1, '주의': 1, '주장': 1,
    '주제': 1, '중단': 1, '중심': 1, '중요': 1, '지급': 1, '지속': 1, '지속성': 1, '지역': 1, '지원': 1, '지정': 1,
    '지침': 1, '지표': 1, '직무': 1, '진행': 1, '집계': 1, '집중': 1, '차별': 1, '차이': 1, '차트': 1, '참석': 1,
    '참고': 1, '채택': 1, '처우': 1, '처리': 1, '체결': 1, '체계': 1, '초안': 1, '최근': 1, '최대': 1, '최소': 1, '최종': 1,
    '최초': 1, '추가': 1, '추진': 1, '출근': 1, '출산': 1, '충족': 1, '취업': 1, '취지': 1, '타당성': 1, '통보': 1,
    '금번': 1, '작년': 1, '올해': 1, '내년': 1, '전년': 1, '당해': 1, '직전': 1, '향후': 1, '연도': 1, '연간': 1, '월간': 1, '일간': 1, '소계': 1, '총계': 1,
    '통상': 1, '통합': 1, '투명성': 1, '투표': 1, '특례': 1, '특성': 1, '판단': 1, '편성': 1, '평균': 1, '포함': 1,
    '표시': 1, '표준': 1, '표현': 1, '품위': 1, '품질': 1, '피드백': 1, '피로': 1, '피보험': 1, '피해': 1, '필요': 1,
    '필요성': 1, '하나': 1, '한계': 1, '한도': 1, '합계': 1, '합리성': 1, '항목': 1, '해고': 1, '해소': 1, '해지': 1,
    '핵심': 1, '행정': 1, '현재': 1, '현황': 1, '협력': 1, '협의': 1, '협약': 1, '형평성': 1, '형태': 1, '호봉': 1,
    '확대': 1, '확보': 1, '확인': 1, '확정': 1, '환경': 1, '환산': 1, '활동': 1, '활용': 1, '회신': 1, '회의': 1,
    '효과': 1, '효율': 1, '효율성': 1, '후속': 1, '휴게': 1, '휴일': 1, '휴직': 1
  };

  /* 단일 1글자('국·표·록·부·과·처·법·령·칙·항')는 '김민국·박진표·이수록' 등 실명 끝글자와 겹치므로 쓰지 않고 2글자 이상 복합 접미만 제외 */
  var NON_PERSON_COMPOUND_SUFFIX_RE = /(?:팀|사업부|인사부|총무부|관리부|기획부|영업부|생산부|품질부|안전부|개발부|재무부|회계부|법무부|연구부|기술부|운영부|지원부|노동부|기업부|인사과|총무과|노무과|경리과|회계과|재무과|기획과|영업과|생산과|품질과|안전과|관리과|사무국|인사국|총무국|기획국|노동국|고용국|관리국|본부|사무처|관리처|기준법|노동법|노조법|산안법|고용법|평등법|파견법|기간법|퇴직법|보험법|세법|상법|민법|형법|시행령|대통령령|부령|규칙|준칙|회칙|수칙|세칙|임금표|근무표|교대표|호봉표|산정표|대조표|집계표|점검표|일정표|단가표|비교표|현황표|목록표|분석표|요약표|회의록|면담록|상담록|진술록|출석록|점검록|기록|조항|사항|문항|세부항|단서항|특례항|진율|여율|성률|직률|용률|답률|환율|상률|비율|효율|요율|세율|확률)$/;

  /* 어근+조사 결합(full = s + pt)이 우연히 '~재가(독고영재가)·~제도(강민제도)·~성과(김민성과)·~건의(김건의)'로 끝나는 충돌을 막기 위해 복합명사 전체 일치 또는 '검증된 2음절 일반명사 + 2음절 제도명사' 구조만 허용 */
  var FULL_NARRATIVE_NON_NAME_RE = /^(?:연차휴가|출산휴가|육아휴가|보상휴가|포상휴가|약정휴가|유급휴가|무급휴가|특별휴가|대체휴가|병가|공가|인사평가|직무평가|성과평가|역량평가|다면평가|노사협의|사전협의|서면합의|노사합의|개별동의|집단동의|근로자의|사용자의|사업주의|위원회의|협의회의|신뢰도|만족도|몰입도|수용도|기여도|완성도|중요도|정확도|인지도|선호도|활용도|집중도|이해도|적합도|성숙도|참여도|충실도|차년도|전년도|당해연도|금년도|내년도|인사과|총무과|노무과|경리과|회계과|재무과|기획과|영업과|생산과|품질과|안전과|관리과)$/;
  var COMPOUND_HEAD2_ALLOW = {
    '제안': 1, '서면': 1, '유급': 1, '무급': 1, '특별': 1, '수시': 1, '임시': 1, '상시': 1, '복리': 1, '복지': 1, '대체': 1
  };
  var COMPOUND_TAIL2_NOUN_RE = /^(?:제도|회의|합의|협의|심의|결의|동의|논의|건의|휴가|평가|단가|원가|효과|성과|경과|결과)$/;

  /* 제목·첨부 파일명 단독 토큰 가림용 일반어 사전 및 2글자 이상 문서 복합어 접미 */
  var TITLE_NON_NAME_WORDS = {
    '일터혁신': 1, '상생컨설팅': 1, '중간보고': 1, '최종보고': 1, '결과보고': 1, '완료보고': 1, '수행계획': 1, '수행보고': 1,
    '취업규칙': 1, '근로계약': 1, '임금대장': 1, '급여대장': 1, '연차대장': 1, '근태대장': 1, '출퇴근부': 1, '신구대조': 1,
    '조직진단': 1, '노사협의': 1, '현장실사': 1, '기초자료': 1, '추가자료': 1, '보완자료': 1, '증빙자료': 1, '참고자료': 1,
    '회의자료': 1, '발표자료': 1, '제출자료': 1, '요청자료': 1, '회신자료': 1, '교육자료': 1, '설명자료': 1, '검토의견': 1,
    '체크리스트': 1, '타임스탬프': 1, '모의계산': 1, '시뮬레이션': 1, '사후관리': 1, '이행점검': 1, '정산서류': 1,
    '안내문': 1, '공고문': 1, '결정문': 1, '합의문': 1, '협약문': 1, '선언문': 1, '결의문': 1, '요청문': 1, '회신문': 1,
    '인사관리': 1, '노무관리': 1, '복무관리': 1, '근태관리': 1, '임금체계': 1, '평가체계': 1, '보상체계': 1, '직무분석': 1,
    '직무급': 1, '직능급': 1, '성과급': 1, '통상임금': 1, '최저임금': 1, '포괄임금': 1, '유연근무': 1, '선택근로': 1,
    '탄력근로': 1, '재택근무': 1, '원격근무': 1, '교대근무': 1, '단축근무': 1, '연장근로': 1, '야간근로': 1, '휴일근로': 1,
    '연차휴가': 1, '출산휴가': 1, '육아휴직': 1, '가족돌봄': 1, '계속고용': 1, '재고용': 1, '정년연장': 1, '안전보건': 1,
    '위험성': 1, '산업안전': 1, '중대재해': 1, '직장내': 1, '일가정': 1, '양립지원': 1, '상반기': 1, '하반기': 1,
    '전반기': 1, '후반기': 1, '푸른노무': 1, '노사발전': 1, '이음센터': 1, '고용노동': 1, '일자리': 1, '출퇴근': 1,
    '별첨': 1, '붙임': 1, '송부': 1, '발송': 1, '전달': 1, '공유': 1, '답신': 1, '문의': 1, '공지': 1, '알림': 1,
    '필독': 1, '긴급': 1, '대외비': 1, '보완': 1, '취합': 1, '정리': 1, '결재': 1, '직인': 1, '도장': 1, '서식': 1,
    '샘플': 1, '제출': 1, '접수': 1, '등록': 1, '개정': 1, '제정': 1, '폐지': 1, '명단': 1, '계약': 1, '사진': 1,
    '증빙': 1, '문서': 1, '파일': 1, '폴더': 1, '압축': 1, '최신': 1, '구버전': 1, '신버전': 1, '대면': 1, '비대면': 1,
    '화상': 1, '방문': 1, '현장': 1, '착수': 1, '종결': 1, '마감': 1, '연기': 1, '취소': 1, '보류': 1,
    '주일': 1, '주간': 1, '개월': 1, '천원': 1, '백원': 1, '십원': 1, '만원': 1, '억원': 1, '백만': 1, '천만': 1,
    '호실': 1, '인의': 1, '명의': 1, '명중': 1, '인중': 1, '세대': 1, '가구': 1, '건수': 1, '횟수': 1, '일수': 1,
    '시급': 1, '일급': 1, '월급': 1, '주급': 1, '최종안': 1, '수정안': 1, '보완안': 1, '검토안': 1, '현행': 1,
    '기존': 1, '신설': 1, '삭제': 1, '월별': 1, '일별': 1, '연별': 1, '개인별': 1, '부서별': 1, '직군별': 1,
    '직급별': 1, '반차': 1, '반반차': 1, '배포용': 1, '보고용': 1, '제출용': 1, '검토용': 1, '보관용': 1, '참고용': 1, '발표용': 1,
    '당사는': 1, '귀사는': 1, '회사는': 1, '기업은': 1, '법인은': 1, '첨부된': 1, '첨부한': 1, '작성된': 1, '작성한': 1,
    '제출된': 1, '제출한': 1, '수정된': 1, '수정한': 1, '보완된': 1, '보완한': 1, '확정된': 1, '확정한': 1, '개정된': 1, '개정한': 1,
    '영업': 1, '개발': 1, '품질': 1, '물류': 1, '자재': 1, '구매': 1, '설비': 1, '기계': 1, '전기': 1, '포장': 1,
    '조립': 1, '가공': 1, '출하': 1, '배송': 1, '운송': 1, '창고': 1, '비서': 1, '기획': 1, '홍보': 1, '전산': 1, '마케팅': 1, '공통': 1
  };
  var TITLE_DOC_SUFFIX_RE = /(?:보고서|계약서|동의서|신청서|확인서|의견서|명세서|내역서|계획서|협약서|이력서|사직서|진술서|경위서|시말서|청구서|증명서|서약서|위임장|추천서|진단서|개선안|설계안|개정안|합의안|변경안|조정안|시행안|단일안|복수안|수정본|최종본|초안본|검토본|요약본|통합본|제출본|서명본|날인본|확정본|발표본|스캔본|배포본|참고본|취합본|보관본|사본|원본|정본|부본|규정집|자료집|사례집|출근부|명부|기록부|관리부|설문지|평가지|질문지|서명지|답변지|조직도|체계도|흐름도|구상도|수수료|자문료|컨설팅|산출물|결과물|유인물|홍보물|제조업|건설업|운수업|서비스|도소매|금융업|의료업|통신업|숙박업|음식업|회차|차수|년도|연도|반기|분기|월분|일분|주차)$/;

  /* 성씨 사전에 의존하지 않는 독립 인명 문맥 탐지기 (가림 누락·부분 띄어쓰기·비표준 호칭까지 2차 독립 감사 fail-closed 차단용) */
  var INDEP_ROLE_ALLOW = {
    '근로자': 1, '노동자': 1, '사용자': 1, '사업주': 1, '사업장': 1, '담당자': 1, '대표자': 1, '작성자': 1,
    '신청자': 1, '대상자': 1, '참석자': 1, '입사자': 1, '퇴사자': 1, '퇴직자': 1, '재직자': 1, '응답자': 1,
    '관리자': 1, '책임자': 1, '실무자': 1, '결재자': 1, '승인자': 1, '평가자': 1, '위원장': 1, '위원회': 1,
    '협의회': 1, '이사회': 1, '간담회': 1, '설명회': 1, '보고회': 1, '위원': 1, '간사': 1, '노무사': 1,
    '공인노무사': 1, '컨설턴트': 1, '심사원': 1, '경영진': 1, '임직원': 1, '구성원': 1, '조합원': 1,
    '회사': 1, '기업': 1, '당사': 1, '귀사': 1, '법인': 1, '부서': 1, '노사': 1, '노조': 1, '전원': 1,
    '전체': 1, '과반수': 1, '다수': 1, '일부': 1, '양측': 1, '쌍방': 1, '사람': 1, '본인': 1, '정부': 1,
    '재단': 1, '센터': 1, '부서장': 1, '본부장': 1, '팀장': 1, '실장': 1
  };
  var INDEP_LABEL_LEAK_RE = /(?:성명|이름|주민등록번호|생년월일|휴대폰|연락처|계좌번호|담당자|대표자|작성자|신청인|면담자|참석자|진술인)\s*[:：=]\s*(?!\[가림\]|\[대표자\]|\[담당자\]|\[해당 기업\])(?:[가-힣]{1,2}(?:[ \t]*[가-힣]{1,2}){1,3}|[0-9]{2,})/;
  var INDEP_HONORIFIC_RE = /(?<![가-힣\[])([가-힣]{2,4}|[가-힣]{1,2}(?:[ \t]+[가-힣]{1,2}){1,3})(께서|께|한테)(?=[\s,.)\]?!;:"]|$)/g;
  var INDEP_HUMAN_ACT_RE = /(?<![가-힣\[])([가-힣]{2,4}|[가-힣]{1,2}(?:[ \t]+[가-힣]{1,2}){1,3})(?:은|는|이|가|도|과|와)\s+(?:면담|인터뷰|참석했|불참했|동석했|배석했|발언했|진술했|호소했|항의했|서명했|날인했|퇴사했|퇴직했|입사했|휴직했|복직했|찬성했|반대했|동의했|건의했|제안했|요청했|요구했|문의했|답변했|회신했|설명했|전달했|보고했|작성했|제출했|확인했|검토했|(?:면담|회의|설명회|간담회|교육|실사|협의회)에\s*(?:참석|불참|동석|배석|참여|동행)|(?:업무|처우|근무|제도|연차|수당|임금|교대|개선안|설계안|규정안|합의안|변경안|조정안|초안|의견|자료|서류|고충|불만|안건|내용|사항)[^\n.]{0,20}?(?:요청했|요구했|건의했|제안했|문의했|동의했|반대했|찬성했|확인했|검토했|제출했|제시했|개진했|수렴했|청취했|전달했|설명했|작성했|보고했|밝혔))/g;
  var INDEP_GENITIVE_OPINION_RE = /(?<![가-힣\[])([가-힣]{2,4}|[가-힣]{1,2}(?:[ \t]+[가-힣]{1,2}){1,3})의\s+의견을\s*(?:수렴|청취|반영|검토|제시|전달|확인)/g;
  /* 성씨 사전에 의존하지 않고 순서·길이 무관 영숫자 접두·접미 및 구분자(_/-/괄호/확장자)로 문서 종류와 결합된 고유명사를 별도로 탐지 */
  var DOC_NAME_KIND_SRC = '(?:중간\\s*보고(?:서)?|최종\\s*보고(?:서)?|결과\\s*보고(?:서)?|완료\\s*보고(?:서)?|수행\\s*보고(?:서)?|착수\\s*보고(?:서)?|취업\\s*규칙|근로\\s*계약(?:서)?|연봉\\s*계약(?:서)?|임금\\s*대장|급여\\s*대장|임금\\s*명세(?:서)?|급여\\s*명세(?:서)?|연차(?:\\s*대장|\\s*신청서)?|출퇴근(?:\\s*기록부|부)?|신청서|동의서|확인서|서약서|사직서|이력서|진술서|경위서|시말서|면담록|회의록|상담록|개선안|설계안|서명본|산출물)';
  var INDEP_DOC_NAME_LEAK_RE_1 = new RegExp(
    '(?<![가-힣])[A-Za-z0-9]*([가-힣]{2,4}|[가-힣]{1,2}(?:[ \\t]+[가-힣]{1,2}){1,2})[A-Za-z0-9]*(?:(?:[_\\-\\s]+[A-Za-z0-9]+)*[\\)\\]]?[_\\-]+(?:[A-Za-z0-9]+[_\\-\\s]*)*' + DOC_NAME_KIND_SRC + '|(?:(?:[_\\-\\s]+[A-Za-z0-9]+)*[\\)\\]][ \\t]*|[ \\t.]+)(?:[A-Za-z0-9]+[ \\t._\\-]+)*' + DOC_NAME_KIND_SRC + '(?=\\.[A-Za-z0-9]{2,5}))',
    'g'
  );
  var INDEP_DOC_NAME_LEAK_RE_2 = new RegExp(
    DOC_NAME_KIND_SRC + '(?:[_\\-]+(?:[A-Za-z0-9]+[_\\-]+)*[\\(\\[]?(?:[A-Za-z0-9]+[_\\-\\s]+)*[A-Za-z0-9]*([가-힣]{2,4}|[가-힣]{1,2}(?:[ \\t]+[가-힣]{1,2}){1,2})[A-Za-z0-9]*(?:[_\\-\\s]+[A-Za-z0-9]+)*[\\)\\]]?(?=\\.[A-Za-z0-9]{2,5}|$|[_\\-\\s,)\\]\'"」』>])|(?:[ \\t]*[\\(\\[](?:[A-Za-z0-9]+[_\\-\\s]+)*[A-Za-z0-9]*([가-힣]{2,4}|[가-힣]{1,2}(?:[ \\t]+[가-힣]{1,2}){1,2})[A-Za-z0-9]*(?:[_\\-\\s]+[A-Za-z0-9]+)*[\\)\\]]|[ \\t.]+(?:[A-Za-z0-9]+[ \\t._\\-]+)*[A-Za-z0-9]*([가-힣]{2,4}|[가-힣]{1,2}(?:[ \\t]+[가-힣]{1,2}){1,2})[A-Za-z0-9]*)(?=\\.[A-Za-z0-9]{2,5}))',
    'g'
  );

  function isAllowedIndependentSubject(rawCand) {
    var raw = String(rawCand || '').trim();
    if (!raw) return true;
    var compact = raw.replace(/\s+/g, '');
    if (!compact || compact.length < 2 || compact.length > 5) return true;
    if (INDEP_ROLE_ALLOW[compact] || NON_NAME_WORDS[compact] || NARRATIVE_NON_NAME_WORDS[compact] || TITLE_NON_NAME_WORDS[compact]) return true;
    if (NON_PERSON_COMPOUND_SUFFIX_RE.test(compact) || TITLE_DOC_SUFFIX_RE.test(compact)) return true;
    if (/(?:했다|됐다|왔다|갔다|봤다|냈다|줬다|한다|된다|이다|있다|없다|같다|높다|낮다|많다|적다|완료|확정|진행|검토|반영)$/.test(compact)) return true;
    var parts = raw.split(/[ \t]+/).filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.length >= 2 && (INDEP_ROLE_ALLOW[p] || NON_NAME_WORDS[p] || NARRATIVE_NON_NAME_WORDS[p] || TITLE_NON_NAME_WORDS[p])) {
        if (!(i === 0 && COMPOUND_SURNAMES[p] && compact.length >= 3)) return true;
      }
    }
    return false;
  }

  function hasIndependentPersonAuditLeak(text) {
    var s = String(text == null ? '' : text);
    if (!s) return false;
    /* 보호된 자리표시([가림]·[해당 기업]·[대표자]·[담당자])는 앞뒤 글자가 가짜 부분 띄어쓰기 인명으로 합쳐지지 않게 경계 기호로 분리 */
    var cleanS = s.replace(/\[(?:가림|해당 기업|대표자|담당자)\]/g, ' | ');
    if (INDEP_LABEL_LEAK_RE.test(s)) return true;
    INDEP_HONORIFIC_RE.lastIndex = 0;
    var hm;
    while ((hm = INDEP_HONORIFIC_RE.exec(cleanS)) !== null) {
      if (!isAllowedIndependentSubject(hm[1])) return true;
    }
    INDEP_HUMAN_ACT_RE.lastIndex = 0;
    var am;
    while ((am = INDEP_HUMAN_ACT_RE.exec(cleanS)) !== null) {
      if (!isAllowedIndependentSubject(am[1])) return true;
    }
    INDEP_GENITIVE_OPINION_RE.lastIndex = 0;
    var gm;
    while ((gm = INDEP_GENITIVE_OPINION_RE.exec(cleanS)) !== null) {
      if (!isAllowedIndependentSubject(gm[1])) return true;
    }
    INDEP_DOC_NAME_LEAK_RE_1.lastIndex = 0;
    var dm1;
    while ((dm1 = INDEP_DOC_NAME_LEAK_RE_1.exec(cleanS)) !== null) {
      if (!isAllowedIndependentSubject(dm1[1])) return true;
    }
    INDEP_DOC_NAME_LEAK_RE_2.lastIndex = 0;
    var dm2;
    while ((dm2 = INDEP_DOC_NAME_LEAK_RE_2.exec(cleanS)) !== null) {
      var cand2 = dm2[1] || dm2[2] || dm2[3];
      if (!isAllowedIndependentSubject(cand2)) return true;
    }
    return false;
  }

  function hasHangulJongseong(ch) {
    if (!ch) return false;
    var code = ch.charCodeAt(0) - 0xAC00;
    return code >= 0 && code <= 11171 && (code % 28) !== 0;
  }

  function isLikelyNarrativePersonName(w, particle) {
    var s = str(w);
    var pt = str(particle);
    if (!/^[가-힣]{2,4}$/.test(s) || !pt) return false;
    var full = s + pt;
    if (FULL_NARRATIVE_NON_NAME_RE.test(full)) {
      return false;
    }
    if (full.length === 4 && COMPOUND_TAIL2_NOUN_RE.test(full.slice(2, 4))) {
      var h2 = full.slice(0, 2);
      if (NON_NAME_WORDS[h2] || NARRATIVE_NON_NAME_WORDS[h2] || TITLE_NON_NAME_WORDS[h2] || COMPOUND_HEAD2_ALLOW[h2]) {
        return false;
      }
    }
    if (s.charAt(s.length - 1) === '하' && pt === '는') return false;
    var jong = hasHangulJongseong(s.charAt(s.length - 1));
    if ((pt === '은' || pt === '이' || pt === '을' || pt === '과') && !jong) return false;
    if ((pt === '는' || pt === '가' || pt === '를' || pt === '와') && jong) return false;
    if (NON_NAME_WORDS[s] || NARRATIVE_NON_NAME_WORDS[s] || TITLE_NON_NAME_WORDS[s]) return false;
    if (NON_PERSON_COMPOUND_SUFFIX_RE.test(s) || TITLE_DOC_SUFFIX_RE.test(s)) {
      return false;
    }
    if (s.length === 4) {
      return !!COMPOUND_SURNAMES[s.slice(0, 2)];
    }
    return ALL_KOR_SURNAMES.indexOf(s.charAt(0)) >= 0;
  }

  function isLikelyKoreanPersonName(w, explicitColon) {
    var s = str(w);
    if (!/^[가-힣]{2,4}$/.test(s)) return false;
    if (NON_NAME_WORDS[s]) return false;
    /* 성명:/담당자:/이름: 등 콜론 구분자 뒤는 명시적 인명 자리이므로 끝 글자나 희귀 성씨 제한 없이 인명으로 판별 */
    if (explicitColon) {
      if (NON_PERSON_COMPOUND_SUFFIX_RE.test(s) || /(?:액|년|월)$/.test(s)) return false;
      return true;
    }
    if (NON_PERSON_COMPOUND_SUFFIX_RE.test(s) || TITLE_DOC_SUFFIX_RE.test(s) || /(?:액|년|월)$/.test(s)) return false;
    if (s.length === 4) {
      return !!COMPOUND_SURNAMES[s.slice(0, 2)];
    }
    return ALL_KOR_SURNAMES.indexOf(s.charAt(0)) >= 0;
  }

  function isLikelySpacedPersonName(rawSpaced, particleOrColon, mode) {
    var raw = String(rawSpaced || '').trim();
    var parts = raw.split(/[ \t]+/).filter(Boolean);
    if (parts.length < 2) return false;
    var compact = parts.join('');
    if (!/^[가-힣]{2,4}$/.test(compact)) return false;
    /* '전 부서는', '월 임금은'처럼 수식어 + 독립 2음절 일반명사 구문은 부분 띄어쓰기 인명에서 제외 */
    for (var i = 0; i < parts.length; i++) {
      var tok = parts[i];
      if (tok.length >= 2) {
        if (i === 0 && COMPOUND_SURNAMES[tok] && compact.length >= 3) continue;
        if (NON_NAME_WORDS[tok] || NARRATIVE_NON_NAME_WORDS[tok] || TITLE_NON_NAME_WORDS[tok]) return false;
      }
    }
    if (mode === 'narrative') {
      return isLikelyNarrativePersonName(compact, particleOrColon);
    }
    return isLikelyKoreanPersonName(compact, !!particleOrColon);
  }

  function isStandaloneTitlePersonName(w) {
    var s = str(w);
    if (!/^[가-힣]{2,4}$/.test(s)) return false;
    if (NON_NAME_WORDS[s] || NARRATIVE_NON_NAME_WORDS[s] || TITLE_NON_NAME_WORDS[s] || INDEP_ROLE_ALLOW[s]) return false;
    if (NON_PERSON_COMPOUND_SUFFIX_RE.test(s) || TITLE_DOC_SUFFIX_RE.test(s) || /(?:액|년|월|일|차|회|호|동|층|번|팀|부|과|실|팀장|부장|과장)$/.test(s)) {
      /* 주의: '호·동'이 인명 끝글자('박지호·홍길동')일 수 있으므로 3~4자 인명에서는 숫자 뒤가 아니면 허용해야 함 */
    }
    if (NON_PERSON_COMPOUND_SUFFIX_RE.test(s) || TITLE_DOC_SUFFIX_RE.test(s) || /(?:년|월|차수|회차)$/.test(s)) return false;
    if (s.length === 4) {
      return !!COMPOUND_SURNAMES[s.slice(0, 2)];
    }
    /* 2글자 외자 토큰은 일반 한자어와 겹침이 많으므로 흔한 성씨 + 일반어 사전에 없을 때만, 3글자는 286개 전 성씨 허용 */
    return ALL_KOR_SURNAMES.indexOf(s.charAt(0)) >= 0;
  }

  var PLACEHOLDER_BRACKET_RE = /\[(?:가림|해당 기업|대표자|담당자)\]/g;
  /* 숫자·영문 접두·접미('김민준1_중간보고서.pptx', '2026김민준_중간보고서.pptx')도 이름 토큰 경계로 분리 처리 */
  var STANDALONE_SPACED_LABEL_RE = /(?<![가-힣])([가-힣]{1,2}(?:[ \t]+[가-힣]{1,2}){1,2})(?![가-힣])/g;
  var STANDALONE_SOLID_LABEL_RE = /(?<![가-힣])([가-힣]{2,4})(?![가-힣])/g;
  var FILE_EXT_SRC = '\\.(?:pptx|xlsx|xls|csv|hwpx|hwp|docx|doc|pdf|txt|zip|jpg|jpeg|png|webp)';
  var INLINE_FILENAME_EXPR_RE = new RegExp(
    '(?:' +
      '[^\\s,{}<>"\'「」『』]*_[^\\s,{}<>"\'「」『』]+|' +
      '[A-Za-z0-9가-힣()\\[\\]._\\-]+-' + DOC_NAME_KIND_SRC + '[A-Za-z0-9가-힣()\\[\\]._\\-]*(?:' + FILE_EXT_SRC + ')?|' +
      DOC_NAME_KIND_SRC + '-[A-Za-z0-9가-힣()\\[\\]._\\-]+(?:' + FILE_EXT_SRC + ')?|' +
      '[A-Za-z0-9()\\[\\]._\\-]*[가-힣]{1,4}(?:[ \\t]+[가-힣]{1,2}){0,2}[A-Za-z0-9()\\[\\]._\\-]*[ \\t]+' + DOC_NAME_KIND_SRC + FILE_EXT_SRC + '|' +
      DOC_NAME_KIND_SRC + '[ \\t]+[A-Za-z0-9()\\[\\]._\\-]*[가-힣]{1,4}(?:[ \\t]+[가-힣]{1,2}){0,2}[A-Za-z0-9()\\[\\]._\\-]*' + FILE_EXT_SRC + '|' +
      '[^\\s,{}<>"\'「」『』]{2,}' + FILE_EXT_SRC +
    ')(?![A-Za-z0-9_])',
    'gi'
  );

  function maskStandaloneNamesInLabel(labelText) {
    var raw = String(labelText == null ? '' : labelText);
    if (!raw) return '';
    /* 대괄호 자리표시를 임시 토큰으로 보호 */
    var slots = [];
    var work = raw.replace(PLACEHOLDER_BRACKET_RE, function (m) {
      var idx = slots.length;
      slots.push(m);
      return '\uE000' + idx + '\uE001';
    });
    /* 확장자 분리 보존 */
    var extMatch = work.match(/(\.[A-Za-z0-9]{2,5})$/);
    var ext = extMatch ? extMatch[1] : '';
    var stem = ext ? work.slice(0, -ext.length) : work;

    stem = stem.replace(STANDALONE_SPACED_LABEL_RE, function (full, cand) {
      var parts = String(cand || '').trim().split(/[ \t]+/).filter(Boolean);
      if (parts.length < 2) return full;
      var compact = parts.join('');
      if (!/^[가-힣]{2,4}$/.test(compact)) return full;
      for (var i = 0; i < parts.length; i++) {
        var tok = parts[i];
        if (tok.length >= 2) {
          if (i === 0 && COMPOUND_SURNAMES[tok] && compact.length >= 3) continue;
          if (NON_NAME_WORDS[tok] || NARRATIVE_NON_NAME_WORDS[tok] || TITLE_NON_NAME_WORDS[tok] || INDEP_ROLE_ALLOW[tok]) return full;
        }
      }
      return isStandaloneTitlePersonName(compact) ? GARIM : full;
    });

    stem = stem.replace(STANDALONE_SOLID_LABEL_RE, function (full, cand) {
      return isStandaloneTitlePersonName(cand) ? GARIM : full;
    });

    var rebuilt = stem + ext;
    return rebuilt.replace(/\uE000(\d+)\uE001/g, function (_, idx) {
      return slots[Number(idx)] || '';
    });
  }

  function hasStandaloneNameInLabel(labelText) {
    var raw = String(labelText == null ? '' : labelText);
    if (!raw) return false;
    var stripped = raw.replace(PLACEHOLDER_BRACKET_RE, ' ');
    var extMatch = stripped.match(/(\.[A-Za-z0-9]{2,5})$/);
    var stem = extMatch ? stripped.slice(0, -extMatch[1].length) : stripped;
    return maskStandaloneNamesInLabel(stem) !== stem;
  }

  var GARIM = '[가림]';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).replace(/[,\s원명시간%hH]/g, '').trim();
    if (!s) return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function round1(v) { return Math.round((Number(v) || 0) * 10) / 10; }
  function round2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function mailOf(v) {
    var m = String(v == null ? '' : v).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0].toLowerCase() : '';
  }
  function domainOf(email) {
    var e = mailOf(email);
    var at = e.indexOf('@');
    return at > 0 ? e.slice(at + 1).toLowerCase() : '';
  }
  function normCorpName(v) {
    return str(v).normalize('NFC')
      .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|\(사\)|사단법인|\(재\)|재단법인|농업회사법인/g, '')
      .replace(/\s+/g, '')
      .replace(/[.,·・\-–—_'"()\[\]]/g, '')
      .toLowerCase();
  }
  function rowsOf(v) {
    var x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(function (r) { return r && typeof r === 'object'; });
    if (x && typeof x === 'object') {
      return Object.keys(x).map(function (k) { return x[k]; }).filter(function (r) { return r && typeof r === 'object'; });
    }
    return [];
  }
  function dayOf(ms) {
    var n = Number(ms);
    return (isFinite(n) && n > 0) ? new Date(n + 9 * 3600e3).toISOString().slice(0, 10) : '';
  }

  /* ══ 1. 개인정보 2중 가림 및 잔존 검증 게이트 ══════════════════════════ */
  function maskPiiStrict(rawText, names) {
    var t = String(rawText == null ? '' : rawText);

    /* 기등록 상호·대표자·담당자 치환(되돌리기용 자리표시)을 먼저 수행 */
    var back = [], seenAs = {};
    var namePairs = [];
    (Array.isArray(names) ? names : []).forEach(function (n) {
      var v = str(n && n.v), as = str(n && n.as);
      if (v.length < 2 || !as) return;
      namePairs.push({ v: v, as: as, orig: v });
      var bare = v.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, '').trim();
      if (bare !== v && bare.length >= 2) namePairs.push({ v: bare, as: as, orig: v });
    });
    namePairs.forEach(function (n) {
      if (!seenAs[n.as]) { seenAs[n.as] = 1; back.push({ as: n.as, v: n.orig }); }
    });
    namePairs.sort(function (a, b) { return b.v.length - a.v.length; }).forEach(function (n) {
      t = t.split(n.v).join(n.as);
    });

    t = t
      .replace(RRN_TIGHT_RE, '$1' + GARIM)
      .replace(RRN_SPACED_RE, '$1' + GARIM)
      .replace(EMAIL_RE, GARIM)
      .replace(BIZ_RE, GARIM)
      .replace(TEL_RE, GARIM)
      .replace(REP_TEL_RE, GARIM)
      .replace(ADDR_ROAD_RE, GARIM)
      .replace(ADDR_LOT_RE, GARIM)
      .replace(ACCT_LONG_RE, function (m) {
        var digits = m.replace(/\D/g, '');
        if (/^(19|20)\d{6}$/.test(digits)) return m;
        return digits.length >= 10 ? GARIM : m;
      })
      .replace(PERSON_SPACED_PREFIX_RE, function (full, role, sep, nm) {
        return isLikelySpacedPersonName(nm, /[:：=]/.test(sep), 'prefix') ? (role + sep + GARIM) : full;
      })
      .replace(PERSON_PREFIX_RE, function (full, role, sep, nm) {
        return isLikelyKoreanPersonName(nm, /[:：=]/.test(sep)) ? (role + sep + GARIM) : full;
      })
      .replace(PERSON_SPACED_SUFFIX_RE, function (full, nm, sp, suf) {
        return isLikelySpacedPersonName(nm, false, 'suffix') ? (GARIM + sp + suf) : full;
      })
      .replace(PERSON_SUFFIX_RE, function (full, nm, sp, suf) {
        return isLikelyKoreanPersonName(nm, false) ? (GARIM + sp + suf) : full;
      })
      .replace(PERSON_SPACED_NARRATIVE_RE, function (full, nm, pt) {
        return isLikelySpacedPersonName(nm, pt, 'narrative') ? (GARIM + pt) : full;
      })
      .replace(PERSON_NARRATIVE_RE, function (full, nm, pt) {
        return isLikelyNarrativePersonName(nm, pt) ? (GARIM + pt) : full;
      })
      .replace(INLINE_FILENAME_EXPR_RE, function (full) {
        return maskStandaloneNamesInLabel(full);
      });

    return { text: t, back: back };
  }

  function unmaskNames(text, back) {
    var t = String(text == null ? '' : text);
    (Array.isArray(back) ? back : []).forEach(function (b) {
      if (b && b.as) t = t.split(b.as).join(str(b.v));
    });
    return t;
  }

  function hasResidualPii(text) {
    var s = String(text == null ? '' : text);
    if (!s) return false;
    RRN_TIGHT_RE.lastIndex = 0;
    RRN_SPACED_RE.lastIndex = 0;
    if (RRN_TIGHT_RE.test(s) || RRN_SPACED_RE.test(s)) return true;

    EMAIL_RE.lastIndex = 0;
    if (EMAIL_RE.test(s)) return true;

    BIZ_RE.lastIndex = 0;
    if (BIZ_RE.test(s)) return true;

    var phones = s.match(/(?<!\d)(?:\+82[-.\s]?)?\(?0\d{1,2}\)?[-.\s]?\d{3,4}[-.\s]\d{4}(?!\d)/g) || [];
    for (var i = 0; i < phones.length; i++) {
      var digits = phones[i].replace(/\D/g, '');
      var mid = digits.slice(digits.length === 11 ? 3 : (digits.slice(0, 2) === '02' ? 2 : 3), -4);
      if (mid && !/^0+$/.test(mid)) return true;
    }

    ADDR_ROAD_RE.lastIndex = 0;
    ADDR_LOT_RE.lastIndex = 0;
    if (ADDR_ROAD_RE.test(s) || ADDR_LOT_RE.test(s)) return true;

    PERSON_SPACED_PREFIX_RE.lastIndex = 0;
    var spm;
    while ((spm = PERSON_SPACED_PREFIX_RE.exec(s)) !== null) {
      if (isLikelySpacedPersonName(spm[3], /[:：=]/.test(spm[2]), 'prefix')) return true;
    }
    PERSON_PREFIX_RE.lastIndex = 0;
    var pm;
    while ((pm = PERSON_PREFIX_RE.exec(s)) !== null) {
      if (isLikelyKoreanPersonName(pm[3], /[:：=]/.test(pm[2]))) return true;
    }
    PERSON_SPACED_SUFFIX_RE.lastIndex = 0;
    var ssm;
    while ((ssm = PERSON_SPACED_SUFFIX_RE.exec(s)) !== null) {
      if (isLikelySpacedPersonName(ssm[1], false, 'suffix')) return true;
    }
    PERSON_SUFFIX_RE.lastIndex = 0;
    var sm;
    while ((sm = PERSON_SUFFIX_RE.exec(s)) !== null) {
      if (isLikelyKoreanPersonName(sm[1], false)) return true;
    }
    PERSON_SPACED_NARRATIVE_RE.lastIndex = 0;
    var snm;
    while ((snm = PERSON_SPACED_NARRATIVE_RE.exec(s)) !== null) {
      if (isLikelySpacedPersonName(snm[1], snm[2], 'narrative')) return true;
    }
    PERSON_NARRATIVE_RE.lastIndex = 0;
    var nm;
    while ((nm = PERSON_NARRATIVE_RE.exec(s)) !== null) {
      if (isLikelyNarrativePersonName(nm[1], nm[2])) return true;
    }
    INLINE_FILENAME_EXPR_RE.lastIndex = 0;
    var fm;
    while ((fm = INLINE_FILENAME_EXPR_RE.exec(s)) !== null) {
      if (hasStandaloneNameInLabel(fm[0])) return true;
    }
    return false;
  }

  /* ══ 2. 사업장 메일 프로필 · 스캔 · 서류 분류 ═════════════════════════ */
  function buildCompanyMailProfile(project, companies, consultings) {
    var p = project || {};
    var coList = rowsOf(companies);
    var consList = rowsOf(consultings);
    var coId = str(p.companyId);
    var bizDigits = str(p.bizNo).replace(/\D/g, '');
    var addrs = {}, domains = {};

    /* 다수 사업장에 중복 등록된 공유 이메일·도메인은 오매칭 방지를 위해 자동 귀속에서 제외 */
    var emailOwners = {}, domOwners = {};
    function noteOwner(ownerKey, addrObj) {
      if (!ownerKey) return;
      Object.keys(addrObj || {}).forEach(function (em) {
        if (!em || OWN_MAIL_RE.test(em)) return;
        if (!emailOwners[em]) emailOwners[em] = {};
        emailOwners[em][ownerKey] = 1;
        var dom = domainOf(em);
        if (dom && !PUBLIC_DOMAINS[dom]) {
          if (!domOwners[dom]) domOwners[dom] = {};
          domOwners[dom][ownerKey] = 1;
        }
      });
    }
    coList.forEach(function (c) {
      var cid = str(c.id);
      if (cid) noteOwner(cid, collectAddrsFromObj(c));
    });
    consList.forEach(function (cs) {
      var csCoId = str(cs.companyId || (cs.company && cs.company.id));
      var csId = str(cs.id);
      var ok = csCoId || (csId ? ('cons_' + csId.replace(/[.#$/\[\]\s]+/g, '_')) : '');
      if (!ok) return;
      noteOwner(ok, collectAddrsFromObj(cs));
      if (cs.company) noteOwner(ok, collectAddrsFromObj(cs.company));
    });

    function addAllowed(em) {
      if (!em || OWN_MAIL_RE.test(em)) return;
      var eOwners = emailOwners[em] ? Object.keys(emailOwners[em]) : [];
      if (eOwners.length > 1) return;
      if (coId && eOwners.length === 1 && eOwners[0] !== coId) return;
      addrs[em] = 1;
      var dom = domainOf(em);
      if (dom && !PUBLIC_DOMAINS[dom]) {
        var dOwners = domOwners[dom] ? Object.keys(domOwners[dom]) : [];
        if (dOwners.length <= 1 && (!coId || dOwners.length === 0 || dOwners[0] === coId)) {
          domains[dom] = 1;
        }
      }
    }

    coList.forEach(function (c) {
      var match = (coId && str(c.id) === coId) || (!coId && bizDigits.length === 10 && str(c.bizNo).replace(/\D/g, '') === bizDigits);
      if (!match) return;
      Object.keys(collectAddrsFromObj(c)).forEach(addAllowed);
    });

    var projConsId = str(p.consultingId);
    consList.forEach(function (cs) {
      var csId = str(cs.id);
      var csSafeCoId = csId ? ('cons_' + csId.replace(/[.#$/\[\]\s]+/g, '_')) : '';
      var csCoId = str(cs.companyId || (cs.company && cs.company.id));
      var csBiz = str(cs.bizNo || (cs.company && cs.company.bizNo)).replace(/\D/g, '');
      var match = (coId && (csCoId === coId || csSafeCoId === coId))
        || (projConsId && csId === projConsId)
        || (bizDigits.length === 10 && csBiz === bizDigits);
      if (!match) return;
      Object.keys(collectAddrsFromObj(cs)).forEach(addAllowed);
      if (cs.company) Object.keys(collectAddrsFromObj(cs.company)).forEach(addAllowed);
    });

    (Array.isArray(p.contactEmails) ? p.contactEmails : str(p.contactEmail).split(/[,;\s]+/)).forEach(function (v) {
      addAllowed(mailOf(v));
    });

    return {
      companyId: coId,
      companyName: str(p.companyName),
      normName: normCorpName(p.companyName),
      addrs: addrs,
      domains: domains,
      hasAddr: Object.keys(addrs).length > 0 || Object.keys(domains).length > 0
    };
  }

  function collectAddrsFromObj(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    if (root && root.PuCoThread && typeof root.PuCoThread.addrsOf === 'function') {
      Object.keys(root.PuCoThread.addrsOf(obj)).forEach(function (e) { out[e] = 1; });
    }
    [obj.email, obj.primaryContactEmail, obj.taxEmail, obj.contactEmail, obj.managerEmail].forEach(function (v) {
      var e = mailOf(v);
      if (e) out[e] = 1;
    });
    (Array.isArray(obj.contacts) ? obj.contacts : []).forEach(function (c) {
      var e = mailOf(c && c.email);
      if (e) out[e] = 1;
    });
    return out;
  }

  /* 메일 제목·첨부파일명·시점으로 서류 종류(14종)와 단계(pre_mid | post_mid)를 판별 */
  var POST_SIGNAL_RE = /중간보고\s*(?:피드백|검토|이후|수정의견|보완)|최종\s*보고|결과\s*보고|완료\s*보고|최종\s*산출물|찬반\s*투표|과반수\s*동의|근로자\s*동의서|근로자대표\s*서면합의|시범\s*운영|시범\s*작성|활동비\s*정산|최종\s*평가|사후\s*교육|이행\s*결과|이행\s*관리|신구\s*대조/i;
  var ILTEO_SIGNAL_RE = /일터\s*혁신|일터\s*상생|상생\s*컨설팅|노사발전재단|디자인팀|개선과제|취업규칙|근로계약|임금대장|급여대장|근태|출퇴근|연차|노사협의회|조직진단|설문|중간보고|최종보고|결과보고|완료보고|수행보고|수행계획|컨설팅\s*보고서|타임스탬프|서명지|찬반투표/i;

  function classifyDocKind(subject, attNames, bodyPreview) {
    var headOnly = (str(subject) + ' ' + (Array.isArray(attNames) ? attNames.join(' ') : str(attNames))).toLowerCase();
    var hay = (headOnly + ' ' + str(bodyPreview)).toLowerCase();

    /* 피드백·검토의견·수정요청 메일은 보고서 원문이 아니라 후속 피드백(design_feedback)으로 우선 분류 */
    if (/중간보고\s*(?:피드백|검토의견|수정의견|수정요청|보완요청)/.test(headOnly)) {
      return Cat.getDocKind('design_feedback') || Cat.DOC_KINDS[0];
    }
    if (/최종\s*보고서|결과\s*보고서|완료\s*보고서|최종\s*결과\s*보고|최종\s*발표\s*자료/.test(headOnly)) {
      return Cat.getDocKind('final_report_doc') || Cat.DOC_KINDS[0];
    }
    if (/중간\s*보고서|중간\s*발표\s*자료|중간\s*보고\s*자료|현황\s*진단\s*보고서/.test(headOnly)) {
      return Cat.getDocKind('mid_report_doc') || Cat.DOC_KINDS[0];
    }

    var best = null, bestScore = 0;
    Cat.DOC_KINDS.forEach(function (dk) {
      var score = 0;
      (dk.keywords || []).forEach(function (kw) {
        var lk = kw.toLowerCase();
        if (headOnly.indexOf(lk) >= 0) score += lk.length >= 4 ? 4 : 3;
        else if (hay.indexOf(lk) >= 0) score += lk.length >= 4 ? 2 : 1;
      });
      if (score > bestScore) {
        bestScore = score;
        best = dk;
      }
    });
    if (!best) {
      var joinedAtts = (Array.isArray(attNames) ? attNames.join(' ') : '').toLowerCase();
      if (/\.(xlsx|xls|csv)\b/.test(joinedAtts)) best = Cat.getDocKind('org_roster');
      else if (/\.(pptx|ppt)\b/.test(joinedAtts)) {
        best = /최종|결과|완료/.test(headOnly) ? Cat.getDocKind('final_report_doc') : Cat.getDocKind('mid_report_doc');
      }
      else if (/\.(jpg|jpeg|png|webp)\b/.test(joinedAtts)) best = Cat.getDocKind('round_proof');
      else best = Cat.getDocKind('design_feedback');
    }
    return best;
  }

  function resolvePhase(ts, midConfirmedAt, docKindObj, subject, attNames) {
    if (docKindObj && docKindObj.code === 'final_report_doc') return 'post_mid';
    if (docKindObj && docKindObj.code === 'mid_report_doc') return 'pre_mid';
    var hay = str(subject) + ' ' + (Array.isArray(attNames) ? attNames.join(' ') : '');
    var midTs = Number(midConfirmedAt) || 0;
    if (midTs > 0 && Number(ts) > midTs) return 'post_mid';
    if (POST_SIGNAL_RE.test(hay)) return 'post_mid';
    if (midTs > 0 && Number(ts) > 0 && Number(ts) <= midTs) return 'pre_mid';
    return (docKindObj && docKindObj.defaultPhase) || 'pre_mid';
  }

  function mailDedupSig(dir, fromAddr, toList, ts, subject) {
    var peer = dir === 'out' ? (toList[0] || '') : fromAddr;
    var bucket = ts > 0 ? Math.floor(ts / 60000) : 0;
    var normSub = str(subject).replace(/\s+/g, '').toLowerCase().slice(0, 60);
    return dir + '|' + peer + '|' + bucket + '|' + normSub;
  }

  function flattenMailboxRows(folders, msgs, oldMsgs) {
    var out = [];
    var seenSig = {};
    if (folders && typeof folders === 'object' && msgs && typeof msgs === 'object') {
      Object.keys(folders).forEach(function (slug) {
        var f = folders[slug];
        if (!f || typeof f !== 'object' || f.nomsg || BOX_KINDS.indexOf(f.kind) < 0) return;
        var box = msgs[slug];
        if (!box || (typeof box !== 'object' && !Array.isArray(box))) return;
        var isSent = f.kind === 'sent';
        Object.keys(box).forEach(function (uid) {
          if (!/^[0-9]{1,12}$/.test(uid)) return;
          var r = box[uid];
          if (!r || typeof r !== 'object') return;
          var fromAddr = mailOf(r.e || r.from);
          var toList = str(r.t || r.to).split(/[,;]+/).map(mailOf).filter(Boolean);
          var ts = Number(r.d || r.at) || 0;
          var atts = Array.isArray(r.an) ? r.an.map(str).filter(Boolean) : [];
          var dir = isSent ? 'out' : 'in';
          var subj = str(r.s || r.subject);
          seenSig[mailDedupSig(dir, fromAddr, toList, ts, subj)] = 1;
          out.push({
            key: 'i:' + slug + ':' + uid,
            src: 'imap',
            slug: slug,
            uid: String(uid),
            dir: dir,
            from: fromAddr,
            fromLabel: str(r.f) || fromAddr,
            to: toList,
            toLabel: str(r.tn) || str(r.t),
            subject: subj,
            ts: ts,
            date: dayOf(ts),
            attCount: Number(r.a) || atts.length,
            attNames: atts
          });
        });
      });
    }

    /* POP3 지난 메일함(mailbox/old/msgs) 통합 병합 — IMAP에 이미 있는 동일 메일은 지문으로 중복 제거 */
    if (oldMsgs && typeof oldMsgs === 'object') {
      Object.keys(oldMsgs).forEach(function (popKey) {
        var r = oldMsgs[popKey];
        if (!r || typeof r !== 'object') return;
        var fromAddr = mailOf(r.e || r.from);
        var toList = str(r.t || r.to).split(/[,;]+/).map(mailOf).filter(Boolean);
        var ts = Number(r.d || r.at) || 0;
        var atts = Array.isArray(r.an) ? r.an.map(str).filter(Boolean) : [];
        var isSent = !!(fromAddr && OWN_MAIL_RE.test(fromAddr));
        var dir = isSent ? 'out' : 'in';
        var subj = str(r.s || r.subject);
        var sig = mailDedupSig(dir, fromAddr, toList, ts, subj);
        if (seenSig[sig]) return;
        seenSig[sig] = 1;
        out.push({
          key: 'o:' + popKey,
          src: 'pop3',
          popKey: String(popKey),
          dir: dir,
          from: fromAddr,
          fromLabel: str(r.f) || fromAddr,
          to: toList,
          toLabel: str(r.tn) || str(r.t),
          subject: subj,
          preview: str(r.p),
          ts: ts,
          date: dayOf(ts),
          attCount: Number(r.a) || atts.length,
          attNames: atts
        });
      });
    }

    out.sort(function (a, b) { return (b.ts - a.ts) || (a.key < b.key ? -1 : 1); });
    return out;
  }

  /* 사업장 메일 스캔:
   * - matched: 등록 주소·고유 기업도메인으로 확정 귀속된 메일
   * - nameCandidates: 주소는 미등록이나 제목에 상호(3자 이상) + 컨설팅 키워드가 있는 후보(자동 귀속 안 함, 사람 확인용)
   */
  function scanProjectMails(project, folders, msgs, companies, consultings, intakeMap) {
    var prof = buildCompanyMailProfile(project, companies, consultings);
    var flat = Array.isArray(folders) ? folders : flattenMailboxRows(folders, msgs);
    var midTs = Number(project && project.midConfirmedAt) || 0;
    var existingByMailKey = {};
    Object.keys(intakeMap || {}).forEach(function (id) {
      var rec = intakeMap[id];
      if (!rec || rec._deleted) return;
      if (rec.mailKey) existingByMailKey[rec.mailKey] = rec;
    });

    var matched = [], nameCandidates = [], seenKeys = {};
    flat.forEach(function (m) {
      if (!m || seenKeys[m.key]) return;
      var peerAddrs = m.dir === 'out' ? m.to : [m.from];
      var addrHit = peerAddrs.some(function (em) {
        if (!em) return false;
        if (prof.addrs[em]) return true;
        var dom = domainOf(em);
        return !!(dom && prof.domains[dom]);
      });

      var dk = classifyDocKind(m.subject, m.attNames, '');
      var phase = resolvePhase(m.ts, midTs, dk, m.subject, m.attNames);
      var linkedRec = existingByMailKey[m.key] || null;
      var checked = !!(linkedRec && linkedRec.checkedAt);

      if (addrHit) {
        seenKeys[m.key] = 1;
        matched.push(Object.assign({}, m, {
          matchKind: 'addr',
          docKind: dk.code,
          docKindName: dk.short,
          track: dk.track,
          phase: linkedRec && linkedRec.phase ? linkedRec.phase : phase,
          intakeId: linkedRec ? linkedRec.id : '',
          checked: checked,
          analyzed: !!(linkedRec && linkedRec.analyzedAt)
        }));
        return;
      }

      if (prof.normName.length >= 3) {
        var normSubj = normCorpName(m.subject + ' ' + m.attNames.join(' '));
        if (normSubj.indexOf(prof.normName) >= 0 && ILTEO_SIGNAL_RE.test(m.subject + ' ' + m.attNames.join(' '))) {
          seenKeys[m.key] = 1;
          nameCandidates.push(Object.assign({}, m, {
            matchKind: 'name_candidate',
            docKind: dk.code,
            docKindName: dk.short,
            track: dk.track,
            phase: phase,
            intakeId: linkedRec ? linkedRec.id : '',
            checked: checked,
            analyzed: !!(linkedRec && linkedRec.analyzedAt)
          }));
        }
      }
    });

    var unseenPre = 0, unseenPost = 0;
    matched.forEach(function (m) {
      if (m.dir !== 'in' || m.checked) return;
      if (m.phase === 'post_mid') unseenPost++;
      else unseenPre++;
    });

    return {
      profile: prof,
      matched: matched,
      nameCandidates: nameCandidates,
      unseenPreCount: unseenPre,
      unseenPostCount: unseenPost,
      totalInCount: matched.filter(function (m) { return m.dir === 'in'; }).length
    };
  }

  function summarizeChecklistProgress(phase, selectedTasks, intakeMap, scannedMails, manualChecks) {
    var list = Cat.checklistFor(phase, selectedTasks);
    var manMap = (manualChecks && typeof manualChecks === 'object') ? manualChecks : {};
    var activeIntakes = Object.keys(intakeMap || {}).map(function (k) { return intakeMap[k]; })
      .filter(function (r) { return r && !r._deleted && (!r.phase || r.phase === phase); });
    var mailHits = (Array.isArray(scannedMails) ? scannedMails : []).filter(function (m) {
      return m.dir === 'in' && m.phase === phase;
    });

    var items = list.map(function (item) {
      var cards = activeIntakes.filter(function (r) { return r.docKind === item.docKind; });
      var mails = mailHits.filter(function (m) { return m.docKind === item.docKind; });
      var analyzedCount = cards.filter(function (r) { return !!r.analyzedAt; }).length;
      var manualDone = !!manMap[item.docKind];
      var status = analyzedCount > 0
        ? 'analyzed'
        : (manualDone ? 'manual' : (cards.length > 0 || mails.length > 0 ? 'received' : 'missing'));
      return Object.assign({}, item, {
        code: item.docKind,
        status: status,
        manualChecked: manualDone,
        cardCount: cards.length,
        mailCount: mails.length,
        analyzedCount: analyzedCount
      });
    });

    var reqItems = items.filter(function (x) { return x.required; });
    var doneReq = reqItems.filter(function (x) { return x.status !== 'missing'; }).length;
    var pct = reqItems.length ? Math.round((doneReq / reqItems.length) * 100) : 100;
    return {
      phase: phase,
      items: items,
      requiredTotal: reqItems.length,
      requiredDone: doneReq,
      pct: pct,
      missingRequired: reqItems.filter(function (x) { return x.status === 'missing'; })
    };
  }

  /* ══ 3. 트랙 A — 엑셀·표 로컬 비식별 통계 분석기 (원본 성명·주민번호 폐기) ═══ */
  function findHeaderRow(rows) {
    var limit = Math.min(rows.length, 12);
    var bestIdx = 0, bestNonEmpty = -1;
    for (var i = 0; i < limit; i++) {
      var r = Array.isArray(rows[i]) ? rows[i] : [];
      var cnt = r.filter(function (c) {
        var s = str(c);
        return s.length > 0 && isNaN(Number(s));
      }).length;
      if (cnt > bestNonEmpty) { bestNonEmpty = cnt; bestIdx = i; }
    }
    return bestIdx;
  }

  function colIndexByRe(headers, re) {
    for (var i = 0; i < headers.length; i++) {
      if (re.test(headers[i])) return i;
    }
    return -1;
  }

  function extractAllSheetHeaders(sheetMap) {
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    var parts = [];
    Object.keys(sheets).forEach(function (sn) {
      var rows = sheets[sn];
      if (!Array.isArray(rows) || !rows.length) return;
      var hIdx = findHeaderRow(rows);
      var hdr = (rows[hIdx] || []).map(function (c) { return str(c).replace(/\s+/g, ''); }).filter(Boolean);
      var earlyLabels = rows.slice(0, Math.min(rows.length, 10)).map(function (r) {
        return Array.isArray(r) ? (str(r[0]) + ' ' + str(r[1])).replace(/\s+/g, '') : '';
      }).filter(Boolean);
      parts.push(sn + ' ' + hdr.join(' ') + ' ' + earlyLabels.join(' '));
    });
    return parts.join(' ');
  }

  /* 시트 열 머리글에 성명·주민번호·임금·연락처 등 민감 인사·급여 열이 있는지 판별 — 해당 시 원시 셀 발췌(excelTextFallback) 절대 차단 */
  function hasSensitiveTableHeaders(sheetMap) {
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    return Object.keys(sheets).some(function (sn) {
      var rows = sheets[sn];
      if (!Array.isArray(rows) || !rows.length) return false;
      var hIdx = findHeaderRow(rows);
      var hdr = (rows[hIdx] || []).map(function (c) { return str(c).replace(/\s+/g, ''); }).join('|');
      return /성명|이름|사원명|근로자명|주민등록번호|주민번호|생년월일|계좌번호|연락처|전화번호|휴대폰|기본급|본봉|월기본급|임금총액|급여합계|지급총액|월급여액/.test(hdr);
    });
  }

  /* 엑셀 시트명·열 머리글·파일명 기반 서류 종류 정밀 판별 */
  function detectSheetDocKind(allRows, fileName) {
    var hdrBlob = allRows.map(function (s) {
      var hIdx = findHeaderRow(s.rows);
      var hdr = (s.rows[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); }).join(' ');
      var sample = s.rows.slice(0, Math.min(s.rows.length, 10)).map(function (r) {
        return Array.isArray(r) ? (str(r[0]) + ' ' + str(r[1])) : '';
      }).join(' ');
      return s.name + ' ' + hdr + ' ' + sample;
    }).join(' ');

    if (/기본급|본봉|월기본급|임금총액|급여합계|지급총액|고정연장|포괄연장|시간외수당/.test(hdrBlob)) return 'wage_ledger';
    if (/주근로|주당근로|주실근로|실근로시간|연장근로|연장시간|초과근로|퇴근시각|발생연차|사용연차|소진연차/.test(hdrBlob)) return 'time_leave';
    if (/응답인원|참여인원|문항명|조직진단|\beos\b|준거집단|리더십.*보상/i.test(hdrBlob)) return 'eos_survey';
    if ((/부서|팀|소속|본부|직군/.test(hdrBlob) && /입사일|입사연월|채용일|퇴사일|고용형태|계약형태|연령|나이|재직상태/.test(hdrBlob))
        || (/사번/.test(hdrBlob) && /부서|입사일|고용형태|재직/.test(hdrBlob))) {
      return 'org_roster';
    }
    if (/찬성|반대|기권|찬반투표|투표집계|동의율|찬성률/.test(hdrBlob)) return 'worker_consent';

    /* 파일명 키워드 매칭 (.xlsx 확장자 기본 폴백은 배제하고 실제 키워드 점수만 확인) */
    var fn = str(fileName).toLowerCase();
    if (fn) {
      var best = null, bestScore = 0;
      Cat.DOC_KINDS.forEach(function (dk) {
        var sc = 0;
        (dk.keywords || []).forEach(function (kw) {
          if (fn.indexOf(kw.toLowerCase()) >= 0) sc += kw.length >= 4 ? 3 : 2;
        });
        if (sc > bestScore) { bestScore = sc; best = dk; }
      });
      if (best) return best.code;
    }
    return '';
  }

  /* 정량 엑셀의 부서·자유문자 셀에 이메일·연락처·인명 등이 오입력된 경우 통계·요약에 복사되지 않도록 가림 후 안전 기본값으로 귀속 */
  function sanitizeQuantDeptLabel(rawDept, fallback, names) {
    var fb = str(fallback) || '기타·공통';
    var raw = str(rawDept).slice(0, 32);
    if (!raw) return fb;
    var m = maskPiiStrict(raw, names || []).text;
    m = maskStandaloneNamesInLabel(m);
    if (!m || m.indexOf(GARIM) >= 0 || m.indexOf('[대표자]') >= 0 || m.indexOf('[담당자]') >= 0) {
      return fb;
    }
    if (hasResidualPii(m) || hasIndependentPersonAuditLeak(m) || hasStandaloneNameInLabel(m)) {
      return fb;
    }
    return m.slice(0, 24) || fb;
  }

  function hasQuantValuePiiLeak(val) {
    if (typeof val === 'string') {
      return !!(val && (hasResidualPii(val) || hasIndependentPersonAuditLeak(val)));
    }
    if (Array.isArray(val)) {
      for (var i = 0; i < val.length; i++) {
        if (hasQuantValuePiiLeak(val[i])) return true;
      }
      return false;
    }
    if (val && typeof val === 'object') {
      var keys = Object.keys(val);
      for (var k = 0; k < keys.length; k++) {
        if (hasQuantValuePiiLeak(val[keys[k]])) return true;
      }
      return false;
    }
    return false;
  }

  function finalizeQuantResult(res) {
    if (!res || !res.ok) return res;
    if (hasQuantValuePiiLeak(res.stats) || hasQuantValuePiiLeak(res.summaryLines)) {
      return {
        ok: false,
        leakBlocked: true,
        nonQuant: false,
        error: '정량 통계 자유문자 항목에 민감 식별정보 패턴이 잔존하여 결과를 차단했습니다.'
      };
    }
    return res;
  }

  /* 브라우저(pu-ilteo-view) 및 백필(backfill-ilteo-history) 호출부에서 정량 자유문자 전체에 kordoc 1차 가림 + 독립 감사를 강제 적용하는 관문 */
  async function auditQuantResultAsync(tabRes, opts) {
    if (!tabRes || !tabRes.ok) return tabRes;
    opts = opts || {};
    if (typeof opts.redactFn !== 'function') {
      throw new Error('KORDOC_UNAVAILABLE');
    }
    var names = Array.isArray(opts.names) ? opts.names : [];
    var auditFn = typeof opts.auditFn === 'function'
      ? opts.auditFn
      : function (s) { return !hasResidualPii(s) && !hasIndependentPersonAuditLeak(s); };
    var blocked = false;

    async function cleanNode(val, isDeptField) {
      if (typeof val === 'string') {
        if (!val) return val;
        var pre = maskPiiStrict(val, names).text;
        var kd = await opts.redactFn(pre);
        var post = maskPiiStrict(kd, []).text;
        if (isDeptField) {
          post = maskStandaloneNamesInLabel(post);
          if (!post || post.indexOf(GARIM) >= 0 || hasStandaloneNameInLabel(post)) {
            blocked = true;
            return GARIM;
          }
        }
        if (!auditFn(post) || hasResidualPii(post) || hasIndependentPersonAuditLeak(post)) {
          blocked = true;
          return GARIM;
        }
        return post;
      }
      if (Array.isArray(val)) {
        var arr = [];
        for (var i = 0; i < val.length; i++) {
          arr.push(await cleanNode(val[i], isDeptField));
        }
        return arr;
      }
      if (val && typeof val === 'object') {
        var out = {};
        var ks = Object.keys(val);
        for (var k = 0; k < ks.length; k++) {
          var key = ks[k];
          out[key] = await cleanNode(val[key], key === 'dept' || key === 'topLateDepts');
        }
        return out;
      }
      return val;
    }

    var nextStats = await cleanNode(tabRes.stats || null, false);
    var nextSummary = await cleanNode(tabRes.summaryLines || [], false);
    if (blocked) {
      return {
        ok: false,
        leakBlocked: true,
        nonQuant: false,
        error: '정량 통계의 자유문자 항목이 개인정보 독립 감사를 통과하지 못해 저장을 차단했습니다.'
      };
    }
    return Object.assign({}, tabRes, {
      stats: nextStats,
      summaryLines: nextSummary
    });
  }

  function analyzeTabularRows(sheetMap, docKind, opts) {
    opts = opts || {};
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    var names = Object.keys(sheets);
    if (!names.length) return { ok: false, error: '시트 데이터가 비어 있습니다' };

    var allRows = [];
    names.forEach(function (sn) {
      var r = sheets[sn];
      if (Array.isArray(r) && r.length) allRows.push({ name: sn, rows: r });
    });
    if (!allRows.length) return { ok: false, error: '읽을 수 있는 행이 없습니다' };

    var kind = str(docKind) || detectSheetDocKind(allRows, opts.fileName || '');

    if (kind === 'org_roster') return finalizeQuantResult(analyzeRosterSheet(allRows, opts));
    if (kind === 'time_leave') return finalizeQuantResult(analyzeTimeLeaveSheet(allRows, opts));
    if (kind === 'wage_ledger') return finalizeQuantResult(analyzeWageSheet(allRows, opts));
    if (kind === 'eos_survey') return finalizeQuantResult(analyzeEosSheet(allRows, opts));

    /* 민감 인사·급여 열이 감지되면 절대 nonQuant(평문 발췌)로 흘려보내지 않고 필수열 확인 오류를 반환 */
    if (hasSensitiveTableHeaders(sheetMap)) {
      return {
        ok: false,
        nonQuant: false,
        error: '민감 인사·임금 열이 포함되어 있으나 정량 서류 종류(인력·근태·임금·EOS) 필수 열 구성이 불완전합니다. 서류 종류와 열 머리글을 확인해 주세요.'
      };
    }

    return {
      ok: false,
      nonQuant: true,
      docKind: kind || 'design_feedback',
      error: '정량 통계 4종(인력명부·근태연차·임금대장·조직진단) 외의 서류입니다.'
    };
  }

  /* ① 인력현황 · 3개년 입퇴사 비식별 통계 */
  function analyzeRosterSheet(allSheets, opts) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var deptCol = colIndexByRe(headers, /부서|팀|소속|직군|본부/);
    var rankCol = colIndexByRe(headers, /직급|직위|직책/);
    var empTypeCol = colIndexByRe(headers, /고용형태|직종|계약형태|고용구분/);
    var genderCol = colIndexByRe(headers, /성별|남녀/);
    var ageCol = colIndexByRe(headers, /연령|나이|출생|생년/);
    var hireCol = colIndexByRe(headers, /입사일|입사연월|채용일/);
    var leaveCol = colIndexByRe(headers, /퇴사일|퇴직일/);
    var statusCol = colIndexByRe(headers, /재직상태|재직구분|재직여부|^재직$|^상태$/);

    if (deptCol < 0 && empTypeCol < 0 && hireCol < 0 && ageCol < 0 && leaveCol < 0 && statusCol < 0) {
      return { ok: false, error: '인력명부 필수 열(부서·고용형태·입사일·연령·재직상태 등)을 찾지 못했습니다.' };
    }

    var curYear = Number(opts.baseYear) || 2026;
    var activeCount = 0, regularCount = 0, nonRegularCount = 0, maleCount = 0, femaleCount = 0;
    var byDept = {}, byAge = { '20대 이하': 0, '30대': 0, '40대': 0, '50대': 0, '60대 이상': 0 };
    var byTenure = { '1년 미만': 0, '1~3년': 0, '3~5년': 0, '5~10년': 0, '10년 이상': 0 };
    var yearly = {};
    [curYear - 2, curYear - 1, curYear].forEach(function (y) { yearly[y] = { hires: 0, leaves: 0 }; });

    for (var i = hIdx + 1; i < main.length; i++) {
      var row = main[i];
      if (!Array.isArray(row) || row.every(function (c) { return !str(c); })) continue;
      var firstTxt = str(row[0]);
      if (/합계|총계|소계|평균/.test(firstTxt)) continue;

      var leaveStr = leaveCol >= 0 ? str(row[leaveCol]) : '';
      var stStr = statusCol >= 0 ? str(row[statusCol]) : '';
      var hireStr = hireCol >= 0 ? str(row[hireCol]) : '';
      var hireY = extractYear(hireStr);
      var leaveY = extractYear(leaveStr);
      if (hireY && yearly[hireY]) yearly[hireY].hires++;
      if (leaveY && yearly[leaveY]) yearly[leaveY].leaves++;

      var isRetired = /퇴사|퇴직/.test(stStr) || (!!leaveStr && !/재직/.test(stStr));
      if (isRetired) continue;

      activeCount++;
      var dept = deptCol >= 0 && str(row[deptCol]) ? sanitizeQuantDeptLabel(row[deptCol], '기타·공통', opts.names) : '기타·공통';
      byDept[dept] = (byDept[dept] || 0) + 1;

      var et = empTypeCol >= 0 ? str(row[empTypeCol]) : '정규직';
      if (/계약|촉탁|기간제|단시간|파견|아르바이트|일용/.test(et)) nonRegularCount++;
      else regularCount++;

      var gd = genderCol >= 0 ? str(row[genderCol]) : '';
      if (/^(남|남성|m|male)$/i.test(gd)) maleCount++;
      else if (/^(여|여성|f|female)$/i.test(gd)) femaleCount++;

      if (ageCol >= 0) {
        var ageVal = parseAge(row[ageCol], curYear);
        if (ageVal > 0) {
          if (ageVal < 30) byAge['20대 이하']++;
          else if (ageVal < 40) byAge['30대']++;
          else if (ageVal < 50) byAge['40대']++;
          else if (ageVal < 60) byAge['50대']++;
          else byAge['60대 이상']++;
        }
      }

      if (hireY > 1970 && hireY <= curYear) {
        var yrs = Math.max(0, curYear - hireY);
        if (yrs < 1) byTenure['1년 미만']++;
        else if (yrs < 3) byTenure['1~3년']++;
        else if (yrs < 5) byTenure['3~5년']++;
        else if (yrs < 10) byTenure['5~10년']++;
        else byTenure['10년 이상']++;
      }
    }

    var totalLeavesAll = Object.keys(yearly).reduce(function (a, k) { return a + yearly[k].leaves; }, 0);
    if (!activeCount && !totalLeavesAll) {
      return { ok: false, error: '인력명부에서 집계 가능한 재직·퇴사 행을 찾지 못했습니다.' };
    }

    var topDepts = Object.keys(byDept).sort(function (a, b) { return byDept[b] - byDept[a]; }).slice(0, 6)
      .map(function (d) { return { dept: d, count: byDept[d], pct: activeCount ? round1((byDept[d] / activeCount) * 100) : 0 }; });

    var turnover3Y = Object.keys(yearly).sort().map(function (yk) {
      var y = yearly[yk];
      var denom = Math.max(activeCount, 1);
      return { year: Number(yk), hires: y.hires, leaves: y.leaves, leaveRatePct: round1((y.leaves / denom) * 100) };
    });

    var nonRegPct = activeCount ? round1((nonRegularCount / activeCount) * 100) : 0;
    var shortTenurePct = activeCount ? round1(((byTenure['1년 미만'] + byTenure['1~3년']) / activeCount) * 100) : 0;
    var summaryLines = [
      '재직 인원 총 ' + activeCount + '명 (정규직 ' + regularCount + '명 · 기간제/촉탁 등 ' + nonRegularCount + '명, 비정규 비중 ' + nonRegPct + '%)',
      '주요 부서 구성: ' + (topDepts.map(function (x) { return x.dept + ' ' + x.count + '명(' + x.pct + '%)'; }).join(', ') || '집계 없음'),
      '단기근속(3년 미만) 비중 ' + shortTenurePct + '% · 최근 연도 입사 ' + (yearly[curYear] ? yearly[curYear].hires : 0) + '명 / 퇴사 ' + (yearly[curYear] ? yearly[curYear].leaves : 0) + '명'
    ];
    if (activeCount > 0 && activeCount < Cat.CRITERIA.activityGrantMaxWorkers + 1) {
      summaryLines.push('상시근로자 100인 미만 사업장 해당 → 일터혁신 활동비(최대 120만원) 신청 대상 확인');
    }

    return {
      ok: true,
      docKind: 'org_roster',
      track: 'quant',
      piiStripped: true,
      stats: {
        activeCount: activeCount,
        regularCount: regularCount,
        nonRegularCount: nonRegularCount,
        nonRegularPct: nonRegPct,
        maleCount: maleCount,
        femaleCount: femaleCount,
        topDepts: topDepts,
        byAge: byAge,
        byTenure: byTenure,
        shortTenurePct: shortTenurePct,
        turnover3Y: turnover3Y,
        activityGrantEligible: activeCount > 0 && activeCount < 100
      },
      summaryLines: summaryLines
    };
  }

  /* ② 근태·출퇴근·연차 비식별 통계 */
  function analyzeTimeLeaveSheet(allSheets, opts) {
    opts = opts || {};
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var deptCol = colIndexByRe(headers, /부서|팀|소속|직군/);
    var weekHrCol = colIndexByRe(headers, /주근로|주당근로|주실근로|실근로시간|총근로시간|근무시간/);
    var otCol = colIndexByRe(headers, /연장근로|연장시간|초과근로|초과시간|ot시간/i);
    var holCol = colIndexByRe(headers, /휴일근로|휴일시간|특근시간/);
    var outTimeCol = colIndexByRe(headers, /퇴근시각|퇴근시간|종료시각/);
    var lvGrantCol = colIndexByRe(headers, /발생연차|부여연차|총연차|연차발생/);
    var lvUsedCol = colIndexByRe(headers, /사용연차|연차사용|소진연차/);

    if (weekHrCol < 0 && otCol < 0 && outTimeCol < 0 && lvGrantCol < 0) {
      return { ok: false, error: '근태·연차 시트에서 필수 열(주근로시간·연장시간·퇴근시각·발생연차 등)을 찾지 못했습니다.' };
    }

    var n = 0, sumWeekHr = 0, weekCnt = 0, over40 = 0, over48 = 0, over52 = 0;
    var sumOt = 0, sumHol = 0, lateOutCnt = 0, outTimeTotal = 0;
    var sumGrant = 0, sumUsed = 0, lateByDept = {};

    for (var i = hIdx + 1; i < main.length; i++) {
      var row = main[i];
      if (!Array.isArray(row) || row.every(function (c) { return !str(c); })) continue;
      if (/합계|총계|평균/.test(str(row[0]))) continue;
      n++;
      var dept = deptCol >= 0 && str(row[deptCol]) ? sanitizeQuantDeptLabel(row[deptCol], '공통', opts.names) : '공통';
      var wk = weekHrCol >= 0 ? num(row[weekHrCol]) : NaN;
      var ot = otCol >= 0 ? num(row[otCol]) : NaN;
      var hol = holCol >= 0 ? num(row[holCol]) : NaN;

      if (!isNaN(ot) && ot >= 0) sumOt += ot;
      if (!isNaN(hol) && hol >= 0) sumHol += hol;

      /* 월간 연장시간으로 적혀 있는 경우(예: 기본급 외 월 연장 25h) 주당 환산(÷4.345) 보정 */
      var estWeek = wk;
      if (isNaN(estWeek) && !isNaN(ot)) {
        estWeek = ot <= 20 ? (40 + ot + (isNaN(hol) ? 0 : hol)) : (40 + (ot + (isNaN(hol) ? 0 : hol)) / 4.345);
      } else if (!isNaN(estWeek) && estWeek > 95) {
        estWeek = estWeek / 4.345;
      }

      if (!isNaN(estWeek) && estWeek > 0) {
        sumWeekHr += estWeek;
        weekCnt++;
        if (estWeek > 40) over40++;
        if (estWeek >= 48) over48++;
        if (estWeek > 52) over52++;
      }

      if (outTimeCol >= 0 && str(row[outTimeCol])) {
        var hh = parseClockHour(row[outTimeCol]);
        if (hh >= 0) {
          outTimeTotal++;
          if (hh >= 19 || hh < 5) {
            lateOutCnt++;
            lateByDept[dept] = (lateByDept[dept] || 0) + 1;
          }
        }
      }

      if (lvGrantCol >= 0 && lvUsedCol >= 0) {
        var g = num(row[lvGrantCol]), u = num(row[lvUsedCol]);
        if (!isNaN(g) && g > 0) {
          sumGrant += g;
          sumUsed += isNaN(u) ? 0 : u;
        }
      }
    }

    if (!weekCnt && !outTimeTotal && !(sumGrant > 0)) {
      return { ok: false, error: '근태·연차 시트에서 유효한 근로시간·퇴근시각·연차 수치를 찾지 못했습니다.' };
    }

    var avgWeekHr = weekCnt ? round1(sumWeekHr / weekCnt) : 0;
    var over40Pct = weekCnt ? round1((over40 / weekCnt) * 100) : 0;
    var lateOutPct = outTimeTotal ? round1((lateOutCnt / outTimeTotal) * 100) : 0;
    var leaveUsePct = sumGrant > 0 ? round1((sumUsed / sumGrant) * 100) : 0;
    var totalExtra = sumOt + sumHol;
    var weekdayOtSharePct = totalExtra > 0 ? round1((sumOt / totalExtra) * 100) : 0;
    var topLateDepts = Object.keys(lateByDept).sort(function (a, b) { return lateByDept[b] - lateByDept[a]; }).slice(0, 3);

    var summaryLines = [
      '근태 레코드 ' + n + '건 비식별 집계 · 주 평균 실근로시간 ' + avgWeekHr + '시간 (주 40h 초과율 ' + over40Pct + '%)',
      '주 48h 이상 장시간 구간 ' + over48 + '건 · 주 52h 법정한도 초과 위험 ' + over52 + '건',
      '19시 이후 퇴근 비율 ' + lateOutPct + '%' + (topLateDepts.length ? ' (집중 부서: ' + topLateDepts.join(', ') + ')' : '')
        + (totalExtra > 0 ? ' · 평일 연장 비중 ' + weekdayOtSharePct + '%' : ''),
      sumGrant > 0 ? ('연차유급휴가 평균 소진율 ' + leaveUsePct + '% (발생합계 ' + round1(sumGrant) + '일 중 ' + round1(sumUsed) + '일 사용)') : '연차대장 수치 미포함 (별도 확인 권장)'
    ];

    return {
      ok: true,
      docKind: 'time_leave',
      track: 'quant',
      piiStripped: true,
      stats: {
        recordCount: n,
        avgWeekHours: avgWeekHr,
        over40Pct: over40Pct,
        over48Count: over48,
        over52Count: over52,
        lateOutPct: lateOutPct,
        topLateDepts: topLateDepts,
        weekdayOtSharePct: weekdayOtSharePct,
        leaveUsePct: leaveUsePct
      },
      summaryLines: summaryLines
    };
  }

  /* ③ 임금대장 · 통상시급 · 주4.5일제(근로시간 단축) 모의계산 통계 */
  function analyzeWageSheet(allSheets) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var baseCol = colIndexByRe(headers, /기본급|본봉|월기본급/);
    var fixOtCol = colIndexByRe(headers, /고정연장|포괄연장|고정ot|연장수당|시간외수당|초과수당/i);
    var allowCol = colIndexByRe(headers, /직책수당|직무수당|자격수당|근속수당|식대|기타수당|제수당/);
    var totalCol = colIndexByRe(headers, /지급총액|급여합계|임금총액|월급여액|총지급액|합계/);

    var count = 0, sumBase = 0, sumFixOt = 0, sumAllow = 0, sumTotal = 0;
    var hourlyList = [], fixedOtWorkerCount = 0;

    for (var i = hIdx + 1; i < main.length; i++) {
      var row = main[i];
      if (!Array.isArray(row) || row.every(function (c) { return !str(c); })) continue;
      if (/합계|총계|평균|소계/.test(str(row[0]))) continue;
      var b = baseCol >= 0 ? num(row[baseCol]) : NaN;
      if (isNaN(b) || b <= 0) continue;
      var fo = fixOtCol >= 0 ? (num(row[fixOtCol]) || 0) : 0;
      var al = allowCol >= 0 ? (num(row[allowCol]) || 0) : 0;
      var tot = totalCol >= 0 ? num(row[totalCol]) : NaN;
      if (isNaN(tot) || tot < b) tot = b + fo + al;

      count++;
      sumBase += b;
      sumFixOt += fo;
      sumAllow += Math.max(0, tot - b - fo);
      sumTotal += tot;
      if (fo > 0) fixedOtWorkerCount++;

      var ordinaryMonthly = b + (al > 0 ? al : 0);
      hourlyList.push(ordinaryMonthly / 209);
    }

    if (!count) {
      return { ok: false, error: '임금대장에서 기본급 숫자 열을 찾지 못했습니다(열 머리글 확인 필요)' };
    }

    var avgTotal = Math.round(sumTotal / count);
    var avgBase = Math.round(sumBase / count);
    var avgFixOt = Math.round(sumFixOt / count);
    var baseSharePct = sumTotal > 0 ? round1((sumBase / sumTotal) * 100) : 0;
    var fixOtSharePct = sumTotal > 0 ? round1((sumFixOt / sumTotal) * 100) : 0;
    var allowSharePct = round1(Math.max(0, 100 - baseSharePct - fixOtSharePct));

    hourlyList.sort(function (a, b) { return a - b; });
    var avgHourly209 = Math.round(hourlyList.reduce(function (a, x) { return a + x; }, 0) / hourlyList.length);
    var minHourly209 = Math.round(hourlyList[0]);
    var maxHourly209 = Math.round(hourlyList[hourlyList.length - 1]);

    /* 주4.5일제 / 근로시간 단축 모의계산 (임금 총액 보전 시 월 통상임금 산정기준시간 209h → 191h(주36h) / 188h(주35h)) */
    var avgOrdBase = Math.round((sumBase + sumAllow) / count);
    var hourly191 = Math.round(avgOrdBase / 191);
    var hourly188 = Math.round(avgOrdBase / 188);
    var risePct191 = avgHourly209 > 0 ? round1(((hourly191 - avgHourly209) / avgHourly209) * 100) : 0;
    var risePct188 = avgHourly209 > 0 ? round1(((hourly188 - avgHourly209) / avgHourly209) * 100) : 0;

    var summaryLines = [
      '임금대장 ' + count + '명 비식별 구조 분석 · 월 평균 임금총액 ' + avgTotal.toLocaleString('ko-KR') + '원 (기본급 비중 ' + baseSharePct + '% · 고정연장수당 비중 ' + fixOtSharePct + '% · 제수당 ' + allowSharePct + '%)',
      '고정연장(포괄OT) 수당 적용 인원 ' + fixedOtWorkerCount + '명 (' + round1((fixedOtWorkerCount / count) * 100) + '%) · 209h 기준 평균 통상시급 ' + avgHourly209.toLocaleString('ko-KR') + '원 (범위 ' + minHourly209.toLocaleString('ko-KR') + '~' + maxHourly209.toLocaleString('ko-KR') + '원)',
      '모의계산(임금 보전): 주36h(191h) 단축 시 평균 통상시급 ' + hourly191.toLocaleString('ko-KR') + '원(+' + risePct191 + '%), 주35h(188h) 단축 시 ' + hourly188.toLocaleString('ko-KR') + '원(+' + risePct188 + '%)'
    ];

    return {
      ok: true,
      docKind: 'wage_ledger',
      track: 'quant',
      piiStripped: true,
      stats: {
        workerCount: count,
        avgMonthlyTotal: avgTotal,
        avgMonthlyBase: avgBase,
        avgMonthlyFixedOt: avgFixOt,
        baseSharePct: baseSharePct,
        fixOtSharePct: fixOtSharePct,
        allowSharePct: allowSharePct,
        fixedOtWorkerCount: fixedOtWorkerCount,
        avgHourly209: avgHourly209,
        minHourly209: minHourly209,
        maxHourly209: maxHourly209,
        sim36h: { stdHours: 191, avgHourly: hourly191, risePct: risePct191 },
        sim35h: { stdHours: 188, avgHourly: hourly188, risePct: risePct188 }
      },
      summaryLines: summaryLines
    };
  }

  /* ④ 전직원 조직진단(EOS) 설문 비식별 집계 및 준거집단 격차 분석 */
  function analyzeEosSheet(allSheets, opts) {
    var main = allSheets[0].rows;
    var levelInfo = Cat.getLevel(opts && opts.level);
    var targetWorkers = Number(opts && opts.totalWorkers) || 0;
    var itemScores = {};
    var respondentCount = 0;

    /* 형태 1: 항목명 | 점수 형태의 요약 시트인지 먼저 탐지 */
    var matchedSummaryItems = 0;
    for (var r = 0; r < main.length; r++) {
      var row = main[r];
      if (!Array.isArray(row) || row.length < 2) continue;
      var label = str(row[0]) + ' ' + str(row[1]);
      var respMatch = /응답\s*인원|참여\s*인원|응답자\s*수/.exec(label);
      if (respMatch) {
        for (var ci = 1; ci < row.length; ci++) {
          var rv = num(row[ci]);
          if (!isNaN(rv) && rv > 0) { respondentCount = Math.round(rv); break; }
        }
      }
      Cat.EOS_AREAS.forEach(function (area) {
        area.items.forEach(function (it) {
          var keyWords = it.name.split(/[·\s()]+/).filter(function (w) { return w.length >= 2; });
          var hit = label.indexOf(it.code) >= 0 || keyWords.filter(function (w) { return label.indexOf(w) >= 0; }).length >= 2;
          if (!hit) return;
          for (var c = 1; c < row.length; c++) {
            var v = num(row[c]);
            if (!isNaN(v) && v > 0 && v <= 100) {
              itemScores[it.code] = v > 5 ? round2(v / 20) : round2(v);
              matchedSummaryItems++;
              break;
            }
          }
        });
      });
    }

    /* 형태 2: 응답자별 원자료(1행 헤더 + 행마다 응답자 1명, 열마다 문항 점수 1~5) */
    if (matchedSummaryItems < 4 && main.length >= 2) {
      var hIdx = findHeaderRow(main);
      var headers = (main[hIdx] || []).map(str);
      var sums = {}, cnts = {};
      var validResp = 0;
      for (var i = hIdx + 1; i < main.length; i++) {
        var rRow = main[i];
        if (!Array.isArray(rRow)) continue;
        var numericCols = [];
        for (var col = 0; col < rRow.length; col++) {
          var sc = num(rRow[col]);
          if (!isNaN(sc) && sc >= 1 && sc <= 5) numericCols.push({ col: col, val: sc });
          else if (!isNaN(sc) && sc > 5 && sc <= 100 && /점수|문항|q\d|eos/i.test(headers[col] || '')) {
            numericCols.push({ col: col, val: sc / 20 });
          }
        }
        if (numericCols.length >= 3) {
          validResp++;
          numericCols.forEach(function (nc, idx) {
            var mappedCode = mapHeaderToEosCode(headers[nc.col], idx);
            sums[mappedCode] = (sums[mappedCode] || 0) + nc.val;
            cnts[mappedCode] = (cnts[mappedCode] || 0) + 1;
          });
        }
      }
      if (validResp > 0) {
        respondentCount = validResp;
        Object.keys(sums).forEach(function (code) {
          itemScores[code] = round2(sums[code] / cnts[code]);
        });
      }
    }

    var areasOut = [], allItemGaps = [];
    Cat.EOS_AREAS.forEach(function (area) {
      var sub = [];
      area.items.forEach(function (it) {
        var sc = itemScores[it.code];
        if (typeof sc !== 'number' || isNaN(sc)) return;
        var gap = round2(sc - it.bench);
        var entry = { code: it.code, name: it.name, score: sc, bench: it.bench, gap: gap };
        sub.push(entry);
        allItemGaps.push(entry);
      });
      if (sub.length) {
        var areaAvg = round2(sub.reduce(function (a, x) { return a + x.score; }, 0) / sub.length);
        areasOut.push({
          code: area.code,
          name: area.name,
          score: areaAvg,
          bench: area.bench,
          gap: round2(areaAvg - area.bench),
          items: sub
        });
      }
    });

    if (!areasOut.length) {
      return { ok: false, error: '조직진단(EOS) 설문 시트에서 유효한 문항 점수(1~5점 또는 100점 환산)를 찾지 못했습니다.' };
    }

    allItemGaps.sort(function (a, b) { return a.gap - b.gap; });
    var weakest = allItemGaps.slice(0, 3);
    var totalAvg = areasOut.length
      ? round2(areasOut.reduce(function (a, x) { return a + x.score; }, 0) / areasOut.length)
      : 0;
    var responseRatePct = (targetWorkers > 0 && respondentCount > 0)
      ? round1((respondentCount / targetWorkers) * 100)
      : 0;
    var rateMet = responseRatePct > 0 ? responseRatePct >= levelInfo.eosMinPct : null;

    var summaryLines = [
      '전 근로자 EOS 조직진단 종합 평균 ' + (totalAvg ? totalAvg.toFixed(2) + '점 / 5.00점' : '점수 확인 필요')
        + (respondentCount ? ' · 응답 ' + respondentCount + '명' + (targetWorkers ? ' (응답률 ' + responseRatePct + '%, 기준 ' + levelInfo.eosMinPct + '% ' + (rateMet ? '충족 ✓' : '미달 ⚠') + ')' : '') : ''),
      weakest.length
        ? ('준거집단 대비 집중 개선 필요 항목: ' + weakest.map(function (w) {
          return w.name + '(' + w.score.toFixed(2) + '점, 격차 ' + (w.gap >= 0 ? '+' : '') + w.gap.toFixed(2) + ')';
        }).join(' · '))
        : '문항별 세부 점수 매핑 없음(원본 열 제목 확인)'
    ];

    return {
      ok: true,
      docKind: 'eos_survey',
      track: 'quant',
      piiStripped: true,
      stats: {
        respondentCount: respondentCount,
        targetWorkers: targetWorkers,
        responseRatePct: responseRatePct,
        requiredMinPct: levelInfo.eosMinPct,
        rateMet: rateMet,
        totalAvg: totalAvg,
        areas: areasOut,
        weakestItems: weakest
      },
      summaryLines: summaryLines
    };
  }

  function mapHeaderToEosCode(header, fallbackIdx) {
    var h = str(header);
    var allItems = [];
    Cat.EOS_AREAS.forEach(function (a) { a.items.forEach(function (it) { allItems.push(it); }); });
    for (var i = 0; i < allItems.length; i++) {
      var it = allItems[i];
      if (h.indexOf(it.code) >= 0 || h.indexOf(it.name) >= 0) return it.code;
      var words = it.name.split(/[·\s()]+/).filter(function (w) { return w.length >= 2; });
      if (words.some(function (w) { return h.indexOf(w) >= 0; })) return it.code;
    }
    return allItems[fallbackIdx % allItems.length].code;
  }

  function extractYear(s) {
    var m = /(19[7-9]\d|20[0-3]\d)/.exec(str(s));
    return m ? Number(m[1]) : 0;
  }

  function parseAge(val, curYear) {
    var n = num(val);
    if (!isNaN(n) && n >= 15 && n <= 85) return Math.round(n);
    var y = extractYear(val);
    if (y >= 1945 && y <= curYear - 15) return curYear - y;
    return 0;
  }

  function parseClockHour(val) {
    if (typeof val === 'number' && val > 0 && val < 1.5) {
      return Math.floor((val * 24) % 24);
    }
    var m = /(\d{1,2})\s*:\s*(\d{2})/.exec(str(val));
    return m ? Number(m[1]) : -1;
  }

  /* ══ 4. 트랙 B — 규정·계약·회의록·후속 메일 본문 가림 및 이슈/변경점(Diff) 추출 ══ */
  var POLICY_RULES = [
    {
      id: 'inclusive_wage', domain: 'wage', severity: 'high', title: '포괄임금·고정연장수당 약정 정비 필요',
      match: /포괄\s*임금|포괄\s*산정|고정\s*연장|고정\s*ot|연장근로수당을\s*포함/i,
      finding: '근로계약·규정상 포괄임금 또는 고정연장수당 문구가 확인됨 — 실근로시간 기록·정산 원칙 및 통상시급 산입범위 재검토 필요'
    },
    {
      id: 'worktime_flex', domain: 'worktime', severity: 'medium', title: '유연근무제·근로시간 단축 서면합의 조항 미비 점검',
      lackOf: /시차\s*출퇴근|선택적\s*근로시간|탄력적\s*근로시간|근로자\s*대표와의?\s*서면\s*합의/,
      onlyKinds: ['work_rules'],
      finding: '취업규칙 내 유연근무제(시차·선택·탄력근무) 세부 운영기준 및 근로자대표 서면합의 근거 조항 보완 필요'
    },
    {
      id: 'maternity_care', domain: 'culture', severity: 'medium', title: '일·가정양립 및 육아지원 최신 개정법 현행화 필요',
      lackOf: /육아기\s*근로시간\s*단축|가족\s*돌봄\s*휴가|배우자\s*출산\s*휴가/,
      onlyKinds: ['work_rules'],
      finding: '남녀고용평등법상 육아기 근로시간 단축·가족돌봄휴가·배우자 출산휴가 등 최신 개정 법정 기준의 취업규칙 명문화 필요'
    },
    {
      id: 'wage_payslip', domain: 'wage', severity: 'medium', title: '임금구성항목·계산방법 및 임금명세서 교부 기준 점검',
      lackOf: /임금\s*명세서|계산\s*방법|산정\s*방법/,
      onlyKinds: ['work_rules', 'labor_contract'],
      finding: '근로기준법 제17조·제48조 제2항에 따른 임금 구성항목·계산방법 명시 및 임금명세서 필수 기재 기준 보완 필요'
    },
    {
      id: 'harass_prevent', domain: 'culture', severity: 'medium', title: '직장 내 괴롭힘 예방·조사·비밀유지 절차 점검',
      lackOf: /직장\s*내\s*괴롭힘|비밀\s*유지/,
      onlyKinds: ['work_rules'],
      finding: '근로기준법 제93조 제11호·제76조의3에 따른 직장 내 괴롭힘 예방 및 조사 참여자 비밀유지 의무 조항 정비 필요'
    },
    {
      id: 'council_rule', domain: 'coop', severity: 'medium', title: '노사협의회 정기회의·근로자위원 선출절차 보완',
      match: /노사\s*협의회|근로자\s*위원|고충\s*처리/,
      onlyKinds: ['lmanagement', 'work_rules'],
      finding: '노사협의회 근로자위원 직접·비밀·무기명 투표 선출절차, 분기별 정기회의 의제 관리 및 고충처리위원 운영 실효화 필요'
    },
    {
      id: 'senior_retire', domain: 'senior', severity: 'low', title: '정년(60세 이상) 및 계속고용(재고용) 기준 점검',
      match: /정년|촉탁|재고용|계속\s*고용/,
      onlyKinds: ['work_rules'],
      finding: '정년 도래 인력 증가에 대비한 고령자 계속고용(재고용 기준·근로조건·평가절차) 제도화 검토 필요'
    }
  ];

  function extractPolicyIssues(maskedText, docKind) {
    var text = str(maskedText);
    if (!text) return [];
    var issues = [];
    POLICY_RULES.forEach(function (rule) {
      if (rule.onlyKinds && rule.onlyKinds.indexOf(docKind) < 0) return;
      if (rule.match && rule.match.test(text)) {
        issues.push({ id: rule.id, domain: rule.domain, severity: rule.severity, title: rule.title, finding: rule.finding });
      } else if (rule.lackOf && text.length >= 80 && !rule.lackOf.test(text)) {
        issues.push({ id: rule.id, domain: rule.domain, severity: rule.severity, title: rule.title, finding: rule.finding });
      }
    });
    return issues;
  }

  /* 중간보고 이후(post_mid) 메일 본문·첨부 글에서 합의·피드백 변경점(Diff) 자동 추출 */
  function extractPostMidDiff(maskedText, subject, attNames) {
    var safeSubj = maskStandaloneNamesInLabel(maskPiiStrict(str(subject), []).text);
    var safeAtts = (Array.isArray(attNames) ? attNames : []).map(function (n) { return maskStandaloneNamesInLabel(maskPiiStrict(str(n), []).text); });
    var joined = safeSubj + '\n' + safeAtts.join('\n') + '\n' + str(maskedText);
    var diff = {
      adoptedModel: '',
      wageAgreement: '',
      effectiveDate: '',
      targetScope: '',
      voteTotal: 0,
      voteYes: 0,
      votePct: 0,
      roundNo: 0,
      roundMode: '',
      roundMins: 0,
      roundPeople: 0,
      hasPhoto: false,
      hasSign: false,
      requests: []
    };

    /* 1) 채택·선호 제도 모델 */
    var modelMatches = joined.match(/(?:주\s*4\.5일제|격주\s*금요일[^\n,.]{0,25}|매주\s*금요일[^\n,.]{0,25}|시차\s*출퇴근[^\n,.]{0,20}|선택적\s*근로시간[^\n,.]{0,20}|탄력적\s*근로시간[^\n,.]{0,20}|직무급[^\n,.]{0,20}|직능급[^\n,.]{0,20}|포괄임금\s*(?:폐지|개선|축소)[^\n,.]{0,20}|계속고용[^\n,.]{0,20})/g);
    if (modelMatches && modelMatches.length) {
      var uniqModels = [];
      modelMatches.forEach(function (m) {
        var cleanM = str(m);
        if (cleanM && uniqModels.indexOf(cleanM) < 0) uniqModels.push(cleanM);
      });
      diff.adoptedModel = uniqModels.slice(0, 3).join(' · ');
    }

    /* 2) 임금 보전·수당 개편 합의 */
    var wageMatch = /(?:임금\s*(?:감소\s*없[음는이]|100%\s*보전|총액\s*유지|보전)|기본급\s*(?:전환|인상)[^\n,.]{0,25}|고정\s*(?:연장|OT)\s*(?:폐지|축소|전환)[^\n,.]{0,25})/i.exec(joined);
    if (wageMatch) diff.wageAgreement = str(wageMatch[0]);

    /* 3) 시행 예정일 */
    var effMatch = /(?:시행(?:일|예정일|시기)?|적용(?:일|시기)?|도입(?:일|시기)?)\s*[:：은는]?\s*(20\d{2}\s*[년.\-/]\s*\d{1,2}\s*(?:월|[.\-/]\s*\d{1,2}\s*일?)?)/.exec(joined)
      || /(20\d{2}년\s*\d{1,2}월\s*(?:1일|부터)\s*시행)/.exec(joined);
    if (effMatch) diff.effectiveDate = str(effMatch[1]);

    /* 4) 적용 대상 범위 */
    var scopeMatch = /(?:적용\s*대상|대상\s*직군|대상\s*부서)\s*[:：은는]?\s*([^\n.]{2,40})/.exec(joined);
    if (scopeMatch) diff.targetScope = str(scopeMatch[1]);

    /* 5) 근로자 의견수렴·찬반투표·과반수 동의 수치 */
    var voteCntMatch = /(?:전체|대상|재직|투표)\s*(\d{1,4})\s*명\s*(?:중|대비)?[^\n]{0,20}?찬성\s*(\d{1,4})\s*명/.exec(joined)
      || /(\d{1,4})\s*명\s*참여[^\n]{0,20}?(\d{1,4})\s*명\s*(?:찬성|동의)/.exec(joined);
    if (voteCntMatch) {
      diff.voteTotal = Number(voteCntMatch[1]) || 0;
      diff.voteYes = Number(voteCntMatch[2]) || 0;
      if (diff.voteTotal > 0) diff.votePct = round1((diff.voteYes / diff.voteTotal) * 100);
    } else {
      var pctMatch = /(?:찬성률?|동의율?)\s*[:：]?\s*(\d{2,3}(?:\.\d+)?)\s*%/.exec(joined);
      if (pctMatch) diff.votePct = Number(pctMatch[1]) || 0;
    }

    /* 6) 회차 수행 증빙 메타 */
    var rdMatch = /(\d{1,2})\s*(?:회차|차\s*회의)/.exec(joined);
    if (rdMatch) diff.roundNo = Number(rdMatch[1]) || 0;
    if (/비대면|화상|zoom|줌/i.test(joined)) diff.roundMode = 'remote';
    else if (/대면|방문|회의실/.test(joined)) diff.roundMode = 'face';
    var minMatch = /(\d{2,3})\s*분\s*(?:간|진행|소요)?/.exec(joined) || /(\d)\s*시간(?:\s*(\d{1,2})\s*분)?/.exec(joined);
    if (minMatch) {
      if (minMatch[0].indexOf('시간') >= 0) diff.roundMins = (Number(minMatch[1]) || 0) * 60 + (Number(minMatch[2]) || 0);
      else diff.roundMins = Number(minMatch[1]) || 0;
    }
    var pplMatch = /(?:참석|참여)(?:자|인원)?\s*[:：]?\s*(\d{1,2})\s*(?:명|인)/.exec(joined);
    if (pplMatch) diff.roundPeople = Number(pplMatch[1]) || 0;
    diff.hasPhoto = /타임스탬프|시작\s*사진|종료\s*사진|회의\s*사진|\.(?:jpg|jpeg|png|webp)/i.test(joined);
    diff.hasSign = /서명지|참석자\s*서명|서명부|서명본/.test(joined);

    /* 7) 기업 측 수정·보완 요청 문장 추출 */
    joined.split(/\r?\n/).map(str).filter(Boolean).forEach(function (line) {
      if (line.length < 6 || line.length > 160) return;
      if (/요청|수정|보완|변경|반영|검토\s*부탁|조정|합의|결정|확정/.test(line) && diff.requests.length < 5) {
        diff.requests.push(line);
      }
    });

    return diff;
  }

  function decodeXmlEntities(s) {
    return String(s == null ? '' : s)
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) {
        var cp = parseInt(h, 16);
        return isFinite(cp) ? String.fromCodePoint(cp) : '';
      })
      .replace(/&#(\d+);/g, function (_, d) {
        var cp = parseInt(d, 10);
        return isFinite(cp) ? String.fromCodePoint(cp) : '';
      })
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  /* .pptx 슬라이드 XML(ppt/slides/slide*.xml) 평문 추출기 — 브라우저·Node 공용 (압축 폭탄 방어 포함) */
  var MAX_PPTX_COMPRESSED_BYTES = 15 * 1024 * 1024;
  var MAX_PPTX_SLIDES = 120;
  var MAX_PPTX_SLIDE_XML_BYTES = 2 * 1024 * 1024;
  var MAX_PPTX_TOTAL_XML_BYTES = 16 * 1024 * 1024;
  var MAX_PPTX_RATIO = 120;

  async function extractPptxText(bytes, JSZipCtor) {
    var Zip = JSZipCtor || (root && root.JSZip);
    if (!Zip && typeof require === 'function') {
      try { Zip = require('jszip'); } catch (e) {}
    }
    if (!Zip || typeof Zip.loadAsync !== 'function' || !bytes) return '';
    var inputLen = bytes.byteLength != null ? bytes.byteLength : (bytes.length || 0);
    if (inputLen <= 0 || inputLen > MAX_PPTX_COMPRESSED_BYTES) return '';
    try {
      var zip = await Zip.loadAsync(bytes);
      var slideEntries = [];
      Object.keys(zip.files || {}).forEach(function (p) {
        var m = /^ppt\/slides\/slide(\d+)\.xml$/i.exec(p);
        if (m && !zip.files[p].dir) slideEntries.push({ no: parseInt(m[1], 10), path: p });
      });
      slideEntries.sort(function (a, b) { return a.no - b.no; });
      if (slideEntries.length > MAX_PPTX_SLIDES) {
        slideEntries = slideEntries.slice(0, MAX_PPTX_SLIDES);
      }
      var slidesText = [];
      var totalXmlBytes = 0;
      for (var i = 0; i < slideEntries.length; i++) {
        var entry = zip.files[slideEntries[i].path];
        var metaData = entry && entry._data;
        if (metaData) {
          var uncomp = Number(metaData.uncompressedSize || 0);
          var comp = Number(metaData.compressedSize || 0);
          if (uncomp > MAX_PPTX_SLIDE_XML_BYTES) return '';
          if (comp > 0 && uncomp > 65536 && (uncomp / comp) > MAX_PPTX_RATIO) return '';
          if (totalXmlBytes + uncomp > MAX_PPTX_TOTAL_XML_BYTES) break;
        }
        var xml = await entry.async('string');
        totalXmlBytes += xml.length;
        if (xml.length > MAX_PPTX_SLIDE_XML_BYTES || totalXmlBytes > MAX_PPTX_TOTAL_XML_BYTES) break;
        var paras = [];
        var pBlocks = xml.split(/<\/a:p>/i);
        for (var j = 0; j < pBlocks.length; j++) {
          var tMatches = pBlocks[j].match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi);
          if (!tMatches) continue;
          var line = tMatches.map(function (tm) {
            return decodeXmlEntities(tm.replace(/^<a:t(?:\s[^>]*)?>/i, '').replace(/<\/a:t>$/i, ''));
          }).join('').replace(/\s+/g, ' ').trim();
          if (line) paras.push(line);
        }
        if (paras.length) {
          slidesText.push('[슬라이드 ' + slideEntries[i].no + '] ' + paras.join('\n'));
        }
      }
      return slidesText.join('\n\n').slice(0, 120000);
    } catch (e) {
      return '';
    }
  }

  function extractReportHighlights(safeExcerpt, corpOnlyBack) {
    var out = [];
    String(safeExcerpt || '').split(/\r?\n/).map(str).filter(Boolean).forEach(function (ln) {
      if (out.length >= 5) return;
      if (ln.length < 6 || ln.length > 140) return;
      if (/^\[슬라이드\s*\d+\]\s*(?:목차|표지|감사합니다|q\s*&\s*a)$/i.test(ln)) return;
      if (/^\[슬라이드\s*\d+\]|^[ⅠⅡⅢⅣⅤⅥⅦ1-9][.)\s]|^[■●•▶-]/.test(ln)
          || /현황|진단|과제|설계|임금|근로시간|평가|규칙|체계|성과|개선|방안|도입/.test(ln)) {
        var clean = unmaskNames(ln.replace(/^\[슬라이드\s*\d+\]\s*/, ''), corpOnlyBack);
        if (clean && out.indexOf(clean) < 0) out.push(clean);
      }
    });
    return out;
  }

  function sanitizeAndAnalyzeText(rawText, meta) {
    meta = meta || {};
    var names = [];
    if (meta.companyName) names.push({ v: meta.companyName, as: '[해당 기업]' });
    if (meta.ceoName) names.push({ v: meta.ceoName, as: '[대표자]' });
    if (meta.contactName) names.push({ v: meta.contactName, as: '[담당자]' });

    var masked = maskPiiStrict(rawText, names);
    /* 연쇄 인명·주소 패턴이 남아 있으면 최대 3회 반복 가림 */
    for (var pass = 0; pass < 3 && hasResidualPii(masked.text); pass++) {
      masked = { text: maskPiiStrict(masked.text, []).text, back: masked.back };
    }
    var leakBlocked = hasResidualPii(masked.text) || hasIndependentPersonAuditLeak(masked.text);

    var safeSubjForMeta = maskStandaloneNamesInLabel(maskPiiStrict(str(meta.subject), names).text);
    for (var sp = 0; sp < 3 && (hasResidualPii(safeSubjForMeta) || hasStandaloneNameInLabel(safeSubjForMeta)); sp++) {
      safeSubjForMeta = maskStandaloneNamesInLabel(maskPiiStrict(safeSubjForMeta, []).text);
    }
    var safeAttsForMeta = (Array.isArray(meta.attNames) ? meta.attNames : []).map(function (a) {
      var ma = maskStandaloneNamesInLabel(maskPiiStrict(str(a), names).text);
      for (var ap = 0; ap < 3 && (hasResidualPii(ma) || hasStandaloneNameInLabel(ma)); ap++) {
        ma = maskStandaloneNamesInLabel(maskPiiStrict(ma, []).text);
      }
      return ma;
    });
    var previewForKind = leakBlocked ? '' : Array.from(masked.text).slice(0, 1800).join('').trim();
    var dk = meta.docKind ? (Cat.getDocKind(meta.docKind) || classifyDocKind(safeSubjForMeta, safeAttsForMeta, previewForKind))
                          : classifyDocKind(safeSubjForMeta, safeAttsForMeta, previewForKind);
    var isLongDoc = !!(dk && (dk.code === 'mid_report_doc' || dk.code === 'final_report_doc' || dk.code === 'work_rules'));
    var excerptLimit = isLongDoc ? 6000 : 2000;
    var safeExcerpt = leakBlocked ? '' : Array.from(masked.text).slice(0, excerptLimit).join('').trim();

    var metaLeak = hasResidualPii(safeSubjForMeta) || hasIndependentPersonAuditLeak(safeSubjForMeta) || hasStandaloneNameInLabel(safeSubjForMeta)
      || safeAttsForMeta.some(hasResidualPii) || safeAttsForMeta.some(hasIndependentPersonAuditLeak) || safeAttsForMeta.some(hasStandaloneNameInLabel);
    if (metaLeak) {
      leakBlocked = true;
      safeExcerpt = '';
    }
    var corpOnlyBack = meta.companyName ? [{ as: '[해당 기업]', v: str(meta.companyName) }] : [];
    var phase = meta.phase || resolvePhase(meta.ts || Date.now(), meta.midConfirmedAt, dk, safeSubjForMeta, safeAttsForMeta);

    var policyIssues = extractPolicyIssues(safeExcerpt, dk.code);
    var postDiff = (!leakBlocked && (phase === 'post_mid' || dk.code === 'final_report_doc'))
      ? extractPostMidDiff(safeExcerpt, safeSubjForMeta, safeAttsForMeta)
      : null;

    var summaryLines = [];
    if (dk.code === 'mid_report_doc' || dk.code === 'final_report_doc') {
      var hl = extractReportHighlights(safeExcerpt, corpOnlyBack);
      if (hl.length) {
        hl.slice(0, 4).forEach(function (h) { summaryLines.push(h); });
      }
    }
    if (phase === 'pre_mid') {
      if (policyIssues.length) {
        policyIssues.forEach(function (iss) { summaryLines.push('[' + iss.title + '] ' + iss.finding); });
      } else if (!summaryLines.length && safeExcerpt) {
        summaryLines.push('문서 확인 완료 (' + dk.short + ') — 핵심 본문 ' + safeExcerpt.length + '자 비식별 발췌 완료');
      }
    } else if (postDiff) {
      if (postDiff.adoptedModel) summaryLines.push('합의·채택 모델: ' + postDiff.adoptedModel);
      if (postDiff.wageAgreement) summaryLines.push('임금·수당 협의: ' + postDiff.wageAgreement);
      if (postDiff.effectiveDate) summaryLines.push('시행 예정 시기: ' + postDiff.effectiveDate + (postDiff.targetScope ? ' (' + postDiff.targetScope + ')' : ''));
      if (postDiff.votePct > 0) {
        summaryLines.push('근로자 의견수렴·투표: 찬성률 ' + postDiff.votePct + '%'
          + (postDiff.voteTotal ? ' (' + postDiff.voteTotal + '명 중 ' + postDiff.voteYes + '명 찬성)' : ''));
      }
      if (postDiff.roundNo > 0 || postDiff.hasPhoto || postDiff.hasSign) {
        summaryLines.push('회차 증빙 확인: ' + (postDiff.roundNo ? postDiff.roundNo + '회차 ' : '')
          + (postDiff.roundMode === 'face' ? '대면' : postDiff.roundMode === 'remote' ? '비대면' : '')
          + (postDiff.roundMins ? ' · ' + postDiff.roundMins + '분' : '')
          + (postDiff.roundPeople ? ' · ' + postDiff.roundPeople + '명' : '')
          + (postDiff.hasPhoto ? ' · 사진✓' : '') + (postDiff.hasSign ? ' · 서명지✓' : ''));
      }
      postDiff.requests.slice(0, 3).forEach(function (rq) {
        summaryLines.push('회신·요청 요지: ' + unmaskNames(rq, corpOnlyBack));
      });
      if (!summaryLines.length && safeExcerpt) {
        summaryLines.push('후속 메일·첨부 내용 확인 완료 (' + dk.short + ')');
      }
    }

    return {
      ok: !leakBlocked,
      leakBlocked: leakBlocked,
      docKind: dk.code,
      docKindName: dk.short,
      track: dk.track,
      phase: phase,
      piiStripped: true,
      maskedExcerpt: safeExcerpt,
      back: masked.back,
      policyIssues: policyIssues,
      postDiff: postDiff,
      summaryLines: summaryLines.slice(0, 8)
    };
  }

  return {
    GARIM: GARIM,
    PUBLIC_DOMAINS: PUBLIC_DOMAINS,
    maskPiiStrict: maskPiiStrict,
    maskStandaloneNamesInLabel: maskStandaloneNamesInLabel,
    hasStandaloneNameInLabel: hasStandaloneNameInLabel,
    unmaskNames: unmaskNames,
    hasResidualPii: hasResidualPii,
    hasIndependentPersonAuditLeak: hasIndependentPersonAuditLeak,
    buildCompanyMailProfile: buildCompanyMailProfile,
    classifyDocKind: classifyDocKind,
    resolvePhase: resolvePhase,
    flattenMailboxRows: flattenMailboxRows,
    scanProjectMails: scanProjectMails,
    summarizeChecklistProgress: summarizeChecklistProgress,
    extractAllSheetHeaders: extractAllSheetHeaders,
    hasSensitiveTableHeaders: hasSensitiveTableHeaders,
    detectSheetDocKind: detectSheetDocKind,
    analyzeTabularRows: analyzeTabularRows,
    auditQuantResultAsync: auditQuantResultAsync,
    extractPolicyIssues: extractPolicyIssues,
    extractPostMidDiff: extractPostMidDiff,
    extractPptxText: extractPptxText,
    sanitizeAndAnalyzeText: sanitizeAndAnalyzeText
  };
});
