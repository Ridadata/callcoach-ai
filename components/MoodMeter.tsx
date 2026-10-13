import { useId } from "react";

import { MOOD_LABELS } from "@/lib/labels";
import { MOODS, type Mood } from "@/lib/schemas";

const MOOD_STYLES: Record<Mood, { segment: string; text: string }> = {
  [-2]: { segment: "bg-red-500", text: "text-red-700 dark:text-red-300" },
  [-1]: { segment: "bg-orange-500", text: "text-orange-700 dark:text-orange-300" },
  0: { segment: "bg-slate-400", text: "text-slate-600 dark:text-slate-300" },
  1: { segment: "bg-sky-500", text: "text-sky-700 dark:text-sky-300" },
  2: { segment: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
};

interface MoodMeterProps {
  mood: Mood;
  /** Why the mood changed after the last agent message; shown as a tooltip. */
  reason: string | null;
}

/** Customer mood gauge. The text label is always shown, so color is never the only signal. */
export function MoodMeter({ mood, reason }: MoodMeterProps) {
  const tooltipId = useId();
  const style = MOOD_STYLES[mood];
  const filled = mood + 3; // 1 segment for "Furieux" … 5 for "Satisfait"

  return (
    <div
      className="group relative inline-flex items-center gap-2 rounded-lg"
      tabIndex={reason ? 0 : undefined}
      aria-describedby={reason ? tooltipId : undefined}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted">Humeur</span>
      <span className="flex gap-1" aria-hidden="true">
        {MOODS.map((level, index) => (
          <span
            key={level}
            className={`h-2.5 w-4 rounded-full transition-colors duration-500 sm:w-5 ${
              index < filled ? style.segment : "bg-surface-muted"
            }`}
          />
        ))}
      </span>
      <span key={mood} aria-hidden="true" className={`animate-mood-pop text-sm font-semibold ${style.text}`}>
        {MOOD_LABELS[mood]}
      </span>
      <span className="sr-only" aria-live="polite">
        Humeur du client : {MOOD_LABELS[mood]}
      </span>
      {reason && (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none invisible absolute left-0 top-full z-20 mt-2 w-64 max-w-[80vw] rounded-lg bg-foreground px-3 py-2 text-xs leading-relaxed text-background opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
        >
          {reason}
        </span>
      )}
    </div>
  );
}
