import { afterEach, describe, expect, it, vi } from "vitest";
import { drainSsePayloads, postAndStream, type Action } from "./useChatStream";

describe("drainSsePayloads", () => {
  it("extracts a single complete frame", () => {
    const { payloads, remainder } = drainSsePayloads(
      `data: {"kind":"text_delta"}\n\n`,
    );
    expect(payloads).toEqual([`{"kind":"text_delta"}`]);
    expect(remainder).toBe("");
  });

  it("extracts multiple frames out of one chunk", () => {
    const buf =
      `data: {"a":1}\n\n` +
      `data: {"b":2}\n\n` +
      `data: {"c":3}\n\n`;
    const { payloads, remainder } = drainSsePayloads(buf);
    expect(payloads).toEqual([`{"a":1}`, `{"b":2}`, `{"c":3}`]);
    expect(remainder).toBe("");
  });

  it("keeps a partial trailing frame in the remainder", () => {
    const buf = `data: {"a":1}\n\ndata: {"b":`;
    const { payloads, remainder } = drainSsePayloads(buf);
    expect(payloads).toEqual([`{"a":1}`]);
    expect(remainder).toBe(`data: {"b":`);
  });

  it("returns no payloads and full buffer when no complete frame is present", () => {
    const buf = `data: {"a":`;
    const { payloads, remainder } = drainSsePayloads(buf);
    expect(payloads).toEqual([]);
    expect(remainder).toBe(buf);
  });

  it("drops empty-data frames (keepalives, trailing newlines)", () => {
    const buf = `data:\n\ndata: {"a":1}\n\n`;
    const { payloads } = drainSsePayloads(buf);
    expect(payloads).toEqual([`{"a":1}`]);
  });

  it("ignores non-data fields in the same frame", () => {
    // SSE allows other fields (event:, id:, retry:); the server doesn't emit
    // them but the parser must not choke if it sees them on the wire.
    const buf = `event: text\ndata: {"a":1}\nid: 99\n\n`;
    const { payloads } = drainSsePayloads(buf);
    expect(payloads).toEqual([`{"a":1}`]);
  });

  it("preserves JSON colons in the payload", () => {
    // Naive `split(":")[1]` would lose everything after the first colon
    // inside the JSON. slice(indexOf) gets it right.
    const buf = `data: {"venueId":"the-quail","ratio":0.22}\n\n`;
    const { payloads } = drainSsePayloads(buf);
    expect(payloads).toEqual([`{"venueId":"the-quail","ratio":0.22}`]);
  });

  it("tolerates both `data: x` and `data:x`", () => {
    // Per spec, exactly one optional leading space after the colon is
    // consumed — both spellings should produce the same payload.
    const buf1 = `data: {"a":1}\n\n`;
    const buf2 = `data:{"a":1}\n\n`;
    expect(drainSsePayloads(buf1).payloads).toEqual([`{"a":1}`]);
    expect(drainSsePayloads(buf2).payloads).toEqual([`{"a":1}`]);
  });

  it("accepts CRLF blank-line separators", () => {
    // Some proxies normalize \n to \r\n on the wire. We must still find
    // the frame boundary or the stream stalls until the connection closes.
    const buf = `data: {"a":1}\r\n\r\ndata: {"b":2}\r\n\r\n`;
    const { payloads, remainder } = drainSsePayloads(buf);
    expect(payloads).toEqual([`{"a":1}`, `{"b":2}`]);
    expect(remainder).toBe("");
  });

  it("concatenates multiple data: lines in one frame with \\n", () => {
    // Per spec, multi-line values are split across consecutive data:
    // fields and joined by \n. A naive single-line-only parser would
    // silently drop everything after the first data: line.
    const buf = `data: line one\ndata: line two\n\n`;
    const { payloads } = drainSsePayloads(buf);
    expect(payloads).toEqual([`line one\nline two`]);
  });

  it("joins two empty data: lines into a single '\\n' payload", () => {
    // Asymmetric counterpart to the single-empty-line keepalive case:
    // one empty data: drops, two empties join to "\n" (spec-correct).
    // Pins behavior so a future "drop whitespace-only payloads" tweak
    // can't silently change the contract.
    const buf = `data:\ndata:\n\n`;
    const { payloads } = drainSsePayloads(buf);
    expect(payloads).toEqual([`\n`]);
  });

  it("handles a chunk boundary in the middle of a frame", () => {
    // Simulate reading two TCP chunks: stitch them and re-drain. The
    // remainder from the first call carries the partial frame forward.
    const chunkA = `data: {"a":1}\n\nda`;
    const chunkB = `ta: {"b":2}\n\n`;
    const r1 = drainSsePayloads(chunkA);
    const r2 = drainSsePayloads(r1.remainder + chunkB);
    expect(r1.payloads).toEqual([`{"a":1}`]);
    expect(r2.payloads).toEqual([`{"b":2}`]);
    expect(r2.remainder).toBe("");
  });
});

// The stop button contract: aborting the AbortController for the active
// venue must (1) unwind fetch cleanly, (2) NOT dispatch an error (the
// AbortError is the expected exit, not a failure), (3) fire stream_end so
// `isStreaming` flips back to false, (4) clean up the controller map and
// the in-flight flag so a subsequent send can proceed.
describe("postAndStream — abort contract", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("controller.abort() produces stream_end with no error dispatch", async () => {
    // fetch hangs until the caller's signal aborts, then rejects with
    // AbortError — same shape as the real Fetch API contract.
    globalThis.fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as typeof globalThis.fetch;

    const dispatched: Action[] = [];
    const dispatch: React.Dispatch<Action> = (a) => {
      dispatched.push(a);
    };
    const controllersRef = { current: new Map<string, AbortController>() };
    const inFlightRef = { current: new Set<string>(["v-1"]) };

    // postAndStream is async, so the body runs synchronously up to the first
    // `await fetch(...)` — the controller is registered before the call
    // returns. No need to yield here; if a future refactor inserts an await
    // before the registration, this assertion should fail loudly.
    const promise = postAndStream({
      venueId: "v-1",
      history: [],
      dispatch,
      controllersRef,
      inFlightRef,
    });
    expect(controllersRef.current.has("v-1")).toBe(true);

    controllersRef.current.get("v-1")!.abort();
    await promise;

    expect(dispatched.map((a) => a.type)).toEqual(["stream_end"]);
    expect(controllersRef.current.size).toBe(0);
    expect(inFlightRef.current.size).toBe(0);
  });
});
