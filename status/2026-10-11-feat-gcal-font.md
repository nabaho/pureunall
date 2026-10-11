# 2026-10-11 · 푸른 캘린더 — 글꼴을 구글 캘린더 차례로 (feat/gcal-font)

대표 지시 2026-10-10 「/goal 완벽하게 구글 캘린더와 똑같이 … 글자모양」 이어서.

- body 글꼴: Google Sans Text · Google Sans · Roboto(숫자·영문은 구글 앱이 쓰는 글꼴) → Noto Sans KR · Noto Sans CJK KR → 맑은 고딕 → 기기 기본.
- 「Pretendard」는 이 페이지가 불러오지 않아(@font-face 없음) 깔려 있는 기계에서만 잡혀 구글과 달라지기만 해서 뺐다.
- 폰(안드로이드)은 Roboto 가 기본 탑재라 숫자·영문이 구글 앱과 같아진다. Roboto 가 없는 윈도우 PC 는 맑은 고딕으로 넘어간다.
- 어두운 화면에서 새 보기들(격자·일정·상세·입력 창)이 읽히는지 폰 크기로 확인.

검사: tests/cal-google-form.test.js 1개. 전체 24,616 실패 0.
