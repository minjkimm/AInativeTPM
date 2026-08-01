# Developer Ecosystem Operations Control Tower

An interview portfolio prototype for an AI-native Technical Program Manager. It turns calendar, risk, budget, and playbook data into an exception queue and a decision-focused Monday operating review.

It also includes an executive copilot. Without credentials, the copilot provides deterministic demo answers from the dashboard. With NVIDIA NIM environment variables configured, it sends the same bounded operating context to Nemotron through the server-side chat endpoint.

The repository is designed to work in two modes:

- **Synthetic mode:** runs immediately with realistic, clearly labeled dummy data.
- **Connected mode:** reads Jira, Smartsheet, Google Sheets, and Google Drive through authenticated server-side connectors.

## What the dashboard answers

1. What changed or became risky?
2. What needs a cross-team decision now?
3. What is the recommended call?
4. Who owns the next step, by when, and which source system must change?

It intentionally does not create one blended score across unlike pillars. Each source remains authoritative for its own domain.

## Architecture

```mermaid
flowchart LR
  J[Jira risks] --> A[/api/ops]
  S[Smartsheet calendar] --> A
  G[Google Sheets budget] --> A
  D[Drive playbooks] --> A
  A --> N[Normalized operating schema]
  N --> UI[Dashboard]
  N --> M[Monday decision brief]
  N --> C[Executive copilot]
  C --> NM[NVIDIA Nemotron via NIM]
  M --> GH[GitHub Actions schedule]
  GH --> SL[Slack webhook]
```

API credentials stay on the server. The browser receives only normalized operational fields. If a connector is not configured or fails, `/api/ops` uses the matching synthetic file and reports `sample` or `fallback` source health.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run build
DASHBOARD_URL=http://localhost:3000 npm run digest
```

## Connect real sources

Copy `.env.example` to `.env.local` and add only the systems you can access. An unconfigured source continues to use the synthetic fallback.

| Source | Required settings | API |
|---|---|---|
| Jira | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Jira Cloud REST API v3 |
| Smartsheet | `SMARTSHEET_TOKEN`, `SMARTSHEET_SHEET_ID` | Smartsheet API 2.0 |
| Google Sheets | `GOOGLE_SHEET_ID`, `GOOGLE_SHEETS_API_KEY` | Sheets Values API v4 |
| Google Drive | `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_DRIVE_ACCESS_TOKEN` | Drive Files API v3 |
| NVIDIA Nemotron | `NVIDIA_NIM_BASE_URL`, `NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_MODEL` | OpenAI-compatible NIM Chat Completions |

For Jira, optional field-ID settings map a company’s custom pillar, decision, and reason fields. For production Google Drive access, replace the short-lived token demo with an approved OAuth or service-account flow.

## Monday delivery

`.github/workflows/monday-ops-digest.yml` runs at 8:15 AM Pacific every Monday and can also be triggered manually. Add these GitHub Actions secrets:

- `DASHBOARD_URL`: the deployed dashboard root.
- `SLACK_WEBHOOK_URL`: the approved incoming webhook.

Without the Slack secret, `npm run digest` prints a preview and sends nothing.

## Main files

- `app/page.tsx` — dashboard views and decision brief.
- `app/api/ops/route.ts` — authenticated connectors and sample fallback.
- `app/api/chat/route.ts` — executive Q&A, grounded context, Nemotron connector, and demo fallback.
- `app/ops-data.ts` — common schema and normalization logic.
- `public/mock/*.json` — synthetic Jira, Smartsheet, Sheets, and document data.
- `scripts/refresh-and-deliver.mjs` — digest generator and Slack delivery.
- `.github/workflows/monday-ops-digest.yml` — scheduled operating rhythm.
- `.env.example` — connector configuration contract; contains no secrets.

## Hosting

The current demo is published publicly with ChatGPT Sites. For independent source control and deployment, use GitHub plus a host that supports server routes and secret environment variables, such as Cloudflare Workers. GitHub Pages is appropriate only for a static sample-only export because it cannot safely run these authenticated server connectors.

## Data statement

All included people, metrics, risks, budgets, and events are synthetic. The repository contains no NVIDIA data or credentials.
