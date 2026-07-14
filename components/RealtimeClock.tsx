"use client";

import { useEffect, useRef, useState } from "react";

export default function RealtimeClock({
  onTick,
  className,
}: {
  onTick?: (now: Date) => void;
  className?: string;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);
      onTickRef.current?.(current);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {now
        ? now.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : "--:--:--"}
    </span>
  );
}
