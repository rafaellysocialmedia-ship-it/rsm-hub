import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, FileText, Settings2, ShieldCheck, Users2 } from "lucide-react";

import { useFinanceAccess, usePaymentMethods } from "@/hooks/use-finance";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/finance/settings")({
  head: () => ({
    meta: [
      { title: "Configurações · Financeiro" },
      {
        name: "description",
        content:
          "Permissões do financeiro interno, formas de pagamento padrão e roadmap de contas a pagar e integrações.",
      },
      { property: "og:title", content: "Configurações · Financeiro" },
      { property: "og:description", content: "Ajustes e permissões do módulo financeiro interno." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinanceSettingsPage,
  errorComponent: ({ error }) => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">Página não encontrada</div>
  ),
});

const ROADMAP = [
  "Contas a Pagar e Despesas",
  "Fornecedores e Colaboradores",
  "Folha e pagamentos",
  "Fluxo de Caixa e Centros de Custo",
  "Relatórios financeiros e DRE",
  "Integração Asaas (PIX, boleto, cartão)",
  "Emissão de nota fiscal",
];

function FinanceSettingsPage() {
  const access = useFinanceAccess();
  const { data: methods = [] } = usePaymentMethods();
  const defaultMethod = methods.find((m) => m.is_default);

  if (access.loading) return null;
  if (!access.canView) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        O módulo financeiro é restrito à equipe autorizada.
      </div>
    );
  }

  const perms: [string, boolean][] = [
    ["Visualizar financeiro", access.canView],
    ["Criar cobrança", access.canCreate],
    ["Editar cobrança / registrar pagamento", access.canEdit],
    ["Cancelar cobrança", access.canCancel],
    ["Visualizar contratos", access.canViewContracts],
    ["Editar contratos", access.canEditContracts],
    ["Configurar formas de pagamento", access.canConfigure],
  ];

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings2 className="h-6 w-6 text-primary" /> Configurações do Financeiro
        </h1>
        <p className="text-sm text-muted-foreground">
          Módulo exclusivamente interno — clientes nunca têm acesso ao financeiro administrativo.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Suas permissões
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {perms.map(([label, ok]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <Badge
                  variant="outline"
                  className={
                    ok
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border bg-muted text-muted-foreground"
                  }
                >
                  {ok ? "Liberado" : "Bloqueado"}
                </Badge>
              </div>
            ))}
            {access.isAdmin && (
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to="/admin/permissions">Gerenciar permissões</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" /> Cobrança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Forma padrão</span>
              <span className="font-medium">{defaultMethod?.label ?? "Não definida"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Formas ativas</span>
              <span className="font-medium">{methods.filter((m) => m.is_active).length}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="outline" size="sm">
                <Link to="/finance/payment-methods">Formas de pagamento</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/finance/contracts">
                  <FileText className="mr-1.5 h-4 w-4" /> Contratos
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/finance/clients">
                  <Users2 className="mr-1.5 h-4 w-4" /> Clientes
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Próximas etapas previstas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ROADMAP.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
