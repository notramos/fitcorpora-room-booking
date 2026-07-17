const SIZES = {
  sm: "gap-1.5 px-2.5 py-1 text-xs",
  lg: "gap-2 px-4 py-2 text-base sm:text-lg",
} as const;

const DOT_SIZES = {
  sm: "h-1.5 w-1.5",
  lg: "h-2.5 w-2.5",
} as const;

// Monochrome room status: solid = in use, outline = available. Shared across
// the dashboard cards, the room detail page, and the tablet display.
export default function StatusBadge({
  inUse,
  size = "sm",
}: {
  inUse: boolean;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ${
        SIZES[size]
      } ${
        inUse
          ? "bg-primary text-primary-foreground"
          : "border bg-background text-muted-foreground"
      }`}
    >
      <span
        className={`rounded-full ${DOT_SIZES[size]} ${
          inUse ? "bg-primary-foreground" : "bg-foreground/50"
        }`}
      />
      {inUse ? "Sedang Dipakai" : "Tersedia"}
    </span>
  );
}
