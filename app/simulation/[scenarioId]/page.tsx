import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SimulationView } from "@/components/SimulationView";
import { getScenario, SCENARIOS, toPublicScenario, type PublicScenario } from "@/lib/scenarios";
import { DifficultySchema, type Difficulty } from "@/lib/schemas";

export function generateStaticParams() {
  return SCENARIOS.map((scenario) => ({ scenarioId: scenario.id }));
}

export async function generateMetadata({ params }: PageProps<"/simulation/[scenarioId]">): Promise<Metadata> {
  const { scenarioId } = await params;
  const scenario = getScenario(scenarioId);
  return { title: scenario ? `Simulation : ${scenario.title}` : "Scénario introuvable" };
}

function parseDifficulty(value: string | string[] | undefined): Difficulty {
  const parsed = DifficultySchema.safeParse(value);
  return parsed.success ? parsed.data : "normal";
}

export default async function SimulationPage({ params, searchParams }: PageProps<"/simulation/[scenarioId]">) {
  const { scenarioId } = await params;
  const scenario = getScenario(scenarioId);
  if (!scenario) notFound();
  const publicScenario = toPublicScenario(scenario);

  // The difficulty comes from the query string (request-time data), so it streams behind Suspense.
  return (
    <Suspense fallback={<SimulationFallback scenario={publicScenario} />}>
      {searchParams.then(({ difficulty }) => (
        <SimulationView scenario={publicScenario} difficulty={parseDifficulty(difficulty)} />
      ))}
    </Suspense>
  );
}

function SimulationFallback({ scenario }: { scenario: PublicScenario }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col sm:px-4 sm:py-4">
      <div className="flex flex-1 flex-col bg-background sm:rounded-2xl sm:border sm:border-border">
        <div className="border-b border-border bg-surface px-4 py-3">
          <p className="text-xs font-medium text-muted">{scenario.category}</p>
          <p className="mt-2 text-lg font-semibold">{scenario.title}</p>
          <p className="text-sm text-muted">
            {scenario.persona.name}, {scenario.persona.age} ans · {scenario.persona.city}
          </p>
        </div>
        <p role="status" className="flex flex-1 items-center justify-center text-sm text-muted">
          Préparation de l&apos;appel…
        </p>
      </div>
    </div>
  );
}
