
CREATE POLICY "Staff read task-files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-files' AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')));
CREATE POLICY "Staff insert task-files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-files' AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')));
CREATE POLICY "Staff update task-files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'task-files' AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')));
CREATE POLICY "Staff delete task-files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-files' AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')));
