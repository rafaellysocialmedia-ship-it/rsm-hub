import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/instagram/diagnose")({
  server: { handlers: { POST: async ({ request }) => {
    const { instagramNetworkDiagnostic } = await import("@/lib/instagram-handlers.server");
    return instagramNetworkDiagnostic(request);
  } } },
});
