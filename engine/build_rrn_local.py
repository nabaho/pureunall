# -*- coding: utf-8 -*-
"""
주민번호 묶음 만들기 — 대표 결정 2026-10-07 「암호화해서 저장」

parser_v1.py --all 이 따로 떼어 낸 rrn_raw.json(파일·시트·성명·주민번호)을
급여관리 사업장 이름(site_of — 설정카드·급여 자료와 같은 규칙)으로 묶는다.

  결과: _harness_out/rrn_local.json
        {"사업장": {"성명": "8001011234567", ...}, ...,  "_동명이인": {"사업장": ["성명", ...]}}

⚠ 이 파일은 «평문»이다. 자료 폴더(이미 원본 급여대장에 주민번호가 있는 곳) 밖으로 옮기지 말 것.
  급여관리에는 「⚙️ 설정 카드 → 주민번호 올리기」로 올리고, 브라우저가 «잠근 뒤에만» 서버에 간다.
⚠ 같은 사업장·같은 이름인데 번호가 둘 이상이면 «동명이인일 수 있다» — 어느 쪽인지 기계가 못 가르므로
  붙이지 않고 _동명이인 으로 따로 둔다(사람이 화면에서 직접 넣는다).

실행:  python engine/build_rrn_local.py
"""
import os
import sys
import json
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_site_cards import site_of, OUT_DIR


def main():
    src = os.path.join(OUT_DIR, "rrn_raw.json")
    if not os.path.exists(src):
        print("rrn_raw.json 이 없습니다 — 먼저 python harness/parser_v1.py --all")
        return
    raw = json.load(open(src, encoding="utf-8"))
    seen = defaultdict(lambda: defaultdict(set))       # 사업장 → 성명 → {번호}
    for r in raw:
        site = site_of(r["path"])
        nm = str(r.get("성명") or "").strip()
        if site and nm and r.get("rrn"):
            seen[site][nm].add(r["rrn"])
    out, dup = {}, {}
    n_ok = n_dup = 0
    for site, people in seen.items():
        for nm, rrns in people.items():
            if len(rrns) == 1:
                out.setdefault(site, {})[nm] = next(iter(rrns))
                n_ok += 1
            else:
                dup.setdefault(site, []).append(nm)
                n_dup += 1
    out["_동명이인"] = {k: sorted(v) for k, v in dup.items()}
    with open(os.path.join(OUT_DIR, "rrn_local.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    # 중간 파일(평문, 파일·시트마다 겹쳐 수 MB)은 다 썼으면 지운다 — 평문 사본은 rrn_local.json 하나로 줄인다.
    #   다시 만들려면 parser_v1.py --all 부터(그때 다시 생긴다).
    try:
        os.remove(src)
    except OSError:
        pass
    print(f"주민번호 묶음: 사업장 {len(seen)}곳 · 사람 {n_ok}명 · 동명이인(번호 둘 이상, 붙이지 않음) {n_dup}명")
    print("→ _harness_out/rrn_local.json (평문 — 자료 폴더 밖으로 옮기지 말 것)")


if __name__ == "__main__":
    main()
