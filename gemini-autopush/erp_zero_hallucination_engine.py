from __future__ import annotations


import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, TypedDict




def normalize_nfc(text: Optional[str]) -> str:
    if not text:
        return ""
    cleaned = unicodedata.normalize("NFC", str(text)).replace("\x00", "")
    return re.sub(r"[ \t]+", " ", cleaned).strip()




def normalize_dot_date(value: Optional[str]) -> str:
    s = normalize_nfc(value).replace("-", ".").replace("/", ".")
    m = re.match(r"^(\d{4})\.(\d{1,2})\.(\d{1,2})$", s)
    if not m:
        return s
    return f"{m.group(1)}.{m.group(2).zfill(2)}.{m.group(3).zfill(2)}"




@dataclass
class ErpEvidence:
    evidence_id: str
    domain: str
    doc_id: str
    title: str
    organization: str
    doc_date: str
    start_date: str
    end_date: str
    attachment_status: str
    attachment_url: str
    excerpt: str
    score: float = 1.0
    extra: Dict[str, Any] = field(default_factory=dict)




class ErpChatState(TypedDict, total=False):
    question: str
    filters: Dict[str, Any]
    evidences: List[Dict[str, Any]]
    status: str
    answer: str
    citations: List[str]
    grounded_ok: bool




DOMAIN_KEYWORDS = {
    "appointment": ["위촉", "위촉장", "강사", "위원", "심의"],
    "career": ["경력", "자격증", "수료증", "표창", "학력", "기업경력"],
    "performance": ["실적", "사건", "컨설팅", "일터혁신", "기금", "강의", "자문", "고문", "제출서류"],
    "resume": ["이력서", "프로필", "서류", "보관함", "요청 메일"],
    "project": ["사업", "수행", "결과", "입찰", "제안", "충남경제진흥원", "노사발전재단"],
    "hr_payroll": ["급여", "임금", "근태", "연차", "4대보험", "퇴직금", "입사", "퇴사"],
}




def extract_query_filters(question: str) -> Dict[str, Any]:
    q = normalize_nfc(question)
    doc_id_match = re.search(r"((?:위촉장|자격증|수료증|계약|사업|사건)\s*\d{4}-\d+|[A-Za-z가-힣]+-\d{4}-\d+)", q)
    years = re.findall(r"\b(20\d{2})\b", q)
    dates = [normalize_dot_date(d) for d in re.findall(r"\b20\d{2}[./-]\d{1,2}[./-]\d{1,2}\b", q)]


    detected_domains = [
        dom for dom, words in DOMAIN_KEYWORDS.items() if any(w in q for w in words)
    ]
    asks_attachment = any(w in q for w in ["첨부", "원본", "사본", "파일", "스캔", "pdf", "hwp", "hwpx"])
    asks_count = any(w in q for w in ["몇 건", "몇건", "건수", "총 몇", "합계", "개수"])


    stop_words = {"있나요", "있어", "없어", "알려줘", "찾아줘", "검색해줘", "확인해줘", "무엇", "언제", "어디"}
    tokens = [
        t for t in re.findall(r"[가-힣A-Za-z0-9.-]{2,}", q)
        if t not in stop_words
    ]


    return {
        "raw": q,
        "doc_id": normalize_nfc(doc_id_match.group(1)) if doc_id_match else "",
        "years": years,
        "dates": dates,
        "domains": detected_domains,
        "asks_attachment": asks_attachment,
        "asks_count": asks_count,
        "tokens": tokens,
    }




def strict_match_evidences(
    filters: Dict[str, Any],
    candidates: List[ErpEvidence],
) -> List[Dict[str, Any]]:
    target_doc_id = filters.get("doc_id", "").replace(" ", "")
    target_years = filters.get("years") or []
    target_dates = filters.get("dates") or []
    tokens = [t for t in (filters.get("tokens") or []) if len(t) >= 2]


    matched: List[Dict[str, Any]] = []
    seen = set()


    for item in candidates:
        if item.evidence_id in seen:
            continue
        seen.add(item.evidence_id)


        searchable = normalize_nfc(
            f"{item.evidence_id} {item.doc_id} {item.title} {item.organization} "
            f"{item.doc_date} {item.start_date} {item.end_date} {item.excerpt} "
            + " ".join(f"{k}:{v}" for k, v in item.extra.items())
        )
        compact_searchable = searchable.replace(" ", "")


        if target_doc_id and target_doc_id not in compact_searchable:
            continue
        if target_years and not any(y in searchable for y in target_years):
            continue
        if target_dates and not any(d in searchable for d in target_dates):
            continue
        if tokens:
            hit_count = sum(1 for tok in tokens if tok.replace(" ", "") in compact_searchable)
            if hit_count == 0:
                continue


        matched.append(
            {
                "evidence_id": normalize_nfc(item.evidence_id),
                "domain": normalize_nfc(item.domain),
                "doc_id": normalize_nfc(item.doc_id),
                "title": normalize_nfc(item.title),
                "organization": normalize_nfc(item.organization),
                "doc_date": normalize_dot_date(item.doc_date),
                "start_date": normalize_dot_date(item.start_date),
                "end_date": normalize_dot_date(item.end_date),
                "attachment_status": normalize_nfc(item.attachment_status),
                "attachment_url": normalize_nfc(item.attachment_url),
                "excerpt": normalize_nfc(item.excerpt),
                "extra": {k: normalize_nfc(v) for k, v in item.extra.items()},
            }
        )


    return matched




def verify_response_grounding(answer: str, evidences: List[Dict[str, Any]]) -> bool:
    clean_answer = normalize_nfc(answer)
    if not clean_answer:
        return False


    evidence_text = normalize_nfc(
        " ".join(
            f"{e['evidence_id']} {e['doc_id']} {e['title']} {e['organization']} "
            f"{e['doc_date']} {e['start_date']} {e['end_date']} {e['attachment_status']} {e['excerpt']} "
            + " ".join(e.get("extra", {}).values())
            for e in evidences
        )
    )


    for dt in re.findall(r"\b20\d{2}[./-]\d{1,2}[./-]\d{1,2}\b", clean_answer):
        if normalize_dot_date(dt) not in evidence_text:
            return False


    for code in re.findall(r"(?:위촉장|자격증|수료증|계약|사업|사건)\s*\d{4}-\d+", clean_answer):
        if normalize_nfc(code).replace(" ", "") not in evidence_text.replace(" ", ""):
            return False


    all_missing = all(e.get("attachment_status") == "MISSING" for e in evidences)
    if all_missing and any(p in clean_answer for p in ["첨부되어 있", "첨부파일이 있", "원본이 등록되어"]):
        return False


    return True




def run_erp_grounded_pipeline(
    question: str,
    sql_search_fn: Callable[[Dict[str, Any]], List[ErpEvidence]],
    hybrid_doc_search_fn: Callable[[Dict[str, Any]], List[ErpEvidence]],
    llm_call_fn: Optional[Callable[[str, str, List[Dict[str, Any]]], Dict[str, Any]]] = None,
) -> ErpChatState:
    filters = extract_query_filters(question)
    raw_candidates = sql_search_fn(filters) + hybrid_doc_search_fn(filters)
    evidences = strict_match_evidences(filters, raw_candidates)


    if not evidences:
        target = filters["doc_id"] or filters["raw"]
        return {
            "question": filters["raw"],
            "filters": filters,
            "evidences": [],
            "status": "NO_DATA",
            "answer": f"해당 데이터가 없습니다. (조회 조건: {target})",
            "citations": [],
            "grounded_ok": True,
        }


    if llm_call_fn is None:
        lines = []
        cites = []
        for ev in evidences[:10]:
            attach_label = {
                "ATTACHED": "첨부완료",
                "CLOUD_ONLY": "클라우드 사본 연결",
                "MISSING": "첨부파일 없음(원본 미등록)",
            }.get(ev["attachment_status"], ev["attachment_status"])
            period = (
                f"{ev['start_date']} ~ {ev['end_date']}"
                if ev["start_date"] or ev["end_date"]
                else ev["doc_date"]
            )
            lines.append(
                f"- [{ev['doc_id'] or ev['evidence_id']}] {ev['title']} | 기관: {ev['organization'] or '-'} | 기간/일자: {period or '-'} | 첨부: {attach_label}"
            )
            cites.append(ev["evidence_id"])
        return {
            "question": filters["raw"],
            "filters": filters,
            "evidences": evidences,
            "status": "FOUND",
            "answer": "\n".join(lines),
            "citations": cites,
            "grounded_ok": True,
        }


    llm_out = llm_call_fn("STRICT_GROUNDED", filters["raw"], evidences)
    answer = normalize_nfc(llm_out.get("answer", ""))
    valid_ids = {e["evidence_id"] for e in evidences}
    citations = [c for c in (llm_out.get("citations") or []) if c in valid_ids]


    if not citations or not verify_response_grounding(answer, evidences):
        return {
            "question": filters["raw"],
            "filters": filters,
            "evidences": evidences,
            "status": "BLOCKED_HALLUCINATION",
            "answer": "근거 데이터 검증 기준을 통과하지 못해 답변을 차단했습니다. 등록된 원본 항목을 직접 확인해 주세요.",
            "citations": [],
            "grounded_ok": False,
        }


    return {
        "question": filters["raw"],
        "filters": filters,
        "evidences": evidences,
        "status": "FOUND",
        "answer": answer,
        "citations": citations,
        "grounded_ok": True,
    }