import * as XLSX from "xlsx";
import { statusMeta, postNetworks, type Post } from "@/lib/posts";

export function exportCalendarXlsx(
  posts: Post[],
  clientMap: Map<string, string>,
  filename: string,
) {
  const rows = [...posts]
    .sort((a, b) => {
      const da = a.scheduled_date ?? "";
      const db = b.scheduled_date ?? "";
      if (da !== db) return da.localeCompare(db);
      return (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "");
    })
    .map((p) => ({
      Título: p.title ?? "",
      Cliente: p.client_id ? clientMap.get(p.client_id) ?? "" : "",
      Data: p.scheduled_date ?? "",
      Hora: p.scheduled_time ? p.scheduled_time.slice(0, 5) : "",
      Redes: postNetworks(p).join(", "),
      Status: statusMeta(p.status).label,
      Formato: p.format ?? "",
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 40 }, { wch: 24 }, { wch: 12 }, { wch: 8 },
    { wch: 28 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Calendário");
  const safe = filename.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").trim() || "calendario";
  XLSX.writeFile(wb, `${safe}.xlsx`);
}
