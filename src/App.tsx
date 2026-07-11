import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContainerStats, ContainerSummary } from './global';
import { Sidebar, type ViewName } from './components/Sidebar';
import { ContainersView } from './components/ContainersView';
import { ComposeView } from './components/ComposeView';
import { ImagesView } from './components/ImagesView';
import { VolumesView } from './components/VolumesView';
import { NetworksView } from './components/NetworksView';
import { I18nProvider } from './i18n';
import { useTheme } from './hooks/useTheme';

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
  const [view, setView] = useState<ViewName>('containers');
  const { theme, toggleTheme } = useTheme();
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

  return (
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={setView}
        engine={engine}
        runningCount={containers.filter((c) => c.state === 'running').length}
        totalCount={containers.length}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="main">
        {view === 'containers' && (
          <ContainersView
            containers={containers}
            stats={stats}
            onRefresh={refreshContainers}
            notify={notify}
          />
        )}
        {view === 'compose' && <ComposeView notify={notify} />}
        {view === 'images' && <ImagesView notify={notify} />}
        {view === 'volumes' && <VolumesView notify={notify} />}
        {view === 'networks' && <NetworksView notify={notify} />}
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
