import React, { useRef, useState } from 'react';
import { Upload, FileImage, X, CheckCircle, Clock, XCircle } from 'lucide-react';
import { BankSlipRequest } from '../types';
import { formatLKR, formatDate } from '../utils/format';

interface BankSlipSubmitProps {
  mySlips: BankSlipRequest[];
  loadingMy: boolean;
  submitting: boolean;
  onSubmit: (data: { amount: number; bankName?: string; slipImage: string }) => Promise<{ success: boolean; message?: string }>;
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', icon: Clock,         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved',       icon: CheckCircle,   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected',       icon: XCircle,       cls: 'bg-red-50 text-red-700 border-red-200' },
};

export const BankSlipSubmit: React.FC<BankSlipSubmitProps> = ({ mySlips, loadingMy, submitting, onSubmit }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File must be under 5 MB.', false); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setSlipImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setSlipImage(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { showToast('Enter a valid amount.', false); return; }
    if (!slipImage) { showToast('Please attach a bank slip.', false); return; }
    const res = await onSubmit({ amount: Number(amount), bankName: bankName || undefined, slipImage });
    if (res.success) {
      showToast('Slip submitted successfully.', true);
      setAmount('');
      setBankName('');
      handleClear();
    } else {
      showToast(res.message || 'Submission failed.', false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Submit Form */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Submit Deposit Bank Slip</h3>
          <p className="text-xs text-slate-500 mt-0.5">Upload your bank slip for your parent to review and record the deposit.</p>
        </div>

        {toast && (
          <div className={`mx-6 mt-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${toast.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Deposit Amount (LKR) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-300">
                <span className="pl-3 pr-2 text-xs font-bold text-slate-400">LKR</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent py-2.5 pr-3 text-sm font-semibold text-slate-900 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bank Name (Optional)</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Commercial Bank"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Bank Slip <span className="text-red-500">*</span>
            </label>
            {slipImage ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800 truncate max-w-xs">{fileName}</span>
                </div>
                <button type="button" onClick={handleClear} className="text-emerald-600 hover:text-red-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-center hover:border-slate-300 hover:bg-slate-100 transition-colors"
              >
                <Upload className="mx-auto h-6 w-6 text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-600">Click to upload bank slip</p>
                <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG or PDF — max 5 MB</p>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold text-white uppercase tracking-wider hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>

      {/* My Submission History */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">My Submissions</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {loadingMy ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : mySlips.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">No submissions yet.</div>
          ) : (
            mySlips.map((slip) => {
              const cfg = STATUS_CONFIG[slip.status];
              const Icon = cfg.icon;
              return (
                <div key={slip.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${cfg.cls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{formatLKR(slip.amount)}</p>
                      <p className="text-xs text-slate-500">{slip.bankName || 'Bank not specified'} · {formatDate(slip.submittedAt)}</p>
                      {slip.rejectReason && (
                        <p className="mt-1 text-xs text-red-600 font-medium">Reason: {slip.rejectReason}</p>
                      )}
                      {slip.reviewedByName && slip.status !== 'pending' && (
                        <p className="text-xs text-slate-400">{slip.status === 'approved' ? 'Approved' : 'Reviewed'} by {slip.reviewedByName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                    <a
                      href={`http://localhost:3001${slip.slipUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      View Slip
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
