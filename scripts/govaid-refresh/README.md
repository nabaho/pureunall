# 정부지원금 정기 조사 (B — 이 PC 예약 작업)

대표 지시 2026-10-12 「매년 사업관련 자동 업데이트 되게 해서 지원사업 업데이트 되게 해달라」 → 방식 「둘다」.

- **A 서버(매일 08:10)** `functions/govaid-notice-watch.js` · `govaidNoticeWatch` — 기업마당 공고를 `govaid/notices` 에 쌓고,
  사람이 이은 공고(program.bizinfo)의 접수 상태만 자동으로 맞춘다.
- **B 이 PC(이 폴더)** — 기업마당에 잘 안 올라오는 고용노동부 장려금까지, AI 조사로 사전을 갱신한다.

## 매월 1일 — 접수 상태 다시 확인
```
node scripts/govaid-refresh/export.js <결과폴더> 4      # 사전을 네 묶음으로 꺼낸다(읽기만)
(조사 담당 넷: BRIEF-close.md 대로 close-g1.json … 를 <결과폴더> 에 쓴다)
node scripts/govaid-refresh/load-close.js <결과폴더>     # 마른 돌리기 — 무엇이 바뀌는지 본다
node scripts/govaid-refresh/load-close.js <결과폴더> --go
```

## 매월 1일 — 연간 안내 자료 읽기 (2026-11-01 대표 「매년 … 지원금 안내 자료도 자동으로 검토하고 가지고 오게」)
서버가 기업마당 공고 가운데 묶음 자료(통합공고·지원제도 안내)에 `guide` 를 표시해 둔다. 아직 안 읽은 것만 한 달에 6건까지(지역 자료는 충남만, 전국 자료는 모두).
고용노동부 «고용장려금 지원제도 안내»는 기업마당에 없을 수 있어 해마다 한 번 고용24 에서 찾는다(못 찾으면 다음 달에 다시).
```
node scripts/govaid-refresh/guide-list.js <결과폴더>         # guides.json — 비어 있으면 여기서 끝
(조사 담당: 자료 한 건에 한 사람, BRIEF-guide.md 대로 new-guide-<id>.json · guide-<id>.json)
node scripts/govaid-refresh/load-yearly.js <결과폴더>         # 마른 돌리기 → 문제 없으면 --go (새 사업은 초안)
node scripts/govaid-refresh/load-yearly.js <결과폴더> --go
node scripts/govaid-refresh/guide-done.js <결과폴더> --go     # 공고에 «읽음 · 새 초안 N» 표시(화면 📰 새 공고 → 📘)
```

## 매년 1월 — 새해 사업·조건·서류
```
node scripts/govaid-refresh/export.js <결과폴더> 4
(조사 담당: BRIEF-docs.md 대로 기존 사업은 docs-g1.json …, 새 사업은 new-moel.json · new-other.json)
node scripts/govaid-refresh/load-yearly.js <결과폴더>
node scripts/govaid-refresh/load-yearly.js <결과폴더> --go
```

## 예약 작업 다시 만들기 (2026-11-08 — Windows 재설치로 이 PC 예약 작업이 사라져서)
예약 작업은 이 PC(Claude 데스크톱 앱의 «예약됨»)에만 있어 PC를 새로 깔면 없어진다. 그 본문을 여기에 둔다.
| 작업 이름(taskId) | 언제(cron, 한국 시간) | 본문 |
|---|---|---|
| `govaid-monthly-closure` | 매월 1일 09:30 (`30 9 1 * *`) | `TASK-monthly.md` |
| `govaid-yearly-refresh` | 매년 1월 20일 10:00 (`0 10 20 1 *`) | `TASK-yearly.md` |
- 다시 만들 때: 데스크톱 앱 «예약됨»에서 새 작업 → 위 이름·일정 → 본문 파일 내용을 그대로 붙인다(또는 Claude에게 «이 두 파일로 예약 작업을 다시 만들어 줘»).
- 본문은 기준본 `C:\Users\user\Desktop\github\pureunall` 에서 `origin/main` 을 임시 폴더로 꺼내 돌린다 — 다른 PC면 경로만 바꾼다. firebase CLI 로그인이 필요하다.
- 본문을 고치면 이 파일과 예약 작업을 «함께» 고친다.

## 지키는 것
- 모두 «초안·확인 필요»로만 들어간다. 확정은 노무사가 앱(⏳ 확인할 조건)에서 원문과 맞춰 본 뒤 한다.
- 사람이 표시하거나 고친 것은 덮지 않는다(접수 상태 by · 사업 updatedBy 가 `AI-조사초안`·`자동(기업마당)` 이 아니면 그대로).
- ★ 노무사 직접 사업: 새로 넣는 고용노동부 계열 사업주 신청 사업은 처음부터 ★(AI 초안). 사람이 켜거나 끈 별은 건드리지 않는다.
- 확신도 낮은 «종료»는 넣지 않는다 — 신청 가능한 사업이 후보에서 잘못 빠진다.
- 쓰기 직전 서버를 다시 읽어 그사이 바뀐 사업이 있으면 멈춘다. 쓴 뒤 다시 읽어 맞춰 본다.
- 결과폴더는 저장소 밖(예약 작업의 임시 폴더)에 둔다 — 조사 원자료를 커밋하지 않는다.
