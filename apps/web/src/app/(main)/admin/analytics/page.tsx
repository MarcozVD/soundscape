'use client';

import { trpc } from '@/lib/trpc';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[#171717] border border-[#262626] rounded-xl p-6 text-center">
      <p className="text-4xl font-bold text-white tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-[#a3a3a3] text-sm mt-2">{label}</p>
    </div>
  );
}

function MetricBar({ label, value, max = 1 }: { label: string; value: number | null; max?: number }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#a3a3a3]">{label}</span>
        <span className="text-white font-medium tabular-nums">
          {value != null ? (max === 1 ? `${(value * 100).toFixed(1)}%` : value.toFixed(3)) : 'N/A'}
        </span>
      </div>
      <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatDate(d: Date | string | null): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AnalyticsDashboardPage() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: mlHealth, isLoading: mlLoading } = trpc.admin.mlHealth.useQuery();

  const isLoading = statsLoading || mlLoading;

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="text-[#a3a3a3] mt-1">Platform overview and ML model health</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#171717] rounded-xl" />
          ))}
        </div>
      )}

      {/* Platform stats */}
      {stats && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Platform stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total users" value={stats.users} />
            <StatCard label="Tracks in catalog" value={stats.tracks} />
            <StatCard label="Listen events" value={stats.listenEvents} />
            <StatCard label="Ratings submitted" value={stats.ratings} />
          </div>
        </div>
      )}

      {/* ML health */}
      {mlHealth && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">ML service</h2>

          {/* Status card */}
          <div className="bg-[#171717] border border-[#262626] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full ${
                  mlHealth.status === 'ok' || mlHealth.status === 'healthy'
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-white font-medium capitalize">
                {mlHealth.status === 'unreachable' ? 'Service unreachable' : mlHealth.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-[#525252]">Model version</p>
                <p className="text-white font-mono">{mlHealth.modelVersion ?? 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[#525252]">Last trained</p>
                <p className="text-white">{formatDate(mlHealth.lastTrainedAt)}</p>
              </div>
            </div>
          </div>

          {/* Quality metrics */}
          <div className="bg-[#171717] border border-[#262626] rounded-xl p-6 space-y-5">
            <h3 className="text-base font-semibold text-white">Recommendation quality</h3>
            <MetricBar label="Precision@10" value={mlHealth.precisionAt10} />
            <MetricBar label="Catalog coverage" value={mlHealth.coverage} />
          </div>
        </div>
      )}

      {/* Phase notice */}
      <div className="bg-[#171717] border border-[#262626] rounded-xl p-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#262626] text-[#a3a3a3] border border-[#404040]">
            Phase 4
          </span>
          <p className="text-sm text-[#a3a3a3]">
            Advanced analytics, A/B testing metrics, and retention charts are planned for Phase 4.
          </p>
        </div>
      </div>
    </div>
  );
}
