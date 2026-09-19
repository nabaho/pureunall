# 2026-09-19 · 계약창(ContractModal) 여섯 칸 — 라벨을 셀 안 placeholder 로

- 가지: `feat/contract-6col-relabel`
- PR: (열면서 채움)
- 앞선 걸음: `fix/contract-transfer-gaps` (PR #1483, 이미 병합) — 계약→업체/사건 이관 때
  `corpRegNo`·`ceoPhone`·`addressDetail`·`ceo2` 가 빠지던 것을 먼저 고쳤다.

## 대표 지시 (여러 차례에 걸쳐 목업으로 확정)

「너무 길게 내려왔다 … 좀더 한화면에 다 넣고 관리할 수 있게 하고 싶다」
「기업담당자는 왜 안줄였나 이것도 4칸으로 하고 셀 위에 있는 글자를 셀 안에 희미하게 넣으면
안되나 … 전체적으로 셀위에 안내설면을 셀안에 모두 넣은것으로 목업해라」
「1줄로 캡쳐1, 2」(auto-fill 그리드가 특정 너비에서 한 칸이 밀려 혼자 줄바꿈하던 버그 신고)
→ 목업 여러 판 승인 뒤 「진행」으로 실 코드 반영 지시.

## 무엇을 바꿨나

1. **`css/pu-erp.css`**: `.pu-g6`/`.pu-n6` 새 체계 추가(6칸 그리드, 칸마다 라벨 없이
   `placeholder` 로만 무엇인지 알림). `.pu-g4`/`.pu-c4`(라벨-위-4칸)는 그대로 남겨 뒀다 —
   업체관리(CompanyEditModal)는 이번에 손대지 않았다(아래 「남은 결정」 참고).
   ⚠ `repeat(auto-fill, minmax(150px,1fr))` 를 쓰면 컨테이너 너비에 따라 칸 수가 1개
   줄어 마지막 칸이 혼자 다음 줄로 밀리는 버그를 실측(대표 스크린샷)으로 확인 —
   그래서 `repeat(6, minmax(0,1fr))` 고정 + `@media` 단계식 접기(980px→3칸, 640px→2칸)로 바꿨다.
2. **`pu-erp.html` — ContractModal**: 기업정보·계약정보·담당자 탭의 `pu-g4`(4칸+라벨)를
   전부 `pu-g6`(6칸+무라벨)로 바꿨다. 새 만들개 `fldn6(ctrl, span)`·`sec6(title, hint)`·
   `phOption(text)` 추가, 옛 `fld`·`fld4`·`sec4` 는 더는 부르는 자리가 없어 **걷어냈다**
   (죽은 코드로 남겨 두지 않았다 — css 의 `.pu-c4`/`.pu-g4-sec` 정의는 CompanyEditModal 이
   그대로 쓰므로 남아 있다).
   - 회사명(의뢰인)은 검색 자동완성 칸이라 `pu-n6-2`(2/6, 약 340px)만 써도 충분하다고
     목업에서 확인 — 사업장주소·본사주소·특이사항(비고)처럼 자유 문장이 오는 칸만
     `pu-n6-6`(6/6, 한 줄 전체)로 한다.
   - **새 기능**: 본사주소도 사업장주소처럼 우편번호 검색이 되게 함(`doHeadAddrSearch`).
     새 zipcode 칸을 만들지 않고 기존 `addressDetail` 문자열 하나에 우편번호+주소를
     합쳐 넣는 방식을 택했다 — PR #1483 에서 겪은 「칸 하나 추가하고 다른 곳(업체관리·
     이관·ERP_CO_FILL_KEYS)에 안 잇는」 실수를 되풀이하지 않으려는 의도.
   - 부담당(managerSubs) 슬롯만은 라벨을 남겼다(`pu-c4`, 「부담당 1·2·3」 표시) —
     `<select>` 는 값을 고르면 placeholder 가 사라지는 `<input>` 과 달리 몇 번째
     자리인지 알 길이 없어지므로 의도적 예외로 남겼다(코드 주석에도 남김).
3. **드롭존(`dropZone`)**: 2줄이던 것을 1줄로.
4. **근로자(의뢰인) 카드 · 기업담당자 카드**: `pu-g6` 로 전환, 입사~퇴사일을 한 칸으로
   합치고 주소+검색+이메일+비고를 한 줄 flex 로 합쳐 orphan(외톨이 칸이 다음 줄로
   밀리는 문제)을 줄였다.

## 검사 — 재설계로 깨진 9개 파일을 규칙은 지키며 문구만 새로

라벨이 사라지고 `fld4('이름', …)` 같은 호출 자체가 없어지면서, «지금 문구·호출 모양»을
못 박았던 검사 9개가 깨졌다. 전부 **문구를 새로**(placeholder 값·className) **바꿨을 뿐
검사가 지키던 규칙 자체는 그대로**다:

| 파일 | 무엇이 깨졌었나 | 무엇으로 다시 짚었나 |
|---|---|---|
| `contract-autocomplete.test.js` | 끝 표식이 옛 placeholder 문자열 | onFocus 함수 몸통으로 끝 표식 이동 |
| `contract-dup-verdict.test.js` | 단추 문구·「기업정보함에서 보기」 문구 개수 | `'📇 가져오기'` · `href:'pu-cards.html'` |
| `office-help-text.test.js` | `SUBMGR_ADD_OPT` 를 주석에 글자 그대로 적어 자기 검사가 스스로 걸림 + 새 본사주소 검색이 `ADDR_NONE_MSG`/`ADDR_OK_MSG` 호출을 하나씩 늘림 | 주석 표현 순화, 두 상수 호출수 4→5 |
| `contract-4col-order.test.js` | `fld4('…', …)` 호출 자체가 없어짐, 회사명이 6/6 이 아니라 2/6 | placeholder 문자열로 자리 짚기, 회사명은 2/6·주소·비고는 6/6 로 규칙 재정의 |
| `pucards-pull.test.js` | `fld4?\('대표자 전화'` 패턴이 더는 없음 | `placeholder:'대표자 전화'` 로 |
| `site-contact-sync.test.js` | 슬라이스 끝 표식(`className:'pu-g4'`)이 사라져 슬라이스가 CompanyEditModal 까지 통째로 삼켜 엉뚱한 `localStorage` 에 걸림 | 끝 표식을 `className:'pu-g6'` 로 |
| `three-fixes.test.js` | 단추 문구가 짧아짐(「📇 기업정보함 정보 가져오기」→「📇 가져오기」+짧은 「보기」) | 새 문구 + `title` 속 안내문으로 규칙(사진은 안 가져온다) 확인 |
| `contract-photo-fill.test.js` | 「가져오기」·「채우기」 단추 문구가 짧아짐 | 새 문구(`📇 가져오기`·`📷 채우기`) + `title` 속 안내문 |
| `ontology-work-references.test.js` | 담당자 장을 «산 코드 그대로» `vm.Script` 에 옮겨 태우는데, 시작 표식이 `function fld4(...)`(걷어냄)라 못 찾아 엉뚱한 코드 덩이(맨 앞부터)를 태워 `Illegal return statement` 로 죽음 | 시작 표식을 `function fldn6(ctrl, span){` 로(끝 표식 `/* ══════` 은 그 다음 자리에 그대로 있어 안 바꿨다) |

전체 스위트(`node --test "tests/*.test.js"`) 0 실패 확인 (총 9개 파일 손질 — 표는 그 중 7개, 뒤이어 전체 재실행에서 두 개 더 드러나 손질).

## 미룬 것 (다음 결정)

- 「종류별 세부설정」(계약금·잔금의 일수계산·부가세·원%토글) 박스를 4줄→1~2줄로 줄이는
  목업(`contract-detail-box-v2.html`, 대표 승인)은 **아직 실 코드에 안 옮겼다** — 계산
  로직이 얽혀 있어 더 신중히 다룰 별도 PR로 미룬다.
- CompanyEditModal(업체관리)은 여전히 옛 `pu-g4`/라벨-위 모양이다. ContractModal 과
  시각적으로 달라졌다는 것을 코드 주석에 남겨만 뒀다 — 통일할지는 대표 판단.
