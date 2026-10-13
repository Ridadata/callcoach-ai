/**
 * CallCoach AI — Google Apps Script logger and weekly trainer report.
 *
 * Bound to a Google Sheet. Script Properties required:
 *   SECRET         same value as APPS_SCRIPT_SECRET on the Next.js side
 *   TRAINER_EMAIL  recipient of the weekly report
 *
 * Entry points: setup() once, doPost / doGet (web app), weeklyReport (Monday trigger),
 * sendTestReport() to check the email without waiting for Monday.
 */

const SHEET_NAME = "Sessions";
const TIME_ZONE = "Africa/Casablanca";
const HEADERS = [
  "timestamp",
  "sessionId",
  "traineeName",
  "scenarioId",
  "difficulty",
  "turns",
  "durationSec",
  "finalMood",
  "outcome",
  "empathie",
  "ecoute",
  "resolution",
  "professionnalisme",
  "overall",
  "hiddenIssueFound",
  "summary",
];
const CRITERIA = ["empathie", "ecoute", "resolution", "professionnalisme"];
const CRITERION_LABELS = {
  empathie: "Empathie",
  ecoute: "Écoute",
  resolution: "Résolution",
  professionnalisme: "Professionnalisme",
};
const DIFFICULTIES = ["facile", "normal", "difficile"];
const OUTCOMES = ["resolved", "hang_up", "ended_by_agent", "max_turns"];
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Setup

/** Creates the Sessions tab and the Monday 08:00 trigger. Safe to run several times. */
function setup() {
  getSessionsSheet_();

  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === "weeklyReport";
  });
  // Keep exactly one weekly trigger, even if earlier runs created duplicates.
  triggers.slice(1).forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  if (triggers.length === 0) {
    ScriptApp.newTrigger("weeklyReport")
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(8)
      .inTimezone(TIME_ZONE)
      .create();
  }

  const props = PropertiesService.getScriptProperties();
  ["SECRET", "TRAINER_EMAIL"].forEach(function (key) {
    if (!props.getProperty(key)) {
      Logger.log("Attention : la propriété de script " + key + " n'est pas définie.");
    }
  });
  Logger.log("Configuration terminée : onglet « " + SHEET_NAME + " » et déclencheur du lundi 8 h prêts.");
}

function getSessionsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ---------------------------------------------------------------------------
// Web app

/** Health check. */
function doGet() {
  return json_({ ok: true, service: "callcoach-logger" });
}

/** Appends one session row. The secret travels in the body: web apps cannot read custom headers. */
function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json_({ ok: false, error: "invalid JSON" });
  }

  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || body.secret !== secret) {
    return json_({ ok: false, error: "unauthorized" });
  }

  const error = validateSession_(body);
  if (error) {
    return json_({ ok: false, error: error });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSessionsSheet_();
    if (hasSession_(sheet, body.sessionId)) {
      return json_({ ok: true, duplicate: true });
    }
    sheet.appendRow(toRow_(body));
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function validateSession_(body) {
  const required = ["sessionId", "timestamp", "traineeName", "scenarioId", "summary"];
  for (let i = 0; i < required.length; i++) {
    if (typeof body[required[i]] !== "string" || body[required[i]].trim() === "") {
      return "missing field: " + required[i];
    }
  }
  if (isNaN(new Date(body.timestamp).getTime())) return "invalid timestamp";
  if (DIFFICULTIES.indexOf(body.difficulty) === -1) return "invalid difficulty";
  if (OUTCOMES.indexOf(body.outcome) === -1) return "invalid outcome";
  if (!isIntegerBetween_(body.turns, 0, 14)) return "invalid turns";
  if (!isIntegerBetween_(body.durationSec, 0, 4 * 3600)) return "invalid durationSec";
  if (!isIntegerBetween_(body.finalMood, -2, 2)) return "invalid finalMood";
  if (!isIntegerBetween_(body.overall, 0, 100)) return "invalid overall";
  if (typeof body.hiddenIssueFound !== "boolean") return "invalid hiddenIssueFound";
  if (!body.scores || typeof body.scores !== "object") return "missing scores";
  for (let j = 0; j < CRITERIA.length; j++) {
    if (!isIntegerBetween_(body.scores[CRITERIA[j]], 1, 5)) return "invalid score: " + CRITERIA[j];
  }
  return null;
}

function isIntegerBetween_(value, min, max) {
  return typeof value === "number" && Math.floor(value) === value && value >= min && value <= max;
}

function hasSession_(sheet, sessionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet.getRange(2, 2, lastRow - 1, 1).createTextFinder(sessionId).matchEntireCell(true).findNext() !== null;
}

function toRow_(body) {
  return [
    new Date(body.timestamp),
    body.sessionId,
    safeText_(body.traineeName),
    body.scenarioId,
    body.difficulty,
    body.turns,
    body.durationSec,
    body.finalMood,
    body.outcome,
    body.scores.empathie,
    body.scores.ecoute,
    body.scores.resolution,
    body.scores.professionnalisme,
    body.overall,
    body.hiddenIssueFound,
    safeText_(body.summary),
  ];
}

/** Stops user text such as "=IMPORTXML(...)" from being run as a spreadsheet formula. */
function safeText_(value) {
  const text = String(value).trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Weekly report

/** Emails the trainer a per-trainee summary of the last 7 days (run by the Monday trigger). */
function weeklyReport() {
  const to = PropertiesService.getScriptProperties().getProperty("TRAINER_EMAIL");
  if (!to) {
    throw new Error("Propriété de script TRAINER_EMAIL manquante.");
  }

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * DAY_MS);
  const previousStart = new Date(now.getTime() - 14 * DAY_MS);
  const sessions = readSessions_();
  const current = sessions.filter(function (s) {
    return s.timestamp >= weekStart && s.timestamp <= now;
  });
  const previous = sessions.filter(function (s) {
    return s.timestamp >= previousStart && s.timestamp < weekStart;
  });

  const subject = "CallCoach AI — Rapport hebdomadaire du " + Utilities.formatDate(now, TIME_ZONE, "dd/MM/yyyy");
  const period =
    "du " + Utilities.formatDate(weekStart, TIME_ZONE, "dd/MM") + " au " + Utilities.formatDate(now, TIME_ZONE, "dd/MM/yyyy");

  if (current.length === 0) {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: "Aucune session cette semaine (" + period + ").",
      htmlBody: emailShell_("<p style=\"margin:0\">Aucune session cette semaine (" + period + ").</p>"),
    });
    return;
  }

  const rows = summarizeByTrainee_(current, previous);
  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: plainTextReport_(rows, current.length, period),
    htmlBody: htmlReport_(rows, current.length, period),
  });
}

/** Runs the weekly report right now. */
function sendTestReport() {
  weeklyReport();
}

function readSessions_() {
  const sheet = getSessionsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const col = {};
  HEADERS.forEach(function (header, index) {
    col[header] = index;
  });
  return values
    .map(function (row) {
      const scores = {};
      CRITERIA.forEach(function (id) {
        scores[id] = Number(row[col[id]]);
      });
      return {
        timestamp: row[col.timestamp] instanceof Date ? row[col.timestamp] : new Date(row[col.timestamp]),
        traineeName: String(row[col.traineeName]).replace(/^'/, "").trim() || "Anonyme",
        overall: Number(row[col.overall]),
        hiddenIssueFound: row[col.hiddenIssueFound] === true || String(row[col.hiddenIssueFound]).toUpperCase() === "TRUE",
        scores: scores,
      };
    })
    .filter(function (session) {
      return !isNaN(session.timestamp.getTime());
    });
}

function groupByTrainee_(sessions) {
  const groups = {};
  sessions.forEach(function (session) {
    const key = session.traineeName.toLowerCase();
    if (!groups[key]) groups[key] = { name: session.traineeName, sessions: [] };
    groups[key].sessions.push(session);
  });
  return groups;
}

function average_(numbers) {
  return numbers.reduce(function (sum, n) {
    return sum + n;
  }, 0) / numbers.length;
}

function summarizeByTrainee_(current, previous) {
  const currentGroups = groupByTrainee_(current);
  const previousGroups = groupByTrainee_(previous);

  return Object.keys(currentGroups)
    .map(function (key) {
      const group = currentGroups[key];
      const list = group.sessions;
      const averageOverall = average_(list.map(function (s) { return s.overall; }));
      const before = previousGroups[key];
      const previousAverage = before ? average_(before.sessions.map(function (s) { return s.overall; })) : null;

      let weakest = null;
      CRITERIA.forEach(function (id) {
        const avg = average_(list.map(function (s) { return s.scores[id]; }));
        if (weakest === null || avg < weakest.average) weakest = { id: id, average: avg };
      });

      const found = list.filter(function (s) { return s.hiddenIssueFound; }).length;
      return {
        name: group.name,
        sessions: list.length,
        averageOverall: Math.round(averageOverall),
        change: previousAverage === null ? null : Math.round(averageOverall - previousAverage),
        weakest: CRITERION_LABELS[weakest.id] + " (" + weakest.average.toFixed(1).replace(".", ",") + "/5)",
        hiddenIssueRate: Math.round((found / list.length) * 100),
      };
    })
    .sort(function (a, b) {
      return b.sessions - a.sessions || a.name.localeCompare(b.name, "fr");
    });
}

function formatChange_(change) {
  if (change === null) return "—";
  if (change > 0) return "+" + change;
  if (change < 0) return "−" + Math.abs(change);
  return "=";
}

function escapeHtml_(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell_(content) {
  return (
    "<div style=\"font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:14px;line-height:1.5;max-width:720px\">" +
    "<h2 style=\"margin:0 0 4px;color:#4338ca\">CallCoach AI — Rapport hebdomadaire</h2>" +
    content +
    "<p style=\"margin:24px 0 0;color:#64748b;font-size:12px\">Scores indicatifs à visée de coaching. " +
    "Scénarios fictifs ; aucune conversation n'est conservée.</p></div>"
  );
}

function htmlReport_(rows, total, period) {
  const th = "style=\"text-align:left;padding:8px 10px;border-bottom:2px solid #c7d2fe;background:#eef2ff\"";
  const td = "style=\"padding:8px 10px;border-bottom:1px solid #e2e8f0\"";
  const header = ["Conseiller", "Sessions", "Score moyen", "Évolution vs semaine précédente", "Critère le plus faible", "Problème caché découvert"]
    .map(function (label) {
      return "<th " + th + ">" + label + "</th>";
    })
    .join("");
  const body = rows
    .map(function (row) {
      return (
        "<tr>" +
        "<td " + td + "><strong>" + escapeHtml_(row.name) + "</strong></td>" +
        "<td " + td + ">" + row.sessions + "</td>" +
        "<td " + td + ">" + row.averageOverall + "/100</td>" +
        "<td " + td + ">" + formatChange_(row.change) + "</td>" +
        "<td " + td + ">" + escapeHtml_(row.weakest) + "</td>" +
        "<td " + td + ">" + row.hiddenIssueRate + " %</td>" +
        "</tr>"
      );
    })
    .join("");
  return emailShell_(
    "<p style=\"margin:0 0 16px;color:#475569\">Période " + period + " · " + total + " session" + (total > 1 ? "s" : "") +
      " · " + rows.length + " conseiller" + (rows.length > 1 ? "s" : "") + "</p>" +
      "<table style=\"border-collapse:collapse;width:100%\"><thead><tr>" + header + "</tr></thead><tbody>" + body + "</tbody></table>",
  );
}

function plainTextReport_(rows, total, period) {
  const lines = rows.map(function (row) {
    return (
      "- " + row.name + " : " + row.sessions + " session(s), score moyen " + row.averageOverall + "/100 (" +
      formatChange_(row.change) + "), critère le plus faible : " + row.weakest +
      ", problème caché découvert : " + row.hiddenIssueRate + " %"
    );
  });
  return "CallCoach AI — Rapport hebdomadaire\nPériode " + period + " · " + total + " session(s)\n\n" + lines.join("\n");
}
