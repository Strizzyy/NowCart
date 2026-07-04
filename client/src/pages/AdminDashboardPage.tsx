import { useEffect, useState } from 'react';
import {
  Shield, Activity, Zap, Brain, RefreshCw,
  Cloud, LogOut, Cpu,
} from 'lucide-react';
import type { AppContext } from '../App';
import { Card, Chip } from '../ui';

interface Props {
  ctx: AppContext;
  onLogout: () => void;
}

interface Stats {
  total_requests: number;
  error_rate: number;
  error_rate_pct: string;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p50_latency_ms: number;
  carts_built: number;
  cache_hits: number;
  cache_misses: number;
  cache_hit_ratio: number;
  cache_hit_ratio_pct: string;
  llm_calls: number;
  top_paths: Record<string, number>;
  requests_per_status: { '2xx': number; '4xx': number; '5xx': number };
  health: { status: string; error_budget_remaining: string };
}

interface CostData {
  llm: {
    calls: number;
    cache_hits: number;
    cost_usd: number;
    cache_savings_usd: number;
    cost_per_cart_usd: number;
    pricing_note: string;
  };
  aws: {
    available: boolean;
    error: string | null;
    period: { Start?: string; End?: string };
    total_usd: number;
    by_service: { service: string; cost_usd: number }[];
  };
}

interface Info {
  providers: { text_llm: string; text_model: string; vision_llm: string; vision_model: string };
  backends: { data: string; cache: string; region: string };
  features: Record<string, boolean | string[]>;
  scaling: Record<string, string>;
}

function KpiCard({ icon, title, value, sub, iconBg }: {
  icon: React.ReactNode; title: string; value: string; sub: string; iconBg: string;
}) {
  return (
    <Card padding="md" className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">{title}</p>
        <p className="text-2xl font-bold text-dark leading-tight">{value}</p>
        <p className="text-[11px] text-muted mt-1">{sub}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
    </Card>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted w-8 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-light-bg rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-dark w-14 text-right">{value.toFixed(0)}ms</span>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-light-bg rounded-xl p-3">
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-dark truncate">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage({ onLogout }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [cost, setCost] = useState<CostData | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'infra'>('overview');

  const fetchData = async () => {
    try {
      const [sRes, iRes, cRes] = await Promise.all([
        fetch('/api/meta/stats'),
        fetch('/api/meta/info'),
        fetch('/api/meta/cost'),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (iRes.ok) setInfo(await iRes.json());
      if (cRes.ok) setCost(await cRes.json());
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('metrics fetch failed', e);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);

  const maxLatency = Math.max(stats?.p95_latency_ms ?? 100, stats?.avg_latency_ms ?? 50, 100);
  const topPaths = stats
    ? Object.entries(stats.top_paths).sort(([, a], [, b]) => b - a).slice(0, 6)
    : [];
  const isHealthy = stats?.health.status === 'healthy';

  const TABS = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'infra' as const, label: 'Infra & Cost' },
  ];

  return (
    <div className="min-h-screen bg-light-bg">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-dark leading-tight">Admin Dashboard</p>
            <p className="text-[11px] text-muted leading-tight">NowCart Observability</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={isHealthy ? 'success' : 'accent'} size="xs">
            {isHealthy ? '● Healthy' : '● Degraded'}
          </Chip>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted bg-light-bg px-2.5 py-1.5 rounded-lg">
            <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '5s' }} />
            {lastUpdated || '—'}
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-dark px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="sticky top-[57px] z-40 bg-surface border-b border-border flex">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-semibold transition border-b-2 ${
              activeTab === tab.id
                ? 'text-primary-ink border-primary'
                : 'text-muted border-transparent hover:text-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* ════════ OVERVIEW ════════ */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                icon={<Activity size={18} className="text-primary-ink" />}
                title="Total Requests"
                value={stats?.total_requests.toLocaleString() ?? '0'}
                sub="All endpoints"
                iconBg="bg-primary-light"
              />
              <KpiCard
                icon={<Brain size={18} className="text-blue-600" />}
                title="Carts Built"
                value={stats?.carts_built.toLocaleString() ?? '0'}
                sub="AI assembled"
                iconBg="bg-blue-50"
              />
              <KpiCard
                icon={<Zap size={18} className="text-secondary-dark" />}
                title="Avg Latency"
                value={`${stats?.avg_latency_ms.toFixed(0) ?? '0'}ms`}
                sub={`P95: ${stats?.p95_latency_ms.toFixed(0) ?? '0'}ms`}
                iconBg="bg-secondary/15"
              />
              <KpiCard
                icon={<Shield size={18} className={stats && stats.error_rate > 0.05 ? 'text-accent' : 'text-primary-ink'} />}
                title="Error Rate"
                value={stats?.error_rate_pct ?? '0%'}
                sub={`Budget: ${stats?.health.error_budget_remaining ?? '100%'}`}
                iconBg={stats && stats.error_rate > 0.05 ? 'bg-accent/10' : 'bg-primary-light'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card padding="md">
                <p className="text-xs font-semibold text-dark mb-3 flex items-center gap-1.5">
                  <Zap size={13} className="text-secondary" /> Latency
                </p>
                <div className="space-y-2.5">
                  <MiniBar label="P50" value={stats?.p50_latency_ms ?? 0} max={maxLatency} color="bg-primary" />
                  <MiniBar label="Avg" value={stats?.avg_latency_ms ?? 0} max={maxLatency} color="bg-blue-500" />
                  <MiniBar label="P95" value={stats?.p95_latency_ms ?? 0} max={maxLatency} color="bg-secondary" />
                </div>
              </Card>

              <Card padding="md" className="flex flex-col items-center justify-center text-center gap-2">
                <p className="text-xs font-semibold text-dark self-start">LLM Cache</p>
                <div className="relative w-16 h-16">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f0f2f5" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="14" fill="none"
                      stroke="#3bb77e" strokeWidth="3"
                      strokeDasharray={`${(stats?.cache_hit_ratio ?? 0) * 88} 88`}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-ink">{stats?.cache_hit_ratio_pct ?? '0%'}</span>
                  </div>
                </div>
                <div className="text-[11px] text-muted space-y-0.5">
                  <p><span className="font-semibold text-dark">{stats?.cache_hits ?? 0}</span> hits</p>
                  <p><span className="font-semibold text-dark">{stats?.llm_calls ?? 0}</span> LLM calls</p>
                </div>
              </Card>
            </div>

            <Card padding="md">
              <p className="text-xs font-semibold text-dark mb-3">Response Status</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-primary-ink">{stats?.requests_per_status['2xx'] ?? 0}</p>
                  <p className="text-[11px] text-muted">2xx OK</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-secondary-dark">{stats?.requests_per_status['4xx'] ?? 0}</p>
                  <p className="text-[11px] text-muted">4xx Client</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-accent">{stats?.requests_per_status['5xx'] ?? 0}</p>
                  <p className="text-[11px] text-muted">5xx Server</p>
                </div>
              </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="px-4 py-3 bg-light-bg border-b border-border">
                <p className="text-xs font-semibold text-dark">Top Endpoints by Traffic</p>
              </div>
              {topPaths.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted text-center">No traffic yet — start using the app!</p>
              ) : (
                <div className="divide-y divide-border">
                  {topPaths.map(([path, count]) => (
                    <div key={path} className="flex items-center justify-between px-4 py-2.5 hover:bg-light-bg transition">
                      <code className="text-xs text-primary-ink font-mono truncate flex-1 mr-3">{path}</code>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold bg-light-bg border border-border px-2 py-0.5 rounded-md">{count}</span>
                        <span className="text-[11px] text-muted w-10 text-right">
                          {stats ? ((count / stats.total_requests) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* ════════ INFRA & COST ════════ */}
        {activeTab === 'infra' && (
          <>
            {/* AI providers */}
            <Card padding="md">
              <p className="text-xs font-semibold text-dark mb-3 flex items-center gap-1.5">
                <Brain size={13} className="text-blue-600" /> AI Providers
              </p>
              <div className="grid grid-cols-2 gap-2">
                <InfoPill label="Text LLM" value={info?.providers.text_llm ?? '—'} />
                <InfoPill label="Model" value={info?.providers.text_model ?? '—'} />
                <InfoPill label="Vision LLM" value={info?.providers.vision_llm ?? '—'} />
                <InfoPill label="Vision Model" value={info?.providers.vision_model ?? '—'} />
              </div>
            </Card>

            {/* Infrastructure */}
            <Card padding="md">
              <p className="text-xs font-semibold text-dark mb-3 flex items-center gap-1.5">
                <Cpu size={13} className="text-muted" /> Infrastructure
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <InfoPill label="Data Backend" value={info?.backends.data ?? '—'} />
                <InfoPill label="Cache Layer" value={info?.backends.cache ?? '—'} />
                <InfoPill label="AWS Region" value={info?.backends.region ?? '—'} />
              </div>
              {info && Object.entries(info.scaling).map(([key, val]) => (
                <div key={key} className="flex gap-2 py-2 border-t border-border">
                  <span className="text-[10px] font-semibold text-muted uppercase min-w-[90px] pt-0.5">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-dark">{val}</span>
                </div>
              ))}
            </Card>

            {/* LLM cost summary */}
            <Card padding="md">
              <p className="text-xs font-semibold text-dark mb-3 flex items-center gap-1.5">
                <Brain size={13} className="text-primary-ink" /> LLM Usage (this session)
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: 'API calls', value: String(cost?.llm.calls ?? 0) },
                  { label: 'Cache hits', value: String(cost?.llm.cache_hits ?? 0) },
                  { label: 'Cost', value: `$${cost?.llm.cost_usd.toFixed(4) ?? '0.0000'}` },
                  { label: 'Saved by cache', value: `$${cost?.llm.cache_savings_usd.toFixed(4) ?? '0.0000'}` },
                  { label: 'Cost / cart', value: `$${cost?.llm.cost_per_cart_usd.toFixed(4) ?? '0.0000'}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-border">
                    <span className="text-[11px] text-muted">{label}</span>
                    <span className="text-xs font-semibold text-dark">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted mt-2">{cost?.llm.pricing_note}</p>
            </Card>

            {/* AWS Cost — compact, honest */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-dark flex items-center gap-1.5">
                  <Cloud size={13} className="text-secondary-dark" /> AWS Billing
                </p>
                {cost?.aws.available && (
                  <span className="text-[10px] text-muted">
                    {cost.aws.period.Start} → {cost.aws.period.End}
                  </span>
                )}
              </div>

              {!cost?.aws.available ? (
                <p className="text-xs text-muted">{cost?.aws.error ?? 'Loading…'}</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-dark">
                      ${cost.aws.total_usd.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted">total spend</span>
                    {cost.aws.total_usd === 0 && (
                      <span className="text-[10px] font-semibold bg-primary-light text-primary-ink px-2 py-0.5 rounded-full ml-1">
                        Free Tier
                      </span>
                    )}
                  </div>
                  {cost.aws.total_usd === 0 && (
                    <p className="text-[11px] text-muted mb-3">
                      All services within AWS Free Tier limits for this period. No charges accrued.
                    </p>
                  )}
                  <div className="space-y-1 mt-2">
                    {cost.aws.by_service.map(({ service, cost_usd }, idx) => (
                      <div key={`${service}-${idx}`} className="flex items-center justify-between py-1.5 border-t border-border first:border-0">
                        <span className="text-xs text-dark truncate flex-1 mr-2">{service}</span>
                        <span className="text-xs font-semibold text-muted shrink-0">
                          {cost_usd === 0 ? 'Free' : `$${cost_usd.toFixed(4)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </>
        )}

        <p className="text-center text-[11px] text-muted pb-2">
          Auto-refreshing every 5s · last updated {lastUpdated || '—'}
        </p>
      </div>
    </div>
  );
}
