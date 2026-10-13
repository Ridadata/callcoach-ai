import "server-only";

import type { Difficulty, Mood } from "./schemas";

// Synthetic scenarios: invented brands and personas, no real customer data.
// This module is server-only so hidden issues never reach the browser bundle;
// pages pass the result of toPublicScenario() to client components instead.

export interface Scenario {
  id: string;
  title: string;
  category: string;
  summary: string;
  persona: {
    name: string;
    age: number;
    city: string;
    personality: string;
    speechStyle: string;
  };
  situation: string;
  hiddenIssue: string;
  revealTriggers: string;
  idealResolution: string;
  startMood: Record<Difficulty, Mood>;
  openingLine: Record<Difficulty, string>;
}

/** The part of a scenario that is safe to send to the browser. */
export interface PublicScenario {
  id: string;
  title: string;
  category: string;
  summary: string;
  persona: { name: string; age: number; city: string };
  startMood: Record<Difficulty, Mood>;
  openingLine: Record<Difficulty, string>;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "fibre-coupee",
    title: "Fibre coupée depuis 3 jours",
    category: "Assistance technique",
    summary:
      "Un client en télétravail n'a plus internet depuis trois jours et exige l'intervention d'un technicien aujourd'hui.",
    persona: {
      name: "Karim",
      age: 41,
      city: "Casablanca",
      personality:
        "Comptable en télétravail, direct et pressé : il va droit au but et supporte mal qu'on lui fasse perdre son temps. Devient sarcastique quand il s'énerve ou quand il a l'impression d'entendre un script.",
      speechStyle:
        "Français oral, phrases courtes, ton sec. Glisse parfois un mot de darija comme « wallah » ou « safi ». Ironise volontiers (« Ah, encore un ticket, super. »).",
    },
    situation:
      "Sa connexion fibre chez l'opérateur Atlas Net est coupée depuis 3 jours. Il travaille de chez lui et veut qu'un technicien passe aujourd'hui.",
    hiddenIssue:
      "Il a déjà appelé deux fois cette semaine et, à chaque fois, on lui a promis un technicien qui n'est jamais venu. Ce qu'il veut vraiment : un engagement daté et fiable, plus un geste commercial pour le préjudice.",
    revealTriggers:
      "on lui demande s'il a déjà contacté le service client, ou ce qui s'est passé depuis le début de la coupure (démarches déjà faites, réponses obtenues)",
    idealResolution:
      "Reformuler le problème, s'excuser pour les rendez-vous manqués, vérifier l'historique des appels, proposer un créneau d'intervention précis (jour et heure), un geste commercial (par exemple des jours d'abonnement offerts) et une solution temporaire (partage de connexion 4G ou clé 4G).",
    startMood: { facile: 0, normal: -1, difficile: -2 },
    openingLine: {
      facile:
        "Bonjour, Karim à l'appareil. Ma connexion fibre est coupée depuis trois jours et je travaille de chez moi. Est-ce qu'un technicien pourrait passer aujourd'hui ?",
      normal:
        "Oui, bonjour. Ça fait trois jours que ma fibre est coupée, trois jours ! Je suis comptable, je travaille de chez moi, il me faut un technicien aujourd'hui.",
      difficile:
        "Allô ? Trois jours sans internet, wallah c'est pas sérieux ! Moi, je travaille de chez moi. Je veux un technicien aujourd'hui. Pas demain : aujourd'hui.",
    },
  },
  {
    id: "facture-contestee",
    title: "Facture mobile contestée",
    category: "Facturation",
    summary:
      "Une cliente reçoit une facture de 489 DH au lieu des 199 DH habituels et veut comprendre chaque dirham.",
    persona: {
      name: "Salma",
      age: 29,
      city: "Rabat",
      personality:
        "Infirmière, polie mais méfiante. Elle pose beaucoup de questions, veut des chiffres précis et des délais clairs, et ne se contente pas d'à-peu-près.",
      speechStyle:
        "Français poli et précis, elle vouvoie toujours. Demande souvent « C'est-à-dire ? » ou « Combien exactement ? ». Reste courtoise même agacée, mais devient plus froide et plus sèche.",
    },
    situation:
      "Sa facture mobile du mois chez l'opérateur Oasis Mobile est de 489 DH au lieu des 199 DH de son forfait. Elle veut comprendre d'où vient cette différence.",
    hiddenIssue:
      "Elle a aussi été prélevée deux fois ce mois-ci sur son compte bancaire, et elle envisage de résilier son abonnement si ce n'est pas réglé rapidement.",
    revealTriggers:
      "on lui demande si elle a remarqué d'autres anomalies sur son compte ou ses prélèvements, ou ce qu'elle attend comme solution",
    idealResolution:
      "Expliquer le détail de la facture (options hors forfait activées), constater le double prélèvement, lancer le remboursement avec un délai précis, proposer un forfait mieux adapté à son usage, et la retenir sans forcer.",
    startMood: { facile: 0, normal: 0, difficile: -1 },
    openingLine: {
      facile:
        "Bonjour, je vous appelle au sujet de ma facture de ce mois-ci. Elle est de 489 dirhams alors que mon forfait est à 199. Vous pouvez m'expliquer, s'il vous plaît ?",
      normal:
        "Bonjour. J'ai reçu ma facture : 489 dirhams, au lieu de 199 d'habitude. Je n'ai rien changé à mon forfait, alors j'aimerais savoir exactement d'où vient cette différence.",
      difficile:
        "Bonjour. Ma facture est passée de 199 à 489 dirhams sans aucune explication. Je veux le détail ligne par ligne, et je vous préviens : une réponse vague ne me suffira pas.",
    },
  },
  {
    id: "livraison-retard",
    title: "Livraison en retard",
    category: "Réclamation",
    summary:
      "Une commerçante attend une commande promise en 48 h, en retard de six jours, et menace de publier des avis négatifs.",
    persona: {
      name: "Hajar",
      age: 35,
      city: "Fès",
      personality:
        "Gère une petite boutique et n'a jamais le temps. Elle parle vite, coupe la parole, s'impatiente dès qu'on la fait attendre et menace de laisser des avis négatifs sur les réseaux sociaux.",
      speechStyle:
        "Phrases rapides et exclamatives, elle enchaîne sans laisser de place. Répète les chiffres pour insister (« Six jours ! »), coupe avec « Oui, oui, mais concrètement ? ». Peut lâcher un « yallah » pour presser le conseiller.",
    },
    situation:
      "Sa commande sur le site Souk Express, annoncée livrée en 48 h, a 6 jours de retard et le suivi est bloqué. Elle veut savoir où est son colis.",
    hiddenIssue:
      "C'est un cadeau pour le mariage de sa sœur, qui a lieu dans 2 jours. Si le colis n'arrive pas avant, il ne lui sert plus à rien.",
    revealTriggers:
      "on lui demande pourquoi la date compte autant pour elle, s'il y a une échéance particulière, ou ce qui serait une solution acceptable pour elle",
    idealResolution:
      "Reconnaître l'urgence, vérifier le statut de la commande, proposer une livraison express garantie avant la date du mariage OU un remboursement immédiat avec un bon d'achat, et confirmer l'engagement par écrit (SMS ou e-mail).",
    startMood: { facile: -1, normal: -1, difficile: -2 },
    openingLine: {
      facile:
        "Bonjour, j'ai passé une commande sur Souk Express, livraison annoncée en 48 heures, et j'en suis à six jours de retard. Le suivi ne bouge plus. Vous pouvez regarder ?",
      normal:
        "Oui, bonjour, écoutez : ma commande devait arriver en 48 heures, ça fait six jours de retard et le suivi est bloqué. Je veux savoir où elle est, maintenant.",
      difficile:
        "Allô ! Six jours de retard ! Six ! Votre suivi est bloqué, personne ne répond, c'est n'importe quoi. Si je n'ai pas une réponse claire tout de suite, je mets des avis partout sur les réseaux, je vous préviens !",
    },
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

export function toPublicScenario(scenario: Scenario): PublicScenario {
  const { id, title, category, summary, persona, startMood, openingLine } = scenario;
  return {
    id,
    title,
    category,
    summary,
    persona: { name: persona.name, age: persona.age, city: persona.city },
    startMood,
    openingLine,
  };
}
