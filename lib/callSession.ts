import {
  countAgentMessages,
  MAX_AGENT_MESSAGES,
  type CallEnding,
  type ChatMessage,
  type CustomerTurn,
  type Mood,
  type Outcome,
} from "./schemas";

// Client-side state of one simulated call. Pure reducer: timestamps and messages
// are built by event handlers so rendering stays free of Date.now().

export type CallPhase = "connecting" | "active" | "ended";

/** Coaching analysis of the finished call (POST /api/evaluate). */
export type AnalysisState = { status: "idle" } | { status: "loading" } | { status: "error"; error: string } | { status: "done" };

export interface CallState {
  phase: CallPhase;
  messages: ChatMessage[];
  mood: Mood;
  moodReason: string | null;
  hiddenIssueRevealed: boolean;
  /** Waiting for the customer's reply. */
  pending: boolean;
  error: string | null;
  startedAt: number | null;
  endedAt: number | null;
  outcome: Outcome | null;
  analysis: AnalysisState;
}

export type CallAction =
  | { type: "connected"; openingLine: string; now: number }
  | { type: "agentSent"; message: ChatMessage }
  | { type: "customerReplied"; reply: ChatMessage; turn: CustomerTurn }
  | { type: "requestFailed"; error: string }
  | { type: "retried" }
  | { type: "endedByAgent"; now: number }
  | { type: "analysisStarted" }
  | { type: "analysisFailed"; error: string }
  | { type: "analysisSucceeded" };

export function createInitialCallState(startMood: Mood): CallState {
  return {
    phase: "connecting",
    messages: [],
    mood: startMood,
    moodReason: null,
    hiddenIssueRevealed: false,
    pending: false,
    error: null,
    startedAt: null,
    endedAt: null,
    outcome: null,
    analysis: { status: "idle" },
  };
}

/** The trainee can type only when the call is live and the customer is not answering. */
export function canAgentSend(state: CallState): boolean {
  return state.phase === "active" && !state.pending && state.error === null;
}

/** How the call ends after a customer reply, or null if it goes on. */
export function outcomeAfterReply(messages: readonly ChatMessage[], callEnding: CallEnding): Outcome | null {
  if (callEnding !== "none") return callEnding;
  return countAgentMessages(messages) >= MAX_AGENT_MESSAGES ? "max_turns" : null;
}

export function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case "connected": {
      if (state.phase !== "connecting") return state;
      const opening: ChatMessage = { role: "customer", text: action.openingLine, mood: state.mood, ts: action.now };
      return { ...state, phase: "active", startedAt: action.now, messages: [opening] };
    }
    case "agentSent":
      if (!canAgentSend(state)) return state;
      return { ...state, messages: [...state.messages, action.message], pending: true };
    case "customerReplied": {
      if (state.phase !== "active" || !state.pending) return state;
      const messages = [...state.messages, action.reply];
      const outcome = outcomeAfterReply(messages, action.turn.callEnding);
      return {
        ...state,
        messages,
        mood: action.turn.mood,
        moodReason: action.turn.moodReason,
        hiddenIssueRevealed: state.hiddenIssueRevealed || action.turn.hiddenIssueRevealed,
        pending: false,
        ...(outcome ? { phase: "ended", outcome, endedAt: action.reply.ts } : {}),
      };
    }
    case "requestFailed":
      if (state.phase !== "active") return state;
      return { ...state, pending: false, error: action.error };
    case "retried":
      if (state.phase !== "active" || state.error === null) return state;
      return { ...state, pending: true, error: null };
    case "endedByAgent":
      if (state.phase !== "active") return state;
      return { ...state, phase: "ended", outcome: "ended_by_agent", endedAt: action.now, pending: false, error: null };
    case "analysisStarted":
      return state.phase === "ended" ? { ...state, analysis: { status: "loading" } } : state;
    case "analysisFailed":
      return state.phase === "ended" ? { ...state, analysis: { status: "error", error: action.error } } : state;
    case "analysisSucceeded":
      return state.phase === "ended" ? { ...state, analysis: { status: "done" } } : state;
  }
}
