import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { Badge } from '../components/Badge';
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Percent,
  CheckSquare,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
} from 'lucide-react';

interface SidebarItem {
  id: string; // Tab identifier
  label: string;
  icon: React.ComponentType<any>;
}

interface DashboardLayoutProps {
  id?: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  pendingCount?: number;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  id,
  activeTab,
  setActiveTab,
  children,
  pendingCount = 0,
}) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  // Define sidebar navigation items based on the user's role
  const getNavItems = (): SidebarItem[] => {
    switch (user.role) {
      case 'admin':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
          { id: 'commissions', label: 'Commissions', icon: Percent },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
          { id: 'audit_log', label: 'Audit Log', icon: History },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];
      case 'manager':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'team', label: 'My Team', icon: Users },
          { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
          { id: 'commissions', label: 'Commissions', icon: Percent },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
        ];
      case 'agent':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'team', label: 'My Team', icon: Users },
          { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
          { id: 'commissions', label: 'Commissions', icon: Percent },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
        ];
      case 'subagent':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'team', label: 'My Team', icon: Users },
          { id: 'transactions', label: 'My Transactions', icon: ArrowLeftRight },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const activeItem = navItems.find((item) => item.id === activeTab) || navItems[0];

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Shared Sidebar contents (renders desktop and mobile)
  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-white">
      {/* Brand area */}
      <div className="p-6 flex items-center gap-2 border-b border-[#E2E8F0] shrink-0">
        <div className="w-8 h-8 bg-[#0F172A] rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">Z+</span>
        </div>
        <h1 className="text-[#0F172A] font-bold text-xl tracking-tight">Zimplexline</h1>
      </div>

      {/* User profile section */}
      <div className="p-4 flex items-center gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] select-none">
        <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white font-semibold text-sm">
          {getInitials(user.fullName)}
        </div>
        <div>
          <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider leading-none">
            {user.role}
          </p>
          <p className="text-sm font-semibold text-[#0F172A] mt-1 leading-tight">
            {user.fullName}
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-[#F1F5F9] text-[#0F172A]'
                  : 'text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
              {item.id === 'verifications' && pendingCount > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-bold rounded-full font-mono">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout container footer */}
      <div className="p-4 border-t border-[#E2E8F0] shrink-0">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-3 py-2 text-[#64748B] hover:text-[#EF4444] transition-colors font-medium text-sm"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div id={id} className="min-h-screen bg-[#F1F5F9] text-[#334155] font-sans flex overflow-hidden">
      {/* Off-canvas mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-45 lg:hidden">
          {/* Backdrop screen overlay */}
          <div
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Dialog Panel drawer */}
          <div className="fixed inset-y-0 left-0 w-60 z-50 shadow-2xl transition-transform duration-300">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Desktop static Sidebar */}
      <aside className="hidden lg:block w-60 border-r border-[#E2E8F0] shrink-0 bg-white">
        <div className="sticky top-0 h-screen flex flex-col">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Main Right Area wrapper */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-8 shrink-0 select-none">
          {/* Mobile hamburger toggler */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-1.5 text-[#64748B] hover:bg-slate-100 transition"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-[#0F172A]">
              {activeItem ? activeItem.label : 'Dashboard'}
            </h2>
          </div>

          {/* User badge and actions */}
          <div className="flex items-center gap-4">
            {/* Nav notifications button */}
            <div className="relative">
              <button
                onClick={() => setActiveTab('verifications')}
                className="rounded-full p-2 text-[#64748B] hover:bg-slate-50 hover:text-slate-600 transition"
                title={`${pendingCount} Pending Verifications`}
              >
                <Bell className="h-5 w-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#3B82F6] border-2 border-white rounded-full"></span>
                )}
              </button>
            </div>

            <div className="h-8 w-[1px] bg-[#E2E8F0]"></div>

            {/* Avatar block circle */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3B82F6] text-white text-xs font-semibold">
                {getInitials(user.fullName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-[#0F172A] leading-none">{user.fullName}</p>
                <p className="text-[10px] text-[#64748B] mt-1 font-mono leading-none uppercase tracking-wider">{user.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard inner background */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#F1F5F9]">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
