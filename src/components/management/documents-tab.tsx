import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { FILE_CATEGORIES, categoryMeta, formatBytes, type FileRow } from "@/lib/library";
import { formatDate } from "@/lib/client-master";

import { Button } from "@/components/ui/button";
import { ContractsCard } from "@/components/clients/contracts-card";
import { EmptyState, SectionCard } from "./master-shared";

export function DocumentsTab({ clientId }: { clientId: string }) {
  const { data: files = [] } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id, name, category, mime_type, size_bytes, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Pick<
        FileRow,
        "id" | "name" | "category" | "mime_type" | "size_bytes" | "created_at"
      >[];
    },
  });

  const grouped = FILE_CATEGORIES.map((cat) => ({
    ...cat,
    items: files.filter((f) => f.category === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Documentos do cliente"
        description="Contratos, briefings, identidade visual, logos e materiais enviados"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/library">
              Abrir biblioteca
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      >
        {grouped.length === 0 ? (
          <EmptyState>
            Nenhum arquivo vinculado a este cliente. Envie materiais pela Biblioteca.
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {grouped.map((g) => {
              const meta = categoryMeta(g.value);
              const Icon = meta.icon;
              return (
                <div key={g.value}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded ${meta.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm font-medium">{g.label}</p>
                    <span className="text-xs text-muted-foreground">({g.items.length})</span>
                  </div>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {g.items.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(f.size_bytes)}
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {formatDate(f.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <ContractsCard clientId={clientId} />
    </div>
  );
}
