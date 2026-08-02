const regions = ["Americas", "EMEA", "APAC", "Global"];

const pillars = [
  "Community",
  "Developer Advocacy",
  "Developer / Agent Experience",
  "Open Models",
  "CUDA",
  "Open Source Foundations",
];

const owners: Record<string, string> = {
  Community: "Amina Diallo",
  "Developer Advocacy": "Noah Williams",
  "Developer / Agent Experience": "Maya Chen",
  "Open Models": "Diego Ruiz",
  CUDA: "Priya Nair",
  "Open Source Foundations": "Elena Park",
};

const configs: Record<string, { audience: string; outcome: string; metric: string; unit: string; target: number; playbook: string; asset: string }> = {
  Community: { audience: "Developers", outcome: "Developers complete a guided build and commit to a next technical step", metric: "Qualified follow-up commitments", unit: "developers", target: 90, playbook: "Regional Delivery Playbook", asset: "Facilitator kit + lab guide" },
  "Developer Advocacy": { audience: "Content creators", outcome: "Technical creators publish or adapt accurate enablement content", metric: "Approved content packages", unit: "assets", target: 18, playbook: "Activation Readiness Checklist", asset: "Content brief + review rubric" },
  "Developer / Agent Experience": { audience: "Application developers", outcome: "Developers resolve onboarding friction and complete the first workflow", metric: "Completed onboarding workflows", unit: "developers", target: 70, playbook: "Cross-Pillar Risk Intake and Triage", asset: "Office-hours runbook + issue taxonomy" },
  "Open Models": { audience: "Partners", outcome: "Partners complete a model evaluation and name the next adoption step", metric: "Completed partner evaluations", unit: "evaluations", target: 24, playbook: "Program Launch Readiness Checklist", asset: "Evaluation worksheet + model card guide" },
  CUDA: { audience: "Technical developers", outcome: "Developers complete a performance lab and identify an optimization opportunity", metric: "Completed performance labs", unit: "developers", target: 65, playbook: "Technical Review and Approval Guide", asset: "Performance lab + facilitator notes" },
  "Open Source Foundations": { audience: "Maintainers", outcome: "Maintainers commit to a concrete governance or contribution action", metric: "Maintainer commitments", unit: "commitments", target: 14, playbook: "Maintainer Engagement Operating Guide", asset: "Maintainer agenda + decision log" },
};

const names: Record<string, string[]> = {
  Americas: ["Austin Agent Builders Day", "Toronto Technical Content Lab", "San Jose Onboarding Clinic", "New York Model Evaluation Sprint", "Toronto CUDA Performance Lab", "Austin Maintainer Roundtable"],
  EMEA: ["Paris Community Lab", "Berlin Blueprint Workshop", "London Agent Experience Lab", "Munich Open Models Preview", "Paris CUDA Bootcamp", "London Foundation Working Session"],
  APAC: ["Seoul Developer Build Day", "Tokyo Developer Advocacy Summit", "Singapore DX Office Hours", "Bengaluru Partner Evaluation Lab", "Sydney Accelerated Computing Lab", "Tokyo Maintainer Summit"],
  Global: ["Global Community Office Hours", "Global Content Creator Sprint", "Global Support Routing Pilot", "Global Model Card Workshop", "Global CUDA Clinic", "Global OSS Office Hours"],
};

const statuses = ["Exceeded", "Met", "Met", "Mixed", "Met", "Exceeded", "Met", "Met", "Missed", "Met", "Exceeded", "Mixed", "Met", "Met", "Exceeded", "Met", "Mixed", "Met", "Met", "Exceeded", "Met", "Mixed", "Met", "Missed"];
const recommendations = ["Scale", "Standardize", "Standardize", "Adjust", "Scale", "Scale", "Standardize", "Standardize", "Stop", "Adjust", "Scale", "Adjust", "Standardize", "Scale", "Scale", "Standardize", "Adjust", "Scale", "Standardize", "Scale", "Scale", "Adjust", "Standardize", "Stop"];
const reuse = ["EMEA, APAC", "Americas, APAC", "EMEA", "APAC", "EMEA, APAC", "EMEA", "APAC", "Americas", "", "Global", "Americas, EMEA", "EMEA", "APAC", "Global", "Americas, EMEA", "APAC", "", "Americas", "EMEA, APAC", "Global", "Americas", "", "EMEA", ""];
const learnings = [
  "Keep the guided build under 90 minutes and assign one facilitator per 35 developers.",
  "Reuse the review rubric before localization; regional examples can change after technical approval.",
  "Publish the issue taxonomy before office hours so experts spend time resolving patterns, not routing.",
  "Partner evaluations need a named follow-up owner before the preview closes.",
  "Pre-stage performance profiles; setup variance was the largest source of lost lab time.",
  "Small maintainer groups produced clearer commitments when every topic ended with an owner and date.",
  "Regional co-facilitation improved completion and reduced dependence on headquarters speakers.",
  "A single content brief shortened review time; add a localization checkpoint for regional publishing.",
  "Registration volume was high but the workflow was too broad; split onboarding by developer maturity.",
  "Evaluation worksheets made partner next steps comparable across account teams.",
  "Pair the lab with a reusable profiling checklist and collect optimization examples for the next cohort.",
  "Decision logs need a pre-read; live note-taking alone did not surface unresolved governance questions.",
  "Office hours scale when intake is categorized 24 hours before the session.",
  "Creators reused examples faster when the approved claims and prohibited claims were explicit.",
  "APAC office hours performed best with two shorter sessions and an asynchronous issue queue.",
  "Model previews should include a standard evaluation baseline plus one partner-specific scenario.",
  "Large bootcamps need a prerequisite check; otherwise advanced facilitators are pulled into setup support.",
  "Maintainer roundtables convert better when contribution opportunities are shared one week in advance.",
  "Use a regional host and a central technical reviewer; this preserves quality without creating a speaker bottleneck.",
  "Template-based content production increased throughput while keeping technical review centralized.",
  "Support-routing pilots should publish service levels and an escalation path before opening intake.",
  "The model card workshop should ship a completed example, not only a blank template.",
  "Global CUDA clinics work best as a recurring series with the same lab environment and rotating examples.",
  "Attendance did not translate into commitments; replace the broad office hour with issue-specific clinics.",
];

export function syntheticActivationOutcomes() {
  let index = 0;
  return regions.flatMap((region, regionIndex) => pillars.map((pillar, pillarIndex) => {
    const config = configs[pillar];
    const status = statuses[index];
    const target = config.target + regionIndex * 3;
    const factor = status === "Exceeded" ? 1.24 : status === "Met" ? 1.08 : status === "Mixed" ? 0.82 : 0.58;
    const actual = Math.round(target * factor);
    const cost = 12000 + ((index * 4700) % 42000);
    const outcome = {
      id: `OUT-${String(index + 1).padStart(3, "0")}`,
      activation: names[region][pillarIndex],
      completionDate: `2026-${regionIndex < 2 ? "06" : "07"}-${String(8 + ((index * 3) % 20)).padStart(2, "0")}`,
      originRegion: region,
      pillar,
      audience: config.audience,
      strategicOutcome: config.outcome,
      successMetric: config.metric,
      unit: config.unit,
      target,
      actual,
      outcomeStatus: status,
      cost,
      costPerOutcome: Math.round(cost / Math.max(actual, 1)),
      reusableAsset: status === "Missed" ? "No reusable asset approved" : config.asset,
      regionsReusing: reuse[index].split(",").map((item) => item.trim()).filter(Boolean),
      learning: learnings[index],
      recommendation: recommendations[index],
      playbook: config.playbook,
      owner: owners[pillar],
      synthetic: true,
    };
    index += 1;
    return outcome;
  }));
}
