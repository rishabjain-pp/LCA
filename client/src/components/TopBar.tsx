import { useState } from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
}

export default function TopBar({ title, subtitle, rightContent }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full flex justify-between items-center px-8 h-20 bg-surface-bright/90 backdrop-blur-2xl border-b border-outline-variant/20">
      {/* Left: Title + Search */}
      <div className="flex items-center gap-8">
        <div>
          <h2 className="text-xl font-black text-primary font-headline tracking-tight leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-on-surface-variant font-medium">{subtitle}</p>}
        </div>
        <div className="relative hidden md:block">
          <span className="absolute inset-y-0 left-3 flex items-center text-outline">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </span>
          <input
            type="text"
            placeholder="Search customer records..."
            className="pl-10 pr-4 py-2 bg-surface-container-highest border-none rounded-full text-sm font-body w-72 focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline"
          />
        </div>
      </div>

      {/* Right: Status + Actions + User */}
      <div className="flex items-center gap-5">


        {rightContent}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary-container"></span>
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 w-80 bg-surface-container-lowest rounded-2xl shadow-ambient animate-slide-up overflow-hidden z-50">
              <div className="p-4 border-b border-surface-container">
                <p className="font-bold text-sm text-primary font-headline">Notifications</p>
              </div>
              {['Critical call escalation: AC-004 needs supervisor.', 'Queue wait time exceeded 5 min threshold.', 'Agent Brian Wong call time over 12 min.'].map((n, i) => (
                <div key={i} className="px-4 py-3 hover:bg-surface-container-low transition-colors border-b border-surface-container/50 last:border-0">
                  <p className="text-sm text-on-surface">{n}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{i === 0 ? 'Just now' : i === 1 ? '2 min ago' : '5 min ago'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-outline-variant/30">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-primary font-headline leading-none">Sarah Jenkins</p>
            <p className="text-[10px] text-on-tertiary-container font-bold uppercase tracking-wider mt-0.5">Available</p>
          </div>
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm font-headline">
            SJ
          </div>
        </div>
      </div>
    </header>
  );
}
