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

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if (char === "\n" && !quoted) {
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows.map((cells) => cells.map((cell) => cell.replace(/^\uFEFF/, "").trim()));
}

async function fetchPublicSheet(sheetId: string, sheetName: string, range: string): Promise<string[][]> {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
  url.searchParams.set("tqx", "out:csv");
  url.searchParams.set("sheet", sheetName);
  url.searchParams.set("range", range);
  const response = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`Public Sheet returned ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  const csv = await response.text();
  if (contentType.includes("text/html") || /^\s*<!doctype html/i.test(csv)) {
    throw new Error("Sheet is not published for read-only web access");
  }
  const table = parseCsv(csv);
  if (table.length < 2) throw new Error("Published Sheet did not return a header and data rows");
  return table;
}

function recordsFromTable(table: string[][]): Record<string, string>[] {
  const [headers, ...rows] = table;
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function dateOnly(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function numeric(value: string): number {
  const negative = /^\(.*\)$/.test(value.trim());
  const parsed = Number(value.replace(/[$,%(),\s]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

async function withFallback(
  name: SourceName,
  file: keyof typeof samples,
  isConfigured: boolean,
  loadLive: () => Promise<any>,
  count: (data: any) => number,
  successMode: SourceHealth["mode"] = "live",
  successStatus = "Authenticated API loaded successfully",
): Promise<ConnectorResult> {
  if (!isConfigured) {
    const data = sample(file);
    return { data, health: health(name, "sample", "Credentials not configured; using synthetic data", count(data)) };
  }

  try {
    const data = await loadLive();
    return { data, health: health(name, successMode, successStatus, count(data)) };
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
  const demoSheetId = process.env.JIRA_DEMO_SHEET_ID;
  const useVendorApi = Boolean(base && email && token);
  return withFallback("Jira", "jira-issues.json", Boolean(useVendorApi || demoSheetId), async () => {
    if (!useVendorApi) {
      const table = await fetchPublicSheet(
        demoSheetId!,
        process.env.JIRA_DEMO_SHEET_NAME || "Dashboard Contract",
        process.env.JIRA_DEMO_RANGE || "A8:M16",
      );
      const issues = recordsFromTable(table).map((row) => ({
        key: row["Issue Key"],
        fields: {
          summary: row.Title,
          status: { name: row.Status || "To Do" },
          priority: { name: row.Priority || "Medium" },
          assignee: row.Owner ? { displayName: row.Owner } : null,
          duedate: dateOnly(row["Due Date"]),
          labels: row.Labels.split(",").map((label) => label.trim()).filter(Boolean),
          customfield_pillar: row.Pillar || "Cross-pillar",
          customfield_decision: row["Decision Needed"] || "Confirm owner and resolution date",
          customfield_reason: row["Risk Reason"] || `${row.Status || "Open"} operational risk`,
        },
      }));
      return { total: issues.length, issues, summary: {
        blocked: issues.filter((issue) => issue.fields.status.name === "Blocked").length,
        overdue: issues.filter((issue) => issue.fields.duedate && issue.fields.duedate < new Date().toISOString().slice(0, 10)).length,
      }};
    }

    const fields = [
      "summary", "status", "priority", "assignee", "duedate", "labels",
      process.env.JIRA_PILLAR_FIELD,
      process.env.JIRA_DECISION_FIELD,
      process.env.JIRA_REASON_FIELD,
    ].filter(Boolean).join(",");
    const url = new URL(`${base!}/rest/api/3/search/jql`);
    url.searchParams.set("jql", process.env.JIRA_JQL || "labels = weekly-review ORDER BY priority DESC, duedate ASC");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("fields", fields);
    const response = await fetch(url, { headers: { Authorization: `Basic ${btoa(`${email!}:${token!}`)}`, Accept: "application/json" } });
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
  }, (data) => data.issues.length, useVendorApi ? "live" : "bridge", useVendorApi ? "Authenticated Jira REST API loaded successfully" : "Connected synthetic Jira feed via a read-only Google Sheet");
}

async function smartsheetConnector(): Promise<ConnectorResult> {
  const token = process.env.SMARTSHEET_TOKEN;
  const sheetId = process.env.SMARTSHEET_SHEET_ID;
  const demoSheetId = process.env.SMARTSHEET_DEMO_SHEET_ID;
  const useVendorApi = Boolean(token && sheetId);
  return withFallback("Smartsheet", "smartsheet-activations.json", Boolean(useVendorApi || demoSheetId), async () => {
    if (!useVendorApi) {
      const table = await fetchPublicSheet(
        demoSheetId!,
        process.env.SMARTSHEET_DEMO_SHEET_NAME || "Activation Calendar",
        process.env.SMARTSHEET_DEMO_RANGE || "A7:O15",
      );
      const titles = table[0].slice(0, 9);
      const columns = titles.map((title, index) => ({ id: index + 1, title }));
      const rows = recordsFromTable(table).map((row, rowIndex) => ({
        id: 1001 + rowIndex,
        cells: titles.map((title, index) => ({
          columnId: index + 1,
          value: title === "Date" ? dateOnly(row[title]) : title === "Budget" ? numeric(row[title]) : row[title],
        })),
      }));
      return { totalRowCount: Number(process.env.SMARTSHEET_DEMO_TOTAL || 112), columns, rows };
    }
    const response = await fetch(`https://api.smartsheet.com/2.0/sheets/${sheetId!}`, { headers: { Authorization: `Bearer ${token!}` } });
    if (!response.ok) throw new Error(`Smartsheet returned ${response.status}`);
    return response.json();
  }, (data) => data.rows.length, useVendorApi ? "live" : "bridge", useVendorApi ? "Authenticated Smartsheet API loaded successfully" : "Connected synthetic Smartsheet feed via a read-only Google Sheet");
}

async function googleSheetsConnector(): Promise<ConnectorResult> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const range = process.env.GOOGLE_BUDGET_RANGE || "FY27 Q3 Budget!A1:H";
  const publicSheetId = process.env.GOOGLE_BUDGET_SHEET_ID;
  const useValuesApi = Boolean(sheetId && apiKey);
  return withFallback("Google Sheets", "google-sheet-budget.json", Boolean(useValuesApi || publicSheetId), async () => {
    if (useValuesApi) {
      const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`);
      url.searchParams.set("key", apiKey!);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);
      return response.json();
    }
    const table = await fetchPublicSheet(
      publicSheetId!,
      process.env.GOOGLE_BUDGET_SHEET_NAME || "FY27 Q3 Budget",
      process.env.GOOGLE_BUDGET_PUBLIC_RANGE || "A1:H7",
    );
    const values = [table[0], ...table.slice(1).map((row) => row.map((value, index) => index >= 1 && index <= 4 ? String(numeric(value)) : value))];
    return { range: "FY27 Q3 Budget!A1:H7", majorDimension: "ROWS", values };
  }, (data) => Math.max((data.values?.length || 1) - 1, 0), "live", useValuesApi ? "Authenticated Google Sheets Values API loaded successfully" : "Connected read-only budget Sheet");
}

async function documentsConnector(): Promise<ConnectorResult> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  const registerSheetId = process.env.GOOGLE_ASSET_REGISTER_SHEET_ID;
  const useDriveApi = Boolean(folderId && token);
  return withFallback("Documents", "playbook-documents.json", Boolean(useDriveApi || registerSheetId), async () => {
    if (!useDriveApi) {
      const table = await fetchPublicSheet(
        registerSheetId!,
        process.env.GOOGLE_ASSET_REGISTER_SHEET_NAME || "Asset Register",
        process.env.GOOGLE_ASSET_REGISTER_RANGE || "A1:N39",
      );
      const rows = recordsFromTable(table);
      const allDocuments = rows.map((row) => ({
        id: row["Drive URL"].match(/\/d\/([^/]+)/)?.[1] || row["Asset ID"],
        title: row.Title,
        pillar: row.Pillar,
        owner: row.Owner,
        status: row.Status,
        lastReviewed: dateOnly(row["Last Reviewed"]),
        nextReview: dateOnly(row["Next Review"]),
        useCount90d: numeric(row["Uses · 90d"]),
        dashboardSample: row["Dashboard Sample"] === "Yes",
      }));
      return {
        source: "Google Drive asset register",
        totalDocuments: allDocuments.length,
        documentsNeedingReview: allDocuments.filter((doc) => doc.status === "Needs Update" || doc.status === "In Review").length,
        documents: allDocuments.filter((doc) => doc.dashboardSample).map(({ dashboardSample: _sample, ...doc }) => doc),
      };
    }
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId!}' in parents and trashed = false`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("fields", "files(id,name,modifiedTime,owners(displayName),appProperties)");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token!}` } });
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
  }, (data) => data.totalDocuments, useDriveApi ? "live" : "bridge", useDriveApi ? "Authenticated Google Drive API loaded successfully" : "Connected playbook register via a read-only Google Sheet");
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
