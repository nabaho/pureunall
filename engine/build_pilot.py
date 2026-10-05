# -*- coding: utf-8 -*-
"""
핵심루프용 파일럿 급여 데이터 생성 — 파일럿 3그룹(이름 표는 자료 폴더의 pilot_branches.json)
- parser_output(직원별) → 사업장/월(시트)별로 묶고, 엔진 규칙으로 신호(3색) 부여.
- 앱(payroll-os.html)이 payroll_os/payroll 에 올려 급여 처리 화면에 표시.
- 주민번호 없음(성명만). 결과: _harness_out/pilot_payroll.json
"""
import os, json, re, sys
DATA_ROOT = os.environ.get("PAYROLL_DATA_ROOT",
    r"C:\Users\fair0\OneDrive\바탕 화면\급여아웃소싱 서류들")
OUT_DIR = os.path.join(DATA_ROOT, "_harness_out")

# ── 지점 분리 (2026-09-05) ──────────────────────────────────────────
# 파일럿 3그룹은 지점·매장마다 사업장관리번호가 각각 다른 **별개 사업장**이다.
# 예전엔 이름 앞부분만 보고 한 덩어리로 묶었는데, 그러면 어느 지점 파일이 한 달
# 빠졌을 때 그 지점 직원이 전원 퇴사한 것처럼 보였다(상실추정 노이즈).
# 신고·연차·퇴직정산은 모두 사업장 단위라 여기서 갈라 두어야 한다.
# ⚠ 이름은 설정카드(site_cards)와 맞춘다 — 이름이 어긋나면 급여일·수신함 매칭이 끊긴다.
# ⚠ **파일명을 먼저** 본다 — 한 가게 폴더 안에 다른 가게 자료가 섞여 있어,
#   경로부터 보면 엉뚱한 가게로 잡힌다.
#
# ⚠ 가르는 표는 **저장소 밖** 자료 폴더의 pilot_branches.json 에 둔다 (2026-10-05).
#   열쇠말은 **실제 파일 경로**와 맞춰 보는 글자라 실제 업체 이름이어야 한다. 표가
#   코드에 있을 때 보안 정리(업체·사람 이름 걷어내기, 2026-09)가 가짜 이름으로 바꿔
#   하나도 안 맞게 됐다. 저장소엔 장치만, 이름은 자료 폴더에 둔다
#   (build_site_cards 의 folder_split.json 과 같은 꼴). 꼴:
#     {"pilots": ["경로에 이 말이 있으면 파일럿", ...],
#      "branches": [["사업장 이름", ["열쇠말", ...]], ...]}
#   · branches 는 위에서부터 본다 — 먼저 적은 것이 이긴다(「OO 서산점」을 묶음 이름보다 먼저).
#   · 표가 없거나 깨졌거나 아무것도 안 걸리면 **결과 파일을 덮어쓰지 않고 멈춘다** —
#     빈 결과로 조용히 덮으면 급여 화면에서 파일럿 사업장이 통째로 사라진다.
BRANCH_FILE = os.path.join(DATA_ROOT, "pilot_branches.json")


def _load_branches():
    """(pilots, branches). 표가 없거나 깨졌으면 까닭을 알리고 ([], [])."""
    if not os.path.exists(BRANCH_FILE):
        print("[주의] 지점 표가 없습니다:", BRANCH_FILE)
        return [], []
    try:
        raw = json.load(open(BRANCH_FILE, encoding="utf-8"))
        pilots = [str(k) for k in raw.get("pilots") or [] if k]
        branches = [(str(n), [str(k) for k in keys if k]) for n, keys in raw.get("branches") or []]
    except Exception as e:
        print("[주의] pilot_branches.json 을 못 읽었습니다:", e)
        return [], []
    if not pilots or not branches:
        print("[주의] pilot_branches.json 의 pilots·branches 가 비어 있습니다:", BRANCH_FILE)
        return [], []
    return pilots, branches


_TABLE = None


def _table():
    # 처음 쓸 때 읽는다 — build_payroll_all 은 signal·OUT_DIR 만 가져가므로 표를 안 읽고 주의도 안 뜬다.
    global _TABLE
    if _TABLE is None:
        _TABLE = _load_branches()
    return _TABLE


def pilot_of(path):
    """파일 하나가 어느 사업장 것인지. 지점까지 갈라서 돌려준다."""
    pilots, branches = _table()
    if not any(k in path for k in pilots):
        return None                      # 파일럿 3그룹 밖이면 대상 아님
    base = os.path.basename(path)
    for name, keys in branches:          # ① 파일명 우선(폴더에 딴 업체가 섞여 있다)
        if any(k in base for k in keys):
            return name
    for name, keys in branches:          # ② 파일명에 없으면 경로로
        if any(k in path for k in keys):
            return name
    return None


def signal(emps):
    """검토 2차그물(간이): 실수령<=0 or 공제>지급 있으면 red, 결측 많으면 orange, else green."""
    issues = []
    bad = 0
    for e in emps:
        net = e.get("실수령")
        gross = e.get("지급총액") or e.get("기본급")
        ded = e.get("공제총액")
        if net is not None and net <= 0:
            bad += 1
        if gross and ded and ded > gross:
            bad += 1
    if bad:
        issues.append(f"실수령/공제 이상 {bad}명")
        return "red", issues
    # 성명 없는 등 결측
    miss = sum(1 for e in emps if not e.get("실수령") and not e.get("공제총액"))
    if miss > len(emps) * 0.5:
        issues.append("금액 결측 다수")
        return "orange", issues
    return "green", issues


def main():
    if not _table()[0]:
        print("[멈춤] 지점 표가 없어 어느 파일도 파일럿 사업장으로 못 가릅니다 — "
              "pilot_payroll.json 을 덮어쓰지 않았습니다. 꼴은 이 파일 위쪽 설명을 보세요.")
        sys.exit(1)
    res = json.load(open(os.path.join(OUT_DIR, "parser_output.json"), encoding="utf-8"))
    # 사업장 → [{월, 직원[], 신호, 이슈}]
    out = {}
    DRAFT = ["(안)", "(안 ", "초안", "검토용", "비교", "(수정전"]  # 초안·비교 파일 제외
    for r in res:
        if not r.get("ok"):
            continue
        site = pilot_of(r["path"])
        if not site:
            continue
        base = os.path.basename(r["path"])
        if any(d in base for d in DRAFT):
            continue  # 초안(시나리오 여러 줄) 파일은 제외 — 확정본만
        for s in r["sheets"]:
            # 서식·양식·견본 시트 제외(샘플 데이터 — 명세서 발행 사고 방지)
            if any(k in s["sheet"] for k in ("서식", "양식", "견본", "샘플", "sample")):
                continue
            raw = [{k: v for k, v in e.items()} for e in s["employees"] if e.get("성명")]
            # 일용 명단의 '해당월 무근무' 행(금액 전부 0/없음) 제외 — 급여 레코드 아님
            AMT = ("기본급", "과세총액", "지급총액", "실수령", "공제총액", "소득세", "고용보험")
            raw = [e for e in raw if any(e.get(k) for k in AMT)]
            if not raw:
                continue
            # 사람당 1줄로 정리(같은 성명 중복 시 '가장 잘 맞아떨어지는' 행 유지).
            # 앱의 dedupeEmps()와 동일 기준: 항목 많고 (임금총액−공제=실수령) tie-out 우대.
            def _score(e):
                keys = ("기본급","과세총액","소득세","지방세","국민연금","건강보험",
                        "장기요양","고용보험","공제총액","실수령")
                s = sum(1 for k in keys if e.get(k) is not None)
                g = e.get("지급총액") or e.get("과세총액") or e.get("기본급")
                d, n = e.get("공제총액"), e.get("실수령")
                if g is not None and d is not None and n is not None and abs(g - d - n) <= 1:
                    s += 5
                return s
            seen = {}
            for e in raw:
                nm = e["성명"].strip()
                if nm not in seen or _score(e) > _score(seen[nm]):
                    seen[nm] = e
            emps = list(seen.values())
            sig, iss = signal(emps)
            month = s["sheet"]
            rec = {"월": month, "파일": os.path.basename(r["path"]),
                   "직원수": len(emps), "신호": sig, "이슈": "; ".join(iss),
                   "확정": False, "직원": emps[:60]}  # 표시용 상한
            out.setdefault(site, []).append(rec)
    # 사업장별 정렬(직원수 큰 시트 먼저)
    for site in out:
        out[site].sort(key=lambda x: -x["직원수"])
    if not out:                          # 표는 있는데 하나도 안 걸렸다 — 열쇠말이 실제 경로와 어긋난 것
        print("[멈춤] 지점 표의 열쇠말에 걸린 파일이 하나도 없습니다 — "
              "pilot_payroll.json 을 덮어쓰지 않았습니다:", BRANCH_FILE)
        sys.exit(1)

    payload = {"pilots": list(out.keys()),
               "sites": out,
               "생성": "파일럿 3곳 · 엔진 신호 부여 · 주민번호 미포함"}
    with open(os.path.join(OUT_DIR, "pilot_payroll.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    for site, recs in out.items():
        tot = sum(x["직원수"] for x in recs)
        print(f"{site}: {len(recs)}개월/시트, 직원 연 {tot}건")


if __name__ == "__main__":
    main()
