import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { X, Play, Square, RotateCw } from 'lucide-react';
import type { ContainerDetails, ContainerSummary } from '../global';
import { stateLabel } from '../utils';
import { TerminalPane } from './TerminalPane';
import { LogsPane } from './LogsPane';
import { ExecPane } from './ExecPane';
import { RoutinesPane } from './RoutinesPane';

type Tab = 'overview' | 'terminal' | 'exec' | 'routines' | 'logs';

interface Props {
  container: ContainerSummary;
  initialTab: 'overview' | 'terminal';
  onClose: () => void;
  onAction: (c: ContainerSummary, action: string) => Promise<void>;
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function ContainerDetail({ container, initialTab, onClose, onAction, notify }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  // abas já visitadas continuam montadas (só escondidas): terminal e saída
  // de comandos não são perdidos ao alternar entre abas
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([initialTab]));
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const running = container.state === 'running';

  const openTab = useCallback((t: Tab) => {
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
    setTab(t);
  }, []);

  const runInTerminal = useCallback(
    (cmd: string) => {
      setPendingCommand(cmd);
      openTab('terminal');
    },
    [openTab]
  );

  const commandSent = useCallback(() => setPendingCommand(null), []);

  useEffect(() => {
    let alive = true;
    window.dockdesk.containers
      .inspect(container.id)
      .then((d) => alive && setDetails(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [container.id, container.state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" data-testid="container-drawer">
        <div className="drawer-header">
          <div className="drawer-title-row">
            <span className={`state-indicator ${container.state}`} />
            <h2 className="drawer-title">{container.name}</h2>
            <span className={`badge ${container.state}`}>{stateLabel(container.state)}</span>
            {running ? (
              <>
                <button
                  className="btn sm"
                  onClick={() => onAction(container, 'restart')}
                  data-testid="drawer-restart"
                >
                  <RotateCw size={13} /> Reiniciar
                </button>
                <button
                  className="btn sm danger"
                  onClick={() => onAction(container, 'stop')}
                  data-testid="drawer-stop"
                >
                  <Square size={13} /> Parar
                </button>
              </>
            ) : (
              <button
                className="btn sm success"
                onClick={() => onAction(container, 'start')}
                data-testid="drawer-start"
              >
                <Play size={13} /> Ligar
              </button>
            )}
            <button className="btn icon-only" onClick={onClose} data-testid="drawer-close">
              <X size={16} />
            </button>
          </div>
          <div className="tabs">
            {(
              [
                ['overview', 'Visão geral'],
                ['terminal', 'Terminal'],
                ['exec', 'Executar comando'],
                ['routines', 'Rotinas'],
                ['logs', 'Logs'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                className={`tab ${tab === key ? 'active' : ''}`}
                onClick={() => openTab(key)}
                data-testid={`tab-${key}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="drawer-body">
          <PaneHolder active={tab === 'overview'} mounted={visited.has('overview')}>
            <Overview container={container} details={details} />
          </PaneHolder>
          <PaneHolder active={tab === 'terminal'} mounted={visited.has('terminal')}>
            <TerminalPane
              container={container}
              notify={notify}
              pendingCommand={pendingCommand}
              onCommandSent={commandSent}
            />
          </PaneHolder>
          <PaneHolder active={tab === 'exec'} mounted={visited.has('exec')}>
            <ExecPane container={container} notify={notify} />
          </PaneHolder>
          <PaneHolder active={tab === 'routines'} mounted={visited.has('routines')}>
            <RoutinesPane container={container} onRunInTerminal={runInTerminal} />
          </PaneHolder>
          <PaneHolder active={tab === 'logs'} mounted={visited.has('logs')}>
            <LogsPane containerId={container.id} />
          </PaneHolder>
        </div>
      </div>
    </>
  );
}

function PaneHolder({
  active,
  mounted,
  children,
}: {
  active: boolean;
  mounted: boolean;
  children: ReactNode;
}) {
  if (!mounted) return null;
  return (
    <div
      style={{
        display: active ? 'flex' : 'none',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

function Overview({
  container,
  details,
}: {
  container: ContainerSummary;
  details: ContainerDetails | null;
}) {
  return (
    <div className="pane-scroll">
    <div className="detail-grid" data-testid="overview-pane">
      <div className="detail-item">
        <h4>Imagem</h4>
        <code>{container.image}</code>
      </div>
      <div className="detail-item">
        <h4>ID</h4>
        <code>{container.shortId}</code>
      </div>
      <div className="detail-item">
        <h4>Status</h4>
        <p>{container.status}</p>
      </div>
      {details && (
        <>
          <div className="detail-item">
            <h4>IP interno</h4>
            <code>{details.ipAddress || '—'}</code>
          </div>
          <div className="detail-item">
            <h4>Redes</h4>
            <code>{details.networks.join(', ') || '—'}</code>
          </div>
          <div className="detail-item">
            <h4>Reinícios</h4>
            <p>{details.restartCount}</p>
          </div>
          <div className="detail-item wide">
            <h4>Comando</h4>
            <code>
              {[...(details.entrypoint ?? []), ...(details.cmd ?? [])].join(' ') || '—'}
            </code>
          </div>
          {container.ports.length > 0 && (
            <div className="detail-item wide">
              <h4>Portas</h4>
              <div className="container-ports">
                {container.ports.map((p, i) => (
                  <span key={i} className="port-chip">
                    {p.public ? `localhost:${p.public} → ${p.private}` : p.private}/{p.type}
                  </span>
                ))}
              </div>
            </div>
          )}
          {details.mounts.length > 0 && (
            <div className="detail-item wide">
              <h4>Volumes / Montagens</h4>
              {details.mounts.map((m, i) => (
                <div key={i} className="mount-row">
                  <span>{m.source}</span>
                  <span className="arrow">→</span>
                  <span>{m.destination}</span>
                  <span>({m.rw ? 'leitura/escrita' : 'somente leitura'})</span>
                </div>
              ))}
            </div>
          )}
          {details.env.length > 0 && (
            <div className="detail-item wide">
              <h4>Variáveis de ambiente</h4>
              <div className="env-list">
                {details.env.map((e, i) => (
                  <code key={i}>{e}</code>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}
