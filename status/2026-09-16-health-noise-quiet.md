# 빨간 「장애 알림」 배지가 깜빡이던 뿌리 둘 — 잔소리를 장애로 세었다

대표 제보 2026-09-16 「계속 깜빡이며 경고가 계속 반복된다 해결좀해라」
가지 `fix/health-noise-quiet` · 고친 곳 `js/pu-health.js` · `fund.html` · `fund-erp/tools/check_sticky.js`

## 무엇이 있었나 (서버 실측)

대표 화면의 **「⚠ 장애 알림 7」** 이 켤 때마다 다시 켜졌다. 서버 `systemAlerts` 를 읽어 보니
대표 계정에 열린 7건은 **전부** 기금 화면이 **10분마다** 올린
`ResizeObserver loop completed with undelivered notifications.` 였다.

| 메시지 | 건수 | 뜻 |
|---|---|---|
| ResizeObserver loop … (fund.html) | **69** | 크롬의 «이번 칸에 한 번 더 그린다» 안내 — 고장 아님 |
| Script error. (work·fund) | **37** | 다른 출처 스크립트 오류를 «내용 없이» 알리는 빈말 |
| permission_denied at /rules_mgmt (rules.html 백업) | 71 | 예전 규칙 문제 — 이미 처리됨 |
| allItems is not defined (pu-cards) | 32 | 진짜 오류 — 예전에 고쳐짐 |

## 뿌리 둘

**① pu-health.js** — 오류 그물(`window.error`)이 잔소리를 장애로 세었다.
10분 겹침 방지(`DEDUPE_MS`)가 지나면 «같은 잔소리»가 새 건으로 또 올라가고,
새 건마다 `paintAdminBadge` 가 배지를 다시 칠했다 → **깜빡임**.

**② fund.html** — 머리줄 크기 감시(`_homeheadRO`)가 제 콜백 «안에서»
`disconnect()·observe()` 를 되풀이했고(observe 는 첫 알림을 새로 낳는다),
같은 칸에서 `_syncTblScroll()` 로 표 스크롤을 켜고 껐다(폭이 바뀌어 감시를 또 깨운다).
크롬은 그것을 「loop」로 알렸고 ①이 그것을 장애로 올렸다.

## 고친 것

- `pu-health.js` — `isNoise()`: ResizeObserver loop · Script error 는
  **올릴 때(enqueue)와 읽어 셀 때(flattenAlerts) 두 곳에서 함께** 거른다.
  올릴 때만 거르면 이미 쌓인 것이 계속 배지를 켜고, 읽을 때만 거르면 서버에 영영 쌓인다.
  → 이미 쌓인 7건도 세지 않으므로 **서버를 손대지 않고** 배지가 꺼진다.
- `fund.html` — 지켜보는 대상이 «바뀌었을 때만» observe · 표 스크롤 손질은
  `requestAnimationFrame` 으로 다음 칸에 · 잰 값이 같으면 다시 적지 않는다(`_setCssVar`).
- `check_sticky.js` — `setProperty('--homehead-h','0px')` 를 글자 그대로 박아 두어
  멀쩡한 개선에 걸렸다 → 「0 으로 되돌리는가」만 본다.
- `pu-health.js?v=3 → 4` (18개 화면)

## ⚠ 다음 사람이 밟을 자리

- 잔소리 목록(`NOISE`)을 **넓히지 말 것.** 정규식 하나가 헐거워지면 진짜 장애가 조용해진다 —
  검사 ④·⑤ 가 「진짜 오류는 그대로 올라간다」를 잰다.
- ResizeObserver 콜백 안에서는 **레이아웃을 바꾸지 말 것**(class 토글·observe·style).
  바꿔야 하면 `requestAnimationFrame` 으로 미룬다.

## 검사

`tests/health-noise-quiet.test.js` 11건 — pu-health 를 vm 에서 «진짜로 돌려» 본다.
이빨 확인 **11/11**.

## 곁들여 확인한 것

- 콘솔의 「재무 0」은 숫자 0 이 아니라 **O(있음)** 이다 — 정상.
- `pu-erp.html` 의 옛 오류 「(dbGet(...) || []).forEach is not a function」(5건)은
  번호 없는 항목이 섞인 지도를 `normalizeFbValue` 가 객체로 되돌리던 것 — 어제
  `fix/noid-strands-table` 로 이미 끊었다.
