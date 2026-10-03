# 2026-10-03 MCP — 학교 빼고 여섯 연결

대표 지시: 「학교 빼고 모두 연결해서 사용하고 싶다.」

## 한 일
- `.mcp.json` 에서 `schoolinfo`(학교) 를 뺐다. CLAUDE.md·AGENTS.md 안내도 함께 고쳤다.
- 법령(korean-law) 이 안 켜지던 진짜 까닭: 열쇠가 아니라 **npx 캐시가 깨져서**(ENOTEMPTY).
  판 없는 `npx -y korean-law-mcp` 가 켤 때마다 새로 받다 꼬였다 → `korean-law-mcp@4.15.5` 로 고정.
  캐시를 지우니 서버 자체는 정상으로 켜짐을 확인했다(initialize 응답).
- `tests/mcp-config-no-secrets.test.js` 에 ⑤ npx 판 고정 · ⑥ 학교 재유입 금지 추가 (돌연변이 둘 다 걸림).

## 지금 상태
| 이름 | 상태 |
|---|---|
| 통계·건축·특허 | 바로 쓴다 (열쇠 없는 원격) |
| 문서(kordoc) | 바로 쓴다 (내 PC 안에서) |
| 법령 | 켜진다. 조회에는 `LAW_OC`(법제처, 무료) 가 있어야 한다 |
| 공시(DART) | `DART_API_KEY`(opendart.fss.or.kr, 무료) 를 넣어야 켜진다 |

## 남은 일 (사람)
- `LAW_OC`·`DART_API_KEY` 를 받아 각 PC 환경변수 / 클라우드 환경 비밀값에 넣는다 — 저장소에는 절대 적지 않는다.
- claude.ai 팀 채팅에서도 쓰려면 조직 관리자가 claude.ai/customize/connectors 에 원격 주소(통계·건축·특허·법령)를 등록.
