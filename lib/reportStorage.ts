import { useMemo, useSyncExternalStore } from "react";

import { StoredReportSchema, type LogStatus, type StoredReport } from "./schemas";

// The finished call and its evaluation travel from the simulation to the Rapport page
// through sessionStorage, so the transcript stays in the browser. A module-level
// copy covers browsers where storage is blocked, as long as the tab is not reloaded.

const REPORT_KEY = "callcoach:lastReport";
/** Same-tab change notification ("storage" events only fire in other tabs). */
const REPORT_EVENT = "callcoach:report";
let memoryCopy: string | null = null;

export function saveReport(report: StoredReport): void {
  const raw = JSON.stringify(report);
  memoryCopy = raw;
  try {
    window.sessionStorage.setItem(REPORT_KEY, raw);
  } catch {
    // Storage unavailable: the in-memory copy is used instead.
  }
  window.dispatchEvent(new Event(REPORT_EVENT));
}

function readReport(): string | null {
  try {
    return window.sessionStorage.getItem(REPORT_KEY) ?? memoryCopy;
  } catch {
    return memoryCopy;
  }
}

function parseReport(raw: string): StoredReport | null {
  try {
    const parsed = StoredReportSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Records the Google Sheets logging result on the stored report, if it is still the latest one. */
export function setReportLogStatus(sessionId: string, logStatus: LogStatus): void {
  const raw = readReport();
  const report = raw === null ? null : parseReport(raw);
  if (report?.sessionId === sessionId) saveReport({ ...report, logStatus });
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(REPORT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(REPORT_EVENT, onChange);
  };
}

export type StoredReportState = { status: "loading" } | { status: "missing" } | { status: "ready"; report: StoredReport };

/** The last report of this tab; "loading" during server rendering. */
export function useStoredReport(): StoredReportState {
  const raw = useSyncExternalStore(subscribe, readReport, () => undefined);
  return useMemo((): StoredReportState => {
    if (raw === undefined) return { status: "loading" };
    const report = raw === null ? null : parseReport(raw);
    return report ? { status: "ready", report } : { status: "missing" };
  }, [raw]);
}
