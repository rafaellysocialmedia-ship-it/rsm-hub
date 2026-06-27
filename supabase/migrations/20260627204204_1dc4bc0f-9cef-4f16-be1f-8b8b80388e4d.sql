
-- Status enum
CREATE TYPE public.post_status AS ENUM ('idea', 'production', 'review', 'approved', 'scheduled', 'published');

-- POSTS
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  social_network text,
  scheduled_date date,
  scheduled_time time,
  objective text,
  format text,
  theme text,
  pillar text,
  headline text,
  caption text,
  cta text,
  hashtags text,
  status public.post_status NOT NULL DEFAULT 'idea',
  recurrence jsonb,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all posts" ON public.posts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));
CREATE POLICY "Clients can view own posts" ON public.posts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = posts.client_id AND c.user_id = auth.uid()));
CREATE POLICY "Staff can insert posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));
CREATE POLICY "Staff can update posts" ON public.posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));
CREATE POLICY "Admins can delete posts" ON public.posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrator'));

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_posts_client_id ON public.posts(client_id);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_scheduled_date ON public.posts(scheduled_date);

-- POST FILES
CREATE TABLE public.post_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_files TO authenticated;
GRANT ALL ON public.post_files TO service_role;

ALTER TABLE public.post_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View post files via post access" ON public.post_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_files.post_id));
CREATE POLICY "Staff manage post files" ON public.post_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'))
  WITH CHECK (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'team'));

CREATE INDEX idx_post_files_post_id ON public.post_files(post_id);

-- POST COMMENTS
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments via post access" ON public.post_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id));
CREATE POLICY "Authenticated can insert comments on accessible posts" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id));
CREATE POLICY "Authors update own comments" ON public.post_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors or admins delete comments" ON public.post_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'administrator'));

CREATE INDEX idx_post_comments_post_id ON public.post_comments(post_id);

-- Realtime
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.post_files REPLICA IDENTITY FULL;
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
