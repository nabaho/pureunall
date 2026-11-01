상태: 완료

# 2026-11-01 · 건의함 폰 알림 — 감시 알림 + [🔔 테스트]

대표 지시: 「건의함에 건의 내용 올라오면 폰에서 건의함이 올라왔음을 알림으로」 → (이미 있음을 확인해 보고하고 두 가지를 제안) 「둘다」

## 먼저 확인한 것
- 새 건의 → 관리자 폰 알림(`notifySuggestion`)은 예전부터 있고 정상. 10/27 두 건 모두 2대 성공·실패 0. 관리자 기기는 PC 크롬 + 안드로이드 크롬(10/9 등록).
- 본인이 올린 건의는 본인에게 알림이 안 간다(`exceptUid`) — 대표가 직접 올려 시험하면 안 울리는 것이 정상.

## 한 것
1. **건의함 감시 알림** — `scripts/suggestion-watch.js notify <id> --kind pr|decide|human|done --text "한 줄"` →
   `suggestions_private/{id}/watchNotice/{새키}` 에 쓰면 서버 함수 `notifySuggestionWatch` 가 관리자 폰으로 보낸다
   («수정안 준비됨 · 대표 결정 필요 · 사람 확인 필요 · 답변까지 끝났습니다»). 예약 작업의 알림은 앱의 알림 도구가 있을 때만 갔는데,
   이제 무인 실행에서도 닿는다.
2. **[🔔 테스트] 단추**(건의함 머리, 관리자에게만) — `pucards/config/pushTest/{내 uid}` 에 요청을 쓰면 `pushSelfTest` 가
   내 등록 기기 «모두»로 시험 알림을 보내고 결과를 같은 자리 `done` 에 적는다. 화면은 그것을 읽어 「N대로 보냈습니다 / 기기 없음 / 실패 /
   연타 / 15초 안에 답 없음」을 각각 다른 말로 알려 준다.

## 안전
- **새 규칙·새 최상위 자리가 없다** — 이미 열린 자리(suggestions_private 아래 · pucards/config 아래)만 쓴다. 보안규칙을 올리지 않고 함수만 올린다.
- 두 자리는 직원도 쓸 수 있다(새 건의에 아래 칸을 함께 담을 수 있고, pucards/config 는 로그인 누구나) → 함수가 «쓴 사람»을 본다:
  감시 알림은 관리자·관리 도구만, 시험은 «본인 열쇠 + 관리자»만. 직원이 대표 폰에 아무 글자나 울릴 수 없다.
- 시험은 15초 안 연타 거절, done.req 로 «한 번만»(done 을 쓰는 것에 함수가 다시 깨어나도 안 되풀이).
- 등록 단추(`pushRefresh`)에는 관리자 가림막을 안 넣었다 — 시험 단추 줄만 따로(`pushTestRefresh`). 직원 알림 등록 길(push-open-to-staff 검사)을 지킨다.

## 검사
- `tests/suggestion-push.test.js`(함수 12) · `tests/suggestion-push-button.test.js`(화면 8) · `tests/suggestion-watch.test.js`(notify 규칙 포함).
- 돌연변이 4종(신뢰 확인 끔 · 본인만 끔 · 한 번만 끔 · 15초 시한 뺌)이 모두 빨갛게 변하는 것 확인. 전체 묶음 통과.

## 남은 일 / 모르는 것
- ⚠ **함수는 합쳐도 저절로 안 올라간다** — 합친 뒤 `functions:notifySuggestionWatch,functions:pushSelfTest` 를 올려야 한다. 안 올리면 [🔔 테스트] 는 15초 뒤 「함수가 안 올라갔다」고 말한다.
- 폰 화면에 알림이 실제로 떴는지는 서버가 못 본다 — [🔔 테스트]를 폰에서 눌러 확인.
