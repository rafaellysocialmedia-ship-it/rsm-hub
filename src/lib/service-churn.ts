/**
 * Churn de um único serviço do cliente.
 *
 * O encerramento fica registrado nas observações do serviço em uma linha
 * padronizada, para que a data e o motivo possam ser lidos de volta sem
 * depender de novas colunas no banco.
 */
export const SERVICE_CHURN_REASONS = [
  "Questões financeiras",
  "Insatisfação com os resultados",
  "Insatisfação com o atendimento",
  "Mudança de estratégia",
  "Contratou outro fornecedor",
  "Não renovou o serviço",
  "Trocou por outro serviço da RSM",
  "Outro",
] as const;

export type ServiceChurn = { date: string; reason: string; details: string };

const LINE = /^Churn do serviço em (\d{4}-\d{2}-\d{2}) · Motivo: ([^·\n]+?)(?: · Detalhes: (.*))?$/m;

export function parseServiceChurn(notes: string | null | undefined): ServiceChurn | null {
  const match = notes ? LINE.exec(notes) : null;
  if (!match) return null;
  return { date: match[1], reason: match[2].trim(), details: (match[3] ?? "").trim() };
}

/** Notes without any previous churn line. */
export function stripServiceChurn(notes: string | null | undefined): string {
  return (notes ?? "")
    .split("\n")
    .filter((line) => !/^Churn do serviço em \d{4}-\d{2}-\d{2} · Motivo: /.test(line))
    .join("\n")
    .trim();
}

export function withServiceChurn(notes: string | null | undefined, churn: ServiceChurn): string {
  const details = churn.details.replace(/\s+/g, " ").trim();
  const line =
    `Churn do serviço em ${churn.date} · Motivo: ${churn.reason.replace(/·/g, "-")}` +
    (details ? ` · Detalhes: ${details}` : "");
  const rest = stripServiceChurn(notes);
  return rest ? `${line}\n${rest}` : line;
}
