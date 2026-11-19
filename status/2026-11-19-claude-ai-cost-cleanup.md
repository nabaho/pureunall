# 2026-11-19 — AI 비용 정리 5가지 (`claude/ai-cost-cleanup`)

## 왜
- 대표가 «무료 API 크레딧으로 돌리고, 어디에 어떤 AI 를 쓰는지·비용·토큰을 다시 검토하라»고 지시했다.
- 그래서 «푸른통합 AI 비용표»(약 70곳, 기능별 1회·월 토큰과 비용)를 만들었고, 그 페이지에 «코드 정리 5가지»를 적었다.
- 대표 「지금」.

## 한 것
1. **종료된 모델 빼기** — 사진 지우개(`functions/photo-edit.js`)의 둘째 모델 `gemini-2.5-flash-image-preview` 는 2026-01-15 에 종료돼 늘 404 로 헛걸음만 했다. 뺐다.
   - `gemini-2.0-flash` 는 이미 코드에 없었다(주석·검사에만 남음).
   - 첫째 `gemini-2.5-flash-image` 도 2027-03-15 종료 예정이다. 구글 안내 대체는 `gemini-3.1-flash-lite-image` 인데, 단가·이름을 원문으로 확인하지 못해 넣지 않았다.
2. **두 번 부르기 막기**
   - 경력관리 끌어놓기 판독(`kcareer.html`): Gemini 가 읽은 뒤에도 열쇠만 있으면 Vision·Claude 를 또 불렀다. 이제 `!_ocrGot(parsed)` 일 때만 부른다.
   - 사진첩(`pu-photos.html`): 한 장짜리 서류는 «무료 판독(사업자등록증 규칙)»으로 Vision 을 한 번 쓰고, 못 끝나면 서버 «무료 글자 먼저»가 같은 사진을 또 Vision 에 보냈다. 그래서 달 무료 1,000장이 절반으로 줄었다.
     - `freeOcrRan()` 이 «이미 보냈나»를 가린다. 보냈으면 `freeFirst:false` 로 서버 Vision 을 건너뛴다.
     - `imgChunkMakers` 는 부르는 쪽 값을 덮어쓰지 않게 했다.
     - 화면만 바뀌므로 서버 배포가 필요 없다.
3. **출력 기본 상한** — `functions/doc-read.js` `geminiBody` 는 부르는 쪽이 `maxOutputTokens` 를 안 주면 상한이 없었다(모델 최대 6만+ 토큰, 생각 토큰도 출력 요금). 이제 부르는 쪽이 줄 수 있는 최대(`MAX_OUTPUT_TOKENS` 8,192)를 기본으로 건다.
4. **기금 지식 챗봇 모델** — 질문마다 «자동»으로 가장 비싼 Opus 5.5 를 불렀다. 이제 `AI_MODELS_QUICK = ['claude-haiku-5-5','claude-sonnet-5-5']` 를 쓴다(`aiCall(…, {models})`). 서식 고치기는 그대로 Opus 5.5 → Sonnet 5.5 다.
5. **달 금액을 실제 토큰 원화로**
   - 여태 «부른 횟수 × ₩4» 로 셌다. 그래서 2만 자 계약서·30분 녹음도 ₩4 로 잡혔다.
   - 이제 Gemini 답의 `usageMetadata`(입력·출력·생각·음성 토큰)와 모델 단가표(`GEMINI_PRICE_USD`, 환율 `KRW_PER_USD` 1400)로 `wonOfUsage` 가 원화를 센다.
   - 셈 자리에 `won`(원화 합)·`wn`(원화로 센 판독 수)을 더 쌓는다(`bumpSpend` — Gemini 판독 셈 자리 6곳 모두).
   - 달 금액은 `aiSpentWonOf` = `(n − wn) × 단가 + won` 이다. 서버(`doc-read.js`)와 화면(`js/pu-billing.js`)이 같은 식이고, 사진첩·포털은 화면 쪽 하나를 부른다.
   - 옛 기록·원화를 못 센 판독(사진 지우개 등)은 예전처럼 횟수 × 단가다. 판독 «횟수»(n) 표시는 그대로다.
   - 실시간DB 규칙에 `won`·`wn` 칸을 적었다(서버만 쓰는 자리, 읽기 범위는 그대로).
   - `js/pu-billing.js?v=13`(포털·이알피·사진첩).

## 검사
- 새로 `tests/ai-cost-cleanup.test.js` 를 만들었다. 다섯 가지를 모두 보고, 원화 셈은 손계산 값과 서버·화면 일치를 견준다.
- `tests/vision-proxy.test.js` 의 셈 갈래 목록 고정(`['n','quota','vision']`)을 «기본 셋이 있고 갈래마다 규칙 칸이 있다» 규칙으로 바꿨다.

## 배포·남은 것
- **서버 함수 배포가 있어야 ①③⑤ 가 실제로 돈다.**
  - GitHub 「Firebase 배포」를 손으로 돌린다: `readDoc`·`photoEdit`·`suggestionAssist`·`recruitWatch`·뉴스레터·`syncMailbox`·`mailContractSweep` 등.
  - 대표 확인 뒤에 한다. 배포 전에는 ②④ 와 화면 셈만 바뀐다.
  - 서버가 원화를 쌓기 전까지는 `won`·`wn` 이 없어 예전 금액과 같다.
- 실시간DB 규칙(`won`·`wn` 칸) 게시: `node scripts/rules-deploy.js --deploy`. 서버만 쓰는 자리라 급하지 않다. PR 이 합쳐진 뒤 main 에서 올린다.
- 실제 AI 를 불러 보지는 않았다(요금). `usageMetadata` 꼴은 구글 문서 기준이다.
- 비용표의 «한 달 비용»은 가정이다. 서버 주석의 2026-09 실측은 «월 ₩1,000~3,500» 이었다.
