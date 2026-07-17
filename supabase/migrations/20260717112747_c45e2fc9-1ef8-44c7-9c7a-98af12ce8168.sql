
-- Vault attachments (prints de códigos 2FA e afins)
CREATE TABLE public.vault_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.vault_credentials(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  label TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_attachments TO authenticated;
GRANT ALL ON public.vault_attachments TO service_role;

ALTER TABLE public.vault_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view vault attachments" ON public.vault_attachments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));
CREATE POLICY "Staff manage vault attachments" ON public.vault_attachments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE INDEX idx_vault_attachments_credential ON public.vault_attachments(credential_id);

-- Storage policies para bucket vault-attachments (private, apenas staff)
CREATE POLICY "Staff read vault-attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vault-attachments' AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team')));
CREATE POLICY "Staff upload vault-attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault-attachments' AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team')));
CREATE POLICY "Staff update vault-attachments" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vault-attachments' AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team')));
CREATE POLICY "Staff delete vault-attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vault-attachments' AND (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team')));

-- Datas comemorativas
CREATE TABLE public.commemorative_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  category TEXT,
  emoji TEXT,
  is_national BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, day, name)
);

GRANT SELECT ON public.commemorative_dates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commemorative_dates TO authenticated;
GRANT ALL ON public.commemorative_dates TO service_role;

ALTER TABLE public.commemorative_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads commemorative dates" ON public.commemorative_dates FOR SELECT USING (true);
CREATE POLICY "Staff manage commemorative dates" ON public.commemorative_dates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE TRIGGER update_commemorative_dates_updated_at BEFORE UPDATE ON public.commemorative_dates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_commemorative_dates_md ON public.commemorative_dates(month, day);

-- Seed nacional BR (datas mais usadas em social media)
INSERT INTO public.commemorative_dates (name, month, day, category, emoji) VALUES
  ('Confraternização Universal', 1, 1, 'feriado', '🎉'),
  ('Dia Mundial da Paz', 1, 1, 'internacional', '🕊️'),
  ('Dia do Farmacêutico', 1, 20, 'profissão', '💊'),
  ('Dia Nacional do Livro Didático', 1, 27, 'cultura', '📚'),
  ('Carnaval', 2, 13, 'feriado', '🎭'),
  ('Dia do Esportista', 2, 19, 'esporte', '⚽'),
  ('Dia Internacional da Mulher', 3, 8, 'internacional', '💜'),
  ('Dia do Consumidor', 3, 15, 'comercial', '🛍️'),
  ('Dia Mundial da Água', 3, 22, 'ambiente', '💧'),
  ('Dia da Mentira', 4, 1, 'humor', '🤥'),
  ('Dia Mundial da Saúde', 4, 7, 'saúde', '🩺'),
  ('Tiradentes', 4, 21, 'feriado', '🇧🇷'),
  ('Dia do Trabalhador', 5, 1, 'feriado', '👷'),
  ('Dia das Mães', 5, 11, 'comemorativo', '💐'),
  ('Dia do Orgulho Nerd', 5, 25, 'cultura', '🤓'),
  ('Dia Mundial do Meio Ambiente', 6, 5, 'ambiente', '🌱'),
  ('Dia dos Namorados', 6, 12, 'comemorativo', '❤️'),
  ('Festa Junina', 6, 24, 'cultura', '🌽'),
  ('Dia Mundial do Rock', 7, 13, 'cultura', '🎸'),
  ('Dia do Amigo', 7, 20, 'comemorativo', '🤝'),
  ('Dia dos Pais', 8, 10, 'comemorativo', '👨‍👧'),
  ('Dia do Estudante', 8, 11, 'educação', '🎓'),
  ('Dia da Independência', 9, 7, 'feriado', '🇧🇷'),
  ('Dia da Amazônia', 9, 5, 'ambiente', '🌳'),
  ('Primavera', 9, 23, 'estação', '🌸'),
  ('Dia das Crianças', 10, 12, 'feriado', '🧒'),
  ('Nossa Senhora Aparecida', 10, 12, 'feriado', '🙏'),
  ('Dia do Professor', 10, 15, 'profissão', '👩‍🏫'),
  ('Halloween', 10, 31, 'cultura', '🎃'),
  ('Finados', 11, 2, 'feriado', '🕯️'),
  ('Proclamação da República', 11, 15, 'feriado', '🇧🇷'),
  ('Black Friday', 11, 28, 'comercial', '🛒'),
  ('Dia da Consciência Negra', 11, 20, 'social', '✊🏾'),
  ('Cyber Monday', 12, 1, 'comercial', '💻'),
  ('Natal', 12, 25, 'feriado', '🎄'),
  ('Réveillon', 12, 31, 'comemorativo', '🎆')
ON CONFLICT DO NOTHING;
