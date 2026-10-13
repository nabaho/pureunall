상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-pubdata
가지: bizreg-review

# 2026-10-13 · 📥 사업자등록증 자동 검토 (대표 「진행」, 목업 승인)

어디로 들어오든(사진첩·메일 첨부 → coInfo/{번호}/docs, 기업정보함 → items kind biz) 서버가 바로 검토.
1. [x] 서버 functions/bizreg-review.js: 국세청 상태·진위 대조·4대보험·같은 번호/옛 번호 찾기·어긋난 칸 → pucards/bizreg/{열쇠}
2. [x] 트리거 둘(서울): coInfo/{no}/docs/{dk} onCreate(이름에 등록증·고유번호증) · items/{id} onCreate(kind biz)
3. [x] 기업정보함 옆줄 「📥 새 등록증」 창 — 노란 줄만 수, 처리 단추(기업 상세 열기·옛 번호에 새 번호 적기·확인함)
4. [x] 검사·배포·실화면

## 끝낸 것 / 남은 일
- 1·2: PR(bizreg-review) — functions/bizreg-review.js, 트리거 bizregReviewDoc·bizregReviewCard(서울). 합친 뒤 두 함수 배포.
- 3: PR(bizreg-screen) — 「🧾 새 등록증」(📥 는 연락처 정리가 이미 씀). 규칙 pucards/bizreg 색인(at) 10/13 콘솔에 올림(새 1·사라짐 0, 읽기 범위 그대로).
- ⚠ 확인 창 문자열에 진짜 줄바꿈이 들어가 pu-cards 전체가 깨졌는데 이름으로 고른 검사 6,730건은 통과 — html-inline-script-syntax 로 잡아 고침.
- #2620·#2622 합침, bizregReviewDoc·bizregReviewCard 배포(서울). 실제 API 로 3곳 메모리 시험(쓰기 없음): 계속·일치·상시 58/17/41명 → 「끝」. 실화면: 「🧾 새 등록증」 창 열림(배포 뒤 들어온 것 0건).
- 남은 일: 진짜 등록증이 들어올 때 첫 검토 기록 확인.
