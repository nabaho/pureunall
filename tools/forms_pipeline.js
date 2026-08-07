'use strict';
// 서식집 파이프라인 — corpus 레코드 → 서식 레코드 배열
// 순수 함수만 둔다(파일 입출력은 forms_report.js). 그래야 테스트가 붙는다.
const L = require('./forms_lib.js');

// ── 인명 사전 만들기 ──
//
// ※ 전면 개정(전수 corpus 6,848건 실측 후). 예전 방식과 무엇이 달라졌는지부터.
//
// 예전에는 **파일명만** 봤다. '진정취하서_강지훈.hwp'처럼 파일명 끝에 당사자
// 이름을 붙이는 관행을 노려 '_'·'-' 뒤 한글 2~4자를 뽑고, ① 첫 글자가 한국
// 성씨인지 ② 문서 상태 꼬리표 사전(NOT_NAME)에 없는지로 걸렀다.
// 표본 70건에서는 후보가 1개라 멀쩡해 보였다. 전수 6,848건에서는 193개가 나왔고
// 그 태반이 사람이 아니었다 — 노동부·연장근로·표준모델·조치사항·설립절차·
// 원칙·공고·기본·동일 …
//
// 이 방식은 원리상 구제할 수 없다.
//   · 성씨 검사가 무력하다. 노(노동부)·표(표준모델)·조(조치사항)·설(설립절차)·
//     원(원칙)·공(공고)·기(기본)·동(동일)은 전부 실제 한국 성씨다.
//   · 사전으로도 못 막는다. 막으려면 한국어 보통명사를 전부 열거해야 하는데
//     그런 목록은 없고 유지할 수도 없다.
// 그리고 결과가 치명적이다. anonymize는 사전에 든 낱말을 **모든 서식 본문에서
// 전역 치환**한다. '노동부'가 인명 사전에 들어가면 거의 모든 진정서에서
// 노동부 → {{이름}}이 되어 GitHub Pages에 공개될 서식이 통째로 망가진다.
//
// ── 새 방식: 문서가 스스로 증언하게 한다 ──
// 파일명 꼬리는 '이 낱말이 이름일 수도 있다'는 약한 힌트일 뿐, 증거가 아니다.
// 진짜 인명은 서식 안에서 **이름 자리**에 놓인다 — '위임인 : 홍길동',
// <td>성명</td><td>홍길동</td>. '노동부'는 그 자리에 서지 않는다.
// 그래서 후보는 반드시 corpus 어딘가의 이름 자리에서 실제로 관측돼야 한다.
// 나아가 이름 자리는 그 자체로 **수확처**다 — 파일명에 한 번도 안 나오는
// 이름도 지워야 하므로, 라벨 자리에서 직접 거둬들인다.
//
// 실측(6,848건): 193개(대부분 보통명사) → 599개(거의 전부 사람 이름. 사람 눈으로
// 훑어 남은 비인명은 판정위·판정일·명상테크 3개, 0.5%). 자세한 판정 규칙은
// 아래 각 상수의 주석에.
//
// ── 알고 남긴 미탐 ──
// 이름 자리를 요구하는 대가로, 라벨 없이 표에 늘어놓은 이름은 놓친다
// (근무표의 '토 주임 홍길동 남 평', 급여대장 행, 회의록 참석자 나열).
// 예전 파일명 방식도 그중 일부만 우연히 잡았을 뿐이라 후퇴는 아니지만,
// 미탐인 것은 분명하다. 서식집은 review.status='pending'으로 나가고 노무사가
// 눈으로 검토하는 것이 최종 방어선이다.

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

// ── 사무소 소속 노무사 ── (일부러 지우지 않는다)
// 위임장의 수임인 자리에는 거의 항상 '공인노무사 권형하'처럼 우리 사무소
// 노무사 이름이 인쇄돼 있다. 형태만 보면 완벽한 이름 자리이므로 아래 규칙에
// 그대로 걸린다. 그런데 지우면 안 된다.
//   ① 이건 의뢰인 개인정보가 아니라 **서식에 원래 인쇄돼 있는 수임인 표시**다.
//      직무상 공개되는 업무 정보이고(홈페이지·명함·제출 서면에 그대로 나간다),
//      개인정보 보호의 보호법익과 무관하다.
//   ② 지우면 서식이 망가진다. '공인노무사 {{이름}}'이 되면 빈 서식을 받아 쓰는
//      사람이 거기에 자기 이름을 적어야 하는 줄 안다 — 수임인은 채워 넣는 칸이
//      아니라 고정 문구다. 과다 마스킹이 곧 문서 오류가 되는 드문 자리다.
// 그래서 명시적으로 제외한다. 목록이 작고 사람이 관리 가능한 범위인 것이 핵심 —
// 보통명사 사전과 달리 '우리 사무소 노무사 명단'은 완결되고 유지된다.
// 노무사가 바뀌면 여기에 추가한다.
const FIRM_STAFF = new Set(['권형하', '박한별', '김혜민', '박재원']);

// ── 이름 자리 라벨 ──
// 강한 라벨: 서식에서 이 낱말 뒤에 오는 값은 사람 이름이다. 본문 산문에
// 보통명사로 끼어드는 일이 없어 표(<td>) 건너뛰기까지 허용해도 안전하다.
const STRONG_LABEL = ['성명', '이름', '위임인', '수임인', '진정인', '신청인', '청구인',
                      '취하인', '동의자', '대표자', '채권자', '채무자', '고소인',
                      '의뢰인', '예금주', '작성자', '신고인'];
// 약한 라벨: 이름 자리에도 서지만 그 자체가 보통명사라 산문·표 머리글에도 흔하다
// ('근로자 부담분', '근로자 복지금', '본인 확인'). 콜론이 찍힌 형태
// ('근로자 : 홍길동')에서만 인정한다.
const WEAK_LABEL = ['근로자', '본인', '사업주'];

// 한글 서식은 칸을 맞추려고 라벨 자간을 벌린다('성 명', '위 임 인').
function spacedAlt(words) { return words.map(w => w.split('').join('\\s*')).join('|'); }

// 값 모양. 한글 2~4자 한 덩어리이고, 그 뒤로는 줄 끝까지 장식만 올 수 있다.
//   '홍길동' / '홍길동 (인)' / '홍길동 (서명 또는 날인)' / '홍길동 ㊞' / '홍길동 외 3명'
// 이 '줄 끝까지' 조건이 결정적이다. 값이 통째로 이름 하나여야만 인정하므로
//   · '성 명 : 주식회사 하룡 (인)' → 값이 두 덩어리라 통째로 탈락(법인명 보호)
//   · '근로자 전원에게 지급한다' → 뒤에 문장이 이어져 탈락(산문 보호)
// 가 공짜로 따라온다.
const VALUE_TAIL = '(?:[ \\t]*(?:\\([^()\\n]{0,12}\\)|[㊞)\\]（）·,]|외[ \\t]*\\d+[ \\t]*명?))*[ \\t]*$';
const NAME_VALUE = '([가-힣]{2,4})(?![가-힣])';

// ⓐ 같은 줄: '위임인 : 홍길동'
const AT_COLON = new RegExp('(?<![가-힣])(?:' + spacedAlt(STRONG_LABEL.concat(WEAK_LABEL)) +
                            ')[ \\t]*[:：][ \\t]*' + NAME_VALUE + VALUE_TAIL, 'gm');
// ⓑ 칸 건너뛰기: <td>성명</td><td>홍길동</td> — 라벨만 든 줄 다음의 값 줄
const LABEL_LINE = new RegExp('^[ \\t]*(?:' + spacedAlt(STRONG_LABEL) + ')[ \\t]*[:：]?[ \\t]*$');
const CELL_VALUE = new RegExp('^' + NAME_VALUE + VALUE_TAIL);

// ── 라벨 구실 탐지(구조적 필터) ──
// ⓑ는 표 **머리글 행**에 취약하다. <td>성명</td><td>연락처</td>에서 '연락처'가
// 이름 자리에 선 것처럼 보이고, '연'은 성씨이며 3자다. 그런데 기입란 라벨은
// 서식 어딘가에서 반드시 스스로 값을 이끈다 — '연락처 : 010-…', '주소 :'.
// 사람 이름은 콜론 앞에 서지 않는다. 그래서 "corpus 전체에서 콜론 앞에 선 횟수"를
// 세어 임계값을 넘으면 라벨로 보고 인명에서 뺀다. 어휘 목록이 아니라 문서 구조에서
// 나오는 신호라 새 서식이 들어와도 따라온다.
// 실측: 연락처 268회·주소 401회·전화 456회·성명 659회·서명 12회로 전부 걸리고,
// 실제 인명 중 5회 이상은 하나도 없었다(이희순 2회 — 살아남는다).
const LABEL_ROLE = /(?:^|[\n\t >(\[])([가-힣]{2,4})[ \t]*[:：]/g;
const LABEL_ROLE_MIN = 5;

// ── 길이별 증거량 ──
// 한국인 이름은 성 1자 + 이름 1~2자가 압도적이라 사실상 3자다. 2자는 드물고
// 4자(복성)는 더 드물며, 그 두 길이대가 바로 오탐이 몰리는 곳이다 —
// 2자에는 표 머리글(한글·한문·연령·종별), 4자에는 합성 라벨(서명날인·소속부서·
// 동의여부·제출유무·주민등록)이 앉는다. 그래서 3자는 이름 자리 관측 하나로
// 인정하고, 2자·4자는 증거를 하나 더 요구한다.
//   2자: 콜론형(ⓐ) 관측 또는 파일명 증거 — 머리글 행(ⓑ)만으로는 부족하다.
//   4자: 파일명 증거 — 파일명 꼬리에 붙는 4자는 실무상 복성 이름이다.
function needsExtraEvidence(w) { return w.length !== 3; }

// HWP→HTML 본문을 '한 칸(셀)=한 줄'로 편다. 태그를 줄바꿈으로 바꾸므로
// <td>·<br>·<p> 경계가 줄 경계가 되고, 그래야 "값이 줄 끝까지 이름 하나뿐인가"를
// 물을 수 있다(forms_lib의 labelProbeView와 같은 착상, 같은 엔티티만 해독).
function probeLines(html) {
  return String(html || '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// 이름으로 인정할 모양인가 — 길이·성씨·문서어휘·기관 꼬리.
// 이 검사들은 예전부터 있던 것으로, 이제는 1차 관문이 아니라 위치 증거 뒤의
// 보조 그물이다. {{이름}}처럼 이미 치환된 자리는 한글 덩어리가 아니라
// NAME_VALUE에 아예 잡히지 않는다('{{', '}}'가 한글이 아니므로).
function plausibleName(w) {
  return !!w && w.length >= 2 && w.length <= 4 &&
    SURNAME.has(w[0]) && !NOT_NAME.test(w) && !ORG_TAIL.test(w) && !FIRM_STAFF.has(w);
}

// corpus 전체에서 인명 사전을 만든다.
// 비용: 레코드마다 본문을 한 번 훑는다(실측 6,848건 111MB에 약 1.5초).
// 배치 1회성이라 감수한다 — buildForms의 군집·익명화가 훨씬 비싸다.
function collectNames(records) {
  const recs = records || [];

  // ① 파일명 꼬리 힌트 (그 자체로는 채택 근거가 아니다)
  const fromFile = new Set();
  for (const r of recs) {
    const base = String((r && r.rel) || '').split('/').pop().replace(/\.[^.]+$/, '');
    const m = /[_-]\s*([가-힣]{2,4})\s*$/.exec(base);
    if (m && plausibleName(m[1])) fromFile.add(m[1]);
  }

  // ② 본문의 이름 자리에서 관측
  const atColon = new Set();
  const atCell = new Set();
  const labelRole = new Map();
  for (const r of recs) {
    if (!r || r.err || !r.html) continue;
    const view = probeLines(r.html);
    let m;
    AT_COLON.lastIndex = 0;
    while ((m = AT_COLON.exec(view)) !== null) atColon.add(m[1]);
    LABEL_ROLE.lastIndex = 0;
    while ((m = LABEL_ROLE.exec(view)) !== null) {
      labelRole.set(m[1], (labelRole.get(m[1]) || 0) + 1);
    }
    const ls = view.split('\n');
    for (let i = 0; i < ls.length; i++) {
      if (!LABEL_LINE.test(ls[i])) continue;
      // 라벨 칸 다음의 첫 '내용 있는' 칸. 빈 칸은 태그 사이 공백이거나
      // 미기입 칸이다. 세 칸 안에서 못 찾으면 포기한다 — 더 멀리 가면
      // 다른 행의 값을 라벨에 잘못 붙인다.
      for (let j = i + 1; j < ls.length && j <= i + 3; j++) {
        const s = ls[j].trim();
        if (!s) continue;                       // '성명 : ______' 다음의 빈 칸
        const v = CELL_VALUE.exec(s);
        if (v) atCell.add(v[1]);
        break;                                  // 밑줄·숫자 등 이름이 아닌 값
      }
    }
  }

  // ③ 채택 — 이름 자리에서 관측된 것만. 파일명 후보도 예외가 아니다.
  const out = [];
  const seen = new Set();
  for (const w of [...atColon, ...atCell]) {
    if (seen.has(w) || !plausibleName(w)) continue;
    if ((labelRole.get(w) || 0) >= LABEL_ROLE_MIN) continue;
    if (needsExtraEvidence(w) && !fromFile.has(w) && !(w.length === 2 && atColon.has(w))) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

function domainPrefix(domain) {
  return ({ wageArrears: 'wa', laborCommission: 'lc', industrialAccident: 'ia',
            consulting: 'cs', fund: 'fd', bargaining: 'bg' })[domain] || 'ot';
}

// ── 서식 유형 키 ──
// 제목은 splitSegments가 이미 공백을 지운 상태로 넘어온다. 그래도 그대로 키로
// 쓰면 같은 서식이 갈라진다 — 판본마다 장식이 다르기 때문이다
// ('[위임장]', '위임장(개정)'의 괄호·대괄호, 'CMS동의서'와 'cms동의서'의 대소문자).
// 그래서 글자(한글·한자·라틴)와 숫자만 남기고 소문자로 눕힌 것을 키로 쓴다.
// 장식만으로 이루어진 제목은 알맹이가 비므로 원문을 그대로 키로 쓴다 —
// 빈 키로 뭉치면 서로 무관한 서식이 한 종으로 접힌다.
// (한자 범위는 forms_lib의 NATIVE_LETTER와 같은 착상으로 \u 표기로 적는다.)
const TITLE_DECOR = new RegExp('[^0-9A-Za-z\\uAC00-\\uD7A3\\u4E00-\\u9FFF]+', 'g');
function titleKey(title) {
  const bare = String(title || '').replace(/\s+/g, '');
  const core = bare.replace(TITLE_DECOR, '').toLowerCase();
  return core || bare;
}

// ── 무엇을 한 '서식'으로 볼 것인가 ──
//
// 예전에는 **내용 군집** 하나가 서식 한 종이었다. 전수 6,848건에서 이 모델이
// 무너졌다. 같은 위임약정서의 사본끼리 자카드 유사도가 0.49~0.83으로 나온다
// (익명화해도 숫자가 그대로다 — 다른 것은 개인정보가 아니라 **조항 문구 자체**다).
// 사무소 표준서식이 10년 넘게 개정돼 왔고 사건 폴더마다 그 시절 판본이 박제돼
// 있으니, 진짜 같은 서식이 병합 임계값 0.85를 넘지 못한다. 결과가 검토표 4,390행 —
// 노무사가 볼 수 있는 분량이 아니다.
//
// 그래서 의뢰인 결정에 따라 모델을 바꾼다: **제목(서식 유형)으로 묶고 판본은
// 그 아래에 쌓는다.** 노무사는 서식 유형 약 880종을 판단하고, 판본은 필요한
// 곳에서만 파고든다.
//   · 묶는 키 = 도메인 + 정규화한 제목. 도메인을 함께 넣는 이유는 같은 '동의서'라도
//     산재 동의서와 교섭 동의서는 다른 서식이기 때문이다.
//   · 도메인은 taxonomy 트랙을 **파일 경로에만** 대보므로(classify가 domain을
//     rel에서만 뽑는다) 대표본을 고르기 전에도 확정된다. 나중에 대표본으로
//     classify를 다시 돌려도 같은 도메인이 나온다 — 같은 묶음의 구성원은 모두
//     같은 도메인이므로.
//   · 제목이 검출되지 않은 세그먼트(titleDetected=false)는 묶을 제목이 없다.
//     예전 그대로 내용 군집으로 묶는다.
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

  // ② 묶기 — 제목이 있으면 서식 유형(도메인+제목)으로, 없으면 내용 군집으로.
  // Map은 삽입 순서를 지키고 segs의 순서는 records 순서로 결정되므로, 같은
  // corpus를 다시 돌리면 묶음 순서도 그대로다(id 안정성의 전제).
  const byType = new Map();
  const untitled = [];
  for (const s of segs) {
    if (!s.title) { untitled.push(s); continue; }
    const domain = L.classify(s.rel, '', taxonomy).domain;
    const k = domain + '\t' + titleKey(s.title);
    if (!byType.has(k)) byType.set(k, []);
    byType.get(k).push(s);
  }
  const groups = [...byType.values()].concat(L.clusterByContent(untitled));

  // ③ 묶음마다 대표본 → 서식 레코드
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

    // splitSegments가 <p> 제목줄만 보므로, 제목이 표(<td>) 안에만 있으면 못 찾는다
    // (실측 90개 세그먼트 중 25개, 28%). 그때도 사람이 훑어볼 수 있게 본문 앞
    // 24자로 title을 채우긴 하지만, 그건 '검출된 제목'이 아니라 대체값이다.
    // 이 구분이 없으면 검토표·검토 페이지에서 대체값을 진짜 제목처럼 보게 된다.
    const titleDetected = !!rep.title;
    forms.push({
      id,
      title: rep.title || L.stripTags(body).slice(0, 24),
      titleDetected,
      domain: cls.domain,
      track: cls.track,
      category: cls.category,
      esign: cls.esign,
      signer: cls.signer,
      jurisdiction: cls.jurisdiction,
      vars: L.extractVars(body),
      // label은 서식 캡션(위임인/신청인/사업주 등)이어야 한다 — 문서 제목이 아니다.
      signFields: cls.signer ? [{ role: cls.signer, label: L.signFieldLabel(cls.signer, cls.category), type: 'sign' }] : [],
      body,
      source: {
        file: rep.rel,
        mtime: rep.mtime,
        segment: +String(rep.key).split('#')[1] || 0,
        hash,
        pickedBy,
        // 이 서식 유형의 판본이 나온 **서로 다른 원본 파일** 목록.
        // 한 파일이 같은 묶음에 조각을 둘 이상 낼 수 있다(같은 서식이 한 문서에
        // 두 번 실렸거나, 한 사건 폴더의 문서에 같은 제목이 두 번 나오는 경우).
        // 경로를 그대로 나열하면 검토표의 판본 수가 부풀어 노무사가 파일 수를
        // 잘못 읽는다. 순서를 지키며 중복만 걷어낸다.
        // 제목 묶음으로 바뀐 뒤에는 이 목록의 길이가 곧 '판본 수'다 —
        // 판본은 사건 폴더마다 한 벌씩 박제된 그 시절 서식이기 때문이다.
        // 별도 필드를 두지 않는 이유: 같은 수를 두 군데에 적으면 어긋난다.
        cluster: [...new Set(g.map(x => x.rel))],
      },
      review: { status: 'pending', flags: L.flagIssues(body), reviewedBy: '', reviewedAt: '' },
    });
  }
  return forms;
}

module.exports = { collectNames, buildForms, domainPrefix };
