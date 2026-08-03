import { createFileRoute } from "@tanstack/react-router";
import { Users2 } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/traffic/crm")({
  component: () => (
    <ComingSoon
      icon={Users2}
      title="CRM de Tráfego Pago"
      description="Gestão de leads e oportunidades geradas pelas campanhas."
    />
  ),
});
