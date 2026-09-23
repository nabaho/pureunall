# 로그인 무단시도 감지·경보 — 2026-09-20

> ## ✅ 2026-09-20 전수점검에서 다시 잼 — 「남은 일」은 이미 풀렸다
> 아래 「⚠ 남은 일」에 적힌 **403(아무도 호출 못 함)은 지금 없다.** 직접 두드려 보니
> `GET 405` · `POST 400 {"ok":false,"error":"이메일이 없거나 이상합니다"}` — 구글 앞단을
> 지나 우리 코드까지 닿는다. 즉 `allUsers` 초대자 권한은 열려 있다.
> **콘솔에서 따로 하실 일이 없다.**
>
> 다만 `login_events`·`login_devices` 는 **아직 비어 있다** — 자동로그인 중인 사람은
> 로그인 화면을 안 거치므로 보고가 일어나지 않는다. 대표님이 한 번 로그아웃했다가
> 다시 로그인하시면 그때 첫 기록이 쌓인다(그것으로 실제로 도는지 확인된다).
> — `status/2026-09-20-all-sessions-audit.md`

브랜치: `worktree-login-security-monitoring` (main 최신 기준 새 워크트리)
설계: [docs/superpowers/specs/2026-09-20-login-security-monitoring-design.md](../docs/superpowers/specs/2026-09-20-login-security-monitoring-design.md)
계획: [docs/superpowers/plans/2026-09-20-login-security-monitoring.md](../docs/superpowers/plans/2026-09-20-login-security-monitoring.md)

## 무엇을 만들었나
- `functions/login-security.js` — 새 기기·새 국가·15분/5회 반복실패 판정 순수 함수(단위테스트 12개)
- `functions/index.js` `exports.logLoginAttempt` — 로그인 성공·실패마다 불려 기록·판정하는 서버 함수
- `login_events`·`login_devices`·`login_countries`·`login_fail_burst` 네 자리 — 관리자·위임관리인만 읽기, 클라이언트 쓰기 없음(서버 전용)
- 의심 판정은 기존 `systemAlerts` 관리자 경보 화면에 그대로 추가로 뜬다(새 화면 없음)
- `enter.html` — 로그인 성공/실패 직후 서버에 보고(응답은 절대 기다리지 않음, 실패해도 로그인 무영향)
- `js/pu-ontology.js` INFRA_ROOTS 에 새 4자리 등록(온톨로지 규칙 준수)

## 배포 완료
- Cloud Function `logLoginAttempt` (asia-northeast3, 512MB) — 배포됨
- Firebase 규칙 4자리 — 콘솔에 올림, 사라진 규칙 0개 확인(`docs/firebase-rules-콘솔원문-2026-09-20.json`)

## ⚠ 남은 일 — 사람이 해야 함(대표 또는 콘솔 접근 권한자)
**함수가 배포는 됐지만 지금은 아무도(우리 포함) 호출할 수 없다.** 상태 확인용으로 직접 호출해보니
`403 Forbidden`(구글 앞단이 거절 — 우리 코드에 닿기도 전에 막힘). 같은 프로젝트의 기존 함수
(`newsOpen` 등)는 지금 정상 작동 중이라 프로젝트 전체 장애는 아니다. 원인은 **새로 만든
함수는 더 이상 자동으로 "누구나 호출 가능"(`allUsers` 초대자) 권한을 안 받는다** — 옛날에
만든 함수들은 그 전 기준으로 이미 열려 있어 그대로 살아 있을 뿐이다.

이 방에는 `gcloud` 명령이 없어 권한을 직접 못 열었다(그리고 "누구나 부를 수 있게 열기"는
사람 확인 없이 넘어가면 안 되는 종류의 일이라 판단해 멈췄다). 아래 둘 중 하나로 열어야
기능이 실제로 돈다 — 그 전까지는 **로그인은 평소와 똑같이 되지만, 기록·경보는 조용히
아무것도 안 쌓인다**(설계상 실패를 삼키게 만들어서 그렇다 — 위험하지는 않다):

1. **[Google Cloud 콘솔]** → Cloud Functions(또는 Cloud Run) → `pureun-erp` 프로젝트 →
   `logLoginAttempt`(asia-northeast3) → 권한 탭 → `allUsers` 를
   **Cloud Functions 호출자(Cloud Functions Invoker)** 역할로 추가.
2. 또는 `gcloud` 를 쓸 수 있는 곳에서:
   ```bash
   gcloud functions add-iam-policy-binding logLoginAttempt \
     --region=asia-northeast3 --project=pureun-erp \
     --member=allUsers --role=roles/cloudfunctions.invoker
   ```

열어 주신 뒤 알려 주시면 실제로 로그인 기록이 쌓이는지 재확인하겠습니다.

## 검사
`node --test 'tests/*.test.js'` — 18352개 전부 통과(0 실패), 배포 뒤 재확인 완료.
