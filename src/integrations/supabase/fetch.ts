const SUPABASE_REQUEST_TIMEOUT_MS = 12_000;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * Keeps Supabase calls from leaving the interface in an infinite loading state
 * when the external project is paused, unavailable, or incorrectly configured.
 */
export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);

    const controller = new AbortController();
    const sourceSignal =
      init?.signal ??
      (typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined);
    const forwardAbort = () => controller.abort(sourceSignal?.reason);

    if (sourceSignal?.aborted) {
      forwardAbort();
    } else {
      sourceSignal?.addEventListener("abort", forwardAbort, { once: true });
    }

    const timeout = setTimeout(
      () => controller.abort(new Error("Tempo limite de conexão com o banco excedido")),
      SUPABASE_REQUEST_TIMEOUT_MS,
    );

    try {
      return await fetch(input, { ...init, headers, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      sourceSignal?.removeEventListener("abort", forwardAbort);
    }
  };
}
