import type { AppTextKey } from "@openbot/i18n";
import { useText } from "@openbot/ui/text";
import { Show } from "solid-js";
import type { AgentVisualState } from "./bot-visual-state";

/** The one line each state reads as. The detail line below it carries the runtime's own words. */
const STATE_LABELS: Readonly<Record<AgentVisualState, AppTextKey>> = {
  idle: "kz.state.idle",
  queued: "kz.state.queued",
  thinking: "kz.state.thinking",
  "deep-thinking": "kz.state.deepThinking",
  "tool-use": "kz.state.toolUse",
  answering: "kz.state.answering",
  waiting: "kz.state.waiting",
  completed: "kz.state.completed",
  error: "kz.state.error",
};

/**
 * What the agent is doing, under the core.
 *
 * The first line is the state in the reader's language; the second is the runtime's own progress
 * sentence when it has one, which is more specific than any label this file could invent ("Reading
 * Gmail…" rather than "using a tool"). Two lines at most: the stage is the subject, and a
 * transcript of the machinery would displace it.
 *
 * The whole block is one live region, so a screen reader hears a change of state without the
 * elapsed counter re-announcing every second.
 */
export function AgentStatusLabel(props: {
  state: AgentVisualState;
  /** The runtime's progress line for the running turn, already in the reader's language. */
  detail: string | null;
  /** When the current step started, for the elapsed reading. Null when nothing is running. */
  since: number | null;
  now: number;
}) {
  const { t } = useText();
  const elapsedSeconds = () => {
    const since = props.since;
    if (since === null) return 0;
    return Math.max(0, Math.floor((props.now - since) / 1_000));
  };
  return (
    <div class="kz-status" role="status" aria-label={t("kz.status.label")}>
      <p class="kz-status-line" data-state={props.state}>
        <span class="kz-status-dot" aria-hidden="true" />
        <span class="kz-status-text">{t(STATE_LABELS[props.state])}</span>
        <Show when={elapsedSeconds() >= 5}>
          <span class="kz-status-elapsed">{t("kz.status.elapsed", { seconds: elapsedSeconds() })}</span>
        </Show>
      </p>
      <Show when={props.detail}>{(detail) => <p class="kz-status-detail">{detail()}</p>}</Show>
    </div>
  );
}
