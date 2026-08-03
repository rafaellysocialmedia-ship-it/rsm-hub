import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/traffic/")({
  component: () => (
    <ComingSoon
      icon={Megaphone}
      title="Dashboard de Tráfego Pago"
      description="Visão geral de campanhas, investimento e resultados."
    />
  ),
});
