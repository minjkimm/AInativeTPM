/* External API payloads are intentionally decoded at the connector boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type SourceName = "Jira" | "Smartsheet" | "Google Sheets" | "Documents";

export type SourceMode = "live" | "sample" | "fallback";

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
      budget: Number(values["Quarter Budget"]),
      committed: Number(values.Committed),
      actual: Number(values.Actual),
      forecast: Number(values.Forecast),
      owner: values.Owner,
      status: values.Status,
      note: values.Note,
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
      due: issue.fields.duedate || "2026-08-10",
      severity: severityFromJira(issue.fields),
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
    }));

  const budgetAttention: AttentionItem[] = budgets
    .filter((row) => row.status !== "On Track")
    .map((row) => ({
      id: `BUD-${row.pillar}`,
      source: "Google Sheets" as const,
      pillar: row.pillar,
      title: `${row.pillar} budget forecast`,
      reason: row.note,
      nextAction: row.forecast > row.budget ? "Review forecast and offset options" : "Confirm remaining-quarter plan",
      owner: row.owner,
      due: "2026-08-10",
      severity: row.forecast > row.budget * 1.05 ? "Watch" as const : "Review" as const,
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
  const response = await fetch("/api/ops", { cache: "no-store" });
  if (!response.ok) throw new Error("The operations API could not be loaded.");
  return response.json();
}
