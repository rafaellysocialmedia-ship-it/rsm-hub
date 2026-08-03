import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/marketplace/")({
  component: () => (
    <ComingSoon
      icon={Store}
      title="Marketplace de Serviços"
      description="Contratação de serviços extras e parceiros."
    />
  ),
});
