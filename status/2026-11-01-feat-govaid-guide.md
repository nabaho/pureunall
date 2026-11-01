상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-govaid-guide
가지: feat/govaid-guide

# 🎯 정부지원금 — 연간 지원금 안내 자료 자동 검토

대표 지시 2026-11-01 「매년 새롭게 고용노동부 또는 정부부처 지자체에서 지원금을 안내 자료가 나오는데 이부분도 자동으로 검토하고 가지고 올수 있게 해달라」 → 검토안 → 「추천대로」.

## 한 것
- 서버 govaidNoticeWatch: 공고 이름으로 묶음 자료 표시 notices.guide = '통합공고' | '지원 안내'(지원제도 안내·지원시책·안내 책자). 2026-11-01 실측 공고 1,722 중 통합 공고 25. 낱개 «시행계획 공고»는 안 넣음. 이 PC 가 읽은 것(guideDone)은 오래돼도 덜어내지 않음
- 화면: 📰 새 공고 → «📘 연간 안내 자료» 보기(처리한 것도 보임), «이 PC 가 읽은 결과» 칸(아직 안 읽음 / 읽음 · 사업 N · 새 초안 N · 이미 사전에 있음 N / 못 읽음)
- 이 PC 매월 1일 예약 작업(govaid-monthly-closure)에 «나. 연간 안내 자료 읽기»: guide-list.js(한 달 6건까지, 고용노동부 고용장려금 안내는 해마다 고용24 에서 찾기 MOEL_GUIDE_{해}) → 조사 담당 BRIEF-guide.md → load-yearly.js(new-guide-*.json, guideId 별로 새 초안·이미 있음 셈) → guide-done.js(guideDone 표시)
- 검사 tests/govaid-guide.test.js · functions/govaid-notice-watch.test.js 2건
