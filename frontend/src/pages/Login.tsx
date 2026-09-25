import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { VayuSetuLogo } from '../components/common/VayuSetuLogo';
import { useAuth } from '../context/AuthContext';

interface LoginLocationState {
  from?: { pathname?: string };
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isAuthenticated) return <Navigate to="/vayusetu" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your official email address and password.');
      return;
    }

    if (!/^[^\s@]+@vayusetu\.gov\.in$/i.test(email.trim())) {
      setError('Use a valid VAYUSETU government email address.');
      return;
    }

    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);

    if (!success) {
      setError('Invalid credentials. Verify your official email and password.');
      return;
    }

    const state = location.state as LoginLocationState | null;
    navigate(state?.from?.pathname || '/vayusetu', { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F4F7FB] px-4 py-8 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(23,105,170,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(15,139,141,0.12),transparent_32%)]" />
      <div className="absolute inset-0 bg-light-grid opacity-40" />

      <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_24px_80px_-28px_rgba(15,37,64,0.35)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden bg-gradient-to-br from-[#0A2540] via-[#104F7D] to-[#1769AA] p-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]">
                <ShieldCheck className="h-4 w-4" /> Government of India
              </div>
              <h2 className="mt-10 max-w-md font-heading text-4xl font-extrabold leading-tight">
                Trusted airfare intelligence for public institutions.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-blue-100">
                A secure analytical workspace for sovereign price indexing, route monitoring and evidence-led policy decisions.
              </p>
            </div>
            <div className="border-t border-white/15 pt-6 text-xs text-blue-100">
              Secure institutional access · Session persistence · Role-based modules
            </div>
          </section>

          <section className="p-6 sm:p-10 lg:p-12">
            <div className="mb-8 flex justify-center lg:justify-start">
              <VayuSetuLogo variant="horizontal" size="lg" />
            </div>

            <div className="mb-7">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#1769AA]">
                Authorized Access Only
              </p>
              <h1 className="font-heading text-2xl font-extrabold leading-tight text-[#172033] sm:text-3xl">
                Government Airfare Price Index Portal
              </h1>
              <p className="mt-2 text-sm text-[#64748B]">Sign in with your assigned institutional credentials.</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-bold text-[#334155]">Official email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    placeholder="name@vayusetu.gov.in"
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] py-3 pl-10 pr-4 text-sm text-[#172033] outline-none transition focus:border-[#1769AA] focus:bg-white focus:ring-4 focus:ring-[#1769AA]/10 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-xs font-bold text-[#334155]">Password</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] py-3 pl-10 pr-11 text-sm text-[#172033] outline-none transition focus:border-[#1769AA] focus:bg-white focus:ring-4 focus:ring-[#1769AA]/10 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#172033]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-[#B91C1C]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769AA] px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#12558A] focus:outline-none focus:ring-4 focus:ring-[#1769AA]/20 disabled:cursor-wait disabled:opacity-70"
              >
                {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />}
                {isSubmitting ? 'Verifying access…' : 'Login to VAYUSETU'}
              </button>
            </form>

            <p className="mt-7 border-t border-[#E2E8F0] pt-5 text-center text-[11px] leading-5 text-[#64748B]">
              Access is restricted to authorized officials from MoSPI, NSO and RBI.
            </p>
            <Link to="/tickety" className="mt-4 block text-center text-sm font-bold text-[#1769AA]">Travelling? Check a fare with Tickety →</Link>
          </section>
        </div>
      </main>
    </div>
  );
}

