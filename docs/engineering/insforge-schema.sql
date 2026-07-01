-- LiveDock Agent MVP persistence schema for InsForge.
-- Import this with:
--   npx @insforge/cli db import docs/engineering/insforge-schema.sql
-- Then create a private Storage bucket named by INSFORGE_STORAGE_BUCKET,
-- default: livedock-documents.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  email text unique,
  name text,
  avatar_url text,
  provider text,
  role text not null default 'user',
  metadata jsonb not null default '{}'::jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analysis_results (
  id text primary key,
  source_type text,
  source_name text,
  title text,
  organization text,
  doc_type text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_sessions (
  id text primary key,
  analysis_id text references public.analysis_results(id) on delete cascade,
  status text not null,
  -- MVP stores user_inputs, draft_sections, confirmed_items, and final_document
  -- together in the workflow payload. Split draft_sections into a separate table
  -- only after collaborative editing or per-section audit history is required.
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  analysis_id text references public.analysis_results(id) on delete set null,
  workflow_id text references public.workflow_sessions(id) on delete set null,
  filename text not null,
  content_type text not null,
  size_bytes integer not null default 0,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  workflow_id text references public.workflow_sessions(id) on delete set null,
  filename text not null,
  content_type text not null,
  export_type text not null,
  status text not null default 'success',
  error_message text,
  validation_summary jsonb not null default '{}'::jsonb,
  size_bytes integer not null default 0,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.exports
  add column if not exists status text not null default 'success',
  add column if not exists error_message text,
  add column if not exists validation_summary jsonb not null default '{}'::jsonb;

create index if not exists analysis_results_updated_at_idx
  on public.analysis_results(updated_at desc);

create index if not exists users_email_idx
  on public.users(email);

create index if not exists workflow_sessions_analysis_id_idx
  on public.workflow_sessions(analysis_id);

create index if not exists workflow_sessions_updated_at_idx
  on public.workflow_sessions(updated_at desc);

create index if not exists documents_analysis_id_idx
  on public.documents(analysis_id);

create index if not exists exports_workflow_id_idx
  on public.exports(workflow_id);

-- The backend uses INSFORGE_API_KEY server-side. Add user-scoped policies only
-- when Auth is introduced after the Agent MVP.

-- Ver2 Agency NoticeOps tables are defined in:
--   migrations/20260701090000_add-agency-noticeops.sql
--   migrations/20260701103000_add-agency-reference-features.sql
--
-- Summary:
-- - organizations and organization_members model self-serve agency tenants.
-- - notice_drafts, notice_versions, approval_steps, approval_comments, and
--   notice_audit_events carry organization_id from the first migration.
-- - agency_notice_references stores organization-owned prior notices for
--   pgvector-backed recall; clause_library stores org-editable required
--   clause definitions and confirmation-gate metadata.
-- - RLS uses SECURITY DEFINER helpers public.is_agency_member and
--   public.is_agency_admin to avoid recursive membership policy lookups.
-- - notice_versions and notice_audit_events are append-only for authenticated
--   clients; backend service-role persistence may still write full workflow
--   payloads for demo and recovery paths.
