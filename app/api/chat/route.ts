import { ApiError } from "@google/genai";

import { jsonError, parseJsonBody } from "@/lib/apiRequest";
import { countTrailingFuriousReplies, finalizeCustomerTurn } from "@/lib/customerTurn";
import { describeError, GeminiConfigError, generateStructured } from "@/lib/gemini";
import { buildCustomerSystemPrompt, buildCustomerTurnPrompt } from "@/lib/prompts";
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getScenario } from "@/lib/scenarios";
import { ChatRequestSchema, countAgentMessages, CustomerTurnModelSchema } from "@/lib/schemas";

// Two Gemini attempts of up to 15 s each must fit in the function time limit.
export const maxDuration = 60;

const MAX_BODY_CHARS = 100_000;

/** One customer turn: answers the last agent message of the transcript. */
export async function POST(request: Request): Promise<Response> {
  const limited = rateLimit("chat", clientKey(request));
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec, "de messages");

  const body = await parseJsonBody(request, ChatRequestSchema, MAX_BODY_CHARS);
  if (!body.ok) return body.response;

  const { scenarioId, difficulty, transcript, currentMood } = body.data;
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return jsonError(404, "Scénario introuvable.");
  }

  const trailingFuriousReplies = countTrailingFuriousReplies(transcript);

  try {
    const turn = await generateStructured({
      label: "chat",
      systemInstruction: buildCustomerSystemPrompt(scenario, difficulty, currentMood),
      prompt: buildCustomerTurnPrompt({
        transcript,
        currentMood,
        trailingFuriousReplies,
        agentMessageCount: countAgentMessages(transcript),
      }),
      schema: CustomerTurnModelSchema,
      signal: request.signal,
    });
    return Response.json(finalizeCustomerTurn(turn, { currentMood, trailingFuriousReplies }));
  } catch (error) {
    console.error("[api/chat] customer turn failed:", describeError(error));
    if (error instanceof GeminiConfigError) {
      return jsonError(500, "Le simulateur n'est pas configuré : la clé API Gemini est manquante côté serveur.");
    }
    if (error instanceof ApiError && error.status === 429) {
      return jsonError(429, "Le simulateur est très sollicité en ce moment. Réessaie dans quelques instants.");
    }
    return jsonError(502, "Le client n'a pas pu répondre. Réessaie.");
  }
}
