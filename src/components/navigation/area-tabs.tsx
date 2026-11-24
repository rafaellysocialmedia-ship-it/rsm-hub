import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { areaForPath, hrefFor, isTabActive, tabsOf, type NavItem } from "@/lib/navigation";

/** Abas da área atual (ex.: Conteúdo › Calendário · Quadro · Aprovações · Biblioteca).
 *  Só aparecem nas telas que são abas; telas de detalhe ficam sem abas. */
export function AreaTabs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { hasRole } = useAuth();
  const { can } = usePermissions();
  const staff = hasRole("administrator") || hasRole("team");
  const area = areaForPath(path);
  if (!staff || !area) return null;
  const tabs = tabsOf(area.key).flatMap((t: NavItem) => {
    const href = hrefFor(t, can);
    return href && (!t.admin || hasRole("administrator")) ? [{ ...t, href }] : [];
  });
  if (tabs.length < 2 || !tabs.some((t) => isTabActive(t.href, path))) return null;
  return (
    <nav
      aria-label={`Abas de ${area.label}`}
      className="sticky top-12 z-20 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <ul className="flex gap-1 overflow-x-auto px-3 sm:px-5 [scrollbar-width:none]">
        {tabs.map((t) => {
          const active = isTabActive(t.href, path);
          const [to, qs] = t.href.split("?");
          return (
            <li key={t.href} className="shrink-0">
              <Link
                to={to as never}
                search={(qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined) as never}
                aria-current={active ? "page" : undefined}
                activeOptions={{ exact: true, includeSearch: false }}
                activeProps={{ "aria-current": active ? "page" : undefined } as never}
                className={`relative inline-flex h-11 items-center px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "font-semibold text-brand after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
