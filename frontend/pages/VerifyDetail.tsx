import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVerifications } from '../hooks/useVerifications';
import { IDPhotoViewer } from '../components/IDPhotoViewer';
import { Badge } from '../components/Badge';
import { Toast, ToastType } from '../components/Toast';
import { Modal } from '../components/Modal';
import { formatDate } from '../utils/format';
import { ChevronLeft, UserCheck, UserX, AlertCircle, FileSpreadsheet } from 'lucide-react';
import api from '../api/axios';
import { API_ENDPOINTS } from '../utils/constants';
import { User } from '../types';

export default function VerifyDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { verifyUser } = useVerifications();

  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Prompt action confirmations
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Notification Toast states
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');

  const triggerToast = (msg: string, type: ToastType) => {
    setToastMsg(msg);
    setToastType(type);
  };

  useEffect(() => {
    const fetchTargetUser = async () => {
      if (!userId) return;
      setLoading(true);
      setError('');
      try {
        // Fetch user from Admin users detail or parent-info
        const res = await api.get(API_ENDPOINTS.admin.userById(userId));
        if (res.data?.success && res.data?.data) {
          setTargetUser(res.data.data);
        } else {
          setError('User profile details not found.');
        }
      } catch (err: any) {
        console.error('Failed to load user details:', err);
        setError(err.response?.data?.message || 'Error parsing target user criteria.');
      } finally {
        setLoading(false);
      }
    };
    fetchTargetUser();
  }, [userId]);

  const handleApprove = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const result = await verifyUser(userId, 'approved');
      if (result.success) {
        triggerToast('Registration approved successfully.', 'success');
        setIsApproveOpen(false);
        setTimeout(() => {
          navigate(-1); // Back to queue
        }, 1200);
      } else {
        triggerToast(result.message || 'Error approving user.', 'error');
      }
    } catch (err) {
      triggerToast('Network error occurred.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!userId) return;
    if (!rejectReason.trim()) {
      triggerToast('Rejection reason is required.', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const result = await verifyUser(userId, 'rejected', rejectReason.trim());
      if (result.success) {
        triggerToast('Registration rejected.', 'info');
        setIsRejectOpen(false);
        setTimeout(() => {
          navigate(-1);
        }, 1200);
      } else {
        triggerToast(result.message || 'Error rejecting user.', 'error');
      }
    } catch (err) {
      triggerToast('Network error occurred.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"></div>
          <p className="text-xs font-medium text-slate-500 font-mono">Resolving ID record profiles...</p>
        </div>
      </div>
    );
  }

  if (error || !targetUser) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto shadow-sm">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h3 className="mt-4 text-base font-semibold text-slate-900">Verification Failure</h3>
        <p className="mt-1 text-sm text-slate-500">{error || 'ID user records could not be loaded.'}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Verification List
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Alert overlay notifications */}
      {toastMsg && <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />}

      {/* Back path link */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition"
      >
        <ChevronLeft className="h-4 w-4" /> BACK TO VERIFICATIONS
      </button>

      {/* Grid: Information vs. ID Photo Documentation display */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        
        {/* LEFT COLUMN: User metadata and actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3">User Profile</h2>
            
            <div className="divide-y divide-slate-100 text-sm mt-3">
              <div className="flex justify-between py-3">
                <span className="text-slate-400 font-medium select-none">Full Name</span>
                <span className="font-semibold text-slate-900">{targetUser.fullName}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400 font-medium select-none">User ID</span>
                <span className="font-mono font-semibold text-slate-900">{targetUser.id}</span>
              </div>
              {targetUser.email && (
                <div className="flex justify-between py-3">
                  <span className="text-slate-400 font-medium select-none">Email Address</span>
                  <span className="font-medium text-slate-800">{targetUser.email}</span>
                </div>
              )}
              <div className="flex justify-between py-3">
                <span className="text-slate-400 font-medium select-none">Date of Birth</span>
                <span className="font-semibold text-slate-800">{targetUser.dob ? formatDate(targetUser.dob) : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400 font-medium select-none">Target Role</span>
                <Badge type={targetUser.role} />
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400 font-medium select-none">Sponsor/Inviter</span>
                <span className="font-semibold text-slate-800">{targetUser.parentName || 'None'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400 font-medium select-none">Submitted Date</span>
                <span className="font-mono text-xs text-slate-600">{formatDate(targetUser.joinedAt, true)}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400 font-medium select-none">Current Status</span>
                <Badge type={targetUser.status} />
              </div>
            </div>

            {/* Action buttons (only show if pending verification) */}
            {targetUser.status === 'pending' ? (
              <div className="mt-8 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsApproveOpen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-[0_1px_2px_rgba(16,185,129,0.05)] cursor-pointer"
                >
                  <UserCheck className="h-4 w-4" />
                  Approve ID
                </button>
                <button
                  type="button"
                  onClick={() => setIsRejectOpen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition shadow-[0_1px_2px_rgba(239,68,68,0.05)] cursor-pointer"
                >
                  <UserX className="h-4 w-4" />
                  Reject Invite
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-lg bg-slate-50 border border-slate-150 p-4 text-center">
                <p className="text-xs text-slate-500">
                  This user has already been reviewed ({targetUser.status}). No pending actions are required.
                </p>
                {targetUser.status === 'rejected' && targetUser.rejectReason && (
                  <p className="mt-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 p-2.5 rounded-md">
                    Rejection Reason: {targetUser.rejectReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ID Photo Display (7 cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3">
                ID Documentation
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Please inspect user's details against the uploaded document photograph. Click on the document image below to open full scale lightbox.
              </p>
            </div>

            <div className="mt-6 flex-1 flex items-center justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="w-full">
                <IDPhotoViewer photoUrl={targetUser.idPhoto || ''} altText={`${targetUser.fullName}'s ID Sheet`} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* APPROVE CONFIRMATION MODAL */}
      <Modal isOpen={isApproveOpen} onClose={() => setIsApproveOpen(false)} title="Confirm Identity Approval">
        <div className="space-y-4">
          <p className="text-sm text-slate-650 leading-relaxed">
            Are you sure you want to approve <span className="font-bold text-slate-900">{targetUser.fullName}</span>?
            This will instantly activate their account and grant access to the Zimplexline dashboard as a(n) <span className="font-semibold">{targetUser.role}</span>.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsApproveOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
            >
              {actionLoading ? 'Approving...' : 'Confirm Approval'}
            </button>
          </div>
        </div>
      </Modal>

      {/* REJECT MODAL WITH REJECTION REASON TEXTAREA */}
      <Modal isOpen={isRejectOpen} onClose={() => setIsRejectOpen(false)} title="Reject ID Verification">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Please enter a mandatory explanation for rejecting <span className="font-bold">{targetUser.fullName}</span>'s invitation. The user will view this explanation when attempting login.
          </p>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Rejection Reason *
            </label>
            <textarea
              required
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. ID photograph is blurry or birth date is invalid..."
              className="block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-rose-500 focus:ring-3 focus:ring-rose-500/10 transition"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsRejectOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition"
            >
              {actionLoading ? 'Saving rejection...' : 'Reject Account'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
