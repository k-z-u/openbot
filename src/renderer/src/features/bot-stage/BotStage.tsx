import type { AgentProviderStatus, QueueSnapshot } from "@openbot/contracts/ipc";
import { Button } from "@openbot/ui";
import type { AgentMessage, AgentProfile } from "@openbot/ui/data";
import { useText } from "@openbot/ui/text";
import { createEffect, createMemo, createSignal } from "solid-js";
import { useConversationViewScope } from "../conversation/conversation-scope";
import { AgentStatusLabel } from "./AgentStatusLabel";
import { BotCore } from "./BotCore";
import type { AgentVisualInput, AgentVisualState } from "./bot-visual-state";
import { agentVisualState, pulsePeriodMs, wavePlan } from "./bot-visual-state";
import { LatestMessageEcho } from "./LatestMessageEcho";
import { readTranscriptExpanded, toggleTranscriptExpanded } from "./transcript-preference";

/** The halo's coordinate space, in pixels. Large enough that a 12-point outline stays smooth. */
const WAVE_BOX = 360;

/**
 * The centre of the conversation: the agent, its thinking, and one line saying what it is doing.
 *
 * Every state it shows comes from `agentVisualState`, which reads only what the runtime already
 * publishes, so the stage is a view of the agent rather than an animation beside it. Nothing here
 * is simulated: an idle agent has still rings, and the rings only move while a turn is running.
 */
export function BotStage(props: { agent?: AgentProfile | undefined }) {
  const { props: conversation, renderedAgentActivity } = useConversationViewScope();
  const { t } = useText();
  const [now, setNow] = createSignal(Date.now());

  const activeTurnId = () => conversation.activeTurnId ?? null;
  const streamingLength = createMemo(() => streamingAnswer(conversation.messages)?.body.length ?? 0);
  const [charactersPerSecond, setCharactersPerSecond] = createSignal(0);
  /** The previous reading of the streaming text, for the rate between two ticks. */
  let sample = { at: 0, length: 0 };

  /**
   * The one clock on the stage. It only ticks while a turn or its closing line is on screen, so an
   * idle window wakes up for nothing rather than once a second forever, and it stops with the
   * component.
   *
   * The same tick reads how fast the answer is arriving, which is what the heartbeat is paced by.
   * It is measured from the text itself because that is the only arrival signal the renderer has:
   * the deltas reach the conversation store already applied, and every provider answers in the same
   * text. The reading is smoothed over the last few samples, so one burst from a fast model does
   * not snap the beat to its fastest and a pause between sentences does not stop it dead.
   */
  createEffect(
    () => activeTurnId() !== null || renderedAgentActivity() !== null,
    (running) => {
      if (!running) {
        sample = { at: 0, length: 0 };
        setCharactersPerSecond(0);
        return;
      }
      setNow(Date.now());
      const timer = window.setInterval(() => {
        setNow(Date.now());
        const at = Date.now();
        const length = streamingLength();
        const seconds = (at - sample.at) / 1_000;
        // The first tick has nothing to compare against; a tick that arrived early would divide by
        // almost nothing; and a tick that arrived very late is a window the browser throttled while
        // the window was hidden, where dividing by the whole gap would read a burst of text as a
        // crawl. Those re-seed instead of measuring.
        if (sample.at > 0 && seconds >= 0.25 && seconds <= 5) {
          const growth = Math.max(0, length - sample.length) / seconds;
          setCharactersPerSecond((previous) => previous * 0.4 + growth * 0.6);
        }
        sample = { at, length };
      }, 1_000);
      return () => window.clearInterval(timer);
    },
  );

  const input = createMemo<AgentVisualInput>(() => {
    const activity = renderedAgentActivity();
    const messages = conversation.messages;
    const latest = messages[messages.length - 1];
    const provider = conversation.agentStatus.providers?.find((item) => item.id === conversation.agent?.provider);
    const hasActiveTurn = activeTurnId() !== null;
    const deliveries = conversation.queue?.deliveries ?? [];
    // Main hands a message to the provider, and the turn it starts is reported a moment later.
    // The queue is what says the agent has picked the message up in between.
    const deliveryActive = deliveries.some(
      (delivery) => delivery.status === "starting" || delivery.status === "running",
    );
    return {
      hasAgent: Boolean(conversation.agent),
      hasActiveTurn,
      deliveryActive,
      // `activityDetail` is the turn's `turn-progress`, and the backend emits one only for a tool
      // step: it converts the tool item to a sentence and returns before it can become a message.
      // So this is the app's own answer to "is a tool running", not a reading of the progress text.
      toolStepActive: hasActiveTurn && Boolean(conversation.activityDetail?.trim()),
      streamingAnswer: hasActiveTurn && Boolean(streamingAnswer(messages)),
      waitingForUser: Boolean(conversation.prompt || conversation.approval || conversation.browserTakeover),
      queued: deliveries.some((delivery) => delivery.status === "queued"),
      providerState: providerAvailability(provider),
      turnFailed:
        !hasActiveTurn && !deliveryActive && (latest?.kind === "error" || queueEndedInFailure(conversation.queue)),
      justCompleted: activity?.phase === "exiting",
      reasoningEffort: conversation.agent?.reasoningEffort ?? null,
      turnElapsedMs: activity ? Math.max(0, now() - activity.since) : 0,
    };
  });

  const state = createMemo<AgentVisualState>(() => agentVisualState(input()));
  const plan = createMemo(() => wavePlan(state(), conversation.agent?.reasoningEffort ?? null));
  const pulsePeriod = createMemo(() => pulsePeriodMs(charactersPerSecond()));
  const detail = createMemo(() => renderedAgentActivity()?.detail ?? null);
  const since = createMemo(() => (activeTurnId() === null ? null : (renderedAgentActivity()?.since ?? null)));

  return (
    <section
      class="kz-stage"
      data-state={state()}
      data-motion={plan().motion}
      style={`--kz-period: ${plan().periodMs}ms; --kz-amplitude: ${plan().amplitude}; --kz-pulse: ${pulsePeriod()}ms`}
    >
      <p class="kz-stage-mark">{t("kz.brand")}</p>
      <BotCore agent={props.agent} state={state()} plan={plan()} size={WAVE_BOX} />
      <AgentStatusLabel state={state()} detail={detail()} since={since()} now={now()} />
      <LatestMessageEcho
        messages={conversation.messages}
        state={state()}
        agentName={conversation.agent?.name ?? null}
      />
      <Button
        variant="ghost"
        size="sm"
        class="kz-transcript-toggle"
        aria-expanded={readTranscriptExpanded() ? "true" : "false"}
        onClick={() => toggleTranscriptExpanded()}
      >
        {t(readTranscriptExpanded() ? "kz.transcript.fold" : "kz.transcript.unfold")}
      </Button>
    </section>
  );
}

/**
 * The assistant text of the running turn, which is what makes the state `answering`.
 *
 * A plan streams for the whole turn and a thinking run streams while the model reasons, so neither
 * is the answer the reader is waiting for; the last message of either kind would otherwise hold the
 * stage on "answering" from the first tool step to the end.
 */
function streamingAnswer(messages: readonly AgentMessage[]): AgentMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.author === "agent" && message.streaming && message.kind !== "plan" && message.kind !== "thinking") {
      return message;
    }
  }
  return undefined;
}

/** A queue whose last delivery ended badly, which is the same failure a turn's error message is. */
function queueEndedInFailure(queue: QueueSnapshot | undefined): boolean {
  const latest = queue?.deliveries[queue.deliveries.length - 1];
  return latest?.status === "failed" || latest?.status === "interrupted";
}

function providerAvailability(provider: AgentProviderStatus | undefined): AgentVisualInput["providerState"] {
  switch (provider?.state) {
    case "available":
      return "available";
    case "sign-in-required":
      return "sign-in-required";
    case "not-installed":
    case "error":
    case "outdated":
      return "unavailable";
    default:
      return "unknown";
  }
}
