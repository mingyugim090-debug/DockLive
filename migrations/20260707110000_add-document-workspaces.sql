-- Document workspace persistence (Inline-AI style multi-file projects).
-- Backend-only table: the FastAPI service accesses it with the admin key,
-- so RLS is forced with no anon/authenticated policies (same as workflow_sessions).

create table if not exists public.document_workspaces (
  id text primary key,
  title text not null default '',
  status text not null default 'empty',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_workspaces_updated_idx
  on public.document_workspaces(updated_at desc);

alter table public.document_workspaces enable row level security;
alter table public.document_workspaces force row level security;

revoke all on public.document_workspaces from anon, authenticated;

drop trigger if exists document_workspaces_set_updated_at on public.document_workspaces;
create trigger document_workspaces_set_updated_at
before update on public.document_workspaces
for each row execute function public.set_updated_at();
