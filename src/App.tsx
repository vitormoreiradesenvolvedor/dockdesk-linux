import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import type { ContainerStats, ContainerSummary } from './global';
import { Sidebar, type ViewName } from './components/Sidebar';
import { ContainersView } from './components/ContainersView';
import { ComposeView } from './components/ComposeView';
import { ImagesView } from './components/ImagesView';
import { VolumesView } from './components/VolumesView';
import { NetworksView } from './components/NetworksView';
import { I18nProvider, useI18n } from './i18n';
import { useTheme } from './hooks/useTheme';
import { usePrivacyMode } from './hooks/usePrivacyMode';

interface Toast {
  id: number;
  text: string;
  kind: 'error' | 'info';
}

let toastCounter = 0;

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}

function AppShell() {
  const { t } = useI18n();
  const [view, setView] = useState<ViewName>('containers');
  const { theme, toggleTheme } = useTheme();
  const privacy = usePrivacyMode();
  const [engine, setEngine] = useState<{ ok: boolean; version?: string; error?: string }>({
    ok: false,
  });
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [stats, setStats] = useState<Record<string, ContainerStats>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const statsBusy = useRef(false);

  const notify = useCallback((text: string, kind: 'error' | 'info' = 'error') => {
    const id = ++toastCounter;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const refreshContainers = useCallback(async () => {
    try {
      setContainers(await window.dockdesk.containers.list());
    } catch (err) {
      /* engine pode estar fora; o ping cuida do estado */
    }
  }, []);

  // ping da engine + lista de containers
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const ping = await window.dockdesk.engine.ping();
      if (!alive) return;
      setEngine(ping);
      if (ping.ok) await refreshContainers();
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [refreshContainers]);

  // métricas (chamada demora ~1s por design da API do Docker; evita sobreposição)
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (statsBusy.current) return;
      statsBusy.current = true;
      try {
        const s = await window.dockdesk.containers.stats();
        if (alive) setStats(s);
      } catch (_) {
      } finally {
        statsBusy.current = false;
      }
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  // projetos Compose disponíveis (derivados dos containers que o app já
  // monitora) — alimentam o seletor do modo privacidade
  const projects = [...new Set(containers.map((c) => c.composeProject).filter(Boolean))].sort() as string[];

  // com o modo privacidade ativo, os contadores da barra também refletem
  // apenas o projeto escolhido para não vazar a contagem dos demais
  const counted = privacy.project
    ? containers.filter((c) => c.composeProject === privacy.project)
    : containers;

  return (
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={setView}
        engine={engine}
        runningCount={counted.filter((c) => c.state === 'running').length}
        totalCount={counted.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        projects={projects}
        privacyActive={privacy.active}
        privacyProject={privacy.selected}
        onTogglePrivacy={privacy.setActive}
        onSelectPrivacyProject={privacy.setProject}
      />
      <main className="main">
        {privacy.project && (
          <div className="privacy-banner" data-testid="privacy-banner">
            <Eye size={14} />
            {t('privacy_banner', { project: privacy.project })}
            <button
              className="privacy-banner-off"
              onClick={() => privacy.setActive(false)}
              data-testid="privacy-banner-off"
            >
              {t('privacy_exit')}
            </button>
          </div>
        )}
        {view === 'containers' && (
          <ContainersView
            containers={containers}
            stats={stats}
            onRefresh={refreshContainers}
            notify={notify}
            privacyProject={privacy.project}
          />
        )}
        {view === 'compose' && (
          <ComposeView containers={containers} notify={notify} privacyProject={privacy.project} />
        )}
        {view === 'images' && <ImagesView notify={notify} privacyProject={privacy.project} />}
        {view === 'volumes' && <VolumesView notify={notify} privacyProject={privacy.project} />}
        {view === 'networks' && <NetworksView notify={notify} privacyProject={privacy.project} />}
      </main>
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} data-testid="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
