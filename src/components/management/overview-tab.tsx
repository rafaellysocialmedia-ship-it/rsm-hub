import { useQuery } from "@tanstack/react-query";
import { Building2, Calendar, CalendarClock, Tag, User, Users2, Video } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/clients";
import { formatDate, formatDateTime } from "@/lib/client-master";
import { useStaffMembers } from "@/hooks/use-staff";

import { StatusBadge } from "@/components/clients/status-badge";
import { InfoRow, SectionCard } from "./master-shared";

export function OverviewTab({ client }: { client: Client }) {
  const { data: staff = [] } = useStaffMembers();
  const nameOf = (id: string | null | undefined) => {
    if (!id) return null;
    const m = staff.find((s) => s.id === id);
    return m?.name || m?.email || null;
  };

  const { data: nextMeeting } = useQuery({
    queryKey: ["client-next-meeting", client.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, meeting_date, meeting_time")
        .eq("client_id", client.id)
        .gte("meeting_date", today)
        .order("meeting_date", { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const c = client as Client & {
    trade_name?: string | null;
    account_manager_id?: string | null;
    social_manager_id?: string | null;
    traffic_manager_id?: string | null;
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard title="Resumo executivo" description="Visão rápida do cadastro mestre" collapsible>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoRow icon={User} label="Cliente" value={client.name} />
          <InfoRow icon={Building2} label="Empresa" value={c.trade_name || client.legal_name} />
          <InfoRow icon={Calendar} label="Data de início" value={formatDate(client.start_date)} />
          <InfoRow label="Status" value={<StatusBadge status={client.status} />} icon={Tag} />
          <InfoRow icon={Tag} label="Plano contratado" value={client.plan} />
          <InfoRow
            icon={CalendarClock}
            label="Última atualização"
            value={formatDateTime(client.updated_at)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Responsáveis" description="Time interno à frente da conta" collapsible>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoRow icon={Users2} label="Atendimento" value={nameOf(c.account_manager_id)} />
          <InfoRow icon={Users2} label="Social Media" value={nameOf(c.social_manager_id)} />
          <InfoRow icon={Users2} label="Tráfego" value={nameOf(c.traffic_manager_id)} />
          <InfoRow icon={User} label="Contato do cliente" value={client.responsible} />
        </div>
      </SectionCard>

      <SectionCard title="Próxima reunião" className="lg:col-span-2">
        {nextMeeting ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
              <Video className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{nextMeeting.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(nextMeeting.meeting_date)}
                {nextMeeting.meeting_time ? ` · ${nextMeeting.meeting_time.slice(0, 5)}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma reunião agendada.</p>
        )}
      </SectionCard>
    </div>
  );
}
