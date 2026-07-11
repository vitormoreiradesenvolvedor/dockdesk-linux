import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { X, Play, Square, RotateCw } from 'lucide-react';
import type { ContainerDetails, ContainerSummary } from '../global';
import { TerminalPane } from './TerminalPane';
import { LogsPane } from './LogsPane';
import { ExecPane } from './ExecPane';
import { RoutinesPane } from './RoutinesPane';
import { useI18n } from '../i18n';

type Tab = 'overview' | 'terminal' | 'exec' | 'routines' | 'logs';

interface Props {
  container: ContainerSummary;
  initialTab: 'overview' | 'terminal';
  onClose: () => void;
  onAction: (c: ContainerSummary, action: string) => Promise<void>;
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function ContainerDetail({ container, initialTab, onClose, onAction, notify }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initialTab);
  // abas já visitadas continuam montadas (só escondidas): terminal e saída
  // de comandos não são perdidos ao alternar entre abas
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([initialTab]));
  const [details, setDetails] = useState<ContainerDetails | null>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const running = container.state === 'running';

  const openTab = useCallback((tb: Tab) => {
    setVisited((v) => (v.has(tb) ? v : new Set(v).add(tb)));
    setTab(tb);
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
            <span className={`badge ${container.state}`}>{t(`state_${container.state}`)}</span>
            {running ? (
              <>
                <button
                  className="btn sm"
                  onClick={() => onAction(container, 'restart')}
                  data-testid="drawer-restart"
                >
                  <RotateCw size={13} /> {t('action_restart')}
                </button>
                <button
                  className="btn sm danger"
                  onClick={() => onAction(container, 'stop')}
                  data-testid="drawer-stop"
                >
                  <Square size={13} /> {t('action_stop')}
                </button>
              </>
            ) : (
              <button
                className="btn sm success"
                onClick={() => onAction(container, 'start')}
                data-testid="drawer-start"
              >
                <Play size={13} /> {t('action_start')}
              </button>
            )}
            <button className="btn icon-only" onClick={onClose} data-testid="drawer-close">
              <X size={16} />
            </button>
          </div>
          <div className="tabs">
            {(
              [
                ['overview', t('tab_overview')],
                ['terminal', t('tab_terminal')],
                ['exec', t('tab_exec')],
                ['routines', t('tab_routines')],
                ['logs', t('tab_logs')],
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
  const { t } = useI18n();
  return (
    <div className="pane-scroll">
    <div className="detail-grid" data-testid="overview-pane">
      <div className="detail-item">
        <h4>{t('ov_image')}</h4>
        <code>{container.image}</code>
      </div>
      <div className="detail-item">
        <h4>{t('ov_id')}</h4>
        <code>{container.shortId}</code>
      </div>
      <div className="detail-item">
        <h4>{t('ov_status')}</h4>
        <p>{container.status}</p>
      </div>
      {details && (
        <>
          <div className="detail-item">
            <h4>{t('ov_ip')}</h4>
            <code>{details.ipAddress || '—'}</code>
          </div>
          <div className="detail-item">
            <h4>{t('ov_networks')}</h4>
            <code>{details.networks.join(', ') || '—'}</code>
          </div>
          <div className="detail-item">
            <h4>{t('ov_restarts')}</h4>
            <p>{details.restartCount}</p>
          </div>
          <div className="detail-item wide">
            <h4>{t('ov_command')}</h4>
            <code>
              {[...(details.entrypoint ?? []), ...(details.cmd ?? [])].join(' ') || '—'}
            </code>
          </div>
          {container.ports.length > 0 && (
            <div className="detail-item wide">
              <h4>{t('ov_ports')}</h4>
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
              <h4>{t('ov_mounts')}</h4>
              {details.mounts.map((m, i) => (
                <div key={i} className="mount-row">
                  <span>{m.source}</span>
                  <span className="arrow">→</span>
                  <span>{m.destination}</span>
                  <span>({m.rw ? t('rw') : t('ro')})</span>
                </div>
              ))}
            </div>
          )}
          {details.env.length > 0 && (
            <div className="detail-item wide">
              <h4>{t('ov_env')}</h4>
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
