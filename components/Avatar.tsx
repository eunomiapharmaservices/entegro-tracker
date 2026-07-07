import { Resource } from "@/lib/types";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  resource,
  size = 24,
}: {
  resource: Resource | undefined | null;
  size?: number;
}) {
  if (!resource) {
    return (
      <div
        title="Unassigned"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        className="rounded-full border border-dashed border-[#c9c2b2] text-[#a39d8c] flex items-center justify-center shrink-0"
      >
        —
      </div>
    );
  }
  return (
    <div
      title={resource.name}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: resource.color,
      }}
      className="rounded-full text-white font-medium flex items-center justify-center shrink-0 font-display"
    >
      {initials(resource.name)}
    </div>
  );
}
