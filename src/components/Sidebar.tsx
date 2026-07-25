import { useEffect, useState } from 'react';
import { Boxes, Layers, HardDrive, Database, Network, Sun, Moon, Globe, Eye, EyeOff } from 'lucide-react';
import { useI18n, LANGS, type Lang } from '../i18n';
import type { Theme } from '../hooks/useTheme';

export type ViewName = 'containers' | 'compose' | 'images' | 'volumes' | 'networks';

interface Props {
  view: ViewName;
  onNavigate: (v: ViewName) => void;
  engine: { ok: boolean; version?: string; error?: string };
  runningCount: number;
  totalCount: number;
  theme: Theme;
  onToggleTheme: () => void;
  projects: string[];
  privacyActive: boolean;
  privacyProject: string | null;
  onTogglePrivacy: (active: boolean) => void;
  onSelectPrivacyProject: (project: string | null) => void;
}

export function Sidebar({
  view,
  onNavigate,
  engine,
  runningCount,
  totalCount,
  theme,
  onToggleTheme,
  projects,
  privacyActive,
  privacyProject,
  onTogglePrivacy,
  onSelectPrivacyProject,
}: Props) {
  const { t, lang, setLang } = useI18n();
  const [trayEnabled, setTrayEnabled] = useState(true);

  useEffect(() => {
    let alive = true;
    window.dockdesk.settings.getTrayEnabled().then((v) => alive && setTrayEnabled(v));
    return () => {
      alive = false;
    };
  }, []);

  async function toggleTray() {
    const next = !trayEnabled;
    setTrayEnabled(next);
    await window.dockdesk.settings.setTrayEnabled(next);
  }

  function togglePrivacy() {
    const next = !privacyActive;
    // ligar sem projeto escolhido: assume o primeiro disponível
    if (next && !privacyProject && projects.length > 0) {
      onSelectPrivacyProject(projects[0]);
    }
    onTogglePrivacy(next);
  }

  // mantém o projeto selecionado como opção mesmo se ele sumir da lista viva
  const projectOptions =
    privacyProject && !projects.includes(privacyProject)
      ? [privacyProject, ...projects]
      : projects;

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

      <div className={`privacy-box ${privacyActive ? 'on' : ''}`} data-testid="privacy-box">
        <button
          className={`privacy-toggle ${privacyActive ? 'on' : ''}`}
          onClick={togglePrivacy}
          title={t('privacy_hint')}
          data-testid="privacy-toggle"
        >
          {privacyActive ? <Eye size={14} /> : <EyeOff size={14} />}
          {t('privacy_mode')}
        </button>
        <select
          className="privacy-select"
          value={privacyProject ?? ''}
          onChange={(e) => onSelectPrivacyProject(e.target.value || null)}
          disabled={projects.length === 0 && !privacyProject}
          data-testid="privacy-select"
        >
          <option value="">{t('privacy_pick')}</option>
          {projectOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

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
        <label className="footer-line tray-toggle" title={t('tray_icon_hint')}>
          <input
            type="checkbox"
            checked={trayEnabled}
            onChange={toggleTray}
            data-testid="tray-toggle"
          />
          {t('tray_icon_label')}
        </label>
      </div>
    </aside>
  );
}
