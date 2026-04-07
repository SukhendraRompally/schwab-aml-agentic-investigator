import type { Alert, AlertDetail } from "@workspace/api-client-react";
import type { CompletedTransaction, SAR } from "@/types/pipeline";

const RISK_LEVEL_CONFIG: Record<
  string,
  { riskScore: number; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" }
> = {
  CRITICAL: { riskScore: 93, severity: "CRITICAL" },
  HIGH: { riskScore: 78, severity: "HIGH" },
  MEDIUM: { riskScore: 58, severity: "MEDIUM" },
  LOW: { riskScore: 32, severity: "LOW" },
};

function mapAiDecision(aiDecision: string): "SUSPICIOUS" | "REVIEW_NEEDED" | "BENIGN" {
  const upper = aiDecision.toUpperCase();
  if (upper.includes("FLAG") || upper.includes("SUSPICIOUS") || upper === "1") return "SUSPICIOUS";
  if (upper.includes("REVIEW")) return "REVIEW_NEEDED";
  return "BENIGN";
}

export function transactionToAlert(
  tx: CompletedTransaction,
  idx: number
): { alert: Alert; detail: AlertDetail } {
  const riskCfg = RISK_LEVEL_CONFIG[tx.risk_level?.toUpperCase()] ?? RISK_LEVEL_CONFIG.MEDIUM;
  const alertId = `TXN-${String(idx + 1).padStart(3, "0")}-${tx.nameOrig.slice(-4)}`;
  const now = new Date().toISOString();
  const aiDecision = mapAiDecision(tx.ai_decision);

  const alert: Alert = {
    alertId,
    accountId: tx.nameOrig,
    accountName: tx.nameOrig,
    riskScore: riskCfg.riskScore,
    severity: riskCfg.severity,
    flagCount: 1,
    primaryFlag: tx.pattern_type?.replace(/\s+/g, "_").toUpperCase() ?? "UNKNOWN_PATTERN",
    status: "PENDING",
    totalAmount: tx.amount,
    createdAt: now,
  };

  const detail: AlertDetail = {
    ...alert,
    triageFlags: [
      {
        flagId: `${alertId}-F1`,
        flagType: tx.pattern_type?.replace(/\s+/g, "_").toUpperCase() ?? "UNKNOWN_PATTERN",
        description: tx.behavioral_reasoning,
        severity: riskCfg.severity,
        amount: tx.amount,
        percentage: undefined,
        transactionCount: 1,
        timestamp: now,
      },
    ],
    llmReasoning: {
      forensicAnalysis: tx.behavioral_reasoning,
      confidenceScore: riskCfg.riskScore / 100,
      riskFactors: [
        `Pattern type: ${tx.pattern_type ?? "Unknown"}`,
        `Risk level: ${tx.risk_level}`,
        `Transaction amount: $${tx.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        tx.behavioral_reasoning.split(".")[0],
      ].filter(Boolean),
      aiDecision,
      modelUsed: "Pipeline AI Model",
    },
  };

  return { alert, detail };
}

export function buildPipelineWorkQueue(
  flaggedTransactions: CompletedTransaction[],
  sars: SAR[]
): {
  alerts: Alert[];
  details: Record<string, AlertDetail>;
  verdicts: Record<string, CompletedTransaction>;
} {
  const alerts: Alert[] = [];
  const details: Record<string, AlertDetail> = {};
  const verdicts: Record<string, CompletedTransaction> = {};

  flaggedTransactions.forEach((tx, idx) => {
    const { alert, detail } = transactionToAlert(tx, idx);

    const matchedSar = tx.has_sar && tx.sar_report_id
      ? sars.find((s) => s.report_id === tx.sar_report_id)
      : null;

    if (matchedSar) {
      detail.sarDraft = {
        reportNumber: matchedSar.report_id,
        filingDate: matchedSar.generated_at,
        subjectName: tx.nameOrig,
        subjectAccountNumber: tx.nameOrig,
        suspiciousActivityType: matchedSar.suspicious_activity_type,
        narrative: matchedSar.narrative_of_suspicion,
        totalAmount: tx.amount,
        dateRangeStart: matchedSar.generated_at,
        dateRangeEnd: matchedSar.generated_at,
        filingInstitution: "Charles Schwab & Co., Inc.",
        filingOfficer: "AML Compliance Team — AI.x Pipeline",
      };
    }

    alerts.push(alert);
    details[alert.alertId] = detail;
    verdicts[alert.alertId] = tx;
  });

  return { alerts, details, verdicts };
}
