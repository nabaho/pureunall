-- ============================================================================
-- 푸른노무법인 P박스 (pu-pbox.html) — Supabase Free Tier ($0/월) 통합 스키마
-- 리전 권장: Northeast Asia (Seoul, ap-northeast-2)
-- 실행 방법: Supabase Dashboard -> SQL Editor -> 전체 붙여넣기 후 [Run] 클릭
-- ============================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;

-- 1) 현행·연혁 국가법령 전문 저장소 (시행일별 연혁 보존 + 중복 방지)
create table if not exists public.pbox_laws (
  id uuid primary key default gen_random_uuid(),
  law_key text not null unique,                 -- 'law|<법령ID 또는 폴더명>|<파일명>|<시행일자>'
  law_id text,
  mst text,
  dir_name text not null,
  file_name text not null default '법률.md',
  title text not null,
  law_kind text,
  departments text[] default '{}',
  promulgation_date date,
  promulgation_no text,
  effective_date date,
  article_count integer default 0,
  plain_text text not null,
  articles_json jsonb default '[]'::jsonb,
  source_sha text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_pbox_laws_title_trgm on public.pbox_laws using gin (title gin_trgm_ops);
create index if not exists idx_pbox_laws_effective on public.pbox_laws (dir_name, effective_date desc);

-- 2) 판례(대법원·하급심) · 위원회 재결례 · 고용노동부 및 범부처 유권해석 통합 테이블
create table if not exists public.pbox_documents (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,           -- 1단계 중복방지 정규화 키 (예: 'case|대법원|2020다247190')
  doc_type text not null,                       -- prec_sc | prec_lower | dec_nlrc | interp_moel | interp_gov | internal_case
  court text,
  agency text,
  case_no text,
  decision_date date,
  title text not null,
  summary text default '',
  body text not null,
  tags text[] default '{}',
  ref_laws text[] default '{}',
  ref_cases text[] default '{}',
  sources text[] default '{}',
  ingested_by text not null default '',
  deleted_at timestamptz default null,
  content_hash text,
  embedding vector(768),                        -- Gemini text-embedding-004 (768차원 무료 임베딩 선택 지원)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pbox_documents add column if not exists deleted_at timestamptz default null;

-- 소유권 불변 · 삭제 툼스톤 부활 원천 차단 · 미비식별 주민번호 유입 차단 원자적 트리거
create or replace function public.pbox_enforce_doc_ownership()
returns trigger
language plpgsql
as $$
declare
  rrn_re constant text := '(^|[^0-9])[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[-~]?[1-8][0-9]{6}([^0-9]|$)';
begin
  if coalesce(new.title, '') ~ rrn_re
     or coalesce(new.summary, '') ~ rrn_re
     or coalesce(new.body, '') ~ rrn_re then
    raise exception 'pbox_pii_violation: unmasked resident registration number rejected';
  end if;

  if tg_op = 'UPDATE' then
    if new.ingested_by is distinct from old.ingested_by then
      raise exception 'pbox_ownership_violation: cannot overwrite document owned by another actor';
    end if;
    if old.deleted_at is not null and new.deleted_at is null then
      raise exception 'pbox_tombstone_violation: cannot resurrect soft-deleted document';
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pbox_docs_immutable_owner on public.pbox_documents;
create trigger trg_pbox_docs_immutable_owner
  before insert or update on public.pbox_documents
  for each row
  execute function public.pbox_enforce_doc_ownership();

create index if not exists idx_pbox_docs_deleted_at on public.pbox_documents (deleted_at asc, canonical_key asc) where deleted_at is not null;

create index if not exists idx_pbox_docs_type_date on public.pbox_documents (doc_type, decision_date desc);
create index if not exists idx_pbox_docs_case_no on public.pbox_documents (case_no);
create index if not exists idx_pbox_docs_title_trgm on public.pbox_documents using gin (title gin_trgm_ops);
create index if not exists idx_pbox_docs_body_trgm on public.pbox_documents using gin (body gin_trgm_ops);

-- 3) 사건 프로젝트 공유 폴더 (소유자 본인만 조회·수정 가능)
create table if not exists public.pbox_projects (
  id text primary key,
  name text not null,
  client_name text default '',
  category text default '노무자문·사건',
  note text default '',
  doc_ids text[] default '{}',
  law_keys text[] default '{}',
  drafts jsonb default '[]'::jsonb,
  owner_uid text not null,
  updated_at timestamptz not null default now()
);

-- 4) 자동 동기화 커서 및 개정 이력 로그
create table if not exists public.pbox_sync_state (
  source_id text primary key,
  cursor_value text,
  last_synced_at timestamptz not null default now(),
  stats jsonb default '{}'::jsonb
);

-- 4-2) 서버 관리 재직 직원 명부 (퇴사·권한 회수 즉시 차단용 · 클라이언트 직접 읽기/쓰기 전면 금지)
create table if not exists public.pbox_active_staff (
  uid text primary key,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.pbox_active_staff enable row level security;
revoke all on public.pbox_active_staff from anon, public, authenticated;

-- 5) 직원 인증 판별 함수 (이메일 도메인 단독 우회 금지 · app_metadata.staff=true 및 재직 명부 active=true 동시 충족 필수)
create or replace function public.pbox_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'authenticated'
    and auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'staff', '') = 'true'
    and exists (
      select 1
      from public.pbox_active_staff s
      where s.uid = auth.uid()::text
        and s.active = true
    );
$$;

revoke all on function public.pbox_is_staff() from anon, public;
grant execute on function public.pbox_is_staff() to authenticated, service_role;

-- 6) 하이브리드 키워드 + 벡터 검색 RPC 함수 (security invoker로 RLS 강제 적용)
create or replace function public.pbox_hybrid_search(
  query_text text,
  filter_doc_type text default 'all',
  match_limit int default 30
)
returns setof public.pbox_documents
language sql
stable
security invoker
as $$
  select *
  from public.pbox_documents d
  where d.deleted_at is null
    and (filter_doc_type = 'all' or d.doc_type = filter_doc_type)
    and (
      query_text = ''
      or d.case_no ilike '%' || query_text || '%'
      or d.title ilike '%' || query_text || '%'
      or d.summary ilike '%' || query_text || '%'
      or d.body ilike '%' || query_text || '%'
    )
  order by
    case when d.case_no ilike '%' || query_text || '%' then 0 else 1 end,
    similarity(d.title, query_text) desc,
    d.decision_date desc nulls last
  limit match_limit;
$$;

-- 6-2) 소프트 삭제 툼스톤 복합 커서(deleted_at, canonical_key) 오름차순 페이지 조회 전용 RPC
-- 1,000건 초과 대량 삭제 시에도 가장 오래된 미처리 툼스톤부터 빠짐없이 전진 조회하여 영구 누락 방지
drop function if exists public.pbox_list_tombstones(timestamptz, int);
create or replace function public.pbox_list_tombstones(
  since_ts timestamptz default null,
  after_key text default '',
  max_rows int default 1000
)
returns table(canonical_key text, deleted_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.canonical_key, d.deleted_at
  from public.pbox_documents d
  where public.pbox_is_staff()
    and d.deleted_at is not null
    and (
      since_ts is null
      or d.deleted_at > since_ts
      or (d.deleted_at = since_ts and d.canonical_key > coalesce(after_key, ''))
    )
  order by d.deleted_at asc, d.canonical_key asc
  limit greatest(1, least(coalesce(max_rows, 1000), 2000));
$$;

revoke all on function public.pbox_list_tombstones(timestamptz, text, int) from anon, public;
grant execute on function public.pbox_list_tombstones(timestamptz, text, int) to authenticated, service_role;

-- 7) Row Level Security (비로그인 anon 전면 차단 · 서버 service_role 업서트 및 본인 소유 검증)
alter table public.pbox_laws enable row level security;
alter table public.pbox_documents enable row level security;
alter table public.pbox_projects enable row level security;
alter table public.pbox_sync_state enable row level security;

revoke all on public.pbox_laws from anon, public;
revoke all on public.pbox_documents from anon, public;
revoke all on public.pbox_projects from anon, public;
revoke all on public.pbox_sync_state from anon, public;

-- 공유 법령·판례 테이블은 클라이언트 직접 DML(INSERT/UPDATE/DELETE)을 닫아 비식별화·canonical_key 재계산·소프트 삭제 우회를 원천 차단하고,
-- 쓰기·소프트 삭제는 오직 서버 대리인(exports.pboxApi / pboxDailySync, service_role) 경로만 허용한다.
revoke insert, update, delete, truncate on public.pbox_laws from authenticated;
revoke insert, update, delete, truncate on public.pbox_documents from authenticated;
revoke insert, update, delete, truncate on public.pbox_sync_state from authenticated;
grant select on public.pbox_laws, public.pbox_documents, public.pbox_sync_state to authenticated;
grant select, insert, update, delete on public.pbox_projects to authenticated;

revoke all on function public.pbox_hybrid_search(text, text, int) from anon, public;
grant execute on function public.pbox_hybrid_search(text, text, int) to authenticated, service_role;

drop policy if exists "pbox_laws_office_access" on public.pbox_laws;
drop policy if exists "pbox_laws_staff_select" on public.pbox_laws;
create policy "pbox_laws_staff_select" on public.pbox_laws
  for select to authenticated
  using (public.pbox_is_staff());

drop policy if exists "pbox_docs_office_access" on public.pbox_documents;
drop policy if exists "pbox_docs_staff_select" on public.pbox_documents;
drop policy if exists "pbox_docs_owner_insert" on public.pbox_documents;
drop policy if exists "pbox_docs_owner_update" on public.pbox_documents;
drop policy if exists "pbox_docs_owner_delete" on public.pbox_documents;

create policy "pbox_docs_staff_select" on public.pbox_documents
  for select to authenticated
  using (public.pbox_is_staff() and deleted_at is null);

drop policy if exists "pbox_projects_office_access" on public.pbox_projects;
drop policy if exists "pbox_projects_owner_only" on public.pbox_projects;
create policy "pbox_projects_owner_only" on public.pbox_projects
  for all to authenticated
  using (public.pbox_is_staff() and owner_uid = auth.uid()::text)
  with check (public.pbox_is_staff() and owner_uid = auth.uid()::text);

drop policy if exists "pbox_sync_office_read" on public.pbox_sync_state;
drop policy if exists "pbox_sync_staff_select" on public.pbox_sync_state;
create policy "pbox_sync_staff_select" on public.pbox_sync_state
  for select to authenticated
  using (public.pbox_is_staff());
