# 2026-11-28 자료함 신규 앱「🗨️ 법인 카카오톡 방」구축

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
   - `enter.html`, `js/pu-appbar.js`, `js/pu-chatbot-kb.js`: 자료함 `kakaoroom` (`🗨️`, `카톡·문자 자료수집` `💬`와 타일 그림 구분) 등록 및 전체 HTML 캐시 번호(`pu-ontology.js?v=113`, `pu-appbar.js?v=58`, `pu-chatbot-kb.js?v=22`, `pu-kakaoroom.html` `?v=2`, `pu-design.css?v=3`) 동기화.
   - `work.html`: 기존 `💬 카톡정리` 헤더에 `법인 카카오톡 방(자료함)에서 열기 ↗` 바로가기 추가.
   - `scripts/make-firebase-rules.js`: `/kakao_room` 규칙 추가(1차 기본 규칙 `node scripts/rules-deploy.js --deploy` 콘솔 게시 완료; 전 필드 타입/길이 검증·`redactedCount`/`msgCount` 숫자 강제·`_deleted` 불변·`$other: false` 등 60항목 반영판은 타 세션 콘솔 규칙 `/govlinks` 보호를 위해 `tests/photos-staff-share.test.js` `PENDING`에 등재, `/govlinks` 머지 후 배포 예정).
   - `tools/phone-audit/seeds/kakaoroom.js` & `tests/kakaoroom.test.js` 추가.

## 확인한 것
- Orca 2단계 데스크보드 점검 1차 및 2차 재검증(`antigravity:gemini-4-argon-high` + `claude` **`[최종 판정] 통과`**)을 통해 `_deleted` 논리삭제 불변, 출력 이스케이프 및 필드 검증 방어, `PASSWORD_PHRASE_RE` 멱등·`\bpin\b` 경계, `prepareServerImport` 30일·5000줄/OTP 필터, `combinedFiles` `kf_` 기준 병합, 900px 표 최소 폭 및 다크모드 버튼 대비 기준을 확인·반영 완료.
- `node --test tests/*.test.js functions/*.test.js`: **31,847건 중 31,776건 통과, 실패 0건**(윈도우 로컬 환경 skip 71건 제외).
- `node tools/phone-audit/run.mjs kakaoroom`: 360·375·411·768·900·1366px 및 다크모드(1366px) 전 뷰 옆넘침 0·화면밖 0·짓눌림 0 통과.
- `node scripts/check-cache-version.js --all` 통과 및 로컬 미리보기(`http://127.0.0.1:4339/pu-kakaoroom.html?preview=1`) 콘솔·페이지 오류 0건 확인.
