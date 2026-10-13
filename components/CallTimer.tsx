import { useEffect, useState } from "react";

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function durationInSeconds(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

interface CallTimerProps {
  startedAt: number | null;
  endedAt: number | null;
}

/** Elapsed call time; ticks every second while the call is live and freezes when it ends. */
export function CallTimer({ startedAt, endedAt }: CallTimerProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (startedAt === null || endedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, endedAt]);

  const seconds = startedAt === null ? 0 : durationInSeconds(startedAt, endedAt ?? Math.max(now ?? startedAt, startedAt));

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
      <svg viewBox="0 0 24 24" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9 2h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">Durée de l&apos;appel : </span>
      {formatDuration(seconds)}
    </span>
  );
}
