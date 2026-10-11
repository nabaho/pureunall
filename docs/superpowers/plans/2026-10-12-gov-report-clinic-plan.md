# 현장클리닉 별지11 수행계획서 칸 지도 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현장클리닉 보고서 창에서 별지14(현장지도결과서) 옆에 **별지11 현장클리닉 수행계획서**도 HWPX 로 채워 내려받게 한다(선정 후 7일 이내 시스템에 올리는 서류).

**Architecture:** 기존 `PuGovReport.FORMS.clinic.files` 에 두 번째 파일 `plan` 을 더한다(서산상의의 `visit`·`report` 와 같은 방식 — 보고서 창이 파일마다 내려받기 단추를 낸다). `buildValues('clinic')` 가 두 파일의 표지를 한 번에 만든다(새 표지 이름만 더함). 양식 서고 등록(`scal_rptForms/clinic/plan/2025`)은 합친 뒤 컨트롤러가 한다. **새 DB 칸·규칙 없음.**

**Spec/근거:** `docs/superpowers/plans/2026-10-12-gov-report-clinic.md`(별지14 작업, 같은 근거) + 운영지침 제22조(수행계획서 선정 후 7일 이내 제출·운영기관 승인 전 수행 불가). 별지11 양식 구조는 대표 PC 단독 양식 `C:\Users\fair0\OneDrive\바탕 화면\컨설팅업체\_작업_현장클리닉\clinic-plan.hwpx`(저장소 밖, 읽기 전용)에서 잰 주소.

## Global Constraints

- 기존 별지14(`main`) 칸 지도·값·검사와 다른 양식 3종 출력은 **그대로**. `FORMS.clinic.rounds` 는 그대로(min 1·max 3).
- 모르는 값은 비워 둔다(지어내지 않는다): 보고서에 없는 것(휴대폰·주 생산품·계약금액·추천 MD·분야 세분류·예상산출물)은 빈칸(`' '`). 체크 칸(MD 준수·수출/창업기업 Yes/No)·서명줄·«20 년도» 문장은 원문 그대로 둔다.
- 새 쓰기·규칙 없음. 공개 저장소: 실제 양식 파일 커밋 금지(검사는 합성 XML), 합성 이름만. 검사에 `?v=숫자` 금지, 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-consulting.html` 은 부분 편집·줄바꿈 보존.

## 칸 지도 (별지11 — 실제 양식 스캔에서 잰 주소, 그대로 쓴다)

```js
        /* 별지 11 현장클리닉 수행계획서 — 일정 칸 3묶음(일정·유형·내용 3줄·예상산출물 3줄). 대표 PC 단독 양식에서 잼(2026-10-12) */
        plan: {
          set: [
            { at: 'T0.C1.P0', tok: '업체명' }, { at: 'T0.C9.P0', tok: '업종' },
            { at: 'T0.C13.P0', tok: '담당자' }, { at: 'T0.C15.P0', tok: '직위' }, { at: 'T0.C17.P0', tok: '전화' },
            { at: 'T0.C21.P0', tok: '애로1' }, { at: 'T0.C21.P1', tok: '애로2' }, { at: 'T0.C21.P2', tok: '애로3' },
            { at: 'T0.C23.P0', tok: '테마' }, { at: 'T0.C29.P0', tok: '지원일수' },
            { at: 'T0.C31.P0', tok: '소속' }, { at: 'T0.C33.P0', tok: '지원단명' },
            { at: 'T0.C39.P0', tok: '계획일1' }, { at: 'T0.C40.P0', tok: '계획유형1' },
            { at: 'T0.C41.P0', tok: '계획내용1a' }, { at: 'T0.C42.P0', tok: '계획산출1a' },
            { at: 'T0.C43.P0', tok: '계획내용1b' }, { at: 'T0.C44.P0', tok: '계획산출1b' },
            { at: 'T0.C45.P0', tok: '계획내용1c' }, { at: 'T0.C46.P0', tok: '계획산출1c' },
            { at: 'T0.C47.P0', tok: '계획일2' }, { at: 'T0.C48.P0', tok: '계획유형2' },
            { at: 'T0.C49.P0', tok: '계획내용2a' }, { at: 'T0.C50.P0', tok: '계획산출2a' },
            { at: 'T0.C51.P0', tok: '계획내용2b' }, { at: 'T0.C52.P0', tok: '계획산출2b' },
            { at: 'T0.C53.P0', tok: '계획내용2c' }, { at: 'T0.C54.P0', tok: '계획산출2c' },
            { at: 'T0.C55.P0', tok: '계획일3' }, { at: 'T0.C56.P0', tok: '계획유형3' },
            { at: 'T0.C57.P0', tok: '계획내용3a' }, { at: 'T0.C58.P0', tok: '계획산출3a' },
            { at: 'T0.C59.P0', tok: '계획내용3b' }, { at: 'T0.C60.P0', tok: '계획산출3b' },
            { at: 'T0.C61.P0', tok: '계획내용3c' }, { at: 'T0.C62.P0', tok: '계획산출3c' },
          ],
        },
```
(`업체명`·`담당자`·`테마`·`소속`·`지원단명` 은 별지14 와 **같은 표지 이름** — `buildValues` 는 이미 만든다. 새 표지: 업종·직위·전화·애로1~3·지원일수·계획일k·계획유형k·계획내용k(a|b|c)·계획산출k(a|b|c).)

`buildValues(report,'clinic')` 에 더할 값(보고서 모델: `report.company {name,contact,contactTitle,tel,bizType}`, `report.rounds[] {date, visit, inquiry, diagnosis, advice, result, next}`, `report.summary {theme, inquiryDiag}`):

```js
      V['업종'] = str(c.bizType); V['직위'] = str(c.contactTitle); V['전화'] = str(c.tel);
      var wl = String(s.inquiryDiag == null ? '' : s.inquiryDiag).split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      for (var w = 0; w < 3; w++) V['애로' + (w + 1)] = wl[w] ? ' ' + '①②③'.charAt(w) + ' ' + wl[w] : ' ' + '①②③'.charAt(w);
      V['지원일수'] = use.length ? use.length + '일' : '';
      for (var pq = 0; pq < 3; pq++) {
        var pr = use[pq], ks = ['a', 'b', 'c'];
        V['계획일' + (pq + 1)] = pr ? koMd(pr.date) : ' ';           // 「10월 12일」 꼴 — 이 파일의 mdDate/koDate 중 맞는 것으로(원문 «월   일» 자리)
        V['계획유형' + (pq + 1)] = pr ? (pr.visit === true ? '현장' : (pr.visit === false ? '자료조사' : ' ')) : ' ';
        ks.forEach(function (k, ki) {
          V['계획내용' + (pq + 1) + k] = (pr && ki === 0) ? (str(pr.advice) || str(pr.diagnosis) || str(pr.inquiry) || ' ') : ' ';
          V['계획산출' + (pq + 1) + k] = ' ';
        });
      }
```
(`koMd` 는 자리 이름이다 — 파일의 기존 날짜 도우미(`mdDate`·`dotDate`·`koDate`)를 읽고 «월 일» 꼴을 만드는 것을 골라 쓴다. 날짜가 없으면 `' '`.)

AI/화면: `USES.clinic.plan`(AI 모듈 — 계획서가 읽는 칸: rounds `['inquiry','diagnosis','advice']`, summary `['theme','inquiryDiag']`)을 더해 «지도 대조» 검사가 통과하게 하고, 화면 파일 이름표(`GRP_FILE_KO`)는 현장클리닉에서 `main`→«현장지도결과서(별지14)», `plan`→«수행계획서(별지11)» 로 보이게(양식별 이름표 — 다른 양식의 `main`/`visit`/`report` 이름표는 그대로).

---

### Task 1: 별지11 칸 지도·값·화면·AI 대조

**Files:** Modify `js/pu-gov-report.js`, `js/pu-gov-report-ai.js`, `gov-consulting.html`, `tests/gov-report-fill.test.js`, `tests/gov-report-ai.test.js`, `tests/gov-report-ui.test.js`(필요하면); `STATUS.md`, `status/2026-10-12-gov-report-clinic-plan.md`

- [ ] **Step 1: 실패하는 검사** — fill 검사: ① `FORMS.clinic.files.plan.set` 의 tok 목록이 위 지도와 같고 `main` 의 tok 과 겹치는 것(업체명·담당자·테마·소속·지원단명)은 같은 이름뿐 ② **합성 별지11 XML**(실제 양식과 같은 주소·문구: `T0.C1.P0 … T0.C62.P0`, `T0.C21.P0..P2` 가 « ①»,« ②»,« ③» 글자, `T0.C39/C47/C55.P0` 가 «월   일»)을 만들어 `fillForm(xml,'clinic','plan',report)` 가 `missing:[]`·`unknown:[]`·`left:[]`, 값이 제 칸에 들어가고 «월   일» 원문이 남지 않으며 «①» 줄이 `' ① 애로 첫 줄'` 꼴 ③ 회차 0·1·2·3개(빈 묶음은 `' '`)·4개는 `over` ④ 별지14(`main`) 채우기 결과가 그대로(기존 검사 통과) ⑤ 애로사항 줄이 1·2·3·4개일 때. AI 검사: «지도 대조» 가 `plan` 파일도 본다(`USES.clinic.plan` 있음). 화면 검사: 현장클리닉 보고서의 파일 단추 이름표가 «현장지도결과서(별지14)»·«수행계획서(별지11)», 다른 양식(서산 visit/report, 충남북부·기술보호 main)의 이름표는 그대로.
- [ ] **Step 2: 실패 확인** — 해당 검사 FAIL.
- [ ] **Step 3: 구현** — 위 코드. `?v` 올림(훅이 요구하는 것만).
- [ ] **Step 4: 실제 양식 점검(저장소 밖, 기록만)** — Node 일회용 스크립트(스크래치, 커밋 안 함)로 `clinic-plan.hwpx`(읽기 전용)의 `Contents/section0.xml` 에 `PuGovReport.fillForm(xml,'clinic','plan', 합성 report)` → `missing`·`left`·`unknown` 이 비어 있는지, 채운 XML 을 **새 사본**(`…\컨설팅업체\_작업_현장클리닉\clinic-plan-filled-test.hwpx`)으로 묶어 `mcp__kordoc__render_document` 로 렌더해 값이 제 칸에 들어갔는지 보고한다. 지도 주소가 안 맞으면 고치고 보고한다.
- [ ] **Step 5: 기록 + 전체 검사 + Commit** — `status/2026-10-12-gov-report-clinic-plan.md`(만든 것·못 한 것: 휴대폰·주 생산품·계약금액·추천 MD·분야 세분류·예상산출물은 보고서에 없어 빈칸, 서고 등록은 합친 뒤, 실제 화면 미확인), `STATUS.md` 줄 하나. `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js tests/photos-staff-share.test.js` PASS. `git add …` · `feat(gov-report): 현장클리닉 별지11 수행계획서 칸 지도·값·화면` + Co-Authored-By.
