'use strict';
// 서식집 파이프라인 — corpus 레코드 → 서식 레코드 배열
// 순수 함수만 둔다(파일 입출력은 forms_report.js). 그래야 테스트가 붙는다.
const L = require('./forms_lib.js');

// ── 파일명 끝의 인명 추출 ──
// '진정취하서_강지훈.hwp'처럼 파일명 끝에 사건 당사자 이름을 붙이는 관행을 노린다.
// 예전에는 '_' 뒤 한글 2~4자면 무조건 인명으로 봤다. 그러면 '_최종'·'_검토'·'_제출'
// 같은 문서 상태 꼬리표까지 인명 사전에 들어가고, anonymize가 그 낱말을 본문
// 전역에서 {{이름}}으로 바꿔 버려 무관한 서식이 망가진다.
//
// 그래서 두 신호를 함께 쓴다.
//   ① 첫 글자가 실제 한국 성씨일 것.
//   ② 사무실 파일명 꼬리에 흔한 낱말이 아닐 것.
// ①만으로는 부족하다 — '최종'의 '최'는 진짜 성씨다. ②만으로도 부족하다 —
// 꼬리표 어휘를 전부 열거할 수는 없다.
// 판단이 애매하면 남긴다(과다 마스킹이 안전한 방향). 다만 '누가 봐도 문서 상태'인
// 낱말은 인명이 아니다.

// 한국 성씨(단성 1음절). 없는 성을 넣어 두면 걸러내지 못할 뿐이고,
// 있는 성을 빠뜨리면 진짜 이름을 놓치므로 넉넉히 담는다.
const SURNAME = new Set(
  ('강견경계고공곽구국궁권금기길김나남노도동두류마명모목문미민박반방배백범변복' +
   '봉부빈사삼상서석선설성소손송신심안양어엄여연염오옥온왕용우원위유육윤은음이인임' +
   '장전점정제조종주지진차창채천초최추탁태판팽편평표피필하학한함해허현형호홍화황후')
    .split(''));

// 파일명 꼬리에 붙는 문서 상태·분류 어휘. 성씨로 시작해도 인명이 아니다.
const NOT_NAME = new RegExp('^(?:' + [
  // 문서 상태
  '최종', '최종본', '최신', '최초', '수정', '수정본', '재수정', '검토', '검토본',
  '제출', '제출본', '초안', '초고', '원본', '사본', '부본', '정본', '등본', '초본',
  '완료', '미완', '확인', '확정', '미정', '보류', '진행', '대기', '취소', '변경',
  '추가', '삭제', '보완', '반려', '접수', '발송', '회신', '답변', '요청', '보관',
  '폐기', '등록', '신청', '정리', '요약', '검수', '검증', '점검', '승인', '결재',
  '마감', '종결', '백업', '임시', '작성', '작업', '개정', '갱신', '신규', '기존',
  '통합', '병합', '분리', '배포', '공유', '회람', '인쇄', '출력', '스캔', '번역',
  '초안본', '요약본', '확정본', '작성예제', '작성예시',
  // 서식 어휘
  '양식', '서식', '샘플', '예시', '예제', '견본', '참고', '복사', '복사본',
  '첨부', '별지', '별첨', '붙임', '목록', '명단', '연명부',
  '신청서', '확인서', '동의서', '위임장', '진정서', '취하서', '합의서', '계약서',
  '청구서', '보고서', '계산서', '약정서', '명세서', '증명서', '선정서', '신고서',
  '확인원', '의견서', '경위서', '보정서', '각서',
  // 사람이 아닌 '역할'·조직
  '본인', '대표', '대표자', '담당', '담당자', '근로자', '근로자들', '사업주',
  '사용자', '의뢰인', '신청인', '청구인', '진정인', '위임인', '수임인', '대리인',
  '노무사', '변호사', '회사', '법인', '사업장', '직원', '직원들', '가족', '배우자',
  '건설', '산업', '기업', '상사', '공사', '물산', '전기', '통상',
  // 금액·사건 어휘
  '임금', '체불', '급여', '수당', '퇴직금', '정산', '계산', '금액', '계좌', '이자',
  '세금', '합의', '진정', '고소', '소송', '도산', '파산', '폐업', '법정도산',
  // 사무소 관할 지역 — 파일명 꼬리의 지역명은 사람이 아니다
  '천안', '평택', '보령', '아산', '서산', '대전', '청주', '홍성', '서울', '부산',
  '대구', '인천', '광주', '울산', '세종', '경기', '강원', '충남', '충북', '전남',
  '전북', '경남', '경북', '제주',
].join('|') + ')$');

// 기관·법인 꼬리. '하나은행'처럼 성씨로 시작해도 조직 이름이다.
const ORG_TAIL = /(은행|지청|지사|지점|공단|법인|센터|협회|조합|사무소|주식|병원|학교|대학|시청|구청|군청|우체국|노동청)$/;

function collectNames(records) {
  const out = new Set();
  for (const r of records || []) {
    const base = String(r.rel || '').split('/').pop().replace(/\.[^.]+$/, '');
    const m = /[_-]\s*([가-힣]{2,4})\s*$/.exec(base);
    if (!m) continue;
    const w = m[1];
    if (!SURNAME.has(w[0])) continue;
    if (NOT_NAME.test(w)) continue;
    if (ORG_TAIL.test(w)) continue;
    out.add(w);
  }
  return [...out];
}

function domainPrefix(domain) {
  return ({ wageArrears: 'wa', laborCommission: 'lc', industrialAccident: 'ia',
            consulting: 'cs', fund: 'fd', bargaining: 'bg' })[domain] || 'ot';
}

function buildForms(records, taxonomy, names) {
  // ① 레코드 → 세그먼트(서식 단위)
  const segs = [];
  for (const r of records || []) {
    if (r.err || !r.html) continue;
    for (const s of L.splitSegments(r.html)) {
      segs.push({ rel: r.rel, mtime: r.mtime || 0, title: s.title,
                  html: s.html, key: r.rel + '#' + s.index,
                  text: L.normalizeForHash(s.html) });
    }
  }

  // ② 군집
  const groups = L.clusterByContent(segs);

  // ③ 군집마다 대표본 → 서식 레코드
  const forms = [];
  const usedIds = new Set();
  for (const g of groups) {
    const { rep, pickedBy } = L.pickRepresentative(g);
    if (!rep) continue;

    // 익명화는 pickedBy와 무관하게 **항상** 돈다.
    // 예전에는 pickedBy === 'anonymized-latest'일 때만 돌렸는데, 'blank'를 고르는
    // pickRepresentative의 '깨끗함' 검사(hasRedactable)는 숫자형 PII_RULES만 본다 —
    // 인명 사전을 아예 넘겨받지 못하므로 이름은 검사 대상이 아니다. 그래서 서명란만
    // 비어 있고 본문에 실명이 남은 판본이 'blank'로 뽑히면 그대로 공개됐다.
    // 진짜 빈 양식이면 anonymize는 아무것도 바꾸지 않는다(무해한 통과).
    // pickedBy는 계속 출처 표시로만 쓴다 — 사람 눈 검토를 강제하는 신호.
    const anon = L.anonymize(rep.html, names);
    const body = anon.html;
    const cls = L.classify(rep.rel, body, taxonomy);
    const hash = L.formHash(body);

    let id = domainPrefix(cls.domain) + '-' + hash;
    while (usedIds.has(id)) id = id + 'x';
    usedIds.add(id);

    forms.push({
      id,
      title: rep.title || L.stripTags(body).slice(0, 24),
      domain: cls.domain,
      track: cls.track,
      category: cls.category,
      esign: cls.esign,
      signer: cls.signer,
      jurisdiction: cls.jurisdiction,
      vars: L.extractVars(body),
      signFields: cls.signer ? [{ role: cls.signer, label: rep.title || '서명', type: 'sign' }] : [],
      body,
      source: {
        file: rep.rel,
        mtime: rep.mtime,
        segment: +String(rep.key).split('#')[1] || 0,
        hash,
        pickedBy,
        // 한 파일이 같은 군집에 조각을 둘 이상 낼 수 있다(같은 서식이 한 문서에
        // 두 번 실린 경우). 경로를 그대로 나열하면 Task 9 보고서의 '중복 N건'이
        // 부풀어 노무사가 파일 수를 잘못 읽는다. 순서를 지키며 중복만 걷어낸다.
        cluster: [...new Set(g.map(x => x.rel))],
      },
      review: { status: 'pending', flags: L.flagIssues(body), reviewedBy: '', reviewedAt: '' },
    });
  }
  return forms;
}

module.exports = { collectNames, buildForms, domainPrefix };
