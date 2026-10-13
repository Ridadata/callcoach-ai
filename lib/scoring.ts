import type { CriterionId, Evaluation } from "./schemas";

// Overall score: computed in code, never by the model.

/** Weights in percent: empathie 25 %, ecoute 25 %, resolution 30 %, professionnalisme 20 %. */
export const CRITERION_WEIGHTS: Record<CriterionId, number> = {
  empathie: 25,
  ecoute: 25,
  resolution: 30,
  professionnalisme: 20,
};

/** overall = round( Σ weight × (score − 1) / 4 × 100 ), from 0 to 100. Integer maths avoids float drift. */
export function computeOverall(criteria: Evaluation["criteria"]): number {
  const weighted = criteria.reduce((sum, { id, score }) => sum + CRITERION_WEIGHTS[id] * (score - 1), 0);
  return Math.round(weighted / 4);
}
