
CREATE POLICY "Staff manage post-files objects" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'post-files' AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team')))
  WITH CHECK (bucket_id = 'post-files' AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team')));

CREATE POLICY "Clients view their post-files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'post-files' AND EXISTS (
      SELECT 1 FROM public.post_files pf
      JOIN public.posts p ON p.id = pf.post_id
      JOIN public.clients c ON c.id = p.client_id
      WHERE pf.storage_path = storage.objects.name AND c.user_id = auth.uid()
    )
  );
