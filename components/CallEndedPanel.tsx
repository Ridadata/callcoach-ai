import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatDuration } from "@/components/CallTimer";
import { MOOD_LABELS, OUTCOME_DESCRIPTIONS, OUTCOME_LABELS } from "@/lib/labels";
import type { Mood, Outcome } from "@/lib/schemas";

interface CallEndedPanelProps {
  outcome: Outcome;
  durationSec: number;
  finalMood: Mood;
  agentMessages: number;
  onReplay: () => void;
}

const OUTCOME_BADGE: Record<Outcome, string> = {
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  hang_up: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  ended_by_agent: "bg-surface-muted text-foreground",
  max_turns: "bg-surface-muted text-foreground",
};

/** Shown in place of the input once the call is over. */
export function CallEndedPanel({ outcome, durationSec, finalMood, agentMessages, onReplay }: CallEndedPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="call-ended-title" className="border-t border-border bg-surface px-4 pb-5 pt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="call-ended-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
          Appel terminé
        </h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${OUTCOME_BADGE[outcome]}`}>
          {OUTCOME_LABELS[outcome]}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{OUTCOME_DESCRIPTIONS[outcome]}</p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-muted">Durée :</dt>
          <dd className="font-medium tabular-nums">{formatDuration(durationSec)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Humeur finale :</dt>
          <dd className="font-medium">{MOOD_LABELS[finalMood]}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Tes messages :</dt>
          <dd className="font-medium tabular-nums">{agentMessages}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onReplay}
          className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Rejouer ce scénario
        </button>
        <Link
          href="/"
          className="rounded-xl border border-border px-4 py-2.5 text-center font-semibold transition-colors hover:bg-surface-muted"
        >
          Choisir un autre scénario
        </Link>
      </div>
    </section>
  );
}
