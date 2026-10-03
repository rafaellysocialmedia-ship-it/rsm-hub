/** Operational screens only show active clients without churn. */
export function isActiveClient(client: { status: string; churned?: boolean }) {
  return client.status === "active" && !client.churned;
}

/** Keep internal items without a client; hide work linked to inactive clients. */
export function belongsToActiveClient(item: { client_id: string | null }, activeIds: ReadonlySet<string>) {
  return item.client_id === null || activeIds.has(item.client_id);
}
