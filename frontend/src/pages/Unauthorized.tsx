import { ArrowLeft, ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Unauthorized() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] px-4">
      <section className="w-full max-w-lg rounded-3xl border border-[#E2E8F0] bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-[#DC2626]">
          <ShieldX className="h-10 w-10" />
        </div>
        <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-[#DC2626]">Restricted module</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-[#172033]">403 - Unauthorized Access</h1>
        <p className="mt-4 text-sm leading-6 text-[#64748B]">You do not have permission to access this module.</p>
        <Link
          to="/vayusetu"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#1769AA] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#12558A]"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Dashboard
        </Link>
      </section>
    </main>
  );
}

