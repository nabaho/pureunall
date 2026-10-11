# 2026-10-11 · 컨설팅보고서 — 받은 서류함(메일 첨부 후보 · 서류 줄 연결 · 열어 보기)

설계 `docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md` · 계획 `docs/superpowers/plans/2026-10-11-gov-report-inbox.md`

## 한 것

- 새 순수 모듈 `js/pu-gov-report-inbox.js`(`PuGovReportInbox`): 거울 줄 풀기(`mailRows`) · 주소 귀속(`addrsFor` — `PuCoThread.addrsOf`, 업체관리에 먼저 적힌 업체가 임자, 우리 주소 뺌) · 후보(`candidates` — 첨부 있음·기간·날짜 내림차순·50건) · 딱지(`badges` — 개인 자료는 `PuGovReportBuild.PRIV_RE` 그대로) · 연결 열쇠(`linkKey` — `i:<폴더>:<uid>` · `o:<popKey>`, 80자) · 첨부 받기 순서(`fetchAtt` — peek 목록 → 같은 이름 받기, 20MB 넘으면 안 받음) · 실패 문구(`errText`).
- `js/pu-gov-report-track.js`: 서류 줄의 `link` 가지(`normLink`·`nextLink`·`LINK_*`). 상태만 고치는 저장도 `link` 를 이어 받는다.
- 규칙 생성기 `scal_docs` 줄에 `link`(src·key 필수, 'mail', key 1~80, name ≤100, date 꼴). JSON 두 개 다시 만듦. **게시하지 않았다.**
- `gov-report.html` 칸 창: 「📥 받은 서류 후보」(칸 창을 처음 열 때 `mailbox/folders`·`mailbox/msgs`(폴더마다 최근 3,000통 머리글)·`data/companies` 를 한 번) · 「연결」/「연결 지우기」(기존 `grSaveCell` 한 곳) · 「열어 보기」(한 번에 하나, 한글은 `PuHwpPreview`, PDF·그림·표는 새 보기 창 `#attv`, 판독기는 누를 때 `vendor/`).
- 등록부 `govreport.sharedRoots` 에 `mailbox`·`data/companies`(쓰기 계약 그대로) · `pu-ontology.js` `?v` 올림.

## 왜

- 대표 지시(2026-10-11 「남은 일 순서대로 진행」) — 서명본·별첨이 메일로 오는데 서류 줄과 이어지지 않았다.
- 업체 귀속을 이름이 아니라 «주소»로 — 동명 업체 오연결을 막는다(`status/2026-10-05-mail-owner-erp-addr.md` 와 같은 규칙).

## 남긴 함정

- **규칙 게시 전에는 「연결」이 거절된다** — 줄의 `$other:false` 때문. 화면은 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」을 띄우고 값은 그대로다. 게시 뒤 `tests/photos-staff-share.test.js` 의 PENDING(`/scal_docs/$co/$rid/items/$key/link`)을 비운다.
- **게시 승인 요청에는 «scal_docs 줄이 받아 주는 것이 넓어진다»를 그대로 적어야 한다** — `link` 가지는 `scal_docs` 줄이 새로 받는 값이다. 게시 방어막(deploy guard)은 이 넓어짐을 알아보지 못하므로 승인 요청 글에서 사람이 알려야 한다. 게시 뒤에는 콘솔 원문 스냅샷을 새 판으로 바꾸고 `tests/photos-staff-share.test.js` PENDING 을 비운다.
- 설계서 §2 의 `pucards/mailbox/…` 는 실제로는 뿌리 `mailbox/…` 다(규칙 STAFF — 사번·재직 직원만). 읽기가 거절되면 칸 창 안에 「메일함을 불러오지 못했습니다」+다시 시도, 다른 칸 기능은 그대로.
- 지난 메일(POP3) 거울 `mailbox/old/msgs` 는 `a:0`·`an` 없음 — 후보가 될 수 없다. 열쇠 `o:` 는 열기만 지원한다(2차에서 거울에 첨부 이름이 생기면 후보로).
- 거울에 조각 번호가 없어 첨부는 «이름»으로 집는다(열 때 `link.name` 으로 찾는다). 같은 이름 첨부가 둘이면 첫 것이 열린다(지문 확인 없음 — `fetchOriginal` 의 sha 관문은 여기 없다).
- `readMailMessage`(peek)는 첨부 목록과 함께 본문도 돌려준다 — 화면은 받자마자 버린다(서버는 고치지 않았다).
- 폴더 slug 가 길어 열쇠가 80자를 넘으면 「연결」이 잠긴다(열어 보기는 된다).
- 받은 서류함은 칸 창을 다시 그리지 않는다(`#cwInbox` 만) — 적던 값이 날아가지 않게. 저장이 끝날 때만 칸 창 전체를 다시 그린다.
- 후보는 업체관리·`data/companies` 에 «등록된 메일 주소»가 있어야 나온다. 주소가 없는 업체는 칸 창에 안내 문구가 뜬다. 회차 날짜가 없는 사업은 기간 거름 없이 모든 첨부 메일이 후보가 된다.
- 메일함 거울 읽기는 폴더마다 최근 3,000통까지다. 그보다 오래된 메일은 후보에 없다.
- 읽기 시간 제한(timeout)은 이미 나간 요청을 중단하지 않는다 — 화면만 실패로 바꾸고 서버 쪽 요청은 끝까지 간다.
- SheetJS 0.18.5(표 열기용)는 오래된 판이다 — 저장소 전체 판 올리기는 따로 할 일이다.
- 열어 보기 창(`#attv`)에는 Esc 키 처리가 없다 — 「돌아가기」 버튼으로만 닫힌다.
- AI 를 쓰지 않는다 · 첨부 바이트를 저장하지 않는다 · 어디에도 올리지 않는다(열 때 서버에서 받아 화면에서만 본다).
- 기술보호 첨부의 «30일 뒤 삭제 안내» · «반납 대상» 딱지는 만들지 않았다(협력재단 확인 대기).
- 실제 메일·첨부는 가짜 서버로만 시험했다 — 배포 뒤 로그인해 후보 목록과 첨부 열기를 확인해야 한다(STATUS 「확인 필요」).

## 검사

- 전체 `node --test "tests/**/*.test.js"` (2026-10-11 이 작업에서 다시 돌림): 24,843 건 중 통과 24,778 · 실패 0 · 건너뜀 65.
