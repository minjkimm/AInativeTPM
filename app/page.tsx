"use client";

import { useMemo, useState } from "react";

type View = "system" | "pillars" | "meeting" | "scale";
type PillarId = "community" | "advocacy" | "dx" | "models";

const pillars = [
  {
    id: "community" as PillarId,
    number: "01",
    name: "Community",
    role: "Find and activate the right builders",
    unit: "Qualified developer or team engagement",
    success: "A target developer advances to a committed technical next step—and the field signal reaches the team that can act on it.",
    metric: "63",
    metricLabel: "qualified teams engaged",
    movement: "42 advanced a stage",
    status: "healthy",
    color: "green",
    checks: [
      ["Audience quality", "Target segment or leverage developer, not raw attendance"],
      ["Technical movement", "Build, evaluation, integration, or contribution starts"],
      ["Signal captured", "Friction and intent routed with product + owner"],
      ["Repeatability", "Regional team can reproduce the motion from a playbook"],
    ],
    decisions: "Where to engage, which developers merit depth, and which motion can move to a region or Champion.",
    failure: "A full room with no technical next step, or the same developers counted repeatedly as new reach.",
  },
  {
    id: "advocacy" as PillarId,
    number: "02",
    name: "Developer Advocacy",
    role: "Turn complex technology into a working path",
    unit: "Reusable sample, guide, demo, or technical narrative",
    success: "The intended developer can discover the asset, complete the workflow, and progress without expert rescue.",
    metric: "18",
    metricLabel: "enablement assets in use",
    movement: "71% workflow completion",
    status: "watch",
    color: "amber",
    checks: [
      ["Coverage", "Priority workload and journey stage has a maintained path"],
      ["Completion", "Target developer reaches the defined working result"],
      ["Behavior change", "Asset leads to evaluation, build, or deployment"],
      ["Maintenance", "Owner, version compatibility, and refresh trigger exist"],
    ],
    decisions: "What to create, repair, retire, or modularize—and where expert time has become repeat support.",
    failure: "High page views with low completion, or a polished demo that cannot survive a version change.",
  },
  {
    id: "dx" as PillarId,
    number: "03",
    name: "Developer Experience",
    role: "Remove friction from the product journey",
    unit: "Verified friction cluster removed",
    success: "A recurring blocker is reproduced, owned, fixed or mitigated, and shown to reduce developer failure or time-to-success.",
    metric: "17",
    metricLabel: "friction clusters open",
    movement: "6 beyond 7-day SLA",
    status: "critical",
    color: "red",
    checks: [
      ["Signal quality", "Reproducible issue with affected segment and journey stage"],
      ["Severity", "Reach × impact × strategic importance is understood"],
      ["Closure", "Product, documentation, sample, or support owner commits"],
      ["Verification", "Failure rate or time-to-success improves after change"],
    ],
    decisions: "Which friction receives scarce engineering attention, which team owns it, and what can be deflected through enablement.",
    failure: "Closing a ticket without verifying the developer journey, or treating fifty duplicate reports as fifty unrelated issues.",
  },
  {
    id: "models" as PillarId,
    number: "04",
    name: "Lighthouse Models",
    role: "Make strategic models excellent on the platform",
    unit: "Model × platform launch package",
    success: "Optimized performance, a usable deployment path, technical enablement, and ecosystem activation arrive as one launch—not four handoffs.",
    metric: "4",
    metricLabel: "model packages in flight",
    movement: "2 ready · 2 blocked",
    status: "watch",
    color: "blue",
    checks: [
      ["Priority", "Model matters to a strategic workload or influential builders"],
      ["Performance", "Quality, latency, throughput, and hardware coverage validated"],
      ["Launch completeness", "NIM/API, sample, docs, demo, and support path align"],
      ["Early adoption", "Target developers evaluate and begin real integrations"],
    ],
    decisions: "Which models receive optimization depth, whether a launch is actually ready, and where cross-team sequencing is blocked.",
    failure: "A benchmark-ready model whose sample, docs, or deployment path sends developers into a dead end.",
  },
];

const decisions = [
  {
    id: "D-01",
    urgency: "Decide Monday",
    title: "Pause broad promotion until the NIM quickstart path is repaired?",
    evidence: [
      ["Community", "197 developers attempted the workflow after 6 activations"],
      ["Advocacy", "96 of 142 quickstart users reached the auth/config step"],
      ["DX", "61 failures share one reproducible credential/config pattern"],
      ["Models", "Optimized endpoint is ready; starter repository is one version behind"],
    ],
    recommendation: "Yes. Redirect 6 staff-days from the next broad activation: 3 to the DX fix, 2 to the quickstart update, 1 to a 30-developer validation lab.",
    consequence: "Expected: restore completion from 32% to ≥70% before adding reach.",
    owner: "DX lead + Advocacy lead",
    due: "Fix Thu · validate Fri",
  },
  {
    id: "D-02",
    urgency: "Launch gate",
    title: "Is the Nemotron model package ready for an external launch motion?",
    evidence: [
      ["Models", "Latency and throughput checks pass on 3 target configurations"],
      ["Advocacy", "Deployment guide passes internally, but zero external cold-start tests"],
      ["Community", "2 Champions available for an independent build test"],
      ["DX", "Support routing and known-issues owner are not assigned"],
    ],
    recommendation: "Not yet. Run two cold-start builds and assign the first-14-day support owner; release when both gates close.",
    consequence: "Cost of a one-week hold is lower than scaling a broken first-run experience.",
    owner: "Model launch DRI",
    due: "Gate review Sep 9",
  },
  {
    id: "D-03",
    urgency: "Scale call",
    title: "Can the core team stop traveling for the CUDA workshop series?",
    evidence: [
      ["Community", "Regional delivery matched core-team target audience in 3 of 3 pilots"],
      ["Advocacy", "Facilitator kit completion varied by only 6 percentage points"],
      ["DX", "No new high-severity friction appeared in regional delivery"],
      ["Operations", "Delegation returns 4 core staff-days and $11.8K per month"],
    ],
    recommendation: "Yes for the proven workshop format. Regionalize delivery; retain one rotating expert office hour and a monthly quality sample.",
    consequence: "Reinvest returned time in model-launch enablement and friction closure.",
    owner: "Community APAC + EMEA",
    due: "Transition Sep 16",
  },
];

const scaleConfig = [
  { id: "community", name: "Community", base: 28, demandRate: 1, leverage: 5, lever: "Regional delivery + playbooks", breakAt: "5.0×" },
  { id: "advocacy", name: "Advocacy", base: 12, demandRate: .35, leverage: 3.5, lever: "Modular assets + version triggers", breakAt: "8.1×" },
  { id: "dx", name: "Developer Experience", base: 24, demandRate: .62, leverage: 2, lever: "Signal dedup + self-service", breakAt: "2.6×" },
  { id: "models", name: "Lighthouse Models", base: 4, demandRate: .22, leverage: 2.2, lever: "Standard launch package", breakAt: "6.5×" },
];

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function PillarTag({ id, children }: { id: string; children: React.ReactNode }) {
  return <span className={`pillar-tag pillar-tag-${id}`}>{children}</span>;
}

export default function Home() {
  const [view, setView] = useState<View>("system");
  const [selectedPillar, setSelectedPillar] = useState<PillarId>("community");
  const [scale, setScale] = useState(10);
  const [copied, setCopied] = useState(false);

  const pillar = pillars.find((item) => item.id === selectedPillar)!;
  const scaleRows = useMemo(() => scaleConfig.map((item) => {
    const required = item.base * (1 + item.demandRate * (scale - 1));
    const capacity = item.base * item.leverage;
    return { ...item, required, capacity, gap: Math.max(0, required - capacity), utilization: Math.round(required / capacity * 100) };
  }), [scale]);

  async function copyMeeting() {
    const text = [
      "DEVELOPER ECOSYSTEM — MONDAY DECISION REVIEW",
      "Outcome movement (5 min): 37 applications advanced; one shared build-path constraint.",
      ...decisions.map((item) => `${item.id} — ${item.title}\nRECOMMENDATION: ${item.recommendation}\nOWNER: ${item.owner} · ${item.due}`),
      "Close (5 min): read back decisions, owners, dates, and playbook changes.",
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
          <span>Developer Ecosystem <b>/ Decision System</b></span>
        </a>
        <div className="header-meta">
          <Badge tone="sample">● Synthetic prototype</Badge>
          <span className="updated">Research model · v0.2</span>
          <button className="avatar" aria-label="Profile">MK</button>
        </div>
      </header>

      <section className="shell" id="top">
        <div className="intro-row v2-intro">
          <div>
            <p className="eyebrow">WEEKLY OPERATING REVIEW · SEP 2</p>
            <h1>Where is developer<br />momentum stuck?</h1>
          </div>
          <div className="intro-note">
            <span className="note-index">V2</span>
            <p>Success is movement toward an accelerated application. Each pillar owns a different intervention; the operating system joins the evidence.</p>
          </div>
        </div>

        <nav className="view-tabs four-tabs" aria-label="Dashboard views">
          {([
            ["system", "System health", "1 constraint"],
            ["pillars", "Success by pillar", "4 definitions"],
            ["meeting", "Monday decisions", "3 calls"],
            ["scale", "10× capacity", "breaks at 2.6×"],
          ] as const).map(([id, label, detail]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} aria-pressed={view === id}>
              <span>{label}</span><small>{detail}</small>
            </button>
          ))}
        </nav>

        {view === "system" && (
          <div className="view-content">
            <section className="north-star">
              <div className="north-title">
                <p className="eyebrow">NORTH-STAR PROXY</p>
                <h2>37 applications advanced a stage</h2>
                <p>Observed movement in evaluation, build, integration, optimization, or ship—not a claim of attributable compute demand.</p>
              </div>
              <div className="north-metrics">
                <div><strong>12</strong><span>production-bound</span><small>↗ 3 vs prior week</small></div>
                <div><strong>83%</strong><span>evidence coverage</span><small>6 journeys incomplete</small></div>
                <div><strong>9</strong><span>leverage developers</span><small>maintainers + platform builders</small></div>
              </div>
            </section>

            <section className="journey-panel panel">
              <div className="panel-heading">
                <div><p className="eyebrow">THE SHARED FLOW</p><h2>Four pillars, one developer journey</h2></div>
                <p className="heading-note">Counts are distinct teams · synthetic</p>
              </div>
              <div className="journey-flow">
                {[
                  ["01", "Qualified signal", "63", "Community"],
                  ["02", "Working path started", "42", "Advocacy"],
                  ["03", "Critical friction cleared", "31", "Developer Experience"],
                  ["04", "Optimized integration", "24", "Lighthouse Models"],
                  ["05", "Production-bound", "12", "Shared outcome"],
                ].map(([num, label, value, owner], index) => (
                  <div className="journey-step" key={label}>
                    <div className="journey-top"><span>{num}</span>{index < 4 && <i aria-hidden="true">→</i>}</div>
                    <strong>{value}</strong><b>{label}</b><small>{owner}</small>
                  </div>
                ))}
              </div>
              <div className="journey-warning"><span>!</span><p><b>Do not read this as a conversion funnel.</b> Teams may enter at different stages. It is a stage-movement view used to find stuck work, not to claim causal attribution.</p></div>
            </section>

            <section className="pillar-snapshot-grid">
              {pillars.map((item) => (
                <button className={`pillar-snapshot pillar-${item.color}`} key={item.id} onClick={() => { setSelectedPillar(item.id); setView("pillars"); }}>
                  <div className="snapshot-top"><span>{item.number}</span><Badge tone={item.status}>{item.status}</Badge></div>
                  <h3>{item.name}</h3><p>{item.role}</p>
                  <strong>{item.metric}</strong><small>{item.metricLabel}</small>
                  <div className="snapshot-movement">{item.movement}<span>→</span></div>
                </button>
              ))}
            </section>

            <section className="evidence-chain panel">
              <div className="chain-title">
                <p className="eyebrow">THIS WEEK’S OPERATING CONCLUSION</p>
                <h2>Do not buy more reach into a broken build path.</h2>
                <p>Six activations exposed one cross-pillar constraint. The event result is only the first signal.</p>
              </div>
              <div className="chain-evidence">
                <div><PillarTag id="community">Community</PillarTag><strong>197</strong><p>developers attempted the NIM workflow</p></div>
                <span className="chain-arrow">→</span>
                <div><PillarTag id="advocacy">Advocacy</PillarTag><strong>96</strong><p>reached the same auth/config step</p></div>
                <span className="chain-arrow">→</span>
                <div><PillarTag id="dx">DX</PillarTag><strong>61</strong><p>failed on one reproducible pattern</p></div>
                <span className="chain-arrow">→</span>
                <div><PillarTag id="models">Models</PillarTag><strong>1 ver.</strong><p>starter repository behind endpoint</p></div>
              </div>
              <div className="chain-decision">
                <span>Recommended call</span>
                <p>Redirect <b>6 staff-days</b> from the next broad activation: fix the product path, update the quickstart, then validate with 30 cold-start developers.</p>
                <button className="text-button" onClick={() => setView("meeting")}>Take to Monday <span>→</span></button>
              </div>
            </section>

            <section className="principles-row">
              <div><span>Success</span><p>Verified developer movement toward a valuable accelerated application.</p></div>
              <div><span>Efficiency</span><p>Staff-days and dollars per stage advanced—not per attendee.</p></div>
              <div><span>Leverage</span><p>Influence, reuse, regional execution, and downstream developer reach.</p></div>
              <div><span>Honesty</span><p>Observed facts, proxies, and unknowns remain visibly separate.</p></div>
            </section>
          </div>
        )}

        {view === "pillars" && (
          <div className="view-content pillars-view">
            <section className="definition-hero">
              <div><p className="eyebrow">WHAT CONSISTS OF SUCCESS?</p><h2>Not one score.<br />One mission, four contracts.</h2></div>
              <p>Each pillar has a distinct unit of work and must prove its contribution to developer movement. Shared lenses—impact, effort, confidence, repeatability—support allocation without pretending the work is identical.</p>
            </section>

            <div className="pillar-selector" role="tablist" aria-label="Select pillar">
              {pillars.map((item) => (
                <button key={item.id} className={selectedPillar === item.id ? `active selector-${item.color}` : ""} onClick={() => setSelectedPillar(item.id)} role="tab" aria-selected={selectedPillar === item.id}>
                  <span>{item.number}</span><b>{item.name}</b><small>{item.unit}</small>
                </button>
              ))}
            </div>

            <section className={`pillar-detail detail-${pillar.color}`}>
              <div className="detail-summary">
                <PillarTag id={pillar.id}>{pillar.name}</PillarTag>
                <h2>{pillar.success}</h2>
                <div className="unit-box"><span>Unit of work</span><b>{pillar.unit}</b></div>
              </div>
              <div className="success-checks">
                <p className="eyebrow">SUCCESS REQUIRES ALL FOUR</p>
                {pillar.checks.map(([name, detail], index) => (
                  <div className="success-check" key={name}><span>0{index + 1}</span><div><b>{name}</b><p>{detail}</p></div></div>
                ))}
              </div>
              <div className="decision-contract">
                <div><span>Decision this evidence changes</span><p>{pillar.decisions}</p></div>
                <div className="anti-success"><span>Looks busy, but fails</span><p>{pillar.failure}</p></div>
              </div>
            </section>

            <section className="scorecard-rules panel">
              <div><p className="eyebrow">ORG-LEVEL SUCCESS</p><h2>Mission outcome + four guardrails</h2></div>
              <div className="scorecard-rule primary-rule"><span>Outcome</span><b>Valuable accelerated applications advance</b><p>Evaluation → build → integration → optimization → ship</p></div>
              <div className="scorecard-rule"><span>Strategic leverage</span><b>Who moved?</b><p>Influential maintainer, platform builder, partner, or net-new segment</p></div>
              <div className="scorecard-rule"><span>Developer reality</span><b>Did friction fall?</b><p>Sentiment, completion, time-to-success, and repeat issue rate</p></div>
              <div className="scorecard-rule"><span>Economics</span><b>What did movement cost?</b><p>Staff-days, dollars, scarce expertise, and opportunity cost</p></div>
              <div className="scorecard-rule"><span>Scale</span><b>Can others repeat it?</b><p>Reusable asset, playbook maturity, and regional independence</p></div>
            </section>
          </div>
        )}

        {view === "meeting" && (
          <div className="view-content meeting-view-v2">
            <section className="meeting-hero v2-meeting-hero">
              <div><p className="eyebrow">MONDAY · 30 MINUTES · DECISION REVIEW</p><h2>Three calls.<br />Zero status tours.</h2><p>The pre-read carries pillar metrics and project updates. Live time is reserved for choices that cross ownership boundaries or move resources.</p></div>
              <div className="meeting-actions"><span><b>3</b> decisions ready</span><button className="copy-button" onClick={copyMeeting}>{copied ? "Copied ✓" : "Copy decision brief"}</button></div>
            </section>

            <section className="meeting-rulebar">
              <div><b>05</b><span>Outcome movement<br />and changed facts</span></div>
              <div><b>20</b><span>Three decisions<br />with recommendations</span></div>
              <div><b>05</b><span>Read back owners,<br />dates, and playbook edits</span></div>
              <p>If an item needs no decision, escalation, or owner change, it stays in the pre-read.</p>
            </section>

            <div className="decision-queue">
              {decisions.map((item) => (
                <article className="decision-card" key={item.id}>
                  <div className="decision-card-head"><span>{item.id}</span><Badge tone={item.id === "D-01" ? "critical" : "neutral"}>{item.urgency}</Badge><h2>{item.title}</h2></div>
                  <div className="decision-evidence-grid">
                    {item.evidence.map(([source, fact]) => <div key={source}><PillarTag id={source === "Developer Experience" ? "dx" : source === "Lighthouse Models" ? "models" : source.toLowerCase()}>{source}</PillarTag><p>{fact}</p></div>)}
                  </div>
                  <div className="recommendation-box"><span>RECOMMENDATION</span><p>{item.recommendation}</p><small>{item.consequence}</small></div>
                  <div className="decision-owner"><span>{item.owner}</span><b>{item.due}</b></div>
                </article>
              ))}
            </div>

            <section className="meeting-output panel">
              <div><p className="eyebrow">MEETING OUTPUT</p><h2>The record writes itself.</h2></div>
              <div className="output-cols"><div><span>Decision</span><p>Chosen option + reasoning</p></div><div><span>Commitment</span><p>One owner + observable result</p></div><div><span>Deadline</span><p>Date + escalation trigger</p></div><div><span>Learning</span><p>Threshold or playbook change</p></div></div>
            </section>
          </div>
        )}

        {view === "scale" && (
          <div className="view-content scale-view">
            <section className="scale-hero">
              <div><p className="eyebrow">WHAT “BREAKS AT 10×” MEANS</p><h2>Demand grows.<br />Work does not grow evenly.</h2><p>A pillar breaks when required work exceeds effective capacity after reuse, delegation, automation, and deduplication. This is a scenario model—not an observed NVIDIA constraint.</p></div>
              <div className="formula-box"><span>CAPACITY TEST</span><code>required work =<br />base work × demand curve</code><code>effective capacity =<br />base capacity × leverage</code><b>BREAK: required &gt; capacity</b></div>
            </section>

            <section className="scale-controls" aria-label="Scale scenario">
              <span>Developer engagement scenario</span>
              <div>{[2, 5, 10].map((value) => <button key={value} className={scale === value ? "active" : ""} onClick={() => setScale(value)}>{value}×</button>)}</div>
              <p>Model changes instantly. Demand curves are deliberately different by pillar.</p>
            </section>

            <section className="capacity-table panel">
              <div className="capacity-head"><span>Pillar</span><span>Why demand grows</span><span>Required work</span><span>Effective capacity</span><span>Load</span><span>Break point</span></div>
              {scaleRows.map((row) => (
                <div className={`capacity-row ${row.gap > 0 ? "over-capacity" : ""}`} key={row.id}>
                  <div><PillarTag id={row.id}>{row.name}</PillarTag></div>
                  <p>{row.id === "community" ? "Engagement scales directly" : row.id === "advocacy" ? "Assets reuse across audiences" : row.id === "dx" ? "Issues deduplicate, but closure stays expert-heavy" : "Launch roadmap grows slower than reach"}</p>
                  <strong>{Math.round(row.required)}<small> units/mo</small></strong>
                  <strong>{Math.round(row.capacity)}<small> units/mo</small></strong>
                  <div className="load-cell"><div><i style={{ width: `${Math.min(row.utilization, 100)}%` }} /></div><b>{row.utilization}%</b>{row.gap > 0 && <small>gap {Math.round(row.gap)}</small>}</div>
                  <span className="break-point">{row.breakAt}</span>
                </div>
              ))}
            </section>

            <section className="first-break">
              <span className="break-number">2.6×</span>
              <div><p className="eyebrow">FIRST CONSTRAINT IN THIS MODEL</p><h2>Developer Experience—not event production.</h2><p>Community can delegate a proven motion. Advocacy can reuse modular assets. Friction signals can be deduplicated, but reproducing, prioritizing, routing, and verifying product fixes still consumes scarce technical judgment.</p></div>
              <div className="break-actions"><span>Capacity response</span><ol><li>Cluster duplicate field signals automatically.</li><li>Reserve engineering SLA for high-leverage journeys.</li><li>Shift repeated help into maintained samples.</li><li>Verify fixes with cold-start developers.</li></ol></div>
            </section>

            <section className="scale-caveats panel">
              <div><span>01</span><p><b>10× what?</b><br />Reach, qualified teams, applications, and model launches grow at different rates. Choose the demand variable first.</p></div>
              <div><span>02</span><p><b>Do not add headcount from this chart.</b><br />Measure actual work arrival, cycle time, queue age, and staff-days before making an allocation case.</p></div>
              <div><span>03</span><p><b>The handoff may be the constraint.</b><br />Even healthy pillars fail when launch readiness, enablement, and support arrive out of sequence.</p></div>
            </section>
          </div>
        )}

        <section className="research-basis">
          <div><p className="eyebrow">PUBLIC RESEARCH BASIS</p><p>This proposed operating model is inferred from public NVIDIA developer materials and the interview transcript. It does not represent internal NVIDIA definitions or data.</p></div>
          <div className="source-links">
            <a href="https://developer.nvidia.com/developer-program" target="_blank" rel="noreferrer">Developer journey ↗</a>
            <a href="https://developer.nvidia.com/developer-champions-program" target="_blank" rel="noreferrer">Community leverage ↗</a>
            <a href="https://developer.nvidia.com/nim" target="_blank" rel="noreferrer">Try–build–deploy + optimization ↗</a>
            <a href="https://jobs.nvidia.com/careers/job/893395219570" target="_blank" rel="noreferrer">Adoption + field insight ↗</a>
          </div>
        </section>
      </section>

      <footer><span>Developer Ecosystem Decision System</span><span>Prototype v0.2 · Synthetic data</span><span>Built to expose decisions, not activity</span></footer>
    </main>
  );
}
