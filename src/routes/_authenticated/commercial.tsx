import { createFileRoute } from "@tanstack/react-router";
import { CommercialWorkspace } from "@/components/commercial/commercial-workspace";
export const Route = createFileRoute("/_authenticated/commercial")({
  head: () => ({ meta: [{ title: "Comercial · RSM" }] }),
  component: () => (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <CommercialWorkspace />
    </div>
  ),
});
