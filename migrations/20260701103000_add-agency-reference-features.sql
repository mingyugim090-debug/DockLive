-- DockLive Ver2 reference-pattern features.
-- Prior notices and clause library rows remain organization-scoped.

create extension if not exists vector;

create table if not exists public.agency_notice_references (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  program_type text not null default 'support_program',
  budget_band text not null default 'unspecified',
  program_period text not null default '',
  summary text not null default '',
  source_filename text not null default '',
  embedding vector(1536),
  embedding_model text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clause_library (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  clause_type text not null,
  label text not null,
  required_for_program_types text[] not null default array[]::text[],
  template_text text not null default '',
  source text not null default 'agency_supplied'
    check (source in ('org_default', 'agency_supplied')),
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, clause_type)
);

create index if not exists agency_notice_references_org_idx
  on public.agency_notice_references(organization_id, updated_at desc);

create index if not exists agency_notice_references_program_idx
  on public.agency_notice_references(organization_id, program_type, budget_band);

create index if not exists agency_notice_references_embedding_hnsw_idx
  on public.agency_notice_references
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create index if not exists clause_library_org_idx
  on public.clause_library(organization_id, active, clause_type);

drop trigger if exists agency_notice_references_set_updated_at on public.agency_notice_references;
create trigger agency_notice_references_set_updated_at
before update on public.agency_notice_references
for each row execute function public.set_updated_at();

drop trigger if exists clause_library_set_updated_at on public.clause_library;
create trigger clause_library_set_updated_at
before update on public.clause_library
for each row execute function public.set_updated_at();

drop trigger if exists agency_notice_references_prevent_org_change on public.agency_notice_references;
create trigger agency_notice_references_prevent_org_change
before update on public.agency_notice_references
for each row execute function public.prevent_organization_id_change();

drop trigger if exists clause_library_prevent_org_change on public.clause_library;
create trigger clause_library_prevent_org_change
before update on public.clause_library
for each row execute function public.prevent_organization_id_change();

alter table public.agency_notice_references enable row level security;
alter table public.clause_library enable row level security;

alter table public.agency_notice_references force row level security;
alter table public.clause_library force row level security;

create policy "agency_notice_references_member_select" on public.agency_notice_references
  for select to authenticated
  using (public.is_agency_member(organization_id));

create policy "agency_notice_references_member_insert" on public.agency_notice_references
  for insert to authenticated
  with check (public.is_agency_member(organization_id));

create policy "agency_notice_references_member_update" on public.agency_notice_references
  for update to authenticated
  using (public.is_agency_member(organization_id))
  with check (public.is_agency_member(organization_id));

create policy "clause_library_member_select" on public.clause_library
  for select to authenticated
  using (public.is_agency_member(organization_id));

create policy "clause_library_member_insert" on public.clause_library
  for insert to authenticated
  with check (public.is_agency_member(organization_id));

create policy "clause_library_member_update" on public.clause_library
  for update to authenticated
  using (public.is_agency_member(organization_id))
  with check (public.is_agency_member(organization_id));

revoke all on public.agency_notice_references from anon;
revoke all on public.clause_library from anon;

grant select, insert, update on public.agency_notice_references to authenticated;
grant select, insert, update on public.clause_library to authenticated;

create or replace function public.match_agency_notice_references(
  org_uuid uuid,
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold double precision default 0.65
)
returns table (
  id text,
  title text,
  program_type text,
  budget_band text,
  program_period text,
  summary text,
  similarity double precision,
  payload jsonb
)
language sql
stable
security invoker
as $$
  select
    ref.id,
    ref.title,
    ref.program_type,
    ref.budget_band,
    ref.program_period,
    ref.summary,
    1 - (ref.embedding <=> query_embedding) as similarity,
    ref.payload
  from public.agency_notice_references ref
  where ref.organization_id = org_uuid
    and ref.embedding is not null
    and 1 - (ref.embedding <=> query_embedding) >= match_threshold
  order by ref.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_agency_notice_references(uuid, vector, int, double precision)
to authenticated;
