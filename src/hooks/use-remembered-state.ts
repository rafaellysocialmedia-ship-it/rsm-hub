import { useEffect, useState } from "react";

/**
 * Estado lembrado entre visitas (localStorage), por chave.
 * Usado para guardar a última visualização escolhida em cada tamanho de tela.
 */
export function useRememberedState<T>(key: string, initial: T) {
  const [state, setState] = useState<{ key: string; value: T }>({ key, value: initial });
  useEffect(() => {
    let value = initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) value = JSON.parse(raw) as T;
    } catch {
      /* Armazenamento indisponível: fica só na memória. */
    }
    setState({ key, value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (value: T) => {
    setState({ key, value });
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignora */
    }
  };
  return [state.key === key ? state.value : initial, set] as const;
}
