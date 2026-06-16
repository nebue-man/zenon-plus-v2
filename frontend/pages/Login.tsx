import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Eye, EyeOff, AlertTriangle, XCircle, Lock } from 'lucide-react';
import api from '../api/axios';
import { API_ENDPOINTS } from '../utils/constants';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Custom error states described in spec
  const [errorStatus, setErrorStatus] = useState<'PENDING' | 'REJECTED' | 'INVALID' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [generalError, setGeneralError] = useState('');

  // Access path to redirect back after successful login
  const from = location.state?.from?.pathname || null;

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setGeneralError('Please enter both your identifier and password.');
      return;
    }

    setSubmitting(true);
    setGeneralError('');
    setErrorStatus(null);
    setRejectReason('');

    try {
      const response = await api.post(API_ENDPOINTS.auth.login, {
        identifier: identifier.trim(),
        password,
      });

      if (response.data?.success && response.data?.data?.token) {
        await login(response.data.data.token);
        // Redirect logic will be handled by useEffect above
      }
    } catch (err: any) {
      console.error('Login request failed:', err);
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message || 'Login failed. Please check your network connection.';

      if (code === 'ACCOUNT_PENDING') {
        setErrorStatus('PENDING');
      } else if (code === 'ACCOUNT_REJECTED') {
        setErrorStatus('REJECTED');
        setRejectReason(err.response?.data?.data?.rejectReason || err.response?.data?.rejectReason || 'No details provided.');
      } else if (code === 'INVALID_CREDENTIALS') {
        setErrorStatus('INVALID');
      } else {
        setGeneralError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        
        {/* Brand Header */}
        <div className="text-center select-none">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-mono font-black text-2xl shadow-md">
            ZP
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
            Zimplexline
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Affiliate network management, simplified
          </p>
        </div>

        {/* Form Container Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
          
          {/* Error & Verification Banners */}
          {errorStatus === 'PENDING' && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <p className="font-semibold">Verification Pending</p>
                <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
                  Your account is pending verification by your manager. Please verify your submitted ID or wait for confirmation.
                </p>
              </div>
            </div>
          )}

          {errorStatus === 'REJECTED' && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <XCircle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-semibold">Account Rejected</p>
                <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">
                  Your ID verification was rejected. Reason: <span className="font-medium">{rejectReason}</span>
                </p>
              </div>
            </div>
          )}

          {generalError && (
            <div className="mb-6 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-750">
              {generalError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Identifier input */}
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                User ID or Full Name
              </label>
              <div className="mt-1">
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. ZP-ADM-001 or Dilu Dilshan"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password
                </label>
              </div>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-11 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                
                {/* Hide / Show password action */}
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              
              {/* Inline credentials invalidation feedback */}
              {errorStatus === 'INVALID' && (
                <p className="mt-1.5 text-xs font-semibold text-rose-600">
                  Incorrect credentials. Please verify your login details.
                </p>
              )}
            </div>

            {/* Submit CTA button */}
            <button
              type="submit"
              disabled={submitting}
              className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 cursor-pointer"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-blue-200" />
                  <span>Access Platform</span>
                </div>
              )}
            </button>
          </form>

          {/* Setup admin trigger */}
          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <Link
              to="/signup"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition"
            >
              Create your network → Sign up as Admin
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
