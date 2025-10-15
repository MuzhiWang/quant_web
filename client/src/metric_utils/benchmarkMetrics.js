/**
 * Benchmark Comparison Metrics
 */

/**
 * Calculate Alpha and Beta relative to benchmark
 * @param {Array} strategyReturns - Array of strategy daily returns
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @param {number} totalStrategyReturn - Total strategy return
 * @param {number} totalBenchmarkReturn - Total benchmark return
 * @param {number} riskFreeRate - Annual risk-free rate (default 0.03 for 3%)
 * @returns {Object} Alpha and Beta values
 */
export const calculateAlphaBeta = (
  strategyReturns,
  benchmarkReturns,
  totalStrategyReturn,
  totalBenchmarkReturn,
  riskFreeRate = 0.03
) => {
  const minLength = Math.min(strategyReturns.length, benchmarkReturns.length);
  
  if (minLength < 10) {
    return { alpha: 0, beta: 0 };
  }

  // Calculate means
  const strategyMean = strategyReturns.slice(0, minLength).reduce((a, b) => a + b, 0) / minLength;
  const benchmarkMean = benchmarkReturns.slice(0, minLength).reduce((a, b) => a + b, 0) / minLength;

  // Calculate covariance and variance
  let covariance = 0;
  let benchmarkVariance = 0;
  for (let i = 0; i < minLength; i++) {
    const strategyDiff = strategyReturns[i] - strategyMean;
    const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
    covariance += strategyDiff * benchmarkDiff;
    benchmarkVariance += benchmarkDiff * benchmarkDiff;
  }
  covariance /= minLength;
  benchmarkVariance /= minLength;

  // Calculate Beta
  const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;

  // Calculate Alpha using full CAPM formula
  // Alpha = Strategy Return - [Risk_Free_Rate + Beta × (Benchmark Return - Risk_Free_Rate)]
  const expectedReturn = riskFreeRate + beta * (totalBenchmarkReturn - riskFreeRate);
  const alpha = totalStrategyReturn - expectedReturn;
  
  console.log(`Alpha Calculation (CAPM): Strategy=${(totalStrategyReturn * 100).toFixed(2)}%, Beta=${beta.toFixed(3)}, Benchmark=${(totalBenchmarkReturn * 100).toFixed(2)}%, RF=${(riskFreeRate * 100).toFixed(1)}%, Expected=${(expectedReturn * 100).toFixed(2)}%, Alpha=${(alpha * 100).toFixed(2)}% = ${alpha.toFixed(3)}`);

  return { alpha, beta };
};

/**
 * Calculate Information Ratio (JoinQuant standard)
 * Formula: Mean(Daily Excess Returns) / StdDev(Daily Excess Returns) × √252
 * @param {Array} strategyReturns - Array of strategy daily returns
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @returns {number} Information ratio (annualized)
 */
export const calculateInformationRatio = (strategyReturns, benchmarkReturns) => {
  const minLength = Math.min(strategyReturns.length, benchmarkReturns.length);
  
  if (minLength < 10) {
    return 0;
  }

  // Calculate daily excess returns
  const excessReturns = [];
  for (let i = 0; i < minLength; i++) {
    excessReturns.push(strategyReturns[i] - benchmarkReturns[i]);
  }

  // Mean of excess returns
  const meanExcess = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;

  // Standard deviation of excess returns
  const variance = excessReturns.reduce((sum, r) => sum + Math.pow(r - meanExcess, 2), 0) / excessReturns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return 0;
  }

  // Annualized Information Ratio
  return (meanExcess / stdDev) * Math.sqrt(252);
};

/**
 * Calculate total benchmark return (cumulative percentage change)
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @returns {number} Total cumulative return as percentage change
 */
export const calculateBenchmarkReturn = (benchmarkReturns) => {
  if (!benchmarkReturns || benchmarkReturns.length === 0) {
    return 0;
  }

  // Calculate compound return: (1+r1) * (1+r2) * ... - 1
  let cumulativeReturn = 1;
  for (let i = 0; i < benchmarkReturns.length; i++) {
    cumulativeReturn *= (1 + benchmarkReturns[i]);
  }
  
  return cumulativeReturn - 1;
};

/**
 * Calculate excess returns (Strategy - Benchmark)
 * @param {number} strategyReturn - Total strategy return
 * @param {number} benchmarkReturn - Total benchmark return
 * @returns {number} Excess return
 */
export const calculateExcessReturn = (strategyReturn, benchmarkReturn) => {
  return strategyReturn - benchmarkReturn;
};

/**
 * Calculate average daily excess returns
 * @param {Array} strategyReturns - Array of strategy daily returns
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @returns {number} Average daily excess return
 */
export const calculateAvgDailyExcessReturn = (strategyReturns, benchmarkReturns) => {
  const minLength = Math.min(strategyReturns.length, benchmarkReturns.length);
  
  if (minLength === 0) {
    return 0;
  }

  const excessReturns = [];
  for (let i = 0; i < minLength; i++) {
    excessReturns.push(strategyReturns[i] - benchmarkReturns[i]);
  }

  return excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
};

/**
 * Calculate benchmark volatility (annualized)
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @returns {number} Annualized volatility
 */
export const calculateBenchmarkVolatility = (benchmarkReturns) => {
  if (!benchmarkReturns || benchmarkReturns.length === 0) {
    return 0;
  }

  const mean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
  const variance = benchmarkReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / benchmarkReturns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize using √252
  return stdDev * Math.sqrt(252);
};

/**
 * Calculate maximum drawdown of excess returns
 * @param {Array} strategyReturns - Array of strategy daily returns
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @returns {number} Maximum drawdown of excess returns
 */
export const calculateExcessReturnMaxDrawdown = (strategyReturns, benchmarkReturns) => {
  const minLength = Math.min(strategyReturns.length, benchmarkReturns.length);
  
  if (minLength === 0) {
    return 0;
  }

  // Calculate cumulative excess returns
  const excessReturns = [];
  let cumulative = 0;
  for (let i = 0; i < minLength; i++) {
    cumulative += (strategyReturns[i] - benchmarkReturns[i]);
    excessReturns.push(cumulative);
  }

  // Calculate max drawdown on excess returns
  let peak = excessReturns[0];
  let maxDD = 0;

  for (let i = 0; i < excessReturns.length; i++) {
    const current = excessReturns[i];
    
    if (current > peak) {
      peak = current;
    }

    const drawdown = current - peak;
    if (drawdown < maxDD) {
      maxDD = drawdown;
    }
  }

  return maxDD;
};

