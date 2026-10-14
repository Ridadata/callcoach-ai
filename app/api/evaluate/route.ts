import { ApiError, ThinkingLevel } from "@google/genai";

import { jsonError, parseJsonBody } from "@/lib/apiRequest";
import { verifyEvaluation } from "@/lib/evidence";
import { describeError, GeminiConfigError, generateStructured } from "@/lib/gemini";
import { buildJudgeSystemPrompt, buildJudgeTranscriptPrompt } from "@/lib/prompts";
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getScenario } from "@/lib/scenarios";
import { EvaluateRequestSchema, EvaluationModelSchema, type EvaluateResponse } from "@/lib/schemas";
import { computeOverall } from "@/lib/scoring";

// Two judge attempts of up to 25 s each must fit in the function time limit.
export const maxDuration = 60;

const MAX_BODY_CHARS = 100_000;
const JUDGE_TIMEOUT_MS = 25_000;

/** Judges a finished call. The transcript is used for this request only and never stored. */
export async function POST(request: Request): Promise<Response> {
  const limited = rateLimit("evaluate", clientKey(request));
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec, "d'analyses");

  const body = await parseJsonBody(request, EvaluateRequestSchema, MAX_BODY_CHARS);
  if (!body.ok) return body.response;

  const { scenarioId, transcript, finalMood, outcome } = body.data;
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return jsonError(404, "Scénario introuvable.");
  }

  try {
    const judged = await generateStructured({
      label: "evaluate",
      systemInstruction: buildJudgeSystemPrompt(scenario, outcome, finalMood),
      prompt: buildJudgeTranscriptPrompt(transcript),
      schema: EvaluationModelSchema,
      thinkingLevel: ThinkingLevel.MEDIUM,
      timeoutMs: JUDGE_TIMEOUT_MS,
      signal: request.signal,
    });
    const { evaluation, quoteCheck } = verifyEvaluation(judged, transcript);
    if (quoteCheck.removed > 0) {
      console.info(`[api/evaluate] removed ${quoteCheck.removed} unverifiable quote(s), kept ${quoteCheck.kept}.`);
    }
    const response: EvaluateResponse = { evaluation, overall: computeOverall(evaluation.criteria), quoteCheck };
    return Response.json(response);
  } catch (error) {
    console.error("[api/evaluate] evaluation failed:", describeError(error));
    if (error instanceof GeminiConfigError) {
      return jsonError(500, "L'analyse n'est pas configurée : la clé API Gemini est manquante côté serveur.");
    }
    if (error instanceof ApiError && error.status === 429) {
      return jsonError(429, "Le service d'analyse est très sollicité en ce moment. Réessaie dans quelques instants.");
    }
    return jsonError(502, "L'analyse de l'appel n'a pas pu aboutir. Réessaie.");
  }
}
