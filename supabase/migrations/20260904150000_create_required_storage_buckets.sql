-- Buckets used by the application. They remain private and access is governed
-- by the storage.objects RLS policies created in previous migrations.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', false),
  ('client-logos', 'client-logos', false),
  ('post-files', 'post-files', false),
  ('task-files', 'task-files', false),
  ('library-files', 'library-files', false),
  ('course-assets', 'course-assets', false),
  ('client-contracts', 'client-contracts', false),
  ('analytics-screenshots', 'analytics-screenshots', false),
  ('vault-attachments', 'vault-attachments', false)
ON CONFLICT (id) DO NOTHING;
