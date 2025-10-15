/**
 * Main Metrics Calculation Orchestrator
 * Combines all individual metric calculations
 */

import { calculateWinRate } from './winRateCalculator';
import {
  calculateMaxDrawdown,
  calculateSortinoRatio,
  calculateAnnualReturn,
  calculateMaxRise,
  calculateDailyTradeRate,
  calculateDailyWinRate,
  calculateProfitLossRatio
} from './performanceMetrics';
import {
  calculateAlphaBeta,
  calculateInformationRatio,
  calculateBenchmarkReturn,
  calculateExcessReturn,
  calculateAvgDailyExcessReturn,
  calculateBenchmarkVolatility,
  calculateExcessReturnMaxDrawdown
} from './benchmarkMetrics';

/**
 * Calculate all additional metrics
 * @param {Object} performance - Performance data object
 * @param {Object} benchmarkData - Benchmark data object
 * @param {Array} transactions - Array of transactions
 * @returns {Object} All calculated metrics
 */
export const calculateAllMetrics = (performance, benchmarkData, transactions) => {
  if (!performance) {
    return {
      informationRatio: 0,
      maxRise: 0,
      dailyTradeRate: 0,
      benchmarkReturn: 0,
      alpha: 0,
      beta: 0,
      winRate: 0,
      dailyWinRate: 0,
      tradeWinRate: 0,
      annualReturn: 0,
      maxDrawdown: 0,
      sortino: 0,
      profitLossRatio: 0,
      winningDaysCount: 0,
      losingDaysCount: 0,
      winningTradesCount: 0,
      losingTradesCount: 0,
      tradeWinLoseRatio: 0,
      maxDrawdownPeakDate: null,
      maxDrawdownTroughDate: null,
      excessReturn: 0,
      avgDailyExcessReturn: 0,
      benchmarkVolatility: 0,
      excessReturnMaxDrawdown: 0
    };
  }

  const result = {};

  // Calculate from daily performances
  if (performance.daily_performances && performance.daily_performances.length > 0) {
    const cumulativeReturns = performance.daily_performances.map(d => d.cumulative_return || 0);
    const dailyReturns = performance.daily_performances.map(d => d.daily_return || 0);
    const tradingDays = performance.daily_performances.length;

    // Max Rise
    result.maxRise = calculateMaxRise(cumulativeReturns);

    // Daily Trade Rate
    result.dailyTradeRate = calculateDailyTradeRate(performance.total_trades || 0, tradingDays);

    // Annual Return
    result.annualReturn = calculateAnnualReturn(performance.total_return || 0, tradingDays);

    // Max Drawdown with date range (enable debug logging)
    const drawdownMetrics = calculateMaxDrawdown(performance.daily_performances, false);
    result.maxDrawdown = drawdownMetrics.maxDrawdown;
    result.maxDrawdownPeakDate = drawdownMetrics.maxDrawdownPeakDate;
    result.maxDrawdownTroughDate = drawdownMetrics.maxDrawdownTroughDate;

    // Sortino Ratio
    result.sortino = calculateSortinoRatio(dailyReturns);

    // Daily Win Rate (JoinQuant standard - based on daily returns)
    result.dailyWinRate = calculateDailyWinRate(dailyReturns);

    // Profit/Loss Ratio (JoinQuant standard - average amounts)
    const plRatioMetrics = calculateProfitLossRatio(dailyReturns);
    result.profitLossRatio = plRatioMetrics.profitLossRatio;
    result.winningDaysCount = plRatioMetrics.winningDaysCount;
    result.losingDaysCount = plRatioMetrics.losingDaysCount;
  } else {
    result.maxRise = 0;
    result.dailyTradeRate = 0;
    result.annualReturn = 0;
    result.maxDrawdown = 0;
    result.maxDrawdownPeakDate = null;
    result.maxDrawdownTroughDate = null;
    result.sortino = 0;
    result.dailyWinRate = 0;
    result.profitLossRatio = 0;
    result.winningDaysCount = 0;
    result.losingDaysCount = 0;
  }

  // Trade-based win rate (for 盈亏次数)
  const tradeWinRateMetrics = calculateWinRate(transactions);
  result.tradeWinRate = tradeWinRateMetrics.winRate;
  result.winningTradesCount = tradeWinRateMetrics.winningTradesCount;
  result.losingTradesCount = tradeWinRateMetrics.losingTradesCount;
  
  // Calculate trade win/lose ratio
  if (result.losingTradesCount > 0) {
    result.tradeWinLoseRatio = result.winningTradesCount / result.losingTradesCount;
  } else if (result.winningTradesCount > 0) {
    result.tradeWinLoseRatio = result.winningTradesCount; // All wins, no losses
  } else {
    result.tradeWinLoseRatio = 0;
  }
  
  // Use daily win rate as the primary win rate (JoinQuant standard)
  result.winRate = result.dailyWinRate;

  // Calculate Alpha, Beta, and Information Ratio vs Benchmark
  if (benchmarkData && benchmarkData.data && performance.daily_performances) {
    const strategyReturns = performance.daily_performances.map(d => d.daily_return || 0);
    const benchmarkReturns = benchmarkData.data.map(d => parseFloat(d.daily_return) || 0);

    // Benchmark cumulative return
    result.benchmarkReturn = calculateBenchmarkReturn(benchmarkReturns);

    // Alpha & Beta (with risk-free rate = 3%)
    // Note: performance.total_return is in percentage (e.g., 11.87 for 11.87%), convert to decimal
    const totalStrategyReturnDecimal = (performance.total_return || 0) / 100;
    const alphaBeta = calculateAlphaBeta(
      strategyReturns,
      benchmarkReturns,
      totalStrategyReturnDecimal,
      result.benchmarkReturn,
      0.03  // 3% risk-free rate
    );
    result.alpha = alphaBeta.alpha;
    result.beta = alphaBeta.beta;

    // Information Ratio (annualized with √252)
    result.informationRatio = calculateInformationRatio(strategyReturns, benchmarkReturns);

    // Excess Returns (Strategy - Benchmark)
    // Note: performance.total_return is in percentage, convert to decimal
    result.excessReturn = calculateExcessReturn(totalStrategyReturnDecimal, result.benchmarkReturn);

    // Average Daily Excess Returns
    result.avgDailyExcessReturn = calculateAvgDailyExcessReturn(strategyReturns, benchmarkReturns);

    // Benchmark Volatility (annualized)
    result.benchmarkVolatility = calculateBenchmarkVolatility(benchmarkReturns);

    // Maximum Drawdown of Excess Returns
    result.excessReturnMaxDrawdown = calculateExcessReturnMaxDrawdown(strategyReturns, benchmarkReturns);
  } else {
    result.benchmarkReturn = 0;
    result.alpha = 0;
    result.beta = 0;
    result.informationRatio = 0;
    result.excessReturn = 0;
    result.avgDailyExcessReturn = 0;
    result.benchmarkVolatility = 0;
    result.excessReturnMaxDrawdown = 0;
  }

  return result;
};

