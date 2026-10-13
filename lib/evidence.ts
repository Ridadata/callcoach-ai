import type { ChatMessage, Evaluation, EvaluationModel, Evidence, Score } from "./schemas";

// Verbatim-quote check. Every quote the judge attributes to the trainee
// must really appear in one of their messages; otherwise it is dropped. Matching
// ignores case, accents, whitespace and quote/apostrophe styles, and the quote kept is
// the exact slice of the trainee's own text, so the report never shows invented words.
// A real quote attributed to the wrong message is moved to the right turnIndex.

const CHAR_REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "′": "'",
  "`": "'",
  "´": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "«": '"',
  "»": '"',
  "–": "-",
  "—": "-",
  "…": "...",
};

interface NormalizedText {
  text: string;
  /** Index in the original string of each character of `text`. */
  origin: number[];
}

function normalize(input: string): NormalizedText {
  let text = "";
  const origin: number[] = [];
  let pendingSpace = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (/\s/.test(char)) {
      pendingSpace = text.length > 0;
      continue;
    }
    if (pendingSpace) {
      text += " ";
      origin.push(index);
      pendingSpace = false;
    }
    const folded = (CHAR_REPLACEMENTS[char] ?? char).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (const normalized of folded) {
      text += normalized;
      origin.push(index);
    }
  }
  return { text, origin };
}

/** Quote marks, ellipses and end punctuation the model may add around an excerpt. */
const QUOTE_EDGES = /^[\s"'«»“”‘’….,;:!?-]+|[\s"'«»“”‘’….,;:!?-]+$/g;

/** Returns the exact slice of `message` matching `quote`, or null if the quote is not in it. */
export function findVerbatim(quote: string, message: string): string | null {
  const needle = normalize(quote.replace(QUOTE_EDGES, "")).text;
  if (!needle) return null;
  const haystack = normalize(message);
  const start = haystack.text.indexOf(needle);
  if (start === -1) return null;
  const end = start + needle.length - 1;
  return message.slice(haystack.origin[start], haystack.origin[end] + 1);
}

interface Located {
  turnIndex: number;
  quote: string;
}

/** Looks for the quote in the claimed agent message first, then in the other agent messages. */
function locate(quote: string, claimedIndex: number, agentMessages: readonly string[]): Located | null {
  const claimed = agentMessages[claimedIndex];
  const exact = claimed === undefined ? null : findVerbatim(quote, claimed);
  if (exact) return { turnIndex: claimedIndex, quote: exact };
  for (let turnIndex = 0; turnIndex < agentMessages.length; turnIndex++) {
    if (turnIndex === claimedIndex) continue;
    const match = findVerbatim(quote, agentMessages[turnIndex]);
    if (match) return { turnIndex, quote: match };
  }
  return null;
}

const SCORE_VALUES: readonly Score[] = [1, 2, 3, 4, 5];

function toScore(value: number): Score {
  return SCORE_VALUES.find((score) => score === value) ?? 1;
}

export interface QuoteCheck {
  kept: number;
  removed: number;
}

/**
 * Converts the judge's output to the Evaluation format and keeps only
 * quotes that are verbatim excerpts of the trainee's messages (indexed by turnIndex).
 */
export function verifyEvaluation(
  model: EvaluationModel,
  transcript: readonly ChatMessage[],
): { evaluation: Evaluation; quoteCheck: QuoteCheck } {
  const agentMessages = transcript.filter((message) => message.role === "agent").map((message) => message.text);
  const quoteCheck: QuoteCheck = { kept: 0, removed: 0 };

  const criteria = (["empathie", "ecoute", "resolution", "professionnalisme"] as const).map((id) => {
    const criterion = model.criteria[id];
    const evidence: Evidence[] = [];
    for (const item of criterion.evidence) {
      const located = locate(item.quote, item.turnIndex, agentMessages);
      const duplicate = located && evidence.some((e) => e.turnIndex === located.turnIndex && e.quote === located.quote);
      if (located && !duplicate) {
        evidence.push(located);
        quoteCheck.kept++;
      } else {
        quoteCheck.removed++;
      }
    }
    return { id, score: toScore(criterion.score), comment: criterion.comment, evidence };
  });

  // weakestTurn.original is always the trainee's real, full message: the one the judge
  // copied if it can be found, otherwise the message at the judge's turnIndex.
  const { weakestTurn } = model;
  const turnIndex =
    locate(weakestTurn.original, weakestTurn.turnIndex, agentMessages)?.turnIndex ??
    (agentMessages[weakestTurn.turnIndex] !== undefined ? weakestTurn.turnIndex : null);
  const checkedWeakestTurn: Evaluation["weakestTurn"] =
    turnIndex === null ? null : { ...weakestTurn, turnIndex, original: agentMessages[turnIndex] };

  return {
    evaluation: {
      criteria,
      hiddenIssueFound: model.hiddenIssueFound,
      strengths: model.strengths,
      improvements: model.improvements,
      weakestTurn: checkedWeakestTurn,
      summary: model.summary,
    },
    quoteCheck,
  };
}
