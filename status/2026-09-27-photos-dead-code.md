# 2026-09-27 · 사진첩 — 죽은 코드·중복 정리

- 대표 지시: 「사진첩에서 중복되고 죽은 코드 등 불필요한부분 정리해라 단 다른 앱에 절대 영향끼치면 안된다.」
- 바꾼 파일: `pu-photos.html` · `tests/ocr-fix-and-contract.test.js` — **다른 앱 파일은 하나도 안 건드렸다.**

## 어떻게 찾았나 — 두 겹으로

1. `tools/dead-code.js pu-photos.html` (넉넉한 셈 — 주석·문서에 이름만 나와도 산 것)
2. 엄격한 셈(scratchpad) — 주석을 걷은 «코드»에서 이름이 선언 말고 나오는가 + 검사·다른 파일 대조.
   ⚠ 첫 판은 `accept="image/*"` 의 `/*` 를 주석 시작으로 읽어 화면 조각을 통째로 걷어 냈다
   → 멀쩡한 id 스무 개가 「죽음」으로 잡혔다. 글자를 지키는 셈으로 다시 세서 가렸다.
3. 몸통이 같은 함수(맨 윗줄 806개) · 글자 그대로 겹친 CSS 규칙 — **둘 다 0개.**

## 걷어낸 것

| 무엇 | 까닭 |
|---|---|
| `makeContractFromDoc()` | 9/19 「계약 등록 요청」(`sendContractRequest`)으로 바뀐 뒤 아무도 안 부름. 검사 셋만 붙들고 있었다 |
| `openSettings()` | 사진첩 안에서 안 불림(검사가 부르는 것은 기업정보함의 같은 이름) |
| CSS `#top .ico` · `.hq` · `.maxhint` · `#dropHint` · `.docnav` · `.helprow` · `#foldList .fold .ed` · `#phSheet .hr` · `#backBarOld` · `#camCount.zero` | 그리는 곳이 어디에도 없다(마크업·코드·싣는 js 모두 대조) |

## 일부러 남긴 것

- `.dochint` — 칸은 없지만 `tests/pu-photos-html.test.js` 가 「폰에서 숨긴다」를 붙들고 있다.
- `#pu-version-fab`·`#pu-health-admin-badge`·`#pu-resilience-badge`·`#pu-backup-admin-button`·`.mosaic`·`.canvas-container` — 공용 js·fabric 이 «만드는» 것.
- `.s-wait` 등 — 이름을 이어 붙여(`'s-' + 상태`) 만든다.
- 이알피의 `pu_new_contract` 쪽지 읽기 — 이알피가 스스로도 쓰는 길이라 살아 있다(다른 앱이므로 손대지 않음).

## 검사

- `ocr-fix-and-contract` 의 셋을 `sendContractRequest` 로 다시 겨눔 — 지키는 규칙은 같다
  (주소에 회사 정보 안 싣기 · 금액·기간 안 지어내기 · 어느 사진에서 왔는지 남기기).
  되돌림 4자리 전부 걸림.
- 사진첩을 읽는 검사 **227개 파일 · 3,462개 전부 통과**. `dead-code.js` 사진첩 세 갈래 모두 0개.
