
REVOKE EXECUTE ON FUNCTION public.sync_task_with_post_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_client_deadlines() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_post_status_on_approval() FROM anon, authenticated, PUBLIC;
