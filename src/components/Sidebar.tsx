import { Boxes, Layers, HardDrive, Database, Network, Sun, Moon, Globe } from 'lucide-react';
import { useI18n, LANGS, type Lang } from '../i18n';
import type { Theme } from '../hooks/useTheme';
import { Logo } from './Logo';

export type ViewName = 'containers' | 'compose' | 'images' | 'volumes' | 'networks';

interface Props {
  view: ViewName;
  onNavigate: (v: ViewName) => void;
  engine: { ok: boolean; version?: string; error?: string };
  runningCount: number;
  totalCount: number;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Sidebar({
  view,
  onNavigate,
  engine,
  runningCount,
  totalCount,
  theme,
  onToggleTheme,
}: Props) {
  const { t, lang, setLang } = useI18n();

  const items: { key: ViewName; icon: typeof Boxes; label: string; badge?: string }[] = [
    {
      key: 'containers',
      icon: Boxes,
      label: t('nav_containers'),
      badge: `${runningCount}/${totalCount}`,
    },
    { key: 'compose', icon: Layers, label: t('nav_compose') },
    { key: 'images', icon: HardDrive, label: t('nav_images') },
    { key: 'volumes', icon: Database, label: t('nav_volumes') },
    { key: 'networks', icon: Network, label: t('nav_networks') },
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">
          <Logo size={24} />
        </div>
        <div className="logo-name">
          Dock<span>Desk</span>
        </div>
      </div>

      {items.map(({ key, icon: Icon, label, badge }) => (
        <button
          key={key}
          className={`nav-item ${view === key ? 'active' : ''}`}
          onClick={() => onNavigate(key)}
          data-testid={`nav-${key}`}
        >
          <Icon size={17} />
          {label}
          {badge && <span className="nav-badge">{badge}</span>}
        </button>
      ))}

      <div className="sidebar-settings">
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? t('theme_light') : t('theme_dark')}
          data-testid="theme-toggle"
        >
          <span className={`theme-opt ${theme === 'light' ? 'active' : ''}`} data-testid="theme-sun">
            <Sun size={14} />
          </span>
          <span className={`theme-opt ${theme === 'dark' ? 'active' : ''}`} data-testid="theme-moon">
            <Moon size={14} />
          </span>
        </button>

        <label className="lang-select" title={t('language')}>
          <Globe size={14} />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            data-testid="lang-select"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="sidebar-footer">
        <div className="footer-line" data-testid="engine-status">
          <span className={`engine-dot ${engine.ok ? 'ok' : ''}`} />
          {engine.ok ? `Docker ${engine.version}` : t('engine_unavailable')}
        </div>
        <div className="footer-line app-version" data-testid="app-version">
          DockDesk v{__APP_VERSION__}
        </div>
      </div>
    </aside>
  );
}
