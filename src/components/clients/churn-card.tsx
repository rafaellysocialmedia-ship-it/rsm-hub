import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const reasons = ["Questões financeiras", "Insatisfação com os resultados", "Insatisfação com o atendimento", "Mudança de estratégia", "Contratou outro fornecedor", "Encerramento da empresa", "Não renovou o contrato", "Outro"];
type Churn = { churned: boolean; churn_date: string | null; churn_reason: string | null; churn_notes: string | null };
export function ChurnCard({ clientId }: { clientId: string }) {
  const { hasRole } = useAuth();
  const canManage = hasRole("administrator") || hasRole("team");
  const qc = useQueryClient();
  const [churned, setChurned] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["client-churn", clientId], enabled: canManage, queryFn: async () => {
    const { data, error } = await supabase.from("clients").select("churned,churn_date,churn_reason,churn_notes").eq("id", clientId).single();
    if (error) throw error;
    return data as unknown as Churn;
  }});
  useEffect(() => { if (data) { setChurned(data.churned); setDate(data.churn_date ?? ""); setReason(data.churn_reason ?? ""); setNotes(data.churn_notes ?? ""); } }, [data]);
  const save = useMutation({ mutationFn: async () => {
    if (churned && (!date || !reason || (reason === "Outro" && !notes.trim()))) throw new Error("Preencha a data e o motivo do churn. Para Outro, descreva o motivo.");
    const { error } = await supabase.from("clients").update({ churned, churn_date: date || null, churn_reason: reason || null, churn_notes: notes.trim() || null, ...(churned ? { status: "inactive" as const, journey_stage: "offboarded" as const } : {}) } as never).eq("id", clientId).select("id").single();
    if (error) throw error;
  }, onSuccess: () => { toast.success("Churn atualizado"); for (const key of ["clients", "management-clients", "management-client", "client-churn", "journey-events", "finance-contracts", "finance-charges", "finance-history", "finance-clients", "client-services"]) qc.invalidateQueries({ queryKey: [key] }); }, onError: (e: Error) => toast.error(e.message) });
  if (!canManage) return null;
  return <Card className="shadow-soft"><CardHeader><CardTitle className="text-base">Churn do cliente</CardTitle></CardHeader><CardContent className="space-y-4">
    {error ? <p className="text-sm text-destructive">Não foi possível carregar o churn.</p> : isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : <>
    <div className="flex items-center gap-3"><Switch id={`churn-${clientId}`} checked={churned} onCheckedChange={(v) => { setChurned(v); if (v && !date) setDate(new Date().toLocaleDateString("en-CA")); }} /><Label htmlFor={`churn-${clientId}`}>Cliente deu churn</Label></div>
    {(churned || date || reason || notes) && <div className="space-y-3">
      <div><Label htmlFor={`churn-date-${clientId}`}>Data do encerramento</Label><Input id={`churn-date-${clientId}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><Label>Motivo do churn</Label><Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger><SelectContent>{reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor={`churn-notes-${clientId}`}>Detalhes e observações</Label><Textarea id={`churn-notes-${clientId}`} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} /></div>
    </div>}
    <p className="text-sm text-muted-foreground">Registrar churn deixa o cliente inativo, encerra sua jornada e desativa as mensalidades automáticas dos contratos e serviços. Cobranças já lançadas e pagamentos são preservados.</p>
    <p className="text-sm text-muted-foreground">Desmarcar churn não reativa as mensalidades automaticamente.</p>
    <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar churn"}</Button>
    </>}
  </CardContent></Card>;
}
