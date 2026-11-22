# 2026-11-17 · fix/remember-kick-disabled — 리멤버 갱신기가 «꺼진 확장»을 30분마다 깨우던 것

## 무엇이 문제였나
- 대표 PC 에 「echjoldfbpgmbmnmdklllkomlfjkjiio이(가) 차단됨 · ego에서 차단한 페이지입니다 · ERR_BLOCKED_BY_CLIENT」 창이 계속 떴다.
- 그 번호는 「푸른 리멤버 연결」 확장(`C:\pu-remember-ext` 에서 불러온 압축해제 확장)이다.
- 에고라이트 «Profile 1» 에서 이 확장이 꺼져 있었다(`disable_reasons: [16777216]`, 개발자 모드 꺼짐으로 보임). 같은 확장이 크롬 «Default» 에서는 켜져 있다.
- 예약 작업 「푸른 리멤버 확장 갱신」(sync-ext.js)은 30분마다 «늦음»을 보고 kick.html 을 열었다. 이때 꺼졌는지 보지 않고 에고라이트를 먼저 골랐다. 깨우기 횟수에 끝도 없었다. sync.log 기록으로는 11/11~17 하루 7~39번 창이 떴다.

## 고친 것 (`tools/remember-ext/sync-ext.js`)
- `findExt()` 는 꺼진 프로필을 건너뛰고 «켜진» 곳을 먼저 돌려준다. 꺼진 곳밖에 없으면 `off: true` 로 돌려준다. 꺼진 곳 목록은 `offIn` 에 담는다.
- `kickPlan()` 은 꺼진 확장이면 열지 않고 까닭만 남긴다.
- `decide()` 는 확장이 꺼져 있으면 깨우지 않고 곧바로 `alert:off`(켜는 법)를 올린다. 깨우기는 한 번 멈춤에 2번까지 25분 간격, 그 뒤로는 3시간에 한 번만 한다.
- 장애 알림 문구에 «꺼짐»을 넣었다. 프로필 이름은 `Local State` 에서 읽고 박지 않는다.
- main 쪽 작업 폴더에 커밋 안 된 채 있던 갱신기 견고성 수정 두 줄(`isLate` 의 수 판정, `watch.json` 이 null 일 때, 알림 실패 시 alerted 되돌리기)도 함께 실었다. 설치본이 이미 그 판이었다.

## 설치
- `C:\pu-remember-ext\sync-ext.js` 에 손으로 복사했다(갱신기는 스스로 안 바뀐다). 옛 것은 `sync-ext.js.bak-20261117` 로 남겼다.
- 이 PC 에서 `findExt()` 는 크롬 Default(켜짐)를 찾는다. 꺼진 곳은 에고라이트 Profile 1 이다. 그래서 이제 에고라이트에 차단 화면을 열지 않는다.

## 사람이 할 일
- 에고라이트에서 다시 쓰려면 `ego://extensions` → 개발자 모드 켜기 → 「푸른 리멤버 연결」 켜기.
- 리멤버 동기화는 11/17 00:00 뒤로 멈춰 있다. 크롬 쪽 확장이 켜져 있는데도 안 도는 까닭은 아직 못 봤다(「리멤버 점검」 몫).

## 검사
- `tests/remember-ext-watch.test.js`·`tests/remember-ext-browsers.test.js` 에 5건을 더했다. 리멤버 검사 다섯 묶음 55건이 통과한다.
- 변이 6개(꺼진 확장 깨움·상한 없음·꺼짐 알림 없음·꺼진 곳을 켜짐으로·계획이 꺼짐 무시·회복 뒤 횟수 유지)를 모두 잡았다.
