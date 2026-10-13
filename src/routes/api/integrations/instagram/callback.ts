import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/integrations/instagram/callback")({
  server: { handlers: { GET: async ({ request }) => {
    const { callbackInstagram } = await import("@/lib/instagram-handlers.server");
    return callbackInstagram(request);
  } } },
});
