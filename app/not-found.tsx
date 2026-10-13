import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-4 py-16">
      <p className="text-sm font-semibold text-accent">Erreur 404</p>
      <h1 className="mt-2 text-2xl font-bold">Page introuvable</h1>
      <p className="mt-3 text-muted">Ce scénario ou cette page n&apos;existe pas.</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-foreground hover:bg-accent-hover"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
