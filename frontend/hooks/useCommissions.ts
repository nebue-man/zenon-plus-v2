import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';
import { API_ENDPOINTS } from '../utils/constants';
import { Commission } from '../types';

export interface CommissionFilters {
  page: number;
  limit: number;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export function useCommissions() {
  const { user } = useAuth();
  const [data, setData] = useState<Commission[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<CommissionFilters>({
    page: 1,
    limit: 20,
    type: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const fetchCommissions = useCallback(async () => {
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

      // Select endpoint based on user role
      const endpoint = user.role === 'admin'
        ? API_ENDPOINTS.admin.commissions
        : API_ENDPOINTS.commissions.list;

      const response = await api.get(endpoint, { params });

      if (response.data?.success) {
        setData(response.data.data?.commissions || []);
        setTotalCount(response.data.data?.pagination?.total || response.data.data?.total || 0);
      }
    } catch (err: any) {
      console.error('Error fetching commissions:', err);
      setError(err.response?.data?.message || 'Failed to load commission records.');
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    fetchCommissions();
  }, [filters.page, filters.limit, filters.type, filters.dateFrom, filters.dateTo, fetchCommissions]);

  const updateFilters = (newFilters: Partial<CommissionFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: newFilters.page ?? 1 }));
  };

  // Compute aggregate metrics of currently loaded commission rows
  const getSummaryMetrics = () => {
    const totals: { [key: string]: number } = {
      total: 0,
      ownActivity: 0,
      directAgent: 0,
      directSubagent: 0,
      deepTeam: 0,
      locked: 0,
    };

    data.forEach((comm) => {
      totals.total += comm.amount;
      if (comm.isLocked) {
        totals.locked += comm.amount;
      }
      
      if (comm.type === 'own_deposit' || comm.type === 'own_withdrawal') {
        totals.ownActivity += comm.amount;
      } else if (comm.type === 'direct_agent_deposit' || comm.type === 'direct_agent_withdrawal') {
        totals.directAgent += comm.amount;
      } else if (
        comm.type === 'deep_team_deposit' || comm.type === 'deep_team_withdrawal' ||
        comm.type === 'agent_deep_team_deposit' || comm.type === 'agent_deep_team_withdrawal'
      ) {
        totals.deepTeam += comm.amount;
      } else {
        totals.deepTeam += comm.amount;
      }
    });

    return totals;
  };

  return {
    data,
    totalCount,
    filters,
    loading,
    error,
    updateFilters,
    getSummaryMetrics,
    refresh: fetchCommissions,
  };
}
