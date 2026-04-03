import { NavLink, useNavigate } from 'react-router-dom';

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/active-calls', icon: 'call', label: 'Active Calls' },
  { to: '/call-panel', icon: 'headset_mic', label: 'Call Panel' },
];

export default function SideNav() {
  const navigate = useNavigate();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col py-6 glass-nav z-50 border-r border-outline-variant/20">
      {/* Logo */}
      <div className="px-6 mb-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[18px]">wifi</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-primary font-headline">WowWay</h1>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'nav-item-active' : 'nav-item'
            }
          >
            <span className={`material-symbols-outlined text-[22px]`}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Live indicator */}
      <div className="mx-3 mb-4 px-4 py-3 bg-tertiary/5 rounded-xl flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-on-tertiary-container live-dot"></span>
        <span className="text-[10px] font-black text-on-tertiary-fixed-variant uppercase tracking-widest">Live Sync Active</span>
      </div>

      {/* Emergency + Footer */}
      <div className="px-3 space-y-1">

        <div className="border-t border-outline-variant/30 pt-3 space-y-1">

          <button
            onClick={() => navigate('/login')}
            className="nav-item w-full text-left text-error hover:text-error hover:bg-error-container/30"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
