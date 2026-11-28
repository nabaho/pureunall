상태: 완료
가지: claude/typesafe-functions-deleted

# 클라우드에 남아 있던 Jev 함수 둘을 지웠다 — typeSafeEvaluate · mailReqScope (2026-11-28)

대표 승인: 「네, 지워라」 (PR #3272 «남은 일» — 코드에서 지워도 배포본은 남는다는 것)

## 왜 따로 지워야 했나
이 저장소의 함수 배포(`firebase-deploy.yml`)는 «이름을 찍어서만» 올린다. 그래서 PR #3272(2026-11-22 합쳐짐)가
`functions/index.js` 에서 두 함수를 지워도 클라우드에는 그대로 살아 있었다 — 관리자 로그인 증표로 직접 부르면
글이 Jev(미국 업체)로 나갈 수 있는 상태였다.

## 한 일
- 지우기 전: 최신 main 에서 두 이름을 부르는 코드가 없는지 확인(주석 두 줄뿐) · 배포 목록에서 두 함수 확인(asia-northeast3).
- `firebase functions:delete typeSafeEvaluate mailReqScope --region asia-northeast3 --project pureun-erp` — 둘 다 «Successful delete operation».
- 지운 뒤: 배포 함수 목록 전후 대조 — 정확히 두 함수만 없어짐. 받은메일함 자동분류가 쓰는 `syncMailbox`·`pullMailbox` 는 그대로.
- 문서 `docs/kcareer-요청메일.md` 의 «배포본이 남아 있다» 두 곳을 «지웠다»로(코드는 안 바꿈 — `tests/kcareer-mailreq-doc.test.js` 는 문서에 `mailReqScope` 기록이 있는지만 보므로 그대로 통과).

## 그대로 둔 것
- 서버 금고 `TYPESAFE_API_KEY` — 받은메일함 자동분류(mail-ai-classify)가 쓴다.
- 실시간DB 의 옛 셈 자리 `typesafe_tally/`·`typesafe_tally_mailreq/`(날짜별 숫자만) — 원본 자료 지우기는 따로 승인받을 일이라 두었다.
