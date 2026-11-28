from __future__ import annotations


import json
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional
from urllib import error, request




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




def detect_garbled_or_scanned(text: str) -> bool:
    norm = normalize_nfc(text)
    if len(norm) < 8:
        return True
    broken = len(re.findall(r"[\uFFFD\uFFFE\uFFFF\u25A1\uE000-\uF8FF]", norm))
    return (broken / len(norm)) > 0.03




def map_career_or_appointment_row(row: Dict[str, Any]) -> Dict[str, Any]:
    doc_id = normalize_nfc(row.get("doc_id") or row.get("id") or "")
    category = normalize_nfc(row.get("type") or row.get("category") or "위촉장")
    title = normalize_nfc(row.get("title") or row.get("role") or "")
    org = normalize_nfc(row.get("organization") or row.get("issuer_org") or "")
    issuer = normalize_nfc(row.get("issuer") or row.get("appointer") or "")
    doc_date = normalize_dot_date(row.get("issue_date") or row.get("doc_date") or "")
    start_date = normalize_dot_date(row.get("start_date") or "")
    end_date = normalize_dot_date(row.get("end_date") or "")
    att_url = normalize_nfc(row.get("attachment_url") or row.get("cloud_url") or "")
    raw_body = normalize_nfc(row.get("extracted_text") or row.get("memo") or "")


    if att_url and row.get("is_local_attached"):
        att_status = "ATTACHED"
    elif att_url:
        att_status = "CLOUD_ONLY"
    else:
        att_status = "MISSING"


    if not raw_body:
        parse_status = "METADATA_ONLY"
        safe_text = normalize_nfc(f"{doc_id} {category} {title} {org} {issuer} {doc_date} {start_date} {end_date}")
    elif detect_garbled_or_scanned(raw_body):
        parse_status = "NEEDS_OCR_OR_MANUAL"
        safe_text = normalize_nfc(f"{doc_id} {category} {title} {org} {issuer} {doc_date} {start_date} {end_date}")
    else:
        parse_status = "OK"
        safe_text = normalize_nfc(f"{doc_id} {category} {title} {org} {issuer} {doc_date} {start_date} {end_date} {raw_body}")


    domain = "appointment" if category == "위촉장" else "career"
    record_key = f"{domain.upper()}:{doc_id or title}"


    return {
        "record_key": record_key,
        "domain": domain,
        "doc_id": doc_id,
        "title": title,
        "organization": org,
        "issuer_or_owner": issuer,
        "doc_date": doc_date,
        "start_date": start_date,
        "end_date": end_date,
        "attachment_status": att_status,
        "attachment_url": att_url,
        "parse_status": parse_status,
        "structured_json": {
            "유형": category,
            "위촉인": issuer,
            "첨부상태": att_status,
        },
        "searchable_text": safe_text,
    }




def upsert_records_to_supabase(
    records: List[Dict[str, Any]],
    supabase_url: Optional[str] = None,
    service_role_key: Optional[str] = None,
    table: str = "erp_knowledge_records",
) -> Dict[str, Any]:
    base_url = (supabase_url or os.getenv("SUPABASE_URL", "")).rstrip("/")
    api_key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not api_key:
        return {"ok": False, "reason": "MISSING_ENV", "count": len(records)}


    url = f"{base_url}/rest/v1/{table}?on_conflict=record_key"
    payload = json.dumps(records, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url,
        data=payload,
        headers={
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as resp:
            return {"ok": resp.status in (200, 201, 204), "status": resp.status, "count": len(records)}
    except (error.URLError, error.HTTPError, TimeoutError) as exc:
        return {"ok": False, "reason": str(exc), "count": len(records)}