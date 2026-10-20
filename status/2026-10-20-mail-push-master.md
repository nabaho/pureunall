# 2026-10-20 · 받은 메일 폰 알림 «전체 스위치» — 지금은 «꺼짐» (mail-push-master)

대표 「푸른메일함에 받은 메일 폰에서 자동으로 알림기능 중단시켜 달라. 그리고 다음에 활용할 수 있게 기록해 두고
온오프 장치도 체크해 달라」

## 1. 무엇을 멈췄나 — 메일이 «들어올 때» 폰으로 알리는 길은 둘뿐이었다
| 길 | 파일 | 누구 폰으로 | 있던 스위치 |
|---|---|---|---|
| 📬 내 담당 메일 N통 | `functions/mail-owner.js` `notifyOwners` | 그 메일의 담당자 | 사람별 `config/mailPush/{사번}.off` — **📬 띠가 떠 있을 때만** 단추가 보였다 |
| 📥 새 문의 · 보낸이 | `functions/mail-new-inquiry.js` `notifyNewInquiries` | 관리자(대표) | **없음** — 끌 길이 하나도 없었다 |

둘 다 `syncMailbox`(07~21시 3분마다)·`pullMailbox` 가 받은메일함에 «새로 온 줄»을 적은 직후 부른다.
다른 폰 알림은 **안 건드렸다**: 건의함 새 건의(index.js `notifySuggestion`) · 방문 문자 안내(`visitSmsPrepare`) · 출장 알림(`trip-remind`) · 달력(`gcal-proxy`).
보내는 한 자리(`push-admins.js` `sendTo`)에서 막지 않은 까닭 — 거기서 막으면 위 네 가지까지 같이 멎는다(검사가 지킨다).

## 2. 전체 스위치 — `pucards/config/mailPushMaster`
```
{ "off": true, "at": 시각, "by": "누가", "why": "까닭" }
```
- **`off` 가 «정확히 `true`» 일 때만 꺼진다.** 안 적혀 있거나 `false`·`"true"`(글자) 면 켜진 것이다 — 빈 값을 꺼짐으로 읽으면 «만들어 놓고 아무 일도 안 하는 기능»이 된다.
- **읽다가 실패하면 «꺼진 것»으로 본다.** 끄라고 하셨는데 DB 가 흔들렸다고 폰이 울리면 안 된다.
- **끄는 것은 «폰»뿐**이다. 메일 받기·분류·화면의 띠(📬·📥)·새 문의 기록(`mailbox/inq`)은 그대로 돈다.
- 꺼져 있으면 두 길 모두 «담당 계산·기기 찾기·발송 도구 만들기»를 아예 안 한다(10분마다 도는 자리라 헛일이 곧 요금). 서버 로그 `mail-owner {…"off":true}` · `mail-new-inquiry {…"off":true}` 로 알 수 있다.
- 화면: 📬 「내 담당 메일」 띠의 단추가 **「🔕 폰 알림 전체 꺼짐」**(눌러도 안 되는 안내)으로 바뀐다 — 전체가 꺼졌는데 「🔔 폰 알림 끄기」가 보이면 지금 울리는 줄 안다.

## 3. 켜고 끄는 법 (이 PC 의 firebase 로그인으로)
```
# 끄기 (지금 상태)
firebase database:set /pucards/config/mailPushMaster --data "{\"off\":true,\"at\":1792800000000,\"by\":\"대표 지시\",\"why\":\"받은 메일 폰 알림 중단\"}" --project pureun-erp --force
# 다시 켜기 — 둘 중 하나
firebase database:set /pucards/config/mailPushMaster --data "{\"off\":false}" --project pureun-erp --force
firebase database:remove /pucards/config/mailPushMaster --project pureun-erp --force
# 지금 값 보기
firebase database:get /pucards/config/mailPushMaster --project pureun-erp
```
⚠ 다시 켜도 폰이 «바로» 울리지는 않는다 — 폰 기기 등록(`fcm_tokens/{uid}/{token}`)이 있는 사람에게만 간다(지금은 대표 2대뿐, `STATUS.md` 「직원 폰 알림」 절). 켜기 전에 `firebase database:get /fcm_tokens --shallow`.
⚠ 사람별 스위치(`config/mailPush/{사번}`)는 그대로 살아 있다 — 전체가 «켜짐»이어도 그 사람이 껐으면 안 간다.

## 4. 온오프 «장치» 점검 결과
- 있던 것: 사람별 스위치(📬 띠 안, 띠가 있을 때만 보임) — **전체를 한 번에 끄는 길이 없었고, 새 문의에는 스위치가 없었다.**
- 지금: 전체 스위치(위) + 사람별 스위치. 화면에 «전체 켜기/끄기» 단추는 아직 없다 — 위 명령으로 한다.
  (화면 단추가 필요하면 목업부터 — 둘 곳: 📬 띠가 없을 때도 보이는 자리여야 한다.)
- 검사: `tests/mail-push-master.test.js`(10) — 두 길을 «실제로 돌려» 폰으로 가는지 본다 · `tests/mail-mine-band.test.js` 에 화면 단추 2개 더. 되돌려 우는지 8가지 모두 운다.

## 5. 같이 알아 둘 것
- 지금 폰 기기가 등록된 사람은 대표(P-001) 2대뿐이라, 실제로 울리던 곳은 대표 폰이었다.
- 배포 함수: `syncMailbox` · `pullMailbox` (두 길을 가져다 쓴다). 올린 뒤 `pucards/config/mailPushMaster` 를 적었다.
