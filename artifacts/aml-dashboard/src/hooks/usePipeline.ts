import { useState, useRef, useCallback, useEffect } from "react";
import { PIPELINE_BASE_URL } from "@/config";
import type {
  PipelineRunStatus,
  PipelineStatusResponse,
  PipelineResults,
  CumulativeData,
} from "@/types/pipeline";

const EMPTY_CUMULATIVE: CumulativeData = {
  true_positives: 0,
  false_positives: 0,
  false_negatives: 0,
  true_negatives: 0,
  precision: null,
  recall: null,
  sars_generated: 0,
  completed_transactions: [],
};

function apiUrl(path: string): string {
  const base = PIPELINE_BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

export interface PipelineState {
  status: PipelineRunStatus;
  step: number;
  stepLabel: string;
  progress: number;
  progressTotal: number;
  cumulative: CumulativeData;
  results: PipelineResults | null;
  error: string | null;
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({
    status: "idle",
    step: 0,
    stepLabel: "",
    progress: 0,
    progressTotal: 0,
    cumulative: EMPTY_CUMULATIVE,
    results: null,
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/pipeline/results"));
      if (!res.ok) throw new Error(`Results error: ${res.status}`);
      const data: PipelineResults = await res.json();
      setState((prev) => ({ ...prev, results: data, status: "done" }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to fetch results",
      }));
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/pipeline/status"));
      if (!res.ok) throw new Error(`Status error: ${res.status}`);
      const data: PipelineStatusResponse = await res.json();

      setState((prev) => ({
        ...prev,
        step: data.step ?? prev.step,
        stepLabel: data.step_label ?? prev.stepLabel,
        progress: data.progress ?? prev.progress,
        progressTotal: data.progress_total ?? prev.progressTotal,
        cumulative: data.cumulative ?? prev.cumulative,
      }));

      if (data.status === "done") {
        stopPolling();
        await fetchResults();
      } else if (data.status === "error") {
        stopPolling();
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Pipeline reported an error. Check server logs.",
        }));
      }
    } catch (err) {
      stopPolling();
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Polling failed",
      }));
    }
  }, [stopPolling, fetchResults]);

  const runPipeline = useCallback(async () => {
    stopPolling();
    setState({
      status: "running",
      step: 1,
      stepLabel: "Starting pipeline…",
      progress: 0,
      progressTotal: 0,
      cumulative: EMPTY_CUMULATIVE,
      results: null,
      error: null,
    });

    try {
      const res = await fetch(apiUrl("/pipeline/run-async"), {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Start error: ${res.status}`);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to start pipeline",
      }));
      return;
    }

    await pollStatus();
    intervalRef.current = setInterval(pollStatus, 2000);
  }, [stopPolling, pollStatus]);

  const reset = useCallback(() => {
    stopPolling();
    setState({
      status: "idle",
      step: 0,
      stepLabel: "",
      progress: 0,
      progressTotal: 0,
      cumulative: EMPTY_CUMULATIVE,
      results: null,
      error: null,
    });
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { state, runPipeline, reset };
}
