"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { ScenarioCard } from "@/components/ScenarioCard";
import { DIFFICULTY_HINTS, DIFFICULTY_LABELS } from "@/lib/labels";
import type { PublicScenario } from "@/lib/scenarios";
import { DIFFICULTIES, type Difficulty } from "@/lib/schemas";
import { saveTraineeName } from "@/lib/trainee";

const MAX_NAME_CHARS = 40;

interface FormErrors {
  name?: string;
  scenario?: string;
}

export function StartForm({ scenarios }: { scenarios: PublicScenario[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isStarting, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const scenarioGroupRef = useRef<HTMLFieldSetElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const traineeName = name.trim();
    const nextErrors: FormErrors = {
      name: traineeName ? undefined : "Indique ton prénom pour commencer.",
      scenario: scenarioId ? undefined : "Choisis un scénario.",
    };
    setErrors(nextErrors);

    if (!traineeName) {
      nameRef.current?.focus();
      return;
    }
    if (!scenarioId) {
      scenarioGroupRef.current?.querySelector("input")?.focus();
      return;
    }

    saveTraineeName(traineeName);
    startTransition(() => {
      router.push(`/simulation/${scenarioId}?difficulty=${difficulty}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-10">
      <div className="max-w-sm">
        <label htmlFor="trainee-name" className="block text-sm font-semibold">
          Ton prénom
        </label>
        <input
          ref={nameRef}
          id="trainee-name"
          type="text"
          autoComplete="given-name"
          maxLength={MAX_NAME_CHARS}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
          }}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "trainee-name-error" : undefined}
          placeholder="Ex. : Yasmine"
          className="mt-2 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-base shadow-sm placeholder:text-muted/70 aria-invalid:border-danger"
        />
        {errors.name && (
          <p id="trainee-name-error" className="mt-2 text-sm font-medium text-danger">
            {errors.name}
          </p>
        )}
      </div>

      <fieldset
        ref={scenarioGroupRef}
        aria-describedby={errors.scenario ? "scenario-error" : undefined}
      >
        <legend className="text-sm font-semibold">Choisis un scénario</legend>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              name="scenario"
              checked={scenarioId === scenario.id}
              onSelect={() => {
                setScenarioId(scenario.id);
                setErrors((current) => ({ ...current, scenario: undefined }));
              }}
            />
          ))}
        </div>
        {errors.scenario && (
          <p id="scenario-error" className="mt-3 text-sm font-medium text-danger">
            {errors.scenario}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Niveau de difficulté</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {DIFFICULTIES.map((level) => {
            const checked = difficulty === level;
            return (
              <label
                key={level}
                className={`flex cursor-pointer flex-col rounded-xl border bg-surface px-4 py-3 shadow-sm transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring ${
                  checked ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-border hover:border-accent/50"
                }`}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={level}
                  checked={checked}
                  onChange={() => setDifficulty(level)}
                  className="sr-only"
                />
                <span className={`font-semibold ${checked ? "text-accent" : ""}`}>{DIFFICULTY_LABELS[level]}</span>
                <span className="text-sm text-muted">{DIFFICULTY_HINTS[level]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={isStarting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path
              d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isStarting ? "Connexion…" : "Démarrer l'appel"}
        </button>
      </div>
    </form>
  );
}
