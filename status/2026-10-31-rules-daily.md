# 🤖 취업규칙 — 매일 정리: 사업장 자동 확정 · 처리 담당 · 하루 기록 (2026-10-31)

상태: **켜짐(live)** — 2026-10-31 15:48 클라우드 방이 GitHub 「Firebase 배포」로 함수 배포·켜기(`status/2026-10-31-cloud-deploy.md`). 첫 결과 확인 대기

대표: 「푸른메일함에 자동으로 들어오는 취업규칙 등 개정사항에 대하여 자동으로 정리해서 보관하게 해라 매일 체크하고 사업장 정리하고
담당자 체크해서 누가 업무처리하는 부분인지 정리하고 기록해달라」 → 목업(세 물음) → 「추천대로」.
설계 `docs/superpowers/specs/2026-10-03-취업규칙-새로짓기-design.md` §14.

## 이미 있던 것
- 보관 — `collectRulesMail`(30분마다 깨어 밀린 것이 없으면 하루 한 번)이 취업규칙·사규·인사/복무규정·규정 개정·변경신고 첨부를 가린 사본으로 📥 모은 자료에 담는다(10-03 부터).
- 사업장 — 서버는 후보만, 확정은 사람(🧹 정리하기·「이 회사 자료 맞음」).

## 이번에 한 것
| 자리 | 무엇 |
|---|---|
| `js/rules-v2/lib-daily.js` (새, 화면·서버 공용) | 자동 확정 계획(`plan`) — 🧹 정리하기 셈(lib-tidy groups)을 «그대로» 딛고 (가) 단계 1·일괄 가능 (나) **사람이** 앞서 확정한 주소만. 처리 담당(`ownerOf`) · 하루 기록(`summary`) |
| `functions/rules-daily.js` (새) | 회차 끝 서버 일 — ① 처리 담당을 메일함 잣대(`mail-owner whoAll`)로 `docs/{id}/owner` 에(바뀐 것만) ② 스위치가 live 일 때만 `human/{id}` 에 `linkedBy:'자동'`(트랜잭션 — 그 사이 사람이 손댔으면 안 씀, 기록 먼저) ③ `auto/last`·`auto/log/{날짜}`. 던지지 않는다 |
| `functions/index.js` | `rulesCollectOnce` — 이어 달리기의 «마지막» 회차 끝에서 한 번 부른다(잠겨 돌려보낸 회차는 안 함) |
| `functions/rules-daily-core/` · `scripts/sync-rules-daily-core.js` | 셈 모듈 서버 사본(lib-daily → lib-tidy → lib-order·lib-topics) — 같음 검사 |
| `scripts/make-firebase-rules.js` | `rules_mgmt/library/auto` — 읽기 재직 직원 · cfg 쓰기 관리자·위임관리인 · last/log 쓰기 문 없음. 적용본 다시 만듦. **게시 대기**(PENDING 한 줄) |
| `js/pu-ontology.js` | rulesv2 쓰기 계약에 `auto/cfg`(Task) · 캐시 78→79(27개 화면) |
| `js/rules-v2/store.js` | 기록 읽기(못 읽어도 모은 자료는 열림) · `undoAuto`(미확정 + `noAuto`) · `setAutoMode` · 캐시 4→5(두 화면) |
| `js/rules-v2/view-daily.js` (새) · `view-library.js` · `rules-v2.html` | 📥 네 번째 보기 «🤖 매일 정리» — 판(모드·마지막·오늘 숫자·담당 칩·지난 6일) + 표(☐·№·담은 때·사업장·서류·처리 담당·정리·손잡이) · 관리자 스위치 · 되돌리기 · 폰은 두 줄 카드 |
| `tools/phone-audit/seeds/rules.js` | «오늘» 서류 6건·지난 기록 + view `daily` |

## 지킨 것
- 자동 확정은 **처음엔 시범** — «했을 것»만 기록, 사람 칸은 안 쓴다. 켜는 것은 관리자(규칙 MGR).
- 도메인·이름 단서·섞인 묶음·우리 주소·끝난 업체·**사람이 손댄 서류**·**되돌린 주소**는 자동 확정하지 않는다. 자동 확정은 다시 «앞서 확정» 근거가 되지 않는다.
- ★최종본은 안 건드린다. 기록에 메일 주소·제목·본문 없음(서류 id·업체 id·수·담당 이름만).
- 알림은 안 보낸다(대표 ③ — 새 메일 알림은 메일함이 이미 보낸다).

## 검사
- 새: `rules-daily`(12) · `rules-daily-server`(6) · `rules-daily-view`(6) · `rules-daily-rules`(4) · `rules-daily-core-in-sync`(3) · `rules-v2-store`(+3, 읽기 모양 검사는 auto 를 더해 고침).
- 안전장치를 하나씩 빼 보면 운다(직접 확인): 일괄 가능 · 사람 확정만 근거 · 되돌린 주소 · 끝난 업체 · 사람 손댄 것 · 트랜잭션 재확인 · off · 담당 바뀐 것만 · 시범인데 씀.
- 실제 브라우저(가짜 로그인·지어낸 자료)로 9개 흐름 통과(거르기·☐ 막대·되돌리기→noAuto·스위치·보기 바꾸면 고른 것 비움), 화면 오류 0.
- 폰 점검 360·411px 옆넘침·화면밖·두줄단추·작은단추·작은입력 0 · 양옆 10px. 1366px 두줄단추 0(작은단추 7 은 PC 표의 15px ☐ — 다른 표와 같음).

## 배포(대표 PC) — `STATUS.md` 「2. 지금 손이 필요한 것」에도 적었다
1. `node scripts/rules-deploy.js --deploy` → 콘솔 원문 새 판 → `tests/photos-staff-share.test.js` PENDING 비우기
2. `firebase deploy --only functions:collectRulesMail,functions:collectRulesMailAsk`
3. 다음 날 📥 모은 자료 › 🤖 매일 정리 에서 «자동 확정했을 것»을 훑고 → 관리자 「켜기」

## 남은 일
- [x] 배포·켜기 — 2026-10-31 GitHub 작업 실행 41177914318(대표 「매일정리켜기 니가 직접해라」라 시범(dry)을 건너뛰고 바로 live).
- [ ] 첫 «켜기» 때는 쌓여 있던 미확정(확정 기다림) 가운데 조건에 맞는 것이 한 번에 확정된다(한 회차 100건, 넘치면 다음 회차) — 시범 결과로 수를 먼저 본다.
- [ ] 메일 순 표에도 «처리 담당» 칸을 둘지(지금은 🤖 보기에만).
