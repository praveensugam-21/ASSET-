import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Box, Users, ChevronLeft, ChevronRight, LogOut, Menu,
  BarChart2, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  icon: React.ComponentType<any>;
  href: string;
  roles?: string[];
  isProcurement?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Assets', icon: Box, href: '/assets', roles: ['faculty', 'hod', 'verifier_sp', 'admin'] },
  { label: 'Reports', icon: BarChart2, href: '/analytics', roles: ['apex_approver'] },
  { label: 'My Profile', icon: User, href: '/profile' },
  { label: 'Users', icon: Users, href: '/admin/users', roles: ['admin'] },
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter(
    (item) => {
      if (item.isProcurement && user?.role?.group_key !== 'admin') {
        return false;
      }
      return !item.roles || (user?.role && item.roles.includes(user.role.group_key));
    }
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={`flex flex-col h-full sidebar-bg ${mobile ? 'w-72' : collapsed ? 'w-16' : 'w-64'} transition-all duration-300`}
    >
      {/* Branding */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-300 bg-white ${collapsed && !mobile ? 'justify-center' : ''}`}>
        <img src="/NITLOGO.png" alt="NIT Logo" className="w-12 h-12 object-contain flex-shrink-0" />
        {(!collapsed || mobile) && (
          <div>
            <div className="text-lg font-black text-[#1a3a6b] tracking-tight leading-none">NIT Inventory</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">NIT Tiruchirappalli</div>
          </div>
        )}
      </div>

      {/* Role badge */}
      {(!collapsed || mobile) && user?.role && (
        <div className="px-4 pt-4">
          <div className="px-3 py-1.5 bg-white border border-slate-200 text-xs text-slate-700 font-medium text-center">
            {user.role.name}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visibleItems.filter(item => !item.isProcurement).map((item) => {
          const active = item.href === '/dashboard'
            ? location.pathname === '/dashboard'
            : item.href === '/assets'
              ? location.pathname === '/assets' || (location.pathname.startsWith('/assets/') && !location.pathname.startsWith('/assets/import'))
              : location.pathname === item.href || location.pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={`${active ? 'nav-item-active' : 'nav-item'} ${collapsed && !mobile ? 'justify-center px-2' : ''}`}
              title={collapsed && !mobile ? item.label : undefined}
            >
              <item.icon size={18} className={`${collapsed && !mobile ? '' : 'mr-3'} flex-shrink-0`} />
              {(!collapsed || mobile) && (
                <span>{item.label}</span>
              )}
            </Link>
          );
        })}


      </nav>

      {/* User footer */}
      <div className={`border-t border-slate-300 p-3 bg-white ${collapsed && !mobile ? 'flex flex-col items-center gap-2' : ''}`}>
        {!collapsed || mobile ? (
          <div className="flex items-center gap-3 w-full">
            <Link to="/profile" className="w-8 h-8 bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-[#1a3a6b] flex-shrink-0 hover:bg-blue-200 transition-colors rounded-sm" title="My Profile Settings">
              {user?.name?.charAt(0).toUpperCase()}
            </Link>
            <div className="flex-1 min-w-0">
              <Link to="/profile" className="text-xs font-bold text-slate-800 truncate hover:text-[#1a3a6b] hover:underline block">{user?.name}</Link>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition-colors p-1" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link to="/profile" className="w-8 h-8 bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-[#1a3a6b] flex-shrink-0 hover:bg-blue-200 transition-colors rounded-sm" title="My Profile Settings">
              {user?.name?.charAt(0).toUpperCase()}
            </Link>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition-colors p-2" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen formal-bg overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col flex-shrink-0 border-r border-slate-300 z-20 shadow-sm relative bg-slate-100">
        <Sidebar />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-20 -right-3 w-6 h-6 bg-white border border-slate-300 text-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-50 hover:text-[#1a3a6b]"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full z-50 md:hidden bg-slate-100 shadow-xl">
            <Sidebar mobile />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-300 shadow-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-slate-600 hover:text-[#1a3a6b]" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-sm font-bold text-[#1a3a6b] capitalize">
                {location.pathname.split('/').filter(Boolean).join(' / ') || 'Dashboard'}
              </h1>
              <p className="text-xs text-slate-500">NIT Inventory</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user?.role && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#1a3a6b] border border-blue-200">
                {user.role.name}
              </span>
            )}
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.department?.name || 'Central Office'}</div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          <div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
