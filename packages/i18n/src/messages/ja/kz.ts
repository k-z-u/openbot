import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/kz";

export const messages = {
  "kz.brand": "KZUBot",
  "kz.core.label": "Bot: {name}",
  "kz.core.unnamed": "Bot",
  "kz.status.label": "エージェントの状態",
  "kz.status.elapsed": "{seconds} 秒",
  "kz.state.idle": "待機中",
  "kz.state.queued": "順番を待っています",
  "kz.state.thinking": "考えています…",
  "kz.state.deepThinking": "じっくり考えています…",
  "kz.state.toolUse": "ツールを使っています…",
  "kz.state.answering": "回答を作成中…",
  "kz.state.waiting": "あなたの返答を待っています",
  "kz.state.completed": "回答しました",
  "kz.state.error": "問題が発生しました",
  "kz.echo.you": "あなた",
  "kz.transcript.unfold": "会話を展開",
  "kz.transcript.fold": "会話を収納",
} as const satisfies PartialTranslation<typeof source>;
