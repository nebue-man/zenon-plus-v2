import React, { useState, useEffect } from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import { useTeam } from '../../hooks/useTeam';
import { useTransactions } from '../../hooks/useTransactions';
import { useCommissions } from '../../hooks/useCommissions';
import { useVerifications } from '../../hooks/useVerifications';
import { useBankSlips } from '../../hooks/useBankSlips';
import { useAuth } from '../../context/useAuth';
import { SummaryCard } from '../../components/SummaryCard';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { Toast, ToastType } from '../../components/Toast';
import { InviteSection } from '../../components/InviteSection';
import { IDPhotoViewer } from '../../components/IDPhotoViewer';
import { BankSlipSubmit } from '../../components/BankSlipSubmit';
import { BankSlipQueue } from '../../components/BankSlipQueue';
import { EarningsChart } from '../../components/EarningsChart';
import { SubagentThresholdTable } from '../../components/SubagentThresholdTable';
import { AgentUnlockBanner } from '../../components/AgentUnlockBanner';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatLKR, formatDate, formatPercent } from '../../utils/format';
import { API_ENDPOINTS } from '../../utils/constants';
import api from '../../api/axios';
import {
  Coins,
  Users,
  CheckCircle,
  TrendingUp,
  Copy,
  Plus,
  ArrowRightLeft,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { TeamMember, Transaction, Commission, User } from '../../types';

interface AgentDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function AgentDashboard({ activeTab, setActiveTab }: AgentDashboardProps) {
  const { user: currentUser } = useAuth();
  
  // Custom metadata and auto-refresh summary structures
  const { data: metrics, unlockStatus, subagentThresholds, loading: mLoading, refresh: refreshSummary } = useDashboard();
  
  // Recruitment & Invitations
  const { data: teamMembers, generateInviteLink, loading: tLoading, refresh: refreshTeam } = useTeam();
  const inviteLink = generateInviteLink();

  // Scoped transactions
  const {
    data: txList,
    totalCount: txTotalCount,
    filters: txFilters,
    loading: txLoading,
    updateFilters: setTxFilters,
    recordTransaction,
    refresh: refreshTx,
  } = useTransactions();

  // Earned commissions register log
  const {
    data: commList,
    totalCount: commTotalCount,
    filters: commFilters,
    loading: commLoading,
    updateFilters: setCommFilters,
    refresh: refreshComm,
  } = useCommissions();

  // Pending Subagents review queue
  const {
    data: verifList,
    loading: verLoading,
    verifyUser,
    refresh: refreshVerifs,
  } = useVerifications();

  // Bank Slip Submit + Review Queue
  const { mySlips, reviewQueue: slipQueue, loadingMy: slipLoadingMy, loadingQueue: slipQueueLoading, submitting: slipSubmitting, reviewing: slipReviewing, submitSlip, reviewSlip } = useBankSlips();

  // Form notifications
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const showToast = (msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // Modal manual logging tx
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txTargetUserId, setTxTargetUserId] = useState('');
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txSubmitting, setTxSubmitting] = useState(false);

  // Verification Review process overlays
  const [verReviewUser, setVerReviewUser] = useState<User | null>(null);
  const [verStatus, setVerStatus] = useState<'approved' | 'rejected'>('approved');
  const [verRejectReason, setVerRejectReason] = useState('');
  const [verReasonOpen, setVerReasonOpen] = useState(false);
  const [verSubmitting, setVerSubmitting] = useState(false);

  // Copy link handler
  const handleCopyInvite = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    showToast('Recruitment invitation link copied to clipboard.', 'success');
  };

  // Submit recorded transactional logic
  const handleRecordTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTargetUserId || !txAmount || Number(txAmount) <= 0) {
      showToast('Please select a Sub-agent and positive numerical LKR value.', 'warning');
      return;
    }
    setTxSubmitting(true);
    try {
      const res = await recordTransaction({
        userId: txTargetUserId,
        type: txType,
        amount: Number(txAmount),
        date: txDate,
      });

      if (res.success) {
        showToast('Activity recorded. Downline volume triggers updated.', 'success');
        setIsTxModalOpen(false);
        setTxTargetUserId('');
        setTxAmount('');
        refreshSummary();
        refreshTx();
      } else {
        showToast(res.message || 'Error occurred booking transaction.', 'error');
      }
    } catch (err) {
      showToast('API network issue.', 'error');
    } finally {
      setTxSubmitting(false);
    }
  };

  // Verify sub-agent KYC files
  const handleVerifySubagentSubmit = async () => {
    if (!verReviewUser) return;
    if (verStatus === 'rejected' && !verRejectReason.trim()) {
      showToast('A rejection reason is mandatory.', 'warning');
      return;
    }
    setVerSubmitting(true);
    try {
      const res = await verifyUser(verReviewUser.id, verStatus, verRejectReason);
      if (res.success) {
        showToast(`Verification reviewed and saved.`, 'success');
        setVerReasonOpen(false);
        setVerReviewUser(null);
        setVerRejectReason('');
        refreshVerifs();
        refreshSummary();
      } else {
        showToast(res.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Failed to review due to network issues.', 'error');
    } finally {
      setVerSubmitting(false);
    }
  };

  // Safe checks for capacity and unlocking calculations
  const currentVolume = metrics?.agentMonthlyDepositTotal || 0;
  const isUnlocked = unlockStatus?.isUnlocked ?? metrics?.agentIsUnlocked ?? false;

  return (
    <div className="space-y-6">
      
      {toastMsg && <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />}

      {/* REQUIRED AGENT UNLOCK PROGRESS OVERLAY BANNER */}
      <AgentUnlockBanner status={unlockStatus} />

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Summary status row */}
          {mLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse bg-white border rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <SummaryCard
                title="This Month's Sub-agent Volume"
                value={formatLKR(currentVolume)}
                subtext={`Target LKR 100,000 for unlocking commissions`}
                icon={TrendingUp}
                iconColor="text-cyan-600 bg-cyan-50"
              />
              <SummaryCard
                title="Sub-agent Network Size"
                value={teamMembers.length}
                subtext="Sub-agents recruited (max 10 allowed)"
                icon={Users}
              />
              <SummaryCard
                title="Commissions Unlocked"
                value={formatLKR(metrics?.allTimeEarnings || 0)}
                subtext="Active generated commissions sums"
                icon={Coins}
                iconColor="text-emerald-600 bg-emerald-50"
              />
            </div>
          )}

          {/* Invitation Recruitment Section (Only visible if Agent is fully Unlocked & Active) */}
          {isUnlocked ? (
            <div className="rounded-xl border border-[#93C5FD] bg-[#EFF6FF] p-5 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-in slide-in-from-top-1 duration-200">
              <div className="space-y-1">
                <h4 className="font-bold text-blue-950 text-sm">Grow Your Sub-agent Hierarchy</h4>
                <p className="text-xs text-blue-800 leading-relaxed max-w-lg">
                  Congratulations! You're unlocked. Copy and share your direct team link to onboard up to 10 sub-agents.
                </p>
                {inviteLink && (
                  <p className="font-mono text-[11px] text-blue-700 bg-white border border-blue-100 p-1.5 rounded inline-block font-semibold">
                    {inviteLink}
                  </p>
                )}
              </div>

              <button
                onClick={handleCopyInvite}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-sm bg-[#0F172A] px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer uppercase tracking-wider"
              >
                <Copy className="h-4 w-4" /> Copy Recruit Link
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex gap-3 text-slate-650 text-xs shadow-sm">
              <Info className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
              <p>
                Recruitment links are locked. Secure <span className="font-bold text-slate-900">LKR 100,000</span> in downline deposits to generate invite links.
              </p>
            </div>
          )}

          {/* Subagent Threshold Triggers table */}
          <div>
            <div className="mb-4">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Sub-agent Volume Commission Indicators
              </h3>
              <p className="text-xs text-slate-450 mt-1">Active triggers: subagents with &gt;= 20,000 LKR deposits unlock 3% commission, else 2.5%.</p>
            </div>
            
            <SubagentThresholdTable thresholds={subagentThresholds} isLocked={!isUnlocked} />
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

      {/* MY TEAM TAB */}
      {activeTab === 'team' && (
        <div className="space-y-6 animate-in fade-in duration-200">

          <InviteSection userRole="agent" agentLocked={!isUnlocked} />

          <div className="border-t border-slate-200" />

          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-slate-950">My Sub-agent Network</h2>
            <p className="text-xs text-slate-500">
              Capacity tracking: Recruited <span className="font-semibold text-slate-900">{teamMembers.length}/10</span> direct Sub-agents.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {tLoading ? (
              <LoadingSpinner message="Evaluating sub-agents lists..." />
            ) : teamMembers.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-12 text-center bg-white">
                <Users className="mx-auto h-11 w-11 text-slate-350" />
                <h3 className="mt-4 text-sm font-semibold text-slate-900">Zero Recruits</h3>
                <p className="text-xs text-slate-400 mt-0.5">Invite new team members once unlocked.</p>
              </div>
            ) : (
              teamMembers.map((sub) => (
                <div key={sub.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900">{sub.fullName}</h4>
                        <p className="text-[10px] text-slate-404 font-mono">ID: {sub.id}</p>
                      </div>
                      <Badge type={sub.status} />
                    </div>

                    <div className="mt-4 space-y-2 text-xs divide-y divide-slate-100">
                      <div className="flex justify-between pt-1.5">
                        <span className="text-slate-400">Monthly Volume:</span>
                        <span className="font-mono font-bold text-slate-900">{formatLKR(sub.monthlyVolume)}</span>
                      </div>
                      <div className="flex justify-between pt-1.5">
                        <span className="text-slate-400">Commissions Sum:</span>
                        <span className="font-mono font-bold text-emerald-850">{formatLKR(sub.commissionsGenerated)}</span>
                      </div>
                      <div className="flex justify-between pt-1.5">
                        <span className="text-slate-400">Joined:</span>
                        <span className="font-mono text-slate-500">{formatDate(sub.joinedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {sub.status === 'pending' && (
                    <div className="mt-4 pt-3 border-t text-center">
                      <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2.5 py-1 rounded border border-amber-100">
                        Awaiting KYC Approval
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">Deposits / Withdrawals</p>
              <h2 className="text-xl font-bold text-slate-950">Subagents Transaction Ledger</h2>
            </div>

            <button
              onClick={() => setIsTxModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" /> Book Transaction
            </button>
          </div>

          {/* Bank slip submission form + history */}
          <BankSlipSubmit
            mySlips={mySlips}
            loadingMy={slipLoadingMy}
            submitting={slipSubmitting}
            onSubmit={submitSlip}
          />

          {/* Bank Slip Review Queue — subagents' pending slips awaiting agent approval */}
          <BankSlipQueue
            queue={slipQueue}
            loading={slipQueueLoading}
            reviewing={slipReviewing}
            onReview={reviewSlip}
          />

          {/* Filters shelf */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Search Subagent</label>
              <input
                type="text"
                placeholder="Type name or ID..."
                value={txFilters.search || ''}
                onChange={(e) => setTxFilters({ search: e.target.value, page: 1 })}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Movement Type</label>
              <select
                value={txFilters.type || ''}
                onChange={(e) => setTxFilters({ type: e.target.value as any, page: 1 })}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="">All transactions</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
            </div>
          </div>

          {/* Table index list */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] table-auto border-collapse text-left text-sm text-slate-655 font-medium">
                <thead>
                  <tr className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">Transaction ID</th>
                    <th className="py-3 px-4">Subagent Name</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4">Amount LKR</th>
                    <th className="py-3 px-6">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txLoading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="py-5 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : txList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-450 italic font-mono">
                        No transactions registered matching criteria.
                      </td>
                    </tr>
                  ) : (
                    txList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-mono text-xs text-slate-404">{tx.id}</td>
                        <td className="py-4 px-4 font-semibold text-slate-850">{tx.userName}</td>
                        <td className="py-4 px-4"><Badge type={tx.type} /></td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">{formatLKR(tx.amount)}</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">{formatDate(tx.date, true)}</td>
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

      {/* COMMISSIONS LEDGER TAB */}
      {activeTab === 'commissions' && (
        <div className="space-y-6 animate-in fade-in duration-205">
          
          <div>
            <p className="text-xs text-slate-450 font-bold uppercase tracking-wider">Profits Tracker</p>
            <h2 className="text-xl font-bold text-slate-950">Commissions Activity Logs</h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-in">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] table-auto border-collapse text-left text-sm text-slate-655 font-medium">
                <thead>
                  <tr className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">Trigger Subagent</th>
                    <th className="py-3 px-4">Commission Type</th>
                    <th className="py-3 px-4">Percentage</th>
                    <th className="py-3 px-4">Profit LKR</th>
                    <th className="py-3 px-4">Status Check</th>
                    <th className="py-3 px-6">Date Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="py-5 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : commList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-450 italic">No commissions logged.</td>
                    </tr>
                  ) : (
                    commList.map((comm) => (
                      <tr key={comm.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-semibold text-slate-800">{comm.sourceName}</td>
                        <td className="py-4 px-4 font-mono text-xs uppercase text-slate-504">{comm.type.replace(/_/g, ' ')}</td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-650">{formatPercent(comm.percentage)}</td>
                        <td className="py-4 px-4 font-mono font-extrabold text-slate-950">{formatLKR(comm.amount)}</td>
                        <td className="py-4 px-4">
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 uppercase font-mono">UNLOCKED</span>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">{formatDate(comm.date, true)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={commFilters.page}
              totalCount={commTotalCount}
              pageSize={commFilters.limit}
              onPageChange={(p) => setCommFilters({ page: p })}
            />
          </div>

        </div>
      )}

      {/* VERIFICATIONS queue TAB */}
      {activeTab === 'verifications' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <h2 className="text-xl font-bold text-slate-950">Verify Subagents identity ({verifList.length})</h2>
            <p className="text-xs text-slate-500 mt-0.5">Authorise registered Subagents directly join inside your recruited team hierarchy.</p>
          </div>

          {verLoading ? (
            <LoadingSpinner message="Evaluating pending subagents..." />
          ) : verifList.length === 0 ? (
            <div className="rounded-xl border border-dashed text-center p-12 bg-white">
              <CheckCircle className="h-10 w-10 text-slate-350 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-909 mt-2">Queue Clear</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-in">
              {verifList.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.fullName}</h4>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">ID: {item.id} • Registered: {formatDate(item.submittedDate)}</p>

                    <div className="mt-4">
                      <span className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">DOC:</span>
                      <div className="mt-1">
                        <IDPhotoViewer photoUrl={item.idPhoto} altText="Subagent ID Preview" isThumbnail={true} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t flex justify-end gap-2.5">
                    <button
                      onClick={() => {
                        setVerReviewUser({ id: item.id, fullName: item.fullName, role: item.role, status: 'pending', childrenCount: 0, joinedAt: '' });
                        setVerStatus('approved');
                        setVerReasonOpen(true);
                      }}
                      className="rounded bg-emerald-55 text-emerald-800 border px-3 py-1 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setVerReviewUser({ id: item.id, fullName: item.fullName, role: item.role, status: 'pending', childrenCount: 0, joinedAt: '' });
                        setVerStatus('rejected');
                        setVerReasonOpen(true);
                      }}
                      className="rounded bg-rose-50 text-rose-700 px-3 py-1 text-xs font-bold border hover:bg-rose-100 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* CREATE MANUAL TX MODAL */}
      <Modal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} title="Record Subagent activity log">
        <form className="space-y-4" onSubmit={handleRecordTx}>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Select direct verified Subagent</label>
            <select
              required
              value={txTargetUserId}
              onChange={(e) => setTxTargetUserId(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800"
            >
              <option value="">-- Choose verified Subagent --</option>
              {teamMembers.filter(m => m.status === 'approved').map(u => (
                <option key={u.id} value={u.id}>{u.fullName} (SUBAGENT - {u.id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Movement Type</label>
            <div className="flex bg-slate-50 border rounded-md p-1">
              <button
                type="button"
                onClick={() => setTxType('deposit')}
                className={`flex-1 py-1.5 rounded text-xs font-bold uppercase transition ${
                  txType === 'deposit' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => setTxType('withdrawal')}
                className={`flex-1 py-1.5 rounded text-xs font-bold uppercase transition ${
                  txType === 'withdrawal' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Withdrawal
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Amount LKR</label>
            <div className="relative rounded-md shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-xs font-semibold">LKR</span>
              </div>
              <input
                type="number"
                required
                min={1}
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="10000"
                className="block w-full rounded-lg border border-slate-300 pl-11 pr-3 py-2 text-sm text-slate-800 font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Date</label>
            <input
              type="date"
              required
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 p-2 text-sm font-mono text-slate-850"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsTxModalOpen(false)}
              className="rounded-lg border px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={txSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {txSubmitting ? 'Recording...' : 'Record logs'}
            </button>
          </div>
        </form>
      </Modal>

      {/* KYC review reason dialog */}
      <Modal isOpen={verReasonOpen} onClose={() => setVerReasonOpen(false)} title="Verify subagent ID">
        {verReviewUser && (
          <div className="space-y-4">
            <p className="text-sm text-slate-650">
              Confirm KYC update decision for <span className="font-bold text-slate-900">{verReviewUser.fullName}</span> to: <Badge type={verStatus} />
            </p>

            {verStatus === 'rejected' && (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-405 mb-1">Rejection reason *</label>
                <textarea
                  required
                  rows={3}
                  value={verRejectReason}
                  onChange={(e) => setVerRejectReason(e.target.value)}
                  placeholder="ID photo is cut-off or blurry."
                  className="block w-full p-2 text-sm rounded border outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setVerReasonOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={handleVerifySubagentSubmit}
                disabled={verSubmitting}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${verStatus === 'approved' ? 'bg-emerald-600' : 'bg-rose-600'}`}
              >
                {verSubmitting ? 'Recording...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
