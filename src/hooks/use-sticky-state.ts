import { useEffect, useState } from "react";

/**
 * useStickyState — mantém o estado da tela (filtros, busca, visualização)
 * ao navegar entre páginas e voltar, usando sessionStorage.
 * Transparente para o usuário: nada muda visualmente.
 */
export function useStickyState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(`sticky:${key}`);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignora payload inválido */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(`sticky:${key}`, JSON.stringify(value));
    } catch {
      /* storage indisponível */
    }
  }, [key, value, hydrated]);

  return [value, setValue] as const;
}
