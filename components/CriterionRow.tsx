import { CRITERION_HINTS, CRITERION_LABELS } from "@/lib/labels";
import { SCORES, type Evaluation } from "@/lib/schemas";
import { CRITERION_WEIGHTS } from "@/lib/scoring";

type Criterion = Evaluation["criteria"][number];

/** One grid criterion: 1–5 score bar, coaching comment and verified verbatim quotes. */
export function CriterionRow({ criterion }: { criterion: Criterion }) {
  const { id, score, comment, evidence } = criterion;

  return (
    <li className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">
            {CRITERION_LABELS[id]}
            <span className="ml-2 text-xs font-normal text-muted">{CRITERION_WEIGHTS[id]} % du score</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted">{CRITERION_HINTS[id]}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {SCORES.map((level) => (
              <span key={level} className={`h-2.5 w-6 rounded-full ${level <= score ? "bg-accent" : "bg-surface-muted"}`} />
            ))}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            <span className="sr-only">Note : </span>
            {score}/5
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed">{comment}</p>

      {evidence.length > 0 && (
        <ul className="mt-3 space-y-2">
          {evidence.map((item) => (
            <li key={`${item.turnIndex}-${item.quote}`}>
              <figure className="rounded-r-lg border-l-4 border-accent/50 bg-surface-muted/70 px-3 py-2">
                <blockquote className="text-sm italic leading-relaxed">« {item.quote} »</blockquote>
                <figcaption className="mt-1 text-xs font-medium text-muted">Message {item.turnIndex + 1}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
