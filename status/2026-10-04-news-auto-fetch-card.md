# 2026-10-04 · 설정 › 자료 자동 가져오기 (feat/news-auto-fetch-card)

대표 지시: 「이부분 내가 안받고 자동으로 가지고 오게해라」 → 목업 → 「1 접어두고 2 빼라」

- 설정 오른쪽 «지금 가져오기» 상자 둘 → 「🤖 자료 자동 가져오기」 한 상자.
  줄마다 무엇 · 언제(기사 7:00 · 자료/판례 7:10 · 공인노무사회 7:20) · 마지막 결과(✓ 오늘 / ⚠ 막힘 / ⚠ 마지막 M/D / 첫 회 기다림).
- 손 단추는 맨 아래 「지금 한 번 더 가져오기 (급할 때만)」에 접어 둠. 개발용 「엿보기」 단추는 뺐다(서버 peek 길은 남김).
- 날짜는 서울 날로 견줌(`서울날`) — 화면의 `오늘()` 은 UTC 라 아침 9시 전엔 어제가 된다.
- 서버: `뉴스모으기한번`·`자료판례모아담기` 가 못 가져오면 `homepage/newsBrief|newsDocs|newsPrec/탈` 을 남기고, 가져오면 `탈: null`. 공인노무사회는 `ilabor/meta/자동탈`(앞 PR).
- 검사: `tests/news-auto-fetch-card.test.js` (망가뜨려 우는 것 확인)
- 배포: `dailyNewsCollect,dailyDocsCollect,newsDocsPull,newsletterWatchRetry`
