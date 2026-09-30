import type { AgentProfile } from "@openbot/ui/data";
import { AgentAvatar } from "@openbot/ui/features/agents/AgentAvatar";
import { useText } from "@openbot/ui/text";
import type { AgentVisualState } from "./bot-visual-state";
import { avatarMoodFor, type WavePlan } from "./bot-visual-state";
import { ThinkingWaves } from "./ThinkingWaves";

/**
 * The centre of the screen: the agent itself, with its thinking drawn around it.
 *
 * The agent's own avatar is the subject, so it is the app's own `AgentAvatar` at stage size rather
 * than a second drawing of the same agent - the mood it is given is the stage's state, so the face
 * and the waves are always saying the same thing. The waves sit behind it as decoration: the whole
 * block is one labelled image to assistive technology, and the sentence that describes the state
 * is the status line below, which is the thing that is read out.
 */
export function BotCore(props: {
  agent?: AgentProfile | undefined;
  state: AgentVisualState;
  plan: WavePlan;
  /** The halo's box in pixels. The waves are drawn in this coordinate space. */
  size: number;
}) {
  const { t } = useText();
  return (
    <div
      class="kz-bot-core"
      data-state={props.state}
      role="img"
      aria-label={t("kz.core.label", { name: props.agent?.name ?? t("kz.core.unnamed") })}
    >
      <div class="kz-bot-core-aura" aria-hidden="true" />
      <ThinkingWaves plan={props.plan} size={props.size} />
      <div class="kz-bot-core-face">
        {/*
          The resting moods keep the avatar's own hover gating, so a window nobody is looking at
          runs no frames; a working mood carries its own motion and animates on its own. That is
          what keeps the bot alive while it works and quiet while it waits.
        */}
        <AgentAvatar agent={props.agent} mood={avatarMoodFor(props.state)} motion="hover" class="kz-bot-core-avatar" />
      </div>
    </div>
  );
}
