CREATE FUNCTION rsm_private.retention_staff_directory()
RETURNS TABLE(id uuid,name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')) THEN
 RAISE EXCEPTION 'Área exclusiva da equipe' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.id,p.name FROM public.profiles p WHERE EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role IN ('administrator','team')) ORDER BY p.name;
END $$;
REVOKE ALL ON FUNCTION rsm_private.retention_staff_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rsm_private.retention_staff_directory() TO authenticated;
CREATE FUNCTION public.get_retention_staff() RETURNS TABLE(id uuid,name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM rsm_private.retention_staff_directory(); $$;
REVOKE ALL ON FUNCTION public.get_retention_staff() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_retention_staff() TO authenticated;
