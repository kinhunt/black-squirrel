"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ParamDef,
  OptimizeResult,
  ScanResult,
  SymbolInfo,
  runOptimize,
  runScan,
} from "@/lib/api";

interface ParamRange {
  min: number;
  max: number;
  step: number;
}

interface ScoringWeights {
  sharpe: number;
  return: number;
  winRate: number;
  drawdown: number;
  profitFactor: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  sharpe: 30,
  return: 25,
  winRate: 15,
  drawdown: 20,
  profitFactor: 10,
};

interface OptimizerPanelProps {
  code: string;
  params: Record<string, ParamDef>;
  symbols: SymbolInfo[];
  timeframes: string[];
  onApplyParams?: (params: Record<string, number>) => void;
  onClose?: () => void;
}

export default function OptimizerPanel({
  code,
  params,
  symbols,
  timeframes,
  onApplyParams,
  onClose,
}: OptimizerPanelProps) {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(
    symbols.filter((s) => s.available).slice(0, 1).map((s) => s.symbol)
  );
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(["1h"]);
  const [weights, setWeights] = useState<ScoringWeights>({ ...DEFAULT_WEIGHTS });
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [paramRanges, setParamRanges] = useState<Record<string, ParamRange>>(() => {
    const ranges: Record<string, ParamRange> = {};
    Object.entries(params).forEach(([key, def]) => {
      const defVal = def.default;
      const step = def.step || (def.type === "int" ? 1 : 0.1);
      ranges[key] = {
        min: def.min ?? Math.max(1, Math.floor(defVal * 0.3)),
        max: def.max ?? Math.ceil(defVal * 3),
        step,
      };
    });
    return ranges;
  });

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const estimate = useMemo(() => {
    let paramCombos = 1;
    Object.values(paramRanges).forEach((r) => {
      const steps = Math.max(1, Math.floor((r.max - r.min) / r.step) + 1);
      paramCombos *= steps;
    });
    const total = paramCombos * selectedSymbols.length * selectedTimeframes.length;
    const estimatedSeconds = Math.ceil(total * 0.5);
    return { total, estimatedSeconds, paramCombos };
  }, [paramRanges, selectedSymbols, selectedTimeframes]);

  const weightsTotal = useMemo(() => {
    return weights.sharpe + weights.return + weights.winRate + weights.drawdown + weights.profitFactor;
  }, [weights]);

  const isScanMode = selectedSymbols.length > 1 || selectedTimeframes.length > 1;

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf]
    );
  };

  const updateRange = (key: string, field: keyof ParamRange, value: number) => {
    setParamRanges((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const updateWeight = (key: keyof ScoringWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const handleRun = useCallback(async () => {
    if (selectedSymbols.length === 0 || selectedTimeframes.length === 0) {
      setError("Select at least one symbol and timeframe");
      return;
    }

    setRunning(true);
    setProgress(0);
    setError(null);
    setResult(null);
    setScanResult(null);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 0.05, 0.95));
    }, 1000);

    try {
      const total = weightsTotal || 1;
      const normalizedWeights: Record<string, number> = {
        sharpe: weights.sharpe / total,
        return: weights.return / total,
        winRate: weights.winRate / total,
        drawdown: weights.drawdown / total,
        profitFactor: weights.profitFactor / total,
      };

      if (isScanMode) {
        const res = await runScan({
          code,
          symbols: selectedSymbols,
          timeframes: selectedTimeframes,
          paramRanges,
          weights: normalizedWeights,
        });
        setScanResult(res);
      } else {
        const optimResult = await runOptimize({
          code,
          symbol: selectedSymbols[0],
          timeframe: selectedTimeframes[0],
          paramRanges,
          weights: normalizedWeights,
        });
        setResult(optimResult);
      }

      setProgress(1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : isScanMode ? "Scan failed" : "Optimization failed";
      setError(msg);
    } finally {
      clearInterval(progressInterval);
      setRunning(false);
    }
  }, [code, selectedSymbols, selectedTimeframes, paramRanges, weights, weightsTotal, isScanMode]);

  return (
    <div className="bg-bs-card border border-bs-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-bs-border">
        <div>
          <h3 className="text-lg font-semibold">🔬 Strategy Optimizer</h3>
          <p className="text-xs text-bs-muted mt-1">
            {isScanMode ? "Multi-selection detected — running cross-market scan" : "Single selection — running parameter optimization"}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-bs-muted hover:text-white transition-colors">
            ✕
          </button>
        )}
      </div>

      {!result && !scanResult ? (
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Symbols</label>
            <div className="flex flex-wrap gap-2">
              {symbols.filter((s) => s.available).map((s) => (
                <button
                  key={s.symbol}
                  onClick={() => toggleSymbol(s.symbol)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedSymbols.includes(s.symbol)
                      ? "bg-bs-purple text-white"
                      : "bg-bs-input border border-bs-border text-bs-muted hover:border-bs-purple/50"
                  }`}
                >
                  {s.symbol.split("/")[0]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Timeframes</label>
            <div className="flex flex-wrap gap-2">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => toggleTimeframe(tf)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedTimeframes.includes(tf)
                      ? "bg-bs-purple text-white"
                      : "bg-bs-input border border-bs-border text-bs-muted hover:border-bs-purple/50"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-bs-border rounded-lg overflow-hidden">
            <button
              onClick={() => setWeightsOpen(!weightsOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-bs-input hover:bg-bs-card-hover transition-colors"
            >
              <span className="text-sm font-medium">⚖️ Scoring Weights</span>
              <span className="text-bs-muted text-xs">{weightsOpen ? "▲" : "▼"}</span>
            </button>
            {weightsOpen && (
              <div className="p-4 space-y-3 bg-bs-input/50">
                {([
                  { key: "sharpe" as const, label: "Sharpe Ratio" },
                  { key: "return" as const, label: "Return" },
                  { key: "winRate" as const, label: "Win Rate" },
                  { key: "drawdown" as const, label: "Max Drawdown" },
                  { key: "profitFactor" as const, label: "Profit Factor" },
                ]).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm w-28 truncate">{label}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={weights[key]}
                      onChange={(e) => updateWeight(key, Number(e.target.value))}
                      className="flex-1 accent-bs-purple"
                    />
                    <span className="text-xs text-bs-muted w-10 text-right font-mono">
                      {weightsTotal > 0 ? Math.round((weights[key] / weightsTotal) * 100) : 0}%
                    </span>
                  </div>
                ))}
                <div className="text-xs text-bs-muted text-right pt-1 border-t border-bs-border/50">
                  Raw total: {weightsTotal} (auto-normalized)
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Parameter Ranges</label>
            <div className="space-y-3">
              {Object.entries(paramRanges).map(([key, range]) => (
                <div key={key} className="bg-bs-input rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono font-medium">{key}</span>
                    <span className="text-xs text-bs-muted">
                      {range.min} → {range.max} (step {range.step})
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-bs-muted">Min</label>
                      <input
                        type="number"
                        value={range.min}
                        onChange={(e) => updateRange(key, "min", Number(e.target.value))}
                        className="w-full px-2 py-1 bg-bs-card border border-bs-border rounded text-sm text-center focus:outline-none focus:border-bs-purple"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-bs-muted">Max</label>
                      <input
                        type="number"
                        value={range.max}
                        onChange={(e) => updateRange(key, "max", Number(e.target.value))}
                        className="w-full px-2 py-1 bg-bs-card border border-bs-border rounded text-sm text-center focus:outline-none focus:border-bs-purple"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-bs-muted">Step</label>
                      <input
                        type="number"
                        value={range.step}
                        onChange={(e) => updateRange(key, "step", Number(e.target.value))}
                        className="w-full px-2 py-1 bg-bs-card border border-bs-border rounded text-sm text-center focus:outline-none focus:border-bs-purple"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {Object.keys(paramRanges).length === 0 && (
                <p className="text-sm text-bs-muted text-center py-4">
                  No tunable parameters found. Generate or edit code first.
                </p>
              )}
            </div>
          </div>

          <div className="bg-bs-input rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                Estimated: <span className="text-bs-purple">{estimate.total.toLocaleString()}</span> backtests
              </p>
              <p className="text-xs text-bs-muted">
                ~{estimate.estimatedSeconds > 60
                  ? `${Math.ceil(estimate.estimatedSeconds / 60)} min`
                  : `${estimate.estimatedSeconds}s`}
              </p>
              <p className="text-xs text-bs-muted mt-1">
                Mode: {isScanMode ? "Cross-market scan" : "Single-market optimization"}
              </p>
            </div>
            <button
              onClick={handleRun}
              disabled={running || Object.keys(paramRanges).length === 0}
              className="px-6 py-2.5 bg-bs-purple text-white font-semibold rounded-lg hover:bg-bs-purple-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {running && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {running ? (isScanMode ? "Scanning..." : "Optimizing...") : (isScanMode ? "🛰️ Start Scan" : "🚀 Start Optimization")}
            </button>
          </div>

          {running && (
            <div>
              <div className="w-full h-2 bg-bs-input rounded-full overflow-hidden">
                <div
                  className="h-full bg-bs-purple rounded-full transition-all duration-500"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="text-xs text-bs-muted mt-1 text-center">
                {(progress * 100).toFixed(0)}% complete
              </p>
            </div>
          )}

          {error && (
            <div className="px-4 py-2 bg-bs-red/10 border border-bs-red/30 rounded-lg text-sm text-bs-red">
              {error}
            </div>
          )}
        </div>
      ) : result ? (
        <OptimizerResults
          result={result}
          onApply={onApplyParams}
          onReset={() => setResult(null)}
        />
      ) : scanResult ? (
        <ScanResultsView
          result={scanResult}
          onApply={onApplyParams}
          onReset={() => setScanResult(null)}
        />
      ) : null}
    </div>
  );
}

function OptimizerResults({
  result,
  onApply,
  onReset,
}: {
  result: OptimizeResult;
  onApply?: (params: Record<string, number>) => void;
  onReset: () => void;
}) {
  const topResults = (result.allResults || [])
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, 10);

  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label="Total Runs" value={String(result.totalRuns)} />
        <MetricCard label="Duration" value={`${result.elapsedSeconds.toFixed(1)}s`} />
        <MetricCard label="In-Sample Sharpe" value={result.inSample?.sharpe?.toFixed(2) ?? "—"} highlight="green" />
        <MetricCard label="Out-Sample Sharpe" value={result.outSample?.sharpe?.toFixed(2) ?? "—"} highlight={result.overfittingWarning ? "red" : "green"} />
        <MetricCard label="Composite Score" value={result.inSample?.compositeScore != null ? (result.inSample.compositeScore * 100).toFixed(1) : "—"} highlight="purple" />
      </div>

      {result.overfittingWarning && (
        <div className="px-4 py-3 bg-bs-red/10 border border-bs-red/30 rounded-lg flex items-start gap-2">
          <span className="text-bs-red text-lg">⚠️</span>
          <div>
            <p className="text-sm font-medium text-bs-red">Overfitting Detected</p>
            <p className="text-xs text-bs-muted">
              Out-of-sample performance is significantly lower than in-sample. Consider using fewer parameters or wider ranges.
            </p>
          </div>
        </div>
      )}

      <BestParamsCard params={result.bestParams} onApply={onApply} />

      {topResults.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Top 10 Results</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bs-border text-bs-muted text-left">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Params</th>
                  <th className="px-2 py-2 font-medium text-right">Sharpe</th>
                  <th className="px-2 py-2 font-medium text-right">Return</th>
                  <th className="px-2 py-2 font-medium text-right">MaxDD</th>
                  <th className="px-2 py-2 font-medium text-right">Win%</th>
                  <th className="px-2 py-2 font-medium text-right">Trades</th>
                  <th className="px-2 py-2 font-medium text-right">PF</th>
                  <th className="px-2 py-2 font-medium text-right">Score</th>
                  <th className="px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {topResults.map((r, i) => (
                  <tr key={i} className="border-b border-bs-border/50 hover:bg-bs-card-hover">
                    <td className="px-2 py-2 text-bs-muted">{i + 1}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {Object.entries(r.params)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{r.sharpe?.toFixed(2) ?? "—"}</td>
                    <td className={`px-2 py-2 text-right font-mono ${(r.return ?? 0) >= 0 ? "text-bs-green" : "text-bs-red"}`}>
                      {r.return != null ? `${r.return >= 0 ? "+" : ""}${r.return.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-bs-red">{r.drawdown != null ? `${r.drawdown.toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.winRate != null ? `${r.winRate.toFixed(0)}%` : "—"}</td>
                    <td className="px-2 py-2 text-right font-mono text-bs-muted">{r.trades ?? "—"}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.profitFactor != null && r.profitFactor > 0 ? r.profitFactor.toFixed(2) : "—"}</td>
                    <td className="px-2 py-2 text-right font-mono text-bs-purple font-bold">
                      {r.compositeScore != null ? (r.compositeScore * 100).toFixed(1) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {onApply && (
                        <button
                          onClick={() => onApply(r.params)}
                          className="px-2 py-0.5 text-[10px] bg-bs-purple/20 text-bs-purple rounded hover:bg-bs-purple/40 transition-colors"
                        >
                          Apply
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ResultsActions onReset={onReset} onApply={onApply} bestParams={result.bestParams} />
    </div>
  );
}

function ScanResultsView({
  result,
  onApply,
  onReset,
}: {
  result: ScanResult;
  onApply?: (params: Record<string, number>) => void;
  onReset: () => void;
}) {
  const rows = result.results || [];
  const best = result.bestOverall;
  const bestParams = best?.bestParams || {};
  const bestOut = best?.outSample;

  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label="Scan Rows" value={String(rows.length)} />
        <MetricCard label="Total Runs" value={String(result.totalRuns)} />
        <MetricCard label="Duration" value={result.totalElapsedSeconds != null ? `${result.totalElapsedSeconds.toFixed(1)}s` : "—"} />
        <MetricCard label="Robustness" value={`${(result.robustnessScore ?? 0).toFixed(1)}`} highlight="purple" />
        <MetricCard label="Best Out-Sample Sharpe" value={bestOut?.sharpe != null ? bestOut.sharpe.toFixed(2) : "—"} highlight="green" />
      </div>

      {best && (
        <div className="bg-bs-input rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold">🏆 Best Overall Combination</h4>
              <p className="text-xs text-bs-muted mt-1">
                {best.symbol} · {best.timeframe}
              </p>
            </div>
            {onApply && Object.keys(bestParams).length > 0 && (
              <button
                onClick={() => onApply(bestParams)}
                className="px-3 py-1 text-xs bg-bs-green text-black font-semibold rounded hover:bg-bs-green-dark transition-colors"
              >
                Apply Best Params
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Sharpe" value={bestOut?.sharpe != null ? bestOut.sharpe.toFixed(2) : "—"} highlight="green" compact />
            <MetricCard label="Return" value={bestOut?.return_pct != null ? `${bestOut.return_pct >= 0 ? "+" : ""}${bestOut.return_pct.toFixed(1)}%` : "—"} highlight={bestOut?.return_pct != null && bestOut.return_pct >= 0 ? "green" : "red"} compact />
            <MetricCard label="Drawdown" value={bestOut?.max_drawdown != null ? `${bestOut.max_drawdown.toFixed(1)}%` : "—"} highlight="red" compact />
            <MetricCard label="Score" value={bestOut?.compositeScore != null ? (bestOut.compositeScore * 100).toFixed(1) : "—"} highlight="purple" compact />
          </div>

          <BestParamsCard params={bestParams} onApply={onApply} compact />
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Scan Results</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bs-border text-bs-muted text-left">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Market</th>
                  <th className="px-2 py-2 font-medium text-right">Sharpe</th>
                  <th className="px-2 py-2 font-medium text-right">Return</th>
                  <th className="px-2 py-2 font-medium text-right">MaxDD</th>
                  <th className="px-2 py-2 font-medium text-right">Score</th>
                  <th className="px-2 py-2 font-medium">Params</th>
                  <th className="px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.symbol}-${row.timeframe}-${i}`} className="border-b border-bs-border/50 hover:bg-bs-card-hover">
                    <td className="px-2 py-2 text-bs-muted">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{row.symbol}</div>
                      <div className="text-xs text-bs-muted">{row.timeframe}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{row.outSample?.sharpe != null ? row.outSample.sharpe.toFixed(2) : "—"}</td>
                    <td className={`px-2 py-2 text-right font-mono ${(row.outSample?.return_pct ?? 0) >= 0 ? "text-bs-green" : "text-bs-red"}`}>
                      {row.outSample?.return_pct != null ? `${row.outSample.return_pct >= 0 ? "+" : ""}${row.outSample.return_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-bs-red">{row.outSample?.max_drawdown != null ? `${row.outSample.max_drawdown.toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-2 text-right font-mono text-bs-purple font-bold">
                      {row.outSample?.compositeScore != null ? (row.outSample.compositeScore * 100).toFixed(1) : "—"}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {Object.entries(row.bestParams || {})
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {onApply && Object.keys(row.bestParams || {}).length > 0 && (
                        <button
                          onClick={() => onApply(row.bestParams)}
                          className="px-2 py-0.5 text-[10px] bg-bs-purple/20 text-bs-purple rounded hover:bg-bs-purple/40 transition-colors"
                        >
                          Apply
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ResultsActions onReset={onReset} onApply={onApply} bestParams={bestParams} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight,
  compact = false,
}: {
  label: string;
  value: string;
  highlight?: "green" | "red" | "purple";
  compact?: boolean;
}) {
  const color =
    highlight === "green"
      ? "text-bs-green"
      : highlight === "red"
        ? "text-bs-red"
        : highlight === "purple"
          ? "text-bs-purple"
          : "";

  return (
    <div className={`bg-bs-input rounded-lg ${compact ? "p-2" : "p-3"} text-center`}>
      <p className="text-[10px] text-bs-muted uppercase">{label}</p>
      <p className={`${compact ? "text-sm" : "text-lg"} font-bold ${color}`}>{value}</p>
    </div>
  );
}

function BestParamsCard({
  params,
  onApply,
  compact = false,
}: {
  params: Record<string, number>;
  onApply?: (params: Record<string, number>) => void;
  compact?: boolean;
}) {
  return (
    <div className="bg-bs-input rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h4 className="text-sm font-semibold">🏆 Best Parameters</h4>
        {onApply && Object.keys(params).length > 0 && (
          <button
            onClick={() => onApply(params)}
            className="px-3 py-1 text-xs bg-bs-green text-black font-semibold rounded hover:bg-bs-green-dark transition-colors"
          >
            Apply
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(params).length > 0 ? Object.entries(params).map(([key, val]) => (
          <span key={key} className={`px-2 py-1 bg-bs-card rounded ${compact ? "text-xs" : "text-sm"} font-mono`}>
            {key}: <span className="text-bs-purple font-bold">{val}</span>
          </span>
        )) : (
          <span className="text-sm text-bs-muted">No parameters available</span>
        )}
      </div>
    </div>
  );
}

function ResultsActions({
  onReset,
  onApply,
  bestParams,
}: {
  onReset: () => void;
  onApply?: (params: Record<string, number>) => void;
  bestParams: Record<string, number>;
}) {
  return (
    <div className="flex justify-between">
      <button
        onClick={onReset}
        className="px-4 py-2 text-sm text-bs-muted hover:text-white transition-colors"
      >
        ← Re-configure
      </button>
      {onApply && Object.keys(bestParams).length > 0 && (
        <button
          onClick={() => onApply(bestParams)}
          className="px-6 py-2 bg-bs-green text-black text-sm font-semibold rounded-lg hover:bg-bs-green-dark transition-colors"
        >
          ✓ Apply Best Parameters
        </button>
      )}
    </div>
  );
}
