# 정부컨설팅 보고서 자동화 1단계 — 양식 지도 + 채우기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기관이 보낸 «빈 양식(HWPX)» 에 보고서 자료 한 벌을 넣으면 그 양식 그대로 채워진 HWPX 가 나온다 — 1차 세 사업(충남북부상의 · 서산상의 · 기술보호).

**Architecture:** 엔진(`js/pu-hwpx-fill.js`)은 이미 반복 묶음(`{{#이름}}` · `{{#쪽:이름}}` · `{{#행:이름}}`)과 번호 표지·빈칸 밑줄을 갖고 있다(2026-09-26 기금 서류용) — 설계서 §3 의 «복제 기능이 없다»는 낡은 말이다.
그래서 새로 만드는 것은 ① 양식마다 «어느 칸 = 무슨 표지» 지도(코드) ② 지도로 빈 양식에 표지를 넣는 `tokenize` ③ 보고서 자료 → 표지 값 `buildValues` ④ 둘을 엮은 `fillForm` 이다.
빈 양식은 해마다 바뀌므로 «토큰 박은 견본»을 따로 두지 않고, 빈 양식 + 지도로 그때그때 만든다(지도 한 곳만 고치면 된다).

**Tech Stack:** 순수 JS(브라우저 `window.PuGovReport` / Node 겸용, `pu-hwpx-fill.js` 와 같은 꼴) · `node --test` · 확인은 대표 PC 한글 2022 자동조종(HWPFrame.HwpObject).

**Spec:** `docs/superpowers/specs/2026-10-05-정부컨설팅-보고서자동화-design.md`

## Global Constraints

- 모르는 값은 `＿＿＿`(엔진 BLANK) — **지어내지 않는다.**
- 근로자수는 `pucards/coInfo.workers`(상시근로자수) — 이알피 `employmentInsuredCount`(피보험자수)를 쓰지 않는다.
- 원본 양식·과거 보고서는 읽기만. 결과는 늘 새 파일. 작업 폴더 `C:\Users\fair0\Documents\pu-gov-forms-work`(저장소 밖).
- ★ 저장소는 공개다 — 실제 양식 파일·채운 보고서·업체 자료를 저장소에 넣지 않는다. 검사는 «주소 꼴을 흉내 낸 합성 XML» 로.
  예시 값은 홍길동·가나상사, 사업자번호는 123- 로 시작.
- 줄바꿈 값(여러 줄 글)은 한 칸 안에서 `<hp:lineBreak/>` 로 — 칸 밖 문단을 늘리지 않는다.
- 새 화면·저장 자리(Storage `gov_forms`·RTDB `scal_rptForms`)는 2단계(검토 화면)에서 — 1단계는 «채우기가 맞는가»까지.

---

## File Structure

| 파일 | 할 일 |
|---|---|
| `js/pu-hwpx-fill.js` (고침) | 값 안의 줄바꿈 `\n` → `<hp:lineBreak/>` (opts.breaks) |
| `js/pu-gov-report.js` (새) | `FORMS` 지도 · `tokenize` · `buildValues` · `fillForm` · `koDate` · `visitBox` |
| `tests/gov-report-fill.test.js` (새) | 합성 XML 로 세 양식 채우기 규칙 |
| `tests/pu-hwpx-fill.test.js` (고침) | 줄바꿈 규칙 |
| scratchpad `gov-verify.js` (저장소 밖) | 실제 빈 양식 + 홍길동 자료 → HWPX → 한글로 열어 쪽 수·PDF |

---

### Task 1: 값 안의 줄바꿈을 한글 줄바꿈으로

**Files:** Modify `js/pu-hwpx-fill.js` (paraReplace · fill · replaceText 의 opts) · Test `tests/pu-hwpx-fill.test.js`

**Interfaces:** Produces `fill(xml, V, {breaks:true})`, `replaceText(xml, rules, {breaks:true})` — 값의 `\n` 을 `<hp:lineBreak/>` 로 쓴다(글자 모양은 그 run 그대로). 기본(꺼짐)은 지금과 같다.

- [x] Step 1: 실패하는 검사 — `fill('<hp:p><hp:run><hp:t>{{가}}</hp:t></hp:run></hp:p>', {가:'첫줄\n둘째줄'}, {breaks:true}).xml` 에 `첫줄<hp:lineBreak/>둘째줄` 이 들고, breaks 없이는 `\n` 이 그대로(지금 모습) 남는다.
- [x] Step 2: 돌려 실패 확인 — `node --test tests/pu-hwpx-fill.test.js`
- [x] Step 3: 구현 — `paraReplace(p, pairs, breaks)` 가 조각 글을 `enc` 한 뒤 `breaks` 면 `\n` 을 `<hp:lineBreak/>` 로 바꾼다. `fill`·`replaceText` 가 `opts.breaks` 를 넘긴다.
- [x] Step 4: 통과 확인 + 기존 hwpx 검사(`fund-hwp-*`) 통과
- [x] Step 5: 커밋

### Task 2: 충남북부상의 지도 + 채우기 핵심

**Files:** Create `js/pu-gov-report.js` · Test `tests/gov-report-fill.test.js`

**Interfaces:**
- Consumes: `PuHwpxFill.replaceText`, `.expand`, `.fill`, `.markers`, `.BLANK`
- Produces:
  - `FORMS['cci-north']` = `{ name, agency, files:{ main:{ set:[{at, tok}], find:[{at, find, tok}] } }, rounds:{min:3,max:3} }`
  - `tokenize(xml, formKey, fileKey) → xml` (지도대로 칸에 `{{표지}}`)
  - `buildValues(report, formKey) → V` (report 꼴은 아래)
  - `fillForm(xml, formKey, fileKey, report) → { xml, unknown:[], left:[], short:{need,have}|null }`
  - report 꼴: `{ company:{name,bizNo,ceo,bizType,address,workers,contact,contactTitle}, consultant, writtenAt:'YYYY-MM-DD', rounds:[{date:'YYYY-MM-DD', visit:true|false, inquiry, diagnosis, advice, result, next}], summary:{inquiryDiag, review, action, outputs:[], etc} }`

충남북부 지도 (2026-10-07 실제 2025 양식을 한글로 HWPX 변환해 scan 으로 잰 주소):

| 주소 | 표지 | 값 |
|---|---|---|
| T1.C1.P0 | 업체명 | company.name |
| T1.C3.P0 | 사업자번호 | company.bizNo |
| T1.C5.P0 | 대표자 | company.ceo |
| T1.C7.P0 | 업종 | company.bizType |
| T1.C9.P0 | 소재지 | company.address |
| T1.C11.P0 | 근로자수 | company.workers (+ '명') |
| T1.C13.P0 | 담당자 | company.contact |
| T1.C15.P0 | 담당부서직위 | company.contactTitle |
| T1.C18/21/24.P0 | 일자1/2/3 | koDate(rounds[n].date) |
| T1.C19/22/25.P0 | 방문체크1/2/3 | visitBox(rounds[n].visit) — `■방문 □사무활동` / `□방문 ■사무활동` / 모르면 원문 그대로 |
| T2.C1.P0 | 문의진단종합 | summary.inquiryDiag |
| T3.C2/C4/C6.P0 | 수행내역1/2/3 | 회차 글 = 문의·진단·자문·성과·향후를 «문의: …» 줄로 이음(빈 것은 뺌), 회차가 비면 BLANK |
| T4.C4.P0 · C5 · C6 | 결과종합_검토 · 결과종합_조치 · 산출물목록 | summary.review · .action · outputs `#1 …` 줄 |
| T5.C1.P0 | 기타 | summary.etc |
| P10 | 작성일 | koDate(writtenAt) |
| P13 find `경영상담역:` | 상담역 | `경영상담역: ` + consultant |

- [x] Step 1: 실패하는 검사 — 합성 XML 도우미 `tblXml(rows)` 로 T0~T6·P0~P21 주소를 흉내 낸 문서를 만들어
  ① 모든 칸이 채워지고 결과에 `{{` 가 남지 않음 ② 근로자수는 workers(피보험자수 칸 무시) ③ 회차 2개면 3회 칸은 BLANK + `short:{need:3,have:2}` ④ 방문 여부 미상이면 체크칸 원문 ⑤ 여러 줄 글은 lineBreak.
- [x] Step 2: 실패 확인
- [x] Step 3: 구현(아래 핵심 코드)
- [x] Step 4: 통과 확인
- [x] Step 5: 커밋

핵심 코드 꼴:
```js
function koDate(s){ var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||'')); return m ? (+m[1])+'년 '+(+m[2])+'월 '+(+m[3])+'일' : ''; }
function visitBox(v){ return v===true ? '■방문 □사무활동' : v===false ? '□방문 ■사무활동' : null; }
function tokenize(xml, formKey, fileKey){
  var f = FORMS[formKey].files[fileKey], rules = [];
  (f.set||[]).forEach(function(r){ rules.push({ at:r.at, set:'{{'+r.tok+'}}' }); });
  (f.find||[]).forEach(function(r){ rules.push({ at:r.at, find:r.find, to:'{{'+r.tok+'}}' }); });
  return F.replaceText(xml, rules, { lines:'keep1' }).xml;
}
function fillForm(xml, formKey, fileKey, report){
  var V = buildValues(report, formKey), t = tokenize(xml, formKey, fileKey);
  var e = F.expand(t, V, { breaks:true }), r = F.fill(e.xml, V, { breaks:true });
  var left = Object.keys(F.markers(r.xml));
  var need = (FORMS[formKey].rounds||{}).min||0, have = (report.rounds||[]).length;
  return { xml:r.xml, unknown:r.unknown.concat(e.unknown), left:left, short: have < need ? { need:need, have:have } : null };
}
```

### Task 3: 실제 양식으로 확인 (저장소 밖)

**Files:** scratchpad `gov-verify.js` · 작업 폴더 `pu-gov-forms-work`

- [x] Step 1: `cci-north.hwpx`(변환본)의 section0.xml 을 `fillForm` 으로 채워(홍길동·가나상사 합성 자료, 회차 3) 새 HWPX 로 다시 묶는다(원본 ZIP 의 다른 항목은 그대로, mimetype 첫 항목·무압축 유지).
- [x] Step 2: 한글 자동조종으로 열어 쪽 수(원본 2쪽 → 2~3쪽)·PDF 저장 — 열기 실패·쪽 수 폭증이면 실패.
- [ ] Step 3: PDF 를 대표께 보내 «칸이 맞는가» 확인(설계서 §5-3 사람 확인).

### Task 4: 서산상의 — 방문확인서(회차마다 한 쪽) + 상담·자문 결과 보고서

**Files:** Modify `js/pu-gov-report.js` (FORMS['cci-seosan']) · Test `tests/gov-report-fill.test.js`

서산 원본은 2024 파일(2025 빈 양식 없음) — 확정본이라 칸마다 지난 업체 글이 여러 문단으로 들어 있다.

- [x] Step 1: 서산 확정본 두 개(방문확인서·결과보고서)를 한글로 HWPX 변환 → scan 으로 주소를 잼(2026-10-09).
  빈 견본이 없으므로 업체 값이 든 칸은 지도가 «통째로 덮는» 칸 — 여러 문단 칸은 `{cell}`(첫 문단에 표지, 나머지 지움), 둘째 장(P9~P16)은 `{drop}`,
  서명줄 빈칸에 든 지난 상담역 이름도 `gap` 이 걷는다. 원본 도장 그림(`<hp:pic>`)은 tokenize 가 걷는다.
- [x] Step 2: 방문확인서는 `{{#쪽:회차}}` … `{{/쪽:회차}}` 를 지도의 첫·끝 문단(`{at, raw}`)에 넣어 회차 수만큼 장을 베낀다. 회차 1·3 · 0(모자람) · 11(넘침) 검사(합성 XML).
- [x] Step 3~5: 구현·통과·커밋 · 실제 확인(한글 2022: 회차 3 → 3쪽, 결과보고서 2쪽)

### Task 5: 기술보호 — 완료보고서(별지11) + 일차별 자문일지(1~7차)

**Files:** Modify `js/pu-gov-report.js` (FORMS['techguard']) · Test

- [x] Step 1: 2025 서식 변환 → scan. 「법률 자문 일지 (○일차)」 장(P18·T8)을 `{{#쪽:회차}}` 묶음으로, 1일차 일지·교육 수행 일지·참석자 명단(P15~P17)은 지움.
- [x] Step 2: 회차 2·7 검사(일지 장 수·지원일자 「8/7(목)」·안 쓴 칸 빈칸 한 칸), 8차는 `over` 알림.
- [x] Step 3~5: 구현·통과·커밋 · 실제 확인(한글 2022: 회차 7 → 8쪽)

## Self-Review

- 설계서 §5 지도·§5-2 표지·§10 검사(반복 1·3·7, 표지 잔존 0, 근로자수, «기록 없음»)를 Task 2·4·5 가 덮는다.
- §6 자료 모으기·검토 화면·저장 자리·AI 초안은 2~3단계 — 이 계획 밖(의도).
- 이름 일관성: `FORMS` · `tokenize` · `buildValues` · `fillForm` · `koDate` · `visitBox` — 과제마다 같은 이름.
