import type { CriterionId, SessionLog, StoredReport } from "./schemas";

/** The row sent to Google Sheets for a finished call: scores and summary only, no transcript. */
export function toSessionLog(report: StoredReport): SessionLog {
  const { evaluation, overall } = report.result;
  const score = (id: CriterionId) => evaluation.criteria.find((criterion) => criterion.id === id)?.score ?? 1;

  return {
    sessionId: report.sessionId,
    timestamp: new Date(report.createdAt).toISOString(),
    traineeName: report.traineeName.trim() || "Anonyme",
    scenarioId: report.scenario.id,
    difficulty: report.difficulty,
    turns: report.agentMessages,
    durationSec: report.durationSec,
    finalMood: report.finalMood,
    outcome: report.outcome,
    scores: {
      empathie: score("empathie"),
      ecoute: score("ecoute"),
      resolution: score("resolution"),
      professionnalisme: score("professionnalisme"),
    },
    overall,
    hiddenIssueFound: evaluation.hiddenIssueFound,
    summary: evaluation.summary,
  };
}

/** UUID v4 for the session; falls back to getRandomValues where randomUUID is missing (plain-http LAN testing). */
export function newSessionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
