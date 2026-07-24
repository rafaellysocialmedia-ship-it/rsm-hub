DROP POLICY IF EXISTS "clients read own analytics screenshots" ON storage.objects;

CREATE POLICY "clients read own analytics screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'analytics-screenshots'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
      AND (storage.foldername(storage.objects.name))[1] = c.id::text
  )
);