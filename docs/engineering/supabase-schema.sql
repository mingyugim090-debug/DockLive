-- LiveDock Agent MVP persistence schema.
-- Run this in the Supabase SQL editor, then create a private Storage bucket
-- named by SUPABASE_STORAGE_BUCKET, default: livedock-documents.

create extension if not exists pgcrypto;

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

create index if not exists workflow_sessions_analysis_id_idx
  on public.workflow_sessions(analysis_id);

create index if not exists workflow_sessions_updated_at_idx
  on public.workflow_sessions(updated_at desc);

create index if not exists documents_analysis_id_idx
  on public.documents(analysis_id);

create index if not exists exports_workflow_id_idx
  on public.exports(workflow_id);

alter table public.analysis_results enable row level security;
alter table public.workflow_sessions enable row level security;
alter table public.documents enable row level security;
alter table public.exports enable row level security;

-- The backend uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS.
-- Add user-scoped policies only when Auth is introduced after the Agent MVP.
