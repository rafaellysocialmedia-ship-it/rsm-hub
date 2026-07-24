CREATE POLICY "staff manage analytics screenshots"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'analytics-screenshots' AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')))
WITH CHECK (bucket_id = 'analytics-screenshots' AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')));

CREATE POLICY "clients read own analytics screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'analytics-screenshots'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
      AND (storage.foldername(name))[1] = c.id::text
  )
);