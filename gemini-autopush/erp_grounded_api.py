from __future__ import annotations


import json
import os
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional




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
class ErpRecord:
    record_key: str
    domain: str
    doc_id: str
    title: str
    organization: str
    issuer_or_owner: str
    doc_date: str
    start_date: str
    end_date: str
    attachment_status: str
    attachment_url: str
    parse_status: str
    searchable_text: str
    extra: Dict[str, Any] = field(default_factory=dict)




class GroundedErpChatService:
    """푸른노무법인 ERP 무환각(Zero-Hallucination) 질의 서비스."""


    def __init__(self, records: List[ErpRecord]) -> None:
        self.records = records


    def query(self, question: str) -> Dict[str, Any]:
        q = normalize_nfc(question)
        doc_match = re.search(
            r"((?:위촉장|자격증|수료증|실적|사업|사건|계약)\s*\d{4}-\d+|[A-Za-z가-힣]+-\d{4}-\d+)",
            q,
        )
        target_doc_id = normalize_nfc(doc_match.group(1)).replace(" ", "") if doc_match else ""
        years = re.findall(r"\b(20\d{2})\b", q)
        dates = [normalize_dot_date(d) for d in re.findall(r"\b20\d{2}[./-]\d{1,2}[./-]\d{1,2}\b", q)]


        stop_words = {
            "있어", "있나요", "없어", "없나요", "알려줘", "찾아줘",
            "검색해줘", "확인해줘", "내용", "자료", "대한", "관련",
        }
        tokens = [
            t for t in re.findall(r"[가-힣A-Za-z0-9.-]{2,}", q)
            if t not in stop_words and not re.fullmatch(r"20\d{2}", t)
        ]


        matched: List[ErpRecord] = []
        for rec in self.records:
            safe_body = (
                ""
                if rec.parse_status == "NEEDS_OCR_OR_MANUAL"
                else normalize_nfc(rec.searchable_text)
            )
            blob = normalize_nfc(
                f"{rec.record_key} {rec.doc_id} {rec.title} {rec.organization} "
                f"{rec.issuer_or_owner} {rec.doc_date} {rec.start_date} {rec.end_date} "
                f"{rec.attachment_status} {safe_body} "
                + " ".join(f"{k}:{v}" for k, v in rec.extra.items())
            )
            compact = blob.replace(" ", "")


            if target_doc_id and target_doc_id not in compact:
                continue
            if years and not any(y in blob for y in years):
                continue
            if dates and not any(d in blob for d in dates):
                continue
            if tokens and not any(tok.replace(" ", "") in compact for tok in tokens):
                continue


            matched.append(rec)


        if not matched:
            target_label = doc_match.group(1) if doc_match else q
            return {
                "status": "NO_DATA",
                "question": q,
                "answer": f"해당 데이터가 없습니다. (조회 조건: {target_label})",
                "citations": [],
                "records": [],
            }


        lines: List[str] = []
        citations: List[str] = []
        for r in matched[:15]:
            att_text = {
                "ATTACHED": "첨부완료",
                "CLOUD_ONLY": "클라우드 사본 연결",
                "MISSING": "첨부파일 없음(원본 미등록)",
            }.get(normalize_nfc(r.attachment_status), normalize_nfc(r.attachment_status))


            period = (
                f"{normalize_dot_date(r.start_date)} ~ {normalize_dot_date(r.end_date)}"
                if (r.start_date or r.end_date)
                else normalize_dot_date(r.doc_date)
            )
            line = (
                f"- [{normalize_nfc(r.doc_id) or normalize_nfc(r.record_key)}] "
                f"{normalize_nfc(r.title)} | 기관: {normalize_nfc(r.organization) or '-'} | "
                f"기간/일자: {period or '-'} | 첨부: {att_text}"
            )
            if r.parse_status == "NEEDS_OCR_OR_MANUAL":
                line += " | 본문: 스캔/원본확인 필요(추측 미출력)"
            lines.append(line)
            citations.append(normalize_nfc(r.record_key))


        return {
            "status": "FOUND",
            "question": q,
            "answer": "\n".join(lines),
            "citations": citations,
            "records": [
                {
                    "record_key": r.record_key,
                    "domain": r.domain,
                    "doc_id": r.doc_id,
                    "title": r.title,
                    "organization": r.organization,
                    "attachment_status": r.attachment_status,
                    "parse_status": r.parse_status,
                }
                for r in matched[:15]
            ],
        }