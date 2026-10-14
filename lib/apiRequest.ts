import type { z } from "zod";

/** Error body returned by the API routes; the message is in French and shown to the trainee. */
export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Reads a JSON body and validates it with zod; on failure, returns the 413 or 400 response to send. */
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>, maxChars: number): Promise<ParsedBody<T>> {
  const raw = await request.text();
  if (raw.length > maxChars) {
    return { ok: false, response: jsonError(413, "Requête trop volumineuse.") };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, response: jsonError(400, "Requête invalide.") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: jsonError(400, parsed.error.issues[0]?.message ?? "Requête invalide.") };
  }
  return { ok: true, data: parsed.data };
}
