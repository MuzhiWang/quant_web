import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, Loader2, ShoppingCart } from 'lucide-react';

/**
 * Modal for manually injecting an order into the QMT backend (POST /api/order).
 *
 * IMPORTANT: the order's execution mode (LIVE vs DRY RUN) is NOT chosen here. It always
 * follows the running service's config. We fetch GET /api/trading-mode on open and show
 * the user which mode the order will actually run in, then require an explicit confirm
 * step before submitting — so a user viewing dry-run data can't unknowingly fire a LIVE order.
 */
// Accepts QMT format (600000.SH / 000001.SZ) or JoinQuant format
// (600000.XSHG / 513500.XSHG / 000001.XSHE). The backend normalize_code maps
// both to the stocks-table .SS/.SZ form, so either is valid here.
const ORDER_CODE_RE = /^\d{6}\.(SH|SZ|XSHG|XSHE)$/i;

const emptyForm = (strategy) => ({
  strategy: strategy || '',
  action: 'BUY',
  code: '',
  amount: '',
  price: '',
});

export const AddOrderModal = ({
  isOpen,
  onClose,
  apiBaseUrl,
  strategies = [],
  defaultStrategy = '',
  onSuccess,
  addToast,
}) => {
  const [form, setForm] = useState(emptyForm(defaultStrategy));
  const [mode, setMode] = useState(null); // { dry_run_mode, mode_label } — the API server's own mode
  const [dryRun, setDryRun] = useState(null); // selected mode for THIS order; sent as `dry_run` (overrides server)
  const [modeLoading, setModeLoading] = useState(false);
  const [modeError, setModeError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchMode = useCallback(async () => {
    setModeLoading(true);
    setModeError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/trading-mode`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMode(data);
      setDryRun(data.dry_run_mode); // default the selector to this server's mode
    } catch (err) {
      setModeError(err.message);
      setMode(null);
    } finally {
      setModeLoading(false);
    }
  }, [apiBaseUrl]);

  // Reset + fetch the live execution mode every time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm(defaultStrategy));
      setConfirming(false);
      setSubmitting(false);
      setFormError(null);
      setDryRun(null); // fetchMode sets the default once the server mode is known
      fetchMode();
    }
  }, [isOpen, defaultStrategy, fetchMode]);

  if (!isOpen) return null;

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    if (!form.strategy.trim()) return 'Strategy is required.';
    if (dryRun !== true && dryRun !== false) return 'Select an execution mode (DRY RUN or LIVE).';
    if (!['BUY', 'SELL'].includes(form.action)) return 'Action must be BUY or SELL.';
    if (!ORDER_CODE_RE.test(form.code.trim())) return 'Code must be QMT (600000.SH / 000001.SZ) or JoinQuant (513500.XSHG / 000001.XSHE) format.';
    const amt = Number(form.amount);
    if (!Number.isInteger(amt) || amt <= 0) return 'Amount must be a positive whole number of shares.';
    if (form.price !== '' && !(Number(form.price) > 0)) return 'Price, if set, must be greater than 0.';
    return null;
  };

  const handleReview = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setConfirming(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        strategy: form.strategy.trim(),
        action: form.action,
        code: form.code.trim().toUpperCase(),
        amount: Number(form.amount),
      };
      if (form.price !== '') payload.price = Number(form.price);
      payload.dry_run = dryRun; // queue in the explicitly selected mode

      const res = await fetch(`${apiBaseUrl}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || `HTTP ${res.status}`);
      }
      addToast(
        `[${data.mode_label}] Order queued: ${payload.action} ${payload.code} ×${payload.amount}`,
        'success'
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      addToast(`Failed to add order: ${err.message}`, 'error');
      setConfirming(false); // back to the form so the user can retry/adjust
    } finally {
      setSubmitting(false);
    }
  };

  // Banner + confirm reflect the SELECTED mode (what the order will actually run as).
  const isLive = dryRun === false;
  const modeLabel = dryRun === false ? 'LIVE' : dryRun === true ? 'DRY RUN' : (mode ? mode.mode_label : '—');
  const isOverriding = mode && dryRun !== null && dryRun !== mode.dry_run_mode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Add Order
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Execution-mode banner */}
        <div className="px-6 pt-4">
          {modeLoading ? (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking execution mode…
            </div>
          ) : modeError ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Couldn't read execution mode ({modeError}). Is the backend running?{' '}
              <button onClick={fetchMode} className="underline">Retry</button>
            </div>
          ) : (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isLive ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
              }`}
            >
              {isLive && <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span>
                This order will execute in <strong>{modeLabel}</strong> mode
                {isLive ? ' — real money.' : ' (simulation).'}
              </span>
            </div>
          )}
        </div>

        {/* Body: form OR confirm step */}
        {!confirming ? (
          <form onSubmit={handleReview} className="space-y-4 px-6 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Strategy</label>
              {strategies.length > 0 ? (
                <select
                  value={form.strategy}
                  onChange={(e) => setField('strategy', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a strategy…</option>
                  {strategies.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.strategy}
                  onChange={(e) => setField('strategy', e.target.value)}
                  placeholder="strategy name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Execution mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDryRun(true)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    dryRun === true
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  DRY RUN (simulation)
                </button>
                <button
                  type="button"
                  onClick={() => setDryRun(false)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    dryRun === false
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  LIVE (real money)
                </button>
              </div>
              {isOverriding && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  This API server is in {mode.mode_label}; the order will be queued as{' '}
                  <strong>{modeLabel}</strong> to match the target engine.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Action</label>
                <select
                  value={form.action}
                  onChange={(e) => setField('action', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BUY">BUY (买入)</option>
                  <option value="SELL">SELL (卖出)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setField('code', e.target.value)}
                  placeholder="600000.SH or 513500.XSHG"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount (shares)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  placeholder="1000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Price <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setField('price', e.target.value)}
                  placeholder="market / engine price"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Review
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 px-6 py-4">
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <p className="mb-2 font-medium text-gray-900">Confirm this order:</p>
              <ul className="space-y-1">
                <li><span className="text-gray-500">Strategy:</span> {form.strategy}</li>
                <li>
                  <span className="text-gray-500">Order:</span>{' '}
                  <strong className={form.action === 'BUY' ? 'text-red-600' : 'text-green-600'}>
                    {form.action}
                  </strong>{' '}
                  {form.code.trim().toUpperCase()} × {form.amount} shares
                </li>
                <li>
                  <span className="text-gray-500">Price:</span>{' '}
                  {form.price !== '' ? form.price : 'market / engine price'}
                </li>
                <li><span className="text-gray-500">Mode:</span> <strong>{modeLabel}</strong></li>
              </ul>
            </div>

            {isLive && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                This is a LIVE order — it will place a real trade.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  isLive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Submitting…' : `Confirm ${isLive ? 'LIVE ' : ''}Order`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddOrderModal;
