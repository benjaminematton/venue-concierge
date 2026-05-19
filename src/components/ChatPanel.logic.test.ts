import { describe, expect, it } from "vitest";
import { canSubmit, keyIntent, turnStatus } from "./ChatPanel.logic";

describe("canSubmit", () => {
  it("allows non-empty input while idle", () => {
    expect(canSubmit("hi", false, false)).toBe(true);
  });
  it("blocks whitespace-only input", () => {
    expect(canSubmit("   ", false, false)).toBe(false);
  });
  it("blocks empty input", () => {
    expect(canSubmit("", false, false)).toBe(false);
  });
  it("blocks while streaming", () => {
    expect(canSubmit("hi", true, false)).toBe(false);
  });
  it("blocks while disabled", () => {
    expect(canSubmit("hi", false, true)).toBe(false);
  });
});

describe("keyIntent", () => {
  it("Enter without shift submits", () => {
    expect(keyIntent("Enter", false)).toBe("submit");
  });
  it("Enter with shift inserts a newline", () => {
    expect(keyIntent("Enter", true)).toBe("newline");
  });
  it("other keys pass through", () => {
    expect(keyIntent("a", false)).toBe("passthrough");
    expect(keyIntent("Escape", false)).toBe("passthrough");
    expect(keyIntent(" ", true)).toBe("passthrough");
  });
});

describe("turnStatus", () => {
  it("is empty when idle with no prior reply", () => {
    expect(turnStatus(false, undefined, "Quail")).toBe("");
  });
  it("is empty when idle but the last turn was the user's", () => {
    expect(turnStatus(false, "user", "Quail")).toBe("");
  });
  it("announces replying while streaming", () => {
    expect(turnStatus(true, "user", "Quail")).toBe("Quail is replying…");
  });
  it("announces replied after an assistant turn lands", () => {
    expect(turnStatus(false, "assistant", "Quail")).toBe("Quail replied.");
  });
  it("threads the venue name through", () => {
    expect(turnStatus(true, undefined, "The Hawthorn")).toBe(
      "The Hawthorn is replying…",
    );
  });
});
