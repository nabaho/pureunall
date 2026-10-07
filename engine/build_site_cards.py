# -*- coding: utf-8 -*-
"""
설정 카드 자동 초안 생성 (인수인계 로드맵: "과거 대장에서 설정 카드 자동 초안")
- 하네스 산출물을 사업장별 1장 카드(JSON)로 통합:
  담당자 / 급여일 / 산정기간 / 고용보험 단수처리·요율 / 감지된 공제항목 /
  동명이인 주의 / 근태 매칭키 / 직원수·개월수 / 사람확인 필요 항목
- 실제 운영 시스템의 '설정 카드'(사업장별 데이터) 초안. 담당자가 화면에서 확인·수정.
- 결과: _harness_out/site_cards.json, site_cards_summary.txt
"""
import os, json, re
from collections import defaultdict

DATA_ROOT = os.environ.get(
    "PAYROLL_DATA_ROOT",
    r"C:\Users\fair0\OneDrive\바탕 화면\급여아웃소싱 서류들",
)
OUT_DIR = os.path.join(DATA_ROOT, "_harness_out")
WRAP = {"급여", "1. 급여", "급여자료", "기타", "급여관리"}


# 파일 이름 안에서 사업장이 아닌 낱말 — 이것만 남으면 못 알아낸 것이다
FILE_NOISE = ("급여대장", "급여", "명세서", "노임대장", "임금대장", "대장",
              "수정", "최종", "회계법인용", "세액반영", "금액대조", "복사본")
# 법인 표기 — 같은 회사가 「(주)가온바이오」와 「가온바이오」로 갈리지 않게 뗀다
CORP = r'^\s*(\(주\)|\(유\)|㈜|㈜|주식회사|유한회사|합자회사|농업회사법인)\s*'


def _date_tok(t):
    """2026년 · 2월 · 260225 같은 날짜 토막인가."""
    t = (t or "").strip()
    return bool(re.fullmatch(r'\d{4}년|\d{1,2}월|\d{6,8}|\d{4}년\s*\d{1,2}월', t))


def _noise_tok(t):
    t = (t or "").strip()
    if not t or _date_tok(t):
        return True
    if t in FILE_NOISE:
        return True
    s2 = t
    for w in FILE_NOISE:
        s2 = s2.replace(w, "")
    s2 = re.sub(r'\d{4}년|\d{1,2}월|\d{6,8}|\s+', '', s2)
    return not s2


def site_from_filename(name):
    """파일 이름에서 사업장을 뽑는다. 못 찾으면 None.

    ⚠ 담당자 폴더 밑에 **사업장 폴더 없이 파일이 바로** 놓인 경우가 있다
      (2026-08-17 확인: 31곳). 그때 예전에는 **파일 이름이 그대로 사업장**이 되어
      화면에 「…급여대장_260225.xlsx」가 사업장으로 떴다.
      실제 이름들: 「2026년 2월 급여대장_운화헬스케어_260225.xlsx」(급여대장 뒤),
      「서독_2024년 10월 급여대장_241101.xlsx」(맨 앞). 그래서 **잡말·날짜가 아닌
      첫 토막**을 사업장으로 본다.
    """
    base = re.sub(r'\.(xlsx|xlsm|xls|csv|pdf|hwp|hwpx)$', '', str(name or ""), flags=re.I)
    for p in [x.strip() for x in base.split("_") if x.strip()]:
        if _noise_tok(p):
            continue
        s2 = p
        for w in FILE_NOISE:
            s2 = s2.replace(w, "")
        s2 = re.sub(r'\d{4}년|\d{1,2}월|\d{6,8}', '', s2).strip(" -.·")
        if s2:
            return s2
    return None


# 「3월」「2026년 4월」 같은 «달 폴더» — 담당자에 따라 회사별이 아니라 달별로 폴더를 나눈다
# (2026-10-07 확인: 한 담당자는 3월·4월·5월 폴더 안에 「회사이름_2026년03월급여대장_…」).
MONTH_DIR = re.compile(r'^\s*(\d{2,4}\s*년\s*)?\d{1,2}\s*월\s*$')


def _keep_branch(s):
    """「다온식당(본점)」 → 「다온식당 본점」.
    ⚠ site_base 는 끝의 괄호를 떼어 버린다(「(10일)」 같은 꼬리표를 떼려고). 그런데 달 폴더 쪽은
      괄호 안이 **지점**이라 떼면 「다온식당(본점)」과 「다온식당(2공장)」이 한 사업장이 된다.
      그래서 괄호를 빈칸으로 바꿔 지점 이름을 남긴다. 「(주)」「(유)」는 법인 표기라 그대로 둔다."""
    if not s:
        return s
    m = re.match(r'^(.*?)\s*\(([^()]+)\)\s*$', s)
    if m and m.group(2).strip() not in ("주", "유") and m.group(1).strip():
        s = m.group(1).strip() + " " + m.group(2).strip()
    return re.sub(r'\s+', ' ', s).strip()


def raw_site(rel):
    parts = rel.replace("/", "\\").split("\\")
    rest = parts[1:]
    i = 0
    while i < len(rest) and rest[i] in WRAP:
        i += 1
    if i >= len(rest):
        return None
    # 담당자 폴더 바로 밑이 «달 폴더»면 회사는 파일 이름에 있다 — 달 폴더는 건너뛴다.
    # ⚠ 회사 폴더 «안»의 달 폴더(회사/25년 7월/…)는 여기 오지 않는다 — 회사 폴더가 먼저 걸린다.
    if i < len(rest) - 1 and MONTH_DIR.match(rest[i]):
        return _keep_branch(site_from_filename(rest[-1]))
    # 마지막 토막이면 **폴더가 아니라 파일**이다 — 파일 이름에서 뽑는다
    if i == len(rest) - 1:
        return site_from_filename(rest[i])
    s = re.sub(r'^\d+\s*[.\-]\s*', '', rest[i]).strip()
    return s or None


def site_base(s):
    """보여 줄 사업장 이름. 끝의 괄호와 **앞의 법인 표기**를 뗀다.

    ⚠ 앞의 「(주)」를 떼는 까닭 — 같은 회사가 파일마다 「(주)가온바이오」와
      「가온바이오」로 적혀 있어 두 곳으로 갈렸다. 표기만 다른 것은 합친다.
    ⚠ 그러나 **줄임말은 안 합친다** — 「두레」과 「(주)두레가축약품」은 표기 차이가
      아니라 다른 글자다. 같은 회사일 수 있지만 확인 없이 합치면 남의 급여가
      섞인다. 갈라 두고 사람이 판단한다.
    """
    if not s:
        return s
    s = re.sub(CORP, '', s)
    return re.sub(r'\s*[\(\[].*?[\)\]]\s*$', '', s).strip() or s


# ══════ 한 폴더에 여러 회사가 섞인 곳 — 파일 이름으로 나눈다 (대표 승인 2026-10-05) ══════
# 급여관리의 사업장은 «폴더 이름»이다. 그런데 담당자가 계열사·지점을 한 폴더에 모아 둔
# 곳이 있어, 회사 여럿이 한 사업장으로 묶여 있었다. 급여관리를 업체관리 «업체번호»로
# 잇기로 하면서(이름표, 1:1) 이 묶음은 이을 수가 없게 됐다 — 그래서 나눈다.
#
# ⚠ 나누는 표는 **저장소 밖** 자료 폴더의 folder_split.json 에 둔다 — 실제 업체 이름이
#   들어 있어서다(업체·사람 이름을 저장소에서 걷어낸 보안 정리 2026-09). 표가 없으면
#   나누지 않고 예전 그대로 만든다(알리기만 한다). 꼴:
#     {"나누기": {"묶음 이름": [["나눌 이름", ["파일 이름 열쇠말", ...]], ...]}}
#     예) {"나누기": {"새별반찬 3곳": [["새별반찬(모종점)", ["모종"]], ["새별사계절찬", ["사계절찬"]]]}}
#   · 나눌 이름은 업체관리 이름에 맞춘다(앞 법인 표기만 뗀다) — 이름표가 「이름 같음」으로 붙는다.
#   · ⚠ 지점 괄호를 떼지 않는다 — 「(모종점)」「(배방점)」이 한 곳이 된다. 그래서 나눈 이름은
#     site_base 를 다시 거치지 않는다.
#   · 열쇠말은 **파일 이름에서만** 찾는다(경로의 폴더 이름은 묶음 이름이라 다 걸린다).
#     먼저 적은 것이 이긴다. 어느 열쇠말에도 안 걸리는 파일은 묶음 이름 그대로 남긴다.
#   · ⚠ 한 파일 안에 회사별 시트가 섞인 묶음은 이 표로 못 나눈다(시트 단위 일이다).
SPLIT_FILE = os.path.join(DATA_ROOT, "folder_split.json")


def _load_split():
    if not os.path.exists(SPLIT_FILE):
        return {}
    try:
        raw = json.load(open(SPLIT_FILE, encoding="utf-8"))
        return {k: [(n, list(keys)) for n, keys in v] for k, v in (raw.get("나누기") or {}).items()}
    except Exception as e:                      # 표가 깨졌으면 나누지 않는다 — 조용히 넘기지는 않는다
        print("[주의] folder_split.json 을 못 읽었습니다 — 묶음 폴더를 나누지 않습니다:", e)
        return {}


FOLDER_SPLIT = _load_split()


def split_site(site, path):
    """묶음 폴더의 파일을 회사별 사업장으로 가른다. 묶음이 아니면 그대로."""
    rules = FOLDER_SPLIT.get(site)
    if not rules:
        return site
    base = str(path).replace("\\", "/").split("/")[-1]      # 경로 구분자가 \ 로 온다(윈도)
    for name, keys in rules:
        if any(k in base for k in keys):
            return name
    return site


def site_of(path):
    """파일 하나의 사업장 이름 — 두 생성기(설정카드·급여)가 **이 한 함수**를 쓴다.
    같은 규칙이 두 군데 있으면 카드와 급여의 사업장이 어느 날 다른 이름이 된다."""
    sb = site_base(raw_site(path))
    return split_site(sb, path) if sb else sb


def load(name, default):
    p = os.path.join(OUT_DIR, name)
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))
    return default


def main():
    res = load("parser_output.json", [])
    analyze = load("analyze.json", {})
    period = load("period.json", {})
    rounding = analyze.get("rounding", {})
    payday = analyze.get("payday", {})
    dupe = analyze.get("dupe", {})

    STD_DED = ["소득세", "지방세", "국민연금", "건강보험", "장기요양", "고용보험"]

    # 사업장별 집계
    cards = {}
    agg = defaultdict(lambda: {"handler": None, "emp": 0, "months": set(),
                               "fields": set(), "has_extra_ded": 0, "gaps": []})
    for r in res:
        if not r.get("ok"):
            continue
        sb = site_of(r["path"])
        if not sb:
            continue
        a = agg[sb]
        handler = r.get("handler") or r["path"].replace("/", "\\").split("\\")[0]
        a["handler"] = a["handler"] or handler
        for s in r["sheets"]:
            a["months"].add((os.path.basename(r["path"]), s["sheet"]))
            for e in s["employees"]:
                a["emp"] += 1
                a["fields"].update(e.keys())
                if "기타공제" in e:
                    a["has_extra_ded"] += 1
                # 미등록 공제 차액 = 골든 공제총액 − (표준6 + 기타공제 합)
                if e.get("공제총액") is not None:
                    parts = sum(e[f] for f in STD_DED if e.get(f) is not None) + (e.get("기타공제") or 0)
                    if sum(1 for f in STD_DED if e.get(f) is not None) >= 4:
                        a["gaps"].append(e["공제총액"] - parts)

    def gap_summary(gaps):
        if not gaps:
            return {"판정": "공제총액 대조 불가(항목 부족)", "일치율": None}
        n = len(gaps)
        zero = sum(1 for g in gaps if g == 0)
        nonzero = [g for g in gaps if g != 0]
        pct = round(100 * zero / n)
        info = {"판정": "표준6종으로 완결" if pct >= 90 else "미등록 공제 존재",
                "완결율": f"{pct}%", "표본": n}
        if nonzero:
            nonzero.sort()
            med = nonzero[len(nonzero) // 2]
            info["미등록공제_중앙값"] = med
            info["안내"] = "위 금액대의 사업장 특수공제(상조·기숙사·조합비 등)를 카드에 등록 필요"
        return info

    for sb, a in agg.items():
        rnd = rounding.get(sb, {})
        gapinfo = gap_summary(a["gaps"])
        card = {
            "사업장": sb,
            "담당자": a["handler"],
            "규모": {"직원레코드": a["emp"], "월수": len(a["months"])},
            "급여일": payday.get(sb) or "미확인(사람 지정 필요)",
            "산정기간": period.get(sb) or "미확인(사람 지정 필요)",
            "고용보험": {
                "단수처리": rnd.get("method", "미판정(사람 확인)"),
                "요율": rnd.get("rate", "연도별 자동"),
                "판정근거": f"{rnd.get('match','-')}/{rnd.get('n','-')}명 일치" if rnd else "-",
            },
            "공제항목": {
                "기본6종": ["소득세", "지방세", "국민연금", "건강보험", "장기요양", "고용보험"],
                "기타공제_감지": a["has_extra_ded"] > 0,
                "공제총액_대조": gapinfo,
            },
            "추출필드": sorted(a["fields"]),
            "주의": {
                "동명이인_후보": dupe.get(sb, {}),
            },
            "확인필요": [],
        }
        # 사람 확인 플래그
        if card["급여일"].startswith("미확인"):
            card["확인필요"].append("급여일")
        if card["산정기간"].startswith("미확인"):
            card["확인필요"].append("산정기간")
        if card["고용보험"]["단수처리"].startswith("미판정"):
            card["확인필요"].append("고용보험 단수처리")
        if dupe.get(sb):
            card["확인필요"].append("동명이인 → 주민번호/보조키 매칭")
        if gapinfo.get("판정") == "미등록 공제 존재":
            card["확인필요"].append(f"미등록 공제 등록(추정 {gapinfo.get('미등록공제_중앙값','?')}원대)")
        cards[sb] = card

    with open(os.path.join(OUT_DIR, "site_cards.json"), "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=1)

    # 요약
    L = []
    L.append("=" * 56)
    L.append(f"설정 카드 자동 초안 — {len(cards)}개 사업장")
    L.append("=" * 56)
    ready = [c for c in cards.values() if not c["확인필요"]]
    L.append(f"바로 사용 가능(확인필요 0): {len(ready)}곳 / 사람 확인 필요: {len(cards)-len(ready)}곳")
    L.append("")
    for sb, c in sorted(cards.items(), key=lambda kv: -kv[1]["규모"]["직원레코드"])[:20]:
        L.append(f"■ {sb}  [{c['담당자']}]  직원{c['규모']['직원레코드']}·{c['규모']['월수']}개월")
        L.append(f"   급여일 {c['급여일']} | 산정 {c['산정기간']} | 고용보험 {c['고용보험']['단수처리']}({c['고용보험']['요율']})")
        if c["확인필요"]:
            L.append(f"   ⚠ 확인필요: {', '.join(c['확인필요'])}")
    if len(cards) > 20:
        L.append(f"... 외 {len(cards)-20}곳 (site_cards.json에 전체)")

    out = "\n".join(L)
    with open(os.path.join(OUT_DIR, "site_cards_summary.txt"), "w", encoding="utf-8") as f:
        f.write(out)
    try:
        print(out[:1500])
    except UnicodeEncodeError:
        print("(site_cards_summary.txt 참조)")


if __name__ == "__main__":
    main()
