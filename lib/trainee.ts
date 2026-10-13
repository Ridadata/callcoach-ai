import { useSyncExternalStore } from "react";

// The trainee's first name lives in sessionStorage only (no backend, no account).
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

const TRAINEE_NAME_KEY = "callcoach:traineeName";

export function saveTraineeName(name: string): void {
  try {
    window.sessionStorage.setItem(TRAINEE_NAME_KEY, name);
  } catch {
    // The name is only a convenience; the simulation works without it.
  }
}

function readTraineeName(): string {
  try {
    return window.sessionStorage.getItem(TRAINEE_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** The stored first name, or "" during server rendering and when none is stored. */
export function useTraineeName(): string {
  return useSyncExternalStore(subscribe, readTraineeName, () => "");
}
