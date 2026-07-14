const SIZES = {
  sm: "gap-1.5 px-2.5 py-1 text-xs",
  lg: "gap-2 px-4 py-2 text-base sm:text-lg",
} as const;

const DOT_SIZES = {
  sm: "h-1.5 w-1.5",
  lg: "h-2.5 w-2.5",
} as const;

// Semantic room status: green = available, red = in use. Shared across the
// dashboard cards, the room detail page, and the tablet display.
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
          ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
          : "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
      }`}
    >
      <span
        className={`rounded-full ${DOT_SIZES[size]} ${
          inUse ? "bg-red-500" : "bg-green-500"
        }`}
      />
      {inUse ? "Sedang Dipakai" : "Tersedia"}
    </span>
  );
}
