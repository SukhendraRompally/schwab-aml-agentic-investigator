import { Router, type IRouter } from "express";
import {
  AnalyzeTransactionBody,
  AnalyzeTransactionResponse,
  ListAlertsResponse,
  GetAlertParams,
  GetAlertResponse,
  RevealGroundTruthParams,
  RevealGroundTruthResponse,
  GetMetricsSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MOCK_ALERTS = [
  {
    alertId: "ALT-2024-0001",
    accountId: "ACC-7291-KX",
    accountName: "Meridian Trading LLC",
    riskScore: 97,
    severity: "CRITICAL" as const,
    flagCount: 4,
    primaryFlag: "90% balance drain in 48h",
    status: "PENDING" as const,
    totalAmount: 487250.0,
    createdAt: new Date("2024-03-15T08:23:11Z"),
  },
  {
    alertId: "ALT-2024-0002",
    accountId: "ACC-3847-MN",
    accountName: "Phoenix Holding Group",
    riskScore: 89,
    severity: "HIGH" as const,
    flagCount: 3,
    primaryFlag: "Structuring pattern detected below $10k threshold",
    status: "REVIEWING" as const,
    totalAmount: 89430.0,
    createdAt: new Date("2024-03-14T14:55:22Z"),
  },
  {
    alertId: "ALT-2024-0003",
    accountId: "ACC-5512-RT",
    accountName: "Carlos Mendez",
    riskScore: 76,
    severity: "HIGH" as const,
    flagCount: 2,
    primaryFlag: "Rapid cash-to-wire movement in 24h",
    status: "PENDING" as const,
    totalAmount: 124000.0,
    createdAt: new Date("2024-03-14T09:12:44Z"),
  },
  {
    alertId: "ALT-2024-0004",
    accountId: "ACC-9923-LW",
    accountName: "Summit Capital Partners",
    riskScore: 62,
    severity: "MEDIUM" as const,
    flagCount: 2,
    primaryFlag: "Unusual geographic dispersion of transfers",
    status: "REVIEWING" as const,
    totalAmount: 215000.0,
    createdAt: new Date("2024-03-13T16:30:00Z"),
  },
  {
    alertId: "ALT-2024-0005",
    accountId: "ACC-1145-ZP",
    accountName: "Nexus Import Export Inc",
    riskScore: 91,
    severity: "CRITICAL" as const,
    flagCount: 5,
    primaryFlag: "Shell company smurfing pattern",
    status: "CONFIRMED" as const,
    totalAmount: 932000.0,
    createdAt: new Date("2024-03-12T11:05:33Z"),
  },
  {
    alertId: "ALT-2024-0006",
    accountId: "ACC-6677-PQ",
    accountName: "Elena Volkov",
    riskScore: 44,
    severity: "MEDIUM" as const,
    flagCount: 1,
    primaryFlag: "Inconsistent transaction size with account history",
    status: "PENDING" as const,
    totalAmount: 37800.0,
    createdAt: new Date("2024-03-12T09:48:17Z"),
  },
  {
    alertId: "ALT-2024-0007",
    accountId: "ACC-8831-VK",
    accountName: "Apex Logistics Group",
    riskScore: 83,
    severity: "HIGH" as const,
    flagCount: 3,
    primaryFlag: "Round-dollar transactions across 12 jurisdictions",
    status: "PENDING" as const,
    totalAmount: 678000.0,
    createdAt: new Date("2024-03-11T15:22:09Z"),
  },
  {
    alertId: "ALT-2024-0008",
    accountId: "ACC-2234-HS",
    accountName: "Blockchain Ventures LLC",
    riskScore: 28,
    severity: "LOW" as const,
    flagCount: 1,
    primaryFlag: "New account with elevated crypto activity",
    status: "DISMISSED" as const,
    totalAmount: 14200.0,
    createdAt: new Date("2024-03-10T10:00:00Z"),
  },
];

const MOCK_ALERT_DETAILS: Record<string, object> = {
  "ALT-2024-0001": {
    ...MOCK_ALERTS[0],
    triageFlags: [
      {
        flagId: "FLG-001-A",
        flagType: "ACCOUNT_CLEARING",
        description: "90% balance drain within 48 hours — account effectively cleared",
        severity: "CRITICAL",
        amount: 438525.0,
        percentage: 90,
        transactionCount: 7,
        timestamp: new Date("2024-03-14T22:00:00Z"),
      },
      {
        flagId: "FLG-001-B",
        flagType: "RAPID_MOVEMENT",
        description: "Wire transfers to 3 foreign jurisdictions within 6 hours of deposit",
        severity: "HIGH",
        amount: 487250.0,
        percentage: 100,
        transactionCount: 3,
        timestamp: new Date("2024-03-15T02:00:00Z"),
      },
      {
        flagId: "FLG-001-C",
        flagType: "LAYERING",
        description: "Funds moved through 2 intermediary accounts before final destination",
        severity: "HIGH",
        amount: 350000.0,
        percentage: 71.8,
        transactionCount: 4,
        timestamp: new Date("2024-03-14T18:00:00Z"),
      },
      {
        flagId: "FLG-001-D",
        flagType: "STRUCTURING",
        description: "Multiple sub-$10k transactions totaling $48,725 over 12 hours",
        severity: "MEDIUM",
        amount: 48725.0,
        percentage: 10,
        transactionCount: 6,
        timestamp: new Date("2024-03-13T08:00:00Z"),
      },
    ],
    llmReasoning: {
      forensicAnalysis:
        "Account ACC-7291-KX (Meridian Trading LLC) exhibits a classic account-clearing pattern consistent with the integration stage of money laundering. The sequence begins with a series of sub-threshold cash deposits ($48,725 across 6 transactions between 08:00-20:00 on 2024-03-13), designed to avoid CTR filing requirements. Within 12 hours, a single large wire of $438,525 was initiated to an offshore correspondent bank in Cyprus, followed by two rapid subsequent transfers to shell entities in the British Virgin Islands and Seychelles respectively.\n\nThe account history (18 months prior) shows a typical small-business cash flow pattern with average monthly volume of $42,000 — making the current $487,250 activity a 1,160% deviation from baseline. The corporate registration for Meridian Trading LLC shows no import/export activity that would justify international wire transfers of this magnitude.\n\nBehavioral markers strongly align with placement and layering: the geographical dispersion of funds across three high-risk jurisdictions, combined with the temporal compression of the entire operation into a 48-hour window, suggests deliberate evasion strategy. The use of round-number intermediary transfers ($200,000, $150,000) further indicates coordination with pre-arranged receiving accounts.",
      confidenceScore: 0.94,
      riskFactors: [
        "90%+ account balance cleared in under 48 hours",
        "Structured deposits below CTR threshold ($10,000)",
        "Rapid international wire to three FATF high-risk jurisdictions",
        "1,160% deviation from 18-month transaction baseline",
        "Layered through 2 intermediary accounts before final destination",
        "No legitimate business rationale for transaction volume",
      ],
      aiDecision: "SUSPICIOUS",
      modelUsed: "claude-3-5-sonnet-20241022",
    },
    sarDraft: {
      reportNumber: "SAR-2024-SW-0341",
      filingDate: new Date("2024-03-16"),
      subjectName: "Meridian Trading LLC",
      subjectAccountNumber: "ACC-7291-KX",
      suspiciousActivityType: "Money Laundering - Layering/Integration",
      narrative:
        "The reporting financial institution is filing this Suspicious Activity Report regarding account holder Meridian Trading LLC (Account No. ACC-7291-KX). During the period of March 13-15, 2024, the subject conducted a series of transactions totaling $487,250.00 that exhibit characteristics consistent with money laundering activity.\n\nOn March 13, 2024, six cash deposits ranging from $7,500 to $9,900 were made totaling $48,725.00. These deposits appear structured to avoid Currency Transaction Report filing thresholds. On March 14, 2024 at 22:14 EST, a wire transfer of $438,525.00 was initiated to Paphos Commerce Bank in Limassol, Cyprus (BIC: PCBCYP2X), representing a 90% clearance of the account balance. Subsequent wire transfers of $200,000.00 and $150,000.00 were executed within 6 hours to Offshore Premier Ltd (Tortola, BVI) and Seychelles Investment Services Ltd respectively.\n\nThe subject's 18-month transaction history reflects average monthly volume of approximately $42,000, making the current activity a 1,160% deviation from historical baseline. The subject entity shows no documented import/export activity or business relationships that would justify international transfers of this magnitude to these jurisdictions.\n\nBased on AI-assisted forensic analysis with 94% confidence, this activity is assessed as SUSPICIOUS and is recommended for immediate SAR filing and possible referral to FinCEN.",
      totalAmount: 487250.0,
      dateRangeStart: new Date("2024-03-13"),
      dateRangeEnd: new Date("2024-03-15"),
      filingInstitution: "Reporting Financial Institution",
      filingOfficer: "AML Compliance Team",
    },
  },
  "ALT-2024-0002": {
    ...MOCK_ALERTS[1],
    triageFlags: [
      {
        flagId: "FLG-002-A",
        flagType: "STRUCTURING",
        description: "9 transactions between $8,000-$9,900 over 3 days totaling $83,430",
        severity: "HIGH",
        amount: 83430.0,
        percentage: 93.3,
        transactionCount: 9,
        timestamp: new Date("2024-03-12T10:00:00Z"),
      },
      {
        flagId: "FLG-002-B",
        flagType: "SMURFING",
        description: "Multiple individuals depositing similar amounts at different branches",
        severity: "HIGH",
        amount: 89430.0,
        percentage: 100,
        transactionCount: 11,
        timestamp: new Date("2024-03-13T14:00:00Z"),
      },
      {
        flagId: "FLG-002-C",
        flagType: "UNUSUAL_GEOGRAPHY",
        description: "Deposits from 6 different branch locations spanning 3 states",
        severity: "MEDIUM",
        amount: 54000.0,
        percentage: 60.4,
        transactionCount: 6,
        timestamp: new Date("2024-03-12T16:00:00Z"),
      },
    ],
    llmReasoning: {
      forensicAnalysis:
        "Phoenix Holding Group demonstrates a textbook smurfing operation with geographic dispersion designed to avoid detection. Analysis reveals a coordinated effort across 11 transactions at 6 different branch locations in California, Nevada, and Arizona, with transaction amounts consistently kept below the $10,000 CTR reporting threshold. The statistical uniformity of deposit amounts (standard deviation of only $412 around the mean of $8,130) indicates coordination rather than coincidence. Account's stated business purpose as a commercial real estate holding company does not align with cash deposit patterns — real estate entities typically conduct wire transfers, not multi-branch cash deposits.",
      confidenceScore: 0.87,
      riskFactors: [
        "Classic structuring below $10k CTR threshold",
        "Multi-individual, multi-location deposit pattern",
        "Transaction size standard deviation suggests coordination",
        "Business model inconsistent with cash deposit behavior",
        "3-state geographic dispersion within 3 days",
      ],
      aiDecision: "SUSPICIOUS",
      modelUsed: "claude-3-5-sonnet-20241022",
    },
    sarDraft: {
      reportNumber: "SAR-2024-SW-0342",
      filingDate: new Date("2024-03-16"),
      subjectName: "Phoenix Holding Group",
      subjectAccountNumber: "ACC-3847-MN",
      suspiciousActivityType: "Structuring / Smurfing",
      narrative:
        "The reporting financial institution reports suspicious structuring activity for Phoenix Holding Group (Account No. ACC-3847-MN). Between March 12-14, 2024, eleven cash deposits were conducted at six branch locations across California, Nevada, and Arizona, with all amounts between $8,000-$9,900 totaling $89,430.00. The transaction size uniformity and geographic spread suggest coordinated smurfing activity designed to evade CTR requirements.",
      totalAmount: 89430.0,
      dateRangeStart: new Date("2024-03-12"),
      dateRangeEnd: new Date("2024-03-14"),
      filingInstitution: "Reporting Financial Institution",
      filingOfficer: "AML Compliance Team",
    },
  },
};

for (const alert of MOCK_ALERTS) {
  if (!MOCK_ALERT_DETAILS[alert.alertId]) {
    MOCK_ALERT_DETAILS[alert.alertId] = {
      ...alert,
      triageFlags: [
        {
          flagId: `FLG-${alert.alertId}-A`,
          flagType: "ACCOUNT_CLEARING",
          description: alert.primaryFlag,
          severity: alert.severity,
          amount: alert.totalAmount * 0.85,
          percentage: 85,
          transactionCount: alert.flagCount * 2,
          timestamp: alert.createdAt,
        },
      ],
      llmReasoning: {
        forensicAnalysis: `Forensic analysis of account ${alert.accountId} (${alert.accountName}) reveals behavioral patterns inconsistent with stated business purpose. Risk score ${alert.riskScore}/100 based on transaction velocity, geographic dispersion, and deviation from historical baseline. Further investigation recommended.`,
        confidenceScore: alert.riskScore / 100,
        riskFactors: [alert.primaryFlag, "Deviation from historical baseline", "Transaction velocity anomaly"],
        aiDecision: alert.riskScore >= 70 ? "SUSPICIOUS" : alert.riskScore >= 40 ? "REVIEW_NEEDED" : "BENIGN",
        modelUsed: "claude-3-5-sonnet-20241022",
      },
      sarDraft: {
        reportNumber: `SAR-2024-SW-${alert.alertId.split("-")[2]}`,
        filingDate: new Date(),
        subjectName: alert.accountName,
        subjectAccountNumber: alert.accountId,
        suspiciousActivityType: "Suspicious Transaction Activity",
        narrative: `The reporting financial institution reports suspicious activity for ${alert.accountName} (Account No. ${alert.accountId}). Primary concern: ${alert.primaryFlag}. Total amount at risk: $${alert.totalAmount.toLocaleString()}. AI confidence: ${Math.round(alert.riskScore)}%.`,
        totalAmount: alert.totalAmount,
        dateRangeStart: new Date(alert.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000),
        dateRangeEnd: alert.createdAt,
        filingInstitution: "Reporting Financial Institution",
        filingOfficer: "AML Compliance Team",
      },
    };
  }
}

const GROUND_TRUTH: Record<string, boolean> = {
  "ALT-2024-0001": true,
  "ALT-2024-0002": true,
  "ALT-2024-0003": true,
  "ALT-2024-0004": false,
  "ALT-2024-0005": true,
  "ALT-2024-0006": false,
  "ALT-2024-0007": true,
  "ALT-2024-0008": false,
};

let evaluationHistory: Array<{ alertId: string; isFraud: boolean; aiDecision: string }> = [];

router.get("/metrics/summary", async (_req, res): Promise<void> => {
  const data = GetMetricsSummaryResponse.parse({
    totalAlerts: MOCK_ALERTS.length,
    aiConfirmedRisks: MOCK_ALERTS.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").length,
    potentialFalsePositives: MOCK_ALERTS.filter((a) => a.severity === "LOW" || a.severity === "MEDIUM").length,
    pendingReview: MOCK_ALERTS.filter((a) => a.status === "PENDING").length,
    systemStatus: "READY",
  });
  res.json(data);
});

router.get("/alerts", async (_req, res): Promise<void> => {
  const data = ListAlertsResponse.parse({
    alerts: MOCK_ALERTS,
    total: MOCK_ALERTS.length,
  });
  res.json(data);
});

router.get("/alerts/:alertId", async (req, res): Promise<void> => {
  const params = GetAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const detail = MOCK_ALERT_DETAILS[params.data.alertId];
  if (!detail) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  const data = GetAlertResponse.parse(detail);
  res.json(data);
});

router.post("/alerts/:alertId/reveal", async (req, res): Promise<void> => {
  const params = RevealGroundTruthParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { alertId } = params.data;
  const isFraud = GROUND_TRUTH[alertId] ?? false;
  const detail = MOCK_ALERT_DETAILS[alertId] as { llmReasoning?: { aiDecision?: string } } | undefined;
  const aiDecision = detail?.llmReasoning?.aiDecision ?? "REVIEW_NEEDED";

  const existing = evaluationHistory.find((e) => e.alertId === alertId);
  if (!existing) {
    evaluationHistory.push({ alertId, isFraud, aiDecision });
  }

  const truePositives = evaluationHistory.filter((e) => e.isFraud && e.aiDecision === "SUSPICIOUS").length;
  const falsePositives = evaluationHistory.filter((e) => !e.isFraud && e.aiDecision === "SUSPICIOUS").length;
  const falseNegatives = evaluationHistory.filter((e) => e.isFraud && e.aiDecision !== "SUSPICIOUS").length;

  const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 1;
  const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 1;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const isCorrect =
    (isFraud && aiDecision === "SUSPICIOUS") || (!isFraud && aiDecision !== "SUSPICIOUS");

  const data = RevealGroundTruthResponse.parse({
    alertId,
    isFraud,
    aiDecision,
    isCorrect,
    precision,
    recall,
    f1Score,
    totalEvaluated: evaluationHistory.length,
    truePositives,
    falsePositives,
    falseNegatives,
  });
  res.json(data);
});

router.post("/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { accountId } = parsed.data;
  const existingAlert = MOCK_ALERTS.find((a) => a.accountId === accountId);

  if (existingAlert) {
    const detail = MOCK_ALERT_DETAILS[existingAlert.alertId] as {
      triageFlags?: object[];
      llmReasoning?: object;
      sarDraft?: object;
    };
    const data = AnalyzeTransactionResponse.parse({
      alertId: existingAlert.alertId,
      accountId,
      status: "COMPLETE",
      triageFlags: detail?.triageFlags ?? [],
      llmReasoning: detail?.llmReasoning,
      sarDraft: detail?.sarDraft,
    });
    res.json(data);
    return;
  }

  const newAlertId = `ALT-2024-${Date.now()}`;
  const data = AnalyzeTransactionResponse.parse({
    alertId: newAlertId,
    accountId,
    status: "COMPLETE",
    triageFlags: [
      {
        flagId: `FLG-${newAlertId}-A`,
        flagType: "ACCOUNT_CLEARING",
        description: "Anomalous activity detected via behavioral triage",
        severity: "MEDIUM",
        amount: 50000.0,
        percentage: 65,
        transactionCount: 5,
        timestamp: new Date(),
      },
    ],
    llmReasoning: {
      forensicAnalysis: `Forensic analysis of account ${accountId} completed. Behavioral patterns show deviation from baseline activity. No conclusive evidence of fraud without additional data.`,
      confidenceScore: 0.55,
      riskFactors: ["Unusual transaction velocity", "Deviation from historical baseline"],
      aiDecision: "REVIEW_NEEDED",
      modelUsed: "claude-3-5-sonnet-20241022",
    },
  });
  res.json(data);
});

export default router;
