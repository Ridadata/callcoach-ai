"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import type { z } from "zod";

import { AnalysisScreen } from "@/components/AnalysisScreen";
import { durationInSeconds, CallTimer } from "@/components/CallTimer";
import { CallEndedPanel } from "@/components/CallEndedPanel";
import { ChatWindow } from "@/components/ChatWindow";
import { MessageComposer } from "@/components/MessageComposer";
import { MoodMeter } from "@/components/MoodMeter";
import { callReducer, canAgentSend, createInitialCallState, outcomeAfterReply } from "@/lib/callSession";
import { DIFFICULTY_LABELS } from "@/lib/labels";
import { saveReport, setReportLogStatus } from "@/lib/reportStorage";
import type { PublicScenario } from "@/lib/scenarios";
import {
  ApiErrorSchema,
  countAgentMessages,
  CustomerTurnSchema,
  EvaluateResponseSchema,
  LogResponseSchema,
  MAX_AGENT_MESSAGES,
  type ChatMessage,
  type Difficulty,
  type Mood,
  type Outcome,
  type StoredReport,
} from "@/lib/schemas";
import { newSessionId, toSessionLog } from "@/lib/sessionLog";
import { useTraineeName } from "@/lib/trainee";

/** Delay before the customer picks up and speaks first. */
const CONNECT_DELAY_MS = 800;
const REPLY_ERROR = "Le client n'a pas pu répondre. Réessaie.";
const ANALYSIS_ERROR = "L'analyse de l'appel n'a pas pu aboutir. Réessaie.";
const NETWORK_ERROR = "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.";

interface SimulationViewProps {
  scenario: PublicScenario;
  difficulty: Difficulty;
}

/**
 * Each fresh navigation to this page starts a new call; browser back/forward
 * restores the call in progress (Cache Components keeps routes alive with
 * <Activity>). "Rejouer" bumps `attempt` to remount a clean call.
 */
export function SimulationView({ scenario, difficulty }: SimulationViewProps) {
  const { bfcacheId } = useRouter();
  const [attempt, setAttempt] = useState(0);

  return (
    <CallSession
      key={`${bfcacheId}:${difficulty}:${attempt}`}
      scenario={scenario}
      difficulty={difficulty}
      onReplay={() => setAttempt((current) => current + 1)}
    />
  );
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** POSTs JSON and validates the response with zod; failures come back as French messages. */
async function postJson<T>(url: string, body: unknown, schema: z.ZodType<T>, fallbackError: string): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const apiError = ApiErrorSchema.safeParse(payload);
    return { ok: false, error: apiError.success ? apiError.data.error : fallbackError };
  }
  const parsed = schema.safeParse(payload);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: fallbackError };
}

/** Sends the session summary to Google Sheets in the background and records the result on the report. */
async function logSession(report: StoredReport) {
  const result = await postJson("/api/log", toSessionLog(report), LogResponseSchema, "");
  setReportLogStatus(report.sessionId, result.ok ? (result.data.logged ? "logged" : "disabled") : "failed");
}

interface CallSessionProps extends SimulationViewProps {
  onReplay: () => void;
}

function CallSession({ scenario, difficulty, onReplay }: CallSessionProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(callReducer, scenario.startMood[difficulty], createInitialCallState);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const confirmEndRef = useRef<HTMLButtonElement>(null);
  // Set as soon as the call ends, so a late customer reply cannot reopen it.
  const callEndedRef = useRef(false);
  const traineeName = useTraineeName();

  const agentMessages = countAgentMessages(state.messages);
  const isActive = state.phase === "active";

  // The customer picks up shortly after the page opens and speaks first.
  useEffect(() => {
    if (state.phase !== "connecting") return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "connected", openingLine: scenario.openingLine[difficulty], now: Date.now() });
    }, CONNECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase, scenario, difficulty]);

  useEffect(() => {
    if (confirmingEnd) confirmEndRef.current?.focus();
  }, [confirmingEnd]);

  /** Sends the finished call to the judge once, then opens the report. */
  async function analyzeCall(
    transcript: ChatMessage[],
    finalMood: Mood,
    outcome: Outcome,
    startedAt: number,
    endedAt: number,
  ) {
    if (countAgentMessages(transcript) === 0) return; // nothing to evaluate
    dispatch({ type: "analysisStarted" });
    const result = await postJson(
      "/api/evaluate",
      { scenarioId: scenario.id, difficulty, transcript, finalMood, outcome },
      EvaluateResponseSchema,
      ANALYSIS_ERROR,
    );
    if (!result.ok) {
      dispatch({ type: "analysisFailed", error: result.error });
      return;
    }
    const report: StoredReport = {
      version: 2,
      sessionId: newSessionId(),
      logStatus: "pending",
      scenario: {
        id: scenario.id,
        title: scenario.title,
        category: scenario.category,
        personaName: scenario.persona.name,
        personaCity: scenario.persona.city,
      },
      difficulty,
      traineeName,
      outcome,
      finalMood,
      durationSec: durationInSeconds(startedAt, endedAt),
      agentMessages: countAgentMessages(transcript),
      transcript,
      result: result.data,
      createdAt: endedAt,
    };
    saveReport(report);
    dispatch({ type: "analysisSucceeded" });
    router.push("/rapport");
    void logSession(report);
  }

  function finishCall(transcript: ChatMessage[], finalMood: Mood, outcome: Outcome, endedAt: number) {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    void analyzeCall(transcript, finalMood, outcome, state.startedAt ?? endedAt, endedAt);
  }

  async function requestCustomerTurn(transcript: ChatMessage[], currentMood: Mood) {
    const result = await postJson(
      "/api/chat",
      { scenarioId: scenario.id, difficulty, transcript, currentMood },
      CustomerTurnSchema,
      REPLY_ERROR,
    );
    if (callEndedRef.current) return;
    if (!result.ok) {
      dispatch({ type: "requestFailed", error: result.error });
      return;
    }
    const turn = result.data;
    const reply: ChatMessage = { role: "customer", text: turn.reply, mood: turn.mood, ts: Date.now() };
    dispatch({ type: "customerReplied", reply, turn });
    const messages = [...transcript, reply];
    const outcome = outcomeAfterReply(messages, turn.callEnding);
    if (outcome) finishCall(messages, turn.mood, outcome, reply.ts);
  }

  function handleSend(text: string) {
    if (!canAgentSend(state)) return;
    const message: ChatMessage = { role: "agent", text, ts: Date.now() };
    dispatch({ type: "agentSent", message });
    void requestCustomerTurn([...state.messages, message], state.mood);
  }

  function handleRetry() {
    if (!isActive || state.error === null) return;
    dispatch({ type: "retried" });
    void requestCustomerTurn(state.messages, state.mood);
  }

  function handleEndCall() {
    setConfirmingEnd(false);
    const now = Date.now();
    dispatch({ type: "endedByAgent", now });
    finishCall(state.messages, state.mood, "ended_by_agent", now);
  }

  function handleRetryAnalysis() {
    if (state.analysis.status !== "error" || !state.outcome || state.startedAt === null || state.endedAt === null) return;
    void analyzeCall(state.messages, state.mood, state.outcome, state.startedAt, state.endedAt);
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col sm:px-4 sm:py-4">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background sm:rounded-2xl sm:border sm:border-border sm:shadow-sm">
        {state.analysis.status === "loading" && <AnalysisScreen customerName={scenario.persona.name} />}

        <header className="border-b border-border bg-surface px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <Link href="/" className="rounded font-medium text-muted hover:text-foreground">
              ← Accueil
            </Link>
            <span className="text-xs font-medium text-muted">
              {scenario.category} · {DIFFICULTY_LABELS[difficulty]}
            </span>
          </div>
          <h1 className="mt-2 text-lg font-semibold leading-tight">{scenario.title}</h1>
          <p className="text-sm text-muted">
            {scenario.persona.name}, {scenario.persona.age} ans · {scenario.persona.city}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <MoodMeter mood={state.mood} reason={state.moodReason} />
            <CallTimer startedAt={state.startedAt} endedAt={state.endedAt} />
            <span className="text-sm font-medium tabular-nums">
              Message {Math.min(agentMessages + (isActive ? 1 : 0), MAX_AGENT_MESSAGES)} / {MAX_AGENT_MESSAGES}
            </span>
            {isActive && !confirmingEnd && (
              <button
                type="button"
                onClick={() => setConfirmingEnd(true)}
                className="ml-auto rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
              >
                Terminer l&apos;appel
              </button>
            )}
          </div>

          {isActive && confirmingEnd && (
            <div
              role="group"
              aria-labelledby="confirm-end-label"
              onKeyDown={(event) => {
                if (event.key === "Escape") setConfirmingEnd(false);
              }}
              className="mt-3 flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p id="confirm-end-label" className="text-sm font-medium">
                Terminer l&apos;appel maintenant ?
              </p>
              <div className="flex gap-2">
                <button
                  ref={confirmEndRef}
                  type="button"
                  onClick={handleEndCall}
                  className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white dark:text-background"
                >
                  Oui, terminer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingEnd(false)}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold"
                >
                  Continuer l&apos;appel
                </button>
              </div>
            </div>
          )}

          {process.env.NODE_ENV === "development" && (
            <p className="mt-2 font-mono text-[11px] text-muted">
              dev · problème caché révélé : {state.hiddenIssueRevealed ? "oui" : "non"}
            </p>
          )}
        </header>

        <ChatWindow
          messages={state.messages}
          customerName={scenario.persona.name}
          agentName={traineeName || "Toi"}
          connecting={state.phase === "connecting"}
          pending={state.pending}
          error={state.error}
          onRetry={handleRetry}
        />

        {state.phase === "ended" && state.outcome ? (
          <CallEndedPanel
            outcome={state.outcome}
            durationSec={
              state.startedAt !== null && state.endedAt !== null ? durationInSeconds(state.startedAt, state.endedAt) : 0
            }
            finalMood={state.mood}
            agentMessages={agentMessages}
            analysis={state.analysis}
            onReplay={onReplay}
            onRetryAnalysis={handleRetryAnalysis}
          />
        ) : (
          <MessageComposer disabled={!canAgentSend(state)} onSend={handleSend} />
        )}
      </div>
    </div>
  );
}
