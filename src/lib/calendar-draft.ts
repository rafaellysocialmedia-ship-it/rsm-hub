import type { Post } from "./posts";

/** Merge only the server-confirmed revision fields, leaving unrelated draft work intact. */
export function reconcileCalendarDraft(
  draft: Partial<Post>,
  baseline: Partial<Post>,
  saved: Post,
  moved: boolean,
) {
  const patch = {
    scheduled_date: saved.scheduled_date,
    scheduled_time: saved.scheduled_time,
    status: saved.status,
    updated_at: saved.updated_at,
    content_revision: saved.content_revision,
  };
  return {
    baseline: { ...baseline, ...patch },
    draft: {
      ...draft,
      ...patch,
      scheduled_date: moved ? saved.scheduled_date : draft.scheduled_date,
      scheduled_time:
        moved && saved.scheduled_time !== baseline.scheduled_time
          ? saved.scheduled_time
          : draft.scheduled_time,
      status: saved.status !== baseline.status ? saved.status : draft.status,
    },
  };
}
