상태: 작업 완료 (PR·검토 진행)
가지: feat/deungi-staff-pull

# 🖋 푸른등기 — 사원 입사·퇴사 시 푸른통합시스템 직원명부 자동 당겨오기 (2026-11-24)

대표 지시 2026-11-24 「푸른등기에서 사원입사 또는 퇴사의 경우 푸른통합시스템에서 이름 생년월일 주소 등을 당겨올수 있게 해달라 자동으로」

## 바꾼 파일
- `js/pu-deungi-core.js`: 푸른통합시스템 직원명부(`data/user_accounts` · `data/user_dir`) 정규화 및 매칭 순수 함수 추가
  - `staffBirth6`, `staffFullAddr`, `isStaffLabor`, `normStaff`, `normStaffList`, `matchStaffForMember`, `matchStaffByName`, `staffJoinGroups`, `staffLeaveSignals`, `staffAddrDiffs`, `staffFillJoinPatch`, `staffFillLeavePatch`
  - **개인정보 보호**: 화이트리스트 필드(`sid`, `name`, `title`, `role`, `branch`, `status`, `birth`, `addr`, `hireDate`, `retireDate`, `leaveReason`, `licenseNo`)만 추출하고, 주민번호 뒷자리(`rrn`)·계좌번호(`accountNo`·`accountHolder`)·비밀번호(`loginPw`) 등은 읽고 즉시 버림. `birthDate`가 비어 있고 평문 옛 `rrn`이 남아 있는 경우에만 앞 6자리 생년월일만 추출.
- `js/pu-ontology.js`: `PROGRAMS.deungi.sharedRoots`에 `data/user_accounts`, `data/user_dir` 등록(읽기 전용, 원본 불변).
- `pu-deungi.html`:
  - 앱 로드·새로고침 시 `loadStaff(gen)`으로 `data/user_accounts`(재무 권한, 관리자·위임관리인 계정 자동 보유)를 읽기 전용(`once('value')`)으로 불러오고, 권한 거부 시 공개 명부(`data/user_dir`)로 폴백. `STAFF` 등은 메모리 전용이며 `wipe()` 시 초기화(`localStorage` 저장 안 함).
  - **사원 입사(`join`)**: 카드 상단 «푸른통합시스템 불러오기» 드롭다운(미등기 노무사 / 기타 재직·입사예정 / 기등기·퇴사자 3그룹)에서 선택 시 이름·생년월일(6자리)·주소(도로명+상세주소)·등록번호 자동 채움. 이름 칸 직접 입력 시에도 유일 매칭이면 빈 칸 자동 채움(포커스 유지). **동명이인(2명 이상)은 자동 대입하지 않고 드롭다운 선택 안내.** 입사 연월일은 노무법인 정관변경 인가일 관행을 보존하기 위해 자동 덮어쓰지 않고 `[인사관리 입사일 넣기]` 원클릭 버튼 제공.
  - **사원 퇴사(`leave`)**: ①단계 상단에 푸른통합시스템 퇴사 처리 등기 사원 감지 알림 배너 표시(`[➖ 이름 퇴사 넣기]`), `사원 퇴사` 추가 시 미입력 퇴사 사원이 1명이면 자동 선택 및 퇴사일·퇴사사유 자동 채움. 등기 현황의 생년월일·주소와 인사관리 값이 다르면 `[📥 등기 현황에 반영]` 버튼 제공.
  - **사원 주소 변경(`addr`)**: 사원 선택 시 등기 현황 주소와 다른 인사관리 주소가 있으면 자동 채움(또는 원클릭 버튼 제공).
  - **등기 현황(`pane-base`)**: `📥 인사관리에서 불러오기` 모달 추가(기존 사원 빈 칸 일괄 채우기 + 새 사원 줄 추가).
- `tests/deungi-core.test.js`, `tests/deungi-html.test.js`: 생년월일·주소 정규화, 민감정보 폐기, 동명이인 차단, 그룹 분리, 읽기 전용·세대 가드·온톨로지 등록 테스트 추가.
- `tools/phone-audit/seeds/deungi.js`: 지어낸 직원명부 시드 및 `staffpull` E2E 검증 뷰 추가(주민번호·전화번호 꼴 없음).

## 온톨로지 · 개인정보 · 규칙 준수
- **Firebase 규칙 변경 없음**: `pu-deungi.html` 접근자(`isAdmin || isSubAdmin`)는 `recordUidRole`로 `uid_roles/{uid}/fin === true`를 받아 추가 규칙 변경 없이 `data/user_accounts` 읽기 가능. `staff_secret` 금고는 읽지 않음(열람 로그 오염 방지).
- **원본 불변 및 추정 `sid` 비저장**: `data/user_accounts`·`data/user_dir`은 `once('value')` 읽기 전용이며, `DeungiCase`/`DeungiBase`에 이름으로 추정한 `sid`를 저장하지 않음.
- **Orca 리뷰 반영 (2026-11-24)**:
  - `normStaff`에서 레거시 평문 주민번호(`raw.rrn`) 참조를 완전히 제거(`birthDate`/`birth`만 사용). (참고: `data/user_accounts`에서 서버 최소 필드 전용 경로를 별도 신설하는 권고는 기존 규칙·Cloud Functions 무변경 범위 밖으로 두고, `staff_secret`으로 분리된 현재 구조 + `isAdmin || isSubAdmin` 접근 권한 내에서 메모리 화이트리스트 필터를 유지함.)
  - `STAFF_AUTO`로 직전 자동 채움 값을 추적해 이름 변경·드롭다운 선택 해제 시 이전 직원의 생년월일·주소·등록번호가 섞여 남지 않도록 `clearJoinAuto` 구현.
  - `[data-staff-note]`에 `role="status" aria-live="polite"` 적용.
  - `syncMemberStaff`가 트랜잭션의 서버 최신 `prev` 기준으로 대상 사원 필드만 병합하고 `BASE_REV` 동시 수정 충돌 시 저장을 중단하도록 보강.

## 검증
- `node --test tests/deungi-core.test.js tests/deungi-docs.test.js tests/deungi-html.test.js tests/ontology-contract.test.js tests/ontology-write-gate.test.js tests/color-palette-apps.test.js tests/phone-screen-rules.test.js tests/phone-input-zoom.test.js tests/test-pin-guard.test.js tests/one-line-cells.test.js`: **206개 통과 / 0 실패**
- `node tools/phone-audit/run.mjs deungi` (360px·411px 전 뷰 15종) 및 `node tools/phone-audit/run.mjs deungi --widths=1366 --view=staffpull`: `navErr: []`, `errors: []`, `overflowX: 0`.
