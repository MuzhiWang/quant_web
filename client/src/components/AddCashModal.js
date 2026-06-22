import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, Loader2, Wallet } from 'lucide-react';

/**
 * Modal for adding or withdrawing cash for a strategy (POST /api/cash).
 *
 * Mirrors AddOrderModal: it fetches GET /api/trading-mode for the default mode, offers an
 * explicit DRY RUN / LIVE selector (sent as `dry_run` so the affected cash records match the
 * target engine), and requires a confirm step before submitting. ADD = deposit, WITHDRAW =
 * remove capital (the backend validates sufficient balance and 400s otherwise).
 */
const emptyForm = (strategy) => ({
  strategy: strategy || '',
  action: 'ADD',
  amount: '',
  trade_date: '',
  description: '',
});

export const AddCashModal = ({
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
  const [dryRun, setDryRun] = useState(null); // selected mode for THIS op; sent as `dry_run`
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

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm(defaultStrategy));
      setConfirming(false);
      setSubmitting(false);
      setFormError(null);
      setDryRun(null);
      fetchMode();
    }
  }, [isOpen, defaultStrategy, fetchMode]);

  if (!isOpen) return null;

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    if (!form.strategy.trim()) return 'Strategy is required.';
    if (!['ADD', 'WITHDRAW'].includes(form.action)) return 'Action must be ADD or WITHDRAW.';
    if (dryRun !== true && dryRun !== false) return 'Select an execution mode (DRY RUN or LIVE).';
    const amt = Number(form.amount);
    if (!(amt > 0)) return 'Amount must be greater than 0.';
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
        amount: Number(form.amount),
        dry_run: dryRun,
      };
      if (form.trade_date !== '') payload.trade_date = form.trade_date;
      if (form.description.trim() !== '') payload.description = form.description.trim();

      const res = await fetch(`${apiBaseUrl}/cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || `HTTP ${res.status}`);
      }
      addToast(
        `[${data.mode_label}] ${payload.action === 'ADD' ? 'Added' : 'Withdrew'} ` +
          `${payload.amount.toLocaleString()} — ${payload.strategy}`,
        'success'
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      addToast(`Failed to ${form.action.toLowerCase()} cash: ${err.message}`, 'error');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isLive = dryRun === false;
  const modeLabel = dryRun === false ? 'LIVE' : dryRun === true ? 'DRY RUN' : (mode ? mode.mode_label : '—');
  const isOverriding = mode && dryRun !== null && dryRun !== mode.dry_run_mode;
  const isWithdraw = form.action === 'WITHDRAW';

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
            <Wallet className="h-5 w-5 text-emerald-600" />
            Add / Withdraw Cash
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
                Affects <strong>{modeLabel}</strong> cash records
                {isLive ? ' — the live account.' : ' (simulation).'}
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
                  LIVE (real account)
                </button>
              </div>
              {isOverriding && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  This API server is in {mode.mode_label}; the operation will affect{' '}
                  <strong>{modeLabel}</strong> records to match the target engine.
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
                  <option value="ADD">ADD (存入)</option>
                  <option value="WITHDRAW">WITHDRAW (取出)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount (CNY)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  placeholder="100000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.trade_date}
                  onChange={(e) => setField('trade_date', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder={isWithdraw ? 'e.g. Profit withdrawal' : 'note'}
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
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Review
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 px-6 py-4">
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <p className="mb-2 font-medium text-gray-900">Confirm this cash operation:</p>
              <ul className="space-y-1">
                <li><span className="text-gray-500">Strategy:</span> {form.strategy}</li>
                <li>
                  <span className="text-gray-500">Operation:</span>{' '}
                  <strong className={isWithdraw ? 'text-red-600' : 'text-emerald-600'}>
                    {form.action}
                  </strong>{' '}
                  {Number(form.amount).toLocaleString()} CNY
                </li>
                <li>
                  <span className="text-gray-500">Date:</span>{' '}
                  {form.trade_date !== '' ? form.trade_date : 'today'}
                </li>
                {form.description.trim() !== '' && (
                  <li><span className="text-gray-500">Note:</span> {form.description.trim()}</li>
                )}
                <li><span className="text-gray-500">Mode:</span> <strong>{modeLabel}</strong></li>
              </ul>
            </div>

            {isLive && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                This affects the LIVE account's cash records.
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
                  isLive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Submitting…' : `Confirm ${form.action}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddCashModal;
