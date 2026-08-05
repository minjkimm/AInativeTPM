export type ActivationProxy = {
  id: string;
  activationType: string;
  funnelStage: string;
  primaryProxy: string;
  measurementWindow: string;
  actualLabel: string;
  targetLabel: string;
  achieved: boolean;
  attendance: number;
  cost: number;
  decision: string;
  quarterlyReview: "Pending validation";
  synthetic: true;
};

const weeklyProxySample: ActivationProxy[] = [
  { id: "PROXY-01", activationType: "Awareness event", funnelStage: "Reached → Tried", primaryProxy: "Program registrations attributed to the event", measurementWindow: "7 days", actualLabel: "138", targetLabel: "120", achieved: true, attendance: 1640, cost: 42000, decision: "Repeat the format or topic", quarterlyReview: "Pending validation", synthetic: true },
  { id: "PROXY-02", activationType: "Hands-on workshop / lab", funnelStage: "Tried → First success", primaryProxy: "End-to-end lab completion rate", measurementWindow: "Same day", actualLabel: "68%", targetLabel: "75%", achieved: false, attendance: 286, cost: 31000, decision: "Fix the lab before reuse", quarterlyReview: "Pending validation", synthetic: true },
  { id: "PROXY-03", activationType: "Hackathon", funnelStage: "First success → Sustained", primaryProxy: "Projects still active after the event", measurementWindow: "30 days", actualLabel: "46", targetLabel: "40", achieved: true, attendance: 410, cost: 78000, decision: "Repeat only if projects persist", quarterlyReview: "Pending validation", synthetic: true },
  { id: "PROXY-04", activationType: "Recurring local meetup", funnelStage: "Sustained + reach health", primaryProxy: "Net-new developers as a share of attendees", measurementWindow: "Per event", actualLabel: "29%", targetLabel: "35%", achieved: false, attendance: 192, cost: 18000, decision: "Choose the next market or change outreach", quarterlyReview: "Pending validation", synthetic: true },
  { id: "PROXY-05", activationType: "Major conference / GTC", funnelStage: "Reached → Tried", primaryProxy: "Session-to-signup conversion rate", measurementWindow: "14 days", actualLabel: "14%", targetLabel: "12%", achieved: true, attendance: 5200, cost: 290000, decision: "Adjust session mix and booth investment", quarterlyReview: "Pending validation", synthetic: true },
  { id: "PROXY-06", activationType: "Partner / enterprise enablement", funnelStage: "Sustained · organization", primaryProxy: "Support-ask deflection after enablement", measurementWindow: "60 days", actualLabel: "18%", targetLabel: "25%", achieved: false, attendance: 74, cost: 54000, decision: "Renew or redesign the enablement motion", quarterlyReview: "Pending validation", synthetic: true },
  { id: "PROXY-07", activationType: "Open-model Day 0 launch", funnelStage: "Reached + Tried", primaryProxy: "Launch-day readiness completeness", measurementWindow: "Launch day", actualLabel: "100%", targetLabel: "100%", achieved: true, attendance: 0, cost: 67000, decision: "Go or no-go on launch promotion", quarterlyReview: "Pending validation", synthetic: true },
  { id: "PROXY-08", activationType: "University / student program", funnelStage: "Reached · long horizon", primaryProxy: "Certification completions", measurementWindow: "Per cohort", actualLabel: "326", targetLabel: "300", achieved: true, attendance: 480, cost: 92000, decision: "Expand the program or region", quarterlyReview: "Pending validation", synthetic: true },
];

export function syntheticActivationProxies(): ActivationProxy[] {
  return weeklyProxySample.map((row) => ({ ...row }));
}
