import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../hooks/useDashboard';
import { useTeam } from '../../hooks/useTeam';
import { useTransactions } from '../../hooks/useTransactions';
import { useCommissions } from '../../hooks/useCommissions';
import { useVerifications } from '../../hooks/useVerifications';
import { useBankSlips } from '../../hooks/useBankSlips';
import { SummaryCard } from '../../components/SummaryCard';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { IDPhotoViewer } from '../../components/IDPhotoViewer';
import { BankSlipSubmit } from '../../components/BankSlipSubmit';
import { BankSlipQueue } from '../../components/BankSlipQueue';
import { EarningsChart } from '../../components/EarningsChart';
import { Toast, ToastType } from '../../components/Toast';
import { InviteSection } from '../../components/InviteSection';
import { formatLKR, formatDate, formatPercent } from '../../utils/format';
import { API_ENDPOINTS } from '../../utils/constants';
import api from '../../api/axios';
import {
  Coins,
  Users,
  CheckCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Plus,
  ArrowRightLeft,
  X,
  SlidersHorizontal,
  Info,
  Upload,
} from 'lucide-react';
import { TeamMember, Transaction, Commission, User } from '../../types';

interface ManagerDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function ManagerDashboard({ activeTab, setActiveTab }: ManagerDashboardProps) {
  const navigate = useNavigate();
  // Main dashboard API metrics
  const { data: metrics, loading: mLoading, refresh: refreshSummary } = useDashboard();
  
  // Team Hook
  const { data: teamMembers, loading: tLoading, refresh: refreshTeam } = useTeam();

  // Transactions Hook (scoped to team)
  const {
    data: txList,
    totalCount: txTotalCount,
    filters: txFilters,
    loading: txLoading,
    updateFilters: setTxFilters,
    recordTransaction,
    refresh: refreshTx,
  } = useTransactions();

  // Commissions Hook (individual)
  const {
    data: commList,
    totalCount: commTotalCount,
    filters: commFilters,
    loading: commLoading,
    updateFilters: setCommFilters,
    refresh: refreshComm,
  } = useCommissions();

  // Verifications Hook (reviews agent signups)
  const {
    data: verifList,
    loading: verLoading,
    verifyUser,
    refresh: refreshVerifs,
  } = useVerifications();

  // Bank Slip Submit + Review Queue
  const { mySlips, reviewQueue: slipQueue, loadingMy: slipLoadingMy, loadingQueue: slipQueueLoading, submitting: slipSubmitting, reviewing: slipReviewing, submitSlip, reviewSlip } = useBankSlips();

  // Local notifications states
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const showToast = (msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // State: Expanded agent ID to view deep subagents downlines
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [subagentsLog, setSubagentsLog] = useState<TeamMember[]>([]);
  const [subagentsLoading, setSubagentsLoading] = useState(false);

  // Modal: Create Manual downline booking state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txPlayerId, setTxPlayerId] = useState('');
  const [txBankSlip, setTxBankSlip] = useState<string | null>(null);
  const [txBankSlipName, setTxBankSlipName] = useState('');
  const [txBankSlipDrag, setTxBankSlipDrag] = useState(false);
  const [txWithdrawalCode, setTxWithdrawalCode] = useState('');
  const [txWithdrawalBank, setTxWithdrawalBank] = useState('');
  const [txWithdrawalBranch, setTxWithdrawalBranch] = useState('');
  const [txWithdrawalAccount, setTxWithdrawalAccount] = useState('');
  const [txSubmitting, setTxSubmitting] = useState(false);

  // Verifications states
  const [verReviewUser, setVerReviewUser] = useState<User | null>(null);
  const [verStatus, setVerStatus] = useState<'approved' | 'rejected'>('approved');
  const [verRejectReason, setVerRejectReason] = useState('');
  const [verReasonOpen, setVerReasonOpen] = useState(false);
  const [verSubmitting, setVerSubmitting] = useState(false);

  // Deep Sub-agents loader accordion trigger
  const handleToggleAgentAccordion = async (agentId: string) => {
    if (expandedAgentId === agentId) {
      setExpandedAgentId(null);
      return;
    }
    setExpandedAgentId(agentId);
    setSubagentsLoading(true);
    try {
      const response = await api.get(API_ENDPOINTS.hierarchy.downline(agentId));
      if (response.data?.success) {
        setSubagentsLog(response.data.data || []);
      }
    } catch (err) {
      console.error(err);
      setSubagentsLog([]);
    } finally {
      setSubagentsLoading(false);
    }
  };

  // Submit manual transaction record
  const handleBankSlipChange = (file: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      showToast('Only JPG, PNG, WebP, and PDF files are accepted for bank slips.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setTxBankSlip(reader.result as string); setTxBankSlipName(file.name); };
    reader.readAsDataURL(file);
  };

  const handleRecordTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0) {
      showToast('Please supply a positive amount.', 'warning');
      return;
    }
    if (txType === 'deposit' && !txPlayerId.trim()) {
      showToast('Player ID is required for deposits.', 'warning');
      return;
    }
    if (txType === 'deposit' && !txBankSlip) {
      showToast('Please upload your bank slip to continue.', 'warning');
      return;
    }
    if (txType === 'withdrawal' && (!txWithdrawalCode.trim() || !txWithdrawalBank.trim() || !txWithdrawalBranch.trim() || !txWithdrawalAccount.trim())) {
      showToast('Please fill in all withdrawal details (code, bank, branch, account number).', 'warning');
      return;
    }
    setTxSubmitting(true);
    try {
      const res = await recordTransaction({
        type: txType,
        amount: Number(txAmount),
        date: txDate,
        ...(txType === 'deposit' ? { player_id: txPlayerId, bank_slip: txBankSlip! } : {}),
        ...(txType === 'withdrawal' ? {
          withdrawal_details: {
            withdrawal_code: txWithdrawalCode,
            bank: txWithdrawalBank,
            branch: txWithdrawalBranch,
            account_number: txWithdrawalAccount,
          },
        } : {}),
      });

      if (res.success) {
        showToast('Transaction logged. Commissions triggered.', 'success');
        setIsTxModalOpen(false);
        setTxAmount('');
        setTxPlayerId('');
        setTxBankSlip(null);
        setTxBankSlipName('');
        setTxWithdrawalCode('');
        setTxWithdrawalBank('');
        setTxWithdrawalBranch('');
        setTxWithdrawalAccount('');
        refreshSummary();
        refreshTx();
      } else {
        showToast(res.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Network error recorded.', 'error');
    } finally {
      setTxSubmitting(false);
    }
  };

  // Approve/reject verifications queue actions
  const handleVerReviewSubmit = async () => {
    if (!verReviewUser) return;
    if (verStatus === 'rejected' && !verRejectReason.trim()) {
      showToast('A rejection reason is required.', 'warning');
      return;
    }
    setVerSubmitting(true);
    try {
      const response = await verifyUser(verReviewUser.id, verStatus, verRejectReason);
      if (response.success) {
        showToast(`KYC review has been submitted as ${verStatus}.`, 'success');
        setVerReasonOpen(false);
        setVerReviewUser(null);
        setVerRejectReason('');
        refreshVerifs();
        refreshSummary();
      } else {
        showToast(response.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Failed to review due to network issues.', 'error');
    } finally {
      setVerSubmitting(false);
    }
  };

  // Calculate percentage ratios for earnings breakdown donut
  const getBreakdownData = () => {
    return [
      { name: 'Own Activity', value: metrics?.earningsFromOwn || 0 },
      { name: 'Direct Agents', value: metrics?.earningsFromDirect || 0 },
      { name: 'Deeper team', value: metrics?.earningsFromDeep || 0 },
    ].filter(v => v.value > 0);
  };

  const breakdownData = getBreakdownData();

  return (
    <div className="space-y-6">
      
      {toastMsg && <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Summary stats widgets row */}
          {mLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse bg-white border rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="This Month's Earnings"
                value={formatLKR(metrics?.earningsFromDirect || 0)} // Manager's monthly commission
                subtext={`Target from your recruitment downline`}
                icon={TrendingUp}
                iconColor="text-emerald-600 bg-emerald-50"
              />
              <SummaryCard
                title="Management Team Size"
                value={teamMembers.length}
                subtext="Total direct recruited Agents"
                icon={Users}
              />
              <SummaryCard
                title="Pending Verifications"
                value={verifList.length}
                subtext="Requires document inspection review"
                icon={CheckCircle}
                iconColor={verifList.length > 0 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-slate-400 bg-slate-50"}
              />
              <SummaryCard
                title="All-Time commissions"
                value={formatLKR(metrics?.allTimeEarnings || 0)}
                subtext="Cumulative commissions aggregate"
                icon={Coins}
                iconColor="text-blue-600 bg-blue-50"
              />
            </div>
          )}

          {/* Core Analytics Visualizations */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Earnings line chart timeline (last 30 days) */}
            <div className="lg:col-span-8">
              <EarningsChart
                type="line"
                data={metrics?.earningsTrend || []}
                title="30-day Daily Earnings Trend (LKR)"
              />
            </div>

            {/* Income Streams Donut details */}
            <div className="lg:col-span-4 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold tracking-wider uppercase text-[#64748B] border-b border-[#E2E8F0] pb-2">
                  Revenue Streams Breakdown
                </h3>
                <div className="mt-4 flex items-center justify-center">
                  {breakdownData.length === 0 ? (
                    <div className="text-slate-400 text-xs italic font-mono py-12">No earnings stream configured yet.</div>
                  ) : (
                    <EarningsChart type="pie" data={breakdownData} height={200} />
                  )}
                </div>
              </div>

              {/* Legend with currency values */}
              <div className="border-t border-[#E2E8F0] pt-4 divide-y divide-[#F1F5F9] text-xs text-[#64748B]">
                <div className="flex justify-between py-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0F172A]" /> From Own:</span>
                  <span className="font-mono text-[#0F172A] font-bold">{formatLKR(metrics?.earningsFromOwn || 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Direct Agents:</span>
                  <span className="font-mono text-[#0F172A] font-bold">{formatLKR(metrics?.earningsFromDirect || 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-medium">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#10B981]" /> Deeper Team:</span>
                  <span className="font-mono text-[#0F172A] font-bold">{formatLKR(metrics?.earningsFromDeep || 0)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Recent core activity logged (last 5 records) */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-5">
              Team Recent Activity Bookings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] table-auto border-collapse text-left text-xs text-slate-650">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold tracking-wider uppercase text-[10px]">
                    <th className="py-2.5">User</th>
                    <th className="py-2.5">Role</th>
                    <th className="py-2.5">Type badge</th>
                    <th className="py-2.5">Amount LKR</th>
                    <th className="py-2.5 text-right">Timestamp Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {metrics?.recentTransactions && metrics.recentTransactions.length > 0 ? (
                    metrics.recentTransactions.slice(0, 5).map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-semibold text-slate-800">{tx.userName}</td>
                        <td className="py-3"><Badge type={tx.userRole} /></td>
                        <td className="py-3"><Badge type={tx.type} /></td>
                        <td className="py-3 font-mono font-bold text-slate-900">{formatLKR(tx.amount)}</td>
                        <td className="py-3 text-right font-mono text-slate-400">{formatDate(tx.date)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 font-mono italic">
                        No transactions registered in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MY TEAM TAB */}
      {activeTab === 'team' && (
        <div className="space-y-6 animate-in fade-in duration-200">

          <InviteSection userRole="manager" />

          <div className="border-t border-slate-200" />

          <div>
            <h2 className="text-xl font-bold text-slate-950">My Direct Agents Downline</h2>
            <p className="text-xs text-slate-500 mt-0.5">Managers are assigned up to 5 direct agents only. Click expand button to inspect agent sub-agent members recursively.</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {tLoading ? (
              <LoadingSpinner message="Evaluating downline agent nodes..." />
            ) : teamMembers.length === 0 ? (
              <div className="rounded-xl border border-dashed text-center p-12 bg-white">
                <Users className="h-10 w-10 text-slate-350 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-905 mt-2">No agents Recruited</h3>
              </div>
            ) : (
              teamMembers.map((agent) => {
                const isExpanded = expandedAgentId === agent.id;
                return (
                  <div key={agent.id} className="rounded-xl border border-slate-205 bg-white p-5 shadow-xs">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-950 text-base">{agent.fullName}</h4>
                          <Badge type={agent.status} />
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {agent.id} • Joined: {formatDate(agent.joinedAt)}</p>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-medium">
                        <div className="text-right">
                          <p className="text-slate-400">Monthly turn-over volume</p>
                          <p className="font-mono font-bold text-slate-950 text-sm mt-0.5">{formatLKR(agent.monthlyVolume)}</p>
                        </div>
                        <div className="text-right border-l border-slate-100 pl-4">
                          <p className="text-slate-400">Cumulative payout generated</p>
                          <p className="font-mono font-bold text-emerald-800 text-sm mt-0.5">{formatLKR(agent.commissionsGenerated)}</p>
                        </div>

                        <button
                          onClick={() => handleToggleAgentAccordion(agent.id)}
                          className="ml-2 rounded-lg border p-2 hover:bg-slate-50 text-slate-655 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <span className="font-semibold text-xs">View Sub-agents ({agent.childrenCount})</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible deeper accordion list */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                        <h5 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-3 select-none">
                          Deeps Recruited Sub-agents list:
                        </h5>
                        
                        {subagentsLoading ? (
                          <div className="h-10 animate-pulse bg-slate-50 rounded" />
                        ) : subagentsLog.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">This agent hasn't recruited any sub-agents yet.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-100 bg-slate-50/50">
                            <table className="w-full text-left text-xs text-slate-600 border-collapse">
                              <thead>
                                <tr className="border-b bg-slate-50 font-bold uppercase text-[10px] text-slate-400">
                                  <th className="py-2.5 px-4">Sub-agent Name</th>
                                  <th className="py-2.5 px-4">User ID</th>
                                  <th className="py-2.5 px-4">KYC Review</th>
                                  <th className="py-2.5 px-4">Monthly deposits</th>
                                  <th className="py-2.5 px-4 text-right">Joined date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {subagentsLog.map((sa) => (
                                  <tr key={sa.id} className="hover:bg-slate-100/40">
                                    <td className="py-3 px-4 font-semibold text-slate-850">{sa.fullName}</td>
                                    <td className="py-3 px-4 font-mono text-slate-450">{sa.id}</td>
                                    <td className="py-3 px-4"><Badge type={sa.status} /></td>
                                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{formatLKR(sa.monthlyVolume)}</td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-400">{formatDate(sa.joinedAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* SCOPED TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">Sub-Network Activity</p>
              <h2 className="text-xl font-bold text-slate-950">Downline Transaction Log</h2>
            </div>
            
            <button
              onClick={() => setIsTxModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" /> Book Transaction
            </button>
          </div>

          {/* Filters shelf */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">Operation Type</label>
              <select
                value={txFilters.type || ''}
                onChange={(e) => setTxFilters({ type: e.target.value as any, page: 1 })}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="">All operations</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
            </div>
            
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400">Search downline user</label>
              <input
                type="text"
                placeholder="Type Name or ID..."
                value={txFilters.search || ''}
                onChange={(e) => setTxFilters({ search: e.target.value, page: 1 })}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              />
            </div>
          </div>

          {/* Bank slip submission form + history */}
          <BankSlipSubmit
            mySlips={mySlips}
            loadingMy={slipLoadingMy}
            submitting={slipSubmitting}
            onSubmit={submitSlip}
          />

          {/* Bank Slip Review Queue — agents' pending slips awaiting manager approval */}
          <BankSlipQueue
            queue={slipQueue}
            loading={slipQueueLoading}
            reviewing={slipReviewing}
            onReview={reviewSlip}
          />

          {/* Scoped list */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] table-auto border-collapse text-left text-sm text-slate-650">
                <thead>
                  <tr className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">Transaction ID</th>
                    <th className="py-3 px-4">Affiliate</th>
                    <th className="py-3 px-4">Downline role</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txLoading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="py-5 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : txList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-mono italic">
                        No downline transactions recorded.
                      </td>
                    </tr>
                  ) : (
                    txList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-mono text-xs text-slate-400">{tx.id}</td>
                        <td className="py-4 px-4 font-semibold text-slate-800">{tx.userName}</td>
                        <td className="py-4 px-4"><Badge type={tx.userRole} /></td>
                        <td className="py-4 px-4"><Badge type={tx.type} /></td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">{formatLKR(tx.amount)}</td>
                        <td className="py-4 px-6 font-mono text-slate-500 text-xs">{formatDate(tx.date, true)}</td>
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

      {/* INDIVIDUAL COMMISSIONS */}
      {activeTab === 'commissions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Earnings Register</p>
            <h2 className="text-xl font-bold text-slate-950">My Commissions Ledger</h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] table-auto border-collapse text-left text-sm text-slate-650">
                <thead>
                  <tr className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">Trigger Downline</th>
                    <th className="py-3 px-4">Commission Type</th>
                    <th className="py-3 px-4">Percentage</th>
                    <th className="py-3 px-4">Calculated Profit</th>
                    <th className="py-3 px-6Text-right">Date Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="py-5 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : commList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-450">
                        No commissions logged.
                      </td>
                    </tr>
                  ) : (
                    commList.map((comm) => (
                      <tr key={comm.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 font-semibold text-slate-800">{comm.sourceName}</td>
                        <td className="py-4 px-4 font-mono text-slate-500 uppercase text-xs">{comm.type.replace(/_/g, ' ')}</td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-803">{formatPercent(comm.percentage)}</td>
                        <td className="py-4 px-4 font-mono font-extrabold text-slate-950">{formatLKR(comm.amount)}</td>
                        <td className="py-4 px-6 text-right font-mono text-xs text-slate-500">{formatDate(comm.date, true)}</td>
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

      {/* AGENT ID VERIFICATIONS */}
      {activeTab === 'verifications' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <h2 className="text-xl font-bold text-slate-950">Pending Agent ID Verifications ({verifList.length})</h2>
            <p className="text-xs text-slate-500 mt-0.5">Review and authorize Agent roles recruited under your Manager account.</p>
          </div>

          {verLoading ? (
            <LoadingSpinner message="Checking team registration files..." />
          ) : verifList.length === 0 ? (
            <div className="rounded-xl border border-dashed text-center p-12 bg-white">
              <CheckCircle className="h-10 w-10 text-slate-350 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-905 mt-2">All Agents Clean</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {verifList.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.fullName}</h4>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">ID: {item.id} • Submitted: {formatDate(item.submittedDate)}</p>
                    
                    <div className="mt-4">
                      <span className="text-[10px] font-bold uppercase text-slate-450">Promo Code Screenshot:</span>
                      <div className="mt-1">
                        <IDPhotoViewer photoUrl={item.promo_screenshot_url || ''} altText={`${item.fullName} Promo Screenshot`} isThumbnail={true} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => navigate(`/verify/${item.id}`)}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Audit →
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setVerReviewUser({ id: item.id, fullName: item.fullName, role: item.role, status: 'pending', childrenCount: 0, joinedAt: '' });
                          setVerStatus('approved');
                          setVerReasonOpen(true);
                        }}
                        className="rounded bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-bold border hover:bg-emerald-100 transition cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setVerReviewUser({ id: item.id, fullName: item.fullName, role: item.role, status: 'pending', childrenCount: 0, joinedAt: '' });
                          setVerStatus('rejected');
                          setVerReasonOpen(true);
                        }}
                        className="rounded bg-rose-50 text-rose-700 px-3 py-1 text-xs font-bold border hover:bg-rose-100 transition cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* CREATE MANUAL TRANSACTION DIALOG */}
      <Modal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} title="Record Downline Member Activity">
        <form className="space-y-4" onSubmit={handleRecordTx}>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Operation Type</label>
            <div className="flex rounded-md bg-slate-50 p-1 border">
              <button
                type="button"
                onClick={() => setTxType('deposit')}
                className={`flex-1 py-1.5 rounded text-xs font-bold uppercase ${
                  txType === 'deposit' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-550'
                }`}
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => setTxType('withdrawal')}
                className={`flex-1 py-1.5 rounded text-xs font-bold uppercase ${
                  txType === 'withdrawal' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-550'
                }`}
              >
                Withdrawal
              </button>
            </div>
          </div>

          {txType === 'deposit' ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-800">
                  <Info className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wide">Deposit Bank Details</span>
                </div>
                <div className="text-xs text-blue-900 space-y-1 pl-6">
                  <p><span className="font-semibold">Name:</span> G M K H Kumara</p>
                  <p><span className="font-semibold">Bank:</span> HNB</p>
                  <p><span className="font-semibold">Branch:</span> Balangoda</p>
                  <p><span className="font-semibold">Account Number:</span> 071010018705</p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Player ID</label>
                <input type="text" required value={txPlayerId} onChange={(e) => setTxPlayerId(e.target.value)} placeholder="Enter player ID" className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bank Slip</label>
                <p className="text-[10px] text-slate-400 mb-1.5">Upload your deposit bank slip or payment screenshot</p>
                <div
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setTxBankSlipDrag(true); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setTxBankSlipDrag(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setTxBankSlipDrag(false); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setTxBankSlipDrag(false); if (e.dataTransfer.files?.[0]) handleBankSlipChange(e.dataTransfer.files[0]); }}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition ${txBankSlipDrag ? 'border-blue-500 bg-blue-50/20' : txBankSlip ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/60'}`}
                >
                  {txBankSlip ? (
                    <div className="flex flex-col items-center gap-2">
                      {txBankSlip.startsWith('data:image') && <div className="h-16 w-24 overflow-hidden rounded-lg border border-slate-200"><img src={txBankSlip} alt="Bank slip preview" className="h-full w-full object-cover" /></div>}
                      <span className="text-xs text-emerald-800 font-semibold">{txBankSlipName || 'File uploaded'}</span>
                      <button type="button" onClick={() => { setTxBankSlip(null); setTxBankSlipName(''); }} className="text-[10px] font-bold text-rose-500 hover:underline">Remove</button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto h-6 w-6 text-slate-400" />
                      <p className="mt-1 text-xs text-slate-600 font-medium">Drag file or <label className="cursor-pointer font-bold text-blue-600 hover:underline"><span>browse</span><input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) handleBankSlipChange(e.target.files[0]); }} /></label></p>
                      <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP, PDF up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase text-slate-400">Withdrawal Details</p>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Withdrawal Code</label>
                <input type="text" required value={txWithdrawalCode} onChange={(e) => setTxWithdrawalCode(e.target.value)} placeholder="e.g. WD-29348" className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bank</label>
                  <input type="text" required value={txWithdrawalBank} onChange={(e) => setTxWithdrawalBank(e.target.value)} placeholder="e.g. HNB" className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Branch</label>
                  <input type="text" required value={txWithdrawalBranch} onChange={(e) => setTxWithdrawalBranch(e.target.value)} placeholder="e.g. Colombo 03" className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Account Number</label>
                <input type="text" required value={txWithdrawalAccount} onChange={(e) => setTxWithdrawalAccount(e.target.value)} placeholder="e.g. 071010018705" className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </div>
            </div>
          )}

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
                placeholder="20000"
                className="block w-full rounded-lg border border-slate-300 pl-11 pr-3 py-2 text-sm text-slate-800 font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Booking Date</label>
            <input
              type="date"
              required
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="block w-full rounded-lg border border-slate-305 p-2 text-sm text-slate-850 font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsTxModalOpen(false)}
              className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-550"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={txSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {txSubmitting ? 'Recording...' : 'Record Log'}
            </button>
          </div>
        </form>
      </Modal>

      {/* KYC REVIEW APPROVAL MODAL */}
      <Modal isOpen={verReasonOpen} onClose={() => setVerReasonOpen(false)} title="Verify Downline ID document">
        {verReviewUser && (
          <div className="space-y-4">
            <p className="text-sm text-slate-650">
              Confirm your KYC action for agent <span className="font-bold text-slate-900">{verReviewUser.fullName}</span> to: <Badge type={verStatus} />
            </p>

            {verStatus === 'rejected' && (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-450 mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={verRejectReason}
                  onChange={(e) => setVerRejectReason(e.target.value)}
                  placeholder="ID photo is cut-off, blurry or ineligible."
                  className="block w-full p-2.5 rounded-lg border text-sm outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setVerReasonOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={handleVerReviewSubmit}
                disabled={verSubmitting}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${verStatus === 'approved' ? 'bg-emerald-600' : 'bg-rose-600'}`}
              >
                {verSubmitting ? 'Saving review...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
