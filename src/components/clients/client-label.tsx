const tones = [
  "bg-violet-100 text-violet-900",
  "bg-sky-100 text-sky-900",
  "bg-emerald-100 text-emerald-900",
  "bg-amber-100 text-amber-900",
  "bg-rose-100 text-rose-900",
  "bg-indigo-100 text-indigo-900",
];
export function ClientLabel({ id, name }: { id: string; name: string }) {
  const color = [...id].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0) % tones.length;
  return (
    <span
      title={name}
      draggable={false}
      className={`pointer-events-none inline-block max-w-full truncate rounded px-2 py-0.5 text-[11px] font-medium ${tones[color]}`}
    >
      {name}
    </span>
  );
}
