# ProofGive

A transparent giving ledger built for **Kar Se Khar**, for DEV's Weekend Challenge: Generosity Edition — built with Google Gemini.

## The problem

Donors rarely know if their money reaches the people it was meant for. NGOs, in turn, often can't prove fair distribution without publishing personal details about vulnerable beneficiaries — which trades one harm for another.

## The idea

ProofGive keeps two things separate on purpose:

- **Public ledger:** every donation, and every distribution *batch* (a label, a beneficiary count, a total amount) — visible to anyone, and it's the only thing ever sent to Gemini.
- **Private notes:** the actual beneficiary names and per-person amounts. These are typed into a text box that is read only to confirm it isn't empty — the content itself is never stored in the app's state and never leaves the browser.

Two AI features run entirely on the redacted public ledger:
1. **Transparency report** — Gemini writes a short donor-facing summary from the aggregate numbers.
2. **Ask about this campaign** — a donor Q&A box. Gemini answers from the public ledger only, and is instructed to say plainly when something (like a specific beneficiary's details) isn't published, rather than guessing.

No backend, no database — everything lives in the page's memory for the session.

## Running it locally

1. Get a Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (sign in with any Google account, click "Create API key").
2. Serve this folder with any static server:
   ```
   npx serve .
   ```
3. Open the page, paste your API key into "Connect Gemini" and save it.
4. Log a donation and a distribution batch (put something in the private notes box too, just to see it's never reflected anywhere).
5. Click "Generate report" and try asking a question in the Q&A box — including one that pokes at private details, to see the privacy guardrail respond.

## Two views

- **Donor view** (default): public ledger, the generated transparency report, and the Q&A box. This is what you'd share with donors.
- **Admin view**: click "Admin" in the header and enter the passcode (`karsekhar-admin` — change this in `app.js` before sharing the repo or deploying it). Only from here can you connect the Gemini key, log donations, record distributions, and generate the report.

This passcode is a demo-level separation, not real security — anyone who reads the source can see it. Good enough to show the intended roles for the challenge; a real deployment would need actual authentication.

## Note on the API key

The key is entered once in the Admin view and saved to this browser's `localStorage` — it is **never written into the code and never committed to the repo**. Don't check any file containing a real key into git, and don't paste API keys into chat tools, issue trackers, or anywhere else that logs text. For a real production deployment, move the key behind a small server-side proxy instead of calling Gemini directly from the browser.

## Logo

`assets/logo.png` is Kar Se Khar's own logo, included for branding on both views.


## What's next

- A lightweight login for Kar Se Khar staff to log entries, separate from the public-facing report/Q&A view.
- Export the generated report as a shareable image or PDF for social posts.
- Multi-campaign view once there's more than one active drive.
