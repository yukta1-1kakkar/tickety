import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { Permission } from '../../constants/auth';
import { ROLE_LABELS } from '../../constants/auth';
import { useAuth } from '../../context/AuthContext';
import { VayuSetuLogo } from './VayuSetuLogo';

interface NavigationItem {
  to: string;
  label: string;
  permission: Permission;
}

const NAVIGATION: NavigationItem[] = [
  { to: '/vayusetu', label: 'Overview', permission: 'dashboard' },
  { to: '/vayusetu/index', label: 'Airfare Index', permission: 'airfare-index' },
  { to: '/vayusetu/routes', label: 'Routes', permission: 'route-comparison' },
  { to: '/vayusetu/heatmap', label: 'Heatmap', permission: 'dashboard' },
  { to: '/vayusetu/lead-time-elasticity', label: 'Lead Time', permission: 'lead-time-elasticity' },
  { to: '/vayusetu/api-explorer', label: 'Data', permission: 'api-explorer' },
  { to: '/vayusetu/cpi', label: 'CPI Comparison', permission: 'price-trends' },
  { to: '/vayusetu/scraper-control', label: 'Scraper Control Panel', permission: 'scraping-scheduler' },
  { to: '/vayusetu/user-management', label: 'User Management', permission: 'user-management' },
  { to: '/vayusetu/route-basket', label: 'Route Basket & Weights', permission: 'route-basket' },
  { to: '/vayusetu/downloads', label: 'Downloads', permission: 'downloads' },
];

function UserSummary() {
  const { user } = useAuth();
  if (!user) return null;

  const initials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1769AA] text-xs font-extrabold text-white">{initials}</div>
      <div className="min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-bold text-[#172033]">{user.name}</span>
          <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-[#1769AA]">
            {user.role === 'MOSPI_ADMIN' ? 'ADMIN' : user.role}
          </span>
        </div>
        <div className="truncate text-[10px] text-[#64748B]">{user.email}</div>
      </div>
    </div>
  );
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const allowedLinks = NAVIGATION.filter((item) => hasPermission(item.permission));
  const primaryLinks = allowedLinks.filter(link => NAVIGATION.indexOf(link) < 6);
  const overflowLinks = allowedLinks.filter(link => NAVIGATION.indexOf(link) >= 6);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${isActive ? 'bg-[#1769AA] text-white shadow-xs' : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9]'}`;

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b border-[#E2E8F0] transition-all duration-200 ${isScrolled ? 'bg-white/95 py-2.5 shadow-sm backdrop-blur-md' : 'bg-white py-3.5'}`}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/vayusetu" className="shrink-0 select-none"><VayuSetuLogo variant="compact" size="md" /></Link>

        <nav className="order-3 hidden w-full min-w-0 items-center gap-1 border-t border-[#E2E8F0] pt-2 lg:flex" aria-label="VayuSetu navigation">
          {primaryLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/vayusetu'} className={navClass}>{link.label}</NavLink>
          ))}
          {overflowLinks.length > 0 && (
            <div className="relative">
              <button onClick={() => setModulesOpen((open) => !open)} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition ${overflowLinks.some((link) => link.to === location.pathname) ? 'bg-[#1769AA] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#172033]'}`}>
                Modules <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {modulesOpen && (
                <div className="absolute left-1/2 top-11 grid w-96 -translate-x-1/2 grid-cols-2 gap-1 rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-xl">
                  {overflowLinks.map((link) => <NavLink key={link.to} to={link.to} className={navClass}>{link.label}</NavLink>)}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link to="/" className="rounded-md border border-[#B8DCD5] bg-[#EFF9F5] px-3 py-2 text-xs font-bold text-[#0F766E] hover:bg-[#E6F5F1]">Back to Tickety</Link>
          <NavLink to="/vayusetu/user-guide" className={({ isActive }) => `hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition md:flex ${isActive ? 'border-[#1769AA] bg-[#1769AA] text-white' : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-blue-200 hover:bg-blue-50 hover:text-[#1769AA]'}`} aria-label="Open User Guide">
            <BookOpen className="h-3.5 w-3.5" /> Help
          </NavLink>
          <div className="relative hidden lg:block">
            <button onClick={() => setAccountOpen((open) => !open)} className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-1.5 pl-1.5 pr-2 transition hover:border-[#CBD5E1] hover:bg-white" aria-label="Open user menu">
              <UserSummary /><ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
            </button>
            {accountOpen && user && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-xl">
                <div className="border-b border-[#F1F5F9] px-3 py-2 text-[10px] text-[#64748B]">
                  <div className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-[#1769AA]"><ShieldCheck className="h-3 w-3" /> {ROLE_LABELS[user.role]}</div>
                  Authenticated government session
                </div>
                <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[#DC2626] hover:bg-red-50"><LogOut className="h-4 w-4" /> Logout</button>
              </div>
            )}
          </div>
          <button onClick={() => setMobileMenuOpen((open) => !open)} className="rounded-xl border border-[#E2E8F0] p-2 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#172033] lg:hidden" aria-label="Toggle navigation menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="max-h-[calc(100vh-64px)] overflow-y-auto border-b border-[#E2E8F0] bg-white px-4 pb-4 pt-3 shadow-lg lg:hidden">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"><UserSummary /></div>
            <div className="grid gap-1 sm:grid-cols-2">
              {allowedLinks.map((link) => <NavLink key={link.to} to={link.to} end={link.to === '/vayusetu'} className={navClass}>{link.label}</NavLink>)}
              <NavLink to="/vayusetu/user-guide" className={navClass}><span className="inline-flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> User Guide</span></NavLink>
            </div>
            <button onClick={handleLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-[#DC2626]"><LogOut className="h-4 w-4" /> Logout</button>
          </div>
        </div>
      )}
    </header>
  );
}
