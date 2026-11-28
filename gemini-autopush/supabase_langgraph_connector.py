from __future__ import annotations


import json
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional
from urllib import error, parse, request




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




class SupabaseErpRetriever:
    """Supabase REST API 기반 푸른노무법인 ERP 정형 레코드 및 청크 조회기."""


    def __init__(
        self,
        supabase_url: Optional[str] = None,
        api_key: Optional[str] = None,
        records_table: str = "erp_knowledge_records",
        chunks_table: str = "erp_knowledge_chunks",
    ) -> None:
        self.base_url = (supabase_url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.api_key = (
            api_key
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
            or ""
        )
        self.records_table = records_table
        self.chunks_table = chunks_table


    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key)


    def _get_json(self, path: str, query_params: Dict[str, str]) -> List[Dict[str, Any]]:
        if not self.configured:
            return []
        qs = parse.urlencode(query_params)
        url = f"{self.base_url}/rest/v1/{path}?{qs}"
        req = request.Request(
            url,
            headers={
                "apikey": self.api_key,
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
            },
            method="GET",
        )
        try:
            with request.urlopen(req, timeout=15) as resp:
                body = resp.read().decode("utf-8")
                data = json.loads(body) if body else []
                return data if isinstance(data, list) else []
        except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError):
            return []


    def search_records(self, filters: Dict[str, Any], limit: int = 20) -> List[Dict[str, Any]]:
        if not self.configured:
            return []
        params: Dict[str, str] = {
            "select": "*",
            "limit": str(limit),
            "order": "updated_at.desc",
        }
        doc_id = normalize_nfc(filters.get("doc_id", ""))
        if doc_id:
            params["doc_id"] = f"ilike.*{doc_id}*"


        domains = filters.get("domains") or []
        if len(domains) == 1:
            params["domain"] = f"eq.{domains[0]}"


        rows = self._get_json(self.records_table, params)
        sanitized: List[Dict[str, Any]] = []
        for r in rows:
            p_status = normalize_nfc(r.get("parse_status", "OK"))
            safe_excerpt = (
                "[스캔/압축 문서 격리됨 — 원본 첨부 상태 및 메타데이터만 제공]"
                if p_status == "NEEDS_OCR_OR_MANUAL"
                else normalize_nfc(r.get("searchable_text", ""))[:500]
            )
            sanitized.append(
                {
                    "evidence_id": normalize_nfc(r.get("record_key", "")),
                    "domain": normalize_nfc(r.get("domain", "")),
                    "doc_id": normalize_nfc(r.get("doc_id", "")),
                    "title": normalize_nfc(r.get("title", "")),
                    "organization": normalize_nfc(r.get("organization", "")),
                    "doc_date": normalize_dot_date(r.get("doc_date", "")),
                    "start_date": normalize_dot_date(r.get("start_date", "")),
                    "end_date": normalize_dot_date(r.get("end_date", "")),
                    "attachment_status": normalize_nfc(r.get("attachment_status", "MISSING")),
                    "attachment_url": normalize_nfc(r.get("attachment_url", "")),
                    "excerpt": safe_excerpt,
                    "extra": r.get("structured_json") if isinstance(r.get("structured_json"), dict) else {},
                }
            )
        return sanitized


    def search_chunks(self, filters: Dict[str, Any], limit: int = 15) -> List[Dict[str, Any]]:
        if not self.configured:
            return []
        tokens = [t for t in (filters.get("tokens") or []) if len(t) >= 2]
        if not tokens:
            return []
        first_tok = normalize_nfc(tokens[0])
        params: Dict[str, str] = {
            "select": "chunk_id,record_key,chunk_text,metadata",
            "chunk_text": f"ilike.*{first_tok}*",
            "limit": str(limit),
        }
        rows = self._get_json(self.chunks_table, params)
        results: List[Dict[str, Any]] = []
        for c in rows:
            txt = normalize_nfc(c.get("chunk_text", ""))
            if not txt:
                continue
            meta = c.get("metadata") if isinstance(c.get("metadata"), dict) else {}
            results.append(
                {
                    "evidence_id": normalize_nfc(c.get("chunk_id", "")),
                    "domain": normalize_nfc(meta.get("domain", "document")),
                    "doc_id": normalize_nfc(meta.get("doc_id", "")),
                    "title": normalize_nfc(meta.get("title", meta.get("file_name", "문서 발췌"))),
                    "organization": normalize_nfc(meta.get("organization", "")),
                    "doc_date": normalize_dot_date(meta.get("doc_date", "")),
                    "start_date": "",
                    "end_date": "",
                    "attachment_status": normalize_nfc(meta.get("attachment_status", "ATTACHED")),
                    "attachment_url": normalize_nfc(meta.get("attachment_url", "")),
                    "excerpt": txt[:400],
                    "extra": meta,
                }
            )
        return results




def build_langgraph_or_fallback_app(retriever: SupabaseErpRetriever):
    """langgraph StateGraph 또는 폴백 실행기 구성."""
    from typing import TypedDict


    class ChatState(TypedDict, total=False):
        question: str
        filters: Dict[str, Any]
        evidences: List[Dict[str, Any]]
        status: str
        answer: str
        citations: List[str]


    def step_parse(state: ChatState) -> ChatState:
        q = normalize_nfc(state.get("question", ""))
        doc_match = re.search(r"((?:위촉장|자격증|수료증|계약|사업|사건)\s*\d{4}-\d+|[A-Za-z가-힣]+-\d{4}-\d+)", q)
        years = re.findall(r"\b(20\d{2})\b", q)
        tokens = [t for t in re.findall(r"[가-힣A-Za-z0-9.-]{2,}", q) if t not in {"있어", "있나요", "알려줘", "찾아줘"}]
        return {
            "filters": {
                "raw": q,
                "doc_id": normalize_nfc(doc_match.group(1)) if doc_match else "",
                "years": years,
                "tokens": tokens,
            }
        }


    def step_retrieve(state: ChatState) -> ChatState:
        f = state.get("filters", {})
        candidates = retriever.search_records(f) + retriever.search_chunks(f)
        target_doc = f.get("doc_id", "").replace(" ", "")
        years = f.get("years") or []
        tokens = f.get("tokens") or []
        matched: List[Dict[str, Any]] = []
        for item in candidates:
            blob = normalize_nfc(f"{item.get('doc_id','')} {item.get('title','')} {item.get('organization','')} {item.get('excerpt','')}")
            compact = blob.replace(" ", "")
            if target_doc and target_doc not in compact:
                continue
            if years and not any(y in blob for y in years):
                continue
            if tokens and not any(tok.replace(" ", "") in compact for tok in tokens):
                continue
            matched.append(item)
        return {"evidences": matched}


    def step_respond(state: ChatState) -> ChatState:
        f = state.get("filters", {})
        evs = state.get("evidences", [])
        if not evs:
            target = f.get("doc_id") or f.get("raw") or state.get("question", "")
            return {
                "status": "NO_DATA",
                "answer": f"해당 데이터가 없습니다. (조회 조건: {target})",
                "citations": [],
            }
        lines = []
        cites = []
        for ev in evs[:10]:
            att = {
                "ATTACHED": "첨부완료",
                "CLOUD_ONLY": "클라우드 사본 연결",
                "MISSING": "첨부파일 없음(원본 미등록)",
            }.get(ev.get("attachment_status", ""), ev.get("attachment_status", ""))
            period = f"{ev.get('start_date')} ~ {ev.get('end_date')}" if (ev.get("start_date") or ev.get("end_date")) else ev.get("doc_date", "")
            lines.append(f"- [{ev.get('doc_id') or ev.get('evidence_id')}] {ev.get('title')} | 기관: {ev.get('organization') or '-'} | 기간/일자: {period or '-'} | 첨부: {att}")
            cites.append(ev.get("evidence_id", ""))
        return {
            "status": "FOUND",
            "answer": "\n".join(lines),
            "citations": cites,
        }


    try:
        from langgraph.graph import StateGraph, END  # type: ignore


        graph = StateGraph(ChatState)
        graph.add_node("parse", step_parse)
        graph.add_node("retrieve", step_retrieve)
        graph.add_node("respond", step_respond)
        graph.set_entry_point("parse")
        graph.add_edge("parse", "retrieve")
        graph.add_edge("retrieve", "respond")
        graph.add_edge("respond", END)
        compiled = graph.compile()
        return lambda q: compiled.invoke({"question": q})
    except Exception:
        def _run(q: str) -> ChatState:
            s: ChatState = {"question": q}
            s.update(step_parse(s))
            s.update(step_retrieve(s))
            s.update(step_respond(s))
            return s
        return _run