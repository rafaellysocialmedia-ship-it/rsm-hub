
-- =========================================================
-- 1) client_portal_settings : admin controls what each client sees
-- =========================================================
CREATE TABLE public.client_portal_settings (
  client_id            UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  can_view_posts       BOOLEAN NOT NULL DEFAULT true,
  can_view_media       BOOLEAN NOT NULL DEFAULT true,
  can_view_captions    BOOLEAN NOT NULL DEFAULT true,
  can_view_comments    BOOLEAN NOT NULL DEFAULT true,
  can_comment          BOOLEAN NOT NULL DEFAULT true,
  can_approve          BOOLEAN NOT NULL DEFAULT true,
  can_request_changes  BOOLEAN NOT NULL DEFAULT true,
  can_view_history     BOOLEAN NOT NULL DEFAULT true,
  visible_statuses     TEXT[] NOT NULL DEFAULT ARRAY['review','approved','scheduled','published']::text[],
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_settings TO authenticated;
GRANT ALL ON public.client_portal_settings TO service_role;

ALTER TABLE public.client_portal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage portal settings"
ON public.client_portal_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Client views own portal settings"
ON public.client_portal_settings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_portal_settings.client_id AND c.user_id = auth.uid()));

CREATE TRIGGER trg_client_portal_settings_updated
BEFORE UPDATE ON public.client_portal_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill defaults for existing clients
INSERT INTO public.client_portal_settings (client_id)
SELECT id FROM public.clients
ON CONFLICT DO NOTHING;

-- Auto-create settings when a new client is created
CREATE OR REPLACE FUNCTION public.create_client_portal_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.client_portal_settings (client_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_client_portal_settings() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_client_portal_settings() TO service_role;

CREATE TRIGGER trg_clients_create_portal_settings
AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.create_client_portal_settings();

-- =========================================================
-- 2) post_versions : version history
-- =========================================================
CREATE TABLE public.post_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  snapshot        JSONB NOT NULL,
  changed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, version_number)
);
CREATE INDEX idx_post_versions_post ON public.post_versions(post_id, version_number DESC);

GRANT SELECT, INSERT ON public.post_versions TO authenticated;
GRANT ALL ON public.post_versions TO service_role;

ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage post versions"
ON public.post_versions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'))
WITH CHECK (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Clients view versions of own posts"
ON public.post_versions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'administrator')
  OR public.has_role(auth.uid(),'team')
  OR EXISTS (
    SELECT 1 FROM public.posts p
    JOIN public.clients c ON c.id = p.client_id
    JOIN public.client_portal_settings s ON s.client_id = c.id
    WHERE p.id = post_versions.post_id
      AND c.user_id = auth.uid()
      AND s.can_view_history
  )
);

-- Snapshot trigger: every UPDATE on posts inserts a new version row
CREATE OR REPLACE FUNCTION public.snapshot_post_version()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _next INTEGER;
BEGIN
  -- Only snapshot if content actually changed
  IF (TG_OP = 'UPDATE') AND (
       NEW.title IS DISTINCT FROM OLD.title OR
       NEW.headline IS DISTINCT FROM OLD.headline OR
       NEW.caption IS DISTINCT FROM OLD.caption OR
       NEW.cta IS DISTINCT FROM OLD.cta OR
       NEW.hashtags IS DISTINCT FROM OLD.hashtags OR
       NEW.theme IS DISTINCT FROM OLD.theme OR
       NEW.objective IS DISTINCT FROM OLD.objective OR
       NEW.format IS DISTINCT FROM OLD.format OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date OR
       NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time
  ) THEN
    SELECT COALESCE(MAX(version_number),0) + 1 INTO _next FROM public.post_versions WHERE post_id = NEW.id;
    INSERT INTO public.post_versions (post_id, version_number, snapshot, changed_by)
    VALUES (NEW.id, _next, to_jsonb(OLD), auth.uid());
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.snapshot_post_version() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.snapshot_post_version() TO service_role;

CREATE TRIGGER trg_posts_snapshot_version
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.snapshot_post_version();

-- =========================================================
-- 3) post_activity_log : history of actions
-- =========================================================
CREATE TABLE public.post_activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  detail      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_activity_post ON public.post_activity_log(post_id, created_at DESC);
CREATE INDEX idx_post_activity_client ON public.post_activity_log(client_id, created_at DESC);

GRANT SELECT, INSERT ON public.post_activity_log TO authenticated;
GRANT ALL ON public.post_activity_log TO service_role;

ALTER TABLE public.post_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view all activity"
ON public.post_activity_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'team'));

CREATE POLICY "Clients view own activity"
ON public.post_activity_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = post_activity_log.client_id AND c.user_id = auth.uid()));

CREATE POLICY "Authenticated insert activity"
ON public.post_activity_log FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    public.has_role(auth.uid(),'administrator')
    OR public.has_role(auth.uid(),'team')
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = post_activity_log.client_id AND c.user_id = auth.uid())
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.post_activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_portal_settings;

-- =========================================================
-- 4) Notifications on approval / comment
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_on_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _post RECORD;
  _client_name TEXT;
  _decision_label TEXT;
  _staff RECORD;
BEGIN
  IF NEW.decision = 'pending' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.decision IS NOT DISTINCT FROM NEW.decision THEN RETURN NEW; END IF;

  SELECT * INTO _post FROM public.posts WHERE id = NEW.post_id;
  SELECT name INTO _client_name FROM public.clients WHERE id = NEW.client_id;
  _decision_label := CASE NEW.decision
    WHEN 'approved' THEN 'aprovou'
    WHEN 'rejected' THEN 'rejeitou'
    WHEN 'changes_requested' THEN 'solicitou alterações em'
    ELSE 'atualizou' END;

  -- Notify all staff (administrators + team)
  FOR _staff IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE ur.role IN ('administrator','team')
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      _staff.user_id,
      COALESCE(_client_name,'Cliente') || ' ' || _decision_label || ' "' || COALESCE(_post.title,'publicação') || '"',
      COALESCE(NEW.feedback, ''),
      '/posts'
    );
  END LOOP;

  -- Activity log
  INSERT INTO public.post_activity_log (post_id, client_id, actor_id, action, detail)
  VALUES (NEW.post_id, NEW.client_id, NEW.decided_by, 'approval_' || NEW.decision::text, NEW.feedback);

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_on_approval() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_on_approval() TO service_role;

CREATE TRIGGER trg_post_approvals_notify
AFTER INSERT OR UPDATE ON public.post_approvals
FOR EACH ROW EXECUTE FUNCTION public.notify_on_approval();

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _post RECORD;
  _client RECORD;
  _author_is_staff BOOLEAN;
  _author_name TEXT;
  _target RECORD;
BEGIN
  SELECT * INTO _post FROM public.posts WHERE id = NEW.post_id;
  IF _post.client_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO _client FROM public.clients WHERE id = _post.client_id;

  _author_is_staff := public.has_role(NEW.author_id,'administrator') OR public.has_role(NEW.author_id,'team');
  SELECT COALESCE(name, email) INTO _author_name FROM public.profiles WHERE id = NEW.author_id;

  -- Activity log
  INSERT INTO public.post_activity_log (post_id, client_id, actor_id, action, detail)
  VALUES (NEW.post_id, _post.client_id, NEW.author_id, 'commented', LEFT(NEW.content, 280));

  IF _author_is_staff THEN
    -- Notify the client user
    IF _client.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_client.user_id,
              COALESCE(_author_name,'Equipe') || ' comentou em "' || COALESCE(_post.title,'publicação') || '"',
              LEFT(NEW.content, 200), '/portal');
    END IF;
  ELSE
    -- Client commented → notify all staff
    FOR _target IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('administrator','team')
    LOOP
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (_target.user_id,
              COALESCE(_client.name,'Cliente') || ' comentou em "' || COALESCE(_post.title,'publicação') || '"',
              LEFT(NEW.content, 200), '/posts');
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_on_comment() TO service_role;

CREATE TRIGGER trg_post_comments_notify
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Allow notification inserts triggered by clients (currently policy restricts INSERT to staff).
-- We add a permissive policy so SECURITY DEFINER triggers (run as the calling user) can insert.
DROP POLICY IF EXISTS "Staff insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- =========================================================
-- 5) Update post_comments / post_files SELECT to honor portal settings
-- =========================================================
DROP POLICY IF EXISTS "View comments via post access" ON public.post_comments;
CREATE POLICY "View comments via post access"
ON public.post_comments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'administrator')
  OR public.has_role(auth.uid(),'team')
  OR EXISTS (
    SELECT 1 FROM public.posts p
    JOIN public.clients c ON c.id = p.client_id
    JOIN public.client_portal_settings s ON s.client_id = c.id
    WHERE p.id = post_comments.post_id
      AND c.user_id = auth.uid()
      AND s.can_view_comments
  )
);

DROP POLICY IF EXISTS "View post files via post access" ON public.post_files;
CREATE POLICY "View post files via post access"
ON public.post_files FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'administrator')
  OR public.has_role(auth.uid(),'team')
  OR EXISTS (
    SELECT 1 FROM public.posts p
    JOIN public.clients c ON c.id = p.client_id
    JOIN public.client_portal_settings s ON s.client_id = c.id
    WHERE p.id = post_files.post_id
      AND c.user_id = auth.uid()
      AND s.can_view_media
  )
);
