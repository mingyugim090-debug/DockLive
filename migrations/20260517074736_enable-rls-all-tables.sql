-- ============================================================
-- Enable RLS on all public tables
-- ============================================================
-- Backend (api_key = service role) bypasses RLS automatically.
-- Frontend uses auth JWT; only users table needs client policies.
-- ============================================================

-- 1. users: frontend upserts authenticated user's own row (auth.ts)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = auth.uid()::text);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid()::text);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- 2. analysis_results: backend-only (api_key bypasses RLS)
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results FORCE ROW LEVEL SECURITY;

-- 3. documents: backend-only
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;

-- 4. workflow_sessions: backend-only
ALTER TABLE public.workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_sessions FORCE ROW LEVEL SECURITY;

-- 5. exports: backend-only
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports FORCE ROW LEVEL SECURITY;
