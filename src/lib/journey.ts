export type JourneyStage =
  | "closing"
  | "kickoff"
  | "onboarding"
  | "ongoing"
  | "renewal"
  | "offboarded";

export const JOURNEY_STAGES: {
  value: JourneyStage;
  label: string;
  tone: string;
  dot: string;
}[] = [
  { value: "closing", label: "Fechamento", tone: "bg-sky-500/10 text-sky-600 border-sky-500/30", dot: "bg-sky-500" },
  { value: "kickoff", label: "Kickoff", tone: "bg-violet-500/10 text-violet-600 border-violet-500/30", dot: "bg-violet-500" },
  { value: "onboarding", label: "Onboarding", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30", dot: "bg-amber-500" },
  { value: "ongoing", label: "Acompanhamento", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", dot: "bg-emerald-500" },
  { value: "renewal", label: "Renovação", tone: "bg-teal-500/10 text-teal-600 border-teal-500/30", dot: "bg-teal-500" },
  { value: "offboarded", label: "Encerrado", tone: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30", dot: "bg-zinc-400" },
];

export function journeyMeta(stage: string | null | undefined) {
  return JOURNEY_STAGES.find((s) => s.value === stage) ?? JOURNEY_STAGES[0];
}
