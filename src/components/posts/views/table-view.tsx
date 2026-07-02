import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";
import { cn } from "@/lib/utils";

export function TableView({
  posts, clientMap, onOpen,
}: { posts: Post[]; clientMap: Map<string, string>; onOpen: (p: Post) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Título</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Rede</TableHead>
            <TableHead>Formato</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((p) => {
            const meta = statusMeta(p.status);
            return (
              <TableRow key={p.id} onClick={() => onOpen(p)} className="cursor-pointer">
                <TableCell className="pl-4 font-medium">{p.title}</TableCell>
                <TableCell>{p.client_id ? clientMap.get(p.client_id) : "—"}</TableCell>
                <TableCell>{postNetworks(p).join(", ") || "—"}</TableCell>
                <TableCell>{p.format ?? "—"}</TableCell>
                <TableCell>{p.scheduled_date ? format(new Date(p.scheduled_date + "T00:00:00"), "dd MMM yy", { locale: ptBR }) : "—"}</TableCell>
                <TableCell>{p.scheduled_time?.slice(0, 5) ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", meta.tone)}>{meta.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {posts.length === 0 && (
            <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Nenhuma publicação</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
