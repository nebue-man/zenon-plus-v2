import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, CheckCircle, Users, Coins, TrendingUp, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';

type FormState = 'idle' | 'submitting' | 'success';

export default function DirectAgentRegister() {
  const [formState, setFormState] = useState<FormState>('idle');

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
    if (pw.length === 0) return { label: '', color: '', width: '0%' };
    if (pw.length < 6) return { label: 'Weak', color: 'bg-red-400', width: '25%' };
    if (pw.length < 10) return { label: 'Fair', color: 'bg-amber-400', width: '50%' };
    if (pw.length < 14) return { label: 'Good', color: 'bg-blue-400', width: '75%' };
    return { label: 'Strong', color: 'bg-emerald-400', width: '100%' };
  }

  function isAtLeast18(dobStr: string): boolean {
    const birth = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 18;
  }

  function handleFileChange(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrors((prev) => ({ ...prev, screenshot: 'Only JPG, PNG, or WebP files are accepted.' }));
      return;
    }
    setErrors((prev) => { const e = { ...prev }; delete e.screenshot; return e; });
    setScreenshotFile(file);
    setScreenshotName(file.name);
    setScreenshotPreview(URL.createObjectURL(file));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    if (!dob) e.dob = 'Date of birth is required.';
    else if (!isAtLeast18(dob)) e.dob = 'You must be at least 18 years old.';
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    if (!phoneNumber.trim() || !/^[+\d\s\-]+$/.test(phoneNumber.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      e.phoneNumber = 'Please enter a valid phone number.';
    }
    if (!password) e.password = 'Password is required.';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    if (!screenshotFile) e.screenshot = '1xBet registration screenshot is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setFormState('submitting');
    try {
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('date_of_birth', dob);
      formData.append('phone_number', phoneNumber.trim());
      formData.append('password', password);
      formData.append('confirm_password', confirmPassword);
      formData.append('promo_screenshot', screenshotFile!);

      await api.post('/auth/register/direct-agent', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFormState('success');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setServerError(msg);
      setFormState('idle');
    }
  }

  const strength = getPasswordStrength(password);

  if (formState === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-9 w-9 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Registration Submitted</h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              Your Direct Agent account is pending approval by the Admin. You will be able to login once your account has been reviewed and approved. This usually takes up to 24 hours.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center select-none">
          <img src="/logo.jpeg" alt="Zimplexline" className="mx-auto h-14 w-auto object-contain" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Register as a Direct Agent</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
            Build your own affiliate team of up to 10 sub-agents and earn commissions directly. No manager required.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 space-y-2">
          {[
            { icon: Coins, text: 'Earn 2.5% commission from sub-agent deposits' },
            { icon: TrendingUp, text: 'Earn 1% commission from sub-agent withdrawals' },
            { icon: Users, text: 'Build a team of up to 10 sub-agents' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 text-sm text-violet-800">
              <Icon className="h-4 w-4 text-violet-600 shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">

          {serverError && (
            <div className="mb-5 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {serverError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dilshan Kumara"
                className={`block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-3 focus:ring-blue-100 ${errors.fullName ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'}`}
              />
              {errors.fullName && <p className="mt-1 text-xs text-rose-600 font-medium">{errors.fullName}</p>}
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Date of Birth <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={`block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-3 focus:ring-blue-100 ${errors.dob ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'}`}
              />
              {errors.dob && <p className="mt-1 text-xs text-rose-600 font-medium">{errors.dob}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter your phone number"
                className={`block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-3 focus:ring-blue-100 ${errors.phoneNumber ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'}`}
              />
              <p className="mt-1 text-[11px] text-slate-400">We may contact you on this number for account verification purposes</p>
              {errors.phoneNumber && <p className="mt-1 text-xs text-rose-600 font-medium">{errors.phoneNumber}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className={`block w-full rounded-lg border pl-3.5 pr-11 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-3 focus:ring-blue-100 ${errors.password ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'}`}
                />
                <button type="button" className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-1.5 space-y-1">
                  <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                  </div>
                  <p className="text-[10px] text-slate-500">{strength.label}</p>
                </div>
              )}
              {errors.password && <p className="mt-1 text-xs text-rose-600 font-medium">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className={`block w-full rounded-lg border pl-3.5 pr-11 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-3 focus:ring-blue-100 ${errors.confirmPassword ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-blue-500'}`}
                />
                <button type="button" className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-rose-600 font-medium">{errors.confirmPassword}</p>}
            </div>

            {/* Promo Screenshot Upload */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                1xBet Registration Screenshot <span className="text-rose-500">*</span>
              </label>
              <p className="mb-2 text-[11px] text-slate-400">Upload a screenshot showing your 1xBet registration with your promo code</p>

              <div
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileChange(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition ${dragActive ? 'border-violet-500 bg-violet-50/20' : screenshotFile ? 'border-emerald-300 bg-emerald-50/10' : errors.screenshot ? 'border-rose-300 bg-rose-50/10' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/60'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
                />
                {screenshotFile ? (
                  <div className="flex flex-col items-center gap-2">
                    {screenshotPreview && (
                      <div className="h-20 w-32 overflow-hidden rounded-lg border border-slate-200">
                        <img src={screenshotPreview} alt="Screenshot preview" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <span className="text-xs text-emerald-800 font-semibold">{screenshotName}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setScreenshotFile(null); setScreenshotPreview(null); setScreenshotName(''); }}
                      className="text-[10px] font-bold text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-7 w-7 text-slate-400" />
                    <p className="mt-2 text-xs text-slate-600 font-medium">
                      Drag & drop or <span className="font-bold text-violet-600">browse</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP accepted</p>
                  </div>
                )}
              </div>
              {errors.screenshot && <p className="mt-1 text-xs text-rose-600 font-medium">{errors.screenshot}</p>}
            </div>

            <button
              type="submit"
              disabled={formState === 'submitting'}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition disabled:bg-violet-400 cursor-pointer"
            >
              {formState === 'submitting' ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit Registration'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <Link to="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
