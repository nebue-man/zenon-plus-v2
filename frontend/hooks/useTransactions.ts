import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { API_ENDPOINTS } from '../utils/constants';
import { Transaction } from '../types';

export interface TransactionFilters {
  page: number;
  limit: number;
  type?: 'deposit' | 'withdrawal' | '';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  minAmount?: string;
  maxAmount?: string;
}

export function useTransactions() {
  const { user } = useAuth();
  const [data, setData] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 20,
    type: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    minAmount: '',
    maxAmount: '',
  });

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.type) params.type = filters.type;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.search) params.search = filters.search;
      if (filters.minAmount) params.min_amount = filters.minAmount;
      if (filters.maxAmount) params.max_amount = filters.maxAmount;

      // Detect if we should use admin-specific endpoint or generic
      const endpoint = user.role === 'admin' 
        ? API_ENDPOINTS.admin.transactions 
        : API_ENDPOINTS.transactions.list;

      const response = await api.get(endpoint, { params });

      if (response.data?.success) {
        setData(response.data.data?.transactions || []);
        setTotalCount(response.data.data?.pagination?.total || response.data.data?.total || 0);
      }
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.response?.data?.message || 'Failed to fetch transaction histories.');
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [filters.page, filters.limit, filters.type, filters.dateFrom, filters.dateTo, fetchTransactions]);

  const recordTransaction = async (txData: {
    type: 'deposit' | 'withdrawal';
    amount: number;
    date: string;
    player_id?: string;
    bank_slip?: string;
    withdrawal_details?: {
      withdrawal_code: string;
      bank: string;
      branch: string;
      account_number: string;
    };
  }) => {
    try {
      const endpoint = API_ENDPOINTS.transactions.create;

      const response = await api.post(endpoint, txData);
      if (response.data?.success) {
        await fetchTransactions(); // Refresh
        return { success: true };
      }
      return { success: false, message: response.data?.message || 'Failed to record transaction' };
    } catch (err: any) {
      console.error('Error recording transaction:', err);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Error occurred'
      };
    }
  };

  const updateFilters = (newFilters: Partial<TransactionFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: newFilters.page ?? 1 }));
  };

  const exportToCSV = () => {
    if (data.length === 0) return;
    
    // Header
    const headers = ['Transaction ID', 'User Name', 'Role', 'Type', 'Amount (LKR)', 'Transaction Date'];
    
    // Rows
    const csvContent = [
      headers.join(','),
      ...data.map(tx => [
        `"${tx.id}"`,
        `"${tx.userName}"`,
        `"${tx.userRole}"`,
        `"${tx.type.toUpperCase()}"`,
        tx.amount,
        `"${tx.date}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    data,
    totalCount,
    filters,
    loading,
    error,
    updateFilters,
    recordTransaction,
    exportToCSV,
    refresh: fetchTransactions,
  };
}
