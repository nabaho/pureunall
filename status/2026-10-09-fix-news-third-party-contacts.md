# 2026-10-09 · 뉴스레터에 «자문사 아닌 사람»이 섞이던 것 (fix/news-third-party-contacts)

대표 지적: 「뉴스레터 데이터 중에 자문사 아닌 게 있다 — fma 이메일은 컨설팅회사」.

## 어디서 왔나
- 메일함 「📥 메일에서 온 연락처 › 업체에 잇기」(mnewLink, addedFrom `mail-new`)가 보낸 사람을
  업체관리 담당자 칸(data/companies contacts)에 넣는다 → 뉴스레터 받는 곳은 그 칸을 그대로 읽는다.
- 10/5 밤 한 자문사에 정부사업 운영기관(컨설팅 회사) 직원 1명이 이어졌고, 그 뒤 «도메인이 같다»는 짐작이
  동료 3명을 같은 업체로 끌고 왔다(메일에서 이은 주소가 도메인 근거가 되던 것). 서버 자동 채우기(mailSync)도
  같은 셈이라 그 도메인 새 발신자는 저절로 붙을 판이었다.
- 같은 길로 세무사무실·회계법인 7명이 업체 담당자 칸에 있다(메일 담당 나누기엔 쓸모 있으나 뉴스레터 대상 아님).
- 「정리한 것 › 되돌리기」는 `mail-auto` 줄만 빼서, 「업체에 잇기」로 넣은 줄은 되돌려도 안 빠지고 표만 남았다.

## 고친 것
- `js/pu-news-core.js` 외부대리인까닭 — 세무대리인 메일(taxEmail)·법인/사무소 이름·컨설팅/세무 도메인이면
  안 보내고 「🚫 외부 대리인이라 안 보내는 분」으로 받는 곳 탭에 보인다(실측 11명). 회사 안 공인노무사 직원은 안 뺌.
- `js/pu-mail-fill-core.js` domTable · `pu-cards.html` mbNewCoOf·mbNewCoHint — 메일에서 이은 주소는 도메인 근거로 안 씀.
- `pu-cards.html` erpUnfillContact — how:'link' 기록이면 `mail-new` 줄을 뺀다.
- 서버 사본 동기화(functions/news-lib · functions/mail-fill-core) — **함수 재배포 필요**(syncMailbox·pullMailbox·news*).

## 남은 일
- 살아 있는 자료 정리 스크립트(운영기관 4명 빼기 · 행복신협에 잘못 붙은 북천안신협 담당자 옮기기)는 대표 실행 대기.
