import React from 'react';

/**
 * Large metric card component for displaying key metrics
 */
export const MetricCard = ({ title, value, icon, color }) => {
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

/**
 * Compact metric cell for grid layout (like JoinQuant)
 */
export const CompactMetricCell = ({ label, value, valueColor = 'text-gray-900' }) => (
  <div className="text-center py-2 px-1">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className={`text-base font-semibold ${valueColor}`}>{value}</p>
  </div>
);

