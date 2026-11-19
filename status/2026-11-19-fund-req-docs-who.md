# 설립·요청 필요서류 대상자(회사·위원·이사) 및 노 1부·사 1부 구체화 · 기금출연확인서 기업 요청 제외 (2026-11-19)

## 배경 및 대표 지시
- `✉ 기업에 설립시 준비서류` (`pmOpen` / `pmText`) 및 `📋 사업장 제출서류 요청·검토` (`openSiteDocCenter` / `sdcMailText`)의 필요서류 안내에서:
  1. `기금출연확인서`는 푸른노무법인이 작성하는 기본 서식이므로 기업 준비 요청 목록에서 제외할 것.
  2. 각 필요서류가 **누구의 서류인지**(`[근로자측·사용자측 위원]`, `[참여기업(회사)]` / `[설립기업(회사)]`, `[근로자측·사용자측 이사]`)를 구체적으로 표시할 것.
  3. 설립준비위원 재직증명서와 등기이사 서류 3종(개인인감증명서 · 주민등록등본/초본 · 신분증 사본 및 개인인감도장)에 **근로자측·사용자측 각각 `(노 1부, 사 1부)`**를 명확히 표기할 것.

## 변경 내역
1. **`REQ_DOCS.inka` · `REQ_DOCS.reg` · `reqDocsFor` (`fund.html`)**
   - `inka_cseal` (`기금출연확인서`)을 기업 준비·요청 목록(`REQ_DOCS.inka`)에서 제거.
   - 인가 단계:
     - `[근로자측·사용자측 위원] 설립준비위원 재직증명서 (노 1부, 사 1부)`
     - `[참여기업(회사)] 사업자등록증 사본 1부` (사내기금은 `[설립기업(회사)] 사업자등록증 사본 1부` 자동 치환)
     - `[참여기업(회사)] 법인등기부등본 1부 (말소사항 포함·제출용)` (사내기금은 `[설립기업(회사)]` 자동 치환)
     - `[참여기업(노·사 대표)] 공동기금 참여신청서 1부 (근로자대표·사용자 서명)` *(공동기금 전용)*
   - 등기 단계:
     - `[근로자측·사용자측 이사] 개인인감증명서 (노 1부, 사 1부 · 발급 3개월 이내)`
     - `[근로자측·사용자측 이사] 주민등록등본 또는 초본 (노 1부, 사 1부 · 발급 3개월 이내)`
     - `[근로자측·사용자측 이사] 신분증 사본 및 개인인감도장 (노 1부, 사 1부)`
2. **`SDC_DOC_DEFS` · `sdcMapKindToDocId` · `sdcVerifyText` (`fund.html`) 및 `functions/fund-mail-collect.js`**
   - `SDC_DOC_DEFS.inka`에서도 `inka_contrib`(`기금출연확인서`)을 제외하고, 등기이사 서류를 `reg_inseal`(개인인감증명서), `reg_jumin`(주민등록등본 또는 초본), `reg_id`(신분증 사본 및 개인인감도장) 3종으로 각각 `(노 1부, 사 1부)`로 명시.
   - `subsidy`·`ops`·`chg` 단계 서류 제목에도 `[참여기업(회사)]`/`[설립기업(회사)]`, `[기금법인]`, `[근로자측·사용자측 변경이사]` 대상자 머리표를 일관되게 반영.
   - 민감 신분서류(`inseal`, `jumin`, `idcard`)는 동일하게 자동 확인 대상에서 제외(`st:'unk'`)하고 서버 수집기에서도 원본 바이너리 미보관 정책 유지.

## 검증
- `node fund-erp/tools/check_fund.js` 통과
- `tests/fund-prep-mail.test.js`, `tests/fund-forms-tidy.test.js`, `tests/fund-site-doc-checklist.test.js`, `tests/fund-mail-collect.test.js` 및 `tests/fund-*.test.js` 전수 통과
- `tests/no-real-client-data.test.js`, `tests/color-palette-apps.test.js`, `tests/html-inline-script-syntax.test.js` 통과
