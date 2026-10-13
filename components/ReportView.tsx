"use client";

import Link from "next/link";

import { OUTCOME_BADGE } from "@/components/CallEndedPanel";
import { formatDuration } from "@/components/CallTimer";
import { CriterionRow } from "@/components/CriterionRow";
import { MessageBubble } from "@/components/MessageBubble";
import { RewriteCard } from "@/components/RewriteCard";
import { DIFFICULTY_LABELS, MOOD_LABELS, OUTCOME_LABELS } from "@/lib/labels";
import { useStoredReport } from "@/lib/reportStorage";
import { countAgentMessages, type LogStatus, type StoredReport } from "@/lib/schemas";

const LOG_NOTICES: Record<LogStatus, string> = {
  pending: "Enregistrement du résultat…",
  logged: "Résultat transmis à ton formateur (scores et synthèse uniquement, jamais la conversation).",
  disabled: "Résultat non enregistré (journalisation désactivée)",
  failed: "Résultat non enregistré (journalisation indisponible)",
};

/** Rapport page content, read from the report the simulation stored in sessionStorage. */
export function ReportView() {
  const state = useStoredReport();

  if (state.status === "loading") {
    return (
      <p role="status" className="py-24 text-center text-sm text-muted">
        Chargement du rapport…
      </p>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="py-16">
        <h1 className="text-2xl font-bold">Aucun rapport disponible</h1>
        <p className="mt-3 text-muted">
          Le rapport s&apos;affiche à la fin d&apos;un appel simulé, dans le même onglet. Lance un appel pour en obtenir un.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          Choisir un scénario
        </Link>
      </div>
    );
  }

  return <Report report={state.report} />;
}

function Report({ report }: { report: StoredReport }) {
  const { scenario, result, transcript } = report;
  const { evaluation, overall, quoteCheck } = result;
  const agentName = report.traineeName || "Toi";

  return (
    <article className="space-y-8">
      <header>
        <Link href="/" className="rounded text-sm font-medium text-muted hover:text-foreground">
          ← Accueil
        </Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-accent">Rapport de coaching</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{scenario.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {scenario.category} · Client : {scenario.personaName}, {scenario.personaCity} · {DIFFICULTY_LABELS[report.difficulty]}
          {report.traineeName && <> · Conseiller : {report.traineeName}</>}
        </p>
      </header>

      <section aria-labelledby="score-title" className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="text-center sm:border-r sm:border-border sm:pr-8">
            <h2 id="score-title" className="text-sm font-semibold text-muted">
              Score indicatif
            </h2>
            <p className="mt-1 text-6xl font-bold tabular-nums text-accent">
              {overall}
              <span className="text-2xl font-semibold text-muted">/100</span>
            </p>
            <p className="mt-2 max-w-48 text-xs text-muted sm:mx-auto">Ce score sert à t&apos;entraîner, pas à t&apos;évaluer.</p>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${OUTCOME_BADGE[report.outcome]}`}>
                {OUTCOME_LABELS[report.outcome]}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  evaluation.hiddenIssueFound
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                }`}
              >
                {evaluation.hiddenIssueFound ? "Problème caché découvert" : "Problème caché non découvert"}
              </span>
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted">Durée :</dt>
                <dd className="font-medium tabular-nums">{formatDuration(report.durationSec)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">Tes messages :</dt>
                <dd className="font-medium tabular-nums">{report.agentMessages}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">Humeur finale :</dt>
                <dd className="font-medium">{MOOD_LABELS[report.finalMood]}</dd>
              </div>
            </dl>
            <p className="mt-4 leading-relaxed">{evaluation.summary}</p>
          </div>
        </div>
      </section>

      <p role="status" className="-mt-5 text-xs text-muted">
        {LOG_NOTICES[report.logStatus]}
      </p>

      <section aria-labelledby="criteria-title">
        <h2 id="criteria-title" className="text-lg font-semibold">
          Détail par critère
        </h2>
        <ul className="mt-3 space-y-3">
          {evaluation.criteria.map((criterion) => (
            <CriterionRow key={criterion.id} criterion={criterion} />
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Chaque citation a été vérifiée : elle reprend mot pour mot l&apos;un de tes messages.
          {quoteCheck.removed > 0 &&
            ` ${quoteCheck.removed} citation${quoteCheck.removed > 1 ? "s" : ""} introuvable${quoteCheck.removed > 1 ? "s" : ""} dans tes messages ${quoteCheck.removed > 1 ? "ont été retirées" : "a été retirée"}.`}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="strengths-title" className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 id="strengths-title" className="text-lg font-semibold">
            Points forts
          </h2>
          {evaluation.strengths.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {evaluation.strengths.map((strength) => (
                <li key={strength} className="flex gap-2 text-sm leading-relaxed">
                  <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {strength}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Pas de point fort marquant sur cet appel.</p>
          )}
        </section>
        <section aria-labelledby="improvements-title" className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 id="improvements-title" className="text-lg font-semibold">
            Axes d&apos;amélioration
          </h2>
          <ol className="mt-3 space-y-2">
            {evaluation.improvements.map((improvement, index) => (
              <li key={improvement} className="flex gap-2 text-sm leading-relaxed">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {index + 1}
                </span>
                {improvement}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {evaluation.weakestTurn && <RewriteCard weakestTurn={evaluation.weakestTurn} />}

      <details className="group rounded-2xl border border-border bg-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-5 py-4 font-semibold">
          <svg
            viewBox="0 0 16 16"
            className="size-4 text-muted transition-transform group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 3.5l4.5 4.5L6 12.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Voir la transcription
        </summary>
        <ol className="space-y-4 border-t border-border px-4 py-5">
          {transcript.map((message, index) => (
            <MessageBubble
              key={`${message.ts}-${index}`}
              message={message}
              speaker={message.role === "agent" ? `${agentName} · Message ${countAgentMessages(transcript.slice(0, index + 1))}` : scenario.personaName}
            />
          ))}
        </ol>
      </details>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/simulation/${scenario.id}?difficulty=${report.difficulty}`}
          className="rounded-xl bg-accent px-5 py-3 text-center font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Rejouer ce scénario
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-border bg-surface px-5 py-3 text-center font-semibold transition-colors hover:bg-surface-muted"
        >
          Choisir un autre scénario
        </Link>
      </div>
    </article>
  );
}
