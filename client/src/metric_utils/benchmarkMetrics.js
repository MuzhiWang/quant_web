/**
 * Benchmark Comparison Metrics
 */

/**
 * Calculate Alpha and Beta relative to benchmark
 * @param {Array} strategyReturns - Array of strategy daily returns
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @param {number} totalStrategyReturn - Total strategy return
 * @param {number} totalBenchmarkReturn - Total benchmark return
 * @returns {Object} Alpha and Beta values
 */
export const calculateAlphaBeta = (
  strategyReturns,
  benchmarkReturns,
  totalStrategyReturn,
  totalBenchmarkReturn
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

  // Calculate Alpha (NOT annualized - just the excess return over expected)
  // Alpha = Actual Return - (Beta × Benchmark Return)
  const expectedReturn = beta * totalBenchmarkReturn;
  const alpha = totalStrategyReturn - expectedReturn;
  
  console.log(`Alpha Calculation: Strategy=${(totalStrategyReturn * 100).toFixed(2)}%, Beta=${beta.toFixed(3)}, Benchmark=${(totalBenchmarkReturn * 100).toFixed(2)}%, Expected=${(expectedReturn * 100).toFixed(2)}%, Alpha=${(alpha * 100).toFixed(2)}% = ${alpha.toFixed(3)}`);

  return { alpha, beta };
};

/**
 * Calculate Information Ratio
 * @param {Array} strategyReturns - Array of strategy daily returns
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @param {number} totalStrategyReturn - Total strategy return
 * @param {number} totalBenchmarkReturn - Total benchmark return
 * @returns {number} Information ratio
 */
export const calculateInformationRatio = (
  strategyReturns,
  benchmarkReturns,
  totalStrategyReturn,
  totalBenchmarkReturn
) => {
  const minLength = Math.min(strategyReturns.length, benchmarkReturns.length);
  
  if (minLength < 10) {
    return 0;
  }

  const trackingErrors = [];
  for (let i = 0; i < minLength; i++) {
    trackingErrors.push(strategyReturns[i] - benchmarkReturns[i]);
  }

  const trackingErrorStd = Math.sqrt(
    trackingErrors.reduce((sum, te) => sum + te * te, 0) / trackingErrors.length
  );

  if (trackingErrorStd === 0) {
    return 0;
  }

  const excessReturn = totalStrategyReturn - totalBenchmarkReturn;
  return excessReturn / trackingErrorStd;
};

/**
 * Calculate total benchmark return
 * @param {Array} benchmarkReturns - Array of benchmark daily returns
 * @returns {number} Total cumulative return
 */
export const calculateBenchmarkReturn = (benchmarkReturns) => {
  if (!benchmarkReturns || benchmarkReturns.length === 0) {
    return 0;
  }

  return benchmarkReturns.reduce((sum, r) => sum + r, 0);
};

