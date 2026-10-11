# 현장클리닉(비즈니스지원단) 양식·서류 틀 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 간단형 사업 «비즈니스지원단 현장클리닉»(중소벤처기업부 운영지침)의 **별지14 현장지도결과서**를 보고서 창에서 HWPX 로 채워 내려받게 하고, 서류 체크표의 서류 틀을 운영지침 공식 서식(별지11·13·14)에 맞춘다.

**Architecture:** 기존 3개 양식(`cci-north`·`cci-seosan`·`techguard`)과 같은 길 — `PuGovReport.FORMS.clinic`(칸 지도) + `buildValues`(보고서 자료 → 표지 값) + 양식 서고의 빈 양식(대표 PC 한글 변환본, 서고 등록은 합친 뒤 컨트롤러가 한다). 보고서 창(`gov-consulting.html`)과 AI 초안(`pu-gov-report-ai.js`)은 새 양식 키 `clinic` 을 알게 한다. 서류 틀(`DOC_PLANS.clinic`)은 운영지침 공식 서식으로 고친다. **새 DB 칸·규칙 없음**(보고서 요약 `summary` 에 새 글 칸이 생기지만 `scal_reports` 의 `report` 는 자유 객체 — 규칙 검사 테스트로 확인).

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE 브라우저·Node 겸용), `PuHwpxFill`(js/pu-hwpx-fill.js), `node --test`.

## 근거 (공식 자료 — 대표 PC `컨설팅업체\3. 비지니스지원단 계획서\2025년 비즈니스지원단 운영지침 개정안(2025.2.17.개정).hwp`)
- 별지11 현장클리닉 수행계획서(선정 후 7일 이내 시스템 제출·승인) · 별지13 수행계획 변경요청서 · **별지14 현장클리닉 현장지도결과서**(최종 수행일로부터 14일 이내, 반려 후 7일 이내 재제출; 시스템 입력 + 별도 결과서 파일 첨부 최대 3개·30MB 이하; 70점 미만이면 취소·사업비 미지급) · 별지15 평가표 · 별지16 만족도조사(기업 작성).
- 운영지침 제25조: 수행일수 3일 이내 원칙, 1일 3시간(휴게 제외), 3일 이상 시 지원일수의 2/3 이상 현장 근무, 1일 1개 지원기업만. 제27조: 결과서 제출 14일. 2026-04-13 개정판(별지24 성과추적관리결과서 등)은 아직 원문을 못 구했다 → `[확인 필요]`.
- 별지14 양식 구조(대표 PC 한글 변환본을 잘라 만든 단독 양식 `_작업_현장클리닉\clinic-result.hwpx`, 저장소 밖): 1. 개요 표(지원기업명·담당자명·소속·지원단명·분야·총수행일수·테마·수행일자) · 2. 애로사항 및 문제점(큰 칸) · 3. 일정별 수행내역 3칸(수행일자·지원기업담당자·수행시간·현장수행시간·수행내용·특이사항) + 총 수행시간 · 4. 수행내용 상세(기업현황·문제진단·처방내용) · 5. 전후 비교 4행(개선 전·개선 후·산출물) · 6. 향후 추진사항 및 성과추적관리 방안 · 8. 작성기준 안내 상자.

## Global Constraints

- 새 쓰기 길·새 규칙·게시 없음. `gov-report.html` 의 쓰기는 `grSaveCell` 한 곳 그대로(이 계획은 `gov-report.html` 을 건드리지 않는다 — 서류 틀 글은 `DOC_PLANS` 상수).
- 기존 3개 양식의 `FORMS`·`buildValues`·AI `USES`·화면 칸 목록·`DOC_PLANS` 의 간단형 셋 출력은 **그대로**(기존 검사 통과).
- 모르는 값은 비워 둔다(지어내지 않는다): 수행시간·현장수행시간은 보고서에 없다 → 빈칸(엔진 `' '`), 안 쓴 일정 칸도 빈칸. 총 수행일수는 «회차 날짜 수».
- 지원기업 개인 자료는 AI 로 보내지 않는다(기존 AI 규칙 그대로 — 가리기·마스킹). 기술보호만 기본 끔인 규칙은 건드리지 않는다.
- 공개 저장소: 코드·검사·상수·문서에 고객사·사람 이름·연락처를 쓰지 않는다(합성 `다라정밀`·`가나상사`·`홍길동`·`example.com`). 실제 양식 파일(HWPX)은 저장소에 넣지 않는다 — 검사는 **합성 XML**(같은 칸 주소 모양)으로 한다.
- 검사에 `?v=숫자` 금지(`\?v=\d+`), 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-consulting.html` 은 부분 편집·줄바꿈 보존(전체 재작성 금지).
- 새 summary 칸 이름(`theme` 테마 · `status` 기업현황 · `diag` 문제진단 · `remedy` 처방내용 · `effects` 전후 비교(줄마다 `개선 전 → 개선 후`) · `followUp` 향후 추진사항)은 **이 이름 그대로** 쓴다(기존 `inquiryDiag` 는 «애로사항 및 문제점» 칸에 재사용, `adviceAll`·`overall` 은 clinic 에서 안 쓴다).

## Review Focus

- 회차가 0·1·2·3·4개일 때 일정 칸 3개가 모두 값 또는 빈칸으로 채워지고 «(수정 불가)» 글자가 남지 않는다(4번째 이후는 무시, 초과는 `over` 로 알림) — Task 1 검사.
- 전후 비교 줄이 4개 미만·초과·`→` 없는 줄일 때 — Task 1 검사.
- 간단형 세 양식 출력이 그대로 — 기존 검사.
- 양식 선택: 사업 종류 이름에 «현장클리닉»이 들어가면 `clinic`, «기술보호»·«서산»·«충남북부» 우선순위가 바뀌지 않는다 — Task 1 검사.
- AI 초안의 `USES.clinic` 가 `buildValues` 가 실제로 찍는 칸과 같다 — Task 2 검사.

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report.js` (수정) | `FORMS.clinic`(칸 지도) · `buildValues('clinic')` |
| `js/pu-gov-report-build.js` (수정) | `pickByLine` 에 현장클리닉 · `buildReport` clinic 기본값(`consultantOrg`) |
| `js/pu-gov-report-ai.js` (수정) | `USES/LIMITS/LABEL/LABEL_FORM/GUIDE` clinic |
| `gov-consulting.html` (수정) | `GRP_HINT`·`GRP_RUSE`·`grpFieldsFor` clinic 칸 |
| `js/pu-gov-report-docs.js` (수정) | `DOC_PLANS.clinic` 항목·`how`·`steps`·`check` |
| 대응 `tests/*.test.js`, `STATUS.md`, `status/2026-10-12-gov-report-clinic.md` | 검사·기록 |

---

### Task 1: 칸 지도 `FORMS.clinic` · 값 만들기 · 양식 고르기

**Files:** Modify `js/pu-gov-report.js`, `js/pu-gov-report-build.js`, `tests/gov-report-fill.test.js`(칸 지도 검사 — 이 파일이 다른 양식의 합성 양식 검사를 어떻게 하는지 먼저 읽고 같은 틀로), `tests/gov-report-build.test.js`; `gov-consulting.html` 의 `pu-gov-report*.js` `?v` 올림(훅이 요구하는 만큼 — 스크립트 태그 번호만).

**Interfaces:**
- Produces: `PuGovReport.FORMS.clinic = { name:'비즈니스지원단 현장클리닉 현장지도결과서(별지14)', agency:'중소벤처기업부 비즈니스지원단', rounds:{min:1,max:3}, files:{ main:{ set:[…] } } }`; `buildValues(report,'clinic')` 가 아래 표지 이름을 돌려준다; `PuGovReportBuild.resolveFormKey` 가 현장클리닉 사업을 `clinic` 으로.

**칸 지도(대표 PC 한글 변환본에서 잰 주소 — 아래를 그대로 쓴다):**

```js
    /* 비즈니스지원단 현장클리닉 현장지도결과서(별지 14) — 2025.2.17 개정 운영지침 별지를 한글로 HWPX 변환해 그 쪽만 잘라 낸 단독 양식에서 잼(2026-10-12).
       일정 칸은 3개 고정(수행일자·지원기업담당자·수행시간·현장수행시간·수행내용·특이사항) — 4일 이상은 운영지침상 예외(3일 이내 원칙)라 범위 밖(over 로 알린다).
       «(수정 불가)»(시스템이 채우는 칸)도 우리 값/빈칸으로 바꾼다 — 시스템 제출용 첨부 결과서로 쓰기 때문이다. */
    clinic: {
      name: '비즈니스지원단 현장클리닉 현장지도결과서(별지 14)',
      agency: '중소벤처기업부 비즈니스지원단',
      rounds: { min: 1, max: 3 },
      files: {
        main: {
          set: [
            { at: 'T0.C1.P0', tok: '업체명' }, { at: 'T0.C3.P0', tok: '담당자' },
            { at: 'T0.C5.P0', tok: '소속' }, { at: 'T0.C7.P0', tok: '지원단명' },
            { at: 'T0.C9.P0', tok: '분야' }, { at: 'T0.C11.P0', tok: '총수행일수' },
            { at: 'T0.C13.P0', tok: '테마' }, { at: 'T0.C15.P0', tok: '수행일자목록' },
            { cell: 'T1.C0.', tok: '애로사항', like: 'T3.C3.P0' },
            { at: 'T2.C4.P0', tok: '일자1' }, { at: 'T2.C6.P0', tok: '담당1' }, { at: 'T2.C8.P0', tok: '시간1' },
            { at: 'T2.C10.P0', tok: '현장시간1' }, { at: 'T2.C11.P1', tok: '내용1' }, { at: 'T2.C13.P0', tok: '특이1' },
            { at: 'T2.C16.P0', tok: '일자2' }, { at: 'T2.C18.P0', tok: '담당2' }, { at: 'T2.C20.P0', tok: '시간2' },
            { at: 'T2.C22.P0', tok: '현장시간2' }, { at: 'T2.C23.P1', tok: '내용2' }, { at: 'T2.C25.P0', tok: '특이2' },
            { at: 'T2.C28.P0', tok: '일자3' }, { at: 'T2.C30.P0', tok: '담당3' }, { at: 'T2.C32.P0', tok: '시간3' },
            { at: 'T2.C34.P0', tok: '현장시간3' }, { at: 'T2.C35.P1', tok: '내용3' }, { at: 'T2.C37.P0', tok: '특이3' },
            { at: 'T2.C39.P0', tok: '총시간' }, { at: 'T2.C41.P0', tok: '총현장시간' },
            { cell: 'T3.C3.', tok: '기업현황' }, { cell: 'T3.C5.', tok: '문제진단', like: 'T3.C3.P0' }, { cell: 'T3.C7.', tok: '처방내용', like: 'T3.C3.P0' },
            { at: 'T4.C5.P0', tok: '전1' }, { at: 'T4.C6.P0', tok: '후1' }, { at: 'T4.C9.P0', tok: '전2' }, { at: 'T4.C10.P0', tok: '후2' },
            { at: 'T4.C13.P0', tok: '전3' }, { at: 'T4.C14.P0', tok: '후3' }, { at: 'T4.C17.P0', tok: '전4' }, { at: 'T4.C18.P0', tok: '후4' },
            { cell: 'T5.C0.', tok: '향후', like: 'T3.C3.P0' },
          ],
        },
      },
    },
```
(`like` 기준 칸 `T3.C3.P0` 은 «기업현황» 값 칸이다 — 이 칸 문단 모양을 다른 큰 칸에 빌려 준다. 합성 검사 양식에도 `T3.C3.P0` 이 있어야 한다. `T3.C3.` `cell` 규칙은 자기 칸이라 `like` 가 없다.)

**`buildValues(report, 'clinic')`** 추가 분기(보고서 모델: `report.company` `.name .contact`, `report.field`, `report.consultant`, `report.consultantOrg`, `report.rounds[] {date, inquiry, diagnosis, advice, result, next}`, `report.summary {theme, inquiryDiag, status, diag, remedy, effects, followUp}`):

```js
    } else if (formKey === 'clinic') {
      V['업체명'] = str(c.name); V['담당자'] = str(c.contact); V['소속'] = str(report.consultantOrg);
      V['지원단명'] = str(report.consultant); V['분야'] = str(report.field);
      V['총수행일수'] = use.length ? use.length + '일' : '';
      V['테마'] = str(s.theme);
      V['수행일자목록'] = use.map(function (r) { return dotDate(r.date); }).filter(Boolean).join(', ');
      V['애로사항'] = str(s.inquiryDiag);
      for (var q = 0; q < 3; q++) {
        var rr = use[q];
        V['일자' + (q + 1)] = rr ? dotDate(rr.date) : ' ';
        V['담당' + (q + 1)] = rr ? str(c.contact) : ' ';
        V['시간' + (q + 1)] = ' '; V['현장시간' + (q + 1)] = ' ';       // 보고서에 시간이 없다 — 지어내지 않고 빈칸
        V['내용' + (q + 1)] = rr ? roundText(rr) : ' ';
        V['특이' + (q + 1)] = ' ';
      }
      V['총시간'] = ' '; V['총현장시간'] = ' ';
      V['기업현황'] = str(s.status); V['문제진단'] = str(s.diag); V['처방내용'] = str(s.remedy);
      var fx = String(s.effects == null ? '' : s.effects).split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      for (var e2 = 0; e2 < 4; e2++) {
        var line = fx[e2] || '', cut = line.indexOf('→');
        V['전' + (e2 + 1)] = cut >= 0 ? line.slice(0, cut).trim() : line;
        V['후' + (e2 + 1)] = cut >= 0 ? line.slice(cut + 1).trim() : ' ';
      }
      V['향후'] = str(s.followUp);
    }
```
(`dotDate` 는 이 파일에 이미 있다. 빈 문자열은 엔진이 밑줄로 바꾸고 `' '` 는 빈칸으로 둔다 — 기술보호 «지원일» 칸과 같은 방식. 전후 비교 «전» 칸이 `''` 이면 밑줄이 되므로 줄이 없는 칸은 `' '` 로 — 위 코드에서 `line` 이 `''` 이면 `V['전k']` 가 `''` 가 되므로 `|| ' '` 로 고친다.)

**`js/pu-gov-report-build.js`:**
- `pickByLine(line, name)` 에 `if (line.indexOf('현장클리닉') >= 0) return 'clinic';` 를 **`기술보호` 검사 뒤**에 더한다(기술보호 이름에 «현장클리닉»이 섞여 있어도 기술보호가 이긴다 — 기술보호 가공품 이름에 `현장클리닉 최종산출물` 이 있었다).
- `buildReport` 에서 `formKey === 'clinic'` 이고 `report.consultantOrg` 가 비어 있으면 `'푸른노무법인'` 을 넣는다(우리 법인 이름 — 지원단 소속). 저장된 초안이 이기는 기존 규칙(`saved.report` 가 덮는다) 그대로.

- [ ] **Step 1: 실패하는 검사 쓰기.** `tests/gov-report-fill.test.js`(기존 양식 검사 틀을 읽고 같은 방식으로 — 합성 XML 을 만드는 도우미가 있으면 재사용)에 clinic 검사를 더한다: ① `FORMS.clinic` 모양(`rounds` min 1·max 3, `files.main.set` 의 `tok` 전체 목록이 위 지도와 같고 중복 `tok` 없음) ② **합성 별지14 XML**(실제 양식과 같은 주소: `T0.C1.P0 … T0.C15.P0`, `T1.C0.P0`, `T2.C2…C41` 에 위 «수행일자/(수정 불가)» 모양, `T3.C3/C5/C7.P0`, `T4.C5…C18.P0`, `T5.C0.P0`, 필요한 `(수정 불가)`·`(작성란)` 글자를 가진 문단들)을 만들어 `fillForm(xml,'clinic','main', report)` 가 `missing:[]`·`unknown:[]`, `left:[]` 이고 값이 제 칸에 들어가고 `(수정 불가)` 글자가 결과에 남지 않음 ③ 회차 0·1·2·3개 — 일정 칸 3개가 값/빈칸, 회차 4개는 `over:{max:3,have:4}` ④ 전후 비교: 줄 4개·2개·`→` 없는 줄·5줄(초과는 무시) ⑤ 간단형 `buildValues` 결과가 그대로. `tests/gov-report-build.test.js`: `resolveFormKey({name:'비즈니스지원단 현장클리닉'})` → `clinic`, `{name:'기술보호 현장클리닉 최종산출물'}` → `techguard`, 서산·충남북부 불변, `buildReport` 로 clinic 보고서를 만들면 `report.consultantOrg === '푸른노무법인'` 이고 저장된 초안(`saved.report.consultantOrg:'다른곳'`)이 이긴다.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-fill.test.js tests/gov-report-build.test.js` 새 검사 FAIL.
- [ ] **Step 3: 구현** — 위 코드. `gov-consulting.html` 의 `pu-gov-report.js`·`pu-gov-report-build.js` 스크립트 `?v` 를 +1(훅이 요구하는 것만).
- [ ] **Step 4: 실제 양식 점검(저장소 밖, 기록만)** — 대표 PC 의 잘라 낸 양식 `C:\Users\fair0\OneDrive\바탕 화면\컨설팅업체\_작업_현장클리닉\clinic-result.hwpx` 를 한 번 써서 점검한다: Node 일회용 스크립트(저장소에 커밋하지 않는다)로 zip(`Contents/section0.xml`)을 읽어 `PuGovReport.fillForm(xml,'clinic','main', 합성 report)` → `missing:[]`·`left:[]` 인지, 채운 XML 을 새 HWPX 로 묶어 `mcp__kordoc__render_document` 로 렌더(경로는 `…\컨설팅업체\_작업_현장클리닉\` 아래에 새 파일로 — 허용 경로) 해 값이 제 칸에 들어갔는지 보고서에 적는다. 렌더가 안 되면 못 한 것으로 적고 계속한다.
- [ ] **Step 5: 통과 확인 후 Commit** — `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js` PASS · `git add js/pu-gov-report.js js/pu-gov-report-build.js tests/gov-report-fill.test.js tests/gov-report-build.test.js gov-consulting.html` · `feat(gov-report): 현장클리닉 현장지도결과서(별지14) 칸 지도·값 만들기·양식 고르기` + Co-Authored-By.

---

### Task 2: AI 초안·보고서 창 칸 (`clinic`)

**Files:** Modify `js/pu-gov-report-ai.js`, `gov-consulting.html`(`GRP_HINT`·`GRP_RUSE`·`grpFieldsFor`·필요하면 `GRP_FILE_KO`), `tests/gov-report-ai.test.js`, `tests/gov-report-ui.test.js`(또는 보고서 창 칸 목록을 검사하는 파일 — 먼저 `grep -rn "grpFieldsFor" tests` 로 찾는다)

**Interfaces:** Consumes Task 1 의 새 summary 칸 이름과 `FORMS.clinic`. Produces: AI `USES.clinic = { main:{ rounds:['inquiry','diagnosis','advice','result','next'], summary:['theme','inquiryDiag','status','diag','remedy','effects','followUp'] } }`, `LIMITS`(`theme:100, status:600, diag:600, remedy:800, effects:600, followUp:600`), `LABEL`(`theme:'테마', status:'기업 현황', diag:'문제 진단', remedy:'처방 내용', effects:'전후 비교(줄마다 «개선 전 → 개선 후»)', followUp:'향후 추진사항'`), `LABEL_FORM.clinic = { inquiryDiag:'애로사항 및 문제점' }`, `GUIDE.clinic`(별지14 작성기준 한 단락: 「비즈니스지원단 현장클리닉 현장지도결과서(별지 14). 수행계획서 내용을 충실히 반영하고 기업 애로 해결 과정을 논리적으로 기록한다. 기업 현황·문제 진단·처방 내용을 나눠 쓰고, 전후 비교는 «개선 전 → 개선 후» 한 줄씩, 향후 추진사항은 성과추적관리 방안을 함께 쓴다. 산출물은 계획 대비 40% 이하면 취소될 수 있으니 실제 산출물과 맞춰 쓴다.」 — 노무사 확인 필요 표시), 화면 `grpFieldsFor('clinic')` 칸: `company.name 업체명` · `company.contact 담당자` · `report.consultantOrg 지원단 소속` · `consultant 지원단 명` · `field 분야` · `summary.theme 테마` · `summary.inquiryDiag 애로사항 및 문제점(multi)` · `summary.status 기업 현황(multi)` · `summary.diag 문제 진단(multi)` · `summary.remedy 처방 내용(multi)` · `summary.effects 전후 비교(multi — 줄마다 한 행, 안내: 「개선 전 → 개선 후 → 산출물(파일명)」, 최대 4줄)` · `summary.followUp 향후 추진사항(multi)` · `writtenAt` 는 clinic 에서 안 쓴다(별지14 에 작성일 칸 없음).

- [ ] **Step 1: 실패하는 검사** — AI 검사: `USES.clinic` 가 `buildValues(report,'clinic')` 이 실제로 쓰는 칸과 같음(기존 검사가 이 둘을 대조하는 방식이 있으면 clinic 도 넣는다), `labelsFor('clinic').inquiryDiag === '애로사항 및 문제점'`, `LIMITS` 새 칸, `GUIDE.clinic` 존재·«노무사 확인» 표시, 간단형 세 양식의 `USES/LABEL_FORM/GUIDE` 불변. 화면 검사: `grpFieldsFor('clinic')` 의 경로 목록이 위 목록과 같고 clinic 에서 `writtenAt`·`company.bizNo` 등이 없음, 간단형 세 양식 칸 목록 불변, `GRP_HINT.clinic === '현장클리닉'`, `GRP_RUSE.clinic` 이 회차 칸 이름표(`['문의','진단','자문','성과','향후']`). `consultantOrg` 칸 이름표가 비어 있으면 `grpBlankList` 에 «지원단 소속» 이 나온다.
- [ ] **Step 2: 실패 확인** — 해당 검사 FAIL.
- [ ] **Step 3: 구현** — 위 인터페이스대로. `gov-consulting.html` 은 부분 편집, `pu-gov-report-ai.js` 의 `?v` 올림(훅).
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js tests/photos-staff-share.test.js` PASS.
- [ ] **Step 5: Commit** — `git add js/pu-gov-report-ai.js gov-consulting.html tests/gov-report-ai.test.js tests/gov-report-ui.test.js …` · `feat(gov-report): 현장클리닉 AI 초안 칸·보고서 창 칸` + Co-Authored-By.

---

### Task 3: 서류 틀 (`DOC_PLANS.clinic`) — 공식 서식으로

**Files:** Modify `js/pu-gov-report-docs.js`, `tests/gov-report-docs.test.js`, `gov-report.html`(`pu-gov-report-docs.js` 의 `?v` 한 줄만)

**Interfaces:** Consumes 기존 `it(id,name,per,step,extra)` 와 `AUTO`. Produces: `DOC_PLANS` 현장클리닉 항목(키 `clinic` 유지, `words:['현장클리닉']`, `kind:'간단'`):

```js
    { key: 'clinic', words: ['현장클리닉'], kind: '간단', check: '2026-04 개정 지침 대조(별지 24)', source: SOURCE, items: [
      it('plan', '별지11 현장클리닉 수행계획서', 'once', 'plat', { note: '클리닉위원 선정 후 7일 이내 시스템 제출 — 운영기관 승인 전에는 현장클리닉을 수행할 수 없습니다(운영지침 제22조)' }),
      it('change', '별지13 수행계획 변경요청서', 'once', 'plat', { note: '계획 일정·내용을 바꿀 때 — 기 등록된 수행일시 전에 요청(해당 없으면 「해당없음」)' }),
      it('log', '상담일지', 'round', 'report'),
      it('result', '별지14 현장지도결과서', 'once', 'report', { note: '최종 수행일로부터 14일 이내(반려 후 7일 이내 재제출) · 시스템 입력 + 별도 결과서 파일 첨부(최대 3개·30MB 이하) · 70점 미만이면 취소·사업비 미지급' }),
      it('track', '별지24 성과추적관리결과서', 'once', 'report', { note: '운영기관이 성과추적관리를 요청한 기업만 — 2026-04 개정 지침 원문 확인 필요' }),
      it('submit', '기관 제출(비즈니스지원단 시스템)', 'once', 'submit', { how: 'platform', steps: [ '비즈니스지원단 시스템(중소벤처기업부 비즈니스지원단 사이트)에 로그인 — 사람이 합니다(인증은 자동으로 다루지 않습니다)', '현장클리닉 상담신청 및 현황에서 그 기업 건을 열어 수행일·시간 확인', '별지14 현장지도결과서 항목을 입력하고 결과서 파일을 첨부(최대 3개 · 파일당 30MB 이하)', '최종 수행일로부터 14일 이내인지 확인 후 «제출» 단추 — 사람이 누릅니다', '제출 화면(접수 상태)을 캡처해 두고 이 칸의 «접수 확인»에 표시'] }) ] },
```
(기존 clinic 항목 `log`·`track`·`submit` 의 `id` 는 **그대로**(`log`·`track`·`submit`) — 이미 저장된 기록이 있으면 키가 맞도록. `plan`·`change`·`result` 는 새 id. 모든 id 는 소문자 글자 줄 키 규칙에 맞는다.) `it()` 의 `extra` 는 `note` 를 받는다(2-A 에서 이미 추가됨 — 없으면 같은 방식으로). 현장클리닉의 `step` 이 `plat`·`report` 인 항목은 **간단형이라 자동 단계 열이 아니라 기존 서류 목차에만** 나온다(체크표 ③④⑤ 는 `submit` 만 — 기존 `TRACK_COLS` 동작). `AUTO` 에 `clinic: true` 를 더해 ①② 칩과 ③④⑤ 기록(③ 서명·④ 별첨은 이 틀에 없으므로 「—」)이 나오게 한다.

- [ ] **Step 1: 실패하는 검사** — ① 현장클리닉 계획의 항목 id·이름·per·step 이 위와 같음(순서 포함), `check` 문구, `submit` 의 `how:'platform'`·`steps` 5줄(모두 비지 않은 글, 주소·전화 꼴 없음), `note` 글들, `kind:'간단'`. ② `AUTO.clinic === true` 이고 `docsTable`(현장클리닉 사업, 합성 입력 — 기존 clinic/기술보호 검사의 합성 입력 틀을 따라 «진짜로 연결되게», 침묵 우회 금지)이 `big` 없이 5열(`COLS`)이고 ③ 칸은 「—」·⑤ 칸은 기록이 있으면 칩. ③ 기존 `DOC_PLANS` 대형·간단형 다른 계획 출력 불변(기존 검사 통과), 항목 id 가 줄 키 규칙(`^[a-z]+(:[0-9]+)?$`·20자)에 맞음. ④ `tocFor` 가 현장클리닉 항목을 «서류 목차»에 올린다(이름 순서).
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-docs.test.js` FAIL.
- [ ] **Step 3: 구현** — 위 상수. `gov-report.html` 의 docs 스크립트 `?v` +1(한 줄).
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js tests/photos-staff-share.test.js` PASS.
- [ ] **Step 5: Commit** — `git add js/pu-gov-report-docs.js tests/gov-report-docs.test.js gov-report.html` · `feat(gov-report): 현장클리닉 서류 틀을 운영지침 공식 서식(별지11·13·14)으로` + Co-Authored-By.

---

### Task 4: 기록

**Files:** Create `status/2026-10-12-gov-report-clinic.md`; Modify `STATUS.md`(줄 하나 — 끝 줄 충돌이 잦으니 `git merge origin/main` 뒤 두 줄을 살린다).

- [ ] 노트: 찾은 자료(운영지침 2025.2.17 개정 — 별지11·13·14·15·16 구조, 제22·25·27조 기한) · 만든 것 · **서고 등록은 합친 뒤**(대표 PC 변환본 `clinic-result.hwpx` → `scal_rptForms/clinic/main/2025` + 색인, 컨트롤러가 한다) · 못 한 것(별지11 수행계획서 양식 채우기·2026-04 개정판 별지24 원문·수행시간 입력·실제 로그인 화면 확인) · 확인 필요(소속 기본값·작성기준 문구·서류 틀 글).
- [ ] 전체 검사: `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js tests/photos-staff-share.test.js tests/pu-hwp-preview.test.js` fail 0; `git diff --stat origin/main...HEAD` 가 File Structure 와 같은지.
- [ ] Commit — `docs(gov-report): 현장클리닉 양식·서류 틀 구현 기록` + Co-Authored-By.
