// The one place the KZUBot stage decides what the agent is doing.
//
// Every field here is state the app already holds: the running turn id, the progress line a tool
// step emits, the assistant text still arriving, the queue, a prompt or approval waiting on the
// person, the provider status and the last failed turn. Nothing invents a state the runtime cannot
// be in, and nothing outside this file derives one, so the waves, the core's face and the status
// line can never disagree about what the agent is doing.
//
// The one signal worth naming: `turn-progress` is emitted only for a tool step. The backend turns
// an ACP tool item into one sentence with `toolProgressText` and returns before the item can become
// a message (`turn-lifecycle.ts`), so a progress line for the running turn *is* "a tool is running
// now" rather than a guess between thinking and acting.

export const AGENT_VISUAL_STATES = [
  "idle",
  "queued",
  "thinking",
  "deep-thinking",
  "tool-use",
  "answering",
  "waiting",
  "completed",
  "error",
] as const;

export type AgentVisualState = (typeof AGENT_VISUAL_STATES)[number];

/** How long a turn has to be thinking before it reads as more than a quick answer. */
export const DEEP_THINKING_AFTER_MS = 12_000;

export interface AgentVisualInput {
  /** Whether there is an agent at all. The stage is still drawn without one, plainly. */
  hasAgent: boolean;
  hasActiveTurn: boolean;
  /**
   * A delivery the agent has picked up whose turn the runtime has not reported yet.
   *
   * There is always a gap between "main handed this message to the provider" and "the provider
   * started a turn", and it is not short: a CLI starts, a session is opened, the first request
   * goes out. Without this the stage says the agent is ready while it is plainly working, which is
   * the one thing a status line must never do.
   */
  deliveryActive: boolean;
  /** `turn-progress` for the running turn, which only ever comes from a tool step. */
  toolStepActive: boolean;
  /** The assistant text of this turn is still arriving. */
  streamingAnswer: boolean;
  /** A question, an approval or a browser takeover is waiting on the person. */
  waitingForUser: boolean;
  /** The agent's queue holds a message no turn has picked up yet. */
  queued: boolean;
  /** OpenCode and the other CLIs report a refused or missing account separately from a failure. */
  providerState: "available" | "sign-in-required" | "unavailable" | "unknown";
  /** The last turn of this agent failed and nothing is running now. */
  turnFailed: boolean;
  /** The activity line has finished and is on its way out, which is what "just answered" is. */
  justCompleted: boolean;
  reasoningEffort: string | null;
  /** How long the current turn has been running. */
  turnElapsedMs: number;
}

/**
 * Whether the agent is busy: a turn it reported, or a delivery it has taken and not yet turned into
 * one. Both are the agent working, and the stage shows one thing for both.
 */
function isWorking(input: AgentVisualInput): boolean {
  return input.hasActiveTurn || input.deliveryActive;
}

/**
 * The state the stage shows, most specific first.
 *
 * What needs the person outranks what the agent is doing, and a failure outranks both: a turn that
 * failed while a question is still open is a question the person has to answer before the failure
 * can be repeated. Everything that reads as "the agent is not doing anything right now" falls
 * through to the queue, the just-finished line, and finally idle.
 */
export function agentVisualState(input: AgentVisualInput): AgentVisualState {
  if (!input.hasAgent) return "idle";
  if (input.waitingForUser) return "waiting";
  if (input.turnFailed && !isWorking(input)) return "error";
  if (!isWorking(input) && (input.providerState === "unavailable" || input.providerState === "sign-in-required")) {
    // A provider the app cannot reach and a provider that wants a sign-in are both "the next
    // message will not go through until you do something", not "the agent broke".
    return input.providerState === "sign-in-required" ? "waiting" : "error";
  }
  if (isWorking(input)) {
    if (input.streamingAnswer) return "answering";
    if (input.toolStepActive) return "tool-use";
    return isDeepThinking(input) ? "deep-thinking" : "thinking";
  }
  if (input.queued) return "queued";
  if (input.justCompleted) return "completed";
  return "idle";
}

/**
 * A turn that has been quiet for a while, or one the person asked to think hard on, is drawn as
 * deeper thinking. Effort is the stated intent; the clock is what covers a long tool-free stretch
 * at a low effort setting, and it is why this needs the elapsed time at all.
 */
function isDeepThinking(input: AgentVisualInput): boolean {
  if (input.reasoningEffort === "high" || input.reasoningEffort === "xhigh" || input.reasoningEffort === "max") {
    return true;
  }
  return input.turnElapsedMs >= DEEP_THINKING_AFTER_MS;
}

/** The face the core wears. It follows the stage's state, so the two are never out of step. */
export function avatarMoodFor(state: AgentVisualState) {
  switch (state) {
    case "error":
      return "failed" as const;
    case "waiting":
      return "waiting" as const;
    case "completed":
      return "responded" as const;
    case "idle":
      return "idle" as const;
    default:
      return "working" as const;
  }
}

export type WaveMotion = "still" | "breathe" | "bleed" | "converge" | "pulse";

/**
 * Characters of answer text one heartbeat stands for.
 *
 * The beat is the model's writing pace made visible: at about 22 characters a second - a calm
 * answer - the ring beats once a second, and it speeds up with the model rather than on a timer of
 * its own. Roughly four characters make a token in English prose, so this is about five tokens per
 * beat; it is written in characters because characters are what the renderer actually receives.
 */
const CHARACTERS_PER_PULSE = 22;

/** The fastest and slowest the beat may go, whatever the writing rate is. */
const MIN_PULSE_MS = 520;
const MAX_PULSE_MS = 2_400;

/**
 * The gap between two heartbeats for an answer arriving at this rate.
 *
 * A stall falls back to the slow end rather than stopping: a turn that is thinking between two
 * sentences still has a pulse, it is just a resting one. Zero - nothing streaming - gets the same
 * slow end, which is what the ring shows before the first token lands.
 */
export function pulsePeriodMs(charactersPerSecond: number): number {
  if (!(charactersPerSecond > 0)) return MAX_PULSE_MS;
  const beatsPerSecond = charactersPerSecond / CHARACTERS_PER_PULSE;
  const period = 1_000 / Math.max(beatsPerSecond, 1_000 / MAX_PULSE_MS);
  return Math.round(Math.min(MAX_PULSE_MS, Math.max(MIN_PULSE_MS, period)));
}

export interface WaveLayer {
  /** Draw order and animation phase; the far layers sit behind the near ones. */
  index: number;
  /** Radius as a fraction of the halo box's half. */
  radius: number;
  /** How far the outline wanders from that circle, in the same units. */
  wobble: number;
  /** Outline vertices. Twelve reads as organic without making the path expensive. */
  points: number;
  /** Seeds the harmonics, so no two layers share a shape. */
  seed: number;
}

export interface WavePlan {
  layers: WaveLayer[];
  /** One full drift of the outline, in milliseconds. */
  periodMs: number;
  /** How far a layer's scale travels across the cycle, as a fraction of its own size. */
  amplitude: number;
  motion: WaveMotion;
}

interface WaveShape {
  layers: number;
  periodMs: number;
  amplitude: number;
  motion: WaveMotion;
}

/**
 * Per state: how many rings, how fast they drift, how far they breathe and in which direction.
 *
 * The calm states hold one ring whatever the effort says, because effort describes a turn and
 * there is no turn. The working states take the larger of their own floor and the effort's count,
 * which is what makes a `high` turn visibly wider than a `low` one.
 */
const WAVE_SHAPES: Readonly<Record<AgentVisualState, WaveShape>> = {
  idle: { layers: 1, periodMs: 44_000, amplitude: 0.02, motion: "still" },
  queued: { layers: 1, periodMs: 26_000, amplitude: 0.03, motion: "breathe" },
  thinking: { layers: 1, periodMs: 17_000, amplitude: 0.05, motion: "breathe" },
  "deep-thinking": { layers: 3, periodMs: 11_000, amplitude: 0.08, motion: "breathe" },
  "tool-use": { layers: 2, periodMs: 9_000, amplitude: 0.09, motion: "bleed" },
  // The answer is where tokens are actually arriving, so it is the one state whose pace has a
  // source to follow: `pulsePeriodMs` reads the writing rate and the ring beats with it.
  answering: { layers: 2, periodMs: 7_000, amplitude: 0.045, motion: "pulse" },
  waiting: { layers: 1, periodMs: 48_000, amplitude: 0.02, motion: "still" },
  completed: { layers: 2, periodMs: 6_000, amplitude: 0.04, motion: "converge" },
  error: { layers: 1, periodMs: 30_000, amplitude: 0.03, motion: "still" },
};

/** The states where the agent is working, and therefore the only ones effort may widen. */
const WORKING_STATES = {
  thinking: true,
  "deep-thinking": true,
  "tool-use": true,
  answering: true,
} satisfies Partial<Record<AgentVisualState, true>>;

function isWorkingState(state: AgentVisualState): boolean {
  return state in WORKING_STATES;
}

/** The ring count an effort asks for, before the state's own floor. */
export function effortWaveLayers(effort: string | null) {
  switch (effort) {
    case "medium":
      return 2;
    case "high":
    case "xhigh":
    case "max":
      return 3;
    default:
      return 1;
  }
}

export function wavePlan(state: AgentVisualState, effort: string | null): WavePlan {
  const shape = WAVE_SHAPES[state];
  const count = isWorkingState(state) ? Math.max(shape.layers, Math.min(effortWaveLayers(effort), 3)) : shape.layers;
  return {
    layers: Array.from({ length: count }, (_unused, index) => ({
      index,
      // The rings are spread inside the halo rather than stacked, so three read as three.
      radius: 0.92 - index * 0.17,
      // The outer ring wanders most: it has the most room, and a near ring that wobbles as much
      // reads as noise rather than as a wave.
      wobble: 0.13 + index * 0.025,
      points: 12,
      seed: 1 + index * 3.3,
    })),
    periodMs: shape.periodMs,
    amplitude: shape.amplitude,
    motion: shape.motion,
  };
}
