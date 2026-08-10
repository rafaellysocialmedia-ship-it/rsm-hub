
CREATE OR REPLACE FUNCTION public.can_finance(_action text DEFAULT 'view')
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'administrator')
      OR public.user_has_permission(auth.uid(),'finance',_action);
$$;
