# 「계속 문제가 발생한다」 — 콘솔이 빨갛던 것을 가려 보니

대표 제보 2026-09-16 (콘솔 화면). 가지 `fix/staff-colors-no-fallback-push`
고친 곳 `pu-erp.html`(색표 올리는 자리, meta) · `pu-camera/pu-photos/work.html`(meta)

## 먼저 — 무엇이 «우리 것»이 아니었나

콘솔의 빨간 것 넷 가운데 **셋은 크롬 확장프로그램**, **하나는 브라우저 캐시 동작**이었다.
서버 장애 기록(`systemAlerts` 338건)을 뒤져 확인했다 — **둘 다 장애로 «0건» 세어졌다.**

| 콘솔에 뜬 것 | 정체 | 장애로 세어졌나 |
|---|---|---|
| `A listener indicated an asynchronous response…` ×3 | 크롬 **확장프로그램**이 내는 것 | 0건 |
| `WebSocket … failed: Page entered Back-Forward Cache` | 뒤로가기 캐시로 들어가며 끊김. 돌아오면 다시 붙는다 | 0건 |

아직 «열린» 장애는 **7건뿐이고 전부 ResizeObserver** — #1373 에서 이미 걸러 배지에 안 뜬다.
**즉 우리 앱이 새로 내는 «고장»은 없었다.** 다만 아래처럼 우리가 내는 «잔소리»는 있었고, 그것이
콘솔을 붉게 보이게 해 판단을 가렸다.

## 진짜로 고친 것 — 직원 색표

켤 때마다 이 세 줄이 찍혔다:

```
[동기화보호] 초기 동기화 완료 전 — staff_colors 서버 쓰기 보류 (로컬만 저장)   ×2
[동기화보호] 보류됐던 staff_colors 재저장 (보호로직 경유)
```

### 왜

법인 대시보드는 사람 색을 **구글 캘린더 색표**(`gcalPalette`)에서 가져온다. 그 색표는 **늦게 온다** —
오기 전까지는 `STAFF_COLORS_FALLBACK`(순번 색)을 쓴다. 화면에 잠깐 쓰라고 둔 «되돌아갈 색»이다.

그런데 색을 서버에 올리는 자리가 그 사정을 몰랐다. 켜자마자
① 되돌아갈 색으로 색표를 만들고 ② 아직 서버 것을 못 받았는데 `dbSet` 을 불렀다.
`dbSet` 은 「초기 동기화 완료 전」이라 막아 두지만, **그 보류분은 동기화가 끝난 뒤
`_flushPendingLocalNewer` 가 그대로 서버로 민다.**

- 켤 때마다 **쓸 일 없는 서버 쓰기가 한 번씩** 나갔다(실측: `data/staff_colors` 의 `u` 가 오늘 08:50).
- **색표가 끝내 안 오면**(구글 연결 안 됨·오프라인) 되돌아갈 색이 서버에 남는다.
  `data/staff_colors` 는 사람 색을 «정하는 한 곳»이라 **컨설팅일정의 색까지 함께 틀어진다.**

### 고친 것 — 두 줄

```js
if(!_fbSynced) return;                                  // 서버 것을 받기 전에는 판단하지 않는다
var _palReady = (typeof gcalPalette === 'function') && !!gcalPalette();
if(!_palReady && Object.keys(was).length) return;       // 되돌아갈 색으로 «있는 것»을 덮지 않는다
```

⚠ **아직 아무것도 안 올라가 있으면 되돌아갈 색이라도 올린다** — 구글을 안 쓰는 관리자가
색을 영영 못 올리게 되면 안 된다. (검사 ③ 이 이것을 지킨다.)

## 곁들여 — 크롬 deprecated 경고

`<meta name="apple-mobile-web-app-capable">` 만 있어 크롬이 켤 때마다 경고를 찍었다.
표준 `<meta name="mobile-web-app-capable">` 을 나란히 달았다(아이폰은 apple- 를 보므로 둘 다 둔다).
`pu-erp` · `pu-camera` · `pu-photos` · `work` — `kcareer` 는 이미 있었다.

## ⚠ 남겨 둔 것 — 왜 안 고쳤나

`[온톨로지 저장 감시]` 경고 둘(`data/staff_colors` 직접 transaction · `presence/…/lastSeen` 부분 update).

- 감시(`js/pu-ontology-write.js`)는 **모든 저장을 훑는다 — 자리 가림이 없다.** 그래서 색표·접속표시처럼
  «업무 기록이 아닌» 자리까지 걸린다. 좁히려면 모든 앱이 쓰는 공용 안전장치를 건드려야 해서
  그 일은 **따로** 해야 한다(잘못 좁히면 진짜 위반이 조용히 통과한다).
- `presence/…/lastSeen` 은 **요금을 줄이려고 일부러 한 칸만** 쓰는 것이고
  `tests/erp-presence-heartbeat.test.js` 가 그것을 못 박고 있다. 경고 한 줄 때문에 바꾸지 않았다.

## 검사

`tests/staff-colors-no-fallback-push.test.js` 8건 — 실제 코드 토막을 꺼내 가짜 저장소에서 돌려 본다.
이빨 확인 **8/8**.

⚠ 검사 ① 은 처음에 이빨이 없었다 — 「색표가 안 온 경우」로 재니 ② 가 대신 막아 주어,
`_fbSynced` 검사를 통째로 빼도 통과했다. **색표는 왔는데 서버는 아직 못 받은** 경우로 바꿔야 문다.

## 곁들여 고친 검사 하나 — 「앞 900자」로 끊던 창

`tests/staff-color-one-place.test.js` 는 색표 올리는 자리를 **「`dbSet` 앞 900자」**로 끊어 보고 있었다.
이번에 그 자리에 주석이 늘자 **지키던 줄이 창 밖으로 밀려나, 코드는 멀쩡한데 검사가 깨졌다.**

→ 글자 수 대신 **그것을 감싼 `useEffect`** 로 끊게 바꿨다. 지키는 내용은 한 글자도 안 줄였고,
되돌려 막아 보니 **2/2 로 여전히 문다**(관리자 확인 빼기 · 「같으면 안 쓴다」 빼기).

⚠ 글자 수·줄 수로 창을 끊는 검사는 «언젠가» 이렇게 깨진다 — 문법 경계로 끊을 것.
(CLAUDE.md 「지금 값이 아니라 규칙을 못 박는다」의 같은 얼굴이다.)
