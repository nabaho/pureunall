# 「로그인 유지」 켠 기기는 자동 로그아웃 안 함 — 2026-10-04

대표 지시: 「로그인으로 들어가거나 갑자기 창이 이 화면으로 넘어갈 때 로그인 화면 나온다,
카카오 로그인 화면 가끔씩 나오는데 이 부분 완전히 안 나오게 해달라」

## 실측 (login_events)
- p001 대표 PC(기기 mu9lvvqo64…) 9/28~10/4 로그인 38번 — 10/2 하루 5번(08:59·09:08·10:59·12:57·17:18).
  로그인이 그만큼 자주 풀렸다는 뜻.

## 원인 둘
1. 대표 PC 는 「이 기기에서 로그인 유지」가 꺼져 있다 — PC 는 처음에 꺼진 채 시작(keepDefault, 공용 PC 대비).
   꺼져 있으면 SESSION 저장 → 창·브라우저를 새로 열면 풀린다. → **대표가 한 번 체크해야 한다** (코드로 강제하지 않음).
2. 유지를 켜도 60분 자동 로그아웃은 «화면이 뒤에 있을 때만» 멈췄다
   (`shouldPauseIdle(){ return persistentAutoLogin() && document.hidden; }`).
   화면을 띄워 둔 채 1시간 비우면 유지 켠 PC 도 로그아웃 → 로그인 화면(카카오 먼저) 이 뜬다.

## 고친 것
- enter.html · pu-erp.html · gov-consulting.html · pu-cards.html · rules.html(두 곳) —
  `shouldPauseIdle(){ return persistentAutoLogin(); }` : 유지를 켠 기기는 보이든 안 보이든 60분 타이머가 안 끊는다.
- 유지를 안 켠 기기(공용 PC)는 그대로 60분 뒤 로그아웃.
- tests/portal-auto-login.test.js — 옛 규칙(document.hidden 필수)을 새 규칙(document.hidden 없어야)으로.
  enter.html 을 옛 규칙으로 되돌리면 1건 실패하는 것 확인(이빨 있음).
- 전체 검사 22130건, 실패 0.

## 남은 것 / 알릴 것
- 대표가 로그인 화면 「☐ 이 기기에서 로그인 유지」 체크 후 한 번 로그인해야 효과가 난다.
- 유지 켠 PC 는 자리를 비워도 열린 채 — 윈도 화면 잠금(Win+L)으로 막을 것(대표에게 알림).
- js/pu-active.js 는 이미 pu_portal_auto=1 이면 시각을 계속 적는다 — 손대지 않음.
