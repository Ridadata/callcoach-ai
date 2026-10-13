import { StartForm } from "@/components/StartForm";
import { SCENARIOS, toPublicScenario } from "@/lib/scenarios";

export default function HomePage() {
  const scenarios = SCENARIOS.map(toPublicScenario);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">Simulateur d&apos;appels clients</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">CallCoach AI</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Les conseillers apprennent souvent à gérer les clients difficiles… face à de vrais clients. CallCoach AI leur
          permet de s&apos;entraîner avant, sur des cas réalistes, avec un feedback précis à chaque échange.
        </p>
      </header>

      <StartForm scenarios={scenarios} />

      <p className="mt-12 text-sm text-muted">Scénarios fictifs, aucune donnée client réelle.</p>
    </main>
  );
}
