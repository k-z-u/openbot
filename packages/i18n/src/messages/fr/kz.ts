import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/kz";

export const messages = {
  "kz.brand": "KZUBot",
  "kz.core.label": "Bot : {name}",
  "kz.core.unnamed": "Bot",
  "kz.status.label": "État de l’agent",
  "kz.status.elapsed": "{seconds} s",
  "kz.state.idle": "Prêt",
  "kz.state.queued": "En attente de son tour",
  "kz.state.thinking": "Réflexion…",
  "kz.state.deepThinking": "Réflexion approfondie…",
  "kz.state.toolUse": "Utilise un outil…",
  "kz.state.answering": "Rédige la réponse…",
  "kz.state.waiting": "Vous attend",
  "kz.state.completed": "A répondu",
  "kz.state.error": "Un problème est survenu",
  "kz.echo.you": "Vous",
  "kz.transcript.unfold": "Afficher la conversation",
  "kz.transcript.fold": "Masquer la conversation",
} as const satisfies PartialTranslation<typeof source>;
