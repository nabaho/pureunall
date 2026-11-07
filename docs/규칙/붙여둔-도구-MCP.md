# 붙여 둔 도구 · MCP

> CLAUDE.md 에서 글자 그대로 옮긴 원문이다(2026-11-07, 토큰 아껴 쓰기).
> 지킬 것의 핵심은 CLAUDE.md 에 있고, 여기는 그 까닭·사례·명령 설명이다. 둘이 어긋나면 CLAUDE.md 가 이긴다.

## 붙여 둔 도구 — 설치 단계가 없다 (2026-08-30)

계정·PC 가 바뀌어도 같은 도구로 시작하도록 **저장소에 붙여** 두었다.

- `.claude/skills/hwpx/` — 한글(.hwp/.hwpx) 변환·양식 채우기 스킬 (jkf87/hwpx-skill, MIT).
  사업장·공단 서식이 대부분 .hwp 다 — 한글 프로그램 없이 리눅스에서 바꾼다.
  개인정보를 화면에 안 찍고 채우는 `secure_fill.py` 가 주민번호 서식용이다.
  출처·판·쓰는 법은 `.claude/skills/hwpx/푸른-메모.md`.
  한 번만: `python3 -m pip install python-hwpx lxml --break-system-packages`
- `.mcp.json` — 인사(HRMCP)·법령(korean-law)·문서(kordoc)·통계·건축·특허·공시(DART) MCP 연결. 법령은 `LAW_OC`, 공시는 `DART_API_KEY`(무료) 가 있어야 산다. 통계·건축·특허는 열쇠 없는 원격(mcp.gomdori.app).
  ⚠ 원격 넷은 «남의 서버»다 — 질문에 고객 이름·주민번호를 넣지 말 것(운영자가 볼 수 있다).
- 앱 쪽 짝은 `js/pu-form-fill.js` — **브라우저에서** 원본 서식의 `{{토큰}}` 만 바꾼다.
  주민번호가 서버로 안 가야 해서 이 일은 화면 안에서 끝낸다.
  설계와 다음 단계는 `docs/한글서식함-설계.md`.

⚠ 이 셋은 개발용이라 **배포본에 올라가면 안 된다** —
`tests/dev-tools-not-published.test.js` 가 지우는 대목을 실제로 돌려서 확인한다.

## MCP Skills

### korean-law-mcp
한국 법령·판례·행정규칙 검색 MCP 서버 (87개 도구)

**설치:**
```bash
claude mcp add korean-law npx -y korean-law-mcp
```

**주요 도구:**
- `search_law` - 법령 검색 (근로기준법, 노동조합법, 산업안전보건법 등)
- `get_law_text` - 조문 직접 조회
- `search_precedent` - 판례 검색
- `search_ordinance` - 자치법규(조례/규칙) 검색
- `search_interpretation` - 법령해석례 검색
- `search_admin_rule` - 행정규칙 검색

**환경변수:**
```
LAW_OC=<법제처 API 키>  # https://open.law.go.kr 에서 발급
```

**노무법인 주요 활용 예시:**
```bash
# 근로기준법 조문 조회
korean-law "근로기준법 제60조 연차휴가"

# 부당해고 판례 검색
korean-law "부당해고 원직복직 판례"

# 최저임금 관련 법령 검색
korean-law "최저임금법 위반 처벌"

# 산업재해 관련 조문
korean-law "산업안전보건법 중대재해"
```

**JO Code 규칙:**
- 조문번호 6자리 코드 (AAAABB)
- AAAA: 조번호(zero-padded), BB: 의X번호(없으면 00)
- 예: 제38조 → 003800, 제10조의2 → 001002

---

### superpowers (obra/superpowers)
GitHub 별 130k - 에이전트 스킬 프레임워크 & 소프트웨어 개발 방법론 (⭐ 130,000+)

**설치 (Claude Code 공식 마켓플레이스):**
```
plugin install superpowers@claude-plugins-official
```

**또는 마켓플레이스 수동 등록 후 설치:**
```
plugin marketplace add obra/superpowers-marketplace
plugin install superpowers@superpowers-marketplace
```

**업데이트:**
```
plugin update superpowers
```

**주요 스킬 (자동 트리거):**
- brainstorming - 코드 작성 전 아이디어 정제, 설계 검토
- writing-plans - 상세 구현 계획 수립 (2-5분 단위 태스크)
- subagent-driven-development - 서브에이전트 기반 병렬 개발
- test-driven-development - RED-GREEN-REFACTOR TDD 사이클
- systematic-debugging - 4단계 근본 원인 분석 프로세스
- requesting-code-review - 코드 리뷰 요청 전 체크리스트
- using-git-worktrees - 병렬 개발 브랜치 관리
- finishing-a-development-branch - 머지/PR 결정 워크플로우

**특징:**
- 스킬이 자동으로 트리거됨 (별도 호출 불필요)
- TDD, YAGNI, DRY 원칙 강제 적용
- 서브에이전트 기반으로 수 시간 자율 작업 가능
- 저장소: https://github.com/obra/superpowers

---
