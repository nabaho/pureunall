# 2026-09-18 · 나스 자동 백업 — 방향을 뒤집었다 (설계 + 만들 준비 끝)

가지 `claude/login-start-screen-386qu2` · 대표 지시 「자동화 설계해라」

## 한 줄

**브라우저가 나스에 «올리는» 대신, 나스가 서버에서 «받아 온다».**
그러면 오늘 저녁 내내 막힌 CORS·인증서 벽이 통째로 사라진다 —
CORS 는 브라우저가 지키는 울타리이고, 나스의 `wget` 은 브라우저가 아니다.

## 설계하다 드러난 것 셋

### ① 서버에 이미 매일 백업이 쌓이고 있었다
`serverBackupDaily()` → `serverBackups/{YYYY-MM-DD}`.
관리자 기기가 앱을 열 때 하루 한 번 쓴다. **새로 만들 것이 없다 — 받아 오기만 하면 된다.**

### ②★ 지금 나스에 올리는 파일에는 주민번호가 «평문»이다
`PuRrnSeal` 잠금은 `erpSealSnap` 경로(= `serverBackups`)에만 걸려 있다.
「💾 백업 파일 다운로드」·NAS 업로드가 쓰는 `collectLocal()` 은 localStorage 원문 그대로다.
**새 길은 잠긴 것을 받아 오므로 보안이 «좋아진다».**

### ③★★ 「백업」이라 부르는 것에 칸이 절반쯤 빠져 있다

| 목록 | 칸 수 |
|---|---|
| `FB_ALL_SYNC_KEYS` (서버와 맞추는 칸 전부) | 약 50 |
| `SERVER_BACKUP_KEYS` (서버 백업에 담는 칸) | **21** |

`user_accounts` · `user_dir` · `employment_contracts` · `retirement_settlements` ·
`finance_expense` · `finance_invoice` · `pay_items` · `accounts` · `external_staff` 가
서버 백업에 **안 들어간다.** 자료가 사라진 것은 아니다(`data/*` 에 살아 있다) —
그러나 백업이라 부르는 것에 없다. **이번 설계와 별개의 흠이라 0단계에서 대표님께 여쭌다.**

## 만든 것 (올리기만 하면 되는 상태)

| 파일 | 무엇 |
|---|---|
| `docs/2026-09-18-나스-자동백업-설계.md` | 설계 전문 · 5단계 · 되돌리기 |
| `functions/nas-backup-export.js` | 나스가 부르는 함수. 열쇠 견주기(timingSafeEqual) · 날짜 꼴 검사 · 비밀 걸러내기 · 흔적 남기기 |
| `functions/nas-backup-export.test.js` | 검사 11개 |
| `docs/나스-백업-스크립트.sh` | DSM 작업 스케줄러에 **붙여넣기만** 하면 되는 스크립트 |
| `functions/index.js` | `exports.nasBackupExport` 한 줄 |

## 못 박은 규칙 (검사가 지킨다)

- 열쇠가 서버에 없으면 **«연다»가 아니라 «멈춘다»**
- 열쇠는 `timingSafeEqual` 로 — `===` 는 몇 글자까지 맞았는지가 시간으로 샌다
- 날짜는 `2026-09-18` 꼴만 — 경로를 글자로 잇는 자리다
- 비밀은 **보내기 전에** 뺀다. 무엇을 뺐는지도 말한다(`droppedKeys`)
- 거르는 규칙이 이알피의 `SECRET_KEYS` 와 **글자까지 같다** — 어긋나면 검사가 그 자리에서 운다
- **CORS 머리글을 일부러 안 붙인다** — 열쇠가 새도 브라우저에서는 못 읽는다
- 날짜 고르기는 가벼운 `serverBackupsIndex` 에서 — 고르자고 본문 2~5MB 를 받지 않는다
- 백업이 없으면 404 — **빈 것을 200 으로 주면 나스가 그것으로 지난 백업을 덮는다**
- 나스 스크립트는 **셋을 다 넘겨야** 파일을 바꾼다(크기·`"ok":true`·`"data"`).
  받는 동안은 임시 이름이라 지난 백업을 안 건드린다

전체 검사 17,941개 통과(이알피 + functions).

## 남은 일 — 사람이 해야 하는 것

1. **(대표님)** 열쇠 한 번: `firebase functions:secrets:set NAS_BACKUP_KEY --project pureun-erp`
2. **(대표님/개발)** `firebase deploy --only functions:nasBackupExport --project pureun-erp`
   ⚠ 이 방(클라우드)에는 파이어베이스 로그인이 없다 — 내가 못 올린다
3. **(대표님)** DSM 작업 스케줄러에 `docs/나스-백업-스크립트.sh` 붙여넣기 (열쇠 한 줄만 고침)
4. **(다음 세션)** 3단계 — 이알피 「지금 상태」가 `nas_backup_status` 를 읽게
5. **(대표님께 여쭐 것)** 위 ③ — 백업에 빠진 칸을 늘릴 것인가
