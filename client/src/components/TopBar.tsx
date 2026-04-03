import { useState, useEffect } from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  notifications?: { id: string; text: string; time: string; color: string }[];
  onNotificationClick?: (id: string) => void;
}

export default function TopBar({ title, subtitle, rightContent, notifications = [], onNotificationClick }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Check if there are any IDs in notifications that are NOT in readIds
  const hasUnread = notifications.some(n => !readIds.has(n.id));

  const toggleNotifications = () => {
    setNotifOpen(!notifOpen);
  };

  const handleItemClick = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
    onNotificationClick?.(id);
    setNotifOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full flex justify-between items-center px-8 h-20 bg-surface-bright/90 backdrop-blur-2xl border-b border-outline-variant/20">
      {/* Left: Title + Search */}
      <div className="flex items-center gap-8">
        <div>
          <h2 className="text-xl font-black text-primary font-headline tracking-tight leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-on-surface-variant font-medium">{subtitle}</p>}
        </div>

      </div>

      {/* Right: Status + Actions + User */}
      <div className="flex items-center gap-5">


        {rightContent}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={toggleNotifications}
            className="relative p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {hasUnread && notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary-container"></span>}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 w-80 bg-surface-container-lowest rounded-2xl shadow-ambient animate-slide-up overflow-hidden z-50 border border-surface-container">
              <div className="p-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low">
                <p className="font-bold text-sm text-primary font-headline uppercase tracking-widest">Notifications</p>
                {notifications.length > 0 && <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">LATEST ALERTS</span>}
              </div>
              {notifications.length > 0 ? notifications.map((n, i) => {
                const isRead = readIds.has(n.id);
                return (
                  <button
                    key={i}
                    onClick={() => handleItemClick(n.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors border-b border-surface-container/50 last:border-0 group ${!isRead ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${isRead ? 'bg-outline-variant' : n.color}`}></div>
                      <div className="flex-1">
                        <p className={`text-sm leading-snug ${isRead ? 'text-on-surface-variant font-normal' : 'text-on-surface font-bold'}`}>{n.text}</p>
                        <p className="text-[10px] text-on-surface-variant mt-1 font-bold">{n.time}</p>
                      </div>
                      {!isRead && <span className="text-[8px] font-black text-primary uppercase">New</span>}
                    </div>
                  </button>
                );
              }) : (
                <div className="p-8 text-center text-on-surface-variant text-sm italic">
                  No new alerts
                </div>
              )}
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
