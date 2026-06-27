import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Upload, Image as ImageIcon, Check, ArrowRight, FileCheck } from 'lucide-react';
import api from '../api/axios';
import { API_ENDPOINTS } from '../utils/constants';
import { InviteInfo } from '../types';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  agent: 'Agent',
  subagent: 'Sub-agent',
};

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-violet-100 text-violet-800 border-violet-200',
  agent: 'bg-blue-100 text-blue-800 border-blue-200',
  subagent: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState('');

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [promoScreenshot, setPromoScreenshot] = useState<string | null>(null);
  const [promoScreenshotName, setPromoScreenshotName] = useState('');

  const [dragActive, setDragActive] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchInviteInfo = async () => {
      if (!token) {
        setInviteError('Invalid invite link. Please ask your contact to send you a new invitation.');
        setInviteLoading(false);
        return;
      }

      try {
        const response = await api.get(API_ENDPOINTS.invite.info(token));
        if (response.data?.success) {
          const info: InviteInfo = response.data.data;
          if (!info.is_valid) {
            setInviteError(info.reason || 'This invite link is no longer valid.');
          } else {
            setInviteInfo(info);
          }
        } else {
          setInviteError('Could not validate invite link.');
        }
      } catch (err: any) {
        setInviteError(err.response?.data?.message || 'Failed to load invite details.');
      } finally {
        setInviteLoading(false);
      }
    };

    fetchInviteInfo();
  }, [token]);

  const validateAge = (birthDateString: string): boolean => {
    if (!birthDateString) return false;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 18;
  };

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFieldErrors(prev => ({ ...prev, promoScreenshot: 'Only JPG, PNG, and WebP images are accepted.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPromoScreenshot(reader.result as string);
      setPromoScreenshotName(file.name);
      setFieldErrors(prev => { const c = { ...prev }; delete c.promoScreenshot; return c; });
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (!dob) errors.dob = 'Date of birth is required.';
    else if (!validateAge(dob)) errors.dob = 'You must be at least 18 years old to join Zimplexline.';
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    if (!phoneNumber.trim() || !/^[+\d\s\-]+$/.test(phoneNumber.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.phoneNumber = 'Please enter a valid phone number.';
    }
    if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (!promoScreenshot) errors.promoScreenshot = 'Please upload your promo code screenshot to continue.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validateForm() || !inviteInfo) return;

    setSubmitting(true);
    try {
      const response = await api.post(API_ENDPOINTS.auth.register, {
        fullName: fullName.trim(),
        dob,
        phoneNumber: phoneNumber.trim(),
        password,
        confirmPassword,
        token,
        promoScreenshot,
      });
      if (response.data?.success) {
        setIsSuccess(true);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (inviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-transparent border-t-blue-600"></div>
          <p className="text-sm text-slate-500 font-medium">Validating invite link...</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-100">
            <Check className="h-6 w-6 stroke-[3] rotate-45" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-slate-900">Link Unavailable</h2>
          <p className="mt-2 text-sm text-slate-500">{inviteError}</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100 animate-bounce">
            <FileCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">Registration Submitted</h2>
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-left border border-slate-200">
            <p className="text-sm text-slate-600 leading-relaxed">
              Welcome to Zimplexline. Your promo code screenshot has been uploaded.{' '}
              <span className="font-semibold text-slate-900">{inviteInfo?.parent_name || 'Your manager'}</span>{' '}
              has been notified to review and activate your account.
            </p>
          </div>
          <div className="mt-8">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[inviteInfo?.intended_role || ''] || inviteInfo?.intended_role || '';
  const roleColor = ROLE_COLORS[inviteInfo?.intended_role || ''] || 'bg-slate-100 text-slate-800 border-slate-200';
  const expiryDate = inviteInfo?.expires_at ? new Date(inviteInfo.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">

        <div className="text-center select-none">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-mono font-black text-xl leading-none">
            Z
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-950">Join Zimplexline Network</h2>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-md">

          {/* Invitation banner */}
          <div className="mb-6 rounded-xl bg-blue-50/50 border border-blue-100 p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-900">Team Invitation</p>
            <p className="text-xs text-blue-800 leading-relaxed">
              You have been invited to join{' '}
              <span className="font-bold">{inviteInfo?.parent_name}</span>'s team on Zimplexline.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-blue-700">You are registering as:</span>
              <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${roleColor}`}>
                {roleLabel}
              </span>
            </div>
            {expiryDate && (
              <p className="text-[11px] text-blue-600">This invite expires on {expiryDate}</p>
            )}
          </div>

          {formError && (
            <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
              {formError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleRegisterSubmit}>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ruwan Gunawardena"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
              />
              {fieldErrors.fullName && <p className="mt-1 text-xs text-rose-600">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Date of Birth</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Calendar className="h-4 w-4" />
                </div>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
              </div>
              {fieldErrors.dob && <p className="mt-1 text-xs text-rose-600">{fieldErrors.dob}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter your phone number"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
              />
              <p className="mt-1 text-[11px] text-slate-400">We may contact you on this number for account verification purposes</p>
              {fieldErrors.phoneNumber && <p className="mt-1 text-xs text-rose-600">{fieldErrors.phoneNumber}</p>}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Password (min 8 chars)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                {fieldErrors.password && <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                />
                {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-rose-600">{fieldErrors.confirmPassword}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Promo Code Screenshot</label>
              <p className="mt-0.5 text-[11px] text-slate-400">Upload a screenshot showing your 1xBet registration with your promo code</p>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition ${
                  dragActive ? 'border-blue-500 bg-blue-50/20' : promoScreenshot ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/60'
                }`}
              >
                {promoScreenshot ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-24 w-36 overflow-hidden rounded-lg border border-slate-200">
                      <img src={promoScreenshot} referrerPolicy="no-referrer" alt="Screenshot Preview" className="h-full w-full object-cover" />
                    </div>
                    <span className="text-xs text-emerald-800 font-semibold">{promoScreenshotName || 'File uploaded'}</span>
                    <button
                      type="button"
                      onClick={() => { setPromoScreenshot(null); setPromoScreenshotName(''); }}
                      className="text-[10px] font-bold text-rose-500 hover:underline"
                    >
                      Change file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-1.5 text-xs text-slate-600 font-medium">
                      Drag file or{' '}
                      <label className="cursor-pointer font-bold text-blue-600 hover:underline">
                        <span>browse</span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          className="sr-only"
                          onChange={(e) => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }}
                        />
                      </label>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP up to 5MB</p>
                  </div>
                )}
              </div>
              {fieldErrors.promoScreenshot && <p className="mt-1 text-xs text-rose-600">{fieldErrors.promoScreenshot}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:bg-blue-400 cursor-pointer"
            >
              {submitting ? 'Registering...' : 'Register in Team'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
