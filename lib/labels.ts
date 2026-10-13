import type { CriterionId, Difficulty, Mood, Outcome } from "./schemas";

// French UI labels shared by client components.

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facile: "Facile",
  normal: "Normal",
  difficile: "Difficile",
};

export const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  facile: "Client plutôt conciliant",
  normal: "Client exigeant",
  difficile: "Client à bout de patience",
};

export const MOOD_LABELS: Record<Mood, string> = {
  [-2]: "Furieux",
  [-1]: "Agacé",
  0: "Neutre",
  1: "Rassuré",
  2: "Satisfait",
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  resolved: "Résolu",
  hang_up: "Le client a raccroché",
  ended_by_agent: "Terminé",
  max_turns: "Terminé",
};

export const OUTCOME_DESCRIPTIONS: Record<Outcome, string> = {
  resolved: "Le client est satisfait de la solution proposée.",
  hang_up: "Le client a perdu patience et a mis fin à l'appel.",
  ended_by_agent: "Tu as mis fin à l'appel.",
  max_turns: "La limite de messages de l'appel est atteinte.",
};

export const CRITERION_LABELS: Record<CriterionId, string> = {
  empathie: "Empathie",
  ecoute: "Écoute",
  resolution: "Résolution",
  professionnalisme: "Professionnalisme",
};

export const CRITERION_HINTS: Record<CriterionId, string> = {
  empathie: "Reconnaître l'émotion du client, s'excuser quand c'est justifié.",
  ecoute: "Reformuler, poser des questions ouvertes, découvrir le problème caché.",
  resolution: "Proposer une solution concrète et datée, vérifier qu'elle convient.",
  professionnalisme: "Clarté, politesse, promesses réalistes, conclusion propre.",
};
