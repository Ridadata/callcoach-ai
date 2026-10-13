import { MOODS, type ChatMessage, type CustomerTurn, type CustomerTurnModel, type Mood } from "./schemas";

// Rules applied in code on top of the model's answer, so the simulation
// stays consistent even when the model drifts from its instructions.

/** Clamps a model mood to currentMood ± 1 and onto the -2..+2 scale. */
export function clampMood(value: number, currentMood: Mood): Mood {
  const lower = Math.max(-2, currentMood - 1);
  const upper = Math.min(2, currentMood + 1);
  const clamped = Math.min(upper, Math.max(lower, Math.round(value)));
  return MOODS.find((mood) => mood === clamped) ?? currentMood;
}

/** Customer replies at -2 in a row, counted back from the latest one. The opening line does not count. */
export function countTrailingFuriousReplies(transcript: readonly ChatMessage[]): number {
  let count = 0;
  for (let index = transcript.length - 1; index >= 1; index--) {
    const message = transcript[index];
    if (message.role !== "customer") continue;
    if (message.mood !== -2) break;
    count++;
  }
  return count;
}

export function finalizeCustomerTurn(
  turn: CustomerTurnModel,
  { currentMood, trailingFuriousReplies }: { currentMood: Mood; trailingFuriousReplies: number },
): CustomerTurn {
  const mood = clampMood(turn.mood, currentMood);
  // Second reply in a row at -2: the customer hangs up even if the model forgot to.
  // A model-initiated "hang_up" or "resolved" is kept: its reply already ends the call.
  const callEnding = turn.callEnding === "none" && mood === -2 && trailingFuriousReplies >= 1 ? "hang_up" : turn.callEnding;
  return {
    moodReason: turn.moodReason,
    mood,
    hiddenIssueRevealed: turn.hiddenIssueRevealed,
    callEnding,
    reply: turn.reply,
  };
}
