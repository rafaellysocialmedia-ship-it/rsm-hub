import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/integrations/instagram/start")({
  server: { handlers: { POST: async ({ request }) => {
    const { startInstagram } = await import("@/lib/instagram-handlers.server");
    return startInstagram(request);
  } } },
});
