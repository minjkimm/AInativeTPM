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
      const recommendation = calls.includes("Approve increase") ? "Increase" : calls.includes("Optimize first") ? "Optimize" : "Hold";
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
    const adjustmentCalls: Record<string, string> = {
      "OUT-004": "Approve another preview only after the Program Launch Readiness Checklist requires a named follow-up owner for every partner evaluation before the session closes.",
      "OUT-010": "Approve the next cohort only after the Program Launch Readiness Checklist requires every account team to submit the same evaluation worksheet with a named partner next step before cohort close.",
    };
    const meetingOutcomes = [...stopOutcomes, ...adjustOutcomes.slice(0, 2), ...scaleOutcomes.slice(0, 1)].map((item) => ({
      ...item,
      preparedCall: item.recommendation === "Stop"
        ? `Do not repeat this format. ${item.learning}`
        : item.recommendation === "Adjust"
          ? adjustmentCalls[item.id] || `Approve the next cohort only after ${item.playbook} is updated with this requirement: ${item.learning}`
          : item.recommendation === "Scale"
            ? `Approve reuse in ${item.regionsReusing.join(", ") || "one additional region"} using ${item.reusableAsset}.`
            : `Make ${item.reusableAsset} the default asset in ${item.playbook}.`,
    }));
    const sortedAttention = [...data.attention].sort((a, b) => severityRank(a) - severityRank(b) || (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31"));
    const activationRiskCount = data.activations.filter((item) => item.status !== "On Track").length;
    const start = reviewStart(data);
    const end = start ? new Date(start) : null;
    end?.setDate(end.getDate() + 13);
    const activationRank = (status: string) => status === "Blocked" ? 0 : status === "At Risk" ? 1 : status === "Watch" ? 2 : 3;
    const priorityActivations = [...data.activations]
      .filter((item) => {
        if (!start || !end) return true;
        const date = new Date(`${item.date}T12:00:00`);
        return date >= start && date <= end;
      })
      .sort((a, b) => activationRank(a.status) - activationRank(b.status) || a.date.localeCompare(b.date))
      .slice(0, 8);
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
    return { totalBudget, totalForecast, gpuSeedBudget, gpuSeedForecast, completedSeeds, pipelineSeeds, historicalUtilization, pipelineRequested, pipelineGranted, prototypes, productionPilots, followOnRequests, gpuInvestmentCalls, gpuNoRequestPillars, stopOutcomes, adjustOutcomes, scaleOutcomes, standardizeOutcomes, meetingOutcomes, sortedAttention, activationRiskCount, priorityActivations, decisionItems };
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
            <p>An operational control tower connecting decisions, post-activation developer results, budgets, risks, owners, and the playbooks that must change.</p>
          </div>
        </div>

        <div className="navigation-stack">
          <nav className="view-tabs four-tabs primary-tabs" aria-label="Primary dashboard views">
            {([
              ["overview", "Overview", "attention first"],
              ["portfolio", "Calendar + budget", "cross-pillar"],
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
              <article className="metric-card primary-metric"><span className="metric-label">Formats requiring change</span><strong>{summary.stopOutcomes.length + summary.adjustOutcomes.length}</strong><span className="delta">{summary.stopOutcomes.length} stop · {summary.adjustOutcomes.length} fix before repeat</span></article>
              <article className="metric-card"><span className="metric-label">Activations this month</span><strong>{data.totals.monthlyActivations}</strong><span className="delta">{summary.activationRiskCount} monthly exceptions</span></article>
              <article className="metric-card"><span className="metric-label">Quarter budget</span><strong>{money(summary.totalBudget)}</strong><span className={`delta ${summary.totalForecast > summary.totalBudget ? "critical-text" : "positive"}`}>Forecast {money(summary.totalForecast)}</span></article>
              <article className="metric-card seed-metric"><span className="metric-label">GPU seeding forecast</span><strong>{money(summary.gpuSeedForecast)}</strong><span className={`delta ${summary.gpuSeedForecast > summary.gpuSeedBudget ? "critical-text" : "positive"}`}>{money(summary.gpuSeedForecast - summary.gpuSeedBudget)} vs plan · {Math.round(summary.historicalUtilization * 100)}% prior utilization</span></article>
              <article className="metric-card outcome-metric"><span className="metric-label">Decisions ready</span><strong>{summary.decisionItems.length}</strong><span className="delta positive">recommendation, owner, and evidence</span></article>
            </section>

            <section className="lead-read">
              <div><p className="eyebrow">LEADERSHIP READ</p><Badge tone="critical">{summary.decisionItems.length} decisions</Badge></div>
              <p><b>Attention is ranked from current source records.</b> Monday should decide where GPU seeding earns more investment, where delivery must improve first, and which forecast pressures require a tradeoff—not tour all {data.totals.jiraItems} roadmap items.</p>
              <button className="text-button" onClick={() => setView("meeting")}>Open decision brief <span>→</span></button>
            </section>

            <section className="attention-panel panel">
              <div className="panel-heading">
                <div><p className="eyebrow">RANKED EXCEPTIONS</p><h2>What needs attention now</h2></div>
                <Badge tone="neutral">Top 5 of {data.attention.length}</Badge>
              </div>
              <div className="attention-table" role="table" aria-label="Items requiring attention">
                <div className="attention-row attention-head" role="row"><span>Urgency</span><span>Item</span><span>Why it matters</span><span>Owner / due</span><span>Source</span></div>
                {summary.sortedAttention.slice(0, 5).map((item) => (
                  <div className="attention-row" role="row" key={`${item.source}-${item.id}`}>
                    <div><Badge tone={item.severity.toLowerCase()}>{item.severity}</Badge></div>
                    <div><b>{item.title}</b><small>{item.pillar}</small></div>
                    <div><p>{item.reason}</p><strong>Next: {item.nextAction}</strong></div>
                    <div><b>{item.owner}</b><small>{shortDate(item.due)}</small></div>
                    <div><span className={`source-dot source-${item.source.toLowerCase().replace(" ", "-")}`} />{item.source}</div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}

        {data && summary && view === "portfolio" && (
          <div className="view-content portfolio-view">
            <section className="section-hero compact-hero">
              <div><p className="eyebrow">CALENDAR + BUDGET + PRIORITIES</p><h2>One portfolio.<br />Multiple operating pillars.</h2></div>
              <p>Leads keep their working systems. This view normalizes only the fields needed for coordination: status, risk, owner, date, budget, and next action.</p>
            </section>

            <section className="panel portfolio-panel">
              <div className="panel-heading"><div><p className="eyebrow">PRIORITY WINDOW · NEXT 14 DAYS</p><h2>Activation calendar</h2></div><Badge tone="healthy">{summary.priorityActivations.length} shown · {data.activations.length} monthly</Badge></div>
              <div className="calendar-table">
                <div className="calendar-row calendar-head"><span>Date</span><span>Activation</span><span>Pillar / region</span><span>Owner</span><span>Status</span><span>Next action</span><span>Budget</span></div>
                {summary.priorityActivations.map((item) => (
                  <div className="calendar-row" key={item.id}>
                    <b>{shortDate(item.date)}</b><div><strong>{item.name}</strong>{item.risk !== "None" && <small>{item.risk}</small>}</div><div><span>{item.pillar}</span><small>{item.region}</small></div><span>{item.owner}</span><Badge tone={item.status === "On Track" ? "healthy" : item.status === "Blocked" ? "critical" : "watch"}>{item.status}</Badge><p>{item.nextAction}</p><b>{money(item.budget)}</b>
                  </div>
                ))}
              </div>
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

            <section className="panel seed-panel">
              <div className="panel-heading seed-heading"><div><p className="eyebrow">ACTIVATION-LINKED INVESTMENT</p><h2>Where should GPU seeding change?</h2></div><a className="evidence-link" href={gpuEvidenceUrl} target="_blank" rel="noreferrer">View source data ↗</a></div>
              <div className="seed-basis" aria-label="GPU seeding decision basis">
                <b>Decision basis</b><span><i>1</i> Demand gap</span><span><i>2</i> Prior utilization</span><span><i>3</i> Prototypes and pilots</span>
              </div>
              <div className="seed-summary-grid">
                <article><span>Seed forecast vs plan</span><strong>{money(summary.gpuSeedForecast)}</strong><small>{money(summary.gpuSeedBudget)} approved · {money(summary.gpuSeedForecast - summary.gpuSeedBudget)} variance</small></article>
                <article><span>Historical utilization</span><strong>{Math.round(summary.historicalUtilization * 100)}%</strong><small>{summary.completedSeeds.length} completed activation cohorts</small></article>
                <article><span>Technical conversion</span><strong>{summary.prototypes}</strong><small>{summary.productionPilots} production pilots · {summary.followOnRequests} follow-on requests</small></article>
                <article><span>Q3 capacity gap</span><strong>{(summary.pipelineRequested - summary.pipelineGranted).toLocaleString()}</strong><small>{summary.pipelineRequested.toLocaleString()} requested vs {summary.pipelineGranted.toLocaleString()} provisional GPU hours</small></article>
              </div>
              <div className="seed-decision-list">
                {summary.gpuInvestmentCalls.map((call) => (
                  <article key={call.pillar}>
                    <Badge tone={call.recommendation === "Increase" ? "healthy" : call.recommendation === "Optimize" ? "watch" : "neutral"}>{call.recommendation === "Increase" ? `Fund ${call.pipelineCount} requests` : call.recommendation}</Badge>
                    <div><h3>{call.pillar}: {call.useCase}</h3><p>{call.pipelineActivations.join(" · ")}</p><small>{call.gpuProducts.join(", ")} · {call.deliveryModes.join(", ")}</small></div>
                    <div className="seed-proof"><b>{Math.round(call.utilization * 100)}%</b><span>prior use</span><b>{call.prototypes}</b><span>prototypes</span><b>{(call.requestedNext - call.grantedNext).toLocaleString()}</b><span>hour gap</span></div>
                  </article>
                ))}
              </div>
              <div className="seed-method"><span><b>Fund</b> means approving additional GPU hours for these named developer workloads—not giving GPUs to the pillar itself.</span><span><b>Hold</b> means keep current provisional capacity until a cohort proves workload conversion.</span><span><b>No Q3 request:</b> {summary.gpuNoRequestPillars.join(" · ")}.</span></div>
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
                    <div className="outcome-action"><span>Decision proposed</span><p>{item.preparedCall}</p><small>Playbook to update: {item.playbook}</small></div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel operating-change-map">
              <div><p className="eyebrow">HANDBOOK = THE SYSTEM CHANGE</p><h2>The meeting is not finished until a tracker or playbook changes.</h2></div>
              <div className="change-rule-grid"><article><Badge tone="critical">Stop</Badge><p>Cancel repeat instances and record the replacement format.</p></article><article><Badge tone="watch">Adjust</Badge><p>Add the required change to the readiness gate before reopening registration.</p></article><article><Badge tone="healthy">Scale</Badge><p>Name the next region, local owner, date, and approved reusable asset.</p></article><article><Badge tone="healthy">Standardize</Badge><p>Update the default checklist or playbook and communicate the new standard.</p></article></div>
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
              <div><b>05</b><span>What changed<br />since last Monday</span></div><div><b>20</b><span>Ranked decisions<br />with recommendations</span></div><div><b>05</b><span>Read back owners,<br />dates, and changes</span></div><p>All project-by-project reporting stays asynchronous.</p>
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
                <div className="adapter-outputs"><span>Attention queue</span><span>Calendar + budget</span><span>Monday brief</span><span>Weekly digest</span></div>
              </div>
            </section>

            <section className="implementation-steps">
              <div><p className="eyebrow">FROM SAMPLE TO REAL</p><h2>A credential change,<br />not a dashboard rebuild.</h2></div>
              <ol><li><span>01</span><div><b>Confirm source ownership</b><p>Which system is authoritative for calendar, roadmap, budget, and playbooks?</p></div></li><li><span>02</span><div><b>Use a secure server-side proxy</b><p>Jira and Smartsheet tokens never reach the browser. A published Google Sheet can be read directly if appropriate.</p></div></li><li><span>03</span><div><b>Map only decision fields</b><p>Normalize owner, status, date, risk, reason, next action, and source ID.</p></div></li><li><span>04</span><div><b>Automate the rhythm</b><p>Refresh on schedule, generate the Monday brief, and post exceptions to the team channel.</p></div></li></ol>
            </section>

            <section className="adapter-map panel">
              <div className="panel-heading"><div><p className="eyebrow">AUTOMATED DELIVERY PATH</p><h2>Monday output without manual reporting</h2></div><Badge tone="healthy">GitHub-ready</Badge></div>
              <div className="adapter-flow">
                <div className="adapter-inputs"><span>Jira REST API</span><span>Smartsheet API</span><span>Google Sheets API</span><span>Drive metadata</span></div>
                <i>→</i>
                <div className="adapter-core"><span>Server route</span><code>/api/ops<br />authenticate<br />normalize<br />rank exceptions<br />remove secrets</code></div>
                <i>→</i>
                <div className="adapter-outputs"><span>Dashboard refresh</span><span>Monday decision brief</span><span>GitHub Actions schedule</span><span>Slack webhook delivery</span></div>
              </div>
            </section>

            <section className="honesty-note"><span>Important</span><p>This public interview deployment uses read-only synthetic Google Sheets as connected demo feeds. The Jira and Smartsheet vendor adapters remain implemented but are not labeled live until approved vendor credentials are present. Credentials stay server-side.</p></section>
          </div>
        )}
      </section>

      <footer><span>Developer Ecosystem Operations</span><span>Source-backed operating data · Nemotron-ready</span><span>Developer results · decisions · operating changes</span></footer>
    </main>
  );
}
