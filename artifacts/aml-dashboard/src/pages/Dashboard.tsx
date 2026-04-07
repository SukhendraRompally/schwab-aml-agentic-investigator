import { useState, useMemo } from "react";
import { useGetAlert, getGetAlertQueryKey } from "@workspace/api-client-react";
import { DEMO_MODE, PIPELINE_BASE_URL } from "@/config";
import { mockAlertDetails } from "@/mockData";
import { usePipeline } from "@/hooks/usePipeline";
import { buildPipelineWorkQueue } from "@/lib/transactionToAlert";
import { MetricCards } from "@/components/MetricCards";
import { Sidebar } from "@/components/Sidebar";
import { TriageStep } from "@/components/TriageStep";
import { LLMReasoningStep } from "@/components/LLMReasoningStep";
import { SARDraftStep } from "@/components/SARDraftStep";
import { ValidationStep } from "@/components/ValidationStep";
import { PipelineControl } from "@/components/PipelineControl";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { TransactionFeed } from "@/components/TransactionFeed";
import { FullResults } from "@/components/FullResults";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Brain,
  FileText,
  ShieldCheck,
  Activity,
  Database,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export function Dashboard() {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const { state: pipelineState, runPipeline, reset: resetPipeline } = usePipeline();

  const pipelineWorkQueue = useMemo(() => {
    if (pipelineState.status !== "done" || !pipelineState.results) return null;
    return buildPipelineWorkQueue(
      pipelineState.results.flagged_transactions,
      pipelineState.results.sars
    );
  }, [pipelineState.status, pipelineState.results]);

  const { data: alertDetail, isLoading, isError: alertDetailError } = useGetAlert(
    selectedAlertId ?? "",
    {
      query: {
        enabled: !DEMO_MODE && !pipelineWorkQueue && !!selectedAlertId,
        queryKey: getGetAlertQueryKey(selectedAlertId ?? ""),
      },
    }
  );

  const detail = useMemo(() => {
    if (!selectedAlertId) return null;
    if (pipelineWorkQueue) return pipelineWorkQueue.details[selectedAlertId] ?? null;
    if (DEMO_MODE) return mockAlertDetails[selectedAlertId] ?? null;
    return alertDetail ?? (alertDetailError ? mockAlertDetails[selectedAlertId] ?? null : null);
  }, [selectedAlertId, pipelineWorkQueue, alertDetail, alertDetailError]);

  const pipelineVerdict = useMemo(() => {
    if (!selectedAlertId || !pipelineWorkQueue) return null;
    return pipelineWorkQueue.verdicts[selectedAlertId] ?? null;
  }, [selectedAlertId, pipelineWorkQueue]);

  const pipelineIsActive =
    pipelineState.status === "running" ||
    pipelineState.status === "done" ||
    pipelineState.status === "error";

  const steps = [
    {
      id: "triage",
      shortLabel: "Triage",
      icon: AlertTriangle,
      badge: detail ? String(detail.triageFlags?.length ?? 0) : undefined,
    },
    {
      id: "reasoning",
      shortLabel: "Reasoning",
      icon: Brain,
      badge: detail?.llmReasoning
        ? String(Math.round((detail.llmReasoning.confidenceScore ?? 0) * 100)) + "%"
        : undefined,
    },
    {
      id: "sar",
      shortLabel: "SAR",
      icon: FileText,
      badge: detail?.sarDraft ? "Ready" : undefined,
    },
    {
      id: "validation",
      shortLabel: "Validation",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ── */}
      <header
        className="flex-shrink-0 border-b border-border/50 px-6 py-3"
        style={{ backgroundColor: "hsl(var(--secondary))" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <span className="text-white font-bold text-lg tracking-tight">SCHWAB AI.x</span>
            <span className="text-white/50 font-light">—</span>
            <span className="text-white/80 font-medium text-sm tracking-wide">
              AML Agentic Investigator
            </span>
          </div>

          <div className="flex items-center gap-4">
            {DEMO_MODE && (
              <Badge className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Demo Mode
              </Badge>
            )}
            {pipelineWorkQueue && (
              <Badge className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary border border-primary/30">
                <Zap className="h-2.5 w-2.5 mr-1" />
                {pipelineWorkQueue.alerts.length} Flagged for Review
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPipelineOpen((o) => !o)}
              className={`text-white/70 hover:text-white hover:bg-white/10 text-xs ${pipelineState.status === "running" ? "text-primary" : ""}`}
              data-testid="pipeline-toggle-btn"
            >
              <Zap
                className={`h-3.5 w-3.5 mr-1.5 ${pipelineState.status === "running" ? "animate-pulse text-primary" : ""}`}
              />
              Batch Pipeline
              {pipelineOpen ? (
                <ChevronUp className="h-3 w-3 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1" />
              )}
            </Button>
            <div className="flex items-center gap-2" data-testid="system-status">
              <Activity className="h-4 w-4 text-green-400" />
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-green-400 text-xs font-medium">System Ready</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Batch Pipeline Panel (collapsible) ── */}
      {pipelineOpen && (
        <div className="flex-shrink-0 border-b border-border bg-muted/30">
          <PipelineControl
            state={pipelineState}
            onRun={() => {
              setSelectedAlertId(null);
              runPipeline();
            }}
            onReset={() => {
              setSelectedAlertId(null);
              resetPipeline();
            }}
          />
          {pipelineIsActive && (
            <div className="px-6 pb-4 space-y-4">
              {pipelineState.status === "running" && (
                <>
                  <LiveScoreboard cumulative={pipelineState.cumulative} isLive />
                  <TransactionFeed
                    transactions={pipelineState.cumulative.completed_transactions}
                    isLive
                    maxHeight="220px"
                  />
                </>
              )}
              {pipelineState.status === "done" && pipelineState.results && (
                <FullResults results={pipelineState.results} />
              )}
              {pipelineState.status === "error" && (
                <p className="text-xs text-destructive py-2">
                  {pipelineState.error} — backend: {PIPELINE_BASE_URL}
                </p>
              )}
            </div>
          )}
          {pipelineState.status === "done" && pipelineWorkQueue && (
            <div className="px-6 pb-4">
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Work queue updated — {pipelineWorkQueue.alerts.length} flagged transactions ready
                for manual review below. Click any item to begin the 4-step investigation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Metrics Row ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-background">
        <MetricCards />
      </div>

      {/* ── Main: Sidebar + Detail Panel ── */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex-shrink-0 overflow-hidden border-r border-border">
          <Sidebar
            selectedAlertId={selectedAlertId}
            onSelectAlert={setSelectedAlertId}
            pipelineAlerts={pipelineWorkQueue?.alerts}
          />
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col">
          {!selectedAlertId ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  {pipelineWorkQueue ? (
                    <Zap className="h-8 w-8 text-primary" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-primary" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {pipelineWorkQueue ? "Select a Flagged Transaction" : "No Alert Selected"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {pipelineWorkQueue
                    ? `Pipeline surfaced ${pipelineWorkQueue.alerts.length} flagged transactions. Select one from the work queue to begin your manual review.`
                    : "Select an alert from the work queue or run the batch pipeline to begin forensic analysis."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-shrink-0 px-6 pt-4 pb-0">
                <div className="mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-foreground font-mono">
                      {selectedAlertId}
                    </h2>
                    {pipelineVerdict && (
                      <Badge variant="outline" className="text-[10px] h-5 border-primary/40 text-primary">
                        <Zap className="h-2.5 w-2.5 mr-0.5" /> Pipeline
                      </Badge>
                    )}
                    {detail?.sarDraft && (
                      <Badge variant="outline" className="text-[10px] h-5 border-amber-500/50 text-amber-600">
                        SAR Generated
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isLoading && !pipelineWorkQueue
                      ? "Loading analysis…"
                      : detail
                        ? `${detail.accountName} — $${(detail.totalAmount ?? 0).toLocaleString()}`
                        : "Alert not found"}
                  </p>
                </div>
              </div>

              <Tabs defaultValue="triage" className="flex-1 flex flex-col overflow-hidden px-6 pb-4">
                <TabsList className="grid grid-cols-4 flex-shrink-0 mb-4 h-auto">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <TabsTrigger
                        key={step.id}
                        value={step.id}
                        className="flex items-center gap-1.5 py-2.5"
                        data-testid={`tab-${step.id}`}
                      >
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex-shrink-0">
                          {i + 1}
                        </span>
                        <Icon className="h-3.5 w-3.5 hidden sm:block flex-shrink-0" />
                        <span className="text-xs font-medium truncate">{step.shortLabel}</span>
                        {step.badge && (
                          <Badge
                            className="text-[9px] px-1.5 h-4 ml-0.5 hidden md:inline-flex flex-shrink-0"
                            variant="secondary"
                          >
                            {step.badge}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <ScrollArea className="flex-1">
                  <div className="pr-2 pb-4">
                    <TabsContent value="triage" className="mt-0">
                      <TriageStep
                        detail={detail}
                        isLoading={!DEMO_MODE && !pipelineWorkQueue && isLoading}
                      />
                    </TabsContent>

                    <TabsContent value="reasoning" className="mt-0">
                      <LLMReasoningStep
                        detail={detail}
                        isLoading={!DEMO_MODE && !pipelineWorkQueue && isLoading}
                      />
                    </TabsContent>

                    <TabsContent value="sar" className="mt-0">
                      <SARDraftStep
                        detail={detail}
                        isLoading={!DEMO_MODE && !pipelineWorkQueue && isLoading}
                      />
                    </TabsContent>

                    <TabsContent value="validation" className="mt-0">
                      <ValidationStep
                        alertId={selectedAlertId}
                        detail={detail}
                        isLoading={!DEMO_MODE && !pipelineWorkQueue && isLoading}
                        pipelineVerdict={pipelineVerdict}
                      />
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
