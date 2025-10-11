import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity, PieChart, Clock, AlertCircle } from 'lucide-react';

const API_BASE_URL = '/api';

const QMTTradingDashboard = () => {
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [summary, setSummary] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [dailyPnl, setDailyPnl] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchStrategies();
  }, []);

  useEffect(() => {
    if (selectedStrategy) {
      fetchAllData();
    }
  }, [selectedStrategy]);

  const fetchStrategies = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/strategies?dry_run=true`);
      if (!response.ok) throw new Error('Failed to fetch strategies');
      const data = await response.json();
      if (data.strategies && data.strategies.length > 0) {
        setStrategies(data.strategies);
        setSelectedStrategy(data.strategies[1]);
      } else {
        setError('No strategies found. Please ensure your Python backend is running and has data.');
      }
    } catch (error) {
      console.error('Error fetching strategies:', error);
      setError(`Cannot connect to backend API. Please ensure Python FastAPI server is running on port 8000. Error: ${error.message}`);
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, performanceRes, transactionsRes, pnlRes] = await Promise.all([
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/summary?dry_run=true`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/performance?dry_run=true&use_metrics=true`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/transactions?limit=200&dry_run=true`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/daily-pnl?dry_run=true`)
      ]);

      if (!summaryRes.ok) throw new Error('Failed to fetch summary');
      if (!performanceRes.ok) throw new Error('Failed to fetch performance');
      if (!transactionsRes.ok) throw new Error('Failed to fetch transactions');
      if (!pnlRes.ok) throw new Error('Failed to fetch daily PnL');

      const summaryData = await summaryRes.json();
      const performanceData = await performanceRes.json();
      const transactionsData = await transactionsRes.json();
      const pnlData = await pnlRes.json();

      setSummary(summaryData);
      setPerformance(performanceData);
      setTransactions(transactionsData);
      
      if (pnlData.daily_values) {
        setDailyPnl(pnlData.daily_values.map(d => ({
          date: d.trade_date,
          value: d.total_value,
          cash: d.cash_balance,
          holdings: d.holdings_value
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Error loading data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">QMT Trading System</h1>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {strategies.map(strategy => (
                  <option key={strategy} value={strategy}>{strategy}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{summary?.date}</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Dry Run</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-8">
            {['overview', 'performance', 'holdings', 'transactions'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && summary && (
          <>
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Total Value"
                value={formatCurrency(summary.total_value)}
                icon={<DollarSign className="w-6 h-6" />}
                color="blue"
              />
              <MetricCard
                title="Cash Balance"
                value={formatCurrency(summary.cash_balance)}
                icon={<Activity className="w-6 h-6" />}
                color="green"
              />
              <MetricCard
                title="Holdings Value"
                value={formatCurrency(summary.total_market_value)}
                icon={<PieChart className="w-6 h-6" />}
                color="purple"
              />
              <MetricCard
                title="Positions"
                value={summary.holding_count}
                icon={<TrendingUp className="w-6 h-6" />}
                color="orange"
              />
            </div>

            {/* Performance Metrics */}
            {performance && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Total Return</p>
                  <p className={`text-2xl font-bold ${performance.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(performance.total_return)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Total PNL</p>
                  <p className={`text-2xl font-bold ${performance.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(performance.total_pnl)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Sharpe Ratio</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {performance.final_sharpe_ratio?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-600">
                    {performance.max_drawdown ? (performance.max_drawdown * 100).toFixed(2) + '%' : 'N/A'}
                  </p>
                </div>
              </div>
            )}

            {/* Portfolio Value Chart */}
            {dailyPnl.length > 0 && (
              <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
                <h3 className="text-lg font-semibold mb-4">Portfolio Value Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyPnl}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Total Value" />
                    <Line type="monotone" dataKey="cash" stroke="#10b981" strokeWidth={2} name="Cash" />
                    <Line type="monotone" dataKey="holdings" stroke="#8b5cf6" strokeWidth={2} name="Holdings" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Holdings Tab */}
        {activeTab === 'holdings' && summary && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Current Holdings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Code</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Market Value</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {summary.holdings.map((holding, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{holding.stock_code}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{holding.quantity.toFixed(0)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{holding.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(holding.market_value)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {((holding.market_value / summary.total_market_value) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && transactions.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Recent Transactions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{tx.execution_datetime}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{tx.code}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          tx.action === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{tx.quantity.toFixed(0)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{tx.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(tx.amount)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-500">
                        {tx.commission ? formatCurrency(tx.commission) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && performance && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Total Trades</p>
                <p className="text-3xl font-bold text-gray-900">{performance.total_trades}</p>
                <div className="mt-2 text-sm text-gray-500">
                  Buy: {performance.buy_trades} | Sell: {performance.sell_trades}
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Avg Daily Return</p>
                <p className="text-3xl font-bold text-gray-900">
                  {performance.avg_daily_return?.toFixed(3)}%
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Volatility</p>
                <p className="text-3xl font-bold text-gray-900">
                  {performance.final_volatility?.toFixed(3) || 'N/A'}
                </p>
              </div>
            </div>

            {performance.daily_performances && performance.daily_performances.length > 0 && (
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Daily Returns</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performance.daily_performances.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="trade_date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => value?.toFixed(2) + '%'}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="daily_return" fill="#3b82f6" name="Daily Return (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{title}</p>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
};

export default QMTTradingDashboard;