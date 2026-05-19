"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  ChatStreamEvent,
  QuoteBreakdownDto,
  ToolCallSummary,
} from "@/types/chat";

export interface ActiveQuote {
  venueId: string;
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
  reset: () => void;
}

// Each turn is sent stateless on the LLM history: we POST the prior
// user/assistant text exchange plus the new user message, never the
// underlying tool_use / tool_result blocks. The assistant's text from the
// prior turn carries enough context forward ("I checked, June 15 is open")
// for the next reply, and the API stays simple — no session store.
function toLlmMessages(uiMessages: ChatMessage[]) {
  return uiMessages
    .filter((m) => m.text.length > 0)
    .map((m) => ({ role: m.role, content: m.text }));
}

export function useChatStream(venueId: string): UseChatStream {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quote, setQuote] = useState<ActiveQuote | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setQuote(null);
    setIsStreaming(false);
    setError(null);
  }, []);

  // Reset on venue change so the new venue's voice gets a fresh transcript.
  useEffect(() => {
    reset();
  }, [venueId, reset]);

  // Cancel in-flight stream on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    (text: string) => {
      if (isStreaming) return;
      setError(null);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
      };
      // Capture the prior history at send-time so the POST body sees the
      // user turn we're about to append.
      setMessages((prev) => {
        const next = [...prev, userMessage];
        void postAndStream({
          venueId,
          history: toLlmMessages(next),
          setMessages,
          setQuote,
          setError,
          setIsStreaming,
          abortRef,
        });
        return next;
      });
    },
    [venueId, isStreaming],
  );

  return { messages, quote, isStreaming, error, send, reset };
}

interface PostArgs {
  venueId: string;
  history: { role: "user" | "assistant"; content: string }[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setQuote: React.Dispatch<React.SetStateAction<ActiveQuote | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  abortRef: React.RefObject<AbortController | null>;
}

async function postAndStream({
  venueId,
  history,
  setMessages,
  setQuote,
  setError,
  setIsStreaming,
  abortRef,
}: PostArgs) {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  setIsStreaming(true);

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
    let currentMessageId: string | null = null;

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
        const event = JSON.parse(payload) as ChatStreamEvent;
        currentMessageId = applyEvent(event, currentMessageId, {
          setMessages,
          setQuote,
          setError,
        });
      }
    }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setIsStreaming(false);
    if (abortRef.current === controller) abortRef.current = null;
  }
}

function applyEvent(
  event: ChatStreamEvent,
  currentMessageId: string | null,
  setters: Pick<PostArgs, "setMessages" | "setQuote" | "setError">,
): string | null {
  const { setMessages, setQuote, setError } = setters;

  switch (event.kind) {
    case "message_start":
      setMessages((prev) => [
        ...prev,
        { id: event.messageId, role: "assistant", text: "" },
      ]);
      return event.messageId;

    case "text_delta":
      setMessages((prev) =>
        prev.map((m) =>
          m.id === event.messageId ? { ...m, text: m.text + event.delta } : m,
        ),
      );
      return currentMessageId;

    case "tool_use_start":
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== event.messageId) return m;
          const toolCalls: ToolCallSummary[] = [
            ...(m.toolCalls ?? []),
            event.toolCall,
          ];
          return { ...m, toolCalls };
        }),
      );
      return currentMessageId;

    case "tool_use_end":
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== event.messageId) return m;
          const toolCalls = (m.toolCalls ?? []).map((tc) =>
            tc.id === event.toolCallId
              ? { ...tc, status: event.status }
              : tc,
          );
          return { ...m, toolCalls };
        }),
      );
      return currentMessageId;

    case "quote_update":
      setQuote({
        venueId: event.venueId,
        packageId: event.packageId,
        toolCallId: event.toolCallId,
        dateISO: event.dateISO,
        guests: event.guests,
        breakdown: event.breakdown,
      });
      return currentMessageId;

    case "message_end":
      return null;

    case "error":
      setError(event.message);
      return currentMessageId;
  }
}
