import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { API_ENDPOINTS } from '../utils/constants';
import { BankSlipRequest, BankSlipReviewItem } from '../types';

export function useBankSlips() {
  const { user } = useAuth();
  const [mySlips, setMySlips] = useState<BankSlipRequest[]>([]);
  const [reviewQueue, setReviewQueue] = useState<BankSlipReviewItem[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const fetchMySlips = useCallback(async () => {
    if (!user || user.role === 'admin') return;
    setLoadingMy(true);
    try {
      const res = await api.get(API_ENDPOINTS.bankSlips.my);
      if (res.data?.success) setMySlips(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch my slips:', err);
    } finally {
      setLoadingMy(false);
    }
  }, [user]);

  const fetchReviewQueue = useCallback(async () => {
    if (!user || user.role === 'subagent') return;
    setLoadingQueue(true);
    try {
      const res = await api.get(API_ENDPOINTS.bankSlips.reviewQueue);
      if (res.data?.success) setReviewQueue(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch review queue:', err);
    } finally {
      setLoadingQueue(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchMySlips();
      fetchReviewQueue();
    }
  }, [user, fetchMySlips, fetchReviewQueue]);

  const submitSlip = async (data: { amount: number; bankName?: string; slipImage: string }) => {
    setSubmitting(true);
    try {
      const res = await api.post(API_ENDPOINTS.bankSlips.submit, data);
      if (res.data?.success) {
        await fetchMySlips();
        return { success: true, data: res.data.data };
      }
      return { success: false, message: res.data?.message || 'Submission failed.' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Network error.' };
    } finally {
      setSubmitting(false);
    }
  };

  const reviewSlip = async (slipId: string, action: 'approve' | 'reject', reason?: string) => {
    setReviewing(true);
    try {
      const res = await api.patch(API_ENDPOINTS.bankSlips.review(slipId), { action, reason });
      if (res.data?.success) {
        await fetchReviewQueue();
        return { success: true, data: res.data.data };
      }
      return { success: false, message: res.data?.message || 'Review failed.' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Network error.' };
    } finally {
      setReviewing(false);
    }
  };

  return {
    mySlips,
    reviewQueue,
    loadingMy,
    loadingQueue,
    submitting,
    reviewing,
    submitSlip,
    reviewSlip,
    refreshMy: fetchMySlips,
    refreshQueue: fetchReviewQueue,
  };
}
