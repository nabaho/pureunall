상태: 이어하기 대기
작업폴더: C:\Users\fair0\Documents\pu-wt-security
가지: security/office-audit-1014
이어하기시도: 0

# 사무실 전체 보안 검토 — 순서대로 다 (2026-10-14, security/office-audit-1014)

대표 「사무실 모든 프로그램 보안과 관련해서 어떻게 해결해야할지 검토하고싶다」 → 다섯 단계 제안 → 「순서대로 모두해라」.

⚠ 이 저장소는 공개다. **아직 안 막은 구멍의 자세한 내용은 여기 적지 않는다.**
전체 보고서(층별 현황·남은 일·대표 PC 실측)는 대표 PC 의 `pureunall/data/보안검토/보안-현황-2026-10-14.md`
(git 이 무시하는 자리)에 있다.

## 뿌리 하나
파이어베이스 가입이 열려 있다(익명 로그인 — 전자서명 링크 — 때문에 끌 수 없다).
그래서 «로그인했다»·«이메일이 있다»·«도메인 이메일이다»는 모두 «직원이다»가 아니다.
잣대는 하나 — `uid_roles` 재직자(sid + status active). 규칙 LOGIN · 서버 staff-gate · 창고 staff 표시가 모두 이것이다.

## 끝낸 것
1. 실시간DB — 옛 MAIL(이메일만 있으면) 23곳 → LOGIN. **게시 완료**(콘솔 다시 읽어 같음, 기준 `docs/firebase-rules-콘솔원문-2026-10-14.json`)
2. 서버 — requireStaff·requireReader·지문 등록에 재직자 문(`functions/staff-gate.js`)
3. 화면 — PDF 미리보기 isEvalSupported:false 빠진 5곳 · 자료함 주소 https 만
4. 공개 자료 — 이알피 2026 경비 시드·`reference/puerp` 삭제 · 배포에서 android/·.gitignore·firebase.database.json 제외
5. 창고 — 서버가 재직자에게 staff 표시(`functions/staff-claim.js`) + isStaff() 가 그것을 함께 봄(코드·승인 파일까지)
6. `docs/보안-사무실-점검표.md` — PC·계정·퇴사자·NAS·네트워크 분기 점검표

검사: 전체 26,269 · 실패 0(마지막 묶음 기준). 새 검사마다 고장넣기로 무는 것 확인.

## 남은 일 (순서 중요)
- [ ] 서버 함수 배포 — 문을 지나는 18개 + 새 2개(staffClaimOnRole·staffClaimSweep)
- [ ] 배포 뒤 staffClaimSweep 기록으로 «재직자 10명에게 새김» 확인 → **한 시간 넘게 기다린 뒤** 창고 규칙 게시
      (`node scripts/storage-rules-deploy.js --deploy`) → 콘솔 원문 새 날짜 파일 · 승인 줄 지우기
      ⚠ 거꾸로 하면 직원 사진첩·급여데이터함이 멎는다
- [ ] PR 합치기(화면·공개 자료 고침은 합치면 자동 배포)
- [ ] 대표 결정: 저장소 비공개(GitHub Pro $4/월 권장 — STATUS.md 「대표 결정 대기」) · 그 밖은 비공개 보고서 4절

## 하지 말 것 (감시가 이어 할 때도)
- 푸시·배포·규칙 올리기·이력 덮어쓰기·저장소 공개범위 변경 — 사람 몫
- 시스템/보안 설정 «변경» — 읽기만
- 남은 구멍의 자세한 내용을 저장소(docs·status·커밋)에 적기
