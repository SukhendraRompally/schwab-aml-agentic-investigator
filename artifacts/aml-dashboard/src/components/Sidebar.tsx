import {
  useListAlerts,
  getListAlertsQueryKey,
} from "@workspace/api-client-react";
import type { Alert } from "@workspace/api-client-react";
import { DEMO_MODE } from "@/config";
import { mockAlerts } from "@/mockData";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, AlertTriangle, Info, Clock, ChevronRight, Zap } from "lucide-react";

interface SidebarProps {
  selectedAlertId: string | null;
  onSelectAlert: (id: string) => void;
  pipelineAlerts?: Alert[];
}

export function Sidebar({ selectedAlertId, onSelectAlert, pipelineAlerts }: SidebarProps) {
  const { data, isLoading, isError } = useListAlerts({
    query: {
      enabled: !DEMO_MODE && !pipelineAlerts,
      queryKey: getListAlertsQueryKey(),
    },
  });

  const hasPipelineQueue = pipelineAlerts && pipelineAlerts.length > 0;
  const alerts: Alert[] = hasPipelineQueue
    ? pipelineAlerts
    : DEMO_MODE || isError
      ? mockAlerts
      : data?.alerts ?? [];
  const loading = !DEMO_MODE && !hasPipelineQueue && isLoading;

  const pendingCount = alerts.filter((a) => a.status === "PENDING").length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "HIGH": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "MEDIUM": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 90) return "text-destructive";
    if (score >= 70) return "text-orange-500";
    if (score >= 50) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="w-80 border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border bg-muted/30">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" /> Work Queue
          {hasPipelineQueue && (
            <Badge className="text-[10px] px-1.5 h-4 bg-primary/20 text-primary border border-primary/30 ml-auto">
              <Zap className="h-2.5 w-2.5 mr-0.5" /> Pipeline
            </Badge>
          )}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {loading
            ? "Loading alerts…"
            : hasPipelineQueue
              ? `${alerts.length} flagged — ${pendingCount} pending review`
              : `${alerts.length} active alerts`}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 border rounded-md">
                <div className="flex justify-between items-start mb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-3 w-32 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : (
            alerts.map((alert: Alert) => (
              <button
                key={alert.alertId}
                onClick={() => onSelectAlert(alert.alertId)}
                className={`w-full text-left p-3 rounded-md border transition-all duration-200 hover-elevate ${
                  selectedAlertId === alert.alertId
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-border/80"
                }`}
                data-testid={`alert-item-${alert.alertId}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                    {getSeverityIcon(alert.severity)}
                    {alert.alertId}
                  </div>
                  <span className={`text-xs font-bold ${getRiskColor(alert.riskScore)}`}>
                    {alert.riskScore}
                  </span>
                </div>

                <div className="font-medium text-sm text-foreground truncate mb-1">
                  {alert.accountName}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate mr-2 max-w-[120px]">
                    {(alert.primaryFlag ?? "").replace(/_/g, " ")}
                  </span>
                  <span className="font-mono">${alert.totalAmount.toLocaleString()}</span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-[10px] h-5 px-1.5 ${
                      alert.status === "PENDING" ? "border-amber-500/50 text-amber-600" : ""
                    }`}
                  >
                    {alert.status}
                  </Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
