
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Staff or self insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'administrator')
  OR public.has_role(auth.uid(),'team')
  OR user_id = auth.uid()
);
