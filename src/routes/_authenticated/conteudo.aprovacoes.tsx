import { createFileRoute } from "@tanstack/react-router";
import { ClientPortal } from "@/components/workspace/client-approvals";

export const Route = createFileRoute("/_authenticated/conteudo/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovações · Conteúdo · RSM Gestão de Marketing" }] }),
  component: () => (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <ClientPortal />
    </div>
  ),
});
