import React, { useState, useEffect } from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import { useTransactions } from '../../hooks/useTransactions';
import { useBankSlips } from '../../hooks/useBankSlips';
import { useAuth } from '../../context/useAuth';
import { SummaryCard } from '../../components/SummaryCard';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { EarningsChart } from '../../components/EarningsChart';
import { Toast, ToastType } from '../../components/Toast';
import { InviteSection } from '../../components/InviteSection';
import { IDPhotoViewer } from '../../components/IDPhotoViewer';
import { BankSlipSubmit } from '../../components/BankSlipSubmit';
import { formatLKR, formatDate, formatPercent } from '../../utils/format';
import { API_ENDPOINTS } from '../../utils/constants';
import api from '../../api/axios';
import {
  Coins,
  TrendingUp,
  FileCheck,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';

interface SubagentDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function SubagentDashboard({ activeTab, setActiveTab }: SubagentDashboardProps) {
  const { user, refreshUser } = useAuth();
  
  // Custom hooks for metrics & historical transactions
  const { data: metrics, loading: mLoading, refresh: refreshSummary } = useDashboard();
  const {
    data: txList,
    totalCount: txTotalCount,
    filters: txFilters,
    loading: txLoading,
    updateFilters: setTxFilters,
    refresh: refreshTx,
  } = useTransactions();

  // Bank Slip Submit
  const { mySlips, loadingMy: slipLoadingMy, submitting: slipSubmitting, submitSlip } = useBankSlips();

  // Re-upload state if previously rejected
  const [newIdPhoto, setNewIdPhoto] = useState<string | null>(null);
  const [newIdPhotoName, setNewIdPhotoName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [reSubmitting, setReSubmitting] = useState(false);

  // Form notifications
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const showToast = (msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // Convert uploaded photo to base64
  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      showToast('Only JPG, PNG and PDF files are accepted.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNewIdPhoto(reader.result as string);
      setNewIdPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
  };

  // Execute re-submission of rejected ID
  const handleReSubmitId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdPhoto) {
      showToast('Please select a photograph document first.', 'warning');
      return;
    }
    setReSubmitting(true);
    try {
      const res = await api.patch(API_ENDPOINTS.auth.resubmitId, { idPhoto: newIdPhoto });
      if (res.data?.success) {
        showToast('Identification file was re-submitted for review.', 'success');
        setNewIdPhoto(null);
        setNewIdPhotoName('');
        // Refresh session statuses
        await refreshUser();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error uploading file.', 'error');
    } finally {
      setReSubmitting(false);
    }
  };

  // Calculations for tier commission trigger (20,000 LKR)
  const currentMonthVolume = metrics?.subagentMonthlyDepositTotal || 0;
  const thresholdValue = 20000;
  const progressPercent = Math.min(100, Math.floor((currentMonthVolume / thresholdValue) * 100));
  const currentCommRate = currentMonthVolume >= thresholdValue ? 3.0 : 2.5;

  return (
    <div className="space-y-6">
      
      {toastMsg && <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Status summaries */}
          {mLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse bg-white border rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <SummaryCard
                title="This Month's Deposits"
                value={formatLKR(currentMonthVolume)}
                subtext={`Next tier trigger: ${formatPercent(currentCommRate)} commissions rate`}
                icon={TrendingUp}
                iconColor="text-indigo-600 bg-indigo-50"
              />
              <SummaryCard
                title="Current Commission Rate"
                value={`${formatPercent(currentCommRate)}%`}
                subtext={currentMonthVolume >= thresholdValue ? 'Bonus unlocked! (>= 20k LKR)' : 'Standard rate (< 20k LKR)'}
                icon={FileCheck}
                iconColor="text-emerald-600 bg-emerald-50"
              />
              <SummaryCard
                title="Month's Earned Commissions"
                value={formatLKR(metrics?.allTimeEarnings || 0)}
                subtext="Direct earnings deposit payouts"
                icon={Coins}
                iconColor="text-cyan-600 bg-cyan-50"
              />
            </div>
          )}

          {/* Rate Tracker trigger bar */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex justify-between items-center mb-2.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">
              <span>Commission Rate Tier Progress: LKR {formatLKR(currentMonthVolume)} / LKR 20,000</span>
              <span className="text-indigo-600 font-bold">{progressPercent}%</span>
            </div>

            {/* Meter Bar */}
            <div className="h-2 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressPercent >= 100 ? 'bg-[#10B981]' : 'bg-[#3B82F6]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-[11px] text-[#64748B] mt-3 leading-relaxed">
              {progressPercent >= 100 ? (
                <span className="text-[#166534] font-bold">✓ Congratulations! Your volume has exceeded the LKR 20,000 trigger threshold. Your current deposit commission rate is 3.0%.</span>
              ) : (
                <span>Increase monthly deposits by LKR <span className="font-bold text-[#0F172A]">{formatLKR(thresholdValue - currentMonthVolume)}</span> to trigger a <span className="font-bold text-[#0F172A]">3.0% commission rate</span> instead of the standard 2.5%.</span>
              )}
            </p>
          </div>

          {/* 30 Day earnings timeline */}
          <div className="mt-8">
            <EarningsChart
              type="line"
              data={metrics?.earningsTrend || []}
              title="Individual Earnings History Timeline (LKR)"
            />
          </div>

        </div>
      )}

      {/* TRANSACTION HISTORY */}
      {activeTab === 'transactions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">Subagent Log</p>
            <h2 className="text-xl font-bold text-slate-950">My Deposits &amp; Withdrawals</h2>
          </div>

          {/* Bank slip submission form + history */}
          <BankSlipSubmit
            mySlips={mySlips}
            loadingMy={slipLoadingMy}
            submitting={slipSubmitting}
            onSubmit={submitSlip}
          />

          {/* Filter Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase">Type:</span>
              <select
                value={txFilters.type || ''}
                onChange={(e) => setTxFilters({ type: e.target.value as any, page: 1 })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-705"
              >
                <option value="">All Transactions</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
            </div>
          </div>

          {/* Table list */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] table-auto border-collapse text-left text-sm text-slate-655 font-medium animate-in">
                <thead>
                  <tr className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">Transaction ID</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4">Calculated Amount</th>
                    <th className="py-3 px-6">Booking Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={4} className="py-5 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : txList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-450 italic font-mono">
                        No recorded transactions matching filters.
                      </td>
                    </tr>
                  ) : (
                    txList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-mono text-xs text-slate-404">{tx.id}</td>
                        <td className="py-4 px-4"><Badge type={tx.type} /></td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">{formatLKR(tx.amount)}</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-550">{formatDate(tx.date, true)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={txFilters.page}
              totalCount={txTotalCount}
              pageSize={txFilters.limit}
              onPageChange={(p) => setTxFilters({ page: p })}
            />
          </div>

        </div>
      )}

      {/* MY TEAM TAB */}
      {activeTab === 'team' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-xl font-bold text-slate-950">My Team</h2>
            <p className="text-xs text-slate-500 mt-0.5">Invite new sub-agents to grow your network.</p>
          </div>
          <InviteSection userRole="subagent" />
        </div>
      )}

      {/* VERIFICATIONS TAB (Self status check + resubmit) */}
      {activeTab === 'verifications' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <h2 className="text-xl font-bold text-slate-950">Identity Verification Status</h2>
            <p className="text-xs text-slate-500">View safety status checks regarding your registered ID file worksheets.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            
            {/* Left status badge sheet */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b pb-2.5Select-none">My Account Status</h3>
                
                <div className="mt-4 space-y-4 text-xs font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Status:</span>
                    <Badge type={user?.status || 'approved'} />
                  </div>
                  
                  {user?.status === 'pending' && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3.5 text-blue-800 leading-relaxed">
                      "Your account details are awaiting ID document inspection review. Your parent agent/manager will process this shortly."
                    </div>
                  )}

                  {user?.status === 'rejected' && (
                    <div className="rounded-lg bg-rose-50 border border-rose-100 p-3.5 text-rose-800 font-semibold space-y-1">
                      <p className="flex items-center gap-1.5 uppercase text-[10px] text-rose-950 font-bold leading-none">
                        <AlertTriangle className="h-4 w-4 text-rose-650" /> Rejected KYC review
                      </p>
                      <p className="text-xs text-rose-700 leading-relaxed font-normal mt-1">
                        Reason: "{user.rejectReason || 'Identity photograph was Blur or eligible documents not matched.'}"
                      </p>
                    </div>
                  )}

                  {user?.status === 'approved' && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3.5 text-emerald-800 font-medium">
                      ✓ Your onboarding dossier is approved. All commission calculations, downline metrics, and operations are active.
                    </div>
                  )}
                </div>
              </div>

              {user?.idPhoto && (
                <div className="mt-6 pt-4 border-t">
                  <span className="text-[10px] font-bold uppercase text-slate-450 block mb-2 leading-none">Active Document File:</span>
                  <div className="max-w-[130px]">
                    <IDPhotoViewer photoUrl={user.idPhoto} altText="Active KYC documentation" isThumbnail={true} />
                  </div>
                </div>
              )}
            </div>

            {/* Right Resubmit form (Only visible if status is rejected) */}
            {user?.status === 'rejected' && (
              <div className="rounded-xl border border-slate-205 bg-white p-6 shadow-xs animate-in duration-300">
                <h3 className="text-sm font-bold text-slate-905 border-b pb-2.5 uppercase tracking-wide">
                  Re-submit ID Photograph
                </h3>
                
                <form className="mt-4 space-y-4 font-sans" onSubmit={handleReSubmitId}>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition ${
                      dragActive
                        ? 'border-blue-500 bg-blue-50/10'
                        : newIdPhoto
                        ? 'border-emerald-300 bg-emerald-50/5'
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100/60'
                    }`}
                  >
                    {newIdPhoto ? (
                      <div className="flex flex-col items-center gap-2">
                        {newIdPhoto.startsWith('data:image') ? (
                          <div className="h-20 w-32 overflow-hidden rounded border border-slate-150">
                            <img src={newIdPhoto} referrerPolicy="no-referrer" alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <ImageIcon className="h-6 w-6 text-slate-400" />
                        )}
                        <span className="text-xs text-slate-600 font-bold">{newIdPhotoName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewIdPhoto(null);
                            setNewIdPhotoName('');
                          }}
                          className="text-[10px] font-bold text-rose-500 hover:underline"
                        >
                          Clear file
                        </button>
                      </div>
                    ) : (
                      <div className="text-center font-semibold">
                        <Upload className="mx-auto h-7 w-7 text-slate-400" />
                        <p className="mt-1 text-xs text-slate-650">
                          Drag and drop or{' '}
                          <label className="cursor-pointer text-blue-600 hover:underline font-bold">
                            <span>browse files</span>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.pdf"
                              className="sr-only"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                              }}
                            />
                          </label>
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={reSubmitting || !newIdPhoto}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-450 transition cursor-pointer"
                  >
                    {reSubmitting ? 'Uploading file...' : 'Re-submit for verification'}
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
