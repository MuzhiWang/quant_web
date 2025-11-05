import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * LoadingOverlay Component
 * Shows a subtle loading indicator over content without hiding it
 */
export const LoadingOverlay = ({ isLoading, children, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-lg flex items-center justify-center z-10 transition-opacity duration-200">
          <div className="bg-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-gray-700">Updating...</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Section wrapper with loading state
 * Provides consistent styling for all dashboard sections
 */
export const LoadingSection = ({ isLoading, children, className = '' }) => {
  return (
    <LoadingOverlay isLoading={isLoading} className={className}>
      {children}
    </LoadingOverlay>
  );
};

