import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/integrations/instagram/status")({
  server: { handlers: { GET: async ({ request }) => {
    const { instagramStatus } = await import("@/lib/instagram-handlers.server");
    return instagramStatus(request);
  }, POST: async ({ request }) => {
    const { instagramNetworkDiagnostic } = await import("@/lib/instagram-handlers.server");
    return instagramNetworkDiagnostic(request);
  } } },
});
