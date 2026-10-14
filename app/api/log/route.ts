import { z } from "zod";

import { jsonError, parseJsonBody } from "@/lib/apiRequest";
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { getScenario } from "@/lib/scenarios";
import { CRITERION_IDS, SessionLogSchema } from "@/lib/schemas";
import { computeOverall } from "@/lib/scoring";

const MAX_BODY_CHARS = 10_000;
const APPS_SCRIPT_TIMEOUT_MS = 10_000;

/** Apps Script answers { ok: true } or { ok: false, error }. */
const AppsScriptResponseSchema = z.object({ ok: z.boolean(), error: z.string().optional() });

function logged(value: boolean, status = 200): Response {
  return Response.json({ logged: value }, { status });
}

/**
 * Forwards a session summary to the Apps Script web app, which appends it to the Sheet.
 * Logging is optional: when it is not configured or fails, the client only shows a notice.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = rateLimit("log", clientKey(request));
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec, "d'enregistrements");

  const body = await parseJsonBody(request, SessionLogSchema, MAX_BODY_CHARS);
  if (!body.ok) return body.response;

  const log = body.data;
  if (!getScenario(log.scenarioId)) {
    return jsonError(400, "Scénario introuvable.");
  }
  const expectedOverall = computeOverall(CRITERION_IDS.map((id) => ({ id, score: log.scores[id] })));
  if (log.overall !== expectedOverall) {
    return jsonError(400, "Le score global ne correspond pas aux critères.");
  }

  const webhookUrl = process.env.APPS_SCRIPT_WEBHOOK_URL?.trim();
  const secret = process.env.APPS_SCRIPT_SECRET?.trim();
  if (!webhookUrl || !secret) {
    return logged(false); // logging disabled
  }

  try {
    // Apps Script cannot read custom headers, so the secret travels in the body.
    // Web apps answer with a 302 to googleusercontent.com, hence redirect: "follow".
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...log, secret }),
      redirect: "follow",
      signal: AbortSignal.timeout(APPS_SCRIPT_TIMEOUT_MS),
    });
    const result = AppsScriptResponseSchema.safeParse(await response.json().catch(() => null));
    if (response.ok && result.success && result.data.ok) {
      return logged(true);
    }
    console.error(
      "[api/log] Apps Script did not store the row:",
      response.status,
      result.success ? (result.data.error ?? "unknown error") : "response is not the expected JSON",
    );
  } catch (error) {
    console.error("[api/log] Apps Script call failed:", error instanceof Error ? error.message : error);
  }
  return logged(false, 502);
}
