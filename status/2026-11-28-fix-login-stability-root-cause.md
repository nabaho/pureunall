# 로그인 멈춤 · 반복 새로고침 · 상단 부팅폭풍 빨간 띠 오탐 근본 해결 (2026-11-28)

- 가지: `fix/login-stability-root-cause`
- 배경:
  1. `erp.pureunlabor.co.kr/enter.html?v=...` 진입 시 「로그인 상태 확인 중…」 가림막에서 진행·탈출이 불가능하게 멈춤.
  2. 로그인 실패/지연 시 강제 새로고침(`enter.html?v=Date.now()`)과 탭 간 인증 튕김이 반복되며, 상단에 「이 기기에서 이 화면이 3분 안에 5번 다시 켜졌습니다 (매번 새 탭으로 열림 · 약 12초마다 고르게)... 자동 새로고침 확장·탭 돌리기... 꺼 주세요」 빨간 띠가 표시됨.

## 확인한 원인

1. **상단 빨간 띠 (PC 외부 도구 여부 전수 확인)**
   - Windows 작업 스케줄러, 실행 중인 Node/Python/PowerShell/WScript 프로세스, Chrome 확장 6종, `tools/remember-ext` 어디에도 `enter.html`을 자동 새로고침·새 탭으로 여는 외부 도구는 없었음.
   - 실제로는 우리 로그인·인증 코드의 내부 리다이렉트(`enter.html?v=Date.now()`, `doLogin` 12초 워치독, `pu-authsync` 킥, `AUTH_RECOVERY_MS`)와 멈춘 화면을 피하려 새 탭을 여는 조작이 `localStorage['pu_boot_dev_v1']`에 합산되었고, `js/pu-version.js`가 내부 인증 이동을 구분하지 않고 `!tabStorm && devStorm`이면 무조건 「매번 새 탭으로 열림」·「외부 확장/감시 도구를 꺼 주세요」로 안내했음.

2. **「로그인 상태 확인 중…」 멈춤 및 반복 튕김 7가지 구조 원인**
   - `_loginGuard.cover()`가 생성하는 재가림막에 `#pu-boot-msg`와 8초 탈출 버튼(`#pu-boot-skip`)이 없었음.
   - `_loginGuard.show()`가 `_handled || signedIn()`일 때 `_rmBootSplash()` 없이 반환해 포털이 이미 준비돼도 가림막이 영구 교착됨.
   - `_instantReturnFromApp()`이 검증 전 `_handled = true`를 세운 뒤 실제 미로그인 시 `else if (_handled)`로 빠져 15초 동안 버튼 없이 멈춘 뒤 강제 새로고침(`?v=Date.now()`)함.
   - `enterPortal()`의 `_show()`/`renderPortal()`에 `try/finally`가 없어 예외 발생 시 가림막이 걷히지 않고, Firebase SDK 로드 실패 시 메인 스크립트가 중단됨.
   - `doLogin()`이 이미 `LOCAL` 지속성인데도 매번 `setPersistence`를 재호출하고, 12초 워치독이 입력 내용을 날리며 `location.replace` 강제 새로고침을 반복함.
   - `kkHandleReturn()`의 `persist` 및 `signInWithCustomToken`에 타임아웃이 없고, 카카오 취소·일반 복귀 시 `_kkLoginStarting`이 풀리지 않음.
   - `js/pu-authsync.js`의 PC 부팅 유예가 4초로 짧고 대기 중 `nullTimer`를 취소하지 못하며, `enter.html`이 로그인 시 `pu_auth_uid`를 기록하지 않고, 4개 앱(`pu-erp.html`·`pu-cards.html`·`gov-consulting.html`·`rules.html`)의 `doAutoLogout()`이 `PuAuthSync.broadcastLogout()`을 호출하지 않아 탭 간 연쇄 튕김이 발생함.

## 고친 내용

- `enter.html`:
  - Firebase SDK 미적재 가드 + `_markSelfAuthNav()` + 안전한 수동 복귀 함수 `window.__puForceShowLogin()` 추가.
  - `_loginGuard.cover()`에 `#pu-boot-msg` + 8초 `#pu-boot-skip` 추가 및 `show()` 포털 준비 완료(`_handled && _portalReady`) 시 즉시 가림막 해제.
  - `onAuthStateChanged`에서 확정 로그인 시 `localStorage.pu_auth_uid` 동기화, 미확정 `_fastRestored`에서 미로그인 판정 시 3초 뒤 새로고침 없이 `__puForceShowLogin()`으로 복귀.
  - `enterPortal()` `_show()`에 `try/catch/finally` 적용해 예외 시에도 `_rmBootSplash()` 및 진입 잠금 해제 보장, `_readRoster` 끝 `.catch()` 폴백 추가.
  - `doLogin()` 중복 `LOCAL` `setPersistence` 생략 + 7초 타임아웃 + 요청 시퀀스 기반 15초 비파괴 워치독(강제 새로고침 제거, 버튼/안내만 복구).
  - `kkHandleReturn()` `persist`(16초)·`signInWithCustomToken`(20초) 타임아웃 및 비-bfcache 복귀(`visibilitychange`) 버튼 복구 추가.
- `js/pu-authsync.js` (캐시 `?v=8`): PC·모바일 공통 부팅 유예 12초 통일, `nullTimer` 도입으로 유저 복원 시 대기 타이머 즉시 취소, `kick()` 시 내부 이동 표식 기록.
- `pu-erp.html`, `pu-cards.html`, `gov-consulting.html`, `rules.html`: `doAutoLogout()`에 `PuAuthSync.broadcastLogout()`·`PuLogoutWhy.why(...)`·내부 이동 표식 추가 (`gov-consulting.html` 수동 `doLogout()` 포함).
- `js/pu-version.js` (캐시 `?v=13`): `pu_boot_meta_v1`로 탭 고유 ID와 내부 인증 이동(`self`)을 분리 추적해 내부 인증 반복은 `selfAuthLoop` 복구 배너(「로그인 화면 초기화」 버튼 포함, `<button` 미사용)로 안내하고, 실제 3개 이상 탭일 때만 「매번 새 탭으로 열림」으로 표시(`localStorage.setItem` 저장 및 `Enter`/`Space` 키 `preventDefault` 보강).

## 검증

- `tests/login-stability-root-cause.test.js` (8개 규칙·VM·고장넣기 5종 검증) 및 기존 인증·부팅·캐시·핀가드 테스트 23개 파일 244건 전체 통과.
- `tests/shared-js-cache-version.test.js` (3 통과, 144개 HTML) 및 `scripts/check-cache-version.js --all` 통과.
- Orca 2단계 데스크보드 점검 파이프라인(`ow.bat pipeline`, 기록 `ow-fix-20261128-182656-98Lhbr`): 1단계 Gemini 3개 파일 보완 수정(`js/pu-version.js`, `gov-consulting.html`, `tests/login-stability-root-cause.test.js`), 2단계 Claude 최종 재검토 `[통과]` (높음·중간 0건, 보안 발견 사항 없음).
