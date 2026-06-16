import React, { useState } from 'react';
import { CheckCircle, XCircle, Eye, X, Clock, AlertCircle } from 'lucide-react';
import { BankSlipReviewItem } from '../types';
import { formatLKR, formatDate } from '../utils/format';

interface BankSlipQueueProps {
  queue: BankSlipReviewItem[];
  loading: boolean;
  reviewing: boolean;
  onReview: (id: string, action: 'approve' | 'reject', reason?: string) => Promise<{ success: boolean; message?: string }>;
}

const ROLE_LABEL: Record<string, string> = {
  manager: 'Manager',
  agent: 'Agent',
  subagent: 'Sub-agent',
};

export const BankSlipQueue: React.FC<BankSlipQueueProps> = ({ queue, loading, reviewing, onReview }) => {
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    const res = await onReview(id, 'approve');
    setProcessingId(null);
    showToast(res.success ? 'Slip approved — transaction recorded.' : (res.message || 'Approval failed.'), res.success);
  };

  const handleRejectSubmit = async () => {
    if (!rejectId) return;
    if (!rejectReason.trim()) { showToast('Please enter a reason for rejection.', false); return; }
    setProcessingId(rejectId);
    const res = await onReview(rejectId, 'reject', rejectReason.trim());
    setProcessingId(null);
    if (res.success) {
      showToast('Slip rejected.', true);
      setRejectId(null);
      setRejectReason('');
    } else {
      showToast(res.message || 'Rejection failed.', false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Bank Slip Review Queue</h3>
            <p className="text-xs text-slate-500 mt-0.5">Pending slips from your direct downline awaiting approval.</p>
          </div>
          {queue.length > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              {queue.length}
            </span>
          )}
        </div>

        {toast && (
          <div className={`mx-6 mt-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${toast.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">Loading review queue…</div>
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <CheckCircle className="h-8 w-8 text-emerald-300" />
              <p className="text-sm font-medium text-slate-500">All caught up — no pending slips.</p>
            </div>
          ) : (
            queue.map((slip) => {
              const isProcessing = processingId === slip.id || (reviewing && processingId === slip.id);
              return (
                <div key={slip.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{slip.submittedByName}</p>
                      <p className="text-xs text-slate-500">
                        {ROLE_LABEL[slip.submittedByRole] || slip.submittedByRole} · {formatDate(slip.submittedAt)}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-slate-900">{formatLKR(slip.amount)}</p>
                      {slip.bankName && <p className="text-xs text-slate-400">{slip.bankName}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => setViewUrl(`http://localhost:3001${slip.slipUrl}`)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    <button
                      onClick={() => handleApprove(slip.id)}
                      disabled={isProcessing || reviewing}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => { setRejectId(slip.id); setRejectReason(''); }}
                      disabled={isProcessing || reviewing}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Slip image viewer modal */}
      {viewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewUrl(null)}>
          <div className="relative max-h-[90vh] max-w-2xl w-full overflow-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <span className="text-sm font-bold text-slate-900">Bank Slip Preview</span>
              <button onClick={() => setViewUrl(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <img src={viewUrl} alt="Bank slip" className="w-full rounded-lg object-contain" />
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-right">
              <a href={viewUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 hover:underline">
                Open full size
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <span className="text-sm font-bold text-slate-900">Reject Bank Slip</span>
              <button onClick={() => setRejectId(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">Please provide a reason for rejection so the submitter knows what to correct.</p>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Amount on slip does not match submission, slip is unreadable…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setRejectId(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={reviewing}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {reviewing ? 'Processing…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
