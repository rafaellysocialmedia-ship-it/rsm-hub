import { useQuery } from "@tanstack/react-query";
import { Plug } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { INTEGRATION_PROVIDERS, type ClientIntegration } from "@/lib/client-master";

import { Badge } from "@/components/ui/badge";
import { SectionCard } from "./master-shared";

export function IntegrationsTab({ clientId }: { clientId: string }) {
  const { data: integrations = [] } = useQuery({
    queryKey: ["client-integrations", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_integrations")
        .select("*")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data ?? []) as ClientIntegration[];
    },
  });

  return (
    <SectionCard
      title="Integrações"
      description="Espaço preparado para futuras conexões. Nenhuma sincronização está ativa nesta etapa."
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INTEGRATION_PROVIDERS.map((p) => {
          const row = integrations.find((i) => i.provider === p.key);
          const connected = row?.status === "connected";
          return (
            <li
              key={p.key}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <Plug className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="truncate text-xs text-muted-foreground">{p.description}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {connected ? "Conectado" : "Em breve"}
              </Badge>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
