"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-4 py-16">
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="mt-3 text-muted">La page n&apos;a pas pu s&apos;afficher. Réessaie dans un instant.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-foreground hover:bg-accent-hover"
      >
        Réessayer
      </button>
    </main>
  );
}
