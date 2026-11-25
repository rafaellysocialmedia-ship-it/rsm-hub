import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CornerUpLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/** Itens do checklist da Revisão interna (as chaves são validadas no banco). */
export const INTERNAL_REVIEW_CHECKLIST = [
  { key: "texto", label: "Texto revisado" },
  { key: "midia", label: "Mídia correta" },
  { key: "legenda", label: "Legenda e hashtags" },
  { key: "data", label: "Data e hora" },
] as const;

type Key = (typeof INTERNAL_REVIEW_CHECKLIST)[number]["key"];

/**
 * Painel mostrado no editor quando o post está em Revisão interna.
 * "Aprovar e enviar ao cliente" exige o checklist completo;
 * "Devolver para produção" exige um comentário (fica interno).
 */
export function InternalReviewPanel({
  postId,
  expectedUpdatedAt,
  dirty,
  onDone,
}: {
  postId: string;
  expectedUpdatedAt: string;
  dirty: boolean;
  onDone: (status: "review" | "production") => void;
}) {
  const [checked, setChecked] = useState<Record<Key, boolean>>({
    texto: false,
    midia: false,
    legenda: false,
    data: false,
  });
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState("");
  const complete = INTERNAL_REVIEW_CHECKLIST.every((i) => checked[i.key]);

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("approve_internal_review", {
        _post_id: postId,
        _checklist: checked,
        _expected_updated_at: expectedUpdatedAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Revisão aprovada. Post enviado para aprovação do cliente.");
      onDone("review");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendBack = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("return_to_production", {
        _post_id: postId,
        _comment: comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post devolvido para produção.");
      onDone("production");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = approve.isPending || sendBack.isPending;

  return (
    <section
      aria-labelledby="internal-review-title"
      className="space-y-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-indigo-700" aria-hidden />
        <h3 id="internal-review-title" className="text-sm font-semibold text-indigo-900">
          Revisão interna
        </h3>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2" disabled={busy}>
        <legend className="sr-only">Checklist da revisão</legend>
        {INTERNAL_REVIEW_CHECKLIST.map((item) => (
          <label
            key={item.key}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm"
          >
            <Checkbox
              checked={checked[item.key]}
              onCheckedChange={(v) => setChecked((c) => ({ ...c, [item.key]: v === true }))}
            />
            {item.label}
          </label>
        ))}
      </fieldset>
      {dirty && (
        <p className="text-xs text-amber-700">Salve as alterações antes de concluir a revisão.</p>
      )}
      {returning ? (
        <div className="space-y-2">
          <Label htmlFor="return-comment" className="text-xs font-medium">
            O que precisa ser ajustado? (obrigatório)
          </Label>
          <Textarea
            id="return-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Ex.: trocar a imagem do slide 2 e revisar a chamada."
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy || comment.trim().length < 3}
              onClick={() => sendBack.mutate()}
            >
              Devolver para produção
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setReturning(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!complete || dirty || busy} onClick={() => approve.mutate()}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Aprovar e enviar ao cliente
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setReturning(true)}>
            <CornerUpLeft className="mr-1.5 h-4 w-4" />
            Devolver para produção
          </Button>
        </div>
      )}
    </section>
  );
}
