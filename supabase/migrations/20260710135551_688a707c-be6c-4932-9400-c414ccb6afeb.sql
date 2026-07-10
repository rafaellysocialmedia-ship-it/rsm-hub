
REVOKE EXECUTE ON FUNCTION public.auto_approve_on_publish() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_post_status_on_approval() FROM PUBLIC, anon, authenticated;
