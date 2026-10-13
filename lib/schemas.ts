import { z } from "zod";

// Validation messages may reach the UI, which is in French.
z.config(z.locales.fr());

// Shared zod schemas and types (safe to import from client and server).
// The Gemini response schemas are derived from the *ModelSchema objects below
// (see toGeminiJsonSchema in lib/gemini.ts), so the contract sent to the model
// and the runtime validation of its output can never drift apart.

export const MAX_AGENT_MESSAGE_CHARS = 600;
export const MAX_CUSTOMER_MESSAGE_CHARS = 1000;
export const MAX_TRANSCRIPT_MESSAGES = 30;
export const MAX_AGENT_MESSAGES = 14;

export const DifficultySchema = z.enum(["facile", "normal", "difficile"]);
export type Difficulty = z.infer<typeof DifficultySchema>;
export const DIFFICULTIES = DifficultySchema.options;

// Mood scale: -2 Furieux, -1 Agacé, 0 Neutre, +1 Rassuré, +2 Satisfait
export const MOODS = [-2, -1, 0, 1, 2] as const;
export const MoodSchema = z.literal(MOODS);
export type Mood = z.infer<typeof MoodSchema>;

export const CallEndingSchema = z.enum(["none", "resolved", "hang_up"]);
export type CallEnding = z.infer<typeof CallEndingSchema>;

export const OutcomeSchema = z.enum(["resolved", "hang_up", "ended_by_agent", "max_turns"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const ChatMessageSchema = z
  .object({
    role: z.enum(["customer", "agent"]),
    text: z.string().trim().min(1).max(MAX_CUSTOMER_MESSAGE_CHARS),
    mood: MoodSchema.optional(), // customer messages only
    ts: z.int().nonnegative(),
  })
  .superRefine((message, ctx) => {
    if (message.role === "agent" && message.text.length > MAX_AGENT_MESSAGE_CHARS) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: `Un message du conseiller ne peut pas dépasser ${MAX_AGENT_MESSAGE_CHARS} caractères.`,
      });
    }
    if (message.role === "customer" && message.mood === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["mood"],
        message: "Chaque message du client doit indiquer son humeur.",
      });
    }
  });
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

interface TranscriptIssue {
  path: (string | number)[];
  message: string;
}

/** Structural checks shared by /api/chat and /api/evaluate. */
function transcriptIssues(
  transcript: readonly ChatMessage[],
  { lastMood, moodField, mustEndWithAgent }: { lastMood: Mood; moodField: string; mustEndWithAgent: boolean },
): TranscriptIssue[] {
  const issues: TranscriptIssue[] = [];
  transcript.forEach((message, index) => {
    const expectedRole = index % 2 === 0 ? "customer" : "agent";
    if (message.role !== expectedRole) {
      issues.push({
        path: ["transcript", index, "role"],
        message: "Le client et le conseiller doivent parler à tour de rôle, en commençant par le client.",
      });
    }
  });
  if (mustEndWithAgent && transcript.at(-1)?.role !== "agent") {
    issues.push({ path: ["transcript"], message: "La transcription doit se terminer par un message du conseiller." });
  }
  const agentMessages = countAgentMessages(transcript);
  if (agentMessages === 0) {
    issues.push({ path: ["transcript"], message: "La transcription ne contient aucun message du conseiller." });
  }
  if (agentMessages > MAX_AGENT_MESSAGES) {
    issues.push({ path: ["transcript"], message: `L'appel est limité à ${MAX_AGENT_MESSAGES} messages du conseiller.` });
  }
  if (transcript.findLast((message) => message.role === "customer")?.mood !== lastMood) {
    issues.push({ path: [moodField], message: `${moodField} doit correspondre à l'humeur du dernier message du client.` });
  }
  return issues;
}

/** POST /api/chat body. The transcript must alternate customer/agent and end with the agent. */
export const ChatRequestSchema = z
  .object({
    scenarioId: z.string().min(1).max(64),
    difficulty: DifficultySchema,
    transcript: z.array(ChatMessageSchema).min(2).max(MAX_TRANSCRIPT_MESSAGES),
    currentMood: MoodSchema,
  })
  .superRefine(({ transcript, currentMood }, ctx) => {
    const issues = transcriptIssues(transcript, { lastMood: currentMood, moodField: "currentMood", mustEndWithAgent: true });
    for (const issue of issues) ctx.addIssue({ code: "custom", ...issue });
  });
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** POST /api/evaluate body: the finished call, sent once. */
export const EvaluateRequestSchema = z
  .object({
    scenarioId: z.string().min(1).max(64),
    difficulty: DifficultySchema,
    transcript: z.array(ChatMessageSchema).min(2).max(MAX_TRANSCRIPT_MESSAGES),
    finalMood: MoodSchema,
    outcome: OutcomeSchema,
  })
  .superRefine(({ transcript, finalMood }, ctx) => {
    const issues = transcriptIssues(transcript, { lastMood: finalMood, moodField: "finalMood", mustEndWithAgent: false });
    for (const issue of issues) ctx.addIssue({ code: "custom", ...issue });
  });
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

/**
 * What Gemini must return for one customer turn. Field order is deliberate:
 * the model judges the agent's message and settles its mood, the reveal and
 * the call ending before it writes a reply consistent with them.
 */
export const CustomerTurnModelSchema = z.object({
  moodReason: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe(
      "Une phrase courte et neutre, à la troisième personne, qui décrit ce que le conseiller a fait et explique l'évolution de ton humeur.",
    ),
  mood: z
    .int()
    .min(-2)
    .max(2)
    .describe(
      "Ta nouvelle humeur après le dernier message du conseiller, de -2 (furieux) à +2 (satisfait). Au plus 1 point d'écart avec ton humeur actuelle.",
    ),
  hiddenIssueRevealed: z
    .boolean()
    .describe("true si tu as révélé ton problème caché, dans cette réplique ou une précédente ; sinon false."),
  callEnding: CallEndingSchema.describe(
    '"resolved" si tu es satisfait (+2) et qu\'une solution concrète a été proposée, "hang_up" si tu raccroches, sinon "none".',
  ),
  reply: z
    .string()
    .trim()
    .min(1)
    .max(MAX_CUSTOMER_MESSAGE_CHARS)
    .describe("Ta réplique de client : 1 à 3 phrases courtes (40 mots au plus) en français oral, sans liste, sans markdown, sans émoji."),
});
export type CustomerTurnModel = z.infer<typeof CustomerTurnModelSchema>;

/** What /api/chat returns to the browser: same shape, mood clamped onto the scale. */
export const CustomerTurnSchema = CustomerTurnModelSchema.extend({ mood: MoodSchema });
export type CustomerTurn = z.infer<typeof CustomerTurnSchema>;

// ---------------------------------------------------------------------------
// Evaluation

export const CRITERION_IDS = ["empathie", "ecoute", "resolution", "professionnalisme"] as const;
export const CriterionIdSchema = z.enum(CRITERION_IDS);
export type CriterionId = z.infer<typeof CriterionIdSchema>;

export const SCORES = [1, 2, 3, 4, 5] as const;
export const ScoreSchema = z.literal(SCORES);
export type Score = z.infer<typeof ScoreSchema>;

const JudgeCriterionSchema = z.object({
  evidence: z
    .array(
      z.object({
        turnIndex: z.int().min(0).describe("turnIndex du message du conseiller d'où vient l'extrait."),
        quote: z.string().trim().min(1).max(MAX_AGENT_MESSAGE_CHARS).describe("Extrait copié mot pour mot depuis ce message."),
      }),
    )
    .max(2)
    .describe("1 ou 2 extraits EXACTS des messages du conseiller qui justifient la note ; vide si aucun ne la justifie."),
  comment: z.string().trim().min(1).max(500).describe("1 à 2 phrases en français, en tutoyant le conseiller."),
  score: z.int().min(1).max(5).describe("Note de 1 à 5 selon la grille."),
});

/**
 * What Gemini must return as judge. Criteria are keyed by id so the schema itself
 * guarantees all four are present exactly once; evidence comes before the score
 * so the model grounds its grade first. Converted to EvaluationSchema in lib/evidence.ts.
 */
export const EvaluationModelSchema = z.object({
  hiddenIssueFound: z
    .boolean()
    .describe("true si le client a révélé son problème caché dans la transcription grâce aux questions du conseiller."),
  criteria: z.object({
    empathie: JudgeCriterionSchema,
    ecoute: JudgeCriterionSchema,
    resolution: JudgeCriterionSchema,
    professionnalisme: JudgeCriterionSchema,
  }),
  weakestTurn: z.object({
    turnIndex: z.int().min(0).describe("turnIndex du message du conseiller le plus faible."),
    original: z.string().trim().min(1).max(MAX_AGENT_MESSAGE_CHARS).describe("Ce message, recopié mot pour mot."),
    improved: z.string().trim().min(1).max(800).describe("Une meilleure version de ce message, de longueur comparable."),
    why: z.string().trim().min(1).max(400).describe("Une phrase qui explique pourquoi la nouvelle version est meilleure."),
  }),
  strengths: z
    .array(z.string().trim().min(1).max(300))
    .max(2)
    .describe("Jusqu'à 2 vrais points forts, en tutoyant le conseiller ; liste vide s'il n'y en a aucun."),
  improvements: z
    .array(z.string().trim().min(1).max(300))
    .min(1)
    .max(3)
    .describe("Jusqu'à 3 actions concrètes et applicables au prochain appel."),
  summary: z.string().trim().min(1).max(800).describe("Synthèse de l'appel en 2 à 3 phrases, en tutoyant le conseiller."),
});
export type EvaluationModel = z.infer<typeof EvaluationModelSchema>;

export const EvidenceSchema = z.object({ turnIndex: z.int().min(0), quote: z.string().min(1) });
export type Evidence = z.infer<typeof EvidenceSchema>;

/** Evaluation returned to the browser, after the verbatim-quote check. */
export const EvaluationSchema = z.object({
  criteria: z.array(
    z.object({ id: CriterionIdSchema, score: ScoreSchema, comment: z.string(), evidence: z.array(EvidenceSchema) }),
  ),
  hiddenIssueFound: z.boolean(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  /** null only if the judge pointed at no real agent message (rewrite hidden). */
  weakestTurn: z
    .object({ turnIndex: z.int().min(0), original: z.string(), improved: z.string(), why: z.string() })
    .nullable(),
  summary: z.string(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

/** POST /api/evaluate response. `overall` is computed in code (lib/scoring.ts), never by the model. */
export const EvaluateResponseSchema = z.object({
  evaluation: EvaluationSchema,
  overall: z.int().min(0).max(100),
  quoteCheck: z.object({ kept: z.int().nonnegative(), removed: z.int().nonnegative() }),
});
export type EvaluateResponse = z.infer<typeof EvaluateResponseSchema>;

// ---------------------------------------------------------------------------
// Logging to Google Sheets. Only scores and the summary: never the transcript.

export const SessionLogSchema = z.object({
  sessionId: z.uuid(),
  timestamp: z.iso.datetime(),
  traineeName: z.string().trim().min(1).max(40),
  scenarioId: z.string().min(1).max(64),
  difficulty: DifficultySchema,
  turns: z.int().min(0).max(MAX_AGENT_MESSAGES),
  durationSec: z.int().min(0).max(4 * 3600),
  finalMood: MoodSchema,
  outcome: OutcomeSchema,
  scores: z.object({
    empathie: ScoreSchema,
    ecoute: ScoreSchema,
    resolution: ScoreSchema,
    professionnalisme: ScoreSchema,
  }),
  overall: z.int().min(0).max(100),
  hiddenIssueFound: z.boolean(),
  summary: z.string().trim().min(1).max(800),
});
export type SessionLog = z.infer<typeof SessionLogSchema>;

/** POST /api/log response: `logged` is false when logging is disabled or Apps Script failed. */
export const LogResponseSchema = z.object({ logged: z.boolean() });

export const LogStatusSchema = z.enum(["pending", "logged", "disabled", "failed"]);
export type LogStatus = z.infer<typeof LogStatusSchema>;

/** What the simulation hands to the Rapport page through sessionStorage. */
export const StoredReportSchema = z.object({
  version: z.literal(2),
  sessionId: z.uuid(),
  logStatus: LogStatusSchema,
  scenario: z.object({
    id: z.string(),
    title: z.string(),
    category: z.string(),
    personaName: z.string(),
    personaCity: z.string(),
  }),
  difficulty: DifficultySchema,
  traineeName: z.string(),
  outcome: OutcomeSchema,
  finalMood: MoodSchema,
  durationSec: z.int().nonnegative(),
  agentMessages: z.int().nonnegative(),
  transcript: z.array(ChatMessageSchema),
  result: EvaluateResponseSchema,
  createdAt: z.int().nonnegative(),
});
export type StoredReport = z.infer<typeof StoredReportSchema>;

/** Error body returned by the API routes (message in French, shown to the trainee). */
export const ApiErrorSchema = z.object({ error: z.string().min(1) });

export function countAgentMessages(transcript: readonly ChatMessage[]): number {
  return transcript.filter((message) => message.role === "agent").length;
}
