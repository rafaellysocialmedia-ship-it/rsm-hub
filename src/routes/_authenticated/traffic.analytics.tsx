import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/traffic/analytics")({
  component: () => (
    <ComingSoon
      icon={BarChart3}
      title="Analytics de Tráfego Pago"
      description="Relatórios de performance, CPA, ROAS e comparativos."
    />
  ),
});
