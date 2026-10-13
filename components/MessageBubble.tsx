import type { ChatMessage } from "@/lib/schemas";

interface MessageBubbleProps {
  message: ChatMessage;
  speaker: string;
}

/** One chat message: customer on the left, agent (trainee) on the right. */
export function MessageBubble({ message, speaker }: MessageBubbleProps) {
  const isAgent = message.role === "agent";

  return (
    <li className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[75%] ${
          isAgent
            ? "rounded-br-md bg-accent text-accent-foreground"
            : "rounded-bl-md border border-border bg-surface"
        }`}
      >
        <p className={`text-xs font-semibold ${isAgent ? "opacity-80" : "text-muted"}`}>{speaker}</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
      </div>
    </li>
  );
}
