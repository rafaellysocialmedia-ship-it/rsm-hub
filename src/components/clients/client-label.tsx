const tones = [
  "bg-violet-100 text-violet-900",
  "bg-sky-100 text-sky-900",
  "bg-amber-100 text-amber-900",
  "bg-rose-100 text-rose-900",
  "bg-indigo-100 text-indigo-900",
  "bg-fuchsia-100 text-fuchsia-900",
];

/** Use dark readable text on bright customized label colors. */
function contrastText(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = channels.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722 > 0.179
    ? "#171717"
    : "#ffffff";
}

export function ClientLabel({ id, name, color }: { id: string; name: string; color?: string | null }) {
  const index = [...id].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0) % tones.length;
  const custom = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
  return (
    <span
      title={name}
      draggable={false}
      className={`pointer-events-none inline-block max-w-full truncate rounded px-2 py-0.5 text-[11px] font-medium ${custom ? "" : tones[index]}`}
      style={custom ? { backgroundColor: custom, color: contrastText(custom) } : undefined}
    >
      {name}
    </span>
  );
}
