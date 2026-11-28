# 2026-11-28 자료함 신규 앱「💬 법인 카카오톡 방」구축

## 무엇을 왜 만들었나
- 기존 카톡 업무방 정리는 업무관리(`work.html`) 왼쪽 메뉴(`💬 카톡정리`, 총괄관리자 전용) 안에 있어 다른 직원이 업무 진행을 확인하기 어렵고, 서버 원문이 30일 뒤 삭제되어 과거 업무 내역과 연결 추적 자료가 남지 않았다.
- 통합시스템 포털 **자료함** 줄에 별도 독립 프로그램 **`💬 법인 카카오톡 방` (`pu-kakaoroom.html`)**을 추가해, **약관 위반 위험 없는 안전 수집**과 **문제없는 업무 내용만 자동 판별·비식별화**하여 자료함에 영구 보관하고 업무관리·기업정보함·사진첩으로 연결되도록 구축했다.

## 바뀐 것
1. **안전판별·자동분류·영구연결 순수 엔진 (`js/pu-kakaoroom-core.js`)**:
   - **OTP·인증번호·자격증명 차단**: `[Web발신]`, 인증번호·OTP·보안코드·API 키 문구를 자동 차단(`blocked`).
   - **민감정보 3중 가림**: 주민번호·카드·계좌(`PuKakaoWork.maskSensitive`) + 주민번호 변형(`PuRrnMask.maskRrnInText`) + 비밀번호 문구(`[비밀번호 가림]`) 자동 치환. 업무 연락용 전화번호는 보존.
   - **단순 잡담·시스템 알림 제외**: `네`, `확인했습니다`, 입장/퇴장/알맹이 없는 사진 알림을 `noise`로 자동 제외.
   - **민감 파일 PC 전용 격리**: 신분증·통장사본·급여·근태·근로계약서 파일은 서버/사진첩 자동 전송에서 제외하고 `PC에만 보관`으로 강제 지정.
   - **6대 업무 영역 분류 & 온톨로지 정밀 연결**: 사건·노동위/기금/컨설팅/급여/자문/행정 자동 분류, 사건번호 글자 일치(`sure`)만 기본 연결, 업체명 추정(`guess`)은 사람이 직접 확정 선택.
2. **자료함 신규 앱 (`pu-kakaoroom.html`, `js/pu-kakaoroom-app.js`)**:
   - 5개 탭: `📊 현황·진행추적` (실시간 `work_erp/items` 진행상태 조인·상세 모달 연결), `🤖 자동수집·안전판별` (폰 상태 진단 + 받을 방 관리 + 서버 30일 글 불러오기 + `.txt` 끌어놓기 + 빠른 붙여넣기), `📎 첨부자료 보관함` (14일 만료 D-day·PC 폴더 매칭·사진첩/기업정보함 `PuHandoff` 이관), `🏢 업체·업무별 보기` (업무/업체/영역/방별 타임라인 + 옵시디언 일지 내보내기), `🛡️ 안전·법령 가이드`.
   - `PuOntologyWrite` 강제(`enforce`) 관문 + `PuRrnMask` 필수 검사 + `_deleted` 논리 삭제.
   - 상단 변경점 안내 바(`#recent-diff-bar`) 및 강조 표시(`.code-diff-box`) 포함.
3. **포털·온톨로지·앱바·길잡이·보안규칙 연동**:
   - `js/pu-ontology.js`: `KakaoWorkArchive`, `KakaoFileRecord`, `PROGRAMS.kakaoroom`, `READ_ADAPTERS.kakaoroom_core` 등록.
   - `enter.html`, `js/pu-appbar.js`, `js/pu-chatbot-kb.js`: 자료함 `kakaoroom` 등록 및 전체 HTML 캐시 번호(`pu-ontology.js?v=112`, `pu-appbar.js?v=56`, `pu-chatbot-kb.js?v=20`) 동기화.
   - `work.html`: 기존 `💬 카톡정리` 헤더에 `법인 카카오톡 방(자료함)에서 열기 ↗` 바로가기 추가.
   - `scripts/make-firebase-rules.js`: `/kakao_room` 규칙 추가 및 `node scripts/rules-deploy.js --deploy` 배포 완료.
   - `tools/phone-audit/seeds/kakaoroom.js` & `tests/kakaoroom.test.js` 추가.

## 확인한 것
- `tests/kakaoroom.test.js` 및 저장소 전체 자동화 테스트(`tests/*.test.js`, `functions/*.test.js`) 통과.
- 로컬 미리보기 서버에서 PC 및 모바일 뷰, 5개 탭, 안전판별 데모 및 포털 자료함 타일 정상 동작 확인.
- Firebase 실시간DB 보안규칙(`+ /kakao_room`) 배포 완료.
