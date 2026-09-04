-- Clients can request a paid course or immediately claim a published free
-- course. The price, currency, provider and status must match the course,
-- preventing a client from granting themselves paid access.
GRANT INSERT ON public.course_purchases TO authenticated;

CREATE POLICY "Users request published course access"
ON public.course_purchases
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.courses AS course
    WHERE course.id = course_id
      AND course.is_published = true
      AND amount_cents = course.price_cents
      AND currency = course.currency
      AND (
        (
          course.price_cents = 0
          AND status = 'paid'
          AND provider = 'free'
          AND paid_at IS NOT NULL
        )
        OR
        (
          course.price_cents > 0
          AND status = 'pending'
          AND provider = 'manual_request'
          AND paid_at IS NULL
        )
      )
  )
);
