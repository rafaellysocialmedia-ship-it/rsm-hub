-- Preserve cron/public function names while putting privileged implementations behind checked RPCs.
REVOKE ALL ON FUNCTION public.apply_client_default_payment_method() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.renew_expired_finance_contracts() SET SCHEMA rsm_private;
ALTER FUNCTION public.run_finance_automation() SET SCHEMA rsm_private;
ALTER FUNCTION public.generate_recurring_charges() SET SCHEMA rsm_private;
DO $$
DECLARE fn text;definition text;guard text := E'BEGIN\n IF NOT ((auth.uid() IS NULL AND current_setting(''role'',true) IN (''none'',''postgres'',''service_role'')) OR public.can_finance(''edit'')) THEN RAISE EXCEPTION ''A automação financeira exige permissão de edição'' USING ERRCODE=''42501'';END IF;';
BEGIN
 FOREACH fn IN ARRAY ARRAY['renew_expired_finance_contracts','run_finance_automation','generate_recurring_charges'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p WHERE p.pronamespace='rsm_private'::regnamespace AND p.proname=fn;
  definition:=regexp_replace(definition,'\mbegin\M',guard,'i');
  IF fn='renew_expired_finance_contracts' THEN
   definition:=replace(definition,'and auto_renew = true','and auto_renew = true AND EXISTS(SELECT 1 FROM public.clients cl WHERE cl.id=finance_contracts.client_id AND cl.status=''active'' AND NOT cl.churned)');
  END IF;
  EXECUTE definition;
  EXECUTE format('REVOKE ALL ON FUNCTION rsm_private.%I() FROM PUBLIC,anon',fn);
  EXECUTE format('GRANT EXECUTE ON FUNCTION rsm_private.%I() TO authenticated,service_role',fn);
 END LOOP;
END $$;
CREATE FUNCTION public.renew_expired_finance_contracts() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT rsm_private.renew_expired_finance_contracts();$$;
CREATE FUNCTION public.generate_recurring_charges() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT rsm_private.generate_recurring_charges();$$;
CREATE FUNCTION public.run_finance_automation() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT rsm_private.run_finance_automation();$$;
REVOKE ALL ON FUNCTION public.renew_expired_finance_contracts(),public.generate_recurring_charges(),public.run_finance_automation() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renew_expired_finance_contracts(),public.generate_recurring_charges(),public.run_finance_automation() TO authenticated,service_role;
