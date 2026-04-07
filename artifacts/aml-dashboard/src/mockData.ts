import type { Alert, AlertDetail, MetricsSummary } from "@workspace/api-client-react";

const now = Date.now();
const iso = (offset: number) => new Date(now - offset).toISOString();

export const mockMetrics: MetricsSummary = {
  totalAlerts: 142,
  aiConfirmedRisks: 18,
  potentialFalsePositives: 42,
  pendingReview: 82,
  systemStatus: "READY",
};

export const mockAlerts: Alert[] = [
  {
    alertId: "ALT-001",
    accountId: "ACCT-8821",
    accountName: "Global Trade Corp",
    riskScore: 94,
    severity: "CRITICAL",
    flagCount: 4,
    primaryFlag: "ACCOUNT_CLEARING",
    status: "REVIEWING",
    totalAmount: 1250000,
    createdAt: iso(1000 * 60 * 30),
  },
  {
    alertId: "ALT-002",
    accountId: "ACCT-1093",
    accountName: "John Doe",
    riskScore: 82,
    severity: "HIGH",
    flagCount: 2,
    primaryFlag: "RAPID_MOVEMENT",
    status: "PENDING",
    totalAmount: 45000,
    createdAt: iso(1000 * 60 * 120),
  },
  {
    alertId: "ALT-003",
    accountId: "ACCT-4421",
    accountName: "Tech Innovations LLC",
    riskScore: 68,
    severity: "MEDIUM",
    flagCount: 1,
    primaryFlag: "STRUCTURING",
    status: "PENDING",
    totalAmount: 9800,
    createdAt: iso(1000 * 60 * 180),
  },
  {
    alertId: "ALT-004",
    accountId: "ACCT-9923",
    accountName: "Alice Smith",
    riskScore: 91,
    severity: "CRITICAL",
    flagCount: 3,
    primaryFlag: "SMURFING",
    status: "PENDING",
    totalAmount: 52000,
    createdAt: iso(1000 * 60 * 60 * 4),
  },
  {
    alertId: "ALT-005",
    accountId: "ACCT-3312",
    accountName: "Oceanic Ventures",
    riskScore: 45,
    severity: "LOW",
    flagCount: 1,
    primaryFlag: "UNUSUAL_LOCATION",
    status: "PENDING",
    totalAmount: 2500,
    createdAt: iso(1000 * 60 * 60 * 5),
  },
  {
    alertId: "ALT-006",
    accountId: "ACCT-7742",
    accountName: "Bob Johnson",
    riskScore: 78,
    severity: "HIGH",
    flagCount: 2,
    primaryFlag: "RAPID_MOVEMENT",
    status: "PENDING",
    totalAmount: 88000,
    createdAt: iso(1000 * 60 * 60 * 6),
  },
  {
    alertId: "ALT-007",
    accountId: "ACCT-5531",
    accountName: "Alpha Beta Corp",
    riskScore: 85,
    severity: "HIGH",
    flagCount: 2,
    primaryFlag: "ACCOUNT_CLEARING",
    status: "PENDING",
    totalAmount: 320000,
    createdAt: iso(1000 * 60 * 60 * 8),
  },
  {
    alertId: "ALT-008",
    accountId: "ACCT-2211",
    accountName: "Charlie Davis",
    riskScore: 55,
    severity: "MEDIUM",
    flagCount: 1,
    primaryFlag: "STRUCTURING",
    status: "PENDING",
    totalAmount: 9500,
    createdAt: iso(1000 * 60 * 60 * 12),
  },
];

export const mockAlertDetails: Record<string, AlertDetail> = {
  "ALT-001": {
    ...mockAlerts[0],
    triageFlags: [
      {
        flagId: "FLG-001",
        flagType: "ACCOUNT_CLEARING",
        description: "90% balance drain within 48 hours — account effectively cleared",
        severity: "CRITICAL",
        amount: 1125000,
        percentage: 90,
        transactionCount: 4,
        timestamp: iso(1000 * 60 * 60),
      },
      {
        flagId: "FLG-002",
        flagType: "OFFSHORE_TRANSFER",
        description: "Wire transfers to high-risk offshore jurisdictions (Cyprus, BVI)",
        severity: "HIGH",
        amount: 125000,
        percentage: 10,
        transactionCount: 2,
        timestamp: iso(1000 * 60 * 45),
      },
      {
        flagId: "FLG-003",
        flagType: "STRUCTURING",
        description: "Multiple sub-$10k deposits prior to large transfer",
        severity: "MEDIUM",
        amount: 48000,
        percentage: 3.8,
        transactionCount: 6,
        timestamp: iso(1000 * 60 * 60 * 2),
      },
    ],
    llmReasoning: {
      forensicAnalysis:
        "The account Global Trade Corp (ACCT-8821) exhibited highly anomalous behavior consistent with account clearing and capital flight. Within a 48-hour window, 90% of the account's historical average balance was liquidated across 4 distinct wire transfers totaling $1,125,000. Notably, $125,000 was directed to known high-risk offshore jurisdictions in Cyprus and the British Virgin Islands with no prior transactional history with these entities.\n\nPrior to the large liquidation, the account received 6 structured cash deposits ranging from $7,800-$9,900, designed to avoid CTR reporting thresholds. This placement-layering-integration sequence is textbook three-phase laundering. The velocity and structure of these transfers, combined with 18-month baseline deviation of over 1,400%, indicates deliberate evasion strategy with high probability of organized financial crime.",
      confidenceScore: 0.92,
      riskFactors: [
        "Rapid liquidation of 90% of assets within 48 hours",
        "Transfers to high-risk offshore entities (Cyprus, BVI)",
        "Structured cash deposits below $10k CTR threshold",
        "Sequential wire transfers to pre-arranged accounts",
        "1,400% deviation from 18-month historical baseline",
      ],
      aiDecision: "SUSPICIOUS",
      modelUsed: "claude-3-5-sonnet-20241022",
    },
    sarDraft: {
      reportNumber: "SAR-2024-SW-0341",
      filingDate: new Date().toISOString(),
      subjectName: "Global Trade Corp",
      subjectAccountNumber: "ACCT-8821",
      suspiciousActivityType: "Account Clearing / Capital Flight / Money Laundering",
      narrative:
        "Charles Schwab & Co., Inc. is filing this Suspicious Activity Report regarding account holder Global Trade Corp (Account No. ACCT-8821). During the reporting period, the subject conducted a series of transactions totaling $1,250,000 that exhibit characteristics consistent with a structured money laundering scheme.\n\nBetween [Date Range], six cash deposits ranging from $7,800 to $9,900 were made, totaling $48,000 — structured to avoid Currency Transaction Report filing requirements. Subsequently, four wire transfers totaling $1,125,000 (representing 90% of the account's historical average balance) were executed within 48 hours. Of these, $125,000 was wired to offshore correspondent banks in Cyprus and the British Virgin Islands, jurisdictions with elevated FATF risk ratings.\n\nBased on AI-assisted forensic analysis (Confidence: 92%), this activity is assessed as SUSPICIOUS. The transaction sequence — structured placement, rapid layering, and international integration — is consistent with established money laundering typologies. Immediate SAR filing and FinCEN referral recommended.",
      totalAmount: 1250000,
      dateRangeStart: iso(1000 * 60 * 60 * 48),
      dateRangeEnd: new Date().toISOString(),
      filingInstitution: "Charles Schwab & Co., Inc.",
      filingOfficer: "AML Compliance Team — AI.x Division",
    },
  },
};

mockAlerts.forEach((alert) => {
  if (!mockAlertDetails[alert.alertId]) {
    const aiDecision: "SUSPICIOUS" | "REVIEW_NEEDED" | "BENIGN" =
      alert.riskScore > 80
        ? "SUSPICIOUS"
        : alert.riskScore > 60
          ? "REVIEW_NEEDED"
          : "BENIGN";

    mockAlertDetails[alert.alertId] = {
      ...alert,
      triageFlags: [
        {
          flagId: `FLG-${alert.alertId}-A`,
          flagType: alert.primaryFlag,
          description: `Anomalous activity detected: ${alert.primaryFlag.replace(/_/g, " ").toLowerCase()}`,
          severity: alert.severity,
          amount: alert.totalAmount * 0.85,
          percentage: 85,
          transactionCount: alert.flagCount * 2,
          timestamp: alert.createdAt,
        },
      ],
      llmReasoning: {
        forensicAnalysis: `Forensic analysis of ${alert.accountName} (${alert.accountId}) reveals behavioral patterns inconsistent with stated account purpose. Primary trigger: ${alert.primaryFlag.replace(/_/g, " ")} typology detected with risk score ${alert.riskScore}/100. Transaction velocity and amount deviation from 6-month baseline indicate elevated probability of suspicious activity. Further manual review is recommended to determine whether a legitimate business rationale exists for this pattern.`,
        confidenceScore: alert.riskScore / 100,
        riskFactors: [
          `${alert.primaryFlag.replace(/_/g, " ")} pattern detected`,
          "Transaction volume deviates from 6-month baseline",
          `${alert.flagCount} distinct behavioral flags triggered`,
        ],
        aiDecision,
        modelUsed: "claude-3-5-sonnet-20241022",
      },
      sarDraft: {
        reportNumber: `SAR-2024-SW-${alert.alertId}`,
        filingDate: new Date().toISOString(),
        subjectName: alert.accountName,
        subjectAccountNumber: alert.accountId,
        suspiciousActivityType: alert.primaryFlag.replace(/_/g, " / "),
        narrative: `Charles Schwab & Co., Inc. is filing this Suspicious Activity Report regarding account holder ${alert.accountName} (Account No. ${alert.accountId}). During the reporting period, the subject conducted transactions totaling $${alert.totalAmount.toLocaleString()} that exhibit characteristics consistent with ${alert.primaryFlag.replace(/_/g, " ").toLowerCase()} typology.\n\nBased on AI-assisted forensic analysis (Confidence: ${alert.riskScore}%), this activity is assessed as ${aiDecision.replace(/_/g, " ")}. ${alert.flagCount} behavioral flag${alert.flagCount !== 1 ? "s" : ""} were triggered during automated screening. Manual review and, if warranted, escalation to FinCEN is recommended.`,
        totalAmount: alert.totalAmount,
        dateRangeStart: iso(1000 * 60 * 60 * 48),
        dateRangeEnd: new Date().toISOString(),
        filingInstitution: "Charles Schwab & Co., Inc.",
        filingOfficer: "AML Compliance Team — AI.x Division",
      },
    };
  }
});
