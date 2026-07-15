
-- Template of briefing questions (workspace-wide, single row expected)
CREATE TABLE public.briefing_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Template padrão',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_template TO authenticated;
GRANT ALL ON public.briefing_template TO service_role;

ALTER TABLE public.briefing_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view template"
  ON public.briefing_template FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Staff can insert template"
  ON public.briefing_template FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Staff can update template"
  ON public.briefing_template FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Admins can delete template"
  ON public.briefing_template FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));

CREATE TRIGGER trg_briefing_template_updated
  BEFORE UPDATE ON public.briefing_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Filled briefings per client
CREATE TABLE public.briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Briefing',
  meeting_date date,
  status text NOT NULL DEFAULT 'draft',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_briefings_client ON public.briefings(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefings TO authenticated;
GRANT ALL ON public.briefings TO service_role;

ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all briefings"
  ON public.briefings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Client can view own briefings"
  ON public.briefings FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Staff can insert briefings"
  ON public.briefings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Staff can update briefings"
  ON public.briefings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Staff can delete briefings"
  ON public.briefings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE TRIGGER trg_briefings_updated
  BEFORE UPDATE ON public.briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default template (14 sections)
INSERT INTO public.briefing_template (name, sections) VALUES (
  'Template padrão',
  '[
    {"id":"s1","title":"1. Informações da Empresa","questions":[
      {"id":"s1q1","text":"Nome da empresa / marca"},
      {"id":"s1q2","text":"Razão social e CNPJ"},
      {"id":"s1q3","text":"Segmento de atuação"},
      {"id":"s1q4","text":"Tempo de mercado"},
      {"id":"s1q5","text":"História breve da empresa"},
      {"id":"s1q6","text":"Missão, visão e valores"},
      {"id":"s1q7","text":"Site e redes sociais atuais"}
    ]},
    {"id":"s2","title":"2. Público-alvo","questions":[
      {"id":"s2q1","text":"Descreva seu cliente ideal (idade, gênero, localização, renda)"},
      {"id":"s2q2","text":"Quais dores e desejos ele possui?"},
      {"id":"s2q3","text":"Onde este público costuma estar (redes, canais, locais)?"},
      {"id":"s2q4","text":"Existe mais de uma persona? Quais?"}
    ]},
    {"id":"s3","title":"3. Produtos e Serviços","questions":[
      {"id":"s3q1","text":"Quais produtos/serviços oferecem?"},
      {"id":"s3q2","text":"Qual é o carro-chefe?"},
      {"id":"s3q3","text":"Quais são os diferenciais em relação ao mercado?"},
      {"id":"s3q4","text":"Existe algum lançamento próximo?"}
    ]},
    {"id":"s4","title":"4. Concorrência","questions":[
      {"id":"s4q1","text":"Cite 3 principais concorrentes"},
      {"id":"s4q2","text":"O que admira neles?"},
      {"id":"s4q3","text":"O que faria diferente?"}
    ]},
    {"id":"s5","title":"5. Posicionamento e Marca","questions":[
      {"id":"s5q1","text":"Como quer que a marca seja percebida?"},
      {"id":"s5q2","text":"3 palavras que traduzem a essência"},
      {"id":"s5q3","text":"3 palavras que NÃO combinam com a marca"},
      {"id":"s5q4","text":"Existe manual de marca? Se sim, envie."}
    ]},
    {"id":"s6","title":"6. Redes Sociais","questions":[
      {"id":"s6q1","text":"Quais redes já utilizam?"},
      {"id":"s6q2","text":"Frequência atual de postagens"},
      {"id":"s6q3","text":"Quais redes deseja focar agora?"},
      {"id":"s6q4","text":"Já investe em tráfego pago?"}
    ]},
    {"id":"s7","title":"7. Conteúdo","questions":[
      {"id":"s7q1","text":"Que tipos de conteúdo funcionam melhor?"},
      {"id":"s7q2","text":"Quais temas quer abordar?"},
      {"id":"s7q3","text":"O que NÃO pode ser abordado?"},
      {"id":"s7q4","text":"Tem cases, depoimentos ou bastidores para compartilhar?"}
    ]},
    {"id":"s8","title":"8. Objetivos","questions":[
      {"id":"s8q1","text":"Qual é o objetivo principal com as redes?"},
      {"id":"s8q2","text":"Como medirá o sucesso?"},
      {"id":"s8q3","text":"Metas específicas para 3, 6 e 12 meses"}
    ]},
    {"id":"s9","title":"9. Tom de Voz e Comunicação","questions":[
      {"id":"s9q1","text":"Qual o tom desejado (formal, próximo, divertido, técnico)?"},
      {"id":"s9q2","text":"Usa gírias, emojis, hashtags?"},
      {"id":"s9q3","text":"Referências de marcas que gosta da comunicação"}
    ]},
    {"id":"s10","title":"10. Cronograma","questions":[
      {"id":"s10q1","text":"Data de início desejada"},
      {"id":"s10q2","text":"Existem datas importantes/sazonalidades a considerar?"},
      {"id":"s10q3","text":"Prazos críticos de campanhas"}
    ]},
    {"id":"s11","title":"11. Orçamento","questions":[
      {"id":"s11q1","text":"Orçamento previsto para produção de conteúdo"},
      {"id":"s11q2","text":"Orçamento previsto para tráfego pago"},
      {"id":"s11q3","text":"Existe flexibilidade?"}
    ]},
    {"id":"s12","title":"12. Aprovação","questions":[
      {"id":"s12q1","text":"Quem é o responsável por aprovar?"},
      {"id":"s12q2","text":"Existe alguém além do responsável que participa da aprovação?"},
      {"id":"s12q3","text":"Prazo médio para aprovação"}
    ]},
    {"id":"s13","title":"13. Materiais","questions":[
      {"id":"s13q1","text":"Logotipo enviado?"},
      {"id":"s13q2","text":"Manual da marca enviado?"},
      {"id":"s13q3","text":"Fotos da empresa/equipe enviadas?"},
      {"id":"s13q4","text":"Vídeos disponíveis enviados?"},
      {"id":"s13q5","text":"Catálogo, lista de serviços e tabela de preços enviados?"}
    ]},
    {"id":"s14","title":"14. Informações Adicionais","questions":[
      {"id":"s14q1","text":"Existe alguma informação importante que ainda não perguntamos?"},
      {"id":"s14q2","text":"Qual é sua maior expectativa em relação ao nosso trabalho?"},
      {"id":"s14q3","text":"Se pudesse resolver apenas um problema através das redes sociais, qual seria?"}
    ]}
  ]'::jsonb
);
