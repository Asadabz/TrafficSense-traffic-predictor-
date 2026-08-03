import { Link, useLocation } from 'wouter';
import { Moon, Sun, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface HeaderProps {
  toggleTheme: () => void;
  theme: 'dark' | 'light';
}

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="hidden sm:flex flex-col items-end leading-none gap-0.5 select-none" title="Local system time">
      <span className="text-sm font-bold font-mono tracking-tight text-foreground tabular-nums">{timeStr}</span>
      <span className="text-[10px] text-muted-foreground font-medium tracking-wide">{dateStr}</span>
    </div>
  );
}

export default function Header({ toggleTheme, theme }: HeaderProps) {
  const [location] = useLocation();

  return (
    <header className="border-b border-border/60 bg-card/80 backdrop-blur-xl flex items-center justify-between px-5 py-0 shrink-0 h-14 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group" data-testid="nav-logo">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:shadow-sky-500/40 transition-shadow">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-sky-400 to-teal-400 bg-clip-text text-transparent">TrafficSense</span>
            <span className="text-[9px] font-medium text-muted-foreground/70 uppercase tracking-widest leading-tight">AI Traffic Prediction</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-0.5">
          {[
            { href: '/', label: 'Dashboard' },
            { href: '/historical', label: 'Historical Trends' },
          ].map(({ href, label }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative px-4 py-4 text-sm font-medium transition-colors ${
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-sky-500 to-teal-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Live clock */}
        <LiveClock />

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-border/60" />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          data-testid="theme-toggle"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </header>
  );
}
