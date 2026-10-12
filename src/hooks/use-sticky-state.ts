import { useEffect, useState, type SetStateAction } from "react";

/** Session preferences are scoped by the caller; never carry values across keys. */
export function useStickyState<T>(key: string, initial: T) {
  const [state, setState] = useState<{ key: string; value: T; loaded: boolean }>({
    key,
    value: initial,
    loaded: false,
  });
  useEffect(() => {
    let value = initial;
    try {
      const raw = sessionStorage.getItem(`sticky:${key}`);
      if (raw !== null) value = JSON.parse(raw) as T;
    } catch {
      /* Storage may be unavailable. */
    }
    setState({ key, value, loaded: true });
  }, [key]);
  useEffect(() => {
    if (!state.loaded || state.key !== key) return;
    try {
      sessionStorage.setItem(`sticky:${key}`, JSON.stringify(state.value));
    } catch {
      /* Keep in-memory state. */
    }
  }, [key, state]);
  const setValue = (next: SetStateAction<T>) =>
    setState((old) => ({
      key,
      loaded: true,
      value:
        typeof next === "function"
          ? (next as (value: T) => T)(old.key === key ? old.value : initial)
          : next,
    }));
  return [state.key === key ? state.value : initial, setValue] as const;
}
