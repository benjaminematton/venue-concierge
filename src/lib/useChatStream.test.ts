import { describe, expect, it } from "vitest";
import { drainSsePayloads } from "./useChatStream";

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

  it("trims leading whitespace after the colon", () => {
    // The protocol allows "data: value" with one space; the parser should
    // tolerate it (and zero spaces too).
    const buf1 = `data: {"a":1}\n\n`;
    const buf2 = `data:{"a":1}\n\n`;
    expect(drainSsePayloads(buf1).payloads).toEqual([`{"a":1}`]);
    expect(drainSsePayloads(buf2).payloads).toEqual([`{"a":1}`]);
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
