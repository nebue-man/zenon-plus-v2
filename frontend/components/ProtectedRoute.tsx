import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-sm font-medium text-slate-500">Initializing Zimplexline secure session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page and remember original destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If specific roles are required, check role accessibility
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate landing depending on role
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
