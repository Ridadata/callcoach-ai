import type { PublicScenario } from "@/lib/scenarios";

interface ScenarioCardProps {
  scenario: PublicScenario;
  name: string;
  checked: boolean;
  onSelect: () => void;
}

/** A selectable scenario, rendered as a radio input so the group is keyboard accessible. */
export function ScenarioCard({ scenario, name, checked, onSelect }: ScenarioCardProps) {
  return (
    <label
      className={`relative flex h-full cursor-pointer flex-col rounded-2xl border bg-surface p-5 shadow-sm transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring ${
        checked ? "border-accent ring-2 ring-accent" : "border-border hover:border-accent/50"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={scenario.id}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
          {scenario.category}
        </span>
        <span
          aria-hidden="true"
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            checked ? "border-accent bg-accent text-accent-foreground" : "border-border"
          }`}
        >
          {checked && (
            <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
      <span className="mt-4 text-lg font-semibold leading-snug">{scenario.title}</span>
      <span className="mt-2 flex-1 text-sm leading-relaxed text-muted">{scenario.summary}</span>
      <span className="mt-4 border-t border-border pt-3 text-sm">
        <span className="text-muted">Client : </span>
        <span className="font-medium">
          {scenario.persona.name} · {scenario.persona.city}
        </span>
      </span>
    </label>
  );
}
