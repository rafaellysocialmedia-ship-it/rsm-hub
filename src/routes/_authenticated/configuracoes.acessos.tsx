import { createFileRoute } from "@tanstack/react-router";
import { VaultPanel } from "@/components/vault/vault-panel";

export const Route = createFileRoute("/_authenticated/configuracoes/acessos")({
  head: () => ({ meta: [{ title: "Acessos da agência · Configurações · RSM Gestão de Marketing" }] }),
  component: () => <VaultPanel scope="agency" />,
});
