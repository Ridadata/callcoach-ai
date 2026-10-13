import type { Metadata } from "next";

import { ReportView } from "@/components/ReportView";

export const metadata: Metadata = {
  title: "Rapport de coaching",
};

/** The report is read client-side from sessionStorage: the transcript never leaves the browser except for /api/evaluate. */
export default function ReportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <ReportView />
    </main>
  );
}
