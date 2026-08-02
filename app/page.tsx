"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadOpsData, type AttentionItem, type OpsData } from "./ops-data";
import { activationLifecycle, handbookRules } from "./handbook-data";

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
  { name: "Smartsheet", owns: "Activation calendar, outcomes, GPU seeding, and regional learning", endpoint: "Smartsheet Sheets API", cadence: "Every 15 min", tone: "amber" },
  { name: "Google Sheets", owns: "Quarter budget, forecast, and GPU seeding envelope", endpoint: "Google Sheets Values API", cadence: "Daily 07:00", tone: "green" },
  { name: "Documents", owns: "Playbooks, review dates, usage", endpoint: "Google Drive Files API", cadence: "Daily 07:00", tone: "violet" },
];

const suggestedQuestions = [
  "What decisions do executives need to make?",
  "Which activation patterns should regions reuse?",
  "Where should GPU seeding investment increase?",
  "How does the activation handbook work?",
  "Where are we over budget?",
  "Which upcoming activations are at risk?",
];

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
    const totalCommitted = data.budgets.reduce((sum, row) => sum + row.committed, 0);
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
    const outcomeOnTarget = data.outcomes.filter((item) => item.outcomeStatus === "Met" || item.outcomeStatus === "Exceeded");
    const reusableAssets = data.outcomes.filter((item) => !item.reusableAsset.toLowerCase().startsWith("no reusable"));
    const regionalReuse = data.outcomes.filter((item) => item.regionsReusing.length > 0);
    const outcomePatterns = data.outcomes.filter((item) => (item.recommendation === "Scale" || item.recommendation === "Standardize") && item.regionsReusing.length > 0);
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
      .slice(0, 12);
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
    return { totalBudget, totalForecast, totalCommitted, gpuSeedBudget, gpuSeedForecast, completedSeeds, pipelineSeeds, historicalUtilization, pipelineRequested, pipelineGranted, prototypes, productionPilots, followOnRequests, gpuByPillar, outcomeOnTarget, reusableAssets, regionalReuse, outcomePatterns, sortedAttention, activationRiskCount, priorityActivations, decisionItems };
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
            <p>An operational control tower connecting portfolio decisions, activation outcomes, regional learning, budgets, risks, owners, and repeatable playbooks.</p>
          </div>
        </div>

        <div className="navigation-stack">
          <nav className="view-tabs four-tabs primary-tabs" aria-label="Primary dashboard views">
            {([
              ["overview", "Overview", "attention first"],
              ["portfolio", "Calendar + budget", "cross-pillar"],
              ["outcomes", "Outcomes + handbook", "learn and reuse"],
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
            <section className="metric-grid ops-metrics" aria-label="Portfolio summary">
              <article className="metric-card primary-metric"><span className="metric-label">Completed outcomes on target</span><strong>{Math.round(summary.outcomeOnTarget.length / Math.max(data.outcomes.length, 1) * 100)}%</strong><span className="delta">{summary.outcomeOnTarget.length} of {data.outcomes.length} met or exceeded</span></article>
              <article className="metric-card outcome-metric"><span className="metric-label">Regional reuse</span><strong>{summary.regionalReuse.length}</strong><span className="delta positive">completed patterns reused</span></article>
              <article className="metric-card"><span className="metric-label">Activations this month</span><strong>{data.totals.monthlyActivations}</strong><span className="delta">{summary.activationRiskCount} monthly exceptions</span></article>
              <article className="metric-card"><span className="metric-label">Roadmap items</span><strong>{data.totals.jiraItems}</strong><span className="delta critical-text">{data.totals.jiraBlocked} blocked · {data.totals.jiraOverdue} overdue</span></article>
              <article className="metric-card"><span className="metric-label">Quarter budget</span><strong>{money(summary.totalBudget)}</strong><span className={`delta ${summary.totalForecast > summary.totalBudget ? "critical-text" : "positive"}`}>Forecast {money(summary.totalForecast)}</span></article>
              <article className="metric-card seed-metric"><span className="metric-label">GPU seeding forecast</span><strong>{money(summary.gpuSeedForecast)}</strong><span className={`delta ${summary.gpuSeedForecast > summary.gpuSeedBudget ? "critical-text" : "positive"}`}>{money(summary.gpuSeedForecast - summary.gpuSeedBudget)} vs plan · {Math.round(summary.historicalUtilization * 100)}% prior utilization</span></article>
            </section>

            <section className="lead-read">
              <div><p className="eyebrow">LEADERSHIP READ</p><Badge tone="critical">{summary.decisionItems.length} decisions</Badge></div>
              <p><b>Attention is ranked from current source records.</b> Monday should decide where GPU seeding earns more investment, where delivery must improve first, and which forecast pressures require a tradeoff—not tour all {data.totals.jiraItems} roadmap items.</p>
              <button className="text-button" onClick={() => setView("meeting")}>Open decision brief <span>→</span></button>
            </section>

            <section className="attention-panel panel">
              <div className="panel-heading">
                <div><p className="eyebrow">ONE QUEUE FROM FOUR SYSTEMS</p><h2>What needs attention now</h2></div>
                <Badge tone="neutral">{data.attention.length} open signals</Badge>
              </div>
              <div className="attention-table" role="table" aria-label="Items requiring attention">
                <div className="attention-row attention-head" role="row"><span>Urgency</span><span>Item</span><span>Why it matters</span><span>Owner / due</span><span>Source</span></div>
                {summary.sortedAttention.slice(0, 8).map((item) => (
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

            <section className="flow-strip">
              <div className="flow-source"><span>Jira</span><small>roadmaps + blockers</small></div>
              <div className="flow-source"><span>Smartsheet</span><small>activations + GPU evidence</small></div>
              <div className="flow-source"><span>Google Sheets</span><small>budget + seed envelope</small></div>
              <div className="flow-source"><span>Documents</span><small>playbooks + reviews</small></div>
              <i>→</i>
              <div className="flow-output"><b>Normalized attention queue</b><small>Dashboard · Monday brief · weekly digest</small></div>
            </section>

            <section className="breakpoint-note">
              <span>Plain-language definition</span>
              <div><h2>What is a breakpoint?</h2><p>It is the point where incoming work consistently exceeds the team&apos;s capacity, so the backlog and waiting time begin to grow.</p></div>
              <p><b>For this role:</b> first measure request volume, cycle time, and queue age. Forecasting a breakpoint comes later; it is not the main dashboard.</p>
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
                    <span>Actual {money(row.actual)}</span><span>Forecast {forecastPercent}%</span><Badge tone={row.status === "On Track" ? "healthy" : "watch"}>{row.status}</Badge><p>{row.note}<small>GPU seeding: {money(row.gpuSeedForecast)} forecast / {money(row.gpuSeedBudget)} plan</small></p>
                  </div>;
                })}
              </div>
              <div className="budget-legend"><span><i /> Actual spend</span><span><em /> Forecast position</span><span>100% = approved budget</span></div>
            </section>

            <section className="panel seed-panel">
              <div className="panel-heading"><div><p className="eyebrow">ACTIVATION-LINKED INVESTMENT</p><h2>GPU seeding decisions</h2></div><Badge tone={summary.gpuSeedForecast > summary.gpuSeedBudget ? "watch" : "healthy"}>{money(summary.gpuSeedForecast)} forecast</Badge></div>
              <p className="seed-explainer">Seeding is treated as an activation investment: demand and cost are joined to utilization, prototypes, production pilots, and follow-on requests. That lets leaders increase capacity where technical conversion is strong and optimize or redirect it where capacity was underused.</p>
              <div className="seed-summary-grid">
                <article><span>Seed forecast vs plan</span><strong>{money(summary.gpuSeedForecast)}</strong><small>{money(summary.gpuSeedBudget)} approved · {money(summary.gpuSeedForecast - summary.gpuSeedBudget)} variance</small></article>
                <article><span>Historical utilization</span><strong>{Math.round(summary.historicalUtilization * 100)}%</strong><small>{summary.completedSeeds.length} completed activation cohorts</small></article>
                <article><span>Technical conversion</span><strong>{summary.prototypes}</strong><small>{summary.productionPilots} production pilots · {summary.followOnRequests} follow-on requests</small></article>
                <article><span>Q3 capacity gap</span><strong>{(summary.pipelineRequested - summary.pipelineGranted).toLocaleString()}</strong><small>{summary.pipelineRequested.toLocaleString()} requested vs {summary.pipelineGranted.toLocaleString()} provisional GPU hours</small></article>
              </div>
              <div className="seed-table" role="table" aria-label="GPU seeding decisions by pillar">
                <div className="seed-row seed-head" role="row"><span>Pillar</span><span>Prior utilization</span><span>Q3 request / grant</span><span>Technical proof</span><span>Seed forecast</span><span>Decision</span></div>
                {summary.gpuByPillar.map((row) => (
                  <div className="seed-row" role="row" key={row.pillar}>
                    <div><b>{row.pillar}</b><small>{row.reason}</small></div>
                    <strong>{Math.round(row.utilization * 100)}%</strong>
                    <span>{row.requestedNext.toLocaleString()} / {row.grantedNext.toLocaleString()} hrs</span>
                    <span>{row.prototypes} prototypes · {row.productionPilots} pilots</span>
                    <span>{money(row.seedForecast)} <small>vs {money(row.seedBudget)} plan</small></span>
                    <Badge tone={row.recommendation === "Increase" ? "healthy" : row.recommendation === "Optimize" ? "watch" : "neutral"}>{row.recommendation}</Badge>
                  </div>
                ))}
              </div>
              <div className="seed-method"><b>Decision rule:</b> Increase when qualified demand exceeds supply and prior cohorts convert capacity into prototypes or pilots. Optimize when demand exists but setup time, utilization, or support cost weakens conversion. Hold or redirect when evidence is incomplete or capacity remains idle.</div>
            </section>

            <section className="panel workstream-panel">
              <div className="panel-heading"><div><p className="eyebrow">CROSS-SYSTEM ROLLUP</p><h2>Workstream health</h2></div><p className="heading-note">No blended org score</p></div>
              <div className="workstream-grid">
                {pillarOrder.map((pillar) => {
                  const budget = data.budgets.find((row) => row.pillar === pillar);
                  const risks = data.attention.filter((item) => item.pillar === pillar).length;
                  const activations = data.activations.filter((item) => item.pillar === pillar).length;
                  const docs = data.playbooks.filter((item) => item.pillar === pillar && item.status !== "Current").length;
                  return <article key={pillar}><div><b>{pillar}</b><Badge tone={risks >= 3 ? "critical" : risks >= 1 ? "watch" : "healthy"}>{risks >= 3 ? "Needs attention" : risks >= 1 ? "Watch" : "On track"}</Badge></div><dl><dt>Open signals</dt><dd>{risks}</dd><dt>Upcoming activations</dt><dd>{activations}</dd><dt>Docs to update</dt><dd>{docs}</dd><dt>Budget forecast</dt><dd>{budget ? `${Math.round(budget.forecast / budget.budget * 100)}%` : "—"}</dd></dl></article>;
                })}
              </div>
            </section>
          </div>
        )}

        {data && summary && view === "outcomes" && (
          <div className="view-content outcomes-view">
            <section className="section-hero outcome-hero">
              <div><p className="eyebrow">SENSE → DECIDE → LEARN</p><h2>Turn activations<br />into operating knowledge.</h2></div>
              <p>The outcome register separates activity from impact. Every completed activation records the target, actual result, cost, reusable asset, regional learning, and a recommendation to scale, standardize, adjust, or stop.</p>
            </section>

            <section className="outcome-score-grid" aria-label="Activation outcome summary">
              <article><span>Completed activations</span><strong>{data.outcomes.length}</strong><small>June–July evidence set</small></article>
              <article><span>Met or exceeded target</span><strong>{summary.outcomeOnTarget.length}</strong><small>{Math.round(summary.outcomeOnTarget.length / Math.max(data.outcomes.length, 1) * 100)}% outcome rate</small></article>
              <article><span>Reusable assets produced</span><strong>{summary.reusableAssets.length}</strong><small>kits, guides, rubrics, and runbooks</small></article>
              <article><span>Cross-region reuse</span><strong>{summary.regionalReuse.length}</strong><small>{summary.outcomePatterns.length} proven scale or standardize patterns</small></article>
            </section>

            <section className="panel pillar-outcomes">
              <div className="panel-heading"><div><p className="eyebrow">OUTCOME PORTFOLIO</p><h2>Evidence by operating pillar</h2></div><Badge tone="healthy">Source-backed</Badge></div>
              <div className="pillar-outcome-row pillar-outcome-head"><span>Pillar</span><span>On target</span><span>Cost / outcome</span><span>Regional reuse</span><span>Portfolio call</span></div>
              {pillarOrder.map((pillar) => {
                const outcomes = data.outcomes.filter((item) => item.pillar === pillar);
                const onTarget = outcomes.filter((item) => item.outcomeStatus === "Met" || item.outcomeStatus === "Exceeded").length;
                const averageCost = outcomes.reduce((sum, item) => sum + item.costPerOutcome, 0) / Math.max(outcomes.length, 1);
                const reused = outcomes.filter((item) => item.regionsReusing.length > 0).length;
                const calls = outcomes.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.recommendation]: (counts[item.recommendation] || 0) + 1 }), {});
                const call = Object.entries(calls).sort((a, b) => b[1] - a[1])[0]?.[0] || "Review";
                return <div className="pillar-outcome-row" key={pillar}><b>{pillar}</b><span>{onTarget} / {outcomes.length}</span><span>{money(averageCost)}</span><span>{reused} patterns</span><Badge tone={call === "Stop" ? "critical" : call === "Adjust" ? "watch" : "healthy"}>{call}</Badge></div>;
              })}
            </section>

            <section className="panel pattern-library">
              <div className="panel-heading"><div><p className="eyebrow">REGIONAL LEARNING EXCHANGE</p><h2>Proven patterns another region can act on</h2></div><p className="heading-note">One pattern per pillar</p></div>
              <div className="pattern-grid">
                {pillarOrder.map((pillar) => data.outcomes.find((item) => item.pillar === pillar && (item.recommendation === "Scale" || item.recommendation === "Standardize") && item.regionsReusing.length > 0)).filter((item): item is OpsData["outcomes"][number] => Boolean(item)).map((item) => (
                  <article key={item.id}>
                    <div><Badge tone="healthy">{item.recommendation}</Badge><span>{item.id}</span></div>
                    <h3>{item.activation}</h3>
                    <p>{item.learning}</p>
                    <dl><dt>Proof</dt><dd>{item.actual} {item.unit} vs {item.target} target</dd><dt>Reusable asset</dt><dd>{item.reusableAsset}</dd><dt>Regional path</dt><dd>{item.originRegion} → {item.regionsReusing.join(", ")}</dd><dt>Standard</dt><dd>{item.playbook}</dd></dl>
                  </article>
                ))}
              </div>
            </section>

            <section className="handbook-shell">
              <div className="handbook-intro"><p className="eyebrow">LIVING ACTIVATION HANDBOOK</p><h2>Repeat the quality.<br />Localize the delivery.</h2><p>The handbook defines the common gates every region follows. Outcome evidence decides which formats enter the pattern library and what changes next.</p></div>
              <div className="lifecycle-list">
                {activationLifecycle.map((step) => <article key={step.id}><span>{step.id}</span><div><small>{step.timing}</small><h3>{step.stage}</h3><p>{step.practice}</p></div></article>)}
              </div>
            </section>

            <section className="handbook-rules panel">
              <div><p className="eyebrow">NON-NEGOTIABLES</p><h2>Rules that make learning portable</h2></div>
              <ol>{handbookRules.map((rule, index) => <li key={rule}><span>{String(index + 1).padStart(2, "0")}</span><p>{rule}</p></li>)}</ol>
            </section>

            <section className="playbook-library panel">
              <div className="panel-heading"><div><p className="eyebrow">APPROVED OPERATING ASSETS</p><h2>Playbooks connected to the activation lifecycle</h2></div><Badge tone="neutral">{data.totals.totalPlaybooks} total · {data.playbooks.length} shown</Badge></div>
              <div>{data.playbooks.map((playbook) => <article key={playbook.id}><div><b>{playbook.title}</b><small>{playbook.pillar}</small></div><span>{playbook.useCount90d} uses / 90d</span><Badge tone={playbook.status === "Current" ? "healthy" : playbook.status === "Needs Update" ? "critical" : "watch"}>{playbook.status}</Badge><small>Next review {shortDate(playbook.nextReview)}</small></article>)}</div>
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
                <p>Ask a plain-language question. The copilot answers from the same risks, outcomes, regional learnings, calendar, budget, owners, and handbook used by the dashboard.</p>
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

      <footer><span>Developer Ecosystem Operations</span><span>Source-backed operating data · Nemotron-ready</span><span>Outcomes · learning · decisions · repeatable practice</span></footer>
    </main>
  );
}
