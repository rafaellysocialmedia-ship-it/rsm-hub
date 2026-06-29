GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_files TO authenticated;
GRANT ALL ON public.post_files TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_approvals TO authenticated;
GRANT ALL ON public.post_approvals TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_folders TO authenticated;
GRANT ALL ON public.file_folders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist TO authenticated;
GRANT ALL ON public.task_checklist TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_files TO authenticated;
GRANT ALL ON public.task_files TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_credentials TO authenticated;
GRANT ALL ON public.vault_credentials TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_credential_history TO authenticated;
GRANT ALL ON public.vault_credential_history TO service_role;