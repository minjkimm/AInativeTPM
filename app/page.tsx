"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadOpsData, type AttentionItem, type OpsData } from "./ops-data";

type View = "overview" | "portfolio" | "outcomes" | "meeting" | "copilot" | "sources";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  evidence?: string[];
  mode?: "demo" | "nemotron" | "fallback";
  model?: string;
};

const pillarOrder = [
  "Community",
  "Developer Advocacy",
  "Developer / Agent Experience",
  "Open Models",
  "CUDA",
  "Open Source Foundations",
];

const sourceDetails = [
  { name: "Jira", owns: "Roadmaps, risks, dependencies", endpoint: "Jira REST API v3", cadence: "Every 30 min", tone: "blue" },
  { name: "Smartsheet", owns: "Activation calendar, post-activation results, GPU seeding, and regional learning", endpoint: "Smartsheet Sheets API", cadence: "Every 15 min", tone: "amber" },
  { name: "Google Sheets", owns: "Quarter budget, forecast, and GPU seeding envelope", endpoint: "Google Sheets Values API", cadence: "Daily 07:00", tone: "green" },
  { name: "Documents", owns: "Playbooks, review dates, usage", endpoint: "Google Drive Files API", cadence: "Daily 07:00", tone: "violet" },
];

const suggestedQuestions = [
  "What decisions do executives need to make?",
  "Which activation formats should we stop or change?",
  "Where should GPU seeding investment increase?",
  "How does the activation handbook work?",
  "Where are we over budget?",
  "Which upcoming activations are at risk?",
];

const gpuEvidenceUrl = "https://docs.google.com/spreadsheets/d/1Vym0mUmg24zZeFVkjL10cxS4RQRN8a2wy2L5dmIYBr0/edit#gid=97742788";
const outcomeEvidenceUrl = "https://docs.google.com/spreadsheets/d/1Vym0mUmg24zZeFVkjL10cxS4RQRN8a2wy2L5dmIYBr0/edit#gid=1155916971";

const gpuUseCases: Record<string, string> = {
  Community: "Hosted H100 build labs for developers attending community and partner activations",
  "Open Models": "H200 cloud credits for model evaluation, fine-tuning, and adoption workloads",
  CUDA: "Hosted H100 labs for profiling, porting, and performance-optimization workloads",
  "Open Source Foundations": "A100 credits only for maintainers with a defined compute-backed project",
};

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function money(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(value / 1000)}K`;
}

function gpuProductLabel(value: string) {
  if (value.startsWith("H100")) return "H100 (Hopper GPU)";
  if (value.startsWith("H200")) return "H200 (Hopper GPU, higher memory)";
  return value;
}

function shortDate(value: string) {
  if (!value) return "No source date";
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function reviewStart(data: OpsData) {
  const earliest = [...data.activations].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  if (!earliest) return null;
  const [year, month, day] = earliest.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7));
  return date;
}

function reviewWeek(data: OpsData) {
  const date = reviewStart(data);
  if (!date) return "CURRENT OPERATING REVIEW";
  return `WEEK OF ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date).toUpperCase()} · OPERATING REVIEW`;
}

function severityRank(item: AttentionItem) {
  return item.severity === "Critical" ? 0 : item.severity === "Watch" ? 1 : 2;
}

function isConnectedSource(mode: OpsData["sources"][number]["mode"]) {
  return mode === "live" || mode === "bridge";
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await loadOpsData();
      setData(next);
      setRefreshedAt(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Operations data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const summary = useMemo(() => {
    if (!data) return null;
    const totalBudget = data.budgets.reduce((sum, row) => sum + row.budget, 0);
    const totalForecast = data.budgets.reduce((sum, row) => sum + row.forecast, 0);
    const gpuSeedBudget = data.budgets.reduce((sum, row) => sum + row.gpuSeedBudget, 0);
    const gpuSeedForecast = data.budgets.reduce((sum, row) => sum + row.gpuSeedForecast, 0);
    const completedSeeds = data.gpuSeeds.filter((seed) => seed.lifecycleStatus === "Completed");
    const pipelineSeeds = data.gpuSeeds.filter((seed) => seed.quarter.includes("Pipeline"));
    const historicalGranted = completedSeeds.reduce((sum, seed) => sum + seed.grantedGpuHours, 0);
    const historicalConsumed = completedSeeds.reduce((sum, seed) => sum + seed.consumedGpuHours, 0);
    const historicalUtilization = historicalGranted ? historicalConsumed / historicalGranted : 0;
    const pipelineRequested = pipelineSeeds.reduce((sum, seed) => sum + seed.requestedGpuHours, 0);
    const pipelineGranted = pipelineSeeds.reduce((sum, seed) => sum + seed.grantedGpuHours, 0);
    const approvalSeeds = pipelineSeeds.filter((seed) => seed.recommendation === "Approve increase");
    const holdSeeds = pipelineSeeds.filter((seed) => seed.recommendation !== "Approve increase");
    const approvalRequested = approvalSeeds.reduce((sum, seed) => sum + seed.requestedGpuHours, 0);
    const approvalGranted = approvalSeeds.reduce((sum, seed) => sum + seed.grantedGpuHours, 0);
    const approvalPillars = new Set(approvalSeeds.map((seed) => seed.pillar)).size;
    const prototypes = completedSeeds.reduce((sum, seed) => sum + seed.prototypesCompleted, 0);
    const productionPilots = completedSeeds.reduce((sum, seed) => sum + seed.productionPilots, 0);
    const followOnRequests = completedSeeds.reduce((sum, seed) => sum + seed.followOnRequests, 0);
    const gpuByPillar = pillarOrder.map((pillar) => {
      const history = completedSeeds.filter((seed) => seed.pillar === pillar);
      const pipeline = pipelineSeeds.filter((seed) => seed.pillar === pillar);
      const granted = history.reduce((sum, seed) => sum + seed.grantedGpuHours, 0);
      const consumed = history.reduce((sum, seed) => sum + seed.consumedGpuHours, 0);
      const requestedNext = pipeline.reduce((sum, seed) => sum + seed.requestedGpuHours, 0);
      const grantedNext = pipeline.reduce((sum, seed) => sum + seed.grantedGpuHours, 0);
      const calls = pipeline.map((seed) => seed.recommendation);
      const recommendation = calls.includes("Approve increase") ? "Approve" : calls.includes("Optimize first") ? "Fix first" : "Hold";
      const budget = data.budgets.find((row) => row.pillar === pillar);
      return {
        pillar,
        useCase: gpuUseCases[pillar] || "GPU-backed developer workload",
        pipelineCount: pipeline.length,
        pipelineActivations: pipeline.map((seed) => seed.activation),
        gpuProducts: [...new Set(pipeline.map((seed) => seed.gpuProduct))],
        deliveryModes: [...new Set(pipeline.map((seed) => seed.deliveryMode))],
        utilization: granted ? consumed / granted : 0,
        requestedNext,
        grantedNext,
        prototypes: history.reduce((sum, seed) => sum + seed.prototypesCompleted, 0),
        productionPilots: history.reduce((sum, seed) => sum + seed.productionPilots, 0),
        seedBudget: budget?.gpuSeedBudget || 0,
        seedForecast: budget?.gpuSeedForecast || 0,
        recommendation,
        reason: pipeline[0]?.decisionReason || history[0]?.decisionReason || "No linked evidence",
      };
    });
    const gpuInvestmentCalls = gpuByPillar.filter((row) => row.pipelineCount > 0);
    const gpuNoRequestPillars = gpuByPillar.filter((row) => row.pipelineCount === 0).map((row) => row.pillar);
    const stopOutcomes = data.outcomes.filter((item) => item.recommendation === "Stop");
    const adjustOutcomes = data.outcomes.filter((item) => item.recommendation === "Adjust");
    const scaleOutcomes = data.outcomes.filter((item) => item.recommendation === "Scale");
    const standardizeOutcomes = data.outcomes.filter((item) => item.recommendation === "Standardize");
    const outcomeActions: Record<string, string> = {
      "OUT-009": "Cancel the broad onboarding format and replace it with separate beginner setup and advanced workflow clinics before scheduling another session.",
      "OUT-024": "Cancel the broad open-source office hour and schedule issue-specific maintainer clinics with one owner and due date per issue.",
      "OUT-004": "Add a required follow-up-owner field to the partner evaluation worksheet and assign Diego Ruiz to enforce it for the next preview.",
      "OUT-010": "Replace regional worksheets with one standard template containing workload, evaluation result, account owner, and dated next step for every partner.",
      "OUT-001": "Schedule the Austin Agent Builders Day format in EMEA and APAC using the 90-minute lab guide and one facilitator per 35 developers.",
    };
    const meetingOutcomes = [...stopOutcomes, ...adjustOutcomes.slice(0, 2), ...scaleOutcomes.slice(0, 1)].map((item) => ({
      ...item,
      preparedCall: outcomeActions[item.id] || (item.recommendation === "Stop"
        ? "Cancel this format and replace it with an issue-specific session before adding another date."
        : item.recommendation === "Adjust"
          ? `Update ${item.playbook} with the required field, owner, and approval gate before scheduling the next cohort.`
          : item.recommendation === "Scale"
            ? `Schedule the format in ${item.regionsReusing.join(", ") || "one additional region"} using ${item.reusableAsset}.`
            : `Make ${item.reusableAsset} the default asset in ${item.playbook}.`),
    }));
    const sortedAttention = [...data.attention].sort((a, b) => severityRank(a) - severityRank(b) || (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31"));
    const activationRiskCount = data.activations.filter((item) => item.status !== "On Track").length;
    const start = reviewStart(data);
    const end = start ? new Date(start) : null;
    end?.setDate(end.getDate() + 13);
    const activationRank = (status: string) => status === "Blocked" ? 0 : status === "At Risk" ? 1 : status === "Watch" ? 2 : 3;
    const attentionActivations = [...data.activations]
      .filter((item) => {
        if (item.status === "On Track") return false;
        if (!start || !end) return true;
        const date = new Date(`${item.date}T12:00:00`);
        return date >= start && date <= end;
      })
      .sort((a, b) => activationRank(a.status) - activationRank(b.status) || a.date.localeCompare(b.date))
      .slice(0, 5);
    const seedDecision = sortedAttention.find((item) => item.tags.includes("gpu-seeding"));
    const readinessDecision = sortedAttention.find((item) => item.source === "Jira" && item.tags.includes("readiness"));
    const budgetDecision = sortedAttention
      .filter((item) => item.source === "Google Sheets")
      .sort((a, b) => {
        const budgetA = data.budgets.find((row) => row.pillar === a.pillar);
        const budgetB = data.budgets.find((row) => row.pillar === b.pillar);
        return ((budgetB?.forecast || 0) - (budgetB?.budget || 0)) - ((budgetA?.forecast || 0) - (budgetA?.budget || 0));
      })[0];
    const selected = [seedDecision, readinessDecision, budgetDecision].filter((item): item is AttentionItem => Boolean(item));
    for (const item of sortedAttention) {
      if (selected.length >= 3) break;
      if (!selected.some((selectedItem) => selectedItem.source === item.source && selectedItem.id === item.id)) selected.push(item);
    }
    const decisionItems = selected.slice(0, 3).map((item, index) => ({
      id: String(index + 1).padStart(2, "0"),
      question: item.title,
      why: item.reason,
      call: item.nextAction,
      owner: item.owner,
      due: item.due,
      source: item.source,
      sourceId: item.id,
    }));
    return { totalBudget, totalForecast, gpuSeedBudget, gpuSeedForecast, completedSeeds, pipelineSeeds, historicalUtilization, pipelineRequested, pipelineGranted, approvalSeeds, holdSeeds, approvalRequested, approvalGranted, approvalPillars, prototypes, productionPilots, followOnRequests, gpuInvestmentCalls, gpuNoRequestPillars, stopOutcomes, adjustOutcomes, scaleOutcomes, standardizeOutcomes, meetingOutcomes, sortedAttention, activationRiskCount, attentionActivations, decisionItems };
  }, [data]);

  async function copyBrief() {
    if (!summary) return;
    const text = [
      "DEVELOPER ECOSYSTEM — MONDAY OPERATING REVIEW",
      `Purpose: resolve ${summary.decisionItems.length} highest-ranked cross-team signals; project status remains in the pre-read.`,
      ...summary.decisionItems.map((item) => `${item.id}. ${item.question}\nWHY NOW: ${item.why}\nRECOMMENDATION: ${item.call}\nOWNER: ${item.owner} · DUE: ${item.due}\nEVIDENCE: ${item.source} ${item.sourceId}`),
      "CLOSE: Read back the decision, one owner, one date, and the tracker or playbook that changes.",
    ].join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function askCopilot(prompt = question) {
    const nextQuestion = prompt.trim();
    if (!nextQuestion || chatBusy) return;
    setChatMessages((current) => [...current, { role: "user", content: nextQuestion }]);
    setQuestion("");
    setChatBusy(true);
    setChatError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The copilot could not answer.");
      setChatMessages((current) => [...current, {
        role: "assistant",
        content: payload.answer,
        evidence: payload.evidence,
        mode: payload.mode,
        model: payload.model,
      }]);
    } catch (chatLoadError) {
      setChatError(chatLoadError instanceof Error ? chatLoadError.message : "The copilot could not answer.");
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Developer Ecosystem Operations home">
          <span className="mark">DE</span>
          <span>Developer Ecosystem <b>/ Operations</b></span>
        </a>
        <div className="header-meta">
          <Badge tone={data?.sources.some((source) => isConnectedSource(source.mode)) ? "healthy" : "sample"}>● {data?.sources.some((source) => isConnectedSource(source.mode)) ? "Connected source data" : "Synthetic data · API-ready"}</Badge>
          <span className="updated">{loading ? "Refreshing…" : refreshedAt ? `Refreshed ${refreshedAt}` : "Not refreshed"}</span>
          <button className="refresh-small" onClick={() => void refresh()} disabled={loading} aria-label="Refresh operations data">↻</button>
        </div>
      </header>

      <section className="shell" id="top">
        <div className="intro-row simple-intro">
          <div>
            <p className="eyebrow">{data ? reviewWeek(data) : "CURRENT OPERATING REVIEW"}</p>
            <h1>What needs<br />attention?</h1>
          </div>
          <div className="intro-note">
            <span className="note-index">LIVE</span>
            <p>This dashboard helps leaders turn fragmented activation data into three decisions: what needs attention, what is producing accelerated applications, and where to invest, fix, or stop.</p>
          </div>
        </div>

        <div className="navigation-stack">
          <nav className="view-tabs four-tabs primary-tabs" aria-label="Primary dashboard views">
            {([
              ["overview", "Overview", "attention first"],
              ["portfolio", "Budget", "resource decisions"],
              ["outcomes", "Results + playbook", "repeat, fix, or stop"],
              ["meeting", "Monday review", "decision queue"],
            ] as const).map(([id, label, detail]) => (
              <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} aria-pressed={view === id}>
                <span>{label}</span><small>{detail}</small>
              </button>
            ))}
          </nav>
          <nav className="utility-rail" aria-label="Supporting dashboard tools">
            <span>Supporting tools</span>
            <button className={view === "copilot" ? "active" : ""} onClick={() => setView("copilot")} aria-pressed={view === "copilot"}><b>Executive copilot</b><small>Ask grounded data</small><i>→</i></button>
            <button className={view === "sources" ? "active" : ""} onClick={() => setView("sources")} aria-pressed={view === "sources"}><b>Data sources</b><small>Connection health + lineage</small><i>→</i></button>
          </nav>
        </div>

        {error && <div className="load-error"><b>Data refresh failed.</b> {error} <button onClick={() => void refresh()}>Try again</button></div>}
        {!data && !error && <div className="loading-state">Loading source data…</div>}

        {data && summary && view === "overview" && (
          <div className="view-content">
            <section className="metric-grid ops-metrics executive-metrics" aria-label="Portfolio summary">
              <article className="metric-card primary-metric"><span className="metric-label">Activations needing attention</span><strong>{summary.activationRiskCount}</strong><span className="delta">{summary.attentionActivations.length} prioritized in the next 14 days</span></article>
              <article className="metric-card"><span className="metric-label">Activations this month</span><strong>{data.totals.monthlyActivations}</strong><span className="delta">{summary.activationRiskCount} monthly exceptions</span></article>
              <article className="metric-card"><span className="metric-label">Quarter budget</span><strong>{money(summary.totalBudget)}</strong><span className={`delta ${summary.totalForecast > summary.totalBudget ? "critical-text" : "positive"}`}>Forecast {money(summary.totalForecast)}</span></article>
              <article className="metric-card seed-metric"><span className="metric-label">GPU seeding forecast</span><strong>{money(summary.gpuSeedForecast)}</strong><span className={`delta ${summary.gpuSeedForecast > summary.gpuSeedBudget ? "critical-text" : "positive"}`}>{money(summary.gpuSeedForecast - summary.gpuSeedBudget)} vs plan · {Math.round(summary.historicalUtilization * 100)}% prior utilization</span></article>
              <article className="metric-card outcome-metric"><span className="metric-label">Decisions ready</span><strong>{summary.decisionItems.length}</strong><span className="delta positive">recommendation, owner, and evidence</span></article>
            </section>

            <section className="attention-panel panel">
              <div className="panel-heading">
                <div><p className="eyebrow">NEXT 14 DAYS</p><h2>Activation issues requiring attention</h2></div>
                <Badge tone="neutral">{summary.attentionActivations.length} priorities</Badge>
              </div>
              <div className="attention-table" role="table" aria-label="Activations requiring attention in the next 14 days">
                <div className="attention-row attention-head" role="row"><span>Status</span><span>Activation</span><span>Issue and required action</span><span>Owner</span><span>Date</span></div>
                {summary.attentionActivations.map((item) => (
                  <div className="attention-row" role="row" key={item.activationId}>
                    <div><Badge tone={item.status === "Blocked" ? "critical" : "watch"}>{item.status}</Badge></div>
                    <div><b>{item.name}</b><small>{item.pillar} · {item.region}</small></div>
                    <div><p>{item.risk}</p><strong>Next: {item.nextAction}</strong></div>
                    <div><b>{item.owner}</b></div>
                    <div><b>{shortDate(item.date)}</b></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel proxy-panel">
              <div className="panel-heading proxy-heading">
                <div><p className="eyebrow">WEEKLY GOAL CHECK</p><h2>Did each activation type achieve its leading goal?</h2></div>
                <div className="north-star"><span>North Star</span><b>Accelerated applications</b><small>software built and shipped on NVIDIA</small></div>
              </div>
              <p className="proxy-explainer">Latest matured cohort for each measurement window. Attendance and cost are context only; neither determines success.</p>
              <div className="proxy-table" role="table" aria-label="Weekly activation proxy status">
                <div className="proxy-row proxy-head" role="row"><span>Activation type</span><span>Primary proxy</span><span>This period</span><span>Goal achieved?</span></div>
                {data.activationProxies.map((proxy) => (
                  <div className="proxy-row" role="row" key={proxy.id}>
                    <div><b>{proxy.activationType}</b><small>{proxy.funnelStage}</small><em>{proxy.attendance ? `${proxy.attendance.toLocaleString()} attendance · ` : ""}{money(proxy.cost)} cost</em></div>
                    <div><b>{proxy.primaryProxy}</b><small>{proxy.measurementWindow} window · Decision: {proxy.decision}</small></div>
                    <div><strong>{proxy.actualLabel}</strong><small>Target {proxy.targetLabel}</small></div>
                    <div><Badge tone={proxy.achieved ? "healthy" : "watch"}>{proxy.achieved ? "Achieved" : "Needs work"}</Badge><small>Quarterly validation: {proxy.quarterlyReview}</small></div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}

        {data && summary && view === "portfolio" && (
          <div className="view-content portfolio-view">
            <section className="section-hero compact-hero">
              <div><p className="eyebrow">BUDGET + GPU CAPACITY</p><h2>Where should we<br />move or add resources?</h2></div>
              <p>Start with named GPU-seeding decisions, then review the pillar forecast. Activation readiness stays on Overview so this page answers one question: where should leadership invest or make a tradeoff?</p>
            </section>

            <section className="panel seed-panel">
              <div className="panel-heading seed-heading"><div><p className="eyebrow">ACTIVATION-LINKED INVESTMENT</p><h2>Where should GPU seeding change?</h2></div><a className="evidence-link" href={gpuEvidenceUrl} target="_blank" rel="noreferrer">View source data ↗</a></div>
              <div className="seed-summary-grid">
                <article><span>Additional budget approval</span><strong>{money(summary.gpuSeedForecast - summary.gpuSeedBudget)}</strong><small>{money(summary.gpuSeedForecast)} forecast vs {money(summary.gpuSeedBudget)} approved plan</small></article>
                <article><span>Requests ready to approve</span><strong>{summary.approvalSeeds.length}</strong><small>named activation cohorts across {summary.approvalPillars} pillars</small></article>
                <article><span>Additional GPU hours</span><strong>{(summary.approvalRequested - summary.approvalGranted).toLocaleString()}</strong><small>gap for requests that meet the approval threshold</small></article>
                <article><span>Requests on hold</span><strong>{summary.holdSeeds.length}</strong><small>need stronger workload or utilization evidence</small></article>
              </div>
              <div className="seed-decision-list">
                {summary.gpuInvestmentCalls.map((call) => (
                  <article key={call.pillar}>
                    <Badge tone={call.recommendation === "Approve" ? "healthy" : call.recommendation === "Fix first" ? "watch" : "neutral"}>{call.recommendation}</Badge>
                    <div><h3>{call.pillar} · {call.pipelineCount} named requests</h3><p>{call.useCase}</p><small>{call.pipelineActivations.join(" · ")} · {call.gpuProducts.map(gpuProductLabel).join(", ")} · {call.deliveryModes.join(", ")}</small></div>
                    <div className="seed-rationale"><b>Q4 decision rationale</b><p>{call.recommendation === "Approve" ? "Meets the seeding-change criteria: prior utilization cleared the 75% threshold, the cohort produced working prototypes, and named Q4 demand exceeds provisional capacity." : call.recommendation === "Fix first" ? "Does not yet meet the approval gate: demand exists, but setup or support readiness must be corrected before adding Q4 capacity." : "Does not meet the seeding-change criteria: utilization is below the 75% threshold or the workload-to-prototype evidence is incomplete. Keep the Q4 allocation unchanged."}</p><small>Evidence: {Math.round(call.utilization * 100)}% utilization · {call.prototypes} prototypes · {(call.requestedNext - call.grantedNext).toLocaleString()} additional hours requested</small></div>
                  </article>
                ))}
              </div>
              <div className="seed-method"><span><b>Approve</b> means authorize the incremental Q4 GPU hours for the named activation cohorts.</span><span><b>Hold</b> means keep Q4 capacity unchanged until the request meets the evidence gate.</span><span><b>No Q4 request:</b> {summary.gpuNoRequestPillars.join(" · ")}.</span></div>
            </section>

            <section className="panel portfolio-panel budget-panel">
              <div className="panel-heading"><div><p className="eyebrow">Q3 FORECAST · GOOGLE SHEETS</p><h2>Budget by pillar</h2></div><div className="budget-total"><span>Plan {money(summary.totalBudget)}</span><b>Forecast {money(summary.totalForecast)}</b></div></div>
              <div className="budget-table">
                {data.budgets.map((row) => {
                  const actualPercent = Math.round(row.actual / row.budget * 100);
                  const forecastPercent = Math.round(row.forecast / row.budget * 100);
                  return <div className="budget-row" key={row.pillar}>
                    <div><b>{row.pillar}</b><small>{row.owner}</small></div>
                    <div className="budget-bar"><i style={{ width: `${Math.min(actualPercent, 100)}%` }} /><em style={{ left: `${Math.min(forecastPercent, 100)}%` }} /></div>
                    <span>Actual {money(row.actual)}</span><span>Forecast {forecastPercent}%</span><Badge tone={row.status === "On Track" ? "healthy" : "watch"}>{row.status}</Badge>
                  </div>;
                })}
              </div>
              <div className="budget-legend"><span><i /> Actual spend</span><span><em /> Forecast position</span><span>100% = approved budget</span></div>
            </section>

          </div>
        )}

        {data && summary && view === "outcomes" && (
          <div className="view-content outcomes-view">
            <section className="section-hero outcome-hero">
              <div><p className="eyebrow">MONDAY EVIDENCE REVIEW</p><h2>What do we repeat,<br />fix, or stop?</h2></div>
              <p>A post-activation result is a developer action—not attendance. Each record uses one named behavior, its target and actual count, delivery cost, the observed learning, and the operating change required before the next activation.</p>
            </section>

            <section className="outcome-score-grid decision-score-grid" aria-label="Activation decisions from completed evidence">
              <article className="stop-score"><span>Do not repeat</span><strong>{summary.stopOutcomes.length}</strong><small>formats whose developer action missed the bar</small></article>
              <article><span>Fix before repeating</span><strong>{summary.adjustOutcomes.length}</strong><small>next cohort requires a named operating change</small></article>
              <article><span>Expand to a region</span><strong>{summary.scaleOutcomes.length}</strong><small>evidence supports a controlled regional reuse</small></article>
              <article><span>Make the default</span><strong>{summary.standardizeOutcomes.length}</strong><small>approved asset becomes standard practice</small></article>
            </section>

            <section className="panel outcome-meeting-queue">
              <div className="panel-heading"><div><p className="eyebrow">DECISIONS FOR THIS REVIEW</p><h2>Start with the formats that need a call</h2></div><a className="evidence-link" href={outcomeEvidenceUrl} target="_blank" rel="noreferrer">Open result register ↗</a></div>
              <div className="outcome-decision-list">
                {summary.meetingOutcomes.map((item) => (
                  <article key={item.id}>
                    <div className="outcome-call"><Badge tone={item.recommendation === "Stop" ? "critical" : item.recommendation === "Adjust" ? "watch" : "healthy"}>{item.recommendation === "Stop" ? "Do not repeat" : item.recommendation === "Adjust" ? "Fix first" : "Expand"}</Badge><small>{item.id}</small></div>
                    <div className="outcome-subject"><h3>{item.activation}</h3><p>{item.pillar} · {item.originRegion} · {item.owner}</p><small>{item.strategicOutcome}</small></div>
                    <div className="outcome-proof"><span>{item.successMetric}</span><b>{item.actual} <small>actual</small> / {item.target} <small>required</small></b><p>{money(item.cost)} delivery cost</p></div>
                    <div className="outcome-action"><span>Action item</span><p>{item.preparedCall}</p><small>Playbook to update: {item.playbook}</small></div>
                  </article>
                ))}
              </div>
            </section>

          </div>
        )}

        {data && summary && view === "meeting" && (
          <div className="view-content meeting-view">
            <section className="section-hero meeting-hero">
              <div><p className="eyebrow">MONDAY · 30 MINUTES</p><h2>Decisions,<br />not status updates.</h2><p>The dashboard is the pre-read. The meeting handles only cross-team choices, escalations, and changes to owners or resources.</p></div>
              <div className="meeting-actions"><span><b>{summary.decisionItems.length}</b> calls ready</span><button className="copy-button" onClick={copyBrief}>{copied ? "Copied ✓" : "Copy meeting brief"}</button></div>
            </section>

            <section className="agenda-bar">
              <div><b>5 min</b><span>Confirm the {summary.decisionItems.length}-item agenda<br />and decision order</span></div><div><b>20 min</b><span>Decide the {summary.decisionItems.length} ranked calls<br />shown below</span></div><div><b>5 min</b><span>Confirm the owner, due date,<br />and update on each card</span></div><p>These are meeting timeboxes, not item counts. Project-by-project status stays asynchronous.</p>
            </section>

            <div className="decision-list">
              {summary.decisionItems.map((item) => (
                <article className="decision-card" key={item.id}>
                  <div className="decision-number">{item.id}</div>
                  <div className="decision-main"><p className="eyebrow">DECISION REQUIRED</p><h2>{item.question}</h2><div className="why-box"><span>Why now</span><p>{item.why}</p></div><div className="call-box"><span>Prepared recommendation</span><p>{item.call}</p></div></div>
                  <div className="decision-meta"><span>Owner</span><b>{item.owner}</b><span>Due</span><b>{shortDate(item.due)}</b><span>Evidence</span><b>{item.source} · {item.sourceId}</b></div>
                </article>
              ))}
            </div>

            <section className="meeting-output">
              <div><p className="eyebrow">MEETING OUTPUT</p><h2>Every decision leaves a trace.</h2></div>
              <div><span>01</span><p><b>Decision</b><br />What was chosen and why</p></div><div><span>02</span><p><b>Owner</b><br />One accountable person</p></div><div><span>03</span><p><b>Date</b><br />Result and escalation trigger</p></div><div><span>04</span><p><b>System update</b><br />Tracker, budget, or playbook</p></div>
            </section>
          </div>
        )}

        {data && view === "copilot" && (
          <div className="view-content copilot-view">
            <section className="copilot-hero">
              <div>
                <p className="eyebrow">EXECUTIVE COPILOT · NEMOTRON-READY</p>
                <h2>Ask the<br />operating data.</h2>
              </div>
              <div>
                <Badge tone="healthy">Grounded in current source snapshot</Badge>
                <p>Ask a plain-language question. The copilot answers from the same risks, developer results, calendar, budget, owners, and playbook changes used by the dashboard.</p>
              </div>
            </section>

            <section className="copilot-shell panel">
              <aside className="copilot-guide">
                <p className="eyebrow">TRY A QUESTION</p>
                <div className="prompt-list">
                  {suggestedQuestions.map((prompt) => <button key={prompt} onClick={() => void askCopilot(prompt)} disabled={chatBusy}>{prompt}<span>→</span></button>)}
                </div>
                <div className="copilot-guardrail"><b>What it will not do</b><p>Invent root causes, hide synthetic sources, or make a decision without showing the evidence.</p></div>
              </aside>

              <div className="copilot-conversation">
                <div className="chat-log" aria-live="polite">
                  {chatMessages.length === 0 && <div className="copilot-welcome"><span>N</span><div><b>Ready for the operating review.</b><p>Try “What needs an executive decision?” or choose one of the prepared questions.</p></div></div>}
                  {chatMessages.map((message, index) => (
                    <article className={`chat-message chat-${message.role}`} key={`${message.role}-${index}`}>
                      <div className="chat-role">{message.role === "user" ? "Executive" : "Copilot"}</div>
                      <p>{message.content}</p>
                      {message.evidence && message.evidence.length > 0 && <div className="chat-evidence"><b>Evidence</b>{message.evidence.map((item) => <span key={item}>{item}</span>)}</div>}
                      {message.role === "assistant" && <div className="chat-model"><i className={`mode-dot mode-${message.mode}`} />{message.mode === "nemotron" ? "Nemotron" : message.mode === "fallback" ? "Nemotron fallback" : "Demo analysis"}<span>{message.model}</span></div>}
                    </article>
                  ))}
                  {chatBusy && <div className="chat-thinking"><i /><span>Reviewing the operating data…</span></div>}
                  {chatError && <div className="chat-error">{chatError}</div>}
                </div>

                <div className="chat-composer">
                  <label htmlFor="executive-question">Ask about outcomes, reusable patterns, risk, budget, readiness, owners, or upcoming activations</label>
                  <div><textarea id="executive-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void askCopilot(); } }} placeholder="What needs my decision this week?" maxLength={600} rows={2} /><button onClick={() => void askCopilot()} disabled={chatBusy || !question.trim()}>Ask <span>→</span></button></div>
                  <small>Answers are grounded in the current dashboard snapshot. The response labels whether Nemotron or the deterministic fallback produced it.</small>
                </div>
              </div>
            </section>
          </div>
        )}

        {data && view === "sources" && (
          <div className="view-content sources-view">
            <section className="section-hero source-hero">
              <div><p className="eyebrow">AUTOMATION ARCHITECTURE</p><h2>Teams keep<br />their tools.</h2></div>
              <div><p>Each adapter translates a source into the same small operational schema. Add approved server-side credentials to switch an adapter from synthetic to live; the dashboard and meeting logic stay unchanged.</p><button className="copy-button dark-copy" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh all sources"}</button></div>
            </section>

            <section className="source-card-grid">
              {sourceDetails.map((source) => {
                const sourceHealth = data.sources.find((item) => item.name === source.name);
                const badgeTone = sourceHealth?.mode === "live" || sourceHealth?.mode === "bridge" ? "healthy" : sourceHealth?.mode === "fallback" ? "watch" : "sample";
                const badgeLabel = sourceHealth?.mode === "live" ? "Live API" : sourceHealth?.mode === "bridge" ? "Connected demo feed" : sourceHealth?.mode === "fallback" ? "Fallback active" : "Synthetic sample";
                return <article className={`source-card source-card-${source.tone}`} key={source.name}><div><span className="source-pulse" /> <Badge tone={badgeTone}>{badgeLabel}</Badge></div><h2>{source.name}</h2><p>{source.owns}</p><dl><dt>Connector</dt><dd>{source.endpoint}</dd><dt>Designed cadence</dt><dd>{source.cadence}</dd><dt>Last result</dt><dd className="healthy-text">{sourceHealth?.recordCount ?? 0} records · {sourceHealth?.status}</dd></dl></article>;
              })}
            </section>

            <section className="adapter-map panel">
              <div className="panel-heading"><div><p className="eyebrow">COMMON OPERATING SCHEMA</p><h2>Different shapes in, consistent decisions out</h2></div></div>
              <div className="adapter-flow">
                <div className="adapter-inputs"><span>Jira issue</span><span>Smartsheet row</span><span>Sheet budget row</span><span>Document metadata</span></div>
                <i>→</i>
                <div className="adapter-core"><span>Normalize</span><code>id<br />type<br />pillar<br />owner<br />status<br />due date<br />reason<br />next action<br />source</code></div>
                <i>→</i>
                <div className="adapter-outputs"><span>Attention queue</span><span>Calendar + budget</span><span>Results + playbook</span><span>Executive copilot</span></div>
              </div>
            </section>

            <section className="implementation-steps">
              <div><p className="eyebrow">FROM SAMPLE TO REAL</p><h2>A credential change,<br />not a dashboard rebuild.</h2></div>
              <ol><li><span>01</span><div><b>Confirm source ownership</b><p>Which system is authoritative for calendar, roadmap, budget, and playbooks?</p></div></li><li><span>02</span><div><b>Use a secure server-side proxy</b><p>Jira and Smartsheet tokens never reach the browser. A published Google Sheet can be read directly if appropriate.</p></div></li><li><span>03</span><div><b>Map only decision fields</b><p>Normalize owner, status, date, risk, reason, next action, and source ID.</p></div></li><li><span>04</span><div><b>Run a decision-focused review</b><p>Use the dashboard as the pre-read, then record the decision, owner, due date, and required operating change.</p></div></li></ol>
            </section>

            <section className="honesty-note"><span>Important</span><p>This public interview deployment uses read-only synthetic Google Sheets as connected demo feeds. The Jira and Smartsheet vendor adapters remain implemented but are not labeled live until approved vendor credentials are present. Credentials stay server-side.</p></section>
          </div>
        )}
      </section>

      <footer><span>Developer Ecosystem Operations</span><span>Source-backed operating data · Nemotron-ready</span><span>Developer results · decisions · operating changes</span></footer>
    </main>
  );
}
