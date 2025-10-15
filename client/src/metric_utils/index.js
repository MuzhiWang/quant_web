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
  calculateDailyTradeRate
} from './performanceMetrics';
import {
  calculateAlphaBeta,
  calculateInformationRatio,
  calculateBenchmarkReturn
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
      annualReturn: 0,
      maxDrawdown: 0,
      sortino: 0,
      profitLossRatio: 0,
      winningTradesCount: 0,
      losingTradesCount: 0,
      maxDrawdownPeakDate: null,
      maxDrawdownTroughDate: null
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
    const drawdownMetrics = calculateMaxDrawdown(performance.daily_performances, true);
    result.maxDrawdown = drawdownMetrics.maxDrawdown;
    result.maxDrawdownPeakDate = drawdownMetrics.maxDrawdownPeakDate;
    result.maxDrawdownTroughDate = drawdownMetrics.maxDrawdownTroughDate;

    // Sortino Ratio
    result.sortino = calculateSortinoRatio(dailyReturns);
  } else {
    result.maxRise = 0;
    result.dailyTradeRate = 0;
    result.annualReturn = 0;
    result.maxDrawdown = 0;
    result.maxDrawdownPeakDate = null;
    result.maxDrawdownTroughDate = null;
    result.sortino = 0;
  }

  // Calculate Win Rate from transactions
  const winRateMetrics = calculateWinRate(transactions);
  result.winRate = winRateMetrics.winRate;
  result.winningTradesCount = winRateMetrics.winningTradesCount;
  result.losingTradesCount = winRateMetrics.losingTradesCount;
  result.profitLossRatio = winRateMetrics.profitLossRatio;

  // Calculate Alpha, Beta, and Information Ratio vs Benchmark
  if (benchmarkData && benchmarkData.data && performance.daily_performances) {
    const strategyReturns = performance.daily_performances.map(d => d.daily_return || 0);
    const benchmarkReturns = benchmarkData.data.map(d => parseFloat(d.daily_return) || 0);

    // Benchmark cumulative return
    result.benchmarkReturn = calculateBenchmarkReturn(benchmarkReturns);

    // Alpha & Beta
    const alphaBeta = calculateAlphaBeta(
      strategyReturns,
      benchmarkReturns,
      performance.total_return || 0,
      result.benchmarkReturn
    );
    result.alpha = alphaBeta.alpha;
    result.beta = alphaBeta.beta;

    // Information Ratio
    result.informationRatio = calculateInformationRatio(
      strategyReturns,
      benchmarkReturns,
      performance.total_return || 0,
      result.benchmarkReturn
    );
  } else {
    result.benchmarkReturn = 0;
    result.alpha = 0;
    result.beta = 0;
    result.informationRatio = 0;
  }

  return result;
};

