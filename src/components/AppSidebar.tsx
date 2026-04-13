import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Monitor, BarChart3, AlertTriangle, ScrollText, Settings } from 'lucide-react';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Live Feed', url: '/monitoring', icon: Monitor },
  { title: 'Analytics', url: '/analytics', icon: BarChart3 },
  { title: 'Alert Center', url: '/alerts', icon: AlertTriangle },
  { title: 'System Logs', url: '/logs', icon: ScrollText },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <nav className="w-56 min-h-screen flex flex-col gap-8 border-r border-border/20 p-4 bg-sidebar shrink-0">
      <div className="flex items-center gap-2 px-2 pt-2">
        <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
        <h1 className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground">
          Crowd Sence
        </h1>
      </div>

      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <li key={item.url}>
              <RouterNavLink
                to={item.url}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
              </RouterNavLink>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto px-2">
        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
          v1.0.0 • YOLOv8
        </div>
      </div>
    </nav>
  );
}
