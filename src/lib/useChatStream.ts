"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  ChatMessage,
  ChatStreamEvent,
  QuoteBreakdownDto,
  ToolCallSummary,
} from "@/types/chat";

export interface ActiveQuote {
  packageId: string;
  toolCallId: string;
  dateISO: string;
  guests: number;
  breakdown: QuoteBreakdownDto;
}

interface UseChatStream {
  messages: ChatMessage[];
  quote: ActiveQuote | null;
  isStreaming: boolean;
  error: string | null;
  send: (text: string) => void;
}

// Per-venue conversation bucket. Every venue gets its own; switching venues
// just re-projects the active bucket, it doesn't tear anything down. Streams
// in flight when the user switches keep writing into the venue they belong
// to (the action's venueId is the routing key, not React state).
interface VenueStream {
  messages: ChatMessage[];
  quote: ActiveQuote | null;
  isStreaming: boolean;
  error: string | null;
}

const EMPTY: VenueStream = {
  messages: [],
  quote: null,
  isStreaming: false,
  error: null,
};

type State = Record<string, VenueStream>;

// All actions carry venueId. The reducer is pure — no closures over React
// state, no race conditions on switch, no abort coordination needed.
type Action =
  | { type: "send"; venueId: string; userMessage: ChatMessage }
  | { type: "message_start"; venueId: string; messageId: string }
  | { type: "text_delta"; venueId: string; messageId: string; delta: string }
  | {
      type: "tool_use_start";
      venueId: string;
      messageId: string;
      toolCall: ToolCallSummary;
    }
  | {
      type: "tool_use_end";
      venueId: string;
      messageId: string;
      toolCallId: string;
      status: "ok" | "error";
    }
  | { type: "quote_update"; venueId: string; quote: ActiveQuote }
  | { type: "stream_end"; venueId: string }
  | { type: "error"; venueId: string; message: string };

function reducer(state: State, action: Action): State {
  const cur = state[action.venueId] ?? EMPTY;
  const put = (next: Partial<VenueStream>): State => ({
    ...state,
    [action.venueId]: { ...cur, ...next },
  });

  switch (action.type) {
    case "send":
      return put({
        messages: [...cur.messages, action.userMessage],
        isStreaming: true,
        error: null,
      });

    case "message_start":
      return put({
        messages: [
          ...cur.messages,
          { id: action.messageId, role: "assistant", text: "" },
        ],
      });

    case "text_delta":
      return put({
        messages: cur.messages.map((m) =>
          m.id === action.messageId
            ? { ...m, text: m.text + action.delta }
            : m,
        ),
      });

    case "tool_use_start":
      return put({
        messages: cur.messages.map((m) => {
          if (m.id !== action.messageId) return m;
          return {
            ...m,
            toolCalls: [...(m.toolCalls ?? []), action.toolCall],
          };
        }),
      });

    case "tool_use_end":
      return put({
        messages: cur.messages.map((m) => {
          if (m.id !== action.messageId) return m;
          return {
            ...m,
            toolCalls: (m.toolCalls ?? []).map((tc) =>
              tc.id === action.toolCallId
                ? { ...tc, status: action.status }
                : tc,
            ),
          };
        }),
      });

    case "quote_update":
      return put({ quote: action.quote });

    case "stream_end":
      return put({ isStreaming: false });

    case "error":
      return put({ error: action.message, isStreaming: false });
  }
}

// History sent to the LLM is just the prior user/assistant text turns; tool
// blocks stay server-side. Empty assistant messages (placeholder before any
// tokens land) are filtered so they don't poison the next request.
function toLlmMessages(uiMessages: ChatMessage[]) {
  return uiMessages
    .filter((m) => m.text.length > 0)
    .map((m) => ({ role: m.role, content: m.text }));
}

export function useChatStream(venueId: string): UseChatStream {
  const [streams, dispatch] = useReducer(reducer, {} as State);
  // One AbortController per active venue stream. Lives in a ref so multiple
  // streams can run in parallel across venues; the user just sees the one
  // they're looking at.
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  // Cancel any in-flight streams on unmount only — switching venues no longer
  // aborts; the other venue's stream simply keeps writing into its bucket.
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const c of controllers.values()) c.abort();
      controllers.clear();
    };
  }, []);

  const state = streams[venueId] ?? EMPTY;

  // Closure captures the latest committed `state` via the dep array, so the
  // history we POST always reflects current messages. No ref mirror needed.
  const send = useCallback(
    (text: string) => {
      if (state.isStreaming) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
      };
      dispatch({ type: "send", venueId, userMessage });

      void postAndStream({
        venueId,
        history: toLlmMessages([...state.messages, userMessage]),
        dispatch,
        controllersRef,
      });
    },
    [venueId, state.messages, state.isStreaming],
  );

  return {
    messages: state.messages,
    quote: state.quote,
    isStreaming: state.isStreaming,
    error: state.error,
    send,
  };
}

interface PostArgs {
  venueId: string;
  history: { role: "user" | "assistant"; content: string }[];
  dispatch: React.Dispatch<Action>;
  controllersRef: React.RefObject<Map<string, AbortController>>;
}

async function postAndStream({
  venueId,
  history,
  dispatch,
  controllersRef,
}: PostArgs) {
  // Cancel any prior in-flight stream for *this* venue. Other venues are
  // untouched.
  controllersRef.current.get(venueId)?.abort();
  const controller = new AbortController();
  controllersRef.current.set(venueId, controller);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId, messages: history }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const msg = (await res.text().catch(() => "")) || res.statusText;
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // SSE frames are separated by a blank line. Each frame begins with
    // `data: <json>`; ignore other field names since our server only emits
    // `data:`.
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
        const line = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const payload = line.slice(line.indexOf(":") + 1).trim();
        if (!payload) continue;
        // A malformed frame shouldn't kill the whole stream. Log and skip;
        // the next valid frame will continue updating the UI.
        let event: ChatStreamEvent;
        try {
          event = JSON.parse(payload) as ChatStreamEvent;
        } catch (parseErr) {
          console.warn("useChatStream: dropped malformed SSE frame", parseErr);
          continue;
        }
        applyEvent(event, venueId, dispatch);
      }
    }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    dispatch({
      type: "error",
      venueId,
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    dispatch({ type: "stream_end", venueId });
    if (controllersRef.current.get(venueId) === controller) {
      controllersRef.current.delete(venueId);
    }
  }
}

function applyEvent(
  event: ChatStreamEvent,
  venueId: string,
  dispatch: React.Dispatch<Action>,
) {
  switch (event.kind) {
    case "message_start":
      dispatch({ type: "message_start", venueId, messageId: event.messageId });
      return;

    case "text_delta":
      dispatch({
        type: "text_delta",
        venueId,
        messageId: event.messageId,
        delta: event.delta,
      });
      return;

    case "tool_use_start":
      dispatch({
        type: "tool_use_start",
        venueId,
        messageId: event.messageId,
        toolCall: event.toolCall,
      });
      return;

    case "tool_use_end":
      dispatch({
        type: "tool_use_end",
        venueId,
        messageId: event.messageId,
        toolCallId: event.toolCallId,
        status: event.status,
      });
      return;

    case "quote_update":
      dispatch({
        type: "quote_update",
        venueId,
        quote: {
          packageId: event.packageId,
          toolCallId: event.toolCallId,
          dateISO: event.dateISO,
          guests: event.guests,
          breakdown: event.breakdown,
        },
      });
      return;

    case "message_end":
      // Surfaced by the server; the per-message bookkeeping is handled by
      // text/tool deltas. Nothing to do here today.
      return;

    case "error":
      dispatch({ type: "error", venueId, message: event.message });
      return;
  }
}
