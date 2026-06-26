
CREATE POLICY "Authenticated can view client logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-logos');

CREATE POLICY "Admins and team can upload client logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-logos'
    AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
  );

CREATE POLICY "Admins and team can update client logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-logos'
    AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
  );

CREATE POLICY "Admins and team can delete client logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-logos'
    AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
  );
