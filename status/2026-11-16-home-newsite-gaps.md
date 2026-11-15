# 2026-11-16 · 새 사이트에 없던 길 셋 + 미리보기 sandbox (claude/home-newsite-gaps)

대표 지시 「안되면 건너 뛰고 다음작업 해라」 — 옛 홈페이지(푸른노무법인.kr)를 접은 뒤(#3099) 남은 일.

- **A. 얼굴 사진** — 편집칸 «새 사이트 — 얼굴 사진»(`새사이트사진칸Html`, 노무사면 글 번호 있어도 보임)에서 사진을 담고(`새사진넣기`, 판 `ver` 추가)
  「새 사이트에 올리기」(`publishPeople`)가 «예» 받은 뒤 `site/files/people/<구성원 열쇠>.jpg` 로 먼저 올리고(`그림올리기` — 로고와 같은 길)
  `homepage/members/<k>/photo/site` 에 적은 다음 쪽을 올린다. 우리 사진이 옛 사진보다 먼저(`PuSitePeople.사이트사진`).
  서버 `publishSite` 는 그림 자리 한 겹(`PEOPLE_IMAGE_RE`, SVG 안 받음)만 더 연다. 파일 이름은 RTDB 열쇠 — 이름·사번 안 들어감.
- **B. 글 번호 없는 새 노무사** — 새 사이트 사진 + 대표 «올리기 허락»(publishOk) + 열쇠가 다 있으면 카드(data-srl=`new-…`)로 간다.
  허락 없는 분의 사진은 읽지도·올리지도 않는다(공개 저장소에 먼저 올라가지 않게). 부품을 서버 사본에도 옮겨(sync) 매달 재게시도 같은 잣대.
- **C. 계약 끝난 자문사 로고** — `PuSitePartner.계약끝난로고`(업체 closed·로고 boardSrl 이음·사유 있는 남기기 아님, companyId 로만, 번호 겹치면 안 숨김).
  화면 「새 사이트에 올리기」(publishPartner)와 매달 자동(`homepage-newsite.로고돌기` → `homepage/auto/newsiteLogos`)이 같은 부품을 쓴다.
  숨김 설정에는 적지 않는다(계약이 다시 이어지면 다시 나오게) · 업체를 못 읽으면 판정 안 함 · 한 번에 3장 넘으면 멈춤 · 회사·로고 기록은 안 바꿈.
- **D. 미리보기 sandbox** — `prevFrame`·새 창 미리보기를 `sandbox="allow-same-origin"`(스크립트 막음)으로. 카드가 스크립트 없이 숨는 반죽이라
  미리보기 문서에만 «보이게» 꾸밈 한 줄(`미리보기문서`). 올리는 HTML 에는 안 들어간다.
- 검사: `tests/home-newsite-gaps.test.js` 15건(함수를 떠서 돌림) + 규칙 바뀐 넷(home-live-preview·home-logo-no-clobber·home-old-site-off·site-people-in-sync).
  고장넣기 12개 모두 잡힘 → 원복. 폰 점검(가짜 파이어베이스) 360px 옆넘침·짓눌림 0 — 새 보기 `member-new` 씨앗 추가.
- 남은 것: 「다시 확인」(PuHomeParse·PuHomeDiff)은 숫자 글 번호만 읽어 new-… 카드를 «새로 올릴 것»으로 계속 보일 수 있다 ·
  새 사이트 로고(n…)는 회사와 잇는 길이 없어 계약 종료 판정 대상이 아니다(옛 로고 boardSrl 만) · 구성원 카드의 «창»은 옛 서버 POST 로 여는 반죽이라
  정적 사이트에서 안 열릴 수 있다 [확인 필요 — 이번 범위 밖].
