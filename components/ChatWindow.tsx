import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/MessageBubble";
import type { ChatMessage } from "@/lib/schemas";

interface ChatWindowProps {
  messages: ChatMessage[];
  customerName: string;
  agentName: string;
  connecting: boolean;
  pending: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Scrollable conversation: messages, "typing" indicator and error state. */
export function ChatWindow({ messages, customerName, agentName, connecting, pending, error, onRetry }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({ top: container.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages.length, pending, error]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      {connecting && (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted" role="status">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent motion-safe:animate-pulse">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path
                d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="text-sm font-medium">Appel entrant de {customerName}…</p>
        </div>
      )}

      <ol role="log" aria-label="Conversation" className="space-y-4">
        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.ts}-${index}`}
            message={message}
            speaker={message.role === "customer" ? customerName : agentName}
          />
        ))}
      </ol>

      {pending && (
        <div className="mt-4 flex justify-start" role="status">
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-sm text-muted shadow-sm">
            <span className="flex gap-1" aria-hidden="true">
              <span className="size-1.5 animate-typing-dot rounded-full bg-current" />
              <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:150ms]" />
              <span className="size-1.5 animate-typing-dot rounded-full bg-current [animation-delay:300ms]" />
            </span>
            {customerName} écrit…
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="font-medium text-danger">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-lg border border-danger/40 bg-surface px-3 py-1.5 font-semibold text-danger hover:bg-danger-soft"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
