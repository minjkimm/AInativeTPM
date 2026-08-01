"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadOpsData, type AttentionItem, type OpsData } from "./ops-data";

type View = "overview" | "portfolio" | "meeting" | "copilot" | "sources";

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
  { name: "Smartsheet", owns: "Activation calendar and owners", endpoint: "Smartsheet Sheets API", cadence: "Every 15 min", tone: "amber" },
  { name: "Google Sheets", owns: "Quarter budget and forecast", endpoint: "Google Sheets Values API", cadence: "Daily 07:00", tone: "green" },
  { name: "Documents", owns: "Playbooks, review dates, usage", endpoint: "Google Drive Files API", cadence: "Daily 07:00", tone: "violet" },
];

const meetingDecisions = [
  {
    id: "01",
    question: "How do we resolve the August staffing collision?",
    why: "Three APAC activations need the same two core speakers and lab support within five days. Keeping every date creates delivery risk.",
    call: "Move one activation by a week; approve backup staff for the other two; update the calendar before invitations go out.",
    owner: "Amina + Noah",
    due: "Decision Monday · calendar Tuesday",
  },
  {
    id: "02",
    question: "Which August launches receive limited review capacity first?",
    why: "Four launches share one review team, and two readiness packets are incomplete. Treating all four as equal guarantees late approvals.",
    call: "Prioritize the two with committed external dates; assign a backup reviewer; move the other two gates by one week.",
    owner: "Diego",
    due: "Priority call Monday · gates Wednesday",
  },
  {
    id: "03",
    question: "How do we bring Community forecast back to plan?",
    why: "Travel and venue spend now forecasts 9% above the approved quarter budget, while three events are still uncommitted.",
    call: "Shift two events to regional delivery and cap venue upgrades; keep a 3% contingency until September commitments close.",
    owner: "Amina",
    due: "Decision Monday · reforecast Thursday",
  },
];

const suggestedQuestions = [
  "What are the three decisions executives need to make?",
  "Where are we over budget?",
  "Which upcoming activations are at risk?",
  "Who owns the most urgent follow-up?",
];

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function money(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(value / 1000)}K`;
}

function shortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function severityRank(item: AttentionItem) {
  return item.severity === "Critical" ? 0 : item.severity === "Watch" ? 1 : 2;
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
    const sortedAttention = [...data.attention].sort((a, b) => severityRank(a) - severityRank(b) || a.due.localeCompare(b.due));
    const activationRiskCount = data.activations.filter((item) => item.status !== "On Track").length;
    return { totalBudget, totalForecast, totalCommitted, sortedAttention, activationRiskCount };
  }, [data]);

  async function copyBrief() {
    const text = [
      "DEVELOPER ECOSYSTEM — MONDAY OPERATING REVIEW",
      "Purpose: make three cross-team decisions; project status remains in the pre-read.",
      ...meetingDecisions.map((item) => `${item.id}. ${item.question}\nWHY NOW: ${item.why}\nRECOMMENDATION: ${item.call}\nOWNER: ${item.owner} · ${item.due}`),
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
          <Badge tone={data?.sources.some((source) => source.mode === "live") ? "healthy" : "sample"}>● {data?.sources.some((source) => source.mode === "live") ? "Connected API data" : "Synthetic data · API-ready"}</Badge>
          <span className="updated">{loading ? "Refreshing…" : refreshedAt ? `Refreshed ${refreshedAt}` : "Not refreshed"}</span>
          <button className="refresh-small" onClick={() => void refresh()} disabled={loading} aria-label="Refresh operations data">↻</button>
        </div>
      </header>

      <section className="shell" id="top">
        <div className="intro-row simple-intro">
          <div>
            <p className="eyebrow">WEEK OF AUGUST 3 · OPERATING REVIEW</p>
            <h1>What needs<br />attention?</h1>
          </div>
          <div className="intro-note">
            <span className="note-index">V5</span>
            <p>An operational control tower for the activation calendar, budgets, roadmaps, playbooks, risks, owners, and leadership decisions.</p>
          </div>
        </div>

        <nav className="view-tabs five-tabs" aria-label="Dashboard views">
          {([
            ["overview", "Overview", "attention first"],
            ["portfolio", "Calendar + budget", "6 pillars"],
            ["meeting", "Monday review", "3 decisions"],
            ["copilot", "Executive copilot", "ask the data"],
            ["sources", "Data sources", "4 adapters"],
          ] as const).map(([id, label, detail]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} aria-pressed={view === id}>
              <span>{label}</span><small>{detail}</small>
            </button>
          ))}
        </nav>

        {error && <div className="load-error"><b>Data refresh failed.</b> {error} <button onClick={() => void refresh()}>Try again</button></div>}
        {!data && !error && <div className="loading-state">Loading the four sample sources…</div>}

        {data && summary && view === "overview" && (
          <div className="view-content">
            <section className="metric-grid ops-metrics" aria-label="Portfolio summary">
              <article className="metric-card primary-metric"><span className="metric-label">Activations this month</span><strong>{data.totals.monthlyActivations}</strong><span className="delta">{summary.activationRiskCount} upcoming at risk</span></article>
              <article className="metric-card"><span className="metric-label">Roadmap items</span><strong>{data.totals.jiraItems}</strong><span className="delta critical-text">{data.totals.jiraBlocked} blocked · {data.totals.jiraOverdue} overdue</span></article>
              <article className="metric-card"><span className="metric-label">Quarter budget</span><strong>{money(summary.totalBudget)}</strong><span className={`delta ${summary.totalForecast > summary.totalBudget ? "critical-text" : "positive"}`}>Forecast {money(summary.totalForecast)}</span></article>
              <article className="metric-card"><span className="metric-label">Operational playbooks</span><strong>{data.totals.totalPlaybooks}</strong><span className="delta warning-text">{data.totals.playbooksNeedingReview} need review</span></article>
              <article className="metric-card source-metric"><span className="metric-label">Sources reporting</span><strong>{data.sources.length}/4</strong><span className="delta positive">{data.sources.filter((source) => source.mode === "live").length} live · {data.sources.filter((source) => source.mode !== "live").length} sample</span></article>
            </section>

            <section className="lead-read">
              <div><p className="eyebrow">LEADERSHIP READ</p><Badge tone="critical">3 decisions</Badge></div>
              <p><b>Most work is moving.</b> Monday attention should go to the shared staffing collision, limited readiness-review capacity, and the Community budget variance—not a tour of all 47 roadmap items.</p>
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
              <div className="flow-source"><span>Smartsheet</span><small>activation calendar</small></div>
              <div className="flow-source"><span>Google Sheets</span><small>budget + forecast</small></div>
              <div className="flow-source"><span>Documents</span><small>playbooks + reviews</small></div>
              <i>→</i>
              <div className="flow-output"><b>Normalized attention queue</b><small>Dashboard · Monday brief · weekly digest</small></div>
            </section>

            <section className="breakpoint-note">
              <span>Plain-language definition</span>
              <div><h2>What is a breakpoint?</h2><p>If 12 new requests arrive each week and a team can close only 10, the backlog grows by two. That point—when incoming work exceeds capacity—is the breakpoint.</p></div>
              <p><b>For this role:</b> first measure request volume, cycle time, and queue age. Forecasting a breakpoint comes later; it is not the main dashboard.</p>
            </section>
          </div>
        )}

        {data && summary && view === "portfolio" && (
          <div className="view-content portfolio-view">
            <section className="section-hero compact-hero">
              <div><p className="eyebrow">CALENDAR + BUDGET + PRIORITIES</p><h2>One portfolio.<br />Six different pillars.</h2></div>
              <p>Leads keep their working systems. This view normalizes only the fields needed for coordination: status, risk, owner, date, budget, and next action.</p>
            </section>

            <section className="panel portfolio-panel">
              <div className="panel-heading"><div><p className="eyebrow">NEXT 14 DAYS · SMARTSHEET</p><h2>Activation calendar</h2></div><Badge tone="sample">Sample · live adapter</Badge></div>
              <div className="calendar-table">
                <div className="calendar-row calendar-head"><span>Date</span><span>Activation</span><span>Pillar / region</span><span>Owner</span><span>Status</span><span>Next action</span><span>Budget</span></div>
                {data.activations.map((item) => (
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
                    <span>Actual {money(row.actual)}</span><span>Forecast {forecastPercent}%</span><Badge tone={row.status === "On Track" ? "healthy" : "watch"}>{row.status}</Badge><p>{row.note}</p>
                  </div>;
                })}
              </div>
              <div className="budget-legend"><span><i /> Actual spend</span><span><em /> Forecast position</span><span>100% = approved budget</span></div>
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

        {data && view === "meeting" && (
          <div className="view-content meeting-view">
            <section className="section-hero meeting-hero">
              <div><p className="eyebrow">MONDAY · 30 MINUTES</p><h2>Decisions,<br />not status updates.</h2><p>The dashboard is the pre-read. The meeting handles only cross-team choices, escalations, and changes to owners or resources.</p></div>
              <div className="meeting-actions"><span><b>3</b> calls ready</span><button className="copy-button" onClick={copyBrief}>{copied ? "Copied ✓" : "Copy meeting brief"}</button></div>
            </section>

            <section className="agenda-bar">
              <div><b>05</b><span>What changed<br />since last Monday</span></div><div><b>20</b><span>Three decisions<br />with recommendations</span></div><div><b>05</b><span>Read back owners,<br />dates, and changes</span></div><p>All project-by-project reporting stays asynchronous.</p>
            </section>

            <div className="decision-list">
              {meetingDecisions.map((item) => (
                <article className="decision-card" key={item.id}>
                  <div className="decision-number">{item.id}</div>
                  <div className="decision-main"><p className="eyebrow">DECISION REQUIRED</p><h2>{item.question}</h2><div className="why-box"><span>Why now</span><p>{item.why}</p></div><div className="call-box"><span>Prepared recommendation</span><p>{item.call}</p></div></div>
                  <div className="decision-meta"><span>Owner</span><b>{item.owner}</b><span>Timing</span><b>{item.due}</b></div>
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
                <Badge tone="sample">Demo analysis active</Badge>
                <p>Ask a plain-language question. The copilot answers from the same risks, calendar, budget, owners, and playbooks used by the dashboard.</p>
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
                  <label htmlFor="executive-question">Ask about risk, budget, readiness, owners, or upcoming activations</label>
                  <div><textarea id="executive-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void askCopilot(); } }} placeholder="What needs my decision this week?" maxLength={600} rows={2} /><button onClick={() => void askCopilot()} disabled={chatBusy || !question.trim()}>Ask <span>→</span></button></div>
                  <small>Answers are grounded in the current dashboard snapshot. Configure the NVIDIA NIM environment variables to switch from demo analysis to Nemotron.</small>
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
                const badgeTone = sourceHealth?.mode === "live" ? "healthy" : sourceHealth?.mode === "fallback" ? "watch" : "sample";
                return <article className={`source-card source-card-${source.tone}`} key={source.name}><div><span className="source-pulse" /> <Badge tone={badgeTone}>{sourceHealth?.mode === "live" ? "Live API" : sourceHealth?.mode === "fallback" ? "Fallback active" : "Synthetic sample"}</Badge></div><h2>{source.name}</h2><p>{source.owns}</p><dl><dt>Connector</dt><dd>{source.endpoint}</dd><dt>Target cadence</dt><dd>{source.cadence}</dd><dt>Last result</dt><dd className="healthy-text">{sourceHealth?.recordCount ?? 0} records · {sourceHealth?.status}</dd></dl></article>;
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

            <section className="honesty-note"><span>Important</span><p>The server connectors are implemented, but this deployment has no company credentials and therefore uses labeled synthetic files. Adding approved environment variables switches each source to its authenticated API without exposing tokens to the browser.</p></section>
          </div>
        )}
      </section>

      <footer><span>Developer Ecosystem Operations</span><span>Prototype v0.5 · Nemotron-ready executive copilot</span><span>Calendar · budget · risks · decisions</span></footer>
    </main>
  );
}
