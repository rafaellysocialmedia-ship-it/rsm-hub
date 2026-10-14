import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/integrations/instagram/status")({
  server: { handlers: { GET: async ({ request }) => {
    const { instagramStatus, instagramPublicationStatus } = await import("@/lib/instagram-handlers.server");
    return new URL(request.url).searchParams.has("post_id")
      ? instagramPublicationStatus(request)
      : instagramStatus(request);
  }, POST: async ({ request }) => {
    const { instagramNetworkDiagnostic } = await import("@/lib/instagram-handlers.server");
    return instagramNetworkDiagnostic(request);
  } } },
});
