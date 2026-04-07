import { useState, useEffect } from "react";
import type { AlertDetail } from "@workspace/api-client-react";
import { useRevealGroundTruth } from "@workspace/api-client-react";
import type { CompletedTransaction } from "@/types/pipeline";
import { DEMO_MODE } from "@/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Unlock, CheckCircle2, XCircle, MinusCircle, Target } from "lucide-react";

interface ValidationStepProps {
  alertId: string | null;
  detail: AlertDetail | null | undefined;
  isLoading: boolean;
  pipelineVerdict?: CompletedTransaction | null;
}

interface MockGroundTruth {
  alertId: string;
  isFraud: boolean;
  aiDecision: "SUSPICIOUS" | "BENIGN" | "REVIEW_NEEDED";
  isCorrect: boolean;
  precision: number;
  recall: number;
  f1Score: number;
  totalEvaluated: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

const MOCK_GROUND_TRUTHS: Record<string, boolean> = {
  "ALT-001": true,
  "ALT-002": true,
  "ALT-003": false,
  "ALT-004": true,
  "ALT-005": false,
  "ALT-006": true,
  "ALT-007": true,
  "ALT-008": false,
};

const mockEvaluationHistory = new Map<
  string,
  { isFraud: boolean; aiDecision: string }
>();

function computeMockGroundTruth(alertId: string, detail: AlertDetail): MockGroundTruth {
  const isFraud = MOCK_GROUND_TRUTHS[alertId] ?? false;
  const aiDecision = (detail.llmReasoning?.aiDecision ?? "REVIEW_NEEDED") as
    | "SUSPICIOUS"
    | "BENIGN"
    | "REVIEW_NEEDED";

  mockEvaluationHistory.set(alertId, { isFraud, aiDecision });

  const entries = Array.from(mockEvaluationHistory.values());
  const tp = entries.filter((e) => e.isFraud && e.aiDecision === "SUSPICIOUS").length;
  const fp = entries.filter((e) => !e.isFraud && e.aiDecision === "SUSPICIOUS").length;
  const fn = entries.filter((e) => e.isFraud && e.aiDecision !== "SUSPICIOUS").length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const isCorrect =
    (isFraud && aiDecision === "SUSPICIOUS") || (!isFraud && aiDecision !== "SUSPICIOUS");

  return {
    alertId,
    isFraud,
    aiDecision,
    isCorrect,
    precision,
    recall,
    f1Score,
    totalEvaluated: mockEvaluationHistory.size,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
  };
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className={`text-sm font-bold font-mono ${color}`}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            pct >= 80 ? "bg-green-600" : pct >= 60 ? "bg-amber-500" : "bg-destructive"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const VERDICT_CONFIG = {
  TP: {
    label: "True Positive — AI correctly flagged fraud",
    description: "The AI identified this as suspicious and the ground truth confirms it is fraudulent.",
    icon: CheckCircle2,
    color: "border-green-500/40 bg-green-500/5",
    textColor: "text-green-700",
    badgeColor: "bg-green-500/20 text-green-700 border-green-500/40",
  },
  FP: {
    label: "False Positive — AI incorrectly flagged legitimate",
    description: "The AI flagged this as suspicious but the ground truth shows it is a legitimate transaction.",
    icon: XCircle,
    color: "border-destructive/40 bg-destructive/5",
    textColor: "text-destructive",
    badgeColor: "bg-destructive/10 text-destructive border-destructive/40",
  },
  FN: {
    label: "False Negative — AI missed actual fraud",
    description: "The AI did not flag this transaction but the ground truth confirms it is fraudulent.",
    icon: MinusCircle,
    color: "border-amber-500/40 bg-amber-500/5",
    textColor: "text-amber-700",
    badgeColor: "bg-amber-500/20 text-amber-700 border-amber-500/40",
  },
  TN: {
    label: "True Negative — AI correctly cleared legitimate",
    description: "The AI did not flag this transaction and the ground truth confirms it is legitimate.",
    icon: CheckCircle2,
    color: "border-green-500/40 bg-green-500/5",
    textColor: "text-green-700",
    badgeColor: "bg-green-500/20 text-green-700 border-green-500/40",
  },
} as const;

export function ValidationStep({
  alertId,
  detail,
  isLoading,
  pipelineVerdict,
}: ValidationStepProps) {
  const [revealed, setRevealed] = useState(false);
  const [mockResult, setMockResult] = useState<MockGroundTruth | null>(null);

  const revealMutation = useRevealGroundTruth();

  useEffect(() => {
    setRevealed(false);
    setMockResult(null);
    revealMutation.reset();
  }, [alertId]);

  const handleReveal = async () => {
    if (!alertId) return;

    if (pipelineVerdict) {
      setRevealed(true);
      return;
    }

    if (DEMO_MODE) {
      if (detail) {
        const result = computeMockGroundTruth(alertId, detail);
        setMockResult(result);
        setRevealed(true);
      }
      return;
    }

    revealMutation.mutate(
      { alertId },
      { onSuccess: () => setRevealed(true) }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="validation-loading">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (!alertId || !detail) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Select an alert to access validation
      </div>
    );
  }

  const isPending = revealMutation.isPending;

  return (
    <div className="space-y-4" data-testid="validation-step">
      <div className="rounded-lg border-2 border-dashed border-border/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Restricted — Ground Truth Validation
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {pipelineVerdict
            ? "After completing your manual review, reveal the pipeline's ground truth label to confirm whether the AI's decision was a True Positive, False Positive, False Negative, or True Negative."
            : "This section reveals the actual isFraud label from the PaySim dataset and computes Precision / Recall metrics for the AI model across all evaluated alerts."}
        </p>

        {!revealed ? (
          <Button
            onClick={handleReveal}
            disabled={isPending}
            className="w-full"
            variant="secondary"
            data-testid="reveal-ground-truth-button"
          >
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⟳</span> Querying Dataset...
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Reveal Ground Truth
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
            <Unlock className="h-4 w-4" />
            Ground truth revealed for {alertId}
          </div>
        )}
      </div>

      {/* ── Pipeline verdict reveal ── */}
      {revealed && pipelineVerdict && (() => {
        const cfg = VERDICT_CONFIG[pipelineVerdict.verdict];
        const Icon = cfg.icon;
        const isFraud = pipelineVerdict.actual_fraud === 1;
        return (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div
              className={`rounded-lg border-2 p-4 ${cfg.color}`}
              data-testid="ground-truth-result"
            >
              <div className="flex items-start gap-4">
                <Icon className={`h-8 w-8 flex-shrink-0 mt-0.5 ${cfg.textColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label}</p>
                    <Badge className={`text-[10px] h-5 px-2 border ${cfg.badgeColor}`}>
                      {pipelineVerdict.verdict}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{cfg.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-card border border-border px-3 py-2">
                      <p className="text-muted-foreground mb-0.5">Ground Truth</p>
                      <p className={`font-semibold ${isFraud ? "text-destructive" : "text-green-600"}`}>
                        {isFraud ? "🔴 FRAUD" : "🟢 LEGITIMATE"}
                      </p>
                    </div>
                    <div className="rounded bg-card border border-border px-3 py-2">
                      <p className="text-muted-foreground mb-0.5">AI Decision</p>
                      <p className="font-semibold text-foreground">
                        {pipelineVerdict.ai_decision}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Demo / API mock result reveal ── */}
      {revealed && !pipelineVerdict && (() => {
        const result = DEMO_MODE ? mockResult : revealMutation.data;
        if (!result) return null;
        return (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div
              className={`rounded-lg border-2 p-4 flex items-center gap-4 ${
                result.isCorrect
                  ? "border-green-500/40 bg-green-500/5"
                  : "border-destructive/40 bg-destructive/5"
              }`}
              data-testid="ground-truth-result"
            >
              {result.isCorrect ? (
                <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              )}
              <div>
                <p className={`text-sm font-bold ${result.isCorrect ? "text-green-700" : "text-destructive"}`}>
                  {result.isCorrect ? "AI Decision: CORRECT" : "AI Decision: INCORRECT"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ground Truth: {result.isFraud ? "FRAUD" : "LEGITIMATE"} — AI
                  Prediction: {result.aiDecision.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Model Performance Metrics
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({result.totalEvaluated} alerts evaluated)
                </span>
              </div>

              <div className="space-y-3">
                <MetricBar
                  label="Precision"
                  value={result.precision}
                  color={result.precision >= 0.8 ? "text-green-600" : result.precision >= 0.6 ? "text-amber-500" : "text-destructive"}
                />
                <MetricBar
                  label="Recall"
                  value={result.recall}
                  color={result.recall >= 0.8 ? "text-green-600" : result.recall >= 0.6 ? "text-amber-500" : "text-destructive"}
                />
                <MetricBar
                  label="F1 Score"
                  value={result.f1Score}
                  color={result.f1Score >= 0.8 ? "text-green-600" : result.f1Score >= 0.6 ? "text-amber-500" : "text-destructive"}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-center pt-2 border-t border-border">
                <div className="rounded bg-green-500/10 px-2 py-2">
                  <p className="text-muted-foreground mb-0.5">True Positives</p>
                  <p className="font-mono font-bold text-green-600" data-testid="true-positives">
                    {result.truePositives}
                  </p>
                </div>
                <div className="rounded bg-destructive/10 px-2 py-2">
                  <p className="text-muted-foreground mb-0.5">False Positives</p>
                  <p className="font-mono font-bold text-destructive" data-testid="false-positives">
                    {result.falsePositives}
                  </p>
                </div>
                <div className="rounded bg-amber-500/10 px-2 py-2">
                  <p className="text-muted-foreground mb-0.5">False Negatives</p>
                  <p className="font-mono font-bold text-amber-600" data-testid="false-negatives">
                    {result.falseNegatives}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
