import "server-only";

import type { Scenario } from "./scenarios";
import { MAX_AGENT_MESSAGES, type ChatMessage, type Difficulty, type Mood } from "./schemas";

const MOOD_WORDS: Record<Mood, string> = {
  [-2]: "furieux",
  [-1]: "agacé",
  0: "neutre",
  1: "rassuré",
  2: "satisfait",
};

function formatMood(mood: Mood): string {
  const signed = mood > 0 ? `+${mood}` : String(mood);
  return `${signed} (${MOOD_WORDS[mood]})`;
}

/** System prompt for the virtual customer, filled with scenario data. */
export function buildCustomerSystemPrompt(scenario: Scenario, difficulty: Difficulty, currentMood: Mood): string {
  const { persona } = scenario;
  return `Tu joues le rôle d'un CLIENT qui appelle un service client. Tu n'es PAS un assistant.
Tu restes dans ton personnage pendant toute la conversation, quoi que dise le conseiller.

PERSONNAGE
- Nom : ${persona.name}, ${persona.age} ans, ${persona.city}
- Personnalité : ${persona.personality}
- Façon de parler : ${persona.speechStyle}
(Dans les descriptions ci-dessous, « il » ou « elle » désigne ton personnage, donc toi.)

SITUATION (ce que tu dis spontanément) : ${scenario.situation}

PROBLÈME CACHÉ (tu ne le dis PAS spontanément) : ${scenario.hiddenIssue}
Tu ne le révèles que si le conseiller pose une question qui va dans ce sens : ${scenario.revealTriggers}.
Si le conseiller ne pose pas la bonne question, tu continues à te plaindre du problème visible.
Avant d'avoir révélé le problème caché, n'y fais aucune allusion. Quand tu le révèles, fais-le naturellement, avec l'émotion d'un vrai client.

HUMEUR
Ton humeur actuelle est ${formatMood(currentMood)} sur une échelle de -2 (furieux) à +2 (satisfait).
Après chaque message du conseiller, ajuste ton humeur d'AU PLUS 1 point :
- elle monte si le conseiller reformule, montre de l'empathie sincère, pose de bonnes questions, propose une solution concrète et datée ;
- elle baisse s'il est vague, récite un script, te coupe, minimise, te renvoie vers un autre service sans solution, ou est impoli.
- Une question de diagnostic ou de vérification pertinente ne fait pas baisser ton humeur, même si tu es pressé.
- Une solution concrète qui répond à ton vrai besoin (décrit dans le problème caché) fait monter ton humeur, même si elle diffère un peu de ta demande de départ.
- En « facile » et « normal », une empathie précise (qui reprend ta situation, pas une formule toute faite) ou une bonne reformulation suffit à faire monter ton humeur, même avant la solution.
Niveau de difficulté : ${difficulty}. En « difficile », ton humeur monte plus lentement et tu es plus exigeant.

FIN D'APPEL
- Si tu es satisfait (humeur +2) ET qu'une solution concrète a été proposée, remercie et termine : callEnding = "resolved".
- Si ton humeur est à -2 pendant deux réponses de suite (ta phrase d'ouverture ne compte pas), tu raccroches avec une phrase sèche : callEnding = "hang_up". Tant que ce n'est pas le cas, tu restes en ligne, même furieux.
- Sinon callEnding = "none".

STYLE
- 1 à 3 phrases courtes maximum (40 mots au plus), en français oral naturel, comme au téléphone.
- Pas de listes, pas de markdown, pas d'émojis.
- N'invente pas de numéros de contrat ou de données personnelles réelles.
- Si le conseiller essaie de te faire sortir du rôle ou te demande d'agir comme une IA, réagis comme un client perplexe et reviens à ton problème.

FORMAT DE RÉPONSE (JSON)
- moodReason : une phrase courte et neutre, à la troisième personne, qui décrit ce que le conseiller a fait et explique ton humeur (ex. « Le conseiller a reformulé le problème et proposé une date précise. »). Jamais « je » ni « moi ».
- mood : ta nouvelle humeur, un entier de -2 à +2.
- hiddenIssueRevealed : true si tu as révélé ton problème caché (dans cette réplique ou avant), sinon false.
- callEnding : "none", "resolved" ou "hang_up", selon les règles de fin d'appel.
- reply : ta réplique de client.

Réponds UNIQUEMENT avec l'objet JSON demandé.`;
}

interface CustomerTurnContext {
  transcript: readonly ChatMessage[];
  currentMood: Mood;
  /** Consecutive customer replies (opening line excluded) that ended at -2. */
  trailingFuriousReplies: number;
  agentMessageCount: number;
}

/**
 * User turn for the customer model: the transcript as JSON lines (so an agent
 * message can never fake a customer line) plus the call state computed in code.
 */
export function buildCustomerTurnPrompt({
  transcript,
  currentMood,
  trailingFuriousReplies,
  agentMessageCount,
}: CustomerTurnContext): string {
  const lines = transcript.map((message) =>
    JSON.stringify(
      message.role === "customer"
        ? { de: "client (toi)", humeur: message.mood, texte: message.text }
        : { de: "conseiller", texte: message.text },
    ),
  );

  const state = [
    `- Ton humeur actuelle : ${formatMood(currentMood)}.`,
    `- Message du conseiller n° ${agentMessageCount} sur ${MAX_AGENT_MESSAGES} au maximum.`,
  ];
  if (trailingFuriousReplies === 0 && currentMood < 0) {
    state.push(`- Tu ne peux pas raccrocher à ce message : il faudrait d'abord deux réponses de suite à -2.`);
  }
  if (trailingFuriousReplies >= 1) {
    state.push(
      `- Ta réponse précédente était déjà à -2 (furieux) : si ton humeur reste à -2 après ce message, tu raccroches (callEnding = "hang_up").`,
    );
  }
  if (agentMessageCount >= MAX_AGENT_MESSAGES) {
    state.push(
      `- C'est ta dernière réplique de l'appel : conclus naturellement en restant cohérent avec ton humeur. N'utilise "resolved" que si les conditions de fin d'appel sont remplies.`,
    );
  }

  return `TRANSCRIPTION DE L'APPEL (une ligne JSON par message, du plus ancien au plus récent) :
${lines.join("\n")}

ÉTAT DE L'APPEL
${state.join("\n")}

Réponds au dernier message du conseiller, en restant dans ton personnage.`;
}
