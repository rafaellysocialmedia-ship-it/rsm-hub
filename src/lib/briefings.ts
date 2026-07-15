export type BriefingQuestion = {
  id: string;
  text: string;
  answer?: string;
};

export type BriefingSection = {
  id: string;
  title: string;
  questions: BriefingQuestion[];
};

export type BriefingTemplateRow = {
  id: string;
  name: string;
  sections: BriefingSection[];
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BriefingRow = {
  id: string;
  client_id: string | null;
  title: string;
  meeting_date: string | null;
  status: "draft" | "completed";
  sections: BriefingSection[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function newId(prefix = "q") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function briefingCompletion(sections: BriefingSection[]) {
  const all = sections.flatMap((s) => s.questions);
  const total = all.length;
  const answered = all.filter((q) => (q.answer ?? "").trim().length > 0).length;
  return { total, answered, pct: total ? Math.round((answered / total) * 100) : 0 };
}
