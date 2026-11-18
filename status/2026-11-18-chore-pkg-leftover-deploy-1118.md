상태: 완료
가지: chore/pkg-leftover-deploy-1118
작업폴더: C:/Users/user/Desktop/github/pureunall/.claude/worktrees/package-mockup-e7bb31

# 2026-11-18 · 수정본 패키지(#2923)의 남은 배포 마무리

- 지시(대표): 「남은거 모두 배포 하고 마무리 해라. 그리고 만약 다른곳에서 코딩이나 충돌이 발생하는지 검토하고 충돌 발생안하게 하고 마무리 해라」.
- 대상: `status/2026-11-05-fix-pkg-pill-erp-cors.md` 「남은 일」 두 줄 + #2924 의 「배포 필요: functions:weeklyNewsBrief」.

## 확인한 것 (배포 전)
| 남은 일 | 지금 상태 | 한 일 |
|---|---|---|
| `rehabAuto` 배포(CORS `*` → 공용 `setCors`) | 11-15 13:43Z 에 이미 다시 올라가 있었다(ERP 주소 이사 때). 다만 그 뒤 main 에 `functions/rehab-letter.js`(11-16 «AI 인사노무 프로그램» 3번 항목, 6f8b12c5)가 바뀌었고 rehabAuto 는 안 올라가 미리보기 글이 실제 자동 메일(sendScheduledMail 11-18 배포)과 달랐다 | GitHub 작업 「Firebase 배포」 `functions=rehabAuto`(main e646c9ad) 로 다시 올림 — run 44259083514 성공(rehabAuto 판 6→7, 2026-11-18 07:30Z) |
| `weeklyNewsBrief` 배포(#2924 사이트맵 한 줄 더하기) | 11-15 16:13Z 에 올라가 있음. 그 뒤 main 에서 `notice-lib.js`·`homepage-fetch.js`·함수 본문 변경 없음 | 할 일 없음 |
| 홈페이지 저장소(pureun-site) `sitemap.xml` 의 `notice/140` | 이미 들어가 있음(138~142 연속) · 실제 `https://pureunlabor.co.kr/sitemap.xml` 에도 있고 `/notice/140/` 은 200 | 할 일 없음 |

## 부딪힘 점검
- 열린 PR 22개 중 `functions/index.js` 를 건드리는 것은 #3168(발신 주소)·#3165(메일 자동검토)·#3012(공문 달력) — 셋 다 rehabAuto·회생 파일과 겹치지 않는다. 배포는 main 기준이라 합치지 않은 코드는 올라가지 않는다.
- 회생 쪽 함수 파일(`functions/rehab-*`)을 건드리는 열린 PR 없음.
- 배포 작업은 `concurrency: firebase-deploy` 로 한 번에 하나씩만 돈다 — 시작할 때 도는 배포 없었음.
- 이 가지와 제미나이 사용량 세션 가지(claude/cranky-elbakyan-f6da87) 모두 main 보다 앞선 커밋이 없다. 사용량 막대(`Desktop\github\ai-usage-dashboard`)는 저장소 밖이다.

## 배포 뒤 확인
- `gcloud functions list`: rehabAuto ACTIVE, updateTime 2026-11-18T07:30:12Z, 판 7. 작업 기록 «functions[rehabAuto(asia-northeast3)] Successful update operation».
- 미리 묻기(OPTIONS): `Origin: https://erp.pureunlabor.co.kr` → 204 + `access-control-allow-origin` 그 주소. `Origin: https://example.com` → 허용 머리글 없음(막힘) — 옛 `*` 는 사라졌다.
- 로그인된 화면에서 «미리보기»를 눌러 보지는 않았다(저장·발송은 사람이). 코드가 올라가고 문이 바뀐 것까지 확인.

## 남은 일
- 없음.
