-- ============================================================
-- 1. Revoke public access from backend-only tables
--    (analysis_results, documents, exports, workflow_sessions)
--    → only project_admin (api_key) should access these
-- ============================================================

REVOKE ALL ON public.analysis_results  FROM anon, authenticated;
REVOKE ALL ON public.documents         FROM anon, authenticated;
REVOKE ALL ON public.exports           FROM anon, authenticated;
REVOKE ALL ON public.workflow_sessions FROM anon, authenticated;

-- ============================================================
-- 2. Restrict users table:
--    anon has no business accessing users directly.
--    authenticated gets SELECT/INSERT/UPDATE only (RLS enforces row scope).
-- ============================================================

REVOKE ALL    ON public.users FROM anon;
REVOKE DELETE ON public.users FROM authenticated;

-- ============================================================
-- 3. Add missing foreign key indexes (performance)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_workflow_sessions_analysis_id
  ON public.workflow_sessions (analysis_id);

CREATE INDEX IF NOT EXISTS idx_documents_analysis_id
  ON public.documents (analysis_id);

CREATE INDEX IF NOT EXISTS idx_documents_workflow_id
  ON public.documents (workflow_id);

CREATE INDEX IF NOT EXISTS idx_exports_workflow_id
  ON public.exports (workflow_id);
