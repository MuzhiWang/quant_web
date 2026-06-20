import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, Activity, PieChart } from 'lucide-react';

/**
 * JoinQuant-style single-strategy portfolio view, rendered from the one-call
 * GET /api/strategy/{name}/portfolio response. Pure presentational — all data is
 * precomputed server-side.
 *
 * Note on units: daily_performance returns/risk metrics are decimals (0.05 = 5%),
 * so return/drawdown/volatility are ×100 for display. weight_pct is already a percent.
 */
const fmtCNY = (v) =>
  v == null ? '—' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(v);

const fmtPct = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);
const fmtNum = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));
const fmtInt = (v) => (v == null ? '—' : Number(v).toLocaleString('zh-CN'));

const Kpi = ({ label, value, sub, tone }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`mt-1 text-xl font-semibold ${tone || 'text-gray-900'}`}>{value}</p>
    {sub != null && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
  </div>
);

const toneFor = (v) => (v == null ? 'text-gray-900' : v >= 0 ? 'text-red-600' : 'text-green-600');
// CN convention: red = up/gain, green = down/loss.

export const PortfolioView = ({ data }) => {
  if (!data) return null;
  const { kpis = {}, positions = [], equity_curve = [], recent_trades = [], as_of, holding_count, dry_run_mode } = data;

  const curve = equity_curve.map((p) => ({
    date: p.trade_date,
    value: p.total_value,
    ret: p.cumulative_return == null ? null : p.cumulative_return * 100,
  }));

  return (
    <div className="space-y-6">
      {/* Snapshot header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <PieChart className="h-5 w-5 text-blue-600" /> Portfolio
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>As of {as_of}</span>
          <span className={`px-2 py-0.5 rounded ${dry_run_mode ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            {dry_run_mode ? 'Dry Run' : 'Live'}
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total Value" value={fmtCNY(kpis.total_value)} />
        <Kpi label="Cash" value={fmtCNY(kpis.cash)} />
        <Kpi label="Positions Value" value={fmtCNY(kpis.positions_value)} sub={`${holding_count} position${holding_count === 1 ? '' : 's'}`} />
        <Kpi label="Cumulative Return" value={fmtPct(kpis.cumulative_return)} tone={toneFor(kpis.cumulative_return)} />
        <Kpi label="Daily Return" value={fmtPct(kpis.daily_return)} tone={toneFor(kpis.daily_return)} />
        <Kpi label="Sharpe Ratio" value={fmtNum(kpis.sharpe_ratio)} />
        <Kpi label="Max Drawdown" value={fmtPct(kpis.max_drawdown)} tone="text-green-600" />
        <Kpi label="Volatility (ann.)" value={fmtPct(kpis.volatility)} />
      </div>

      {/* Equity curve */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <TrendingUp className="h-4 w-4" /> Equity Curve
        </h3>
        {curve.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={curve} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={32} />
              <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
              <Tooltip formatter={(v, name) => (name === 'value' ? fmtCNY(v) : `${v?.toFixed?.(2)}%`)} />
              <Line type="monotone" dataKey="value" name="Total Value" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No equity history in range.</p>
        )}
      </div>

      {/* Positions */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <h3 className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
          <Wallet className="h-4 w-4" /> Current Positions
        </h3>
        {positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-right">Quantity</th>
                  <th className="px-4 py-2 text-right">Close Price</th>
                  <th className="px-4 py-2 text-right">Market Value</th>
                  <th className="px-4 py-2 text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.stock_code} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.stock_code}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtInt(p.quantity)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtNum(p.close_price)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtCNY(p.market_value)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtNum(p.weight_pct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No open positions.</p>
        )}
      </div>

      {/* Recent trades */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <h3 className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
          <Activity className="h-4 w-4" /> Recent Trades
        </h3>
        {recent_trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-right">Quantity</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent_trades.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-500">{t.execution_datetime}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{t.code}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${t.action === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {t.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtInt(t.quantity)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtNum(t.price)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtCNY(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No recent trades.</p>
        )}
      </div>
    </div>
  );
};

export default PortfolioView;
