import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ViewAsDialog } from "@/components/view-as";

export const Route = createFileRoute("/_authenticated/configuracoes/ver-como")({
  head: () => ({ meta: [{ title: "Ver como cliente ou equipe · Configurações · RSM Gestão de Marketing" }] }),
  component: ViewAsPage,
});

function ViewAsPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ver como cliente ou equipe</h1>
        <p className="text-sm text-muted-foreground">
          Entre na conta de um cliente ou de alguém da equipe para ver o app exatamente como essa pessoa vê.
          Uma faixa no topo mostra quando você está nesse modo e permite voltar para a sua conta.
        </p>
      </header>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">Escolha o cliente ou a pessoa da equipe.</p>
          <Button onClick={() => setOpen(true)}>
            <Eye className="mr-2 size-4" aria-hidden /> Escolher quem ver
          </Button>
        </CardContent>
      </Card>
      <ViewAsDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
