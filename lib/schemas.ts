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

/** POST /api/chat body. The transcript must alternate customer/agent and end with the agent. */
export const ChatRequestSchema = z
  .object({
    scenarioId: z.string().min(1).max(64),
    difficulty: DifficultySchema,
    transcript: z.array(ChatMessageSchema).min(2).max(MAX_TRANSCRIPT_MESSAGES),
    currentMood: MoodSchema,
  })
  .superRefine(({ transcript, currentMood }, ctx) => {
    transcript.forEach((message, index) => {
      const expectedRole = index % 2 === 0 ? "customer" : "agent";
      if (message.role !== expectedRole) {
        ctx.addIssue({
          code: "custom",
          path: ["transcript", index, "role"],
          message: "Le client et le conseiller doivent parler à tour de rôle, en commençant par le client.",
        });
      }
    });
    if (transcript.at(-1)?.role !== "agent") {
      ctx.addIssue({
        code: "custom",
        path: ["transcript"],
        message: "La transcription doit se terminer par un message du conseiller.",
      });
    }
    if (countAgentMessages(transcript) > MAX_AGENT_MESSAGES) {
      ctx.addIssue({
        code: "custom",
        path: ["transcript"],
        message: `L'appel est limité à ${MAX_AGENT_MESSAGES} messages du conseiller.`,
      });
    }
    if (transcript.findLast((message) => message.role === "customer")?.mood !== currentMood) {
      ctx.addIssue({
        code: "custom",
        path: ["currentMood"],
        message: "currentMood doit correspondre à l'humeur du dernier message du client.",
      });
    }
  });
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

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

/** Error body returned by the API routes (message in French, shown to the trainee). */
export const ApiErrorSchema = z.object({ error: z.string().min(1) });

export function countAgentMessages(transcript: readonly ChatMessage[]): number {
  return transcript.filter((message) => message.role === "agent").length;
}
