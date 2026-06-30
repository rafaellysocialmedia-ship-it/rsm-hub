import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const TOGGLES: { key: string; label: string; desc: string }[] = [
  { key: "can_view_posts", label: "Visualizar publicações", desc: "Permite ver os posts do calendário editorial." },
  { key: "can_view_media", label: "Visualizar mídias", desc: "Imagens e vídeos anexados aos posts." },
  { key: "can_view_captions", label: "Ler legendas", desc: "Mostra o texto da legenda, CTA e hashtags." },
  { key: "can_view_comments", label: "Visualizar comentários", desc: "Acessa o thread de comentários do post." },
  { key: "can_comment", label: "Comentar", desc: "Permite enviar comentários nas publicações." },
  { key: "can_approve", label: "Aprovar", desc: "Permite aprovar uma publicação." },
  { key: "can_request_changes", label: "Solicitar alterações", desc: "Permite pedir ajustes ou rejeitar um post." },
  { key: "can_view_history", label: "Histórico de versões", desc: "Mostra todas as edições anteriores do post." },
];

export function PortalSettingsCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["portal-settings", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_portal_settings")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: created, error: e2 } = await supabase
          .from("client_portal_settings")
          .insert({ client_id: clientId })
          .select()
          .single();
        if (e2) throw e2;
        return created;
      }
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const { error } = await supabase
        .from("client_portal_settings")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("client_id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-settings", clientId] });
      toast.success("Permissões atualizadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" /> Permissões do Portal
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Defina o que este cliente poderá ver e fazer na área exclusiva.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {TOGGLES.map((t, i) => {
          const value = (settings as Record<string, unknown> | undefined)?.[t.key] as boolean | undefined;
          return (
            <div key={t.key}>
              {i > 0 && <Separator className="my-1" />}
              <div className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Label htmlFor={t.key} className="text-sm font-medium">{t.label}</Label>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
                <Switch
                  id={t.key}
                  checked={!!value}
                  disabled={!settings || update.isPending}
                  onCheckedChange={(v) => update.mutate({ [t.key]: v })}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
