export type CommercialProposal = {
  id: string;
  prospect_name: string;
  company: string;
  email: string;
  phone: string;
  plan: string;
  scope: string;
  amount: number;
  start_date: string;
  end_date: string | null;
  first_due_date: string;
  stage: "lead" | "draft" | "sent" | "accepted" | "lost" | "converted";
  acceptance_note: string;
  accepted_at: string | null;
  accepted_by: string | null;
  client_id: string | null;
  contract_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type ClientRequest = {
  id: string;
  client_id: string;
  kind: "support" | "complaint" | "material";
  title: string;
  description: string;
  status: "open" | "waiting_client" | "done";
  response: string;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
export type ExitDetails = {
  client_id: string;
  last_month: string | null;
  pending_items: string;
  return_chance: "unknown" | "low" | "medium" | "high";
  updated_at: string;
};
export const PROPOSAL_STAGES = {
  lead: "Lead",
  draft: "Proposta em elaboração",
  sent: "Proposta enviada",
  accepted: "Aceite registrado",
  converted: "Convertida em cliente",
  lost: "Não avançou",
};
export const REQUEST_STATUS = {
  open: "Aguardando RSM",
  waiting_client: "Aguardando cliente",
  done: "Concluído",
};
export type MeetingRecap = {
  meeting_id: string;
  summary: string;
  decisions: string;
  next_steps: string;
  updated_at: string;
};
export type RequestMessage = {
  id: string;
  request_id: string;
  body: string;
  created_by: string;
  created_at: string;
};
