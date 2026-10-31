상태: 완료

# 리멤버 확장 자동 갱신 (2026-10-31, 대표 「자동갱신」)

- 문제: 확장은 PC 폴더(C:\pu-remember-ext)에서 읽어 쓰는 방식이라 코드를 고칠 때마다 대표가 chrome://extensions 새로고침을 눌러야 했다.
- 구성: ① PC 예약 작업 `푸른 리멤버 확장 갱신`(30분마다) 이 `node C:\pu-remember-ext\sync-ext.js` 를 돌린다 → ② 저장소 main 의 tools/remember-ext 를 gh 로 받아 검사 → ③ 설치 폴더를 바꾸고 ver.js 를 «맨 마지막에» 쓴다 → ④ 확장(bg.js selfUpdate)이 시계 때마다 ver.js 를 견줘 달라졌으면 chrome.runtime.reload().
- 안전장치(걸리면 아무것도 안 바꾸고 멈춤, sync.log 에 이유): 받기 실패(반쪽 판 금지) · 문법 오류 · manifest 권한/적용 주소가 달라짐(사람이 확인).
- 열린 탭의 다리가 끊기는 것은 bg.js 가 탭을 새로 불러 이어 붙인다(#2812, #2827).
- 한 번은 손으로: 이 판의 bg.js 가 들어간 뒤 chrome://extensions 새로고침 1회(자동 재시작 코드가 처음 들어가는 순간이라).
- 권한을 늘려야 하는 수정은 자동으로 안 들어간다 — sync.log 의 「사람이 확인해야 합니다」를 보고 직접 새로고침.