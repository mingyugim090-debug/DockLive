-- DockLive Ver2 Agency NoticeOps schema.
-- Every Ver2 row is organization-scoped from the first migration.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by text references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id text references public.users(id) on delete cascade,
  invited_email text,
  role text not null default 'staff'
    check (role in ('staff', 'lead', 'approver', 'admin')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_member_identity check (user_id is not null or invited_email is not null)
);

create unique index if not exists organization_members_user_unique_idx
  on public.organization_members(organization_id, user_id)
  where user_id is not null;

create unique index if not exists organization_members_invite_unique_idx
  on public.organization_members(organization_id, lower(invited_email))
  where invited_email is not null;

create table if not exists public.notice_drafts (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'under_review', 'revision_requested', 'approving', 'approved', 'published')),
  current_version_id text,
  created_by text references public.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notice_versions (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  draft_id text not null references public.notice_drafts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  created_by text references public.users(id) on delete set null,
  change_summary text not null default '',
  sections_snapshot jsonb not null default '[]'::jsonb,
  mandatory_clause_checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(draft_id, version_number)
);

alter table public.notice_drafts
  add constraint notice_drafts_current_version_fk
  foreign key (current_version_id) references public.notice_versions(id)
  deferrable initially deferred;

create table if not exists public.approval_steps (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  draft_id text not null references public.notice_drafts(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  title text not null,
  role text not null check (role in ('staff', 'lead', 'approver', 'admin')),
  assigned_to text references public.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'approved', 'changes_requested', 'skipped')),
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(draft_id, step_order)
);

create table if not exists public.approval_comments (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  draft_id text not null references public.notice_drafts(id) on delete cascade,
  version_id text not null references public.notice_versions(id) on delete cascade,
  section_id text,
  author_id text references public.users(id) on delete set null,
  author_name text not null default '',
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notice_audit_events (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  draft_id text not null references public.notice_drafts(id) on delete cascade,
  actor_id text references public.users(id) on delete set null,
  action text not null,
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists organizations_created_by_idx
  on public.organizations(created_by);
create index if not exists organization_members_org_user_idx
  on public.organization_members(organization_id, user_id);
create index if not exists organization_members_status_idx
  on public.organization_members(organization_id, status);
create index if not exists notice_drafts_org_status_idx
  on public.notice_drafts(organization_id, status, updated_at desc);
create index if not exists notice_versions_draft_idx
  on public.notice_versions(draft_id, version_number desc);
create index if not exists approval_steps_draft_idx
  on public.approval_steps(draft_id, step_order);
create index if not exists approval_comments_version_idx
  on public.approval_comments(version_id, created_at desc);
create index if not exists notice_audit_events_draft_idx
  on public.notice_audit_events(draft_id, created_at desc);

create or replace function public.is_agency_member(org_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = org_uuid
      and member.user_id = auth.uid()::text
      and member.status = 'active'
  );
$$;

create or replace function public.is_agency_admin(org_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = org_uuid
      and member.user_id = auth.uid()::text
      and member.status = 'active'
      and member.role = 'admin'
  );
$$;

create or replace function public.add_organization_creator_member()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.created_by is not null then
    insert into public.organization_members(organization_id, user_id, role, status)
    values (new.id, new.created_by, 'admin', 'active')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_organization_id_change()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

drop trigger if exists notice_drafts_set_updated_at on public.notice_drafts;
create trigger notice_drafts_set_updated_at
before update on public.notice_drafts
for each row execute function public.set_updated_at();

drop trigger if exists approval_steps_set_updated_at on public.approval_steps;
create trigger approval_steps_set_updated_at
before update on public.approval_steps
for each row execute function public.set_updated_at();

drop trigger if exists approval_comments_set_updated_at on public.approval_comments;
create trigger approval_comments_set_updated_at
before update on public.approval_comments
for each row execute function public.set_updated_at();

drop trigger if exists organizations_add_creator_member on public.organizations;
create trigger organizations_add_creator_member
after insert on public.organizations
for each row execute function public.add_organization_creator_member();

drop trigger if exists organization_members_prevent_org_change on public.organization_members;
create trigger organization_members_prevent_org_change
before update on public.organization_members
for each row execute function public.prevent_organization_id_change();

drop trigger if exists notice_drafts_prevent_org_change on public.notice_drafts;
create trigger notice_drafts_prevent_org_change
before update on public.notice_drafts
for each row execute function public.prevent_organization_id_change();

drop trigger if exists notice_versions_prevent_org_change on public.notice_versions;
create trigger notice_versions_prevent_org_change
before update on public.notice_versions
for each row execute function public.prevent_organization_id_change();

drop trigger if exists approval_steps_prevent_org_change on public.approval_steps;
create trigger approval_steps_prevent_org_change
before update on public.approval_steps
for each row execute function public.prevent_organization_id_change();

drop trigger if exists approval_comments_prevent_org_change on public.approval_comments;
create trigger approval_comments_prevent_org_change
before update on public.approval_comments
for each row execute function public.prevent_organization_id_change();

drop trigger if exists notice_audit_events_prevent_org_change on public.notice_audit_events;
create trigger notice_audit_events_prevent_org_change
before update on public.notice_audit_events
for each row execute function public.prevent_organization_id_change();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.notice_drafts enable row level security;
alter table public.notice_versions enable row level security;
alter table public.approval_steps enable row level security;
alter table public.approval_comments enable row level security;
alter table public.notice_audit_events enable row level security;

alter table public.organizations force row level security;
alter table public.organization_members force row level security;
alter table public.notice_drafts force row level security;
alter table public.notice_versions force row level security;
alter table public.approval_steps force row level security;
alter table public.approval_comments force row level security;
alter table public.notice_audit_events force row level security;

create policy "organizations_member_select" on public.organizations
  for select to authenticated
  using (public.is_agency_member(id));

create policy "organizations_creator_insert" on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid()::text);

create policy "organizations_admin_update" on public.organizations
  for update to authenticated
  using (public.is_agency_admin(id))
  with check (public.is_agency_admin(id));

create policy "organization_members_member_select" on public.organization_members
  for select to authenticated
  using (public.is_agency_member(organization_id));

create policy "organization_members_admin_insert" on public.organization_members
  for insert to authenticated
  with check (public.is_agency_admin(organization_id));

create policy "organization_members_admin_update" on public.organization_members
  for update to authenticated
  using (public.is_agency_admin(organization_id))
  with check (public.is_agency_admin(organization_id));

create policy "notice_drafts_member_select" on public.notice_drafts
  for select to authenticated
  using (public.is_agency_member(organization_id));

create policy "notice_drafts_member_insert" on public.notice_drafts
  for insert to authenticated
  with check (public.is_agency_member(organization_id));

create policy "notice_drafts_member_update" on public.notice_drafts
  for update to authenticated
  using (public.is_agency_member(organization_id))
  with check (public.is_agency_member(organization_id));

create policy "notice_versions_member_select" on public.notice_versions
  for select to authenticated
  using (public.is_agency_member(organization_id));

create policy "notice_versions_member_insert" on public.notice_versions
  for insert to authenticated
  with check (public.is_agency_member(organization_id));

create policy "approval_steps_member_select" on public.approval_steps
  for select to authenticated
  using (public.is_agency_member(organization_id));

create policy "approval_steps_member_insert" on public.approval_steps
  for insert to authenticated
  with check (public.is_agency_member(organization_id));

create policy "approval_steps_member_update" on public.approval_steps
  for update to authenticated
  using (public.is_agency_member(organization_id))
  with check (public.is_agency_member(organization_id));

create policy "approval_comments_member_select" on public.approval_comments
  for select to authenticated
  using (public.is_agency_member(organization_id));

create policy "approval_comments_member_insert" on public.approval_comments
  for insert to authenticated
  with check (public.is_agency_member(organization_id));

create policy "approval_comments_member_update" on public.approval_comments
  for update to authenticated
  using (public.is_agency_member(organization_id))
  with check (public.is_agency_member(organization_id));

create policy "notice_audit_events_member_select" on public.notice_audit_events
  for select to authenticated
  using (public.is_agency_member(organization_id));

create policy "notice_audit_events_member_insert" on public.notice_audit_events
  for insert to authenticated
  with check (public.is_agency_member(organization_id));

revoke all on public.organizations from anon;
revoke all on public.organization_members from anon;
revoke all on public.notice_drafts from anon;
revoke all on public.notice_versions from anon;
revoke all on public.approval_steps from anon;
revoke all on public.approval_comments from anon;
revoke all on public.notice_audit_events from anon;

grant select, insert, update on public.organizations to authenticated;
grant select, insert, update on public.organization_members to authenticated;
grant select, insert, update on public.notice_drafts to authenticated;
grant select, insert on public.notice_versions to authenticated;
grant select, insert, update on public.approval_steps to authenticated;
grant select, insert, update on public.approval_comments to authenticated;
grant select, insert on public.notice_audit_events to authenticated;

revoke update, delete on public.notice_versions from authenticated;
revoke update, delete on public.notice_audit_events from authenticated;
