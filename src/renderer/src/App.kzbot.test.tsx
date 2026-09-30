import { toast } from "@openbot/ui";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { emitAgentEvent, installOpenbotStub } from "./app-test-harness";

/**
 * The KZUBot stage in the running app: what the runtime publishes, what the stage shows.
 *
 * These are the wiring tests. The state table itself is covered without a DOM in
 * `features/bot-stage/bot-visual-state.test.ts`, so every case here starts from a real event or a
 * real interaction and asserts what a person would read. The status line is the assertion, never a
 * class or an attribute: it is the surface that carries the state, and a test that read the
 * decoration instead would pass while the stage said nothing.
 */
describe("KZUBot stage", () => {
  beforeEach(() => {
    installOpenbotStub();
  });

  afterEach(() => {
    toast.dismiss();
  });

  async function openChat() {
    render(() => <App />);
    await screen.findByRole("heading", { name: "Chief" });
    return screen.findByRole("img", { name: "Bot: Chief" });
  }

  /** The one line the stage says the agent is doing. */
  function status() {
    return screen.getByRole("status", { name: "Agent status" });
  }

  function startTurn(turnId = "turn-1") {
    emitAgentEvent?.({
      type: "turn-started",
      agentId: "chief",
      threadId: "thread-chief",
      turnId,
      origin: "user",
    });
  }

  it("stands the agent in the middle of the conversation with nothing running", async () => {
    await openChat();
    // Both halves of the stage: the agent itself, and the line saying what it is doing.
    expect(screen.getByRole("img", { name: "Bot: Chief" })).toBeInTheDocument();
    expect(status()).toHaveTextContent("Ready");
  });

  it("is thinking while a turn runs, and using a tool once the turn reports a tool step", async () => {
    await openChat();
    startTurn();
    await waitFor(() => expect(status()).toHaveTextContent("Thinking…"));

    // `turn-progress` is emitted only for a tool item, so this is the runtime's own "a tool is
    // running" and not a reading of the sentence.
    emitAgentEvent?.({
      type: "turn-progress",
      agentId: "chief",
      threadId: "thread-chief",
      turnId: "turn-1",
      detail: "Reading the release notes…",
    });
    await waitFor(() => expect(status()).toHaveTextContent("Working with a tool…"));
    // The runtime's own sentence is more specific than any label the stage could invent.
    await waitFor(() => expect(status()).toHaveTextContent("Reading the release notes…"));
  });

  it("reads a high effort turn as thinking hard", async () => {
    await openChat();
    emitAgentEvent?.({
      type: "agents-changed",
      agents: [
        {
          id: "chief",
          provider: "codex",
          name: "Chief",
          title: "Chief of staff",
          description: "Coordinates work",
          notifications: true,
          model: "gpt-5.6-sol",
          reasoningEffort: "high",
          avatarSeed: "chief",
          avatarHue: null,
          avatarUrl: null,
          threadId: "thread-chief",
          workspacePath: "/tmp/OpenBot/Agents/chief",
          preview: "No messages yet",
          updatedAt: null,
        },
      ],
    });
    startTurn();
    await waitFor(() => expect(status()).toHaveTextContent("Thinking hard…"));
  });

  it("asks for the answer while the assistant text is still arriving", async () => {
    await openChat();
    startTurn();
    await waitFor(() => expect(status()).toHaveTextContent("Thinking…"));

    emitAgentEvent?.({
      type: "conversation-delta",
      agentId: "chief",
      threadId: "thread-chief",
      turnId: "turn-1",
      messageId: "answer-1",
      delta: "Here is what I found",
      createdAt: new Date().toISOString(),
      revision: 2,
    });
    await waitFor(() => expect(status()).toHaveTextContent("Writing the answer…"));
  });

  it("waits on the person when the agent asks a question, whatever the turn is doing", async () => {
    await openChat();
    startTurn();
    await waitFor(() => expect(status()).toHaveTextContent("Thinking…"));

    emitAgentEvent?.({
      type: "prompt",
      requestId: "prompt-1",
      agentId: "chief",
      threadId: "thread-chief",
      turnId: "turn-1",
      questions: [
        {
          id: "source",
          question: "Which inbox?",
          header: "Inbox",
          isSecret: false,
          options: [{ label: "Work", description: "" }],
        },
      ],
    });
    await waitFor(() => expect(status()).toHaveTextContent("Waiting for you"));
  });

  it("reads a provider that needs a sign-in as waiting rather than as a failure", async () => {
    await openChat();
    emitAgentEvent?.({
      type: "status",
      status: {
        phase: "ready",
        cliVersion: "0.144.1",
        auth: { kind: "signed-out" },
        providers: [{ id: "codex", state: "sign-in-required", version: null, message: "Sign in to ChatGPT." }],
        capabilities: { chat: "ready", browser: "ready", computerUse: "ready" },
        message: null,
        fullAccess: true,
      },
    });
    await waitFor(() => expect(status()).toHaveTextContent("Waiting for you"));
  });

  it("keeps the stage and the composer through a message, an agent switch and a model change", async () => {
    await openChat();

    // The composer sends, the way any other message is sent.
    const composer = await screen.findByRole("textbox", { name: "Message Chief" });
    composer.textContent = "Draft the weekly note";
    await fireEvent.input(composer);
    await fireEvent.keyDown(composer, { key: "Enter" });
    await waitFor(() => expect(window.openbot.agent.sendMessage).toHaveBeenCalled());

    // Switching agent re-labels the same stage rather than replacing the screen.
    await fireEvent.click(await screen.findByRole("button", { name: /Sales Outbound, Outbound specialist/ }));
    await screen.findByRole("heading", { name: "Sales Outbound" });
    expect(await screen.findByRole("img", { name: "Bot: Sales Outbound" })).toBeInTheDocument();
    expect(status()).toHaveTextContent("Ready");

    // Choosing another model keeps the stage, the composer and the conversation.
    await fireEvent.click(screen.getByRole("button", { name: /Agent model:/ }));
    const dialog = within(screen.getByRole("dialog", { name: "Choose agent model" }));
    const option = dialog.getAllByRole("option")[0];
    if (option) await fireEvent.click(option);
    expect(screen.getByRole("img", { name: "Bot: Sales Outbound" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Agent status" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message Sales Outbound" })).toBeInTheDocument();
  });
});
