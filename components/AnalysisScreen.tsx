/** Shown over the conversation while /api/evaluate runs. */
export function AnalysisScreen({ customerName }: { customerName: string }) {
  return (
    <div
      role="status"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center backdrop-blur-sm"
    >
      <span
        aria-hidden="true"
        className="size-10 animate-spin rounded-full border-4 border-accent-soft border-t-accent"
      />
      <p className="text-lg font-semibold">Appel terminé — analyse en cours…</p>
      <p className="max-w-sm text-sm text-muted">
        Ton formateur virtuel relit ton appel avec {customerName} pour préparer ton rapport de coaching.
      </p>
    </div>
  );
}
