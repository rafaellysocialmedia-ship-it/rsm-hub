-- Phase 1: internal strategy and a deliberately limited client-facing projection.
CREATE TABLE public.client_strategies (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fields) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_strategies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.client_strategies TO authenticated;
CREATE POLICY "Staff read account strategy" ON public.client_strategies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY "Staff insert account strategy" ON public.client_strategies FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));
CREATE POLICY "Staff update account strategy" ON public.client_strategies FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

-- Do not give clients SELECT on financial tables: notes and operational fields stay private.
CREATE SCHEMA IF NOT EXISTS rsm_private;
REVOKE ALL ON SCHEMA rsm_private FROM PUBLIC;
GRANT USAGE ON SCHEMA rsm_private TO authenticated;
CREATE FUNCTION rsm_private.my_account_workspace()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE account public.clients; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT c.* INTO account FROM public.clients c WHERE c.user_id = auth.uid() ORDER BY c.created_at LIMIT 1;
  IF account.id IS NULL THEN RETURN NULL; END IF;
  result := jsonb_build_object('id',account.id,'name',account.name,'logo_url',account.logo_url,'plan',account.plan,'start_date',account.start_date,'status',account.status);
  RETURN result || jsonb_build_object(
    'charges', COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (
      SELECT id,service_label,amount,due_date,CASE WHEN status='pending' AND due_date < (now() AT TIME ZONE 'America/Fortaleza')::date THEN 'overdue' ELSE status::text END AS status,paid_date
      FROM public.finance_charges WHERE client_id=account.id ORDER BY due_date DESC
    ) q),'[]'::jsonb),
    'contracts', COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (
      SELECT id,service_label,amount,periodicity,start_date,end_date,status FROM public.finance_contracts WHERE client_id=account.id ORDER BY created_at DESC
    ) q),'[]'::jsonb),
    'signed_contracts', COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (
      SELECT id,title,status,signed_url,signature_provider,expires_at,storage_path FROM public.client_contracts WHERE client_id=account.id ORDER BY created_at DESC
    ) q),'[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION rsm_private.my_account_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rsm_private.my_account_workspace() TO authenticated;
CREATE FUNCTION public.get_my_account_workspace()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT rsm_private.my_account_workspace();
$$;
REVOKE ALL ON FUNCTION public.get_my_account_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_account_workspace() TO authenticated;
