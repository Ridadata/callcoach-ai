import type { Evaluation } from "@/lib/schemas";

type WeakestTurn = NonNullable<Evaluation["weakestTurn"]>;

/** The trainee's weakest message next to a better version (stacked on mobile). */
export function RewriteCard({ weakestTurn }: { weakestTurn: WeakestTurn }) {
  const { turnIndex, original, improved, why } = weakestTurn;

  return (
    <section aria-labelledby="rewrite-title" className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 id="rewrite-title" className="text-lg font-semibold">
        Ton message à retravailler
      </h2>
      <p className="text-sm text-muted">Message {turnIndex + 1}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-muted/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ce que tu as écrit</p>
          <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{original}</p>
        </div>
        <div className="rounded-xl border border-accent/40 bg-accent-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Version améliorée</p>
          <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{improved}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed">
        <span className="font-semibold">Pourquoi : </span>
        {why}
      </p>
    </section>
  );
}
