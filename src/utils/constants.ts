/**
 * Centralized constant values and API endpoint paths for Zenon Plus
 */

export const COMMISSION_RATES = {
  manager: {
    ownDeposit: 0.03,        // 3%
    ownWithdrawal: 0.01,     // 1%
    directAgentDeposit: 0.01, // 1%
    directAgentWithdrawal: 0.004, // 0.4%
    deepDeposit: 0.003,      // 0.3%
    deepWithdrawal: 0.001,   // 0.1%
  },
  agent: {
    monthlyUnlockThreshold: 10000, // 10,000 LKR own deposits needed
    directSubagentDepositLow: 0.025, // 2.5% if subagent deposits < 20k LKR
    directSubagentDepositHigh: 0.03, // 3% if subagent deposits >= 20k LKR
    directSubagentDepositThreshold: 20000, // 20,000 LKR subagent monthly volume threshold
    directSubagentWithdrawal: 0.01, // 1%
    deepDeposit: 0.003,      // 0.3%
    deepWithdrawal: 0.001,   // 0.1%
  },
  promoReferral: 0.10, // 10% for promo referrals in Phase 2
};

export const CAPACITY_LIMITS = {
  manager: 5,   // max 5 direct agents
  agent: 10,    // max 10 direct sub-agents
};

export const API_ENDPOINTS = {
  auth: {
    signup: '/auth/signup',
    login: '/auth/login',
    register: '/auth/register',
    me: '/auth/me',
    parentInfo: (parentId: string) => `/auth/parent-info/${parentId}`,
    verify: (userId: string) => `/auth/verify/${userId}`,
    resubmitId: '/auth/resubmit-id',
  },
  invite: {
    generate: '/auth/invite/generate',
    validate: (token: string) => `/auth/invite/validate/${token}`,
    info: (token: string) => `/auth/invite/info/${token}`,
    myInvites: '/auth/invite/my-invites',
    deactivate: (token: string) => `/auth/invite/deactivate/${token}`,
  },
  dashboard: {
    summary: '/dashboard/summary',
    team: '/dashboard/team',
    earningsHistory: '/dashboard/earnings-history',
    pendingVerifications: '/dashboard/pending-verifications',
    subagentThresholds: '/dashboard/subagent-thresholds',
    agentUnlockStatus: '/dashboard/agent-unlock-status',
  },
  transactions: {
    list: '/transactions',
    create: '/transactions',
    detail: (id: string) => `/transactions/${id}`,
  },
  commissions: {
    list: '/commissions',
  },
  hierarchy: {
    downline: (userId: string) => `/hierarchy/downline/${userId}`,
    capacity: (userId: string) => `/hierarchy/capacity/${userId}`,
  },
  bankSlips: {
    submit: '/bank-slips',
    my: '/bank-slips/my',
    reviewQueue: '/bank-slips/review-queue',
    review: (id: string) => `/bank-slips/${id}/review`,
  },
  admin: {
    users: '/admin/users',
    userById: (id: string) => `/admin/users/${id}`,
    transactions: '/admin/transactions',
    transactionsManual: '/admin/transactions/manual',
    commissions: '/admin/commissions',
    auditLogs: '/admin/audit-logs',
    systemStats: '/admin/system-stats',
  },
};
