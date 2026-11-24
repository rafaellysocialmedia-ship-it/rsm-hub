import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { legacyTarget } from "@/lib/navigation";

/**
 * Endereços antigos (antes do menu com 7 áreas) continuam funcionando:
 * qualquer rota que não existe mais é redirecionada para a nova,
 * mantendo os parâmetros (?open=, ?comment=, ?tab=, ?mes=…).
 */
export const Route = createFileRoute("/_authenticated/$")({
  beforeLoad: ({ location }) => {
    const target = legacyTarget(location.pathname, location.search as Record<string, unknown>);
    if (target) throw redirect({ href: target, replace: true });
  },
  component: NotFound,
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Este endereço não existe ou mudou de lugar. Use o menu ao lado ou volte para o início.
      </p>
      <Link to="/inicio" className="text-sm font-medium text-brand-accent underline">
        Ir para o Início
      </Link>
    </div>
  );
}
