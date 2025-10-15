import React from 'react';
import { CompactMetricCell } from './MetricCard';
import { calculateAllMetrics } from '../metric_utils';

/**
 * Metrics Grid Component - compact 2-row layout
 * Displays all performance metrics in a JoinQuant-style grid
 */
export const MetricsGrid = ({ performance, benchmarkData, transactions }) => {
  // Calculate all additional metrics
  const additionalMetrics = React.useMemo(() => {
    return calculateAllMetrics(performance, benchmarkData, transactions);
  }, [performance, benchmarkData, transactions]);

  if (!performance) return null;

  const safeValue = (value, defaultVal = 0) => value !== null && value !== undefined ? value : defaultVal;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      {/* Row 1: Primary Metrics */}
      <div className="grid grid-cols-8 gap-2 mb-2 border-b border-gray-100 pb-3">
        <CompactMetricCell
          label="策略收益"
          value={`${safeValue(performance.total_return).toFixed(2)}%`}
          valueColor={performance.total_return >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <CompactMetricCell 
          label="阿尔法" 
          value={additionalMetrics.alpha.toFixed(3)}
          valueColor={additionalMetrics.alpha >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <CompactMetricCell
          label="贝塔"
          value={additionalMetrics.beta.toFixed(3)}
          valueColor="text-gray-900"
        />
        <CompactMetricCell
          label="波动率"
          value={`${(safeValue(performance.final_volatility) * 100).toFixed(2)}%`}
          valueColor="text-gray-900"
        />
        <CompactMetricCell
          label="信息比率"
          value={additionalMetrics.informationRatio.toFixed(3)}
          valueColor="text-gray-900"
        />
        <div className="text-center py-2 px-1" title={additionalMetrics.maxDrawdownPeakDate && additionalMetrics.maxDrawdownTroughDate ? `${additionalMetrics.maxDrawdownPeakDate} 至 ${additionalMetrics.maxDrawdownTroughDate}` : ''}>
          <p className="text-xs text-gray-500 mb-1">最大回撤</p>
          <p className="text-base font-semibold text-red-600">
            {`${(additionalMetrics.maxDrawdown * 100).toFixed(2)}%`}
          </p>
          {additionalMetrics.maxDrawdownPeakDate && additionalMetrics.maxDrawdownTroughDate && (
            <p className="text-xs text-gray-400 mt-0.5">
              {additionalMetrics.maxDrawdownPeakDate.slice(5)} - {additionalMetrics.maxDrawdownTroughDate.slice(5)}
            </p>
          )}
        </div>
        <CompactMetricCell
          label="夏普比率"
          value={safeValue(performance.final_sharpe_ratio, 0).toFixed(3)}
          valueColor="text-gray-900"
        />
        <CompactMetricCell
          label="胜率"
          value={`${(additionalMetrics.winRate * 100).toFixed(1)}%`}
          valueColor={additionalMetrics.winRate >= 0.5 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Row 2: Extended Metrics */}
      <div className="grid grid-cols-8 gap-2 pt-2">
        <CompactMetricCell
          label="基准收益"
          value={`${(additionalMetrics.benchmarkReturn * 100).toFixed(2)}%`}
          valueColor={additionalMetrics.benchmarkReturn >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <CompactMetricCell
          label="日均收益"
          value={`${(safeValue(performance.avg_daily_return) * 100).toFixed(3)}%`}
          valueColor={performance.avg_daily_return >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <CompactMetricCell
          label="年化收益"
          value={`${(additionalMetrics.annualReturn * 100).toFixed(2)}%`}
          valueColor={additionalMetrics.annualReturn >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <CompactMetricCell
          label="索提诺比率"
          value={additionalMetrics.sortino.toFixed(3)}
          valueColor="text-gray-900"
        />
        <CompactMetricCell
          label="盈亏比率"
          value={additionalMetrics.profitLossRatio.toFixed(2)}
          valueColor="text-gray-900"
        />
        <CompactMetricCell
          label="最大上涨"
          value={`${(additionalMetrics.maxRise * 100).toFixed(2)}%`}
          valueColor="text-green-600"
        />
        <CompactMetricCell
          label="日交易率"
          value={additionalMetrics.dailyTradeRate.toFixed(2)}
          valueColor="text-gray-900"
        />
        <div className="text-center py-2 px-1">
          <p className="text-xs text-gray-500 mb-1">盈亏交易</p>
          <p className="text-base font-semibold text-gray-900">
            {additionalMetrics.winningTradesCount} / {additionalMetrics.losingTradesCount}
          </p>
        </div>
      </div>
    </div>
  );
};

