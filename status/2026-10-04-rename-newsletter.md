# 2026-10-04 · 「뉴스레터 관리」 → 「뉴스레터」 (chore/rename-newsletter)

대표 지시: 「뉴스레터 관리를 뉴스레터 로 바꿔라」

- 보이는 이름: 포털 칸(`enter.html` APPS) · 앱바(`js/pu-appbar.js`) · 온톨로지 등록 이름(`js/pu-ontology.js` PROGRAMS.news) · `pu-news.html` 제목·머리.
- 메일 글: 금요일 검토 메일·일요일 점검표·알림판 문구의 「뉴스레터 관리 › …」 → 「뉴스레터 › …」 (서버 배포 필요).
- 건의 도우미 앱 이름 목록(`functions/suggestion-assist.js`)도 같이.
- 캐시: `pu-appbar.js?v=19` · `pu-ontology.js?v=47` (실은 쪽 20곳 모두).
- 주석 속 옛 이름은 그대로 둠(검사가 «뉴스레터 관리 —» 머리말을 찾는다).
- 배포: `weeklyNewsletterPrepare,newsletterWatchSunday,newsletterWatchRetry,newsletterWatchDelivery,weeklyNewsletterSend,suggestionAssist`
