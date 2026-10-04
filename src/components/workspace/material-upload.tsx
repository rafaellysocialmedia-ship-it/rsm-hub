import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
export function MaterialUpload({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["portal-settings", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_portal_settings")
        .select("*")
        .eq("client_id", clientId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  if (!q.data?.can_upload_materials) return null;
  return (
    <section className="mb-5 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Enviar materiais para a equipe</h2>
      <p className="my-2 text-sm text-muted-foreground">
        Imagens, vídeos e documentos da sua marca. Não envie senhas. Até 25 MB por arquivo.
      </p>
      <label className="block text-sm font-medium">
        {busy ? "Enviando…" : "Selecionar arquivo"}
        <input
          className="mt-2 block max-w-full text-sm"
          type="file"
          disabled={busy}
          accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !user) return;
            if (file.size > 25 * 1024 * 1024) {
              toast.error("O limite é 25 MB.");
              e.target.value = "";
              return;
            }
            setBusy(true);
            try {
              const path = `${clientId}/uploads/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
              const uploaded = await supabase.storage.from("library-files").upload(path, file);
              if (uploaded.error) throw uploaded.error;
              const { error } = await supabase.from("files").insert({
                client_id: clientId,
                name: file.name,
                storage_path: path,
                size_bytes: file.size,
                mime_type: file.type,
                uploaded_by: user.id,
                is_shared: true,
                category: file.type.startsWith("image/")
                  ? "fotos"
                  : file.type.startsWith("video/")
                    ? "videos"
                    : "documentos",
              });
              if (error) throw error;
              await qc.invalidateQueries({ queryKey: ["client-workspace-files", clientId] });
              toast.success("Material enviado e disponível para a equipe.");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Não foi possível enviar. Tente novamente.",
              );
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
    </section>
  );
}
