# Google Sheets logging and weekly report

CallCoach AI can log every finished call to a Google Sheet and email the trainer a weekly summary per trainee. This runs on a small Google Apps Script web app ([`apps-script/Code.gs`](../apps-script/Code.gs)).

## Setup

1. Create a Google Sheet, then open **Extensions → Apps Script**.
2. Replace the content of `Code.gs` with [`apps-script/Code.gs`](../apps-script/Code.gs).
3. Optional but recommended: in **Project Settings**, enable *Show "appsscript.json" manifest file in editor*, then replace it with [`apps-script/appsscript.json`](../apps-script/appsscript.json) (Africa/Casablanca time zone, minimal permissions).
4. In **Project Settings → Script Properties**, add:
   - `SECRET`: a long random string, e.g. `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
   - `TRAINER_EMAIL`: the address that receives the weekly report
5. Select `setup` in the editor and click **Run**, then authorise the script. For your own scripts, Google shows an "unverified app" warning: choose **Advanced → Go to (project name)**. `setup` creates the `Sessions` tab and a Monday 08:00 trigger, and is safe to run again.
6. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**. Copy the URL ending in `/exec`.
7. Set `APPS_SCRIPT_WEBHOOK_URL` to that URL and `APPS_SCRIPT_SECRET` to the same secret, in `.env.local` and in your hosting provider's environment variables.

## Check

- Opening the `/exec` URL returns `{"ok":true,"service":"callcoach-logger"}`.
- A finished call adds a row to the `Sessions` tab, and the report shows « Résultat transmis à ton formateur ».
- Running `sendTestReport` in the editor sends the weekly email immediately.

After editing `Code.gs`, publish a new version (**Deploy → Manage deployments → Edit → New version**) so the URL stays the same.

## What is stored

One row per call: timestamp, session id, first name, scenario, difficulty, number of messages, duration, final mood, outcome, the four scores, the overall score, whether the hidden issue was found, and the coaching summary. The conversation itself is never sent.

Requests without the right secret are rejected, rows are validated, the same session is never stored twice, and text that looks like a spreadsheet formula is stored as plain text.
