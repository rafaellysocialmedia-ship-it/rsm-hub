ALTER TABLE public.client_post_ledger
  ADD COLUMN IF NOT EXISTS adjustment integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_note text;

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
  _adj integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'administrator') THEN
    RAISE EXCEPTION 'Only administrators can close a month';
  END IF;

  SELECT * INTO _row FROM public.client_post_ledger
  WHERE client_id = _client_id AND year = _year AND month = _month;

  IF _row.id IS NOT NULL AND _row.closed_at IS NOT NULL THEN
    RETURN _row;
  END IF;

  _adj := COALESCE(_row.adjustment, 0);

  SELECT COALESCE(monthly_post_quota, 0) INTO _contracted FROM public.clients WHERE id = _client_id;
  _used := public.post_month_usage(_client_id, _year, _month);
  _prev := public.post_previous_balance(_client_id, _year, _month);

  INSERT INTO public.client_post_ledger (client_id, year, month, contracted, used, previous_balance, balance, adjustment, closed_at)
  VALUES (_client_id, _year, _month, _contracted, _used, _prev, _contracted + _prev + _adj - _used, _adj, now())
  ON CONFLICT (client_id, year, month) DO UPDATE
    SET contracted = EXCLUDED.contracted,
        used = EXCLUDED.used,
        previous_balance = EXCLUDED.previous_balance,
        balance = EXCLUDED.balance,
        closed_at = now(),
        updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.close_post_month(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_post_month(uuid, integer, integer) TO authenticated, service_role;