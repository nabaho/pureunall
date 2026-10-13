# 정부지원금 조사 공통 지침 (푸른노무법인 — 2026-10-12 처음 씀, 해마다 1월 정기 조사에 씀)

검토 기준일: **조사하는 날**(부르는 쪽이 알려 준다). 그해 사업(공고·시행지침)을 기준으로 한다. 그해 자료가 없으면 지난해 자료를 쓰되 `baseYear` 와 `notes` 에 분명히 적는다.

## 꼭 지킬 것
- **확인하지 못한 서류·조건·금액·공고번호를 만들지 않는다.** 원문(공고문·시행지침·운영기관 안내문·신청서식)에서 본 것만 적는다. 못 찾으면 비워 두고 `notes` 에 «확인 못 함»이라고 적는다.
- 출처는 공식 자료를 우선한다: 고용노동부(moel.go.kr)·고용24(work24.go.kr)·기업마당(bizinfo.go.kr)·중소벤처24(smes.go.kr)·중기부(mss.go.kr)·산업부(motie.go.kr)·각 운영기관(한국산업인력공단·소진공·중진공·KOTRA·NIPA 등)·국가법령정보센터.
- 출처마다 `url` 과 `title`, 가능하면 `page`(쪽)를 적는다.
- 사업장(기업·사업주)이 신청하는 사업만 대상이다. 개인(구직자·근로자 본인)만 신청하는 사업은 `applicability: "individual"` 로 표시만 한다.
- 결과는 지정된 JSON 파일 하나에 쓴다(UTF-8). 화면에 길게 붙이지 말고, 마지막에 몇 건을 찾았는지·확신도 분포만 짧게 보고한다.

## 서류 낱말표 (docs[].key) — 이 목록에서 고른다, 없으면 `other`
| key | 서류 |
|---|---|
| applyForm | 기관 서식 신청서·참여신청서 |
| bizPlan | 사업계획서·과제계획서·훈련계획서 |
| bizReg | 사업자등록증(사본) |
| corpReg | 법인 등기사항전부증명서 |
| smeCert | 중소기업(소상공인)확인서 |
| taxPaid | 국세·지방세 완납증명서 |
| insPaid | 4대보험 완납증명서 |
| finStat | 재무제표·표준재무제표증명·부가세 과세표준증명 |
| eiRoster | 고용보험 피보험자 명부·자격이력내역서·사업장 가입자명부 |
| contract | 근로계약서 (★노무) |
| rules | 취업규칙·취업규칙 신고(변경) 증빙 (★노무) |
| payroll | 임금대장 (★노무) |
| wageProof | 임금 지급 증빙(계좌이체 내역 등) (★노무) |
| attendance | 출근부·근태기록·근로시간 기록 (★노무) |
| laborAgree | 근로자대표 서면합의·노사합의서·노사협의회 의결 (★노무) |
| retireRule | 정년 제도 규정(취업규칙·단체협약 등) (★노무) |
| flexRule | 유연근무·단시간·육아기 단축 관련 규정·신청서 (★노무) |
| workerDocs | 대상 근로자 서류(신분증 사본·개인정보 동의서·졸업증명 등) |
| bankbook | 통장 사본 |
| other | 그 밖 — `label` 에 이름을 그대로 |

`docs` 한 줄 모양: `{ "key": "contract", "label": "공고에 적힌 이름 그대로", "stage": "신청" | "지급신청" | "선정 후" | "모름", "note": "조건·예외(예: 채용 근로자분)" }`

## 조건 모양 (새 사업을 찾을 때 cond)
```
"cond": { "headcount": {"min":null,"max":null}, "yearsInBiz": {"min":null,"max":null}, "salesDropPct": {"min":null},
  "sizes": [소기업|중기업|중견기업|대기업|공공기관 중에서], "regions": [시·도 짧은 이름: 서울·부산·…·충남·…·제주],
  "industries": {"include":[대분류 A~U],"exclude":[]},
  "facts": [{"key": prioritySupport|smeCert|retireAgePolicy|hasWorkers60|hasFixedTerm|hiredYouth|flexWork, "want": true|false}],
  "manual": ["기계가 잴 수 없는 조건 문장"] }
```
