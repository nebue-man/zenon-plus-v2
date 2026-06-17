export type UserRole = 'admin' | 'manager' | 'agent' | 'subagent';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type TransactionType = 'deposit' | 'withdrawal';

export interface User {
  id: string;
  fullName: string;
  email?: string;
  dob?: string;
  role: UserRole;
  status: UserStatus;
  parentId?: string;
  parentName?: string;
  childrenCount: number;
  joinedAt: string;
  idPhoto?: string;
  promo_screenshot_url?: string;
  rejectReason?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  type: TransactionType;
  amount: number;
  date: string;
  player_id?: string;
  bank_slip_url?: string;
  withdrawal_details?: {
    withdrawal_code: string;
    bank: string;
    branch: string;
    account_number: string;
  };
}

export interface Commission {
  id: string;
  transactionId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryRole: string;
  sourceUserId: string;
  sourceName: string;
  type: string; // e.g., 'own_deposit', 'direct_agent_deposit', 'deep_team_deposit'
  percentage: number;
  amount: number;
  date: string;
}

export interface DashboardSummary {
  totalUsers: number;
  managerCount: number;
  agentCount: number;
  subagentCount: number;
  transactionVolumeThisMonth: number;
  totalCommissionsPaidThisMonth: number;
  pendingVerifications: number;
  
  // Scoped to current user (for manager/agent/subagent)
  allTimeEarnings?: number;
  earningsFromOwn?: number;
  earningsFromDirect?: number;
  earningsFromDeep?: number;
  earningsTrend?: { date: string; amount: number }[];
  recentTransactions?: Transaction[];
}

export interface TeamMember {
  id: string;
  fullName: string;
  role: UserRole;
  joinedAt: string;
  status: UserStatus;
  monthlyVolume: number;
  commissionsGenerated: number;
  childrenCount: number;
}

export interface VerificationItem {
  id: string;
  fullName: string;
  role: UserRole;
  parentName?: string;
  submittedDate: string;
  idPhoto?: string;
  promo_screenshot_url?: string;
}

export interface SubagentThreshold {
  name: string;
  monthlyDeposits: number;
  progress: number; // monthlyDeposits / 20000 * 100
  target: number; // 20000 LKR
  rate: number; // 2.5 or 3
  status: 'standard' | 'high';
}

export interface AgentUnlockStatus {
  isUnlocked: boolean;
  currentDeposits: number;
  target: number; // 10000 LKR
  remaining: number;
  unlockDate?: string;
}

export interface AuditLog {
  id: string;
  actorName: string;
  action: string;
  targetName: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  code?: string;
  message?: string;
}

export interface InviteLink {
  id: string;
  token: string;
  invite_url: string;
  intended_role: string;
  is_used: boolean;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  used_by_name: string | null;
  used_at: string | null;
  status: 'active' | 'used' | 'expired' | 'inactive';
}

export interface InviteInfo {
  token: string;
  intended_role: string;
  parent_name: string;
  parent_role: string;
  expires_at: string;
  is_valid: boolean;
  reason?: string;
}

export interface GeneratedInvite {
  token: string;
  invite_url: string;
  intended_role: string;
  expires_at: string;
  capacity: { current: number; max: number };
}

export interface BankSlipRequest {
  id: string;
  amount: number;
  bankName?: string;
  slipUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedByName?: string;
  transactionId?: string;
}

export interface BankSlipReviewItem extends BankSlipRequest {
  submittedById: string;
  submittedByName: string;
  submittedByRole: string;
}
