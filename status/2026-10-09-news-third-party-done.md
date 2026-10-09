# 2026-10-09 · 뉴스레터 외부 대리인 건 — 배포·자료 정리 끝 (#2210 뒤)

- 서버 함수 재배포 완료(origin/main eb497d7d): syncMailbox · pullMailbox · weeklyNewsletterPrepare ·
  weeklyNewsletterSend · newsletterWatchRetry — 뉴스레터 발송 명단은 서버(news-friday)가 짓기 때문에 이것이 빠지면
  화면만 새 잣대였다.
- 살아 있는 자료 정리(되돌릴 원본은 세션 scratchpad 의 backup-wrong-mail-links-*.json):
  - 한 자문사에 잘못 이어진 정부사업 운영기관 직원 4명 → 담당자에서 뺌, 그 때문에 채워진 주담당 이름·이메일 비움
    (그 업체는 이제 «주소 없는 곳» — 진짜 담당자 주소를 업체관리에 넣어야 함)
  - 신협 한 곳에 잘못 이어진 다른 신협 담당자 → 뺌, 원래 업체(주담당 이름만 있던 곳)의 빈 주담당 이메일에 넣음
  - config/mailAutoFill 다섯 줄에 undone 표 — 다시 짐작으로 안 올라온다
- ⚠ 세무사무실·회계법인 7명은 업체 담당자에 «그대로» 둠(메일 담당 나누기에 쓰임). 뉴스레터에서만 빠진다.

## 남은 일
- 그 자문사의 실제 담당자 메일 주소 채우기 — 대표/담당 노무사.
