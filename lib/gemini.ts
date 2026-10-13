import "server-only";

import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

/**
 * Current stable Flash-Lite model (https://ai.google.dev/gemini-api/docs/models, checked October 2026).
 * In playtests it answered in ~1 s, while gemini-3.8-flash took 3-26 s, hit free-tier
 * quota after a dozen calls and returned 503 "high demand". Override with GEMINI_MODEL.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 800;
const MAX_ATTEMPTS = 2; // first try + one retry

/** The server is missing its Gemini configuration (e.g. no API key). */
export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

/** Gemini kept returning output that is not valid JSON for the expected schema. */
export class GeminiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiOutputError";
  }
}

let cachedClient: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiConfigError("GEMINI_API_KEY is not set.");
  }
  cachedClient ??= new GoogleGenAI({ apiKey });
  return cachedClient;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

// JSON Schema keywords accepted by `responseJsonSchema`
// (see GenerateContentConfig.responseJsonSchema in @google/genai).
const SUPPORTED_SCHEMA_KEYS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

type JsonSchema = { [key: string]: unknown };

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSchema(node: JsonSchema): JsonSchema {
  const result: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) {
    if (!SUPPORTED_SCHEMA_KEYS.has(key)) continue;
    if ((key === "properties" || key === "$defs") && isJsonSchema(value)) {
      result[key] = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, isJsonSchema(child) ? sanitizeSchema(child) : child]),
      );
    } else if ((key === "items" || key === "additionalProperties") && isJsonSchema(value)) {
      result[key] = sanitizeSchema(value);
    } else if ((key === "anyOf" || key === "oneOf" || key === "prefixItems") && Array.isArray(value)) {
      result[key] = value.map((child: unknown) => (isJsonSchema(child) ? sanitizeSchema(child) : child));
    } else {
      result[key] = value;
    }
  }
  // Make Gemini emit fields in schema order (reasoning fields before the reply).
  if (isJsonSchema(result.properties) && !("propertyOrdering" in result)) {
    result.propertyOrdering = Object.keys(result.properties);
  }
  return result;
}

/**
 * Converts a zod schema into the JSON Schema subset Gemini supports, so the zod
 * schema stays the single source of truth for both the prompt contract and validation.
 */
export function toGeminiJsonSchema(schema: z.ZodType): JsonSchema {
  return sanitizeSchema(z.toJSONSchema(schema, { io: "output" }));
}

function parseJson(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Quota errors and invalid requests won't succeed on an immediate retry. */
function isRetryable(error: unknown): boolean {
  if (error instanceof GeminiConfigError) return false;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 408;
  return true; // network errors, timeouts
}

interface StructuredRequest<T> {
  /** Short label used in server logs. */
  label: string;
  systemInstruction: string;
  prompt: string;
  schema: z.ZodType<T>;
  thinkingLevel?: ThinkingLevel;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Aborts the call, e.g. when the browser disconnects (pass request.signal). */
  signal?: AbortSignal;
}

/**
 * Calls Gemini with structured JSON output and validates the result with zod.
 * Retries once on invalid output or transient errors, then throws.
 *
 * No temperature is sent: Gemini 3.6+ models ignore temperature/top_p/top_k and
 * future models reject them with HTTP 400. Thinking level and the schema control behaviour instead.
 */
export async function generateStructured<T>({
  label,
  systemInstruction,
  prompt,
  schema,
  thinkingLevel = ThinkingLevel.LOW,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}: StructuredRequest<T>): Promise<T> {
  const ai = getClient();
  const responseJsonSchema = toGeminiJsonSchema(schema);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: getGeminiModel(),
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema,
          thinkingConfig: { thinkingLevel },
          abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
        },
      });
      const parsed = schema.safeParse(parseJson(response.text));
      if (parsed.success) return parsed.data;
      lastError = new GeminiOutputError(
        `${label}: output did not match the schema (finishReason: ${response.candidates?.[0]?.finishReason ?? "unknown"}).`,
      );
    } catch (error) {
      if (signal?.aborted || !isRetryable(error)) throw error;
      lastError = error;
    }
    console.warn(`[gemini] ${label}: attempt ${attempt}/${MAX_ATTEMPTS} failed:`, describeError(lastError));
    if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  throw lastError instanceof Error ? lastError : new GeminiOutputError(`${label}: no valid output.`);
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return `ApiError ${error.status}: ${error.message}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
