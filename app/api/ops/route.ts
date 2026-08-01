/* External vendor payloads are intentionally decoded at this connector boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeOpsPayload, type SourceHealth, type SourceName } from "../../ops-data";
import jiraSample from "../../../public/mock/jira-issues.json";
import smartsheetSample from "../../../public/mock/smartsheet-activations.json";
import budgetSample from "../../../public/mock/google-sheet-budget.json";
import documentsSample from "../../../public/mock/playbook-documents.json";

export const dynamic = "force-dynamic";

type ConnectorResult = {
  data: any;
  health: SourceHealth;
};

function health(name: SourceName, mode: SourceHealth["mode"], status: string, recordCount: number): SourceHealth {
  return { name, mode, status, recordCount, refreshedAt: new Date().toISOString() };
}

const samples = {
  "jira-issues.json": jiraSample,
  "smartsheet-activations.json": smartsheetSample,
  "google-sheet-budget.json": budgetSample,
  "playbook-documents.json": documentsSample,
} as const;

function sample(file: keyof typeof samples) {
  return samples[file];
}

async function withFallback(
  name: SourceName,
  file: keyof typeof samples,
  isConfigured: boolean,
  loadLive: () => Promise<any>,
  count: (data: any) => number,
): Promise<ConnectorResult> {
  if (!isConfigured) {
    const data = sample(file);
    return { data, health: health(name, "sample", "Credentials not configured; using synthetic data", count(data)) };
  }

  try {
    const data = await loadLive();
    return { data, health: health(name, "live", "Authenticated API loaded successfully", count(data)) };
  } catch (error) {
    const data = sample(file);
    const reason = error instanceof Error ? error.message : "Unknown connector error";
    return { data, health: health(name, "fallback", `Live API failed; sample fallback active (${reason})`, count(data)) };
  }
}

async function jiraConnector(): Promise<ConnectorResult> {
  const base = process.env.JIRA_BASE_URL?.replace(/\/$/, "");
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  return withFallback("Jira", "jira-issues.json", Boolean(base && email && token), async () => {
    const fields = [
      "summary", "status", "priority", "assignee", "duedate", "labels",
      process.env.JIRA_PILLAR_FIELD,
      process.env.JIRA_DECISION_FIELD,
      process.env.JIRA_REASON_FIELD,
    ].filter(Boolean).join(",");
    const url = new URL(`${base}/rest/api/3/search/jql`);
    url.searchParams.set("jql", process.env.JIRA_JQL || "labels = weekly-review ORDER BY priority DESC, duedate ASC");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("fields", fields);
    const response = await fetch(url, { headers: { Authorization: `Basic ${btoa(`${email}:${token}`)}`, Accept: "application/json" } });
    if (!response.ok) throw new Error(`Jira returned ${response.status}`);
    const payload = await response.json();
    const pillarField = process.env.JIRA_PILLAR_FIELD;
    const decisionField = process.env.JIRA_DECISION_FIELD;
    const reasonField = process.env.JIRA_REASON_FIELD;
    const issues = payload.issues.map((issue: any) => ({ ...issue, fields: {
      ...issue.fields,
      labels: issue.fields.labels || [],
      customfield_pillar: pillarField ? issue.fields[pillarField] : "Cross-pillar",
      customfield_decision: decisionField ? issue.fields[decisionField] : "Confirm owner and resolution date",
      customfield_reason: reasonField ? issue.fields[reasonField] : `${issue.fields.status?.name || "Open"} operational risk`,
    }}));
    return { ...payload, total: payload.total ?? issues.length, issues, summary: {
      blocked: issues.filter((issue: any) => issue.fields.status?.name === "Blocked").length,
      overdue: issues.filter((issue: any) => issue.fields.duedate && issue.fields.duedate < new Date().toISOString().slice(0, 10)).length,
    }};
  }, (data) => data.issues.length);
}

async function smartsheetConnector(): Promise<ConnectorResult> {
  const token = process.env.SMARTSHEET_TOKEN;
  const sheetId = process.env.SMARTSHEET_SHEET_ID;
  return withFallback("Smartsheet", "smartsheet-activations.json", Boolean(token && sheetId), async () => {
    const response = await fetch(`https://api.smartsheet.com/2.0/sheets/${sheetId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Smartsheet returned ${response.status}`);
    return response.json();
  }, (data) => data.rows.length);
}

async function googleSheetsConnector(): Promise<ConnectorResult> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const range = process.env.GOOGLE_BUDGET_RANGE || "FY27 Q3 Budget!A1:H";
  return withFallback("Google Sheets", "google-sheet-budget.json", Boolean(sheetId && apiKey), async () => {
    const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`);
    url.searchParams.set("key", apiKey!);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);
    return response.json();
  }, (data) => Math.max((data.values?.length || 1) - 1, 0));
}

async function documentsConnector(): Promise<ConnectorResult> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  return withFallback("Documents", "playbook-documents.json", Boolean(folderId && token), async () => {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("fields", "files(id,name,modifiedTime,owners(displayName),appProperties)");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Google Drive returned ${response.status}`);
    const payload = await response.json();
    const documents = payload.files.map((file: any) => ({
      id: file.id,
      title: file.name,
      pillar: file.appProperties?.pillar || "Cross-pillar",
      owner: file.owners?.[0]?.displayName || "Unassigned",
      status: file.appProperties?.status || "Current",
      lastReviewed: file.modifiedTime?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      nextReview: file.appProperties?.nextReview || "2026-10-01",
      useCount90d: Number(file.appProperties?.useCount90d || 0),
    }));
    return {
      source: "Google Drive API",
      totalDocuments: documents.length,
      documentsNeedingReview: documents.filter((doc: any) => doc.status === "Needs Update" || doc.status === "In Review").length,
      documents,
    };
  }, (data) => data.documents.length);
}

export async function getOpsData() {
  const [jira, smartsheet, budget, documents] = await Promise.all([
    jiraConnector(),
    smartsheetConnector(),
    googleSheetsConnector(),
    documentsConnector(),
  ]);
  const sources = [jira.health, smartsheet.health, budget.health, documents.health];
  return normalizeOpsPayload(jira.data, smartsheet.data, budget.data, documents.data, sources);
}

export async function GET() {
  try {
    return Response.json(await getOpsData(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown operations API error";
    return Response.json({ error: message }, { status: 500 });
  }
}
