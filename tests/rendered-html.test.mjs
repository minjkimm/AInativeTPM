import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

function runtime() {
  return {
    waitUntil() {},
    passThroughOnException() {},
  };
}

test("server-renders the finished operations dashboard shell", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    runtime(),
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Developer Ecosystem Operations<\/title>/i);
  assert.match(html, /What needs/);
  assert.match(html, />Budget</);
  assert.match(html, /Results \+ playbook/);
  assert.match(html, /Monday review/);
  assert.match(html, /Executive copilot/);
  assert.match(html, /Data sources/);
  assert.match(html, /Source-backed operating data/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps the production source adapters and removes starter assets", async () => {
  const [route, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/api/ops/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(route, /JIRA_DEMO_SHEET_ID/);
  assert.match(route, /SMARTSHEET_DEMO_SHEET_ID/);
  assert.match(route, /SMARTSHEET_DEMO_TOTAL_RANGE/);
  assert.match(route, /SMARTSHEET_DEMO_OUTCOME_RANGE/);
  assert.match(route, /SMARTSHEET_DEMO_GPU_RANGE/);
  assert.doesNotMatch(route, /SMARTSHEET_DEMO_TOTAL\s*\|\|\s*112/);
  assert.match(route, /GOOGLE_BUDGET_SHEET_ID/);
  assert.match(route, /GOOGLE_ASSET_REGISTER_SHEET_ID/);
  assert.match(route, /Connected synthetic Jira feed/);
  assert.match(route, /Authenticated Jira REST API/);
  assert.match(page, /Connected demo feed/);
  assert.match(page, /Where should GPU seeding change/);
  assert.match(page, /View source data/);
  assert.match(page, /What do we repeat/);
  assert.match(page, /Did each activation type achieve its leading goal/);
  assert.match(page, /Accelerated applications/);
  assert.doesNotMatch(page, /HANDBOOK = THE SYSTEM CHANGE/);
  assert.doesNotMatch(page, /Decision basis/);
  assert.doesNotMatch(page, /Technical conversion|Historical utilization/);
  assert.match(page, /Additional budget approval/);
  assert.match(page, /<b>Q4 decision rationale<\/b>/);
  assert.match(page, /Replace regional worksheets with one standard template/);
  assert.match(page, /Add a required follow-up-owner field/);
  assert.match(page, /Meets the seeding-change criteria/);
  assert.match(page, /5 min/);
  assert.match(page, /These are meeting timeboxes, not item counts/);
  assert.match(page, /H100 \(Hopper GPU\)/);
  assert.match(page, /H200 \(Hopper GPU, higher memory\)/);
  assert.doesNotMatch(page, /What changed<br \/>since last Monday/);
  assert.doesNotMatch(page, /Approve another preview only after|Approve the next cohort only after/);
  assert.doesNotMatch(page, /only after this change/);
  assert.doesNotMatch(page, /Met or exceeded target/);
  assert.doesNotMatch(page, /Weekly digest|Slack webhook|GitHub Actions schedule/);
  assert.match(layout, /title:\s*"Developer Ecosystem Operations"/);
  assert.doesNotMatch(packageJson, /"digest"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

test("normalizes formatted budget currency from source payloads", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/ops"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    runtime(),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.budgets[0].budget, 520000);
  assert.equal(payload.budgets[0].forecast, 568000);
  assert.equal(payload.totals.monthlyActivations, 112);
  assert.equal(payload.totals.jiraItems, 47);
  assert.equal(payload.totals.jiraBlocked, 6);
  assert.equal(payload.totals.jiraOverdue, 5);
  assert.equal(payload.outcomes.length, 24);
  assert.equal(payload.activationProxies.length, 8);
  assert.equal(payload.activationProxies.filter((item) => item.achieved).length, 5);
  assert.equal(payload.activationProxies.some((item) => item.activationType === "Content, samples, docs"), false);
  assert.equal(payload.activationProxies.some((item) => item.activationType === "Ambassador / champion program"), false);
  assert.equal(payload.activations.find((item) => item.name === "New York Developer Activation 02").region, "Americas");
  assert.equal(payload.activations.find((item) => item.name === "London Developer Activation 03").region, "EMEA");
  assert.notEqual(payload.activations.find((item) => item.name === "New York Developer Activation 02").risk, payload.activations.find((item) => item.name === "Sydney Developer Activation 08").risk);
  assert.equal(payload.activations.find((item) => item.name === "Sydney Developer Activation 08").risk.includes("core technical content is approved"), true);
  assert.equal(payload.activations.some((item) => item.risk === "Required technical approval is incomplete"), false);
  assert.equal(payload.activations.some((item) => item.risk === "Readiness review and support ownership are incomplete"), false);
  assert.equal(payload.gpuSeeds.length, 36);
  assert.equal(payload.gpuSeeds.filter((item) => item.lifecycleStatus === "Completed").length, 24);
  assert.equal(payload.gpuSeeds.filter((item) => item.quarter.includes("Pipeline")).length, 12);
  assert.equal(payload.gpuSeeds.every((item) => !item.quarter.includes("Pipeline") || item.quarter === "FY27 Q4 Pipeline"), true);
  assert.equal(payload.attention.some((item) => item.title.includes("Q4 GPU-seeding allocation")), true);
  assert.equal(payload.budgets[0].gpuSeedBudget, 160000);
  assert.equal(payload.budgets[0].gpuSeedForecast, 185000);
  assert.equal(payload.outcomes.filter((item) => item.outcomeStatus === "Met" || item.outcomeStatus === "Exceeded").length, 18);
  assert.equal(payload.outcomes.some((item) => item.activation === "Global Open-Source Software Office Hours"), true);
  assert.equal(payload.outcomes.find((item) => item.activation === "Munich Open Models Preview").strategicOutcome.includes("External enterprise and technology teams"), true);
  assert.equal(payload.attention.some((item) => item.title === "Complete September program readiness review"), true);
  assert.equal(payload.budgets[0].recommendation.includes("regional delivery"), true);
});
