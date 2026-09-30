import type { AgentProfile } from "@openbot/ui/data";
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { AgentStatusLabel } from "./AgentStatusLabel";
import { BotCore } from "./BotCore";
import type { AgentVisualState } from "./bot-visual-state";
import { wavePlan } from "./bot-visual-state";
import { ThinkingWaves } from "./ThinkingWaves";

const SIZE = 360;

/** The profile shape the header and the stage both take, with only the fields a test cares about. */
function testAgent(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: "chief",
    name: "Chief",
    title: "",
    description: "",
    notifications: false,
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    threadId: null,
    avatarSeed: "chief",
    avatarHue: null,
    avatarUrl: null,
    time: "",
    preview: "",
    ...overrides,
  };
}

/**
 * What the rings draw, counted by their own elements.
 *
 * A ring is decoration: it has no role and no name, so there is nothing accessible to query. The
 * geometry and the motion table are asserted without a DOM in `bot-visual-state.test.ts` and
 * `wave-path.test.ts`; what is worth asserting here is only that the plan reaches the document,
 * which counting the drawn paths does.
 */
function drawnRings(state: AgentVisualState, effort: string | null = "medium"): number {
  const view = render(() => <ThinkingWaves plan={wavePlan(state, effort)} size={SIZE} />);
  const count = view.container.querySelectorAll("path").length;
  view.unmount();
  return count;
}

describe("ThinkingWaves", () => {
  it("draws the rings the plan asks for", () => {
    expect(drawnRings("idle", "max")).toBe(1);
    expect(drawnRings("deep-thinking")).toBe(3);
  });

  it("contributes nothing to the accessibility tree: the rings are decoration", () => {
    render(() => <BotCore agent={testAgent()} state="thinking" plan={wavePlan("thinking", "high")} size={SIZE} />);
    // One image for the agent and nothing else, however many rings are drawn behind it.
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});

describe("BotCore", () => {
  it("is one labelled image of the agent", () => {
    render(() => <BotCore agent={testAgent()} state="idle" plan={wavePlan("idle", "medium")} size={SIZE} />);
    expect(screen.getByRole("img", { name: "Bot: Chief" })).toBeInTheDocument();
  });

  it("is still a bot before an agent is chosen", () => {
    render(() => <BotCore agent={undefined} state="waiting" plan={wavePlan("waiting", null)} size={SIZE} />);
    expect(screen.getByRole("img", { name: "Bot: Bot" })).toBeInTheDocument();
  });
});

describe("AgentStatusLabel", () => {
  /** One render per assertion: a second render in the same test would leave the first in the DOM. */
  const withLabel = (
    state: AgentVisualState,
    run: (status: HTMLElement) => void,
    options: { detail?: string | null; since?: number | null; now?: number } = {},
  ) => {
    const view = render(() => (
      <AgentStatusLabel
        state={state}
        detail={options.detail ?? null}
        since={options.since ?? null}
        now={options.now ?? 0}
      />
    ));
    run(screen.getByRole("status", { name: "Agent status" }));
    view.unmount();
  };

  it("says what the agent is doing in the reader's language", () => {
    for (const [state, text] of [
      ["idle", "Ready"],
      ["queued", "Waiting for its turn"],
      ["thinking", "Thinking…"],
      ["deep-thinking", "Thinking hard…"],
      ["tool-use", "Working with a tool…"],
      ["answering", "Writing the answer…"],
      ["waiting", "Waiting for you"],
      ["completed", "Answered"],
      ["error", "Something went wrong"],
    ] as const) {
      withLabel(state, (status) => expect(status).toHaveTextContent(text));
    }
  });

  it("shows the runtime's own progress sentence under the state", () => {
    withLabel(
      "tool-use",
      (status) => {
        expect(status).toHaveTextContent("Working with a tool…");
        expect(status).toHaveTextContent("Reading the release notes…");
      },
      { detail: "Reading the release notes…" },
    );
  });

  it("counts the seconds only once a step has been running a while", () => {
    withLabel("thinking", (status) => expect(status).not.toHaveTextContent("3s"), { since: 1_000, now: 4_000 });
    withLabel("thinking", (status) => expect(status).toHaveTextContent("6s"), { since: 1_000, now: 7_000 });
  });

  it("says nothing about time when nothing is running", () => {
    withLabel("idle", (status) => expect(status).not.toHaveTextContent("60s"), { now: 60_000 });
  });
});
