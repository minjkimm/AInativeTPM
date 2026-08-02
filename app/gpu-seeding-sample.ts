import { syntheticActivationOutcomes } from "./outcome-sample";

const products: Record<string, string> = {
  Community: "H100 SXM",
  "Developer Advocacy": "L40S",
  "Developer / Agent Experience": "L40S",
  "Open Models": "H200 SXM",
  CUDA: "H100 SXM",
  "Open Source Foundations": "A100 80GB",
};

const deliveryModes: Record<string, string> = {
  Community: "Hosted lab",
  "Developer Advocacy": "Cloud credits",
  "Developer / Agent Experience": "Cloud credits",
  "Open Models": "Cloud credits",
  CUDA: "Hosted lab",
  "Open Source Foundations": "Cloud credits",
};

const utilization = [0.88, 0.82, 0.79, 0.74, 0.91, 0.86, 0.83, 0.77, 0.49, 0.69, 0.92, 0.61, 0.81, 0.76, 0.89, 0.72, 0.58, 0.84, 0.87, 0.90, 0.78, 0.64, 0.75, 0.45];
const recommendations = ["Increase", "Hold", "Hold", "Optimize", "Increase", "Increase", "Hold", "Hold", "Redirect", "Optimize", "Increase", "Optimize", "Hold", "Increase", "Increase", "Optimize", "Redirect", "Increase", "Increase", "Increase", "Optimize", "Redirect", "Hold", "Redirect"];

const pipeline = [
  ["ACT-001", "San Jose Developer Workshop 01", "Americas", "Community", "Partners"],
  ["ACT-002", "Sydney University Bootcamp 88", "APAC", "Open Models", "Students"],
  ["ACT-003", "Global Developer Workshop 13", "Global", "Community", "Students"],
  ["ACT-004", "London University Bootcamp 82", "EMEA", "Open Models", "Maintainers"],
  ["ACT-005", "Sydney Community Meetup 36", "APAC", "Open Source Foundations", "Partners"],
  ["ACT-006", "Tokyo Maintainer Roundtable 59", "APAC", "CUDA", "Developers"],
  ["ACT-007", "Paris Build Day 71", "EMEA", "CUDA", "Partners"],
  ["ACT-008", "Singapore Technical Office Hours 48", "APAC", "Open Source Foundations", "Students"],
  ["ACT-009", "Toronto Agentic AI Clinic 94", "Americas", "Open Models", "Developers"],
  ["ACT-010", "Global Maintainer Roundtable 65", "Global", "CUDA", "Developers"],
  ["ACT-011", "Paris Partner Enablement Lab 19", "EMEA", "Community", "Developers"],
  ["ACT-012", "Toronto Technical Office Hours 42", "Americas", "Open Source Foundations", "Maintainers"],
];

function gpuRate(product: string) {
  if (product.startsWith("H200")) return 5.2;
  if (product.startsWith("H100")) return 4.1;
  if (product.startsWith("A100")) return 3.1;
  return 2.4;
}

export function syntheticGpuSeeds() {
  const pillars = ["Community", "Developer Advocacy", "Developer / Agent Experience", "Open Models", "CUDA", "Open Source Foundations"];
  const historical = syntheticActivationOutcomes().map((outcome, index) => {
    const qualifiedRequests = 36 + ((index * 11) % 85);
    const approvedDevelopers = Math.round(qualifiedRequests * (0.62 + (index % 4) * 0.07));
    const deliveredDevelopers = Math.max(approvedDevelopers - (index % 3), 1);
    const pillarIndex = pillars.indexOf(outcome.pillar);
    const requestedGpuHours = qualifiedRequests * (42 + pillarIndex * 10);
    const grantedGpuHours = approvedDevelopers * (34 + pillarIndex * 8);
    const consumedGpuHours = Math.round(grantedGpuHours * utilization[index]);
    const timeToFirstWorkloadDays = 2 + ((index * 3) % 11);
    const prototypeRate = outcome.outcomeStatus === "Exceeded" ? 0.63 : outcome.outcomeStatus === "Met" ? 0.52 : outcome.outcomeStatus === "Mixed" ? 0.34 : 0.18;
    const prototypesCompleted = Math.round(deliveredDevelopers * prototypeRate);
    const productionPilots = Math.max(Math.round(prototypesCompleted * (0.10 + (pillarIndex % 3) * 0.04)), 0);
    const followOnRequests = Math.round(prototypesCompleted * 0.28);
    const recommendation = recommendations[index];
    const decisionReason = recommendation === "Increase"
      ? `Qualified demand exceeded granted supply; ${Math.round(utilization[index] * 100)}% utilization and ${prototypesCompleted} prototypes support expansion`
      : recommendation === "Redirect"
        ? `Only ${Math.round(utilization[index] * 100)}% of granted GPU hours were consumed; redirect idle capacity before adding supply`
        : recommendation === "Optimize"
          ? `Demand exists, but ${timeToFirstWorkloadDays}-day time to first workload or support intensity should improve before expansion`
          : "Utilization and technical conversion support the current allocation; hold while monitoring follow-on adoption";
    return {
      id: `SEED-${String(index + 1).padStart(3, "0")}`,
      activationId: `HIST-${String(index + 1).padStart(3, "0")}`,
      outcomeId: outcome.id,
      quarter: "FY27 Q2",
      activation: outcome.activation,
      region: outcome.originRegion,
      pillar: outcome.pillar,
      audience: outcome.audience,
      gpuProduct: products[outcome.pillar],
      deliveryMode: deliveryModes[outcome.pillar],
      qualifiedRequests,
      approvedDevelopers,
      deliveredDevelopers,
      requestedGpuHours,
      grantedGpuHours,
      consumedGpuHours,
      utilization: utilization[index],
      timeToFirstWorkloadDays,
      prototypesCompleted,
      productionPilots,
      followOnRequests,
      seedValue: Math.round(grantedGpuHours * gpuRate(products[outcome.pillar])),
      supportCost: 2200 + ((index * 850) % 6500),
      lifecycleStatus: "Completed",
      recommendation,
      decisionReason,
      synthetic: true,
    };
  });

  const pipelineRows = pipeline.map(([activationId, activation, region, pillar, audience], index) => {
    const pillarIndex = pillars.indexOf(pillar);
    const qualifiedRequests = 75 + ((index * 17) % 90);
    const approvedDevelopers = index % 3 === 0 ? Math.round(qualifiedRequests * 0.55) : index % 3 === 1 ? Math.round(qualifiedRequests * 0.38) : 0;
    const requestedGpuHours = qualifiedRequests * (48 + pillarIndex * 10);
    const grantedGpuHours = approvedDevelopers * (38 + pillarIndex * 8);
    const recommendation = ["Community", "Open Models", "CUDA"].includes(pillar) ? "Approve increase" : pillar === "Developer / Agent Experience" ? "Optimize first" : "Hold for evidence";
    const decisionReason = recommendation === "Approve increase"
      ? `Pipeline demand exceeds provisional supply and prior ${pillar} seeds showed strong utilization or technical conversion`
      : recommendation === "Optimize first"
        ? "Approve only after setup and support improvements from the prior cohort are in place"
        : "Keep provisional capacity until the next completed cohort confirms conversion and follow-on demand";
    return {
      id: `PIPE-${String(index + 1).padStart(3, "0")}`,
      activationId,
      outcomeId: "",
      quarter: "FY27 Q3 Pipeline",
      activation,
      region,
      pillar,
      audience,
      gpuProduct: products[pillar],
      deliveryMode: deliveryModes[pillar],
      qualifiedRequests,
      approvedDevelopers,
      deliveredDevelopers: 0,
      requestedGpuHours,
      grantedGpuHours,
      consumedGpuHours: 0,
      utilization: 0,
      timeToFirstWorkloadDays: 0,
      prototypesCompleted: 0,
      productionPilots: 0,
      followOnRequests: 0,
      seedValue: Math.round(grantedGpuHours * gpuRate(products[pillar])),
      supportCost: 0,
      lifecycleStatus: approvedDevelopers > 0 ? "Approved" : "Requested",
      recommendation,
      decisionReason,
      synthetic: true,
    };
  });

  return [...historical, ...pipelineRows];
}
