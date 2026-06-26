import { useEffect, useState } from 'react';
import { Shield, Activity, Server, Zap, Database, Brain, RefreshCw, ExternalLink, DollarSign, TrendingUp, Cloud } from 'lucide-react';
import type { AppContext } from '../App';
import { Card, Chip, FadeIn } from '../ui';

interface Props {
  ctx: AppContext;
}

interface Stats {
  total_requests: number;
  total_errors: number;
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
  avg_llm_latency_ms: number;
  top_paths: Record<string, number>;
  status_codes: Record<string, number>;
  requests_per_status: { '2xx': number; '4xx': number; '5xx': number };
  throughput_summary: { total_requests: number; carts_built: number; avg_response_ms: number; p95_response_ms: number };
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
    source: string;
  };
  aws: {
    available: boolean;
    error: string | null;
    period: { Start?: string; End?: string };
    total_usd: number;
    by_service: { service: string; cost_usd: number }[];
    source: string;
  };
}

interface Info {
  service: string;
  version: string;
  environment: string;
  providers: { text_llm: string; text_model: string; vision_llm: string; vision_model: string };
  backends: { data: string; cache: string; region: string };
  features: Record<string, boolean | string[]>;
  scaling: Record<string, string>;
}

function MetricCard({ icon, title, value, subtitle, color }: { icon: React.ReactNode; title: string; value: string; subtitle: string; color: string }) {
  return (
    <Card padding="md" className="hover:shadow-[var(--shadow-pop)] transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          <p className="text-xs text-muted mt-1">{subtitle}</p>
        </div>
        <div className="w-10 h-10 bg-light-bg rounded-xl flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-muted w-8">{label}</span>
      <div className="flex-1 h-2 bg-light-bg rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-dark w-16 text-right">{value.toFixed(0)}ms</span>
    </div>
  );
}

export default function AdminDashboardPage({ ctx: _ctx }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [cost, setCost] = useState<CostData | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchData = async () => {
    try {
      const [statsRes, infoRes, costRes] = await Promise.all([
        fetch('/api/meta/stats'),
        fetch('/api/meta/info'),
        fetch('/api/meta/cost'),
      ]);
      const statsData = await statsRes.json();
      const infoData = await infoRes.json();
      const costData = await costRes.json();
      setStats(statsData);
      setInfo(infoData);
      setCost(costData);
      setRefreshCount((c) => c + 1);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const maxLatency = Math.max(stats?.p95_latency_ms ?? 100, stats?.avg_latency_ms ?? 50, 100);
  const topPaths = stats ? Object.entries(stats.top_paths).sort(([, a], [, b]) => b - a).slice(0, 8) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Shield size={24} className="text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-dark">Admin Dashboard</h1>
              <p className="text-sm text-muted">Real-time observability & system metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Chip tone="success" size="sm" icon={<Activity size={12} />}>
              {stats?.health.status === 'healthy' ? '● Healthy' : '● Degraded'}
            </Chip>
            <div className="flex items-center gap-2 text-xs text-muted bg-light-bg px-3 py-2 rounded-lg">
              <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
              Live
            </div>
            <a
              href="/api/meta/dashboard"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-800 bg-purple-50 px-3 py-2 rounded-lg transition"
            >
              <ExternalLink size={12} /> Full Dashboard
            </a>
          </div>
        </div>
      </FadeIn>

      {/* KPI Cards */}
      <FadeIn delay={60}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            icon={<Activity size={20} className="text-primary-ink" />}
            title="Total Requests"
            value={stats?.total_requests.toLocaleString() ?? '0'}
            subtitle="Across all endpoints"
            color="text-primary-ink"
          />
          <MetricCard
            icon={<Brain size={20} className="text-blue-600" />}
            title="Carts Built"
            value={stats?.carts_built.toLocaleString() ?? '0'}
            subtitle="AI-assembled carts"
            color="text-blue-600"
          />
          <MetricCard
            icon={<Zap size={20} className="text-secondary-dark" />}
            title="Avg Latency"
            value={`${stats?.avg_latency_ms.toFixed(0) ?? '0'}ms`}
            subtitle={`P95: ${stats?.p95_latency_ms.toFixed(0) ?? '0'}ms`}
            color="text-secondary-dark"
          />
          <MetricCard
            icon={<Shield size={20} className="text-accent" />}
            title="Error Rate"
            value={stats?.error_rate_pct ?? '0%'}
            subtitle={`Budget: ${stats?.health.error_budget_remaining ?? '100%'}`}
            color={stats && stats.error_rate > 0.05 ? 'text-accent' : 'text-primary-ink'}
          />
        </div>
      </FadeIn>

      {/* Performance Row */}
      <FadeIn delay={120}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Latency Percentiles */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-dark mb-4 flex items-center gap-2">
              <Zap size={14} className="text-secondary" /> Latency Percentiles
            </h3>
            <div className="space-y-3">
              <ProgressBar label="P50" value={stats?.p50_latency_ms ?? 0} max={maxLatency} color="bg-primary" />
              <ProgressBar label="Avg" value={stats?.avg_latency_ms ?? 0} max={maxLatency} color="bg-blue-500" />
              <ProgressBar label="P95" value={stats?.p95_latency_ms ?? 0} max={maxLatency} color="bg-secondary" />
            </div>
            <p className="text-[11px] text-muted mt-3 italic">P95 &lt; 3000ms = healthy for LLM workloads</p>
          </Card>

          {/* Cache Performance */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-dark mb-4 flex items-center gap-2">
              <Database size={14} className="text-primary-ink" /> LLM Cache Performance
            </h3>
            <div className="flex items-center gap-4">
              {/* Gauge */}
              <div className="relative w-20 h-20">
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
                  <span className="text-sm font-bold text-primary-ink">{stats?.cache_hit_ratio_pct ?? '0%'}</span>
                </div>
              </div>
              <div className="text-xs space-y-1">
                <p><span className="font-semibold text-dark">{stats?.cache_hits ?? 0}</span> <span className="text-muted">hits</span></p>
                <p><span className="font-semibold text-dark">{stats?.cache_misses ?? 0}</span> <span className="text-muted">misses</span></p>
                <p><span className="font-semibold text-dark">{stats?.llm_calls ?? 0}</span> <span className="text-muted">LLM calls</span></p>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-3 italic">Same recipe → cached result (no LLM cost)</p>
          </Card>

          {/* Status Distribution */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-dark mb-4 flex items-center gap-2">
              <Server size={14} className="text-blue-600" /> Status Distribution
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-primary-ink w-8">2xx</span>
                <div className="flex-1 h-2 bg-light-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${stats ? Math.max((stats.requests_per_status['2xx'] / Math.max(stats.total_requests, 1)) * 100, 0) : 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right">{stats?.requests_per_status['2xx'] ?? 0}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-secondary-dark w-8">4xx</span>
                <div className="flex-1 h-2 bg-light-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
                    style={{ width: `${stats ? Math.max((stats.requests_per_status['4xx'] / Math.max(stats.total_requests, 1)) * 100, 0) : 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right">{stats?.requests_per_status['4xx'] ?? 0}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-accent w-8">5xx</span>
                <div className="flex-1 h-2 bg-light-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${stats ? Math.max((stats.requests_per_status['5xx'] / Math.max(stats.total_requests, 1)) * 100, 0) : 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right">{stats?.requests_per_status['5xx'] ?? 0}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-3 italic">Zero 5xx = production-grade error handling</p>
          </Card>
        </div>
      </FadeIn>

      {/* Top Endpoints + System Info */}
      <FadeIn delay={180}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Top Endpoints */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-light-bg">
              <h3 className="text-sm font-semibold text-dark flex items-center gap-2">
                🔥 Top Endpoints by Traffic
              </h3>
            </div>
            {topPaths.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted text-center">No traffic yet — start using the app!</p>
            ) : (
              <div className="divide-y divide-border">
                {topPaths.map(([path, count]) => (
                  <div key={path} className="flex items-center justify-between px-5 py-2.5 hover:bg-light-bg transition">
                    <code className="text-xs text-primary-ink font-mono">{path}</code>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold bg-light-bg px-2.5 py-0.5 rounded-md border border-border">{count}</span>
                      <span className="text-[11px] text-muted w-12 text-right">
                        {stats ? ((count / stats.total_requests) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* System Info */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-dark mb-4 flex items-center gap-2">
              🏗️ System Architecture
            </h3>
            {info && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-light-bg rounded-lg p-2.5">
                    <p className="text-[10px] text-muted uppercase">Text LLM</p>
                    <p className="text-xs font-semibold">{info.providers.text_llm}</p>
                  </div>
                  <div className="bg-light-bg rounded-lg p-2.5">
                    <p className="text-[10px] text-muted uppercase">Model</p>
                    <p className="text-xs font-semibold">{info.providers.text_model}</p>
                  </div>
                  <div className="bg-light-bg rounded-lg p-2.5">
                    <p className="text-[10px] text-muted uppercase">Vision</p>
                    <p className="text-xs font-semibold">{info.providers.vision_llm}</p>
                  </div>
                  <div className="bg-light-bg rounded-lg p-2.5">
                    <p className="text-[10px] text-muted uppercase">Data</p>
                    <p className="text-xs font-semibold">{info.backends.data}</p>
                  </div>
                  <div className="bg-light-bg rounded-lg p-2.5">
                    <p className="text-[10px] text-muted uppercase">Cache</p>
                    <p className="text-xs font-semibold">{info.backends.cache}</p>
                  </div>
                  <div className="bg-light-bg rounded-lg p-2.5">
                    <p className="text-[10px] text-muted uppercase">Region</p>
                    <p className="text-xs font-semibold">{info.backends.region}</p>
                  </div>
                </div>

                {/* Scaling info */}
                <div className="border-t border-border pt-3 space-y-1.5">
                  {Object.entries(info.scaling).map(([key, val]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-[10px] text-muted uppercase min-w-[70px]">{key.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-dark">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="border-t border-border pt-3">
                  <p className="text-[10px] text-muted uppercase mb-2">Active Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(info.features)
                      .filter(([, v]) => v === true)
                      .map(([k]) => (
                        <span key={k} className="text-[10px] font-semibold bg-primary-light text-primary-ink px-2 py-0.5 rounded-full">
                          ✓ {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </FadeIn>

      {/* Cost Monitoring */}
      <FadeIn delay={240}>
        <div className="mb-6">
          <h2 className="text-lg font-heading font-bold text-dark mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-green-600" /> Cost Monitoring
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card padding="md" className="hover:shadow-[var(--shadow-pop)] transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">LLM Cost (session)</p>
                  <p className="text-3xl font-bold mt-1 text-green-600">
                    ${cost?.llm.cost_usd.toFixed(4) ?? '0.0000'}
                  </p>
                  <p className="text-xs text-muted mt-1">{cost?.llm.calls ?? 0} calls · live telemetry</p>
                </div>
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <Brain size={20} className="text-green-600" />
                </div>
              </div>
            </Card>

            <Card padding="md" className="hover:shadow-[var(--shadow-pop)] transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">Cache Savings</p>
                  <p className="text-3xl font-bold mt-1 text-blue-600">
                    ${cost?.llm.cache_savings_usd.toFixed(4) ?? '0.0000'}
                  </p>
                  <p className="text-xs text-muted mt-1">{cost?.llm.cache_hits ?? 0} hits avoided</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Database size={20} className="text-blue-600" />
                </div>
              </div>
            </Card>

            <Card padding="md" className="hover:shadow-[var(--shadow-pop)] transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">AWS Total (30d)</p>
                  <p className="text-3xl font-bold mt-1 text-orange-500">
                    {cost?.aws.available ? `$${cost.aws.total_usd.toFixed(4)}` : '—'}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {cost?.aws.available
                      ? `${cost.aws.period.Start} → ${cost.aws.period.End}`
                      : 'Awaiting CE data'}
                  </p>
                </div>
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                  <Cloud size={20} className="text-orange-500" />
                </div>
              </div>
            </Card>

            <Card padding="md" className="hover:shadow-[var(--shadow-pop)] transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">Cost / Cart</p>
                  <p className="text-3xl font-bold mt-1 text-purple-600">
                    ${cost?.llm.cost_per_cart_usd.toFixed(4) ?? '0.0000'}
                  </p>
                  <p className="text-xs text-muted mt-1">LLM cost per assembled cart</p>
                </div>
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                  <TrendingUp size={20} className="text-purple-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* AWS Cost Explorer breakdown */}
          <Card padding="none" className="overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-border bg-light-bg flex items-center justify-between">
              <h3 className="text-sm font-semibold text-dark flex items-center gap-2">
                ☁️ AWS Cost by Service (last 30 days)
              </h3>
              <span className="text-xs text-muted">
                {cost?.aws.available ? 'Source: AWS Cost Explorer · real data' : 'Source: AWS Cost Explorer'}
              </span>
            </div>
            {!cost?.aws.available ? (
              <div className="px-5 py-6 text-sm text-muted text-center">
                {cost?.aws.error ?? 'Loading…'}
              </div>
            ) : cost.aws.by_service.filter(s => s.cost_usd > 0).length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted text-center">No costs recorded in this period.</div>
            ) : (
              <div className="divide-y divide-border">
                <div className="grid grid-cols-3 px-5 py-2 bg-light-bg text-xs font-semibold text-muted uppercase">
                  <span>Service</span><span>Cost (USD)</span><span>% of Total</span>
                </div>
                {cost.aws.by_service.filter(s => s.cost_usd > 0).map(({ service, cost_usd }) => (
                  <div key={service} className="grid grid-cols-3 px-5 py-3 text-sm hover:bg-light-bg transition">
                    <span className="font-medium text-dark">{service}</span>
                    <span className="font-semibold text-primary-ink">${cost_usd.toFixed(4)}</span>
                    <span className="text-muted">
                      {cost.aws.total_usd > 0 ? ((cost_usd / cost.aws.total_usd) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-3 px-5 py-3 bg-light-bg text-sm font-semibold">
                  <span className="text-dark">Total</span>
                  <span className="text-primary-ink">${cost.aws.total_usd.toFixed(4)}</span>
                  <span className="text-muted">100%</span>
                </div>
              </div>
            )}
          </Card>

          {/* LLM pricing note */}
          <p className="text-xs text-muted px-1">
            💡 LLM costs: {cost?.llm.pricing_note ?? 'Groq Llama 3.3 70B pricing'}. Session counters reset on server restart.
          </p>
        </div>
      </FadeIn>

      {/* Footer */}
      <div className="text-center text-xs text-muted pt-4 border-t border-border">
        Last updated: {lastUpdated || '—'} · Auto-refreshing every 3 seconds
      </div>
    </div>
  );
}
