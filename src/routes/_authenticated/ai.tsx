import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Bot, Wrench, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai")({
  component: AiLayout,
});

function AiLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isTools = path.startsWith("/ai/tools");
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Bot className="h-6 w-6 text-primary" /> Assistente de IA
            </h1>
            <p className="text-sm text-muted-foreground">
              Chat criativo e geradores para acelerar sua rotina de conteúdo.
            </p>
          </div>
          <nav className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <Link
              to="/ai"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                !isTools ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MessageSquare className="h-4 w-4" /> Chat
            </Link>
            <Link
              to="/ai/tools"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                isTools ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Wrench className="h-4 w-4" /> Ferramentas
            </Link>
          </nav>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
