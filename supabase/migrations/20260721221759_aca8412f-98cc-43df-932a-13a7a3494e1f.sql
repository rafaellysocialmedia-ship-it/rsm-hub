
CREATE POLICY "course-assets: authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'course-assets');

CREATE POLICY "course-assets: admins insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-assets' AND public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "course-assets: admins update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-assets' AND public.has_role(auth.uid(), 'administrator'))
WITH CHECK (bucket_id = 'course-assets' AND public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "course-assets: admins delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-assets' AND public.has_role(auth.uid(), 'administrator'));
