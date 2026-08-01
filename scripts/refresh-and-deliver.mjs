const dashboardUrl = (process.env.DASHBOARD_URL || "http://localhost:3000").replace(/\/$/, "");

function urgency(item) {
  return item.severity === "Critical" ? 0 : item.severity === "Watch" ? 1 : 2;
}

function buildDigest(data) {
  const top = [...data.attention]
    .sort((a, b) => urgency(a) - urgency(b) || a.due.localeCompare(b.due))
    .slice(0, 5);
  const live = data.sources.filter((source) => source.mode === "live").length;
  const lines = [
    "*Developer Ecosystem — Monday operating brief*",
    `Sources: ${live} live / ${data.sources.length - live} sample or fallback`,
    `Portfolio: ${data.totals.monthlyActivations} monthly activations · ${data.totals.jiraBlocked} blocked · ${data.totals.playbooksNeedingReview} playbooks to review`,
    "",
    "*Exceptions requiring a decision*",
    ...top.map((item, index) => `${index + 1}. *${item.title}* — ${item.reason}\n   Owner: ${item.owner} · Due: ${item.due}\n   Next: ${item.nextAction}`),
    "",
    `Dashboard: ${dashboardUrl}`,
  ];
  return lines.join("\n");
}

const response = await fetch(`${dashboardUrl}/api/ops`, { headers: { Accept: "application/json" } });
if (!response.ok) throw new Error(`Operations API returned ${response.status}`);
const data = await response.json();
const digest = buildDigest(data);

if (!process.env.SLACK_WEBHOOK_URL) {
  console.log("SLACK_WEBHOOK_URL is not set. Preview only:\n");
  console.log(digest);
  process.exit(0);
}

const delivery = await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: digest }),
});
if (!delivery.ok) throw new Error(`Slack webhook returned ${delivery.status}`);
console.log("Monday operations brief delivered successfully.");
