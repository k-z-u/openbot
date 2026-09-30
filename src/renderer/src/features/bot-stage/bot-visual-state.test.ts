// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  type AgentVisualInput,
  agentVisualState,
  avatarMoodFor,
  DEEP_THINKING_AFTER_MS,
  effortWaveLayers,
  pulsePeriodMs,
  wavePlan,
} from "./bot-visual-state";

/** A quiet agent with nothing running: every case below changes one field of this. */
function input(overrides: Partial<AgentVisualInput> = {}): AgentVisualInput {
  return {
    hasAgent: true,
    hasActiveTurn: false,
    deliveryActive: false,
    toolStepActive: false,
    streamingAnswer: false,
    waitingForUser: false,
    queued: false,
    providerState: "available",
    turnFailed: false,
    justCompleted: false,
    reasoningEffort: "medium",
    turnElapsedMs: 0,
    ...overrides,
  };
}

describe("agentVisualState", () => {
  it("is idle with nothing running", () => {
    expect(agentVisualState(input())).toBe("idle");
  });

  it("has no state without an agent", () => {
    expect(agentVisualState(input({ hasAgent: false, hasActiveTurn: true }))).toBe("idle");
  });

  it("is thinking for a running turn that is producing nothing yet", () => {
    expect(agentVisualState(input({ hasActiveTurn: true }))).toBe("thinking");
  });

  it("is deep thinking for a high effort turn, and for one that has been quiet a while", () => {
    expect(agentVisualState(input({ hasActiveTurn: true, reasoningEffort: "high" }))).toBe("deep-thinking");
    expect(agentVisualState(input({ hasActiveTurn: true, reasoningEffort: "xhigh" }))).toBe("deep-thinking");
    expect(agentVisualState(input({ hasActiveTurn: true, reasoningEffort: "max" }))).toBe("deep-thinking");
    expect(agentVisualState(input({ hasActiveTurn: true, turnElapsedMs: DEEP_THINKING_AFTER_MS }))).toBe(
      "deep-thinking",
    );
    expect(
      agentVisualState(
        input({ hasActiveTurn: true, turnElapsedMs: DEEP_THINKING_AFTER_MS - 1, reasoningEffort: "low" }),
      ),
    ).toBe("thinking");
  });

  it("is tool use while the turn has a tool progress line", () => {
    expect(agentVisualState(input({ hasActiveTurn: true, toolStepActive: true, reasoningEffort: "high" }))).toBe(
      "tool-use",
    );
  });

  it("is answering while the assistant text of the turn is arriving", () => {
    // The answer outranks the tool line: a turn answering from a tool result is answering.
    expect(agentVisualState(input({ hasActiveTurn: true, streamingAnswer: true, toolStepActive: true }))).toBe(
      "answering",
    );
  });

  it("waits on the person before anything the agent is doing", () => {
    expect(agentVisualState(input({ waitingForUser: true, hasActiveTurn: true, streamingAnswer: true }))).toBe(
      "waiting",
    );
    expect(agentVisualState(input({ waitingForUser: true, turnFailed: true }))).toBe("waiting");
  });

  it("queues a message that has not been picked up", () => {
    expect(agentVisualState(input({ queued: true }))).toBe("queued");
    // A queued message behind a running turn is not the state: the turn is.
    expect(agentVisualState(input({ queued: true, hasActiveTurn: true }))).toBe("thinking");
  });

  // Main hands a message to the provider and the turn it starts arrives a moment later, so without
  // this the stage reads "Ready" while the agent is plainly working.
  it("is thinking for a delivery the agent has taken but not turned into a turn yet", () => {
    expect(agentVisualState(input({ deliveryActive: true }))).toBe("thinking");
    expect(agentVisualState(input({ deliveryActive: true, waitingForUser: true }))).toBe("waiting");
    expect(agentVisualState(input({ deliveryActive: true, queued: true }))).toBe("thinking");
    // A tool step can only be reported for a turn, but it outranks thinking whenever it is there.
    expect(agentVisualState(input({ deliveryActive: true, hasActiveTurn: true, toolStepActive: true }))).toBe(
      "tool-use",
    );
  });

  it("reports a failed turn only while nothing is running", () => {
    expect(agentVisualState(input({ turnFailed: true }))).toBe("error");
    expect(agentVisualState(input({ turnFailed: true, hasActiveTurn: true }))).toBe("thinking");
  });

  it("asks for a sign-in but fails on a provider the computer cannot reach", () => {
    expect(agentVisualState(input({ providerState: "sign-in-required" }))).toBe("waiting");
    expect(agentVisualState(input({ providerState: "unavailable" }))).toBe("error");
    // A provider that is unusable does not hide work that is already running.
    expect(agentVisualState(input({ providerState: "unavailable", hasActiveTurn: true }))).toBe("thinking");
  });

  it("shows the answered state only between a turn and the next thing said", () => {
    expect(agentVisualState(input({ justCompleted: true }))).toBe("completed");
    expect(agentVisualState(input({ justCompleted: true, hasActiveTurn: true }))).toBe("thinking");
    expect(agentVisualState(input({ justCompleted: true, queued: true }))).toBe("queued");
  });

  it("gives the core the face that matches the state", () => {
    expect(avatarMoodFor("error")).toBe("failed");
    expect(avatarMoodFor("waiting")).toBe("waiting");
    expect(avatarMoodFor("completed")).toBe("responded");
    expect(avatarMoodFor("idle")).toBe("idle");
    for (const state of ["queued", "thinking", "deep-thinking", "tool-use", "answering"] as const) {
      expect(avatarMoodFor(state)).toBe("working");
    }
  });
});

describe("wavePlan", () => {
  it("keeps one ring on the calm states whatever the effort says", () => {
    for (const state of ["idle", "queued", "waiting", "error"] as const) {
      expect(wavePlan(state, "max").layers).toHaveLength(1);
    }
  });

  it("widens a working state with the effort the person chose", () => {
    expect(wavePlan("thinking", "low").layers).toHaveLength(1);
    expect(wavePlan("thinking", "medium").layers).toHaveLength(2);
    expect(wavePlan("thinking", "high").layers).toHaveLength(3);
    // Never more than three: past that the rings read as a decoration rather than as a state.
    expect(wavePlan("tool-use", "max").layers).toHaveLength(3);
  });

  it("holds three rings for deep thinking, which is what the state is for", () => {
    expect(wavePlan("deep-thinking", "low").layers).toHaveLength(3);
    expect(wavePlan("deep-thinking", null).layers).toHaveLength(3);
  });

  it("counts effort the way the picker names it", () => {
    expect(effortWaveLayers(null)).toBe(1);
    expect(effortWaveLayers("low")).toBe(1);
    expect(effortWaveLayers("medium")).toBe(2);
    expect(effortWaveLayers("xhigh")).toBe(3);
  });

  it("gives every ring its own size, wander and phase", () => {
    const plan = wavePlan("deep-thinking", "max");
    const radii = plan.layers.map((layer) => layer.radius);
    const seeds = plan.layers.map((layer) => layer.seed);
    expect(new Set(radii).size).toBe(radii.length);
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(plan.layers.map((layer) => layer.index)).toEqual([0, 1, 2]);
    // Outermost first: the widest ring is the one behind, and the rings step inwards from it.
    const widestFirst = [...radii].sort((left, right) => right - left);
    expect(radii).toEqual(widestFirst);
  });

  it("moves in the direction the state means", () => {
    expect(wavePlan("idle", null).motion).toBe("still");
    expect(wavePlan("tool-use", null).motion).toBe("bleed");
    expect(wavePlan("answering", null).motion).toBe("pulse");
    expect(wavePlan("completed", null).motion).toBe("converge");
    expect(wavePlan("thinking", null).motion).toBe("breathe");
  });
});

describe("pulsePeriodMs", () => {
  it("beats with the writing, not on a clock of its own", () => {
    // Twice the text per second is twice the beats: about a second at a calm writing pace, and
    // two-thirds of that at half again the pace.
    expect(pulsePeriodMs(22)).toBe(1_000);
    expect(pulsePeriodMs(33)).toBe(667);
    expect(pulsePeriodMs(33)).toBeLessThan(pulsePeriodMs(22));
  });

  it("keeps the beat inside a range a person reads as a pulse", () => {
    // A model writing faster than the eye follows does not become a blur, and a slow one does not
    // stop: the two ends hold.
    expect(pulsePeriodMs(10_000)).toBe(520);
    expect(pulsePeriodMs(0.01)).toBe(2_400);
  });

  it("rests at the slow end while nothing is arriving", () => {
    expect(pulsePeriodMs(0)).toBe(2_400);
    expect(pulsePeriodMs(-1)).toBe(2_400);
    expect(pulsePeriodMs(Number.NaN)).toBe(2_400);
  });
});
