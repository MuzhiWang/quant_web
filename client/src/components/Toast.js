import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

/**
 * Toast Notification Component
 */
export const Toast = ({ message, type = 'error', onClose }) => {
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

/**
 * Toast Container Component
 */
export const ToastContainer = ({ toasts, removeToast }) => {
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

