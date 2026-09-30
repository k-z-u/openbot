import type { AgentMessage } from "@openbot/ui/data";
import { useText } from "@openbot/ui/text";
import { Show } from "solid-js";
import type { AgentVisualState } from "./bot-visual-state";
import { messagePreviewText } from "./latest-message";

/** The states where the agent is working on the newest thing the person said. */
const WORKING_STATES = {
  queued: true,
  thinking: true,
  "deep-thinking": true,
  "tool-use": true,
  answering: true,
} satisfies Partial<Record<AgentVisualState, true>>;

/**
 * The message the agent is working on, next to the bot.
 *
 * The transcript under the stage is a scrolling band, so while a turn runs the instruction it is
 * answering can be off it. This is that instruction, and only that one: a caption while work is in
 * flight. It deliberately says nothing once the agent has answered, because the answer itself is
 * the newest message by then and repeating it here would be a second copy of the conversation.
 *
 * It is plain text for the same reason: a caption that re-rendered markdown, citations and
 * attachments would be a second message renderer to keep in step with the first.
 */
export function LatestMessageEcho(props: {
  messages: readonly AgentMessage[];
  state: AgentVisualState;
  agentName: string | null;
}) {
  const { t } = useText();
  const latest = () => props.messages[props.messages.length - 1];
  const preview = () => {
    if (!(props.state in WORKING_STATES)) return "";
    const message = latest();
    if (message?.author !== "you") return "";
    return messagePreviewText(message);
  };
  return (
    <Show when={preview()}>
      {(text) => (
        <div class="kz-echo" data-author="you">
          <span class="kz-echo-who">{t("kz.echo.you")}</span>
          <p class="kz-echo-text" title={text()}>
            {text()}
          </p>
        </div>
      )}
    </Show>
  );
}
