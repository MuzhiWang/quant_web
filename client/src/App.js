import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Activity, PieChart, Clock, AlertCircle, Calendar, RefreshCw, X, CheckCircle, XCircle } from 'lucide-react';

const API_BASE_URL = '/api';

// Toast Notification Component
const Toast = ({ message, type = 'error', onClose }) => {
  const bgColor = type === 'error' ? 'bg-red-50 border-red-200' : type === 'success' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200';
  const textColor = type === 'error' ? 'text-red-800' : type === 'success' ? 'text-green-800' : 'text-blue-800';
  const Icon = type === 'error' ? XCircle : type === 'success' ? CheckCircle : AlertCircle;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto-dismiss after 5 seconds
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className={`flex items-start gap-3 p-4 mb-3 rounded-lg border ${bgColor} ${textColor} shadow-lg animate-slideIn`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button 
        onClick={onClose}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Toast Container Component
const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-w-full">
      {toasts.map(toast => (
        <Toast 
          key={toast.id} 
          message={toast.message} 
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

const QMTTradingDashboard = () => {
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [summary, setSummary] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [dailyPnl, setDailyPnl] = useState([]);
  const [holdingsHistory, setHoldingsHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [criticalError, setCriticalError] = useState(null); // Only for critical failures
  const [activeTab, setActiveTab] = useState('overview');
  const [toasts, setToasts] = useState([]);
  
  // Date range state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Toast management functions
  const addToast = useCallback((message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const fetchStrategies = async () => {
    try {
      setCriticalError(null);
      const response = await fetch(`${API_BASE_URL}/strategies?dry_run=true`);
      if (!response.ok) throw new Error('Failed to fetch strategies');
      const data = await response.json();
      if (data.strategies && data.strategies.length > 0) {
        setStrategies(data.strategies);
        setSelectedStrategy(data.strategies[1]);
      } else {
        setCriticalError('No strategies found. Please ensure your Python backend is running and has data.');
      }
    } catch (error) {
      console.error('Error fetching strategies:', error);
      setCriticalError(`Cannot connect to backend API. Please ensure Python FastAPI server is running on port 8000. Error: ${error.message}`);
      setLoading(false);
    }
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    
    try {
      // Build query parameters with date range
      const dateParams = new URLSearchParams();
      dateParams.append('dry_run', 'true');
      if (startDate) dateParams.append('start_date', startDate);
      if (endDate) dateParams.append('end_date', endDate);
      
      const dateParamsStr = dateParams.toString();
      const summaryParams = new URLSearchParams({ dry_run: 'true' });
      if (endDate) summaryParams.append('trade_date', endDate);
      
      // Build transactions query parameters with date range
      const transactionsParams = new URLSearchParams({ limit: '200', dry_run: 'true' });
      if (startDate) transactionsParams.append('start_date', startDate);
      if (endDate) transactionsParams.append('end_date', endDate);
      
      // Fetch all data with individual error handling
      const results = await Promise.allSettled([
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/summary?${summaryParams.toString()}`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/performance?${dateParamsStr}&use_metrics=true`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/transactions?${transactionsParams.toString()}`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/daily-pnl?${dateParamsStr}`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/holdings?${dateParamsStr}`)
      ]);

      // Process summary
      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        const summaryData = await results[0].value.json();
        setSummary(summaryData);
      } else {
        console.error('Failed to fetch summary:', results[0]);
        addToast('Failed to load portfolio summary. Please try again.', 'error');
      }

      // Process performance
      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        const performanceData = await results[1].value.json();
        setPerformance(performanceData);
      } else {
        console.error('Failed to fetch performance:', results[1]);
        addToast('Failed to load performance metrics. Please try again.', 'error');
      }

      // Process transactions
      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        const transactionsData = await results[2].value.json();
        setTransactions(transactionsData);
      } else {
        console.error('Failed to fetch transactions:', results[2]);
        addToast('Failed to load transactions. Please try again.', 'error');
      }

      // Process daily PnL
      if (results[3].status === 'fulfilled' && results[3].value.ok) {
        const pnlData = await results[3].value.json();
        if (pnlData.daily_values) {
          setDailyPnl(pnlData.daily_values.map(d => ({
            date: d.trade_date,
            value: d.total_value,
            cash: d.cash_balance,
            holdings: d.holdings_value
          })));
        }
      } else {
        console.error('Failed to fetch daily PnL:', results[3]);
        addToast('Failed to load daily PnL data. Please try again.', 'error');
      }

      // Process holdings history
      if (results[4].status === 'fulfilled' && results[4].value.ok) {
        const holdingsData = await results[4].value.json();
        if (holdingsData.holdings_by_date) {
          setHoldingsHistory(holdingsData.holdings_by_date);
        }
      } else {
        console.error('Failed to fetch holdings history:', results[4]);
        addToast('Failed to load holdings history. Please try again.', 'error');
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast(`Unexpected error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStrategy, startDate, endDate, addToast]);

  useEffect(() => {
    fetchStrategies();
  }, []);

  useEffect(() => {
    if (selectedStrategy) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStrategy]); // Only fetch when strategy changes, not when dates change

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

  if (criticalError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{criticalError}</p>
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
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
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
            
            {/* Date Range Picker */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Start Date"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="End Date"
                />
              </div>
              
              <button
                onClick={fetchAllData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{summary?.date}</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Dry Run</span>
              </div>
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
        {activeTab === 'holdings' && (
          Object.keys(holdingsHistory).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(holdingsHistory)
                .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Sort by date descending
                .map(([date, holdings]) => {
                  const totalValue = holdings.reduce((sum, h) => sum + h.market_value, 0);
                  return (
                    <div key={date} className="bg-white rounded-lg border border-gray-200">
                      <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{date}</h3>
                          <div className="text-sm text-gray-500">
                            <span className="font-medium text-gray-900">{holdings.length}</span> position{holdings.length !== 1 ? 's' : ''} · 
                            <span className="ml-2 font-medium text-gray-900">{formatCurrency(totalValue)}</span> total
                          </div>
                        </div>
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
                            {holdings.map((holding, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{holding.stock_code}</td>
                                <td className="px-6 py-4 text-sm text-right text-gray-900">{holding.quantity.toFixed(0)}</td>
                                <td className="px-6 py-4 text-sm text-right text-gray-900">{holding.price.toFixed(2)}</td>
                                <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(holding.market_value)}</td>
                                <td className="px-6 py-4 text-sm text-right text-gray-900">
                                  {((holding.market_value / totalValue) * 100).toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <PieChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Holdings Data</h3>
              <p className="text-gray-500">
                {(startDate || endDate) 
                  ? 'No holdings found in the selected date range. Try adjusting your filters.'
                  : 'No holdings data available for this strategy yet.'
                }
              </p>
            </div>
          )
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          transactions.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Transactions</h3>
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">{transactions.length}</span> transaction{transactions.length !== 1 ? 's' : ''}
                  {(startDate || endDate) && (
                    <span className="ml-2">
                      ({startDate || '...'} to {endDate || 'latest'})
                    </span>
                  )}
                </div>
              </div>
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
                          tx.action.toLowerCase() === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Transactions Found</h3>
              <p className="text-gray-500">
                {(startDate || endDate) 
                  ? 'No transactions found in the selected date range. Try adjusting your filters.'
                  : 'No transactions recorded for this strategy yet.'
                }
              </p>
            </div>
          )
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