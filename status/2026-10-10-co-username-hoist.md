# 2026-10-10 · 업체관리 화면이 「Cannot read properties of undefined (reading 'find')」로 멎던 것 (fix/co-username-hoist)

- 증상: 업체관리만 「biz/company 렌더링 오류」. 다른 화면은 정상.
- 원인: CompanyManagement 의 «주담당 폴백»이 입금의 managerName 이 비면 userName(managerSid) 를 부르는데,
  그 자리는 `var users = getAssignableUsers()` 보다 «위»다 — 함수 선언은 끌어올려지지만 users 값은 undefined.
  담당 이름이 빈 자문료 입금이 한 건(10/8 더빌 대조로 넣은 fi-cms-muzann0us0d0-0, 국공립 아이행복어린이집 10/6)
  생기자 그 숨은 결함이 드러났다.
- 고침: userName 이 users 가 비었으면 직원 명부를 스스로 읽는다. 자료도 그 한 건에 담당 이름(김동현, P-007)을 채웠다.
- 검사: tests/co-username-before-users.test.js (고치기 전 코드에서 운다).
