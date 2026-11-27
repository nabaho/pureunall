-- 푸른노무법인 통합 ERP (Supabase / PostgreSQL + pgvector) 환각 방지용 통합 색인 스키마
-- 1. 모든 문서·경력·실적·사업·급여·근태 데이터를 단 하나의 검증 뷰/테이블 구조로 정규화
-- 2. 스캔본·깨진 HWP 문서는 parse_status = 'NEEDS_OCR_OR_MANUAL' 로 격리하여 오인식 텍스트 검색 차단


create extension if not exists vector;


create table if not exists erp_knowledge_records (
  record_key text primary key,
  domain text not null,
  doc_id text,
  title text not null,
  organization text,
  issuer_or_owner text,
  doc_date text,
  start_date text,
  end_date text,
  attachment_status text not null default 'MISSING',
  attachment_url text,
  parse_status text not null default 'OK',
  structured_json jsonb not null default '{}'::jsonb,
  searchable_text text not null,
  updated_at timestamptz not null default now()
);


create index if not exists idx_erp_records_domain on erp_knowledge_records (domain);
create index if not exists idx_erp_records_doc_id on erp_knowledge_records (doc_id);
create index if not exists idx_erp_records_org on erp_knowledge_records (organization);
create index if not exists idx_erp_records_attach on erp_knowledge_records (attachment_status);


create table if not exists erp_knowledge_chunks (
  chunk_id text primary key,
  record_key text not null references erp_knowledge_records(record_key) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


create index if not exists idx_erp_chunks_record on erp_knowledge_chunks (record_key);