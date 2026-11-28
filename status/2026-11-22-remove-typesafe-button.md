상태: 완료(PR 대기)
가지: claude/remove-typesafe-button

# 포털 「✨ TypeSafe 검토」 단추를 걷어낸다 — Jev 는 받은메일함 자동분류에만 남긴다 (2026-11-22)

대표 지시: 「타입세이프 필요한지 확인하고 … 필요 없으면 삭제해 달라. 차라리 LAYA 라는 프로그램을 검토해 봐라 … 지금 이거 필요 없으면 완전히 덜어내고 유사한 프로그램 있으면 그쪽으로 가는 게 더 나을 것 같다」

## 먼저 잰 것 — Jev(TypeSafe, 미국 업체 판단 모델)를 쓰는 곳은 셋이었다
| 쓰는 곳 | 상태 | 결정 |
|---|---|---|
| ① 포털 머리줄 「✨ TypeSafe 검토」(`js/pu-typesafe.js` + 서버 `typeSafeEvaluate`) | 관리자만 · 글을 붙여 넣으면 긴급도·경로·기한 등 9가지 «제안»만 · 미국 서버 확인란 · 하루 30번 | **걷어냄** — 저장·처리와 이어지지 않는 «제안 창»이고, 같은 일은 길잡이 챗봇·Claude 가 한국어로 더 잘 한다. 글이 국외로 나가는 길 하나가 줄어든다 |
| ② 푸른 메일 받은메일함 자동분류(`functions/mail-ai-classify.js`, `syncMailbox`·`pullMailbox`) | 2026-10-04 대표 「켜라」로 켜져 실제로 돈다(2026-11-05 실측 236통) | **남김** — 지금 일하고 있다. 지우면 받은메일함 자동분류가 멈춘다 |
| ③ 경력관리 «요청 메일» Jev 분류(서버 `mailReqScope`, `functions/mail-req-scope.js`) | 2026-11-19 부터 화면이 부르지 않음(애매한 건은 처음부터 거름 · Laya 의견으로 바뀜) | **걷어냄**(코드) |
| (덤) `tools/jev-mcp` — Codex·Claude 용 Jev MCP | 이 PC 의 Claude·Codex 설정 어디에도 등록돼 있지 않음 | **걷어냄** |

- 실제 사용 횟수(`typesafe_tally`)는 **못 읽었다** — 서버 DB 읽기가 자동 모드에서 막혔다(우회하지 않음). 판단은 코드·기록(`status/`)으로 했다.

## Laya 로 옮기는 게 나은가 — 아니다 (지금은)
- Laya(ConvAI Innovations, Apache-2.0)는 Jev 와 «같은 꼴»(물음+후보 → 고르기)의 **무료·이 PC 안** 판단 모델이다. 2026-11-19 이 PC 에 깔려 있다(127.0.0.1:18766, 경력관리 «🧠 Laya 의견»).
- 하지만 **한국어 판단이 약하다** — 실제 요청 메일 64건으로 재 봤을 때 진짜 요청 6건 중 3건을 «업무»로 봤다(`status/2026-11-19-kcareer-laya-judge.md`). 그래서 경력관리에서도 «의견»만 적고 메일을 옮기지 못하게 했다.
- **대표 PC 에서만 돈다** — ① 단추(폰·다른 PC)도, ② 메일 자동분류(서버에서 10분마다)도 대신할 수 없다. 메일 분류를 Laya 로 옮기려면 PC 가 늘 켜져 있어야 하고 정확도도 떨어진다.
- Laya 에는 영어 위주의 «typed-decisions» 판도 있으나 한국어로 재 본 적이 없다 [확인 필요] — 옮기려면 먼저 실제 자료로 재 봐야 한다(대표 허락 필요).

## 한 일
- `enter.html`: 머리줄 단추 CSS · 폰 ⋯ 목록(`DOCK_IDS`)의 단추 id · `pu-typesafe-mounted` 지켜보기 · `PU_TYPESAFE_MOUNT` · `js/pu-typesafe.js` 싣기를 뺐다. 챗봇 지식 `?v=17→18`.
- 지운 파일: `js/pu-typesafe.js` · `functions/mail-req-scope.js` · `tools/jev-mcp/*` · 시험 `typesafe-consent-gate`·`typesafe-drag`·`typesafe-guardrails`·`typesafe-local-redact`·`mail-req-scope`.
- `functions/index.js`: `typeSafeEvaluate`·`mailReqScope` 와 그 둘만 쓰던 도우미(`typeSafeDayLeft`·`typeSafeIsAdmin`·`bumpTypeSafeTally`) 122줄을 덜고 «왜 없나» 주석 한 덩어리.
- `functions/typesafe-evaluate.js`(메일 자동분류가 쓰는 공용 길): 단추 전용 9가지 검토 물음(`questions()`)·사람별 하루 셈(`tallyPaths`·`leftOf`·`overLimitError`)을 뺐다. **물음(qs) 없이 부르면 업체에 아무것도 보내지 않는다**(`hasQuestions`) — 빈 물음으로 글만 미국 서버에 남기지 않게.
- `functions/mail-ai-classify.js`: 동작은 그대로, 주석만(이름 가림 함수가 이제 «하나뿐인 원본»).
- `js/pu-chatbot-kb.js` 이름표 `TypeSafe` · `pu-erp.html`·`js/kcareer-mailreq.js` 주석 · `docs/kcareer-요청메일.md`(mailReqScope 는 코드에서 걷어냈고 배포본은 남아 있음).

## 검사
- `tests/mail-ai-classify.test.js`: 지운 `js/pu-typesafe.js` 와 «바이트까지 같다»를 견주던 검사를 **값으로 직접** 보는 검사 셋으로 바꿈(가려짐·같은 표·긴 이름부터·한 글자 안 가림·목록 밖은 그대로). ⑨ 는 «물음 없이 업체를 부르지 않는다»로.
- `functions/typesafe-evaluate.test.js`: 물음 없이는 안 보냄 · 준 물음이 그대로 실림 · 기본 물음이 되살아나지 않음.
- 화면: `node tools/phone-audit/run.mjs portal --widths=1366,411` — 옆넘침·화면밖·두줄단추 모두 0, 머리줄에서 단추가 빠진 것 확인.

## 남은 일 (숨기지 않는다)
- **클라우드에 배포된 함수 둘(`typeSafeEvaluate`·`mailReqScope`)은 그대로 살아 있다** — 이 저장소 배포는 «이름을 찍어서만» 올려서, 코드에서 지워도 클라우드에서 안 지워진다.
  관리자 로그인 증표로 직접 부르면 아직 Jev 에 글이 나갈 수 있다. 지우려면(대표 승인 뒤): `firebase functions:delete typeSafeEvaluate mailReqScope --region asia-northeast3 --project pureun-erp`.
- 서버 금고의 `TYPESAFE_API_KEY` 는 **그대로 둔다** — ② 받은메일함 자동분류가 쓴다.
- 실시간DB 의 옛 셈 자리 `typesafe_tally/`·`typesafe_tally_mailreq/`(숫자만)는 지우지 않았다(원본 자료 지우기는 대표 승인 대상).
