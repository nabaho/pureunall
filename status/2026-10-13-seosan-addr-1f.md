상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-news-trend
가지: fix/seosan-addr-1f

# 서산지사 주소 «2층 → 1층» 전수 정정

대표 지시 2026-10-13 「서산지사 주소 잘못되었다 1층이다. 관련된 푸른통합시스템 모두 검토해서 주소 모두 고쳐라」.

## 어디가 틀렸고 어디는 이미 맞았나 (저장소 전체 + 살아 있는 DB 대조)
| 자리 | 전 | 후 |
|---|---|---|
| 뉴스레터 꼬리 기본값 `js/pu-news-tpl.js` (HTML·평문 2곳) | 썬샤인빌딩 2층 | 1층 |
| 서버 사본 `functions/news-lib/pu-news-tpl.js` | 같음 | `node scripts/sync-news-lib.js` 로 옮김 |
| 뉴스레터 설정 화면 기본값 `pu-news.html` (cfgSeosanAddr) | 2층 | 1층 |
| **살아 있는 DB `newsletter/config/서산주소`** — 실제 발송에 쓰이는 값 | 2층 | 1층 (이 한 칸만 `database:update`, 다시 읽어 15칸 그대로·다른 칸 변화 없음) |
| 검사 `tests/newsletter-letter.test.js` (값 자체가 규칙 — 주석에 정정 까닭) | 2층 | 1층 |
| 홈페이지 `site/**` 14쪽 · `rehab-letter.js`(서버·화면) · `pu-cards.html` | 1층 | 이미 맞음 — 손대지 않음 |
| ERP 회사정보 `company_info/branches/seosan` | 비어 있음(null) | 손댈 것 없음 |

## 남긴 것
- `docs/homepage-backup/2026-08-16/*` 는 옛 백업이라 그대로 둔다(원본 보존).
- `pu-erp.html` 의 「관리비(썬샤인빌딩)」 은 건물 이름만 든 지출 항목이라 층과 무관.
- 서버 사본(`functions/news-lib`)은 다음 functions 배포 때 함께 나간다 — 설정값이 이미 1층이라 발송에는 지금도 영향 없다.
