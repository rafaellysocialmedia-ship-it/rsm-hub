-- ============ 1. Module visibility (Gerenciar Visualizações) ============
CREATE TABLE IF NOT EXISTS public.module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('role','user','client')),
  scope_id text NOT NULL,
  module_key text NOT NULL REFERENCES public.app_modules(key) ON DELETE CASCADE,
  visible boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, scope_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_visibility TO authenticated;
GRANT ALL ON public.module_visibility TO service_role;
ALTER TABLE public.module_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage module visibility"
ON public.module_visibility FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'administrator'))
WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE POLICY "Users read own visibility rules"
ON public.module_visibility FOR SELECT TO authenticated
USING (
  (scope = 'role' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = module_visibility.scope_id))
  OR (scope = 'user' AND scope_id = auth.uid()::text)
  OR (scope = 'client' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = auth.uid() AND c.id::text = module_visibility.scope_id))
);

CREATE TRIGGER trg_module_visibility_updated
BEFORE UPDATE ON public.module_visibility
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2. Monthly post ledger ============
CREATE TABLE IF NOT EXISTS public.client_post_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  contracted integer NOT NULL DEFAULT 0,
  used integer NOT NULL DEFAULT 0,
  previous_balance integer NOT NULL DEFAULT 0,
  balance integer NOT NULL DEFAULT 0,
  closed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_client_post_ledger_client ON public.client_post_ledger(client_id, year, month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_post_ledger TO authenticated;
GRANT ALL ON public.client_post_ledger TO service_role;
ALTER TABLE public.client_post_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage post ledger"
ON public.client_post_ledger FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Clients read own post ledger"
ON public.client_post_ledger FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_post_ledger.client_id AND c.user_id = auth.uid()));

CREATE TRIGGER trg_client_post_ledger_updated
BEFORE UPDATE ON public.client_post_ledger
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3. Usage helper ============
CREATE OR REPLACE FUNCTION public.post_month_usage(_client_id uuid, _year integer, _month integer)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.posts p
  WHERE p.client_id = _client_id
    AND p.scheduled_date IS NOT NULL
    AND p.status NOT IN ('archived','rejected')
    AND date_part('year', p.scheduled_date) = _year
    AND date_part('month', p.scheduled_date) = _month;
$$;

-- previous balance = balance of the last closed month before (_year,_month)
CREATE OR REPLACE FUNCTION public.post_previous_balance(_client_id uuid, _year integer, _month integer)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT l.balance FROM public.client_post_ledger l
    WHERE l.client_id = _client_id
      AND (l.year * 12 + l.month) < (_year * 12 + _month)
    ORDER BY l.year DESC, l.month DESC
    LIMIT 1
  ), 0);
$$;

-- ============ 4. Month closing (idempotent per client + month) ============
CREATE OR REPLACE FUNCTION public.close_post_month(_client_id uuid, _year integer, _month integer)
RETURNS public.client_post_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.client_post_ledger;
  _contracted integer;
  _used integer;
  _prev integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'administrator') THEN
    RAISE EXCEPTION 'Only administrators can close a month';
  END IF;

  SELECT * INTO _row FROM public.client_post_ledger
  WHERE client_id = _client_id AND year = _year AND month = _month;

  IF _row.id IS NOT NULL AND _row.closed_at IS NOT NULL THEN
    RETURN _row; -- already closed: never duplicate, never overwrite history
  END IF;

  SELECT COALESCE(monthly_post_quota, 0) INTO _contracted FROM public.clients WHERE id = _client_id;
  _used := public.post_month_usage(_client_id, _year, _month);
  _prev := public.post_previous_balance(_client_id, _year, _month);

  INSERT INTO public.client_post_ledger (client_id, year, month, contracted, used, previous_balance, balance, closed_at)
  VALUES (_client_id, _year, _month, _contracted, _used, _prev, _contracted + _prev - _used, now())
  ON CONFLICT (client_id, year, month) DO UPDATE
    SET contracted = EXCLUDED.contracted,
        used = EXCLUDED.used,
        previous_balance = EXCLUDED.previous_balance,
        balance = EXCLUDED.balance,
        closed_at = now(),
        updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.close_previous_post_month()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c RECORD;
  _ref date := ((now() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '1 month');
  _y integer := date_part('year', _ref);
  _m integer := date_part('month', _ref);
  _n integer := 0;
BEGIN
  FOR _c IN SELECT id FROM public.clients WHERE status <> 'inactive' LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.client_post_ledger
      WHERE client_id = _c.id AND year = _y AND month = _m AND closed_at IS NOT NULL
    ) THEN
      PERFORM public.close_post_month(_c.id, _y, _m);
      _n := _n + 1;
    END IF;
  END LOOP;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.close_previous_post_month() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.close_post_month(uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.close_post_month(uuid, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.post_month_usage(uuid, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.post_previous_balance(uuid, integer, integer) FROM anon;
