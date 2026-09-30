// Whether the transcript under the stage is folded away or taking the room.
//
// One preference for the whole app rather than one per agent: it describes how the person wants to
// read a conversation, not what any conversation contains, so it is read once and kept where the
// other view preferences live.
//
// A module-level signal rather than one inside the stage, because the attribute it drives belongs
// on the conversation panel, which is the stage's parent.

import { createSignal } from "solid-js";

const STORAGE_KEY = "openbot-kz-transcript-expanded";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // A profile with storage disabled reads the default. The preference is not worth an error.
    return false;
  }
}

const [expanded, setExpanded] = createSignal(readStored());

export function readTranscriptExpanded(): boolean {
  return expanded();
}

export function toggleTranscriptExpanded(): void {
  const next = !expanded();
  setExpanded(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Kept for this session; the next one starts folded.
  }
}
