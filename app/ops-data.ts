/* External API payloads are intentionally decoded at the connector boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { syntheticActivationOutcomes } from "./outcome-sample";
import { syntheticGpuSeeds } from "./gpu-seeding-sample";
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
  activationId: string;
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

export type ActivationOutcome = {
  id: string;
  activationId: string;
  activation: string;
  completionDate: string;
  originRegion: string;
  pillar: string;
  audience: string;
  strategicOutcome: string;
  successMetric: string;
  unit: string;
  target: number;
  actual: number;
  outcomeStatus: string;
  cost: number;
  costPerOutcome: number;
  reusableAsset: string;
  regionsReusing: string[];
  learning: string;
  recommendation: string;
  playbook: string;
  owner: string;
  synthetic: boolean;
};

export type GpuSeed = {
  id: string;
  activationId: string;
  outcomeId: string;
  quarter: string;
  activation: string;
  region: string;
  pillar: string;
  audience: string;
  gpuProduct: string;
  deliveryMode: string;
  qualifiedRequests: number;
  approvedDevelopers: number;
  deliveredDevelopers: number;
  requestedGpuHours: number;
  grantedGpuHours: number;
  consumedGpuHours: number;
  utilization: number;
  timeToFirstWorkloadDays: number;
  prototypesCompleted: number;
  productionPilots: number;
  followOnRequests: number;
  seedValue: number;
  supportCost: number;
  lifecycleStatus: string;
  recommendation: string;
  decisionReason: string;
  synthetic: boolean;
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
  gpuSeedBudget: number;
  gpuSeedForecast: number;
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
  outcomes: ActivationOutcome[];
  gpuSeeds: GpuSeed[];
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
      activationId: String(values["Activation ID"] || `ACT-${String(row.id).padStart(3, "0")}`),
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
      gpuSeedBudget: numericValue(values["GPU Seeding Budget"]),
      gpuSeedForecast: numericValue(values["GPU Seeding Forecast"]),
    };
  });

  const outcomes: ActivationOutcome[] = (sheet.outcomes || []).map((row: any) => ({
    id: String(row.id),
    activationId: String(row.activationId || ""),
    activation: String(row.activation),
    completionDate: String(row.completionDate),
    originRegion: String(row.originRegion),
    pillar: String(row.pillar),
    audience: String(row.audience),
    strategicOutcome: String(row.strategicOutcome),
    successMetric: String(row.successMetric),
    unit: String(row.unit),
    target: numericValue(row.target),
    actual: numericValue(row.actual),
    outcomeStatus: String(row.outcomeStatus),
    cost: numericValue(row.cost),
    costPerOutcome: numericValue(row.costPerOutcome),
    reusableAsset: String(row.reusableAsset),
    regionsReusing: Array.isArray(row.regionsReusing) ? row.regionsReusing : String(row.regionsReusing || "").split(",").map((item) => item.trim()).filter(Boolean),
    learning: String(row.learning),
    recommendation: String(row.recommendation),
    playbook: String(row.playbook),
    owner: String(row.owner),
    synthetic: Boolean(row.synthetic),
  }));

  const gpuSeeds: GpuSeed[] = (sheet.gpuSeeds || []).map((row: any) => ({
    id: String(row.id),
    activationId: String(row.activationId),
    outcomeId: String(row.outcomeId || ""),
    quarter: String(row.quarter),
    activation: String(row.activation),
    region: String(row.region),
    pillar: String(row.pillar),
    audience: String(row.audience),
    gpuProduct: String(row.gpuProduct),
    deliveryMode: String(row.deliveryMode),
    qualifiedRequests: numericValue(row.qualifiedRequests),
    approvedDevelopers: numericValue(row.approvedDevelopers),
    deliveredDevelopers: numericValue(row.deliveredDevelopers),
    requestedGpuHours: numericValue(row.requestedGpuHours),
    grantedGpuHours: numericValue(row.grantedGpuHours),
    consumedGpuHours: numericValue(row.consumedGpuHours),
    utilization: numericValue(row.utilization),
    timeToFirstWorkloadDays: numericValue(row.timeToFirstWorkloadDays),
    prototypesCompleted: numericValue(row.prototypesCompleted),
    productionPilots: numericValue(row.productionPilots),
    followOnRequests: numericValue(row.followOnRequests),
    seedValue: numericValue(row.seedValue),
    supportCost: numericValue(row.supportCost),
    lifecycleStatus: String(row.lifecycleStatus),
    recommendation: String(row.recommendation),
    decisionReason: String(row.decisionReason),
    synthetic: Boolean(row.synthetic),
  }));

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
      id: activation.activationId,
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

  const gpuSeedAttention: AttentionItem[] = [...new Set(gpuSeeds.filter((seed) => seed.quarter.includes("Pipeline")).map((seed) => seed.pillar))]
    .map((pillar) => {
      const items = gpuSeeds.filter((seed) => seed.quarter.includes("Pipeline") && seed.pillar === pillar);
      const requested = items.reduce((sum, seed) => sum + seed.requestedGpuHours, 0);
      const granted = items.reduce((sum, seed) => sum + seed.grantedGpuHours, 0);
      const call = items.find((seed) => seed.recommendation === "Approve increase") || items[0];
      return {
        id: `GPU-${pillar}`,
        source: "Smartsheet" as const,
        pillar,
        title: `${pillar} GPU seeding allocation`,
        reason: `${requested.toLocaleString()} requested GPU hours vs ${granted.toLocaleString()} provisionally granted; ${call?.decisionReason || "review demand and evidence"}`,
        nextAction: call?.recommendation === "Approve increase" ? "Approve incremental GPU seeding capacity for the linked Q3 activations" : call?.recommendation || "Review allocation",
        owner: budgets.find((row) => row.pillar === pillar)?.owner || "Unassigned",
        due: budgets.find((row) => row.pillar === pillar)?.decisionDue || "2026-08-14",
        severity: call?.recommendation === "Approve increase" ? "Watch" as const : "Review" as const,
        tags: ["gpu-seeding", "investment"],
      };
    });

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
    attention: [...jiraAttention, ...gpuSeedAttention, ...activationAttention, ...budgetAttention, ...documentAttention],
    activations,
    outcomes,
    gpuSeeds,
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
    return normalizeOpsPayload(jira, { ...smartsheet, outcomes: syntheticActivationOutcomes(), gpuSeeds: syntheticGpuSeeds() }, budget, documents, sources);
  }
}
