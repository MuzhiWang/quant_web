/**
 * Performance Metrics Calculation Utilities
 */

/**
 * Calculate maximum drawdown from cumulative returns (percentage-based)
 * @param {Array} dailyPerformances - Array of daily performance data
 * @param {boolean} debug - Enable debug logging
 * @returns {Object} Max drawdown metrics including maxDrawdown, peak date, and trough date
 */
export const calculateMaxDrawdown = (dailyPerformances, debug = false) => {
  if (!dailyPerformances || dailyPerformances.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPeakDate: null,
      maxDrawdownTroughDate: null
    };
  }

  // Use cumulative returns (percentage-based) instead of absolute portfolio values
  const cumulativeReturns = dailyPerformances.map(d => d.cumulative_return || 0);

  let peakReturn = cumulativeReturns[0];
  let peakIdx = 0;
  let maxDD = 0;
  let maxDDPeakIdx = 0;
  let maxDDTroughIdx = 0;

  if (debug) {
    console.log('=== Max Drawdown Calculation Debug (Percentage-Based) ===');
    console.log(`Total days: ${cumulativeReturns.length}`);
    console.log(`Initial cumulative return: ${(cumulativeReturns[0] * 100).toFixed(2)}%`);
  }

  for (let i = 0; i < cumulativeReturns.length; i++) {
    const currentReturn = cumulativeReturns[i];
    const date = dailyPerformances[i]?.trade_date;

    // Update peak if new high
    if (currentReturn > peakReturn) {
      peakReturn = currentReturn;
      peakIdx = i;
    }

    // Calculate drawdown from current peak (percentage point difference)
    const drawdown = currentReturn - peakReturn; // Negative value in percentage points
    const drawdownPercent = drawdown * 100;

    if (debug) {
      console.log(`Day ${i + 1} (${date}): CumReturn=${(currentReturn * 100).toFixed(2)}%, Peak=${(peakReturn * 100).toFixed(2)}%, Drawdown=${drawdownPercent.toFixed(2)}%`);
    }

    // Track maximum drawdown (most negative)
    if (drawdown < maxDD) {
      maxDD = drawdown;
      maxDDPeakIdx = peakIdx;
      maxDDTroughIdx = i;
      
      if (debug) {
        console.log(`  *** New Max Drawdown: ${(maxDD * 100).toFixed(2)}% (from ${dailyPerformances[maxDDPeakIdx]?.trade_date} to ${date})`);
      }
    }
  }

  if (debug) {
    console.log(`\nFinal Max Drawdown: ${(maxDD * 100).toFixed(2)}%`);
    console.log(`Period: ${dailyPerformances[maxDDPeakIdx]?.trade_date} to ${dailyPerformances[maxDDTroughIdx]?.trade_date}`);
    console.log('=====================================\n');
  }

  return {
    maxDrawdown: maxDD,
    maxDrawdownPeakDate: dailyPerformances[maxDDPeakIdx]?.trade_date,
    maxDrawdownTroughDate: dailyPerformances[maxDDTroughIdx]?.trade_date
  };
};

/**
 * Calculate Sortino Ratio (uses downside deviation)
 * @param {Array} dailyReturns - Array of daily returns
 * @param {number} riskFreeRate - Annual risk-free rate (default 0.03 for 3%)
 * @returns {number} Sortino ratio
 */
export const calculateSortinoRatio = (dailyReturns, riskFreeRate = 0.03) => {
  if (!dailyReturns || dailyReturns.length === 0) {
    return 0;
  }

  const negativeReturns = dailyReturns.filter(r => r < 0);
  if (negativeReturns.length === 0) {
    return 0;
  }

  const downsideStd = Math.sqrt(
    negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length
  ) * Math.sqrt(252);

  const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length * 252;

  if (downsideStd > 0) {
    return (avgReturn - riskFreeRate) / downsideStd;
  }

  return 0;
};

/**
 * Calculate annualized return
 * @param {number} totalReturn - Total return in percentage format from API (e.g., 1.92 for 1.92%)
 * @param {number} tradingDays - Number of trading days
 * @returns {number} Annualized return as decimal
 */
export const calculateAnnualReturn = (totalReturn, tradingDays) => {
  if (!tradingDays || tradingDays === 0) {
    return 0;
  }

  // API returns total_return as percentage (e.g., 1.92 for 1.92%)
  // Convert to decimal for calculation
  const returnDecimal = totalReturn / 100;
  
  if (returnDecimal === 0) {
    return 0;
  }

  const years = tradingDays / 252; // 252 trading days per year
  
  // Handle edge case of very short trading period (< 5 days)
  if (tradingDays < 5) {
    console.warn(`Annual Return: Trading period too short (${tradingDays} days), returning 0`);
    return 0;
  }
  
  const annualReturn = Math.pow(1 + returnDecimal, 1 / years) - 1;
  
  console.log(`Annual Return Calculation: totalReturn=${totalReturn}%, returnDecimal=${returnDecimal.toFixed(4)}, tradingDays=${tradingDays}, years=${years.toFixed(3)}, annualReturn=${(annualReturn * 100).toFixed(2)}%`);
  
  return annualReturn;
};

/**
 * Calculate maximum rise from cumulative returns
 * @param {Array} cumulativeReturns - Array of cumulative returns
 * @returns {number} Maximum rise as decimal
 */
export const calculateMaxRise = (cumulativeReturns) => {
  if (!cumulativeReturns || cumulativeReturns.length === 0) {
    return 0;
  }

  return Math.max(...cumulativeReturns, 0);
};

/**
 * Calculate daily trade rate
 * @param {number} totalTrades - Total number of trades
 * @param {number} tradingDays - Number of trading days
 * @returns {number} Daily trade rate
 */
export const calculateDailyTradeRate = (totalTrades, tradingDays) => {
  if (!tradingDays || tradingDays === 0) {
    return 0;
  }

  return totalTrades / tradingDays;
};

/**
 * Calculate daily win rate (JoinQuant standard)
 * Percentage of trading days with positive returns
 * @param {Array} dailyReturns - Array of daily returns
 * @returns {number} Win rate as decimal (0-1)
 */
export const calculateDailyWinRate = (dailyReturns) => {
  if (!dailyReturns || dailyReturns.length === 0) {
    return 0;
  }

  const profitableDays = dailyReturns.filter(r => r > 0).length;
  return profitableDays / dailyReturns.length;
};

/**
 * Calculate profit/loss ratio (JoinQuant standard)
 * Average profit on winning days / Average loss on losing days
 * @param {Array} dailyReturns - Array of daily returns
 * @returns {Object} Contains profitLossRatio, winningDaysCount, losingDaysCount
 */
export const calculateProfitLossRatio = (dailyReturns) => {
  if (!dailyReturns || dailyReturns.length === 0) {
    return {
      profitLossRatio: 0,
      winningDaysCount: 0,
      losingDaysCount: 0
    };
  }

  const winningDays = dailyReturns.filter(r => r > 0);
  const losingDays = dailyReturns.filter(r => r < 0);

  if (winningDays.length === 0 || losingDays.length === 0) {
    return {
      profitLossRatio: winningDays.length > 0 ? Infinity : 0,
      winningDaysCount: winningDays.length,
      losingDaysCount: losingDays.length
    };
  }

  const avgProfit = winningDays.reduce((sum, r) => sum + r, 0) / winningDays.length;
  const avgLoss = Math.abs(losingDays.reduce((sum, r) => sum + r, 0) / losingDays.length);

  return {
    profitLossRatio: avgLoss > 0 ? avgProfit / avgLoss : 0,
    winningDaysCount: winningDays.length,
    losingDaysCount: losingDays.length
  };
};

