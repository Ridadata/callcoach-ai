import { useMemo, useSyncExternalStore } from "react";

import { StoredReportSchema, type StoredReport } from "./schemas";

// The finished call and its evaluation travel from the simulation to the Rapport page
// through sessionStorage, so the transcript stays in the browser. A module-level
// copy covers browsers where storage is blocked, as long as the tab is not reloaded.

const REPORT_KEY = "callcoach:lastReport";
let memoryCopy: string | null = null;

export function saveReport(report: StoredReport): void {
  const raw = JSON.stringify(report);
  memoryCopy = raw;
  try {
    window.sessionStorage.setItem(REPORT_KEY, raw);
  } catch {
    // Storage unavailable: the in-memory copy is used instead.
  }
}

function readReport(): string | null {
  try {
    return window.sessionStorage.getItem(REPORT_KEY) ?? memoryCopy;
  } catch {
    return memoryCopy;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export type StoredReportState = { status: "loading" } | { status: "missing" } | { status: "ready"; report: StoredReport };

function parseReport(raw: string): StoredReport | null {
  try {
    const parsed = StoredReportSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The last report of this tab; "loading" during server rendering. */
export function useStoredReport(): StoredReportState {
  const raw = useSyncExternalStore(subscribe, readReport, () => undefined);
  return useMemo((): StoredReportState => {
    if (raw === undefined) return { status: "loading" };
    const report = raw === null ? null : parseReport(raw);
    return report ? { status: "ready", report } : { status: "missing" };
  }, [raw]);
}
