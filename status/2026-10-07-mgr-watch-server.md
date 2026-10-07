# 2026-10-07 · 담당 변경 감지를 서버로 (점검 ③-B)

가지: `feat/mgr-watch-server` · 기업정보함 점검 ③.

- 셈을 `js/pu-mgr-watch-core.js` «한 벌»로 떼고(`scripts/sync-mgr-watch-core.js` → `functions/mgr-watch-core/`),
  서버 함수 `mgrWatch`(업무 시간 10분마다, `functions/mgr-watch.js`)가 `pucards/config/mgrSeen·mgrChange` 를 적는다.
  예전에는 대표님 PC 에서 메일 화면이 열려 있을 때만, 로그인 때 읽은 옛 업체 목록으로 셌다.
- 화면(`mgrWatchRun`)은 이제 «읽기만» — 서버가 적은 바뀐 것을 다시 읽어 새로 생겼으면 알린다.
- 검사: `tests/mgr-watch-core-in-sync.test.js`(사본 같음·서버 실제로 돌림·배포 목록), `mail-owner-check` 손봄.

## 배포 — 끝 (2026-10-07)

#2137 합친 뒤 `firebase deploy --only functions:mgrWatch` 로 올렸다(asia-northeast3, 새로 만듦).
⚠ `js/pu-mgr-watch-core.js` 를 고치면 sync 를 돌리고 이 함수를 «다시» 올려야 서버에 반영된다.

## 미룬 것 — 메일로 업체 담당자 채우기(③-A)

화면 상태에 묶인 셈이 많고(메일 사본·명함 색인·스팸 판정), 서버가 처음으로 업체 기록을 쓰게 된다 — 3~5일.
먼저 Core 분리 PR 이 필요하다. 중간안: 서버는 후보만 적고 채우기는 대표 PC 가.
