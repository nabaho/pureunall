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

## 매년 1월 — 새해 사업·조건·서류
```
node scripts/govaid-refresh/export.js <결과폴더> 4
(조사 담당: BRIEF-docs.md 대로 기존 사업은 docs-g1.json …, 새 사업은 new-moel.json · new-other.json)
node scripts/govaid-refresh/load-yearly.js <결과폴더>
node scripts/govaid-refresh/load-yearly.js <결과폴더> --go
```

## 지키는 것
- 모두 «초안·확인 필요»로만 들어간다. 확정은 노무사가 앱(⏳ 확인할 조건)에서 원문과 맞춰 본 뒤 한다.
- 사람이 표시하거나 고친 것은 덮지 않는다(접수 상태 by · 사업 updatedBy 가 `AI-조사초안`·`자동(기업마당)` 이 아니면 그대로).
- ★ 노무사 직접 사업: 새로 넣는 고용노동부 계열 사업주 신청 사업은 처음부터 ★(AI 초안). 사람이 켜거나 끈 별은 건드리지 않는다.
- 확신도 낮은 «종료»는 넣지 않는다 — 신청 가능한 사업이 후보에서 잘못 빠진다.
- 쓰기 직전 서버를 다시 읽어 그사이 바뀐 사업이 있으면 멈춘다. 쓴 뒤 다시 읽어 맞춰 본다.
- 결과폴더는 저장소 밖(예약 작업의 임시 폴더)에 둔다 — 조사 원자료를 커밋하지 않는다.
