import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Activity, PieChart, Clock, AlertCircle, Calendar, RefreshCw } from 'lucide-react';
import { ToastContainer } from './components/Toast';
import { MetricCard } from './components/MetricCard';
import { MetricsGrid } from './components/MetricsGrid';

const API_BASE_URL = '/api';

const QMTTradingDashboard = () => {
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [summary, setSummary] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [dailyPnl, setDailyPnl] = useState([]);
  const [holdingsHistory, setHoldingsHistory] = useState({});
  const [loading, setLoading] = useState(false); // Changed from true to false
  const [criticalError, setCriticalError] = useState(null); // Only for critical failures
  const [activeTab, setActiveTab] = useState('overview');
  const [toasts, setToasts] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data has been loaded
  const [valueDisplayMode, setValueDisplayMode] = useState('percentage'); // 'absolute' or 'percentage'
  
  // Benchmark state
  const [benchmarks, setBenchmarks] = useState([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState('');
  const [benchmarkData, setBenchmarkData] = useState(null);
  
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

  const fetchBenchmarks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/benchmarks`);
      if (!response.ok) throw new Error('Failed to fetch benchmarks');
      const data = await response.json();
      if (data.benchmarks && data.benchmarks.length > 0) {
        setBenchmarks(data.benchmarks);
        // Set default to first benchmark (沪深300)
        setSelectedBenchmark(data.benchmarks[0].code);
      }
    } catch (error) {
      console.error('Error fetching benchmarks:', error);
      addToast('Failed to load benchmark list. Using default.', 'error');
      // Set default fallback
      setBenchmarks([{ name: '沪深300', code: '000300.SH' }]);
      setSelectedBenchmark('000300.SH');
    }
  };

  const fetchAllData = useCallback(async () => {
    if (!selectedStrategy) {
      addToast('Please select a strategy first', 'error');
      return;
    }
    
    if (!selectedBenchmark) {
      addToast('Loading benchmark data...', 'info');
      return;
    }
    
    setLoading(true);
    setDataLoaded(true);
    
    try {
      // Calculate default date range (100 days) if not specified
      const today = new Date();
      const defaultEndDate = today.toISOString().split('T')[0];
      const default100DaysAgo = new Date(today.getTime() - 100 * 24 * 60 * 60 * 1000);
      const defaultStartDate = default100DaysAgo.toISOString().split('T')[0];
      
      const effectiveStartDate = startDate || defaultStartDate;
      const effectiveEndDate = endDate || defaultEndDate;
      
      // Build query parameters with date range
      const dateParams = new URLSearchParams();
      dateParams.append('dry_run', 'true');
      dateParams.append('start_date', effectiveStartDate);
      dateParams.append('end_date', effectiveEndDate);
      
      const dateParamsStr = dateParams.toString();
      const summaryParams = new URLSearchParams({ dry_run: 'true' });
      // Don't pass trade_date - let API use latest available
      // if (effectiveEndDate) summaryParams.append('trade_date', effectiveEndDate);
      
      // Build transactions query parameters with date range
      const transactionsParams = new URLSearchParams({ limit: '1000', dry_run: 'true' });
      transactionsParams.append('start_date', effectiveStartDate);
      transactionsParams.append('end_date', effectiveEndDate);
      
      // Fetch all data with individual error handling (including benchmark)
      const benchmarkRangeParams = new URLSearchParams({
        start_date: effectiveStartDate,
        end_date: effectiveEndDate
      });
      
      const results = await Promise.allSettled([
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/summary?${summaryParams.toString()}`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/performance?${dateParamsStr}&use_metrics=true`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/transactions?${transactionsParams.toString()}`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/daily-pnl?${dateParamsStr}`),
        fetch(`${API_BASE_URL}/strategy/${selectedStrategy}/holdings?${dateParamsStr}`),
        fetch(`${API_BASE_URL}/benchmark/${selectedBenchmark}/range?${benchmarkRangeParams.toString()}`)
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
        console.log('Performance data:', performanceData);
        
        // Debug total_trades issue
        console.log('Total trades from API:', performanceData.total_trades);
        
        // Check if we need to calculate trades from transactions
        if (!performanceData.total_trades && performanceData.total_trades !== 0) {
          console.warn('Missing total_trades in API response - will calculate from transactions');
        }
        
        if (performanceData.daily_performances && performanceData.daily_performances.length > 0) {
          // Check for daily_cash_change data
          const hasCashFlowData = performanceData.daily_performances.some(day => 
            day.daily_cash_change !== undefined && day.daily_cash_change !== null
          );
          console.log('Has cash flow data:', hasCashFlowData);
          if (!hasCashFlowData) {
            console.warn('No daily_cash_change data found in API response');
          }
          console.log('Sample day data:', performanceData.daily_performances[0]);
        }
        setPerformance(performanceData);
      } else {
        console.error('Failed to fetch performance:', results[1]);
        addToast('Failed to load performance metrics. Please try again.', 'error');
      }

      // Process transactions and update trade counts if needed
      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        const transactionsData = await results[2].value.json();
        setTransactions(transactionsData);
        
        // Fix for total_trades showing as 0
        // Check if we have transactions but performance data shows 0 trades
        const performanceState = performance; // Get current performance state
        if (performanceState && 
            (!performanceState.total_trades || performanceState.total_trades === 0) && 
            transactionsData && transactionsData.length > 0) {
          
          console.log('Calculating trade counts from transactions data');
          
          // Count the transactions
          const totalTrades = transactionsData.length;
          const buyTrades = transactionsData.filter(tx => tx.action.toLowerCase() === 'buy').length;
          const sellTrades = transactionsData.filter(tx => tx.action.toLowerCase() === 'sell').length;
          
          // Create a new performance object with the trade counts
          const updatedPerformanceData = {
            ...performanceState,
            total_trades: totalTrades,
            buy_trades: buyTrades,
            sell_trades: sellTrades
          };
          
          console.log('Updated trade counts:', { 
            total: totalTrades, 
            buy: buyTrades, 
            sell: sellTrades 
          });
          
          // Update the state with corrected data
          setPerformance(updatedPerformanceData);
        }
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

      // Process benchmark data
      if (results[5].status === 'fulfilled' && results[5].value.ok) {
        const benchData = await results[5].value.json();
        console.log('Benchmark data loaded:', benchData);
        setBenchmarkData(benchData);
      } else {
        console.error('Failed to fetch benchmark data:', results[5]);
        addToast('Failed to load benchmark data. Chart will show strategy only.', 'error');
        setBenchmarkData(null);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast(`Unexpected error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStrategy, selectedBenchmark, startDate, endDate, addToast, performance]);

  useEffect(() => {
    fetchStrategies();
    fetchBenchmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove auto-fetch - user must click Refresh button
  // useEffect(() => {
  //   if (selectedStrategy) {
  //     fetchAllData();
  //   }
  // }, [selectedStrategy]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trading data...</p>
        </div>
      </div>
    );
  }
  
  // Show welcome message if no data loaded yet
  if (!dataLoaded && !summary) {
    return (
      <div className="min-h-screen bg-gray-50">
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
                  <option value="">Select a strategy...</option>
                  {strategies.map(strategy => (
                    <option key={strategy} value={strategy}>{strategy}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Benchmark Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">基准:</span>
                  <select
                    value={selectedBenchmark}
                    onChange={(e) => setSelectedBenchmark(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!benchmarks.length}
                  >
                    {benchmarks.map(benchmark => (
                      <option key={benchmark.code} value={benchmark.code}>
                        {benchmark.name}
                      </option>
                    ))}
                  </select>
                </div>
                
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
                  disabled={!selectedStrategy}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Load Data</span>
                </button>
                
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">Dry Run</span>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 100px)' }}>
          <div className="text-center max-w-md p-8">
            <Activity className="w-24 h-24 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to QMT Trading Dashboard</h2>
            <p className="text-gray-600 mb-6">
              Select a strategy and click "Load Data" to view your trading performance.
            </p>
            <p className="text-sm text-gray-500">
              {!selectedStrategy && "👆 Start by selecting a strategy from the dropdown above"}
              {selectedStrategy && `Selected: ${selectedStrategy}. Click "Load Data" to continue.`}
            </p>
            {!startDate && !endDate && (
              <p className="text-sm text-gray-500 mt-2">
                💡 Leave dates empty to load the last 100 days by default
              </p>
            )}
          </div>
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
            
            {/* Date Range Picker & Controls */}
            <div className="flex items-center gap-3">
              {/* Benchmark Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">基准:</span>
                <select
                  value={selectedBenchmark}
                  onChange={(e) => setSelectedBenchmark(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!benchmarks.length}
                >
                  {benchmarks.map(benchmark => (
                    <option key={benchmark.code} value={benchmark.code}>
                      {benchmark.name}
                    </option>
                  ))}
                </select>
              </div>
              
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
            {['overview', 'holdings', 'transactions'].map(tab => (
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
            {/* Compact Metrics Grid (Like JoinQuant) */}
            {performance && <MetricsGrid performance={performance} benchmarkData={benchmarkData} transactions={transactions} />}
            
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
              <>
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

                {/* Additional Trading Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-gray-900">{performance.total_trades}</p>
                    <div className="mt-2 text-sm text-gray-500">
                      Buy: {performance.buy_trades} | Sell: {performance.sell_trades}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Avg Daily Return</p>
                    <p className={`text-2xl font-bold ${performance.avg_daily_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {performance.avg_daily_return !== null && performance.avg_daily_return !== undefined 
                        ? `${(performance.avg_daily_return * 100).toFixed(3)}%`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Volatility</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {performance.final_volatility?.toFixed(3) || 'N/A'}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Performance Charts Section */}
            <div className="space-y-8">
              {/* Portfolio Value Chart with Benchmark */}
              {dailyPnl.length > 0 && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">收益曲线 (Portfolio Value Trend)</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setValueDisplayMode('absolute')}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          valueDisplayMode === 'absolute'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Absolute Value
                      </button>
                      <button
                        onClick={() => setValueDisplayMode('percentage')}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          valueDisplayMode === 'percentage'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Percentage Change
                      </button>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={dailyPnl.map((d, idx) => {
                      let strategyValue = d.value;
                      let benchmarkValue = 0;
                      
                      // Create a date-aligned benchmark data map
                      const benchmarkMap = {};
                      if (benchmarkData && benchmarkData.data) {
                        benchmarkData.data.forEach(b => {
                          benchmarkMap[b.trade_date] = parseFloat(b.daily_return || 0);
                        });
                      }
                      
                      if (valueDisplayMode === 'percentage') {
                        if (idx === 0) {
                          strategyValue = 0;
                          benchmarkValue = 0;
                        } else {
                          const initialValue = dailyPnl[0].value;
                          strategyValue = ((d.value - initialValue) / initialValue) * 100;
                          
                          // Calculate benchmark percentage with date alignment and forward filling
                          if (benchmarkData && benchmarkData.data) {
                            let benchCumulativeReturn = 0;
                            let lastKnownReturn = 0;
                            
                            for (let i = 0; i <= idx; i++) {
                              const date = dailyPnl[i].date;
                              if (benchmarkMap[date] !== undefined) {
                                lastKnownReturn = benchmarkMap[date];
                                benchCumulativeReturn += lastKnownReturn;
                              } else {
                                // Forward fill - use last known return (0 if first day)
                                benchCumulativeReturn += lastKnownReturn;
                              }
                            }
                            benchmarkValue = benchCumulativeReturn * 100;
                          }
                        }
                      } else {
                        // For absolute value, show benchmark as cumulative return percentage overlay
                        if (benchmarkData && benchmarkData.data) {
                          let benchCumulativeReturn = 0;
                          let lastKnownReturn = 0;
                          
                          for (let i = 0; i <= idx; i++) {
                            const date = dailyPnl[i].date;
                            if (benchmarkMap[date] !== undefined) {
                              lastKnownReturn = benchmarkMap[date];
                              benchCumulativeReturn += lastKnownReturn;
                            } else {
                              // Forward fill
                              benchCumulativeReturn += lastKnownReturn;
                            }
                          }
                          benchmarkValue = benchCumulativeReturn * 100;
                        }
                      }
                      
                      return { 
                        ...d, 
                        strategyValue, 
                        benchmarkValue,
                        hasBenchmark: !!benchmarkData 
                      };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name.includes('Benchmark')) {
                            return `${value.toFixed(2)}%`;
                          }
                          return valueDisplayMode === 'percentage' 
                            ? `${value.toFixed(2)}%` 
                            : formatCurrency(value);
                        }}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="strategyValue" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        name={valueDisplayMode === 'percentage' ? '策略收益 Strategy Return (%)' : '策略价值 Total Value (¥)'} 
                        dot={false}
                      />
                      {benchmarkData && (
                        <Line 
                          type="monotone" 
                          dataKey="benchmarkValue" 
                          stroke="#ef4444" 
                          strokeWidth={2} 
                          name="基准收益 Benchmark Return (%)" 
                          dot={false}
                          strokeDasharray="5 5"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  {benchmarkData && (
                    <div className="mt-3 text-sm text-gray-600 flex items-center justify-center gap-4">
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-0.5 bg-blue-600"></span>
                        策略 Strategy
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-0.5 bg-red-500" style={{backgroundImage: 'repeating-linear-gradient(to right, #ef4444 0, #ef4444 3px, transparent 3px, transparent 8px)'}}></span>
                        基准 Benchmark: {benchmarks.find(b => b.code === selectedBenchmark)?.name}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Daily Returns Chart */}
              {performance?.daily_performances && performance.daily_performances.length > 0 && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4">Daily Returns</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performance.daily_performances.slice(-30).map(d => ({
                      ...d,
                      daily_return_pct: d.daily_return ? d.daily_return * 100 : null
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="trade_date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        formatter={(value) => value?.toFixed(3) + '%'}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                      />
                      <Bar dataKey="daily_return_pct" fill="#3b82f6" name="Daily Return (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              {/* Daily Cash Flow Chart */}
              {performance?.daily_performances && performance.daily_performances.length > 0 && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4">Daily Cash Flow</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={performance.daily_performances
                        .slice(-30)
                        .map((day, index, array) => {
                          // Use the daily_cash_change if available
                          if (day.daily_cash_change !== undefined && day.daily_cash_change !== null) {
                            return {
                              ...day,
                              calculatedCashChange: day.daily_cash_change
                            };
                          }
                          
                          // Otherwise calculate it from daily cash values (if we have previous day data)
                          if (index > 0) {
                            const prevDayCash = array[index - 1].cash;
                            const cashChange = day.cash - prevDayCash;
                            return {
                              ...day,
                              calculatedCashChange: cashChange
                            };
                          }
                          
                          // For the first day with no reference, show no change
                          return {
                            ...day,
                            calculatedCashChange: 0
                          };
                        })
                      }
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="trade_date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value || 0)}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                      />
                      <Bar dataKey="calculatedCashChange" fill="#10b981" name="Cash Change (¥)" />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-gray-500 mt-4">
                    Positive values indicate cash inflows (from selling or deposits), negative values indicate outflows (from buying).
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Holdings Tab */}
        {activeTab === 'holdings' && (
          Object.keys(holdingsHistory).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(holdingsHistory)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB)) // Sort by date ascending
                .map(([date, holdings]) => {
                  const holdingsValue = holdings.reduce((sum, h) => sum + h.market_value, 0);
                  // Get cash from dailyPnl for this date
                  const dayData = dailyPnl.find(d => d.date === date);
                  const cashBalance = dayData ? dayData.cash : 0;
                  const totalValue = holdingsValue + cashBalance;
                  
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
                            {/* Cash Row */}
                            <tr className="bg-green-50 hover:bg-green-100 font-medium">
                              <td className="px-6 py-4 text-sm font-bold text-gray-900">CASH</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">-</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">-</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(cashBalance)}</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">
                                {((cashBalance / totalValue) * 100).toFixed(2)}%
                              </td>
                            </tr>
                            {/* Total Row */}
                            <tr className="bg-blue-50 font-bold">
                              <td className="px-6 py-4 text-sm font-bold text-gray-900">TOTAL</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">-</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">-</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(totalValue)}</td>
                              <td className="px-6 py-4 text-sm text-right text-gray-900">100.00%</td>
                            </tr>
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
          <div className="space-y-6">
            {/* Group transactions by date */}
            {Object.entries(
              transactions.reduce((groups, tx) => {
                const date = tx.trade_date;
                if (!groups[date]) groups[date] = [];
                groups[date].push(tx);
                return groups;
              }, {})
            )
              .sort(([dateA], [dateB]) => dateA.localeCompare(dateB)) // Sort dates ascending
              .map(([date, dayTransactions]) => {
                const totalAmount = dayTransactions.reduce((sum, tx) => 
                  sum + (tx.action.toLowerCase() === 'buy' ? -tx.net_amount : tx.net_amount), 0
                );
                const buyCount = dayTransactions.filter(tx => tx.action.toLowerCase() === 'buy').length;
                const sellCount = dayTransactions.filter(tx => tx.action.toLowerCase() === 'sell').length;
                
                return (
                  <div key={date} className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{date}</h3>
                <div className="text-sm text-gray-500">
                          <span className="font-medium text-gray-900">{dayTransactions.length}</span> transaction{dayTransactions.length !== 1 ? 's' : ''} · 
                    <span className="ml-2">
                            <span className="text-green-700">{buyCount} buy</span> / <span className="text-red-700">{sellCount} sell</span>
                          </span> · 
                          <span className={`ml-2 font-medium ${totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Net: {formatCurrency(totalAmount)}
                    </span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                          {dayTransactions
                            .sort((a, b) => a.execution_time - b.execution_time) // Sort by time ascending
                            .map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-600">{tx.execution_datetime.split(' ')[1]}</td>
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
                              <td className={`px-6 py-4 text-sm text-right font-medium ${
                                tx.action.toLowerCase() === 'buy' ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {tx.action.toLowerCase() === 'buy' ? '-' : '+'}{formatCurrency(tx.net_amount)}
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

      </div>
    </div>
  );
};

export default QMTTradingDashboard;