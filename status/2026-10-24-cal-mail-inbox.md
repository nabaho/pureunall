상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-cal-inbox (가지 feat/cal-mail-inbox)

# 2026-10-24 · 푸른 캘린더 «일정 후보함» — 받은 메일에서 일정을 뽑아 후보로 쌓는다 (feat/cal-mail-inbox)

대표 질문: 「폰에서 통화·운전 중에 메일·문자·카톡으로 온 것을 일정표에 넣어야 할 때가 잦다 — 자동화?」
→ 추천안(운전 중엔 폰을 안 만진다) → 「추천대로」 → 목업(저장소 밖) 승인 → 「진행」.

## 합의한 것 (목업 기준)
- **메일부터**(문자·카톡은 다음 걸음) · **폰 알림 끔** · **저절로 달력에 넣지 않는다**.
- 서버가 «일정이 있어 보이는 새 받은메일»만 골라 AI 로 일정 초안을 뽑아 **후보함**에 쌓는다.
  달력 머리 「📥 후보 N」 → 메일별 후보 → [✔ 이대로 넣기](확인할 것이 없고 같은 날 비슷한 일정이 없을 때만) · [✏ 고쳐서 넣기] · [일정 아님].
- 같은 날 구글 공용 달력에서 같은 기관·업체 낱말이 겹치는 일정이 있으면 「기존 일정 고치기」를 먼저 권한다(다른 달 일정도 열린다).
- 「고쳐서 넣기」는 «새 일정 창»이 채워진 채로 열린다 → 주소 확인·연락처 확인(#2678)이 그대로 붙는다.

## 설계 결정 (코드와 같다)
- **본문은 저장하지 않는다.** 동기화 때 받는 본문은 앞 800바이트뿐(PREVIEW_BYTES) → 후보 메일에 한해 그 자리에서
  글 6KB·html 14KB 를 더 받아 AI 에 보내고 버린다. 남는 것은 초안 칸(제목·날짜·시각·장소·담당자·메모)뿐.
- **AI = 기존 판독 열쇠(Gemini, 금고 GEMINI_KEY) + 월 요금 한도(readDoc 과 같은 셈) + 앱 이름 `cal`.**
  한 회차 8건 · 하루 40건(`pucards/config/calInbox`) · 요금 한도를 넘으면 «멈춤» 표시(`cal_inbox/state.paused`).
- **기본 꺼짐** — `pucards/config/calInbox.on === true` 여야 돈다. (메일함이 한 계정이라 «메일함 허용 목록»은 두지 않았다 — 받은메일함 종류만 본다.)
- 후보 자리 = **새 최상위 `cal_inbox`**: 읽기 **관리자(대표)만** · 서버만 씀 · 브라우저는 `cand/{id}/status` 한 칸만(new→added|dismissed).
  ontology: `cal` 의 primaryRoots 에 올림. 문자열 한 칸 set 은 쓰기 관문을 지난다(선언 불필요 — pu-ontology-write.js).
- 광고·자동발송(noreply 등)·날짜도 일정 낱말도 없는 메일은 AI 로 안 보낸다. 주민번호 꼴은 보내기 전에 가린다.
- 날짜·시각 걸러내기 규칙은 화면(캡처 기능)과 **한 벌**: `js/pu-cal-capture.js` → `functions/cal-lib/` 사본(`node scripts/sync-cal-lib.js`) · `tests/cal-inbox.test.js` 가 글자까지 견줌.

## 끝낸 것
- `functions/cal-inbox.js` — 거르개 · 본문 더 받기 · 프롬프트(메일 받은 날 기준) · 한도 · 후보 적기 · 30일 정리. 어떤 고장에도 던지지 않는다.
- `functions/mail-sync.js` — 받은메일함 «새 줄» 처리 뒤에 끼움(실패해도 동기화 계속) + syncMailbox 금고에 GEMINI_KEY.
- `functions/mail-box.js` — `previewFrom(buf, tp, max)` 길이 인자(안 주면 140자 그대로).
- `js/pu-cal-capture.js` — `promptForMail` 추가. 사본 `functions/cal-lib/pu-cal-capture.js`.
- 규칙: `scripts/make-firebase-rules.js` `rules.cal_inbox` — **콘솔에 올렸다**(2026-10-24, 새 규칙 1 · 바뀐 것 0 · 사라진 것 0, 다시 읽어 확인, 콘솔 원문 기준 파일 갱신).
  짝 검사: `tests/perf-rules.test.js` allowTop · `docs/rules-paste.json`(+전체 적용본) · `js/pu-ontology.js` primaryRoots.
- 화면 `pu-cal.html` — 📥 후보 단추(칩 줄 · 폰 머리, 대표만, 한 번도 안 돈 기능은 숨김) · 후보 시트 · 이대로/고쳐서/기존 고치기/일정 아님 ·
  저장이 «성공한 뒤»에만 «넣음»(네 군데) · `openGcalEdit(gid, 일정객체)`.
- 검사: `tests/cal-inbox.test.js` 24 · `tests/cal-inbox-screen.test.js` 27. 서버 8곳·화면 9곳을 일부러 망가뜨려 잡히는지 확인(두 곳은 검사를 보강).
- 폰 폭(430px) 화면을 로컬에서 그려 확인(가짜 후보 3건).

## 사람이 할 일 (이 방은 하지 않는다 — 되돌리기 어렵거나 실제 메일이 AI 로 나가는 일)
1. **함수 배포** — `firebase deploy --only functions:syncMailbox --project pureun-erp` (금고 GEMINI_KEY 연결 포함). 이 PR 이 합쳐진 뒤.
2. **켜기** — 켜기 전에는 아무 일도 안 한다. 켤 때(PowerShell, 안쪽 따옴표 앞 `\` 필수):
   `firebase database:set /pucards/config/calInbox --data '{\"on\":true,\"perRunMax\":8,\"dayLimit\":40}' --project pureun-erp --force`
   끄기: 같은 자리 `on:false` (또는 `firebase database:remove /pucards/config/calInbox`).
3. **켠 뒤 첫 날 확인** — 로그에 `cal-inbox {"ran":true,...}` 가 찍히는지 · 달력 머리에 📥 가 뜨는지 · 후보 정확도(날짜·시각·장소) 몇 건 눈으로 대조.
4. **개인 메일 내용이 AI(구글)로 나간다는 점을 아시고 켜는 것** — 일정 낱말·날짜가 있는 새 받은메일만, 본문 앞부분만, 저장은 안 함.

## 다음 걸음
- 문자(하나문자 앱 수집 범위 확대) · 카톡(방 알림이 0건인 문제부터) 후보 — 같은 후보함에 쌓는 «출처» 칸만 늘리면 된다.
- 후보함에서 «메일 보기» 바로가기(메일함 화면이 쪽지 주소를 받게 되면).
- 직원 메일/직원별 후보함은 의도적으로 안 했다(처음엔 대표님만).
