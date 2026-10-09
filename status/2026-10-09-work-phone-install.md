# 2026-10-09 업무관리 — 📲 바탕화면에 아이콘 만들기

대표: 「폰에서 로그인 후 화면으로 넘어가려면 많이 힘들다」 → 정리안(로그인 유지 · 업무관리 아이콘 · 카카오) → 「추천대로」.

- 폰은 「로그인 유지」가 처음부터 켜져 있다(enter.html keepDefault) — 손댈 것 없음.
- 업무관리는 원래 따로 깔리는 앱(work-manifest.json, start_url work.html)인데 «까는 길»이 브라우저 메뉴 깊숙이 있었다.
  → 왼쪽 메뉴 아래에 「📲 바탕화면에 아이콘 만들기」. 크롬이 깔 수 있다고 알릴 때(beforeinstallprompt)만 보이고, 깔면 사라진다.
- 검사 `tests/work-phone-install.test.js`.
