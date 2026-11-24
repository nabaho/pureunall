# phone-link --front 에고라이트 최우선 지원 (2026-11-24)

## 요약
- 에고라이트(`ego lite`) 환경에서 코딩·문서 작업 중 Claude 브라우저 도구 호출(`mcp__claude-in-chrome__.*`) 시 `tools/phone-link.js --front` 훅이 `chrome`/`msedge` 프로세스만 조회하여 뒤에 있던 크롬 창이 맨 앞으로 튀어나오거나 크롬이 새로 실행되던 문제를 수정했다.

## 변경 내용
- `tools/phone-link.js`:
  - `앞으로스크립트()`가 시스템 설치 경로(`Program Files` 계열)의 `ego.exe`와 에고라이트 프로필 내 Claude 확장 존재 여부를 먼저 확인해, 해당 환경(`$useEgo`)에서는 실행 경로가 검증된 **에고라이트 창만** 선택·활성화하고 크롬·엣지는 깨우거나 실행하지 않도록 변경(미설치·확장 미설치 PC 에서만 기존 크롬·엣지 폴백).
  - `안올릴창`에 `'푸른 한글 2026'` 및 `' - 한글 2026'`(접미사 매칭 `EndsWith`)을 추가해 문서가 열린 로컬 한글 편집기가 브라우저 자동화 훅에 의해 튀어나오지 않도록 보호하고, `Skip` 대상 앱 창만 떠 있고 일반 탭 창이 없을 때도 브라우저를 정상 기동(`$usable.Count -eq 0`)하도록 보완.
  - `점검하기()`의 실행파일·확장·NativeMessagingHost 검사 대상에 에고라이트(`Citro Labs\ego lite`) 및 `Chromium` 레지스트리 경로를 1순위로 포함.
- `tests/phone-link.test.js`: 에고라이트 최우선 분기(경로 검증·확장 존재 확인·Skip 제외 기동·접미사 제외) 및 확장 찾기 규칙 검증(테스트 ⑫) 추가.
- `docs/화면-같이보기.md`, `docs/규칙/로그인된-브라우저.md`: 에고라이트 우선 동작 반영.

## 검증
- `node --test tests/phone-link.test.js tests/ego-lite-install.test.js tests/test-pin-guard.test.js` 통과
- `node tools/phone-link.js --dry --front` 및 `--check` 실행 확인
