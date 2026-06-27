CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.file_category AS ENUM (
  'logos','fotos','videos','criativos','documentos','branding','briefing','contrato','relatorios'
);

CREATE TABLE public.file_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.file_folders(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_folders TO authenticated;
GRANT ALL ON public.file_folders TO service_role;
ALTER TABLE public.file_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage all folders" ON public.file_folders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Clients view their folders" ON public.file_folders
  FOR SELECT TO authenticated
  USING (
    client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = file_folders.client_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX idx_file_folders_parent ON public.file_folders(parent_id);
CREATE INDEX idx_file_folders_client ON public.file_folders(client_id);

CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category public.file_category NOT NULL DEFAULT 'documentos',
  tags TEXT[] NOT NULL DEFAULT '{}',
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  folder_id UUID REFERENCES public.file_folders(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage all files" ON public.files
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Clients view their files" ON public.files
  FOR SELECT TO authenticated
  USING (
    client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = files.client_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX idx_files_folder ON public.files(folder_id);
CREATE INDEX idx_files_client ON public.files(client_id);
CREATE INDEX idx_files_category ON public.files(category);
CREATE INDEX idx_files_tags ON public.files USING GIN(tags);
CREATE INDEX idx_files_name_trgm ON public.files USING GIN (name gin_trgm_ops);

CREATE TRIGGER trg_file_folders_updated BEFORE UPDATE ON public.file_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_files_updated BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.file_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;

CREATE POLICY "Staff manage library files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'library-files' AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')))
  WITH CHECK (bucket_id = 'library-files' AND (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team')));

CREATE POLICY "Authenticated read library files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'library-files');
