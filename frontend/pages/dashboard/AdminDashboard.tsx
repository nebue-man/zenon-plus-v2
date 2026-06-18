import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../../hooks/useDashboard';
import { useTransactions } from '../../hooks/useTransactions';
import { useCommissions } from '../../hooks/useCommissions';
import { useVerifications } from '../../hooks/useVerifications';
import { useAuth } from '../../context/useAuth';
import { SummaryCard } from '../../components/SummaryCard';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { IDPhotoViewer } from '../../components/IDPhotoViewer';
import { EarningsChart } from '../../components/EarningsChart';
import { Toast, ToastType } from '../../components/Toast';
import { InviteSection } from '../../components/InviteSection';
import { formatLKR, formatDate, formatPercent } from '../../utils/format';
import { API_ENDPOINTS } from '../../utils/constants';
import api from '../../api/axios';
import {
  Users,
  Wallet,
  Coins,
  CheckCircle,
  Eye,
  Plus,
  Download,
  AlertTriangle,
  Edit,
  Trash2,
  Calendar,
  X,
  Search,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { User, Transaction, Commission, AuditLog } from '../../types';

interface AdminDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function AdminDashboard({ activeTab, setActiveTab }: AdminDashboardProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  // Dashboard Metrics & Charts
  const { data: metrics, loading: mLoading, refresh: refreshSummary } = useDashboard();
  
  // Transactions Hook handles list, creation, filters and exporting
  const {
    data: txList,
    totalCount: txTotalCount,
    filters: txFilters,
    loading: txLoading,
    updateFilters: setTxFilters,
    recordTransaction,
    exportToCSV: exportTxCSV,
    refresh: refreshTx,
  } = useTransactions();

  // Commissions Hook
  const {
    data: commList,
    totalCount: commTotalCount,
    filters: commFilters,
    loading: commLoading,
    updateFilters: setCommFilters,
    getSummaryMetrics: getCommSummary,
    refresh: refreshComm,
  } = useCommissions();

  // Verification Queue
  const {
    data: verifList,
    loading: verLoading,
    verifyUser,
    refresh: refreshVerifs,
  } = useVerifications();

  // Component-local state variables for modals & overlays
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const showToast = (msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // State: Leaderboard data
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // State: Users Manager Tab
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersRoleFilter, setUsersRoleFilter] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState('');
  const [usersSearch, setUsersSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);

  // User detail panel overlay (slide-over)
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userCommHistory, setUserCommHistory] = useState<Commission[]>([]);

  // User edit modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'manager' | 'agent' | 'subagent'>('subagent');
  const [editParentId, setEditParentId] = useState('');
  const [editStatus, setEditStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // User delete confirmation
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Manual Transaction creation modal state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txPlayerId, setTxPlayerId] = useState('');
  const [txWithdrawalCode, setTxWithdrawalCode] = useState('');
  const [txWithdrawalBank, setTxWithdrawalBank] = useState('');
  const [txWithdrawalBranch, setTxWithdrawalBranch] = useState('');
  const [txWithdrawalAccount, setTxWithdrawalAccount] = useState('');
  const [txSubmitting, setTxSubmitting] = useState(false);

  // Audit Logs Tab
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  // Multi-Step verify action dialog within Verifications Tab
  const [verReviewUser, setVerReviewUser] = useState<User | null>(null);
  const [verStatus, setVerStatus] = useState<'approved' | 'rejected'>('approved');
  const [verRejectReason, setVerRejectReason] = useState('');
  const [verReasonOpen, setVerReasonOpen] = useState(false);
  const [verSubmitting, setVerSubmitting] = useState(false);

  // Fetch users list
  const fetchUsersList = async () => {
    setUsersLoading(true);
    try {
      const params: Record<string, any> = { page: usersPage, limit: 20 };
      if (usersRoleFilter) params.role = usersRoleFilter;
      if (usersStatusFilter) params.status = usersStatusFilter;
      if (usersSearch) params.search = usersSearch;

      const response = await api.get(API_ENDPOINTS.admin.users, { params });
      if (response.data?.success) {
        setUsers(response.data.data?.users || []);
        setUsersTotal(response.data.data?.pagination?.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch user index:', err);
      showToast('Failed to fetch user directory files.', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const response = await api.get(API_ENDPOINTS.admin.auditLogs, {
        params: { page: auditPage, limit: 50 },
      });
      if (response.data?.success) {
        setAuditLogs(response.data.data?.logs || []);
        setAuditTotal(response.data.data?.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load audits:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Fetch leaderboard & user list dropdown on specific tab open
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsersList();
    } else if (activeTab === 'audit_log') {
      fetchAuditLogs();
    } else if (activeTab === 'overview') {
      const fetchLeaderboard = async () => {
        setLeaderboardLoading(true);
        try {
          const res = await api.get(API_ENDPOINTS.admin.systemStats);
          if (res.data?.success && res.data.data?.leaderboard) {
            setLeaderboard(res.data.data.leaderboard);
          }
        } catch (err) {
          console.error('Could not load earners leaderboard:', err);
        } finally {
          setLeaderboardLoading(false);
        }
      };
      fetchLeaderboard();
    }
  }, [activeTab, usersPage, usersRoleFilter, usersStatusFilter, auditPage]);


  // Trigger search on typing
  const handleUsersSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUsersPage(1);
    fetchUsersList();
  };

  // View Slide-over details callback
  const handleViewUserDetail = async (target: User) => {
    setSelectedUser(target);
    // Fetch personal commissions history scoped to this earner
    try {
      const res = await api.get(API_ENDPOINTS.commissions.list, {
        params: { search: target.fullName, limit: 10 },
      });
      if (res.data?.success) {
        setUserCommHistory(res.data.data?.commissions || []);
      }
    } catch (err) {
      setUserCommHistory([]);
    }
  };

  // Edit user detail save form execution
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);

    try {
      const patchData: any = { role: editRole, status: editStatus };
      if (editParentId) patchData.parentId = editParentId;

      const res = await api.patch(API_ENDPOINTS.admin.userById(editingUser.id), patchData);
      if (res.data?.success) {
        showToast(`User details updated matches successfully.`, 'success');
        setEditingUser(null);
        fetchUsersList();
        refreshSummary();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error saving user profiles.', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Soft delete confirm execution
  const handleDeleteUserConfirm = async () => {
    if (!deletingUser) return;
    setDeleteSubmitting(true);

    try {
      const res = await api.delete(API_ENDPOINTS.admin.userById(deletingUser.id));
      if (res.data?.success) {
        showToast('User has been blocked. Downline hierarchy maintained.', 'info');
        setDeletingUser(null);
        fetchUsersList();
        refreshSummary();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error occurred.', 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleRecordTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0) {
      showToast('Please provide a positive numerical amount.', 'warning');
      return;
    }
    if (txType === 'deposit' && !txPlayerId.trim()) {
      showToast('Player ID is required for deposits.', 'warning');
      return;
    }
    if (txType === 'withdrawal' && (!txWithdrawalCode.trim() || !txWithdrawalBank.trim() || !txWithdrawalBranch.trim() || !txWithdrawalAccount.trim())) {
      showToast('Please fill in all withdrawal details (code, bank, branch, account number).', 'warning');
      return;
    }
    setTxSubmitting(true);

    try {
      const result = await recordTransaction({
        type: txType,
        amount: Number(txAmount),
        date: txDate,
        ...(txType === 'deposit' ? { player_id: txPlayerId } : {}),
        ...(txType === 'withdrawal' ? {
          withdrawal_details: {
            withdrawal_code: txWithdrawalCode,
            bank: txWithdrawalBank,
            branch: txWithdrawalBranch,
            account_number: txWithdrawalAccount,
          },
        } : {}),
      });

      if (result.success) {
        showToast('Transaction recorded successfully. Commissions generated.', 'success');
        setIsTxModalOpen(false);
        setTxAmount('');
        setTxPlayerId('');
        setTxWithdrawalCode('');
        setTxWithdrawalBank('');
        setTxWithdrawalBranch('');
        setTxWithdrawalAccount('');
        refreshSummary();
        refreshTx();
      } else {
        showToast(result.message || 'Error saving.', 'error');
      }
    } catch (err) {
      showToast('Failed to record transaction due to network error.', 'error');
    } finally {
      setTxSubmitting(false);
    }
  };

  // Handle immediate approve/reject within Verifications tab
  const handleVerReviewAction = async () => {
    if (!verReviewUser) return;
    if (verStatus === 'rejected' && !verRejectReason.trim()) {
      showToast('A rejection reason is mandatory.', 'warning');
      return;
    }
    setVerSubmitting(true);
    try {
      const res = await verifyUser(verReviewUser.id, verStatus, verRejectReason);
      if (res.success) {
        showToast(`Verification ${verStatus} registered.`, 'success');
        setVerReasonOpen(false);
        setVerReviewUser(null);
        setVerRejectReason('');
        refreshVerifs();
        refreshSummary();
      } else {
        showToast(res.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Failed to verify due to network issue', 'error');
    } finally {
      setVerSubmitting(false);
    }
  };

  const commSummary = getCommSummary();

  return (
    <div className="space-y-6">
      
      {/* Toast Alert elements */}
      {toastMsg && <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />}

      {/* RENDER TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Summary stats cards row */}
          {mLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-white border border-slate-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Total Platform Users"
                value={metrics?.totalUsers || 0}
                subtext={`${metrics?.managerCount || 0} Managers • ${metrics?.agentCount || 0} Agents • ${metrics?.subagentCount || 0} Subagents`}
                icon={Users}
              />
              <SummaryCard
                title="Transactions Volume"
                value={formatLKR(metrics?.transactionVolumeThisMonth || 0)}
                subtext="Accumulated value this month"
                icon={Wallet}
                iconColor="text-blue-600 bg-blue-50"
              />
              <SummaryCard
                title="Total Paid Commissions"
                value={formatLKR(metrics?.totalCommissionsPaidThisMonth || 0)}
                subtext="Automated payout sums this month"
                icon={Coins}
                iconColor="text-emerald-700 bg-emerald-50"
              />
              <SummaryCard
                title="Pending Verifications"
                value={metrics?.pendingVerifications || 0}
                subtext="Requires documents KYC reviews"
                icon={CheckCircle}
                iconColor={metrics?.pendingVerifications && metrics.pendingVerifications > 0 ? "text-rose-600 bg-rose-50" : "text-slate-400 bg-slate-50"}
              />
            </div>
          )}

          {/* Core Analytics charts Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Primary Volume Chart Component */}
            <div className="lg:col-span-8">
              <EarningsChart
                type="bar"
                data={metrics?.earningsTrend || []}
                title="Monthly Transaction Volume Trends (LKR)"
              />
            </div>
            {/* Top earners leaderboard hierarchy */}
            <div className="lg:col-span-4 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-[#0F172A] font-bold mb-4">
                  Top Earners Leaderboard
                </h3>
                
                {leaderboardLoading ? (
                  <div className="py-12 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-6 animate-pulse bg-[#F1F5F9] rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="my-2 divide-y divide-[#F1F5F9] max-h-[290px] overflow-y-auto">
                    {leaderboard.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-12">No earners listed yet.</p>
                    ) : (
                      leaderboard.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 hover:bg-[#F8FAFC] rounded-lg border-b border-[#F1F5F9] last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-sm font-bold text-[#64748B]">0{index + 1}</span>
                            <div>
                              <p className="text-sm font-bold text-[#0F172A]">{item.name}</p>
                              <Badge type={item.role} className="scale-85 origin-left" />
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#0F172A] tabular-nums">{formatLKR(item.totalEarned)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-[#E2E8F0] pt-4 mt-4 flex justify-between text-[11px] font-semibold text-[#64748B]">
                <span>Resets on 1st of Month</span>
                <span>Active Systems Logs UTC</span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* RENDER TAB 2: USERS BOARD */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-200">

          <InviteSection userRole="admin" />

          <div className="border-t border-slate-200" />

          {/* Filters controls bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <form onSubmit={handleUsersSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user ID or full name..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2 text-sm text-slate-800 select-all outline-hidden transition focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-850 cursor-pointer"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              {/* Role filter dropdown */}
              <select
                value={usersRoleFilter}
                onChange={(e) => {
                  setUsersRoleFilter(e.target.value);
                  setUsersPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-hidden"
              >
                <option value="">All Roles</option>
                <option value="manager">Managers</option>
                <option value="agent">Agents</option>
                <option value="subagent">Sub-agents</option>
              </select>

              {/* Status filter dropdown */}
              <select
                value={usersStatusFilter}
                onChange={(e) => {
                  setUsersStatusFilter(e.target.value);
                  setUsersPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-hidden"
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Main User Index Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] table-auto border-collapse text-left text-sm text-slate-650">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">User Name & ID</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Parent Sponsor</th>
                    <th className="py-3 px-4 text-center">Downlines</th>
                    <th className="py-3 px-4">Joined Date</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="py-6 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-450">
                        No team member files correspond to these filters.
                      </td>
                    </tr>
                  ) : (
                    users.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-semibold text-slate-900 leading-none">{item.fullName}</p>
                            <p className="font-mono text-[10px] text-slate-400 leading-none mt-1">{item.id}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge type={item.role} />
                        </td>
                        <td className="py-4 px-4">
                          <Badge type={item.status} />
                        </td>
                        <td className="py-4 px-4">
                          {item.role === 'manager' || !item.parentName
                            ? <span className="text-slate-300">—</span>
                            : <span className="font-semibold text-slate-700">{item.parentName}</span>
                          }
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-medium text-slate-900">
                          {item.childrenCount}
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-500">
                          {formatDate(item.joinedAt)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => handleViewUserDetail(item)}
                              className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-100 text-slate-600 transition"
                              title="Full Profile Slideover"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingUser(item);
                                setEditRole(item.role);
                                setEditParentId(item.parentId || '');
                                setEditStatus(item.status);
                              }}
                              className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-100 text-slate-600 transition"
                              title="Modify Profile Roles"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {/* Restrict deleting yourself */}
                            {item.id !== currentUser?.id && (
                              <button
                                onClick={() => setDeletingUser(item)}
                                className="rounded-md border border-rose-100 p-1.5 hover:bg-rose-50 text-rose-600 transition"
                                title="Block Affiliate User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={usersPage}
              totalCount={usersTotal}
              pageSize={20}
              onPageChange={(p) => setUsersPage(p)}
            />
          </div>

        </div>
      )}

      {/* RENDER TAB 3: TRANSACTIONS RECORD */}
      {activeTab === 'transactions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Header containing Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-slate-450 uppercase font-mono tracking-wider">Historical Logs</p>
              <h2 className="text-xl font-bold text-slate-950">Deposit / Withdrawal Logs</h2>
            </div>
            
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsTxModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-650 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" /> Record Transaction
              </button>
              
              <button
                type="button"
                onClick={exportTxCSV}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Download className="h-4 w-4" /> Export Filtered CSV
              </button>
            </div>
          </div>

          {/* Filters shelf */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filtering criteria
            </h4>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {/* Type filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transaction Type</label>
                <select
                  value={txFilters.type || ''}
                  onChange={(e) => setTxFilters({ type: e.target.value as any, page: 1 })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                >
                  <option value="">All Transactions</option>
                  <option value="deposit">Deposits</option>
                  <option value="withdrawal">Withdrawals</option>
                </select>
              </div>

              {/* Date from */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date From</label>
                <input
                  type="date"
                  value={txFilters.dateFrom || ''}
                  onChange={(e) => setTxFilters({ dateFrom: e.target.value, page: 1 })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 font-mono"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date To</label>
                <input
                  type="date"
                  value={txFilters.dateTo || ''}
                  onChange={(e) => setTxFilters({ dateTo: e.target.value, page: 1 })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 font-mono"
                />
              </div>

              {/* User search */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter By User</label>
                <input
                  type="text"
                  placeholder="Type name / ID..."
                  value={txFilters.search || ''}
                  onChange={(e) => setTxFilters({ search: e.target.value, page: 1 })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Transactions list Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] table-auto border-collapse text-left text-sm text-slate-650">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">Transaction ID</th>
                    <th className="py-3 px-4">Affiliate User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount LKR</th>
                    <th className="py-3 px-4">Bank Slip</th>
                    <th className="py-3 px-6">Timestamp Date</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txLoading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={8} className="py-5 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : txList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-450">
                        No transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    txList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-xs text-slate-450 font-medium">
                          {tx.id}
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => navigate(`/admin/users/${tx.userId}/transactions`)}
                            className="font-semibold text-blue-600 hover:underline text-left"
                          >
                            {tx.userName}
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <Badge type={tx.userRole} />
                        </td>
                        <td className="py-4 px-4">
                          <Badge type={tx.type} />
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">
                          {formatLKR(tx.amount)}
                        </td>
                        <td className="py-4 px-4">
                          {currentUser?.role === 'admin' && tx.bank_slip_url ? (
                            <img
                              src={tx.bank_slip_url}
                              alt="Bank slip"
                              style={{ width: '80px', height: '80px', objectFit: 'cover', cursor: 'zoom-in', borderRadius: '4px' }}
                              onClick={() => window.open(tx.bank_slip_url, '_blank')}
                              title="Click to open full size"
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {formatDate(tx.date, true)}
                        </td>
                        <td className="py-4 px-4">
                          {tx.transaction_status === 'approved' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Approved</span>
                          ) : tx.transaction_status === 'rejected' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-200">Rejected</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
                          )}
                        </td>
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

      {/* RENDER TAB 4: COMMISSIONS LOGS */}
      {activeTab === 'commissions' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">Ledger Accounts</p>
            <h2 className="text-xl font-bold text-slate-950">Multi-level Commissions Breakdown</h2>
          </div>

          {/* Summary aggregation metrics ribbon */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="px-3 border-r border-slate-100 last:border-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Accumulated Earnings</span>
              <span className="font-mono text-base font-bold text-slate-900 mt-1 block">{formatLKR(commSummary.total)}</span>
            </div>
            <div className="px-3 border-r border-slate-100 last:border-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Direct Activities (Own)</span>
              <span className="font-mono text-xs font-semibold text-indigo-750 mt-1 block">{formatLKR(commSummary.ownActivity)}</span>
            </div>
            <div className="px-3 border-r border-slate-100 last:border-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Direct Agent Referrals</span>
              <span className="font-mono text-xs font-semibold text-blue-75c mt-1 block">{formatLKR(commSummary.directAgent || commSummary.directSubagent)}</span>
            </div>
            <div className="px-3 border-r border-slate-100 last:border-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Deep Team commissions</span>
              <span className="font-mono text-xs font-semibold text-emerald-800 mt-1 block">{formatLKR(commSummary.deepTeam)}</span>
            </div>
            <div className="px-3">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block">Locked commissions</span>
              <span className="font-mono text-xs font-semibold text-rose-700 mt-1 block">{formatLKR(commSummary.locked)}</span>
            </div>
          </div>

          {/* Simple search bar filters */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="Search earner name or ID..."
                value={commFilters.search || ''}
                onChange={(e) => setCommFilters({ search: e.target.value, page: 1 })}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs text-slate-700 outline-hidden focus:border-blue-500"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="date"
                title="Date threshold"
                value={commFilters.dateFrom || ''}
                onChange={(e) => setCommFilters({ dateFrom: e.target.value, page: 1 })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-650"
              />
            </div>
          </div>

          {/* Commissions list Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] table-auto border-collapse text-left text-sm text-slate-650">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">Earner Affiliate</th>
                    <th className="py-3 px-4">Trigger User</th>
                    <th className="py-3 px-4">Commission Type</th>
                    <th className="py-3 px-4">Percentage</th>
                    <th className="py-3 px-4">Calculated Payout</th>
                    <th className="py-3 px-4">Verification Check</th>
                    <th className="py-3 px-6">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commLoading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="py-5 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : commList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-450">
                        No commissions ledger matching criteria.
                      </td>
                    </tr>
                  ) : (
                    commList.map((comm) => (
                      <tr key={comm.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <span className="font-semibold text-slate-900">{comm.beneficiaryName}</span>
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-600">
                          {comm.sourceName}
                        </td>
                        <td className="py-4 px-4 text-xs font-mono text-slate-500 uppercase">
                          {comm.type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-800">
                          {formatPercent(comm.percentage)}
                        </td>
                        <td className="py-4 px-4 font-mono font-extrabold text-slate-950">
                          {formatLKR(comm.amount)}
                        </td>
                        <td className="py-4 px-4">
                          {comm.isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                              Locked Period
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              Active Earned
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {formatDate(comm.date, true)}
                        </td>
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

      {/* RENDER TAB 5: ACTIVE VERIFICATIONS */}
      {activeTab === 'verifications' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">KYC Queue</p>
            <h2 className="text-xl font-bold text-slate-950">Pending National ID reviews ({verifList.length})</h2>
          </div>

          {verLoading ? (
            <LoadingSpinner message="Evaluating verification queue indexes..." />
          ) : verifList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-350 bg-white p-12 text-center shadow-xs">
              <CheckCircle className="mx-auto h-12 w-12 text-slate-350" />
              <h3 className="mt-4 text-sm font-semibold text-slate-900">Queue is Clear</h3>
              <p className="mt-1 text-xs text-slate-500">No affiliate accounts require document inspection reviews.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {verifList.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">{item.fullName}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.id}</p>
                      </div>
                      <Badge type={item.role} />
                    </div>

                    <div className="mt-4 divide-y divide-slate-100 text-xs">
                      <div className="flex justify-between py-2">
                        <span className="text-slate-400">Inviter:</span>
                        <span className="font-semibold text-slate-800">{item.parentName || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-slate-400">Submitted:</span>
                        <span className="font-mono text-slate-655">{formatDate(item.submittedDate)}</span>
                      </div>
                    </div>

                    {/* Promo Code Screenshot thumbnail */}
                    <div className="mt-4 flex flex-col">
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 leading-none">Promo Code Screenshot</span>
                      <IDPhotoViewer photoUrl={item.promo_screenshot_url || ''} altText={`${item.fullName} Promo Screenshot`} isThumbnail={true} />
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      onClick={() => navigate(`/verify/${item.id}`)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition"
                    >
                      Audit Details →
                    </button>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setVerReviewUser({ id: item.id, fullName: item.fullName, role: item.role, status: 'pending', childrenCount: 0, joinedAt: '' });
                          setVerStatus('approved');
                          setIsTxModalOpen(false);
                          setVerReasonOpen(true);
                        }}
                        className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setVerReviewUser({ id: item.id, fullName: item.fullName, role: item.role, status: 'pending', childrenCount: 0, joinedAt: '' });
                          setVerStatus('rejected');
                          setVerReasonOpen(true);
                        }}
                        className="rounded-lg bg-rose-50 text-rose-700 border border-rose-100 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
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

      {/* RENDER TAB 6: AUDIT HISTORIES */}
      {activeTab === 'audit_log' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono tracking-wider">System Records</p>
            <h2 className="text-xl font-bold text-slate-950">Administrative Audit Trails</h2>
            <p className="text-xs text-slate-500 mt-0.5">Read-only, tamper-proof logs capturing user promotions, approvals, and transaction bookings.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-in fade-in">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] table-auto border-collapse text-left text-sm text-slate-650">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-450">
                    <th className="py-3 px-6">Timestamp Date</th>
                    <th className="py-3 px-4">Operator Action</th>
                    <th className="py-3 px-4">Core Operation</th>
                    <th className="py-3 px-6">Trigger Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLoading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={4} className="py-5 px-6"><div className="h-4 bg-slate-50 rounded" /></td>
                      </tr>
                    ))
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-450">
                        No audit trace logged in system.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition bg-slate-50/10">
                        <td className="py-4 px-6 font-mono text-xs text-slate-550">
                          {formatDate(log.timestamp, true)}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-900">
                          {log.actorName}
                        </td>
                        <td className="py-4 px-4 text-xs font-mono max-w-sm">
                          <span className="text-slate-800 font-semibold">{log.action}</span>
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-600">
                          {log.targetName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={auditPage}
              totalCount={auditTotal}
              pageSize={50}
              onPageChange={(p) => setAuditPage(p)}
            />
          </div>

        </div>
      )}

      {/* RENDER TAB 7: SETTINGS CONFIGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono tracking-wider font-semibold">Tenant configurations</p>
            <h2 className="text-xl font-bold text-slate-950">Platform Settings</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            
            {/* Rates static documentation card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-905 border-b pb-3 uppercase tracking-wide">Commission Rates Config</h3>
              <p className="text-xs text-slate-450 mt-1 leading-relaxed">
                The payout commissions are configured globally via <span className="font-mono text-indigo-650 bg-slate-55 p-0.5 rounded">constants.ts</span> for dynamic calculation support.
              </p>

              <div className="mt-4 space-y-3.5 text-xs">
                <div className="flex justify-between border-b border-dashed py-2.5">
                  <span className="text-slate-450 font-medium">Manager's Activity:</span>
                  <span className="font-mono font-bold text-slate-900">3% Deposit • 1% Withdrawal</span>
                </div>
                <div className="flex justify-between border-b border-dashed py-2.5">
                  <span className="text-slate-450 font-medium">Manager from direct agents:</span>
                  <span className="font-mono font-bold text-slate-900">1% Deposit • 0.4% Withdrawal</span>
                </div>
                <div className="flex justify-between border-b border-dashed py-2.5">
                  <span className="text-slate-450 font-medium">Agent direct subagent rate tier:</span>
                  <span className="font-mono font-bold text-slate-900">2.5% (&lt;20k LKR) • 3.0% (&gt;=20k LKR)</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-450 font-medium">Promo Referral Rates:</span>
                  <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">10.0% Commissions Unocked</span>
                </div>
              </div>
            </div>

            {/* Recruiter Limits static panel */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-905 border-b pb-3 uppercase tracking-wide">Capacity Thresholds</h3>
              
              <div className="mt-4 space-y-4 text-xs leading-relaxed">
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <p className="font-semibold text-slate-800">Manager hiring limit</p>
                  <p className="text-slate-500 mt-1">Managers can recruit a maximum scale of <span className="font-bold underline text-slate-900">5 Agents</span> into their direct downline.</p>
                </div>
                
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <p className="font-semibold text-slate-800">Agent hiring limit</p>
                  <p className="text-slate-500 mt-1">Agents can recruit a maximum of <span className="font-bold underline text-slate-900">10 Sub-agents</span> into their direct downline.</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* USER DETAIL DRAWER OVERLAY */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop screen */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition duration-300"
            onClick={() => setSelectedUser(null)}
          />

          <div className="relative w-full max-w-xl bg-white h-screen flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-right duration-300">
            {/* Header drawer */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">User Dossier</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedUser.id}</p>
              </div>
              
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Scrollable specs elements details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Profile card fields */}
              <div>
                <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 select-none">Biometric Details</h4>
                <div className="bg-slate-50 rounded-xl border p-4 text-sm divide-y divide-slate-100 divide-dashed">
                  <div className="flex justify-between py-2 font-medium">
                    <span className="text-slate-400 font-sans">Full Name:</span>
                    <span className="text-slate-900 font-bold">{selectedUser.fullName}</span>
                  </div>
                  {selectedUser.email && (
                    <div className="flex justify-between py-2 font-medium">
                      <span className="text-slate-400 font-sans">Email Address:</span>
                      <span className="text-slate-800">{selectedUser.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 font-medium">
                    <span className="text-slate-400">Date of Birth:</span>
                    <span className="text-slate-900 font-mono">{selectedUser.dob ? formatDate(selectedUser.dob) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-2 font-medium">
                    <span className="text-slate-400">Security role:</span>
                    <Badge type={selectedUser.role} />
                  </div>
                  {selectedUser.role !== 'manager' && (
                    <div className="flex justify-between py-2 font-medium">
                      <span className="text-slate-400">Direct Sponsor/Manager:</span>
                      <span className="text-slate-800 font-bold">{selectedUser.parentName || '—'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Promo Code Screenshot */}
              {selectedUser.promo_screenshot_url && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Promo Code Screenshot</h4>
                  <div className="p-1 border bg-slate-50 rounded-xl">
                    <IDPhotoViewer photoUrl={selectedUser.promo_screenshot_url} altText={`${selectedUser.fullName} Promo Screenshot`} />
                  </div>
                </div>
              )}

              {/* Commission Earnings log */}
              <div>
                <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 block">Recent commission history payout</h4>
                <div className="border rounded-xl bg-white overflow-hidden divide-y text-xs">
                  {userCommHistory.length === 0 ? (
                    <p className="p-4 text-center text-slate-400 font-mono">No commissions logged for this record.</p>
                  ) : (
                    userCommHistory.slice(0, 5).map((ch) => (
                      <div key={ch.id} className="flex justify-between items-center p-3 hover:bg-slate-50/50">
                        <div>
                          <p className="font-semibold text-slate-800">{ch.type.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{formatDate(ch.date, true)}</p>
                        </div>
                        <span className="font-mono font-bold text-slate-950">{formatLKR(ch.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Footer close */}
            <div className="border-t border-slate-100 p-4 shrink-0 bg-slate-50">
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full rounded-lg border bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close dossiers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER EDIT MODAL */}
      <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Modify User Account File">
        {editingUser && (
          <form className="space-y-4" onSubmit={handleEditUserSubmit}>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                disabled
                value={editingUser.fullName}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500 font-semibold"
              />
            </div>

            {/* Role edit select */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Hierarchal Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as any)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="manager">Manager</option>
                <option value="agent">Agent</option>
                <option value="subagent">Sub-agent</option>
              </select>
            </div>

            {/* Status edit select */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Status Badge Check</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {editSubmitting ? 'Saving modifications...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* USER SOFT DELETE MODAL */}
      <Modal isOpen={!!deletingUser} onClose={() => setDeletingUser(null)} title="Suspend System User">
        {deletingUser && (
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-100 p-4 text-sm text-rose-800 flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-semibold">Suspend Account Access</p>
                <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                  "This user will be blocked from login. Their data and downline are preserved."
                </p>
              </div>
            </div>
            
            <p className="text-xs text-slate-550 leading-relaxed">
              Name: <span className="font-semibold text-slate-900">{deletingUser.fullName}</span><br />
              Role: <Badge type={deletingUser.role} /><br />
              Sponsor: <span className="font-medium">{deletingUser.parentName || 'None'}</span>
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setDeletingUser(null)}
                className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUserConfirm}
                disabled={deleteSubmitting}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-750"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MANUAL RECORD TRANSACTION MODAL */}
      <Modal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} title="Record Activity Transaction">
        <form className="space-y-4 font-sans" onSubmit={handleRecordTxSubmit}>

          {/* Type Toggle Deposit/Withdrawal */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Operation Type</label>
            <div className="flex rounded-md shadow-xs bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setTxType('deposit')}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase transition ${
                  txType === 'deposit' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => setTxType('withdrawal')}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase transition ${
                  txType === 'withdrawal' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Withdrawal
              </button>
            </div>
          </div>

          {/* Conditional deposit info / withdrawal fields */}
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
                <input
                  type="text"
                  required
                  value={txPlayerId}
                  onChange={(e) => setTxPlayerId(e.target.value)}
                  placeholder="Enter player ID"
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase text-slate-400">Withdrawal Details</p>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Withdrawal Code</label>
                <input
                  type="text"
                  required
                  value={txWithdrawalCode}
                  onChange={(e) => setTxWithdrawalCode(e.target.value)}
                  placeholder="e.g. WD-29348"
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bank</label>
                  <input
                    type="text"
                    required
                    value={txWithdrawalBank}
                    onChange={(e) => setTxWithdrawalBank(e.target.value)}
                    placeholder="e.g. HNB"
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Branch</label>
                  <input
                    type="text"
                    required
                    value={txWithdrawalBranch}
                    onChange={(e) => setTxWithdrawalBranch(e.target.value)}
                    placeholder="e.g. Colombo 03"
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Account Number</label>
                <input
                  type="text"
                  required
                  value={txWithdrawalAccount}
                  onChange={(e) => setTxWithdrawalAccount(e.target.value)}
                  placeholder="e.g. 071010018705"
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Amount field */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Transaction Amount (LKR)</label>
            <div className="relative rounded-md shadow-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-sm font-semibold text-slate-400">LKR</span>
              </div>
              <input
                type="number"
                required
                min={1}
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="45000"
                className="block w-full rounded-lg border border-slate-300 pl-12 pr-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 font-mono font-semibold"
              />
            </div>
          </div>

          {/* Date field */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Booking Date</label>
            <input
              type="date"
              required
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsTxModalOpen(false)}
              className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={txSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {txSubmitting ? 'Recording Log...' : 'Commit Transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* IMMEDIATE REVIEW APPROVAL / REJECTION DIALOG */}
      <Modal isOpen={verReasonOpen} onClose={() => setVerReasonOpen(false)} title="KYC Verification Decision">
        {verReviewUser && (
          <div className="space-y-4">
            <p className="text-sm text-slate-650">
              Confirm your decision to update verification status for <span className="font-bold text-slate-900">{verReviewUser.fullName}</span> to: <Badge type={verStatus} />
            </p>

            {verStatus === 'rejected' && (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Rejection Explanation *</label>
                <textarea
                  required
                  rows={3}
                  value={verRejectReason}
                  onChange={(e) => setVerRejectReason(e.target.value)}
                  placeholder="ID photo is incomplete, blurry, or matches invalid documents..."
                  className="block w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-rose-500 focus:ring-3 focus:ring-rose-100 outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => setVerReasonOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleVerReviewAction}
                disabled={verSubmitting}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${verStatus === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {verSubmitting ? 'Saving Review...' : 'Commit Review'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
