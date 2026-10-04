import { createFileRoute } from "@tanstack/react-router";
import { ClientCalendarPage } from "@/components/workspace/client-calendar";

export const Route = createFileRoute("/_authenticated/portal/calendar")({
  head: () => ({
    meta: [
      { title: "Calendário · Área do Cliente" },
      { name: "description", content: "Acompanhe o calendário editorial da sua marca." },
    ],
  }),
  component: ClientCalendarPage,
});
