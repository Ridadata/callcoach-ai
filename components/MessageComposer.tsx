import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { MAX_AGENT_MESSAGE_CHARS } from "@/lib/schemas";

interface MessageComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

/** Reply input: Enter sends, Shift+Enter adds a new line, 600 characters max. */
export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasDisabled = useRef(disabled);
  const id = useId();
  const canSubmit = !disabled && draft.trim().length > 0 && draft.length <= MAX_AGENT_MESSAGE_CHARS;
  const nearLimit = draft.length >= MAX_AGENT_MESSAGE_CHARS - 50;

  // Give focus back to the input once the customer has answered.
  useEffect(() => {
    if (wasDisabled.current && !disabled) textareaRef.current?.focus();
    wasDisabled.current = disabled;
  }, [disabled]);

  function submit() {
    if (!canSubmit) return;
    onSend(draft.trim());
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="border-t border-border bg-surface px-4 pb-4 pt-3"
    >
      <label htmlFor={`${id}-input`} className="sr-only">
        Ta réponse au client
      </label>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          id={`${id}-input`}
          rows={2}
          maxLength={MAX_AGENT_MESSAGE_CHARS}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby={`${id}-hint ${id}-count`}
          placeholder={disabled ? "Patiente…" : "Écris ta réponse au client…"}
          className="block max-h-40 min-h-[3rem] flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-base leading-relaxed placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Envoyer
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
        <p id={`${id}-hint`} className="hidden sm:block">
          Entrée pour envoyer · Maj + Entrée pour aller à la ligne
        </p>
        <p id={`${id}-count`} className={`ml-auto tabular-nums ${nearLimit ? "font-semibold text-danger" : ""}`}>
          {draft.length} / {MAX_AGENT_MESSAGE_CHARS}
          <span className="sr-only"> caractères</span>
        </p>
      </div>
    </form>
  );
}
