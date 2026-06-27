import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Check, ArrowRight, UserPlus, Calendar } from 'lucide-react';
import api from '../api/axios';
import { API_ENDPOINTS } from '../utils/constants';

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Frontend UI states
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successToken, setSuccessToken] = useState('');

  // Calculate age verification (18+)
  const validateAge = (birthDateString: string): boolean => {
    if (!birthDateString) return false;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  // Live password strength calculation
  const getPasswordStrength = (pass: string): { strength: 'weak' | 'fair' | 'strong'; color: string; label: string } => {
    if (!pass) return { strength: 'weak', color: 'bg-slate-200', label: '' };
    if (pass.length < 6) return { strength: 'weak', color: 'bg-red-500 w-1/3', label: 'Weak (min 8 chars)' };
    
    // Check various characteristics
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasNumbers = /\d/.test(pass);
    const hasSpecial = /[!@#$%^&*()_+{}[\]:;<>.,?]/.test(pass);
    
    const criteriaCount = [hasUpperCase, hasNumbers, hasSpecial, pass.length >= 10].filter(Boolean).length;
    
    if (pass.length < 8) {
      return { strength: 'weak', color: 'bg-red-500 w-1/3', label: 'Weak' };
    }
    if (criteriaCount >= 3) {
      return { strength: 'strong', color: 'bg-emerald-500 w-full', label: 'Strong' };
    }
    return { strength: 'fair', color: 'bg-amber-500 w-2/3', label: 'Fair' };
  };

  const strengthMeta = getPasswordStrength(password);

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!fullName.trim()) errors.fullName = 'Full Name is required.';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) errors.email = 'Valid Email is required.';
    
    if (!dob) {
      errors.dob = 'Date of birth is required.';
    } else if (!validateAge(dob)) {
      errors.dob = 'You must be at least 18 years old to join Zimplexline.';
    }

    const phoneDigits = phoneNumber.replace(/\D/g, '');
    if (!phoneNumber.trim() || !/^[+\d\s\-]+$/.test(phoneNumber.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.phoneNumber = 'Please enter a valid phone number.';
    }

    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim(),
        dob,
        phoneNumber: phoneNumber.trim(),
        password,
      };

      const response = await api.post(API_ENDPOINTS.auth.signup, payload);
      if (response.data?.success && response.data?.data?.token) {
        setSuccessToken(response.data.data.token);
        setIsSuccess(true);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      const msg = err.response?.data?.message || 'An error occurred during network setup. Please try again.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToDashboard = async () => {
    if (successToken) {
      await login(successToken);
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-6 w-6 stroke-[3]" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">Welcome to Zimplexline</h2>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            Your admin account has been created and verified. Your administrative and commission tracking network is ready.
          </p>
          <div className="mt-8">
            <button
              onClick={handleProceedToDashboard}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-slate-50">
      
      {/* LEFT COLUMN: Branding Area */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between bg-slate-900 px-12 py-16 text-white bg-radial from-slate-950 to-slate-900 relative overflow-hidden select-none">
        {/* Subtle glowing gradients */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        {/* Brand header logo */}
        <div className="flex items-center">
          <img src="/logo.jpeg" alt="Zimplexline" className="h-12 w-auto object-contain brightness-0 invert" />
        </div>

        {/* Feature listings */}
        <div className="my-auto space-y-8 z-10 max-w-md">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.15]">
            Start your affiliate commission network today.
          </h1>
          
          <ul className="space-y-6">
            <li className="flex items-start gap-3.5">
              <div className="mt-1 rounded-full bg-blue-500/15 p-1 text-blue-400 border border-blue-500/20">
                <Check className="h-4 w-4 stroke-[3]" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">Multi-level commission tracking</p>
                <p className="text-sm text-slate-400 mt-1">Track conversions, deposits, and withdrawal earnings down infinitely deep teams.</p>
              </div>
            </li>
            <li className="flex items-start gap-3.5">
              <div className="mt-1 rounded-full bg-blue-500/15 p-1 text-blue-400 border border-blue-500/20">
                <Check className="h-4 w-4 stroke-[3]" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">Automated calculations, zero manual work</p>
                <p className="text-sm text-slate-400 mt-1">Accurate, tier-based LKR payout formulas automatically evaluated in real-time.</p>
              </div>
            </li>
            <li className="flex items-start gap-3.5">
              <div className="mt-1 rounded-full bg-blue-500/15 p-1 text-blue-400 border border-blue-500/20">
                <Check className="h-4 w-4 stroke-[3]" />
              </div>
              <div>
                <p className="font-semibold text-slate-200">Full team oversight from one dashboard</p>
                <p className="text-sm text-slate-400 mt-1">Review verifications, inspect transactions, and maintain an audit log of all network events.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-500 font-mono">
          Zimplexline Affiliate Engine v1.0 • Sri Lankan Rupee (LKR) Native
        </p>
      </div>

      {/* RIGHT COLUMN: Interactive Registration Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-12 xl:px-16 overflow-y-auto">
        <div className="w-full max-w-2xl space-y-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-md">
          <div>
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-mono font-bold text-base">Z</div>
              <span className="text-lg font-bold text-slate-900">Zimplexline</span>
            </div>
            
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Create Admin Account
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign up as Tenant Owner. Direct signup registers you under the{' '}
              <span className="font-semibold text-indigo-600 font-mono">ADMIN</span> role.
            </p>
          </div>

          {formError && (
            <div className="rounded-lg border border-rose-150 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
              {formError}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSignupSubmit}>
            
            {/* Row: Name and Email */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dilushan Perera"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                {fieldErrors.fullName && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.fullName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@zimplexline.com"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            {/* Date of Birth Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date of Birth (18+ required)
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
              </div>
              {fieldErrors.dob && (
                <p className="mt-1 text-xs text-rose-650 font-medium">{fieldErrors.dob}</p>
              )}
            </div>

            {/* Phone Number Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter your phone number"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
              />
              <p className="mt-1 text-[11px] text-slate-400">We may contact you on this number for account verification purposes</p>
              {fieldErrors.phoneNumber && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.phoneNumber}</p>
              )}
            </div>

            {/* Row: Passwords */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                {/* Live Password Strength Indicator bar */}
                {password && (
                  <div className="mt-2 text-left">
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div className={`h-1.5 rounded-full transition-all duration-300 ${strengthMeta.color}`} />
                    </div>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Strength: {strengthMeta.label}
                    </span>
                  </div>
                )}
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Form submission actions */}
            <button
              type="submit"
              disabled={submitting}
              className="group relative flex w-full justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:bg-slate-400 cursor-pointer"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Creating your administrator account...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <UserPlus className="h-4.5 w-4.5" />
                  <span>Create my network</span>
                </div>
              )}
            </button>

            {/* Back to signin redirection */}
            <div className="mt-4 text-center">
              <span className="text-xs text-slate-500">Already have an admin or agent account? </span>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-505 hover:underline transition"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
