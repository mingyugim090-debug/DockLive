-- ============================================================
-- Credits & Payments
-- ============================================================

-- 1. Add credits column to users (3 free credits for new users)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 3;

-- 2. Payment history table (backend-only access)
CREATE TABLE IF NOT EXISTS public.payment_history (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  payment_key  TEXT        NOT NULL UNIQUE,
  order_id     TEXT        NOT NULL UNIQUE,
  amount       INTEGER     NOT NULL,
  credits_added INTEGER    NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'done',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_history FROM anon, authenticated;

-- 3. deduct_credit(): atomic, uses auth.uid() from JWT context
--    Called from frontend via InsForge SDK rpc() with user's auth token.
CREATE OR REPLACE FUNCTION public.deduct_credit()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining INTEGER;
BEGIN
  UPDATE public.users
     SET credits = credits - 1
   WHERE id = auth.uid()::text
     AND credits > 0
  RETURNING credits INTO remaining;

  IF remaining IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;

  RETURN remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_credit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credit() TO authenticated;

-- 4. record_payment(): admin-only, atomically adds credits + logs payment
--    Called from Next.js API route with InsForge admin API key.
CREATE OR REPLACE FUNCTION public.record_payment(
  p_user_id      TEXT,
  p_payment_key  TEXT,
  p_order_id     TEXT,
  p_amount       INTEGER,
  p_credits_added INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  UPDATE public.users
     SET credits = credits + p_credits_added
   WHERE id = p_user_id
  RETURNING credits INTO new_credits;

  IF new_credits IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.payment_history
    (user_id, payment_key, order_id, amount, credits_added)
  VALUES
    (p_user_id, p_payment_key, p_order_id, p_amount, p_credits_added);

  RETURN new_credits;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment(TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO project_admin;
