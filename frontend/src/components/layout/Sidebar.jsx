import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { LogOut, Leaf, X, Menu } from 'lucide-react';

export default function Sidebar({ links, role }) {
  const { logout, userProfile } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const roleColors = {
    seller: 'from-green-800 to-green-900',
    admin: 'from-slate-800 to-slate-900',
    delivery: 'from-orange-800 to-orange-900',
    buyer: 'from-green-700 to-green-800',
  };

  const sidebarContent = (
    <aside
      className={`bg-gradient-to-b ${roleColors[role] || 'from-gray-800 to-gray-900'} text-white flex flex-col h-full shadow-xl`}
      style={{ minHeight: '100vh' }}
    >
      {/* Close btn on mobile */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 md:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <Leaf size={16} className="text-white" />
          </div>
          <span className="font-bold text-sm">Agro Assistant</span>
        </div>
        <button onClick={() => setMobileOpen(false)} className="text-white/70 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      {/* Logo (desktop only) */}
      <div className="hidden md:flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
          <Leaf size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">Agro Assistant</p>
          <p className="text-white/50 text-xs capitalize">{role} Panel</p>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          {userProfile?.profileImageUrl ? (
            <img src={userProfile.profileImageUrl} className="w-9 h-9 rounded-full object-cover border-2 border-white/20" alt="" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{userProfile?.displayName || 'User'}</p>
            <p className="text-white/50 text-xs truncate">{userProfile?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="text-base flex-shrink-0">{link.icon}</span>
            <span className="truncate">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/70 hover:bg-red-500/20 hover:text-red-200 transition-all duration-150 text-sm font-medium"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
        style={{ display: mobileOpen ? 'none' : undefined }}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Desktop sidebar — fixed */}
      <div className="hidden md:block fixed left-0 top-0 w-64 h-screen z-40">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed left-0 top-0 h-screen w-72 z-50 md:hidden transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
