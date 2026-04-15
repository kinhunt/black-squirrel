"use client";

interface ConfidenceCardProps {
  title?: string;
  sharpe?: number | null;
  totalReturn?: number | null;
  maxDrawdown?: number | null;
  winRate?: number | null;
  totalTrades?: number | null;
  robustnessScore?: number | null;
  hasExplanation?: boolean;
  hasForks?: boolean;
  contextLabel?: string;
}

function badgeTone(ok: boolean, warn = false) {
  if (ok) return "bg-bs-green/10 text-bs-green border-bs-green/20";
  if (warn) return "bg-bs-red/10 text-bs-red border-bs-red/20";
  return "bg-bs-border text-bs-muted border-bs-border";
}

export default function ConfidenceCard({
  title = "Confidence Snapshot",
  sharpe,
  totalReturn,
  maxDrawdown,
  winRate,
  totalTrades,
  robustnessScore,
  hasExplanation,
  hasForks,
  contextLabel,
}: ConfidenceCardProps) {
  const signals = [
    { label: "Sharpe", ok: (sharpe ?? -999) >= 1.2, warn: (sharpe ?? -999) < 0.5, text: sharpe != null ? sharpe.toFixed(2) : "—" },
    { label: "Return", ok: (totalReturn ?? -999) > 0, warn: (totalReturn ?? 0) < 0, text: totalReturn != null ? `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%` : "—" },
    { label: "Drawdown", ok: maxDrawdown != null ? maxDrawdown > -15 : false, warn: maxDrawdown != null ? maxDrawdown <= -25 : false, text: maxDrawdown != null ? `${maxDrawdown.toFixed(1)}%` : "—" },
    { label: "Win Rate", ok: (winRate ?? -999) >= 50, warn: (winRate ?? 1000) < 40, text: winRate != null ? `${winRate.toFixed(0)}%` : "—" },
    { label: "Trades", ok: (totalTrades ?? 0) >= 20, warn: (totalTrades ?? 0) > 0 && (totalTrades ?? 0) < 8, text: totalTrades != null ? String(totalTrades) : "—" },
  ];

  const positiveCount = signals.filter((s) => s.ok).length + ((robustnessScore ?? 0) >= 60 ? 1 : 0) + (hasExplanation ? 1 : 0);
  const score = Math.max(0, Math.min(100, Math.round((positiveCount / 7) * 100)));
  const tone = score >= 70 ? "text-bs-green" : score >= 45 ? "text-bs-purple" : "text-bs-red";
  const verdict = score >= 70 ? "Looks promising" : score >= 45 ? "Needs judgment" : "High caution";

  return (
    <div className="bg-bs-card border border-bs-border rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">🛡️ {title}</h3>
          <p className="text-xs text-bs-muted mt-1">
            {contextLabel || "Quick trust signals from performance, robustness, and explainability."}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${tone}`}>{score}</div>
          <div className="text-[10px] uppercase tracking-wide text-bs-muted">Trust score</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`px-2 py-1 text-xs rounded-full border ${score >= 70 ? badgeTone(true) : score >= 45 ? badgeTone(false, false) : badgeTone(false, true)}`}>
          {verdict}
        </span>
        {robustnessScore != null && robustnessScore > 0 && (
          <span className={`px-2 py-1 text-xs rounded-full border ${badgeTone(robustnessScore >= 60, robustnessScore < 40)}`}>
            Robustness {robustnessScore.toFixed(0)}
          </span>
        )}
        {hasExplanation && (
          <span className={`px-2 py-1 text-xs rounded-full border ${badgeTone(true)}`}>
            Explainable
          </span>
        )}
        {hasForks && (
          <span className={`px-2 py-1 text-xs rounded-full border ${badgeTone(true)}`}>
            Fork lineage
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {signals.map((signal) => (
          <div key={signal.label} className={`rounded-lg border px-3 py-2 ${badgeTone(signal.ok, signal.warn)}`}>
            <div className="text-[10px] uppercase tracking-wide">{signal.label}</div>
            <div className="text-sm font-semibold mt-1">{signal.text}</div>
          </div>
        ))}
      </div>

      <div className="text-xs text-bs-muted leading-5">
        This card is directional, not absolute. Use it as a fast read before you backtest deeper or fork the strategy.
      </div>
    </div>
  );
}
