import { createFileRoute } from "@tanstack/react-router";
import { RetentionWorkspace } from "@/components/retention/retention-workspace";
export const Route = createFileRoute("/_authenticated/retention")({
  head: () => ({ meta: [{ title: "Central de Retenção · RSM" }] }),
  component: () => (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <RetentionWorkspace />
    </div>
  ),
});
