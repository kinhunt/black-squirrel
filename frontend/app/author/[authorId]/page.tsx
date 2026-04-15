"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchStrategies, Strategy, getAuthorName, getBestConfig } from "@/lib/api";

export default function AuthorPage() {
  const params = useParams();
  const router = useRouter();
  const authorId = params.authorId as string;
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStrategies()
      .then((data) => setStrategies(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const authorStrategies = useMemo(() => {
    return strategies.filter((s) => {
      if (typeof s.author === "object" && s.author) {
        return s.author.id === authorId || s.author.walletAddress === authorId;
      }
      return s.author === authorId;
    });
  }, [strategies, authorId]);

  const authorName = authorStrategies[0] ? getAuthorName(authorStrategies[0]) : "Author";

  const avgRobustness = useMemo(() => {
    const vals = authorStrategies.map((s) => s.robustnessScore ?? 0).filter((v) => v > 0);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [authorStrategies]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-bs-muted hover:text-white transition-colors mb-3"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-2">{authorName}</h1>
        <p className="text-bs-muted">Author profile and published strategies.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Strategies" value={String(authorStrategies.length)} />
        <StatCard label="Avg Robustness" value={avgRobustness != null ? avgRobustness.toFixed(0) : "—"} tone="purple" />
        <StatCard label="Forkable Ideas" value={String(authorStrategies.filter((s) => !!s.forkFromId).length)} tone="green" />
        <StatCard label="Published" value={authorStrategies.length > 0 ? "Yes" : "—"} />
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="bs-skeleton h-48 rounded-xl" />)}
        </div>
      )}

      {error && (
        <div className="text-center py-20">
          <p className="text-bs-red mb-2">Failed to load author</p>
          <p className="text-bs-muted text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && authorStrategies.length === 0 && (
        <div className="text-center py-20 text-bs-muted">No published strategies for this author yet.</div>
      )}

      {!loading && !error && authorStrategies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {authorStrategies.map((strategy) => (
            <button
              key={strategy.id}
              onClick={() => router.push(`/strategy/${strategy.id}`)}
              className="text-left bg-bs-card border border-bs-border rounded-xl p-5 hover:border-bs-purple/50 hover:bg-bs-card-hover transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{strategy.name}</div>
                  <div className="text-xs text-bs-muted">{new Date(strategy.createdAt).toLocaleDateString()}</div>
                </div>
                {(strategy.robustnessScore ?? 0) > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded bg-bs-green/10 text-bs-green font-medium">
                    R {strategy.robustnessScore?.toFixed(0)}
                  </span>
                )}
              </div>
              <p className="text-sm text-bs-muted line-clamp-2 min-h-[2.5rem] mb-3">
                {strategy.description || "No description yet."}
              </p>
              {(() => {
                const cfg = getBestConfig(strategy);
                const sharpe = cfg?.sharpeRatio ?? strategy.backtest?.sharpeRatio ?? strategy.performance?.sharpeRatio;
                const totalReturn = cfg?.totalReturn ?? strategy.backtest?.totalReturn ?? strategy.performance?.totalReturn;
                return (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-bs-muted">Sharpe</span><span>{sharpe?.toFixed(2) ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-bs-muted">Return</span><span className={(totalReturn ?? 0) >= 0 ? "text-bs-green" : "text-bs-red"}>{totalReturn != null ? `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%` : "—"}</span></div>
                  </div>
                );
              })()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "green" | "purple" }) {
  const color = tone === "green" ? "text-bs-green" : tone === "purple" ? "text-bs-purple" : "text-white";
  return (
    <div className="bg-bs-card border border-bs-border rounded-xl p-4">
      <p className="text-bs-muted text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
