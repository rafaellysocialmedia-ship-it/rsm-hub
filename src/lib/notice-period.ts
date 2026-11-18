/**
 * Aviso prévio do churn do cliente.
 *
 * Fica guardado na primeira linha das observações do churn, num formato fixo
 * que o sistema lê de volta. Assim não depende de novas colunas no banco.
 */
export type NoticeMode = "serve" | "waived" | "none";

export type NoticePeriod =
  | { mode: "serve"; amount: number; until: string | null }
  | { mode: "waived" }
  | { mode: "none" };

const PREFIX = "Aviso prévio:";

export function parseNotice(notes: string | null | undefined): NoticePeriod {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(PREFIX));
  if (!line) return { mode: "none" };
  if (/^Aviso prévio: dispensado/.test(line)) return { mode: "waived" };
  const amount = /Valor: R\$ ?([\d.]+)/.exec(line)?.[1];
  const until = /Até: (\d{4}-\d{2}-\d{2})/.exec(line)?.[1] ?? null;
  return { mode: "serve", amount: amount ? Number(amount) : 0, until };
}

/** Notes typed by the team, without the notice line. */
export function stripNotice(notes: string | null | undefined): string {
  return (notes ?? "")
    .split("\n")
    .filter((l) => !l.startsWith(PREFIX))
    .join("\n")
    .trim();
}

export function withNotice(notes: string | null | undefined, notice: NoticePeriod): string {
  const rest = stripNotice(notes);
  const line =
    notice.mode === "waived"
      ? `${PREFIX} dispensado`
      : notice.mode === "serve"
        ? `${PREFIX} a cumprir · Valor: R$ ${notice.amount.toFixed(2)}${notice.until ? ` · Até: ${notice.until}` : ""}`
        : "";
  return [line, rest].filter(Boolean).join("\n");
}

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const dateBR = (iso: string) => iso.split("-").reverse().join("/");

/** Short text used in summaries, e.g. "Aviso prévio de R$ 800,00 até 17/12/2026". */
export function noticeLabel(notice: NoticePeriod): string | null {
  if (notice.mode === "waived") return "Aviso prévio dispensado";
  if (notice.mode === "serve")
    return `Aviso prévio de ${money(notice.amount)}${notice.until ? ` até ${dateBR(notice.until)}` : ""}`;
  return null;
}
