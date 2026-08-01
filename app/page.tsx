"use client";

import { useMemo, useState } from "react";

type View = "weekly" | "meeting" | "quarter";
type Severity = "Miss" | "Watch" | "Open loop" | "Pacing";

const exceptions = [
  {
    severity: "Miss" as Severity,
    age: "2d",
    title: "Austin Agent Lab",
    meta: "Hackathon · Americas · Aug 28",
    reason: "38% seat utilization · goal ≥ 60%",
    owner: "Community West",
    action: "Right-size reserved lab capacity",
  },
  {
    severity: "Miss" as Severity,
    age: "4d",
    title: "Paris Inference Meetup",
    meta: "Meetup · EMEA · Aug 26",
    reason: "47% attendance · goal ≥ 80%",
    owner: "Community EMEA",
    action: "Review reminder and partner funnel",
  },
  {
    severity: "Watch" as Severity,
    age: "1d",
    title: "Seoul CUDA Workshop",
    meta: "Workshop · APAC · Aug 29",
    reason: "22% new developers · goal ≥ 30%",
    owner: "Community APAC",
    action: "Test a net-new audience channel",
  },
  {
    severity: "Open loop" as Severity,
    age: "8d",
    title: "Berlin Robotics Lab",
    meta: "Lab · EMEA · Aug 21",
    reason: "Debrief and playbook update owed",
    owner: "DevRel Robotics",
    action: "Close in Monday staff meeting",
  },
  {
    severity: "Pacing" as Severity,
    age: "6d out",
    title: "Toronto GenAI Build Day",
    meta: "Hackathon · Americas · Sep 8",
    reason: "41% of signup goal with 6 days left",
    owner: "Community East",
    action: "Activate university partner list",
  },
];

const formats = [
  { name: "Hackathons", count: 6, success: 83, cost: "$184", repeat: 72, trend: "+8%" },
  { name: "Workshops", count: 9, success: 89, cost: "$96", repeat: 81, trend: "+12%" },
  { name: "Meetups", count: 8, success: 75, cost: "$71", repeat: 64, trend: "−3%" },
  { name: "Livestreams", count: 5, success: 80, cost: "$38", repeat: 92, trend: "+4%" },
];

const agenda = [
  { time: "5 min", title: "The week in numbers", note: "28 activations · 82% success · $126 per reached developer" },
  { time: "10 min", title: "Patterns, not incidents", note: "Attendance missed twice; partner-sourced events held 1.4× better" },
  { time: "5 min", title: "Close the loops", note: "4 debriefs and 2 playbook updates need owners" },
  { time: "3 min", title: "Next week’s risks", note: "Toronto pacing risk; Singapore venue capacity not confirmed" },
  { time: "2 min", title: "Decisions", note: "Pilot regional workshop kit; right-size hackathon lab capacity" },
];

const allocationRows = [
  { format: "Workshops", current: 32, next: 38, evidence: "High", why: "Best balance of technical depth, cost, and regional repeatability" },
  { format: "Hackathons", current: 31, next: 27, evidence: "Medium", why: "Strong depth; lab capacity and follow-up create avoidable cost" },
  { format: "Meetups", current: 22, next: 20, evidence: "Medium", why: "Useful reach, but new-developer mix is inconsistent" },
  { format: "Livestreams", current: 15, next: 15, evidence: "Low", why: "Efficient reach; downstream technical engagement is under-measured" },
];

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Confidence({ children }: { children: React.ReactNode }) {
  return <span className="confidence"><span aria-hidden="true">◆</span>{children}</span>;
}

export default function Home() {
  const [view, setView] = useState<View>("weekly");
  const [filter, setFilter] = useState<"All" | Severity>("All");
  const [copied, setCopied] = useState(false);

  const filteredExceptions = useMemo(
    () => filter === "All" ? exceptions : exceptions.filter((item) => item.severity === filter),
    [filter],
  );

  async function copyAgenda() {
    const text = [
      "DEVELOPER ECOSYSTEM — WEEKLY OPERATIONS · SEP 2",
      ...agenda.map((item, index) => `${index + 1}. ${item.title} (${item.time})\n${item.note}`),
      "DECISIONS: Pilot regional workshop kit; right-size hackathon lab capacity.",
    ].join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Developer Ecosystem Operations home">
          <span className="mark">DE</span>
          <span>Developer Ecosystem <b>/ Operations</b></span>
        </a>
        <div className="header-meta">
          <Badge tone="sample">● Synthetic prototype</Badge>
          <span className="updated">Updated Sep 1 · 07:00 PT</span>
          <button className="avatar" aria-label="Open profile menu">MK</button>
        </div>
      </header>

      <section className="shell" id="top">
        <div className="intro-row">
          <div>
            <p className="eyebrow">OPERATING REVIEW · AUG 25–31</p>
            <h1>Where does the next<br />staff-day go?</h1>
          </div>
          <div className="intro-note">
            <span className="note-index">01</span>
            <p>A decision prototype built from interview hypotheses. Numbers are invented; the operating logic is the artifact.</p>
          </div>
        </div>

        <nav className="view-tabs" aria-label="Dashboard views">
          {([
            ["weekly", "Weekly operations", "5 exceptions"],
            ["meeting", "Monday meeting", "25 minutes"],
            ["quarter", "Quarter planning", "4 allocation calls"],
          ] as const).map(([id, label, detail]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
              aria-pressed={view === id}
            >
              <span>{label}</span><small>{detail}</small>
            </button>
          ))}
        </nav>

        {view === "weekly" && (
          <div className="view-content">
            <section className="metric-grid" aria-label="Weekly metrics">
              <article className="metric-card primary-metric">
                <span className="metric-label">Activations completed</span>
                <strong>28</strong>
                <span className="delta positive">↗ 4 vs 4-week avg</span>
              </article>
              <article className="metric-card">
                <span className="metric-label">Transparent success</span>
                <strong>82<small>%</small></strong>
                <span className="delta positive">↗ 6 pts</span>
              </article>
              <article className="metric-card">
                <span className="metric-label">Unique developers reached</span>
                <strong>1,946</strong>
                <span className="delta">72% net-new</span>
              </article>
              <article className="metric-card">
                <span className="metric-label">Cost / reached developer</span>
                <strong>$126</strong>
                <span className="delta positive">↓ $14 vs avg</span>
              </article>
              <article className="metric-card evidence-card">
                <span className="metric-label">Evidence coverage</span>
                <strong>91<small>%</small></strong>
                <span className="delta warn">6 records incomplete</span>
              </article>
            </section>

            <section className="decision-read">
              <div className="read-kicker"><span>RULE-BASED READ</span><Confidence>High confidence</Confidence></div>
              <p><b>Hold total activation budget flat.</b> Shift one staff-day per hackathon from lab provisioning into post-event technical follow-up, and test the workshop playbook with two regional teams. Workshops produced 1.3× deeper engagement at 48% lower unit cost.</p>
              <button className="text-button" onClick={() => setView("quarter")}>Inspect allocation evidence <span>→</span></button>
            </section>

            <div className="weekly-grid">
              <section className="panel exceptions-panel">
                <div className="panel-heading">
                  <div><p className="eyebrow">THE JOB</p><h2>Exceptions first</h2></div>
                  <span className="count-circle">{exceptions.length}</span>
                </div>
                <div className="filter-row" role="group" aria-label="Filter exceptions">
                  {(["All", "Miss", "Watch", "Open loop", "Pacing"] as const).map((item) => (
                    <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>
                  ))}
                </div>
                <div className="exception-list">
                  {filteredExceptions.map((item) => (
                    <article className="exception" key={item.title}>
                      <div className={`status-pin status-${item.severity.toLowerCase().replace(" ", "-")}`} aria-hidden="true" />
                      <div className="exception-body">
                        <div className="exception-title"><h3>{item.title}</h3><Badge tone={item.severity.toLowerCase().replace(" ", "-")}>{item.severity}</Badge></div>
                        <p className="exception-meta">{item.meta}</p>
                        <p className="reason">{item.reason}</p>
                        <div className="owner-row"><span>{item.owner}</span><span>Next: {item.action}</span></div>
                      </div>
                      <span className="age">{item.age}</span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel ladder-panel">
                <div className="panel-heading">
                  <div><p className="eyebrow">OUTCOME LADDER</p><h2>Activity is not impact</h2></div>
                  <Badge tone="neutral">Observed + proxy</Badge>
                </div>
                <p className="panel-lede">Each step is reported separately. No blended impact score.</p>
                <div className="ladder">
                  <div className="ladder-row"><span className="ladder-num">01</span><div><b>Activations</b><small>Observed</small></div><strong>28</strong></div>
                  <div className="ladder-row"><span className="ladder-num">02</span><div><b>Developers reached</b><small>Identity-matched</small></div><strong>1,946</strong></div>
                  <div className="ladder-row"><span className="ladder-num">03</span><div><b>Deep technical engagement</b><small>Lab or code completion</small></div><strong>612</strong></div>
                  <div className="ladder-row proxy"><span className="ladder-num">04</span><div><b>Product journey started</b><small>30-day proxy · 78% matched</small></div><strong>184</strong></div>
                  <div className="ladder-row proxy low"><span className="ladder-num">05</span><div><b>Application shipped</b><small>90-day proxy · low confidence</small></div><strong>31</strong></div>
                </div>
                <div className="coverage-note"><span>!</span><p><b>Most dangerous assumption</b><br />Identity resolution can reliably connect an activation to downstream adoption.</p></div>
              </section>
            </div>

            <section className="panel format-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">PORTFOLIO HEALTH</p><h2>Different jobs, shared lenses</h2></div>
                <p className="heading-note">Output · depth · cost · repeatability</p>
              </div>
              <div className="format-table" role="table" aria-label="Performance by activation format">
                <div className="format-row format-header" role="row">
                  <span>Format</span><span>Volume</span><span>Success</span><span>Cost / reach</span><span>Repeatability</span><span>4-week trend</span>
                </div>
                {formats.map((item) => (
                  <div className="format-row" role="row" key={item.name}>
                    <b>{item.name}</b><span>{item.count}</span>
                    <span className="bar-cell"><i style={{ width: `${item.success}%` }} /><em>{item.success}%</em></span>
                    <span>{item.cost}</span>
                    <span className="bar-cell repeat"><i style={{ width: `${item.repeat}%` }} /><em>{item.repeat}%</em></span>
                    <span className={item.trend.startsWith("−") ? "trend-down" : "trend-up"}>{item.trend}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="assumptions-strip">
              <span className="note-index">02</span>
              <div><p className="eyebrow">VALIDATE BEFORE ADOPTION</p><h2>Three assumptions, not three facts.</h2></div>
              <ol>
                <li>Activations are the right first unit of work.</li>
                <li>Teams can agree on per-format success checks.</li>
                <li>Existing data can support allocation decisions without new reporting burden.</li>
              </ol>
            </section>
          </div>
        )}

        {view === "meeting" && (
          <div className="view-content meeting-view">
            <section className="meeting-hero">
              <div>
                <p className="eyebrow">MONDAY · SEP 2 · 09:00 PT</p>
                <h2>The meeting is ready.</h2>
                <p>Generated from the same evidence as the dashboard. Leaders add judgment; nobody rebuilds the status report.</p>
              </div>
              <div className="meeting-actions">
                <span><b>25</b> minutes</span>
                <button className="copy-button" onClick={copyAgenda}>{copied ? "Copied ✓" : "Copy agenda"}</button>
              </div>
            </section>
            <section className="agenda-grid">
              <div className="agenda-list">
                {agenda.map((item, index) => (
                  <article className="agenda-item" key={item.title}>
                    <span className="agenda-number">0{index + 1}</span>
                    <div><div className="agenda-title"><h3>{item.title}</h3><Badge tone="neutral">{item.time}</Badge></div><p>{item.note}</p></div>
                  </article>
                ))}
              </div>
              <aside className="decision-board">
                <p className="eyebrow">LEAVE WITH OWNERS</p>
                <h2>Decision board</h2>
                <div className="board-item"><span>01</span><div><b>Regional workshop pilot</b><p>Owner: APAC + EMEA leads<br />Due: Sep 6</p></div></div>
                <div className="board-item"><span>02</span><div><b>Hackathon capacity rule</b><p>Owner: Community Ops<br />Due: Sep 9</p></div></div>
                <div className="board-item"><span>03</span><div><b>Close Berlin debrief</b><p>Owner: DevRel Robotics<br />Due: Today</p></div></div>
                <div className="meeting-principle"><b>Mission is the boss.</b><p>Escalate the decision, not the disagreement. Record the evidence and update the playbook.</p></div>
              </aside>
            </section>
          </div>
        )}

        {view === "quarter" && (
          <div className="view-content quarter-view">
            <section className="quarter-hero">
              <div><p className="eyebrow">Q4 ALLOCATION HYPOTHESIS</p><h2>Move resources, not just metrics.</h2></div>
              <div className="budget-total"><span>Illustrative activation budget</span><strong>$1.28M</strong><small>Flat quarter over quarter</small></div>
            </section>
            <section className="allocation-table panel">
              <div className="allocation-head"><span>Format</span><span>Current</span><span>Proposed</span><span>Evidence</span><span>Why this changes</span></div>
              {allocationRows.map((row) => (
                <div className="allocation-row" key={row.format}>
                  <b>{row.format}</b>
                  <span>{row.current}%</span>
                  <span className={row.next > row.current ? "allocation-up" : row.next < row.current ? "allocation-down" : ""}>{row.next}% {row.next > row.current ? "↑" : row.next < row.current ? "↓" : "→"}</span>
                  <Confidence>{row.evidence}</Confidence>
                  <p>{row.why}</p>
                </div>
              ))}
            </section>
            <div className="quarter-grid">
              <section className="panel bottleneck-panel">
                <div className="panel-heading"><div><p className="eyebrow">CAPACITY, NOT ACTIVITY</p><h2>Where 10× breaks</h2></div><Badge tone="sample">Sample process study</Badge></div>
                <div className="bottleneck-chart">
                  {[
                    ["Partner + venue", 34, "2.1 days"],
                    ["Technical design", 58, "3.6 days"],
                    ["Lab provisioning", 91, "5.8 days"],
                    ["Delivery", 46, "2.9 days"],
                    ["Follow-up", 72, "4.5 days"],
                  ].map(([name, width, days]) => (
                    <div className="bottleneck-row" key={name}><span>{name}</span><div><i style={{ width: `${width}%` }} /></div><b>{days}</b></div>
                  ))}
                </div>
                <p className="chart-footnote">Median staff-days per activation. Provisioning is the constraint; additional event budget alone will not create 10× capacity.</p>
              </section>
              <section className="panel hypothesis-panel">
                <p className="eyebrow">NEXT BEST TEST</p>
                <h2>Can a playbook replace travel?</h2>
                <p className="hypothesis">If two regional teams deliver the workshop kit within ±10% of core-team depth and quality, shift four core staff-days per month from travel into technical follow-up.</p>
                <div className="test-grid"><div><span>Test length</span><b>6 weeks</b></div><div><span>Regions</span><b>APAC + EMEA</b></div><div><span>Guardrail</span><b>Review ≥ 4.0</b></div><div><span>Owner</span><b>Community Ops</b></div></div>
                <button className="text-button">Open test brief <span>→</span></button>
              </section>
            </div>
            <section className="governance-note"><span>Threshold governance</span><p>Every verdict stores the threshold version used. New rules apply prospectively; they never silently rewrite historical performance.</p></section>
          </div>
        )}
      </section>

      <footer>
        <span>Developer Ecosystem Operations</span>
        <span>Prototype v0.1 · Synthetic data only</span>
        <span>Built to invite better questions</span>
      </footer>
    </main>
  );
}
