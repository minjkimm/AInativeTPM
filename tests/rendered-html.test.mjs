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
  assert.match(html, /Calendar \+ budget/);
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
  assert.doesNotMatch(route, /SMARTSHEET_DEMO_TOTAL\s*\|\|\s*112/);
  assert.match(route, /GOOGLE_BUDGET_SHEET_ID/);
  assert.match(route, /GOOGLE_ASSET_REGISTER_SHEET_ID/);
  assert.match(route, /Connected synthetic Jira feed/);
  assert.match(route, /Authenticated Jira REST API/);
  assert.match(page, /Connected demo feed/);
  assert.match(layout, /title:\s*"Developer Ecosystem Operations"/);
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
  assert.equal(payload.totals.monthlyActivations, 8);
});
