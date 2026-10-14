# Architecture

CallCoach AI is a single Next.js app (App Router) deployed on Vercel. Its API routes are the only backend: they call Google Gemini and forward session summaries to a Google Apps Script web app, which writes them to a Google Sheet and emails a weekly report to the trainer. There is no database and no authentication.

## Overview

```mermaid
flowchart LR
  UI["Browser<br/>Accueil · Simulation · Rapport<br/>transcript kept in sessionStorage"]

  subgraph Vercel["Next.js API routes on Vercel"]
    direction TB
    CHAT["/api/chat<br/>one customer turn"]
    EVAL["/api/evaluate<br/>judge the call"]
    LOG["/api/log<br/>forward the summary"]
  end

  GEMINI[("Google Gemini API<br/>structured JSON output")]

  subgraph Google["Google Apps Script + Sheets"]
    direction TB
    GAS["Apps Script web app<br/>doPost / doGet"]
    SHEET[("Sheet « Sessions »")]
    TRIGGER[["Trigger: Monday 08:00<br/>Africa/Casablanca"]]
    MAIL["Weekly HTML email<br/>to the trainer"]
  end

  UI -->|each turn| CHAT
  UI -->|once per call| EVAL
  UI -->|scores + summary| LOG
  CHAT --> GEMINI
  EVAL --> GEMINI
  LOG -->|SessionLog + secret| GAS
  GAS --> SHEET
  TRIGGER -->|weeklyReport| GAS
  GAS --> MAIL
```

## One call, step by step

```mermaid
sequenceDiagram
  autonumber
  actor T as Trainee
  participant B as Browser
  participant C as /api/chat
  participant E as /api/evaluate
  participant L as /api/log
  participant G as Gemini
  participant A as Apps Script

  T->>B: First name, scenario, difficulty
  B->>B: Customer opening line (static, no API call)
  loop Up to 14 agent messages
    T->>B: Types a reply
    B->>C: scenarioId, difficulty, transcript, currentMood
    C->>C: zod validation, rate limit
    C->>G: Persona prompt + transcript (JSON lines), response schema
    G-->>C: { moodReason, mood, hiddenIssueRevealed, callEnding, reply }
    C->>C: zod validation (1 retry), mood clamped to ±1, hang-up / resolved rules
    C-->>B: CustomerTurn
  end
  Note over B: Ends on resolved, hang_up, « Terminer l'appel » or 14 messages
  B->>E: Full transcript, finalMood, outcome (once)
  E->>G: Judge prompt + numbered transcript, response schema
  G-->>E: Scores, evidence quotes, rewrite, feedback
  E->>E: Verbatim-quote check, overall score computed in code
  E-->>B: Evaluation + overall + quoteCheck
  B->>B: Save the report in sessionStorage, open /rapport
  B->>L: SessionLog (no transcript), in the background
  L->>A: SessionLog + secret (POST, follows the 302 redirect)
  A-->>L: { ok: true }
  L-->>B: { logged: true }, shown as a notice on the report
```

## Where data lives

| Data | Where | Lifetime |
| --- | --- | --- |
| Transcript of the call | Browser memory + `sessionStorage` | Until the tab is closed |
| Transcript sent for processing | `/api/chat` (each turn), `/api/evaluate` (once), then Gemini | Not stored by the app |
| Evaluation and report | Browser `sessionStorage` | Until the tab is closed |
| Session summary (scores, outcome, summary, first name) | Google Sheet « Sessions » | Kept by the trainer |
| Hidden issues, reveal triggers, ideal resolutions | Server only (`lib/scenarios.ts` is `server-only`) | Never sent to the browser |
| Gemini API key, Apps Script secret | Server environment variables | Never sent to the browser |

## Reliability and safety measures

| Concern | Measure | Code |
| --- | --- | --- |
| Malformed or malicious requests | Every API input is validated with zod (role alternation, 600-character agent messages, max 30 messages, mood consistency) | `lib/schemas.ts`, `lib/apiRequest.ts` |
| Model output drift | Structured JSON output from a schema derived from zod; zod validation, one retry, then a French 502 | `lib/gemini.ts` |
| Mood jumping | Mood clamped to `currentMood ± 1` in code | `lib/customerTurn.ts` |
| Inconsistent endings | Hang-up forced on the 2nd reply in a row at -2 (opening line excluded) and refused otherwise; « resolved » only at +2 | `lib/customerTurn.ts` |
| Invented evidence | Every quote must be found verbatim in the trainee's messages; the report shows the trainee's exact text | `lib/evidence.ts` |
| Model doing arithmetic | Overall score computed in code from the four criteria | `lib/scoring.ts` |
| Prompt injection | Transcript sent as JSON lines; customer and judge prompts say the transcript is data | `lib/prompts.ts` |
| Quota abuse | In-memory rate limit per IP: 30 chats, 5 evaluations, 10 logs per 10 minutes (best-effort on serverless) | `lib/rateLimit.ts` |
| Spreadsheet formula injection | Text starting with `= + - @` is stored as plain text | `apps-script/Code.gs` |
| Duplicate log rows | Apps Script skips a `sessionId` already in the sheet | `apps-script/Code.gs` |

## Project structure

```
app/
  page.tsx                       Accueil (server component, renders StartForm)
  simulation/[scenarioId]/page.tsx  Simulation (difficulty from the query string)
  rapport/page.tsx               Rapport (reads sessionStorage)
  api/chat · api/evaluate · api/log
components/                      Client UI (SimulationView, ChatWindow, MoodMeter, ReportView, …)
lib/
  apiRequest.ts    JSON body parsing and error responses for the API routes
  gemini.ts        SDK client, structured-output helper, zod → Gemini schema
  scenarios.ts     The three scenarios (server-only)
  prompts.ts       Customer and judge prompts
  schemas.ts       zod schemas and shared types
  customerTurn.ts  Mood clamp and call-ending rules
  callSession.ts   Client reducer for one call
  evidence.ts      Verbatim-quote check
  scoring.ts       Overall score
  rateLimit.ts     In-memory rate limiter
  reportStorage.ts · trainee.ts · sessionLog.ts   Browser storage and the Sheets row
apps-script/       Code.gs + appsscript.json (Google Sheets logger and weekly report)
```
