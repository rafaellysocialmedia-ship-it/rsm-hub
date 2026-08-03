CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _module text, _action text DEFAULT 'view')
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_app_roles uar
    JOIN public.app_role_permissions arp ON arp.role_key = uar.role_key
    JOIN public.app_permissions p ON p.id = arp.permission_id
    WHERE uar.user_id = _user_id AND p.module_key = _module AND p.action = _action
  );
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE (module_key text, action text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT DISTINCT p.module_key, p.action
  FROM public.user_app_roles uar
  JOIN public.app_role_permissions arp ON arp.role_key = uar.role_key
  JOIN public.app_permissions p ON p.id = arp.permission_id
  WHERE uar.user_id = auth.uid();
$$;