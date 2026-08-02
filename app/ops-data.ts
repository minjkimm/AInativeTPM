/* External API payloads are intentionally decoded at the connector boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type SourceName = "Jira" | "Smartsheet" | "Google Sheets" | "Documents";

export type SourceMode = "live" | "bridge" | "sample" | "fallback";

export type SourceHealth = {
  name: SourceName;
  mode: SourceMode;
  status: string;
  recordCount: number;
  refreshedAt: string;
};

export type AttentionItem = {
  id: string;
  source: SourceName;
  pillar: string;
  title: string;
  reason: string;
  nextAction: string;
  owner: string;
  due: string;
  severity: "Critical" | "Watch" | "Review";
  tags: string[];
};

export type Activation = {
  id: number;
  name: string;
  date: string;
  region: string;
  pillar: string;
  owner: string;
  status: string;
  risk: string;
  nextAction: string;
  budget: number;
};

export type BudgetRow = {
  pillar: string;
  budget: number;
  committed: number;
  actual: number;
  forecast: number;
  owner: string;
  status: string;
  note: string;
  decisionDue: string;
  recommendation: string;
};

export type Playbook = {
  id: string;
  title: string;
  pillar: string;
  owner: string;
  status: string;
  lastReviewed: string;
  nextReview: string;
  useCount90d: number;
};

export type OpsData = {
  attention: AttentionItem[];
  activations: Activation[];
  budgets: BudgetRow[];
  playbooks: Playbook[];
  sources: SourceHealth[];
  totals: {
    jiraItems: number;
    jiraBlocked: number;
    jiraOverdue: number;
    monthlyActivations: number;
    totalPlaybooks: number;
    playbooksNeedingReview: number;
  };
};

type JiraFields = {
  summary: string;
  status: { name: string };
  priority: { name: string };
  assignee: { displayName: string } | null;
  duedate: string | null;
  labels: string[];
  customfield_pillar?: string;
  customfield_decision?: string;
  customfield_reason?: string;
};

function numericValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim();
  const negative = /^\(.*\)$/.test(text);
  const parsed = Number(text.replace(/[$,%(),\s]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function severityFromJira(fields: JiraFields): AttentionItem["severity"] {
  if (fields.status.name === "Blocked" || fields.priority.name === "Highest") return "Critical";
  if (fields.priority.name === "High" || fields.status.name === "Decision Needed") return "Watch";
  return "Review";
}

export function normalizeOpsPayload(
  jira: any,
  sheet: any,
  budgetSheet: any,
  docs: any,
  sources: SourceHealth[],
): OpsData {
  const columnTitles = new Map<number, string>(sheet.columns.map((column: { id: number; title: string }) => [column.id, column.title]));
  const activations: Activation[] = sheet.rows.map((row: { id: number; cells: Array<{ columnId: number; value: string | number }> }) => {
    const values = Object.fromEntries(row.cells.map((cell) => [columnTitles.get(cell.columnId), cell.value]));
    return {
      id: row.id,
      name: String(values.Activation),
      date: String(values.Date),
      region: String(values.Region),
      pillar: String(values.Pillar),
      owner: String(values.Owner),
      status: String(values.Status),
      risk: String(values.Risk),
      nextAction: String(values["Next Action"]),
      budget: Number(values.Budget),
    };
  });

  const [budgetHeader, ...budgetValues] = budgetSheet.values;
  const budgets: BudgetRow[] = budgetValues.map((row: string[]) => {
    const values = Object.fromEntries(budgetHeader.map((header: string, index: number) => [header, row[index]]));
    return {
      pillar: values.Pillar,
      budget: numericValue(values["Quarter Budget"]),
      committed: numericValue(values.Committed),
      actual: numericValue(values.Actual),
      forecast: numericValue(values.Forecast),
      owner: values.Owner,
      status: values.Status,
      note: values.Note,
      decisionDue: values["Decision Due"] || "",
      recommendation: values["Prepared Recommendation"] || "",
    };
  });

  const jiraAttention: AttentionItem[] = jira.issues
    .filter((issue: { fields: JiraFields }) => issue.fields.labels.includes("weekly-review"))
    .map((issue: { key: string; fields: JiraFields }) => ({
      id: issue.key,
      source: "Jira" as const,
      pillar: issue.fields.customfield_pillar || "Cross-pillar",
      title: issue.fields.summary,
      reason: issue.fields.customfield_reason || `${issue.fields.status.name} · ${issue.fields.priority.name} priority`,
      nextAction: issue.fields.customfield_decision || "Confirm owner and resolution date",
      owner: issue.fields.assignee?.displayName || "Unassigned",
      due: issue.fields.duedate || "",
      severity: severityFromJira(issue.fields),
      tags: issue.fields.labels,
    }));

  const activationAttention: AttentionItem[] = activations
    .filter((activation) => activation.status !== "On Track")
    .map((activation) => ({
      id: `ACT-${activation.id}`,
      source: "Smartsheet" as const,
      pillar: activation.pillar,
      title: activation.name,
      reason: activation.risk,
      nextAction: activation.nextAction,
      owner: activation.owner,
      due: activation.date,
      severity: activation.status === "Blocked" ? "Critical" as const : "Watch" as const,
      tags: ["activation", activation.status.toLowerCase().replace(" ", "-")],
    }));

  const budgetAttention: AttentionItem[] = budgets
    .filter((row) => row.status !== "On Track")
    .map((row) => ({
      id: `BUD-${row.pillar}`,
      source: "Google Sheets" as const,
      pillar: row.pillar,
      title: `${row.pillar} budget forecast`,
      reason: row.note,
      nextAction: row.recommendation || (row.forecast > row.budget ? "Review forecast and offset options" : "Confirm remaining-quarter plan"),
      owner: row.owner,
      due: row.decisionDue,
      severity: row.forecast > row.budget * 1.05 ? "Watch" as const : "Review" as const,
      tags: ["budget", "forecast"],
    }));

  const documentAttention: AttentionItem[] = docs.documents
    .filter((doc: Playbook) => doc.status === "Needs Update" || doc.status === "In Review")
    .map((doc: Playbook) => ({
      id: doc.id,
      source: "Documents" as const,
      pillar: doc.pillar,
      title: doc.title,
      reason: `${doc.status}; review date ${doc.nextReview}`,
      nextAction: doc.status === "In Review" ? "Assign final reviewer" : "Update before next linked activation",
      owner: doc.owner,
      due: doc.nextReview,
      severity: "Review" as const,
      tags: ["playbook", "document-review"],
    }));

  return {
    attention: [...jiraAttention, ...activationAttention, ...budgetAttention, ...documentAttention],
    activations,
    budgets,
    playbooks: docs.documents,
    sources,
    totals: {
      jiraItems: jira.total,
      jiraBlocked: jira.summary?.blocked ?? jira.issues.filter((issue: { fields: JiraFields }) => issue.fields.status.name === "Blocked").length,
      jiraOverdue: jira.summary?.overdue ?? 0,
      monthlyActivations: sheet.totalRowCount,
      totalPlaybooks: docs.totalDocuments,
      playbooksNeedingReview: docs.documentsNeedingReview,
    },
  };
}

export async function loadOpsData(): Promise<OpsData> {
  try {
    const response = await fetch("/api/ops", { cache: "no-store" });
    if (!response.ok) throw new Error(`Operations API returned ${response.status}`);
    return response.json();
  } catch {
    const [jiraResponse, smartsheetResponse, budgetResponse, docsResponse] = await Promise.all([
      fetch("/mock/jira-issues.json", { cache: "no-store" }),
      fetch("/mock/smartsheet-activations.json", { cache: "no-store" }),
      fetch("/mock/google-sheet-budget.json", { cache: "no-store" }),
      fetch("/mock/playbook-documents.json", { cache: "no-store" }),
    ]);
    if (![jiraResponse, smartsheetResponse, budgetResponse, docsResponse].every((response) => response.ok)) {
      throw new Error("Neither the operations API nor the packaged sample data could be loaded.");
    }
    const [jira, smartsheet, budget, documents] = await Promise.all([
      jiraResponse.json(),
      smartsheetResponse.json(),
      budgetResponse.json(),
      docsResponse.json(),
    ]);
    const refreshedAt = new Date().toISOString();
    const sources: SourceHealth[] = [
      { name: "Jira", mode: "fallback", status: "Browser fallback active", recordCount: jira.issues.length, refreshedAt },
      { name: "Smartsheet", mode: "fallback", status: "Browser fallback active", recordCount: smartsheet.rows.length, refreshedAt },
      { name: "Google Sheets", mode: "fallback", status: "Browser fallback active", recordCount: Math.max(budget.values.length - 1, 0), refreshedAt },
      { name: "Documents", mode: "fallback", status: "Browser fallback active", recordCount: documents.documents.length, refreshedAt },
    ];
    return normalizeOpsPayload(jira, smartsheet, budget, documents, sources);
  }
}
