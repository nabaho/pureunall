# ☁️ 클라우드 방에서 배포하기 — GitHub 「Firebase 배포」 작업 (2026-10-31)

상태: 코드·검사 완료 · **열쇠 넣기 대기**(대표 — GitHub 비밀 `FIREBASE_SERVICE_ACCOUNT`, 한 번만)

대표: 「매일정리켜기 니가 직접해라」 → 클라우드 방에는 firebase 로그인이 없다(확인: CLI 없음 · gcloud 열쇠는 푸른 프로젝트에 «인증 안 됨» · 연결된 PC 폴더 없음, 대표 PC 는 윈도우라 클라우드에서 빌려 쓸 수 없음)
→ 「니가 직접 하면 안되나 아니면 한번에 하게 가능하게 하던가」.

## 한 것
- `.github/workflows/firebase-deploy.yml` — 수동 실행(workflow_dispatch)·main 만·읽기 권한만. 입력 셋: ① 보안규칙 게시(`rules-deploy.js --deploy` 그대로 — 안전장치째) ② 서버 함수(이름 찍어서) ③ 취업규칙 매일 정리 스위치(dry/live/off).
  열쇠는 GitHub 비밀에서만(서비스 계정 JSON 권장, login:ci 토큰도 받음), 끝에 지운다. 비밀이 없으면 첫 단계에서 멈춘다. 입력은 env 로만.
- `scripts/firebase-deploy-check.js` — 함수 이름을 `functions/index.js` 의 exports 와 견준다(없는 이름·이상한 글자·빈 것·10개 넘음 거절).
- `docs/배포-클라우드에서.md` — 열쇠 넣는 법(대표 한 번) · 부르는 법 · 지키는 것 · 올린 뒤 뒷정리 PR.
- `CLAUDE.md`·`AGENTS.md` 파이어베이스 절에 한 줄씩(두 파일 함께).

## 검사
- `tests/firebase-deploy-workflow.test.js` 6개 — 울타리를 하나씩 빼 보면 운다(push 로 깨움 · 입력을 run 에 바로 · 규칙 직접 배포 · main 제한 뺌). YAML 문법 확인.

## 지금 상태 (취업규칙 매일 정리)
- 규칙(`rules_mgmt/library/auto`)은 오늘 대표 PC 의 다른 방이 이미 게시했다(콘솔 원문 2026-10-31).
- 남은 것: 함수 배포 + 켜기 — 열쇠가 들어오면 Claude 가 이 작업을 `functions=collectRulesMail,collectRulesMailAsk`·`daily_mode=live` 로 부른다.
