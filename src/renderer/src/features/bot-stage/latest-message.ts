import type { AgentMessage } from "@openbot/ui/data";

/** How much of a message the echo beside the bot shows. One line, not a paragraph. */
const ECHO_LIMIT = 180;

/**
 * The one line the echo reads for a message.
 *
 * A plan, a tool marker and a question all carry their meaning in a card the transcript draws; the
 * echo is a caption, so it takes the text and leaves the rest to the timeline. An answer still
 * arriving is trimmed while it streams, which is what keeps the line from growing under the bot.
 */
export function messagePreviewText(message: AgentMessage): string {
  const collapsed = message.body.replace(/\s+/gu, " ").trim();
  if (!collapsed) return "";
  return collapsed.length > ECHO_LIMIT ? `${collapsed.slice(0, ECHO_LIMIT).trimEnd()}…` : collapsed;
}
